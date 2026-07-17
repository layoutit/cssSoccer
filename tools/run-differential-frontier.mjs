#!/usr/bin/env node
import { webcrypto } from "node:crypto";
import {
  createReadStream,
  existsSync,
} from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  parseWatcomMap,
  selectWatcomMapSymbol,
} from "./compiled-path-inspector-core.mjs";
import {
  DIFFERENTIAL_FRONTIER_AGENT_SCHEMA,
  DIFFERENTIAL_FRONTIER_EVIDENCE_SCHEMA,
  DifferentialFrontierError,
  buildTransitionClues,
  candidatePlayerContext,
  canonicalJson,
  changedNativeMembers,
  classifyMismatch,
  compareExactCoordinates,
  createExactSelector,
  decodeMatchPlayer,
  diffScalarMaps,
  findNativeWriteSites,
  findRuntimeProducerCandidates,
  flattenScalars,
  parseCssoraw2,
  requireSha256,
  sampleReport,
  samplesEqual,
  sha256,
  sha256Canonical,
} from "./support/differential-frontier-core.mjs";

const TOOL_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKSPACE_ROOT = dirname(TOOL_ROOT);
const DIAGNOSTIC_INSPECT_ANCHOR = [
  "    inspect() {",
  "      return engineInspection(current, nextTick);",
  "    },",
].join("\n");
const DIAGNOSTIC_INSPECT_REPLACEMENT = [
  "    inspect() {",
  "      return {",
  "        ...engineInspection(current, nextTick),",
  "        diagnosticState: current,",
  "      };",
  "    },",
].join("\n");
const SOURCE_EXTENSIONS = new Set([".C", ".CPP", ".H"]);
const TRACE_RUNTIME_FILE = "__differential-frontier-trace-runtime.mjs";
const TRACE_RUNTIME_SOURCE_PATH = join(
  TOOL_ROOT,
  "support/differential-frontier-trace-runtime.mjs",
);
const TRACE_IMPORT = [
  "import { createDifferentialFrontierTraceController as __createDifferentialFrontierTraceController }",
  `  from \"./${TRACE_RUNTIME_FILE}\";`,
  "",
].join("\n");
const TRACE_EXCLUDED_FUNCTIONS = new Set([
  "clone",
  "deepFreeze",
  "engineInspection",
  "requireEngineState",
  "requireFieldContract",
  "requirePlainObject",
  "requireTypedValue",
  "set",
]);

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return null;
  }
  const result = await runDifferentialFrontier(options, dependencies);
  const output = options.fullJson ? result : result.agentPacket;
  process.stdout.write(`${JSON.stringify(output, null, options.fullJson ? 2 : 0)}\n`);
  return result;
}

export async function runDifferentialFrontier(options = {}, dependencies = {}) {
  const started = performance.now();
  const workspaceRoot = resolve(options.workspaceRoot ?? DEFAULT_WORKSPACE_ROOT);
  const evidenceRoot = resolve(options.evidenceRoot ?? workspaceRoot);
  const preparedRoot = resolve(
    options.preparedRoot ?? join(workspaceRoot, "build/generated/public/cssoccer"),
  );
  const outputRoot = resolve(
    options.outputRoot ?? join(evidenceRoot, ".local/cssoccer/parity/frontier-runner"),
  );
  const context = await loadRetainedContext({ evidenceRoot, preparedRoot });
  const runtime = await createDiagnosticRuntime({
    workspaceRoot,
    outputRoot,
    preparedRoot,
    native: context.native,
    profile: context.profile,
  });
  try {
    const scan = await scanCurrentFrontier({
      statePath: context.paths.nativeState,
      expectedStateSha256: context.nativeState.sha256,
      runtime,
      retained: context.retained,
    });
    const evidence = await buildEvidence({
      workspaceRoot,
      evidenceRoot,
      outputRoot,
      context,
      runtime,
      scan,
      nativeSourceRoot: options.nativeSourceRoot,
      started,
    });
    const evidencePath = join(outputRoot, "current.json");
    const agentPacket = buildAgentPacket(evidence, evidencePath, evidenceRoot);
    const retained = Object.freeze({ ...evidence, agentPacket });
    await atomicWriteJson(evidencePath, retained);
    return retained;
  } finally {
    await runtime.cleanup();
  }
}

async function loadRetainedContext({ evidenceRoot, preparedRoot }) {
  const nativeCurrentPath = join(evidenceRoot, ".local/cssoccer/oracle/native/current.json");
  const native = await readJson(nativeCurrentPath);
  if (
    native?.schema !== "cssoccer-native-full-match-capture@1"
    || native.status !== "pass"
    || native.canonical?.exactIdentity?.status !== "pass"
    || native.canonical.exactIdentity.byteIdentical !== true
  ) {
    throw new DifferentialFrontierError(
      "native-authority-missing",
      "Retained native full-match authority is not a passing exact A/A capture.",
    );
  }
  const runName = Object.keys(native.canonical.runs ?? {})
    .sort()
    .find((name) => native.canonical.runs[name]?.status === "pass");
  if (!runName) {
    throw new DifferentialFrontierError("native-run-missing", "Retained native capture has no passing canonical run.");
  }
  const run = native.canonical.runs[runName];
  const stateArtifact = requireArtifact(run.artifacts?.state, "native state");
  const rawArtifact = requireArtifact(run.artifacts?.raw, "native raw");
  const profileArtifact = requireArtifact(run.artifacts?.profile, "native profile");
  const scenarioArtifact = requireArtifact(run.artifacts?.scenario, "native scenario");
  const paths = {
    nativeCurrent: nativeCurrentPath,
    nativeState: resolveArtifact(evidenceRoot, stateArtifact.path),
    nativeRaw: resolveArtifact(evidenceRoot, rawArtifact.path),
    nativeProfile: resolveArtifact(evidenceRoot, profileArtifact.path),
    nativeScenario: resolveArtifact(evidenceRoot, scenarioArtifact.path),
    differentialRoot: join(evidenceRoot, ".local/cssoccer/parity/differential/current"),
  };
  const [stateEvidence, rawEvidence, profileEvidence, scenarioEvidence] = await Promise.all([
    fileEvidence(paths.nativeState),
    fileEvidence(paths.nativeRaw),
    fileEvidence(paths.nativeProfile),
    fileEvidence(paths.nativeScenario),
  ]);
  verifyArtifact(stateEvidence, stateArtifact, "native state");
  verifyArtifact(rawEvidence, rawArtifact, "native raw");
  verifyArtifact(profileEvidence, profileArtifact, "native profile");
  verifyArtifact(scenarioEvidence, scenarioArtifact, "native scenario");
  const [profile, scenario] = await Promise.all([
    readJson(paths.nativeProfile),
    readJson(paths.nativeScenario),
  ]);
  verifyNativeBindings({ native, profile, scenario });
  const retained = await loadRetainedDifferential({
    differentialRoot: paths.differentialRoot,
    native,
    referenceSha256: stateEvidence.sha256,
  });
  const fixtureId = native.fixtureId;
  const factsPath = join(preparedRoot, "facts", `${fixtureId}.json`);
  const scenePath = join(preparedRoot, "scenes", `${fixtureId}.json`);
  const [facts, scene] = await Promise.all([readJson(factsPath), readJson(scenePath)]);
  return Object.freeze({
    native,
    nativeState: stateEvidence,
    nativeRaw: rawEvidence,
    profile,
    scenario,
    retained,
    prepared: { facts, scene, factsPath, scenePath },
    paths,
  });
}

async function loadRetainedDifferential({ differentialRoot, native, referenceSha256 }) {
  const manifestPath = join(differentialRoot, "current.json");
  const manifest = await readJson(manifestPath);
  if (manifest?.schema !== "burnlist-differential-testing-bundle@1") {
    throw new DifferentialFrontierError(
      "retained-differential-missing",
      "Current Differential Testing bundle is unavailable.",
    );
  }
  const selectedId = manifest.scenarioCatalog?.selectedScenarioId;
  const binding = manifest.scenarioBindings?.find(({ scenarioId }) => scenarioId === selectedId);
  if (!binding) {
    throw new DifferentialFrontierError(
      "retained-scenario-missing",
      "Current Differential Testing bundle has no selected scenario binding.",
    );
  }
  const scenarioPath = containedPath(differentialRoot, binding.path);
  const scenarioEvidence = await fileEvidence(scenarioPath);
  if (scenarioEvidence.sha256 !== binding.sha256 || scenarioEvidence.bytes !== binding.size) {
    throw new DifferentialFrontierError(
      "retained-scenario-binding",
      "Current Differential Testing scenario does not match its manifest binding.",
    );
  }
  const scenario = await readJson(scenarioPath);
  const data = scenario?.data;
  const engineIndependence = data?.adapter?.engineIndependence;
  const bindings = data?.adapter?.bindings;
  if (engineIndependence?.status !== "pass" || engineIndependence.check?.status !== "pass") {
    throw new DifferentialFrontierError(
      "zero-substitution-qualification-gap",
      "Retained candidate engine independence is not checked pass.",
    );
  }
  const expected = native.bindings;
  for (const [key, actual] of Object.entries({
    scenarioId: bindings?.scenarioId,
    scenarioSha256: bindings?.scenarioSha256,
    profileSha256: bindings?.profileSha256,
    inputSha256: bindings?.inputSha256,
    streamContractSha256: bindings?.streamContractSha256,
    referenceSha256: bindings?.reference?.artifactSha256,
  })) {
    const wanted = key === "streamContractSha256"
      ? expected.contractSha256
      : key === "referenceSha256"
        ? referenceSha256
        : expected[key];
    if (actual !== wanted) {
      throw new DifferentialFrontierError(
        "retained-binding-mismatch",
        `Retained Differential Testing binding ${key} is stale.`,
        { key, expected: wanted, actual },
      );
    }
  }
  const generationRoot = await realpath(differentialRoot);
  return Object.freeze({
    manifestPath,
    scenarioPath,
    scenarioSha256: scenarioEvidence.sha256,
    generationId: basename(generationRoot),
    publishedAt: manifest.publishedAt,
    exact: data.adapter.typedExact.earliestMismatch,
    fieldSelection: data.adapter.typedExact.fieldSelection,
    engineIndependence,
  });
}

async function createDiagnosticRuntime({
  workspaceRoot,
  outputRoot,
  preparedRoot,
  native,
  profile,
}) {
  const sourceRoot = join(workspaceRoot, "src/cssoccer");
  const entries = (await readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (entries.length === 0) {
    throw new DifferentialFrontierError("runtime-source-missing", "Browser runtime modules are unavailable.");
  }
  const runtimeFiles = {};
  const sourceFiles = [];
  for (const entry of entries) {
    const path = join(sourceRoot, entry.name);
    const text = await readFile(path, "utf8");
    runtimeFiles[`src/cssoccer/${entry.name}`] = sha256(text);
    sourceFiles.push(Object.freeze({ name: entry.name, path: relative(workspaceRoot, path), text }));
  }
  const engineFile = sourceFiles.find(({ name }) => name === "browserMatchEngine.mjs");
  if (!engineFile) {
    throw new DifferentialFrontierError("runtime-engine-missing", "Browser match engine source is unavailable.");
  }
  const engineDeclarations = topLevelFunctionDeclarations(engineFile.text);
  const transformedEngine = createDiagnosticEngineSource(
    engineFile.text,
    engineDeclarations,
  );
  const traceRuntimeSource = await readFile(TRACE_RUNTIME_SOURCE_PATH, "utf8");
  const runtimeSnapshotSha256 = sha256Canonical({
    schema: "cssoccer-browser-runtime-snapshot@1",
    files: runtimeFiles,
  });
  const workParent = join(outputRoot, ".work");
  await mkdir(workParent, { recursive: true });
  const diagnosticRoot = await mkdtemp(join(workParent, "runtime-"));
  const diagnosticSourceRoot = join(diagnosticRoot, "src/cssoccer");
  await mkdir(diagnosticSourceRoot, { recursive: true });
  await writeFile(
    join(diagnosticSourceRoot, TRACE_RUNTIME_FILE),
    traceRuntimeSource,
    { flag: "wx" },
  );
  for (const file of sourceFiles) {
    const target = join(diagnosticSourceRoot, file.name);
    await writeFile(
      target,
      file.name === "browserMatchEngine.mjs" ? transformedEngine : file.text,
      { flag: "wx" },
    );
  }
  const importModule = async (name) => import(
    `${pathToFileURL(join(diagnosticSourceRoot, name)).href}?snapshot=${runtimeSnapshotSha256}`
  );
  const [
    engineModule,
    matchModule,
    contractModule,
    oracleModule,
    independenceModule,
    presentationModule,
  ] = await Promise.all([
    importModule("browserMatchEngine.mjs"),
    importModule("matchState.mjs"),
    importModule("nativeFieldContract.mjs"),
    importModule("oracleState.mjs"),
    importModule("browserEngineIndependence.mjs"),
    importModule("polycssScene.mjs"),
  ]);
  const facts = await readJson(join(preparedRoot, "facts", `${native.fixtureId}.json`));
  const scene = await readJson(join(preparedRoot, "scenes", `${native.fixtureId}.json`));
  const selectedCountry = profile.binding?.country ?? profile.control?.country;
  if (typeof selectedCountry !== "string") {
    throw new DifferentialFrontierError("runtime-country-missing", "Native profile has no selected country.");
  }
  const matchState = matchModule.createCssoccerMatchState({
    preparedFacts: facts,
    preparedScene: scene,
    selectedCountry,
  });
  const candidateIdentity = await createCandidateIdentity({
    runtimeFiles,
    engineSource: engineFile.text,
    runtimeSnapshotSha256,
    transformSha256: sha256(transformedEngine),
    traceRuntimeSha256: sha256(traceRuntimeSource),
  });
  const engineIndependence = await independenceModule.qualifyCssoccerBrowserEngineIndependence({
    matchState,
    candidateIdentity,
    cryptoImpl: webcrypto,
  });
  const preset = presentationModule.CSSOCCER_PRESENTATION_CAMERA_PRESET;
  const camera = Object.freeze({
    presetId: preset.id,
    status: preset.status,
    target: scene.cameraAnchor.target,
    perspective: preset.perspective,
    rotX: preset.rotX,
    rotY: preset.rotY,
    zoom: preset.zoom,
  });
  const createEngine = () => engineModule.createCssoccerBrowserMatchEngine({
    matchState,
    preparedFacts: facts,
    preparedScene: scene,
    camera,
  });
  if (
    typeof engineModule.configureCssoccerDifferentialFrontierTrace !== "function"
    || typeof engineModule.readCssoccerDifferentialFrontierTrace !== "function"
  ) {
    throw new DifferentialFrontierError(
      "runtime-trace-seam",
      "Temporary browser runtime did not expose its diagnostic call trace.",
    );
  }
  const engine = createEngine();
  return Object.freeze({
    workspaceRoot,
    sourceFiles: Object.freeze(sourceFiles),
    runtimeFiles: Object.freeze(runtimeFiles),
    runtimeSnapshotSha256,
    engineDeclarations,
    candidateIdentity,
    engineIndependence,
    engine,
    createEngine,
    configureTrace: engineModule.configureCssoccerDifferentialFrontierTrace,
    readTrace: engineModule.readCssoccerDifferentialFrontierTrace,
    matchState,
    fields: contractModule.CSSOCCER_NATIVE_FIELDS,
    createTick: oracleModule.createCssoccerOracleTick,
    bindings: oracleModule.createCssoccerOracleBindings(matchState, {
      sourceSha256: candidateIdentity.sourceSha256,
      buildSha256: candidateIdentity.buildSha256,
    }),
    async cleanup() {
      await rm(diagnosticRoot, { recursive: true, force: true });
    },
  });
}

export function topLevelFunctionDeclarations(source) {
  if (typeof source !== "string" || source.length === 0) {
    throw new TypeError("Browser engine source must be non-empty text.");
  }
  const pattern = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gmu;
  const matches = [...source.matchAll(pattern)];
  return Object.freeze(matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? source.length;
    return Object.freeze({
      name: match[1],
      line: 1 + countNewlines(source, start),
      start,
      end,
      source: source.slice(start, end),
    });
  }));
}

export function createDiagnosticEngineSource(source, declarations) {
  const occurrences = source.split(DIAGNOSTIC_INSPECT_ANCHOR).length - 1;
  if (occurrences !== 1) {
    throw new DifferentialFrontierError(
      "runtime-diagnostic-seam",
      "Browser engine inspection seam changed; refusing an unbound diagnostic transform.",
      { occurrences },
    );
  }
  const inspectable = source.replace(
    DIAGNOSTIC_INSPECT_ANCHOR,
    DIAGNOSTIC_INSPECT_REPLACEMENT,
  );
  const wrapped = declarations.filter(({ name }) => !TRACE_EXCLUDED_FUNCTIONS.has(name));
  const traceFooter = [
    "",
    "const __differentialFrontierTraceController = __createDifferentialFrontierTraceController();",
    "export function configureCssoccerDifferentialFrontierTrace(config) {",
    "  __differentialFrontierTraceController.configure(config);",
    "}",
    "export function readCssoccerDifferentialFrontierTrace() {",
    "  return __differentialFrontierTraceController.read();",
    "}",
    ...wrapped.map(({ name, line }) => (
      `${name} = __differentialFrontierTraceController.wrap({ name: ${JSON.stringify(name)}, line: ${line} }, ${name});`
    )),
    "",
  ].join("\n");
  return `${TRACE_IMPORT}${inspectable}${traceFooter}`;
}

function countNewlines(value, end) {
  let count = 0;
  for (let index = 0; index < end; index += 1) {
    if (value.charCodeAt(index) === 10) count += 1;
  }
  return count;
}

async function createCandidateIdentity({
  runtimeFiles,
  engineSource,
  runtimeSnapshotSha256,
  transformSha256,
  traceRuntimeSha256,
}) {
  const forbiddenReads = engineSource.match(
    /node:|\.local\/|state\.jsonl|native\.raw|references\/|readFile|createReadStream/gu,
  ) ?? [];
  if (forbiddenReads.length !== 0) {
    throw new DifferentialFrontierError(
      "zero-substitution-runtime-read",
      "Browser engine source reads native, source, or retained artifacts.",
      { forbiddenReads },
    );
  }
  const runnerSha256 = sha256(await readFile(fileURLToPath(import.meta.url)));
  return Object.freeze({
    schema: "cssoccer-browser-candidate-identity@1",
    qualifiedAt: new Date().toISOString(),
    sourceSha256: sha256(engineSource),
    buildSha256: runtimeSnapshotSha256,
    harnessSha256: sha256Canonical({
      schema: "cssoccer-frontier-diagnostic-harness@1",
      files: {
        "tools/run-differential-frontier.mjs": runnerSha256,
        "src/cssoccer/browserEngineIndependence.mjs": runtimeFiles["src/cssoccer/browserEngineIndependence.mjs"],
        "src/cssoccer/browserMatchEngine.mjs": runtimeFiles["src/cssoccer/browserMatchEngine.mjs"],
      },
      diagnosticInspectTransformSha256: transformSha256,
      diagnosticTraceRuntimeSha256: traceRuntimeSha256,
    }),
    captureAdapterSha256: sha256Canonical({
      schema: "cssoccer-frontier-capture-adapter@1",
      files: {
        "tools/run-differential-frontier.mjs": runnerSha256,
        "src/cssoccer/nativeFieldContract.mjs": runtimeFiles["src/cssoccer/nativeFieldContract.mjs"],
        "src/cssoccer/oracleState.mjs": runtimeFiles["src/cssoccer/oracleState.mjs"],
      },
    }),
    checks: Object.freeze({
      browserOwnedState: true,
      nativeReplayReads: 0,
      preparedInputOnly: true,
      retainedStateReads: 0,
      sourceCheckoutReads: 0,
    }),
  });
}

async function scanCurrentFrontier({
  statePath,
  expectedStateSha256,
  runtime,
  retained,
}) {
  const ioModule = await import(
    `${pathToFileURL(join(runtime.workspaceRoot, "src/parity/io.mjs")).href}?frontier=${runtime.runtimeSnapshotSha256}`
  );
  const reader = await ioModule.openParityJsonlFile(statePath, { label: "retained native state" });
  try {
    const header = reader.header;
    verifyHeaderBindings(header, runtime, expectedStateSha256);
    verifyFieldContract(header.fields, runtime.fields);
    if (
      header.phases.length !== 1
      || header.phases[0].id !== "post_tick"
      || header.phases[0].order !== 0
    ) {
      throw new DifferentialFrontierError(
        "frontier-phase-gap",
        "Fast frontier runner currently requires the retained post_tick phase contract.",
      );
    }
    const selection = retained.fieldSelection;
    const selectedFields = header.fields.filter(({ id }) => fieldSelected(id, selection));
    const selectedIds = selectedFields.map(({ id }) => id);
    const fieldOrder = new Map(header.fields.map(({ id }, index) => [id, index]));
    let previousReference = null;
    let previousCandidate = null;
    let previousDiagnosticState = null;
    let mismatch = null;
    let sameTickMismatches = [];
    let referenceAtMismatch = null;
    let candidateAtMismatch = null;
    let diagnosticState = null;
    for (let tickOffset = 0; tickOffset < header.tickRange.count; tickOffset += 1) {
      const tick = header.tickRange.start + tickOffset;
      const nativeSamples = [];
      for (let index = 0; index < header.fields.length; index += 1) {
        nativeSamples.push(await reader.nextSample());
      }
      const projection = runtime.engine.capture({
        tick,
        phase: "post_tick",
        bindings: runtime.bindings,
        fields: runtime.fields,
      });
      const candidateSamples = runtime.createTick({
        tick,
        phase: "post_tick",
        fields: runtime.fields,
        values: projection.values,
      });
      diagnosticState = runtime.engine.inspect().diagnosticState;
      const nativeById = new Map(nativeSamples.map((sample) => [sample.fieldId, sample]));
      const candidateById = new Map(candidateSamples.map((sample) => [sample.fieldId, sample]));
      const failures = selectedIds
        .filter((fieldId) => !samplesEqual(nativeById.get(fieldId), candidateById.get(fieldId)))
        .map((fieldId) => mismatchReport(
          nativeById.get(fieldId),
          candidateById.get(fieldId),
          header.fields[fieldOrder.get(fieldId)],
        ));
      if (failures.length > 0) {
        [mismatch] = failures;
        sameTickMismatches = failures;
        referenceAtMismatch = nativeById;
        candidateAtMismatch = candidateById;
        break;
      }
      previousReference = nativeById;
      previousCandidate = candidateById;
      previousDiagnosticState = diagnosticState;
    }
    const exact = mismatch === null ? null : {
      ...mismatch,
      selector: createExactSelector(mismatch, fieldOrder),
    };
    const transitionClues = exact === null ? [] : buildTransitionClues({
      previousReference,
      previousCandidate,
      reference: referenceAtMismatch,
      candidate: candidateAtMismatch,
      selectedFieldIds: selectedIds,
      exactFieldId: exact.fieldId,
    });
    return Object.freeze({
      header,
      fieldOrder,
      selectedIds: Object.freeze(selectedIds),
      exact: exact === null ? null : Object.freeze({
        ...exact,
        route: classifyMismatch(exact, transitionClues),
      }),
      sameTickMismatches: Object.freeze(sameTickMismatches),
      transitionClues,
      previousReference,
      previousCandidate,
      referenceAtMismatch,
      candidateAtMismatch,
      previousDiagnosticState,
      diagnosticState,
    });
  } finally {
    await reader.close();
  }
}

async function buildEvidence({
  workspaceRoot,
  evidenceRoot,
  outputRoot,
  context,
  runtime,
  scan,
  nativeSourceRoot,
  started,
}) {
  const previousPath = join(outputRoot, "current.json");
  const previous = existsSync(previousPath) ? await readJson(previousPath) : null;
  const retainedExact = context.retained.exact;
  const retainedMovement = compareExactCoordinates(retainedExact, scan.exact, scan.fieldOrder);
  const priorMovement = previous?.schema === DIFFERENTIAL_FRONTIER_EVIDENCE_SCHEMA
    ? compareExactCoordinates(previous.current?.exact ?? null, scan.exact, scan.fieldOrder)
    : "first-run";
  const internal = await buildInternalContext({
    evidenceRoot,
    context,
    scan,
    nativeSourceRoot,
  });
  const callTrace = await traceFrontierCallPath({
    runtime,
    scan,
    nativePlayerNumber: scan.exact?.selector?.entityId
      ? nativePlayerForEntity(scan.exact.selector.entityId, context.scenario)
      : null,
  });
  const nativeFiles = internal.nativeSourceRoot
    ? await loadNativeSourceFiles(internal.nativeSourceRoot, evidenceRoot)
    : [];
  const additionalSymbols = internal.nativePlayerChanges.map(({ sourceMember }) => sourceMember);
  const preferredNativeValueSymbols = scan.exact === null
    ? []
    : nativeValueSymbols(runtime.sourceFiles, scan.exact);
  const nativeSites = scan.exact === null ? [] : findNativeWriteSites(nativeFiles, {
    sourceOwner: scan.exact.sourceOwner,
    additionalSymbols,
    preferredValueSymbols: preferredNativeValueSymbols,
  });
  const nativeFunctions = [...new Set(nativeSites.map((site) => site.function).filter(Boolean))];
  const runtimeCandidates = scan.exact === null ? [] : findRuntimeProducerCandidates(
    runtime.sourceFiles,
    {
      selector: scan.exact.selector,
      sourceOwner: scan.exact.sourceOwner,
      nativeFunctions,
      internalSymbols: additionalSymbols,
    },
  );
  const dynamicCandidates = scan.exact === null ? [] : rankDynamicProducerTrace({
    trace: callTrace,
    declarations: runtime.engineDeclarations,
    exact: scan.exact,
  });
  const producer = classifyProducer(runtimeCandidates, nativeSites, dynamicCandidates);
  const duplicate = priorMovement === "same"
    && previous?.bindings?.runtimeSnapshotSha256 === runtime.runtimeSnapshotSha256;
  const exactContext = scan.exact === null ? null : Object.freeze({
    scenarioId: context.native.bindings.scenarioId,
    scenarioSha256: context.native.bindings.scenarioSha256,
    profileSha256: context.native.bindings.profileSha256,
    inputSha256: context.native.bindings.inputSha256,
    fieldContractSha256: context.native.bindings.contractSha256,
    nativeBuildSha256: context.native.bindings.buildSha256,
    runtimeSnapshotSha256: runtime.runtimeSnapshotSha256,
    selector: scan.exact.selector,
    route: scan.exact.route,
  });
  const evidence = {
    schema: DIFFERENTIAL_FRONTIER_EVIDENCE_SCHEMA,
    status: scan.exact === null ? "complete" : "ready",
    authority: "diagnostic-current-runtime",
    parityAuthority: false,
    generatedAt: new Date().toISOString(),
    elapsedMilliseconds: Math.round(performance.now() - started),
    bindings: {
      scenarioId: context.native.bindings.scenarioId,
      scenarioSha256: context.native.bindings.scenarioSha256,
      profileSha256: context.native.bindings.profileSha256,
      inputSha256: context.native.bindings.inputSha256,
      fieldContractSha256: context.native.bindings.contractSha256,
      nativeStateSha256: context.nativeState.sha256,
      nativeRawSha256: context.nativeRaw.sha256,
      runtimeSnapshotSha256: runtime.runtimeSnapshotSha256,
    },
    engineIndependence: runtime.engineIndependence,
    retained: {
      generationId: context.retained.generationId,
      publishedAt: context.retained.publishedAt,
      scenarioSha256: context.retained.scenarioSha256,
      exact: retainedExact,
      movement: retainedMovement,
    },
    current: {
      exact: scan.exact,
      exactContext,
      sameTickMismatchCount: scan.sameTickMismatches.length,
      sameTickMismatches: scan.sameTickMismatches.slice(0, 16),
      transitionClues: scan.transitionClues,
      movementFromPreviousDiagnostic: priorMovement,
      duplicateOfPreviousRuntime: duplicate,
    },
    internal,
    producer: {
      ...producer,
      native: {
        sourceOwner: scan.exact?.sourceOwner ?? null,
        preferredValueSymbols: preferredNativeValueSymbols,
        writeSites: nativeSites,
      },
      browser: {
        callTrace,
        dynamicCandidates,
        candidates: runtimeCandidates,
      },
    },
    nextAction: nextAction({
      exact: scan.exact,
      producer,
      retainedMovement,
      duplicate,
      evidenceRoot,
      outputRoot,
    }),
  };
  evidence.actionId = sha256Canonical({
    schema: DIFFERENTIAL_FRONTIER_EVIDENCE_SCHEMA,
    bindings: evidence.bindings,
    exactContext,
    producer: evidence.producer,
  }).slice(0, 16);
  return Object.freeze(evidence);
}

async function buildInternalContext({ evidenceRoot, context, scan, nativeSourceRoot }) {
  const empty = {
    status: scan.exact === null ? "not-required" : "not-available",
    nativeSourceRoot: null,
    player: null,
    nativePlayerChanges: [],
    browserPlayerChanges: [],
    nativeBrowserDifferences: [],
  };
  const entityId = scan.exact?.selector?.entityId;
  if (!entityId) return Object.freeze(empty);
  const compiledProfilePath = join(
    evidenceRoot,
    ".local/cssoccer/compiled-path-inspector/current-profile.json",
  );
  if (!existsSync(compiledProfilePath)) return Object.freeze(empty);
  const compiledProfile = await readJson(compiledProfilePath);
  verifyCompiledProfile(compiledProfile, context.native.bindings, context.scenario.sourceRevision);
  const mapPath = resolveArtifact(evidenceRoot, compiledProfile.compiled.map.path);
  const mapEvidence = await fileEvidence(mapPath);
  if (mapEvidence.sha256 !== compiledProfile.compiled.map.sha256) {
    throw new DifferentialFrontierError("compiled-map-stale", "Compiled-path map no longer matches its profile.");
  }
  const mapEntries = parseWatcomMap(await readFile(mapPath, "utf8"));
  const teams = selectWatcomMapSymbol(mapEntries, "teams");
  if (teams.segment !== compiledProfile.compiled.dgroupSegment) {
    throw new DifferentialFrontierError("compiled-teams-segment", "Native teams symbol is outside retained DGROUP.");
  }
  const nativePlayerNumber = nativePlayerForEntity(entityId, context.scenario);
  const raw = parseCssoraw2(await readFile(context.paths.nativeRaw), {
    ranges: context.profile.transport.rawRanges,
  });
  const currentRecord = raw.byTick.get(scan.exact.tick);
  const previousRecord = raw.byTick.get(scan.exact.tick - 1) ?? null;
  if (!currentRecord) {
    throw new DifferentialFrontierError(
      "native-raw-frontier-missing",
      "Native raw evidence lacks the checked active tick.",
    );
  }
  const structSha256 = context.profile.transport.matchPlayerStructSha256;
  const nativeCurrent = decodeMatchPlayer(currentRecord, {
    teamsOffset: teams.offset,
    nativePlayerNumber,
    structSha256,
  });
  const nativePrevious = previousRecord === null ? null : decodeMatchPlayer(previousRecord, {
    teamsOffset: teams.offset,
    nativePlayerNumber,
    structSha256,
  });
  const candidateCurrent = candidatePlayerContext(scan.diagnosticState, entityId);
  const candidatePrevious = candidatePlayerContext(scan.previousDiagnosticState, entityId);
  const candidateCurrentFlat = flattenScalars(candidateCurrent ?? {});
  const candidatePreviousFlat = flattenScalars(candidatePrevious ?? {});
  const nativePlayerChanges = changedNativeMembers(nativePrevious, nativeCurrent, structSha256);
  const browserPlayerChanges = diffScalarMaps(candidatePreviousFlat, candidateCurrentFlat);
  const nativeBrowserDifferences = Object.keys(nativeCurrent)
    .filter((path) => candidateCurrentFlat.has(path) && !Object.is(nativeCurrent[path], candidateCurrentFlat.get(path)))
    .slice(0, 40)
    .map((path) => Object.freeze({
      path,
      native: nativeCurrent[path],
      browser: candidateCurrentFlat.get(path),
    }));
  const inferredSourceRoot = nativeSourceRoot
    ? resolve(nativeSourceRoot)
    : inferNativeSourceRoot(compiledProfile, evidenceRoot);
  return Object.freeze({
    status: "available",
    nativeSourceRoot: inferredSourceRoot,
    player: {
      entityId,
      nativePlayerNumber,
      structSha256,
      teamsAddress: `${teams.segment}:0x${teams.offset.toString(16).padStart(8, "0")}`,
    },
    nativePlayerChanges: Object.freeze(nativePlayerChanges),
    browserPlayerChanges,
    nativeBrowserDifferences: Object.freeze(nativeBrowserDifferences),
  });
}

async function traceFrontierCallPath({ runtime, scan, nativePlayerNumber }) {
  const exact = scan.exact;
  if (exact === null || exact.selector.entityId === null) {
    return Object.freeze({
      schema: "cssoccer-differential-frontier-call-trace@1",
      status: "not-applicable",
      entityId: null,
      nativePlayerNumber: null,
      truncated: false,
      records: Object.freeze([]),
    });
  }
  const engine = runtime.createEngine();
  let captured = null;
  try {
    for (let tick = 0; tick <= exact.tick; tick += 1) {
      if (tick === exact.tick) {
        runtime.configureTrace({
          entityId: exact.selector.entityId,
          nativePlayerNumber,
        });
      }
      engine.capture({
        tick,
        phase: exact.phase,
        bindings: runtime.bindings,
        fields: runtime.fields,
      });
      if (tick === exact.tick) captured = runtime.readTrace();
    }
  } finally {
    runtime.configureTrace(null);
  }
  if (captured === null) {
    throw new DifferentialFrontierError(
      "runtime-trace-empty",
      "Browser producer trace did not reach the checked frontier.",
    );
  }
  return Object.freeze({
    ...captured,
    records: Object.freeze(captured.records.map(Object.freeze)),
  });
}

function nativeValueSymbols(sourceFiles, exact) {
  if (!Number.isSafeInteger(exact.reference.value)) return Object.freeze([]);
  const symbols = [];
  const pattern = /integerConstant\(\s*"([^"]+)"\s*,\s*"([iu](?:8|16|32))"\s*,\s*(-?\d+)\s*\)/gu;
  const runtimeActionPattern = /\bconst\s+([A-Z][A-Z0-9_]*_ACTION)\s*=\s*(-?\d+)\s*;/gu;
  for (const file of sourceFiles) {
    if (/Profile\.mjs$/u.test(file.name)) {
      for (const match of file.text.matchAll(pattern)) {
        if (match[2] !== exact.reference.valueType || Number(match[3]) !== exact.reference.value) continue;
        if (exact.selector.leaf === "action" && !/_ACT$/u.test(match[1])) continue;
        symbols.push(match[1]);
      }
    }
    if (exact.selector.leaf === "action") {
      for (const match of file.text.matchAll(runtimeActionPattern)) {
        if (Number(match[2]) !== exact.reference.value) continue;
        symbols.push(match[1].replace(/^LIVE_/u, "").replace(/_ACTION$/u, "_ACT"));
      }
    }
  }
  return Object.freeze([...new Set(symbols)]);
}

export function rankDynamicProducerTrace({ trace, declarations, exact, limit = 8 }) {
  if (trace?.status !== "captured" || !Array.isArray(trace.records)) {
    return Object.freeze([]);
  }
  const declarationByName = new Map(declarations.map((entry) => [entry.name, entry]));
  const paths = selectorSnapshotPaths(exact.selector.leaf);
  const candidateValue = exact.candidate.value;
  const byFunction = new Map();
  for (const record of trace.records) {
    const declaration = declarationByName.get(record.function);
    if (!declaration) continue;
    const before = firstSnapshotValue(record.input?.snapshot, paths);
    const after = firstSnapshotValue(record.output?.snapshot, paths);
    const sourceFocus = selectorSourceFocus(declaration.source, paths);
    let score = 0;
    if (record.output?.depth === 0) score += 100;
    else if (Number.isSafeInteger(record.output?.depth)) score += Math.max(5, 55 - record.output.depth * 10);
    if (record.input?.depth === 1) score += 38;
    else if (record.input?.depth === 0) score += 44;
    else if (Number.isSafeInteger(record.input?.depth)) score += Math.max(3, 25 - record.input.depth * 4);
    if (sourceFocus.writes) score += 65;
    else if (sourceFocus.mentions) score += 18;
    if (after.found && Object.is(after.value, candidateValue)) score += 30;
    if (before.found && after.found && !Object.is(before.value, after.value)) score += 24;
    score += Math.min(record.callDepth, 8) * 3;
    const candidate = Object.freeze({
      file: "src/cssoccer/browserMatchEngine.mjs",
      function: record.function,
      line: record.line,
      score,
      callDepth: record.callDepth,
      inputDepth: record.input?.depth ?? null,
      outputDepth: record.output?.depth ?? null,
      before: before.found ? before.value : null,
      after: after.found ? after.value : null,
      candidateValueMatched: after.found && Object.is(after.value, candidateValue),
      writesSelectedField: sourceFocus.writes,
      source: sourceFocus.line,
    });
    const prior = byFunction.get(record.function);
    if (prior === undefined || candidate.score > prior.score) byFunction.set(record.function, candidate);
  }
  return Object.freeze([...byFunction.values()]
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score
      || right.callDepth - left.callDepth
      || left.line - right.line)
    .slice(0, limit));
}

function selectorSnapshotPaths(leaf) {
  const paths = {
    action: ["action", "actionId"],
    animation: ["animation"],
    animation_frame: ["animationFrame"],
    ball_state: ["ballState"],
    control: ["control"],
    face_direction: ["faceDirection"],
    native_player: ["nativePlayerNumber"],
    on: ["on", "active"],
    possession: ["possessionTicks", "possession"],
    stable_id: ["id", "stableId"],
    x: ["position.x", "x"],
    x_displacement: ["displacement.x", "goDisplacement.x", "xDisplacement"],
    y: ["position.y", "y"],
    y_displacement: ["displacement.y", "goDisplacement.y", "yDisplacement"],
    z: ["position.z", "z"],
    z_displacement: ["displacement.z", "goDisplacement.z", "zDisplacement"],
  };
  return Object.freeze(paths[leaf] ?? [leaf, snakeToCamel(leaf)]);
}

function firstSnapshotValue(snapshot, paths) {
  if (!snapshot || typeof snapshot !== "object") return { found: false, value: null };
  for (const path of paths) {
    let value = snapshot;
    let found = true;
    for (const part of path.split(".")) {
      if (!value || typeof value !== "object" || !Object.hasOwn(value, part)) {
        found = false;
        break;
      }
      value = value[part];
    }
    if (found) return { found: true, value };
  }
  return { found: false, value: null };
}

function selectorSourceFocus(source, paths) {
  const terms = [...new Set(paths.map((path) => path.split(".").at(-1)))];
  const lines = source.split(/\r?\n/u);
  let mention = null;
  for (const line of lines) {
    const term = terms.find((entry) => new RegExp(`\\b${escapeRegExp(entry)}\\b`, "u").test(line));
    if (!term) continue;
    if (mention === null) mention = line.trim().slice(0, 220);
    const writePattern = new RegExp(
      `(?:\\.${escapeRegExp(term)}\\s*(?:[+\\-*/%&|^]?=)|\\b${escapeRegExp(term)}\\s*:|\\b${escapeRegExp(term)}\\s*(?:[+\\-*/%&|^]?=))`,
      "u",
    );
    if (writePattern.test(line)) {
      return { writes: true, mentions: true, line: line.trim().slice(0, 220) };
    }
  }
  return { writes: false, mentions: mention !== null, line: mention };
}

function snakeToCamel(value) {
  return value.replace(/_([a-z])/gu, (_match, character) => character.toUpperCase());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function classifyProducer(runtimeCandidates, nativeSites, dynamicCandidates) {
  const dynamic = dynamicCandidates[0] ?? null;
  const dynamicSecond = dynamicCandidates[1] ?? null;
  const dynamicConfident = dynamic !== null
    && dynamic.score >= 150
    && (
      dynamic.outputDepth === 0
      || dynamicSecond === null
      || dynamic.score >= dynamicSecond.score + 24
    );
  const runtimeOnly = runtimeCandidates.filter(({ classification }) => classification === "runtime");
  const first = runtimeOnly[0] ?? null;
  const second = runtimeOnly[1] ?? null;
  const staticConfident = first !== null
    && first.score >= 32
    && (second === null || first.score >= second.score * 1.2);
  const surfaced = dynamicConfident || staticConfident;
  const selected = dynamicConfident
    ? dynamic
    : staticConfident
      ? {
          file: first.file,
          function: first.sites[0]?.function ?? null,
          line: first.sites[0]?.line ?? null,
        }
      : null;
  return Object.freeze({
    status: surfaced ? "surfaced" : (dynamic ?? first) ? "ambiguous" : "routing-gap",
    candidateFile: selected?.file ?? null,
    candidateFunction: selected?.function ?? null,
    candidateLine: selected?.line ?? null,
    confidence: dynamicConfident
      ? "diagnostic-trace-high"
      : staticConfident
        ? "advisory-high"
        : (dynamic ?? first)
          ? "advisory-low"
          : "none",
    nativeFunction: nativeSites[0]?.function ?? null,
    alternatives: Object.freeze(dynamicCandidates.slice(0, 3)),
    diagnosticOnly: true,
  });
}

function nextAction({ exact, producer, retainedMovement, duplicate, evidenceRoot, outputRoot }) {
  if (exact === null) {
    return Object.freeze({
      kind: "public-evaluation",
      question: "The diagnostic engine is exact; run the full capture and synchronous publisher.",
      command: "pnpm capture:browser:full-match:check && pnpm oven:differential",
    });
  }
  if (producer.status === "surfaced") {
    return Object.freeze({
      kind: "inspect-producer",
      file: producer.candidateFile,
      function: producer.candidateFunction,
      line: producer.candidateLine,
      question: exact.route.question,
      publicEvaluationCommand: "pnpm capture:browser:full-match:check && pnpm oven:differential",
      rerunCommand: "node tools/run-differential-frontier.mjs --continue",
      doNotRerunBeforeRuntimeChanges: duplicate,
      note: duplicate
        ? "This exact runtime snapshot was already diagnosed. Inspect the named producer; rerun only after a runtime edit."
        : retainedMovement === "advanced"
        ? "Current runtime is ahead of the published retained frontier; this packet remains diagnostic until the public gate publishes it."
        : "Prepare one generic one-file runtime candidate, then use the public capture and publisher once.",
    });
  }
  return Object.freeze({
    kind: "routing-gap",
    question: exact.route.question,
    evidencePath: relativeOrAbsolute(evidenceRoot, join(outputRoot, "current.json")),
    note: "The runner retained exact context and transition evidence but could not name one browser producer safely.",
  });
}

function buildAgentPacket(evidence, evidencePath, evidenceRoot) {
  const exact = evidence.current.exact;
  const internal = evidence.internal;
  return Object.freeze({
    schema: DIFFERENTIAL_FRONTIER_AGENT_SCHEMA,
    status: evidence.status,
    actionId: evidence.actionId,
    elapsedMilliseconds: evidence.elapsedMilliseconds,
    authority: evidence.authority,
    parityAuthority: false,
    movement: evidence.retained.movement,
    diagnosticMovement: evidence.current.movementFromPreviousDiagnostic,
    duplicateOfPreviousRuntime: evidence.current.duplicateOfPreviousRuntime,
    retainedExact: compactExact(evidence.retained.exact),
    currentExact: compactExact(exact),
    route: exact?.route ?? null,
    producer: {
      status: evidence.producer.status,
      confidence: evidence.producer.confidence,
      file: evidence.producer.candidateFile,
      function: evidence.producer.candidateFunction,
      line: evidence.producer.candidateLine,
      nativeFunction: evidence.producer.nativeFunction,
      alternatives: evidence.producer.alternatives.slice(0, 3).map((candidate) => ({
        function: candidate.function,
        line: candidate.line,
        score: candidate.score,
        source: candidate.source,
      })),
      nativeSites: evidence.producer.native.writeSites.slice(0, 3).map((site) => ({
        file: site.file,
        line: site.line,
        function: site.function,
        write: site.write,
        source: site.source,
      })),
    },
    transitionClues: evidence.current.transitionClues.slice(0, 6).map((clue) => ({
      fieldId: clue.fieldId,
      referenceChanged: clue.referenceChanged,
      candidateChanged: clue.candidateChanged,
      reference: clue.reference,
      candidate: clue.candidate,
    })),
    internalChanges: internal.nativePlayerChanges.slice(0, 8).map((change) => ({
      sourceMember: change.sourceMember,
      before: change.before,
      after: change.after,
    })),
    nextAction: evidence.nextAction,
    evidencePath: relativeOrAbsolute(evidenceRoot, evidencePath),
  });
}

function compactExact(exact) {
  if (exact === null || exact === undefined) return null;
  return {
    tick: exact.tick,
    phase: exact.phase,
    fieldId: exact.fieldId,
    sourceOwner: exact.sourceOwner,
    reference: exact.reference,
    candidate: exact.candidate,
  };
}

function mismatchReport(reference, candidate, field) {
  return Object.freeze({
    tick: reference.tick,
    phase: reference.phase,
    phaseOrder: 0,
    fieldId: reference.fieldId,
    fieldLabel: field.label,
    sourceOwner: field.sourceOwner,
    reason: reference.valueType !== candidate.valueType
      ? "value-type"
      : reference.numericBits !== null || candidate.numericBits !== null
        ? "numeric-bits"
        : "value",
    reference: sampleReport(reference),
    candidate: sampleReport(candidate),
  });
}

function verifyNativeBindings({ native, profile, scenario }) {
  const bindings = native.bindings;
  const actual = {
    scenarioSha256: scenario.scenarioSha256,
    profileSha256: profile.profileSha256,
    inputSha256: profile.binding?.commandStreamSha256,
    buildSha256: profile.buildSha256,
    sourceRevision: scenario.sourceRevision,
  };
  const expected = {
    scenarioSha256: bindings.scenarioSha256,
    profileSha256: bindings.profileSha256,
    inputSha256: bindings.inputSha256,
    buildSha256: bindings.buildSha256,
    sourceRevision: native.source.revision,
  };
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) {
      throw new DifferentialFrontierError(
        "native-binding-mismatch",
        `Native retained ${key} binding is inconsistent.`,
        { key, expected: expected[key], actual: actual[key] },
      );
    }
  }
}

function verifyHeaderBindings(header, runtime, expectedStateSha256) {
  const expected = runtime.bindings;
  const actual = header.bindings;
  for (const key of [
    "scenarioId",
    "scenarioSha256",
    "profileSha256",
    "inputSha256",
    "contractSha256",
  ]) {
    if (actual[key] !== expected[key]) {
      throw new DifferentialFrontierError(
        "native-stream-binding",
        `Native state header ${key} does not match the prepared browser fixture.`,
      );
    }
  }
  requireSha256(expectedStateSha256, "native state SHA-256");
}

function verifyFieldContract(reference, candidate) {
  const normalize = (fields) => fields.map(({ id, label, sourceOwner, meaning, unit, valueType }) => ({
    id, label, sourceOwner, meaning, unit, valueType,
  }));
  if (canonicalJson(normalize(reference)) !== canonicalJson(normalize(candidate))) {
    throw new DifferentialFrontierError(
      "frontier-field-contract",
      "Current browser field contract differs from the retained native contract.",
    );
  }
}

function verifyCompiledProfile(profile, bindings, sourceRevision) {
  if (profile?.schema !== "cssoccer-current-compiled-path-profile@1") {
    throw new DifferentialFrontierError("compiled-profile-invalid", "Compiled-path profile is invalid.");
  }
  const expected = {
    sourceRevision,
    scenarioSha256: bindings.scenarioSha256,
    profileSha256: bindings.profileSha256,
    inputSha256: bindings.inputSha256,
    fieldContractSha256: bindings.contractSha256,
    nativeBuildSha256: bindings.buildSha256,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (profile.workspace?.[key] !== value) {
      throw new DifferentialFrontierError(
        "compiled-profile-stale",
        `Compiled-path profile is stale at ${key}.`,
      );
    }
  }
}

async function loadNativeSourceFiles(root, evidenceRoot) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")).toUpperCase())) continue;
    const path = join(root, entry.name);
    files.push(Object.freeze({
      name: entry.name,
      path: relativeOrAbsolute(evidenceRoot, path),
      text: await readFile(path, "utf8"),
    }));
  }
  return Object.freeze(files);
}

function inferNativeSourceRoot(compiledProfile, evidenceRoot) {
  const first = Object.values(compiledProfile.compiled.objects ?? {})[0];
  if (!first?.path) return null;
  return dirname(resolveArtifact(evidenceRoot, first.path));
}

function nativePlayerForEntity(entityId, scenario) {
  const match = entityId.match(/^([a-z0-9-]+)-player-([0-9]{2})$/u);
  if (!match) {
    throw new DifferentialFrontierError(
      "frontier-player-id",
      `Cannot map ${entityId} to a native player index.`,
    );
  }
  const ordinal = Number.parseInt(match[2], 10);
  if (ordinal < 1 || ordinal > 11) {
    throw new DifferentialFrontierError("frontier-player-ordinal", `Player ordinal is invalid in ${entityId}.`);
  }
  const home = scenario.fixture?.home?.country;
  const away = scenario.fixture?.away?.country;
  if (match[1] === home) return ordinal;
  if (match[1] === away) return 11 + ordinal;
  throw new DifferentialFrontierError("frontier-player-country", `Player country is invalid in ${entityId}.`);
}

function fieldSelected(fieldId, selection) {
  return selection.includedPrefixes.some((prefix) => fieldId.startsWith(prefix))
    && !selection.excludedPrefixes.some((prefix) => fieldId.startsWith(prefix));
}

function requireArtifact(value, label) {
  if (
    !value
    || typeof value.path !== "string"
    || !Number.isSafeInteger(value.bytes)
  ) {
    throw new DifferentialFrontierError("retained-artifact-missing", `${label} artifact binding is missing.`);
  }
  requireSha256(value.sha256, `${label} SHA-256`);
  return value;
}

async function fileEvidence(path) {
  const metadata = await stat(path);
  if (!metadata.isFile()) throw new TypeError(`${path} must be a regular file.`);
  const hash = await sha256Stream(path);
  return Object.freeze({ path, bytes: metadata.size, sha256: hash });
}

async function sha256Stream(path) {
  const hash = (await import("node:crypto")).createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

function verifyArtifact(actual, expected, label) {
  if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
    throw new DifferentialFrontierError(
      "retained-artifact-stale",
      `${label} does not match its retained binding.`,
    );
  }
}

async function readJson(path) {
  let value;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new DifferentialFrontierError(
      "json-read-failed",
      `Cannot read ${path}: ${error.message}`,
    );
  }
  return value;
}

async function atomicWriteJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  await rename(temporary, path);
}

function resolveArtifact(root, path) {
  return isAbsolute(path) ? resolve(path) : containedPath(root, path);
}

function containedPath(root, path) {
  const absoluteRoot = resolve(root);
  const absolute = resolve(absoluteRoot, path);
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${sep}`)) {
    throw new DifferentialFrontierError("path-escape", `${path} escapes ${root}.`);
  }
  return absolute;
}

function relativeOrAbsolute(root, path) {
  const rel = relative(resolve(root), resolve(path));
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." ? rel : resolve(path);
}

function parseArguments(argv) {
  const options = {};
  const values = new Map([
    ["--workspace-root", "workspaceRoot"],
    ["--evidence-root", "evidenceRoot"],
    ["--prepared-root", "preparedRoot"],
    ["--output-root", "outputRoot"],
    ["--native-source-root", "nativeSourceRoot"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--continue") continue;
    if (argument === "--full-json") {
      options.fullJson = true;
      continue;
    }
    const key = values.get(argument);
    if (!key) throw new TypeError(`Unknown differential frontier option ${argument}.`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new TypeError(`${argument} requires a value.`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return [
    "Usage: node tools/run-differential-frontier.mjs --continue [--full-json]",
    "",
    "Runs the current browser engine only to the retained native first mismatch,",
    "preserves the full Exact envelope, surfaces native/browser producer candidates,",
    "and prints one compact agent packet. It does not authorize or publish a patch.",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const failure = {
      schema: "cssoccer-differential-frontier-failure@1",
      status: "tool-gap",
      code: error instanceof DifferentialFrontierError
        ? error.code
        : "differential-frontier-error",
      message: error instanceof Error ? error.message : String(error),
      details: error instanceof DifferentialFrontierError ? error.details ?? null : null,
    };
    process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 1;
  });
}

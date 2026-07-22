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
import { runCurrentCompiledPathCheck } from "./run-compiled-path-check.mjs";
import {
  DIFFERENTIAL_FRONTIER_PACKET_SCHEMA,
  DIFFERENTIAL_FRONTIER_EVIDENCE_SCHEMA,
  DifferentialFrontierError,
  buildTransitionClues,
  buildNativeSymbolTable,
  candidatePlayerContext,
  canonicalJson,
  changedNativeMembers,
  classifyMismatch,
  compareExactCoordinates,
  createExactSelector,
  decodeMatchPlayer,
  diffScalarMaps,
  findBrowserMappingCandidates,
  findNativeBranchDiscriminators,
  findNativeCallerBranches,
  findNativeGuardedCallSites,
  findNativeWriteSites,
  findRuntimeProducerCandidates,
  flattenScalars,
  parseCssoraw2,
  requireSha256,
  resolveNativeTransitionSymbols,
  sampleReport,
  samplesEqual,
  sha256,
  sha256Canonical,
} from "./support/differential-frontier-core.mjs";
import {
  classifyCssoccerFreePlayComparisonField,
  createCssoccerFreePlayScenarioAdapter,
  parseCssoccerFreePlayCommandScenario,
} from "./support/free-play-scenario-adapter.mjs";

const TOOL_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKSPACE_ROOT = dirname(TOOL_ROOT);
const SOURCE_EXTENSIONS = new Set([".C", ".CPP", ".H"]);
const TRACE_RUNTIME_FILE = "__differential-frontier-trace-runtime.mjs";
const TRACE_RUNTIME_SOURCE_PATH = join(
  TOOL_ROOT,
  "support/differential-frontier-trace-runtime.mjs",
);
const TRACE_IMPORT = [
  "import { differentialFrontierTraceController as __differentialFrontierTraceController }",
  `  from \"./${TRACE_RUNTIME_FILE}\";`,
  "",
].join("\n");
const TRACE_IMPORT_LINE_COUNT = TRACE_IMPORT.split("\n").length - 1;
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
  const output = options.fullJson ? result : result.frontierPacket;
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
    scenario: context.scenario,
    commandScenarioText: context.commandScenarioText,
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
    const frontierPacket = buildFrontierPacket(evidence, evidencePath, evidenceRoot);
    const retained = Object.freeze({ ...evidence, frontierPacket });
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
    commandScenario: join(evidenceRoot, ".local/cssoccer/oracle/fixture/command-scenario.jsonl"),
  };
  const [stateEvidence, rawEvidence, profileEvidence, scenarioEvidence, commandEvidence] = await Promise.all([
    fileEvidence(paths.nativeState),
    fileEvidence(paths.nativeRaw),
    fileEvidence(paths.nativeProfile),
    fileEvidence(paths.nativeScenario),
    fileEvidence(paths.commandScenario),
  ]);
  verifyArtifact(stateEvidence, stateArtifact, "native state");
  verifyArtifact(rawEvidence, rawArtifact, "native raw");
  verifyArtifact(profileEvidence, profileArtifact, "native profile");
  verifyArtifact(scenarioEvidence, scenarioArtifact, "native scenario");
  if (commandEvidence.sha256 !== native.bindings.inputSha256) {
    throw new DifferentialFrontierError(
      "command-scenario-binding",
      "Bound free-play command scenario does not match the native input identity.",
    );
  }
  const [profile, scenario, commandScenarioText] = await Promise.all([
    readJson(paths.nativeProfile),
    readJson(paths.nativeScenario),
    readFile(paths.commandScenario, "utf8"),
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
    commandScenarioText,
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

async function collectRuntimeSourceFiles(sourceRoot, workspaceRoot, rootNames) {
  const queue = rootNames.map((name) => join(sourceRoot, name));
  const visited = new Set();
  const files = [];
  while (queue.length > 0) {
    const path = resolve(queue.shift());
    if (visited.has(path)) continue;
    if (!path.startsWith(`${resolve(sourceRoot)}${sep}`) || !existsSync(path)) {
      throw new DifferentialFrontierError(
        "runtime-import-boundary",
        `Free-play runtime import is unavailable or outside src/cssoccer: ${path}.`,
      );
    }
    visited.add(path);
    const text = await readFile(path, "utf8");
    files.push(Object.freeze({
      name: basename(path),
      path: relative(workspaceRoot, path),
      text,
    }));
    const pattern = /\b(?:import|export)\s+(?:[^"']*?\s+from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu;
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith(".")) continue;
      const direct = resolve(dirname(path), specifier);
      const imported = existsSync(direct) ? direct : `${direct}.mjs`;
      queue.push(imported);
    }
  }
  return Object.freeze(files.sort((left, right) => left.name.localeCompare(right.name)));
}

async function createDiagnosticRuntime({
  workspaceRoot,
  outputRoot,
  preparedRoot,
  native,
  profile,
  scenario,
  commandScenarioText,
}) {
  const sourceRoot = join(workspaceRoot, "src/cssoccer");
  const sourceFiles = await collectRuntimeSourceFiles(sourceRoot, workspaceRoot, [
    "freePlayEngineIndependence.mjs",
    "freePlayEngine.mjs",
    "freePlayProjection.mjs",
    "freePlayState.mjs",
    "nativeFieldContract.mjs",
    "oracleState.mjs",
  ]);
  if (sourceFiles.length === 0) {
    throw new DifferentialFrontierError("runtime-source-missing", "Browser runtime modules are unavailable.");
  }
  const runtimeFiles = {};
  for (const file of sourceFiles) runtimeFiles[file.path] = sha256(file.text);
  const engineFile = sourceFiles.find(({ name }) => name === "freePlayEngine.mjs");
  if (!engineFile) {
    throw new DifferentialFrontierError("runtime-engine-missing", "Free-play engine source is unavailable.");
  }
  const traceDeclarations = [];
  const diagnosticSources = new Map();
  for (const file of sourceFiles) {
    const declarations = topLevelFunctionDeclarations(file.text).map((declaration) => (
      Object.freeze({ ...declaration, file: file.path })
    ));
    traceDeclarations.push(...declarations);
    diagnosticSources.set(
      file.name,
      createDiagnosticModuleSource(file.text, declarations, { file: file.path }),
    );
  }
  const engineDeclarations = traceDeclarations.filter(({ file }) => file === engineFile.path);
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
      diagnosticSources.get(file.name),
      { flag: "wx" },
    );
  }
  const importModule = async (name) => import(
    `${pathToFileURL(join(diagnosticSourceRoot, name)).href}?snapshot=${runtimeSnapshotSha256}`
  );
  const [
    engineModule,
    stateModule,
    projectionModule,
    contractModule,
    oracleModule,
    independenceModule,
    traceModule,
  ] = await Promise.all([
    importModule("freePlayEngine.mjs"),
    importModule("freePlayState.mjs"),
    importModule("freePlayProjection.mjs"),
    importModule("nativeFieldContract.mjs"),
    importModule("oracleState.mjs"),
    importModule("freePlayEngineIndependence.mjs"),
    importModule(TRACE_RUNTIME_FILE),
  ]);
  const facts = await readJson(join(preparedRoot, "facts", `${native.fixtureId}.json`));
  const scene = await readJson(join(preparedRoot, "scenes", `${native.fixtureId}.json`));
  const selectedCountry = profile.binding?.country ?? profile.control?.country;
  if (typeof selectedCountry !== "string") {
    throw new DifferentialFrontierError("runtime-country-missing", "Native profile has no selected country.");
  }
  const initialState = stateModule.createCssoccerFreePlayState({
    preparedFacts: facts,
    preparedScene: scene,
    selectedCountry,
  });
  const candidateIdentity = await createCandidateIdentity({
    runtimeFiles,
    engineSource: engineFile.text,
    runtimeSnapshotSha256,
    transformSha256: sha256Canonical(Object.fromEntries(
      [...diagnosticSources.entries()].map(([name, source]) => [name, sha256(source)]),
    )),
    traceRuntimeSha256: sha256(traceRuntimeSource),
  });
  const commandScenario = parseCssoccerFreePlayCommandScenario(commandScenarioText, {
    buildSha256: candidateIdentity.buildSha256,
    commandSha256: native.bindings.inputSha256,
    fieldContractSha256: native.bindings.contractSha256,
    profileSha256: native.bindings.profileSha256,
    scenarioSha256: native.bindings.scenarioSha256,
    seed: scenario.fixture.seed.value,
    sourceSha256: candidateIdentity.sourceSha256,
    timestepMilliseconds: Math.round(scenario.fixture.timing.timestepSeconds * 1000),
  });
  const engineIndependence = await independenceModule.qualifyCssoccerFreePlayEngineIndependence({
    freePlayState: initialState,
    scenario: commandScenario,
    candidateIdentity,
    nativeIdentity: {
      sourceSha256: native.bindings.sourceSha256,
      buildSha256: native.bindings.buildSha256,
    },
    cryptoImpl: webcrypto,
  });
  const createDriver = async () => {
    const engine = engineModule.createCssoccerFreePlayEngine({ initialState });
    return createCssoccerFreePlayScenarioAdapter({
      cryptoImpl: webcrypto,
      engine,
      projectSnapshot: (snapshot) => projectionModule.projectCssoccerFreePlaySnapshot({
        snapshot,
        preparedScene: scene,
        fields: contractModule.CSSOCCER_NATIVE_FIELDS,
      }),
      scenario: commandScenario,
    });
  };
  const driver = await createDriver();
  const traceController = traceModule.differentialFrontierTraceController;
  return Object.freeze({
    workspaceRoot,
    sourceFiles: Object.freeze(sourceFiles),
    runtimeFiles: Object.freeze(runtimeFiles),
    runtimeSnapshotSha256,
    engineDeclarations,
    traceDeclarations: Object.freeze(traceDeclarations),
    candidateIdentity,
    engineIndependence,
    driver,
    createDriver,
    configureTrace(config) {
      traceController.configure(config);
    },
    readTrace() {
      return traceController.read();
    },
    describeError(error, coordinate) {
      return describeRuntimeException(error, {
        ...coordinate,
        diagnosticSourceRoot,
        sourceFiles,
      });
    },
    fields: contractModule.CSSOCCER_NATIVE_FIELDS,
    createTick: oracleModule.createCssoccerOracleTick,
    bindings: engineIndependence.bindings,
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

export function createDiagnosticEngineSource(
  source,
  declarations,
  { file = "src/cssoccer/freePlayEngine.mjs" } = {},
) {
  return createDiagnosticModuleSource(source, declarations, { file });
}

export function createDiagnosticModuleSource(
  source,
  declarations,
  { exposeControl = false, file = null } = {},
) {
  const wrapped = declarations.filter(({ name }) => !TRACE_EXCLUDED_FUNCTIONS.has(name));
  if (!exposeControl && wrapped.length === 0) return source;
  const traceFooter = [
    "",
    ...(exposeControl ? [
      "export function configureCssoccerDifferentialFrontierTrace(config) {",
      "  __differentialFrontierTraceController.configure(config);",
      "}",
      "export function readCssoccerDifferentialFrontierTrace() {",
      "  return __differentialFrontierTraceController.read();",
      "}",
    ] : []),
    ...wrapped.map(({ name, line }) => (
      `${name} = __differentialFrontierTraceController.wrap({ file: ${JSON.stringify(file)}, name: ${JSON.stringify(name)}, line: ${line} }, ${name});`
    )),
    "",
  ].join("\n");
  return `${TRACE_IMPORT}${source}${traceFooter}`;
}

function countNewlines(value, end) {
  let count = 0;
  for (let index = 0; index < end; index += 1) {
    if (value.charCodeAt(index) === 10) count += 1;
  }
  return count;
}

export function describeRuntimeException(error, {
  tick,
  phase,
  diagnosticSourceRoot = null,
  sourceFiles = [],
} = {}) {
  const name = typeof error?.name === "string" ? error.name : "Error";
  const message = typeof error?.message === "string" ? error.message : String(error);
  const sourceByName = new Map(sourceFiles.map((file) => [file.name, file]));
  let source = null;
  if (typeof error?.stack === "string") {
    for (const line of error.stack.split(/\r?\n/u)) {
      const match = line.match(
        /\(?((?:file:\/\/)?[^()\s]+?\.mjs)(?:\?[^:\s)]*)?:(\d+):(\d+)\)?/u,
      );
      if (!match) continue;
      let framePath;
      try {
        framePath = match[1].startsWith("file://")
          ? fileURLToPath(match[1])
          : match[1];
      } catch {
        continue;
      }
      const file = sourceByName.get(basename(framePath));
      if (!file) continue;
      const generatedLine = Number.parseInt(match[2], 10);
      const fromDiagnosticCopy = diagnosticSourceRoot !== null
        && resolve(framePath).startsWith(`${resolve(diagnosticSourceRoot)}${sep}`);
      source = Object.freeze({
        file: file.path,
        line: fromDiagnosticCopy
          ? mapDiagnosticSourceLine(file, generatedLine)
          : generatedLine,
        column: Number.parseInt(match[3], 10),
      });
      break;
    }
  }
  return Object.freeze({
    schema: "cssoccer-differential-frontier-runtime-exception@1",
    tick,
    phase,
    phaseOrder: 0,
    name,
    message,
    source,
  });
}

function mapDiagnosticSourceLine(file, generatedLine) {
  return Math.max(1, generatedLine - TRACE_IMPORT_LINE_COUNT);
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
        "src/cssoccer/freePlayEngineIndependence.mjs": runtimeFiles["src/cssoccer/freePlayEngineIndependence.mjs"],
        "src/cssoccer/freePlayEngine.mjs": runtimeFiles["src/cssoccer/freePlayEngine.mjs"],
        "src/cssoccer/freePlayProjection.mjs": runtimeFiles["src/cssoccer/freePlayProjection.mjs"],
        "src/cssoccer/freePlayState.mjs": runtimeFiles["src/cssoccer/freePlayState.mjs"],
      },
      diagnosticTransformSha256: transformSha256,
      diagnosticTraceRuntimeSha256: traceRuntimeSha256,
    }),
    captureAdapterSha256: sha256Canonical({
      schema: "cssoccer-frontier-capture-adapter@1",
      files: {
        "tools/run-differential-frontier.mjs": runnerSha256,
        "tools/support/free-play-scenario-adapter.mjs": sha256(await readFile(
          join(TOOL_ROOT, "support/free-play-scenario-adapter.mjs"),
          "utf8",
        )),
        "src/cssoccer/freePlayProjection.mjs": runtimeFiles["src/cssoccer/freePlayProjection.mjs"],
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
    let runtimeException = null;
    const classifiedMismatches = [];
    for (let tickOffset = 0; tickOffset < header.tickRange.count; tickOffset += 1) {
      const tick = header.tickRange.start + tickOffset;
      const nativeSamples = [];
      for (let index = 0; index < header.fields.length; index += 1) {
        nativeSamples.push(await reader.nextSample());
      }
      let projection;
      try {
        projection = await runtime.driver.stepNext();
        if (projection.tick !== tick || projection.phase !== "post_tick") {
          throw new Error(`Free-play scenario returned non-contiguous projection tick ${projection.tick}.`);
        }
      } catch (error) {
        runtimeException = runtime.describeError(error, { tick, phase: "post_tick" });
        referenceAtMismatch = new Map(nativeSamples.map((sample) => [sample.fieldId, sample]));
        break;
      }
      const candidateSamples = runtime.createTick({
        tick,
        phase: "post_tick",
        fields: runtime.fields,
        values: projection.values,
      });
      diagnosticState = runtime.driver.snapshot().match;
      const nativeById = new Map(nativeSamples.map((sample) => [sample.fieldId, sample]));
      const candidateById = new Map(candidateSamples.map((sample) => [sample.fieldId, sample]));
      const failures = selectedIds
        .filter((fieldId) => !samplesEqual(nativeById.get(fieldId), candidateById.get(fieldId)))
        .map((fieldId) => mismatchReport(
          nativeById.get(fieldId),
          candidateById.get(fieldId),
          header.fields[fieldOrder.get(fieldId)],
        ));
      const activeFailures = [];
      for (const failure of failures) {
        const classification = classifyCssoccerFreePlayComparisonField(
          projection.comparisonBoundary,
          failure.fieldId,
        );
        if (classification === null) {
          activeFailures.push(failure);
        } else {
          classifiedMismatches.push(Object.freeze({
            tick,
            phase: "post_tick",
            ...failure,
            classification,
          }));
        }
      }
      if (activeFailures.length > 0) {
        [mismatch] = activeFailures;
        sameTickMismatches = activeFailures;
        referenceAtMismatch = nativeById;
        candidateAtMismatch = candidateById;
        break;
      }
      previousReference = nativeById;
      previousCandidate = candidateById;
      previousDiagnosticState = diagnosticState;
    }
    if (runtimeException !== null) {
      return Object.freeze({
        header,
        fieldOrder,
        selectedIds: Object.freeze(selectedIds),
        exact: null,
        runtimeException,
        sameTickMismatches: Object.freeze([]),
        transitionClues: Object.freeze([]),
        previousReference,
        previousCandidate,
        referenceAtMismatch,
        candidateAtMismatch: null,
        previousDiagnosticState,
        diagnosticState: null,
        classifiedMismatches: Object.freeze(classifiedMismatches),
      });
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
      runtimeException: null,
      sameTickMismatches: Object.freeze(sameTickMismatches),
      transitionClues,
      previousReference,
      previousCandidate,
      referenceAtMismatch,
      candidateAtMismatch,
      previousDiagnosticState,
      diagnosticState,
      classifiedMismatches: Object.freeze(classifiedMismatches),
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
  if (scan.runtimeException !== null) {
    return buildRuntimeExceptionEvidence({
      evidenceRoot,
      outputRoot,
      context,
      runtime,
      scan,
      started,
    });
  }
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
  const traceSubject = selectFrontierTraceSubject(scan, context.scenario);
  const callTrace = await traceFrontierCallPath({
    runtime,
    scan,
    traceSubject: traceSubject === null ? null : {
      ...traceSubject,
      nativePlayerNumber: traceSubject.nativePlayerNumber
        ?? nativePlayerForEntity(traceSubject.entityId, context.scenario),
    },
  });
  const nativeFiles = internal.nativeSourceRoot
    ? await loadNativeSourceFiles(internal.nativeSourceRoot, evidenceRoot)
    : [];
  const compoundTransition = buildCompoundTransition({
    exact: scan.exact,
    sameTickMismatches: scan.sameTickMismatches,
    transitionClues: scan.transitionClues,
    nativeFiles,
    declarations: runtime.traceDeclarations,
    callTrace,
  });
  const additionalSymbols = internal.nativePlayerChanges.map(({ sourceMember }) => sourceMember);
  const preferredNativeValueSymbols = scan.exact === null
    ? []
    : nativeValueSymbols(runtime.sourceFiles, scan.exact);
  const nativeSites = scan.exact === null ? [] : findNativeWriteSites(nativeFiles, {
    sourceOwner: scan.exact.sourceOwner,
    additionalSymbols,
    preferredValueSymbols: preferredNativeValueSymbols,
  });
  const nativeSymbolTable = scan.exact === null
    ? []
    : buildNativeSymbolTable(nativeFiles, runtime.sourceFiles);
  const symbolicTransitions = scan.exact === null
    ? []
    : resolveNativeTransitionSymbols(internal.nativePlayerChanges, nativeSymbolTable);
  const transitionSymbols = symbolicTransitions.map(({ symbol }) => symbol);
  const nativeWriter = nativeSites.find(({ write, matchedPreferredValue }) => (
    write && matchedPreferredValue
  )) ?? nativeSites.find(({ write }) => write) ?? null;
  const compiledPath = await resolveNumericCompiledPath({
    exact: scan.exact,
    nativeWriter,
    bindings: context.native.bindings,
    evidenceRoot,
    outputRoot,
  });
  const nativeCallerBranches = nativeWriter?.function
    ? findNativeCallerBranches(nativeFiles, {
        callee: nativeWriter.function,
        transitionSymbols,
        runtimeFiles: runtime.sourceFiles,
      })
    : [];
  const nativeBranchIdentity = await resolveNativeBranchIdentity({
    branches: nativeCallerBranches,
    nativeFiles,
    exact: scan.exact,
    bindings: context.native.bindings,
    evidenceRoot,
    outputRoot,
  });
  const selectedNativeBranch = nativeBranchIdentity.branch;
  const browserMappingCandidates = findBrowserMappingCandidates(runtime.sourceFiles, {
    nativeBranch: selectedNativeBranch,
    transitionSymbols,
    callTrace,
  });
  const negativePathCandidates = rankRelevantNegativePathTrace({
    trace: callTrace,
    declarations: runtime.traceDeclarations,
    exact: scan.exact,
  });
  const negativePathFocus = deriveNegativePathFocus({
    negativePath: negativePathCandidates[0] ?? null,
    nativeBranch: selectedNativeBranch,
    nativeBranchIdentity,
  });
  const nativeBranchMismatchFocus = deriveNativeBranchMismatchFocus({
    negativePath: negativePathCandidates[0] ?? null,
    nativeBranch: selectedNativeBranch,
    nativeBranchIdentity,
    nativeFiles,
    playerControl: internal.player?.control ?? null,
  });
  const symbolicRouting = buildSymbolicRouting({
    nativeWriter,
    symbolicTransitions,
    nativeCallerBranches,
    nativeBranchIdentity,
    browserMappingCandidates,
    negativePathCandidates,
    negativePathFocus,
    nativeBranchMismatchFocus,
  });
  const nativeFunctions = [...new Set(nativeSites.map((site) => site.function).filter(Boolean))];
  const runtimeCandidates = scan.exact === null
    ? []
    : mergeRuntimeCandidates(
        directFreePlayProjectionCandidate(runtime.sourceFiles, scan.exact),
        findRuntimeProducerCandidates(runtime.sourceFiles, {
          selector: scan.exact.selector,
          sourceOwner: scan.exact.sourceOwner,
          nativeFunctions,
          internalSymbols: additionalSymbols,
        }),
      );
  const dynamicCandidates = scan.exact === null ? [] : rankDynamicProducerTrace({
    trace: callTrace,
    declarations: runtime.traceDeclarations,
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
      runtimeException: null,
      sameTickMismatchCount: scan.sameTickMismatches.length,
      sameTickMismatches: scan.sameTickMismatches.slice(0, 16),
      classifiedMismatchCount: scan.classifiedMismatches.length,
      classifiedMismatches: scan.classifiedMismatches,
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
    symbolicRouting,
    compoundTransition,
    compiledPath,
    nextAction: nextAction({
      exact: scan.exact,
      producer,
      symbolicRouting,
      compoundTransition,
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
    symbolicRouting,
    compoundTransition,
    compiledPath,
  }).slice(0, 16);
  return Object.freeze(evidence);
}

async function buildInternalContext({ evidenceRoot, context, scan, nativeSourceRoot }) {
  const empty = {
    status: scan.exact === null ? "not-required" : "not-available",
    nativeSourceRoot: null,
    player: null,
    browserPlayerBefore: null,
    browserPlayerAfter: null,
    nativePlayerChanges: [],
    browserPlayerChanges: [],
    nativeBrowserDifferences: [],
  };
  const entityId = scan.exact?.selector?.entityId;
  const compiledProfilePath = join(
    evidenceRoot,
    ".local/cssoccer/compiled-path-inspector/current-profile.json",
  );
  if (!existsSync(compiledProfilePath)) return Object.freeze(empty);
  const compiledProfile = await readJson(compiledProfilePath);
  verifyCompiledProfile(compiledProfile, context.native.bindings, context.scenario.sourceRevision);
  const inferredSourceRoot = nativeSourceRoot
    ? resolve(nativeSourceRoot)
    : inferNativeSourceRoot(compiledProfile, evidenceRoot);
  if (!entityId) {
    return Object.freeze({
      ...empty,
      nativeSourceRoot: inferredSourceRoot,
    });
  }
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
  const runtimeEntityId = runtimeEntityForNativeSlot(
    scan.diagnosticState ?? scan.previousDiagnosticState,
    nativePlayerNumber,
  ) ?? entityId;
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
  const candidateCurrent = candidatePlayerContext(scan.diagnosticState, runtimeEntityId);
  const candidatePrevious = candidatePlayerContext(scan.previousDiagnosticState, runtimeEntityId);
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
  return Object.freeze({
    status: "available",
    nativeSourceRoot: inferredSourceRoot,
    player: {
      entityId,
      runtimeEntityId,
      nativePlayerNumber,
      control: nativeCurrent.control,
      shirtRange: nativeCurrent.shirtRange,
      structSha256,
      teamsAddress: `${teams.segment}:0x${teams.offset.toString(16).padStart(8, "0")}`,
    },
    browserPlayerBefore: candidatePrevious,
    browserPlayerAfter: candidateCurrent,
    nativePlayerChanges: Object.freeze(nativePlayerChanges),
    browserPlayerChanges,
    nativeBrowserDifferences: Object.freeze(nativeBrowserDifferences),
  });
}

export function selectFrontierTraceSubject(scan, scenario = null) {
  const exactEntity = scan?.exact?.selector?.entityId ?? null;
  if (exactEntity !== null) {
    const nativePlayerNumber = scenario === null
      ? null
      : nativePlayerForEntity(exactEntity, scenario);
    const runtimeEntityId = nativePlayerNumber === null
      ? null
      : runtimeEntityForNativeSlot(
          scan.diagnosticState ?? scan.previousDiagnosticState,
          nativePlayerNumber,
        );
    return Object.freeze({
      entityId: runtimeEntityId ?? exactEntity,
      nativePlayerNumber,
      reason: runtimeEntityId !== null && runtimeEntityId !== exactEntity
        ? "exact-native-slot-entity"
        : "exact-entity",
    });
  }
  for (const mismatch of scan?.sameTickMismatches ?? []) {
    const match = mismatch.fieldId?.match(/^players\.([a-z0-9-]+)\./u);
    if (!match) continue;
    return Object.freeze({
      entityId: match[1],
      nativePlayerNumber: null,
      reason: "same-tick-player-transition",
    });
  }
  const previousPlayers = scan?.previousDiagnosticState?.openingLivePlayers?.players
    ?? scan?.previousDiagnosticState?.players;
  const currentPlayers = scan?.diagnosticState?.openingLivePlayers?.players
    ?? scan?.diagnosticState?.players;
  if (Array.isArray(previousPlayers) && Array.isArray(currentPlayers)) {
    const previousById = new Map(previousPlayers.map((player) => [player.id, player]));
    const changedBallState = currentPlayers.find((player) => {
      const previous = previousById.get(player.id);
      return previous !== undefined
        && Number.isSafeInteger(player.ballState)
        && player.ballState !== previous.ballState;
    });
    if (changedBallState !== undefined) {
      return Object.freeze({
        entityId: changedBallState.id,
        nativePlayerNumber: changedBallState.nativePlayerNumber,
        reason: "global-frontier-player-transition",
      });
    }
  }
  for (const state of [scan?.previousDiagnosticState, scan?.diagnosticState]) {
    const owner = state?.possession?.owner;
    const players = state?.openingLivePlayers?.players ?? state?.players;
    if (!Number.isSafeInteger(owner) || owner <= 0 || !Array.isArray(players)) continue;
    const player = players.find((candidate) => (
      candidate?.nativePlayerNumber === owner && typeof candidate?.id === "string"
    ));
    if (!player) continue;
    return Object.freeze({
      entityId: player.id,
      nativePlayerNumber: owner,
      reason: "preceding-possession-owner",
    });
  }
  return null;
}

export async function resolveNumericCompiledPath({
  exact,
  nativeWriter,
  bindings,
  evidenceRoot,
  outputRoot,
  runCompiledPathCheck = runCurrentCompiledPathCheck,
}) {
  if (exact?.route?.id !== "numeric-producer" || !nativeWriter?.function) return null;
  const symbolNames = [...new Set(nativeWriter.matchedSymbols ?? [])]
    .filter((name) => typeof name === "string" && /^[A-Za-z_?$@][A-Za-z0-9_?$@.]*$/u.test(name));
  if (symbolNames.length === 0) return null;
  const objectName = basename(nativeWriter.file).replace(/\.(?:c|cpp)$/iu, "");
  const symbols = symbolNames.map((name) => `${name}:${exact.reference.valueType}`);
  try {
    const action = await runCompiledPathCheck({
      workspaceRoot: evidenceRoot,
      workRoot: join(outputRoot, "numeric-compiled-path"),
      functionName: nativeWriter.function,
      objectName,
      symbols,
      exactOverride: exact,
      exactOverrideBindings: bindings,
    });
    if (!compiledActionMatchesExact(action, exact)) {
      return Object.freeze({
        status: "exact-mismatch",
        function: nativeWriter.function,
        object: objectName,
        symbols: Object.freeze(symbolNames),
      });
    }
    return Object.freeze({
      status: "bound",
      function: nativeWriter.function,
      object: objectName,
      symbols: Object.freeze(action.symbols.map((symbol) => Object.freeze({
        name: symbol.name,
        valueType: symbol.valueType,
        runtime: symbol.runtime,
        references: symbol.references,
        nextF32Stores: symbol.nextF32Stores,
      }))),
      authority: action.runtime.authority,
      parityAuthority: action.runtime.parityAuthority,
      evidencePath: action.evidencePath,
    });
  } catch (error) {
    return Object.freeze({
      status: "gap",
      function: nativeWriter.function,
      object: objectName,
      symbols: Object.freeze(symbolNames),
      code: typeof error?.code === "string" ? error.code : "numeric-compiled-path-failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function traceFrontierCallPath({ runtime, scan, traceSubject }) {
  const exact = scan.exact;
  if (exact === null || traceSubject === null) {
    return Object.freeze({
      schema: "cssoccer-differential-frontier-call-trace@1",
      status: "not-applicable",
      entityId: null,
      nativePlayerNumber: null,
      subjectReason: null,
      truncated: false,
      records: Object.freeze([]),
    });
  }
  const driver = await runtime.createDriver();
  let captured = null;
  try {
    for (let tick = 0; tick <= exact.tick; tick += 1) {
      if (tick === exact.tick) {
        runtime.configureTrace({
          entityId: traceSubject.entityId,
          nativePlayerNumber: traceSubject.nativePlayerNumber,
        });
      }
      const projection = await driver.stepNext();
      if (projection.tick !== tick || projection.phase !== exact.phase) {
        throw new Error("Free-play trace scenario returned a non-contiguous projection.");
      }
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
    subjectReason: traceSubject.reason,
    records: Object.freeze(captured.records.map(Object.freeze)),
  });
}

async function traceRuntimeException({ runtime, failure }) {
  const driver = await runtime.createDriver();
  let captured = null;
  let replayFailure = null;
  try {
    for (let tick = 0; tick <= failure.tick; tick += 1) {
      if (tick === failure.tick) runtime.configureTrace({ recordFailures: true });
      try {
        const projection = await driver.stepNext();
        if (projection.tick !== tick || projection.phase !== failure.phase) {
          throw new Error("Free-play exception trace returned a non-contiguous projection.");
        }
      } catch (error) {
        replayFailure = runtime.describeError(error, { tick, phase: failure.phase });
        captured = runtime.readTrace();
        break;
      }
    }
  } finally {
    runtime.configureTrace(null);
  }
  if (replayFailure === null || captured === null) {
    throw new DifferentialFrontierError(
      "runtime-exception-not-reproduced",
      "The diagnostic replay did not reproduce the browser runtime exception.",
    );
  }
  if (
    replayFailure.tick !== failure.tick
    || replayFailure.name !== failure.name
    || replayFailure.message !== failure.message
  ) {
    throw new DifferentialFrontierError(
      "runtime-exception-replay-mismatch",
      "The traced replay reached a different browser runtime exception.",
      { expected: failure, actual: replayFailure },
    );
  }
  return Object.freeze({
    ...captured,
    subjectReason: "runtime-exception",
    failure: replayFailure,
    records: Object.freeze(captured.records.map(Object.freeze)),
  });
}

export function rankRuntimeExceptionTrace({
  trace,
  declarations,
  runtimeException,
  limit = 8,
}) {
  if (trace?.status !== "captured" || !Array.isArray(trace.records)) {
    return Object.freeze([]);
  }
  const declarationByKey = new Map(declarations.map((entry) => [
    `${entry.file ?? ""}\u0000${entry.name}`,
    entry,
  ]));
  const declarationByName = new Map(declarations.map((entry) => [entry.name, entry]));
  const failed = trace.records.filter((record) => (
    record.error !== null && record.error !== undefined
  ));
  const recordById = new Map(failed.map((record) => [record.callId, record]));
  const candidates = failed.map((record) => {
    const declaration = declarationByKey.get(
      `${record.file ?? ""}\u0000${record.function}`,
    ) ?? declarationByName.get(record.function) ?? null;
    const declarationLines = declaration?.source.split(/\r?\n/u).length ?? 0;
    const sourceMatched = runtimeException.source !== null
      && runtimeException.source.file === (record.file ?? declaration?.file)
      && declaration !== null
      && runtimeException.source.line >= declaration.line
      && runtimeException.source.line < declaration.line + declarationLines;
    const callChain = [];
    let parentId = record.parentCallId;
    while (parentId !== null && callChain.length < 12) {
      const parent = recordById.get(parentId);
      if (!parent) break;
      callChain.push(Object.freeze({
        file: parent.file,
        function: parent.function,
        line: parent.line,
        callDepth: parent.callDepth,
      }));
      parentId = parent.parentCallId;
    }
    return Object.freeze({
      file: record.file ?? declaration?.file ?? runtimeException.source?.file ?? null,
      function: record.function,
      line: sourceMatched ? runtimeException.source.line : record.line,
      score: (sourceMatched ? 1_000 : 0) + Math.min(record.callDepth, 32) * 20,
      callDepth: record.callDepth,
      sourceMatched,
      error: record.error,
      argumentFacts: compactExceptionArgumentFacts(record.arguments),
      callChain: Object.freeze(callChain),
    });
  });
  return Object.freeze(candidates
    .sort((left, right) => right.score - left.score
      || right.callDepth - left.callDepth
      || left.function.localeCompare(right.function))
    .slice(0, limit));
}

function compactExceptionArgumentFacts(summary) {
  const flat = flattenScalars(unwrapBoundedResult(summary), {
    maxDepth: 7,
    maxEntries: 300,
  });
  return Object.freeze([...flat.entries()]
    .filter(([path]) => /(?:^|\.)(?:id|nativePlayer|nativePlayerNumber|action|owner|tick|inAir)$/u.test(path))
    .slice(0, 16)
    .map(([path, value]) => Object.freeze({ path, value })));
}

export function runtimeExceptionNextAction({
  runtimeException,
  producer,
  duplicate,
  evidenceRoot,
  outputRoot,
}) {
  if (producer.status !== "surfaced") {
    return Object.freeze({
      kind: "runtime-exception-routing-gap",
      file: runtimeException.source?.file ?? null,
      function: null,
      line: runtimeException.source?.line ?? null,
      question: `The browser threw ${runtimeException.name}: ${runtimeException.message} before parity comparison, but the executed producer could not be bound.`,
      evidencePath: relativeOrAbsolute(evidenceRoot, join(outputRoot, "current.json")),
      rerunCommand: "node tools/run-differential-frontier.mjs --continue",
      doNotRerunBeforeRuntimeChanges: true,
      note: "Repair the exception-routing seam before inspecting any later parity symptom.",
    });
  }
  const selected = producer.alternatives[0];
  return Object.freeze({
    kind: "repair-runtime-exception",
    file: producer.candidateFile,
    function: producer.candidateFunction,
    line: producer.candidateLine,
    question: `Repair ${producer.candidateFunction}: it threw ${runtimeException.name} before tick ${String(runtimeException.tick)} could be compared (${runtimeException.message}).`,
    exception: runtimeException,
    argumentFacts: selected?.argumentFacts ?? [],
    callChain: selected?.callChain ?? [],
    rerunCommand: "node tools/run-differential-frontier.mjs --continue",
    doNotRerunBeforeRuntimeChanges: duplicate,
    note: "This is an executed runtime blocker, not parity data. Rerun only after the named runtime path changes.",
  });
}

async function buildRuntimeExceptionEvidence({
  evidenceRoot,
  outputRoot,
  context,
  runtime,
  scan,
  started,
}) {
  const previousPath = join(outputRoot, "current.json");
  const previous = existsSync(previousPath) ? await readJson(previousPath) : null;
  const callTrace = await traceRuntimeException({
    runtime,
    failure: scan.runtimeException,
  });
  const candidates = rankRuntimeExceptionTrace({
    trace: callTrace,
    declarations: runtime.traceDeclarations,
    runtimeException: scan.runtimeException,
  });
  const selected = candidates[0] ?? null;
  const producer = Object.freeze({
    status: selected === null ? "routing-gap" : "surfaced",
    candidateFile: selected?.file ?? null,
    candidateFunction: selected?.function ?? null,
    candidateLine: selected?.line ?? null,
    confidence: selected === null ? "none" : "diagnostic-exception-high",
    nativeFunction: null,
    alternatives: candidates,
    diagnosticOnly: true,
  });
  const previousException = previous?.current?.runtimeException ?? null;
  const sameFailure = previousException?.tick === scan.runtimeException.tick
    && previousException?.phase === scan.runtimeException.phase
    && previousException?.name === scan.runtimeException.name
    && previousException?.message === scan.runtimeException.message;
  const duplicate = sameFailure
    && previous?.bindings?.runtimeSnapshotSha256 === runtime.runtimeSnapshotSha256;
  const symbolicRouting = emptySymbolicRouting();
  const evidence = {
    schema: DIFFERENTIAL_FRONTIER_EVIDENCE_SCHEMA,
    status: "blocked",
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
      exact: context.retained.exact,
      movement: "blocked-before-comparison",
    },
    current: {
      exact: null,
      exactContext: null,
      runtimeException: scan.runtimeException,
      sameTickMismatchCount: 0,
      sameTickMismatches: [],
      classifiedMismatchCount: scan.classifiedMismatches?.length ?? 0,
      classifiedMismatches: scan.classifiedMismatches ?? [],
      transitionClues: [],
      movementFromPreviousDiagnostic: sameFailure ? "same-runtime-exception" : "runtime-exception",
      duplicateOfPreviousRuntime: duplicate,
    },
    internal: {
      status: "not-applicable",
      nativeSourceRoot: null,
      player: null,
      nativePlayerChanges: [],
      browserPlayerChanges: [],
      nativeBrowserDifferences: [],
    },
    producer: {
      ...producer,
      native: {
        sourceOwner: null,
        preferredValueSymbols: [],
        writeSites: [],
      },
      browser: {
        callTrace,
        dynamicCandidates: candidates,
        candidates,
      },
    },
    symbolicRouting,
    compoundTransition: null,
    nextAction: runtimeExceptionNextAction({
      runtimeException: scan.runtimeException,
      producer,
      duplicate,
      evidenceRoot,
      outputRoot,
    }),
  };
  evidence.actionId = sha256Canonical({
    schema: DIFFERENTIAL_FRONTIER_EVIDENCE_SCHEMA,
    bindings: evidence.bindings,
    runtimeException: scan.runtimeException,
    producer: evidence.producer,
  }).slice(0, 16);
  return Object.freeze(evidence);
}

function emptySymbolicRouting() {
  return Object.freeze({
    status: "not-applicable",
    transitions: Object.freeze([]),
    nativeWriter: null,
    nativeCallChain: null,
    nativeBranchIdentity: Object.freeze({
      status: "not-applicable",
      branch: null,
      discriminator: null,
      candidates: Object.freeze([]),
      failures: Object.freeze([]),
    }),
    nativeAlternatives: Object.freeze([]),
    negativePath: null,
    negativePathFocus: null,
    nativeBranchMismatchFocus: null,
    negativePathAlternatives: Object.freeze([]),
    browserMapping: null,
    staticBrowserMapping: null,
    browserAlternatives: Object.freeze([]),
    diagnosticOnly: true,
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

export async function resolveNativeBranchIdentity({
  branches,
  nativeFiles,
  exact,
  bindings,
  evidenceRoot,
  outputRoot,
  runCompiledPathCheck = runCurrentCompiledPathCheck,
}) {
  const candidates = uniqueNativeBranchFunctions(branches);
  if (candidates.length === 0) {
    return Object.freeze({
      status: "not-available",
      branch: null,
      discriminator: null,
      candidates: Object.freeze([]),
      failures: Object.freeze([]),
    });
  }
  if (candidates.length === 1 && branches.length === 1) {
    return Object.freeze({
      status: "static-unique",
      branch: candidates[0],
      discriminator: null,
      candidates: Object.freeze([compactNativeBranchCandidate(candidates[0])]),
      failures: Object.freeze([]),
    });
  }
  const discriminators = findNativeBranchDiscriminators(nativeFiles, { branches: candidates });
  const failures = [];
  for (const discriminator of discriminators) {
    const observations = [];
    let failed = false;
    for (const branch of candidates) {
      const objectName = basename(branch.file).replace(/\.(?:c|cpp)$/iu, "");
      try {
        const action = await runCompiledPathCheck({
          workspaceRoot: evidenceRoot,
          workRoot: join(outputRoot, "native-branch-identity"),
          functionName: branch.function,
          objectName,
          symbols: [discriminator.symbol],
          exactOverride: exact,
          exactOverrideBindings: bindings,
        });
        if (!compiledActionMatchesExact(action, exact)) {
          failures.push(Object.freeze({
            code: "native-branch-exact-mismatch",
            function: branch.function,
            symbol: discriminator.symbol,
          }));
          failed = true;
          break;
        }
        const symbol = action.symbols.find(({ name }) => name === discriminator.symbol);
        const expectedValues = [...new Set(
          symbol?.constantWrites?.map(({ value }) => value) ?? [],
        )];
        if (expectedValues.length !== 1 || symbol?.runtime == null) {
          failures.push(Object.freeze({
            code: "native-branch-discriminator-unusable",
            function: branch.function,
            symbol: discriminator.symbol,
            expectedValues,
          }));
          failed = true;
          break;
        }
        observations.push(Object.freeze({
          ...compactNativeBranchCandidate(branch),
          expectedValue: expectedValues[0],
          runtimeValue: symbol.runtime.value,
          valueType: symbol.valueType,
          numericBits: symbol.runtime.numericBits,
          matched: Object.is(expectedValues[0], symbol.runtime.value),
          evidencePath: action.evidencePath,
          authority: action.runtime.authority,
          parityAuthority: action.runtime.parityAuthority,
        }));
      } catch (error) {
        failures.push(Object.freeze({
          code: typeof error?.code === "string" ? error.code : "native-branch-check-failed",
          function: branch.function,
          symbol: discriminator.symbol,
          message: error instanceof Error ? error.message : String(error),
        }));
        failed = true;
        break;
      }
    }
    if (failed) continue;
    const runtimeValues = new Set(observations.map(({ runtimeValue }) => runtimeValue));
    const expectedValues = new Set(observations.map(({ expectedValue }) => expectedValue));
    const matched = observations.filter(({ matched: value }) => value);
    if (
      observations.length !== candidates.length
      || runtimeValues.size !== 1
      || expectedValues.size !== candidates.length
      || matched.length !== 1
    ) {
      failures.push(Object.freeze({
        code: "native-branch-discriminator-ambiguous",
        symbol: discriminator.symbol,
        observations: Object.freeze(observations),
      }));
      continue;
    }
    const selected = candidates.find(({ file, function: name }) => (
      file === matched[0].file && name === matched[0].function
    ));
    return Object.freeze({
      status: "bound",
      branch: selected,
      discriminator: Object.freeze({
        symbol: discriminator.symbol,
        value: matched[0].runtimeValue,
        valueType: matched[0].valueType,
        numericBits: matched[0].numericBits,
        authority: matched[0].authority,
        parityAuthority: matched[0].parityAuthority,
      }),
      candidates: Object.freeze(observations),
      failures: Object.freeze(failures),
    });
  }
  return Object.freeze({
    status: "ambiguous",
    branch: null,
    discriminator: null,
    candidates: Object.freeze(candidates.map(compactNativeBranchCandidate)),
    failures: Object.freeze(failures),
  });
}

function uniqueNativeBranchFunctions(branches) {
  const output = [];
  const seen = new Set();
  for (const branch of branches) {
    const key = `${branch.file}\u0000${branch.function}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(branch);
  }
  return output;
}

function compactNativeBranchCandidate(branch) {
  return Object.freeze({
    file: branch.file,
    function: branch.function,
    line: branch.line,
    caseValue: branch.caseValue,
    matchedTransitionSymbols: branch.matchedTransitionSymbols,
  });
}

function compiledActionMatchesExact(action, exact) {
  return action?.status === "complete"
    && action.exact?.activeTick === exact?.tick
    && action.exact?.phase === exact?.phase
    && action.exact?.phaseOrder === exact?.phaseOrder
    && action.exact?.field === exact?.fieldId
    && action.exact?.reference?.numericBits === exact?.reference?.numericBits
    && action.exact?.candidate?.numericBits === exact?.candidate?.numericBits;
}

export function rankDynamicProducerTrace({ trace, declarations, exact, limit = 8 }) {
  if (trace?.status !== "captured" || !Array.isArray(trace.records)) {
    return Object.freeze([]);
  }
  const declarationByName = new Map(declarations.map((entry) => [entry.name, entry]));
  const declarationByFileAndName = new Map(declarations.map((entry) => [
    `${entry.file ?? ""}\u0000${entry.name}`,
    entry,
  ]));
  const paths = selectorSnapshotPaths(exact.selector);
  const candidateValue = exact.candidate.value;
  const byFunction = new Map();
  for (const record of trace.records) {
    const declaration = declarationByFileAndName.get(
      `${record.file ?? ""}\u0000${record.function}`,
    ) ?? declarationByName.get(record.function);
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
    if (sourceFocus.qualifiedWrite) score += 120;
    else if (sourceFocus.writes) score += 65;
    else if (sourceFocus.mentions) score += 18;
    if (after.found && Object.is(after.value, candidateValue)) score += 30;
    if (before.found && after.found && !Object.is(before.value, after.value)) score += 24;
    score += Math.min(record.callDepth, 8) * (sourceFocus.qualifiedWrite ? 43 : 3);
    const candidate = Object.freeze({
      file: record.file ?? declaration.file ?? "src/cssoccer/freePlayEngine.mjs",
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
      qualifiedFieldWrite: sourceFocus.qualifiedWrite,
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

export function rankRelevantNegativePathTrace({ trace, declarations, exact, limit = 8 }) {
  if (exact?.route?.id === "numeric-producer") return Object.freeze([]);
  return rankNegativePathTrace({ trace, declarations, limit });
}

export function rankNegativePathTrace({ trace, declarations, limit = 8 }) {
  if (trace?.status !== "captured" || !Array.isArray(trace.records)) {
    return Object.freeze([]);
  }
  const declarationByName = new Map(declarations.map((entry) => [entry.name, entry]));
  const declarationByFileAndName = new Map(declarations.map((entry) => [
    `${entry.file ?? ""}\u0000${entry.name}`,
    entry,
  ]));
  const candidates = [];
  for (const record of trace.records) {
    const signal = negativeResultSignal(record);
    if (signal === null) continue;
    const declaration = declarationByFileAndName.get(
      `${record.file ?? ""}\u0000${record.function}`,
    ) ?? declarationByName.get(record.function) ?? null;
    let score = signal.score;
    if (/resolve|decid|select|qualif|valid|pass|candidate/iu.test(record.function)) score += 48;
    if (record.file && record.file !== "src/cssoccer/freePlayEngine.mjs") score += 36;
    if (record.input?.depth === 0) score += 24;
    else if (Number.isSafeInteger(record.input?.depth)) score += Math.max(4, 20 - record.input.depth * 4);
    score += Math.min(record.callDepth ?? 0, 8) * 4;
    if (score < 150) continue;
    candidates.push(Object.freeze({
      file: record.file ?? declaration?.file ?? "src/cssoccer/freePlayEngine.mjs",
      function: record.function,
      line: record.line,
      score,
      callId: record.callId ?? null,
      parentCallId: record.parentCallId ?? null,
      callDepth: record.callDepth,
      rejectionKind: signal.kind,
      rejectionReason: signal.reason,
      result: record.result,
      error: record.error ?? null,
      arguments: record.arguments ?? null,
      sourceBranches: declaration === null
        ? Object.freeze([])
        : negativeBranchSites(declaration, signal),
      supportingCalls: negativeSupportingCalls(trace.records, record),
      ancestorCalls: negativeAncestorCalls(trace.records, record),
    }));
  }
  return Object.freeze(candidates
    .sort((left, right) => right.score - left.score
      || right.callDepth - left.callDepth
      || (right.callId ?? 0) - (left.callId ?? 0))
    .slice(0, limit));
}

export function deriveNegativePathFocus({ negativePath, nativeBranch, nativeBranchIdentity }) {
  if (
    negativePath === null
    || !Number.isSafeInteger(nativeBranch?.caseValue)
    || !["bound", "static-unique"].includes(nativeBranchIdentity?.status)
    || !nativeBranchMatchesNegativePath(nativeBranch, negativePath)
  ) {
    return null;
  }
  const result = unwrapBoundedResult(negativePath.result);
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  const observed = candidates
    .filter(({ nativePlayer, passType }) => (
      Number.isSafeInteger(nativePlayer) && Number.isSafeInteger(passType)
    ))
    .map(({ nativePlayer, passType }) => ({ nativePlayer, passType }));
  if (
    observed.length === 0
    || observed.some(({ passType }) => passType === nativeBranch.caseValue)
  ) {
    return null;
  }
  const observedTypes = new Set(observed.map(({ passType }) => passType));
  let producer = null;
  for (const call of negativePath.supportingCalls) {
    if (!/pass.*type|type.*pass/iu.test(call.function)) continue;
    const evaluations = call.evaluations ?? [call];
    const evaluation = evaluations.find(({ result: value }) => (
      Number.isSafeInteger(value) && observedTypes.has(value)
    ));
    if (evaluation === undefined) continue;
    producer = { ...call, ...evaluation };
    break;
  }
  if (producer === null) return null;
  return Object.freeze({
    kind: "native-switch-value-mismatch",
    expectedSwitchExpression: nativeBranch.switchExpression,
    expectedValue: nativeBranch.caseValue,
    expectedSymbols: nativeBranch.matchedTransitionSymbols,
    observedCandidates: Object.freeze(observed.map(Object.freeze)),
    producer: Object.freeze({
      file: producer.file,
      function: producer.function,
      line: producer.line,
      facts: producer.facts,
      result: producer.result,
    }),
  });
}

export function deriveNativeBranchMismatchFocus({
  negativePath,
  nativeBranch,
  nativeBranchIdentity,
  nativeFiles,
  playerControl = null,
}) {
  if (
    negativePath === null
    || nativeBranch === null
    || !["bound", "static-unique"].includes(nativeBranchIdentity?.status)
    || nativeBranchMatchesNegativePath(nativeBranch, negativePath)
  ) {
    return null;
  }
  const family = nativeBranchFamily(nativeBranch.function);
  if (family === null) return null;
  const guards = findNativeGuardedCallSites(nativeFiles, {
    callee: nativeBranch.function,
    playerControl,
  });
  const guard = guards[0] ?? null;
  const missingDecisionFunction = guard?.conditionCalls.find((name) => (
    nativeFamilyAliases(family).some((alias) => name.toLowerCase().includes(alias))
  )) ?? null;
  const ancestors = negativePath.ancestorCalls ?? [];
  const browserOwner = ancestors.find(({ file }) => (
    file !== null && file !== negativePath.file
  )) ?? ancestors[0] ?? {
    file: negativePath.file,
    function: negativePath.function,
    line: negativePath.line,
  };
  return Object.freeze({
    kind: "native-browser-decision-family-mismatch",
    nativeFamily: family,
    nativeFunction: nativeBranch.function,
    nativeFile: nativeBranch.file,
    nativeLine: nativeBranch.line,
    nativeCaseValue: nativeBranch.caseValue,
    branchIdentity: nativeBranchIdentity.discriminator,
    missingDecisionFunction,
    nativeGuard: guard,
    browserExecutedFunction: negativePath.function,
    browserExecutedFile: negativePath.file,
    browserOwner: Object.freeze({
      file: browserOwner.file,
      function: browserOwner.function,
      line: browserOwner.line,
    }),
  });
}

function nativeBranchMatchesNegativePath(nativeBranch, negativePath) {
  const family = nativeBranchFamily(nativeBranch.function);
  if (!family) return true;
  const aliases = nativeFamilyAliases(family);
  const functions = [
    negativePath.function,
    ...(negativePath.supportingCalls ?? []).flatMap((call) => [
      call.function,
      ...(call.evaluations ?? []).map(() => call.function),
    ]),
  ].filter(Boolean).join(" ").toLowerCase();
  return aliases.some((alias) => functions.includes(alias));
}

function nativeBranchFamily(functionName) {
  return functionName
    ?.replace(/^(?:make|init|start|set)_/u, "")
    .split("_")
    .find((term) => /^(?:pass|shoot|shot|punt|throw|cross)$/u.test(term)) ?? null;
}

function nativeFamilyAliases(family) {
  return family === "shoot" || family === "shot"
    ? ["shoot", "shot"]
    : [family];
}

function negativeResultSignal(record) {
  if (record.error !== null && record.error !== undefined) {
    return { kind: "error", reason: record.error.message, score: 420, terms: ["throw"] };
  }
  const result = unwrapBoundedResult(record.result);
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    if (result === false) {
      return { kind: "boolean-false", reason: "predicate-rejected", score: 135, terms: ["return", "false"] };
    }
    if (result === null && /resolve|select|qualif|candidate/iu.test(record.function)) {
      return { kind: "null", reason: "resolver-returned-null", score: 105, terms: ["return", "null"] };
    }
    if (result === 0 && /type|score|prefer|visible|range|pass/iu.test(record.function)) {
      return { kind: "zero", reason: "helper-returned-zero", score: 95, terms: ["return", "0"] };
    }
    return null;
  }
  const outcome = typeof result.outcome === "string" ? result.outcome.toLowerCase() : null;
  if (outcome && /(?:^|[-_])(no|none|reject|miss|fail|skip)(?:$|[-_])/u.test(`-${outcome}-`)) {
    const candidateCount = Array.isArray(result.candidates) ? result.candidates.length : null;
    const reason = candidateCount === 0
      ? "candidate-table-empty"
      : candidateCount !== null
        ? "candidate-selection-rejected"
        : `outcome-${outcome}`;
    return {
      kind: "explicit-outcome",
      reason,
      score: 330,
      terms: reason === "candidate-selection-rejected"
        ? ["selected", "chance", "rng.seed", "mustPass", "outcome"]
        : ["passTable", "passType", "candidate", "continue", "outcome"],
    };
  }
  for (const field of ["accepted", "eligible", "qualified", "selected", "valid"]) {
    if (result[field] !== false) continue;
    return {
      kind: "explicit-flag",
      reason: `${field}-false`,
      score: 225,
      terms: [field, "return", "if"],
    };
  }
  if (result.selected === null && Array.isArray(result.candidates)) {
    return {
      kind: "null-selection",
      reason: result.candidates.length === 0
        ? "candidate-table-empty"
        : "candidate-selection-rejected",
      score: 240,
      terms: ["selected", "candidates", "chance", "return"],
    };
  }
  return null;
}

function unwrapBoundedResult(result) {
  return result?.kind === "bounded-result" ? result.value : result;
}

function negativeBranchSites(declaration, signal, limit = 8) {
  const lines = declaration.source.split(/\r?\n/u);
  const sites = [];
  for (let index = 0; index < lines.length; index += 1) {
    const source = lines[index].trim();
    const matchedTerms = signal.terms.filter((term) => source.includes(term));
    if (matchedTerms.length === 0) continue;
    const control = /\b(?:if|else|continue|break|return|throw)\b/u.test(source);
    if (!control && matchedTerms.length < 2) continue;
    sites.push({
      file: declaration.file ?? null,
      function: declaration.name,
      line: declaration.line + index,
      score: matchedTerms.length * 12 + (control ? 18 : 0),
      matchedTerms,
      source: source.slice(0, 260),
      context: lines
        .slice(Math.max(0, index - 4), Math.min(lines.length, index + 3))
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
        .slice(0, 700),
    });
  }
  return Object.freeze(sites
    .sort((left, right) => right.score - left.score || left.line - right.line)
    .slice(0, limit)
    .sort((left, right) => left.line - right.line)
    .map(Object.freeze));
}

function negativeAncestorCalls(records, selected, limit = 8) {
  const byId = new Map(records.map((record) => [record.callId, record]));
  const output = [];
  let parent = selected.parentCallId;
  while (parent !== null && output.length < limit) {
    const record = byId.get(parent);
    if (!record) break;
    output.push(Object.freeze({
      file: record.file,
      function: record.function,
      line: record.line,
      callId: record.callId,
      callDepth: record.callDepth,
    }));
    parent = record.parentCallId;
  }
  return Object.freeze(output);
}

function negativeSupportingCalls(records, selected, limit = 20) {
  if (!Number.isSafeInteger(selected.callId)) return Object.freeze([]);
  const parentById = new Map(records.map((record) => [record.callId, record.parentCallId]));
  const descendants = records.filter((record) => {
    let parent = record.parentCallId;
    while (Number.isSafeInteger(parent)) {
      if (parent === selected.callId) return true;
      parent = parentById.get(parent) ?? null;
    }
    return false;
  });
  const useful = descendants.filter((record) => usefulSupportingResult(record));
  const groups = new Map();
  for (const record of useful) {
    const key = `${record.file ?? ""}\u0000${record.function}\u0000${record.line}`;
    const group = groups.get(key) ?? {
      file: record.file,
      function: record.function,
      line: record.line,
      evaluations: [],
    };
    group.evaluations.push(Object.freeze({
      facts: traceArgumentFacts(record.arguments),
      result: record.result,
      error: record.error,
    }));
    groups.set(key, group);
  }
  return Object.freeze([...groups.values()].slice(-limit).map((group) => (
    group.evaluations.length === 1
      ? Object.freeze({
          file: group.file,
          function: group.function,
          line: group.line,
          ...group.evaluations[0],
        })
      : Object.freeze({
          file: group.file,
          function: group.function,
          line: group.line,
          evaluations: Object.freeze(group.evaluations),
        })
  )));
}

function usefulSupportingResult(record) {
  if (record.output !== null || record.result === null || record.result?.kind === "undefined") {
    return false;
  }
  const result = unwrapBoundedResult(record.result);
  if (Array.isArray(result)) return false;
  if (result && typeof result === "object") {
    return JSON.stringify(result).length <= 1_600;
  }
  return ["string", "number", "boolean"].includes(typeof result);
}

function traceArgumentFacts(argumentsSummary) {
  const unwrapped = unwrapBoundedResult(argumentsSummary);
  const root = Array.isArray(unwrapped) && unwrapped.length === 1
    ? unwrapped[0]
    : unwrapped;
  const facts = {};
  for (const [label, path] of [
    ["candidateNativePlayer", ["candidate", "nativePlayer"]],
    ["holderNativePlayer", ["holder", "nativePlayer"]],
    ["passType", ["passType"]],
    ["seed", ["seed"]],
    ["cross", ["cross"]],
  ]) {
    const value = nestedTraceValue(root, path);
    if (["string", "number", "boolean"].includes(typeof value)) facts[label] = value;
  }
  return Object.freeze(facts);
}

function nestedTraceValue(root, path) {
  if (!root || typeof root !== "object") return undefined;
  let current = root;
  for (const part of path) {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, part)) return undefined;
    current = current[part];
  }
  return current;
}

function selectorSnapshotPaths(selectorOrLeaf) {
  const selector = typeof selectorOrLeaf === "string"
    ? { domain: null, leaf: selectorOrLeaf }
    : selectorOrLeaf;
  const leaf = selector?.leaf;
  if (selector?.domain === "ball") {
    const ballPaths = {
      x: ["position.x"],
      x_displacement: ["displacement.x", "xDisplacement"],
      y: ["position.y"],
      y_displacement: ["displacement.y", "yDisplacement"],
      z: ["position.z"],
      z_displacement: ["displacement.z", "zDisplacement"],
    };
    if (Object.hasOwn(ballPaths, leaf)) return Object.freeze(ballPaths[leaf]);
  }
  if (selector?.domain === "players") {
    const playerPaths = {
      x: ["position.x"],
      x_displacement: ["goDisplacement.x", "displacement.x", "xDisplacement"],
      y: ["position.y"],
      y_displacement: ["goDisplacement.y", "displacement.y", "yDisplacement"],
      z: ["position.z"],
      z_displacement: ["goDisplacement.z", "displacement.z", "zDisplacement"],
    };
    if (Object.hasOwn(playerPaths, leaf)) return Object.freeze(playerPaths[leaf]);
  }
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
  for (const path of paths.filter((entry) => entry.includes("."))) {
    const parts = path.split(".");
    const parent = parts.at(-2);
    const leaf = parts.at(-1);
    const direct = new RegExp(
      `\\b${escapeRegExp(parent)}\\s*\\.\\s*${escapeRegExp(leaf)}\\s*(?:[+\\-*/%&|^]?=)`,
      "u",
    );
    const objectLiteral = new RegExp(
      `\\b${escapeRegExp(parent)}\\b\\s*(?::|=)\\s*\\{[\\s\\S]{0,900}?\\b${escapeRegExp(leaf)}\\s*:`,
      "u",
    );
    const match = direct.exec(source) ?? objectLiteral.exec(source);
    if (match !== null) {
      const lineIndex = source.slice(0, match.index).split(/\r?\n/u).length - 1;
      const lines = source.split(/\r?\n/u);
      return {
        writes: true,
        qualifiedWrite: true,
        mentions: true,
        line: lines.slice(lineIndex, lineIndex + 5).map((line) => line.trim()).join(" ").slice(0, 260),
      };
    }
  }
  const terms = [...new Set(paths.filter((path) => !path.includes(".")))];
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
      return {
        writes: true,
        qualifiedWrite: false,
        mentions: true,
        line: line.trim().slice(0, 220),
      };
    }
  }
  return {
    writes: false,
    qualifiedWrite: false,
    mentions: mention !== null,
    line: mention,
  };
}

function snakeToCamel(value) {
  return value.replace(/_([a-z])/gu, (_match, character) => character.toUpperCase());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function rankCompoundNativeWriteSites(nativeFiles, fields, { limit = 8 } = {}) {
  const byFunction = new Map();
  for (const field of fields) {
    const sites = findNativeWriteSites(nativeFiles, {
      sourceOwner: field.sourceOwner,
      limit: 80,
    }).filter(({ write, function: functionName }) => write && functionName !== null);
    for (const site of sites) {
      const key = `${site.file}\u0000${site.function}`;
      const current = byFunction.get(key) ?? {
        file: site.file,
        function: site.function,
        line: site.line,
        score: 0,
        writesByField: new Map(),
      };
      const prior = current.writesByField.get(field.fieldId);
      if (prior === undefined || site.score > prior.score) {
        current.writesByField.set(field.fieldId, Object.freeze({
          fieldId: field.fieldId,
          sourceOwner: field.sourceOwner,
          line: site.line,
          source: site.source,
          matchedSymbols: site.matchedSymbols,
          score: site.score,
        }));
      }
      current.line = Math.min(current.line, site.line);
      byFunction.set(key, current);
    }
  }
  return Object.freeze([...byFunction.values()]
    .map((candidate) => {
      const writes = [...candidate.writesByField.values()]
        .sort((left, right) => left.fieldId.localeCompare(right.fieldId));
      return Object.freeze({
        file: candidate.file,
        function: candidate.function,
        line: candidate.line,
        coverage: writes.length,
        score: writes.length * 200 + writes.reduce((sum, write) => sum + write.score, 0),
        writes: Object.freeze(writes),
      });
    })
    .filter(({ coverage }) => coverage >= 2)
    .sort((left, right) => right.coverage - left.coverage
      || right.score - left.score
      || left.file.localeCompare(right.file)
      || left.line - right.line)
    .slice(0, limit));
}

export function rankCompoundRuntimeOwners({
  trace,
  declarations,
  fields,
  nativeProducer,
  limit = 8,
}) {
  if (trace?.status !== "captured" || !Array.isArray(trace.records)) {
    return Object.freeze([]);
  }
  const declarationByKey = new Map(declarations.map((entry) => [
    `${entry.file ?? ""}\u0000${entry.name}`,
    entry,
  ]));
  const declarationByName = new Map(declarations.map((entry) => [entry.name, entry]));
  const nativeTerms = nativeProducer.function.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean);
  const familyTerms = new Set(nativeTerms);
  if (familyTerms.has("shoot") || familyTerms.has("shot")) {
    for (const term of ["shoot", "shot", "kick", "release", "ball"]) familyTerms.add(term);
  }
  if (familyTerms.has("pass")) {
    for (const term of ["pass", "kick", "release", "ball"]) familyTerms.add(term);
  }
  const byFunction = new Map();
  for (const record of trace.records) {
    const declaration = declarationByKey.get(
      `${record.file ?? ""}\u0000${record.function}`,
    ) ?? declarationByName.get(record.function) ?? null;
    if (declaration === null) continue;
    const lowerName = record.function.toLowerCase();
    const lowerSource = declaration.source.toLowerCase();
    const matchedNameTerms = [...familyTerms].filter((term) => lowerName.includes(term));
    const matchedSourceTerms = [...familyTerms].filter((term) => lowerSource.includes(term));
    const matchedFamilyTerms = [...new Set([...matchedNameTerms, ...matchedSourceTerms])];
    const matchedFields = [];
    let fieldWriteCount = 0;
    for (const field of fields) {
      const leaf = field.fieldId.split(".").slice(1).join(".");
      const focus = selectorSourceFocus(
        declaration.source,
        selectorSnapshotPaths({ domain: "ball", leaf }),
      );
      if (!focus.mentions) continue;
      matchedFields.push(field.fieldId);
      if (focus.writes) fieldWriteCount += 1;
    }
    if (matchedFamilyTerms.length === 0 && matchedFields.length === 0) continue;
    const sourceFocus = compoundRuntimeSourceFocus(declaration, familyTerms, fields);
    const declarationLength = declaration.source.split(/\r?\n/u).length;
    let score = matchedNameTerms.length * 120
      + matchedSourceTerms.length * 22
      + matchedFields.length * 24
      + fieldWriteCount * 30
      + sourceFocus.score;
    if (lowerSource.includes(nativeProducer.function.toLowerCase())) score += 180;
    if (record.output?.depth === 0) score += 35;
    if (record.input?.depth === 0) score += 25;
    score += Math.min(record.callDepth ?? 0, 12) * 10;
    score += Math.max(0, 90 - declarationLength);
    const candidate = Object.freeze({
      file: record.file ?? declaration.file,
      function: record.function,
      line: sourceFocus.line,
      callDepth: record.callDepth,
      score,
      role: "executed-owner",
      matchedFamilyTerms: Object.freeze(matchedFamilyTerms),
      matchedFields: Object.freeze(matchedFields),
      fieldWriteCount,
      source: sourceFocus.source,
    });
    const key = `${candidate.file}\u0000${candidate.function}`;
    const prior = byFunction.get(key);
    if (prior === undefined || candidate.score > prior.score) byFunction.set(key, candidate);
  }
  return Object.freeze([...byFunction.values()]
    .sort((left, right) => right.score - left.score
      || right.callDepth - left.callDepth
      || left.file.localeCompare(right.file)
      || left.line - right.line)
    .slice(0, limit));
}

function compoundRuntimeSourceFocus(declaration, familyTerms, fields) {
  const fieldTerms = [...new Set(fields.flatMap(({ fieldId }) => {
    const leaf = fieldId.split(".").slice(1).join(".");
    return selectorSnapshotPaths({ domain: "ball", leaf })
      .map((path) => path.split(".").at(-1).toLowerCase());
  }))];
  const lines = declaration.source.split(/\r?\n/u);
  let best = { line: declaration.line, score: 0, source: lines[0]?.trim() ?? "" };
  for (let index = 0; index < lines.length; index += 1) {
    const source = lines[index].trim();
    const lower = source.toLowerCase();
    const familyMatches = [...familyTerms].filter((term) => lower.includes(term)).length;
    const fieldMatches = fieldTerms.filter((term) => lower.includes(term)).length;
    if (familyMatches === 0 && fieldMatches === 0) continue;
    const control = /\b(?:if|else|return|throw)\b/u.test(source);
    const call = /[A-Za-z_$][\w$]*\s*\(/u.test(source);
    const score = familyMatches * 35 + fieldMatches * 20 + (control ? 12 : 0) + (call ? 10 : 0);
    if (score <= best.score) continue;
    best = { line: declaration.line + index, score, source: source.slice(0, 260) };
  }
  return best;
}

export function buildCompoundTransition({
  exact,
  sameTickMismatches,
  transitionClues,
  nativeFiles,
  declarations,
  callTrace,
}) {
  if (exact?.selector?.domain !== "ball" || exact.route?.id !== "missing-transition") {
    return null;
  }
  const clueByField = new Map(transitionClues.map((clue) => [clue.fieldId, clue]));
  const fields = sameTickMismatches
    .filter((mismatch) => mismatch.fieldId.startsWith("ball."))
    .map((mismatch) => ({ ...mismatch, clue: clueByField.get(mismatch.fieldId) ?? null }))
    .filter(({ clue }) => clue?.referenceChanged === true && clue?.candidateChanged === false)
    .map((mismatch) => Object.freeze({
      fieldId: mismatch.fieldId,
      sourceOwner: mismatch.sourceOwner,
      before: mismatch.clue.before,
      reference: mismatch.reference,
      candidate: mismatch.candidate,
    }));
  if (fields.length < 2) return null;
  const nativeCandidates = rankCompoundNativeWriteSites(nativeFiles, fields);
  const nativeProducer = nativeCandidates[0] ?? null;
  if (nativeProducer === null) return null;
  const runtimeOwners = rankCompoundRuntimeOwners({
    trace: callTrace,
    declarations,
    fields,
    nativeProducer,
  });
  return Object.freeze({
    schema: "cssoccer-differential-frontier-compound-transition@1",
    status: runtimeOwners.length > 0 ? "surfaced" : "native-producer-only",
    kind: "missing-compound-transition",
    domain: "ball",
    fields: Object.freeze(fields),
    nativeProducer,
    nativeAlternatives: Object.freeze(nativeCandidates.slice(1, 4)),
    runtimeOwner: runtimeOwners[0] ?? null,
    runtimeAlternatives: Object.freeze(runtimeOwners.slice(1, 4)),
    diagnosticOnly: true,
  });
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

function directFreePlayProjectionCandidate(files, exact) {
  const file = files.find(({ name }) => name === "freePlayProjection.mjs");
  if (!file || typeof exact?.fieldId !== "string") return null;
  const lines = file.text.split(/\r?\n/u);
  const declarations = topLevelFunctionDeclarations(file.text);
  let lineIndex = lines.findIndex((line) => line.includes(JSON.stringify(exact.fieldId)));
  let declaration = lineIndex < 0
    ? null
    : declarations.filter(({ line }) => line <= lineIndex + 1).at(-1);
  if (declaration === null) {
    const domainFunction = {
      ball: "projectBall",
      camera: "projectCameraFields",
      clock: "projectClock",
      lifecycle: "projectLifecycle",
      players: "projectPlayers",
      rng: "projectRng",
      rules: "projectRules",
      score: "projectScore",
    }[exact.fieldId.split(".", 1)[0]];
    declaration = declarations.find(({ name }) => name === domainFunction) ?? null;
    lineIndex = declaration === null ? -1 : declaration.line - 1;
  }
  if (lineIndex < 0 || declaration === null) return null;
  const site = Object.freeze({
    file: file.path,
    line: lineIndex + 1,
    function: declaration?.name ?? "projectCssoccerFreePlaySnapshot",
    classification: "runtime",
    score: 512,
    write: true,
    matchedTerms: Object.freeze([exact.fieldId]),
    source: lines[lineIndex].trim().slice(0, 260),
  });
  return Object.freeze({
    file: file.path,
    classification: "runtime",
    score: site.score,
    sites: Object.freeze([site]),
  });
}

function mergeRuntimeCandidates(direct, candidates) {
  if (direct === null) return candidates;
  return Object.freeze([
    direct,
    ...candidates.filter(({ file }) => file !== direct.file),
  ]);
}

function buildSymbolicRouting({
  nativeWriter,
  symbolicTransitions,
  nativeCallerBranches,
  nativeBranchIdentity,
  browserMappingCandidates,
  negativePathCandidates,
  negativePathFocus,
  nativeBranchMismatchFocus,
}) {
  const nativeCallChain = nativeBranchIdentity.branch;
  const negativePath = negativePathCandidates[0] ?? null;
  const browserMapping = browserMappingCandidates.find(({ activeAtFrontier }) => (
    activeAtFrontier
  )) ?? null;
  const staticBrowserMapping = browserMappingCandidates[0] ?? null;
  return Object.freeze({
    status: nativeBranchIdentity.status === "ambiguous"
      ? "native-branch-ambiguous"
      : negativePath !== null
      ? "executed-negative-path"
      : browserMapping !== null
        ? "surfaced"
        : nativeCallChain !== null
          ? "native-chain-only"
          : symbolicTransitions.length > 0
            ? "symbols-only"
            : "not-surfaced",
    transitions: symbolicTransitions,
    nativeWriter: nativeWriter === null ? null : Object.freeze({
      file: nativeWriter.file,
      line: nativeWriter.line,
      function: nativeWriter.function,
      source: nativeWriter.source,
    }),
    nativeCallChain,
    nativeBranchIdentity,
    nativeAlternatives: Object.freeze(nativeCallerBranches
      .filter((branch) => branch !== nativeCallChain)
      .slice(0, 4)),
    negativePath,
    negativePathFocus,
    nativeBranchMismatchFocus,
    negativePathAlternatives: Object.freeze(negativePathCandidates.slice(1, 4)),
    browserMapping,
    staticBrowserMapping,
    browserAlternatives: Object.freeze(browserMappingCandidates
      .filter((candidate) => candidate !== staticBrowserMapping)
      .slice(0, 4)),
    diagnosticOnly: true,
  });
}

export function nextAction({
  exact,
  producer,
  symbolicRouting,
  compoundTransition = null,
  retainedMovement,
  duplicate,
  evidenceRoot,
  outputRoot,
}) {
  if (exact === null) {
    return Object.freeze({
      kind: "public-evaluation",
      question: "The diagnostic engine is exact; run the full capture and synchronous publisher.",
      command: "pnpm capture:free-play:check && pnpm oven:differential",
    });
  }
  if (compoundTransition !== null) {
    const native = compoundTransition.nativeProducer;
    const runtimeOwner = compoundTransition.runtimeOwner;
    const fieldIds = compoundTransition.fields.map(({ fieldId }) => fieldId);
    if (runtimeOwner === null) {
      return Object.freeze({
        kind: "compound-transition-owner-gap",
        file: null,
        function: null,
        line: null,
        question: `Native ${native.function} jointly writes ${fieldIds.join(", ")}, but no executed browser owner was bound at the frontier.`,
        nativeTransition: native,
        groupedFields: compoundTransition.fields,
        rerunCommand: "node tools/run-differential-frontier.mjs --continue",
        doNotRerunBeforeRuntimeChanges: true,
        note: "Do not implement the fields independently; repair the trace owner seam first.",
      });
    }
    return Object.freeze({
      kind: "implement-compound-native-transition",
      file: runtimeOwner.file,
      function: runtimeOwner.function,
      line: runtimeOwner.line,
      question: `Native ${native.function} changes ${fieldIds.join(", ")} as one transition; implement that transition once at the executed ${runtimeOwner.function} boundary.`,
      nativeTransition: native,
      groupedFields: compoundTransition.fields,
      runtimeOwner,
      runtimeAlternatives: compoundTransition.runtimeAlternatives,
      publicEvaluationCommand: "pnpm capture:free-play:check && pnpm oven:differential",
      rerunCommand: "node tools/run-differential-frontier.mjs --continue",
      doNotRerunBeforeRuntimeChanges: duplicate,
      note: "Treat the grouped fields as outputs of one source transition, not as separate constants or patches.",
    });
  }
  if (symbolicRouting.status === "native-branch-ambiguous") {
    return Object.freeze({
      kind: "native-branch-identity-gap",
      file: null,
      function: null,
      line: null,
      question: "Multiple native branches produce the exact transition, and no retained discriminator proved which one executed.",
      nativeBranchIdentity: symbolicRouting.nativeBranchIdentity,
      rerunCommand: "node tools/run-differential-frontier.mjs --continue",
      doNotRerunBeforeRuntimeChanges: true,
      note: "Do not associate a native switch value with a browser candidate until native branch identity is bound.",
    });
  }
  if (symbolicRouting.status === "executed-negative-path") {
    const negative = compactNegativePath(symbolicRouting.negativePath);
    const branchMismatch = symbolicRouting.nativeBranchMismatchFocus;
    if (branchMismatch !== null) {
      const decision = branchMismatch.missingDecisionFunction
        ?? `${branchMismatch.nativeFamily}_decision`;
      return Object.freeze({
        kind: "implement-missing-native-decision-branch",
        file: branchMismatch.browserOwner.file,
        function: branchMismatch.browserOwner.function,
        line: branchMismatch.browserOwner.line,
        question: `Native ${branchMismatch.nativeFunction} is proven by ${branchMismatch.branchIdentity?.symbol}=${branchMismatch.branchIdentity?.value}, but the browser executed ${branchMismatch.browserExecutedFunction}; implement ${decision} before that later decision path.`,
        nativeBranchMismatch: branchMismatch,
        nativeBranchIdentity: symbolicRouting.nativeBranchIdentity,
        rejectionKind: negative.rejectionKind,
        rejectionReason: negative.rejectionReason,
        result: negative.result,
        supportingCalls: negative.supportingCalls,
        publicEvaluationCommand: "pnpm capture:free-play:check && pnpm oven:differential",
        rerunCommand: "node tools/run-differential-frontier.mjs --continue",
        doNotRerunBeforeRuntimeChanges: duplicate,
        note: "The native branch discriminator outranks a browser helper with a different decision family.",
      });
    }
    const focus = symbolicRouting.negativePathFocus;
    const producer = focus?.producer ?? negative;
    return Object.freeze({
      kind: focus === null
        ? "inspect-executed-negative-path"
        : "inspect-executed-wrong-value-producer",
      file: producer.file,
      function: producer.function,
      line: producer.line,
      question: focus === null
        ? `The executed ${negative.function} path returned ${negative.rejectionReason}; repair that decision producer before the unexecuted native mapping seam.`
        : `Executed ${producer.function} returned ${producer.result}, while native ${focus.expectedSwitchExpression} requires ${focus.expectedValue}; repair this wrong-value producer.`,
      executedValueMismatch: focus,
      rejectionKind: negative.rejectionKind,
      rejectionReason: negative.rejectionReason,
      result: negative.result,
      sourceBranches: focus === null ? negative.sourceBranches : [],
      supportingCalls: negative.supportingCalls,
      unexecutedStaticMapping: compactMappingCandidate(symbolicRouting.staticBrowserMapping),
      publicEvaluationCommand: "pnpm capture:free-play:check && pnpm oven:differential",
      rerunCommand: "node tools/run-differential-frontier.mjs --continue",
      doNotRerunBeforeRuntimeChanges: duplicate,
      note: "Only executed negative-path evidence is primary. The static mapping candidate is advisory until the trace reaches it.",
    });
  }
  if (symbolicRouting.status === "surfaced") {
    const branch = symbolicRouting.nativeCallChain;
    const mapping = symbolicRouting.browserMapping;
    const matched = branch.matchedTransitionSymbols.join(", ");
    return Object.freeze({
      kind: "implement-native-branch-mapping",
      file: mapping.file,
      function: mapping.function,
      line: mapping.line,
      question: `Implement ${branch.switchExpression} case ${branch.caseExpression} (${matched}) from ${branch.function} -> ${branch.callee} as a generic runtime mapping.`,
      nativeChain: Object.freeze({
        caller: branch.function,
        callerFile: branch.file,
        callerLine: branch.functionLine,
        callLine: branch.line,
        switchExpression: branch.switchExpression,
        caseExpression: branch.caseExpression,
        caseValue: branch.caseValue,
        matchedSymbols: branch.matchedTransitionSymbols,
      }),
      nativeDispatchTable: branch.dispatchTable,
      symbolicTransitions: symbolicRouting.transitions.map(({ sourceMember, after, symbol }) => ({
        sourceMember,
        after,
        symbol,
      })),
      publicEvaluationCommand: "pnpm capture:free-play:check && pnpm oven:differential",
      rerunCommand: "node tools/run-differential-frontier.mjs --continue",
      doNotRerunBeforeRuntimeChanges: duplicate,
      note: "Use the surfaced native dispatch table to implement the branch family; rerun only after the runtime mapping changes.",
    });
  }
  if (producer.status === "surfaced") {
    return Object.freeze({
      kind: "inspect-producer",
      file: producer.candidateFile,
      function: producer.candidateFunction,
      line: producer.candidateLine,
      question: exact.route.question,
      publicEvaluationCommand: "pnpm capture:free-play:check && pnpm oven:differential",
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

function buildFrontierPacket(evidence, evidencePath, evidenceRoot) {
  const exact = evidence.current.exact;
  const internal = evidence.internal;
  return Object.freeze({
    schema: DIFFERENTIAL_FRONTIER_PACKET_SCHEMA,
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
    runtimeException: evidence.current.runtimeException ?? null,
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
    symbolicRouting: compactSymbolicRouting(evidence.symbolicRouting),
    compoundTransition: compactCompoundTransition(evidence.compoundTransition),
    compiledPath: evidence.compiledPath,
    transitionClues: evidence.current.transitionClues.slice(0, 6).map((clue) => ({
      fieldId: clue.fieldId,
      referenceChanged: clue.referenceChanged,
      candidateChanged: clue.candidateChanged,
      reference: clue.reference,
      candidate: clue.candidate,
    })),
    classifiedPreLoop: {
      count: evidence.current.classifiedMismatchCount ?? 0,
      fields: (evidence.current.classifiedMismatches ?? []).slice(0, 8).map((entry) => ({
        tick: entry.tick,
        fieldId: entry.fieldId,
        kind: entry.classification.kind,
        sourceBoundary: entry.classification.sourceBoundary,
      })),
    },
    internalChanges: internal.nativePlayerChanges.slice(0, 8).map((change) => ({
      sourceMember: change.sourceMember,
      before: change.before,
      after: change.after,
    })),
    nextAction: evidence.nextAction,
    evidencePath: relativeOrAbsolute(evidenceRoot, evidencePath),
  });
}

function compactCompoundTransition(compound) {
  if (compound === null || compound === undefined) return null;
  const compactProducer = (candidate) => candidate === null ? null : Object.freeze({
    file: candidate.file,
    function: candidate.function,
    line: candidate.line,
    coverage: candidate.coverage,
    writes: candidate.writes?.map(({ fieldId, line, source }) => ({ fieldId, line, source })),
  });
  return Object.freeze({
    schema: compound.schema,
    status: compound.status,
    kind: compound.kind,
    domain: compound.domain,
    fields: compound.fields.map(({ fieldId, before, reference, candidate }) => ({
      fieldId,
      before,
      reference,
      candidate,
    })),
    nativeProducer: compactProducer(compound.nativeProducer),
    runtimeOwner: compound.runtimeOwner,
  });
}

function compactSymbolicRouting(routing) {
  const branch = routing.nativeCallChain;
  return Object.freeze({
    status: routing.status,
    transitions: routing.transitions.map(({ sourceMember, before, after, symbol }) => ({
      sourceMember,
      before,
      after,
      symbol,
    })),
    nativeWriter: routing.nativeWriter,
    nativeCallChain: branch === null ? null : Object.freeze({
      caller: branch.function,
      callerFile: branch.file,
      callerLine: branch.functionLine,
      callee: branch.callee,
      callLine: branch.line,
      switchExpression: branch.switchExpression,
      caseExpression: branch.caseExpression,
      caseValue: branch.caseValue,
      matchedSymbols: branch.matchedTransitionSymbols,
      ...(routing.status === "executed-negative-path"
        ? {}
        : { dispatchTable: branch.dispatchTable }),
    }),
    nativeBranchIdentity: routing.nativeBranchIdentity,
    negativePath: compactNegativePath(routing.negativePath, { includeEvidence: false }),
    negativePathFocus: routing.negativePathFocus,
    nativeBranchMismatchFocus: routing.nativeBranchMismatchFocus,
    negativePathAlternatives: routing.status === "executed-negative-path"
      ? []
      : routing.negativePathAlternatives.map((candidate) => ({
          file: candidate.file,
          function: candidate.function,
          line: candidate.line,
          score: candidate.score,
          rejectionKind: candidate.rejectionKind,
          rejectionReason: candidate.rejectionReason,
        })),
    browserMapping: routing.status === "executed-negative-path"
      ? null
      : compactMappingCandidate(routing.browserMapping),
    staticBrowserMapping: compactMappingCandidate(routing.staticBrowserMapping),
    browserAlternatives: routing.status === "executed-negative-path"
      ? []
      : routing.browserAlternatives.map(compactMappingCandidate),
  });
}

function compactMappingCandidate(candidate) {
  if (candidate === null) return null;
  return Object.freeze({
    file: candidate.file,
    function: candidate.function,
    line: candidate.line,
    activeAtFrontier: candidate.activeAtFrontier,
    source: candidate.source,
  });
}

function compactNegativePath(candidate, { includeEvidence = true } = {}) {
  if (candidate === null) return null;
  return Object.freeze({
    file: candidate.file,
    function: candidate.function,
    line: candidate.line,
    score: candidate.score,
    rejectionKind: candidate.rejectionKind,
    rejectionReason: candidate.rejectionReason,
    result: candidate.result,
    ...(includeEvidence ? {
      sourceBranches: candidate.sourceBranches,
      supportingCalls: candidate.supportingCalls,
      ancestorCalls: candidate.ancestorCalls,
    } : {}),
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
    inputSha256: profile.binding?.commandScenarioSha256,
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

function runtimeEntityForNativeSlot(state, nativePlayerNumber) {
  const players = state?.openingLivePlayers?.players ?? state?.players;
  if (!Array.isArray(players)) return null;
  const player = players.find((candidate) => (
    candidate?.nativePlayerNumber === nativePlayerNumber
    && typeof candidate?.id === "string"
  ));
  return player?.id ?? null;
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
    "and prints one compact frontier packet without modifying the runtime.",
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

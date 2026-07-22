#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  chmod,
  cp,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPILED_PATH_QUERY_SCHEMA,
  CompiledPathInspectorError,
  fileEvidence,
  parseWatcomMap,
  sha256,
  sha256Canonical,
} from "./compiled-path-inspector-core.mjs";
import { inspectCompiledPath } from "./inspect-compiled-path.mjs";

export const CURRENT_COMPILED_PATH_PROFILE_SCHEMA = "cssoccer-current-compiled-path-profile@1";
export const CURRENT_COMPILED_PATH_ACTION_SCHEMA = "cssoccer-current-compiled-path-action@1";

const toolRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const PROBE_TIMEOUT_MILLISECONDS = 60_000;
const PROBE_LOG_POLL_MILLISECONDS = 100;
const PROBE_KILL_GRACE_MILLISECONDS = 250;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}

async function main(args) {
  try {
    const options = parseArguments(args);
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    const result = options.initializeProfile
      ? await initializeCurrentCompiledPathProfile(options)
      : await runCurrentCompiledPathCheck(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const failure = {
      schema: "cssoccer-current-compiled-path-failure@1",
      status: "tool-gap",
      code: error instanceof CompiledPathInspectorError ? error.code : "current-compiled-path-error",
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof CompiledPathInspectorError && error.details !== undefined
        ? { details: error.details }
        : {}),
    };
    process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 1;
  }
}

export async function initializeCurrentCompiledPathProfile(options, dependencies = {}) {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const profilePath = resolveProfilePath(workspaceRoot, options.profilePath);
  if (existsSync(profilePath)) {
    throw new CompiledPathInspectorError(
      "current-profile-exists",
      `Current compiled-path profile already exists: ${profilePath}`,
    );
  }
  const stageSourceRoot = requireExistingDirectory(options.stageRoot, "--stage-root");
  const queryTransportPath = requireExistingFile(options.queryTransportPath, "--query-transport");
  const transportEvidencePath = requireExistingFile(options.transportEvidencePath, "--transport-evidence");
  const context = await loadRetainedContext(workspaceRoot);
  const build = await discoverCompiledBuild({
    workspaceRoot,
    oracleContract: context.oracleContract,
    captureRanges: context.nativeProfile.transport.rawRanges,
  });
  const transportEvidence = JSON.parse(await readFile(transportEvidencePath, "utf8"));
  if (transportEvidence.schema !== "cssoccer-query-transport-build@1" || transportEvidence.status !== "isolated-pass") {
    throw new CompiledPathInspectorError(
      "query-transport-evidence-invalid",
      "Query transport needs passing isolated build evidence.",
      { transportEvidencePath },
    );
  }
  const queryTransport = await fileEvidence(queryTransportPath);
  if (queryTransport.sha256 !== transportEvidence.binary?.sha256) {
    throw new CompiledPathInspectorError(
      "query-transport-binding-mismatch",
      "Query transport binary does not match its isolated build evidence.",
      { expected: transportEvidence.binary?.sha256 ?? null, actual: queryTransport.sha256 },
    );
  }
  if (transportEvidence.dosboxRevision !== context.nativeProfile.transport.revision) {
    throw new CompiledPathInspectorError(
      "query-transport-revision-mismatch",
      "Query transport and retained native transport use different DOSBox-X revisions.",
      {
        expected: context.nativeProfile.transport.revision,
        actual: transportEvidence.dosboxRevision,
      },
    );
  }

  const stageExpectation = {
    binding: context.nativeProfile.binding,
    sourceArtifacts: context.oracleContract.runner.sourceArtifacts,
  };
  await verifyStageTemplate(stageSourceRoot, stageExpectation);
  const profileRoot = dirname(profilePath);
  const stageTarget = join(profileRoot, "stage-template");
  const temporaryStage = `${stageTarget}.tmp-${process.pid}`;
  const queryTransportRoot = join(profileRoot, "query-transport");
  const queryTransportTarget = join(queryTransportRoot, "dosbox-x");
  const queryEvidenceTarget = join(queryTransportRoot, "build-evidence.json");
  const queryPatchSource = join(dirname(transportEvidencePath), "core_normal-cssqry1.patch");
  const queryPatchTarget = join(queryTransportRoot, "core_normal-cssqry1.patch");
  if (existsSync(stageTarget) || existsSync(temporaryStage) || existsSync(queryTransportRoot)) {
    throw new CompiledPathInspectorError(
      "current-profile-stage-exists",
      `Compiled-path profile assets already exist under ${profileRoot}.`,
    );
  }
  await mkdir(profileRoot, { recursive: true });
  const copyStage = dependencies.copyStage ?? (async () => cp(stageSourceRoot, temporaryStage, { recursive: true }));
  await copyStage({ source: stageSourceRoot, destination: temporaryStage });
  await rename(temporaryStage, stageTarget);
  await mkdir(queryTransportRoot, { recursive: true });
  await Promise.all([
    copyFile(queryTransportPath, queryTransportTarget),
    copyFile(transportEvidencePath, queryEvidenceTarget),
    ...(existsSync(queryPatchSource) ? [copyFile(queryPatchSource, queryPatchTarget)] : []),
  ]);
  await chmod(queryTransportTarget, 0o755);
  const copiedStage = await verifyStageTemplate(stageTarget, stageExpectation);
  const copiedQueryTransport = await fileEvidence(queryTransportTarget);
  if (copiedQueryTransport.sha256 !== queryTransport.sha256) {
    throw new CompiledPathInspectorError(
      "query-transport-copy-mismatch",
      "Copied query transport does not match its source binding.",
    );
  }
  const profile = {
    schema: CURRENT_COMPILED_PATH_PROFILE_SCHEMA,
    createdAt: new Date().toISOString(),
    workspace: {
      root: workspaceRoot,
      sourceRevision: context.nativeScenario.sourceRevision,
      scenarioSha256: context.nativeCurrent.bindings.scenarioSha256,
      profileSha256: context.nativeCurrent.bindings.profileSha256,
      inputSha256: context.nativeCurrent.bindings.inputSha256,
      fieldContractSha256: context.nativeCurrent.bindings.contractSha256,
      nativeBuildSha256: context.nativeCurrent.bindings.buildSha256,
    },
    retained: {
      differentialRoot: relativeOrAbsolute(workspaceRoot, context.paths.differentialRoot),
      nativeCurrentPath: relativeOrAbsolute(workspaceRoot, context.paths.nativeCurrentPath),
      nativeProfilePath: relativeOrAbsolute(workspaceRoot, context.paths.nativeProfilePath),
      nativeScenarioPath: relativeOrAbsolute(workspaceRoot, context.paths.nativeScenarioPath),
      nativeRawPath: relativeOrAbsolute(workspaceRoot, context.paths.nativeRawPath),
    },
    compiled: {
      buildRoot: relativeOrAbsolute(workspaceRoot, build.root),
      map: build.map,
      executable: build.executable,
      dgroupSegment: build.dgroupSegment,
      objects: build.objects,
    },
    probe: {
      authority: "diagnostic-read-only",
      parityAuthority: false,
      templateStageRoot: relativeOrAbsolute(workspaceRoot, stageTarget),
      stage: copiedStage,
      queryTransport: {
        path: relativeOrAbsolute(workspaceRoot, copiedQueryTransport.path),
        sha256: copiedQueryTransport.sha256,
        dosboxRevision: transportEvidence.dosboxRevision,
        queryPatchSha256: transportEvidence.queryPatch?.sha256 ?? null,
        queryPatchPath: existsSync(queryPatchTarget)
          ? relativeOrAbsolute(workspaceRoot, queryPatchTarget)
          : null,
        patchedSourceSha256: transportEvidence.patchedSource?.sha256 ?? null,
        baseTransportBinarySha256: context.nativeProfile.transport.binarySha256,
        baseTransportSourcePatchSha256: context.nativeProfile.transport.sourcePatchSha256,
      },
      transportEvidence: {
        path: relativeOrAbsolute(workspaceRoot, queryEvidenceTarget),
        sha256: sha256(await readFile(queryEvidenceTarget)),
      },
    },
  };
  await atomicWrite(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
  return {
    schema: "cssoccer-current-compiled-path-profile-result@1",
    status: "ready",
    profilePath,
    moduleCount: Object.keys(profile.compiled.objects).length,
    dgroupSegment: profile.compiled.dgroupSegment,
    queryTransportSha256: profile.probe.queryTransport.sha256,
    stageExecutableSha256: copiedStage.executableSha256,
    nextAction: "Use the retained-current compiled-path action; do not edit oracle capture ranges.",
    command: "node tools/run-compiled-path-check.mjs --function <native-function> --object <module> --symbol <global[:type]>",
  };
}

export async function runCurrentCompiledPathCheck(options, dependencies = {}) {
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  const profilePath = resolveProfilePath(workspaceRoot, options.profilePath);
  const profile = JSON.parse(await readFile(profilePath, "utf8"));
  requireProfile(profile, profilePath);
  const context = await loadRetainedContext(workspaceRoot, profile);
  const objectName = normalizeObjectName(options.objectName);
  const object = profile.compiled.objects[objectName];
  if (!object) {
    throw new CompiledPathInspectorError(
      "current-object-missing",
      `Compiled module ${objectName} is not present in the retained profile.`,
      { available: Object.keys(profile.compiled.objects).sort() },
    );
  }
  const symbols = normalizeSymbols(options.symbols);
  const workRoot = resolve(
    options.workRoot
      ?? join(workspaceRoot, ".local", "cssoccer", "compiled-path-inspector", "actions"),
  );
  const exact = options.exactOverride
    ? normalizeRunnerExact(
        options.exactOverride,
        context.exact,
        options.exactOverrideBindings,
        context.nativeCurrent.bindings,
      )
    : context.exact;
  const bindings = currentProbeBindings(context);
  const baseQuery = {
    schema: COMPILED_PATH_QUERY_SCHEMA,
    workspaceRoot,
    workRoot: join(workRoot, "inspector"),
    function: requireText(options.functionName, "--function"),
    object: { path: object.path, expectedSha256: object.sha256 },
    map: { path: profile.compiled.map.path, expectedSha256: profile.compiled.map.sha256 },
    executable: {
      path: profile.compiled.executable.path,
      expectedSha256: profile.compiled.executable.sha256,
    },
    capture: {
      contractPath: profile.retained.nativeProfilePath,
      rangesPath: "transport.rawRanges",
    },
    oracleContractPath: "references/actua-soccer-oracle.json",
    symbols,
  };
  await verifyCurrentProfileArtifacts({ workspaceRoot, profile, object });
  const inspect = dependencies.inspectCompiledPath ?? inspectCompiledPath;
  const staticEvidence = await inspect(baseQuery);
  const needsProbe = staticEvidence.hotPacket.symbols.some(({ capture }) => (
    typeof capture === "object" && capture?.status === "probe-required"
  ));
  const actionId = sha256Canonical({
    schema: CURRENT_COMPILED_PATH_ACTION_SCHEMA,
    exact,
    function: baseQuery.function,
    object: objectName,
    symbols,
    compiledArtifactBindingSha256: object.compiledArtifactBindingSha256,
  }).slice(0, 16);
  const actionRoot = join(workRoot, actionId);
  await mkdir(actionRoot, { recursive: true });

  let compiledEvidence = staticEvidence;
  let runtime = null;
  if (needsProbe) {
    compiledEvidence = await inspect({
      ...baseQuery,
      probe: {
        enabled: true,
        compiledArtifactBindingSha256: object.compiledArtifactBindingSha256,
        dgroupSegment: profile.compiled.dgroupSegment,
        frontier: exact,
        bindings,
      },
    });
    const runProbe = dependencies.runProbe ?? runReadOnlyProbe;
    const outcome = await runProbe({
      workspaceRoot,
      profile,
      queryManifestPath: compiledEvidence.probe.binaryPath,
      rawPath: join(actionRoot, "probe.raw"),
      actionRoot,
    });
    const initializedValues = compiledInitializerValues(compiledEvidence.compiledPath.symbols);
    const probeRequested = compiledEvidence.compiledPath.symbols
      .filter((symbol) => symbol.capture?.status === "probe-required")
      .filter((symbol) => symbol.initializedValue === null)
      .map((symbol) => ({
        name: symbol.name,
        valueType: symbol.valueType,
        bytes: symbol.bytes,
        offset: symbol.linkedAddress.offset,
      }));
    const retainedRequested = compiledEvidence.compiledPath.symbols
      .filter((symbol) => symbol.capture?.status === "retained")
      .filter((symbol) => symbol.initializedValue === null)
      .map((symbol) => ({
        name: symbol.name,
        valueType: symbol.valueType,
        bytes: symbol.bytes,
        offset: symbol.linkedAddress.offset,
      }));
    const unowned = compiledEvidence.compiledPath.symbols.filter((symbol) => (
      symbol.initializedValue === null
      && symbol.capture?.status !== "probe-required"
      && symbol.capture?.status !== "retained"
    ));
    if (unowned.length > 0) {
      throw new CompiledPathInspectorError(
        "compiled-runtime-read-unowned",
        "Compiled symbols must be owned by retained or probe evidence.",
        { symbols: unowned.map(({ name, capture }) => ({ name, capture })) },
      );
    }
    const decodedProbe = decodeCssorawValues(
      await readFile(outcome.rawPath),
      exact.activeTick,
      probeRequested,
    );
    const retainedRawPath = resolveInputPath(workspaceRoot, profile.retained.nativeRawPath);
    const decodedRetained = retainedRequested.length === 0
      ? null
      : decodeCssorawValues(
        await readFile(retainedRawPath),
        exact.activeTick,
        retainedRequested,
      );
    runtime = {
      authority: "diagnostic-native-read",
      parityAuthority: false,
      mode: "read-only",
      activeTick: exact.activeTick,
      values: [
        ...initializedValues,
        ...(decodedRetained?.values ?? []),
        ...decodedProbe.values,
      ],
      rawPath: outcome.rawPath,
      rawSha256: decodedProbe.rawSha256,
      recordCount: decodedProbe.recordCount,
      retainedRawPath: decodedRetained ? retainedRawPath : null,
      retainedRawSha256: decodedRetained?.rawSha256 ?? null,
      retainedRecordCount: decodedRetained?.recordCount ?? null,
      process: outcome.process,
      qualification: {
        status: "diagnostic-only",
        reason: "The query transport preserves the default capture path but is not the retained parity transport binding.",
      },
    };
  } else {
    const initializedValues = compiledInitializerValues(compiledEvidence.compiledPath.symbols);
    const requested = compiledEvidence.compiledPath.symbols
      .filter((symbol) => symbol.initializedValue === null)
      .map((symbol) => ({
      name: symbol.name,
      valueType: symbol.valueType,
      bytes: symbol.bytes,
      offset: symbol.linkedAddress.offset,
    }));
    const decoded = requested.length === 0
      ? null
      : decodeCssorawValues(
        await readFile(resolveInputPath(workspaceRoot, profile.retained.nativeRawPath)),
        exact.activeTick,
        requested,
      );
    const compiledOnly = requested.length === 0;
    runtime = {
      authority: compiledOnly ? "bound-watcom-initializer" : "retained-native-and-watcom",
      parityAuthority: true,
      mode: compiledOnly ? "compiled-read" : "retained-read",
      activeTick: exact.activeTick,
      values: [...initializedValues, ...(decoded?.values ?? [])],
      rawPath: compiledOnly ? null : resolveInputPath(workspaceRoot, profile.retained.nativeRawPath),
      rawSha256: decoded?.rawSha256 ?? null,
      recordCount: decoded?.recordCount ?? null,
      process: null,
      qualification: compiledOnly
        ? { status: "compiled-initializer", immutableWithinObject: true }
        : { status: "retained" },
    };
  }

  const actionPath = join(actionRoot, "action.json");
  const hotPacket = {
    schema: CURRENT_COMPILED_PATH_ACTION_SCHEMA,
    status: "complete",
    actionId,
    exact,
    request: {
      function: baseQuery.function,
      object: objectName,
      symbols,
    },
    compiled: compiledEvidence.hotPacket.compiled,
    symbols: compiledEvidence.hotPacket.symbols.map((symbol) => ({
      ...symbol,
      runtime: runtime.values.find(({ name }) => name === symbol.name) ?? null,
    })),
    runtime: {
      authority: runtime.authority,
      parityAuthority: runtime.parityAuthority,
      mode: runtime.mode,
      activeTick: runtime.activeTick,
      qualification: runtime.qualification,
    },
    evidencePath: actionPath,
    nextAction: "Use this native evidence only to resolve the checked producer; submit any runtime change through the public evaluator.",
  };
  const actionEvidence = {
    ...hotPacket,
    profilePath,
    compiledEvidencePath: compiledEvidence.evidencePath,
    runtime,
    bindings,
  };
  await atomicWrite(actionPath, `${JSON.stringify(actionEvidence, null, 2)}\n`);
  return hotPacket;
}

function compiledInitializerValues(symbols) {
  return symbols.flatMap((symbol) => symbol.initializedValue === null ? [] : [{
    name: symbol.name,
    valueType: symbol.valueType,
    value: symbol.initializedValue.value,
    numericBits: symbol.initializedValue.numericBits,
    offset: symbol.linkedAddress.offset,
    offsetHex: symbol.linkedAddress.offsetHex,
    objectOffset: symbol.initializedValue.objectOffset,
    objectOffsetHex: symbol.initializedValue.objectOffsetHex,
  }]);
}

export function decodeCssorawValues(buffer, activeTick, requested) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) {
    throw new CompiledPathInspectorError("probe-raw-short", "CSSORAW2 evidence is shorter than its header.");
  }
  if (buffer.subarray(0, 8).toString("latin1") !== "CSSORAW2") {
    throw new CompiledPathInspectorError("probe-raw-magic", "Probe evidence does not use CSSORAW2.");
  }
  const version = buffer.readUInt32LE(8);
  const rangeCount = buffer.readUInt32LE(12);
  if (version !== 2 || rangeCount === 0 || rangeCount > 64) {
    throw new CompiledPathInspectorError(
      "probe-raw-header",
      "CSSORAW2 version or range count is invalid.",
      { version, rangeCount },
    );
  }
  let cursor = 16;
  let payloadBase = 0;
  const ranges = [];
  for (let index = 0; index < rangeCount; index += 1) {
    if (cursor + 8 > buffer.length) {
      throw new CompiledPathInspectorError("probe-raw-ranges", "CSSORAW2 range table is truncated.");
    }
    const offset = buffer.readUInt32LE(cursor);
    const bytes = buffer.readUInt32LE(cursor + 4);
    if (bytes === 0 || offset + bytes > 0x1_0000_0000) {
      throw new CompiledPathInspectorError("probe-raw-range", `CSSORAW2 range ${index} is invalid.`);
    }
    ranges.push({ offset, bytes, endExclusive: offset + bytes, payloadBase });
    payloadBase += bytes;
    cursor += 8;
  }
  const recordBytes = 28 + payloadBase;
  if (recordBytes <= 28 || (buffer.length - cursor) % recordBytes !== 0) {
    throw new CompiledPathInspectorError("probe-raw-length", "CSSORAW2 records do not match the range table.");
  }
  const recordCount = (buffer.length - cursor) / recordBytes;
  let selectedOffset = -1;
  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = cursor + index * recordBytes;
    const tick = buffer.readUInt32LE(recordOffset + 20);
    const flags = buffer.readUInt32LE(recordOffset + 24);
    if ((flags & 1) !== 0 && tick === activeTick) selectedOffset = recordOffset;
  }
  if (selectedOffset < 0) {
    throw new CompiledPathInspectorError(
      "probe-raw-frontier-missing",
      `CSSORAW2 evidence has no active record for retained tick ${activeTick}.`,
      { activeTick, recordCount },
    );
  }
  const values = requested.map((request) => {
    const range = ranges.find(({ offset, endExclusive }) => (
      request.offset >= offset && request.offset + request.bytes <= endExclusive
    ));
    if (!range) {
      throw new CompiledPathInspectorError(
        "probe-raw-symbol-missing",
        `CSSORAW2 evidence does not contain ${request.name}.`,
        { symbol: request.name, offset: request.offset, bytes: request.bytes },
      );
    }
    const valueOffset = selectedOffset + 28 + range.payloadBase + request.offset - range.offset;
    return decodeTypedValue(buffer, valueOffset, request);
  });
  return {
    activeTick,
    recordCount,
    values,
    rawSha256: sha256(buffer),
  };
}

async function runReadOnlyProbe({ workspaceRoot, profile, queryManifestPath, rawPath, actionRoot }) {
  const queryTransportPath = resolveInputPath(workspaceRoot, profile.probe.queryTransport.path);
  const queryTransport = await fileEvidence(queryTransportPath);
  if (queryTransport.sha256 !== profile.probe.queryTransport.sha256) {
    throw new CompiledPathInspectorError(
      "query-transport-drift",
      "Read-only query transport no longer matches the retained diagnostic profile.",
    );
  }
  const templateRoot = resolveInputPath(workspaceRoot, profile.probe.templateStageRoot);
  await verifyStageTemplate(templateRoot, profile.probe.stage);
  const runStage = join(actionRoot, `stage-${process.pid}`);
  await cp(templateRoot, runStage, { recursive: true });
  const oracleContract = JSON.parse(await readFile(join(workspaceRoot, "references", "actua-soccer-oracle.json"), "utf8"));
  const fixtureContract = JSON.parse(await readFile(join(workspaceRoot, "references", "spain-argentina-match.json"), "utf8"));
  const dosRoot = join(runStage, "EURO96");
  const probeLogPath = join(dosRoot, "GAME", "PROBE.LOG");
  const launch = oracleContract.runner.launch;
  const programArguments = fixtureContract.oracle.capture.launch.arguments;
  const args = [
    "-defaultconf",
    "-defaultmapper",
    "-silent",
    "-nogui",
    "-nomenu",
    "-fastlaunch",
    "-set",
    `dosbox quit warning=${launch.dos.quitWarning}`,
    "-set",
    `dos mcb corruption becomes application free memory=${launch.dos.repairMcbCorruption}`,
    "-set",
    `dos minimum mcb segment=${launch.dos.minimumMcbSegment}`,
    "-set",
    `cpu core=${launch.cpuCore}`,
    "-set",
    `cpu cycles=${launch.cpuCycles}`,
    "-c",
    `mount c "${dosRoot}"`,
    "-c",
    "c:",
    "-c",
    "cd GAME",
    "-c",
    `${fixtureContract.source.executable} ${programArguments.join(" ")} > PROBE.LOG`,
    "-c",
    "exit",
  ];
  const startedAt = Date.now();
  try {
    const outcome = await runMonitoredProbeProcess(queryTransportPath, args, {
      cwd: workspaceRoot,
      maxBuffer: 16 * 1024 * 1024,
      logPath: probeLogPath,
      timeoutMilliseconds: PROBE_TIMEOUT_MILLISECONDS,
      pollMilliseconds: PROBE_LOG_POLL_MILLISECONDS,
      killGraceMilliseconds: PROBE_KILL_GRACE_MILLISECONDS,
      env: {
        ...process.env,
        SDL_VIDEODRIVER: "dummy",
        SDL_AUDIODRIVER: "dummy",
        CSSOCCER_ORACLE_RAW: rawPath,
        CSSOCCER_ORACLE_QUERY: queryManifestPath,
        CSSOCCER_ORACLE_FRAMES: "0",
        CSSOCCER_ORACLE_STOP_TICK: "",
        CSSOCCER_ORACLE_TRACE_RNG: "0",
        CSSOCCER_ORACLE_TRACE_RUN: "0",
        CSSOCCER_ORACLE_WATCH_WRITES: "0",
      },
    });
    if (!/CSSOCCER_QUERY ready/u.test(outcome.stderr)) {
      throw new CompiledPathInspectorError(
        "query-transport-not-active",
        "Diagnostic transport did not acknowledge the read-only CSSQRY1 manifest.",
      );
    }
    const raw = await stat(rawPath);
    if (!raw.isFile() || raw.size <= 16) {
      throw new CompiledPathInspectorError("probe-raw-missing", "Read-only query produced no CSSORAW2 evidence.");
    }
    return {
      rawPath,
      process: {
        exitCode: 0,
        wallMilliseconds: Date.now() - startedAt,
        stdoutSha256: sha256(Buffer.from(outcome.stdout)),
        stderrSha256: sha256(Buffer.from(outcome.stderr)),
      },
    };
  } finally {
    await rm(runStage, { recursive: true, force: true });
  }
}

export function classifyNativeProbeLog(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  const markers = [
    { kind: "dos4gw-error", pattern: /DOS\/4GW error[^\r\n]*/iu },
    { kind: "general-protection-fault", pattern: /general protection fault[^\r\n]*/iu },
    { kind: "watcom-runtime-error", pattern: /run-time error R\d+[^\r\n]*/iu },
  ];
  for (const { kind, pattern } of markers) {
    const match = pattern.exec(text);
    if (!match) continue;
    const lines = text.split(/\r?\n/u);
    const markerLine = lines.findIndex((line) => line.includes(match[0]));
    const excerpt = lines
      .slice(Math.max(0, markerLine - 2), Math.min(lines.length, markerLine + 3))
      .join("\n")
      .slice(0, 2048);
    return { kind, marker: match[0].slice(0, 512), excerpt };
  }
  return null;
}

export async function runMonitoredProbeProcess(command, args, options) {
  const {
    logPath,
    timeoutMilliseconds = PROBE_TIMEOUT_MILLISECONDS,
    pollMilliseconds = PROBE_LOG_POLL_MILLISECONDS,
    killGraceMilliseconds = PROBE_KILL_GRACE_MILLISECONDS,
    ...processOptions
  } = options;
  if (typeof logPath !== "string" || logPath.length === 0) {
    throw new TypeError("Monitored native probe requires a log path.");
  }
  const startedAt = Date.now();
  let latestLog = "";
  let stopReason = null;
  let polling = false;

  return new Promise((resolveProcess, rejectProcess) => {
    let timeout = null;
    let poll = null;
    let forceKill = null;
    let finished = false;

    const child = execFile(command, args, processOptions, (error, stdout = "", stderr = "") => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      clearInterval(poll);
      clearTimeout(forceKill);
      void (async () => {
        try {
          latestLog = await readFile(logPath, "utf8");
        } catch (readError) {
          if (readError?.code !== "ENOENT") latestLog = latestLog || String(readError);
        }
        const crash = classifyNativeProbeLog(latestLog);
        if (crash) stopReason = { type: "crash", crash };
        const processEvidence = {
          wallMilliseconds: Date.now() - startedAt,
          exitCode: child.exitCode,
          signalCode: child.signalCode,
        };
        if (stopReason?.type === "crash") {
          rejectProcess(new CompiledPathInspectorError(
            "query-native-crash",
            `Read-only native query crashed: ${stopReason.crash.marker}`,
            { ...processEvidence, ...stopReason.crash },
          ));
          return;
        }
        if (stopReason?.type === "timeout") {
          rejectProcess(new CompiledPathInspectorError(
            "query-transport-timeout",
            `Read-only native query exceeded ${timeoutMilliseconds}ms and was terminated.`,
            processEvidence,
          ));
          return;
        }
        if (error) {
          rejectProcess(new CompiledPathInspectorError(
            "query-transport-process",
            `Read-only native query process failed: ${error.message}`,
            { ...processEvidence, processCode: error.code ?? null },
          ));
          return;
        }
        resolveProcess({ stdout, stderr });
      })();
    });

    const requestStop = (reason) => {
      if (stopReason || finished || child.exitCode !== null || child.signalCode !== null) return;
      stopReason = reason;
      clearInterval(poll);
      child.kill("SIGTERM");
      forceKill = setTimeout(() => {
        if (!finished && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      }, killGraceMilliseconds);
    };

    poll = setInterval(() => {
      if (polling || finished || stopReason) return;
      polling = true;
      void readFile(logPath, "utf8")
        .then((text) => {
          latestLog = text;
          const crash = classifyNativeProbeLog(text);
          if (crash) requestStop({ type: "crash", crash });
        })
        .catch((error) => {
          if (error?.code !== "ENOENT") latestLog = String(error);
        })
        .finally(() => {
          polling = false;
        });
    }, pollMilliseconds);
    timeout = setTimeout(() => requestStop({ type: "timeout" }), timeoutMilliseconds);
  });
}

async function loadRetainedContext(workspaceRoot, profile = null) {
  const paths = {
    differentialRoot: resolveInputPath(
      workspaceRoot,
      profile?.retained?.differentialRoot ?? ".local/cssoccer/parity/differential/current",
    ),
    nativeCurrentPath: resolveInputPath(
      workspaceRoot,
      profile?.retained?.nativeCurrentPath ?? ".local/cssoccer/oracle/native/current.json",
    ),
    nativeProfilePath: resolveInputPath(
      workspaceRoot,
      profile?.retained?.nativeProfilePath
        ?? ".local/cssoccer/oracle/native/retained/runs/canonical-a/profile.json",
    ),
    nativeScenarioPath: resolveInputPath(
      workspaceRoot,
      profile?.retained?.nativeScenarioPath
        ?? ".local/cssoccer/oracle/native/retained/runs/canonical-a/scenario.json",
    ),
    nativeRawPath: resolveInputPath(
      workspaceRoot,
      profile?.retained?.nativeRawPath
        ?? ".local/cssoccer/oracle/native/retained/runs/canonical-a/native.raw",
    ),
  };
  const manifestPath = join(paths.differentialRoot, "current.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const selectedScenarioId = manifest.scenarioCatalog?.selectedScenarioId;
  const scenarioBinding = manifest.scenarioBindings?.find(({ scenarioId }) => scenarioId === selectedScenarioId);
  if (!selectedScenarioId || !scenarioBinding) {
    throw new CompiledPathInspectorError(
      "current-exact-scenario-missing",
      "Current differential bundle has no selected retained scenario.",
    );
  }
  const differentialScenarioPath = join(paths.differentialRoot, scenarioBinding.path);
  const differentialScenarioBytes = await readFile(differentialScenarioPath);
  if (sha256(differentialScenarioBytes) !== scenarioBinding.sha256) {
    throw new CompiledPathInspectorError(
      "current-exact-binding-mismatch",
      "Current differential scenario does not match its manifest binding.",
    );
  }
  const differentialScenario = JSON.parse(differentialScenarioBytes.toString("utf8"));
  const exact = differentialScenario.data?.adapter?.typedExact?.earliestMismatch;
  const engineIndependence = differentialScenario.data?.adapter?.engineIndependence;
  if (!exact) {
    throw new CompiledPathInspectorError("current-exact-complete", "Current differential scenario has no mismatch.");
  }
  if (engineIndependence?.status !== "pass" || engineIndependence.check?.status !== "pass") {
    throw new CompiledPathInspectorError(
      "zero-substitution-qualification-gap",
      "Current runtime snapshot lacks a passing engine-independence qualification.",
    );
  }
  const [nativeCurrent, nativeProfile, nativeScenario, oracleContract] = await Promise.all([
    readJson(paths.nativeCurrentPath),
    readJson(paths.nativeProfilePath),
    readJson(paths.nativeScenarioPath),
    readJson(join(workspaceRoot, "references", "actua-soccer-oracle.json")),
  ]);
  if (nativeCurrent.status !== "pass") {
    throw new CompiledPathInspectorError("current-native-invalid", "Retained native capture is not passing.");
  }
  const canonicalArtifacts = nativeCurrent.canonical?.runs?.["canonical-a"]?.artifacts;
  if (!canonicalArtifacts?.profile?.sha256
    || !canonicalArtifacts?.scenario?.sha256
    || !canonicalArtifacts?.raw?.sha256) {
    throw new CompiledPathInspectorError(
      "current-native-artifacts-missing",
      "Retained native capture does not bind its canonical profile, scenario, and raw evidence.",
    );
  }
  const retainedArtifacts = await Promise.all([
    fileEvidence(paths.nativeProfilePath),
    fileEvidence(paths.nativeScenarioPath),
    fileEvidence(paths.nativeRawPath),
  ]);
  const expectedArtifactHashes = [
    canonicalArtifacts.profile.sha256,
    canonicalArtifacts.scenario.sha256,
    canonicalArtifacts.raw.sha256,
  ];
  for (const [index, artifact] of retainedArtifacts.entries()) {
    if (artifact.sha256 !== expectedArtifactHashes[index]) {
      throw new CompiledPathInspectorError(
        "current-native-artifact-drift",
        "Retained native profile, scenario, or raw evidence does not match native/current.json.",
        { path: artifact.path, expected: expectedArtifactHashes[index], actual: artifact.sha256 },
      );
    }
  }
  const catalog = manifest.scenarioCatalog.scenarios.find(({ id }) => id === selectedScenarioId);
  const expected = {
    scenarioSha256: nativeCurrent.bindings.scenarioSha256,
    profileSha256: nativeCurrent.bindings.profileSha256,
    inputSha256: nativeCurrent.bindings.inputSha256,
    contractSha256: nativeCurrent.bindings.contractSha256,
  };
  const actual = {
    scenarioSha256: engineIndependence.bindings?.scenarioSha256,
    profileSha256: engineIndependence.bindings?.profileSha256,
    inputSha256: engineIndependence.bindings?.inputSha256,
    contractSha256: engineIndependence.bindings?.contractSha256,
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)
    || catalog?.profileSha256 !== expected.profileSha256
    || catalog?.replaySha256 !== expected.inputSha256
    || catalog?.contractSha256 !== differentialScenario.data.adapter.typedExact.fieldSelection.comparisonContractSha256) {
    throw new CompiledPathInspectorError(
      "current-retained-binding-mismatch",
      "Current Exact, engine qualification, and native capture bindings do not agree.",
      { expected, actual },
    );
  }
  if (profile) verifyProfileContext(profile, { nativeCurrent, nativeProfile, nativeScenario });
  return {
    paths,
    manifest,
    differentialScenario,
    nativeCurrent,
    nativeProfile,
    nativeScenario,
    oracleContract,
    exact: {
      activeTick: exact.tick,
      phase: exact.phase,
      phaseOrder: exact.phaseOrder,
      field: exact.fieldId,
      fieldLabel: exact.fieldLabel,
      reason: exact.reason,
      reference: exact.reference,
      candidate: exact.candidate,
      scenarioId: selectedScenarioId,
      scenarioSha256: nativeCurrent.bindings.scenarioSha256,
      exactScenarioSha256: scenarioBinding.sha256,
    },
  };
}

async function discoverCompiledBuild({ workspaceRoot, oracleContract, captureRanges }) {
  const oracleRoot = join(workspaceRoot, ".local", "cssoccer", "oracle");
  const entries = await readdir(oracleRoot, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^runner-build-\d+$/u.test(entry.name)) continue;
    const root = join(oracleRoot, entry.name);
    const files = await readdir(root, { withFileTypes: true });
    const executables = files.filter((file) => file.isFile() && /\.exe$/iu.test(file.name));
    const matches = [];
    for (const executable of executables) {
      const evidence = await fileEvidence(join(root, executable.name));
      if (evidence.sha256 === oracleContract.runner.patchedExecutableSha256) matches.push(evidence);
    }
    if (matches.length === 1 && existsSync(join(root, "TEST.MAP"))) {
      candidates.push({ root, executable: matches[0] });
    }
  }
  if (candidates.length !== 1) {
    throw new CompiledPathInspectorError(
      "compiled-build-ambiguous",
      `Expected one runner build bound to ${oracleContract.runner.patchedExecutableSha256}; found ${candidates.length}.`,
      { roots: candidates.map(({ root }) => root) },
    );
  }
  const [{ root, executable }] = candidates;
  const map = await fileEvidence(join(root, "TEST.MAP"));
  const mapEntries = parseWatcomMap(await readFile(map.path, "latin1"));
  const dgroupSegment = inferDgroupSegment(mapEntries, captureRanges);
  const files = await readdir(root, { withFileTypes: true });
  const objects = {};
  for (const entry of files.filter((file) => file.isFile() && /\.obj$/iu.test(file.name))) {
    const name = entry.name.replace(/\.obj$/iu, "").toUpperCase();
    if (objects[name]) continue;
    const evidence = await fileEvidence(join(root, entry.name));
    objects[name] = {
      path: relativeOrAbsolute(workspaceRoot, evidence.path),
      bytes: evidence.bytes,
      sha256: evidence.sha256,
      compiledArtifactBindingSha256: sha256Canonical({
        schema: "cssoccer-compiled-artifact-binding@1",
        objectSha256: evidence.sha256,
        mapSha256: map.sha256,
        executableSha256: executable.sha256,
      }),
    };
  }
  if (Object.keys(objects).length === 0) {
    throw new CompiledPathInspectorError("compiled-build-objects-missing", "Bound runner build contains no objects.");
  }
  return {
    root,
    map: { ...map, path: relativeOrAbsolute(workspaceRoot, map.path) },
    executable: { ...executable, path: relativeOrAbsolute(workspaceRoot, executable.path) },
    dgroupSegment,
    objects,
  };
}

function inferDgroupSegment(entries, captureRanges) {
  const counts = new Map();
  for (const entry of entries) {
    if (!captureRanges.some(({ offset, bytes }) => entry.offset >= offset && entry.offset < offset + bytes)) continue;
    counts.set(entry.segment, (counts.get(entry.segment) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  if (ranked.length === 0 || (ranked[1] && ranked[0][1] === ranked[1][1])) {
    throw new CompiledPathInspectorError(
      "compiled-dgroup-ambiguous",
      "Could not infer one Watcom DGROUP segment from retained capture ranges.",
      { counts: Object.fromEntries(ranked) },
    );
  }
  return ranked[0][0];
}

async function verifyStageTemplate(stageRoot, nativeProfile) {
  const gameRoot = join(stageRoot, "EURO96", "GAME");
  const scriptRoot = join(stageRoot, "EURO96", "SCRIPT");
  const executable = await fileEvidence(join(gameRoot, "TEST.EXE"));
  const gameScript = await fileEvidence(join(gameRoot, "SCRIPT.96"));
  const sharedScript = await fileEvidence(join(scriptRoot, "SCRIPT.96"));
  const expectedExecutable = nativeProfile.binding?.executableSha256 ?? nativeProfile.executableSha256;
  const expectedScript = nativeProfile.binding?.scriptSha256 ?? nativeProfile.scriptSha256;
  if (executable.sha256 !== expectedExecutable
    || gameScript.sha256 !== expectedScript
    || sharedScript.sha256 !== expectedScript) {
    throw new CompiledPathInspectorError(
      "compiled-stage-binding-mismatch",
      "Native probe stage does not match the retained capture profile.",
      {
        executable: { expected: expectedExecutable ?? null, actual: executable.sha256 },
        gameScript: { expected: expectedScript ?? null, actual: gameScript.sha256 },
        sharedScript: { expected: expectedScript ?? null, actual: sharedScript.sha256 },
      },
    );
  }
  const sourceArtifacts = {};
  for (const [path, expectedSha256] of Object.entries(nativeProfile.sourceArtifacts ?? {})) {
    if (path === "TEST.EXE" || path === "SCRIPT.96") continue;
    const artifact = await fileEvidence(join(gameRoot, path));
    if (artifact.sha256 !== expectedSha256) {
      throw new CompiledPathInspectorError(
        "compiled-stage-source-drift",
        `Native probe stage source artifact ${path} is not retained-exact.`,
        { path, expected: expectedSha256, actual: artifact.sha256 },
      );
    }
    sourceArtifacts[path] = artifact.sha256;
  }
  return {
    executableSha256: executable.sha256,
    scriptSha256: gameScript.sha256,
    gameScriptSha256: gameScript.sha256,
    sharedScriptSha256: sharedScript.sha256,
    sourceArtifacts,
  };
}

async function verifyCurrentProfileArtifacts({ workspaceRoot, profile, object }) {
  const checks = [
    [profile.compiled.map, "linked map"],
    [profile.compiled.executable, "linked executable"],
    [object, "Watcom object"],
    [profile.probe.queryTransport, "query transport"],
  ];
  for (const [expected, label] of checks) {
    const actual = await fileEvidence(resolveInputPath(workspaceRoot, expected.path));
    if (actual.sha256 !== expected.sha256) {
      throw new CompiledPathInspectorError(
        "current-profile-artifact-drift",
        `${label} no longer matches the current compiled-path profile.`,
        { label, expected: expected.sha256, actual: actual.sha256 },
      );
    }
  }
}

function currentProbeBindings(context) {
  const scenarioBinding = context.nativeScenario.binding;
  return {
    sourceRevision: context.nativeScenario.sourceRevision,
    scenarioSha256: context.nativeCurrent.bindings.scenarioSha256,
    inputSha256: context.nativeCurrent.bindings.inputSha256,
    seedSha256: scenarioBinding.seedSha256,
    timestepSha256: scenarioBinding.timingSha256,
    fieldContractSha256: context.nativeCurrent.bindings.contractSha256,
    nativeProfileSha256: context.nativeCurrent.bindings.profileSha256,
    nativeBuildSha256: context.nativeCurrent.bindings.buildSha256,
    exactScenarioSha256: context.exact.exactScenarioSha256,
  };
}

function verifyProfileContext(profile, { nativeCurrent, nativeProfile, nativeScenario }) {
  const expected = profile.workspace;
  const actual = {
    sourceRevision: nativeScenario.sourceRevision,
    scenarioSha256: nativeCurrent.bindings.scenarioSha256,
    profileSha256: nativeCurrent.bindings.profileSha256,
    inputSha256: nativeCurrent.bindings.inputSha256,
    fieldContractSha256: nativeCurrent.bindings.contractSha256,
    nativeBuildSha256: nativeCurrent.bindings.buildSha256,
  };
  for (const [key, value] of Object.entries(actual)) {
    if (expected[key] !== value) {
      throw new CompiledPathInspectorError(
        "current-profile-stale",
        `Current compiled-path profile is stale at ${key}.`,
        { key, expected: expected[key] ?? null, actual: value },
      );
    }
  }
  if (nativeProfile.profileSha256 !== actual.profileSha256) {
    throw new CompiledPathInspectorError("current-native-profile-mismatch", "Native profile binding is inconsistent.");
  }
}

function requireProfile(profile, profilePath) {
  if (!profile || profile.schema !== CURRENT_COMPILED_PATH_PROFILE_SCHEMA) {
    throw new CompiledPathInspectorError(
      "current-profile-invalid",
      `Compiled-path profile must use ${CURRENT_COMPILED_PATH_PROFILE_SCHEMA}.`,
      { profilePath },
    );
  }
}

function decodeTypedValue(buffer, offset, request) {
  const raw = buffer.subarray(offset, offset + request.bytes);
  const bits = [...raw].reverse().map((byte) => byte.toString(16).padStart(2, "0")).join("");
  let value;
  switch (request.valueType) {
    case "i8": value = buffer.readInt8(offset); break;
    case "u8": value = buffer.readUInt8(offset); break;
    case "i16": value = buffer.readInt16LE(offset); break;
    case "u16": value = buffer.readUInt16LE(offset); break;
    case "i32": value = buffer.readInt32LE(offset); break;
    case "u32": value = buffer.readUInt32LE(offset); break;
    case "f32": value = buffer.readFloatLE(offset); break;
    case "f64": value = buffer.readDoubleLE(offset); break;
    default: throw new CompiledPathInspectorError(
      "probe-raw-value-type",
      `Unsupported runtime value type ${request.valueType}.`,
    );
  }
  return {
    name: request.name,
    valueType: request.valueType,
    value,
    numericBits: bits,
    offset: request.offset,
    offsetHex: `0x${request.offset.toString(16).padStart(8, "0")}`,
  };
}

function parseArguments(args) {
  const parsed = { symbols: [] };
  const valueOptions = new Map([
    ["--workspace-root", "workspaceRoot"],
    ["--profile", "profilePath"],
    ["--work-root", "workRoot"],
    ["--function", "functionName"],
    ["--object", "objectName"],
    ["--stage-root", "stageRoot"],
    ["--query-transport", "queryTransportPath"],
    ["--transport-evidence", "transportEvidencePath"],
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
      continue;
    }
    if (argument === "--initialize-profile") {
      parsed.initializeProfile = true;
      continue;
    }
    if (argument === "--symbol") {
      const value = args[index + 1];
      if (!value) throw new TypeError("--symbol requires a value.");
      parsed.symbols.push(value);
      index += 1;
      continue;
    }
    const key = valueOptions.get(argument);
    if (!key) throw new TypeError(`Unknown current compiled-path option ${argument}.`);
    const value = args[index + 1];
    if (!value) throw new TypeError(`${argument} requires a value.`);
    parsed[key] = value;
    index += 1;
  }
  if (!parsed.help && !parsed.initializeProfile) {
    requireText(parsed.functionName, "--function");
    requireText(parsed.objectName, "--object");
    if (parsed.symbols.length === 0) throw new TypeError("At least one --symbol is required.");
  }
  if (parsed.initializeProfile) {
    requireText(parsed.stageRoot, "--stage-root");
    requireText(parsed.queryTransportPath, "--query-transport");
    requireText(parsed.transportEvidencePath, "--transport-evidence");
  }
  return parsed;
}

function normalizeSymbols(values) {
  return values.map((value) => {
    const [reference, valueType, ...rest] = value.split(":");
    const match = reference?.match(/^([A-Za-z_?$@][A-Za-z0-9_?$@.]*)(?:\[(\d+)\])?$/u);
    if (!match || rest.length > 0) throw new TypeError(`Invalid --symbol ${value}.`);
    return {
      name: match[1],
      elementIndex: match[2] === undefined ? null : Number(match[2]),
      valueType: valueType || null,
    };
  });
}

function normalizeObjectName(value) {
  const normalized = requireText(value, "--object").replace(/\.obj$/iu, "").toUpperCase();
  if (!/^[A-Z0-9_]+$/u.test(normalized)) throw new TypeError("--object must name one Watcom module.");
  return normalized;
}

function normalizeRunnerExact(value, retained, bindings, expectedBindings) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CompiledPathInspectorError(
      "runner-exact-invalid",
      "The programmatic compiled-path Exact override must be an object.",
    );
  }
  const requiredBindings = [
    "scenarioId",
    "scenarioSha256",
    "profileSha256",
    "inputSha256",
    "buildSha256",
    "contractSha256",
  ];
  if (
    !bindings
    || requiredBindings.some((key) => bindings[key] !== expectedBindings?.[key])
  ) {
    throw new CompiledPathInspectorError(
      "runner-exact-binding-mismatch",
      "The programmatic compiled-path Exact override does not match retained native bindings.",
    );
  }
  const activeTick = value.activeTick ?? value.tick;
  const field = value.field ?? value.fieldId;
  const phase = value.phase;
  const phaseOrder = value.phaseOrder;
  if (
    !Number.isSafeInteger(activeTick)
    || activeTick < 0
    || typeof field !== "string"
    || field.length === 0
    || typeof phase !== "string"
    || !Number.isSafeInteger(phaseOrder)
    || typeof value.reference?.numericBits !== "string"
    || typeof value.candidate?.numericBits !== "string"
  ) {
    throw new CompiledPathInspectorError(
      "runner-exact-invalid",
      "The programmatic compiled-path Exact override is incomplete.",
    );
  }
  return {
    ...retained,
    activeTick,
    phase,
    phaseOrder,
    field,
    fieldLabel: value.fieldLabel ?? field,
    reason: value.reason ?? null,
    reference: value.reference,
    candidate: value.candidate,
  };
}

function resolveProfilePath(workspaceRoot, profilePath) {
  return resolveInputPath(
    workspaceRoot,
    profilePath ?? ".local/cssoccer/compiled-path-inspector/current-profile.json",
  );
}

function resolveInputPath(workspaceRoot, path) {
  if (typeof path !== "string" || path.length === 0) throw new TypeError("Path must be non-empty.");
  return isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path);
}

function relativeOrAbsolute(workspaceRoot, path) {
  const normalized = resolve(path);
  const relativePath = relative(workspaceRoot, normalized);
  return relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath)
    ? relativePath
    : normalized;
}

function requireExistingDirectory(path, label) {
  const absolute = resolve(requireText(path, label));
  if (!existsSync(absolute)) throw new TypeError(`${label} does not exist: ${absolute}`);
  return absolute;
}

function requireExistingFile(path, label) {
  const absolute = resolve(requireText(path, label));
  if (!existsSync(absolute)) throw new TypeError(`${label} does not exist: ${absolute}`);
  return absolute;
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be non-empty text.`);
  return value;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function atomicWrite(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}

function usage() {
  return [
    "Usage:",
    "  node tools/run-compiled-path-check.mjs --function <name> --object <module> --symbol <name[:type]>",
    "  node tools/run-compiled-path-check.mjs --initialize-profile --stage-root <exact-stage> \\",
    "    --query-transport <query-dosbox-x> --transport-evidence <build-evidence.json>",
    "",
    "The public action owns the current Exact tick, retained bindings, compiled artifacts, and short read-only probe.",
    "Never edit oracle capture ranges for a compiled-path question.",
  ].join("\n");
}

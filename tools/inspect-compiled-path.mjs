#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  COMPILED_PATH_EVIDENCE_SCHEMA,
  COMPILED_PATH_QUERY_SCHEMA,
  CompiledPathInspectorError,
  analyzeWatcomRoutine,
  canonicalJson,
  createProbeManifest,
  encodeProbeManifest,
  fileEvidence,
  inferMapValueType,
  locateCaptureCoverage,
  normalizeCaptureRanges,
  parseWatcomMap,
  parseWatcomRoutine,
  selectWatcomMapSymbol,
  sha256,
  sha256Canonical,
  valueAtJsonPath,
  valueTypeBytes,
  verifyExpectedArtifact,
} from "./compiled-path-inspector-core.mjs";

const execute = promisify(execFile);
const toolRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}

async function main(args) {
  let options;
  try {
    options = parseArguments(args);
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    const query = await loadQuery(options);
    const evidence = await inspectCompiledPath(query, options);
    process.stdout.write(`${JSON.stringify(evidence.hotPacket, null, 2)}\n`);
    process.stderr.write(`Retained evidence: ${evidence.evidencePath}\n`);
  } catch (error) {
    const failure = {
      schema: "cssoccer-compiled-path-failure@1",
      status: "tool-gap",
      code: error instanceof CompiledPathInspectorError ? error.code : "unexpected-error",
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof CompiledPathInspectorError && error.details !== undefined
        ? { details: error.details }
        : {}),
    };
    process.stderr.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 1;
  }
}

export async function inspectCompiledPath(queryInput, cliOptions = {}) {
  const query = normalizeQuery(queryInput, cliOptions);
  const workspaceRoot = query.workspaceRoot;
  const workRoot = query.workRoot;
  await mkdir(workRoot, { recursive: true });

  const objectPath = resolveInputPath(workspaceRoot, query.object.path);
  const mapPath = resolveInputPath(workspaceRoot, query.map.path);
  const [objectArtifact, mapArtifact, mapText] = await Promise.all([
    fileEvidence(objectPath),
    fileEvidence(mapPath),
    readFile(mapPath, "latin1"),
  ]);
  const objectBinding = verifyOptionalExpected(objectArtifact, query.object.expectedSha256, "Watcom object");
  const mapBinding = verifyOptionalExpected(mapArtifact, query.map.expectedSha256, "linked map");
  const listing = await ensureWatcomListing({
    query,
    workspaceRoot,
    workRoot,
    objectPath,
    objectArtifact,
  });
  const listingText = await readFile(listing.path, "latin1");
  const routine = parseWatcomRoutine(listingText, query.function);
  const analysis = analyzeWatcomRoutine(routine, query.symbols);
  const mapEntries = parseWatcomMap(mapText);
  const functionMap = selectWatcomMapSymbol(mapEntries, query.function);

  const capture = await loadCapture(query, workspaceRoot);
  const symbols = analysis.symbols.map((request) => {
    if (!request.referenced) {
      throw new CompiledPathInspectorError(
        "compiled-symbol-not-referenced",
        `${query.function} does not reference requested symbol ${request.name}.`,
        { function: query.function, symbol: request.name },
      );
    }
    const mapped = selectWatcomMapSymbol(mapEntries, request.name);
    const inferredValueType = inferMapValueType(mapped.declaration);
    const valueType = request.valueType ?? inferredValueType;
    if (!valueType) {
      throw new CompiledPathInspectorError(
        "compiled-symbol-type-unknown",
        `Value type for ${request.name} cannot be inferred from the linked map.`,
        { symbol: request.name, declaration: mapped.declaration },
      );
    }
    if (request.valueType && inferredValueType && request.valueType !== inferredValueType) {
      throw new CompiledPathInspectorError(
        "compiled-symbol-type-mismatch",
        `Requested type ${request.valueType} for ${request.name} conflicts with linked-map type ${inferredValueType}.`,
        { symbol: request.name, requested: request.valueType, mapped: inferredValueType },
      );
    }
    const bytes = valueTypeBytes(valueType);
    const coverage = capture
      ? locateCaptureCoverage({ offset: mapped.offset, bytes, ranges: capture.ranges })
      : { status: "not-checked" };
    return deepFreeze({
      name: request.name,
      valueType,
      bytes,
      referenced: true,
      references: request.references,
      nextF32Stores: request.nextF32Stores,
      constantWrites: request.constantWrites,
      linkedAddress: {
        segment: mapped.segment,
        offset: mapped.offset,
        offsetHex: hex32(mapped.offset),
        declaration: mapped.declaration,
        mapLine: mapped.line,
      },
      capture: coverage,
    });
  }).sort((left, right) => left.linkedAddress.offset - right.linkedAddress.offset);

  const executable = await loadExecutable(query, workspaceRoot);
  const compiledArtifactBindingSha256 = executable
    ? sha256Canonical({
      schema: "cssoccer-compiled-artifact-binding@1",
      objectSha256: objectArtifact.sha256,
      mapSha256: mapArtifact.sha256,
      executableSha256: executable.artifact.sha256,
    })
    : null;
  const artifactBindingStatus = summarizeArtifactBinding({
    objectBinding,
    mapBinding,
    executableBinding: executable?.binding ?? null,
    listingBinding: listing.binding,
  });
  const queryId = sha256Canonical({
    schema: query.schema,
    function: query.function,
    symbols: query.symbols,
    objectSha256: objectArtifact.sha256,
    listingSha256: listing.artifact.sha256,
    mapSha256: mapArtifact.sha256,
    executableSha256: executable?.artifact.sha256 ?? null,
    captureSha256: capture?.artifact.sha256 ?? null,
    probe: query.probe
      ? {
        enabled: Boolean(query.probe.enabled),
        compiledArtifactBindingSha256: query.probe.compiledArtifactBindingSha256 ?? null,
        dgroupSegment: query.probe.dgroupSegment ?? null,
        frontier: query.probe.frontier ?? null,
        bindings: query.probe.bindings ?? null,
      }
      : null,
  }).slice(0, 16);
  const runRoot = join(workRoot, "runs", queryId);
  await mkdir(runRoot, { recursive: true });

  let probe = null;
  const missingSymbols = symbols.filter((symbol) => symbol.capture.status === "probe-required");
  if (query.probe?.enabled) {
    if (!capture) {
      throw new CompiledPathInspectorError(
        "probe-capture-contract-missing",
        "A probe requires the canonical capture contract and ranges path.",
      );
    }
    if (!executable) {
      throw new CompiledPathInspectorError("probe-executable-missing", "A probe requires the exact linked executable.");
    }
    if (missingSymbols.length === 0) {
      throw new CompiledPathInspectorError(
        "probe-not-needed",
        "Every requested symbol is already covered by retained capture ranges.",
      );
    }
    requireBoundArtifact(objectBinding, "Watcom object");
    requireBoundArtifact(mapBinding, "linked map");
    requireBoundArtifact(executable.binding, "linked executable");
    if (!/^[0-9a-f]{64}$/u.test(query.probe.compiledArtifactBindingSha256 ?? "")) {
      throw new CompiledPathInspectorError(
        "probe-compiled-binding-missing",
        "A probe requires the retained profile's object/map/executable binding SHA-256.",
      );
    }
    if (query.probe.compiledArtifactBindingSha256 !== compiledArtifactBindingSha256) {
      throw new CompiledPathInspectorError(
        "probe-compiled-binding-mismatch",
        "Object, linked map, and executable do not match their retained compiled-artifact binding.",
        {
          expectedSha256: query.probe.compiledArtifactBindingSha256,
          actualSha256: compiledArtifactBindingSha256,
        },
      );
    }
    if (listing.binding.status !== "bound") {
      throw new CompiledPathInspectorError(
        "probe-listing-unbound",
        "A probe requires listing evidence generated from or explicitly bound to the exact object.",
      );
    }
    const manifest = createProbeManifest({
      stopActiveTick: query.probe.frontier?.activeTick,
      dgroupSegment: query.probe.dgroupSegment,
      symbols: missingSymbols.map((symbol) => ({
        name: symbol.name,
        valueType: symbol.valueType,
        bytes: symbol.bytes,
        segment: symbol.linkedAddress.segment,
        offset: symbol.linkedAddress.offset,
      })),
      bindings: query.probe.bindings,
      frontier: query.probe.frontier,
      artifactBindings: {
        objectSha256: objectArtifact.sha256,
        listingSha256: listing.artifact.sha256,
        mapSha256: mapArtifact.sha256,
        executableSha256: executable.artifact.sha256,
        compiledArtifactBindingSha256,
        captureContractSha256: capture.artifact.sha256,
      },
    });
    const manifestJsonPath = join(runRoot, "probe.json");
    const manifestBinaryPath = join(runRoot, "probe.cssqry");
    const encoded = encodeProbeManifest(manifest);
    await Promise.all([
      atomicWrite(manifestJsonPath, `${JSON.stringify(manifest, null, 2)}\n`),
      atomicWrite(manifestBinaryPath, encoded),
    ]);
    probe = deepFreeze({
      status: "ready",
      mode: "read-only",
      manifestPath: manifestJsonPath,
      binaryPath: manifestBinaryPath,
      binarySha256: sha256(encoded),
      stopSource: manifest.stop.source,
      readCount: manifest.reads.length,
      totalBytes: manifest.reads.reduce((sum, read) => sum + read.bytes, 0),
      transportEnvironment: {
        CSSOCCER_ORACLE_QUERY: manifestBinaryPath,
      },
    });
  }

  const status = probe
    ? "probe-ready"
    : missingSymbols.length > 0
      ? "probe-required"
      : capture
        ? "retained-range-ready"
        : "compiled-path-ready";
  const nextAction = probe
    ? "Run the emitted read-only manifest through the qualified headless oracle transport."
    : missingSymbols.length > 0
      ? "Provide retained frontier and exact object/map/executable bindings to emit the short read-only probe."
      : "The requested globals are already present in retained capture ranges.";
  const generatedAt = new Date().toISOString();
  const evidencePath = join(runRoot, "evidence.json");
  const hotPacket = deepFreeze({
    schema: "cssoccer-compiled-path-hot-packet@1",
    status,
    queryId,
    function: query.function,
    compiled: {
      objectOffsetHex: hex32(routine.objectOffset),
      linkedOffsetHex: hex32(functionMap.offset),
      instructionCount: analysis.instructionCount,
      x87InstructionCount: analysis.x87InstructionCount,
      f32StoreCount: analysis.f32Stores.length,
      f64StoreCount: analysis.f64Stores.length,
    },
    symbols: symbols.map((symbol) => ({
      name: symbol.name,
      valueType: symbol.valueType,
      address: `${symbol.linkedAddress.segment}:${symbol.linkedAddress.offsetHex}`,
      references: symbol.references.length,
      nextF32Stores: symbol.nextF32Stores.length,
      constantWrites: symbol.constantWrites,
      capture: summarizeCoverage(symbol.capture),
    })),
    artifactBindingStatus,
    probe: probe
      ? {
        status: probe.status,
        mode: probe.mode,
        binaryPath: probe.binaryPath,
        readCount: probe.readCount,
        totalBytes: probe.totalBytes,
      }
      : null,
    nextAction,
  });
  const evidence = deepFreeze({
    schema: COMPILED_PATH_EVIDENCE_SCHEMA,
    status,
    queryId,
    generatedAt,
    workspaceRoot,
    workRoot,
    query: {
      schema: query.schema,
      function: query.function,
      symbols: query.symbols,
      captureRangesPath: query.capture?.rangesPath ?? null,
      probeRequested: Boolean(query.probe?.enabled),
    },
    artifacts: {
      object: objectArtifact,
      listing: listing.artifact,
      map: mapArtifact,
      executable: executable?.artifact ?? null,
      compiledArtifactBindingSha256,
      captureContract: capture?.artifact ?? null,
      disassembler: listing.disassemblerArtifacts,
    },
    artifactBindingStatus,
    compiledPath: {
      function: query.function,
      declaration: routine.declaration,
      objectOffset: routine.objectOffset,
      linkedOffset: functionMap.offset,
      linkedSegment: functionMap.segment,
      declaredBytes: routine.declaredBytes,
      instructionCount: analysis.instructionCount,
      x87InstructionCount: analysis.x87InstructionCount,
      f32Stores: analysis.f32Stores,
      f64Stores: analysis.f64Stores,
      symbols,
    },
    retainedBindings: query.probe?.bindings ?? null,
    frontier: query.probe?.frontier ?? null,
    probe,
    hotPacket,
    evidencePath,
  });
  await atomicWrite(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

async function loadQuery(options) {
  if (options.queryPath) {
    const queryPath = resolve(options.queryPath);
    const query = JSON.parse(await readFile(queryPath, "utf8"));
    if (options.workRoot) query.workRoot = resolve(options.workRoot);
    return query;
  }
  const required = ["function", "objectPath", "mapPath"];
  const missing = required.filter((key) => !options[key]);
  if (missing.length > 0 || options.symbols.length === 0) {
    throw new CompiledPathInspectorError(
      "arguments-missing",
      "Direct inspection needs --function, --object, --map, and at least one --symbol.",
      { missing, symbols: options.symbols.length },
    );
  }
  return {
    schema: COMPILED_PATH_QUERY_SCHEMA,
    workspaceRoot: options.workspaceRoot ?? process.cwd(),
    workRoot: options.workRoot,
    function: options.function,
    object: { path: options.objectPath, expectedSha256: options.expectedObjectSha256 },
    map: { path: options.mapPath, expectedSha256: options.expectedMapSha256 },
    ...(options.listingPath
      ? { listing: { path: options.listingPath, objectSha256: options.listingObjectSha256 } }
      : {}),
    ...(options.executablePath
      ? { executable: { path: options.executablePath, expectedSha256: options.expectedExecutableSha256 } }
      : {}),
    ...(options.captureContractPath
      ? { capture: { contractPath: options.captureContractPath, rangesPath: options.rangesPath } }
      : {}),
    oracleContractPath: options.oracleContractPath,
    symbols: options.symbols,
  };
}

function normalizeQuery(input, cliOptions) {
  if (!isPlainObject(input) || input.schema !== COMPILED_PATH_QUERY_SCHEMA) {
    throw new CompiledPathInspectorError(
      "query-schema-invalid",
      `Compiled-path query must use ${COMPILED_PATH_QUERY_SCHEMA}.`,
    );
  }
  requireText(input.function, "query function");
  requirePathObject(input.object, "query object");
  requirePathObject(input.map, "query map");
  if (!Array.isArray(input.symbols) || input.symbols.length === 0) {
    throw new CompiledPathInspectorError("query-symbols-empty", "Compiled-path query needs at least one symbol.");
  }
  const workspaceRoot = resolve(input.workspaceRoot ?? process.cwd());
  const workRoot = resolve(
    cliOptions.workRoot
      ?? input.workRoot
      ?? join(toolRoot, ".local", "cssoccer", "compiled-path-inspector"),
  );
  return {
    ...input,
    workspaceRoot,
    workRoot,
    symbols: input.symbols.map(normalizeSymbol),
    oracleContractPath: input.oracleContractPath ?? "references/actua-soccer-oracle.json",
  };
}

async function ensureWatcomListing({ query, workspaceRoot, workRoot, objectPath, objectArtifact }) {
  if (query.listing) {
    requirePathObject(query.listing, "query listing");
    if (query.listing.objectSha256 !== objectArtifact.sha256) {
      throw new CompiledPathInspectorError(
        "listing-object-binding-mismatch",
        "Provided Watcom listing is not bound to the exact object SHA-256.",
        { expected: objectArtifact.sha256, actual: query.listing.objectSha256 ?? null },
      );
    }
    const path = resolveInputPath(workspaceRoot, query.listing.path);
    const artifact = await fileEvidence(path);
    const binding = verifyOptionalExpected(artifact, query.listing.expectedSha256, "Watcom listing");
    return {
      path,
      artifact,
      binding: { ...binding, source: "query", objectSha256: objectArtifact.sha256 },
      disassemblerArtifacts: null,
    };
  }

  const contractPath = resolveInputPath(workspaceRoot, query.oracleContractPath);
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const runner = contract.runner;
  const disassembler = runner?.tools?.openWatcomDisassembler;
  const dosbox = runner?.tools?.dosboxX;
  if (!disassembler?.path || !dosbox?.path || !contract.checkout) {
    throw new CompiledPathInspectorError(
      "disassembler-contract-missing",
      "Oracle contract does not declare DOSBox-X, Open Watcom WDIS, and the source checkout.",
      { contractPath },
    );
  }
  const disassemblerPath = resolveInputPath(workspaceRoot, disassembler.path);
  const dosboxPath = resolveInputPath(workspaceRoot, dosbox.path);
  const dos4gwPath = join(resolveInputPath(workspaceRoot, contract.checkout), "DOS4GW.EXE");
  const [disassemblerArtifact, dosboxArtifact, dos4gwArtifact] = await Promise.all([
    fileEvidence(disassemblerPath),
    fileEvidence(dosboxPath),
    fileEvidence(dos4gwPath),
  ]);
  verifyExpectedArtifact(disassemblerArtifact, disassembler.sha256, "Open Watcom disassembler");
  verifyExpectedArtifact(dosboxArtifact, dosbox.sha256, "DOSBox-X disassembler host");
  verifyExpectedArtifact(dos4gwArtifact, runner.sourceArtifacts?.["DOS4GW.EXE"], "DOS/4GW disassembler runtime");

  const cacheKey = sha256Canonical({
    objectSha256: objectArtifact.sha256,
    disassemblerSha256: disassemblerArtifact.sha256,
    dosboxSha256: dosboxArtifact.sha256,
    dos4gwSha256: dos4gwArtifact.sha256,
  });
  const cacheRoot = join(workRoot, "cache", "wdis", cacheKey);
  const listingPath = join(cacheRoot, "OUTPUT.DIS");
  const metadataPath = join(cacheRoot, "binding.json");
  if (existsSync(listingPath) && existsSync(metadataPath)) {
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    const artifact = await fileEvidence(listingPath);
    if (metadata.cacheKey === cacheKey
      && metadata.objectSha256 === objectArtifact.sha256
      && metadata.listingSha256 === artifact.sha256) {
      return {
        path: listingPath,
        artifact,
        binding: { status: "bound", source: "generated-cache", objectSha256: objectArtifact.sha256 },
        disassemblerArtifacts: { disassembler: disassemblerArtifact, dosbox: dosboxArtifact, dos4gw: dos4gwArtifact },
      };
    }
  }

  await mkdir(cacheRoot, { recursive: true });
  await Promise.all([
    copyFile(objectPath, join(cacheRoot, "INPUT.OBJ")),
    copyFile(disassemblerPath, join(cacheRoot, "WDIS.EXE")),
    copyFile(dos4gwPath, join(cacheRoot, "DOS4GW.EXE")),
  ]);
  const args = [
    "-defaultconf",
    "-defaultmapper",
    "-silent",
    "-nogui",
    "-nomenu",
    "-fastlaunch",
    "-set",
    "cpu cycles=max",
    "-c",
    `mount c "${cacheRoot}"`,
    "-c",
    "c:",
    "-c",
    "WDIS.EXE -l=OUTPUT.DIS INPUT.OBJ",
    "-c",
    "exit",
  ];
  try {
    await execute(dosboxPath, args, {
      cwd: workRoot,
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        SDL_VIDEODRIVER: "dummy",
        SDL_AUDIODRIVER: "dummy",
      },
    });
  } catch (error) {
    throw new CompiledPathInspectorError(
      "disassembler-run-failed",
      `Open Watcom WDIS failed for ${basename(objectPath)}.`,
      { stderr: error.stderr || null, stdout: error.stdout || null, message: error.message },
    );
  }
  if (!existsSync(listingPath) || (await stat(listingPath)).size === 0) {
    throw new CompiledPathInspectorError(
      "disassembler-output-missing",
      `Open Watcom WDIS did not produce ${listingPath}.`,
    );
  }
  const listingArtifact = await fileEvidence(listingPath);
  await atomicWrite(metadataPath, `${JSON.stringify({
    schema: "cssoccer-watcom-listing-binding@1",
    cacheKey,
    objectSha256: objectArtifact.sha256,
    listingSha256: listingArtifact.sha256,
    disassemblerSha256: disassemblerArtifact.sha256,
    dosboxSha256: dosboxArtifact.sha256,
    dos4gwSha256: dos4gwArtifact.sha256,
  }, null, 2)}\n`);
  return {
    path: listingPath,
    artifact: listingArtifact,
    binding: { status: "bound", source: "generated", objectSha256: objectArtifact.sha256 },
    disassemblerArtifacts: { disassembler: disassemblerArtifact, dosbox: dosboxArtifact, dos4gw: dos4gwArtifact },
  };
}

async function loadCapture(query, workspaceRoot) {
  if (!query.capture) return null;
  requirePathObject({ path: query.capture.contractPath }, "query capture contract");
  requireText(query.capture.rangesPath, "query capture ranges path");
  const path = resolveInputPath(workspaceRoot, query.capture.contractPath);
  const [artifact, value] = await Promise.all([
    fileEvidence(path),
    readFile(path, "utf8").then(JSON.parse),
  ]);
  const ranges = normalizeCaptureRanges(valueAtJsonPath(value, query.capture.rangesPath));
  return { path, artifact, ranges };
}

async function loadExecutable(query, workspaceRoot) {
  if (!query.executable) return null;
  requirePathObject(query.executable, "query executable");
  const path = resolveInputPath(workspaceRoot, query.executable.path);
  const artifact = await fileEvidence(path);
  const binding = verifyOptionalExpected(artifact, query.executable.expectedSha256, "linked executable");
  return { path, artifact, binding };
}

function verifyOptionalExpected(artifact, expectedSha256, label) {
  if (!expectedSha256) return { status: "observed-unbound", actualSha256: artifact.sha256 };
  verifyExpectedArtifact(artifact, expectedSha256, label);
  return { status: "bound", expectedSha256, actualSha256: artifact.sha256 };
}

function requireBoundArtifact(binding, label) {
  if (binding?.status !== "bound") {
    throw new CompiledPathInspectorError(
      "probe-artifact-unbound",
      `A read-only probe requires ${label} to be bound by an expected retained-profile SHA-256.`,
      { label, binding: binding ?? null },
    );
  }
}

function summarizeArtifactBinding(bindings) {
  const values = Object.values(bindings).filter(Boolean);
  return values.every(({ status }) => status === "bound") ? "bound" : "observed-unbound";
}

function summarizeCoverage(coverage) {
  if (coverage.status !== "probe-required") return coverage.status;
  const nearest = coverage.nearest;
  if (!nearest) return "probe-required";
  return {
    status: "probe-required",
    nearestDirection: nearest.direction,
    nearestRangeOffsetHex: hex32(nearest.range.offset),
    startDeltaBytes: nearest.startDeltaBytes,
    uncoveredGapBytes: nearest.uncoveredGapBytes,
  };
}

function normalizeSymbol(value) {
  if (typeof value === "string") return parseSymbolArgument(value);
  if (!isPlainObject(value)) throw new TypeError("Query symbol must be a string or object.");
  requireText(value.name, "query symbol name");
  if (value.valueType !== undefined && value.valueType !== null) valueTypeBytes(value.valueType);
  return { name: value.name, valueType: value.valueType ?? null };
}

function parseSymbolArgument(value) {
  const [name, valueType, ...rest] = value.split(":");
  if (rest.length > 0 || !name) throw new TypeError(`Invalid --symbol value ${value}.`);
  if (valueType) valueTypeBytes(valueType);
  return { name, valueType: valueType || null };
}

function parseArguments(args) {
  const parsed = { symbols: [] };
  const valueOptions = new Map([
    ["--query", "queryPath"],
    ["--workspace-root", "workspaceRoot"],
    ["--work-root", "workRoot"],
    ["--function", "function"],
    ["--object", "objectPath"],
    ["--map", "mapPath"],
    ["--listing", "listingPath"],
    ["--listing-object-sha256", "listingObjectSha256"],
    ["--executable", "executablePath"],
    ["--capture-contract", "captureContractPath"],
    ["--ranges-path", "rangesPath"],
    ["--oracle-contract", "oracleContractPath"],
    ["--expected-object-sha256", "expectedObjectSha256"],
    ["--expected-map-sha256", "expectedMapSha256"],
    ["--expected-executable-sha256", "expectedExecutableSha256"],
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
      continue;
    }
    if (argument === "--symbol") {
      const value = args[index + 1];
      if (!value) throw new TypeError("--symbol requires a value.");
      parsed.symbols.push(parseSymbolArgument(value));
      index += 1;
      continue;
    }
    const key = valueOptions.get(argument);
    if (!key) throw new TypeError(`Unknown compiled-path option ${argument}.`);
    const value = args[index + 1];
    if (!value) throw new TypeError(`${argument} requires a value.`);
    parsed[key] = value;
    index += 1;
  }
  parsed.rangesPath ??= "oracle.capture.raw.ranges";
  return parsed;
}

function usage() {
  return [
    "Usage:",
    "  node tools/inspect-compiled-path.mjs --query <retained-query.json>",
    "  node tools/inspect-compiled-path.mjs --workspace-root <repo> --function <name> --object <path> --map <path> --symbol <name[:type]> [--capture-contract <path>]",
    "",
    "The query form is required to emit a read-only CSSQRY1 probe. Direct flags perform static compiled-path inspection.",
  ].join("\n");
}

async function atomicWrite(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}

function resolveInputPath(workspaceRoot, path) {
  if (typeof path !== "string" || path.length === 0) throw new TypeError("Evidence path must be non-empty.");
  return isAbsolute(path) ? resolve(path) : resolve(workspaceRoot, path);
}

function requirePathObject(value, label) {
  if (!isPlainObject(value) || typeof value.path !== "string" || value.path.length === 0) {
    throw new TypeError(`${label} must contain a path.`);
  }
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be non-empty text.`);
}

function hex32(value) {
  return `0x${value.toString(16).padStart(8, "0")}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

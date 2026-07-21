import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
  writeSync,
  constants as fsConstants,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { canonicalJson, sha256Hex } from "./io.mjs";
import { differentialScalar, typedSamplesEqual } from "./nativeParity.mjs";

export const DIFFERENTIAL_TESTING_DATA_SCHEMA = "cssoccer-differential-testing-data@1";
export const DIFFERENTIAL_TESTING_BUNDLE_SCHEMA = "cssoccer-differential-testing-bundle@1";
export const DIFFERENTIAL_TESTING_SCENARIO_SCHEMA = "cssoccer-differential-testing-scenario@1";
export const DIFFERENTIAL_TESTING_FIELD_RECORD_SCHEMA = "cssoccer-differential-testing-field-record@1";

const SAMPLE_MARKER = "__CSSOCCER_STREAMED_FIELD_SAMPLES__";

export function buildDifferentialBundle(comparison, {
  publishedAt = comparison?.candidateStream?.header?.generatedAt,
  title = "cssoccer exact gameplay differential",
  subtitle,
  scenarioLabel,
  adapterId = "cssoccer-exact-gameplay-parity@1",
  historyRows = [],
  workspaceRoot,
} = {}) {
  assertComparison(comparison);
  timestamp(publishedAt, "publishedAt");
  nonEmptyText(title, "title");
  nonEmptyText(adapterId, "adapterId");

  const context = createBundleContext(comparison, {
    publishedAt,
    title,
    subtitle,
    scenarioLabel,
    adapterId,
    historyRows,
  });
  return comparison.sampleStore
    ? buildDiskBackedBundle(comparison, context, workspaceRoot)
    : buildBufferedBundle(comparison, context);
}

export async function publishDifferentialBundleAtomic(bundle, publicationRoot, { validateGeneration } = {}) {
  assertBundleFiles(bundle);
  if (typeof validateGeneration !== "function") {
    throw new TypeError("validateGeneration must validate the staged manifest with the installed public contract.");
  }
  const root = resolve(publicationRoot);
  mkdirSync(root, { recursive: true });
  assertRealDirectory(root, "publication root");
  const generationsRoot = join(root, "generations");
  mkdirSync(generationsRoot, { recursive: true });
  assertRealDirectory(generationsRoot, "generation root");

  const currentLink = join(root, "current");
  if (existsSync(currentLink) && !lstatSync(currentLink).isSymbolicLink()) {
    throw new Error(`${currentLink} exists and is not the atomic current-generation symlink.`);
  }

  const temporaryRoot = mkdtempSync(join(generationsRoot, ".tmp-"));
  const finalRoot = join(generationsRoot, bundle.generationId);
  const temporaryLink = join(root, `.current-${process.pid}-${randomUUID()}`);
  try {
    for (const file of bundle.files) {
      const target = containedPath(temporaryRoot, file.path);
      mkdirSync(dirname(target), { recursive: true });
      materializeBundleFile(file, target);
      fsyncFile(target);
    }
    fsyncTreeDirectories(temporaryRoot);
    await validateGeneration(join(temporaryRoot, "current.json"));

    if (existsSync(finalRoot)) {
      assertRealDirectory(finalRoot, "published generation");
      rmSync(temporaryRoot, { recursive: true, force: true });
    } else {
      try {
        renameSync(temporaryRoot, finalRoot);
      } catch (error) {
        if (!new Set(["EEXIST", "ENOTEMPTY"]).has(error.code)) throw error;
        rmSync(temporaryRoot, { recursive: true, force: true });
      }
      fsyncDirectory(generationsRoot);
    }

    await validateGeneration(join(finalRoot, "current.json"));
    symlinkSync(relative(root, finalRoot), temporaryLink, "dir");
    renameSync(temporaryLink, currentLink);
    fsyncDirectory(root);
    return Object.freeze({
      generationId: bundle.generationId,
      generationRoot: finalRoot,
      manifestPath: join(currentLink, "current.json"),
    });
  } catch (error) {
    rmSync(temporaryRoot, { recursive: true, force: true });
    rmSync(temporaryLink, { force: true });
    throw error;
  }
}

function createBundleContext(comparison, { publishedAt, title, subtitle, scenarioLabel, adapterId, historyRows }) {
  const { referenceStream, candidateStream } = comparison;
  const { bindings, tickRange, phases } = referenceStream.header;
  const definitions = comparison.selectedFields;
  const scenarioId = bindings.scenarioId;
  const coordinateCount = tickRange.count * phases.length;
  const fieldCount = definitions.length;
  const flattenedTicks = Array.from({ length: coordinateCount }, (_, index) => index);
  const fields = comparison.fieldResults.map((result) => fieldProjection(result));
  const failedFieldCount = fields.filter((field) => field.failedSampleCount > 0).length;
  const failedSampleCount = comparison.mismatchCount;
  const totalSampleCount = coordinateCount * fieldCount;
  const reportSha256 = comparison.reportSha256;
  const runtimeTreeSha256 = candidateStream.header.bindings.buildSha256;
  const contractSha256 = comparison.fieldSelection.comparisonContractSha256;
  const profileSha256 = bindings.profileSha256;
  const replaySha256 = bindings.inputSha256;
  const refreshId = `comparison-${reportSha256.slice(0, 16)}`;
  const rowBinding = { refreshId, scenarioId, reportSha256, runtimeTreeSha256, contractSha256 };
  const firstOrdinal = comparison.earliestMismatch === null
    ? null
    : (comparison.earliestMismatch.tick - tickRange.start) * phases.length + comparison.earliestMismatch.phaseOrder;
  const clearedPrefixFrames = comparison.earliestMismatch === null
    ? tickRange.count
    : comparison.earliestMismatch.tick - tickRange.start;
  const retainedCurrent = Array.isArray(historyRows)
    ? historyRows.find((row) => row?.reportSha256 === reportSha256)
    : null;
  const currentTimestamp = retainedCurrent?.timestamp ?? publishedAt;
  const history = mergeHistoryRows(historyRows, {
    timestamp: currentTimestamp,
    value: failedSampleCount,
    fieldCount,
    failedFieldCount,
    frames: tickRange.count,
    frame: clearedPrefixFrames,
    firstFailingTick: comparison.earliestMismatch?.tick ?? null,
    firstFailingLabel: comparison.earliestMismatch?.fieldLabel ?? null,
    ...rowBinding,
  }, scenarioId);
  const currentRow = history.at(-1);
  const result = currentRow.result;
  const runCounts = history.reduce((counts, row) => {
    if (row.result === "pass") counts.passed += 1;
    else if (row.result === "blocked") counts.blocked += 1;
    else counts.failed += 1;
    return counts;
  }, { passed: 0, failed: 0, blocked: 0 });
  const catalogEntry = {
    id: scenarioId,
    label: scenarioLabel ?? referenceStream.header.streamId,
    frameCount: tickRange.count,
    replaySha256,
    profileSha256,
    contractSha256,
    updatedAt: currentTimestamp,
  };
  const reportCheck = {
    status: "pass",
    id: "cssoccer-parity-report-check@1",
    sha256: sha256Hex(canonicalJson({ status: "pass", subjectSha256: reportSha256 })),
    subjectSha256: reportSha256,
  };
  const data = {
    schema: DIFFERENTIAL_TESTING_DATA_SCHEMA,
    publishedAt: currentTimestamp,
    title,
    subtitle: subtitle ?? `${referenceStream.header.streamId} / ${candidateStream.header.streamId}`,
    adapter: {
      id: adapterId,
      authority: "adapter-attested",
      bindings: comparison.bindings,
      engineIndependence: comparison.engineIndependence,
      typedExact: {
        coordinateOrder: comparison.coordinateOrder,
        phaseOrder: phases,
        fieldSelection: comparison.fieldSelection,
        flattenedTick: firstOrdinal,
        earliestMismatch: comparison.earliestMismatch,
      },
    },
    trust: { status: "pass", reportStatus: result, blockers: [] },
    scenarioCatalog: { selectedScenarioId: scenarioId, scenarios: [catalogEntry] },
    refresh: {
      id: refreshId,
      status: "complete",
      scenarioId,
      event: { kind: "comparison-published", revision: reportSha256, occurredAt: currentTimestamp },
      requestedAt: currentTimestamp,
      startedAt: currentTimestamp,
      completedAt: currentTimestamp,
      error: null,
      report: {
        id: `report-${reportSha256.slice(0, 16)}`,
        generatedAt: currentTimestamp,
        artifactSha256: reportSha256,
        runtimeTreeSha256,
        contractSha256,
        scenarioId,
        frameCount: tickRange.count,
        replaySha256,
        profileSha256,
        result,
        check: reportCheck,
      },
    },
    summary: {
      runs: { label: "Runs", total: history.length, ...runCounts },
      fields: { label: "Fields", total: fieldCount, passed: fieldCount - failedFieldCount, failed: failedFieldCount, blocked: 0 },
      frames: { label: "Typed samples", total: totalSampleCount, passed: totalSampleCount - failedSampleCount, failed: failedSampleCount, blocked: 0, uniqueTicks: coordinateCount },
    },
    progress: history,
    log: [...history].reverse(),
  };
  return {
    comparison,
    scenarioId,
    coordinateCount,
    fieldCount,
    flattenedTicks,
    fields,
    data,
    catalogEntry,
    publishedAt: currentTimestamp,
  };
}

function mergeHistoryRows(historyRows, current, scenarioId) {
  if (!Array.isArray(historyRows)) throw new TypeError("historyRows must be an array");
  const byIdentity = new Map();
  for (const row of [...historyRows, current]) {
    if (!row || row.scenarioId !== scenarioId) continue;
    const identity = row.reportSha256 ?? row.refreshId;
    if (typeof identity !== "string" || identity.length === 0) continue;
    byIdentity.set(identity, historyRow(row));
  }
  const ordered = [...byIdentity.values()].sort((left, right) => (
    Date.parse(left.timestamp) - Date.parse(right.timestamp)
    || left.reportSha256.localeCompare(right.reportSha256)
  ));
  return ordered.map((row, index) => {
    const previous = index === 0 ? null : ordered[index - 1];
    const delta = previous === null ? null : row.value - previous.value;
    const frameDelta = previous === null ? null : row.frame - previous.frame;
    const result = row.value === 0
      ? "pass"
      : previous === null
        ? "unchanged"
        : row.frame > previous.frame || row.value < previous.value
          ? "improved"
          : row.frame < previous.frame || row.value > previous.value
            ? "worsened"
            : "unchanged";
    return Object.freeze({ ...row, result, delta, frameDelta });
  });
}

function historyRow(row) {
  return {
    timestamp: row.timestamp,
    result: row.result ?? "unchanged",
    value: row.value,
    delta: row.delta ?? null,
    fieldCount: row.fieldCount,
    failedFieldCount: row.failedFieldCount,
    frames: row.frames,
    frame: row.frame,
    frameDelta: row.frameDelta ?? null,
    firstFailingTick: row.firstFailingTick ?? null,
    firstFailingLabel: row.firstFailingLabel ?? null,
    refreshId: row.refreshId,
    scenarioId: row.scenarioId,
    reportSha256: row.reportSha256,
    runtimeTreeSha256: row.runtimeTreeSha256,
    contractSha256: row.contractSha256,
  };
}

function buildBufferedBundle(comparison, context) {
  const { referenceStream, candidateStream } = comparison;
  const fullDefinitions = referenceStream.header.fields;
  const fullFieldOrdinals = new Map(fullDefinitions.map((definition, ordinal) => [definition.id, ordinal]));
  const fieldRecords = context.fields.map((field, ordinal) => {
    const fullFieldOrdinal = fullFieldOrdinals.get(field.id);
    const samples = [];
    for (let coordinate = 0; coordinate < context.coordinateCount; coordinate += 1) {
      const sampleIndex = coordinate * fullDefinitions.length + fullFieldOrdinal;
      const reference = referenceStream.samples[sampleIndex];
      const candidate = candidateStream.samples[sampleIndex];
      samples.push([
        coordinate,
        differentialScalar(reference),
        differentialScalar(candidate),
        typedSamplesEqual(reference, candidate) ? 0 : 1,
      ]);
    }
    return recordBytes(context.scenarioId, ordinal, field, samples);
  });
  const recordsBytes = Buffer.concat(fieldRecords.flatMap((bytes) => [bytes, Buffer.from("\n")]));
  const fieldIndex = fieldRecords.map((bytes, ordinal) => {
    const offset = fieldRecords.slice(0, ordinal).reduce((sum, record) => sum + record.length + 1, 0);
    return fieldIndexEntry(context.fields[ordinal], ordinal, offset, bytes);
  }).sort((left, right) => left.id.localeCompare(right.id));
  return finalizeBufferedBundle(context, fieldIndex, recordsBytes);
}

function buildDiskBackedBundle(comparison, context, workspaceRoot) {
  if (!workspaceRoot) throw new TypeError("workspaceRoot is required for a disk-backed differential bundle");
  mkdirSync(resolve(workspaceRoot), { recursive: true });
  const root = mkdtempSync(join(resolve(workspaceRoot), ".bundle-"));
  const scenarioRoot = join(root, "scenarios", context.scenarioId);
  mkdirSync(scenarioRoot, { recursive: true });
  const recordsPath = join(scenarioRoot, "fields.ndjson");
  const descriptor = openSync(recordsPath, "wx", 0o600);
  const recordsHash = createHash("sha256");
  const spoolsById = new Map(comparison.sampleStore.spools.map((spool) => [spool.id, spool]));
  const fieldIndex = [];
  let offset = 0;
  try {
    for (const [ordinal, field] of context.fields.entries()) {
      const spool = spoolsById.get(field.id);
      if (!spool || spool.ordinal !== ordinal) throw new TypeError(`sample spool is missing for ${field.id}`);
      const spoolBytes = readFileSync(spool.path);
      if (spoolBytes.length !== spool.size || sha256Hex(spoolBytes) !== spool.sha256) {
        throw new Error(`sample spool changed for ${field.id}`);
      }
      if (spoolBytes.length === 0 || spoolBytes.at(-1) !== 0x0a || spoolBytes.includes(0x0d)) {
        throw new Error(`sample spool is not canonical LF-terminated NDJSON for ${field.id}`);
      }
      const sampleArrayJson = spoolBytes.subarray(0, -1).toString("utf8").replaceAll("\n", ",");
      const bytes = streamedRecordBytes(context.scenarioId, ordinal, field, sampleArrayJson);
      writeSync(descriptor, bytes);
      writeSync(descriptor, "\n");
      recordsHash.update(bytes);
      recordsHash.update("\n");
      fieldIndex.push(fieldIndexEntry(field, ordinal, offset, bytes));
      offset += bytes.length + 1;
    }
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fieldIndex.sort((left, right) => left.id.localeCompare(right.id));
  const records = {
    path: "fields.ndjson",
    size: offset,
    sha256: recordsHash.digest("hex"),
    count: context.fields.length,
  };
  const scenarioBytes = scenarioDocumentBytes(context, fieldIndex, records);
  const scenarioPath = join(scenarioRoot, "scenario.json");
  writeFileSync(scenarioPath, scenarioBytes, { flag: "wx", mode: 0o600 });
  fsyncFile(scenarioPath);
  const manifest = manifestDocument(context, scenarioBytes);
  const manifestBytes = Buffer.from(`${canonicalJson(manifest)}\n`, "utf8");
  const manifestPath = join(root, "current.json");
  writeFileSync(manifestPath, manifestBytes, { flag: "wx", mode: 0o600 });
  fsyncFile(manifestPath);
  fsyncTreeDirectories(root);

  const files = [
    sourceFile("current.json", manifestPath),
    sourceFile(`scenarios/${context.scenarioId}/fields.ndjson`, recordsPath),
    sourceFile(`scenarios/${context.scenarioId}/scenario.json`, scenarioPath),
  ].sort((left, right) => left.path.localeCompare(right.path));
  return bundleFiles(context.scenarioId, manifest, files, root);
}

function finalizeBufferedBundle(context, fieldIndex, recordsBytes) {
  const records = {
    path: "fields.ndjson",
    size: recordsBytes.length,
    sha256: sha256Hex(recordsBytes),
    count: context.fields.length,
  };
  const scenarioBytes = scenarioDocumentBytes(context, fieldIndex, records);
  const manifest = manifestDocument(context, scenarioBytes);
  const manifestBytes = Buffer.from(`${canonicalJson(manifest)}\n`, "utf8");
  const files = [
    { path: "current.json", bytes: manifestBytes, size: manifestBytes.length, sha256: sha256Hex(manifestBytes) },
    { path: `scenarios/${context.scenarioId}/fields.ndjson`, bytes: recordsBytes, size: recordsBytes.length, sha256: sha256Hex(recordsBytes) },
    { path: `scenarios/${context.scenarioId}/scenario.json`, bytes: scenarioBytes, size: scenarioBytes.length, sha256: sha256Hex(scenarioBytes) },
  ].sort((left, right) => left.path.localeCompare(right.path));
  return bundleFiles(context.scenarioId, manifest, files, null);
}

function scenarioDocumentBytes(context, fieldIndex, records) {
  const scenario = {
    schema: DIFFERENTIAL_TESTING_SCENARIO_SCHEMA,
    scenarioId: context.scenarioId,
    data: context.data,
    frameDelta: {
      ticks: context.flattenedTicks,
      activeCounts: Array(context.coordinateCount).fill(context.fieldCount),
      nonPassCounts: context.comparison.nonPassCounts,
    },
    fieldIndex,
    records,
  };
  return Buffer.from(`${canonicalJson(scenario)}\n`, "utf8");
}

function manifestDocument(context, scenarioBytes) {
  return {
    schema: DIFFERENTIAL_TESTING_BUNDLE_SCHEMA,
    publishedAt: context.publishedAt,
    scenarioCatalog: { selectedScenarioId: context.scenarioId, scenarios: [context.catalogEntry] },
    scenarioBindings: [{
      scenarioId: context.scenarioId,
      path: `scenarios/${context.scenarioId}/scenario.json`,
      size: scenarioBytes.length,
      sha256: sha256Hex(scenarioBytes),
    }],
    emptyData: null,
  };
}

function bundleFiles(scenarioId, manifest, files, workspaceRoot) {
  const generationId = sha256Hex(canonicalJson(files.map((file) => ({
    path: file.path,
    size: file.size,
    sha256: file.sha256,
  }))));
  return Object.freeze({
    schema: "cssoccer-differential-bundle-files@1",
    generationId,
    scenarioId,
    manifest,
    files: Object.freeze(files),
    workspaceRoot,
  });
}

function fieldProjection(result) {
  const definition = result.definition;
  return {
    id: definition.id,
    label: definition.label,
    sourceOwner: definition.sourceOwner,
    semantics: {
      meaning: definition.meaning,
      valueType: definition.valueType,
      numericAuthority: definition.valueType === "bool" || definition.valueType === "string" || definition.valueType === "null"
        ? "typed-json-value"
        : "exact-numeric-bits",
      coordinateEncoding: "zero-based ordinal over contiguous (tick, phase)",
    },
    unit: definition.unit,
    tolerance: 0,
    trustStatus: "pass",
    driftClass: result.failedSampleCount ? "exact-mismatch" : "pass",
    driftReason: result.failedSampleCount
      ? "At least one exact typed value differs."
      : "All exact typed values match.",
    sampleCount: result.sampleCount,
    failedSampleCount: result.failedSampleCount,
    missingSampleCount: 0,
    firstFailingTick: result.firstFailingCoordinate,
    maxDelta: result.failedSampleCount ? 1 : 0,
  };
}

function recordBytes(scenarioId, ordinal, field, samples) {
  return Buffer.from(canonicalJson({
    schema: DIFFERENTIAL_TESTING_FIELD_RECORD_SCHEMA,
    scenarioId,
    id: field.id,
    ordinal,
    field: { ...field, samples },
    telemetry: null,
  }), "utf8");
}

function streamedRecordBytes(scenarioId, ordinal, field, sampleArrayJson) {
  const template = canonicalJson({
    schema: DIFFERENTIAL_TESTING_FIELD_RECORD_SCHEMA,
    scenarioId,
    id: field.id,
    ordinal,
    field: { ...field, samples: SAMPLE_MARKER },
    telemetry: null,
  });
  const marker = `\"samples\":${JSON.stringify(SAMPLE_MARKER)}`;
  const markerOffset = template.indexOf(marker);
  if (markerOffset === -1 || template.indexOf(marker, markerOffset + marker.length) !== -1) {
    throw new Error(`could not bind streamed samples for ${field.id}`);
  }
  const samplesValueOffset = markerOffset + "\"samples\":".length;
  const markerValue = JSON.stringify(SAMPLE_MARKER);
  return Buffer.from(`${template.slice(0, samplesValueOffset)}[${sampleArrayJson}]${template.slice(samplesValueOffset + markerValue.length)}`, "utf8");
}

function fieldIndexEntry(field, ordinal, offset, bytes) {
  return {
    id: field.id,
    ordinal,
    field,
    telemetry: null,
    record: { offset, size: bytes.length, sha256: sha256Hex(bytes) },
  };
}

function sourceFile(path, sourcePath) {
  const metadata = statSync(sourcePath);
  if (!metadata.isFile() || lstatSync(sourcePath).isSymbolicLink()) throw new Error(`bundle source must be a regular file: ${sourcePath}`);
  return { path, sourcePath, size: metadata.size, sha256: sha256FileSync(sourcePath) };
}

function materializeBundleFile(file, target) {
  if (Buffer.isBuffer(file.bytes)) {
    if (file.bytes.length !== file.size || sha256Hex(file.bytes) !== file.sha256) throw new Error(`bundle bytes changed for ${file.path}`);
    writeFileSync(target, file.bytes, { flag: "wx", mode: 0o644 });
    return;
  }
  const metadata = lstatSync(file.sourcePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== file.size || sha256FileSync(file.sourcePath) !== file.sha256) {
    throw new Error(`bundle source changed for ${file.path}`);
  }
  copyFileSync(file.sourcePath, target, fsConstants.COPYFILE_EXCL);
  if (sha256FileSync(target) !== file.sha256) throw new Error(`bundle copy changed for ${file.path}`);
}

function sha256FileSync(path) {
  const hash = createHash("sha256");
  const descriptor = openSync(path, "r");
  const buffer = Buffer.allocUnsafe(128 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function assertComparison(comparison) {
  if (!comparison || comparison.schema !== "cssoccer-native-parity@1") throw new TypeError("comparison must be a cssoccer native parity report");
  if (!comparison.referenceStream || !comparison.candidateStream) throw new TypeError("comparison must retain its checked input stream summaries");
  if (!Array.isArray(comparison.selectedFields) || !Array.isArray(comparison.fieldResults)) throw new TypeError("comparison must retain its selected field results");
  if (!/^[a-f0-9]{64}$/u.test(comparison.reportSha256)) throw new TypeError("comparison report identity is missing");
  if (comparison.engineIndependence?.status !== "pass") throw new TypeError("comparison lacks passing engine-independence metadata");
  if (comparison.selectedFields.some((field) => field.id.startsWith("camera."))) throw new TypeError("gameplay comparison contains a camera field");
}

function assertBundleFiles(bundle) {
  if (!bundle || bundle.schema !== "cssoccer-differential-bundle-files@1" || !Array.isArray(bundle.files)) {
    throw new TypeError("bundle must contain checked differential bundle files");
  }
  if (!/^[a-f0-9]{64}$/u.test(bundle.generationId)) throw new TypeError("bundle generation identity is missing");
  const paths = new Set();
  for (const file of bundle.files) {
    const hasBytes = Buffer.isBuffer(file?.bytes);
    const hasSource = typeof file?.sourcePath === "string";
    if (!file || typeof file.path !== "string" || hasBytes === hasSource) throw new TypeError("bundle files must have exactly one byte or source-file payload");
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || !/^[a-f0-9]{64}$/u.test(file.sha256)) throw new TypeError(`bundle file identity is invalid for ${file.path}`);
    if (isAbsolute(file.path) || file.path.split("/").some((part) => !part || part === "." || part === "..")) throw new TypeError(`unsafe bundle path ${file.path}`);
    if (paths.has(file.path)) throw new TypeError(`duplicate bundle path ${file.path}`);
    paths.add(file.path);
  }
  if (!paths.has("current.json")) throw new TypeError("bundle must contain current.json");
}

function containedPath(root, relativePath) {
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new TypeError(`bundle path escapes generation: ${relativePath}`);
  return target;
}

function assertRealDirectory(path, label) {
  const metadata = lstatSync(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`${label} must be a real directory: ${path}`);
}

function fsyncFile(path) {
  const descriptor = openSync(path, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function fsyncDirectory(path) {
  const descriptor = openSync(path, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function fsyncTreeDirectories(root) {
  const directories = new Set([root]);
  const scenarioRoot = join(root, "scenarios");
  if (existsSync(scenarioRoot)) {
    for (const file of bundleDirectoriesUnder(scenarioRoot)) directories.add(file);
  }
  [...directories].sort((left, right) => right.length - left.length).forEach(fsyncDirectory);
}

function bundleDirectoriesUnder(root) {
  const directories = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    directories.push(current);
    for (const name of readdirSync(current)) {
      const child = join(current, name);
      const metadata = lstatSync(child);
      if (metadata.isDirectory() && !metadata.isSymbolicLink()) stack.push(child);
    }
  }
  return directories;
}

function timestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new TypeError(`${label} must be a parseable timestamp`);
}

function nonEmptyText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label} must be a non-empty string`);
}

import { createHash } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";

import {
  canonicalJson,
  openParityJsonlFile,
  parityContractSha256,
  sha256Hex,
} from "./io.mjs";

const COMMON_BINDINGS = [
  "scenarioId", "scenarioSha256", "profileSha256", "inputSha256", "contractSha256",
];

const DEFAULT_SPOOL_BUFFER_BYTES = 8 * 1024 * 1024;

export const GAMEPLAY_FIELD_SELECTION = Object.freeze({
  schema: "cssoccer-parity-field-selection@1",
  id: "cssoccer-gameplay-state@1",
  includedPrefixes: Object.freeze([
    "ball.",
    "clock.",
    "lifecycle.",
    "players.",
    "rng.",
    "rules.",
    "score.",
  ]),
  excludedPrefixes: Object.freeze(["camera."]),
});

export class ParityComparisonError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParityComparisonError";
  }
}

export function compareNativeParity(referenceStream, candidateStream, {
  fieldSelection = null,
  coordinateWindow = null,
} = {}) {
  assertParsedStream(referenceStream, "reference");
  assertParsedStream(candidateStream, "candidate");
  assertComparableHeaders(referenceStream.header, candidateStream.header);
  assertPassingEngineIndependence(candidateStream.header.engineIndependence);

  const selection = resolveFieldSelection(referenceStream.header, fieldSelection);
  const window = resolveCoordinateWindow(referenceStream.header, coordinateWindow);
  const selectedOrdinals = new Map(selection.fields.map((field, ordinal) => [field.id, ordinal]));
  const fieldResults = createFieldResults(selection.fields);
  const coordinateCount = window.tickRange.count * referenceStream.header.phases.length;
  const nonPassCounts = Array(coordinateCount).fill(0);
  const phaseById = new Map(referenceStream.header.phases.map((phase) => [phase.id, phase]));
  let earliestMismatch = null;
  let mismatchCount = 0;

  for (let index = 0; index < referenceStream.samples.length; index += 1) {
    const reference = referenceStream.samples[index];
    const candidate = candidateStream.samples[index];
    if (reference.tick < window.tickRange.start) continue;
    const selectedOrdinal = selectedOrdinals.get(reference.fieldId);
    if (selectedOrdinal === undefined) continue;
    const phase = phaseById.get(reference.phase);
    const field = selection.fields[selectedOrdinal];
    const coordinateOrdinal = (reference.tick - window.tickRange.start)
      * referenceStream.header.phases.length + phase.order;
    const equal = typedSamplesEqual(reference, candidate);
    updateFieldResult(fieldResults[selectedOrdinal], coordinateOrdinal, equal);
    if (equal) continue;
    mismatchCount += 1;
    nonPassCounts[coordinateOrdinal] += 1;
    if (earliestMismatch === null) earliestMismatch = mismatchReport(reference, candidate, phase, field);
  }

  return makeComparison({
    referenceStream,
    candidateStream,
    selection,
    coordinateWindow: window,
    fieldResults,
    nonPassCounts,
    mismatchCount,
    earliestMismatch,
    sampleStore: null,
    processing: {
      mode: "in-memory",
      fullStreamValidation: true,
      retainedSamplePairs: referenceStream.samples.length,
      maxBufferedSampleBytes: null,
      validatedTickRange: window.streamTickRange,
      comparedTickRange: window.tickRange,
    },
  });
}

/**
 * Strictly validates and compares two complete JSONL files in lockstep. Only
 * selected fields are compared; every excluded record is still parsed and
 * type/sequence checked. Selected sample tuples are transposed to bounded disk
 * spools so the scalable bundle can be assembled without retaining either
 * 200MB source stream in memory.
 */
export async function compareNativeParityFiles(referencePath, candidatePath, {
  fieldSelection = GAMEPLAY_FIELD_SELECTION,
  coordinateWindow = null,
  sampleStoreRoot,
  maxBufferedSampleBytes = DEFAULT_SPOOL_BUFFER_BYTES,
} = {}) {
  if (!sampleStoreRoot) throw new TypeError("sampleStoreRoot is required for a streaming comparison");
  if (!Number.isSafeInteger(maxBufferedSampleBytes) || maxBufferedSampleBytes < 64 * 1024) {
    throw new TypeError("maxBufferedSampleBytes must be an integer of at least 65536 bytes");
  }

  mkdirSync(resolve(sampleStoreRoot), { recursive: true });
  const storeRoot = mkdtempSync(join(resolve(sampleStoreRoot), ".comparison-"));
  const fieldsRoot = join(storeRoot, "fields");
  mkdirSync(fieldsRoot);
  let referenceReader;
  let candidateReader;
  try {
    [referenceReader, candidateReader] = await Promise.all([
      openParityJsonlFile(referencePath, { label: `reference ${referencePath}` }),
      openParityJsonlFile(candidatePath, { label: `candidate ${candidatePath}` }),
    ]);
    assertComparableHeaders(referenceReader.header, candidateReader.header);
    assertPassingEngineIndependence(candidateReader.header.engineIndependence);

    const selection = resolveFieldSelection(referenceReader.header, fieldSelection);
    const window = resolveCoordinateWindow(referenceReader.header, coordinateWindow);
    const selectedOrdinals = new Map(selection.fields.map((field, ordinal) => [field.id, ordinal]));
    const fieldResults = createFieldResults(selection.fields);
    const coordinateCount = window.tickRange.count * referenceReader.header.phases.length;
    const nonPassCounts = Array(coordinateCount).fill(0);
    const phaseById = new Map(referenceReader.header.phases.map((phase) => [phase.id, phase]));
    const spools = selection.fields.map((field, ordinal) => ({
      id: field.id,
      ordinal,
      path: join(fieldsRoot, `${String(ordinal).padStart(4, "0")}-${sha256Hex(field.id).slice(0, 16)}.ndjson`),
      hash: createHash("sha256"),
      size: 0,
    }));
    const pending = Array.from({ length: spools.length }, () => []);
    let pendingBytes = 0;
    let peakBufferedSampleBytes = 0;
    let earliestMismatch = null;
    let mismatchCount = 0;

    const flush = () => {
      for (let ordinal = 0; ordinal < pending.length; ordinal += 1) {
        if (pending[ordinal].length === 0) continue;
        appendFileSync(spools[ordinal].path, pending[ordinal].join(""), { encoding: "utf8", mode: 0o600 });
        pending[ordinal] = [];
      }
      pendingBytes = 0;
    };

    const expectedSampleCount = referenceReader.expectedSampleCount;
    for (let index = 0; index < expectedSampleCount; index += 1) {
      const [reference, candidate] = await Promise.all([
        referenceReader.nextSample(),
        candidateReader.nextSample(),
      ]);
      if (reference.tick !== candidate.tick || reference.phase !== candidate.phase || reference.fieldId !== candidate.fieldId) {
        throw new ParityComparisonError("Reference and candidate sample coordinates differ after strict stream validation.");
      }
      if (reference.tick < window.tickRange.start) continue;
      const selectedOrdinal = selectedOrdinals.get(reference.fieldId);
      if (selectedOrdinal === undefined) continue;

      const phase = phaseById.get(reference.phase);
      const field = selection.fields[selectedOrdinal];
      const coordinateOrdinal = (reference.tick - window.tickRange.start)
        * referenceReader.header.phases.length + phase.order;
      const equal = typedSamplesEqual(reference, candidate);
      const state = equal ? 0 : 1;
      updateFieldResult(fieldResults[selectedOrdinal], coordinateOrdinal, equal);
      if (!equal) {
        mismatchCount += 1;
        nonPassCounts[coordinateOrdinal] += 1;
        if (earliestMismatch === null) earliestMismatch = mismatchReport(reference, candidate, phase, field);
      }
      const line = `${canonicalJson([
        coordinateOrdinal,
        differentialScalar(reference),
        differentialScalar(candidate),
        state,
      ])}\n`;
      pending[selectedOrdinal].push(line);
      const lineBytes = Buffer.byteLength(line);
      pendingBytes += lineBytes;
      spools[selectedOrdinal].size += lineBytes;
      spools[selectedOrdinal].hash.update(line);
      peakBufferedSampleBytes = Math.max(peakBufferedSampleBytes, pendingBytes);
      if (pendingBytes >= maxBufferedSampleBytes) flush();
    }
    flush();

    const [referenceStream, candidateStream] = await Promise.all([
      referenceReader.finish(),
      candidateReader.finish(),
    ]);
    const finalizedSpools = spools.map((spool) => {
      const metadata = statSync(spool.path);
      if (!metadata.isFile() || metadata.size !== spool.size) {
        throw new ParityComparisonError(`Sample spool changed for ${spool.id}.`);
      }
      return Object.freeze({
        id: spool.id,
        ordinal: spool.ordinal,
        path: spool.path,
        size: spool.size,
        sha256: spool.hash.digest("hex"),
      });
    });
    const sampleStore = Object.freeze({
      schema: "cssoccer-parity-sample-store@1",
      root: storeRoot,
      coordinateEncoding: "zero-based ordinal over the declared comparison-window (tick, phase)",
      spools: Object.freeze(finalizedSpools),
    });

    return makeComparison({
      referenceStream,
      candidateStream,
      selection,
      coordinateWindow: window,
      fieldResults,
      nonPassCounts,
      mismatchCount,
      earliestMismatch,
      sampleStore,
      processing: {
        mode: "streaming-lockstep-disk-spool",
        fullStreamValidation: true,
        retainedSamplePairs: 1,
        maxBufferedSampleBytes,
        peakBufferedSampleBytes,
        validatedTickRange: window.streamTickRange,
        comparedTickRange: window.tickRange,
      },
    });
  } catch (error) {
    rmSync(storeRoot, { recursive: true, force: true });
    throw error;
  } finally {
    await Promise.allSettled([
      referenceReader?.close(),
      candidateReader?.close(),
    ]);
  }
}

export function typedSamplesEqual(reference, candidate) {
  if (reference.valueType !== candidate.valueType) return false;
  if (reference.numericBits !== null || candidate.numericBits !== null) {
    return reference.numericBits !== null
      && candidate.numericBits !== null
      && reference.numericBits === candidate.numericBits;
  }
  return Object.is(reference.value, candidate.value);
}

export function differentialScalar(sample) {
  return sample.numericBits === null
    ? sample.value
    : `${sample.valueType}:${sample.numericBits}`;
}

function resolveFieldSelection(header, selection) {
  const normalized = selection === null
    ? {
        schema: "cssoccer-parity-field-selection@1",
        id: "all-declared-fields@1",
        includedPrefixes: [""],
        excludedPrefixes: [],
      }
    : selection;
  if (normalized?.schema !== "cssoccer-parity-field-selection@1") {
    throw new ParityComparisonError("field selection must use cssoccer-parity-field-selection@1");
  }
  if (typeof normalized.id !== "string" || normalized.id.trim().length === 0) {
    throw new ParityComparisonError("field selection id must be non-empty");
  }
  for (const [name, prefixes] of [
    ["includedPrefixes", normalized.includedPrefixes],
    ["excludedPrefixes", normalized.excludedPrefixes],
  ]) {
    if (!Array.isArray(prefixes) || prefixes.some((prefix) => typeof prefix !== "string")) {
      throw new ParityComparisonError(`field selection ${name} must be an array of strings`);
    }
  }
  const fields = header.fields.filter((field) => normalized.includedPrefixes.some((prefix) => field.id.startsWith(prefix))
    && !normalized.excludedPrefixes.some((prefix) => field.id.startsWith(prefix)));
  if (fields.length === 0) throw new ParityComparisonError(`field selection ${normalized.id} selected no fields`);
  const excludedFieldCount = header.fields.length - fields.length;
  const comparisonContractSha256 = parityContractSha256({ phases: header.phases, fields });
  return Object.freeze({
    schema: normalized.schema,
    id: normalized.id,
    includedPrefixes: Object.freeze([...normalized.includedPrefixes]),
    excludedPrefixes: Object.freeze([...normalized.excludedPrefixes]),
    selectedFieldCount: fields.length,
    excludedFieldCount,
    streamFieldCount: header.fields.length,
    streamContractSha256: header.bindings.contractSha256,
    comparisonContractSha256,
    fields: Object.freeze(fields),
  });
}

function resolveCoordinateWindow(header, coordinateWindow) {
  const streamStart = header.tickRange.start;
  const streamEnd = streamStart + header.tickRange.count;
  const normalized = coordinateWindow === null
    ? {
        schema: "cssoccer-parity-coordinate-window@1",
        id: "full-declared-stream@1",
        startTick: streamStart,
        sourceBoundary: "declared parity stream tickRange",
        reason: "Every declared stream tick belongs to the comparison.",
      }
    : coordinateWindow;
  if (normalized?.schema !== "cssoccer-parity-coordinate-window@1") {
    throw new ParityComparisonError("coordinate window must use cssoccer-parity-coordinate-window@1");
  }
  for (const key of ["id", "sourceBoundary", "reason"]) {
    if (typeof normalized[key] !== "string" || normalized[key].trim().length === 0) {
      throw new ParityComparisonError(`coordinate window ${key} must be non-empty`);
    }
  }
  if (
    !Number.isSafeInteger(normalized.startTick)
    || normalized.startTick < streamStart
    || normalized.startTick >= streamEnd
  ) {
    throw new ParityComparisonError(
      `coordinate window startTick must be inside [${streamStart}, ${streamEnd})`,
    );
  }
  return Object.freeze({
    schema: normalized.schema,
    id: normalized.id,
    sourceBoundary: normalized.sourceBoundary,
    reason: normalized.reason,
    streamTickRange: Object.freeze({ ...header.tickRange }),
    tickRange: Object.freeze({
      start: normalized.startTick,
      count: streamEnd - normalized.startTick,
    }),
    skippedPrefixTickCount: normalized.startTick - streamStart,
  });
}

function createFieldResults(fields) {
  return fields.map((definition, ordinal) => ({
    definition,
    ordinal,
    sampleCount: 0,
    failedSampleCount: 0,
    firstFailingCoordinate: null,
  }));
}

function updateFieldResult(result, coordinateOrdinal, equal) {
  result.sampleCount += 1;
  if (equal) return;
  result.failedSampleCount += 1;
  if (result.firstFailingCoordinate === null) result.firstFailingCoordinate = coordinateOrdinal;
}

function makeComparison({
  referenceStream,
  candidateStream,
  selection,
  coordinateWindow,
  fieldResults,
  nonPassCounts,
  mismatchCount,
  earliestMismatch,
  sampleStore,
  processing,
}) {
  const independence = candidateStream.header.engineIndependence;
  const report = {
    schema: "cssoccer-native-parity@1",
    status: earliestMismatch === null ? "match" : "mismatch",
    coordinateOrder: ["tick", "phase", "field"],
    coordinateWindow,
    fieldSelection: selectionMetadata(selection),
    bindings: {
      scenarioId: referenceStream.header.bindings.scenarioId,
      scenarioSha256: referenceStream.header.bindings.scenarioSha256,
      profileSha256: referenceStream.header.bindings.profileSha256,
      inputSha256: referenceStream.header.bindings.inputSha256,
      streamContractSha256: referenceStream.header.bindings.contractSha256,
      comparisonContractSha256: selection.comparisonContractSha256,
      reference: {
        sourceSha256: referenceStream.header.bindings.sourceSha256,
        buildSha256: referenceStream.header.bindings.buildSha256,
        artifactSha256: referenceStream.artifactSha256,
        sourceBytes: referenceStream.sourceBytes,
      },
      candidate: {
        sourceSha256: candidateStream.header.bindings.sourceSha256,
        buildSha256: candidateStream.header.bindings.buildSha256,
        artifactSha256: candidateStream.artifactSha256,
        sourceBytes: candidateStream.sourceBytes,
      },
    },
    engineIndependence: independence,
    mismatchCount,
    earliestMismatch,
  };
  return Object.freeze({
    ...report,
    reportSha256: sha256Hex(canonicalJson(report)),
    referenceStream,
    candidateStream,
    selectedFields: selection.fields,
    fieldResults: Object.freeze(fieldResults.map((result) => Object.freeze({ ...result }))),
    nonPassCounts: Object.freeze([...nonPassCounts]),
    sampleStore,
    processing: Object.freeze({ ...processing }),
  });
}

function selectionMetadata(selection) {
  return Object.freeze({
    schema: selection.schema,
    id: selection.id,
    includedPrefixes: selection.includedPrefixes,
    excludedPrefixes: selection.excludedPrefixes,
    selectedFieldCount: selection.selectedFieldCount,
    excludedFieldCount: selection.excludedFieldCount,
    streamFieldCount: selection.streamFieldCount,
    streamContractSha256: selection.streamContractSha256,
    comparisonContractSha256: selection.comparisonContractSha256,
  });
}

function mismatchReport(reference, candidate, phase, field) {
  return {
    tick: reference.tick,
    phase: reference.phase,
    phaseOrder: phase.order,
    fieldId: reference.fieldId,
    fieldLabel: field.label,
    sourceOwner: field.sourceOwner,
    reason: mismatchReason(reference, candidate),
    reference: typedValueReport(reference),
    candidate: typedValueReport(candidate),
  };
}

function typedValueReport(sample) {
  return {
    valueType: sample.valueType,
    value: sample.value,
    numericBits: sample.numericBits,
  };
}

function mismatchReason(reference, candidate) {
  if (reference.valueType !== candidate.valueType) return "value-type";
  if (reference.numericBits !== null || candidate.numericBits !== null) return "numeric-bits";
  return "value";
}

function assertComparableHeaders(reference, candidate) {
  if (reference.role !== "reference") throw new ParityComparisonError("The reference stream role must be reference.");
  if (candidate.role !== "candidate") throw new ParityComparisonError("The candidate stream role must be candidate.");
  for (const key of COMMON_BINDINGS) {
    if (reference.bindings[key] !== candidate.bindings[key]) {
      throw new ParityComparisonError(`Reference and candidate ${key} bindings differ.`);
    }
  }
  for (const [name, left, right] of [
    ["tick range", reference.tickRange, candidate.tickRange],
    ["phase contract", reference.phases, candidate.phases],
    ["field contract", reference.fields, candidate.fields],
  ]) {
    if (canonicalJson(left) !== canonicalJson(right)) throw new ParityComparisonError(`Reference and candidate ${name} differ.`);
  }
}

function assertPassingEngineIndependence(independence) {
  if (independence?.status !== "pass" || independence?.check?.status !== "pass" || independence.blockers.length !== 0) {
    throw new ParityComparisonError("zero-substitution-qualification-gap: candidate engine independence is not checked pass.");
  }
}

function assertParsedStream(stream, label) {
  if (!stream || stream.schema !== "cssoccer-parity-stream@1" || !stream.header || !Array.isArray(stream.samples)) {
    throw new ParityComparisonError(`${label} must be a parsed cssoccer parity stream.`);
  }
  if (typeof stream.artifactSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(stream.artifactSha256)) {
    throw new ParityComparisonError(`${label} stream artifact identity is missing.`);
  }
}

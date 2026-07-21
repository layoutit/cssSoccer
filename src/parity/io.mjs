import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { open as openFile } from "node:fs/promises";

export const PARITY_STREAM_SCHEMA = "cssoccer-parity-stream@1";
export const ENGINE_INDEPENDENCE_SCHEMA = "cssoccer-engine-independence@1";

const DEFAULT_STREAM_BUFFER_BYTES = 64 * 1024;
const DEFAULT_MAX_LINE_BYTES = 16 * 1024 * 1024;

const SHA256 = /^[a-f0-9]{64}$/u;
const SCENARIO_ID = /^[a-f0-9]{16}$/u;
const VALUE_TYPES = new Set([
  "i8", "u8", "i16", "u16", "i32", "u32", "i64", "u64",
  "f32", "f64", "bool", "string", "null",
]);
const NUMERIC_TYPES = new Set(["i8", "u8", "i16", "u16", "i32", "u32", "i64", "u64", "f32", "f64"]);
const HEADER_KEYS = [
  "schema", "recordType", "role", "streamId", "generatedAt", "bindings",
  "tickRange", "phases", "fields", "engineIndependence",
];
const SAMPLE_KEYS = [
  "schema", "recordType", "tick", "phase", "fieldId", "valueType", "value", "numericBits",
];
const BINDING_KEYS = [
  "scenarioId", "scenarioSha256", "profileSha256", "inputSha256",
  "sourceSha256", "buildSha256", "contractSha256",
];

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function parityContractSha256({ phases, fields }) {
  return sha256Hex(canonicalJson({
    schema: "cssoccer-parity-field-contract@1",
    coordinateOrder: ["tick", "phase", "field"],
    phases,
    fields,
  }));
}

export function engineIndependenceSubjectSha256(metadata) {
  const subject = {
    schema: metadata.schema,
    status: metadata.status,
    qualifiedAt: metadata.qualifiedAt,
    bindings: metadata.bindings,
    runtimeSnapshotSha256: metadata.runtimeSnapshotSha256,
    preparedInputSha256: metadata.preparedInputSha256,
    harnessSha256: metadata.harnessSha256,
    captureAdapterSha256: metadata.captureAdapterSha256,
    blockers: metadata.blockers,
  };
  return sha256Hex(canonicalJson(subject));
}

export function readParityJsonl(path) {
  return parseParityJsonl(readFileSync(path), { label: path });
}

/**
 * Opens a strict parity JSONL reader without retaining the source file or its
 * sample records in memory. The returned reader validates one sample at a time
 * and exposes the exact full-file SHA-256 only after finish() reaches EOF.
 */
export async function openParityJsonlFile(path, {
  label = path,
  readBufferBytes = DEFAULT_STREAM_BUFFER_BYTES,
  maxLineBytes = DEFAULT_MAX_LINE_BYTES,
} = {}) {
  if (!Number.isSafeInteger(readBufferBytes) || readBufferBytes < 1024) {
    throw new TypeError("readBufferBytes must be an integer of at least 1024 bytes");
  }
  if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes < readBufferBytes) {
    throw new TypeError("maxLineBytes must be an integer at least as large as readBufferBytes");
  }
  const handle = await openFile(path, "r");
  const reader = new ParityJsonlFileReader(handle, path, label, { readBufferBytes, maxLineBytes });
  try {
    await reader.initialize();
    return reader;
  } catch (error) {
    await reader.close();
    throw error;
  }
}

export function parseParityJsonl(input, { label = "parity JSONL" } = {}) {
  const bytes = Buffer.isBuffer(input) ? Buffer.from(input) : Buffer.from(String(input), "utf8");
  if (bytes.length === 0) fail(label, "must not be empty");

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    fail(label, `must be valid UTF-8: ${error.message}`);
  }
  if (text.charCodeAt(0) === 0xfeff) fail(label, "must not start with a UTF-8 BOM");
  if (!text.endsWith("\n")) fail(label, "must be LF terminated");
  text = text.replaceAll("\r\n", "\n");
  if (text.includes("\r")) fail(label, "contains an unsupported bare carriage return");

  const lines = text.slice(0, -1).split("\n");
  if (lines.some((line) => line.length === 0)) fail(label, "contains a blank JSONL record");
  const records = lines.map((line, index) => {
    try {
      const value = JSON.parse(line);
      if (!isPlainObject(value)) fail(`${label}:${index + 1}`, "must be a JSON object");
      return value;
    } catch (error) {
      if (error instanceof ParityDataError) throw error;
      fail(`${label}:${index + 1}`, `contains invalid JSON: ${error.message}`);
    }
  });

  const header = records[0];
  assertExactKeys(header, HEADER_KEYS, `${label}:1`);
  if (header.schema !== PARITY_STREAM_SCHEMA || header.recordType !== "header") {
    fail(`${label}:1`, `must be a ${PARITY_STREAM_SCHEMA} header`);
  }
  validateHeader(header, label);

  const samples = records.slice(1);
  const expectedCount = header.tickRange.count * header.phases.length * header.fields.length;
  if (samples.length !== expectedCount) {
    fail(label, `must contain exactly ${expectedCount} sample records; found ${samples.length}`);
  }

  let sampleIndex = 0;
  for (let tickOffset = 0; tickOffset < header.tickRange.count; tickOffset += 1) {
    const expectedTick = header.tickRange.start + tickOffset;
    for (const phase of header.phases) {
      for (const field of header.fields) {
        const sample = samples[sampleIndex];
        const recordLabel = `${label}:${sampleIndex + 2}`;
        assertExactKeys(sample, SAMPLE_KEYS, recordLabel);
        if (sample.schema !== PARITY_STREAM_SCHEMA || sample.recordType !== "sample") {
          fail(recordLabel, `must be a ${PARITY_STREAM_SCHEMA} sample`);
        }
        if (sample.tick !== expectedTick || sample.phase !== phase.id || sample.fieldId !== field.id) {
          fail(recordLabel, `breaks contiguous tick/phase/field order; expected (${expectedTick}, ${phase.id}, ${field.id})`);
        }
        if (sample.valueType !== field.valueType) {
          fail(recordLabel, `valueType must equal declared field type ${field.valueType}`);
        }
        validateTypedValue(sample, recordLabel);
        sampleIndex += 1;
      }
    }
  }

  return deepFreeze({
    schema: PARITY_STREAM_SCHEMA,
    artifactSha256: sha256Hex(bytes),
    sourceBytes: bytes.length,
    header,
    samples,
  });
}

export class ParityDataError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParityDataError";
  }
}

class ParityJsonlFileReader {
  constructor(handle, path, label, { readBufferBytes, maxLineBytes }) {
    this.handle = handle;
    this.path = path;
    this.label = label;
    this.readBuffer = Buffer.allocUnsafe(readBufferBytes);
    this.maxLineBytes = maxLineBytes;
    this.pending = Buffer.alloc(0);
    this.hash = createHash("sha256");
    this.sourceBytes = 0;
    this.lineNumber = 0;
    this.sampleIndex = 0;
    this.eof = false;
    this.closed = false;
    this.finished = false;
    this.summary = null;
  }

  async initialize() {
    this.initialStat = await this.handle.stat();
    if (!this.initialStat.isFile()) fail(this.label, "must be a regular file");
    const header = await this.#nextRecord();
    if (header === null) fail(this.label, "must not be empty");
    assertExactKeys(header, HEADER_KEYS, `${this.label}:1`);
    if (header.schema !== PARITY_STREAM_SCHEMA || header.recordType !== "header") {
      fail(`${this.label}:1`, `must be a ${PARITY_STREAM_SCHEMA} header`);
    }
    validateHeader(header, this.label);
    this.header = deepFreeze(header);
    this.expectedSampleCount = header.tickRange.count * header.phases.length * header.fields.length;
  }

  async nextSample() {
    if (this.finished) throw new ParityDataError(`${this.label} reader is already finished`);
    if (this.sampleIndex >= this.expectedSampleCount) {
      fail(this.label, `contains more than ${this.expectedSampleCount} sample records`);
    }
    const sample = await this.#nextRecord();
    if (sample === null) {
      fail(this.label, `must contain exactly ${this.expectedSampleCount} sample records; found ${this.sampleIndex}`);
    }
    const recordLabel = `${this.label}:${this.lineNumber}`;
    assertExactKeys(sample, SAMPLE_KEYS, recordLabel);
    if (sample.schema !== PARITY_STREAM_SCHEMA || sample.recordType !== "sample") {
      fail(recordLabel, `must be a ${PARITY_STREAM_SCHEMA} sample`);
    }

    const fieldsPerPhase = this.header.fields.length;
    const samplesPerTick = this.header.phases.length * fieldsPerPhase;
    const tickOffset = Math.floor(this.sampleIndex / samplesPerTick);
    const withinTick = this.sampleIndex % samplesPerTick;
    const phaseIndex = Math.floor(withinTick / fieldsPerPhase);
    const fieldIndex = withinTick % fieldsPerPhase;
    const expectedTick = this.header.tickRange.start + tickOffset;
    const expectedPhase = this.header.phases[phaseIndex].id;
    const expectedField = this.header.fields[fieldIndex];
    if (sample.tick !== expectedTick || sample.phase !== expectedPhase || sample.fieldId !== expectedField.id) {
      fail(recordLabel, `breaks contiguous tick/phase/field order; expected (${expectedTick}, ${expectedPhase}, ${expectedField.id})`);
    }
    if (sample.valueType !== expectedField.valueType) {
      fail(recordLabel, `valueType must equal declared field type ${expectedField.valueType}`);
    }
    validateTypedValue(sample, recordLabel);
    this.sampleIndex += 1;
    return sample;
  }

  async finish() {
    if (this.finished) return this.summary;
    if (this.sampleIndex !== this.expectedSampleCount) {
      fail(this.label, `must contain exactly ${this.expectedSampleCount} sample records; found ${this.sampleIndex}`);
    }
    const extra = await this.#nextRecord();
    if (extra !== null) fail(this.label, `must contain exactly ${this.expectedSampleCount} sample records; found at least ${this.sampleIndex + 1}`);
    const finalStat = await this.handle.stat();
    for (const key of ["dev", "ino", "size", "mtimeMs", "ctimeMs"]) {
      if (finalStat[key] !== this.initialStat[key]) fail(this.label, "changed while it was being read");
    }
    const artifactSha256 = this.hash.digest("hex");
    this.finished = true;
    this.summary = deepFreeze({
      schema: PARITY_STREAM_SCHEMA,
      artifactSha256,
      sourceBytes: this.sourceBytes,
      header: this.header,
      retainedSampleCount: 0,
      ingestion: "streaming-strict-jsonl",
    });
    await this.close();
    return this.summary;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.handle.close();
  }

  async #nextRecord() {
    const line = await this.#nextLine();
    if (line === null) return null;
    this.lineNumber += 1;
    try {
      const value = JSON.parse(line);
      if (!isPlainObject(value)) fail(`${this.label}:${this.lineNumber}`, "must be a JSON object");
      return value;
    } catch (error) {
      if (error instanceof ParityDataError) throw error;
      fail(`${this.label}:${this.lineNumber}`, `contains invalid JSON: ${error.message}`);
    }
  }

  async #nextLine() {
    while (true) {
      const newline = this.pending.indexOf(0x0a);
      if (newline !== -1) {
        let bytes = this.pending.subarray(0, newline);
        this.pending = this.pending.subarray(newline + 1);
        if (bytes.length > this.maxLineBytes) fail(this.label, `contains a JSONL record larger than ${this.maxLineBytes} bytes`);
        if (this.lineNumber === 0 && bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
          fail(this.label, "must not start with a UTF-8 BOM");
        }
        if (bytes.at(-1) === 0x0d) bytes = bytes.subarray(0, -1);
        if (bytes.length === 0) fail(this.label, "contains a blank JSONL record");
        if (bytes.includes(0x0d)) fail(this.label, "contains an unsupported bare carriage return");
        try {
          return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch (error) {
          fail(this.label, `must be valid UTF-8: ${error.message}`);
        }
      }
      if (this.eof) {
        if (this.pending.length !== 0) fail(this.label, "must be LF terminated");
        return null;
      }
      const { bytesRead } = await this.handle.read(this.readBuffer, 0, this.readBuffer.length, null);
      if (bytesRead === 0) {
        this.eof = true;
        continue;
      }
      const chunk = Buffer.from(this.readBuffer.subarray(0, bytesRead));
      this.hash.update(chunk);
      this.sourceBytes += bytesRead;
      this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
      if (this.pending.length > this.maxLineBytes && this.pending.indexOf(0x0a) === -1) {
        fail(this.label, `contains a JSONL record larger than ${this.maxLineBytes} bytes`);
      }
    }
  }
}

function validateHeader(header, label) {
  if (!new Set(["reference", "candidate"]).has(header.role)) fail(`${label}:1.role`, "must be reference or candidate");
  textValue(header.streamId, `${label}:1.streamId`, 160);
  timestamp(header.generatedAt, `${label}:1.generatedAt`);
  validateBindings(header.bindings, `${label}:1.bindings`);

  assertExactKeys(header.tickRange, ["start", "count"], `${label}:1.tickRange`);
  safeInteger(header.tickRange.start, `${label}:1.tickRange.start`, { minimum: 0 });
  safeInteger(header.tickRange.count, `${label}:1.tickRange.count`, { minimum: 1 });

  if (!Array.isArray(header.phases) || header.phases.length === 0) fail(`${label}:1.phases`, "must be a non-empty array");
  const phaseIds = new Set();
  header.phases.forEach((phase, index) => {
    const phaseLabel = `${label}:1.phases[${index}]`;
    assertExactKeys(phase, ["id", "order"], phaseLabel);
    textValue(phase.id, `${phaseLabel}.id`, 160);
    if (phaseIds.has(phase.id)) fail(`${phaseLabel}.id`, "must be unique");
    phaseIds.add(phase.id);
    if (phase.order !== index) fail(`${phaseLabel}.order`, `must be contiguous and equal ${index}`);
  });

  if (!Array.isArray(header.fields) || header.fields.length === 0) fail(`${label}:1.fields`, "must be a non-empty array");
  let previousId = "";
  header.fields.forEach((field, index) => {
    const fieldLabel = `${label}:1.fields[${index}]`;
    assertExactKeys(field, ["id", "label", "sourceOwner", "meaning", "unit", "valueType"], fieldLabel);
    textValue(field.id, `${fieldLabel}.id`, 160);
    if (previousId && field.id.localeCompare(previousId) <= 0) fail(`${fieldLabel}.id`, "must be unique and lexicographically ordered");
    previousId = field.id;
    textValue(field.label, `${fieldLabel}.label`, 160);
    textValue(field.sourceOwner, `${fieldLabel}.sourceOwner`, 500);
    textValue(field.meaning, `${fieldLabel}.meaning`, 2000);
    if (field.unit !== null) textValue(field.unit, `${fieldLabel}.unit`, 80);
    if (!VALUE_TYPES.has(field.valueType)) fail(`${fieldLabel}.valueType`, "uses an unsupported typed value");
  });

  const expectedContract = parityContractSha256(header);
  if (header.bindings.contractSha256 !== expectedContract) {
    fail(`${label}:1.bindings.contractSha256`, "does not bind the declared phase and field contract");
  }

  if (header.role === "reference") {
    if (header.engineIndependence !== null) fail(`${label}:1.engineIndependence`, "must be null for a reference stream");
  } else {
    validateEngineIndependence(header.engineIndependence, header.bindings, header.generatedAt, `${label}:1.engineIndependence`);
  }
}

function validateBindings(bindings, label) {
  assertExactKeys(bindings, BINDING_KEYS, label);
  if (typeof bindings.scenarioId !== "string" || !SCENARIO_ID.test(bindings.scenarioId)) {
    fail(`${label}.scenarioId`, "must be a lowercase 16-character hexadecimal id");
  }
  for (const key of BINDING_KEYS.slice(1)) digest(bindings[key], `${label}.${key}`);
  if (bindings.scenarioId !== bindings.scenarioSha256.slice(0, 16)) {
    fail(`${label}.scenarioId`, "must equal the first 16 hexadecimal characters of scenarioSha256");
  }
}

function validateEngineIndependence(metadata, bindings, generatedAt, label) {
  const keys = [
    "schema", "status", "qualifiedAt", "bindings", "runtimeSnapshotSha256",
    "preparedInputSha256", "harnessSha256", "captureAdapterSha256", "check", "blockers",
  ];
  assertExactKeys(metadata, keys, label);
  if (metadata.schema !== ENGINE_INDEPENDENCE_SCHEMA) fail(`${label}.schema`, `must equal ${ENGINE_INDEPENDENCE_SCHEMA}`);
  if (!new Set(["pass", "blocked"]).has(metadata.status)) fail(`${label}.status`, "must be pass or blocked");
  timestamp(metadata.qualifiedAt, `${label}.qualifiedAt`);
  if (Date.parse(metadata.qualifiedAt) > Date.parse(generatedAt)) fail(`${label}.qualifiedAt`, "must not be newer than the capture");
  validateBindings(metadata.bindings, `${label}.bindings`);
  if (canonicalJson(metadata.bindings) !== canonicalJson(bindings)) fail(`${label}.bindings`, "must exactly match the candidate stream bindings");
  for (const key of ["runtimeSnapshotSha256", "preparedInputSha256", "harnessSha256", "captureAdapterSha256"]) {
    digest(metadata[key], `${label}.${key}`);
  }
  if (metadata.runtimeSnapshotSha256 !== bindings.buildSha256) fail(`${label}.runtimeSnapshotSha256`, "must bind the candidate build snapshot");
  if (metadata.preparedInputSha256 !== bindings.inputSha256) fail(`${label}.preparedInputSha256`, "must bind the candidate prepared input");

  assertExactKeys(metadata.check, ["status", "id", "sha256", "subjectSha256"], `${label}.check`);
  if (!new Set(["pass", "fail", "missing"]).has(metadata.check.status)) fail(`${label}.check.status`, "must be pass, fail, or missing");
  textValue(metadata.check.id, `${label}.check.id`, 160);
  digest(metadata.check.sha256, `${label}.check.sha256`);
  digest(metadata.check.subjectSha256, `${label}.check.subjectSha256`);
  if (metadata.check.subjectSha256 !== engineIndependenceSubjectSha256(metadata)) {
    fail(`${label}.check.subjectSha256`, "does not attest the complete engine-independence subject");
  }
  if (!Array.isArray(metadata.blockers)) fail(`${label}.blockers`, "must be an array");
  metadata.blockers.forEach((blocker, index) => textValue(blocker, `${label}.blockers[${index}]`, 1000));
  if (metadata.status === "pass" && (metadata.check.status !== "pass" || metadata.blockers.length !== 0)) {
    fail(label, "a passing qualification needs a passing check and no blockers");
  }
  if (metadata.status === "blocked" && (metadata.check.status === "pass" || metadata.blockers.length === 0)) {
    fail(label, "a blocked qualification needs a non-passing check and at least one blocker");
  }
}

function validateTypedValue(sample, label) {
  const { valueType, value, numericBits } = sample;
  if (!VALUE_TYPES.has(valueType)) fail(`${label}.valueType`, "uses an unsupported typed value");
  if (NUMERIC_TYPES.has(valueType)) {
    const width = Number(valueType.slice(1));
    if (typeof numericBits !== "string" || !new RegExp(`^[a-f0-9]{${width / 4}}$`, "u").test(numericBits)) {
      fail(`${label}.numericBits`, `must be a lowercase ${width}-bit hexadecimal string`);
    }
    const expected = numericBitsFor(valueType, value, `${label}.value`);
    if (numericBits !== expected) fail(`${label}.numericBits`, `does not encode ${valueType} value ${String(value)}`);
    return;
  }
  if (numericBits !== null) fail(`${label}.numericBits`, "must be null for a non-numeric value");
  if (valueType === "bool" && typeof value !== "boolean") fail(`${label}.value`, "must be boolean");
  if (valueType === "string" && typeof value !== "string") fail(`${label}.value`, "must be a string");
  if (valueType === "null" && value !== null) fail(`${label}.value`, "must be null");
}

function numericBitsFor(valueType, value, label) {
  if (valueType === "f32" || valueType === "f64") {
    if (typeof value !== "number" || !Number.isFinite(value)) fail(label, `must be a finite ${valueType} number`);
    if (valueType === "f32" && !Object.is(Math.fround(value), value)) fail(label, "must be exactly representable as f32");
    const bytes = Buffer.allocUnsafe(valueType === "f32" ? 4 : 8);
    if (valueType === "f32") bytes.writeFloatBE(value);
    else bytes.writeDoubleBE(value);
    return bytes.toString("hex");
  }

  const width = Number(valueType.slice(1));
  const signed = valueType.startsWith("i");
  let integer;
  if (width === 64) {
    if (typeof value !== "string" || !/^-?(0|[1-9][0-9]*)$/u.test(value) || value === "-0") {
      fail(label, `${valueType} values must use a canonical decimal string`);
    }
    integer = BigInt(value);
  } else {
    if (!Number.isSafeInteger(value)) fail(label, `must be a safe integer for ${valueType}`);
    integer = BigInt(value);
  }
  const minimum = signed ? -(1n << BigInt(width - 1)) : 0n;
  const maximum = signed ? (1n << BigInt(width - 1)) - 1n : (1n << BigInt(width)) - 1n;
  if (integer < minimum || integer > maximum) fail(label, `is outside the ${valueType} range`);
  return BigInt.asUintN(width, integer).toString(16).padStart(width / 4, "0");
}

function assertExactKeys(value, keys, label) {
  if (!isPlainObject(value)) fail(label, "must be an object");
  const expected = new Set(keys);
  for (const key of Object.keys(value)) if (!expected.has(key)) fail(`${label}.${key}`, "is not supported");
  for (const key of expected) if (!Object.hasOwn(value, key)) fail(`${label}.${key}`, "is required");
}

function textValue(value, label, maximum) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) {
    fail(label, `must be a non-empty string of at most ${maximum} characters`);
  }
}

function timestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) fail(label, "must be a parseable timestamp");
}

function safeInteger(value, label, { minimum }) {
  if (!Number.isSafeInteger(value) || value < minimum) fail(label, `must be a safe integer greater than or equal to ${minimum}`);
}

function digest(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(label, "must be a lowercase SHA-256 digest");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function fail(label, message) {
  throw new ParityDataError(`${label} ${message}`);
}

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

export const COMPILED_PATH_QUERY_SCHEMA = "cssoccer-compiled-path-query@1";
export const COMPILED_PATH_EVIDENCE_SCHEMA = "cssoccer-compiled-path-evidence@1";
export const COMPILED_PATH_PROBE_SCHEMA = "cssoccer-compiled-path-probe@1";
export const PROBE_MAGIC = "CSSQRY1\0";
export const PROBE_VERSION = 1;
export const PROBE_HEADER_BYTES = 32;
export const PROBE_ENTRY_BYTES = 12;
export const PROBE_FLAG_READ_ONLY = 1;
export const MAX_PROBE_RANGES = 64;
export const MAX_PROBE_RANGE_BYTES = 64 * 1024;
export const MAX_PROBE_TOTAL_BYTES = 1024 * 1024;

const VALUE_TYPE_CODES = Object.freeze({
  i8: 1,
  u8: 2,
  i16: 3,
  u16: 4,
  i32: 5,
  u32: 6,
  f32: 7,
  f64: 8,
});

const VALUE_TYPE_BYTES = Object.freeze({
  i8: 1,
  u8: 1,
  i16: 2,
  u16: 2,
  i32: 4,
  u32: 4,
  f32: 4,
  f64: 8,
});

export class CompiledPathInspectorError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "CompiledPathInspectorError";
    this.code = code;
    this.details = details;
  }
}

export function parseWatcomMap(text) {
  if (typeof text !== "string" || text.length === 0) {
    throw new TypeError("Watcom map text must be non-empty.");
  }
  const entries = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    const match = line.match(/^\s*([0-9a-f]{4}):([0-9a-f]{8})(\+?)\s+(.+?)\s*$/iu);
    if (!match) continue;
    entries.push(Object.freeze({
      line: index + 1,
      segment: match[1].toLowerCase(),
      offset: Number.parseInt(match[2], 16),
      movable: match[3] === "+",
      declaration: match[4],
      raw: line,
    }));
  }
  if (entries.length === 0) {
    throw new CompiledPathInspectorError("watcom-map-empty", "No Watcom map entries were recognized.");
  }
  return Object.freeze(entries);
}

export function selectWatcomMapSymbol(entries, name) {
  requireSymbolName(name, "map symbol");
  if (!Array.isArray(entries)) throw new TypeError("Watcom map entries must be an array.");
  const pattern = symbolPattern(name);
  const matches = entries.filter(({ declaration }) => pattern.test(declaration));
  const unique = dedupeBy(matches, ({ segment, offset }) => `${segment}:${offset}`);
  if (unique.length === 0) {
    throw new CompiledPathInspectorError(
      "map-symbol-missing",
      `Watcom map symbol ${name} was not found.`,
      { symbol: name },
    );
  }
  if (unique.length !== 1) {
    throw new CompiledPathInspectorError(
      "map-symbol-ambiguous",
      `Watcom map symbol ${name} resolved to ${unique.length} addresses.`,
      {
        symbol: name,
        matches: unique.map(({ segment, offset, line, declaration }) => ({
          segment,
          offset,
          line,
          declaration,
        })),
      },
    );
  }
  return unique[0];
}

export function parseWatcomRoutine(listingText, functionName) {
  if (typeof listingText !== "string" || listingText.length === 0) {
    throw new TypeError("Watcom listing text must be non-empty.");
  }
  requireSymbolName(functionName, "function");
  const lines = listingText.split(/\r?\n/u);
  const namePattern = symbolPattern(functionName);
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*([0-9a-f]{8})\s+(.+):\s*$/iu);
    if (!match || !namePattern.test(match[2])) continue;
    starts.push({ index, offset: Number.parseInt(match[1], 16), declaration: match[2] });
  }
  if (starts.length === 0) {
    throw new CompiledPathInspectorError(
      "listing-function-missing",
      `Function ${functionName} was not found in the Watcom listing.`,
      { function: functionName },
    );
  }
  if (starts.length !== 1) {
    throw new CompiledPathInspectorError(
      "listing-function-ambiguous",
      `Function ${functionName} resolved to ${starts.length} listing routines.`,
      { function: functionName, declarations: starts.map(({ declaration }) => declaration) },
    );
  }
  const [start] = starts;
  let endIndex = -1;
  let declaredBytes = null;
  for (let index = start.index + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/Routine Size:\s*(\d+)\s+bytes/iu);
    if (!match) continue;
    endIndex = index;
    declaredBytes = Number(match[1]);
    break;
  }
  if (endIndex < 0) {
    throw new CompiledPathInspectorError(
      "listing-routine-unterminated",
      `Function ${functionName} has no Routine Size boundary in the Watcom listing.`,
      { function: functionName, line: start.index + 1 },
    );
  }
  const instructions = [];
  for (let index = start.index + 1; index < endIndex; index += 1) {
    const instruction = parseInstructionLine(lines[index], index + 1);
    if (instruction) instructions.push(instruction);
  }
  if (instructions.length === 0) {
    throw new CompiledPathInspectorError(
      "listing-routine-empty",
      `Function ${functionName} contains no recognized instructions.`,
      { function: functionName },
    );
  }
  return Object.freeze({
    function: functionName,
    declaration: start.declaration,
    objectOffset: start.offset,
    declaredBytes,
    startLine: start.index + 1,
    endLine: endIndex + 1,
    instructions: Object.freeze(instructions),
    raw: lines.slice(start.index, endIndex + 1).join("\n"),
  });
}

export function analyzeWatcomRoutine(routine, requestedSymbols = []) {
  if (!routine || !Array.isArray(routine.instructions)) {
    throw new TypeError("A parsed Watcom routine is required.");
  }
  const f32Stores = routine.instructions
    .filter(({ mnemonic, operands }) => mnemonic === "fstp" && /^dword ptr\b/iu.test(operands))
    .map(({ offset, line, operands, raw }) => Object.freeze({
      offset,
      line,
      target: operands.replace(/^dword ptr\s*/iu, ""),
      raw: raw.trim(),
    }));
  const f64Stores = routine.instructions
    .filter(({ mnemonic, operands }) => mnemonic === "fstp" && /^qword ptr\b/iu.test(operands))
    .map(({ offset, line, operands, raw }) => Object.freeze({
      offset,
      line,
      target: operands.replace(/^qword ptr\s*/iu, ""),
      raw: raw.trim(),
    }));
  const x87InstructionCount = routine.instructions.filter(({ mnemonic }) => /^f/iu.test(mnemonic)).length;
  const symbols = requestedSymbols.map((request) => {
    const normalized = normalizeSymbolRequest(request);
    const pattern = symbolPattern(normalized.name);
    const references = routine.instructions
      .flatMap((instruction, index) => pattern.test(instruction.raw) ? [Object.freeze({
        offset: instruction.offset,
        line: instruction.line,
        mnemonic: instruction.mnemonic,
        operands: instruction.operands,
        raw: instruction.raw.trim(),
        nextF32Store: findNextF32Store(routine.instructions, index),
      })] : []);
    const nextF32Stores = dedupeBy(
      references.flatMap(({ nextF32Store }) => nextF32Store ? [nextF32Store] : []),
      ({ offset }) => offset,
    );
    return Object.freeze({
      ...normalized,
      referenced: references.length > 0,
      references: Object.freeze(references),
      nextF32Stores: Object.freeze(nextF32Stores),
    });
  });
  return Object.freeze({
    instructionCount: routine.instructions.length,
    x87InstructionCount,
    f32Stores: Object.freeze(f32Stores),
    f64Stores: Object.freeze(f64Stores),
    symbols: Object.freeze(symbols),
  });
}

export function inferMapValueType(declaration) {
  if (typeof declaration !== "string") return null;
  const normalized = declaration.toLowerCase();
  const unsigned = /\bunsigned\b/u.test(normalized);
  if (/\bfloat\b/u.test(normalized)) return "f32";
  if (/\bdouble\b/u.test(normalized)) return "f64";
  if (/\bchar\b/u.test(normalized)) return unsigned ? "u8" : "i8";
  if (/\bshort\b/u.test(normalized)) return unsigned ? "u16" : "i16";
  if (/\bint\b/u.test(normalized) || /\blong\b/u.test(normalized)) return unsigned ? "u32" : "i32";
  return null;
}

export function valueTypeBytes(valueType) {
  const bytes = VALUE_TYPE_BYTES[valueType];
  if (!bytes) {
    throw new CompiledPathInspectorError(
      "value-type-unsupported",
      `Unsupported compiled-path value type ${String(valueType)}.`,
      { valueType },
    );
  }
  return bytes;
}

export function normalizeCaptureRanges(ranges) {
  if (!Array.isArray(ranges)) throw new TypeError("Capture ranges must be an array.");
  const normalized = ranges.map((range, index) => {
    if (!isPlainObject(range)) throw new TypeError(`Capture range ${index} must be an object.`);
    const offset = toUint32(range.offset, `capture range ${index} offset`);
    const bytes = toPositiveUint32(range.bytes ?? range.size, `capture range ${index} bytes`);
    if (offset + bytes > 0x1_0000_0000) {
      throw new RangeError(`Capture range ${index} exceeds the 32-bit address space.`);
    }
    return Object.freeze({ offset, bytes, endExclusive: offset + bytes });
  });
  return Object.freeze(normalized.sort((left, right) => left.offset - right.offset));
}

export function locateCaptureCoverage({ offset, bytes, ranges }) {
  const start = toUint32(offset, "symbol offset");
  const size = toPositiveUint32(bytes, "symbol bytes");
  const endExclusive = start + size;
  if (endExclusive > 0x1_0000_0000) throw new RangeError("Symbol range exceeds the 32-bit address space.");
  const normalized = normalizeCaptureRanges(ranges);
  const containing = normalized.find((range) => start >= range.offset && endExclusive <= range.endExclusive);
  if (containing) {
    return Object.freeze({
      status: "retained",
      range: containing,
      startDeltaBytes: start - containing.offset,
      uncoveredGapBytes: 0,
    });
  }
  const nearest = normalized
    .map((range) => {
      if (endExclusive <= range.offset) {
        return {
          range,
          direction: "before",
          startDeltaBytes: range.offset - start,
          uncoveredGapBytes: range.offset - endExclusive,
        };
      }
      if (start >= range.endExclusive) {
        return {
          range,
          direction: "after",
          startDeltaBytes: start - range.offset,
          uncoveredGapBytes: start - range.endExclusive,
        };
      }
      return { range, direction: "overlap", startDeltaBytes: 0, uncoveredGapBytes: 0 };
    })
    .sort((left, right) => left.uncoveredGapBytes - right.uncoveredGapBytes)[0] ?? null;
  return Object.freeze({ status: "probe-required", nearest });
}

export function valueAtJsonPath(value, dottedPath) {
  if (typeof dottedPath !== "string" || dottedPath.trim() === "") {
    throw new TypeError("A non-empty dotted JSON path is required.");
  }
  let current = value;
  for (const key of dottedPath.split(".")) {
    if (!isPlainObject(current) && !Array.isArray(current)) {
      throw new CompiledPathInspectorError(
        "json-path-missing",
        `JSON path ${dottedPath} does not resolve to a value.`,
        { path: dottedPath, key },
      );
    }
    if (!Object.hasOwn(current, key)) {
      throw new CompiledPathInspectorError(
        "json-path-missing",
        `JSON path ${dottedPath} is missing ${key}.`,
        { path: dottedPath, key },
      );
    }
    current = current[key];
  }
  return current;
}

export function createProbeManifest({
  stopActiveTick,
  symbols,
  dgroupSegment,
  bindings,
  artifactBindings,
  frontier,
}) {
  const stop = normalizeProbeStop(stopActiveTick);
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new CompiledPathInspectorError("probe-symbols-empty", "A probe needs at least one symbol.");
  }
  requireNonEmptyObject(bindings, "probe bindings");
  requireNonEmptyObject(artifactBindings, "probe artifact bindings");
  requireNonEmptyObject(frontier, "probe frontier");
  if (typeof dgroupSegment !== "string" || !/^[0-9a-f]{4}$/iu.test(dgroupSegment)) {
    throw new CompiledPathInspectorError(
      "probe-dgroup-segment-missing",
      "A probe requires the exact Watcom DGROUP segment from its retained link profile.",
    );
  }
  const normalizedDgroupSegment = dgroupSegment.toLowerCase();
  const reads = symbols.map((symbol, index) => {
    if (!isPlainObject(symbol)) throw new TypeError(`Probe symbol ${index} must be an object.`);
    requireSymbolName(symbol.name, `probe symbol ${index}`);
    const valueType = symbol.valueType;
    const expectedBytes = valueTypeBytes(valueType);
    const bytes = symbol.bytes ?? expectedBytes;
    if (bytes !== expectedBytes) {
      throw new CompiledPathInspectorError(
        "probe-value-width-mismatch",
        `Probe symbol ${symbol.name} declares ${bytes} bytes for ${valueType}; expected ${expectedBytes}.`,
        { symbol: symbol.name, valueType, bytes, expectedBytes },
      );
    }
    const segment = String(symbol.segment).toLowerCase();
    if (segment !== normalizedDgroupSegment) {
      throw new CompiledPathInspectorError(
        "probe-address-space-mismatch",
        `Probe symbol ${symbol.name} is in segment ${segment}, not retained DGROUP ${normalizedDgroupSegment}.`,
        { symbol: symbol.name, segment, dgroupSegment: normalizedDgroupSegment },
      );
    }
    return Object.freeze({
      index,
      name: symbol.name,
      addressSpace: "dgroup",
      segment,
      offset: toUint32(symbol.offset, `probe symbol ${symbol.name} offset`),
      bytes: toPositiveUint32(bytes, `probe symbol ${symbol.name} bytes`),
      valueType,
    });
  });
  validateProbeReads(reads);
  const bindingSha256 = sha256Canonical({
    bindings,
    artifactBindings,
    frontier,
    stopActiveTick: stop,
    dgroupSegment: normalizedDgroupSegment,
    reads,
  });
  return deepFreeze({
    schema: COMPILED_PATH_PROBE_SCHEMA,
    version: PROBE_VERSION,
    mode: "read-only",
    bindingSha256,
    stop: {
      source: "retained-frontier",
      activeTick: stop,
    },
    addressSpace: {
      kind: "watcom-dgroup",
      segment: normalizedDgroupSegment,
    },
    bindings,
    artifactBindings,
    frontier,
    reads,
    constraints: {
      memoryWrites: false,
      replayValueInjection: false,
      runtimeStateCorrection: false,
      maximumRanges: MAX_PROBE_RANGES,
      maximumTotalBytes: MAX_PROBE_TOTAL_BYTES,
    },
  });
}

export function encodeProbeManifest(manifest) {
  if (!isPlainObject(manifest) || manifest.schema !== COMPILED_PATH_PROBE_SCHEMA) {
    throw new CompiledPathInspectorError("probe-schema-invalid", `Probe must use ${COMPILED_PATH_PROBE_SCHEMA}.`);
  }
  if (manifest.mode !== "read-only") {
    throw new CompiledPathInspectorError("probe-mode-invalid", "Compiled-path probes must be read-only.");
  }
  const reads = manifest.reads;
  validateProbeReads(reads);
  const stopActiveTick = normalizeProbeStop(manifest.stop?.activeTick);
  const totalBytes = reads.reduce((sum, read) => sum + read.bytes, 0);
  const encoded = Buffer.alloc(PROBE_HEADER_BYTES + reads.length * PROBE_ENTRY_BYTES);
  encoded.write(PROBE_MAGIC, 0, "latin1");
  encoded.writeUInt32LE(PROBE_VERSION, 8);
  encoded.writeUInt32LE(PROBE_HEADER_BYTES, 12);
  encoded.writeUInt32LE(stopActiveTick, 16);
  encoded.writeUInt32LE(reads.length, 20);
  encoded.writeUInt32LE(totalBytes, 24);
  encoded.writeUInt32LE(PROBE_FLAG_READ_ONLY, 28);
  for (const [index, read] of reads.entries()) {
    const base = PROBE_HEADER_BYTES + index * PROBE_ENTRY_BYTES;
    encoded.writeUInt32LE(read.offset, base);
    encoded.writeUInt32LE(read.bytes, base + 4);
    encoded.writeUInt32LE(VALUE_TYPE_CODES[read.valueType], base + 8);
  }
  return encoded;
}

export function decodeProbeManifest(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("Probe bytes must be a Buffer.");
  if (buffer.length < PROBE_HEADER_BYTES) {
    throw new CompiledPathInspectorError("probe-binary-short", "Probe binary is shorter than its header.");
  }
  if (buffer.subarray(0, 8).toString("latin1") !== PROBE_MAGIC) {
    throw new CompiledPathInspectorError("probe-binary-magic", "Probe binary magic is invalid.");
  }
  const version = buffer.readUInt32LE(8);
  const headerBytes = buffer.readUInt32LE(12);
  const stopActiveTick = buffer.readUInt32LE(16);
  const rangeCount = buffer.readUInt32LE(20);
  const totalBytes = buffer.readUInt32LE(24);
  const flags = buffer.readUInt32LE(28);
  if (version !== PROBE_VERSION || headerBytes !== PROBE_HEADER_BYTES || flags !== PROBE_FLAG_READ_ONLY) {
    throw new CompiledPathInspectorError(
      "probe-binary-header",
      "Probe binary header version, size, or flags are invalid.",
      { version, headerBytes, flags },
    );
  }
  normalizeProbeStop(stopActiveTick);
  if (rangeCount > MAX_PROBE_RANGES || buffer.length !== headerBytes + rangeCount * PROBE_ENTRY_BYTES) {
    throw new CompiledPathInspectorError(
      "probe-binary-length",
      "Probe binary range count does not match its length.",
      { rangeCount, bytes: buffer.length },
    );
  }
  const codeToType = new Map(Object.entries(VALUE_TYPE_CODES).map(([type, code]) => [code, type]));
  const reads = [];
  let computedTotal = 0;
  for (let index = 0; index < rangeCount; index += 1) {
    const base = headerBytes + index * PROBE_ENTRY_BYTES;
    const offset = buffer.readUInt32LE(base);
    const bytes = buffer.readUInt32LE(base + 4);
    const typeCode = buffer.readUInt32LE(base + 8);
    const valueType = codeToType.get(typeCode);
    if (!valueType) {
      throw new CompiledPathInspectorError("probe-binary-type", `Probe binary value type code ${typeCode} is invalid.`);
    }
    reads.push({ index, offset, bytes, valueType });
    computedTotal += bytes;
  }
  if (computedTotal !== totalBytes) {
    throw new CompiledPathInspectorError(
      "probe-binary-total",
      "Probe binary total byte count is inconsistent.",
      { totalBytes, computedTotal },
    );
  }
  validateProbeReads(reads);
  return deepFreeze({ version, headerBytes, stopActiveTick, rangeCount, totalBytes, flags, reads });
}

export async function fileEvidence(path) {
  const absolute = resolve(path);
  const [bytes, metadata] = await Promise.all([readFile(absolute), stat(absolute)]);
  if (!metadata.isFile()) throw new TypeError(`Evidence path is not a file: ${absolute}`);
  return Object.freeze({
    path: absolute,
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
}

export function verifyExpectedArtifact(evidence, expectedSha256, label) {
  if (!expectedSha256) {
    throw new CompiledPathInspectorError(
      "artifact-binding-missing",
      `${label} needs an expected SHA-256 from the retained profile.`,
      { label, actualSha256: evidence.sha256 },
    );
  }
  if (!/^[0-9a-f]{64}$/u.test(expectedSha256)) {
    throw new CompiledPathInspectorError("artifact-binding-invalid", `${label} expected SHA-256 is invalid.`);
  }
  if (evidence.sha256 !== expectedSha256) {
    throw new CompiledPathInspectorError(
      "artifact-binding-mismatch",
      `${label} does not match its retained-profile SHA-256.`,
      { label, expectedSha256, actualSha256: evidence.sha256 },
    );
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Canonical(value) {
  return sha256(Buffer.from(canonicalJson(value)));
}

export function canonicalJson(value) {
  return JSON.stringify(sortCanonical(value));
}

function parseInstructionLine(line, lineNumber) {
  const match = line.match(/^\s*([0-9a-f]{8})\s+((?:(?:[0-9a-f]{2})[ \t]+)+)([a-z][a-z0-9]*)\s*(.*?)\s*$/iu);
  if (!match) return null;
  return Object.freeze({
    offset: Number.parseInt(match[1], 16),
    line: lineNumber,
    bytes: match[2].trim().replace(/[ \t]+/gu, " ").toLowerCase(),
    mnemonic: match[3].toLowerCase(),
    operands: match[4],
    raw: line,
  });
}

function normalizeSymbolRequest(request) {
  if (typeof request === "string") {
    requireSymbolName(request, "requested symbol");
    return { name: request, valueType: null };
  }
  if (!isPlainObject(request)) throw new TypeError("Requested symbol must be a name or object.");
  requireSymbolName(request.name, "requested symbol");
  if (request.valueType !== undefined && request.valueType !== null) valueTypeBytes(request.valueType);
  return { name: request.name, valueType: request.valueType ?? null };
}

function findNextF32Store(instructions, referenceIndex) {
  const lastIndex = Math.min(instructions.length, referenceIndex + 25);
  for (let index = referenceIndex + 1; index < lastIndex; index += 1) {
    const instruction = instructions[index];
    if (instruction.mnemonic === "ret") return null;
    if (instruction.mnemonic === "fstp" && /^dword ptr\b/iu.test(instruction.operands)) {
      return Object.freeze({
        offset: instruction.offset,
        line: instruction.line,
        target: instruction.operands.replace(/^dword ptr\s*/iu, ""),
        raw: instruction.raw.trim(),
      });
    }
  }
  return null;
}

function validateProbeReads(reads) {
  if (!Array.isArray(reads) || reads.length === 0 || reads.length > MAX_PROBE_RANGES) {
    throw new CompiledPathInspectorError(
      "probe-range-count",
      `Probe range count must be between 1 and ${MAX_PROBE_RANGES}.`,
      { count: Array.isArray(reads) ? reads.length : null },
    );
  }
  let totalBytes = 0;
  let previousEnd = 0;
  for (const [index, read] of reads.entries()) {
    if (!isPlainObject(read)) throw new TypeError(`Probe read ${index} must be an object.`);
    const offset = toUint32(read.offset, `probe read ${index} offset`);
    const bytes = toPositiveUint32(read.bytes, `probe read ${index} bytes`);
    valueTypeBytes(read.valueType);
    if (bytes > MAX_PROBE_RANGE_BYTES) {
      throw new CompiledPathInspectorError(
        "probe-range-large",
        `Probe read ${index} exceeds ${MAX_PROBE_RANGE_BYTES} bytes.`,
        { index, bytes },
      );
    }
    if (offset + bytes > 0x1_0000_0000) {
      throw new CompiledPathInspectorError("probe-range-overflow", `Probe read ${index} overflows 32-bit memory.`);
    }
    if (index > 0 && offset < previousEnd) {
      throw new CompiledPathInspectorError(
        "probe-range-order",
        "Probe reads must be sorted and non-overlapping.",
        { index, offset, previousEnd },
      );
    }
    previousEnd = offset + bytes;
    totalBytes += bytes;
  }
  if (totalBytes > MAX_PROBE_TOTAL_BYTES) {
    throw new CompiledPathInspectorError(
      "probe-total-large",
      `Probe reads exceed ${MAX_PROBE_TOTAL_BYTES} total bytes.`,
      { totalBytes },
    );
  }
}

function requireSymbolName(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z_?$@][A-Za-z0-9_?$@.]*$/u.test(value)) {
    throw new TypeError(`${label} must be a simple compiled symbol name.`);
  }
}

function symbolPattern(name) {
  return new RegExp(`(?:^|[^A-Za-z0-9_?$@.])${escapeRegExp(name)}(?=$|[^A-Za-z0-9_?$@.])`, "u");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function dedupeBy(values, keyFor) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = keyFor(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function toUint32(value, label) {
  const numeric = typeof value === "string" && /^0x[0-9a-f]+$/iu.test(value)
    ? Number.parseInt(value.slice(2), 16)
    : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xffff_ffff) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer.`);
  }
  return numeric;
}

function toPositiveUint32(value, label) {
  const numeric = toUint32(value, label);
  if (numeric === 0) throw new RangeError(`${label} must be positive.`);
  return numeric;
}

function normalizeProbeStop(value) {
  const stop = toUint32(value, "retained frontier active tick");
  if (stop > 0x7fff_ffff) {
    throw new CompiledPathInspectorError(
      "probe-stop-range",
      "Retained frontier active tick exceeds the transport's signed stop boundary.",
      { activeTick: stop },
    );
  }
  return stop;
}

function requireNonEmptyObject(value, label) {
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    throw new CompiledPathInspectorError("binding-empty", `${label} must be a non-empty object.`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortCanonical(value[key])]),
  );
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

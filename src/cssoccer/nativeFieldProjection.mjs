export const CSSOCCER_NATIVE_FIELD_PROJECTION_SCHEMA = "cssoccer-native-field-projection@1";
export const CSSOCCER_ENGINE_SNAPSHOT_SCHEMA = "cssoccer-engine-snapshot@1";
export const CSSOCCER_PARITY_STREAM_SCHEMA = "cssoccer-parity-stream@1";
export const CSSOCCER_NATIVE_FIELD_COUNT = 412;

const SHA256 = /^[a-f0-9]{64}$/u;
const SCENARIO_ID = /^[a-f0-9]{16}$/u;
const FIELD_KEYS = Object.freeze([
  "id",
  "label",
  "sourceOwner",
  "meaning",
  "unit",
  "valueType",
]);
const PHASE_KEYS = Object.freeze(["id", "order"]);
const BINDING_KEYS = Object.freeze([
  "scenarioId",
  "scenarioSha256",
  "profileSha256",
  "inputSha256",
  "sourceSha256",
  "buildSha256",
  "contractSha256",
]);
const SNAPSHOT_KEYS = Object.freeze(["schema", "tick", "phase", "bindings", "fields"]);
const SNAPSHOT_FIELD_KEYS = Object.freeze(["fieldId", "valueType", "value", "numericBits"]);
const NUMERIC_TYPES = new Set([
  "i8",
  "u8",
  "i16",
  "u16",
  "i32",
  "u32",
  "i64",
  "u64",
  "f32",
  "f64",
]);
const VALUE_TYPES = new Set([...NUMERIC_TYPES, "bool", "string", "null"]);

export class CssoccerNativeFieldProjectionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CssoccerNativeFieldProjectionError";
    this.code = code;
  }
}

/**
 * Create a browser-owned projector for a passed-in native field contract.
 * The projector never discovers fields or values from reference artifacts.
 */
export function createCssoccerNativeFieldProjector(options = {}) {
  requirePlainObject(options, "native field projector options");
  requireOnlyKeys(options, ["fields", "phases", "bindings", "startTick"], "native field projector options");
  requireOwn(options, "fields", "native field projector options");
  requireOwn(options, "phases", "native field projector options");
  requireOwn(options, "bindings", "native field projector options");

  const fields = requireFieldContract(options.fields);
  const phases = requirePhaseContract(options.phases);
  const bindings = requireBindings(options.bindings, "native field projector bindings");
  const startTick = options.startTick ?? 0;
  requireTick(startTick, "native field projector startTick");

  let nextTick = startTick;
  let nextPhaseIndex = 0;

  return Object.freeze({
    schema: CSSOCCER_NATIVE_FIELD_PROJECTION_SCHEMA,
    fields,
    phases,
    bindings,
    startTick,
    get nextTick() {
      return nextTick;
    },
    get nextPhase() {
      return phases[nextPhaseIndex].id;
    },
    capture(snapshot) {
      const projection = projectCheckedSnapshot({
        snapshot,
        fields,
        phases,
        bindings,
        expectedTick: nextTick,
        expectedPhaseIndex: nextPhaseIndex,
      });
      nextPhaseIndex += 1;
      if (nextPhaseIndex === phases.length) {
        nextPhaseIndex = 0;
        nextTick += 1;
      }
      return projection;
    },
  });
}

function projectCheckedSnapshot({
  snapshot,
  fields,
  phases,
  bindings,
  expectedTick,
  expectedPhaseIndex,
}) {
  requirePlainObject(snapshot, "engine snapshot");
  requireExactKeys(snapshot, SNAPSHOT_KEYS, "engine snapshot");
  if (snapshot.schema !== CSSOCCER_ENGINE_SNAPSHOT_SCHEMA) {
    fail(
      "snapshot-schema",
      `engine snapshot schema must equal ${CSSOCCER_ENGINE_SNAPSHOT_SCHEMA}.`,
    );
  }
  requireTick(snapshot.tick, "engine snapshot tick");
  const expectedPhase = phases[expectedPhaseIndex];
  if (snapshot.tick !== expectedTick || snapshot.phase !== expectedPhase.id) {
    fail(
      "non-contiguous-coordinate",
      `engine snapshot must be contiguous at (${expectedTick}, ${expectedPhase.id}); received (${String(snapshot.tick)}, ${String(snapshot.phase)}).`,
    );
  }
  const snapshotBindings = requireBindings(snapshot.bindings, "engine snapshot bindings");
  for (const key of BINDING_KEYS) {
    if (snapshotBindings[key] !== bindings[key]) {
      fail("binding-mismatch", `engine snapshot ${key} does not match the bound projector.`);
    }
  }

  const values = requireSnapshotFields(snapshot.fields, fields);
  const samples = values.map((entry) => deepFreeze({
    schema: CSSOCCER_PARITY_STREAM_SCHEMA,
    recordType: "sample",
    tick: snapshot.tick,
    phase: snapshot.phase,
    fieldId: entry.fieldId,
    valueType: entry.valueType,
    value: entry.value,
    numericBits: entry.numericBits,
  }));

  return deepFreeze({
    schema: CSSOCCER_NATIVE_FIELD_PROJECTION_SCHEMA,
    tick: snapshot.tick,
    phase: snapshot.phase,
    phaseOrder: expectedPhase.order,
    bindings: clone(bindings),
    samples,
  });
}

function requireFieldContract(value) {
  if (!Array.isArray(value)) {
    throw new TypeError("native field contract must be an array.");
  }
  if (value.length !== CSSOCCER_NATIVE_FIELD_COUNT) {
    fail(
      "field-count",
      `native field contract must contain exactly ${CSSOCCER_NATIVE_FIELD_COUNT} fields; found ${value.length}.`,
    );
  }
  let previousId = "";
  const ids = new Set();
  const checked = value.map((field, index) => {
    const label = `native field contract[${index}]`;
    requirePlainObject(field, label);
    requireExactKeys(field, FIELD_KEYS, label);
    requireText(field.id, `${label}.id`, 160);
    if (ids.has(field.id)) fail("duplicate-contract-field", `${label}.id duplicates ${field.id}.`);
    if (previousId && field.id <= previousId) {
      fail("unordered-contract-field", `${label}.id must follow ${previousId} in canonical lexical order.`);
    }
    ids.add(field.id);
    previousId = field.id;
    requireText(field.label, `${label}.label`, 160);
    requireText(field.sourceOwner, `${label}.sourceOwner`, 500);
    requireText(field.meaning, `${label}.meaning`, 2000);
    if (field.unit !== null) requireText(field.unit, `${label}.unit`, 80);
    if (!VALUE_TYPES.has(field.valueType)) {
      fail("unsupported-value-type", `${label}.valueType ${String(field.valueType)} is unsupported.`);
    }
    return clone(field);
  });
  return deepFreeze(checked);
}

function requirePhaseContract(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("native phase contract must be a non-empty array.");
  }
  const ids = new Set();
  return deepFreeze(value.map((phase, index) => {
    const label = `native phase contract[${index}]`;
    requirePlainObject(phase, label);
    requireExactKeys(phase, PHASE_KEYS, label);
    requireText(phase.id, `${label}.id`, 160);
    if (ids.has(phase.id)) fail("duplicate-phase", `${label}.id duplicates ${phase.id}.`);
    if (phase.order !== index) {
      fail("non-contiguous-phase-order", `${label}.order must equal contiguous phase index ${index}.`);
    }
    ids.add(phase.id);
    return clone(phase);
  }));
}

function requireBindings(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, BINDING_KEYS, label);
  if (!SCENARIO_ID.test(value.scenarioId ?? "")) {
    fail("invalid-scenario-id", `${label}.scenarioId must be 16 lowercase hexadecimal characters.`);
  }
  for (const key of BINDING_KEYS.slice(1)) {
    if (!SHA256.test(value[key] ?? "")) {
      fail("invalid-binding-hash", `${label}.${key} must be a lowercase SHA-256 digest.`);
    }
  }
  if (value.scenarioId !== value.scenarioSha256.slice(0, 16)) {
    fail("invalid-scenario-binding", `${label}.scenarioId must prefix scenarioSha256.`);
  }
  return deepFreeze(clone(value));
}

function requireSnapshotFields(value, contract) {
  if (!Array.isArray(value)) throw new TypeError("engine snapshot fields must be an array.");
  const contractById = new Map(contract.map((field) => [field.id, field]));
  const entries = [];
  const seen = new Set();

  value.forEach((entry, index) => {
    const label = `engine snapshot fields[${index}]`;
    requirePlainObject(entry, label);
    requireExactKeys(entry, SNAPSHOT_FIELD_KEYS, label);
    requireText(entry.fieldId, `${label}.fieldId`, 160);
    if (seen.has(entry.fieldId)) {
      fail("duplicate-snapshot-field", `${label}.fieldId duplicates ${entry.fieldId}.`);
    }
    if (!contractById.has(entry.fieldId)) {
      fail("extra-snapshot-field", `${label}.fieldId ${entry.fieldId} is outside the field contract.`);
    }
    seen.add(entry.fieldId);
    entries.push(entry);
  });

  for (const field of contract) {
    if (!seen.has(field.id)) {
      fail("missing-snapshot-field", `engine snapshot field ${field.id} is missing.`);
    }
  }
  if (entries.length !== contract.length) {
    fail(
      "snapshot-field-count",
      `engine snapshot must contain exactly ${contract.length} fields; found ${entries.length}.`,
    );
  }

  return deepFreeze(entries.map((entry, index) => {
    const field = contract[index];
    const label = `engine snapshot fields[${index}]`;
    if (entry.fieldId !== field.id) {
      fail(
        "unordered-snapshot-field",
        `${label}.fieldId must be ${field.id}; received ${entry.fieldId}.`,
      );
    }
    if (entry.valueType !== field.valueType) {
      fail(
        "snapshot-value-type",
        `${label}.valueType must equal contract type ${field.valueType}.`,
      );
    }
    const expectedBits = numericBitsFor(entry.valueType, entry.value, entry.fieldId);
    if (entry.numericBits !== expectedBits) {
      fail(
        "bit-inconsistent-value",
        `${label}.numericBits does not encode exact ${entry.valueType} value ${entry.fieldId}.`,
      );
    }
    return {
      fieldId: entry.fieldId,
      valueType: entry.valueType,
      value: entry.value,
      numericBits: entry.numericBits,
    };
  }));
}

function numericBitsFor(valueType, value, fieldId) {
  if (valueType === "bool") {
    if (typeof value !== "boolean") typedFailure(fieldId, valueType);
    return null;
  }
  if (valueType === "string") {
    if (typeof value !== "string") typedFailure(fieldId, valueType);
    return null;
  }
  if (valueType === "null") {
    if (value !== null) typedFailure(fieldId, valueType);
    return null;
  }
  if (!NUMERIC_TYPES.has(valueType)) typedFailure(fieldId, valueType);

  const width = Number(valueType.slice(1));
  const bytes = new Uint8Array(width / 8);
  const view = new DataView(bytes.buffer);
  if (valueType === "f32" || valueType === "f64") {
    if (typeof value !== "number" || !Number.isFinite(value)) typedFailure(fieldId, valueType);
    if (valueType === "f32" && !Object.is(Math.fround(value), value)) {
      fail("unrounded-f32", `engine snapshot value ${fieldId} must already be exactly rounded to f32.`);
    }
    if (valueType === "f32") view.setFloat32(0, value, false);
    else view.setFloat64(0, value, false);
    return bytesToHex(bytes);
  }

  const signed = valueType.startsWith("i");
  if (width === 64) {
    if (typeof value !== "string" || !/^-?(0|[1-9][0-9]*)$/u.test(value) || value === "-0") {
      typedFailure(fieldId, valueType);
    }
    const integer = BigInt(value);
    const minimum = signed ? -(1n << 63n) : 0n;
    const maximum = signed ? (1n << 63n) - 1n : (1n << 64n) - 1n;
    if (integer < minimum || integer > maximum) typedFailure(fieldId, valueType);
    if (signed) view.setBigInt64(0, integer, false);
    else view.setBigUint64(0, integer, false);
    return bytesToHex(bytes);
  }

  if (!Number.isSafeInteger(value)) typedFailure(fieldId, valueType);
  const minimum = signed ? -(2 ** (width - 1)) : 0;
  const maximum = signed ? (2 ** (width - 1)) - 1 : (2 ** width) - 1;
  if (value < minimum || value > maximum) typedFailure(fieldId, valueType);
  const method = `${signed ? "setInt" : "setUint"}${width}`;
  view[method](0, value, false);
  return bytesToHex(bytes);
}

function bytesToHex(bytes) {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}

function typedFailure(fieldId, valueType) {
  fail("mistyped-value", `engine snapshot value ${fieldId} is not an exact ${valueType}.`);
}

function requireTick(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
}

function requireText(value, label, maximum) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) {
    throw new TypeError(`${label} must be non-empty text of at most ${maximum} characters.`);
  }
}

function requireOwn(value, key, label) {
  if (!Object.hasOwn(value, key)) throw new Error(`${label}.${key} is required.`);
}

function requireOnlyKeys(value, keys, label) {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new Error(`${label}.${key} is not supported.`);
  }
}

function requireExactKeys(value, keys, label) {
  requireOnlyKeys(value, keys, label);
  for (const key of keys) requireOwn(value, key, label);
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function fail(code, message) {
  throw new CssoccerNativeFieldProjectionError(code, message);
}

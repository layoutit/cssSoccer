import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_ENGINE_SNAPSHOT_SCHEMA,
  CSSOCCER_NATIVE_FIELD_COUNT,
  CSSOCCER_NATIVE_FIELD_PROJECTION_SCHEMA,
  CSSOCCER_PARITY_STREAM_SCHEMA,
  createCssoccerNativeFieldProjector,
} from "../src/cssoccer/nativeFieldProjection.mjs";
import {
  parityContractSha256,
  parseParityJsonl,
  sha256Hex,
} from "../src/parity/io.mjs";

const PHASES = Object.freeze([
  Object.freeze({ id: "input", order: 0 }),
  Object.freeze({ id: "post_tick", order: 1 }),
]);
const FIELDS = syntheticFieldContract();
const BINDINGS = syntheticBindings(PHASES, FIELDS);

test("a passed-in 412-field contract projects exactly ordered bound typed samples", () => {
  const projector = createProjector();
  const projection = projector.capture(syntheticSnapshot(7, "input"));

  assert.equal(projection.schema, CSSOCCER_NATIVE_FIELD_PROJECTION_SCHEMA);
  assert.equal(projection.samples.length, CSSOCCER_NATIVE_FIELD_COUNT);
  assert.deepEqual(projection.bindings, BINDINGS);
  assert.deepEqual(
    projection.samples.map(({ fieldId }) => fieldId),
    FIELDS.map(({ id }) => id),
  );
  for (const [index, sample] of projection.samples.entries()) {
    assert.deepEqual(
      {
        schema: sample.schema,
        recordType: sample.recordType,
        tick: sample.tick,
        phase: sample.phase,
        fieldId: sample.fieldId,
        valueType: sample.valueType,
        numericBits: sample.numericBits,
      },
      {
        schema: CSSOCCER_PARITY_STREAM_SCHEMA,
        recordType: "sample",
        tick: 7,
        phase: "input",
        fieldId: FIELDS[index].id,
        valueType: FIELDS[index].valueType,
        numericBits: syntheticValue(FIELDS[index].valueType, index).numericBits,
      },
    );
  }
  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection.bindings));
  assert.ok(Object.isFrozen(projection.samples));
  assert.ok(Object.isFrozen(projection.samples[0]));
});

test("tick and phase coordinates are contiguous and failed captures do not advance", () => {
  const projector = createProjector();
  projector.capture(syntheticSnapshot(7, "input"));
  assert.equal(projector.nextTick, 7);
  assert.equal(projector.nextPhase, "post_tick");

  assert.throws(
    () => projector.capture(syntheticSnapshot(8, "input")),
    /must be contiguous at \(7, post_tick\)/u,
  );
  assert.equal(projector.nextTick, 7);
  assert.equal(projector.nextPhase, "post_tick");

  projector.capture(syntheticSnapshot(7, "post_tick"));
  assert.equal(projector.nextTick, 8);
  assert.equal(projector.nextPhase, "input");
  projector.capture(syntheticSnapshot(8, "input"));
});

test("missing, duplicate, extra, and unordered snapshot fields fail closed", () => {
  const missing = syntheticSnapshot(7, "input");
  missing.fields.pop();
  assert.throws(() => createProjector().capture(missing), /is missing/u);

  const duplicate = syntheticSnapshot(7, "input");
  duplicate.fields[1] = { ...duplicate.fields[0] };
  assert.throws(() => createProjector().capture(duplicate), /duplicates/u);

  const extra = syntheticSnapshot(7, "input");
  extra.fields[extra.fields.length - 1].fieldId = "synthetic.outside-contract";
  assert.throws(() => createProjector().capture(extra), /outside the field contract/u);

  const unordered = syntheticSnapshot(7, "input");
  [unordered.fields[0], unordered.fields[1]] = [unordered.fields[1], unordered.fields[0]];
  assert.throws(() => createProjector().capture(unordered), /must be synthetic\.field\.000/u);
});

test("coerced, non-finite, mistyped, and bit-inconsistent values fail closed", () => {
  const i32Index = indexForType("i32");
  const coerced = syntheticSnapshot(7, "input");
  coerced.fields[i32Index].value = String(coerced.fields[i32Index].value);
  assert.throws(() => createProjector().capture(coerced), /not an exact i32/u);

  const f64Index = indexForType("f64");
  const nonFinite = syntheticSnapshot(7, "input");
  nonFinite.fields[f64Index].value = Number.POSITIVE_INFINITY;
  assert.throws(() => createProjector().capture(nonFinite), /not an exact f64/u);

  const mistyped = syntheticSnapshot(7, "input");
  mistyped.fields[i32Index].valueType = "u32";
  assert.throws(() => createProjector().capture(mistyped), /must equal contract type i32/u);

  const inconsistent = syntheticSnapshot(7, "input");
  inconsistent.fields[i32Index].numericBits = "ffffffff";
  assert.throws(() => createProjector().capture(inconsistent), /does not encode exact i32/u);

  const implicitExtra = syntheticSnapshot(7, "input");
  implicitExtra.fields[i32Index].coerced = false;
  assert.throws(() => createProjector().capture(implicitExtra), /coerced is not supported/u);
});

test("all supported scalar types preserve exact values and numeric bits", () => {
  const snapshot = syntheticSnapshot(7, "input");
  const f32Index = indexForType("f32");
  snapshot.fields[f32Index].value = -0;
  snapshot.fields[f32Index].numericBits = "80000000";
  const projection = createProjector().capture(snapshot);
  const byType = new Map();
  for (const sample of projection.samples) {
    if (!byType.has(sample.valueType)) byType.set(sample.valueType, sample);
  }

  assert.deepEqual([...byType.keys()].sort(), [
    "bool", "f32", "f64", "i16", "i32", "i64", "i8",
    "null", "string", "u16", "u32", "u64", "u8",
  ]);
  assert.ok(Object.is(byType.get("f32").value, -0));
  assert.equal(byType.get("f32").numericBits, "80000000");
  assert.equal(typeof byType.get("i64").value, "string");
  assert.equal(typeof byType.get("u64").value, "string");
  assert.equal(byType.get("bool").numericBits, null);
  assert.equal(byType.get("string").numericBits, null);
  assert.equal(byType.get("null").numericBits, null);
});

test("scenario, profile, input, source, build, and contract hashes bind every projection", () => {
  const drifted = syntheticSnapshot(7, "input");
  drifted.bindings.profileSha256 = sha256Hex("different synthetic profile");
  assert.throws(() => createProjector().capture(drifted), /profileSha256 does not match/u);

  const malformed = { ...BINDINGS, buildSha256: "not-a-hash" };
  assert.throws(
    () => createCssoccerNativeFieldProjector({
      fields: FIELDS,
      phases: PHASES,
      bindings: malformed,
      startTick: 7,
    }),
    /buildSha256 must be a lowercase SHA-256 digest/u,
  );

  const wrongScenario = { ...BINDINGS, scenarioId: "0".repeat(16) };
  assert.throws(
    () => createCssoccerNativeFieldProjector({
      fields: FIELDS,
      phases: PHASES,
      bindings: wrongScenario,
      startTick: 7,
    }),
    /must prefix scenarioSha256/u,
  );
});

test("contract count, identity, value types, and ordering are strict", () => {
  assert.throws(
    () => createCssoccerNativeFieldProjector({
      fields: FIELDS.slice(0, -1),
      phases: PHASES,
      bindings: BINDINGS,
    }),
    /exactly 412 fields/u,
  );

  const duplicate = FIELDS.map((field) => ({ ...field }));
  duplicate[1].id = duplicate[0].id;
  assert.throws(
    () => createCssoccerNativeFieldProjector({ fields: duplicate, phases: PHASES, bindings: BINDINGS }),
    /duplicates/u,
  );

  const unordered = FIELDS.map((field) => ({ ...field }));
  [unordered[0], unordered[1]] = [unordered[1], unordered[0]];
  assert.throws(
    () => createCssoccerNativeFieldProjector({ fields: unordered, phases: PHASES, bindings: BINDINGS }),
    /canonical lexical order/u,
  );

  const unsupported = FIELDS.map((field) => ({ ...field }));
  unsupported[0].valueType = "number";
  assert.throws(
    () => createCssoccerNativeFieldProjector({ fields: unsupported, phases: PHASES, bindings: BINDINGS }),
    /unsupported/u,
  );
});

test("projected samples satisfy the installed strict parity stream parser", () => {
  const phases = Object.freeze([{ id: "post_tick", order: 0 }]);
  const bindings = syntheticBindings(phases, FIELDS);
  const projector = createCssoccerNativeFieldProjector({
    fields: FIELDS,
    phases,
    bindings,
    startTick: 3,
  });
  const projection = projector.capture(syntheticSnapshot(3, "post_tick", { bindings }));
  const header = {
    schema: CSSOCCER_PARITY_STREAM_SCHEMA,
    recordType: "header",
    role: "reference",
    streamId: "synthetic-projection-mechanics",
    generatedAt: "2026-07-17T00:00:00.000Z",
    bindings,
    tickRange: { start: 3, count: 1 },
    phases,
    fields: FIELDS,
    engineIndependence: null,
  };
  const text = `${[header, ...projection.samples].map((record) => JSON.stringify(record)).join("\n")}\n`;
  const parsed = parseParityJsonl(text, { label: "synthetic browser projection" });
  assert.equal(parsed.samples.length, CSSOCCER_NATIVE_FIELD_COUNT);
  assert.deepEqual(parsed.header.bindings, projection.bindings);
});

test("two projectors emit byte-identical mechanics projections", () => {
  const first = createProjector().capture(syntheticSnapshot(7, "input"));
  const second = createProjector().capture(syntheticSnapshot(7, "input"));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("runtime projection has no filesystem, reference, retained-state, or oracle dependency", () => {
  const source = readFileSync(
    new URL("../src/cssoccer/nativeFieldProjection.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /node:fs|readFile|\.local\/|references\/|state\.jsonl/u);
  assert.doesNotMatch(source, /^import\s/mu);
});

function createProjector() {
  return createCssoccerNativeFieldProjector({
    fields: FIELDS,
    phases: PHASES,
    bindings: BINDINGS,
    startTick: 7,
  });
}

function syntheticFieldContract() {
  const valueTypes = [
    "i8", "u8", "i16", "u16", "i32", "u32", "i64",
    "u64", "f32", "f64", "bool", "string", "null",
  ];
  return Object.freeze(Array.from({ length: CSSOCCER_NATIVE_FIELD_COUNT }, (_, index) => Object.freeze({
    id: `synthetic.field.${String(index).padStart(3, "0")}`,
    label: `Synthetic field ${index}`,
    sourceOwner: "synthetic projection mechanics",
    meaning: "Synthetic transport field with no gameplay authority.",
    unit: null,
    valueType: valueTypes[index % valueTypes.length],
  })));
}

function syntheticBindings(phases, fields) {
  const scenarioSha256 = sha256Hex("synthetic projection scenario");
  return Object.freeze({
    scenarioId: scenarioSha256.slice(0, 16),
    scenarioSha256,
    profileSha256: sha256Hex("synthetic projection profile"),
    inputSha256: sha256Hex("synthetic projection input"),
    sourceSha256: sha256Hex("synthetic browser source"),
    buildSha256: sha256Hex("synthetic browser build"),
    contractSha256: parityContractSha256({ phases, fields }),
  });
}

function syntheticSnapshot(tick, phase, { bindings = BINDINGS } = {}) {
  return {
    schema: CSSOCCER_ENGINE_SNAPSHOT_SCHEMA,
    tick,
    phase,
    bindings: { ...bindings },
    fields: FIELDS.map((field, index) => ({
      fieldId: field.id,
      valueType: field.valueType,
      ...syntheticValue(field.valueType, index),
    })),
  };
}

function syntheticValue(valueType, index) {
  let value;
  if (valueType === "i8") value = (index % 100) - 50;
  else if (valueType === "u8") value = index % 200;
  else if (valueType === "i16") value = index - 200;
  else if (valueType === "u16") value = index;
  else if (valueType === "i32") value = index * 100;
  else if (valueType === "u32") value = index * 1_000;
  else if (valueType === "i64") value = String(index - 200);
  else if (valueType === "u64") value = String(index);
  else if (valueType === "f32") value = Math.fround(index / 8);
  else if (valueType === "f64") value = index / 10;
  else if (valueType === "bool") value = index % 2 === 0;
  else if (valueType === "string") value = `synthetic-${index}`;
  else if (valueType === "null") value = null;
  else throw new Error(`Unsupported synthetic type ${valueType}.`);
  return { value, numericBits: bitsFor(valueType, value) };
}

function bitsFor(valueType, value) {
  if (valueType === "bool" || valueType === "string" || valueType === "null") return null;
  const width = Number(valueType.slice(1));
  const bytes = new Uint8Array(width / 8);
  const view = new DataView(bytes.buffer);
  if (valueType === "f32") view.setFloat32(0, value, false);
  else if (valueType === "f64") view.setFloat64(0, value, false);
  else if (width === 64 && valueType.startsWith("i")) view.setBigInt64(0, BigInt(value), false);
  else if (width === 64) view.setBigUint64(0, BigInt(value), false);
  else view[`${valueType.startsWith("i") ? "setInt" : "setUint"}${width}`](0, value, false);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function indexForType(valueType) {
  return FIELDS.findIndex((field) => field.valueType === valueType);
}

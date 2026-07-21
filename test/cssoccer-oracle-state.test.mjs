import assert from "node:assert/strict";
import test from "node:test";

import {
  CSSOCCER_BROWSER_CAPTURE_BLOCKER,
  CSSOCCER_BROWSER_ORACLE_SCHEMA,
  CSSOCCER_ORACLE_PHASE,
  CSSOCCER_PARITY_STREAM_SCHEMA,
  createCssoccerBrowserOracleController,
  createCssoccerOracleBindings,
  createCssoccerOracleCandidateHeader,
  createCssoccerOracleRecorder,
  createCssoccerOracleTick,
  serializeCssoccerOracleSamples,
} from "../src/cssoccer/oracleState.mjs";
import {
  engineIndependenceSubjectSha256,
  parityContractSha256,
  parseParityJsonl,
  sha256Hex,
} from "../src/parity/io.mjs";

const fields = Object.freeze([
  field("a.bool", "bool"),
  field("b.f32", "f32"),
  field("c.f64", "f64"),
  field("d.i16", "i16"),
  field("e.i32", "i32"),
  field("f.i64", "i64"),
  field("g.i8", "i8"),
  field("h.null", "null"),
  field("i.string", "string"),
  field("j.u16", "u16"),
  field("k.u32", "u32"),
  field("l.u64", "u64"),
  field("m.u8", "u8"),
]);
const values = Object.freeze({
  "a.bool": true,
  "b.f32": Math.fround(1.25),
  "c.f64": -3.5,
  "d.i16": -2,
  "e.i32": -2147483648,
  "f.i64": "-9223372036854775808",
  "g.i8": -128,
  "h.null": null,
  "i.string": "spain-player-01",
  "j.u16": 65535,
  "k.u32": 4294967295,
  "l.u64": "18446744073709551615",
  "m.u8": 255,
});

test("browser oracle emits exact typed parity samples with numeric bits", () => {
  const samples = createCssoccerOracleTick({ tick: 0, fields, values });
  assert.equal(samples.length, fields.length);
  assert.equal(samples[0].phase, CSSOCCER_ORACLE_PHASE);
  assert.equal(samples[1].numericBits, "3fa00000");
  assert.equal(samples[2].numericBits, "c00c000000000000");
  assert.equal(samples[3].numericBits, "fffe");
  assert.equal(samples[4].numericBits, "80000000");
  assert.equal(samples[5].numericBits, "8000000000000000");
  assert.equal(samples[6].numericBits, "80");
  assert.equal(samples[9].numericBits, "ffff");
  assert.equal(samples[10].numericBits, "ffffffff");
  assert.equal(samples[11].numericBits, "ffffffffffffffff");
  assert.equal(samples[12].numericBits, "ff");
  assert.equal(samples[0].numericBits, null);
  assert.equal(samples[8].numericBits, null);
  assert.ok(Object.isFrozen(samples));
  assert.ok(Object.isFrozen(samples[0]));
});

test("browser samples parse unchanged through the exact differential transport", () => {
  const samples = createCssoccerOracleTick({ tick: 7, fields, values });
  const phases = [{ id: CSSOCCER_ORACLE_PHASE, order: 0 }];
  const scenarioSha256 = sha256Hex("synthetic browser oracle scenario");
  const bindings = {
    scenarioId: scenarioSha256.slice(0, 16),
    scenarioSha256,
    profileSha256: sha256Hex("synthetic browser oracle profile"),
    inputSha256: sha256Hex("synthetic browser oracle input"),
    sourceSha256: sha256Hex("synthetic source revision"),
    buildSha256: sha256Hex("synthetic browser build"),
    contractSha256: parityContractSha256({ phases, fields }),
  };
  const header = {
    schema: CSSOCCER_PARITY_STREAM_SCHEMA,
    recordType: "header",
    role: "reference",
    streamId: "synthetic-browser-oracle",
    generatedAt: "2026-07-17T00:00:00.000Z",
    bindings,
    tickRange: { start: 7, count: 1 },
    phases,
    fields,
    engineIndependence: null,
  };
  const jsonl = `${JSON.stringify(header)}\n${serializeCssoccerOracleSamples(samples)}`;
  const parsed = parseParityJsonl(jsonl, { label: "browser oracle compatibility" });
  assert.equal(parsed.samples.length, fields.length);
  assert.equal(parsed.samples[1].numericBits, "3fa00000");
  assert.equal(parsed.samples[5].value, "-9223372036854775808");
});

test("browser samples restore signed zero after CDP by-value transport", () => {
  const signedZeroFields = [
    field("a.f32", "f32"),
    field("b.f64", "f64"),
  ];
  const samples = createCssoccerOracleTick({
    tick: 9,
    fields: signedZeroFields,
    values: { "a.f32": -0, "b.f64": -0 },
  });
  const transported = JSON.parse(JSON.stringify(samples));
  assert.equal(Object.is(transported[0].value, -0), false);
  const lines = serializeCssoccerOracleSamples(transported).trim().split("\n");
  const restored = lines.map(JSON.parse);
  assert.equal(Object.is(restored[0].value, -0), true);
  assert.equal(Object.is(restored[1].value, -0), true);
  assert.equal(restored[0].numericBits, "80000000");
  assert.equal(restored[1].numericBits, "8000000000000000");
});

test("recorder is contiguous and does not advance after rejected state", () => {
  const recorder = createCssoccerOracleRecorder({ fields, startTick: 41 });
  assert.equal(recorder.nextTick, 41);
  assert.throws(() => recorder.capture(42, values), /expected contiguous tick 41/u);
  assert.equal(recorder.nextTick, 41);
  assert.throws(
    () => recorder.capture(41, { ...values, "b.f32": 1.1 }),
    /exactly rounded to f32/u,
  );
  assert.equal(recorder.nextTick, 41);
  assert.equal(recorder.capture(41, values)[0].tick, 41);
  assert.equal(recorder.nextTick, 42);
  assert.equal(recorder.capture(42, values)[0].tick, 42);
});

test("field and value contracts fail closed", () => {
  assert.throws(
    () => createCssoccerOracleTick({ tick: 0, fields: [fields[1], fields[0]], values }),
    /lexically ordered/u,
  );
  assert.throws(
    () => createCssoccerOracleTick({ tick: 0, fields, values: { ...values, "z.extra": 1 } }),
    /outside the field contract/u,
  );
  const { [fields[0].id]: _missing, ...missing } = values;
  assert.throws(
    () => createCssoccerOracleTick({ tick: 0, fields, values: missing }),
    /a.bool is missing/u,
  );
  assert.throws(
    () => createCssoccerOracleTick({ tick: 0, phase: "render", fields, values }),
    /phase must be post_tick/u,
  );
  assert.throws(
    () => createCssoccerOracleTick({ tick: 0, fields, values: { ...values, "m.u8": 256 } }),
    /not an exact u8/u,
  );
});

test("browser capture reports the missing integrated match-step seam exactly", async () => {
  const bindings = syntheticBindings(fields);
  const matchState = syntheticMatchState(bindings);
  const controller = createCssoccerBrowserOracleController({
    getMatchState: () => matchState,
    fields,
  });
  const status = controller.status();
  assert.equal(status.schema, CSSOCCER_BROWSER_ORACLE_SCHEMA);
  assert.equal(status.status, "blocked");
  assert.equal(
    status.firstBlocker,
    CSSOCCER_BROWSER_CAPTURE_BLOCKER.MISSING_DETERMINISTIC_MATCH_STEP,
  );
  assert.deepEqual(status.bindings, bindings);
  assert.equal(status.fieldCount, fields.length);
  assert.equal(status.nextTick, 0);
  await assert.rejects(
    controller.captureNext(),
    /missing-deterministic-match-step/u,
  );
});

test("checked browser controller emits contiguous exact samples and a valid candidate header", async () => {
  const bindings = syntheticBindings(fields);
  const matchState = syntheticMatchState(bindings);
  const engineIndependence = passingEngineIndependence(bindings);
  const captures = [];
  const controller = createCssoccerBrowserOracleController({
    getMatchState: () => matchState,
    fields,
    engineIndependence,
    capturePostTick(request) {
      captures.push(request);
      return { tick: request.tick, phase: request.phase, values };
    },
  });
  assert.equal(controller.status().status, "ready");
  const first = await controller.captureNext();
  const second = await controller.captureNext();
  assert.equal(first.tick, 0);
  assert.equal(second.tick, 1);
  assert.equal(controller.status().nextTick, 2);
  assert.deepEqual(captures.map(({ tick }) => tick), [0, 1]);

  const header = createCssoccerOracleCandidateHeader({
    streamId: "synthetic-browser-candidate",
    generatedAt: "2026-07-17T12:00:00.000Z",
    bindings,
    tickCount: 2,
    fields,
    engineIndependence,
  });
  const jsonl = `${JSON.stringify(header)}\n${serializeCssoccerOracleSamples(first.samples)}${serializeCssoccerOracleSamples(second.samples)}`;
  const parsed = parseParityJsonl(jsonl, { label: "browser candidate" });
  assert.equal(parsed.header.role, "candidate");
  assert.equal(parsed.header.tickRange.count, 2);
  assert.deepEqual(parsed.header.bindings, bindings);
  assert.equal(parsed.samples.length, fields.length * 2);
});

test("browser candidate refuses an unchecked engine-independence claim", () => {
  const bindings = syntheticBindings(fields);
  const blocked = { ...passingEngineIndependence(bindings), status: "blocked" };
  assert.throws(
    () => createCssoccerOracleCandidateHeader({
      streamId: "unchecked-browser-candidate",
      generatedAt: "2026-07-17T12:00:00.000Z",
      bindings,
      tickCount: 1,
      fields,
      engineIndependence: blocked,
    }),
    /needs checked engine independence/u,
  );
});

function field(id, valueType) {
  return Object.freeze({
    id,
    label: id,
    sourceOwner: "synthetic browser projection",
    meaning: `Synthetic ${valueType} transport fixture.`,
    unit: null,
    valueType,
  });
}

function syntheticBindings(contractFields) {
  const phases = [{ id: CSSOCCER_ORACLE_PHASE, order: 0 }];
  const scenarioSha256 = sha256Hex("synthetic browser capture scenario");
  return Object.freeze({
    scenarioId: scenarioSha256.slice(0, 16),
    scenarioSha256,
    profileSha256: sha256Hex("synthetic browser capture profile"),
    inputSha256: sha256Hex("synthetic browser capture input"),
    sourceSha256: sha256Hex("synthetic browser capture source"),
    buildSha256: sha256Hex("synthetic browser capture build"),
    contractSha256: parityContractSha256({ phases, fields: contractFields }),
  });
}

function syntheticMatchState(bindings) {
  const matchState = {
    bindings: {
      nativeScenarioSha256: bindings.scenarioSha256,
      canonicalProfileSha256: bindings.profileSha256,
      nativeInputSha256: bindings.inputSha256,
      nativeSourceSha256: bindings.sourceSha256,
      nativeBuildSha256: bindings.buildSha256,
      nativeFieldContractSha256: bindings.contractSha256,
    },
  };
  assert.deepEqual(createCssoccerOracleBindings(matchState), bindings);
  return matchState;
}

function passingEngineIndependence(bindings) {
  const metadata = {
    schema: "cssoccer-engine-independence@1",
    status: "pass",
    qualifiedAt: "2026-07-17T11:59:00.000Z",
    bindings,
    runtimeSnapshotSha256: bindings.buildSha256,
    preparedInputSha256: bindings.inputSha256,
    harnessSha256: sha256Hex("synthetic browser harness"),
    captureAdapterSha256: sha256Hex("synthetic browser capture adapter"),
    blockers: [],
  };
  return Object.freeze({
    ...metadata,
    check: Object.freeze({
      status: "pass",
      id: "synthetic-engine-independence-check",
      sha256: sha256Hex("synthetic engine independence check"),
      subjectSha256: engineIndependenceSubjectSha256(metadata),
    }),
  });
}

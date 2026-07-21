import assert from "node:assert/strict";
import {
  createReadStream,
  existsSync,
  readFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_OPENING_MATCH_QUALIFICATION,
  CSSOCCER_OPENING_MATCH_SOURCE_ORDER,
  CSSOCCER_OPENING_MATCH_STATE_SCHEMA,
  CssoccerUnsupportedOpeningMatchStateError,
  assertCssoccerOpeningMatchState,
  createCssoccerOpeningMatchState,
  projectCssoccerOpeningMatchCapturedFields,
  projectCssoccerOpeningMatchStaminaFields,
  stepCssoccerOpeningMatchState,
} from "../src/cssoccer/openingMatchState.mjs";

const ROOT = new URL("../", import.meta.url);
const FACTS_URL = new URL(
  "build/generated/public/cssoccer/facts/spain-argentina-full-match.json",
  ROOT,
);
const SCENE_URL = new URL(
  "build/generated/public/cssoccer/scenes/spain-argentina-full-match.json",
  ROOT,
);
const RETAINED_ROOT = new URL(
  ".local/cssoccer/oracle/native/retained/runs/canonical-a/",
  ROOT,
);
const RETAINED_STATE_URL = new URL("state.jsonl", RETAINED_ROOT);
const RETAINED_RAW_URL = new URL("native.raw", RETAINED_ROOT);
const CONTRACT_URL = new URL("references/spain-argentina-match.json", ROOT);
const RUNTIME_URL = new URL("src/cssoccer/openingMatchState.mjs", ROOT);
const fixtureOptions = skipUnless(
  [FACTS_URL, SCENE_URL],
  "prepared Spain-Argentina opening fixture",
);
const retainedOptions = skipUnless(
  [FACTS_URL, SCENE_URL, RETAINED_STATE_URL, RETAINED_RAW_URL, CONTRACT_URL],
  "prepared fixture and retained canonical opening",
);

test("root baseline composes one honest browser-safe opening for either country", fixtureOptions, () => {
  const spain = createState("spain");
  const argentina = createState("argentina");
  assert.equal(assertCssoccerOpeningMatchState(spain), spain);
  assert.equal(spain.schema, CSSOCCER_OPENING_MATCH_STATE_SCHEMA);
  assert.equal(spain.tick, 0);
  assert.equal(spain.animation, null);
  assert.equal(spain.rng.calls, 0);
  assert.equal(spain.stamina.tick, 0);
  assert.equal(spain.coordinator.tick, 0);
  assert.equal(spain.lifecycle.clock.tick, 0);
  assert.equal(spain.selectedCountry, "spain");
  assert.equal(argentina.selectedCountry, "argentina");
  assert.deepEqual(spain.sourceOrder, CSSOCCER_OPENING_MATCH_SOURCE_ORDER);
  assert.deepEqual(spain.qualification, CSSOCCER_OPENING_MATCH_QUALIFICATION);
  assert.deepEqual(spain.qualification.sourceDerivedDomains, [{
    domain: "officials",
    classification: "source-derived-native-refs-uncaptured",
    capturedRefs: false,
    nativeExact: false,
  }]);
  assert.equal(spain.qualification.completeCompositeNativeExact, false);
  assert.equal(JSON.stringify(createState("spain")), JSON.stringify(spain));
  assert.equal(JSON.stringify(createState("argentina")), JSON.stringify(argentina));
  assertDeepFrozen(spain);
  assertDeepFrozen(argentina);
});

test("both country choices reproduce every composed captured field through tick 171", retainedOptions, async () => {
  const retained = await retainedWindow(0, 171);
  const raw = retainedRawStaminaWindow(0, 171);
  let argentina = createState("argentina");
  let spain = createState("spain");

  assert.equal(
    retained.header.bindings.sourceSha256,
    argentina.bindings.match.nativeSourceSha256,
  );
  assert.equal(
    retained.header.bindings.buildSha256,
    argentina.bindings.match.nativeBuildSha256,
  );
  assert.equal(
    retained.header.bindings.scenarioSha256,
    argentina.bindings.match.nativeScenarioSha256,
  );
  assert.equal(
    retained.header.bindings.contractSha256,
    argentina.bindings.match.nativeFieldContractSha256,
  );

  for (let tick = 0; tick <= 171; tick += 1) {
    assert.equal(argentina.tick, tick);
    assert.equal(spain.tick, tick);
    const actual = projectCssoccerOpeningMatchCapturedFields(argentina);
    const countryMirror = projectCssoccerOpeningMatchCapturedFields(spain);
    assert.deepEqual(countryMirror, actual, `country-neutral opening projection at tick ${tick}`);
    assert.deepEqual(
      actual,
      actual.map(({ fieldId }) => requiredSample(retained.ticks.get(tick), fieldId)),
      `all composed retained fields at tick ${tick}`,
    );
    assert.deepEqual(
      projectCssoccerOpeningMatchStaminaFields(argentina),
      raw.get(tick),
      `raw stamina/rate/player-minute fields at tick ${tick}`,
    );
    assert.equal(argentina.rng.calls, tick);
    assert.equal(spain.rng.calls, tick);
    assert.deepEqual(argentina.coordinator.ball.ball.rng, argentina.rng);
    assert.deepEqual(spain.coordinator.ball.ball.rng, spain.rng);
    assert.equal(argentina.animation === null, tick < 11);
    assert.equal(spain.animation === null, tick < 11);
    if (tick < 171) {
      argentina = stepCssoccerOpeningMatchState(argentina);
      spain = stepCssoccerOpeningMatchState(spain);
    }
  }

  assert.equal(argentina.animation.tick, 171);
  assert.equal(argentina.stamina.gameMinute, 6);
  assert.equal(argentina.coordinator.kickoffMotion.status, "settled");
  assert.deepEqual(argentina.coordinator.milestones, {
    playersSettledTick: 171,
    refereeReadyTick: 34,
    kickoffReadyTick: null,
    launchReceiptTick: null,
  });
});

test("tick 11 binds animation, dynamic minute rates feed motion, and tick 172 fails closed", fixtureOptions, () => {
  let state = createState("argentina");
  while (state.tick < 10) state = stepCssoccerOpeningMatchState(state);
  assert.equal(state.animation, null);
  state = stepCssoccerOpeningMatchState(state);
  assert.equal(state.tick, 11);
  assert.equal(state.animation.tick, 11);
  assert.deepEqual(
    state.animation.players.map(({ id, action, teamRate }) => ({
      id,
      action: action.value,
      teamRate,
    })),
    state.coordinator.kickoffMotion.players.map(({ id, action, teamRate }) => ({
      id,
      action,
      teamRate,
    })),
  );

  while (state.tick < 27) state = stepCssoccerOpeningMatchState(state);
  assert.equal(state.stamina.gameMinute, 1);
  assert.ok(state.stamina.players.every(({ rate, initialRate }) => (
    rate.value === initialRate - 1
  )));
  assert.deepEqual(
    state.coordinator.kickoffMotion.players.map(({ id, teamRate }) => ({ id, teamRate })),
    state.stamina.players.map(({ id, rate }) => ({ id, teamRate: rate.value })),
  );

  while (state.tick < 171) state = stepCssoccerOpeningMatchState(state);
  const before = JSON.stringify(state);
  assert.throws(
    () => stepCssoccerOpeningMatchState(state),
    (error) => error instanceof CssoccerUnsupportedOpeningMatchStateError
      && error.boundary === "tick-172-action-animation-frontier"
      && error.detail.currentTick === 171
      && error.detail.requestedTick === 172,
  );
  assert.equal(JSON.stringify(state), before);

  const changedRng = structuredClone(state);
  changedRng.rng.randSeed ^= 1;
  changedRng.rng.seed = changedRng.rng.randSeed & 127;
  assert.throws(
    () => assertCssoccerOpeningMatchState(changedRng),
    /exactly once per logic tick/u,
  );
  const changedRate = structuredClone(state);
  changedRate.coordinator.kickoffMotion.players[0].teamRate += 1;
  assert.throws(
    () => assertCssoccerOpeningMatchState(changedRate),
    /tm_rate|source formula/u,
  );
});

test("runtime imports only ordinary browser modules and has no evidence or tick-table dependency", () => {
  const source = readFileSync(RUNTIME_URL, "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(
    source,
    /node:|\.local\/|state\.jsonl|native\.raw|build\/generated|references\/|readFile|createReadStream|oracle/u,
  );
  assert.match(source, /previousMotion: current\.coordinator\.kickoffMotion/u);
  assert.match(source, /currentMotion: coordinator\.kickoffMotion/u);
  assert.match(source, /sourceSideStepDirection\(previous\)/u);
  assert.doesNotMatch(source, /BASELINE_ROWS|retainedWindow|nativeRuntimeValues/u);
});

function createState(selectedCountry) {
  return createCssoccerOpeningMatchState({
    preparedFacts: JSON.parse(readFileSync(FACTS_URL, "utf8")),
    preparedScene: JSON.parse(readFileSync(SCENE_URL, "utf8")),
    selectedCountry,
  });
}

async function retainedWindow(startTick, endTick) {
  const ticks = new Map(
    Array.from({ length: endTick - startTick + 1 }, (_, index) => [
      startTick + index,
      new Map(),
    ]),
  );
  const input = createReadStream(RETAINED_STATE_URL);
  const lines = createInterface({ input, crlfDelay: Infinity });
  let header;
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.recordType === "header") {
      header = record;
      continue;
    }
    if (record.tick > endTick) {
      lines.close();
      input.destroy();
      break;
    }
    if (record.tick < startTick) continue;
    ticks.get(record.tick).set(record.fieldId, record);
  }
  assert.ok(header);
  assert.ok([...ticks.values()].every((fields) => fields.size === 412));
  return { header, ticks };
}

function retainedRawStaminaWindow(startTick, endTick) {
  const bytes = readFileSync(RETAINED_RAW_URL);
  const contract = JSON.parse(readFileSync(CONTRACT_URL, "utf8"));
  const raw = contract.oracle.capture.raw;
  assert.equal(bytes.subarray(0, 8).toString("ascii"), raw.magic);
  assert.equal(bytes.readUInt32LE(8), raw.version);
  assert.equal(bytes.readUInt32LE(12), raw.ranges.length);

  let descriptorOffset = 16;
  let payloadBase = 0;
  const ranges = raw.ranges.map((expected) => {
    const range = {
      offset: bytes.readUInt32LE(descriptorOffset),
      bytes: bytes.readUInt32LE(descriptorOffset + 4),
      payloadBase,
    };
    assert.deepEqual({ offset: range.offset, bytes: range.bytes }, expected);
    descriptorOffset += 8;
    payloadBase += range.bytes;
    return range;
  });
  const recordBytes = raw.metadataBytes + payloadBase;
  const teamsAddress = 0x3cf6c;
  const teamsRange = ranges.find((range) => (
    teamsAddress >= range.offset && teamsAddress < range.offset + range.bytes
  ));
  assert.ok(teamsRange);
  const result = new Map();
  for (let recordOffset = descriptorOffset; recordOffset < bytes.length; recordOffset += recordBytes) {
    assert.equal(
      bytes.subarray(recordOffset, recordOffset + 4).toString("ascii"),
      raw.recordMarker,
    );
    const tick = bytes.readUInt32LE(recordOffset + 20);
    const flags = bytes.readUInt32LE(recordOffset + 24);
    if ((flags & raw.flags.active) === 0 || tick < startTick || tick > endTick) continue;
    const teamsPayload = recordOffset
      + raw.metadataBytes
      + teamsRange.payloadBase
      + teamsAddress
      - teamsRange.offset;
    const fields = [];
    for (let index = 0; index < 22; index += 1) {
      const country = index < 11 ? "spain" : "argentina";
      const shirt = String((index % 11) + 1).padStart(2, "0");
      const id = `${country}-player-${shirt}`;
      const base = teamsPayload + (index * 203);
      fields.push(
        rawU8(`players.${id}.rate`, bytes.readUInt8(base + 70)),
        rawU8(`players.${id}.stamina`, bytes.readUInt8(base + 76)),
        rawU8(`players.${id}.player_minutes`, bytes.readUInt8(base + 104)),
      );
    }
    result.set(tick, fields);
  }
  assert.deepEqual(
    [...result.keys()],
    Array.from({ length: endTick - startTick + 1 }, (_, index) => startTick + index),
  );
  return result;
}

function rawU8(fieldId, value) {
  return {
    fieldId,
    valueType: "u8",
    value,
    numericBits: value.toString(16).padStart(2, "0"),
  };
}

function requiredSample(fields, fieldId) {
  const sample = fields.get(fieldId);
  assert.ok(sample, `retained field ${fieldId}`);
  return sample;
}

function skipUnless(urls, label) {
  const missing = urls.filter((url) => !existsSync(url));
  return {
    skip: missing.length === 0
      ? false
      : `${label} unavailable: ${missing.map(({ pathname }) => pathname).join(", ")}`,
  };
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

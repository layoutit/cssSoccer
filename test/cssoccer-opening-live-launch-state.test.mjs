import assert from "node:assert/strict";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
  stepCssoccerCentrePassAction,
} from "../src/cssoccer/centrePassAction.mjs";
import {
  createCssoccerHeldBallOwnerFrame,
} from "../src/cssoccer/heldBallState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
} from "../src/cssoccer/nativeGameplayProfile.mjs";
import {
  CSSOCCER_OPENING_LIVE_LAUNCH_QUALIFICATION,
  CSSOCCER_OPENING_LIVE_LAUNCH_SOURCE_ORDER,
  CssoccerUnsupportedOpeningLiveLaunchError,
  assertCssoccerOpeningLiveLaunchState,
  createCssoccerOpeningLiveLaunchState,
  projectCssoccerOpeningLiveLaunchCapturedFields,
  projectCssoccerOpeningLiveLaunchStaminaFields,
  stepCssoccerOpeningLiveLaunchState,
} from "../src/cssoccer/openingLiveLaunchState.mjs";
import {
  createCssoccerOpeningMatchState,
  stepCssoccerOpeningMatchState,
} from "../src/cssoccer/openingMatchState.mjs";
import {
  advanceCssoccerNativeRng,
} from "../src/cssoccer/randomState.mjs";

const F32 = Math.fround;
const OPENING_TICK = 171;
const LAUNCH_TICK = 172;
const RELEASE_TICK = 178;
const RECEIPT_TICK = 181;
const RECOVERY_TICK = 185;
const NORMAL_LIVE_TICK = 186;
const GENERATED_ROOT = new URL("../build/generated/public/cssoccer/", import.meta.url);
const FACTS_URL = new URL("facts/spain-argentina-full-match.json", GENERATED_ROOT);
const SCENE_URL = new URL("scenes/spain-argentina-full-match.json", GENERATED_ROOT);
const RETAINED_URL = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const RETAINED_RAW_URL = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/native.raw",
  import.meta.url,
);
const CONTRACT_URL = new URL("../references/spain-argentina-match.json", import.meta.url);
const RUNTIME_URL = new URL("../src/cssoccer/openingLiveLaunchState.mjs", import.meta.url);
const fixtureOptions = skipUnless([FACTS_URL, SCENE_URL], "prepared opening fixture");
const retainedOptions = skipUnless(
  [FACTS_URL, SCENE_URL, RETAINED_URL, RETAINED_RAW_URL, CONTRACT_URL],
  "prepared fixture and retained centre-pass window",
);

test("accepted opening crosses exactly into the source-owned launch tick", fixtureOptions, () => {
  for (const selectedCountry of ["argentina", "spain"]) {
    const state = createCssoccerOpeningLiveLaunchState({
      opening: openingAt171(selectedCountry),
    });
    assert.equal(assertCssoccerOpeningLiveLaunchState(state), state);
    assert.equal(state.tick, LAUNCH_TICK);
    assert.equal(state.lifecycle.clock.tick, LAUNCH_TICK);
    assert.equal(state.stamina.tick, LAUNCH_TICK);
    assert.equal(state.coordinator.phase, "launch-receipt");
    assert.equal(state.coordinator.launch.owner.takerId, "spain-player-07");
    assert.equal(state.centrePassAction.phase, "kick-held");
    assert.equal(state.centrePassAction.taker.actionId, 15);
    assert.equal(state.centrePassAction.taker.animationId, 39);
    assert.equal(state.control.ownership.activePlayerId, `${selectedCountry}-player-07`);
    assert.equal(state.control.players.filter(({ control }) => control.value === 1).length, 1);
    assert.deepEqual(state.qualification, CSSOCCER_OPENING_LIVE_LAUNCH_QUALIFICATION);
    assert.deepEqual(state.sourceOrder, CSSOCCER_OPENING_LIVE_LAUNCH_SOURCE_ORDER);
    assertDeepFrozen(state);
  }
});

test("all projected owned fields and raw stamina bytes match native ticks 172 through 185", retainedOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, RECOVERY_TICK);
  const rawStamina = retainedRawStaminaWindow(LAUNCH_TICK, RECOVERY_TICK);
  const run = runQualified("argentina", retained);

  assert.deepEqual([...run.states.keys()], range(LAUNCH_TICK, RECOVERY_TICK));
  assert.equal(run.states.get(RELEASE_TICK - 1).centrePassAction.phase, "kick-held");
  assert.equal(run.states.get(RELEASE_TICK).centrePassAction.phase, "ground-pass");
  assert.equal(run.states.get(RECEIPT_TICK).centrePassAction.phase, "receiver-held");
  assert.equal(run.states.get(RECOVERY_TICK).centrePassAction.phase, "complete");

  for (const [tick, state] of run.states) {
    assert.equal(assertCssoccerOpeningLiveLaunchState(state), state, `state tick ${tick}`);
    const projected = projectCssoccerOpeningLiveLaunchCapturedFields(state);
    assert.ok(projected.length > 40, `owned projection tick ${tick}`);
    assert.equal(new Set(projected.map(({ fieldId }) => fieldId)).size, projected.length);
    for (const field of projected) {
      assert.deepEqual(
        field,
        scalar(requiredSample(retained.get(tick), field.fieldId)),
        `tick ${tick} ${field.fieldId}`,
      );
    }
    const stamina = projectCssoccerOpeningLiveLaunchStaminaFields(state);
    assert.equal(stamina.length, 66);
    assert.deepEqual(stamina, rawStamina.get(tick), `raw stamina tick ${tick}`);
  }
});

test("ordinary RNG and pass_ball keep one bound source-owned call ledger", retainedOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, RECOVERY_TICK);
  const run = runQualified("argentina", retained);
  const before = run.states.get(RELEASE_TICK - 1);
  const released = run.states.get(RELEASE_TICK);
  const after = run.states.get(RELEASE_TICK + 1);

  assert.equal(before.rng.calls, RELEASE_TICK - 1);
  assert.equal(released.centrePassAction.release.tick, RELEASE_TICK);
  assert.equal(released.centrePassAction.release.rng.calls, RELEASE_TICK + 1);
  assert.deepEqual(released.rng, released.centrePassAction.release.rng);
  assert.equal(after.rng.calls, RELEASE_TICK + 2);
  assert.equal(run.finalState.rng.calls, RECOVERY_TICK + 1);
  assert.equal(
    released.rng.seed,
    requiredSample(retained.get(RELEASE_TICK), "rng.seed").value,
  );
  assert.notEqual(
    run.finalState.rng.seed,
    requiredSample(retained.get(RECOVERY_TICK), "rng.seed").value,
  );
  assert.ok(projectCssoccerOpeningLiveLaunchCapturedFields(before)
    .some(({ fieldId }) => fieldId === "rng.seed"));
  assert.ok(projectCssoccerOpeningLiveLaunchCapturedFields(released)
    .every(({ fieldId }) => !fieldId.startsWith("rng.")));
  assert.deepEqual(CSSOCCER_OPENING_LIVE_LAUNCH_QUALIFICATION.globalRng, {
    ordinaryCallsPerTick: 1,
    passBallExtraCalls: 1,
    capturedExactWhile: "centre-pass action has not released",
    withheldAfter:
      "release because ordinary live AI owns later same-tick RNG calls not composed here",
  });
});

test("tm_mcspd remains the launch-time fixture flair plus initial rate formula", retainedOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, RECOVERY_TICK);
  const run = runQualified("argentina", retained);
  const fixture = CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.find(
    ({ id }) => id === "spain-player-07",
  );
  const expected = F32((fixture.attributes.flair + fixture.attributes.pace) / 128);
  for (const state of run.states.values()) {
    assert.equal(state.centrePassAction.taker.motionCaptureSpeed, expected);
    assert.equal(
      state.centrePassAction.taker.animationStep,
      F32(CSSOCCER_CENTRE_PASS_ACTION_PROFILE.baseFrameStep * expected),
    );
  }
});

test("Spain selection preserves native-A pass arithmetic and mirrors only control identity", retainedOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, NORMAL_LIVE_TICK);
  const argentina = runQualified("argentina", retained);
  const spain = runQualified("spain", retained);

  for (const tick of range(LAUNCH_TICK, RECOVERY_TICK)) {
    const argentinaState = argentina.states.get(tick);
    const spainState = spain.states.get(tick);
    assert.deepEqual(spainState.centrePassAction, argentinaState.centrePassAction, `pass ${tick}`);
    assert.deepEqual(spainState.lifecycle.clock, argentinaState.lifecycle.clock, `clock ${tick}`);
    assert.deepEqual(spainState.stamina, argentinaState.stamina, `stamina ${tick}`);
    assert.deepEqual(spainState.rng, argentinaState.rng, `rng ${tick}`);
    const fixtureNumber = tick < RELEASE_TICK ? "07" : "10";
    assert.equal(argentinaState.control.ownership.activePlayerId, `argentina-player-${fixtureNumber}`);
    assert.equal(spainState.control.ownership.activePlayerId, `spain-player-${fixtureNumber}`);
    assert.equal(spainState.control.players.filter(({ control }) => control.value === 1).length, 1);
  }
  assert.equal(spain.finalState.centrePassAction.owner.country, "spain");
  assert.equal(spain.finalState.centrePassAction.owner.nativeTeamSlot, "A");
  const argentinaHeld = stepCssoccerOpeningLiveLaunchState(
    argentina.finalState,
    actionContext(argentina.finalState, retained, NORMAL_LIVE_TICK),
  );
  const spainHeld = stepCssoccerOpeningLiveLaunchState(
    spain.finalState,
    actionContext(spain.finalState, retained, NORMAL_LIVE_TICK),
  );
  assert.deepEqual(spainHeld.heldBall, argentinaHeld.heldBall);
  assert.deepEqual(spainHeld.lifecycle.clock, argentinaHeld.lifecycle.clock);
  assert.deepEqual(spainHeld.lifecycle.score, argentinaHeld.lifecycle.score);
  assert.deepEqual(spainHeld.stamina, argentinaHeld.stamina);
  assert.deepEqual(spainHeld.rng, argentinaHeld.rng);
  assert.equal(argentinaHeld.control.ownership.activePlayerId, "argentina-player-10");
  assert.equal(spainHeld.control.ownership.activePlayerId, "spain-player-10");
});

test("reset-equivalent centre-pass compositions serialize byte identically", retainedOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, RECOVERY_TICK);
  for (const selectedCountry of ["argentina", "spain"]) {
    const first = runQualified(selectedCountry, retained);
    const repeated = runQualified(selectedCountry, retained);
    assert.equal(
      JSON.stringify([...first.states]),
      JSON.stringify([...repeated.states]),
      selectedCountry,
    );
  }
});

test("missing or malformed source-owner facts fail without mutating the accepted state", retainedOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, RECOVERY_TICK);
  const run = runQualified("argentina", retained);

  const beforeRelease = run.states.get(RELEASE_TICK - 1);
  assertFailsWithoutMutation(
    beforeRelease,
    () => stepCssoccerOpeningLiveLaunchState(beforeRelease),
    "ground-pass-release",
  );
  const malformedRelease = actionContext(beforeRelease, retained, RELEASE_TICK);
  malformedRelease.release.rng = {
    ...malformedRelease.release.rng,
    calls: malformedRelease.release.rng.calls + 1,
  };
  assertFailsWithoutMutation(
    beforeRelease,
    () => stepCssoccerOpeningLiveLaunchState(beforeRelease, malformedRelease),
    "pass-rng-lineage",
  );

  const released = run.states.get(RELEASE_TICK);
  assertFailsWithoutMutation(
    released,
    () => stepCssoccerOpeningLiveLaunchState(released),
    "receiver-frame",
  );

  const beforeReceipt = run.states.get(RECEIPT_TICK - 1);
  const rejectedReceipt = actionContext(beforeReceipt, retained, RECEIPT_TICK);
  rejectedReceipt.receiver.controlAccepted = false;
  assertFailsWithoutMutation(
    beforeReceipt,
    () => stepCssoccerOpeningLiveLaunchState(beforeReceipt, rejectedReceipt),
    "receiver-control",
  );

  const beforeRecovery = run.states.get(RECOVERY_TICK - 1);
  const missingRecovery = actionContext(beforeRecovery, retained, RECOVERY_TICK);
  delete missingRecovery.recovery;
  assertFailsWithoutMutation(
    beforeRecovery,
    () => stepCssoccerOpeningLiveLaunchState(beforeRecovery, missingRecovery),
    "recovery-direction",
  );
});

test("tick 186 composes normal hold_ball exactly and stops at the next gameplay producer", retainedOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, NORMAL_LIVE_TICK);
  const run = runQualified("argentina", retained, NORMAL_LIVE_TICK);
  const state = run.finalState;
  const before = retained.get(RECOVERY_TICK);
  const frontier = retained.get(NORMAL_LIVE_TICK);
  assert.equal(state.tick, NORMAL_LIVE_TICK);
  assert.equal(state.centrePassAction.tick, RECOVERY_TICK);
  assert.equal(state.centrePassAction.phase, "complete");
  assert.equal(state.heldBall.phase, "normal-held-ball");
  assert.equal(state.heldBall.owner.stableId, "spain-player-10");

  const projected = projectCssoccerOpeningLiveLaunchCapturedFields(state);
  for (const field of projected) {
    assert.deepEqual(
      field,
      scalar(requiredSample(frontier, field.fieldId)),
      `tick ${NORMAL_LIVE_TICK} ${field.fieldId}`,
    );
  }
  const owned = new Set(
    projected.map(({ fieldId }) => fieldId),
  );
  const firstChangedUncomposedPlayerField = [...frontier.keys()].find((fieldId) => (
    fieldId.startsWith("players.")
    && !owned.has(fieldId)
    && requiredSample(before, fieldId).numericBits
      !== requiredSample(frontier, fieldId).numericBits
  ));
  assert.equal(
    firstChangedUncomposedPlayerField,
    "players.argentina-player-02.animation_frame",
  );

  assertFailsWithoutMutation(
    state.centrePassAction,
    () => stepCssoccerCentrePassAction(state.centrePassAction),
    "action-complete",
  );
  assertFailsWithoutMutation(
    state,
    () => stepCssoccerOpeningLiveLaunchState(state),
    "normal-live-player-animation-frontier",
  );
  assert.deepEqual(CSSOCCER_OPENING_LIVE_LAUNCH_QUALIFICATION.unsupportedNext, {
    tick: NORMAL_LIVE_TICK,
    phase: "post_tick",
    fieldId: "players.argentina-player-02.animation_frame",
    valueType: "f32",
    boundary: "normal-live-player-animation-frontier",
    producer: "ACTIONS.CPP process_anims",
    owner: "ordinary native-player-13 animation state",
    missingSeam:
      "the held-ball transition is exact, but no composed live-player animation state carries native player 13 into tick 186",
  });
  try {
    stepCssoccerOpeningLiveLaunchState(state);
    assert.fail("partial tick 186 frontier must fail");
  } catch (error) {
    assert.equal(error.detail.frontierTick, NORMAL_LIVE_TICK);
    assert.equal(error.detail.requestedTick, NORMAL_LIVE_TICK + 1);
    assert.equal(
      error.detail.fieldId,
      "players.argentina-player-02.animation_frame",
    );
    assert.equal(error.detail.producer, "ACTIONS.CPP process_anims");
  }
});

test("runtime stays browser-safe and contains no release/receipt fixture table", () => {
  const source = readFileSync(RUNTIME_URL, "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(source, /node:|readFile|createReadStream|\.local\//u);
  assert.doesNotMatch(source, /(?:RELEASE|RECEIPT|RECOVERY)_TICK|retainedWindow|nativeRuntimeValues/u);
  assert.match(source, /stepCssoccerCentrePassAction/u);
  assert.match(source, /advanceCssoccerNativeRng\(ordinaryRng\)/u);
  assert.deepEqual(CSSOCCER_OPENING_LIVE_LAUNCH_QUALIFICATION.downstreamOwners, [
    "ordinary 22-player live motion and AI materialization",
    "all-player post-launch animation profile composition",
    "normal-play officials, rules, and general auto-selection",
    "same-tick global RNG calls outside the ordinary loop and pass_ball",
  ]);
});

function runQualified(selectedCountry, retained, endTick = RECOVERY_TICK) {
  let state = createCssoccerOpeningLiveLaunchState({
    opening: openingAt171(selectedCountry),
  });
  const states = new Map([[state.tick, state]]);
  while (state.tick < endTick) {
    const tick = state.tick + 1;
    state = stepCssoccerOpeningLiveLaunchState(
      state,
      actionContext(state, retained, tick),
    );
    states.set(tick, state);
  }
  return { states, finalState: state };
}

function actionContext(state, retained, tick) {
  const context = {};
  if (tick === RELEASE_TICK) {
    const previous = retained.get(tick - 1);
    const raw = retainedRawPlayerFrame(tick - 1, 10);
    const receiverId = state.centrePassAction.owner.receiverId;
    context.release = {
      simulation: true,
      ballLimbo: { active: false },
      takerAccuracy: fixturePlayer(state.centrePassAction.owner.takerId).attributes.accuracy,
      wantedReceiver: false,
      rng: advanceCssoccerNativeRng(state.rng),
      receiver: {
        stableId: receiverId,
        nativePlayerNumber: 10,
        actionId: requiredSample(previous, "players.spain-player-10.action").value,
        position: playerPosition(previous, 10),
        goDisplacement: {
          x: raw.goXDisplacement,
          y: raw.goYDisplacement,
        },
      },
    };
  }
  if (tick > RELEASE_TICK && tick <= RECOVERY_TICK) {
    const previous = retained.get(tick - 1);
    const current = retained.get(tick);
    const collected = tick === RECEIPT_TICK;
    const owned = tick >= RECEIPT_TICK;
    context.receiver = {
      tick,
      stableId: state.centrePassAction.owner.receiverId,
      nativePlayerNumber: 10,
      actionId: requiredSample(previous, "players.spain-player-10.action").value,
      animationFrame: requiredSample(
        current,
        "players.spain-player-10.animation_frame",
      ).value,
      position: playerPosition(previous, 10),
      facing: playerFacing(previous, 10),
      goDisplacement: collected || owned
        ? {
            x: requiredSample(current, "ball.x_displacement").value,
            y: requiredSample(current, "ball.y_displacement").value,
          }
        : { x: F32(0), y: F32(0) },
      collect: collected,
      controlAccepted: collected ? true : null,
    };
  }
  if (tick === RECOVERY_TICK) {
    context.recovery = {
      stableId: state.centrePassAction.owner.takerId,
      postDirectionFacing: playerFacing(retained.get(tick), 7),
    };
  }
  if (tick === NORMAL_LIVE_TICK) {
    const previous = retained.get(tick - 1);
    const current = retained.get(tick);
    const raw = retainedRawPlayerFrame(tick - 1, 10);
    context.heldBall = createCssoccerHeldBallOwnerFrame({
      tick,
      stableId: state.centrePassAction.owner.receiverId,
      nativePlayerNumber: 10,
      actionId: requiredSample(
        current,
        "players.spain-player-10.action",
      ).value,
      animationFrame: requiredSample(
        current,
        "players.spain-player-10.animation_frame",
      ).value,
      position: playerPosition(previous, 10),
      facing: playerFacing(previous, 10),
      goDisplacement: {
        x: raw.goXDisplacement,
        y: raw.goYDisplacement,
      },
      setPieceActive: requiredSample(previous, "rules.set_piece").value !== 0,
      ballInHands: requiredSample(previous, "ball.in_hands").value !== 0,
      motionCaptureTween: raw.motionCaptureFinish < -1,
      deadBallCount: requiredSample(
        previous,
        "rules.dead_ball_count",
      ).value,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      fixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    });
  }
  return context;
}

function playerPosition(fields, nativePlayerNumber) {
  const id = `players.spain-player-${String(nativePlayerNumber).padStart(2, "0")}`;
  return {
    x: requiredSample(fields, `${id}.x`).value,
    y: requiredSample(fields, `${id}.y`).value,
    z: requiredSample(fields, `${id}.z`).value,
  };
}

function playerFacing(fields, nativePlayerNumber) {
  const id = `players.spain-player-${String(nativePlayerNumber).padStart(2, "0")}`;
  return {
    x: requiredSample(fields, `${id}.x_displacement`).value,
    y: requiredSample(fields, `${id}.y_displacement`).value,
  };
}

function fixturePlayer(id) {
  const player = CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(player, `fixture player ${id}`);
  return player;
}

function assertFailsWithoutMutation(state, callback, expectedBoundary) {
  const before = JSON.stringify(state);
  assert.throws(
    callback,
    (error) => error?.boundary === expectedBoundary,
    expectedBoundary,
  );
  assert.equal(JSON.stringify(state), before, `${expectedBoundary} mutation`);
  assertDeepFrozen(state);
}

const openingCache = new Map();

function openingAt171(selectedCountry) {
  if (!openingCache.has(selectedCountry)) {
    let state = createCssoccerOpeningMatchState({
      preparedFacts: JSON.parse(readFileSync(FACTS_URL, "utf8")),
      preparedScene: JSON.parse(readFileSync(SCENE_URL, "utf8")),
      selectedCountry,
    });
    while (state.tick < OPENING_TICK) state = stepCssoccerOpeningMatchState(state);
    openingCache.set(selectedCountry, state);
  }
  return openingCache.get(selectedCountry);
}

const retainedCache = new Map();

async function retainedWindow(startTick, endTick) {
  const key = `${startTick}-${endTick}`;
  if (retainedCache.has(key)) return retainedCache.get(key);
  const ticks = new Map(range(startTick, endTick).map((tick) => [tick, new Map()]));
  const input = createReadStream(RETAINED_URL);
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.recordType !== "sample") continue;
    if (record.tick > endTick) {
      lines.close();
      input.destroy();
      break;
    }
    if (record.tick >= startTick) ticks.get(record.tick).set(record.fieldId, record);
  }
  assert.ok([...ticks.values()].every((fields) => fields.size === 412));
  retainedCache.set(key, ticks);
  return ticks;
}

function retainedRawStaminaWindow(startTick, endTick) {
  const bytes = readFileSync(RETAINED_RAW_URL);
  const raw = JSON.parse(readFileSync(CONTRACT_URL, "utf8")).oracle.capture.raw;
  assert.equal(bytes.subarray(0, 8).toString("ascii"), raw.magic);
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
  for (let offset = descriptorOffset; offset < bytes.length; offset += recordBytes) {
    const tick = bytes.readUInt32LE(offset + 20);
    const flags = bytes.readUInt32LE(offset + 24);
    if (tick < startTick || tick > endTick || (flags & raw.flags.active) === 0) continue;
    const teamsPayload = offset + raw.metadataBytes + teamsRange.payloadBase
      + teamsAddress - teamsRange.offset;
    result.set(tick, Array.from({ length: 22 }, (_, index) => {
      const country = index < 11 ? "spain" : "argentina";
      const shirt = String((index % 11) + 1).padStart(2, "0");
      const id = `${country}-player-${shirt}`;
      const base = teamsPayload + (index * 203);
      return [
        rawU8(`players.${id}.rate`, bytes.readUInt8(base + 70)),
        rawU8(`players.${id}.stamina`, bytes.readUInt8(base + 76)),
        rawU8(`players.${id}.player_minutes`, bytes.readUInt8(base + 104)),
      ];
    }).flat());
  }
  assert.deepEqual([...result.keys()], range(startTick, endTick));
  return result;
}

function retainedRawPlayerFrame(tick, nativePlayerNumber) {
  const bytes = readFileSync(RETAINED_RAW_URL);
  const raw = JSON.parse(readFileSync(CONTRACT_URL, "utf8")).oracle.capture.raw;
  assert.equal(bytes.subarray(0, 8).toString("ascii"), raw.magic);
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
  for (let offset = descriptorOffset; offset < bytes.length; offset += recordBytes) {
    const recordTick = bytes.readUInt32LE(offset + 20);
    const flags = bytes.readUInt32LE(offset + 24);
    if (recordTick !== tick || (flags & raw.flags.active) === 0) continue;
    const player = offset + raw.metadataBytes + teamsRange.payloadBase
      + teamsAddress - teamsRange.offset
      + ((nativePlayerNumber - 1) * 203);
    return {
      motionCaptureFinish: bytes.readInt16LE(player + 59),
      goXDisplacement: bytes.readFloatLE(player + 160),
      goYDisplacement: bytes.readFloatLE(player + 164),
    };
  }
  assert.fail(`active raw tick ${tick}`);
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
  const value = fields?.get(fieldId);
  assert.ok(value, `retained field ${fieldId}`);
  return value;
}

function scalar(value) {
  return {
    fieldId: value.fieldId,
    valueType: value.valueType,
    value: value.value,
    numericBits: value.numericBits,
  };
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
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
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

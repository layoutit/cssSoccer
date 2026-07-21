import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_NATIVE_ACTIONS,
  createCssoccerActionState,
} from "../src/cssoccer/actionState.mjs";
import { createBallMatchState } from "../src/cssoccer/ballMatchState.mjs";
import {
  CSSOCCER_CENTRE_PASS_CONSTANTS,
  CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA,
  CSSOCCER_CENTRE_PASS_SOURCE,
  CssoccerUnsupportedCentrePassError,
  launchCssoccerCentrePass,
} from "../src/cssoccer/centrePassLaunch.mjs";
import {
  CSSOCCER_KICKOFF_LAUNCH_RECEIPT_SCHEMA,
  CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA,
  completeCssoccerKickoffLaunch,
  createCssoccerKickoffState,
  stepCssoccerKickoffState,
} from "../src/cssoccer/kickoffState.mjs";
import { stepCssoccerMatchLifecycle } from "../src/cssoccer/matchLifecycle.mjs";
import { createCssoccerMatchState } from "../src/cssoccer/matchState.mjs";
import { createPossessionState } from "../src/cssoccer/possessionState.mjs";

const f32 = Math.fround;
const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const fixtureFiles = {
  facts: new URL("facts/spain-argentina-full-match.json", generatedRoot),
  scene: new URL("scenes/spain-argentina-full-match.json", generatedRoot),
};
const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const sourceFiles = Object.fromEntries(
  CSSOCCER_CENTRE_PASS_SOURCE.files.map(({ file }) => [file, new URL(file, sourceRoot)]),
);
const retainedUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const fixtureOptions = skipUnless(Object.values(fixtureFiles), "prepared centre-pass fixture");
const sourceOptions = skipUnless(Object.values(sourceFiles), "ignored pinned Actua source");
const retainedOptions = skipUnless(
  [...Object.values(fixtureFiles), retainedUrl],
  "prepared fixture and retained centre-pass windows",
);

let matchCache;
let secondHalfLifecycleCache;

test("opening centre request collects native 7 and starts the exact pre-contact kick", fixtureOptions, () => {
  const pending = openingPending();
  const input = launchInput(pending, 172);
  const result = launchCssoccerCentrePass(input);

  assert.equal(result.schema, CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA);
  assert.equal(result.tick, 172);
  assert.equal(result.matchHalf, 0);
  assert.equal(result.owner.country, "spain");
  assert.equal(result.owner.takerId, "spain-player-07");
  assert.deepEqual(result.request, pending.pendingAction);
  assert.deepEqual(result.receipt, {
    schema: CSSOCCER_KICKOFF_LAUNCH_RECEIPT_SCHEMA,
    type: "launch-applied",
    actionType: "pass",
    nativePlayerNumber: 7,
    targetPlayerNumber: 10,
    profileHash: pending.bindings.sourceProfileHash,
  });

  assert.equal(result.action.playerId, "spain-player-07");
  assert.equal(result.action.action.value, CSSOCCER_NATIVE_ACTIONS.KICK);
  assert.equal(result.action.action.valueType, "i16");
  assert.equal(result.action.action.numericBits, "000f");
  assert.equal(result.action.facing.x.numericBits, "00000000");
  assert.equal(result.action.facing.y.numericBits, "3f800000");

  assert.deepEqual(result.ball, input.ball);
  assert.equal(result.possession.owner, 7);
  assert.equal(result.possession.lastTouch, 7);
  assert.equal(result.possession.previousTouch, 0);
  assert.equal(result.possession.preKeeperTouch, 7);
  assert.equal(result.possession.cannotPickUp, 7);
  assert.equal(result.possession.inHands, 0);
  assert.equal(nativePlayer(result.possession, 7).stableId, "spain-player-07");
  assert.equal(nativePlayer(result.possession, 7).possession, 1);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.nativeFields.ball), true);

  const fields = fieldMap(result);
  assert.deepEqual(fields.get("ball.possession"), {
    fieldId: "ball.possession",
    valueType: "i32",
    value: 7,
    numericBits: "00000007",
  });
  assert.equal(fields.get("ball.x").numericBits, "44200000");
  assert.equal(fields.get("ball.y").numericBits, "43c80000");
  assert.equal(fields.get("ball.z").numericBits, "40000000");

  const live = completeCssoccerKickoffLaunch(pending, result.receipt);
  assert.equal(live.phase, "normal-play");
  assert.equal(live.ball.launchProfileHash, pending.bindings.sourceProfileHash);
});

test("post-swap native A launches the same 7 to 10 pass for stable Argentina", fixtureOptions, () => {
  const pending = secondHalfPending();
  const result = launchCssoccerCentrePass(launchInput(pending, 1780));

  assert.equal(result.matchHalf, 1);
  assert.deepEqual(result.owner, {
    country: "argentina",
    nativeTeamSlot: "A",
    fixtureTeamIndex: 1,
    takerId: "argentina-player-07",
    takerNativePlayerNumber: 7,
    receiverId: "argentina-player-10",
    receiverNativePlayerNumber: 10,
  });
  assert.equal(result.action.playerId, "argentina-player-07");
  assert.equal(nativePlayer(result.possession, 7).stableId, "argentina-player-07");
  assert.equal(nativePlayer(result.possession, 10).stableId, "argentina-player-10");
  assert.equal(nativePlayer(result.possession, 12).stableId, "spain-player-01");
  assert.equal(result.receipt.nativePlayerNumber, 7);
  assert.equal(result.receipt.targetPlayerNumber, 10);
  assert.equal(completeCssoccerKickoffLaunch(pending, result.receipt).phase, "normal-play");
});

test("launch rejects request, profile, tick, owner, action, ball, and replay drift", fixtureOptions, () => {
  const pending = openingPending();
  const input = launchInput(pending, 172);
  const accepted = launchCssoccerCentrePass(input);

  assert.throws(
    () => launchCssoccerCentrePass({
      ...input,
      gameplayProfile: { ...input.gameplayProfile, profileHash: "b".repeat(64) },
    }),
    boundary("gameplay-profile"),
  );
  assert.throws(
    () => launchCssoccerCentrePass({ ...input, tick: 173 }),
    boundary("ball-state"),
  );
  assert.throws(
    () => launchCssoccerCentrePass({
      ...input,
      takerAction: createCssoccerActionState({
        tick: 172,
        playerId: "argentina-player-07",
        actionId: 0,
        facingX: f32(0),
        facingY: f32(1),
      }),
    }),
    boundary("action-state"),
  );
  assert.throws(
    () => launchCssoccerCentrePass({ ...input, takerAction: accepted.action }),
    boundary("action-state"),
  );
  assert.throws(
    () => launchCssoccerCentrePass({ ...input, possession: accepted.possession }),
    boundary("possession-state"),
  );
  assert.throws(
    () => launchCssoccerCentrePass({
      ...input,
      ball: createBallMatchState({
        ball: {
          tick: 172,
          position: { x: f32(641), y: f32(400), z: f32(2) },
          previousPosition: { x: f32(641), y: f32(400), z: f32(2) },
        },
      }),
    }),
    boundary("ball-state"),
  );

  const wrongRequest = structuredClone(pending);
  wrongRequest.pendingAction.targetPlayerNumber = 9;
  assert.throws(
    () => launchCssoccerCentrePass({ ...input, kickoff: wrongRequest }),
    boundary("kickoff-request"),
  );

  const wrongIdentity = structuredClone(input.possession);
  const player7 = wrongIdentity.players.find(({ nativePlayer }) => nativePlayer === 7);
  const player18 = wrongIdentity.players.find(({ nativePlayer }) => nativePlayer === 18);
  [player7.stableId, player18.stableId] = [player18.stableId, player7.stableId];
  assert.throws(
    () => launchCssoccerCentrePass({ ...input, possession: wrongIdentity }),
    boundary("owner-identity"),
  );
});

test("reset-equivalent launches remain byte deterministic in both halves", fixtureOptions, () => {
  const opening = launchInput(openingPending(), 172);
  const second = launchInput(secondHalfPending(), 1780);
  assert.equal(
    JSON.stringify(launchCssoccerCentrePass(opening)),
    JSON.stringify(launchCssoccerCentrePass(structuredClone(opening))),
  );
  assert.equal(
    JSON.stringify(launchCssoccerCentrePass(second)),
    JSON.stringify(launchCssoccerCentrePass(structuredClone(second))),
  );
});

test("pinned source fixes centre pass 5, native 7 possession, and KICK_ACT order", sourceOptions, () => {
  for (const source of CSSOCCER_CENTRE_PASS_SOURCE.files) {
    assert.equal(sha256(sourceFiles[source.file]), source.sha256, `${source.file} hash`);
  }
  const rules = readFileSync(sourceFiles["RULES.CPP"], "utf8");
  const intelligence = readFileSync(sourceFiles["INTELL.CPP"], "utf8");
  const actions = readFileSync(sourceFiles["ACTIONS.CPP"], "utf8");
  const ballInteraction = readFileSync(sourceFiles["BALLINT.CPP"], "utf8");
  assert.match(rules, /case\(SETP_CENTRE\):[\s\S]*p=centre_guy_2;[\s\S]*pass_type=5;[\s\S]*make_pass/u);
  assert.match(rules, /collect_ball\(&teams\[setp_taker-1\]\);[\s\S]*decide_set_kick\(\);[\s\S]*ready_set_kick\(\);/u);
  assert.match(intelligence, /case\(5\):[\s\S]*init_kick_act\(&teams\[ball_poss-1\],MC_PASSL,MCC_PASS\);/u);
  assert.match(actions, /void init_kick_act[\s\S]*player->tm_act=KICK_ACT;/u);
  assert.match(ballInteraction, /void collect_ball[\s\S]*hold_ball\(player\);[\s\S]*ball_poss=player->tm_player;[\s\S]*player->tm_poss=1;/u);
  assert.deepEqual(CSSOCCER_CENTRE_PASS_CONSTANTS, {
    nativePlayerNumber: 7,
    targetPlayerNumber: 10,
    passType: 5,
    standAction: 0,
    kickAction: 15,
    kickAnimation: 39,
    passContact: f32(48 / 99),
    centreSpot: { x: f32(640), y: f32(400), z: f32(2) },
  });
});

test("retained release endpoints qualify owned native-slot fields without feeding runtime", retainedOptions, async () => {
  const retained = await retainedTicks(new Set([172, 1780]));
  const launches = new Map([
    [172, launchCssoccerCentrePass(launchInput(openingPending(), 172))],
    [1780, launchCssoccerCentrePass(launchInput(secondHalfPending(), 1780))],
  ]);

  for (const [tick, launch] of launches) {
    const expected = retained.get(tick);
    // The retained contract labels native slot 7 with its fixed capture path;
    // stable country ownership is asserted independently above after end swap.
    assert.deepEqual(
      typedScalar(launch.action.action),
      typedScalar(expected.get("players.spain-player-07.action")),
    );
    assert.deepEqual(
      possessionField(launch, "ball.possession"),
      sampleValue(expected.get("ball.possession")),
    );
    assert.deepEqual(
      possessionField(launch, "ball.last_touch"),
      sampleValue(expected.get("ball.last_touch")),
    );
    assert.deepEqual(
      typedI16(
        "players.spain-player-07.possession",
        nativePlayer(launch.possession, 7).possession,
      ),
      sampleValue(expected.get("players.spain-player-07.possession")),
    );
    for (const fieldId of [
      "ball.in_air",
      "ball.speed",
      "ball.still",
      "ball.x_displacement",
      "ball.y_displacement",
      "ball.z_displacement",
    ]) {
      assert.deepEqual(ballField(launch, fieldId), sampleValue(expected.get(fieldId)), `${fieldId} ${tick}`);
    }

    // The same native tick later applies player animation/mocap offsets. That
    // downstream position is intentionally not imported into this reducer.
    assert.notEqual(ballField(launch, "ball.x").numericBits, expected.get("ball.x").numericBits);
  }
});

test("runtime launch module is browser-safe and has no retained-value dependency", () => {
  const source = readFileSync(new URL("../src/cssoccer/centrePassLaunch.mjs", import.meta.url), "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(source, /node:fs|readFile|\.local\/|state\.jsonl|canonical-a/u);
  assert.match(source, /keep the set-piece ball held until the later animation contact owner/u);
});

function preparedMatch() {
  matchCache ??= createCssoccerMatchState({
    preparedFacts: JSON.parse(readFileSync(fixtureFiles.facts, "utf8")),
    preparedScene: JSON.parse(readFileSync(fixtureFiles.scene, "utf8")),
    selectedCountry: "argentina",
  });
  return matchCache;
}

function secondHalfLifecycle() {
  if (secondHalfLifecycleCache) return secondHalfLifecycleCache;
  let lifecycle = preparedMatch().lifecycle;
  while (lifecycle.clock.phase !== "halftime-end-swap-second-half-kickoff") {
    lifecycle = stepCssoccerMatchLifecycle(lifecycle).state;
  }
  secondHalfLifecycleCache = lifecycle;
  return lifecycle;
}

function openingPending() {
  return readyPending(createCssoccerKickoffState({
    lifecycle: preparedMatch().lifecycle,
    tacticsState: preparedMatch().tactics,
    sourceProfile: testSourceProfile(),
  }));
}

function secondHalfPending() {
  return readyPending(createCssoccerKickoffState({
    lifecycle: secondHalfLifecycle(),
    tacticsState: preparedMatch().tactics,
    sourceProfile: testSourceProfile(),
  }));
}

function readyPending(state) {
  return stepCssoccerKickoffState(state, {
    players: state.players.map((player) => ({
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      action: state.sourceProfile.actionIds.stand,
      directionMode: 0,
      offState: 0,
      position: { ...player.target },
      facing: player.role === "taker"
        ? { x: f32(0), y: f32(1) }
        : { x: f32(1), y: f32(0) },
    })),
    refereeAction: state.sourceProfile.officialActionIds.ready,
  });
}

function testSourceProfile() {
  // Synthetic adapter values test the strict binding only; the hash does not
  // claim that these currently unprepared inputs are the compiled profile.
  return {
    schema: CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA,
    profileHash: "a".repeat(64),
    keeperOffline: f32(8),
    facingAngle: f32(0.99),
    besideBall: f32(4),
    setPieceWaitTicks: 5000,
    actionIds: { stand: 0, run: 1, pickup: 19 },
    officialActionIds: { normal: 0, positioning: 1, ready: 4, waitForKick: 2 },
  };
}

function launchInput(pending, tick) {
  return {
    tick,
    kickoff: pending,
    ball: createBallMatchState({
      ball: {
        tick,
        position: pending.ball.position,
        previousPosition: pending.ball.position,
      },
    }),
    possession: freePossession(pending.teamBySlot),
    takerAction: createCssoccerActionState({
      tick,
      playerId: pending.owner.takerId,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: f32(0),
      facingY: f32(1),
    }),
    gameplayProfile: {
      schema: "test-exact-gameplay-profile@1",
      profileHash: pending.bindings.sourceProfileHash,
    },
  };
}

function freePossession(teamBySlot) {
  return createPossessionState({
    players: Array.from({ length: 22 }, (_, index) => {
      const nativePlayer = index + 1;
      const country = nativePlayer <= 11 ? teamBySlot.A : teamBySlot.B;
      const rosterNumber = nativePlayer <= 11 ? nativePlayer : nativePlayer - 11;
      return {
        nativePlayer,
        stableId: `${country}-player-${String(rosterNumber).padStart(2, "0")}`,
        possession: 0,
      };
    }),
  });
}

function fieldMap(result) {
  return new Map([
    ...result.nativeFields.ball,
    ...result.nativeFields.possession,
  ].map((field) => [field.fieldId, stripStream(field)]));
}

function ballField(result, fieldId) {
  return stripStream(result.nativeFields.ball.find((field) => field.fieldId === fieldId));
}

function possessionField(result, fieldId) {
  return result.nativeFields.possession.find((field) => field.fieldId === fieldId);
}

function nativePlayer(possession, number) {
  return possession.players.find(({ nativePlayer }) => nativePlayer === number);
}

function typedI16(fieldId, value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setInt16(0, value, false);
  return {
    fieldId,
    valueType: "i16",
    value,
    numericBits: [...bytes].map((entry) => entry.toString(16).padStart(2, "0")).join(""),
  };
}

function stripStream(field) {
  const { fieldId, valueType, value, numericBits } = field;
  return { fieldId, valueType, value, numericBits };
}

function sampleValue(sample) {
  return {
    fieldId: sample.fieldId,
    valueType: sample.valueType,
    value: sample.value,
    numericBits: sample.numericBits,
  };
}

function typedScalar(sample) {
  return {
    valueType: sample.valueType,
    value: sample.value,
    numericBits: sample.numericBits,
  };
}

async function retainedTicks(wantedTicks) {
  const ticks = new Map([...wantedTicks].map((tick) => [tick, new Map()]));
  const wantedFields = new Set([
    "ball.in_air",
    "ball.last_touch",
    "ball.possession",
    "ball.speed",
    "ball.still",
    "ball.x",
    "ball.x_displacement",
    "ball.y_displacement",
    "ball.z_displacement",
    "players.spain-player-07.action",
    "players.spain-player-07.possession",
  ]);
  const lines = createInterface({ input: createReadStream(retainedUrl) });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (ticks.has(record.tick) && wantedFields.has(record.fieldId)) {
      ticks.get(record.tick).set(record.fieldId, record);
    }
  }
  for (const [tick, fields] of ticks) {
    assert.equal(fields.size, wantedFields.size, `retained tick ${tick} field count`);
  }
  return ticks;
}

function boundary(expected) {
  return (error) => error instanceof CssoccerUnsupportedCentrePassError
    && error.boundary === expected;
}

function sha256(url) {
  return createHash("sha256").update(readFileSync(url)).digest("hex");
}

function skipUnless(urls, label) {
  return urls.every((url) => existsSync(url))
    ? {}
    : { skip: `${label} unavailable` };
}

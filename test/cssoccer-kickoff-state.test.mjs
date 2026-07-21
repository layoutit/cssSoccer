import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_KICKOFF_ACTION_REQUEST_SCHEMA,
  CSSOCCER_KICKOFF_CONSTANTS,
  CSSOCCER_KICKOFF_LAUNCH_RECEIPT_SCHEMA,
  CSSOCCER_KICKOFF_NATIVE_PHASE_FIELD_CONTRACT,
  CSSOCCER_KICKOFF_SOURCE,
  CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA,
  CssoccerUnsupportedKickoffError,
  assertCssoccerKickoffState,
  completeCssoccerKickoffLaunch,
  createCssoccerCentreSetup,
  createCssoccerKickoffState,
  projectCssoccerKickoffNativePhaseFields,
  stepCssoccerKickoffState,
} from "../src/cssoccer/kickoffState.mjs";
import {
  stepCssoccerMatchLifecycle,
} from "../src/cssoccer/matchLifecycle.mjs";
import { createCssoccerMatchState } from "../src/cssoccer/matchState.mjs";

const f32 = Math.fround;
const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const fixtureFiles = {
  facts: new URL("facts/spain-argentina-full-match.json", generatedRoot),
  scene: new URL("scenes/spain-argentina-full-match.json", generatedRoot),
};
const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const sourceFiles = Object.fromEntries(
  CSSOCCER_KICKOFF_SOURCE.files.map(({ file }) => [file, new URL(file, sourceRoot)]),
);
const retainedUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const fixtureOptions = skipUnless(Object.values(fixtureFiles), "prepared kickoff fixture");
const sourceOptions = skipUnless(Object.values(sourceFiles), "ignored Actua source");
const retainedOptions = skipUnless(
  [...Object.values(fixtureFiles), retainedUrl],
  "prepared fixture and retained kickoff qualification stream",
);

let matchCache;
let secondHalfLifecycleCache;

test("opening centre setup selects strict row-68 takers and publishes every source target", fixtureOptions, () => {
  const match = preparedMatch();
  const state = createOpening(match);

  assert.equal(assertCssoccerKickoffState(state), state);
  assert.deepEqual(state.owner, {
    country: "spain",
    nativeTeamSlot: "A",
    fixtureTeamIndex: 0,
    takerId: "spain-player-07",
    takerNativePlayerNumber: 7,
    receiverId: "spain-player-10",
    receiverNativePlayerNumber: 10,
  });
  assert.deepEqual(state.teamBySlot, { A: "spain", B: "argentina" });
  assert.deepEqual(target(state, "spain-player-07"), {
    x: f32(640),
    y: f32(390),
  });
  assert.deepEqual(target(state, "spain-player-10"), {
    x: f32(645),
    y: f32(410),
  });
  assert.deepEqual(target(state, "spain-player-01"), {
    x: testSourceProfile().keeperOffline,
    y: f32(399),
  });
  assert.deepEqual(target(state, "argentina-player-01"), {
    x: f32(1280 - testSourceProfile().keeperOffline),
    y: f32(399),
  });
  assert.deepEqual(
    target(state, "spain-player-02"),
    point(match.tactics.slots.A.values[68][0]),
  );
  const [defendingX, defendingY] = match.tactics.slots.B.values[69][0];
  assert.deepEqual(target(state, "argentina-player-02"), {
    x: f32(1280 - defendingX),
    y: f32(800 - defendingY),
  });
  assert.deepEqual(state.ball, {
    status: "held-at-centre",
    position: { x: f32(640), y: f32(400), z: f32(2) },
    possession: 0,
    launchProfileHash: null,
  });
  assert.deepEqual(state.rules, {
    deadBallCount: 40,
    gameAction: 1,
    setPiece: 3,
    matchMode: 5,
  });
  assert.deepEqual(state.clock, { clockRunning: 0, matchHalf: 0, kickoff: 0 });
  assert.equal(state.players.length, 22);
  assert.equal(new Set(state.players.map(({ id }) => id)).size, 22);
  assert.equal(new Set(state.players.map(({ nativePlayerNumber }) => nativePlayerNumber)).size, 22);
  assert.equal(Object.isFrozen(state), true);
});

test("generic centre setup mirrors native-team-B targets without replay values", fixtureOptions, () => {
  const match = preparedMatch();
  const setup = createCssoccerCentreSetup({
    lifecycle: match.lifecycle,
    tacticsState: match.tactics,
    sourceProfile: testSourceProfile(),
    nativeTeamSlot: "B",
  });
  const taker = setup.players.find(({ role }) => role === "taker");
  const receiver = setup.players.find(({ role }) => role === "receiver");
  const ordinaryB = setup.players.find((player) => (
    player.nativeTeamSlot === "B" && player.role === "outfield"
  ));
  const ordinaryA = setup.players.find((player) => (
    player.nativeTeamSlot === "A" && player.role === "outfield"
  ));

  assert.equal(setup.owner.country, "argentina");
  assert.equal(setup.owner.nativeTeamSlot, "B");
  assert.equal(taker.nativeTeamSlot, "B");
  assert.equal(receiver.nativeTeamSlot, "B");
  assert.deepEqual(taker.target, { x: f32(640), y: f32(410) });
  assert.deepEqual(receiver.target, { x: f32(645), y: f32(390) });
  assert.equal(setup.rules.matchMode, 6);
  assert.equal(ordinaryB.targetOwner, "INTELL.CPP get_target row 68");
  assert.equal(ordinaryA.targetOwner, "INTELL.CPP get_target row 69");
  assert.equal(Object.isFrozen(setup), true);
});

test("player and referee readiness release only the source centre-pass request", fixtureOptions, () => {
  const opening = createOpening(preparedMatch());
  const observations = readyObservations(opening);
  const waiting = stepCssoccerKickoffState(opening, {
    players: observations,
    refereeAction: opening.sourceProfile.officialActionIds.positioning,
  });

  assert.equal(waiting.phase, "centre-positioning");
  assert.equal(waiting.readiness.alreadyThere, true);
  assert.equal(waiting.readiness.allStanding, true);
  assert.equal(waiting.readiness.refereeReady, false);
  assert.equal(waiting.readiness.readyForLaunch, false);
  assert.equal(waiting.pendingAction, null);
  assert.equal(
    waiting.readiness.players.find(({ role }) => role === "taker").targetDistance,
    f32(0.1),
  );

  const pending = stepCssoccerKickoffState(waiting, {
    players: observations,
    refereeAction: waiting.sourceProfile.officialActionIds.ready,
  });
  assert.equal(pending.phase, "action-pending");
  assert.deepEqual(pending.pendingAction, {
    schema: CSSOCCER_KICKOFF_ACTION_REQUEST_SCHEMA,
    type: "pass",
    nativePlayerNumber: 7,
    targetPlayerNumber: 10,
    passType: 5,
    launch: "parent-owned",
  });
  assert.deepEqual(pending.ball, opening.ball);
  assert.deepEqual(pending.rules, opening.rules);
  assert.equal(pending.clock.clockRunning, 0);

  const unsettledObservations = readyObservations(opening);
  unsettledObservations[0] = {
    ...unsettledObservations[0],
    action: 99,
  };
  const unsettled = stepCssoccerKickoffState(opening, {
    players: unsettledObservations,
    refereeAction: opening.sourceProfile.officialActionIds.ready,
  });
  assert.equal(unsettled.readiness.alreadyThere, true);
  assert.equal(unsettled.readiness.allStanding, false);
  assert.equal(unsettled.phase, "centre-positioning");

  const timeoutProfile = {
    ...testSourceProfile(),
    profileHash: "b".repeat(64),
    setPieceWaitTicks: 1,
  };
  const timeoutOpening = createOpening(preparedMatch(), timeoutProfile);
  const timeout = stepCssoccerKickoffState(timeoutOpening, {
    players: readyObservations(timeoutOpening).map((player, index) => (
      index === 0 ? { ...player, action: 99 } : player
    )),
    refereeAction: timeoutOpening.sourceProfile.officialActionIds.ready,
  });
  assert.equal(timeout.readiness.setPieceWaitTicks, 1);
  assert.equal(timeout.readiness.allStanding, true);
  assert.equal(timeout.phase, "action-pending");
});

test("a matching hashed parent launch changes phase fields atomically and nothing else launches here", fixtureOptions, () => {
  const opening = createOpening(preparedMatch());
  const pending = readyPending(opening);

  assert.throws(
    () => completeCssoccerKickoffLaunch(pending),
    (error) => error instanceof CssoccerUnsupportedKickoffError
      && error.boundary === "kick-launch",
  );
  assert.throws(
    () => completeCssoccerKickoffLaunch(pending, {
      ...launchReceipt(pending),
      targetPlayerNumber: 9,
    }),
    /does not match the pending source centre pass/u,
  );

  const live = completeCssoccerKickoffLaunch(pending, launchReceipt(pending));
  assert.equal(live.phase, "normal-play");
  assert.deepEqual(live.rules, {
    deadBallCount: 0,
    gameAction: 0,
    setPiece: 0,
    matchMode: 0,
  });
  assert.deepEqual(live.clock, { clockRunning: 1, matchHalf: 0, kickoff: 0 });
  assert.deepEqual(live.ball, {
    status: "released-by-parent-launch",
    position: null,
    possession: null,
    launchProfileHash: "d".repeat(64),
  });
  assert.equal(live.pendingAction, null);
  assert.equal(live.lastLaunchReceipt.profileHash, "d".repeat(64));
  assert.deepEqual(
    projectCssoccerKickoffNativePhaseFields(live).map(({ fieldId, value }) => [fieldId, value]),
    [
      ["clock.clock_running", 1],
      ["clock.match_half", 0],
      ["lifecycle.kick_off", 1],
      ["lifecycle.kickoff", 0],
      ["lifecycle.team_a", 0],
      ["lifecycle.team_b", 1],
      ["rules.dead_ball_count", 0],
      ["rules.game_action", 0],
      ["rules.match_mode", 0],
      ["rules.set_piece", 0],
    ],
  );
});

test("post-swap kickoff keeps stable countries while native A owns the same taker slots", fixtureOptions, () => {
  const match = preparedMatch();
  const lifecycle = secondHalfLifecycle(match);
  const second = createCssoccerKickoffState({
    lifecycle,
    tacticsState: match.tactics,
    sourceProfile: testSourceProfile(),
  });

  assert.deepEqual(second.teamBySlot, { A: "argentina", B: "spain" });
  assert.deepEqual(second.owner, {
    country: "argentina",
    nativeTeamSlot: "A",
    fixtureTeamIndex: 1,
    takerId: "argentina-player-07",
    takerNativePlayerNumber: 7,
    receiverId: "argentina-player-10",
    receiverNativePlayerNumber: 10,
  });
  assert.equal(second.players.find(({ id }) => id === "argentina-player-07").nativeTeamSlot, "A");
  assert.equal(second.players.find(({ id }) => id === "spain-player-07").nativeTeamSlot, "B");
  assert.deepEqual(second.clock, { clockRunning: 0, matchHalf: 1, kickoff: 1 });
  assert.deepEqual(target(second, "argentina-player-07"), { x: f32(640), y: f32(390) });
  assert.deepEqual(target(second, "argentina-player-10"), { x: f32(645), y: f32(410) });

  const live = completeCssoccerKickoffLaunch(readyPending(second), launchReceipt(second));
  assert.deepEqual(live.clock, { clockRunning: 1, matchHalf: 1, kickoff: 0 });
  assert.deepEqual(
    Object.fromEntries(projectCssoccerKickoffNativePhaseFields(second).map(({ fieldId, value }) => [fieldId, value])),
    {
      "clock.clock_running": 0,
      "clock.match_half": 1,
      "lifecycle.kick_off": 1,
      "lifecycle.kickoff": 1,
      "lifecycle.team_a": 1,
      "lifecycle.team_b": 0,
      "rules.dead_ball_count": 40,
      "rules.game_action": 1,
      "rules.match_mode": 5,
      "rules.set_piece": 3,
    },
  );
  assert.equal(projectCssoccerKickoffNativePhaseFields(live)[0].numericBits, "01");

  const repeatedOpening = createOpening(match);
  const repeatedSecond = createCssoccerKickoffState({
    lifecycle,
    tacticsState: match.tactics,
    sourceProfile: testSourceProfile(),
  });
  assert.equal(JSON.stringify(repeatedOpening), JSON.stringify(createOpening(match)));
  assert.equal(JSON.stringify(repeatedSecond), JSON.stringify(second));
  assert.equal(
    JSON.stringify(completeCssoccerKickoffLaunch(readyPending(repeatedSecond), launchReceipt(repeatedSecond))),
    JSON.stringify(live),
  );
});

test("unbound constants, lifecycle drift, referee actions, and observations fail closed", fixtureOptions, () => {
  const match = preparedMatch();
  assert.throws(
    () => createCssoccerKickoffState({ lifecycle: match.lifecycle, tacticsState: match.tactics }),
    (error) => error instanceof CssoccerUnsupportedKickoffError
      && error.boundary === "source-profile",
  );
  const missingConstant = { ...testSourceProfile() };
  delete missingConstant.keeperOffline;
  assert.throws(
    () => createOpening(match, missingConstant),
    /must contain exactly/u,
  );
  const oneTick = stepCssoccerMatchLifecycle(match.lifecycle).state;
  assert.throws(
    () => createCssoccerKickoffState({
      lifecycle: oneTick,
      tacticsState: match.tactics,
      sourceProfile: testSourceProfile(),
    }),
    /opening or post-swap/u,
  );

  const opening = createOpening(match);
  assert.throws(
    () => stepCssoccerKickoffState(opening, {
      players: readyObservations(opening),
      refereeAction: 17,
    }),
    (error) => error instanceof CssoccerUnsupportedKickoffError
      && error.boundary === "referee-action",
  );
  const wrongSlot = readyObservations(opening);
  wrongSlot[0] = { ...wrongSlot[0], nativePlayerNumber: 2 };
  assert.throws(
    () => stepCssoccerKickoffState(opening, {
      players: wrongSlot,
      refereeAction: opening.sourceProfile.officialActionIds.ready,
    }),
    /identity\/native slot diverged/u,
  );
});

test("pinned source owns centre selection, positions, readiness, and pass handoff", sourceOptions, () => {
  for (const source of CSSOCCER_KICKOFF_SOURCE.files) {
    assert.equal(sha256(readFileSync(sourceFiles[source.file])), source.sha256);
  }
  const football = readFileSync(sourceFiles["FOOTBALL.CPP"], "latin1");
  const rules = readFileSync(sourceFiles["RULES.CPP"], "latin1");
  const intell = readFileSync(sourceFiles["INTELL.CPP"], "latin1");

  assert.match(football, /match_mode=CENTRE_A;[\s\S]*?init_match_mode\(\)/u);
  assert.match(rules, /Decision is made on the two closest tactical positions/u);
  assert.match(rules, /match_tactics1\[68\]\[pn-2\]\[0\]/u);
  assert.match(rules, /dead_ball_cnt=40;[\s\S]*?ballx=cntspot_x;[\s\S]*?bally=cntspot_y;/u);
  assert.match(rules, /ball_zone1=68;[\s\S]*?ball_zone2=69;/u);
  assert.match(rules, /case\(SETP_CENTRE\):[\s\S]*?pass_type=5;[\s\S]*?make_pass/u);
  assert.match(rules, /clock_running=TRUE;[\s\S]*?kickoff=FALSE;/u);
  assert.match(intell, /x=cntspot_x;[\s\S]*?y=cntspot_y-10;/u);
  assert.match(intell, /x=cntspot_x\+5;[\s\S]*?y=cntspot_y\+10;/u);
  assert.match(intell, /if \(a>FACING_ANGLE\)/u);
  assert.match(intell, /tm_act==STAND_ACT[\s\S]*?plr_facing[\s\S]*?BESIDE_BALL\*3/u);
  assert.equal(CSSOCCER_KICKOFF_CONSTANTS.centrePassType, 5);
});

test("retained endpoint windows qualify only this reducer's typed phase fields", retainedOptions, async () => {
  const match = preparedMatch();
  const opening = createOpening(match);
  const openingLive = completeCssoccerKickoffLaunch(readyPending(opening), launchReceipt(opening));
  const second = createCssoccerKickoffState({
    lifecycle: secondHalfLifecycle(match),
    tacticsState: match.tactics,
    sourceProfile: testSourceProfile(),
  });
  const secondLive = completeCssoccerKickoffLaunch(readyPending(second), launchReceipt(second));
  const retained = await retainedTicks(new Set([0, 172, 1524, 1780]));

  assert.equal(retained.header.bindings.contractSha256, opening.bindings.nativeFieldContractSha256);
  for (const [tick, state] of [
    [0, opening],
    [172, openingLive],
    [1524, second],
    [1780, secondLive],
  ]) {
    const expected = retained.ticks.get(tick);
    for (const field of projectCssoccerKickoffNativePhaseFields(state)) {
      assert.deepEqual(field, sampleValue(expected.get(field.fieldId)), `${field.fieldId} at tick ${tick}`);
    }
  }

  for (const [tick, state] of [[0, opening], [1524, second]]) {
    const expected = retained.ticks.get(tick);
    assert.equal(expected.get("ball.x").value, state.ball.position.x);
    assert.equal(expected.get("ball.y").value, state.ball.position.y);
    assert.equal(expected.get("ball.z").value, state.ball.position.z);
    assert.equal(expected.get("ball.possession").value, state.ball.possession);
  }
  assert.deepEqual(
    CSSOCCER_KICKOFF_NATIVE_PHASE_FIELD_CONTRACT,
    projectCssoccerKickoffNativePhaseFields(opening).map(({ fieldId, valueType }) => ({ fieldId, valueType })),
  );
});

test("runtime kickoff reducer has no filesystem, source checkout, oracle, or retained-state dependency", () => {
  const source = readFileSync(new URL("../src/cssoccer/kickoffState.mjs", import.meta.url), "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(source, /node:fs|readFile|\.local\/|state\.jsonl|oracle/u);
  assert.equal(CSSOCCER_KICKOFF_LAUNCH_RECEIPT_SCHEMA, "cssoccer-parent-launch-receipt@1");
});

function preparedMatch() {
  matchCache ??= createCssoccerMatchState({
    preparedFacts: JSON.parse(readFileSync(fixtureFiles.facts, "utf8")),
    preparedScene: JSON.parse(readFileSync(fixtureFiles.scene, "utf8")),
    selectedCountry: "argentina",
  });
  return matchCache;
}

function secondHalfLifecycle(match) {
  if (secondHalfLifecycleCache) return secondHalfLifecycleCache;
  let lifecycle = match.lifecycle;
  while (lifecycle.clock.phase !== "halftime-end-swap-second-half-kickoff") {
    lifecycle = stepCssoccerMatchLifecycle(lifecycle).state;
  }
  secondHalfLifecycleCache = lifecycle;
  return lifecycle;
}

function createOpening(match, sourceProfile = testSourceProfile()) {
  return createCssoccerKickoffState({
    lifecycle: match.lifecycle,
    tacticsState: match.tactics,
    sourceProfile,
  });
}

function testSourceProfile() {
  // Explicit synthetic adapter bindings exercise the reducer boundary. Their
  // hash does not claim these unprepared values are the native build profile.
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

function readyObservations(state) {
  return state.players.map((player) => ({
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
  }));
}

function readyPending(state) {
  return stepCssoccerKickoffState(state, {
    players: readyObservations(state),
    refereeAction: state.sourceProfile.officialActionIds.ready,
  });
}

function launchReceipt(state) {
  return {
    schema: CSSOCCER_KICKOFF_LAUNCH_RECEIPT_SCHEMA,
    type: "launch-applied",
    actionType: "pass",
    nativePlayerNumber: state.owner.takerNativePlayerNumber,
    targetPlayerNumber: state.owner.receiverNativePlayerNumber,
    profileHash: "d".repeat(64),
  };
}

function target(state, id) {
  return state.players.find((player) => player.id === id).target;
}

function point(value) {
  return { x: f32(value[0]), y: f32(value[1]) };
}

async function retainedTicks(wantedTicks) {
  const ticks = new Map([...wantedTicks].map((tick) => [tick, new Map()]));
  const wantedFields = new Set([
    ...CSSOCCER_KICKOFF_NATIVE_PHASE_FIELD_CONTRACT.map(({ fieldId }) => fieldId),
    "ball.x",
    "ball.y",
    "ball.z",
    "ball.possession",
  ]);
  let header;
  const lines = createInterface({ input: createReadStream(retainedUrl) });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.recordType === "header") {
      header = record;
    } else if (wantedTicks.has(record.tick) && wantedFields.has(record.fieldId)) {
      ticks.get(record.tick).set(record.fieldId, record);
    }
  }
  return { header, ticks };
}

function sampleValue(record) {
  assert.ok(record);
  return {
    fieldId: record.fieldId,
    valueType: record.valueType,
    value: record.value,
    numericBits: record.numericBits,
  };
}

function skipUnless(files, label) {
  const missing = files.filter((file) => !existsSync(file));
  return {
    skip: missing.length === 0
      ? false
      : `${label} unavailable: ${missing.map(({ pathname }) => pathname).join(", ")}`,
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

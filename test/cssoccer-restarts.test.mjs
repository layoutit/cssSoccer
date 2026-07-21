import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  classifyCssoccerBoundary,
} from "../src/cssoccer/boundaryState.mjs";
import {
  CSSOCCER_RESTART_CONSTANTS,
  CSSOCCER_RESTART_SOURCE,
  createCssoccerOutOfPlayDelay,
  initializeCssoccerRestart,
  selectCssoccerRestartTaker,
  stepCssoccerOutOfPlayDelay,
} from "../src/cssoccer/restartState.mjs";
import {
  advanceCssoccerSetPiece,
  createCssoccerSetPieceState,
} from "../src/cssoccer/setPieceState.mjs";
import {
  createCssoccerTacticsState,
} from "../src/cssoccer/tacticsState.mjs";

const SOURCE_ROOT = new URL("../.local/actua-soccer/source/", import.meta.url);
const RETAINED_STREAM = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const RETAINED_REPORT = new URL(
  "../.local/cssoccer/oracle/native/current.json",
  import.meta.url,
);

const CORRECTED_CAPTURE = Object.freeze({
  buildSha256: "5db9d52f4dec6e71d2a1df1009c803967455a3683b1c87e271669165ef43a3e3",
  scenarioSha256: "5fc29151faf3ff344c37562b42148322ae0b976385cd8615fcccfcf8b529eb81",
  rawSha256: "1b46cb63a708d6af237d3af91d6c5846bc456e93ef6b5d731a1d36cbcaffabdb",
  stateSha256: "eb858bed9ad9d36670e97a98ea49235d8009246ded16e00dcb54c5dc1aef2fdd",
  ticks: 2725,
});

const RETAINED_FIELD_TYPES = Object.freeze({
  "ball.in_goal": "u8",
  "ball.last_touch": "i32",
  "ball.out_of_play": "i32",
  "ball.x": "f32",
  "ball.y": "f32",
  "ball.z": "f32",
  "clock.match_half": "u8",
  "rules.dead_ball_count": "i32",
  "rules.game_action": "i16",
  "rules.match_mode": "u8",
  "rules.set_piece": "u8",
  "score.just_scored": "i32",
  "score.team_a": "i32",
  "score.team_b": "i32",
});

const PLAYERS = Object.freeze(Array.from({ length: 22 }, (_, index) => Object.freeze({
  nativePlayerNumber: index + 1,
  active: 1,
})));

const TACTICS = createCssoccerTacticsState({
  A: tacticSlot("a"),
  B: tacticSlot("b"),
});

const RESTART_CASES = Object.freeze([
  { mode: "CORNER_TL", at: [-1, 100, 1], kind: "corner", team: "B", x: Math.fround((1280 / 120) - 1), y: Math.fround((1280 / 120) - 1), zones: { A: 64, B: 67 }, setPiece: 1, dead: 20, taker: 13 },
  { mode: "CORNER_BL", at: [-1, 700, 1], kind: "corner", team: "B", x: Math.fround(800 - Math.fround(1280 / 120) + 1), y: Math.fround(800 - Math.fround(1280 / 120) + 1), zones: { A: 66, B: 65 }, setPiece: 1, dead: 20, taker: 13, xOverride: Math.fround(Math.fround(1280 / 120) - 1) },
  { mode: "CORNER_TR", at: [1280, 100, 12], kind: "corner", team: "A", x: Math.fround(1280 - Math.fround(1280 / 120) + 1), y: Math.fround(Math.fround(1280 / 120) - 1), zones: { A: 65, B: 66 }, setPiece: 1, dead: 20, taker: 2 },
  { mode: "CORNER_BR", at: [1280, 700, 12], kind: "corner", team: "A", x: Math.fround(1280 - Math.fround(1280 / 120) + 1), y: Math.fround(800 - Math.fround(1280 / 120) + 1), zones: { A: 67, B: 64 }, setPiece: 1, dead: 20, taker: 2 },
  { mode: "GOAL_KICK_TL", at: [-1, 100, 12], kind: "goal-kick", team: "A", x: 61.866668701171875, y: 346.6666564941406, zones: { A: 11, B: 20 }, setPiece: 7, dead: 100, taker: 1 },
  { mode: "GOAL_KICK_BL", at: [-1, 700, 12], kind: "goal-kick", team: "A", x: 61.866668701171875, y: 453.3333435058594, zones: { A: 19, B: 12 }, setPiece: 7, dead: 100, taker: 1 },
  { mode: "GOAL_KICK_TR", at: [1280, 100, 1], kind: "goal-kick", team: "B", x: 1218.13330078125, y: 346.6666564941406, zones: { A: 12, B: 19 }, setPiece: 7, dead: 100, taker: 12 },
  { mode: "GOAL_KICK_BR", at: [1280, 700, 1], kind: "goal-kick", team: "B", x: 1218.13330078125, y: 453.3333435058594, zones: { A: 20, B: 11 }, setPiece: 7, dead: 100, taker: 12 },
]);

test("out-of-play delay requests the respot only on native tick 25", () => {
  const boundary = classify(-1, 100, 12);
  let delay = createCssoccerOutOfPlayDelay(boundary);
  assert.equal(delay.remainingTicks, 25);
  for (let index = 0; index < 24; index += 1) delay = stepCssoccerOutOfPlayDelay(delay);
  assert.deepEqual(
    { remainingTicks: delay.remainingTicks, status: delay.status, restartRequired: delay.restartRequired },
    { remainingTicks: 1, status: "countdown", restartRequired: false },
  );
  delay = stepCssoccerOutOfPlayDelay(delay);
  assert.deepEqual(
    { remainingTicks: delay.remainingTicks, status: delay.status, restartRequired: delay.restartRequired },
    { remainingTicks: 0, status: "restart-required", restartRequired: true },
  );
  assert.throws(() => stepCssoccerOutOfPlayDelay(delay), /already reached/);
});

test("all four corners and four goal kicks bind native placement, zones, flags, and taker targets", () => {
  for (const fixture of RESTART_CASES) {
    const restart = makeRestart(classify(...fixture.at), { seed: 64 });
    assert.equal(restart.mode, fixture.mode);
    assert.equal(restart.kind, fixture.kind);
    assert.equal(restart.awardedNativeTeam, fixture.team);
    assert.equal(restart.ball.position.x, fixture.xOverride ?? fixture.x);
    assert.equal(restart.ball.position.y, fixture.y);
    assert.equal(restart.ball.position.z, 2);
    assert.deepEqual(restart.ballZones, fixture.zones);
    assert.equal(restart.taker.nativePlayerNumber, fixture.taker);
    assert.equal(restart.rules.setPiece, fixture.setPiece);
    assert.equal(restart.rules.deadBallCount, fixture.dead);
    assert.equal(restart.rules.gameAction, 1);
    assert.equal(restart.rules.canBeOffside, 0);
    assert.equal(restart.rules.setPieceTaker, fixture.taker);
    assert.equal(restart.clock.stopClock, 0);
    assert.deepEqual(restart.preKeeperTouchPatch, { operation: "set", value: fixture.taker });
    if (fixture.kind === "corner") {
      assert.deepEqual(restart.taker.target.world, restart.incidentPosition);
    } else {
      assert.equal(Math.abs(restart.taker.target.world.x - restart.ball.position.x), 4);
      assert.equal(restart.taker.target.world.y, restart.ball.position.y);
    }
    if (fixture.team === "B") {
      assert.equal(
        restart.taker.target.sourceFrame.x,
        Math.fround(1280 - restart.taker.target.world.x),
      );
      assert.equal(
        restart.taker.target.sourceFrame.y,
        Math.fround(800 - restart.taker.target.world.y),
      );
    } else {
      assert.deepEqual(restart.taker.target.sourceFrame, restart.taker.target.world);
    }
  }
});

test("both throw teams preserve current zones, place the ball at the incident, and require pickup", () => {
  const fixtures = [
    { boundary: classify(456.5, 800, 12), team: "A", taker: 2, lastTouch: 1, targetY: 807 },
    { boundary: classify(123.25, -1, 1), team: "B", taker: 13, lastTouch: 12, targetY: -8 },
  ];
  for (const fixture of fixtures) {
    const restart = makeRestart(fixture.boundary, { seed: 32, ballZones: { A: 7, B: 24 } });
    assert.equal(restart.awardedNativeTeam, fixture.team);
    assert.deepEqual(restart.ballZones, { A: 7, B: 24 });
    assert.deepEqual(
      { x: restart.ball.position.x, y: restart.ball.position.y },
      fixture.boundary.incidentPosition,
    );
    assert.equal(restart.ball.lastTouch, fixture.lastTouch);
    assert.equal(restart.taker.nativePlayerNumber, fixture.taker);
    assert.equal(restart.taker.intention, CSSOCCER_RESTART_CONSTANTS.throwIntention);
    assert.equal(restart.taker.target.world.y, fixture.targetY);
    assert.equal(restart.rules.setPiece, 2);
    assert.equal(restart.rules.deadBallCount, 100);
    assert.equal(restart.clock.stopClock, 1);
    assert.deepEqual(restart.preKeeperTouchPatch, { operation: "preserve" });
  }
});

test("taker selection honors active preferred players, keeper inclusion, and first native ties", () => {
  const goal = makeRestart(classify(-1, 100, 12), { seed: 0 });
  assert.equal(goal.taker.nativePlayerNumber, 1, "active preferred keeper wins");

  const noKeeper = withActive(PLAYERS, new Map([[1, 0]]));
  const fallbackGoal = makeRestart(classify(-1, 100, 12), { seed: 0, players: noKeeper });
  assert.equal(fallbackGoal.taker.nativePlayerNumber, 2, "goal-kick fallback includes native ordered roster");

  const corner = makeRestart(classify(1280, 100, 12), { seed: 0 });
  assert.equal(corner.taker.nativePlayerNumber, 2, "strict equal tactical distances keep the first player");

  const customPreferred = {
    corner: { A: 7, B: 19 },
    goalKick: { A: 4, B: 17 },
  };
  assert.equal(
    makeRestart(classify(1280, 100, 12), { seed: 0, preferredKickers: customPreferred }).taker.nativePlayerNumber,
    7,
  );
  assert.equal(
    makeRestart(classify(-1, 100, 1), { seed: 0, preferredKickers: customPreferred }).taker.nativePlayerNumber,
    19,
  );
});

test("taker selection filters inactive players and rejects the source's undefined no-candidate case", () => {
  const players = withActive(PLAYERS, new Map([[2, 0], [13, 0]]));
  assert.equal(selectCssoccerRestartTaker({
    kind: "corner",
    nativeTeamSlot: "A",
    ballPosition: { x: 500, y: 400 },
    ballZones: { A: 1, B: 1 },
    players,
    tacticsState: TACTICS,
  }), 3);

  const inactive = withActive(PLAYERS, new Map(PLAYERS.map(({ nativePlayerNumber }) => [nativePlayerNumber, 0])));
  assert.throws(() => selectCssoccerRestartTaker({
    kind: "throw-in",
    nativeTeamSlot: "B",
    ballPosition: { x: 500, y: 0 },
    ballZones: { A: 1, B: 1 },
    players: inactive,
    tacticsState: TACTICS,
  }), /No active restart taker/);
});

test("corner and goal-kick phases expose parent decisions and release to normal play", () => {
  const cornerRestart = makeRestart(classify(1280, 100, 12), { seed: 64 });
  let corner = createCssoccerSetPieceState(cornerRestart);
  corner = advanceCssoccerSetPiece(corner, readiness({ alreadyThere: 0 }));
  assert.equal(corner.phase, "awaiting-position");
  corner = advanceCssoccerSetPiece(corner, readiness({ alreadyThere: 1 }));
  assert.equal(corner.phase, "awaiting-decision");
  assert.deepEqual(corner.actionRequest.allowedActions, ["pass", "shot"]);
  assert.throws(
    () => advanceCssoccerSetPiece(corner, { type: "decision", action: "punt" }),
    /corner decision/,
  );
  corner = advanceCssoccerSetPiece(corner, { type: "decision", action: "shot" });
  assert.equal(corner.phase, "released-to-action");
  assert.equal(corner.status, "normal-play-action-pending");
  assert.deepEqual(
    { mode: corner.rules.matchMode, dead: corner.rules.deadBallCount, action: corner.rules.gameAction, setPiece: corner.rules.setPiece },
    { mode: 0, dead: 0, action: 0, setPiece: 0 },
  );
  assert.deepEqual(corner.actionRequest, { type: "shot", nativePlayerNumber: 2, launch: "parent-owned" });
  assert.throws(() => advanceCssoccerSetPiece(corner, readiness()), /terminal/);

  const goalRestart = makeRestart(classify(1280, 700, 1), { seed: 64 });
  let goal = createCssoccerSetPieceState(goalRestart);
  goal = advanceCssoccerSetPiece(goal, readiness());
  assert.throws(
    () => advanceCssoccerSetPiece(goal, { type: "decision", action: "pass", targetPlayerNumber: 12 }),
    /another player|keeper/,
  );
  goal = advanceCssoccerSetPiece(goal, { type: "decision", action: "punt" });
  assert.equal(goal.actionRequest.type, "punt");
  assert.equal(goal.rules.matchMode, 0);
});

test("throw phase reaches pickup, throw action, and normal play without an internal decision", () => {
  const restart = makeRestart(classify(500, -1, 1), { seed: 64, ballZones: { A: 7, B: 24 } });
  let state = createCssoccerSetPieceState(restart);
  state = advanceCssoccerSetPiece(state, {
    type: "readiness",
    alreadyThere: 1,
    playerOnOff: 0,
    takerDistanceToIncident: CSSOCCER_RESTART_CONSTANTS.pitchRatio * 3,
    ballInHands: 0,
  });
  assert.equal(state.phase, "awaiting-position", "native comparison is strict less-than");
  state = advanceCssoccerSetPiece(state, {
    type: "readiness",
    alreadyThere: 1,
    playerOnOff: 0,
    takerDistanceToIncident: 0,
    ballInHands: 0,
  });
  assert.equal(state.phase, "awaiting-pickup");
  assert.equal(state.actionRequest.type, "start-pickup");
  state = advanceCssoccerSetPiece(state, { type: "pickup-complete" });
  assert.equal(state.phase, "awaiting-decision");
  assert.equal(state.rules.matchMode, 0);
  assert.equal(state.ball.inHands, 1);
  assert.equal(state.ball.possession, restart.taker.nativePlayerNumber);
  assert.equal(state.actionRequest.type, "start-throw-action");
  assert.deepEqual(state.actionRequest.next.allowedActions, ["pass", "throw"]);
  assert.throws(
    () => advanceCssoccerSetPiece(state, { type: "decision", action: "shot" }),
    /throw-in decision/,
  );
  state = advanceCssoccerSetPiece(state, { type: "decision", action: "throw" });
  assert.equal(state.phase, "released-to-action");
  assert.equal(state.clock.stopClock, 0);
  assert.equal(state.rules.setPiece, 0);
  assert.deepEqual(state.actionRequest, {
    type: "throw",
    nativePlayerNumber: restart.taker.nativePlayerNumber,
    launch: "parent-owned",
  });
});

test("source standing timeout forces a non-throw restart decision after exactly 5000 eligible ticks", () => {
  const restart = makeRestart(classify(1280, 100, 12), { seed: 64 });
  let state = createCssoccerSetPieceState(restart);
  const blocked = readiness({ allStanding: 0 });

  for (let tick = 0; tick < CSSOCCER_RESTART_CONSTANTS.setPieceWaitTicks - 1; tick += 1) {
    state = advanceCssoccerSetPiece(state, blocked);
  }
  assert.equal(state.phase, "awaiting-position");
  assert.deepEqual(state.positionWait, { remainingTicks: 1, forcedStanding: 0 });

  state = advanceCssoccerSetPiece(state, blocked);
  assert.equal(state.phase, "awaiting-decision");
  assert.deepEqual(state.positionWait, { remainingTicks: 0, forcedStanding: 1 });
  assert.deepEqual(state.actionRequest.allowedActions, ["pass", "shot"]);
});

test("every supported boundary restart reaches an explicit parent launch handoff", () => {
  for (const fixture of RESTART_CASES) {
    let state = createCssoccerSetPieceState(makeRestart(classify(...fixture.at), { seed: 64 }));
    state = advanceCssoccerSetPiece(state, readiness());
    state = advanceCssoccerSetPiece(state, {
      type: "decision",
      action: fixture.kind === "corner" ? "shot" : "punt",
    });
    assert.equal(state.phase, "released-to-action", fixture.mode);
    assert.equal(state.status, "normal-play-action-pending", fixture.mode);
    assert.equal(state.rules.matchMode, 0, fixture.mode);
    assert.equal(state.rules.setPiece, 0, fixture.mode);
    assert.equal(state.actionRequest.launch, "parent-owned", fixture.mode);
  }

  for (const fixture of [
    { boundary: classify(500, -1, 1), mode: "THROW_IN_B" },
    { boundary: classify(500, 800, 12), mode: "THROW_IN_A" },
  ]) {
    let state = createCssoccerSetPieceState(makeRestart(fixture.boundary, {
      seed: 64,
      ballZones: { A: 7, B: 24 },
    }));
    state = advanceCssoccerSetPiece(state, {
      type: "readiness",
      alreadyThere: 1,
      playerOnOff: 0,
      takerDistanceToIncident: 0,
      ballInHands: 0,
    });
    state = advanceCssoccerSetPiece(state, { type: "pickup-complete" });
    state = advanceCssoccerSetPiece(state, { type: "decision", action: "throw" });
    assert.equal(state.phase, "released-to-action", fixture.mode);
    assert.equal(state.status, "normal-play-action-pending", fixture.mode);
    assert.equal(state.clock.stopClock, 0, fixture.mode);
    assert.equal(state.actionRequest.launch, "parent-owned", fixture.mode);
  }
});

test("runtime modules reject malformed decisions and contain no evidence imports", () => {
  assert.throws(() => initializeCssoccerRestart({}), /boundary result/);
  assert.throws(
    () => makeRestart(classify(500, -1, 1), { seed: 64 }),
    /ballZones must be a plain object/,
  );
  for (const relative of ["../src/cssoccer/restartState.mjs", "../src/cssoccer/setPieceState.mjs"]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /(?:\.local|node:fs|native\.raw|state\.jsonl|readFileSync)/u);
  }
});

test("restart source bindings match the pinned unpublished source", {
  skip: !existsSync(new URL("RULES.CPP", SOURCE_ROOT)),
}, () => {
  for (const source of CSSOCCER_RESTART_SOURCE.files) {
    const bytes = readFileSync(new URL(source.file, SOURCE_ROOT));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256, source.file);
  }
});

test("corrected retained capture proves goal-owned crossings and bounded centre resumptions", {
  skip: !existsSync(RETAINED_STREAM)
    || !existsSync(RETAINED_REPORT)
    || spawnSync("rg", ["--version"]).status !== 0,
}, () => {
  const report = JSON.parse(readFileSync(RETAINED_REPORT, "utf8"));
  const canonical = report.canonical.runs["canonical-a"];
  assert.deepEqual({
    status: report.status,
    buildSha256: report.bindings.buildSha256,
    scenarioSha256: report.bindings.scenarioSha256,
    rawSha256: canonical.artifacts.raw.sha256,
    stateSha256: canonical.artifacts.state.sha256,
    ticks: canonical.ticks,
  }, {
    status: "pass",
    ...CORRECTED_CAPTURE,
  });

  const supportedBoundaryModes = new Set([1, 2, 3, 4, 7, 8, 9, 10, 11, 12]);
  const retainedModes = readRetainedField("rules.match_mode");
  const retainedSetPieces = readRetainedField("rules.set_piece");
  assert.deepEqual([...new Set(retainedModes)].sort((a, b) => a - b), [0, 5, 6, 19]);
  assert.deepEqual([...new Set(retainedSetPieces)].sort((a, b) => a - b), [0, 3]);
  assert.equal(retainedModes.some((mode) => supportedBoundaryModes.has(mode)), false);

  const ticks = [
    388, 608, 609, 632, 633, 847,
    1003, 1222, 1223, 1524,
    2173, 2393, 2394, 2417, 2418, 2609,
  ];
  const retained = readRetainedSamples(ticks, Object.keys(RETAINED_FIELD_TYPES));

  assertRetainedTick(retained, 388, {
    "ball.in_goal": 1, "ball.last_touch": 9, "ball.out_of_play": 25,
    "ball.x": 1288.0247802734375, "ball.y": 363.9252014160156,
    "rules.match_mode": 0, "rules.set_piece": 0,
    "score.just_scored": 220, "score.team_a": 1, "score.team_b": 0,
  });
  assertRetainedTick(retained, 608, { "ball.out_of_play": 25, "score.just_scored": 0 });
  assertRetainedTick(retained, 609, { "ball.out_of_play": 24, "score.just_scored": 0 });
  assertRetainedTick(retained, 632, { "ball.out_of_play": 1 });
  assertRetainedTick(retained, 633, {
    "ball.in_goal": 0, "ball.last_touch": 0, "ball.out_of_play": 0,
    "ball.x": 640, "ball.y": 400, "ball.z": 2,
    "rules.dead_ball_count": 40, "rules.game_action": 1,
    "rules.match_mode": 6, "rules.set_piece": 3,
  });
  assertRetainedTick(retained, 847, {
    "rules.dead_ball_count": 0, "rules.game_action": 0,
    "rules.match_mode": 0, "rules.set_piece": 0,
  });

  assertRetainedTick(retained, 1003, {
    "ball.in_goal": 1, "ball.last_touch": 7, "ball.out_of_play": 25,
    "ball.x": 1284.207763671875, "ball.y": 377.668212890625,
    "rules.match_mode": 0, "rules.set_piece": 0,
    "score.just_scored": 220, "score.team_a": 2, "score.team_b": 0,
  });
  assertRetainedTick(retained, 1222, { "ball.out_of_play": 25, "score.just_scored": 1 });
  assertRetainedTick(retained, 1223, {
    "ball.in_goal": 0, "ball.out_of_play": 25,
    "clock.match_half": 0, "rules.dead_ball_count": 40,
    "rules.match_mode": 19, "rules.set_piece": 0,
    "score.just_scored": 0,
  });
  assertRetainedTick(retained, 1524, {
    "clock.match_half": 1, "ball.x": 640, "ball.y": 400,
    "rules.dead_ball_count": 40, "rules.game_action": 1,
    "rules.match_mode": 5, "rules.set_piece": 3,
  });

  assertRetainedTick(retained, 2173, {
    "ball.in_goal": 1, "ball.last_touch": 19, "ball.out_of_play": 25,
    "ball.x": -7.042346000671387, "ball.y": 409.08990478515625,
    "rules.match_mode": 0, "rules.set_piece": 0,
    "score.just_scored": 220, "score.team_a": 3, "score.team_b": 0,
  });
  assertRetainedTick(retained, 2393, { "ball.out_of_play": 25, "score.just_scored": 0 });
  assertRetainedTick(retained, 2394, { "ball.out_of_play": 24, "score.just_scored": 0 });
  assertRetainedTick(retained, 2417, { "ball.out_of_play": 1 });
  assertRetainedTick(retained, 2418, {
    "ball.in_goal": 0, "ball.last_touch": 0, "ball.out_of_play": 0,
    "ball.x": 640, "ball.y": 400, "ball.z": 2,
    "rules.dead_ball_count": 40, "rules.game_action": 1,
    "rules.match_mode": 5, "rules.set_piece": 3,
  });
  assertRetainedTick(retained, 2609, {
    "rules.dead_ball_count": 0, "rules.game_action": 0,
    "rules.match_mode": 0, "rules.set_piece": 0,
  });

  for (const tick of [388, 1003, 2173]) {
    const position = {
      x: retained.get(`${tick}:ball.x`).value,
      y: retained.get(`${tick}:ball.y`).value,
    };
    assert.equal(classifyCssoccerBoundary({
      position,
      lastTouch: retained.get(`${tick}:ball.last_touch`).value,
      inGoal: retained.get(`${tick}:ball.in_goal`).value,
    }), null, `tick ${tick} is goal-owned before bounds_rules`);
  }

  assert.match(CSSOCCER_RESTART_SOURCE.integrationBoundary.postGoalCentre, /B17/u);
});

function classify(x, y, lastTouch) {
  return classifyCssoccerBoundary({ position: { x, y }, lastTouch });
}

function makeRestart(boundary, options = {}) {
  return initializeCssoccerRestart({
    boundary,
    players: options.players ?? PLAYERS,
    tacticsState: TACTICS,
    seed: options.seed ?? 0,
    ...(options.ballZones ? { ballZones: options.ballZones } : {}),
    ...(options.preferredKickers ? { preferredKickers: options.preferredKickers } : {}),
  });
}

function tacticSlot(suffix) {
  return {
    formationId: 0,
    tableSha256: suffix.repeat(64),
    values: Array.from({ length: 70 }, () => Array.from({ length: 10 }, () => [500, 400])),
  };
}

function withActive(players, overrides) {
  return players.map((player) => ({
    ...player,
    active: overrides.get(player.nativePlayerNumber) ?? player.active,
  }));
}

function readiness(overrides = {}) {
  return {
    type: "readiness",
    alreadyThere: 1,
    playerOnOff: 0,
    allStanding: 1,
    support: 0,
    holdUpPlay: 0,
    ...overrides,
  };
}

function readRetainedField(fieldId) {
  const result = spawnSync("rg", [
    "-N",
    `"fieldId":"${escapeRegex(fieldId)}"`,
    RETAINED_STREAM.pathname,
  ], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split("\n").map((line) => JSON.parse(line).value);
}

function readRetainedSamples(ticks, fieldIds) {
  const fieldPattern = fieldIds.map(escapeRegex).join("|");
  const result = spawnSync("rg", [
    "-N",
    `"tick":(${ticks.join("|")}),.*"fieldId":"(${fieldPattern})"`,
    RETAINED_STREAM.pathname,
  ], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return new Map(result.stdout.trim().split("\n").map((line) => {
    const sample = JSON.parse(line);
    return [`${sample.tick}:${sample.fieldId}`, sample];
  }));
}

function assertRetainedTick(retained, tick, expected) {
  for (const [fieldId, value] of Object.entries(expected)) {
    const actual = retained.get(`${tick}:${fieldId}`);
    const valueType = RETAINED_FIELD_TYPES[fieldId];
    assert.ok(actual, `missing retained ${tick}:${fieldId}`);
    assert.deepEqual({
      valueType: actual.valueType,
      value: actual.value,
      numericBits: actual.numericBits,
    }, {
      valueType,
      value,
      numericBits: typedNumericBits(valueType, value),
    }, `${tick}:${fieldId}`);
  }
}

function typedNumericBits(valueType, value) {
  const bytes = valueType === "u8" ? 1 : valueType === "i16" ? 2 : 4;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "f32") view.setFloat32(0, Math.fround(value), false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "u8") view.setUint8(0, value);
  else throw new Error(`Unsupported retained test type ${valueType}.`);
  return [...new Uint8Array(buffer)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

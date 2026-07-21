import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_DIRECT_WALL_MEMBERSHIP_SCHEMA,
  CSSOCCER_PARENT_LAUNCH_RECEIPT_SCHEMA,
  CssoccerUnsupportedMatchRulesError,
  advanceCssoccerMatchRulesSetPiece,
  completeCssoccerMatchRulesDismissal,
  completeCssoccerMatchRulesLaunch,
  createCssoccerMatchRulesState,
  initializeCssoccerMatchRulesBoundaryRestart,
  resolveCssoccerMatchRulesAdvantage,
  routeCssoccerMatchRulesBoundary,
  routeCssoccerMatchRulesFoul,
  routeCssoccerMatchRulesIncident,
  stepCssoccerMatchRulesBoundaryDelay,
  stepCssoccerMatchRulesOffside,
  swapCssoccerMatchRulesHalftime,
} from "../src/cssoccer/matchRulesState.mjs";
import {
  createCssoccerNativeRngState,
  advanceCssoccerNativeRng,
} from "../src/cssoccer/randomState.mjs";
import {
  createCssoccerTacticsState,
} from "../src/cssoccer/tacticsState.mjs";

const PLAYERS = Object.freeze(fixturePlayers());
const TACTICS = createCssoccerTacticsState({
  A: tacticSlot("a"),
  B: tacticSlot("b"),
});

test("coordinator starts in deterministic normal play with stable rule identities", () => {
  const first = createMatchRules();
  const repeat = createMatchRules();
  assert.deepEqual(first, repeat);
  assert.equal(first.playState, "normal");
  assert.equal(first.phase, "normal-play");
  assert.equal(first.matchMode, 0);
  assert.deepEqual(
    first.rules.discipline.players.map(({ id, nativePlayerNumber }) => [id, nativePlayerNumber]),
    PLAYERS.map(({ id, nativePlayerNumber }) => [id, nativePlayerNumber]),
  );
  assert.equal(Object.isFrozen(first), true);
});

test("boundary countdown initializes the accepted restart and resumes only after a parent launch receipt", () => {
  let state = createMatchRules();
  const routed = routeCssoccerMatchRulesIncident(state, {
    type: "boundary",
    context: { position: { x: 1280, y: 700 }, lastTouch: 1 },
  });
  state = routed.state;
  assert.equal(routed.decision.mode, "GOAL_KICK_BR");
  assert.equal(state.phase, "boundary-delay");
  assert.equal(state.matchMode, 10);
  state = completeBoundaryDelay(state);
  assert.equal(state.phase, "boundary-restart-required");
  state = initializeCssoccerMatchRulesBoundaryRestart(state, {
    tacticsState: TACTICS,
    seed: 64,
  });
  assert.equal(state.phase, "set-piece");
  assert.equal(state.restart.family, "boundary");
  assert.equal(state.restart.descriptor.taker.nativePlayerNumber, 12);
  state = advanceCssoccerMatchRulesSetPiece(state, readiness());
  assert.equal(state.setPiece.phase, "awaiting-decision");
  state = advanceCssoccerMatchRulesSetPiece(state, { type: "decision", action: "punt" });
  assert.equal(state.phase, "action-pending");
  assert.equal(state.matchMode, 0);
  assert.equal(state.pendingAction.launch, "parent-owned");
  assert.throws(
    () => routeCssoccerMatchRulesBoundary(state, { position: { x: -1, y: 100 }, lastTouch: 12 }),
    (error) => error instanceof CssoccerUnsupportedMatchRulesError
      && error.code === "overlapping-rule-incident",
  );
  assert.throws(() => completeCssoccerMatchRulesLaunch(state, {
    ...launchReceipt(state.pendingAction),
    profileHash: "short",
  }), /does not match/);
  state = completeCssoccerMatchRulesLaunch(state, launchReceipt(state.pendingAction));
  assert.equal(state.phase, "normal-play");
  assert.equal(state.playState, "normal");
  assert.equal(state.restart, null);
  assert.equal(state.lastLaunchReceipt.actionType, "punt");
});

test("red-card foul blocks restart progress, then dismissal stays excluded from later boundary selection", () => {
  let state = createMatchRules();
  const foul = routeCssoccerMatchRulesFoul(state, directFoulContext({
    offenderPosition: { x: 100, y: 400 },
    refereePosition: { x: 100, y: 400 },
    offenderDistanceToBall: 10,
  }));
  state = foul.state;
  assert.equal(state.restart.descriptor.kind, "penalty");
  assert.equal(state.rules.discipline.playerOnOff, 5);
  assert.equal(foul.disciplineEvent.card, "red");
  assert.throws(() => advanceCssoccerMatchRulesSetPiece(state, {
    type: "bind-source-profile",
    sourceConstant: 12,
    directWallMembership: null,
  }), (error) => error instanceof CssoccerUnsupportedMatchRulesError
    && error.code === "dismissal-transition-active");
  state = completeCssoccerMatchRulesDismissal(state, { playerId: "spain-player-05" });
  const dismissed = state.rules.discipline.players.find(({ id }) => id === "spain-player-05");
  assert.deepEqual(
    { nativePlayerNumber: dismissed.nativePlayerNumber, guyOn: dismissed.guyOn, ruleEligible: dismissed.ruleEligible, status: dismissed.status },
    { nativePlayerNumber: 5, guyOn: 0, ruleEligible: false, status: "dismissed" },
  );
  state = advanceCssoccerMatchRulesSetPiece(state, {
    type: "bind-source-profile",
    sourceConstant: 12,
    directWallMembership: null,
  });
  assert.deepEqual(state.setPiece.takerPlacement, { x: 140, y: 400 });
  state = advanceCssoccerMatchRulesSetPiece(state, readiness());
  state = advanceCssoccerMatchRulesSetPiece(state, { type: "decision", action: "shot" });
  state = completeCssoccerMatchRulesLaunch(state, launchReceipt(state.pendingAction, "b"));
  assert.equal(state.rules.lastRestart, null);
  assert.equal(
    state.rules.discipline.players.find(({ id }) => id === "spain-player-05").status,
    "dismissed",
  );

  state = routeCssoccerMatchRulesBoundary(state, {
    position: { x: 1280, y: 100 },
    lastTouch: 12,
  }).state;
  state = completeBoundaryDelay(state);
  state = initializeCssoccerMatchRulesBoundaryRestart(state, {
    tacticsState: TACTICS,
    seed: 64,
    preferredKickers: {
      corner: { A: 5, B: 0 },
      goalKick: { A: 1, B: 12 },
    },
  });
  assert.equal(state.restart.descriptor.mode, "CORNER_TR");
  assert.equal(state.restart.descriptor.taker.nativePlayerNumber, 2);
});

test("offside routes through an indirect set piece with an explicit placement constant", () => {
  let state = createMatchRules();
  const base = offsideContext({ ballReleased: 0 });
  let routed = stepCssoccerMatchRulesOffside(state, base);
  state = routed.state;
  assert.equal(state.phase, "normal-play");
  assert.equal(
    state.rules.offside.players.find(({ id }) => id === "spain-player-05").tmOff,
    -1,
  );
  routed = stepCssoccerMatchRulesOffside(state, offsideContext({
    ballPossession: 0,
    ballReleased: 10,
  }));
  state = routed.state;
  assert.equal(routed.event.source, "offside_rule");
  assert.equal(state.restart.descriptor.kind, "indirect");
  assert.equal(state.restart.descriptor.mode, "IF_KICK_B");
  assert.equal(state.setPiece.sourceConstantBinding.symbol, "BESIDE_BALL");
  assert.throws(() => advanceCssoccerMatchRulesSetPiece(state, readiness()), /bound source placement profile/);
  state = advanceCssoccerMatchRulesSetPiece(state, {
    type: "bind-source-profile",
    sourceConstant: 10,
    directWallMembership: null,
  });
  assert.equal(state.setPiece.sourceConstantBinding.status, "bound-parent-input");
  state = advanceCssoccerMatchRulesSetPiece(state, readiness());
  assert.deepEqual(state.setPiece.allowedActions, ["pass", "punt"]);
  assert.throws(
    () => advanceCssoccerMatchRulesSetPiece(state, { type: "decision", action: "shot" }),
    (error) => error instanceof CssoccerUnsupportedMatchRulesError
      && error.code === "unsupported-rule-launch",
  );
  state = advanceCssoccerMatchRulesSetPiece(state, { type: "decision", action: "punt" });
  state = completeCssoccerMatchRulesLaunch(state, launchReceipt(state.pendingAction, "c"));
  assert.equal(state.phase, "normal-play");
  assert.equal(state.rules.offside.offsideNow, 0);
});

test("direct free kicks reject missing wall membership and accept only stable active defenders", () => {
  let state = routeCssoccerMatchRulesFoul(
    createMatchRules(),
    directFoulContext({ offenderPosition: { x: 500, y: 400 }, offenderDistanceToBall: 0 }),
  ).state;
  assert.equal(state.restart.descriptor.kind, "direct");
  assert.throws(() => advanceCssoccerMatchRulesSetPiece(state, {
    type: "bind-source-profile",
    sourceConstant: 10,
    directWallMembership: null,
  }), (error) => error instanceof CssoccerUnsupportedMatchRulesError
    && error.code === "direct-wall-membership-required");
  assert.throws(() => advanceCssoccerMatchRulesSetPiece(state, {
    type: "bind-source-profile",
    sourceConstant: 10,
    directWallMembership: wallMembership([
      { playerId: "argentina-player-02", nativePlayerNumber: 13 },
    ]),
  }), /active defenders/);
  state = advanceCssoccerMatchRulesSetPiece(state, {
    type: "bind-source-profile",
    sourceConstant: 10,
    directWallMembership: wallMembership([
      { playerId: "spain-player-02", nativePlayerNumber: 2 },
      { playerId: "spain-player-03", nativePlayerNumber: 3 },
    ]),
  });
  assert.deepEqual(
    state.setPiece.directWallMembership.members.map(({ nativePlayerNumber }) => nativePlayerNumber),
    [2, 3],
  );
  state = advanceCssoccerMatchRulesSetPiece(state, readiness());
  assert.deepEqual(state.setPiece.allowedActions, ["pass", "punt", "shot"]);
});

test("advantage owns the incident seam until source possession resolves it", () => {
  const seeded = advanceCssoccerNativeRng(createCssoccerNativeRngState());
  let state = routeCssoccerMatchRulesFoul(createMatchRules(), directFoulContext({
    ballPossession: 0,
    rng: seeded,
    offenderDistanceToBall: 0,
  })).state;
  assert.equal(state.phase, "advantage-pending");
  assert.equal(state.playState, "normal");
  assert.throws(() => routeCssoccerMatchRulesBoundary(state, {
    position: { x: -1, y: 100 },
    lastTouch: 12,
  }), (error) => error instanceof CssoccerUnsupportedMatchRulesError
    && error.code === "overlapping-rule-incident");
  state = resolveCssoccerMatchRulesAdvantage(state, { ballPossession: 12 }).state;
  assert.equal(state.phase, "normal-play");
  assert.equal(state.activeIncident, null);
});

test("all new incidents reject while a boundary or rule restart owns dead ball", () => {
  const boundaryState = routeCssoccerMatchRulesBoundary(createMatchRules(), {
    position: { x: -1, y: 100 },
    lastTouch: 12,
  }).state;
  for (const operation of [
    () => routeCssoccerMatchRulesBoundary(boundaryState, { position: { x: 1280, y: 100 }, lastTouch: 1 }),
    () => routeCssoccerMatchRulesFoul(boundaryState, directFoulContext()),
    () => stepCssoccerMatchRulesOffside(boundaryState, offsideContext()),
  ]) {
    assert.throws(operation, (error) => error instanceof CssoccerUnsupportedMatchRulesError
      && error.code === "overlapping-rule-incident");
  }
});

test("halftime swaps native slots once while stable ids and discipline state remain fixed", () => {
  let state = swapCssoccerMatchRulesHalftime(createMatchRules(), swappedPlayers());
  assert.equal(state.matchHalf, 2);
  assert.equal(state.nativeSlotSwapCount, 1);
  assert.equal(
    state.rules.discipline.players.find(({ id }) => id === "spain-player-01").nativePlayerNumber,
    12,
  );
  assert.equal(
    state.rules.offside.players.find(({ id }) => id === "argentina-player-11").nativePlayerNumber,
    11,
  );
  assert.throws(() => swapCssoccerMatchRulesHalftime(state, PLAYERS), /exactly once/);

  const deadBall = routeCssoccerMatchRulesBoundary(createMatchRules(), {
    position: { x: -1, y: 100 },
    lastTouch: 12,
  }).state;
  assert.throws(() => swapCssoccerMatchRulesHalftime(deadBall, swappedPlayers()), /clear first-half/);
});

test("throw pickup propagates native match-mode zero before its launch is released", () => {
  let state = routeCssoccerMatchRulesBoundary(createMatchRules(), {
    position: { x: 500, y: -1 },
    lastTouch: 1,
  }).state;
  state = completeBoundaryDelay(state);
  state = initializeCssoccerMatchRulesBoundaryRestart(state, {
    tacticsState: TACTICS,
    seed: 64,
    ballZones: { A: 7, B: 24 },
  });
  state = advanceCssoccerMatchRulesSetPiece(state, {
    type: "readiness",
    alreadyThere: 1,
    playerOnOff: 0,
    takerDistanceToIncident: 0,
    ballInHands: 0,
  });
  state = advanceCssoccerMatchRulesSetPiece(state, { type: "pickup-complete" });
  assert.equal(state.phase, "set-piece");
  assert.equal(state.setPiece.phase, "awaiting-decision");
  assert.equal(state.matchMode, 0);
  state = advanceCssoccerMatchRulesSetPiece(state, { type: "decision", action: "throw" });
  assert.equal(state.phase, "action-pending");
});

test("coordinator source has no evidence imports or fallback gameplay constants", () => {
  const source = readFileSync(new URL("../src/cssoccer/matchRulesState.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /(?:\.local|node:fs|native\.raw|state\.jsonl|readFileSync)/u);
  assert.doesNotMatch(source, /(?:BESIDE_BALL|PEN_RUNUP_DIST)\s*[:=]\s*\d/u);
  assert.match(source, /direct-wall-membership-required/u);
  assert.match(source, /parent-owned/u);
});

function createMatchRules() {
  return createCssoccerMatchRulesState({ players: PLAYERS });
}

function completeBoundaryDelay(input) {
  let state = input;
  for (let tick = 0; tick < 25; tick += 1) state = stepCssoccerMatchRulesBoundaryDelay(state);
  return state;
}

function fixturePlayers() {
  return [
    ...Array.from({ length: 11 }, (_, index) => ({
      id: `spain-player-${String(index + 1).padStart(2, "0")}`,
      nativePlayerNumber: index + 1,
      active: 1,
    })),
    ...Array.from({ length: 11 }, (_, index) => ({
      id: `argentina-player-${String(index + 1).padStart(2, "0")}`,
      nativePlayerNumber: index + 12,
      active: 1,
    })),
  ];
}

function swappedPlayers() {
  return PLAYERS.map((player) => ({
    ...player,
    nativePlayerNumber: player.nativePlayerNumber < 12
      ? player.nativePlayerNumber + 11
      : player.nativePlayerNumber - 11,
  }));
}

function takerCandidates() {
  return PLAYERS
    .filter(({ nativePlayerNumber }) => ![1, 12].includes(nativePlayerNumber))
    .map((player) => ({
      playerId: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      tacticalPosition: {
        x: Math.fround(100 + (player.nativePlayerNumber % 11) * 40),
        y: Math.fround(200 + (player.nativePlayerNumber % 5) * 50),
      },
    }));
}

function directFoulContext(overrides = {}) {
  return {
    candidate: {
      type: "foul-candidate",
      fouler: 5,
      fallenPlayer: 16,
      source: "player_ints",
      playerId: "spain-player-05",
    },
    offenderPosition: { x: 500, y: 400 },
    refereePosition: { x: 500, y: 400 },
    ballPossession: 5,
    justScored: 0,
    manDown: 1,
    offenderDistanceToBall: 0,
    rng: createCssoccerNativeRngState(),
    takerCandidates: takerCandidates(),
    ...overrides,
  };
}

function offsideContext(overrides = {}) {
  return {
    playerId: "spain-player-05",
    nativePlayerNumber: 5,
    position: { x: 900, y: 500 },
    distanceToBall: 0,
    matchMode: 0,
    ballPossession: 5,
    ballReleased: 0,
    lastTouch: 4,
    ballPosition: { x: 850, y: 500 },
    defenseA: 430,
    defenseB: 850,
    canBeOffside: 1,
    justScored: 0,
    refereeStrictness: 80,
    refereeAccuracy: 120,
    linesmanPosition: { x: 900, y: 500 },
    refereePosition: { x: 900, y: 500 },
    seed: 0,
    rng: createCssoccerNativeRngState(),
    takerCandidates: takerCandidates(),
    ...overrides,
  };
}

function tacticSlot(character) {
  return {
    formationId: 0,
    tableSha256: character.repeat(64),
    values: Array.from({ length: 70 }, () => Array.from({ length: 10 }, () => [500, 400])),
  };
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

function launchReceipt(request, character = "a") {
  return {
    schema: CSSOCCER_PARENT_LAUNCH_RECEIPT_SCHEMA,
    type: "launch-applied",
    actionType: request.type,
    nativePlayerNumber: request.nativePlayerNumber,
    profileHash: character.repeat(64),
    ...(request.targetPlayerNumber === undefined
      ? {}
      : { targetPlayerNumber: request.targetPlayerNumber }),
  };
}

function wallMembership(members) {
  return {
    schema: CSSOCCER_DIRECT_WALL_MEMBERSHIP_SCHEMA,
    profileHash: "d".repeat(64),
    members,
  };
}

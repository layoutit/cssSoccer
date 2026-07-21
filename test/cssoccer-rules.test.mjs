import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_DISCIPLINE_SOURCE,
  addCssoccerFoulPoints,
  completeCssoccerDismissal,
  createCssoccerDisciplineState,
  eligibleCssoccerRuleCandidates,
  remapCssoccerDisciplinePlayers,
  resolveCssoccerCard,
} from "../src/cssoccer/disciplineState.mjs";
import {
  CSSOCCER_FOUL_SOURCE,
  CSSOCCER_RULE_PITCH,
  CssoccerUnsupportedRuleSemanticsError,
  calculateCssoccerFoulNastiness,
  createCssoccerFoulRestart,
  createCssoccerFoulState,
  cssoccerIncidentIsPenalty,
  materializeCssoccerFoulTakerPlacement,
  resolveCssoccerAdvantage,
  resolveCssoccerFoulCall,
  selectCssoccerFoulTaker,
} from "../src/cssoccer/foulState.mjs";
import {
  CSSOCCER_OFFSIDE_SOURCE,
  createCssoccerLiveOffsideSnapshot,
  createCssoccerOffsideState,
  resolveCssoccerLiveOffsideSnapshot,
  stepCssoccerOffsidePlayer,
  syncCssoccerOffsidePlayerFlag,
} from "../src/cssoccer/offsideState.mjs";
import {
  CSSOCCER_RULE_SOURCE,
  clearCssoccerRuleRestart,
  completeCssoccerRuleDismissal,
  createCssoccerRuleState,
  remapCssoccerRulePlayers,
  resolveCssoccerRuleFoul,
} from "../src/cssoccer/ruleState.mjs";
import {
  advanceCssoccerNativeRng,
  createCssoccerNativeRngState,
} from "../src/cssoccer/randomState.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const sourceHashes = {
  "RULES.CPP": "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
  "INTELL.CPP": "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
  "ACTIONS.CPP": "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
  "FOOTBALL.CPP": "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
};
const evidenceTestOptions = {
  skip: Object.keys(sourceHashes).every((file) => existsSync(new URL(file, sourceRoot)))
    ? false
    : "ignored Actua source is unavailable",
};
const f32 = Math.fround;

test("rule metadata stays pinned to the four source owners", evidenceTestOptions, () => {
  for (const [file, expected] of Object.entries(sourceHashes)) {
    assert.equal(sha256(readFileSync(new URL(file, sourceRoot))), expected);
  }
  assert.equal(CSSOCCER_RULE_SOURCE.rules.sha256, sourceHashes["RULES.CPP"]);
  assert.equal(CSSOCCER_OFFSIDE_SOURCE.position.sha256, sourceHashes["INTELL.CPP"]);
  assert.equal(CSSOCCER_FOUL_SOURCE.processFlags.sha256, sourceHashes["FOOTBALL.CPP"]);
  assert.deepEqual(CSSOCCER_DISCIPLINE_SOURCE.goalkeeperNumbers, [1, 12]);

  const rules = sourceText("RULES.CPP");
  const intelligence = sourceText("INTELL.CPP");
  const football = sourceText("FOOTBALL.CPP");
  assert.match(rules, /if \(direct && \(penalty\(fouler\)\)\)[\s\S]*match_mode=PEN_KICK_A/u);
  assert.match(rules, /if \(\(!ball_poss\) && \(seed>ref_strictness\)\)[\s\S]*play_advantage=TRUE/u);
  assert.match(rules, /if \(teams\[plr-1\]\.tm_book\)[\s\S]*if \(nasty>seed\)/u);
  assert.match(intelligence, /void offside_rule\(match_player \*player\)[\s\S]*init_foul\(player->tm_player,FALSE,TRUE\)/u);
  assert.match(football, /if \(play_advantage\)[\s\S]*retake_foul\(\)/u);
});

test("referee visibility consumes browser RNG and advantage follows possession exactly", () => {
  const input = foulInput({ ballPossession: 5 });
  const first = resolveCssoccerFoulCall(createCssoccerFoulState(), input);
  const repeat = resolveCssoccerFoulCall(createCssoccerFoulState(), input);
  assert.deepEqual(first, repeat);
  assert.equal(first.decision.status, "restart-required");
  assert.equal(first.decision.reason, "fouling-team-possession");
  assert.equal(first.decision.visibilitySeed, 9);
  assert.equal(first.decision.advantageSeed, 15);
  assert.equal(first.rng.calls, 2);

  const ignored = resolveCssoccerFoulCall(createCssoccerFoulState(), foulInput({
    manDown: 0,
    refereePosition: { x: 0, y: 0 },
    offenderPosition: { x: 1200, y: 700 },
  }));
  assert.equal(ignored.decision.status, "ignored");
  assert.equal(ignored.rng.calls, 1);

  const pendingRng = advanceCssoccerNativeRng(createCssoccerNativeRngState());
  const pending = resolveCssoccerFoulCall(createCssoccerFoulState(), foulInput({
    ballPossession: 0,
    rng: pendingRng,
  }));
  assert.equal(pending.decision.visibilitySeed, 15);
  assert.equal(pending.decision.advantageSeed, 96);
  assert.equal(pending.decision.status, "advantage-pending");
  assert.equal(resolveCssoccerAdvantage(pending.state, { ballPossession: 0 }).state, pending.state);
  assert.equal(
    resolveCssoccerAdvantage(pending.state, { ballPossession: 12 }).decision.status,
    "advantage-complete",
  );
  const recalled = resolveCssoccerAdvantage(pending.state, { ballPossession: 2 });
  assert.equal(recalled.decision.status, "restart-required");
  assert.equal(recalled.state.playAdvantage, 0);
});

test("penalty, direct, and indirect descriptors cover both native teams and pitch ends", () => {
  const candidateSet = takerCandidates();
  const penaltyB = createCssoccerFoulRestart({
    decision: restartDecision({ fouler: 5, direct: 1, x: 100, y: 400 }),
    candidates: candidateSet,
  });
  assert.deepEqual(
    pick(penaltyB, ["kind", "mode", "matchMode", "awardedNativeTeam", "gameAction", "formation", "foulPoints"]),
    {
      kind: "penalty",
      mode: "PEN_KICK_B",
      matchMode: 18,
      awardedNativeTeam: "B",
      gameAction: 2,
      formation: "gather-outside-box",
      foulPoints: 10,
    },
  );
  assert.deepEqual(penaltyB.ballPosition, { x: f32(128), y: f32(400) });

  const penaltyA = createCssoccerFoulRestart({
    decision: restartDecision({ fouler: 16, direct: 1, x: 1180, y: 400 }),
    candidates: candidateSet,
  });
  assert.equal(penaltyA.mode, "PEN_KICK_A");
  assert.equal(penaltyA.matchMode, 17);
  assert.deepEqual(penaltyA.ballPosition, { x: f32(1152), y: f32(400) });

  const directA = createCssoccerFoulRestart({
    decision: restartDecision({ fouler: 16, direct: 1, x: 700, y: 200 }),
    candidates: candidateSet,
  });
  assert.equal(directA.mode, "DF_KICK_A");
  assert.equal(directA.matchMode, 15);
  assert.equal(directA.gameAction, 1);
  assert.equal(directA.canBeOffside, 1);
  assert.deepEqual(directA.ballPosition, { x: f32(700), y: f32(200) });

  const indirectB = createCssoccerFoulRestart({
    decision: restartDecision({ fouler: 5, direct: 0, x: 100, y: 400 }),
    candidates: candidateSet,
  });
  assert.equal(indirectB.kind, "indirect");
  assert.equal(indirectB.mode, "IF_KICK_B");
  assert.equal(indirectB.matchMode, 14);
  assert.equal(indirectB.foulPoints, 1);
  assert.equal(cssoccerIncidentIsPenalty({ fouler: 5, incidentPosition: { x: 100, y: 400 } }), true);
  assert.equal(cssoccerIncidentIsPenalty({
    fouler: 5,
    incidentPosition: {
      x: 100,
      y: f32(CSSOCCER_RULE_PITCH.centreY - f32(CSSOCCER_RULE_PITCH.ratio * 22)),
    },
  }), false);
});

test("taker selection is native-order stable, mirrors team B, and excludes inactive choices", () => {
  const candidates = takerCandidates().map((candidate) => (
    candidate.nativePlayerNumber === 13 || candidate.nativePlayerNumber === 14
      ? { ...candidate, tacticalPosition: { x: 500, y: 400 } }
      : candidate
  ));
  const tied = selectCssoccerFoulTaker({
    awardedNativeTeam: "B",
    incidentPosition: { x: 780, y: 400 },
    candidates,
  });
  assert.equal(tied.nativePlayerNumber, 13);
  assert.equal(tied.selection, "nearest-tactical-position");

  const preferred = selectCssoccerFoulTaker({
    awardedNativeTeam: "A",
    incidentPosition: { x: 400, y: 300 },
    candidates,
    preferredTaker: { playerId: "spain-player-08", nativePlayerNumber: 8 },
  });
  assert.equal(preferred.playerId, "spain-player-08");
  assert.equal(preferred.selection, "preferred-active");

  const inactive = candidates.map((candidate) => candidate.nativePlayerNumber === 8
    ? { ...candidate, active: 0 }
    : candidate);
  const fallback = selectCssoccerFoulTaker({
    awardedNativeTeam: "A",
    incidentPosition: { x: 400, y: 300 },
    candidates: inactive,
    preferredTaker: { playerId: "spain-player-08", nativePlayerNumber: 8 },
  });
  assert.notEqual(fallback.nativePlayerNumber, 8);

  const freeKick = createCssoccerFoulRestart({
    decision: restartDecision({ fouler: 16, direct: 1, x: 700, y: 400 }),
    candidates,
  });
  const placement = materializeCssoccerFoulTakerPlacement(freeKick, 10);
  assert.equal(placement.x < freeKick.ballPosition.x, true);
  const penalty = createCssoccerFoulRestart({
    decision: restartDecision({ fouler: 16, direct: 1, x: 1180, y: 400 }),
    candidates,
  });
  assert.deepEqual(materializeCssoccerFoulTakerPlacement(penalty, 12), { x: 1140, y: 400 });
});

test("cards preserve stable identity, model player_on_off, and cap each native team at five", () => {
  let state = createCssoccerDisciplineState({ players: fixturePlayers() });
  const yellow = resolveCssoccerCard(state, {
    playerId: "spain-player-02",
    nativePlayerNumber: 2,
    direct: 1,
    nastiness: 50,
    seed: 20,
  });
  assert.equal(yellow.event.card, "yellow");
  assert.equal(yellow.event.cardTicks, 60);
  assert.equal(yellow.state.players[1].tmBook, 1);

  const second = resolveCssoccerCard(yellow.state, {
    playerId: "spain-player-02",
    nativePlayerNumber: 2,
    direct: 1,
    nastiness: 30,
    seed: 20,
  });
  assert.equal(second.event.card, "red");
  assert.equal(second.event.cardTicks, 120);
  assert.equal(second.state.playerOnOff, 2);
  assert.equal(second.state.players[1].guyOn, 1);
  assert.equal(second.state.players[1].ruleEligible, false);
  state = completeCssoccerDismissal(second.state, { playerId: "spain-player-02" });
  assert.equal(state.players[1].guyOn, 0);
  assert.equal(state.playerOnOff, 0);
  assert.equal(eligibleCssoccerRuleCandidates(state, takerCandidates())
    .some(({ playerId }) => playerId === "spain-player-02"), false);

  const keeper = resolveCssoccerCard(state, {
    playerId: "spain-player-01",
    nativePlayerNumber: 1,
    direct: 1,
    nastiness: 1000,
    seed: 0,
  });
  assert.equal(keeper.event.card, null);
  assert.equal(keeper.event.reason, "goalkeeper-exempt");

  let capped = createCssoccerDisciplineState({ players: fixturePlayers() });
  for (let nativePlayerNumber = 2; nativePlayerNumber <= 6; nativePlayerNumber += 1) {
    const playerId = `spain-player-0${nativePlayerNumber}`;
    const red = resolveCssoccerCard(capped, {
      playerId,
      nativePlayerNumber,
      direct: 1,
      nastiness: 100,
      seed: 20,
    });
    assert.equal(red.event.card, "red");
    capped = completeCssoccerDismissal(red.state, { playerId });
  }
  const sixth = resolveCssoccerCard(capped, {
    playerId: "spain-player-07",
    nativePlayerNumber: 7,
    direct: 1,
    nastiness: 100,
    seed: 20,
  });
  assert.equal(sixth.event.card, null);
  assert.equal(sixth.event.reason, "dismissal-cap");
});

test("offside potential, linesman review, and interference are symmetric by native end", () => {
  for (const spec of [
    {
      playerId: "spain-player-05",
      nativePlayerNumber: 5,
      position: { x: 900, y: 500 },
      ballPossession: 5,
      ballReleased: 10,
      lastTouch: 4,
      ballPosition: { x: 850, y: 500 },
      defenseA: 430,
      defenseB: 850,
    },
    {
      playerId: "argentina-player-05",
      nativePlayerNumber: 16,
      position: { x: 380, y: 300 },
      ballPossession: 16,
      ballReleased: -10,
      lastTouch: 15,
      ballPosition: { x: 400, y: 300 },
      defenseA: 430,
      defenseB: 850,
    },
  ]) {
    let state = createCssoccerOffsideState({ players: offsidePlayers() });
    const potential = stepCssoccerOffsidePlayer(state, offsideContext(spec, {
      ballReleased: 0,
    }));
    assert.equal(offsidePlayer(potential.state, spec.playerId).tmOff, -1);
    state = potential.state;
    const active = stepCssoccerOffsidePlayer(state, offsideContext(spec, {
      ballPossession: 0,
      linesmanPosition: spec.position,
      seed: 0,
    }));
    assert.equal(active.review.seen, true);
    assert.equal(active.event.source, "offside_rule");
    assert.equal(active.event.direct, 0);
    assert.equal(active.state.offsideNow, 1);
    assert.equal(offsidePlayer(active.state, spec.playerId).tmOff, 0);
  }

  let missedState = createCssoccerOffsideState({ players: offsidePlayers() });
  missedState = syncCssoccerOffsidePlayerFlag(missedState, {
    playerId: "spain-player-05",
    nativePlayerNumber: 5,
    tmOff: -1,
  });
  const missed = stepCssoccerOffsidePlayer(missedState, offsideContext({
    playerId: "spain-player-05",
    nativePlayerNumber: 5,
    position: { x: 700, y: 400 },
    ballPossession: 0,
    ballReleased: 8,
    lastTouch: 4,
    ballPosition: { x: 650, y: 400 },
    defenseA: 600,
    defenseB: 699,
  }, {
    refereeAccuracy: 0,
    seed: 127,
    linesmanPosition: { x: 700, y: 400 },
    distanceToBall: 1000,
  }));
  assert.equal(missed.review.seen, false);
  assert.equal(missed.ballReleased, 0);
  assert.equal(offsidePlayer(missed.state, "spain-player-05").tmOff, -1);

  const practice = createCssoccerOffsideState({ players: offsidePlayers(), practice: 1 });
  const disabled = stepCssoccerOffsidePlayer(practice, offsideContext({
    playerId: "spain-player-05",
    nativePlayerNumber: 5,
    position: { x: 900, y: 400 },
    ballPossession: 5,
    ballReleased: 0,
    lastTouch: 4,
    ballPosition: { x: 850, y: 400 },
    defenseA: 430,
    defenseB: 850,
  }));
  assert.equal(disabled.state, practice);
  assert.equal(disabled.event, null);
});

test("live kick snapshots use the current ball and deepest active outfield defender", () => {
  const players = liveOffsidePlayers();
  const snapshot = createCssoccerLiveOffsideSnapshot({
    tick: 91,
    ballPosition: { x: 700, y: 400 },
    passer: { playerId: "spain-player-04", nativePlayerNumber: 4 },
    players,
  });
  assert.equal(snapshot.status, "pending");
  assert.equal(snapshot.defenderLine, 850);
  assert.deepEqual(
    snapshot.candidates.map(({ playerId }) => playerId),
    ["spain-player-05"],
  );
  assert.equal(
    snapshot.candidates.some(({ playerId }) => playerId === "spain-player-06"),
    false,
    "level with the current defender line remains onside",
  );
  assert.equal(
    snapshot.candidates.some(({ playerId }) => playerId === "spain-player-07"),
    false,
    "a player in their own half remains onside",
  );

  const movedDefender = liveOffsidePlayers(new Map([[13, { x: 910, y: 300 }]]));
  const changedLine = createCssoccerLiveOffsideSnapshot({
    tick: 91,
    ballPosition: { x: 700, y: 400 },
    passer: { playerId: "spain-player-04", nativePlayerNumber: 4 },
    players: movedDefender,
  });
  assert.equal(changedLine.status, "clear");
  assert.equal(changedLine.defenderLine, 910);

  const changedPass = createCssoccerLiveOffsideSnapshot({
    tick: 92,
    ballPosition: { x: 920, y: 400 },
    passer: { playerId: "spain-player-04", nativePlayerNumber: 4 },
    players,
  });
  assert.equal(changedPass.status, "clear");
});

test("live offside waits for involvement and cancels on a current intervening touch", () => {
  const players = liveOffsidePlayers();
  const makeSnapshot = () => createCssoccerLiveOffsideSnapshot({
    tick: 91,
    ballPosition: { x: 700, y: 400 },
    passer: { playerId: "spain-player-04", nativePlayerNumber: 4 },
    players,
  });
  const pending = resolveCssoccerLiveOffsideSnapshot(makeSnapshot(), {
    ballPosition: { x: 700, y: 400 },
    lastTouch: 4,
    players,
    refereeStrictness: 80,
  });
  assert.equal(pending.status, "pending");

  const nonInvolved = resolveCssoccerLiveOffsideSnapshot(makeSnapshot(), {
    ballPosition: { x: 700, y: 400 },
    lastTouch: 6,
    players,
    refereeStrictness: 80,
  });
  assert.equal(nonInvolved.status, "cancelled");
  assert.equal(nonInvolved.event.reason, "onside-teammate-touch");

  const defenderTouch = resolveCssoccerLiveOffsideSnapshot(makeSnapshot(), {
    ballPosition: { x: 700, y: 400 },
    lastTouch: 13,
    players,
    refereeStrictness: 80,
  });
  assert.equal(defenderTouch.status, "cancelled");
  assert.equal(defenderTouch.event.reason, "defender-touch");

  const candidateTouch = resolveCssoccerLiveOffsideSnapshot(makeSnapshot(), {
    ballPosition: { x: 900, y: 600 },
    lastTouch: 5,
    players,
    refereeStrictness: 80,
  });
  assert.equal(candidateTouch.status, "involved");
  assert.equal(candidateTouch.event.playerId, "spain-player-05");
  assert.equal(candidateTouch.event.reason, "candidate-touch");

  const interference = resolveCssoccerLiveOffsideSnapshot(makeSnapshot(), {
    ballPosition: { x: 890, y: 600 },
    lastTouch: 4,
    players,
    refereeStrictness: 80,
  });
  assert.equal(interference.status, "involved");
  assert.equal(interference.event.reason, "active-interference");
});

test("rule reducer binds restart, discipline, foul points, and halftime stable identity", () => {
  let state = createCssoccerRuleState({ players: fixturePlayers() });
  const result = resolveCssoccerRuleFoul(state, {
    candidate: directCandidate(5, "spain-player-05"),
    offenderPosition: { x: 100, y: 400 },
    refereePosition: { x: 100, y: 400 },
    ballPossession: 5,
    justScored: 0,
    manDown: 1,
    offenderDistanceToBall: 10,
    rng: createCssoccerNativeRngState(),
    takerCandidates: takerCandidates(),
  });
  assert.equal(result.restart.mode, "PEN_KICK_B");
  assert.equal(result.disciplineEvent.card, "red");
  assert.equal(
    result.state.discipline.players.find(({ id }) => id === "spain-player-05").tmFouls,
    10,
  );
  assert.throws(() => resolveCssoccerRuleFoul(result.state, {
    candidate: directCandidate(5, "spain-player-05"),
  }), /Dismissed or unavailable/u);

  state = completeCssoccerRuleDismissal(result.state, { playerId: "spain-player-05" });
  state = clearCssoccerRuleRestart(state);
  const remapped = remapCssoccerRulePlayers(state, swappedFixturePlayers());
  assert.equal(
    remapped.discipline.players.find(({ id }) => id === "spain-player-05").nativePlayerNumber,
    16,
  );
  assert.equal(
    remapped.discipline.players.find(({ id }) => id === "spain-player-05").status,
    "dismissed",
  );
  assert.deepEqual(remapped.discipline.playersOff, { A: 0, B: 1 });
  assert.equal(
    remapped.offside.players.find(({ id }) => id === "spain-player-05").nativePlayerNumber,
    16,
  );
});

test("unresolved contact, action, and malformed state are rejected instead of invented", () => {
  assert.throws(() => resolveCssoccerFoulCall(createCssoccerFoulState(), foulInput({
    candidate: {
      type: "foul-candidate",
      fouler: 5,
      source: "ai-guessed-foul",
      playerId: "spain-player-05",
    },
  })), (error) => (
    error instanceof CssoccerUnsupportedRuleSemanticsError
    && error.code === "unbound-foul-producer"
  ));
  assert.throws(() => resolveCssoccerFoulCall(createCssoccerFoulState(), foulInput({
    candidate: { ...directCandidate(5, "spain-player-05"), direct: 0 },
  })), /contradicts its source producer/u);
  assert.throws(() => selectCssoccerFoulTaker({
    awardedNativeTeam: "A",
    incidentPosition: { x: 500, y: 400 },
    candidates: takerCandidates().map((candidate) => ({ ...candidate, active: 0 })),
  }), /no source-eligible/u);
  assert.throws(() => materializeCssoccerFoulTakerPlacement({ schema: "wrong" }, 10), /descriptor/u);
  assert.throws(() => createCssoccerRuleState({ players: fixturePlayers().slice(1) }), /exactly 22/u);
  assert.equal(calculateCssoccerFoulNastiness({
    offenderDistanceToBall: 9,
    refereeStrictness: 80,
    manDown: 0,
  }), f32(f32(Math.sqrt(f32(36))) * f32(80 / 6) / 3));

  const points = addCssoccerFoulPoints(createCssoccerDisciplineState({ players: fixturePlayers() }), {
    playerId: "argentina-player-05",
    nativePlayerNumber: 16,
    points: 3,
  });
  assert.equal(points.players.find(({ id }) => id === "argentina-player-05").tmFouls, 3);
});

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

function swappedFixturePlayers() {
  return fixturePlayers().map((player) => ({
    ...player,
    nativePlayerNumber: player.nativePlayerNumber < 12
      ? player.nativePlayerNumber + 11
      : player.nativePlayerNumber - 11,
  }));
}

function offsidePlayers() {
  return fixturePlayers().map(({ id, nativePlayerNumber }) => ({ id, nativePlayerNumber }));
}

function liveOffsidePlayers(overrides = new Map()) {
  return fixturePlayers().map(({ id, nativePlayerNumber }) => {
    const defaultPosition = nativePlayerNumber < 12
      ? nativePlayerNumber === 5
        ? { x: 900, y: 600 }
        : nativePlayerNumber === 6
          ? { x: 850, y: 500 }
          : nativePlayerNumber === 7
            ? { x: 500, y: 300 }
            : { x: 600 + nativePlayerNumber, y: 100 + nativePlayerNumber * 10 }
      : nativePlayerNumber === 13
        ? { x: 850, y: 300 }
        : { x: 700 - nativePlayerNumber, y: 100 + nativePlayerNumber * 10 };
    return {
      id,
      nativePlayerNumber,
      active: 1,
      role: nativePlayerNumber === 1 || nativePlayerNumber === 12 ? "keeper" : "outfield",
      position: overrides.get(nativePlayerNumber) ?? defaultPosition,
    };
  });
}

function takerCandidates() {
  return fixturePlayers()
    .filter(({ nativePlayerNumber }) => ![1, 12].includes(nativePlayerNumber))
    .map((player) => ({
      playerId: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      tacticalPosition: {
        x: f32(100 + (player.nativePlayerNumber % 11) * 40),
        y: f32(200 + (player.nativePlayerNumber % 5) * 50),
      },
    }));
}

function directCandidate(fouler = 5, playerId = "spain-player-05") {
  return {
    type: "foul-candidate",
    fouler,
    fallenPlayer: fouler < 12 ? 16 : 5,
    source: "player_ints",
    playerId,
  };
}

function foulInput(overrides = {}) {
  return {
    candidate: directCandidate(),
    offenderPosition: { x: 500, y: 400 },
    refereePosition: { x: 500, y: 400 },
    ballPossession: 5,
    justScored: 0,
    freeKicksEnabled: 1,
    refereeAccuracy: 120,
    refereeStrictness: 80,
    manDown: 1,
    rng: createCssoccerNativeRngState(),
    ...overrides,
  };
}

function restartDecision({ fouler, direct, x, y }) {
  return {
    status: "restart-required",
    reason: "synthetic-transport-fixture",
    fouler,
    direct,
    incidentPosition: { x, y },
  };
}

function offsideContext(spec, overrides = {}) {
  return {
    playerId: spec.playerId,
    nativePlayerNumber: spec.nativePlayerNumber,
    position: spec.position,
    distanceToBall: 0,
    matchMode: 0,
    ballPossession: spec.ballPossession,
    ballReleased: spec.ballReleased,
    lastTouch: spec.lastTouch,
    ballPosition: spec.ballPosition,
    defenseA: spec.defenseA,
    defenseB: spec.defenseB,
    canBeOffside: 1,
    justScored: 0,
    refereeStrictness: 80,
    refereeAccuracy: 120,
    linesmanPosition: spec.position,
    seed: 0,
    ...overrides,
  };
}

function offsidePlayer(state, playerId) {
  return state.players.find(({ id }) => id === playerId);
}

function sourceText(file) {
  return readFileSync(new URL(file, sourceRoot), "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pick(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_PASS_DECISION_SOURCE,
  resolveCssoccerFirstTimePassSearch,
  resolveCssoccerAiNormalPass,
  resolveCssoccerUserDirectionalPass,
  resolveCssoccerUserPassDecision,
} from "../src/cssoccer/passDecisionState.mjs";
import { createCssoccerNativeRngState } from "../src/cssoccer/randomState.mjs";

test("ordinary AI pass selection is source-ordered, symmetric, and RNG-owned", () => {
  const teamA = decision({ holder: 4, target: 6, holderX: 500, targetX: 650, facingX: 1 });
  const teamB = decision({ holder: 15, target: 17, holderX: 780, targetX: 630, facingX: -1 });

  assert.equal(teamA.outcome, "pass");
  assert.equal(teamA.targetNativePlayer, 6);
  assert.equal(teamA.passType, 5);
  assert.equal(teamA.candidates[0].preference, -18);
  assert.equal(teamA.rng.calls, 2);
  assert.deepEqual(
    {
      outcome: teamB.outcome,
      passType: teamB.passType,
      preference: teamB.candidates[0].preference,
      rng: teamB.rng,
    },
    {
      outcome: teamA.outcome,
      passType: teamA.passType,
      preference: teamA.candidates[0].preference,
      rng: teamA.rng,
    },
  );
});

test("a legal backward option can be rejected without fixture-specific call counts", () => {
  const result = decision({
    holder: 4,
    target: 6,
    holderX: 500,
    targetX: 350,
    facingX: -1,
  });
  assert.equal(result.outcome, "no-pass");
  assert.equal(result.targetNativePlayer, null);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].preference, 93);
  assert.equal(result.rng.calls, 2);
});

test("busy and invisible team-mates consume no pass-decision RNG", () => {
  const input = inputFor({ holder: 4, target: 6, holderX: 500, targetX: 650, facingX: 1 });
  input.players[1].action = 3;
  const busy = resolveCssoccerAiNormalPass(input);
  assert.equal(busy.candidates.length, 0);
  assert.equal(busy.rng.calls, 0);

  input.players[1].action = 1;
  input.players[1].position.x = 1_200;
  input.players[1].distanceToBall = 700;
  const invisible = resolveCssoccerAiNormalPass(input);
  assert.equal(invisible.candidates.length, 0);
  assert.equal(invisible.rng.calls, 0);
});

test("the explicit source want-pass slot is not restricted to the holder's team", () => {
  const input = inputFor({
    holder: 15,
    target: 17,
    holderX: 780,
    targetX: 630,
    facingX: -1,
  });
  input.players.push({
    nativePlayer: 6,
    action: 1,
    controlled: false,
    on: true,
    position: { x: 600, y: 400 },
    distanceToBall: 180,
    flair: 70,
  });
  input.match.wantPassNativePlayer = 6;

  const result = resolveCssoccerAiNormalPass(input);

  assert.deepEqual(
    result.candidates.map(({ nativePlayer }) => nativePlayer).sort((left, right) => left - right),
    [6, 17],
  );
  assert.equal(result.rng.calls, 4);
});

test("first-time scans preserve the live requested receiver filter", () => {
  const input = inputFor({
    holder: 21,
    target: 17,
    holderX: 600,
    targetX: 550,
    facingX: -1,
  });
  input.players.push({
    nativePlayer: 19,
    action: 1,
    controlled: false,
    on: true,
    position: { x: 650, y: 400 },
    distanceToBall: 50,
    flair: 70,
  });
  input.rng = createCssoccerNativeRngState({
    state: 1,
    randSeed: 1,
    seed: 1,
    calls: 0,
  });
  const predictions = [{
    ball: { x: 600, y: 400 },
    facing: { x: -1, y: 0 },
  }];
  const unrestricted = resolveCssoccerFirstTimePassSearch({
    holder: input.holder,
    match: input.match,
    players: input.players,
    predictions,
    rng: input.rng,
  });
  const requested = resolveCssoccerFirstTimePassSearch({
    holder: input.holder,
    match: { ...input.match, wantPassNativePlayer: 19 },
    players: input.players,
    predictions,
    rng: input.rng,
  });

  assert.deepEqual(
    unrestricted.evaluations[0].candidates
      .map(({ nativePlayer }) => nativePlayer)
      .sort((left, right) => left - right),
    [17, 19],
  );
  assert.equal(unrestricted.rng.calls, 4);
  assert.deepEqual(
    requested.evaluations[0].candidates.map(({ nativePlayer }) => nativePlayer),
    [17],
  );
  assert.equal(requested.rng.calls, 2);
});

test("first-time pass preferences use the temporary predicted shooting range", () => {
  const input = inputFor({
    holder: 21,
    target: 17,
    holderX: 450,
    targetX: 298,
    facingX: -1,
  });
  const result = resolveCssoccerFirstTimePassSearch({
    holder: input.holder,
    match: input.match,
    players: input.players,
    predictions: [
      { ball: { x: 400, y: 400 }, facing: { x: -1, y: 0 } },
      { ball: { x: 350, y: 400 }, facing: { x: -1, y: 0 } },
    ],
    rng: input.rng,
  });
  const outsideBaseline = resolveCssoccerAiNormalPass({
    ...input,
    ball: { x: 400, y: 400 },
  });
  const insideBaseline = resolveCssoccerAiNormalPass({
    ...input,
    ball: { x: 350, y: 400 },
  });
  const outsidePreference = result.evaluations[0].candidates[0].preference;
  const insidePreference = result.evaluations[1].candidates[0].preference;

  assert.equal(input.holder.shootingRange, false);
  assert.equal(outsidePreference, outsideBaseline.candidates[0].preference);
  assert.equal(insidePreference, insideBaseline.candidates[0].preference + 100);
});

test("local-user pass selection follows the five-degree cone without consuming RNG", () => {
  const input = inputFor({
    holder: 21,
    target: 20,
    holderX: 700,
    targetX: 620,
    facingX: -1,
  });
  input.players.push({
    nativePlayer: 19,
    action: 1,
    controlled: false,
    on: true,
    position: { x: 500, y: 400 },
    distanceToBall: 200,
    flair: 70,
  });
  input.players.push({
    nativePlayer: 22,
    action: 1,
    controlled: false,
    on: true,
    position: { x: 600, y: 420 },
    distanceToBall: Math.hypot(100, 20),
    flair: 70,
  });
  const result = resolveCssoccerUserPassDecision(input);

  assert.equal(result.outcome, "pass");
  assert.equal(result.targetNativePlayer, 20);
  assert.equal(result.passType, 5);
  assert.equal(result.candidates[0].preference, 0);
  assert.equal(result.rng.calls, input.rng.calls);
  assert.equal(result.rng.randSeed, input.rng.randSeed);
});

test("local-user geometry selects source lofted and crossing pass types", () => {
  const lofted = inputFor({
    holder: 21,
    target: 20,
    holderX: 700,
    targetX: 300,
    facingX: -1,
  });
  lofted.holder.vision = 128;
  const longResult = resolveCssoccerUserPassDecision(lofted);
  assert.equal(longResult.targetNativePlayer, 20);
  assert.equal(longResult.passType, -1);

  const crossing = inputFor({
    holder: 21,
    target: 20,
    holderX: 50,
    targetX: 100,
    facingX: -1,
  });
  crossing.ball = { x: 50, y: 750 };
  crossing.holder.position = { x: 50, y: 750 };
  crossing.holder.vision = 128;
  crossing.match.cross = true;
  crossing.players[0].position = { x: 50, y: 750 };
  crossing.players[0].distanceToBall = 0.1;
  crossing.players[1].position = { x: 100, y: 400 };
  crossing.players[1].distanceToBall = Math.hypot(50, 350);
  const crossResult = resolveCssoccerUserPassDecision(crossing);
  assert.equal(crossResult.targetNativePlayer, 20);
  assert.ok([16, 17].includes(crossResult.passType));

  crossing.players[1].position = { x: 400, y: 400 };
  crossing.players[1].distanceToBall = Math.hypot(350, 350);
  const changed = resolveCssoccerUserPassDecision(crossing);
  assert.notEqual(changed.passType, crossResult.passType);
});

test("standing directional Fire 2 uses taker_pass_f and a typed no-receiver branch", () => {
  const input = inputFor({
    holder: 21,
    target: 20,
    holderX: 700,
    targetX: 620,
    facingX: -1,
  });
  const receiver = resolveCssoccerUserDirectionalPass({
    ball: input.ball,
    direction: { x: -1, y: 0 },
    holder: input.holder,
    players: input.players,
    rng: input.rng,
  });
  assert.equal(receiver.outcome, "pass");
  assert.equal(receiver.targetNativePlayer, 20);
  assert.equal(receiver.rng.calls, 0);

  const directed = resolveCssoccerUserDirectionalPass({
    ball: input.ball,
    direction: { x: 0, y: 1 },
    holder: input.holder,
    players: input.players,
    rng: input.rng,
  });
  assert.equal(directed.outcome, "directed");
  assert.equal(directed.targetNativePlayer, 0);
  assert.equal(directed.passType, 7);
});

test("pass decision runtime is source-bound and contains no oracle answer route", () => {
  assert.equal(CSSOCCER_PASS_DECISION_SOURCE.file, "INTELL.CPP");
  assert.equal(CSSOCCER_PASS_DECISION_SOURCE.sha256.length, 64);
  const source = readFileSync(
    new URL("../src/cssoccer/passDecisionState.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /(?:\.local\/|state\.jsonl|native\.raw|oracle|spain|argentina|tick\s*===|player-\d)/iu,
  );
});

function decision(options) {
  return resolveCssoccerAiNormalPass(inputFor(options));
}

function inputFor({ holder, target, holderX, targetX, facingX }) {
  const holderPosition = { x: holderX, y: 400 };
  const targetPosition = { x: targetX, y: 400 };
  return {
    ball: { ...holderPosition },
    holder: {
      nativePlayer: holder,
      position: holderPosition,
      facing: { x: facingX, y: 0 },
      pitchRatio: Math.fround(1280 / 120),
      power: 80,
      flair: 80,
      vision: 80,
      shootingRange: false,
    },
    match: {
      ballInHands: false,
      cross: false,
      mustPass: false,
      setPiece: false,
      wantPassNativePlayer: 0,
    },
    players: [
      {
        nativePlayer: holder,
        action: 1,
        controlled: false,
        on: true,
        position: holderPosition,
        distanceToBall: 0.1,
        flair: 80,
      },
      {
        nativePlayer: target,
        action: 1,
        controlled: false,
        on: true,
        position: targetPosition,
        distanceToBall: Math.abs(targetX - holderX),
        flair: 70,
      },
    ],
    rng: createCssoccerNativeRngState(),
  };
}

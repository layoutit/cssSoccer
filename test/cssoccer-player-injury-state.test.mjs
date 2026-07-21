import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCssoccerFallInjury,
  projectCssoccerInjuredRate,
} from "../src/cssoccer/playerInjuryState.mjs";

const SPAIN_10 = {
  pace: 33,
  power: 92,
  control: 76,
  flair: 83,
  vision: 47,
  accuracy: 104,
  stamina: 71,
  discipline: 48,
};

test("linked fall injury reproduces the tick-215 native profile refresh", () => {
  const transition = applyCssoccerFallInjury({
    baseAttributes: SPAIN_10,
    currentAttributes: SPAIN_10,
    currentInjury: 0,
    force: 402,
    playerMinutes: 8,
    teamFitness: 99,
    timeFactor: 2,
  });
  assert.equal(transition.injuryArgument, 6);
  assert.equal(transition.injuryDelta, 173);
  assert.equal(transition.injury, 173);
  assert.equal(transition.effectiveFitness, 73);
  assert.equal(transition.baseRate, 29);
  assert.deepEqual(transition.attributes, {
    pace: 28,
    power: 80,
    control: 75,
    flair: 81,
    vision: 47,
    accuracy: 102,
    stamina: 65,
    discipline: 48,
  });
});

test("injured rate projection reapplies minute fatigue from refreshed stamina", () => {
  assert.equal(projectCssoccerInjuredRate({
    baseRate: 29,
    playerMinutes: 9,
    stamina: 65,
  }), 28);
});

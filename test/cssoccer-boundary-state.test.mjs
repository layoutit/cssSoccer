import assert from "node:assert/strict";
import test from "node:test";

import {
  CSSOCCER_MATCH_MODE,
  classifyCssoccerBoundary,
} from "../src/cssoccer/boundaryState.mjs";

const at = (x, y, lastTouch, flags = {}) => classifyCssoccerBoundary({
  position: { x, y },
  lastTouch,
  ...flags,
});

test("native match-mode ids remain contiguous and pinned", () => {
  assert.deepEqual(Object.values(CSSOCCER_MATCH_MODE), [...Array(20).keys()]);
  assert.equal(CSSOCCER_MATCH_MODE.GOAL_KICK_BR, 10);
  assert.equal(CSSOCCER_MATCH_MODE.THROW_IN_A, 11);
  assert.equal(CSSOCCER_MATCH_MODE.SWAP_ENDS, 19);
});

test("left goal line awards native corners and goal kicks on both halves", () => {
  assert.deepEqual(
    [at(-1, 100, 1), at(-1, 700, 1)].map(({ mode, awardedNativeTeam }) => [mode, awardedNativeTeam]),
    [["CORNER_TL", "B"], ["CORNER_BL", "B"]],
  );
  assert.deepEqual(
    [at(-1, 100, 12), at(-1, 700, 12)].map(({ mode, awardedNativeTeam }) => [mode, awardedNativeTeam]),
    [["GOAL_KICK_TL", "A"], ["GOAL_KICK_BL", "A"]],
  );
});

test("right goal line awards native corners and goal kicks on both halves", () => {
  assert.deepEqual(
    [at(1280, 100, 12), at(1280, 700, 12)].map(({ mode, awardedNativeTeam }) => [mode, awardedNativeTeam]),
    [["CORNER_TR", "A"], ["CORNER_BR", "A"]],
  );
  assert.deepEqual(
    [at(1280, 100, 1), at(1280, 700, 1)].map(({ mode, awardedNativeTeam }) => [mode, awardedNativeTeam]),
    [["GOAL_KICK_TR", "B"], ["GOAL_KICK_BR", "B"]],
  );
});

test("inactive-team fallbacks reproduce source branch direction", () => {
  assert.equal(at(-1, 100, 1, { teamBOn: 0 }).mode, "GOAL_KICK_TL");
  assert.equal(at(-1, 100, 12, { teamAOn: 0 }).mode, "CORNER_TL");
  assert.equal(at(1280, 700, 12, { teamAOn: 0 }).mode, "GOAL_KICK_BR");
  assert.equal(at(1280, 700, 1, { teamBOn: 0 }).mode, "CORNER_BR");
});

test("touchlines clamp only incident y and award the opposite active team", () => {
  const top = at(123.25, -0.25, 1);
  const bottom = at(456.5, 800, 12);
  assert.deepEqual(top, {
    kind: "throw-in",
    mode: "THROW_IN_B",
    matchMode: 12,
    awardedNativeTeam: "B",
    boundary: "top-touchline",
    incidentPosition: { x: Math.fround(123.25), y: Math.fround(0) },
  });
  assert.deepEqual(bottom, {
    kind: "throw-in",
    mode: "THROW_IN_A",
    matchMode: 11,
    awardedNativeTeam: "A",
    boundary: "bottom-touchline",
    incidentPosition: { x: Math.fround(456.5), y: Math.fround(799) },
  });
  assert.equal(at(123, -1, 1, { teamBOn: 0 }).mode, "THROW_IN_A");
  assert.equal(at(123, -1, 12, { teamAOn: 0 }).mode, "THROW_IN_B");
});

test("goal-line checks precede touchline checks and live positions return null", () => {
  assert.equal(at(-0.01, -100, 1).mode, "CORNER_TL");
  assert.equal(at(1280, 900, 1).mode, "GOAL_KICK_BR");
  assert.equal(at(0, 0, 1), null);
  assert.equal(at(1279, 799, 22), null);
});

test("boundary input rejects malformed or untyped state", () => {
  assert.throws(() => classifyCssoccerBoundary(), /position must be a plain object/);
  assert.throws(() => at(0, 0, 0), /1 through 22/);
  assert.throws(() => at(0, 0, 1, { teamAOn: true }), /must be 0 or 1/);
  assert.throws(
    () => classifyCssoccerBoundary({ position: { x: 0, y: 0, z: 0 }, lastTouch: 1 }),
    /exactly x and y/,
  );
});

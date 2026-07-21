import assert from "node:assert/strict";
import test from "node:test";

import {
  createCssoccerZoneState,
  stepCssoccerZoneState,
} from "../src/cssoccer/zoneState.mjs";

const step = (state, overrides = {}) => stepCssoccerZoneState(state, {
  ballPosition: { x: 640, y: 400 },
  ballOutOfPlay: 0,
  matchMode: 0,
  ballInHands: 0,
  possessionPlayer: 0,
  ...overrides,
});

test("live ball zones round to the native 8 by 4 grid and mirror B", () => {
  const state = step(createCssoccerZoneState(), {
    ballPosition: { x: 639.9, y: 399.9 },
  });
  assert.deepEqual(state.A, { ballZone: 20, zoneCenter: { x: 728, y: 532 } });
  assert.deepEqual(state.B, { ballZone: 11, zoneCenter: { x: 546, y: 266 } });
});

test("keeper hands use the source goal-kick zones without replacing centers", () => {
  const initial = step(createCssoccerZoneState(), { ballPosition: { x: 320, y: 200 } });
  const keeperA = step(initial, { ballInHands: 1, possessionPlayer: 1 });
  assert.equal(keeperA.A.ballZone, 11);
  assert.equal(keeperA.B.ballZone, 20);
  assert.deepEqual(keeperA.A.zoneCenter, initial.A.zoneCenter);
  const keeperB = step(initial, { ballInHands: 1, possessionPlayer: 12 });
  assert.equal(keeperB.A.ballZone, 19);
  assert.equal(keeperB.B.ballZone, 12);
});

test("goal-kick modes and out-of-play frames preserve the prior zone state", () => {
  const state = step(createCssoccerZoneState(), { ballPosition: { x: 320, y: 200 } });
  assert.equal(step(state, { matchMode: 7, ballPosition: { x: 1000, y: 700 } }), state);
  assert.equal(step(state, { ballOutOfPlay: 1, ballPosition: { x: 1000, y: 700 } }), state);
});

test("the native bottom-band branch updates centers but retains prior zone ids", () => {
  const initial = step(createCssoccerZoneState(), { ballPosition: { x: 320, y: 200 } });
  const bottom = step(initial, { ballPosition: { x: 1000, y: 1000 } });
  assert.equal(bottom.A.ballZone, initial.A.ballZone);
  assert.equal(bottom.B.ballZone, initial.B.ballZone);
  assert.deepEqual(bottom.A.zoneCenter, { x: 910, y: 1064 });
  assert.deepEqual(bottom.B.zoneCenter, { x: 364, y: -266 });
});

test("zone inputs reject widened native flags and player ids", () => {
  const state = createCssoccerZoneState();
  assert.throws(() => step(state, { ballInHands: true }), /0 or 1/);
  assert.throws(() => step(state, { possessionPlayer: 23 }), /outside their native ranges/);
});

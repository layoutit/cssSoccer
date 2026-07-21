import assert from "node:assert/strict";
import test from "node:test";

import { createBallMatchState } from "../src/cssoccer/ballMatchState.mjs";
import {
  selectCssoccerGroundRunOnIntercept,
} from "../src/cssoccer/interceptState.mjs";
import { sourceFullPlayerSpeed } from "../src/cssoccer/motionState.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  projectCssoccerTravelSourceProfile,
} from "../src/cssoccer/nativeGameplayProfile.mjs";

const F32 = Math.fround;

test("go_to_path chooses a different odd prediction when player geometry changes", () => {
  const ballState = createBallMatchState({
    ball: {
      position: { x: F32(640), y: F32(400), z: F32(2) },
      previousPosition: { x: F32(635), y: F32(400), z: F32(2) },
      displacement: { x: F32(5), y: F32(0), z: F32(0) },
      still: 0,
      speed: 5,
    },
  });
  const travel = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate: 64 },
  );
  const common = {
    ballState,
    pitchLength: 1280,
    pitchWidth: 800,
    playerHeight: F32(25),
  };
  const player = (x) => ({
    position: { x: F32(x), y: F32(400), z: F32(0) },
    facing: { x: F32(1), y: F32(0) },
    fullSpeed: sourceFullPlayerSpeed({
      pitchLength: 1280,
      teamRate: 64,
      celebrating: false,
    }),
    maxTurn2Radians: travel.maxTurn2Radians,
    imThereDistance: travel.imThereDistance,
    canRotateAndRun: true,
    controlled: true,
    userControlled: true,
    reactionTicks: 5,
    jumpHeight: F32(39),
    mustFace: null,
  });

  const far = selectCssoccerGroundRunOnIntercept({ ...common, player: player(580) });
  const near = selectCssoccerGroundRunOnIntercept({ ...common, player: player(620) });
  assert.equal(far.tickOffset, 37);
  assert.equal(near.tickOffset, 21);
  assert.notDeepEqual(far.target, near.target);
  assert.equal(far.tickOffset % 2, 1);
  assert.equal(near.tickOffset % 2, 1);
});

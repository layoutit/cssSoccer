import {
  advanceCssoccerNativeRng,
  createCssoccerNativeRngState,
} from "./randomState.mjs";

const f32 = Math.fround;

const BALL_CPP_SHA256 = "7d043a49395d3f5bd039188b8100dd40142e075aebf2fbe8fd2517c5a9e9bd99";
const MATHS_CPP_SHA256 = "c7f61a26ce63ab439829f8c84a840f2c781704a44f2d06f149cf872013a96107";
const DEFINES_H_SHA256 = "c4859a60656d038093422a8f9084eb7b32f520125f21ce6ed65f1219a1524ee1";
const FOOTBALL_CPP_SHA256 = "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10";
const RULES_CPP_SHA256 = "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8";
const EXTERNS_H_SHA256 = "025a5317b52a158801bc63120dda75f5f1eaa47137e843d1b04fc146d6f540af";
const INTELL_CPP_SHA256 = "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad";
const DATA_H_SHA256 = "7dba31d4e9af11b4c7686faa1bf75802142579db99bd41b23d5bfcd065f0bb99";
const DISPLAY_CPP_SHA256 = "215bc1200c0af42eecb4c0bc73a3fdfb73e21f2eaab4681f2170d9c808f7fbca";
const BALL_OBJ_SHA256 = "f8dd68af5519f5fd70085de559d57418f24beea6dea9f9fb2cfd8e4627e76ec5";
const TEST_EXE_SHA256 = "9f7f37062957bfcb9ab3f84adc84714c981c879314dd18ea110d79e54a26e775";

export const CSSOCCER_BALL_CONSTANTS = Object.freeze({
  ballDiameter: f32(4),
  bounceDisplacement: f32(2.2),
  gravity: f32(0.6),
  airFriction: f32(0.986),
  groundFriction: f32(0.965),
  landingFriction: 0.1,
  groundStopThreshold: 0.25,
  swerveHoldFactor: 4,
  reboundFactor: 0.8,
  // The bound Watcom rebound vector resolves the compiled PI expansion at
  // full precision; using the truncated recovered-header token drifts angle.
  reboundPi: Math.PI,
  pitchLength: 1280,
  pitchWidth: 800,
  goalHeight: 34,
  goalDepth: 28,
  postWidth: 2,
  topPostY: 357,
  bottomPostY: 443,
  outOfPlayTicks: 25,
  maximumUsers: 20,
  kickoutAnimation: 98,
});

export const CSSOCCER_BALL_SOURCE = deepFreeze({
  files: [
    { file: "BALL.CPP", sha256: BALL_CPP_SHA256 },
    { file: "MATHS.CPP", sha256: MATHS_CPP_SHA256 },
    { file: "DEFINES.H", sha256: DEFINES_H_SHA256 },
    { file: "FOOTBALL.CPP", sha256: FOOTBALL_CPP_SHA256 },
    { file: "RULES.CPP", sha256: RULES_CPP_SHA256 },
    { file: "EXTERNS.H", sha256: EXTERNS_H_SHA256 },
    { file: "INTELL.CPP", sha256: INTELL_CPP_SHA256 },
    { file: "DATA.H", sha256: DATA_H_SHA256 },
    { file: "DISPLAY.CPP", sha256: DISPLAY_CPP_SHA256 },
    { file: "BALL.OBJ", sha256: BALL_OBJ_SHA256 },
    { file: "TEST.EXE", sha256: TEST_EXE_SHA256 },
  ],
  constantProducers: {
    integrationAndCollision: "BALL.CPP:196-352, 589-648, 728-860, 1081-1303",
    afterTouch: "BALL.CPP:111-156; INTELL.CPP:6127-6140",
    limboAndMatchOrder: "BALL.CPP:1507-1512, 1538-1611",
    limboKickoutAnimation: "DATA.H:133 MC_KICKOUT",
    maximumUsers: "DEFINES.H:48 MAX_USERS",
    randomize: "MATHS.CPP:31-36",
    tickRate: "DEFINES.H:47",
    gravity: "FOOTBALL.CPP:3452-3454",
    postLines: "DISPLAY.CPP:203-224",
    initializedData: "TEST.EXE object 3: bounce_dis, ball_diam, pitch, and goal globals",
    compiledMacros: "BALL.OBJ: AIR_FRICTION, GRND_FRICTION, SW_HOLD_FACTOR, REBOUND_FACTOR",
  },
  updateOrder: [
    "get_ball_speed",
    "move_ball",
    "grav_ball",
    "ball_friction",
    "ball_still",
    "is_it_a_goal",
    "publish_previous_position",
    "pitch_bounds",
  ],
});

export const CSSOCCER_NATIVE_BALL_FIELD_CONTRACT = deepFreeze([
  { fieldId: "ball.in_air", valueType: "i32" },
  { fieldId: "ball.in_goal", valueType: "u8" },
  { fieldId: "ball.out_of_play", valueType: "i32" },
  { fieldId: "ball.speed", valueType: "i32" },
  { fieldId: "ball.spin_state", valueType: "i32" },
  { fieldId: "ball.spin_xy", valueType: "f32" },
  { fieldId: "ball.spin_z", valueType: "f32" },
  { fieldId: "ball.still", valueType: "i32" },
  { fieldId: "ball.x", valueType: "f32" },
  { fieldId: "ball.x_displacement", valueType: "f32" },
  { fieldId: "ball.y", valueType: "f32" },
  { fieldId: "ball.y_displacement", valueType: "f32" },
  { fieldId: "ball.z", valueType: "f32" },
  { fieldId: "ball.z_displacement", valueType: "f32" },
  { fieldId: "rng.rand_seed", valueType: "i16" },
  { fieldId: "rng.seed", valueType: "i16" },
]);

const NATIVE_BALL_FIELD_READERS = Object.freeze({
  "ball.in_air": (state) => state.inAir,
  "ball.in_goal": (state) => state.inGoal,
  "ball.out_of_play": (state) => state.outOfPlay,
  "ball.speed": (state) => state.speed,
  "ball.spin_state": (state) => state.spin.nativeState,
  "ball.spin_xy": (state) => state.spin.xy,
  "ball.spin_z": (state) => state.spin.z,
  "ball.still": (state) => state.still,
  "ball.x": (state) => state.position.x,
  "ball.x_displacement": (state) => state.displacement.x,
  "ball.y": (state) => state.position.y,
  "ball.y_displacement": (state) => state.displacement.y,
  "ball.z": (state) => state.position.z,
  "ball.z_displacement": (state) => state.displacement.z,
  "rng.rand_seed": (state) => state.rng.randSeed,
  "rng.seed": (state) => state.rng.seed,
});

const DEFAULT_POSITION = Object.freeze({
  x: f32(CSSOCCER_BALL_CONSTANTS.pitchLength / 2),
  y: f32(CSSOCCER_BALL_CONSTANTS.pitchWidth / 2),
  z: f32(CSSOCCER_BALL_CONSTANTS.ballDiameter / 2),
});

const DEFAULT_DISPLACEMENT = Object.freeze({ x: f32(0), y: f32(0), z: f32(0) });
const DEFAULT_SPIN = Object.freeze({
  swerve: 0,
  count: 0,
  nativeState: 0,
  fullXY: f32(0),
  fullZ: f32(0),
  xy: f32(0),
  z: f32(0),
});
const DEFAULT_AFTER_TOUCH = Object.freeze({
  user: 0,
  shotDirection: Object.freeze({ x: f32(0), y: f32(0) }),
});

export function createBallState(input = {}) {
  assertPlainObject(input, "ball state input");
  assertOnlyKeys(input, [
    "tick",
    "position",
    "previousPosition",
    "displacement",
    "outPosition",
    "inAir",
    "inGoal",
    "outOfPlay",
    "still",
    "speed",
    "spin",
    "rng",
    "afterTouch",
  ], "ball state input");
  const position = createVector(input.position ?? DEFAULT_POSITION, "position");
  const previousPosition = createVector(
    input.previousPosition ?? position,
    "previousPosition",
  );
  const displacement = createVector(
    input.displacement ?? DEFAULT_DISPLACEMENT,
    "displacement",
  );
  const outPosition = input.outPosition === null || input.outPosition === undefined
    ? null
    : createVector(input.outPosition, "outPosition");
  const spin = createSpin(input.spin ?? DEFAULT_SPIN);
  const rng = createCssoccerNativeRngState(input.rng);
  const afterTouch = createAfterTouch(input.afterTouch ?? DEFAULT_AFTER_TOUCH);
  const tick = input.tick ?? 0;
  const speed = input.speed ?? 0;
  const inAir = input.inAir ?? 0;
  const inGoal = input.inGoal ?? 0;
  const outOfPlay = input.outOfPlay ?? 0;
  const still = input.still ?? 1;

  assertSafeNonNegativeInteger(tick, "tick");
  assertInt32(speed, "speed");
  if (speed < 0) throw new RangeError("speed must be non-negative.");
  assertFlag(inAir, "inAir");
  assertFlag(inGoal, "inGoal");
  assertInt32(outOfPlay, "outOfPlay");
  if (outOfPlay < 0) throw new RangeError("outOfPlay must be non-negative.");
  assertFlag(still, "still");

  return Object.freeze({
    tick,
    position,
    previousPosition,
    displacement,
    outPosition,
    inAir,
    inGoal,
    outOfPlay,
    still,
    speed,
    spin,
    rng,
    afterTouch,
  });
}

/**
 * Advance one free-ball source tick. Post and crossbar rebounds advance the
 * exact Watcom 10.5 C-library generator bound by TEST.MAP; MATHS.CPP owns
 * `rand_seed = rand()` followed by `seed = rand_seed & 127`.
 */
export function stepBallState(
  state,
  { windEnabled = false, afterTouchInput } = {},
) {
  const current = createBallState(state);
  if (windEnabled !== false) {
    throw new Error("The canonical cssoccer fixture has wind disabled.");
  }
  if (afterTouchInput !== undefined) {
    createPlanarVector(afterTouchInput, "afterTouchInput");
  }
  if (afterTouchInput !== undefined && current.afterTouch.user === 0) {
    throw new Error("afterTouchInput is unsupported while after touch is inactive.");
  }

  const draft = mutableState(current);
  const events = [];
  const enteredOutOfPlay = current.outOfPlay !== 0;

  // BALL.CPP process_ball -> get_ball_speed occurs before ball_trajectory.
  draft.speed = sourceBallSpeed(draft.displacement);
  moveBall(draft, events, afterTouchInput);
  applyGravity(draft);
  applyFriction(draft);
  draft.still = draft.displacement.x !== 0 || draft.displacement.y !== 0 ? 0 : 1;

  if (current.inGoal === 0) {
    resolveOutsideGoalCollision(draft, events, !enteredOutOfPlay);
  } else {
    resolveInsideGoalCollision(draft, events);
  }

  // BALL.CPP ball_collision publishes the possibly post-adjusted position.
  draft.previousPosition = { ...draft.position };

  // A goal makes match-state resolution authoritative; do not also emit out.
  if (!enteredOutOfPlay && draft.inGoal === 0) {
    resolvePitchBounds(draft, events);
  }

  draft.tick += 1;
  return Object.freeze({
    state: createBallState(draft),
    events: deepFreeze(events),
  });
}

/**
 * Publish only fields owned by this reducer, using the exact retained native
 * field ids, scalar types, and big-endian numeric-bit notation.
 */
export function projectBallNativeFields(state) {
  const current = createBallState(state);
  return deepFreeze(CSSOCCER_NATIVE_BALL_FIELD_CONTRACT.map((field) => {
    const value = NATIVE_BALL_FIELD_READERS[field.fieldId](current);
    assertNativeValue(value, field.valueType, field.fieldId);
    return {
      schema: "cssoccer-parity-stream@1",
      recordType: "sample",
      tick: current.tick,
      phase: "post_tick",
      fieldId: field.fieldId,
      valueType: field.valueType,
      value,
      numericBits: nativeNumericBits(value, field.valueType),
    };
  }));
}

function moveBall(draft, events, afterTouchInput) {
  draft.position.x = f32(draft.position.x + draft.displacement.x);
  draft.position.y = f32(draft.position.y + draft.displacement.y);
  if (draft.inAir === 0) return;

  draft.position.z = f32(draft.position.z + draft.displacement.z);
  const groundZ = f32(CSSOCCER_BALL_CONSTANTS.ballDiameter / 2);
  if (draft.position.z < groundZ) {
    draft.position.z = groundZ;
    draft.displacement.z = f32(-draft.displacement.z);
    draft.displacement.z = f32(
      draft.displacement.z - CSSOCCER_BALL_CONSTANTS.bounceDisplacement,
    );
    draft.displacement.x = f32(
      draft.displacement.x
        - (CSSOCCER_BALL_CONSTANTS.landingFriction * draft.displacement.x),
    );
    draft.displacement.y = f32(
      draft.displacement.y
        - (CSSOCCER_BALL_CONSTANTS.landingFriction * draft.displacement.y),
    );

    if (draft.displacement.z < 0) {
      draft.displacement.z = f32(0);
      draft.inAir = 0;
    } else {
      events.push({
        type: "bounce",
        strength: Math.abs(draft.displacement.z) > 7 ? "hard" : "soft",
        position: { ...draft.position },
      });
    }
  }

  if (draft.inAir !== 0) applySpin(draft, events, afterTouchInput);
}

function applyGravity(draft) {
  if (draft.inAir !== 0) {
    draft.displacement.z = f32(
      draft.displacement.z - CSSOCCER_BALL_CONSTANTS.gravity,
    );
  }
}

function applyFriction(draft) {
  const factor = draft.inAir !== 0
    ? CSSOCCER_BALL_CONSTANTS.airFriction
    : CSSOCCER_BALL_CONSTANTS.groundFriction;
  draft.displacement.x = f32(factor * draft.displacement.x);
  draft.displacement.y = f32(factor * draft.displacement.y);

  if (draft.inAir !== 0) return;
  const threshold = CSSOCCER_BALL_CONSTANTS.groundStopThreshold;
  if (draft.displacement.x > -threshold && draft.displacement.x < threshold) {
    draft.displacement.x = f32(0);
  }
  if (draft.displacement.y > -threshold && draft.displacement.y < threshold) {
    draft.displacement.y = f32(0);
  }
}

function applySpin(draft, events, afterTouchInput) {
  if (draft.spin.swerve === 0) {
    if (draft.afterTouch.user !== 0) {
      applyAfterTouch(draft, events, afterTouchInput);
    }
    return;
  }
  const horizontalDistance = sourceDistance(draft.displacement.x, draft.displacement.y);
  if (horizontalDistance < 1) {
    stopSpin(draft.spin);
    return;
  }

  draft.spin.count += 1;
  assertInt32(draft.spin.count, "spin.count");
  const hold = CSSOCCER_BALL_CONSTANTS.swerveHoldFactor;
  const heldFactor = hold / (hold + draft.spin.count);
  draft.spin.z = f32(-(draft.spin.fullZ * heldFactor));
  const xy = f32(draft.spin.fullXY * heldFactor);
  draft.spin.xy = draft.spin.swerve < 0 ? f32(-xy) : xy;

  const x = f32(draft.displacement.x / horizontalDistance);
  const y = f32(draft.displacement.y / horizontalDistance);
  const fullDistance = sourceDistance(draft.displacement.z, horizontalDistance);
  const z = f32(draft.displacement.z / fullDistance);
  const normalizedHorizontal = f32(horizontalDistance / fullDistance);
  const xyCos = Math.cos(draft.spin.xy);
  const xySin = Math.sin(draft.spin.xy);
  const zCos = Math.cos(draft.spin.z);
  const zSin = Math.sin(draft.spin.z);

  draft.displacement.x = f32(
    horizontalDistance * ((x * xyCos) - (y * xySin)),
  );
  draft.displacement.y = f32(
    horizontalDistance * ((y * xyCos) + (x * xySin)),
  );
  draft.displacement.z = f32(
    horizontalDistance * ((z * zCos) + (normalizedHorizontal * zSin)),
  );
}

function applyAfterTouch(draft, events, afterTouchInput) {
  if (afterTouchInput === undefined) {
    throw new Error("Active source after touch requires the current prepared user direction.");
  }
  const input = createPlanarVector(afterTouchInput, "afterTouchInput");
  const horizontalDistance = sourceDistance(draft.displacement.x, draft.displacement.y);
  const x = f32(draft.displacement.x / horizontalDistance);
  const y = f32(draft.displacement.y / horizontalDistance);
  const fullDistance = sourceDistance(draft.displacement.z, horizontalDistance);
  const z = f32(draft.displacement.z / fullDistance);
  const normalizedHorizontal = f32(horizontalDistance / fullDistance);

  draft.spin.count += 1;
  assertInt32(draft.spin.count, "spin.count");
  const heldFactor = CSSOCCER_BALL_CONSTANTS.swerveHoldFactor
    / (CSSOCCER_BALL_CONSTANTS.swerveHoldFactor + draft.spin.count);
  const xys = f32(
    (input.x * draft.afterTouch.shotDirection.y)
      - (input.y * draft.afterTouch.shotDirection.x),
  );
  const zs = f32(
    (input.x * draft.afterTouch.shotDirection.x)
      + (input.y * draft.afterTouch.shotDirection.y),
  );
  draft.spin.xy = f32(-(xys * draft.spin.fullXY * heldFactor));
  draft.spin.z = f32(-(zs * draft.spin.fullZ * heldFactor));

  const xyCos = Math.cos(draft.spin.xy);
  const xySin = Math.sin(draft.spin.xy);
  const zCos = Math.cos(draft.spin.z);
  const zSin = Math.sin(draft.spin.z);
  draft.displacement.x = f32(
    horizontalDistance * ((x * xyCos) - (y * xySin)),
  );
  draft.displacement.y = f32(
    horizontalDistance * ((y * xyCos) + (x * xySin)),
  );
  draft.displacement.z = f32(
    fullDistance * ((z * zCos) + (normalizedHorizontal * zSin)),
  );
  events.push({
    type: "after-touch",
    user: draft.afterTouch.user,
    input,
    spin: { xy: draft.spin.xy, z: draft.spin.z },
  });
}

function stopSpin(spin) {
  spin.swerve = 0;
  spin.fullZ = f32(0);
  spin.fullXY = f32(0);
  spin.z = f32(0);
  spin.xy = f32(0);
}

function resolveOutsideGoalCollision(draft, events, goalsEnabled) {
  const crossing = goalLineCrossing(draft.previousPosition, draft.position);
  if (crossing === null) {
    if (
      draft.position.x < 0
      || draft.position.x > CSSOCCER_BALL_CONSTANTS.pitchLength
    ) {
      resolveOutsideNetAfterCrossing(draft, events);
    }
    return;
  }

  const { goalHeight, postWidth, topPostY, bottomPostY } = CSSOCCER_BALL_CONSTANTS;
  if (crossing.z < goalHeight && crossing.y > topPostY && crossing.y < bottomPostY) {
    if (goalsEnabled) {
      draft.inGoal = 1;
      events.push({
        type: "goal",
        goalLine: crossing.goalLine,
        crossing: { x: crossing.x, y: crossing.y, z: crossing.z },
        requiresMatchResolution: true,
      });
    }
    return;
  }

  if (
    crossing.z >= goalHeight
    && crossing.z < goalHeight + postWidth
    && crossing.y > topPostY - postWidth
    && crossing.y < bottomPostY + postWidth
  ) {
    reboundCrossbar(draft);
    placeInsideGoalLine(draft, crossing.goalLine);
    resetShotAfterFrameCollision(draft);
    events.push({
      type: "crossbar",
      goalLine: crossing.goalLine,
      crossing: { x: crossing.x, y: crossing.y, z: crossing.z },
    });
    return;
  }

  const topPost = crossing.z < goalHeight
    && crossing.y > topPostY - postWidth
    && crossing.y <= topPostY;
  const bottomPost = crossing.z < goalHeight
    && crossing.y < bottomPostY + postWidth
    && crossing.y >= bottomPostY;
  if (!topPost && !bottomPost) {
    resolveOutsideSideNet(draft, events);
    return;
  }

  reboundPost(draft);
  placeInsideGoalLine(draft, crossing.goalLine);
  resetShotAfterFrameCollision(draft);
  events.push({
    type: "post",
    post: topPost ? "top" : "bottom",
    goalLine: crossing.goalLine,
    crossing: { x: crossing.x, y: crossing.y, z: crossing.z },
  });
}

function resolveOutsideNetAfterCrossing(draft, events) {
  const { goalHeight } = CSSOCCER_BALL_CONSTANTS;
  if (draft.position.z < goalHeight && draft.previousPosition.z >= goalHeight) {
    const crossing = interpolatePlane(
      draft.previousPosition,
      draft.position,
      "z",
      goalHeight,
    );
    if (insideGoalDepth(crossing.x) && insideGoalMouthY(crossing.y)) {
      hitTopNet(draft);
      events.push({ type: "outside-net", surface: "top" });
      return;
    }
  }
  resolveOutsideSideNet(draft, events);
}

function resolveOutsideSideNet(draft, events) {
  const { topPostY, bottomPostY, goalHeight } = CSSOCCER_BALL_CONSTANTS;
  const top = interpolatePlane(
    draft.previousPosition,
    draft.position,
    "y",
    topPostY,
  );
  if (insideGoalDepth(top.x) && top.z < goalHeight) {
    hitOutsideSideNet(draft, topPostY);
    events.push({ type: "outside-net", surface: "top-side" });
    return;
  }
  const bottom = interpolatePlane(
    draft.previousPosition,
    draft.position,
    "y",
    bottomPostY,
  );
  if (insideGoalDepth(bottom.x) && bottom.z < goalHeight) {
    hitOutsideSideNet(draft, bottomPostY);
    events.push({ type: "outside-net", surface: "bottom-side" });
  }
}

function resolveInsideGoalCollision(draft, events) {
  const {
    goalDepth,
    goalHeight,
    pitchLength,
    topPostY,
    bottomPostY,
  } = CSSOCCER_BALL_CONSTANTS;
  if (draft.position.x < 0) {
    if (draft.position.x < -goalDepth) {
      hitInsideBackNet(draft, "left");
      events.push({ type: "inside-net", surface: "back", goalLine: "left" });
    }
    if (draft.position.y < topPostY) {
      hitInsideSideNet(draft, "top");
      events.push({ type: "inside-net", surface: "top-side", goalLine: "left" });
    }
    if (draft.position.y > bottomPostY) {
      hitInsideSideNet(draft, "bottom");
      events.push({ type: "inside-net", surface: "bottom-side", goalLine: "left" });
    }
    if (draft.position.z > goalHeight) {
      hitInsideTopNet(draft);
      events.push({ type: "inside-net", surface: "top", goalLine: "left" });
    }
    return;
  }

  if (draft.position.x > pitchLength + goalDepth) {
    hitInsideBackNet(draft, "right");
    events.push({ type: "inside-net", surface: "back", goalLine: "right" });
  }
  if (draft.position.y < topPostY) {
    hitInsideSideNet(draft, "top");
    events.push({ type: "inside-net", surface: "top-side", goalLine: "right" });
  }
  if (draft.position.y > bottomPostY) {
    hitInsideSideNet(draft, "bottom");
    events.push({ type: "inside-net", surface: "bottom-side", goalLine: "right" });
  }
  if (draft.position.z > goalHeight) {
    hitInsideTopNet(draft);
    events.push({ type: "inside-net", surface: "top", goalLine: "right" });
  }
}

function goalLineCrossing(previous, position) {
  const { pitchLength } = CSSOCCER_BALL_CONSTANTS;
  if (position.x < 0 && previous.x >= 0) {
    return interpolateGoalLine(previous, position, 0, "left");
  }
  if (position.x > pitchLength && previous.x <= pitchLength) {
    return interpolateGoalLine(previous, position, pitchLength, "right");
  }
  return null;
}

function interpolateGoalLine(previous, position, lineX, goalLine) {
  const dx = f32(position.x - previous.x);
  const dy = f32(position.y - previous.y);
  const dz = f32(position.z - previous.z);
  const factor = f32((lineX - previous.x) / dx);
  return {
    goalLine,
    x: f32(lineX),
    y: f32(previous.y + (factor * dy)),
    z: f32(previous.z + (factor * dz)),
  };
}

function interpolatePlane(previous, position, axis, line) {
  const delta = f32(position[axis] - previous[axis]);
  const factor = f32((line - previous[axis]) / delta);
  return {
    x: f32(previous.x + (factor * f32(position.x - previous.x))),
    y: f32(previous.y + (factor * f32(position.y - previous.y))),
    z: f32(previous.z + (factor * f32(position.z - previous.z))),
  };
}

function insideGoalDepth(x) {
  const { goalDepth, pitchLength } = CSSOCCER_BALL_CONSTANTS;
  return (x > -goalDepth && x < 0)
    || (x < pitchLength + goalDepth && x > pitchLength);
}

function insideGoalMouthY(y) {
  const { topPostY, bottomPostY } = CSSOCCER_BALL_CONSTANTS;
  return y > topPostY && y < bottomPostY;
}

function stopSwerveForNet(draft) {
  if (draft.spin.swerve !== 0) stopSpin(draft.spin);
}

function hitOutsideSideNet(draft, sideY) {
  stopSwerveForNet(draft);
  draft.displacement.z = f32(draft.displacement.z / 2);
  draft.displacement.x = f32(draft.displacement.x / 2);
  draft.displacement.y = f32(-draft.displacement.y / 2);
  draft.position.y = f32(sideY);
}

function hitTopNet(draft) {
  stopSwerveForNet(draft);
  draft.position.z = f32(CSSOCCER_BALL_CONSTANTS.goalHeight + 1);
  draft.displacement.z = f32(0);
  draft.displacement.x = f32(
    (draft.displacement.x < 0
      ? draft.displacement.x - 2
      : draft.displacement.x + 2) / 2,
  );
  draft.displacement.y = f32(draft.displacement.y / 2);
}

function hitInsideBackNet(draft, goalLine) {
  stopSwerveForNet(draft);
  draft.displacement.z = f32(draft.displacement.z / 2);
  draft.displacement.x = f32(-draft.displacement.x / 2);
  draft.displacement.y = f32(draft.displacement.y / 2);
  draft.position.x = f32(
    goalLine === "left"
      ? 1 - CSSOCCER_BALL_CONSTANTS.goalDepth
      : CSSOCCER_BALL_CONSTANTS.pitchLength
        + CSSOCCER_BALL_CONSTANTS.goalDepth - 1,
  );
}

function hitInsideTopNet(draft) {
  stopSwerveForNet(draft);
  draft.position.z = f32(CSSOCCER_BALL_CONSTANTS.goalHeight - 1);
  draft.displacement.z = f32(0);
  draft.displacement.x = f32(draft.displacement.x / 2);
  draft.displacement.y = f32(draft.displacement.y / 2);
}

function hitInsideSideNet(draft, side) {
  stopSwerveForNet(draft);
  draft.displacement.z = f32(draft.displacement.z / 2);
  draft.displacement.x = f32(draft.displacement.x / 2);
  draft.displacement.y = f32(-draft.displacement.y / 2);
  draft.position.y = f32(
    side === "top"
      ? CSSOCCER_BALL_CONSTANTS.topPostY + 1
      : CSSOCCER_BALL_CONSTANTS.bottomPostY - 1,
  );
}

function reboundPost(draft) {
  const distance = sourceDistance(draft.displacement.x, draft.displacement.y);
  const x = f32(draft.displacement.x / distance);
  const y = f32(draft.displacement.y / distance);
  const angle = reboundAngle(draft);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const rebound = CSSOCCER_BALL_CONSTANTS.reboundFactor;
  draft.displacement.x = f32(((x * cosine) - (y * sine)) * distance * rebound);
  draft.displacement.y = f32(((y * cosine) + (x * sine)) * distance * rebound);
}

function reboundCrossbar(draft) {
  const horizontalDistance = sourceDistance(draft.displacement.x, draft.displacement.y);
  const distance = sourceDistance(horizontalDistance, draft.displacement.z);
  const z = f32(draft.displacement.z / distance);
  const angle = reboundAngle(draft);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const rebound = CSSOCCER_BALL_CONSTANTS.reboundFactor;
  draft.displacement.z = f32(
    ((z * cosine) - ((horizontalDistance / distance) * sine)) * distance * rebound,
  );
  const nextHorizontalDistance = Math.abs(
    (((horizontalDistance / distance) * cosine) + (z * sine)) * distance * rebound,
  );
  draft.displacement.x = f32(
    -draft.displacement.x * (nextHorizontalDistance / horizontalDistance),
  );
  draft.displacement.y = f32(
    draft.displacement.y * (nextHorizontalDistance / horizontalDistance),
  );
}

function reboundAngle(draft) {
  let angle = f32(draft.rng.seed);
  applyRandomize(draft);
  angle = f32(angle + f32(draft.rng.seed));
  applyRandomize(draft);
  return f32(
    (angle * CSSOCCER_BALL_CONSTANTS.reboundPi) / 128,
  );
}

/** BALL.CPP hit_goal_post/hit_cross_bar -> reset_shot. */
function resetShotAfterFrameCollision(draft) {
  // reset_shot disables future swerve/after-touch processing without clearing
  // the last published ball_xyspin and ball_zspin values.
  draft.spin.swerve = 0;
  draft.afterTouch = {
    user: 0,
    shotDirection: { x: f32(0), y: f32(0) },
  };
}

function applyRandomize(draft) {
  draft.rng = { ...advanceCssoccerNativeRng(draft.rng) };
}

function placeInsideGoalLine(draft, goalLine) {
  draft.position.x = f32(
    goalLine === "right" ? CSSOCCER_BALL_CONSTANTS.pitchLength - 1 : 1,
  );
}

function resolvePitchBounds(draft, events) {
  const { pitchLength, pitchWidth, outOfPlayTicks } = CSSOCCER_BALL_CONSTANTS;
  let axis = null;
  let boundary = null;
  let line = null;
  if (draft.position.x < 0) {
    axis = "x";
    boundary = "minimum";
    line = 0;
  } else if (draft.position.x >= pitchLength) {
    axis = "x";
    boundary = "maximum";
    line = pitchLength;
  } else if (draft.position.y < 0) {
    axis = "y";
    boundary = "minimum";
    line = 0;
  } else if (draft.position.y >= pitchWidth) {
    axis = "y";
    boundary = "maximum";
    line = pitchWidth;
  }
  if (axis === null) return;

  draft.outPosition = { ...draft.position };
  draft.outOfPlay = outOfPlayTicks;
  events.push({
    type: "out-of-play",
    axis,
    boundary,
    line,
    position: { ...draft.position },
    requiresBoundsRule: true,
  });
}

function sourceBallSpeed(displacement) {
  const total = f32(
    Math.abs(displacement.x) + Math.abs(displacement.y) + Math.abs(displacement.z),
  );
  return Math.trunc(Math.sqrt(total));
}

function sourceDistance(x, y) {
  const result = f32(Math.sqrt((x * x) + (y * y)));
  return result > 0.1 ? result : f32(0.1);
}

function mutableState(state) {
  return {
    ...state,
    position: { ...state.position },
    previousPosition: { ...state.previousPosition },
    displacement: { ...state.displacement },
    outPosition: state.outPosition === null ? null : { ...state.outPosition },
    spin: { ...state.spin },
    rng: { ...state.rng },
    afterTouch: {
      ...state.afterTouch,
      shotDirection: { ...state.afterTouch.shotDirection },
    },
  };
}

function createVector(input, label) {
  assertPlainObject(input, label);
  assertOnlyKeys(input, ["x", "y", "z"], label);
  return Object.freeze({
    x: sourceFloat(input.x, `${label}.x`),
    y: sourceFloat(input.y, `${label}.y`),
    z: sourceFloat(input.z, `${label}.z`),
  });
}

function createSpin(input) {
  assertPlainObject(input, "spin");
  assertOnlyKeys(
    input,
    ["swerve", "count", "nativeState", "fullXY", "fullZ", "xy", "z"],
    "spin",
  );
  const spin = {
    swerve: input.swerve ?? 0,
    count: input.count ?? 0,
    nativeState: input.nativeState ?? 0,
    fullXY: sourceFloat(input.fullXY ?? 0, "spin.fullXY"),
    fullZ: sourceFloat(input.fullZ ?? 0, "spin.fullZ"),
    xy: sourceFloat(input.xy ?? 0, "spin.xy"),
    z: sourceFloat(input.z ?? 0, "spin.z"),
  };
  assertInt32(spin.swerve, "spin.swerve");
  assertInt32(spin.count, "spin.count");
  assertInt32(spin.nativeState, "spin.nativeState");
  if (spin.count < 0) throw new RangeError("spin.count must be non-negative.");
  return Object.freeze(spin);
}

function createAfterTouch(input) {
  assertPlainObject(input, "afterTouch");
  assertOnlyKeys(input, ["user", "shotDirection"], "afterTouch");
  const user = input.user ?? 0;
  assertInt32(user, "afterTouch.user");
  if (user < 0 || user > CSSOCCER_BALL_CONSTANTS.maximumUsers) {
    throw new RangeError(
      `afterTouch.user must be in the source 0..${CSSOCCER_BALL_CONSTANTS.maximumUsers} range.`,
    );
  }
  if (user !== 0 && input.shotDirection === undefined) {
    throw new Error("Active after touch requires the source shot direction.");
  }
  const shotDirection = createPlanarVector(
    input.shotDirection ?? DEFAULT_AFTER_TOUCH.shotDirection,
    "afterTouch.shotDirection",
  );
  if (user === 0 && (shotDirection.x !== 0 || shotDirection.y !== 0)) {
    throw new Error("Inactive after touch cannot retain a shot direction.");
  }
  return Object.freeze({ user, shotDirection });
}

function createPlanarVector(input, label) {
  assertPlainObject(input, label);
  assertOnlyKeys(input, ["x", "y"], label);
  return Object.freeze({
    x: sourceFloat(input.x, `${label}.x`),
    y: sourceFloat(input.y, `${label}.y`),
  });
}

function sourceFloat(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return f32(value);
}

function assertFlag(value, label) {
  if (value !== 0 && value !== 1) throw new TypeError(`${label} must be 0 or 1.`);
}

function assertNativeValue(value, valueType, label) {
  if (valueType === "f32") {
    if (!Number.isFinite(value) || !Object.is(value, f32(value))) {
      throw new TypeError(`${label} must be an exact finite float32 value.`);
    }
    return;
  }
  if (valueType === "u8") {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
      throw new TypeError(`${label} must be an unsigned 8-bit integer.`);
    }
    return;
  }
  if (valueType === "i16") {
    assertInt16(value, label);
    return;
  }
  if (valueType === "i32") {
    assertInt32(value, label);
    return;
  }
  throw new Error(`Unsupported native value type ${valueType}.`);
}

function nativeNumericBits(value, valueType) {
  const byteLength = ({ f32: 4, i32: 4, i16: 2, u8: 1 })[valueType];
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  if (valueType === "f32") view.setFloat32(0, value, false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else view.setUint8(0, value);
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function assertInt16(value, label) {
  if (!Number.isInteger(value) || value < -0x8000 || value > 0x7fff) {
    throw new TypeError(`${label} must be a signed 16-bit integer.`);
  }
}

function assertInt32(value, label) {
  if (!Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff) {
    throw new TypeError(`${label} must be a signed 32-bit integer.`);
  }
}

function assertSafeNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
}

function assertPlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function assertOnlyKeys(value, keys, label) {
  const allowed = new Set(keys);
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    throw new Error(`${label} has unsupported fields: ${unsupported.join(", ")}.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

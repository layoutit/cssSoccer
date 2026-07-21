export const CSSOCCER_MOTION_SOURCE = deepFreeze({
  files: [
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      functions: {
        fullSpeed: "full_spd lines 32-42",
        actualSpeed: "actual_spd lines 49-83",
        angleBetween: "angle_to_xy lines 1748-1771",
        positionUpdate: "go_toward_target lines 2358-2362",
        forwardDisplacement: "go_forward lines 2367-2416",
        turnFacing: "new_dir lines 4554-4615",
      },
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      functions: {
        getThereTime: "get_there_time lines 35-180",
        facingDirection: "get_dir lines 4222-4300",
      },
    },
    {
      file: "MATHS.CPP",
      sha256: "c7f61a26ce63ab439829f8c84a840f2c781704a44f2d06f149cf872013a96107",
      functions: {
        distance: "calc_dist lines 65-73",
      },
    },
  ],
  requiredBindings: [
    "pitchLength",
    "keeperNativePlayers",
    "celebrationSpeed when speedIntent is celebration",
    "maxTurnRadians",
  ],
  unsupportedHere: [
    "unmapped native intention/action ids",
    "side-step target/time displacement construction",
    "go_stop release, work accounting, and animation transitions",
    "action-specific vertical motion, deceleration, or collision response",
    "action choice, contacts, rules, lifecycle, rendering, or retained-state lookup",
  ],
});

export const CSSOCCER_SPEED_INTENT = Object.freeze({
  normal: "normal",
  intercept: "intercept",
  celebration: "celebration",
});

const SPEED_INTENTS = new Set(Object.values(CSSOCCER_SPEED_INTENT));
const F32 = Math.fround;

export class UnsupportedMotionSemanticsError extends Error {
  constructor(boundary, message) {
    super(message);
    this.name = "UnsupportedMotionSemanticsError";
    this.code = "CSSOCCER_UNSUPPORTED_MOTION_SEMANTICS";
    this.boundary = boundary;
  }
}

/**
 * Source-equivalent ACTIONS.CPP actual_spd branch selection.
 *
 * Constants that are macros/globals in the native build remain explicit here.
 * The function deliberately accepts a mapped speed intent rather than guessing
 * the meaning of an arbitrary native int_move value.
 */
export function actualPlayerSpeed(input) {
  requirePlainObject(input, "actual speed input");
  requireOnlyKeys(input, [
    "pitchLength",
    "teamRate",
    "speedIntent",
    "intentionCount",
    "sideStep",
    "nativePlayer",
    "ballPossession",
    "ballInHands",
    "keeperNativePlayers",
    "userControlIndex",
    "burstTimer",
    "celebrationSpeed",
  ], "actual speed input");

  requirePositiveSafeInteger(input.pitchLength, "actual speed pitchLength");
  requireSafeInteger(input.teamRate, "actual speed teamRate");
  requireMappedSpeedIntent(input.speedIntent);
  requireSafeInteger(input.intentionCount, "actual speed intentionCount");
  requireBoolean(input.sideStep, "actual speed sideStep");
  requireIntegerRange(input.nativePlayer, 1, 22, "actual speed nativePlayer");
  requireIntegerRange(input.ballPossession, 0, 22, "actual speed ballPossession");
  requireBoolean(input.ballInHands, "actual speed ballInHands");
  const keeperNativePlayers = requireKeeperNativePlayers(input.keeperNativePlayers);
  requireNonNegativeSafeInteger(input.userControlIndex, "actual speed userControlIndex");
  requireSafeInteger(input.burstTimer, "actual speed burstTimer");

  if (input.speedIntent === CSSOCCER_SPEED_INTENT.celebration) {
    requireF32(input.celebrationSpeed, "actual speed celebrationSpeed");
    return input.celebrationSpeed;
  }

  const rateScale = F32(F32(F32(input.teamRate) / F32(64)) * F32(4));
  let seconds;

  if (
    input.speedIntent === CSSOCCER_SPEED_INTENT.intercept
    && input.intentionCount !== 0
  ) {
    seconds = 18;
  } else if (input.sideStep) {
    seconds = 24;
  } else if (input.ballPossession === input.nativePlayer) {
    seconds = input.ballInHands && keeperNativePlayers.includes(input.nativePlayer)
      ? 28
      : 20;
  } else if (input.userControlIndex !== 0 && input.burstTimer > 0) {
    const burstScale = F32(F32(input.burstTimer) / F32(5));
    seconds = 18 - burstScale;
  } else {
    seconds = 18;
  }

  // The source literals 18./20./24./28. promote the final expression to
  // double; assignment to local float `a` is the observable f32 boundary.
  return F32(F32(input.pitchLength) / ((seconds - rateScale) * 20));
}

/** Source-equivalent ACTIONS.CPP full_spd for ordinary travel planning. */
export function sourceFullPlayerSpeed(input) {
  requirePlainObject(input, "full speed input");
  requireOnlyKeys(input, [
    "pitchLength",
    "teamRate",
    "celebrating",
    "celebrationSpeed",
  ], "full speed input");
  requirePositiveSafeInteger(input.pitchLength, "full speed pitchLength");
  requireSafeInteger(input.teamRate, "full speed teamRate");
  requireBoolean(input.celebrating, "full speed celebrating");

  if (input.celebrating) {
    requireF32(input.celebrationSpeed, "full speed celebrationSpeed");
    return input.celebrationSpeed;
  }

  const rateScale = F32(F32(F32(input.teamRate) / F32(64)) * F32(4));
  return F32(F32(input.pitchLength) / ((18 - rateScale) * 20));
}

/**
 * Source-equivalent INTELL.CPP get_there_time travel estimate.
 *
 * The caller maps the current action to `canRotateAndRun`; this primitive does
 * not guess native action ids. Optional `mustFace` represents the source user
 * direction constraint and remains null for neutral input.
 */
export function sourceGetThereTime(input) {
  requirePlainObject(input, "get-there-time input");
  requireOnlyKeys(input, [
    "position",
    "target",
    "facing",
    "speed",
    "maxTurn2Radians",
    "imThereDistance",
    "canRotateAndRun",
    "mustFace",
  ], "get-there-time input");
  const position = requireF32Vector(input.position, "get-there-time position");
  const target = requireF32Vector(input.target, "get-there-time target");
  const facing = requireF32Vector(input.facing, "get-there-time facing");
  requirePositiveF32(input.speed, "get-there-time speed");
  requirePositiveF32(input.maxTurn2Radians, "get-there-time maxTurn2Radians");
  requirePositiveF32(input.imThereDistance, "get-there-time imThereDistance");
  requireBoolean(input.canRotateAndRun, "get-there-time canRotateAndRun");
  const mustFace = input.mustFace === null
    ? null
    : requireF32Vector(input.mustFace, "get-there-time mustFace");

  let x = F32(target.x - position.x);
  let y = F32(target.y - position.y);
  const sourceOffset = { x, y };
  let facingX = facing.x;
  let facingY = facing.y;
  const maxTurn = input.maxTurn2Radians;
  const cosineMaximum = F32(Math.cos(maxTurn));
  let straightTicks = 2000;
  let straightFaceTicks = 0;

  if (input.canRotateAndRun) {
    const alignment = sourceAngleCosine({
      target: sourceOffset,
      facing,
    });
    const turnTicks = Math.trunc(Math.abs(Math.acos(alignment) / maxTurn));
    const distance = sourceDistance2d(sourceOffset);
    // The retained Watcom routine stores d/rate and the accumulated float
    // expression before __CHP converts it to the integer countdown.
    const straightTravel = F32(distance / input.speed);
    straightTicks = Math.trunc(F32(
      F32(turnTicks) + straightTravel + 1,
    ));
    if (mustFace !== null) {
      straightFaceTicks = Math.trunc(Math.abs(Math.acos(sourceAngleCosine({
        target: mustFace,
        facing: normalizeSourceVector(sourceOffset),
      })) / maxTurn)) + 1;
    }
  }

  let alignment = sourceAngleCosine({ target: { x, y }, facing });
  let lastAlignment = alignment;
  let distance = sourceDistance2d({ x, y });
  let turningTicks = 0;
  for (let index = 0; index < 50; index += 1) {
    if (distance < input.imThereDistance) break;
    turningTicks += 1;

    const turnSpeed = F32((1 + alignment) / 2);
    x = F32(x - (facingX * input.speed * turnSpeed));
    y = F32(y - (facingY * input.speed * turnSpeed));
    distance = sourceDistance2d({ x, y });

    const oldX = facingX;
    const oldY = facingY;
    if (alignment < cosineMaximum) {
      let appliedTurn = maxTurn;
      if ((x * oldY) / distance > (y * oldX) / distance) {
        appliedTurn = F32(-appliedTurn);
      }
      facingX = F32(
        (oldX * Math.cos(appliedTurn)) - (oldY * Math.sin(appliedTurn)),
      );
      facingY = F32(
        (oldY * Math.cos(appliedTurn)) + (oldX * Math.sin(appliedTurn)),
      );
    } else {
      // get_there_time converts t2 to a temporary float, adds the x87
      // distance/rate result, stores the sum to f32, then chops to int.
      turningTicks = Math.trunc(F32(
        F32(turningTicks) + (distance / input.speed),
      ));
      if (distance - ((turningTicks - 1) * input.speed) > 0.1) {
        turningTicks += 1;
      }
      break;
    }

    lastAlignment = alignment;
    alignment = sourceAngleCosine({
      target: { x, y },
      facing: { x: facingX, y: facingY },
    });
    if (lastAlignment > alignment) {
      turningTicks = 2000;
      break;
    }
  }

  let turningFaceTicks = 0;
  if (mustFace !== null) {
    turningFaceTicks = Math.trunc(Math.abs(Math.acos(sourceAngleCosine({
      target: mustFace,
      facing: { x: facingX, y: facingY },
    })) / maxTurn)) + 1;
  }

  if ((straightTicks + straightFaceTicks) < (turningTicks + turningFaceTicks)) {
    return deepFreeze({
      ticks: straightTicks + straightFaceTicks,
      choice: "rotate-and-run",
      stopAndFace: true,
      face: mustFace ?? normalizeSourceVector(sourceOffset),
      mustFaceTicks: straightFaceTicks,
    });
  }
  return deepFreeze({
    ticks: turningTicks + turningFaceTicks,
    choice: "turn-and-run",
    stopAndFace: false,
    face: mustFace ?? normalizeSourceVector({ x, y }),
    mustFaceTicks: turningFaceTicks,
  });
}

/** Preserve MATHS.CPP calc_dist, including its 0.1 source floor. */
export function sourceDistance2d(vector) {
  const { x, y } = requireF32Vector(vector, "distance vector");
  // Watcom keeps the two products and their sum in the x87 evaluator for the
  // sqrt call; calc_dist stores only the returned result back to float.
  const distance = F32(Math.sqrt((x * x) + (y * y)));
  return distance > 0.1 ? distance : F32(0.1);
}

/** Preserve Watcom's checked x87 FISTP conversion under round-to-nearest-even. */
export function sourceWatcomFistpI32(value) {
  if (!Number.isFinite(value) || value < -0x80000000 || value > 0x7fffffff) {
    throw new RangeError("Watcom FISTP input must fit a signed 32-bit integer.");
  }
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (fraction < 0.5) return lower;
  if (fraction > 0.5) return lower + 1;
  return lower % 2 === 0 ? lower : lower + 1;
}

/** Normalize with calc_dist exactly; a zero vector therefore stays zero. */
export function normalizeSourceVector(vector) {
  const { x, y } = requireF32Vector(vector, "normalization vector");
  const distance = sourceDistance2d({ x, y });
  return deepFreeze({
    x: F32(x / distance),
    y: F32(y / distance),
  });
}

/** Source-equivalent INTELL.CPP get_dir eight-way facing bucket. */
export function sourceFacingDirection(vector) {
  const { x, y } = requireF32Vector(vector, "facing direction vector");
  let direction = 0;
  if (y >= 0) {
    if (x >= 0) {
      if (x > y) {
        direction = x > F32(y * 2) ? 4 : 3;
      } else {
        direction = y > F32(x * 2) ? 2 : 3;
      }
    } else {
      const negativeX = F32(-x);
      if (negativeX > y) {
        direction = negativeX > F32(y * 2) ? 0 : 1;
      } else {
        direction = y > F32(negativeX * 2) ? 2 : 1;
      }
    }
  } else if (x >= 0) {
    const negativeY = F32(-y);
    if (x > negativeY) {
      direction = x > F32(negativeY * 2) ? 4 : 5;
    } else {
      direction = negativeY > F32(x * 2) ? 6 : 5;
    }
  } else {
    const negativeX = F32(-x);
    const negativeY = F32(-y);
    if (negativeX > negativeY) {
      direction = negativeX > F32(negativeY * 2) ? 0 : 7;
    } else {
      direction = negativeY > F32(negativeX * 2) ? 6 : 7;
    }
  }
  return direction;
}

/** Source-equivalent ACTIONS.CPP angle_to_xy normalized dot product. */
export function sourceAngleCosine({ target, facing } = {}) {
  const targetVector = requireF32Vector(target, "angle target");
  const facingVector = requireF32Vector(facing, "angle facing");
  const normalizedTarget = normalizeSourceVector(targetVector);
  const normalizedFacing = normalizeSourceVector(facingVector);
  // angle_to_xy keeps both products in x87 registers and stores only the sum.
  let difference = F32(
    normalizedTarget.x * normalizedFacing.x
      + normalizedTarget.y * normalizedFacing.y,
  );
  if (difference > 1) difference = F32(1);
  if (difference < -1) difference = F32(-1);
  return difference;
}

/** Source-equivalent ACTIONS.CPP new_dir turn and get_dir projection. */
export function turnSourceFacing({ facing, target, maxTurnRadians } = {}) {
  const oldFacing = requireF32Vector(facing, "turn facing");
  const targetVector = requireF32Vector(target, "turn target");
  requirePositiveF32(maxTurnRadians, "turn maxTurnRadians");

  let { x, y } = normalizeSourceVector(targetVector);
  const difference = F32(x * oldFacing.x + y * oldFacing.y);
  let appliedTurn = F32(0);

  if (difference < Math.cos(maxTurnRadians)) {
    appliedTurn = maxTurnRadians;
    if (x * oldFacing.y > y * oldFacing.x) {
      appliedTurn = F32(-appliedTurn);
    }

    const cosine = Math.cos(appliedTurn);
    const sine = Math.sin(appliedTurn);
    x = F32((oldFacing.x * cosine) - (oldFacing.y * sine));
    y = F32((oldFacing.y * cosine) + (oldFacing.x * sine));

    const distance = sourceDistance2d({ x, y });
    x = F32(x / distance);
    y = F32(y / distance);

    if (y > 1) {
      y = F32(1);
      x = F32(0);
    }
    if (y < -1) {
      y = F32(-1);
      x = F32(0);
    }
    if (x > 1) {
      x = F32(1);
      y = F32(0);
    }
    if (x < -1) {
      x = F32(-1);
      y = F32(0);
    }
  }

  const nextFacing = { x, y };
  return deepFreeze({
    facing: nextFacing,
    faceDirection: sourceFacingDirection(nextFacing),
    appliedTurn,
  });
}

/**
 * The non-side-step go_forward displacement. `facing` is the normalized
 * new_dir output in the native call graph; angle_to_xy still normalizes both
 * vectors before calculating the source turn-speed scalar.
 */
export function sourceForwardDisplacement({ facing, targetOffset, speed } = {}) {
  const facingVector = requireF32Vector(facing, "forward facing");
  const targetVector = requireF32Vector(targetOffset, "forward targetOffset");
  requireF32(speed, "forward speed");
  const alignment = sourceAngleCosine({ target: targetVector, facing: facingVector });
  const turnSpeed = F32((1 + alignment) / 2);
  return deepFreeze({
    displacement: {
      // ACTIONS.CPP go_forward emits two x87 fmuls and only then fstp's the
      // float member; there is no float store between turn_spd and rate.
      x: F32(facingVector.x * turnSpeed * speed),
      y: F32(facingVector.y * turnSpeed * speed),
    },
    alignment,
    turnSpeed,
  });
}

/** Source-equivalent f32 tm_x/tm_y += go_txdis/go_tydis update. */
export function updateSourcePosition2d({ position, displacement } = {}) {
  const current = requireF32Vector(position, "position update position");
  const delta = requireF32Vector(displacement, "position update displacement");
  return deepFreeze({
    x: F32(current.x + delta.x),
    y: F32(current.y + delta.y),
  });
}

function requireMappedSpeedIntent(value) {
  if (!SPEED_INTENTS.has(value)) {
    throw new UnsupportedMotionSemanticsError(
      "actual_spd.int_move",
      `Unsupported speed intent ${JSON.stringify(value)}; bind the native intention explicitly.`,
    );
  }
}

function requireKeeperNativePlayers(value) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError("actual speed keeperNativePlayers must contain exactly two native slots.");
  }
  const players = value.map((entry, index) => {
    requireIntegerRange(entry, 1, 22, `actual speed keeperNativePlayers[${index}]`);
    return entry;
  });
  if (players[0] === players[1]) {
    throw new Error("actual speed keeperNativePlayers must be unique.");
  }
  return players;
}

function requireF32Vector(value, label) {
  requirePlainObject(value, label);
  requireOnlyKeys(value, ["x", "y"], label);
  requireF32(value.x, `${label} x`);
  requireF32(value.y, `${label} y`);
  return value;
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(F32(value), value)) {
    throw new TypeError(`${label} must be a finite, exactly rounded f32.`);
  }
}

function requirePositiveF32(value, label) {
  requireF32(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
}

function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be a safe integer.`);
}

function requirePositiveSafeInteger(value, label) {
  requireSafeInteger(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
}

function requireNonNegativeSafeInteger(value, label) {
  requireSafeInteger(value, label);
  if (value < 0) throw new RangeError(`${label} must be non-negative.`);
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
}

function requirePlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function requireOnlyKeys(value, allowed, label) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) {
    throw new Error(`${label} contains unsupported keys: ${extras.join(", ")}.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

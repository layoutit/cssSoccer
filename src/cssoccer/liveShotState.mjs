import { createBallMatchState } from "./ballMatchState.mjs";
import { CSSOCCER_BALL_CONSTANTS } from "./ballState.mjs";
import {
  sourceDistance2d,
  sourceFacingDirection,
  sourceWatcomFistpI32,
} from "./motionState.mjs";
import { CSSOCCER_NATIVE_GAMEPLAY_PROFILE } from "./nativeGameplayProfile.mjs";
import {
  createPossessionState,
  releasePossession,
} from "./possessionState.mjs";
import {
  advanceCssoccerNativeRng,
  createCssoccerNativeRngState,
} from "./randomState.mjs";

const F32 = Math.fround;
const MIN_SHOT_PROBABILITY = 4;
const MIN_PUNT_PROBABILITY = 3;
const PITCH_RATIO = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;

export const CSSOCCER_LIVE_SHOT_SOURCE = deepFreeze({
  sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  files: [
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: [
        "shoot_decide",
        "make_shoot",
        "shoot_ball",
        "aim_shot_at_goal",
        "punt_decide",
        "make_punt",
        "punt_ball",
      ],
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: ["user_spec_kick", "taker_nkick", "fire_ball_off"],
    },
  ],
  currentStateOnly: true,
  supportedBoundary:
    "ordinary outfield AI/user shot decisions, charged user shot release, and outfield/keeper punt release",
});

/** INTELL.CPP range_flags -> shoot_decide for a current outfield holder. */
export function resolveCssoccerShotDecision(input = {}) {
  requirePlainObject(input, "shot decision input");
  requireExactKeys(input, [
    "ball",
    "firstTime",
    "holder",
    "mustShoot",
    "opponentsNearHolder",
    "seed",
    "userControlled",
  ], "shot decision input");
  const ball = requirePoint(input.ball, "shot decision ball");
  const holder = requireHolder(input.holder, { allowKeeper: false });
  const seed = requireInteger(input.seed, 0, 127, "shot decision seed");
  const userControlled = requireBoolean(input.userControlled, "shot decision userControlled");
  const firstTime = requireBoolean(input.firstTime, "shot decision firstTime");
  const mustShoot = requireBoolean(input.mustShoot, "shot decision mustShoot");
  const opponentsNearHolder = requireInteger(
    input.opponentsNearHolder,
    0,
    11,
    "shot decision opponentsNearHolder",
  );
  const goalOffset = attackingGoalOffset(holder.nativePlayerNumber, ball);
  const range = Math.max(1, Math.trunc(sourceDistance2d(goalOffset)));
  const shootingRange = isCssoccerShootingRange(holder, ball);
  if (!shootingRange) {
    return deepFreeze({
      outcome: "no-shot",
      passType: null,
      range,
      probability: null,
      shootingRange: false,
    });
  }

  let passType;
  if (userControlled || playerFacingGoal(holder, goalOffset)) {
    passType = -1;
  } else {
    passType = sourceKickDirection({
      facing: holder.facing,
      offset: goalOffset,
      power: holder.power,
    });
  }
  if (passType === 0) {
    return deepFreeze({
      outcome: "no-shot",
      passType: null,
      range,
      probability: null,
      shootingRange: true,
    });
  }
  let probability = Math.trunc(10000 / range)
    + opponentsNearHolder * (16 + Math.trunc((128 - holder.flair) / 4))
    - (16 + Math.trunc(holder.flair / 3));
  probability = Math.max(MIN_SHOT_PROBABILITY, probability);
  const accepted = userControlled || mustShoot || firstTime || seed <= probability;
  return deepFreeze({
    outcome: accepted ? "shot" : "no-shot",
    passType,
    range,
    probability,
    shootingRange: true,
  });
}

/** INTELL.CPP punt_decide from current half, facing, pressure, and seed. */
export function resolveCssoccerPuntDecision(input = {}) {
  requirePlainObject(input, "punt decision input");
  requireExactKeys(input, [
    "ball",
    "firstTime",
    "holder",
    "mustPunt",
    "opponentsNearHolder",
    "seed",
    "userControlled",
  ], "punt decision input");
  const ball = requirePoint(input.ball, "punt decision ball");
  const holder = requireHolder(input.holder, { allowKeeper: true });
  const seed = requireInteger(input.seed, 0, 127, "punt decision seed");
  const firstTime = requireBoolean(input.firstTime, "punt decision firstTime");
  const mustPunt = requireBoolean(input.mustPunt, "punt decision mustPunt");
  const userControlled = requireBoolean(input.userControlled, "punt decision userControlled");
  const opponentsNearHolder = requireInteger(
    input.opponentsNearHolder,
    0,
    11,
    "punt decision opponentsNearHolder",
  );
  const teamB = holder.nativePlayerNumber > 11;
  const centreX = CSSOCCER_BALL_CONSTANTS.pitchLength / 2;
  const facingX = holder.facing.x;
  const defensive = teamB
    ? facingX < 0
      && ball.x < CSSOCCER_BALL_CONSTANTS.pitchLength
      && ball.x > centreX
      && (seed < -(facingX * 128) || mustPunt)
    : facingX > 0
      && ball.x > 0
      && ball.x < centreX
      && (seed < facingX * 128 || mustPunt);
  if (!defensive) return deepFreeze({ outcome: "no-punt", defense: null });

  let defense = Math.trunc(teamB ? ball.x - centreX : centreX - ball.x);
  if (defense > centreX - (10 * PITCH_RATIO)) defense += 128;
  if ((userControlled && defense > PITCH_RATIO * 20) || mustPunt) defense = 128 * 4;
  if (
    Math.trunc(defense / 3) <= seed
    && !(firstTime && defense * (holder.control / 64) > seed)
  ) {
    return deepFreeze({ outcome: "no-punt", defense });
  }

  let probability = Math.max(
    MIN_PUNT_PROBABILITY,
    opponentsNearHolder * 40 - holder.flair,
  );
  if (userControlled) probability = 128;
  const facingFactor = F32(teamB ? -(facingX - 1) / 2 : (1 + facingX) / 2);
  return deepFreeze({
    outcome: (
      (seed < probability * facingFactor && facingFactor > 0.5)
      || mustPunt
    ) ? "punt" : "no-punt",
    defense,
    facingFactor,
    opponentsNearHolder,
    probability,
  });
}

/** INTELL.CPP shoot_ball -> aim_shot_at_goal, including user aim/charge. */
export function releaseCssoccerShot(input = {}) {
  requirePlainObject(input, "shot release input");
  requireExactKeys(input, [
    "ball",
    "charge",
    "direction",
    "drive",
    "keeper",
    "owner",
    "possession",
    "rng",
    "tick",
    "userControlled",
  ], "shot release input");
  const ball = createBallMatchState(input.ball);
  const possession = createPossessionState(input.possession);
  const owner = requireHolder(input.owner, { allowKeeper: false });
  const keeper = requireKeeper(input.keeper, owner.nativePlayerNumber);
  const rng = createCssoccerNativeRngState(input.rng);
  const tick = requireInteger(input.tick, 0, Number.MAX_SAFE_INTEGER, "shot release tick");
  const userControlled = requireBoolean(input.userControlled, "shot release userControlled");
  const drive = requireBoolean(input.drive, "shot release drive");
  const charge = input.charge === null
    ? null
    : requireInteger(input.charge, 1, 30, "shot release charge");
  const direction = input.direction === null
    ? null
    : requireUnitDirection(input.direction, "shot release direction");
  if (
    ball.ball.tick !== tick
    || possession.owner !== owner.nativePlayerNumber
    || possession.inHands !== 0
    || (userControlled && direction === null)
    || (!userControlled && (direction !== null || charge !== null || drive))
  ) {
    throw new Error("shot release requires its current outfield contact owner and source decision");
  }

  const goalX = owner.nativePlayerNumber < 12
    ? CSSOCCER_BALL_CONSTANTS.pitchLength
    : 0;
  let xOffset = F32(goalX - ball.ball.position.x);
  let yOffset = F32(
    (CSSOCCER_BALL_CONSTANTS.pitchWidth / 2) - ball.ball.position.y,
  );
  const range = Math.max(1, Math.trunc(sourceDistance2d({ x: xOffset, y: yOffset })));
  let shotRng = advanceCssoccerNativeRng(rng);
  let side = 0;
  let openArea = F32(0);

  if (userControlled) {
    xOffset = F32(direction.x * range);
    yOffset = F32(direction.y * range);
  } else {
    const keeperOffset = {
      x: F32(keeper.position.x - ball.ball.position.x),
      y: F32(keeper.position.y - ball.ball.position.y),
    };
    const goalLineOffset = F32(goalX - ball.ball.position.x);
    const keeperGoalY = F32(keeperOffset.y * goalLineOffset / keeperOffset.x);
    openArea = F32(
      keeperGoalY
        + ball.ball.position.y
        - (CSSOCCER_BALL_CONSTANTS.pitchWidth / 2),
    );
    if (openArea > 0) {
      if (Math.trunc(owner.flair / 2) + 63 > shotRng.seed) {
        openArea = F32(
          (CSSOCCER_BALL_CONSTANTS.pitchWidth / 2)
            + openArea
            - CSSOCCER_BALL_CONSTANTS.topPostY,
        );
        side = -1;
      } else {
        openArea = F32(0);
        side = 1;
      }
    } else if (Math.trunc(owner.flair / 2) + 63 > shotRng.seed) {
      openArea = F32(
        CSSOCCER_BALL_CONSTANTS.bottomPostY
          - ((CSSOCCER_BALL_CONSTANTS.pitchWidth / 2) + openArea),
      );
      side = 1;
    } else {
      openArea = F32(0);
      side = -1;
    }
    xOffset = goalLineOffset;
    let accuracyOffset = Math.trunc(
      shotRng.seed * (8 + (128 - owner.accuracy)) / 128,
    );
    const scaledAccuracyOffset = accuracyOffset * range / (20 * PITCH_RATIO);
    accuracyOffset = (shotRng.seed & 4) !== 0
      ? sourceWatcomFistpI32(-scaledAccuracyOffset)
      : sourceWatcomFistpI32(scaledAccuracyOffset);
    yOffset = F32(side > 0
      ? CSSOCCER_BALL_CONSTANTS.bottomPostY
        - ball.ball.position.y
        - 16
        + accuracyOffset
      : CSSOCCER_BALL_CONSTANTS.topPostY
        - ball.ball.position.y
        + 16
        + accuracyOffset);
  }

  let shotVariation = shotRng.seed;
  shotRng = advanceCssoccerNativeRng(shotRng);
  shotVariation = Math.trunc((shotVariation + shotRng.seed) / 2);
  let shotSpeed = F32(
    6
      + (4 * range / (PITCH_RATIO * 60))
      + (9 * (owner.power + shotVariation) / 150),
  );
  shotRng = advanceCssoccerNativeRng(shotRng);

  let swerve = 0;
  let fullXY = F32(0);
  let fullZ = F32(0);
  let zDisplacement;
  if (charge !== null) {
    shotSpeed = F32((charge + 16) / 2);
    zDisplacement = F32(charge / 3);
    xOffset = F32(direction.x * 10);
    yOffset = F32(direction.y * 10);
  } else if (drive) {
    shotSpeed = F32(shotSpeed + 5);
    zDisplacement = F32(7 - (shotSpeed / 10));
  } else if (!userControlled && range >= 10 * PITCH_RATIO) {
    shotRng = advanceCssoccerNativeRng(shotRng);
    fullXY = F32((shotRng.seed / 128) * 0.12 * owner.flair / 128);
    fullZ = F32((shotRng.seed / 128) * 0.12 * owner.flair / 128);
    const aimedDistance = sourceDistance2d({ x: xOffset, y: yOffset });
    shotRng = advanceCssoccerNativeRng(shotRng);
    let travelTime = F32(
      aimedDistance / shotSpeed * (1 - CSSOCCER_BALL_CONSTANTS.airFriction),
    );
    if (travelTime >= 1) travelTime = F32(0.9998);
    travelTime = F32(
      Math.log(1 - travelTime) / Math.log(CSSOCCER_BALL_CONSTANTS.airFriction),
    );
    let swerveAngle = F32(0);
    for (let index = 1; index <= travelTime; index += 1) {
      swerveAngle = F32(
        swerveAngle
          + fullXY * (
            CSSOCCER_BALL_CONSTANTS.swerveHoldFactor
              / (CSSOCCER_BALL_CONSTANTS.swerveHoldFactor + index)
          ),
      );
    }
    swerveAngle = F32(swerveAngle / 2.2 + aimedDistance / 4800);
    const normalizedX = F32(xOffset / aimedDistance);
    const normalizedY = F32(yOffset / aimedDistance);
    if (xOffset < 0) {
      swerve = side < 0
        ? (xOffset < yOffset ? -1 : 1)
        : (xOffset < yOffset ? 1 : -1);
    } else {
      swerve = side < 0
        ? (xOffset > yOffset ? 1 : -1)
        : (xOffset > yOffset ? -1 : 1);
    }
    const cosine = Math.cos(swerveAngle);
    const sine = Math.sin(swerveAngle);
    if (swerve < 0) {
      xOffset = F32(aimedDistance * ((normalizedX * cosine) - (normalizedY * sine)));
      yOffset = F32(aimedDistance * ((normalizedY * cosine) + (normalizedX * sine)));
    } else {
      xOffset = F32(aimedDistance * ((normalizedX * cosine) + (normalizedY * sine)));
      yOffset = F32(aimedDistance * ((normalizedY * cosine) - (normalizedX * sine)));
    }
    zDisplacement = F32(
      7.2
        + Math.trunc(range / 180)
        + ((shotRng.seed / 64) * (128 - owner.accuracy) / 128)
        + (fullZ / 2),
    );
  } else {
    const lowPlacement = !userControlled
      && openArea > PITCH_RATIO * 6
      && range < PITCH_RATIO * 15;
    zDisplacement = F32(
      (lowPlacement ? 1.8 : 5.2)
        + Math.trunc(range / 180)
        + ((shotRng.seed / 64) * (128 - owner.accuracy) / 128),
    );
  }
  if (userControlled) {
    fullXY = F32(0.12 * owner.flair / 128);
    fullZ = F32(0.12 * owner.flair / 128);
  }

  const launchDistance = sourceDistance2d({ x: xOffset, y: yOffset });
  const displacement = {
    x: F32(shotSpeed * xOffset / launchDistance),
    y: F32(shotSpeed * yOffset / launchDistance),
    z: zDisplacement,
  };
  const nextBall = createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      displacement,
      inAir: 1,
      still: 0,
      spin: {
        swerve,
        count: 0,
        nativeState: 0,
        fullXY,
        fullZ,
        xy: F32(0),
        z: F32(0),
      },
      rng: shotRng,
      afterTouch: {
        user: userControlled && !drive ? 1 : 0,
        shotDirection: userControlled && !drive
          ? clone(direction)
          : { x: F32(0), y: F32(0) },
      },
    },
  });
  const releasedPossession = releaseForKick(possession, owner.nativePlayerNumber);
  return deepFreeze({
    ball: nextBall,
    possession: releasedPossession,
    rng: shotRng,
    release: {
      kind: "shot",
      tick,
      ownerNativePlayer: owner.nativePlayerNumber,
      targetKeeperNativePlayer: keeper.nativePlayerNumber,
      range,
      shotSpeed,
      charge,
      drive,
      userControlled,
      displacement,
    },
  });
}

/** INTELL.CPP punt_ball for an outfielder or a keeper already holding the ball. */
export function releaseCssoccerPunt(input = {}) {
  requirePlainObject(input, "punt release input");
  requireExactKeys(input, [
    "ball",
    "keeperHands",
    "owner",
    "possession",
    "rng",
    "tick",
  ], "punt release input");
  const ball = createBallMatchState(input.ball);
  const possession = createPossessionState(input.possession);
  const owner = requireHolder(input.owner, { allowKeeper: true });
  const keeperHands = requireBoolean(input.keeperHands, "punt release keeperHands");
  const tick = requireInteger(input.tick, 0, Number.MAX_SAFE_INTEGER, "punt release tick");
  const rng = createCssoccerNativeRngState(input.rng);
  const isKeeper = owner.nativePlayerNumber === 1 || owner.nativePlayerNumber === 12;
  if (
    ball.ball.tick !== tick
    || possession.owner !== owner.nativePlayerNumber
    || possession.inHands !== (keeperHands ? 1 : 0)
    || keeperHands !== isKeeper
  ) {
    throw new Error("punt release requires its current feet or keeper-hands owner");
  }
  // rand_range(129-tm_ac) consumes one source random sample even though its
  // local result is unused by this release branch.
  const randomized = advanceCssoccerNativeRng(rng);
  const speed = F32(6 + owner.power / 8);
  const displacement = {
    x: F32(owner.facing.x * speed),
    y: F32(owner.facing.y * speed),
    z: F32(isKeeper ? 12 : 10),
  };
  const nextBall = createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      displacement,
      inAir: 1,
      still: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
      rng: randomized,
    },
  });
  return deepFreeze({
    ball: nextBall,
    possession: releaseForKick(possession, owner.nativePlayerNumber),
    rng: randomized,
    release: {
      kind: "punt",
      tick,
      ownerNativePlayer: owner.nativePlayerNumber,
      targetKeeperNativePlayer: isKeeper
        ? (owner.nativePlayerNumber === 1 ? 12 : 1)
        : (owner.nativePlayerNumber < 12 ? 12 : 1),
      keeperHands,
      displacement,
    },
  });
}

export function isCssoccerShootingRange(holderInput, ballInput) {
  const holder = requireHolder(holderInput, { allowKeeper: false });
  const ball = requirePoint(ballInput, "shooting-range ball");
  return sourceDistance2d(attackingGoalOffset(holder.nativePlayerNumber, ball))
    < PITCH_RATIO * 12 + holder.power * 3;
}

function releaseForKick(possession, ownerNativePlayer) {
  return releasePossession(createPossessionState({
    ...clone(possession),
    cannotPickUp: ownerNativePlayer,
  }));
}

function attackingGoalOffset(nativePlayerNumber, ball) {
  return {
    x: F32((nativePlayerNumber < 12 ? CSSOCCER_BALL_CONSTANTS.pitchLength : 0) - ball.x),
    y: F32((CSSOCCER_BALL_CONSTANTS.pitchWidth / 2) - ball.y),
  };
}

function playerFacingGoal(player, goalOffset) {
  if (
    (goalOffset.x > 0 && player.facing.x < 0)
    || (goalOffset.x < 0 && player.facing.x > 0)
  ) return false;
  const topOffset = F32(CSSOCCER_BALL_CONSTANTS.topPostY - player.position.y);
  const topDistance = sourceDistance2d({ x: goalOffset.x, y: topOffset });
  const topX = F32(goalOffset.x / topDistance);
  const topY = F32(topOffset / topDistance);
  const bottomOffset = F32(CSSOCCER_BALL_CONSTANTS.bottomPostY - player.position.y);
  const bottomDistance = sourceDistance2d({ x: goalOffset.x, y: bottomOffset });
  const bottomX = F32(goalOffset.x / bottomDistance);
  const bottomY = F32(bottomOffset / bottomDistance);
  const aboveTop = topX * player.facing.y > topY * player.facing.x;
  const aboveBottom = bottomX * player.facing.y > bottomY * player.facing.x;
  return aboveBottom ? !aboveTop : aboveTop;
}

function sourceKickDirection({ facing, offset, power }) {
  const distance = sourceDistance2d(offset);
  const normalized = { x: F32(offset.x / distance), y: F32(offset.y / distance) };
  const kickingDistance = F32(PITCH_RATIO * 8 + power / 3.6);
  const difference = F32(facing.x * normalized.x + facing.y * normalized.y);
  if (difference > 0.966) {
    if (distance > kickingDistance * 4) return 0;
    return distance > kickingDistance * 2 ? -1 : 5;
  }
  const directionalDistance = F32(kickingDistance * (1.5 + difference / 2));
  if (distance > directionalDistance) return 0;
  return 1 + sourceFacingDirection({
    x: F32(normalized.x * facing.x + normalized.y * facing.y),
    y: F32(normalized.y * facing.x - normalized.x * facing.y),
  });
}

function requireHolder(value, { allowKeeper }) {
  requirePlainObject(value, "shot holder");
  requireExactKeys(value, [
    "accuracy",
    "control",
    "facing",
    "flair",
    "nativePlayerNumber",
    "position",
    "power",
  ], "shot holder");
  const nativePlayerNumber = requireInteger(value.nativePlayerNumber, 1, 22, "shot holder nativePlayerNumber");
  if (!allowKeeper && (nativePlayerNumber === 1 || nativePlayerNumber === 12)) {
    throw new Error("ordinary shot holder must be an outfielder");
  }
  return {
    nativePlayerNumber,
    position: requirePoint(value.position, "shot holder position"),
    facing: requireUnitDirection(value.facing, "shot holder facing"),
    accuracy: requireInteger(value.accuracy, 0, 128, "shot holder accuracy"),
    control: requireInteger(value.control, 0, 128, "shot holder control"),
    flair: requireInteger(value.flair, 0, 128, "shot holder flair"),
    power: requireInteger(value.power, 0, 128, "shot holder power"),
  };
}

function requireKeeper(value, shooterNativePlayer) {
  requirePlainObject(value, "shot target keeper");
  requireExactKeys(value, ["nativePlayerNumber", "position"], "shot target keeper");
  const expected = shooterNativePlayer < 12 ? 12 : 1;
  if (value.nativePlayerNumber !== expected) {
    throw new Error(`shot target keeper must be native player ${expected}`);
  }
  return {
    nativePlayerNumber: expected,
    position: requirePoint(value.position, "shot target keeper position"),
  };
}

function requirePoint(value, label) {
  requirePlainObject(value, label);
  const allowed = new Set(["x", "y", "z"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error(`${label} has unsupported fields`);
  }
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError(`${label} must contain finite x/y`);
  }
  return { x: F32(value.x), y: F32(value.y), ...(value.z === undefined ? {} : { z: F32(value.z) }) };
}

function requireUnitDirection(value, label) {
  const direction = requirePoint(value, label);
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) throw new Error(`${label} must not be zero`);
  return { x: F32(direction.x / length), y: F32(direction.y / length) };
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean`);
  return value;
}

function requireInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}`);
  }
  return value;
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null)
  ) throw new TypeError(`${label} must be a plain object`);
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}`);
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

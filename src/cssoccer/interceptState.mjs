import { stepBallMatchState } from "./ballMatchState.mjs";
import {
  sourceAngleCosine,
  sourceGetThereTime,
} from "./motionState.mjs";

const F32 = Math.fround;
const PREDICTION_LIMIT = 50;

export const CSSOCCER_INTERCEPT_SOURCE = deepFreeze({
  files: [
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["get_there_time", "can_i_intercept", "go_to_path"],
    },
    {
      file: "BALLINT.CPP",
      sha256: "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
      producers: ["predict_ball"],
    },
    {
      file: "MATHS.CPP",
      sha256: "c7f61a26ce63ab439829f8c84a840f2c781704a44f2d06f149cf872013a96107",
      producers: ["calc_dist minimum 0.1"],
    },
  ],
  supportedBranch: "ground run-on plus foot/chest/down-head control for a free ball",
  predictionOffsets: "odd ticks 1..49",
});

export const CSSOCCER_FREE_BALL_CONTROL_PROFILE = deepFreeze({
  foot: {
    actionIndex: 1,
    animationId: 54,
    frameCount: 20,
    contact: F32(40 / 60),
    timingContact: 40 / 60,
    timingFrameStep: 2 / 20,
    localOffsets: [
      { x: F32(6.640233039855957), y: F32(2.5310699939727783), z: F32(1.3440619707107544) },
      { x: F32(6.640233039855957), y: F32(-2.5310699939727783), z: F32(1.3440619707107544) },
    ],
    completionOffset: {
      x: F32(6.422946929931641),
      y: F32(2.868830680847168),
      z: F32(1.2544069290161133),
    },
  },
  chest: {
    actionIndex: 2,
    animationId: 84,
    frameCount: 49,
    contact: F32(50 / 149),
    timingContact: 50 / 149,
    timingFrameStep: 2 / 49,
    localOffsets: [
      { x: F32(2.5105690956115723), y: F32(-0.9216960072517395), z: F32(17.889450073242188) },
    ],
    completionOffset: {
      x: F32(10.019489288330078),
      y: F32(0.033519208431243896),
      z: F32(2.6339149475097656),
    },
  },
  downHead: {
    actionIndex: 3,
    animationId: 81,
    frameCount: 38,
    contact: F32(34 / 115),
    timingContact: 34 / 115,
    timingFrameStep: 2 / 38,
    localOffsets: [
      { x: F32(6.369528770446777), y: F32(-0.06462900340557098), z: F32(21.6130428314209) },
    ],
    completionOffset: {
      x: F32(13.10130786895752),
      y: F32(1.261271357536316),
      z: F32(1.9583522081375122),
    },
  },
});

const CSSOCCER_FIRST_TIME_CHIP_PROFILE = deepFreeze({
  actionIndex: 10,
  animationId: 37,
  contact: F32(40 / 91),
  // INTELL.CPP's first-time chip branch deliberately uses ft_ctm, the chest
  // control timing, rather than the chip animation cadence.
  timingContact: 50 / 149,
  timingFrameStep: 2 / 49,
  localOffsets: [
    { x: F32(9.38531494140625), y: F32(2.523958921432495), z: F32(3.210542917251587) },
    { x: F32(9.38531494140625), y: F32(-2.523958921432495), z: F32(3.210542917251587) },
  ],
});

/** Project INTELL.CPP can_i_intercept's first-time chip candidate. */
export function projectCssoccerFirstTimeChipIntercept(input = {}) {
  requirePlainObject(input, "first-time chip intercept input");
  requireExactKeys(input, [
    "contactFacing",
    "player",
    "playerHeight",
    "target",
    "tickOffset",
  ], "first-time chip intercept input");
  const player = requireFreeBallControlPlayer(input.player);
  requireF32Vector2(input.contactFacing, "first-time chip intercept contactFacing");
  requirePositiveF32(input.playerHeight, "first-time chip intercept playerHeight");
  requireF32Vector3(input.target, "first-time chip intercept target");
  if (!Number.isSafeInteger(input.tickOffset) || input.tickOffset <= 0) {
    throw new TypeError("first-time chip intercept tickOffset must be a positive safe integer.");
  }
  if (input.target.z >= input.playerHeight / 4) return null;

  const contactOffset = rotateAndAverageSourceOffsets(
    CSSOCCER_FIRST_TIME_CHIP_PROFILE.localOffsets,
    // first_time_strike temporarily points the player along x_face/y_face;
    // can_i_intercept then reuses those get_there_time globals here.
    input.contactFacing,
  );
  const target = {
    x: F32(input.target.x - contactOffset.x),
    y: F32(input.target.y - contactOffset.y),
    z: input.target.z,
  };
  const travel = getInterceptTravel(player, target);
  const animationTime = sourceControlAnimationTime(
    CSSOCCER_FIRST_TIME_CHIP_PROFILE,
    player.controlAttribute,
    player.userControlled,
  );
  const waitTicks = Math.trunc(
    input.tickOffset - (travel.ticks + animationTime),
  );
  if (
    waitTicks < 0
    || (!player.controlled && waitTicks >= player.reactionTicks)
  ) return null;

  return deepFreeze({
    kind: "first-time-chip",
    actionIndex: CSSOCCER_FIRST_TIME_CHIP_PROFILE.actionIndex,
    animationId: CSSOCCER_FIRST_TIME_CHIP_PROFILE.animationId,
    contact: CSSOCCER_FIRST_TIME_CHIP_PROFILE.contact,
    tickOffset: input.tickOffset,
    waitTicks,
    target,
    predictionTarget: { ...input.target },
    contactOffset,
    animationTime,
    strikeTime: F32(animationTime + 1),
    travel,
  });
}

/** Project BALLINT.CPP rotate_offs for a prepared CONTROL_ACT contact. */
export function projectCssoccerControlMotionContact(input = {}) {
  requirePlainObject(input, "control motion contact input");
  requireExactKeys(input, [
    "actionIndex",
    "facing",
    "playerPosition",
  ], "control motion contact input");
  const action = Object.values(CSSOCCER_FREE_BALL_CONTROL_PROFILE).find(
    ({ actionIndex }) => actionIndex === input.actionIndex,
  );
  if (action === undefined) throw new RangeError("control motion actionIndex must be 1, 2, or 3.");
  requireF32Vector2(input.facing, "control motion facing");
  requireF32Vector3(input.playerPosition, "control motion playerPosition");
  // Once init_control_act selects the concrete control animation,
  // BALLINT.CPP control_interact/ball_at_contact use that animation's single
  // rotate_offs entry. Mirrored averaging belongs only to can_i_intercept.
  const offset = rotateSourceOffset(action.localOffsets[0], input.facing);
  return deepFreeze({
    actionIndex: action.actionIndex,
    animationId: action.animationId,
    contact: action.contact,
    animationFrameStep: F32(2 / action.frameCount),
    offset,
    position: {
      x: F32(input.playerPosition.x + offset.x),
      y: F32(input.playerPosition.y + offset.y),
      z: F32(input.playerPosition.z + offset.z),
    },
  });
}

/** Project get_mcball_coords from the final prepared control pose. */
export function projectCssoccerControlCompletionBall(input = {}) {
  requirePlainObject(input, "control completion ball input");
  requireExactKeys(input, [
    "actionIndex",
    "facing",
    "playerPosition",
  ], "control completion ball input");
  const action = Object.values(CSSOCCER_FREE_BALL_CONTROL_PROFILE).find(
    ({ actionIndex }) => actionIndex === input.actionIndex,
  );
  if (action === undefined) throw new RangeError("control completion actionIndex must be 1, 2, or 3.");
  requireF32Vector2(input.facing, "control completion facing");
  requireF32Vector3(input.playerPosition, "control completion playerPosition");
  const offset = rotateSourceOffset(action.completionOffset, input.facing);
  return deepFreeze({
    actionIndex: action.actionIndex,
    animationId: action.animationId,
    offset,
    position: {
      x: F32(input.playerPosition.x + offset.x),
      y: F32(input.playerPosition.y + offset.y),
      z: F32(input.playerPosition.z + offset.z),
    },
  });
}

/**
 * Select the source run-on target from a browser-owned predicted ball path.
 *
 * This is a gameplay primitive, not a fixture lookup: any player and any live
 * ball state can be supplied. Later strike/trap/header choices remain separate
 * branches of can_i_intercept.
 */
export function selectCssoccerGroundRunOnIntercept(input = {}) {
  return scanCssoccerGroundRunOnIntercept(input).intercept;
}

/**
 * Scan the complete odd-tick go_to_path window.
 *
 * Besides the selected run-on target, expose every in-bounds prediction that
 * reaches can_i_intercept, its get_there_time result, and whether that result
 * reaches first_time_strike. Callers use this source traversal to preserve AI
 * side effects without coupling the intercept primitive to a particular
 * strike/pass decision.
 */
export function scanCssoccerGroundRunOnIntercept(input = {}) {
  requirePlainObject(input, "ground intercept input");
  requireExactKeys(input, [
    "ballState",
    "pitchLength",
    "pitchWidth",
    "playerHeight",
    "player",
  ], "ground intercept input");
  requirePositiveSafeInteger(input.pitchLength, "ground intercept pitchLength");
  requirePositiveSafeInteger(input.pitchWidth, "ground intercept pitchWidth");
  requirePositiveF32(input.playerHeight, "ground intercept playerHeight");
  const player = requireInterceptPlayer(input.player);

  let prediction = input.ballState;
  let best = null;
  let bestWaitTicks = 1000;
  const interceptChecks = [];
  for (let tickOffset = 1; tickOffset < PREDICTION_LIMIT; tickOffset += 1) {
    prediction = stepCssoccerInterceptPrediction(prediction);
    if (tickOffset % 2 === 0) continue;

    const target = prediction.ball.position;
    if (
      target.x < 0
      || target.x >= input.pitchLength
      || target.y < 0
      || target.y >= input.pitchWidth
    ) {
      break;
    }
    if (target.z >= player.jumpHeight) continue;
    const targetOffset = {
      x: F32(target.x - player.position.x),
      y: F32(target.y - player.position.y),
    };
    const travel = sourceGetThereTime({
      position: { x: player.position.x, y: player.position.y },
      target: { x: target.x, y: target.y },
      facing: player.facing,
      speed: player.fullSpeed,
      maxTurn2Radians: player.maxTurn2Radians,
      imThereDistance: player.imThereDistance,
      canRotateAndRun: player.canRotateAndRun,
      mustFace: player.mustFace,
    });
    const firstTimeEligible = travel.ticks <= tickOffset;
    interceptChecks.push({
      tickOffset,
      target: { x: target.x, y: target.y, z: target.z },
      travel,
      firstTimeEligible,
    });
    if (!firstTimeEligible || target.z >= input.playerHeight / 3) continue;

    if (
      !player.userControlled
      && sourceAngleCosine({ target: targetOffset, facing: player.facing }) <= 0
    ) {
      continue;
    }

    const waitTicks = tickOffset - travel.ticks;
    if (
      waitTicks >= bestWaitTicks
      || (!player.controlled && waitTicks >= player.reactionTicks)
    ) {
      continue;
    }
    bestWaitTicks = waitTicks;
    best = {
      tickOffset,
      waitTicks,
      target: {
        x: target.x,
        y: target.y,
        z: target.z,
      },
      travel,
    };
  }

  return deepFreeze({
    intercept: best,
    interceptChecks,
  });
}

/**
 * Scan the source free-ball control branches implemented by can_i_intercept.
 *
 * The selected target is always produced from the predicted ball path and the
 * compiled motion-capture contact offset. No retained player coordinate enters
 * this calculation. First-time shots, volleys, and headers are intentionally
 * left for their own decision producer because their masks have additional AI
 * and RNG side effects.
 */
export function scanCssoccerFreeBallControlIntercept(input = {}) {
  requirePlainObject(input, "free-ball control intercept input");
  requireExactKeys(input, [
    "afterTouchInput",
    "ballState",
    "frozenShotPrediction",
    "pitchLength",
    "pitchWidth",
    "playerHeight",
    "player",
  ], "free-ball control intercept input");
  requirePositiveSafeInteger(input.pitchLength, "free-ball intercept pitchLength");
  requirePositiveSafeInteger(input.pitchWidth, "free-ball intercept pitchWidth");
  requirePositiveF32(input.playerHeight, "free-ball intercept playerHeight");
  const player = requireFreeBallControlPlayer(input.player);
  const frozenShotPrediction = requireFrozenShotPrediction(input.frozenShotPrediction);

  let prediction = input.ballState;
  let frozenShotPoint = frozenShotPrediction?.position ?? null;
  const strike = Array.from({ length: 4 }, () => null);
  const bestWait = [1000, 1000, 1000, 1000];
  const interceptChecks = [];
  for (let tickOffset = 1; tickOffset < PREDICTION_LIMIT; tickOffset += 1) {
    const priorPosition = frozenShotPoint ?? prediction.ball.position;
    let target;
    if (frozenShotPrediction === null) {
      prediction = stepCssoccerInterceptPrediction(prediction, input.afterTouchInput);
      target = prediction.ball.position;
    } else {
      // BALLINT.CPP predict_ball ran before process_teams while the shooter
      // still owned the ball. A later user player therefore scans that frozen
      // linear table even after kick_action releases the shot in this tick.
      frozenShotPoint = {
        x: F32(frozenShotPoint.x + frozenShotPrediction.displacement.x),
        y: F32(frozenShotPoint.y + frozenShotPrediction.displacement.y),
        z: frozenShotPoint.z,
      };
      target = frozenShotPoint;
    }
    if (tickOffset % 2 === 0) continue;

    if (
      target.x < 0
      || target.x >= input.pitchLength
      || target.y < 0
      || target.y >= input.pitchWidth
    ) {
      break;
    }
    if (target.z >= player.jumpHeight) continue;

    const travel = getInterceptTravel(player, target);
    const firstTimeEligible = travel.ticks <= tickOffset;
    const ballIntSpeed = sourceBallIntersectionSpeed(priorPosition, target);
    const check = {
      tickOffset,
      target: { x: target.x, y: target.y, z: target.z },
      travel,
      firstTimeEligible,
      ballIntSpeed,
      controlCandidate: null,
    };
    interceptChecks.push(check);
    if (!firstTimeEligible) continue;

    if (target.z < input.playerHeight / 3) {
      const targetOffset = {
        x: F32(target.x - player.position.x),
        y: F32(target.y - player.position.y),
      };
      const facingTarget = player.userControlled
        || sourceAngleCosine({ target: targetOffset, facing: player.facing }) > 0;
      const waitTicks = tickOffset - travel.ticks;
      if (
        facingTarget
        && waitTicks < bestWait[0]
        && (player.controlled || waitTicks < player.reactionTicks)
      ) {
        bestWait[0] = waitTicks;
        strike[0] = {
          kind: "run-on",
          actionIndex: 0,
          tickOffset,
          waitTicks,
          target: { x: target.x, y: target.y, z: target.z },
          predictionTarget: { x: target.x, y: target.y, z: target.z },
          contactOffset: { x: F32(0), y: F32(0), z: F32(0) },
          animationTime: F32(0),
          strikeTime: F32(0),
          travel,
        };
      }
    }

    const canControl = player.trapState >= 0 && (
      player.userControlled
        ? player.controlRequested
        : player.automaticMoveSelection && ballIntSpeed > 6
    );
    if (!canControl) continue;
    const action = controlActionForHeight(target.z, input.playerHeight);
    if (action === null) continue;

    const contactOffset = rotateAndAverageSourceOffsets(
      action.localOffsets,
      travel.face,
    );
    const contactTarget = {
      x: F32(target.x - contactOffset.x),
      y: F32(target.y - contactOffset.y),
      z: target.z,
    };
    const contactTravel = getInterceptTravel(player, contactTarget);
    const animationTime = sourceControlAnimationTime(
      action,
      player.controlAttribute,
      player.userControlled,
    );
    // `t` is a source short, so the float expression truncates before the
    // non-negative and best-free comparisons.
    const waitTicks = Math.trunc(
      tickOffset - (contactTravel.ticks + animationTime),
    );
    if (
      waitTicks < 0
      || waitTicks >= bestWait[action.actionIndex]
      || (!player.controlled && waitTicks >= player.reactionTicks)
    ) {
      continue;
    }
    bestWait[action.actionIndex] = waitTicks;
    const candidate = {
      kind: "control",
      actionIndex: action.actionIndex,
      tickOffset,
      waitTicks,
      target: contactTarget,
      predictionTarget: { x: target.x, y: target.y, z: target.z },
      contactOffset,
      animationTime,
      strikeTime: F32(animationTime + 1),
      travel: contactTravel,
    };
    strike[action.actionIndex] = candidate;
    check.controlCandidate = candidate;
  }

  let intercept = null;
  for (let actionIndex = strike.length - 1; actionIndex >= 0; actionIndex -= 1) {
    if (strike[actionIndex] !== null) {
      intercept = strike[actionIndex];
      break;
    }
  }
  return deepFreeze({ intercept, interceptChecks });
}

/**
 * Re-evaluate ACTIONS.CPP init_control_act/get_closest_pred at run arrival.
 * The source checks the stored contact time plus one prediction on either side,
 * then uses any corrected free tick for a single side-step wait displacement.
 */
export function projectCssoccerControlWaitTransition(input = {}) {
  requirePlainObject(input, "control wait transition input");
  requireExactKeys(input, [
    "actionIndex",
    "ballState",
    "face",
    "freeTicks",
    "playerPosition",
    "strikeTime",
  ], "control wait transition input");
  const action = Object.values(CSSOCCER_FREE_BALL_CONTROL_PROFILE).find(
    ({ actionIndex }) => actionIndex === input.actionIndex,
  );
  if (action === undefined) throw new RangeError("control wait actionIndex must be 1, 2, or 3.");
  requireF32Vector2(input.face, "control wait face");
  requireF32Vector3(input.playerPosition, "control wait playerPosition");
  requirePositiveF32(input.strikeTime, "control wait strikeTime");
  if (!Number.isSafeInteger(input.freeTicks) || input.freeTicks < 0) {
    throw new TypeError("control wait freeTicks must be a non-negative safe integer.");
  }

  const predictions = [input.ballState];
  let prediction = input.ballState;
  for (let tickOffset = 1; tickOffset < PREDICTION_LIMIT; tickOffset += 1) {
    prediction = stepCssoccerInterceptPrediction(prediction);
    predictions.push(prediction);
  }
  // get_closest_pred runs after init_control_act has selected the concrete
  // control animation. The initial can_i_intercept scan averages mirrored
  // offsets, but arrival re-evaluation uses that selected animation's offset.
  const contactOffset = rotateSourceOffset(action.localOffsets[0], input.face);
  const oldRt = F32(input.strikeTime + input.freeTicks);
  const sample = (rt) => {
    const point = predictions[Math.trunc(rt)].ball.position;
    const x = F32(F32(point.x - contactOffset.x) - input.playerPosition.x);
    const y = F32(F32(point.y - contactOffset.y) - input.playerPosition.y);
    const z = F32(F32(point.z - contactOffset.z) - input.playerPosition.z);
    const planar = sourcePlanarDistance(x, y);
    return { rt, x, y, z, distance: sourcePlanarDistance(z, planar) };
  };
  let cursor = oldRt;
  let best = sample(cursor);
  if (cursor < PREDICTION_LIMIT - 1) {
    cursor = F32(cursor + 1);
    const forward = sample(cursor);
    if (forward.distance < best.distance) best = forward;
  }
  if (cursor >= 1) {
    cursor = F32(cursor - 2);
    const backward = sample(cursor);
    if (backward.distance < best.distance) best = backward;
  }
  const freeTicks = Math.trunc(input.freeTicks + (best.rt - oldRt));
  const receiveTicks = F32(best.rt);
  const receivePlanarDistance = sourcePlanarDistance(best.x, best.y);
  const receiveValid = receivePlanarDistance / receiveTicks <= 1
    && Math.abs(best.z) <= 4;
  const receiveDisplacement = receiveValid
    ? {
        x: F32(best.x / receiveTicks),
        y: F32(best.y / receiveTicks),
      }
    : { x: F32(0), y: F32(0) };
  if (freeTicks <= 0) {
    return deepFreeze({
      actionIndex: action.actionIndex,
      animationId: action.animationId,
      contact: action.contact,
      freeTicks: 0,
      displacement: receiveDisplacement,
      position: { ...input.playerPosition },
      receiveTicks,
      receiveValid,
    });
  }
  const distance = sourcePlanarDistance(best.x, best.y);
  const stepDistance = F32(distance / freeTicks);
  const displacement = {
    x: F32(F32(best.x / distance) * stepDistance),
    y: F32(F32(best.y / distance) * stepDistance),
  };
  return deepFreeze({
    actionIndex: action.actionIndex,
    animationId: action.animationId,
    contact: action.contact,
    freeTicks,
    displacement,
    position: {
      x: F32(input.playerPosition.x + displacement.x),
      y: F32(input.playerPosition.y + displacement.y),
      z: input.playerPosition.z,
    },
    receiveTicks,
    receiveValid,
  });
}

function requireFreeBallControlPlayer(value) {
  requirePlainObject(value, "free-ball control intercept player");
  requireExactKeys(value, [
    "position",
    "facing",
    "fullSpeed",
    "maxTurn2Radians",
    "imThereDistance",
    "canRotateAndRun",
    "controlled",
    "userControlled",
    "reactionTicks",
    "jumpHeight",
    "mustFace",
    "automaticMoveSelection",
    "controlRequested",
    "controlAttribute",
    "trapState",
  ], "free-ball control intercept player");
  requireF32Vector3(value.position, "free-ball control intercept player position");
  requireF32Vector2(value.facing, "free-ball control intercept player facing");
  requirePositiveF32(value.fullSpeed, "free-ball control intercept player fullSpeed");
  requirePositiveF32(value.maxTurn2Radians, "free-ball control intercept player maxTurn2Radians");
  requirePositiveF32(value.imThereDistance, "free-ball control intercept player imThereDistance");
  requireBoolean(value.canRotateAndRun, "free-ball control intercept player canRotateAndRun");
  requireBoolean(value.controlled, "free-ball control intercept player controlled");
  requireBoolean(value.userControlled, "free-ball control intercept player userControlled");
  requirePositiveSafeInteger(value.reactionTicks, "free-ball control intercept player reactionTicks");
  requirePositiveF32(value.jumpHeight, "free-ball control intercept player jumpHeight");
  requireBoolean(value.automaticMoveSelection, "free-ball control intercept player automaticMoveSelection");
  requireBoolean(value.controlRequested, "free-ball control intercept player controlRequested");
  if (!Number.isSafeInteger(value.controlAttribute) || value.controlAttribute < 0 || value.controlAttribute > 255) {
    throw new TypeError("free-ball control intercept player controlAttribute must be u8.");
  }
  if (!Number.isSafeInteger(value.trapState) || value.trapState < -128 || value.trapState > 127) {
    throw new TypeError("free-ball control intercept player trapState must be i8.");
  }
  if (value.mustFace !== null) {
    requireF32Vector2(value.mustFace, "free-ball control intercept player mustFace");
  }
  return value;
}

function requireFrozenShotPrediction(value) {
  if (value === null) return null;
  requirePlainObject(value, "frozen shot prediction");
  requireExactKeys(value, [
    "displacement",
    "position",
  ], "frozen shot prediction");
  requireF32Vector3(value.position, "frozen shot prediction position");
  requireF32Vector3(value.displacement, "frozen shot prediction displacement");
  return value;
}

function getInterceptTravel(player, target) {
  return sourceGetThereTime({
    position: { x: player.position.x, y: player.position.y },
    target: { x: target.x, y: target.y },
    facing: player.facing,
    speed: player.fullSpeed,
    maxTurn2Radians: player.maxTurn2Radians,
    imThereDistance: player.imThereDistance,
    canRotateAndRun: player.canRotateAndRun,
    mustFace: player.mustFace,
  });
}

function sourceBallIntersectionSpeed(prior, target) {
  // go_to_path stores the summed float expression in the source int global
  // ball_int_speed before first_time_strike applies its `> 6` trap gate.
  return Math.trunc(
    Math.abs(target.x - prior.x)
    + Math.abs(target.y - prior.y)
    + (Math.abs(target.z - prior.z) * 2),
  );
}

function controlActionForHeight(z, playerHeight) {
  if (z < playerHeight / 2) return CSSOCCER_FREE_BALL_CONTROL_PROFILE.foot;
  if (z < playerHeight - 2) return CSSOCCER_FREE_BALL_CONTROL_PROFILE.chest;
  if (z < playerHeight + 4) return CSSOCCER_FREE_BALL_CONTROL_PROFILE.downHead;
  return null;
}

function sourceControlAnimationTime(action, controlAttribute, userControlled) {
  const speedUp = userControlled ? 1.3 : 1;
  const factor = F32(0.6 + (controlAttribute / 128));
  // go_to_path computes the MCC_* and MC_*_FS macro expressions as doubles,
  // multiplies by fstep_factor's stored float, then writes ft_*tm as f32.
  // The separately stored player contact remains the rounded f32 value.
  return F32(
    action.timingContact / (action.timingFrameStep * speedUp * factor),
  );
}

function rotateAndAverageSourceOffsets(offsets, facing) {
  const rotated = offsets.map((offset) => rotateSourceOffset(offset, facing));
  if (rotated.length === 1) return rotated[0];
  return {
    x: F32((rotated[0].x + rotated[1].x) / 2),
    y: F32((rotated[0].y + rotated[1].y) / 2),
    z: F32((rotated[0].z + rotated[1].z) / 2),
  };
}

function rotateSourceOffset(local, facing) {
  const facingDistance = sourcePlanarDistance(facing.x, facing.y);
  const nx = F32(facing.x / facingDistance);
  const ny = F32(facing.y / facingDistance);
  const offsetDistance = sourcePlanarDistance(local.x, local.y);
  if (offsetDistance <= 1) return { x: F32(0), y: F32(0), z: F32(0) };
  const x = F32(local.x / offsetDistance);
  const y = F32(local.y / offsetDistance);
  const rotatedX = F32(F32(x * nx) - F32(y * ny));
  const rotatedY = F32(F32(y * nx) + F32(x * ny));
  return {
    x: F32(rotatedX * offsetDistance),
    y: F32(rotatedY * offsetDistance),
    z: local.z,
  };
}

/** Prediction tables stop feeding a qualified restart back into ball physics. */
function stepCssoccerInterceptPrediction(state, afterTouchInput) {
  return state.outcome === null
    ? stepBallMatchState(state, {
        ...(state.ball.afterTouch.user === 0 ? {} : { afterTouchInput }),
      }).state
    : state;
}

function sourcePlanarDistance(x, y) {
  const distance = F32(Math.sqrt(F32(F32(x * x) + F32(y * y))));
  return distance > F32(0.1) ? distance : F32(0.1);
}

function requireInterceptPlayer(value) {
  requirePlainObject(value, "ground intercept player");
  requireExactKeys(value, [
    "position",
    "facing",
    "fullSpeed",
    "maxTurn2Radians",
    "imThereDistance",
    "canRotateAndRun",
    "controlled",
    "userControlled",
    "reactionTicks",
    "jumpHeight",
    "mustFace",
  ], "ground intercept player");
  requireF32Vector3(value.position, "ground intercept player position");
  requireF32Vector2(value.facing, "ground intercept player facing");
  requirePositiveF32(value.fullSpeed, "ground intercept player fullSpeed");
  requirePositiveF32(value.maxTurn2Radians, "ground intercept player maxTurn2Radians");
  requirePositiveF32(value.imThereDistance, "ground intercept player imThereDistance");
  requireBoolean(value.canRotateAndRun, "ground intercept player canRotateAndRun");
  requireBoolean(value.controlled, "ground intercept player controlled");
  requireBoolean(value.userControlled, "ground intercept player userControlled");
  requirePositiveSafeInteger(value.reactionTicks, "ground intercept player reactionTicks");
  requirePositiveF32(value.jumpHeight, "ground intercept player jumpHeight");
  if (value.mustFace !== null) {
    requireF32Vector2(value.mustFace, "ground intercept player mustFace");
  }
  return value;
}

function requireF32Vector2(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y"], label);
  requireF32(value.x, `${label} x`);
  requireF32(value.y, `${label} y`);
}

function requireF32Vector3(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y", "z"], label);
  requireF32(value.x, `${label} x`);
  requireF32(value.y, `${label} y`);
  requireF32(value.z, `${label} z`);
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

function requirePositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
}

function requirePlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(keys)) {
    throw new Error(`${label} must contain exactly ${keys.join(", ")}.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

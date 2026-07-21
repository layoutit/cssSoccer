import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  projectCssoccerKeeperSourceConstants,
} from "./nativeGameplayProfile.mjs";
import {
  createBallMatchState,
  stepBallMatchState,
} from "./ballMatchState.mjs";
import {
  collectPossession,
  createPossessionState,
  touchWithoutPossession,
} from "./possessionState.mjs";

const F32 = Math.fround;

export const CSSOCCER_KEEPER_AI_SCHEMA = "cssoccer-keeper-intent@1";
export const CSSOCCER_KEEPER_SAVE_PLAN_SCHEMA = "cssoccer-keeper-save-plan@1";

export const CSSOCCER_KEEPER_ACTIONS = Object.freeze({
  save: 10,
  hold: 12,
});

const BOUND_KEEPER_CONSTANTS = projectCssoccerKeeperSourceConstants(
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
);

export const CSSOCCER_KEEPER_AI_SOURCE = deepFreeze({
  files: [
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      owners: "keeper_boxes, close_angle, go_to_save_path, got_ball, opp_has_ball",
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      owners: "init_save_act, kphold_action",
    },
  ],
  nativeKeeperNumbers: [1, 12],
  forcedDivePredictionIndex: 3,
  nativeGameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
});

export const CSSOCCER_KEEPER_GAPS = deepFreeze([
  {
    id: "keeper-native-intelligence-state",
    status: "implemented-current-state",
    reason: "The current ball trajectory now drives save-path selection, SAVE_ACT movement, contact, and keeper-hold publication without retained keeper state.",
  },
  {
    id: "keeper-action-semantics",
    status: "implemented-source-bound",
    reason: "DATA.H save zones, contacts, frame counts, SAVE_ACT/KPHOLD_ACT ids, and BALLINT.CPP catch/block contact rules are bound in this module.",
  },
  {
    id: "keeper-position-constants",
    status: "implemented",
    reason: "KP_OFFLINE, CLOSE_ANG_DIST, and SAVE_JUMP_HGT are bound by the immutable native gameplay profile.",
  },
]);

const SAVE_ACTION_PROFILES = deepFreeze({
  A: {
    feet: [saveProfile("AFOOTB", 0, 29 / 69, 23, "parry"), saveProfile("AFOOTC", 1, 48 / 259, 86, "catch")],
    body: [saveProfile("ABODYB", 2, 54 / 160, 53, "parry"), saveProfile("ABODYC", 3, 39 / 131, 43, "catch")],
    head: [saveProfile("AHEADB", 4, 65 / 138, 27, "parry"), saveProfile("AHEADC", 5, 65 / 138, 46, "catch")],
    jump: [saveProfile("AJUMPB", 6, 44 / 86, 28, "parry"), saveProfile("AJUMPC", 7, 62 / 116, 38, "catch")],
  },
  B: {
    feet: [saveProfile("BFOOTB", 8, 52 / 63, 21, "parry"), saveProfile("BFOOTC", 10, 86 / 128, 42, "catch")],
    body: [saveProfile("BBODYB", 12, 29 / 81, 27, "parry"), saveProfile("BBODYC", 14, 57 / 130, 43, "catch")],
    head: [saveProfile("BHEADB", 16, 48 / 110, 32, "parry"), saveProfile("BHEADC", 18, 48 / 110, 36, "catch")],
    jump: [saveProfile("BJUMPB", 20, 60 / 109, 36, "parry")],
  },
  C: {
    feet: [saveProfile("CFOOTB", 22, 89 / 147, 49, "parry"), saveProfile("CFOOTC", 24, 109 / 150, 50, "catch")],
    body: [saveProfile("CBODYB", 26, 68 / 121, 45, "parry"), saveProfile("CBODYC", 28, 70 / 145, 48, "catch")],
    head: [saveProfile("CHEADB", 30, 89 / 132, 44, "parry")],
    jump: [saveProfile("CJUMPB", 32, 82 / 142, 47, "parry")],
  },
});

export function isCssoccerKeeperNumber(nativePlayerNumber) {
  return nativePlayerNumber === 1 || nativePlayerNumber === 12;
}

export function cssoccerKeeperBoxStatus(player, pitch = {}) {
  const current = requireKeeper(player);
  const dimensions = requirePitch(pitch);
  const { x, y } = current.position;
  const halfWidth = 19 * dimensions.ratio;
  const left = current.nativePlayerNumber === 1;
  const outsideX = left
    ? x > 16 * dimensions.ratio || x < 0
    : x < dimensions.length - 16 * dimensions.ratio || x > dimensions.length;
  return !outsideX
    && y <= dimensions.centreY + halfWidth
    && y >= dimensions.centreY - halfWidth;
}

/** Source dispatch boundary for either current goalkeeper. */
export function selectCssoccerKeeperIntent(player, context = {}) {
  const current = requireKeeper(player);
  requirePlainObject(context, "keeper context");
  const pitch = requirePitch(context.pitch);
  const ball = requireBall(context.ball);
  const possession = requireIntegerRange(
    context.possession ?? 0,
    0,
    22,
    "keeper context possession",
  );
  const inBox = cssoccerKeeperBoxStatus(current, pitch);
  const distance = planarDistance(current.position, ball.position);

  if (possession === current.nativePlayerNumber) {
    if (ball.inHands) {
      return selectKeeperDistribution(current, context.distribution);
    }
    if (inBox && canKeeperHandle(current.nativePlayerNumber, context.cannotPickUp ?? 0)) {
      if (context.opponentNear === true) {
        return saveIntent(current, context, { forced: true, reason: "opponent-near-held-ball" });
      }
      return intent(current, "handle", {
        mode: "pickup",
        inBox,
        target: { ...ball.position },
        actionStatus: "current-source-bound",
      });
    }
    return selectGroundPossession(current, context.possessionChoice);
  }

  if (possession === 0) {
    if (
      inBox
      && context.shotPending === true
      && context.shotAcknowledged !== true
      && distance < 50 * pitch.ratio
      && canKeeperHandle(current.nativePlayerNumber, context.cannotPickUp ?? 0)
    ) {
      return saveIntent(current, context, { forced: false, reason: "pending-shot" });
    }
    if (inBox && ball.inAir && distance < 80) {
      return saveIntent(current, context, { forced: false, reason: "near-airborne-ball" });
    }
  } else if (!sameNativeTeam(current.nativePlayerNumber, possession)) {
    const seed = requireIntegerRange(context.seed, 0, 127, "keeper context seed");
    if (inBox && distance < 4 * pitch.ratio && seed > current.attributes.flair) {
      return saveIntent(current, context, { forced: true, reason: "dive-at-feet" });
    }
  }

  return intent(current, "position", {
    ...resolveCssoccerKeeperPosition(current, {
      ...context,
      pitch,
      ball,
      possession,
    }),
    inBox,
  });
}

export function resolveCssoccerKeeperPosition(player, context = {}) {
  const current = requireKeeper(player);
  requirePlainObject(context, "keeper position context");
  const pitch = requirePitch(context.pitch);
  const ball = requireBall(context.ball);
  const constants = requireKeeperConstants(context.sourceConstants, {
    positionOnly: true,
  });
  const possession = requireIntegerRange(context.possession ?? 0, 0, 22, "possession");
  const left = current.nativePlayerNumber === 1;
  const goalX = left ? 0 : pitch.length;
  const distanceFromGoal = F32(planarDistance(
    { x: goalX, y: pitch.centreY },
    ball.position,
  ));
  const inBox = cssoccerKeeperBoxStatus(current, pitch);
  const opponentPossession = possession !== 0
    && !sameNativeTeam(current.nativePlayerNumber, possession);
  // close_angle stores cd and its incoming distance as f32 before the x87
  // gd expression, then stores gd and each output coordinate as f32.
  const closeDistance = F32(
    constants.closeAngleDistance
      + (pitch.ratio * current.attributes.vision) / 8,
  );

  if (opponentPossession && inBox && distanceFromGoal < closeDistance) {
    const targetDistance = F32(
      pitch.ratio
        + distanceFromGoal * ((closeDistance - distanceFromGoal) / closeDistance),
    );
    return deepFreeze({
      mode: "close-angle",
      target: {
        x: F32(
          goalX + ((ball.position.x - goalX) * targetDistance) / distanceFromGoal,
        ),
        y: F32(
          pitch.centreY
            + ((ball.position.y - pitch.centreY) * targetDistance) / distanceFromGoal,
        ),
      },
    });
  }

  return deepFreeze({
    mode: "offline",
    target: {
      x: left ? constants.keeperOffline : pitch.length - constants.keeperOffline,
      y: pitch.centreY - 1,
    },
  });
}

export function selectCssoccerKeeperSaveTarget(player, context = {}) {
  const current = requireKeeper(player);
  requirePlainObject(context, "keeper save context");
  const pitch = requirePitch(context.pitch);
  const constants = requireKeeperConstants(context.sourceConstants);
  const predictions = requirePredictions(context.predictions);
  const forced = context.forced === true;

  if (forced) {
    const point = predictions[CSSOCCER_KEEPER_AI_SOURCE.forcedDivePredictionIndex];
    if (!point) throw new Error("Forced keeper dive requires prediction index 3.");
    const distance = planarDistance(current.position, point);
    if (distance === 0) {
      return deepFreeze({ predictionIndex: 3, target: { ...point }, forced: true });
    }
    return deepFreeze({
      predictionIndex: 3,
      target: {
        x: point.x + ((point.x - current.position.x) / distance) * pitch.ratio,
        y: point.y + ((point.y - current.position.y) / distance) * pitch.ratio,
        z: point.z,
      },
      forced: true,
    });
  }

  let previous = predictions[0];
  let closest = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < Math.min(predictions.length, 50); index += 1) {
    const point = predictions[index];
    if (!insideKeeperSaveArea(current, point, pitch)) {
      previous = point;
      continue;
    }
    if (point.z > constants.saveJumpHeight + pitch.ratio / 2) {
      previous = point;
      continue;
    }
    const distance = planarDistance(current.position, point);
    if (distance < closestDistance) {
      closest = { index, point, previous };
      closestDistance = distance;
    } else if (closest && distance - closestDistance > pitch.ratio) {
      break;
    }
    previous = point;
  }
  if (!closest) {
    return deepFreeze({ status: "no-save-path", forced: false });
  }
  return deepFreeze({
    status: "save-path",
    predictionIndex: closest.index,
    target: {
      x: closest.previous.x + (closest.point.x - closest.previous.x) / 2,
      y: closest.previous.y + (closest.point.y - closest.previous.y) / 2,
      z: closest.previous.z + (closest.point.z - closest.previous.z) / 2,
    },
    forced: false,
  });
}

/**
 * INTELL.CPP go_to_save_path over the current BALL.CPP trajectory. The plan
 * owns no retained coordinates: every prediction is stepped from `ball`.
 */
export function planCssoccerKeeperSave(input = {}) {
  requirePlainObject(input, "keeper save-plan input");
  const keeper = requireKeeper(input.keeper);
  const pitch = requirePitch(input.pitch);
  const ball = createBallMatchState(input.ball);
  if (
    ball.limbo.active !== 0
    || ball.outcome !== null
    || ball.ball.inGoal !== 0
    || ball.ball.outOfPlay !== 0
    || ball.ball.still !== 0
  ) {
    return deepFreeze({
      schema: CSSOCCER_KEEPER_SAVE_PLAN_SCHEMA,
      status: "no-save-path",
      plannedAtTick: ball.ball.tick,
      keeperNativePlayer: keeper.nativePlayerNumber,
      reason: "ball-not-a-live-threat",
    });
  }

  const predictions = [clonePoint(ball.ball.position)];
  let predicted = ball;
  for (let index = 1; index < 50; index += 1) {
    let stepped;
    try {
      stepped = stepBallMatchState(predicted, {
        ...(predicted.ball.afterTouch.user === 0
          ? {}
          : { afterTouchInput: { x: F32(0), y: F32(0) } }),
      });
    } catch {
      break;
    }
    predicted = stepped.state;
    predictions.push(clonePoint(predicted.ball.position));
    if (predicted.outcome !== null) break;
  }
  if (predictions.length < 4) {
    return deepFreeze({
      schema: CSSOCCER_KEEPER_SAVE_PLAN_SCHEMA,
      status: "no-save-path",
      plannedAtTick: ball.ball.tick,
      keeperNativePlayer: keeper.nativePlayerNumber,
      reason: "trajectory-ended-before-dive-window",
    });
  }

  const save = selectCssoccerKeeperSaveTarget(keeper, {
    pitch,
    sourceConstants: BOUND_KEEPER_CONSTANTS,
    predictions,
    forced: false,
  });
  if (save.status !== "save-path") {
    return deepFreeze({
      schema: CSSOCCER_KEEPER_SAVE_PLAN_SCHEMA,
      status: "no-save-path",
      plannedAtTick: ball.ball.tick,
      keeperNativePlayer: keeper.nativePlayerNumber,
      reason: "trajectory-misses-keeper-area",
    });
  }

  const distance = planarDistance(keeper.position, save.target);
  const zone = distance <= pitch.ratio
    ? "A"
    : distance <= pitch.ratio * 2.5
      ? "B"
      : distance <= pitch.ratio * 8.5
        ? "C"
        : null;
  const height = save.target.z < pitch.ratio
    ? "feet"
    : save.target.z < pitch.ratio * 2
      ? "body"
      : save.target.z < pitch.ratio * 2.5
        ? "head"
        : "jump";
  if (zone === null) {
    return deepFreeze({
      schema: CSSOCCER_KEEPER_SAVE_PLAN_SCHEMA,
      status: "no-save-path",
      plannedAtTick: ball.ball.tick,
      keeperNativePlayer: keeper.nativePlayerNumber,
      reason: "target-outside-save-zone",
    });
  }

  const keeperSpeed = F32((keeper.attributes.flair + keeper.attributes.pace) / 128);
  const profile = SAVE_ACTION_PROFILES[zone][height].find((candidate) => (
    save.predictionIndex <= candidate.contactTicks / keeperSpeed
  ));
  if (profile === undefined) {
    return deepFreeze({
      schema: CSSOCCER_KEEPER_SAVE_PLAN_SCHEMA,
      status: "no-save-path",
      plannedAtTick: ball.ball.tick,
      keeperNativePlayer: keeper.nativePlayerNumber,
      reason: "no-source-save-reaches-current-ball",
    });
  }

  const ticksToContact = Math.max(1, save.predictionIndex);
  const goDisplacement = {
    x: F32((save.target.x - keeper.position.x) / ticksToContact),
    y: F32((save.target.y - keeper.position.y) / ticksToContact),
  };
  const right = keeper.nativePlayerNumber === 1
    ? save.target.y < keeper.position.y
    : save.target.y > keeper.position.y;
  const paired = zone !== "A";
  const animation = profile.animation + (paired && right ? 1 : 0);
  return deepFreeze({
    schema: CSSOCCER_KEEPER_SAVE_PLAN_SCHEMA,
    status: "save-path",
    plannedAtTick: ball.ball.tick,
    keeperNativePlayer: keeper.nativePlayerNumber,
    contactTick: ball.ball.tick + ticksToContact,
    predictionIndex: save.predictionIndex,
    target: clonePoint(save.target),
    contactOffset: { x: F32(0), y: F32(0), z: F32(0) },
    goDisplacement,
    zone,
    height,
    animation,
    animationName: profile.name,
    contact: profile.contact,
    frameStep: F32(profile.contact / ticksToContact),
    outcome: profile.outcome,
    keeperSpeed,
    sourceBallTick: ball.ball.tick,
  });
}

/** BALLINT.CPP SAVE_ACT contact: current geometry decides catch, block, or miss. */
export function resolveCssoccerKeeperSaveContact(input = {}) {
  requirePlainObject(input, "keeper save-contact input");
  const ball = createBallMatchState(input.ball);
  const possession = createPossessionState(input.possession);
  const keeper = requireKeeper(input.keeper);
  const plan = requireSavePlan(input.plan, keeper.nativePlayerNumber);
  const animationFrame = requireFinite(input.animationFrame, "keeper animation frame");
  const goDisplacement = requirePlanarPoint(
    input.goDisplacement ?? plan.goDisplacement,
    "keeper save go displacement",
  );
  if (animationFrame + 0.00001 < plan.contact) {
    return deepFreeze({
      status: "pending",
      outcome: null,
      ball,
      possession,
    });
  }

  const contactPoint = {
    x: F32(keeper.position.x + plan.contactOffset.x),
    y: F32(keeper.position.y + plan.contactOffset.y),
    z: F32(keeper.position.z + plan.contactOffset.z),
  };
  const distance = planarDistance(contactPoint, ball.ball.position);
  const saveContact = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.saveContact.value;
  if (
    !(distance < saveContact)
    || ball.ball.inGoal !== 0
    || ball.outcome !== null
  ) {
    return deepFreeze({
      status: "resolved",
      outcome: "miss",
      distance,
      ball,
      possession,
    });
  }

  if (plan.outcome === "catch") {
    const caughtPossession = collectPossession(possession, keeper.nativePlayerNumber, {
      inHands: true,
    });
    const caughtBall = createBallMatchState({
      ...clone(ball),
      ball: {
        ...clone(ball.ball),
        position: clonePoint(ball.ball.position),
        displacement: { x: F32(0), y: F32(0), z: F32(0) },
        inAir: 0,
        still: 1,
        speed: 0,
        spin: {
          swerve: 0,
          count: 0,
          nativeState: 0,
          fullXY: F32(0),
          fullZ: F32(0),
          xy: F32(0),
          z: F32(0),
        },
        afterTouch: {
          user: 0,
          shotDirection: { x: F32(0), y: F32(0) },
        },
      },
    });
    return deepFreeze({
      status: "resolved",
      outcome: "catch",
      distance,
      ball: caughtBall,
      possession: caughtPossession,
    });
  }

  const closeness = saveContact - distance;
  const skill = F32(
    (closeness * keeper.attributes.flair) / (saveContact * 128),
  );
  const displacement = {
    x: F32(
      (-(1 - skill) * ball.ball.displacement.x)
        + (skill * goDisplacement.x),
    ),
    y: F32(
      (-(1 - skill) * ball.ball.displacement.y)
        + (skill * goDisplacement.y),
    ),
    z: F32(
      ball.ball.position.z
        > CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value
        ? 3 + ball.ball.displacement.z * 0.6
        : ball.ball.displacement.z * 0.6,
    ),
  };
  const parriedBall = createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      position: clonePoint(ball.ball.position),
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
      afterTouch: {
        user: 0,
        shotDirection: { x: F32(0), y: F32(0) },
      },
    },
  });
  return deepFreeze({
    status: "resolved",
    outcome: "parry",
    distance,
    ball: parriedBall,
    possession: touchWithoutPossession(possession, keeper.nativePlayerNumber),
  });
}

function saveIntent(player, context, { forced, reason }) {
  const save = selectCssoccerKeeperSaveTarget(player, {
    pitch: context.pitch,
    sourceConstants: context.sourceConstants,
    predictions: context.predictions,
    forced,
  });
  return intent(player, "save", {
    reason,
    save,
    actionStatus: "current-source-bound",
  });
}

function selectKeeperDistribution(player, choice) {
  requirePlainObject(choice, "keeper distribution choice");
  if (choice.punt === true) {
    return intent(player, "distribute", { mode: "punt" });
  }
  if (choice.passTarget !== null && choice.passTarget !== undefined) {
    const target = requireTargetPlayer(choice.passTarget, player.nativePlayerNumber);
    return intent(player, "distribute", {
      mode: "throw",
      targetPlayerId: target.id,
      targetNativePlayerNumber: target.nativePlayerNumber,
    });
  }
  if (choice.hold === true) return intent(player, "hold", { mode: "keeper-hold" });
  throw new Error("Keeper distribution requires a source-backed punt, pass target, or hold choice.");
}

function selectGroundPossession(player, choice) {
  requirePlainObject(choice, "keeper possession choice");
  if (choice.punt === true) return intent(player, "distribute", { mode: "punt-ground" });
  if (choice.runTarget) {
    return intent(player, "run", { target: requirePoint(choice.runTarget, "keeper run target") });
  }
  throw new Error("Keeper ground possession requires a source-backed punt or run choice.");
}

function intent(player, kind, details = {}) {
  return deepFreeze({
    schema: CSSOCCER_KEEPER_AI_SCHEMA,
    playerId: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    kind,
    ...details,
  });
}

function requireKeeper(value) {
  requirePlainObject(value, "keeper player");
  if (typeof value.id !== "string" || !isCssoccerKeeperNumber(value.nativePlayerNumber)) {
    throw new Error("Keeper AI accepts only native player 1 or 12.");
  }
  const position = requirePoint(value.position, `position for ${value.id}`, true);
  requirePlainObject(value.attributes, `attributes for ${value.id}`);
  const attributes = {
    flair: requireIntegerRange(value.attributes.flair, 0, 128, `${value.id} flair`),
    vision: requireIntegerRange(value.attributes.vision, 0, 128, `${value.id} vision`),
    pace: requireIntegerRange(value.attributes.pace, 0, 128, `${value.id} pace`),
  };
  return deepFreeze({ ...value, position, attributes });
}

function requirePitch(value = {}) {
  requirePlainObject(value, "pitch");
  const length = value.length ?? 1280;
  const width = value.width ?? 800;
  const ratio = value.ratio ?? length / 120;
  requirePositiveFinite(length, "pitch length");
  requirePositiveFinite(width, "pitch width");
  requirePositiveFinite(ratio, "pitch ratio");
  return deepFreeze({ length, width, ratio, centreY: width / 2 });
}

function requireBall(value) {
  requirePlainObject(value, "keeper context ball");
  return deepFreeze({
    position: requirePoint(value.position, "ball position", true),
    inHands: value.inHands === true,
    inAir: value.inAir === true,
  });
}

function requireKeeperConstants(value, { positionOnly = false } = {}) {
  requirePlainObject(value, "prepared keeper source constants");
  const keeperOffline = value.keeperOffline;
  const closeAngleDistance = value.closeAngleDistance;
  requirePositiveFinite(keeperOffline, "keeperOffline");
  requirePositiveFinite(closeAngleDistance, "closeAngleDistance");
  const saveJumpHeight = positionOnly ? null : value.saveJumpHeight;
  if (!positionOnly) requirePositiveFinite(saveJumpHeight, "saveJumpHeight");
  if (
    !Object.is(keeperOffline, BOUND_KEEPER_CONSTANTS.keeperOffline)
    || !Object.is(closeAngleDistance, BOUND_KEEPER_CONSTANTS.closeAngleDistance)
    || (!positionOnly && !Object.is(saveJumpHeight, BOUND_KEEPER_CONSTANTS.saveJumpHeight))
  ) {
    throw new Error("Keeper constants diverged from the bound native gameplay profile.");
  }
  return { keeperOffline, closeAngleDistance, saveJumpHeight };
}

function requirePredictions(value) {
  if (!Array.isArray(value) || value.length < 4) {
    throw new Error("Keeper save decisions require at least four source ball predictions.");
  }
  return value.map((point, index) => requirePoint(point, `ball prediction ${index}`, true));
}

function requireTargetPlayer(value, keeperNumber) {
  requirePlainObject(value, "keeper pass target");
  const nativePlayerNumber = requireIntegerRange(
    value.nativePlayerNumber,
    1,
    22,
    "keeper pass target nativePlayerNumber",
  );
  if (!sameNativeTeam(keeperNumber, nativePlayerNumber) || nativePlayerNumber === keeperNumber) {
    throw new Error("Keeper pass target must be a different active team-mate.");
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new TypeError("Keeper pass target requires a stable id.");
  }
  return {
    id: value.id,
    nativePlayerNumber,
    position: requirePoint(value.position, "keeper pass target position", true),
  };
}

function canKeeperHandle(keeperNumber, cannotPickUp) {
  requireIntegerRange(cannotPickUp, -22, 22, "cannotPickUp");
  if (cannotPickUp <= 0) return true;
  return keeperNumber === 1 ? cannotPickUp > 11 : cannotPickUp < 12;
}

function insideKeeperSaveArea(player, point, pitch) {
  const inX = player.nativePlayerNumber === 1
    ? point.x < 18 * pitch.ratio
    : point.x > pitch.length - 18 * pitch.ratio;
  return inX
    && point.y > pitch.centreY - 21 * pitch.ratio
    && point.y < pitch.centreY + 21 * pitch.ratio;
}

function sameNativeTeam(left, right) {
  return (left <= 11) === (right <= 11);
}

function planarDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function saveProfile(name, animation, contact, frames, outcome) {
  return {
    name,
    animation,
    contact: F32(contact),
    frames,
    baseFrameStep: F32(2 / frames),
    contactTicks: F32(contact / (2 / frames)),
    outcome,
  };
}

function requireSavePlan(value, keeperNativePlayer) {
  requirePlainObject(value, "keeper save plan");
  if (
    value.schema !== CSSOCCER_KEEPER_SAVE_PLAN_SCHEMA
    || value.status !== "save-path"
    || value.keeperNativePlayer !== keeperNativePlayer
    || !Number.isSafeInteger(value.contactTick)
    || !Number.isSafeInteger(value.animation)
    || !new Set(["catch", "parry"]).has(value.outcome)
  ) {
    throw new Error("Keeper save contact requires one current source save-path plan.");
  }
  requirePoint(value.target, "keeper save-plan target", true);
  requirePoint(value.contactOffset, "keeper save-plan contact offset", true);
  requirePlanarPoint(value.goDisplacement, "keeper save-plan go displacement");
  requireFinite(value.contact, "keeper save-plan contact");
  return value;
}

function requirePlanarPoint(value, label) {
  return requirePoint(value, label, false);
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function clonePoint(value) {
  return {
    x: F32(value.x),
    y: F32(value.y),
    z: F32(value.z ?? 0),
  };
}

function requirePoint(value, label, includeZ = false) {
  requirePlainObject(value, label);
  const point = { x: value.x, y: value.y };
  if (includeZ) point.z = value.z ?? 0;
  if (Object.values(point).some((entry) => !Number.isFinite(entry))) {
    throw new TypeError(`${label} must contain finite coordinates.`);
  }
  return point;
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
  return value;
}

function requirePositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`);
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function clone(value) {
  return structuredClone(value);
}

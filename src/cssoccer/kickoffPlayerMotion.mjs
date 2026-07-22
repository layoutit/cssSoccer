import { assertCssoccerKickoffState } from "./kickoffState.mjs";
import {
  CSSOCCER_SPEED_INTENT,
  actualPlayerSpeed,
  sourceFacingDirection,
  updateSourcePosition2d,
} from "./motionState.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  assertCssoccerNativeGameplayProfile,
  projectCssoccerMotionSourceProfile,
  projectCssoccerTravelSourceProfile,
} from "./nativeGameplayProfile.mjs";

const F32 = Math.fround;
const FIXTURE_ID = "spain-argentina-full-match";
const SOURCE_ORDER = Object.freeze(["do_action", "process_dir"]);
const TRAVEL_CHOICES = new Set([
  "not-planned",
  "within-position-tolerance",
  "arrived",
  "side-step",
  "rotate-and-run",
  "turn-and-run",
]);

export const CSSOCCER_KICKOFF_PLAYER_MOTION_SCHEMA =
  "cssoccer-kickoff-player-motion@1";

export const CSSOCCER_KICKOFF_PLAYER_MOTION_SOURCE = deepFreeze({
  files: [
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: [
        "full_spd",
        "init_stand_act",
        "init_run_act",
        "go_forward",
        "new_dir",
        "process_dir",
        "go_team action-before-direction scheduling",
      ],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["get_there_time", "find_zonal_target"],
    },
    {
      file: "MATHS.CPP",
      sha256: "c7f61a26ce63ab439829f8c84a840f2c781704a44f2d06f149cf872013a96107",
      producers: ["calc_dist"],
    },
  ],
  sourceOrder: SOURCE_ORDER,
  requiredInputs: [
    "22 prepared player identities, native slots, source/data-bound dynamic tm_rate values, positions, and facings",
    "kickoffState source-owned centre targets",
    "nativeGameplayProfile compiled motion constants",
    "pitchLength",
    "GO_TO_POS_DIST as goToPositionDistance",
  ],
  supportedSubset: [
    "active opening and post-swap kickoff starters",
    "STAND_ACT and RUN_ACT",
    "dir_mode 0 target-facing and dir_mode 1 ball-facing",
    "normal no-possession, no-user-burst source travel",
    "find_zonal_target side-step request TRUE",
    "must_face false",
  ],
  unsupportedHere: [
    "animation ids, frames, work counters, contacts, and vertical motion",
    "possession, user burst, intercept, celebration, or must_face travel",
    "actions other than bound stand and run ids",
    "direction modes other than target-facing 0 and ball-facing 1",
    "dynamic targets after the kickoff positioning phase",
  ],
});

export class CssoccerUnsupportedKickoffPlayerMotionError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedKickoffPlayerMotionError";
    this.code = "CSSOCCER_UNSUPPORTED_KICKOFF_PLAYER_MOTION";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/**
 * Materialize the source travel state for the exact 22-player kickoff roster.
 * Prepared/native evidence stays at the caller boundary; this reducer retains
 * only ordinary gameplay values and compiled profile bindings.
 */
export function createCssoccerKickoffPlayerMotion(input = {}) {
  requirePlainObject(input, "kickoff player motion input");
  requireExactKeys(input, [
    "goToPositionDistance",
    "kickoffState",
    "nativeGameplayProfile",
    "pitchLength",
    "players",
    "selectedCountry",
  ], "kickoff player motion input");

  const kickoff = assertCssoccerKickoffState(input.kickoffState);
  const profile = assertCssoccerNativeGameplayProfile(input.nativeGameplayProfile);
  const selectedCountry = requireCountry(input.selectedCountry, "selected country");
  const pitchLength = requirePositiveIntegerF32(input.pitchLength, "pitchLength");
  const goToPositionDistance = requirePositiveFinite(
    input.goToPositionDistance,
    "goToPositionDistance (GO_TO_POS_DIST)",
  );

  if (kickoff.phase !== "centre-positioning" || kickoff.phaseTick !== 0) {
    throw new Error("Kickoff player motion must start at the centre-positioning tick-zero boundary.");
  }
  if (kickoff.sourceProfile.profileHash !== profile.profileHash) {
    throw new Error("Kickoff targets and motion constants must share one native gameplay profile.");
  }
  const actionIds = profile.constants.actionIds;
  if (
    kickoff.sourceProfile.actionIds.stand !== actionIds.stand.value
    || kickoff.sourceProfile.actionIds.run !== actionIds.run.value
  ) {
    throw new Error("Kickoff and motion action ids diverged.");
  }

  return createMotionState({
    profile,
    selectedCountry,
    pitchLength,
    goToPositionDistance,
    targetPlayers: kickoff.players,
    ballPosition: kickoff.ball.position,
    initialTick: kickoff.phaseTick,
    matchHalf: kickoff.matchHalf,
    teamBySlot: kickoff.teamBySlot,
    players: input.players,
    kickoffSourceProfileHash: kickoff.sourceProfile.profileHash,
  });
}

/**
 * Create the same source travel reducer from a fresh current-state centre
 * setup. This is the free-play entrypoint: it accepts ordinary player/target
 * values and the compiled gameplay profile, with no lifecycle, capture, or
 * retained-state binding.
 */
export function createCssoccerCurrentKickoffPlayerMotion(input = {}) {
  requirePlainObject(input, "current kickoff player motion input");
  requireExactKeys(input, [
    "ballPosition",
    "goToPositionDistance",
    "matchHalf",
    "nativeGameplayProfile",
    "pitchLength",
    "players",
    "selectedCountry",
    "targetPlayers",
    "teamBySlot",
  ], "current kickoff player motion input");

  const profile = assertCssoccerNativeGameplayProfile(input.nativeGameplayProfile);
  const selectedCountry = requireCountry(input.selectedCountry, "selected country");
  const pitchLength = requirePositiveIntegerF32(input.pitchLength, "pitchLength");
  const goToPositionDistance = requirePositiveFinite(
    input.goToPositionDistance,
    "goToPositionDistance (GO_TO_POS_DIST)",
  );
  if (input.matchHalf !== 0 && input.matchHalf !== 1) {
    throw new TypeError("Current kickoff matchHalf must be 0 or 1.");
  }
  requireTeamBySlot(input.teamBySlot, input.matchHalf);
  const ballPosition = requireF32Point(input.ballPosition, "current kickoff ball position");
  const targetPlayers = requireCurrentTargets(input.targetPlayers, input.teamBySlot);

  return createMotionState({
    profile,
    selectedCountry,
    pitchLength,
    goToPositionDistance,
    targetPlayers,
    ballPosition,
    initialTick: 0,
    matchHalf: input.matchHalf,
    teamBySlot: input.teamBySlot,
    players: input.players,
    kickoffSourceProfileHash: profile.profileHash,
  });
}

function createMotionState({
  profile,
  selectedCountry,
  pitchLength,
  goToPositionDistance,
  targetPlayers,
  ballPosition,
  initialTick,
  matchHalf,
  teamBySlot,
  players: initialPlayers,
  kickoffSourceProfileHash,
}) {
  const actionIds = profile.constants.actionIds;
  const keeperNativePlayers = targetPlayers
    .filter(({ role }) => role === "keeper")
    .map(({ nativePlayerNumber }) => nativePlayerNumber);
  if (!sameValue(keeperNativePlayers, [1, 12])) {
    throw new Error("Kickoff player motion requires the source keeper native slots 1 and 12.");
  }

  const players = requireInitialPlayers(initialPlayers, targetPlayers, {
    profile,
    actionIds: {
      stand: actionIds.stand.value,
      run: actionIds.run.value,
    },
    goToPositionDistance,
  });
  const config = deepFreeze({
    actionIds: {
      stand: actionIds.stand.value,
      run: actionIds.run.value,
    },
    ballPosition: {
      x: ballPosition.x,
      y: ballPosition.y,
    },
    goToPositionDistance,
    keeperNativePlayers,
    pitchLength,
  });
  const bindings = deepFreeze({
    nativeGameplayProfileHash: profile.profileHash,
    kickoffSourceProfileHash,
    nativeBuildSha256: profile.bindings.nativeBuildSha256,
    sourceRevision: profile.bindings.sourceRevision,
  });

  return assemble({
    bindings,
    config,
    initialTick,
    tick: initialTick,
    matchHalf,
    selectedCountry,
    teamBySlot: clone(teamBySlot),
    players,
    initialPlayers: clone(players),
  });
}

function requireCurrentTargets(value, teamBySlot) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Current kickoff requires exactly 22 target players.");
  }
  return value.map((target, index) => {
    requirePlainObject(target, `current kickoff target ${index + 1}`);
    requireExactKeys(target, [
      "active",
      "country",
      "id",
      "nativePlayerNumber",
      "nativeTeamSlot",
      "role",
      "target",
      "targetOwner",
    ], `current kickoff target ${index + 1}`);
    const nativeTeamSlot = index < 11 ? "A" : "B";
    const expectedCountry = teamBySlot[nativeTeamSlot];
    if (
      target.nativePlayerNumber !== index + 1
      || target.nativeTeamSlot !== nativeTeamSlot
      || target.country !== expectedCountry
      || target.id !== `${expectedCountry}-player-${String((index % 11) + 1).padStart(2, "0")}`
      || target.active !== true
      || !["keeper", "outfield", "receiver", "taker"].includes(target.role)
      || typeof target.targetOwner !== "string"
      || target.targetOwner.length === 0
    ) {
      throw new Error(`Current kickoff target ${index + 1} changed identity or role.`);
    }
    return deepFreeze({
      ...clone(target),
      target: requireF32Point(target.target, `${target.id} current kickoff target`),
    });
  });
}

/** Advance one native positioning tick: action/movement first, direction last. */
export function stepCssoccerKickoffPlayerMotion(state, options = {}) {
  const current = assertCssoccerKickoffPlayerMotion(state);
  requirePlainObject(options, "kickoff player motion step options");
  requireExactKeys(options, options.teamRates === undefined ? [] : ["teamRates"], "kickoff player motion step options");
  const ratedPlayers = applyTeamRates(
    current.players,
    options.teamRates === undefined ? null : options.teamRates,
  );
  const players = ratedPlayers.map((player) => stepPlayer(player, current.config));
  return assemble({
    bindings: clone(current.bindings),
    config: clone(current.config),
    initialTick: current.initialTick,
    tick: current.tick + 1,
    matchHalf: current.matchHalf,
    selectedCountry: current.selectedCountry,
    teamBySlot: clone(current.teamBySlot),
    players,
    initialPlayers: clone(current.initialPlayers),
  });
}

/** Return the exact immutable tick-zero state retained by this reducer. */
export function resetCssoccerKickoffPlayerMotion(state) {
  const current = assertCssoccerKickoffPlayerMotion(state);
  return assemble({
    bindings: clone(current.bindings),
    config: clone(current.config),
    initialTick: current.initialTick,
    tick: current.initialTick,
    matchHalf: current.matchHalf,
    selectedCountry: current.selectedCountry,
    teamBySlot: clone(current.teamBySlot),
    players: clone(current.initialPlayers),
    initialPlayers: clone(current.initialPlayers),
  });
}

export function assertCssoccerKickoffPlayerMotion(state) {
  requirePlainObject(state, "cssoccer kickoff player motion state");
  requireExactKeys(state, [
    "bindings",
    "config",
    "fixtureId",
    "initialPlayers",
    "initialTick",
    "matchHalf",
    "players",
    "schema",
    "selectedCountry",
    "sourceOrder",
    "status",
    "teamBySlot",
    "tick",
  ], "cssoccer kickoff player motion state");
  if (
    state.schema !== CSSOCCER_KICKOFF_PLAYER_MOTION_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || !Number.isSafeInteger(state.initialTick)
    || state.initialTick < 0
    || !Number.isSafeInteger(state.tick)
    || state.tick < state.initialTick
    || ![0, 1].includes(state.matchHalf)
    || !sameValue(state.sourceOrder, SOURCE_ORDER)
  ) {
    throw new Error(`Kickoff player motion must use ${CSSOCCER_KICKOFF_PLAYER_MOTION_SCHEMA}.`);
  }
  requireCountry(state.selectedCountry, "kickoff motion selectedCountry");
  requireTeamBySlot(state.teamBySlot, state.matchHalf);
  requireBindings(state.bindings);
  const config = requireConfig(state.config);
  const players = requireMotionPlayers(state.players, config, "players");
  const initialPlayers = requireMotionPlayers(state.initialPlayers, config, "initialPlayers");
  if (initialPlayers.some(({ lastPlan }) => lastPlan !== null)) {
    throw new Error("Kickoff motion initial players cannot retain a travel plan.");
  }
  if (!sameIdentityOrder(players, initialPlayers)) {
    throw new Error("Kickoff motion current and initial player identity order diverged.");
  }
  const expectedStatus = players.every(({ active, settled }) => !active || settled)
    ? "settled"
    : "positioning";
  if (state.status !== expectedStatus) {
    throw new Error("Kickoff motion status diverged from the 22 player states.");
  }
  return state;
}

function assemble(parts) {
  const players = parts.players.map((player) => deepFreeze(clone(player)));
  const state = deepFreeze({
    schema: CSSOCCER_KICKOFF_PLAYER_MOTION_SCHEMA,
    fixtureId: FIXTURE_ID,
    sourceOrder: SOURCE_ORDER,
    ...parts,
    players,
    status: players.every(({ active, settled }) => !active || settled)
      ? "settled"
      : "positioning",
  });
  return assertCssoccerKickoffPlayerMotion(state);
}

function requireInitialPlayers(value, targets, context) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Kickoff player motion requires exactly 22 prepared players.");
  }
  return value.map((input, index) => {
    requirePlainObject(input, `kickoff motion player ${index + 1}`);
    requireExactKeys(input, [
      "action",
      "active",
      "directionMode",
      "faceDirection",
      "facing",
      "goStep",
      "id",
      "nativePlayerNumber",
      "position",
      "teamRate",
    ], `kickoff motion player ${index + 1}`);
    const target = targets[index];
    if (
      input.nativePlayerNumber !== index + 1
      || input.nativePlayerNumber !== target.nativePlayerNumber
      || input.id !== target.id
      || input.active !== target.active
    ) {
      throw new Error(`Kickoff motion player ${index + 1} diverged from native-slot target order.`);
    }
    requirePlayerId(input.id, `kickoff motion player ${index + 1} id`);
    requireBoolean(input.active, `kickoff motion player ${index + 1} active`);
    requireIntegerRange(input.teamRate, 0, 0xff, `kickoff motion player ${index + 1} tm_rate`);
    requireSupportedAction(input.action, context.actionIds, input.id);
    requireIntegerRange(input.faceDirection, 0, 7, `${input.id} faceDirection`);
    requireSupportedDirectionMode(input.directionMode, input.id);
    requireBoolean(input.goStep, `${input.id} goStep`);
    const position = requireF32Point(input.position, `${input.id} position`);
    const facing = requireF32Point(input.facing, `${input.id} facing`);
    requireFacing(facing, input.id);
    const constants = constantsForTeamRate(context.profile, input.teamRate);
    const targetOffset = offset(target.target, position);
    const targetDistance = kickoffDistance2d(targetOffset);
    const arrived = samePoint(position, target.target);
    const settled = !input.active || (
      input.action === context.actionIds.stand
      && targetDistance <= context.goToPositionDistance
    );
    return deepFreeze({
      id: input.id,
      country: target.country,
      nativeTeamSlot: target.nativeTeamSlot,
      nativePlayerNumber: input.nativePlayerNumber,
      role: target.role,
      active: input.active,
      teamRate: input.teamRate,
      action: input.action,
      directionMode: input.directionMode,
      faceDirection: input.faceDirection,
      position: clone(position),
      facing: clone(facing),
      target: clone(target.target),
      targetOwner: target.targetOwner,
      targetOffset,
      targetDistance,
      goCount: 0,
      goStep: input.goStep,
      goStop: false,
      goDisplacement: zeroPoint(),
      lastPlan: null,
      arrived,
      settled,
      constants,
    });
  });
}

function applyTeamRates(players, teamRates) {
  if (teamRates === null) return players.map((player) => deepFreeze(clone(player)));
  if (!Array.isArray(teamRates) || teamRates.length !== players.length) {
    throw new Error("Kickoff player motion requires exactly 22 dynamic team-rate entries.");
  }
  return players.map((player, index) => {
    const rate = teamRates[index];
    requirePlainObject(rate, `kickoff dynamic team rate ${index + 1}`);
    requireExactKeys(rate, [
      "id",
      "nativePlayerNumber",
      "numericBits",
      "value",
      "valueType",
    ], `kickoff dynamic team rate ${index + 1}`);
    requireIntegerRange(rate.value, 0, 0xff, `${player.id} dynamic tm_rate`);
    if (
      rate.id !== player.id
      || rate.nativePlayerNumber !== player.nativePlayerNumber
      || rate.valueType !== "u8"
      || rate.numericBits !== rate.value.toString(16).padStart(2, "0")
    ) {
      throw new Error(`${player.id} dynamic tm_rate changed identity, slot, type, or bits.`);
    }
    const next = clone(player);
    next.teamRate = rate.value;
    next.constants = constantsForTeamRate(CSSOCCER_NATIVE_GAMEPLAY_PROFILE, rate.value);
    return deepFreeze(next);
  });
}

function constantsForTeamRate(profile, teamRate) {
  const motion = projectCssoccerMotionSourceProfile(profile, { teamRate });
  const travel = projectCssoccerTravelSourceProfile(profile, { teamRate });
  return deepFreeze({
    maxTurnRadians: motion.maxTurnRadians,
    maxTurn2Radians: travel.maxTurn2Radians,
    imThereDistance: travel.imThereDistance,
    stepRange: travel.stepRange,
  });
}

function stepPlayer(player, config) {
  if (!player.active) return deepFreeze(clone(player));
  let next = clone(player);
  const distance = kickoffDistance2d(offset(next.target, next.position));
  const shouldPlan = next.role === "keeper"
    || next.action === config.actionIds.run
    || distance > config.goToPositionDistance;

  if (shouldPlan) {
    next = initializeRun(next, config);
    if (next.action === config.actionIds.run) {
      next = goForward(next, config);
      // INTELL.CPP find_zonal_target clears the countdown after one action.
      next.goCount = 0;
    }
  } else {
    next.lastPlan = {
      choice: "within-position-tolerance",
      plannedTicks: 0,
      turnTicks: 0,
    };
  }

  next = processDirection(next, config.ballPosition);
  next.targetOffset = offset(next.target, next.position);
  next.targetDistance = kickoffDistance2d(next.targetOffset);
  next.arrived = samePoint(next.position, next.target);
  next.settled = next.action === config.actionIds.stand
    && next.targetDistance <= config.goToPositionDistance;
  return deepFreeze(next);
}

function initializeRun(player, config) {
  const next = clone(player);
  const targetOffset = offset(next.target, next.position);
  const distance = kickoffDistance2d(targetOffset);
  next.targetOffset = targetOffset;
  next.targetDistance = distance;

  if (distance < next.constants.imThereDistance) {
    next.position = clone(next.target);
    next.action = config.actionIds.stand;
    next.goDisplacement = zeroPoint();
    next.directionMode = 1;
    next.lastPlan = { choice: "arrived", plannedTicks: 0, turnTicks: 0 };
    return next;
  }

  const alignment = kickoffAngleCosine({ target: targetOffset, facing: next.facing });
  let sideRequest = 1;
  if (alignment >= Math.cos(next.constants.maxTurnRadians)) {
    next.goStep = false;
    sideRequest = 2;
  }
  if (
    sideRequest !== 0
    && (
      (next.goStep && distance < next.constants.stepRange * 2)
      || (!next.goStep && distance < next.constants.stepRange)
    )
  ) {
    next.goStop = false;
    next.goStep = true;
    const speed = playerSpeed(next, config, true);
    const goCount = requireNativeCountdown(
      Math.trunc((distance / speed) + 1),
      `${next.id} side-step countdown`,
    );
    next.goCount = goCount;
    next.goDisplacement = {
      x: F32(targetOffset.x / goCount),
      y: F32(targetOffset.y / goCount),
    };
    next.directionMode = sideRequest === 1 ? 1 : 0;
    next.action = config.actionIds.run;
    next.lastPlan = { choice: "side-step", plannedTicks: goCount, turnTicks: 0 };
    return next;
  }

  next.goStep = false;
  const plan = getThereTime(next, config);
  next.goCount = requireNativeCountdown(plan.plannedTicks, `${next.id} run countdown`);
  next.goStop = plan.choice === "rotate-and-run";
  let denominator = next.goCount;
  if (next.goStop) {
    denominator -= plan.turnTicks;
  }
  if (denominator <= 0) {
    throw new CssoccerUnsupportedKickoffPlayerMotionError(
      "init_run_act.go_cnt",
      `Source travel produced a non-positive displacement denominator for ${next.id}.`,
      { denominator, plan },
    );
  }
  next.goDisplacement = {
    x: F32(targetOffset.x / denominator),
    y: F32(targetOffset.y / denominator),
  };
  next.directionMode = 0;
  next.action = config.actionIds.run;
  next.lastPlan = plan;
  return next;
}

function getThereTime(player, config) {
  const speed = playerSpeed(player, config, false);
  const initialOffset = offset(player.target, player.position);
  const maxTurn = player.constants.maxTurn2Radians;
  const firstAlignment = kickoffAngleCosine({
    target: initialOffset,
    facing: player.facing,
  });
  const turnTicks = Math.trunc(Math.abs(Math.acos(firstAlignment) / maxTurn));
  const straightTicks = requireNativeCountdown(
    turnTicks + Math.trunc((kickoffDistance2d(initialOffset) / speed) + 1),
    `${player.id} straight countdown`,
  );

  let x = initialOffset.x;
  let y = initialOffset.y;
  let facingX = player.facing.x;
  let facingY = player.facing.y;
  let alignment = firstAlignment;
  let lastAlignment = alignment;
  let distance = kickoffDistance2d({ x, y });
  let turningTicks = 0;
  // INTELL.CPP stores cos(max) in local float cmax before the loop.
  const cosineMaximum = F32(Math.cos(maxTurn));

  for (let index = 0; index < 50; index += 1) {
    if (distance < player.constants.imThereDistance) break;
    turningTicks += 1;

    const turnSpeed = F32((1 + alignment) / 2);
    // Watcom/x87 evaluates the complete product before each float assignment.
    x = F32(x - (facingX * speed * turnSpeed));
    y = F32(y - (facingY * speed * turnSpeed));
    distance = kickoffDistance2d({ x, y });

    const oldX = facingX;
    const oldY = facingY;
    if (alignment < cosineMaximum) {
      let appliedTurn = maxTurn;
      const left = (x * oldY) / distance;
      const right = (y * oldX) / distance;
      if (left > right) appliedTurn = F32(-appliedTurn);
      facingX = F32((oldX * Math.cos(appliedTurn)) - (oldY * Math.sin(appliedTurn)));
      facingY = F32((oldY * Math.cos(appliedTurn)) + (oldX * Math.sin(appliedTurn)));
    } else {
      turningTicks = Math.trunc(turningTicks + (distance / speed));
      const residual = distance - ((turningTicks - 1) * speed);
      if (residual > 0.1) turningTicks += 1;
      break;
    }

    lastAlignment = alignment;
    alignment = kickoffAngleCosine({
      target: { x, y },
      facing: { x: facingX, y: facingY },
    });
    if (lastAlignment > alignment) {
      turningTicks = 2000;
      break;
    }
  }

  turningTicks = requireNativeCountdown(turningTicks, `${player.id} turning countdown`);
  if (straightTicks < turningTicks) {
    return deepFreeze({
      choice: "rotate-and-run",
      plannedTicks: straightTicks,
      turnTicks,
    });
  }
  return deepFreeze({
    choice: "turn-and-run",
    plannedTicks: turningTicks,
    turnTicks: 0,
  });
}

function goForward(player, config) {
  const next = clone(player);
  // ACTIONS.CPP calls actual_spd before branching even though the side-step
  // branch consumes its precomputed displacement.
  playerSpeed(next, config, next.goStep);
  if (next.goStep) {
    next.position = updateSourcePosition2d({
      position: next.position,
      displacement: next.goDisplacement,
    });
    return next;
  }

  if (next.goStop) {
    const alignment = kickoffAngleCosine({
      target: next.goDisplacement,
      facing: next.facing,
    });
    if (alignment >= Math.cos(next.constants.maxTurnRadians)) {
      next.goStop = false;
      next.position = updateSourcePosition2d({
        position: next.position,
        displacement: next.goDisplacement,
      });
    }
    return next;
  }

  const speed = playerSpeed(next, config, false);
  const forward = kickoffForwardDisplacement({
    facing: next.facing,
    targetOffset: offset(next.target, next.position),
    speed,
  });
  next.goDisplacement = clone(forward.displacement);
  next.position = updateSourcePosition2d({
    position: next.position,
    displacement: next.goDisplacement,
  });
  return next;
}

function processDirection(player, ballPosition) {
  const next = clone(player);
  requireSupportedDirectionMode(next.directionMode, next.id);
  const directionTarget = next.directionMode === 0
    ? offset(next.target, next.position)
    : offset(ballPosition, next.position);
  if (directionTarget.x === 0 && directionTarget.y === 0) return next;
  const turn = turnKickoffFacing({
    facing: next.facing,
    target: directionTarget,
    maxTurnRadians: next.constants.maxTurnRadians,
  });
  next.facing = clone(turn.facing);
  next.faceDirection = turn.faceDirection;
  return next;
}

// These helpers preserve the float stores in the native kickoff call graph.
// The shared motion primitives intentionally round every arithmetic step; the
// Watcom/x87 build instead retains each full expression until assignment.
function kickoffDistance2d(vector) {
  const { x, y } = requireF32Point(vector, "kickoff distance vector");
  const distance = F32(Math.sqrt((x * x) + (y * y)));
  return distance > 0.1 ? distance : F32(0.1);
}

function kickoffAngleCosine({ target, facing } = {}) {
  const targetVector = requireF32Point(target, "kickoff angle target");
  const facingVector = requireF32Point(facing, "kickoff angle facing");
  const targetDistance = kickoffDistance2d(targetVector);
  const facingDistance = kickoffDistance2d(facingVector);
  const targetX = F32(targetVector.x / targetDistance);
  const targetY = F32(targetVector.y / targetDistance);
  const facingX = F32(facingVector.x / facingDistance);
  const facingY = F32(facingVector.y / facingDistance);
  let difference = F32((targetX * facingX) + (targetY * facingY));
  if (difference > 1) difference = F32(1);
  if (difference < -1) difference = F32(-1);
  return difference;
}

function kickoffForwardDisplacement({ facing, targetOffset, speed } = {}) {
  const facingVector = requireF32Point(facing, "kickoff forward facing");
  const targetVector = requireF32Point(targetOffset, "kickoff forward target");
  requireF32(speed, "kickoff forward speed");
  const alignment = kickoffAngleCosine({
    target: targetVector,
    facing: facingVector,
  });
  const turnSpeed = F32((1 + alignment) / 2);
  return {
    displacement: {
      x: F32(facingVector.x * turnSpeed * speed),
      y: F32(facingVector.y * turnSpeed * speed),
    },
    alignment,
    turnSpeed,
  };
}

function turnKickoffFacing({ facing, target, maxTurnRadians } = {}) {
  const oldFacing = requireF32Point(facing, "kickoff turn facing");
  const targetVector = requireF32Point(target, "kickoff turn target");
  requirePositiveF32(maxTurnRadians, "kickoff turn MAX_TURN");

  const targetDistance = kickoffDistance2d(targetVector);
  let x = F32(targetVector.x / targetDistance);
  let y = F32(targetVector.y / targetDistance);
  const difference = F32((x * oldFacing.x) + (y * oldFacing.y));
  let appliedTurn = F32(0);

  if (difference < Math.cos(maxTurnRadians)) {
    appliedTurn = maxTurnRadians;
    if ((x * oldFacing.y) > (y * oldFacing.x)) {
      appliedTurn = F32(-appliedTurn);
    }

    const cosine = Math.cos(appliedTurn);
    const sine = Math.sin(appliedTurn);
    x = F32((oldFacing.x * cosine) - (oldFacing.y * sine));
    y = F32((oldFacing.y * cosine) + (oldFacing.x * sine));

    const correctedDistance = kickoffDistance2d({ x, y });
    x = F32(x / correctedDistance);
    y = F32(y / correctedDistance);

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
  return {
    facing: nextFacing,
    faceDirection: sourceFacingDirection(nextFacing),
    appliedTurn,
  };
}

function playerSpeed(player, config, sideStep) {
  return actualPlayerSpeed({
    pitchLength: config.pitchLength,
    teamRate: player.teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: 0,
    ballInHands: false,
    keeperNativePlayers: config.keeperNativePlayers,
    userControlIndex: 0,
    burstTimer: 0,
  });
}

function requireMotionPlayers(value, config, label) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error(`Kickoff motion ${label} must contain exactly 22 states.`);
  }
  const ids = new Set();
  return value.map((player, index) => {
    requirePlainObject(player, `kickoff motion ${label}[${index}]`);
    requireExactKeys(player, [
      "action",
      "active",
      "arrived",
      "constants",
      "country",
      "directionMode",
      "faceDirection",
      "facing",
      "goCount",
      "goDisplacement",
      "goStep",
      "goStop",
      "id",
      "lastPlan",
      "nativePlayerNumber",
      "nativeTeamSlot",
      "position",
      "role",
      "settled",
      "target",
      "targetDistance",
      "targetOffset",
      "targetOwner",
      "teamRate",
    ], `kickoff motion ${label}[${index}]`);
    if (player.nativePlayerNumber !== index + 1 || ids.has(player.id)) {
      throw new Error(`Kickoff motion ${label} must stay in unique native-slot order.`);
    }
    ids.add(player.id);
    requirePlayerId(player.id, `${label}[${index}] id`);
    requireCountry(player.country, `${player.id} country`);
    const expectedSlot = index < 11 ? "A" : "B";
    if (player.nativeTeamSlot !== expectedSlot) {
      throw new Error(`${player.id} diverged from native team slot ${expectedSlot}.`);
    }
    if (!["keeper", "outfield", "receiver", "taker"].includes(player.role)) {
      throw new Error(`${player.id} has an unsupported kickoff role.`);
    }
    requireBoolean(player.active, `${player.id} active`);
    requireIntegerRange(player.teamRate, 0, 0xff, `${player.id} teamRate`);
    requireSupportedAction(player.action, config.actionIds, player.id);
    requireSupportedDirectionMode(player.directionMode, player.id);
    requireIntegerRange(player.faceDirection, 0, 7, `${player.id} faceDirection`);
    requireF32Point(player.position, `${player.id} position`);
    requireF32Point(player.facing, `${player.id} facing`);
    requireFacing(player.facing, player.id);
    requireF32Point(player.target, `${player.id} target`);
    requireF32Point(player.targetOffset, `${player.id} targetOffset`);
    requirePositiveF32(player.targetDistance, `${player.id} targetDistance`);
    requireNativeCountdown(player.goCount, `${player.id} goCount`);
    requireBoolean(player.goStep, `${player.id} goStep`);
    requireBoolean(player.goStop, `${player.id} goStop`);
    requireF32Point(player.goDisplacement, `${player.id} goDisplacement`);
    requirePlan(player.lastPlan, player.id);
    requireBoolean(player.arrived, `${player.id} arrived`);
    requireBoolean(player.settled, `${player.id} settled`);
    requireConstants(player.constants, player.id, player.teamRate);
    if (typeof player.targetOwner !== "string" || player.targetOwner.length === 0) {
      throw new Error(`${player.id} must retain its target source owner.`);
    }
    if (
      !sameValue(player.targetOffset, offset(player.target, player.position))
      || player.targetDistance !== kickoffDistance2d(player.targetOffset)
      || player.arrived !== samePoint(player.position, player.target)
    ) {
      throw new Error(`${player.id} target distance or arrival state drifted.`);
    }
    return player;
  });
}

function requireConfig(value) {
  requirePlainObject(value, "kickoff motion config");
  requireExactKeys(value, [
    "actionIds",
    "ballPosition",
    "goToPositionDistance",
    "keeperNativePlayers",
    "pitchLength",
  ], "kickoff motion config");
  requirePlainObject(value.actionIds, "kickoff motion actionIds");
  requireExactKeys(value.actionIds, ["run", "stand"], "kickoff motion actionIds");
  requireInt16(value.actionIds.stand, "kickoff motion stand action");
  requireInt16(value.actionIds.run, "kickoff motion run action");
  if (value.actionIds.stand === value.actionIds.run) {
    throw new Error("Kickoff motion stand and run action ids must differ.");
  }
  requireF32Point(value.ballPosition, "kickoff motion ballPosition");
  requirePositiveFinite(value.goToPositionDistance, "kickoff motion GO_TO_POS_DIST");
  requirePositiveIntegerF32(value.pitchLength, "kickoff motion pitchLength");
  if (!sameValue(value.keeperNativePlayers, [1, 12])) {
    throw new Error("Kickoff motion keeper slots must be 1 and 12.");
  }
  return value;
}

function requireBindings(value) {
  requirePlainObject(value, "kickoff motion bindings");
  requireExactKeys(value, [
    "kickoffSourceProfileHash",
    "nativeBuildSha256",
    "nativeGameplayProfileHash",
    "sourceRevision",
  ], "kickoff motion bindings");
  for (const key of [
    "kickoffSourceProfileHash",
    "nativeBuildSha256",
    "nativeGameplayProfileHash",
  ]) {
    if (!isSha256(value[key])) throw new Error(`Kickoff motion ${key} must be SHA-256.`);
  }
  if (!/^[a-f0-9]{40}$/u.test(value.sourceRevision ?? "")) {
    throw new Error("Kickoff motion sourceRevision must be a pinned Git revision.");
  }
  if (value.kickoffSourceProfileHash !== value.nativeGameplayProfileHash) {
    throw new Error("Kickoff motion profile bindings diverged.");
  }
}

function requireTeamBySlot(value, matchHalf) {
  requirePlainObject(value, "kickoff motion teamBySlot");
  requireExactKeys(value, ["A", "B"], "kickoff motion teamBySlot");
  const expected = matchHalf === 0
    ? { A: "spain", B: "argentina" }
    : { A: "argentina", B: "spain" };
  if (!sameValue(value, expected)) {
    throw new Error("Kickoff motion team slots diverged from the current half.");
  }
}

function requireConstants(value, playerId, teamRate) {
  requirePlainObject(value, `${playerId} motion constants`);
  requireExactKeys(value, [
    "imThereDistance",
    "maxTurn2Radians",
    "maxTurnRadians",
    "stepRange",
  ], `${playerId} motion constants`);
  requirePositiveF32(value.imThereDistance, `${playerId} IM_THERE_DIST`);
  requirePositiveF32(value.maxTurnRadians, `${playerId} MAX_TURN`);
  requirePositiveF32(value.maxTurn2Radians, `${playerId} MAX_TURN2`);
  if (!Number.isFinite(value.stepRange) || value.stepRange <= 0) {
    throw new TypeError(`${playerId} STEP_RANGE must be positive x87 output.`);
  }
  if (!sameValue(value, constantsForTeamRate(CSSOCCER_NATIVE_GAMEPLAY_PROFILE, teamRate))) {
    throw new Error(`${playerId} motion constants diverged from its current tm_rate.`);
  }
}

function requirePlan(value, playerId) {
  if (value === null) return;
  requirePlainObject(value, `${playerId} lastPlan`);
  requireExactKeys(value, ["choice", "plannedTicks", "turnTicks"], `${playerId} lastPlan`);
  if (!TRAVEL_CHOICES.has(value.choice) || value.choice === "not-planned") {
    throw new Error(`${playerId} retained an unsupported travel choice.`);
  }
  requireNativeCountdown(value.plannedTicks, `${playerId} plannedTicks`);
  requireNativeCountdown(value.turnTicks, `${playerId} turnTicks`);
}

function requireSupportedAction(value, actionIds, playerId) {
  requireInt16(value, `${playerId} action`);
  if (value !== actionIds.stand && value !== actionIds.run) {
    throw new CssoccerUnsupportedKickoffPlayerMotionError(
      "tm_act",
      `${playerId} action ${value} is outside kickoff stand/run travel.`,
      { action: value, supported: [actionIds.stand, actionIds.run] },
    );
  }
}

function requireSupportedDirectionMode(value, playerId) {
  requireInt16(value, `${playerId} directionMode`);
  if (value !== 0 && value !== 1) {
    throw new CssoccerUnsupportedKickoffPlayerMotionError(
      "dir_mode",
      `${playerId} direction mode ${value} is outside target/ball kickoff travel.`,
      { directionMode: value, supported: [0, 1] },
    );
  }
}

function requireFacing(value, playerId) {
  const length = kickoffDistance2d(value);
  if (Math.abs(length - 1) > 0.000002) {
    throw new Error(`${playerId} facing must be a normalized source vector.`);
  }
}

function requireNativeCountdown(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0x7fff) {
    throw new CssoccerUnsupportedKickoffPlayerMotionError(
      "go_cnt",
      `${label} must fit the native non-negative i16 countdown.`,
      { value },
    );
  }
  return value;
}

function requirePositiveIntegerF32(value, label) {
  requirePositiveF32(value, label);
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be a safe integer.`);
  return value;
}

function requirePositiveF32(value, label) {
  requireF32(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
  return value;
}

function requirePositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be positive and finite.`);
  }
  return value;
}

function requireF32Point(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y"], label);
  requireF32(value.x, `${label} x`);
  requireF32(value.y, `${label} y`);
  return value;
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(F32(value), value)) {
    throw new TypeError(`${label} must be finite and exactly rounded f32.`);
  }
  return value;
}

function requireInt16(value, label) {
  if (!Number.isInteger(value) || value < -0x8000 || value > 0x7fff) {
    throw new TypeError(`${label} must be i16.`);
  }
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
}

function requireCountry(value, label) {
  if (value !== "spain" && value !== "argentina") {
    throw new Error(`${label} must be spain or argentina.`);
  }
  return value;
}

function requirePlayerId(value, label) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} is not a fixed-fixture player id.`);
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

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!sameValue(actual, wanted)) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function offset(target, position) {
  return deepFreeze({
    x: F32(target.x - position.x),
    y: F32(target.y - position.y),
  });
}

function zeroPoint() {
  return { x: F32(0), y: F32(0) };
}

function samePoint(left, right) {
  return Object.is(left.x, right.x) && Object.is(left.y, right.y);
}

function sameIdentityOrder(left, right) {
  return left.length === right.length && left.every((player, index) => (
    player.id === right[index].id
    && player.nativePlayerNumber === right[index].nativePlayerNumber
  ));
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/u.test(value ?? "");
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

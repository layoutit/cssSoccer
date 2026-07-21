import {
  CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
  assertCssoccerCentrePassActionState,
  createCssoccerCentrePassAction,
  projectCssoccerCentrePassActionNativeFields,
  stepCssoccerCentrePassAction,
} from "./centrePassAction.mjs";
import {
  assertCssoccerHeldBallState,
  createCssoccerHeldBallState,
  projectCssoccerHeldBallNativeFields,
  stepCssoccerHeldBallState,
} from "./heldBallState.mjs";
import {
  assertCssoccerMatchLifecycle,
  stepCssoccerMatchLifecycle,
} from "./matchLifecycle.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  assertCssoccerNativeFixturePlayerProfile,
} from "./nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  projectCssoccerMotionSourceProfile,
} from "./nativeGameplayProfile.mjs";
import {
  sourceDistance2d,
  turnSourceFacing,
} from "./motionState.mjs";
import {
  assertCssoccerOpeningControlState,
  createCssoccerOpeningControlAction,
  createCssoccerOpeningControlOwnership,
  createCssoccerOpeningControlState,
  projectCssoccerOpeningControlNativeFields,
  stepCssoccerOpeningControlState,
} from "./openingControlState.mjs";
import {
  assertCssoccerOpeningKickoffCoordinator,
  stepCssoccerOpeningKickoffCoordinator,
} from "./openingKickoffCoordinator.mjs";
import {
  assertCssoccerOpeningMatchState,
} from "./openingMatchState.mjs";
import {
  assertCssoccerPlayerStaminaState,
  projectCssoccerPlayerStaminaNativeFields,
  projectCssoccerPlayerStaminaTeamRates,
  stepCssoccerPlayerStaminaState,
} from "./playerStaminaState.mjs";
import {
  advanceCssoccerNativeRng,
  advanceCssoccerNativeRngMany,
  createCssoccerNativeRngState,
} from "./randomState.mjs";

const F32 = Math.fround;
const FIXTURE_ID = "spain-argentina-full-match";
const OPENING_TICK = 171;
const LAUNCH_TICK = 172;
const ACTION_COMPLETE_TICK = 185;
const QUALIFIED_THROUGH_TICK = 186;
const NORMAL_LIVE_MOTION_TICK = QUALIFIED_THROUGH_TICK;
const TAKER_NATIVE_PLAYER = 7;
const RECEIVER_NATIVE_PLAYER = 10;
const STAND_ACTION = 0;
const SOCKS_RIGHT_ANIMATION = 62;
const SOCKS_LEFT_ANIMATION = 63;
const STAND_ANIMATION = 78;
const SOCKS_PROBABILITY = 15;

export const CSSOCCER_OPENING_LIVE_LAUNCH_STATE_SCHEMA =
  "cssoccer-opening-live-launch-state@1";

export const CSSOCCER_OPENING_LIVE_LAUNCH_SOURCE_ORDER = deepFreeze([
  "advance the ordinary global Watcom RNG once for the logic tick",
  "advance the fixed lifecycle clock with no resolved goal",
  "apply process_flags stamina before process_teams",
  "on the launch tick advance the opening coordinator through match_rules into the centre-pass launch receipt",
  "advance MC_PASSL, held/free/receiver ball interaction, and KICK_ACT recovery from explicit source-owner inputs",
  "after centre-pass completion, advance process_ball then the qualified native-player-10 BALLINT.CPP hold_ball transition",
  "on pass_ball consume the ordinary RNG cursor once more and retain that extra call in the action lineage",
  "clear then assign the selected country's auto-player control from the centre-pass action owner",
]);

export const CSSOCCER_OPENING_LIVE_LAUNCH_QUALIFICATION = deepFreeze({
  fixtureId: FIXTURE_ID,
  openingTick: OPENING_TICK,
  launchTick: LAUNCH_TICK,
  qualifiedThroughTick: QUALIFIED_THROUGH_TICK,
  nativeExactOwnedFields: true,
  globalRng: {
    ordinaryCallsPerTick: 1,
    passBallExtraCalls: 1,
    capturedExactWhile: "centre-pass action has not released",
    withheldAfter:
      "release because ordinary live AI owns later same-tick RNG calls not composed here",
  },
  unsupportedNext: {
    tick: NORMAL_LIVE_MOTION_TICK,
    phase: "post_tick",
    fieldId: "players.argentina-player-02.animation_frame",
    valueType: "f32",
    boundary: "normal-live-player-animation-frontier",
    producer: "ACTIONS.CPP process_anims",
    owner: "ordinary native-player-13 animation state",
    missingSeam:
      "the held-ball transition is exact, but no composed live-player animation state carries native player 13 into tick 186",
  },
  downstreamOwners: [
    "ordinary 22-player live motion and AI materialization",
    "all-player post-launch animation profile composition",
    "normal-play officials, rules, and general auto-selection",
    "same-tick global RNG calls outside the ordinary loop and pass_ball",
  ],
});

const STATE_KEYS = Object.freeze([
  "bindings",
  "centrePassAction",
  "control",
  "coordinator",
  "fixtureId",
  "heldBall",
  "lifecycle",
  "phase",
  "qualification",
  "rng",
  "schema",
  "selectedCountry",
  "sourceOrder",
  "stamina",
  "tick",
]);

export class CssoccerUnsupportedOpeningLiveLaunchError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedOpeningLiveLaunchError";
    this.code = "CSSOCCER_UNSUPPORTED_OPENING_LIVE_LAUNCH";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/** Cross exactly the accepted tick-171 opening seam into launch tick 172. */
export function createCssoccerOpeningLiveLaunchState({ opening } = {}) {
  const current = assertCssoccerOpeningMatchState(opening);
  if (current.tick !== OPENING_TICK) {
    fail(
      "opening-frontier",
      `Opening live launch requires the accepted tick ${OPENING_TICK} state.`,
      { actualTick: current.tick },
    );
  }

  const rng = advanceCssoccerNativeRng(current.rng);
  const lifecycleStep = stepCssoccerMatchLifecycle(current.lifecycle);
  if (
    lifecycleStep.events.length !== 0
    || lifecycleStep.state.clock.tick !== LAUNCH_TICK
  ) {
    fail(
      "lifecycle-event",
      "Opening launch cannot consume a lifecycle event or non-contiguous clock.",
      { events: lifecycleStep.events },
    );
  }
  const lifecycle = lifecycleStep.state;
  const stamina = stepCssoccerPlayerStaminaState(current.stamina, {
    tick: LAUNCH_TICK,
    gameMinute: lifecycle.clock.gameMinute,
  });
  const teamRates = projectCssoccerPlayerStaminaTeamRates(stamina);
  const coordinator = stepCssoccerOpeningKickoffCoordinator(
    bindCoordinatorGlobalRng(current.coordinator, rng),
    { teamRates },
  );
  if (
    coordinator.tick !== LAUNCH_TICK
    || coordinator.phase !== "launch-receipt"
    || coordinator.launch === null
  ) {
    fail(
      "launch-receipt",
      "Opening coordinator did not produce the exact centre-pass launch receipt.",
      { tick: coordinator.tick, phase: coordinator.phase },
    );
  }

  const taker = coordinator.kickoffMotion.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === TAKER_NATIVE_PLAYER,
  );
  if (taker === undefined || taker.id !== coordinator.launch.owner.takerId) {
    fail("taker-identity", "Opening launch lost the native centre taker identity.");
  }
  const profile = assertCssoccerNativeFixturePlayerProfile(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  );
  const attributes = profile.players.find(({ id }) => id === taker.id)?.attributes;
  if (
    attributes === undefined
    || taker.nativePlayerNumber !== TAKER_NATIVE_PLAYER
  ) {
    fail("taker-profile", "Opening launch cannot bind the taker's exact initial rate/flair profile.");
  }
  const motionCaptureSpeed = F32((attributes.flair + attributes.pace) / 128);
  const centrePassAction = createCssoccerCentrePassAction({
    launch: coordinator.launch,
    profile: CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
    taker: {
      position: { ...clone(taker.position), z: F32(0) },
      motionCaptureSpeed,
    },
  });
  const action = createCssoccerOpeningControlAction({
    tick: LAUNCH_TICK,
    launch: coordinator.launch,
    releaseApplied: centrePassAction.release !== null,
    complete: centrePassAction.phase === "complete",
  });
  const activePlayerId = `${current.selectedCountry}-player-07`;
  const ownership = createCssoccerOpeningControlOwnership({
    tick: LAUNCH_TICK,
    teamState: lifecycle.teamState,
    activePlayerId,
  });
  const control = createCssoccerOpeningControlState({
    launch: coordinator.launch,
    action,
    ownership,
  });

  return assemble({
    tick: LAUNCH_TICK,
    selectedCountry: current.selectedCountry,
    bindings: clone(current.bindings),
    lifecycle,
    coordinator,
    stamina,
    rng,
    centrePassAction,
    heldBall: null,
    control,
  });
}

/**
 * Advance the narrow centre-pass composition by one source tick. Ordinary
 * live-player facts stay explicit in the centre-pass action context.
 */
export function stepCssoccerOpeningLiveLaunchState(state, actionContext = {}) {
  const current = assertCssoccerOpeningLiveLaunchState(state);
  if (current.tick >= QUALIFIED_THROUGH_TICK) {
    const frontier = CSSOCCER_OPENING_LIVE_LAUNCH_QUALIFICATION.unsupportedNext;
    fail(
      frontier.boundary,
      `Opening live launch is partial at tick ${frontier.tick}; ${frontier.fieldId} still belongs to uncomposed ${frontier.producer}.`,
      {
        currentTick: current.tick,
        requestedTick: current.tick + 1,
        frontierTick: frontier.tick,
        phase: frontier.phase,
        fieldId: frontier.fieldId,
        valueType: frontier.valueType,
        producer: frontier.producer,
        owner: frontier.owner,
        missingSeam: frontier.missingSeam,
      },
    );
  }
  requirePlainObject(actionContext, "opening live launch action context");
  requireOnlyKeys(
    actionContext,
    ["heldBall", "receiver", "recovery", "release"],
    "opening live launch action context",
  );

  const tick = current.tick + 1;
  const heldBallTransition = tick === QUALIFIED_THROUGH_TICK;
  if (heldBallTransition) {
    requireExactKeys(
      actionContext,
      ["heldBall"],
      `opening live launch tick ${tick} context`,
    );
  } else if (actionContext.heldBall !== undefined) {
    fail(
      "held-ball-input",
      `Held-ball owner input is valid only for the qualified tick ${QUALIFIED_THROUGH_TICK} transition.`,
      { tick },
    );
  }
  const centrePassContext = { ...actionContext };
  delete centrePassContext.heldBall;
  const ordinaryRng = advanceCssoccerNativeRng(current.rng);
  if (
    centrePassContext.release !== undefined
    && !sameValue(centrePassContext.release?.rng, ordinaryRng)
  ) {
    fail(
      "pass-rng-lineage",
      "pass_ball must consume the bound ordinary RNG cursor for the current tick.",
      { tick, ordinaryCalls: ordinaryRng.calls },
    );
  }

  const lifecycleStep = stepCssoccerMatchLifecycle(current.lifecycle);
  if (
    lifecycleStep.events.length !== 0
    || lifecycleStep.state.clock.tick !== tick
  ) {
    fail(
      "lifecycle-event",
      "Opening centre pass cannot consume a lifecycle event or non-contiguous clock.",
      { tick, events: lifecycleStep.events },
    );
  }
  const lifecycle = lifecycleStep.state;
  const stamina = stepCssoccerPlayerStaminaState(current.stamina, {
    tick,
    gameMinute: lifecycle.clock.gameMinute,
  });
  let centrePassAction = current.centrePassAction;
  let heldBall = current.heldBall;
  if (heldBallTransition) {
    if (
      centrePassAction.tick !== ACTION_COMPLETE_TICK
      || centrePassAction.phase !== "complete"
      || heldBall !== null
    ) {
      fail(
        "held-ball-lineage",
        "The generic held-ball transition requires the accepted completed centre pass.",
        { actionTick: centrePassAction.tick, actionPhase: centrePassAction.phase },
      );
    }
    const baseline = createCssoccerHeldBallState({
      ball: centrePassAction.ball,
      possession: centrePassAction.possession,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      fixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    });
    heldBall = stepCssoccerHeldBallState(baseline, {
      ownerFrame: actionContext.heldBall,
    });
  } else {
    centrePassAction = stepCssoccerCentrePassAction(
      current.centrePassAction,
      centrePassContext,
    );
    if (centrePassAction.tick !== tick) {
      fail(
        "centre-pass-cursor",
        "Centre-pass action did not advance contiguously with the composed state.",
        { tick, actionTick: centrePassAction.tick },
      );
    }
  }

  let rng = ordinaryRng;
  if (centrePassAction.release?.tick === tick) {
    const passBallRng = advanceCssoccerNativeRng(ordinaryRng);
    if (!sameValue(centrePassAction.release.rng, passBallRng)) {
      fail(
        "pass-rng-lineage",
        "pass_ball did not retain exactly one extra Watcom RNG call.",
        { tick, expectedCalls: passBallRng.calls },
      );
    }
    rng = passBallRng;
  }

  const action = createCssoccerOpeningControlAction({
    tick,
    launch: current.coordinator.launch,
    releaseApplied: centrePassAction.release !== null,
    complete: centrePassAction.phase === "complete",
  });
  const fixturePlayerNumber = centrePassAction.release === null
    ? TAKER_NATIVE_PLAYER
    : RECEIVER_NATIVE_PLAYER;
  const activePlayerId = `${current.selectedCountry}-player-${String(
    fixturePlayerNumber,
  ).padStart(2, "0")}`;
  const ownership = createCssoccerOpeningControlOwnership({
    tick,
    teamState: lifecycle.teamState,
    activePlayerId,
  });
  const control = stepCssoccerOpeningControlState(current.control, {
    action,
    ownership,
  });

  return assemble({
    tick,
    selectedCountry: current.selectedCountry,
    bindings: clone(current.bindings),
    lifecycle,
    coordinator: current.coordinator,
    stamina,
    rng,
    centrePassAction,
    heldBall,
    control,
  });
}

/** Project only fields owned by the reducers composed at this boundary. */
export function projectCssoccerOpeningLiveLaunchCapturedFields(state) {
  const current = assertCssoccerOpeningLiveLaunchState(state);
  const actionFields = current.heldBall === null
    ? projectCssoccerCentrePassActionNativeFields(current.centrePassAction)
    : projectCssoccerHeldBallNativeFields(current.heldBall);
  const fields = [
    ...actionFields,
    ...projectCssoccerOpeningControlNativeFields(current.control),
    typedField("clock.minutes", "u16", current.lifecycle.clock.gameMinute),
    typedField("clock.seconds", "f32", current.lifecycle.clock.gameSecond),
    typedField("clock.time_factor", "i32", 2),
    typedField("score.team_a", "i32", current.lifecycle.score.goals.spain),
    typedField("score.team_b", "i32", current.lifecycle.score.goals.argentina),
  ];
  if (current.tick === LAUNCH_TICK) {
    fields.push(...projectLaunchKeeperFields(current));
  }
  if (current.centrePassAction.release === null) {
    fields.push(
      typedField("rng.rand_seed", "i16", current.rng.randSeed),
      typedField("rng.seed", "i16", current.rng.seed),
    );
  }
  return deepFreeze(mergeFields(fields, current.tick));
}

/** Source stand_action/find_zonal_target/process_dir for the two launch keepers. */
function projectLaunchKeeperFields(state) {
  // Native order is team B then team A on this frame, and both keeper slots
  // run before player 7 advances the held centre-pass ball.
  const ball = state.coordinator.ball.ball.position;
  const possession = state.centrePassAction.possession.owner;
  const keepers = state.coordinator.kickoffMotion.players.filter(
    ({ nativePlayerNumber }) => nativePlayerNumber === 1 || nativePlayerNumber === 12,
  );
  if (keepers.length !== 2) {
    throw new Error("Opening launch requires both source keeper slots.");
  }
  return keepers.flatMap((keeper) => {
    const turn = turnSourceFacing({
      facing: keeper.facing,
      target: {
        x: F32(ball.x - keeper.position.x),
        y: F32(ball.y - keeper.position.y),
      },
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate: keeper.teamRate },
      ).maxTurnRadians,
    });
    const sameTeamPossession = possession !== 0
      && (possession < 12) === (keeper.nativePlayerNumber < 12);
    const farFromBall = sourceDistance2d({
      x: F32(ball.x - keeper.position.x),
      y: F32(ball.y - keeper.position.y),
    }) > CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 50;
    const socks = sameTeamPossession
      && farFromBall
      && state.rng.seed < SOCKS_PROBABILITY;
    const animation = socks
      ? (state.rng.seed & 1 ? SOCKS_LEFT_ANIMATION : SOCKS_RIGHT_ANIMATION)
      : STAND_ANIMATION;
    const prefix = `players.${keeper.id}.`;
    return [
      typedField(`${prefix}action`, "i16", STAND_ACTION),
      typedField(`${prefix}animation`, "u16", animation),
      typedField(`${prefix}animation_frame`, "f32", F32(0)),
      typedField(`${prefix}face_direction`, "i16", turn.faceDirection),
      typedField(`${prefix}x`, "f32", keeper.position.x),
      typedField(`${prefix}x_displacement`, "f32", turn.facing.x),
      typedField(`${prefix}y`, "f32", keeper.position.y),
      typedField(`${prefix}y_displacement`, "f32", turn.facing.y),
    ];
  });
}

/** Raw-only stamina fields stay separate from the installed typed contract. */
export function projectCssoccerOpeningLiveLaunchStaminaFields(state) {
  return projectCssoccerPlayerStaminaNativeFields(
    assertCssoccerOpeningLiveLaunchState(state).stamina,
  );
}

export function assertCssoccerOpeningLiveLaunchState(state) {
  requirePlainObject(state, "opening live launch state");
  requireExactKeys(state, STATE_KEYS, "opening live launch state");
  if (
    state.schema !== CSSOCCER_OPENING_LIVE_LAUNCH_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || state.phase !== "opening-live-launch"
    || !Number.isSafeInteger(state.tick)
    || state.tick < LAUNCH_TICK
    || state.tick > QUALIFIED_THROUGH_TICK
    || !["spain", "argentina"].includes(state.selectedCountry)
  ) {
    throw new Error(
      `Opening live launch state must use ${CSSOCCER_OPENING_LIVE_LAUNCH_STATE_SCHEMA}.`,
    );
  }
  if (!sameValue(state.sourceOrder, CSSOCCER_OPENING_LIVE_LAUNCH_SOURCE_ORDER)) {
    throw new Error("Opening live launch source order changed.");
  }
  if (!sameValue(state.qualification, CSSOCCER_OPENING_LIVE_LAUNCH_QUALIFICATION)) {
    throw new Error("Opening live launch qualification changed.");
  }
  const lifecycle = assertCssoccerMatchLifecycle(state.lifecycle);
  const coordinator = assertCssoccerOpeningKickoffCoordinator(state.coordinator);
  const stamina = assertCssoccerPlayerStaminaState(state.stamina);
  const rng = createCssoccerNativeRngState(state.rng);
  const action = assertCssoccerCentrePassActionState(state.centrePassAction);
  const control = assertCssoccerOpeningControlState(state.control);
  const heldBall = state.heldBall === null
    ? null
    : assertCssoccerHeldBallState(state.heldBall);
  const expectedActionTick = Math.min(state.tick, ACTION_COMPLETE_TICK);
  const expectedRngCalls = state.tick + (action.release === null ? 0 : 1);
  const expectedRng = advanceCssoccerNativeRngMany(
    createCssoccerNativeRngState(),
    expectedRngCalls,
  );
  const expectedLaunchRng = advanceCssoccerNativeRngMany(
    createCssoccerNativeRngState(),
    LAUNCH_TICK,
  );
  const expectedReleaseRng = action.release === null
    ? null
    : advanceCssoccerNativeRngMany(
        createCssoccerNativeRngState(),
        action.release.tick + 1,
      );
  if (
    lifecycle.clock.tick !== state.tick
    || lifecycle.teamState.control.selectedCountry !== state.selectedCountry
    || coordinator.tick !== LAUNCH_TICK
    || coordinator.phase !== "launch-receipt"
    || stamina.tick !== state.tick
    || stamina.gameMinute !== lifecycle.clock.gameMinute
    || action.tick !== expectedActionTick
    || action.owner.takerId !== coordinator.launch?.owner?.takerId
    || control.tick !== state.tick
    || control.ownership.selectedCountry !== state.selectedCountry
    || !sameValue(rng, state.rng)
    || !sameValue(rng, expectedRng)
    || !sameValue(coordinator.ball.ball.rng, expectedLaunchRng)
  ) {
    throw new Error("Opening live launch reducer cursors or ownership diverged.");
  }
  if (
    (action.release === null && control.phase !== "taker-controlled")
    || (action.release !== null && control.phase !== "receiver-controlled")
    || (action.release !== null
      && !sameValue(action.release.rng, expectedReleaseRng))
  ) {
    throw new Error("Opening live launch action, control, or pass RNG lineage diverged.");
  }
  if (
    (state.tick < QUALIFIED_THROUGH_TICK && heldBall !== null)
    || (state.tick === QUALIFIED_THROUGH_TICK && (
      heldBall === null
      || heldBall.tick !== state.tick
      || heldBall.phase !== "normal-held-ball"
      || heldBall.owner.stableId !== action.owner.receiverId
      || heldBall.owner.nativePlayerNumber !== action.owner.receiverNativePlayerNumber
      || action.tick !== ACTION_COMPLETE_TICK
      || action.phase !== "complete"
    ))
  ) {
    throw new Error("Opening live launch held-ball lineage diverged.");
  }
  if (
    state.bindings?.nativeFixturePlayerProfileHash
      !== CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH
    || state.bindings?.nativeGameplayProfileHash
      !== coordinator.bindings.nativeGameplayProfileHash
  ) {
    throw new Error("Opening live launch source/profile bindings changed.");
  }
  return state;
}

function assemble(parts) {
  return assertCssoccerOpeningLiveLaunchState(deepFreeze({
    schema: CSSOCCER_OPENING_LIVE_LAUNCH_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    phase: "opening-live-launch",
    sourceOrder: clone(CSSOCCER_OPENING_LIVE_LAUNCH_SOURCE_ORDER),
    qualification: clone(CSSOCCER_OPENING_LIVE_LAUNCH_QUALIFICATION),
    ...parts,
  }));
}

function bindCoordinatorGlobalRng(coordinator, rng) {
  const rebound = clone(coordinator);
  rebound.ball.ball.rng = clone(rng);
  return assertCssoccerOpeningKickoffCoordinator(deepFreeze(rebound));
}

function mergeFields(fields, tick) {
  const byId = new Map();
  for (const value of fields) {
    const field = value.recordType === "sample"
      ? value
      : { ...value, tick, phase: "post_tick" };
    const previous = byId.get(field.fieldId);
    const scalar = {
      fieldId: field.fieldId,
      valueType: field.valueType,
      value: field.value,
      numericBits: field.numericBits,
    };
    if (previous !== undefined && !sameValue(previous, scalar)) {
      throw new Error(`Opening launch field ${field.fieldId} has conflicting owners.`);
    }
    byId.set(field.fieldId, scalar);
  }
  return [...byId.values()].sort((left, right) => left.fieldId.localeCompare(right.fieldId));
}

function typedField(fieldId, valueType, value) {
  const byteLength = valueType === "u16" || valueType === "i16" ? 2 : 4;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  if (valueType === "u16") view.setUint16(0, value, false);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else if (valueType === "f32") view.setFloat32(0, value, false);
  else throw new Error(`Unsupported opening launch scalar type ${valueType}.`);
  return {
    fieldId,
    valueType,
    value,
    numericBits: [...new Uint8Array(buffer)]
      .map((entry) => entry.toString(16).padStart(2, "0"))
      .join(""),
  };
}

function fail(boundary, message, detail = {}) {
  throw new CssoccerUnsupportedOpeningLiveLaunchError(boundary, message, detail);
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!sameValue(actual, expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
}

function requireOnlyKeys(value, keys, label) {
  const allowed = new Set(keys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} has unsupported fields: ${unexpected.join(", ")}.`);
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

import {
  projectBallNativeFields,
} from "./ballState.mjs";
import {
  projectCssoccerKickoffNativePhaseFields,
} from "./kickoffState.mjs";
import {
  assertCssoccerMatchLifecycle,
  stepCssoccerMatchLifecycle,
} from "./matchLifecycle.mjs";
import { createCssoccerMatchState } from "./matchState.mjs";
import {
  normalizeSourceVector,
  sourceFacingDirection,
} from "./motionState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
} from "./nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
} from "./nativeGameplayProfile.mjs";
import {
  assertCssoccerOpeningKickoffCoordinator,
  createCssoccerOpeningKickoffCoordinator,
  stepCssoccerOpeningKickoffCoordinator,
} from "./openingKickoffCoordinator.mjs";
import { projectCssoccerOfficialNativeFields } from "./officialState.mjs";
import {
  CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
  assertCssoccerPlayerAnimationState,
  createCssoccerPlayerAnimationProfile,
  createCssoccerPlayerAnimationState,
  projectCssoccerPlayerAnimationNativeFields,
  stepCssoccerPlayerAnimationState,
} from "./playerAnimationState.mjs";
import {
  assertCssoccerPlayerStaminaState,
  createCssoccerPlayerStaminaState,
  projectCssoccerPlayerStaminaNativeFields,
  projectCssoccerPlayerStaminaTeamRates,
  stepCssoccerPlayerStaminaState,
} from "./playerStaminaState.mjs";
import { projectPossessionNativeFields } from "./possessionState.mjs";
import {
  advanceCssoccerNativeRng,
  advanceCssoccerNativeRngMany,
  createCssoccerNativeRngState,
} from "./randomState.mjs";

const F32 = Math.fround;
const FIXTURE_ID = "spain-argentina-full-match";
const ANIMATION_BASELINE_TICK = 11;
const QUALIFIED_THROUGH_TICK = 171;
const STAND_ACTION = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.actionIds.stand.value;
const RUN_ACTION = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.actionIds.run.value;
const SHA256 = /^[a-f0-9]{64}$/u;

export const CSSOCCER_OPENING_MATCH_STATE_SCHEMA =
  "cssoccer-opening-match-state@1";

export const CSSOCCER_OPENING_MATCH_SOURCE_ORDER = deepFreeze([
  "logic tick: advance the ordinary Watcom af_randomize state exactly once",
  "match lifecycle: advance the fixed hidden-duration clock with no resolved goal",
  "opening coordinator: process_ball and match_rules observe prior team/official state",
  "process_flags: derive the current integer minute and update all 22 stamina tm_rate stores",
  "opening coordinator: process_teams consumes current typed rates, then process_offs advances",
  "player animation: process_anims advances the prior frame before the current ordinary motion action/profile is applied",
]);

export const CSSOCCER_OPENING_MATCH_QUALIFICATION = deepFreeze({
  fixtureId: FIXTURE_ID,
  animationBaselineTick: ANIMATION_BASELINE_TICK,
  capturedStateExactThroughTick: QUALIFIED_THROUGH_TICK,
  completeCompositeNativeExact: false,
  capturedDomains: [
    "opening lifecycle clock and score",
    "global RNG",
    "held centre ball",
    "kickoff phase",
    "free possession",
    "three dynamic match officials",
    "22-player kickoff motion",
    "22-player action/animation from tick 11",
  ],
  rawOnlyDomains: [
    "22-player stamina rate/stamina/player-minute bytes",
  ],
  sourceDerivedDomains: [
    {
      domain: "officials",
      classification: "source-derived-complete-native-refs-captured",
      capturedRefs: true,
      nativeExact: false,
    },
  ],
  unsupportedNext: {
    tick: 172,
    boundary: "centre-pass-action-animation-contact",
    reason:
      "The accepted opening animation reducer stops before the centre-pass action/contact frontier.",
  },
});

const STATE_KEYS = Object.freeze([
  "animation",
  "bindings",
  "coordinator",
  "fixtureId",
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

export class CssoccerUnsupportedOpeningMatchStateError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedOpeningMatchStateError";
    this.code = "CSSOCCER_UNSUPPORTED_OPENING_MATCH_STATE";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/**
 * Create the accepted root match baseline and retain only the ordinary states
 * needed to advance the qualified opening. Prepared/native evidence is never
 * consulted by this runtime wrapper.
 */
export function createCssoccerOpeningMatchState(input = {}) {
  requirePlainObject(input, "opening match input");
  requireExactKeys(
    input,
    ["preparedFacts", "preparedScene", "selectedCountry"],
    "opening match input",
  );
  const match = createCssoccerMatchState(input);
  const coordinator = createCssoccerOpeningKickoffCoordinator({
    ball: match.ball,
    kickoff: match.kickoff,
    kickoffMotion: match.kickoffMotion,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    possession: match.possession,
  });
  const stamina = createCssoccerPlayerStaminaState({
    nativeFixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  });
  const rng = createCssoccerNativeRngState(match.rng);
  if (!sameValue(rng, coordinator.ball.ball.rng)) {
    throw new Error("Opening root, ball, and global RNG baselines diverged.");
  }
  return assemble({
    tick: 0,
    selectedCountry: match.selectedCountry,
    bindings: {
      match: clone(match.bindings),
      nativeGameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.profileHash,
      nativeFixturePlayerProfileHash: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
    },
    lifecycle: match.lifecycle,
    coordinator,
    stamina,
    rng,
    animation: null,
  });
}

/** Advance one fully qualified opening tick and fail before tick 172. */
export function stepCssoccerOpeningMatchState(state) {
  const current = assertCssoccerOpeningMatchState(state);
  if (current.tick >= QUALIFIED_THROUGH_TICK) {
    fail(
      "tick-172-action-animation-frontier",
      "Opening match state stops before tick 172 centre-pass action, animation, and contact processing.",
      { currentTick: current.tick, requestedTick: current.tick + 1 },
    );
  }

  const tick = current.tick + 1;
  const rng = advanceCssoccerNativeRng(current.rng);
  const lifecycleStep = stepCssoccerMatchLifecycle(current.lifecycle);
  if (lifecycleStep.events.length !== 0 || lifecycleStep.state.clock.tick !== tick) {
    fail(
      "opening-lifecycle-event",
      "The qualified opening cannot consume a lifecycle event or non-contiguous clock.",
      { tick, events: lifecycleStep.events },
    );
  }
  const lifecycle = lifecycleStep.state;
  const stamina = stepCssoccerPlayerStaminaState(current.stamina, {
    tick,
    gameMinute: lifecycle.clock.gameMinute,
  });
  const coordinator = stepCssoccerOpeningKickoffCoordinator(
    bindCoordinatorGlobalRng(current.coordinator, rng),
    { teamRates: projectCssoccerPlayerStaminaTeamRates(stamina) },
  );
  if (coordinator.phase !== "centre-positioning" || coordinator.tick !== tick) {
    fail(
      "premature-kickoff-launch",
      "The qualified opening wrapper cannot cross the centre-pass launch seam.",
      { tick, phase: coordinator.phase },
    );
  }

  let animation = null;
  if (tick === ANIMATION_BASELINE_TICK) {
    animation = createCssoccerPlayerAnimationState({
      nativeFixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
      nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    });
  } else if (tick > ANIMATION_BASELINE_TICK) {
    animation = stepCssoccerPlayerAnimationState(current.animation, {
      tick,
      players: createCssoccerOpeningAnimationInputs({
        previousMotion: current.coordinator.kickoffMotion,
        currentMotion: coordinator.kickoffMotion,
        stamina,
      }),
    });
  }

  return assemble({
    tick,
    selectedCountry: current.selectedCountry,
    bindings: clone(current.bindings),
    lifecycle,
    coordinator,
    stamina,
    rng,
    animation,
  });
}

/**
 * Project the accepted canonical-capture fields owned by this composition.
 * Raw-only stamina bytes are deliberately absent.
 */
export function projectCssoccerOpeningMatchCapturedFields(state) {
  const current = assertCssoccerOpeningMatchState(state);
  const fields = [];
  fields.push(...projectBallNativeFields(current.coordinator.ball.ball));
  fields.push(...projectPossessionNativeFields(current.coordinator.possession));
  fields.push(...projectCssoccerKickoffNativePhaseFields(current.coordinator.kickoff));
  fields.push(...projectCssoccerOfficialNativeFields(current.coordinator.official));
  fields.push(...projectMotionFields(current.coordinator.kickoffMotion));
  if (current.animation !== null) {
    fields.push(...projectCssoccerPlayerAnimationNativeFields(current.animation));
  }
  fields.push(
    typedField("rng.rand_seed", "i16", current.rng.randSeed),
    typedField("rng.seed", "i16", current.rng.seed),
    typedField("clock.minutes", "u16", current.lifecycle.clock.gameMinute),
    typedField("clock.seconds", "f32", current.lifecycle.clock.gameSecond),
    typedField("clock.time_factor", "i32", 2),
    typedField("score.team_a", "i32", current.lifecycle.score.goals.spain),
    typedField("score.team_b", "i32", current.lifecycle.score.goals.argentina),
  );
  return deepFreeze(mergeCapturedFields(fields, current.tick));
}

/** Return the raw-native stamina domain which is not in the 454-field JSONL contract. */
export function projectCssoccerOpeningMatchStaminaFields(state) {
  return projectCssoccerPlayerStaminaNativeFields(
    assertCssoccerOpeningMatchState(state).stamina,
  );
}

export function assertCssoccerOpeningMatchState(state) {
  requirePlainObject(state, "opening match state");
  requireExactKeys(state, STATE_KEYS, "opening match state");
  if (
    state.schema !== CSSOCCER_OPENING_MATCH_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || state.phase !== "opening-centre-positioning"
    || !Number.isSafeInteger(state.tick)
    || state.tick < 0
    || state.tick > QUALIFIED_THROUGH_TICK
  ) {
    throw new Error(`Opening match state must use ${CSSOCCER_OPENING_MATCH_STATE_SCHEMA}.`);
  }
  requireCountry(state.selectedCountry);
  if (!sameValue(state.sourceOrder, CSSOCCER_OPENING_MATCH_SOURCE_ORDER)) {
    throw new Error("Opening match source order changed.");
  }
  if (!sameValue(state.qualification, CSSOCCER_OPENING_MATCH_QUALIFICATION)) {
    throw new Error("Opening match qualification or unsupported frontier changed.");
  }

  const lifecycle = assertCssoccerMatchLifecycle(state.lifecycle);
  const coordinator = assertCssoccerOpeningKickoffCoordinator(state.coordinator);
  const stamina = assertCssoccerPlayerStaminaState(state.stamina);
  const rng = createCssoccerNativeRngState(state.rng);
  const expectedRng = advanceCssoccerNativeRngMany(
    createCssoccerNativeRngState(),
    state.tick,
  );
  if (!sameValue(rng, state.rng) || !sameValue(rng, expectedRng)) {
    throw new Error("Opening global RNG must advance exactly once per logic tick.");
  }
  if (
    lifecycle.clock.tick !== state.tick
    || lifecycle.clock.matchHalf !== 0
    || lifecycle.teamState.control.selectedCountry !== state.selectedCountry
    || coordinator.tick !== state.tick
    || coordinator.phase !== "centre-positioning"
    || coordinator.kickoffMotion.selectedCountry !== state.selectedCountry
    || coordinator.kickoffMotion.tick !== state.tick
    || stamina.tick !== state.tick
    || stamina.gameMinute !== lifecycle.clock.gameMinute
    || !sameValue(coordinator.ball.ball.rng, rng)
  ) {
    throw new Error("Opening lifecycle, coordinator, stamina, or selected-country cursors diverged.");
  }
  requireRateAlignment(coordinator.kickoffMotion, stamina);

  if (state.tick < ANIMATION_BASELINE_TICK) {
    if (state.animation !== null) {
      throw new Error("Opening animation cannot precede its accepted tick-11 baseline.");
    }
  } else {
    const animation = assertCssoccerPlayerAnimationState(state.animation);
    if (animation.tick !== state.tick) {
      throw new Error("Opening animation tick diverged from the composed state.");
    }
    requireAnimationAlignment(animation, coordinator.kickoffMotion, stamina);
  }
  requireBindings(state.bindings, { lifecycle, coordinator, stamina, animation: state.animation });
  return state;
}

function assemble(parts) {
  return assertCssoccerOpeningMatchState(deepFreeze({
    schema: CSSOCCER_OPENING_MATCH_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    phase: "opening-centre-positioning",
    sourceOrder: clone(CSSOCCER_OPENING_MATCH_SOURCE_ORDER),
    qualification: clone(CSSOCCER_OPENING_MATCH_QUALIFICATION),
    ...parts,
  }));
}

export function createCssoccerOpeningAnimationInputs({
  previousMotion,
  currentMotion,
  stamina,
}) {
  if (
    previousMotion.tick + 1 !== currentMotion.tick
    || currentMotion.tick !== stamina.tick
    || previousMotion.players.length !== currentMotion.players.length
  ) {
    throw new Error("Animation profile derivation requires contiguous ordinary motion and stamina states.");
  }
  const rates = new Map(projectCssoccerPlayerStaminaTeamRates(stamina).map((entry) => [
    entry.id,
    entry,
  ]));
  return currentMotion.players.map((player, index) => {
    const previous = previousMotion.players[index];
    const rate = rates.get(player.id);
    if (
      previous.id !== player.id
      || previous.nativePlayerNumber !== player.nativePlayerNumber
      || rate?.nativePlayerNumber !== player.nativePlayerNumber
      || rate.value !== player.teamRate
    ) {
      throw new Error(`${player.id} animation profile lost motion/rate identity alignment.`);
    }
    const choice = player.lastPlan?.choice ?? null;
    const kind = player.action === STAND_ACTION
      ? "stand"
      : choice === "side-step" ? "side-step" : requireRunAction(player);
    const initialize = choice !== null && choice !== "within-position-tolerance";
    const direction = kind === "side-step"
      ? sourceSideStepDirection(previous)
      : undefined;
    const profile = kind === "side-step" ? {
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind,
      direction,
      initialize,
      teamRate: rate.value,
    } : {
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind,
      initialize,
      teamRate: rate.value,
    };
    return {
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      action: typedField(`players.${player.id}.action`, "i16", player.action),
      profile: createCssoccerPlayerAnimationProfile(profile),
    };
  });
}

function bindCoordinatorGlobalRng(coordinator, rng) {
  const rebound = clone(coordinator);
  rebound.ball.ball.rng = clone(rng);
  return assertCssoccerOpeningKickoffCoordinator(deepFreeze(rebound));
}

function sourceSideStepDirection(player) {
  const target = {
    x: F32(player.target.x - player.position.x),
    y: F32(player.target.y - player.position.y),
  };
  const normalized = normalizeSourceVector(target);
  const relative = {
    x: F32(
      (normalized.x * player.facing.x)
      + (normalized.y * player.facing.y)
    ),
    y: F32(
      (normalized.y * player.facing.x)
      - (normalized.x * player.facing.y)
    ),
  };
  return 1 + sourceFacingDirection(relative);
}

function requireRunAction(player) {
  if (player.action !== RUN_ACTION) {
    fail(
      "opening-player-action",
      `${player.id} action ${player.action} is outside the qualified stand/run opening.`,
      { id: player.id, action: player.action },
    );
  }
  return "run";
}

function requireRateAlignment(motion, stamina) {
  if (motion.players.length !== stamina.players.length) {
    throw new Error("Opening motion/stamina player counts diverged.");
  }
  motion.players.forEach((player, index) => {
    const staminaPlayer = stamina.players[index];
    if (
      player.id !== staminaPlayer.id
      || player.nativePlayerNumber !== staminaPlayer.nativePlayerNumber
      || player.teamRate !== staminaPlayer.rate.value
    ) {
      throw new Error(`${player.id} motion tm_rate diverged from the current stamina store.`);
    }
  });
}

function requireAnimationAlignment(animation, motion, stamina) {
  if (animation.players.length !== motion.players.length) {
    throw new Error("Opening animation/motion player counts diverged.");
  }
  animation.players.forEach((player, index) => {
    const moving = motion.players[index];
    const staminaPlayer = stamina.players[index];
    const expectedKind = moving.action === STAND_ACTION
      ? "stand"
      : moving.lastPlan?.choice === "side-step" ? "side-step" : "run";
    if (
      player.id !== moving.id
      || player.nativePlayerNumber !== moving.nativePlayerNumber
      || player.action.value !== moving.action
      || player.teamRate !== staminaPlayer.rate.value
      || player.teamRate !== moving.teamRate
      || player.locomotion.kind !== expectedKind
    ) {
      throw new Error(`${player.id} animation diverged from ordinary current motion/stamina state.`);
    }
  });
}

function projectMotionFields(motion) {
  return motion.players.flatMap((player) => [
    typedField(`players.${player.id}.action`, "i16", player.action),
    typedField(`players.${player.id}.face_direction`, "i16", player.faceDirection),
    typedField(`players.${player.id}.x`, "f32", player.position.x),
    typedField(`players.${player.id}.x_displacement`, "f32", player.facing.x),
    typedField(`players.${player.id}.y`, "f32", player.position.y),
    typedField(`players.${player.id}.y_displacement`, "f32", player.facing.y),
  ]);
}

function mergeCapturedFields(fields, tick) {
  const merged = new Map();
  for (const field of fields) {
    const normalized = typedField(field.fieldId, field.valueType, field.value);
    if (normalized.numericBits !== field.numericBits) {
      throw new Error(`${field.fieldId} projection changed its exact numeric bits.`);
    }
    const previous = merged.get(field.fieldId);
    if (previous !== undefined && !sameValue(previous, normalized)) {
      throw new Error(`${field.fieldId} has conflicting opening reducer owners.`);
    }
    merged.set(field.fieldId, normalized);
  }
  return [...merged.values()]
    .sort((left, right) => left.fieldId.localeCompare(right.fieldId))
    .map((field) => ({
      schema: "cssoccer-parity-stream@1",
      recordType: "sample",
      tick,
      phase: "post_tick",
      ...field,
    }));
}

function requireBindings(value, { lifecycle, coordinator, stamina, animation }) {
  requirePlainObject(value, "opening match bindings");
  requireExactKeys(value, [
    "match",
    "nativeFixturePlayerProfileHash",
    "nativeGameplayProfileHash",
  ], "opening match bindings");
  requirePlainObject(value.match, "opening root match bindings");
  requireExactKeys(value.match, [
    "canonicalProfileSha256",
    "controlProfile",
    "nativeBuildSha256",
    "nativeFieldContractSha256",
    "nativeFixturePlayerProfileHash",
    "nativeScenarioSha256",
    "nativeSourceSha256",
    "nativeStateSha256",
    "sourceDataSha256",
    "tacticsTableSha256",
    "teamAuthoritySha256",
  ], "opening root match bindings");
  for (const [key, entry] of Object.entries(value.match)) {
    if (key === "controlProfile") continue;
    if (!SHA256.test(entry ?? "")) {
      throw new Error(`Opening root match binding ${key} must remain SHA-256.`);
    }
  }
  if (
    value.match.controlProfile !== lifecycle.teamState.control.profile
    || value.match.nativeBuildSha256 !== coordinator.bindings.nativeBuildSha256
    || value.match.nativeScenarioSha256 !== CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.bindings.nativeScenarioSha256
    || value.nativeGameplayProfileHash !== coordinator.bindings.nativeGameplayProfileHash
    || value.nativeGameplayProfileHash !== CSSOCCER_NATIVE_GAMEPLAY_PROFILE.profileHash
    || value.nativeFixturePlayerProfileHash !== stamina.nativeFixturePlayerProfileHash
    || value.nativeFixturePlayerProfileHash !== CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH
    || (animation !== null
      && value.nativeFixturePlayerProfileHash !== animation.bindings.nativeFixturePlayerProfileHash)
  ) {
    throw new Error("Opening reducer bindings diverged from the accepted root/native profiles.");
  }
}

function typedField(fieldId, valueType, value) {
  if (typeof fieldId !== "string" || fieldId.length === 0) {
    throw new TypeError("Opening captured field id must be non-empty.");
  }
  if (valueType === "f32") {
    const rounded = F32(value);
    return {
      fieldId,
      valueType,
      value: rounded,
      numericBits: f32Bits(rounded),
    };
  }
  const limits = {
    u8: [0, 0xff, 2],
    i16: [-0x8000, 0x7fff, 4],
    u16: [0, 0xffff, 4],
    i32: [-0x80000000, 0x7fffffff, 8],
  }[valueType];
  if (limits === undefined || !Number.isInteger(value) || value < limits[0] || value > limits[1]) {
    throw new TypeError(`${fieldId} must be an exact ${valueType}.`);
  }
  const bits = valueType === "i16"
    ? (value & 0xffff)
    : valueType === "i32" ? (value >>> 0) : value;
  return {
    fieldId,
    valueType,
    value,
    numericBits: bits.toString(16).padStart(limits[2], "0"),
  };
}

function f32Bits(value) {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  return view.getUint32(0, false).toString(16).padStart(8, "0");
}

function requireCountry(value) {
  if (value !== "spain" && value !== "argentina") {
    throw new Error("Opening match selected country must be Spain or Argentina.");
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!sameValue(actual, expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
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

function fail(boundary, message, detail = {}) {
  throw new CssoccerUnsupportedOpeningMatchStateError(boundary, message, detail);
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
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

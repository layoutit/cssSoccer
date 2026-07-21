import { createBallMatchState } from "./ballMatchState.mjs";
import {
  assertCssoccerKickoffPlayerMotion,
  createCssoccerKickoffPlayerMotion,
} from "./kickoffPlayerMotion.mjs";
import {
  CSSOCCER_KICKOFF_CONSTANTS,
  assertCssoccerKickoffState,
  createCssoccerKickoffState,
} from "./kickoffState.mjs";
import {
  assertCssoccerMatchLifecycle,
  createCssoccerMatchLifecycle,
  resetCssoccerMatchLifecycle,
} from "./matchLifecycle.mjs";
import { createPossessionState } from "./possessionState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  projectCssoccerNativeTeamRates,
} from "./nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  projectCssoccerKickoffSourceProfile,
} from "./nativeGameplayProfile.mjs";
import {
  assertCssoccerOfficialState,
  createCssoccerOpeningOfficialState,
} from "./officialState.mjs";
import {
  assertCssoccerPlayerMotionState,
  createCssoccerPlayerMotionState,
} from "./playerMotionState.mjs";
import { createCssoccerNativeRngState } from "./randomState.mjs";
import {
  assertCssoccerTacticsState,
  createCssoccerTacticsState,
} from "./tacticsState.mjs";
import {
  assertCssoccerTeamAiState,
  createCssoccerTeamAiState,
} from "./teamAi.mjs";
import { createCssoccerTeamState } from "./teamState.mjs";
import {
  assertCssoccerUserControl,
  createCssoccerUserControl,
  resetCssoccerUserControl,
} from "./userControl.mjs";
import {
  assertCssoccerZoneState,
  createCssoccerZoneState,
} from "./zoneState.mjs";

export const CSSOCCER_MATCH_STATE_SCHEMA = "cssoccer-match-state@1";

export const CSSOCCER_MATCH_STATE_SOURCE = deepFreeze({
  fixtureId: "spain-argentina-full-match",
  kickoffTick: 0,
  fixedTiming: {
    tickRateHz: 20,
    timestepSeconds: 0.05,
    timeFactor: 2,
    playMinutesPerHalf: 1,
    fullMatchPlayMinutes: 2,
    gameMinutesPerHalf: 45,
    ticksPerHalf: 1_200,
    fullMatchPlayTicks: 2_400,
    liveBallOverrun: {
      allowed: true,
      clockResetAtEndSwap: "keep-minutes-reset-seconds",
      maxTicksPerHalf: 200,
    },
    publiclyConfigurable: false,
  },
  integrationBoundary: [
    "player motion/action materialization",
    "contact profile and contact ordering",
    "rules/restart coordinator",
    "kickoff and action launch resolution",
  ],
});

/**
 * Construct the exact prepared kickoff baseline. This intentionally stops at
 * the stable integration seam: later reducers may advance it only after their
 * source profiles and launch decisions have been bound.
 */
export function createCssoccerMatchState({
  preparedFacts,
  preparedScene,
  selectedCountry,
} = {}) {
  const prepared = requirePreparedMatch(preparedFacts, preparedScene);
  const teamState = createCssoccerTeamState({
    preparedFacts,
    preparedScene,
    selectedCountry,
  });
  const lifecycle = createCssoccerMatchLifecycle({ teamState });
  const ball = createBallMatchState();
  const rng = createCssoccerNativeRngState();
  const tactics = createPreparedTactics(prepared.tactics);
  const zones = createCssoccerZoneState();
  const possession = createKickoffPossession(teamState);
  const userControl = createCssoccerUserControl({ teamState });
  const teamAi = createCssoccerTeamAiState(teamState);
  const kickoffRuntime = createOpeningKickoffRuntime({
    lifecycle,
    tactics,
    selectedCountry: teamState.control.selectedCountry,
  });
  const bindings = createBindings(preparedFacts, teamState, tactics);
  return assemble({
    tick: 0,
    selectedCountry: teamState.control.selectedCountry,
    bindings,
    lifecycle,
    ball,
    possession,
    rng,
    zones,
    tactics,
    userControl,
    teamAi,
    kickoff: kickoffRuntime.kickoff,
    kickoffMotion: kickoffRuntime.motion,
    officials: kickoffRuntime.officials,
    playerMotion: kickoffRuntime.playerMotion,
  });
}

export function resetCssoccerMatchState(state) {
  const current = assertCssoccerMatchState(state);
  const lifecycle = resetCssoccerMatchLifecycle(current.lifecycle);
  const teamState = lifecycle.teamState;
  const kickoffRuntime = createOpeningKickoffRuntime({
    lifecycle,
    tactics: current.tactics,
    selectedCountry: current.selectedCountry,
  });
  return assemble({
    tick: 0,
    selectedCountry: current.selectedCountry,
    bindings: clone(current.bindings),
    lifecycle,
    ball: createBallMatchState(),
    possession: createKickoffPossession(teamState),
    rng: createCssoccerNativeRngState(),
    zones: createCssoccerZoneState(),
    tactics: current.tactics,
    userControl: resetCssoccerUserControl(current.userControl, { teamState }),
    teamAi: createCssoccerTeamAiState(teamState),
    kickoff: kickoffRuntime.kickoff,
    kickoffMotion: kickoffRuntime.motion,
    officials: kickoffRuntime.officials,
    playerMotion: kickoffRuntime.playerMotion,
  });
}

export function assertCssoccerMatchState(state) {
  requirePlainObject(state, "cssoccer match state");
  requireExactKeys(state, [
    "ball",
    "bindings",
    "fixtureId",
    "lifecycle",
    "kickoff",
    "kickoffMotion",
    "officials",
    "playerMotion",
    "possession",
    "rng",
    "schema",
    "selectedCountry",
    "tactics",
    "teamAi",
    "tick",
    "userControl",
    "zones",
  ], "cssoccer match state");
  if (
    state.schema !== CSSOCCER_MATCH_STATE_SCHEMA
    || state.fixtureId !== CSSOCCER_MATCH_STATE_SOURCE.fixtureId
    || !Number.isSafeInteger(state.tick)
    || state.tick < 0
  ) {
    throw new Error(`cssoccer match state must use ${CSSOCCER_MATCH_STATE_SCHEMA}.`);
  }
  if (state.selectedCountry !== "spain" && state.selectedCountry !== "argentina") {
    throw new Error("cssoccer match state must retain one selected fixture country.");
  }
  assertCssoccerMatchLifecycle(state.lifecycle);
  if (
    state.lifecycle.clock.tick !== state.tick
    || state.lifecycle.teamState.control.selectedCountry !== state.selectedCountry
  ) {
    throw new Error("Match lifecycle tick or selected country diverged from the root state.");
  }

  const ball = createBallMatchState(state.ball);
  if (ball.ball.tick !== state.tick || !sameValue(ball, state.ball)) {
    throw new Error("Ball state diverged from the root match tick or typed state.");
  }
  const possession = createPossessionState(state.possession);
  if (!sameValue(possession, state.possession)) {
    throw new Error("Possession state changed type or identity ordering.");
  }
  const rng = createCssoccerNativeRngState(state.rng);
  if (!sameValue(rng, state.rng) || !sameValue(rng, ball.ball.rng)) {
    throw new Error("Root and ball RNG states must share the same tick boundary.");
  }
  assertCssoccerZoneState(state.zones);
  assertCssoccerTacticsState(state.tactics);
  assertCssoccerUserControl(state.userControl);
  assertCssoccerTeamAiState(state.teamAi);
  assertCssoccerKickoffState(state.kickoff);
  assertCssoccerKickoffPlayerMotion(state.kickoffMotion);
  assertCssoccerOfficialState(state.officials);
  assertCssoccerPlayerMotionState(state.playerMotion);
  if (
    state.teamAi.tick !== state.tick
    || state.teamAi.selectedCountry !== state.selectedCountry
    || state.userControl.tick !== state.tick - 1
    || state.userControl.selectedCountry !== state.selectedCountry
  ) {
    throw new Error("Control and AI tick boundaries diverged from the root match state.");
  }
  if (
    state.kickoff.phase !== "centre-positioning"
    || state.kickoff.phaseTick !== state.tick
    || state.kickoff.matchHalf !== state.lifecycle.clock.matchHalf
    || state.kickoffMotion.tick !== state.tick
    || state.kickoffMotion.matchHalf !== state.lifecycle.clock.matchHalf
    || state.kickoffMotion.selectedCountry !== state.selectedCountry
    || state.kickoffMotion.bindings.nativeGameplayProfileHash
      !== CSSOCCER_NATIVE_GAMEPLAY_PROFILE.profileHash
    || state.officials.tick !== state.tick
    || state.officials.centreOwner !== state.kickoff.owner.nativeTeamSlot
    || state.playerMotion.tick !== state.tick
    || state.playerMotion.matchHalf !== state.lifecycle.clock.matchHalf
    || state.playerMotion.selectedCountry !== state.selectedCountry
    || state.playerMotion.profileHash !== CSSOCCER_NATIVE_GAMEPLAY_PROFILE.profileHash
  ) {
    throw new Error("Opening kickoff, player, official, lifecycle, or profile state diverged.");
  }
  requirePossessionIdentityAlignment(
    possession,
    state.lifecycle.teamState.players,
  );
  requireBindings(state.bindings, state);
  return state;
}

function assemble(parts) {
  const state = deepFreeze({
    schema: CSSOCCER_MATCH_STATE_SCHEMA,
    fixtureId: CSSOCCER_MATCH_STATE_SOURCE.fixtureId,
    ...parts,
  });
  return assertCssoccerMatchState(state);
}

function requirePreparedMatch(facts, scene) {
  requirePlainObject(facts, "prepared match facts");
  requirePlainObject(scene, "prepared match scene");
  if (
    facts.schema !== "cssoccer-prepared-fixture-facts@1"
    || facts.id !== CSSOCCER_MATCH_STATE_SOURCE.fixtureId
    || facts.status !== "ready"
    || scene.id !== facts.id
    || scene.status !== "ready"
  ) {
    throw new Error("Match state requires the ready prepared Spain-Argentina fixture.");
  }
  requirePlainObject(facts.timing, "prepared match timing");
  requireExactKeys(
    facts.timing,
    Object.keys(CSSOCCER_MATCH_STATE_SOURCE.fixedTiming),
    "prepared match timing",
  );
  if (Object.entries(CSSOCCER_MATCH_STATE_SOURCE.fixedTiming).some(
    ([key, value]) => !sameValue(facts.timing[key], value),
  )) {
    throw new Error("Prepared match timing must remain the fixed hidden two-minute contract.");
  }
  if (
    facts.seed?.value !== 3523
    || facts.rules?.drawsFinal !== true
    || facts.rules?.extraTime !== false
    || facts.rules?.penalties !== false
    || facts.rules?.substitutes !== false
  ) {
    throw new Error("Prepared seed or normal-time rules changed.");
  }
  const tactics = facts.tactics;
  if (
    tactics?.schema !== "cssoccer-prepared-tactics@1"
    || tactics.fixtureId !== facts.id
    || tactics.formationId !== 0
    || tactics.formationSymbol !== "F_4_3_3"
    || tactics.layout?.rows !== 70
    || tactics.layout?.outfieldPlayers !== 10
    || tactics.layout?.coordinates !== 2
    || tactics.layout?.bytes !== 5_600
    || !isSha256(tactics.tableSha256)
    || !Array.isArray(tactics.values)
  ) {
    throw new Error("Prepared match requires the complete bound F_4_3_3 tactic table.");
  }
  return { tactics };
}

function createPreparedTactics(prepared) {
  const slot = {
    formationId: prepared.formationId,
    tableSha256: prepared.tableSha256,
    values: prepared.values,
  };
  return createCssoccerTacticsState({ A: slot, B: slot });
}

function createKickoffPossession(teamState) {
  return createPossessionState({
    players: teamState.players.map((player) => ({
      nativePlayer: player.current.nativePlayerNumber,
      stableId: player.id,
      possession: 0,
    })),
  });
}

function createOpeningKickoffRuntime({ lifecycle, tactics, selectedCountry }) {
  const kickoff = createCssoccerKickoffState({
    lifecycle,
    tacticsState: tactics,
    sourceProfile: projectCssoccerKickoffSourceProfile(CSSOCCER_NATIVE_GAMEPLAY_PROFILE),
  });
  const teamRates = projectCssoccerNativeTeamRates(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf: 0 },
  );
  const rates = new Map(teamRates.map((entry) => [entry.id, entry.value]));
  const playersById = new Map(lifecycle.teamState.players.map((player) => [player.id, player]));
  const players = kickoff.players.map((target) => {
    const player = playersById.get(target.id);
    const source = player?.formation?.kickoff?.sourceValues;
    if (source === undefined || !rates.has(target.id)) {
      throw new Error(`Opening kickoff runtime input is missing ${target.id}.`);
    }
    return {
      id: target.id,
      nativePlayerNumber: target.nativePlayerNumber,
      active: target.active,
      teamRate: rates.get(target.id),
      action: source.action.value,
      directionMode: 0,
      faceDirection: 0,
      position: { x: source.x.value, y: source.y.value },
      facing: {
        x: source.xDisplacement.value,
        y: source.yDisplacement.value,
      },
    };
  });
  const motion = createCssoccerKickoffPlayerMotion({
    kickoffState: kickoff,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    pitchLength: CSSOCCER_KICKOFF_CONSTANTS.pitchLength,
    // Pinned selector authority: GO_TO_POS_DIST = 0.8 * prat. `prat` is
    // stored f32, then promoted into the source double/x87 comparison.
    goToPositionDistance: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8,
    players,
    selectedCountry,
  });
  const officials = createCssoccerOpeningOfficialState({
    centreOwner: kickoff.owner.nativeTeamSlot,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  });
  const playerMotion = createCssoccerPlayerMotionState({
    teamState: lifecycle.teamState,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    teamRates,
  });
  return { kickoff, motion, officials, playerMotion };
}

function createBindings(facts, teamState, tactics) {
  const prepared = facts.bindings;
  requirePlainObject(prepared, "prepared match bindings");
  const values = {
    sourceDataSha256: prepared.sourceDataSha256,
    nativeSourceSha256: prepared.nativeSourceSha256,
    nativeBuildSha256: prepared.nativeBuildSha256,
    nativeScenarioSha256: prepared.nativeScenarioSha256,
    canonicalProfileSha256: prepared.nativeProfileSha256,
    nativeFieldContractSha256: prepared.nativeFieldContractSha256,
    nativeStateSha256: prepared.nativeStateSha256,
    nativeFixturePlayerProfileHash: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
    teamAuthoritySha256: teamState.bindings.teamAuthoritySha256,
    tacticsTableSha256: tactics.slots.A.tableSha256,
    controlProfile: teamState.control.profile,
  };
  for (const [key, value] of Object.entries(values)) {
    if (key === "controlProfile") continue;
    if (!isSha256(value)) throw new Error(`Prepared binding ${key} must be SHA-256.`);
  }
  return deepFreeze(values);
}

function requireBindings(value, state) {
  requirePlainObject(value, "cssoccer match bindings");
  requireExactKeys(value, [
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
  ], "cssoccer match bindings");
  for (const [key, entry] of Object.entries(value)) {
    if (key === "controlProfile") continue;
    if (!isSha256(entry)) throw new Error(`Match binding ${key} must be SHA-256.`);
  }
  if (
    value.controlProfile !== state.lifecycle.teamState.control.profile
    || value.tacticsTableSha256 !== state.tactics.slots.A.tableSha256
    || value.tacticsTableSha256 !== state.tactics.slots.B.tableSha256
    || value.teamAuthoritySha256 !== state.lifecycle.teamState.bindings.teamAuthoritySha256
    || value.nativeStateSha256 !== state.lifecycle.teamState.bindings.nativeStateSha256
    || value.nativeFieldContractSha256 !== state.lifecycle.teamState.bindings.nativeFieldContractSha256
    || value.nativeFixturePlayerProfileHash !== state.teamAi.nativeFixturePlayerProfileHash
  ) {
    throw new Error("Match bindings diverged from tactics, teams, or selected control profile.");
  }
}

function requirePossessionIdentityAlignment(possession, players) {
  const expected = new Map(players.map((player) => [
    player.current.nativePlayerNumber,
    player.id,
  ]));
  if (
    possession.players.length !== expected.size
    || possession.players.some(({ nativePlayer, stableId }) => (
      expected.get(nativePlayer) !== stableId
    ))
  ) {
    throw new Error("Possession identities diverged from the current native player slots.");
  }
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/u.test(value ?? "");
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!sameValue(actual, wanted)) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
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

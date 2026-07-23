import {
  CSSOCCER_NATIVE_ACTIONS,
  assertCssoccerActionState,
  createCssoccerActionState,
} from "./actionState.mjs";
import { createBallMatchState } from "./ballMatchState.mjs";
import { CSSOCCER_BALL_CONSTANTS } from "./ballState.mjs";
import {
  assertCssoccerClockState,
  createCssoccerClockState,
} from "./clockState.mjs";
import { CSSOCCER_KICKOFF_CONSTANTS } from "./kickoffState.mjs";
import {
  assertCssoccerGoalState,
  createCssoccerGoalState,
} from "./goalState.mjs";
import { requireControlCountry } from "./fixtureContract.mjs";
import {
  assertCssoccerKickoffPlayerMotion,
  createCssoccerCurrentKickoffPlayerMotion,
} from "./kickoffPlayerMotion.mjs";
import { sourceDistance2d } from "./motionState.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
} from "./nativeGameplayProfile.mjs";
import {
  CSSOCCER_OFFICIAL_CONSTANTS,
  assertCssoccerOfficialState,
  createCssoccerOfficialState,
} from "./officialState.mjs";
import { createPossessionState } from "./possessionState.mjs";
import {
  createCssoccerFreePlayPlayerHighlightInputFrame,
} from "./playerHighlightInputs.mjs";
import {
  assertCssoccerPlayerHighlightState,
  createCssoccerPlayerHighlightState,
} from "./playerHighlightState.mjs";
import {
  CSSOCCER_NATIVE_RNG_SOURCE,
  createCssoccerNativeRngState,
} from "./randomState.mjs";
import {
  assertCssoccerRuleState,
  createCssoccerRuleState,
} from "./ruleState.mjs";
import {
  assertCssoccerScoreState,
  createCssoccerScoreState,
} from "./scoreState.mjs";
import {
  assertCssoccerZoneState,
  createCssoccerZoneState,
} from "./zoneState.mjs";

const F32 = Math.fround;
const FIXTURE_ID = "spain-argentina-full-match";
const COUNTRIES = Object.freeze(["spain", "argentina"]);
const PLAYER_COUNT = 22;
const FIXED_TIMING = deepFreeze({
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
    maxTicksPerHalf: 200,
    clockResetAtEndSwap: "keep-minutes-reset-seconds",
  },
  publiclyConfigurable: false,
});
const PREPARED_FIXTURE_RULES = deepFreeze({
  competitionId: 0,
  simulationId: 1,
  offside: true,
  wind: false,
  substitutes: false,
  bookings: true,
  freeKicks: true,
  audio: false,
  drawsFinal: true,
  extraTime: false,
  penalties: false,
});
const FULL_MATCH_ALPHA_RULES = PREPARED_FIXTURE_RULES;
const FULL_MATCH_ALPHA_RULES_SHA256 =
  "a36e7cfa33f1ec4c14fdcc94c373afc8dbb61b19a8ff8183adb20f42a95ddf2d";
const ROOT_KEYS = Object.freeze([
  "actors",
  "ball",
  "bindings",
  "clock",
  "config",
  "control",
  "fixtureId",
  "goal",
  "kickoff",
  "officials",
  "phase",
  "playerHighlight",
  "players",
  "possession",
  "rng",
  "result",
  "rules",
  "schema",
  "score",
  "session",
  "tactics",
  "teams",
  "tick",
]);

export const CSSOCCER_FREE_PLAY_STATE_SCHEMA = "cssoccer-free-play-state@1";

export const CSSOCCER_FREE_PLAY_SEEDED_PATHS = Object.freeze([
  "rng",
  "ball.ball.rng",
]);

export const CSSOCCER_FREE_PLAY_STATE_SOURCE = deepFreeze({
  fixtureId: FIXTURE_ID,
  localControlCountries: COUNTRIES,
  preparedWhitelist: [
    "fixed fixture identity and configuration",
    "source-decoded team and starter identities",
    "prepared F_4_3_3 tactics table",
    "stable player, official, and ball render-root identities",
    "source-derived pitch, ball, kickoff, official, action, and RNG constants",
  ],
  rejectedPreparedInputs: [
    "command stream",
    "native input hash",
    "native/browser state or capture binding",
    "retained tick, phase, position, action, animation, or outcome",
  ],
  initializationOrder: [
    "fixed configuration",
    "teams and stable identities",
    "source tactic kickoff targets",
    "browser-owned player/action/animation state",
    "browser-owned ball/possession/rules/clock/RNG state",
    "source-initialized officials",
    "state-derived kickoff readiness",
  ],
  seededPaths: CSSOCCER_FREE_PLAY_SEEDED_PATHS,
});

export function createCssoccerFreePlayState({
  preparedFacts,
  preparedScene,
  controlCountry = "argentina",
  seed,
  rematchIndex = 0,
} = {}) {
  const prepared = requirePreparedFixture(preparedFacts, preparedScene);
  const selectedCountry = requireControlCountry(controlCountry);
  const initialSeed = seed ?? prepared.seed;
  requireUint32(initialSeed, "free-play initial seed");
  requireUint32(rematchIndex, "free-play rematch index");

  const rngState = createInitialRngState(initialSeed);
  const teams = createTeams(prepared.teams);
  const tactics = createTactics(prepared.tactics);
  const players = createPlayers({
    teams,
    tactics,
    playerRootIds: prepared.playerRootIds,
  });
  const kickoffMotion = createKickoffMotion(players, selectedCountry);
  const possession = createPossessionState({
    players: players.map(({ id, nativePlayerNumber }) => ({
      stableId: id,
      nativePlayer: nativePlayerNumber,
      possession: 0,
    })),
  });
  const ball = createBallMatchState({ ball: { rng: rngState } });
  const officials = createCssoccerOfficialState({
    centreOwner: "A",
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  });
  requireOfficialRootAlignment(officials, prepared.officialRootIds);
  const ruleState = createCssoccerRuleState({
    players: players.map(({ id, nativePlayerNumber }) => ({
      id,
      nativePlayerNumber,
      active: 1,
    })),
    freeKicksEnabled: Number(FULL_MATCH_ALPHA_RULES.freeKicks),
    bookingsEnabled: Number(FULL_MATCH_ALPHA_RULES.bookings),
    offsideEnabled: Number(FULL_MATCH_ALPHA_RULES.offside),
    practice: 0,
  });
  const score = createCssoccerScoreState();
  const kickoff = createKickoff({ players, ball, officials, motion: kickoffMotion });

  const initialMatch = {
    schema: CSSOCCER_FREE_PLAY_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    tick: 0,
    phase: "opening-kickoff",
    config: {
      controlCountry: selectedCountry,
      teams: { home: "spain", away: "argentina" },
      timing: clone(prepared.timing),
      rules: clone(FULL_MATCH_ALPHA_RULES),
      sourceConstants: {
        pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
        pitchWidth: CSSOCCER_BALL_CONSTANTS.pitchWidth,
        ballDiameter: CSSOCCER_BALL_CONSTANTS.ballDiameter,
        logicHz: prepared.timing.tickRateHz,
        timestepMilliseconds: prepared.timing.timestepSeconds * 1_000,
        gameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.profileHash,
      },
    },
    bindings: {
      sourceRevision: prepared.sourceRevision,
      teamAuthoritySha256: prepared.teamAuthoritySha256,
      tacticsTableSha256: prepared.tactics.tableSha256,
      rulesSha256: FULL_MATCH_ALPHA_RULES_SHA256,
      timingSha256: prepared.timingSha256,
      gameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.profileHash,
    },
    actors: {
      count: PLAYER_COUNT + officials.officials.length + 1,
      playerRootIds: players.map(({ renderRootId }) => renderRootId),
      officialRootIds: [...prepared.officialRootIds],
      ballRootId: prepared.ballRootId,
    },
    teams,
    players,
    officials,
    ball,
    possession,
    rules: {
      phase: "centre-restart",
      matchMode: CSSOCCER_KICKOFF_CONSTANTS.centreMatchMode,
      gameAction: CSSOCCER_KICKOFF_CONSTANTS.centreGameAction,
      setPiece: CSSOCCER_KICKOFF_CONSTANTS.centreSetPiece,
      deadBallCount: CSSOCCER_KICKOFF_CONSTANTS.centreDeadBallTicks,
      // RULES.CPP init_match_mode enables offside for a centre restart and
      // retains this global until a later restart/contact changes it.
      canBeOffside: 1,
      state: ruleState,
      liveOffside: null,
    },
    clock: createCssoccerClockState(),
    score,
    result: null,
    goal: createCssoccerGoalState({ score }),
    rng: {
      initialSeed,
      state: rngState,
    },
    tactics,
    control: {
      kind: "local-user",
      country: selectedCountry,
      teamId: `team-${selectedCountry}`,
      nativeTeamSlot: selectedCountry === "spain" ? "A" : "B",
      nativeUserToken: selectedCountry === "spain" ? -1 : -2,
      activePlayerId: null,
      burstTimer: 0,
      lastCommand: null,
      passCharge: null,
      shotCharge: null,
      eligiblePlayerIds: players
        .filter(({ country }) => country === selectedCountry)
        .map(({ id }) => id),
    },
    kickoff,
    session: {
      paused: false,
      pauseReason: null,
      pendingCommand: null,
      rematchIndex,
      rematchSeedPolicy: "reuse-explicit-initial-seed",
    },
  };
  const playerHighlight = createCssoccerPlayerHighlightState(
    createCssoccerFreePlayPlayerHighlightInputFrame({
      match: initialMatch,
      tick: initialMatch.tick,
    }),
  );
  return assertCssoccerFreePlayState(deepFreeze({
    ...initialMatch,
    playerHighlight,
  }));
}

export function setCssoccerFreePlayPaused(state, paused, { reason = "user" } = {}) {
  const current = assertCssoccerFreePlayState(state);
  if (typeof paused !== "boolean") throw new TypeError("Free-play paused must be boolean.");
  if (paused && (typeof reason !== "string" || reason.length === 0)) {
    throw new TypeError("A paused free-play state requires a reason.");
  }
  if (current.session.paused === paused) return current;
  return assertCssoccerFreePlayState(deepFreeze({
    ...clone(current),
    session: {
      ...clone(current.session),
      paused,
      pauseReason: paused ? reason : null,
      pendingCommand: null,
    },
  }));
}

export function createCssoccerFreePlayRematchState(state, {
  preparedFacts,
  preparedScene,
} = {}) {
  const current = requireCssoccerFreePlayRematchSource(state);
  return createCssoccerFreePlayState({
    preparedFacts,
    preparedScene,
    controlCountry: current.config.controlCountry,
    seed: current.rng.initialSeed,
    rematchIndex: current.session.rematchIndex + 1,
  });
}

function requireCssoccerFreePlayRematchSource(state) {
  requirePlainObject(state, "free-play rematch source");
  if (
    state.schema !== CSSOCCER_FREE_PLAY_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || !Number.isSafeInteger(state.tick)
    || state.tick < 0
  ) {
    throw new Error("Free-play rematch requires the current fixed-fixture match state.");
  }
  assertCssoccerScoreState(state.score);
  const goal = assertCssoccerGoalState(state.goal);
  if (!sameValue(goal.score, state.score)) {
    throw new Error("Free-play rematch source goal and score diverged.");
  }
  requirePlainObject(state.rng, "free-play rematch RNG");
  requireUint32(state.rng.initialSeed, "free-play rematch seed");
  requirePlainObject(state.session, "free-play rematch session");
  requireUint32(state.session.rematchIndex, "free-play rematch index");
  return state;
}

export function deriveCssoccerFreePlayKickoffReadiness(state) {
  const current = assertCssoccerFreePlayState(state, { skipReadiness: true });
  return deriveKickoffReadiness({
    players: current.players,
    ball: current.ball,
    officials: current.officials,
  });
}

export function assertCssoccerFreePlayState(state, { skipReadiness = false } = {}) {
  requirePlainObject(state, "free-play state");
  requireExactKeys(state, ROOT_KEYS, "free-play state");
  if (
    state.schema !== CSSOCCER_FREE_PLAY_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || state.tick !== 0
    || state.phase !== "opening-kickoff"
  ) {
    throw new Error(`Free-play initialization must use ${CSSOCCER_FREE_PLAY_STATE_SCHEMA}.`);
  }
  requireFixedConfig(state.config);
  requireBindings(state.bindings);
  requireTeams(state.teams);
  requirePlayers(state.players, state.teams);
  assertCssoccerOfficialState(state.officials);
  const ball = createBallMatchState(state.ball);
  if (!sameValue(ball, state.ball) || ball.ball.tick !== state.tick) {
    throw new Error("Free-play ball state is not the browser-owned tick-zero state.");
  }
  const possession = createPossessionState(state.possession);
  if (!sameValue(possession, state.possession) || possession.owner !== 0) {
    throw new Error("Free-play kickoff must start without injected possession.");
  }
  requireRuleCoordinator(state.rules, state.players);
  requireClock(state.clock, state.tick);
  if (state.result !== null) {
    throw new Error("Free-play initialization cannot start with a final result.");
  }
  assertCssoccerScoreState(state.score);
  const goal = assertCssoccerGoalState(state.goal);
  if (!sameValue(goal.score, state.score) || goal.phase !== "normal-play") {
    throw new Error("Free-play goal state must start clear and share the match score.");
  }
  requireRng(state.rng, state.ball);
  requireTactics(state.tactics);
  requireControl(state.control, state.players, state.config.controlCountry);
  const playerHighlight = assertCssoccerPlayerHighlightState(state.playerHighlight);
  if (
    playerHighlight.tick !== state.tick
    || !sameValue(
      playerHighlight,
      createCssoccerPlayerHighlightState(
        createCssoccerFreePlayPlayerHighlightInputFrame({ match: state, tick: state.tick }),
      ),
    )
  ) {
    throw new Error("Free-play player highlight must derive from the current tick-zero state.");
  }
  requireActors(state.actors, state.players, state.officials);
  requireSession(state.session);
  requireKickoff(state.kickoff, state.players, state.ball);
  if (!skipReadiness) {
    const expectedReadiness = deriveKickoffReadiness({
      players: state.players,
      ball: state.ball,
      officials: state.officials,
    });
    if (!sameValue(state.kickoff.readiness, expectedReadiness)) {
      throw new Error("Free-play kickoff readiness must derive only from current state.");
    }
  }
  return state;
}

function requirePreparedFixture(facts, scene) {
  requirePlainObject(facts, "prepared free-play facts");
  requirePlainObject(scene, "prepared free-play scene");
  if (
    facts.schema !== "cssoccer-prepared-fixture-facts@1"
    || facts.id !== FIXTURE_ID
    || facts.status !== "ready"
    || scene.schema !== "cssoccer-prepared-match-scene@1"
    || scene.id !== FIXTURE_ID
    || scene.status !== "ready"
  ) {
    throw new Error("Free play requires the ready Spain-Argentina prepared fixture.");
  }
  const control = facts.control;
  if (
    !sameValue(control?.countries, COUNTRIES)
    || control.canonicalProfile !== "argentina-control"
    || control.ownershipSymmetryProfile !== "spain-control"
    || control.users !== 1
    || control.autoPlayer !== -1
  ) {
    throw new Error("Free play requires the prepared Spain and Argentina local-user profiles.");
  }
  const teams = requirePreparedTeams(facts.teams);
  const tactics = requirePreparedTactics(facts.tactics);
  const timing = requirePreparedTiming(facts.timing);
  const rules = requirePreparedRules(facts.rules);
  if (!isSha256(facts.rulesSha256) || !isSha256(facts.timingSha256)) {
    throw new Error("Prepared free-play rule and timing bindings must be SHA-256.");
  }
  if (!Number.isInteger(facts.seed?.value) || facts.seed.value !== 3523) {
    throw new Error("Prepared free-play facts must retain the fixed fixture seed.");
  }
  const roots = requirePreparedActorRoots(scene.roots, teams, facts.sourceFacts);
  return deepFreeze({
    teams,
    tactics,
    timing,
    rules,
    seed: facts.seed.value,
    sourceRevision: facts.teams.sourceRevision,
    teamAuthoritySha256: facts.teams.authoritySha256,
    rulesSha256: facts.rulesSha256,
    timingSha256: facts.timingSha256,
    ...roots,
  });
}

function requirePreparedTeams(value) {
  requirePlainObject(value, "prepared free-play teams");
  if (
    value.schema !== "cssoccer-team-preparation@1"
    || value.fixtureId !== FIXTURE_ID
    || !isSha256(value.authoritySha256)
    || typeof value.sourceRevision !== "string"
    || value.sourceRevision.length === 0
    || !Array.isArray(value.teams)
    || value.teams.length !== 2
    || !Array.isArray(value.starters)
    || value.starters.length !== PLAYER_COUNT
  ) {
    throw new Error("Prepared free-play teams must be the exact fixed fixture.");
  }
  const teams = value.teams.map((team, teamIndex) => {
    const country = COUNTRIES[teamIndex];
    const expectedSlot = teamIndex === 0 ? "A" : "B";
    const expectedTeamId = country === "spain" ? 2 : 20;
    requirePlainObject(team, `prepared ${country} team`);
    if (
      team.id !== `team-${country}`
      || team.country !== country
      || team.sourceTeamId !== expectedTeamId
      || team.nativeTeamSlot !== expectedSlot
      || team.nativeUserToken !== (teamIndex === 0 ? -1 : -2)
      || !Array.isArray(team.roster?.starters)
      || team.roster.starters.length !== 11
      || team.formation?.selected !== 0
    ) {
      throw new Error(`Prepared ${country} team changed from the fixed fixture.`);
    }
    return deepFreeze({
      id: team.id,
      country,
      label: team.label,
      sourceTeamId: team.sourceTeamId,
      nativeTeamSlot: team.nativeTeamSlot,
      nativeUserToken: team.nativeUserToken,
      identity: projectTeamIdentity(team.identity, country),
      formation: {
        selected: team.formation.selected,
        automatic: team.formation.automatic,
        computer: team.formation.computer,
        tacticsSha256: team.formation.tacticsSha256,
      },
      kitBindingSha256: requireSha256(team.kit?.bindingSha256, `${country} kit binding`),
      rosterSha256: requireSha256(team.roster.rosterSha256, `${country} roster binding`),
      startersSha256: requireSha256(
        team.roster.startersSha256,
        `${country} starter binding`,
      ),
      starters: team.roster.starters.map((starter, index) => (
        projectStarter(starter, country, teamIndex * 11 + index)
      )),
    });
  });
  const nested = teams.flatMap(({ starters }) => starters);
  const projectedTopLevel = value.starters.map((starter, index) => (
    projectStarter(starter, index < 11 ? "spain" : "argentina", index)
  ));
  if (!sameValue(nested, projectedTopLevel)) {
    throw new Error("Prepared team and top-level starter identities diverged.");
  }
  return teams;
}

function requirePreparedTactics(value) {
  requirePlainObject(value, "prepared free-play tactics");
  if (
    value.schema !== "cssoccer-prepared-tactics@1"
    || value.fixtureId !== FIXTURE_ID
    || value.formationId !== 0
    || value.formationSymbol !== "F_4_3_3"
    || value.layout?.rows !== 70
    || value.layout?.outfieldPlayers !== 10
    || value.layout?.coordinates !== 2
    || !isSha256(value.tableSha256)
    || !Array.isArray(value.values)
    || value.values.length !== 70
  ) {
    throw new Error("Free play requires the prepared F_4_3_3 tactics table.");
  }
  const values = value.values.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== 10) {
      throw new Error(`Prepared tactics row ${rowIndex} must contain ten outfield targets.`);
    }
    return row.map((point, pointIndex) => {
      if (
        !Array.isArray(point)
        || point.length !== 2
        || point.some((coordinate) => !Number.isFinite(coordinate))
      ) {
        throw new Error(`Prepared tactics row ${rowIndex} target ${pointIndex} is invalid.`);
      }
      return [F32(point[0]), F32(point[1])];
    });
  });
  return deepFreeze({
    formationId: value.formationId,
    formationSymbol: value.formationSymbol,
    tableSha256: value.tableSha256,
    values,
  });
}

function requirePreparedTiming(value) {
  requirePlainObject(value, "prepared free-play timing");
  if (!sameValue(value, FIXED_TIMING)) {
    throw new Error("Prepared free-play timing changed from the fixed two-minute fixture.");
  }
  return clone(FIXED_TIMING);
}

function requirePreparedRules(value) {
  requirePlainObject(value, "prepared free-play rules");
  const projected = {
    competitionId: value.competition?.id,
    simulationId: value.simulation?.id,
    offside: value.offside,
    wind: value.wind,
    substitutes: value.substitutes,
    bookings: value.bookings,
    freeKicks: value.freeKicks,
    audio: value.audio,
    drawsFinal: value.drawsFinal,
    extraTime: value.extraTime,
    penalties: value.penalties,
  };
  if (!sameValue(projected, PREPARED_FIXTURE_RULES)) {
    throw new Error("Prepared free-play rules changed from the fixed friendly fixture.");
  }
  return clone(PREPARED_FIXTURE_RULES);
}

function requirePreparedActorRoots(roots, teams, sourceFacts) {
  requirePlainObject(roots, "prepared free-play actor roots");
  const playerRoots = requireRootGroup(roots.players, "player", PLAYER_COUNT);
  const officialRoots = requireRootGroup(roots.officials, "official", 3);
  const ballRoots = requireRootGroup(roots.ball, "ball", 1);
  const starters = teams.flatMap(({ starters }) => starters);
  for (const [index, starter] of starters.entries()) {
    const root = playerRoots[index];
    if (
      root.id !== starter.id
      || root.country !== starter.country
      || root.nativeRuntimeIndex !== index
      || root.nativeRendererIndex !== index
    ) {
      throw new Error(`Prepared player render root changed for ${starter.id}.`);
    }
  }
  const officialFacts = sourceFacts?.officials?.rendererIdentities;
  if (!Array.isArray(officialFacts) || officialFacts.length !== 3) {
    throw new Error("Prepared source facts must contain the three officials.");
  }
  const expectedOfficialIds = ["referee-00", "assistant-referee-01", "assistant-referee-02"];
  for (let index = 0; index < officialRoots.length; index += 1) {
    if (
      officialRoots[index].id !== expectedOfficialIds[index]
      || officialRoots[index].nativeRendererIndex !== officialFacts[index].nativeRendererIndex
    ) {
      throw new Error("Prepared official root identities changed.");
    }
  }
  if (ballRoots[0].id !== "ball-00") {
    throw new Error("Prepared free-play ball root must remain ball-00.");
  }
  return {
    playerRootIds: playerRoots.map(({ id }) => id),
    officialRootIds: officialRoots.map(({ id }) => id),
    ballRootId: ballRoots[0].id,
  };
}

function requireRootGroup(value, kind, count) {
  if (!Array.isArray(value) || value.length !== count) {
    throw new Error(`Prepared free-play scene requires ${count} ${kind} roots.`);
  }
  const ids = new Set();
  return value.map((root) => {
    requirePlainObject(root, `prepared ${kind} root`);
    if (
      typeof root.id !== "string"
      || root.kind !== kind
      || root.stableDom !== true
      || ids.has(root.id)
    ) {
      throw new Error(`Prepared ${kind} roots must be unique and stable.`);
    }
    ids.add(root.id);
    // Deliberately project no initialBinding/nativeState/retained field.
    return {
      id: root.id,
      country: root.country ?? null,
      nativeRuntimeIndex: root.nativeRuntimeIndex ?? null,
      nativeRendererIndex: root.nativeRendererIndex ?? null,
    };
  });
}

function createTeams(preparedTeams) {
  return deepFreeze(preparedTeams.map((team) => ({
    id: team.id,
    country: team.country,
    label: team.label,
    sourceTeamId: team.sourceTeamId,
    nativeTeamSlot: team.nativeTeamSlot,
    nativeUserToken: team.nativeUserToken,
    identity: clone(team.identity),
    formation: clone(team.formation),
    kitBindingSha256: team.kitBindingSha256,
    rosterSha256: team.rosterSha256,
    startersSha256: team.startersSha256,
    starterIds: team.starters.map(({ id }) => id),
    starters: team.starters.map(clone),
  })));
}

function createTactics(prepared) {
  return deepFreeze({
    formationId: prepared.formationId,
    formationSymbol: prepared.formationSymbol,
    tableSha256: prepared.tableSha256,
    slots: {
      A: clone(prepared.values),
      B: clone(prepared.values),
    },
  });
}

function createPlayers({ teams, tactics, playerRootIds }) {
  const starters = teams.flatMap((team) => team.starterIds.map((id) => ({ id, team })));
  const takers = selectCentreTakers(starters, tactics.slots.A);
  return deepFreeze(starters.map(({ id, team }, index) => {
    const nativePlayerNumber = index + 1;
    const roleTarget = kickoffRoleTarget({
      nativePlayerNumber,
      nativeTeamSlot: team.nativeTeamSlot,
      tactics,
      takers,
    });
    const identity = playerIdentityFromTeam(team, id);
    const gameplay = createGameplayAttributes(identity.attributes);
    const position = openingLinePosition(index, team.nativeTeamSlot);
    const sourceFacing = team.nativeTeamSlot === "A"
      ? { x: F32(1), y: F32(0) }
      : { x: F32(-1), y: F32(0) };
    return {
      id,
      country: team.country,
      teamId: team.id,
      renderRootId: playerRootIds[index],
      nativeRuntimeIndex: index,
      nativePlayerNumber,
      nativeTeamSlot: team.nativeTeamSlot,
      active: true,
      role: roleTarget.role,
      targetOwner: roleTarget.targetOwner,
      target: { ...roleTarget.target, z: F32(0) },
      position,
      previousPosition: clone(position),
      previousFacing: clone(sourceFacing),
      velocity: { x: F32(0), y: F32(0), z: F32(0) },
      facing: sourceFacing,
      identity,
      gameplay,
      intelligence: {
        special: 0,
        move: 0,
        count: 0,
      },
      ballState: 0,
      action: createCssoccerActionState({
        tick: 0,
        playerId: id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: sourceFacing.x,
        facingY: sourceFacing.y,
      }),
      animation: {
        status: "source-initialized",
        kind: "stand",
        id: 78,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        frame: F32(0),
        frameStep: F32(1 / (20 * 39 / 40)),
        pending: null,
        tick: 0,
      },
      stamina: {
        initial: gameplay.stamina,
        current: gameplay.stamina,
        depleted: false,
      },
    };
  }));
}

function openingLinePosition(index, nativeTeamSlot) {
  const side = nativeTeamSlot === "A" ? -1 : 1;
  const localIndex = index % 11;
  return {
    x: F32(
      CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x
      + (side * CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 2)
    ),
    y: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y + 240 - (localIndex * 24)),
    z: F32(0),
  };
}

function createGameplayAttributes(attributes) {
  return deepFreeze(Object.fromEntries(Object.entries(attributes).map(([key, value]) => [
    key,
    Math.trunc((value * 128) / 100),
  ])));
}

function createKickoffMotion(players, selectedCountry) {
  return createCssoccerCurrentKickoffPlayerMotion({
    ballPosition: clone(CSSOCCER_KICKOFF_CONSTANTS.centreSpot),
    goToPositionDistance:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8,
    matchHalf: 0,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    pitchLength: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength),
    players: players.map((player) => ({
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      teamRate: player.gameplay.pace,
      action: player.action.action.value,
      directionMode: 0,
      faceDirection: 0,
      goStep: false,
      position: { x: player.position.x, y: player.position.y },
      facing: clone(player.facing),
    })),
    selectedCountry,
    targetPlayers: players.map((player) => ({
      id: player.id,
      country: player.country,
      nativeTeamSlot: player.nativeTeamSlot,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      role: player.role,
      target: { x: player.target.x, y: player.target.y },
      targetOwner: player.targetOwner,
    })),
    teamBySlot: { A: "spain", B: "argentina" },
  });
}

function playerIdentityFromTeam(team, id) {
  const index = team.starterIds.indexOf(id);
  if (index < 0) throw new Error(`Missing prepared player identity ${id}.`);
  const source = team.starters?.[index];
  if (!source) throw new Error(`Prepared player identity ${id} was not projected.`);
  return clone(source);
}

function selectCentreTakers(starters, tacticValues) {
  const candidates = starters.slice(1, 11).map(({ id }, index) => ({
    id,
    nativePlayerNumber: index + 2,
    point: tacticValues[CSSOCCER_KICKOFF_CONSTANTS.centreTacticRow][index],
  }));
  const selected = [];
  for (let pass = 0; pass < 2; pass += 1) {
    let minimum = 1_000;
    let picked = null;
    for (const candidate of candidates) {
      if (selected.includes(candidate.nativePlayerNumber)) continue;
      const distance = Math.trunc(sourceDistance2d({
        x: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x - candidate.point[0]),
        y: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y - candidate.point[1]),
      }));
      if (distance < minimum) {
        minimum = distance;
        picked = candidate.nativePlayerNumber;
      }
    }
    if (picked === null) throw new Error("Prepared centre tactic row has no two takers.");
    selected.push(picked);
  }
  return { taker: selected[0], receiver: selected[1] };
}

function kickoffRoleTarget({ nativePlayerNumber, nativeTeamSlot, tactics, takers }) {
  const profile = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff;
  if (nativePlayerNumber === 1) {
    return {
      role: "keeper",
      target: { x: profile.keeperOffline.value, y: F32(399) },
      targetOwner: "INTELL.CPP find_zonal_target KP_A",
    };
  }
  if (nativePlayerNumber === 12) {
    return {
      role: "keeper",
      target: {
        x: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength - profile.keeperOffline.value),
        y: F32(399),
      },
      targetOwner: "INTELL.CPP find_zonal_target KP_B",
    };
  }
  if (nativePlayerNumber === takers.taker) {
    return {
      role: "taker",
      target: { x: F32(640), y: F32(390) },
      targetOwner: "INTELL.CPP centre_pos centre_guy_1",
    };
  }
  if (nativePlayerNumber === takers.receiver) {
    return {
      role: "receiver",
      target: { x: F32(645), y: F32(410) },
      targetOwner: "INTELL.CPP centre_pos centre_guy_2",
    };
  }
  const row = nativeTeamSlot === "A"
    ? CSSOCCER_KICKOFF_CONSTANTS.centreTacticRow
    : CSSOCCER_KICKOFF_CONSTANTS.defendingTacticRow;
  const index = nativeTeamSlot === "A"
    ? nativePlayerNumber - 2
    : nativePlayerNumber - 13;
  const [sourceX, sourceY] = tactics.slots[nativeTeamSlot][row][index];
  return {
    role: "outfield",
    target: nativeTeamSlot === "A"
      ? { x: F32(sourceX), y: F32(sourceY) }
      : {
        x: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength - sourceX),
        y: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchWidth - sourceY),
      },
    targetOwner: `INTELL.CPP get_target row ${row}`,
  };
}

function createKickoff({ players, ball, officials, motion }) {
  const taker = players.find(({ role }) => role === "taker");
  const receiver = players.find(({ role }) => role === "receiver");
  if (!taker || !receiver || taker.country !== "spain" || receiver.country !== "spain") {
    throw new Error("Opening centre taker and receiver must belong to Spain in slot A.");
  }
  return deepFreeze({
    phase: "source-initialization",
    phaseTick: 0,
    owner: {
      country: "spain",
      nativeTeamSlot: "A",
      takerId: taker.id,
      receiverId: receiver.id,
    },
    ballStatus: "held-at-centre",
    pendingAction: null,
    action: null,
    launch: null,
    zoning: createCssoccerZoneState({
      A: { ballZone: 68, zoneCenter: { x: 0, y: 0 } },
      B: { ballZone: 69, zoneCenter: { x: 0, y: 0 } },
    }),
    motion,
    readiness: deriveKickoffReadiness({ players, ball, officials }),
  });
}

function deriveKickoffReadiness({ players, ball, officials }) {
  const ballPosition = ball.ball.position;
  const taker = players.find(({ role }) => role === "taker");
  const allStanding = players.every((player) => (
    player.active
    && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
    && sourceDistance2d({
      x: F32(player.target.x - player.position.x),
      y: F32(player.target.y - player.position.y),
    }) <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.motion.imThereDistance.value
  ));
  const takerVector = {
    x: F32(ballPosition.x - taker.position.x),
    y: F32(ballPosition.y - taker.position.y),
  };
  const takerDistance = sourceDistance2d(takerVector);
  const facingCosine = takerDistance === 0
    ? 1
    : ((takerVector.x * taker.facing.x) + (takerVector.y * taker.facing.y))
      / takerDistance;
  const takerReady = taker.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
    && takerDistance < F32(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.besideBall.value * 3,
    )
    && facingCosine > CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.facingAngle.value;
  const refereeReady = officials.officials[0].action
    === CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value;
  return deepFreeze({
    allStanding,
    takerReady,
    refereeReady,
    readyForLaunch: allStanding && takerReady && refereeReady,
    setPieceWaitTicks:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.setPieceWaitTicks.value,
  });
}

function createInitialRngState(initialSeed) {
  const randSeed = CSSOCCER_NATIVE_RNG_SOURCE.firstRetainedOutput;
  return createCssoccerNativeRngState({
    state: initialSeed,
    randSeed,
    seed: randSeed & 127,
    calls: 0,
  });
}

function projectTeamIdentity(identity, country) {
  requirePlainObject(identity, `${country} team identity`);
  const projected = {
    name: identity.name,
    nickname: identity.nickname,
    coach: identity.coach,
    countryCode: identity.countryCode,
    ranking: identity.ranking,
    teamNumber: identity.teamNumber,
    formation: identity.formation,
    autoFormation: identity.autoFormation,
    computerFormation: identity.computerFormation,
  };
  if (
    typeof projected.name !== "string"
    || typeof projected.coach !== "string"
    || !Number.isInteger(projected.ranking)
    || !Number.isInteger(projected.teamNumber)
  ) {
    throw new Error(`Prepared ${country} team identity is invalid.`);
  }
  return deepFreeze(projected);
}

function projectStarter(starter, country, nativeRuntimeIndex) {
  requirePlainObject(starter, `prepared ${country} starter`);
  const expectedId = `${country}-player-${String((nativeRuntimeIndex % 11) + 1).padStart(2, "0")}`;
  if (
    starter.id !== expectedId
    || starter.nativeRuntimeIndex !== nativeRuntimeIndex
    || starter.nativeRendererIndex !== nativeRuntimeIndex
    || starter.sourceRosterIndex !== nativeRuntimeIndex % 11
    || typeof starter.name !== "string"
    || starter.name.length === 0
    || !isSha256(starter.sourceRecordSha256)
  ) {
    throw new Error(`Prepared starter identity changed for ${expectedId}.`);
  }
  const attributes = {};
  for (const key of [
    "accuracy", "control", "discipline", "flair", "pace", "power", "stamina", "vision",
  ]) {
    const value = starter.attributes?.[key];
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new Error(`Prepared starter ${expectedId} has invalid ${key}.`);
    }
    attributes[key] = value;
  }
  return deepFreeze({
    id: starter.id,
    country,
    name: starter.name,
    sourceRosterIndex: starter.sourceRosterIndex,
    nativeRuntimeIndex,
    nativeRendererIndex: starter.nativeRendererIndex,
    squadNumber: starter.squadNumber,
    position: starter.position,
    skinTone: starter.skinTone,
    flags: starter.flags,
    goalIndex: starter.goalIndex,
    attributes,
    sourceRecordByteRange: clone(starter.sourceRecordByteRange),
    sourceRecordSha256: starter.sourceRecordSha256,
  });
}

function requireOfficialRootAlignment(officials, rootIds) {
  const stateIds = officials.officials.map(({ id }) => id);
  if (!sameValue(stateIds, rootIds)) {
    throw new Error("Source-initialized official state diverged from prepared stable roots.");
  }
}

function requireFixedConfig(config) {
  requirePlainObject(config, "free-play config");
  if (
    !COUNTRIES.includes(config.controlCountry)
    || !sameValue(config.teams, { home: "spain", away: "argentina" })
    || !sameValue(config.timing, FIXED_TIMING)
    || !sameValue(config.rules, FULL_MATCH_ALPHA_RULES)
    || config.sourceConstants?.logicHz !== 20
    || config.sourceConstants?.timestepMilliseconds !== 50
    || config.sourceConstants?.pitchLength !== 1280
    || config.sourceConstants?.pitchWidth !== 800
    || config.sourceConstants?.ballDiameter !== 4
    || config.sourceConstants?.gameplayProfileHash
      !== CSSOCCER_NATIVE_GAMEPLAY_PROFILE.profileHash
  ) {
    throw new Error("Free-play fixed configuration changed.");
  }
}

function requireBindings(bindings) {
  requirePlainObject(bindings, "free-play source bindings");
  requireExactKeys(bindings, [
    "gameplayProfileHash",
    "rulesSha256",
    "sourceRevision",
    "tacticsTableSha256",
    "teamAuthoritySha256",
    "timingSha256",
  ], "free-play source bindings");
  if (typeof bindings.sourceRevision !== "string" || bindings.sourceRevision.length === 0) {
    throw new Error("Free-play source revision is missing.");
  }
  for (const [key, value] of Object.entries(bindings)) {
    if (key !== "sourceRevision" && !isSha256(value)) {
      throw new Error(`Free-play ${key} must be SHA-256.`);
    }
  }
}

function requireTeams(teams) {
  if (!Array.isArray(teams) || teams.length !== 2) {
    throw new Error("Free play requires exactly Spain and Argentina.");
  }
  for (let index = 0; index < teams.length; index += 1) {
    const country = COUNTRIES[index];
    if (
      teams[index].id !== `team-${country}`
      || teams[index].country !== country
      || teams[index].nativeTeamSlot !== (index === 0 ? "A" : "B")
      || !Array.isArray(teams[index].starterIds)
      || teams[index].starterIds.length !== 11
    ) {
      throw new Error(`Free-play ${country} team state is invalid.`);
    }
  }
}

function requirePlayers(players, teams) {
  if (!Array.isArray(players) || players.length !== PLAYER_COUNT) {
    throw new Error("Free play requires exactly 22 browser-owned players.");
  }
  const expectedIds = teams.flatMap(({ starterIds }) => starterIds);
  if (!sameValue(players.map(({ id }) => id), expectedIds)) {
    throw new Error("Free-play players changed stable identity or order.");
  }
  for (const [index, player] of players.entries()) {
    const expectedPosition = openingLinePosition(index, player.nativeTeamSlot);
    const expectedFacing = player.nativeTeamSlot === "A"
      ? { x: F32(1), y: F32(0) }
      : { x: F32(-1), y: F32(0) };
    if (
      player.nativeRuntimeIndex !== index
      || player.nativePlayerNumber !== index + 1
      || player.renderRootId !== player.id
      || player.active !== true
      || !sameValue(player.position, expectedPosition)
      || !sameValue(player.previousPosition, expectedPosition)
      || !sameValue(player.facing, expectedFacing)
      || !sameValue(player.previousFacing, expectedFacing)
      || player.velocity.x !== 0
      || player.velocity.y !== 0
      || player.velocity.z !== 0
      || player.animation?.status !== "source-initialized"
      || player.animation?.id !== 78
      || player.animation?.frame !== 0
      || player.animation?.sourceActionId !== CSSOCCER_NATIVE_ACTIONS.STAND
      || !sameValue(player.gameplay, createGameplayAttributes(player.identity?.attributes))
      || !sameValue(player.intelligence, { special: 0, move: 0, count: 0 })
      || player.ballState !== 0
      || player.stamina?.current !== player.gameplay.stamina
    ) {
      throw new Error(`Free-play player initialization is invalid for ${player.id}.`);
    }
    assertCssoccerActionState(player.action);
  }
}

function requireRuleCoordinator(rules, players) {
  requirePlainObject(rules, "free-play rule coordinator");
  if (
    rules.phase !== "centre-restart"
    || rules.matchMode !== 5
    || rules.gameAction !== 1
    || rules.setPiece !== 3
    || rules.deadBallCount !== 40
    || rules.canBeOffside !== 1
  ) {
    throw new Error("Free-play rules must start from the source centre restart.");
  }
  assertCssoccerRuleState(rules.state);
  const ids = rules.state.discipline.players.map(({ id }) => id);
  if (!sameValue(ids, players.map(({ id }) => id))) {
    throw new Error("Free-play rule identities diverged from players.");
  }
}

function requireClock(clock, tick) {
  if (
    assertCssoccerClockState(clock) !== clock
    || !sameValue(clock, createCssoccerClockState())
    || clock.tick !== tick
  ) {
    throw new Error("Free-play clock must start stopped at the opening centre.");
  }
}

function requireRng(rng, ball) {
  requirePlainObject(rng, "free-play RNG");
  requireExactKeys(rng, ["initialSeed", "state"], "free-play RNG");
  requireUint32(rng.initialSeed, "free-play RNG initial seed");
  const state = createCssoccerNativeRngState(rng.state);
  if (!sameValue(state, rng.state) || state.state !== rng.initialSeed) {
    throw new Error("Free-play RNG is not initialized from its explicit seed.");
  }
  if (!sameValue(ball.ball.rng, state)) {
    throw new Error("Free-play ball and root RNG states diverged at initialization.");
  }
}

function requireTactics(tactics) {
  if (
    tactics.formationId !== 0
    || tactics.formationSymbol !== "F_4_3_3"
    || !isSha256(tactics.tableSha256)
    || !Array.isArray(tactics.slots?.A)
    || !Array.isArray(tactics.slots?.B)
    || tactics.slots.A.length !== 70
    || !sameValue(tactics.slots.A, tactics.slots.B)
  ) {
    throw new Error("Free-play tactics changed from the prepared source table.");
  }
}

function requireControl(control, players, controlCountry) {
  const eligibleIds = players.filter(({ country }) => country === controlCountry).map(({ id }) => id);
  const nativeTeamSlot = controlCountry === "spain" ? "A" : "B";
  const nativeUserToken = controlCountry === "spain" ? -1 : -2;
  if (
    control.kind !== "local-user"
    || control.country !== controlCountry
    || control.teamId !== `team-${controlCountry}`
    || control.nativeTeamSlot !== nativeTeamSlot
    || control.nativeUserToken !== nativeUserToken
    || control.activePlayerId !== null
    || !sameValue(control.eligiblePlayerIds, eligibleIds)
  ) {
    throw new Error("Free-play control must belong to the selected country at kickoff.");
  }
}

function requireActors(actors, players, officials) {
  if (
    actors.count !== 26
    || !sameValue(actors.playerRootIds, players.map(({ id }) => id))
    || !sameValue(actors.officialRootIds, officials.officials.map(({ id }) => id))
    || actors.ballRootId !== "ball-00"
  ) {
    throw new Error("Free-play actor set must contain exactly 22 players, three officials, and one ball.");
  }
}

function requireSession(session) {
  if (
    typeof session.paused !== "boolean"
    || (session.paused && (typeof session.pauseReason !== "string" || session.pauseReason.length === 0))
    || (!session.paused && session.pauseReason !== null)
    || session.pendingCommand !== null
    || !Number.isInteger(session.rematchIndex)
    || session.rematchIndex < 0
    || session.rematchSeedPolicy !== "reuse-explicit-initial-seed"
  ) {
    throw new Error("Free-play pause/rematch initialization is invalid.");
  }
}

function requireKickoff(kickoff, players, ball) {
  const taker = players.find(({ role }) => role === "taker");
  const receiver = players.find(({ role }) => role === "receiver");
  if (
    kickoff.phase !== "source-initialization"
    || kickoff.phaseTick !== 0
    || kickoff.owner?.country !== "spain"
    || kickoff.owner?.nativeTeamSlot !== "A"
    || kickoff.owner?.takerId !== taker?.id
    || kickoff.owner?.receiverId !== receiver?.id
    || kickoff.ballStatus !== "held-at-centre"
    || kickoff.pendingAction !== null
    || kickoff.action !== null
    || kickoff.launch !== null
    || ball.ball.position.x !== 640
    || ball.ball.position.y !== 400
    || ball.ball.position.z !== 2
  ) {
    throw new Error("Free-play kickoff state changed from the source centre setup.");
  }
  const motion = assertCssoccerKickoffPlayerMotion(kickoff.motion);
  const zoning = assertCssoccerZoneState(kickoff.zoning);
  if (
    motion.tick !== 0
    || motion.status !== "positioning"
    || !sameValue(
      motion.players.map(({ id, position, facing, action }) => ({ id, position, facing, action })),
      players.map(({ id, position, facing, action }) => ({
        id,
        position: { x: position.x, y: position.y },
        facing,
        action: action.action.value,
      })),
    )
    || zoning.A.ballZone !== 68
    || zoning.B.ballZone !== 69
    || zoning.A.zoneCenter.x !== 0
    || zoning.A.zoneCenter.y !== 0
    || zoning.B.zoneCenter.x !== 0
    || zoning.B.zoneCenter.y !== 0
  ) {
    throw new Error("Free-play kickoff motion changed from the fresh source initializer.");
  }
}

function requireSha256(value, label) {
  if (!isSha256(value)) throw new Error(`${label} must be SHA-256.`);
  return value;
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/u.test(value ?? "");
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new TypeError(`${label} must be an exact uint32.`);
  }
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
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
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

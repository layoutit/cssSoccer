import { requireControlCountry } from "./fixtureContract.mjs";
import {
  assertCssoccerPlayerState,
  createCssoccerPlayerState,
  resetCssoccerPlayerState,
  swapCssoccerPlayerEnds,
} from "./playerState.mjs";

export const CSSOCCER_TEAM_STATE_SCHEMA = "cssoccer-team-state@1";

const FIXTURE_ID = "spain-argentina-full-match";
const COUNTRIES = Object.freeze(["spain", "argentina"]);
const TEAM_SPECS = deepFreeze({
  spain: { sourceTeamId: 2, kickoffNativeTeamSlot: "A", nativeUserToken: -1 },
  argentina: { sourceTeamId: 20, kickoffNativeTeamSlot: "B", nativeUserToken: -2 },
});

export function createCssoccerTeamState({
  preparedFacts,
  preparedScene,
  selectedCountry,
} = {}) {
  const country = requireControlCountry(selectedCountry);
  const prepared = requirePreparedFixture(preparedFacts, preparedScene);
  const players = prepared.teams.flatMap((team) => team.roster.starters.map((starter) => {
    const root = prepared.playerRoots.get(starter.id);
    const mesh = prepared.playerMeshes.get(starter.id);
    return createCssoccerPlayerState({ starter, root, mesh });
  }));
  requireExactPlayerSet(players);
  const teams = prepared.teams.map(createTeamState);
  const selectedTeam = teams.find((team) => team.country === country);
  const control = createControlState({
    preparedControl: prepared.control,
    selectedTeam,
  });
  const kickoff = createKickoffState(teams);
  const bindings = createBindings({ preparedFacts, players });

  return deepFreeze({
    schema: CSSOCCER_TEAM_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    bindings,
    teams,
    players,
    control,
    kickoff,
    current: currentFromKickoff(kickoff),
  });
}

/** Apply the one normal-time swap performed after the first half. */
export function swapCssoccerTeamEnds(state) {
  assertCssoccerTeamState(state);
  if (state.current.matchHalf !== 0 || state.current.endSwapCount !== 0) {
    throw new Error("cssoccer team ends may be swapped exactly once after the first half.");
  }
  const teams = state.teams.map((team) => ({
    ...clone(team),
    current: {
      nativeTeamSlot: oppositeTeamSlot(team.current.nativeTeamSlot),
      nativeUserToken: oppositeUserToken(team.current.nativeUserToken),
    },
  }));
  const players = state.players.map(swapCssoccerPlayerEnds);
  const nativeTeamBySlot = teamBySlot(teams);
  const selectedTeam = teams.find(({ country }) => country === state.control.selectedCountry);
  const control = {
    ...clone(state.control),
    currentNativeTeamSlot: selectedTeam.current.nativeTeamSlot,
    currentNativeUserToken: selectedTeam.current.nativeUserToken,
  };
  return deepFreeze({
    schema: CSSOCCER_TEAM_STATE_SCHEMA,
    fixtureId: state.fixtureId,
    bindings: clone(state.bindings),
    teams,
    players,
    control,
    kickoff: clone(state.kickoff),
    current: {
      matchHalf: 1,
      endSwapCount: 1,
      phase: "halftime-end-swap-second-half-kickoff",
      nativeTeamBySlot,
    },
  });
}

export function resetCssoccerTeamState(state) {
  assertCssoccerTeamState(state);
  const teams = state.teams.map((team) => ({
    ...clone(team),
    current: clone(team.kickoff),
  }));
  const players = state.players.map(resetCssoccerPlayerState);
  const selectedTeam = teams.find(({ country }) => country === state.control.selectedCountry);
  const control = {
    ...clone(state.control),
    currentNativeTeamSlot: selectedTeam.kickoff.nativeTeamSlot,
    currentNativeUserToken: selectedTeam.kickoff.nativeUserToken,
  };
  const kickoff = clone(state.kickoff);
  return deepFreeze({
    schema: CSSOCCER_TEAM_STATE_SCHEMA,
    fixtureId: state.fixtureId,
    bindings: clone(state.bindings),
    teams,
    players,
    control,
    kickoff,
    current: currentFromKickoff(kickoff),
  });
}

export function assertCssoccerTeamState(state) {
  requirePlainObject(state, "cssoccer team state");
  if (
    state.schema !== CSSOCCER_TEAM_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || !Array.isArray(state.teams)
    || state.teams.length !== 2
    || !Array.isArray(state.players)
    || state.players.length !== 22
  ) {
    throw new Error(`cssoccer team state must be the exact ${FIXTURE_ID} fixture.`);
  }
  requireBindings(state.bindings);
  for (const player of state.players) assertCssoccerPlayerState(player);
  requireExactPlayerSet(state.players);
  requireStateTeams(state.teams);
  requireControlState(state.control, state.teams, state.players);
  requirePlainObject(state.kickoff, "team-state kickoff");
  requirePlainObject(state.current, "team-state current");
  const expectedKickoff = createKickoffState(state.teams);
  if (!sameValue(state.kickoff, expectedKickoff)) {
    throw new Error("cssoccer kickoff team slots changed.");
  }
  const expectedCurrent = state.current.matchHalf === 0
    ? currentFromKickoff(state.kickoff)
    : {
      matchHalf: 1,
      endSwapCount: 1,
      phase: "halftime-end-swap-second-half-kickoff",
      nativeTeamBySlot: teamBySlot(state.teams),
    };
  if (!sameValue(state.current, expectedCurrent)) {
    throw new Error("cssoccer current end mapping is invalid.");
  }
  const expectedPlayerHalf = state.current.matchHalf;
  if (state.players.some(({ current }) => current.matchHalf !== expectedPlayerHalf)) {
    throw new Error("cssoccer player/team half state diverged.");
  }
  return state;
}

function requirePreparedFixture(facts, scene) {
  requirePlainObject(facts, "prepared fixture facts");
  requirePlainObject(scene, "prepared fixture scene");
  if (
    facts.schema !== "cssoccer-prepared-fixture-facts@1"
    || facts.id !== FIXTURE_ID
    || facts.status !== "ready"
    || scene.id !== FIXTURE_ID
    || scene.status !== "ready"
    || !Array.isArray(scene.roots?.players)
    || scene.roots.players.length !== 22
    || !Array.isArray(scene.meshes)
  ) {
    throw new Error("Team state requires the ready fixed prepared fixture.");
  }
  const control = requirePreparedControl(facts.control);
  const teams = requirePreparedTeams(facts.teams);
  const playerRoots = uniqueMap(scene.roots.players, "prepared player roots");
  const playerMeshes = uniqueMap(
    scene.meshes.filter(({ kind }) => kind === "player"),
    "prepared player meshes",
  );
  if (playerRoots.size !== 22 || playerMeshes.size !== 22) {
    throw new Error("Prepared fixture must expose exactly 22 player roots and meshes.");
  }
  return { control, teams, playerRoots, playerMeshes };
}

function requirePreparedControl(value) {
  requirePlainObject(value, "prepared control contract");
  if (
    !sameValue(value.countries, COUNTRIES)
    || value.canonicalProfile !== "argentina-control"
    || value.ownershipSymmetryProfile !== "spain-control"
    || value.users !== 1
    || value.autoPlayer !== -1
  ) {
    throw new Error("Prepared control contract must allow one auto-player user for Spain or Argentina.");
  }
  return deepFreeze({
    countries: [...value.countries],
    canonicalProfile: value.canonicalProfile,
    ownershipSymmetryProfile: value.ownershipSymmetryProfile,
    users: value.users,
    autoPlayer: value.autoPlayer,
  });
}

function requirePreparedTeams(value) {
  requirePlainObject(value, "prepared teams contract");
  if (
    value.schema !== "cssoccer-team-preparation@1"
    || value.fixtureId !== FIXTURE_ID
    || !/^[a-f0-9]{64}$/u.test(value.authoritySha256 ?? "")
    || !Array.isArray(value.teams)
    || value.teams.length !== 2
    || !Array.isArray(value.starters)
    || value.starters.length !== 22
  ) {
    throw new Error("Prepared teams contract is not the exact fixed fixture.");
  }
  const teams = value.teams.map((team, index) => {
    requirePlainObject(team, `prepared team ${index}`);
    const expectedCountry = COUNTRIES[index];
    const spec = TEAM_SPECS[expectedCountry];
    if (
      team.id !== `team-${expectedCountry}`
      || team.country !== expectedCountry
      || team.sourceTeamId !== spec.sourceTeamId
      || team.nativeTeamSlot !== spec.kickoffNativeTeamSlot
      || team.nativeUserToken !== spec.nativeUserToken
      || !Array.isArray(team.roster?.starters)
      || team.roster.starters.length !== 11
      || team.formation?.positionsStatus !== "unsupported-not-retained-by-fixture-contract"
    ) {
      throw new Error(`Prepared ${expectedCountry} team contract changed.`);
    }
    return team;
  });
  const nested = teams.flatMap(({ roster }) => roster.starters);
  if (!sameValue(nested, value.starters)) {
    throw new Error("Prepared top-level starters diverge from the two team rosters.");
  }
  return teams;
}

function createTeamState(team) {
  const spec = TEAM_SPECS[team.country];
  return {
    id: team.id,
    country: team.country,
    label: team.label,
    sourceTeamId: team.sourceTeamId,
    identity: clone(team.identity),
    formation: clone(team.formation),
    roster: {
      sourcePlayers: team.roster.sourcePlayers,
      retainedStarters: team.roster.retainedStarters,
      rosterSha256: team.roster.rosterSha256,
      startersSha256: team.roster.startersSha256,
      starterIds: team.roster.starters.map(({ id }) => id),
    },
    kitBindingSha256: team.kit.bindingSha256,
    kickoff: {
      nativeTeamSlot: spec.kickoffNativeTeamSlot,
      nativeUserToken: spec.nativeUserToken,
    },
    current: {
      nativeTeamSlot: spec.kickoffNativeTeamSlot,
      nativeUserToken: spec.nativeUserToken,
    },
  };
}

function createControlState({ preparedControl, selectedTeam }) {
  const profile = selectedTeam.country === "argentina"
    ? preparedControl.canonicalProfile
    : preparedControl.ownershipSymmetryProfile;
  return {
    mode: "auto-player",
    users: preparedControl.users,
    autoPlayer: preparedControl.autoPlayer,
    selectedCountry: selectedTeam.country,
    selectedTeamId: selectedTeam.id,
    profile,
    activePlayerId: null,
    eligiblePlayerIds: [...selectedTeam.roster.starterIds],
    kickoffNativeTeamSlot: selectedTeam.kickoff.nativeTeamSlot,
    kickoffNativeUserToken: selectedTeam.kickoff.nativeUserToken,
    currentNativeTeamSlot: selectedTeam.current.nativeTeamSlot,
    currentNativeUserToken: selectedTeam.current.nativeUserToken,
  };
}

function createKickoffState(teams) {
  const kickoffTeams = teams.map((team) => ({
    country: team.country,
    current: clone(team.kickoff),
  }));
  return {
    matchHalf: 0,
    endSwapCount: 0,
    phase: "opening-kickoff",
    nativeTeamBySlot: teamBySlot(kickoffTeams),
  };
}

function currentFromKickoff(kickoff) {
  return clone(kickoff);
}

function createBindings({ preparedFacts, players }) {
  const firstLineage = players[0].formation.kickoff.lineage;
  if (players.some(({ formation }) => !sameValue(formation.kickoff.lineage, firstLineage))) {
    throw new Error("Prepared player kickoff lineage is not uniform.");
  }
  if (
    preparedFacts.bindings?.nativeStateSha256 !== firstLineage.stateSha256
    || preparedFacts.bindings?.nativeFieldContractSha256 !== firstLineage.fieldContractSha256
    || preparedFacts.bindings?.nativeCaptureSha256 !== firstLineage.rawSha256
  ) {
    throw new Error("Prepared facts and player kickoff lineage hashes diverge.");
  }
  return {
    teamAuthoritySha256: preparedFacts.teams.authoritySha256,
    nativeRawSha256: firstLineage.rawSha256,
    nativeStateSha256: firstLineage.stateSha256,
    nativeFieldContractSha256: firstLineage.fieldContractSha256,
  };
}

function requireBindings(value) {
  requirePlainObject(value, "team-state bindings");
  for (const key of [
    "teamAuthoritySha256",
    "nativeRawSha256",
    "nativeStateSha256",
    "nativeFieldContractSha256",
  ]) {
    if (!/^[a-f0-9]{64}$/u.test(value[key] ?? "")) {
      throw new Error(`Team-state ${key} is invalid.`);
    }
  }
}

function requireStateTeams(teams) {
  for (let index = 0; index < teams.length; index += 1) {
    const country = COUNTRIES[index];
    const team = teams[index];
    const spec = TEAM_SPECS[country];
    if (
      team.id !== `team-${country}`
      || team.country !== country
      || team.sourceTeamId !== spec.sourceTeamId
      || team.kickoff?.nativeTeamSlot !== spec.kickoffNativeTeamSlot
      || team.kickoff?.nativeUserToken !== spec.nativeUserToken
      || !Array.isArray(team.roster?.starterIds)
      || team.roster.starterIds.length !== 11
      || !["A", "B"].includes(team.current?.nativeTeamSlot)
      || ![-1, -2].includes(team.current?.nativeUserToken)
      || team.current.nativeUserToken !== userTokenForSlot(team.current.nativeTeamSlot)
    ) {
      throw new Error(`Team-state ${country} contract is invalid.`);
    }
  }
  if (teams[0].current.nativeTeamSlot === teams[1].current.nativeTeamSlot) {
    throw new Error("Both teams cannot own the same native slot.");
  }
}

function requireControlState(control, teams, players) {
  requirePlainObject(control, "team-state control");
  const selectedCountry = requireControlCountry(control.selectedCountry);
  const selectedTeam = teams.find(({ country }) => country === selectedCountry);
  const playerIds = new Set(players.map(({ id }) => id));
  if (
    control.mode !== "auto-player"
    || control.users !== 1
    || control.autoPlayer !== -1
    || control.selectedTeamId !== selectedTeam.id
    || control.activePlayerId !== null
    || control.kickoffNativeTeamSlot !== selectedTeam.kickoff.nativeTeamSlot
    || control.kickoffNativeUserToken !== selectedTeam.kickoff.nativeUserToken
    || control.currentNativeTeamSlot !== selectedTeam.current.nativeTeamSlot
    || control.currentNativeUserToken !== selectedTeam.current.nativeUserToken
    || !Array.isArray(control.eligiblePlayerIds)
    || !sameValue(control.eligiblePlayerIds, selectedTeam.roster.starterIds)
    || control.eligiblePlayerIds.some((id) => !playerIds.has(id))
  ) {
    throw new Error("Team-state selected-country ownership is invalid.");
  }
}

function requireExactPlayerSet(players) {
  const ids = players.map(({ id }) => id);
  const expected = COUNTRIES.flatMap((country) => Array.from(
    { length: 11 },
    (_, index) => `${country}-player-${String(index + 1).padStart(2, "0")}`,
  ));
  if (!sameValue(ids, expected) || new Set(ids).size !== 22) {
    throw new Error("Team state requires the exact 22 independent fixed-fixture starters.");
  }
}

function uniqueMap(values, label) {
  const map = new Map();
  for (const value of values) {
    if (typeof value?.id !== "string" || map.has(value.id)) {
      throw new Error(`${label} must have unique stable ids.`);
    }
    map.set(value.id, value);
  }
  return map;
}

function teamBySlot(teams) {
  return Object.fromEntries(teams
    .slice()
    .sort((left, right) => left.current.nativeTeamSlot.localeCompare(right.current.nativeTeamSlot))
    .map((team) => [team.current.nativeTeamSlot, team.country]));
}

function oppositeTeamSlot(slot) {
  if (slot === "A") return "B";
  if (slot === "B") return "A";
  throw new Error("Native team slot must be A or B.");
}

function userTokenForSlot(slot) {
  return slot === "A" ? -1 : -2;
}

function oppositeUserToken(token) {
  if (token === -1) return -2;
  if (token === -2) return -1;
  throw new Error("Native auto-player token must be -1 or -2.");
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

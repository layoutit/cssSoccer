import { createCssoccerNativeRngState } from "./randomState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  projectCssoccerNativePlayerAttributes,
} from "./nativeFixturePlayerProfile.mjs";
import {
  assertCssoccerPlayerAiState,
  createCssoccerPlayerAiState,
  stepCssoccerPlayerAi,
  syncCssoccerPlayerAiState,
} from "./playerAi.mjs";

export const CSSOCCER_TEAM_AI_STATE_SCHEMA = "cssoccer-team-ai-state@1";

export const CSSOCCER_TEAM_AI_SOURCE = deepFreeze({
  files: [
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      owners: "go_team/process_teams",
    },
    {
      file: "BALLINT.CPP",
      sha256: "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
      owners: "player_distances/get_nearest",
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      owners: "get_near_path/intelligence",
    },
    {
      file: "FOOTBALL.CPP",
      sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
      owners: "frame toggle and logic ordering",
    },
  ],
  processOrder: "toggle frame; A then B when true, B then A when false; ascending native player",
});

export function createCssoccerTeamAiState(teamState) {
  requirePlainObject(teamState, "cssoccer team state");
  if (
    teamState.schema !== "cssoccer-team-state@1"
    || teamState.fixtureId !== "spain-argentina-full-match"
    || !Array.isArray(teamState.players)
    || teamState.players.length !== 22
  ) {
    throw new Error("Team AI requires the exact Spain-Argentina team state.");
  }
  const selectedCountry = teamState.control?.selectedCountry;
  requireCountry(selectedCountry);
  const nativeProfile = matchNativePlayerProfile(teamState.players);
  const players = teamState.players.map((player) => createCssoccerPlayerAiState(
    player,
    nativeProfile.attributesById.get(player.id),
  ));
  requireCompleteNativePlayerSet(players);
  return deepFreeze({
    schema: CSSOCCER_TEAM_AI_STATE_SCHEMA,
    fixtureId: teamState.fixtureId,
    selectedCountry,
    matchHalf: nativeProfile.matchHalf,
    nativeFixturePlayerProfileHash: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
    tick: 0,
    sourceFrame: false,
    players,
    selectors: emptySelectors(players),
    lastProcessedOrder: [],
    lastDecisions: [],
  });
}

/**
 * Advance the 21 non-selected players once. The caller supplies the active
 * auto-player identity from the user-control lane and the shared RNG state;
 * this reducer never reselects the user or owns the generator.
 */
export function stepCssoccerTeamAi(state, context = {}) {
  const current = assertCssoccerTeamAiState(state);
  requirePlainObject(context, "team AI context");
  const activePlayerId = context.activePlayerId;
  requirePlayerId(activePlayerId);
  const active = current.players.find(({ id }) => id === activePlayerId);
  if (!active || active.country !== current.selectedCountry) {
    throw new Error("The active auto-player must belong to the selected country.");
  }
  const rng = createCssoccerNativeRngState(context.rngState);
  let players = current.players.map((player) => syncForTick(
    player,
    context.snapshotsById?.[player.id],
    player.id === activePlayerId,
  ));
  requireCompleteNativePlayerSet(players);
  if (players.some(({ native }) => native.on.value !== 1)) {
    throw new Error("The fixed no-substitution match requires all 22 starters active for team AI.");
  }

  const sourceFrame = !current.sourceFrame;
  const selectors = createCssoccerTeamAiSelectors(players, {
    ball: context.match?.ball,
    pathTargets: context.pathTargets,
    pitch: context.match?.pitch,
  });
  const order = nativeProcessOrder(players, sourceFrame)
    .filter(({ id }) => id !== activePlayerId);
  if (order.length !== 21) {
    throw new Error("Team AI must advance exactly 21 non-selected active players.");
  }

  const byId = new Map(players.map((player) => [player.id, player]));
  const decisions = [];
  const match = {
    ...clone(context.match),
    seed: rng.seed,
  };
  for (const ordered of order) {
    const before = byId.get(ordered.id);
    const after = stepCssoccerPlayerAi(before, {
      ...context,
      match,
      selectors,
      selectedTeamSlot: active.nativeTeamSlot,
    });
    byId.set(after.id, after);
    decisions.push(after.lastIntent);
  }
  players = players.map((player) => byId.get(player.id));
  const next = deepFreeze({
    schema: CSSOCCER_TEAM_AI_STATE_SCHEMA,
    fixtureId: current.fixtureId,
    selectedCountry: current.selectedCountry,
    matchHalf: current.matchHalf,
    nativeFixturePlayerProfileHash: current.nativeFixturePlayerProfileHash,
    tick: current.tick + 1,
    sourceFrame,
    players,
    selectors,
    lastProcessedOrder: order.map(({ id }) => id),
    lastDecisions: decisions,
  });
  return deepFreeze({ state: next, decisions });
}

export function createCssoccerTeamAiSelectors(players, {
  ball,
  pathTargets,
  pitch = {},
} = {}) {
  requirePlayerArray(players);
  requirePlainObject(ball, "team AI selector ball");
  const ballPosition = requirePoint(ball.position, "team AI selector ball position", true);
  requirePlainObject(pathTargets, "team AI path targets");
  const ratio = pitch?.ratio ?? (pitch?.length ?? 1280) / 120;
  requirePositiveFinite(ratio, "pitch ratio");

  const nearestBySlot = {};
  const nearPathBySlot = {};
  const interceptorBySlot = {};
  const distanceRankById = {};
  for (const slot of ["A", "B"]) {
    const team = players
      .filter((player) => player.nativeTeamSlot === slot && player.native.on.value > 0)
      .slice()
      .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
    const ranked = team
      .map((player) => ({
        player,
        distance: planarDistance(player.position, ballPosition),
      }))
      .sort((left, right) => (
        left.distance - right.distance
        || left.player.nativePlayerNumber - right.player.nativePlayerNumber
      ));
    ranked.forEach(({ player }, index) => {
      distanceRankById[player.id] = index + 1;
    });
    nearestBySlot[slot] = selectCssoccerNearestPlayer(team, ballPosition)?.nativePlayerNumber ?? 0;
    nearPathBySlot[slot] = selectCssoccerNearPathPlayer(team, {
      target: requirePoint(pathTargets[slot], `path target ${slot}`, true),
      pitchRatio: ratio,
    })?.nativePlayerNumber ?? 0;
    const interceptors = team.filter(({ intelligence }) => (
      intelligence.move === "intercept" && intelligence.count > 0
    ));
    if (interceptors.length > 1) {
      throw new Error(`Native team ${slot} cannot have more than one active interceptor.`);
    }
    interceptorBySlot[slot] = interceptors[0]?.nativePlayerNumber ?? 0;
  }
  return deepFreeze({
    nearestBySlot,
    nearPathBySlot,
    interceptorBySlot,
    distanceRankById,
  });
}

/** player_distances uses ascending native order and strict-less-than ties. */
export function selectCssoccerNearestPlayer(players, target) {
  requirePlayerArray(players);
  const point = requirePoint(target, "nearest-player target", true);
  let nearest = null;
  let closest = Number.POSITIVE_INFINITY;
  for (const player of players.slice().sort(
    (left, right) => left.nativePlayerNumber - right.nativePlayerNumber,
  )) {
    if (player.native.on.value <= 0) continue;
    const distance = planarDistance(player.position, point);
    if (distance < closest) {
      closest = distance;
      nearest = player;
    }
  }
  return nearest;
}

/** get_near_path scans native players backwards and keeps strict ties. */
export function selectCssoccerNearPathPlayer(players, {
  target,
  pitchRatio,
  ignoreIntelligenceBusy = true,
} = {}) {
  requirePlayerArray(players);
  const point = requirePoint(target, "near-path target", true);
  requirePositiveFinite(pitchRatio, "pitchRatio");
  if (typeof ignoreIntelligenceBusy !== "boolean") {
    throw new TypeError("ignoreIntelligenceBusy must be boolean.");
  }
  let nearest = null;
  let closest = 10000;
  for (const player of players.slice().sort(
    (left, right) => right.nativePlayerNumber - left.nativePlayerNumber,
  )) {
    if (
      player.native.on.value <= 0
      || player.actionClass !== "stand-run-turn"
      || player.intelligence.notMe > 0
      || (!ignoreIntelligenceBusy && player.intelligence.count !== 0)
    ) {
      continue;
    }
    const distance = planarDistance(player.position, point);
    if (player.keeper) {
      if (distance * 2 < closest && closest > pitchRatio * 2) {
        nearest = player;
        closest = distance;
      }
    } else if (distance < closest) {
      nearest = player;
      closest = distance;
    }
  }
  return nearest;
}

export function assertCssoccerTeamAiState(state) {
  requirePlainObject(state, "team AI state");
  if (
    state.schema !== CSSOCCER_TEAM_AI_STATE_SCHEMA
    || state.fixtureId !== "spain-argentina-full-match"
  ) {
    throw new Error(`Team AI state must use ${CSSOCCER_TEAM_AI_STATE_SCHEMA}.`);
  }
  requireCountry(state.selectedCountry);
  requireIntegerRange(state.matchHalf, 0, 1, "team AI match half");
  if (
    state.nativeFixturePlayerProfileHash
    !== CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH
  ) {
    throw new Error("Team AI native fixture player profile binding changed.");
  }
  requireIntegerRange(state.tick, 0, Number.MAX_SAFE_INTEGER, "team AI tick");
  if (typeof state.sourceFrame !== "boolean") {
    throw new TypeError("team AI sourceFrame must be boolean.");
  }
  requirePlayerArray(state.players);
  requireCompleteNativePlayerSet(state.players);
  requireBoundNativeAttributes(state.players, state.matchHalf);
  if (!Array.isArray(state.lastProcessedOrder) || !Array.isArray(state.lastDecisions)) {
    throw new Error("Team AI state requires decision/order ledgers.");
  }
  return state;
}

function matchNativePlayerProfile(players) {
  for (const matchHalf of [0, 1]) {
    const projected = projectCssoccerNativePlayerAttributes(
      CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
      { matchHalf },
    );
    const attributesById = new Map(projected.map((entry) => [entry.id, entry.attributes]));
    const nativeNumberById = new Map(
      projected.map((entry) => [entry.id, entry.nativePlayerNumber]),
    );
    if (players.every((player) => (
      nativeNumberById.get(player.id) === player.current?.nativePlayerNumber
    ))) {
      return { attributesById, matchHalf };
    }
  }
  throw new Error(
    "Team AI player identities/native slots do not match the bound native fixture profile.",
  );
}

function requireBoundNativeAttributes(players, matchHalf) {
  const expected = new Map(projectCssoccerNativePlayerAttributes(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf },
  ).map((entry) => [entry.id, entry]));
  for (const player of players) {
    const entry = expected.get(player.id);
    if (
      entry?.nativePlayerNumber !== player.nativePlayerNumber
      || JSON.stringify(entry.attributes) !== JSON.stringify(player.attributes)
    ) {
      throw new Error(`${player.id} diverged from the bound native fixture player profile.`);
    }
  }
}

function syncForTick(player, snapshot, selected) {
  const control = typedSample(
    `players.${player.id}.control`,
    "u8",
    selected ? 1 : 0,
  );
  return syncCssoccerPlayerAiState(player, {
    ...(snapshot ?? {}),
    control,
  });
}

function nativeProcessOrder(players, sourceFrame) {
  const first = sourceFrame ? "A" : "B";
  const second = first === "A" ? "B" : "A";
  return [first, second].flatMap((slot) => players
    .filter((player) => player.nativeTeamSlot === slot)
    .slice()
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber));
}

function emptySelectors(players) {
  return {
    nearestBySlot: { A: 0, B: 0 },
    nearPathBySlot: { A: 0, B: 0 },
    interceptorBySlot: { A: 0, B: 0 },
    distanceRankById: Object.fromEntries(players.map(({ id }) => [id, 0])),
  };
}

function requireCompleteNativePlayerSet(players) {
  const numbers = players.map(({ nativePlayerNumber }) => nativePlayerNumber).sort((a, b) => a - b);
  if (
    numbers.length !== 22
    || numbers.some((value, index) => value !== index + 1)
    || new Set(players.map(({ id }) => id)).size !== 22
  ) {
    throw new Error("Team AI requires one stable player identity in every native slot 1..22.");
  }
}

function requirePlayerArray(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("Team AI players must be a non-empty array.");
  }
  for (const player of value) assertCssoccerPlayerAiState(player);
}

function typedSample(fieldId, valueType, value) {
  const buffer = new ArrayBuffer(valueType === "u8" ? 1 : 2);
  const view = new DataView(buffer);
  if (valueType === "u8") view.setUint8(0, value);
  else view.setInt16(0, value, false);
  return {
    fieldId,
    valueType,
    value,
    numericBits: [...new Uint8Array(buffer)]
      .map((entry) => entry.toString(16).padStart(2, "0"))
      .join(""),
  };
}

function requirePoint(value, label, includeZ = false) {
  requirePlainObject(value, label);
  const point = { x: value.x, y: value.y };
  if (includeZ) point.z = value.z ?? 0;
  if (Object.values(point).some((entry) => !Number.isFinite(entry))) {
    throw new TypeError(`${label} must contain finite coordinates.`);
  }
  return deepFreeze(point);
}

function planarDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function requireCountry(value) {
  if (value !== "spain" && value !== "argentina") {
    throw new Error("Team AI selected country must be spain or argentina.");
  }
}

function requirePlayerId(value) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error("Team AI active player must be a fixed-fixture stable id.");
  }
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

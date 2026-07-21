import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  assertCssoccerNativeFixturePlayerProfile,
  projectCssoccerNativePlayerAttributes,
} from "./nativeFixturePlayerProfile.mjs";

const F32 = Math.fround;
const FIXTURE_ID = "spain-argentina-full-match";
const PLAYER_COUNT = 22;
const MAX_NORMAL_TIME_MINUTE = 90;

export const CSSOCCER_PLAYER_STAMINA_STATE_SCHEMA =
  "cssoccer-player-stamina-state@1";

export const CSSOCCER_PLAYER_STAMINA_SOURCE = deepFreeze({
  fixtureId: FIXTURE_ID,
  files: [
    {
      file: "FOOTBALL.CPP",
      sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
      producers: ["player_stamina", "process_flags"],
    },
    {
      file: "RULES.CPP",
      sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
      producers: ["match_clock", "add_player_time", "inc_inj"],
    },
    {
      file: "ANDYDEFS.H",
      sha256: "13d13dca2910a7685be7603e25bc9fa936253f5aa72f73eef3f54e851fbbce34",
      producers: ["match_player tm_rate/tm_stam/tm_time u8 stores"],
    },
  ],
  sourceOrder: [
    "match_clock crosses an integer game minute",
    "add_player_time increments every active fixture player's tm_time",
    "process_flags calls player_stamina",
    "player_stamina stores float f, stores float t, then truncates ir-t to unsigned char tm_rate",
    "swap_teams exchanges the two 11-player native-slot blocks once while stable player identity persists",
    "watch_match_time changes match_half from 1 to terminal 11 at normal-time minute 90",
  ],
  formula: {
    fatigue: "f32((sin((PI * tm_time / 120) - (PI / 2)) + 1) / 2)",
    loss: "f32(fatigue * (129 - tm_stam) / 140 * initial_tm_rate)",
    rate: "u8 trunc(initial_tm_rate - loss)",
  },
  supported: [
    "the fixed 22 starters while all remain active",
    "normal-time player minutes 0 through 90",
    "the one normal-time halftime native-slot remap",
    "terminal match_half 11 without a second native-slot remap",
  ],
  unsupportedHere: [
    "contact/injury profile refresh after the checked tick-214 frontier",
    "substitution or player-on/off time divergence",
    "extra time",
    "motion integration or action choice",
  ],
});

export class CssoccerUnsupportedPlayerStaminaError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedPlayerStaminaError";
    this.code = "CSSOCCER_UNSUPPORTED_PLAYER_STAMINA";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/** Create the exact opening native-slot stamina/rate baseline. */
export function createCssoccerPlayerStaminaState({
  nativeFixturePlayerProfile,
} = {}) {
  const profile = assertCssoccerNativeFixturePlayerProfile(
    nativeFixturePlayerProfile,
  );
  const players = projectCssoccerNativePlayerAttributes(profile, { matchHalf: 0 })
    .map((entry) => createPlayer(entry));
  return assemble({ tick: 0, gameMinute: 0, matchHalf: 0, players });
}

/**
 * Advance one engine tick. The caller supplies the already-resolved integer
 * game minute. Opening callers may omit `matchHalf`; full-match callers supply
 * the lifecycle half so the one end swap and terminal transition are explicit.
 */
export function stepCssoccerPlayerStaminaState(state, options = {}) {
  const current = assertCssoccerPlayerStaminaState(state);
  requireStepOptions(options);
  const { tick, gameMinute } = options;
  const matchHalf = options.matchHalf ?? current.matchHalf;
  requireUint32(tick, "player stamina tick");
  requireGameMinute(gameMinute);
  requireMatchHalf(matchHalf);
  if (current.matchHalf === 11) {
    throw new CssoccerUnsupportedPlayerStaminaError(
      "terminal",
      "Player stamina cannot advance after terminal match_half 11.",
      { tick: current.tick, gameMinute: current.gameMinute },
    );
  }
  if (tick !== current.tick + 1) {
    throw new Error(`Player stamina ticks must be contiguous; expected ${current.tick + 1}.`);
  }
  if (gameMinute < current.gameMinute || gameMinute > current.gameMinute + 1) {
    throw new CssoccerUnsupportedPlayerStaminaError(
      "minute-progression",
      "Player stamina accepts only an unchanged or one-minute contiguous clock transition.",
      { previousMinute: current.gameMinute, gameMinute },
    );
  }
  requireLifecycleTransition(current, { gameMinute, matchHalf });
  const minuteChanged = gameMinute === current.gameMinute + 1;
  const halftimeRemap = current.matchHalf === 0 && matchHalf === 1;
  const players = current.players.map((player) => {
    const timed = minuteChanged
      ? updatePlayerMinute(player, gameMinute)
      : clone(player);
    return halftimeRemap ? remapPlayerNativeSlot(timed) : timed;
  });
  return assemble({ tick, gameMinute, matchHalf, players });
}

/** Return the strict typed rate seam consumed by player motion reducers. */
export function projectCssoccerPlayerStaminaTeamRates(state) {
  const current = assertCssoccerPlayerStaminaState(state);
  return deepFreeze(current.players.map((player) => ({
    id: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    valueType: "u8",
    value: player.rate.value,
    numericBits: player.rate.numericBits,
  })));
}

export function projectCssoccerPlayerStaminaNativeFields(state) {
  const current = assertCssoccerPlayerStaminaState(state);
  return deepFreeze(current.players.flatMap((player) => [
    typedU8(`players.${player.id}.rate`, player.rate.value),
    typedU8(`players.${player.id}.stamina`, player.stamina),
    typedU8(`players.${player.id}.player_minutes`, player.playerMinutes),
  ]));
}

export function assertCssoccerPlayerStaminaState(state) {
  requirePlainObject(state, "player stamina state");
  requireExactKeys(state, [
    "fixtureId",
    "gameMinute",
    "matchHalf",
    "nativeFixturePlayerProfileHash",
    "players",
    "schema",
    "tick",
  ], "player stamina state");
  if (
    state.schema !== CSSOCCER_PLAYER_STAMINA_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || state.nativeFixturePlayerProfileHash
      !== CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH
  ) {
    throw new Error(`Player stamina state must use ${CSSOCCER_PLAYER_STAMINA_STATE_SCHEMA}.`);
  }
  requireUint32(state.tick, "player stamina state tick");
  requireGameMinute(state.gameMinute);
  requireMatchHalf(state.matchHalf);
  requireLifecycleState(state.gameMinute, state.matchHalf);
  if (!Array.isArray(state.players) || state.players.length !== PLAYER_COUNT) {
    throw new Error("Player stamina state requires exactly 22 players.");
  }
  state.players.forEach((player, index) => requirePlayer(
    player,
    index,
    state.gameMinute,
    state.matchHalf,
  ));
  return state;
}

function createPlayer(entry) {
  const initialRate = requireU8(entry.attributes.pace, `${entry.id} initial tm_rate`);
  const stamina = requireU8(entry.attributes.stamina, `${entry.id} tm_stam`);
  return {
    id: entry.id,
    nativePlayerNumber: entry.nativePlayerNumber,
    initialRate,
    stamina,
    playerMinutes: 0,
    rate: typedU8(`players.${entry.id}.rate`, initialRate),
  };
}

function updatePlayerMinute(player, gameMinute) {
  const playerMinutes = player.playerMinutes + 1;
  if (playerMinutes !== gameMinute) {
    throw new CssoccerUnsupportedPlayerStaminaError(
      "player-time",
      `${player.id} player minutes diverged from the fixed all-active fixture clock.`,
      { playerMinutes, gameMinute },
    );
  }
  const fatigue = F32((
    Math.sin(((Math.PI * playerMinutes) / 120) - (Math.PI / 2)) + 1
  ) / 2);
  const loss = F32(
    fatigue * ((129 - player.stamina) / 140) * player.initialRate,
  );
  const rateValue = Math.trunc(player.initialRate - loss);
  requireU8(rateValue, `${player.id} updated tm_rate`);
  return {
    ...clone(player),
    playerMinutes,
    rate: typedU8(player.rate.fieldId, rateValue),
  };
}

function remapPlayerNativeSlot(player) {
  return {
    ...clone(player),
    nativePlayerNumber: player.nativePlayerNumber <= 11
      ? player.nativePlayerNumber + 11
      : player.nativePlayerNumber - 11,
  };
}

function assemble({ tick, gameMinute, matchHalf, players }) {
  return assertCssoccerPlayerStaminaState(deepFreeze({
    schema: CSSOCCER_PLAYER_STAMINA_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    nativeFixturePlayerProfileHash: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
    tick,
    gameMinute,
    matchHalf,
    players,
  }));
}

function requirePlayer(player, index, gameMinute, matchHalf) {
  requirePlainObject(player, `player stamina state players[${index}]`);
  requireExactKeys(player, [
    "id",
    "initialRate",
    "nativePlayerNumber",
    "playerMinutes",
    "rate",
    "stamina",
  ], `player stamina state players[${index}]`);
  const country = index < 11 ? "spain" : "argentina";
  const shirt = (index % 11) + 1;
  const expectedId = `${country}-player-${String(shirt).padStart(2, "0")}`;
  const kickoffNativePlayerNumber = index + 1;
  const expectedNativePlayerNumber = matchHalf === 0
    ? kickoffNativePlayerNumber
    : kickoffNativePlayerNumber <= 11
      ? kickoffNativePlayerNumber + 11
      : kickoffNativePlayerNumber - 11;
  if (
    player.id !== expectedId
    || player.nativePlayerNumber !== expectedNativePlayerNumber
  ) {
    throw new Error(`Player stamina native order changed at ${index + 1}.`);
  }
  requireU8(player.initialRate, `${player.id} initialRate`);
  requireU8(player.stamina, `${player.id} stamina`);
  const fixedAttributes = CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE
    .players[index].attributes;
  if (
    player.initialRate !== fixedAttributes.pace
    || player.stamina !== fixedAttributes.stamina
  ) {
    throw new CssoccerUnsupportedPlayerStaminaError(
      "fixed-profile-drift",
      `${player.id} at native slot ${player.nativePlayerNumber} diverged from the fixed starter profile.`,
      {
        id: player.id,
        nativePlayerNumber: player.nativePlayerNumber,
        initialRate: player.initialRate,
        stamina: player.stamina,
      },
    );
  }
  requireU8(player.playerMinutes, `${player.id} playerMinutes`);
  if (player.playerMinutes !== gameMinute) {
    throw new Error(`${player.id} player minutes diverged from the fixture minute.`);
  }
  requirePlainObject(player.rate, `${player.id} rate`);
  requireExactKeys(
    player.rate,
    ["fieldId", "numericBits", "value", "valueType"],
    `${player.id} rate`,
  );
  const expected = typedU8(`players.${player.id}.rate`, player.rate.value);
  if (JSON.stringify(player.rate) !== JSON.stringify(expected)) {
    throw new Error(`${player.id} rate changed its exact u8 type or bits.`);
  }
  const recomputed = updateRateForMinute(player.initialRate, player.stamina, gameMinute);
  if (player.rate.value !== recomputed) {
    throw new Error(`${player.id} rate diverged from the source stamina formula.`);
  }
}

function updateRateForMinute(initialRate, stamina, playerMinutes) {
  if (playerMinutes === 0) return initialRate;
  const fatigue = F32((
    Math.sin(((Math.PI * playerMinutes) / 120) - (Math.PI / 2)) + 1
  ) / 2);
  const loss = F32(fatigue * ((129 - stamina) / 140) * initialRate);
  return Math.trunc(initialRate - loss);
}

function typedU8(fieldId, value) {
  requireU8(value, fieldId);
  return deepFreeze({
    fieldId,
    valueType: "u8",
    value,
    numericBits: value.toString(16).padStart(2, "0"),
  });
}

function requireGameMinute(value) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_NORMAL_TIME_MINUTE) {
    throw new TypeError("Player stamina gameMinute must be an exact normal-time minute 0..90.");
  }
}

function requireMatchHalf(value) {
  if (value !== 0 && value !== 1 && value !== 11) {
    throw new TypeError("Player stamina matchHalf must be exact u8 lifecycle value 0, 1, or 11.");
  }
}

function requireLifecycleState(gameMinute, matchHalf) {
  if (matchHalf === 0 && gameMinute > 45) {
    throw new CssoccerUnsupportedPlayerStaminaError(
      "halftime-remap",
      "First-half stamina cannot advance beyond minute 45 without the one end swap.",
      { gameMinute, matchHalf },
    );
  }
  if (matchHalf === 1 && (gameMinute < 45 || gameMinute >= 90)) {
    throw new CssoccerUnsupportedPlayerStaminaError(
      "match-half",
      "Second-half stamina must remain inside normal-time minutes 45 through 89.",
      { gameMinute, matchHalf },
    );
  }
  if (matchHalf === 11 && gameMinute !== 90) {
    throw new CssoccerUnsupportedPlayerStaminaError(
      "terminal",
      "Terminal match_half 11 requires exact normal-time minute 90.",
      { gameMinute, matchHalf },
    );
  }
}

function requireLifecycleTransition(current, next) {
  if (current.matchHalf === 0 && next.matchHalf === 0) {
    requireLifecycleState(next.gameMinute, next.matchHalf);
    return;
  }
  if (current.matchHalf === 0 && next.matchHalf === 1) {
    if (current.gameMinute !== 45 || next.gameMinute !== 45) {
      throw new CssoccerUnsupportedPlayerStaminaError(
        "halftime-remap",
        "The one native-slot end swap requires the frozen minute-45 halftime boundary.",
        {
          previousMinute: current.gameMinute,
          gameMinute: next.gameMinute,
          previousMatchHalf: current.matchHalf,
          matchHalf: next.matchHalf,
        },
      );
    }
    return;
  }
  if (current.matchHalf === 1 && next.matchHalf === 1) {
    requireLifecycleState(next.gameMinute, next.matchHalf);
    return;
  }
  if (current.matchHalf === 1 && next.matchHalf === 11) {
    if (current.gameMinute !== 89 || next.gameMinute !== 90) {
      throw new CssoccerUnsupportedPlayerStaminaError(
        "terminal",
        "Terminal match_half 11 must coincide with the contiguous minute-90 edge.",
        {
          previousMinute: current.gameMinute,
          gameMinute: next.gameMinute,
          previousMatchHalf: current.matchHalf,
          matchHalf: next.matchHalf,
        },
      );
    }
    return;
  }
  throw new CssoccerUnsupportedPlayerStaminaError(
    "match-half-progression",
    "Player stamina accepts only 0 -> 1 -> 11 normal-time match-half progression.",
    { previousMatchHalf: current.matchHalf, matchHalf: next.matchHalf },
  );
}

function requireStepOptions(value) {
  requirePlainObject(value, "player stamina step options");
  const actual = Object.keys(value).sort();
  const withoutHalf = ["gameMinute", "tick"];
  const withHalf = ["gameMinute", "matchHalf", "tick"];
  if (
    JSON.stringify(actual) !== JSON.stringify(withoutHalf)
    && JSON.stringify(actual) !== JSON.stringify(withHalf)
  ) {
    throw new Error(
      "Player stamina step options require exactly tick, gameMinute, and optional matchHalf.",
    );
  }
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be an exact uint32.`);
  }
}

function requireU8(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new TypeError(`${label} must be an exact u8.`);
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
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

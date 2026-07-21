import { CSSOCCER_BALL_CONSTANTS } from "./ballState.mjs";
import { sourceDistance2d } from "./motionState.mjs";
import { CSSOCCER_NATIVE_GAMEPLAY_PROFILE } from "./nativeGameplayProfile.mjs";

export const CSSOCCER_PLAYER_HIGHLIGHT_INPUT_FRAME_SCHEMA =
  "cssoccer-player-highlight-input-frame@1";

const FIXTURE_COUNTRIES = Object.freeze(["spain", "argentina"]);
const FIXTURE_PLAYER_IDS = Object.freeze(FIXTURE_COUNTRIES.flatMap((country) => (
  Array.from({ length: 11 }, (_, index) => (
    `${country}-player-${String(index + 1).padStart(2, "0")}`
  ))
)));
const FIXTURE_PLAYER_ID_SET = new Set(FIXTURE_PLAYER_IDS);
const FRAME_INPUT_KEYS = Object.freeze([
  "ballPossession",
  "inCrossArea",
  "matchHalf",
  "players",
  "selectedCountry",
  "terminal",
  "tick",
]);
const FRAME_KEYS = Object.freeze([
  "schema",
  ...FRAME_INPUT_KEYS,
]);
const PLAYER_KEYS = Object.freeze([
  "id",
  "nativePlayerNumber",
  "controlUser",
  "shootingRange",
  "special",
  "intelligenceMove",
]);

export const CSSOCCER_PLAYER_HIGHLIGHT_INPUT_SOURCE = deepFreeze({
  stage: "after-new-users-before-player-render-publication",
  playerOrder: "ascending-current-native-player-number",
  playerCount: 22,
  localUserCount: 1,
  fields: [
    { id: "nativePlayerNumber", sourceName: "tm_player", valueType: "i16" },
    { id: "controlUser", sourceName: "control", valueType: "u8" },
    { id: "shootingRange", sourceName: "tm_srng", valueType: "u8" },
    { id: "special", sourceName: "special", valueType: "i16" },
    { id: "intelligenceMove", sourceName: "int_move", valueType: "i16" },
  ],
  globals: [
    { id: "ballPossession", sourceName: "ball_poss", valueType: "i32" },
    { id: "inCrossArea", sourceName: "in_cross_area", valueType: "i32" },
  ],
  producers: {
    controlUser: "new_users",
    shootingRange: "player_distances",
    special: "reset_ideas/strike_and_control/intercept",
    intelligenceMove: "intelligence/intercept",
    inCrossArea: "set_pos_flags/cross_pos",
  },
});

/**
 * Publish the closed browser-owned input seam used by select_all_hlites.
 * This module validates source-width values and ordering; it never derives
 * gameplay state or reads a retained/native result.
 */
export function createCssoccerPlayerHighlightInputFrame(input, options = {}) {
  requirePlainObject(input, "player highlight input frame input");
  requireExactKeys(input, FRAME_INPUT_KEYS, "player highlight input frame input");
  requirePlainObject(options, "player highlight input frame options");
  requireAllowedKeys(options, ["previous"], "player highlight input frame options");

  const tick = requireUint32(input.tick, "player highlight input tick");
  const selectedCountry = requireCountry(input.selectedCountry);
  const matchHalf = requireMatchHalf(input.matchHalf);
  const terminal = requireBoolean(input.terminal, "player highlight input terminal");
  if (terminal !== (matchHalf === 11)) {
    throw new Error("Player highlight terminal state must agree with match_half = 11.");
  }
  const ballPossession = requireIntegerWidth(
    input.ballPossession,
    "i32",
    "player highlight ball possession",
  );
  if (ballPossession < 0 || ballPossession > 22) {
    throw new RangeError("Player highlight ball possession must be in 0..22.");
  }
  const inCrossArea = requireSourceBoolean(
    input.inCrossArea,
    "player highlight cross-area flag",
  );
  const players = requirePlayers(input.players, selectedCountry);

  const frame = deepFreeze({
    schema: CSSOCCER_PLAYER_HIGHLIGHT_INPUT_FRAME_SCHEMA,
    tick,
    selectedCountry,
    matchHalf,
    terminal,
    ballPossession,
    inCrossArea,
    players,
  });
  const previous = options.previous ?? null;
  if (previous !== null) requireContiguousFrame(previous, frame);
  return frame;
}

/**
 * Project the browser-owned match state at the select_all_hlites stage. Every
 * branch input comes from the current free-play state or a source formula;
 * there is no retained-frame or replay input seam.
 */
export function createCssoccerFreePlayPlayerHighlightInputFrame({ match, tick } = {}) {
  requirePlainObject(match, "free-play player highlight match state");
  const currentTick = requireUint32(tick, "free-play player highlight tick");
  if (!Array.isArray(match.players) || match.players.length !== 22) {
    throw new Error("Free-play player highlights require all 22 current players.");
  }
  requirePlainObject(match.config, "free-play player highlight config");
  requirePlainObject(match.control, "free-play player highlight control");
  requirePlainObject(match.clock, "free-play player highlight clock");
  requirePlainObject(match.possession, "free-play player highlight possession");
  requirePlainObject(match.ball?.ball?.position, "free-play player highlight ball position");

  const ballPosition = match.ball.ball.position;
  const owner = match.possession.owner;
  const players = [...match.players]
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber)
    .map((player) => {
    requirePlainObject(player, "free-play player highlight player");
    requirePlainObject(player.position, `${player.id} highlight position`);
    requirePlainObject(player.gameplay, `${player.id} highlight gameplay`);
    requirePlainObject(player.intelligence, `${player.id} highlight intelligence`);
    return {
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      controlUser: player.id === match.control.activePlayerId ? 1 : 0,
      shootingRange: sourceFreePlayShootingRange(player) ? 1 : 0,
      special: player.intelligence.special,
      intelligenceMove: player.intelligence.move,
    };
    });
  const ballOwner = owner === 0
    ? null
    : players.find(({ nativePlayerNumber }) => nativePlayerNumber === owner);
  if (owner !== 0 && ballOwner === undefined) {
    throw new Error("Free-play player highlights lost the current ball owner.");
  }
  return createCssoccerPlayerHighlightInputFrame({
    tick: currentTick,
    selectedCountry: match.config.controlCountry,
    matchHalf: match.clock.matchHalf,
    terminal: match.clock.terminal,
    ballPossession: owner,
    inCrossArea: ballOwner === null
      ? 0
      : Number(sourceFreePlayCrossArea(ballOwner, ballPosition)),
    players,
  });
}

/** BALLINT.CPP player_distances publishes tm_srng before select_all_hlites. */
function sourceFreePlayShootingRange(player) {
  const goalOffset = {
    x: Math.fround((player.nativePlayerNumber < 12
      ? CSSOCCER_BALL_CONSTANTS.pitchLength
      : 0) - player.position.x),
    y: Math.fround((CSSOCCER_BALL_CONSTANTS.pitchWidth / 2) - player.position.y),
  };
  const minimum = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 12;
  return sourceDistance2d(goalOffset) < minimum + player.gameplay.power * 3;
}

/** INTELL.CPP cross_pos diagonal from either goal post to the near sideline. */
function sourceFreePlayCrossArea(player, ball) {
  const teamB = player.nativePlayerNumber > 11;
  if (ball.y > CSSOCCER_BALL_CONSTANTS.bottomPostY) {
    const outsidePost = ball.y - CSSOCCER_BALL_CONSTANTS.bottomPostY;
    return teamB
      ? ball.x < outsidePost
      : CSSOCCER_BALL_CONSTANTS.pitchLength - ball.x < outsidePost;
  }
  if (ball.y < CSSOCCER_BALL_CONSTANTS.topPostY) {
    const outsidePost = CSSOCCER_BALL_CONSTANTS.topPostY - ball.y;
    return teamB
      ? ball.x < outsidePost
      : CSSOCCER_BALL_CONSTANTS.pitchLength - ball.x < outsidePost;
  }
  return false;
}

export function assertCssoccerPlayerHighlightInputFrame(value) {
  requirePlainObject(value, "player highlight input frame");
  requireExactKeys(value, FRAME_KEYS, "player highlight input frame");
  if (value.schema !== CSSOCCER_PLAYER_HIGHLIGHT_INPUT_FRAME_SCHEMA) {
    throw new Error(
      `Player highlight input frame must use ${CSSOCCER_PLAYER_HIGHLIGHT_INPUT_FRAME_SCHEMA}.`,
    );
  }
  createCssoccerPlayerHighlightInputFrame({
    tick: value.tick,
    selectedCountry: value.selectedCountry,
    matchHalf: value.matchHalf,
    terminal: value.terminal,
    ballPossession: value.ballPossession,
    inCrossArea: value.inCrossArea,
    players: value.players,
  });
  return value;
}

function requirePlayers(value, selectedCountry) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Player highlight input frame requires all 22 players.");
  }
  const players = value.map((player, index) => {
    requirePlainObject(player, `player highlight input player ${index}`);
    requireExactKeys(player, PLAYER_KEYS, `player highlight input player ${index}`);
    if (typeof player.id !== "string" || !FIXTURE_PLAYER_ID_SET.has(player.id)) {
      throw new Error(`Player highlight input player ${index} has an unknown fixed-fixture id.`);
    }
    const nativePlayerNumber = requireIntegerWidth(
      player.nativePlayerNumber,
      "i16",
      `player highlight input ${player.id} native player`,
    );
    if (nativePlayerNumber !== index + 1) {
      throw new Error("Player highlight inputs must stay in ascending current native order.");
    }
    return {
      id: player.id,
      nativePlayerNumber,
      controlUser: requireSourceBoolean(
        player.controlUser,
        `player highlight input ${player.id} control user`,
      ),
      shootingRange: requireSourceBoolean(
        player.shootingRange,
        `player highlight input ${player.id} shooting range`,
      ),
      special: requireIntegerWidth(
        player.special,
        "i16",
        `player highlight input ${player.id} special`,
      ),
      intelligenceMove: requireIntegerWidth(
        player.intelligenceMove,
        "i16",
        `player highlight input ${player.id} intelligence move`,
      ),
    };
  });
  const ids = players.map(({ id }) => id);
  if (new Set(ids).size !== 22 || FIXTURE_PLAYER_IDS.some((id) => !ids.includes(id))) {
    throw new Error("Player highlight inputs must retain all 22 stable fixture identities.");
  }
  const controlled = players.filter(({ controlUser }) => controlUser === 1);
  if (controlled.length > 1) {
    throw new Error("The fixed product supports at most one local highlight control owner.");
  }
  if (
    controlled.length === 1
    && !controlled[0].id.startsWith(`${selectedCountry}-`)
  ) {
    throw new Error("Player highlight control owner must belong to the selected country.");
  }
  return players;
}

function requireContiguousFrame(previousValue, current) {
  const previous = assertCssoccerPlayerHighlightInputFrame(previousValue);
  if (current.tick !== previous.tick + 1) {
    throw new Error(
      `Player highlight input frames must be contiguous; expected ${previous.tick + 1}.`,
    );
  }
  if (current.selectedCountry !== previous.selectedCountry) {
    throw new Error("Player highlight input frames cannot change selected country.");
  }
  const allowedHalfTransition = (
    current.matchHalf === previous.matchHalf
    || (previous.matchHalf === 0 && current.matchHalf === 1)
    || (previous.matchHalf === 1 && current.matchHalf === 11)
  );
  if (!allowedHalfTransition) {
    throw new Error("Player highlight input frames contain an invalid match-half transition.");
  }
  const previousNativeById = new Map(previous.players.map((player) => [
    player.id,
    player.nativePlayerNumber,
  ]));
  const swappedEnds = previous.matchHalf === 0 && current.matchHalf === 1;
  for (const player of current.players) {
    const previousNative = previousNativeById.get(player.id);
    const expectedNative = swappedEnds
      ? previousNative <= 11 ? previousNative + 11 : previousNative - 11
      : previousNative;
    if (player.nativePlayerNumber !== expectedNative) {
      throw new Error(
        swappedEnds
          ? "Player highlight halftime frames must swap the two exact 11-player slot blocks."
          : "Player highlight stable identities changed native slot outside halftime.",
      );
    }
  }
}

function requireCountry(value) {
  if (!FIXTURE_COUNTRIES.includes(value)) {
    throw new Error("Player highlight selected country must be spain or argentina.");
  }
  return value;
}

function requireMatchHalf(value) {
  requireIntegerWidth(value, "u8", "player highlight match half");
  if (value !== 0 && value !== 1 && value !== 11) {
    throw new RangeError("Player highlight match half must be 0, 1, or 11.");
  }
  return value;
}

function requireSourceBoolean(value, label) {
  requireIntegerWidth(value, "u8", label);
  if (value !== 0 && value !== 1) throw new RangeError(`${label} must be 0 or 1.`);
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
  return value;
}

function requireUint32(value, label) {
  return requireIntegerWidth(value, "u32", label);
}

function requireIntegerWidth(value, type, label) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be an integer.`);
  const width = Number(type.slice(1));
  const signed = type.startsWith("i");
  const minimum = signed ? -(2 ** (width - 1)) : 0;
  const maximum = signed ? (2 ** (width - 1)) - 1 : (2 ** width) - 1;
  if (value < minimum || value > maximum) {
    throw new RangeError(`${label} is outside ${type}.`);
  }
  return value;
}

function requireExactKeys(value, expected, label) {
  const keys = Object.keys(value);
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
}

function requireAllowedKeys(value, allowed, label) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} does not accept ${unexpected.join(", ")}.`);
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
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

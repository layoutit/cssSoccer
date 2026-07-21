import {
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT,
  CSSOCCER_PLAYER_HIGHLIGHT_TYPES,
  cssoccerPlayerHighlightType,
} from "./playerHighlightContract.mjs";
import {
  assertCssoccerPlayerHighlightInputFrame,
} from "./playerHighlightInputs.mjs";

export const CSSOCCER_PLAYER_HIGHLIGHT_STATE_SCHEMA =
  "cssoccer-player-highlight-state@1";

export const CSSOCCER_PLAYER_HIGHLIGHT_STATE_SOURCE = deepFreeze({
  reducer: "select_all_hlites/select_hlite",
  stage: "after-new-users-before-player-render-publication",
  interceptIntelligenceMove: 1,
  localUsers: [
    {
      userNumber: 1,
      hcol: 0,
      eligibility: "selected-country-auto-user",
    },
  ],
  branchOrder: [
    "controlled-ball-owner-cross",
    "controlled-ball-owner-shooting-range",
    "controlled-ball-owner-ball",
    "controlled-positive-special-intercept",
    "controlled-negative-special-intercept",
    "controlled-normal",
    "off",
  ],
});

const STATE_KEYS = Object.freeze([
  "schema",
  "tick",
  "selectedCountry",
  "matchHalf",
  "terminal",
  "players",
  "marker",
]);
const PLAYER_KEYS = Object.freeze([
  "id",
  "nativePlayerNumber",
  "hcol",
  "htype",
]);
const MARKER_KEYS = Object.freeze([
  "id",
  "userNumber",
  "playerId",
  "nativePlayerNumber",
  "hcol",
  "typeValue",
  "typeId",
  "semantic",
  "familyId",
  "facingMode",
  "blinkMode",
  "ordinaryShadow",
]);

export function createCssoccerPlayerHighlightState(frameValue) {
  const frame = assertCssoccerPlayerHighlightInputFrame(frameValue);
  if (frame.tick !== 0 || frame.matchHalf !== 0 || frame.terminal) {
    throw new Error("Player highlight state must start from a non-terminal tick-zero frame.");
  }
  return reduceFrame(frame);
}

export function stepCssoccerPlayerHighlightState(stateValue, frameValue) {
  const state = assertCssoccerPlayerHighlightState(stateValue);
  const frame = assertCssoccerPlayerHighlightInputFrame(frameValue);
  if (state.terminal) {
    throw new Error("Terminal player highlight state cannot advance without a rematch reset.");
  }
  if (frame.tick !== state.tick + 1) {
    throw new Error(
      `Player highlight state requires contiguous tick ${state.tick + 1}.`,
    );
  }
  if (frame.selectedCountry !== state.selectedCountry) {
    throw new Error("Player highlight state cannot change selected country.");
  }
  requireStateSlotTransition(state, frame);
  return reduceFrame(frame);
}

export function projectCssoccerPlayerHighlightState(frameValue) {
  return reduceFrame(assertCssoccerPlayerHighlightInputFrame(frameValue));
}

export function assertCssoccerPlayerHighlightState(value) {
  requirePlainObject(value, "player highlight state");
  requireExactKeys(value, STATE_KEYS, "player highlight state");
  if (value.schema !== CSSOCCER_PLAYER_HIGHLIGHT_STATE_SCHEMA) {
    throw new Error(`Player highlight state must use ${CSSOCCER_PLAYER_HIGHLIGHT_STATE_SCHEMA}.`);
  }
  if (!Number.isSafeInteger(value.tick) || value.tick < 0) {
    throw new TypeError("Player highlight state tick must be a non-negative integer.");
  }
  if (value.selectedCountry !== "spain" && value.selectedCountry !== "argentina") {
    throw new Error("Player highlight state selected country is outside the fixed fixture.");
  }
  if (value.matchHalf !== 0 && value.matchHalf !== 1 && value.matchHalf !== 11) {
    throw new Error("Player highlight state match half must be 0, 1, or 11.");
  }
  if (typeof value.terminal !== "boolean" || value.terminal !== (value.matchHalf === 11)) {
    throw new Error("Player highlight state terminal flag diverged from match half.");
  }
  if (!Array.isArray(value.players) || value.players.length !== 22) {
    throw new Error("Player highlight state requires all 22 players.");
  }
  let activePlayer = null;
  for (const [index, player] of value.players.entries()) {
    requirePlainObject(player, `player highlight state player ${index}`);
    requireExactKeys(player, PLAYER_KEYS, `player highlight state player ${index}`);
    if (typeof player.id !== "string") {
      throw new TypeError("Player highlight state player id must be a string.");
    }
    if (player.nativePlayerNumber !== index + 1) {
      throw new Error("Player highlight state players changed current native order.");
    }
    if (!Number.isInteger(player.hcol) || player.hcol < 0 || player.hcol > 5) {
      throw new RangeError("Player highlight hcol must be in 0..5.");
    }
    cssoccerPlayerHighlightType(player.htype);
    if (player.htype !== CSSOCCER_PLAYER_HIGHLIGHT_TYPES.OFF) {
      if (activePlayer !== null) {
        throw new Error("The fixed product emitted more than one active highlight.");
      }
      activePlayer = player;
    }
  }
  if (new Set(value.players.map(({ id }) => id)).size !== 22) {
    throw new Error("Player highlight state duplicated a stable player identity.");
  }
  if (value.marker === null) {
    if (activePlayer !== null) {
      throw new Error("Player highlight state lost its active marker projection.");
    }
  } else {
    requireMarker(value.marker, activePlayer, value.selectedCountry);
  }
  if (value.terminal && value.marker !== null) {
    throw new Error("Terminal player highlight state must be off.");
  }
  return value;
}

function reduceFrame(frame) {
  const controlled = frame.terminal
    ? null
    : frame.players.find(({ controlUser }) => controlUser === 1) ?? null;
  const typeValue = controlled === null
    ? CSSOCCER_PLAYER_HIGHLIGHT_TYPES.OFF
    : selectHighlightType(controlled, frame);
  const hcol = CSSOCCER_PLAYER_HIGHLIGHT_STATE_SOURCE.localUsers[0].hcol;
  const players = frame.players.map((player) => ({
    id: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    hcol,
    htype: player.id === controlled?.id
      ? typeValue
      : CSSOCCER_PLAYER_HIGHLIGHT_TYPES.OFF,
  }));
  const type = controlled === null ? null : cssoccerPlayerHighlightType(typeValue);
  const marker = controlled === null ? null : {
    id: "player-highlight-local-user-1",
    userNumber: 1,
    playerId: controlled.id,
    nativePlayerNumber: controlled.nativePlayerNumber,
    hcol,
    typeValue,
    typeId: type.id,
    semantic: type.semantic,
    familyId: type.familyId,
    facingMode: type.facingMode,
    blinkMode: type.blinkMode,
    ordinaryShadow: type.ordinaryShadow,
  };
  const next = deepFreeze({
    schema: CSSOCCER_PLAYER_HIGHLIGHT_STATE_SCHEMA,
    tick: frame.tick,
    selectedCountry: frame.selectedCountry,
    matchHalf: frame.matchHalf,
    terminal: frame.terminal,
    players,
    marker,
  });
  assertCssoccerPlayerHighlightState(next);
  return next;
}

function selectHighlightType(player, frame) {
  if (frame.ballPossession === player.nativePlayerNumber) {
    if (frame.inCrossArea === 1) return CSSOCCER_PLAYER_HIGHLIGHT_TYPES.CROSS;
    if (player.shootingRange === 1) return CSSOCCER_PLAYER_HIGHLIGHT_TYPES.SHOOT;
    return CSSOCCER_PLAYER_HIGHLIGHT_TYPES.BALL;
  }
  if (
    player.special > 0
    && player.intelligenceMove
      === CSSOCCER_PLAYER_HIGHLIGHT_STATE_SOURCE.interceptIntelligenceMove
  ) {
    return CSSOCCER_PLAYER_HIGHLIGHT_TYPES.SPECIAL;
  }
  if (
    player.special < 0
    && player.intelligenceMove
      === CSSOCCER_PLAYER_HIGHLIGHT_STATE_SOURCE.interceptIntelligenceMove
  ) {
    return CSSOCCER_PLAYER_HIGHLIGHT_TYPES.STAR;
  }
  return CSSOCCER_PLAYER_HIGHLIGHT_TYPES.NORM;
}

function requireStateSlotTransition(state, frame) {
  const allowedHalfTransition = (
    frame.matchHalf === state.matchHalf
    || (state.matchHalf === 0 && frame.matchHalf === 1)
    || (state.matchHalf === 1 && frame.matchHalf === 11)
  );
  if (!allowedHalfTransition) {
    throw new Error("Player highlight state contains an invalid match-half transition.");
  }
  const priorNativeById = new Map(state.players.map((player) => [
    player.id,
    player.nativePlayerNumber,
  ]));
  const swapsEnds = state.matchHalf === 0 && frame.matchHalf === 1;
  for (const player of frame.players) {
    const priorNative = priorNativeById.get(player.id);
    const expectedNative = swapsEnds
      ? priorNative <= 11 ? priorNative + 11 : priorNative - 11
      : priorNative;
    if (player.nativePlayerNumber !== expectedNative) {
      throw new Error(
        swapsEnds
          ? "Player highlight state requires the exact halftime slot-block swap."
          : "Player highlight stable identity changed slot outside halftime.",
      );
    }
  }
}

function requireMarker(marker, activePlayer, selectedCountry) {
  requirePlainObject(marker, "player highlight marker");
  requireExactKeys(marker, MARKER_KEYS, "player highlight marker");
  if (activePlayer === null) {
    throw new Error("Player highlight marker exists without an active player.");
  }
  const type = cssoccerPlayerHighlightType(activePlayer.htype);
  if (
    marker.id !== "player-highlight-local-user-1"
    || marker.userNumber !== 1
    || marker.playerId !== activePlayer.id
    || marker.nativePlayerNumber !== activePlayer.nativePlayerNumber
    || marker.hcol !== activePlayer.hcol
    || marker.typeValue !== activePlayer.htype
    || marker.typeId !== type.id
    || marker.semantic !== type.semantic
    || marker.familyId !== type.familyId
    || marker.facingMode !== type.facingMode
    || marker.blinkMode !== type.blinkMode
    || marker.ordinaryShadow !== type.ordinaryShadow
  ) {
    throw new Error("Player highlight marker diverged from its source type contract.");
  }
  if (!marker.playerId.startsWith(`${selectedCountry}-`)) {
    throw new Error("Player highlight marker belongs to the wrong selected country.");
  }
  if (
    !CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.markerFamilies.some(
      ({ id }) => id === marker.familyId,
    )
  ) {
    throw new Error("Player highlight marker uses an unknown prepared family id.");
  }
}

function requireExactKeys(value, expected, label) {
  const keys = Object.keys(value);
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
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

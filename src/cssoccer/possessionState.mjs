export const CSSOCCER_POSSESSION_STATE_SCHEMA = "cssoccer-possession-state@1";

export const CSSOCCER_POSSESSION_SOURCE = deepFreeze({
  file: "BALLINT.CPP",
  sha256: "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
  functions: {
    hold: "hold_ball lines 452-570",
    collect: "collect_ball lines 581-626",
    release: "holder_lose_ball lines 1282-1302",
  },
  nativeFields: {
    owner: { fieldId: "ball.possession", valueType: "i32" },
    lastTouch: { fieldId: "ball.last_touch", valueType: "i32" },
    inHands: { fieldId: "ball.in_hands", valueType: "u8" },
    playerPossession: { suffix: "possession", valueType: "i16" },
  },
});

const PLAYER_ID_PATTERN = /^(spain|argentina)-player-(0[1-9]|1[01])$/u;
const KEEPER_SLOTS = new Set([1, 12]);

export function createPossessionState(input = {}) {
  requirePlainObject(input, "possession state input");
  requireOnlyKeys(
    input,
    [
      "schema",
      "owner",
      "lastTouch",
      "previousTouch",
      "preKeeperTouch",
      "inHands",
      "cannotPickUp",
      "players",
    ],
    "possession state input",
  );
  if (input.schema !== undefined && input.schema !== CSSOCCER_POSSESSION_STATE_SCHEMA) {
    throw new Error(`Possession state must use ${CSSOCCER_POSSESSION_STATE_SCHEMA}.`);
  }

  const players = requirePlayers(input.players);
  const owner = input.owner ?? 0;
  const lastTouch = input.lastTouch ?? 0;
  const previousTouch = input.previousTouch ?? 0;
  const preKeeperTouch = input.preKeeperTouch ?? 0;
  const inHands = input.inHands ?? 0;
  const cannotPickUp = input.cannotPickUp ?? 0;
  for (const [value, label] of [
    [owner, "owner"],
    [lastTouch, "lastTouch"],
    [previousTouch, "previousTouch"],
    [preKeeperTouch, "preKeeperTouch"],
    [cannotPickUp, "cannotPickUp"],
  ]) {
    requireIntegerRange(value, 0, 22, `possession ${label}`);
  }
  requireIntegerRange(inHands, 0, 1, "possession inHands");

  const positive = players.filter(({ possession }) => possession > 0);
  if (
    (owner === 0 && positive.length !== 0)
    || (owner !== 0 && (
      positive.length !== 1
      || positive[0].nativePlayer !== owner
    ))
  ) {
    throw new Error("Possession must have exactly one positive player counter when owner is nonzero.");
  }
  if (inHands && owner === 0) {
    throw new Error("ball.in_hands requires one current owner.");
  }

  return deepFreeze({
    schema: CSSOCCER_POSSESSION_STATE_SCHEMA,
    owner,
    lastTouch,
    previousTouch,
    preKeeperTouch,
    inHands,
    cannotPickUp,
    players,
  });
}

export function releasePossession(input) {
  const state = createPossessionState(input);
  if (state.owner === 0) return state;
  const players = state.players.map((player) => (
    player.nativePlayer === state.owner
      ? { ...player, possession: 0 }
      : { ...player }
  ));
  return createPossessionState({
    ...state,
    owner: 0,
    inHands: 0,
    players,
  });
}

export function collectPossession(input, nativePlayer, { inHands = false } = {}) {
  let state = createPossessionState(input);
  requireIntegerRange(nativePlayer, 1, 22, "collecting native player");
  if (state.owner === nativePlayer) {
    throw new Error("collect_ball cannot recollect an already owned ball; use holdPossession.");
  }
  if (state.owner !== 0) state = releasePossession(state);

  const previousTouch = state.lastTouch;
  const preKeeperTouch = KEEPER_SLOTS.has(nativePlayer)
    ? state.preKeeperTouch
    : nativePlayer;
  const cannotPickUp = KEEPER_SLOTS.has(nativePlayer)
    ? state.cannotPickUp
    : nativePlayer;
  const players = state.players.map((player) => ({
    ...player,
    possession: player.nativePlayer === nativePlayer ? 1 : 0,
  }));
  return createPossessionState({
    ...state,
    owner: nativePlayer,
    lastTouch: nativePlayer,
    previousTouch,
    preKeeperTouch,
    inHands: inHands ? 1 : 0,
    cannotPickUp,
    players,
  });
}

export function holdPossession(input) {
  const state = createPossessionState(input);
  if (state.owner === 0) {
    throw new Error("hold_ball requires one current owner.");
  }
  const players = state.players.map((player) => ({
    ...player,
    possession: player.nativePlayer === state.owner
      ? requireNextI16(player.possession, "player possession counter")
      : player.possession,
  }));
  return createPossessionState({
    ...state,
    lastTouch: state.owner,
    preKeeperTouch: KEEPER_SLOTS.has(state.owner)
      ? state.preKeeperTouch
      : state.owner,
    players,
  });
}

export function touchWithoutPossession(input, nativePlayer) {
  const state = createPossessionState(input);
  requireIntegerRange(nativePlayer, 1, 22, "touching native player");
  return createPossessionState({
    ...state,
    lastTouch: nativePlayer,
    preKeeperTouch: KEEPER_SLOTS.has(nativePlayer)
      ? state.preKeeperTouch
      : nativePlayer,
  });
}

export function canNativeKeeperHandle({ nativePlayer, inPenaltyArea, cannotPickUp }) {
  requireIntegerRange(nativePlayer, 1, 22, "keeper native player");
  requireBoolean(inPenaltyArea, "keeper inPenaltyArea");
  requireIntegerRange(cannotPickUp, 0, 22, "keeper cannotPickUp");
  if (!KEEPER_SLOTS.has(nativePlayer) || !inPenaltyArea) return false;
  if (nativePlayer === 1) return cannotPickUp < 1 || cannotPickUp > 11;
  return cannotPickUp < 1 || cannotPickUp < 12;
}

export function projectPossessionNativeFields(input) {
  const state = createPossessionState(input);
  return deepFreeze([
    typedField("ball.in_hands", "u8", state.inHands),
    typedField("ball.last_touch", "i32", state.lastTouch),
    typedField("ball.possession", "i32", state.owner),
    ...state.players
      .slice()
      .sort((left, right) => left.stableId.localeCompare(right.stableId))
      .map((player) => typedField(
        `players.${player.stableId}.possession`,
        "i16",
        player.possession,
      )),
  ]);
}

function requirePlayers(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Possession state requires exactly 22 player identity counters.");
  }
  const players = value.map((player, index) => {
    requirePlainObject(player, `possession player ${index}`);
    requireOnlyKeys(
      player,
      ["nativePlayer", "stableId", "possession"],
      `possession player ${index}`,
    );
    requireIntegerRange(player.nativePlayer, 1, 22, `possession player ${index} nativePlayer`);
    if (!PLAYER_ID_PATTERN.test(player.stableId ?? "")) {
      throw new Error(`Possession player ${index} has an invalid fixed-fixture stableId.`);
    }
    requireIntegerRange(player.possession, 0, 0x7fff, `possession player ${index} counter`);
    return {
      nativePlayer: player.nativePlayer,
      stableId: player.stableId,
      possession: player.possession,
    };
  });
  requireUnique(players.map(({ nativePlayer }) => nativePlayer), "native player slots");
  requireUnique(players.map(({ stableId }) => stableId), "stable player ids");
  const expectedSlots = Array.from({ length: 22 }, (_, index) => index + 1);
  if (players.map(({ nativePlayer }) => nativePlayer).sort((a, b) => a - b).some(
    (slot, index) => slot !== expectedSlots[index],
  )) {
    throw new Error("Possession native player slots must cover 1..22 exactly.");
  }
  return players;
}

function typedField(fieldId, valueType, value) {
  return {
    fieldId,
    valueType,
    value,
    numericBits: numericBits(valueType, value),
  };
}

function numericBits(valueType, value) {
  const sizes = { u8: 1, i16: 2, i32: 4 };
  const size = sizes[valueType];
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  if (valueType === "u8") view.setUint8(0, value);
  if (valueType === "i16") view.setInt16(0, value, false);
  if (valueType === "i32") view.setInt32(0, value, false);
  return [...bytes].map((entry) => entry.toString(16).padStart(2, "0")).join("");
}

function requireNextI16(value, label) {
  if (value >= 0x7fff) throw new RangeError(`${label} exceeded the exact i16 contract.`);
  return value + 1;
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
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

function requireOnlyKeys(value, keys, label) {
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) throw new Error(`${label} has unsupported fields: ${extras.join(", ")}.`);
}

function requireUnique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique.`);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

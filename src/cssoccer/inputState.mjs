import {
  CSSOCCER_FREE_PLAY_COMMAND_SCHEMA,
} from "./freePlayContract.mjs";

export const CSSOCCER_INPUT_STATE_SCHEMA = "cssoccer-input-state@1";
export const CSSOCCER_INPUT_LATCH_SCHEMA = "cssoccer-input-selection-latch@1";

export const CSSOCCER_INPUT_BUTTONS = Object.freeze({
  FIRE_1: 1,
  FIRE_2: 2,
  SPECIAL_LEFT: 4,
  SPECIAL_RIGHT: 8,
  SPECIAL_UP: 16,
  SPECIAL_DOWN: 32,
});

const COMMAND_KEYS = Object.freeze(["buttons", "moveX", "moveY", "tick"]);
const ALLOWED_BUTTON_MASK = Object.values(CSSOCCER_INPUT_BUTTONS)
  .reduce((mask, value) => mask | value, 0);

export const CSSOCCER_INPUT_SOURCE = deepFreeze({
  commandSchema: CSSOCCER_FREE_PLAY_COMMAND_SCHEMA,
  commandTypes: {
    tick: "u32",
    moveX: "i8",
    moveY: "i8",
    buttons: "u32",
  },
  source: {
    file: "USER.CPP",
    sha256: "d4e9a3bc0192780eadb7a32d766a6f40a63115e5fa3e3a39cf8a6e7849c6e1bc",
    producers: ["convert_inputs", "user_conts"],
  },
  buttonBits: {
    fire1: 1,
    fire2: 2,
    specialLeft: 4,
    specialRight: 8,
    specialUp: 16,
    specialDown: 32,
  },
  selectionEdge: "users.chng suppresses fire1/fire2 until both are released",
});

/**
 * Validate one current free-play command without introducing a keyboard mapping.
 * A previous state makes contiguous command ticks mandatory.
 */
export function createCssoccerInputState(command, { previous = null } = {}) {
  requirePlainObject(command, "cssoccer input command");
  requireExactKeys(command, COMMAND_KEYS, "cssoccer input command");
  if (previous !== null) assertCssoccerInputState(previous);

  requireUint32(command.tick, "input tick");
  requireInt8(command.moveX, "input moveX");
  requireInt8(command.moveY, "input moveY");
  requireUint32(command.buttons, "input buttons");
  if ((command.buttons & ~ALLOWED_BUTTON_MASK) !== 0) {
    throw new RangeError("input buttons contain bits outside the pinned USER.CPP contract.");
  }

  const expectedTick = previous === null ? 0 : previous.tick + 1;
  if (command.tick !== expectedTick) {
    throw new Error(`cssoccer input ticks must be contiguous; expected ${expectedTick}.`);
  }

  const previousButtons = previous?.buttons.mask ?? 0;
  const pressedMask = (command.buttons & ~previousButtons) >>> 0;
  const releasedMask = (previousButtons & ~command.buttons) >>> 0;
  const buttons = decodeButtons(command.buttons);

  return deepFreeze({
    schema: CSSOCCER_INPUT_STATE_SCHEMA,
    tick: command.tick,
    values: {
      tick: typedValue("input.tick", "u32", command.tick),
      moveX: typedValue("input.move_x", "i8", command.moveX),
      moveY: typedValue("input.move_y", "i8", command.moveY),
      buttons: typedValue("input.buttons", "u32", command.buttons),
    },
    movement: {
      active: command.moveX !== 0 || command.moveY !== 0,
      x: command.moveX,
      y: command.moveY,
    },
    buttons,
    edges: {
      pressedMask,
      releasedMask,
      fire1Pressed: (pressedMask & CSSOCCER_INPUT_BUTTONS.FIRE_1) !== 0,
      fire1Released: (releasedMask & CSSOCCER_INPUT_BUTTONS.FIRE_1) !== 0,
      fire2Pressed: (pressedMask & CSSOCCER_INPUT_BUTTONS.FIRE_2) !== 0,
      fire2Released: (releasedMask & CSSOCCER_INPUT_BUTTONS.FIRE_2) !== 0,
    },
    previous: {
      tick: previous?.tick ?? null,
      buttons: previousButtons,
    },
  });
}

export function assertCssoccerInputState(state) {
  requirePlainObject(state, "cssoccer input state");
  requireExactKeys(
    state,
    ["buttons", "edges", "movement", "previous", "schema", "tick", "values"],
    "cssoccer input state",
  );
  if (state.schema !== CSSOCCER_INPUT_STATE_SCHEMA) {
    throw new Error(`cssoccer input state must use ${CSSOCCER_INPUT_STATE_SCHEMA}.`);
  }
  requireUint32(state.tick, "input state tick");
  requirePlainObject(state.values, "cssoccer typed input values");
  requireExactKeys(
    state.values,
    ["buttons", "moveX", "moveY", "tick"],
    "cssoccer typed input values",
  );
  const specs = {
    tick: ["input.tick", "u32"],
    moveX: ["input.move_x", "i8"],
    moveY: ["input.move_y", "i8"],
    buttons: ["input.buttons", "u32"],
  };
  for (const [key, [fieldId, valueType]] of Object.entries(specs)) {
    requireTypedValue(state.values[key], fieldId, valueType);
  }
  if (state.values.tick.value !== state.tick) {
    throw new Error("cssoccer typed input tick diverged from state tick.");
  }
  const recreatedButtons = decodeButtons(state.values.buttons.value);
  if (!sameValue(state.buttons, recreatedButtons)) {
    throw new Error("cssoccer decoded input buttons diverged from the typed mask.");
  }
  const expectedMovement = {
    active: state.values.moveX.value !== 0 || state.values.moveY.value !== 0,
    x: state.values.moveX.value,
    y: state.values.moveY.value,
  };
  if (!sameValue(state.movement, expectedMovement)) {
    throw new Error("cssoccer movement state diverged from the typed command axes.");
  }
  requirePlainObject(state.previous, "cssoccer previous input binding");
  requireExactKeys(state.previous, ["buttons", "tick"], "cssoccer previous input binding");
  if (state.previous.tick !== null) requireUint32(state.previous.tick, "previous input tick");
  if (
    (state.tick === 0 && state.previous.tick !== null)
    || (state.tick > 0 && state.previous.tick !== state.tick - 1)
  ) {
    throw new Error("cssoccer previous input tick is not contiguous with state tick.");
  }
  requireUint32(state.previous.buttons, "previous input buttons");
  if ((state.previous.buttons & ~ALLOWED_BUTTON_MASK) !== 0) {
    throw new RangeError("previous input buttons contain unsupported bits.");
  }
  const pressedMask = (state.buttons.mask & ~state.previous.buttons) >>> 0;
  const releasedMask = (state.previous.buttons & ~state.buttons.mask) >>> 0;
  const expectedEdges = {
    pressedMask,
    releasedMask,
    fire1Pressed: (pressedMask & CSSOCCER_INPUT_BUTTONS.FIRE_1) !== 0,
    fire1Released: (releasedMask & CSSOCCER_INPUT_BUTTONS.FIRE_1) !== 0,
    fire2Pressed: (pressedMask & CSSOCCER_INPUT_BUTTONS.FIRE_2) !== 0,
    fire2Released: (releasedMask & CSSOCCER_INPUT_BUTTONS.FIRE_2) !== 0,
  };
  if (!sameValue(state.edges, expectedEdges)) {
    throw new Error("cssoccer input edge state is corrupt.");
  }
  return state;
}

export function createCssoccerInputLatch({ awaitFireRelease = false } = {}) {
  if (typeof awaitFireRelease !== "boolean") {
    throw new TypeError("awaitFireRelease must be boolean.");
  }
  return Object.freeze({
    schema: CSSOCCER_INPUT_LATCH_SCHEMA,
    awaitFireRelease,
  });
}

/** Apply USER.CPP `users.chng` fire suppression after an auto-selection. */
export function applyCssoccerInputLatch(latch, input, { selected = false } = {}) {
  requirePlainObject(latch, "cssoccer input latch");
  if (
    latch.schema !== CSSOCCER_INPUT_LATCH_SCHEMA
    || typeof latch.awaitFireRelease !== "boolean"
  ) {
    throw new Error(`cssoccer input latch must use ${CSSOCCER_INPUT_LATCH_SCHEMA}.`);
  }
  assertCssoccerInputState(input);
  if (typeof selected !== "boolean") throw new TypeError("selected must be boolean.");

  let awaitFireRelease = latch.awaitFireRelease || selected;
  let fire1 = input.buttons.fire1;
  let fire2 = input.buttons.fire2;
  if (awaitFireRelease) {
    fire1 = false;
    fire2 = false;
    if (!input.buttons.fire1 && !input.buttons.fire2) awaitFireRelease = false;
  }

  return deepFreeze({
    latch: createCssoccerInputLatch({ awaitFireRelease }),
    effective: {
      movement: { ...input.movement },
      fire1,
      fire2,
      rawFire1: input.buttons.fire1,
      rawFire2: input.buttons.fire2,
      fireSuppressed: fire1 !== input.buttons.fire1 || fire2 !== input.buttons.fire2,
      special: {
        left: input.buttons.specialLeft,
        right: input.buttons.specialRight,
        up: input.buttons.specialUp,
        down: input.buttons.specialDown,
      },
    },
  });
}

function decodeButtons(mask) {
  requireUint32(mask, "input button mask");
  if ((mask & ~ALLOWED_BUTTON_MASK) !== 0) {
    throw new RangeError("input button mask contains unsupported bits.");
  }
  return {
    mask,
    fire1: (mask & CSSOCCER_INPUT_BUTTONS.FIRE_1) !== 0,
    fire2: (mask & CSSOCCER_INPUT_BUTTONS.FIRE_2) !== 0,
    specialLeft: (mask & CSSOCCER_INPUT_BUTTONS.SPECIAL_LEFT) !== 0,
    specialRight: (mask & CSSOCCER_INPUT_BUTTONS.SPECIAL_RIGHT) !== 0,
    specialUp: (mask & CSSOCCER_INPUT_BUTTONS.SPECIAL_UP) !== 0,
    specialDown: (mask & CSSOCCER_INPUT_BUTTONS.SPECIAL_DOWN) !== 0,
  };
}

function typedValue(fieldId, valueType, value) {
  return {
    fieldId,
    valueType,
    value,
    numericBits: numericBits(value, valueType),
  };
}

function requireTypedValue(value, fieldId, valueType) {
  requirePlainObject(value, `typed input ${fieldId}`);
  requireExactKeys(
    value,
    ["fieldId", "numericBits", "value", "valueType"],
    `typed input ${fieldId}`,
  );
  if (
    value.fieldId !== fieldId
    || value.valueType !== valueType
    || value.numericBits !== numericBits(value.value, valueType)
  ) {
    throw new Error(`typed input ${fieldId} changed value type or numeric bits.`);
  }
  if (valueType === "i8") requireInt8(value.value, fieldId);
  else requireUint32(value.value, fieldId);
}

function numericBits(value, valueType) {
  const bytes = valueType === "i8" ? 1 : 4;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "i8") view.setInt8(0, value);
  else view.setUint32(0, value, false);
  return [...new Uint8Array(buffer)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function requireInt8(value, label) {
  if (!Number.isInteger(value) || value < -128 || value > 127) {
    throw new TypeError(`${label} must be an exact int8.`);
  }
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be an exact uint32.`);
  }
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

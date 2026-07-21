import {
  CSSOCCER_INPUT_BUTTONS,
  CSSOCCER_INPUT_SOURCE,
  createCssoccerInputState,
} from "./inputState.mjs";

export const CSSOCCER_BROWSER_INPUT_SCHEMA = "cssoccer-browser-input@1";
export const CSSOCCER_CAMERA_RELATIVE_INPUT_BASIS_SCHEMA =
  "cssoccer-camera-relative-input-basis@1";

export const CSSOCCER_BROWSER_CONTROL = Object.freeze({
  MOVE_UP: "move-up",
  MOVE_DOWN: "move-down",
  MOVE_LEFT: "move-left",
  MOVE_RIGHT: "move-right",
  FIRE_1: "fire-1",
  FIRE_2: "fire-2",
});

export const CSSOCCER_BROWSER_KEYBOARD_PROFILE = deepFreeze({
  schema: "cssoccer-browser-keyboard-profile@1",
  codeBasis: "KeyboardEvent.code",
  layouts: {
    modern: {
      label: "Modern",
      movement: {
        up: ["KeyW"],
        down: ["KeyS"],
        left: ["KeyA"],
        right: ["KeyD"],
      },
      actions: {
        fire1: ["KeyJ"],
        fire2: ["KeyK"],
      },
    },
    classic: {
      label: "Classic",
      movement: {
        up: ["ArrowUp"],
        down: ["ArrowDown"],
        left: ["ArrowLeft"],
        right: ["ArrowRight"],
      },
      actions: {
        fire1: ["KeyZ"],
        fire2: [],
      },
    },
  },
  aliasGroups: {
    accessibility: {
      fire1: ["Space"],
      fire2: [],
    },
    sourceKeyboard1: {
      fire1: ["Numpad0"],
      fire2: ["NumpadDecimal"],
    },
  },
  actions: {
    fire1: {
      control: CSSOCCER_BROWSER_CONTROL.FIRE_1,
      buttonBit: CSSOCCER_INPUT_BUTTONS.FIRE_1,
      label: "Shoot / Tackle",
    },
    fire2: {
      control: CSSOCCER_BROWSER_CONTROL.FIRE_2,
      buttonBit: CSSOCCER_INPUT_BUTTONS.FIRE_2,
      label: "Pass / Sprint or Steal",
    },
  },
  clientKeys: {
    pause: "Escape",
    confirm: "Enter",
    debug: "KeyX",
  },
  unboundGameplayCodes: ["ShiftLeft", "ShiftRight"],
});

export const CSSOCCER_BROWSER_KEY_BINDINGS = deepFreeze(
  createKeyboardBindings(CSSOCCER_BROWSER_KEYBOARD_PROFILE),
);

const AXIS_MAX = 127;
const DIAGONAL_AXIS = Math.round(AXIS_MAX / Math.sqrt(2));
const STATE_KEYS = Object.freeze([
  "focused",
  "keyboardCodes",
  "paused",
  "pointers",
  "schema",
]);
const CONTROL_VALUES = new Set(Object.values(CSSOCCER_BROWSER_CONTROL));

export const CSSOCCER_BROWSER_INPUT_CONTRACT = deepFreeze({
  output: {
    schema: CSSOCCER_INPUT_SOURCE.commandSchema,
    types: CSSOCCER_INPUT_SOURCE.commandTypes,
    buttonBits: {
      fire1: CSSOCCER_INPUT_BUTTONS.FIRE_1,
      fire2: CSSOCCER_INPUT_BUTTONS.FIRE_2,
    },
  },
  axes: {
    axial: AXIS_MAX,
    diagonal: DIAGONAL_AXIS,
    upSign: -1,
    downSign: 1,
  },
  adapterOnly: [
    "keyboard code aliases",
    "coarse-pointer ids and semantic controls",
    "current presentation-camera pitch basis",
    "focus and pause release",
  ],
});

export function createCssoccerBrowserInputState() {
  return deepFreeze({
    schema: CSSOCCER_BROWSER_INPUT_SCHEMA,
    focused: true,
    paused: false,
    keyboardCodes: [],
    pointers: [],
  });
}

export function isCssoccerGameplayKey(code) {
  return typeof code === "string" && Object.hasOwn(CSSOCCER_BROWSER_KEY_BINDINGS, code);
}

export function isCssoccerDebugKey(code) {
  return code === CSSOCCER_BROWSER_KEYBOARD_PROFILE.clientKeys.debug;
}

/** Consume a plain event projection; never retain a KeyboardEvent or its target. */
export function applyCssoccerBrowserKey(state, transition) {
  const current = assertCssoccerBrowserInputState(state);
  requirePlainObject(transition, "browser key transition");
  requireExactKeys(transition, ["code", "pressed"], "browser key transition");
  if (!isCssoccerGameplayKey(transition.code)) {
    throw new RangeError("browser key code is not a cssoccer gameplay binding.");
  }
  if (typeof transition.pressed !== "boolean") {
    throw new TypeError("browser key pressed must be boolean.");
  }
  if ((!current.focused || current.paused) && transition.pressed) return current;
  const codes = new Set(current.keyboardCodes);
  if (transition.pressed) codes.add(transition.code);
  else codes.delete(transition.code);
  return nextState(current, { keyboardCodes: [...codes].sort() });
}

/** Consume a coarse-pointer semantic button projection with a primitive pointer id. */
export function applyCssoccerBrowserPointer(state, transition) {
  const current = assertCssoccerBrowserInputState(state);
  requirePlainObject(transition, "browser pointer transition");
  requireExactKeys(
    transition,
    ["control", "pointerId", "pressed"],
    "browser pointer transition",
  );
  requirePointerId(transition.pointerId, "browser pointerId");
  requireControl(transition.control, "browser pointer control");
  if (typeof transition.pressed !== "boolean") {
    throw new TypeError("browser pointer pressed must be boolean.");
  }
  if ((!current.focused || current.paused) && transition.pressed) return current;
  const pointers = current.pointers
    .filter(({ pointerId }) => pointerId !== transition.pointerId)
    .map(clone);
  if (transition.pressed) {
    pointers.push({ pointerId: transition.pointerId, control: transition.control });
  }
  pointers.sort((left, right) => left.pointerId - right.pointerId);
  return nextState(current, { pointers });
}

/** Pointer cancel/lost-capture path: removal is by id so a moved target cannot stick. */
export function releaseCssoccerBrowserPointer(state, { pointerId } = {}) {
  const current = assertCssoccerBrowserInputState(state);
  requirePointerId(pointerId, "released browser pointerId");
  return nextState(current, {
    pointers: current.pointers
      .filter((pointer) => pointer.pointerId !== pointerId)
      .map(clone),
  });
}

export function setCssoccerBrowserInputFocus(state, focused) {
  const current = assertCssoccerBrowserInputState(state);
  if (typeof focused !== "boolean") throw new TypeError("browser input focused must be boolean.");
  if (!focused) {
    return nextState(current, { focused: false, keyboardCodes: [], pointers: [] });
  }
  return nextState(current, { focused: true });
}

export function setCssoccerBrowserInputPaused(state, paused) {
  const current = assertCssoccerBrowserInputState(state);
  if (typeof paused !== "boolean") throw new TypeError("browser input paused must be boolean.");
  if (paused) {
    return nextState(current, { paused: true, keyboardCodes: [], pointers: [] });
  }
  return nextState(current, { paused: false });
}

/** Explicit pointer/key release for menu transitions, rematch, or adapter teardown. */
export function releaseAllCssoccerBrowserInput(state) {
  const current = assertCssoccerBrowserInputState(state);
  return nextState(current, { keyboardCodes: [], pointers: [] });
}

/**
 * Produce the sole gameplay handoff. The returned command has exactly the
 * existing tick/move/button contract and is validated before it leaves.
 */
export function createCssoccerBrowserInputCommand(state, {
  tick,
  previousInput = null,
  movementBasis = null,
} = {}) {
  const current = assertCssoccerBrowserInputState(state);
  requireUint32(tick, "browser input tick");
  const controls = activeControls(current);
  const horizontal = Number(controls.has(CSSOCCER_BROWSER_CONTROL.MOVE_RIGHT))
    - Number(controls.has(CSSOCCER_BROWSER_CONTROL.MOVE_LEFT));
  const vertical = Number(controls.has(CSSOCCER_BROWSER_CONTROL.MOVE_DOWN))
    - Number(controls.has(CSSOCCER_BROWSER_CONTROL.MOVE_UP));
  const diagonal = horizontal !== 0 && vertical !== 0;
  const magnitude = diagonal ? DIAGONAL_AXIS : AXIS_MAX;
  const movement = projectMovement(
    horizontal * magnitude,
    vertical * magnitude,
    movementBasis,
  );
  let buttons = 0;
  if (controls.has(CSSOCCER_BROWSER_CONTROL.FIRE_1)) {
    buttons |= CSSOCCER_INPUT_BUTTONS.FIRE_1;
  }
  if (controls.has(CSSOCCER_BROWSER_CONTROL.FIRE_2)) {
    buttons |= CSSOCCER_INPUT_BUTTONS.FIRE_2;
  }
  const command = deepFreeze({
    tick,
    moveX: movement.x,
    moveY: movement.y,
    buttons: buttons >>> 0,
  });
  const input = createCssoccerInputState(command, { previous: previousInput });
  return deepFreeze({ command, input });
}

function projectMovement(horizontal, vertical, basis) {
  if (basis === null) return { x: horizontal, y: vertical };
  requirePlainObject(basis, "browser movement basis");
  requireExactKeys(
    basis,
    ["schema", "screenDown", "screenRight"],
    "browser movement basis",
  );
  if (basis.schema !== CSSOCCER_CAMERA_RELATIVE_INPUT_BASIS_SCHEMA) {
    throw new Error(
      `browser movement basis must use ${CSSOCCER_CAMERA_RELATIVE_INPUT_BASIS_SCHEMA}.`,
    );
  }
  requireUnitVector(basis.screenRight, "browser movement screenRight");
  requireUnitVector(basis.screenDown, "browser movement screenDown");
  const dot = basis.screenRight[0] * basis.screenDown[0]
    + basis.screenRight[1] * basis.screenDown[1];
  if (Math.abs(dot) > 1e-6) {
    throw new Error("browser movement basis axes must be orthogonal.");
  }
  return {
    x: clampAxis(Math.round(
      horizontal * basis.screenRight[0] + vertical * basis.screenDown[0],
    )),
    y: clampAxis(Math.round(
      horizontal * basis.screenRight[1] + vertical * basis.screenDown[1],
    )),
  };
}

function requireUnitVector(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) {
    throw new TypeError(`${label} must be a finite vec2.`);
  }
  if (Math.abs(Math.hypot(...value) - 1) > 1e-6) {
    throw new Error(`${label} must be normalized.`);
  }
}

function clampAxis(value) {
  if (value === 0) return 0;
  return Math.max(-AXIS_MAX, Math.min(AXIS_MAX, value));
}

export function assertCssoccerBrowserInputState(state) {
  requirePlainObject(state, "browser input state");
  requireExactKeys(state, STATE_KEYS, "browser input state");
  if (state.schema !== CSSOCCER_BROWSER_INPUT_SCHEMA) {
    throw new Error(`browser input state must use ${CSSOCCER_BROWSER_INPUT_SCHEMA}.`);
  }
  if (typeof state.focused !== "boolean" || typeof state.paused !== "boolean") {
    throw new TypeError("browser input focused and paused must be boolean.");
  }
  if (!Array.isArray(state.keyboardCodes)) {
    throw new TypeError("browser input keyboardCodes must be an array.");
  }
  if (
    state.keyboardCodes.some((code) => !isCssoccerGameplayKey(code))
    || new Set(state.keyboardCodes).size !== state.keyboardCodes.length
    || !sameValue(state.keyboardCodes, [...state.keyboardCodes].sort())
  ) {
    throw new Error("browser input keyboardCodes must be unique sorted gameplay codes.");
  }
  if (!Array.isArray(state.pointers)) {
    throw new TypeError("browser input pointers must be an array.");
  }
  const pointerIds = new Set();
  let previousId = -1;
  for (const pointer of state.pointers) {
    requirePlainObject(pointer, "browser input pointer");
    requireExactKeys(pointer, ["control", "pointerId"], "browser input pointer");
    requirePointerId(pointer.pointerId, "browser input pointerId");
    requireControl(pointer.control, "browser input pointer control");
    if (pointerIds.has(pointer.pointerId) || pointer.pointerId <= previousId) {
      throw new Error("browser input pointers must have unique ascending ids.");
    }
    pointerIds.add(pointer.pointerId);
    previousId = pointer.pointerId;
  }
  if ((!state.focused || state.paused) && (
    state.keyboardCodes.length !== 0 || state.pointers.length !== 0
  )) {
    throw new Error("blurred or paused browser input must be neutralized.");
  }
  return state;
}

function activeControls(state) {
  if (!state.focused || state.paused) return new Set();
  const controls = new Set(state.keyboardCodes.map((code) => CSSOCCER_BROWSER_KEY_BINDINGS[code]));
  for (const pointer of state.pointers) controls.add(pointer.control);
  return controls;
}

function nextState(state, overrides) {
  return deepFreeze({
    schema: CSSOCCER_BROWSER_INPUT_SCHEMA,
    focused: overrides.focused ?? state.focused,
    paused: overrides.paused ?? state.paused,
    keyboardCodes: overrides.keyboardCodes ?? [...state.keyboardCodes],
    pointers: overrides.pointers ?? state.pointers.map(clone),
  });
}

function requireControl(value, label) {
  if (!CONTROL_VALUES.has(value)) throw new RangeError(`${label} is unsupported.`);
}

function requirePointerId(value, label) {
  requireUint32(value, label);
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

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  }
  return value;
}

function createKeyboardBindings(profile) {
  const bindings = {};
  const controls = {
    up: CSSOCCER_BROWSER_CONTROL.MOVE_UP,
    down: CSSOCCER_BROWSER_CONTROL.MOVE_DOWN,
    left: CSSOCCER_BROWSER_CONTROL.MOVE_LEFT,
    right: CSSOCCER_BROWSER_CONTROL.MOVE_RIGHT,
    fire1: CSSOCCER_BROWSER_CONTROL.FIRE_1,
    fire2: CSSOCCER_BROWSER_CONTROL.FIRE_2,
  };
  const bindGroup = (group) => {
    for (const [name, codes] of Object.entries(group)) {
      for (const code of codes) {
        if (Object.hasOwn(bindings, code) && bindings[code] !== controls[name]) {
          throw new Error(`browser key ${code} is assigned to conflicting controls.`);
        }
        bindings[code] = controls[name];
      }
    }
  };
  for (const layout of Object.values(profile.layouts)) {
    bindGroup(layout.movement);
    bindGroup(layout.actions);
  }
  for (const aliases of Object.values(profile.aliasGroups)) bindGroup(aliases);
  return bindings;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

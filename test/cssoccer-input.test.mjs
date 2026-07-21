import assert from "node:assert/strict";
import test from "node:test";

import {
  CSSOCCER_BROWSER_CONTROL,
  CSSOCCER_BROWSER_INPUT_CONTRACT,
  CSSOCCER_BROWSER_KEY_BINDINGS,
  CSSOCCER_BROWSER_KEYBOARD_PROFILE,
  applyCssoccerBrowserKey,
  applyCssoccerBrowserPointer,
  assertCssoccerBrowserInputState,
  createCssoccerBrowserInputCommand,
  createCssoccerBrowserInputState,
  isCssoccerDebugKey,
  isCssoccerGameplayKey,
  releaseAllCssoccerBrowserInput,
  releaseCssoccerBrowserPointer,
  setCssoccerBrowserInputFocus,
  setCssoccerBrowserInputPaused,
} from "../src/cssoccer/browserInput.mjs";
import {
  CSSOCCER_INPUT_BUTTONS,
  assertCssoccerInputState,
} from "../src/cssoccer/inputState.mjs";

const NEUTRAL_COMMAND = Object.freeze({ tick: 0, moveX: 0, moveY: 0, buttons: 0 });
const COMMAND_BY_CONTROL = Object.freeze({
  [CSSOCCER_BROWSER_CONTROL.MOVE_UP]: { ...NEUTRAL_COMMAND, moveY: -127 },
  [CSSOCCER_BROWSER_CONTROL.MOVE_DOWN]: { ...NEUTRAL_COMMAND, moveY: 127 },
  [CSSOCCER_BROWSER_CONTROL.MOVE_LEFT]: { ...NEUTRAL_COMMAND, moveX: -127 },
  [CSSOCCER_BROWSER_CONTROL.MOVE_RIGHT]: { ...NEUTRAL_COMMAND, moveX: 127 },
  [CSSOCCER_BROWSER_CONTROL.FIRE_1]: {
    ...NEUTRAL_COMMAND,
    buttons: CSSOCCER_INPUT_BUTTONS.FIRE_1,
  },
  [CSSOCCER_BROWSER_CONTROL.FIRE_2]: {
    ...NEUTRAL_COMMAND,
    buttons: CSSOCCER_INPUT_BUTTONS.FIRE_2,
  },
});

test("keyboard state quantizes axial and normalized diagonal commands", () => {
  let state = createCssoccerBrowserInputState();
  state = key(state, "KeyW", true);
  state = key(state, "KeyD", true);
  state = key(state, "Space", true);
  state = key(state, "KeyK", true);
  const emitted = createCssoccerBrowserInputCommand(state, { tick: 0 });
  assert.deepEqual(emitted.command, {
    tick: 0,
    moveX: 90,
    moveY: -90,
    buttons: CSSOCCER_INPUT_BUTTONS.FIRE_1 | CSSOCCER_INPUT_BUTTONS.FIRE_2,
  });
  assert.deepEqual(emitted.input.values.moveX, {
    fieldId: "input.move_x",
    valueType: "i8",
    value: 90,
    numericBits: "5a",
  });
  assert.deepEqual(emitted.input.values.moveY, {
    fieldId: "input.move_y",
    valueType: "i8",
    value: -90,
    numericBits: "a6",
  });
  assert.equal(CSSOCCER_BROWSER_INPUT_CONTRACT.axes.diagonal, 90);
  assert.equal(Math.abs(Math.hypot(90, 90) - 127) < 0.3, true);
  assert.doesNotThrow(() => assertCssoccerInputState(emitted.input));
  assert.ok(Object.isFrozen(emitted.command));
});

test("keyboard and touch movement rotate through the current camera pitch basis", () => {
  const inverseQuarterTurn = Object.freeze({
    schema: "cssoccer-camera-relative-input-basis@1",
    screenRight: Object.freeze([0, -1]),
    screenDown: Object.freeze([1, 0]),
  });
  let keyboard = createCssoccerBrowserInputState();
  keyboard = key(keyboard, "KeyW", true);
  assert.deepEqual(
    createCssoccerBrowserInputCommand(keyboard, {
      tick: 0,
      movementBasis: inverseQuarterTurn,
    }).command,
    { tick: 0, moveX: -127, moveY: 0, buttons: 0 },
  );

  let touch = createCssoccerBrowserInputState();
  touch = press(touch, 1, CSSOCCER_BROWSER_CONTROL.MOVE_RIGHT);
  assert.deepEqual(
    createCssoccerBrowserInputCommand(touch, {
      tick: 0,
      movementBasis: inverseQuarterTurn,
    }).command,
    { tick: 0, moveX: 0, moveY: -127, buttons: 0 },
  );
});

test("keyboard aliases coexist, opposite directions cancel, and releases cannot stick", () => {
  let state = createCssoccerBrowserInputState();
  state = key(state, "ArrowUp", true);
  state = key(state, "KeyW", true);
  assert.equal(command(state).moveY, -127);
  state = key(state, "KeyW", false);
  assert.equal(command(state).moveY, -127);
  state = key(state, "ArrowUp", false);
  assert.equal(command(state).moveY, 0);

  state = key(state, "ArrowLeft", true);
  state = key(state, "KeyD", true);
  assert.equal(command(state).moveX, 0);
  state = key(state, "ArrowLeft", false);
  assert.equal(command(state).moveX, 127);
  state = key(state, "KeyD", false);
  assert.deepEqual(command(state), { tick: 0, moveX: 0, moveY: 0, buttons: 0 });

  for (const code of ["KeyJ", "KeyZ", "Space", "Numpad0"]) {
    const pressed = key(createCssoccerBrowserInputState(), code, true);
    assert.equal(command(pressed).buttons, CSSOCCER_INPUT_BUTTONS.FIRE_1);
  }
  for (const code of ["KeyK", "NumpadDecimal"]) {
    const pressed = key(createCssoccerBrowserInputState(), code, true);
    assert.equal(command(pressed).buttons, CSSOCCER_INPUT_BUTTONS.FIRE_2);
  }
  assert.equal(isCssoccerGameplayKey("KeyW"), true);
  assert.equal(isCssoccerGameplayKey("Escape"), false);
  assert.equal(isCssoccerGameplayKey("Enter"), false);
  assert.equal(isCssoccerGameplayKey("KeyX"), false);
  assert.equal(isCssoccerDebugKey("KeyX"), true);
  assert.equal(isCssoccerDebugKey("KeyK"), false);
  assert.equal(isCssoccerGameplayKey("ShiftLeft"), false);
  assert.equal(isCssoccerGameplayKey("ShiftRight"), false);
  assert.equal(CSSOCCER_BROWSER_KEY_BINDINGS.ArrowUp, CSSOCCER_BROWSER_CONTROL.MOVE_UP);
});

test("keyboard profile pins the modern, classic, accessibility, and source aliases", () => {
  assert.deepEqual(CSSOCCER_BROWSER_KEYBOARD_PROFILE, {
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
        actions: { fire1: ["KeyJ"], fire2: ["KeyK"] },
      },
      classic: {
        label: "Classic",
        movement: {
          up: ["ArrowUp"],
          down: ["ArrowDown"],
          left: ["ArrowLeft"],
          right: ["ArrowRight"],
        },
        actions: { fire1: ["KeyZ"], fire2: [] },
      },
    },
    aliasGroups: {
      accessibility: { fire1: ["Space"], fire2: [] },
      sourceKeyboard1: { fire1: ["Numpad0"], fire2: ["NumpadDecimal"] },
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
    clientKeys: { pause: "Escape", confirm: "Enter", debug: "KeyX" },
    unboundGameplayCodes: ["ShiftLeft", "ShiftRight"],
  });
  assert.ok(Object.isFrozen(CSSOCCER_BROWSER_KEYBOARD_PROFILE));
  assert.ok(Object.isFrozen(CSSOCCER_BROWSER_KEYBOARD_PROFILE.layouts.modern.movement.up));
  assert.deepEqual(Object.keys(CSSOCCER_BROWSER_KEY_BINDINGS).sort(), [
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "KeyA",
    "KeyD",
    "KeyJ",
    "KeyK",
    "KeyS",
    "KeyW",
    "KeyZ",
    "Numpad0",
    "NumpadDecimal",
    "Space",
  ]);
  assert.equal(
    Object.values(CSSOCCER_BROWSER_KEY_BINDINGS).includes("special-left"),
    false,
  );
});

test("every documented physical code emits exactly its canonical control", () => {
  for (const [code, control] of Object.entries(CSSOCCER_BROWSER_KEY_BINDINGS)) {
    const state = key(createCssoccerBrowserInputState(), code, true);
    const emitted = command(state);
    assert.deepEqual(emitted, COMMAND_BY_CONTROL[control], `${code} -> ${control}`);
    assert.equal(
      emitted.buttons & (
        CSSOCCER_INPUT_BUTTONS.SPECIAL_LEFT
        | CSSOCCER_INPUT_BUTTONS.SPECIAL_RIGHT
        | CSSOCCER_INPUT_BUTTONS.SPECIAL_UP
        | CSSOCCER_INPUT_BUTTONS.SPECIAL_DOWN
      ),
      0,
      `${code} emitted an unsupported special-direction bit`,
    );
  }
});

test("same-control aliases survive repeat and out-of-order release", () => {
  let state = createCssoccerBrowserInputState();
  state = key(state, "KeyJ", true);
  const repeated = key(state, "KeyJ", true);
  assert.deepEqual(repeated, state);

  state = key(state, "KeyZ", true);
  state = key(state, "Space", true);
  assert.equal(command(state).buttons, CSSOCCER_INPUT_BUTTONS.FIRE_1);
  state = key(state, "KeyJ", false);
  assert.equal(command(state).buttons, CSSOCCER_INPUT_BUTTONS.FIRE_1);
  state = key(state, "Numpad0", false);
  assert.equal(command(state).buttons, CSSOCCER_INPUT_BUTTONS.FIRE_1);
  state = key(state, "KeyZ", false);
  assert.equal(command(state).buttons, CSSOCCER_INPUT_BUTTONS.FIRE_1);
  state = key(state, "Space", false);
  assert.deepEqual(command(state), NEUTRAL_COMMAND);

  state = key(state, "KeyK", true);
  state = key(state, "NumpadDecimal", true);
  assert.equal(command(state).buttons, CSSOCCER_INPUT_BUTTONS.FIRE_2);
  state = key(state, "KeyK", false);
  assert.equal(command(state).buttons, CSSOCCER_INPUT_BUTTONS.FIRE_2);
  state = key(state, "NumpadDecimal", false);
  assert.deepEqual(command(state), NEUTRAL_COMMAND);
});

test("coarse pointers emit the same canonical command as keyboard controls", () => {
  let keyboard = createCssoccerBrowserInputState();
  for (const code of ["KeyW", "KeyD", "Space", "KeyK"]) keyboard = key(keyboard, code, true);

  let pointer = createCssoccerBrowserInputState();
  pointer = press(pointer, 40, CSSOCCER_BROWSER_CONTROL.FIRE_2);
  pointer = press(pointer, 10, CSSOCCER_BROWSER_CONTROL.MOVE_UP);
  pointer = press(pointer, 30, CSSOCCER_BROWSER_CONTROL.FIRE_1);
  pointer = press(pointer, 20, CSSOCCER_BROWSER_CONTROL.MOVE_RIGHT);
  assert.deepEqual(pointer.pointers.map(({ pointerId }) => pointerId), [10, 20, 30, 40]);
  assert.deepEqual(command(pointer), command(keyboard));

  pointer = press(pointer, 40, CSSOCCER_BROWSER_CONTROL.MOVE_LEFT);
  assert.deepEqual(command(pointer), { tick: 0, moveX: 0, moveY: -127, buttons: 1 });
  pointer = releaseCssoccerBrowserPointer(pointer, { pointerId: 20 });
  assert.equal(command(pointer).moveX, -90);
  pointer = applyCssoccerBrowserPointer(pointer, {
    pointerId: 40,
    control: CSSOCCER_BROWSER_CONTROL.MOVE_LEFT,
    pressed: false,
  });
  assert.equal(command(pointer).moveX, 0);
  assert.equal(pointer.pointers.some(({ pointerId }) => pointerId === 40), false);
});

test("blur, pause, pointer cancel, and global release always resume neutral", () => {
  let state = createCssoccerBrowserInputState();
  state = key(state, "KeyW", true);
  state = press(state, 1, CSSOCCER_BROWSER_CONTROL.FIRE_1);
  state = setCssoccerBrowserInputFocus(state, false);
  assert.equal(state.focused, false);
  assert.deepEqual(state.keyboardCodes, []);
  assert.deepEqual(state.pointers, []);
  assert.deepEqual(command(state), { tick: 0, moveX: 0, moveY: 0, buttons: 0 });
  state = key(state, "KeyD", true);
  assert.deepEqual(state.keyboardCodes, []);
  state = setCssoccerBrowserInputFocus(state, true);
  assert.deepEqual(command(state), { tick: 0, moveX: 0, moveY: 0, buttons: 0 });

  state = key(state, "KeyD", true);
  state = press(state, 2, CSSOCCER_BROWSER_CONTROL.FIRE_2);
  state = setCssoccerBrowserInputPaused(state, true);
  assert.equal(state.paused, true);
  assert.deepEqual(command(state), { tick: 0, moveX: 0, moveY: 0, buttons: 0 });
  assert.equal(key(state, "KeyA", true), state);
  state = setCssoccerBrowserInputPaused(state, false);
  assert.deepEqual(command(state), { tick: 0, moveX: 0, moveY: 0, buttons: 0 });

  state = press(state, 3, CSSOCCER_BROWSER_CONTROL.MOVE_DOWN);
  state = releaseCssoccerBrowserPointer(state, { pointerId: 3 });
  assert.equal(command(state).moveY, 0);
  state = key(state, "KeyS", true);
  state = press(state, 4, CSSOCCER_BROWSER_CONTROL.FIRE_1);
  state = releaseAllCssoccerBrowserInput(state);
  assert.deepEqual(command(state), { tick: 0, moveX: 0, moveY: 0, buttons: 0 });
});

test("every emission is accepted by the existing contiguous typed input contract", () => {
  let state = key(createCssoccerBrowserInputState(), "ArrowRight", true);
  const tick0 = createCssoccerBrowserInputCommand(state, { tick: 0 });
  assert.doesNotThrow(() => assertCssoccerInputState(tick0.input));
  state = key(state, "Space", true);
  const tick1 = createCssoccerBrowserInputCommand(state, {
    tick: 1,
    previousInput: tick0.input,
  });
  assert.equal(tick1.input.edges.fire1Pressed, true);
  state = key(state, "Space", false);
  const tick2 = createCssoccerBrowserInputCommand(state, {
    tick: 2,
    previousInput: tick1.input,
  });
  assert.equal(tick2.input.edges.fire1Released, true);
  assert.throws(() => createCssoccerBrowserInputCommand(state, {
    tick: 2,
    previousInput: tick0.input,
  }), /contiguous/u);
  assert.throws(() => createCssoccerBrowserInputCommand(state, { tick: 1 }), /expected 0/u);
});

test("adapter state is deterministic plain data and rejects DOM-shaped or duration input", () => {
  let state = createCssoccerBrowserInputState();
  const repeated = key(key(state, "KeyW", true), "KeyW", true);
  state = key(state, "KeyW", true);
  assert.deepEqual(repeated, state);
  assert.doesNotThrow(() => assertCssoccerBrowserInputState(state));
  assert.equal(JSON.stringify(state).includes("duration"), false);
  assert.deepEqual(Object.keys(command(state)).sort(), ["buttons", "moveX", "moveY", "tick"]);
  assertPlainData(state);

  assert.throws(() => applyCssoccerBrowserKey(state, {
    code: "KeyW",
    pressed: true,
    duration: 2,
  }), /exactly/u);
  assert.throws(() => applyCssoccerBrowserPointer(state, {
    pointerId: 1,
    control: CSSOCCER_BROWSER_CONTROL.MOVE_UP,
    pressed: true,
    target: {},
  }), /exactly/u);
  assert.throws(
    () => applyCssoccerBrowserKey(state, new FakeKeyboardEvent("KeyW")),
    /plain object/u,
  );
  assert.throws(() => key(state, "Escape", true), /not a cssoccer gameplay binding/u);
  assert.throws(() => key(state, "KeyX", true), /not a cssoccer gameplay binding/u);
  assert.throws(() => press(state, -1, CSSOCCER_BROWSER_CONTROL.MOVE_UP), /uint32/u);
});

function key(state, code, pressed) {
  return applyCssoccerBrowserKey(state, { code, pressed });
}

function press(state, pointerId, control) {
  return applyCssoccerBrowserPointer(state, { pointerId, control, pressed: true });
}

function command(state) {
  return createCssoccerBrowserInputCommand(state, { tick: 0 }).command;
}

function assertPlainData(value) {
  if (Array.isArray(value)) {
    for (const entry of value) assertPlainData(entry);
    return;
  }
  if (value && typeof value === "object") {
    assert.equal(Object.getPrototypeOf(value), Object.prototype);
    for (const entry of Object.values(value)) assertPlainData(entry);
  }
}

class FakeKeyboardEvent {
  constructor(code) {
    this.code = code;
    this.pressed = true;
  }
}

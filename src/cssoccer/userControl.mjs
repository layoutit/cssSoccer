import {
  CSSOCCER_ACTION_COMMAND_SCHEMA,
  createCssoccerActionResolution,
  createCssoccerActionState,
  resolveCssoccerUserAction,
} from "./actionState.mjs";
import {
  CSSOCCER_INPUT_LATCH_SCHEMA,
  applyCssoccerInputLatch,
  assertCssoccerInputState,
  createCssoccerInputLatch,
  createCssoccerInputState,
} from "./inputState.mjs";
import {
  advanceCssoccerPlayerSelection,
  assertCssoccerPlayerSelection,
  assertCssoccerSelectionFrame,
  createCssoccerPlayerSelection,
  selectCssoccerPlayer,
} from "./playerSelection.mjs";

export const CSSOCCER_USER_CONTROL_SCHEMA = "cssoccer-user-control@1";
export const CSSOCCER_USER_CONTROL_RESULT_SCHEMA = "cssoccer-user-control-result@1";

const FIXTURE_ID = "spain-argentina-full-match";
const REAL_SPEED = 20;

export const CSSOCCER_USER_CONTROL_SOURCE = deepFreeze({
  sources: [
    {
      file: "USER.CPP",
      sha256: "d4e9a3bc0192780eadb7a32d766a6f40a63115e5fa3e3a39cf8a6e7849c6e1bc",
      producers: ["convert_inputs", "auto_select_a", "auto_select_b"],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["user_got_ball", "user_opp_has_ball", "user_intelligence"],
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: ["user_conts", "user_stand", "user_run", "actual_spd"],
    },
    {
      file: "DEFINES.H",
      sha256: "c4859a60656d038093422a8f9084eb7b32f520125f21ce6ed65f1219a1524ee1",
      binding: "REAL_SPEED = 20",
    },
  ],
  fixture: {
    id: FIXTURE_ID,
    choices: ["spain", "argentina"],
    retainedStateSha256: "c04ec365e835712807f0a6b5fe069e3e3a61e613f035e7624f5dfa2db2f18495",
  },
  burst: {
    initial: 0,
    reload: REAL_SPEED,
    activeWhen: "burst_timer > 0",
    exhausted: -1,
    releaseReset: 0,
  },
  unsupportedHere: [
    "keyboard or pointer event mapping",
    "native temporary keeper ownership",
    "standing special kicks",
    "AI pass/shot/contact/rules decisions",
    "physical movement and facing integration",
  ],
});

export function createCssoccerUserControl({ teamState } = {}) {
  const selection = createCssoccerPlayerSelection({ teamState });
  return deepFreeze({
    schema: CSSOCCER_USER_CONTROL_SCHEMA,
    fixtureId: FIXTURE_ID,
    selectedCountry: selection.selectedCountry,
    tick: -1,
    selection,
    input: null,
    latch: createCssoccerInputLatch(),
    burstTimer: typedBurstTimer(0),
    lastActionCommand: null,
  });
}

/**
 * Advance one typed command. Dynamic selection/action facts are supplied by
 * their later state owners and contain no renderer, DOM, or oracle objects.
 */
export function stepCssoccerUserControl(state, {
  command,
  selectionFrame,
  reselectionEvent = null,
  actionResolution = createCssoccerActionResolution(),
} = {}) {
  assertCssoccerUserControl(state);
  const input = createCssoccerInputState(command, { previous: state.input });
  assertCssoccerSelectionFrame(selectionFrame, state.selection);
  if (selectionFrame.tick !== input.tick) {
    throw new Error("User-control command and selection frame ticks must match.");
  }

  const initializing = state.selection.controlPhase === "unselected";
  if (initializing && reselectionEvent !== null) {
    throw new Error("Initial user-control selection cannot consume a gameplay reselection event.");
  }
  const selected = initializing
    ? selectCssoccerPlayer(state.selection, selectionFrame)
    : advanceCssoccerPlayerSelection(state.selection, {
        frame: selectionFrame,
        reselectionEvent,
      });
  const latched = applyCssoccerInputLatch(state.latch, input, {
    selected: selected.result.selected,
  });
  if (Object.values(latched.effective.special).some(Boolean)) {
    throw new Error("Special direction buttons are pinned input bits but unsupported by B12 control.");
  }

  let actionCommand = null;
  let burstTimer = state.burstTimer.value;
  const activePlayerId = selected.state.activePlayerId;
  if (activePlayerId !== null) {
    const candidate = selectionFrame.candidates.find(({ playerId }) => playerId === activePlayerId);
    if (!candidate) throw new Error("Selected player is missing from its dynamic selection frame.");
    const action = createCssoccerActionState({
      tick: input.tick,
      playerId: activePlayerId,
      actionId: candidate.actionId,
      facingX: candidate.facingX,
      facingY: candidate.facingY,
    });
    const resolved = resolveCssoccerUserAction(action, {
      tick: input.tick,
      input: {
        movement: { ...latched.effective.movement },
        fire1: latched.effective.fire1,
        fire2: latched.effective.fire2,
      },
      possession: possessionRelation(selectionFrame, selected.state, activePlayerId),
      resolution: actionResolution,
    });
    actionCommand = resolved.command;
    burstTimer = applyBurstDirective(burstTimer, actionCommand.burstDirective);
  }

  const next = deepFreeze({
    schema: CSSOCCER_USER_CONTROL_SCHEMA,
    fixtureId: FIXTURE_ID,
    selectedCountry: state.selectedCountry,
    tick: input.tick,
    selection: selected.state,
    input,
    latch: latched.latch,
    burstTimer: typedBurstTimer(burstTimer),
    lastActionCommand: actionCommand,
  });
  const result = deepFreeze({
    schema: CSSOCCER_USER_CONTROL_RESULT_SCHEMA,
    tick: input.tick,
    selectedCountry: next.selectedCountry,
    selection: selected.result,
    effectiveInput: clone(latched.effective),
    actionCommand,
    sprint: {
      timer: clone(next.burstTimer),
      active: burstTimer > 0,
    },
  });
  return deepFreeze({ state: next, result });
}

export function resetCssoccerUserControl(state, { teamState } = {}) {
  assertCssoccerUserControl(state);
  const reset = createCssoccerUserControl({ teamState });
  if (reset.selectedCountry !== state.selectedCountry) {
    throw new Error("User-control reset cannot change the selected country.");
  }
  return reset;
}

export function assertCssoccerUserControl(state) {
  requirePlainObject(state, "cssoccer user control");
  requireExactKeys(
    state,
    [
      "burstTimer",
      "fixtureId",
      "input",
      "lastActionCommand",
      "latch",
      "schema",
      "selectedCountry",
      "selection",
      "tick",
    ],
    "cssoccer user control",
  );
  if (
    state.schema !== CSSOCCER_USER_CONTROL_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || !["spain", "argentina"].includes(state.selectedCountry)
    || !Number.isInteger(state.tick)
    || state.tick < -1
  ) {
    throw new Error(`cssoccer user control must use ${CSSOCCER_USER_CONTROL_SCHEMA}.`);
  }
  assertCssoccerPlayerSelection(state.selection);
  if (
    state.selection.selectedCountry !== state.selectedCountry
    || state.selection.tick !== state.tick
  ) {
    throw new Error("User control and automatic selection state diverged.");
  }
  if (state.tick === -1) {
    if (state.input !== null || state.lastActionCommand !== null) {
      throw new Error("Unstarted user control cannot retain input or an action command.");
    }
  } else {
    assertCssoccerInputState(state.input);
    if (state.input.tick !== state.tick) throw new Error("User-control input tick diverged.");
  }
  requirePlainObject(state.latch, "cssoccer user-control latch");
  if (
    state.latch.schema !== CSSOCCER_INPUT_LATCH_SCHEMA
    || typeof state.latch.awaitFireRelease !== "boolean"
    || Object.keys(state.latch).length !== 2
  ) {
    throw new Error("User-control selection latch is corrupt.");
  }
  requireTypedBurstTimer(state.burstTimer);
  if (state.lastActionCommand !== null) {
    requirePlainObject(state.lastActionCommand, "cssoccer last action command");
    if (
      state.lastActionCommand.schema !== CSSOCCER_ACTION_COMMAND_SCHEMA
      || state.lastActionCommand.tick !== state.tick
      || state.lastActionCommand.playerId !== state.selection.activePlayerId
    ) {
      throw new Error("User-control last action command is not bound to the active tick/player.");
    }
  }
  return state;
}

function possessionRelation(frame, selection, activePlayerId) {
  if (frame.possessionPlayerId === null) return "free";
  if (frame.possessionPlayerId === activePlayerId) return "self";
  if (selection.eligiblePlayerIds.includes(frame.possessionPlayerId)) return "teammate";
  return "opponent";
}

function applyBurstDirective(value, directive) {
  requireInt16(value, "burst timer");
  if (directive === "preserve") return value;
  if (directive === "reset") return 0;
  if (directive !== "advance") throw new Error("Unknown source burst directive.");
  if (value === 0) return REAL_SPEED;
  const decremented = value - 1;
  if (decremented < -32768) {
    throw new RangeError("Source burst timer exceeded its retained int16 runtime window.");
  }
  return decremented === 0 ? -1 : decremented;
}

function typedBurstTimer(value) {
  requireInt16(value, "burst timer");
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setInt16(0, value, false);
  return deepFreeze({
    fieldId: "users.0.burst_timer",
    valueType: "i16",
    value,
    numericBits: [...new Uint8Array(buffer)]
      .map((entry) => entry.toString(16).padStart(2, "0"))
      .join(""),
  });
}

function requireTypedBurstTimer(value) {
  requirePlainObject(value, "typed burst timer");
  requireExactKeys(
    value,
    ["fieldId", "numericBits", "value", "valueType"],
    "typed burst timer",
  );
  const expected = typedBurstTimer(value.value);
  if (!sameValue(value, expected)) throw new Error("Burst timer changed type or numeric bits.");
}

function requireInt16(value, label) {
  if (!Number.isInteger(value) || value < -32768 || value > 32767) {
    throw new TypeError(`${label} must be an exact int16.`);
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

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  }
  return value;
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

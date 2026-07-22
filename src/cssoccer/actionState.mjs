export const CSSOCCER_ACTION_STATE_SCHEMA = "cssoccer-action-state@1";
export const CSSOCCER_ACTION_COMMAND_SCHEMA = "cssoccer-action-command@1";
export const CSSOCCER_ACTION_RESOLUTION_SCHEMA = "cssoccer-action-resolution@1";

export const CSSOCCER_NATIVE_ACTIONS = Object.freeze({
  STAND: 0,
  RUN: 1,
  TACKLE: 3,
  JUMP: 4,
  THROW: 11,
  KICK: 15,
  STEAL: 15,
  CELEBRATE: 16,
  CONTROL: 17,
  PICKUP: 19,
  STOP: 20,
});

const FRONT_FIRE_RESOLUTIONS = Object.freeze([
  "shoot",
  "punt",
  "chip",
  "forward-pass",
]);

export const CSSOCCER_ACTION_SOURCE = deepFreeze({
  sources: [
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: [
        "user_init_tackle",
        "init_tackle_act",
        "init_kick_act",
        "init_stop_act",
        "init_control_act",
        "user_run",
      ],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["user_got_ball", "user_opp_has_ball", "user_intelligence"],
    },
  ],
  retained: {
    stateSha256: "c04ec365e835712807f0a6b5fe069e3e3a61e613f035e7624f5dfa2db2f18495",
    fieldValueType: "i16",
    actionIds: { ...CSSOCCER_NATIVE_ACTIONS },
    selectedArgentinaObserved: [0, 1, 15, 20],
    globalSourceBoundObserved: [0, 1, 3, 15, 17, 20],
  },
  exactOrder: {
    ownBall: "moving fire2 precedes moving fire1",
    opponentBall: "fire1 precedes fire2",
  },
  unsupportedHere: [
    "pitch-edge target clipping and MAX_TURN facing integration",
    "later foul/rule outcomes",
  ],
});

export class CssoccerUnsupportedActionError extends Error {
  constructor(boundary, message) {
    super(message);
    this.name = "CssoccerUnsupportedActionError";
    this.code = "CSSOCCER_UNSUPPORTED_ACTION";
    this.boundary = boundary;
  }
}

export function createCssoccerActionState({
  tick,
  playerId,
  actionId,
  facingX,
  facingY,
} = {}) {
  requireUint32(tick, "action-state tick");
  requirePlayerId(playerId, "action-state player");
  requireInt16(actionId, "action-state action id");
  requireF32(facingX, "action-state facing x");
  requireF32(facingY, "action-state facing y");
  return deepFreeze({
    schema: CSSOCCER_ACTION_STATE_SCHEMA,
    tick,
    playerId,
    action: typedValue(`players.${playerId}.action`, "i16", actionId),
    facing: {
      x: typedValue(`players.${playerId}.x_displacement`, "f32", facingX),
      y: typedValue(`players.${playerId}.y_displacement`, "f32", facingY),
    },
  });
}

export function assertCssoccerActionState(state) {
  requirePlainObject(state, "cssoccer action state");
  requireExactKeys(
    state,
    ["action", "facing", "playerId", "schema", "tick"],
    "cssoccer action state",
  );
  if (state.schema !== CSSOCCER_ACTION_STATE_SCHEMA) {
    throw new Error(`cssoccer action state must use ${CSSOCCER_ACTION_STATE_SCHEMA}.`);
  }
  requirePlainObject(state.facing, "cssoccer action facing");
  requireExactKeys(state.facing, ["x", "y"], "cssoccer action facing");
  const recreated = createCssoccerActionState({
    tick: state.tick,
    playerId: state.playerId,
    actionId: state.action?.value,
    facingX: state.facing.x?.value,
    facingY: state.facing.y?.value,
  });
  if (!sameValue(state, recreated)) throw new Error("cssoccer action state changed type or numeric bits.");
  return state;
}

export function createCssoccerActionResolution(input = {}) {
  requirePlainObject(input, "cssoccer action resolution");
  requireOnlyKeys(
    input,
    ["frontFire", "opponentWithinStealRange", "tackleAccepted"],
    "cssoccer action resolution",
  );
  const frontFire = input.frontFire ?? null;
  const opponentWithinStealRange = input.opponentWithinStealRange ?? null;
  const tackleAccepted = input.tackleAccepted ?? null;
  if (frontFire !== null && !FRONT_FIRE_RESOLUTIONS.includes(frontFire)) {
    throw new Error(`frontFire must be null or ${FRONT_FIRE_RESOLUTIONS.join(", ")}.`);
  }
  for (const [name, value] of Object.entries({ opponentWithinStealRange, tackleAccepted })) {
    if (value !== null && typeof value !== "boolean") {
      throw new TypeError(`${name} must be null or boolean.`);
    }
  }
  return deepFreeze({
    schema: CSSOCCER_ACTION_RESOLUTION_SCHEMA,
    frontFire,
    opponentWithinStealRange,
    tackleAccepted,
  });
}

/**
 * Resolve only branches directly selected by USER.CPP/ACTIONS.CPP. AI/contact
 * decisions enter as explicit resolution fields and are never guessed here.
 */
export function resolveCssoccerUserAction(state, {
  tick,
  input,
  possession,
  resolution = createCssoccerActionResolution(),
} = {}) {
  assertCssoccerActionState(state);
  if (tick !== state.tick) throw new Error("Action resolution tick must match the dynamic player frame.");
  const effective = requireEffectiveInput(input);
  const relation = requirePossession(possession);
  const resolved = requireActionResolution(resolution);
  const before = state.action.value;
  const interactive = before === CSSOCCER_NATIVE_ACTIONS.STAND
    || before === CSSOCCER_NATIVE_ACTIONS.RUN;
  let after = before;
  let kind = interactive && effective.movement.active ? "run" : "hold";
  let burstDirective = "preserve";
  let decision = null;

  // ACTIONS.CPP user_stand/user_run both send an interactive player through
  // init_run_act. A non-zero direction selects RUN; a zero direction targets
  // the current position and selects STAND, including a RUN -> STAND change.
  if (interactive) {
    after = effective.movement.active
      ? CSSOCCER_NATIVE_ACTIONS.RUN
      : CSSOCCER_NATIVE_ACTIONS.STAND;
  }

  if (interactive && relation === "self") {
    if (
      before === CSSOCCER_NATIVE_ACTIONS.STAND
      && (effective.fire1 || effective.fire2)
    ) {
      throw new CssoccerUnsupportedActionError(
        "standing-special-kick",
        "STAND_ACT fire enters user_spec_kick, whose hold/release state is not retained by this lane.",
      );
    }
    if (effective.fire2 && effective.movement.active) {
      after = CSSOCCER_NATIVE_ACTIONS.KICK;
      kind = "pass";
      decision = "fire2-pass-or-forward-tap";
    } else if (effective.fire1 && effective.movement.active) {
      if (resolved.frontFire === null) {
        throw new CssoccerUnsupportedActionError(
          "front-fire-decision-required",
          "Moving fire1 requires the source shot/punt/chip/pass decision result.",
        );
      }
      after = CSSOCCER_NATIVE_ACTIONS.KICK;
      kind = resolved.frontFire;
      decision = `resolved-${resolved.frontFire}`;
    }
  } else if (interactive && relation === "opponent") {
    if (effective.fire1) {
      if (resolved.tackleAccepted === null) {
        throw new CssoccerUnsupportedActionError(
          "tackle-angle-result-required",
          "Tackle action requires the source MAX_TURN angle acceptance result.",
        );
      }
      if (resolved.tackleAccepted) {
        after = CSSOCCER_NATIVE_ACTIONS.TACKLE;
        kind = "tackle";
        decision = "source-angle-accepted";
      } else {
        kind = "tackle-rejected";
        decision = "source-angle-rejected";
      }
    } else if (effective.fire2) {
      if (resolved.opponentWithinStealRange === null) {
        throw new CssoccerUnsupportedActionError(
          "steal-range-result-required",
          "Opponent fire2 requires the source STEAL_DIST/4 comparison result.",
        );
      }
      if (resolved.opponentWithinStealRange) {
        after = CSSOCCER_NATIVE_ACTIONS.STEAL;
        kind = "steal";
        decision = "source-close-steal";
        burstDirective = "reset";
      } else {
        kind = "burst-run";
        burstDirective = "advance";
        decision = "outside-steal-range";
      }
    } else {
      burstDirective = "reset";
    }
  }

  const next = createCssoccerActionState({
    tick,
    playerId: state.playerId,
    actionId: after,
    facingX: state.facing.x.value,
    facingY: state.facing.y.value,
  });
  return deepFreeze({
    state: next,
    command: actionCommand({
      tick,
      playerId: state.playerId,
      kind,
      possession: relation,
      before,
      after,
      movement: effective.movement,
      burstDirective,
      decision,
    }),
  });
}

/** Apply a later source owner result without pretending to derive it here. */
export function applyCssoccerResolvedActionTransition(state, { tick, transition } = {}) {
  assertCssoccerActionState(state);
  if (tick !== state.tick) throw new Error("Resolved action transition tick must match action state.");
  const ids = {
    control: CSSOCCER_NATIVE_ACTIONS.CONTROL,
    stop: CSSOCCER_NATIVE_ACTIONS.STOP,
    "recover-stand": CSSOCCER_NATIVE_ACTIONS.STAND,
    "recover-run": CSSOCCER_NATIVE_ACTIONS.RUN,
  };
  if (!Object.hasOwn(ids, transition)) {
    throw new Error("Resolved transition must be control, stop, recover-stand, or recover-run.");
  }
  const next = createCssoccerActionState({
    tick,
    playerId: state.playerId,
    actionId: ids[transition],
    facingX: state.facing.x.value,
    facingY: state.facing.y.value,
  });
  return deepFreeze({
    state: next,
    command: actionCommand({
      tick,
      playerId: state.playerId,
      kind: transition,
      possession: "source-resolved",
      before: state.action.value,
      after: ids[transition],
      movement: { active: false, x: 0, y: 0 },
      burstDirective: "preserve",
      decision: "later-source-owner",
    }),
  });
}

function actionCommand({
  tick,
  playerId,
  kind,
  possession,
  before,
  after,
  movement,
  burstDirective,
  decision,
}) {
  return {
    schema: CSSOCCER_ACTION_COMMAND_SCHEMA,
    tick,
    playerId,
    kind,
    possession,
    actionBefore: typedValue(`players.${playerId}.action.before`, "i16", before),
    actionAfter: typedValue(`players.${playerId}.action.after`, "i16", after),
    facingIntent: {
      active: movement.active,
      x: typedValue(`players.${playerId}.input_facing_x`, "i8", movement.x),
      y: typedValue(`players.${playerId}.input_facing_y`, "i8", movement.y),
      application: "intent-only; ACTIONS.CPP new_dir/MAX_TURN integration is a later owner",
    },
    burstDirective,
    decision,
  };
}

function requireEffectiveInput(input) {
  requirePlainObject(input, "effective user action input");
  requireExactKeys(input, ["fire1", "fire2", "movement"], "effective user action input");
  if (typeof input.fire1 !== "boolean" || typeof input.fire2 !== "boolean") {
    throw new TypeError("effective fire1/fire2 must be boolean.");
  }
  requirePlainObject(input.movement, "effective movement");
  requireExactKeys(input.movement, ["active", "x", "y"], "effective movement");
  if (typeof input.movement.active !== "boolean") throw new TypeError("movement active must be boolean.");
  requireInt8(input.movement.x, "movement x");
  requireInt8(input.movement.y, "movement y");
  if (input.movement.active !== (input.movement.x !== 0 || input.movement.y !== 0)) {
    throw new Error("effective movement active flag diverged from its int8 axes.");
  }
  return input;
}

function requireActionResolution(value) {
  requirePlainObject(value, "cssoccer action resolution");
  if (value.schema !== CSSOCCER_ACTION_RESOLUTION_SCHEMA) {
    throw new Error(`cssoccer action resolution must use ${CSSOCCER_ACTION_RESOLUTION_SCHEMA}.`);
  }
  const recreated = createCssoccerActionResolution({
    frontFire: value.frontFire,
    opponentWithinStealRange: value.opponentWithinStealRange,
    tackleAccepted: value.tackleAccepted,
  });
  if (!sameValue(value, recreated)) throw new Error("cssoccer action resolution is corrupt.");
  return value;
}

function requirePossession(value) {
  if (!["self", "teammate", "opponent", "free"].includes(value)) {
    throw new Error("possession must be self, teammate, opponent, or free.");
  }
  return value;
}

function typedValue(fieldId, valueType, value) {
  return {
    fieldId,
    valueType,
    value,
    numericBits: numericBits(value, valueType),
  };
}

function numericBits(value, valueType) {
  const bytes = valueType === "i8" ? 1 : valueType === "i16" ? 2 : 4;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "i8") view.setInt8(0, value);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else view.setFloat32(0, value, false);
  return [...new Uint8Array(buffer)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function requirePlayerId(value, label) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} must be a fixed-fixture player id.`);
  }
}

function requireInt8(value, label) {
  if (!Number.isInteger(value) || value < -128 || value > 127) {
    throw new TypeError(`${label} must be an exact int8.`);
  }
}

function requireInt16(value, label) {
  if (!Number.isInteger(value) || value < -32768 || value > 32767) {
    throw new TypeError(`${label} must be an exact int16.`);
  }
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be an exact uint32.`);
  }
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(Math.fround(value), value)) {
    throw new TypeError(`${label} must be an exact finite float32.`);
  }
}

function requireOnlyKeys(value, allowed, label) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) throw new Error(`${label} does not accept ${unexpected.join(", ")}.`);
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

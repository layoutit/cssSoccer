import {
  CSSOCCER_FREE_PLAY_TEST_SCENARIO_SCHEMA,
  assertCssoccerFreePlayEngineApi,
  assertCssoccerFreePlayTestScenario,
  assertCssoccerFreePlayTestStepPort,
} from "../../src/cssoccer/freePlayContract.mjs";
import {
  CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
} from "../../src/cssoccer/nativeFieldContract.mjs";

export const CSSOCCER_FREE_PLAY_SCENARIO_ADAPTER_SCHEMA =
  "cssoccer-free-play-scenario-adapter@1";
export const CSSOCCER_FREE_PLAY_COMPARISON_BOUNDARY_SCHEMA =
  "cssoccer-free-play-comparison-boundary@1";
export const CSSOCCER_FREE_PLAY_GAMEPLAY_COORDINATE_WINDOW = deepFreeze({
  schema: "cssoccer-parity-coordinate-window@1",
  id: "cssoccer-free-play-after-pre-loop-presentation@1",
  startTick: 1,
  sourceBoundary: "ACTIONS.CPP init_team before FOOTBALL.CPP first gameplay loop",
  reason:
    "Native tick 0 is the retained pre-loop lineup presentation handoff; tick 1 is the first aligned gameplay state.",
});

const PRE_LOOP_PRESENTATION_FIELDS = Object.freeze([
  "animation",
  "animation_frame",
  "face_direction",
]);

const OPTION_KEYS = Object.freeze([
  "cryptoImpl",
  "engine",
  "inputAdapter",
  "projectSnapshot",
  "scenario",
]);

const REQUIRED_OPTION_KEYS = Object.freeze([
  "cryptoImpl",
  "engine",
  "projectSnapshot",
  "scenario",
]);

/**
 * Test-only deterministic driver. Its only advancing capability is the exact
 * public `step(command)` method supplied by the live engine.
 */
export async function createCssoccerFreePlayScenarioAdapter(options = {}) {
  requirePlainObject(options, "free-play scenario adapter options");
  requireAllowedKeys(
    options,
    OPTION_KEYS,
    REQUIRED_OPTION_KEYS,
    "free-play scenario adapter options",
  );
  const scenario = assertCssoccerFreePlayTestScenario(options.scenario);
  const engine = assertCssoccerFreePlayEngineApi(options.engine);
  const stepPort = assertCssoccerFreePlayTestStepPort({ step: engine.step.bind(engine) });
  const inputAdapter = requireSetPieceInputAdapter(options.inputAdapter ?? null);
  if (typeof options.projectSnapshot !== "function") {
    throw new TypeError("Free-play scenario adapter requires a read-only snapshot projector.");
  }
  if (scenario.bindings.fieldContractSha256 !== CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256) {
    throw new Error("Free-play scenario field binding diverged from the pinned contract.");
  }
  const commandSha256 = await sha256Text(serializeCommands(scenario.commands), options.cryptoImpl);
  if (commandSha256 !== scenario.bindings.commandSha256) {
    throw new Error("Free-play scenario command stream failed its SHA-256 binding.");
  }

  let cursor = 0;
  let lastProjection = null;
  let setPieceWasActive = false;
  let setPiecePulseNext = false;
  return Object.freeze({
    schema: CSSOCCER_FREE_PLAY_SCENARIO_ADAPTER_SCHEMA,
    bindings: scenario.bindings,
    commandCount: scenario.commands.length,
    get nextCommandTick() {
      return cursor;
    },
    get complete() {
      return cursor === scenario.commands.length;
    },
    snapshot() {
      return engine.snapshot();
    },
    async stepNext() {
      if (cursor >= scenario.commands.length) {
        throw new Error("Free-play command scenario is complete; no fallback command exists.");
      }
      const command = scenario.commands[cursor];
      if (command.tick !== cursor) {
        throw new Error(`Free-play scenario expected contiguous command tick ${cursor}.`);
      }
      const before = engine.snapshot();
      const comparisonBoundary = comparisonBoundaryFor(before);
      const adapted = applySetPieceInputAdapter({
        before,
        command,
        inputAdapter,
        setPieceWasActive,
        setPiecePulseNext,
      });
      setPieceWasActive = adapted.setPieceWasActive;
      setPiecePulseNext = adapted.setPiecePulseNext;
      const snapshot = stepPort.step(adapted.command);
      if (snapshot !== engine.snapshot()) {
        throw new Error("Free-play scenario step did not publish the engine snapshot.");
      }
      const projected = await options.projectSnapshot(snapshot);
      requireProjection(projected);
      lastProjection = deepFreeze({
        schema: CSSOCCER_FREE_PLAY_SCENARIO_ADAPTER_SCHEMA,
        tick: command.tick,
        phase: "post_tick",
        snapshotTick: snapshot.tick,
        command: adapted.command,
        sourceCommand: command,
        inputAdapter: adapted.evidence,
        bindings: scenario.bindings,
        comparisonBoundary,
        values: projected.values,
      });
      cursor += 1;
      return lastProjection;
    },
    inspect() {
      return deepFreeze({
        schema: CSSOCCER_FREE_PLAY_SCENARIO_ADAPTER_SCHEMA,
        nextCommandTick: cursor,
        commandCount: scenario.commands.length,
        complete: cursor === scenario.commands.length,
        lastProjection,
        inputAdapter,
        snapshot: engine.snapshot(),
      });
    },
  });
}

function applySetPieceInputAdapter({
  before,
  command,
  inputAdapter,
  setPieceWasActive,
  setPiecePulseNext,
}) {
  if (inputAdapter === null) {
    return {
      command,
      evidence: null,
      setPieceWasActive: false,
      setPiecePulseNext: false,
    };
  }
  const active = before?.match?.rules?.setPiece !== 0;
  if (!active) {
    return {
      command,
      evidence: deepFreeze({ schema: inputAdapter.schema, active: false, pulsed: false }),
      setPieceWasActive: false,
      setPiecePulseNext: false,
    };
  }
  // The native adapter first observes set_piece_on during the source tick
  // that publishes the decision state. That first pulse is consumed by the
  // source selection-change guard. The browser sees the published decision
  // state only on the following step, so begin with its matching neutral
  // half-cycle and then alternate the declared fire pulse.
  if (!setPieceWasActive) {
    return {
      command,
      evidence: deepFreeze({ schema: inputAdapter.schema, active: true, pulsed: false }),
      setPieceWasActive: true,
      setPiecePulseNext: true,
    };
  }
  const pulsed = setPiecePulseNext;
  return {
    command: pulsed
      ? deepFreeze({ ...command, buttons: command.buttons | 1 })
      : command,
    evidence: deepFreeze({ schema: inputAdapter.schema, active: true, pulsed }),
    setPieceWasActive: true,
    setPiecePulseNext: !setPiecePulseNext,
  };
}

function requireSetPieceInputAdapter(value) {
  if (value === null) return null;
  requirePlainObject(value, "free-play set-piece input adapter");
  if (
    value.schema !== "cssoccer-native-set-piece-input-adapter@1"
    || value.trigger !== "set_piece_on != 0"
    || value.behavior
      !== "alternate one neutral tick and one m=1,f=1 pulse at user_conts entry"
    || value.externalTestCommandScenario !== "all commands explicitly zero-valued"
    || value.rawFlag !== 32
    || !/^[a-f0-9]{64}$/u.test(value.sha256 ?? "")
  ) {
    throw new Error("Free-play set-piece input adapter changed its declared native contract.");
  }
  return deepFreeze({ ...value });
}

/**
 * Classify only the native presentation state that precedes the first source
 * gameplay update. The decision uses the browser lifecycle boundary and field
 * ownership; it never receives reference values or expected outcomes.
 */
export function classifyCssoccerFreePlayComparisonField(boundary, fieldId) {
  if (
    boundary?.schema !== CSSOCCER_FREE_PLAY_COMPARISON_BOUNDARY_SCHEMA
    || boundary.kind !== "pre-loop-presentation-handoff"
    || typeof fieldId !== "string"
  ) {
    return null;
  }
  const match = fieldId.match(/^players\.[^.]+\.([^.]+)$/u);
  if (match === null || !PRE_LOOP_PRESENTATION_FIELDS.includes(match[1])) return null;
  return deepFreeze({
    kind: "native-pre-loop-presentation",
    sourceBoundary: boundary.sourceBoundary,
    reason: "Native pre-loop presentation state is outside the fresh kickoff gameplay initializer.",
  });
}

function comparisonBoundaryFor(snapshot) {
  const preLoop = snapshot?.match?.kickoff?.phase === "source-initialization";
  return deepFreeze({
    schema: CSSOCCER_FREE_PLAY_COMPARISON_BOUNDARY_SCHEMA,
    kind: preLoop ? "pre-loop-presentation-handoff" : "source-gameplay",
    sourceBoundary: preLoop
      ? "ACTIONS.CPP init_team before FOOTBALL.CPP first gameplay loop"
      : "FOOTBALL.CPP gameplay loop",
  });
}

export function parseCssoccerFreePlayCommandScenario(commandStreamText, bindings) {
  if (typeof commandStreamText !== "string" || commandStreamText.length === 0) {
    throw new TypeError("Free-play command scenario requires non-empty JSONL text.");
  }
  const lines = commandStreamText.endsWith("\n")
    ? commandStreamText.slice(0, -1).split("\n")
    : commandStreamText.split("\n");
  if (lines.length === 0 || lines.some((line) => line.length === 0)) {
    throw new Error("Free-play command scenario JSONL must contain one command per line.");
  }
  const scenario = {
    schema: CSSOCCER_FREE_PLAY_TEST_SCENARIO_SCHEMA,
    bindings,
    commands: lines.map((line, index) => {
      let command;
      try {
        command = JSON.parse(line);
      } catch (error) {
        throw new SyntaxError(`Free-play command scenario line ${index + 1} is invalid JSON.`, {
          cause: error,
        });
      }
      return command;
    }),
  };
  return assertCssoccerFreePlayTestScenario(scenario);
}

export function serializeCommands(commands) {
  return `${commands.map(({ tick, moveX, moveY, buttons }) => (
    JSON.stringify({ tick, moveX, moveY, buttons })
  )).join("\n")}\n`;
}

function requireProjection(value) {
  requirePlainObject(value, "free-play snapshot projection");
  if (
    value.phase !== "post_tick"
    || value.fieldContractSha256 !== CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256
    || !Number.isSafeInteger(value.snapshotTick)
    || !isPlainObject(value.values)
  ) {
    throw new Error("Free-play snapshot projection is not bound to the current field contract.");
  }
}

async function sha256Text(value, cryptoImpl) {
  if (!cryptoImpl?.subtle || typeof cryptoImpl.subtle.digest !== "function") {
    throw new Error("Free-play scenario adapter requires Web Crypto SHA-256.");
  }
  const digest = await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function requireAllowedKeys(value, allowed, required, label) {
  const actual = Object.keys(value).sort();
  const permitted = new Set(allowed);
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  const unexpected = actual.filter((key) => !permitted.has(key));
  if (missing.length !== 0 || unexpected.length !== 0) {
    throw new Error(
      `${label} must contain ${required.join(", ")}`
        + ` and may contain only ${allowed.join(", ")}.`,
    );
  }
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function requirePlainObject(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object.`);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

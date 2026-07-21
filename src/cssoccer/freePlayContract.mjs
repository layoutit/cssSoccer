export const CSSOCCER_FREE_PLAY_COMMAND_SCHEMA = "cssoccer-free-play-command@1";
export const CSSOCCER_FREE_PLAY_ENGINE_SCHEMA = "cssoccer-free-play-engine@1";
export const CSSOCCER_FREE_PLAY_TEST_SCENARIO_SCHEMA =
  "cssoccer-free-play-command-scenario@1";

const COMMAND_KEYS = Object.freeze(["buttons", "moveX", "moveY", "tick"]);
const ENGINE_API_KEYS = Object.freeze(["schema", "snapshot", "step"]);
const TEST_STEP_PORT_KEYS = Object.freeze(["step"]);
const TEST_SCENARIO_KEYS = Object.freeze(["bindings", "commands", "schema"]);
const TEST_BINDING_KEYS = Object.freeze([
  "buildSha256",
  "commandSha256",
  "fieldContractSha256",
  "profileSha256",
  "scenarioSha256",
  "seed",
  "sourceSha256",
  "timestepMilliseconds",
]);
const SHA256 = /^[a-f0-9]{64}$/u;
const UINT32_MAX = 0xffff_ffff;
const ALLOWED_BUTTON_MASK = 0x3f;

export const CSSOCCER_FREE_PLAY_BOUNDARY = deepFreeze({
  production: {
    inputs: ["keyboard", "touch"],
    commandSchema: CSSOCCER_FREE_PLAY_COMMAND_SCHEMA,
    commandKeys: COMMAND_KEYS,
    engineApi: {
      schema: CSSOCCER_FREE_PLAY_ENGINE_SCHEMA,
      advancingMethod: "step(command)",
      readOnlyMethod: "snapshot()",
      keys: ENGINE_API_KEYS,
    },
  },
  testOnly: {
    input: "bound deterministic command scenario",
    scenarioSchema: CSSOCCER_FREE_PLAY_TEST_SCENARIO_SCHEMA,
    enginePort: "step(command)",
    stateInjection: false,
    nativeOutcomeInjection: false,
  },
  forbiddenProductionCapabilities: [
    "capture drive mode",
    "replay or seek",
    "prepared command stream",
    "native input binding",
    "command fallback",
    "tick-indexed football outcome",
    "debug-driven advancement",
    "oracle or capture dependency",
  ],
});

export function assertCssoccerFreePlayCommand(command, { expectedTick = null } = {}) {
  requirePlainObject(command, "free-play command");
  requireExactKeys(command, COMMAND_KEYS, "free-play command");
  requireUint32(command.tick, "free-play command tick");
  requireInt8(command.moveX, "free-play command moveX");
  requireInt8(command.moveY, "free-play command moveY");
  requireUint32(command.buttons, "free-play command buttons");
  if ((command.buttons & ~ALLOWED_BUTTON_MASK) !== 0) {
    throw new RangeError("Free-play command buttons contain unsupported bits.");
  }
  if (expectedTick !== null) {
    requireUint32(expectedTick, "free-play expected tick");
    if (command.tick !== expectedTick) {
      throw new Error(`Free-play command tick must be ${expectedTick}.`);
    }
  }
  return deepFreeze({
    tick: command.tick,
    moveX: command.moveX,
    moveY: command.moveY,
    buttons: command.buttons,
  });
}

export function assertCssoccerFreePlayEngineApi(engine) {
  requirePlainObject(engine, "free-play engine API");
  requireExactKeys(engine, ENGINE_API_KEYS, "free-play engine API");
  if (engine.schema !== CSSOCCER_FREE_PLAY_ENGINE_SCHEMA) {
    throw new Error(`Free-play engine API must use ${CSSOCCER_FREE_PLAY_ENGINE_SCHEMA}.`);
  }
  requireFunction(engine.step, "free-play engine step");
  requireFunction(engine.snapshot, "free-play engine snapshot");
  return engine;
}

export function assertCssoccerFreePlayTestStepPort(port) {
  requirePlainObject(port, "free-play test step port");
  requireExactKeys(port, TEST_STEP_PORT_KEYS, "free-play test step port");
  requireFunction(port.step, "free-play test step port step");
  return port;
}

export function assertCssoccerFreePlayTestScenario(scenario) {
  requirePlainObject(scenario, "free-play test scenario");
  requireExactKeys(scenario, TEST_SCENARIO_KEYS, "free-play test scenario");
  if (scenario.schema !== CSSOCCER_FREE_PLAY_TEST_SCENARIO_SCHEMA) {
    throw new Error(
      `Free-play test scenario must use ${CSSOCCER_FREE_PLAY_TEST_SCENARIO_SCHEMA}.`,
    );
  }
  requirePlainObject(scenario.bindings, "free-play test scenario bindings");
  requireExactKeys(
    scenario.bindings,
    TEST_BINDING_KEYS,
    "free-play test scenario bindings",
  );
  for (const key of [
    "buildSha256",
    "commandSha256",
    "fieldContractSha256",
    "profileSha256",
    "scenarioSha256",
    "sourceSha256",
  ]) {
    if (!SHA256.test(scenario.bindings[key] ?? "")) {
      throw new TypeError(`Free-play test scenario ${key} must be SHA-256.`);
    }
  }
  requireUint32(scenario.bindings.seed, "free-play test scenario seed");
  if (scenario.bindings.timestepMilliseconds !== 50) {
    throw new Error("Free-play test scenarios must use the fixed 50 ms timestep.");
  }
  if (!Array.isArray(scenario.commands) || scenario.commands.length === 0) {
    throw new TypeError("Free-play test scenario commands must be a non-empty array.");
  }
  const commands = scenario.commands.map((command, index) => (
    assertCssoccerFreePlayCommand(command, { expectedTick: index })
  ));
  return deepFreeze({
    schema: scenario.schema,
    bindings: clone(scenario.bindings),
    commands,
  });
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new TypeError(`${label} must be an exact uint32.`);
  }
}

function requireInt8(value, label) {
  if (!Number.isInteger(value) || value < -128 || value > 127) {
    throw new TypeError(`${label} must be an exact int8.`);
  }
}

function requireFunction(value, label) {
  if (typeof value !== "function") throw new TypeError(`${label} must be a function.`);
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
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

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
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

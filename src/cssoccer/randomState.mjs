export const CSSOCCER_NATIVE_RNG_SCHEMA = "cssoccer-native-rng@1";

export const CSSOCCER_NATIVE_RNG_SOURCE = deepFreeze({
  compiler: "Watcom C/C++ 10.5",
  library: "c:/watcom/lib386/dos/clib3r.lib(rand)",
  mapFile: {
    file: "TEST.MAP",
    sha256: "dee5c35320e3b538f880c698ecfc2ad88bd565cb298da216a5b8c654b644d88c",
    lines: "1-2, 2977",
  },
  gameSource: {
    file: "MATHS.CPP",
    sha256: "c7f61a26ce63ab439829f8c84a840f2c781704a44f2d06f149cf872013a96107",
    lines: "31-36",
  },
  fixtureSeed: 3523,
  firstRetainedOutput: 3181,
  algorithm: {
    stateBits: 32,
    multiplier: 1103515245,
    increment: 12345,
    output: "(state >>> 16) & 0x7fff",
  },
});

const DEFAULT_STATE = deepFreeze({
  schema: CSSOCCER_NATIVE_RNG_SCHEMA,
  state: CSSOCCER_NATIVE_RNG_SOURCE.fixtureSeed,
  randSeed: CSSOCCER_NATIVE_RNG_SOURCE.firstRetainedOutput,
  seed: CSSOCCER_NATIVE_RNG_SOURCE.firstRetainedOutput & 127,
  calls: 0,
});

export function createCssoccerNativeRngState(input = {}) {
  requirePlainObject(input, "native RNG state");
  requireOnlyKeys(input, ["schema", "state", "randSeed", "seed", "calls"], "native RNG state");
  if (input.schema !== undefined && input.schema !== CSSOCCER_NATIVE_RNG_SCHEMA) {
    throw new Error(`Native RNG state must use ${CSSOCCER_NATIVE_RNG_SCHEMA}.`);
  }
  const state = input.state ?? DEFAULT_STATE.state;
  const randSeed = input.randSeed ?? DEFAULT_STATE.randSeed;
  const seed = input.seed ?? (randSeed & 127);
  const calls = input.calls ?? DEFAULT_STATE.calls;
  requireUint32(state, "native RNG state.state");
  requireIntegerRange(randSeed, 0, 0x7fff, "native RNG state.randSeed");
  requireIntegerRange(seed, 0, 127, "native RNG state.seed");
  requireIntegerRange(calls, 0, 0x7fffffff, "native RNG state.calls");
  if (seed !== (randSeed & 127)) {
    throw new Error("Native RNG seed must equal randSeed & 127 from MATHS.CPP.");
  }
  return Object.freeze({
    schema: CSSOCCER_NATIVE_RNG_SCHEMA,
    state,
    randSeed,
    seed,
    calls,
  });
}

export function advanceCssoccerNativeRng(input) {
  const current = createCssoccerNativeRngState(input);
  const state = (Math.imul(
    current.state,
    CSSOCCER_NATIVE_RNG_SOURCE.algorithm.multiplier,
  ) + CSSOCCER_NATIVE_RNG_SOURCE.algorithm.increment) >>> 0;
  const randSeed = (state >>> 16) & 0x7fff;
  return createCssoccerNativeRngState({
    state,
    randSeed,
    seed: randSeed & 127,
    calls: current.calls + 1,
  });
}

export function advanceCssoccerNativeRngMany(input, count) {
  requireIntegerRange(count, 0, 0x7fffffff, "native RNG advance count");
  let state = createCssoccerNativeRngState(input);
  for (let index = 0; index < count; index += 1) {
    state = advanceCssoccerNativeRng(state);
  }
  return state;
}

function requireUint32(value, label) {
  requireIntegerRange(value, 0, 0xffffffff, label);
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
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

function requireOnlyKeys(value, keys, label) {
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) throw new Error(`${label} has unsupported fields: ${extras.join(", ")}.`);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

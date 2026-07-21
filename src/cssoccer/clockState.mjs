export const CSSOCCER_CLOCK_STATE_SCHEMA = "cssoccer-clock-state@2";

export const CSSOCCER_CLOCK_TICK_RATE_HZ = 20;
export const CSSOCCER_CLOCK_TIME_FACTOR = 2;
export const CSSOCCER_GAME_SECONDS_PER_LIVE_TICK = 2.25;
export const CSSOCCER_LIVE_TICKS_PER_HALF = 1_200;
export const CSSOCCER_HALFTIME_HOLD_TICKS = 300;
export const CSSOCCER_FULL_TIME_MATCH_HALF = 11;

const F32 = Math.fround;
const PHASES = new Set([
  "opening-kickoff",
  "first-half-live-clock",
  "halftime-whistle",
  "halftime-transition",
  "halftime-end-swap-second-half-kickoff",
  "second-half-live-clock",
  "full-time-terminal",
]);

export const CSSOCCER_CLOCK_SOURCE = deepFreeze({
  source: {
    tickRate: "DEFINES.H REAL_SPEED = 20",
    clockAdvance: "RULES.CPP match_time.sec += 90 / (time_factor * REAL_SPEED)",
    periodReadiness: "FOOTBALL.CPP nothing_happening/watch_match_time",
    halftimeHold: "RULES.CPP init_swap_ends timeout = 20 * 15",
    endSwap: "RULES.CPP await_swap/swap_teams",
    terminal: "FOOTBALL.CPP watch_match_time match_half = 11",
  },
  fixture: {
    realSecondsPerHalf: 60,
    liveTicksPerHalf: CSSOCCER_LIVE_TICKS_PER_HALF,
    halftimeHoldTicks: CSSOCCER_HALFTIME_HOLD_TICKS,
    timeFactor: CSSOCCER_CLOCK_TIME_FACTOR,
    publiclyConfigurable: false,
    drawsFinal: true,
    extraTime: false,
  },
  ownership: "current running clock and rule readiness; no absolute replay terminal tick",
});

export function createCssoccerClockState(options) {
  if (options !== undefined) {
    requirePlainObject(options, "cssoccer clock options");
    requireExactKeys(options, [], "cssoccer clock options");
  }
  return assemble({
    tick: 0,
    phase: "opening-kickoff",
    matchHalf: 0,
    halfLiveTicks: 0,
    firstHalfLiveTicks: 0,
    liveTicks: 0,
    halftimeTransitionTicks: 0,
    halftimeCount: 0,
    endSwapCount: 0,
    running: false,
    terminal: false,
    periodExpired: false,
  });
}

/** Advance one product tick from current clock-running and source readiness. */
export function stepCssoccerClockState(state, options = {}) {
  const current = assertCssoccerClockState(state);
  requirePlainObject(options, "cssoccer clock step options");
  requireExactKeys(
    options,
    ["clockAdvances", "clockRunning", "periodReady"],
    "cssoccer clock step options",
  );
  requireBoolean(options.clockAdvances, "cssoccer clockAdvances");
  requireBoolean(options.clockRunning, "cssoccer clockRunning");
  requireBoolean(options.periodReady, "cssoccer periodReady");
  if (current.terminal) {
    throw new Error("The cssoccer clock is already at full time (match_half = 11).");
  }

  const tick = current.tick + 1;
  if (current.phase === "halftime-whistle" || current.phase === "halftime-transition") {
    const halftimeTransitionTicks = current.halftimeTransitionTicks + 1;
    if (halftimeTransitionTicks >= CSSOCCER_HALFTIME_HOLD_TICKS) {
      const next = assemble({
        ...current,
        tick,
        phase: "halftime-end-swap-second-half-kickoff",
        matchHalf: 1,
        halfLiveTicks: 0,
        liveTicks: current.firstHalfLiveTicks,
        halftimeTransitionTicks: CSSOCCER_HALFTIME_HOLD_TICKS,
        endSwapCount: 1,
        running: false,
        periodExpired: false,
      });
      return result(next, [
        clockEvent("ends-swapped", next),
        clockEvent("second-half-kickoff", next),
      ]);
    }
    return result(assemble({
      ...current,
      tick,
      phase: "halftime-transition",
      halftimeTransitionTicks,
      running: false,
    }));
  }

  const mayAdvance = current.matchHalf !== CSSOCCER_FULL_TIME_MATCH_HALF
    && options.clockAdvances;
  const halfLiveTicks = current.halfLiveTicks + (mayAdvance ? 1 : 0);
  const firstHalfLiveTicks = current.matchHalf === 0
    ? halfLiveTicks
    : current.firstHalfLiveTicks;
  const liveTicks = current.matchHalf === 0
    ? halfLiveTicks
    : current.firstHalfLiveTicks + halfLiveTicks;
  const periodExpired = halfLiveTicks >= CSSOCCER_LIVE_TICKS_PER_HALF;
  if (periodExpired && options.periodReady) {
    if (current.matchHalf === 0) {
      const next = assemble({
        ...current,
        tick,
        phase: "halftime-whistle",
        halfLiveTicks,
        firstHalfLiveTicks,
        liveTicks,
        halftimeTransitionTicks: 0,
        halftimeCount: 1,
        running: false,
        periodExpired: true,
      });
      return result(next, [clockEvent("halftime-whistle", next)]);
    }
    const next = assemble({
      ...current,
      tick,
      phase: "full-time-terminal",
      matchHalf: CSSOCCER_FULL_TIME_MATCH_HALF,
      halfLiveTicks,
      liveTicks,
      running: false,
      terminal: true,
      periodExpired: true,
    });
    return result(next, [clockEvent("full-time", next)]);
  }

  const phase = mayAdvance
    ? current.matchHalf === 0
      ? "first-half-live-clock"
      : "second-half-live-clock"
    : current.phase;
  return result(assemble({
    ...current,
    tick,
    phase,
    halfLiveTicks,
    firstHalfLiveTicks,
    liveTicks,
    running: options.clockRunning,
    periodExpired,
  }));
}

export function resetCssoccerClockState(state) {
  assertCssoccerClockState(state);
  return createCssoccerClockState();
}

export function assertCssoccerClockState(state) {
  requirePlainObject(state, "cssoccer clock state");
  const keys = [
    "endSwapCount",
    "firstHalfLiveTicks",
    "gameMinute",
    "gameSecond",
    "half",
    "halfLiveTicks",
    "halftimeCount",
    "halftimeTransitionTicks",
    "liveTicks",
    "matchHalf",
    "periodExpired",
    "phase",
    "running",
    "schema",
    "terminal",
    "tick",
  ];
  requireExactKeys(state, keys, "cssoccer clock state");
  if (state.schema !== CSSOCCER_CLOCK_STATE_SCHEMA || !PHASES.has(state.phase)) {
    throw new Error(`cssoccer clock state must use ${CSSOCCER_CLOCK_STATE_SCHEMA}.`);
  }
  for (const key of [
    "tick",
    "halfLiveTicks",
    "firstHalfLiveTicks",
    "liveTicks",
    "halftimeTransitionTicks",
    "halftimeCount",
    "endSwapCount",
  ]) requireUint(state[key], `cssoccer clock ${key}`);
  requireBoolean(state.running, "cssoccer clock running");
  requireBoolean(state.terminal, "cssoccer clock terminal");
  requireBoolean(state.periodExpired, "cssoccer clock periodExpired");
  if (![0, 1, CSSOCCER_FULL_TIME_MATCH_HALF].includes(state.matchHalf)) {
    throw new Error("cssoccer clock matchHalf must be 0, 1, or 11.");
  }
  if (state.half !== (state.matchHalf === 0 ? 1 : 2)) {
    throw new Error("cssoccer display half diverged from matchHalf.");
  }
  if (state.halftimeCount !== (state.matchHalf === 0 && state.phase !== "halftime-whistle"
    && state.phase !== "halftime-transition" ? 0 : 1)) {
    throw new Error("cssoccer halftime count diverged from lifecycle phase.");
  }
  if (state.endSwapCount !== (state.matchHalf === 0 ? 0 : 1)) {
    throw new Error("cssoccer end swap count diverged from matchHalf.");
  }
  const expectedLiveTicks = state.matchHalf === 0
    ? state.halfLiveTicks
    : state.firstHalfLiveTicks + state.halfLiveTicks;
  if (state.liveTicks !== expectedLiveTicks) {
    throw new Error("cssoccer clock live tick totals diverged.");
  }
  const displayHalf = state.matchHalf === 0 ? 0 : 1;
  const display = displayFromHalfLiveTicks(displayHalf, state.halfLiveTicks);
  if (state.gameMinute !== display.gameMinute || state.gameSecond !== display.gameSecond) {
    throw new Error("cssoccer clock display diverged from current live ticks.");
  }
  if (state.periodExpired !== (state.halfLiveTicks >= CSSOCCER_LIVE_TICKS_PER_HALF)) {
    throw new Error("cssoccer period expiry diverged from current live ticks.");
  }
  if (state.terminal !== (state.matchHalf === CSSOCCER_FULL_TIME_MATCH_HALF)) {
    throw new Error("cssoccer terminal state diverged from matchHalf.");
  }
  return state;
}

function assemble(input) {
  const display = displayFromHalfLiveTicks(input.matchHalf === 0 ? 0 : 1, input.halfLiveTicks);
  return deepFreeze({
    schema: CSSOCCER_CLOCK_STATE_SCHEMA,
    tick: input.tick,
    phase: input.phase,
    matchHalf: input.matchHalf,
    half: input.matchHalf === 0 ? 1 : 2,
    gameMinute: display.gameMinute,
    gameSecond: display.gameSecond,
    running: input.running,
    terminal: input.terminal,
    liveTicks: input.liveTicks,
    halfLiveTicks: input.halfLiveTicks,
    firstHalfLiveTicks: input.firstHalfLiveTicks,
    periodExpired: input.periodExpired,
    halftimeTransitionTicks: input.halftimeTransitionTicks,
    halftimeCount: input.halftimeCount,
    endSwapCount: input.endSwapCount,
  });
}

function displayFromHalfLiveTicks(matchHalf, halfLiveTicks) {
  const totalSeconds = (matchHalf === 0 ? 0 : 45 * 60)
    + (halfLiveTicks * CSSOCCER_GAME_SECONDS_PER_LIVE_TICK);
  const gameMinute = Math.floor(totalSeconds / 60);
  return {
    gameMinute,
    gameSecond: F32(totalSeconds - gameMinute * 60),
  };
}

function result(state, events = []) {
  return Object.freeze({ state, events: deepFreeze(events) });
}

function clockEvent(type, state) {
  return {
    type,
    tick: state.tick,
    phase: state.phase,
    matchHalf: state.matchHalf,
    display: { minutes: state.gameMinute, seconds: state.gameSecond },
  };
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
}

function requireUint(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
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

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

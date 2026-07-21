import {
  assertCssoccerClockState,
  createCssoccerClockState,
  resetCssoccerClockState,
  stepCssoccerClockState,
} from "./clockState.mjs";
import { CSSOCCER_FIXTURE_ID } from "./fixtureContract.mjs";
import {
  assertCssoccerScoreState,
  awardCssoccerGoal,
  createCssoccerScoreState,
  getCssoccerNormalTimeResult,
  resetCssoccerScoreState,
} from "./scoreState.mjs";
import {
  assertCssoccerTeamState,
  resetCssoccerTeamState,
  swapCssoccerTeamEnds,
} from "./teamState.mjs";

export const CSSOCCER_MATCH_LIFECYCLE_SCHEMA = "cssoccer-match-lifecycle@2";

const verifiedTeamStates = new WeakSet();

export function createCssoccerMatchLifecycle(input) {
  assertPlainObject(input, "cssoccer match lifecycle input");
  assertOnlyKeys(input, ["teamState"], "cssoccer match lifecycle input");
  const teamState = requireTeamState(input.teamState);
  if (teamState.current.matchHalf !== 0 || teamState.current.endSwapCount !== 0) {
    throw new Error("A cssoccer match must start from the opening kickoff team state.");
  }
  return lifecycleState({
    clock: createCssoccerClockState(),
    score: createCssoccerScoreState(),
    teamState,
    result: null,
  });
}

/** Advance one current lifecycle tick from clock eligibility and rule readiness. */
export function stepCssoccerMatchLifecycle(state, options = {}) {
  assertCssoccerMatchLifecycle(state);
  assertPlainObject(options, "cssoccer lifecycle step options");
  assertOnlyKeys(
    options,
    ["clockAdvances", "clockRunning", "events", "periodReady"],
    "cssoccer lifecycle step options",
  );
  if (state.clock.terminal) {
    throw new Error("The cssoccer match is already at full time (match_half = 11).");
  }

  const clockAdvances = options.clockAdvances ?? true;
  const clockRunning = options.clockRunning ?? true;
  const periodReady = options.periodReady ?? true;
  for (const [name, value] of Object.entries({ clockAdvances, clockRunning, periodReady })) {
    if (typeof value !== "boolean") {
      throw new TypeError(`cssoccer lifecycle ${name} must be boolean.`);
    }
  }

  const inputEvents = options.events ?? [];
  if (!Array.isArray(inputEvents)) {
    throw new TypeError("cssoccer lifecycle events must be an array.");
  }
  if (inputEvents.length > 1) {
    throw new Error("At most one already-resolved goal may be awarded in a lifecycle tick.");
  }

  let score = state.score;
  const events = [];
  for (const event of inputEvents) {
    const goal = requireGoalEvent(event);
    if (
      !clockRunning
      || state.clock.phase === "halftime-whistle"
      || state.clock.phase === "halftime-transition"
    ) {
      throw new Error("A goal cannot be awarded while current gameplay is stopped.");
    }
    score = awardCssoccerGoal(score, { country: goal.country });
    events.push({
      type: "score-changed",
      tick: state.clock.tick,
      country: goal.country,
      score: { ...score.goals },
    });
  }

  const clockStep = stepCssoccerClockState(state.clock, {
    clockAdvances,
    clockRunning,
    periodReady,
  });
  let teamState = state.teamState;
  if (clockStep.events.some(({ type }) => type === "ends-swapped")) {
    teamState = swapCssoccerTeamEnds(teamState);
  }
  events.push(...clockStep.events);

  const result = clockStep.state.terminal
    ? finalResult(score)
    : null;
  const next = lifecycleState({
    clock: clockStep.state,
    score,
    teamState,
    result,
  });
  return Object.freeze({
    state: next,
    events: deepFreeze(events),
  });
}

export function resetCssoccerMatchLifecycle(state) {
  assertCssoccerMatchLifecycle(state);
  return lifecycleState({
    clock: resetCssoccerClockState(state.clock),
    score: resetCssoccerScoreState(state.score),
    teamState: resetCssoccerTeamState(state.teamState),
    result: null,
  });
}

export function assertCssoccerMatchLifecycle(state) {
  assertPlainObject(state, "cssoccer match lifecycle state");
  if (
    state.schema !== CSSOCCER_MATCH_LIFECYCLE_SCHEMA
    || state.fixtureId !== CSSOCCER_FIXTURE_ID
  ) {
    throw new Error(`cssoccer lifecycle must use the fixed ${CSSOCCER_FIXTURE_ID} fixture.`);
  }
  assertCssoccerClockState(state.clock);
  assertCssoccerScoreState(state.score);
  const teamState = requireTeamState(state.teamState);
  const expectedTeamHalf = state.clock.matchHalf === 0 ? 0 : 1;
  const expectedSwapCount = expectedTeamHalf;
  if (
    teamState.current.matchHalf !== expectedTeamHalf
    || teamState.current.endSwapCount !== expectedSwapCount
  ) {
    throw new Error("cssoccer team ends diverged from the lifecycle half.");
  }

  const expectedResult = state.clock.terminal ? finalResult(state.score) : null;
  if (!sameValue(state.result, expectedResult)) {
    throw new Error("cssoccer normal-time result diverged from clock and score state.");
  }
  if (!sameValue(
    { ...state, teamState: null },
    { ...lifecycleState({
      clock: state.clock,
      score: state.score,
      teamState: state.teamState,
      result: expectedResult,
    }), teamState: null },
  )) {
    throw new Error("cssoccer lifecycle contains unsupported fields.");
  }
  return state;
}

function lifecycleState({ clock, score, teamState, result }) {
  return Object.freeze({
    schema: CSSOCCER_MATCH_LIFECYCLE_SCHEMA,
    fixtureId: CSSOCCER_FIXTURE_ID,
    clock,
    score,
    teamState,
    result,
  });
}

function finalResult(score) {
  const normalTime = getCssoccerNormalTimeResult(score);
  return deepFreeze({
    status: "final",
    matchHalf: 11,
    normalTimeOnly: true,
    extraTime: false,
    penalties: false,
    ...normalTime,
  });
}

function requireGoalEvent(value) {
  assertPlainObject(value, "cssoccer lifecycle event");
  assertOnlyKeys(value, ["type", "country"], "cssoccer lifecycle event");
  if (value.type !== "goal-awarded") {
    throw new Error("cssoccer lifecycle accepts only already-resolved goal-awarded events.");
  }
  if (value.country !== "spain" && value.country !== "argentina") {
    throw new Error("A cssoccer goal must be awarded to exactly spain or argentina.");
  }
  return value;
}

function requireTeamState(value) {
  if (value === null || typeof value !== "object") {
    throw new TypeError("cssoccer lifecycle teamState must be an object.");
  }
  if (!verifiedTeamStates.has(value)) {
    assertCssoccerTeamState(value);
    if (!Object.isFrozen(value)) deepFreeze(value);
    verifiedTeamStates.add(value);
  }
  return value;
}

function assertOnlyKeys(value, allowed, label) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} does not accept ${unexpected.join(", ")}; duration and extra time are fixed.`);
  }
}

function assertPlainObject(value, label) {
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

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

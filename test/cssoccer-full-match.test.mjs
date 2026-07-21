import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_CLOCK_SOURCE,
  CSSOCCER_CLOCK_TICK_RATE_HZ,
  CSSOCCER_CLOCK_TIME_FACTOR,
  CSSOCCER_FULL_TIME_MATCH_HALF,
  CSSOCCER_GAME_SECONDS_PER_LIVE_TICK,
  CSSOCCER_HALFTIME_HOLD_TICKS,
  CSSOCCER_LIVE_TICKS_PER_HALF,
  createCssoccerClockState,
  resetCssoccerClockState,
  stepCssoccerClockState,
} from "../src/cssoccer/clockState.mjs";
import { createCssoccerFreePlayEngine } from "../src/cssoccer/freePlayEngine.mjs";
import {
  createCssoccerFreePlayRematchState,
  createCssoccerFreePlayState,
  setCssoccerFreePlayPaused,
} from "../src/cssoccer/freePlayState.mjs";
import {
  createCssoccerMatchLifecycle,
  resetCssoccerMatchLifecycle,
  stepCssoccerMatchLifecycle,
} from "../src/cssoccer/matchLifecycle.mjs";
import { createCssoccerTeamState } from "../src/cssoccer/teamState.mjs";

const fixture = loadPreparedFixture();

test("current clock waits for rule readiness and holds halftime from the actual whistle", () => {
  assert.equal(CSSOCCER_CLOCK_TICK_RATE_HZ, 20);
  assert.equal(CSSOCCER_CLOCK_TIME_FACTOR, 2);
  assert.equal(CSSOCCER_GAME_SECONDS_PER_LIVE_TICK, 2.25);
  assert.equal(CSSOCCER_LIVE_TICKS_PER_HALF, 1_200);
  assert.equal(CSSOCCER_HALFTIME_HOLD_TICKS, 300);
  assert.equal(CSSOCCER_FULL_TIME_MATCH_HALF, 11);
  assert.equal(CSSOCCER_CLOCK_SOURCE.fixture.realSecondsPerHalf, 60);
  assert.equal(CSSOCCER_CLOCK_SOURCE.fixture.publiclyConfigurable, false);
  assert.equal(CSSOCCER_CLOCK_SOURCE.fixture.extraTime, false);

  const opening = createCssoccerClockState();
  let state = stepClock(opening, {
    clockAdvances: false,
    clockRunning: false,
    periodReady: true,
  }).state;
  assert.equal(state.tick, 1);
  assert.equal(state.halfLiveTicks, 0);
  assert.equal(state.gameSecond, 0);

  for (let index = 0; index < CSSOCCER_LIVE_TICKS_PER_HALF; index += 1) {
    state = stepClock(state, {
      clockAdvances: true,
      clockRunning: index !== 0,
      periodReady: false,
    }).state;
  }
  assert.equal(state.periodExpired, true);
  assert.equal(state.phase, "first-half-live-clock");
  assert.deepEqual([state.gameMinute, state.gameSecond], [45, 0]);

  state = stepClock(state, {
    clockAdvances: false,
    clockRunning: false,
    periodReady: false,
  }).state;
  const whistle = stepClock(state, {
    clockAdvances: false,
    clockRunning: false,
    periodReady: true,
  });
  state = whistle.state;
  assert.deepEqual(whistle.events.map(({ type }) => type), ["halftime-whistle"]);
  const whistleTick = state.tick;

  let transition;
  for (let index = 0; index < CSSOCCER_HALFTIME_HOLD_TICKS; index += 1) {
    transition = stepClock(state, {
      clockAdvances: false,
      clockRunning: false,
      periodReady: true,
    });
    state = transition.state;
  }
  assert.equal(state.tick - whistleTick, CSSOCCER_HALFTIME_HOLD_TICKS);
  assert.equal(state.phase, "halftime-end-swap-second-half-kickoff");
  assert.equal(state.matchHalf, 1);
  assert.deepEqual(transition.events.map(({ type }) => type), [
    "ends-swapped",
    "second-half-kickoff",
  ]);

  state = stepClock(state, {
    clockAdvances: true,
    clockRunning: false,
    periodReady: false,
  }).state;
  assert.deepEqual([state.gameMinute, state.gameSecond], [45, 2.25]);
  for (let index = 1; index < CSSOCCER_LIVE_TICKS_PER_HALF; index += 1) {
    state = stepClock(state, {
      clockAdvances: true,
      clockRunning: true,
      periodReady: false,
    }).state;
  }
  const fullTime = stepClock(state, {
    clockAdvances: false,
    clockRunning: false,
    periodReady: true,
  });
  state = fullTime.state;
  assert.deepEqual(fullTime.events.map(({ type }) => type), ["full-time"]);
  assert.equal(state.terminal, true);
  assert.equal(state.matchHalf, 11);
  assert.equal(state.liveTicks, CSSOCCER_LIVE_TICKS_PER_HALF * 2);
  assert.deepEqual([state.gameMinute, state.gameSecond], [90, 0]);
  assert.throws(() => stepClock(state), /already at full time/u);
  assert.deepEqual(resetCssoccerClockState(state), opening);
});

test("lifecycle swaps once, keeps stable identity, and makes a draw final", () => {
  const teamState = createCssoccerTeamState({
    ...fixture,
    selectedCountry: "argentina",
  });
  const opening = createCssoccerMatchLifecycle({ teamState });
  const stableIds = opening.teamState.players.map(({ id }) => id);
  let state = opening;
  let endsSwapped = 0;

  while (state.clock.phase !== "halftime-whistle") {
    const goalEvents = state.clock.halfLiveTicks === 100
      ? [{ type: "goal-awarded", country: "spain" }]
      : state.clock.halfLiveTicks === 200
        ? [{ type: "goal-awarded", country: "argentina" }]
        : [];
    const stepped = stepCssoccerMatchLifecycle(state, {
      clockAdvances: true,
      clockRunning: true,
      periodReady: true,
      events: goalEvents,
    });
    state = stepped.state;
  }
  assert.deepEqual(state.score.goals, { spain: 1, argentina: 1 });

  while (state.clock.matchHalf === 0) {
    const stepped = stepCssoccerMatchLifecycle(state, {
      clockAdvances: false,
      clockRunning: false,
      periodReady: true,
    });
    state = stepped.state;
    endsSwapped += stepped.events.filter(({ type }) => type === "ends-swapped").length;
  }
  assert.equal(endsSwapped, 1);
  assert.deepEqual(state.teamState.current.nativeTeamBySlot, {
    A: "argentina",
    B: "spain",
  });
  assert.deepEqual(state.teamState.players.map(({ id }) => id), stableIds);

  while (!state.clock.terminal) {
    state = stepCssoccerMatchLifecycle(state, {
      clockAdvances: true,
      clockRunning: true,
      periodReady: true,
    }).state;
  }
  assert.deepEqual(state.result, {
    status: "final",
    matchHalf: 11,
    normalTimeOnly: true,
    extraTime: false,
    penalties: false,
    outcome: "draw",
    winnerCountry: null,
    score: { spain: 1, argentina: 1 },
  });
  assert.throws(() => stepCssoccerMatchLifecycle(state), /already at full time/u);
  assert.deepEqual(resetCssoccerMatchLifecycle(state), opening);
});

test("one command-driven free-play match reaches full time and rematches cleanly", () => {
  const initial = createCssoccerFreePlayState(fixture);
  const stableIds = initial.players.map(({ id }) => id);
  const stableRoots = initial.players.map(({ renderRootId }) => renderRootId);
  const initialRng = initial.rng;

  const paused = setCssoccerFreePlayPaused(initial, true, { reason: "user" });
  const pausedEngine = createCssoccerFreePlayEngine({ initialState: paused });
  const pausedSnapshot = pausedEngine.snapshot();
  assert.strictEqual(
    pausedEngine.step({ tick: 0, moveX: 127, moveY: -127, buttons: 63 }),
    pausedSnapshot,
  );
  const resumed = setCssoccerFreePlayPaused(paused, false);
  const resumedEngine = createCssoccerFreePlayEngine({ initialState: resumed });
  assert.equal(
    resumedEngine.step({ tick: 0, moveX: 0, moveY: 0, buttons: 0 }).tick,
    1,
  );

  const engine = createCssoccerFreePlayEngine({ initialState: initial });
  const lifecycleEvents = [];
  while (!engine.snapshot().match.clock.terminal) {
    const before = engine.snapshot();
    assert.ok(before.tick < 5_000, "current match must terminate from live clock and readiness");
    const after = engine.step({ tick: before.tick, moveX: 0, moveY: 0, buttons: 0 });
    lifecycleEvents.push(...after.lastStep.events.filter(({ type }) => (
      type === "halftime-whistle"
      || type === "ends-swapped"
      || type === "second-half-kickoff"
      || type === "full-time"
    )));
  }

  const terminal = engine.snapshot();
  assert.deepEqual(lifecycleEvents.map(({ type }) => type), [
    "halftime-whistle",
    "ends-swapped",
    "second-half-kickoff",
    "full-time",
  ]);
  assert.equal(terminal.match.clock.halftimeCount, 1);
  assert.equal(terminal.match.clock.endSwapCount, 1);
  assert.equal(terminal.match.clock.liveTicks, CSSOCCER_LIVE_TICKS_PER_HALF * 2);
  assert.equal(terminal.match.clock.terminal, true);
  assert.equal(terminal.match.result.status, "final");
  assert.equal(terminal.match.result.extraTime, false);
  assert.equal(terminal.match.result.penalties, false);
  assert.deepEqual(terminal.match.players.map(({ id }) => id), stableIds);
  assert.deepEqual(terminal.match.players.map(({ renderRootId }) => renderRootId), stableRoots);
  assert.deepEqual(
    terminal.match.teams.map(({ country, nativeTeamSlot }) => ({ country, nativeTeamSlot })),
    [
      { country: "spain", nativeTeamSlot: "B" },
      { country: "argentina", nativeTeamSlot: "A" },
    ],
  );
  assert.strictEqual(
    engine.step({ tick: terminal.tick, moveX: 127, moveY: 127, buttons: 63 }),
    terminal,
  );

  const rematch = createCssoccerFreePlayRematchState(terminal.match, fixture);
  assert.equal(rematch.tick, 0);
  assert.deepEqual(rematch.clock, createCssoccerClockState());
  assert.deepEqual(rematch.score.goals, { spain: 0, argentina: 0 });
  assert.equal(rematch.result, null);
  assert.equal(rematch.rules.phase, "centre-restart");
  assert.equal(rematch.session.paused, false);
  assert.equal(rematch.session.pendingCommand, null);
  assert.equal(rematch.session.rematchIndex, 1);
  assert.deepEqual(rematch.rng, initialRng);
  assert.deepEqual(rematch.players.map(({ id }) => id), stableIds);
  assert.deepEqual(rematch.players.map(({ renderRootId }) => renderRootId), stableRoots);
  const rematchEngine = createCssoccerFreePlayEngine({ initialState: rematch });
  assert.equal(
    rematchEngine.step({ tick: 0, moveX: 0, moveY: 0, buttons: 0 }).tick,
    1,
  );
});

test("current lifecycle source has no absolute terminal tick or replay dependency", () => {
  for (const file of ["clockState.mjs", "matchLifecycle.mjs", "freePlayEngine.mjs"]) {
    const source = readFileSync(new URL(`../src/cssoccer/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /(?:FULL_TIME_TICK|HALFTIME_WHISTLE_TICK|SECOND_HALF_KICKOFF_TICK|TERMINAL_TICK)/u);
    assert.doesNotMatch(source, /(?:browserMatchEngine|preparedFacts\.input|sourceInputAtTick)/u);
  }
});

function stepClock(state, options = {
  clockAdvances: true,
  clockRunning: true,
  periodReady: true,
}) {
  return stepCssoccerClockState(state, options);
}

function loadPreparedFixture() {
  return {
    preparedFacts: JSON.parse(readFileSync(
      new URL(
        "../build/generated/public/cssoccer/facts/spain-argentina-full-match.json",
        import.meta.url,
      ),
      "utf8",
    )),
    preparedScene: JSON.parse(readFileSync(
      new URL(
        "../build/generated/public/cssoccer/scenes/spain-argentina-full-match.json",
        import.meta.url,
      ),
      "utf8",
    )),
  };
}

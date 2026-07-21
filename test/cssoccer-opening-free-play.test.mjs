import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createCssoccerFreePlayEngine,
} from "../src/cssoccer/freePlayEngine.mjs";
import {
  createCssoccerFreePlayState,
  setCssoccerFreePlayPaused,
} from "../src/cssoccer/freePlayState.mjs";

const CENTRE = Object.freeze({ x: 640, y: 400, z: 2 });
const fixture = loadPreparedFixture();

test("fresh source state reaches open play only after current kickoff readiness", () => {
  const engine = createEngine(fixture);
  const initial = engine.snapshot();
  assert.equal(initial.match.kickoff.phase, "source-initialization");
  assert.deepEqual(initial.match.ball.ball.position, CENTRE);

  const initialized = stepNeutral(engine);
  assert.equal(initialized.match.kickoff.phase, "centre-positioning");
  assert.equal(initialized.match.kickoff.phaseTick, 0);
  assert.deepEqual(initialized.match.ball.ball.position, CENTRE);
  assert.deepEqual(initialized.match.rng.state, initial.match.rng.state);
  assert.deepEqual(initialized.match.ball.ball.rng, initial.match.ball.ball.rng);

  const firstGameplay = stepNeutral(engine);
  assert.equal(firstGameplay.match.kickoff.phaseTick, 1);
  assert.equal(firstGameplay.match.rng.state.calls, initial.match.rng.state.calls + 1);

  let beforeLaunch = firstGameplay;
  while (engine.snapshot().match.kickoff.launch === null) {
    beforeLaunch = engine.snapshot();
    assert.equal(beforeLaunch.match.kickoff.ballStatus, "held-at-centre");
    assert.equal(beforeLaunch.match.possession.owner, 0);
    assert.deepEqual(beforeLaunch.match.ball.ball.position, CENTRE);
    stepNeutral(engine);
  }

  const launched = engine.snapshot();
  assert.equal(beforeLaunch.match.kickoff.readiness.readyForLaunch, true);
  assert.equal(launched.match.kickoff.phase, "kick-action");
  assert.equal(launched.match.kickoff.launch.tick, launched.tick);
  assert.equal(launched.match.possession.owner, 7);
  assert.equal(launched.match.kickoff.action.takerId, "spain-player-07");
  assert.equal(launched.match.kickoff.action.receiverId, "spain-player-10");

  const open = advanceToOpenPlay(engine);
  assert.equal(open.match.phase, "open-play");
  assert.equal(open.match.kickoff.ballStatus, "live");
  assert.equal(open.match.possession.owner, 0);
  assert.notDeepEqual(open.match.ball.ball.position, CENTRE);
  assert.notDeepEqual(open.match.ball.ball.displacement, { x: 0, y: 0, z: 0 });
  assert.ok(open.lastStep.events.some(({ type }) => type === "centre-pass-released"));
});

test("a legal changed tactic delays readiness and moves the launch tick", () => {
  const baseline = createEngine(fixture);
  const baselineOpen = advanceToOpenPlay(baseline);

  const altered = structuredClone(fixture);
  altered.preparedFacts.tactics.values[69][0] = [0, 800];
  altered.preparedFacts.tactics.tableSha256 = "b".repeat(64);
  const delayed = createEngine(altered);
  const delayedOpen = advanceToOpenPlay(delayed);

  assert.ok(delayedOpen.match.kickoff.launch.tick > baselineOpen.match.kickoff.launch.tick);
  assert.deepEqual(
    delayedOpen.match.kickoff.motion.players.find(
      ({ id }) => id === "argentina-player-02",
    ).target,
    { x: 1280, y: 0 },
  );
  assert.notEqual(JSON.stringify(delayedOpen.match), JSON.stringify(baselineOpen.match));
});

test("pause inserts no opening progress or queued command", () => {
  const initial = createCssoccerFreePlayState(fixture);
  const paused = setCssoccerFreePlayPaused(initial, true, { reason: "user" });
  const pausedEngine = createCssoccerFreePlayEngine({ initialState: paused });
  const held = pausedEngine.step({ tick: 0, moveX: 127, moveY: -127, buttons: 3 });
  assert.strictEqual(held, pausedEngine.snapshot());
  assert.equal(held.tick, 0);
  assert.equal(held.match.session.pendingCommand, null);

  const resumed = createCssoccerFreePlayEngine({
    initialState: setCssoccerFreePlayPaused(paused, false),
  });
  const fresh = createEngine(fixture);
  assert.deepEqual(stepNeutral(resumed), stepNeutral(fresh));
});

test("opening engine has no fixed-tick, replay, legacy, or fallback branch", () => {
  const source = readFileSync(
    new URL("../src/cssoccer/freePlayEngine.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /OPENING_ANIMATION_BOOTSTRAP_LAST_TICK|sourceInputAtTick/u);
  assert.doesNotMatch(source, /browserMatchEngine|legacy|fallback/u);
  assert.doesNotMatch(source, /(?:tick|nextTick)\s*(?:===?|[<>]=?)\s*17[0-9]/u);
});

function createEngine(input) {
  return createCssoccerFreePlayEngine({
    initialState: createCssoccerFreePlayState(input),
  });
}

function stepNeutral(engine) {
  const tick = engine.snapshot().tick;
  return engine.step({ tick, moveX: 0, moveY: 0, buttons: 0 });
}

function advanceToOpenPlay(engine) {
  for (let attempts = 0; attempts < 500; attempts += 1) {
    if (engine.snapshot().match.kickoff.phase === "open-play") return engine.snapshot();
    stepNeutral(engine);
  }
  throw new Error("Opening did not reach current-state open play.");
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

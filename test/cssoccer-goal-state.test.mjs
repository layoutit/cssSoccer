import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  createBallMatchState,
} from "../src/cssoccer/ballMatchState.mjs";
import {
  CSSOCCER_GOAL_CONSTANTS,
  CSSOCCER_GOAL_NATIVE_BINDINGS,
  CSSOCCER_GOAL_SOURCE,
  CssoccerUnsupportedGoalAttributionError,
  createCssoccerGoalState,
  projectCssoccerGoalNativeFields,
  resetCssoccerGoalState,
  resolveCssoccerCurrentPostGoalHandoff,
  resolveCssoccerCurrentQualifiedGoal,
  resumeCssoccerCurrentGoalState,
  stepCssoccerGoalCountdown,
} from "../src/cssoccer/goalState.mjs";
import {
  createCssoccerMatchLifecycle,
  stepCssoccerMatchLifecycle,
} from "../src/cssoccer/matchLifecycle.mjs";
import {
  createCssoccerTeamState,
} from "../src/cssoccer/teamState.mjs";
import {
  CSSOCCER_SCORE_NATIVE_BINDINGS,
} from "../src/cssoccer/scoreState.mjs";

const GENERATED_ROOT = new URL("../build/generated/public/cssoccer/", import.meta.url);
const TEAM_FILES = {
  facts: new URL("facts/spain-argentina-full-match.json", GENERATED_ROOT),
  scene: new URL("scenes/spain-argentina-full-match.json", GENERATED_ROOT),
};
const SOURCE_ROOT = new URL("../.local/actua-soccer/source/", import.meta.url);
const RETAINED_STREAM = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const NATIVE_CURRENT = new URL(
  "../.local/cssoccer/oracle/native/current.json",
  import.meta.url,
);
const HAS_PREPARED = Object.values(TEAM_FILES).every(existsSync);
const preparedOptions = {
  skip: HAS_PREPARED ? false : "prepared Spain-Argentina fixture is unavailable",
};
const BASE_TEAM_STATE = HAS_PREPARED ? preparedTeamState() : null;
const FIRST_HALF = HAS_PREPARED ? lifecycleAtTick(200) : null;
const SECOND_HALF = HAS_PREPARED ? lifecycleAtTick(1_800) : null;

test("goal state baseline and reset are byte-identical", () => {
  const baseline = createCssoccerGoalState();
  assert.deepEqual(projectedValues(baseline), {
    "score.goal_scorer": 0,
    "score.just_scored": 0,
    "score.team_a": 0,
    "score.team_b": 0,
    "rules.dead_ball_count": 0,
    "rules.game_action": 0,
    "rules.match_mode": 0,
  });
  assert.equal(JSON.stringify(resetCssoccerGoalState(baseline)), JSON.stringify(baseline));
  assert.equal(Object.isFrozen(baseline), true);
});

test("both goal lines in both halves award the stable country and source score slot", preparedOptions, () => {
  const fixtures = [
    { lifecycle: FIRST_HALF, goalLine: "right", lastTouch: 2, country: "spain", scorer: "spain-player-02", sourceSlot: "A", nativeSlot: "A" },
    { lifecycle: FIRST_HALF, goalLine: "left", lastTouch: 13, country: "argentina", scorer: "argentina-player-02", sourceSlot: "B", nativeSlot: "B" },
    { lifecycle: SECOND_HALF, goalLine: "right", lastTouch: 2, country: "argentina", scorer: "argentina-player-02", sourceSlot: "B", nativeSlot: "A" },
    { lifecycle: SECOND_HALF, goalLine: "left", lastTouch: 13, country: "spain", scorer: "spain-player-02", sourceSlot: "A", nativeSlot: "B" },
  ];
  for (const fixture of fixtures) {
    const goal = resolveGoal(fixture.lifecycle, fixture.goalLine, fixture.lastTouch);
    assert.equal(goal.activeGoal.scoringCountry, fixture.country);
    assert.equal(goal.activeGoal.sourceScoreSlot, fixture.sourceSlot);
    assert.equal(goal.activeGoal.nativeScoringSlot, fixture.nativeSlot);
    assert.equal(goal.activeGoal.scorer.playerId, fixture.scorer);
    assert.equal(goal.activeGoal.scorer.country, fixture.country);
    assert.equal(goal.activeGoal.ownGoal, false);
    assert.equal(goal.score.goals[fixture.country], 1);
    assert.equal(goal.lifecycleEvent.country, fixture.country);
    assert.deepEqual(goal.deadBall, {
      active: 1,
      reason: "goal",
      matchMode: 0,
      deadBallCount: 0,
      gameAction: 0,
      ballStateOwner: "ballMatchState",
    });
  }
});

test("own goals retain the stable defender identity on both lines and halves", preparedOptions, () => {
  const fixtures = [
    { lifecycle: FIRST_HALF, goalLine: "right", lastTouch: 13, award: "spain", scorer: "argentina-player-02" },
    { lifecycle: FIRST_HALF, goalLine: "left", lastTouch: 2, award: "argentina", scorer: "spain-player-02" },
    { lifecycle: SECOND_HALF, goalLine: "right", lastTouch: 13, award: "argentina", scorer: "spain-player-02" },
    { lifecycle: SECOND_HALF, goalLine: "left", lastTouch: 2, award: "spain", scorer: "argentina-player-02" },
  ];
  for (const fixture of fixtures) {
    const goal = resolveGoal(fixture.lifecycle, fixture.goalLine, fixture.lastTouch);
    assert.equal(goal.activeGoal.scoringCountry, fixture.award);
    assert.equal(goal.activeGoal.scorer.playerId, fixture.scorer);
    assert.equal(goal.activeGoal.ownGoal, true);
    assert.equal(goal.activeGoal.creditSource, "last-touch");
    assert.equal(goal.celebration.shamedPlayerNative, fixture.lastTouch);
  }
});

test("defending keeper attribution uses pre_kp_touch only for a genuine attacking touch", preparedOptions, () => {
  const rightGood = resolveGoal(FIRST_HALF, "right", 12, 2);
  assert.equal(rightGood.activeGoal.goalScorerNative, 2);
  assert.equal(rightGood.activeGoal.creditSource, "pre-keeper-touch");
  assert.equal(rightGood.activeGoal.ownGoal, false);

  const rightOwn = resolveGoal(FIRST_HALF, "right", 12, 13);
  assert.equal(rightOwn.activeGoal.goalScorerNative, 12);
  assert.equal(rightOwn.activeGoal.scorer.playerId, "argentina-player-01");
  assert.equal(rightOwn.activeGoal.creditSource, "defending-keeper-own-goal");
  assert.equal(rightOwn.activeGoal.ownGoal, true);

  const leftGood = resolveGoal(FIRST_HALF, "left", 1, 13);
  assert.equal(leftGood.activeGoal.goalScorerNative, 13);
  assert.equal(leftGood.activeGoal.ownGoal, false);

  const leftOwn = resolveGoal(FIRST_HALF, "left", 1, 2);
  assert.equal(leftOwn.activeGoal.goalScorerNative, 1);
  assert.equal(leftOwn.activeGoal.scorer.playerId, "spain-player-01");
  assert.equal(leftOwn.activeGoal.ownGoal, true);
});

test("missing last-touch and keeper history boundaries reject explicitly", preparedOptions, () => {
  const state = createCssoccerGoalState({ score: FIRST_HALF.score });
  const input = {
    ballMatchState: qualifiedGoalBall("right"),
    match: currentGoalMatch(FIRST_HALF),
  };
  assert.throws(() => resolveCssoccerCurrentQualifiedGoal(state, input), (error) => (
    error instanceof CssoccerUnsupportedGoalAttributionError
    && error.code === "missing-last-touch"
  ));
  assert.throws(() => resolveCssoccerCurrentQualifiedGoal(state, { ...input, lastTouch: 0 }), (error) => (
    error instanceof CssoccerUnsupportedGoalAttributionError
    && error.code === "missing-last-touch"
  ));
  assert.throws(() => resolveCssoccerCurrentQualifiedGoal(state, { ...input, lastTouch: 12 }), (error) => (
    error instanceof CssoccerUnsupportedGoalAttributionError
    && error.code === "missing-pre-keeper-touch"
  ));
  assert.throws(() => resolveCssoccerCurrentQualifiedGoal(state, {
    ...input,
    lastTouch: 12,
    preKeeperTouch: 0,
  }), (error) => (
    error instanceof CssoccerUnsupportedGoalAttributionError
    && error.code === "invalid-pre-keeper-touch"
  ));
  assert.throws(() => resolveCssoccerCurrentQualifiedGoal(state, {
    ...input,
    ballMatchState: createBallMatchState(),
    lastTouch: 2,
  }), /already-qualified ball goal outcome/);
});

test("current live match attribution awards either end and hands each goal to the conceding centre", preparedOptions, () => {
  const live = currentGoalMatch(FIRST_HALF);
  for (const fixture of [
    {
      goalLine: "right",
      lastTouch: 2,
      scoringCountry: "spain",
      centreCountry: "argentina",
      centreSlot: "B",
      matchMode: 6,
    },
    {
      goalLine: "left",
      lastTouch: 13,
      scoringCountry: "argentina",
      centreCountry: "spain",
      centreSlot: "A",
      matchMode: 5,
    },
  ]) {
    let goal = resolveCssoccerCurrentQualifiedGoal(createCssoccerGoalState(), {
      ballMatchState: qualifiedGoalBall(fixture.goalLine),
      match: live,
      lastTouch: fixture.lastTouch,
    });
    assert.equal(goal.activeGoal.scoringCountry, fixture.scoringCountry);
    assert.equal(goal.score.goals[fixture.scoringCountry], 1);
    goal = runCountdown(goal);
    const scoredMatch = { ...live, score: goal.score };
    goal = resolveCssoccerCurrentPostGoalHandoff(goal, { match: scoredMatch });
    assert.deepEqual(
      {
        country: goal.centreHandoff.country,
        nativeTeamSlot: goal.centreHandoff.nativeTeamSlot,
        matchMode: goal.centreHandoff.matchMode,
      },
      {
        country: fixture.centreCountry,
        nativeTeamSlot: fixture.centreSlot,
        matchMode: fixture.matchMode,
      },
    );
    goal = resumeCssoccerCurrentGoalState(goal, { score: scoredMatch.score });
    assert.equal(goal.phase, "normal-play");
    assert.equal(goal.lastGoalScorerNative, fixture.lastTouch);
  }
});

test("reset and two complete goal countdown runs are byte-identical", preparedOptions, () => {
  const first = runCountdown(resolveGoal(FIRST_HALF, "right", 2));
  const second = runCountdown(resolveGoal(FIRST_HALF, "right", 2));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(
    JSON.stringify(resetCssoccerGoalState(first)),
    JSON.stringify(createCssoccerGoalState()),
  );
});

test("goal and stable score reducers bind the corrected canonical capture identity", {
  skip: !existsSync(RETAINED_STREAM) || !existsSync(NATIVE_CURRENT),
}, () => {
  const current = JSON.parse(readFileSync(NATIVE_CURRENT, "utf8"));
  const canonical = current.canonical.runs["canonical-a"];
  const expected = {
    scenarioSha256: current.bindings.scenarioSha256,
    profileSha256: current.bindings.profileSha256,
    sourceSha256: current.bindings.sourceSha256,
    buildSha256: current.bindings.buildSha256,
    contractSha256: current.bindings.contractSha256,
    rawSha256: canonical.artifacts.raw.sha256,
    stateSha256: canonical.artifacts.state.sha256,
  };
  assert.deepEqual(CSSOCCER_GOAL_NATIVE_BINDINGS, expected);
  assert.deepEqual(CSSOCCER_SCORE_NATIVE_BINDINGS, expected);

  const headerResult = spawnSync("head", ["-n", "1", RETAINED_STREAM.pathname], {
    encoding: "utf8",
  });
  assert.equal(headerResult.status, 0, headerResult.stderr);
  const header = JSON.parse(headerResult.stdout);
  for (const key of [
    "scenarioSha256",
    "profileSha256",
    "sourceSha256",
    "buildSha256",
    "contractSha256",
  ]) {
    assert.equal(header.bindings[key], expected[key], key);
  }
});

test("source bindings stay pinned and runtime contains no native evidence or physics/kickoff implementation", {
  skip: !CSSOCCER_GOAL_SOURCE.files.every(({ file }) => existsSync(new URL(file, SOURCE_ROOT))),
}, () => {
  for (const { file, sha256 } of CSSOCCER_GOAL_SOURCE.files) {
    assert.equal(createHash("sha256").update(readFileSync(new URL(file, SOURCE_ROOT))).digest("hex"), sha256);
  }
  const goalSource = readFileSync(new URL("../src/cssoccer/goalState.mjs", import.meta.url), "utf8");
  const scoreSource = readFileSync(new URL("../src/cssoccer/scoreState.mjs", import.meta.url), "utf8");
  const runtimeSource = `${goalSource}\n${scoreSource}`;
  assert.doesNotMatch(runtimeSource, /(?:\.local|node:fs|native\.raw|state\.jsonl|readFileSync)/u);
  assert.doesNotMatch(goalSource, /(?:stepBallMatchState|stepCssoccerMatchLifecycle|init_centre|ball_trajectory)/u);
  assert.doesNotMatch(goalSource, /(?:displacement|previousPosition|outOfPlay\s*(?:\+|-|=))/u);
  assert.match(goalSource, /executionOwner: "kickoff-reducer"/u);
  assert.match(goalSource, /executionOwner: "match-lifecycle"/u);
  assert.match(goalSource, /ballStateOwner: "ballMatchState"/u);
});

function resolveGoal(lifecycle, goalLine, lastTouch, preKeeperTouch) {
  return resolveGoalFromState(
    createCssoccerGoalState({ score: lifecycle.score }),
    lifecycle,
    goalLine,
    lastTouch,
    preKeeperTouch,
  );
}

function currentGoalMatch(lifecycle) {
  return {
    score: lifecycle.score,
    players: lifecycle.teamState.players
      .map((player) => ({
        id: player.id,
        country: player.country,
        nativePlayerNumber: player.current.nativePlayerNumber,
        nativeTeamSlot: player.current.nativeTeamSlot,
      }))
      .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber),
    clock: { running: true, terminal: false },
    rules: { matchMode: 0 },
    kickoff: { phase: "open-play" },
  };
}

function resolveGoalFromState(state, lifecycle, goalLine, lastTouch, preKeeperTouch) {
  return resolveCssoccerCurrentQualifiedGoal(state, {
    ballMatchState: qualifiedGoalBall(goalLine),
    match: currentGoalMatch(lifecycle),
    lastTouch,
    ...(preKeeperTouch === undefined ? {} : { preKeeperTouch }),
  });
}

function qualifiedGoalBall(goalLine) {
  const left = goalLine === "left";
  const position = { x: left ? -1 : 1281, y: 400, z: 2 };
  return createBallMatchState({
    ball: {
      position,
      previousPosition: { x: left ? 1 : 1279, y: 400, z: 2 },
      inGoal: 1,
      outOfPlay: 25,
    },
    outcome: {
      kind: "goal",
      status: "requires-score-resolution",
      goalLine,
      lastGoal: left ? 2 : 1,
      crossing: { x: left ? 0 : 1280, y: 400, z: 2 },
    },
  });
}

function runCountdown(input) {
  let state = input;
  for (let tick = 0; tick < CSSOCCER_GOAL_CONSTANTS.justScoredTicks; tick += 1) {
    state = stepCssoccerGoalCountdown(state);
  }
  return state;
}

function lifecycleAtTick(tick) {
  let lifecycle = createCssoccerMatchLifecycle({ teamState: BASE_TEAM_STATE });
  while (lifecycle.clock.tick < tick) lifecycle = stepCssoccerMatchLifecycle(lifecycle).state;
  return lifecycle;
}

function preparedTeamState() {
  return createCssoccerTeamState({
    preparedFacts: JSON.parse(readFileSync(TEAM_FILES.facts, "utf8")),
    preparedScene: JSON.parse(readFileSync(TEAM_FILES.scene, "utf8")),
    selectedCountry: "spain",
  });
}

function projectedValues(state) {
  return Object.fromEntries(projectCssoccerGoalNativeFields(state).map(({ fieldId, value }) => [fieldId, value]));
}

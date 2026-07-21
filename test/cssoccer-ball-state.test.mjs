import assert from "node:assert/strict";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
} from "node:fs";
import test from "node:test";

import {
  CSSOCCER_BALL_CONSTANTS,
  CSSOCCER_BALL_SOURCE,
  CSSOCCER_NATIVE_BALL_FIELD_CONTRACT,
  createBallState,
  projectBallNativeFields,
  stepBallState,
} from "../src/cssoccer/ballState.mjs";
import {
  createBallLimbo,
  createBallMatchState,
  runBallMatchScript,
  stepBallMatchState,
} from "../src/cssoccer/ballMatchState.mjs";
import {
  CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
} from "../src/cssoccer/centrePassAction.mjs";
import {
  CSSOCCER_FIXED_STEP_MILLISECONDS,
  CSSOCCER_FIXED_STEP_SOURCE,
  CSSOCCER_TICK_RATE_HZ,
  advanceFixedStep,
  createFixedStepState,
} from "../src/cssoccer/fixedStep.mjs";
import {
  CSSOCCER_NATIVE_RNG_SCHEMA,
  CSSOCCER_NATIVE_RNG_SOURCE,
  advanceCssoccerNativeRng,
  createCssoccerNativeRngState,
} from "../src/cssoccer/randomState.mjs";
import {
  releaseCssoccerChargedGroundPass,
  releaseCssoccerChipPass,
  releaseCssoccerCrossPass,
  releaseCssoccerDirectedGroundPass,
} from "../src/cssoccer/livePassState.mjs";
import {
  releaseCssoccerShot,
  resolveCssoccerPuntDecision,
  resolveCssoccerShotDecision,
} from "../src/cssoccer/liveShotState.mjs";
import {
  planCssoccerKeeperSave,
  resolveCssoccerKeeperSaveContact,
} from "../src/cssoccer/keeperAi.mjs";
import { createPossessionState } from "../src/cssoccer/possessionState.mjs";

const f32 = Math.fround;
const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const retainedStateUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const evidenceTestOptions = {
  skip: !existsSync(new URL("BALL.CPP", sourceRoot)) || !existsSync(retainedStateUrl)
    ? "ignored source/native ball evidence is unavailable"
    : false,
};

test("the fixed-step accumulator consumes exactly 20 source ticks per second", () => {
  assert.equal(CSSOCCER_TICK_RATE_HZ, 20);
  assert.equal(CSSOCCER_FIXED_STEP_MILLISECONDS, 50);
  assert.equal(CSSOCCER_FIXED_STEP_SOURCE.tickRateHz, 20);

  const partial = advanceFixedStep(createFixedStepState(), 49);
  assert.equal(partial.steps, 0);
  assert.deepEqual(partial.state, { tick: 0, remainderMilliseconds: 49 });
  const completed = advanceFixedStep(partial.state, 1);
  assert.equal(completed.steps, 1);
  assert.deepEqual(completed.state, { tick: 1, remainderMilliseconds: 0 });

  const wholeSecond = advanceFixedStep(createFixedStepState(), 1000);
  let chunked = { state: createFixedStepState(), steps: 0 };
  for (let index = 0; index < 100; index += 1) {
    chunked = advanceFixedStep(chunked.state, 10);
  }
  assert.equal(wholeSecond.state.tick, 20);
  assert.deepEqual(chunked.state, wholeSecond.state);
  assert.throws(() => advanceFixedStep(createFixedStepState(), -1), /non-negative/u);
});

test("source metadata pins each implemented constant family and update order", () => {
  assert.equal(CSSOCCER_BALL_SOURCE.files[0].file, "BALL.CPP");
  assert.match(CSSOCCER_BALL_SOURCE.constantProducers.randomize, /MATHS\.CPP/u);
  assert.equal(CSSOCCER_NATIVE_RNG_SOURCE.compiler, "Watcom C/C++ 10.5");
  assert.match(CSSOCCER_NATIVE_RNG_SOURCE.library, /clib3r\.lib\(rand\)/u);
  assert.equal(CSSOCCER_NATIVE_RNG_SOURCE.fixtureSeed, 3523);
  assert.match(CSSOCCER_BALL_SOURCE.constantProducers.afterTouch, /INTELL\.CPP/u);
  assert.match(CSSOCCER_BALL_SOURCE.constantProducers.limboAndMatchOrder, /1538-1611/u);
  assert.deepEqual(CSSOCCER_BALL_SOURCE.updateOrder, [
    "get_ball_speed",
    "move_ball",
    "grav_ball",
    "ball_friction",
    "ball_still",
    "is_it_a_goal",
    "publish_previous_position",
    "pitch_bounds",
  ]);
  assert.deepEqual(
    {
      ballDiameter: CSSOCCER_BALL_CONSTANTS.ballDiameter,
      bounceDisplacement: CSSOCCER_BALL_CONSTANTS.bounceDisplacement,
      gravity: CSSOCCER_BALL_CONSTANTS.gravity,
      airFriction: CSSOCCER_BALL_CONSTANTS.airFriction,
      groundFriction: CSSOCCER_BALL_CONSTANTS.groundFriction,
      goalHeight: CSSOCCER_BALL_CONSTANTS.goalHeight,
      topPostY: CSSOCCER_BALL_CONSTANTS.topPostY,
      bottomPostY: CSSOCCER_BALL_CONSTANTS.bottomPostY,
    },
    {
      ballDiameter: f32(4),
      bounceDisplacement: f32(2.2),
      gravity: f32(0.6),
      airFriction: f32(0.986),
      groundFriction: f32(0.965),
      goalHeight: 34,
      topPostY: 357,
      bottomPostY: 443,
    },
  );
});

test("live chip and cross releases own typed flight, RNG, and exclusive possession", () => {
  const ball = createBallMatchState({
    ball: createBallState({
      tick: 12,
      position: { x: f32(80), y: f32(700), z: f32(2) },
    }),
  });
  const possession = livePassPossession(21);
  const receiver = {
    stableId: "argentina-player-03",
    nativePlayerNumber: 14,
    action: 0,
    position: { x: f32(100), y: f32(400), z: f32(0) },
    goDisplacement: { x: f32(0), y: f32(0) },
  };
  const common = {
    ball,
    possession,
    profile: CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
    receiver,
    rng: createCssoccerNativeRngState(),
    takerAccuracy: 96,
    tick: 12,
    wantedReceiver: false,
  };
  const chip = releaseCssoccerChipPass(common);
  const cross = releaseCssoccerCrossPass({ ...common, playerHeight: f32(25) });

  assert.equal(chip.possession.owner, 0);
  assert.equal(cross.possession.owner, 0);
  assert.equal(chip.ball.ball.inAir, 1);
  assert.equal(cross.ball.ball.inAir, 1);
  assert.equal(cross.release.cross, true);
  assert.equal(cross.release.receiverStopped, true);
  assert.equal(chip.rng.calls, common.rng.calls + 1);
  assert.equal(cross.rng.calls, common.rng.calls + 1);
  assert.deepEqual(chip.ball.ball.displacement, {
    x: 0.9202976822853088,
    y: -13.114571571350098,
    z: 7.725926399230957,
  });
  assert.deepEqual(cross.ball.ball.displacement, {
    x: 0.5235982537269592,
    y: -15.130475997924805,
    z: 7.339130878448486,
  });
});

test("live shot aim and charge drive current keeper catch and parry outcomes", () => {
  const ball = createBallMatchState({
    ball: createBallState({
      tick: 12,
      position: { x: f32(706), y: f32(370), z: f32(2) },
    }),
  });
  const owner = {
    nativePlayerNumber: 21,
    position: { x: f32(702), y: f32(374) },
    facing: { x: f32(-1), y: f32(0) },
    accuracy: 101,
    control: 89,
    flair: 94,
    power: 119,
  };
  const keeper = {
    id: "spain-player-01",
    nativePlayerNumber: 1,
    position: { x: f32(16), y: f32(399), z: f32(0) },
    attributes: { flair: 43, vision: 89, pace: 62 },
  };
  const release = (charge, goalY) => {
    const x = -ball.ball.position.x;
    const y = goalY - ball.ball.position.y;
    const distance = Math.hypot(x, y);
    return releaseCssoccerShot({
      ball,
      charge,
      direction: { x: f32(x / distance), y: f32(y / distance) },
      drive: false,
      keeper: {
        nativePlayerNumber: keeper.nativePlayerNumber,
        position: keeper.position,
      },
      owner,
      possession: livePassPossession(owner.nativePlayerNumber),
      rng: createCssoccerNativeRngState(),
      tick: ball.ball.tick,
      userControlled: true,
    });
  };

  const catchShot = release(20, 400);
  const parryShot = release(28, 340);
  assert.notDeepEqual(
    catchShot.release.displacement,
    parryShot.release.displacement,
  );
  assert.equal(catchShot.possession.owner, 0);
  assert.equal(parryShot.possession.owner, 0);

  const caught = playCurrentKeeperOutcome(catchShot, keeper);
  assert.equal(caught.outcome, "catch");
  assert.equal(caught.possession.owner, 1);
  assert.equal(caught.possession.inHands, 1);
  assert.deepEqual(caught.ball.ball.displacement, {
    x: f32(0),
    y: f32(0),
    z: f32(0),
  });

  const parried = playCurrentKeeperOutcome(parryShot, keeper);
  assert.equal(parried.outcome, "parry");
  assert.equal(parried.possession.owner, 0);
  assert.equal(parried.possession.inHands, 0);
  assert.equal(parried.possession.lastTouch, 1);
  assert.equal(parried.ball.ball.inAir, 1);
  assert.notDeepEqual(
    parried.ball.ball.displacement,
    parryShot.ball.ball.displacement,
  );
});

test("both AI teams derive shot and clearance decisions from current geometry", () => {
  const holder = (nativePlayerNumber, x, facingX) => ({
    nativePlayerNumber,
    position: { x: f32(x), y: f32(400) },
    facing: { x: f32(facingX), y: f32(0) },
    accuracy: 96,
    control: 88,
    flair: 90,
    power: 110,
  });
  const decisions = [
    { nativePlayerNumber: 6, x: 1050, facingX: 1, goalX: 1280, defensiveX: 300 },
    { nativePlayerNumber: 17, x: 230, facingX: -1, goalX: 0, defensiveX: 900 },
  ];
  for (const side of decisions) {
    const player = holder(side.nativePlayerNumber, side.x, side.facingX);
    assert.equal(resolveCssoccerShotDecision({
      ball: { x: side.x, y: 400 },
      firstTime: false,
      holder: player,
      mustShoot: true,
      opponentsNearHolder: 2,
      seed: 127,
      userControlled: false,
    }).outcome, "shot");
    assert.equal(resolveCssoccerPuntDecision({
      ball: { x: side.defensiveX, y: 400 },
      firstTime: false,
      holder: { ...player, position: { x: side.defensiveX, y: 400 } },
      mustPunt: true,
      opponentsNearHolder: 3,
      seed: 127,
      userControlled: false,
    }).outcome, "punt");
  }
});

test("directed and charged Fire 2 ground passes use distinct source distances", () => {
  const ball = createBallMatchState({
    ball: createBallState({
      tick: 4,
      position: { x: f32(700), y: f32(400), z: f32(2) },
    }),
  });
  const base = {
    ball,
    direction: { x: f32(-1), y: f32(0) },
    possession: livePassPossession(21),
    profile: CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
    rng: createCssoccerNativeRngState(),
    tick: 4,
  };
  const directed = releaseCssoccerDirectedGroundPass(base);
  const charged = releaseCssoccerChargedGroundPass({ ...base, charge: 3 });

  assert.equal(directed.release.receiverNativePlayer, 0);
  assert.equal(charged.release.receiverNativePlayer, 0);
  assert.equal(directed.release.targetDistance, 149.33334350585938);
  assert.equal(charged.release.targetDistance, 32);
  assert.deepEqual(directed.ball.ball.displacement, {
    x: -10.226667404174805,
    y: 0,
    z: 0,
  });
  assert.deepEqual(charged.ball.ball.displacement, {
    x: -6.119999885559082,
    y: 0,
    z: 0,
  });
  assert.equal(directed.possession.owner, 0);
  assert.equal(charged.possession.owner, 0);
});

test("Watcom 10.5 rand reproduces the retained canonical native sequence", evidenceTestOptions, () => {
  const expected = [
    11273, 22415, 26976, 31179, 14895, 21357, 11650, 26483, 3479, 13379,
    23126, 540, 11368, 26863, 4398, 1391, 13958, 29960, 16925, 13809,
  ];
  let state = createCssoccerNativeRngState();
  assert.deepEqual(
    { randSeed: state.randSeed, seed: state.seed, calls: state.calls },
    { randSeed: 3181, seed: 109, calls: 0 },
  );
  const actual = [];
  for (let index = 0; index < expected.length; index += 1) {
    state = advanceCssoccerNativeRng(state);
    actual.push(state.randSeed);
    assert.equal(state.seed, state.randSeed & 127);
    assert.equal(state.calls, index + 1);
  }
  assert.deepEqual(actual, expected);
  const sourceMap = readFileSync(new URL("TEST.MAP", sourceRoot), "utf8");
  assert.match(sourceMap, /WATCOM Linker Version 10\.5/u);
  assert.match(sourceMap, /clib3r\.lib\(rand\)/u);
});

test("checked source retains after-touch, limbo, in-goal, and process order", evidenceTestOptions, () => {
  const ballSource = readFileSync(new URL("BALL.CPP", sourceRoot), "utf8");
  const intelligenceSource = readFileSync(new URL("INTELL.CPP", sourceRoot), "utf8");
  assert.match(
    ballSource,
    /spin_cnt\+\+;[\s\S]*xys=\(\(users_dir\[u\]\.x\*shoot_y\)-\(users_dir\[u\]\.y\*shoot_x\)\);[\s\S]*ballzdis=dz\*/u,
  );
  assert.match(
    ballSource,
    /if \(ball_limbo_on>0\)[\s\S]*tm_frm\+teams\[ball_limbo_p-1\]\.tm_fstep>ball_limbo_c[\s\S]*get_ball_speed\(\);/u,
  );
  assert.match(
    ballSource,
    /\/\/ Inside goal-net[\s\S]*hit_inside_back_net\(\);[\s\S]*hit_inside_top_net\(\);/u,
  );
  assert.match(
    intelligenceSource,
    /after_touch_on=user_controlled;[\s\S]*shoot_x=ballxdis\/d;[\s\S]*shoot_y=ballydis\/d;/u,
  );
});

test("ground integration moves first, applies source friction, and keeps typed state", () => {
  const result = stepBallState(createBallState({
    position: { x: 100, y: 200, z: 2 },
    displacement: { x: 10, y: -4, z: 0 },
  }));
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.state.position, { x: f32(110), y: f32(196), z: f32(2) });
  assert.deepEqual(result.state.displacement, {
    x: f32(f32(0.965) * 10),
    y: f32(f32(0.965) * -4),
    z: f32(0),
  });
  assert.equal(result.state.speed, 3);
  assert.equal(result.state.still, 0);
  assertTypedBallState(result.state);
});

test("ground stop threshold runs after the final position move", () => {
  const result = stepBallState(createBallState({
    position: { x: 100, y: 200, z: 2 },
    displacement: { x: 0.2, y: -0.249, z: 0 },
  }));
  assert.equal(result.state.position.x, f32(100 + f32(0.2)));
  assert.equal(result.state.position.y, f32(200 + f32(-0.249)));
  assert.deepEqual(result.state.displacement, { x: f32(0), y: f32(0), z: f32(0) });
  assert.equal(result.state.still, 1);
});

test("air integration applies position, gravity, then air friction", () => {
  const result = stepBallState(createBallState({
    position: { x: 100, y: 200, z: 10 },
    displacement: { x: 10, y: 0, z: 5 },
    inAir: 1,
    still: 0,
  }));
  assert.deepEqual(result.state.position, { x: f32(110), y: f32(200), z: f32(15) });
  assert.equal(result.state.displacement.x, f32(f32(0.986) * 10));
  assert.equal(result.state.displacement.y, f32(0));
  assert.equal(result.state.displacement.z, f32(5 - f32(0.6)));
  assert.equal(result.state.inAir, 1);
});

test("bounce clamps to ball radius before loss, landing friction, gravity, and air friction", () => {
  const result = stepBallState(createBallState({
    position: { x: 100, y: 200, z: 2.5 },
    displacement: { x: 10, y: 0, z: -5 },
    inAir: 1,
    still: 0,
  }));
  assert.equal(result.state.position.z, f32(2));
  assert.equal(result.state.displacement.z, f32(f32(5 - f32(2.2)) - f32(0.6)));
  const landedX = f32(10 - (0.1 * 10));
  assert.equal(result.state.displacement.x, f32(f32(0.986) * landedX));
  assert.equal(result.state.inAir, 1);
  assert.deepEqual(result.events.map(({ type, strength }) => ({ type, strength })), [
    { type: "bounce", strength: "soft" },
  ]);
});

test("spin advances the source hold factor and rotates airborne displacement", () => {
  const result = stepBallState(createBallState({
    position: { x: 100, y: 200, z: 10 },
    displacement: { x: 4, y: 0, z: 1 },
    inAir: 1,
    still: 0,
    spin: { swerve: 1, count: 0, fullXY: 0.1, fullZ: 0.05, xy: 0, z: 0 },
  }));
  assert.equal(result.state.spin.count, 1);
  assert.equal(result.state.spin.xy, f32(f32(0.1) * (4 / 5)));
  assert.equal(result.state.spin.z, f32(-(f32(0.05) * (4 / 5))));
  assert.notEqual(result.state.displacement.y, 0);
  assertTypedBallState(result.state);

  const stopped = stepBallState(createBallState({
    position: { x: 100, y: 200, z: 10 },
    displacement: { x: 0.5, y: 0, z: 1 },
    inAir: 1,
    still: 0,
    spin: { swerve: -1, count: 4, fullXY: 0.1, fullZ: 0.05, xy: 0.02, z: -0.02 },
  }));
  assert.deepEqual(stopped.state.spin, {
    swerve: 0,
    count: 4,
    nativeState: 0,
    fullXY: f32(0),
    fullZ: f32(0),
    xy: f32(0),
    z: f32(0),
  });
});

test("after touch applies the current user vector after movement and before gravity", () => {
  const result = stepBallState(createBallState({
    position: { x: 100, y: 200, z: 10 },
    displacement: { x: 4, y: 0, z: 1 },
    inAir: 1,
    still: 0,
    spin: {
      swerve: 0,
      count: 0,
      nativeState: 0,
      fullXY: 0.1,
      fullZ: 0.05,
      xy: 0,
      z: 0,
    },
    afterTouch: { user: 1, shotDirection: { x: 1, y: 0 } },
  }), {
    afterTouchInput: { x: 0, y: 1 },
  });

  assert.deepEqual(result.state.position, { x: f32(104), y: f32(200), z: f32(11) });
  assert.equal(result.state.spin.count, 1);
  assert.equal(result.state.spin.xy, f32(f32(0.1) * (4 / 5)));
  assert.ok(Object.is(result.state.spin.z, -0));
  assert.equal(result.state.displacement.z, f32(1 - f32(0.6)));
  assert.notEqual(result.state.displacement.y, 0);
  assert.deepEqual(
    result.events.map(({ type, user }) => ({ type, user })),
    [{ type: "after-touch", user: 1 }],
  );
  assert.throws(
    () => stepBallState(createBallState({
      position: { x: 100, y: 200, z: 10 },
      displacement: { x: 4, y: 0, z: 1 },
      inAir: 1,
      still: 0,
      afterTouch: { user: 1, shotDirection: { x: 1, y: 0 } },
    })),
    /current prepared user direction/u,
  );
});

test("post collision consumes exactly two deterministic Watcom rand calls and is byte-stable", () => {
  function run() {
    return stepBallState(createBallState({
      position: { x: 1, y: 356, z: 10 },
      previousPosition: { x: 1, y: 356, z: 10 },
      displacement: { x: -2, y: 0, z: 0 },
      still: 0,
    }));
  }

  const first = run();
  const second = run();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first.events.map(({ type, post, goalLine }) => ({ type, post, goalLine })), [
    { type: "post", post: "top", goalLine: "left" },
  ]);
  assert.equal(first.state.position.x, f32(1));
  assert.deepEqual(first.state.rng, {
    schema: CSSOCCER_NATIVE_RNG_SCHEMA,
    state: 1468991865,
    seed: 15,
    randSeed: 22415,
    calls: 2,
  });
  assertTypedBallState(first.state);
});

test("goal crossing emits one match-owned goal event without a duplicate bounds event", () => {
  const result = stepBallState(createBallState({
    position: { x: 1, y: 400, z: 10 },
    previousPosition: { x: 1, y: 400, z: 10 },
    displacement: { x: -2, y: 0, z: 0 },
    still: 0,
  }));
  assert.equal(result.state.rng.calls, 0);
  assert.equal(result.state.inGoal, 1);
  assert.equal(result.state.outOfPlay, 0);
  assert.deepEqual(result.events.map(({ type, goalLine }) => ({ type, goalLine })), [
    { type: "goal", goalLine: "left" },
  ]);
});

test("in-goal continuation resolves source back, side, and top net surfaces", () => {
  const back = stepBallState(createBallState({
    position: { x: -27, y: 400, z: 2 },
    previousPosition: { x: -27, y: 400, z: 2 },
    displacement: { x: -4, y: 0, z: 0 },
    inGoal: 1,
    outOfPlay: 25,
    still: 0,
  }));
  assert.equal(back.state.position.x, f32(-27));
  assert.equal(back.state.displacement.x, f32(-f32(f32(0.965) * -4) / 2));
  assert.deepEqual(
    back.events.map(({ type, surface, goalLine }) => ({ type, surface, goalLine })),
    [{ type: "inside-net", surface: "back", goalLine: "left" }],
  );

  const sideAndTop = stepBallState(createBallState({
    position: { x: -10, y: 356, z: 35 },
    previousPosition: { x: -10, y: 356, z: 35 },
    displacement: { x: 0, y: -2, z: 1 },
    inAir: 1,
    inGoal: 1,
    outOfPlay: 25,
    still: 0,
  }));
  assert.equal(sideAndTop.state.position.y, f32(358));
  assert.equal(sideAndTop.state.position.z, f32(33));
  assert.equal(sideAndTop.state.displacement.z, f32(0));
  assert.deepEqual(
    sideAndTop.events.map(({ type, surface }) => ({ type, surface })),
    [
      { type: "inside-net", surface: "top-side" },
      { type: "inside-net", surface: "top" },
    ],
  );
});

test("pitch bounds captures the out-of-play position and source countdown", () => {
  const result = stepBallState(createBallState({
    position: { x: 500, y: 799, z: 2 },
    previousPosition: { x: 500, y: 799, z: 2 },
    displacement: { x: 0, y: 2, z: 0 },
    still: 0,
  }));
  assert.equal(result.state.outOfPlay, 25);
  assert.deepEqual(result.state.outPosition, result.state.position);
  assert.deepEqual(
    result.events.map(({ type, axis, boundary, line }) => ({ type, axis, boundary, line })),
    [{ type: "out-of-play", axis: "y", boundary: "maximum", line: 800 }],
  );
  assert.throws(
    () => stepBallState(result.state, { windEnabled: true }),
    /wind disabled/u,
  );
});

test("match-owned limbo holds the ball until the strict source contact crossing", () => {
  let state = createBallMatchState({
    ball: createBallState({
      displacement: { x: 1, y: 0, z: 0 },
      still: 0,
    }),
    limbo: createBallLimbo({ player: 1, contact: -0.5 }),
  });
  const held = stepBallMatchState(state, {
    limboPlayer: {
      player: 1,
      animationFrame: 0.1,
      animationStep: 0.2,
      animation: CSSOCCER_BALL_CONSTANTS.kickoutAnimation,
    },
  });
  assert.equal(held.state.ball.tick, 1);
  assert.deepEqual(held.state.ball.position, { x: f32(640), y: f32(400), z: f32(2) });
  assert.equal(held.state.limbo.active, 1);
  assert.deepEqual(held.events, []);

  state = held.state;
  const released = stepBallMatchState(state, {
    limboPlayer: {
      player: 1,
      animationFrame: 0.4,
      animationStep: 0.2,
      animation: CSSOCCER_BALL_CONSTANTS.kickoutAnimation,
    },
  });
  assert.equal(released.state.ball.tick, 2);
  assert.equal(released.state.ball.position.x, f32(641));
  assert.equal(released.state.limbo.active, 0);
  assert.deepEqual(released.events.map(({ type }) => type), [
    "ball-limbo-released",
    "ball-limbo-hard-kick",
  ]);
});

test("match-owned goal and boundary outcomes stop at later-owner seams", () => {
  const goal = stepBallMatchState(createBallMatchState({
    ball: createBallState({
      position: { x: 1, y: 400, z: 10 },
      previousPosition: { x: 1, y: 400, z: 10 },
      displacement: { x: -2, y: 0, z: 0 },
      still: 0,
    }),
  }));
  assert.equal(goal.state.ball.inGoal, 1);
  assert.equal(goal.state.ball.outOfPlay, 25);
  assert.deepEqual(goal.state.outcome, {
    kind: "goal",
    status: "requires-score-resolution",
    goalLine: "left",
    lastGoal: 2,
    crossing: { x: f32(0), y: f32(400), z: f32(10) },
  });
  const goalContinues = stepBallMatchState(goal.state);
  assert.equal(goalContinues.state.ball.outOfPlay, 25);
  assert.ok(goalContinues.state.ball.position.x < goal.state.ball.position.x);
  const goalCountdown = stepBallMatchState(goalContinues.state, {
    goalCountdownComplete: true,
  });
  assert.equal(goalCountdown.state.ball.outOfPlay, 24);
  assert.equal(goalCountdown.events.at(-1).type, "ball-post-goal-countdown");

  let boundary = stepBallMatchState(createBallMatchState({
    ball: createBallState({
      position: { x: 500, y: 799, z: 2 },
      previousPosition: { x: 500, y: 799, z: 2 },
      displacement: { x: 0, y: 2, z: 0 },
      still: 0,
    }),
  }));
  assert.equal(boundary.state.ball.outOfPlay, 25);
  assert.equal(boundary.state.outcome.kind, "boundary");
  for (let index = 0; index < 24; index += 1) {
    boundary = stepBallMatchState(boundary.state);
  }
  assert.equal(boundary.state.ball.outOfPlay, 1);
  assert.equal(boundary.state.outcome.status, "restart-required");
  assert.equal(boundary.events.at(-1).type, "ball-restart-required");
  assert.throws(
    () => stepBallMatchState(boundary.state),
    /later restart owner/u,
  );
});

test("native Watcom rand makes complete match runs byte-stable without evidence input", () => {
  const initial = createBallMatchState({
    ball: createBallState({
      position: { x: 1, y: 356, z: 10 },
      previousPosition: { x: 1, y: 356, z: 10 },
      displacement: { x: -2, y: 0, z: 0 },
      still: 0,
    }),
  });
  const first = runBallMatchScript(initial, [{}]);
  const second = runBallMatchScript(initial, [{}]);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.state.ball.rng.calls, 2);
  assert.deepEqual(first.frames[0].events.map(({ type }) => type), ["post"]);
});

test("native projection preserves retained field types and numeric bits", evidenceTestOptions, () => {
  const retained = readRetainedTickZero();
  const retainedById = new Map(retained.samples.map((sample) => [sample.fieldId, sample]));
  const value = (fieldId) => retainedById.get(fieldId).value;
  const state = createBallState({
    tick: 0,
    position: {
      x: value("ball.x"),
      y: value("ball.y"),
      z: value("ball.z"),
    },
    previousPosition: {
      x: value("ball.x"),
      y: value("ball.y"),
      z: value("ball.z"),
    },
    displacement: {
      x: value("ball.x_displacement"),
      y: value("ball.y_displacement"),
      z: value("ball.z_displacement"),
    },
    inAir: value("ball.in_air"),
    inGoal: value("ball.in_goal"),
    outOfPlay: value("ball.out_of_play"),
    speed: value("ball.speed"),
    still: value("ball.still"),
    spin: {
      nativeState: value("ball.spin_state"),
      swerve: 0,
      count: 0,
      fullXY: 0,
      fullZ: 0,
      xy: value("ball.spin_xy"),
      z: value("ball.spin_z"),
    },
    rng: {
      randSeed: value("rng.rand_seed"),
      seed: value("rng.seed"),
      calls: 0,
    },
  });
  const projection = projectBallNativeFields(state);
  const selected = new Set(CSSOCCER_NATIVE_BALL_FIELD_CONTRACT.map(({ fieldId }) => fieldId));
  const expected = retained.samples
    .filter(({ fieldId }) => selected.has(fieldId))
    .map(({ schema, recordType, tick, phase, fieldId, valueType, value: sample, numericBits }) => ({
      schema,
      recordType,
      tick,
      phase,
      fieldId,
      valueType,
      value: sample,
      numericBits,
    }));
  assert.deepEqual(projection, expected);
  const retainedTypes = new Map(retained.header.fields.map(({ id, valueType }) => [id, valueType]));
  for (const field of CSSOCCER_NATIVE_BALL_FIELD_CONTRACT) {
    assert.equal(field.valueType, retainedTypes.get(field.fieldId));
  }
  const negativeZero = projectBallNativeFields(createBallState({
    displacement: { x: -0, y: 0, z: 0 },
  })).find(({ fieldId }) => fieldId === "ball.x_displacement");
  assert.ok(Object.is(negativeZero.value, -0));
  assert.equal(negativeZero.numericBits, "80000000");
  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection[0]));
});

test("runtime ball modules reject unsupported state and import no evidence", () => {
  assert.throws(() => createBallState({ inHands: 1 }), /unsupported fields/u);
  assert.throws(
    () => createBallMatchState({ ball: createBallState({ outOfPlay: 1 }) }),
    /explicit match-owned outcome/u,
  );
  assert.throws(
    () => createBallState({ rng: { seed: 0, randSeed: 32768, calls: 0 } }),
    /randSeed/u,
  );
  for (const file of ["ballState.mjs", "ballMatchState.mjs", "fixedStep.mjs", "randomState.mjs"]) {
    const text = readFileSync(new URL(`../src/cssoccer/${file}`, import.meta.url), "utf8");
    const imports = [...text.matchAll(/from\s+["']([^"']+)["']/gu)]
      .map((match) => match[1]);
    assert.ok(imports.every((specifier) => (
      !specifier.includes(".local")
      && !specifier.includes("prepare")
      && !specifier.includes("oracle")
      && !specifier.startsWith("node:")
    )), `${file} must consume runtime plain data only`);
  }
});

function readRetainedTickZero() {
  const descriptor = openSync(retainedStateUrl, "r");
  try {
    const buffer = Buffer.alloc(2 * 1024 * 1024);
    const bytes = readSync(descriptor, buffer, 0, buffer.length, 0);
    const records = buffer.subarray(0, bytes).toString("utf8").split("\n");
    const header = JSON.parse(records.shift());
    const samples = [];
    for (const line of records) {
      if (line.length === 0) continue;
      const sample = JSON.parse(line);
      if (sample.tick !== 0) break;
      samples.push(sample);
    }
    assert.equal(header.recordType, "header");
    assert.equal(samples.length, header.fields.length);
    assert.equal(samples.length, 412);
    return { header, samples };
  } finally {
    closeSync(descriptor);
  }
}

function playCurrentKeeperOutcome(released, initialKeeper) {
  let ball = released.ball;
  let possession = released.possession;
  let keeper = structuredClone(initialKeeper);
  let plan = null;
  let animationFrame = f32(0);
  for (let tick = 0; tick < 80 && ball.outcome === null; tick += 1) {
    ball = stepBallMatchState(ball, {
      afterTouchInput: { x: f32(0), y: f32(0) },
    }).state;
    if (plan === null) {
      const candidate = planCssoccerKeeperSave({ ball, keeper });
      if (candidate.status === "save-path") plan = candidate;
      continue;
    }
    keeper = {
      ...keeper,
      position: {
        x: f32(keeper.position.x + plan.goDisplacement.x),
        y: f32(keeper.position.y + plan.goDisplacement.y),
        z: f32(0),
      },
    };
    animationFrame = f32(animationFrame + plan.frameStep);
    const contact = resolveCssoccerKeeperSaveContact({
      animationFrame,
      ball,
      goDisplacement: plan.goDisplacement,
      keeper,
      plan,
      possession,
    });
    if (contact.status === "resolved") return contact;
  }
  assert.fail("current keeper trajectory produced no contact outcome");
}

function livePassPossession(owner) {
  return createPossessionState({
    owner,
    lastTouch: owner,
    players: Array.from({ length: 22 }, (_, index) => {
      const nativePlayer = index + 1;
      const teamIndex = nativePlayer < 12 ? nativePlayer : nativePlayer - 11;
      const country = nativePlayer < 12 ? "spain" : "argentina";
      return {
        nativePlayer,
        stableId: `${country}-player-${String(teamIndex).padStart(2, "0")}`,
        possession: nativePlayer === owner ? 1 : 0,
      };
    }),
  });
}

function assertTypedBallState(state) {
  assert.ok(Number.isSafeInteger(state.tick));
  for (const vector of [state.position, state.previousPosition, state.displacement]) {
    for (const value of Object.values(vector)) assert.equal(value, f32(value));
  }
  if (state.outPosition !== null) {
    for (const value of Object.values(state.outPosition)) assert.equal(value, f32(value));
  }
  for (const key of ["fullXY", "fullZ", "xy", "z"]) {
    assert.equal(state.spin[key], f32(state.spin[key]));
  }
  for (const value of [
    state.inAir,
    state.inGoal,
    state.outOfPlay,
    state.still,
    state.speed,
    state.spin.swerve,
    state.spin.count,
    state.spin.nativeState,
    state.rng.seed,
    state.rng.randSeed,
    state.rng.calls,
    state.rng.state,
  ]) assert.ok(Number.isInteger(value));
  assert.equal(state.rng.schema, CSSOCCER_NATIVE_RNG_SCHEMA);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.position));
  assert.ok(Object.isFrozen(state.spin));
  assert.ok(Object.isFrozen(state.rng));
  assert.ok(Object.isFrozen(state.afterTouch));
  assert.ok(Object.isFrozen(state.afterTouch.shotDirection));
}

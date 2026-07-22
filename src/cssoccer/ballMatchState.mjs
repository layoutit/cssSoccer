import {
  CSSOCCER_BALL_CONSTANTS,
  createBallState,
  projectBallNativeFields,
  stepBallState,
} from "./ballState.mjs";

const f32 = Math.fround;

export const CSSOCCER_BALL_MATCH_STATE_SCHEMA = "cssoccer-ball-match-state@1";

const INACTIVE_LIMBO = Object.freeze({
  active: 0,
  player: 0,
  contact: f32(0),
});

export function createBallLimbo({ player, contact } = {}) {
  assertInt32(player, "ball limbo player");
  if (player < 1 || player > 22) {
    throw new RangeError("ball limbo player must be one of the 22 native match players.");
  }
  const sourceContact = sourceFloat(Math.abs(contact), "ball limbo contact");
  return Object.freeze({ active: 1, player, contact: sourceContact });
}

export function createBallMatchState(input = {}) {
  assertPlainObject(input, "ball match state input");
  assertOnlyKeys(input, ["schema", "ball", "limbo", "outcome"], "ball match state input");
  if (
    input.schema !== undefined
    && input.schema !== CSSOCCER_BALL_MATCH_STATE_SCHEMA
  ) {
    throw new Error(`Ball match state must use ${CSSOCCER_BALL_MATCH_STATE_SCHEMA}.`);
  }
  const ball = createBallState(input.ball ?? {});
  const limbo = createLimboState(input.limbo ?? INACTIVE_LIMBO);
  const outcome = createOutcome(input.outcome ?? null, ball);
  if (limbo.active !== 0 && outcome !== null) {
    throw new Error("Ball limbo cannot overlap an unresolved goal or boundary outcome.");
  }
  if (outcome === null && (ball.inGoal !== 0 || ball.outOfPlay !== 0)) {
    throw new Error("Unsupported ball state requires an explicit match-owned outcome.");
  }
  return deepFreeze({
    schema: CSSOCCER_BALL_MATCH_STATE_SCHEMA,
    ball,
    limbo,
    outcome,
  });
}

/**
 * Advance BALL.CPP process_ball without taking possession, contact, restart,
 * score, or lifecycle policy from their later owners.
 */
export function stepBallMatchState(
  state,
  { limboPlayer, afterTouchInput, goalCountdownComplete = false } = {},
) {
  const current = createBallMatchState(state);
  if (typeof goalCountdownComplete !== "boolean") {
    throw new TypeError("goalCountdownComplete must be a boolean.");
  }
  if (current.outcome?.status === "restart-required") {
    throw new Error("The boundary outcome requires the later restart owner before another ball tick.");
  }
  let ball = current.ball;
  let limbo = current.limbo;
  let outcome = current.outcome;
  const events = [];

  if (limbo.active !== 0) {
    const sample = createLimboPlayerSample(limboPlayer, limbo.player);
    const contactFrame = f32(sample.animationFrame + sample.animationStep);
    if (contactFrame > limbo.contact) {
      limbo = INACTIVE_LIMBO;
      events.push({
        type: "ball-limbo-released",
        player: sample.player,
        contact: current.limbo.contact,
        contactFrame,
      });
      if (sample.animation === CSSOCCER_BALL_CONSTANTS.kickoutAnimation) {
        events.push({
          type: "ball-limbo-hard-kick",
          player: sample.player,
          sourceAnimation: sample.animation,
        });
      }
    } else {
      ball = advanceUnprocessedBallTick(ball);
      return matchResult(ball, limbo, outcome, events);
    }
  } else if (limboPlayer !== undefined) {
    throw new Error("A limbo player sample is unsupported while ball limbo is inactive.");
  }

  const enteredOutOfPlay = ball.outOfPlay !== 0;
  const physical = stepBallState(ball, {
    afterTouchInput,
  });
  ball = physical.state;
  events.push(...physical.events);

  if (!enteredOutOfPlay) {
    const goal = physical.events.find(({ type }) => type === "goal");
    const boundary = physical.events.find(({ type }) => type === "out-of-play");
    if (goal) {
      ball = createBallState({
        ...ball,
        outOfPlay: CSSOCCER_BALL_CONSTANTS.outOfPlayTicks,
      });
      outcome = createOutcome({
        kind: "goal",
        status: "requires-score-resolution",
        goalLine: goal.goalLine,
        lastGoal: goal.goalLine === "left" ? 2 : 1,
        crossing: goal.crossing,
      }, ball);
      events.push({
        type: "ball-goal-outcome",
        goalLine: outcome.goalLine,
        lastGoal: outcome.lastGoal,
        requiresScoreResolution: true,
      });
    } else if (boundary) {
      outcome = createOutcome({
        kind: "boundary",
        status: "countdown",
        axis: boundary.axis,
        boundary: boundary.boundary,
        line: boundary.line,
        position: boundary.position,
      }, ball);
      events.push({
        type: "ball-boundary-outcome",
        axis: outcome.axis,
        boundary: outcome.boundary,
        line: outcome.line,
        requiresBoundsRule: true,
      });
    }
  } else if (outcome?.kind === "boundary") {
    const outOfPlay = ball.outOfPlay - 1;
    ball = createBallState({ ...ball, outOfPlay });
    outcome = createOutcome({
      ...outcome,
      status: outOfPlay === 1 ? "restart-required" : "countdown",
    }, ball);
    if (outOfPlay === 1) {
      events.push({
        type: "ball-restart-required",
        outcome: "boundary",
        requiresRestartPolicy: true,
        beforeNextTick: true,
      });
    }
  } else if (outcome?.kind === "swap-ends") {
    // BALL.CPP process_ball keeps consuming ball_out_of_play while
    // RULES.CPP SWAP_ENDS suppresses the later respot_ball owner.
    if (ball.outOfPlay > 0) {
      ball = createBallState({ ...ball, outOfPlay: ball.outOfPlay - 1 });
      events.push({
        type: "ball-swap-ends-countdown",
        outOfPlay: ball.outOfPlay,
      });
    }
  } else if (
    outcome?.kind === "goal"
    && goalCountdownComplete
    && ball.outOfPlay > 1
  ) {
    ball = createBallState({ ...ball, outOfPlay: ball.outOfPlay - 1 });
    events.push({
      type: "ball-post-goal-countdown",
      outOfPlay: ball.outOfPlay,
    });
  } else if (
    outcome?.kind === "goal"
    && goalCountdownComplete
    && ball.outOfPlay === 1
  ) {
    // BALL.CPP respots only when this tick's pre-decrement changes 1 to 0.
    // Keep the typed goal ball intact until the later rules owner performs
    // reset_ball/init_match_mode in the same logical tick.
    events.push({
      type: "ball-post-goal-respot-required",
      outOfPlay: 0,
    });
  }

  return matchResult(ball, limbo, outcome, events);
}

export function runBallMatchScript(
  initialState,
  script,
) {
  if (!Array.isArray(script)) {
    throw new TypeError("ball match script must be an array.");
  }
  let state = createBallMatchState(initialState);
  const frames = [];
  for (let index = 0; index < script.length; index += 1) {
    const entry = script[index];
    assertPlainObject(entry, `ball match script[${index}]`);
    assertOnlyKeys(
      entry,
      ["limboPlayer", "afterTouchInput", "goalCountdownComplete"],
      `ball match script[${index}]`,
    );
    const result = stepBallMatchState(state, entry);
    state = result.state;
    frames.push({
      tick: state.ball.tick,
      events: result.events,
      nativeFields: projectBallNativeFields(state.ball),
    });
  }
  return deepFreeze({
    schema: "cssoccer-ball-match-script-result@1",
    state,
    frames,
  });
}

function createLimboState(input) {
  assertPlainObject(input, "ball limbo state");
  assertOnlyKeys(input, ["active", "player", "contact"], "ball limbo state");
  const active = input.active ?? 0;
  assertFlag(active, "ball limbo active");
  if (active === 0) {
    if ((input.player ?? 0) !== 0 || (input.contact ?? 0) !== 0) {
      throw new Error("Inactive ball limbo cannot retain player/contact state.");
    }
    return INACTIVE_LIMBO;
  }
  return createBallLimbo({ player: input.player, contact: input.contact });
}

function createLimboPlayerSample(input, expectedPlayer) {
  assertPlainObject(input, "ball limbo player sample");
  assertOnlyKeys(
    input,
    ["player", "animationFrame", "animationStep", "animation"],
    "ball limbo player sample",
  );
  assertInt32(input.player, "ball limbo player sample.player");
  if (input.player !== expectedPlayer) {
    throw new Error(`Ball limbo requires native player ${expectedPlayer}.`);
  }
  assertInt32(input.animation, "ball limbo player sample.animation");
  return Object.freeze({
    player: input.player,
    animationFrame: sourceFloat(
      input.animationFrame,
      "ball limbo player sample.animationFrame",
    ),
    animationStep: sourceFloat(
      input.animationStep,
      "ball limbo player sample.animationStep",
    ),
    animation: input.animation,
  });
}

function createOutcome(input, ball) {
  if (input === null) return null;
  assertPlainObject(input, "ball match outcome");
  if (input.kind === "goal") {
    assertOnlyKeys(
      input,
      ["kind", "status", "goalLine", "lastGoal", "crossing"],
      "goal outcome",
    );
    const goalLine = requireGoalLine(input.goalLine);
    const lastGoal = goalLine === "left" ? 2 : 1;
    if (
      input.status !== "requires-score-resolution"
      || input.lastGoal !== lastGoal
      || ball.inGoal !== 1
      || ball.outOfPlay < 1
      || ball.outOfPlay > CSSOCCER_BALL_CONSTANTS.outOfPlayTicks
    ) {
      throw new Error("Goal outcome does not match the source ball state contract.");
    }
    return deepFreeze({
      kind: "goal",
      status: input.status,
      goalLine,
      lastGoal,
      crossing: createVector(input.crossing, "goal outcome crossing"),
    });
  }
  if (input.kind === "boundary") {
    assertOnlyKeys(
      input,
      ["kind", "status", "axis", "boundary", "line", "position"],
      "boundary outcome",
    );
    if (ball.inGoal !== 0) {
      throw new Error("Boundary outcome cannot own a ball already in goal.");
    }
    if (ball.outOfPlay < 1) {
      throw new Error("Boundary outcome cannot publish the unsupported native respot tick.");
    }
    const expectedStatus = ball.outOfPlay === 1 ? "restart-required" : "countdown";
    if (input.status !== expectedStatus) {
      throw new Error(`Boundary outcome must use ${expectedStatus}.`);
    }
    const axis = input.axis;
    const boundary = input.boundary;
    if (!['x', 'y'].includes(axis) || !['minimum', 'maximum'].includes(boundary)) {
      throw new Error("Boundary outcome axis/direction is invalid.");
    }
    const expectedLine = axis === "x"
      ? (boundary === "minimum" ? 0 : CSSOCCER_BALL_CONSTANTS.pitchLength)
      : (boundary === "minimum" ? 0 : CSSOCCER_BALL_CONSTANTS.pitchWidth);
    if (input.line !== expectedLine) {
      throw new Error("Boundary outcome line does not match the fixed pitch.");
    }
    const position = createVector(input.position, "boundary outcome position");
    if (ball.outPosition === null || !sameVector(position, ball.outPosition)) {
      throw new Error("Boundary outcome position does not match ball_out coordinates.");
    }
    return deepFreeze({
      kind: "boundary",
      status: input.status,
      axis,
      boundary,
      line: expectedLine,
      position,
    });
  }
  if (input.kind === "swap-ends") {
    assertOnlyKeys(input, ["kind", "status"], "swap-ends outcome");
    if (input.status !== "halftime" || ball.inGoal !== 0) {
      throw new Error("Swap-ends outcome does not match the halted source ball state.");
    }
    return deepFreeze({ kind: "swap-ends", status: "halftime" });
  }
  throw new Error("Ball match outcome kind must be goal, boundary, or swap-ends.");
}

function advanceUnprocessedBallTick(ball) {
  return createBallState({ ...ball, tick: ball.tick + 1 });
}

function matchResult(ball, limbo, outcome, events) {
  return Object.freeze({
    state: createBallMatchState({ ball, limbo, outcome }),
    events: deepFreeze(events),
  });
}

function requireGoalLine(value) {
  if (value !== "left" && value !== "right") {
    throw new Error("Goal outcome goalLine must be left or right.");
  }
  return value;
}

function createVector(input, label) {
  assertPlainObject(input, label);
  assertOnlyKeys(input, ["x", "y", "z"], label);
  return Object.freeze({
    x: sourceFloat(input.x, `${label}.x`),
    y: sourceFloat(input.y, `${label}.y`),
    z: sourceFloat(input.z, `${label}.z`),
  });
}

function sameVector(left, right) {
  return Object.is(left.x, right.x)
    && Object.is(left.y, right.y)
    && Object.is(left.z, right.z);
}

function sourceFloat(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return f32(value);
}

function assertFlag(value, label) {
  if (value !== 0 && value !== 1) throw new TypeError(`${label} must be 0 or 1.`);
}

function assertInt32(value, label) {
  if (!Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff) {
    throw new TypeError(`${label} must be a signed 32-bit integer.`);
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

function assertOnlyKeys(value, keys, label) {
  const allowed = new Set(keys);
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    throw new Error(`${label} has unsupported fields: ${unsupported.join(", ")}.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

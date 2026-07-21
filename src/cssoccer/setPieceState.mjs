import {
  CSSOCCER_RESTART_CONSTANTS,
  CSSOCCER_RESTART_STATE_SCHEMA,
  assertCssoccerRestartState,
} from "./restartState.mjs";

export const CSSOCCER_SET_PIECE_STATE_SCHEMA = "cssoccer-set-piece-state@1";

export const CSSOCCER_SET_PIECE_SOURCE = deepFreeze({
  files: [
    {
      file: "RULES.CPP",
      sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
      producers: ["await_set_kick", "await_throw", "decide_set_kick", "ready_set_kick"],
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: ["init_pickup_act", "pickup_action", "init_throw_act", "throw_action"],
    },
  ],
  decisionBoundary: "pass, shot, punt, and throw launch decisions are parent-owned",
  waitFallback: "RULES.CPP all_standing forces readiness when setp_wait_cnt reaches zero",
});

export function createCssoccerSetPieceState(restart) {
  assertCssoccerRestartState(restart);
  return deepFreeze({
    schema: CSSOCCER_SET_PIECE_STATE_SCHEMA,
    status: "restart-active",
    kind: restart.kind,
    mode: restart.mode,
    phase: "awaiting-position",
    taker: {
      nativePlayerNumber: restart.taker.nativePlayerNumber,
      nativeTeamSlot: restart.taker.nativeTeamSlot,
    },
    rules: {
      matchMode: restart.rules.matchMode,
      deadBallCount: restart.rules.deadBallCount,
      gameAction: restart.rules.gameAction,
      setPiece: restart.rules.setPiece,
      alreadyThere: restart.rules.alreadyThere,
      support: restart.rules.support,
      userTaker: restart.rules.userTaker,
    },
    clock: { stopClock: restart.clock.stopClock },
    ball: {
      inHands: restart.ball.inHands,
      possession: restart.ball.possession,
    },
    positionWait: restart.kind === "throw-in" ? null : {
      remainingTicks: restart.rules.setPieceWaitCount,
      forcedStanding: 0,
    },
    takerLeave: 0,
    actionRequest: null,
  });
}

/**
 * Advance one explicit source action phase. This reducer never chooses a pass,
 * shot, punt, or throw trajectory; those decisions cross the parent seam.
 */
export function advanceCssoccerSetPiece(state, event) {
  assertCssoccerSetPieceState(state);
  requirePlainObject(event, "set-piece event");
  if (state.phase === "released-to-action") {
    throw new Error("released set-piece state is terminal; the parent action reducer owns play.");
  }

  if (event.type === "readiness") return observeReadiness(state, event);
  if (event.type === "pickup-complete") return completeThrowPickup(state, event);
  if (event.type === "decision") return releaseDecision(state, event);
  throw new Error(`Unsupported set-piece event ${String(event.type)}.`);
}

export function assertCssoccerSetPieceState(state) {
  requirePlainObject(state, "set-piece state");
  if (state.schema !== CSSOCCER_SET_PIECE_STATE_SCHEMA) {
    throw new Error(`set-piece state must use ${CSSOCCER_SET_PIECE_STATE_SCHEMA}.`);
  }
  if (!["corner", "goal-kick", "throw-in"].includes(state.kind)) {
    throw new Error("set-piece state has an unsupported restart kind.");
  }
  if (!["awaiting-position", "awaiting-pickup", "awaiting-decision", "released-to-action"].includes(state.phase)) {
    throw new Error("set-piece state has an unsupported phase.");
  }
  requirePlayerNumber(state.taker?.nativePlayerNumber, "set-piece taker");
  requireTeamSlot(state.taker?.nativeTeamSlot, "set-piece taker slot");
  requirePlainObject(state.rules, "set-piece rules");
  requirePlainObject(state.clock, "set-piece clock");
  requirePlainObject(state.ball, "set-piece ball");
  if (state.kind === "throw-in") {
    if (state.positionWait !== null) {
      throw new Error("throw-in state must not consume the set-kick standing timeout.");
    }
  } else {
    requirePlainObject(state.positionWait, "set-piece positionWait");
    requireIntegerRange(
      state.positionWait.remainingTicks,
      0,
      CSSOCCER_RESTART_CONSTANTS.setPieceWaitTicks,
      "set-piece remaining wait ticks",
    );
    requireFlag(state.positionWait.forcedStanding, "set-piece forcedStanding");
    if ((state.positionWait.remainingTicks === 0) !== (state.positionWait.forcedStanding === 1)) {
      throw new Error("set-piece standing timeout and forced flag diverged.");
    }
  }
  return state;
}

function observeReadiness(state, event) {
  if (state.phase !== "awaiting-position") {
    throw new Error("readiness is accepted only while awaiting the taker position.");
  }
  requireExactKeys(
    event,
    state.kind === "throw-in"
      ? ["type", "alreadyThere", "playerOnOff", "takerDistanceToIncident", "ballInHands"]
      : ["type", "alreadyThere", "playerOnOff", "allStanding", "support", "holdUpPlay"],
    "readiness event",
  );
  requireFlag(event.alreadyThere, "alreadyThere");
  requireFlag(event.playerOnOff, "playerOnOff");

  if (state.kind === "throw-in") {
    requireFlag(event.ballInHands, "ballInHands");
    if (!Number.isFinite(event.takerDistanceToIncident) || event.takerDistanceToIncident < 0) {
      throw new TypeError("takerDistanceToIncident must be a non-negative finite number.");
    }
    const ready = event.alreadyThere === 1
      && event.playerOnOff === 0
      && event.takerDistanceToIncident < CSSOCCER_RESTART_CONSTANTS.pitchRatio * 3;
    if (!ready) return withObservedFlags(state, event.alreadyThere, state.rules.support);
    if (event.ballInHands === 1) return enterThrowDecision(state);
    return transition(state, {
      phase: "awaiting-pickup",
      rules: { ...state.rules, alreadyThere: 1 },
      actionRequest: {
        type: "start-pickup",
        nativePlayerNumber: state.taker.nativePlayerNumber,
      },
    });
  }

  requireFlag(event.allStanding, "allStanding");
  requireFlag(event.support, "support");
  if (!Number.isSafeInteger(event.holdUpPlay) || event.holdUpPlay < 0) {
    throw new TypeError("holdUpPlay must be a non-negative integer.");
  }
  const positionWait = advancePositionWait(state.positionWait, event);
  const allStanding = event.allStanding === 1 || positionWait.forcedStanding === 1;
  const ready = event.holdUpPlay === 0 && (
    (event.playerOnOff === 0 && allStanding && event.alreadyThere === 1)
    || event.support === 1
  );
  if (!ready) return withObservedFlags(state, event.alreadyThere, event.support, positionWait);
  return transition(state, {
    phase: "awaiting-decision",
    rules: { ...state.rules, alreadyThere: event.alreadyThere, support: event.support },
    ball: { ...state.ball, possession: state.taker.nativePlayerNumber },
    positionWait,
    actionRequest: externalDecisionRequest(state),
  });
}

function advancePositionWait(positionWait, event) {
  if (
    event.holdUpPlay !== 0
    || event.playerOnOff !== 0
    || positionWait.forcedStanding === 1
  ) {
    return clone(positionWait);
  }
  const remainingTicks = positionWait.remainingTicks - 1;
  return {
    remainingTicks,
    forcedStanding: remainingTicks === 0 ? 1 : 0,
  };
}

function completeThrowPickup(state, event) {
  requireExactKeys(event, ["type"], "pickup-complete event");
  if (state.kind !== "throw-in" || state.phase !== "awaiting-pickup") {
    throw new Error("pickup-complete is accepted only for a throw awaiting pickup.");
  }
  return enterThrowDecision(state);
}

function enterThrowDecision(state) {
  return transition(state, {
    phase: "awaiting-decision",
    rules: { ...state.rules, matchMode: 0, alreadyThere: 1 },
    ball: {
      inHands: 1,
      possession: state.taker.nativePlayerNumber,
    },
    takerLeave: -1,
    actionRequest: {
      type: "start-throw-action",
      nativePlayerNumber: state.taker.nativePlayerNumber,
      next: externalDecisionRequest(state),
    },
  });
}

function releaseDecision(state, event) {
  if (state.phase !== "awaiting-decision") {
    throw new Error("a set-piece decision is accepted only after source readiness.");
  }
  const action = requireDecision(state, event);
  return transition(state, {
    status: "normal-play-action-pending",
    phase: "released-to-action",
    rules: {
      ...state.rules,
      matchMode: 0,
      deadBallCount: 0,
      gameAction: 0,
      setPiece: 0,
      alreadyThere: 0,
      support: 0,
      userTaker: 0,
    },
    clock: { stopClock: 0 },
    takerLeave: -1,
    actionRequest: action,
  });
}

function requireDecision(state, event) {
  if (state.kind === "corner") {
    if (event.action === "shot") {
      requireExactKeys(event, ["type", "action"], "corner shot decision");
      return actionRequest("shot", state);
    }
    if (event.action === "pass") return passRequest(state, event, false);
    throw new Error("corner decision must be pass or shot.");
  }
  if (state.kind === "goal-kick") {
    if (event.action === "punt") {
      requireExactKeys(event, ["type", "action"], "goal-kick punt decision");
      return actionRequest("punt", state);
    }
    if (event.action === "pass") return passRequest(state, event, true);
    throw new Error("goal-kick decision must be pass or punt.");
  }
  if (event.action === "throw") {
    requireExactKeys(event, ["type", "action"], "throw decision");
    return actionRequest("throw", state);
  }
  if (event.action === "pass") return passRequest(state, event, false);
  throw new Error("throw-in decision must be pass or throw.");
}

function passRequest(state, event, excludeKeepers) {
  requireExactKeys(event, ["type", "action", "targetPlayerNumber"], "pass decision");
  requirePlayerNumber(event.targetPlayerNumber, "pass targetPlayerNumber");
  const inTeam = state.taker.nativeTeamSlot === "A"
    ? event.targetPlayerNumber <= 11
    : event.targetPlayerNumber >= 12;
  if (!inTeam || event.targetPlayerNumber === state.taker.nativePlayerNumber) {
    throw new Error("pass target must be another player in the taker's native team slot.");
  }
  if (excludeKeepers && (event.targetPlayerNumber === 1 || event.targetPlayerNumber === 12)) {
    throw new Error("goal-kick pass target cannot be either native keeper.");
  }
  return deepFreeze({
    ...actionRequest("pass", state),
    targetPlayerNumber: event.targetPlayerNumber,
  });
}

function actionRequest(type, state) {
  return deepFreeze({
    type,
    nativePlayerNumber: state.taker.nativePlayerNumber,
    launch: "parent-owned",
  });
}

function externalDecisionRequest(state) {
  const allowedActions = state.kind === "corner"
    ? ["pass", "shot"]
    : state.kind === "goal-kick"
      ? ["pass", "punt"]
      : ["pass", "throw"];
  return deepFreeze({
    type: "request-external-decision",
    nativePlayerNumber: state.taker.nativePlayerNumber,
    allowedActions,
  });
}

function withObservedFlags(state, alreadyThere, support, positionWait = state.positionWait) {
  return transition(state, {
    rules: { ...state.rules, alreadyThere, support },
    positionWait,
    actionRequest: null,
  });
}

function transition(state, patch) {
  return deepFreeze({
    ...clone(state),
    ...clone(patch),
    schema: CSSOCCER_SET_PIECE_STATE_SCHEMA,
  });
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function requireFlag(value, label) {
  if (value !== 0 && value !== 1) throw new TypeError(`${label} must be 0 or 1.`);
}

function requirePlayerNumber(value, label) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 22) {
    throw new TypeError(`${label} must be a native player number in 1..22.`);
  }
}

function requireTeamSlot(value, label) {
  if (value !== "A" && value !== "B") throw new Error(`${label} must be A or B.`);
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
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
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

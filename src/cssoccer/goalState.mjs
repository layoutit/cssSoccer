import {
  CSSOCCER_MATCH_MODE,
} from "./boundaryState.mjs";
import {
  createBallMatchState,
} from "./ballMatchState.mjs";
import {
  assertCssoccerMatchLifecycle,
} from "./matchLifecycle.mjs";
import {
  CSSOCCER_SCORE_NATIVE_BINDINGS,
  CSSOCCER_SCORE_SOURCE,
  assertCssoccerScoreState,
  awardCssoccerGoal,
  createCssoccerScoreState,
  resetCssoccerScoreState,
} from "./scoreState.mjs";

export const CSSOCCER_GOAL_STATE_SCHEMA = "cssoccer-goal-state@1";

export const CSSOCCER_GOAL_CONSTANTS = Object.freeze({
  justScoredTicks: 220,
});

export const CSSOCCER_GOAL_NATIVE_BINDINGS =
  CSSOCCER_SCORE_NATIVE_BINDINGS;

export const CSSOCCER_GOAL_SOURCE = deepFreeze({
  files: [
    {
      file: "BALL.CPP",
      sha256: "7d043a49395d3f5bd039188b8100dd40142e075aebf2fbe8fd2517c5a9e9bd99",
      producers: ["go_right_goal", "go_left_goal", "good_goal", "own_goal", "process_ball"],
    },
    {
      file: "FOOTBALL.CPP",
      sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
      producers: ["init_match", "watch_match_time"],
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: ["someone_has_scored", "goal celebration actions"],
    },
  ],
  qualifiedConstants: {
    SCORE_WAIT: {
      value: CSSOCCER_GOAL_CONSTANTS.justScoredTicks,
      evidence: "pinned canonical typed goal window",
    },
  },
  retainedQualification: {
    classification: "output-only-never-runtime-input",
    bindings: CSSOCCER_GOAL_NATIVE_BINDINGS,
  },
  ownership: {
    crossing: "ballMatchState",
    score: "scoreState and goal-awarded lifecycle event",
    countdownAndAttribution: "goalState",
    centreExecution: "kickoff owner",
    postGoalBallCountdown: "ball owner",
  },
});

export const CSSOCCER_GOAL_NATIVE_FIELD_CONTRACT = deepFreeze([
  { fieldId: "score.goal_scorer", valueType: "i32" },
  { fieldId: "score.just_scored", valueType: "i32" },
  { fieldId: "score.team_a", valueType: "i32" },
  { fieldId: "score.team_b", valueType: "i32" },
  { fieldId: "rules.dead_ball_count", valueType: "i32" },
  { fieldId: "rules.game_action", valueType: "i16" },
  { fieldId: "rules.match_mode", valueType: "u8" },
]);

export class CssoccerUnsupportedGoalAttributionError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedGoalAttributionError";
    this.code = code;
    this.detail = deepFreeze(clone(detail));
  }
}

export function createCssoccerGoalState(options = {}) {
  requirePlainObject(options, "goal state options");
  requireExactKeys(options, Object.hasOwn(options, "score") ? ["score"] : [], "goal state options");
  const score = options.score ?? createCssoccerScoreState();
  assertCssoccerScoreState(score);
  return liveState(score, 0);
}

/**
 * Resolve a goal already qualified by ballMatchState. This function awards the
 * accepted score state and emits, but does not execute, the lifecycle event.
 */
export function resolveCssoccerQualifiedGoal(state, {
  ballMatchState,
  lifecycle,
  lastTouch,
  preKeeperTouch,
} = {}) {
  const current = assertCssoccerGoalState(state);
  const match = assertCssoccerMatchLifecycle(lifecycle);
  return resolveQualifiedGoal(current, {
    ballMatchState,
    score: match.score,
    terminal: match.clock.terminal,
    liveClockActive: match.clock.liveClockActive,
    lastTouch,
    preKeeperTouch,
    countryForNativeSlot: (slot) => countryForNativeSlot(match, slot),
    stablePlayerForNativeNumber: (nativePlayerNumber) => (
      stablePlayerForNativeNumber(match, nativePlayerNumber)
    ),
  });
}

/**
 * Resolve the same BALL.CPP goal outcome from the current free-play match.
 * This path accepts only live browser-owned state; no lifecycle replay or
 * retained capture can supply attribution, score, or native-slot ownership.
 */
export function resolveCssoccerCurrentQualifiedGoal(state, {
  ballMatchState,
  match,
  lastTouch,
  preKeeperTouch,
} = {}) {
  const current = assertCssoccerGoalState(state);
  requirePlainObject(match, "current goal match");
  assertCssoccerScoreState(match.score);
  if (!Array.isArray(match.players) || match.players.length !== 22) {
    throw new Error("Current goal resolution requires the 22 live match players.");
  }
  requirePlainObject(match.clock, "current goal clock");
  requirePlainObject(match.rules, "current goal rules");
  const terminal = match.clock.terminal === true;
  const liveClockActive = match.clock.running === true
    && match.rules.matchMode === 0
    && match.kickoff?.phase === "open-play";
  const countryBySlot = currentCountryByNativeSlot(match.players);
  return resolveQualifiedGoal(current, {
    ballMatchState,
    score: match.score,
    terminal,
    liveClockActive,
    lastTouch,
    preKeeperTouch,
    countryForNativeSlot: (slot) => countryBySlot[slot],
    stablePlayerForNativeNumber: (nativePlayerNumber) => {
      const player = match.players.find(
        (candidate) => candidate.nativePlayerNumber === nativePlayerNumber,
      );
      if (!player || (player.country !== "spain" && player.country !== "argentina")) {
        throw new Error(`Current match has no stable player for native number ${nativePlayerNumber}.`);
      }
      return { id: player.id, country: player.country };
    },
  });
}

function resolveQualifiedGoal(current, {
  ballMatchState,
  score: acceptedScore,
  terminal,
  liveClockActive,
  lastTouch,
  preKeeperTouch,
  countryForNativeSlot: resolveCountry,
  stablePlayerForNativeNumber: resolvePlayer,
}) {
  if (current.phase !== "normal-play") {
    throw new Error("A qualified goal cannot overlap an active post-goal sequence.");
  }
  if (terminal || !liveClockActive) {
    throw new Error("A qualified normal-time goal requires the live fixed-match lifecycle.");
  }
  if (!sameValue(current.score, acceptedScore)) {
    throw new Error("Goal state score must match the lifecycle before an award.");
  }
  const ball = createBallMatchState(ballMatchState);
  if (ball.outcome?.kind !== "goal" || ball.outcome.status !== "requires-score-resolution") {
    throw new Error("Goal resolution requires an already-qualified ball goal outcome.");
  }
  requirePlayerNumber(lastTouch, "goal lastTouch", "missing-last-touch");
  if (preKeeperTouch !== undefined) {
    requirePlayerNumber(preKeeperTouch, "goal preKeeperTouch", "invalid-pre-keeper-touch");
  }

  const goalLine = ball.outcome.goalLine;
  const nativeScoringSlot = goalLine === "right" ? "A" : "B";
  const defendingKeeper = goalLine === "right" ? 12 : 1;
  const scoringCountry = resolveCountry(nativeScoringSlot);
  if (scoringCountry !== "spain" && scoringCountry !== "argentina") {
    throw new Error(`Current match has no stable country in native team slot ${nativeScoringSlot}.`);
  }
  const sourceScoreSlot = sourceScoreSlotFor(scoringCountry);
  let goalScorerNative = lastTouch;
  let ownGoal = nativeTeamFor(lastTouch) !== nativeScoringSlot;
  let creditSource = "last-touch";

  if (lastTouch === defendingKeeper) {
    if (preKeeperTouch === undefined) {
      throw new CssoccerUnsupportedGoalAttributionError(
        "missing-pre-keeper-touch",
        "A defending-keeper goal requires the checked pre_kp_touch player.",
        { goalLine, lastTouch },
      );
    }
    if (nativeTeamFor(preKeeperTouch) === nativeScoringSlot) {
      goalScorerNative = preKeeperTouch;
      ownGoal = false;
      creditSource = "pre-keeper-touch";
    } else {
      goalScorerNative = lastTouch;
      ownGoal = true;
      creditSource = "defending-keeper-own-goal";
    }
  }

  const scorer = resolvePlayer(goalScorerNative);
  const lastTouchPlayer = resolvePlayer(lastTouch);
  if ((scorer.country !== scoringCountry) !== ownGoal) {
    throw new Error("Stable scorer identity diverged from source own-goal attribution.");
  }
  const score = awardCssoccerGoal(current.score, { country: scoringCountry });
  const activeGoal = deepFreeze({
    goalLine,
    lastGoal: ball.outcome.lastGoal,
    nativeScoringSlot,
    scoringCountry,
    sourceScoreSlot,
    lastTouch: {
      nativePlayerNumber: lastTouch,
      playerId: lastTouchPlayer.id,
      country: lastTouchPlayer.country,
    },
    preKeeperTouch: preKeeperTouch ?? null,
    goalScorerNative,
    scorer: {
      playerId: scorer.id,
      country: scorer.country,
      nativePlayerNumber: goalScorerNative,
    },
    ownGoal,
    creditSource,
  });

  return deepFreeze({
    schema: CSSOCCER_GOAL_STATE_SCHEMA,
    source: CSSOCCER_GOAL_SOURCE,
    phase: "celebration",
    score,
    goalSequence: current.goalSequence + 1,
    lastGoalScorerNative: goalScorerNative,
    justScored: CSSOCCER_GOAL_CONSTANTS.justScoredTicks,
    elapsedCelebrationTicks: 0,
    activeGoal,
    deadBall: {
      active: 1,
      reason: "goal",
      matchMode: 0,
      deadBallCount: 0,
      gameAction: 0,
      ballStateOwner: "ballMatchState",
    },
    celebration: {
      active: 1,
      scorerPlayerId: scorer.id,
      scoringCountry,
      shamedPlayerNative: ownGoal ? goalScorerNative : 0,
      actionOwner: "player-action-reducer",
    },
    lifecycleEvent: {
      type: "goal-awarded",
      country: scoringCountry,
    },
    centreHandoff: null,
    lifecycleHandoff: null,
    terminalResult: null,
  });
}

/** Bind a completed current-state goal to its source centre owner. */
export function resolveCssoccerCurrentPostGoalHandoff(state, { match } = {}) {
  const current = assertCssoccerGoalState(state);
  if (current.phase !== "awaiting-post-goal-handoff") {
    throw new Error("Post-goal handoff requires the completed just_scored countdown.");
  }
  requirePlainObject(match, "current post-goal match");
  assertCssoccerScoreState(match.score);
  if (!sameValue(current.score, match.score)) {
    throw new Error("Post-goal current match must contain the emitted goal award.");
  }
  if (match.clock?.terminal === true) {
    throw new Error("Current free play cannot create a centre after full time.");
  }
  const countryBySlot = currentCountryByNativeSlot(match.players);
  const nativeTeamSlot = current.activeGoal.lastGoal === 1 ? "B" : "A";
  const mode = nativeTeamSlot === "A" ? "CENTRE_A" : "CENTRE_B";
  return deepFreeze({
    ...clone(current),
    phase: "centre-handoff-required",
    centreHandoff: {
      type: "centre-restart-required",
      mode,
      matchMode: CSSOCCER_MATCH_MODE[mode],
      nativeTeamSlot,
      country: countryBySlot[nativeTeamSlot],
      executionOwner: "kickoff-reducer",
    },
    lifecycleHandoff: null,
    terminalResult: null,
  });
}

/** Clear only the accepted current centre handoff while retaining score/scorer. */
export function resumeCssoccerCurrentGoalState(state, { score } = {}) {
  const current = assertCssoccerGoalState(state);
  if (current.phase !== "centre-handoff-required") {
    throw new Error("Current goal state can resume only after its centre handoff is accepted.");
  }
  assertCssoccerScoreState(score);
  if (!sameValue(current.score, score)) {
    throw new Error("Resumed current goal score must match the live match.");
  }
  return liveState(score, current.goalSequence, current.lastGoalScorerNative);
}

/** Decrement exactly one BALL.CPP just_scored tick; ball motion remains external. */
export function stepCssoccerGoalCountdown(state) {
  const current = assertCssoccerGoalState(state);
  if (current.phase !== "celebration" || current.justScored < 1) {
    throw new Error("Goal countdown can advance only during active celebration.");
  }
  const justScored = current.justScored - 1;
  return deepFreeze({
    ...clone(current),
    phase: justScored === 0 ? "awaiting-post-goal-handoff" : "celebration",
    justScored,
    elapsedCelebrationTicks: current.elapsedCelebrationTicks + 1,
    celebration: {
      ...clone(current.celebration),
      active: justScored === 0 ? 0 : 1,
    },
  });
}

/**
 * Called only when the ball owner finishes its own post-goal handling. A live
 * lifecycle receives a centre descriptor; terminal lifecycle state is kept.
 */
export function resolveCssoccerPostGoalHandoff(state, { lifecycle } = {}) {
  const current = assertCssoccerGoalState(state);
  if (current.phase !== "awaiting-post-goal-handoff") {
    throw new Error("Post-goal handoff requires the completed just_scored countdown.");
  }
  const match = assertCssoccerMatchLifecycle(lifecycle);
  if (!sameValue(current.score, match.score)) {
    throw new Error("Post-goal lifecycle must contain the emitted goal award.");
  }
  if (match.clock.terminal) {
    return deepFreeze({
      ...clone(current),
      phase: "terminal-preserved",
      centreHandoff: null,
      lifecycleHandoff: null,
      terminalResult: clone(match.result),
    });
  }
  if (!match.clock.liveClockActive) {
    return deepFreeze({
      ...clone(current),
      phase: "lifecycle-handoff-required",
      centreHandoff: null,
      lifecycleHandoff: {
        type: "match-lifecycle-transition-required",
        phase: match.clock.phase,
        matchHalf: match.clock.matchHalf,
        executionOwner: "match-lifecycle",
      },
      terminalResult: null,
    });
  }
  const nativeTeamSlot = current.activeGoal.lastGoal === 1 ? "B" : "A";
  const mode = nativeTeamSlot === "A" ? "CENTRE_A" : "CENTRE_B";
  return deepFreeze({
    ...clone(current),
    phase: "centre-handoff-required",
    centreHandoff: {
      type: "centre-restart-required",
      mode,
      matchMode: CSSOCCER_MATCH_MODE[mode],
      nativeTeamSlot,
      country: countryForNativeSlot(match, nativeTeamSlot),
      executionOwner: "kickoff-reducer",
    },
    lifecycleHandoff: null,
    terminalResult: null,
  });
}

/** Return to normal play after the declared handoff owner accepts the state. */
export function resumeCssoccerGoalState(state, { lifecycle } = {}) {
  const current = assertCssoccerGoalState(state);
  if (
    current.phase !== "centre-handoff-required"
    && current.phase !== "lifecycle-handoff-required"
  ) {
    throw new Error("Goal state can resume only after a declared post-goal handoff.");
  }
  const match = assertCssoccerMatchLifecycle(lifecycle);
  if (!sameValue(current.score, match.score)) {
    throw new Error("Resumed goal state score must match the lifecycle.");
  }
  if (match.clock.terminal || !match.clock.liveClockActive) {
    throw new Error("Goal state can resume only into non-terminal live normal time.");
  }
  return liveState(
    current.score,
    current.goalSequence,
    current.lastGoalScorerNative,
  );
}

export function resetCssoccerGoalState(state) {
  const current = assertCssoccerGoalState(state);
  return liveState(resetCssoccerScoreState(current.score), 0, 0);
}

export function projectCssoccerGoalNativeFields(state) {
  const current = assertCssoccerGoalState(state);
  const values = {
    "score.goal_scorer": current.lastGoalScorerNative,
    "score.just_scored": current.justScored,
    "score.team_a": current.score.goals.spain,
    "score.team_b": current.score.goals.argentina,
    "rules.dead_ball_count": current.deadBall.deadBallCount,
    "rules.game_action": current.deadBall.gameAction,
    "rules.match_mode": current.deadBall.matchMode,
  };
  return deepFreeze(CSSOCCER_GOAL_NATIVE_FIELD_CONTRACT.map(({ fieldId, valueType }) => ({
    fieldId,
    valueType,
    value: values[fieldId],
    numericBits: numericBits(valueType, values[fieldId]),
  })));
}

export function assertCssoccerGoalState(state) {
  requirePlainObject(state, "goal state");
  if (state.schema !== CSSOCCER_GOAL_STATE_SCHEMA) {
    throw new Error(`goal state must use ${CSSOCCER_GOAL_STATE_SCHEMA}.`);
  }
  assertCssoccerScoreState(state.score);
  requireIntegerRange(state.goalSequence, 0, 0x7fffffff, "goalSequence");
  requireIntegerRange(state.lastGoalScorerNative, 0, 22, "lastGoalScorerNative");
  if ((state.goalSequence === 0) !== (state.lastGoalScorerNative === 0)) {
    throw new Error("Goal sequence and retained native scorer must begin and clear together.");
  }
  requireIntegerRange(state.justScored, 0, CSSOCCER_GOAL_CONSTANTS.justScoredTicks, "justScored");
  requireIntegerRange(
    state.elapsedCelebrationTicks,
    0,
    CSSOCCER_GOAL_CONSTANTS.justScoredTicks,
    "elapsedCelebrationTicks",
  );
  requirePlainObject(state.deadBall, "goal deadBall");
  if (!["normal-play", "celebration", "awaiting-post-goal-handoff", "centre-handoff-required", "lifecycle-handoff-required", "terminal-preserved"].includes(state.phase)) {
    throw new Error(`Unsupported goal phase ${String(state.phase)}.`);
  }
  if (state.phase === "normal-play") {
    if (
      state.justScored !== 0
      || state.elapsedCelebrationTicks !== 0
      || state.activeGoal !== null
      || state.deadBall.active !== 0
      || state.celebration !== null
      || state.lifecycleEvent !== null
      || state.centreHandoff !== null
      || state.lifecycleHandoff !== null
      || state.terminalResult !== null
    ) {
      throw new Error("normal goal state contains an active post-goal sequence.");
    }
    return state;
  }
  requireActiveGoal(state.activeGoal);
  if (state.lastGoalScorerNative !== state.activeGoal.goalScorerNative) {
    throw new Error("Active goal scorer must remain the retained native goal_scorer.");
  }
  requirePlainObject(state.celebration, "goal celebration");
  requirePlainObject(state.lifecycleEvent, "goal lifecycleEvent");
  if (
    state.goalSequence < 1
    || state.deadBall.active !== 1
    || state.deadBall.reason !== "goal"
    || state.deadBall.matchMode !== 0
    || state.deadBall.deadBallCount !== 0
    || state.deadBall.gameAction !== 0
    || state.deadBall.ballStateOwner !== "ballMatchState"
    || state.lifecycleEvent.type !== "goal-awarded"
    || state.lifecycleEvent.country !== state.activeGoal.scoringCountry
    || state.celebration.scorerPlayerId !== state.activeGoal.scorer.playerId
    || state.celebration.scoringCountry !== state.activeGoal.scoringCountry
  ) {
    throw new Error("active goal fields diverged from the qualified source outcome.");
  }
  if (state.phase === "celebration") {
    if (
      state.justScored < 1
      || state.elapsedCelebrationTicks + state.justScored !== CSSOCCER_GOAL_CONSTANTS.justScoredTicks
      || state.celebration.active !== 1
      || state.centreHandoff !== null
      || state.lifecycleHandoff !== null
      || state.terminalResult !== null
    ) {
      throw new Error("goal celebration countdown is inconsistent.");
    }
  } else if (
    state.justScored !== 0
    || state.elapsedCelebrationTicks !== CSSOCCER_GOAL_CONSTANTS.justScoredTicks
    || state.celebration.active !== 0
  ) {
    throw new Error("completed goal countdown retained active celebration fields.");
  }
  if (state.phase === "awaiting-post-goal-handoff" && (
    state.centreHandoff !== null
    || state.lifecycleHandoff !== null
    || state.terminalResult !== null
  )) {
    throw new Error("awaiting post-goal state cannot preselect its next owner.");
  }
  if (state.phase === "centre-handoff-required") {
    requirePlainObject(state.centreHandoff, "goal centreHandoff");
    const expectedSlot = state.activeGoal.lastGoal === 1 ? "B" : "A";
    const expectedMode = expectedSlot === "A" ? "CENTRE_A" : "CENTRE_B";
    if (
      state.centreHandoff.type !== "centre-restart-required"
      || state.centreHandoff.nativeTeamSlot !== expectedSlot
      || state.centreHandoff.mode !== expectedMode
      || state.centreHandoff.matchMode !== CSSOCCER_MATCH_MODE[expectedMode]
      || (state.centreHandoff.country !== "spain" && state.centreHandoff.country !== "argentina")
      || state.centreHandoff.executionOwner !== "kickoff-reducer"
      || state.lifecycleHandoff !== null
      || state.terminalResult !== null
    ) {
      throw new Error("centre handoff must remain owned by the kickoff reducer.");
    }
  }
  if (state.phase === "lifecycle-handoff-required") {
    requirePlainObject(state.lifecycleHandoff, "goal lifecycleHandoff");
    if (
      state.centreHandoff !== null
      || state.lifecycleHandoff.type !== "match-lifecycle-transition-required"
      || typeof state.lifecycleHandoff.phase !== "string"
      || !Number.isSafeInteger(state.lifecycleHandoff.matchHalf)
      || state.lifecycleHandoff.executionOwner !== "match-lifecycle"
      || state.terminalResult !== null
    ) {
      throw new Error("Paused post-goal state must remain owned by match lifecycle.");
    }
  }
  if (state.phase === "terminal-preserved" && (
    state.centreHandoff !== null
    || state.lifecycleHandoff !== null
    || state.terminalResult?.status !== "final"
  )) {
    throw new Error("terminal goal state must preserve the final lifecycle without a centre handoff.");
  }
  return state;
}

function liveState(score, goalSequence, lastGoalScorerNative = 0) {
  return deepFreeze({
    schema: CSSOCCER_GOAL_STATE_SCHEMA,
    source: CSSOCCER_GOAL_SOURCE,
    phase: "normal-play",
    score,
    goalSequence,
    lastGoalScorerNative,
    justScored: 0,
    elapsedCelebrationTicks: 0,
    activeGoal: null,
    deadBall: {
      active: 0,
      reason: null,
      matchMode: 0,
      deadBallCount: 0,
      gameAction: 0,
      ballStateOwner: "ballMatchState",
    },
    celebration: null,
    lifecycleEvent: null,
    centreHandoff: null,
    lifecycleHandoff: null,
    terminalResult: null,
  });
}

function requireActiveGoal(value) {
  requirePlainObject(value, "active goal");
  if (
    (value.goalLine !== "left" && value.goalLine !== "right")
    || (value.lastGoal !== 1 && value.lastGoal !== 2)
    || value.lastGoal !== (value.goalLine === "left" ? 2 : 1)
    || (value.nativeScoringSlot !== "A" && value.nativeScoringSlot !== "B")
    || value.nativeScoringSlot !== (value.goalLine === "right" ? "A" : "B")
    || (value.scoringCountry !== "spain" && value.scoringCountry !== "argentina")
    || (value.sourceScoreSlot !== "A" && value.sourceScoreSlot !== "B")
    || value.sourceScoreSlot !== sourceScoreSlotFor(value.scoringCountry)
    || typeof value.ownGoal !== "boolean"
  ) {
    throw new Error("active goal attribution is malformed.");
  }
  requirePlayerNumber(value.goalScorerNative, "active goal scorer", "invalid-goal-scorer");
  requirePlainObject(value.scorer, "active goal scorer identity");
  if (
    value.scorer.nativePlayerNumber !== value.goalScorerNative
    || (value.scorer.country !== value.scoringCountry) !== value.ownGoal
  ) {
    throw new Error("active goal stable scorer identity is inconsistent.");
  }
}

function countryForNativeSlot(lifecycle, slot) {
  const country = lifecycle.teamState.current.nativeTeamBySlot?.[slot];
  if (country !== "spain" && country !== "argentina") {
    throw new Error(`Lifecycle has no stable country in native team slot ${slot}.`);
  }
  return country;
}

function sourceScoreSlotFor(country) {
  const entry = Object.entries(CSSOCCER_SCORE_SOURCE.stableKickoffSlots)
    .find(([, stableCountry]) => stableCountry === country);
  if (!entry) throw new Error(`No source score slot is bound for ${country}.`);
  return entry[0];
}

function stablePlayerForNativeNumber(lifecycle, nativePlayerNumber) {
  const player = lifecycle.teamState.players.find(
    ({ current }) => current.nativePlayerNumber === nativePlayerNumber,
  );
  if (!player || (player.country !== "spain" && player.country !== "argentina")) {
    throw new Error(`Lifecycle has no stable player for native number ${nativePlayerNumber}.`);
  }
  return { id: player.id, country: player.country };
}

function currentCountryByNativeSlot(players) {
  if (!Array.isArray(players) || players.length !== 22) {
    throw new Error("Current centre ownership requires the 22 live match players.");
  }
  const countries = { A: new Set(), B: new Set() };
  for (const player of players) {
    if (
      (player.nativeTeamSlot !== "A" && player.nativeTeamSlot !== "B")
      || (player.country !== "spain" && player.country !== "argentina")
      || player.nativeTeamSlot !== nativeTeamFor(player.nativePlayerNumber)
    ) {
      throw new Error("Current player country/native-slot ownership is malformed.");
    }
    countries[player.nativeTeamSlot].add(player.country);
  }
  if (countries.A.size !== 1 || countries.B.size !== 1) {
    throw new Error("Each current native team slot must contain exactly one stable country.");
  }
  const A = [...countries.A][0];
  const B = [...countries.B][0];
  if (A === B) throw new Error("Current native team slots cannot contain the same country.");
  return { A, B };
}

function nativeTeamFor(nativePlayerNumber) {
  return nativePlayerNumber < 12 ? "A" : "B";
}

function requirePlayerNumber(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 22) {
    throw new CssoccerUnsupportedGoalAttributionError(
      code,
      `${label} must be an explicit native player number in 1..22.`,
      { value: value ?? null },
    );
  }
}

function numericBits(valueType, value) {
  const bytes = valueType === "u8" ? 1 : valueType === "i16" ? 2 : 4;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "i32") view.setInt32(0, value, false);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "u8") view.setUint8(0, value);
  else throw new Error(`Unsupported goal field type ${valueType}.`);
  return [...new Uint8Array(buffer)].map((entry) => entry.toString(16).padStart(2, "0")).join("");
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
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

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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

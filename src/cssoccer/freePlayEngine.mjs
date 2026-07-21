import {
  CSSOCCER_NATIVE_ACTIONS,
  createCssoccerActionState,
} from "./actionState.mjs";
import {
  createBallLimbo,
  createBallMatchState,
  stepBallMatchState,
} from "./ballMatchState.mjs";
import { CSSOCCER_BALL_CONSTANTS } from "./ballState.mjs";
import { classifyCssoccerBoundary } from "./boundaryState.mjs";
import { stepCssoccerClockState } from "./clockState.mjs";
import {
  CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
} from "./centrePassAction.mjs";
import {
  stepCssoccerLooseBallControl,
  createCssoccerPlayerTussleFrame,
  nativeContactTraversalOrder,
  stepCssoccerPlayerTussleFrame,
} from "./contactState.mjs";
import {
  stepCssoccerKeeperHeldBall,
  stepCssoccerPossessedBallState,
} from "./heldBallState.mjs";
import {
  CSSOCCER_KEEPER_ACTIONS,
  planCssoccerKeeperSave,
  resolveCssoccerKeeperSaveContact,
} from "./keeperAi.mjs";
import {
  CSSOCCER_FREE_PLAY_ENGINE_SCHEMA,
  assertCssoccerFreePlayCommand,
  assertCssoccerFreePlayEngineApi,
} from "./freePlayContract.mjs";
import {
  assertCssoccerFreePlayState,
} from "./freePlayState.mjs";
import {
  resolveCssoccerCurrentPostGoalHandoff,
  resolveCssoccerCurrentQualifiedGoal,
  resumeCssoccerCurrentGoalState,
  stepCssoccerGoalCountdown,
} from "./goalState.mjs";
import {
  stepCssoccerFreePlayOpeningTeamContinuation,
  stepCssoccerFreePlayOpeningTeamTransition,
  stepCssoccerFreePlayTeamJourneyContinuation,
} from "./freePlayPlayerReducer.mjs";
import {
  scanCssoccerFreeBallControlIntercept,
} from "./interceptState.mjs";
import {
  CSSOCCER_KICKOFF_CONSTANTS,
} from "./kickoffState.mjs";
import {
  stepCssoccerKickoffPlayerMotion,
  createCssoccerCurrentKickoffPlayerMotion,
} from "./kickoffPlayerMotion.mjs";
import {
  CSSOCCER_SPEED_INTENT,
  actualPlayerSpeed,
  sourceAngleCosine,
  sourceDistance2d,
  sourceFacingDirection,
  sourceForwardDisplacement,
  sourceFullPlayerSpeed,
  turnSourceFacing,
  updateSourcePosition2d,
} from "./motionState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
} from "./nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  projectCssoccerMotionSourceProfile,
  projectCssoccerTravelSourceProfile,
} from "./nativeGameplayProfile.mjs";
import {
  CSSOCCER_OFFICIAL_CONSTANTS,
  stepCssoccerOpeningOfficialState,
} from "./officialState.mjs";
import {
  createCssoccerLiveOffsideSnapshot,
  markCssoccerOffsideInvolvement,
  resolveCssoccerLiveOffsideSnapshot,
} from "./offsideState.mjs";
import {
  collectPossession,
  createPossessionState,
  releasePossession,
} from "./possessionState.mjs";
import { applyCssoccerFallInjury } from "./playerInjuryState.mjs";
import { resolveTacklePlayerContacts } from "./tackleState.mjs";
import {
  resolveCssoccerAiPassDecision,
  resolveCssoccerAiNormalPass,
  resolveCssoccerFirstTimePassSearch,
  resolveCssoccerUserDirectionalPass,
  resolveCssoccerUserPassDecision,
} from "./passDecisionState.mjs";
import {
  createCssoccerFreePlayPlayerHighlightInputFrame,
} from "./playerHighlightInputs.mjs";
import {
  assertCssoccerPlayerHighlightState,
  projectCssoccerPlayerHighlightState,
  stepCssoccerPlayerHighlightState,
} from "./playerHighlightState.mjs";
import {
  projectCssoccerPassKickLaunch,
  projectCssoccerShotKickLaunch,
} from "./playerAnimationState.mjs";
import { advanceCssoccerNativeRng } from "./randomState.mjs";
import { getCssoccerNormalTimeResult } from "./scoreState.mjs";
import { initializeCssoccerRestart } from "./restartState.mjs";
import {
  advanceCssoccerSetPiece,
  createCssoccerSetPieceState,
} from "./setPieceState.mjs";
import {
  materializeCssoccerFoulTakerPlacement,
} from "./foulState.mjs";
import {
  clearCssoccerRuleRestart,
  completeCssoccerRuleDismissal,
  remapCssoccerRulePlayers,
  resolveCssoccerRuleAdvantage,
  resolveCssoccerRuleFoul,
} from "./ruleState.mjs";
import {
  createCssoccerTacticsState,
  resolveCssoccerZonalTarget,
} from "./tacticsState.mjs";
import {
  createCssoccerZoneState,
  stepCssoccerZoneState,
} from "./zoneState.mjs";
import {
  releaseCssoccerChargedGroundPass,
  releaseCssoccerChipPass,
  releaseCssoccerCrossPass,
  releaseCssoccerDirectedGroundPass,
  releaseCssoccerGroundPass,
  stepCssoccerKickHeldBall,
} from "./livePassState.mjs";
import {
  isCssoccerShootingRange,
  releaseCssoccerPunt,
  releaseCssoccerShot,
  resolveCssoccerPuntDecision,
  resolveCssoccerShotDecision,
} from "./liveShotState.mjs";

const F32 = Math.fround;
const SNAPSHOT_SCHEMA = "cssoccer-free-play-snapshot@1";
const BUTTON_FIRE_1 = 1;
const BUTTON_FIRE_2 = 2;
const LIVE_PUNT_PASS_TYPE = 100;
const FALL_ACTION = 5;
const FALL_ANIMATION = 90;
const FALL_FRAME_STEP = F32(1 / (20 * 34 / 40));
const BARGE_ANIMATION = 74;
const TACKLE_ACTION = 3;
const TACKLE_ANIMATION = 85;
const TACKLE_FRAME_STEP = F32(0.04);
const TACKLE_DECEL = 0.92;
const STEAL_ACTION = 15;
const STEAL_ANIMATION = 86;
const STEAL_FRAME_STEP = F32(1 / (20 * 17 / 40));
const GOAL_CELEBRATION_ACTION = 16;
const GOAL_CELEBRATION_ANIMATION = 92;
const GOAL_CELEBRATION_FRAME_STEP = F32(1 / 59);
const GOAL_KNEE_ANIMATION = 110;
const GOAL_KNEE_FRAME_STEP = F32(2 / 41);
const GOAL_DUCK_ANIMATION = 111;
const GOAL_DUCK_FRAME_STEP = F32(2 / 62);
const GOAL_DUCK_SPEED = F32(0.332258064516129);
const GOAL_TAUNTS = Object.freeze([
  Object.freeze({ animation: 116, frameStep: F32(2 / 49) }),
  Object.freeze({ animation: 113, frameStep: F32(2 / 40) }),
  Object.freeze({ animation: 115, frameStep: F32(2 / 30) }),
  Object.freeze({ animation: 112, frameStep: F32(2 / 45) }),
]);
const GET_UP_FRONT_ANIMATION = 95;
const GET_UP_FRONT_FRAME_STEP = F32(1 / (20 * 87 / 40));
const STAND_ANIMATION = 78;
const RUN_ANIMATION = 72;
const THROW_ANIMATION = 88;
const THROW_FRAME_STEP = F32(2 / 43);
const THROW_CONTACT = F32(86 / 129);
const PICKUP_ANIMATION = 107;
const PICKUP_FRAME_STEP = F32(2 / 43);
const CENTRE_PASS_ANIMATION = 39;
const RUN_FRAME_STEP = 1 / (20 * 26 / 40);
const STAND_FRAME_STEP = F32(1 / (20 * 39 / 40));
const SIDE_STEP_FRAME_STEP = 1 / (20 * 32 / 40);
const RUN_REFERENCE_SPEED = 3.19;
const CENTRE_PASS_BASE_FRAME_STEP = F32(0.06060606241226196);
const CENTRE_PASS_CONTACT = F32(48 / 99);
const CENTRE_PASS_MOVEMENT_DISTANCE = 10.14;
const CENTRE_PASS_CONTACT_OFFSET = Object.freeze({
  x: F32(9.694164276123047),
  y: F32(-5.616666793823242),
  z: F32(1.9474040269851685),
});
const LIVE_LOOSE_BALL_CONTACT_PROFILE = Object.freeze({
  touchBallBox: CSSOCCER_CENTRE_PASS_ACTION_PROFILE.pass.touchBox,
  atFeetDistance: CSSOCCER_CENTRE_PASS_ACTION_PROFILE.pass.atFeetDistance,
  ballRadius: F32(CSSOCCER_CENTRE_PASS_ACTION_PROFILE.pass.ballDiameter / 2),
  playerHeight: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value,
  verticalBallDamp: 0.6,
});
const LIVE_PLAYER_CONTACT_PROFILE = Object.freeze({
  ...LIVE_LOOSE_BALL_CONTACT_PROFILE,
  playerSize: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerSize.value,
  pitchRatio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
  saveContact: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.saveContact.value,
  effectiveTackle: 16,
  fallRate: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.fallRate.value,
  refereeStrictness: 128,
});
const LIVE_RULE_SOURCE_PROFILE = Object.freeze({
  // Watcom RULES.OBJ::init_penalty operands L$935/L$937 are -30/+30.
  penaltyRunupDistance: Object.freeze({
    value: F32(30),
    numericBits: "41f00000",
    source: "RULES.OBJ init_penalty compiled operands",
  }),
});
const STEAL_START_DISTANCE = F32(
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 6 / 4,
);
const STEAL_FOOT_DISTANCE = F32(
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.5,
);
const TROT_ANIMATION_BY_DIRECTION = Object.freeze({
  1: 71,
  2: 68,
  3: 67,
  4: 64,
  5: 70,
  6: 65,
  7: 66,
  8: 69,
});

export const CSSOCCER_FREE_PLAY_SOURCE_LOOP = Object.freeze([
  "process_ball",
  "match_rules",
  "keeper_boxes",
  "player_distances",
  "get_nearest",
  "process_teams",
  "new_users",
  "select_all_hlites",
  "process_offs",
  "process_anims",
]);

export const CSSOCCER_FREE_PLAY_ENGINE_SOURCE = deepFreeze({
  file: "FOOTBALL.CPP",
  sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  tickRateHz: 20,
  timestepMilliseconds: 50,
  order: CSSOCCER_FREE_PLAY_SOURCE_LOOP,
  currentStateOnly: true,
});

export function createCssoccerFreePlayEngine({ initialState } = {}) {
  const initial = assertCssoccerFreePlayState(initialState);
  let current = createSnapshot({
    match: clone(initial),
    lastStep: null,
  });

  const engine = {
    schema: CSSOCCER_FREE_PLAY_ENGINE_SCHEMA,
    step(command) {
      const accepted = assertCssoccerFreePlayCommand(command, {
        expectedTick: current.tick,
      });
      if (current.match.session.paused || current.match.clock.terminal) return current;
      current = stepSnapshot(current, accepted);
      return current;
    },
    snapshot() {
      return current;
    },
  };
  return Object.freeze(assertCssoccerFreePlayEngineApi(engine));
}

function stepSnapshot(snapshot, command) {
  const nextTick = snapshot.tick + 1;
  let match = clone(snapshot.match);
  const trace = [];
  const events = [];
  let nearest = null;
  let playerDistanceFrame = null;
  let centrePassReceiverFrame = null;
  const sourceInitialization = match.kickoff.phase === "source-initialization";

  match = runStage("process_ball", trace, () => processBall(match, nextTick, {
    command,
    events,
    sourceInitialization,
  }));
  match = runStage("match_rules", trace, () => processRules(
    match,
    nextTick,
    events,
    command,
  ));
  match = advanceOpeningClock(match, {
    events,
    nextTick,
    sourceInitialization,
  });
  match = runStage("keeper_boxes", trace, () => processKeeperBoxes(
    match,
    nextTick,
    events,
  ));
  match = runStage("player_distances", trace, () => {
    playerDistanceFrame = captureOpenPlayPlayerDistances(match);
    return processPlayerDistances(match);
  });
  nearest = runStage("get_nearest", trace, () => selectNearestControlledPlayer(match));
  if (match.kickoff.phase === "kick-action") {
    centrePassReceiverFrame = clone(match.players.find(
      ({ id }) => id === match.kickoff.action.receiverId,
    ));
  }
  match = runStage("process_teams", trace, () => {
    const eventStart = events.length;
    const processed = processTeams(match, {
      command,
      events,
      nextTick,
      sourceInitialization,
    });
    return routeCurrentTeamFoulCandidate(
      processed,
      events.slice(eventStart),
      nextTick,
      events,
    );
  });
  match = runStage("new_users", trace, () => processLocalUser({
    match,
    command,
    nearest,
    nextTick,
    playerDistanceFrame,
    events,
  }));
  match = runStage("select_all_hlites", trace, () => selectControlledPlayer({
    match,
    nearest,
    nextTick,
  }));
  match = runStage("process_offs", trace, () => processOfficials(match, {
    events,
    nextTick,
    sourceInitialization,
  }));
  match = runStage("process_anims", trace, () => processAnimations(match, {
    centrePassReceiverFrame,
    events,
    nearest,
    nextTick,
    sourceInitialization,
  }));

  match.tick = nextTick;
  if (match.clock.tick !== nextTick) {
    throw new Error("The cssoccer live clock did not publish the current product tick.");
  }
  if (
    match.kickoff.phase === "source-initialization"
    || match.kickoff.phase === "centre-positioning"
  ) {
    match.kickoff.readiness = deriveKickoffReadiness(match);
  }
  match.session.pendingCommand = null;
  match.playerHighlight = projectCssoccerPlayerHighlightState(
    createCssoccerFreePlayPlayerHighlightInputFrame({
      match,
      tick: nextTick,
    }),
  );

  return createSnapshot({
    match,
    lastStep: {
      command: clone(command),
      sourceOrder: trace,
      events,
    },
  });
}

function processBall(match, nextTick, { command, events, sourceInitialization }) {
  const rng = sourceInitialization
    ? match.rng.state
    : advanceCssoccerNativeRng(match.rng.state);
  let ball;
  if (
    match.kickoff.ballStatus === "held-at-centre"
    || match.kickoff.ballStatus === "held-by-taker"
    || match.kickoff.ballStatus === "held-at-restart"
    || match.kickoff.ballStatus === "held-in-hands"
  ) {
    ball = createBallMatchState({
      ...match.ball,
      ball: {
        ...match.ball.ball,
        tick: nextTick,
        rng,
      },
    });
  } else if (match.possession.owner !== 0 && match.possession.inHands === 1) {
    const owner = match.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === match.possession.owner,
    );
    if (owner === undefined || owner.role !== "keeper") {
      throw new Error("process_ball lost its current keeper-hands owner.");
    }
    const held = stepCssoccerKeeperHeldBall({
      ball: match.ball,
      owner: {
        action: owner.action.action.value,
        facing: clone(owner.facing),
        goDisplacement: clone(
          owner.liveMotion?.goDisplacement ?? { x: F32(0), y: F32(0) },
        ),
        nativePlayerNumber: owner.nativePlayerNumber,
        position: clone(owner.position),
        saveOffset: clone(
          owner.liveKeeper?.plan?.contactOffset
            ?? { x: F32(0), y: F32(0), z: F32(0) },
        ),
      },
      possession: match.possession,
      tick: nextTick,
    });
    ball = held.ball;
    match = { ...match, possession: held.possession };
  } else if (match.possession.owner !== 0 && match.possession.inHands === 0) {
    const owner = match.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === match.possession.owner,
    );
    const heldKick = owner?.livePass?.phase === "kick-held"
      ? owner.livePass
      : owner?.liveShot?.phase === "kick-held"
        ? owner.liveShot
        : null;
    if (heldKick !== null) {
      ball = stepCssoccerKickHeldBall({
        ball: match.ball,
        owner: {
          action: owner.action.action.value,
          animationFrame: F32(owner.animation.frame + owner.animation.frameStep),
          contact: heldKick.contact,
          contactOffset: clone(heldKick.contactOffset),
          nativePlayerNumber: owner.nativePlayerNumber,
          position: clone(owner.position),
        },
        possession: match.possession,
        tick: nextTick,
      }).ball;
    } else {
      ball = stepCssoccerPossessedBallState(match.ball);
    }
  } else {
    const limboPlayer = match.ball.limbo.active === 0
      ? undefined
      : match.players.find(({ nativePlayerNumber }) => (
          nativePlayerNumber === match.ball.limbo.player
        ));
    if (match.ball.limbo.active !== 0 && limboPlayer === undefined) {
      throw new Error("process_ball lost its current animation-bound restart owner.");
    }
    const stepped = stepBallMatchState(match.ball, {
      goalCountdownComplete: match.goal.justScored === 0,
      ...(limboPlayer === undefined
        ? {}
        : {
            limboPlayer: {
              player: limboPlayer.nativePlayerNumber,
              animationFrame: limboPlayer.animation.frame,
              animationStep: limboPlayer.animation.frameStep,
              animation: limboPlayer.animation.id,
            },
          }),
      ...(match.ball.ball.afterTouch.user === 0
        ? {}
        : {
            afterTouchInput: {
              x: F32(command.moveX / 127),
              y: F32(command.moveY / 127),
            },
          }),
    });
    ball = stepped.state;
    events.push(...stepped.events.map(clone));
    if (ball.ball.tick !== nextTick) {
      throw new Error("process_ball did not advance exactly one logical tick.");
    }
  }
  let goal = match.goal;
  let score = match.score;
  let possession = match.possession;
  let rules = match.rules;
  let clock = match.clock;
  let kickoff = match.kickoff;
  let control = match.control;
  let phase = match.phase;
  const enteredGoal = match.ball.outcome === null
    && ball.outcome?.kind === "goal"
    && ball.outcome.status === "requires-score-resolution";
  if (enteredGoal) {
    ball = resetQualifiedGoalShot(ball);
    goal = resolveCssoccerCurrentQualifiedGoal(goal, {
      ballMatchState: ball,
      match,
      lastTouch: possession.lastTouch,
      ...(possession.preKeeperTouch === 0
        ? {}
        : { preKeeperTouch: possession.preKeeperTouch }),
    });
    score = goal.score;
    possession = releasePossession(possession);
    rules = {
      ...rules,
      phase: "goal-celebration",
      matchMode: 0,
      gameAction: 0,
      setPiece: 0,
      deadBallCount: 0,
    };
    clock = { ...clock, running: false };
    kickoff = {
      ...kickoff,
      phase: "goal-celebration",
      ballStatus: "goal-dead-ball",
      pendingAction: null,
      action: null,
      launch: null,
    };
    control = {
      ...control,
      activePlayerId: null,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    };
    phase = "goal-celebration";
    events.push({
      type: "goal-awarded",
      tick: nextTick,
      country: goal.activeGoal.scoringCountry,
      scorerId: goal.activeGoal.scorer.playerId,
      goalLine: goal.activeGoal.goalLine,
      score: clone(score.goals),
    });
  } else if (goal.phase === "celebration") {
    goal = stepCssoccerGoalCountdown(goal);
    if (goal.justScored === 0) {
      kickoff = { ...kickoff, phase: "goal-reset-wait" };
      phase = "goal-reset-wait";
      events.push({
        type: "goal-celebration-complete",
        tick: nextTick,
        goalSequence: goal.goalSequence,
      });
    }
  }
  return {
    ...match,
    rng: { ...match.rng, state: rng },
    ball,
    goal,
    score,
    possession,
    rules,
    clock,
    kickoff,
    control,
    phase,
  };
}

function processRules(match, nextTick, events, command) {
  if (currentLifecycleSuspendsGameplay(match)) return match;
  if (match.rules.foulRestart != null) {
    return processCurrentFoulRestartRules(match, nextTick, events, command);
  }
  if (
    match.goal.phase === "awaiting-post-goal-handoff"
    && match.ball.outcome?.kind === "goal"
    && match.ball.ball.outOfPlay === 1
  ) {
    return initializePostGoalCentre(match, nextTick, events);
  }
  if (match.ball.outcome?.kind === "boundary" || match.rules.boundary != null) {
    return processBoundaryRestartRules(match, nextTick, events, command);
  }
  if (match.rules.state.foul.playAdvantage === 1) {
    return resolveCurrentFoulAdvantage(match, nextTick, events);
  }
  if (
    match.kickoff.phase === "centre-positioning"
    && match.kickoff.ballStatus === "held-at-centre"
    && match.kickoff.readiness.readyForLaunch
  ) {
    return beginCentrePass(match, nextTick, events);
  }
  return match;
}

function routeCurrentTeamFoulCandidate(match, teamEvents, nextTick, events) {
  const candidates = teamEvents.filter(({ type }) => type === "foul-candidate");
  if (candidates.length === 0) return match;
  if (candidates.length !== 1) {
    throw new Error("One current process_teams visit may publish at most one rule foul candidate.");
  }
  if (match.rules.foulRestart != null || match.rules.state.foul.playAdvantage !== 0) {
    throw new Error("A current foul candidate cannot overlap another rule incident.");
  }
  const event = candidates[0];
  const offender = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === event.fouler,
  );
  const fallen = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === event.fallenPlayer,
  );
  if (offender === undefined || fallen === undefined || !offender.active) {
    throw new Error("Current foul candidate lost its stable offender or fallen player.");
  }
  const awardedNativeTeam = offender.nativeTeamSlot === "A" ? "B" : "A";
  const offenderDistanceToBall = sourceDistance2d({
    x: F32(offender.position.x - match.ball.ball.position.x),
    y: F32(offender.position.y - match.ball.ball.position.y),
  });
  const context = {
    candidate: {
      type: "foul-candidate",
      fouler: event.fouler,
      fallenPlayer: event.fallenPlayer,
      source: event.source,
      playerId: offender.id,
    },
    offenderPosition: { x: offender.position.x, y: offender.position.y },
    refereePosition: {
      x: match.officials.officials[0].position.x,
      y: match.officials.officials[0].position.y,
    },
    ballPossession: match.possession.owner,
    justScored: match.goal.justScored === 0 ? 0 : 1,
    manDown: fallen.action.action.value === FALL_ACTION ? 1 : 0,
    offenderDistanceToBall,
    rng: match.rng.state,
    takerCandidates: currentRuleTakerCandidates(
      match,
      awardedNativeTeam,
      offender.position,
    ),
  };
  const routed = resolveCssoccerRuleFoul(match.rules.state, context);
  const current = {
    ...match,
    rules: { ...match.rules, state: routed.state },
    rng: { ...match.rng, state: routed.rng },
  };
  events.push({
    type: "foul-decision",
    tick: nextTick,
    playerId: offender.id,
    nativePlayerNumber: offender.nativePlayerNumber,
    fallenPlayerId: fallen.id,
    status: routed.decision.status,
    reason: routed.decision.reason,
    incidentPosition: clone(routed.decision.incidentPosition),
  });
  if (routed.restart !== null) {
    return acceptCurrentFoulRestart(current, routed, nextTick, events);
  }
  if (routed.decision.status === "advantage-pending") {
    events.push({
      type: "foul-advantage-pending",
      tick: nextTick,
      playerId: offender.id,
      nativePlayerNumber: offender.nativePlayerNumber,
    });
    return {
      ...current,
      rules: {
        ...current.rules,
        foulAdvantage: {
          offenderDistanceToBall,
          manDown: context.manDown,
          disciplineSeed: routed.rng.seed,
          takerCandidates: clone(context.takerCandidates),
        },
      },
    };
  }
  return {
    ...current,
    rules: { ...current.rules, foulAdvantage: null },
  };
}

function currentRuleTakerCandidates(match, awardedNativeTeam, incidentPosition) {
  const tacticsState = currentFreePlayTacticsState(match.tactics);
  const zones = stepCssoccerZoneState(createCssoccerZoneState(), {
    ballPosition: incidentPosition,
    ballOutOfPlay: 0,
    matchMode: 0,
    ballInHands: 0,
    possessionPlayer: match.possession.owner,
  });
  return match.players
    .filter(({ role }) => role !== "keeper")
    .map((player) => {
      const zonal = resolveCssoccerZonalTarget(tacticsState, {
        nativeTeamSlot: player.nativeTeamSlot,
        nativePlayerNumber: player.nativePlayerNumber,
        ballZone: zones[player.nativeTeamSlot].ballZone,
        teamInPossession: player.nativeTeamSlot === awardedNativeTeam,
      });
      return {
        playerId: player.id,
        nativePlayerNumber: player.nativePlayerNumber,
        active: player.active ? 1 : 0,
        tacticalPosition: clone(zonal.target),
      };
    });
}

function resolveCurrentFoulAdvantage(match, nextTick, events) {
  if (match.possession.owner === 0) return match;
  const context = match.rules.foulAdvantage;
  if (context == null) {
    throw new Error("Current source advantage lost its retained foul context.");
  }
  const routed = resolveCssoccerRuleAdvantage(match.rules.state, {
    ballPossession: match.possession.owner,
    offenderDistanceToBall: context.offenderDistanceToBall,
    manDown: context.manDown,
    takerCandidates: context.takerCandidates,
    disciplineSeed: context.disciplineSeed,
  });
  const current = {
    ...match,
    rules: {
      ...match.rules,
      state: routed.state,
      foulAdvantage: null,
    },
  };
  events.push({
    type: routed.restart === null ? "foul-advantage-complete" : "foul-advantage-retaken",
    tick: nextTick,
    status: routed.decision.status,
    reason: routed.decision.reason,
    possessionOwner: match.possession.owner,
  });
  return routed.restart === null
    ? current
    : acceptCurrentFoulRestart(current, routed, nextTick, events);
}

function acceptCurrentFoulRestart(match, routed, nextTick, events) {
  const restart = routed.restart;
  const taker = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === restart.taker.nativePlayerNumber,
  );
  if (taker === undefined || !taker.active || taker.role === "keeper") {
    throw new Error("Current foul restart lost its source-selected active outfield taker.");
  }
  const ballPosition = {
    x: F32(restart.ballPosition.x),
    y: F32(restart.ballPosition.y),
    z: F32(CSSOCCER_BALL_CONSTANTS.ballDiameter / 2),
  };
  const ball = createBallMatchState({
    ball: {
      ...clone(match.ball.ball),
      tick: nextTick,
      position: ballPosition,
      previousPosition: ballPosition,
      displacement: { x: F32(0), y: F32(0), z: F32(0) },
      outPosition: null,
      inAir: 0,
      inGoal: 0,
      outOfPlay: 0,
      still: 1,
      speed: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
      afterTouch: {
        user: 0,
        shotDirection: { x: F32(0), y: F32(0) },
      },
    },
    limbo: { active: 0, player: 0, contact: F32(0) },
    outcome: null,
  });
  const possession = createPossessionState({
    ...clone(releasePossession(match.possession)),
    owner: 0,
    lastTouch: taker.nativePlayerNumber,
    preKeeperTouch: taker.nativePlayerNumber,
    inHands: 0,
    cannotPickUp: 0,
    players: match.possession.players.map((player) => ({
      ...clone(player),
      possession: 0,
    })),
  });
  const discipline = routed.disciplineEvent;
  events.push({ tick: nextTick, ...clone(discipline) });
  events.push({
    type: "foul-restart-awarded",
    tick: nextTick,
    kind: restart.kind,
    mode: restart.mode,
    nativeTeamSlot: restart.awardedNativeTeam,
    takerId: taker.id,
    takerNativePlayer: taker.nativePlayerNumber,
    position: clone(ballPosition),
  });
  return {
    ...match,
    phase: "foul-restart-wait",
    ball,
    possession,
    rules: {
      ...match.rules,
      phase: "foul-restart-wait",
      matchMode: restart.matchMode,
      gameAction: restart.gameAction,
      setPiece: restart.kind === "penalty" ? 4 : restart.kind === "direct" ? 2 : 1,
      deadBallCount: restart.deadBallCount,
      state: routed.state,
      foulAdvantage: null,
      liveOffside: null,
      foulRestart: {
        phase: "wait",
        decision: clone(routed.decision),
        descriptor: clone(restart),
        discipline: clone(discipline),
        disciplineTicks: discipline.cardTicks ?? 0,
        pendingDismissalId: discipline.card === "red" ? discipline.playerId : null,
        takerPlacement: null,
        wall: null,
        releaseCount: 0,
      },
    },
    clock: { ...match.clock, running: false },
    control: {
      ...match.control,
      activePlayerId: null,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    },
    kickoff: {
      ...match.kickoff,
      phase: "foul-contact-wait",
      restartKind: restart.kind,
      ballStatus: "held-at-restart",
      pendingAction: null,
      action: null,
      launch: null,
    },
  };
}

function processCurrentFoulRestartRules(match, nextTick, events, command) {
  const current = match.rules.foulRestart;
  if (current.phase === "wait") {
    const disciplineTicks = Math.max(0, current.disciplineTicks - 1);
    const waiting = match.players.some(({ liveContact }) => liveContact !== undefined)
      || disciplineTicks > 0;
    if (waiting) {
      return {
        ...match,
        rules: {
          ...match.rules,
          foulRestart: { ...current, disciplineTicks },
        },
      };
    }
    let ready = {
      ...match,
      rules: {
        ...match.rules,
        foulRestart: { ...current, disciplineTicks },
      },
    };
    if (current.pendingDismissalId !== null) {
      ready = completeCurrentFoulDismissal(
        ready,
        current.pendingDismissalId,
        nextTick,
        events,
      );
    }
    return initializeCurrentFoulRestart(ready, nextTick, events);
  }
  if (current.phase === "positioning") {
    return advanceCurrentFoulPositioning(match, nextTick, events);
  }
  if (current.phase === "decision") {
    return decideCurrentFoulRestart(match, nextTick, events, command);
  }
  if (current.phase === "action") return match;
  throw new Error(`Unsupported current foul restart phase ${String(current.phase)}.`);
}

function completeCurrentFoulDismissal(match, playerId, nextTick, events) {
  const offender = match.players.find(({ id }) => id === playerId);
  if (offender === undefined) throw new Error("Current dismissal lost its stable offender.");
  const state = completeCssoccerRuleDismissal(match.rules.state, { playerId });
  events.push({
    type: "discipline-dismissal-complete",
    tick: nextTick,
    playerId,
    nativePlayerNumber: offender.nativePlayerNumber,
  });
  return {
    ...match,
    players: match.players.map((player) => (
      player.id === playerId
        ? { ...clearLivePlayerActions(player), active: false }
        : player
    )),
    rules: { ...match.rules, state },
  };
}

function initializeCurrentFoulRestart(match, nextTick, events) {
  const current = match.rules.foulRestart;
  const descriptor = current.descriptor;
  const sourceConstant = descriptor.kind === "penalty"
    ? LIVE_RULE_SOURCE_PROFILE.penaltyRunupDistance.value
    : CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.besideBall.value;
  const takerPlacement = materializeCssoccerFoulTakerPlacement(
    descriptor,
    sourceConstant,
  );
  const prepared = createCurrentFoulTargets(match, descriptor, takerPlacement);
  let players = resetPlayersForCurrentBoundary(match.players, prepared.targets, nextTick);
  const motionPlayers = currentNativePlayerOrder(players);
  const motionTargets = currentNativePlayerOrder(prepared.targets);
  const teamBySlot = {
    A: match.teams.find(({ nativeTeamSlot }) => nativeTeamSlot === "A")?.country,
    B: match.teams.find(({ nativeTeamSlot }) => nativeTeamSlot === "B")?.country,
  };
  const motion = createCssoccerCurrentKickoffPlayerMotion({
    ballPosition: clone(descriptor.ballPosition),
    goToPositionDistance:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8,
    matchHalf: match.clock.matchHalf,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    pitchLength: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength),
    players: motionPlayers.map((player) => ({
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      teamRate: player.gameplay.pace,
      action: player.action.action.value,
      directionMode: 0,
      faceDirection: sourceFacingDirection(player.facing),
      position: { x: player.position.x, y: player.position.y },
      facing: clone(player.facing),
    })),
    selectedCountry: match.control.country,
    targetPlayers: motionTargets,
    teamBySlot,
  });
  players = bindCurrentBoundaryMotion(players, motion, nextTick);
  const taker = players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === descriptor.taker.nativePlayerNumber,
  );
  if (taker === undefined || !taker.active) {
    throw new Error("Current foul positioning lost its source-selected taker.");
  }
  const receiver = selectCurrentFoulReceiver(players, descriptor);
  events.push({
    type: "foul-restart-initialized",
    tick: nextTick,
    kind: descriptor.kind,
    mode: descriptor.mode,
    nativeTeamSlot: descriptor.awardedNativeTeam,
    takerId: taker.id,
    takerNativePlayer: taker.nativePlayerNumber,
    takerPlacement: clone(takerPlacement),
    wallNativePlayers: prepared.wall.members.map(({ nativePlayerNumber }) => (
      nativePlayerNumber
    )),
  });
  return {
    ...match,
    phase: "foul-restart",
    players,
    rules: {
      ...match.rules,
      phase: "foul-restart",
      foulRestart: {
        ...current,
        phase: "positioning",
        disciplineTicks: 0,
        pendingDismissalId: null,
        takerPlacement: clone(takerPlacement),
        wall: clone(prepared.wall),
      },
    },
    control: {
      ...match.control,
      activePlayerId: descriptor.awardedNativeTeam === match.control.nativeTeamSlot
        ? taker.id
        : null,
    },
    kickoff: {
      ...match.kickoff,
      phase: "rule-positioning",
      phaseTick: motion.tick,
      owner: {
        country: teamBySlot[descriptor.awardedNativeTeam],
        nativeTeamSlot: descriptor.awardedNativeTeam,
        takerId: taker.id,
        receiverId: receiver.id,
      },
      ballStatus: "held-at-restart",
      pendingAction: null,
      action: null,
      launch: null,
      motion,
    },
  };
}

function createCurrentFoulTargets(match, descriptor, takerPlacement) {
  const tacticsState = currentFreePlayTacticsState(match.tactics);
  const zones = stepCssoccerZoneState(createCssoccerZoneState(), {
    ballPosition: descriptor.ballPosition,
    ballOutOfPlay: 0,
    matchMode: 0,
    ballInHands: 0,
    possessionPlayer: 0,
  });
  const baseTargets = new Map();
  for (const player of match.players) {
    if (!player.active || player.role === "keeper") {
      baseTargets.set(player.id, { x: F32(player.position.x), y: F32(player.position.y) });
      continue;
    }
    const zonal = resolveCssoccerZonalTarget(tacticsState, {
      nativeTeamSlot: player.nativeTeamSlot,
      nativePlayerNumber: player.nativePlayerNumber,
      ballZone: zones[player.nativeTeamSlot].ballZone,
      teamInPossession: player.nativeTeamSlot === descriptor.awardedNativeTeam,
    });
    baseTargets.set(player.id, clone(zonal.target));
  }
  const wall = createCurrentDirectWall(match, descriptor, baseTargets);
  const wallById = new Map(wall.members.map((member) => [member.playerId, member]));
  const targets = match.players.map((player) => {
    const isTaker = player.nativePlayerNumber === descriptor.taker.nativePlayerNumber;
    const wallMember = wallById.get(player.id);
    let target = clone(baseTargets.get(player.id));
    let targetOwner = "INTELL.CPP foul restart zonal target";
    if (isTaker) {
      target = clone(takerPlacement);
      targetOwner = `RULES.CPP ${descriptor.takerPlacement.constant} taker placement`;
    } else if (wallMember !== undefined) {
      target = clone(wallMember.target);
      targetOwner = "RULES.CPP find_wall_guys direct wall";
    } else if (descriptor.kind === "penalty") {
      const defending = player.nativeTeamSlot !== descriptor.awardedNativeTeam;
      if (player.role === "keeper" && defending) {
        target = currentPenaltyKeeperTarget(descriptor);
        targetOwner = "RULES.CPP penalty defending keeper constraint";
      } else {
        target = currentPenaltyGatherTarget(target, descriptor);
        targetOwner = "RULES.CPP penalty gather-outside-box constraint";
      }
    } else if (
      player.nativeTeamSlot !== descriptor.awardedNativeTeam
      && player.role !== "keeper"
    ) {
      target = currentTenYardTarget(target, descriptor.ballPosition, player.nativeTeamSlot);
      targetOwner = "RULES.CPP ten-yards-away constraint";
    } else if (
      descriptor.kind === "direct"
      && player.role === "keeper"
      && player.nativeTeamSlot !== descriptor.awardedNativeTeam
    ) {
      const keeper = currentDirectKeeperTarget(descriptor, wall, target);
      target = keeper;
      targetOwner = "RULES.CPP direct wall keeper constraint";
    }
    return {
      id: player.id,
      country: player.country,
      nativeTeamSlot: player.nativeTeamSlot,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      role: player.role === "keeper" ? "keeper" : isTaker ? "taker" : "outfield",
      target: { x: F32(target.x), y: F32(target.y) },
      targetOwner,
    };
  });
  return { targets, wall };
}

function createCurrentDirectWall(match, descriptor, baseTargets) {
  const empty = {
    source: "RULES.CPP init_dfkick/find_wall_guys",
    members: [],
  };
  if (descriptor.kind !== "direct") return empty;
  const taker = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === descriptor.taker.nativePlayerNumber,
  );
  if (taker === undefined) throw new Error("Direct wall lost its current taker.");
  const goal = {
    x: descriptor.awardedNativeTeam === "A"
      ? F32(CSSOCCER_BALL_CONSTANTS.pitchLength)
      : F32(0),
    y: F32(CSSOCCER_BALL_CONSTANTS.pitchWidth / 2),
  };
  const offset = {
    x: F32(goal.x - descriptor.ballPosition.x),
    y: F32(goal.y - descriptor.ballPosition.y),
  };
  const range = sourceDistance2d(offset);
  const shootingRange = F32(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 12
      + taker.gameplay.power * 3,
  );
  if (!(range > 0) || range > shootingRange) return empty;
  const direction = { x: F32(offset.x / range), y: F32(offset.y / range) };
  const count = Math.trunc(5.5 - Math.abs(direction.y) * 3);
  const defendingNativeTeam = descriptor.awardedNativeTeam === "A" ? "B" : "A";
  const candidates = match.players
    .filter((player) => (
      player.active
      && player.role !== "keeper"
      && player.nativeTeamSlot === defendingNativeTeam
    ))
    .map((player) => ({
      player,
      distance: sourceDistance2d({
        x: F32(baseTargets.get(player.id).x - descriptor.ballPosition.x),
        y: F32(baseTargets.get(player.id).y - descriptor.ballPosition.y),
      }),
    }))
    .sort((left, right) => (
      left.distance - right.distance
      || left.player.nativePlayerNumber - right.player.nativePlayerNumber
    ))
    .slice(0, count);
  const prat = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  const anchor = {
    x: F32(descriptor.ballPosition.x + prat * 10 * direction.x),
    y: F32(descriptor.ballPosition.y + prat * 10 * direction.y),
  };
  const perpendicular = descriptor.ballPosition.y < CSSOCCER_BALL_CONSTANTS.pitchWidth / 2
    ? { x: F32(-direction.y), y: F32(direction.x) }
    : { x: F32(direction.y), y: F32(-direction.x) };
  const spacing = F32(prat * 0.9);
  let cursor = {
    x: F32(anchor.x - perpendicular.x * spacing),
    y: F32(anchor.y - perpendicular.y * spacing),
  };
  return {
    source: "RULES.CPP init_dfkick/find_wall_guys",
    goalDirection: direction,
    anchor,
    members: candidates.map(({ player }) => {
      const member = {
        playerId: player.id,
        nativePlayerNumber: player.nativePlayerNumber,
        target: clone(cursor),
      };
      cursor = {
        x: F32(cursor.x + perpendicular.x * spacing),
        y: F32(cursor.y + perpendicular.y * spacing),
      };
      return member;
    }),
  };
}

function currentTenYardTarget(target, ballPosition, nativeTeamSlot) {
  const minimum = F32(CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 10);
  let offset = {
    x: F32(target.x - ballPosition.x),
    y: F32(target.y - ballPosition.y),
  };
  let distance = sourceDistance2d(offset);
  if (distance >= minimum) return target;
  if (!(distance > 0)) {
    offset = { x: nativeTeamSlot === "A" ? F32(-1) : F32(1), y: F32(0) };
    distance = 1;
  }
  return {
    x: F32(ballPosition.x + offset.x * minimum / distance),
    y: F32(ballPosition.y + offset.y * minimum / distance),
  };
}

function currentPenaltyGatherTarget(target, descriptor) {
  const prat = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  const boxEdge = F32(prat * 18);
  const outside = descriptor.awardedNativeTeam === "A"
    ? { ...target, x: Math.min(target.x, CSSOCCER_BALL_CONSTANTS.pitchLength - boxEdge) }
    : { ...target, x: Math.max(target.x, boxEdge) };
  return currentTenYardTarget(outside, descriptor.ballPosition, "A");
}

function currentPenaltyKeeperTarget(descriptor) {
  const prat = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  return {
    x: descriptor.awardedNativeTeam === "A"
      ? F32(CSSOCCER_BALL_CONSTANTS.pitchLength - prat)
      : F32(prat),
    y: F32(CSSOCCER_BALL_CONSTANTS.pitchWidth / 2),
  };
}

function currentDirectKeeperTarget(descriptor, wall, defaultTarget) {
  if (wall.members.length < 2) return defaultTarget;
  const blocker = wall.members[wall.members.length - 2].target;
  const prat = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  const x = descriptor.awardedNativeTeam === "A"
    ? F32(CSSOCCER_BALL_CONSTANTS.pitchLength - prat)
    : F32(prat);
  const denominator = F32(blocker.x - descriptor.ballPosition.x);
  if (denominator === 0) return { x, y: defaultTarget.y };
  return {
    x,
    y: F32(
      descriptor.ballPosition.y
        + (blocker.y - descriptor.ballPosition.y)
          * (x - descriptor.ballPosition.x) / denominator,
    ),
  };
}

function selectCurrentFoulReceiver(players, descriptor) {
  const candidates = players.filter((player) => (
    player.active
    && player.role !== "keeper"
    && player.nativeTeamSlot === descriptor.awardedNativeTeam
    && player.nativePlayerNumber !== descriptor.taker.nativePlayerNumber
  ));
  if (candidates.length === 0) {
    throw new Error("Current foul restart has no legal active receiver.");
  }
  return candidates.reduce((nearest, player) => {
    const distance = sourceDistance2d({
      x: F32(player.position.x - descriptor.ballPosition.x),
      y: F32(player.position.y - descriptor.ballPosition.y),
    });
    return nearest === null || distance < nearest.distance
      ? { ...player, distance }
      : nearest;
  }, null);
}

function advanceCurrentFoulPositioning(match, nextTick, events) {
  if (match.kickoff.motion.status !== "settled") return match;
  const current = match.rules.foulRestart;
  const descriptor = current.descriptor;
  const taker = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === descriptor.taker.nativePlayerNumber,
  );
  if (taker === undefined || !taker.active) {
    throw new Error("Current foul readiness lost its active taker.");
  }
  events.push({
    type: "foul-restart-ready",
    tick: nextTick,
    kind: descriptor.kind,
    playerId: taker.id,
  });
  return {
    ...match,
    possession: collectPossession(match.possession, taker.nativePlayerNumber),
    rules: {
      ...match.rules,
      foulRestart: { ...current, phase: "decision" },
    },
    kickoff: {
      ...match.kickoff,
      phase: "rule-decision",
      ballStatus: "held-by-taker",
    },
  };
}

function decideCurrentFoulRestart(match, nextTick, events, command) {
  const current = match.rules.foulRestart;
  const descriptor = current.descriptor;
  const taker = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === descriptor.taker.nativePlayerNumber,
  );
  if (taker === undefined) throw new Error("Current foul decision lost its taker.");
  const userControlled = descriptor.awardedNativeTeam === match.control.nativeTeamSlot;
  const aim = currentBoundaryAim({ command, descriptor, taker });
  let aimed = aim === null ? match : aimCurrentBoundaryTaker(match, taker, aim, nextTick);
  const fire1 = (command.buttons & BUTTON_FIRE_1) !== 0;
  const fire2 = (command.buttons & BUTTON_FIRE_2) !== 0;
  if (userControlled && (aim === null || (!fire1 && !fire2))) return aimed;
  const action = descriptor.kind === "indirect" ? "punt" : "shot";
  return beginCurrentFoulKick({
    action,
    aim: aim ?? defaultCurrentBoundaryAim(descriptor),
    events,
    match: aimed,
    nextTick,
    taker,
    userControlled,
  });
}

function beginCurrentFoulKick({ action, aim, events, match, nextTick, taker, userControlled }) {
  const currentTaker = match.players.find(({ id }) => id === taker.id);
  if (
    currentTaker === undefined
    || match.possession.owner !== currentTaker.nativePlayerNumber
    || match.possession.inHands !== 0
  ) {
    throw new Error("Current foul kick lost its single feet owner.");
  }
  const players = initializeOpenPlayShotActions({
    match,
    nextTick,
    players: match.players,
    shotActions: [{
      charge: null,
      direction: action === "shot" && userControlled
        ? { x: F32(aim.x), y: F32(aim.y) }
        : null,
      drive: false,
      holderId: currentTaker.id,
      kind: action,
      passType: action === "punt" ? LIVE_PUNT_PASS_TYPE : -1,
      targetKeeperNativePlayer: currentTaker.nativePlayerNumber < 12 ? 12 : 1,
      userControlled,
    }],
  });
  events.push({
    type: `${match.rules.foulRestart.descriptor.kind}-restart-action-started`,
    tick: nextTick,
    playerId: currentTaker.id,
    nativePlayerNumber: currentTaker.nativePlayerNumber,
    action,
    userControlled,
  });
  return {
    ...match,
    phase: "foul-restart-action",
    players,
    rules: {
      ...match.rules,
      phase: "foul-restart-action",
      matchMode: 0,
      gameAction: 0,
      setPiece: 0,
      deadBallCount: 0,
      foulRestart: { ...match.rules.foulRestart, phase: "action", action },
    },
    kickoff: {
      ...match.kickoff,
      phase: "rule-action",
      ballStatus: "held-by-taker",
      pendingAction: {
        type: action,
        nativePlayerNumber: currentTaker.nativePlayerNumber,
      },
      action: {
        kind: action,
        takerId: currentTaker.id,
        receiverId: match.kickoff.owner.receiverId,
        startTick: nextTick,
        released: false,
        userControlled,
      },
      launch: {
        tick: nextTick,
        kind: action,
        takerId: currentTaker.id,
        source: "current rule decision, source placement, facing, and restart ball",
      },
    },
  };
}

function stepCurrentFoulKickAction(match, nextTick, events) {
  const current = match.rules.foulRestart;
  const taker = match.players.find(({ id }) => id === match.kickoff.action?.takerId);
  if (
    current?.phase !== "action"
    || taker?.liveShot?.phase !== "kick-held"
    || match.possession.owner !== taker.nativePlayerNumber
  ) {
    throw new Error("Current foul action lost its single kick owner.");
  }
  if (F32(taker.animation.frame + taker.animation.frameStep) < taker.liveShot.contact) {
    return match;
  }
  let released;
  if (taker.liveShot.kind === "shot") {
    const keeper = match.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === taker.liveShot.targetKeeperNativePlayer,
    );
    if (keeper === undefined || keeper.role !== "keeper") {
      throw new Error("Current foul shot lost its defending keeper.");
    }
    released = releaseCssoccerShot({
      ball: match.ball,
      charge: taker.liveShot.charge,
      direction: taker.liveShot.userControlled ? clone(taker.liveShot.direction) : null,
      drive: taker.liveShot.drive,
      keeper: {
        nativePlayerNumber: keeper.nativePlayerNumber,
        position: clone(keeper.position),
      },
      owner: liveShotHolder(taker),
      possession: match.possession,
      rng: match.rng.state,
      tick: match.ball.ball.tick,
      userControlled: taker.liveShot.userControlled,
    });
  } else if (taker.liveShot.kind === "punt") {
    released = releaseCssoccerPunt({
      ball: match.ball,
      keeperHands: false,
      owner: liveShotHolder(taker),
      possession: match.possession,
      rng: match.rng.state,
      tick: match.ball.ball.tick,
    });
  } else {
    throw new Error(`Unsupported current foul kick ${String(taker.liveShot.kind)}.`);
  }
  const release = { ...clone(released.release), tick: nextTick };
  const players = match.players.map((player) => (
    player.id === taker.id
      ? {
          ...clone(player),
          liveShot: {
            ...clone(player.liveShot),
            phase: player.liveShot.kind === "shot" ? "shot-released" : "punt-released",
            release,
            releaseBall: clone(released.ball),
          },
        }
      : player
  ));
  events.push({
    type: `${current.descriptor.kind}-restart-released`,
    tick: nextTick,
    playerId: taker.id,
    nativePlayerNumber: taker.nativePlayerNumber,
    displacement: clone(released.ball.ball.displacement),
  });
  return completeCurrentFoulRelease({
    match: {
      ...match,
      ball: released.ball,
      possession: released.possession,
      players,
      rng: { ...match.rng, state: released.rng },
    },
    nextTick,
    release,
  });
}

function completeCurrentFoulRelease({ match, nextTick, release }) {
  const current = match.rules.foulRestart;
  const descriptor = current.descriptor;
  const receiverId = match.kickoff.owner.receiverId;
  const activePlayerId = descriptor.awardedNativeTeam === match.control.nativeTeamSlot
    ? receiverId
    : selectNearestControlledPlayer(match).id;
  return {
    ...match,
    phase: "open-play",
    rules: {
      ...match.rules,
      phase: "open-play",
      matchMode: 0,
      gameAction: 0,
      setPiece: 0,
      deadBallCount: 0,
      state: clearCssoccerRuleRestart(match.rules.state),
      foulRestart: null,
      lastFoulRestart: {
        kind: descriptor.kind,
        mode: descriptor.mode,
        nativeTeamSlot: descriptor.awardedNativeTeam,
        takerNativePlayer: descriptor.taker.nativePlayerNumber,
        releaseTick: nextTick,
        releaseCount: 1,
        release: clone(release),
        wallNativePlayers: current.wall.members.map(({ nativePlayerNumber }) => (
          nativePlayerNumber
        )),
      },
    },
    clock: { ...match.clock, running: true },
    control: {
      ...match.control,
      activePlayerId,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    },
    kickoff: {
      ...match.kickoff,
      phase: "open-play",
      ballStatus: "live",
      pendingAction: null,
      action: {
        ...clone(match.kickoff.action),
        released: true,
        recovered: false,
        releaseTick: nextTick,
      },
    },
  };
}

function processBoundaryRestartRules(match, nextTick, events, command) {
  let current = match;
  if (current.rules.boundary == null) {
    const outcome = current.ball.outcome;
    const decision = classifyCssoccerBoundary({
      position: { x: outcome.position.x, y: outcome.position.y },
      lastTouch: current.possession.lastTouch,
      inGoal: current.ball.ball.inGoal,
    });
    if (decision === null) {
      throw new Error("Current boundary outcome could not be classified by bounds_rules.");
    }
    events.push({
      type: "boundary-awarded",
      tick: nextTick,
      kind: decision.kind,
      mode: decision.mode,
      nativeTeamSlot: decision.awardedNativeTeam,
      lastTouch: current.possession.lastTouch,
    });
    current = {
      ...current,
      phase: "boundary-delay",
      rules: {
        ...current.rules,
        phase: "boundary-delay",
        matchMode: decision.matchMode,
        gameAction: 1,
        boundary: {
          phase: "delay",
          decision: clone(decision),
          descriptor: null,
          setPiece: null,
          releaseCount: 0,
        },
      },
      kickoff: {
        ...current.kickoff,
        phase: "boundary-delay",
        ballStatus: "boundary-dead-ball",
        pendingAction: null,
        action: null,
        launch: null,
      },
      control: {
        ...current.control,
        activePlayerId: null,
        burstTimer: 0,
        passCharge: null,
        shotCharge: null,
      },
    };
  }

  const boundary = current.rules.boundary;
  if (boundary.phase === "delay") {
    if (current.ball.outcome?.status !== "restart-required") return current;
    return initializeCurrentBoundaryRestart(current, nextTick, events);
  }
  if (boundary.phase === "positioning") {
    return advanceCurrentBoundaryPositioning(current, nextTick, events);
  }
  if (boundary.phase === "pickup") {
    return completeCurrentBoundaryPickup(current, nextTick, events);
  }
  if (boundary.phase === "decision") {
    return decideCurrentBoundaryRestart(current, nextTick, events, command);
  }
  if (boundary.phase === "action") return current;
  throw new Error(`Unsupported current boundary phase ${String(boundary.phase)}.`);
}

function initializeCurrentBoundaryRestart(match, nextTick, events) {
  const decision = match.rules.boundary.decision;
  const tacticsState = currentFreePlayTacticsState(match.tactics);
  const baseZones = createCssoccerZoneState();
  const selectionZones = decision.kind === "throw-in"
    ? stepCssoccerZoneState(baseZones, {
        ballPosition: decision.incidentPosition,
        ballOutOfPlay: 0,
        matchMode: decision.matchMode,
        ballInHands: 0,
        possessionPlayer: 0,
      })
    : baseZones;
  const descriptor = initializeCssoccerRestart({
    boundary: decision,
    players: match.players
      .slice()
      .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber)
      .map((player) => ({
        nativePlayerNumber: player.nativePlayerNumber,
        active: player.active ? 1 : 0,
      })),
    tacticsState,
    seed: match.rng.state.seed,
    ballZones: {
      A: selectionZones.A.ballZone,
      B: selectionZones.B.ballZone,
    },
  });
  const ballPosition = clone(descriptor.ball.position);
  const ball = createBallMatchState({
    ball: {
      ...clone(match.ball.ball),
      tick: nextTick,
      position: ballPosition,
      previousPosition: ballPosition,
      displacement: clone(descriptor.ball.displacement),
      outPosition: null,
      inAir: descriptor.ball.inAir,
      inGoal: descriptor.ball.inGoal,
      outOfPlay: descriptor.ball.outOfPlay,
      still: descriptor.ball.still,
      speed: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: descriptor.ball.spin.xy,
        z: descriptor.ball.spin.z,
      },
      afterTouch: {
        user: 0,
        shotDirection: { x: F32(0), y: F32(0) },
      },
    },
    limbo: { active: 0, player: 0, contact: F32(0) },
    outcome: null,
  });
  const preKeeperTouch = descriptor.preKeeperTouchPatch.operation === "set"
    ? descriptor.preKeeperTouchPatch.value
    : match.possession.preKeeperTouch;
  const possession = createPossessionState({
    ...clone(match.possession),
    owner: 0,
    lastTouch: descriptor.ball.lastTouch,
    preKeeperTouch,
    inHands: 0,
    players: match.possession.players.map((player) => ({
      ...clone(player),
      possession: 0,
    })),
  });
  const targets = createCurrentBoundaryTargets(match, descriptor, tacticsState);
  let players = resetPlayersForCurrentBoundary(match.players, targets, nextTick);
  const motionPlayers = currentNativePlayerOrder(players);
  const motionTargets = currentNativePlayerOrder(targets);
  const teamBySlot = Object.fromEntries(["A", "B"].map((slot) => {
    const team = match.teams.find((candidate) => candidate.nativeTeamSlot === slot);
    if (!team) {
      throw new Error(`Boundary restart is missing native team slot ${slot}.`);
    }
    return [slot, team.country];
  }));
  const motion = createCssoccerCurrentKickoffPlayerMotion({
    ballPosition: { x: ballPosition.x, y: ballPosition.y },
    goToPositionDistance:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8,
    matchHalf: match.clock.matchHalf,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    pitchLength: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength),
    players: motionPlayers.map((player) => ({
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      teamRate: player.gameplay.pace,
      action: player.action.action.value,
      directionMode: 0,
      faceDirection: sourceFacingDirection(player.facing),
      position: { x: player.position.x, y: player.position.y },
      facing: clone(player.facing),
    })),
    selectedCountry: match.control.country,
    targetPlayers: motionTargets,
    teamBySlot,
  });
  players = bindCurrentBoundaryMotion(players, motion, nextTick);
  const taker = players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === descriptor.taker.nativePlayerNumber,
  );
  const receiver = selectCurrentBoundaryReceiver(players, descriptor);
  const country = teamBySlot[descriptor.awardedNativeTeam];
  const setPiece = createCssoccerSetPieceState(descriptor);
  events.push({
    type: "boundary-restart-initialized",
    tick: nextTick,
    kind: descriptor.kind,
    mode: descriptor.mode,
    nativeTeamSlot: descriptor.awardedNativeTeam,
    takerId: taker.id,
    takerNativePlayer: taker.nativePlayerNumber,
    position: clone(ballPosition),
  });
  return {
    ...match,
    phase: "boundary-restart",
    ball,
    possession,
    players,
    rules: {
      ...match.rules,
      phase: "boundary-restart",
      matchMode: descriptor.rules.matchMode,
      gameAction: descriptor.rules.gameAction,
      setPiece: descriptor.rules.setPiece,
      deadBallCount: descriptor.rules.deadBallCount,
      boundary: {
        ...clone(match.rules.boundary),
        phase: "positioning",
        descriptor: clone(descriptor),
        setPiece: clone(setPiece),
      },
    },
    clock: {
      ...match.clock,
      running: descriptor.clock.stopClock === 0 && match.clock.running,
    },
    control: {
      ...match.control,
      activePlayerId: descriptor.awardedNativeTeam === match.control.nativeTeamSlot
        ? taker.id
        : null,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    },
    kickoff: {
      ...match.kickoff,
      phase: "boundary-positioning",
      phaseTick: motion.tick,
      restartKind: descriptor.kind,
      owner: {
        country,
        nativeTeamSlot: descriptor.awardedNativeTeam,
        takerId: taker.id,
        receiverId: receiver.id,
      },
      ballStatus: "held-at-restart",
      pendingAction: null,
      action: null,
      launch: null,
      motion,
    },
  };
}

function advanceCurrentBoundaryPositioning(match, nextTick, events) {
  const boundary = match.rules.boundary;
  const descriptor = boundary.descriptor;
  const taker = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === descriptor.taker.nativePlayerNumber,
  );
  if (taker === undefined) throw new Error("Boundary positioning lost its current taker.");
  let setPiece;
  if (descriptor.kind === "throw-in") {
    setPiece = advanceCssoccerSetPiece(boundary.setPiece, {
      type: "readiness",
      alreadyThere: match.kickoff.motion.status === "settled" ? 1 : 0,
      playerOnOff: 0,
      takerDistanceToIncident: sourceDistance2d({
        x: F32(descriptor.incidentPosition.x - taker.position.x),
        y: F32(descriptor.incidentPosition.y - taker.position.y),
      }),
      ballInHands: match.possession.inHands,
    });
  } else {
    setPiece = advanceCssoccerSetPiece(boundary.setPiece, {
      type: "readiness",
      alreadyThere: match.kickoff.motion.status === "settled" ? 1 : 0,
      playerOnOff: 0,
      allStanding: match.kickoff.motion.status === "settled" ? 1 : 0,
      support: 0,
      holdUpPlay: 0,
    });
  }
  if (setPiece.phase === "awaiting-position") {
    return {
      ...match,
      rules: {
        ...match.rules,
        boundary: { ...boundary, setPiece: clone(setPiece) },
      },
    };
  }
  if (setPiece.phase === "awaiting-pickup") {
    events.push({
      type: "throw-in-pickup-started",
      tick: nextTick,
      playerId: taker.id,
      nativePlayerNumber: taker.nativePlayerNumber,
    });
    return {
      ...match,
      players: match.players.map((player) => (
        player.id === taker.id ? beginCurrentThrowPickup(player, nextTick) : player
      )),
      rules: {
        ...match.rules,
        boundary: {
          ...boundary,
          phase: "pickup",
          setPiece: clone(setPiece),
        },
      },
      kickoff: { ...match.kickoff, phase: "boundary-pickup" },
    };
  }
  if (setPiece.phase !== "awaiting-decision") {
    throw new Error("Boundary positioning reached an unsupported set-piece phase.");
  }
  const possession = collectPossession(match.possession, taker.nativePlayerNumber);
  events.push({
    type: "boundary-restart-ready",
    tick: nextTick,
    kind: descriptor.kind,
    playerId: taker.id,
  });
  return {
    ...match,
    possession,
    rules: {
      ...match.rules,
      boundary: {
        ...boundary,
        phase: "decision",
        setPiece: clone(setPiece),
      },
    },
    kickoff: {
      ...match.kickoff,
      phase: "boundary-decision",
      ballStatus: "held-by-taker",
    },
  };
}

function completeCurrentBoundaryPickup(match, nextTick, events) {
  const boundary = match.rules.boundary;
  const taker = match.players.find(
    ({ nativePlayerNumber }) => (
      nativePlayerNumber === boundary.descriptor.taker.nativePlayerNumber
    ),
  );
  if (taker?.liveRestart?.phase !== "pickup-complete") return match;
  const setPiece = advanceCssoccerSetPiece(boundary.setPiece, {
    type: "pickup-complete",
  });
  const possession = collectPossession(
    match.possession,
    taker.nativePlayerNumber,
    { inHands: true },
  );
  events.push({
    type: "throw-in-pickup-complete",
    tick: nextTick,
    playerId: taker.id,
    nativePlayerNumber: taker.nativePlayerNumber,
  });
  return {
    ...match,
    possession,
    players: match.players.map((player) => (
      player.id === taker.id ? beginCurrentThrowAction(player, nextTick) : player
    )),
    rules: {
      ...match.rules,
      matchMode: setPiece.rules.matchMode,
      boundary: {
        ...boundary,
        phase: "decision",
        setPiece: clone(setPiece),
      },
    },
    kickoff: {
      ...match.kickoff,
      phase: "boundary-decision",
      ballStatus: "held-in-hands",
    },
  };
}

function decideCurrentBoundaryRestart(match, nextTick, events, command) {
  const boundary = match.rules.boundary;
  const descriptor = boundary.descriptor;
  const taker = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === descriptor.taker.nativePlayerNumber,
  );
  if (taker === undefined) throw new Error("Boundary decision lost its current taker.");
  const userControlled = descriptor.awardedNativeTeam === match.control.nativeTeamSlot;
  const aim = currentBoundaryAim({ command, descriptor, taker });
  let aimed = match;
  if (aim !== null) aimed = aimCurrentBoundaryTaker(match, taker, aim, nextTick);
  const fire1 = (command.buttons & BUTTON_FIRE_1) !== 0;
  const fire2 = (command.buttons & BUTTON_FIRE_2) !== 0;
  if (userControlled && (aim === null || (!fire1 && !fire2))) return aimed;
  const receiver = aimed.players.find(({ id }) => id === aimed.kickoff.owner.receiverId);
  if (receiver === undefined) throw new Error("Boundary decision lost its current receiver.");
  const action = descriptor.kind === "corner"
    ? "shot"
    : descriptor.kind === "goal-kick"
      ? "punt"
      : "throw";
  const decisionEvent = action === "throw"
    ? { type: "decision", action }
    : { type: "decision", action };
  const setPiece = advanceCssoccerSetPiece(boundary.setPiece, decisionEvent);
  if (descriptor.kind === "throw-in") {
    return releaseCurrentBoundaryThrow({
      aim: aim ?? defaultCurrentBoundaryAim(descriptor),
      events,
      match: aimed,
      nextTick,
      setPiece,
      taker,
      userControlled,
    });
  }
  return beginCurrentBoundaryKick({
    aim: aim ?? defaultCurrentBoundaryAim(descriptor),
    events,
    match: aimed,
    nextTick,
    setPiece,
    taker,
    userControlled,
  });
}

function currentFreePlayTacticsState(tactics) {
  return createCssoccerTacticsState({
    A: {
      formationId: tactics.formationId,
      tableSha256: tactics.tableSha256,
      values: clone(tactics.slots.A),
    },
    B: {
      formationId: tactics.formationId,
      tableSha256: tactics.tableSha256,
      values: clone(tactics.slots.B),
    },
  });
}

function createCurrentBoundaryTargets(match, descriptor, tacticsState) {
  return match.players.map((player) => {
    const isTaker = player.nativePlayerNumber === descriptor.taker.nativePlayerNumber;
    let target;
    let targetOwner;
    if (isTaker) {
      target = clone(descriptor.taker.target.world);
      targetOwner = `RULES.CPP ${descriptor.kind} taker position`;
    } else if (player.role === "keeper") {
      target = { x: F32(player.position.x), y: F32(player.position.y) };
      targetOwner = "INTELL.CPP goalkeeper restart hold";
    } else {
      const zonal = resolveCssoccerZonalTarget(tacticsState, {
        nativeTeamSlot: player.nativeTeamSlot,
        nativePlayerNumber: player.nativePlayerNumber,
        ballZone: descriptor.ballZones[player.nativeTeamSlot],
        teamInPossession: player.nativeTeamSlot === descriptor.awardedNativeTeam,
      });
      target = clone(zonal.target);
      targetOwner = `INTELL.CPP find_zonal_target row ${zonal.tableRow}`;
    }
    return {
      id: player.id,
      country: player.country,
      nativeTeamSlot: player.nativeTeamSlot,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      role: player.role === "keeper" ? "keeper" : isTaker ? "taker" : "outfield",
      target,
      targetOwner,
    };
  });
}

function resetPlayersForCurrentBoundary(players, targets, nextTick) {
  const targetById = new Map(targets.map((target) => [target.id, target]));
  return players.map((source) => {
    const target = targetById.get(source.id);
    if (target === undefined) throw new Error(`Current boundary lost player ${source.id}.`);
    const player = clearLivePlayerActions(source);
    const position = { ...clone(player.position), z: F32(0) };
    return {
      ...player,
      role: target.role,
      targetOwner: target.targetOwner,
      target: { ...clone(target.target), z: F32(0) },
      previousPosition: clone(position),
      position,
      previousFacing: clone(player.facing),
      velocity: { x: F32(0), y: F32(0), z: F32(0) },
      intelligence: { special: 0, move: 0, count: 0 },
      ballState: 0,
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: player.facing.x,
        facingY: player.facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "stand",
        id: STAND_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        frame: F32(0),
        frameStep: STAND_FRAME_STEP,
        pending: null,
        tick: nextTick,
      },
    };
  });
}

function currentNativePlayerOrder(players) {
  return [...players].sort(
    (left, right) => left.nativePlayerNumber - right.nativePlayerNumber,
  );
}

function bindCurrentBoundaryMotion(players, motion, nextTick) {
  const motionById = new Map(motion.players.map((player) => [player.id, player]));
  return players.map((player) => {
    const current = motionById.get(player.id);
    if (current === undefined) throw new Error(`Boundary motion lost ${player.id}.`);
    return {
      ...clone(player),
      liveMotion: currentBoundaryLiveMotion(current),
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: current.action,
        facingX: current.facing.x,
        facingY: current.facing.y,
      }),
    };
  });
}

function currentBoundaryLiveMotion(current) {
  return {
    kind: current.action === CSSOCCER_NATIVE_ACTIONS.RUN ? "run" : "stand",
    teamRate: current.teamRate,
    target: clone(current.target),
    goStep: current.goStep,
    goCount: current.goCount,
    goDisplacement: clone(current.goDisplacement),
    directionMode: current.directionMode,
    resetAnimationFrame: current.action === CSSOCCER_NATIVE_ACTIONS.STAND,
    sideStepDirection: null,
    animationId: null,
    animationFrameStep: null,
  };
}

function selectCurrentBoundaryReceiver(players, descriptor) {
  const taker = descriptor.taker.nativePlayerNumber;
  const ball = descriptor.ball.position;
  const candidates = players.filter((player) => (
    player.active
    && player.nativeTeamSlot === descriptor.awardedNativeTeam
    && player.nativePlayerNumber !== taker
    && player.role !== "keeper"
  ));
  if (candidates.length === 0) {
    throw new Error("Current boundary restart has no legal outfield receiver.");
  }
  return candidates.reduce((nearest, player) => {
    const distance = sourceDistance2d({
      x: F32(player.position.x - ball.x),
      y: F32(player.position.y - ball.y),
    });
    return nearest === null || distance < nearest.distance
      ? { ...player, distance }
      : nearest;
  }, null);
}

function beginCurrentThrowPickup(player, nextTick) {
  return {
    ...clone(player),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    intelligence: {
      special: 0,
      move: 1,
      count: Math.trunc(1 / PICKUP_FRAME_STEP),
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.PICKUP,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "throw-in-pickup",
      id: PICKUP_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.PICKUP,
      frame: F32(0),
      frameStep: PICKUP_FRAME_STEP,
      pending: "pickup-complete",
      tick: nextTick,
    },
    liveMotion: {
      ...clone(player.liveMotion),
      kind: "throw-in-pickup",
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 2,
      resetAnimationFrame: false,
      animationId: PICKUP_ANIMATION,
      animationFrameStep: PICKUP_FRAME_STEP,
    },
    liveRestart: { phase: "pickup", startTick: nextTick },
  };
}

function beginCurrentThrowAction(player, nextTick) {
  return {
    ...clone(player),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    intelligence: { special: 0, move: 0, count: 0 },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.THROW,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "throw-in-ready",
      id: THROW_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.THROW,
      frame: F32(0),
      frameStep: THROW_FRAME_STEP,
      pending: "release-command",
      tick: nextTick,
    },
    liveMotion: {
      ...clone(player.liveMotion),
      kind: "throw-in-ready",
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 2,
      resetAnimationFrame: false,
      animationId: THROW_ANIMATION,
      animationFrameStep: THROW_FRAME_STEP,
    },
    liveRestart: { phase: "throw-ready", startTick: nextTick, aim: null },
  };
}

function currentBoundaryAim({ command, descriptor, taker }) {
  if (command.moveX === 0 && command.moveY === 0) return null;
  let x = F32(command.moveX / 127);
  let y = F32(command.moveY / 127);
  let high = false;
  if (descriptor.kind === "throw-in") {
    const bottom = descriptor.boundary.boundary === "bottom-touchline";
    if ((bottom && y > 0) || (!bottom && y < 0)) {
      high = true;
      y = F32(-y);
    }
  }
  const distance = sourceDistance2d({ x, y });
  if (!(distance > 0)) return clone(taker.facing);
  return { x: F32(x / distance), y: F32(y / distance), high };
}

function defaultCurrentBoundaryAim(descriptor) {
  if (descriptor.kind === "throw-in") {
    return {
      x: F32(0),
      y: descriptor.boundary.boundary === "bottom-touchline" ? F32(-1) : F32(1),
      high: false,
    };
  }
  return {
    x: descriptor.awardedNativeTeam === "A" ? F32(1) : F32(-1),
    y: F32(0),
    high: false,
  };
}

function aimCurrentBoundaryTaker(match, taker, aim, nextTick) {
  return {
    ...match,
    players: match.players.map((player) => {
      if (player.id !== taker.id) return player;
      return {
        ...clone(player),
        previousFacing: clone(player.facing),
        facing: { x: aim.x, y: aim.y },
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: player.action.action.value,
          facingX: aim.x,
          facingY: aim.y,
        }),
        ...(player.liveRestart === undefined
          ? {}
          : { liveRestart: { ...clone(player.liveRestart), aim: clone(aim) } }),
      };
    }),
  };
}

function releaseCurrentBoundaryThrow({
  aim,
  events,
  match,
  nextTick,
  setPiece,
  taker,
  userControlled,
}) {
  const currentTaker = match.players.find(({ id }) => id === taker.id);
  if (
    currentTaker === undefined
    || match.possession.owner !== currentTaker.nativePlayerNumber
    || match.possession.inHands !== 1
  ) {
    throw new Error("Throw-in release lost its current hands owner.");
  }
  const power = F32(5 + currentTaker.gameplay.power / 16);
  const displacement = {
    x: F32(aim.x * power),
    y: F32(aim.y * power),
    z: F32(aim.high ? power : power / 2),
  };
  const ball = createBallMatchState({
    ball: {
      ...clone(match.ball.ball),
      tick: nextTick,
      displacement,
      inAir: 1,
      inGoal: 0,
      outOfPlay: 0,
      still: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
    },
    limbo: createBallLimbo({
      player: currentTaker.nativePlayerNumber,
      contact: THROW_CONTACT,
    }),
    outcome: null,
  });
  const possession = releasePossession(match.possession);
  const players = match.players.map((player) => {
    if (player.id !== currentTaker.id) return player;
    return {
      ...clone(player),
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.THROW,
        facingX: aim.x,
        facingY: aim.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "throw-in-release",
        id: THROW_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.THROW,
        frame: F32(0),
        frameStep: THROW_FRAME_STEP,
        pending: "ball-limbo-contact",
        tick: nextTick,
      },
      liveMotion: {
        ...clone(player.liveMotion),
        kind: "throw-in-release",
        goCount: 0,
        goDisplacement: { x: F32(0), y: F32(0) },
        directionMode: 2,
        animationId: THROW_ANIMATION,
        animationFrameStep: THROW_FRAME_STEP,
      },
      liveRestart: {
        phase: "throw-released",
        startTick: nextTick,
        releaseTick: nextTick,
        userControlled,
        aim: clone(aim),
      },
    };
  });
  events.push({
    type: "throw-in-released",
    tick: nextTick,
    playerId: currentTaker.id,
    nativePlayerNumber: currentTaker.nativePlayerNumber,
    displacement: clone(displacement),
    userControlled,
  });
  return completeCurrentBoundaryRelease({
    match: { ...match, ball, possession, players },
    nextTick,
    setPiece,
    release: { kind: "throw", displacement, userControlled },
  });
}

function beginCurrentBoundaryKick({
  aim,
  events,
  match,
  nextTick,
  setPiece,
  taker,
  userControlled,
}) {
  const descriptor = match.rules.boundary.descriptor;
  const currentTaker = match.players.find(({ id }) => id === taker.id);
  if (
    currentTaker === undefined
    || match.possession.owner !== currentTaker.nativePlayerNumber
    || match.possession.inHands !== 0
  ) {
    throw new Error("Boundary kick lost its current feet owner.");
  }
  const kind = descriptor.kind === "corner" ? "shot" : "punt";
  const action = {
    charge: null,
    direction: kind === "shot" && userControlled
      ? { x: F32(aim.x), y: F32(aim.y) }
      : null,
    drive: false,
    holderId: currentTaker.id,
    kind,
    passType: kind === "punt" ? LIVE_PUNT_PASS_TYPE : -1,
    targetKeeperNativePlayer: currentTaker.nativePlayerNumber < 12 ? 12 : 1,
    userControlled,
  };
  const players = initializeOpenPlayShotActions({
    match,
    nextTick,
    players: match.players,
    shotActions: [action],
  });
  events.push({
    type: `${descriptor.kind}-action-started`,
    tick: nextTick,
    playerId: currentTaker.id,
    nativePlayerNumber: currentTaker.nativePlayerNumber,
    userControlled,
  });
  return {
    ...match,
    phase: "boundary-action",
    players,
    rules: {
      ...match.rules,
      phase: "boundary-action",
      matchMode: setPiece.rules.matchMode,
      gameAction: setPiece.rules.gameAction,
      setPiece: setPiece.rules.setPiece,
      deadBallCount: setPiece.rules.deadBallCount,
      boundary: {
        ...match.rules.boundary,
        phase: "action",
        setPiece: clone(setPiece),
      },
    },
    kickoff: {
      ...match.kickoff,
      phase: "boundary-action",
      ballStatus: "held-by-taker",
      pendingAction: clone(setPiece.actionRequest),
      action: {
        kind,
        takerId: currentTaker.id,
        receiverId: match.kickoff.owner.receiverId,
        startTick: nextTick,
        released: false,
        userControlled,
      },
      launch: {
        tick: nextTick,
        kind,
        takerId: currentTaker.id,
        source: "current boundary decision, position, facing, and restart ball",
      },
    },
  };
}

function completeCurrentBoundaryRelease({ match, nextTick, setPiece, release }) {
  const descriptor = match.rules.boundary.descriptor;
  const receiverId = match.kickoff.owner.receiverId;
  let activePlayerId;
  if (descriptor.awardedNativeTeam === match.control.nativeTeamSlot) {
    activePlayerId = receiverId;
  } else {
    activePlayerId = selectNearestControlledPlayer(match).id;
  }
  return {
    ...match,
    phase: "open-play",
    rules: {
      ...match.rules,
      phase: "open-play",
      matchMode: 0,
      gameAction: 0,
      setPiece: 0,
      deadBallCount: 0,
      boundary: null,
      lastBoundaryRestart: {
        kind: descriptor.kind,
        mode: descriptor.mode,
        nativeTeamSlot: descriptor.awardedNativeTeam,
        takerNativePlayer: descriptor.taker.nativePlayerNumber,
        releaseTick: nextTick,
        releaseCount: 1,
        release: clone(release),
        setPieceStatus: setPiece.status,
      },
    },
    clock: { ...match.clock, running: true },
    control: {
      ...match.control,
      activePlayerId,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    },
    kickoff: {
      ...match.kickoff,
      phase: "open-play",
      ballStatus: "live",
      pendingAction: null,
      action: {
        ...clone(match.kickoff.action),
        released: true,
        recovered: false,
        releaseTick: nextTick,
      },
    },
  };
}

/** BALL.CPP good_goal/own_goal -> reset_shot. */
function resetQualifiedGoalShot(ball) {
  return createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      spin: { ...clone(ball.ball.spin), swerve: 0 },
      afterTouch: {
        user: 0,
        shotDirection: { x: F32(0), y: F32(0) },
      },
    },
  });
}

/** BALL.CPP respot_ball -> RULES.CPP init_match_mode/init_centre. */
function initializePostGoalCentre(match, nextTick, events) {
  let goal = resolveCssoccerCurrentPostGoalHandoff(match.goal, { match });
  const handoff = goal.centreHandoff;
  const setup = createCurrentCentreSetup(match, handoff.nativeTeamSlot);
  const centre = {
    x: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x),
    y: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y),
    z: F32(CSSOCCER_KICKOFF_CONSTANTS.ballDiameter / 2),
  };
  const ball = createBallMatchState({
    ball: {
      ...clone(match.ball.ball),
      tick: nextTick,
      position: centre,
      previousPosition: centre,
      displacement: { x: F32(0), y: F32(0), z: F32(0) },
      outPosition: null,
      inAir: 0,
      inGoal: 0,
      outOfPlay: 0,
      still: 1,
      speed: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
      afterTouch: {
        user: 0,
        shotDirection: { x: F32(0), y: F32(0) },
      },
    },
    limbo: { active: 0, player: 0, contact: F32(0) },
    outcome: null,
  });
  const possession = createPossessionState({
    ...clone(match.possession),
    owner: 0,
    lastTouch: 0,
    previousTouch: 0,
    preKeeperTouch: 0,
    inHands: 0,
    cannotPickUp: 0,
    players: match.possession.players.map((player) => ({
      ...clone(player),
      possession: 0,
    })),
  });
  const players = resetPlayersForCurrentCentre(match.players, setup.players, nextTick);
  const motionPlayers = currentNativePlayerOrder(players);
  const motionTargets = currentNativePlayerOrder(setup.players);
  const motion = createCssoccerCurrentKickoffPlayerMotion({
    ballPosition: { x: centre.x, y: centre.y },
    goToPositionDistance:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8,
    matchHalf: match.clock.matchHalf,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    pitchLength: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength),
    players: motionPlayers.map((player) => ({
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      teamRate: player.gameplay.pace,
      action: player.action.action.value,
      directionMode: 0,
      faceDirection: sourceFacingDirection(player.facing),
      position: { x: player.position.x, y: player.position.y },
      facing: clone(player.facing),
    })),
    selectedCountry: match.control.country,
    targetPlayers: motionTargets,
    teamBySlot: setup.teamBySlot,
  });
  const kickoff = {
    phase: "centre-positioning",
    phaseTick: motion.tick,
    restartKind: "post-goal",
    goalSequence: goal.goalSequence,
    owner: clone(setup.owner),
    ballStatus: "held-at-centre",
    pendingAction: null,
    action: null,
    launch: null,
    motion,
    readiness: deriveKickoffReadiness({ players, ball, officials: match.officials }),
  };
  goal = resumeCssoccerCurrentGoalState(goal, { score: match.score });
  events.push({
    type: "centre-restart-initialized",
    tick: nextTick,
    goalSequence: goal.goalSequence,
    country: setup.owner.country,
    nativeTeamSlot: setup.owner.nativeTeamSlot,
    takerId: setup.owner.takerId,
    receiverId: setup.owner.receiverId,
  });
  return {
    ...match,
    phase: "post-goal-centre",
    goal,
    ball,
    possession,
    players,
    rules: {
      ...match.rules,
      phase: "centre-restart",
      matchMode: handoff.matchMode,
      gameAction: CSSOCCER_KICKOFF_CONSTANTS.centreGameAction,
      setPiece: CSSOCCER_KICKOFF_CONSTANTS.centreSetPiece,
      deadBallCount: CSSOCCER_KICKOFF_CONSTANTS.centreDeadBallTicks,
    },
    clock: { ...match.clock, running: false },
    control: {
      ...match.control,
      activePlayerId: null,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    },
    kickoff,
  };
}

function createCurrentCentreSetup(match, nativeTeamSlot) {
  const teamBySlot = Object.fromEntries(["A", "B"].map((slot) => {
    const countries = new Set(match.players
      .filter((player) => player.nativeTeamSlot === slot)
      .map((player) => player.country));
    if (countries.size !== 1) {
      throw new Error(`Current centre native team ${slot} lost stable country ownership.`);
    }
    return [slot, [...countries][0]];
  }));
  const takers = selectCurrentCentreTakers(match, nativeTeamSlot);
  const targets = match.players.map((player) => {
    let role = "outfield";
    let target;
    let targetOwner;
    if (player.nativePlayerNumber === 1) {
      role = "keeper";
      target = {
        x: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.keeperOffline.value,
        y: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y - 1),
      };
      targetOwner = "INTELL.CPP find_zonal_target KP_A";
    } else if (player.nativePlayerNumber === 12) {
      role = "keeper";
      target = {
        x: F32(
          CSSOCCER_KICKOFF_CONSTANTS.pitchLength
          - CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.keeperOffline.value
        ),
        y: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y - 1),
      };
      targetOwner = "INTELL.CPP find_zonal_target KP_B";
    } else if (player.nativePlayerNumber === takers.taker) {
      role = "taker";
      target = {
        x: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x),
        y: F32(
          CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y
          + (nativeTeamSlot === "A" ? -10 : 10)
        ),
      };
      targetOwner = "INTELL.CPP centre_pos centre_guy_1";
    } else if (player.nativePlayerNumber === takers.receiver) {
      role = "receiver";
      target = {
        x: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x + 5),
        y: F32(
          CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y
          + (nativeTeamSlot === "A" ? 10 : -10)
        ),
      };
      targetOwner = "INTELL.CPP centre_pos centre_guy_2";
    } else {
      const row = player.nativeTeamSlot === nativeTeamSlot
        ? CSSOCCER_KICKOFF_CONSTANTS.centreTacticRow
        : CSSOCCER_KICKOFF_CONSTANTS.defendingTacticRow;
      const index = player.nativeTeamSlot === "A"
        ? player.nativePlayerNumber - 2
        : player.nativePlayerNumber - 13;
      const [sourceX, sourceY] = match.tactics.slots[player.nativeTeamSlot][row][index];
      target = player.nativeTeamSlot === "A"
        ? { x: F32(sourceX), y: F32(sourceY) }
        : {
            x: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength - sourceX),
            y: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchWidth - sourceY),
          };
      targetOwner = `INTELL.CPP get_target row ${row}`;
    }
    return {
      id: player.id,
      country: player.country,
      nativeTeamSlot: player.nativeTeamSlot,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      role,
      target: { x: F32(target.x), y: F32(target.y) },
      targetOwner,
    };
  });
  const taker = targets.find((player) => player.nativePlayerNumber === takers.taker);
  const receiver = targets.find((player) => player.nativePlayerNumber === takers.receiver);
  return {
    teamBySlot,
    owner: {
      country: teamBySlot[nativeTeamSlot],
      nativeTeamSlot,
      takerId: taker.id,
      takerNativePlayerNumber: taker.nativePlayerNumber,
      receiverId: receiver.id,
      receiverNativePlayerNumber: receiver.nativePlayerNumber,
    },
    players: targets,
  };
}

function selectCurrentCentreTakers(match, nativeTeamSlot) {
  const minimumPlayer = nativeTeamSlot === "A" ? 2 : 13;
  const candidates = match.players.filter((player) => (
    player.nativeTeamSlot === nativeTeamSlot
    && player.role !== "keeper"
    && player.active
  ));
  const selected = [];
  for (let pass = 0; pass < 2; pass += 1) {
    let minimum = 1_000;
    let picked = null;
    for (const player of candidates) {
      if (selected.includes(player.nativePlayerNumber)) continue;
      const index = player.nativePlayerNumber - minimumPlayer;
      const [x, y] = match.tactics.slots[nativeTeamSlot][
        CSSOCCER_KICKOFF_CONSTANTS.centreTacticRow
      ][index];
      const distance = Math.trunc(sourceDistance2d({
        x: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x - F32(x)),
        y: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y - F32(y)),
      }));
      if (distance < minimum) {
        minimum = distance;
        picked = player.nativePlayerNumber;
      }
    }
    if (picked === null) {
      throw new Error(`Current centre native team ${nativeTeamSlot} has no two legal takers.`);
    }
    selected.push(picked);
  }
  return { taker: selected[0], receiver: selected[1] };
}

function resetPlayersForCurrentCentre(players, targets, nextTick) {
  const targetById = new Map(targets.map((target) => [target.id, target]));
  return players.map((source) => {
    const target = targetById.get(source.id);
    if (target === undefined) throw new Error(`Current centre lost player ${source.id}.`);
    const player = clearLivePlayerActions(source);
    const position = { ...clone(player.position), z: F32(0) };
    return {
      ...player,
      role: target.role,
      targetOwner: target.targetOwner,
      target: { ...clone(target.target), z: F32(0) },
      previousPosition: clone(position),
      position,
      previousFacing: clone(player.facing),
      velocity: { x: F32(0), y: F32(0), z: F32(0) },
      intelligence: { special: 0, move: 0, count: 0 },
      ballState: 0,
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: player.facing.x,
        facingY: player.facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "stand",
        id: STAND_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        frame: F32(0),
        frameStep: STAND_FRAME_STEP,
        pending: null,
        tick: nextTick,
      },
    };
  });
}

/** ACTIONS.CPP someone_has_scored -> scorer_go/go_to_scorer/player_shame. */
function stepGoalCelebrationPlayers(match, nextTick, events) {
  if (match.goal.phase === "awaiting-post-goal-handoff") {
    if (!match.players.some((player) => player.liveCelebration !== undefined)) return match;
    return {
      ...match,
      players: match.players.map((player) => settleGoalPlayer(player, nextTick)),
    };
  }
  if (match.goal.phase !== "celebration") return match;
  const activeGoal = match.goal.activeGoal;
  const scorer = match.players.find(({ id }) => id === activeGoal.scorer.playerId);
  if (scorer === undefined) throw new Error("Goal celebration lost the live scorer.");
  const starting = scorer.liveCelebration?.goalSequence !== match.goal.goalSequence;
  if (starting) {
    events.push({
      type: "goal-celebration-started",
      tick: nextTick,
      goalSequence: match.goal.goalSequence,
      scorerId: scorer.id,
      ownGoal: activeGoal.ownGoal,
    });
  }
  const players = match.players.map((player) => {
    if (activeGoal.ownGoal) {
      return player.id === scorer.id
        ? stepGoalShamePlayer(player, match.goal.goalSequence, nextTick)
        : settleGoalPlayer(player, nextTick);
    }
    if (player.id === scorer.id) {
      return stepGoalScorerPlayer(player, match, nextTick);
    }
    if (player.country === activeGoal.scoringCountry && player.role !== "keeper") {
      return stepGoalTeammatePlayer(player, scorer, match, nextTick);
    }
    return settleGoalPlayer(player, nextTick);
  });
  return { ...match, players };
}

function stepGoalScorerPlayer(source, match, nextTick) {
  const goalSequence = match.goal.goalSequence;
  const current = source.liveCelebration?.goalSequence === goalSequence
    ? clone(source)
    : null;
  if (current === null) {
    const player = clearLivePlayerActions(source);
    if ((match.rng.state.seed & 2) !== 0) {
      return goalCelebrationPlayer(player, {
        nextTick,
        goalSequence,
        phase: "knee",
        animation: GOAL_KNEE_ANIMATION,
        frameStep: GOAL_KNEE_FRAME_STEP,
        displacement: {
          x: F32(player.facing.x * 3),
          y: F32(player.facing.y * 3),
        },
        goCount: Math.trunc(1 / GOAL_KNEE_FRAME_STEP),
      });
    }
    const taunt = GOAL_TAUNTS[
      Math.trunc((match.rng.state.seed * GOAL_TAUNTS.length) / 128)
    ];
    return goalCelebrationPlayer(player, {
      nextTick,
      goalSequence,
      phase: "taunt",
      animation: taunt.animation,
      frameStep: taunt.frameStep,
      displacement: { x: F32(0), y: F32(0) },
      goCount: 0,
    });
  }
  const live = current.liveCelebration;
  let position = clone(current.position);
  let displacement = clone(live.displacement);
  let phase = live.phase;
  let goCount = live.goCount;
  let animation = current.animation.id;
  let frameStep = current.animation.frameStep;
  if (phase === "knee" || phase === "duck") {
    const planar = updateSourcePosition2d({
      position: { x: position.x, y: position.y },
      displacement,
    });
    position = { ...planar, z: position.z };
  }
  if (phase === "knee") {
    displacement = {
      x: F32(displacement.x * 0.94),
      y: F32(displacement.y * 0.94),
    };
    goCount -= 1;
    if (goCount < 1) {
      phase = "duck";
      animation = GOAL_DUCK_ANIMATION;
      frameStep = GOAL_DUCK_FRAME_STEP;
      displacement = {
        x: F32(current.facing.x * GOAL_DUCK_SPEED),
        y: F32(current.facing.y * GOAL_DUCK_SPEED),
      };
    }
  }
  return {
    ...current,
    previousPosition: clone(current.position),
    previousFacing: clone(current.facing),
    position,
    velocity: { ...clone(displacement), z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: current.id,
      actionId: GOAL_CELEBRATION_ACTION,
      facingX: current.facing.x,
      facingY: current.facing.y,
    }),
    animation: {
      ...clone(current.animation),
      kind: `goal-${phase}`,
      id: animation,
      sourceActionId: GOAL_CELEBRATION_ACTION,
      frame: animation === current.animation.id
        ? F32(current.animation.frame + current.animation.frameStep)
        : F32(0),
      frameStep,
      tick: nextTick,
    },
    liveCelebration: {
      ...clone(live),
      phase,
      displacement,
      goCount,
    },
  };
}

function stepGoalTeammatePlayer(source, scorer, match, nextTick) {
  const player = source.liveCelebration?.goalSequence === match.goal.goalSequence
    ? clone(source)
    : clearLivePlayerActions(source);
  const target = {
    x: F32(scorer.position.x - player.position.x),
    y: F32(scorer.position.y - player.position.y),
  };
  const distance = sourceDistance2d(target);
  const localNumber = player.nativePlayerNumber > 11
    ? player.nativePlayerNumber - 11
    : player.nativePlayerNumber;
  if (distance < 8 + (localNumber * 6)) {
    return goalCelebrationPlayer(player, {
      nextTick,
      goalSequence: match.goal.goalSequence,
      phase: "taunt",
      animation: GOAL_CELEBRATION_ANIMATION,
      frameStep: GOAL_CELEBRATION_FRAME_STEP,
      displacement: { x: F32(0), y: F32(0) },
      goCount: 0,
    });
  }
  const facing = {
    x: F32(target.x / distance),
    y: F32(target.y / distance),
  };
  const rate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(rate)) throw new Error("Goal runner lost its current team rate.");
  const speed = sourceFullPlayerSpeed({
    pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
    teamRate: rate,
    celebrating: true,
    celebrationSpeed: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate: rate },
    ).celebrationSpeed,
  });
  const displacement = sourceForwardDisplacement({
    facing,
    targetOffset: target,
    speed,
  }).displacement;
  const planar = updateSourcePosition2d({
    position: { x: player.position.x, y: player.position.y },
    displacement,
  });
  return {
    ...player,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position: { ...planar, z: player.position.z },
    facing,
    velocity: { ...clone(displacement), z: F32(0) },
    target: { ...clone(scorer.position) },
    targetOwner: "ACTIONS.CPP go_to_scorer",
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "goal-run-to-scorer",
      id: 109,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      frame: player.animation.kind === "goal-run-to-scorer"
        ? F32(player.animation.frame + player.animation.frameStep)
        : F32(0),
      frameStep: F32(2 / 27),
      pending: null,
      tick: nextTick,
    },
    liveCelebration: {
      goalSequence: match.goal.goalSequence,
      phase: "approach-scorer",
      displacement,
      goCount: 0,
    },
  };
}

function stepGoalShamePlayer(source, goalSequence, nextTick) {
  const player = source.liveCelebration?.goalSequence === goalSequence
    ? clone(source)
    : clearLivePlayerActions(source);
  return goalCelebrationPlayer(player, {
    nextTick,
    goalSequence,
    phase: "shame",
    animation: 93,
    frameStep: F32(2 / 82),
    displacement: { x: F32(0), y: F32(0) },
    goCount: 0,
  });
}

function goalCelebrationPlayer(source, {
  nextTick,
  goalSequence,
  phase,
  animation,
  frameStep,
  displacement,
  goCount,
}) {
  const continues = source.liveCelebration?.goalSequence === goalSequence
    && source.animation.id === animation;
  return {
    ...source,
    previousPosition: clone(source.position),
    previousFacing: clone(source.facing),
    velocity: { ...clone(displacement), z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: source.id,
      actionId: GOAL_CELEBRATION_ACTION,
      facingX: source.facing.x,
      facingY: source.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: `goal-${phase}`,
      id: animation,
      sourceActionId: GOAL_CELEBRATION_ACTION,
      frame: continues
        ? F32(source.animation.frame + source.animation.frameStep)
        : F32(0),
      frameStep,
      pending: null,
      tick: nextTick,
    },
    liveCelebration: { goalSequence, phase, displacement, goCount },
  };
}

function settleGoalPlayer(source, nextTick) {
  const player = clearLivePlayerActions(source);
  return {
    ...player,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "stand",
      id: STAND_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      frame: player.animation.kind === "stand"
        ? F32(player.animation.frame + player.animation.frameStep)
        : F32(0),
      frameStep: STAND_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
  };
}

function clearLivePlayerActions(source) {
  const player = clone(source);
  for (const key of [
    "liveCelebration",
    "liveContact",
    "liveKeeper",
    "liveMotion",
    "livePass",
    "liveRestart",
    "liveShot",
  ]) delete player[key];
  return player;
}

function processKeeperBoxes(match, nextTick, events) {
  const keeperIds = match.players
    .filter(({ role }) => role === "keeper")
    .map(({ id }) => id);
  if (keeperIds.length !== 2) throw new Error("keeper_boxes requires both current goalkeepers.");
  let ball = match.ball;
  let possession = match.possession;
  let rng = match.rng.state;
  let players = match.players;
  for (const keeperId of keeperIds) {
    const keeperIndex = players.findIndex(({ id }) => id === keeperId);
    let keeper = players[keeperIndex];
    if (keeper.liveKeeper?.phase === "hold") {
      if (
        possession.owner === keeper.nativePlayerNumber
        && possession.inHands === 1
        && nextTick - keeper.liveKeeper.holdStartTick >= 20
      ) {
        const released = releaseCssoccerPunt({
          ball,
          keeperHands: true,
          owner: liveShotHolder(keeper),
          possession,
          rng,
          tick: ball.ball.tick,
        });
        ball = released.ball;
        possession = released.possession;
        rng = released.rng;
        keeper = settleKeeperAfterOutcome(keeper, nextTick, ball.ball.position);
        events.push({
          type: "keeper-punt-released",
          tick: nextTick,
          playerId: keeper.id,
          nativePlayerNumber: keeper.nativePlayerNumber,
        });
      } else {
        keeper = continueKeeperHold(keeper, nextTick);
      }
      players = replacePlayer(players, keeperIndex, keeper);
      continue;
    }

    if (keeper.liveKeeper?.phase === "save") {
      const continued = continueKeeperSave({
        ball,
        keeper,
        nextTick,
        possession,
      });
      keeper = continued.keeper;
      ball = continued.ball;
      possession = continued.possession;
      if (continued.outcome !== null) {
        events.push({
          type: `keeper-save-${continued.outcome}`,
          tick: nextTick,
          playerId: keeper.id,
          nativePlayerNumber: keeper.nativePlayerNumber,
        });
      }
      players = replacePlayer(players, keeperIndex, keeper);
      continue;
    }

    if (!currentBallThreatensKeeper({ ball, keeper, players, possession })) continue;
    const plan = planCssoccerKeeperSave({
      ball,
      keeper: keeperAiFrame(keeper),
      pitch: {
        length: CSSOCCER_BALL_CONSTANTS.pitchLength,
        width: CSSOCCER_BALL_CONSTANTS.pitchWidth,
        ratio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
      },
    });
    if (plan.status !== "save-path") continue;
    keeper = beginKeeperSave(keeper, plan, nextTick);
    players = replacePlayer(players, keeperIndex, keeper);
    events.push({
      type: "keeper-save-started",
      tick: nextTick,
      playerId: keeper.id,
      nativePlayerNumber: keeper.nativePlayerNumber,
      outcome: plan.outcome,
      animation: plan.animation,
    });
  }
  return {
    ...match,
    ball,
    players,
    possession,
    rng: { ...match.rng, state: rng },
  };
}

function currentBallThreatensKeeper({ ball, keeper, players, possession }) {
  if (
    possession.owner !== 0
    || ball.limbo.active !== 0
    || ball.outcome !== null
    || ball.ball.still !== 0
    || ball.ball.inGoal !== 0
    || ball.ball.outOfPlay !== 0
  ) return false;
  const targetedShot = players.some((player) => (
    player.liveShot?.phase === "shot-released"
    && player.liveShot.targetKeeperNativePlayer === keeper.nativePlayerNumber
    && player.liveShot.release?.tick <= ball.ball.tick
  ));
  const opponentLastTouch = possession.lastTouch !== 0
    && (possession.lastTouch < 12) !== (keeper.nativePlayerNumber < 12);
  const towardGoal = keeper.nativePlayerNumber === 1
    ? ball.ball.displacement.x < 0
    : ball.ball.displacement.x > 0;
  return targetedShot || (opponentLastTouch && towardGoal);
}

function keeperAiFrame(keeper) {
  return {
    id: keeper.id,
    nativePlayerNumber: keeper.nativePlayerNumber,
    position: clone(keeper.position),
    attributes: {
      flair: keeper.gameplay.flair,
      vision: keeper.gameplay.vision,
      pace: keeper.gameplay.pace,
    },
  };
}

function beginKeeperSave(keeper, plan, nextTick) {
  return {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_KEEPER_ACTIONS.save,
      facingX: keeper.facing.x,
      facingY: keeper.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "keeper-save",
      id: plan.animation,
      sourceActionId: CSSOCCER_KEEPER_ACTIONS.save,
      frame: F32(0),
      frameStep: plan.frameStep,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: "keeper-save",
      teamRate: keeper.liveMotion.teamRate,
      target: clone(plan.target),
      goStep: false,
      goCount: plan.predictionIndex,
      goDisplacement: clone(plan.goDisplacement),
      directionMode: 5,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: plan.animation,
      animationFrameStep: plan.frameStep,
    },
    liveKeeper: {
      phase: "save",
      startTick: nextTick,
      plan: clone(plan),
    },
  };
}

function continueKeeperSave({ ball, keeper, nextTick, possession }) {
  const go = keeper.liveKeeper.plan.goDisplacement;
  const position = {
    x: F32(keeper.position.x + go.x),
    y: F32(keeper.position.y + go.y),
    z: keeper.position.z,
  };
  const facingTarget = {
    x: F32(ball.ball.position.x - position.x),
    y: F32(ball.ball.position.y - position.y),
  };
  const facingDistance = Math.hypot(facingTarget.x, facingTarget.y);
  const facing = facingDistance === 0
    ? clone(keeper.facing)
    : {
        x: F32(facingTarget.x / facingDistance),
        y: F32(facingTarget.y / facingDistance),
      };
  const frame = F32(keeper.animation.frame + keeper.animation.frameStep);
  let nextKeeper = {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    position,
    velocity: { x: go.x, y: go.y, z: F32(0) },
    facing,
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_KEEPER_ACTIONS.save,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: { ...clone(keeper.animation), frame, tick: nextTick },
    liveMotion: {
      ...clone(keeper.liveMotion),
      goCount: Math.max(0, keeper.liveMotion.goCount - 1),
    },
  };
  const contact = resolveCssoccerKeeperSaveContact({
    animationFrame: frame,
    ball,
    goDisplacement: go,
    keeper: keeperAiFrame(nextKeeper),
    plan: keeper.liveKeeper.plan,
    possession,
  });
  if (contact.status === "pending") {
    return { ball, keeper: nextKeeper, outcome: null, possession };
  }
  if (contact.outcome === "catch") {
    nextKeeper = continueKeeperHold({
      ...nextKeeper,
      liveKeeper: {
        ...clone(nextKeeper.liveKeeper),
        phase: "hold",
        holdStartTick: nextTick,
      },
    }, nextTick);
  } else {
    nextKeeper = settleKeeperAfterOutcome(nextKeeper, nextTick, contact.ball.ball.position);
  }
  return {
    ball: contact.ball,
    keeper: nextKeeper,
    outcome: contact.outcome,
    possession: contact.possession,
  };
}

function continueKeeperHold(keeper, nextTick) {
  const frame = keeper.animation.kind === "keeper-hold"
    ? F32((keeper.animation.frame + keeper.animation.frameStep) % 1)
    : F32(0);
  return {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_KEEPER_ACTIONS.hold,
      facingX: keeper.facing.x,
      facingY: keeper.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "keeper-hold",
      id: STAND_ANIMATION,
      sourceActionId: CSSOCCER_KEEPER_ACTIONS.hold,
      frame,
      frameStep: STAND_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: "keeper-hold",
      teamRate: keeper.liveMotion.teamRate,
      target: clone(keeper.position),
      goStep: false,
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 3,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: STAND_ANIMATION,
      animationFrameStep: STAND_FRAME_STEP,
    },
  };
}

function settleKeeperAfterOutcome(keeper, nextTick, ballPosition) {
  const settled = clone(keeper);
  delete settled.liveKeeper;
  return {
    ...settled,
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: keeper.facing.x,
      facingY: keeper.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "stand",
      id: STAND_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      frame: F32(0),
      frameStep: STAND_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: "stand",
      teamRate: keeper.liveMotion.teamRate,
      target: clone(ballPosition),
      goStep: false,
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: null,
      animationFrameStep: null,
    },
  };
}

function replacePlayer(players, index, player) {
  return players.map((current, currentIndex) => (
    currentIndex === index ? player : current
  ));
}

function processPlayerDistances(match) {
  const ball = match.ball.ball.position;
  for (const player of match.players) {
    const distance = Math.hypot(player.position.x - ball.x, player.position.y - ball.y);
    if (!Number.isFinite(distance)) throw new Error(`Player distance is not finite for ${player.id}.`);
  }
  return match;
}

function captureOpenPlayPlayerDistances(match) {
  const ball = match.ball.ball.position;
  return new Map(match.players.map((player) => [
    player.id,
    sourceDistance2d({
      x: F32(player.position.x - ball.x),
      y: F32(player.position.y - ball.y),
    }),
  ]));
}

function selectNearestControlledPlayer(match) {
  const ball = match.ball.ball.position;
  let nearest = null;
  for (const player of match.players) {
    if (player.country !== match.control.country || !player.active || player.role === "keeper") continue;
    const distance = Math.hypot(player.position.x - ball.x, player.position.y - ball.y);
    if (nearest === null || distance < nearest.distance) {
      nearest = { id: player.id, nativePlayerNumber: player.nativePlayerNumber, distance };
    }
  }
  if (nearest === null) throw new Error("get_nearest found no active controlled outfielder.");
  return deepFreeze(nearest);
}

function processTeams(match, { command, events, nextTick, sourceInitialization }) {
  if (currentLifecycleSuspendsGameplay(match)) return match;
  if (sourceInitialization) {
    return {
      ...match,
      kickoff: {
        ...match.kickoff,
        phase: "centre-positioning",
      },
    };
  }
  if (match.goal.phase !== "normal-play") {
    return stepGoalCelebrationPlayers(match, nextTick, events);
  }
  if (match.kickoff.phase === "foul-contact-wait") {
    return advanceOpenPlayContactActions(match, nextTick);
  }
  if (match.kickoff.phase === "rule-action") {
    return stepCurrentFoulKickAction(match, nextTick, events);
  }
  if (match.kickoff.phase === "boundary-action") {
    return stepCurrentBoundaryKickAction(match, nextTick, events);
  }
  if (match.kickoff.phase === "kick-action") {
    const contact = projectCentrePassContact(match);
    const transitionInput = {
      ballPosition: match.ball.ball.position,
      postTakerBallPosition: contact.ballPosition,
      controlledPlayerId: match.control.activePlayerId,
      nextTick,
      players: match.players,
      possession: match.possession,
      receiverId: match.kickoff.owner.receiverId,
      rngSeed: match.rng.state.seed,
      sourceTick: match.tick,
      tactics: match.tactics,
      takerId: match.kickoff.owner.takerId,
      teamRates: currentTeamRates(match.players, match.clock.gameMinute),
    };
    return {
      ...match,
      players: match.kickoff.launch?.tick === nextTick
        ? stepCssoccerFreePlayOpeningTeamTransition({
          ...transitionInput,
          kickoffMotion: match.kickoff.motion,
        })
        : stepCssoccerFreePlayOpeningTeamContinuation(transitionInput),
    };
  }
  if (
    match.kickoff.phase === "open-play"
    && match.kickoff.action?.released === true
    && match.ball.limbo.active !== 0
    && match.players.some((player) => player.liveRestart?.phase === "throw-released")
  ) {
    return match;
  }
  if (match.kickoff.phase === "open-play" && match.kickoff.action?.released === true) {
    match = advanceOpenPlayContactActions(match, nextTick);
    const contactPass = stepOpenPlayLooseBallContacts(match, events);
    const offsideSnapshotted = snapshotCurrentLivePassOffside({
      before: match,
      contacted: contactPass.match,
      events,
      nextTick,
      releases: contactPass.releases,
    });
    const contacted = applyOpenPlayPassControlHandoff({
      before: match,
      command,
      contacted: offsideSnapshotted,
      events,
      releases: contactPass.releases,
    });
    const stolen = resolveOpenPlayStealFootContacts(contacted, nextTick, events);
    const challenged = resolveOpenPlayChallengeContacts(stolen, nextTick, events);
    const possessionDecision = resolveOpenPlayCollectedPossession({
      match: challenged,
      visits: contactPass.visits,
    });
    const decided = {
      ...challenged,
      rng: {
        ...challenged.rng,
        state: possessionDecision.rng,
      },
    };
    const busyPlayerIds = new Set([
      ...decided.players
        .filter((player) => (
          player.livePass !== undefined
          || player.liveShot !== undefined
          || player.liveKeeper !== undefined
          || player.liveContact !== undefined
          || player.liveRestart !== undefined
        ))
        .map(({ id }) => id),
      ...possessionDecision.passActions.map(({ holderId }) => holderId),
      ...possessionDecision.shotActions.map(({ holderId }) => holderId),
    ]);
    const players = stepCssoccerFreePlayTeamJourneyContinuation({
      controlledPlayerId: decided.control.activePlayerId,
      nextTick,
      players: decided.players,
      possessionKicks: [...busyPlayerIds],
      possessionRuns: possessionDecision.runPlayerIds.filter((id) => !busyPlayerIds.has(id)),
      rngSeed: decided.rng.state.seed,
      tactics: decided.tactics,
      takerId: decided.kickoff.action?.recovered === true
        ? null
        : decided.kickoff.owner.takerId,
      teamRates: currentTeamRates(decided.players, decided.clock.gameMinute),
      visits: contactPass.visits,
      zoneBallPosition: decided.players.find(
        (player) => (
          player.livePass?.phase === "kick-held"
          || player.liveShot?.phase === "kick-held"
        ),
      )?.livePass?.zoneBallPosition
        ?? decided.players.find(
          (player) => player.liveShot?.phase === "kick-held",
        )?.liveShot.zoneBallPosition
        ?? null,
    });
    const receiverPlayers = applyOpenPlayPassReceiverStops({
      nextTick,
      players,
      releases: contactPass.releases,
    });
    const actionPlayers = initializeOpenPlayPassActions({
      match: decided,
      nextTick,
      passActions: possessionDecision.passActions,
      players: receiverPlayers,
    });
    const shotPlayers = initializeOpenPlayShotActions({
      match: decided,
      nextTick,
      players: actionPlayers,
      shotActions: possessionDecision.shotActions,
    });
    const receiverJourney = stepReleasedPassReceiverJourney({
      command,
      match: { ...decided, players: shotPlayers },
      nextTick,
      sourcePlayers: decided.players,
      visits: contactPass.visits,
    });
    const receiverDecided = {
      ...decided,
      rng: { ...decided.rng, state: receiverJourney.rng },
    };
    const directedPlayers = stepControlledStandingProcessDirection({
      match: receiverDecided,
      nextTick,
      players: receiverJourney.players,
      visits: contactPass.visits,
    });
    const journey = initializeOpenPlayAiChallenges({
      ...receiverDecided,
      players: stepActiveFreeBallJourney(
        receiverDecided,
        directedPlayers,
        nextTick,
        command,
      ),
    }, nextTick, events);
    return resolveOpenPlayPlayerTussles(journey, nextTick, events);
  }
  const restartPositioning = match.kickoff.phase === "boundary-positioning"
    || match.kickoff.phase === "rule-positioning";
  if (match.kickoff.phase !== "centre-positioning" && !restartPositioning) {
    // B10 owns subsequent ordinary current-state team intelligence.
    return match;
  }
  const currentRates = currentTeamRates(match.players, match.clock.gameMinute);
  const ratesById = new Map(currentRates.map((rate) => [rate.id, rate]));
  const motion = stepCssoccerKickoffPlayerMotion(match.kickoff.motion, {
    teamRates: match.kickoff.motion.players.map((player) => {
      const rate = ratesById.get(player.id);
      if (rate === undefined) {
        throw new Error(`Kickoff motion lost the current team rate for ${player.id}.`);
      }
      return rate;
    }),
  });
  const motionById = new Map(motion.players.map((player) => [player.id, player]));
  const players = match.players.map((player) => {
    const current = motionById.get(player.id);
    if (current === undefined) throw new Error(`Kickoff motion lost ${player.id}.`);
    const position = { ...clone(current.position), z: F32(0) };
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: {
        x: F32(position.x - player.position.x),
        y: F32(position.y - player.position.y),
        z: F32(0),
      },
      facing: clone(current.facing),
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: current.action,
        facingX: current.facing.x,
        facingY: current.facing.y,
      }),
      ...(restartPositioning
        ? { liveMotion: currentBoundaryLiveMotion(current) }
        : {}),
    };
  });
  return {
    ...match,
    players,
    kickoff: {
      ...match.kickoff,
      phaseTick: motion.tick,
      motion,
    },
  };
}

function stepCurrentBoundaryKickAction(match, nextTick, events) {
  const boundary = match.rules.boundary;
  const taker = match.players.find(({ id }) => id === match.kickoff.action?.takerId);
  if (
    boundary?.phase !== "action"
    || taker?.liveShot?.phase !== "kick-held"
    || match.possession.owner !== taker.nativePlayerNumber
  ) {
    throw new Error("Boundary action lost its single current kick owner.");
  }
  if (F32(taker.animation.frame + taker.animation.frameStep) < taker.liveShot.contact) {
    return match;
  }
  let released;
  if (boundary.descriptor.kind === "corner") {
    const keeper = match.players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === taker.liveShot.targetKeeperNativePlayer
    ));
    if (keeper === undefined || keeper.role !== "keeper") {
      throw new Error("Corner release lost its current defending keeper.");
    }
    released = releaseCssoccerShot({
      ball: match.ball,
      charge: taker.liveShot.charge,
      direction: taker.liveShot.userControlled
        ? clone(taker.liveShot.direction)
        : null,
      drive: taker.liveShot.drive,
      keeper: {
        nativePlayerNumber: keeper.nativePlayerNumber,
        position: clone(keeper.position),
      },
      owner: liveShotHolder(taker),
      possession: match.possession,
      rng: match.rng.state,
      tick: match.ball.ball.tick,
      userControlled: taker.liveShot.userControlled,
    });
  } else if (boundary.descriptor.kind === "goal-kick") {
    released = releaseCurrentBoundaryGoalKick(match, taker);
  } else {
    throw new Error("Only a corner or goal kick may own boundary kick action.");
  }
  const release = {
    ...clone(released.release),
    tick: nextTick,
  };
  const players = match.players.map((player) => (
    player.id === taker.id
      ? {
          ...clone(player),
          liveShot: {
            ...clone(player.liveShot),
            phase: player.liveShot.kind === "shot" ? "shot-released" : "punt-released",
            release,
            releaseBall: clone(released.ball),
          },
        }
      : player
  ));
  events.push({
    type: `${boundary.descriptor.kind}-released`,
    tick: nextTick,
    playerId: taker.id,
    nativePlayerNumber: taker.nativePlayerNumber,
    displacement: clone(released.ball.ball.displacement),
  });
  return completeCurrentBoundaryRelease({
    match: {
      ...match,
      ball: released.ball,
      possession: released.possession,
      players,
      rng: { ...match.rng, state: released.rng },
    },
    nextTick,
    setPiece: boundary.setPiece,
    release,
  });
}

function releaseCurrentBoundaryGoalKick(match, taker) {
  const rng = advanceCssoccerNativeRng(match.rng.state);
  const speed = F32(6 + taker.gameplay.power / 8);
  const displacement = {
    x: F32(taker.facing.x * speed),
    y: F32(taker.facing.y * speed),
    z: F32(12),
  };
  const ball = createBallMatchState({
    ...clone(match.ball),
    ball: {
      ...clone(match.ball.ball),
      displacement,
      inAir: 1,
      still: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
      rng,
    },
  });
  return {
    ball,
    possession: releasePossession(match.possession),
    rng,
    release: {
      kind: "punt",
      tick: ball.ball.tick,
      ownerNativePlayer: taker.nativePlayerNumber,
      targetKeeperNativePlayer: taker.nativePlayerNumber === 1 ? 12 : 1,
      keeperHands: false,
      displacement,
    },
  };
}

function advanceOpenPlayContactActions(match, nextTick) {
  if (!match.players.some((player) => player.liveContact !== undefined)) return match;
  const players = match.players.map((player) => {
    const contact = player.liveContact;
    if (contact === undefined || contact.startTick >= nextTick) return player;
    const moving = contact.phase === "barge"
      || contact.phase === "tackle"
      || contact.phase === "ride-over-tackle"
      || (contact.phase === "fall" && contact.goCount > 0);
    const go = moving
      ? player.liveMotion.goDisplacement
      : { x: F32(0), y: F32(0) };
    const nextZ = contact.phase === "ride-over-tackle"
      ? F32(player.position.z + contact.zDisplacement)
      : player.position.z;
    const landed = contact.phase === "ride-over-tackle"
      && contact.startTick < nextTick
      && nextZ <= 0;
    const position = {
      x: F32(player.position.x + go.x),
      y: F32(player.position.y + go.y),
      z: landed ? F32(0) : nextZ,
    };
    const goCount = contact.phase === "fall" || contact.phase === "tackle"
      ? contact.goCount - 1
      : contact.goCount;
    const bargeCountdown = contact.phase === "barge"
      ? Math.max(0, contact.bargeCountdown - 1)
      : contact.bargeCountdown;
    const decelerates = contact.phase === "fall" || contact.phase === "tackle";
    const goDisplacement = decelerates
      ? {
          x: F32(go.x * TACKLE_DECEL),
          y: F32(go.y * TACKLE_DECEL),
        }
      : clone(player.liveMotion.goDisplacement);
    const facing = moving && player.liveMotion.target !== undefined
      ? turnSourceFacing({
          facing: player.facing,
          target: {
            x: F32(player.liveMotion.target.x - position.x),
            y: F32(player.liveMotion.target.y - position.y),
          },
          maxTurnRadians: projectCssoccerMotionSourceProfile(
            CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
            { teamRate: player.liveMotion.teamRate },
          ).maxTurnRadians,
        }).facing
      : clone(player.facing);
    const limbo = contact.phase === "get-up"
      ? Math.max(0, contact.limbo - 1)
      : contact.limbo;
    const zDisplacement = contact.phase === "ride-over-tackle"
      ? F32(contact.zDisplacement - CSSOCCER_BALL_CONSTANTS.gravity)
      : contact.zDisplacement;
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: {
        x: go.x,
        y: go.y,
        z: contact.phase === "ride-over-tackle"
          ? contact.zDisplacement
          : F32(0),
      },
      facing,
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: player.action.action.value,
        facingX: facing.x,
        facingY: facing.y,
      }),
      liveMotion: {
        ...clone(player.liveMotion),
        goCount,
        goDisplacement,
      },
      liveContact: {
        ...clone(contact),
        goCount,
        bargeCountdown,
        ...(contact.phase === "get-up" ? { limbo } : {}),
        ...(contact.phase === "ride-over-tackle"
          ? { landed, zDisplacement }
          : {}),
      },
    };
  });
  return { ...match, players };
}

function resolveOpenPlayChallengeContacts(match, nextTick, events) {
  const traversal = nativeContactTraversalOrder(match.tick & 1);
  let players = match.players;
  let possession = match.possession;
  for (const nativePlayerNumber of traversal) {
    const tackler = players.find((player) => (
      player.nativePlayerNumber === nativePlayerNumber
    ));
    if (
      tackler?.liveContact?.phase !== "tackle"
      && tackler?.liveContact?.phase !== "steal"
    ) continue;
    const contactPlayers = projectOpenPlayChallengePlayers(players, possession);
    const result = resolveTacklePlayerContacts({
      players: contactPlayers,
      possession,
      tacklerNativePlayer: nativePlayerNumber,
      seed: match.rng.state.seed,
      profile: LIVE_PLAYER_CONTACT_PROFILE,
    });
    if (result.events.length === 0) continue;
    const currentPlayers = players;
    players = players.map((player) => {
      const transitioned = result.players.find(({ nativePlayer }) => (
        nativePlayer === player.nativePlayerNumber
      ));
      if (transitioned.action === FALL_ACTION && player.action.action.value !== FALL_ACTION) {
        return applyOpenPlayChallengeFall({
          match: { ...match, players: currentPlayers, possession },
          nextTick,
          player,
          tackler,
        });
      }
      if (transitioned.action === 4 && player.action.action.value !== 4) {
        return applyOpenPlayRideOver({ nextTick, player, tackler });
      }
      return player;
    });
    possession = result.possession;
    for (const event of result.events) {
      const nativeTarget = event.nativePlayer ?? event.fallenPlayer ?? null;
      events.push({
        tick: nextTick,
        ...clone(event),
        tacklerId: tackler.id,
        targetId: nativeTarget === null
          ? null
          : players.find(({ nativePlayerNumber }) => (
              nativePlayerNumber === nativeTarget
            ))?.id ?? null,
      });
    }
  }
  return { ...match, players, possession };
}

function resolveOpenPlayStealFootContacts(match, nextTick, events) {
  let possession = match.possession;
  let ball = match.ball;
  for (const nativePlayerNumber of nativeContactTraversalOrder(match.tick & 1)) {
    const player = match.players.find((candidate) => (
      candidate.nativePlayerNumber === nativePlayerNumber
    ));
    if (
      player?.liveContact?.phase !== "steal"
      || !(player.animation.frame > 0.4 && player.animation.frame < 0.6)
      || possession.owner === 0
      || possession.owner === nativePlayerNumber
      || (possession.owner < 12) === (nativePlayerNumber < 12)
      || ball.ball.position.z > LIVE_LOOSE_BALL_CONTACT_PROFILE.ballRadius
    ) continue;
    const foot = {
      x: F32(player.position.x
        + (player.facing.x * CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value)),
      y: F32(player.position.y
        + (player.facing.y * CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value)),
    };
    const distance = sourceDistance2d({
      x: F32(ball.ball.position.x - foot.x),
      y: F32(ball.ball.position.y - foot.y),
    });
    if (distance > STEAL_FOOT_DISTANCE) continue;
    const previousOwner = possession.owner;
    possession = collectPossession(possession, nativePlayerNumber);
    ball = createBallMatchState({
      ...clone(ball),
      ball: {
        ...clone(ball.ball),
        position: {
          x: foot.x,
          y: foot.y,
          z: LIVE_LOOSE_BALL_CONTACT_PROFILE.ballRadius,
        },
        displacement: { x: F32(0), y: F32(0), z: F32(0) },
        inAir: 0,
      },
    });
    events.push({
      type: "steal-possession",
      tick: nextTick,
      playerId: player.id,
      nativePlayerNumber,
      previousOwner,
      distance,
      frame: player.animation.frame,
    });
    break;
  }
  return { ...match, ball, possession };
}

function projectOpenPlayChallengePlayers(players, possession) {
  return players.map((player) => ({
    nativePlayer: player.nativePlayerNumber,
    action: player.action.action.value,
    actionKind: player.liveContact?.phase ?? player.animation.kind,
    animation: player.animation.id,
    animationFrame: player.animation.frame,
    barge: player.liveContact?.bargeCountdown ?? 0,
    goCount: player.liveContact?.goCount ?? player.liveMotion.goCount,
    position: clone(player.position),
    facing: clone(player.facing),
    goDisplacement: clone(player.liveMotion.goDisplacement),
    power: player.gameplay.power,
    control: player.gameplay.control,
    flair: player.gameplay.flair,
    possession: possession.players.find(({ nativePlayer }) => (
      nativePlayer === player.nativePlayerNumber
    ))?.possession ?? 0,
  }));
}

function applyOpenPlayChallengeFall({ match, nextTick, player, tackler }) {
  const goDisplacement = {
    x: F32(player.facing.x
      * CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.fallRate.value),
    y: F32(player.facing.y
      * CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.fallRate.value),
  };
  const force = Math.trunc(
    sourceDistance2d(tackler.liveMotion.goDisplacement) * tackler.gameplay.power,
  );
  const injury = applyCssoccerFallInjury({
    baseAttributes: clone(player.gameplay),
    currentAttributes: clone(player.gameplay),
    currentInjury: player.injury?.value ?? 0,
    force,
    playerMinutes: match.clock.gameMinute,
    teamFitness: 99,
    timeFactor: match.config.timing.timeFactor,
  });
  const position = { ...clone(player.position), z: F32(0) };
  const target = {
    x: F32(position.x + (goDisplacement.x * 100)),
    y: F32(position.y + (goDisplacement.y * 100)),
  };
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { x: goDisplacement.x, y: goDisplacement.y, z: F32(0) },
    gameplay: clone(injury.attributes),
    stamina: {
      ...clone(player.stamina),
      current: injury.attributes.stamina,
      depleted: injury.attributes.stamina === 0,
    },
    injury: {
      value: injury.injury,
      delta: injury.injuryDelta,
      force,
      tick: nextTick,
    },
    intelligence: { special: 0, move: 0, count: 0 },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: FALL_ACTION,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "fall",
      id: FALL_ANIMATION,
      sourceActionId: FALL_ACTION,
      frame: F32(0),
      frameStep: FALL_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: "fall",
      teamRate: injury.attributes.pace,
      target,
      goStep: false,
      goCount: 16,
      goDisplacement,
      directionMode: 0,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: FALL_ANIMATION,
      animationFrameStep: FALL_FRAME_STEP,
    },
    liveContact: {
      phase: "fall",
      startTick: nextTick,
      goCount: 16,
      bargeCountdown: 0,
      force,
      opponentId: tackler.id,
      source: tackler.liveContact.phase,
    },
  };
}

function applyOpenPlayRideOver({ nextTick, player, tackler }) {
  const frameStep = F32(
    (1 / (20 * 28 / 40))
      + (0.000536 * ((player.gameplay.flair + player.gameplay.pace) / 2)),
  );
  const zDisplacement = F32((((1 - player.animation.frame) / frameStep) - 2)
    * CSSOCCER_BALL_CONSTANTS.gravity / 2);
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    velocity: { ...clone(player.liveMotion.goDisplacement), z: zDisplacement },
    intelligence: { special: 0, move: 0, count: 0 },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: 4,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "ride-over-tackle",
      id: 60,
      sourceActionId: 4,
      frame: F32(0),
      frameStep,
      pending: null,
      tick: nextTick,
    },
    liveContact: {
      phase: "ride-over-tackle",
      startTick: nextTick,
      goCount: 0,
      bargeCountdown: 0,
      force: 0,
      opponentId: tackler.id,
      zDisplacement,
      landed: false,
    },
  };
}

function resolveOpenPlayPlayerTussles(match, nextTick, events) {
  // The browser snapshot is published after the native gameplay tick.  Team
  // traversal therefore belongs to the current source tick, not the upcoming
  // browser snapshot number.
  const frameParity = match.tick & 1;
  const traversal = nativeContactTraversalOrder(frameParity);
  const eligible = traversal.filter((nativePlayerNumber) => {
    const player = match.players.find((candidate) => (
      candidate.nativePlayerNumber === nativePlayerNumber
    ));
    const action = player?.action.action.value;
    return player?.active === true && (action <= 2 || action === 10);
  });
  let players = match.players;
  let possession = match.possession;
  for (let leftIndex = 0; leftIndex < eligible.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < eligible.length; rightIndex += 1) {
      const leftNumber = eligible[leftIndex];
      const rightNumber = eligible[rightIndex];
      if ((leftNumber < 12) === (rightNumber < 12)) continue;
      const left = players.find(({ nativePlayerNumber }) => nativePlayerNumber === leftNumber);
      const right = players.find(({ nativePlayerNumber }) => nativePlayerNumber === rightNumber);
      if (
        left === undefined
        || right === undefined
        || left.action.action.value > 2
        || right.action.action.value > 2
      ) continue;
      const separation = sourceDistance2d({
        x: F32(right.position.x - left.position.x),
        y: F32(right.position.y - left.position.y),
      });
      if (!(separation < CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.7)) {
        continue;
      }
      const frame = createCssoccerPlayerTussleFrame({
        tick: match.tick,
        frameParity,
        seed: match.rng.state.seed,
        ballPossession: possession.owner,
        refereeStrictness: 128,
        players: [
          currentTusslePlayer(left, possession),
          currentTusslePlayer(right, possession),
        ],
        gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        fixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
      });
      const transition = stepCssoccerPlayerTussleFrame(frame);
      const contactEvent = transition.events[0];
      players = players.map((player) => {
        const transitioned = transition.players.find(({ stableId }) => (
          stableId === player.id
        ));
        return transitioned === undefined
          ? player
          : applyOpenPlayTusslePlayer({
              contactEvent,
              match,
              nextTick,
              player,
              transitioned,
              transition,
            });
      });
      if (transition.ballPossession.value === 0 && possession.owner !== 0) {
        possession = releasePossession(possession);
      }
      events.push({ tick: nextTick, ...clone(contactEvent) });
    }
  }
  return { ...match, players, possession };
}

function currentTusslePlayer(player, possession) {
  const possessionPlayer = possession.players.find(({ nativePlayer }) => (
    nativePlayer === player.nativePlayerNumber
  ));
  if (possessionPlayer === undefined) {
    throw new Error(`Player tussle lost possession identity ${player.id}.`);
  }
  return {
    stableId: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    on: player.active ? 1 : 0,
    action: player.action.action.value,
    animation: player.animation.id,
    animationFrame: F32(player.animation.frame),
    animationFrameStep: F32(player.animation.frameStep),
    position: clone(player.position),
    facing: clone(player.facing),
    zDisplacement: F32(player.velocity.z),
    goDisplacement: clone(player.liveMotion.goDisplacement),
    power: player.gameplay.power,
    rate: player.liveMotion.teamRate,
    possession: possessionPlayer.possession,
    bargeCountdown: player.liveContact?.bargeCountdown ?? 0,
  };
}

function applyOpenPlayTusslePlayer({
  contactEvent,
  match,
  nextTick,
  player,
  transitioned,
  transition,
}) {
  const position = {
    x: transitioned.position.x.value,
    y: transitioned.position.y.value,
    z: transitioned.position.z.value,
  };
  const facing = {
    x: transitioned.facing.x.value,
    y: transitioned.facing.y.value,
  };
  const goDisplacement = {
    x: transitioned.goDisplacement.x.value,
    y: transitioned.goDisplacement.y.value,
  };
  if (
    transitioned.action.value === FALL_ACTION
    && player.action.action.value !== FALL_ACTION
  ) {
    const injury = applyCssoccerFallInjury({
      baseAttributes: clone(player.gameplay),
      currentAttributes: clone(player.gameplay),
      currentInjury: player.injury?.value ?? 0,
      force: contactEvent.force,
      playerMinutes: match.clock.gameMinute,
      teamFitness: 99,
      timeFactor: match.config.timing.timeFactor,
    });
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: { x: goDisplacement.x, y: goDisplacement.y, z: F32(0) },
      facing,
      gameplay: clone(injury.attributes),
      stamina: {
        ...clone(player.stamina),
        current: injury.attributes.stamina,
        depleted: injury.attributes.stamina === 0,
      },
      injury: {
        value: injury.injury,
        delta: injury.injuryDelta,
        force: contactEvent.force,
        tick: nextTick,
      },
      intelligence: { special: 0, move: 0, count: 0 },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: FALL_ACTION,
        facingX: facing.x,
        facingY: facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "fall",
        id: FALL_ANIMATION,
        sourceActionId: FALL_ACTION,
        frame: F32(0),
        frameStep: transition.nativeFall.animationFrameStep.value,
        pending: null,
        tick: nextTick,
      },
      liveMotion: {
        kind: "fall",
        teamRate: injury.attributes.pace,
        target: {
          x: transition.nativeFall.goTarget.x.value,
          y: transition.nativeFall.goTarget.y.value,
        },
        goStep: false,
        goCount: transition.nativeFall.goCount.value,
        goDisplacement,
        directionMode: transition.nativeFall.directionMode.value,
        resetAnimationFrame: false,
        sideStepDirection: null,
        animationId: FALL_ANIMATION,
        animationFrameStep: transition.nativeFall.animationFrameStep.value,
      },
      liveContact: {
        phase: "fall",
        startTick: nextTick,
        goCount: transition.nativeFall.goCount.value,
        bargeCountdown: 0,
        force: contactEvent.force,
        opponentId: contactEvent.shover.stableId,
      },
    };
  }
  const bargeLaunched = transitioned.bargeCountdown.value > 0
    && (player.liveContact?.bargeCountdown ?? 0) === 0;
  if (bargeLaunched) {
    const opponent = contactEvent.shoved ?? contactEvent.fallen;
    if (opponent === undefined) {
      throw new Error("Open-play barge lost its current shoved or fallen opponent.");
    }
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      position,
      animation: {
        status: "browser-current-state",
        kind: "barge",
        id: BARGE_ANIMATION,
        sourceActionId: transitioned.action.value,
        frame: transitioned.animationFrame.value,
        frameStep: transitioned.animationFrameStep.value,
        pending: null,
        tick: nextTick,
      },
      liveContact: {
        phase: "barge",
        startTick: nextTick,
        goCount: 0,
        bargeCountdown: transitioned.bargeCountdown.value,
        force: contactEvent.force,
        opponentId: opponent.stableId,
      },
    };
  }
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    position,
  };
}

function stepOpenPlayLooseBallContacts(match, events) {
  const kickHolder = match.players.find((player) => (
    (
      player.livePass?.phase === "kick-held"
      || player.liveShot?.phase === "kick-held"
    )
    && player.nativePlayerNumber === match.possession.owner
  ));
  const heldKick = kickHolder?.livePass ?? kickHolder?.liveShot ?? null;
  const postOwnerKickBall = match.ball;
  let ball = kickHolder === undefined
    ? match.ball
    : createBallMatchState({
        ...clone(match.ball),
        ball: {
          ...clone(match.ball.ball),
          position: clone(heldKick.publishedBallPosition),
        },
      });
  const distanceBallPosition = clone(ball.ball.position);
  let possession = match.possession;
  let rng = match.rng.state;
  const kickReleases = new Map();
  const visits = [];
  const receiverId = match.kickoff.action?.receiverId ?? null;
  const receiver = receiverId === null
    ? null
    : match.players.find(({ id }) => id === receiverId);
  if (receiverId !== null && receiver === undefined) {
    throw new Error("Open-play contact lost the current centre-pass receiver.");
  }
  const firstTeam = match.tick % 2 === 1
    ? Array.from({ length: 11 }, (_, index) => index + 1)
    : Array.from({ length: 11 }, (_, index) => index + 12);
  const secondTeam = firstTeam[0] === 1
    ? Array.from({ length: 11 }, (_, index) => index + 12)
    : Array.from({ length: 11 }, (_, index) => index + 1);
  const byNativePlayer = new Map(
    match.players.map((player) => [player.nativePlayerNumber, player]),
  );
  for (const nativePlayerNumber of [...firstTeam, ...secondTeam]) {
    const player = byNativePlayer.get(nativePlayerNumber);
    if (player === undefined) {
      throw new Error(`Open-play contact lost native player ${nativePlayerNumber}.`);
    }
    if (!player.active) continue;
    if (
      kickHolder?.nativePlayerNumber === nativePlayerNumber
      && possession.owner === nativePlayerNumber
    ) {
      ball = postOwnerKickBall;
    }
    const sameTeamNonOwner = (
      possession.owner !== 0
      && possession.owner !== nativePlayerNumber
      && (possession.owner < 12) === (nativePlayerNumber < 12)
    );
    if (player.liveMotion === undefined) {
      throw new Error(`Open-play contact lost current motion for ${player.id}.`);
    }
    const kickHeldOwner = possession.owner === nativePlayerNumber
      && (
        player.livePass?.phase === "kick-held"
        || player.liveShot?.phase === "kick-held"
      );
    const playerHeldKick = player.livePass ?? player.liveShot ?? null;
    let interaction = sameTeamNonOwner ? "same-team-skip" : "none";
    if (
      kickHeldOwner
      && F32(player.animation.frame + player.animation.frameStep)
        >= playerHeldKick.contact
    ) {
      const shotKick = player.liveShot?.phase === "kick-held";
      const passReceiver = shotKick || player.livePass.targetNativePlayer === 0
        ? null
        : byNativePlayer.get(player.livePass.targetNativePlayer);
      if (
        !shotKick
        && player.livePass.targetNativePlayer !== 0
        && (passReceiver === undefined || passReceiver.liveMotion === undefined)
      ) {
        throw new Error(`Open-play pass release lost receiver ${player.livePass.targetNativePlayer}.`);
      }
      let released;
      if (shotKick) {
        if (player.liveShot.kind === "shot") {
          const keeper = match.players.find(({ nativePlayerNumber: candidate }) => (
            candidate === player.liveShot.targetKeeperNativePlayer
          ));
          if (keeper === undefined || keeper.role !== "keeper") {
            throw new Error("Open-play shot release lost its current defending keeper.");
          }
          released = releaseCssoccerShot({
            ball,
            charge: player.liveShot.charge,
            direction: player.liveShot.userControlled
              ? clone(player.liveShot.direction)
              : null,
            drive: player.liveShot.drive,
            keeper: {
              nativePlayerNumber: keeper.nativePlayerNumber,
              position: clone(keeper.position),
            },
            owner: liveShotHolder(player),
            possession,
            rng,
            tick: ball.ball.tick,
            userControlled: player.liveShot.userControlled,
          });
        } else if (player.liveShot.kind === "punt") {
          released = releaseCssoccerPunt({
            ball,
            keeperHands: false,
            owner: liveShotHolder(player),
            possession,
            rng,
            tick: ball.ball.tick,
          });
        } else {
          throw new Error(`Unsupported live shot kind ${String(player.liveShot.kind)}.`);
        }
      } else if (player.livePass.targetNativePlayer === 0) {
        const releaseInput = {
          ball,
          direction: clone(player.livePass.directedDirection),
          possession,
          profile: CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
          rng,
          tick: ball.ball.tick,
        };
        released = player.livePass.charge === null
          ? releaseCssoccerDirectedGroundPass(releaseInput)
          : releaseCssoccerChargedGroundPass({
              ...releaseInput,
              charge: player.livePass.charge,
            });
      } else {
        const releasePass = player.livePass.cross
          ? releaseCssoccerCrossPass
          : player.livePass.passType === -1
            ? releaseCssoccerChipPass
            : releaseCssoccerGroundPass;
        released = releasePass({
          ball,
          ...(player.livePass.cross
            ? {
                playerHeight:
                  CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value,
              }
            : {}),
          possession,
          profile: CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
          receiver: {
            stableId: passReceiver.id,
            nativePlayerNumber: passReceiver.nativePlayerNumber,
            action: passReceiver.action.action.value,
            position: clone(passReceiver.position),
            goDisplacement: clone(passReceiver.liveMotion.goDisplacement),
          },
          rng,
          takerAccuracy: player.gameplay.accuracy,
          tick: ball.ball.tick,
          wantedReceiver: player.livePass.wantedReceiver,
        });
      }
      ball = released.ball;
      possession = released.possession;
      rng = released.rng;
      interaction = shotKick ? `${player.liveShot.kind}-release` : "pass-release";
      kickReleases.set(player.id, {
        ball: clone(released.ball),
        release: clone(released.release),
      });
      events.push(shotKick
        ? {
            type: `${player.liveShot.kind}-released`,
            tick: ball.ball.tick,
            playerId: player.id,
            targetKeeperNativePlayer: released.release.targetKeeperNativePlayer,
          }
        : {
            type: released.release.cross === true
              ? "cross-pass-released"
              : released.release.inAir === 1
                ? "chip-pass-released"
                : "ground-pass-released",
            tick: ball.ball.tick,
            playerId: player.id,
            receiverId: passReceiver?.id ?? null,
          });
    } else if (kickHeldOwner) {
      interaction = "kick-held";
    }
    if (
      possession.inHands === 0
      && player.role !== "keeper"
      && !sameTeamNonOwner
      && !kickHeldOwner
    ) {
      const contact = stepCssoccerLooseBallControl({
        ball: {
          position: clone(ball.ball.position),
          displacement: clone(ball.ball.displacement),
          speed: ball.ball.speed,
          inAir: ball.ball.inAir,
          inGoal: ball.ball.inGoal,
          wantPass: receiver?.nativePlayerNumber ?? 0,
        },
        player: {
          nativePlayer: nativePlayerNumber,
          action: player.action.action.value,
          animationFrame: F32(player.animation.frame + player.animation.frameStep),
          control: player.gameplay.control,
          faceDirection: sourceFacingDirection(player.facing),
          facing: clone(player.facing),
          goDisplacement: clone(player.liveMotion.goDisplacement),
          kickedBusy: player.action.action.value === CSSOCCER_NATIVE_ACTIONS.KICK,
          position: clone(player.position),
        },
        possession,
        profile: LIVE_LOOSE_BALL_CONTACT_PROFILE,
        seed: match.rng.state.seed,
      });
      interaction = contact.outcome;
      if (["hold", "collect", "rebound"].includes(contact.outcome)) {
        possession = contact.possession;
        ball = createBallMatchState({
          ...clone(ball),
          ball: {
            ...clone(ball.ball),
            position: clone(contact.ball.position),
            displacement: clone(contact.ball.displacement),
            inAir: contact.ball.inAir,
          },
        });
        if (contact.outcome !== "hold") {
          events.push({
            type: contact.outcome === "collect" ? "ball-collected" : "ball-rebounded",
            tick: match.tick,
            playerId: player.id,
            nativePlayerNumber,
          });
        }
      }
    }
    visits.push({
      playerId: player.id,
      nativePlayerNumber,
      ballPosition: clone(ball.ball.position),
      distance: sourceDistance2d({
        x: F32(player.position.x - distanceBallPosition.x),
        y: F32(player.position.y - distanceBallPosition.y),
      }),
      interaction,
      possession: {
        owner: possession.owner,
        lastTouch: possession.lastTouch,
        inHands: possession.inHands,
      },
    });
  }
  const players = kickReleases.size === 0
    ? match.players
    : match.players.map((player) => {
        const released = kickReleases.get(player.id);
        if (released === undefined) return player;
        if (player.liveShot !== undefined) {
          return {
            ...clone(player),
            liveShot: {
              ...clone(player.liveShot),
              phase: player.liveShot.kind === "shot" ? "shot-released" : "punt-released",
              release: clone(released.release),
              releaseBall: clone(released.ball),
            },
          };
        }
        return {
          ...clone(player),
          livePass: {
            ...clone(player.livePass),
            phase: released.release.inAir === 1 ? "air-pass" : "ground-pass",
            release: clone(released.release),
            releaseBall: clone(released.ball),
          },
        };
      });
  return {
    match: {
      ...match,
      ball,
      players,
      possession,
      rng: { ...match.rng, state: rng },
    },
    releases: [...kickReleases.entries()].map(([playerId, released]) => ({
      playerId,
      release: clone(released.release),
    })),
    visits,
  };
}

function applyOpenPlayPassControlHandoff({ before, command, contacted, events, releases }) {
  if (releases.length === 0) return contacted;
  if (releases.length !== 1) {
    throw new Error("One source player visit may release at most one live pass.");
  }
  const [{ playerId, release }] = releases;
  if (
    release.kind === "shot"
    || release.kind === "punt"
    || release.receiverNativePlayer === 0
  ) return contacted;
  const receiver = contacted.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === release.receiverNativePlayer,
  );
  if (receiver === undefined) {
    throw new Error("Pass control handoff lost the released receiver.");
  }
  let activePlayerId = contacted.control.activePlayerId;
  if (
    receiver.nativeTeamSlot === contacted.control.nativeTeamSlot
    && receiver.role !== "keeper"
    && receiver.active
  ) {
    activePlayerId = receiver.id;
  } else if (receiver.nativeTeamSlot !== contacted.control.nativeTeamSlot) {
    const nearPath = selectFreeBallNearPathPlayer(
      contacted,
      contacted.control.nativeTeamSlot,
      command,
    );
    const active = before.players.find(({ id }) => id === activePlayerId);
    const selectionCircle = F32(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 10,
    );
    const activeDistance = active === undefined
      ? Number.POSITIVE_INFINITY
      : sourceDistance2d({
          x: F32(active.position.x - before.ball.ball.position.x),
          y: F32(active.position.y - before.ball.ball.position.y),
        });
    if (nearPath !== null && activeDistance >= selectionCircle) {
      activePlayerId = nearPath.id;
    }
  }
  if (activePlayerId === contacted.control.activePlayerId) return contacted;
  events.push({
    type: "pass-control-handoff",
    tick: release.tick,
    playerId,
    receiverId: receiver.id,
    activePlayerId,
  });
  return {
    ...contacted,
    control: { ...contacted.control, activePlayerId },
  };
}

function snapshotCurrentLivePassOffside({
  before,
  contacted,
  events,
  nextTick,
  releases,
}) {
  if (releases.length === 0) return contacted;
  if (releases.length !== 1) {
    throw new Error("One source player visit may publish at most one live offside kick snapshot.");
  }
  const [{ playerId, release }] = releases;
  const passer = before.players.find(({ id }) => id === playerId);
  if (passer === undefined || !passer.active) {
    throw new Error("Live offside kick snapshot lost its current active passer.");
  }
  const isPass = Object.hasOwn(release, "receiverNativePlayer");
  if (!isPass) {
    return {
      ...contacted,
      rules: { ...contacted.rules, liveOffside: null },
    };
  }
  const snapshot = createCssoccerLiveOffsideSnapshot({
    tick: nextTick,
    ballPosition: {
      x: before.ball.ball.position.x,
      y: before.ball.ball.position.y,
    },
    passer: {
      playerId: passer.id,
      nativePlayerNumber: passer.nativePlayerNumber,
    },
    players: currentLiveOffsidePlayers(before.players),
    enabled: before.rules.state.offside.offsideOn,
    canBeOffside: 1,
  });
  events.push({
    type: "offside-kick-snapshotted",
    tick: nextTick,
    playerId: passer.id,
    nativePlayerNumber: passer.nativePlayerNumber,
    defenderLine: snapshot.defenderLine,
    candidateIds: snapshot.candidates.map(({ playerId: candidateId }) => candidateId),
  });
  return {
    ...contacted,
    rules: {
      ...contacted.rules,
      liveOffside: snapshot.status === "pending" ? snapshot : null,
    },
  };
}

function currentLiveOffsidePlayers(players) {
  return players.map((player) => ({
    id: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    active: player.active ? 1 : 0,
    role: player.role === "keeper" ? "keeper" : "outfield",
    position: { x: player.position.x, y: player.position.y },
  }));
}

function resolveOpenPlayCollectedPossession({ match, visits }) {
  let rng = match.rng.state;
  const passActions = [];
  const shotActions = [];
  const runPlayerIds = [];
  const byId = new Map(visits.map((entry) => [entry.playerId, entry]));
  for (const visit of visits) {
    if (visit.interaction !== "collect" && visit.interaction !== "hold") continue;
    const holder = match.players.find(({ id }) => id === visit.playerId);
    if (holder === undefined || holder.role === "keeper" || holder.liveMotion === undefined) {
      throw new Error("Open-play possession visit lost its outfield holder state.");
    }
    if (holder.nativePlayerNumber !== match.possession.owner) continue;
    if (
      holder.liveContact !== undefined
      || holder.livePass !== undefined
      || holder.liveShot !== undefined
      || holder.liveKeeper !== undefined
    ) continue;
    if (
      visit.interaction === "hold"
      && holder.intelligence.count > 1
      && holder.liveMotion.kind === "run-with-ball"
    ) {
      runPlayerIds.push(holder.id);
      continue;
    }
    if (holder.id === match.control.activePlayerId) {
      continue;
    }
    const shootingRange = sourceOpenPlayShootingRange(holder);
    if (shootingRange) {
      const shot = resolveCssoccerShotDecision({
        ball: { x: visit.ballPosition.x, y: visit.ballPosition.y },
        firstTime: false,
        holder: liveShotHolder(holder),
        mustShoot: false,
        opponentsNearHolder: countOpenPlayOpponentsNearHolder({
          holder,
          match,
          visits: byId,
        }),
        seed: rng.seed,
        userControlled: false,
      });
      if (shot.outcome === "shot") {
        shotActions.push({
          charge: null,
          direction: null,
          drive: false,
          holderId: holder.id,
          kind: "shot",
          passType: shot.passType,
          targetKeeperNativePlayer: holder.nativePlayerNumber < 12 ? 12 : 1,
          userControlled: false,
        });
        continue;
      }
    }
    const passInput = {
      ball: { x: visit.ballPosition.x, y: visit.ballPosition.y },
      holder: {
        nativePlayer: holder.nativePlayerNumber,
        position: { x: holder.position.x, y: holder.position.y },
        facing: clone(holder.facing),
        pitchRatio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
        power: holder.gameplay.power,
        flair: holder.gameplay.flair,
        vision: holder.gameplay.vision,
        shootingRange,
      },
      match: {
        ballInHands: visit.possession.inHands !== 0,
        cross: false,
        mustPass: false,
        setPiece: false,
        wantPassNativePlayer: 0,
      },
      players: match.players.map((player) => {
        const playerVisit = byId.get(player.id);
        if (playerVisit === undefined) {
          throw new Error(`Open-play pass decision lost ${player.id}.`);
        }
        return {
          nativePlayer: player.nativePlayerNumber,
          action: player.action.action.value,
          controlled: player.id === match.control.activePlayerId,
          on: player.active,
          position: { x: player.position.x, y: player.position.y },
          distanceToBall: playerVisit.distance,
          flair: player.gameplay.flair,
        };
      }),
      rng,
    };
    const crossing = sourceOpenPlayCrossArea(holder, visit.ballPosition);
    let pass = crossing
      ? resolveCssoccerAiPassDecision({
          ...passInput,
          match: { ...passInput.match, cross: true },
        })
      : null;
    if (pass !== null) rng = pass.rng;
    if (pass === null || pass.outcome === "no-pass") {
      pass = resolveCssoccerAiNormalPass({ ...passInput, rng });
    }
    rng = pass.rng;
    if (pass.outcome === "pass") {
      passActions.push({
        cross: crossing && (pass.passType === 16 || pass.passType === 17),
        holderId: holder.id,
        passType: pass.passType,
        targetNativePlayer: pass.targetNativePlayer,
        wantedReceiver: false,
      });
      continue;
    }
    if (sourceOpenPlayPuntBranchEligible(holder, visit.ballPosition, rng.seed)) {
      const punt = resolveCssoccerPuntDecision({
        ball: { x: visit.ballPosition.x, y: visit.ballPosition.y },
        firstTime: false,
        holder: liveShotHolder(holder),
        mustPunt: false,
        opponentsNearHolder: countOpenPlayOpponentsNearHolder({
          holder,
          match,
          visits: byId,
        }),
        seed: rng.seed,
        userControlled: false,
      });
      if (punt.outcome === "punt") {
        shotActions.push({
          charge: null,
          direction: null,
          drive: false,
          holderId: holder.id,
          kind: "punt",
          passType: LIVE_PUNT_PASS_TYPE,
          targetKeeperNativePlayer: holder.nativePlayerNumber < 12 ? 12 : 1,
          userControlled: false,
        });
        continue;
      }
    }
    runPlayerIds.push(holder.id);
  }
  return { passActions, rng, runPlayerIds, shotActions };
}

function initializeOpenPlayPassActions({ match, nextTick, passActions, players }) {
  if (passActions.length === 0) return players;
  const actionsById = new Map(passActions.map((action) => [action.holderId, action]));
  const rates = new Map(
    currentTeamRates(match.players, match.clock.gameMinute)
      .map(({ id, value }) => [id, value]),
  );
  return players.map((player) => {
    const pass = actionsById.get(player.id);
    if (pass === undefined) return player;
    if (
      match.possession.owner !== player.nativePlayerNumber
      || player.role === "keeper"
      || !Number.isSafeInteger(pass.passType)
      || !Number.isSafeInteger(pass.targetNativePlayer)
    ) {
      throw new Error(`Open-play pass launch lost current ownership for ${player.id}.`);
    }
    const teamRate = rates.get(player.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Open-play pass launch lost the current rate for ${player.id}.`);
    }
    const motionCaptureSpeed = F32(
      (player.gameplay.flair + player.gameplay.pace) / 128,
    );
    const launch = projectCssoccerPassKickLaunch({
      animation: player.animation.id,
      animationFrame: player.animation.frame,
      animationFrameStep: player.animation.frameStep,
      facing: clone(player.facing),
      motionCaptureSpeed,
      passType: pass.passType,
      teamRate,
    });
    const goTarget = {
      x: F32(player.position.x + player.facing.x * launch.targetDistance),
      y: F32(player.position.y + player.facing.y * launch.targetDistance),
    };
    const position = {
      ...updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement: launch.movement,
      }),
      z: player.position.z,
    };
    const facing = turnSourceFacing({
      facing: player.facing,
      target: {
        x: F32(goTarget.x - position.x),
        y: F32(goTarget.y - position.y),
      },
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate },
      ).maxTurnRadians,
    }).facing;
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: { ...clone(launch.movement), z: F32(0) },
      facing,
      target: { ...clone(goTarget), z: F32(0) },
      intelligence: {
        special: 0,
        move: 12,
        count: Math.trunc(
          (1 - launch.animationFrame) / launch.animationFrameStep,
        ) + 1,
      },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: launch.action,
        facingX: facing.x,
        facingY: facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "pass-kick",
        id: launch.animation,
        sourceActionId: launch.action,
        frame: launch.animationFrame,
        frameStep: launch.animationFrameStep,
        pending: null,
        tick: nextTick,
      },
      liveMotion: {
        kind: "pass-kick",
        teamRate,
        target: clone(goTarget),
        goStep: false,
        goCount: player.liveMotion.goCount,
        goDisplacement: clone(launch.movement),
        directionMode: 0,
        resetAnimationFrame: false,
        sideStepDirection: null,
        animationId: launch.animation,
        animationFrameStep: launch.animationFrameStep,
      },
      livePass: {
        phase: "kick-held",
        startTick: nextTick,
        passType: pass.passType,
        targetNativePlayer: pass.targetNativePlayer,
        wantedReceiver: pass.wantedReceiver,
        cross: pass.cross,
        directed: pass.directed === true,
        directedDirection: clone(pass.direction ?? player.facing),
        charge: pass.charge ?? null,
        contact: launch.contact,
        contactOffset: clone(launch.contactOffset),
        goTarget,
        motionCaptureSpeed,
        publishedBallPosition: clone(match.ball.ball.position),
        zoneBallPosition: clone(match.ball.ball.position),
      },
    };
  });
}

function initializeOpenPlayShotActions({ match, nextTick, players, shotActions }) {
  if (shotActions.length === 0) return players;
  const actionsById = new Map(shotActions.map((action) => [action.holderId, action]));
  const rates = new Map(
    currentTeamRates(match.players, match.clock.gameMinute)
      .map(({ id, value }) => [id, value]),
  );
  return players.map((player) => {
    const shot = actionsById.get(player.id);
    if (shot === undefined) return player;
    if (
      match.possession.owner !== player.nativePlayerNumber
      || (player.role === "keeper" && shot.kind !== "punt")
      || !new Set(["punt", "shot"]).has(shot.kind)
      || !Number.isSafeInteger(shot.passType)
    ) {
      throw new Error(`Open-play shot launch lost current ownership for ${player.id}.`);
    }
    const teamRate = rates.get(player.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Open-play shot launch lost the current rate for ${player.id}.`);
    }
    const motionCaptureSpeed = F32(
      (player.gameplay.flair + player.gameplay.pace) / 128,
    );
    const launch = projectCssoccerShotKickLaunch({
      animation: player.animation.id,
      animationFrame: player.animation.frame,
      animationFrameStep: player.animation.frameStep,
      facing: clone(player.facing),
      motionCaptureSpeed,
      passType: shot.kind === "punt" ? -1 : shot.passType,
      teamRate,
    });
    const goTarget = {
      x: F32(player.position.x + player.facing.x * launch.targetDistance),
      y: F32(player.position.y + player.facing.y * launch.targetDistance),
    };
    const position = {
      ...updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement: launch.movement,
      }),
      z: player.position.z,
    };
    const facing = turnSourceFacing({
      facing: player.facing,
      target: {
        x: F32(goTarget.x - position.x),
        y: F32(goTarget.y - position.y),
      },
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate },
      ).maxTurnRadians,
    }).facing;
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: { ...clone(launch.movement), z: F32(0) },
      facing,
      target: { ...clone(goTarget), z: F32(0) },
      intelligence: {
        special: 0,
        move: 12,
        count: Math.trunc(
          (1 - launch.animationFrame) / launch.animationFrameStep,
        ) + 1,
      },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: launch.action,
        facingX: facing.x,
        facingY: facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: `${shot.kind}-kick`,
        id: launch.animation,
        sourceActionId: launch.action,
        frame: launch.animationFrame,
        frameStep: launch.animationFrameStep,
        pending: null,
        tick: nextTick,
      },
      liveMotion: {
        kind: `${shot.kind}-kick`,
        teamRate,
        target: clone(goTarget),
        goStep: false,
        goCount: player.liveMotion.goCount,
        goDisplacement: clone(launch.movement),
        directionMode: 0,
        resetAnimationFrame: false,
        sideStepDirection: null,
        animationId: launch.animation,
        animationFrameStep: launch.animationFrameStep,
      },
      liveShot: {
        phase: "kick-held",
        startTick: nextTick,
        kind: shot.kind,
        passType: shot.passType,
        targetKeeperNativePlayer: shot.targetKeeperNativePlayer,
        userControlled: shot.userControlled,
        direction: shot.direction === null ? null : clone(shot.direction),
        charge: shot.charge,
        drive: shot.drive,
        contact: launch.contact,
        contactOffset: clone(launch.contactOffset),
        goTarget,
        motionCaptureSpeed,
        publishedBallPosition: clone(match.ball.ball.position),
        zoneBallPosition: clone(match.ball.ball.position),
      },
    };
  });
}

function applyOpenPlayPassReceiverStops({ nextTick, players, releases }) {
  const stoppedNativePlayers = new Set(releases
    .filter(({ release }) => release.receiverStopped)
    .map(({ release }) => release.receiverNativePlayer));
  if (stoppedNativePlayers.size === 0) return players;
  return players.map((player) => {
    if (!stoppedNativePlayers.has(player.nativePlayerNumber)) return player;
    return {
      ...clone(player),
      velocity: { x: F32(0), y: F32(0), z: F32(0) },
      intelligence: { special: 0, move: 0, count: 0 },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: player.facing.x,
        facingY: player.facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "stand",
        id: STAND_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        frame: F32(0),
        frameStep: STAND_FRAME_STEP,
        pending: null,
        tick: nextTick,
      },
      liveMotion: {
        ...clone(player.liveMotion),
        kind: "stand",
        goCount: 0,
        goDisplacement: { x: F32(0), y: F32(0) },
        directionMode: 1,
        resetAnimationFrame: true,
        sideStepDirection: null,
        animationId: null,
        animationFrameStep: null,
      },
    };
  });
}

function stepReleasedPassReceiverJourney({ command, match, nextTick, sourcePlayers, visits }) {
  const releasedPasser = sourcePlayers.find((player) => (
    new Set(["air-pass", "ground-pass"]).has(player.livePass?.phase)
    && player.livePass.release?.tick < nextTick
  ));
  if (releasedPasser === undefined || match.possession.owner !== 0) {
    return { players: match.players, rng: match.rng.state };
  }
  const receiver = sourcePlayers.find(
    ({ nativePlayerNumber }) => (
      nativePlayerNumber === releasedPasser.livePass.targetNativePlayer
    ),
  );
  if (releasedPasser.livePass.targetNativePlayer === 0) {
    return { players: match.players, rng: match.rng.state };
  }
  if (receiver === undefined) {
    throw new Error("Released pass lost its current outfield receiver.");
  }
  if (receiver.role === "keeper") {
    return { players: match.players, rng: match.rng.state };
  }
  if (
    receiver.passReceiverIntercept === true
    && receiver.intelligence.count > 1
  ) {
    const continued = continueFreeBallIntercept(receiver, match, nextTick);
    return {
      players: continued === null
        ? match.players
        : match.players.map((player) => player.id === receiver.id ? continued : player),
      rng: match.rng.state,
    };
  }
  const plan = createFreeBallInterceptPlan(receiver, match, nextTick, {
    afterTouchInput: {
      x: F32(command.moveX / 127),
      y: F32(command.moveY / 127),
    },
    automaticMoveSelection: true,
    ballState: match.ball,
    controlled: false,
    userControlIndex: 1,
    userControlled: false,
  });
  if (plan.player === null) {
    return { players: match.players, rng: match.rng.state };
  }
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const holderVisit = visitById.get(receiver.id);
  if (holderVisit === undefined) {
    throw new Error("Pass receiver first-time search lost its source visit.");
  }
  const receiverVisitIndex = visits.findIndex(({ playerId }) => playerId === receiver.id);
  const visitedBeforeReceiver = new Set(
    visits.slice(0, receiverVisitIndex).map(({ playerId }) => playerId),
  );
  const updatedById = new Map(match.players.map((player) => [player.id, player]));
  const sourceTimePlayers = sourcePlayers.map((player) => (
    visitedBeforeReceiver.has(player.id) ? updatedById.get(player.id) : player
  ));
  const eligibleChecks = plan.scan.interceptChecks.filter(
    ({ firstTimeEligible }) => firstTimeEligible,
  );
  const firstTime = eligibleChecks.length === 0
    ? { rng: match.rng.state }
    : resolveCssoccerFirstTimePassSearch({
        holder: {
          nativePlayer: receiver.nativePlayerNumber,
          position: { x: receiver.position.x, y: receiver.position.y },
          facing: clone(receiver.facing),
          pitchRatio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
          power: receiver.gameplay.power,
          flair: receiver.gameplay.flair,
          vision: receiver.gameplay.vision,
          shootingRange: false,
        },
        match: {
          ballInHands: false,
          cross: false,
          mustPass: false,
          setPiece: false,
          wantPassNativePlayer: 0,
        },
        players: sourceTimePlayers.map((player) => {
          const visit = visitById.get(player.id);
          if (visit === undefined) {
            throw new Error(`Pass receiver first-time search lost ${player.id}.`);
          }
          return {
            nativePlayer: player.nativePlayerNumber,
            action: player.action.action.value,
            controlled: player.id === match.control.activePlayerId,
            on: player.active,
            position: { x: player.position.x, y: player.position.y },
            distanceToBall: visit.distance,
            flair: player.gameplay.flair,
          };
        }),
        predictions: eligibleChecks.map(({ target, travel }) => ({
          ball: { x: target.x, y: target.y },
          facing: clone(travel.face),
        })),
        rng: match.rng.state,
      });
  const receiverPlan = {
    ...plan.player,
    passReceiverIntercept: true,
    passReleaseTick: releasedPasser.livePass.release.tick,
  };
  return {
    players: match.players.map((player) => (
      player.id === receiver.id ? receiverPlan : player
    )),
    rng: firstTime.rng,
  };
}

function sourceOpenPlayShootingRange(player) {
  const goalX = player.nativePlayerNumber < 12
    ? CSSOCCER_BALL_CONSTANTS.pitchLength
    : 0;
  const distance = sourceDistance2d({
    x: F32(goalX - player.position.x),
    y: F32((CSSOCCER_BALL_CONSTANTS.pitchWidth / 2) - player.position.y),
  });
  return distance < (
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 12
    + player.gameplay.power * 3
  );
}

function liveShotHolder(player) {
  return {
    nativePlayerNumber: player.nativePlayerNumber,
    position: { x: player.position.x, y: player.position.y },
    facing: clone(player.facing),
    accuracy: player.gameplay.accuracy,
    control: player.gameplay.control,
    flair: player.gameplay.flair,
    power: player.gameplay.power,
  };
}

function countOpenPlayOpponentsNearHolder({ holder, match, visits }) {
  const threshold = F32(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 13,
  );
  return match.players.filter((candidate) => {
    const visit = visits.get(candidate.id);
    if (visit === undefined) {
      throw new Error(`Open-play pressure count lost ${candidate.id}.`);
    }
    return candidate.active
      && (candidate.nativePlayerNumber < 12) !== (holder.nativePlayerNumber < 12)
      && visit.distance <= threshold;
  }).length;
}

function sourceOpenPlayCrossArea(player, ball) {
  const teamB = player.nativePlayerNumber > 11;
  if (ball.y > CSSOCCER_BALL_CONSTANTS.bottomPostY) {
    const outsidePost = ball.y - CSSOCCER_BALL_CONSTANTS.bottomPostY;
    return teamB
      ? ball.x < outsidePost
      : CSSOCCER_BALL_CONSTANTS.pitchLength - ball.x < outsidePost;
  }
  if (ball.y < CSSOCCER_BALL_CONSTANTS.topPostY) {
    const outsidePost = CSSOCCER_BALL_CONSTANTS.topPostY - ball.y;
    return teamB
      ? ball.x < outsidePost
      : CSSOCCER_BALL_CONSTANTS.pitchLength - ball.x < outsidePost;
  }
  return false;
}

function sourceOpenPlayPuntBranchEligible(player, ball, seed) {
  const centreX = CSSOCCER_BALL_CONSTANTS.pitchLength / 2;
  if (player.nativePlayerNumber > 11) {
    return player.facing.x < 0
      && ball.x < CSSOCCER_BALL_CONSTANTS.pitchLength
      && ball.x > centreX
      && seed < -(player.facing.x * 128);
  }
  return player.facing.x > 0
    && ball.x > 0
    && ball.x < centreX
    && seed < player.facing.x * 128;
}

function createOpenPlayUserPassInput({ cross, holder, match, playerDistanceFrame }) {
  return {
    ball: {
      x: match.ball.ball.position.x,
      y: match.ball.ball.position.y,
    },
    holder: {
      nativePlayer: holder.nativePlayerNumber,
      position: { x: holder.position.x, y: holder.position.y },
      facing: clone(holder.facing),
      pitchRatio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
      power: holder.gameplay.power,
      flair: holder.gameplay.flair,
      vision: holder.gameplay.vision,
      shootingRange: sourceOpenPlayShootingRange(holder),
    },
    match: {
      ballInHands: match.possession.inHands !== 0,
      cross,
      mustPass: false,
      setPiece: false,
      wantPassNativePlayer: 0,
    },
    players: match.players.map((player) => {
      const distanceToBall = playerDistanceFrame?.get(player.id);
      if (!Number.isFinite(distanceToBall)) {
        throw new Error(`User pass decision lost the source distance for ${player.id}.`);
      }
      return {
        nativePlayer: player.nativePlayerNumber,
        action: player.action.action.value,
        controlled: player.id === match.control.activePlayerId,
        on: player.active,
        position: { x: player.position.x, y: player.position.y },
        distanceToBall,
        flair: player.gameplay.flair,
      };
    }),
    rng: match.rng.state,
  };
}

function resolveOpenPlayUserPassAction({
  direction,
  holder,
  match,
  playerDistanceFrame,
  standingSpecial,
}) {
  const crossing = !standingSpecial
    && sourceOpenPlayCrossArea(holder, match.ball.ball.position);
  const passInput = createOpenPlayUserPassInput({
    cross: crossing,
    holder,
    match,
    playerDistanceFrame,
  });
  const decision = standingSpecial
    ? resolveCssoccerUserDirectionalPass({
        ball: passInput.ball,
        direction,
        holder: passInput.holder,
        players: passInput.players,
        rng: passInput.rng,
      })
    : resolveCssoccerUserPassDecision(passInput);
  const directed = decision.outcome !== "pass";
  return {
    rng: decision.rng,
    action: {
      holderId: holder.id,
      passType: directed ? 5 : decision.passType,
      targetNativePlayer: directed ? 0 : decision.targetNativePlayer,
      wantedReceiver: false,
      cross: !directed
        && crossing
        && (decision.passType === 16 || decision.passType === 17),
      directed,
      direction: clone(standingSpecial ? direction : holder.facing),
      charge: null,
    },
  };
}

function launchOpenPlayUserPass({ command, events, match, nextTick, pass }) {
  const launchMatch = {
    ...match,
    rng: { ...match.rng, state: pass.rng },
  };
  const players = initializeOpenPlayPassActions({
    match: launchMatch,
    nextTick,
    passActions: [pass.action],
    players: launchMatch.players,
  });
  events.push({
    type: "local-pass-started",
    tick: nextTick,
    playerId: pass.action.holderId,
    receiverNativePlayer: pass.action.targetNativePlayer,
    passType: pass.action.passType,
    cross: pass.action.cross,
    directed: pass.action.directed,
    charge: pass.action.charge,
  });
  return {
    ...launchMatch,
    players,
    control: {
      ...launchMatch.control,
      burstTimer: 0,
      lastCommand: clone(command),
      passCharge: null,
      shotCharge: null,
    },
  };
}

function resolveOpenPlayUserFrontFireAction({
  charge,
  direction,
  holder,
  match,
  playerDistanceFrame,
}) {
  const byId = new Map(match.players.map((player) => [
    player.id,
    playerDistanceFrame?.get(player.id),
  ]));
  for (const [id, distance] of byId) {
    if (!Number.isFinite(distance)) {
      throw new Error(`User shot decision lost the source distance for ${id}.`);
    }
  }
  const opponentsNearHolder = match.players.filter((candidate) => (
    candidate.active
    && (candidate.nativePlayerNumber < 12) !== (holder.nativePlayerNumber < 12)
    && byId.get(candidate.id)
      <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 13
  )).length;
  const shot = resolveCssoccerShotDecision({
    ball: {
      x: match.ball.ball.position.x,
      y: match.ball.ball.position.y,
    },
    firstTime: false,
    holder: liveShotHolder(holder),
    mustShoot: charge !== null,
    opponentsNearHolder,
    seed: match.rng.state.seed,
    userControlled: true,
  });
  if (shot.outcome === "shot") {
    return {
      kind: "shot",
      rng: match.rng.state,
      action: {
        charge,
        direction: clone(direction),
        drive: charge === null,
        holderId: holder.id,
        kind: "shot",
        passType: shot.passType,
        targetKeeperNativePlayer: holder.nativePlayerNumber < 12 ? 12 : 1,
        userControlled: true,
      },
    };
  }
  const punt = resolveCssoccerPuntDecision({
    ball: {
      x: match.ball.ball.position.x,
      y: match.ball.ball.position.y,
    },
    firstTime: false,
    holder: liveShotHolder(holder),
    mustPunt: false,
    opponentsNearHolder,
    seed: match.rng.state.seed,
    userControlled: true,
  });
  if (punt.outcome === "punt") {
    return {
      kind: "punt",
      rng: match.rng.state,
      action: {
        charge: null,
        direction: null,
        drive: false,
        holderId: holder.id,
        kind: "punt",
        passType: LIVE_PUNT_PASS_TYPE,
        targetKeeperNativePlayer: holder.nativePlayerNumber < 12 ? 12 : 1,
        userControlled: true,
      },
    };
  }

  const chip = resolveOpenPlayUserPassAction({
    direction,
    holder,
    match,
    playerDistanceFrame,
    standingSpecial: false,
  });
  return {
    kind: "chip",
    pass: {
      ...chip,
      action: {
        ...chip.action,
        passType: -1,
        cross: false,
        charge: null,
        direction: clone(direction),
      },
    },
  };
}

function launchOpenPlayUserShot({ command, events, match, nextTick, shot }) {
  const launchMatch = {
    ...match,
    rng: { ...match.rng, state: shot.rng },
  };
  const players = initializeOpenPlayShotActions({
    match: launchMatch,
    nextTick,
    players: launchMatch.players,
    shotActions: [shot.action],
  });
  events.push({
    type: `local-${shot.action.kind}-started`,
    tick: nextTick,
    playerId: shot.action.holderId,
    passType: shot.action.passType,
    charge: shot.action.charge,
    direction: shot.action.direction === null ? null : clone(shot.action.direction),
  });
  return {
    ...launchMatch,
    players,
    control: {
      ...launchMatch.control,
      burstTimer: 0,
      lastCommand: clone(command),
      passCharge: null,
      shotCharge: null,
    },
  };
}

function launchOpenPlayUserFrontFire(input) {
  const front = resolveOpenPlayUserFrontFireAction(input);
  if (front.kind === "chip") {
    return launchOpenPlayUserPass({
      command: input.command,
      events: input.events,
      match: input.match,
      nextTick: input.nextTick,
      pass: front.pass,
    });
  }
  return launchOpenPlayUserShot({
    command: input.command,
    events: input.events,
    match: input.match,
    nextTick: input.nextTick,
    shot: front,
  });
}

function initializeOpenPlayTacklePlayer({ player, targetOffset, teamRate, nextTick }) {
  const distance = sourceDistance2d(targetOffset);
  if (!(distance > 0)) return null;
  const maxTurnRadians = projectCssoccerMotionSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  ).maxTurnRadians;
  if (
    sourceAngleCosine({ target: targetOffset, facing: player.facing })
      < Math.cos(maxTurnRadians)
  ) return null;
  const prat = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  const launchScale = Math.trunc((teamRate + player.gameplay.power + 32) / 20);
  const goTarget = {
    x: F32(player.position.x + (targetOffset.x / distance) * 30 * prat),
    y: F32(player.position.y + (targetOffset.y / distance) * 30 * prat),
  };
  const initialDisplacement = {
    x: F32(targetOffset.x * launchScale / distance),
    y: F32(targetOffset.y * launchScale / distance),
  };
  const planar = updateSourcePosition2d({
    position: { x: player.position.x, y: player.position.y },
    displacement: initialDisplacement,
  });
  const position = { ...planar, z: player.position.z };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(goTarget.x - position.x),
      y: F32(goTarget.y - position.y),
    },
    maxTurnRadians,
  }).facing;
  const goDisplacement = {
    x: F32(initialDisplacement.x * TACKLE_DECEL),
    y: F32(initialDisplacement.y * TACKLE_DECEL),
  };
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { ...initialDisplacement, z: F32(0) },
    facing,
    intelligence: { special: 0, move: 0, count: 0 },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: TACKLE_ACTION,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "tackle",
      id: TACKLE_ANIMATION,
      sourceActionId: TACKLE_ACTION,
      frame: F32(0),
      frameStep: TACKLE_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: "tackle",
      teamRate,
      target: goTarget,
      goStep: false,
      goCount: 24,
      goDisplacement,
      directionMode: 0,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: TACKLE_ANIMATION,
      animationFrameStep: TACKLE_FRAME_STEP,
    },
    liveContact: {
      phase: "tackle",
      startTick: nextTick,
      goCount: 24,
      bargeCountdown: 0,
      force: 0,
      opponentId: null,
    },
  };
}

function initializeOpenPlayStealPlayer({ player, opponentId, teamRate, nextTick }) {
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    intelligence: { special: 0, move: 0, count: 0 },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: STEAL_ACTION,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "steal",
      id: STEAL_ANIMATION,
      sourceActionId: STEAL_ACTION,
      frame: F32(0),
      frameStep: STEAL_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: "steal",
      teamRate,
      target: clone(player.position),
      goStep: false,
      goCount: 0,
      goDisplacement: clone(player.facing),
      directionMode: 1,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: STEAL_ANIMATION,
      animationFrameStep: STEAL_FRAME_STEP,
    },
    liveContact: {
      phase: "steal",
      startTick: nextTick,
      goCount: 0,
      bargeCountdown: 0,
      force: 0,
      opponentId,
    },
  };
}

function initializeOpenPlayAiChallenges(match, nextTick, events) {
  if (match.possession.owner === 0 || match.possession.inHands !== 0) return match;
  const owner = match.players.find(({ nativePlayerNumber }) => (
    nativePlayerNumber === match.possession.owner
  ));
  if (owner === undefined) throw new Error("AI pressure lost the current ball owner.");
  const candidates = match.players
    .filter((player) => (
      player.active
      && player.role !== "keeper"
      && player.id !== match.control.activePlayerId
      && player.liveContact === undefined
      && player.livePass === undefined
      && player.liveShot === undefined
      && player.action.action.value <= CSSOCCER_NATIVE_ACTIONS.RUN
      && (player.nativePlayerNumber < 12) !== (owner.nativePlayerNumber < 12)
    ))
    .map((player) => ({
      player,
      distance: sourceDistance2d({
        x: F32(owner.position.x - player.position.x),
        y: F32(owner.position.y - player.position.y),
      }),
    }))
    .sort((left, right) => (
      left.distance - right.distance
      || left.player.nativePlayerNumber - right.player.nativePlayerNumber
    ));
  const nearest = candidates[0];
  if (nearest === undefined) return match;
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === nearest.player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`AI pressure lost the current rate for ${nearest.player.id}.`);
  }
  let challenged = null;
  let kind = null;
  if (
    nearest.distance < STEAL_START_DISTANCE
    && match.rng.state.seed + nearest.player.gameplay.control >= owner.gameplay.control
  ) {
    challenged = initializeOpenPlayStealPlayer({
      player: nearest.player,
      opponentId: owner.id,
      teamRate,
      nextTick,
    });
    kind = "steal";
  } else if (
    nearest.distance < CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 4
    && match.rng.state.seed + nearest.player.gameplay.power
      > 64 + Math.trunc(owner.gameplay.flair / 2)
  ) {
    challenged = initializeOpenPlayTacklePlayer({
      player: nearest.player,
      targetOffset: {
        x: F32(owner.position.x - nearest.player.position.x),
        y: F32(owner.position.y - nearest.player.position.y),
      },
      teamRate,
      nextTick,
    });
    kind = "tackle";
  }
  if (challenged === null) return match;
  challenged.liveContact.opponentId = owner.id;
  events.push({
    type: `ai-${kind}-started`,
    tick: nextTick,
    playerId: challenged.id,
    opponentId: owner.id,
    distance: nearest.distance,
    seed: match.rng.state.seed,
  });
  return {
    ...match,
    players: match.players.map((player) => (
      player.id === challenged.id ? challenged : player
    )),
  };
}

function processLocalUser({
  match,
  command,
  nearest,
  nextTick,
  playerDistanceFrame,
  events,
}) {
  if (match.kickoff.phase !== "open-play") return match;
  const activePlayerId = match.control.activePlayerId;
  if (activePlayerId === null) {
    throw new Error(`Open play requires current control after nearest-player scan ${nearest.id}.`);
  }
  const selected = match.players.find(({ id }) => id === activePlayerId);
  if (selected === undefined || selected.role === "keeper") {
    throw new Error("General-play control requires one current Argentina outfielder.");
  }
  const vector = sourceUserVector(selected, command);
  const moving = vector.x !== 0 || vector.y !== 0;
  const opponentPossession = match.possession.owner !== 0
    && (match.possession.owner < 12) !== (selected.nativePlayerNumber < 12);
  const fire1 = (command.buttons & BUTTON_FIRE_1) !== 0;
  const fire2 = (command.buttons & BUTTON_FIRE_2) !== 0;
  const burstTimer = opponentPossession
    ? advanceBurstTimer(match.control.burstTimer, fire2)
    : match.control.burstTimer;
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === activePlayerId)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error("Controlled player lost its current dynamic team rate.");
  }
  if (selected.liveContact !== undefined) {
    events.push({
      type: "local-contact-active",
      tick: nextTick,
      playerId: selected.id,
      phase: selected.liveContact.phase,
    });
    return {
      ...match,
      control: {
        ...match.control,
        burstTimer: 0,
        lastCommand: clone(command),
        passCharge: null,
        shotCharge: null,
      },
    };
  }
  const ownsBall = match.possession.owner === selected.nativePlayerNumber
    && match.possession.inHands === 0;
  if (
    (match.control.passCharge !== null || match.control.shotCharge !== null)
    && (
      !ownsBall
      || (
        match.control.passCharge?.playerId !== selected.id
        && match.control.shotCharge?.playerId !== selected.id
      )
    )
  ) {
    match = {
      ...match,
      control: { ...match.control, passCharge: null, shotCharge: null },
    };
  }
  if (selected.livePass !== undefined || selected.liveShot !== undefined) {
    const activeKick = selected.livePass ?? selected.liveShot;
    events.push({
      type: selected.livePass === undefined ? "local-shot-active" : "local-pass-active",
      tick: nextTick,
      playerId: selected.id,
      phase: activeKick.phase,
    });
    return {
      ...match,
      control: {
        ...match.control,
        burstTimer: 0,
        lastCommand: clone(command),
        passCharge: null,
        shotCharge: null,
      },
    };
  }
  const interactive = selected.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
    || selected.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN;
  if (opponentPossession && interactive && fire1) {
    const owner = match.players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === match.possession.owner
    ));
    const tackled = initializeOpenPlayTacklePlayer({
      player: selected,
      targetOffset: moving ? vector : selected.facing,
      teamRate,
      nextTick,
    });
    events.push({
      type: tackled === null ? "local-tackle-rejected" : "local-tackle-started",
      tick: nextTick,
      playerId: selected.id,
      opponentId: owner?.id ?? null,
      reason: tackled === null ? "max-turn-angle" : null,
    });
    if (tackled !== null) tackled.liveContact.opponentId = owner?.id ?? null;
    return {
      ...match,
      players: tackled === null
        ? match.players
        : match.players.map((player) => player.id === selected.id ? tackled : player),
      control: {
        ...match.control,
        burstTimer: 0,
        lastCommand: clone(command),
        passCharge: null,
        shotCharge: null,
      },
    };
  }
  if (opponentPossession && interactive && fire2) {
    const owner = match.players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === match.possession.owner
    ));
    const distance = playerDistanceFrame?.get(selected.id);
    if (!Number.isFinite(distance)) {
      throw new Error("Close-steal decision lost the current source distance.");
    }
    if (distance < STEAL_START_DISTANCE) {
      const stealing = initializeOpenPlayStealPlayer({
        player: selected,
        opponentId: owner?.id ?? null,
        teamRate,
        nextTick,
      });
      events.push({
        type: "local-steal-started",
        tick: nextTick,
        playerId: selected.id,
        opponentId: owner?.id ?? null,
        distance,
      });
      return {
        ...match,
        players: match.players.map((player) => (
          player.id === selected.id ? stealing : player
        )),
        control: {
          ...match.control,
          burstTimer: 0,
          lastCommand: clone(command),
          passCharge: null,
          shotCharge: null,
        },
      };
    }
  }
  if (
    ownsBall
    && selected.livePass === undefined
    && selected.liveShot === undefined
    && moving
    && fire2
    && new Set([
      CSSOCCER_NATIVE_ACTIONS.STAND,
      CSSOCCER_NATIVE_ACTIONS.RUN,
    ]).has(selected.action.action.value)
  ) {
    return launchOpenPlayUserPass({
      command,
      events,
      match,
      nextTick,
      pass: resolveOpenPlayUserPassAction({
        direction: vector,
        holder: selected,
        match,
        playerDistanceFrame,
        standingSpecial: selected.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND,
      }),
    });
  }
  if (
    ownsBall
    && selected.livePass === undefined
    && selected.liveShot === undefined
    && moving
    && fire1
    && new Set([
      CSSOCCER_NATIVE_ACTIONS.STAND,
      CSSOCCER_NATIVE_ACTIONS.RUN,
    ]).has(selected.action.action.value)
  ) {
    return launchOpenPlayUserFrontFire({
      charge: null,
      command,
      direction: vector,
      events,
      holder: selected,
      match,
      nextTick,
      playerDistanceFrame,
    });
  }
  if (
    ownsBall
    && selected.livePass === undefined
    && selected.liveShot === undefined
    && !moving
    && selected.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
  ) {
    if (fire1) {
      const previousCharge = match.control.shotCharge?.playerId === selected.id
        ? match.control.shotCharge.ticks
        : 0;
      const shotCharge = {
        playerId: selected.id,
        ticks: Math.min(30, previousCharge + 1),
        direction: clone(match.control.shotCharge?.direction ?? selected.facing),
      };
      events.push({
        type: "local-shot-charging",
        tick: nextTick,
        playerId: selected.id,
        charge: shotCharge.ticks,
      });
      return {
        ...match,
        control: {
          ...match.control,
          burstTimer: 0,
          lastCommand: clone(command),
          passCharge: null,
          shotCharge,
        },
      };
    }
    if (match.control.shotCharge?.playerId === selected.id) {
      return launchOpenPlayUserFrontFire({
        charge: match.control.shotCharge.ticks,
        command,
        direction: clone(match.control.shotCharge.direction),
        events,
        holder: selected,
        match,
        nextTick,
        playerDistanceFrame,
      });
    }
    if (fire2) {
      const previousCharge = match.control.passCharge?.playerId === selected.id
        ? match.control.passCharge.ticks
        : 0;
      const passCharge = {
        playerId: selected.id,
        ticks: Math.min(30, previousCharge + 1),
        direction: clone(selected.facing),
      };
      events.push({
        type: "local-pass-charging",
        tick: nextTick,
        playerId: selected.id,
        charge: passCharge.ticks,
      });
      return {
        ...match,
        control: {
          ...match.control,
          burstTimer: 0,
          lastCommand: clone(command),
          passCharge,
          shotCharge: null,
        },
      };
    }
    if (match.control.passCharge?.playerId === selected.id) {
      return launchOpenPlayUserPass({
        command,
        events,
        match,
        nextTick,
        pass: {
          rng: match.rng.state,
          action: {
            holderId: selected.id,
            passType: 5,
            targetNativePlayer: 0,
            wantedReceiver: false,
            cross: false,
            directed: true,
            direction: clone(match.control.passCharge.direction),
            charge: match.control.passCharge.ticks,
          },
        },
      });
    }
  }
  if (
    ownsBall
    && fire2
    && !moving
    && selected.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
  ) {
    events.push({
      type: "local-pass-awaiting-stand",
      tick: nextTick,
      playerId: selected.id,
    });
  }
  if (
    match.possession.owner === 0
    && selected.intelligence.move === 1
    && selected.intelligence.count > 0
  ) {
    return {
      ...match,
      control: {
        ...match.control,
        activePlayerId,
        burstTimer,
        lastCommand: clone(command),
      },
    };
  }
  const players = match.players.map((player) => {
    const selected = player.id === activePlayerId;
    if (!selected) return clone(player);
    const stoppingRun = !moving
      && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN;
    const previousPosition = clone(player.position);
    const previousFacing = clone(player.facing);
    let position = clone(player.position);
    let velocity = { x: F32(0), y: F32(0), z: F32(0) };
    let facing = clone(player.facing);
    let actionId = CSSOCCER_NATIVE_ACTIONS.STAND;
    if (moving) {
      const speed = actualPlayerSpeed({
        pitchLength: 1280,
        teamRate,
        speedIntent: CSSOCCER_SPEED_INTENT.normal,
        intentionCount: 0,
        sideStep: false,
        nativePlayer: player.nativePlayerNumber,
        ballPossession: match.possession.owner,
        ballInHands: match.possession.inHands !== 0,
        keeperNativePlayers: [1, 12],
        userControlIndex: 1,
        burstTimer,
      });
      const forward = sourceForwardDisplacement({
        facing: player.facing,
        targetOffset: vector,
        speed,
      });
      const planarPosition = updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement: forward.displacement,
      });
      position = {
        ...planarPosition,
        z: player.position.z,
      };
      velocity = { ...forward.displacement, z: F32(0) };
      facing = turnSourceFacing({
        facing: player.facing,
        target: vector,
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate },
        ).maxTurnRadians,
      }).facing;
      actionId = CSSOCCER_NATIVE_ACTIONS.RUN;
      events.push({
        type: "local-player-moved",
        tick: nextTick,
        playerId: player.id,
        position: clone(position),
      });
    } else if (stoppingRun) {
      const speed = actualPlayerSpeed({
        pitchLength: 1280,
        teamRate,
        speedIntent: CSSOCCER_SPEED_INTENT.normal,
        intentionCount: 0,
        sideStep: false,
        nativePlayer: player.nativePlayerNumber,
        ballPossession: match.possession.owner,
        ballInHands: match.possession.inHands !== 0,
        keeperNativePlayers: [1, 12],
        userControlIndex: 1,
        burstTimer,
      });
      const stoppingStep = sourceForwardDisplacement({
        facing: player.facing,
        targetOffset: vector,
        speed,
      });
      const planarPosition = updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement: stoppingStep.displacement,
      });
      position = { ...planarPosition, z: player.position.z };
      velocity = { ...stoppingStep.displacement, z: F32(0) };
      facing = turnSourceFacing({
        facing: player.facing,
        target: {
          x: F32(match.ball.ball.position.x - position.x),
          y: F32(match.ball.ball.position.y - position.y),
        },
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate },
        ).maxTurnRadians,
      }).facing;
    }
    const target = {
      x: F32(player.position.x + (vector.x * 256)),
      y: F32(player.position.y + (vector.y * 256)),
    };
    return {
      ...clone(player),
      previousPosition,
      previousFacing,
      position,
      velocity,
      facing,
      target: {
        ...target,
        z: player.position.z,
      },
      intelligence: stoppingRun
        ? { special: 0, move: 0, count: 0 }
        : clone(player.intelligence),
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId,
        facingX: facing.x,
        facingY: facing.y,
      }),
      liveMotion: {
        kind: moving ? "run" : "stand",
        teamRate,
        target,
        goStep: false,
        goCount: moving ? 1 : 0,
        goDisplacement: stoppingRun
          ? { x: F32(0), y: F32(0) }
          : { x: velocity.x, y: velocity.y },
        directionMode: moving ? 0 : 1,
        resetAnimationFrame: !moving,
        sideStepDirection: null,
        animationId: null,
        animationFrameStep: null,
      },
    };
  });
  return {
    ...match,
    players,
    control: {
      ...match.control,
      activePlayerId,
      burstTimer,
      lastCommand: clone(command),
    },
  };
}

function stepActiveFreeBallJourney(match, players, nextTick, command) {
  if (match.possession.owner !== 0 || match.control.activePlayerId === null) return players;
  if (players.some((player) => (
    player.livePass?.release?.tick === nextTick
    || player.liveShot?.release?.tick === nextTick
  ))) {
    return players;
  }
  const active = match.players.find(({ id }) => id === match.control.activePlayerId);
  if (active === undefined || active.role === "keeper") return players;
  let stepped = null;
  if (active.intelligence.move === 1 && active.intelligence.count > 0) {
    stepped = continueFreeBallIntercept(active, match, nextTick);
  } else {
    const nearPath = selectFreeBallNearPathPlayer(match, active.nativeTeamSlot, command);
    if (nearPath?.id === active.id) {
      stepped = planFreeBallIntercept(active, match, nextTick, command);
    }
  }
  if (stepped === null) return players;
  return players.map((player) => player.id === stepped.id ? stepped : player);
}

function stepControlledStandingProcessDirection({ match, nextTick, players, visits }) {
  if (match.possession.owner === 0 || match.control.activePlayerId === null) return players;
  const active = players.find(({ id }) => id === match.control.activePlayerId);
  if (active === undefined || active.role === "keeper") {
    throw new Error("Open-play process_dir lost the controlled Argentina outfielder.");
  }
  const visit = visits.find(({ playerId }) => playerId === active.id);
  if (visit === undefined) {
    throw new Error("Open-play process_dir lost the controlled player's source-order visit.");
  }
  if (
    active.action.action.value !== CSSOCCER_NATIVE_ACTIONS.STAND
    || active.liveMotion?.directionMode !== 1
  ) {
    return players;
  }
  const target = {
    x: F32(visit.ballPosition.x - active.position.x),
    y: F32(visit.ballPosition.y - active.position.y),
  };
  if (target.x === 0 && target.y === 0) return players;
  const teamRate = active.liveMotion.teamRate;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error("Open-play process_dir lost the controlled player's current team rate.");
  }
  const facing = turnSourceFacing({
    facing: active.facing,
    target,
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians,
  }).facing;
  return players.map((player) => player.id === active.id
    ? {
        ...clone(player),
        previousFacing: clone(player.facing),
        facing,
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
          facingX: facing.x,
          facingY: facing.y,
        }),
      }
    : player);
}

function planFreeBallIntercept(player, match, nextTick, command) {
  return createFreeBallInterceptPlan(player, match, nextTick, {
    afterTouchInput: {
      x: F32(command.moveX / 127),
      y: F32(command.moveY / 127),
    },
    automaticMoveSelection: false,
    ballState: match.ball,
    controlled: false,
    userControlIndex: 1,
    userControlled: false,
  }).player;
}

function createFreeBallInterceptPlan(player, match, nextTick, options) {
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Free-ball interception lost the current rate for ${player.id}.`);
  }
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const playerHeight = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value;
  const scan = scanCssoccerFreeBallControlIntercept({
    afterTouchInput: options.afterTouchInput,
    ballState: options.ballState,
    frozenShotPrediction: null,
    pitchLength: 1280,
    pitchWidth: 800,
    playerHeight,
    player: {
      position: player.position,
      facing: player.facing,
      fullSpeed: sourceFullPlayerSpeed({
        pitchLength: 1280,
        teamRate,
        celebrating: false,
      }),
      maxTurn2Radians: travelProfile.maxTurn2Radians,
      imThereDistance: travelProfile.imThereDistance,
      canRotateAndRun: [
        CSSOCCER_NATIVE_ACTIONS.STAND,
        CSSOCCER_NATIVE_ACTIONS.RUN,
      ].includes(player.action.action.value),
      controlled: options.controlled,
      userControlled: options.userControlled,
      reactionTicks: 1 + Math.trunc(player.gameplay.flair / 16),
      jumpHeight: F32(playerHeight + 6 + Math.trunc(player.gameplay.power / 10)),
      mustFace: null,
      automaticMoveSelection: options.automaticMoveSelection,
      controlRequested: false,
      controlAttribute: player.gameplay.control,
      trapState: 0,
    },
  });
  if (scan.intercept === null) return { player: null, scan };
  const intentionCount = 33 - Math.trunc(player.gameplay.flair / 4);
  return {
    player: moveFreeBallInterceptor(player, {
      ballState: match.possession.lastTouch,
      goCount: scan.intercept.travel.ticks,
      intelligenceCount: intentionCount,
      nextTick,
      special: scan.intercept.actionIndex > 0 ? 1 : 0,
      target: scan.intercept.target,
      teamRate,
      userControlIndex: options.userControlIndex,
    }),
    scan,
  };
}

function continueFreeBallIntercept(player, match, nextTick) {
  const intelligenceCount = player.intelligence.count - 1;
  if (player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN) return null;
  return moveFreeBallInterceptor(player, {
    ballState: player.ballState,
    goCount: Math.max(0, player.liveMotion.goCount - 1),
    intelligenceCount,
    nextTick,
    special: player.intelligence.special,
    target: player.liveMotion.target,
    teamRate: player.liveMotion.teamRate,
    userControlIndex: 1,
  });
}

function moveFreeBallInterceptor(player, {
  ballState,
  goCount,
  intelligenceCount,
  nextTick,
  special,
  target,
  teamRate,
  userControlIndex,
}) {
  const speed = actualPlayerSpeed({
    pitchLength: 1280,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.intercept,
    intentionCount: intelligenceCount,
    sideStep: false,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: 0,
    ballInHands: false,
    keeperNativePlayers: [1, 12],
    userControlIndex,
    burstTimer: 0,
  });
  const targetOffset = {
    x: F32(target.x - player.position.x),
    y: F32(target.y - player.position.y),
  };
  const forward = sourceForwardDisplacement({
    facing: player.facing,
    targetOffset,
    speed,
  });
  const position = {
    ...updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement: forward.displacement,
    }),
    z: player.position.z,
  };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(target.x - position.x),
      y: F32(target.y - position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians,
  }).facing;
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { ...clone(forward.displacement), z: F32(0) },
    facing,
    target: { x: target.x, y: target.y, z: F32(0) },
    ballState,
    intelligence: {
      special,
      move: 1,
      count: intelligenceCount,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: facing.x,
      facingY: facing.y,
    }),
    liveMotion: {
      kind: "run",
      teamRate,
      target: { x: target.x, y: target.y },
      goStep: false,
      goCount,
      goDisplacement: clone(forward.displacement),
      directionMode: 0,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: null,
      animationFrameStep: null,
      userControlIndex,
    },
  };
}

function selectFreeBallNearPathPlayer(match, nativeTeamSlot, command) {
  const target = projectFreeBallPathMean(match.ball, command);
  let selected = null;
  let closest = 10000;
  const players = match.players
    .filter((player) => player.nativeTeamSlot === nativeTeamSlot)
    .slice()
    .sort((left, right) => right.nativePlayerNumber - left.nativePlayerNumber);
  for (const player of players) {
    if (!player.active || player.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN) continue;
    const distance = sourceDistance2d({
      x: F32(player.position.x - target.x),
      y: F32(player.position.y - target.y),
    });
    if (player.role === "keeper") {
      if (distance * 2 < closest && closest > 8) {
        selected = player;
        closest = Math.trunc(distance);
      }
    } else if (distance < closest) {
      selected = player;
      closest = Math.trunc(distance);
    }
  }
  return selected;
}

function projectFreeBallPathMean(ball, command) {
  const predictions = [clone(ball.ball.position)];
  let prediction = ball;
  const afterTouchInput = {
    x: F32(command.moveX / 127),
    y: F32(command.moveY / 127),
  };
  for (let tickOffset = 1; tickOffset <= 40; tickOffset += 1) {
    if (prediction.outcome === null) {
      prediction = stepBallMatchState(prediction, {
        ...(prediction.ball.afterTouch.user === 0 ? {} : { afterTouchInput }),
      }).state;
    }
    predictions.push(clone(prediction.ball.position));
  }
  const origin = predictions[0];
  const playerHeight = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value;
  let x = F32(-1000);
  let y = F32(0);
  let points = 0;
  for (let tickOffset = 1; tickOffset < 40; tickOffset += 1) {
    const point = predictions[tickOffset];
    if (x < -999 && point.z < playerHeight + 4) {
      x = F32(point.x - origin.x);
      y = F32(point.y - origin.y);
    } else if (x > -999) {
      x = F32(x + F32(point.x - origin.x));
      y = F32(y + F32(point.y - origin.y));
      points += 1;
    }
  }
  return points === 0
    ? predictions[40]
    : {
        x: F32(F32(x / points) + origin.x),
        y: F32(F32(y / points) + origin.y),
        z: origin.z,
      };
}

function sourceUserVector(player, command) {
  let x = F32(command.moveX);
  let y = F32(command.moveY);
  const margin = F32(CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 2);
  if ((player.position.x < -margin && x < 0) || (player.position.x > 1280 + margin && x > 0)) {
    x = F32(0);
    y = Math.abs(y) < 0.05 ? F32(0) : F32(Math.sign(y));
  }
  if ((player.position.y < -margin && y < 0) || (player.position.y > 800 + margin && y > 0)) {
    y = F32(0);
    x = Math.abs(x) < 0.05 ? F32(0) : F32(Math.sign(x));
  }
  return { x, y };
}

function advanceBurstTimer(current, pressed) {
  if (!pressed) return 0;
  if (current === 0) return 20;
  const decremented = current - 1;
  return decremented === 0 ? -1 : decremented;
}

function selectControlledPlayer({ match, nearest, nextTick }) {
  const withCurrentControl = match.kickoff.phase === "open-play"
    ? {
        ...match,
        control: {
          ...match.control,
          activePlayerId: match.control.activePlayerId ?? nearest.id,
        },
      }
    : match;
  return {
    ...withCurrentControl,
    playerHighlight: stepCssoccerPlayerHighlightState(
      match.playerHighlight,
      createCssoccerFreePlayPlayerHighlightInputFrame({
        match: withCurrentControl,
        tick: nextTick,
      }),
    ),
  };
}

function processOfficials(match, { events, nextTick, sourceInitialization }) {
  const current = processCurrentLiveOffside(match, nextTick, events);
  if (sourceInitialization || current.kickoff.phase !== "centre-positioning") return current;
  const referee = current.officials.officials[0];
  const ready = CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value;
  const officials = referee.action === ready
    ? current.officials
    : stepCssoccerOpeningOfficialState(current.officials);
  return { ...current, officials };
}

function processCurrentLiveOffside(match, nextTick, events) {
  const snapshot = match.rules.liveOffside;
  if (snapshot == null) return match;
  const stoppage = (
    match.kickoff.phase === "open-play"
    && match.goal.phase === "normal-play"
    && match.rules.boundary == null
    && match.rules.foulRestart == null
    && match.ball.outcome == null
  ) ? null : match.kickoff.phase;
  const resolved = resolveCssoccerLiveOffsideSnapshot(snapshot, {
    ballPosition: {
      x: match.ball.ball.position.x,
      y: match.ball.ball.position.y,
    },
    lastTouch: match.possession.lastTouch,
    players: currentLiveOffsidePlayers(match.players),
    refereeStrictness: match.rules.state.config.refereeStrictness,
    stoppage,
  });
  if (resolved.status === "pending") return match;
  if (resolved.status === "clear" || resolved.status === "cancelled") {
    if (resolved.event !== null) events.push({ tick: nextTick, ...clone(resolved.event) });
    return {
      ...match,
      rules: { ...match.rules, liveOffside: null },
    };
  }
  const involvement = resolved.event;
  const player = match.players.find(({ id }) => id === involvement.playerId);
  if (
    player === undefined
    || !player.active
    || player.nativePlayerNumber !== involvement.nativePlayerNumber
  ) {
    throw new Error("Live offside involvement lost its current active stable player.");
  }
  const awardedNativeTeam = player.nativeTeamSlot === "A" ? "B" : "A";
  let routed = resolveCssoccerRuleFoul(match.rules.state, {
    candidate: {
      type: "foul-candidate",
      fouler: player.nativePlayerNumber,
      fallenPlayer: null,
      source: "offside_rule",
      direct: 0,
      forceSeen: 1,
      offsideNow: 1,
      playerId: player.id,
    },
    offenderPosition: clone(involvement.incidentPosition),
    refereePosition: {
      x: match.officials.officials[0].position.x,
      y: match.officials.officials[0].position.y,
    },
    ballPossession: match.possession.owner,
    justScored: match.goal.justScored === 0 ? 0 : 1,
    manDown: 0,
    offenderDistanceToBall: sourceDistance2d({
      x: F32(player.position.x - match.ball.ball.position.x),
      y: F32(player.position.y - match.ball.ball.position.y),
    }),
    rng: match.rng.state,
    takerCandidates: currentRuleTakerCandidates(
      match,
      awardedNativeTeam,
      involvement.incidentPosition,
    ),
  });
  events.push({
    type: "offside-decision",
    tick: nextTick,
    playerId: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    reason: involvement.reason,
    kickTick: involvement.kickTick,
    incidentPosition: clone(involvement.incidentPosition),
    status: routed.decision.status,
  });
  if (routed.restart === null) {
    return {
      ...match,
      rng: { ...match.rng, state: routed.rng },
      rules: {
        ...match.rules,
        state: routed.state,
        liveOffside: null,
      },
    };
  }
  routed = {
    ...routed,
    state: {
      ...routed.state,
      offside: markCssoccerOffsideInvolvement(routed.state.offside, {
        playerId: player.id,
        nativePlayerNumber: player.nativePlayerNumber,
      }),
    },
  };
  return acceptCurrentFoulRestart({
    ...match,
    rng: { ...match.rng, state: routed.rng },
    rules: {
      ...match.rules,
      state: routed.state,
      liveOffside: null,
    },
  }, routed, nextTick, events);
}

function processAnimations(
  match,
  { centrePassReceiverFrame, events, nearest, nextTick, sourceInitialization },
) {
  if (sourceInitialization) return match;
  if (currentLifecycleSuspendsGameplay(match)) return match;
  if (match.goal.phase !== "normal-play") return match;
  if (match.kickoff.phase === "boundary-delay") return match;
  if (match.kickoff.phase === "kick-action") {
    return stepCentrePassAnimation(
      match,
      nextTick,
      events,
      centrePassReceiverFrame,
      nearest,
    );
  }
  const positioning = match.kickoff.phase === "centre-positioning"
    || match.kickoff.phase === "boundary-positioning"
    || match.kickoff.phase === "rule-positioning";
  const motionById = positioning
    ? new Map(match.kickoff.motion.players.map((player) => [player.id, player]))
    : new Map();
  let recoveredCentreTaker = false;
  let centreTakerFrame = null;
  const players = match.players.map((player) => {
    if (player.liveRestart !== undefined) {
      return stepCurrentBoundaryRestartAnimation(player, match, nextTick);
    }
    if (player.liveKeeper !== undefined) return clone(player);
    if (player.liveContact !== undefined) {
      return stepOpenPlayContactAnimation(player, match, nextTick);
    }
    if (
      (
        player.livePass?.phase === "kick-held"
        || player.liveShot?.phase === "kick-held"
      )
      && (player.livePass ?? player.liveShot).startTick === nextTick
    ) {
      return clone(player);
    }
    if (player.livePass !== undefined || player.liveShot !== undefined) {
      return stepOpenPlayKickAnimation(player, match, nextTick);
    }
    if (
      match.kickoff.phase === "open-play"
      && match.kickoff.action?.released === true
      && match.kickoff.action.recovered !== true
      && Number.isFinite(match.kickoff.action.frame)
      && player.id === match.kickoff.action.takerId
    ) {
      const stepped = stepReleasedCentrePassTaker(player, match, nextTick);
      recoveredCentreTaker = stepped.recovered;
      centreTakerFrame = stepped.frame;
      return stepped.player;
    }
    const motion = positioning
      ? motionById.get(player.id)
      : player.liveMotion;
    if (motion === undefined) {
      throw new Error(`Animation processing lost current motion for ${player.id}.`);
    }
    return stepLocomotionAnimation(player, motion, match.possession, nextTick);
  });
  const animated = {
    ...match,
    players,
    kickoff: centreTakerFrame === null
      ? match.kickoff
      : {
        ...match.kickoff,
        action: {
          ...match.kickoff.action,
          frame: centreTakerFrame,
          recovered: recoveredCentreTaker,
        },
      },
  };
  return animated;
}

function stepCurrentBoundaryRestartAnimation(player, match, nextTick) {
  const restart = player.liveRestart;
  if (restart.phase === "throw-ready") {
    return {
      ...clone(player),
      animation: { ...clone(player.animation), frame: F32(0), tick: nextTick },
    };
  }
  if (restart.startTick >= nextTick) return clone(player);
  const frame = F32(player.animation.frame + player.animation.frameStep);
  if (restart.phase === "pickup") {
    return {
      ...clone(player),
      animation: {
        ...clone(player.animation),
        frame: Math.min(1, frame),
        pending: frame >= 1 ? null : player.animation.pending,
        tick: nextTick,
      },
      intelligence: {
        ...clone(player.intelligence),
        count: Math.max(0, player.intelligence.count - 1),
      },
      liveRestart: {
        ...clone(restart),
        phase: frame >= 1 ? "pickup-complete" : "pickup",
      },
    };
  }
  if (restart.phase !== "throw-released") {
    throw new Error(`Unsupported boundary restart animation ${String(restart.phase)}.`);
  }
  if (frame < 1) {
    return {
      ...clone(player),
      animation: { ...clone(player.animation), frame, tick: nextTick },
    };
  }
  const recovered = clone(player);
  delete recovered.liveRestart;
  return {
    ...recovered,
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    intelligence: { special: 0, move: 0, count: 0 },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "stand",
      id: STAND_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      frame: F32(0),
      frameStep: STAND_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      ...clone(player.liveMotion),
      kind: "stand",
      target: clone(match.ball.ball.position),
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: true,
      animationId: null,
      animationFrameStep: null,
    },
  };
}

function stepOpenPlayContactAnimation(player, match, nextTick) {
  const contact = player.liveContact;
  if (contact.startTick >= nextTick) return clone(player);
  if (contact.phase === "fall" && contact.goCount === 1) {
    const frameStep = F32(
      GET_UP_FRONT_FRAME_STEP * F32((player.liveMotion.teamRate + 128) / 128),
    );
    return {
      ...clone(player),
      animation: {
        status: "browser-current-state",
        kind: "get-up",
        id: GET_UP_FRONT_ANIMATION,
        sourceActionId: FALL_ACTION,
        frame: F32(0),
        frameStep,
        pending: null,
        tick: nextTick,
      },
      liveMotion: {
        ...clone(player.liveMotion),
        kind: "get-up",
        goCount: 0,
        goDisplacement: { x: F32(0), y: F32(0) },
        animationId: GET_UP_FRONT_ANIMATION,
        animationFrameStep: frameStep,
      },
      liveContact: {
        ...clone(contact),
        phase: "get-up",
        startTick: nextTick,
        goCount: 0,
        limbo: Math.trunc(1 / frameStep),
      },
    };
  }
  const frame = F32(player.animation.frame + player.animation.frameStep);
  const completed = (
    contact.phase === "fall" && contact.goCount <= 0
  ) || (
    contact.phase === "tackle" && contact.goCount < 0
  ) || (
    contact.phase === "steal" && frame >= 1
  ) || (
    contact.phase === "barge" && contact.bargeCountdown === 0
  ) || (
    contact.phase === "get-up" && (contact.limbo === 0 || frame >= 1)
  ) || (
    contact.phase === "ride-over-tackle" && contact.landed === true
  );
  if (!completed) {
    return {
      ...clone(player),
      animation: {
        ...clone(player.animation),
        frame,
        tick: nextTick,
      },
    };
  }
  return recoverOpenPlayContactPlayer(player, match, nextTick);
}

function recoverOpenPlayContactPlayer(player, match, nextTick) {
  const recovered = clone(player);
  delete recovered.liveContact;
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Contact recovery lost the current rate for ${player.id}.`);
  }
  return {
    ...recovered,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "stand",
      id: STAND_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      frame: F32(0),
      frameStep: STAND_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: "stand",
      teamRate,
      target: clone(match.ball.ball.position),
      goStep: false,
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: null,
      animationFrameStep: null,
    },
  };
}

function stepOpenPlayKickAnimation(player, match, nextTick) {
  const kick = player.livePass ?? player.liveShot;
  const phases = player.livePass === undefined
    ? new Set(["kick-held", "punt-released", "shot-released"])
    : new Set(["air-pass", "ground-pass", "kick-held"]);
  if (
    player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.KICK
    || !phases.has(kick.phase)
  ) {
    throw new Error(`Open-play kick continuation lost the active kick for ${player.id}.`);
  }
  const animationFrame = F32(player.animation.frame + player.animation.frameStep);
  const stolenBeforeContact = kick.phase === "kick-held"
    && match.possession.owner !== player.nativePlayerNumber
    && animationFrame < kick.contact;
  if (stolenBeforeContact || F32(animationFrame + player.animation.frameStep) >= 1) {
    const target = {
      x: F32(match.ball.ball.position.x - player.position.x),
      y: F32(match.ball.ball.position.y - player.position.y),
    };
    const facing = turnSourceFacing({
      facing: player.facing,
      target,
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate: player.liveMotion.teamRate },
      ).maxTurnRadians,
    }).facing;
    const recovered = clone(player);
    delete recovered.livePass;
    delete recovered.liveShot;
    return {
      ...recovered,
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      velocity: { x: F32(0), y: F32(0), z: F32(0) },
      facing,
      intelligence: { special: 0, move: 0, count: 0 },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: facing.x,
        facingY: facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "stand",
        id: STAND_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        frame: F32(0),
        frameStep: STAND_FRAME_STEP,
        pending: null,
        tick: nextTick,
      },
      liveMotion: {
        kind: "stand",
        teamRate: player.liveMotion.teamRate,
        target: clone(match.ball.ball.position),
        goStep: false,
        goCount: 0,
        goDisplacement: { x: F32(0), y: F32(0) },
        directionMode: 1,
        resetAnimationFrame: true,
        sideStepDirection: null,
        animationId: null,
        animationFrameStep: null,
      },
    };
  }
  const position = {
    ...updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement: player.liveMotion.goDisplacement,
    }),
    z: player.position.z,
  };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(kick.goTarget.x - position.x),
      y: F32(kick.goTarget.y - position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate: player.liveMotion.teamRate },
    ).maxTurnRadians,
  }).facing;
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { ...clone(player.liveMotion.goDisplacement), z: F32(0) },
    facing,
    intelligence: {
      ...clone(player.intelligence),
      count: player.intelligence.count === 0 ? 0 : player.intelligence.count - 1,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.KICK,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: {
      ...clone(player.animation),
      frame: animationFrame,
      tick: nextTick,
    },
    ...(player.livePass === undefined
      ? {
          liveShot: {
            ...clone(player.liveShot),
            publishedBallPosition: clone(match.ball.ball.position),
          },
        }
      : {
          livePass: {
            ...clone(player.livePass),
            publishedBallPosition: clone(match.ball.ball.position),
          },
        }),
  };
}

function stepReleasedCentrePassTaker(player, match, nextTick) {
  const opening = match.kickoff.action;
  const frame = F32(opening.frame + opening.frameStep);
  const recovered = frame + opening.frameStep >= 1;
  const previousPosition = clone(player.position);
  const previousFacing = clone(player.facing);
  if (recovered) {
    const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
      .find(({ id }) => id === player.id)?.value;
    const target = {
      x: F32(match.ball.ball.position.x - player.position.x),
      y: F32(match.ball.ball.position.y - player.position.y),
    };
    const facing = turnSourceFacing({
      facing: player.facing,
      target,
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate },
      ).maxTurnRadians,
    }).facing;
    return {
      recovered,
      frame,
      player: {
        ...clone(player),
        previousPosition,
        previousFacing,
        velocity: { x: F32(0), y: F32(0), z: F32(0) },
        facing,
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
          facingX: facing.x,
          facingY: facing.y,
        }),
        liveMotion: {
          kind: "stand",
          teamRate,
          target: clone(match.ball.ball.position),
          goStep: false,
          goCount: 0,
          goDisplacement: { x: F32(0), y: F32(0) },
          directionMode: 1,
          resetAnimationFrame: true,
          sideStepDirection: null,
          animationId: null,
          animationFrameStep: null,
        },
        animation: {
          status: "browser-current-state",
          kind: "stand",
          id: STAND_ANIMATION,
          sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
          frame: F32(0),
          frameStep: STAND_FRAME_STEP,
          pending: null,
          tick: nextTick,
        },
      },
    };
  }
  const position = {
    x: F32(player.position.x + opening.movement.x),
    y: F32(player.position.y + opening.movement.y),
    z: player.position.z,
  };
  return {
    recovered,
    frame,
    player: {
      ...clone(player),
      previousPosition,
      previousFacing,
      position,
      velocity: { ...clone(opening.movement), z: F32(0) },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.KICK,
        facingX: player.facing.x,
        facingY: player.facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "centre-pass",
        id: CENTRE_PASS_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.KICK,
        frame,
        frameStep: opening.frameStep,
        pending: null,
        tick: nextTick,
      },
    },
  };
}

function advanceOpeningClock(match, {
  events,
  nextTick,
  sourceInitialization,
}) {
  const clockStep = stepCssoccerClockState(match.clock, {
    clockAdvances: currentLifecycleClockAdvances(match),
    clockRunning: !sourceInitialization && match.clock.running,
    periodReady: currentLifecyclePeriodReady(match),
  });
  let current = { ...match, clock: clockStep.state };
  events.push(...clockStep.events.map(clone));
  if (clockStep.events.some(({ type }) => type === "halftime-whistle")) {
    current = enterCurrentHalftimeHold(current, nextTick);
  }
  if (clockStep.events.some(({ type }) => type === "ends-swapped")) {
    current = enterCurrentSecondHalfCentre(current, nextTick);
  }
  if (clockStep.events.some(({ type }) => type === "full-time")) {
    current = enterCurrentFullTime(current, nextTick);
  }
  return current;
}

function currentLifecycleClockAdvances(match) {
  if (currentLifecycleSuspendsGameplay(match)) return false;
  if (match.goal.phase !== "normal-play" || match.goal.justScored !== 0) return false;
  if (
    match.rules.boundary != null
    || match.rules.foulRestart != null
    || match.rules.state.foul.playAdvantage !== 0
    || match.ball.outcome != null
  ) return false;
  if (
    (
      match.kickoff.restartKind == null
      || match.kickoff.restartKind === "opening"
      || match.kickoff.restartKind === "halftime"
    )
    && (
      match.kickoff.phase === "centre-positioning"
      || match.kickoff.phase === "kick-action"
    )
  ) return true;
  return match.clock.running
    && match.rules.matchMode === 0
    && match.rules.gameAction === 0;
}

function currentLifecyclePeriodReady(match) {
  if (match.goal.phase !== "normal-play" || match.goal.justScored !== 0) return false;
  if (
    match.rules.matchMode !== 0
    || match.rules.deadBallCount !== 0
    || match.rules.gameAction !== 0
    || match.rules.boundary != null
    || match.rules.foulRestart != null
    || match.rules.state.foul.playAdvantage !== 0
    || match.ball.outcome != null
  ) return false;
  if (match.kickoff.phase !== "open-play") return false;
  return !match.players.some((player) => (
    player.liveShot !== undefined
    || player.liveRestart !== undefined
    || player.liveContact !== undefined
  ));
}

function currentLifecycleSuspendsGameplay(match) {
  return match.clock.terminal
    || match.clock.phase === "halftime-whistle"
    || match.clock.phase === "halftime-transition";
}

function enterCurrentHalftimeHold(match, nextTick) {
  const ball = currentLifecycleCentreBall(match, nextTick);
  const possession = currentLifecycleClearPossession(match.possession);
  const players = match.players.map((player) => currentLifecycleStandingPlayer(player, nextTick));
  return {
    ...match,
    phase: "halftime-whistle",
    ball,
    possession,
    players,
    result: null,
    rules: {
      ...match.rules,
      phase: "halftime-transition",
      matchMode: 19,
      gameAction: 0,
      setPiece: 0,
      deadBallCount: 40,
      boundary: null,
      foulRestart: null,
      foulAdvantage: null,
      liveOffside: null,
    },
    control: {
      ...match.control,
      activePlayerId: null,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    },
    kickoff: {
      ...match.kickoff,
      phase: "halftime-transition",
      restartKind: "halftime",
      ballStatus: "held-at-centre",
      pendingAction: null,
      action: null,
      launch: null,
    },
  };
}

function enterCurrentSecondHalfCentre(match, nextTick) {
  const teams = match.teams.map((team) => ({
    ...clone(team),
    nativeTeamSlot: team.nativeTeamSlot === "A" ? "B" : "A",
    nativeUserToken: team.nativeUserToken === -1 ? -2 : -1,
  }));
  const remappedPlayers = match.players.map((player) => ({
    ...currentLifecycleStandingPlayer(player, nextTick),
    nativeRuntimeIndex: player.nativeRuntimeIndex < 11
      ? player.nativeRuntimeIndex + 11
      : player.nativeRuntimeIndex - 11,
    nativePlayerNumber: player.nativePlayerNumber < 12
      ? player.nativePlayerNumber + 11
      : player.nativePlayerNumber - 11,
    nativeTeamSlot: player.nativeTeamSlot === "A" ? "B" : "A",
  }));
  const mappings = remappedPlayers.map((player) => ({
    id: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    active: player.active ? 1 : 0,
  }));
  const possession = createPossessionState({
    ...clone(currentLifecycleClearPossession(match.possession)),
    players: match.possession.players.map((player) => ({
      ...clone(player),
      nativePlayer: player.nativePlayer < 12
        ? player.nativePlayer + 11
        : player.nativePlayer - 11,
    })),
  });
  const swapped = {
    ...match,
    teams,
    players: remappedPlayers,
    possession,
    tactics: {
      ...clone(match.tactics),
      slots: {
        A: clone(match.tactics.slots.B),
        B: clone(match.tactics.slots.A),
      },
    },
    rules: {
      ...match.rules,
      state: remapCssoccerRulePlayers(match.rules.state, mappings),
    },
    control: {
      ...match.control,
      nativeTeamSlot: match.control.nativeTeamSlot === "A" ? "B" : "A",
      nativeUserToken: match.control.nativeUserToken === -1 ? -2 : -1,
      activePlayerId: null,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    },
  };
  const setup = createCurrentCentreSetup(swapped, "A");
  const ball = currentLifecycleCentreBall(swapped, nextTick);
  const players = resetPlayersForCurrentCentre(remappedPlayers, setup.players, nextTick);
  const motionPlayers = [...players].sort(
    (left, right) => left.nativePlayerNumber - right.nativePlayerNumber,
  );
  const motionTargets = [...setup.players].sort(
    (left, right) => left.nativePlayerNumber - right.nativePlayerNumber,
  );
  const motion = createCssoccerCurrentKickoffPlayerMotion({
    ballPosition: {
      x: CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x,
      y: CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y,
    },
    goToPositionDistance:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8,
    matchHalf: 1,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    pitchLength: F32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength),
    players: motionPlayers.map((player) => ({
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      teamRate: player.gameplay.pace,
      action: player.action.action.value,
      directionMode: 0,
      faceDirection: sourceFacingDirection(player.facing),
      position: { x: player.position.x, y: player.position.y },
      facing: clone(player.facing),
    })),
    selectedCountry: swapped.control.country,
    targetPlayers: motionTargets,
    teamBySlot: setup.teamBySlot,
  });
  return {
    ...swapped,
    phase: "halftime-end-swap-second-half-kickoff",
    ball,
    players,
    result: null,
    rules: {
      ...swapped.rules,
      phase: "centre-restart",
      matchMode: CSSOCCER_KICKOFF_CONSTANTS.centreMatchMode,
      gameAction: CSSOCCER_KICKOFF_CONSTANTS.centreGameAction,
      setPiece: CSSOCCER_KICKOFF_CONSTANTS.centreSetPiece,
      deadBallCount: CSSOCCER_KICKOFF_CONSTANTS.centreDeadBallTicks,
      liveOffside: null,
    },
    kickoff: {
      phase: "centre-positioning",
      phaseTick: motion.tick,
      restartKind: "halftime",
      owner: clone(setup.owner),
      ballStatus: "held-at-centre",
      pendingAction: null,
      action: null,
      launch: null,
      motion,
      readiness: deriveKickoffReadiness({ players, ball, officials: swapped.officials }),
    },
  };
}

function enterCurrentFullTime(match, nextTick) {
  const players = match.players.map((player) => currentLifecycleStandingPlayer(player, nextTick));
  return {
    ...match,
    phase: "full-time-terminal",
    players,
    result: {
      status: "final",
      matchHalf: 11,
      normalTimeOnly: true,
      extraTime: false,
      penalties: false,
      ...getCssoccerNormalTimeResult(match.score),
    },
    rules: {
      ...match.rules,
      phase: "full-time-terminal",
      matchMode: 19,
      gameAction: 0,
      setPiece: 0,
      deadBallCount: 0,
      boundary: null,
      foulRestart: null,
      foulAdvantage: null,
      liveOffside: null,
    },
    control: {
      ...match.control,
      activePlayerId: null,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    },
    kickoff: {
      ...match.kickoff,
      phase: "full-time-terminal",
      ballStatus: "held-at-restart",
      pendingAction: null,
      action: null,
      launch: null,
    },
  };
}

function currentLifecycleCentreBall(match, nextTick) {
  const centre = {
    x: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x),
    y: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y),
    z: F32(CSSOCCER_KICKOFF_CONSTANTS.ballDiameter / 2),
  };
  return createBallMatchState({
    ball: {
      ...clone(match.ball.ball),
      tick: nextTick,
      position: centre,
      previousPosition: centre,
      displacement: { x: F32(0), y: F32(0), z: F32(0) },
      outPosition: null,
      inAir: 0,
      inGoal: 0,
      outOfPlay: 0,
      still: 1,
      speed: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
      afterTouch: {
        user: 0,
        shotDirection: { x: F32(0), y: F32(0) },
      },
    },
    limbo: { active: 0, player: 0, contact: F32(0) },
    outcome: null,
  });
}

function currentLifecycleClearPossession(possession) {
  return createPossessionState({
    ...clone(possession),
    owner: 0,
    lastTouch: 0,
    previousTouch: 0,
    preKeeperTouch: 0,
    inHands: 0,
    cannotPickUp: 0,
    players: possession.players.map((player) => ({ ...clone(player), possession: 0 })),
  });
}

function currentLifecycleStandingPlayer(source, nextTick) {
  const player = clearLivePlayerActions(source);
  return {
    ...player,
    previousPosition: clone(player.position),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    intelligence: { special: 0, move: 0, count: 0 },
    ballState: 0,
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "stand",
      id: STAND_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      frame: F32(0),
      frameStep: STAND_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
  };
}

function currentTeamRates(players, gameMinute) {
  return players.map((player) => {
    const initialRate = player.gameplay.pace;
    const fatigueCurve = F32((
      Math.sin(((Math.PI * gameMinute) / 120) - (Math.PI / 2)) + 1
    ) / 2);
    const fatigue = F32(
      fatigueCurve * ((129 - player.gameplay.stamina) / 140) * initialRate,
    );
    const value = Math.trunc(initialRate - fatigue);
    return {
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      valueType: "u8",
      value,
      numericBits: value.toString(16).padStart(2, "0"),
    };
  });
}

function beginCentrePass(match, nextTick, events) {
  const taker = match.players.find(({ id }) => id === match.kickoff.owner.takerId);
  const receiver = match.players.find(({ id }) => id === match.kickoff.owner.receiverId);
  if (
    taker === undefined
    || receiver === undefined
    || taker.role !== "taker"
    || receiver.role !== "receiver"
    || taker.nativeTeamSlot !== match.kickoff.owner.nativeTeamSlot
    || receiver.nativeTeamSlot !== match.kickoff.owner.nativeTeamSlot
    || taker.action.action.value !== CSSOCCER_NATIVE_ACTIONS.STAND
  ) {
    throw new Error("Current-state centre pass lost its legal taker or receiver.");
  }
  const possession = collectPossession(match.possession, taker.nativePlayerNumber);
  const action = createCssoccerActionState({
    tick: nextTick,
    playerId: taker.id,
    actionId: CSSOCCER_NATIVE_ACTIONS.KICK,
    facingX: taker.facing.x,
    facingY: taker.facing.y,
  });
  const motionCaptureSpeed = F32((taker.gameplay.flair + taker.gameplay.pace) / 128);
  const frameStep = F32(CENTRE_PASS_BASE_FRAME_STEP * motionCaptureSpeed);
  const contactOffset = rotateOpeningOffset(CENTRE_PASS_CONTACT_OFFSET, taker.facing);
  const kickAction = {
    takerId: taker.id,
    receiverId: receiver.id,
    startTick: nextTick,
    frame: F32(0),
    frameStep,
    contact: CENTRE_PASS_CONTACT,
    contactOffset,
    movement: {
      x: F32(CENTRE_PASS_MOVEMENT_DISTANCE * frameStep * taker.facing.x),
      y: F32(CENTRE_PASS_MOVEMENT_DISTANCE * frameStep * taker.facing.y),
    },
    released: false,
  };
  events.push({
    type: "centre-pass-started",
    tick: nextTick,
    takerId: taker.id,
    receiverId: receiver.id,
    restartKind: match.kickoff.restartKind ?? "opening",
  });
  return {
    ...match,
    phase: "opening-kick-action",
    possession,
    players: match.players.map((player) => (
      player.id === taker.id
        ? { ...clone(player), action }
        : clone(player)
    )),
    rules: {
      ...match.rules,
      phase: "open-play",
      matchMode: 0,
      gameAction: 0,
      setPiece: 0,
      deadBallCount: 0,
    },
    clock: {
      ...match.clock,
      running: true,
    },
    control: {
      ...match.control,
      activePlayerId: selectCentreControlPlayer(match, receiver),
    },
    kickoff: {
      ...match.kickoff,
      phase: "kick-action",
      ballStatus: "held-by-taker",
      pendingAction: {
        type: "pass",
        nativePlayerNumber: taker.nativePlayerNumber,
        targetPlayerNumber: receiver.nativePlayerNumber,
        passType: 5,
      },
      action: kickAction,
      launch: {
        tick: nextTick,
        takerId: taker.id,
        receiverId: receiver.id,
        source: "current readiness, action, position, facing, and centre ball",
      },
    },
  };
}

function stepCentrePassAnimation(
  match,
  nextTick,
  events,
  centrePassReceiverFrame,
  nearest,
) {
  const opening = match.kickoff.action;
  if (opening === null || opening.released) {
    throw new Error("Kick-action phase requires one unreleased current-state centre pass.");
  }
  const takerIndex = match.players.findIndex(({ id }) => id === opening.takerId);
  const receiver = match.players.find(({ id }) => id === opening.receiverId);
  if (takerIndex < 0 || receiver === undefined) {
    throw new Error("Centre-pass action lost its current players.");
  }
  const players = match.players.map((player, index) => {
    if (index === takerIndex) return clone(player);
    if (player.liveMotion === undefined) {
      throw new Error(`Centre-pass animation lost current motion for ${player.id}.`);
    }
    return stepLocomotionAnimation(player, player.liveMotion, match.possession, nextTick);
  });
  const taker = players[takerIndex];
  const takerRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === taker.id);
  if (takerRate === undefined) {
    throw new Error("Centre-pass animation lost the taker's current rate.");
  }
  const contact = projectCentrePassContact(match);
  const frame = contact.frame;
  let ball = createBallMatchState({
    ...match.ball,
    ball: {
      ...match.ball.ball,
      tick: nextTick,
      previousPosition: clone(match.ball.ball.position),
      position: contact.ballPosition,
    },
  });
  taker.previousPosition = clone(taker.position);
  taker.previousFacing = clone(taker.facing);
  taker.position = {
    x: F32(taker.position.x + opening.movement.x),
    y: F32(taker.position.y + opening.movement.y),
    z: taker.position.z,
  };
  taker.velocity = { ...clone(opening.movement), z: F32(0) };
  taker.liveMotion = {
    kind: "centre-pass",
    teamRate: takerRate.value,
    target: clone(match.ball.ball.position),
    goStep: false,
    goCount: 0,
    goDisplacement: clone(opening.movement),
    directionMode: 0,
    resetAnimationFrame: false,
    sideStepDirection: null,
    animationId: CENTRE_PASS_ANIMATION,
    animationFrameStep: opening.frameStep,
  };
  taker.animation = {
    status: "browser-current-state",
    kind: "centre-pass",
    id: CENTRE_PASS_ANIMATION,
    sourceActionId: CSSOCCER_NATIVE_ACTIONS.KICK,
    frame,
    frameStep: opening.frameStep,
    pending: frame < opening.contact ? "contact" : null,
    tick: nextTick,
  };

  let possession = match.possession;
  let rng = match.rng;
  let control = match.control;
  let phase = match.phase;
  let kickoff = {
    ...match.kickoff,
    action: { ...opening, frame },
  };
  if (frame >= opening.contact) {
    if (
      centrePassReceiverFrame?.id !== receiver.id
      || centrePassReceiverFrame.liveMotion?.goDisplacement === undefined
    ) {
      throw new Error("Centre-pass release lost the receiver's current source journey.");
    }
    const released = releaseCssoccerGroundPass({
      ball,
      possession,
      profile: CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
      receiver: {
        stableId: centrePassReceiverFrame.id,
        nativePlayerNumber: centrePassReceiverFrame.nativePlayerNumber,
        action: centrePassReceiverFrame.action.action.value,
        position: clone(centrePassReceiverFrame.position),
        goDisplacement: clone(centrePassReceiverFrame.liveMotion.goDisplacement),
      },
      rng: match.rng.state,
      takerAccuracy: taker.gameplay.accuracy,
      tick: nextTick,
      wantedReceiver: false,
    });
    ball = released.ball;
    possession = released.possession;
    rng = { ...match.rng, state: released.rng };
    control = reselectReleasedControl(match, nearest);
    phase = "open-play";
    kickoff = {
      ...kickoff,
      phase: "open-play",
      ballStatus: "live",
      pendingAction: null,
      action: { ...kickoff.action, released: true, releaseTick: nextTick },
    };
    events.push({
      type: "centre-pass-released",
      tick: nextTick,
      takerId: taker.id,
      receiverId: receiver.id,
      position: clone(ball.ball.position),
      displacement: clone(ball.ball.displacement),
    });
  }
  return {
    ...match,
    phase,
    players,
    ball,
    possession,
    rng,
    control,
    kickoff,
  };
}

function reselectReleasedControl(match, nearest) {
  const active = match.players.find(({ id }) => id === match.control.activePlayerId);
  const selectionCircle = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 10;
  const activeDistance = active === undefined
    ? Number.POSITIVE_INFINITY
    : Math.hypot(
        active.position.x - match.ball.ball.position.x,
        active.position.y - match.ball.ball.position.y,
      );
  return {
    ...match.control,
    activePlayerId: activeDistance < selectionCircle ? active.id : nearest.id,
  };
}

function selectCentreControlPlayer(match, receiver) {
  if (match.kickoff.owner.country === match.control.country) return receiver.id;
  return selectNearestControlledPlayer(match).id;
}

function projectCentrePassContact(match) {
  const opening = match.kickoff.action;
  if (opening === null || opening.released) {
    throw new Error("Centre-pass contact projection requires one active source action.");
  }
  const taker = match.players.find(({ id }) => id === opening.takerId);
  if (taker === undefined) throw new Error("Centre-pass contact projection lost its taker.");
  const frame = F32(opening.frame + opening.frameStep);
  const contactTarget = {
    x: taker.position.x + opening.contactOffset.x,
    y: taker.position.y + opening.contactOffset.y,
    z: taker.position.z + opening.contactOffset.z,
  };
  const ratio = frame / opening.contact;
  return {
    frame,
    ballPosition: {
      x: F32(match.ball.ball.position.x
        + ((contactTarget.x - match.ball.ball.position.x) * ratio)),
      y: F32(match.ball.ball.position.y
        + ((contactTarget.y - match.ball.ball.position.y) * ratio)),
      z: F32(match.ball.ball.position.z
        + ((contactTarget.z - match.ball.ball.position.z) * ratio)),
    },
  };
}

function stepLocomotionAnimation(player, motion, possession, nextTick) {
  const action = player.action.action.value;
  const running = action === CSSOCCER_NATIVE_ACTIONS.RUN;
  const sideStep = running && (
    motion?.kind === "side-step"
    || motion?.lastPlan?.choice === "side-step"
  );
  let kind = "stand";
  let id = STAND_ANIMATION;
  let frameStep = STAND_FRAME_STEP;
  if (motion?.kind === "socks") {
    kind = "socks";
    id = motion.animationId;
    frameStep = motion.animationFrameStep;
  } else if (running) {
    kind = sideStep ? "side-step" : "run";
    id = sideStep
      ? TROT_ANIMATION_BY_DIRECTION[
        motion?.sideStepDirection ?? sourceSideStepDirection(player)
      ]
      : RUN_ANIMATION;
    if (!Number.isSafeInteger(motion?.teamRate)) {
      throw new Error(`Locomotion animation lost the current rate for ${player.id}.`);
    }
    const speed = currentPlayerSpeed(player, motion.teamRate, sideStep, possession);
    frameStep = sideStep
      ? F32(speed * SIDE_STEP_FRAME_STEP / 2)
      : F32(RUN_FRAME_STEP * (speed / RUN_REFERENCE_SPEED));
  }
  const changed = player.animation.id !== id;
  const preservesTrotPhase = kind === "side-step"
    && player.animation.kind === "side-step";
  const resetsFromSourceMotion = motion?.resetAnimationFrame === true || (
    (kind === "stand" || kind === "socks")
    && motion?.lastPlan?.choice === "arrived"
  );
  const frame = resetsFromSourceMotion || (changed && !preservesTrotPhase)
    ? F32(0)
    : F32(player.animation.frame + player.animation.frameStep);
  return {
    ...clone(player),
    animation: {
      status: "browser-current-state",
      kind,
      id,
      sourceActionId: action,
      frame,
      frameStep,
      pending: null,
      tick: nextTick,
    },
  };
}

function currentPlayerSpeed(player, teamRate, sideStep, possession) {
  return actualPlayerSpeed({
    pitchLength: 1280,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: possession.owner,
    ballInHands: possession.inHands !== 0,
    keeperNativePlayers: [1, 12],
    userControlIndex: 0,
    burstTimer: 0,
  });
}

function sourceSideStepDirection(player) {
  const target = {
    x: F32(player.target.x - player.previousPosition.x),
    y: F32(player.target.y - player.previousPosition.y),
  };
  const distance = Math.hypot(target.x, target.y);
  const normalized = {
    x: F32(target.x / distance),
    y: F32(target.y / distance),
  };
  const relative = {
    x: F32(
      (normalized.x * player.previousFacing.x)
      + (normalized.y * player.previousFacing.y)
    ),
    y: F32(
      (normalized.y * player.previousFacing.x)
      - (normalized.x * player.previousFacing.y)
    ),
  };
  return 1 + sourceFacingDirection(relative);
}

function rotateOpeningOffset(local, facing) {
  const facingDistance = Math.hypot(facing.x, facing.y);
  const nx = F32(facing.x / facingDistance);
  const ny = F32(facing.y / facingDistance);
  const distance = Math.hypot(local.x, local.y);
  if (!(distance > 1)) return { x: F32(0), y: F32(0), z: F32(0) };
  const x = F32(local.x / distance);
  const y = F32(local.y / distance);
  return {
    x: F32(F32((x * nx) - (y * ny)) * distance),
    y: F32(F32((y * nx) + (x * ny)) * distance),
    z: local.z,
  };
}

function deriveKickoffReadiness(match) {
  const taker = match.players.find(({ role }) => role === "taker");
  const ball = match.ball.ball.position;
  const allStanding = match.players.every((player) => (
    player.active
    && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
    && Math.hypot(
      player.target.x - player.position.x,
      player.target.y - player.position.y,
    ) <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.motion.imThereDistance.value
  ));
  const toBall = { x: ball.x - taker.position.x, y: ball.y - taker.position.y };
  const distance = Math.hypot(toBall.x, toBall.y);
  const cosine = distance === 0
    ? 1
    : ((toBall.x * taker.facing.x) + (toBall.y * taker.facing.y)) / distance;
  const takerReady = taker.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
    && distance < CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.besideBall.value * 3
    && cosine > CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.facingAngle.value;
  const refereeReady = match.officials.officials[0].action
    === CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value;
  return {
    allStanding,
    takerReady,
    refereeReady,
    readyForLaunch: allStanding && takerReady && refereeReady,
    setPieceWaitTicks:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.setPieceWaitTicks.value,
  };
}

function createSnapshot({ match, lastStep }) {
  const snapshot = deepFreeze({
    schema: SNAPSHOT_SCHEMA,
    tick: match.tick,
    phase: match.phase,
    paused: match.session.paused,
    match,
    lastStep,
  });
  assertRuntimeSnapshot(snapshot);
  return snapshot;
}

function assertRuntimeSnapshot(snapshot) {
  if (
    snapshot.schema !== SNAPSHOT_SCHEMA
    || snapshot.tick !== snapshot.match.tick
    || snapshot.phase !== snapshot.match.phase
    || snapshot.paused !== snapshot.match.session.paused
  ) {
    throw new Error("Free-play snapshot diverged from its engine-owned match state.");
  }
  if (!Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0) {
    throw new Error("Free-play snapshot tick must be a non-negative integer.");
  }
  if (snapshot.match.ball.ball.tick !== snapshot.tick) {
    throw new Error("Free-play ball tick diverged from the engine tick.");
  }
  if (
    snapshot.match.playerHighlight.tick !== snapshot.tick
    || assertCssoccerPlayerHighlightState(snapshot.match.playerHighlight)
      !== snapshot.match.playerHighlight
  ) {
    throw new Error("Free-play player highlight diverged from the engine tick.");
  }
  if (snapshot.lastStep !== null) {
    if (
      snapshot.lastStep.command.tick !== snapshot.tick - 1
      || !sameValue(snapshot.lastStep.sourceOrder, CSSOCCER_FREE_PLAY_SOURCE_LOOP)
      || !Array.isArray(snapshot.lastStep.events)
    ) {
      throw new Error("Free-play step receipt changed source order or tick ownership.");
    }
  }
  return snapshot;
}

function runStage(name, trace, operation) {
  trace.push(name);
  return operation();
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
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

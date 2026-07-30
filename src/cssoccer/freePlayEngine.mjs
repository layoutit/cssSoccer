import {
  CSSOCCER_ACTUA_GAMEPLAY_CAMERA,
} from "./actuaGameplayCamera.mjs";
import {
  CSSOCCER_NATIVE_ACTIONS,
  createCssoccerActionState,
} from "./actionState.mjs";
import {
  createBallLimbo,
  createBallMatchState,
  qualifyCssoccerPossessedBallBoundary,
  stepBallBoundaryRespotTick,
  stepBallMatchState,
} from "./ballMatchState.mjs";
import {
  CSSOCCER_BALL_CONSTANTS,
  stepBallTrajectoryPredictionState,
} from "./ballState.mjs";
import {
  classifyCssoccerBoundary,
  CSSOCCER_MATCH_MODE,
} from "./boundaryState.mjs";
import {
  completeCssoccerExpiredPeriod,
  CSSOCCER_LIVE_TICKS_PER_HALF,
  stepCssoccerClockState,
} from "./clockState.mjs";
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
  stepCssoccerPossessedBoundaryCountdownState,
  stepCssoccerPossessedGoalCountdownState,
} from "./heldBallState.mjs";
import {
  cssoccerKeeperBoxStatus,
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
  resumeCssoccerCurrentGoalAfterPeriodTransition,
  resumeCssoccerCurrentGoalState,
  stepCssoccerGoalCountdown,
} from "./goalState.mjs";
import {
  projectCssoccerFreePlayZonalPlayerVisit,
  resolveCssoccerFreePlaySupportIntent,
  stepCssoccerFreePlayHalftimeTunnelJourney,
  stepCssoccerFreePlayOpeningTeamContinuation,
  stepCssoccerFreePlayOpeningTeamTransition,
  stepCssoccerFreePlayTeamJourneyContinuation,
} from "./freePlayPlayerReducer.mjs";
import {
  projectCssoccerControlCompletionBall,
  projectCssoccerControlMotionContact,
  projectCssoccerControlWaitTransition,
  projectCssoccerFirstTimeChipArrival,
  projectCssoccerFirstTimeChipIntercept,
  projectCssoccerFirstTimeShotArrival,
  projectCssoccerFirstTimeShotIntercept,
  projectCssoccerFirstTimeStandingHeaderArrival,
  projectCssoccerFirstTimeStandingHeaderIntercept,
  scanCssoccerFreeBallControlIntercept,
} from "./interceptState.mjs";
import {
  CSSOCCER_KICKOFF_CONSTANTS,
} from "./kickoffState.mjs";
import {
  assertCssoccerKickoffPlayerMotion,
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
  sourceGetThereTime,
  sourceWatcomFistpI32,
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
  CSSOCCER_OFFICIAL_PARENT_TRANSITION,
  applyCssoccerOfficialParentTransition,
  stepCssoccerOfficialState,
} from "./officialState.mjs";
import {
  clearCssoccerOffsideRestart,
  createCssoccerLiveOffsideSnapshot,
  markCssoccerOffsideInvolvement,
  resolveCssoccerLiveOffsideSnapshot,
  stepCssoccerOffsidePlayer,
  syncCssoccerOffsidePlayerFlag,
} from "./offsideState.mjs";
import {
  collectPossession,
  createPossessionState,
  holdPossession,
  releasePossession,
  touchWithoutPossession,
} from "./possessionState.mjs";
import {
  applyCssoccerFallInjury,
  projectCssoccerInjuredRate,
} from "./playerInjuryState.mjs";
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
  projectCssoccerRetainedMotionBall,
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
  CSSOCCER_RUN_ON_INTELLIGENCE_MOVE as RUN_ON_INTELLIGENCE_MOVE,
  projectCssoccerWantPassMotion,
  readCssoccerActiveWantPassStat,
} from "./wantPassState.mjs";
import {
  releaseCssoccerChargedGroundPass,
  releaseCssoccerChipPass,
  releaseCssoccerCrossPass,
  releaseCssoccerDirectedGroundPass,
  releaseCssoccerGroundPass,
  releaseCssoccerHeaderPass,
  stepCssoccerKickHeldBall,
} from "./livePassState.mjs";
import {
  isCssoccerShootingRange,
  releaseCssoccerNewSetPieceShot,
  releaseCssoccerPunt,
  releaseCssoccerShot,
  resolveCssoccerPuntDecision,
  resolveCssoccerShotDecision,
} from "./liveShotState.mjs";

const F32 = Math.fround;
const CSSOCCER_DEBUG_ENV = typeof globalThis.process?.env === "object"
  ? globalThis.process.env
  : Object.freeze({});
const SOURCE_OFFSIDE_VISIT_SEED = Symbol("source-offside-visit-seed");
const SNAPSHOT_SCHEMA = "cssoccer-free-play-snapshot@1";
const NATIVE_CAPTURE_LOGIC_COUNT_ROOT = 180;
const NATIVE_AUTO_SELECT_COUNT = 10;
const NATIVE_SELECTION_CIRCLE = F32(
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 10,
);
const NATIVE_FACING_ANGLE =
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.facingAngle
    .compiledOperand.value;
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
const CONTROL_RECEIVE_ACTION = 17;
const CONTROL_WAIT_ACTION = 18;
const FIRST_TIME_STRIKE_ACTION = 7;
const FIRST_TIME_STRIKE_DECEL = 0.75;
const CONTROL_RECEIVE_INTELLIGENCE = 13;
const CLOSE_DOWN_INTELLIGENCE_MOVE = 3;
const DRIBBLE_INTELLIGENCE_MOVE = 2;
const GET_UP_INTELLIGENCE_MOVE = 10;
const GOAL_CELEBRATION_ANIMATION = 92;
const GOAL_CELEBRATION_FRAME_STEP = F32(1 / 59);
const GOAL_KNEE_ANIMATION = 110;
const GOAL_KNEE_FRAME_STEP = F32(2 / 41);
const GOAL_DUCK_ANIMATION = 111;
const GOAL_DUCK_FRAME_STEP = F32(2 / 62);
const GOAL_MOON_ANIMATION = 114;
const GOAL_DUCK_SPEED = F32(0.332258064516129);
const GOAL_TAUNTS = Object.freeze([
  Object.freeze({ animation: 116, frameStep: F32(2 / 49) }),
  Object.freeze({ animation: 113, frameStep: F32(2 / 40) }),
  Object.freeze({ animation: 115, frameStep: F32(2 / 30) }),
  Object.freeze({ animation: 112, frameStep: F32(2 / 45) }),
]);
const GET_UP_FRONT_ANIMATION = 95;
const GET_UP_FRONT_FRAME_STEP = F32(1 / (20 * 87 / 40));
const SOCKS_RIGHT_ANIMATION = 62;
const SOCKS_LEFT_ANIMATION = 63;
const SOCKS_FRAME_STEP = F32(1 / (20 * 68 / 40));
const SOCKS_PROBABILITY = 15;
const STAND_ANIMATION = 78;
const RUN_ANIMATION = 72;
const KEEPER_RUN_WITH_BALL_ANIMATION = 102;
const KEEPER_RUN_WITH_BALL_FRAME_STEP = F32(1 / 15);
const KEEPER_KICKOUT_ANIMATION = 98;
const KEEPER_KICKOUT_LIMBO = 34;
const KEEPER_KICKOUT_FRAME_STEP = F32(1 / 34);
const KEEPER_KICKOUT_CONTACT = F32(103 / 204);
// TEST.ORIGINAL.EXE save_offs[MC_KICKOUT] at file 0x13b324. rotate_offs
// negates the stored y before applying the keeper's current facing.
const KEEPER_KICKOUT_LOCAL_CONTACT_OFFSET = Object.freeze({
  x: F32(19.420169830322266),
  y: F32(12.483989715576172),
  z: F32(4.047043800354004),
});
const JOG_ANIMATION = 73;
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
const CENTRE_PASS_PREDICTION_BALL = Object.freeze({
  position: Object.freeze({
    x: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x),
    y: F32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y),
    z: F32(CSSOCCER_KICKOFF_CONSTANTS.ballDiameter / 2),
  }),
  displacement: Object.freeze({ x: F32(0), y: F32(0), z: F32(0) }),
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
const SET_PIECE_RUNUP_INTELLIGENCE_MOVE = 15;

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
  // predict_ball's current table starts from the loop-entry ball frame. A
  // kick installed later in process_teams freezes that table while contact is
  // positive, even though process_ball has already published a newer ball.
  const sourcePredictionState = clone(match.ball);
  const sourcePredictionBall = clone(sourcePredictionState.ball);
  const sourceBallOwner = match.possession.owner === 0
    ? undefined
    : match.players.find(({ nativePlayerNumber }) => (
        nativePlayerNumber === match.possession.owner
      ));
  const sourceProcessBallRetainsKickPosition = (
    sourceBallOwner?.livePass?.phase === "kick-held"
    || sourceBallOwner?.liveShot?.phase === "kick-held"
  );
  const trace = [];
  const events = [];
  let nearest = null;
  let nearPath = null;
  let opponentNearPath = null;
  let playerDistanceFrame = null;
  let playerDistanceRankFrame = null;
  let officialDefensiveLinesFrame = null;
  let playerVisitFrame = null;
  let playerTeamSourceFrame = null;
  let centrePassContactFrame = null;
  let centrePassPlayerFrame = null;
  let centrePassReceiverFrame = null;
  let deferredExpiredPeriodTransition = false;
  const sourceInitialization = match.kickoff.phase === "source-initialization";

  match = runStage("process_ball", trace, () => processBall(match, nextTick, {
    command,
    events,
    sourceInitialization,
  }));
  // RULES.CPP match_rules calls match_clock before ball_situation can release
  // a ready restart. Preserve the clock guard at that source entry point.
  // A completed goal countdown is different: BALL.CPP respot_ball installs
  // the centre match_mode during process_ball, before match_rules enters
  // match_clock. The JS rules owner materializes that mode below, so carry
  // the process_ball event into this entry guard.
  const postGoalRespotAtMatchRulesEntry = events.some(
    ({ type }) => type === "ball-post-goal-respot-required",
  );
  const clockAdvancesAtMatchRulesEntry = !postGoalRespotAtMatchRulesEntry
    && currentLifecycleClockAdvances(match);
  match = runStage("match_rules", trace, () => processRules(
    match,
    nextTick,
    events,
    command,
    sourcePredictionBall,
  ));
  // RULES.CPP match_clock runs in match_rules, but FOOTBALL.CPP
  // watch_match_time runs after the final live logic/update visit. When an
  // expired period becomes ready on the last SCORE_WAIT tick, retain that
  // source ordering instead of suspending process_teams prematurely.
  const periodReadyBeforeWatch = currentLifecyclePeriodReady(match);
  const periodExpiresThisTick = clockAdvancesAtMatchRulesEntry
    && match.clock.halfLiveTicks + 1 >= CSSOCCER_LIVE_TICKS_PER_HALF;
  deferredExpiredPeriodTransition = periodReadyBeforeWatch
    && (match.clock.periodExpired || periodExpiresThisTick);
  if (deferredExpiredPeriodTransition) {
    // RULES.CPP match_clock still advances the time and refreshes the
    // minute-derived player rates before process_teams. Only FOOTBALL.CPP's
    // later watch_match_time transition is deferred until after the live
    // player visits.
    const clockStep = stepCssoccerClockState(match.clock, {
      clockAdvances: clockAdvancesAtMatchRulesEntry,
      clockRunning: !sourceInitialization && match.clock.running,
      periodReady: false,
    });
    match = { ...match, clock: clockStep.state };
    events.push(...clockStep.events.map(clone));
  } else {
    match = advanceOpeningClock(match, {
      clockAdvances: clockAdvancesAtMatchRulesEntry,
      events,
      nextTick,
      sourceInitialization,
    });
  }
  // keeper_boxes itself only publishes the two in-box flags. The keeper
  // action reducer below represents each keeper's later process_teams visit,
  // so player_distances/get_nearest must retain this pre-visit player frame.
  const sourceGetNearestFrame = sourceProcessBallRetainsKickPosition
    ? {
        ...clone(match),
        ball: createBallMatchState({
          ...clone(match.ball),
          ball: {
            ...clone(match.ball.ball),
            // BALL.CPP skips its physical branch while the possession
            // owner's positive KICK_ACT contact is live. player_distances
            // and get_nearest therefore read the loop-entry ball; the
            // holder's later ball_interact visit publishes the tween.
            position: clone(sourcePredictionBall.position),
          },
        }),
      }
    : clone(match);
  const sourcePlayerDistanceFrame = captureOpenPlayPlayerDistances(
    sourceGetNearestFrame.players,
    sourceGetNearestFrame.ball.ball.position,
  );
  match = runStage("keeper_boxes", trace, () => processKeeperBoxes(
    match,
    nextTick,
    events,
    sourcePredictionState,
    sourcePlayerDistanceFrame,
  ));
  match = runStage("player_distances", trace, () => {
    playerDistanceFrame = sourcePlayerDistanceFrame;
    playerDistanceRankFrame = captureOpenPlayPlayerDistanceRanks(
      sourceGetNearestFrame.players,
      playerDistanceFrame,
    );
    officialDefensiveLinesFrame = captureOpenPlayDefensiveLines(
      sourceGetNearestFrame.players,
    );
    processPlayerDistances(sourceGetNearestFrame);
    return match;
  });
  const frozenKeeperPredictionBall = match.ball.limbo.active === 0
    ? null
    : match.players.find((player) => (
        player.liveKeeper?.phase === "punt-limbo"
        && player.liveKeeper.sourcePredictionBall !== undefined
      ))?.liveKeeper.sourcePredictionBall ?? null;
  const sourceNearPathPredictionState = frozenKeeperPredictionBall === null
    ? (
        sourceGetNearestFrame.possession.owner === 0
        && sourceGetNearestFrame.ball.limbo.active === 0
      )
      ? sourceGetNearestFrame.ball
      : sourcePredictionState
    : createBallMatchState({
        ...clone(sourcePredictionState),
        ball: clone(frozenKeeperPredictionBall),
      });
  nearest = runStage("get_nearest", trace, () => {
    const keeperPuntOwnsFrozenPrediction = match.ball.limbo.active !== 0
      && match.players.some((player) => (
        player.liveKeeper?.phase === "punt-limbo"
        && player.liveKeeper.sourcePrediction !== undefined
      ));
    // FOOTBALL.CPP calls get_nearest before process_teams. KPHOLD's
    // must_punt branch releases later in the keeper's go_team visit, so the
    // frozen pre-punt prediction still chooses the near-path players even
    // though our current-state keeper reducer has already published limbo.
    const sourceNearPathVisible = match.ball.limbo.active === 0
      || keeperPuntOwnsFrozenPrediction;
    nearPath = match.kickoff.phase === "open-play" && sourceNearPathVisible
      ? selectFreeBallNearPathPlayer(
          sourceGetNearestFrame,
          sourceGetNearestFrame.control.nativeTeamSlot,
          command,
          // BALL.CPP does not refresh ball_pred_tab while limbo remains
          // bound. On the contact-crossing tick it releases limbo, advances
          // the physical ball, then rebuilds the table from that post-process
          // state before FOOTBALL.CPP reaches get_nearest.
          sourceNearPathPredictionState,
        )
      : null;
    opponentNearPath = match.kickoff.phase === "open-play" && sourceNearPathVisible
      ? selectFreeBallNearPathPlayer(
          sourceGetNearestFrame,
          sourceGetNearestFrame.control.nativeTeamSlot === "A" ? "B" : "A",
          command,
          sourceNearPathPredictionState,
        )
      : null;
    return selectNearestControlledPlayer(sourceGetNearestFrame);
  });
  if (match.kickoff.phase === "kick-action") {
    centrePassPlayerFrame = match.players.map(clone);
    centrePassReceiverFrame = clone(match.players.find(
      ({ id }) => id === match.kickoff.action.receiverId,
    ));
  }
  match = runStage("process_teams", trace, () => {
    const eventStart = events.length;
    playerTeamSourceFrame = match.players.map(clone);
    const processed = processTeams(match, {
      command,
      defensiveLinesFrame: officialDefensiveLinesFrame,
      events,
      nearPath,
      nearest,
      opponentNearPath,
      nextTick,
      playerDistanceFrame,
      playerDistanceRankFrame,
      publishCentrePassContact(contact) {
        centrePassContactFrame = contact;
      },
      publishPlayerVisits(visits) {
        playerVisitFrame = visits;
      },
      sourcePredictionBall,
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
    playerVisitFrame,
    sourcePlayers: playerTeamSourceFrame,
    sourcePredictionBall,
    events,
  }));
  match = runStage("select_all_hlites", trace, () => selectControlledPlayer({
    events,
    match,
    nearest,
    nextTick,
  }));
  match = runStage("process_offs", trace, () => processOfficials(match, {
    events,
    nextTick,
    officialDefensiveLinesFrame,
    playerTeamSourceFrame,
    playerVisitFrame,
    sourceInitialization,
  }));
  match = runStage("process_anims", trace, () => processAnimations(match, {
    centrePassContactFrame,
    centrePassPlayerFrame,
    centrePassReceiverFrame,
    command,
    events,
    nearest,
    nextTick,
    playerDistanceFrame,
    playerVisitFrame,
    sourceInitialization,
  }));
  // Some browser-held kick/contact actions publish their source process_teams
  // possession write while process_anims is materialized. Apply USER.CPP's
  // new_users counter after that write, but with the get_nearest path and
  // player_distances frame captured at their native slots above.
  match = processScheduledLocalUserSelection(match, {
    events,
    nearPath,
    nextTick,
    playerDistanceFrame,
  });
  if (deferredExpiredPeriodTransition) {
    match = completeOpeningClockPeriod(match, { events, nextTick });
  } else if (
    match.clock.periodExpired
    && currentLifecyclePeriodReady(match)
    && !currentLifecycleSuspendsGameplay(match)
  ) {
    match = completeOpeningClockPeriod(match, { events, nextTick });
  }

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
  let rng = sourceInitialization
    ? match.rng.state
    : advanceCssoccerNativeRng(match.rng.state);
  const sourceBoundaryOwner = match.possession.owner === 0
    ? undefined
    : match.players.find(({ nativePlayerNumber }) => (
        nativePlayerNumber === match.possession.owner
      ));
  const sourceProcessesPossessedBoundary = (
    match.ball.outcome?.kind === "boundary"
    && match.possession.inHands === 0
    && sourceBoundaryOwner !== undefined
    // BALL.CPP process_ball still enters its physical branch when the owner
    // has negative contact. Ordinary stand/run collection during the 25-tick
    // boundary countdown has that state; held kicks and CONTROL_ACT do not.
    && sourceBoundaryOwner.livePass?.phase !== "kick-held"
    && sourceBoundaryOwner.liveShot?.phase !== "kick-held"
    && sourceBoundaryOwner.liveControlIntercept?.phase !== "control"
  );
  let ball;
  let visitsSourceBallZone = false;
  if (
    match.kickoff.ballStatus === "held-at-centre"
    || match.kickoff.ballStatus === "held-by-taker"
    || match.kickoff.ballStatus === "held-at-restart"
    || match.kickoff.ballStatus === "held-in-hands"
    || match.kickoff.ballStatus === "halftime-dead-ball"
  ) {
    const currentBall = createBallMatchState({
      ...match.ball,
      ball: {
        ...match.ball.ball,
        tick: nextTick,
        rng,
      },
    });
    if (
      match.kickoff.ballStatus === "held-at-centre"
      || match.kickoff.ballStatus === "held-at-restart"
      || match.kickoff.ballStatus === "halftime-dead-ball"
    ) {
      // These labels mean the set-piece owns the ball's location, not that
      // native ball_poss is set. BALL.CPP still visits the zero-displacement
      // trajectory each tick while the players position; during SWAP_ENDS
      // that same visit also consumes the pending ball_out_of_play countdown.
      const heldRestartBall = {
        ...currentBall,
        ball: { ...currentBall.ball, tick: match.ball.ball.tick },
      };
      // BALL.CPP decrements an already-pending ball_out_of_play countdown
      // even after a foul/offside init_match_mode has taken ownership. Its
      // zero tick calls respot_ball and re-enters that current match mode.
      const stepped = heldRestartBall.outcome?.kind === "boundary"
        && heldRestartBall.outcome.status === "restart-required"
        && heldRestartBall.ball.outOfPlay === 1
        ? stepBallBoundaryRespotTick(heldRestartBall)
        : stepBallMatchState(heldRestartBall, {
            goalCountdownComplete: match.goal.justScored === 0,
          });
      ball = stepped.state;
      visitsSourceBallZone = true;
      rng = ball.ball.rng;
      events.push(...stepped.events.map(clone));
    } else {
      ball = currentBall;
    }
  } else if (match.ball.limbo.active !== 0 && match.possession.owner !== 0) {
    const limboPlayer = match.players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === match.ball.limbo.player
    ));
    if (limboPlayer === undefined) {
      throw new Error("process_ball lost its current possessed limbo player.");
    }
    // BALL.CPP binds limbo to ball_limbo_p, independently of ball_poss. A
    // later process_teams visit may collect the same ball before process_ball;
    // native then waits on ball_limbo_p's current animation while retaining
    // the later collector as the possession owner. CONTROL_ACT may itself
    // recover before that contact threshold; BALL.CPP still uses the player's
    // replacement animation to finish the limbo countdown.
    const contactFrame = F32(limboPlayer.animation.frame + limboPlayer.animation.frameStep);
    const resumed = contactFrame > match.ball.limbo.contact;
    const limbo = resumed
      ? { active: 0, player: 0, contact: F32(0) }
      : clone(match.ball.limbo);
    if (resumed && limboPlayer.liveControlIntercept?.phase === "control") {
      match = {
        ...match,
        players: match.players.map((player) => player.id === limboPlayer.id
          ? {
              ...clone(player),
              liveControlIntercept: {
                ...clone(player.liveControlIntercept),
                resumeTick: nextTick,
              },
            }
          : player),
      };
    }
    ball = createBallMatchState({
      ...clone(match.ball),
      limbo,
      ball: {
        ...clone(match.ball.ball),
        tick: nextTick,
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
    const recoveringOnGround = owner.liveKeeper?.phase === "recover"
      && owner.intelligence.move === GET_UP_INTELLIGENCE_MOVE
      && owner.intelligence.count > 0;
    ball = recoveringOnGround
      ? createBallMatchState({
          ...clone(held.ball),
          ball: {
            ...clone(held.ball.ball),
            // hold_ball increments possession and resets ballz/displacement
            // before its I_GET_UP guard. While the keeper is still rising it
            // deliberately retains the prior save-contact x/y and airborne
            // flag instead of snapping the ball to the ordinary hands pose.
            position: {
              x: match.ball.ball.position.x,
              y: match.ball.ball.position.y,
              z: F32(CSSOCCER_BALL_CONSTANTS.ballDiameter / 2),
            },
            inAir: match.ball.ball.inAir,
            still: (
              match.ball.ball.displacement.x !== 0
              || match.ball.ball.displacement.y !== 0
            ) ? 0 : 1,
          },
        })
      : held.ball;
    match = { ...match, possession: held.possession };
    // BALL.CPP still enters its physical ball branch for a keeper-hands
    // owner whose source contact is negative. Ordinary holding and SAVE_ACT
    // catches therefore run get_ball_zone and install the keeper-specific
    // goal-kick zones. A held pass/punt owns a positive contact and keeps the
    // prior zone until its animation releases the ball.
    visitsSourceBallZone = (
      owner.livePass?.phase !== "kick-held"
      && owner.liveShot?.phase !== "kick-held"
    );
  } else if (
    match.possession.owner !== 0
    && match.possession.inHands === 0
    && !sourceProcessesPossessedBoundary
  ) {
    const owner = match.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === match.possession.owner,
    );
    if (owner === undefined) {
      throw new Error("process_ball lost its current outfield owner.");
    }
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
    } else if (
      owner.liveControlIntercept?.phase === "control"
      && owner.action.action.value === CONTROL_RECEIVE_ACTION
    ) {
      // BALLINT.CPP leaves the prior speed/still pair untouched while the
      // control animation still owns the ball contact. The completing
      // control_action publishes its final prepared pose later in go_team.
      ball = createBallMatchState({
        ...clone(match.ball),
        ball: {
          ...clone(match.ball.ball),
          tick: nextTick,
        },
      });
    } else {
      // BALL.CPP still enters its physical ball branch for an ordinary
      // outfield owner because the player's source contact is negative.
      // That branch owns get_ball_zone before process_teams, so possession
      // must not freeze the persistent zone row used by every zonal target.
      visitsSourceBallZone = true;
      if (match.ball.outcome?.kind === "goal") {
        const stepped = stepCssoccerPossessedGoalCountdownState(match.ball);
        ball = stepped.state;
        events.push(...stepped.events.map(clone));
      } else {
        const possessed = stepCssoccerPossessedBallState(match.ball);
        const bounded = qualifyCssoccerPossessedBallBoundary(possessed);
        ball = bounded.state;
        events.push(...bounded.events.map(clone));
      }
    }
    if (owner.liveControlIntercept?.phase === "tween") {
      match = {
        ...match,
        players: match.players.map((player) => player.id === owner.id
          ? {
              ...clone(player),
              liveControlIntercept: {
                ...clone(player.liveControlIntercept),
                sourcePrediction: {
                  position: clone(ball.ball.position),
                  displacement: clone(ball.ball.displacement),
                },
              },
            }
          : player),
      };
    }
  } else if (sourceProcessesPossessedBoundary) {
    const stepped = stepCssoccerPossessedBoundaryCountdownState(match.ball);
    ball = stepped.state;
    visitsSourceBallZone = true;
    events.push(...stepped.events.map(clone));
  } else {
    const limboPlayer = match.ball.limbo.active === 0
      ? undefined
      : match.players.find(({ nativePlayerNumber }) => (
          nativePlayerNumber === match.ball.limbo.player
        ));
    if (match.ball.limbo.active !== 0 && limboPlayer === undefined) {
      throw new Error("process_ball lost its current animation-bound restart owner.");
    }
    const currentBall = createBallMatchState({
      ...clone(match.ball),
      ball: {
        ...clone(match.ball.ball),
        // BALL.CPP rebound_post/rebound_bar consume the same af_randomize
        // globals as the rest of the match; there is no ball-local RNG.
        rng,
      },
    });
    const ballInput = {
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
    };
    const stepped = currentBall.outcome?.kind === "boundary"
      && currentBall.outcome.status === "restart-required"
      && currentBall.ball.outOfPlay === 1
      && match.rules.boundary?.phase === "delay"
      ? stepBallBoundaryRespotTick(currentBall, ballInput)
      : stepBallMatchState(currentBall, ballInput);
    ball = stepped.state;
    // BALL.CPP reaches get_ball_zone only when animation limbo no longer
    // suppresses the physical ball visit. The reducer retains the source
    // globals itself when this visit crosses out of play.
    visitsSourceBallZone = ball.limbo.active === 0;
    rng = ball.ball.rng;
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
  if (
    possession.owner === 0
    && visitsSourceBallZone
    && rules.gameAction === -1
  ) {
    // BALL.CPP ball_trajectory clears KPHOLD's keep-away global on the first
    // physical free-ball visit. While kickout limbo is active that branch is
    // suppressed, so the -1 survives exactly through the contact threshold.
    rules = { ...rules, gameAction: 0 };
  }
  const enteredGoal = match.ball.outcome === null
    && ball.outcome?.kind === "goal"
    && ball.outcome.status === "requires-score-resolution";
  const resetShotOnFrameCollision = events.some(({ type }) => (
    type === "post" || type === "crossbar"
  ));
  if (
    visitsSourceBallZone
    && match.rules.matchMode !== CSSOCCER_MATCH_MODE.SWAP_ENDS
    && match.clock.matchHalf <= 10
  ) {
    // BALL.CPP owns ball_zone1/2 and zone1/2_x/y as persistent globals.
    // get_ball_zone updates them only after a real process_ball visit and
    // deliberately leaves the prior values intact once pitch_bounds marks
    // the ball out. Keep that state instead of rebuilding it in process_teams.
    kickoff = {
      ...kickoff,
      zoning: stepCssoccerZoneState(kickoff.zoning, {
        ballPosition: ball.ball.position,
        ballOutOfPlay: ball.ball.outOfPlay,
        matchMode: match.rules.matchMode,
        ballInHands: possession.inHands === 0 ? 0 : 1,
        possessionPlayer: possession.owner,
      }),
    };
  }
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
    kickoff = {
      ...kickoff,
      phase: "goal-celebration",
      ballStatus: "goal-dead-ball",
      pendingAction: null,
      action: null,
      launch: null,
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
    // BALL.CPP keeps shot_pending alive while an ordinary miss counts down
    // out of play; respot_ball/reset_ball clears it only when the restart is
    // initialized. hit_goal_post/hit_cross_bar and good_goal/own_goal call
    // reset_shot immediately. A later shot during the post-goal countdown
    // starts a new pending value even though ball_in_goal remains set.
    players: enteredGoal || goal.justScored > 0 || resetShotOnFrameCollision
      ? clearLivePendingShots(match.players)
      : match.players,
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

function processRules(match, nextTick, events, command, sourcePredictionBall) {
  if (currentLifecycleSuspendsGameplay(match)) return match;
  if (
    match.goal.phase === "awaiting-post-goal-handoff"
    && match.ball.outcome?.kind === "goal"
    && match.ball.ball.outOfPlay === 1
    && events.some(({ type }) => type === "ball-post-goal-respot-required")
  ) {
    return initializePostGoalCentre(match, nextTick, events);
  }
  if (match.rules.foulRestart != null) {
    return processCurrentFoulRestartRules(
      match,
      nextTick,
      events,
      command,
      sourcePredictionBall,
    );
  }
  if (match.ball.outcome?.kind === "boundary" || match.rules.boundary != null) {
    return processBoundaryRestartRules(
      match,
      nextTick,
      events,
      command,
      sourcePredictionBall,
    );
  }
  if (match.rules.state.foul.playAdvantage === 1) {
    return resolveCurrentFoulAdvantage(match, nextTick, events);
  }
  if (
    match.kickoff.phase === "centre-positioning"
    && match.kickoff.ballStatus === "held-at-centre"
    && (
      match.kickoff.readiness.readyForLaunch
      || (
        (
          match.kickoff.restartKind === "halftime"
          || match.kickoff.restartKind === "post-goal"
        )
        && match.kickoff.readiness.setPieceWaitTicks === 1
        && match.kickoff.readiness.takerReady
        && match.kickoff.readiness.refereeReady
      )
    )
  ) {
    // RULES.CPP pre-decrements the retained set-piece wait counter in
    // match_rules. When one becomes zero, it forces all_standing and starts
    // the centre action in this same visit, before process_teams.
    return beginCentrePass(match, nextTick, events);
  }
  return match;
}

function routeCurrentTeamFoulCandidate(match, teamEvents, nextTick, events) {
  const candidates = teamEvents.filter(({ type }) => type === "foul-candidate");
  if (candidates.length === 0) return match;
  // player_ints calls init_foul immediately for every contacted opponent in
  // native player-number order. Each call consumes its own RNG and can
  // supersede the previous call's global advantage/restart state.
  return candidates.reduce(
    (current, event) => routeCurrentTeamFoulCandidateEvent(
      current,
      event,
      nextTick,
      events,
    ),
    match,
  );
}

function routeCurrentTeamFoulCandidateEvent(match, event, nextTick, events) {
  const offender = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === event.fouler,
  );
  const fallen = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === event.fallenPlayer,
  );
  if (offender === undefined || fallen === undefined || !offender.active) {
    throw new Error("Current foul candidate lost its stable offender or fallen player.");
  }
  if (
    event.source !== "player_ints"
    || !Number.isFinite(event.manDown)
    || event.manDown < 0
    || !Number.isFinite(event.offenderDistanceToBall)
    || event.offenderDistanceToBall < 0
    || !Number.isFinite(event.incidentPosition?.x)
    || !Number.isFinite(event.incidentPosition?.y)
  ) {
    throw new Error("Current player_ints foul candidate lost its source contact facts.");
  }
  const awardedNativeTeam = offender.nativeTeamSlot === "A" ? "B" : "A";
  const offenderDistanceToBall = event.offenderDistanceToBall;
  const context = {
    candidate: {
      type: "foul-candidate",
      fouler: event.fouler,
      fallenPlayer: event.fallenPlayer,
      source: event.source,
      playerId: offender.id,
    },
    offenderPosition: clone(event.incidentPosition),
    refereePosition: {
      x: match.officials.officials[0].position.x,
      y: match.officials.officials[0].position.y,
    },
    ballPossession: match.possession.owner,
    justScored: match.goal.justScored === 0 ? 0 : 1,
    manDown: event.manDown,
    offenderDistanceToBall,
    rng: match.rng.state,
    takerCandidates: currentRuleTakerCandidates(
      match,
      awardedNativeTeam,
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
    direct: routed.decision.direct,
    manDown: event.manDown,
    visibilitySeed: routed.decision.visibilitySeed,
    visibilityThreshold: routed.decision.visibilityThreshold,
    ...(routed.decision.advantageSeed === undefined
      ? {}
      : { advantageSeed: routed.decision.advantageSeed }),
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

function currentRuleTakerCandidates(match, awardedNativeTeam) {
  const tacticsState = currentFreePlayTacticsState(match.tactics);
  // RULES.CPP get_taker reads the persistent ball_zone1/ball_zone2 globals.
  // punish_foul has already moved ballx/bally to the incident, but does not
  // call get_ball_zone before selecting the taker.
  const zones = match.kickoff.zoning;
  return match.players
    .filter(({ role }) => role !== "keeper")
    .map((player) => {
      const zonal = resolveCssoccerZonalTarget(tacticsState, {
        nativeTeamSlot: player.nativeTeamSlot,
        nativePlayerNumber: player.nativePlayerNumber,
        ballZone: zones[player.nativeTeamSlot].ballZone,
        // get_taker indexes match_tactics[ball_zone] directly. It does not
        // enter the +32 possession half of the live tactics table.
        teamInPossession: false,
      });
      return {
        playerId: player.id,
        nativePlayerNumber: player.nativePlayerNumber,
        active: player.active ? 1 : 0,
        // get_taker mirrors the incident for team B, then compares it with
        // the unmirrored match_tactics2 table cell.
        tacticalPosition: clone(zonal.source),
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
  // punish_foul can temporarily replace match_mode while BALL.CPP still owns
  // a completed goal's out_of_play countdown. It does not consume that goal:
  // respot_ball later replaces the foul with the required centre restart.
  const goal = match.goal;
  // RULES.CPP punish_foul calls init_match_mode immediately. Its
  // reset_all_ideas clears pending tm_strike/I_INTERCEPT state for every
  // player, while already-running physical actions continue through
  // do_action. Apply that reset at the award boundary so an old intercept
  // cannot pin the selected free-kick taker forever.
  const players = match.players.map(resetSourceMatchModeIdeas);
  const taker = players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === restart.taker.nativePlayerNumber,
  );
  if (taker === undefined || !taker.active || taker.role === "keeper") {
    throw new Error("Current foul restart lost its source-selected active outfield taker.");
  }
  const ballPosition = {
    // incident_x/incident_y are native ints. init_foul truncates the
    // offender's current float position before punish_foul copies them back
    // into ballx/bally.
    x: F32(Math.trunc(restart.ballPosition.x)),
    y: F32(Math.trunc(restart.ballPosition.y)),
    z: F32(CSSOCCER_BALL_CONSTANTS.ballDiameter / 2),
  };
  const ball = createBallMatchState({
    ball: {
      ...clone(match.ball.ball),
      tick: nextTick,
      position: ballPosition,
      displacement: { x: F32(0), y: F32(0), z: F32(0) },
      spin: {
        ...clone(match.ball.ball.spin),
        swerve: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
    },
    limbo: { active: 0, player: 0, contact: F32(0) },
    // punish_foul does not clear ball_in_goal/ball_out_of_play. Retain the
    // match-owned outcome so the following process_ball visits can consume
    // the still-live countdown exactly as the native globals do.
    outcome: clone(match.ball.outcome),
  });
  const possession = createPossessionState({
    ...clone(releasePossession(match.possession)),
    owner: 0,
    lastTouch: taker.nativePlayerNumber,
    preKeeperTouch: taker.nativePlayerNumber,
    inHands: 0,
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
    goal,
    ball,
    possession,
    players,
    rules: {
      ...match.rules,
      phase: "foul-restart-wait",
      matchMode: restart.matchMode,
      gameAction: restart.gameAction,
      setPiece: restart.kind === "penalty" ? 4 : restart.kind === "direct" ? 6 : 5,
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

function processCurrentFoulRestartRules(
  match,
  nextTick,
  events,
  command,
  sourcePredictionBall,
) {
  const current = match.rules.foulRestart;
  if (current.phase === "wait") {
    const disciplineTicks = Math.max(0, current.disciplineTicks - 1);
    // ACTIONS.CPP kick_action and the tackle/fall actions retain their own
    // physical animation after init_match_mode. Let those exact reducers
    // recover to STAND before kickoffPlayerMotion owns stand/run travel.
    const waiting = match.players.some((player) => (
      player.liveContact !== undefined
      || player.livePass !== undefined
      || player.liveShot !== undefined
    ))
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
    return enterCurrentFoulSourcePositioning(ready, nextTick, events);
  }
  if (current.phase === "positioning") {
    return advanceCurrentFoulPositioning(match, nextTick, events);
  }
  if (current.phase === "decision") {
    return decideCurrentFoulRestart(
      match,
      nextTick,
      events,
      command,
      sourcePredictionBall,
    );
  }
  if (current.phase === "runup") return match;
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

function enterCurrentFoulSourcePositioning(match, nextTick, events) {
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
  const taker = match.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === descriptor.taker.nativePlayerNumber,
  );
  if (taker === undefined || !taker.active) {
    throw new Error("Current foul positioning lost its source-selected taker.");
  }
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
    rules: {
      ...match.rules,
      phase: "foul-restart",
      canBeOffside: descriptor.canBeOffside,
      foulRestart: {
        ...current,
        phase: "positioning",
        disciplineTicks: 0,
        pendingDismissalId: null,
        takerPlacement: clone(takerPlacement),
        wall: clone(prepared.wall),
      },
    },
    kickoff: {
      ...match.kickoff,
      // punish_foul already called init_match_mode in the player visit which
      // awarded this restart. There is no second reset when the old physical
      // kick finishes: go_team simply keeps advancing those source journeys.
      phase: "foul-contact-wait",
      ballStatus: "held-at-restart",
      pendingAction: null,
      action: null,
      launch: null,
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
      target = currentTenYardTarget(
        target,
        descriptor.ballPosition,
        player.nativeTeamSlot,
        player.position,
      );
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

function currentTenYardTarget(
  target,
  ballPosition,
  nativeTeamSlot,
  playerPosition = target,
  nativeSourceTarget = null,
) {
  // INCIDENT_DIST is the expression `prat*10`, not a stored float global.
  // Keep the multiplication in the evaluator until the source assignment.
  const minimum = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 10;
  const sourceTarget = nativeSourceTarget === null
    ? nativeTeamSlot === "A"
      ? { x: F32(target.x), y: F32(target.y) }
      : {
          x: F32(CSSOCCER_BALL_CONSTANTS.pitchLength - target.x),
          y: F32(CSSOCCER_BALL_CONSTANTS.pitchWidth - target.y),
        }
    : {
        x: F32(nativeSourceTarget.x),
        y: F32(nativeSourceTarget.y),
      };
  const offset = nativeTeamSlot === "A"
    ? {
        x: F32(sourceTarget.x - ballPosition.x),
        y: F32(sourceTarget.y - ballPosition.y),
      }
    : {
        x: F32(
          (CSSOCCER_BALL_CONSTANTS.pitchLength - sourceTarget.x)
            - ballPosition.x,
        ),
        y: F32(
          (CSSOCCER_BALL_CONSTANTS.pitchWidth - sourceTarget.y)
            - ballPosition.y,
        ),
      };
  const distance = sourceDistance2d(offset);
  let constrainedSource = sourceTarget;
  if (distance < minimum) {
    constrainedSource = nativeTeamSlot === "A"
      ? {
          x: F32(ballPosition.x + offset.x * minimum / distance),
          y: F32(ballPosition.y + offset.y * minimum / distance),
        }
      : {
          x: F32(
            CSSOCCER_BALL_CONSTANTS.pitchLength
              - (ballPosition.x + offset.x * minimum / distance),
          ),
          y: F32(
            CSSOCCER_BALL_CONSTANTS.pitchWidth
              - (ballPosition.y + offset.y * minimum / distance),
          ),
        };
  }
  // find_zonal_target evaluates the mirror and subtraction in one x87
  // expression before assigning tx/ty to f32. Keep that grouping: rounding
  // the mirrored world point first loses one bit before init_run_act adds the
  // player position back.
  const playerOffset = nativeTeamSlot === "A"
    ? {
        x: F32(constrainedSource.x - playerPosition.x),
        y: F32(constrainedSource.y - playerPosition.y),
      }
    : {
        x: F32(
          (CSSOCCER_BALL_CONSTANTS.pitchLength - constrainedSource.x)
            - playerPosition.x,
        ),
        y: F32(
          (CSSOCCER_BALL_CONSTANTS.pitchWidth - constrainedSource.y)
            - playerPosition.y,
        ),
      };
  return {
    x: F32(playerOffset.x + playerPosition.x),
    y: F32(playerOffset.y + playerPosition.y),
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
  if (match.kickoff.phase === "foul-contact-wait") {
    // Source positioning is owned by each player's ordinary go_team visit.
    // await_set_kick observes that live state before process_teams. Once the
    // last blocking action has settled it collects the ball, binds the user
    // taker, and whistles before this tick's player visits.
    const current = match.rules.foulRestart;
    const descriptor = current.descriptor;
    const taker = match.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === descriptor.taker.nativePlayerNumber,
    );
    if (taker === undefined || !taker.active) {
      throw new Error("Current foul live readiness lost its active taker.");
    }
    const offsideById = new Map(
      match.rules.state.offside.players.map(({ id, tmOff }) => [id, tmOff]),
    );
    const allStanding = match.players.every((player) => {
      if (!player.active) return true;
      const action = player.action.action.value;
      return action === CSSOCCER_NATIVE_ACTIONS.STAND
        || action === CSSOCCER_NATIVE_ACTIONS.PICKUP
        || player.liveMotion?.directionMode === 6
        || (
          action === CSSOCCER_NATIVE_ACTIONS.RUN
          && offsideById.get(player.id) === -2
        );
    });
    const placement = current.takerPlacement;
    const alreadyThere = taker.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
      && sourceDistance2d({
        x: F32(placement.x - taker.position.x),
        y: F32(placement.y - taker.position.y),
      }) < CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.motion.imThereDistance.value;
    if (!allStanding || !alreadyThere) return match;
    events.push({
      type: "foul-restart-ready",
      tick: nextTick,
      kind: descriptor.kind,
      playerId: taker.id,
    });
    return {
      ...match,
      players: match.players.map((player) => (
        player.id === taker.id
          ? {
              ...clone(player),
              liveRestart: {
                phase: "set-piece-ready",
                startTick: nextTick,
                aim: {
                  x: player.facing.x,
                  y: player.facing.y,
                  high: false,
                },
              },
            }
          : player
      )),
      possession: collectPossession(match.possession, taker.nativePlayerNumber),
      control: {
        ...match.control,
        activePlayerId: descriptor.awardedNativeTeam === match.control.nativeTeamSlot
          ? taker.id
          : null,
      },
      rules: {
        ...match.rules,
        foulRestart: { ...current, phase: "decision" },
      },
      kickoff: {
        ...match.kickoff,
        // Keep the live go_team carrier until ready_set_kick starts the
        // physical action; this tick still executes dead-ball intelligence.
        ballStatus: "held-by-taker",
      },
    };
  }
  if (
    match.kickoff.motion.status !== "settled"
    || match.officials.officials[0].action !== CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value
  ) return match;
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

function decideCurrentFoulRestart(
  match,
  nextTick,
  events,
  command,
  sourcePredictionBall,
) {
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
  if (userControlled) {
    const currentTaker = aimed.players.find(({ id }) => id === taker.id);
    if (currentTaker === undefined) {
      throw new Error("Current foul decision lost its aimed current taker.");
    }
    if (fire1 || fire2) {
      return chargeCurrentBoundaryKick({
        aim: aim ?? currentTaker.liveRestart?.aim ?? {
          x: currentTaker.facing.x,
          y: currentTaker.facing.y,
          high: false,
        },
        match: aimed,
        nextTick,
        taker: currentTaker,
      });
    }
    if (currentTaker.liveRestart?.phase === "set-piece-charged") {
      return beginCurrentFoulRunup({
        aim: currentTaker.liveRestart.aim,
        events,
        match: aimed,
        nextTick,
        taker: currentTaker,
      });
    }
    return aimed;
  }
  const action = descriptor.kind === "indirect" ? "punt" : "shot";
  return beginCurrentFoulKick({
    action,
    aim: aim ?? defaultCurrentBoundaryAim(descriptor),
    events,
    match: aimed,
    nextTick,
    sourcePredictionBall,
    taker,
    userControlled,
  });
}

function beginCurrentFoulKick({
  action,
  aim,
  events,
  match,
  nextTick,
  sourcePredictionBall,
  taker,
  userControlled,
}) {
  const currentTaker = match.players.find(({ id }) => id === taker.id);
  if (
    currentTaker === undefined
    || match.possession.owner !== currentTaker.nativePlayerNumber
    || match.possession.inHands !== 0
  ) {
    throw new Error("Current foul kick lost its single feet owner.");
  }
  const userSetPiece = userControlled
    && currentTaker.liveRestart?.phase === "set-piece-runup";
  const kickKind = userSetPiece ? "shot" : action;
  const kickPlayers = match.players.map((player) => {
    if (player.id !== currentTaker.id || player.liveRestart === undefined) return player;
    const cleaned = clone(player);
    delete cleaned.liveRestart;
    if (userSetPiece) cleaned.facing = { x: F32(aim.x), y: F32(aim.y) };
    return cleaned;
  });
  const players = initializeOpenPlayShotActions({
    match,
    nextTick,
    players: kickPlayers,
    sourcePredictionBall,
    shotActions: [{
      charge: null,
      direction: kickKind === "shot" && userControlled
        ? { x: F32(aim.x), y: F32(aim.y) }
        : null,
      drive: false,
      holderId: currentTaker.id,
      kind: kickKind,
      ...(userSetPiece ? {
        newSetPiece: {
          power: currentTaker.liveRestart?.power ?? 0,
          height: currentTaker.liveRestart?.charge ?? 0,
        },
      } : {}),
      passType: kickKind === "punt" ? LIVE_PUNT_PASS_TYPE : -1,
      sourceBallPosition: clone(match.ball.ball.position),
      sourcePossessionOwner: match.possession.owner,
      targetKeeperNativePlayer: currentTaker.nativePlayerNumber < 12 ? 12 : 1,
      userControlled,
    }],
  }).map((player) => userSetPiece && player.id === currentTaker.id
    ? {
        ...player,
        previousPosition: clone(currentTaker.position),
        position: clone(currentTaker.position),
        liveMotion: {
          ...player.liveMotion,
          directionMode: 2,
        },
      }
    : player);
  events.push({
    type: `${match.rules.foulRestart.descriptor.kind}-restart-action-started`,
    tick: nextTick,
    playerId: currentTaker.id,
    nativePlayerNumber: currentTaker.nativePlayerNumber,
    action: kickKind,
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
      state: {
        ...match.rules.state,
        offside: clearCssoccerOffsideRestart(match.rules.state.offside),
      },
      foulRestart: { ...match.rules.foulRestart, phase: "action", action: kickKind },
    },
    kickoff: {
      ...match.kickoff,
      phase: "rule-action",
      ballStatus: "live",
      pendingAction: {
        type: kickKind,
        nativePlayerNumber: currentTaker.nativePlayerNumber,
      },
      action: {
        kind: kickKind,
        takerId: currentTaker.id,
        receiverId: match.kickoff.owner.receiverId,
        startTick: nextTick,
        released: false,
        userControlled,
      },
      launch: {
        tick: nextTick,
        kind: kickKind,
        takerId: currentTaker.id,
        source: "current rule decision, source placement, facing, and restart ball",
      },
    },
  };
}

function stepCurrentFoulKickAction(
  match,
  nextTick,
  events,
  publishPlayerVisits,
  command,
  nearPath,
  opponentNearPath,
  playerDistanceFrame,
  playerDistanceRankFrame,
) {
  let currentMatch = match;
  let heldVisits = null;
  const sourceTaker = currentMatch.players.find(({ id }) => (
    id === currentMatch.kickoff.action?.takerId
  ));
  if (sourceTaker !== undefined) {
    currentMatch = stepCurrentBoundaryKickActionTeamContinuation(
      currentMatch,
      sourceTaker,
      nextTick,
      (visits) => {
        heldVisits = visits;
      },
      currentMatch.kickoff.zoning,
      {
        command,
        events,
        playerDistanceFrame,
        playerDistanceRankFrame,
      },
    );
  }
  const current = currentMatch.rules.foulRestart;
  const taker = currentMatch.players.find(
    ({ id }) => id === currentMatch.kickoff.action?.takerId,
  );
  if (
    current?.phase !== "action"
    || taker?.liveShot?.phase !== "kick-held"
    || currentMatch.possession.owner !== taker.nativePlayerNumber
  ) {
    throw new Error("Current foul action lost its single kick owner.");
  }
  if (F32(taker.animation.frame + taker.animation.frameStep) < taker.liveShot.contact) {
    if (heldVisits === null) {
      throw new Error("Current foul action lost its held-kick visits.");
    }
    publishPlayerVisits(heldVisits);
    return currentMatch;
  }
  let released;
  if (taker.liveShot.kind === "shot" && taker.liveShot.newSetPiece !== undefined) {
    const keeper = currentMatch.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === taker.liveShot.targetKeeperNativePlayer,
    );
    if (keeper === undefined || keeper.role !== "keeper") {
      throw new Error("Current foul set-piece shot lost its defending keeper.");
    }
    released = releaseCssoccerNewSetPieceShot({
      ball: currentMatch.ball,
      direction: clone(taker.liveShot.direction),
      height: taker.liveShot.newSetPiece.height,
      keeper: {
        nativePlayerNumber: keeper.nativePlayerNumber,
        position: clone(keeper.position),
      },
      owner: liveShotHolder(taker),
      possession: currentMatch.possession,
      power: taker.liveShot.newSetPiece.power,
      rng: currentMatch.rng.state,
      tick: currentMatch.ball.ball.tick,
      userControlled: taker.liveShot.userControlled,
    });
  } else if (taker.liveShot.kind === "shot") {
    const keeper = currentMatch.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === taker.liveShot.targetKeeperNativePlayer,
    );
    if (keeper === undefined || keeper.role !== "keeper") {
      throw new Error("Current foul shot lost its defending keeper.");
    }
    released = releaseCssoccerShot({
      ball: currentMatch.ball,
      charge: taker.liveShot.charge,
      direction: taker.liveShot.userControlled ? clone(taker.liveShot.direction) : null,
      drive: taker.liveShot.drive,
      keeper: {
        nativePlayerNumber: keeper.nativePlayerNumber,
        position: clone(keeper.position),
      },
      owner: liveShotHolder(taker),
      possession: currentMatch.possession,
      rng: currentMatch.rng.state,
      tick: currentMatch.ball.ball.tick,
      userControlled: taker.liveShot.userControlled,
    });
  } else if (taker.liveShot.kind === "punt") {
    released = releaseCssoccerPunt({
      ball: currentMatch.ball,
      keeperHands: false,
      owner: liveShotHolder(taker),
      possession: currentMatch.possession,
      rng: currentMatch.rng.state,
      tick: currentMatch.ball.ball.tick,
    });
  } else {
    throw new Error(`Unsupported current foul kick ${String(taker.liveShot.kind)}.`);
  }
  const release = { ...clone(released.release), tick: nextTick };
  const players = currentMatch.players.map((player) => (
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
  let releasedMatch = completeCurrentFoulRelease({
    match: {
      ...currentMatch,
      ball: released.ball,
      possession: released.possession,
      players,
      rng: { ...currentMatch.rng, state: released.rng },
    },
    nextTick,
    release,
  });
  if (heldVisits === null) {
    throw new Error("Current foul release lost its held-kick visits.");
  }
  const traversal = nativeContactTraversalOrder(match.tick & 1);
  const takerVisitIndex = traversal.indexOf(taker.nativePlayerNumber);
  if (takerVisitIndex < 0) {
    throw new Error("Current foul release lost its taker traversal slot.");
  }
  const releasedVisits = heldVisits.map((visit) => (
    traversal.indexOf(visit.nativePlayerNumber) > takerVisitIndex
      ? {
          ...clone(visit),
          possession: clone(releasedMatch.possession),
        }
      : visit
  ));
  publishPlayerVisits(releasedVisits);
  const frozenPredictionBall = taker.liveShot.sourcePrediction === undefined
    ? match.ball
    : {
        ...clone(match.ball),
        ball: {
          ...clone(match.ball.ball),
          position: clone(taker.liveShot.sourcePrediction.position),
          displacement: clone(taker.liveShot.sourcePrediction.displacement),
        },
      };
  const currentNearPaths = new Map(
    [nearPath, opponentNearPath]
      .filter((player) => player !== null && player !== undefined)
      .map((player) => [player.nativeTeamSlot, player]),
  );
  const automaticNearPaths = ["A", "B"]
    .map((nativeTeamSlot) => (
      currentNearPaths.get(nativeTeamSlot)
      ?? selectFreeBallNearPathPlayer(
        match,
        nativeTeamSlot,
        command,
        frozenPredictionBall,
      )
    ))
    .filter((player, index, players) => (
      player !== null
      && player !== undefined
      && players.findIndex((candidate) => candidate?.id === player.id) === index
    ))
    .sort((left, right) => (
      traversal.indexOf(left.nativePlayerNumber)
      - traversal.indexOf(right.nativePlayerNumber)
    ));
  for (const automaticNearPath of automaticNearPaths) {
    const journey = stepOpponentFreeBallJourney({
      command,
      frozenLimboPrediction: null,
      match: releasedMatch,
      nearPath: automaticNearPath,
      nextTick,
      sourceReleaseNativePlayer: taker.nativePlayerNumber,
      sourcePredictionState: null,
      skipPlayerIds: new Set(),
      sourcePlayers: match.players,
      sourcePossessionOwner: match.possession.owner,
      visits: releasedVisits,
      wantPassNativePlayer: 0,
    });
    releasedMatch = {
      ...releasedMatch,
      players: journey.players,
      rng: { ...releasedMatch.rng, state: journey.rng },
    };
  }
  return releasedMatch;
}

function completeCurrentFoulRelease({ match, nextTick, release }) {
  const current = match.rules.foulRestart;
  const descriptor = current.descriptor;
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
      // USER.CPP new_users does not run its reselection counter once the
      // set-piece shot has made ball_poss zero. Keep the taker's control byte
      // at this release boundary.
      activePlayerId: match.control.activePlayerId,
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

function processBoundaryRestartRules(
  match,
  nextTick,
  events,
  command,
  sourcePredictionBall,
) {
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
        // BALL.CPP only stores ball_out_of_play/match_mode on the crossing
        // visit. game_action and the set-piece reset belong to the later
        // init_gkick/init_corner visit after the 25-tick countdown.
        gameAction: 0,
        boundary: {
          phase: "delay",
          decision: clone(decision),
          descriptor: null,
          setPiece: null,
          releaseCount: 0,
          // pitch_bounds marks the ball out before get_ball_zone, so the
          // source retains the last in-pitch ball_zone and zone centres.
          // Restart init later replaces only ball_zone1/2.
          sourceZoning: clone(current.kickoff.zoning),
        },
      },
      kickoff: {
        ...current.kickoff,
        ballStatus: "boundary-dead-ball",
      },
    };
  }

  const boundary = current.rules.boundary;
  if (boundary.phase === "delay") {
    if (current.ball.ball.outOfPlay !== 0) return current;
    return initializeCurrentBoundaryRestart(current, nextTick, events);
  }
  if (boundary.phase === "positioning") {
    return advanceCurrentBoundaryPositioning(current, nextTick, events);
  }
  if (boundary.phase === "pickup") {
    return completeCurrentBoundaryPickup(current, nextTick, events);
  }
  if (boundary.phase === "decision") {
    return decideCurrentBoundaryRestart(
      current,
      nextTick,
      events,
      command,
      sourcePredictionBall,
    );
  }
  if (boundary.phase === "runup") return current;
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
  const sourceZoning = createCssoccerZoneState({
    A: {
      ballZone: descriptor.ballZones.A,
      zoneCenter: clone(match.rules.boundary.sourceZoning.A.zoneCenter),
    },
    B: {
      ballZone: descriptor.ballZones.B,
      zoneCenter: clone(match.rules.boundary.sourceZoning.B.zoneCenter),
    },
  });
  const ballPosition = clone(descriptor.ball.position);
  const ball = createBallMatchState({
    ball: {
      ...clone(match.ball.ball),
      tick: nextTick,
      position: ballPosition,
      previousPosition: clone(match.ball.ball.position),
      displacement: clone(descriptor.ball.displacement),
      outPosition: null,
      inAir: descriptor.ball.inAir,
      inGoal: descriptor.ball.inGoal,
      outOfPlay: descriptor.ball.outOfPlay,
      still: descriptor.ball.still,
      // reset_ball clears displacement/still but leaves BALL.CPP's
      // get_ball_speed result from the final out-of-play trajectory visit.
      speed: match.ball.ball.speed,
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
  // INTELL.CPP reset_all_ideas/reset_ideas does not clear go_step. Preserve
  // that source field across the browser's live-action cleanup so the first
  // find_zonal_target visit chooses the same trot/run branch.
  const sourceGoStepById = new Map(match.players.map((player) => [
    player.id,
    player.liveMotion?.goStep ?? player.goalGoStep ?? false,
  ]));
  let players = preparePlayersForCurrentBoundaryRestart(
    match.players,
    targets,
    nextTick,
  );
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
      // init_match_mode/reset_all_ideas does not replace tm_act. A contact
      // action can therefore outlive the 25-tick boundary countdown. Keep a
      // dormant stand/run carrier in the positioning reducer until the real
      // TACKLE/FALL/GETUP/STEAL action recovers on the player below.
      action: blocksCurrentPositioningMotion(player)
        ? CSSOCCER_NATIVE_ACTIONS.STAND
        : player.action.action.value,
      directionMode: blocksCurrentPositioningMotion(player)
        ? 1
        : player.liveMotion?.directionMode ?? 0,
      faceDirection: sourceFacingDirection(player.facing),
      goStep: blocksCurrentPositioningMotion(player)
        ? false
        : sourceGoStepById.get(player.id),
      position: { x: player.position.x, y: player.position.y },
      facing: clone(player.facing),
    })),
    selectedCountry: match.control.country,
    targetPlayers: motionTargets,
    teamBySlot,
  });
  players = bindCurrentBoundaryMotion(players, motion, nextTick, {
    retainSourceActions: true,
  });
  players = players.map((player) => {
    if (!["punt-stand", "punt-stand-cleared"].includes(player.liveKeeper?.phase)) {
      return player;
    }
    // pitch_bounds/reset_ball ran after this keeper's current go_team visit:
    // publish the retained stand above, then retire shot_pending's browser
    // carrier so the dormant restart journey resumes on the following tick.
    const cleared = clone(player);
    delete cleared.liveKeeper;
    return cleared;
  });
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
      // Corners, goal kicks, and throw-ins all clear can_be_offside in
      // RULES.CPP init_match_mode. It stays clear after release until
      // BALLINT.CPP control_ball/rebound_off_plr raises it again.
      canBeOffside: descriptor.rules.canBeOffside,
      boundary: {
        ...clone(match.rules.boundary),
        phase: "positioning",
        descriptor: clone(descriptor),
        setPiece: clone(setPiece),
        sourceZoning,
      },
    },
    clock: {
      ...match.clock,
      running: descriptor.clock.stopClock === 0 && match.clock.running,
    },
    control: {
      ...match.control,
      // RULES.CPP init_match_mode -> clear_all_autos removes the gameplay
      // selection. The later ready set-piece path attaches the user taker.
      activePlayerId: null,
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
      zoning: sourceZoning,
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
    const restartReady = match.kickoff.motion.status === "settled"
      && match.officials.officials[0].action
        === CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value;
    setPiece = advanceCssoccerSetPiece(boundary.setPiece, {
      type: "readiness",
      alreadyThere: restartReady ? 1 : 0,
      playerOnOff: 0,
      allStanding: restartReady ? 1 : 0,
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
    players: match.players.map((player) => (
      player.id === taker.id && descriptor.kind !== "throw-in"
        ? {
            ...clone(player),
            // RULES.CPP await_set_kick snapshots setp_kick_x/y from the
            // taker's current facing when the restart first becomes ready.
            // Neutral charge pulses retain this vector even if the run-up
            // briefly turns the player before taker_nkick restores it.
            liveRestart: {
              phase: "set-piece-ready",
              startTick: nextTick,
              aim: {
                x: player.facing.x,
                y: player.facing.y,
                high: false,
              },
            },
          }
        : player
    )),
    control: {
      ...match.control,
      // RULES.CPP await_set_kick assigns control=user_taker when the restart
      // becomes ready. Non-user restarts retain no local selection.
      activePlayerId: descriptor.awardedNativeTeam === match.control.nativeTeamSlot
        ? taker.id
        : null,
    },
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

function decideCurrentBoundaryRestart(
  match,
  nextTick,
  events,
  command,
  sourcePredictionBall,
) {
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
  if (userControlled && descriptor.kind !== "throw-in") {
    const currentTaker = aimed.players.find(({ id }) => id === taker.id);
    if (currentTaker === undefined) {
      throw new Error("Boundary decision lost its aimed current taker.");
    }
    if (fire1 || fire2) {
      return chargeCurrentBoundaryKick({
        aim: aim ?? currentTaker.liveRestart?.aim ?? {
          x: currentTaker.facing.x,
          y: currentTaker.facing.y,
          high: false,
        },
        match: aimed,
        nextTick,
        taker: currentTaker,
      });
    }
    if (currentTaker.liveRestart?.phase === "set-piece-charged") {
      return beginCurrentBoundaryRunup({
        aim: currentTaker.liveRestart.aim,
        events,
        match: aimed,
        nextTick,
        taker: currentTaker,
      });
    }
    return aimed;
  }
  if (userControlled && !fire1 && !fire2) return aimed;
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
    sourcePredictionBall,
    taker,
    userControlled,
  });
}

function chargeCurrentBoundaryKick({ aim, match, nextTick, taker }) {
  const previousCharge = taker.liveRestart?.phase === "set-piece-charged"
    ? taker.liveRestart.charge
    : 0;
  return {
    ...match,
    players: match.players.map((player) => player.id === taker.id
      ? {
          ...clone(player),
          liveRestart: {
            phase: "set-piece-charged",
            startTick: nextTick,
            charge: Math.min(30, previousCharge + 1),
            aim: clone(aim),
          },
        }
      : player),
  };
}

function beginCurrentBoundaryRunup({ aim, events, match, nextTick, taker }) {
  const target = {
    x: match.ball.ball.position.x,
    y: match.ball.ball.position.y,
  };
  const offset = {
    x: F32(target.x - taker.position.x),
    y: F32(target.y - taker.position.y),
  };
  const distance = sourceDistance2d(offset);
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === taker.id)?.value;
  if (!(distance > 0) || !Number.isSafeInteger(teamRate)) {
    throw new Error("Boundary run-up lost its current target or team rate.");
  }
  const speed = actualPlayerSpeed({
    pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: true,
    nativePlayer: taker.nativePlayerNumber,
    ballPossession: match.possession.owner,
    ballInHands: false,
    keeperNativePlayers: [1, 12],
    userControlIndex: 1,
    burstTimer: 0,
  });
  const goCount = Math.trunc(distance / speed + 1);
  if (goCount <= 0) throw new Error("Boundary run-up produced no source travel ticks.");
  const goDisplacement = {
    x: F32(offset.x / goCount),
    y: F32(offset.y / goCount),
  };
  const sideStepDirection = sourceSideStepDirection({
    target,
    previousPosition: taker.position,
    previousFacing: taker.facing,
  });
  const animationId = TROT_ANIMATION_BY_DIRECTION[sideStepDirection];
  const animationFrameStep = F32(speed * SIDE_STEP_FRAME_STEP / 2);
  const players = match.players.map((player) => player.id === taker.id
    ? {
        ...clone(player),
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        velocity: { x: F32(0), y: F32(0), z: F32(0) },
        target: { ...clone(target), z: F32(0) },
        intelligence: {
          special: 0,
          move: SET_PIECE_RUNUP_INTELLIGENCE_MOVE,
          count: Math.max(0, goCount - 1),
        },
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          facingX: player.facing.x,
          facingY: player.facing.y,
        }),
        animation: {
          status: "browser-current-state",
          kind: "side-step",
          id: animationId,
          sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          frame: F32(0),
          frameStep: animationFrameStep,
          pending: null,
          tick: nextTick,
        },
        liveMotion: {
          kind: "side-step",
          teamRate,
          target: clone(target),
          goStep: true,
          goCount,
          goDisplacement,
          directionMode: 0,
          resetAnimationFrame: false,
          sideStepDirection,
          animationId,
          animationFrameStep,
        },
        liveRestart: {
          ...clone(player.liveRestart),
          phase: "set-piece-runup",
          startTick: nextTick,
          aim: clone(aim),
          remainingMoves: Math.max(0, goCount - 1),
        },
      }
    : player);
  events.push({
    type: "boundary-runup-started",
    tick: nextTick,
    playerId: taker.id,
    nativePlayerNumber: taker.nativePlayerNumber,
  });
  return {
    ...match,
    players,
    rules: {
      ...match.rules,
      boundary: { ...match.rules.boundary, phase: "runup" },
    },
    kickoff: { ...match.kickoff, phase: "boundary-runup" },
  };
}

function beginCurrentFoulRunup({ aim, events, match, nextTick, taker }) {
  const target = {
    x: match.ball.ball.position.x,
    y: match.ball.ball.position.y,
  };
  const offset = {
    x: F32(target.x - taker.position.x),
    y: F32(target.y - taker.position.y),
  };
  const distance = sourceDistance2d(offset);
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === taker.id)?.value;
  if (!(distance > 0) || !Number.isSafeInteger(teamRate)) {
    throw new Error("Foul run-up lost its current target or team rate.");
  }
  const speed = actualPlayerSpeed({
    pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: true,
    nativePlayer: taker.nativePlayerNumber,
    ballPossession: match.possession.owner,
    ballInHands: false,
    keeperNativePlayers: [1, 12],
    userControlIndex: 1,
    burstTimer: 0,
  });
  const goCount = Math.trunc(distance / speed + 1);
  if (goCount <= 0) throw new Error("Foul run-up produced no source travel ticks.");
  const goDisplacement = {
    x: F32(offset.x / goCount),
    y: F32(offset.y / goCount),
  };
  const sideStepDirection = sourceSideStepDirection({
    target,
    previousPosition: taker.position,
    previousFacing: taker.facing,
  });
  const animationId = TROT_ANIMATION_BY_DIRECTION[sideStepDirection];
  const animationFrameStep = F32(speed * SIDE_STEP_FRAME_STEP / 2);
  const players = match.players.map((player) => player.id === taker.id
    ? {
        ...clone(player),
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        velocity: { x: F32(0), y: F32(0), z: F32(0) },
        target: { ...clone(target), z: F32(0) },
        intelligence: {
          special: 0,
          move: SET_PIECE_RUNUP_INTELLIGENCE_MOVE,
          count: Math.max(0, goCount - 1),
        },
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          facingX: player.facing.x,
          facingY: player.facing.y,
        }),
        animation: {
          status: "browser-current-state",
          kind: "side-step",
          id: animationId,
          sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          frame: F32(0),
          frameStep: animationFrameStep,
          pending: null,
          tick: nextTick,
        },
        liveMotion: {
          kind: "side-step",
          teamRate,
          target: clone(target),
          goStep: true,
          goCount,
          goDisplacement,
          directionMode: 0,
          resetAnimationFrame: false,
          sideStepDirection,
          animationId,
          animationFrameStep,
        },
        liveRestart: {
          ...clone(player.liveRestart),
          phase: "set-piece-runup",
          startTick: nextTick,
          aim: clone(aim),
          remainingMoves: Math.max(0, goCount - 1),
        },
      }
    : player);
  events.push({
    type: "foul-runup-started",
    tick: nextTick,
    playerId: taker.id,
    nativePlayerNumber: taker.nativePlayerNumber,
  });
  return {
    ...match,
    players,
    rules: {
      ...match.rules,
      foulRestart: { ...match.rules.foulRestart, phase: "runup" },
    },
    kickoff: { ...match.kickoff, phase: "foul-runup" },
  };
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
    delete player.livePendingShot;
    if (!blocksCurrentPositioningMotion(source)) {
      delete player.liveControlIntercept;
      delete player.liveFirstTimeIntercept;
    }
    if (source.action.action.value === CSSOCCER_NATIVE_ACTIONS.STOP) {
      // init_match_mode/reset_all_ideas clears I_INTERCEPT before this
      // tick's do_action visit. STOP_ACT therefore takes stop_action's
      // non-intercept branch and enters init_stand_act immediately, before
      // computer_play may install the restart-positioning journey.
      player.action = createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: player.facing.x,
        facingY: player.facing.y,
      });
      player.animation = {
        status: "browser-current-state",
        kind: "stand",
        id: STAND_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        frame: F32(0),
        frameStep: STAND_FRAME_STEP,
        pending: null,
        tick: nextTick,
      };
      delete player.liveControlIntercept;
      delete player.liveFirstTimeIntercept;
    }
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
    };
  });
}

/** RULES.CPP init_match_mode/reset_all_ideas without inventing tm_act reset. */
function preparePlayersForCurrentBoundaryRestart(players, targets, nextTick) {
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const reset = resetPlayersForCurrentBoundary(players, targets, nextTick);
  return players.map((source, index) => {
    if (!blocksCurrentPositioningMotion(source)) return reset[index];
    const target = targetById.get(source.id);
    if (target === undefined) throw new Error(`Current boundary lost player ${source.id}.`);
    if (source.liveMotion === undefined) {
      throw new Error(`Current boundary lost contact motion for ${source.id}.`);
    }
    const player = clone(source);
    // reset_shot/holder_lose_ball clear global kick ownership. The current
    // physical action itself and its go_* fields remain owned by do_action.
    delete player.livePendingShot;
    return {
      ...player,
      role: target.role,
      targetOwner: target.targetOwner,
      target: { ...clone(target.target), z: F32(0) },
      intelligence: { special: 0, move: 0, count: 0 },
    };
  });
}

function blocksCurrentPositioningMotion(player) {
  return retainsPostGoalCentreJourney(player) || (
    player.liveContact !== undefined
    && player.liveContact.phase !== "barge"
  ) || (
    player.liveControlIntercept !== undefined
    && ["wait", "control"].includes(player.liveControlIntercept.phase)
  ) || (
    player.liveFirstTimeIntercept !== undefined
    && ["wait", "strike", "released"].includes(player.liveFirstTimeIntercept.phase)
  ) || player.liveKeeper !== undefined
    || player.livePass !== undefined
    || player.liveRestart !== undefined
    || player.liveShot !== undefined;
}

function currentNativePlayerOrder(players) {
  return [...players].sort(
    (left, right) => left.nativePlayerNumber - right.nativePlayerNumber,
  );
}

function bindCurrentBoundaryMotion(
  players,
  motion,
  nextTick,
  { retainSourceActions = false } = {},
) {
  const motionById = new Map(motion.players.map((player) => [player.id, player]));
  return players.map((player) => {
    const current = motionById.get(player.id);
    if (current === undefined) throw new Error(`Boundary motion lost ${player.id}.`);
    if (retainSourceActions && blocksCurrentPositioningMotion(player)) {
      return clone(player);
    }
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

function currentBoundaryLiveMotion(current, resetAnimationFrame = false) {
  return {
    kind: current.action === CSSOCCER_NATIVE_ACTIONS.RUN ? "run" : "stand",
    teamRate: current.teamRate,
    target: clone(current.target),
    goStep: current.goStep,
    goCount: current.goCount,
    goDisplacement: clone(current.goDisplacement),
    directionMode: current.directionMode,
    // init_stand_act resets the frame only on the transition to standing.
    // A settled player keeps advancing MC_STAND while await_set_kick runs.
    resetAnimationFrame,
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
  sourcePredictionBall,
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
  // EURO96 new_user_spec_kick ends its run-up in taker_nkick/make_shoot for
  // every non-throw boundary restart, including goal kicks.
  const kind = "shot";
  const newSetPiece = {
    power: currentTaker.liveRestart?.power ?? 0,
    height: currentTaker.liveRestart?.charge ?? 0,
  };
  const action = {
    charge: null,
    direction: { x: F32(aim.x), y: F32(aim.y) },
    drive: false,
    holderId: currentTaker.id,
    kind,
    newSetPiece,
    passType: -1,
    sourceBallPosition: clone(match.ball.ball.position),
    sourcePossessionOwner: match.possession.owner,
    targetKeeperNativePlayer: currentTaker.nativePlayerNumber < 12 ? 12 : 1,
    userControlled,
  };
  const kickPlayers = match.players.map((player) => {
    if (player.id !== currentTaker.id || player.liveRestart === undefined) return player;
    const cleaned = clone(player);
    delete cleaned.liveRestart;
    if (userControlled) {
      // ACTIONS.CPP taker_nkick restores the retained set-piece direction
      // immediately before make_shoot/init_kick_act rotates b_xoff/b_yoff.
      cleaned.facing = { x: F32(aim.x), y: F32(aim.y) };
    }
    return cleaned;
  });
  const players = initializeOpenPlayShotActions({
    match,
    nextTick,
    players: kickPlayers,
    shotActions: [action],
    sourcePredictionBall,
  }).map((player) => player.id === currentTaker.id
    ? {
        ...player,
        liveMotion: {
          ...player.liveMotion,
          // ACTIONS.CPP init_kick_act retains dir_mode=2 while set_piece_on
          // is still live, so process_dir preserves the restored kick vector.
          directionMode: 2,
        },
      }
    : player);
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
      ballStatus: "live",
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
      // USER.CPP new_users only runs its reselection counter while ball_poss
      // is non-zero. A just-released boundary shot is free, so the set-piece
      // taker retains the native control byte at this source boundary.
      activePlayerId: match.control.activePlayerId,
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
  if (match.ball.outcome?.kind !== "goal" || match.ball.outcome.crossing === undefined) {
    throw new Error("Post-goal centre lost the source goal crossing used by get_ball_zone.");
  }
  const zoning = createCurrentCentreZoning({
    ballPosition: match.ball.outcome.crossing,
    nativeTeamSlot: handoff.nativeTeamSlot,
  });
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
      // reset_ball changes ballx/y/z but leaves prev_ball* and the speed
      // computed earlier in this same process_ball visit untouched.
      previousPosition: clone(match.ball.ball.previousPosition),
      displacement: { x: F32(0), y: F32(0), z: F32(0) },
      outPosition: null,
      inAir: 0,
      inGoal: 0,
      outOfPlay: 0,
      still: 1,
      speed: match.ball.ball.speed,
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
    // reset_ball clears last_touch only; these BALLINT globals survive the
    // post-goal centre respot.
    previousTouch: match.possession.previousTouch,
    preKeeperTouch: match.possession.preKeeperTouch,
    inHands: 0,
    cannotPickUp: match.possession.cannotPickUp,
    players: match.possession.players.map((player) => ({
      ...clone(player),
      possession: 0,
    })),
  });
  // init_match_mode/reset_all_ideas clears intelligence and possession here,
  // but does not replace tm_act or the current go_* journey. process_teams
  // still executes those retained actions after respot_ball in this visit.
  const players = clearLivePendingShots(preparePlayersForPostGoalCentre(
    match.players,
    setup.players,
    nextTick,
  ));
  const sourceMotionById = new Map(match.players.map((player) => [
    player.id,
    player.liveMotion,
  ]));
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
      // respot_ball/init_match_mode does not replace tm_act. Any current
      // physical, kick, keeper, or intercept action therefore survives, but
      // it is not owned by this stand/run-only centre travel reducer. Keep a
      // dormant carrier until that source action recovers.
      action: blocksPostGoalCentrePositioning(player)
        ? CSSOCCER_NATIVE_ACTIONS.STAND
        : player.action.action.value,
      directionMode: blocksPostGoalCentrePositioning(player)
        ? 1
        : player.liveMotion?.directionMode ?? 0,
      faceDirection: sourceFacingDirection(player.facing),
      goStep: blocksPostGoalCentrePositioning(player)
        ? false
        : player.liveMotion?.goStep ?? sourceMotionById.get(player.id).goStep,
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
    zoning,
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
      // init_match_mode does not clear the source offside_now global. Keep
      // the exact rule-state byte while replacing the superseded JS owner.
      state: match.rules.state,
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
    kickoff,
  };
}

function createCurrentCentreZoning({ ballPosition, nativeTeamSlot }) {
  if (nativeTeamSlot !== "A" && nativeTeamSlot !== "B") {
    throw new TypeError("Current centre zoning requires native team A or B.");
  }
  const live = stepCssoccerZoneState(createCssoccerZoneState(), {
    ballPosition,
    ballOutOfPlay: 0,
    matchMode: 0,
    ballInHands: 0,
    possessionPlayer: 0,
  });
  return createCssoccerZoneState({
    A: {
      ballZone: nativeTeamSlot === "A" ? 68 : 69,
      zoneCenter: clone(live.A.zoneCenter),
    },
    B: {
      ballZone: nativeTeamSlot === "B" ? 68 : 69,
      zoneCenter: clone(live.B.zoneCenter),
    },
  });
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
    if (source.action.action.value === CSSOCCER_NATIVE_ACTIONS.STOP) {
      // init_match_mode/reset_all_ideas clears I_INTERCEPT before this
      // visit reaches process_teams. STOP_ACT therefore executes
      // stop_action's non-intercept branch and enters init_stand_act before
      // the centre-positioning intelligence can install its next journey.
      player.action = createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: player.facing.x,
        facingY: player.facing.y,
      });
      player.animation = {
        status: "browser-current-state",
        kind: "stand",
        id: STAND_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        frame: F32(0),
        frameStep: STAND_FRAME_STEP,
        pending: null,
        tick: nextTick,
      };
    }
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
    };
  });
}

/** RULES.CPP init_match_mode/reset_all_ideas without inventing an action reset. */
function preparePlayersForPostGoalCentre(players, targets, nextTick) {
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const reset = resetPlayersForCurrentCentre(players, targets, nextTick);
  return players.map((source, index) => {
    const target = targetById.get(source.id);
    if (target === undefined) throw new Error(`Post-goal centre lost player ${source.id}.`);
    if (source.liveMotion === undefined) {
      throw new Error(`Post-goal centre lost current source motion for ${source.id}.`);
    }
    if (!retainsPostGoalCentreAction(source)) return reset[index];
    const player = clone(source);
    // BALL.CPP reset_shot clears the global shot_pending state. The physical
    // player action and its go_* fields remain owned by process_teams.
    delete player.livePendingShot;
    return {
      ...player,
      role: target.role,
      intelligence: { special: 0, move: 0, count: 0 },
    };
  });
}

function retainsPostGoalCentreJourney(player) {
  return player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
    && player.liveMotion !== undefined
    && player.liveMotion.goCount > 0
    && (
      player.liveMotion.kind === "support-run"
      || player.liveMotion.kind === "run-with-ball"
      || player.liveMotion.kind === "offside-runback"
    );
}

function retainsPostGoalCentreAction(player) {
  return retainsPostGoalCentreJourney(player)
    || blocksPostGoalCentrePositioning(player);
}

function blocksPostGoalCentrePositioning(player) {
  return player.liveContact !== undefined
    || player.liveControlIntercept !== undefined
    || player.liveFirstTimeIntercept !== undefined
    || player.liveKeeper !== undefined
    || player.livePass !== undefined
    || player.liveRestart !== undefined
    || player.liveShot !== undefined;
}

/** ACTIONS.CPP someone_has_scored -> scorer_go/go_to_scorer/player_shame. */
function stepGoalCelebrationPlayers(match, nextTick, events) {
  if (match.goal.phase === "awaiting-post-goal-handoff") {
    if (!match.players.some((player) => player.liveCelebration !== undefined)) return match;
    return {
      ...match,
      players: match.players.map((player) => settleGoalPlayer(player, match, nextTick)),
    };
  }
  if (match.goal.phase !== "celebration") return match;
  const activeGoal = match.goal.activeGoal;
  const scorer = match.players.find(({ id }) => id === activeGoal.scorer.playerId);
  if (scorer === undefined) throw new Error("Goal celebration lost the live scorer.");
  const starting = scorer.liveCelebration?.goalSequence !== match.goal.goalSequence;
  // A scorer whose kick animation ends on the crossing tick first executes
  // kick_action -> init_stand_act. stand_action observes just_scored and
  // starts scorer_go on the following source visit.
  const scorerFinishesKick = starting
    && scorer.action.action.value === CSSOCCER_NATIVE_ACTIONS.KICK
    && scorer.liveShot?.phase === "shot-released";
  if (starting && !scorerFinishesKick) {
    events.push({
      type: "goal-celebration-started",
      tick: nextTick,
      goalSequence: match.goal.goalSequence,
      scorerId: scorer.id,
      ownGoal: activeGoal.ownGoal,
    });
  }
  let rng = match.rng.state;
  let scorerFrame = scorer;
  // go_team calls process_anims before intelligence/do_action. A player still
  // bound by a fall/get-up limbo therefore cannot reach someone_has_scored;
  // when process_anims clears that limbo, the newly installed STAND action
  // can enter the celebration later in the same source visit.
  const contactedMatch = advanceOpenPlayContactActions(match, nextTick);
  const contactedById = new Map(contactedMatch.players.map((player) => [
    player.id,
    player,
  ]));
  const players = match.players.map((sourcePlayer) => {
    let player = sourcePlayer;
    if (
      sourcePlayer.liveContact !== undefined
      && sourcePlayer.liveContact.phase !== "barge"
    ) {
      player = contactedById.get(sourcePlayer.id);
      if (player.liveContact !== undefined) {
        return stepOpenPlayContactAnimation(player, contactedMatch, nextTick);
      }
    }
    const entered = player.role === "keeper" && player.liveKeeper !== undefined
      ? player
      : advanceGoalEntryRunAction(player, match);
    if (
      entered.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
      && (
        entered.liveMotion?.goCount
        ?? entered.liveCelebration?.goCount
      ) === 0
      && entered.liveFirstTimeIntercept?.phase === "run"
    ) {
      // The old first-touch RUN reaches init_strike_act before this visit can
      // enter someone_has_scored. Its corrected post-goal prediction is no
      // longer reachable, so init_first_time_act settles to STAND; celebration
      // routing begins from stand_action on the following player visit.
      const settled = settleGoalPlayer(entered, match, nextTick);
      delete settled.liveFirstTimeIntercept;
      return settled;
    }
    if (activeGoal.ownGoal) {
      return entered.id === scorer.id
        ? stepGoalShamePlayer(entered, match.goal.goalSequence, nextTick)
        : settleGoalPlayer(entered, match, nextTick);
    }
    if (entered.id === scorer.id) {
      if (scorerFinishesKick) {
        return stepOpenPlayKickAnimation(entered, match, nextTick);
      }
      const stepped = stepGoalScorerPlayer(entered, { ...match, rng: { ...match.rng, state: rng } }, nextTick);
      rng = stepped.rng;
      scorerFrame = stepped.player;
      return scorerFrame;
    }
    // ACTIONS.CPP someone_has_scored does not interrupt a non-scoring
    // goalkeeper's current save, grounded recovery, or held-ball action.
    // keeper_boxes has already advanced that action for this logic tick.
    if (entered.role === "keeper" && entered.liveKeeper !== undefined) {
      return entered;
    }
    if (entered.country === activeGoal.scoringCountry && entered.role !== "keeper") {
      const stepped = stepGoalTeammatePlayer(
        entered,
        scorerFrame,
        { ...match, rng: { ...match.rng, state: rng } },
        nextTick,
      );
      rng = stepped.rng;
      return stepped.player;
    }
    return settleGoalPlayer(entered, match, nextTick);
  });
  return { ...match, rng: { ...match.rng, state: rng }, players };
}

/** ACTIONS.CPP intelligence -> run_action before someone_has_scored. */
function advanceGoalEntryRunAction(source, match) {
  if (
    source.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
    || source.liveMotion === undefined
  ) return source;
  let goCount = source.liveMotion.goCount;
  let intelligence = clone(source.intelligence);
  if (intelligence.count !== 0) {
    const remaining = intelligence.count - 1;
    if (remaining === 0) {
      if (intelligence.move === 1) goCount = 1;
      intelligence = { special: 0, move: 0, count: 0 };
    } else {
      intelligence.count = remaining;
    }
  }
  if (goCount === 0) {
    return { ...clone(source), intelligence };
  }
  let displacement = { x: F32(0), y: F32(0) };
  let goStop = source.liveMotion.goStop === true;
  if (source.liveMotion.directionMode !== 6) {
    if (source.liveMotion.goStep === true) {
      displacement = clone(source.liveMotion.goDisplacement);
    } else if (goStop) {
      const maxTurnRadians = projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate: source.liveMotion.teamRate },
      ).maxTurnRadians;
      if (
        sourceAngleCosine({
          target: source.liveMotion.goDisplacement,
          facing: source.facing,
        }) >= Math.cos(maxTurnRadians)
      ) {
        goStop = false;
        displacement = clone(source.liveMotion.goDisplacement);
      }
    } else {
      const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
        .find(({ id }) => id === source.id)?.value;
      if (!Number.isSafeInteger(teamRate)) {
        throw new Error(`Goal entry run lost current team rate for ${source.id}.`);
      }
      const speed = actualPlayerSpeed({
        pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
        teamRate,
        speedIntent: intelligence.move === 1
          ? CSSOCCER_SPEED_INTENT.intercept
          : CSSOCCER_SPEED_INTENT.normal,
        intentionCount: intelligence.count,
        sideStep: false,
        nativePlayer: source.nativePlayerNumber,
        ballPossession: match.possession.owner,
        ballInHands: match.possession.inHands !== 0,
        keeperNativePlayers: [1, 12],
        userControlIndex: 0,
        burstTimer: 0,
      });
      displacement = sourceForwardDisplacement({
        facing: source.facing,
        targetOffset: {
          x: F32(source.liveMotion.target.x - source.position.x),
          y: F32(source.liveMotion.target.y - source.position.y),
        },
        speed,
      }).displacement;
    }
  }
  return {
    ...clone(source),
    previousPosition: clone(source.position),
    position: {
      ...updateSourcePosition2d({
        position: { x: source.position.x, y: source.position.y },
        displacement,
      }),
      z: source.position.z,
    },
    velocity: { ...clone(displacement), z: F32(0) },
    intelligence,
    liveMotion: {
      ...clone(source.liveMotion),
      goStop,
      goCount: Math.max(0, goCount - 1),
      goDisplacement: clone(displacement),
    },
  };
}

function stepGoalScorerPlayer(source, match, nextTick) {
  const goalSequence = match.goal.goalSequence;
  const current = source.liveCelebration?.goalSequence === goalSequence
    ? clone(source)
    : null;
  if (current === null) {
    const player = clearLivePlayerActions(source);
    const vectorRng = advanceCssoccerNativeRng(match.rng.state);
    let angle = (vectorRng.randSeed & 32767) << 1;
    if (angle > 32767) angle -= 65536;
    const quotient = angle / Math.PI;
    const fractionalAngle = F32(quotient - Math.trunc(quotient));
    const randomX = F32(Math.cos(fractionalAngle));
    const randomY = F32(Math.sin(fractionalAngle));
    const runDistance = F32(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 13,
    );
    let targetX = F32(player.position.x + (randomX * runDistance));
    let targetY = F32(player.position.y + (randomY * runDistance));
    if (targetX < 0) {
      targetX = targetX < -runDistance
        ? targetX
        : F32(player.position.x + (player.position.x - targetX));
    }
    if (targetX > CSSOCCER_BALL_CONSTANTS.pitchLength) {
      targetX = targetX > CSSOCCER_BALL_CONSTANTS.pitchLength + runDistance
        ? targetX
        : F32(player.position.x + (player.position.x - targetX));
    }
    if (targetY < 0) {
      targetY = targetY < -runDistance
        ? targetY
        : F32(player.position.y + (player.position.y - targetY));
    }
    if (targetY > CSSOCCER_BALL_CONSTANTS.pitchWidth) {
      targetY = targetY > CSSOCCER_BALL_CONSTANTS.pitchWidth + runDistance
        ? targetY
        : F32(player.position.y + (player.position.y - targetY));
    }
    const target = { x: targetX, y: targetY };
    const offset = {
      x: F32(target.x - player.position.x),
      y: F32(target.y - player.position.y),
    };
    const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
      .find(({ id }) => id === player.id)?.value;
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Goal scorer lost current team rate for ${player.id}.`);
    }
    const motionProfile = projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    );
    const travelProfile = projectCssoccerTravelSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    );
    const speed = motionProfile.celebrationSpeed;
    const travel = sourceGetThereTime({
      position: { x: player.position.x, y: player.position.y },
      target,
      facing: player.facing,
      speed,
      maxTurn2Radians: travelProfile.maxTurn2Radians,
      imThereDistance: travelProfile.imThereDistance,
      canRotateAndRun: true,
      mustFace: null,
    });
    const goCount = travel.ticks;
    const goDisplacement = {
      x: F32(offset.x / goCount),
      y: F32(offset.y / goCount),
    };
    const animationRng = advanceCssoccerNativeRng(vectorRng);
    const animation = (animationRng.seed & 1) === 0 ? 109 : 108;
    const frameStep = animation === 109 ? F32(2 / 27) : F32(2 / 45);
    const facing = turnSourceFacing({
      facing: player.facing,
      target: offset,
      maxTurnRadians: motionProfile.maxTurnRadians,
    }).facing;
    return {
      rng: animationRng,
      player: {
        ...player,
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        facing,
        velocity: { x: F32(0), y: F32(0), z: F32(0) },
        target: { x: target.x, y: target.y, z: F32(0) },
        targetOwner: "ACTIONS.CPP init_celeb_act scorer run",
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          facingX: facing.x,
          facingY: facing.y,
        }),
        animation: {
          status: "browser-current-state",
          kind: animation === 109 ? "goal-finger-run" : "goal-plane-run",
          id: animation,
          sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          frame: F32(0),
          frameStep,
          pending: null,
          tick: nextTick,
        },
        intelligence: { special: 0, move: 16, count: goCount + 1 },
        liveCelebration: {
          goalSequence,
          phase: "scorer-run",
          target,
          displacement: goDisplacement,
          goCount,
          teamRate,
        },
      },
    };
  }
  const live = current.liveCelebration;
  if (live.phase === "scorer-run") {
    const motionProfile = projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate: live.teamRate },
    );
    const targetOffset = {
      x: F32(live.target.x - current.position.x),
      y: F32(live.target.y - current.position.y),
    };
    const displacement = sourceForwardDisplacement({
      facing: current.facing,
      targetOffset,
      speed: motionProfile.celebrationSpeed,
    }).displacement;
    const planar = updateSourcePosition2d({
      position: { x: current.position.x, y: current.position.y },
      displacement,
    });
    const turnedFacing = turnSourceFacing({
      facing: current.facing,
      target: {
        x: F32(live.target.x - planar.x),
        y: F32(live.target.y - planar.y),
      },
      maxTurnRadians: motionProfile.maxTurnRadians,
    }).facing;
    const goCount = live.goCount - 1;
    if (goCount <= 0) {
      const choiceRng = advanceCssoccerNativeRng(match.rng.state);
      const knee = (choiceRng.seed & 2) !== 0;
      const tauntRng = knee
        ? choiceRng
        : advanceCssoccerNativeRng(choiceRng);
      const taunt = knee
        ? {
            animation: GOAL_KNEE_ANIMATION,
            frameStep: GOAL_KNEE_FRAME_STEP,
            displacement: {
              x: F32(current.facing.x * 3),
              y: F32(current.facing.y * 3),
            },
            goCount: Math.trunc(1 / GOAL_KNEE_FRAME_STEP),
            phase: "knee",
          }
        : {
            ...GOAL_TAUNTS[Math.trunc(tauntRng.seed * 4 / 128)],
            displacement: { x: F32(0), y: F32(0) },
            goCount: 0,
            phase: "scorer-taunt",
          };
      return {
        rng: tauntRng,
        player: {
          ...current,
          previousPosition: clone(current.position),
          previousFacing: clone(current.facing),
          position: { ...planar, z: current.position.z },
          facing: clone(current.facing),
          velocity: { ...clone(taunt.displacement), z: F32(0) },
          action: createCssoccerActionState({
            tick: nextTick,
            playerId: current.id,
            actionId: GOAL_CELEBRATION_ACTION,
            facingX: current.facing.x,
            facingY: current.facing.y,
          }),
          animation: {
            status: "browser-current-state",
            kind: `goal-${taunt.phase}`,
            id: taunt.animation,
            sourceActionId: GOAL_CELEBRATION_ACTION,
            frame: F32(0),
            frameStep: taunt.frameStep,
            pending: null,
            tick: nextTick,
          },
          intelligence: {
            ...clone(current.intelligence),
            count: current.intelligence.count - 1,
          },
          liveCelebration: {
            ...clone(live),
            phase: taunt.phase,
            displacement: taunt.displacement,
            goCount: taunt.goCount,
          },
        },
      };
    }
    return {
      rng: match.rng.state,
      player: {
        ...current,
        previousPosition: clone(current.position),
        previousFacing: clone(current.facing),
        position: { ...planar, z: current.position.z },
        facing: turnedFacing,
        velocity: { ...clone(displacement), z: F32(0) },
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: current.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          facingX: turnedFacing.x,
          facingY: turnedFacing.y,
        }),
        animation: {
          ...clone(current.animation),
          frame: F32(current.animation.frame + current.animation.frameStep),
          tick: nextTick,
        },
        intelligence: {
          ...clone(current.intelligence),
          count: current.intelligence.count - 1,
        },
        liveCelebration: {
          ...clone(live),
          displacement,
          goCount,
        },
      },
    };
  }
  return stepGoalCelebrationAction(current, match, nextTick);
}

/** ACTIONS.CPP celeb_action for scorer and teammate taunts alike. */
function stepGoalCelebrationAction(source, match, nextTick) {
  const current = clone(source);
  const live = current.liveCelebration;
  let position = clone(current.position);
  let displacement = clone(live.displacement);
  let phase = live.phase;
  let goCount = live.goCount;
  let animation = current.animation.id;
  let frameStep = current.animation.frameStep;
  const planar = updateSourcePosition2d({
    position: { x: position.x, y: position.y },
    displacement,
  });
  position = { ...planar, z: position.z };
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
    rng: match.rng.state,
    player: {
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
    },
  };
}

function stepGoalTeammatePlayer(source, scorer, match, nextTick) {
  if (
    source.liveCelebration?.goalSequence === match.goal.goalSequence
    && (
      source.liveCelebration.phase === "knee"
      || source.liveCelebration.phase === "duck"
      || source.liveCelebration.phase === "moon"
    )
  ) {
    return stepGoalCelebrationAction(source, match, nextTick);
  }
  if (
    source.liveCelebration?.goalSequence === match.goal.goalSequence
    && source.liveCelebration.phase === "taunt"
  ) {
    const player = clone(source);
    const intelligenceCount = Math.max(0, player.intelligence.count - 1);
    return {
      rng: match.rng.state,
      player: {
        ...player,
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        velocity: { x: F32(0), y: F32(0), z: F32(0) },
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: GOAL_CELEBRATION_ACTION,
          facingX: player.facing.x,
          facingY: player.facing.y,
        }),
        animation: {
          ...clone(player.animation),
          frame: F32(player.animation.frame + player.animation.frameStep),
          tick: nextTick,
        },
        intelligence: {
          ...clone(player.intelligence),
          move: intelligenceCount === 0 ? 0 : player.intelligence.move,
          count: intelligenceCount,
        },
      },
    };
  }
  if (
    source.liveCelebration?.goalSequence === match.goal.goalSequence
    && source.liveCelebration.phase === "teammate-run"
  ) {
    const player = clone(source);
    const live = player.liveCelebration;
    const motionProfile = projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate: live.teamRate },
    );
    const targetOffset = {
      x: F32(live.target.x - player.position.x),
      y: F32(live.target.y - player.position.y),
    };
    const displacement = live.goStep
      ? clone(live.displacement)
      : sourceForwardDisplacement({
          facing: player.facing,
          targetOffset,
          speed: motionProfile.celebrationSpeed,
        }).displacement;
    const planar = updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement,
    });
    const turnedFacing = turnSourceFacing({
      facing: player.facing,
      target: live.goStep && live.directionMode === 1
        ? {
            x: F32(match.ball.ball.position.x - planar.x),
            y: F32(match.ball.ball.position.y - planar.y),
          }
        : {
            x: F32(live.target.x - planar.x),
            y: F32(live.target.y - planar.y),
          },
      maxTurnRadians: motionProfile.maxTurnRadians,
    }).facing;
    const goCount = live.goCount - 1;
    // run_action installs init_taunt_act as soon as the final go_forward has
    // completed. Its dir_mode=2 prevents process_dir from applying one more
    // target turn on that publication tick.
    const facing = goCount > 0 ? turnedFacing : clone(player.facing);
    const intelligenceCount = player.intelligence.count - 1;
    if (goCount <= 0) {
      return {
        rng: match.rng.state,
        player: startGoalTeammateTaunt({
          player: {
          ...player,
          previousPosition: clone(player.position),
          previousFacing: clone(player.facing),
          position: { ...planar, z: player.position.z },
          facing,
          intelligence: {
            ...clone(player.intelligence),
            count: intelligenceCount,
          },
          },
          scorer,
          goalSequence: match.goal.goalSequence,
          nextTick,
        }),
      };
    }
    return {
      rng: match.rng.state,
      player: {
        ...player,
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        position: { ...planar, z: player.position.z },
        facing,
        velocity: { ...clone(displacement), z: F32(0) },
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          facingX: facing.x,
          facingY: facing.y,
        }),
        animation: {
          ...clone(player.animation),
          frame: F32(player.animation.frame + player.animation.frameStep),
          tick: nextTick,
        },
        intelligence: {
          ...clone(player.intelligence),
          count: intelligenceCount,
        },
        liveCelebration: {
          ...clone(live),
          displacement,
          goCount,
        },
      },
    };
  }

  const player = clearLivePlayerActions(source);
  const scorerOffset = {
    x: F32(scorer.position.x - player.position.x),
    y: F32(scorer.position.y - player.position.y),
  };
  const distance = sourceDistance2d(scorerOffset);
  const localNumber = player.nativePlayerNumber > 11
    ? player.nativePlayerNumber - 11
    : player.nativePlayerNumber;
  if (distance < 8 + (localNumber * 6)) {
    if (scorer.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN) {
      return {
        rng: match.rng.state,
        player: startGoalTeammateTaunt({
          player,
          scorer,
          goalSequence: match.goal.goalSequence,
          nextTick,
        }),
      };
    }
    const xRng = advanceCssoccerNativeRng(match.rng.state);
    const targetX = F32(
      scorer.position.x + Math.trunc((xRng.seed - 64) / 2),
    );
    const yRng = advanceCssoccerNativeRng(xRng);
    const targetY = F32(
      scorer.position.y + Math.trunc((yRng.seed - 64) / 2),
    );
    const animationRng = advanceCssoccerNativeRng(yRng);
    const target = { x: targetX, y: targetY };
    const offset = {
      x: F32(target.x - player.position.x),
      y: F32(target.y - player.position.y),
    };
    const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
      .find(({ id }) => id === player.id)?.value;
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Goal teammate lost current team rate for ${player.id}.`);
    }
    const motionProfile = projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    );
    const travelProfile = projectCssoccerTravelSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    );
    const runDistance = sourceDistance2d(offset);
    const alignment = sourceAngleCosine({ target: offset, facing: player.facing });
    let retainedStep = source.liveCelebration?.phase === "approach-scorer"
      && source.liveCelebration.goStep === true;
    let directionMode = 1;
    if (alignment >= Math.cos(motionProfile.maxTurnRadians)) {
      retainedStep = false;
      directionMode = 0;
    }
    const goStep = (retainedStep && runDistance < travelProfile.stepRange * 2)
      || (!retainedStep && runDistance < travelProfile.stepRange);
    const goCount = goStep
      ? Math.trunc(runDistance / motionProfile.celebrationSpeed + 1)
      : sourceGetThereTime({
          position: { x: player.position.x, y: player.position.y },
          target,
          facing: player.facing,
          speed: motionProfile.celebrationSpeed,
          maxTurn2Radians: travelProfile.maxTurn2Radians,
          imThereDistance: travelProfile.imThereDistance,
          canRotateAndRun: true,
          mustFace: null,
        }).ticks;
    const goDisplacement = {
      x: F32(offset.x / goCount),
      y: F32(offset.y / goCount),
    };
    const facing = turnSourceFacing({
      facing: player.facing,
      target: goStep && directionMode === 1
        ? {
            x: F32(match.ball.ball.position.x - player.position.x),
            y: F32(match.ball.ball.position.y - player.position.y),
          }
        : offset,
      maxTurnRadians: motionProfile.maxTurnRadians,
    }).facing;
    return {
      rng: animationRng,
      player: {
        ...player,
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        facing,
        velocity: { x: F32(0), y: F32(0), z: F32(0) },
        target: { x: target.x, y: target.y, z: F32(0) },
        targetOwner: "ACTIONS.CPP init_celeb_act teammate run",
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          facingX: facing.x,
          facingY: facing.y,
        }),
        animation: {
          status: "browser-current-state",
          kind: "goal-finger-run",
          id: 109,
          sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          frame: F32(0),
          frameStep: F32(2 / 27),
          pending: null,
          tick: nextTick,
        },
        intelligence: { special: 0, move: 16, count: goCount + 1 },
        liveCelebration: {
          goalSequence: match.goal.goalSequence,
          phase: "teammate-run",
          target,
          displacement: goDisplacement,
          goCount,
          teamRate,
          goStep,
          directionMode: goStep ? directionMode : 0,
        },
      },
    };
  }

  const rate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(rate)) throw new Error("Goal runner lost its current team rate.");
  const motionProfile = projectCssoccerMotionSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate: rate },
  );
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate: rate },
  );
  const alignment = sourceAngleCosine({
    target: scorerOffset,
    facing: player.facing,
  });
  let retainedStep = source.liveCelebration?.phase === "approach-scorer"
    && source.liveCelebration.goStep === true;
  let directionMode = 1;
  if (alignment >= Math.cos(motionProfile.maxTurnRadians)) {
    retainedStep = false;
    directionMode = 0;
  }
  const goStep = (retainedStep && distance < travelProfile.stepRange * 2)
    || (!retainedStep && distance < travelProfile.stepRange);
  const speed = actualPlayerSpeed({
    pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
    teamRate: rate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: goStep,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: 0,
    ballInHands: false,
    keeperNativePlayers: [1, 12],
    userControlIndex: 0,
    burstTimer: 0,
  });
  const initialGoCount = goStep ? Math.trunc(distance / speed + 1) : 0;
  const displacement = goStep
    ? {
        x: F32(scorerOffset.x / initialGoCount),
        y: F32(scorerOffset.y / initialGoCount),
      }
    : sourceForwardDisplacement({
        facing: player.facing,
        targetOffset: scorerOffset,
        speed,
      }).displacement;
  const planar = updateSourcePosition2d({
    position: { x: player.position.x, y: player.position.y },
    displacement,
  });
  const facing = turnSourceFacing({
    facing: player.facing,
    target: goStep && directionMode === 1
      ? {
          x: F32(match.ball.ball.position.x - planar.x),
          y: F32(match.ball.ball.position.y - planar.y),
        }
      : {
          x: F32(scorer.position.x - planar.x),
          y: F32(scorer.position.y - planar.y),
        },
    maxTurnRadians: motionProfile.maxTurnRadians,
  }).facing;
  const frameStep = goStep
    ? F32(speed * SIDE_STEP_FRAME_STEP / 2)
    : F32(RUN_FRAME_STEP * speed / RUN_REFERENCE_SPEED);
  const retainedBargeCountdown = (
    !goStep
    && source.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
    && source.animation.id === BARGE_ANIMATION
    && source.liveContact?.phase === "barge"
    && source.liveContact.bargeCountdown > 1
  )
    ? source.liveContact.bargeCountdown - 1
    : 0;
  const priorTrot = player.animation.kind === "goal-trot-to-scorer";
  const animationId = retainedBargeCountdown > 0
    ? BARGE_ANIMATION
    : goStep
    ? TROT_ANIMATION_BY_DIRECTION[sourceSideStepDirection({
        target: scorer.position,
        previousPosition: player.position,
        previousFacing: player.facing,
      })]
    : RUN_ANIMATION;
  return {
    rng: match.rng.state,
    player: {
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
        kind: retainedBargeCountdown > 0
          ? "barge"
          : goStep ? "goal-trot-to-scorer" : "goal-run-to-scorer",
        id: animationId,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
        frame: retainedBargeCountdown > 0
          ? F32(player.animation.frame + player.animation.frameStep)
          : (goStep && priorTrot) || (!goStep && player.animation.id === RUN_ANIMATION)
          ? F32(player.animation.frame + player.animation.frameStep)
          : F32(0),
        frameStep: retainedBargeCountdown > 0
          ? player.animation.frameStep
          : frameStep,
        pending: null,
        tick: nextTick,
      },
      ...(retainedBargeCountdown > 0
        ? {
            liveContact: {
              ...clone(source.liveContact),
              bargeCountdown: retainedBargeCountdown,
            },
          }
        : {}),
      liveCelebration: {
        goalSequence: match.goal.goalSequence,
        phase: "approach-scorer",
        displacement,
        goCount: 0,
        goStep,
        directionMode: goStep ? directionMode : 0,
      },
    },
  };
}

function startGoalTeammateTaunt({
  player,
  scorer,
  goalSequence,
  nextTick,
}) {
  let animation = GOAL_CELEBRATION_ANIMATION;
  let frameStep = GOAL_CELEBRATION_FRAME_STEP;
  let phase = "taunt";
  let displacement = { x: F32(0), y: F32(0) };
  let goCount = 0;
  if (
    scorer.animation.id === GOAL_KNEE_ANIMATION
    || scorer.animation.id === GOAL_DUCK_ANIMATION
  ) {
    animation = GOAL_KNEE_ANIMATION;
    frameStep = GOAL_KNEE_FRAME_STEP;
    phase = "knee";
    displacement = {
      x: F32(player.facing.x * 3),
      y: F32(player.facing.y * 3),
    };
    goCount = Math.trunc(1 / GOAL_KNEE_FRAME_STEP);
  } else if (
    scorer.animation.id >= GOAL_KNEE_ANIMATION
    && scorer.animation.id <= GOAL_TAUNTS[0].animation
  ) {
    animation = scorer.animation.id;
    frameStep = scorer.animation.frameStep;
    if (animation === GOAL_MOON_ANIMATION) {
      phase = "moon";
      displacement = {
        x: F32(-player.facing.x),
        y: F32(-player.facing.y),
      };
    }
  }
  return {
    ...player,
    velocity: { ...clone(displacement), z: F32(0) },
    intelligence: { special: 0, move: 0, count: 0 },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: GOAL_CELEBRATION_ACTION,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: `goal-${phase}`,
      id: animation,
      sourceActionId: GOAL_CELEBRATION_ACTION,
      frame: F32(0),
      frameStep,
      pending: null,
      tick: nextTick,
    },
    liveCelebration: {
      goalSequence,
      phase,
      displacement,
      goCount,
      goStep: player.liveCelebration?.goStep ?? false,
      directionMode: 2,
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

function settleGoalPlayer(source, match, nextTick) {
  const goalGoStep = source.liveMotion?.goStep
    ?? source.liveCelebration?.goStep
    ?? source.goalGoStep
    ?? false;
  const player = clearLivePlayerActions(source);
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Goal stand lost current team rate for ${player.id}.`);
  }
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(match.ball.ball.position.x - player.position.x),
      y: F32(match.ball.ball.position.y - player.position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians,
  }).facing;
  return {
    ...player,
    ...(player.sourceHeldBallTween?.freeTime < -1
      ? {
          sourceHeldBallTween: {
            ...clone(player.sourceHeldBallTween),
            // celeb_action -> init_stand_act retains this zero-height
            // capture as ls_anim/ls_frm for a later get_mcball_coords call.
            zeroHeightCapture: true,
          },
        }
      : {}),
    goalGoStep,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    facing,
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
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
      // someone_has_scored re-enters init_stand_act every logic tick for a
      // non-celebrating outfield player, and init_anim(MC_STAND) resets tm_frm.
      frame: F32(0),
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

// ACTIONS.OBJ save_offs[] and Andys Defines.h are the immutable native
// authorities for init_save_act. Every save animation has its own body-contact
// offset; using the complete table keeps this path source-driven for both
// keepers and every A/B/C save zone.
const KEEPER_SAVE_MOTION_BY_ANIMATION = Object.freeze({
  0: keeperSaveMotion([0.7099400162696838, -3.4357309341430664, 4.1858601570129395], 29, 23, false),
  1: keeperSaveMotion([9.905818939208984, -0.07712399959564209, 6.026725769042969], 48, 86, true),
  2: keeperSaveMotion([10.294174194335938, 0.9791859984397888, 23.075416564941406], 24, 53 * 24 / 54, false),
  3: keeperSaveMotion([5.498808860778809, 0.1583849936723709, 14.893182754516602], 39, 43, false),
  4: keeperSaveMotion([4.75960111618042, 1.3262070417404175, 30.413463592529297], 48, 27 * 48 / 65, false),
  5: keeperSaveMotion([3.935059070587158, -1.2175439596176147, 28.926258087158203], 65, 46, false),
  6: keeperSaveMotion([-2.24249005317688, 1.3752659559249878, 34.64471435546875], 44, 28, false),
  7: keeperSaveMotion([7.307344913482666, 0.9738240242004395, 32.67900085449219], 62, 38, false),
  8: keeperSaveMotion([1.5571999549865723, 7.858088970184326, 2.197618007659912], 52, 21, false),
  9: keeperSaveMotion([1.5571999549865723, -7.858088970184326, 2.197618007659912], 52, 21, false),
  10: keeperSaveMotion([9.325319290161133, 6.036806106567383, 6.550961017608643], 86, 42, true),
  11: keeperSaveMotion([9.325319290161133, -6.036806106567383, 6.550961017608643], 86, 42, true),
  12: keeperSaveMotion([7.701114177703857, 9.460480690002441, 15.907917022705078], 29, 27, true),
  13: keeperSaveMotion([7.701114177703857, -9.460480690002441, 15.907917022705078], 29, 27, true),
  14: keeperSaveMotion([9.994144439697266, 8.01347541809082, 18.689754486083984], 57, 43, true),
  15: keeperSaveMotion([9.994144439697266, -8.01347541809082, 18.689754486083984], 57, 43, true),
  16: keeperSaveMotion([3.021265983581543, 11.620670318603516, 28.995437622070312], 36, 32, false),
  17: keeperSaveMotion([3.021265983581543, -11.620670318603516, 28.995437622070312], 36, 32, false),
  18: keeperSaveMotion([5.168231964111328, 10.866352081298828, 27.930614471435547], 48, 36, false),
  19: keeperSaveMotion([5.168231964111328, -10.866352081298828, 27.930614471435547], 48, 36, false),
  20: keeperSaveMotion([3.5275630950927734, 7.418458938598633, 31.247488021850586], 60, 36, false),
  21: keeperSaveMotion([3.5275630950927734, -7.418458938598633, 31.247488021850586], 60, 36, false),
  22: keeperSaveMotion([8.994329452514648, 8.942190170288086, 8.369625091552734], 89, 49, true),
  23: keeperSaveMotion([8.994329452514648, -8.942190170288086, 8.369625091552734], 89, 49, true),
  24: keeperSaveMotion([9.596200942993164, 9.635643005371094, 7.790135860443115], 109, 50, true),
  25: keeperSaveMotion([9.596200942993164, -9.635643005371094, 7.790135860443115], 109, 50, true),
  26: keeperSaveMotion([8.339292526245117, 10.38150691986084, 17.211002349853516], 51, 45 * 51 / 68, true),
  27: keeperSaveMotion([8.339292526245117, -10.38150691986084, 17.211002349853516], 51, 45 * 51 / 68, true),
  28: keeperSaveMotion([8.60942554473877, 12.692826271057129, 20.248947143554688], 70, 48, true),
  29: keeperSaveMotion([8.60942554473877, -12.692826271057129, 20.248947143554688], 70, 48, true),
  30: keeperSaveMotion([4.034877777099609, 14.803577423095703, 26.213153839111328], 89, 44, false),
  31: keeperSaveMotion([4.034877777099609, -14.803577423095703, 26.213153839111328], 89, 44, false),
  32: keeperSaveMotion([3.216027021408081, 10.80746078491211, 32.28449630737305], 82, 47, false),
  33: keeperSaveMotion([3.216027021408081, -10.80746078491211, 32.28449630737305], 82, 47, false),
});

function keeperSaveMotion(offset, contactNumerator, effectiveFrames, keeperOnGround) {
  return Object.freeze({
    storedOffset: Object.freeze({
      x: F32(offset[0]),
      y: F32(offset[1]),
      z: F32(offset[2]),
    }),
    // SAVE_*_TIME is numerator * SAVE_SPEED / 120, with SAVE_SPEED=20.
    saveTime: contactNumerator * 20 / 120,
    baseFrameStep: 1 / (20 * effectiveFrames / 40),
    keeperOnGround,
  });
}

function processKeeperBoxes(
  match,
  nextTick,
  events,
  sourcePredictionState,
  sourcePlayerDistanceFrame,
) {
  const keeperIds = match.players
    .filter(({ role }) => role === "keeper")
    .map(({ id }) => id);
  if (keeperIds.length !== 2) throw new Error("keeper_boxes requires both current goalkeepers.");
  let ball = match.ball;
  let possession = match.possession;
  let rng = match.rng.state;
  let players = match.players;
  let rules = match.rules;
  for (const keeperId of keeperIds) {
    const keeperIndex = players.findIndex(({ id }) => id === keeperId);
    let keeper = players[keeperIndex];
    if (keeper.liveKeeper?.phase === "recovered") {
      keeper = clone(keeper);
      delete keeper.liveKeeper;
      players = replacePlayer(players, keeperIndex, keeper);
      continue;
    }
    if (keeper.liveKeeper?.phase === "punt-stand-cleared") {
      // A rebound after this keeper's preceding go_team visit cleared the
      // source shot_pending global. The keeper can resume ordinary zonal
      // intelligence on the following visit.
      keeper = clone(keeper);
      delete keeper.liveKeeper;
      players = replacePlayer(players, keeperIndex, keeper);
      continue;
    }
    if (keeper.liveKeeper?.phase === "recover") {
      keeper = continueKeeperGroundRecovery({
        ballPosition: ball.ball.position,
        keeper,
        nextTick,
        possession,
      });
      players = replacePlayer(players, keeperIndex, keeper);
      continue;
    }
    if (keeper.liveKeeper?.phase === "hold-run") {
      const opponentsNearHolder = players.filter((candidate) => (
        candidate.active
        && (candidate.nativePlayerNumber < 12) !== (keeper.nativePlayerNumber < 12)
        && sourceDistance2d({
          x: F32(candidate.position.x - ball.ball.position.x),
          y: F32(candidate.position.y - ball.ball.position.y),
        }) <= F32(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 13,
        )
      )).length;
      const puntDecision = (
        possession.owner === keeper.nativePlayerNumber
        && possession.inHands === 1
      )
        ? resolveCssoccerPuntDecision({
            ball: {
              x: ball.ball.position.x,
              y: ball.ball.position.y,
            },
            firstTime: false,
            holder: liveShotHolder(keeper),
            mustPunt: keeper.liveKeeper.mustPunt === true,
            opponentsNearHolder,
            seed: rng.seed,
            userControlled: keeper.id === match.control.activePlayerId,
          })
        : null;
      if (puntDecision?.outcome === "punt") {
        const punt = beginKeeperHandsPunt({
          ball,
          keeper,
          nextTick,
          possession,
          rng,
          sourcePredictionState,
        });
        ball = punt.ball;
        keeper = punt.keeper;
        possession = punt.possession;
        rng = punt.rng;
        players = replacePlayer(players, keeperIndex, keeper);
        events.push({
          type: "keeper-punt-released",
          tick: nextTick,
          playerId: keeper.id,
          nativePlayerNumber: keeper.nativePlayerNumber,
        });
        continue;
      }
      keeper = continueKeeperHoldRun(keeper, nextTick, possession);
      if (keeper.liveKeeper.runSteps >= 15) {
        // run_action exhausts keeper_steps after this final carried step.
        // The global clears immediately for later player visits, while
        // must_punt is consumed on the following keeper intelligence visit.
        keeper = {
          ...keeper,
          liveKeeper: { ...keeper.liveKeeper, mustPunt: true },
        };
        rules = { ...rules, gameAction: 0 };
      }
      players = replacePlayer(players, keeperIndex, keeper);
      continue;
    }
    if (keeper.liveKeeper?.phase === "punt-limbo") {
      keeper = keeper.liveKeeper.animationLimbo <= 1
        ? continueKeeperPuntStand(keeper, nextTick, ball.ball.position)
        : continueKeeperKickout(keeper, nextTick);
      players = replacePlayer(players, keeperIndex, keeper);
      continue;
    }
    if (keeper.liveKeeper?.phase === "punt-stand") {
      keeper = continueKeeperPuntStand(keeper, nextTick, ball.ball.position);
      players = replacePlayer(players, keeperIndex, keeper);
      continue;
    }
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
      if (
        keeper.sourceKeeperStandTick === nextTick
        && match.goal.phase === "celebration"
      ) {
        // save_action installs STAND after do_action has already dispatched
        // SAVE_ACT. The same visit reaches process_dir once, but it cannot
        // enter stand_action/someone_has_scored until the following tick.
        // Retain a one-tick busy marker so the goal pass does not apply that
        // following stand visit early.
        keeper = clone(keeper);
        delete keeper.sourceKeeperStandTick;
        keeper.liveKeeper = {
          phase: "recovered",
          recoveryEndTick: nextTick,
        };
      }
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

    const keeperDecisionBall = currentKeeperDecisionBall({
      ball,
      keeper,
      matchTick: match.tick,
      players,
      possession,
      rng,
      sourcePredictionState,
    });
    const forcedDive = currentPossessedBallForcesKeeperDive({
      ball: keeperDecisionBall,
      keeper,
      possession,
      rng,
      sourceDistance: sourcePlayerDistanceFrame.get(keeper.id),
    });
    if (
      !forcedDive
      && !currentBallThreatensKeeper({
        ball,
        keeper,
        nextTick,
        players,
        possession,
      })
    ) continue;
    const possessionPlayer = players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === possession.owner
    ));
    const frozenPrediction = possessionPlayer?.livePass?.sourcePrediction
      ?? possessionPlayer?.liveShot?.sourcePrediction
      ?? (possession.owner === 0
        ? null
        : {
            // predict_ball is built before process_teams. A preceding holder
            // can update ballx/bally before this keeper's save visit, but the
            // keeper still scans the pre-team prediction table.
            position: clone(ball.ball.position),
            displacement: clone(ball.ball.displacement),
          })
      ?? null;
    const plan = planCssoccerKeeperSave({
      ball: keeperDecisionBall,
      frozenPrediction,
      keeper: keeperAiFrame(keeper),
      pitch: {
        length: CSSOCCER_BALL_CONSTANTS.pitchLength,
        width: CSSOCCER_BALL_CONSTANTS.pitchWidth,
        ratio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
      },
      forced: forcedDive,
      possessionOwner: possession.owner,
    });
    if (plan.status !== "save-path") continue;
    const started = beginKeeperSave({
      ball: keeperDecisionBall,
      keeper,
      nextTick,
      plan,
      possession,
      rng,
      timeFactor: match.config.timing.timeFactor,
    });
    keeper = started.keeper;
    rng = started.rng;
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
    rules,
  };
}

function currentKeeperDecisionBall({
  ball,
  keeper,
  matchTick,
  players,
  possession,
  rng,
  sourcePredictionState,
}) {
  const holder = players.find(({ nativePlayerNumber }) => (
    nativePlayerNumber === possession.owner
  ));
  const heldKick = holder?.livePass?.phase === "kick-held"
    || holder?.liveShot?.phase === "kick-held";
  const traversal = nativeContactTraversalOrder(matchTick & 1);
  const keeperVisitIndex = traversal.indexOf(keeper.nativePlayerNumber);
  const holderVisitIndex = holder === undefined
    ? -1
    : traversal.indexOf(holder.nativePlayerNumber);
  if (heldKick) {
    return keeperVisitIndex < holderVisitIndex
      ? sourcePredictionState
      : ball;
  }
  if (
    holder === undefined
    || holderVisitIndex < 0
    || keeperVisitIndex < holderVisitIndex
    || holder.role === "keeper"
    || holder.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN
    || holder.liveControlIntercept !== undefined
    || holder.liveFirstTimeIntercept !== undefined
    || holder.sourceHeldBallTween !== undefined
  ) return ball;

  // The first team can advance its owner's process_anims/hold_ball visit
  // before the opposing keeper runs go_to_save_path. keeper_boxes itself is
  // earlier, but the save reducer is materialized here, so project that exact
  // source-visible held-ball frame instead of feeding it the pre-team ball.
  const contact = stepCssoccerLooseBallControl({
    ball: {
      position: clone(ball.ball.position),
      displacement: clone(ball.ball.displacement),
      speed: ball.ball.speed,
      inAir: ball.ball.inAir,
      inGoal: ball.ball.inGoal,
      wantPass: 0,
    },
    player: {
      nativePlayer: holder.nativePlayerNumber,
      action: holder.action.action.value,
      animationFrame: sourceBallInteractionAnimationFrame(holder),
      control: holder.gameplay.control,
      faceDirection: sourceFacingDirection(holder.facing),
      facing: clone(holder.facing),
      goDisplacement: clone(holder.liveMotion.goDisplacement),
      kickedBusy: false,
      position: clone(holder.position),
    },
    possession,
    profile: LIVE_LOOSE_BALL_CONTACT_PROFILE,
    seed: rng.seed,
  });
  if (contact.outcome !== "hold") return ball;
  return createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      position: clone(contact.ball.position),
      displacement: clone(contact.ball.displacement),
      inAir: contact.ball.inAir,
    },
  });
}

function currentPossessedBallForcesKeeperDive({
  ball,
  keeper,
  possession,
  rng,
  sourceDistance,
}) {
  if (
    possession.owner === 0
    || (possession.owner < 12) === (keeper.nativePlayerNumber < 12)
    || possession.inHands !== 0
    || ball.limbo.active !== 0
    || ball.outcome !== null
    || ball.ball.inGoal !== 0
    || ball.ball.outOfPlay !== 0
    || keeper.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN
  ) return false;
  const ratio = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  const centreY = CSSOCCER_BALL_CONSTANTS.pitchWidth / 2;
  const inBox = keeper.nativePlayerNumber === 1
    ? keeper.position.x >= 0 && keeper.position.x <= 16 * ratio
    : keeper.position.x >= CSSOCCER_BALL_CONSTANTS.pitchLength - 16 * ratio
      && keeper.position.x <= CSSOCCER_BALL_CONSTANTS.pitchLength;
  if (
    !inBox
    || keeper.position.y < centreY - 19 * ratio
    || keeper.position.y > centreY + 19 * ratio
  ) return false;
  if (!Number.isFinite(sourceDistance)) {
    throw new Error(`Keeper ${keeper.id} lost its source player_distances value.`);
  }
  // BALLINT.CPP player_distances freezes tm_dist before process_teams. The
  // holder may publish a newer ball position before this keeper's later
  // intelligence visit, but opp_has_ball still tests the frozen tm_dist.
  return sourceDistance < ratio * 4 && rng.seed > keeper.gameplay.flair;
}

function currentBallThreatensKeeper({ ball, keeper, nextTick, players, possession }) {
  if (
    possession.owner !== 0
    || ball.limbo.active !== 0
    || ball.outcome !== null
    || ball.ball.still !== 0
    || ball.ball.inGoal !== 0
    || ball.ball.outOfPlay !== 0
  ) return false;
  const releasedShotPlayer = players.find((candidate) => (
    candidate.liveShot?.phase === "shot-released"
    || (
      candidate.liveFirstTimeIntercept?.phase === "released"
      && candidate.liveFirstTimeIntercept.kind === "shot"
    )
  ));
  const releasedShot = releasedShotPlayer?.liveShot?.phase === "shot-released"
    ? releasedShotPlayer.liveShot
    : releasedShotPlayer?.liveFirstTimeIntercept;
  if (
    releasedShot !== undefined
    && releasedShot.targetKeeperNativePlayer !== keeper.nativePlayerNumber
  ) {
    // BALL.CPP new_shot assigns exactly one keeper through shot_pending. The
    // other keeper must not independently reinterpret the trajectory.
    return false;
  }
  if (releasedShot !== undefined) {
    const release = releasedShot.release;
    const releaseBall = releasedShot.releaseBall?.ball;
    if (release === undefined || releaseBall === undefined) {
      throw new Error("Pending keeper shot lost its source release frame.");
    }
    // BALL.CPP new_shot delays recognition by keeper vision. The source uses
    // the keeper's tm_dist from the release tick and shortens that delay only
    // inside LONG_RANGE (prat*25), then process_ball increments the signed
    // counter once per subsequent logic tick and maps zero directly to one.
    const releaseDistance = sourceDistance2d({
      x: F32(keeper.position.x - releaseBall.position.x),
      y: F32(keeper.position.y - releaseBall.position.y),
    });
    let initialShotPending = -1 - Math.trunc((128 - keeper.gameplay.vision) / 10);
    const longRange = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 25;
    if (releaseDistance < longRange && initialShotPending < -1) {
      initialShotPending = Math.trunc(
        ((releaseDistance * 1.4) / longRange) * (initialShotPending + 1) - 1,
      );
    }
    const shotPending = nextTick - release.tick >= -initialShotPending;
    const ratio = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
    const centreY = CSSOCCER_BALL_CONSTANTS.pitchWidth / 2;
    const keeperInBox = keeper.nativePlayerNumber === 1
      ? keeper.position.x >= 0 && keeper.position.x <= 16 * ratio
      : keeper.position.x >= CSSOCCER_BALL_CONSTANTS.pitchLength - 16 * ratio
        && keeper.position.x <= CSSOCCER_BALL_CONSTANTS.pitchLength;
    const keeperCanHandle = possession.cannotPickUp <= 0
      || (keeper.nativePlayerNumber < 12 && possession.cannotPickUp > 11)
      || (keeper.nativePlayerNumber > 11 && possession.cannotPickUp < 12);
    if (
      shotPending
      && keeperInBox
      && keeper.position.y >= centreY - 19 * ratio
      && keeper.position.y <= centreY + 19 * ratio
      && keeperCanHandle
      && releaseDistance < 50 * ratio
    ) return true;
  }
  // Before shot_pending becomes positive, free_ball enters the other save
  // path only once the airborne ball is strictly within 80 source units.
  const distance = sourceDistance2d({
    x: F32(keeper.position.x - ball.ball.position.x),
    y: F32(keeper.position.y - ball.ball.position.y),
  });
  return ball.ball.inAir !== 0 && distance < 80;
}

function keeperAiFrame(keeper) {
  return {
    id: keeper.id,
    nativePlayerNumber: keeper.nativePlayerNumber,
    position: clone(keeper.position),
    attributes: {
      flair: keeper.gameplay.flair,
      vision: keeper.gameplay.vision,
      // INTELL.CPP keeper_spd uses the current dynamic tm_rate, not the
      // immutable base pace attribute.
      pace: keeper.liveMotion?.teamRate ?? keeper.gameplay.pace,
    },
  };
}

function beginKeeperSave({ ball, keeper, nextTick, plan, possession, rng, timeFactor }) {
  const predictionTicks = plan.predictionIndex;
  const keeperSpeed = plan.keeperSpeed;

  // save_in_zone_* passes floats to init_save_act's int parameters. Watcom's
  // checked conversion uses C truncation before the target-vector arithmetic.
  const targetOffset = {
    x: F32(Math.trunc(plan.target.x) - keeper.position.x),
    y: F32(Math.trunc(plan.target.y) - keeper.position.y),
  };
  const targetDistance = sourceDistance2d(targetOffset);
  const targetDirection = {
    x: F32(targetOffset.x / targetDistance),
    y: F32(targetOffset.y / targetDistance),
  };
  const accuracyRange = 128 - keeper.gameplay.accuracy;
  const accuracySample = Math.trunc(rng.seed * accuracyRange / 128);
  const accuracy = F32((rng.seed & 1 ? accuracySample : -accuracySample) / 183);
  const cosine = F32(Math.cos(accuracy));
  const sine = F32(Math.sin(accuracy));
  const inaccurateDirection = {
    x: F32((targetDirection.x * cosine) - (targetDirection.y * sine)),
    y: F32((targetDirection.y * cosine) + (targetDirection.x * sine)),
  };
  const nextRng = advanceCssoccerNativeRng(rng);

  // init_save_act chooses the L/R motion row only after applying keeper
  // accuracy. Its cross-product test uses the current ball, not merely the
  // unperturbed save target selected by go_to_save_path.
  const pairedAnimation = plan.zone !== "A";
  const baseAnimation = pairedAnimation ? plan.animation & ~1 : plan.animation;
  const rightAnimation = pairedAnimation && (
    inaccurateDirection.x * (keeper.position.y - ball.ball.position.y)
      > inaccurateDirection.y * (keeper.position.x - ball.ball.position.x)
  );
  const animation = baseAnimation + (rightAnimation ? 1 : 0);
  const motion = KEEPER_SAVE_MOTION_BY_ANIMATION[animation];
  if (motion === undefined) {
    throw new Error(`Native keeper save animation ${animation} has no compiled motion row.`);
  }
  const maxMargin = F32(1.5 + (1.8 * timeFactor / 90));
  const requiredFactor = F32(
    1 / (predictionTicks / (motion.saveTime / keeperSpeed)),
  );
  const willSave = plan.forced === true || requiredFactor <= maxMargin;
  const frameStep = Math.min(1, willSave
    ? F32(plan.contact / predictionTicks)
    : F32(motion.baseFrameStep * maxMargin * keeperSpeed));
  const continuationTicks = Math.max(1, Math.trunc(motion.saveTime / keeperSpeed));

  const ballDirection = normalizeKeeperSaveDirection({
    x: F32(ball.ball.position.x - keeper.position.x),
    y: F32(ball.ball.position.y - keeper.position.y),
  });
  const contactOffset = rotateKeeperSaveOffset(motion.storedOffset, ballDirection);
  const travelOffset = {
    x: F32((inaccurateDirection.x * targetDistance) - contactOffset.x),
    y: F32((inaccurateDirection.y * targetDistance) - contactOffset.y),
  };
  const divisor = willSave ? predictionTicks : continuationTicks;
  let goDisplacement = {
    x: F32(travelOffset.x / divisor),
    y: F32(travelOffset.y / divisor),
  };
  const actualSpeed = actualPlayerSpeed({
    pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
    teamRate: keeper.liveMotion.teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: keeper.liveMotion.goStep === true,
    nativePlayer: keeper.nativePlayerNumber,
    ballPossession: possession.owner,
    ballInHands: possession.inHands !== 0,
    keeperNativePlayers: [1, 12],
    userControlIndex: 0,
    burstTimer: 0,
  });
  const goDistance = sourceDistance2d(goDisplacement);
  if (goDistance > actualSpeed) {
    goDisplacement = {
      x: F32(goDisplacement.x * actualSpeed / goDistance),
      y: F32(goDisplacement.y * actualSpeed / goDistance),
    };
  }
  const position = {
    x: F32(keeper.position.x + goDisplacement.x),
    y: F32(keeper.position.y + goDisplacement.y),
    z: keeper.position.z,
  };
  // init_save_act retains the normalized ball vector in newdx/newdy, then the
  // same player visit reaches process_dir after SAVE_ACT movement. dir_mode=5
  // applies the ordinary MAX_TURN-limited new_dir step toward that vector.
  const facing = turnSourceFacing({
    facing: keeper.facing,
    target: ballDirection,
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate: keeper.liveMotion.teamRate },
    ).maxTurnRadians,
  }).facing;
  const goTarget = {
    x: F32(keeper.position.x + travelOffset.x),
    y: F32(keeper.position.y + travelOffset.y),
    z: plan.target.z,
  };
  const initialGoCount = Math.trunc(1 / frameStep);
  const saveBlock = plan.outcome === "parry";
  const waitCount = Math.trunc(
    (motion.keeperOnGround
      ? saveBlock
        ? 4 + Math.trunc((128 - keeper.liveMotion.teamRate) / 12)
        : 18
      : 2)
      + (1 / frameStep),
  );
  const exactPlan = {
    ...clone(plan),
    animation,
    contactOffset,
    // dir_mode=5 keeps reading the global newdx/newdy vector installed by
    // init_save_act on later SAVE_ACT visits.
    facingTarget: clone(ballDirection),
    frameStep,
    goDisplacement: clone(goDisplacement),
    keeperOnGround: motion.keeperOnGround,
    keeperSpeed,
    saveBlock,
    saveTime: motion.saveTime,
    target: clone(goTarget),
    willSave,
  };
  const nextKeeper = {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    position,
    target: clone(goTarget),
    velocity: { x: goDisplacement.x, y: goDisplacement.y, z: F32(0) },
    facing,
    intelligence: { special: 0, move: 4, count: waitCount },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_KEEPER_ACTIONS.save,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "keeper-save",
      id: animation,
      sourceActionId: CSSOCCER_KEEPER_ACTIONS.save,
      frame: F32(0),
      frameStep,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: "keeper-save",
      teamRate: keeper.liveMotion.teamRate,
      target: clone(goTarget),
      goStep: keeper.liveMotion.goStep,
      goCount: Math.max(0, initialGoCount - 1),
      goDisplacement: clone(goDisplacement),
      directionMode: 5,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: animation,
      animationFrameStep: frameStep,
    },
    liveKeeper: {
      phase: "save",
      startTick: nextTick,
      plan: exactPlan,
    },
  };
  return { keeper: nextKeeper, rng: nextRng };
}

function normalizeKeeperSaveDirection(vector) {
  const distance = sourceDistance2d(vector);
  return {
    x: F32(vector.x / distance),
    y: F32(vector.y / distance),
  };
}

function rotateKeeperSaveOffset(storedOffset, facing) {
  let x = storedOffset.x;
  let y = F32(-storedOffset.y);
  const distance = sourceDistance2d(facing);
  const nx = facing.x / distance;
  const ny = facing.y / distance;
  const offsetDistance = sourceDistance2d({ x, y });
  if (offsetDistance <= 1) return { x: F32(0), y: F32(0), z: F32(0) };
  x /= offsetDistance;
  y /= offsetDistance;
  const rotatedX = (x * nx) - (y * ny);
  const rotatedY = (y * nx) + (x * ny);
  return {
    x: F32(rotatedX * offsetDistance),
    y: F32(rotatedY * offsetDistance),
    z: storedOffset.z,
  };
}

function continueKeeperSave({ ball, keeper, nextTick, possession }) {
  const go = keeper.liveMotion.goDisplacement;
  // ACTIONS.CPP save_action advances the clip and go_cnt outside the box, but
  // suppresses tm_x/tm_y translation after keeper_boxes clears the flag.
  const keeperInBox = cssoccerKeeperBoxStatus(keeperAiFrame(keeper));
  const position = keeperInBox
    ? {
        x: F32(keeper.position.x + go.x),
        y: F32(keeper.position.y + go.y),
        z: keeper.position.z,
      }
    : clone(keeper.position);
  // SAVE_ACT keeps dir_mode=5 and turns once more toward the launch
  // newdx/newdy. The moving ball does not replace that retained vector.
  const facing = turnSourceFacing({
    facing: keeper.facing,
    target: keeper.liveKeeper.plan.facingTarget,
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate: keeper.liveMotion.teamRate },
    ).maxTurnRadians,
  }).facing;
  const frame = F32(keeper.animation.frame + keeper.animation.frameStep);
  let nextGo = keeper.animation.id >= 0
    && keeper.animation.id <= 7
    && frame > keeper.liveKeeper.plan.contact
    ? {
        x: F32(go.x * 0.75),
        y: F32(go.y * 0.75),
      }
    : clone(go);
  const terminalTravel = keeper.liveMotion.goCount === 0;
  if (terminalTravel) {
    nextGo = {
      x: F32(nextGo.x * 0.75),
      y: F32(nextGo.y * 0.75),
    };
  }
  const intelligenceCount = keeper.intelligence.count > 0
    ? keeper.intelligence.count - 1
    : 0;
  let nextKeeper = {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    position,
    velocity: keeperInBox
      ? { x: go.x, y: go.y, z: F32(0) }
      : { x: F32(0), y: F32(0), z: F32(0) },
    facing,
    intelligence: {
      ...clone(keeper.intelligence),
      count: intelligenceCount,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_KEEPER_ACTIONS.save,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: {
      ...clone(keeper.animation),
      frame: terminalTravel ? F32(0.9999) : frame,
      frameStep: terminalTravel ? F32(0) : keeper.animation.frameStep,
      tick: nextTick,
    },
    liveMotion: {
      ...clone(keeper.liveMotion),
      goCount: terminalTravel ? 0 : Math.max(0, keeper.liveMotion.goCount - 1),
      goDisplacement: nextGo,
      animationFrameStep: terminalTravel
        ? F32(0)
        : keeper.liveMotion.animationFrameStep,
    },
  };
  let nextBall = ball;
  let nextPossession = possession;
  let outcome = null;
  if (
    terminalTravel
    && (
      nextKeeper.liveKeeper.plan.keeperOnGround !== true
      || intelligenceCount <= 1
    )
  ) {
    if (nextKeeper.liveKeeper.plan.keeperOnGround === true) {
      nextKeeper = beginKeeperGroundRecovery(nextKeeper, nextTick, {
        holding: keeperOwnsBallInHands(nextKeeper, nextPossession),
      });
    } else if (keeperOwnsBallInHands(nextKeeper, nextPossession)) {
      nextKeeper = beginKeeperHold(nextKeeper, nextTick, nextBall.ball.position);
    } else {
      nextKeeper = {
        ...settleKeeperAfterOutcome(nextKeeper, nextTick, nextBall.ball.position),
        // SAVE_ACT reaches init_stand_act during process_teams, after the
        // frame's process_anims visit has already advanced the save clip.
        // Keep a same-tick marker so the later browser animation projection
        // does not advance the newly installed MC_STAND frame.
        sourceKeeperStandTick: nextTick,
      };
    }
  }
  return {
    ball: nextBall,
    keeper: nextKeeper,
    outcome,
    possession: nextPossession,
  };
}

function beginKeeperGroundRecovery(keeper, nextTick, { holding }) {
  const keeperSpeed = keeper.liveKeeper.plan.keeperSpeed;
  // init_stand_act selects the longer STOSB clip and immediately restores
  // KPHOLD_ACT when a grounded saver caught the ball. A parry uses STOS and
  // remains STAND_ACT; both clips retain the save side.
  const frameCount = holding ? 95 : 68;
  const frameStep = F32((1 / (20 * frameCount / 40)) * (keeperSpeed * 2));
  const animation = holding
    ? (keeper.animation.id & 1) === 0 ? 58 : 59
    : (keeper.animation.id & 1) === 0 ? 56 : 57;
  const actionId = holding
    ? CSSOCCER_KEEPER_ACTIONS.hold
    : CSSOCCER_NATIVE_ACTIONS.STAND;
  return {
    ...clone(keeper),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    intelligence: {
      special: 0,
      move: 10,
      count: Math.trunc(1 + (1 / frameStep)),
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId,
      facingX: keeper.facing.x,
      facingY: keeper.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "keeper-ground-recovery",
      id: animation,
      sourceActionId: actionId,
      frame: F32(0),
      frameStep,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      ...clone(keeper.liveMotion),
      kind: "keeper-ground-recovery",
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 2,
      resetAnimationFrame: false,
      animationId: animation,
      animationFrameStep: frameStep,
    },
    liveKeeper: {
      ...clone(keeper.liveKeeper),
      phase: "recover",
      recoveryStartTick: nextTick,
    },
  };
}

function continueKeeperGroundRecovery({ ballPosition, keeper, nextTick, possession }) {
  const frame = F32(keeper.animation.frame + keeper.animation.frameStep);
  const intelligenceCount = Math.max(0, keeper.intelligence.count - 1);
  const continued = {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    intelligence: {
      ...clone(keeper.intelligence),
      count: intelligenceCount,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: keeperOwnsBallInHands(keeper, possession)
        ? CSSOCCER_KEEPER_ACTIONS.hold
        : CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: keeper.facing.x,
      facingY: keeper.facing.y,
    }),
    animation: { ...clone(keeper.animation), frame, tick: nextTick },
  };
  // stand_action keeps MC_STOS* even past frame .99 while I_GET_UP remains
  // busy; only the exhausted intelligence countdown re-enters MC_STAND.
  if (intelligenceCount !== 0) return continued;
  if (keeperOwnsBallInHands(continued, possession)) {
    return beginKeeperHoldRun(continued, nextTick);
  }
  const settled = settleKeeperAfterOutcome(
    continued,
    nextTick,
    ballPosition,
    { deferStandDirection: true },
  );
  // init_stand_act completes inside this keeper's source visit. Preserve that
  // transition through the current someone_has_scored pass; ordinary goal
  // facing resumes on the following logic tick.
  return {
    ...settled,
    liveKeeper: {
      phase: "recovered",
      recoveryEndTick: nextTick,
    },
  };
}

function keeperOwnsBallInHands(keeper, possession) {
  return possession.owner === keeper.nativePlayerNumber
    && possession.inHands === 1
    && keeper.liveKeeper?.contactOutcome === "catch";
}

function beginKeeperHoldRun(keeper, nextTick) {
  const direction = keeper.nativePlayerNumber === 1 ? 1 : -1;
  const target = {
    x: F32(
      keeper.position.x
      + (direction * CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 15),
    ),
    y: F32(keeper.position.y),
  };
  const teamRate = keeper.liveMotion.teamRate;
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const travel = sourceGetThereTime({
    position: { x: keeper.position.x, y: keeper.position.y },
    target,
    facing: keeper.facing,
    speed: sourceFullPlayerSpeed({
      pitchLength: 1280,
      teamRate,
      celebrating: false,
    }),
    maxTurn2Radians: travelProfile.maxTurn2Radians,
    imThereDistance: travelProfile.imThereDistance,
    canRotateAndRun: true,
    mustFace: null,
  });
  const goDisplacement = {
    x: F32((target.x - keeper.position.x) / travel.ticks),
    y: F32((target.y - keeper.position.y) / travel.ticks),
  };
  const facing = turnSourceFacing({
    facing: keeper.facing,
    target: {
      x: F32(target.x - keeper.position.x),
      y: F32(target.y - keeper.position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians,
  }).facing;
  return {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    facing,
    target: { ...target, z: F32(0) },
    intelligence: { special: 0, move: 0, count: 0 },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "keeper-run-with-ball",
      id: KEEPER_RUN_WITH_BALL_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      frame: F32(0),
      frameStep: KEEPER_RUN_WITH_BALL_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: "keeper-run-with-ball",
      teamRate,
      target,
      goStep: false,
      goCount: travel.ticks,
      goDisplacement,
      directionMode: 0,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: KEEPER_RUN_WITH_BALL_ANIMATION,
      animationFrameStep: KEEPER_RUN_WITH_BALL_FRAME_STEP,
    },
    liveKeeper: {
      phase: "hold-run",
      holdStartTick: nextTick,
      runSteps: 0,
    },
  };
}

function continueKeeperHoldRun(keeper, nextTick, possession) {
  const teamRate = keeper.liveMotion.teamRate;
  const displacement = sourceForwardDisplacement({
    facing: keeper.facing,
    targetOffset: {
      x: F32(keeper.liveMotion.target.x - keeper.position.x),
      y: F32(keeper.liveMotion.target.y - keeper.position.y),
    },
    speed: actualPlayerSpeed({
      pitchLength: 1280,
      teamRate,
      speedIntent: CSSOCCER_SPEED_INTENT.normal,
      intentionCount: 0,
      sideStep: false,
      nativePlayer: keeper.nativePlayerNumber,
      ballPossession: possession.owner,
      ballInHands: possession.inHands !== 0,
      keeperNativePlayers: [1, 12],
      userControlIndex: 0,
      burstTimer: 0,
    }),
  }).displacement;
  const position = {
    ...updateSourcePosition2d({
      position: { x: keeper.position.x, y: keeper.position.y },
      displacement,
    }),
    z: keeper.position.z,
  };
  return {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    position,
    velocity: { ...clone(displacement), z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: keeper.facing.x,
      facingY: keeper.facing.y,
    }),
    animation: {
      ...clone(keeper.animation),
      frame: F32(keeper.animation.frame + keeper.animation.frameStep),
      tick: nextTick,
    },
    liveMotion: {
      ...clone(keeper.liveMotion),
      goCount: Math.max(0, keeper.liveMotion.goCount - 1),
      goDisplacement: clone(displacement),
      directionMode: 2,
      resetAnimationFrame: false,
    },
    liveKeeper: {
      ...clone(keeper.liveKeeper),
      runSteps: keeper.liveKeeper.runSteps + 1,
    },
  };
}

function beginKeeperHandsPunt({
  ball,
  keeper,
  nextTick,
  possession,
  rng,
  sourcePredictionState,
}) {
  const released = releaseCssoccerPunt({
    ball,
    keeperHands: true,
    owner: liveShotHolder(keeper),
    possession,
    rng,
    tick: ball.ball.tick,
  });
  const contactOffset = rotateOpeningOffset(
    KEEPER_KICKOUT_LOCAL_CONTACT_OFFSET,
    keeper.facing,
  );
  const releasedBall = createBallMatchState({
    ...clone(released.ball),
    limbo: createBallLimbo({
      player: keeper.nativePlayerNumber,
      contact: KEEPER_KICKOUT_CONTACT,
    }),
    ball: {
      ...clone(released.ball.ball),
      position: {
        x: F32(keeper.position.x + contactOffset.x),
        y: F32(keeper.position.y + contactOffset.y),
        z: F32(keeper.position.z + contactOffset.z),
      },
      // punt_ball binds the launched ball to MC_KICKOUT without clearing the
      // preceding held-ball still flag. BALL.CPP clears it only after limbo
      // reaches the contact frame and physical flight resumes.
      still: ball.ball.still,
    },
  });
  return {
    ball: releasedBall,
    possession: released.possession,
    rng: released.rng,
    keeper: {
      ...clone(keeper),
      previousPosition: clone(keeper.position),
      previousFacing: clone(keeper.facing),
      velocity: { x: F32(0), y: F32(0), z: F32(0) },
      intelligence: { special: 0, move: 0, count: 0 },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: keeper.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
        facingX: keeper.facing.x,
        facingY: keeper.facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "keeper-kickout",
        id: KEEPER_KICKOUT_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
        frame: F32(0),
        frameStep: KEEPER_KICKOUT_FRAME_STEP,
        pending: "ball-limbo-contact",
        tick: nextTick,
      },
      liveMotion: {
        ...clone(keeper.liveMotion),
        kind: "keeper-kickout",
        directionMode: 2,
        resetAnimationFrame: true,
        animationId: KEEPER_KICKOUT_ANIMATION,
        animationFrameStep: KEEPER_KICKOUT_FRAME_STEP,
      },
      liveKeeper: {
        ...clone(keeper.liveKeeper),
        phase: "punt-limbo",
        mustPunt: false,
        releaseTick: nextTick,
        animationLimbo: KEEPER_KICKOUT_LIMBO,
        // process_ball populated ball_pred_tab before this later KPHOLD
        // release. While ball_limbo_on remains set, every free_ball visit
        // continues to scan that pre-punt table.
        sourcePrediction: {
          position: clone(sourcePredictionState.ball.position),
          displacement: clone(sourcePredictionState.ball.displacement),
        },
        sourcePredictionBall: clone(sourcePredictionState.ball),
      },
    },
  };
}

function continueKeeperKickout(keeper, nextTick) {
  return {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    intelligence: { special: 0, move: 0, count: 0 },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: keeper.facing.x,
      facingY: keeper.facing.y,
    }),
    animation: {
      ...clone(keeper.animation),
      frame: F32(keeper.animation.frame + keeper.animation.frameStep),
      tick: nextTick,
    },
    liveMotion: {
      ...clone(keeper.liveMotion),
      resetAnimationFrame: false,
    },
    liveKeeper: {
      ...clone(keeper.liveKeeper),
      animationLimbo: Math.max(0, keeper.liveKeeper.animationLimbo - 1),
    },
  };
}

function continueKeeperPuntStand(keeper, nextTick, ballPosition) {
  const continuing = keeper.liveKeeper.phase === "punt-stand"
    && keeper.animation.id === STAND_ANIMATION;
  const facing = turnSourceFacing({
    facing: keeper.facing,
    target: {
      x: F32(ballPosition.x - keeper.position.x),
      y: F32(ballPosition.y - keeper.position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate: keeper.liveMotion.teamRate },
    ).maxTurnRadians,
  }).facing;
  const liveKeeper = {
    ...clone(keeper.liveKeeper),
    phase: "punt-stand",
    animationLimbo: 0,
  };
  delete liveKeeper.sourcePrediction;
  delete liveKeeper.sourcePredictionBall;
  return {
    ...clone(keeper),
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    facing,
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "stand",
      id: STAND_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      frame: continuing
        ? F32(keeper.animation.frame + keeper.animation.frameStep)
        : F32(0),
      frameStep: STAND_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      ...clone(keeper.liveMotion),
      kind: "stand",
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: !continuing,
      animationId: continuing ? keeper.liveMotion.animationId : null,
      animationFrameStep: continuing
        ? keeper.liveMotion.animationFrameStep
        : null,
    },
    liveKeeper,
  };
}

function beginKeeperHold(keeper, nextTick, ballPosition) {
  const held = continueKeeperHold(
    settleKeeperAfterOutcome(keeper, nextTick, ballPosition),
    nextTick,
  );
  return {
    ...held,
    liveKeeper: {
      phase: "hold",
      holdStartTick: nextTick,
    },
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

function settleKeeperAfterOutcome(
  keeper,
  nextTick,
  ballPosition,
  { deferStandDirection = false } = {},
) {
  const settled = clone(keeper);
  delete settled.liveKeeper;
  const facing = deferStandDirection
    ? clone(keeper.facing)
    : turnSourceFacing({
        facing: keeper.facing,
        target: {
          x: F32(ballPosition.x - keeper.position.x),
          y: F32(ballPosition.y - keeper.position.y),
        },
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate: keeper.liveMotion.teamRate },
        ).maxTurnRadians,
      }).facing;
  return {
    ...settled,
    previousPosition: clone(keeper.position),
    previousFacing: clone(keeper.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    facing,
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: keeper.id,
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
      teamRate: keeper.liveMotion.teamRate,
      target: deferStandDirection
        ? clone(keeper.liveMotion.target)
        : clone(ballPosition),
      // ACTIONS.CPP init_stand_act does not clear go_step when a save
      // finishes. The next find_zonal_target visit consumes that retained
      // side-step request.
      goStep: keeper.liveMotion.goStep,
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      // A terminal I_GET_UP visit installs MC_STAND from stand_action after
      // intelligence has already run. Its retained dir_mode=2 reaches
      // process_dir once; ordinary stand facing starts on the next visit.
      directionMode: deferStandDirection
        ? keeper.liveMotion.directionMode
        : 1,
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

function captureOpenPlayPlayerDistances(players, ballPosition) {
  return new Map(players.map((player) => [
    player.id,
    sourceDistance2d({
      x: F32(player.position.x - ballPosition.x),
      y: F32(player.position.y - ballPosition.y),
    }),
  ]));
}

function captureOpenPlayPlayerDistanceRanks(players, distances) {
  const ranks = new Map(players.map(({ id }) => [id, 0]));
  for (const nativeTeamSlot of ["A", "B"]) {
    players
      .filter((player) => player.active && player.nativeTeamSlot === nativeTeamSlot)
      .slice()
      .sort((left, right) => (
        distances.get(left.id) - distances.get(right.id)
        || left.nativePlayerNumber - right.nativePlayerNumber
      ))
      .slice(0, 4)
      .forEach((player, index) => ranks.set(player.id, index + 1));
  }
  return ranks;
}

function clearLivePendingShots(players) {
  return players.map((player) => {
    if (player.livePendingShot === undefined) return player;
    const cleared = clone(player);
    delete cleared.livePendingShot;
    return cleared;
  });
}

function bindPostGoalCountdownMotion(match) {
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  return {
    ...match,
    players: match.players.map((player) => {
      if (player.liveMotion !== undefined) return player;
      const teamRate = rates.get(player.id);
      if (!Number.isSafeInteger(teamRate)) {
        throw new Error(`Post-goal countdown lost current rate for ${player.id}.`);
      }
      const live = player.liveCelebration;
      return {
        ...clone(player),
        liveMotion: {
          kind: player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
            ? "run"
            : player.action.action.value === GOAL_CELEBRATION_ACTION
              ? "goal-celebration"
              : "stand",
          teamRate,
          target: {
            x: player.target.x,
            y: player.target.y,
          },
          goStep: live?.goStep ?? player.goalGoStep ?? false,
          goCount: live?.goCount ?? 0,
          goDisplacement: clone(
            live?.displacement ?? { x: F32(0), y: F32(0) },
          ),
          directionMode: live?.directionMode ?? 1,
          resetAnimationFrame: false,
          sideStepDirection: null,
          animationId: null,
          animationFrameStep: null,
        },
      };
    }),
  };
}

function completePostGoalCelebrationActions(match, playerIds, nextTick) {
  if (playerIds.size === 0) return match;
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  const ball = match.ball.ball.position;
  return {
    ...match,
    players: match.players.map((source) => {
      if (!playerIds.has(source.id)) return source;
      const player = clone(source);
      const displacement = clone(
        player.liveCelebration?.displacement ?? { x: F32(0), y: F32(0) },
      );
      const planar = updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement,
      });
      const teamRate = rates.get(player.id);
      if (!Number.isSafeInteger(teamRate)) {
        throw new Error(`Post-goal celebration exit lost current rate for ${player.id}.`);
      }
      const facing = turnSourceFacing({
        facing: player.facing,
        target: {
          x: F32(ball.x - planar.x),
          y: F32(ball.y - planar.y),
        },
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate },
        ).maxTurnRadians,
      }).facing;
      const goStep = player.liveMotion.goStep;
      delete player.liveCelebration;
      delete player.goalGoStep;
      return {
        ...player,
        ...(player.sourceHeldBallTween?.freeTime < -1
          ? {
              sourceHeldBallTween: {
                ...clone(player.sourceHeldBallTween),
                // celeb_action -> init_stand_act retains the completed
                // celebration as ls_anim/ls_frm. Its compiled ball point is
                // below ground, so get_mcball_coords uses current tm_x/tm_y.
                zeroHeightCapture: true,
              },
            }
          : {}),
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        position: { ...planar, z: player.position.z },
        facing,
        velocity: { ...displacement, z: F32(0) },
        target: { x: ball.x, y: ball.y, z: F32(0) },
        intelligence: { special: 0, move: 0, count: 0 },
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
          target: { x: ball.x, y: ball.y },
          goStep,
          goCount: 0,
          goDisplacement: { x: F32(0), y: F32(0) },
          directionMode: 1,
          resetAnimationFrame: true,
          sideStepDirection: null,
          animationId: null,
          animationFrameStep: null,
        },
      };
    }),
  };
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

function projectSourceSupportIntentVisits(visits, possessionOwner) {
  if (possessionOwner === 0 || visits.length === 0) return visits;
  const holderIndex = visits.findIndex(
    ({ nativePlayerNumber }) => nativePlayerNumber === possessionOwner,
  );
  if (holderIndex < 0) {
    throw new Error("Source support intent lost its current holder visit.");
  }
  // FOOTBALL.CPP get_opp_near_ball runs before process_teams. The support
  // reducer reads the holder visit as that pressure anchor, so preserve the
  // pre-team ball frame even when an earlier visit moves/tweens the ball.
  const sourceBallPosition = clone(visits[0].ballPosition);
  return visits.map((visit, index) => index === holderIndex
    ? { ...clone(visit), ballPosition: sourceBallPosition }
    : visit);
}

function retainedSourceSupportMe(match) {
  const action = match.kickoff.action;
  if (
    match.kickoff.phase !== "open-play"
    || action?.released !== true
  ) return false;
  // RULES.CPP leaves support_me live after a user set piece, while a goal
  // kick explicitly clears it. ACTIONS.CPP init_throw_act raises it for
  // either user or AI throw-ins. The next init_match_mode resets the global.
  if (match.kickoff.restartKind === "throw-in") return true;
  if (match.kickoff.restartKind === "goal-kick") return false;
  return action.userControlled === true;
}

function stepCurrentFoulRunup(match, {
  command,
  events,
  nextTick,
  playerDistanceFrame,
  playerDistanceRankFrame,
  publishPlayerVisits,
  sourcePredictionBall,
}) {
  const sourceTakerId = match.rules.foulRestart?.descriptor?.taker?.playerId;
  const sourceTaker = match.players.find(({ id }) => id === sourceTakerId);
  if (
    match.rules.foulRestart?.phase !== "runup"
    || sourceTaker?.liveRestart?.phase !== "set-piece-runup"
    || sourceTaker.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
  ) {
    throw new Error("Foul run-up lost its current source action.");
  }
  if (
    sourceTaker.liveRestart.startTick < nextTick
    && sourceTaker.liveRestart.remainingMoves <= 0
  ) {
    let constrainedVisits = null;
    const constrained = advanceCurrentFoulContactWaitTeams(match, {
      command,
      nextTick,
      publishPlayerVisits(visits) {
        constrainedVisits = visits;
      },
    });
    const begun = beginCurrentFoulKick({
      action: "shot",
      aim: sourceTaker.liveRestart.aim,
      events,
      // ready_set_kick clears the restart globals inside the taker's visit,
      // but every later player still runs this tick's intelligence exactly
      // once. Carry only the source-wide socks countdown into that live-rule
      // suffix; using the fully constrained frame would move those players
      // once before and once after the taker.
      match: advanceSourceSocksBusyPlayers(match),
      nextTick,
      sourcePredictionBall,
      taker: sourceTaker,
      userControlled: true,
    });
    const begunTaker = begun.players.find(({ id }) => id === sourceTaker.id);
    if (begunTaker === undefined) {
      throw new Error("Foul run-up action transition lost its current taker.");
    }
    let ordinaryVisits = null;
    const ordinary = stepCurrentBoundaryKickActionTeamContinuation(
      begun,
      begunTaker,
      nextTick,
      (visits) => {
        ordinaryVisits = visits;
      },
      begun.kickoff.zoning,
      {
        command,
        events,
        playerDistanceFrame,
        playerDistanceRankFrame,
      },
    );
    const traversal = nativeContactTraversalOrder(match.tick & 1);
    const takerVisitIndex = traversal.indexOf(sourceTaker.nativePlayerNumber);
    if (
      takerVisitIndex < 0
      || constrainedVisits === null
      || ordinaryVisits === null
    ) {
      throw new Error("Foul run-up action transition lost source traversal state.");
    }
    const constrainedById = new Map(
      constrained.players.map((player) => [player.id, player]),
    );
    const constrainedVisitByNative = new Map(
      constrainedVisits.map((visit) => [visit.nativePlayerNumber, visit]),
    );
    // user_runup -> taker_nkick -> ready_set_kick executes inside the taker's
    // go_team slot. Earlier players still see match_mode/game_action; later
    // players see the cleared globals and perform an ordinary live-play visit.
    const players = ordinary.players.map((player) => (
      traversal.indexOf(player.nativePlayerNumber) < takerVisitIndex
        ? constrainedById.get(player.id) ?? player
        : player
    ));
    publishPlayerVisits(ordinaryVisits.map((visit) => (
      traversal.indexOf(visit.nativePlayerNumber) < takerVisitIndex
        ? constrainedVisitByNative.get(visit.nativePlayerNumber) ?? visit
        : visit
    )));
    return { ...ordinary, players };
  }
  const supported = advanceCurrentFoulContactWaitTeams(match, {
    command,
    nextTick,
    publishPlayerVisits,
  });
  const taker = supported.players.find(({ id }) => id === sourceTaker.id);
  if (taker === undefined) throw new Error("Foul run-up support lost its taker.");
  if (taker.liveRestart.startTick >= nextTick) return supported;
  if (taker.liveRestart.remainingMoves > 0) {
    const position = {
      ...updateSourcePosition2d({
        position: { x: taker.position.x, y: taker.position.y },
        displacement: taker.liveMotion.goDisplacement,
      }),
      z: taker.position.z,
    };
    const facing = turnSourceFacing({
      facing: taker.facing,
      target: {
        x: F32(taker.liveMotion.target.x - position.x),
        y: F32(taker.liveMotion.target.y - position.y),
      },
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate: taker.liveMotion.teamRate },
      ).maxTurnRadians,
    }).facing;
    return {
      ...supported,
      players: supported.players.map((player) => player.id === taker.id
        ? {
            ...clone(player),
            previousPosition: clone(player.position),
            previousFacing: clone(player.facing),
            position,
            velocity: { ...clone(player.liveMotion.goDisplacement), z: F32(0) },
            facing,
            intelligence: {
              ...clone(player.intelligence),
              count: Math.max(0, player.intelligence.count - 1),
            },
            action: createCssoccerActionState({
              tick: nextTick,
              playerId: player.id,
              actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
              facingX: facing.x,
              facingY: facing.y,
            }),
            liveRestart: {
              ...clone(player.liveRestart),
              remainingMoves: player.liveRestart.remainingMoves - 1,
            },
          }
        : player),
    };
  }
  return beginCurrentFoulKick({
    action: "shot",
    aim: taker.liveRestart.aim,
    events,
    match: supported,
    nextTick,
    sourcePredictionBall,
    taker,
    userControlled: true,
  });
}

/**
 * init_match_mode resets ideas and installs the foul globals, but it does not
 * suspend go_team while a pre-existing physical kick/contact finishes. Every
 * non-busy player still reaches computer_play in source order: an installed
 * go_cnt continues, otherwise find_zonal_target installs and consumes one
 * movement step immediately.
 */
function advanceCurrentFoulContactWaitTeams(match, {
  command,
  nextTick,
  publishPlayerVisits,
}) {
  const descriptor = match.rules.foulRestart?.descriptor;
  if (descriptor === undefined) {
    throw new Error("Foul contact wait lost its current restart descriptor.");
  }
  const sourcePlayers = match.players;
  // process_teams still runs intelligence during this retained physical
  // contact phase. In particular, a socks I_GET_UP countdown selected on an
  // earlier foul-wait visit decrements every following visit and falls
  // through to ordinary positioning on its terminal count.
  const advanced = advanceSourceSocksBusyPlayers(
    advanceOpenPlayContactActions(match, nextTick),
  );
  const currentById = new Map(advanced.players.map((player) => [player.id, player]));
  const rates = new Map(currentTeamRates(
    sourcePlayers,
    match.clock.gameMinute,
  ).map(({ id, value }) => [id, value]));
  const tactics = currentFreePlayTacticsState(match.tactics);
  const possession = {
    owner: match.possession.owner,
    lastTouch: match.possession.lastTouch,
    inHands: match.possession.inHands,
  };
  const takerConstant = descriptor.kind === "penalty"
    ? LIVE_RULE_SOURCE_PROFILE.penaltyRunupDistance.value
    : CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.besideBall.value;
  const takerPlacement = materializeCssoccerFoulTakerPlacement(
    descriptor,
    takerConstant,
  );
  const traversal = nativeContactTraversalOrder(match.tick & 1);
  const pendingShot = sourcePlayers.find((candidate) => (
    ["punt-released", "shot-released"].includes(candidate.liveShot?.phase)
    || candidate.livePendingShot !== undefined
  ));
  const sourceByNative = new Map(sourcePlayers.map((player) => [
    player.nativePlayerNumber,
    player,
  ]));
  const visits = traversal.flatMap(
    (nativePlayerNumber) => {
      const player = sourceByNative.get(nativePlayerNumber);
      if (player === undefined) {
        throw new Error(`Foul contact wait lost native player ${nativePlayerNumber}.`);
      }
      if (!player.active) return [];
      return [{
        playerId: player.id,
        nativePlayerNumber,
        ballPosition: clone(match.ball.ball.position),
        canBeOffside: match.rules.canBeOffside,
        distance: sourceDistance2d({
          x: F32(player.position.x - match.ball.ball.position.x),
          y: F32(player.position.y - match.ball.ball.position.y),
        }),
        interaction: "none",
        possession: clone(possession),
      }];
    },
  );
  const logicCount = NATIVE_CAPTURE_LOGIC_COUNT_ROOT + Math.max(0, nextTick - 2);
  const defensiveLines = captureOpenPlayDefensiveLines(sourcePlayers);
  const supportIntent = resolveCssoccerFreePlaySupportIntent({
    candidateWindow: "all",
    controlledPlayerId: match.control.activePlayerId,
    defensiveLines,
    holderVisitCompleted: false,
    justScored: match.goal.justScored !== 0,
    logicCount,
    nextTick,
    offsideEnabled: match.config.rules.offside === true,
    players: sourcePlayers,
    possession,
    rngSeed: match.rng.state.seed,
    sourcePossession: possession,
    supportMe: ["decision", "runup"].includes(match.rules.foulRestart.phase),
    takerId: descriptor.taker.playerId,
    visits,
  });
  const players = sourcePlayers.map((source) => {
    let current = currentById.get(source.id);
    const teamRate = rates.get(source.id);
    if (current === undefined || !Number.isSafeInteger(teamRate)) {
      throw new Error(`Foul contact wait lost ${source.id}'s source state.`);
    }
    if (!current.active) return current;
    if (
      current.liveMotion?.kind === "offside-runback"
      && current.liveMotion.goCount > 0
    ) {
      const continued = stepOpenPlayOffsideRunback({
        ballPosition: match.ball.ball.position,
        burstTimer: match.control.burstTimer,
        command,
        controlled: current.id === match.control.activePlayerId,
        nextTick,
        player: current,
        possession,
        replan: false,
        target: current.liveMotion.target,
        teamRate,
      });
      if (continued.liveMotion.goCount > 0) return continued;
      // run_action consumes the last installed go_forward before its
      // intelligence falls through to find_zonal_target in this same visit.
      // process_dir runs only after the replacement journey is installed, so
      // retain the entry facing while the old step updates the position.
      current = {
        ...continued,
        facing: clone(current.facing),
      };
    }
    // A completed CONTROL_ACT can retain negative tm_ftime solely for
    // hold_ball's eight-frame ball tween. That source field does not keep the
    // player busy: the same player can continue RUN or find_zonal_target.
    if (
      current.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
      && current.liveMotion?.goCount > 0
      && (
        current.liveContact === undefined
        || current.liveContact.phase === "barge"
      )
      && (
        current.liveControlIntercept === undefined
        || current.liveControlIntercept.phase === "tween"
      )
      && current.liveFirstTimeIntercept === undefined
      && current.liveKeeper === undefined
      && current.livePass === undefined
      && current.liveRestart === undefined
      && current.liveShot === undefined
    ) {
      const continued = continueSourceFoulRestartRun(
        current,
        match.ball.ball.position,
        possession,
        teamRate,
        nextTick,
      );
      if (continued.liveMotion.goCount > 0) return continued;
      // The last old journey step runs before find_zonal_target replaces it;
      // only the replacement target participates in this visit's process_dir.
      current = {
        ...continued,
        facing: clone(current.facing),
      };
    }
    if (
      current.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN
      || (
        current.liveContact !== undefined
        && current.liveContact.phase !== "barge"
      )
      || (
        current.liveControlIntercept !== undefined
        && current.liveControlIntercept.phase !== "tween"
      )
      || current.liveFirstTimeIntercept !== undefined
      || current.liveKeeper !== undefined
      || current.livePass !== undefined
      || current.liveRestart !== undefined
      || current.liveShot !== undefined
      || current.liveMotion?.kind === "socks"
      || current.liveMotion?.kind === "socks-wait"
    ) return current;
    const zone = match.kickoff.zoning?.[current.nativeTeamSlot];
    if (zone === undefined) {
      throw new Error(`Foul contact wait lost ${current.id}'s persistent ball zone.`);
    }
    const teamInPossession = possession.lastTouch !== 0 && (
      (current.nativeTeamSlot === "A" && possession.lastTouch < 12)
      || (current.nativeTeamSlot === "B" && possession.lastTouch > 11)
    );
    const keeperWaitsForShot = current.role === "keeper"
      && pendingShot !== undefined
      && possession.owner === 0
      && (
        (
          current.nativePlayerNumber === 1
          && match.ball.ball.position.x < CSSOCCER_BALL_CONSTANTS.pitchLength / 2
        )
        || (
          current.nativePlayerNumber === 12
          && match.ball.ball.position.x > CSSOCCER_BALL_CONSTANTS.pitchLength / 2
        )
      );
    const startingSupportRun = supportIntent.run?.playerId === current.id;
    if (keeperWaitsForShot) {
      // stand_action skips find_zonal_target while shot_pending guards this
      // goal, but go_team still reaches process_dir. init_stand_act retains
      // dir_mode=1, so that trailing slot turns the stationary keeper toward
      // the current ball rather than an offline positioning target.
      const facingTarget = {
        x: F32(match.ball.ball.position.x - current.position.x),
        y: F32(match.ball.ball.position.y - current.position.y),
      };
      const facing = facingTarget.x === 0 && facingTarget.y === 0
        ? clone(current.facing)
        : turnSourceFacing({
            facing: current.facing,
            target: facingTarget,
            maxTurnRadians: projectCssoccerMotionSourceProfile(
              CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
              { teamRate },
            ).maxTurnRadians,
          }).facing;
      return {
        ...clone(current),
        previousPosition: clone(current.position),
        previousFacing: clone(current.facing),
        velocity: { x: F32(0), y: F32(0), z: F32(0) },
        facing,
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: current.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
          facingX: facing.x,
          facingY: facing.y,
        }),
        liveMotion: {
          ...clone(current.liveMotion),
          goCount: 0,
          resetAnimationFrame: false,
        },
      };
    }
    let target;
    if (current.role === "keeper") {
      target = {
        x: current.nativePlayerNumber === 1
          ? CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.keeperOffline.value
          : F32(
              CSSOCCER_BALL_CONSTANTS.pitchLength
              - CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.keeperOffline.value
            ),
        y: F32(CSSOCCER_BALL_CONSTANTS.pitchWidth / 2 - 1),
      };
    } else if (
      current.nativePlayerNumber === descriptor.taker.nativePlayerNumber
    ) {
      target = takerPlacement;
    } else if (startingSupportRun) {
      target = supportIntent.run.target;
    } else {
      const zonal = resolveCssoccerZonalTarget(tactics, {
        nativeTeamSlot: current.nativeTeamSlot,
        nativePlayerNumber: current.nativePlayerNumber,
        ballZone: zone.ballZone,
        zoneCenter: zone.zoneCenter,
        teamInPossession,
        pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
        pitchWidth: CSSOCCER_BALL_CONSTANTS.pitchWidth,
        // get_target retains analogue interpolation for free-kick modes,
        // which are numerically above the throw-in range.
        analogue: match.kickoff.zoning.analogue
          && match.ball.ball.outOfPlay === 0,
        ballPosition: match.ball.ball.position,
      });
      target = zonal.target;
      if (descriptor.kind !== "penalty") {
        // INTELL.CPP game_action constrains both teams, not only the side
        // defending the free kick.
        target = currentTenYardTarget(
          target,
          descriptor.ballPosition,
          current.nativeTeamSlot,
          current.position,
          zonal.source,
        );
      }
    }
    const projected = projectCssoccerFreePlayZonalPlayerVisit({
      allowSideStep: !startingSupportRun,
      ballPosition: match.ball.ball.position,
      nextTick,
      player: current,
      possession,
      tactics: match.tactics,
      teamRate,
      targetOverride: target,
      zoning: {
        analogue: match.kickoff.zoning.analogue
          && match.ball.ball.outOfPlay === 0,
        ballZone: zone.ballZone,
        zoneCenter: clone(zone.zoneCenter),
        teamInPossession,
      },
    });
    if (startingSupportRun) {
      return {
        ...projected,
        intelligence: {
          special: 0,
          move: RUN_ON_INTELLIGENCE_MOVE,
          count: projected.liveMotion.goCount + 1,
        },
        liveMotion: {
          ...projected.liveMotion,
          kind: "support-run",
          wantPassStat: supportIntent.run.wantPassStat,
          wantPassOffset: {
            x: F32(supportIntent.run.target.x - current.position.x),
            y: F32(supportIntent.run.target.y - current.position.y),
          },
          wantPassFaced: false,
        },
      };
    }
    return {
      ...projected,
      // find_zonal_target performs the first go_forward itself and clears
      // go_cnt before the visit reaches process_dir.
      liveMotion: {
        ...projected.liveMotion,
        goCount: 0,
        // stand_action skips find_zonal_target for the defending keeper while
        // shot_pending is live. Its existing MC_STAND frame therefore keeps
        // advancing unless the shot was released after this keeper's visit.
        resetAnimationFrame: projected.liveMotion.resetAnimationFrame,
      },
    };
  });
  publishPlayerVisits(visits);
  let routed = possession.owner === 0
    ? { ...advanced, players }
    : applyOpenPlayOffsideRunbacks({
        command,
        completedRunbackPlayerIds: [],
        defensiveLines,
        expiredInterceptPlayerIds: [],
        logicCount,
        match: { ...advanced, players },
        nextTick,
        sourcePlayers,
        visits,
      });
  routed = applyOpenPlayFreshSocksActions({
    match: routed,
    nextTick,
    sourcePlayers,
    visits,
  });
  return routed;
}

function continueSourceFoulRestartRun(
  player,
  ballPosition,
  possession,
  teamRate,
  nextTick,
) {
  const motion = player.liveMotion;
  const speed = actualPlayerSpeed({
    pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: motion.goStep,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: possession.owner,
    ballInHands: possession.inHands !== 0,
    keeperNativePlayers: [1, 12],
    userControlIndex: 0,
    burstTimer: 0,
  });
  const displacement = motion.goStep
    ? clone(motion.goDisplacement)
    : sourceForwardDisplacement({
        facing: player.facing,
        targetOffset: {
          x: F32(motion.target.x - player.position.x),
          y: F32(motion.target.y - player.position.y),
        },
        speed,
      }).displacement;
  const position = {
    ...updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement,
    }),
    z: player.position.z,
  };
  const facingTarget = motion.directionMode === 1
    ? {
        x: F32(ballPosition.x - position.x),
        y: F32(ballPosition.y - position.y),
      }
    : {
        x: F32(motion.target.x - position.x),
        y: F32(motion.target.y - position.y),
      };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: facingTarget,
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
    velocity: { ...clone(displacement), z: F32(0) },
    facing,
    intelligence: motion.kind === "support-run"
      ? {
          special: 0,
          move: RUN_ON_INTELLIGENCE_MOVE,
          count: Math.max(0, player.intelligence.count - 1),
        }
      : clone(player.intelligence),
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: facing.x,
      facingY: facing.y,
    }),
    liveMotion: {
      ...clone(motion),
      goCount: motion.goCount - 1,
      goDisplacement: clone(displacement),
    },
  };
}

function processTeams(match, {
  command,
  defensiveLinesFrame,
  events,
  nearPath,
  nearest,
  opponentNearPath,
  nextTick,
  playerDistanceFrame,
  playerDistanceRankFrame,
  publishCentrePassContact,
  publishPlayerVisits,
  sourceInitialization,
  sourcePredictionBall,
}) {
  if (match.clock.terminal) return match;
  if (
    (match.clock.phase === "halftime-whistle"
      || match.clock.phase === "halftime-transition")
    && match.ball.outcome?.kind === "swap-ends"
  ) {
    return {
      ...match,
      players: stepCssoccerFreePlayHalftimeTunnelJourney({
        ballPosition: match.ball.ball.position,
        nextTick,
        players: match.players,
        possession: match.possession,
        teamRates: currentTeamRates(match.players, match.clock.gameMinute),
        tunnel: {
          x: F32(CSSOCCER_ACTUA_GAMEPLAY_CAMERA.tunnel.target[0]),
          y: F32(CSSOCCER_ACTUA_GAMEPLAY_CAMERA.tunnel.target[1]),
        },
      }),
    };
  }
  if (sourceInitialization) {
    return {
      ...match,
      kickoff: {
        ...match.kickoff,
        phase: "centre-positioning",
      },
    };
  }
  if (match.goal.phase === "celebration") {
    return stepGoalCelebrationPlayers(match, nextTick, events);
  }
  if (match.kickoff.phase === "foul-runup") {
    return stepCurrentFoulRunup(match, {
      command,
      events,
      nextTick,
      playerDistanceFrame,
      playerDistanceRankFrame,
      publishPlayerVisits,
      sourcePredictionBall,
    });
  }
  if (match.kickoff.phase === "foul-contact-wait") {
    return advanceCurrentFoulContactWaitTeams(match, {
      command,
      nextTick,
      publishPlayerVisits,
    });
  }
  match = advanceSourceSocksBusyPlayers(match);
  if (match.kickoff.phase === "rule-action") {
    return stepCurrentFoulKickAction(
      match,
      nextTick,
      events,
      publishPlayerVisits,
      command,
      nearPath,
      opponentNearPath,
      playerDistanceFrame,
      playerDistanceRankFrame,
    );
  }
  if (match.kickoff.phase === "boundary-action") {
    return stepCurrentBoundaryKickAction(
      match,
      nextTick,
      events,
      publishPlayerVisits,
    );
  }
  if (match.kickoff.phase === "boundary-runup") {
    return stepCurrentBoundaryRunup(
      match,
      nextTick,
      events,
      sourcePredictionBall,
    );
  }
  if (match.kickoff.phase === "kick-action") {
    const contact = projectCentrePassContact(match);
    publishCentrePassContact(contact);
    let sourceControlledPlayerId = match.control.activePlayerId;
    if (contact.frame >= match.kickoff.action.contact) {
      const receiver = match.players.find(({ id }) => (
        id === match.kickoff.action.receiverId
      ));
      const taker = match.players.find(({ id }) => (
        id === match.kickoff.action.takerId
      ));
      if (receiver === undefined || taker === undefined) {
        throw new Error("Centre-pass release control lost its current players.");
      }
      const releasedControl = reselectReleasedControl(match, receiver, nearest);
      const selected = match.players.find(({ id }) => (
        id === releasedControl.activePlayerId
      ));
      const traversal = nativeContactTraversalOrder(match.tick & 1);
      if (
        selected !== undefined
        && traversal.indexOf(selected.nativePlayerNumber)
          > traversal.indexOf(taker.nativePlayerNumber)
      ) {
        // INTELL.CPP pass_ball calls new_interceptor/reselect inside the
        // taker's go_team visit. Later player visits therefore observe the
        // newly selected user; earlier visits retain the entry selection.
        sourceControlledPlayerId = selected.id;
      }
    }
    const transitionInput = {
      ballPosition: match.ball.ball.position,
      postTakerBallPosition: contact.ballPosition,
      controlledPlayerId: sourceControlledPlayerId,
      logicCount: NATIVE_CAPTURE_LOGIC_COUNT_ROOT + Math.max(0, nextTick - 2),
      nextTick,
      players: match.players,
      possession: match.possession,
      // ready_set_kick clears match_mode, but get_target retains its
      // centre_guy_2 override for team A in ball zone 68. The source's team B
      // branch checks zone 69 while a team B centre owns zone 68, so that
      // branch deliberately falls through to ordinary zoning.
      receiverId: match.kickoff.owner.nativeTeamSlot === "A"
        ? match.kickoff.owner.receiverId
        : null,
      rngSeed: match.rng.state.seed,
      sourceTick: match.tick,
      tactics: match.tactics,
      takerId: match.kickoff.owner.takerId,
      teamRates: currentTeamRates(match.players, match.clock.gameMinute),
      zoning: match.kickoff.zoning,
    };
    const transitioned = {
      ...match,
      players: match.kickoff.launch?.tick === nextTick
        ? stepCssoccerFreePlayOpeningTeamTransition({
          ...transitionInput,
          kickoffMotion: match.kickoff.motion,
        })
        : stepCssoccerFreePlayOpeningTeamContinuation(transitionInput),
    };
    const continued = continueCurrentCentreOpponentRuns({
      match: transitioned,
      nextTick,
      sourceMatch: match,
    });
    const routed = initializeCurrentCentreOpponentRoutes({
      events,
      match: continued,
      nextTick,
      postTakerBallPosition: contact.ballPosition,
      sourceMatch: match,
    });
    // BALLINT.CPP ball_interact performs the held-ball contact tween during
    // the taker's go_team visit. process_offs therefore observes this position
    // on the same logic tick; process_anims must not materialize it later.
    return {
      ...routed,
      ball: createBallMatchState({
        ...routed.ball,
        ball: {
          ...routed.ball.ball,
          tick: nextTick,
          previousPosition: clone(match.ball.ball.position),
          position: clone(contact.ballPosition),
        },
      }),
    };
  }
  const justThrown = (
    match.kickoff.phase === "open-play"
    && match.kickoff.action?.released === true
    && match.ball.limbo.active !== 0
    && match.players.some((player) => player.liveRestart?.phase === "throw-released")
  );
  const postGoalBallCountdown = match.goal.phase === "awaiting-post-goal-handoff"
    && match.ball.outcome?.kind === "goal"
    && match.ball.ball.outOfPlay > 0;
  // ACTIONS.CPP go_team routes a nominally controlled player through
  // computer_play whenever a non-throw restart mode is active and the user
  // is not yet the ready set-piece taker. The control byte remains published.
  const sourceComputerControlsActive = match.rules.boundary?.phase === "delay"
    && match.rules.matchMode !== 0
    && match.rules.matchMode !== 11
    && match.rules.matchMode !== 12;
  const sourceControlledPlayerId = sourceComputerControlsActive
    ? null
    : match.control.activePlayerId;
  if (
    (match.kickoff.phase === "open-play" && match.kickoff.action?.released === true)
    || postGoalBallCountdown
  ) {
    const postGoalCelebrationPlayerIds = postGoalBallCountdown
      ? new Set(match.players
          .filter((player) => player.action.action.value === GOAL_CELEBRATION_ACTION)
          .map(({ id }) => id))
      : new Set();
    if (postGoalBallCountdown) match = bindPostGoalCountdownMotion(match);
    const sourceAiBallState = clone(match.ball);
    const sourceAiBall = clone(sourceAiBallState.ball);
    const sourceAiPossession = clone(match.possession);
    const sourceAiRng = clone(match.rng.state);
    const sourceLoopPlayers = match.players;
    const sourceEntryGameAction = match.rules.gameAction;
    const sourceKeeperHoldPlayerIds = new Set(sourceLoopPlayers
      .filter((player) => (
        player.role === "keeper"
        && player.action.action.value === CSSOCCER_KEEPER_ACTIONS.hold
        // An action installed during this same source visit does not execute
        // until the keeper reaches do_action on the following logic tick.
        && (
          (
            player.liveKeeper?.phase === "recover"
            && player.liveKeeper.recoveryStartTick < nextTick
          )
          || (
            player.liveKeeper?.phase === "hold"
            && player.liveKeeper.holdStartTick < nextTick
          )
        )
      ))
      .map(({ id }) => id));
    if (sourceKeeperHoldPlayerIds.size > 0) {
      // ACTIONS.CPP kphold_action publishes game_action=-1 from the keeper's
      // source-order do_action slot. Retain that final global value while
      // resolving its per-player visibility separately below.
      match = {
        ...match,
        rules: { ...match.rules, gameAction: -1 },
      };
    }
    match = advanceOpenPlayContactActions(match, nextTick);
    const contactPass = stepOpenPlayLooseBallContacts(
      match,
      events,
      nextTick,
      sourceAiBall,
      {
        justThrown,
        sourceKeeperHandsBall: sourcePredictionBall,
      },
    );
    publishPlayerVisits(contactPass.visits);
    if (
      CSSOCCER_DEBUG_ENV.CSSOCCER_DEBUG_VISITS
        ?.split(",")
        .includes(String(nextTick))
    ) {
      const debugPlayerIds = new Set([
        "spain-player-07",
        "spain-player-08",
        "argentina-player-02",
        "argentina-player-07",
      ]);
      console.error("open-play-visits", JSON.stringify({
        nextTick,
        sourcePossession: sourceAiPossession,
        contactedPossession: contactPass.match.possession,
        visits: contactPass.visits.filter(({ playerId }) => (
          debugPlayerIds.has(playerId)
        )),
        sourcePlayers: sourceLoopPlayers
          .filter(({ id }) => debugPlayerIds.has(id))
          .map((player) => ({
            id: player.id,
            position: player.position,
            facing: player.facing,
            action: player.action.action.value,
            intelligence: player.intelligence,
            liveMotion: player.liveMotion,
          })),
        contactedPlayers: contactPass.match.players
          .filter(({ id }) => debugPlayerIds.has(id))
          .map((player) => ({
            id: player.id,
            position: player.position,
            facing: player.facing,
            action: player.action.action.value,
            intelligence: player.intelligence,
            liveMotion: player.liveMotion,
          })),
      }));
    }
    const offsideSnapshotted = snapshotCurrentLivePassOffside({
      before: match,
      contacted: contactPass.match,
      events,
      nextTick,
      releases: contactPass.releases,
    });
    const passHandedOff = applyOpenPlayPassControlHandoff({
      before: match,
      command,
      contacted: offsideSnapshotted,
      events,
      releases: contactPass.releases,
    });
    const handedOff = applyOpenPlayCollectedControlHandoff({
      command,
      contacted: passHandedOff,
      events,
      playerDistanceFrame,
      postGoalBallCountdown,
      sourcePlayers: sourceLoopPlayers,
      sourcePossession: sourceAiPossession,
      visits: contactPass.visits,
    });
    const contacted = preserveControlForSourceOrderedUserVisit({
      before: match,
      handedOff,
      releases: contactPass.releases,
    });
    const stolen = resolveOpenPlayStealFootContacts(contacted, nextTick, events);
    const challenged = resolveOpenPlayChallengeContacts(
      stolen,
      nextTick,
      events,
      playerDistanceFrame,
    );
    const preTeamPlayers = challenged.players;
    const firstTeamBusy = projectSourceFirstTeamBusyIntercepts(
      challenged,
      nextTick,
      contactPass.visits,
      sourceAiPossession,
      sourceControlledPlayerId,
    );
    const releasedInterceptorReset = projectSourceReleasedPassInterceptorReset({
      nextTick,
      players: firstTeamBusy.players,
      releases: contactPass.releases,
      sourcePlayers: sourceLoopPlayers,
    });
    const sourceOrderedChallenge = {
      ...challenged,
      players: releasedInterceptorReset.players,
    };
    const expiredFirstTime = expireSourceCancelledFirstTimeIntercepts(
      sourceOrderedChallenge,
    );
    const logicCount = NATIVE_CAPTURE_LOGIC_COUNT_ROOT + Math.max(0, nextTick - 2);
    const takerId = postGoalBallCountdown
      ? null
      : sourceOrderedChallenge.kickoff.action?.recovered === true
      ? null
      : sourceOrderedChallenge.kickoff.action?.takerId
        ?? sourceOrderedChallenge.kickoff.owner.takerId;
    // A later source-order kick can release possession after an earlier
    // teammate has already run we_have_ball and requested support. Select
    // that request against the possession visible during those earlier
    // visits; the published match possession remains the post-release state.
    // The same ordering applies to collections: when the tick-entry holder
    // still owns the ball at his own visit, his earlier teammates can install
    // a support run before a later opponent collection changes the published
    // owner.
    const sourceHolderVisit = sourceAiPossession.owner === 0
      ? undefined
      : contactPass.visits.find(({ nativePlayerNumber }) => (
          nativePlayerNumber === sourceAiPossession.owner
        ));
    const supportPossession = (
      sourceHolderVisit?.possession.owner === sourceAiPossession.owner
    )
      ? sourceAiPossession
      : sourceOrderedChallenge.possession.owner !== 0
        ? sourceOrderedChallenge.possession
        : sourceAiPossession.owner !== 0
          ? sourceAiPossession
          : sourceOrderedChallenge.possession;
    const supportVisits = projectSourceSupportIntentVisits(
      contactPass.visits,
      supportPossession.owner,
    );
    const supportIntentBeforeHolder = resolveCssoccerFreePlaySupportIntent({
      candidateWindow: "before-holder",
      controlledPlayerId: sourceComputerControlsActive
        ? null
        : expiredFirstTime.control.activePlayerId,
      defensiveLines: defensiveLinesFrame,
      holderVisitCompleted: false,
      justScored: sourceOrderedChallenge.goal.justScored !== 0,
      logicCount,
      nextTick,
      offsideEnabled: sourceOrderedChallenge.config.rules.offside === true,
      players: expiredFirstTime.players,
      possession: supportPossession,
      rngSeed: expiredFirstTime.rng.state.seed,
      sourcePossession: sourceAiPossession,
      supportMe: retainedSourceSupportMe(sourceOrderedChallenge),
      takerId,
      visits: supportVisits,
    });
    const sourceHolderPlayer = sourceAiPossession.owner === 0
      ? undefined
      : expiredFirstTime.players.find(({ nativePlayerNumber }) => (
          nativePlayerNumber === sourceAiPossession.owner
        ));
    const laterCollectedHolderVisit = sourceOrderedChallenge.possession.owner === 0
      || sourceOrderedChallenge.possession.owner === sourceAiPossession.owner
      ? undefined
      : contactPass.visits.findLast((visit) => (
          visit.interaction === "collect"
          && visit.nativePlayerNumber === sourceOrderedChallenge.possession.owner
        ));
    let supportIntentBeforeDecision = supportIntentBeforeHolder;
    if (
      supportIntentBeforeHolder.run === null
      && supportIntentBeforeHolder.holderWantPassNativePlayer === 0
      && sourceHolderPlayer?.id === expiredFirstTime.control.activePlayerId
      && sourceHolderVisit !== undefined
      && laterCollectedHolderVisit !== undefined
      && contactPass.visits.indexOf(laterCollectedHolderVisit)
        > contactPass.visits.indexOf(sourceHolderVisit)
    ) {
      // A selected holder consumes no AI decision RNG. Teammates visited
      // after that holder can therefore raise want_pass before an opposing
      // player collects later in the same traversal. process_comments has
      // already run, so the new collector's got_ball/pass_decide observes
      // that cross-team requester for this one source visit.
      const afterSourceHolder = resolveCssoccerFreePlaySupportIntent({
        candidateWindow: "after-holder",
        controlledPlayerId: expiredFirstTime.control.activePlayerId,
        defensiveLines: defensiveLinesFrame,
        holderVisitCompleted: true,
        justScored: sourceOrderedChallenge.goal.justScored !== 0,
        logicCount,
        nextTick,
        offsideEnabled: sourceOrderedChallenge.config.rules.offside === true,
        players: expiredFirstTime.players,
        possession: supportPossession,
        rngSeed: expiredFirstTime.rng.state.seed,
        sourcePossession: sourceAiPossession,
        supportMe: retainedSourceSupportMe(sourceOrderedChallenge),
        takerId,
        visits: supportVisits,
      });
      const requester = afterSourceHolder.run === null
        ? undefined
        : expiredFirstTime.players.find(({ id }) => (
            id === afterSourceHolder.run.playerId
          ));
      const requesterVisit = requester === undefined
        ? undefined
        : contactPass.visits.find(({ playerId }) => playerId === requester.id);
      if (
        requester !== undefined
        && requesterVisit !== undefined
        && contactPass.visits.indexOf(requesterVisit)
          < contactPass.visits.indexOf(laterCollectedHolderVisit)
      ) {
        supportIntentBeforeDecision = {
          ...afterSourceHolder,
          holderWantPassNativePlayer: requester.nativePlayerNumber,
        };
      }
    }
    const sourceCommentChallenge = supportIntentBeforeDecision.resetPlayerId === null
      ? expiredFirstTime
      : {
          ...expiredFirstTime,
          players: expiredFirstTime.players.map((player) => (
            player.id === supportIntentBeforeDecision.resetPlayerId
              ? {
                  ...player,
                  intelligence: { special: 0, move: 0, count: 0 },
                }
              : player
          )),
        };
    const collectorVisitIndex = contactPass.visits.findLastIndex((visit) => (
      visit.interaction === "collect"
      && visit.nativePlayerNumber === sourceCommentChallenge.possession.owner
    ));
    const preCollectionReceiverSources = sourceLoopPlayers
      .filter((player) => {
        const visitIndex = contactPass.visits.findIndex(({ playerId }) => (
          playerId === player.id
        ));
        const visit = contactPass.visits[visitIndex];
        return collectorVisitIndex >= 0
          && visitIndex >= 0
          && visitIndex < collectorVisitIndex
          && visit.possession.owner === 0
          && player.passReceiverIntercept === true
          && Number.isSafeInteger(player.passReleaseTick)
          && player.intelligence.move === 1
          && player.intelligence.count === 1
          && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
          && player.liveMotion?.kind === "run";
      })
      .sort((left, right) => right.passReleaseTick - left.passReleaseTick);
    if (preCollectionReceiverSources.length > 1) {
      const latest = preCollectionReceiverSources[0].passReleaseTick;
      if (preCollectionReceiverSources[1].passReleaseTick === latest) {
        throw new Error("Source-order receiver expiry found multiple live pass receivers.");
      }
    }
    const preCollectionReceiverPlayerIds = new Set();
    let sourceOrderedReceiverChallenge = sourceCommentChallenge;
    const preCollectionReceiverSource = preCollectionReceiverSources[0];
    if (preCollectionReceiverSource !== undefined) {
      const sourceVisit = contactPass.visits.find(({ playerId }) => (
        playerId === preCollectionReceiverSource.id
      ));
      const currentReceiver = sourceCommentChallenge.players.find(({ id }) => (
        id === preCollectionReceiverSource.id
      ));
      if (sourceVisit === undefined || currentReceiver === undefined) {
        throw new Error("Source-order receiver expiry lost its current visit.");
      }
      const continued = continueFreeBallIntercept(
        currentReceiver,
        {
          ...sourceCommentChallenge,
          possession: sourceVisit.possession,
        },
        nextTick,
        { ballPosition: sourceVisit.ballPosition },
      );
      if (continued === null) {
        throw new Error("Source-order receiver expiry could not finish its old run.");
      }
      const expiredReceiver = {
        ...continued,
        facing: clone(currentReceiver.facing),
        intelligence: { special: 0, move: 0, count: 0 },
      };
      const receiverExpiryMatch = {
        ...sourceCommentChallenge,
        players: sourceCommentChallenge.players.map((player) => (
          player.id === expiredReceiver.id ? expiredReceiver : player
        )),
      };
      const receiverExpirySourcePlayers = sourceLoopPlayers.map((player) => (
        player.id === preCollectionReceiverSource.id
          ? {
              ...clone(player),
              intelligence: { special: 0, move: 0, count: 0 },
              liveMotion: {
                ...clone(player.liveMotion),
                // reset_ideas executes before free_ball/go_to_path and
                // shortens the expiring RUN_ACT to one source step.
                goCount: 1,
              },
            }
          : player
      ));
      const receiverExpiry = stepReleasedPassReceiverJourney({
        command,
        match: receiverExpiryMatch,
        nextTick,
        pinnedReceiverId: expiredReceiver.id,
        sourcePredictionState: sourceAiBallState,
        sourcePlayers: receiverExpirySourcePlayers,
        sourcePossessionOwner: sourceAiPossession.owner,
        visits: contactPass.visits,
        wantPassNativePlayer:
          supportIntentBeforeDecision.holderWantPassNativePlayer,
      });
      preCollectionReceiverPlayerIds.add(expiredReceiver.id);
      sourceOrderedReceiverChallenge = {
        ...receiverExpiryMatch,
        players: receiverExpiry.players,
        rng: {
          ...receiverExpiryMatch.rng,
          state: receiverExpiry.rng,
        },
      };
    }
    const sourceDecisionMatch = sourceComputerControlsActive
      ? {
          ...sourceOrderedReceiverChallenge,
          control: {
            ...sourceOrderedReceiverChallenge.control,
            activePlayerId: null,
          },
        }
      : sourceOrderedReceiverChallenge;
    const sourcePossessionProjection = projectSourcePossessionDecisionPlayers({
      command,
      extraBusyPlayerIds: [
        ...firstTeamBusy.playerIds,
        ...preCollectionReceiverPlayerIds,
      ],
      logicCount,
      match: sourceDecisionMatch,
      nearPath,
      nextTick,
      postGoalBallCountdown,
      sourceActivePlayerId: sourceControlledPlayerId,
      sourcePlayers: sourceLoopPlayers,
      sourcePossessionOwner: sourceAiPossession.owner,
      sourceZoneBallPosition: sourceAiBall.position,
      supportRun: supportIntentBeforeDecision.run,
      takerId,
      visits: contactPass.visits,
    });
    const sourceDecisionPlayers = sourcePossessionProjection.decisionPlayers;
    const possessionDecision = resolveOpenPlayCollectedPossession({
      match: sourceDecisionMatch,
      sourceDecisionPlayers,
      sourcePossessionOwner: sourceAiPossession.owner,
      visits: contactPass.visits,
      wantPassNativePlayer: supportIntentBeforeDecision.holderWantPassNativePlayer,
    });
    // collect_ball can hand control to the holder before a later teammate's
    // we_have_ball visit. That requester reads the holder after the same-slot
    // user_play movement and process_dir turn, not the tick-entry facing.
    const supportDecisionBasePlayers = expiredFirstTime.players.some((player) => (
      player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
      && player.intelligence.count > 0
    ))
      ? expiredFirstTime.players
      : sourcePossessionProjection.supportPlayers;
    const sourceSupportDecisionPlayers = supportIntentBeforeDecision.run === null
      ? applyOpenPlayCollectedUserVisit({
          ball: sourceOrderedReceiverChallenge.ball,
          command,
          events,
          match: {
            ...sourceOrderedReceiverChallenge,
            players: supportDecisionBasePlayers,
          },
          nextTick,
          players: supportDecisionBasePlayers,
          sourcePlayers: sourceLoopPlayers,
          sourcePossessionOwner: sourceAiPossession.owner,
          visits: contactPass.visits,
        })
      : expiredFirstTime.players;
    // process_teams visits the holder before later teammates. got_ball can
    // consume RNG before a later we_have_ball/help_chance visit, so only
    // search that remaining traversal window with the holder's resulting
    // seed. A request installed before the holder already owns want_pass and
    // prevents any second request in the same source pass.
    let supportIntent = supportIntentBeforeDecision.run !== null
      ? supportIntentBeforeDecision
      : resolveCssoccerFreePlaySupportIntent({
          candidateWindow: "after-holder",
          controlledPlayerId: sourceComputerControlsActive
            ? null
            : expiredFirstTime.control.activePlayerId,
          defensiveLines: defensiveLinesFrame,
          holderVisitCompleted:
            supportPossession.owner === sourceOrderedReceiverChallenge.possession.owner,
          justScored: sourceOrderedChallenge.goal.justScored !== 0,
          logicCount,
          nextTick,
          offsideEnabled: sourceOrderedChallenge.config.rules.offside === true,
          players: sourceSupportDecisionPlayers,
          possession: supportPossession,
          rngSeed: possessionDecision.rng.seed,
          sourcePossession: sourceAiPossession,
          supportMe: retainedSourceSupportMe(sourceOrderedChallenge),
          takerId,
          visits: supportVisits,
        });
    const publishedSupportOwner = contactPass.match.possession.owner;
    if (
      supportIntent.run === null
      && publishedSupportOwner !== 0
      && publishedSupportOwner !== supportPossession.owner
    ) {
      // collect_ball can open a second ownership window in the later team
      // traversal. A teammate after that collector runs we_have_ball against
      // the new holder even though the tick-entry holder and his earlier
      // teammates saw the old owner. Resolve that late window independently;
      // any already-live source-global request still suppresses a new one.
      const collectedPossession = contactPass.collections.findLast(
        ({ nativePlayerNumber }) => nativePlayerNumber === publishedSupportOwner,
      )?.possession ?? contactPass.match.possession;
      const lateSupportIntent = resolveCssoccerFreePlaySupportIntent({
        candidateWindow: "after-holder",
        controlledPlayerId: sourceComputerControlsActive
          ? null
          : expiredFirstTime.control.activePlayerId,
        defensiveLines: defensiveLinesFrame,
        holderVisitCompleted: true,
        justScored: sourceOrderedChallenge.goal.justScored !== 0,
        logicCount,
        nextTick,
        offsideEnabled: sourceOrderedChallenge.config.rules.offside === true,
        players: sourceSupportDecisionPlayers,
        possession: collectedPossession,
        rngSeed: possessionDecision.rng.seed,
        sourcePossession: sourceAiPossession,
        supportMe: retainedSourceSupportMe(sourceOrderedChallenge),
        takerId,
        visits: projectSourceSupportIntentVisits(
          contactPass.visits,
          publishedSupportOwner,
        ),
      });
      if (lateSupportIntent.run !== null) supportIntent = lateSupportIntent;
    }
    if (
      supportIntent.resetPlayerId !== supportIntentBeforeDecision.resetPlayerId
      || supportIntent.holderWantPassNativePlayer
        !== supportIntentBeforeDecision.holderWantPassNativePlayer
    ) {
      throw new Error("Source-ordered support intent changed pre-holder global state.");
    }
    let decided = {
      ...sourceOrderedReceiverChallenge,
      rng: {
        ...sourceOrderedChallenge.rng,
        state: possessionDecision.rng,
      },
    };
    let controlIntercepts = projectSourceControlIntercepts(decided, nextTick, {
      visits: contactPass.visits,
    });
    if (postGoalBallCountdown) {
      const controlledId = decided.control.activePlayerId;
      controlIntercepts = {
        ...controlIntercepts,
        players: controlIntercepts.players.map((player, index) => (
          player.id === controlledId ? decided.players[index] : player
        )),
        playerIds: controlIntercepts.playerIds.filter((id) => id !== controlledId),
      };
    }
    decided = { ...decided, players: controlIntercepts.players };
    const cancelledFirstTime = projectSourceCancelledFirstTimeIntercepts(
      decided,
      nextTick,
      contactPass.visits,
    );
    decided = { ...decided, players: cancelledFirstTime.players };
    const activeFirstTime = projectSourceBusyFirstTimeChipIntercepts(
      decided,
      nextTick,
      contactPass.visits,
    );
    decided = { ...decided, players: activeFirstTime.players };
    const expiringOffsideRunbacks = projectSourceExpiringOffsideRunbacks(
      decided,
      nextTick,
      contactPass.visits,
    );
    decided = { ...decided, players: expiringOffsideRunbacks.players };
    const secondTeamBusy = projectSourceSecondTeamBusyIntercepts(
      decided,
      nextTick,
      sourceAiPossession,
      contactPass.visits,
      firstTeamBusy.playerIds,
      sourceControlledPlayerId,
    );
    decided = { ...decided, players: secondTeamBusy.players };
    const displacedDribble = projectSourceBusyDisplacedDribbleRuns(
      decided,
      nextTick,
      sourceAiPossession,
      contactPass.visits,
    );
    decided = { ...decided, players: displacedDribble.players };
    const expiringFreeBall = projectSourceExpiringFreeBallIntercepts(
      decided,
      nextTick,
      {
        command,
        releases: contactPass.releases,
        skipPlayerIds: [
          ...firstTeamBusy.playerIds,
          ...secondTeamBusy.playerIds,
          ...preCollectionReceiverPlayerIds,
        ],
        visits: contactPass.visits,
      },
    );
    decided = { ...decided, players: expiringFreeBall.players };
    const busyFreeBall = projectSourceBusyFreeBallIntercepts(
      decided,
      nextTick,
      [
        ...firstTeamBusy.playerIds,
        ...secondTeamBusy.playerIds,
        ...expiringFreeBall.replannedPlayerIds,
        ...activeFirstTime.playerIds,
        ...preCollectionReceiverPlayerIds,
      ],
      contactPass.visits,
    );
    decided = { ...decided, players: busyFreeBall.players };
    const busySupport = projectSourceBusySupportRuns(
      decided,
      nextTick,
      sourceAiBall,
      {
        controlledPlayerId: sourceControlledPlayerId,
        resetPlayerId: supportIntent.resetPlayerId,
        supportRunPlayerId: supportIntent.run?.playerId ?? null,
        visits: contactPass.visits,
      },
    );
    decided = { ...decided, players: busySupport.players };
    const sourceTraversal = nativeContactTraversalOrder(match.tick & 1);
    const retainedReleasedReceiverIds = new Set(sourceLoopPlayers.flatMap((player) => {
      const sourceVisit = contactPass.visits.find(({ playerId }) => (
        playerId === player.id
      ));
      const collectedAfterVisit = decided.possession.owner !== 0
        && sourceVisit?.possession.owner === 0;
      if (
        player.passReceiverIntercept === true
        && Number.isSafeInteger(player.passReleaseTick)
        && collectedAfterVisit
      ) {
        return [player.id];
      }
      const pass = readSourceReleasedPass(player);
      if (
        pass === null
        || !(
          pass.release.tick < nextTick
          || (
            pass.release.tick === nextTick
            && sourceTraversal.indexOf(pass.targetNativePlayer)
              > sourceTraversal.indexOf(player.nativePlayerNumber)
          )
        )
      ) {
        return [];
      }
      const receiver = sourceLoopPlayers.find(({ nativePlayerNumber }) => (
        nativePlayerNumber === pass.targetNativePlayer
      ));
      const receiverVisit = receiver === undefined
        ? undefined
        : contactPass.visits.find(({ playerId }) => playerId === receiver.id);
      return receiver === undefined
        || receiver.role === "keeper"
        || decided.possession.owner === 0
        || receiverVisit?.possession.owner !== 0
        ? []
        : [receiver.id];
    }));
    const continuingCloseDownPlayerIds = new Set(decided.players
      .filter((player) => (
        player.intelligence.move === CLOSE_DOWN_INTELLIGENCE_MOVE
        && player.intelligence.count > 1
      ))
      .map(({ id }) => id));
    const busyPlayerIds = new Set([
      ...decided.players
        .filter((player) => (
          player.livePass !== undefined
          || player.liveShot !== undefined
          || player.liveKeeper !== undefined
          || player.sourceKeeperStandTick === nextTick
          || player.liveFirstTimeIntercept !== undefined
          || (
            player.liveControlIntercept !== undefined
            && player.liveControlIntercept.phase !== "tween"
          )
          || (
            player.liveContact !== undefined
            && player.liveContact.phase !== "barge"
          )
          || player.liveRestart !== undefined
        ))
        .map(({ id }) => id),
      ...possessionDecision.passActions.map(({ holderId }) => holderId),
      ...possessionDecision.shotActions.map(({ holderId }) => holderId),
      ...firstTeamBusy.playerIds,
      ...controlIntercepts.playerIds,
      ...cancelledFirstTime.playerIds,
      ...activeFirstTime.playerIds,
      ...secondTeamBusy.playerIds,
      ...displacedDribble.playerIds,
      ...expiringFreeBall.replannedPlayerIds,
      ...expiringFreeBall.playerIds.filter((id) => (
        retainedReleasedReceiverIds.has(id)
      )),
      ...preCollectionReceiverPlayerIds,
      ...busyFreeBall.playerIds,
      ...busySupport.playerIds,
      ...continuingCloseDownPlayerIds,
      // intelligence ran while this keeper was still in SAVE_ACT. Its
      // terminal save_action installed STAND afterward, so find_zonal_target
      // cannot run until the following source visit.
      // A busy outfielder skips ordinary intelligence and find_zonal_target
      // checks int_cnt before replacing MC_SOCKS. The keeper branch has no
      // such guard: stand_action still runs keeper positioning, whose
      // init_stand_act/init_run_act immediately resets I_GET_UP.
      ...currentSourceSocksBusyPlayerIds(decided.players).filter((playerId) => (
        decided.players.find(({ id }) => id === playerId)?.role !== "keeper"
      )),
      ...postGoalCelebrationPlayerIds,
    ]);
    const preHandoffControlledPlayerId = sourceControlledPlayerId;
    const preHandoffVisitIndex = contactPass.visits.findIndex(
      ({ playerId }) => playerId === preHandoffControlledPlayerId,
    );
    const sourceCollectionHandoff = events.find(({ type, previousPlayerId }) => (
      type === "ball-collected-control-handoff"
      && previousPlayerId === preHandoffControlledPlayerId
    ));
    const collectionHandoffVisitIndex =
      sourceCollectionHandoff?.sourceVisitIndex ?? -1;
    const postHandoffControlledVisitIndex = contactPass.visits.findIndex(
      ({ playerId }) => playerId === decided.control.activePlayerId,
    );
    if (
      preHandoffControlledPlayerId !== decided.control.activePlayerId
      && preHandoffVisitIndex >= 0
      && collectionHandoffVisitIndex > preHandoffVisitIndex
    ) {
      // reselect changes control during the later collector's visit; it cannot
      // retroactively replace the earlier user_play slot.
      busyPlayerIds.add(preHandoffControlledPlayerId);
    }
    // A same-visit collection resets an old intercept/contact journey before
    // got_ball installs the newly selected run. That run owns this visit.
    for (const playerId of possessionDecision.runPlayerIds) {
      busyPlayerIds.delete(playerId);
    }
    const sourceJourneyControlledPlayerId = !postGoalBallCountdown
      ? sourceComputerControlsActive
        ? null
        : decided.control.activePlayerId
      : sourceComputerControlsActive
      ? null
      : preHandoffControlledPlayerId === decided.control.activePlayerId
        || collectionHandoffVisitIndex < 0
        ? decided.control.activePlayerId
        // BALLINT.CPP collect_ball/reselect runs before this same slot reads
        // teams[player_num-1].control and enters user_play. Equality therefore
        // belongs to the newly controlled collector, not the computer journey.
        : postHandoffControlledVisitIndex >= collectionHandoffVisitIndex
          ? decided.control.activePlayerId
          : preHandoffVisitIndex >= 0
            && preHandoffVisitIndex < collectionHandoffVisitIndex
            ? preHandoffControlledPlayerId
            : null;
    decided = {
      ...decided,
      players: consumeSourceReleasedInterceptorFinalRuns(
        decided.players,
        nextTick,
      ),
    };
    const journeyInput = {
      // collect_ball can reselect a player whose native slot already ran.
      // Keep the control byte's final owner separate from the user_play slot
      // that was actually controlled during this traversal.
      controlledPlayerId: sourceJourneyControlledPlayerId,
      freeBallOutOfPlay: !postGoalBallCountdown
        && decided.ball.ball.outOfPlay !== 0
        && sourceAiPossession.owner === 0,
      logicCount,
      nextTick,
      players: decided.players,
      possessionKicks: [...busyPlayerIds],
      possessionRuns: possessionDecision.runPlayerIds.filter((id) => !busyPlayerIds.has(id)),
      rngSeed: decided.rng.state.seed,
      // get_opp_dir_tab runs inside the holder's go_team visit. Opponents
      // whose team ran first are already at their same-tick positions, while
      // tm_dist remains the player_distances frame captured before either
      // team. Keep that source-ordered position/action frame separate from
      // the ordinary journey input so those players are not advanced twice.
      sourceDecisionPlayers,
      supportRun: supportIntent.run,
      tactics: decided.tactics,
      takerId,
      teamRates: currentTeamRates(decided.players, decided.clock.gameMinute),
      visits: contactPass.visits,
      // INTELL.CPP get_target suppresses analogue zone interpolation for the
      // full ball_out_of_play countdown, even before init_match_mode resets
      // the teams for the awarded restart.
      zoneAnalogue: !postGoalBallCountdown && decided.ball.ball.outOfPlay === 0,
      // BALL.CPP get_ball_zone remains suppressed for the entire goal
      // out-of-play countdown, including a possessed KICK_ACT tween. Do not
      // replace the retained goal zone with the holder's live kick position.
      zoneBallPosition: postGoalBallCountdown
        ? decided.ball.outcome?.crossing ?? decided.ball.ball.position
        : sourceHeldKickZoneBallPosition(
            decided.players,
            sourceAiPossession.owner,
          ) ?? sourceAiBall.position,
      // BALL.CPP publishes one persistent zone frame in process_ball before
      // either team runs. In particular, an out-of-play crossing must retain
      // the last valid in-pitch zone rather than derive an impossible row
      // from the current stadium-space ball coordinate.
      zoneState: decided.kickoff.zoning,
    };
    let players = stepCssoccerFreePlayTeamJourneyContinuation(journeyInput);
    if (contactPass.visits.some(({ interaction }) => interaction === "rebound")) {
      // BALLINT.CPP rebound_off_plr calls reset_shot at the rebounder's
      // source visit. The current team journey still needs the retained
      // pending-shot carrier for a keeper who visited earlier, but no later
      // tick may continue treating that released shot as pending.
      players = clearLivePendingShots(players);
    }
    const sourceSocksKeepers = new Set(decided.players
      .filter((player) => (
        player.role === "keeper"
        && currentSourceSocksBusyPlayerIds([player]).length === 1
      ))
      .map(({ id }) => id));
    if (sourceSocksKeepers.size > 0) {
      players = players.map((player) => sourceSocksKeepers.has(player.id)
        ? {
            ...player,
            intelligence: { special: 0, move: 0, count: 0 },
          }
        : player);
    }
    players = bindSourceOrderedPossessionRunAnimationSteps({
      finalPossession: decided.possession,
      players,
      runPlayerIds: possessionDecision.runPlayerIds,
      visits: contactPass.visits,
    });
    players = projectSourceDisplacedHolderVisit({
      finalPossession: decided.possession,
      journeyInput,
      players,
      sourcePossession: sourceAiPossession,
    });
    if (continuingCloseDownPlayerIds.size > 0) {
      const closeDownVisits = new Map(contactPass.visits.map((visit) => [
        visit.playerId,
        visit,
      ]));
      const closeDownRates = new Map(currentTeamRates(
        decided.players,
        decided.clock.gameMinute,
      ).map(({ id, value }) => [id, value]));
      players = players.map((player) => {
        if (!continuingCloseDownPlayerIds.has(player.id)) return player;
        const source = decided.players.find(({ id }) => id === player.id);
        const visit = closeDownVisits.get(player.id);
        if (source === undefined || visit === undefined) {
          throw new Error(`Open-play close-down lost source visit for ${player.id}.`);
        }
        return stepCurrentCloseDownPlayer({
          ballPosition: visit.ballPosition,
          count: source.intelligence.count - 1,
          fresh: false,
          nextTick,
          player: source,
          teamRate: closeDownRates.get(player.id),
        });
      });
    }
    if (
      expiringFreeBall.playerIds.length > 0
      || expiringOffsideRunbacks.playerIds.length > 0
    ) {
      const expiringIds = new Set([
        ...expiringFreeBall.playerIds,
        ...expiringOffsideRunbacks.playerIds,
      ]);
      players = players.map((player) => expiringIds.has(player.id)
        ? {
            ...player,
            // find_zonal_target executes the newly installed go_forward once,
            // then clears the journey counter at the end of the same visit.
            liveMotion: { ...player.liveMotion, goCount: 0 },
          }
        : player);
    }
    if (sourceAiRng.seed !== decided.rng.state.seed) {
      // Each team's keeper is its first stand_action visit. The holder's
      // later pass/dribble decisions may advance the global RNG, but cannot
      // retroactively trigger the keeper's socks branch.
      const sourceKeeperPlayers = stepCssoccerFreePlayTeamJourneyContinuation({
        ...journeyInput,
        rngSeed: sourceAiRng.seed,
      });
      players = players.map((player, index) => (
        player.role === "keeper" ? sourceKeeperPlayers[index] : player
      ));
    }
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
      sourcePredictionBall,
    });
    const shotPlayers = initializeOpenPlayShotActions({
      match: decided,
      nextTick,
      players: actionPlayers,
      shotActions: possessionDecision.shotActions,
      sourcePredictionBall,
    });
    const receiverJourney = stepReleasedPassReceiverJourney({
      command,
      match: { ...decided, players: shotPlayers },
      nextTick,
      sourceEntryPlayers: sourceLoopPlayers,
      sourcePredictionState: sourceAiBallState,
      sourcePlayers: decided.players,
      sourcePossessionOwner: sourceAiPossession.owner,
      visits: contactPass.visits,
      wantPassNativePlayer: supportIntent.holderWantPassNativePlayer,
    });
    let opponentFreeBallJourney = receiverJourney;
    let freeBallControl = decided.control;
    let freeBallAutoSelectedPlayerId = null;
    const traversal = nativeContactTraversalOrder(match.tick & 1);
    const sameTickReleaser = receiverJourney.players.find((player) => (
      readSourceReleasedPass(player)?.release.tick === nextTick
      || player.liveShot?.release?.tick === nextTick
    ));
    const frozenAnimationPrediction = sourceFrozenAnimationPrediction(
      receiverJourney.players,
      decided.ball,
    );
    // pass_ball calls new_interceptor/reselect and replaces the near-path
    // globals from its released prediction. shoot_ball does neither: later
    // visits keep the get_nearest choices captured before the shot.
    const sameTickPass = sameTickReleaser === undefined
      ? null
      : readSourceReleasedPass(sameTickReleaser);
    const releasedPrediction = sameTickPass?.releaseBall ?? null;
    const releasedReceiver = Number.isSafeInteger(
      sameTickPass?.targetNativePlayer,
    )
      ? sourceLoopPlayers.find(({ nativePlayerNumber }) => (
          nativePlayerNumber === sameTickPass.targetNativePlayer
        )) ?? null
      : null;
    const retainedReleasedPass = sourceLoopPlayers
      .map((player) => ({
        player,
        pass: readSourceReleasedPass(player),
      }))
      .find(({ player, pass }) => (
        pass !== null
        && (
          pass.release.tick < nextTick
          || (
            pass.release.tick === nextTick
            && traversal.indexOf(pass.targetNativePlayer)
              > traversal.indexOf(player.nativePlayerNumber)
          )
        )
      ))?.pass ?? null;
    const retainedReleasedReceiver = Number.isSafeInteger(
      retainedReleasedPass?.targetNativePlayer,
    )
      ? sourceLoopPlayers.find(({ nativePlayerNumber }) => (
          nativePlayerNumber === retainedReleasedPass.targetNativePlayer
        )) ?? null
      : null;
    const explicitReleasedReceiver =
      releasedReceiver ?? retainedReleasedReceiver;
    // get_nearest runs before process_teams, but pass_ball rebuilds the
    // prediction and new_interceptor/reselect can replace both near_path
    // globals during the releaser's visit. Players on the later team have
    // not moved yet, so select that path from the loop-entry player frame.
    // The receiver team remains pinned to new_interceptor's explicit target.
    const automaticNearPaths = (releasedPrediction === null
      ? [nearPath, opponentNearPath].map((player) => (
          explicitReleasedReceiver !== null
          && player?.nativeTeamSlot === explicitReleasedReceiver.nativeTeamSlot
            ? explicitReleasedReceiver
            : player
        ))
      : ["A", "B"].map((nativeTeamSlot) => (
          releasedReceiver?.nativeTeamSlot === nativeTeamSlot
            ? releasedReceiver
            : selectFreeBallNearPathPlayer(
                {
                  ...decided,
                  players: sourceLoopPlayers,
                },
                nativeTeamSlot,
                command,
                releasedPrediction,
              )
        )))
      // stepReleasedPassReceiverJourney already owns the explicit receiver's
      // go_to_path and its first-time RNG. The other team's later near-path
      // visit still runs even when that receiver scan consumed RNG.
      .filter((player, index, players) => (
        player !== null
        && player.id !== explicitReleasedReceiver?.id
        && players.findIndex((candidate) => candidate?.id === player.id) === index
      ))
      .sort((left, right) => (
        traversal.indexOf(left.nativePlayerNumber)
        - traversal.indexOf(right.nativePlayerNumber)
      ));
    for (const automaticNearPath of automaticNearPaths) {
      opponentFreeBallJourney = stepOpponentFreeBallJourney({
        command,
        match: {
          ...decided,
          players: opponentFreeBallJourney.players,
          rng: { ...decided.rng, state: opponentFreeBallJourney.rng },
          control: freeBallControl,
        },
        nearPath: automaticNearPath,
        nextTick,
        skipPlayerIds: busyPlayerIds,
        sourcePredictionState:
          releasedPrediction === null ? sourceAiBallState : null,
        sourcePlayers: sourceLoopPlayers,
        sourcePossessionOwner: sourceAiPossession.owner,
        visits: contactPass.visits,
        wantPassNativePlayer: supportIntent.holderWantPassNativePlayer,
        frozenLimboPrediction: clone(frozenAnimationPrediction),
      });
      if (opponentFreeBallJourney.autoSelectedPlayerId !== null
        && opponentFreeBallJourney.autoSelectedPlayerId !== undefined) {
        freeBallAutoSelectedPlayerId =
          opponentFreeBallJourney.autoSelectedPlayerId;
        events.push({
          type: "free-ball-control-handoff",
          tick: nextTick,
          previousPlayerId: freeBallControl.activePlayerId,
          activePlayerId: freeBallAutoSelectedPlayerId,
        });
        freeBallControl = {
          ...freeBallControl,
          activePlayerId: freeBallAutoSelectedPlayerId,
        };
      }
    }
    if (
      sourceControlledPlayerId !== null
      && freeBallAutoSelectedPlayerId !== null
      && sourceControlledPlayerId !== freeBallAutoSelectedPlayerId
    ) {
      const handoffVisitIndex = contactPass.visits.findIndex(({ playerId }) => (
        playerId === freeBallAutoSelectedPlayerId
      ));
      const previousControlledVisitIndex = contactPass.visits.findIndex(
        ({ playerId }) => playerId === sourceControlledPlayerId,
      );
      if (
        handoffVisitIndex >= 0
        && previousControlledVisitIndex > handoffVisitIndex
      ) {
        // free_ball/new_interceptor reselects inside the new player's
        // go_team visit. The prior user is still ahead in native traversal,
        // so his later slot now runs computer_play rather than disappearing
        // from this tick.
        const postHandoffComputerPlayers =
          stepCssoccerFreePlayTeamJourneyContinuation({
            ...journeyInput,
            controlledPlayerId: freeBallAutoSelectedPlayerId,
            players: opponentFreeBallJourney.players,
            rngSeed: opponentFreeBallJourney.rng.seed,
          });
        const postHandoffPrevious = postHandoffComputerPlayers.find(
          ({ id }) => id === sourceControlledPlayerId,
        );
        if (postHandoffPrevious === undefined) {
          throw new Error(
            "Free-ball source-order handoff lost the previous controlled player.",
          );
        }
        opponentFreeBallJourney = {
          ...opponentFreeBallJourney,
          players: opponentFreeBallJourney.players.map((player) => (
            player.id === sourceControlledPlayerId
              ? postHandoffPrevious
              : player
          )),
        };
      }
    }
    const receiverDecided = {
      ...decided,
      players: opponentFreeBallJourney.players,
      rng: { ...decided.rng, state: opponentFreeBallJourney.rng },
      control: freeBallControl,
    };
    let directedPlayers = sourceComputerControlsActive
      ? opponentFreeBallJourney.players
      : stepControlledStandingProcessDirection({
          command,
          gameAction: sourceGameActionAtPlayerVisit({
            entryGameAction: sourceEntryGameAction,
            keeperHoldPlayerIds: sourceKeeperHoldPlayerIds,
            playerId: receiverDecided.control.activePlayerId,
            visits: contactPass.visits,
          }),
          match: receiverDecided,
          nextTick,
          players: opponentFreeBallJourney.players,
          visits: contactPass.visits,
        });
    const sourceVisitControlledPlayerId = sourceControlledPlayerId;
    const sourceVisitControlledIndex = contactPass.visits.findIndex(
      ({ playerId }) => playerId === sourceVisitControlledPlayerId,
    );
    const sourceCollectionHandoffIndex = collectionHandoffVisitIndex;
    const sourceFreeBallHandoffIndex = freeBallAutoSelectedPlayerId === null
      ? -1
      : contactPass.visits.findIndex(({ playerId }) => (
          playerId === freeBallAutoSelectedPlayerId
        ));
    const sourceControlHandoffIndex = Math.max(
      sourceCollectionHandoffIndex,
      sourceFreeBallHandoffIndex,
    );
    if (
      sourceVisitControlledPlayerId !== receiverDecided.control.activePlayerId
      && sourceVisitControlledIndex >= 0
      && sourceControlHandoffIndex > sourceVisitControlledIndex
    ) {
      directedPlayers = stepControlledStandingProcessDirection({
        command,
        gameAction: sourceGameActionAtPlayerVisit({
          entryGameAction: sourceEntryGameAction,
          keeperHoldPlayerIds: sourceKeeperHoldPlayerIds,
          playerId: sourceVisitControlledPlayerId,
          visits: contactPass.visits,
        }),
        match: {
          ...receiverDecided,
          control: {
            ...receiverDecided.control,
            activePlayerId: sourceVisitControlledPlayerId,
          },
        },
        nextTick,
        players: directedPlayers,
        visits: contactPass.visits,
      });
    }
    const sourceVisitedPlayers = applyOpenPlayCollectedUserVisit({
      ball: receiverDecided.ball,
      command,
      events,
      match: receiverDecided,
      nextTick,
      players: directedPlayers,
      sourcePlayers: sourceLoopPlayers,
      sourcePossessionOwner: sourceAiPossession.owner,
      visits: contactPass.visits,
    });
    const activeJourneyPlayers = postGoalBallCountdown
      ? sourceVisitedPlayers
      : sourceComputerControlsActive
        ? sourceVisitedPlayers
        : freeBallAutoSelectedPlayerId !== null
          ? sourceVisitedPlayers
        : stepActiveFreeBallJourney(
            receiverDecided,
            sourceVisitedPlayers,
            nextTick,
            command,
            contactPass.visits,
            nearPath,
            sourceLoopPlayers,
            sourceAiPossession,
            sourceControlledPlayerId,
            sourceAiBallState,
          );
    const controlledFreeBall = stepReleasedGoalKickControlHandoff({
      command,
      events,
      match: { ...receiverDecided, players: activeJourneyPlayers },
      nearPath,
      nextTick,
      sourcePlayers: preTeamPlayers,
    });
    const aiChallengeSource = {
      ballState: sourceAiBallState,
      // BALL.CPP rebuilds ball_pred_tab from the post-process_ball state
      // before either team visits. A later collection changes ball_poss but
      // does not rebuild that table, so opponent go_to_path must keep this
      // physical-ball frame rather than the loop-entry ball snapshot.
      predictionBall: sourceAiBall,
      possession: sourceAiPossession,
      playerDistances: playerDistanceFrame,
      playerDistanceRanks: playerDistanceRankFrame,
      reselection: contactPass.reselection,
      visits: contactPass.visits,
    };
    const aiChallengeSourcePlayers = supportIntent.resetPlayerId === null
      ? preTeamPlayers
      : preTeamPlayers.map((player) => (
          player.id === supportIntent.resetPlayerId
            ? {
                ...player,
                // process_comments runs before process_teams. A last-touch
                // change clears I_RUN_ON before this player's intelligence
                // visit, so opponent pressure may replace the stale route
                // immediately instead of treating the request as busy.
                intelligence: { special: 0, move: 0, count: 0 },
              }
            : player
        ));
    const preCollectionPressure = initializeOpenPlayAiChallenges(
      {
        ...controlledFreeBall,
        rng: {
          ...controlledFreeBall.rng,
          state: sourceDecisionMatch.rng.state,
        },
      },
      nextTick,
      events,
      aiChallengeSourcePlayers,
      sourceAiBall,
      { ...aiChallengeSource, pressureWindow: "before-collection" },
    );
    const preCollectionJourney = {
      ...preCollectionPressure,
      rng: controlledFreeBall.rng,
    };
    let sourceWindowJourney = preCollectionJourney;
    const sourceEntryOwner = sourceAiPossession.owner;
    const finalOwner = contactPass.match.possession.owner;
    const intermediateOwners = new Set();
    for (const collection of contactPass.collections) {
      if (
        collection.nativePlayerNumber === sourceEntryOwner
        || collection.nativePlayerNumber === finalOwner
        || intermediateOwners.has(collection.nativePlayerNumber)
      ) {
        continue;
      }
      intermediateOwners.add(collection.nativePlayerNumber);
      // A traversal can temporarily change owner and return to its entry
      // owner before the tick ends. Neither the old "before collection" nor
      // final-owner pressure pass sees that middle window. Replay the
      // collected owner's exact ball/possession snapshot for players whose
      // own source visit observed it, then restore the published final state.
      const pressuredWindow = initializeOpenPlayAiChallenges(
        {
          ...sourceWindowJourney,
          ball: collection.ball,
          possession: collection.possession,
        },
        nextTick,
        events,
        aiChallengeSourcePlayers,
        collection.ball.ball,
        {
          ...aiChallengeSource,
          ballState: collection.ball,
          possession: collection.possession,
          predictionBall: collection.ball.ball,
          pressureWindow: "final",
          reselection: collection.reselection,
        },
      );
      sourceWindowJourney = {
        ...pressuredWindow,
        ball: preCollectionJourney.ball,
        possession: preCollectionJourney.possession,
        rng: preCollectionJourney.rng,
      };
    }
    const journey = initializeOpenPlayAiChallenges(
      sourceWindowJourney,
      nextTick,
      events,
      aiChallengeSourcePlayers,
      sourceAiBall,
      {
        ...aiChallengeSource,
        // A same-traversal collect/hold publishes the ball frame observed by
        // the later opponent visit. This is also the retained go_to_path
        // prediction origin for that second traversal window.
        ballState: sourceAiPossession.owner !== contactPass.match.possession.owner
          ? contactPass.match.ball
          : sourceAiBallState,
        predictionBall: sourceAiPossession.owner !== contactPass.match.possession.owner
          ? contactPass.match.ball.ball
          : sourceAiBall,
        pressureWindow: "final",
      },
    );
    let offsideJourney = applyOpenPlayOffsideRunbacks({
      aiChallengePlayerIds: currentOpenPlayAiRoutePlayerIds(events, nextTick),
      command,
      completedRunbackPlayerIds: expiringOffsideRunbacks.playerIds,
      defensiveLines: defensiveLinesFrame,
      expiredInterceptPlayerIds: expiringFreeBall.playerIds,
      logicCount,
      match: sourceComputerControlsActive
        ? {
            ...journey,
            control: { ...journey.control, activePlayerId: null },
          }
        : journey,
      nextTick,
      sourcePlayers: preTeamPlayers,
      visits: contactPass.visits,
    });
    if (sourceComputerControlsActive) {
      offsideJourney = { ...offsideJourney, control: journey.control };
    }
    if (postGoalBallCountdown) {
      offsideJourney = completePostGoalCelebrationActions(
        offsideJourney,
        postGoalCelebrationPlayerIds,
        nextTick,
      );
    }
    const debugTussleIds = CSSOCCER_DEBUG_ENV.CSSOCCER_DEBUG_TUSSLE
      ?.split(",")
      .filter(Boolean) ?? [];
    if (
      debugTussleIds.length > 0
      && CSSOCCER_DEBUG_ENV.CSSOCCER_DEBUG_TICK === String(nextTick)
    ) {
      console.error("open-play-pre-tussle", JSON.stringify({
        possession: offsideJourney.possession.owner,
        players: offsideJourney.players
          .filter(({ id }) => debugTussleIds.includes(id))
          .map((player) => ({
            id: player.id,
            position: player.position,
            facing: player.facing,
            action: player.action.action.value,
            intelligence: player.intelligence,
            animation: player.animation,
            liveMotion: player.liveMotion,
          })),
      }));
    }
    const socksStarted = applyOpenPlayFreshSocksActions({
      match: offsideJourney,
      nextTick,
      sourcePlayers: sourceLoopPlayers,
      visits: contactPass.visits,
    });
    const eventCountBeforeTussles = events.length;
    const tussled = resolveOpenPlayPlayerTussles(socksStarted, nextTick, events);
    if (
      debugTussleIds.length > 0
      && CSSOCCER_DEBUG_ENV.CSSOCCER_DEBUG_TICK === String(nextTick)
    ) {
      console.error("open-play-post-tussle", JSON.stringify({
        possession: tussled.possession.owner,
        players: tussled.players
          .filter(({ id }) => debugTussleIds.includes(id))
          .map((player) => ({
            id: player.id,
            position: player.position,
            facing: player.facing,
            action: player.action.action.value,
            intelligence: player.intelligence,
            animation: player.animation,
            liveMotion: player.liveMotion,
          })),
        events: events.slice(eventCountBeforeTussles),
      }));
    }
    if (
      CSSOCCER_DEBUG_ENV.CSSOCCER_DEBUG_PLAYER !== undefined
      && CSSOCCER_DEBUG_ENV.CSSOCCER_DEBUG_TICK === String(nextTick)
    ) {
      const debugPlayerId = CSSOCCER_DEBUG_ENV.CSSOCCER_DEBUG_PLAYER;
      console.error("open-play-final-pipeline", JSON.stringify({
        nextTick,
        activeJourney: activeJourneyPlayers.find(({ id }) => id === debugPlayerId),
        aiJourney: journey.players.find(({ id }) => id === debugPlayerId),
        offsideJourney: offsideJourney.players.find(
          ({ id }) => id === debugPlayerId,
        ),
        tussled: tussled.players.find(({ id }) => id === debugPlayerId),
      }));
    }
    const reset = applySourceOrderedDisplacedHolderIdeaResets(
      tussled,
      contactPass.visits,
    );
    const normalizedInterceptors = normalizeSourceGlobalInterceptors(
      reset,
      contactPass.visits,
    );
    if (normalizedInterceptors.possession.owner === 0) {
      return normalizedInterceptors;
    }
    return {
      ...normalizedInterceptors,
      players: clearLivePendingShots(normalizedInterceptors.players),
    };
  }
  const boundaryDecisionMotion = match.kickoff.phase === "boundary-decision";
  const restartPositioning = match.kickoff.phase === "boundary-positioning"
    || match.kickoff.phase === "rule-positioning"
    || boundaryDecisionMotion;
  const sameVisitRecoveredKeeperIds = new Set(
    restartPositioning
      ? match.players
          .filter(({ sourceKeeperStandTick }) => sourceKeeperStandTick === nextTick)
          .map(({ id }) => id)
      : [],
  );
  const resetCentrePositioning = match.kickoff.phase === "centre-positioning"
    && match.kickoff.restartKind !== "opening";
  if (match.kickoff.phase !== "centre-positioning" && !restartPositioning) {
    // B10 owns subsequent ordinary current-state team intelligence.
    return match;
  }
  const currentRates = currentTeamRates(match.players, match.clock.gameMinute);
  const ratesById = new Map(currentRates.map((rate) => [rate.id, rate]));
  let motion = stepCssoccerKickoffPlayerMotion(match.kickoff.motion, {
    teamRates: match.kickoff.motion.players.map((player) => {
      const rate = ratesById.get(player.id);
      if (rate === undefined) {
        throw new Error(`Kickoff motion lost the current team rate for ${player.id}.`);
      }
      return rate;
    }),
  });
  let ball = match.ball;
  let possession = match.possession;
  const motionById = new Map(motion.players.map((player) => [player.id, player]));
  let players = match.players.map((player) => {
    const current = motionById.get(player.id);
    if (current === undefined) throw new Error(`Kickoff motion lost ${player.id}.`);
    if (sameVisitRecoveredKeeperIds.has(player.id)) {
      // SAVE_ACT completed in this keeper's do_action slot. init_stand_act
      // replaces the action immediately. settleKeeperAfterOutcome already
      // models the trailing process_dir turn, so restart positioning must
      // retain that facing until the keeper's next source visit.
      const facing = clone(player.facing);
      return {
        ...clone(player),
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
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
          ...clone(player.liveMotion),
          kind: "stand",
          goCount: 0,
          goDisplacement: { x: F32(0), y: F32(0) },
          directionMode: 1,
          resetAnimationFrame: true,
          animationId: null,
          animationFrameStep: null,
        },
      };
    }
    const position = { ...clone(current.position), z: F32(0) };
    return {
      ...clone(player),
      ...(resetCentrePositioning && !retainsPostGoalCentreAction(player)
        ? {
            role: current.role,
            targetOwner: current.targetOwner,
            target: { ...clone(current.target), z: F32(0) },
          }
        : {}),
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
      ...(restartPositioning || resetCentrePositioning
        ? {
            // Reset-created halftime/post-goal centre players have no older
            // liveMotion to retain. The prepared opening keeps its already
            // exact live binding; surviving post-goal journeys merge below.
            liveMotion: currentBoundaryLiveMotion(
              current,
              boundaryDecisionMotion
                && current.role === "keeper"
                && current.id !== match.kickoff.owner?.takerId,
            ),
          }
      : {}),
    };
  });
  if (sameVisitRecoveredKeeperIds.size > 0) {
    // The positioning reducer was created before keeper_boxes completed the
    // save. Rebase its dormant carrier onto the recovered source state so
    // the first restart journey begins from here on the following tick.
    motion = patchCurrentPositioningMotionPlayers(
      motion,
      players,
      sameVisitRecoveredKeeperIds,
    );
  }
  if (
    restartPositioning
    && match.players.some(blocksCurrentPositioningMotion)
  ) {
    ({ ball, players, possession, motion } = mergeRetainedRestartActions({
      match,
      motion,
      nextTick,
      players,
    }));
  }
  if (restartPositioning) {
    ({ players, motion } = applyCurrentPositioningSocksActions({
      match,
      motion,
      nextTick,
      players,
    }));
  }
  if (
    match.kickoff.phase === "centre-positioning"
    && match.kickoff.restartKind === "post-goal"
    && match.players.some(retainsPostGoalCentreAction)
  ) {
    ({ players, motion } = mergeRetainedPostGoalCentreJourneys({
      match,
      motion,
      nextTick,
      players,
      publishPlayerVisits,
    }));
  }
  return {
    ...match,
    ball,
    players,
    possession,
    kickoff: {
      ...match.kickoff,
      phaseTick: motion.tick,
      motion,
    },
  };
}

/**
 * Continue the source actions that survive respot_ball/init_match_mode.
 * Each player adopts the centre target only when ordinary intelligence
 * reaches find_zonal_target; an in-flight run is not replaced wholesale.
 */
function mergeRetainedPostGoalCentreJourneys({
  match,
  motion,
  nextTick,
  players: positionedPlayers,
  publishPlayerVisits,
}) {
  const retainedIds = new Set(match.players
    .filter(retainsPostGoalCentreAction)
    .map((player) => player.id));
  const advanced = advanceOpenPlayContactActions(match, nextTick);
  const sourceBusyIds = new Set(advanced.players
    .filter(blocksPostGoalCentrePositioning)
    .map((player) => player.id));
  const byNative = new Map(advanced.players.map((player) => [
    player.nativePlayerNumber,
    player,
  ]));
  const visits = nativeContactTraversalOrder(match.tick & 1).flatMap((nativePlayerNumber) => {
    const player = byNative.get(nativePlayerNumber);
    if (player === undefined) {
      throw new Error(`Post-goal centre lost native player ${nativePlayerNumber}.`);
    }
    if (!player.active) return [];
    return [{
      playerId: player.id,
      nativePlayerNumber,
      ballPosition: clone(match.ball.ball.position),
      canBeOffside: match.rules.canBeOffside,
      distance: sourceDistance2d({
        x: F32(player.position.x - match.ball.ball.position.x),
        y: F32(player.position.y - match.ball.ball.position.y),
      }),
      interaction: "none",
      possession: {
        owner: match.possession.owner,
        lastTouch: match.possession.lastTouch,
        inHands: match.possession.inHands,
      },
    }];
  });
  publishPlayerVisits(visits);
  const expiredRunbacks = projectSourceExpiringOffsideRunbacks(
    { ...match, players: advanced.players },
    nextTick,
    visits,
  );
  const sourceMotionById = new Map(match.kickoff.motion.players.map((player) => [
    player.id,
    player,
  ]));
  const journeyPlayers = expiredRunbacks.players.map((player) => {
    if (player.liveMotion !== undefined) return player;
    const current = sourceMotionById.get(player.id);
    if (current === undefined) {
      throw new Error(`Post-goal centre motion lost ${player.id}.`);
    }
    return {
      ...clone(player),
      liveMotion: currentBoundaryLiveMotion(current),
    };
  });
  const continuedPlayers = stepCssoccerFreePlayTeamJourneyContinuation({
    controlledPlayerId: null,
    freeBallOutOfPlay: false,
    logicCount: NATIVE_CAPTURE_LOGIC_COUNT_ROOT + Math.max(0, nextTick - 2),
    nextTick,
    // do_action owns a surviving contact before ordinary computer_play.
    // Busy physical actions therefore skip the generic journey reducer; a
    // player recovered by advanceOpenPlayContactActions enters it this tick.
    possessionKicks: [...sourceBusyIds],
    players: journeyPlayers,
    possessionRuns: [],
    rngSeed: match.rng.state.seed,
    sourceDecisionPlayers: journeyPlayers,
    supportRun: null,
    tactics: match.tactics,
    takerId: null,
    teamRates: currentTeamRates(journeyPlayers, match.clock.gameMinute),
    visits,
    zoneAnalogue: false,
    zoneBallPosition: match.ball.ball.position,
    zoneState: match.kickoff.zoning,
  });
  const continuedById = new Map(continuedPlayers.map((player) => [player.id, player]));
  const players = positionedPlayers.map((positioned) => {
    if (!retainedIds.has(positioned.id)) return positioned;
    const source = continuedById.get(positioned.id);
    if (source === undefined) {
      throw new Error(`Post-goal centre continuation lost ${positioned.id}.`);
    }
    if (source.liveContact?.phase === "barge") {
      // tm_barge only overlays MC_BARGE on a still-running RUN_ACT. The new
      // centre positioning journey owns movement and direction immediately;
      // process_anims retains the overlay frame and countdown independently.
      return {
        ...positioned,
        animation: clone(source.animation),
        liveContact: clone(source.liveContact),
      };
    }
    return source;
  });
  return {
    players,
    motion: patchCurrentPositioningMotionPlayers(motion, players, retainedIds),
  };
}

/**
 * Continue physical actions which init_match_mode does not replace while the
 * stand/run-only restart reducer owns everybody else's target travel.
 */
function mergeRetainedRestartActions({
  match,
  motion,
  nextTick,
  players: positionedPlayers,
}) {
  const retainedIds = new Set(match.players
    .filter(blocksCurrentPositioningMotion)
    .map((player) => player.id));
  const contacted = advanceOpenPlayContactActions(match, nextTick);
  const retainedJourneyIds = new Set(contacted.players
    .filter(retainsPostGoalCentreJourney)
    .map((player) => player.id));
  let journeyPlayers = contacted.players;
  if (retainedJourneyIds.size > 0) {
    const byNative = new Map(journeyPlayers.map((player) => [
      player.nativePlayerNumber,
      player,
    ]));
    const visits = nativeContactTraversalOrder(match.tick & 1)
      .flatMap((nativePlayerNumber) => {
        const player = byNative.get(nativePlayerNumber);
        if (player === undefined) {
          throw new Error(`Restart journey lost native player ${nativePlayerNumber}.`);
        }
        if (!player.active) return [];
        return [{
          playerId: player.id,
          nativePlayerNumber,
          ballPosition: clone(match.ball.ball.position),
          canBeOffside: match.rules.canBeOffside,
          distance: sourceDistance2d({
            x: F32(player.position.x - match.ball.ball.position.x),
            y: F32(player.position.y - match.ball.ball.position.y),
          }),
          interaction: "none",
          possession: {
            owner: match.possession.owner,
            lastTouch: match.possession.lastTouch,
            inHands: match.possession.inHands,
          },
        }];
      });
    const continued = stepCssoccerFreePlayTeamJourneyContinuation({
      controlledPlayerId: null,
      freeBallOutOfPlay: false,
      logicCount: NATIVE_CAPTURE_LOGIC_COUNT_ROOT + Math.max(0, nextTick - 2),
      nextTick,
      possessionKicks: currentSourceSocksBusyPlayerIds(journeyPlayers),
      players: journeyPlayers,
      possessionRuns: [],
      rngSeed: match.rng.state.seed,
      sourceDecisionPlayers: journeyPlayers,
      supportRun: null,
      tactics: match.tactics,
      takerId: match.kickoff.owner?.takerId ?? null,
      teamRates: currentTeamRates(journeyPlayers, match.clock.gameMinute),
      visits,
      zoneAnalogue: false,
      zoneBallPosition: match.ball.ball.position,
      zoneState: match.kickoff.zoning,
    });
    journeyPlayers = journeyPlayers.map((player, index) => (
      retainedJourneyIds.has(player.id) ? continued[index] : player
    ));
  }
  const advanced = advanceRetainedRestartControlActions({
    match: { ...match, players: journeyPlayers },
    motion,
    nextTick,
  });
  const sameVisitRecoveredContactIds = new Set(match.players
    .filter((player) => (
      player.liveContact !== undefined
      && !blocksCurrentPositioningMotion(
        advanced.players.find(({ id }) => id === player.id),
      )
    ))
    .map(({ id }) => id));
  let recoveredMotionById = new Map();
  if (sameVisitRecoveredContactIds.size > 0) {
    // process_anims clears a completed GET_UP limbo before intelligence in
    // the same go_team visit. Re-enter restart positioning from the recovered
    // physical player, rather than waiting one browser tick or advancing the
    // hidden dormant carrier.
    const recoveredEntryMotion = patchCurrentPositioningMotionPlayers(
      match.kickoff.motion,
      advanced.players,
      sameVisitRecoveredContactIds,
    );
    const ratesById = new Map(currentTeamRates(
      advanced.players,
      match.clock.gameMinute,
    ).map((rate) => [rate.id, rate]));
    const recoveredMotion = stepCssoccerKickoffPlayerMotion(
      recoveredEntryMotion,
      {
        teamRates: recoveredEntryMotion.players.map((player) => {
          const rate = ratesById.get(player.id);
          if (rate === undefined) {
            throw new Error(`Recovered restart motion lost ${player.id}'s team rate.`);
          }
          return rate;
        }),
      },
    );
    recoveredMotionById = new Map(recoveredMotion.players
      .filter(({ id }) => sameVisitRecoveredContactIds.has(id))
      .map((player) => [player.id, player]));
    motion = {
      ...clone(motion),
      players: motion.players.map((player) => (
        recoveredMotionById.get(player.id) ?? player
      )),
    };
  }
  const advancedById = new Map(advanced.players.map((player) => [player.id, player]));
  const players = positionedPlayers.map((positioned) => {
    if (!retainedIds.has(positioned.id)) return positioned;
    const source = advancedById.get(positioned.id);
    if (source === undefined) {
      throw new Error(`Restart action continuation lost ${positioned.id}.`);
    }
    if (!blocksCurrentPositioningMotion(source)) {
      const recoveredMotion = recoveredMotionById.get(source.id);
      if (recoveredMotion !== undefined) {
        return bindRecoveredRestartPositioningPlayer(
          source,
          recoveredMotion,
          nextTick,
        );
      }
      // do_action completed the retained source action in this visit. Keep
      // that recovered player (which has removed the live-action marker)
      // instead of reintroducing the marker from the dormant motion carrier.
      // Positioning resumes from the patched source position next visit.
      return source;
    }
    if (source.liveContact?.phase === "barge") {
      // tm_barge overlays RUN_ACT. Positioning owns the run displacement;
      // process_anims still owns the retained animation/countdown.
      return {
        ...positioned,
        animation: clone(source.animation),
        liveContact: clone(source.liveContact),
      };
    }
    return source;
  });
  return {
    ball: advanced.ball,
    players,
    possession: advanced.possession,
    motion: patchCurrentPositioningMotionPlayers(motion, players, retainedIds),
  };
}

function bindRecoveredRestartPositioningPlayer(player, current, nextTick) {
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
    liveMotion: currentBoundaryLiveMotion(current),
  };
}

function advanceSourceSocksBusyPlayers(match) {
  const players = match.players.map((player) => {
    if (
      player.intelligence.move !== GET_UP_INTELLIGENCE_MOVE
      || player.intelligence.count <= 0
      || !(
        player.liveMotion?.kind === "socks"
        || player.liveMotion?.kind === "socks-wait"
        || player.animation.id === SOCKS_RIGHT_ANIMATION
        || player.animation.id === SOCKS_LEFT_ANIMATION
      )
    ) return player;
    if (player.intelligence.count === 1) {
      return {
        ...clone(player),
        intelligence: { special: 0, move: 0, count: 0 },
        liveMotion: {
          ...clone(player.liveMotion),
          kind: "stand",
          directionMode: 1,
          resetAnimationFrame: false,
          animationId: null,
          animationFrameStep: null,
        },
      };
    }
    const completesAnimation = (
      player.animation.id === SOCKS_RIGHT_ANIMATION
      || player.animation.id === SOCKS_LEFT_ANIMATION
    ) && F32(player.animation.frame + player.animation.frameStep) > 0.99;
    return {
      ...clone(player),
      intelligence: {
        ...clone(player.intelligence),
        count: player.intelligence.count - 1,
      },
      liveMotion: {
        ...clone(player.liveMotion),
        ...(completesAnimation
          ? {
              kind: "socks-wait",
              directionMode: 2,
              resetAnimationFrame: true,
              animationId: null,
              animationFrameStep: null,
            }
          : { resetAnimationFrame: false }),
      },
    };
  });
  return { ...match, players };
}

function applyOpenPlayFreshSocksActions({
  match,
  nextTick,
  sourcePlayers,
  visits,
}) {
  if (match.possession.owner === 0 || match.rng.state.seed >= SOCKS_PROBABILITY) {
    return match;
  }
  const sourceById = new Map(sourcePlayers.map((player) => [player.id, player]));
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const busy = new Set(currentSourceSocksBusyPlayerIds(sourcePlayers));
  const animationId = match.rng.state.seed & 1
    ? SOCKS_LEFT_ANIMATION
    : SOCKS_RIGHT_ANIMATION;
  const players = match.players.map((current) => {
    const source = sourceById.get(current.id);
    if (source === undefined) {
      throw new Error(`Open-play socks selection lost ${current.id}'s source player.`);
    }
    if (!source.active) return current;
    const visit = visitById.get(current.id);
    if (visit === undefined) {
      throw new Error(`Open-play socks selection lost ${current.id}'s source visit.`);
    }
    const sameTeamPossession = visit.possession.owner !== 0
      && (visit.possession.owner < 12)
        === (source.nativePlayerNumber < 12);
    if (
      busy.has(source.id)
      // Keeper stand_action is already projected inside the team journey
      // with the seed visible at that keeper's native traversal slot. A
      // holder later in the team can advance the final tick seed, so using
      // that final value here would retroactively invent a keeper action.
      || source.role === "keeper"
      || !sameTeamPossession
      || source.animation.id !== STAND_ANIMATION
      || current.action.action.value !== CSSOCCER_NATIVE_ACTIONS.STAND
      || visit.distance
        <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 50
    ) return current;
    return {
      ...clone(current),
      previousFacing: clone(source.facing),
      facing: clone(source.facing),
      intelligence: {
        special: 0,
        move: GET_UP_INTELLIGENCE_MOVE,
        count: 1 + Math.trunc(1 / SOCKS_FRAME_STEP),
      },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: current.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: source.facing.x,
        facingY: source.facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "socks",
        id: animationId,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        frame: F32(0),
        frameStep: SOCKS_FRAME_STEP,
        pending: null,
        tick: nextTick,
      },
      liveMotion: {
        ...clone(current.liveMotion),
        kind: "socks",
        goCount: 0,
        goDisplacement: { x: F32(0), y: F32(0) },
        directionMode: 2,
        resetAnimationFrame: true,
        sideStepDirection: null,
        animationId,
        animationFrameStep: SOCKS_FRAME_STEP,
      },
    };
  });
  return { ...match, players };
}

function currentSourceSocksBusyPlayerIds(players) {
  return players
    .filter((player) => (
      player.intelligence.move === GET_UP_INTELLIGENCE_MOVE
      && player.intelligence.count > 0
      && (
        player.liveMotion?.kind === "socks"
        || player.liveMotion?.kind === "socks-wait"
        || player.animation.id === SOCKS_RIGHT_ANIMATION
        || player.animation.id === SOCKS_LEFT_ANIMATION
      )
    ))
    .map(({ id }) => id);
}

function applyCurrentPositioningSocksActions({
  match,
  motion,
  nextTick,
  players,
}) {
  const sourceById = new Map(match.players.map((player) => [player.id, player]));
  const alreadyBusy = new Set(currentSourceSocksBusyPlayerIds(match.players));
  const ownerSideA = match.possession.owner !== 0
    ? match.possession.owner < 12
    : null;
  const canSelect = match.possession.owner !== 0
    && match.rng.state.seed < SOCKS_PROBABILITY;
  const selectedPlayers = players.map((positioned) => {
    const source = sourceById.get(positioned.id);
    if (source === undefined) {
      throw new Error(`Positioning socks action lost ${positioned.id}.`);
    }
    if (alreadyBusy.has(positioned.id)) return source;
    const sameTeamPossession = ownerSideA !== null
      && (positioned.nativePlayerNumber < 12) === ownerSideA;
    const distance = sourceDistance2d({
      x: F32(positioned.position.x - match.ball.ball.position.x),
      y: F32(positioned.position.y - match.ball.ball.position.y),
    });
    if (
      !canSelect
      || positioned.action.action.value !== CSSOCCER_NATIVE_ACTIONS.STAND
      || source.animation.id !== STAND_ANIMATION
      || !sameTeamPossession
      || distance <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 50
    ) return positioned;
    const animationId = match.rng.state.seed & 1
      ? SOCKS_LEFT_ANIMATION
      : SOCKS_RIGHT_ANIMATION;
    return {
      ...clone(positioned),
      previousFacing: clone(source.facing),
      facing: clone(source.facing),
      intelligence: {
        special: 0,
        move: GET_UP_INTELLIGENCE_MOVE,
        count: 1 + Math.trunc(1 / SOCKS_FRAME_STEP),
      },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: positioned.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: source.facing.x,
        facingY: source.facing.y,
      }),
      liveMotion: {
        ...clone(positioned.liveMotion),
        kind: "socks",
        goCount: 0,
        goDisplacement: { x: F32(0), y: F32(0) },
        directionMode: 2,
        resetAnimationFrame: true,
        animationId,
        animationFrameStep: SOCKS_FRAME_STEP,
      },
    };
  });
  return { players: selectedPlayers, motion };
}

function advanceRetainedRestartControlActions({ match, motion, nextTick }) {
  const motionById = new Map(motion.players.map((player) => [player.id, player]));
  let completion = null;
  const players = match.players.map((player) => {
    const control = player.liveControlIntercept;
    if (control?.phase !== "control") return player;
    const frame = F32(player.animation.frame + player.animation.frameStep);
    if (frame >= 1) {
      if (completion !== null) {
        throw new Error("Restart positioning produced multiple CONTROL_ACT completions.");
      }
      completion = {
        nativePlayerNumber: player.nativePlayerNumber,
        projection: projectCssoccerControlCompletionBall({
          actionIndex: control.actionIndex,
          facing: player.facing,
          playerPosition: player.position,
        }),
      };
      return recoverRetainedRestartControl(player, motionById, nextTick);
    }
    const freeTime = Number.isFinite(control.freeTime)
      ? control.freeTime
      : control.freeTicks;
    if (
      frame >= control.contact
      && match.possession.owner !== player.nativePlayerNumber
      && freeTime >= 0
    ) {
      return recoverRetainedRestartControl(player, motionById, nextTick);
    }
    return player;
  });
  const projected = projectSourceControlIntercepts({ ...match, players }, nextTick);
  if (completion === null) {
    return {
      ball: match.ball,
      players: projected.players,
      possession: match.possession,
    };
  }
  if (match.rules.setPiece !== 0) {
    if (match.possession.owner !== 0) {
      throw new Error(
        "Restart CONTROL_ACT completion retained possession after init_match_mode.",
      );
    }
    // ACTIONS.CPP control_action still reaches hold_ball after
    // init_match_mode/holder_lose_ball. With set_piece_on active, hold_ball's
    // set-piece branch updates last_touch only: it does not collect the ball,
    // increment tm_poss, or replace ball x/y.
    return {
      ball: createBallMatchState({
        ...clone(match.ball),
        limbo: { active: 0, player: 0, contact: F32(0) },
        ball: {
          ...clone(match.ball.ball),
          position: { ...clone(match.ball.ball.position), z: F32(0) },
        },
      }),
      players: projected.players,
      possession: touchWithoutPossession(
        match.possession,
        completion.nativePlayerNumber,
      ),
    };
  }
  if (match.possession.owner !== completion.nativePlayerNumber) {
    throw new Error(
      "Restart CONTROL_ACT completion lost its existing source possession owner.",
    );
  }
  const possession = holdPossession(match.possession);
  return {
    ball: createBallMatchState({
      ...clone(match.ball),
      limbo: { active: 0, player: 0, contact: F32(0) },
      ball: {
        ...clone(match.ball.ball),
        position: clone(completion.projection.position),
        displacement: { x: F32(0), y: F32(0), z: F32(0) },
        inAir: 0,
      },
    }),
    players: projected.players,
    possession,
  };
}

function recoverRetainedRestartControl(player, motionById, nextTick) {
  const current = motionById.get(player.id);
  if (current === undefined) {
    throw new Error(`Restart CONTROL_ACT recovery lost ${player.id}'s positioning motion.`);
  }
  const recovered = clone(player);
  delete recovered.liveControlIntercept;
  return {
    ...recovered,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
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
    liveMotion: currentBoundaryLiveMotion(current, true),
  };
}

function patchCurrentPositioningMotionPlayers(motion, players, retainedIds) {
  const patched = clone(motion);
  const playerById = new Map(players.map((player) => [player.id, player]));
  for (const current of patched.players) {
    if (!retainedIds.has(current.id)) continue;
    const player = playerById.get(current.id);
    if (player?.liveMotion === undefined) {
      throw new Error(`Retained positioning action lost ${current.id}.`);
    }
    current.position = { x: player.position.x, y: player.position.y };
    const physicalBusy = blocksPostGoalCentrePositioning(player);
    if (!physicalBusy || player.liveKeeper !== undefined) {
      // A keeper recovery keeps a normalized tm_xdis/tm_ydis pair. Do not
      // let the dormant restart carrier turn invisibly while SAVE/I_GET_UP
      // owns the published visit; positioning must resume from that source
      // facing on the first recovered tick.
      current.facing = clone(player.facing);
      current.faceDirection = sourceFacingDirection(player.facing);
    }
    // A dormant positioning carrier is stand/run-only state, not the retained
    // action's tm_xdis/tm_ydis. THROW_ACT, for example, writes the user's raw
    // throw vector there and does not normalize it through new_dir. Preserve
    // the carrier's last valid travel facing until that physical action
    // recovers; the recovered source player is copied on the next visit.
    current.action = physicalBusy
      ? CSSOCCER_NATIVE_ACTIONS.STAND
      : player.action.action.value;
    current.directionMode = physicalBusy ? 1 : player.liveMotion.directionMode;
    current.goCount = physicalBusy ? 0 : player.liveMotion.goCount;
    current.goStep = physicalBusy ? false : player.liveMotion.goStep;
    current.goStop = false;
    current.goDisplacement = physicalBusy
      ? { x: F32(0), y: F32(0) }
      : clone(player.liveMotion.goDisplacement);
    current.lastPlan = null;
    current.targetOffset = {
      x: F32(current.target.x - current.position.x),
      y: F32(current.target.y - current.position.y),
    };
    current.targetDistance = F32(Math.sqrt(
      (current.targetOffset.x * current.targetOffset.x)
      + (current.targetOffset.y * current.targetOffset.y),
    ));
    if (current.targetDistance <= 0.1) current.targetDistance = F32(0.1);
    current.arrived = Object.is(current.position.x, current.target.x)
      && Object.is(current.position.y, current.target.y);
    current.settled = !physicalBusy
      && current.action === CSSOCCER_NATIVE_ACTIONS.STAND
      && current.targetDistance <= patched.config.goToPositionDistance;
  }
  patched.status = patched.players.every(({ active, settled }) => !active || settled)
    ? "settled"
    : "positioning";
  return assertCssoccerKickoffPlayerMotion(patched);
}

function stepCurrentBoundaryRunup(
  match,
  nextTick,
  events,
  sourcePredictionBall,
) {
  const boundary = match.rules.boundary;
  const sourceTaker = match.players.find(({ id }) => id === match.kickoff.owner?.takerId);
  if (
    boundary?.phase !== "runup"
    || sourceTaker?.liveRestart?.phase !== "set-piece-runup"
    || sourceTaker.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
  ) {
    throw new Error("Boundary run-up lost its current source action.");
  }
  if (
    sourceTaker.liveRestart.startTick >= nextTick
    || sourceTaker.liveRestart.remainingMoves > 0
  ) {
    const supported = stepCurrentBoundaryRunupSupportMotion(
      match,
      sourceTaker.id,
      nextTick,
    );
    const taker = supported.players.find(({ id }) => id === sourceTaker.id);
    if (taker === undefined) throw new Error("Boundary run-up support lost its taker.");
    if (taker.liveRestart.startTick >= nextTick) return supported;
    const position = {
      ...updateSourcePosition2d({
        position: { x: taker.position.x, y: taker.position.y },
        displacement: taker.liveMotion.goDisplacement,
      }),
      z: taker.position.z,
    };
    const facing = turnSourceFacing({
      facing: taker.facing,
      target: {
        x: F32(taker.liveMotion.target.x - position.x),
        y: F32(taker.liveMotion.target.y - position.y),
      },
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate: taker.liveMotion.teamRate },
      ).maxTurnRadians,
    }).facing;
    const players = supported.players.map((player) => player.id === taker.id
      ? {
          ...clone(player),
          previousPosition: clone(player.position),
          previousFacing: clone(player.facing),
          position,
          velocity: { ...clone(player.liveMotion.goDisplacement), z: F32(0) },
          facing,
          intelligence: {
            ...clone(player.intelligence),
            count: Math.max(0, player.intelligence.count - 1),
          },
          action: createCssoccerActionState({
            tick: nextTick,
            playerId: player.id,
            actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
            facingX: facing.x,
            facingY: facing.y,
          }),
          liveMotion: {
            ...clone(player.liveMotion),
            goCount: Math.max(0, player.liveMotion.goCount - 1),
          },
          liveRestart: {
            ...clone(player.liveRestart),
            remainingMoves: player.liveRestart.remainingMoves - 1,
          },
        }
      : player);
    return { ...supported, players };
  }
  const taker = sourceTaker;
  // go_team may reach the set-piece taker only after earlier players have
  // completed their final positioning visit. ready_set_kick changes the
  // match mode inside the taker's visit, so only the traversal prefix sees
  // the old restart journey on this source tick.
  const supported = stepCurrentBoundaryRunupSupportMotion(
    match,
    taker.id,
    nextTick,
  );
  const traversal = nativeContactTraversalOrder(match.tick & 1);
  const takerVisitIndex = traversal.indexOf(taker.nativePlayerNumber);
  if (takerVisitIndex < 0) {
    throw new Error("Boundary run-up completion lost its taker traversal slot.");
  }
  const preTakerNativePlayers = new Set(traversal.slice(0, takerVisitIndex));
  const supportedById = new Map(supported.players.map((player) => [player.id, player]));
  const preTakerPlayers = match.players.map((player) => {
    if (!preTakerNativePlayers.has(player.nativePlayerNumber)) return player;
    const current = supportedById.get(player.id);
    if (current === undefined) {
      throw new Error(`Boundary run-up completion lost ${player.id}.`);
    }
    return current;
  });
  const preTakerMatch = {
    ...supported,
    players: preTakerPlayers,
  };
  const currentTaker = preTakerPlayers.find(({ id }) => id === taker.id);
  if (currentTaker === undefined) {
    throw new Error("Boundary run-up completion lost its current taker.");
  }
  const action = boundary.descriptor.kind === "corner" ? "shot" : "punt";
  const setPiece = advanceCssoccerSetPiece(boundary.setPiece, {
    type: "decision",
    action,
  });
  const kicked = beginCurrentBoundaryKick({
    aim: currentTaker.liveRestart.aim ?? defaultCurrentBoundaryAim(boundary.descriptor),
    events,
    match: preTakerMatch,
    nextTick,
    setPiece,
    sourcePredictionBall,
    taker: currentTaker,
    userControlled: true,
  });
  return stepCurrentBoundaryKickTeamContinuation(kicked, currentTaker, nextTick);
}

function stepCurrentBoundaryKickTeamContinuation(match, sourceTaker, nextTick) {
  const taker = match.players.find(({ id }) => id === sourceTaker.id);
  if (taker?.liveShot?.phase !== "kick-held") {
    throw new Error("Boundary kick continuation lost its held source action.");
  }
  const aim = sourceTaker.liveRestart.aim ?? {
    x: sourceTaker.facing.x,
    y: sourceTaker.facing.y,
    high: false,
  };
  const launchOrigin = clone(sourceTaker.position);
  const launchFacing = { x: F32(aim.x), y: F32(aim.y) };
  const launchTarget = {
    x: F32(launchOrigin.x + launchFacing.x * 100),
    y: F32(launchOrigin.y + launchFacing.y * 100),
  };
  const restoredPlayers = match.players.map((player) => player.id === taker.id
    ? {
        ...clone(player),
        previousPosition: clone(launchOrigin),
        previousFacing: clone(launchFacing),
        position: launchOrigin,
        velocity: { x: F32(0), y: F32(0), z: F32(0) },
        facing: launchFacing,
        target: { ...clone(launchTarget), z: F32(0) },
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.KICK,
          facingX: launchFacing.x,
          facingY: launchFacing.y,
        }),
        liveMotion: {
          ...clone(player.liveMotion),
          target: clone(launchTarget),
        },
        liveShot: {
          ...clone(player.liveShot),
          goTarget: clone(launchTarget),
        },
      }
    : player);
  const byNative = new Map(restoredPlayers.map((player) => [
    player.nativePlayerNumber,
    player,
  ]));
  const visits = nativeContactTraversalOrder(match.tick & 1).flatMap((nativePlayerNumber) => {
    const player = byNative.get(nativePlayerNumber);
    if (player === undefined) {
      throw new Error(`Boundary kick continuation lost native player ${nativePlayerNumber}.`);
    }
    if (!player.active) return [];
    return [{
      playerId: player.id,
      nativePlayerNumber,
      ballPosition: clone(match.ball.ball.position),
      canBeOffside: match.rules.canBeOffside,
      distance: sourceDistance2d({
        x: F32(player.position.x - match.ball.ball.position.x),
        y: F32(player.position.y - match.ball.ball.position.y),
      }),
      interaction: player.id === taker.id ? "kick-held" : "none",
      possession: {
        owner: match.possession.owner,
        lastTouch: match.possession.lastTouch,
        inHands: match.possession.inHands,
      },
    }];
  });
  const restoredMatch = { ...match, players: restoredPlayers };
  const restoredTaker = restoredPlayers.find(({ id }) => id === taker.id);
  if (restoredTaker === undefined) {
    throw new Error("Boundary kick continuation lost its restored taker.");
  }
  const closeDown = currentBoundaryCloseDownState(
    restoredMatch,
    restoredTaker,
    visits,
    nextTick,
  );
  const continuedPlayers = stepCssoccerFreePlayTeamJourneyContinuation({
    controlledPlayerId: taker.id,
    freeBallOutOfPlay: false,
    logicCount: NATIVE_CAPTURE_LOGIC_COUNT_ROOT + Math.max(0, nextTick - 2),
    nextTick,
    possessionKicks: [
      taker.id,
      ...closeDown.blockedPlayerIds,
      ...currentSourceSocksBusyPlayerIds(restoredPlayers),
    ],
    players: restoredPlayers,
    possessionRuns: [],
    rngSeed: match.rng.state.seed,
    sourceDecisionPlayers: restoredPlayers,
    supportRun: null,
    tactics: match.tactics,
    takerId: taker.id,
    teamRates: currentTeamRates(restoredPlayers, match.clock.gameMinute),
    visits,
    zoneAnalogue: true,
    zoneBallPosition: match.ball.ball.position,
    zoneState: match.rules.boundary.sourceZoning,
  });
  const visitIndex = new Map(visits.map((visit, index) => [visit.playerId, index]));
  const takerVisitIndex = visitIndex.get(taker.id);
  if (!Number.isSafeInteger(takerVisitIndex)) {
    throw new Error("Boundary kick continuation lost its taker traversal slot.");
  }
  const players = continuedPlayers.map((player, index) => (
    visitIndex.get(player.id) > takerVisitIndex
      ? closeDown.players.get(player.id) ?? player
      : restoredPlayers[index]
  ));
  return { ...match, players };
}

function stepCurrentBoundaryRunupSupportMotion(match, takerId, nextTick) {
  const currentRates = currentTeamRates(match.players, match.clock.gameMinute);
  const ratesById = new Map(currentRates.map((rate) => [rate.id, rate]));
  let motion = stepCssoccerKickoffPlayerMotion(match.kickoff.motion, {
    teamRates: match.kickoff.motion.players.map((player) => {
      const rate = ratesById.get(player.id);
      if (rate === undefined) {
        throw new Error(`Boundary run-up motion lost the current rate for ${player.id}.`);
      }
      return rate;
    }),
  });
  const motionById = new Map(motion.players.map((player) => [player.id, player]));
  const socksBusyIds = new Set(currentSourceSocksBusyPlayerIds(match.players));
  let players = match.players.map((player) => {
    if (player.id === takerId || socksBusyIds.has(player.id)) return player;
    const current = motionById.get(player.id);
    if (current === undefined) {
      throw new Error(`Boundary run-up motion lost ${player.id}.`);
    }
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
      liveMotion: currentBoundaryLiveMotion(
        current,
        current.role === "keeper" && current.id !== takerId,
      ),
    };
  });
  ({ players, motion } = applyCurrentPositioningSocksActions({
    match,
    motion,
    nextTick,
    players,
  }));
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

function stepCurrentBoundaryKickAction(
  match,
  nextTick,
  events,
  publishPlayerVisits,
) {
  let current = match;
  const sourceTaker = current.players.find(({ id }) => (
    id === current.kickoff.action?.takerId
  ));
  if (sourceTaker !== undefined) {
    current = stepCurrentBoundaryKickActionTeamContinuation(
      current,
      sourceTaker,
      nextTick,
      publishPlayerVisits,
    );
  }
  const boundary = current.rules.boundary;
  const taker = current.players.find(({ id }) => current.kickoff.action?.takerId === id);
  if (
    boundary?.phase !== "action"
    || taker?.liveShot?.phase !== "kick-held"
    || current.possession.owner !== taker.nativePlayerNumber
  ) {
    throw new Error("Boundary action lost its single current kick owner.");
  }
  if (F32(taker.animation.frame + taker.animation.frameStep) < taker.liveShot.contact) {
    return current;
  }
  let released;
  if (
    boundary.descriptor.kind === "corner"
    || boundary.descriptor.kind === "goal-kick"
  ) {
    const keeper = current.players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === taker.liveShot.targetKeeperNativePlayer
    ));
    if (keeper === undefined || keeper.role !== "keeper") {
      throw new Error("Boundary set-piece shot lost its current defending keeper.");
    }
    if (taker.liveShot.newSetPiece === undefined) {
      throw new Error("Boundary set-piece shot lost taker_nkick power and height.");
    }
    released = releaseCssoccerNewSetPieceShot({
      ball: current.ball,
      direction: clone(taker.liveShot.direction),
      height: taker.liveShot.newSetPiece.height,
      keeper: {
        nativePlayerNumber: keeper.nativePlayerNumber,
        position: clone(keeper.position),
      },
      owner: liveShotHolder(taker),
      possession: current.possession,
      power: taker.liveShot.newSetPiece.power,
      rng: current.rng.state,
      tick: current.ball.ball.tick,
      userControlled: taker.liveShot.userControlled,
    });
  } else {
    throw new Error("Only a corner or goal kick may own boundary kick action.");
  }
  const release = {
    ...clone(released.release),
    tick: nextTick,
  };
  const players = current.players.map((player) => (
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
      ...current,
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

function stepCurrentBoundaryKickActionTeamContinuation(
  match,
  taker,
  nextTick,
  publishPlayerVisits,
  zoneState = match.rules.boundary.sourceZoning,
  challengeFrame = null,
) {
  const byNative = new Map(match.players.map((player) => [
    player.nativePlayerNumber,
    player,
  ]));
  const traversal = nativeContactTraversalOrder(match.tick & 1);
  const takerVisitIndex = traversal.indexOf(taker.nativePlayerNumber);
  const preTakerBallPosition = taker.liveShot?.publishedBallPosition;
  if (takerVisitIndex < 0 || preTakerBallPosition === undefined) {
    throw new Error("Boundary action continuation lost its source ball traversal boundary.");
  }
  const visits = traversal.flatMap((nativePlayerNumber, visitIndex) => {
    const player = byNative.get(nativePlayerNumber);
    if (player === undefined) {
      throw new Error(`Boundary action continuation lost native player ${nativePlayerNumber}.`);
    }
    if (!player.active) return [];
    // BALLINT.CPP updates the held KICK_ACT ball inside the taker's
    // ball_interact visit. Players on the team traversed before the taker see
    // the prior published ball; the taker and all later players see the tween.
    const ballPosition = visitIndex < takerVisitIndex
      ? preTakerBallPosition
      : match.ball.ball.position;
    return [{
      playerId: player.id,
      nativePlayerNumber,
      ballPosition: clone(ballPosition),
      canBeOffside: match.rules.canBeOffside,
      distance: sourceDistance2d({
        x: F32(player.position.x - ballPosition.x),
        y: F32(player.position.y - ballPosition.y),
      }),
      interaction: player.id === taker.id ? "kick-held" : "none",
      possession: {
        owner: match.possession.owner,
        lastTouch: match.possession.lastTouch,
        inHands: match.possession.inHands,
      },
    }];
  });
  publishPlayerVisits(visits);
  const closeDown = currentBoundaryCloseDownState(match, taker, visits, nextTick);
  const continued = stepCssoccerFreePlayTeamJourneyContinuation({
    controlledPlayerId: taker.id,
    freeBallOutOfPlay: false,
    logicCount: NATIVE_CAPTURE_LOGIC_COUNT_ROOT + Math.max(0, nextTick - 2),
    nextTick,
    possessionKicks: [
      taker.id,
      ...closeDown.blockedPlayerIds,
      ...currentSourceSocksBusyPlayerIds(match.players),
    ],
    players: match.players,
    possessionRuns: [],
    rngSeed: match.rng.state.seed,
    sourceDecisionPlayers: match.players,
    supportRun: null,
    tactics: match.tactics,
    takerId: taker.id,
    teamRates: currentTeamRates(match.players, match.clock.gameMinute),
    visits,
    zoneAnalogue: true,
    zoneBallPosition: match.ball.ball.position,
    zoneState,
  });
  let continuedMatch = {
    ...match,
    players: continued.map((player, index) => (
      player.id === taker.id
        ? match.players[index]
        : closeDown.players.get(player.id) ?? player
    )),
  };
  if (challengeFrame !== null) {
    continuedMatch = initializeOpenPlayAiChallenges(
      continuedMatch,
      nextTick,
      challengeFrame.events,
      match.players,
      match.ball.ball,
      {
        ballState: match.ball,
        predictionBall: taker.liveShot.sourcePrediction,
        possession: match.possession,
        playerDistances: challengeFrame.playerDistanceFrame,
        playerDistanceRanks: challengeFrame.playerDistanceRankFrame,
        reselection: null,
        visits,
        pressureWindow: "final",
      },
    );
    continuedMatch = applyOpenPlayOffsideRunbacks({
      aiChallengePlayerIds: currentOpenPlayAiRoutePlayerIds(
        challengeFrame.events,
        nextTick,
      ),
      command: challengeFrame.command,
      completedRunbackPlayerIds: [],
      expiredInterceptPlayerIds: [],
      logicCount: NATIVE_CAPTURE_LOGIC_COUNT_ROOT + Math.max(0, nextTick - 2),
      match: continuedMatch,
      nextTick,
      sourcePlayers: match.players,
      visits,
    });
  }
  return continuedMatch;
}

/** INTELL.CPP opp_has_ball -> close_him_down while a live restart kick is held. */
function currentBoundaryCloseDownState(match, taker, visits, nextTick) {
  const ownerSideA = taker.nativePlayerNumber < 12;
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  const intercepting = match.players.filter((player) => (
    player.active
    && player.intelligence.move === 1
    && player.intelligence.count > 1
    && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
    && player.liveMotion?.kind === "run"
  ));
  const continuing = match.players.filter((player) => (
    player.active
    && player.intelligence.move === CLOSE_DOWN_INTELLIGENCE_MOVE
    && player.intelligence.count > 1
  ));
  const replanning = match.players.filter((player) => (
    player.active
    && player.intelligence.move === CLOSE_DOWN_INTELLIGENCE_MOVE
    && player.intelligence.count === 1
  ));
  const opponentPool = match.ball.ball.outOfPlay === 0 && match.possession.inHands === 0
    ? match.players.filter((player) => (
        player.active
        && player.id !== taker.id
        && (player.nativePlayerNumber < 12) !== ownerSideA
      ))
    : [];
  const distanceBall = taker.liveShot?.publishedBallPosition;
  if (distanceBall === undefined) {
    throw new Error("Boundary close-down lost the player_distances ball snapshot.");
  }
  // BALLINT.CPP player_distances ranks every active player, including a busy
  // current closer, before intelligence runs. A busy nearest player therefore
  // blocks the next-ranked defender from can_close_down.
  const nearest = opponentPool.reduce((selected, player) => {
    const distance = sourceDistance2d({
      x: F32(player.position.x - distanceBall.x),
      y: F32(player.position.y - distanceBall.y),
    });
    return selected === null
      || distance < selected.distance
      || (distance === selected.distance
        && player.nativePlayerNumber < selected.player.nativePlayerNumber)
      ? { player, distance }
      : selected;
  }, null);
  const dangerDistance = F32(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 13,
  );
  const fresh = nearest !== null
    && nearest.distance >= dangerDistance
    && nearest.player.role !== "keeper"
    && nearest.player.id !== match.control.activePlayerId
    && nearest.player.action.action.value <= CSSOCCER_NATIVE_ACTIONS.RUN
    && nearest.player.liveContact === undefined
    && nearest.player.livePass === undefined
    && nearest.player.liveShot === undefined
    && (
      nearest.player.intelligence.count === 0
      || replanning.some(({ id }) => id === nearest.player.id)
    )
    ? nearest.player
    : null;
  const selected = new Map();
  for (const player of continuing) {
    selected.set(player.id, stepCurrentCloseDownPlayer({
      ballPosition: visitById.get(player.id).ballPosition,
      count: player.intelligence.count - 1,
      fresh: false,
      nextTick,
      player,
      teamRate: rates.get(player.id),
    }));
  }
  for (const player of intercepting) {
    const visit = visitById.get(player.id);
    if (visit === undefined) {
      throw new Error(`Boundary held-shot intercept lost ${player.id}'s source visit.`);
    }
    const continued = continueFreeBallIntercept(player, match, nextTick, {
      ballPosition: visit.ballPosition,
    });
    if (continued === null) {
      throw new Error(`Boundary held-shot intercept could not continue ${player.id}.`);
    }
    selected.set(player.id, continued);
  }
  if (fresh !== null) {
    // close_him_down first marks I_CLOSE_DOWN, then immediately calls
    // go_to_path. A viable held-shot path replaces that temporary idea with
    // I_INTERCEPT and executes the new RUN_ACT in this same player visit.
    const plan = createFreeBallInterceptPlan(fresh, match, nextTick, {
      afterTouchInput: { x: F32(0), y: F32(0) },
      automaticMoveSelection:
        fresh.nativeTeamSlot !== match.control.nativeTeamSlot,
      ballState: match.ball,
      controlled: false,
      frozenShotPrediction: taker.liveShot?.sourcePrediction ?? null,
      incrementRunCountBeforeAction: true,
      userControlIndex: 0,
      userControlled: false,
    });
    selected.set(
      fresh.id,
      plan.player === null
        ? stepCurrentCloseDownPlayer({
            ballPosition: visitById.get(fresh.id).ballPosition,
            count: Math.trunc(fresh.gameplay.flair / 4),
            fresh: true,
            nextTick,
            player: fresh,
            teamRate: rates.get(fresh.id),
          })
        : {
            ...plan.player,
            ballState: match.possession.owner === 0
              ? match.possession.lastTouch
              : -match.possession.owner,
          },
    );
  }
  return {
    blockedPlayerIds: [...selected.keys()],
    players: selected,
  };
}

function stepCurrentCloseDownPlayer({
  ballPosition,
  count,
  fresh,
  nextTick,
  player,
  teamRate,
}) {
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Boundary close-down lost current rate for ${player.id}.`);
  }
  const terminalRunClearsFreshIdea = fresh
    && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
    && player.liveMotion?.goCount <= 1;
  const target = {
    x: F32(ballPosition.x - player.position.x),
    y: F32(ballPosition.y - player.position.y),
  };
  const facing = target.x === 0 && target.y === 0
    ? clone(player.facing)
    : turnSourceFacing({
        facing: player.facing,
        target,
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate },
        ).maxTurnRadians,
      }).facing;
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    facing,
    target: { x: ballPosition.x, y: ballPosition.y, z: F32(0) },
    intelligence: {
      special: 0,
      move: terminalRunClearsFreshIdea ? 0 : CLOSE_DOWN_INTELLIGENCE_MOVE,
      count: terminalRunClearsFreshIdea ? 0 : count,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: facing.x,
      facingY: facing.y,
    }),
    liveMotion: {
      ...clone(player.liveMotion),
      kind: "close-down",
      teamRate,
      target: { x: ballPosition.x, y: ballPosition.y },
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: null,
      animationFrameStep: player.animation.frameStep,
      // other_interceptor writes 1 + flair/16. get_near_path decrements it
      // once per following source frame before intelligence runs.
      sourceNotMe: fresh
        ? 1 + Math.trunc(player.gameplay.flair / 16)
        : Math.max(0, (player.liveMotion.sourceNotMe ?? 0) - 1),
    },
  };
}

function advanceOpenPlayContactActions(match, nextTick) {
  if (!match.players.some((player) => player.liveContact !== undefined)) return match;
  const players = match.players.map((player) => {
    const contact = player.liveContact;
    if (contact === undefined || contact.startTick >= nextTick) return player;
    if (contact.phase === "barge") {
      if (
        player.animation.kind !== "barge"
        || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      ) {
        // process_anims owns tm_barge independently from intelligence. The
        // timer is cleared immediately once MC_BARGE/RUN is no longer active,
        // so this player is available to the same visit's ordinary AI.
        const cleared = clone(player);
        delete cleared.liveContact;
        return cleared;
      }
      return {
        ...clone(player),
        liveContact: {
          ...clone(contact),
          bargeCountdown: Math.max(0, contact.bargeCountdown - 1),
        },
      };
    }
    const moving = contact.phase === "tackle"
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
    const bargeCountdown = contact.bargeCountdown;
    const decelerates = contact.phase === "fall" || contact.phase === "tackle";
    const goDisplacement = decelerates
      ? {
          x: F32(go.x * TACKLE_DECEL),
          y: F32(go.y * TACKLE_DECEL),
        }
      : clone(player.liveMotion.goDisplacement);
    // fall_action installs MC_GETUPF limbo when go_cnt reaches one. go_team
    // then skips process_dir for that same visit, so new_dir must not publish
    // an extra normalized facing before the get-up begins.
    const entersFallLimbo = contact.phase === "fall" && goCount === 1;
    const facing = moving && !entersFallLimbo && player.liveMotion.target !== undefined
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
    // process_anims clears the get-up limbo and installs MC_STAND before the
    // same go_team visit reaches computer_play. Publish that recovery here so
    // ordinary team intelligence can immediately choose and execute its next
    // action during this tick.
    if (contact.phase === "get-up" && limbo === 0) {
      return recoverOpenPlayContactPlayer(player, match, nextTick);
    }
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

function resolveOpenPlayChallengeContacts(match, nextTick, events, playerDistanceFrame) {
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
      const offenderDistanceToBall = playerDistanceFrame?.get(tackler.id);
      if (
        event.type === "foul-candidate"
        && (!Number.isFinite(offenderDistanceToBall) || offenderDistanceToBall < 0)
      ) {
        throw new Error(`Challenge foul lost source distance for ${tackler.id}.`);
      }
      events.push({
        tick: nextTick,
        ...clone(event),
        tacklerId: tackler.id,
        targetId: nativeTarget === null
          ? null
          : players.find(({ nativePlayerNumber }) => (
              nativePlayerNumber === nativeTarget
            ))?.id ?? null,
        ...(event.type === "foul-candidate"
          ? {
              // INTELL.CPP player_ints stores the live tackle displacement
              // magnitude in global man_down before calling init_foul.
              manDown: sourceDistance2d(tackler.liveMotion.goDisplacement),
              offenderDistanceToBall,
              incidentPosition: {
                x: tackler.position.x,
                y: tackler.position.y,
              },
            }
          : {}),
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
  return players.map((player) => {
    if (player.active && player.liveMotion === undefined) {
      throw new Error(`Active challenge player ${player.id} lost its motion carrier.`);
    }
    const active = player.active;
    return {
      nativePlayer: player.nativePlayerNumber,
      // go_team no longer visits a guy_on=FALSE player. The retained browser
      // slot stays at its last field coordinate instead of simulating the
      // source tunnel walk, so make that spatial ghost ineligible for the
      // player_ints target loop.
      action: active
        ? player.action.action.value
        : CSSOCCER_NATIVE_ACTIONS.STOP,
      actionKind: active
        ? player.liveContact?.phase ?? player.animation.kind
        : "inactive",
      animation: player.animation.id,
      animationFrame: player.animation.frame,
      barge: active ? player.liveContact?.bargeCountdown ?? 0 : 0,
      goCount: active
        ? player.liveContact?.goCount ?? player.liveMotion.goCount
        : 0,
      position: clone(player.position),
      facing: clone(player.facing),
      goDisplacement: active
        ? clone(player.liveMotion.goDisplacement)
        : { x: F32(0), y: F32(0) },
      power: player.gameplay.power,
      control: player.gameplay.control,
      flair: player.gameplay.flair,
      possession: possession.players.find(({ nativePlayer }) => (
        nativePlayer === player.nativePlayerNumber
      ))?.possession ?? 0,
    };
  });
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
    baseAttributes: sourceBaseGameplayAttributes(player),
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
  const resetPlayer = resetSourceIdeasForPhysicalAction(player);
  return {
    ...resetPlayer,
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
      effectiveFitness: injury.effectiveFitness,
      baseRate: injury.baseRate,
      force,
      playerMinutes: match.clock.gameMinute,
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
  const resetPlayer = resetSourceIdeasForPhysicalAction(player);
  return {
    ...resetPlayer,
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
  const currentRates = new Map(
    currentTeamRates(match.players, match.clock.gameMinute)
      .map(({ id, value }) => [id, value]),
  );
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
          currentTusslePlayer(left, possession, currentRates.get(left.id)),
          currentTusslePlayer(right, possession, currentRates.get(right.id)),
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

function currentTusslePlayer(player, possession, teamRate) {
  const possessionPlayer = possession.players.find(({ nativePlayer }) => (
    nativePlayer === player.nativePlayerNumber
  ));
  if (possessionPlayer === undefined) {
    throw new Error(`Player tussle lost possession identity ${player.id}.`);
  }
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Player tussle lost current tm_rate for ${player.id}.`);
  }
  const sourceAnimation = currentSourceTussleAnimation(player);
  const expiredBarge = (
    sourceAnimation === RUN_ANIMATION
    && player.animation.id === BARGE_ANIMATION
    && player.liveContact?.phase === "barge"
    && player.liveContact.bargeCountdown === 0
  );
  return {
    stableId: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    on: player.active ? 1 : 0,
    action: player.action.action.value,
    // Native process_anims advances the entry clip before go_team.  The
    // player visit can then call init_trot_anim, and player_tussles observes
    // that replacement in the same tick.  Browser animation publication is
    // deferred until processAnimations, so project the already-installed
    // side-step route here instead of exposing the stale entry MC_RUN.
    animation: sourceAnimation,
    // The terminal process_anims visit calls init_run_anim after advancing
    // MC_BARGE. Because BARGE is neither RUN nor JOG, init_run_anim resets
    // tm_frm before player_tussles can relaunch the barge.
    animationFrame: expiredBarge ? F32(0) : F32(player.animation.frame),
    animationFrameStep: F32(player.animation.frameStep),
    position: clone(player.position),
    facing: clone(player.facing),
    zDisplacement: F32(player.velocity.z),
    goDisplacement: clone(player.liveMotion.goDisplacement),
    power: player.gameplay.power,
    // player_stamina owns tm_rate independently from an installed journey.
    // A busy support run can retain its old travel constants across a minute
    // boundary, but a same-tick init_barge_anim reads the current tm_rate.
    rate: teamRate,
    possession: possessionPlayer.possession,
    bargeCountdown: player.liveContact?.bargeCountdown ?? 0,
  };
}

function currentSourceTussleAnimation(player) {
  if (player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN) {
    return player.animation.id;
  }
  if (
    player.liveMotion.kind === "side-step"
    || player.liveMotion.goStep === true
  ) {
    return Number.isSafeInteger(player.liveMotion.animationId)
      ? player.liveMotion.animationId
      : TROT_ANIMATION_BY_DIRECTION[
        player.liveMotion.sideStepDirection ?? sourceSideStepDirection(player)
      ];
  }
  if (
    player.liveContact?.phase === "barge"
    && player.liveContact.bargeCountdown === 0
  ) {
    // process_anims decrements the final tm_barge count and immediately
    // reinstalls MC_RUN before this visit reaches player_tussles. A collision
    // in that same visit can therefore launch a fresh MC_BARGE/tm_barge pair.
    return RUN_ANIMATION;
  }
  if (
    player.liveMotion.kind !== "first-time-must-face"
    && player.liveContact?.phase !== "barge"
  ) {
    // A journey installed during computer_play already called init_run_anim
    // before player_tussles, even though browser animation publication waits
    // until the later processAnimations stage.
    return RUN_ANIMATION;
  }
  return player.animation.id;
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
      baseAttributes: sourceBaseGameplayAttributes(player),
      currentAttributes: clone(player.gameplay),
      currentInjury: player.injury?.value ?? 0,
      force: contactEvent.force,
      playerMinutes: match.clock.gameMinute,
      teamFitness: 99,
      timeFactor: match.config.timing.timeFactor,
    });
    const resetPlayer = resetSourceIdeasForPhysicalAction(player);
    return {
      ...resetPlayer,
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
        effectiveFitness: injury.effectiveFitness,
        baseRate: injury.baseRate,
        force: contactEvent.force,
        playerMinutes: match.clock.gameMinute,
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
  const bargeLaunched = transitioned.bargeCountdown.value
    > (player.liveContact?.bargeCountdown ?? 0);
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
        // go_team advances the old clip before the player visit. A newly
        // initialized RUN/JOG transition has already materialized that visit;
        // otherwise preserve the old RUN advance before init_barge_anim's
        // +0.5 phase offset.
        frame: player.liveMotion.sourceAnimationVisitComplete
          || player.liveMotion.resetAnimationFrame
          || currentSourceTussleAnimation(player) !== player.animation.id
          ? transitioned.animationFrame.value
          : F32(
              F32(player.animation.frame + player.animation.frameStep)
              + F32(0.5),
            ),
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

function sourceBaseGameplayAttributes(player) {
  const attributes = player.identity.attributes;
  return {
    pace: Math.trunc(attributes.pace * 128 / 100),
    power: Math.trunc(attributes.power * 128 / 100),
    control: Math.trunc(attributes.control * 128 / 100),
    flair: Math.trunc(attributes.flair * 128 / 100),
    vision: Math.trunc(attributes.vision * 128 / 100),
    accuracy: Math.trunc(attributes.accuracy * 128 / 100),
    stamina: Math.trunc(attributes.stamina * 128 / 100),
    discipline: Math.trunc(attributes.discipline * 128 / 100),
  };
}

function sourceBallInteractionAnimationFrame(player) {
  if (
    player.liveContact?.phase === "barge"
    && player.liveContact.bargeCountdown === 0
  ) {
    return F32(0);
  }
  return F32(player.animation.frame + player.animation.frameStep);
}

function stepOpenPlayLooseBallContacts(
  match,
  events,
  nextTick,
  sourceAiBall,
  {
    justThrown = false,
    sourceKeeperHandsBall = sourceAiBall,
  } = {},
) {
  const kickHolder = match.players.find((player) => (
    (
      player.livePass?.phase === "kick-held"
      || player.liveShot?.phase === "kick-held"
    )
    && player.nativePlayerNumber === match.possession.owner
  ));
  const heldKick = kickHolder?.livePass ?? kickHolder?.liveShot ?? null;
  const keeperHandsHolder = kickHolder === undefined && match.possession.inHands === 1
    ? match.players.find(({ nativePlayerNumber }) => (
        nativePlayerNumber === match.possession.owner
      ))
    : undefined;
  if (keeperHandsHolder !== undefined && keeperHandsHolder.role !== "keeper") {
    throw new Error("Open-play keeper-hands traversal lost its native keeper owner.");
  }
  const postOwnerKickBall = match.ball;
  let ball = kickHolder === undefined
    ? keeperHandsHolder === undefined
      ? match.ball
      : createBallMatchState({
          ...clone(match.ball),
          ball: {
            ...clone(match.ball.ball),
            // process_ball updates speed/zones while an ordinary hands owner
            // has negative contact, but it does not call hold_ball. Until the
            // keeper's source-order visit, the other team still reads the
            // position and displacement published by his preceding visit.
            position: clone(sourceKeeperHandsBall.position),
            displacement: clone(sourceKeeperHandsBall.displacement),
          },
        })
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
  let canBeOffside = match.rules.canBeOffside;
  if (canBeOffside !== 0 && canBeOffside !== 1) {
    throw new Error("Open-play contact traversal lost can_be_offside.");
  }
  const kickReleases = new Map();
  const controlContacts = new Map();
  const controlCompletions = new Map();
  const controlTweens = new Map();
  const heldBallTweens = new Map();
  const keeperContacts = new Map();
  const keeperStarts = new Map();
  const collections = [];
  const visits = [];
  let firstReboundNativePlayer = null;
  let reselection = null;
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
  const releasesHeldKick = kickHolder !== undefined
    && F32(kickHolder.animation.frame + kickHolder.animation.frameStep)
      >= heldKick.contact;
  const releasePlayers = releasesHeldKick
    ? projectSourceBusySupportRuns(match, nextTick, sourceAiBall).players
    : match.players;
  const releaseByNativePlayer = new Map(
    releasePlayers.map((player) => [player.nativePlayerNumber, player]),
  );
  const releaseRates = releasesHeldKick
    ? new Map(currentTeamRates(match.players, match.clock.gameMinute)
        .map(({ id, value }) => [id, value]))
    : new Map();
  const releaseZones = releasesHeldKick
    ? match.ball.ball.outOfPlay !== 0
      ? match.kickoff.zoning
      : stepCssoccerZoneState(createCssoccerZoneState(), {
          ballPosition: sourceHeldKickZoneBallPosition(
            match.players,
            match.possession.owner,
          ) ?? sourceAiBall.position,
          ballOutOfPlay: 0,
          matchMode: 0,
          ballInHands: match.possession.inHands === 0 ? 0 : 1,
          possessionPlayer: match.possession.owner,
        })
    : null;
  const visitedNativePlayers = new Set();
  for (const nativePlayerNumber of [...firstTeam, ...secondTeam]) {
    const player = byNativePlayer.get(nativePlayerNumber);
    if (player === undefined) {
      throw new Error(`Open-play contact lost native player ${nativePlayerNumber}.`);
    }
    if (!player.active) continue;
    const preVisitBallPosition = clone(ball.ball.position);
    if (
      (
        kickHolder?.nativePlayerNumber === nativePlayerNumber
        || keeperHandsHolder?.nativePlayerNumber === nativePlayerNumber
      )
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
    const firstTimeStrike = player.liveFirstTimeIntercept?.phase === "strike"
      ? player.liveFirstTimeIntercept
      : null;
    // first_time_strike publishes tm_strike as soon as it reserves an
    // intercept, including the RUN/WAIT approach. BALLINT.CPP's ordinary
    // loose-ball touch path is guarded by !tm_strike for that whole journey;
    // only STRIKE_ACT may resolve the prepared contact.
    const firstTimeStrikeBusy = player.liveFirstTimeIntercept !== undefined;
    const animationBound = ball.limbo.active !== 0
      && ball.limbo.player === nativePlayerNumber;
    let interaction = animationBound
      ? "skipped"
      : justThrown ? "none" : sameTeamNonOwner ? "same-team-skip" : "none";
    if (
      kickHeldOwner
      && F32(player.animation.frame + player.animation.frameStep)
        >= playerHeldKick.contact
    ) {
      const shotKick = player.liveShot?.phase === "kick-held";
      const currentPassReceiver = shotKick || player.livePass.targetNativePlayer === 0
        ? null
        : byNativePlayer.get(player.livePass.targetNativePlayer);
      // pass_ball reads a receiver that has already completed its go_team
      // visit from the updated teams[] slot, including that visit's movement.
      const passReceiver = currentPassReceiver === null || currentPassReceiver === undefined
        ? currentPassReceiver
        : visitedNativePlayers.has(currentPassReceiver.nativePlayerNumber)
          ? releaseByNativePlayer.get(currentPassReceiver.nativePlayerNumber)
          : currentPassReceiver;
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
        const releaseWantPassNativePlayer = sourceWantPassAtPlayerVisit({
          lastTouch: match.possession.lastTouch,
          players: match.players,
          visitedNativePlayers,
        });
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
          wantedReceiver:
            releaseWantPassNativePlayer === player.livePass.targetNativePlayer,
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
    } else if (
      firstTimeStrike !== null
      // BALLINT.CPP enters STRIKE_ACT contact only while ball_poss is zero or
      // belongs to the other team. A prior source-order collection by this
      // player or a teammate leaves the strike animation busy without
      // invoking strike_ball_off on the newly owned ball.
      && (
        possession.owner === 0
        || (possession.owner < 12) !== (nativePlayerNumber < 12)
      )
      && F32(player.animation.frame + player.animation.frameStep)
        >= firstTimeStrike.contact
    ) {
      const contactPosition = {
        x: F32(player.position.x + firstTimeStrike.contactOffset.x),
        y: F32(player.position.y + firstTimeStrike.contactOffset.y),
        z: F32(player.position.z + firstTimeStrike.contactOffset.z),
      };
      const planarDistance = sourceDistance2d({
        x: F32(ball.ball.position.x - contactPosition.x),
        y: F32(ball.ball.position.y - contactPosition.y),
      });
      const verticalDistance = Math.abs(Math.trunc(F32(
        ball.ball.position.z - contactPosition.z,
      )));
      if (
        (planarDistance <= ball.ball.speed + 2 || planarDistance <= 8)
        && verticalDistance
          <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value / 2
      ) {
        const strikePossession = collectPossession(possession, nativePlayerNumber);
        let released;
        let releaseEvent;
        if (firstTimeStrike.kind === "shot") {
          const keeper = byNativePlayer.get(
            firstTimeStrike.targetKeeperNativePlayer,
          );
          if (keeper === undefined || keeper.role !== "keeper") {
            throw new Error(
              `First-time shot release lost keeper ${firstTimeStrike.targetKeeperNativePlayer}.`,
            );
          }
          // ACTIONS.CPP strike_ball_off -> kick_strike -> shoot_ball after
          // publishing this striker as ball_poss. The first-time decision is
          // computer-owned, so it uses the ordinary uncharged shot branch.
          released = releaseCssoccerShot({
            ball,
            charge: null,
            direction: null,
            drive: false,
            keeper: {
              nativePlayerNumber: keeper.nativePlayerNumber,
              position: clone(keeper.position),
            },
            owner: liveShotHolder(player),
            possession: strikePossession,
            rng,
            tick: ball.ball.tick,
            userControlled: false,
          });
          interaction = "shot-release";
          releaseEvent = {
            type: "shot-released",
            tick: ball.ball.tick,
            playerId: player.id,
            targetKeeperNativePlayer:
              released.release.targetKeeperNativePlayer,
            firstTime: true,
          };
        } else {
          const passReceiver = byNativePlayer.get(
            firstTimeStrike.targetNativePlayer,
          );
          if (passReceiver?.liveMotion === undefined) {
            throw new Error(
              `First-time ${firstTimeStrike.kind} release lost receiver ${firstTimeStrike.targetNativePlayer}.`,
            );
          }
          const releaseFirstTimePass = firstTimeStrike.kind === "header"
            ? releaseCssoccerHeaderPass
            : releaseCssoccerChipPass;
          released = releaseFirstTimePass({
            ball,
            possession: strikePossession,
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
            wantedReceiver: firstTimeStrike.wantedReceiver,
          });
          interaction = "pass-release";
          releaseEvent = {
            type: firstTimeStrike.kind === "header"
              ? "header-pass-released"
              : "chip-pass-released",
            tick: ball.ball.tick,
            playerId: player.id,
            receiverId: passReceiver.id,
            firstTime: true,
          };
        }
        ball = released.ball;
        possession = released.possession;
        rng = released.rng;
        kickReleases.set(player.id, {
          ball: clone(released.ball),
          release: clone(released.release),
        });
        events.push(releaseEvent);
      }
    } else if (kickHeldOwner) {
      interaction = "kick-held";
    }
    if (
      player.role === "keeper"
      && player.liveKeeper?.phase === "save"
      && player.liveKeeper.contactResolved !== true
    ) {
      const contactKeeper = {
        ...player,
        position: clone(player.previousPosition),
      };
      const contact = resolveCssoccerKeeperSaveContact({
        // keeper_boxes has already materialized this tick's SAVE_ACT frame
        // and movement. BALLINT.CPP ball_interact runs first, so contact
        // geometry uses the retained pre-action keeper position.
        animationFrame: player.animation.frame,
        ball,
        goDisplacement: player.liveMotion.goDisplacement,
        keeper: keeperAiFrame(contactKeeper),
        plan: player.liveKeeper.plan,
        possession,
      });
      if (contact.status !== "pending") {
        const contactedKeeper = {
          ...clone(player),
          liveKeeper: {
            ...clone(player.liveKeeper),
            contactResolved: true,
            contactOutcome: contact.outcome,
          },
        };
        keeperContacts.set(player.id, contactedKeeper);
        ball = contact.ball;
        possession = contact.possession;
        interaction = contact.outcome === "catch" ? "collect" : interaction;
        events.push({
          type: `keeper-save-${contact.outcome}`,
          tick: nextTick,
          playerId: player.id,
          nativePlayerNumber,
        });
      }
    }
    let collectedControl = false;
    const controlIntercept = player.liveControlIntercept;
    const playerPossession = possession.players.find(({ nativePlayer }) => (
      nativePlayer === nativePlayerNumber
    ))?.possession;
    if (!Number.isSafeInteger(playerPossession)) {
      throw new Error(`Open-play contact lost possession state for ${player.id}.`);
    }
    if (
      playerPossession <= 0
      && !justThrown
      && !animationBound
      && controlIntercept?.phase === "control"
      && player.action.action.value === CONTROL_RECEIVE_ACTION
      && F32(player.animation.frame + player.animation.frameStep)
        >= controlIntercept.contact
      && possession.inHands === 0
      && !sameTeamNonOwner
      && !kickHeldOwner
    ) {
      const contact = projectCssoccerControlMotionContact({
        actionIndex: controlIntercept.actionIndex,
        facing: player.facing,
        playerPosition: player.position,
      });
      const planarDistance = sourceDistance2d({
        x: F32(ball.ball.position.x - contact.position.x),
        y: F32(ball.ball.position.y - contact.position.y),
      });
      // BALLINT.CPP resolves abs(ballz-pz) to the integer overload. The
      // Watcom path converts the f32 delta to i32 before abs_, so retain that
      // truncation instead of applying JavaScript's floating-point Math.abs.
      const verticalDistance = Math.abs(Math.trunc(F32(
        ball.ball.position.z - contact.position.z,
      )));
      const contactRange = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value / 2;
      if (
        (planarDistance <= ball.ball.speed + 2 || planarDistance <= 8)
        && verticalDistance <= contactRange
      ) {
        possession = collectPossession(possession, nativePlayerNumber);
        const footControl = controlIntercept.actionIndex === 1;
        ball = createBallMatchState({
          ...clone(ball),
          // BALLINT.CPP keeps MC_TRAPL/MC_TRAPR at the intercept cadence and
          // does not bind foot controls to ball_limbo. Chest/down-head
          // controls switch to their normal animation cadence and do.
          limbo: footControl
            ? { active: 0, player: 0, contact: F32(0) }
            : createBallLimbo({
                player: nativePlayerNumber,
                contact: F32(1 - contact.animationFrameStep),
              }),
          ball: {
            ...clone(ball.ball),
            position: clone(contact.position),
            // collect_ball calls hold_ball before ball_at_contact. That keeps
            // the CONTROL_ACT player's go_txdis/go_tydis in the ball even
            // though ball_limbo now owns its rendered contact position.
            displacement: {
              x: player.liveMotion.goDisplacement.x,
              y: player.liveMotion.goDisplacement.y,
              z: F32(0),
            },
            inAir: 0,
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
        });
        controlContacts.set(player.id, {
          projection: contact,
          contactFrameStep: player.animation.frameStep,
          contactTick: ball.ball.tick,
          frameStep: footControl
            ? player.animation.frameStep
            : contact.animationFrameStep,
          sourcePrediction: {
            position: clone(contact.position),
            displacement: {
              x: player.liveMotion.goDisplacement.x,
              y: player.liveMotion.goDisplacement.y,
              z: F32(0),
            },
          },
        });
        interaction = "collect";
        collectedControl = true;
        events.push({
          type: "ball-collected",
          tick: match.tick,
          playerId: player.id,
          nativePlayerNumber,
        });
      }
    }
    if (
      !collectedControl
      && !justThrown
      && !animationBound
      && !firstTimeStrikeBusy
      &&
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
          animationFrame: sourceBallInteractionAnimationFrame(player),
          control: player.gameplay.control,
          faceDirection: sourceFacingDirection(player.facing),
          facing: clone(player.facing),
          goDisplacement: clone(player.liveMotion.goDisplacement),
          kickedBusy: player.action.action.value === CSSOCCER_NATIVE_ACTIONS.KICK,
          position: clone(player.position),
        },
        possession,
        profile: LIVE_LOOSE_BALL_CONTACT_PROFILE,
        // BALLINT.CPP reads the mutable global seed at this player's source
        // visit. An earlier kick in the same process_teams traversal may have
        // advanced it already.
        seed: rng.seed,
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
            ...(contact.outcome === "collect" ? {
              // BALLINT.CPP collect_ball calls stop_ball_spin and reset_shot
              // after hold_ball, normalizing both signed spin zeros.
              spin: {
                ...clone(ball.ball.spin),
                swerve: 0,
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
            } : {}),
          },
        });
        if (contact.outcome !== "hold") {
          events.push({
            type: contact.outcome === "collect" ? "ball-collected" : "ball-rebounded",
            tick: match.tick,
            playerId: player.id,
            nativePlayerNumber,
          });
          if (
            contact.outcome === "rebound"
            && firstReboundNativePlayer === null
          ) {
            firstReboundNativePlayer = nativePlayerNumber;
          }
        }
      }
    }
    if (
      interaction === "hold"
      && controlIntercept?.phase === "tween"
      && possession.owner === nativePlayerNumber
      && possession.inHands === 0
    ) {
      const factor = F32((-2 - controlIntercept.freeTime) / 8);
      ball = createBallMatchState({
        ...clone(ball),
        ball: {
          ...clone(ball.ball),
          position: {
            x: F32(preVisitBallPosition.x
              + F32(F32(ball.ball.position.x - preVisitBallPosition.x) * factor)),
            y: F32(preVisitBallPosition.y
              + F32(F32(ball.ball.position.y - preVisitBallPosition.y) * factor)),
            z: ball.ball.position.z,
          },
        },
      });
      const decremented = controlIntercept.freeTime - 1;
      controlTweens.set(player.id, decremented === -11 ? 0 : decremented);
    }
    const heldBallTween = player.sourceHeldBallTween;
    const retainedMotionBall = heldBallTween?.capture === undefined
      ? null
      : projectCssoccerRetainedMotionBall({
          animation: heldBallTween.capture.animationId,
          animationFrame: heldBallTween.capture.animationFrame,
          facing: player.facing,
          playerPosition: player.position,
        });
    if (
      (interaction === "hold" || interaction === "collect")
      && heldBallTween?.freeTime < -1
      && possession.owner === nativePlayerNumber
      && possession.inHands === 0
    ) {
      if (heldBallTween.freeTime === -2) {
        if (retainedMotionBall !== null) {
          // get_mcball_coords does not clamp ls_frm to ls_anim. A retained
          // stand frame can address a later player_p slot and publish its
          // raised point exactly as the native contiguous allocation does.
          ball = createBallMatchState({
            ...clone(ball),
            ball: {
              ...clone(ball.ball),
              position: clone(retainedMotionBall.position),
            },
          });
        } else if (heldBallTween.zeroHeightCapture === true) {
          // A prepared point below ground takes get_mcball_coords' fallback.
          ball = createBallMatchState({
            ...clone(ball),
            ball: {
              ...clone(ball.ball),
              position: {
                x: player.position.x,
                y: player.position.y,
                z: F32(LIVE_LOOSE_BALL_CONTACT_PROFILE.ballRadius),
              },
            },
          });
        }
      } else {
        const factor = F32((-2 - heldBallTween.freeTime) / 8);
        ball = createBallMatchState({
          ...clone(ball),
          ball: {
            ...clone(ball.ball),
            position: {
              x: F32(preVisitBallPosition.x
                + F32(F32(ball.ball.position.x - preVisitBallPosition.x) * factor)),
              y: F32(preVisitBallPosition.y
                + F32(F32(ball.ball.position.y - preVisitBallPosition.y) * factor)),
              z: ball.ball.position.z,
            },
          },
        });
      }
      const decremented = heldBallTween.freeTime - 1;
      heldBallTweens.set(player.id, decremented === -11 ? 0 : decremented);
    }
    if (
      !animationBound
      && interaction === "hold"
      && controlIntercept?.phase === "control"
      && player.action.action.value === CONTROL_RECEIVE_ACTION
      && F32(player.animation.frame + player.animation.frameStep) >= 1
      && possession.owner === nativePlayerNumber
      && possession.inHands === 0
    ) {
      const completion = projectCssoccerControlCompletionBall({
        actionIndex: controlIntercept.actionIndex,
        facing: player.facing,
        playerPosition: player.position,
      });
      // control_action calls hold_ball a second time after init_stand_act,
      // then get_mcball_coords replaces the ordinary held-foot position with
      // the final prepared control pose.
      possession = holdPossession(possession);
      ball = createBallMatchState({
        ...clone(ball),
        ball: {
          ...clone(ball.ball),
          position: clone(completion.position),
          // control_action installs STAND before its second hold_ball call;
          // init_stand_act has already cleared go_txdis/go_tydis.
          displacement: { x: F32(0), y: F32(0), z: F32(0) },
        },
      });
      controlCompletions.set(player.id, {
        completion: clone(completion),
        tick: ball.ball.tick,
      });
    }
    if (interaction === "collect") {
      // BALLINT.CPP collect_ball publishes hold_ball's current ball, then
      // USER.CPP reselect immediately rebuilds ball_pred_tab before the
      // remaining go_team visits. Keep this outside the strict visit schema.
      reselection = {
        nativePlayerNumber,
        visitIndex: visits.length,
        sourcePrediction: {
          position: clone(ball.ball.position),
          displacement: clone(ball.ball.displacement),
        },
      };
      collections.push({
        ball: clone(ball),
        nativePlayerNumber,
        possession: clone(possession),
        reselection: clone(reselection),
      });
    }
    if (
      player.role !== "keeper"
      && (interaction === "collect" || interaction === "rebound")
    ) {
      // BALLINT.CPP control_ball and rebound_off_plr raise this global before
      // the same player's override/offside_rule visit.
      canBeOffside = 1;
    }
    visits.push({
      playerId: player.id,
      nativePlayerNumber,
      ballPosition: clone(ball.ball.position),
      canBeOffside,
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
      // override/offside_rule reads the mutable global seed after this
      // player's ball_interact slot. Symbol metadata keeps that source value
      // beside the visit without widening the reducer's strict public frame.
      [SOURCE_OFFSIDE_VISIT_SEED]: rng.seed,
    });
    if (
      player.role === "keeper"
      && player.liveKeeper === undefined
      && player.action.action.value <= CSSOCCER_NATIVE_ACTIONS.RUN
    ) {
      const sameTickShot = [...kickReleases.entries()]
        .map(([playerId, released]) => ({
          player: byNativePlayer.get(released.release.ownerNativePlayer),
          playerId,
          released,
        }))
        .find(({ released }) => (
          released.release.kind === "shot"
          && released.release.targetKeeperNativePlayer === nativePlayerNumber
        ));
      if (
        sameTickShot !== undefined
        && sameTickShot.player?.liveShot?.sourcePrediction !== undefined
        && currentBallThreatensKeeper({
          ball,
          keeper: player,
          nextTick,
          players: match.players,
          possession,
        })
      ) {
        // A shot can cross its contact during an earlier go_team visit. The
        // later keeper then enters free_ball against the released ball in the
        // same traversal, while go_to_save_path still reads the prediction
        // table built before process_teams. Retain both halves of that source
        // state instead of postponing the keeper until the following tick.
        const plan = planCssoccerKeeperSave({
          ball,
          frozenPrediction: sameTickShot.player.liveShot.sourcePrediction,
          keeper: keeperAiFrame(player),
          pitch: {
            length: CSSOCCER_BALL_CONSTANTS.pitchLength,
            width: CSSOCCER_BALL_CONSTANTS.pitchWidth,
            ratio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
          },
          forced: false,
          possessionOwner: sameTickShot.player.nativePlayerNumber,
        });
        if (plan.status === "save-path") {
          const started = beginKeeperSave({
            ball,
            keeper: player,
            nextTick,
            plan,
            possession,
            rng,
            timeFactor: match.config.timing.timeFactor,
          });
          keeperStarts.set(player.id, started.keeper);
          rng = started.rng;
          events.push({
            type: "keeper-save-started",
            tick: nextTick,
            playerId: player.id,
            nativePlayerNumber: player.nativePlayerNumber,
            outcome: plan.outcome,
            animation: plan.animation,
          });
        }
      }
    }
    const releasePlayer = releaseByNativePlayer.get(nativePlayerNumber);
    if (
      releasesHeldKick
      && sameTeamNonOwner
      && releasePlayer !== undefined
      && releasePlayer.role !== "keeper"
      && releasePlayer.id !== match.control.activePlayerId
      && releasePlayer.action.action.value <= CSSOCCER_NATIVE_ACTIONS.RUN
      && releasePlayer.intelligence.count === 0
      && releasePlayer.liveContact === undefined
      && releasePlayer.livePass === undefined
      && releasePlayer.liveShot === undefined
      && releasePlayer.liveKeeper === undefined
      && releasePlayer.liveRestart === undefined
    ) {
      const teamRate = releaseRates.get(releasePlayer.id);
      if (!Number.isSafeInteger(teamRate) || releaseZones === null) {
        throw new Error(`Pass release lost source visit inputs for ${releasePlayer.id}.`);
      }
      const zone = releaseZones[releasePlayer.nativeTeamSlot];
      releaseByNativePlayer.set(nativePlayerNumber, projectCssoccerFreePlayZonalPlayerVisit({
        allowSideStep: true,
        ballPosition: ball.ball.position,
        nextTick,
        player: releasePlayer,
        possession: {
          owner: possession.owner,
          lastTouch: possession.lastTouch,
          inHands: possession.inHands,
        },
        tactics: match.tactics,
        teamRate,
        targetOverride: null,
        zoning: {
          // pitch_bounds suppresses get_ball_zone for the whole countdown.
          // A kick released during that window retains the last in-pitch
          // discrete zone and disables analogue interpolation.
          analogue: match.ball.ball.outOfPlay === 0,
          ballZone: zone.ballZone,
          zoneCenter: zone.zoneCenter,
          teamInPossession: possession.lastTouch !== 0 && (
            (releasePlayer.nativeTeamSlot === "A" && possession.lastTouch < 12)
            || (releasePlayer.nativeTeamSlot === "B" && possession.lastTouch > 11)
          ),
        },
      }));
    }
    visitedNativePlayers.add(nativePlayerNumber);
  }
  const traversal = [...firstTeam, ...secondTeam];
  const puntStandUpdates = new Map();
  if (firstReboundNativePlayer !== null) {
    const reboundVisitIndex = traversal.indexOf(firstReboundNativePlayer);
    for (const player of match.players) {
      if (player.liveKeeper?.phase !== "punt-stand") continue;
      const updated = clone(player);
      if (traversal.indexOf(player.nativePlayerNumber) > reboundVisitIndex) {
        // rebound_off_plr calls reset_shot before this later keeper reaches
        // stand_action, so find_zonal_target is immediately available.
        // keeper_boxes runs before go_team and our retained punt marker has
        // already projected the ordinary stand turn. Restore the source-entry
        // facing so this later go_team visit applies process_dir exactly once.
        updated.facing = clone(player.previousFacing);
        updated.previousFacing = clone(player.previousFacing);
        delete updated.liveKeeper;
      } else {
        // This keeper already completed the current source visit; retain the
        // busy marker until keeper_boxes clears it on the next tick.
        updated.liveKeeper.phase = "punt-stand-cleared";
      }
      puntStandUpdates.set(player.id, updated);
    }
  }
  const releasedPlayers = kickReleases.size === 0
    && controlContacts.size === 0
    && controlCompletions.size === 0
    && controlTweens.size === 0
    && heldBallTweens.size === 0
    && keeperContacts.size === 0
    && keeperStarts.size === 0
    && puntStandUpdates.size === 0
    ? match.players
    : match.players.map((player) => {
        const puntStandUpdate = puntStandUpdates.get(player.id);
        if (puntStandUpdate !== undefined) return puntStandUpdate;
        const keeperContact = keeperContacts.get(player.id);
        if (keeperContact !== undefined) return keeperContact;
        const keeperStart = keeperStarts.get(player.id);
        if (keeperStart !== undefined) return keeperStart;
        const heldBallTween = heldBallTweens.get(player.id);
        if (heldBallTween !== undefined) {
          const tweened = clone(player);
          if (heldBallTween === 0) {
            delete tweened.sourceHeldBallTween;
          } else {
            tweened.sourceHeldBallTween = {
              ...clone(player.sourceHeldBallTween),
              freeTime: heldBallTween,
            };
          }
          return tweened;
        }
        const controlTween = controlTweens.get(player.id);
        if (controlTween !== undefined) {
          const tweened = clone(player);
          if (controlTween === 0) {
            delete tweened.liveControlIntercept;
          } else {
            tweened.liveControlIntercept = {
              ...clone(player.liveControlIntercept),
              freeTime: controlTween,
            };
          }
          return tweened;
        }
        const controlCompletion = controlCompletions.get(player.id);
        if (controlCompletion !== undefined) {
          return {
            ...clone(player),
            liveControlIntercept: {
              ...clone(player.liveControlIntercept),
              completion: clone(controlCompletion.completion),
              completionTick: controlCompletion.tick,
            },
          };
        }
        const controlContact = controlContacts.get(player.id);
        if (controlContact !== undefined) {
          const contact = controlContact.projection;
          return {
            ...clone(player),
            animation: {
              ...clone(player.animation),
              frameStep: controlContact.frameStep,
            },
            liveMotion: {
              ...clone(player.liveMotion),
              animationFrameStep: controlContact.frameStep,
            },
            liveControlIntercept: {
              ...clone(player.liveControlIntercept),
              contactFrameStep: controlContact.contactFrameStep,
              contactTick: controlContact.contactTick,
              frameStep: controlContact.frameStep,
              sourcePrediction: clone(controlContact.sourcePrediction),
            },
          };
        }
        const released = kickReleases.get(player.id);
        if (released === undefined) return player;
        if (player.liveFirstTimeIntercept !== undefined) {
          return {
            ...clone(player),
            liveFirstTimeIntercept: {
              ...clone(player.liveFirstTimeIntercept),
              phase: "released",
              release: clone(released.release),
              releaseBall: clone(released.ball),
            },
          };
        }
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
  const players = kickReleases.size === 0
    ? releasedPlayers
    : releasedPlayers.map((player) => {
        // pass_ball, punt_ball, and shoot_ball all clear receiver_a and
        // receiver_b before publishing any replacement pass receiver.
        if (
          player.passReceiverIntercept !== true
          && player.passReleaseTick === undefined
        ) return player;
        const cleared = clone(player);
        delete cleared.passReceiverIntercept;
        delete cleared.passReleaseTick;
        return cleared;
      });
  return {
    collections,
    match: {
      ...match,
      ball,
      players,
      possession,
      rng: { ...match.rng, state: rng },
      rules: { ...match.rules, canBeOffside },
    },
    releases: [...kickReleases.entries()].map(([playerId, released]) => ({
      playerId,
      release: clone(released.release),
    })),
    reselection,
    visits,
  };
}

function sourceWantPassAtPlayerVisit({
  lastTouch,
  players,
  visitedNativePlayers,
}) {
  const requesters = players.filter((player) => (
    player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
    && player.intelligence.count > 0
  ));
  if (requesters.length > 1) {
    throw new Error("Held-pass release found more than one source want_pass owner.");
  }
  const [requester] = requesters;
  if (requester === undefined) return 0;
  if (readCssoccerActiveWantPassStat(requester) !== lastTouch) {
    // process_comments clears stale global requests before process_teams.
    return 0;
  }
  if (
    visitedNativePlayers.has(requester.nativePlayerNumber)
    && requester.intelligence.count <= 1
  ) {
    // An earlier intelligence visit consumed the request's final tick.
    return 0;
  }
  return requester.nativePlayerNumber;
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

function applyOpenPlayCollectedControlHandoff({
  command,
  contacted,
  events,
  playerDistanceFrame,
  postGoalBallCountdown,
  sourcePlayers,
  sourcePossession,
  visits,
}) {
  if (contacted.possession.owner === 0) return contacted;
  const collections = visits
    .map((visit, index) => ({ visit, index }))
    .filter(({ visit }) => visit.interaction === "collect");
  if (collections.length === 0) return contacted;
  let activePlayerId = contacted.control.activePlayerId;
  for (const { visit: collected, index: collectorVisitIndex } of collections) {
    const collector = contacted.players.find(({ id }) => id === collected.playerId);
    if (collector === undefined) {
      throw new Error("Collected-ball control handoff lost its source player visit.");
    }
    let nextActivePlayerId = activePlayerId;
    if (
      collector.nativeTeamSlot === contacted.control.nativeTeamSlot
      && collector.role !== "keeper"
      && collector.active
    ) {
      nextActivePlayerId = collector.id;
    } else if (collector.nativeTeamSlot !== contacted.control.nativeTeamSlot) {
      const current = contacted.players.find(({ id }) => id === activePlayerId);
      const currentDistance = current === undefined
        ? Number.POSITIVE_INFINITY
        : playerDistanceFrame?.get(current.id);
      if (!Number.isFinite(currentDistance)) {
        throw new Error("Collected-ball opponent reselect lost the source player distance.");
      }
      if (currentDistance >= NATIVE_SELECTION_CIRCLE) {
        const sourceInterceptor = sourcePossession.owner === 0
          ? sourcePlayers.find((player) => {
              if (
                player.nativeTeamSlot !== contacted.control.nativeTeamSlot
                || player.intelligence.move !== 1
                || player.intelligence.count <= 0
                || player.action.action.value === FALL_ACTION
                || !player.active
              ) return false;
              const visitIndex = visits.findIndex(({ playerId }) => (
                playerId === player.id
              ));
              return visitIndex > collectorVisitIndex
                || (
                  visitIndex >= 0
                  && visitIndex < collectorVisitIndex
                  && player.intelligence.count > 1
                );
            })
          : undefined;
        // USER.CPP auto_select_b/auto_select_a gives the live global
        // interceptor slot priority over near_path. A collection can rebuild
        // near_path while a later source-order interceptor still owns that
        // slot, in which case the current controlled player remains selected.
        const mainGuy = sourceInterceptor ?? selectFreeBallNearPathPlayer(
          contacted,
          contacted.control.nativeTeamSlot,
          command,
        );
        // auto_select_b/auto_select_a does not directly select near_path. It
        // gives that player a synthetic distance of one inside the ordinary
        // eligible-user scan. If near_path is the keeper (excluded outside a
        // goal kick), the scan falls back to the smallest tm_dist outfielder.
        // Those tm_dist values were published by player_distances before this
        // collect_ball -> reselect call.
        let candidate = mainGuy?.role !== "keeper" && mainGuy?.active
          ? mainGuy
          : null;
        if (postGoalBallCountdown) {
          candidate = null;
          let lowest = 2000;
          for (const player of contacted.players
            .filter(({ nativeTeamSlot }) => (
              nativeTeamSlot === contacted.control.nativeTeamSlot
            ))
            .slice()
            .sort((left, right) => (
              left.nativePlayerNumber - right.nativePlayerNumber
            ))) {
            if (
              !player.active
              || player.role === "keeper"
              || player.action.action.value === FALL_ACTION
            ) continue;
            const distance = player.id === mainGuy?.id
              ? 1
              : playerDistanceFrame.get(player.id);
            if (!Number.isFinite(distance)) {
              throw new Error("Collected-ball auto-select lost source tm_dist.");
            }
            if (distance < lowest) {
              candidate = player;
              lowest = distance;
            }
          }
        }
        if (candidate !== null) {
          nextActivePlayerId = candidate.id;
        }
      }
    }
    if (nextActivePlayerId === activePlayerId) continue;
    const activeVisitIndex = visits.findIndex(({ playerId }) => (
      playerId === nextActivePlayerId
    ));
    if (activeVisitIndex < 0) {
      throw new Error("Collected-ball control handoff lost native traversal identity.");
    }
    // BALLINT.CPP collect_ball calls USER.CPP reselect before the collector's
    // go_team visit continues. Record each source-order control change rather
    // than only the final collector: a later second collection cannot
    // retroactively erase an earlier handoff before the old user's visit.
    events.push({
      type: "ball-collected-control-handoff",
      tick: contacted.tick,
      previousPlayerId: activePlayerId,
      activePlayerId: nextActivePlayerId,
      sourceVisitIndex: collectorVisitIndex,
      sourceUserVisit: nextActivePlayerId === collector.id
        || activeVisitIndex > collectorVisitIndex,
    });
    activePlayerId = nextActivePlayerId;
  }
  if (activePlayerId === contacted.control.activePlayerId) return contacted;
  return {
    ...contacted,
    control: { ...contacted.control, activePlayerId },
  };
}

function bindSourceOrderedPossessionRunAnimationSteps({
  finalPossession,
  players,
  runPlayerIds,
  visits,
}) {
  const runIds = new Set(runPlayerIds);
  const visitsById = new Map(visits.map((visit) => [visit.playerId, visit]));
  return players.map((player) => {
    if (
      !runIds.has(player.id)
      || Number.isFinite(player.liveMotion?.animationFrameStep)
    ) return player;
    const visit = visitsById.get(player.id);
    if (visit === undefined) {
      throw new Error(`Source-ordered possession run lost ${player.id}'s visit.`);
    }
    if (
      visit.possession.owner !== player.nativePlayerNumber
      || finalPossession.owner === player.nativePlayerNumber
    ) return player;
    const speed = currentPlayerSpeed(
      player,
      player.liveMotion.teamRate,
      false,
      visit.possession,
    );
    return {
      ...clone(player),
      liveMotion: {
        ...clone(player.liveMotion),
        animationFrameStep: F32(RUN_FRAME_STEP * (speed / RUN_REFERENCE_SPEED)),
      },
    };
  });
}

function applySourceOrderedDisplacedHolderIdeaResets(match, visits) {
  const collections = visits.filter(({ interaction }) => interaction === "collect");
  if (collections.length < 2) return match;
  const displacedHolderIds = new Set(
    collections.slice(0, -1).map(({ playerId }) => playerId),
  );
  return {
    ...match,
    players: match.players.map((player) => {
      if (!displacedHolderIds.has(player.id)) return player;
      const reset = clone(player);
      reset.intelligence.special = 0;
      if (
        reset.intelligence.move === 1
        && reset.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
      ) {
        reset.liveMotion.goCount = 1;
      }
      // holder_lose_ball reaches reset_ideas with the holder's source idea.
      // Some browser projections have already consumed its move discriminator
      // while retaining the source countdown, so publish the completed reset.
      reset.intelligence.move = 0;
      reset.intelligence.count = 0;
      return reset;
    }),
  };
}

function projectSourceDisplacedHolderVisit({
  finalPossession,
  journeyInput,
  players,
  sourcePossession,
}) {
  const sourceOwner = sourcePossession.owner;
  if (sourceOwner === 0 || sourceOwner === finalPossession.owner) return players;
  const sourceOwnerIndex = journeyInput.visits.findIndex(
    ({ nativePlayerNumber }) => nativePlayerNumber === sourceOwner,
  );
  const collectorIndex = journeyInput.visits.findIndex((visit) => (
    visit.interaction === "collect"
    && visit.nativePlayerNumber === finalPossession.owner
  ));
  if (sourceOwnerIndex < 0 || collectorIndex < 0 || sourceOwnerIndex >= collectorIndex) {
    return players;
  }
  // A prior opposing collection can displace the source owner before his own
  // go_team slot even when a later collection determines the final owner.
  if (journeyInput.visits[sourceOwnerIndex].possession.owner !== sourceOwner) {
    return players;
  }
  const sourceHolder = journeyInput.players.find(
    ({ nativePlayerNumber }) => nativePlayerNumber === sourceOwner,
  );
  if (sourceHolder === undefined) {
    throw new Error("Source-ordered collection lost its displaced holder.");
  }
  if (sourceHolder.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN) {
    // holder_lose_ball resets the source idea but does not cancel a busy
    // action. A kick therefore continues moving/animating after tm_poss drops.
    return players.map((player) => player.id === sourceHolder.id
      ? {
          ...clone(player),
          intelligence: { special: 0, move: 0, count: 0 },
        }
      : player);
  }
  const projectedVisits = journeyInput.visits.map((visit, index) => index === journeyInput.visits.length - 1
    ? {
        ...clone(visit),
        possession: { ...clone(visit.possession), owner: sourceOwner },
      }
    : visit);
  const sourceJourney = stepCssoccerFreePlayTeamJourneyContinuation({
    ...journeyInput,
    players: journeyInput.players,
    possessionKicks: journeyInput.possessionKicks.filter((id) => id !== sourceHolder.id),
    possessionRuns: [...new Set([...journeyInput.possessionRuns, sourceHolder.id])],
    visits: projectedVisits,
  });
  const visitedHolder = sourceJourney.find(({ id }) => id === sourceHolder.id);
  if (visitedHolder === undefined) {
    throw new Error("Source-ordered collection lost its displaced holder visit.");
  }
  const displaced = {
    ...visitedHolder,
    intelligence: { special: 0, move: 0, count: 0 },
    liveMotion: { ...visitedHolder.liveMotion, kind: "run" },
  };
  // collect_ball/reset_ideas cancels an in-progress kick before got_ball
  // installs this source-ordered run. Do not carry the browser kick owner
  // across that action replacement.
  delete displaced.livePass;
  delete displaced.liveShot;
  return players.map((player) => player.id === displaced.id ? displaced : player);
}

function preserveControlForSourceOrderedUserVisit({ before, handedOff, releases }) {
  const previousId = before.control.activePlayerId;
  const nextId = handedOff.control.activePlayerId;
  if (previousId === nextId || releases.length === 0) return handedOff;
  if (releases.length !== 1) {
    throw new Error("Source-ordered control handoff requires one released player visit.");
  }
  const previous = before.players.find(({ id }) => id === previousId);
  const releasePlayer = before.players.find(({ id }) => id === releases[0].playerId);
  if (previous === undefined || releasePlayer === undefined) {
    throw new Error("Source-ordered control handoff lost its player visit identity.");
  }
  const traversal = nativeContactTraversalOrder(before.tick & 1);
  const previousVisit = traversal.indexOf(previous.nativePlayerNumber);
  const releaseVisit = traversal.indexOf(releasePlayer.nativePlayerNumber);
  if (previousVisit < 0 || releaseVisit < 0) {
    throw new Error("Source-ordered control handoff lost native traversal identity.");
  }
  // ACTIONS.CPP go_team visits the local player in native order. A later
  // new_interceptor/reselect may change the published control, but it cannot
  // retroactively replace the user visit that already ran this source tick.
  if (previousVisit > releaseVisit) return handedOff;
  return {
    ...handedOff,
    control: {
      ...handedOff.control,
      activePlayerId: previousId,
    },
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
  // INTELL.CPP offside_rule keys from ball_released, not pass_type. Shots,
  // punts, and passes all expose the same live-kick offside window.
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
    canBeOffside: before.rules.canBeOffside,
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

function sourceHeldKickZoneBallPosition(players, possessionOwner) {
  if (!Number.isSafeInteger(possessionOwner) || possessionOwner < 0) {
    throw new TypeError("Held-kick zone lookup requires the source possession owner.");
  }
  const holder = players.find((player) => (
    player.nativePlayerNumber === possessionOwner
    && (
      player.livePass?.phase === "kick-held"
      || player.liveShot?.phase === "kick-held"
    )
  ));
  return holder?.livePass?.zoneBallPosition
    ?? holder?.liveShot?.zoneBallPosition
    ?? null;
}

function projectSourcePossessionDecisionPlayers({
  command,
  extraBusyPlayerIds,
  logicCount,
  match,
  nearPath,
  nextTick,
  postGoalBallCountdown,
  sourceActivePlayerId,
  sourcePlayers,
  sourcePossessionOwner,
  sourceZoneBallPosition,
  supportRun,
  takerId,
  visits,
}) {
  const decisionVisit = visits.find((visit) => {
    if (visit.interaction !== "collect" && visit.interaction !== "hold") return false;
    const holder = match.players.find(({ id }) => id === visit.playerId);
    if (
      holder === undefined
      || holder.role === "keeper"
      || holder.liveMotion === undefined
      || holder.nativePlayerNumber !== visit.possession.owner
      || holder.id === match.control.activePlayerId
    ) return false;
    if (
      (
        holder.liveContact !== undefined
        && holder.liveContact.phase !== "barge"
      )
      || (
        holder.liveControlIntercept !== undefined
        && holder.liveControlIntercept.phase !== "tween"
      )
      || holder.liveFirstTimeIntercept !== undefined
      || holder.livePass !== undefined
      || holder.liveShot !== undefined
      || holder.liveKeeper !== undefined
    ) return false;
    return !(
      visit.interaction === "hold"
      && holder.intelligence.count > 1
      && holder.liveMotion.kind === "run-with-ball"
    );
  });
  if (decisionVisit === undefined) {
    return {
      decisionPlayers: match.players,
      supportPlayers: match.players,
    };
  }

  const holder = match.players.find(({ id }) => id === decisionVisit.playerId);
  if (holder === undefined) {
    throw new Error("Source-ordered possession decision lost its holder.");
  }
  const holderVisitIndex = visits.findIndex(({ playerId }) => playerId === holder.id);
  if (holderVisitIndex < 0) {
    throw new Error("Source-ordered possession decision lost native traversal identity.");
  }
  const busyPlayerIds = new Set([
    ...match.players
      .filter((player) => (
        player.livePass !== undefined
        || player.liveShot !== undefined
        || player.liveKeeper !== undefined
        || (
          player.liveControlIntercept !== undefined
          && player.liveControlIntercept.phase !== "tween"
        )
        || player.liveFirstTimeIntercept !== undefined
        || (
          player.liveContact !== undefined
          && player.liveContact.phase !== "barge"
        )
        || player.liveRestart !== undefined
      ))
      .map(({ id }) => id),
    ...extraBusyPlayerIds,
  ]);
  // This projection exists only to publish the teammates already visited
  // when the first new got_ball decision executes. Players after that holder
  // have not run yet and must stay untouched. An earlier holder can only have
  // been skipped by decisionVisit because its existing I_DRIBBLE remains
  // busy; preserve that source run explicitly.
  const priorPossessionRuns = visits
    .slice(0, holderVisitIndex)
    .filter((visit) => {
      const player = match.players.find(({ id }) => id === visit.playerId);
      return player !== undefined
        && player.role !== "keeper"
        && player.id !== match.control.activePlayerId
        && !busyPlayerIds.has(player.id)
        && player.nativePlayerNumber === visit.possession.owner;
    })
    .map(({ playerId }) => playerId);
  const unvisitedPlayerIds = visits
    .slice(holderVisitIndex + 1)
    .map(({ playerId }) => playerId);
  const projectionBusyPlayerIds = new Set([
    ...busyPlayerIds,
    ...unvisitedPlayerIds,
  ]);
  const zoneBallPosition = postGoalBallCountdown
    ? match.ball.outcome?.crossing ?? match.ball.ball.position
    : sourceHeldKickZoneBallPosition(
        match.players,
        sourcePossessionOwner,
      ) ?? sourceZoneBallPosition;
  let projectedPlayers = stepCssoccerFreePlayTeamJourneyContinuation({
    controlledPlayerId: match.control.activePlayerId,
    freeBallOutOfPlay: false,
    logicCount,
    nextTick,
    players: match.players,
    // collect_ball/reset_ideas cancels the collector's pre-contact journey
    // before got_ball chooses the same-visit possession action.
    possessionKicks: [...projectionBusyPlayerIds].filter((id) => (
      id !== holder.id && !priorPossessionRuns.includes(id)
    )),
    possessionRuns: [holder.id, ...priorPossessionRuns],
    rngSeed: match.rng.state.seed,
    sourceDecisionPlayers: match.players,
    supportRun,
    tactics: match.tactics,
    takerId,
    teamRates: currentTeamRates(match.players, match.clock.gameMinute),
    visits,
    zoneAnalogue: !postGoalBallCountdown,
    zoneBallPosition,
    zoneState: match.kickoff.zoning,
  });
  const sourceActiveVisitIndex = sourceActivePlayerId === null
    ? -1
    : visits.findIndex(({ playerId }) => playerId === sourceActivePlayerId);
  const sourceActiveVisit = sourceActiveVisitIndex < 0
    ? undefined
    : visits[sourceActiveVisitIndex];
  if (
    sourceActiveVisitIndex >= 0
    && sourceActiveVisitIndex < holderVisitIndex
    && sourceActiveVisit.possession.owner === 0
  ) {
    // Team B can visit the selected loose-ball interceptor before a later
    // Team A collector reaches got_ball/pass_decide. The collector's
    // get_opp_dir_tab lookup therefore sees the already-moved user, not the
    // loop-entry position that the generic team projection intentionally
    // leaves untouched.
    projectedPlayers = stepActiveFreeBallJourney(
      match,
      projectedPlayers,
      nextTick,
      command,
      visits,
      nearPath,
      sourcePlayers,
      sourceActiveVisit.possession,
      sourceActivePlayerId,
    );
  } else if (
    sourceActiveVisitIndex >= 0
    && sourceActiveVisitIndex < holderVisitIndex
    && sourceActiveVisit.possession.owner !== 0
    && command.buttons === 0
  ) {
    const sourceActive = sourcePlayers.find(
      ({ id }) => id === sourceActivePlayerId,
    );
    const projectedActive = projectedPlayers.find(
      ({ id }) => id === sourceActivePlayerId,
    );
    const busySupportRun = projectedActive?.intelligence.move
      === RUN_ON_INTELLIGENCE_MOVE
      && projectedActive.intelligence.count > 0
      && projectedActive.liveMotion?.kind === "support-run";
    if (
      sourceActive !== undefined
      && projectedActive !== undefined
      && projectedActive.action.action.value <= CSSOCCER_NATIVE_ACTIONS.RUN
      && projectedActive.liveContact === undefined
      && projectedActive.livePass === undefined
      && projectedActive.liveShot === undefined
      && !busySupportRun
    ) {
      // Team B can run before a later Team A holder (and vice versa). The
      // holder's same-tick get_opp_dir_tab must see that completed user_play
      // position and facing, not the loop-entry controlled-player pose.
      const visited = applyCurrentSourceUserVisit({
        ball: match.ball,
        ballPossession: sourceActiveVisit.possession.owner,
        command,
        match: { ...match, players: projectedPlayers },
        nextTick,
        player: projectedActive,
        sourcePlayer: sourceActive,
      });
      projectedPlayers = projectedPlayers.map((player) => (
        player.id === visited.id ? visited : player
      ));
    }
  }
  const visitedBeforeHolder = new Set(
    visits.slice(0, holderVisitIndex).map(({ playerId }) => playerId),
  );
  const projectedById = new Map(projectedPlayers.map((player) => [player.id, player]));
  const currentById = new Map(match.players.map((player) => [player.id, player]));
  const decisionPlayers = sourcePlayers.map((player) => (
    visitedBeforeHolder.has(player.id)
      ? projectedById.get(player.id)
      : player.id === holder.id
        ? currentById.get(player.id)
        : player
  ));
  const supportPlayers = sourcePlayers.map((player) => (
    visitedBeforeHolder.has(player.id) || player.id === holder.id
      ? projectedById.get(player.id)
      : player
  ));
  return { decisionPlayers, supportPlayers };
}

function resolveOpenPlayCollectedPossession({
  match,
  sourceDecisionPlayers,
  sourcePossessionOwner,
  visits,
  wantPassNativePlayer,
}) {
  if (
    !Number.isSafeInteger(sourcePossessionOwner)
    || sourcePossessionOwner < 0
    || sourcePossessionOwner > 22
  ) {
    throw new TypeError("Open-play possession decision requires source possession in 0..22.");
  }
  if (
    !Number.isSafeInteger(wantPassNativePlayer)
    || wantPassNativePlayer < 0
    || wantPassNativePlayer > 22
  ) {
    throw new TypeError("Open-play possession decision requires source want_pass in 0..22.");
  }
  if (
    !Array.isArray(sourceDecisionPlayers)
    || sourceDecisionPlayers.length !== match.players.length
    || sourceDecisionPlayers.some((player, index) => player.id !== match.players[index].id)
  ) {
    throw new Error("Open-play possession decision lost source traversal player identity.");
  }
  let rng = match.rng.state;
  const passActions = [];
  const shotActions = [];
  const runPlayerIds = [];
  const byId = new Map(visits.map((entry) => [entry.playerId, entry]));
  for (const visit of visits) {
    if (visit.interaction !== "collect" && visit.interaction !== "hold") continue;
    const holder = match.players.find(({ id }) => id === visit.playerId);
    if (holder === undefined || holder.liveMotion === undefined) {
      throw new Error("Open-play possession visit lost its outfield holder state.");
    }
    if (holder.role === "keeper") continue;
    if (holder.nativePlayerNumber !== visit.possession.owner) continue;
    if (
      (
        holder.liveContact !== undefined
        && holder.liveContact.phase !== "barge"
      )
      || (
        holder.liveControlIntercept !== undefined
        && holder.liveControlIntercept.phase !== "tween"
      )
      || holder.liveFirstTimeIntercept !== undefined
      || holder.livePass !== undefined
      || holder.liveShot !== undefined
      || holder.liveKeeper !== undefined
    ) continue;
    if (
      visit.interaction === "collect"
      &&
      holder.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
      && holder.intelligence.count > 1
      && holder.liveMotion.kind === "support-run"
    ) {
      // A supporter can collect during ball_interact before intelligence()
      // consumes its still-busy I_RUN_ON visit. That visit keeps the old run;
      // got_ball/pass_decide does not execute until the idea is reset.
      continue;
    }
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
          sourcePossessionOwner,
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
          sourceBallPosition: clone(visit.ballPosition),
          sourcePossessionOwner: visit.possession.owner,
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
        // dribble_dir raises the global must_pass value when its complete
        // direction search is blocked. That value survives the installed
        // I_DRIBBLE journey and forces the next got_ball pass_decide result.
        mustPass: holder.liveMotion.mustPass === true,
        setPiece: false,
        wantPassNativePlayer,
      },
      players: sourceDecisionPlayers.filter(({ active }) => active).map((player) => {
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
        sourceBallPosition: clone(visit.ballPosition),
        sourcePossessionOwner: visit.possession.owner,
        targetNativePlayer: pass.targetNativePlayer,
        // INTELL.CPP keeps the source-global want_pass request alive while
        // the holder winds up. pass_ball suppresses both accuracy offsets
        // when that requester is the selected receiver.
        wantedReceiver: wantPassNativePlayer === pass.targetNativePlayer,
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
          sourcePossessionOwner,
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
          sourceBallPosition: clone(visit.ballPosition),
          sourcePossessionOwner: visit.possession.owner,
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

function initializeOpenPlayPassActions({
  match,
  nextTick,
  passActions,
  players,
  sourcePredictionBall,
}) {
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
      pass.sourcePossessionOwner !== player.nativePlayerNumber
      || !finiteSourceBallPosition(pass.sourceBallPosition)
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
        // ACTIONS.CPP init_kick_act does not rewrite the retained go_step.
        goStep: player.liveMotion.goStep,
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
        // predict_ball runs immediately before this kick is installed. While
        // the owner keeps a positive contact, process_ball leaves that table
        // untouched, so pressure decisions must retain this exact origin.
        sourcePrediction: {
          position: clone(sourcePredictionBall.position),
          displacement: clone(sourcePredictionBall.displacement),
        },
        publishedBallPosition: clone(pass.sourceBallPosition),
        // get_ball_zone ran against this pre-kick process_ball snapshot. Once
        // contact becomes positive, native freezes both prediction and zone
        // globals until the kick releases.
        zoneBallPosition: clone(sourcePredictionBall.position),
      },
    };
  });
}

function finiteSourceBallPosition(position) {
  return position !== null
    && typeof position === "object"
    && !Array.isArray(position)
    && Number.isFinite(position.x)
    && Number.isFinite(position.y)
    && Number.isFinite(position.z);
}

function initializeOpenPlayShotActions({
  match,
  nextTick,
  players,
  shotActions,
  sourcePredictionBall,
}) {
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
      shot.sourcePossessionOwner !== player.nativePlayerNumber
      || !finiteSourceBallPosition(shot.sourceBallPosition)
      || (
        player.role === "keeper"
        && shot.kind !== "punt"
        && shot.newSetPiece === undefined
      )
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
        // ACTIONS.CPP init_kick_act does not rewrite the retained go_step.
        goStep: player.liveMotion.goStep,
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
        ...(shot.newSetPiece === undefined
          ? {}
          : { newSetPiece: clone(shot.newSetPiece) }),
        contact: launch.contact,
        contactOffset: clone(launch.contactOffset),
        goTarget,
        motionCaptureSpeed,
        // The native ball_pred_tab is frozen for the positive-contact phase
        // of a kick. Preserve the process_ball snapshot that populated it.
        sourcePrediction: {
          position: clone(sourcePredictionBall.position),
          displacement: clone(sourcePredictionBall.displacement),
        },
        publishedBallPosition: clone(shot.sourceBallPosition),
        zoneBallPosition: clone(sourcePredictionBall.position),
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

function stepReleasedPassReceiverJourney({
  command,
  match,
  nextTick,
  pinnedReceiverId = null,
  sourcePredictionState,
  sourcePlayers,
  sourceEntryPlayers = sourcePlayers,
  sourcePossessionOwner,
  visits,
  wantPassNativePlayer,
}) {
  if (
    !Number.isSafeInteger(sourcePossessionOwner)
    || sourcePossessionOwner < 0
    || sourcePossessionOwner > 22
  ) {
    throw new TypeError("Pass receiver first-time search requires source possession in 0..22.");
  }
  if (match.ball.ball.outOfPlay !== 0) {
    // INTELL.CPP free_ball keeps receiver_a/receiver_b pinned, but does not
    // enter go_to_path until BALL.CPP's out-of-play countdown reaches zero.
    return { players: match.players, rng: match.rng.state };
  }
  const traversal = nativeContactTraversalOrder(match.tick & 1);
  const releasedPasser = sourcePlayers.find((player) => {
    const pass = readSourceReleasedPass(player);
    return pass !== null && (
      pass.release.tick < nextTick
      || (
        pass.release.tick === nextTick
        && traversal.indexOf(pass.targetNativePlayer)
          > traversal.indexOf(player.nativePlayerNumber)
      )
    );
  });
  const pinnedReceiver = pinnedReceiverId === null
    ? undefined
    : sourcePlayers.find((player) => (
        player.id === pinnedReceiverId
        && player.passReceiverIntercept === true
        && Number.isSafeInteger(player.passReleaseTick)
        && player.intelligence.count === 0
      ));
  if (pinnedReceiverId !== null && pinnedReceiver === undefined) {
    throw new Error("Pass receiver first-time search lost its pinned receiver.");
  }
  if (releasedPasser === undefined && pinnedReceiver === undefined) {
    return { players: match.players, rng: match.rng.state };
  }
  const releasedPass = releasedPasser === undefined
    ? null
    : readSourceReleasedPass(releasedPasser);
  if (releasedPasser !== undefined && releasedPass === null) {
    throw new Error("Released pass lost its source marker.");
  }
  const sourceReceiver = releasedPass === null
    ? pinnedReceiver
    : sourcePlayers.find(
        ({ nativePlayerNumber }) => (
          nativePlayerNumber === releasedPass.targetNativePlayer
        ),
      );
  if (releasedPass?.targetNativePlayer === 0) {
    return { players: match.players, rng: match.rng.state };
  }
  if (sourceReceiver === undefined) {
    throw new Error("Released pass lost its current outfield receiver.");
  }
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const holderVisit = visitById.get(sourceReceiver.id);
  if (holderVisit === undefined) {
    throw new Error("Pass receiver first-time search lost its source visit.");
  }
  if (holderVisit.possession.owner !== 0) {
    return { players: match.players, rng: match.rng.state };
  }
  const releaseTick = releasedPass?.release.tick
    ?? pinnedReceiver.passReleaseTick;
  const sourceReceiverBallState = releaseTick === nextTick
    && releasedPass !== null
    ? releasedPass.releaseBall
    : sourcePredictionState ?? match.ball;
  const sourceVisitMatch = {
    ...match,
    // pass_ball rebuilds ball_pred_tab immediately for a same-visit release.
    // On later ticks process_ball's pre-contact snapshot owns the table.
    ball: sourceReceiverBallState,
    possession: holderVisit.possession,
  };
  const sourceOrderedReceiver = match.players.find(({ id }) => id === sourceReceiver.id);
  if (sourceOrderedReceiver === undefined) {
    throw new Error("Released pass lost its source-ordered receiver state.");
  }
  const sourceEntryReceiver = sourceEntryPlayers.find(
    ({ id }) => id === sourceReceiver.id,
  );
  // A controlled receiver handoff reaches free_ball/go_to_path before
  // do_action in this same native player visit. Its already-projected support
  // run belongs to the path being replaced; planning from it moves twice.
  const receiver = (
    sourceEntryReceiver !== undefined
    && sourceReceiver.id === match.control.activePlayerId
    && sourceReceiver.passReceiverIntercept !== true
  )
    ? sourceEntryReceiver
    : sourceReceiver;
  const receiverStopped = sourceOrderedReceiver.action.action.value
    === CSSOCCER_NATIVE_ACTIONS.STAND
    && receiver.action.action.value !== CSSOCCER_NATIVE_ACTIONS.STAND;
  if (receiver.role === "keeper") {
    return { players: match.players, rng: match.rng.state };
  }
  if (
    receiver.intelligence.count > 1
    && receiver.passReceiverIntercept !== true
  ) {
    // INTELL.CPP intelligence() decrements an active outfield int_cnt and
    // keeps the player busy. new_interceptor only publishes receiver/near
    // globals; it does not cancel an existing I_RUN_ON (or other busy idea)
    // so free_ball/go_to_path cannot replace that journey in this visit.
    return { players: match.players, rng: match.rng.state };
  }
  if (
    receiver.passReceiverIntercept === true
    && receiver.intelligence.count > 1
  ) {
    const continued = continueFreeBallIntercept(
      receiver,
      sourceVisitMatch,
      nextTick,
    );
    // The browser journey retains one count above the source go_cnt while
    // this explicit receiver remains pinned. An entry count of two consumes
    // the native final go_forward, publishes go_cnt=1, then init_stand_act
    // resets the expired interceptor in the same visit.
    const exactRunCount = receiver.liveMotion
      .sourceInterceptRunCountExact === true;
    const terminalGoCount = exactRunCount ? 1 : 2;
    const receiverStep = receiver.liveControlIntercept !== undefined
      ? continued
      : continued !== null
      && receiver.liveMotion.goCount === terminalGoCount
      ? settleExpiredPassReceiverIntercept(continued, nextTick)
      : continued;
    return {
      players: receiverStep === null
        ? match.players
        : match.players.map((player) => player.id === receiver.id ? receiverStep : player),
      rng: match.rng.state,
    };
  }
  const automaticMoveSelection = (
    receiver.nativeTeamSlot !== match.control.nativeTeamSlot
  );
  // BALLINT.CPP clears receiver_a/receiver_b as soon as this player's
  // ordinary loose-ball contact resolves. Its later go_to_path visit must
  // therefore omit decide_on_face even though our retained receiver marker
  // still identifies the released-pass target.
  const receiverMustFace = automaticMoveSelection
    && !["collect", "rebound"].includes(holderVisit.interaction)
    ? sourceComputerReceiverMustFace(receiver)
    : null;
  const plan = createFreeBallInterceptPlan(receiver, sourceVisitMatch, nextTick, {
    afterTouchInput: {
      x: F32(command.moveX / 127),
      y: F32(command.moveY / 127),
    },
    automaticMoveSelection,
    ballState: sourceVisitMatch.ball,
    controlled: false,
    // intercept() adds one source go_cnt for an ordinary run-on before this
    // visit's run_action consumes its first movement step.
    incrementRunOnCountBeforeAction: true,
    mustFace: receiverMustFace,
    userControlIndex: 1,
    userControlled: false,
  });
  const releasedBeforeReceiverThisVisit = releasedPass?.release.tick === nextTick
    && traversal.indexOf(releasedPasser.nativePlayerNumber)
      < traversal.indexOf(receiver.nativePlayerNumber);
  const sourceOrderedPlanFacing = plan.player === null
    || releasedBeforeReceiverThisVisit
    || match.possession.owner === 0
    || holderVisit.possession.owner !== 0
    ? null
    : turnSourceFacing({
        facing: sourceOrderedReceiver.facing,
        target: {
          x: F32(plan.player.liveMotion.target.x - sourceOrderedReceiver.position.x),
          y: F32(plan.player.liveMotion.target.y - sourceOrderedReceiver.position.y),
        },
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate: plan.player.liveMotion.teamRate },
        ).maxTurnRadians,
      }).facing;
  const plannedPlayer = plan.player === null
    ? null
    : sourceOrderedPlanFacing !== null
      ? {
          ...plan.player,
          // With no same-visit release before this slot, the receiver's
          // RUN_ACT already executed before a later player collected the
          // ball. The replacement route begins on the following visit.
          previousPosition: clone(sourceOrderedReceiver.previousPosition),
          previousFacing: clone(sourceOrderedReceiver.previousFacing),
          position: clone(sourceOrderedReceiver.position),
          velocity: clone(sourceOrderedReceiver.velocity),
          facing: clone(sourceOrderedPlanFacing),
          action: createCssoccerActionState({
            tick: nextTick,
            playerId: receiver.id,
            actionId: plan.player.action.action.value,
            facingX: sourceOrderedPlanFacing.x,
            facingY: sourceOrderedPlanFacing.y,
          }),
          animation: clone(sourceOrderedReceiver.animation),
        }
      : plan.player;
  const receiverVisitIndex = visits.findIndex(({ playerId }) => playerId === receiver.id);
  const visitedBeforeReceiver = new Set(
    visits.slice(0, receiverVisitIndex).map(({ playerId }) => playerId),
  );
  const updatedById = new Map(match.players.map((player) => [player.id, player]));
  const sourceTimePlayers = sourcePlayers.filter(({ active }) => active).map((player) => (
    visitedBeforeReceiver.has(player.id) ? updatedById.get(player.id) : player
  ));
  const eligibleChecks = plan.scan.interceptChecks.filter(
    ({ firstTimeEligible }) => firstTimeEligible,
  );
  const continuingRequests = sourcePlayers.filter((player) => (
    player.active
    && player.nativeTeamSlot === (
      releasedPasser?.nativeTeamSlot ?? sourceReceiver.nativeTeamSlot
    )
    && player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
    && player.intelligence.count > 0
  ));
  if (continuingRequests.length > 1) {
    throw new Error("Pass receiver first-time search found multiple source requests.");
  }
  const firstTimeWantPassNativePlayer = continuingRequests[0]?.nativePlayerNumber
    ?? wantPassNativePlayer;
  const firstTime = !automaticMoveSelection || eligibleChecks.length === 0
    ? { evaluations: [], rng: match.rng.state }
    : resolveSourceFirstTimePassRng({
        eligibleChecks,
        holder: {
          accuracy: receiver.gameplay.accuracy,
          control: receiver.gameplay.control,
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
          wantPassNativePlayer: firstTimeWantPassNativePlayer,
        },
        opponentsNearHolder: countOpenPlayOpponentsNearHolder({
          holder: releasedPasser ?? sourceReceiver,
          match,
          sourcePossessionOwner,
          visits: new Map(visits.map((visit) => [visit.playerId, visit])),
        }),
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
        rng: match.rng.state,
      });
  const firstTimeStrike = selectSourceFirstTimeStrikeIntercept({
    evaluations: firstTime.evaluations,
    match: sourceVisitMatch,
    mustFace: receiverMustFace,
    player: receiver,
  });
  if (
    firstTimeStrike?.kind === "shot"
    || firstTimeStrike?.kind === "header"
  ) {
    const firstTimeAction = materializeSourceFirstTimeShot({
      candidate: firstTimeStrike.candidate,
      kind: firstTimeStrike.kind,
      match: sourceVisitMatch,
      nextTick,
      player: receiver,
      result: firstTimeStrike.result,
      teamRate: firstTimeStrike.teamRate,
      visit: holderVisit,
      wantedReceiver:
        firstTimeWantPassNativePlayer === firstTimeStrike.result.targetNativePlayer,
    });
    return {
      players: match.players.map((player) => (
        player.id === receiver.id ? firstTimeAction : player
      )),
      rng: firstTime.rng,
    };
  }
  if (firstTimeStrike?.kind === "chip") {
    const firstTimeChip = settleCancelledSourceFirstTimeChip({
      candidate: firstTimeStrike.candidate,
      match: sourceVisitMatch,
      nextTick,
      player: receiver,
      result: firstTimeStrike.result,
      teamRate: firstTimeStrike.teamRate,
      visit: holderVisit,
      wantedReceiver:
        firstTimeWantPassNativePlayer === firstTimeStrike.result.targetNativePlayer,
    });
    return {
      players: match.players.map((player) => (
        player.id === receiver.id ? firstTimeChip : player
      )),
      rng: firstTime.rng,
    };
  }
  if (plannedPlayer === null) {
    // go_to_path still runs every eligible first_time_strike probe before it
    // learns that no intercept action survived the scan. Those temporary
    // pass_decide calls restore the player and ball globals, but deliberately
    // retain af_randomize's global side effects.
    return { players: match.players, rng: firstTime.rng };
  }
  const receiverPlan = {
    ...plannedPlayer,
    ...(plannedPlayer.liveControlIntercept?.phase === "run"
      ? {
          liveControlIntercept: {
            ...clone(plannedPlayer.liveControlIntercept),
            sourceRunCountExact: true,
          },
        }
      : {}),
    ...(plan.scan.intercept?.actionIndex === 0
      ? {
          liveMotion: {
            ...clone(plannedPlayer.liveMotion),
            sourceInterceptRunCountExact: true,
          },
        }
      : {}),
    ...(receiverStopped ? {
      liveMotion: {
        ...clone(plannedPlayer.liveMotion),
        // stop_him installs MC_STAND before this later go_team visit;
        // init_run_act then reinstalls MC_RUN at frame zero.
        resetAnimationFrame: true,
      },
    } : {}),
    passReceiverIntercept: true,
    passReleaseTick: releaseTick,
  };
  return {
    players: match.players.map((player) => (
      player.id === receiver.id ? receiverPlan : player
    )),
    rng: firstTime.rng,
  };
}

function readSourceReleasedPass(player) {
  if (
    new Set(["air-pass", "ground-pass"]).has(player.livePass?.phase)
    && player.livePass.release !== undefined
    && player.livePass.releaseBall !== undefined
  ) {
    return {
      release: player.livePass.release,
      releaseBall: player.livePass.releaseBall,
      targetNativePlayer: player.livePass.targetNativePlayer,
    };
  }
  if (
    player.liveFirstTimeIntercept?.phase === "released"
    && player.liveFirstTimeIntercept.release !== undefined
    && player.liveFirstTimeIntercept.releaseBall !== undefined
    && Number.isSafeInteger(player.liveFirstTimeIntercept.targetNativePlayer)
  ) {
    return {
      release: player.liveFirstTimeIntercept.release,
      releaseBall: player.liveFirstTimeIntercept.releaseBall,
      targetNativePlayer: player.liveFirstTimeIntercept.targetNativePlayer,
    };
  }
  return null;
}

function stepOpponentFreeBallJourney({
  command,
  frozenLimboPrediction,
  match,
  nearPath,
  nextTick,
  sourceReleaseNativePlayer = null,
  sourcePredictionState,
  skipPlayerIds,
  sourcePlayers,
  sourcePossessionOwner,
  visits,
  wantPassNativePlayer,
}) {
  if (
    nearPath === null
    || match.ball.ball.outOfPlay !== 0
  ) {
    // free_ball suppresses every ordinary near-path/interceptor visit while
    // BALL.CPP is still counting an out-of-play trajectory down.
    return { players: match.players, rng: match.rng.state };
  }
  const sourcePlayer = sourcePlayers.find(({ id }) => id === nearPath.id);
  if (sourcePlayer === undefined) {
    throw new Error("Opponent free-ball path lost its source player.");
  }
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const sourceVisitIndex = visits.findIndex(({ playerId }) => playerId === sourcePlayer.id);
  if (sourceVisitIndex < 0) {
    throw new Error("Opponent free-ball path lost its source visit.");
  }
  const sourceVisit = visits[sourceVisitIndex];
  const seesLooseBallBeforeCollection = (
    sourcePossessionOwner === 0
    && match.possession.owner !== 0
    && sourceVisit.possession.owner === 0
  );
  if (match.possession.owner !== 0 && !seesLooseBallBeforeCollection) {
    return { players: match.players, rng: match.rng.state };
  }
  const pathMatch = seesLooseBallBeforeCollection
    ? {
        ...match,
        possession: {
          ...match.possession,
          owner: sourceVisit.possession.owner,
          lastTouch: sourceVisit.possession.lastTouch,
          inHands: sourceVisit.possession.inHands,
        },
      }
    : match;
  const traversal = nativeContactTraversalOrder(match.tick & 1);
  if (sourcePossessionOwner !== 0) {
    const currentPossessor = match.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === sourcePossessionOwner,
    );
    const retainedReleaseTick = currentPossessor?.livePass?.release?.tick
      ?? currentPossessor?.liveShot?.release?.tick
      ?? null;
    const releaseNativePlayer = sourceReleaseNativePlayer
      ?? (retainedReleaseTick === nextTick ? sourcePossessionOwner : null);
    const releasedBeforeSourceVisit = releaseNativePlayer !== null
      && traversal.indexOf(releaseNativePlayer)
        < traversal.indexOf(sourcePlayer.nativePlayerNumber);
    // go_team snapshots possession before visiting either team. When the
    // source holder releases during the first team visit, a later opponent
    // sees the ball as free in this same traversal.
    if (!releasedBeforeSourceVisit) {
      return { players: match.players, rng: match.rng.state };
    }
  }
  const frozenPredictionOwnsPath = sourcePlayers.some((player) => {
    const sourceReleaseTick = player.livePass?.release?.tick
      ?? player.liveShot?.release?.tick
      ?? null;
    // process_ball rebuilds ball_pred_tab at the start of every tick. A kick
    // retained only to finish its animation after an earlier release cannot
    // keep that new prediction table frozen.
    if (sourceReleaseTick !== null && sourceReleaseTick < nextTick) return false;
    const heldKick = player.livePass !== undefined
      || player.liveShot !== undefined;
    const heldControl = player.liveControlIntercept?.sourcePrediction !== undefined;
    if (!heldKick && !heldControl) return false;
    const current = match.players.find(({ id }) => id === player.id);
    const releaseTick = current?.livePass?.release?.tick
      ?? current?.liveShot?.release?.tick
      ?? null;
    const releasedBeforeSourceVisit = releaseTick === nextTick
      && traversal.indexOf(player.nativePlayerNumber)
        < traversal.indexOf(sourcePlayer.nativePlayerNumber);
    // A positive-contact kick freezes predict_ball only until pass_ball runs.
    // A later player visit in the same go_team traversal sees the released
    // trajectory and may immediately enter free_ball/go_to_path.
    return !releasedBeforeSourceVisit;
  });
  const expiringCloseDown = sourcePlayer.intelligence.move === CLOSE_DOWN_INTELLIGENCE_MOVE
    && sourcePlayer.intelligence.count === 1;
  const expiringIntercept = sourcePlayer.intelligence.move === 1
    && sourcePlayer.intelligence.count === 1;
  const sourceTeamInterceptor = sourcePossessionOwner === 0
    ? sourcePlayers.find((player) => (
        player.id !== sourcePlayer.id
        && player.nativeTeamSlot === sourcePlayer.nativeTeamSlot
        && (
          (
            (
              player.liveFirstTimeIntercept !== undefined
              || player.liveControlIntercept !== undefined
            )
            && (
              traversal.indexOf(player.nativePlayerNumber)
                > traversal.indexOf(sourcePlayer.nativePlayerNumber)
              || (() => {
                const current = match.players.find(({ id }) => id === player.id);
                return (
                  (
                    current?.liveFirstTimeIntercept !== undefined
                    && current.liveFirstTimeIntercept.phase !== "released"
                  )
                  || current?.liveControlIntercept !== undefined
                );
              })()
            )
          )
          || (
            player.intelligence.move === 1
            && player.intelligence.count > 0
            && Number.isSafeInteger(player.sourceGlobalInterceptorTick)
            && (
              player.intelligence.count > 1
              || traversal.indexOf(player.nativePlayerNumber)
                > traversal.indexOf(sourcePlayer.nativePlayerNumber)
            )
          )
        )
      ))
    : undefined;
  if (
    (frozenPredictionOwnsPath && !expiringCloseDown && !expiringIntercept)
    // free_ball only calls go_to_path while this team's global interceptor
    // slot is empty. Only a loose-ball source-frame I_INTERCEPT can represent
    // that slot: while possession is live, go_to_between also writes
    // I_INTERCEPT without setting interceptor_a/interceptor_b.
    || sourceTeamInterceptor !== undefined
    || skipPlayerIds.has(sourcePlayer.id)
    || sourcePlayer.id === match.control.activePlayerId
    || sourcePlayer.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN
    || (
      sourcePlayer.intelligence.count !== 0
      && !expiringCloseDown
      && !expiringIntercept
    )
    || (
      sourcePlayer.liveContact !== undefined
      && sourcePlayer.liveContact.phase !== "barge"
    )
    || sourcePlayer.livePass !== undefined
    || sourcePlayer.liveShot !== undefined
  ) {
    return { players: match.players, rng: match.rng.state };
  }
  const automaticMoveSelection =
    sourcePlayer.nativeTeamSlot !== match.control.nativeTeamSlot;
  const receiverMustFace = sourcePlayer.passReceiverIntercept === true
    && !["collect", "rebound"].includes(sourceVisit.interaction)
    ? sourceComputerReceiverMustFace(sourcePlayer)
    : null;
  const plan = createFreeBallInterceptPlan(sourcePlayer, pathMatch, nextTick, {
    afterTouchInput: {
      x: F32(command.moveX / 127),
      y: F32(command.moveY / 127),
    },
    // An unselected player on the local user's team still runs computer_play,
    // but go_to_path leaves auto_select disabled for that nominal user slot.
    automaticMoveSelection,
    // BALL.CPP builds ball_pred_tab before process_teams. A player collision
    // later in ball_interact mutates the physical ball but does not rebuild
    // that table, so same-tick go_to_path scans the pre-contact state.
    // pass_ball is the exception; its caller omits this frozen state after
    // rebuilding the prediction for the released pass.
    ballState: sourcePredictionState ?? match.ball,
    controlled: false,
    // shoot_ball releases possession without rebuilding ball_pred_tab. A
    // later source visit must scan the linear pre-shot table retained by the
    // held kick, not the newly launched physical shot.
    frozenShotPrediction: match.players.find((player) => (
      player.liveShot?.release?.tick === nextTick
    ))?.liveShot?.sourcePrediction ?? frozenLimboPrediction,
    incrementRunCountBeforeAction: true,
    // new_interceptor keeps receiver_a/receiver_b pinned after the first
    // run-on expires. The next go_to_path therefore repeats decide_on_face
    // for that receiver instead of treating it as an ordinary near-path run.
    mustFace: receiverMustFace,
    userControlIndex: 0,
    userControlled: false,
  });
  const currentPlayer = match.players.find(({ id }) => id === sourcePlayer.id);
  const plannedPlayer = plan.player !== null
    && sourcePlayer.liveContact?.phase === "barge"
    && currentPlayer?.liveContact?.phase === "barge"
    ? {
        ...plan.player,
        // go_to_path reads the source-entry player pose, but tm_barge is an
        // independent process_anims counter. Keep the already-advanced
        // counter when the same visit replaces the player's route.
        liveContact: clone(currentPlayer.liveContact),
      }
    : plan.player;
  const currentControlledVisit = visits.find(({ playerId }) => (
    playerId === match.control.activePlayerId
  ));
  const autoSelectedPlayerId = plannedPlayer !== null
    && sourcePlayer.nativeTeamSlot === match.control.nativeTeamSlot
    && sourcePlayer.id !== match.control.activePlayerId
    && (
      currentControlledVisit === undefined
      || currentControlledVisit.distance >= NATIVE_SELECTION_CIRCLE
    )
    ? sourcePlayer.id
    : null;
  const eligibleChecks = automaticMoveSelection
    ? plan.scan.interceptChecks.filter(
        ({ firstTimeEligible }) => firstTimeEligible,
      )
    : [];
  if (eligibleChecks.length === 0) {
    return {
      players: plannedPlayer === null
        ? match.players
        : match.players.map((player) => (
            player.id === sourcePlayer.id ? plannedPlayer : player
          )),
      rng: match.rng.state,
      autoSelectedPlayerId,
    };
  }
  const visitedBeforeSource = new Set(
    visits.slice(0, sourceVisitIndex).map(({ playerId }) => playerId),
  );
  const currentById = new Map(match.players.map((player) => [player.id, player]));
  const sourceTimePlayers = sourcePlayers.filter(({ active }) => active).map((player) => (
    visitedBeforeSource.has(player.id) ? currentById.get(player.id) : player
  ));
  const continuingRequests = sourcePlayers.filter((player) => (
    player.active
    && player.nativeTeamSlot === sourcePlayer.nativeTeamSlot
    && player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
    && player.intelligence.count > 0
  ));
  if (continuingRequests.length > 1) {
    throw new Error("Opponent free-ball path found multiple source pass requests.");
  }
  const firstTimeWantPassNativePlayer = continuingRequests[0]?.nativePlayerNumber
    ?? wantPassNativePlayer;
  const firstTime = resolveSourceFirstTimePassRng({
    eligibleChecks,
    holder: {
      accuracy: sourcePlayer.gameplay.accuracy,
      control: sourcePlayer.gameplay.control,
      nativePlayer: sourcePlayer.nativePlayerNumber,
      position: { x: sourcePlayer.position.x, y: sourcePlayer.position.y },
      facing: clone(sourcePlayer.facing),
      pitchRatio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
      power: sourcePlayer.gameplay.power,
      flair: sourcePlayer.gameplay.flair,
      vision: sourcePlayer.gameplay.vision,
      shootingRange: false,
    },
    match: {
      ballInHands: false,
      cross: false,
      mustPass: false,
      setPiece: false,
      wantPassNativePlayer: firstTimeWantPassNativePlayer,
    },
    opponentsNearHolder: countOpenPlayOpponentsNearHolder({
      holder: sourcePlayer,
      match: pathMatch,
      sourcePossessionOwner,
      visits: visitById,
    }),
    players: sourceTimePlayers.map((player) => {
      const visit = visitById.get(player.id);
      if (visit === undefined) {
        throw new Error(`Opponent free-ball path lost ${player.id}.`);
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
    rng: match.rng.state,
  });
  const firstTimeStrike = selectSourceFirstTimeStrikeIntercept({
    evaluations: firstTime.evaluations,
    match: pathMatch,
    mustFace: receiverMustFace,
    player: sourcePlayer,
  });
  if (
    firstTimeStrike?.kind === "shot"
    || firstTimeStrike?.kind === "header"
  ) {
    const firstTimeAction = materializeSourceFirstTimeShot({
      candidate: firstTimeStrike.candidate,
      kind: firstTimeStrike.kind,
      match: pathMatch,
      nextTick,
      player: sourcePlayer,
      result: firstTimeStrike.result,
      teamRate: firstTimeStrike.teamRate,
      visit: sourceVisit,
      wantedReceiver:
        firstTimeWantPassNativePlayer === firstTimeStrike.result.targetNativePlayer,
    });
    return {
      players: match.players.map((player) => (
        player.id === sourcePlayer.id ? firstTimeAction : player
      )),
      rng: firstTime.rng,
      autoSelectedPlayerId,
    };
  }
  if (firstTimeStrike?.kind === "chip") {
    const visit = visitById.get(sourcePlayer.id);
    if (visit === undefined) {
      throw new Error(`First-time chip path lost ${sourcePlayer.id}'s source visit.`);
    }
    const settled = settleCancelledSourceFirstTimeChip({
      candidate: firstTimeStrike.candidate,
      match: pathMatch,
      nextTick,
      player: sourcePlayer,
      result: firstTimeStrike.result,
      teamRate: firstTimeStrike.teamRate,
      visit,
      wantedReceiver:
        firstTimeWantPassNativePlayer === firstTimeStrike.result.targetNativePlayer,
    });
    return {
      players: match.players.map((player) => player.id === sourcePlayer.id ? settled : player),
      rng: firstTime.rng,
      autoSelectedPlayerId,
    };
  }
  return {
    players: plannedPlayer === null
      ? match.players
      : match.players.map((player) => (
          player.id === sourcePlayer.id ? plannedPlayer : player
        )),
    rng: firstTime.rng,
    autoSelectedPlayerId,
  };
}

function selectSourceFirstTimeStrikeIntercept({
  evaluations,
  match,
  player,
  mustFace = sourceComputerReceiverMustFace(player),
}) {
  const source = createFreeBallInterceptSourcePlayer(player, match, {
    automaticMoveSelection: true,
    controlled: false,
    mustFace,
    userControlled: false,
  });
  const playerHeight = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value;
  const selectedByAction = new Map();
  const retainCandidate = (kind, candidate, result) => {
    const current = selectedByAction.get(candidate?.actionIndex);
    if (
      candidate !== null
      && (
        current === undefined
        || candidate.waitTicks < current.candidate.waitTicks
      )
    ) {
      selectedByAction.set(candidate.actionIndex, {
        kind,
        candidate,
        result,
        teamRate: source.teamRate,
      });
    }
  };
  for (const evaluation of evaluations) {
    if (
      evaluation.result.outcome === "shot"
      && evaluation.result.strikeFacing === "forward"
    ) {
      retainCandidate("shot", projectCssoccerFirstTimeShotIntercept({
        contactFacing: evaluation.controlTravel?.face
          ?? evaluation.travel.face,
        player: source.player,
        playerHeight,
        target: evaluation.target,
        tickOffset: evaluation.tickOffset,
      }), evaluation.result);
    }
    if (
      evaluation.result.outcome === "pass"
      && Number.isSafeInteger(evaluation.result.targetNativePlayer)
    ) {
      if (evaluation.result.passType === -1) {
        retainCandidate("chip", projectCssoccerFirstTimeChipIntercept({
          contactFacing: evaluation.travel.face,
          player: source.player,
          playerHeight,
          target: evaluation.target,
          tickOffset: evaluation.tickOffset,
        }), evaluation.result);
      }
      if (
        evaluation.result.passType === -1
        || (
          evaluation.result.passType >= 4
          && evaluation.result.passType <= 6
        )
      ) {
        retainCandidate("header", projectCssoccerFirstTimeStandingHeaderIntercept({
          contactFacing: evaluation.travel.face,
          player: source.player,
          playerHeight,
          target: evaluation.target,
          tickOffset: evaluation.tickOffset,
        }), evaluation.result);
      }
    }
  }
  return [...selectedByAction.values()].sort(
    (left, right) => right.candidate.actionIndex - left.candidate.actionIndex,
  )[0] ?? null;
}

function materializeSourceFirstTimeShot({
  candidate,
  kind = "shot",
  match,
  nextTick,
  player,
  result,
  teamRate,
  visit,
  wantedReceiver = false,
}) {
  if (kind !== "shot" && kind !== "header") {
    throw new Error(`Unsupported first-time source action ${String(kind)}.`);
  }
  const intelligenceCount = Math.trunc(
    candidate.travel.ticks + candidate.waitTicks + candidate.strikeTime,
  );
  const runTicks = Math.max(
    0,
    candidate.travel.ticks - candidate.travel.mustFaceTicks - 1,
  );
  const planned = moveFreeBallInterceptor(player, {
    ballState: match.possession.lastTouch,
    goCount: runTicks,
    intelligenceCount,
    nextTick,
    special: 1,
    target: candidate.target,
    teamRate,
    travel: candidate.travel,
    userControlIndex: 0,
  });
  // INTELL.CPP strike_and_control writes strike.free to tm_ftime before
  // installing every nonzero first-time action. That replaces any negative
  // hold-ball tween retained from an older completed strike.
  delete planned.sourceHeldBallTween;
  const firstTime = {
    phase: "run",
    phaseTick: nextTick,
    kind,
    actionIndex: candidate.actionIndex,
    animationId: candidate.animationId,
    contact: candidate.contact,
    contactOffset: clone(candidate.contactOffset),
    standardFrameStep: candidate.standardFrameStep,
    strikeTime: candidate.strikeTime,
    waitTicks: candidate.waitTicks,
    mustFace: clone(candidate.travel.face),
    mustFaceTicks: candidate.travel.mustFaceTicks,
    ...(kind === "shot"
      ? {
          shotPassType: result.passType,
          targetKeeperNativePlayer: player.nativePlayerNumber < 12 ? 12 : 1,
        }
      : {
          passType: result.passType,
          targetNativePlayer: result.targetNativePlayer,
          wantedReceiver,
        }),
    ballState: match.possession.lastTouch,
  };
  const materialized = {
    ...planned,
    animation: {
      ...clone(planned.animation),
      // process_anims advances the entry clip before intelligence(). When
      // init_run_act changes that clip, init_run_anim resets the new RUN to
      // frame zero; moveFreeBallInterceptor marks that reset as complete.
      // An already-running clip instead retains the entry phase advance.
      frame: planned.liveMotion.sourceAnimationVisitComplete === true
        ? planned.animation.frame
        : F32(player.animation.frame + player.animation.frameStep),
      tick: nextTick,
    },
    liveMotion: {
      ...clone(planned.liveMotion),
      sourceAnimationVisitComplete: true,
    },
    liveFirstTimeIntercept: firstTime,
  };
  if (materialized.liveMotion.goCount > 0) return materialized;
  // intercept installs the first-time RUN before this visit reaches
  // run_action. A one-step journey therefore reaches go_cnt zero and enters
  // must-face/wait/strike now; retaining a zero-count RUN until the next tick
  // invents a source state that never exists.
  return completeSourceFirstTimeRunArrival({
    continued: materialized,
    entryAnimation: {
      id: materialized.animation.id,
      frame: materialized.animation.frame,
    },
    firstTime,
    match,
    nextTick,
    player,
    visit,
  });
}

function settleCancelledSourceFirstTimeChip({
  candidate,
  match,
  nextTick,
  player,
  result,
  teamRate,
  visit,
  wantedReceiver,
}) {
  if (candidate.travel.ticks !== 0) {
    const intelligenceCount = Math.trunc(
      candidate.travel.ticks + candidate.waitTicks + candidate.strikeTime,
    );
    const runTicks = Math.max(
      0,
      candidate.travel.ticks - candidate.travel.mustFaceTicks - 1,
    );
    const planned = moveFreeBallInterceptor(player, {
      ballState: match.possession.lastTouch,
      goCount: runTicks,
      intelligenceCount,
      nextTick,
      special: 1,
      target: candidate.target,
      teamRate,
      travel: candidate.travel,
      userControlIndex: 0,
    });
    // This rejected chip still entered strike_and_control, which overwrites
    // tm_ftime before the later first-time validation cancels the action.
    delete planned.sourceHeldBallTween;
    return {
      ...planned,
      animation: {
        ...clone(planned.animation),
        // process_anims advances the entry clip before go_to_path installs
        // this first-touch journey. An existing RUN therefore keeps that
        // advance; a newly initialized clip has already completed its reset.
        frame: planned.liveMotion.sourceAnimationVisitComplete === true
          ? planned.animation.frame
          : F32(player.animation.frame + player.animation.frameStep),
        tick: nextTick,
      },
      liveMotion: {
        ...clone(planned.liveMotion),
        sourceAnimationVisitComplete: true,
      },
      liveFirstTimeIntercept: {
        phase: "run",
        phaseTick: nextTick,
        kind: "chip",
        actionIndex: candidate.actionIndex,
        animationId: candidate.animationId,
        contact: candidate.contact,
        contactOffset: clone(candidate.contactOffset),
        standardFrameStep: candidate.standardFrameStep,
        strikeTime: candidate.strikeTime,
        waitTicks: candidate.waitTicks,
        mustFace: clone(candidate.travel.face),
        passType: result.passType,
        targetNativePlayer: result.targetNativePlayer,
        wantedReceiver,
        ballState: match.possession.lastTouch,
      },
    };
  }
  const position = {
    x: candidate.target.x,
    y: candidate.target.y,
    z: player.position.z,
  };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(visit.ballPosition.x - position.x),
      y: F32(visit.ballPosition.y - position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians,
  }).facing;
  const intelligenceCount = Math.trunc(
    1 + candidate.waitTicks + candidate.strikeTime,
  );
  const settledPlayer = clone(player);
  delete settledPlayer.sourceHeldBallTween;
  return {
    ...settledPlayer,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    facing,
    target: clone(position),
    intelligence: { special: 0, move: 0, count: intelligenceCount },
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
      ...clone(player.liveMotion),
      kind: "stand",
      teamRate,
      target: { x: position.x, y: position.y },
      goStep: false,
      goCount: 1,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: null,
      animationFrameStep: null,
    },
    liveFirstTimeIntercept: {
      phase: "cancelled-already-there",
      actionIndex: candidate.actionIndex,
      startTick: nextTick,
      passType: result.passType,
      targetNativePlayer: result.targetNativePlayer,
    },
  };
}

function settleExpiredPassReceiverIntercept(player, nextTick) {
  return {
    ...player,
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
      ...player.liveMotion,
      kind: "stand",
      goCount: 1,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: null,
      animationFrameStep: null,
    },
  };
}

function resolveSourceFirstTimePassRng({
  eligibleChecks,
  holder,
  match,
  opponentsNearHolder,
  players,
  rng: initialRng,
}) {
  let rng = initialRng;
  const evaluations = [];
  for (const {
    target,
    tickOffset,
    travel,
    controlTravel,
  } of eligibleChecks) {
    const ball = { x: target.x, y: target.y };
    const forward = clone(travel.face);
    const reverse = { x: F32(-forward.x), y: F32(-forward.y) };
    const shotHolder = (facing) => ({
      nativePlayerNumber: holder.nativePlayer,
      position: clone(holder.position),
      facing,
      accuracy: holder.accuracy,
      control: holder.control,
      flair: holder.flair,
      power: holder.power,
    });
    const shot = (facing) => resolveCssoccerShotDecision({
      ball,
      firstTime: true,
      holder: shotHolder(facing),
      mustShoot: false,
      opponentsNearHolder,
      seed: rng.seed,
      userControlled: false,
    });
    const forwardShot = shot(forward);
    if (forwardShot.outcome === "shot") {
      evaluations.push({
        target: clone(target),
        tickOffset,
        travel: clone(travel),
        controlTravel: clone(controlTravel),
        result: {
          ...clone(forwardShot),
          strikeFacing: "forward",
        },
      });
      continue;
    }
    const reverseShot = shot(reverse);
    if (reverseShot.outcome === "shot") {
      evaluations.push({
        target: clone(target),
        tickOffset,
        travel: clone(travel),
        controlTravel: clone(controlTravel),
        result: {
          ...clone(reverseShot),
          strikeFacing: "reverse",
        },
      });
      continue;
    }
    const punt = (facing) => resolveCssoccerPuntDecision({
      ball,
      firstTime: true,
      holder: shotHolder(facing),
      mustPunt: false,
      opponentsNearHolder,
      seed: rng.seed,
      userControlled: false,
    }).outcome === "punt";
    if (punt(reverse) || punt(forward)) continue;
    const resolved = resolveCssoccerFirstTimePassSearch({
      holder: {
        nativePlayer: holder.nativePlayer,
        position: holder.position,
        facing: forward,
        pitchRatio: holder.pitchRatio,
        power: holder.power,
        flair: holder.flair,
        vision: holder.vision,
        shootingRange: false,
      },
      match,
      players,
      predictions: [{ ball, facing: forward }],
      rng,
    });
    rng = resolved.rng;
    evaluations.push({
      target: clone(target),
      tickOffset,
      travel: clone(travel),
      controlTravel: clone(controlTravel),
      result: clone(resolved.evaluations[0]),
    });
  }
  return {
    evaluations,
    rng,
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

function countOpenPlayOpponentsNearHolder({
  holder,
  match,
  sourcePossessionOwner = holder.nativePlayerNumber,
  visits,
}) {
  // FOOTBALL.CPP get_opp_near_ball runs before process_teams and leaves the
  // count at zero while the ball is loose. A later receiver/interceptor visit
  // must not retroactively manufacture pressure for first_time_strike.
  if (sourcePossessionOwner === 0) return 0;
  const threshold = F32(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 13,
  );
  return match.players.filter((candidate) => {
    if (!candidate.active) return false;
    const visit = visits.get(candidate.id);
    if (visit === undefined) {
      throw new Error(`Open-play pressure count lost ${candidate.id}.`);
    }
    return (candidate.nativePlayerNumber < 12) !== (sourcePossessionOwner < 12)
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
    players: match.players.filter(({ active }) => active).map((player) => {
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
      sourceBallPosition: clone(match.ball.ball.position),
      sourcePossessionOwner: match.possession.owner,
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

function launchOpenPlayUserPass({
  command,
  events,
  match,
  nextTick,
  pass,
  sourcePredictionBall,
}) {
  const launchMatch = {
    ...match,
    rng: { ...match.rng, state: pass.rng },
  };
  const players = initializeOpenPlayPassActions({
    match: launchMatch,
    nextTick,
    passActions: [pass.action],
    players: launchMatch.players,
    sourcePredictionBall,
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
        sourceBallPosition: clone(match.ball.ball.position),
        sourcePossessionOwner: match.possession.owner,
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
        sourceBallPosition: clone(match.ball.ball.position),
        sourcePossessionOwner: match.possession.owner,
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

function launchOpenPlayUserShot({
  command,
  events,
  match,
  nextTick,
  shot,
  sourcePredictionBall,
}) {
  const launchMatch = {
    ...match,
    rng: { ...match.rng, state: shot.rng },
  };
  const players = initializeOpenPlayShotActions({
    match: launchMatch,
    nextTick,
    players: launchMatch.players,
    shotActions: [shot.action],
    sourcePredictionBall,
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
      sourcePredictionBall: input.sourcePredictionBall,
    });
  }
  return launchOpenPlayUserShot({
    command: input.command,
    events: input.events,
    match: input.match,
    nextTick: input.nextTick,
    shot: front,
    sourcePredictionBall: input.sourcePredictionBall,
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
  const resetPlayer = resetSourceIdeasForPhysicalAction(player);
  return {
    ...resetPlayer,
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

function resetSourceIdeasForPhysicalAction(source) {
  const player = clone(source);
  // INTELL.CPP reset_ideas clears tm_strike and the team's interceptor slot.
  // A completed CONTROL_ACT tween retains only tm_ftime for hold_ball, so it
  // survives as non-busy ball-placement state.
  if (player.liveControlIntercept?.phase !== "tween") {
    delete player.liveControlIntercept;
  }
  delete player.liveFirstTimeIntercept;
  delete player.sourceGlobalInterceptorTick;
  return player;
}

function projectSourceFirstTeamBusyIntercepts(
  match,
  nextTick,
  visits,
  sourcePossession = match.possession,
  controlledPlayerId = match.control.activePlayerId,
) {
  if (sourcePossession.inHands !== 0) {
    return { playerIds: [], players: match.players };
  }
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  if (visitById.size !== visits.length) {
    throw new Error("First-team source order found duplicate player visits.");
  }
  const firstTeamSlot = match.tick % 2 === 0 ? "B" : "A";
  if (sourcePossession.owner === 0) {
    if (match.possession.owner === 0) {
      return { playerIds: [], players: match.players };
    }
    const collectorVisitIndex = visits.findIndex((visit) => (
      visit.interaction === "collect"
      && visit.nativePlayerNumber === match.possession.owner
    ));
    const playerIds = [];
    const players = match.players.map((player) => {
      if (!player.active) return player;
      const visit = visitById.get(player.id);
      const playerVisitIndex = visits.findIndex(({ playerId }) => (
        playerId === player.id
      ));
      if (
        visit === undefined
        || collectorVisitIndex < 0
        || playerVisitIndex < 0
        || playerVisitIndex >= collectorVisitIndex
        || visit.possession.owner !== 0
        || player.nativeTeamSlot !== firstTeamSlot
        || player.id === controlledPlayerId
        || player.liveFirstTimeIntercept !== undefined
        || player.intelligence.move !== 1
        || player.intelligence.count <= 1
        || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
        || player.liveMotion?.kind !== "run"
        || (
          player.liveContact !== undefined
          && player.liveContact.phase !== "barge"
        )
        || player.livePass !== undefined
        || player.liveShot !== undefined
      ) return player;
      const continued = continueFreeBallIntercept(
        player,
        { ...match, possession: sourcePossession },
        nextTick,
        {
          ballPosition: visit.ballPosition,
          terminalStandBallPosition: player.liveMotion.goCount === 1
            ? visit.ballPosition
            : null,
        },
      );
      if (continued === null) {
        throw new Error(`First-team free-ball order could not continue ${player.id}.`);
      }
      playerIds.push(player.id);
      return continued;
    });
    return { playerIds, players };
  }
  // The first team completes its go_team visits before a later collector can
  // replace ball_poss. Busy intercept eligibility therefore belongs to the
  // process_teams-entry owner, not the possession published after all 22
  // BALLINT.CPP visits.
  const sourceOwnerTeamSlot = sourcePossession.owner < 12 ? "A" : "B";
  const finalOwnerTeamSlot = match.possession.owner === 0
    ? null
    : match.possession.owner < 12 ? "A" : "B";
  const possessionCrossedTeams = finalOwnerTeamSlot !== null
    && finalOwnerTeamSlot !== sourceOwnerTeamSlot;
  const playerIds = [];
  const players = match.players.map((player) => {
    if (!player.active) return player;
    const scheduledIntercept = Number.isSafeInteger(
      player.liveMotion?.scheduledInterceptOwner,
    );
    const globalIntercept = Number.isSafeInteger(
      player.sourceGlobalInterceptorTick,
    );
    const runningIntercept = player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
      && player.liveMotion?.kind === "run";
    const stoppedIntercept = player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STOP
      && player.liveMotion?.kind === "stop-intercept";
    if (
      player.nativeTeamSlot !== firstTeamSlot
      || (
        player.nativeTeamSlot === sourceOwnerTeamSlot
        && !scheduledIntercept
        && !globalIntercept
      )
      || player.nativePlayerNumber === match.possession.owner
      || player.id === controlledPlayerId
      || player.liveFirstTimeIntercept !== undefined
      || player.intelligence.move !== 1
      || player.intelligence.count <= 0
      || (!runningIntercept && !stoppedIntercept)
      || (
        visitById.get(player.id)?.interaction === "collect"
        && visitById.get(player.id)?.possession.owner === player.nativePlayerNumber
      )
    ) {
      return player;
    }
    const visit = visitById.get(player.id);
    if (visit === undefined) {
      throw new Error(`First-team source order lost the visit for ${player.id}.`);
    }
    const continued = stoppedIntercept
      ? continueBusyStoppedIntercept(player, match, nextTick)
      : continueFreeBallIntercept(player, match, nextTick, {
          ballPosition: visit.ballPosition,
          terminalStandBallPosition: visit.ballPosition,
        });
    if (continued === null) {
      throw new Error(`First-team source order could not continue ${player.id}.`);
    }
    if (player.intelligence.count === 1) {
      return {
        ...continued,
        // reset_ideas installs the replacement route after the old
        // I_INTERCEPT run_action consumes its final go_forward. Leave this
        // player available to the ordinary journey projection below.
        facing: clone(player.facing),
        // The terminal run falls straight into find_zonal_target. There is
        // no intervening init_stand_anim, and init_run_anim must still see an
        // active MC_BARGE so its tm_barge guard can preserve that clip.
        animation: clone(player.animation),
        intelligence: { special: 0, move: 0, count: 0 },
      };
    }
    playerIds.push(player.id);
    const scheduledInterceptOwner = possessionCrossedTeams
      && player.nativeTeamSlot !== sourceOwnerTeamSlot
      ? sourcePossession.owner
      : player.liveMotion.scheduledInterceptOwner;
    return Number.isSafeInteger(scheduledInterceptOwner)
      ? {
          ...continued,
          liveMotion: {
            ...continued.liveMotion,
            scheduledInterceptOwner,
          },
        }
      : continued;
  });
  return { playerIds, players };
}

function projectSourceReleasedPassInterceptorReset({
  nextTick,
  players,
  releases,
  sourcePlayers,
}) {
  const resetPlayerIds = new Set();
  for (const { release } of releases) {
    if (
      release.tick !== nextTick
      || !Number.isSafeInteger(release.receiverNativePlayer)
      || release.receiverNativePlayer === 0
    ) continue;
    const receiverTeamSlot = release.receiverNativePlayer < 12 ? "A" : "B";
    const candidates = sourcePlayers.filter((player) => (
      player.active
      && player.nativeTeamSlot === receiverTeamSlot
      && player.intelligence.move === 1
      && player.intelligence.count > 0
      && Number.isSafeInteger(player.sourceGlobalInterceptorTick)
    ));
    if (candidates.length > 1) {
      throw new Error(
        `Released pass found multiple retained ${receiverTeamSlot} interceptors.`,
      );
    }
    if (candidates.length === 1) resetPlayerIds.add(candidates[0].id);
  }
  if (resetPlayerIds.size === 0) return { playerIds: [], players };
  return {
    playerIds: [...resetPlayerIds],
    players: players.map((player) => {
      if (!resetPlayerIds.has(player.id)) return player;
      const reset = clone(player);
      delete reset.passReceiverIntercept;
      delete reset.passReleaseTick;
      delete reset.liveMotion.scheduledInterceptOwner;
      delete reset.sourceGlobalInterceptorTick;
      reset.sourceReleasedInterceptorResetTick = nextTick;
      reset.intelligence = { special: 0, move: 0, count: 0 };
      if (
        reset.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
        && reset.liveMotion?.kind === "run"
      ) {
        // new_interceptor resets the previous team interceptor at the
        // releaser's later source-order visit. reset_ideas shortens its
        // already-published RUN journey without replaying that player.
        reset.liveMotion.goCount = 1;
      }
      return reset;
    }),
  };
}

function consumeSourceReleasedInterceptorFinalRuns(players, nextTick) {
  return players.map((player) => {
    if (
      !Number.isSafeInteger(player.sourceReleasedInterceptorResetTick)
      || player.sourceReleasedInterceptorResetTick >= nextTick
    ) return player;
    const advanced = clone(player);
    delete advanced.sourceReleasedInterceptorResetTick;
    if (
      advanced.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      || advanced.liveMotion?.kind !== "run"
      || advanced.liveMotion.goCount !== 1
    ) return advanced;
    const displacement = clone(advanced.liveMotion.goDisplacement);
    advanced.previousPosition = clone(advanced.position);
    advanced.position = {
      ...updateSourcePosition2d({
        position: {
          x: advanced.position.x,
          y: advanced.position.y,
        },
        displacement,
      }),
      z: advanced.position.z,
    };
    advanced.velocity = { ...displacement, z: F32(0) };
    advanced.liveMotion.goCount = 0;
    return advanced;
  });
}

function normalizeSourceGlobalInterceptors(match, visits) {
  const visitIndex = new Map(visits.map((visit, index) => [
    visit.playerId,
    index,
  ]));
  const retainedIds = new Set();
  for (const nativeTeamSlot of ["A", "B"]) {
    const candidates = match.players
      .filter((player) => (
        player.active
        && player.nativeTeamSlot === nativeTeamSlot
        && Number.isSafeInteger(player.sourceGlobalInterceptorTick)
        && (
          (
            player.intelligence.move === 1
            && player.intelligence.count > 0
          )
          || player.liveControlIntercept !== undefined
          || player.liveFirstTimeIntercept !== undefined
        )
      ))
      .sort((left, right) => (
        right.sourceGlobalInterceptorTick - left.sourceGlobalInterceptorTick
        || (visitIndex.get(right.id) ?? -1) - (visitIndex.get(left.id) ?? -1)
      ));
    if (candidates.length > 0) retainedIds.add(candidates[0].id);
  }
  return {
    ...match,
    players: match.players.map((player) => {
      if (
        !Number.isSafeInteger(player.sourceGlobalInterceptorTick)
        || retainedIds.has(player.id)
      ) return player;
      const cleared = clone(player);
      delete cleared.sourceGlobalInterceptorTick;
      return cleared;
    }),
  };
}

function projectSourceCancelledFirstTimeIntercepts(match, nextTick, visits) {
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const playerIds = [];
  const players = match.players.map((player) => {
    if (!player.active) return player;
    if (
      player.liveFirstTimeIntercept?.phase !== "cancelled-already-there"
      || player.intelligence.count <= 1
    ) return player;
    const visit = visitById.get(player.id);
    if (visit === undefined) {
      throw new Error(`Cancelled first-time intercept lost ${player.id}'s source visit.`);
    }
    const teamRate = player.liveMotion?.teamRate;
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Cancelled first-time intercept lost ${player.id}'s current rate.`);
    }
    const ownsBall = visit.possession.owner === player.nativePlayerNumber
      && (visit.interaction === "collect" || visit.interaction === "hold");
    const facing = ownsBall
      ? clone(player.facing)
      : turnSourceFacing({
          facing: player.facing,
          target: {
            x: F32(visit.ballPosition.x - player.position.x),
            y: F32(visit.ballPosition.y - player.position.y),
          },
          maxTurnRadians: projectCssoccerMotionSourceProfile(
            CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
            { teamRate },
          ).maxTurnRadians,
        }).facing;
    playerIds.push(player.id);
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      velocity: { x: F32(0), y: F32(0), z: F32(0) },
      facing,
      intelligence: {
        special: 0,
        move: 0,
        count: player.intelligence.count - 1,
      },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
        facingX: facing.x,
        facingY: facing.y,
      }),
      liveMotion: {
        ...clone(player.liveMotion),
        kind: "stand",
        goStep: false,
        goCount: 1,
        goDisplacement: { x: F32(0), y: F32(0) },
        directionMode: ownsBall ? 0 : 1,
        resetAnimationFrame: false,
      },
    };
  });
  return { playerIds, players };
}

function projectSourceBusyFirstTimeChipIntercepts(match, nextTick, visits) {
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  const playerIds = [];
  const players = match.players.map((player) => {
    if (!player.active) return player;
    const firstTime = player.liveFirstTimeIntercept;
    if (
      firstTime === undefined
      || firstTime.phase === "cancelled-already-there"
    ) return player;
    const visit = visitById.get(player.id);
    if (visit === undefined) {
      throw new Error(`First-time chip continuation lost ${player.id}'s source visit.`);
    }
    playerIds.push(player.id);
    if (firstTime.phase === "strike" || firstTime.phase === "released") {
      return player;
    }
    const trajectoryChanged = (
      (firstTime.ballState < 0 && visit.possession.owner === 0)
      || (
        firstTime.ballState > 0
        && firstTime.ballState !== visit.possession.lastTouch
      )
    );
    if (trajectoryChanged) {
      return cancelSourceFirstTimeChipIntercept(player, visit, match, nextTick);
    }
    if (firstTime.phase === "wait") {
      const remaining = firstTime.waitTicks - 1;
      if (remaining > 0) {
        return {
          ...clone(player),
          previousPosition: clone(player.position),
          previousFacing: clone(player.facing),
          position: {
            ...updateSourcePosition2d({
              position: { x: player.position.x, y: player.position.y },
              displacement: player.liveMotion.goDisplacement,
            }),
            z: player.position.z,
          },
          velocity: { ...clone(player.liveMotion.goDisplacement), z: F32(0) },
          intelligence: {
            ...clone(player.intelligence),
            count: player.intelligence.count - 1,
          },
          liveFirstTimeIntercept: { ...clone(firstTime), waitTicks: remaining },
        };
      }
      return beginSourceFirstTimeChipStrike({
        ...clone(player),
        liveFirstTimeIntercept: {
          ...clone(firstTime),
          waitTicks: 0,
        },
      }, match, nextTick, visit);
    }
    if (firstTime.phase === "must-face") {
      if (
        !["header", "shot"].includes(firstTime.kind)
        || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
        || player.liveMotion?.goCount <= 0
      ) {
        throw new Error(`First-time strike for ${player.id} lost its must-face journey.`);
      }
      const goCount = player.liveMotion.goCount - 1;
      if (goCount <= 0) {
        return beginSourceFirstTimeChipStrike(player, match, nextTick, visit);
      }
      const facing = turnSourceFacing({
        facing: player.facing,
        target: firstTime.mustFace,
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate: player.liveMotion.teamRate },
        ).maxTurnRadians,
      }).facing;
      return {
        ...clone(player),
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        velocity: { x: F32(0), y: F32(0), z: F32(0) },
        facing,
        intelligence: {
          ...clone(player.intelligence),
          count: player.intelligence.count - 1,
        },
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          facingX: facing.x,
          facingY: facing.y,
        }),
        liveMotion: {
          ...clone(player.liveMotion),
          kind: "first-time-must-face",
          goCount,
          directionMode: 6,
          resetAnimationFrame: false,
        },
      };
    }
    if (
      firstTime.phase !== "run"
      || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      || player.liveMotion?.goCount <= 0
    ) {
      throw new Error(`First-time strike for ${player.id} lost its source RUN journey.`);
    }
    const teamRate = rates.get(player.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`First-time strike lost the current rate for ${player.id}.`);
    }
    let continued;
    if (player.liveMotion.goStop === true) {
      const maxTurnRadians = projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate },
      ).maxTurnRadians;
      const startsMoving = sourceAngleCosine({
        target: player.liveMotion.goDisplacement,
        facing: player.facing,
      }) >= Math.cos(maxTurnRadians);
      const displacement = startsMoving
        ? clone(player.liveMotion.goDisplacement)
        : { x: F32(0), y: F32(0) };
      const position = {
        ...updateSourcePosition2d({
          position: { x: player.position.x, y: player.position.y },
          displacement,
        }),
        z: player.position.z,
      };
      const facing = turnSourceFacing({
        facing: player.facing,
        target: {
          x: F32(player.liveMotion.target.x - position.x),
          y: F32(player.liveMotion.target.y - position.y),
        },
        maxTurnRadians,
      }).facing;
      const liveMotion = {
        ...clone(player.liveMotion),
        kind: startsMoving ? "run" : "stand",
        goStop: !startsMoving,
        goCount: Math.max(0, player.liveMotion.goCount - 1),
        resetAnimationFrame: startsMoving,
        animationId: startsMoving ? RUN_ANIMATION : STAND_ANIMATION,
        animationFrameStep: startsMoving ? null : STAND_FRAME_STEP,
      };
      // The initialization marker suppressed process_anims only on the visit
      // that installed this route. This continuation must advance the retained
      // stand clip, or reset RUN if go_forward clears go_stop.
      delete liveMotion.sourceAnimationVisitComplete;
      continued = {
        ...clone(player),
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        position,
        velocity: { ...displacement, z: F32(0) },
        facing,
        intelligence: {
          ...clone(player.intelligence),
          count: player.intelligence.count - 1,
        },
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          facingX: facing.x,
          facingY: facing.y,
        }),
        liveMotion,
      };
    } else {
      continued = moveFreeBallInterceptor(player, {
        ballState: player.ballState,
        goCount: Math.max(0, player.liveMotion.goCount - 1),
        intelligenceCount: player.intelligence.count - 1,
        nextTick,
        special: 1,
        target: player.liveMotion.target,
        teamRate,
        userControlIndex: 0,
      });
      // init_run_anim installed tm_fstep when go_to_path created this journey.
      // run_action does not reinitialize the clip on continuation visits, so a
      // later stamina-rate change must not alter the retained animation step.
      continued.liveMotion.animationFrameStep = F32(player.animation.frameStep);
    }
    if (continued.liveMotion.goCount > 0) return continued;
    return completeSourceFirstTimeRunArrival({
      continued,
      entryAnimation: {
        id: player.animation.id,
        frame: F32(player.animation.frame + player.animation.frameStep),
      },
      firstTime,
      match,
      nextTick,
      player,
      visit,
    });
  });
  return { playerIds, players };
}

function completeSourceFirstTimeRunArrival({
  continued,
  entryAnimation,
  firstTime,
  match,
  nextTick,
  player,
  visit,
}) {
  if (["header", "shot"].includes(firstTime.kind)) {
    if (firstTime.mustFaceTicks > 0) {
      const facing = turnSourceFacing({
        // run_action switches dir_mode from movement to must-face before this
        // visit's process_dir, so the terminal run tick turns from the entry
        // facing rather than first turning toward the reached target.
        facing: player.facing,
        target: firstTime.mustFace,
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate: continued.liveMotion.teamRate },
        ).maxTurnRadians,
      }).facing;
      return {
        ...continued,
        facing,
        action: createCssoccerActionState({
          tick: nextTick,
          playerId: player.id,
          actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          facingX: facing.x,
          facingY: facing.y,
        }),
        animation: {
          status: "browser-current-state",
          kind: "stand",
          id: STAND_ANIMATION,
          sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
          frame: F32(0),
          frameStep: STAND_FRAME_STEP,
          pending: null,
          tick: nextTick,
        },
        liveMotion: {
          ...clone(continued.liveMotion),
          kind: "first-time-must-face",
          goCount: firstTime.mustFaceTicks,
          directionMode: 6,
          resetAnimationFrame: true,
          animationId: STAND_ANIMATION,
          animationFrameStep: STAND_FRAME_STEP,
        },
        liveFirstTimeIntercept: {
          ...clone(firstTime),
          phase: "must-face",
          phaseTick: nextTick,
        },
      };
    }
    if (firstTime.waitTicks <= 0) {
      const arrival = projectSourceFirstTimeArrival(
        firstTime,
        match,
        continued.position,
        entryAnimation,
      );
      if (arrival.freeTicks > 0) {
        return materializeSourceFirstTimeWait(
          player,
          continued,
          arrival,
          nextTick,
          firstTime,
        );
      }
      return beginSourceFirstTimeChipStrike({
        ...continued,
        // The terminal go_forward calculates an en-route turn, but
        // init_first_time_act switches dir_mode to 2 before process_dir.
        // Publish the visit-entry facing as the source does.
        facing: clone(player.facing),
      }, match, nextTick, visit);
    }
    return materializeSourceFirstTimeWait(
      player,
      continued,
      projectSourceFirstTimeArrival(
        firstTime,
        match,
        continued.position,
        entryAnimation,
      ),
      nextTick,
      firstTime,
    );
  }
  if (firstTime.waitTicks <= 0) {
    return beginSourceFirstTimeChipStrike(continued, match, nextTick, visit);
  }
  return materializeSourceFirstTimeWait(
    player,
    continued,
    projectSourceFirstTimeArrival(
      firstTime,
      match,
      continued.position,
      entryAnimation,
    ),
    nextTick,
    firstTime,
  );
}

function projectSourceFirstTimeArrival(
  firstTime,
  match,
  playerPosition,
  entryAnimation = null,
) {
  const projector = firstTime.kind === "header"
    ? projectCssoccerFirstTimeStandingHeaderArrival
    : firstTime.kind === "chip"
      ? projectCssoccerFirstTimeChipArrival
      : projectCssoccerFirstTimeShotArrival;
  return projector({
    ballState: match.ball,
    ...(["chip", "shot"].includes(firstTime.kind)
      ? {
          entryAnimationFrame: entryAnimation.frame,
          entryAnimationId: entryAnimation.id,
        }
      : {}),
    face: firstTime.mustFace,
    freeTicks: firstTime.waitTicks,
    playerPosition,
    strikeTime: firstTime.strikeTime,
  });
}

/** ACTIONS.CPP init_wait_act after init_first_time_act's corrected prediction. */
function materializeSourceFirstTimeWait(
  player,
  continued,
  arrival,
  nextTick,
  firstTime = player.liveFirstTimeIntercept,
) {
  const displacementMagnitude = sourceDistance2d(arrival.displacement);
  const sideStepDirection = displacementMagnitude > 0.5
    ? sourceSideStepDirection({
        target: continued.target,
        previousPosition: continued.position,
        previousFacing: player.facing,
      })
    : null;
  const animationId = sideStepDirection === null
    ? STAND_ANIMATION
    : TROT_ANIMATION_BY_DIRECTION[sideStepDirection];
  const speed = actualPlayerSpeed({
    pitchLength: 1280,
    teamRate: continued.liveMotion.teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.intercept,
    intentionCount: arrival.freeTicks + 1,
    sideStep: true,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: 0,
    ballInHands: false,
    keeperNativePlayers: [1, 12],
    userControlIndex: 0,
    burstTimer: 0,
  });
  const frameStep = animationId === STAND_ANIMATION
    ? STAND_FRAME_STEP
    : F32(speed * SIDE_STEP_FRAME_STEP / 2);
  return {
    ...continued,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position: clone(arrival.position),
    velocity: {
      x: F32(arrival.position.x - player.position.x),
      y: F32(arrival.position.y - player.position.y),
      z: F32(0),
    },
    // init_wait_act switches dir_mode to 2 before this visit reaches
    // process_dir. That mode republishes the retained tm_xdis/tm_ydis; the
    // terminal RUN turn calculated en route to the target is not committed.
    facing: clone(player.facing),
    intelligence: {
      special: 1,
      move: 1,
      count: arrival.freeTicks + 1,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CONTROL_WAIT_ACTION,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "first-time-wait",
      id: animationId,
      sourceActionId: CONTROL_WAIT_ACTION,
      frame: F32(0),
      frameStep,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      ...clone(continued.liveMotion),
      kind: "first-time-wait",
      goStep: true,
      goCount: 0,
      goDisplacement: clone(arrival.displacement),
      directionMode: 2,
      resetAnimationFrame: true,
      sideStepDirection,
      animationId,
      animationFrameStep: frameStep,
    },
    liveFirstTimeIntercept: {
      ...clone(firstTime),
      phase: "wait",
      phaseTick: nextTick,
      contactOffset: clone(arrival.contactOffset),
      waitTicks: arrival.freeTicks,
    },
  };
}

function beginSourceFirstTimeChipStrike(player, match, nextTick, visit) {
  const firstTime = player.liveFirstTimeIntercept;
  const arrival = ["chip", "header", "shot"].includes(firstTime.kind)
    ? projectSourceFirstTimeArrival(
        firstTime,
        match,
        player.position,
        {
          id: player.animation.id,
          frame: F32(player.animation.frame + player.animation.frameStep),
        },
      )
    : null;
  if (arrival?.receiveValid === false) {
    // init_first_time_act installs STRIKE_ACT provisionally, then abandons
    // it through init_stand_act when the corrected contact point would need
    // more than two source units per tick or misses vertically.
    return cancelSourceFirstTimeChipIntercept(player, visit, match, nextTick);
  }
  if (arrival?.freeTicks > 0) {
    // init_first_time_act always honors get_closest_pred's corrected
    // tm_ftime, including after a must-face run or an earlier WAIT_ACT has
    // completed. A positive correction re-enters init_wait_act before
    // STRIKE_ACT can be installed.
    return materializeSourceFirstTimeWait(
      player,
      player,
      arrival,
      nextTick,
      firstTime,
    );
  }
  const animationId = arrival?.animationId ?? firstTime.animationId;
  const frameStep = arrival?.frameStep
    ?? F32(firstTime.contact / firstTime.strikeTime);
  const frame = arrival?.frame ?? F32(frameStep + 0.01);
  const goDisplacement = arrival?.displacement
    ?? { x: F32(0), y: F32(0) };
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    intelligence: {
      special: 0,
      move: 13,
      count: Math.trunc(((1 - frame) / frameStep) + 1),
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: FIRST_TIME_STRIKE_ACTION,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: `first-time-${firstTime.kind ?? "chip"}`,
      id: animationId,
      sourceActionId: FIRST_TIME_STRIKE_ACTION,
      frame,
      frameStep,
      pending: "contact",
      tick: nextTick,
    },
    liveMotion: {
      ...clone(player.liveMotion),
      kind: `first-time-${firstTime.kind ?? "chip"}`,
      goCount: 0,
      goDisplacement,
      directionMode: 2,
      resetAnimationFrame: true,
      animationId,
      animationFrameStep: frameStep,
    },
    liveFirstTimeIntercept: {
      ...clone(firstTime),
      phase: "strike",
      phaseTick: nextTick,
      ...(arrival === null ? {} : {
        animationId,
        contactOffset: clone(arrival.contactOffset),
      }),
      frameStep,
    },
  };
}

function cancelSourceFirstTimeChipIntercept(player, visit, match, nextTick) {
  const cancelled = clone(player);
  delete cancelled.liveFirstTimeIntercept;
  delete cancelled.sourceGlobalInterceptorTick;
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(visit.ballPosition.x - player.position.x),
      y: F32(visit.ballPosition.y - player.position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate: player.liveMotion.teamRate },
    ).maxTurnRadians,
  }).facing;
  return {
    ...cancelled,
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
      ...clone(player.liveMotion),
      kind: "stand",
      target: { x: visit.ballPosition.x, y: visit.ballPosition.y },
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: true,
      animationId: STAND_ANIMATION,
      animationFrameStep: STAND_FRAME_STEP,
    },
  };
}

function expireSourceCancelledFirstTimeIntercepts(match) {
  const players = match.players.map((player) => {
    if (
      player.liveFirstTimeIntercept?.phase !== "cancelled-already-there"
      || player.intelligence.count !== 1
    ) return player;
    // INTELL.CPP intelligence consumes the last delayed count before
    // computer_play enters got_ball in the same player visit. Remove only the
    // completed first-time branch so the ordinary possession reducer owns it.
    const expired = clone(player);
    delete expired.liveFirstTimeIntercept;
    return {
      ...expired,
      intelligence: { special: 0, move: 0, count: 0 },
    };
  });
  return { ...match, players };
}

function continueBusyStoppedIntercept(player, match, nextTick) {
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Stopped intercept lost the current rate for ${player.id}.`);
  }
  const targetOffset = {
    x: F32(player.liveMotion.target.x - player.position.x),
    y: F32(player.liveMotion.target.y - player.position.y),
  };
  const maxTurnRadians = projectCssoccerMotionSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  ).maxTurnRadians;
  if (
    sourceAngleCosine({ target: targetOffset, facing: player.facing })
      > Math.cos(maxTurnRadians)
  ) {
    const speed = actualPlayerSpeed({
      pitchLength: 1280,
      teamRate,
      speedIntent: CSSOCCER_SPEED_INTENT.intercept,
      intentionCount: player.intelligence.count - 1,
      sideStep: false,
      nativePlayer: player.nativePlayerNumber,
      ballPossession: 0,
      ballInHands: false,
      keeperNativePlayers: [1, 12],
      userControlIndex: 0,
      burstTimer: 0,
    });
    const travelProfile = projectCssoccerTravelSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    );
    const travel = sourceGetThereTime({
      position: { x: player.position.x, y: player.position.y },
      target: player.liveMotion.target,
      facing: player.facing,
      speed,
      maxTurn2Radians: travelProfile.maxTurn2Radians,
      imThereDistance: travelProfile.imThereDistance,
      canRotateAndRun: true,
      mustFace: null,
    });
    const goDisplacement = {
      x: F32(targetOffset.x / travel.ticks),
      y: F32(targetOffset.y / travel.ticks),
    };
    const position = {
      ...updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement: goDisplacement,
      }),
      z: player.position.z,
    };
    const facing = turnSourceFacing({
      facing: player.facing,
      target: {
        x: F32(player.liveMotion.target.x - position.x),
        y: F32(player.liveMotion.target.y - position.y),
      },
      maxTurnRadians,
    }).facing;
    const moved = moveFreeBallInterceptor(player, {
      ballState: player.ballState,
      goCount: travel.ticks,
      intelligenceCount: player.intelligence.count - 1,
      nextTick,
      special: player.intelligence.special,
      target: player.liveMotion.target,
      teamRate,
      userControlIndex: 0,
    });
    moved.position = position;
    moved.velocity = { ...goDisplacement, z: F32(0) };
    moved.facing = facing;
    moved.action = createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: facing.x,
      facingY: facing.y,
    });
    moved.liveMotion.goCount = travel.ticks;
    moved.liveMotion.goDisplacement = goDisplacement;
    if (
      moved.liveContact?.phase === "barge"
      && (
        player.animation.id !== BARGE_ANIMATION
        || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      )
    ) {
      delete moved.liveContact;
    }
    return moved;
  }
  const facing = turnSourceFacing({
    facing: player.facing,
    target: targetOffset,
    maxTurnRadians,
  }).facing;
  const continued = clone(player);
  // process_anims clears tm_barge whenever the shoved player is no longer
  // actually playing MC_BARGE as RUN_ACT.
  if (
    continued.liveContact?.phase === "barge"
    && (
      player.animation.id !== BARGE_ANIMATION
      || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
    )
  ) {
    delete continued.liveContact;
  }
  return {
    ...continued,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    velocity: { x: F32(0), y: F32(0), z: F32(0) },
    facing,
    intelligence: {
      ...clone(player.intelligence),
      count: player.intelligence.count - 1,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.STOP,
      facingX: facing.x,
      facingY: facing.y,
    }),
    liveMotion: {
      ...clone(player.liveMotion),
      resetAnimationFrame: false,
    },
  };
}

function projectSourceControlIntercepts(match, nextTick, { visits = null } = {}) {
  const visitByPlayerId = visits === null
    ? null
    : new Map(visits.map((visit) => [visit.playerId, visit]));
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  const playerIds = [];
  const players = match.players.map((player) => {
    const control = player.liveControlIntercept;
    if (
      control === undefined
      || control.phase === "run"
      || control.phase === "tween"
    ) return player;
    playerIds.push(player.id);
    if (control.phase === "wait") {
      const trajectoryChanged = (
        (player.ballState < 0 && match.possession.owner === 0)
        || (
          player.ballState > 0
          && player.ballState !== match.possession.lastTouch
        )
      );
      if (trajectoryChanged) {
        const cancelled = settleCompletedFreeBallIntercept({
          ballPosition: match.ball.ball.position,
          continued: clone(player),
          match,
          nextTick,
          player,
        });
        delete cancelled.liveControlIntercept;
        return cancelled;
      }
      const remaining = control.freeTicks - 1;
      if (remaining > 0) {
        const position = {
          ...updateSourcePosition2d({
            position: { x: player.position.x, y: player.position.y },
            displacement: control.displacement,
          }),
          z: player.position.z,
        };
        return {
          ...clone(player),
          previousPosition: clone(player.position),
          previousFacing: clone(player.facing),
          position,
          velocity: { ...clone(control.displacement), z: F32(0) },
          intelligence: {
            ...clone(player.intelligence),
            count: Math.max(0, player.intelligence.count - 1),
          },
          liveControlIntercept: {
            ...clone(control),
            freeTicks: remaining,
          },
        };
      }
      const transition = projectCssoccerControlWaitTransition({
        actionIndex: control.actionIndex,
        ballState: match.ball,
        face: control.face,
        freeTicks: 0,
        playerPosition: player.position,
        strikeTime: control.strikeTime,
      });
      if (transition.freeTicks > 0) {
        return materializeFreeBallControlWait(
          player,
          player,
          transition,
          nextTick,
        );
      }
      return beginFreeBallControlReceive(
        player,
        player,
        transition,
        match,
        nextTick,
      );
    }
    if (control.phase !== "control") {
      throw new Error(`Unsupported live control phase for ${player.id}.`);
    }
    const teamRate = rates.get(player.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Control intercept lost current team rate for ${player.id}.`);
    }
    const freeTime = Number.isFinite(control.freeTime)
      ? control.freeTime
      : control.freeTicks;
    const sourceVisit = visitByPlayerId?.get(player.id);
    const sourcePossessionOwner = sourceVisit?.possession.owner
      ?? match.possession.owner;
    // go_team calls process_anims before intelligence/do_action for each
    // player. The browser publishes animation advancement later as one
    // immutable phase, so test CONTROL_ACT against the frame that the source
      // action has already seen on this visit.
    const sourceVisitAnimationFrame = F32(
      player.animation.frame + player.animation.frameStep,
    );
    if (
      sourceVisitAnimationFrame >= control.contact
      && sourcePossessionOwner !== player.nativePlayerNumber
      && freeTime >= 0
    ) {
      // ACTIONS.CPP control_action abandons CONTROL_ACT as soon as contact
      // has passed without possession. Keeping the marker alive lets its
      // animation run beyond frame 1 and accumulates impossible controls
      // across later restarts.
      const preserveSourceBusy = sourcePossessionOwner !== 0
        && player.intelligence.count > 0;
      const cancelled = settleCompletedFreeBallIntercept({
        ballPosition: match.ball.ball.position,
        continued: clone(player),
        match,
        nextTick,
        player,
        preserveBusyIntelligence: preserveSourceBusy,
      });
      if (preserveSourceBusy) {
        cancelled.intelligence = {
          ...clone(player.intelligence),
          count: Math.max(0, player.intelligence.count - 1),
        };
        cancelled.sourceIntelligenceBusyTick = nextTick;
      }
      delete cancelled.liveControlIntercept;
      return cancelled;
    }
    if (control.completionTick === nextTick) {
      const facing = turnSourceFacing({
        facing: player.facing,
        target: {
          x: F32(player.liveMotion.target.x - player.position.x),
          y: F32(player.liveMotion.target.y - player.position.y),
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
        liveMotion: {
          ...clone(player.liveMotion),
          kind: "stand",
          goStep: false,
          goCount: 0,
          goDisplacement: { x: F32(0), y: F32(0) },
          directionMode: 0,
          resetAnimationFrame: true,
          sideStepDirection: null,
          animationId: null,
          animationFrameStep: null,
        },
        liveControlIntercept: {
          ...clone(control),
          phase: "tween",
          phaseTick: nextTick,
          freeTime: -3,
        },
      };
    }
    const position = {
      x: F32(player.position.x + control.displacement.x),
      y: F32(player.position.y + control.displacement.y),
      z: player.position.z,
    };
    const resumed = control.resumeTick === nextTick;
    const heldDuringVisit = sourceVisit?.interaction === "hold"
      && sourcePossessionOwner === player.nativePlayerNumber;
    const count = resumed || player.animation.frame < control.contact
      ? Math.max(0, player.intelligence.count - 1)
      : player.intelligence.count;
    const facing = resumed || heldDuringVisit
      ? turnSourceFacing({
          facing: player.facing,
          target: {
            x: F32(player.liveMotion.target.x - position.x),
            y: F32(player.liveMotion.target.y - position.y),
          },
          maxTurnRadians: projectCssoccerMotionSourceProfile(
            CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
            { teamRate },
          ).maxTurnRadians,
        }).facing
      : clone(player.facing);
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: { ...clone(control.displacement), z: F32(0) },
      facing,
      intelligence: {
        ...clone(player.intelligence),
        count,
      },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CONTROL_RECEIVE_ACTION,
        facingX: facing.x,
        facingY: facing.y,
      }),
      liveMotion: {
        ...clone(player.liveMotion),
        // hold_ball restores dir_mode=0 before CONTROL_ACT moves, so the
        // same visit's process_dir turns from the post-action position.
        directionMode: resumed || heldDuringVisit
          ? 0
          : player.liveMotion.directionMode,
      },
    };
  });
  return { playerIds, players };
}

/** ACTIONS.CPP init_control_act's no-free-time CONTROL_ACT branch. */
function beginFreeBallControlReceive(
  player,
  continued,
  transition,
  match,
  nextTick,
) {
  const control = player.liveControlIntercept;
  if (transition.receiveValid !== true) {
    const cancelled = settleCompletedFreeBallIntercept({
      ballPosition: match.ball.ball.position,
      continued: {
        ...continued,
        position: clone(transition.position),
      },
      match,
      nextTick,
      player,
    });
    delete cancelled.liveControlIntercept;
    return cancelled;
  }
  const frameStep = F32(transition.contact / transition.receiveTicks);
  const initialFrame = F32(frameStep + 0.01);
  const intelligenceCount = sourceWatcomFistpI32(
    ((1 - initialFrame) / frameStep) + 1,
  ) - 1;
  return {
    ...continued,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position: clone(transition.position),
    velocity: {
      x: F32(transition.position.x - player.position.x),
      y: F32(transition.position.y - player.position.y),
      z: F32(0),
    },
    // init_control_act switches dir_mode to 2 before process_dir, so the
    // final RUN visit cannot commit its en-route turn.
    facing: clone(player.facing),
    intelligence: {
      special: 0,
      move: CONTROL_RECEIVE_INTELLIGENCE,
      count: intelligenceCount,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CONTROL_RECEIVE_ACTION,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    liveMotion: {
      ...clone(continued.liveMotion),
      kind: "control",
      goStep: true,
      goCount: 0,
      goDisplacement: clone(transition.displacement),
      directionMode: 2,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: transition.animationId,
      animationFrameStep: frameStep,
    },
    liveControlIntercept: {
      ...clone(control),
      phase: "control",
      phaseTick: nextTick,
      animationId: transition.animationId,
      contact: transition.contact,
      freeTicks: 0,
      displacement: clone(transition.displacement),
      frameStep,
    },
  };
}

function sourceSupportRequestFacing(player) {
  const offset = player.liveMotion?.wantPassOffset;
  if (!Number.isFinite(offset?.x) || !Number.isFinite(offset?.y)) {
    throw new Error(
      `Busy support run lost source go_xoff/go_yoff for ${player.id}.`,
    );
  }
  const distance = sourceDistance2d(offset);
  return (
    ((offset.x * player.facing.x) + (offset.y * player.facing.y)) / distance
  ) > NATIVE_FACING_ANGLE;
}

function projectSourceBusySupportRuns(
  match,
  nextTick,
  sourceAiBall,
  {
    controlledPlayerId = match.control.activePlayerId,
    resetPlayerId = null,
    supportRunPlayerId = null,
    visits = [],
  } = {},
) {
  const playerIds = [];
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  const players = match.players.map((player) => {
    const activeSupportRequest = player.intelligence.move
      === RUN_ON_INTELLIGENCE_MOVE
      && player.intelligence.count > 0
      && player.liveMotion?.kind === "support-run";
    const requestFacing = activeSupportRequest
      ? sourceSupportRequestFacing(player)
      : false;
    const facingReset = activeSupportRequest
      && player.liveMotion.wantPassFaced
      && !requestFacing;
    const resetBeforeVisit = player.id === resetPlayerId || facingReset;
    const residualResetSupportRun = player.intelligence.move === 0
      && player.intelligence.count === 0
      && player.liveMotion?.kind === "support-run"
      && player.liveMotion.goCount > 1
      // A thinking we_have_ball visit may select this same player for the
      // next source-global request. make_run replaces the stale journey
      // before do_action, so the new route owns this visit.
      && player.id !== supportRunPlayerId;
    if (
      resetBeforeVisit
      && (
        match.possession.owner === player.nativePlayerNumber
        || player.id === supportRunPlayerId
      )
    ) {
      // process_comments has already cleared I_RUN_ON. When that requester
      // now owns the ball, got_ball replaces the stale support route; when
      // the same visit installs a new request, we_have_ball replaces it.
      // Neither path executes an old support-run step first.
      return player;
    }
    if (
      player.id === controlledPlayerId
      ||
      (
        !resetBeforeVisit
        && !residualResetSupportRun
        && (
          player.intelligence.move !== RUN_ON_INTELLIGENCE_MOVE
          || player.intelligence.count <= 1
        )
      )
      || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      || player.liveMotion === undefined
      || player.liveContact !== undefined
      || player.livePass !== undefined
      || player.liveShot !== undefined
    ) return player;
    const teamRate = rates.get(player.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Busy support run lost current rate for ${player.id}.`);
    }
    const offset = {
      x: F32(player.liveMotion.target.x - player.position.x),
      y: F32(player.liveMotion.target.y - player.position.y),
    };
    const speed = actualPlayerSpeed({
      pitchLength: 1280,
      teamRate,
      speedIntent: CSSOCCER_SPEED_INTENT.normal,
      intentionCount: player.intelligence.count,
      sideStep: player.liveMotion.goStep,
      nativePlayer: player.nativePlayerNumber,
      ballPossession: match.possession.owner,
      ballInHands: match.possession.inHands !== 0,
      keeperNativePlayers: [1, 12],
      userControlIndex: 0,
      burstTimer: 0,
    });
    const goDisplacement = player.liveMotion.goStep
      ? clone(player.liveMotion.goDisplacement)
      : sourceForwardDisplacement({
          facing: player.facing,
          targetOffset: offset,
          speed,
        }).displacement;
    const position = {
      ...updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement: goDisplacement,
      }),
      z: player.position.z,
    };
    const maxTurnRadians = projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians;
    const runFacing = turnSourceFacing({
      facing: player.facing,
      target: {
        x: F32(player.liveMotion.target.x - position.x),
        y: F32(player.liveMotion.target.y - position.y),
      },
      maxTurnRadians,
    }).facing;
    const arrived = player.liveMotion.goCount === 1;
    const visibleBallPosition = visitById.get(player.id)?.ballPosition
      ?? sourceAiBall.position;
    const facing = arrived
      ? turnSourceFacing({
          facing: player.facing,
          target: {
            x: F32(visibleBallPosition.x - position.x),
            y: F32(visibleBallPosition.y - position.y),
          },
          maxTurnRadians,
        }).facing
      : runFacing;
    playerIds.push(player.id);
    const intelligence = arrived || resetBeforeVisit || residualResetSupportRun
      ? { special: 0, move: 0, count: 0 }
      : {
          ...clone(player.intelligence),
          count: player.intelligence.count - 1,
        };
    const liveMotion = projectCssoccerWantPassMotion({
      sourcePlayer: player,
      intelligence,
      liveMotion: {
        ...clone(player.liveMotion),
        kind: arrived ? "stand" : player.liveMotion.kind,
        goCount: Math.max(0, player.liveMotion.goCount - 1),
        goDisplacement: arrived
          ? { x: F32(0), y: F32(0) }
          : goDisplacement,
        directionMode: arrived ? 1 : player.liveMotion.directionMode,
        resetAnimationFrame: arrived,
        animationFrameStep: (
          resetBeforeVisit
          || match.possession.owner === player.nativePlayerNumber
        )
          ? player.animation.frameStep
          : player.liveMotion.animationFrameStep,
        wantPassFaced: player.liveMotion.wantPassFaced || requestFacing,
      },
    });
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: arrived
        ? { x: F32(0), y: F32(0), z: F32(0) }
        : { ...clone(goDisplacement), z: F32(0) },
      facing,
      intelligence,
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: arrived
          ? CSSOCCER_NATIVE_ACTIONS.STAND
          : CSSOCCER_NATIVE_ACTIONS.RUN,
        facingX: facing.x,
        facingY: facing.y,
      }),
      liveMotion,
    };
  });
  return { playerIds, players };
}

function projectSourceBusyFreeBallIntercepts(
  match,
  nextTick,
  skipPlayerIds = [],
  visits = [],
) {
  const skipped = new Set(skipPlayerIds);
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const traversal = nativeContactTraversalOrder(match.tick & 1);
  const hasCurrentReceiverVisit = (player) => match.players.some((passer) => {
    const pass = readSourceReleasedPass(passer);
    return pass !== null
      && pass.targetNativePlayer === player.nativePlayerNumber
      && (
        pass.release.tick < nextTick
        || (
          pass.release.tick === nextTick
          && traversal.indexOf(player.nativePlayerNumber)
            > traversal.indexOf(passer.nativePlayerNumber)
        )
      );
  });
  const playerIds = [];
  const players = match.players.map((player) => {
    if (!player.active) return player;
    const visit = visitById.get(player.id);
    const stoppedIntercept = player.action.action.value
      === CSSOCCER_NATIVE_ACTIONS.STOP
      && ["stand", "stop-intercept"].includes(player.liveMotion?.kind);
    const runningIntercept = player.action.action.value
      === CSSOCCER_NATIVE_ACTIONS.RUN
      && player.liveMotion?.kind === "run";
    if (
      skipped.has(player.id)
      ||
      player.id === match.control.activePlayerId
      // A later collection cannot retroactively cancel this player's earlier
      // free_ball visit. The first/second-team projectors are carried in
      // `skipped`; only a collection by this player replaces its intercept
      // before intelligence runs.
      || visit?.possession.owner === player.nativePlayerNumber
      || player.intelligence.move !== 1
      || player.intelligence.count <= 1
      || player.liveFirstTimeIntercept !== undefined
      || (!runningIntercept && !stoppedIntercept)
      || (
        player.liveContact !== undefined
        && player.liveContact.phase !== "barge"
      )
      || player.livePass !== undefined
      || player.liveShot !== undefined
      || hasCurrentReceiverVisit(player)
    ) return player;
    if (stoppedIntercept) {
      playerIds.push(player.id);
      return continueBusyStoppedIntercept(player, match, nextTick);
    }
    const continued = continueFreeBallIntercept(player, match, nextTick);
    if (continued === null) {
      throw new Error(`Busy free-ball intercept could not continue ${player.id}.`);
    }
    playerIds.push(player.id);
    if (
      player.passReceiverIntercept === true
      && player.liveControlIntercept === undefined
      && player.liveMotion.sourceInterceptRunCountExact !== true
      && player.liveMotion.goCount === 2
    ) {
      // Once the releasing action marker has recovered, this pinned receiver
      // falls through the ordinary busy-interceptor lane. It retains the
      // same one-count browser/source offset and still completes its final
      // go_forward plus init_stand_act in this visit.
      return settleExpiredPassReceiverIntercept(continued, nextTick);
    }
    if (
      continued.liveMotion.kind !== "run"
      || continued.liveMotion.goCount !== 0
    ) return continued;
    if (visit === undefined) {
      throw new Error(`Busy free-ball intercept arrival lost the visit for ${player.id}.`);
    }
    // init_run_act stores get_there_time - 1 in the browser journey. When the
    // retained count reaches zero, native run_action still performs its final
    // go_forward, decrements source go_cnt from one, and enters init_stand_act.
    return settleCompletedFreeBallIntercept({
      ballPosition: visit.ballPosition,
      continued,
      match,
      nextTick,
      player,
    });
  });
  return { playerIds, players };
}

function projectSourceExpiringFreeBallIntercepts(
  match,
  nextTick,
  {
    command = null,
    releases = [],
    skipPlayerIds = [],
    visits = [],
  } = {},
) {
  const visitIndex = new Map(visits.map((visit, index) => [visit.playerId, index]));
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const skipped = new Set(skipPlayerIds);
  const sameTickRelease = releases.find(({ playerId, release }) => (
    release.tick === nextTick && visitIndex.has(playerId)
  ));
  const releasedNearPathByTeam = new Map();
  if (sameTickRelease !== undefined && command !== null) {
    for (const nativeTeamSlot of ["A", "B"]) {
      const receiver = Number.isSafeInteger(sameTickRelease.release.receiverNativePlayer)
        && sameTickRelease.release.receiverNativePlayer > 0
        && (sameTickRelease.release.receiverNativePlayer < 12 ? "A" : "B")
          === nativeTeamSlot
        ? match.players.find(({ nativePlayerNumber }) => (
            nativePlayerNumber === sameTickRelease.release.receiverNativePlayer
          )) ?? null
        : null;
      releasedNearPathByTeam.set(
        nativeTeamSlot,
        receiver ?? selectFreeBallNearPathPlayer(
          match,
          nativeTeamSlot,
          command,
          match.ball,
        ),
      );
    }
  }
  const playerIds = [];
  const replannedPlayerIds = [];
  const players = match.players.map((player) => {
    if (!player.active) return player;
    const visit = visitById.get(player.id);
    if (
      visit === undefined
      || skipped.has(player.id)
      || player.id === match.control.activePlayerId
      || player.intelligence.move !== 1
      || player.intelligence.count !== 1
      || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      || player.liveMotion?.kind !== "run"
      || (
        visit.interaction === "collect"
        && visit.possession.owner === player.nativePlayerNumber
      )
      || (
        player.liveContact !== undefined
        && player.liveContact.phase !== "barge"
      )
      || player.livePass !== undefined
      || player.liveShot !== undefined
    ) return player;
    if (
      sameTickRelease !== undefined
      && visitIndex.get(sameTickRelease.playerId) < visitIndex.get(player.id)
      && releasedNearPathByTeam.get(player.nativeTeamSlot)?.id === player.id
    ) {
      const plan = createFreeBallInterceptPlan(player, match, nextTick, {
        afterTouchInput: {
          x: F32(command.moveX / 127),
          y: F32(command.moveY / 127),
        },
        automaticMoveSelection: player.nativeTeamSlot !== match.control.nativeTeamSlot
          || player.role === "keeper",
        ballState: match.ball,
        controlled: false,
        incrementRunCountBeforeAction: true,
        userControlIndex: 0,
        userControlled: false,
      });
      if (plan.player !== null) {
        replannedPlayerIds.push(player.id);
        return plan.player;
      }
    }
    const finalInterceptStep = continueFreeBallIntercept(
      player,
      { ...match, possession: visit.possession },
      nextTick,
      { ballPosition: visit.ballPosition },
    );
    if (finalInterceptStep === null) {
      throw new Error(`Expiring free-ball intercept could not continue ${player.id}.`);
    }
    playerIds.push(player.id);
    return {
      ...finalInterceptStep,
      // free_ball consumes the final old go_forward before reset_ideas;
      // find_zonal_target then installs and executes the replacement journey.
      // process_dir turns once, toward that replacement target.
      facing: clone(player.facing),
      // The terminal run_action does not call init_stand_act on this path:
      // with int_cnt already reset it falls directly into find_zonal_target.
      // Keep the entry clip so init_run_anim can apply its source rule that
      // an active MC_BARGE/tm_barge pair is not replaced by MC_RUN.
      animation: clone(player.animation),
      intelligence: { special: 0, move: 0, count: 0 },
      liveMotion: {
        ...finalInterceptStep.liveMotion,
        // reset_ideas clamps an expiring I_INTERCEPT journey to one final
        // run_action step. That step has now been consumed, regardless of
        // the longer go_cnt carried by the old interception route.
        goCount: 0,
      },
    };
  });
  return { playerIds, replannedPlayerIds, players };
}

function projectSourceExpiringOffsideRunbacks(match, nextTick, visits) {
  const visitIndex = new Map(visits.map((visit, index) => [visit.playerId, index]));
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  const playerIds = [];
  const players = match.players.map((player) => {
    if (!player.active) return player;
    const currentVisitIndex = visitIndex.get(player.id) ?? -1;
    const visit = visits[currentVisitIndex];
    const opposingPossessionAtVisit = visit?.possession.owner !== 0
      && (visit.possession.owner < 12) !== (player.nativePlayerNumber < 12);
    if (
      currentVisitIndex < 0
      // ball_interact can collect later in the traversal. The terminal
      // run_action still belongs to the possession visible in this player's
      // own slot; only an opponent already holding the ball can replace it
      // through opp_has_ball before do_action.
      || opposingPossessionAtVisit
      || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      || player.liveMotion?.kind !== "offside-runback"
      || player.liveMotion.goCount !== 1
    ) {
      return player;
    }
    const teamRate = rates.get(player.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Expiring offside run-back lost current rate for ${player.id}.`);
    }
    const goDisplacement = player.liveMotion.goStep
      ? clone(player.liveMotion.goDisplacement)
      : sourceForwardDisplacement({
          facing: player.facing,
          targetOffset: {
            x: F32(player.liveMotion.target.x - player.position.x),
            y: F32(player.liveMotion.target.y - player.position.y),
          },
          speed: actualPlayerSpeed({
            pitchLength: 1280,
            teamRate,
            speedIntent: CSSOCCER_SPEED_INTENT.normal,
            intentionCount: 0,
            sideStep: false,
            nativePlayer: player.nativePlayerNumber,
            ballPossession: visit.possession.owner,
            ballInHands: visit.possession.inHands !== 0,
            keeperNativePlayers: [1, 12],
            userControlIndex: 0,
            burstTimer: 0,
          }),
        }).displacement;
    const position = {
      ...updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement: goDisplacement,
      }),
      z: player.position.z,
    };
    playerIds.push(player.id);
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      position,
      velocity: { ...clone(goDisplacement), z: F32(0) },
      liveMotion: {
        ...clone(player.liveMotion),
        teamRate,
        goCount: 0,
        goDisplacement,
      },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
        facingX: player.facing.x,
        facingY: player.facing.y,
      }),
    };
  });
  return { playerIds, players };
}

function projectSourceBusyDisplacedDribbleRuns(
  match,
  nextTick,
  sourcePossession,
  visits,
) {
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const collectorVisitIndex = visits.findIndex((visit) => (
    visit.interaction === "collect"
    && visit.nativePlayerNumber === match.possession.owner
  ));
  const sourceOwnerVisitIndex = visits.findIndex(({ nativePlayerNumber }) => (
    nativePlayerNumber === sourcePossession.owner
  ));
  const displacedBeforeOwnVisit = sourcePossession.owner !== 0
    && match.possession.owner !== 0
    && match.possession.owner !== sourcePossession.owner
    && collectorVisitIndex >= 0
    && sourceOwnerVisitIndex > collectorVisitIndex;
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  const playerIds = [];
  const players = match.players.map((player) => {
    if (!player.active) return player;
    const resetBeforeVisit = displacedBeforeOwnVisit
      && player.nativePlayerNumber === sourcePossession.owner
      && player.liveMotion?.kind === "run-with-ball";
    const continuing = player.liveMotion?.kind === "displaced-dribble";
    if (
      (!resetBeforeVisit && !continuing)
      || player.nativePlayerNumber === match.possession.owner
      || (
        !continuing
        && (
          player.intelligence.move !== DRIBBLE_INTELLIGENCE_MOVE
          || player.intelligence.count <= 1
        )
      )
      || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      || player.liveMotion.goCount <= 0
    ) return player;
    const visit = visitById.get(player.id);
    if (visit === undefined || visit.possession.owner === player.nativePlayerNumber) {
      return player;
    }
    const teamRate = rates.get(player.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Displaced dribble lost the current rate for ${player.id}.`);
    }
    const displacement = sourceForwardDisplacement({
      facing: player.facing,
      targetOffset: {
        x: F32(player.liveMotion.target.x - player.position.x),
        y: F32(player.liveMotion.target.y - player.position.y),
      },
      speed: actualPlayerSpeed({
        pitchLength: 1280,
        teamRate,
        speedIntent: CSSOCCER_SPEED_INTENT.normal,
        intentionCount: player.intelligence.count,
        sideStep: player.liveMotion.goStep,
        nativePlayer: player.nativePlayerNumber,
        ballPossession: visit.possession.owner,
        ballInHands: visit.possession.inHands !== 0,
        keeperNativePlayers: [1, 12],
        userControlIndex: 0,
        burstTimer: 0,
      }),
    }).displacement;
    const position = {
      ...updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement,
      }),
      z: player.position.z,
    };
    const facing = turnSourceFacing({
      facing: player.facing,
      target: {
        x: F32(player.liveMotion.target.x - position.x),
        y: F32(player.liveMotion.target.y - position.y),
      },
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate },
      ).maxTurnRadians,
    }).facing;
    playerIds.push(player.id);
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: { ...clone(displacement), z: F32(0) },
      facing,
      // holder_lose_ball reset the source idea before this visit. run_action
      // still consumes the installed journey unless opp_has_ball replaces it;
      // the later pressure projector may overwrite this fallback route.
      intelligence: resetBeforeVisit
        ? { special: 0, move: 0, count: 0 }
        : player.intelligence.move === DRIBBLE_INTELLIGENCE_MOVE
          ? {
            ...clone(player.intelligence),
            count: player.intelligence.count - 1,
          }
          : clone(player.intelligence),
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
        facingX: facing.x,
        facingY: facing.y,
      }),
      liveMotion: {
        ...clone(player.liveMotion),
        kind: "displaced-dribble",
        teamRate,
        goCount: Math.max(0, player.liveMotion.goCount - 1),
        goDisplacement: clone(displacement),
        animationFrameStep: player.animation.frameStep,
      },
    };
  });
  return { playerIds, players };
}

function projectSourceSecondTeamBusyIntercepts(
  match,
  nextTick,
  sourcePossession = match.possession,
  visits = [],
  skipPlayerIds = [],
  controlledPlayerId = match.control.activePlayerId,
) {
  if (match.possession.inHands !== 0) {
    return { playerIds: [], players: match.players };
  }
  if (sourcePossession.owner === 0 || sourcePossession.inHands !== 0) {
    return { playerIds: [], players: match.players };
  }
  const sourceOwnerTeamSlot = sourcePossession.owner < 12 ? "A" : "B";
  const ownerTeamSlot = match.possession.owner === 0
    ? null
    : match.possession.owner < 12 ? "A" : "B";
  const finalPossessionIsFree = ownerTeamSlot === null;
  const secondTeamSlot = match.tick % 2 === 0 ? "A" : "B";
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const skipped = new Set(skipPlayerIds);
  const playerIds = [];
  const players = match.players.map((player) => {
    if (!player.active) return player;
    const visit = visitById.get(player.id);
    const stoppedIntercept = player.nativeTeamSlot === secondTeamSlot
      && !finalPossessionIsFree
      && player.id !== controlledPlayerId
      && player.nativePlayerNumber !== match.possession.owner
      && player.intelligence.move === 1
      && player.intelligence.count > 1
      && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STOP
      && player.liveMotion?.kind === "stop-intercept"
      && !(
        visitById.get(player.id)?.interaction === "collect"
        && visitById.get(player.id)?.possession.owner === player.nativePlayerNumber
      );
    if (stoppedIntercept) {
      playerIds.push(player.id);
      return continueBusyStoppedIntercept(player, match, nextTick);
    }
    const scheduledIntercept = Number.isSafeInteger(
      player.liveMotion?.scheduledInterceptOwner,
    );
    const globalIntercept = Number.isSafeInteger(
      player.sourceGlobalInterceptorTick,
    );
    const sourceOpponent = player.nativeTeamSlot !== sourceOwnerTeamSlot;
    const possessionCrossedTeams = ownerTeamSlot !== null
      && ownerTeamSlot !== sourceOwnerTeamSlot;
    const visitOpponent = visit?.possession.owner !== 0
      && (
        (visit.possession.owner < 12 ? "A" : "B")
        !== player.nativeTeamSlot
      );
    const continueBusy = player.intelligence.count > 1 && (
      (
        !finalPossessionIsFree
        && (
          (possessionCrossedTeams && sourceOpponent)
          || (scheduledIntercept && player.nativeTeamSlot === secondTeamSlot)
          // A later same-team collection must not rewrite the owner that this
          // earlier second-team visit saw while its existing I_INTERCEPT ran.
          || (visitOpponent && player.nativeTeamSlot === secondTeamSlot)
        )
      )
      // A pass receiver owns this team's source-global interceptor slot.
      // intelligence remains busy even when a later same-team player has
      // collected or released the ball before the following process_teams pass.
      || (globalIntercept && player.nativeTeamSlot === secondTeamSlot)
    );
    const finishExpiring = player.intelligence.count === 1
      && !finalPossessionIsFree
      && (
        sourceOpponent
        || (scheduledIntercept && player.nativeTeamSlot === secondTeamSlot)
      );
    if (
      skipped.has(player.id)
      ||
      player.id === controlledPlayerId
      || player.nativePlayerNumber === match.possession.owner
      || player.liveFirstTimeIntercept !== undefined
      || player.intelligence.move !== 1
      || player.intelligence.count <= 0
      || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      || player.liveMotion?.kind !== "run"
      || (!continueBusy && !finishExpiring)
    ) {
      return player;
    }
    const busyArrival = player.liveMotion.goCount === 1
      && player.intelligence.count > 1;
    const terminalVisit = busyArrival ? visit : null;
    if (busyArrival && terminalVisit === undefined) {
      throw new Error(`Second-team busy intercept lost the visit for ${player.id}.`);
    }
    const continued = continueFreeBallIntercept(player, match, nextTick, {
      terminalStandBallPosition: terminalVisit?.ballPosition ?? null,
    });
    if (continued === null) {
      throw new Error(`Second-team busy intercept could not continue ${player.id}.`);
    }
    if (player.intelligence.count > 1) {
      playerIds.push(player.id);
      const scheduledInterceptOwner = visitOpponent
        ? visit.possession.owner
        : possessionCrossedTeams && sourceOpponent
          ? sourcePossession.owner
          : player.liveMotion.scheduledInterceptOwner;
      return Number.isSafeInteger(scheduledInterceptOwner)
        ? {
            ...continued,
            liveMotion: {
              ...continued.liveMotion,
              scheduledInterceptOwner,
            },
          }
        : continued;
    }
    return {
      ...continued,
      // reset_ideas shortens the old run to one final go_forward visit.
      // Native process_dir runs only after find_zonal_target installs the
      // replacement journey, so this pre-step must not turn twice.
      facing: clone(player.facing),
      // As on the first-team path, the replacement is installed without a
      // transient stand animation. Preserve the entry clip for init_run_anim.
      animation: clone(player.animation),
      intelligence: { special: 0, move: 0, count: 0 },
    };
  });
  return { playerIds, players };
}

function continueCurrentCentreOpponentRuns({ match, nextTick, sourceMatch }) {
  if (sourceMatch.possession.owner === 0 || sourceMatch.possession.inHands !== 0) {
    return match;
  }
  const ownerTeamSlot = sourceMatch.possession.owner < 12 ? "A" : "B";
  const rates = new Map(currentTeamRates(
    sourceMatch.players,
    sourceMatch.clock.gameMinute,
  ).map(({ id, value }) => [id, value]));
  let players = match.players;
  for (const sourcePlayer of sourceMatch.players) {
    if (
      sourcePlayer.nativeTeamSlot === ownerTeamSlot
      || sourcePlayer.id === sourceMatch.control.activePlayerId
      || sourcePlayer.intelligence.move !== 1
      || sourcePlayer.intelligence.count <= 1
      || sourcePlayer.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      || sourcePlayer.liveMotion?.kind !== "run"
    ) continue;
    const teamRate = rates.get(sourcePlayer.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Current centre lost the rate for ${sourcePlayer.id}.`);
    }
    const continued = continueFreeBallIntercept({
      ...sourcePlayer,
      liveMotion: {
        ...sourcePlayer.liveMotion,
        teamRate,
      },
    }, sourceMatch, nextTick);
    if (continued === null) {
      throw new Error(`Current centre could not continue ${sourcePlayer.id}.`);
    }
    continued.liveMotion.animationFrameStep = sourcePlayer.animation.frameStep;
    players = players.map((player) => player.id === continued.id ? continued : player);
  }
  return { ...match, players };
}

function initializeCurrentCentreOpponentRoutes({
  events,
  match,
  nextTick,
  postTakerBallPosition,
  sourceMatch,
}) {
  if (sourceMatch.possession.owner === 0 || sourceMatch.possession.inHands !== 0) {
    return match;
  }
  const owner = sourceMatch.players.find(({ nativePlayerNumber }) => (
    nativePlayerNumber === sourceMatch.possession.owner
  ));
  if (owner === undefined) {
    throw new Error("Current centre pressure lost the source ball owner.");
  }
  const preTakerBallPosition = sourceMatch.ball.ball.position;
  const sourceOpponents = sourceMatch.players
    .filter((player) => (
      player.active
      && player.nativeTeamSlot !== owner.nativeTeamSlot
    ));
  const distanceById = new Map(sourceOpponents.map((player) => [
    player.id,
    sourceDistance2d({
      x: F32(player.position.x - preTakerBallPosition.x),
      y: F32(player.position.y - preTakerBallPosition.y),
    }),
  ]));
  const rankById = new Map(sourceOpponents
    .slice()
    .sort((left, right) => (
      distanceById.get(left.id) - distanceById.get(right.id)
      || left.nativePlayerNumber - right.nativePlayerNumber
    ))
    .map((player, index) => [player.id, index + 1]));
  const rates = new Map(currentTeamRates(
    sourceMatch.players,
    sourceMatch.clock.gameMinute,
  ).map(({ id, value }) => [id, value]));
  const taker = sourceMatch.players.find(({ id }) => (
    id === sourceMatch.kickoff.owner.takerId
  ));
  if (taker === undefined) {
    throw new Error("Current centre pressure lost the source taker.");
  }
  let pressured = match;
  for (const nativePlayerNumber of nativeContactTraversalOrder(sourceMatch.tick & 1)) {
    const sourcePlayer = sourceOpponents.find((player) => (
      player.nativePlayerNumber === nativePlayerNumber
    ));
    if (
      sourcePlayer === undefined
      || sourcePlayer.id === sourceMatch.control.activePlayerId
      || sourcePlayer.role === "keeper"
      || sourcePlayer.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN
      || sourcePlayer.intelligence.count !== 0
      || sourcePlayer.liveContact !== undefined
      || sourcePlayer.livePass !== undefined
      || sourcePlayer.liveShot !== undefined
      || rankById.get(sourcePlayer.id) > 2
    ) continue;
    const distance = distanceById.get(sourcePlayer.id);
    if (
      distance === undefined
      || distance >= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 13
    ) continue;
    const challengeBallPosition = sourceBallForCurrentCentrePlayer({
      nativePlayerNumber,
      postTaker: postTakerBallPosition,
      preTaker: preTakerBallPosition,
      sourceTick: sourceMatch.tick,
      takerNativePlayerNumber: taker.nativePlayerNumber,
    });
    const holderFacing = sourceOpponentHolderFacing(sourcePlayer, owner, challengeBallPosition);
    if (holderFacing !== -1) {
      continue;
    }
    const takesSideRoute = sourceMatch.ball.ball.speed < 1 && (
      (sourceMatch.rng.state.seed & 4) !== 0
      || (nativePlayerNumber > 11 && challengeBallPosition.x < 640)
      || (nativePlayerNumber < 12 && challengeBallPosition.x > 640)
    );
    const teamRate = rates.get(sourcePlayer.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Current centre pressure lost the rate for ${sourcePlayer.id}.`);
    }
    const routed = takesSideRoute
      ? initializeOpenPlaySidePlayer({
        ballPosition: challengeBallPosition,
        distance,
        nextTick,
        owner,
        player: sourcePlayer,
        teamRate,
      })
      : initializeOpenPlayBetweenPlayer({
        ball: CENTRE_PASS_PREDICTION_BALL,
        ballPosition: challengeBallPosition,
        nextTick,
        player: sourcePlayer,
        teamRate,
      });
    pressured = {
      ...pressured,
      players: pressured.players.map((player) => (
        player.id === routed.id ? routed : player
      )),
    };
    events.push({
      type: takesSideRoute ? "ai-side-started" : "ai-between-started",
      tick: nextTick,
      playerId: routed.id,
      opponentId: owner.id,
      distance,
      rank: rankById.get(sourcePlayer.id),
      seed: sourceMatch.rng.state.seed,
      target: clone(routed.liveMotion.target),
    });
  }
  return pressured;
}

function sourceBallForCurrentCentrePlayer({
  nativePlayerNumber,
  postTaker,
  preTaker,
  sourceTick,
  takerNativePlayerNumber,
}) {
  const playerSlot = nativePlayerNumber < 12 ? "A" : "B";
  const takerSlot = takerNativePlayerNumber < 12 ? "A" : "B";
  if (playerSlot === takerSlot) {
    return nativePlayerNumber < takerNativePlayerNumber ? preTaker : postTaker;
  }
  const teamBBeforeTeamA = sourceTick % 2 === 0;
  const playerRunsBeforeTaker = playerSlot === "B"
    ? teamBBeforeTeamA
    : !teamBBeforeTeamA;
  return playerRunsBeforeTaker ? preTaker : postTaker;
}

function initializeOpenPlayAiChallenges(
  match,
  nextTick,
  events,
  sourcePlayers = match.players,
  sourceBall = match.ball.ball,
  sourceState = { ballState: match.ball, possession: match.possession },
) {
  const pressureWindow = sourceState.pressureWindow ?? "final";
  if (!["before-collection", "final"].includes(pressureWindow)) {
    throw new Error(`AI pressure received unsupported window ${pressureWindow}.`);
  }
  const collectorVisit = Array.isArray(sourceState.visits)
    ? sourceState.visits.findIndex((visit) => (
        visit.interaction === "collect"
        && visit.nativePlayerNumber === match.possession.owner
      ))
    : -1;
  const possessionChangedDuringTraversal = sourceState.possession.owner
    !== match.possession.owner
    && collectorVisit >= 0;
  if (
    pressureWindow === "before-collection"
    && !possessionChangedDuringTraversal
  ) return match;
  const pressurePossession = pressureWindow === "before-collection"
    ? sourceState.possession
    : match.possession.owner === 0
      ? sourceState.possession
      : match.possession;
  const pressureOwner = pressurePossession.owner;
  const pressureInHands = pressurePossession.inHands;
  if (pressureOwner === 0 || pressureInHands !== 0) return match;
  const owner = sourcePlayers.find(({ nativePlayerNumber }) => (
    nativePlayerNumber === pressureOwner
  ));
  if (owner === undefined) throw new Error("AI pressure lost the current ball owner.");
  const ballPosition = sourceBall.position;
  const traversal = nativeContactTraversalOrder(match.tick & 1);
  const sourceOwnerVisit = Array.isArray(sourceState.visits)
    ? sourceState.visits.findIndex(
        ({ nativePlayerNumber }) => nativePlayerNumber === sourceState.possession.owner,
      )
    : -1;
  const displacedSourceOwnerFinished = sourceState.possession.owner !== 0
    && sourceState.possession.owner !== match.possession.owner
    && sourceOwnerVisit >= 0
    && collectorVisit >= 0
    && sourceOwnerVisit < collectorVisit;
  const collectionPrediction = sourceState.reselection?.visitIndex === collectorVisit
    ? sourceState.reselection.sourcePrediction
    : null;
  const pressureRanks = sourceState.playerDistanceRanks;
  const pressureDistances = sourceState.playerDistances;
  if (!(pressureRanks instanceof Map) || !(pressureDistances instanceof Map)) {
    throw new Error("AI pressure lost the source player_distances frame.");
  }
  const pressureOwnerPossessionTicks = pressurePossession.players.find(
    ({ nativePlayer }) => nativePlayer === pressureOwner,
  )?.possession;
  if (!Number.isSafeInteger(pressureOwnerPossessionTicks)) {
    throw new Error(`AI pressure lost possession ticks for ${owner.id}.`);
  }
  if (
    pressureWindow === "before-collection"
    && CSSOCCER_DEBUG_ENV.CSSOCCER_DEBUG_TICK === String(nextTick)
  ) {
    console.error("pre-collection-ai-pressure", JSON.stringify({
      pressureOwner,
      collectorVisit,
      candidates: match.players
        .filter((player) => (
          sourceState.visits.findIndex(({ playerId }) => playerId === player.id)
            < collectorVisit
          && player.nativeTeamSlot !== owner.nativeTeamSlot
        ))
        .map((player) => ({
          id: player.id,
          rank: pressureRanks.get(player.id),
          distance: pressureDistances.get(player.id),
          action: player.action.action.value,
          intelligence: player.intelligence,
          holderFacing: sourceOpponentHolderFacing(
            sourcePlayers.find(({ id }) => id === player.id),
            owner,
            sourceState.visits.find(({ playerId }) => playerId === player.id)
              .ballPosition,
          ),
          visit: sourceState.visits.find(({ playerId }) => playerId === player.id),
        })),
      owner: {
        id: owner.id,
        action: owner.action.action.value,
        intelligence: owner.intelligence,
        possessionTicks: pressureOwnerPossessionTicks,
      },
      seed: match.rng.state.seed,
      ballSpeed: sourceBall.speed,
    }));
  }
  const candidates = match.players
    .filter((player) => (
      player.active
      && player.role !== "keeper"
      && player.id !== match.control.activePlayerId
      && (
        player.liveContact === undefined
        || player.liveContact.phase === "barge"
      )
      && player.livePass === undefined
      && player.liveShot === undefined
      && player.sourceIntelligenceBusyTick !== nextTick
      && !(
        player.liveMotion?.kind === "displaced-dribble"
        && player.intelligence.move === DRIBBLE_INTELLIGENCE_MOVE
        && player.intelligence.count > 0
        && pressureOwnerPossessionTicks <= 4
      )
      && player.action.action.value <= CSSOCCER_NATIVE_ACTIONS.RUN
      && (player.nativePlayerNumber < 12) !== (owner.nativePlayerNumber < 12)
      && sourceState.visits.find(({ nativePlayerNumber }) => (
        nativePlayerNumber === player.nativePlayerNumber
      ))?.possession.owner === pressureOwner
      && !(
        displacedSourceOwnerFinished
        && player.nativePlayerNumber === sourceState.possession.owner
      )
      && !(
        possessionChangedDuringTraversal
        && (
          pressureWindow === "before-collection"
            ? sourceState.visits.findIndex(({ nativePlayerNumber }) => (
                nativePlayerNumber === player.nativePlayerNumber
              )) >= collectorVisit
            : sourceState.visits.findIndex(({ nativePlayerNumber }) => (
                nativePlayerNumber === player.nativePlayerNumber
              )) < collectorVisit
        )
      )
    ))
    .map((player) => {
      const sourcePlayer = sourcePlayers.find(({ id }) => id === player.id);
      if (sourcePlayer === undefined) {
        throw new Error(`AI pressure lost the source-order player ${player.id}.`);
      }
      return {
        player,
        sourcePlayer,
        rank: pressureRanks.get(player.id),
        distance: pressureDistances.get(player.id),
      };
    })
    .filter(({ rank, sourcePlayer }) => (
      (
        pressureWindow !== "before-collection"
        || sourcePlayer.intelligence.count === 0
      )
      && (
        // INTELL.CPP requires a non-zero tm_pos before comparing it with
        // close_in_number. Zero means this player is outside the ranked
        // pressure set; it is not "better than rank one."
        (rank > 0 && rank <= 2)
        || (
          sourcePlayer.intelligence.move === 1
          && sourcePlayer.intelligence.count > 1
          && sourcePlayer.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
        )
      )
    ))
    .sort((left, right) => (
      left.distance - right.distance
      || left.player.nativePlayerNumber - right.player.nativePlayerNumber
    ));
  const ranked = candidates;
  if (ranked.length === 0) return match;
  ranked.sort((left, right) => (
    traversal.indexOf(left.player.nativePlayerNumber)
      - traversal.indexOf(right.player.nativePlayerNumber)
  ));
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  let challengedMatch = match;
  for (const nearest of ranked) {
    const sourcePlayerVisit = Array.isArray(sourceState.visits)
      ? sourceState.visits.findIndex(({ nativePlayerNumber }) => (
          nativePlayerNumber === nearest.player.nativePlayerNumber
        ))
      : -1;
    if (sourcePlayerVisit < 0) {
      throw new Error(`AI pressure lost the source visit for ${nearest.player.id}.`);
    }
    const challengeBallPosition = sourceState.visits[sourcePlayerVisit].ballPosition;
    const refreshedPrediction = collectionPrediction !== null
      && sourcePlayerVisit > collectorVisit
      ? collectionPrediction
      : null;
    const teamRate = rates.get(nearest.player.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`AI pressure lost the current rate for ${nearest.player.id}.`);
    }
    if (nearest.sourcePlayer.liveFirstTimeIntercept !== undefined) {
      // The first-time reducer above owns the source RUN_ACT visit, including
      // its ball_state/last_touch cancellation. Do not resurrect that
      // loop-entry run after a same-traversal collection has cancelled it.
      continue;
    }
    if (
      nearest.sourcePlayer.intelligence.move === 1
      && nearest.sourcePlayer.intelligence.count > 1
      && nearest.sourcePlayer.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
    ) {
      const continued = continueFreeBallIntercept(
        nearest.sourcePlayer,
        challengedMatch,
        nextTick,
        {
          ballPosition: challengeBallPosition,
          terminalStandBallPosition: nearest.sourcePlayer.liveMotion.goCount === 1
            ? challengeBallPosition
            : null,
        },
      );
      if (continued === null) {
        throw new Error(`AI pressure could not continue ${nearest.sourcePlayer.id}.`);
      }
      challengedMatch = {
        ...challengedMatch,
        players: challengedMatch.players.map((player) => (
          player.id === continued.id ? continued : player
        )),
      };
      continue;
    }
    if (
      nearest.sourcePlayer.intelligence.move === 1
      && nearest.sourcePlayer.intelligence.count > 1
      && nearest.sourcePlayer.action.action.value === CSSOCCER_NATIVE_ACTIONS.STOP
      && nearest.sourcePlayer.liveMotion?.kind === "stop-intercept"
    ) {
      // The source busy branch has already been published at this player's
      // first/second-team visit. It must not fall through into a fresh
      // opponent challenge during the same tick.
      continue;
    }
    if (
      nearest.sourcePlayer.intelligence.move === CLOSE_DOWN_INTELLIGENCE_MOVE
      && nearest.sourcePlayer.intelligence.count > 1
    ) {
      // intelligence decrements a live I_CLOSE_DOWN countdown and returns
      // busy. The earlier team-journey projection already published that
      // visit; opp_has_ball must not restart the countdown in this pass.
      continue;
    }
    if (
      nearest.sourcePlayer.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
      && nearest.sourcePlayer.intelligence.count > 1
    ) {
      // A live I_RUN_ON decrements int_cnt and returns busy before
      // opp_has_ball. Its terminal journey may settle to STAND_ACT during
      // do_action, but it cannot start a fresh challenge in the same visit.
      continue;
    }
    const inClose = nearest.distance
      < CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 13;
    const holderFacing = sourceOpponentHolderFacing(
      nearest.sourcePlayer,
      owner,
      challengeBallPosition,
    );
    if (
      pressureWindow === "before-collection"
      && CSSOCCER_DEBUG_ENV.CSSOCCER_DEBUG_TICK === String(nextTick)
    ) {
      const debugBetween = initializeOpenPlayBetweenPlayer({
        ball: sourceState.predictionBall,
        ballPosition: challengeBallPosition,
        player: nearest.sourcePlayer,
        teamRate,
        nextTick,
      });
      console.error("pre-collection-ai-route", JSON.stringify({
        playerId: nearest.sourcePlayer.id,
        holderFacing,
        inClose,
        between: {
          position: debugBetween.position,
          facing: debugBetween.facing,
          intelligence: debugBetween.intelligence,
          action: debugBetween.action.action.value,
          animation: debugBetween.animation,
          liveMotion: debugBetween.liveMotion,
        },
      }));
    }
    const ownerCannotShield = (
      (
        owner.action.action.value === TACKLE_ACTION
        && (owner.liveMotion?.goCount ?? 0) > LIVE_PLAYER_CONTACT_PROFILE.effectiveTackle
      )
      || owner.intelligence.move === GET_UP_INTELLIGENCE_MOVE
    );
    if (!inClose && nearest.rank === 1) {
      // opp_has_ball sends the nearest defender through close_him_down.
      // That routine first tries go_to_path against the held-ball prediction;
      // when no intercept exists it retains I_CLOSE_DOWN and merely faces the
      // ball during this visit.
      const intercept = initializeOpenPlayHeldBallIntercept({
        ballOwnerNativePlayer: owner.nativePlayerNumber,
        ballState: sourceState.ballState,
        nextTick,
        ownerTackling: owner.action.action.value === TACKLE_ACTION,
        player: nearest.sourcePlayer,
        teamRate,
      });
      const terminalCloseDown = intercept === null
        && nearest.sourcePlayer.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
        && (nearest.sourcePlayer.liveMotion?.goCount ?? 0) <= 1;
      const challenged = intercept ?? stepCurrentCloseDownPlayer({
        ballPosition: challengeBallPosition,
        count: Math.trunc(nearest.sourcePlayer.gameplay.flair / 4),
        fresh: true,
        nextTick,
        player: nearest.sourcePlayer,
        teamRate,
      });
      const routed = terminalCloseDown
        ? {
            ...challenged,
            target: clone(nearest.sourcePlayer.target),
            intelligence: { special: 0, move: 0, count: 0 },
            liveMotion: {
              ...challenged.liveMotion,
              kind: "stand",
              target: clone(nearest.sourcePlayer.liveMotion.target),
            },
          }
        : challenged;
      // close_him_down can install I_CLOSE_DOWN immediately before a
      // terminal run_action. With no new go_to_path journey, run_action
      // reaches init_stand_act in the same visit and reset_ideas clears only
      // that transient idea; other_interceptor's not-me timer and the
      // resulting stand/process_dir visit remain observable.
      events.push({
        type: intercept === null
          ? "ai-close-down-started"
          : "ai-intercept-started",
        tick: nextTick,
        playerId: routed.id,
        opponentId: owner.id,
        distance: nearest.distance,
        seed: challengedMatch.rng.state.seed,
      });
      challengedMatch = {
        ...challengedMatch,
        players: challengedMatch.players.map((player) => (
          player.id === routed.id ? routed : player
        )),
      };
      continue;
    }
    const sideRoute = sourceBall.speed < 1 && (
      (challengedMatch.rng.state.seed & 4) !== 0
      || (nearest.sourcePlayer.nativePlayerNumber > 11 && challengeBallPosition.x < 640)
      || (nearest.sourcePlayer.nativePlayerNumber < 12 && challengeBallPosition.x > 640)
    );
    if (
      nearest.player.nativeTeamSlot !== match.control.nativeTeamSlot
      && inClose
      && holderFacing === -1
      && !ownerCannotShield
    ) {
      const routed = sideRoute
        ? initializeOpenPlaySidePlayer({
          ballPosition: challengeBallPosition,
          distance: nearest.distance,
          nextTick,
          owner,
          player: nearest.sourcePlayer,
          teamRate,
        })
        : initializeSourceOrderedOpenPlayBetweenPlayer({
          ball: refreshedPrediction
            ?? owner.livePass?.sourcePrediction
            ?? owner.liveShot?.sourcePrediction
            ?? owner.liveControlIntercept?.sourcePrediction
            ?? sourceState.predictionBall,
          ballPosition: challengeBallPosition,
          match: challengedMatch,
          possession: sourceState.visits[sourcePlayerVisit].possession,
          player: nearest.sourcePlayer,
          teamRate,
          nextTick,
        });
      const routeKind = sideRoute ? "side" : "between";
      events.push({
        type: `ai-${routeKind}-started`,
        tick: nextTick,
        playerId: routed.id,
        opponentId: owner.id,
        distance: nearest.distance,
        seed: challengedMatch.rng.state.seed,
        target: clone(routed.liveMotion.target),
      });
      challengedMatch = {
        ...challengedMatch,
        players: challengedMatch.players.map((player) => (
          player.id === routed.id ? routed : player
        )),
      };
      continue;
    }
    if (
      nearest.player.nativeTeamSlot !== match.control.nativeTeamSlot
      && inClose
      && holderFacing === 0
      && owner.action.action.value !== TACKLE_ACTION
    ) {
      let forceErrorChance = 32;
      // INTELL.CPP applies the floating quotient through `int -= float`.
      // C++ truncates the completed subtraction, not the quotient alone.
      forceErrorChance = Math.trunc(forceErrorChance - (
        nearest.sourcePlayer.nativePlayerNumber < 12
          ? (1280 - nearest.sourcePlayer.position.x) / 48
          : nearest.sourcePlayer.position.x / 48
      ));
      const forceErrorGoesBetween = (
        nearest.distance
          >= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 6
        && (
          forceErrorChance > challengedMatch.rng.state.seed
          || owner.intelligence.move === GET_UP_INTELLIGENCE_MOVE
        )
      );
      if (forceErrorGoesBetween) {
        const routed = initializeSourceOrderedOpenPlayBetweenPlayer({
          ball: refreshedPrediction
            ?? owner.livePass?.sourcePrediction
            ?? owner.liveShot?.sourcePrediction
            ?? owner.liveControlIntercept?.sourcePrediction
            ?? sourceState.predictionBall,
          ballPosition: challengeBallPosition,
          match: challengedMatch,
          possession: sourceState.visits[sourcePlayerVisit].possession,
          player: nearest.sourcePlayer,
          teamRate,
          nextTick,
        });
        events.push({
          type: "ai-between-started",
          tick: nextTick,
          playerId: routed.id,
          opponentId: owner.id,
          distance: nearest.distance,
          seed: challengedMatch.rng.state.seed,
          target: clone(routed.liveMotion.target),
        });
        challengedMatch = {
          ...challengedMatch,
          players: challengedMatch.players.map((player) => (
            player.id === routed.id ? routed : player
          )),
        };
        continue;
      }
    }
    if (nearest.player.nativeTeamSlot === match.control.nativeTeamSlot) {
      const controlledBallPosition = challengeBallPosition;
      const controlledOwner = challengedMatch.players.find(({ id }) => id === owner.id);
      if (controlledOwner === undefined) {
        throw new Error(`AI pressure lost current owner ${owner.id}.`);
      }
      const ownerVisitedBeforePlayer = traversal.indexOf(owner.nativePlayerNumber)
        < traversal.indexOf(nearest.player.nativePlayerNumber);
      const controlledFacingOwner = ownerVisitedBeforePlayer
        ? controlledOwner
        : owner;
      const controlledHolderFacing = sourceOpponentHolderFacing(
        nearest.sourcePlayer,
        controlledFacingOwner,
        controlledBallPosition,
      );
      const controlledSideRoute = challengedMatch.ball.ball.speed < 1 && (
        (challengedMatch.rng.state.seed & 4) !== 0
        || (
          nearest.sourcePlayer.nativePlayerNumber > 11
          && controlledBallPosition.x < 640
        )
        || (
          nearest.sourcePlayer.nativePlayerNumber < 12
          && controlledBallPosition.x > 640
        )
      );
      if (
        inClose
        && controlledHolderFacing === -1
        && !ownerCannotShield
      ) {
        let routed = controlledSideRoute
          ? initializeOpenPlaySidePlayer({
            ballPosition: controlledBallPosition,
            distance: nearest.distance,
            nextTick,
            owner: controlledFacingOwner,
            player: nearest.sourcePlayer,
            teamRate,
          })
          : initializeSourceOrderedOpenPlayBetweenPlayer({
            ball: refreshedPrediction
              ?? owner.livePass?.sourcePrediction
              ?? owner.liveShot?.sourcePrediction
              ?? owner.liveControlIntercept?.sourcePrediction
              ?? sourceState.predictionBall,
            ballPosition: controlledBallPosition,
            match: challengedMatch,
            possession: sourceState.visits[sourcePlayerVisit].possession,
            player: nearest.sourcePlayer,
            teamRate,
            nextTick,
          });
        const routeKind = controlledSideRoute ? "side" : "between";
        events.push({
          type: `ai-${routeKind}-started`,
          tick: nextTick,
          playerId: routed.id,
          opponentId: owner.id,
          distance: nearest.distance,
          seed: challengedMatch.rng.state.seed,
          target: clone(routed.liveMotion.target),
        });
        challengedMatch = {
          ...challengedMatch,
          players: challengedMatch.players.map((player) => (
            player.id === routed.id ? routed : player
          )),
        };
      }
      continue;
    }
    let challenged = null;
    let kind = null;
    const traversalOwnerIndex = traversal.indexOf(owner.nativePlayerNumber);
    const traversalPlayerIndex = traversal.indexOf(nearest.player.nativePlayerNumber);
    const sourcePossession = pressureWindow === "before-collection"
      ? sourceState.possession
      : traversalOwnerIndex < traversalPlayerIndex
        ? challengedMatch.possession
        : sourceState.possession;
    const ownerPossessionTicks = sourcePossession.players.find(({ nativePlayer }) => (
      nativePlayer === owner.nativePlayerNumber
    ))?.possession;
    if (!Number.isSafeInteger(ownerPossessionTicks)) {
      throw new Error(`AI pressure lost possession ticks for ${owner.id}.`);
    }
    if (sourceHeldBallDirectInterceptEligible({
      ballPosition: challengeBallPosition,
      distance: nearest.distance,
      owner,
      ownerPossessionTicks,
      player: nearest.sourcePlayer,
      seed: challengedMatch.rng.state.seed,
    })) {
      challenged = initializeOpenPlayHeldBallIntercept({
        ballOwnerNativePlayer: owner.nativePlayerNumber,
        ballState: sourceState.ballState,
        nextTick,
        ownerTackling: owner.action.action.value === TACKLE_ACTION,
        player: nearest.sourcePlayer,
        teamRate,
      });
      kind = "intercept";
    }
    if (challenged === null) continue;
    if (challenged.liveContact !== undefined) {
      challenged.liveContact.opponentId = owner.id;
    }
    events.push({
      type: `ai-${kind}-started`,
      tick: nextTick,
      playerId: challenged.id,
      opponentId: owner.id,
      distance: nearest.distance,
      seed: challengedMatch.rng.state.seed,
    });
    challengedMatch = {
      ...challengedMatch,
      players: challengedMatch.players.map((player) => (
        player.id === challenged.id ? challenged : player
      )),
    };
  }
  return challengedMatch;
}

function applyOpenPlayOffsideRunbacks({
  aiChallengePlayerIds = [],
  command,
  completedRunbackPlayerIds,
  defensiveLines = null,
  expiredInterceptPlayerIds,
  logicCount,
  match,
  nextTick,
  sourcePlayers,
  visits,
}) {
  if (
    match.config.rules.offside !== true
    || match.goal.justScored !== 0
  ) return match;
  const sourceDefensiveLines = defensiveLines
    ?? captureOpenPlayDefensiveLines(sourcePlayers);
  const defenseA = sourceDefensiveLines.teamA;
  const defenseB = sourceDefensiveLines.teamB;
  const margin = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  const rates = new Map(currentTeamRates(match.players, match.clock.gameMinute)
    .map(({ id, value }) => [id, value]));
  const completedRunbacks = new Set(completedRunbackPlayerIds);
  const expiredIntercepts = new Set(expiredInterceptPlayerIds);
  const aiChallenges = new Set(aiChallengePlayerIds);
  const currentById = new Map(match.players.map((player) => [player.id, player]));
  const visitById = new Map(visits.map((visit) => [visit.playerId, visit]));
  const players = sourcePlayers.map((sourcePlayer) => {
    const current = currentById.get(sourcePlayer.id);
    if (current === undefined) {
      throw new Error(`Offside run-back lost current player ${sourcePlayer.id}.`);
    }
    // ACTIONS.CPP go_team omits guy_on == 0 slots, so an already-dismissed
    // player has neither a source visit nor an offside_rule pass.
    if (!sourcePlayer.active) return current;
    const sourceVisit = visitById.get(sourcePlayer.id);
    if (sourceVisit === undefined) {
      throw new Error(`Offside run-back lost source visit for ${sourcePlayer.id}.`);
    }
    const sourcePossession = sourceVisit.possession;
    const expiredIntercept = expiredIntercepts.has(sourcePlayer.id);
    if (completedRunbacks.has(sourcePlayer.id)) return current;
    if (
      sourcePlayer.role === "keeper"
      || (
        sourcePlayer.id === match.control.activePlayerId
        && sourcePossession.owner !== 0
      )
      || sourcePlayer.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN
      || (
        sourcePlayer.liveContact !== undefined
        && sourcePlayer.liveContact.phase !== "barge"
      )
      || sourcePlayer.livePass !== undefined
      || sourcePlayer.liveShot !== undefined
      || (sourcePlayer.intelligence.count !== 0 && !expiredIntercept)
    ) return current;
    const continuing = sourcePlayer.liveMotion?.kind === "offside-runback";
    // ball_interact and a later kick can change ball_poss inside one go_team
    // traversal. free_ball suppresses run_back while the ball is out, but
    // we_have_ball does not: route this player from the possession visible at
    // his own source visit, never the completed team's final possession.
    if (match.ball.ball.outOfPlay !== 0 && sourcePossession.owner === 0) {
      return current;
    }
    const eligiblePossession = sourcePossession.owner === 0
      || (
        (sourcePossession.owner < 12)
        === (sourcePlayer.nativeTeamSlot === "A")
      );
    if (
      continuing
      && !eligiblePossession
      && sourcePlayer.liveMotion.goCount === 1
    ) {
      // opp_has_ball clears tm_off before do_action. The terminal RUN_ACT
      // step and its same-visit zonal replacement were both resolved by the
      // team journey reducer; do not resurrect the entry run-back here.
      return current;
    }
    if (
      continuing
      && current.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
      && current.liveMotion?.kind === "support-run"
    ) {
      // we_have_ball runs before do_action. A same-visit support request
      // calls reset_ideas/init_run_act and replaces the old run_back journey;
      // this post-pass must not replay the tick-entry offside route.
      return current;
    }
    if (
      continuing
      && !eligiblePossession
      && aiChallenges.has(sourcePlayer.id)
    ) {
      // offside_rule clears tm_off when an opponent owns the ball. A later
      // intelligence branch may then replace the old run_back in this same
      // player visit; keep that route instead of resurrecting the entry
      // journey in this post-pass.
      return current;
    }
    const potential = sourcePlayer.nativeTeamSlot === "A"
      ? sourcePlayer.position.x > 640
        && sourceVisit.canBeOffside === 1
        && sourcePlayer.position.x > F32(defenseB + margin)
      : sourcePlayer.position.x < 640
        && sourceVisit.canBeOffside === 1
        && sourcePlayer.position.x < F32(defenseA - margin);
    const replans = eligiblePossession
      && potential
      && sourceThinkingTick(logicCount, sourcePlayer.gameplay.flair);
    if (!continuing && !eligiblePossession) return current;
    if (!continuing && !potential) return current;
    if (!continuing && !replans) {
      return current;
    }
    const teamRate = rates.get(sourcePlayer.id);
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Offside run-back lost current rate for ${sourcePlayer.id}.`);
    }
    const target = continuing && !replans
      ? sourcePlayer.liveMotion.target
      : {
          x: sourcePlayer.nativeTeamSlot === "A"
            ? F32(defenseB - (margin * 3))
            : F32(defenseA + (margin * 3)),
          y: sourcePlayer.position.y,
    };
    const runbackSource = expiredIntercept
      ? {
          ...clone(sourcePlayer),
          intelligence: { special: 0, move: 0, count: 0 },
        }
      : sourcePlayer;
    if (expiredIntercept) delete runbackSource.sourceGlobalInterceptorTick;
    return stepOpenPlayOffsideRunback({
      // process_dir reads the ball after all earlier player visits and before
      // all later visits. This matters when a collection changes it mid-team.
      ballPosition: sourceVisit.ballPosition,
      burstTimer: match.control.burstTimer,
      command,
      controlled: sourcePlayer.id === match.control.activePlayerId,
      nextTick,
      player: runbackSource,
      possession: sourcePossession,
      replan: replans,
      target,
      teamRate,
    });
  });
  return { ...match, players };
}

function currentOpenPlayAiRoutePlayerIds(events, nextTick) {
  return events
    .filter(({ playerId, tick, type }) => (
      typeof playerId === "string"
      && tick === nextTick
      && (
        type === "ai-between-started"
        || type === "ai-side-started"
        || type === "ai-intercept-started"
        || type === "ai-close-down-started"
      )
    ))
    .map(({ playerId }) => playerId);
}

function stepOpenPlayOffsideRunback({
  ballPosition,
  burstTimer,
  command,
  controlled,
  nextTick,
  player,
  possession,
  replan,
  target,
  teamRate,
}) {
  const offset = {
    x: F32(target.x - player.position.x),
    y: F32(target.y - player.position.y),
  };
  const distance = sourceDistance2d(offset);
  const motionProfile = projectCssoccerMotionSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  let goStep;
  let faceBall;
  if (replan) {
    const alignment = sourceAngleCosine({ target: offset, facing: player.facing });
    let retainedStep = player.liveMotion.goStep;
    let stepMode = 1;
    if (alignment >= Math.cos(motionProfile.maxTurnRadians)) {
      retainedStep = false;
      stepMode = 2;
    }
    goStep = (retainedStep && distance < travelProfile.stepRange * 2)
      || (!retainedStep && distance < travelProfile.stepRange);
    faceBall = goStep && stepMode === 1;
  } else {
    goStep = player.liveMotion.goStep;
    faceBall = player.liveMotion.directionMode === 1;
  }
  if (controlled) {
    const vector = sourceUserVector(player, command);
    const neutral = vector.x === 0 && vector.y === 0;
    const userGoStep = neutral ? goStep : false;
    const userTarget = {
      x: F32(player.position.x + (vector.x * 256)),
      y: F32(player.position.y + (vector.y * 256)),
    };
    const speed = actualPlayerSpeed({
      pitchLength: 1280,
      teamRate,
      speedIntent: CSSOCCER_SPEED_INTENT.normal,
      intentionCount: 0,
      sideStep: userGoStep,
      nativePlayer: player.nativePlayerNumber,
      ballPossession: possession.owner,
      ballInHands: possession.inHands !== 0,
      keeperNativePlayers: [1, 12],
      userControlIndex: 1,
      burstTimer,
    });
    const displacement = userGoStep
      ? { x: F32(0), y: F32(0) }
      : sourceForwardDisplacement({
          facing: player.facing,
          targetOffset: {
            x: F32(userTarget.x - player.position.x),
            y: F32(userTarget.y - player.position.y),
          },
          speed,
        }).displacement;
    const position = {
      ...updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement,
      }),
      z: player.position.z,
    };
    const facing = turnSourceFacing({
      facing: player.facing,
      target: neutral
        ? {
            x: F32(ballPosition.x - position.x),
            y: F32(ballPosition.y - position.y),
          }
        : {
            x: F32(userTarget.x - position.x),
            y: F32(userTarget.y - position.y),
          },
      maxTurnRadians: motionProfile.maxTurnRadians,
    }).facing;
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: { ...clone(displacement), z: F32(0) },
      facing,
      target: { ...userTarget, z: F32(0) },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: neutral
          ? CSSOCCER_NATIVE_ACTIONS.STAND
          : CSSOCCER_NATIVE_ACTIONS.RUN,
        facingX: facing.x,
        facingY: facing.y,
      }),
      liveMotion: {
        kind: neutral ? "stand" : "run",
        teamRate,
        target: userTarget,
        goStep: userGoStep,
        goCount: 0,
        goDisplacement: displacement,
        directionMode: neutral ? 1 : 0,
        resetAnimationFrame: true,
        sideStepDirection: null,
        animationId: null,
        animationFrameStep: null,
      },
    };
  }
  const speed = actualPlayerSpeed({
    pitchLength: 1280,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: goStep,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: possession.owner,
    ballInHands: possession.inHands !== 0,
    keeperNativePlayers: [1, 12],
    userControlIndex: 0,
    burstTimer: 0,
  });
  let goCount;
  let goDisplacement;
  if (goStep) {
    if (replan) {
      const initialGoCount = Math.trunc(distance / speed + 1);
      goCount = Math.max(0, initialGoCount - 1);
      goDisplacement = {
        x: F32(offset.x / initialGoCount),
        y: F32(offset.y / initialGoCount),
      };
    } else {
      goCount = Math.max(0, player.liveMotion.goCount - 1);
      goDisplacement = clone(player.liveMotion.goDisplacement);
    }
  } else {
    if (replan) {
      const travel = sourceGetThereTime({
        position: { x: player.position.x, y: player.position.y },
        target,
        facing: player.facing,
        speed,
        maxTurn2Radians: travelProfile.maxTurn2Radians,
        imThereDistance: travelProfile.imThereDistance,
        canRotateAndRun: true,
        mustFace: null,
      });
      goCount = Math.max(0, travel.ticks - 1);
    } else {
      goCount = Math.max(0, player.liveMotion.goCount - 1);
    }
    goDisplacement = sourceForwardDisplacement({
      facing: player.facing,
      targetOffset: offset,
      speed,
    }).displacement;
  }
  const position = {
    ...updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement: goDisplacement,
    }),
    z: player.position.z,
  };
  const facingTarget = faceBall
    ? {
        x: F32(ballPosition.x - position.x),
        y: F32(ballPosition.y - position.y),
      }
    : {
        x: F32(target.x - position.x),
        y: F32(target.y - position.y),
      };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: facingTarget,
    maxTurnRadians: motionProfile.maxTurnRadians,
  }).facing;
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { ...clone(goDisplacement), z: F32(0) },
    facing,
    target: { x: target.x, y: target.y, z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: facing.x,
      facingY: facing.y,
    }),
    liveMotion: {
      kind: "offside-runback",
      teamRate,
      target: { x: target.x, y: target.y },
      goStep,
      goCount,
      goDisplacement,
      directionMode: faceBall ? 1 : 0,
      resetAnimationFrame: false,
      sideStepDirection: null,
      animationId: null,
      // Continuing go_forward does not call init_trot_anim again; retain the
      // installed tm_fstep even when the current team rate changes.
      animationFrameStep: replan ? null : player.animation.frameStep,
    },
  };
}

function sourceThinkingTick(logicCount, flair) {
  const period = Math.trunc((130 - flair) / 2);
  if (period <= 0) throw new Error("Source thinking period must be positive.");
  return logicCount % period === 0;
}

function sourceOpponentHolderFacing(player, owner, ballPosition) {
  const directionToBall = sourceFacingDirection({
    x: F32(ballPosition.x - player.position.x),
    y: F32(ballPosition.y - player.position.y),
  });
  const ownerDirection = sourceFacingDirection(owner.facing);
  if (ownerDirection === directionToBall) return -1;
  const difference = (directionToBall - ownerDirection + 8) % 8;
  if (difference === 1 || difference === 7) return -1;
  if (difference === 2 || difference === 6) return 1;
  return 0;
}

function sourceHeldBallDirectInterceptEligible({
  ballPosition,
  distance,
  owner,
  ownerPossessionTicks,
  player,
  seed,
}) {
  const pitchRatio = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  if (!(distance < pitchRatio * 13)) return false;
  const holderFacing = sourceOpponentHolderFacing(player, owner, ballPosition);
  if (holderFacing === -1) return false;

  const ownerTackling = owner.action.action.value === TACKLE_ACTION;
  const forceErrorGoesDirect = holderFacing === 0
    && (distance < pitchRatio * 6 || ownerTackling);
  if (forceErrorGoesDirect) return true;
  if (holderFacing === 0) {
    let chance = 32;
    chance = Math.trunc(chance - (
      player.nativePlayerNumber < 12
        ? (1280 - player.position.x) / 48
        : player.position.x / 48
    ));
    if (
      chance > seed
      || owner.intelligence.move === GET_UP_INTELLIGENCE_MOVE
    ) return false;
  }

  // get_tack_path does not act until the holder has owned the ball for five
  // complete visits. Its stationary-ball branch contains the original
  // plr_facing(ballx,bally,player) absolute-coordinate call; a true result
  // starts a tackle, while false falls through to go_to_path.
  if (ownerPossessionTicks <= 4) return false;
  if (owner.action.action.value !== CSSOCCER_NATIVE_ACTIONS.STAND) return false;
  const absoluteBallDistance = sourceDistance2d({
    x: F32(ballPosition.x),
    y: F32(ballPosition.y),
  });
  if (!(absoluteBallDistance > 0)) return false;
  const absoluteFacingCosine = (
    (ballPosition.x * player.facing.x)
    + (ballPosition.y * player.facing.y)
  ) / absoluteBallDistance;
  return absoluteFacingCosine
    <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.facingAngle.value;
}

function initializeOpenPlayHeldBallIntercept({
  ballOwnerNativePlayer,
  ballState,
  nextTick,
  ownerTackling,
  player,
  teamRate,
}) {
  const scan = scanOpenPlayHeldBallRunIntercept({
    ballState,
    ownerTackling,
    player,
    teamRate,
  });
  if (scan === null) return null;
  if (scan.travel.stopAndFace) {
    const intelligenceCount = 33 - Math.trunc(player.gameplay.flair / 4);
    const facing = turnSourceFacing({
      facing: player.facing,
      target: {
        x: F32(scan.target.x - player.position.x),
        y: F32(scan.target.y - player.position.y),
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
      velocity: { x: F32(0), y: F32(0), z: F32(0) },
      facing,
      target: { x: scan.target.x, y: scan.target.y, z: F32(0) },
      ballState: -ballOwnerNativePlayer,
      sourceGlobalInterceptorTick: nextTick,
      intelligence: { special: 0, move: 1, count: intelligenceCount },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STOP,
        facingX: facing.x,
        facingY: facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: "stand",
        id: STAND_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.STOP,
        frame: F32(0),
        frameStep: STAND_FRAME_STEP,
        pending: null,
        tick: nextTick,
      },
      liveMotion: {
        ...clone(player.liveMotion),
        kind: "stop-intercept",
        teamRate,
        target: { x: scan.target.x, y: scan.target.y },
        goStep: false,
        goCount: 1,
        directionMode: 0,
        resetAnimationFrame: true,
        sideStepDirection: null,
        animationId: STAND_ANIMATION,
        animationFrameStep: STAND_FRAME_STEP,
      },
    };
  }
  const moved = moveFreeBallInterceptor(player, {
    ballState: -ballOwnerNativePlayer,
    goCount: scan.travel.ticks,
    intelligenceCount: 33 - Math.trunc(player.gameplay.flair / 4),
    nextTick,
    special: 0,
    target: scan.target,
    teamRate,
    userControlIndex: 0,
  });
  moved.sourceGlobalInterceptorTick = nextTick;
  return moved;
}

function scanOpenPlayHeldBallRunIntercept({
  ballState,
  ownerTackling,
  player,
  teamRate,
}) {
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const fullSpeed = sourceFullPlayerSpeed({
    pitchLength: 1280,
    teamRate,
    celebrating: false,
  });
  const jumpHeight = F32(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value
      + 6
      + Math.trunc(player.gameplay.power / 10),
  );
  const reactionTicks = 1 + Math.trunc(player.gameplay.flair / 16);
  const predicted = clone(ballState.ball.position);
  const displacement = ballState.ball.displacement;
  let bestWait = 1000;
  let selected = null;
  for (let tickOffset = 1; tickOffset < 50; tickOffset += 1) {
    const scale = ownerTackling ? Math.pow(TACKLE_DECEL, tickOffset - 1) : 1;
    predicted.x = F32(predicted.x + F32(displacement.x * scale));
    predicted.y = F32(predicted.y + F32(displacement.y * scale));
    if (tickOffset % 2 === 0) continue;
    if (
      predicted.x < 0
      || predicted.x >= 1280
      || predicted.y < 0
      || predicted.y >= 800
    ) break;
    if (predicted.z >= jumpHeight) continue;
    const travel = sourceGetThereTime({
      position: { x: player.position.x, y: player.position.y },
      target: { x: predicted.x, y: predicted.y },
      facing: player.facing,
      speed: fullSpeed,
      maxTurn2Radians: travelProfile.maxTurn2Radians,
      imThereDistance: travelProfile.imThereDistance,
      canRotateAndRun: true,
      mustFace: null,
    });
    if (travel.ticks > tickOffset) continue;
    const waitTicks = tickOffset - travel.ticks;
    // INTELL.CPP can_i_intercept has a separate held-ball branch: unlike a
    // free ball it does not require the target to be in front, and its
    // run-on candidate requires one positive free tick.
    if (waitTicks <= 0 || waitTicks >= bestWait || waitTicks >= reactionTicks) {
      continue;
    }
    bestWait = waitTicks;
    selected = {
      target: clone(predicted),
      travel,
      tickOffset,
      waitTicks,
    };
  }
  return selected;
}

function initializeOpenPlaySidePlayer({
  ballPosition,
  distance,
  nextTick,
  owner,
  player,
  teamRate,
}) {
  if (!(distance > 0)) {
    throw new Error("AI side route requires a positive source player distance.");
  }
  let x = F32((ballPosition.x - player.position.x) / distance);
  let y = F32((ballPosition.y - player.position.y) / distance);
  if (x * owner.facing.y > y * owner.facing.x) {
    x = F32(-owner.facing.y);
    y = owner.facing.x;
  } else {
    x = owner.facing.y;
    y = F32(-owner.facing.x);
  }
  const target = {
    x: F32(
      ballPosition.x
        + (x * CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value),
    ),
    y: F32(
      ballPosition.y
        + (y * CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value),
    ),
  };
  const intelligenceCount = 33 - Math.trunc(player.gameplay.flair / 4);
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
    userControlIndex: 0,
    burstTimer: 0,
  });
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const travel = sourceGetThereTime({
    position: { x: player.position.x, y: player.position.y },
    target,
    facing: player.facing,
    speed,
    maxTurn2Radians: travelProfile.maxTurn2Radians,
    imThereDistance: travelProfile.imThereDistance,
    canRotateAndRun: true,
    mustFace: null,
  });
  return initializeOpenPlayBetweenIntercept(player, {
    ballPosition,
    ballState: player.ballState,
    goCount: Math.max(0, travel.ticks - 1),
    intelligenceCount,
    nextTick,
    special: player.intelligence.special,
    target,
    teamRate,
    userControlIndex: 0,
  });
}

function initializeOpenPlayBetweenPlayer({
  ball,
  ballPosition,
  player,
  teamRate,
  nextTick,
}) {
  const intentionCount = 33 - Math.trunc(player.gameplay.flair / 4);
  const speed = actualPlayerSpeed({
    pitchLength: 1280,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.intercept,
    intentionCount,
    sideStep: false,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: 0,
    ballInHands: false,
    keeperNativePlayers: [1, 12],
    userControlIndex: 0,
    burstTimer: 0,
  });
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const goalX = player.nativePlayerNumber < 12 ? 0 : 1280;
  const betweenDistance = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 3;
  const playerHeight = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value;
  const predicted = clone(ball.position);
  let selected = null;
  for (let index = 1; index < 50; index += 1) {
    predicted.x = F32(predicted.x + ball.displacement.x);
    predicted.y = F32(predicted.y + ball.displacement.y);
    predicted.z = F32(predicted.z + ball.displacement.z);
    // go_to_between assigns each float expression to an int through Watcom's
    // checked C conversion (__CHP + FISTP), which chops toward zero.
    let x = Math.trunc(predicted.x);
    let y = Math.trunc(predicted.y);
    const z = Math.trunc(predicted.z);
    let goalDistance = Math.trunc(sourceDistance2d({
      x: F32(goalX - x),
      y: F32(400 - y),
    }));
    if (goalDistance < 1) goalDistance = 1;
    x = Math.trunc(
      x + (((goalX - x) * betweenDistance) / goalDistance),
    );
    y = Math.trunc(
      y + (((400 - y) * betweenDistance) / goalDistance),
    );
    const target = { x: F32(x), y: F32(y) };
    const travel = sourceGetThereTime({
      position: { x: player.position.x, y: player.position.y },
      target,
      facing: player.facing,
      speed,
      maxTurn2Radians: travelProfile.maxTurn2Radians,
      imThereDistance: travelProfile.imThereDistance,
      canRotateAndRun: true,
      mustFace: null,
    });
    selected = { target, travel };
    if (z <= playerHeight && travel.ticks <= index) break;
  }
  if (selected === null) throw new Error("AI between-path prediction produced no target.");
  return initializeOpenPlayBetweenIntercept(player, {
    ballPosition,
    ballState: player.ballState,
    goCount: Math.max(0, selected.travel.ticks - 1),
    intelligenceCount: intentionCount,
    nextTick,
    special: player.intelligence.special,
    target: selected.target,
    teamRate,
    userControlIndex: 0,
  });
}

function initializeSourceOrderedOpenPlayBetweenPlayer({
  ball,
  ballPosition,
  match,
  nextTick,
  player,
  possession,
  teamRate,
}) {
  const routed = initializeOpenPlayBetweenPlayer({
    ball,
    ballPosition,
    nextTick,
    player,
    teamRate,
  });
  const transientTarget = routed.liveMotion.target;
  const transientDistance = sourceDistance2d({
    x: F32(transientTarget.x - player.position.x),
    y: F32(transientTarget.y - player.position.y),
  });
  const imThereDistance = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  ).imThereDistance;
  if (transientDistance >= imThereDistance) return routed;
  const current = match.players.find(({ id }) => id === player.id);
  if (
    current === undefined
    || current.liveMotion === undefined
    || current.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN
  ) {
    throw new Error(
      `Already-there between route lost ${player.id}'s zonal source visit.`,
    );
  }
  const snapDisplacement = {
    x: F32(transientTarget.x - player.position.x),
    y: F32(transientTarget.y - player.position.y),
  };
  const snapped = {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position: {
      x: transientTarget.x,
      y: transientTarget.y,
      z: player.position.z,
    },
    velocity: { ...snapDisplacement, z: F32(0) },
    target: { x: transientTarget.x, y: transientTarget.y, z: F32(0) },
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
      target: { x: transientTarget.x, y: transientTarget.y },
      goCount: 1,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: null,
      animationFrameStep: null,
    },
  };
  const zone = match.kickoff.zoning?.[player.nativeTeamSlot];
  if (zone === undefined) {
    throw new Error(`Already-there between route lost ${player.id}'s ball zone.`);
  }
  const teamInPossession = possession.lastTouch !== 0 && (
    (player.nativeTeamSlot === "A" && possession.lastTouch < 12)
    || (player.nativeTeamSlot === "B" && possession.lastTouch > 11)
  );
  return projectCssoccerFreePlayZonalPlayerVisit({
    allowSideStep: true,
    ballPosition,
    nextTick,
    player: snapped,
    possession,
    tactics: match.tactics,
    teamRate,
    targetOverride: current.liveMotion.target,
    zoning: {
      analogue: match.kickoff.zoning.analogue
        && match.ball.ball.outOfPlay === 0,
      ballZone: zone.ballZone,
      zoneCenter: clone(zone.zoneCenter),
      teamInPossession,
    },
  });
}

export function initializeOpenPlayBetweenIntercept(player, {
  ballPosition,
  ballState,
  goCount,
  intelligenceCount,
  nextTick,
  special,
  target,
  teamRate,
  userControlIndex,
}) {
  const offset = {
    x: F32(target.x - player.position.x),
    y: F32(target.y - player.position.y),
  };
  const distance = sourceDistance2d(offset);
  const motionProfile = projectCssoccerMotionSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  let retainedStep = player.liveMotion.goStep;
  let stepMode = 1;
  if (
    sourceAngleCosine({ target: offset, facing: player.facing })
      >= Math.cos(motionProfile.maxTurnRadians)
  ) {
    retainedStep = false;
    stepMode = 2;
  }
  const sideStep = (
    (retainedStep && distance < travelProfile.stepRange * 2)
    || (!retainedStep && distance < travelProfile.stepRange)
  );
  if (!sideStep) {
    return moveFreeBallInterceptor(player, {
      ballState,
      goCount,
      intelligenceCount,
      nextTick,
      special,
      target,
      teamRate,
      userControlIndex,
    });
  }
  const speed = actualPlayerSpeed({
    pitchLength: 1280,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.intercept,
    intentionCount: intelligenceCount,
    sideStep: true,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: 0,
    ballInHands: false,
    keeperNativePlayers: [1, 12],
    userControlIndex,
    burstTimer: 0,
  });
  const initialGoCount = Math.trunc(distance / speed + 1);
  if (initialGoCount <= 0) {
    throw new Error(`Between intercept produced an invalid step count for ${player.id}.`);
  }
  const goDisplacement = {
    x: F32(offset.x / initialGoCount),
    y: F32(offset.y / initialGoCount),
  };
  const position = {
    ...updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement: goDisplacement,
    }),
    z: player.position.z,
  };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: stepMode === 1
      ? {
          x: F32(ballPosition.x - position.x),
          y: F32(ballPosition.y - position.y),
        }
      : {
          x: F32(target.x - position.x),
          y: F32(target.y - position.y),
        },
    maxTurnRadians: motionProfile.maxTurnRadians,
  }).facing;
  const sideStepDirection = sourceSideStepDirection({
    target,
    previousPosition: player.position,
    previousFacing: player.facing,
  });
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { ...clone(goDisplacement), z: F32(0) },
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
      goStep: true,
      goCount: Math.max(0, initialGoCount - 1),
      goDisplacement,
      directionMode: stepMode === 1 ? 1 : 0,
      resetAnimationFrame: false,
      sideStepDirection,
      animationId: TROT_ANIMATION_BY_DIRECTION[sideStepDirection],
      animationFrameStep: F32(speed * SIDE_STEP_FRAME_STEP / 2),
      userControlIndex,
    },
  };
}

function processLocalUser({
  match,
  command,
  nearest,
  nextTick,
  playerDistanceFrame,
  playerVisitFrame,
  sourcePlayers,
  sourcePredictionBall,
  events,
  suppressFreeBallHandoff = false,
}) {
  const postGoalBallCountdown = match.goal.phase === "awaiting-post-goal-handoff"
    && match.ball.outcome?.kind === "goal"
    && match.ball.ball.outOfPlay > 0;
  if (
    match.rules.boundary?.phase === "delay"
    && match.rules.matchMode !== 0
    && match.rules.matchMode !== 11
    && match.rules.matchMode !== 12
  ) {
    // ACTIONS.CPP go_team already routed the controlled player through
    // computer_play for this non-throw restart mode. new_users follows the
    // team traversal, but there is no second user_play visit to overwrite it.
    return match;
  }
  if (match.kickoff.phase !== "open-play" && !postGoalBallCountdown) return match;
  const freeBallHandoff = suppressFreeBallHandoff
    ? undefined
    : events.findLast(({ type, activePlayerId }) => (
        type === "free-ball-control-handoff"
        && activePlayerId === match.control.activePlayerId
      ));
  if (freeBallHandoff !== undefined) {
    if (!Array.isArray(playerVisitFrame)) {
      throw new Error("Free-ball control handoff lost native visit order.");
    }
    const previousVisitIndex = playerVisitFrame.findIndex(({ playerId }) => (
      playerId === freeBallHandoff.previousPlayerId
    ));
    const handoffVisitIndex = playerVisitFrame.findIndex(({ playerId }) => (
      playerId === freeBallHandoff.activePlayerId
    ));
    if (previousVisitIndex < 0 || handoffVisitIndex < 0) {
      throw new Error("Free-ball control handoff lost player visit identity.");
    }
    if (previousVisitIndex > handoffVisitIndex) {
      // The interceptor reselected the user before the old selected player's
      // later go_team slot. That later slot therefore already ran
      // computer_play; new_users must not overwrite it with a second neutral
      // user action after the traversal.
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
    // free_ball calls go_to_path from an unselected computer_play visit,
    // then reselects that interceptor before the visit returns. When the
    // entry-selected player ran earlier, retain that completed user_play
    // command while publishing the new control byte without visiting the
    // interceptor a second time.
    const sourceUser = match.players.find(({ id }) => (
      id === freeBallHandoff.previousPlayerId
    ));
    const sourceUserControlMatch = {
      ...match,
      control: {
        ...match.control,
        activePlayerId: freeBallHandoff.previousPlayerId,
      },
    };
    const sourceUserPlayers = sourceUser?.intelligence.move === 1
      && sourceUser.intelligence.count > 0
      ? stepActiveFreeBallJourney(
          sourceUserControlMatch,
          match.players,
          nextTick,
          command,
          playerVisitFrame,
          null,
          match.players,
          match.possession,
          freeBallHandoff.previousPlayerId,
        )
      : match.players;
    const sourceUserMatch = {
      ...sourceUserControlMatch,
      players: sourceUserPlayers,
    };
    const sourceUserVisited = processLocalUser({
      match: sourceUserMatch,
      command,
      nearest,
      nextTick,
      playerDistanceFrame,
      playerVisitFrame,
      sourcePlayers,
      sourcePredictionBall,
      events,
      suppressFreeBallHandoff: true,
    });
    return {
      ...sourceUserVisited,
      control: {
        ...sourceUserVisited.control,
        activePlayerId: freeBallHandoff.activePlayerId,
      },
    };
  }
  const activePlayerId = match.control.activePlayerId;
  if (activePlayerId === null) {
    // clear_all_autos can survive through an opponent restart release. This
    // source slot is new_users: it selects nearest below in
    // select_all_hlites, but it cannot retroactively execute user_play in the
    // already-completed process_teams traversal.
    return match;
  }
  const selected = match.players.find(({ id }) => id === activePlayerId);
  if (selected === undefined) {
    throw new Error("General-play control requires one current source player.");
  }
  if (
    match.ball.limbo.active !== 0
    && match.ball.limbo.player === selected.nativePlayerNumber
  ) {
    // ACTIONS.CPP go_team advances process_anims first, then skips the player
    // named by ball_limbo_p. No user_play visit exists for new_users to
    // overwrite while a released throw remains bound to its taker.
    return match;
  }
  if (selected.liveMotion?.sourceGameActionUserVisitTick === nextTick) {
    // process_teams has already materialized the controlled stand/run action
    // under kphold_action's game_action=-1. new_users retains the selection;
    // it does not execute a second neutral user action.
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
  if (selected.liveMotion?.sourceOpenPlayUserVisitTick === nextTick) {
    // The selected player's ordinary source user_play slot was materialized
    // inside process_teams so player_tussles could consume its current pose.
    // USER.CPP new_users retains control but does not execute that visit again.
    const players = match.players.map((player) => {
      if (player.id !== selected.id) return clone(player);
      const visited = clone(player);
      delete visited.liveMotion.sourceOpenPlayUserVisitTick;
      return visited;
    });
    return {
      ...match,
      players,
      control: {
        ...match.control,
        burstTimer: 0,
        lastCommand: clone(command),
        passCharge: null,
        shotCharge: null,
      },
    };
  }
  if (
    selected.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
    && selected.intelligence.count > 0
    && selected.liveMotion?.kind === "support-run"
  ) {
    // user_intelligence delegates a selected player with a live I_RUN_ON
    // request to the busy intelligence branch. process_teams has already
    // decremented and moved that journey; new_users only retains selection.
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
  // ACTIONS.CPP go_team enters ordinary user_play for every controlled
  // player when match_mode is zero, including KP_A/KP_B after a goal kick.
  // Native new_users cannot reselect during the resulting free-ball phase.
  const collectedVisit = events.findLast(({ type, activePlayerId: playerId }) => (
    type === "ball-collected-control-handoff" && playerId === activePlayerId
  ));
  const retainedActiveCollectionVisit = playerVisitFrame?.find((visit) => (
    visit.interaction === "collect"
    && visit.playerId === activePlayerId
    && visit.possession.owner === selected.nativePlayerNumber
  ));
  if (
    collectedVisit !== undefined
    || retainedActiveCollectionVisit !== undefined
  ) {
    // collect_ball/reselect already ran this player's user_play visit inside
    // process_teams, before player_tussles. Do not execute it again here.
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
    if (selected.liveContact.phase !== "barge") {
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
    // MC_BARGE is only an animation/timer layered over RUN_ACT. A newly
    // selected local player still executes user_run/user_stand while that
    // timer survives; only fall/tackle/steal contact owns the physical action.
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
    if (tackled !== null) {
      tackled.liveContact.opponentId = owner?.id ?? null;
      return {
        ...match,
        players: match.players.map((player) => (
          player.id === selected.id ? tackled : player
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
    // INTELL.CPP user_opp_has_ball only attempts init_tackle_act here.
    // When MAX_TURN rejects that action, user_play still reaches do_action:
    // the retained STAND/RUN action consumes the same movement command below.
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
      sourcePredictionBall,
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
      sourcePredictionBall,
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
        sourcePredictionBall,
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
        sourcePredictionBall,
        pass: {
          rng: match.rng.state,
          action: {
            holderId: selected.id,
            passType: 5,
            sourceBallPosition: clone(match.ball.ball.position),
            sourcePossessionOwner: match.possession.owner,
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
  const selectedVisitIndex = playerVisitFrame?.findIndex(({ playerId }) => (
    playerId === selected.id
  ));
  const collectionVisitIndex = playerVisitFrame?.findIndex(({ interaction }) => (
    interaction === "collect"
  ));
  const retainedLooseBallVisit = match.possession.owner !== 0
    && selectedVisitIndex >= 0
    && collectionVisitIndex > selectedVisitIndex
    && playerVisitFrame[selectedVisitIndex].possession.owner === 0;
  if (
    (match.possession.owner === 0 || retainedLooseBallVisit)
    && selected.intelligence.move === 1
    && selected.intelligence.count > 0
  ) {
    // A later player may collect after this controlled player's go_team slot.
    // Its already-executed free-ball intelligence remains the published visit;
    // new_users must not retroactively settle that run against final possession.
    // INTELL.CPP's terminal source-entry int_cnt == 1 visit is different:
    // process_teams decrements it to zero and resets the intention before
    // this post-traversal user materialization executes the neutral action.
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
    const sourcePlayer = moving
      ? sourcePlayers?.find(({ id }) => id === player.id)
      : player;
    if (sourcePlayer === undefined) {
      throw new Error(`Controlled source visit lost ${player.id}.`);
    }
    const stoppingRun = !moving
      && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN;
    const previousPosition = clone(sourcePlayer.position);
    const previousFacing = clone(sourcePlayer.facing);
    let position = clone(sourcePlayer.position);
    let velocity = { x: F32(0), y: F32(0), z: F32(0) };
    let facing = clone(sourcePlayer.facing);
    let actionId = CSSOCCER_NATIVE_ACTIONS.STAND;
    const target = {
      x: F32(sourcePlayer.position.x + (vector.x * 256)),
      y: F32(sourcePlayer.position.y + (vector.y * 256)),
    };
    const startingRun = moving
      && sourcePlayer.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND;
    let goStop = false;
    let goDisplacement = { x: F32(0), y: F32(0) };
    if (moving) {
      const speed = actualPlayerSpeed({
        pitchLength: 1280,
        teamRate,
        speedIntent: CSSOCCER_SPEED_INTENT.normal,
        intentionCount: 0,
        sideStep: false,
        nativePlayer: sourcePlayer.nativePlayerNumber,
        ballPossession: match.possession.owner,
        ballInHands: match.possession.inHands !== 0,
        keeperNativePlayers: [1, 12],
        userControlIndex: 1,
        burstTimer,
      });
      const targetOffset = {
        x: F32(target.x - sourcePlayer.position.x),
        y: F32(target.y - sourcePlayer.position.y),
      };
      if (startingRun) {
        // stand_action/user_stand initializes RUN_ACT but does not call
        // go_forward in this visit. Preserve init_run_act's route choice for
        // the animation and turn in process_dir; physical travel starts on
        // the following RUN_ACT visit.
        const travelProfile = projectCssoccerTravelSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate },
        );
        const motionProfile = projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate },
        );
        const travel = sourceGetThereTime({
          position: {
            x: sourcePlayer.position.x,
            y: sourcePlayer.position.y,
          },
          target,
          facing: sourcePlayer.facing,
          speed: sourceFullPlayerSpeed({
            pitchLength: 1280,
            teamRate,
            celebrating: false,
          }),
          maxTurn2Radians: travelProfile.maxTurn2Radians,
          imThereDistance: travelProfile.imThereDistance,
          canRotateAndRun: true,
          mustFace: null,
        });
        goStop = travel.stopAndFace;
        const alignment = sourceAngleCosine({
          target: targetOffset,
          facing: sourcePlayer.facing,
        });
        const turnTicks = goStop
          ? Math.trunc(Math.abs(
              Math.acos(alignment) / motionProfile.maxTurnRadians,
            ))
          : 0;
        const displacementTicks = travel.ticks - turnTicks;
        if (displacementTicks <= 0) {
          throw new Error(
            `Controlled run produced an invalid journey for ${player.id}.`,
          );
        }
        goDisplacement = {
          x: F32(targetOffset.x / displacementTicks),
          y: F32(targetOffset.y / displacementTicks),
        };
      } else {
        const forward = sourceForwardDisplacement({
          facing: sourcePlayer.facing,
          targetOffset,
          speed,
        });
        const planarPosition = updateSourcePosition2d({
          position: {
            x: sourcePlayer.position.x,
            y: sourcePlayer.position.y,
          },
          displacement: forward.displacement,
        });
        position = {
          ...planarPosition,
          z: sourcePlayer.position.z,
        };
        velocity = { ...forward.displacement, z: F32(0) };
        goDisplacement = forward.displacement;
      }
      facing = turnSourceFacing({
        facing: sourcePlayer.facing,
        target: {
          x: F32(target.x - position.x),
          y: F32(target.y - position.y),
        },
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
      const sourceVisit = playerVisitFrame?.find(({ playerId }) => (
        playerId === player.id
      ));
      if (sourceVisit === undefined) {
        throw new Error(`Controlled stop lost the source visit for ${player.id}.`);
      }
      if (
        player.liveMotion.goStep === false
        && player.liveMotion.sourceNeutralRunVisitComplete !== true
      ) {
        // user_run first initializes a zero-distance stand target, then still
        // calls go_forward. angle_to_xy returns zero for that target, so the
        // source publishes one final half-speed step before settling to stand.
        // The same path also covers a later source-order collection that makes
        // the published possession non-zero after this player's free-ball visit.
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
      }
      facing = turnSourceFacing({
        facing: player.facing,
        target: {
          x: F32(sourceVisit.ballPosition.x - position.x),
          y: F32(sourceVisit.ballPosition.y - position.y),
        },
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate },
        ).maxTurnRadians,
      }).facing;
    }
    const intelligence = stoppingRun
      ? { special: 0, move: 0, count: 0 }
      : advanceCurrentSourceUserIntelligence(sourcePlayer);
    const materializedPlayer = clone(player);
    if (
      sourcePlayer.intelligence.move === 1
      && sourcePlayer.intelligence.count > 0
      && intelligence.count === 0
    ) {
      // USER.CPP user_intelligence expires I_INTERCEPT before do_action.
      // reset_ideas clears the team's source-global interceptor slot even
      // though the same visit may immediately install a fresh user_run.
      delete materializedPlayer.sourceGlobalInterceptorTick;
    }
    const liveMotion = projectCssoccerWantPassMotion({
      sourcePlayer,
      intelligence,
      liveMotion: {
        kind: moving ? "run" : "stand",
        teamRate,
        target,
        // user_stand/user_run route a neutral command through
        // init_run_act at the player's current position. That reaches
        // init_stand_act, which deliberately does not clear go_step.
        goStep: moving ? false : player.liveMotion.goStep,
        goStop: moving ? goStop : false,
        goCount: moving
          ? startingRun ? 1 : 0
          : stoppingRun ? 0 : 1,
        goDisplacement: moving
          ? goDisplacement
          : { x: velocity.x, y: velocity.y },
        directionMode: moving ? 0 : 1,
        resetAnimationFrame: !moving || goStop,
        sideStepDirection: null,
        animationId: null,
        animationFrameStep: null,
      },
    });
    return {
      ...materializedPlayer,
      previousPosition,
      previousFacing,
      position,
      velocity,
      facing,
      target: {
        ...target,
        z: sourcePlayer.position.z,
      },
      intelligence,
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId,
        facingX: facing.x,
        facingY: facing.y,
      }),
      liveMotion,
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

function processScheduledLocalUserSelection(match, {
  events,
  nearPath,
  nextTick,
  playerDistanceFrame,
}) {
  const previousBallTravel = Number.isSafeInteger(match.control.ballTravel)
    ? match.control.ballTravel
    : 0;
  const scheduled = match.possession.owner !== 0
    && match.rules.matchMode === 0
    && previousBallTravel > NATIVE_AUTO_SELECT_COUNT;
  const ballTravel = match.possession.owner !== 0
    && match.rules.matchMode === 0
    ? scheduled ? 0 : previousBallTravel + 1
    : previousBallTravel;
  let activePlayerId = match.control.activePlayerId;
  if (scheduled) {
    const current = match.players.find(({ id }) => id === activePlayerId);
    const owner = match.players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === match.possession.owner
    ));
    if (
      current === undefined
      || owner?.id !== current.id
      || owner.nativeTeamSlot !== match.control.nativeTeamSlot
    ) {
      if (
        owner !== undefined
        && owner.nativeTeamSlot === match.control.nativeTeamSlot
        && owner.role !== "keeper"
      ) {
        activePlayerId = owner.id;
      } else {
        let closest = null;
        let lowest = F32(2000);
        const mainPlayerId = nearPath?.nativeTeamSlot === match.control.nativeTeamSlot
          ? nearPath.id
          : null;
        for (const player of match.players
          .filter(({ nativeTeamSlot }) => nativeTeamSlot === match.control.nativeTeamSlot)
          .slice()
          .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber)) {
          if (
            !player.active
            || player.role === "keeper"
            || player.action.action.value === FALL_ACTION
          ) continue;
          const sourceDistance = playerDistanceFrame?.get(player.id);
          if (!Number.isFinite(sourceDistance)) {
            throw new Error(`Scheduled auto-selection lost source distance for ${player.id}.`);
          }
          const distance = player.id === mainPlayerId ? F32(1) : sourceDistance;
          if (distance < lowest) {
            closest = player;
            lowest = distance;
          }
        }
        const currentDistance = current === undefined
          ? Number.POSITIVE_INFINITY
          : playerDistanceFrame?.get(current.id);
        if (
          closest !== null
          && closest.id !== current?.id
          && (
            current === undefined
            || !Number.isFinite(currentDistance)
            || currentDistance >= NATIVE_SELECTION_CIRCLE
          )
        ) {
          activePlayerId = closest.id;
        }
      }
    }
    events.push({
      type: "scheduled-control-reselection",
      tick: nextTick,
      previousPlayerId: match.control.activePlayerId,
      activePlayerId,
      nearPathPlayerId: nearPath?.id ?? null,
    });
  }
  return {
    ...match,
    control: {
      ...match.control,
      activePlayerId,
      ballTravel,
    },
  };
}

function stepReleasedGoalKickControlHandoff({
  command,
  events,
  match,
  nearPath,
  nextTick,
  sourcePlayers,
}) {
  if (
    match.possession.owner !== 0
    || match.rules.lastBoundaryRestart?.kind !== "goal-kick"
    || match.kickoff.action?.released !== true
    || nearPath === null
    || nearPath.nativeTeamSlot !== match.control.nativeTeamSlot
    || nearPath.role === "keeper"
  ) return match;
  const active = sourcePlayers.find(({ id }) => id === match.control.activePlayerId);
  const sourcePlayer = sourcePlayers.find(({ id }) => id === nearPath.id);
  if (
    active?.role !== "keeper"
    || active.liveShot?.phase !== "shot-released"
    || sourcePlayer === undefined
    || sourcePlayer.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN
    || sourcePlayer.intelligence.count !== 0
    || sourcePlayer.liveContact !== undefined
    || sourcePlayer.livePass !== undefined
    || sourcePlayer.liveShot !== undefined
  ) return match;
  const plan = createFreeBallInterceptPlan(sourcePlayer, match, nextTick, {
    afterTouchInput: {
      x: F32(command.moveX / 127),
      y: F32(command.moveY / 127),
    },
    // INTELL.CPP go_to_path scans this player before reselect_a gives it the
    // local user. It therefore uses the non-automatic, non-user move set and
    // only publishes control after a viable path has been installed.
    automaticMoveSelection: false,
    ballState: match.ball,
    controlled: false,
    incrementRunCountBeforeAction: true,
    userControlIndex: 0,
    userControlled: false,
  });
  if (plan.player === null) return match;
  events.push({
    type: "goal-kick-free-ball-control-handoff",
    tick: nextTick,
    previousPlayerId: active.id,
    activePlayerId: sourcePlayer.id,
    nativePlayerNumber: sourcePlayer.nativePlayerNumber,
  });
  return {
    ...match,
    players: match.players.map((player) => (
      player.id === sourcePlayer.id ? plan.player : player
    )),
    control: {
      ...match.control,
      activePlayerId: sourcePlayer.id,
      burstTimer: 0,
      passCharge: null,
      shotCharge: null,
    },
  };
}

function sourceFrozenAnimationPrediction(players, ballState) {
  if (ballState.limbo.active === 0) return null;
  const bound = players.find(({ nativePlayerNumber }) => (
    nativePlayerNumber === ballState.limbo.player
  ));
  return bound?.liveKeeper?.sourcePrediction
    ?? bound?.liveControlIntercept?.sourcePrediction
    ?? bound?.liveShot?.sourcePrediction
    ?? bound?.livePass?.sourcePrediction
    ?? null;
}

function stepActiveFreeBallJourney(
  match,
  players,
  nextTick,
  command,
  visits,
  nearPath,
  sourcePlayers = match.players,
  sourcePossession = match.possession,
  sourceActivePlayerId = match.control.activePlayerId,
  sourcePredictionState = match.ball,
) {
  const collectorVisit = visits.find(({ interaction }) => interaction === "collect");
  const sourceCollector = collectorVisit === undefined
    ? undefined
    : sourcePlayers.find(({ id }) => id === collectorVisit.playerId);
  const sourceActive = sourceActivePlayerId === null
    ? undefined
    : sourcePlayers.find(({ id }) => id === sourceActivePlayerId);
  const collectorVisitIndex = collectorVisit === undefined
    ? -1
    : visits.findIndex(({ playerId }) => playerId === collectorVisit.playerId);
  const sourceActiveVisitIndex = sourceActive === undefined
    ? -1
    : visits.findIndex(({ playerId }) => playerId === sourceActive.id);
  // Preserve an already-completed loose-ball visit only when the controlled
  // interceptor ran before a later collection. If the collection comes
  // first, user_intelligence retains the busy counter but run_action sees
  // possession and routes through neutral user_run instead of go_to_path.
  const preserveSourceBusyVisit = sourcePossession.owner === 0
    && match.possession.owner !== 0
    && (
      (
        sourceCollector?.intelligence.move === 0
        && sourceCollector.intelligence.count > 0
      )
      || (
        sourceActive?.intelligence.move === 1
        && sourceActive.intelligence.count > 0
        && sourceActiveVisitIndex >= 0
        && sourceActiveVisitIndex < collectorVisitIndex
      )
    );
  if (
    (!preserveSourceBusyVisit && match.possession.owner !== 0)
    || (preserveSourceBusyVisit && sourcePossession.owner !== 0)
  ) return players;
  const activePlayerId = preserveSourceBusyVisit
    ? sourceActivePlayerId
    : match.control.activePlayerId;
  if (activePlayerId === null) return players;
  const active = activePlayerId === sourceActivePlayerId
    ? sourceActive
    : match.players.find(({ id }) => id === activePlayerId);
  if (active === undefined || active.role === "keeper") return players;
  const activeVisit = visits.find(({ playerId }) => playerId === active.id);
  if (
    activeVisit?.interaction === "collect"
    && activeVisit.possession.owner === active.nativePlayerNumber
  ) return players;
  if (
    active.livePendingShot !== undefined
    && active.intelligence.move === 0
  ) {
    // shot_pending outlives the completed KICK_ACT. The retained user keeps
    // its ordinary user_stand/user_run slot; near_path must not turn that
    // first recovered stand into a computer go_to_path intercept.
    return players;
  }
  const passReleaser = players.find(
    (player) => readSourceReleasedPass(player)?.release.tick === nextTick,
  );
  const shotReleaser = players.find((player) => (
    player.liveShot?.release?.tick === nextTick
    || (
      player.liveFirstTimeIntercept?.phase === "released"
      && player.liveFirstTimeIntercept.kind === "shot"
      && player.liveFirstTimeIntercept.release?.tick === nextTick
    )
  ));
  const frozenAnimationPrediction = sourceFrozenAnimationPrediction(
    players,
    match.ball,
  );
  let activeNearPath = nearPath;
  if (passReleaser !== undefined) {
    const activeVisitIndex = visits.findIndex(({ playerId }) => playerId === active.id);
    const releaseVisitIndex = visits.findIndex(
      ({ playerId }) => playerId === passReleaser.id,
    );
    if (activeVisitIndex < 0 || releaseVisitIndex < 0) {
      throw new Error("Same-tick pass interception lost native traversal identity.");
    }
    // A controlled player visited before the releaser cannot react to the
    // release until the next source tick. A later visit sees the free ball.
    if (activeVisitIndex < releaseVisitIndex) return players;
    activeNearPath = selectFreeBallNearPathPlayer(
      {
        ...match,
        // pass_ball calls reselect before the later opposing team has run.
        // Its near-path choice therefore reads the loop-entry positions, not
        // the completed browser team snapshot.
        players: sourcePlayers,
      },
      active.nativeTeamSlot,
      command,
      readSourceReleasedPass(passReleaser).releaseBall,
    );
  }
  if (shotReleaser !== undefined) {
    const activeVisitIndex = visits.findIndex(({ playerId }) => playerId === active.id);
    const releaseVisitIndex = visits.findIndex(
      ({ playerId }) => playerId === shotReleaser.id,
    );
    if (activeVisitIndex < 0 || releaseVisitIndex < 0) {
      throw new Error("Same-tick shot interception lost native traversal identity.");
    }
    // An earlier player cannot react to a shot that has not happened yet.
    // It can still react to a ball that was already loose at tick entry:
    // process_ball built ball_pred_tab before process_teams, and shoot_ball
    // does not rebuild it when the later first-time strike releases.
    if (
      activeVisitIndex < releaseVisitIndex
      && sourcePossession.owner !== 0
    ) return players;
  }
  const activeVisitIndex = visits.findIndex(({ playerId }) => playerId === active.id);
  const shotReleaseVisitIndex = shotReleaser === undefined
    ? -1
    : visits.findIndex(({ playerId }) => playerId === shotReleaser.id);
  const plansAgainstPreReleaseLooseBall = shotReleaser !== undefined
    && sourcePossession.owner === 0
    && activeVisitIndex >= 0
    && activeVisitIndex < shotReleaseVisitIndex;
  const activePlanMatch = plansAgainstPreReleaseLooseBall
    ? {
        ...match,
        ball: sourcePredictionState,
        possession: sourcePossession,
      }
    : match;
  let stepped = null;
  if (active.intelligence.move === 1 && active.intelligence.count > 0) {
    // intelligence expires I_INTERCEPT before free_ball in this same source
    // visit. If the controlled player is still near_path, go_to_path installs
    // and executes the replacement intercept immediately; it does not publish
    // an intermediate neutral stand/new_users frame.
    const replanned = active.intelligence.count === 1
      && activeNearPath?.id === active.id
      ? planFreeBallIntercept(active, activePlanMatch, nextTick, command, {
          // BALL.CPP does not rebuild ball_pred_tab while a keeper punt is
          // animation-bound. The selected user scans the same retained
          // pre-punt table already used by the automatic near-path players.
          frozenShotPrediction:
            plansAgainstPreReleaseLooseBall
              ? null
              : shotReleaser?.liveShot?.sourcePrediction
                ?? frozenAnimationPrediction,
          incrementRunCountBeforeAction: true,
        })
      : null;
    const activeBallPosition = activeVisit?.ballPosition ?? match.ball.ball.position;
    stepped = replanned ?? continueFreeBallIntercept(
      active,
      preserveSourceBusyVisit ? { ...match, possession: sourcePossession } : match,
      nextTick,
      {
        ballPosition: activeBallPosition,
        // ACTIONS.CPP run_action consumes go_cnt=1 and calls
        // init_stand_act in this same controlled visit. reset_ideas clears
        // the still-busy I_INTERCEPT while process_dir turns toward the ball.
        terminalStandBallPosition: active.liveMotion.goCount === 1
          ? activeBallPosition
          : null,
      },
    );
    if (
      active.intelligence.count === 1
      && replanned === null
      && command.moveX === 0
      && command.moveY === 0
      && command.buttons === 0
    ) {
      // user_intelligence expires I_INTERCEPT before run_action. The neutral
      // replacement journey is perpendicular at this source slot, so
      // go_forward applies turn_spd=(1+0)/2 using the old facing and the
      // ordinary user speed before new_users settles the player to stand.
      const speed = actualPlayerSpeed({
        pitchLength: 1280,
        teamRate: active.liveMotion.teamRate,
        speedIntent: CSSOCCER_SPEED_INTENT.normal,
        intentionCount: 0,
        sideStep: false,
        nativePlayer: active.nativePlayerNumber,
        ballPossession: 0,
        ballInHands: false,
        keeperNativePlayers: [1, 12],
        userControlIndex: 1,
        burstTimer: match.control.burstTimer,
      });
      const displacement = {
        x: F32(active.facing.x * 0.5 * speed),
        y: F32(active.facing.y * 0.5 * speed),
      };
      stepped = {
        ...stepped,
        position: {
          ...updateSourcePosition2d({
            position: { x: active.position.x, y: active.position.y },
            displacement,
          }),
          z: active.position.z,
        },
        velocity: { ...displacement, z: F32(0) },
        facing: clone(active.facing),
        liveMotion: {
          ...stepped.liveMotion,
          goCount: 0,
          goDisplacement: clone(displacement),
          sourceNeutralRunVisitComplete: true,
        },
      };
    }
  } else {
    if (activeNearPath?.id === active.id) {
      stepped = planFreeBallIntercept(active, activePlanMatch, nextTick, command, {
        frozenShotPrediction:
          plansAgainstPreReleaseLooseBall
            ? null
            : shotReleaser?.liveShot?.sourcePrediction
              ?? frozenAnimationPrediction,
      });
    }
  }
  if (stepped === null) return players;
  return players.map((player) => player.id === stepped.id ? stepped : player);
}

function stepControlledStandingProcessDirection({
  command,
  gameAction,
  match,
  nextTick,
  players,
  visits,
}) {
  if (match.control.activePlayerId === null) return players;
  const active = players.find(({ id }) => id === match.control.activePlayerId);
  if (active === undefined) {
    throw new Error("Open-play process_dir lost the controlled source player.");
  }
  // The same source visit runs process_dir for a controlled keeper once its
  // released goal-kick animation has recovered to an ordinary stand action.
  const visit = visits.find(({ playerId }) => playerId === active.id);
  if (visit === undefined) {
    throw new Error("Open-play process_dir lost the controlled player's source-order visit.");
  }
  if (
    gameAction !== -1
    && (
      active.action.action.value !== CSSOCCER_NATIVE_ACTIONS.STAND
      || active.liveMotion?.directionMode !== 1
    )
  ) {
    return players;
  }
  if (
    gameAction === -1
    && !new Set([
      CSSOCCER_NATIVE_ACTIONS.STAND,
      CSSOCCER_NATIVE_ACTIONS.RUN,
    ]).has(active.action.action.value)
  ) return players;
  const teamRate = currentTeamRates(
    match.players,
    match.clock.gameMinute,
  ).find(({ id }) => id === active.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error("Open-play process_dir lost the controlled player's current team rate.");
  }
  if (gameAction === -1) {
    const zonal = stepControlledKeeperHoldZonalVisit({
      match,
      nextTick,
      player: active,
      teamRate,
      visit,
    });
    return players.map((player) => player.id === active.id
      ? zonal
      : player);
  }
  const target = {
    x: F32(visit.ballPosition.x - active.position.x),
    y: F32(visit.ballPosition.y - active.position.y),
  };
  if (target.x === 0 && target.y === 0) return players;
  const facing = turnSourceFacing({
    facing: active.facing,
    target,
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians,
  }).facing;
  const userVector = sourceUserVector(active, command);
  const neutralStand = userVector.x === 0
    && userVector.y === 0
    && command.buttons === 0;
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
        ...(neutralStand ? {
          // ACTIONS.CPP user_stand sends a neutral target through
          // init_run_act. The already-there branch re-enters init_stand_act,
          // which clears the stale go vector before player_tussles and then
          // user_stand publishes go_cnt=1.
          target: { x: player.position.x, y: player.position.y, z: player.position.z },
          liveMotion: {
            ...clone(player.liveMotion),
            kind: "stand",
            target: { x: player.position.x, y: player.position.y },
            goCount: 1,
            goDisplacement: { x: F32(0), y: F32(0) },
            directionMode: 1,
            resetAnimationFrame: true,
          },
        } : {}),
      }
    : player);
}

function stepControlledKeeperHoldZonalVisit({
  match,
  nextTick,
  player,
  teamRate,
  visit,
}) {
  const zone = match.kickoff.zoning?.[player.nativeTeamSlot];
  if (zone === undefined) {
    throw new Error("Keeper-hold user action lost the current source zone.");
  }
  const projectZonal = (sourcePlayer) => (
    projectCssoccerFreePlayZonalPlayerVisit({
      allowSideStep: true,
      ballPosition: visit.ballPosition,
      nextTick,
      player: sourcePlayer,
      possession: visit.possession,
      tactics: match.tactics,
      teamRate,
      targetOverride: null,
      zoning: {
        analogue: match.ball.ball.outOfPlay === 0,
        ballZone: zone.ballZone,
        zoneCenter: zone.zoneCenter,
        teamInPossession: visit.possession.lastTouch !== 0 && (
          (player.nativeTeamSlot === "A" && visit.possession.lastTouch < 12)
          || (player.nativeTeamSlot === "B" && visit.possession.lastTouch > 11)
        ),
      },
    })
  );
  if (player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND) {
    const zonal = projectZonal(player);
    return {
      ...zonal,
      liveMotion: {
        ...zonal.liveMotion,
        // user_stand overwrites find_zonal_target's cleared journey count
        // after its immediate go_forward visit.
        goCount: 1,
        sourceGameActionUserVisitTick: nextTick,
      },
    };
  }

  const motion = player.liveMotion;
  let goCount = motion.goCount;
  let displacement = { x: F32(0), y: F32(0) };
  let position = clone(player.position);
  if (goCount > 0) {
    const speed = actualPlayerSpeed({
      pitchLength: 1280,
      teamRate,
      speedIntent: CSSOCCER_SPEED_INTENT.normal,
      intentionCount: 0,
      sideStep: motion.goStep,
      nativePlayer: player.nativePlayerNumber,
      ballPossession: visit.possession.owner,
      ballInHands: visit.possession.inHands !== 0,
      keeperNativePlayers: [1, 12],
      userControlIndex: 1,
      burstTimer: match.control.burstTimer,
    });
    displacement = motion.goStep
      ? clone(motion.goDisplacement)
      : sourceForwardDisplacement({
          facing: player.facing,
          targetOffset: {
            x: F32(motion.target.x - player.position.x),
            y: F32(motion.target.y - player.position.y),
          },
          speed,
        }).displacement;
    position = {
      ...updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement,
      }),
      z: player.position.z,
    };
    goCount -= 1;
  }
  const continued = {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { ...clone(displacement), z: F32(0) },
    liveMotion: {
      ...clone(motion),
      goCount,
      goDisplacement: clone(displacement),
    },
  };
  if (goCount <= 0) {
    const zonal = projectZonal(continued);
    return {
      ...zonal,
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      velocity: {
        x: F32(zonal.position.x - player.position.x),
        y: F32(zonal.position.y - player.position.y),
        z: F32(zonal.position.z - player.position.z),
      },
      liveMotion: {
        ...zonal.liveMotion,
        // find_zonal_target executes its replacement go_forward and clears
        // the freshly installed journey count before process_dir.
        goCount: 0,
        sourceGameActionUserVisitTick: nextTick,
      },
    };
  }
  const facing = turnSourceFacing({
    facing: player.facing,
    target: motion.directionMode === 1
      ? {
          x: F32(visit.ballPosition.x - position.x),
          y: F32(visit.ballPosition.y - position.y),
        }
      : {
          x: F32(motion.target.x - position.x),
          y: F32(motion.target.y - position.y),
        },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians,
  }).facing;
  return {
    ...continued,
    facing,
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: facing.x,
      facingY: facing.y,
    }),
    liveMotion: {
      ...continued.liveMotion,
      sourceGameActionUserVisitTick: nextTick,
    },
  };
}

function sourceGameActionAtPlayerVisit({
  entryGameAction,
  keeperHoldPlayerIds,
  playerId,
  visits,
}) {
  let gameAction = entryGameAction;
  for (const visit of visits) {
    if (visit.playerId === playerId) return gameAction;
    if (keeperHoldPlayerIds.has(visit.playerId)) gameAction = -1;
  }
  return gameAction;
}

function planFreeBallIntercept(
  player,
  match,
  nextTick,
  command,
  {
    frozenShotPrediction = null,
    incrementRunCountBeforeAction = false,
  } = {},
) {
  return createFreeBallInterceptPlan(player, match, nextTick, {
    afterTouchInput: {
      x: F32(command.moveX / 127),
      y: F32(command.moveY / 127),
    },
    automaticMoveSelection: false,
    ballState: match.ball,
    controlled: true,
    controlRequested: (command.buttons & BUTTON_FIRE_2) !== 0,
    frozenShotPrediction,
    incrementRunCountBeforeAction,
    userControlIndex: 1,
    userControlled: true,
  }).player;
}

function createFreeBallInterceptPlan(player, match, nextTick, options) {
  const source = createFreeBallInterceptSourcePlayer(player, match, options);
  const { teamRate } = source;
  const playerHeight = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value;
  const scan = scanCssoccerFreeBallControlIntercept({
    afterTouchInput: options.afterTouchInput,
    ballState: options.ballState,
    frozenShotPrediction: options.frozenShotPrediction ?? null,
    pitchLength: 1280,
    pitchWidth: 800,
    playerHeight,
    player: source.player,
  });
  if (scan.intercept === null) return { player: null, scan };
  const intentionCount = scan.intercept.actionIndex > 0
    ? sourceWatcomFistpI32(
        scan.intercept.travel.ticks
        + scan.intercept.waitTicks
        + scan.intercept.strikeTime,
      ) - 1
    : 33 - Math.trunc(player.gameplay.flair / 4);
  const planned = moveFreeBallInterceptor(player, {
    ballState: match.possession.lastTouch,
    goCount: Math.max(
      0,
      scan.intercept.travel.ticks
        - (
          options.incrementRunCountBeforeAction === true
          || (
            options.incrementRunOnCountBeforeAction === true
            && scan.intercept.actionIndex === 0
          )
            ? 0
            : 1
        ),
    ),
    intelligenceCount: intentionCount,
    nextTick,
    special: scan.intercept.actionIndex > 0 ? 1 : 0,
    target: scan.intercept.target,
    teamRate,
    travel: scan.intercept.travel,
    userControlIndex: options.userControlIndex,
  });
  if (scan.intercept.actionIndex > 0) {
    // INTELL.CPP strike_and_control overwrites tm_ftime with the selected
    // first-touch wait. The ordinary strike[0] run-on branch does not: it
    // only installs RUN and increments go_cnt, so a retained negative
    // hold-ball tween must survive that journey.
    delete planned.sourceHeldBallTween;
  } else if (
    planned.sourceHeldBallTween?.freeTime < -1
    && Math.abs(player.animation.id) === STAND_ANIMATION
  ) {
    // ACTIONS.CPP stand_action refreshes ls_anim/ls_frm from the live stand
    // pose on every visit. Its ball point is below ground, so a later
    // tm_ftime == -2 collection falls back to the collector's current
    // tm_x/tm_y in get_mcball_coords.
    planned.sourceHeldBallTween = {
      ...clone(planned.sourceHeldBallTween),
      zeroHeightCapture: true,
    };
  }
  planned.sourceGlobalInterceptorTick = nextTick;
  return {
    player: scan.intercept.actionIndex === 0
      ? planned
      : {
          ...planned,
          liveControlIntercept: {
            phase: "run",
            phaseTick: nextTick,
            actionIndex: scan.intercept.actionIndex,
            animationId: null,
            contact: null,
            face: clone(scan.intercept.travel.face),
            freeTicks: scan.intercept.waitTicks,
            strikeTime: scan.intercept.strikeTime,
            displacement: { x: F32(0), y: F32(0) },
            frameStep: null,
            waitAnimationId: null,
          },
        },
    scan,
  };
}

function createFreeBallInterceptSourcePlayer(player, match, options) {
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
  return {
    teamRate,
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
      mustFace: options.mustFace ?? null,
      automaticMoveSelection: options.automaticMoveSelection,
      controlRequested: options.controlRequested ?? false,
      controlAttribute: player.gameplay.control,
      flairAttribute: player.gameplay.flair,
      trapState: 0,
    },
  };
}

function sourceComputerReceiverMustFace(player) {
  const centreY = F32(CSSOCCER_BALL_CONSTANTS.pitchWidth / 2);
  const ownGoalX = player.nativeTeamSlot === "A"
    ? F32(0)
    : F32(CSSOCCER_BALL_CONSTANTS.pitchLength);
  const ownGoal = {
    x: F32(ownGoalX - player.position.x),
    y: F32(centreY - player.position.y),
  };
  if (
    sourceDistance2d(ownGoal)
    < CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 30
  ) {
    // decide_on_face only rewrites must_face_x in this branch. The retained
    // native Y component is zero in the qualified full-match fixture.
    return {
      x: F32(player.nativeTeamSlot === "A" ? 1 : -1),
      y: F32(0),
    };
  }
  const opponentGoalX = player.nativeTeamSlot === "A"
    ? F32(CSSOCCER_BALL_CONSTANTS.pitchLength)
    : F32(0);
  const opponentGoal = {
    x: F32(opponentGoalX - player.position.x),
    y: F32(centreY - player.position.y),
  };
  const distance = sourceDistance2d(opponentGoal);
  const shootingRange = (
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 12
    + player.gameplay.power * 3
  );
  return distance < shootingRange
    ? {
        x: F32(opponentGoal.x / distance),
        y: F32(opponentGoal.y / distance),
      }
    : null;
}

function continueFreeBallIntercept(
  player,
  match,
  nextTick,
  {
    ballPosition = match.ball.ball.position,
    terminalStandBusy = false,
    terminalStandBallPosition = null,
  } = {},
) {
  const intelligenceCount = player.intelligence.count - 1;
  if (player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STOP) {
    return continueFreeBallStopIntercept(
      player,
      match,
      nextTick,
      intelligenceCount,
    );
  }
  if (player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN) return null;
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Free-ball continuation lost the rate for ${player.id}.`);
  }
  const continued = player.liveMotion.goStep
    ? continueFreeBallSideStep(player, {
        ballPosition,
        intelligenceCount,
        nextTick,
        teamRate,
      })
    : moveFreeBallInterceptor(player, {
        ballState: player.ballState,
        goCount: Math.max(0, player.liveMotion.goCount - 1),
        intelligenceCount,
        nextTick,
        special: player.intelligence.special,
        target: player.liveMotion.target,
        teamRate,
        userControlIndex: 1,
      });
  if (
    player.liveMotion.goCount === (
      player.liveControlIntercept?.sourceRunCountExact === true ? 1 : 2
    )
    && player.liveControlIntercept?.phase === "run"
  ) {
    // ACTIONS.CPP run_action consumes the final source go_cnt step and then
    // enters init_control_act in the same player visit. Same-visit released
    // receivers retain the post-visit source go_cnt directly; older generic
    // plans keep the historical one-count browser/source offset.
    return beginFreeBallControlWait(player, continued, match, nextTick);
  }
  if (player.liveMotion.goCount === 1 && terminalStandBallPosition !== null) {
    return settleCompletedFreeBallIntercept({
      ballPosition: terminalStandBallPosition,
      continued,
      match,
      nextTick,
      player,
      preserveBusyIntelligence: terminalStandBusy,
    });
  }
  return {
        ...continued,
        liveMotion: {
          ...continued.liveMotion,
          animationFrameStep: player.animation.frameStep,
          ...(player.liveMotion.sourceInterceptRunCountExact === true
            ? { sourceInterceptRunCountExact: true }
            : {}),
        },
  };
}

function continueFreeBallStopIntercept(
  player,
  match,
  nextTick,
  intelligenceCount,
) {
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Free-ball stop continuation lost the rate for ${player.id}.`);
  }
  const targetOffset = {
    x: F32(player.liveMotion.target.x - player.position.x),
    y: F32(player.liveMotion.target.y - player.position.y),
  };
  const motionProfile = projectCssoccerMotionSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const aligned = sourceAngleCosine({
    target: targetOffset,
    facing: player.facing,
  }) > Math.cos(motionProfile.maxTurnRadians);
  if (!aligned) {
    const facing = turnSourceFacing({
      facing: player.facing,
      target: targetOffset,
      maxTurnRadians: motionProfile.maxTurnRadians,
    }).facing;
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      velocity: { x: F32(0), y: F32(0), z: F32(0) },
      facing,
      intelligence: {
        ...clone(player.intelligence),
        count: intelligenceCount,
      },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.STOP,
        facingX: facing.x,
        facingY: facing.y,
      }),
    };
  }
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const travel = sourceGetThereTime({
    position: { x: player.position.x, y: player.position.y },
    target: player.liveMotion.target,
    facing: player.facing,
    speed: sourceFullPlayerSpeed({
      pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
      teamRate,
      celebrating: false,
    }),
    maxTurn2Radians: travelProfile.maxTurn2Radians,
    imThereDistance: travelProfile.imThereDistance,
    canRotateAndRun: false,
    mustFace: null,
  });
  if (travel.ticks <= 0 || travel.ticks >= 2000) {
    throw new Error(
      `Free-ball stop continuation produced an invalid run for ${player.id}.`,
    );
  }
  const goDisplacement = {
    x: F32(targetOffset.x / travel.ticks),
    y: F32(targetOffset.y / travel.ticks),
  };
  const position = {
    ...updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement: goDisplacement,
    }),
    z: player.position.z,
  };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(player.liveMotion.target.x - position.x),
      y: F32(player.liveMotion.target.y - position.y),
    },
    maxTurnRadians: motionProfile.maxTurnRadians,
  }).facing;
  const speed = actualPlayerSpeed({
    pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.intercept,
    intentionCount: intelligenceCount,
    sideStep: false,
    nativePlayer: player.nativePlayerNumber,
    ballPossession: 0,
    ballInHands: false,
    keeperNativePlayers: [1, 12],
    userControlIndex: player.liveMotion.userControlIndex ?? 1,
    burstTimer: 0,
  });
  const frameStep = F32(RUN_FRAME_STEP * (speed / RUN_REFERENCE_SPEED));
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { ...goDisplacement, z: F32(0) },
    facing,
    intelligence: {
      ...clone(player.intelligence),
      count: intelligenceCount,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: "run",
      id: RUN_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      frame: F32(0),
      frameStep,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      ...clone(player.liveMotion),
      kind: "run",
      teamRate,
      target: clone(player.liveMotion.target),
      goStep: false,
      goStop: false,
      goCount: travel.ticks,
      goDisplacement,
      directionMode: 0,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: RUN_ANIMATION,
      animationFrameStep: frameStep,
      sourceAnimationVisitComplete: true,
      userControlIndex: player.liveMotion.userControlIndex ?? 1,
    },
  };
}

function continueFreeBallSideStep(player, {
  ballPosition,
  intelligenceCount,
  nextTick,
  teamRate,
}) {
  const goDisplacement = clone(player.liveMotion.goDisplacement);
  const position = {
    ...updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement: goDisplacement,
    }),
    z: player.position.z,
  };
  const facingTarget = player.liveMotion.directionMode === 1
    ? ballPosition
    : player.liveMotion.target;
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(facingTarget.x - position.x),
      y: F32(facingTarget.y - position.y),
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
    velocity: { ...goDisplacement, z: F32(0) },
    facing,
    intelligence: {
      special: player.intelligence.special,
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
      ...clone(player.liveMotion),
      goCount: Math.max(0, player.liveMotion.goCount - 1),
      goDisplacement,
      userControlIndex: 1,
    },
  };
}

function settleCompletedFreeBallIntercept({
  ballPosition,
  continued,
  match,
  nextTick,
  player,
  preserveBusyIntelligence = false,
}) {
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Completed free-ball intercept lost the rate for ${player.id}.`);
  }
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(ballPosition.x - continued.position.x),
      y: F32(ballPosition.y - continued.position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians,
  }).facing;
  return {
    ...continued,
    ...(continued.sourceHeldBallTween?.freeTime < -1
      ? {
          sourceHeldBallTween: {
            ...clone(continued.sourceHeldBallTween),
            // ACTIONS.CPP init_stand_act stores the completed animation in
            // ls_anim/ls_frm. A completed MC_TROT* side-step has point 23
            // below ground, so BALLINT.CPP get_mcball_coords falls back to
            // the player's current tm_x/tm_y; an ordinary RUN keeps its live
            // foot capture.
            zeroHeightCapture: player.liveMotion.goStep === true,
          },
        }
      : {}),
    facing,
    intelligence: preserveBusyIntelligence
      ? clone(continued.intelligence)
      : { special: 0, move: 0, count: 0 },
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
      ...continued.liveMotion,
      kind: "stand",
      goCount: preserveBusyIntelligence ? 0 : 1,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: 1,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: null,
      animationFrameStep: null,
    },
  };
}

function beginFreeBallControlWait(player, continued, match, nextTick) {
  const control = player.liveControlIntercept;
  const wait = projectCssoccerControlWaitTransition({
    actionIndex: control.actionIndex,
    ballState: match.ball,
    face: control.face,
    freeTicks: control.freeTicks,
    playerPosition: continued.position,
    strikeTime: control.strikeTime,
  });
  if (wait.freeTicks <= 0) {
    return beginFreeBallControlReceive(
      player,
      continued,
      wait,
      match,
      nextTick,
    );
  }
  return materializeFreeBallControlWait(player, continued, wait, nextTick);
}

/** ACTIONS.CPP init_wait_act, including its same-visit first side step. */
function materializeFreeBallControlWait(player, continued, wait, nextTick) {
  const control = player.liveControlIntercept;
  // ACTIONS.CPP init_wait_act requests MC_TROTA when the per-tick correction
  // exceeds half a native position unit, but init_anim dispatches that request
  // through init_trot_anim and selects the directional MC_TROT* capture.
  const sideStepDirection = sourceDistance2d(wait.displacement) > 0.5
    ? sourceSideStepDirection({
        target: continued.target,
        previousPosition: continued.position,
        previousFacing: player.facing,
      })
    : null;
  const waitAnimationId = sideStepDirection === null
    ? STAND_ANIMATION
    : TROT_ANIMATION_BY_DIRECTION[sideStepDirection];
  return {
    ...continued,
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position: clone(wait.position),
    velocity: {
      x: F32(wait.position.x - player.position.x),
      y: F32(wait.position.y - player.position.y),
      z: F32(0),
    },
    facing: clone(player.facing),
    target: clone(player.target),
    intelligence: {
      special: 1,
      move: 1,
      count: wait.freeTicks + 1,
    },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: CONTROL_WAIT_ACTION,
      facingX: player.facing.x,
      facingY: player.facing.y,
    }),
    liveMotion: {
      ...clone(continued.liveMotion),
      kind: "control-wait",
      target: { x: player.target.x, y: player.target.y },
      goStep: true,
      goCount: 0,
      goDisplacement: clone(wait.displacement),
      directionMode: 2,
      resetAnimationFrame: false,
      sideStepDirection,
      animationId: null,
      animationFrameStep: null,
    },
    liveControlIntercept: {
      ...clone(control),
      phase: "wait",
      phaseTick: nextTick,
      animationId: wait.animationId,
      contact: wait.contact,
      freeTicks: wait.freeTicks,
      displacement: clone(wait.displacement),
      waitAnimationId,
    },
  };
}

function moveFreeBallInterceptor(player, {
  ballState,
  goCount,
  intelligenceCount,
  nextTick,
  special,
  target,
  teamRate,
  travel = null,
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
  if (travel?.stopAndFace === true) {
    if (special === 0) {
      return moveOrdinaryFreeBallStopAndFaceInterceptor(player, {
        ballState,
        goCount,
        intelligenceCount,
        nextTick,
        special,
        speed,
        target,
        targetOffset,
        teamRate,
        userControlIndex,
      });
    }
    const motionProfile = projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    );
    const sourceGoCount = travel.ticks - travel.mustFaceTicks;
    const alignment = sourceAngleCosine({
      target: targetOffset,
      facing: player.facing,
    });
    const turnTicks = Math.trunc(
      Math.abs(Math.acos(alignment) / motionProfile.maxTurnRadians),
    );
    const moveTicks = sourceGoCount - turnTicks;
    if (
      sourceGoCount <= 0
      || moveTicks <= 0
    ) {
      throw new Error(
        `Free-ball stop-and-face produced an invalid journey for ${player.id}: `
        + JSON.stringify({
          position: player.position,
          target,
          travel,
          sourceGoCount,
          turnTicks,
          moveTicks,
          goCount,
          intelligenceCount,
          special,
        }),
      );
    }
    const goDisplacement = {
      x: F32(targetOffset.x / moveTicks),
      y: F32(targetOffset.y / moveTicks),
    };
    const mayStart = alignment >= Math.cos(motionProfile.maxTurnRadians);
    const position2d = mayStart
      ? updateSourcePosition2d({
          position: { x: player.position.x, y: player.position.y },
          displacement: goDisplacement,
        })
      : { x: player.position.x, y: player.position.y };
    const position = { ...position2d, z: player.position.z };
    const facing = turnSourceFacing({
      facing: player.facing,
      target: {
        x: F32(target.x - position.x),
        y: F32(target.y - position.y),
      },
      maxTurnRadians: motionProfile.maxTurnRadians,
    }).facing;
    const frameStep = F32(RUN_FRAME_STEP * (speed / RUN_REFERENCE_SPEED));
    return {
      ...clone(player),
      previousPosition: clone(player.position),
      previousFacing: clone(player.facing),
      position,
      velocity: {
        x: mayStart ? goDisplacement.x : F32(0),
        y: mayStart ? goDisplacement.y : F32(0),
        z: F32(0),
      },
      facing,
      target: { x: target.x, y: target.y, z: F32(0) },
      ballState,
      intelligence: { special, move: 1, count: intelligenceCount },
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
        facingX: facing.x,
        facingY: facing.y,
      }),
      animation: {
        status: "browser-current-state",
        kind: mayStart ? "run" : "stand",
        id: mayStart ? RUN_ANIMATION : STAND_ANIMATION,
        sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
        frame: F32(0),
        frameStep: mayStart ? frameStep : STAND_FRAME_STEP,
        pending: null,
        tick: nextTick,
      },
      liveMotion: {
        kind: mayStart ? "run" : "stand",
        teamRate,
        target: { x: target.x, y: target.y },
        goStep: false,
        goStop: !mayStart,
        goCount,
        goDisplacement,
        directionMode: 0,
        resetAnimationFrame: true,
        sideStepDirection: null,
        animationId: mayStart ? RUN_ANIMATION : STAND_ANIMATION,
        animationFrameStep: mayStart ? frameStep : STAND_FRAME_STEP,
        sourceAnimationVisitComplete: true,
        userControlIndex,
      },
    };
  }
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
  const moved = {
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
  const currentAnimation = Math.abs(player.animation.id);
  if (currentAnimation === RUN_ANIMATION) return moved;
  if (
    currentAnimation === BARGE_ANIMATION
    && player.liveContact?.phase === "barge"
    && player.liveContact.bargeCountdown > 0
  ) {
    return moved;
  }
  const frameStep = F32(RUN_FRAME_STEP * (speed / RUN_REFERENCE_SPEED));
  const fromJog = currentAnimation === JOG_ANIMATION;
  return {
    ...moved,
    animation: {
      status: "browser-current-state",
      kind: "run",
      id: RUN_ANIMATION,
      sourceActionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      // process_anims advances MC_JOG before init_run_anim preserves its
      // phase. Every other non-RUN clip is reset to frame zero.
      frame: fromJog
        ? F32(player.animation.frame + player.animation.frameStep + 0.4)
        : F32(0),
      frameStep,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      ...moved.liveMotion,
      resetAnimationFrame: !fromJog,
      animationId: RUN_ANIMATION,
      animationFrameStep: frameStep,
      sourceAnimationVisitComplete: true,
    },
  };
}

function moveOrdinaryFreeBallStopAndFaceInterceptor(player, {
  ballState,
  goCount,
  intelligenceCount,
  nextTick,
  special,
  speed,
  target,
  targetOffset,
  teamRate,
  userControlIndex,
}) {
  const motionProfile = projectCssoccerMotionSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  // strike[0].stop enters init_stop_act. stop_action may initialize RUN in
  // this same visit once the player faces the target; unlike first-time
  // strike_and_control, this ordinary run-on genuinely owns STOP_ACT.
  const travelProfile = projectCssoccerTravelSourceProfile(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    { teamRate },
  );
  const runTravel = sourceGetThereTime({
    position: { x: player.position.x, y: player.position.y },
    target: { x: target.x, y: target.y },
    facing: player.facing,
    speed: sourceFullPlayerSpeed({
      pitchLength: 1280,
      teamRate,
      celebrating: false,
    }),
    maxTurn2Radians: travelProfile.maxTurn2Radians,
    imThereDistance: travelProfile.imThereDistance,
    canRotateAndRun: false,
    mustFace: null,
  });
  if (runTravel.ticks <= 0) {
    throw new Error(
      `Free-ball stop-and-face produced an invalid journey for ${player.id}: `
      + JSON.stringify({
        position: player.position,
        target,
        runTravel,
        goCount,
        intelligenceCount,
        special,
      }),
    );
  }
  const goDisplacement = {
    x: F32(targetOffset.x / runTravel.ticks),
    y: F32(targetOffset.y / runTravel.ticks),
  };
  const mayStart = sourceAngleCosine({
    target: targetOffset,
    facing: player.facing,
  }) > Math.cos(motionProfile.maxTurnRadians);
  const position2d = mayStart
    ? updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement: goDisplacement,
      })
    : { x: player.position.x, y: player.position.y };
  const position = { ...position2d, z: player.position.z };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(target.x - position.x),
      y: F32(target.y - position.y),
    },
    maxTurnRadians: motionProfile.maxTurnRadians,
  }).facing;
  const frameStep = F32(RUN_FRAME_STEP * (speed / RUN_REFERENCE_SPEED));
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: {
      x: mayStart ? goDisplacement.x : F32(0),
      y: mayStart ? goDisplacement.y : F32(0),
      z: F32(0),
    },
    facing,
    target: { x: target.x, y: target.y, z: F32(0) },
    ballState,
    intelligence: { special, move: 1, count: intelligenceCount },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId: mayStart
        ? CSSOCCER_NATIVE_ACTIONS.RUN
        : CSSOCCER_NATIVE_ACTIONS.STOP,
      facingX: facing.x,
      facingY: facing.y,
    }),
    animation: {
      status: "browser-current-state",
      kind: mayStart ? "run" : "stand",
      id: mayStart ? RUN_ANIMATION : STAND_ANIMATION,
      sourceActionId: mayStart
        ? CSSOCCER_NATIVE_ACTIONS.RUN
        : CSSOCCER_NATIVE_ACTIONS.STOP,
      frame: F32(0),
      frameStep: mayStart ? frameStep : STAND_FRAME_STEP,
      pending: null,
      tick: nextTick,
    },
    liveMotion: {
      kind: mayStart ? "run" : "stand",
      teamRate,
      target: { x: target.x, y: target.y },
      goStep: false,
      goStop: !mayStart,
      // INTELL.CPP's ordinary strike[0].stop branch enters init_stop_act,
      // which does not rewrite go_cnt, before go_to_path increments the
      // retained count. The planned intercept travel only becomes go_cnt
      // after stop_action has turned far enough to call init_run_act.
      goCount: mayStart
        ? runTravel.ticks
        : Math.max(1, (player.liveMotion?.goCount ?? 0) + 1),
      goDisplacement,
      directionMode: 0,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: mayStart ? RUN_ANIMATION : STAND_ANIMATION,
      animationFrameStep: mayStart ? frameStep : STAND_FRAME_STEP,
      sourceAnimationVisitComplete: true,
      userControlIndex,
    },
  };
}

function selectFreeBallNearPathPlayer(
  match,
  nativeTeamSlot,
  command,
  predictionBall = match.ball,
) {
  const owner = match.players.find(({ nativePlayerNumber }) => (
    nativePlayerNumber === match.possession.owner
  ));
  const target = projectFreeBallPathMean(predictionBall, command, {
    possessionOwner: match.possession.owner,
    ownerTackling: owner?.action.action.value === TACKLE_ACTION,
  });
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

function projectFreeBallPathMean(ball, command, { possessionOwner, ownerTackling }) {
  const predictions = [clone(ball.ball.position)];
  // BALLINT.CPP predict_ball snapshots only the physical ball globals. It is
  // called directly by USER.CPP reselect after a same-visit release and does
  // not consult ball_limbo_on, even when another player's animation still
  // owns that live limbo marker. Strip only the limbo wrapper from this
  // prediction copy; the match-owned ball remains unchanged.
  let prediction = ball.limbo.active === 0
    ? ball
    : createBallMatchState({
        ...clone(ball),
        limbo: { active: 0, player: 0, contact: F32(0) },
      });
  const afterTouchInput = {
    x: F32(command.moveX / 127),
    y: F32(command.moveY / 127),
  };
  for (let tickOffset = 1; tickOffset <= 40; tickOffset += 1) {
    if (possessionOwner !== 0) {
      const previous = predictions.at(-1);
      const scale = ownerTackling
        ? Math.pow(TACKLE_DECEL, tickOffset - 1)
        : 1;
      predictions.push({
        x: F32(previous.x + (ball.ball.displacement.x * scale)),
        y: F32(previous.y + (ball.ball.displacement.y * scale)),
        z: previous.z,
      });
      continue;
    }
    {
      const predictedBall = stepBallTrajectoryPredictionState(prediction.ball, {
        ...(prediction.ball.afterTouch.user === 0 ? {} : { afterTouchInput }),
      });
      prediction = createBallMatchState({
        ...prediction,
        ball: predictedBall,
      });
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
  let x = F32(command.moveX / 127);
  let y = F32(command.moveY / 127);
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

function selectControlledPlayer({ events, match, nearest, nextTick }) {
  const handoff = events.findLast(({ type }) => type === "pass-control-handoff");
  const withCurrentControl = match.kickoff.phase === "open-play"
    ? {
        ...match,
        control: {
          ...match.control,
          activePlayerId: handoff?.activePlayerId
            ?? match.control.activePlayerId
            ?? nearest.id,
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

function processOfficials(match, {
  events,
  nextTick,
  officialDefensiveLinesFrame,
  playerTeamSourceFrame,
  playerVisitFrame,
  sourceInitialization,
}) {
  const current = processCurrentLiveOffside(match, nextTick, events, {
    officialDefensiveLinesFrame,
    playerTeamSourceFrame,
    playerVisitFrame,
  });
  if (sourceInitialization) return current;
  if (officialDefensiveLinesFrame === null) {
    throw new Error("process_offs lost the player_distances defensive-line frame.");
  }
  const parentBoundOfficials = applyCurrentOfficialParentEvents(current, events);
  const officials = stepCssoccerOfficialState(
    parentBoundOfficials,
    createCurrentOfficialFrame(
      { ...current, officials: parentBoundOfficials },
      officialDefensiveLinesFrame,
    ),
  );
  return { ...current, officials };
}

function applyCurrentOfficialParentEvents(match, events) {
  let officials = match.officials;
  for (const event of events) {
    const kind = currentOfficialParentTransition(match, event);
    if (kind === null) continue;
    officials = applyCssoccerOfficialParentTransition(officials, {
      kind,
      ball: {
        x: match.ball.ball.position.x,
        y: match.ball.ball.position.y,
      },
      centreOwner: kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.centre
        ? match.kickoff.owner.nativeTeamSlot
        : null,
    });
  }
  return officials;
}

function currentOfficialParentTransition(match, event) {
  if (event.type === "centre-restart-initialized" || event.type === "ends-swapped") {
    return CSSOCCER_OFFICIAL_PARENT_TRANSITION.centre;
  }
  if (event.type === "boundary-restart-initialized") {
    if (event.kind === "corner") return CSSOCCER_OFFICIAL_PARENT_TRANSITION.corner;
    if (event.kind === "goal-kick") return CSSOCCER_OFFICIAL_PARENT_TRANSITION.goalKick;
    if (event.kind === "throw-in") return CSSOCCER_OFFICIAL_PARENT_TRANSITION.throwIn;
    throw new Error(`Unsupported official boundary transition ${String(event.kind)}.`);
  }
  if (event.type === "foul-restart-awarded") {
    if (event.kind === "penalty") return CSSOCCER_OFFICIAL_PARENT_TRANSITION.penalty;
    if (event.kind === "direct" || event.kind === "indirect") {
      return CSSOCCER_OFFICIAL_PARENT_TRANSITION.freeKick;
    }
    throw new Error(`Unsupported official foul transition ${String(event.kind)}.`);
  }
  if (
    event.type === "boundary-restart-ready"
    && match.rules.boundary?.descriptor.kind !== "throw-in"
  ) {
    return CSSOCCER_OFFICIAL_PARENT_TRANSITION.setKickReady;
  }
  if (event.type === "foul-restart-ready") {
    return CSSOCCER_OFFICIAL_PARENT_TRANSITION.setKickReady;
  }
  if (
    event.type === "centre-pass-started"
    || event.type === "corner-action-started"
    || event.type === "goal-kick-action-started"
    || event.type === "direct-restart-action-started"
    || event.type === "indirect-restart-action-started"
    || event.type === "penalty-restart-action-started"
  ) {
    return CSSOCCER_OFFICIAL_PARENT_TRANSITION.setKickReleased;
  }
  return null;
}

function createCurrentOfficialFrame(match, defensiveLines) {
  const takerId = match.kickoff.owner?.takerId ?? null;
  const taker = takerId === null
    ? undefined
    : match.players.find(({ id }) => id === takerId);
  return {
    tick: match.officials.tick + 1,
    ball: {
      x: match.ball.ball.position.x,
      y: match.ball.ball.position.y,
    },
    matchMode: match.rules.matchMode,
    lastTouch: match.possession.lastTouch,
    deadBallCount: match.rules.deadBallCount,
    refereeAccuracy: match.rules.state.config.refereeAccuracy,
    kickTaker: taker?.nativePlayerNumber ?? 0,
    // BALLINT.CPP player_distances stores defense_a/defense_b before either
    // go_team call. process_offs consumes those globals after both teams have
    // moved, so they cannot be reconstructed from the published positions.
    defensiveLines: clone(defensiveLines),
    players: [...match.players]
      .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber)
      .map((player) => ({
        id: player.id,
        nativePlayerNumber: player.nativePlayerNumber,
        active: Number(player.active),
        action: player.action.action.value,
        position: {
          x: player.position.x,
          y: player.position.y,
        },
      })),
  };
}

function captureOpenPlayDefensiveLines(players) {
  let teamA = F32(640);
  let teamB = F32(640);
  for (const player of players) {
    if (!player.active) continue;
    if (
      player.nativePlayerNumber > 1
      && player.nativePlayerNumber < 12
      && player.position.x < teamA
    ) {
      teamA = player.position.x;
    } else if (
      player.nativePlayerNumber > 12
      && player.position.x > teamB
    ) {
      teamB = player.position.x;
    }
  }
  // BALLINT.CPP assigns each f32 tm_x through the i32 defense_a/defense_b
  // globals. The promoted values consumed by RULES.CPP therefore already
  // carry C's truncation toward zero.
  return {
    teamA: F32(Math.trunc(teamA)),
    teamB: F32(Math.trunc(teamB)),
  };
}

function processCurrentLiveOffside(match, nextTick, events, {
  officialDefensiveLinesFrame,
  playerTeamSourceFrame,
  playerVisitFrame,
}) {
  const snapshot = match.rules.liveOffside;
  if (snapshot == null) return match;
  const stoppage = (
    // offside_rule guards match_mode and just_scored, but it does not guard
    // ball_out_of_play or ball_in_goal. Once SCORE_WAIT has expired, a shot
    // released from a collected goal ball can still produce an offside kick
    // before the pending goal-ball respot reaches zero.
    match.goal.justScored === 0
    && match.rules.matchMode === 0
    && match.rules.boundary == null
    && match.rules.foulRestart == null
  ) ? null : match.kickoff.phase;
  if (stoppage !== null) {
    const cancelled = resolveCssoccerLiveOffsideSnapshot(snapshot, {
      ballPosition: {
        x: match.ball.ball.position.x,
        y: match.ball.ball.position.y,
      },
      lastTouch: match.possession.lastTouch,
      players: currentLiveOffsidePlayers(match.players),
      refereeStrictness: match.rules.state.config.refereeStrictness,
      stoppage,
    });
    if (cancelled.event !== null) {
      events.push({ tick: nextTick, ...clone(cancelled.event) });
    }
    return {
      ...match,
      rules: { ...match.rules, liveOffside: null },
    };
  }
  const reviewed = reviewCurrentLiveOffsideSourceVisits(match, {
    nextTick,
    officialDefensiveLinesFrame,
    playerTeamSourceFrame,
    playerVisitFrame,
    snapshot,
  });
  match = reviewed.match;
  if (reviewed.status === "pending") return match;
  if (reviewed.status === "clear" || reviewed.status === "cancelled") {
    if (reviewed.event !== null) {
      events.push({ tick: nextTick, ...clone(reviewed.event) });
    }
    return {
      ...match,
      rules: { ...match.rules, liveOffside: null },
    };
  }
  const involvement = reviewed.event;
  const player = match.players.find(({ id }) => id === involvement.playerId);
  if (
    player === undefined
    || !player.active
    || player.nativePlayerNumber !== involvement.nativePlayerNumber
  ) {
    throw new Error("Live offside involvement lost its current active stable player.");
  }
  const incidentPosition = {
    // override/offside_rule runs before intelligence/do_action/process_dir in
    // this player's go_team visit. The final browser player retains that
    // source-entry tm_x/tm_y as previousPosition; init_foul stores them in
    // integer globals.
    x: F32(Math.trunc(player.previousPosition.x)),
    y: F32(Math.trunc(player.previousPosition.y)),
  };
  const awardedNativeTeam = player.nativeTeamSlot === "A" ? "B" : "A";
  // RULES.CPP init_foul clears play_advantage before it processes every new
  // candidate. A same-tick offside involvement therefore supersedes the
  // pending contact advantage instead of attempting to nest a second foul.
  const sourceRuleState = match.rules.state.foul.playAdvantage === 0
    ? match.rules.state
    : {
        ...match.rules.state,
        foul: {
          ...match.rules.state.foul,
          playAdvantage: 0,
          pending: null,
        },
      };
  let routed = resolveCssoccerRuleFoul(sourceRuleState, {
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
    offenderPosition: incidentPosition,
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
    ),
  });
  events.push({
    type: "offside-decision",
    tick: nextTick,
    playerId: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    reason: involvement.reason,
    kickTick: involvement.kickTick,
    incidentPosition: clone(incidentPosition),
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
  const accepted = acceptCurrentFoulRestart({
    ...match,
    rng: { ...match.rng, state: routed.rng },
    rules: {
      ...match.rules,
      state: routed.state,
      liveOffside: null,
    },
  }, routed, nextTick, events);
  return projectSourceOrderedOffsideRestartSuffix({
    accepted,
    involvement,
    nextTick,
    playerTeamSourceFrame,
    playerVisitFrame,
    sourceMatch: match,
  });
}

function reviewCurrentLiveOffsideSourceVisits(match, {
  nextTick,
  officialDefensiveLinesFrame,
  playerTeamSourceFrame,
  playerVisitFrame,
  snapshot,
}) {
  if (
    officialDefensiveLinesFrame === null
    || !Array.isArray(playerTeamSourceFrame)
    || !Array.isArray(playerVisitFrame)
  ) {
    throw new Error("Live offside review lost its source-ordered player frame.");
  }
  const sourceById = new Map(playerTeamSourceFrame.map((player) => [
    player.id,
    player,
  ]));
  const visitIndexById = new Map(playerVisitFrame.map((visit, index) => [
    visit.playerId,
    index,
  ]));
  const passerVisitIndex = visitIndexById.get(snapshot.passerId);
  if (snapshot.kickTick === nextTick && !Number.isSafeInteger(passerVisitIndex)) {
    throw new Error("Live offside release lost the passer's source visit.");
  }

  let ballReleased = snapshot.ballReleased;
  for (
    let processFlagsTick = snapshot.processFlagsTick + 1;
    processFlagsTick <= nextTick;
    processFlagsTick += 1
  ) {
    // FOOTBALL.CPP::process_flags moves the signed release window one tick
    // toward zero before process_teams. A same-tick holder_lose_ball write
    // happens later and therefore must not be decremented here.
    if (ballReleased > 0) ballReleased -= 1;
    else if (ballReleased < 0) ballReleased += 1;
  }

  let offside = match.rules.state.offside;
  for (const candidate of snapshot.candidates) {
    offside = syncCssoccerOffsidePlayerFlag(offside, {
      playerId: candidate.playerId,
      nativePlayerNumber: candidate.nativePlayerNumber,
      tmOff: candidate.tmOff,
    });
  }

  let involvement = null;
  const orderedCandidates = [...snapshot.candidates].sort((left, right) => (
    visitIndexById.get(left.playerId) - visitIndexById.get(right.playerId)
  ));
  for (const candidate of orderedCandidates) {
    const visitIndex = visitIndexById.get(candidate.playerId);
    if (!Number.isSafeInteger(visitIndex)) {
      throw new Error(`Live offside review lost ${candidate.playerId}'s source visit.`);
    }
    if (
      snapshot.kickTick === nextTick
      && visitIndex <= passerVisitIndex
    ) {
      continue;
    }
    const player = sourceById.get(candidate.playerId);
    const visit = playerVisitFrame[visitIndex];
    if (
      player === undefined
      || player.nativePlayerNumber !== candidate.nativePlayerNumber
      || visit.nativePlayerNumber !== candidate.nativePlayerNumber
      || !Number.isSafeInteger(visit[SOURCE_OFFSIDE_VISIT_SEED])
    ) {
      throw new Error(`Live offside review lost ${candidate.playerId}'s source inputs.`);
    }
    const linesman = match.officials.officials[
      candidate.nativePlayerNumber < 12 ? 2 : 1
    ];
    if (linesman === undefined) {
      throw new Error("Live offside review lost its source linesman.");
    }
    const stepped = stepCssoccerOffsidePlayer(offside, {
      playerId: candidate.playerId,
      nativePlayerNumber: candidate.nativePlayerNumber,
      position: {
        x: player.position.x,
        y: player.position.y,
      },
      distanceToBall: visit.distance,
      matchMode: match.rules.matchMode,
      ballPossession: visit.possession.owner,
      ballReleased,
      lastTouch: visit.possession.lastTouch,
      ballPosition: {
        x: visit.ballPosition.x,
        y: visit.ballPosition.y,
      },
      defenseA: officialDefensiveLinesFrame.teamA,
      defenseB: officialDefensiveLinesFrame.teamB,
      canBeOffside: visit.canBeOffside,
      justScored: match.goal.justScored === 0 ? 0 : 1,
      refereeStrictness: match.rules.state.config.refereeStrictness,
      refereeAccuracy: match.rules.state.config.refereeAccuracy,
      linesmanPosition: {
        x: linesman.position.x,
        y: linesman.position.y,
      },
      seed: visit[SOURCE_OFFSIDE_VISIT_SEED],
    });
    offside = stepped.state;
    ballReleased = stepped.ballReleased;
    if (stepped.event === null) continue;
    involvement = {
      type: "offside-involvement",
      reason: ["collect", "hold", "rebound"].includes(visit.interaction)
        ? "candidate-touch"
        : "active-interference",
      kickTick: snapshot.kickTick,
      playerId: candidate.playerId,
      nativePlayerNumber: candidate.nativePlayerNumber,
      incidentPosition: {
        x: player.position.x,
        y: player.position.y,
      },
      distanceToBall: visit.distance,
    };
    break;
  }

  const candidates = snapshot.candidates.map((candidate) => {
    const current = offside.players.find(({ id }) => id === candidate.playerId);
    if (
      current === undefined
      || current.nativePlayerNumber !== candidate.nativePlayerNumber
    ) {
      throw new Error("Live offside review lost its retained candidate flag.");
    }
    return { ...clone(candidate), tmOff: current.tmOff };
  });
  const liveOffside = {
    ...clone(snapshot),
    ballReleased,
    processFlagsTick: nextTick,
    candidates,
  };
  const reviewedMatch = {
    ...match,
    rules: {
      ...match.rules,
      state: {
        ...match.rules.state,
        offside,
      },
      liveOffside,
    },
  };
  if (involvement !== null) {
    return {
      status: "involved",
      match: reviewedMatch,
      event: involvement,
    };
  }

  const changedTouch = match.possession.lastTouch !== 0
    && match.possession.lastTouch !== snapshot.passerNativePlayerNumber;
  if (changedTouch) {
    const candidate = candidates.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === match.possession.lastTouch
    ));
    const toucher = match.players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === match.possession.lastTouch
    ));
    const reason = toucher?.nativeTeamSlot === snapshot.defendingNativeTeam
      ? "defender-touch"
      : candidate === undefined
        ? "onside-teammate-touch"
        : "unseen-candidate-touch";
    return {
      status: "cancelled",
      match: reviewedMatch,
      event: {
        type: "offside-cancelled",
        reason,
        kickTick: snapshot.kickTick,
        passerId: snapshot.passerId,
      },
    };
  }
  if (ballReleased === 0 || candidates.every(({ tmOff }) => tmOff === 0)) {
    return {
      status: "clear",
      match: reviewedMatch,
      event: null,
    };
  }
  return {
    status: "pending",
    match: reviewedMatch,
    event: null,
  };
}

function projectSourceOrderedOffsideRestartSuffix({
  accepted,
  involvement,
  nextTick,
  playerTeamSourceFrame,
  playerVisitFrame,
  sourceMatch,
}) {
  if (
    !Array.isArray(playerTeamSourceFrame)
    || playerTeamSourceFrame.length !== accepted.players.length
    || !Array.isArray(playerVisitFrame)
  ) {
    throw new Error("Live offside restart lost its source-ordered team frame.");
  }
  const offenderVisitIndex = playerVisitFrame.findIndex(
    ({ playerId }) => playerId === involvement.playerId,
  );
  if (offenderVisitIndex < 0) {
    throw new Error("Live offside restart lost the offender's source visit.");
  }
  const suffixIds = new Set(
    playerVisitFrame.slice(offenderVisitIndex).map(({ playerId }) => playerId),
  );
  const sourceById = new Map(playerTeamSourceFrame.map((player) => [
    player.id,
    player,
  ]));
  const rates = new Map(currentTeamRates(
    playerTeamSourceFrame,
    sourceMatch.clock.gameMinute,
  ).map(({ id, value }) => [id, value]));
  const descriptor = accepted.rules.foulRestart?.descriptor;
  if (descriptor?.kind !== "indirect") {
    throw new Error("Live offside restart must materialize an indirect free kick.");
  }
  const tactics = currentFreePlayTacticsState(sourceMatch.tactics);
  const possession = {
    owner: accepted.possession.owner,
    lastTouch: accepted.possession.lastTouch,
    inHands: accepted.possession.inHands,
  };
  const ballPosition = accepted.ball.ball.position;
  const takerPlacement = materializeCssoccerFoulTakerPlacement(
    descriptor,
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.besideBall.value,
  );
  const pendingShot = sourceMatch.players.find((candidate) => (
    ["punt-released", "shot-released"].includes(candidate.liveShot?.phase)
    || candidate.livePendingShot !== undefined
  ));
  const pendingRelease = pendingShot?.liveShot ?? pendingShot?.livePendingShot;
  const visitIndexByNative = new Map(playerVisitFrame.map((visit, index) => [
    visit.nativePlayerNumber,
    index,
  ]));
  const resetPlayers = accepted.players.map(resetSourceMatchModeIdeas);
  const resetById = new Map(resetPlayers.map((player) => [player.id, player]));
  const players = resetPlayers.map((current) => {
    if (!suffixIds.has(current.id)) return current;
    const source = sourceById.get(current.id);
    const teamRate = rates.get(current.id);
    if (source === undefined || !Number.isSafeInteger(teamRate)) {
      throw new Error(`Live offside suffix lost ${current.id}'s source state.`);
    }
    const resetInterceptRun = (
      source.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
      && source.intelligence.move === 1
      && source.intelligence.count > 0
    );
    if (
      source.role === "keeper"
      && source.liveKeeper?.phase === "recover"
      && current.intelligence.count === 0
    ) {
      // An offside awarded by the first team can reset I_GET_UP before the
      // second team's keeper visit. stand_action then replaces MC_STOS* with
      // MC_STAND in that same suffix visit while retaining the old direction.
      return continueKeeperGroundRecovery({
        ballPosition,
        keeper: current,
        nextTick,
        possession,
      });
    }
    if (
      !source.active
      || source.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN
      || source.intelligence.count !== 0
        && !resetInterceptRun
      || !["run", "side-step", "stand"].includes(source.liveMotion?.kind)
      || source.liveContact !== undefined
      || source.liveControlIntercept !== undefined
      || source.liveFirstTimeIntercept !== undefined
        && !resetInterceptRun
      || source.liveKeeper !== undefined
      || source.livePass !== undefined
      || source.liveRestart !== undefined
      || source.liveShot !== undefined
    ) return current;
    const visitSource = resetInterceptRun
      ? advanceSourceOffsideResetInterceptRun(source, teamRate, possession)
      : {
          ...clone(source),
          intelligence: clone(resetById.get(source.id).intelligence),
        };
    const zone = sourceMatch.kickoff.zoning?.[source.nativeTeamSlot];
    if (zone === undefined) {
      throw new Error(`Live offside suffix lost ${source.id}'s persistent ball zone.`);
    }
    const teamInPossession = possession.lastTouch !== 0 && (
      (source.nativeTeamSlot === "A" && possession.lastTouch < 12)
      || (source.nativeTeamSlot === "B" && possession.lastTouch > 11)
    );
    const zonal = source.role === "keeper"
      ? null
      : resolveCssoccerZonalTarget(tactics, {
          nativeTeamSlot: source.nativeTeamSlot,
          nativePlayerNumber: source.nativePlayerNumber,
          ballZone: zone.ballZone,
          zoneCenter: zone.zoneCenter,
          teamInPossession,
          pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
          pitchWidth: CSSOCCER_BALL_CONSTANTS.pitchWidth,
          analogue: sourceMatch.kickoff.zoning.analogue
            && accepted.ball.ball.outOfPlay === 0,
          ballPosition,
        });
    let target = source.role === "keeper"
      ? {
          x: visitSource.position.x,
          y: visitSource.position.y,
        }
      : zonal.target;
    if (source.role !== "keeper"
      && source.nativePlayerNumber === descriptor.taker.nativePlayerNumber) {
      target = takerPlacement;
    } else if (source.role !== "keeper") {
      target = currentTenYardTarget(
        target,
        descriptor.ballPosition,
        source.nativeTeamSlot,
        visitSource.position,
        zonal.source,
      );
    }
    const projected = projectCssoccerFreePlayZonalPlayerVisit({
      allowSideStep: true,
      ballPosition,
      nextTick,
      player: visitSource,
      possession,
      tactics: sourceMatch.tactics,
      teamRate,
      targetOverride: target,
      zoning: {
        analogue: false,
        ballZone: zone.ballZone,
        zoneCenter: clone(zone.zoneCenter),
        teamInPossession,
      },
    });
    const keeperWaitsForShot = source.role === "keeper"
      && pendingShot !== undefined
      && accepted.possession.owner === 0
      && (
        (
          source.nativePlayerNumber === 1
          && accepted.ball.ball.position.x < CSSOCCER_BALL_CONSTANTS.pitchLength / 2
        )
        || (
          source.nativePlayerNumber === 12
          && accepted.ball.ball.position.x > CSSOCCER_BALL_CONSTANTS.pitchLength / 2
        )
      );
    const shotReleasedAfterKeeperVisit = keeperWaitsForShot
      && pendingRelease?.release?.tick === nextTick
      && visitIndexByNative.get(source.nativePlayerNumber)
        < visitIndexByNative.get(pendingShot.nativePlayerNumber);
    const preservesKeeperStandPhase = source.role === "keeper"
      && source.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
      && projected.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
      && keeperWaitsForShot
      && !shotReleasedAfterKeeperVisit;
    return {
      ...projected,
      // find_zonal_target executes one go_forward immediately, then clears
      // go_cnt before this same RUN_ACT/STAND_ACT visit reaches process_dir.
      liveMotion: {
        ...projected.liveMotion,
        goCount: 0,
        // A keeper already standing on this target only reaches process_dir:
        // preserve the clip that process_anims advanced at visit entry.
        resetAnimationFrame: preservesKeeperStandPhase
          ? false
          : projected.liveMotion.resetAnimationFrame,
      },
    };
  });
  return { ...accepted, players };
}

function advanceSourceOffsideResetInterceptRun(source, teamRate, possession) {
  // RULES.CPP init_match_mode calls reset_all_ideas from the offender's
  // override slot. reset_ideas clears tm_strike/I_INTERCEPT and forces an
  // existing RUN_ACT journey to one final step. The same run_action then
  // consumes that step before find_zonal_target installs and executes the
  // restart journey. go_forward must still honor go_stop: a player who has
  // not faced the old target waits instead of taking that final step.
  const motion = source.liveMotion;
  const speed = actualPlayerSpeed({
    pitchLength: CSSOCCER_BALL_CONSTANTS.pitchLength,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: motion.goStep,
    nativePlayer: source.nativePlayerNumber,
    ballPossession: possession.owner,
    ballInHands: possession.inHands !== 0,
    keeperNativePlayers: [1, 12],
    userControlIndex: 0,
    burstTimer: 0,
  });
  let goStop = motion.goStop === true;
  let displacement;
  if (motion.goStep) {
    displacement = clone(motion.goDisplacement);
  } else if (goStop) {
    const maxTurnRadians = projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians;
    const startsMoving = sourceAngleCosine({
      target: motion.goDisplacement,
      facing: source.facing,
    }) >= Math.cos(maxTurnRadians);
    displacement = startsMoving
      ? clone(motion.goDisplacement)
      : { x: F32(0), y: F32(0) };
    goStop = !startsMoving;
  } else {
    displacement = sourceForwardDisplacement({
      facing: source.facing,
      targetOffset: {
        x: F32(motion.target.x - source.position.x),
        y: F32(motion.target.y - source.position.y),
      },
      speed,
    }).displacement;
  }
  const player = clone(source);
  player.previousPosition = clone(source.position);
  player.position = {
    ...updateSourcePosition2d({
      position: { x: source.position.x, y: source.position.y },
      displacement,
    }),
    z: source.position.z,
  };
  player.velocity = { ...clone(displacement), z: F32(0) };
  player.intelligence = { special: 0, move: 0, count: 0 };
  player.liveMotion = {
    ...clone(motion),
    goStop,
    goCount: 0,
    goDisplacement: clone(displacement),
  };
  delete player.liveFirstTimeIntercept;
  delete player.passReceiverIntercept;
  delete player.passReleaseTick;
  delete player.sourceGlobalInterceptorTick;
  return player;
}

function resetSourceMatchModeIdeas(player) {
  const resetIntelligence = !(
    player.intelligence.count === 0
    && player.intelligence.move !== RUN_ON_INTELLIGENCE_MOVE
    && player.intelligence.special === 0
  );
  const resetControlIntercept = player.liveControlIntercept !== undefined
    && !["wait", "control", "tween"].includes(player.liveControlIntercept.phase);
  const resetFirstTimeIntercept = player.liveFirstTimeIntercept !== undefined
    && !["wait", "strike", "released"].includes(
      player.liveFirstTimeIntercept.phase,
    );
  if (
    !resetIntelligence
    && !resetControlIntercept
    && !resetFirstTimeIntercept
    && player.sourceGlobalInterceptorTick === undefined
  ) return player;
  const reset = clone(player);
  const resetInterceptRun = (
    player.intelligence.move === 1
    && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
  );
  reset.intelligence = {
    special: 0,
    move: player.intelligence.count !== 0
      || player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
      ? 0
      : player.intelligence.move,
    count: player.intelligence.count !== 0
      || player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
      ? 0
      : player.intelligence.count,
  };
  if (resetInterceptRun && reset.liveMotion !== undefined) {
    // reset_ideas forces a live I_INTERCEPT/RUN_ACT path to one final
    // journey step. Players already visited before the foul consume it on
    // the following tick before find_zonal_target installs the restart run.
    reset.liveMotion.goCount = 1;
  }
  // INTELL.CPP reset_ideas clears tm_strike and I_INTERCEPT. Browser run,
  // must-face, and cancelled markers model that pending idea and must not
  // survive init_match_mode. WAIT/CONTROL/STRIKE are already physical
  // do_action states, while tween models the separate negative tm_ftime
  // hold-ball state, so those continuations remain source-owned.
  if (resetControlIntercept) delete reset.liveControlIntercept;
  if (resetFirstTimeIntercept) delete reset.liveFirstTimeIntercept;
  delete reset.sourceGlobalInterceptorTick;
  return reset;
}

function processAnimations(
  match,
  {
    centrePassContactFrame,
    centrePassPlayerFrame,
    centrePassReceiverFrame,
    command,
    events,
    nearest,
    nextTick,
    playerDistanceFrame,
    playerVisitFrame,
    sourceInitialization,
  },
) {
  if (sourceInitialization) return match;
  if (match.clock.terminal) return match;
  if (match.goal.phase === "celebration") return match;
  if (match.kickoff.phase === "boundary-delay") return match;
  if (match.kickoff.phase === "kick-action") {
    return stepCentrePassAnimation(
      match,
      nextTick,
      events,
      centrePassContactFrame,
      centrePassPlayerFrame,
      centrePassReceiverFrame,
      nearest,
      command,
      playerDistanceFrame,
    );
  }
  const positioning = match.kickoff.phase === "centre-positioning"
    || match.kickoff.phase === "boundary-positioning"
    || match.kickoff.phase === "rule-positioning";
  const motionById = positioning
    ? new Map(match.kickoff.motion.players.map((player) => [player.id, player]))
    : new Map();
  const visitByPlayerId = new Map(
    (playerVisitFrame ?? []).map((visit) => [visit.playerId, visit]),
  );
  let recoveredCentreTaker = false;
  let centreTakerFrame = null;
  let recoveredOpenPlayTaker = false;
  const players = match.players.map((player) => {
    // ACTIONS.CPP go_team guards process_anims with guy_on. A dismissal can
    // clear the offender during RULES.CPP before this browser stage runs, so
    // retain the stable slot without inventing another animation visit.
    if (!player.active) return clone(player);
    if (player.liveRestart !== undefined) {
      return stepCurrentBoundaryRestartAnimation(player, match, nextTick);
    }
    if (player.sourceKeeperStandTick === nextTick) {
      const settled = clone(player);
      delete settled.sourceKeeperStandTick;
      return settled;
    }
    if (player.liveKeeper !== undefined) return clone(player);
    if (
      player.liveControlIntercept !== undefined
      && (
        player.liveControlIntercept.phase === "wait"
        || player.liveControlIntercept.phase === "control"
      )
    ) {
      return stepOpenPlayControlInterceptAnimation(player, match, nextTick);
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
    if (player.liveContact !== undefined) {
      return stepOpenPlayContactAnimation(player, match, nextTick);
    }
    if (player.liveFirstTimeIntercept !== undefined) {
      if (player.liveFirstTimeIntercept.phaseTick === nextTick) return clone(player);
      if (player.liveFirstTimeIntercept.phase === "wait") {
        return {
          ...clone(player),
          animation: {
            ...clone(player.animation),
            frame: F32(player.animation.frame + player.animation.frameStep),
            tick: nextTick,
          },
        };
      }
      if (
        player.liveFirstTimeIntercept.phase !== "strike"
        && player.liveFirstTimeIntercept.phase !== "released"
      ) {
        return stepLocomotionAnimation(
          player,
          player.liveMotion,
          match.possession,
          nextTick,
        );
      }
      return stepSourceFirstTimeChipAnimation(player, match, nextTick);
    }
    if (player.livePass !== undefined || player.liveShot !== undefined) {
      const sourceVisit = visitByPlayerId.get(player.id);
      const stepped = stepOpenPlayKickAnimation(
        player,
        match,
        nextTick,
        sourceVisit?.ballPosition ?? match.ball.ball.position,
        sourceVisit?.possession ?? match.possession,
      );
      recoveredOpenPlayTaker = recoveredOpenPlayTaker || (
        match.kickoff.phase === "open-play"
        && match.kickoff.action?.released === true
        && match.kickoff.action.recovered !== true
        && player.id === match.kickoff.action.takerId
        && stepped.livePass === undefined
        && stepped.liveShot === undefined
      );
      return stepped;
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
    const motion = (
      player.liveMotion?.kind === "socks"
      || player.liveMotion?.kind === "socks-wait"
    )
      ? player.liveMotion
      : positioning && retainsPostGoalCentreJourney(player)
      ? player.liveMotion
      : positioning
      ? motionById.get(player.id)
      : player.liveMotion;
    if (motion === undefined) {
      throw new Error(`Animation processing lost current motion for ${player.id}.`);
    }
    return stepLocomotionAnimation(player, motion, match.possession, nextTick);
  });
  let kickoff = match.kickoff;
  if (centreTakerFrame !== null) {
    kickoff = {
      ...match.kickoff,
      action: {
        ...match.kickoff.action,
        frame: centreTakerFrame,
        recovered: recoveredCentreTaker,
      },
    };
  } else if (recoveredOpenPlayTaker) {
    kickoff = {
      ...match.kickoff,
      action: {
        ...match.kickoff.action,
        recovered: true,
      },
    };
  }
  const animated = {
    ...match,
    players,
    kickoff,
  };
  return animated;
}

function stepOpenPlayControlInterceptAnimation(player, match, nextTick) {
  const control = player.liveControlIntercept;
  if (control.phase === "wait") {
    const speed = actualPlayerSpeed({
      pitchLength: 1280,
      teamRate: player.liveMotion.teamRate,
      speedIntent: CSSOCCER_SPEED_INTENT.intercept,
      intentionCount: player.intelligence.count,
      sideStep: true,
      nativePlayer: player.nativePlayerNumber,
      ballPossession: match.possession.owner,
      ballInHands: match.possession.inHands !== 0,
      keeperNativePlayers: [1, 12],
      userControlIndex: 0,
      burstTimer: 0,
    });
    const frameStep = control.waitAnimationId === STAND_ANIMATION
      ? STAND_FRAME_STEP
      : F32(speed * SIDE_STEP_FRAME_STEP / 2);
    return {
      ...clone(player),
      animation: {
        status: "browser-current-state",
        kind: "control-wait",
        id: control.waitAnimationId,
        sourceActionId: CONTROL_WAIT_ACTION,
        frame: control.phaseTick === nextTick
          ? F32(0)
          : F32(player.animation.frame + player.animation.frameStep),
        frameStep,
        pending: null,
        tick: nextTick,
      },
    };
  }
  if (control.phase !== "control" || !Number.isFinite(control.frameStep)) {
    throw new Error(`Unsupported control-intercept phase for ${player.id}.`);
  }
  return {
    ...clone(player),
    animation: {
      status: "browser-current-state",
      kind: "control",
      id: control.animationId,
      sourceActionId: CONTROL_RECEIVE_ACTION,
      frame: control.phaseTick === nextTick
        ? F32(control.frameStep + 0.01)
        : control.contactTick === nextTick
          ? F32(player.animation.frame + control.contactFrameStep)
          : F32(player.animation.frame + player.animation.frameStep),
      frameStep: control.frameStep,
      pending: null,
      tick: nextTick,
    },
  };
}

function stepCurrentBoundaryRestartAnimation(player, match, nextTick) {
  const restart = player.liveRestart;
  if (
    restart.phase === "set-piece-ready"
    || restart.phase === "set-piece-charged"
  ) {
    return stepLocomotionAnimation(player, player.liveMotion, match.possession, nextTick);
  }
  if (restart.phase === "set-piece-runup") {
    if (restart.startTick >= nextTick) return clone(player);
    return stepLocomotionAnimation(player, player.liveMotion, match.possession, nextTick);
  }
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
  if (contact.phase === "barge" && contact.bargeCountdown === 0) {
    // process_anims ends MC_BARGE by reinstalling the current locomotion
    // animation; it does not recover the still-running player to MC_STAND.
    const recovered = clone(player);
    delete recovered.liveContact;
    // A same-visit journey update may already have installed MC_RUN while
    // retaining MC_BARGE's cached step. init_run_anim always recomputes the
    // RUN step from actual_spd when the barge counter expires.
    recovered.liveMotion.animationFrameStep = null;
    const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
      .find(({ id }) => id === player.id)?.value;
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Barge recovery lost the current rate for ${player.id}.`);
    }
    return stepLocomotionAnimation(
      recovered,
      { ...recovered.liveMotion, teamRate },
      match.possession,
      nextTick,
    );
  }
  if (
    contact.phase === "barge"
    && (
      player.animation.kind !== "barge"
      || player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.RUN
      || player.liveMotion?.kind === "side-step"
      || player.liveMotion?.goStep === true
    )
  ) {
    // barge_tm remains live on a shoved player independently of tm_anim.
    // Continue the newly installed stand/run/trot animation unless this
    // player is still playing MC_BARGE as RUN_ACT. init_run_act may install
    // a side-step while the independent barge timer survives.
    return stepLocomotionAnimation(
      player,
      player.liveMotion,
      match.possession,
      nextTick,
    );
  }
  if (contact.phase === "fall" && contact.goCount === 1) {
    const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
      .find(({ id }) => id === player.id)?.value;
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`Contact get-up lost the current rate for ${player.id}.`);
    }
    const frameStep = F32(
      // fall_action initializes MC_GETUPF from the current tm_rate. The fall
      // journey can retain older motion constants across a minute or injury
      // boundary, but player_stamina owns this animation scale independently.
      GET_UP_FRONT_FRAME_STEP * F32((teamRate + 128) / 128),
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

function stepSourceFirstTimeChipAnimation(player, match, nextTick) {
  const firstTime = player.liveFirstTimeIntercept;
  if (
    firstTime.phase !== "strike"
    && firstTime.phase !== "released"
  ) {
    throw new Error(`First-time chip animation lost ${player.id}'s strike phase.`);
  }
  const frame = F32(player.animation.frame + player.animation.frameStep);
  const nextFrameStep = firstTime.phase === "released"
    && Number.isFinite(firstTime.standardFrameStep)
    ? firstTime.standardFrameStep
    : player.animation.frameStep;
  if (F32(frame + nextFrameStep) >= 1) {
    const recovered = clone(player);
    delete recovered.liveFirstTimeIntercept;
    if (firstTime.phase === "released" && firstTime.kind === "shot") {
      // strike_action can finish while BALL.CPP shot_pending remains live.
      // Retain the released-shot global after the first-time animation just
      // as an ordinary completed KICK_ACT does, until reset_shot clears it.
      recovered.livePendingShot = clone(firstTime);
    }
    const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
      .find(({ id }) => id === player.id)?.value;
    if (!Number.isSafeInteger(teamRate)) {
      throw new Error(`First-time chip recovery lost ${player.id}'s current rate.`);
    }
    const facing = turnSourceFacing({
      facing: player.facing,
      target: {
        x: F32(match.ball.ball.position.x - player.position.x),
        y: F32(match.ball.ball.position.y - player.position.y),
      },
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate },
      ).maxTurnRadians,
    }).facing;
    return {
      ...recovered,
      sourceHeldBallTween: {
        freeTime: -2,
        // strike_action retains MC_CHIPL and its terminal frame in
        // ls_anim/ls_frm before installing STAND. Point 23 is below ground
        // at that capture, so get_mcball_coords falls back to tm_x/tm_y.
        zeroHeightCapture: true,
      },
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
        teamRate,
        target: clone(match.ball.ball.position),
        goStep: false,
        goCount: 0,
        goDisplacement: { x: F32(0), y: F32(0) },
        directionMode: 1,
        resetAnimationFrame: true,
        sideStepDirection: null,
        animationId: STAND_ANIMATION,
        animationFrameStep: STAND_FRAME_STEP,
      },
    };
  }
  const displacement = frame >= firstTime.contact
    ? {
        x: F32(player.liveMotion.goDisplacement.x * FIRST_TIME_STRIKE_DECEL),
        y: F32(player.liveMotion.goDisplacement.y * FIRST_TIME_STRIKE_DECEL),
      }
    : clone(player.liveMotion.goDisplacement);
  const position = {
    ...updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement,
    }),
    z: player.position.z,
  };
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { ...displacement, z: F32(0) },
    intelligence: {
      ...(firstTime.phase === "released"
        ? { special: 0, move: 0, count: 0 }
        : {
            ...clone(player.intelligence),
            count: Math.max(0, player.intelligence.count - 1),
          }),
    },
    animation: {
      ...clone(player.animation),
      frame,
      frameStep: nextFrameStep,
      pending: frame >= firstTime.contact ? null : "contact",
      tick: nextTick,
    },
    liveMotion: {
      ...clone(player.liveMotion),
      goDisplacement: displacement,
      animationFrameStep: nextFrameStep,
    },
  };
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

function stepOpenPlayKickAnimation(
  player,
  match,
  nextTick,
  sourceVisitBallPosition = match.ball.ball.position,
  sourceVisitPossession = match.possession,
) {
  const kick = player.livePass ?? player.liveShot;
  const phases = player.livePass === undefined
    ? new Set(["kick-held", "punt-released", "shot-released"])
    : new Set(["air-pass", "ground-pass", "kick-held"]);
  if (
    player.action.action.value !== CSSOCCER_NATIVE_ACTIONS.KICK
    || !phases.has(kick.phase)
  ) {
    throw new Error(
      `Open-play kick continuation lost the active kick for ${player.id}`
        + ` (action ${player.action.action.value}, phase ${kick.phase}),`
        + ` motion ${player.liveMotion?.kind}, animation ${player.animation.kind},`
        + ` intelligence ${player.intelligence.move}/${player.intelligence.count}.`,
    );
  }
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error(`Open-play kick continuation lost the current rate for ${player.id}.`);
  }
  if (
    kick.phase === "kick-held"
    && sourceVisitPossession.owner !== player.nativePlayerNumber
    && player.animation.frame < kick.contact
  ) {
    const facing = turnSourceFacing({
      facing: player.facing,
      target: {
        x: F32(sourceVisitBallPosition.x - player.position.x),
        y: F32(sourceVisitBallPosition.y - player.position.y),
      },
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate },
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
        teamRate,
        // init_stand_act resets only the displacement and direction mode.
        // The old kick target/count remain published in teams[].
        target: clone(player.liveMotion.target),
        goStep: player.liveMotion.goStep,
        goCount: player.liveMotion.goCount,
        goDisplacement: { x: F32(0), y: F32(0) },
        directionMode: 1,
        resetAnimationFrame: true,
        sideStepDirection: null,
        animationId: null,
        animationFrameStep: null,
      },
    };
  }
  const animationFrame = F32(player.animation.frame + player.animation.frameStep);
  if (F32(animationFrame + player.animation.frameStep) >= 1) {
    const target = {
      x: F32(sourceVisitBallPosition.x - player.position.x),
      y: F32(sourceVisitBallPosition.y - player.position.y),
    };
    const facing = turnSourceFacing({
      facing: player.facing,
      target,
      maxTurnRadians: projectCssoccerMotionSourceProfile(
        CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        { teamRate },
      ).maxTurnRadians,
    }).facing;
    const recovered = clone(player);
    if (
      player.liveShot !== undefined
      && ["punt-released", "shot-released"].includes(player.liveShot.phase)
    ) {
      recovered.livePendingShot = clone(player.liveShot);
    }
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
        teamRate,
        target: clone(sourceVisitBallPosition),
        // ACTIONS.CPP init_stand_act leaves go_step untouched. The retained
        // flag is consumed by a later find_zonal_target when it decides the
        // one-visit STEP_RANGE/side-step branch (notably after keeper kicks).
        goStep: player.liveMotion.goStep,
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
  const facing = player.liveMotion.directionMode === 2
    ? clone(player.facing)
    : turnSourceFacing({
        facing: player.facing,
        target: {
          x: F32(kick.goTarget.x - position.x),
          y: F32(kick.goTarget.y - position.y),
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
  clockAdvances,
  events,
  nextTick,
  sourceInitialization,
}) {
  const clockStep = stepCssoccerClockState(match.clock, {
    clockAdvances,
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

function completeOpeningClockPeriod(match, { events, nextTick }) {
  const clockStep = completeCssoccerExpiredPeriod(match.clock);
  let current = { ...match, clock: clockStep.state };
  events.push(...clockStep.events.map(clone));
  if (clockStep.events.some(({ type }) => type === "halftime-whistle")) {
    current = enterCurrentHalftimeHold(current, nextTick);
  }
  if (clockStep.events.some(({ type }) => type === "full-time")) {
    current = enterCurrentFullTime(current, nextTick);
  }
  return current;
}

function currentLifecycleClockAdvances(match) {
  if (currentLifecycleSuspendsGameplay(match)) return false;
  // RULES.CPP match_clock advances only in normal play, outside a stopped
  // clock or the post-goal countdown. This runtime does not enter penalty_game;
  // `running` owns its source stop_clock equivalent.
  return match.clock.running
    && match.rules.matchMode === 0
    // BALL.CPP assigns bounds_rules() to match_mode during process_ball.
    // The browser materializes that mode in processRules, so the crossing
    // frame must use the already-published out-of-play counter as the same
    // match_clock entry guard. A scored ball is different: it retains
    // out_of_play with match_mode=0, so match_clock resumes on the exact visit
    // where process_ball decrements just_scored to zero.
    && (
      match.ball.ball.outOfPlay === 0
      || match.ball.outcome?.kind === "goal"
    )
    && match.goal.justScored === 0;
}

function currentLifecyclePeriodReady(match) {
  // FOOTBALL.CPP nothing_happening accepts the tick where SCORE_WAIT reaches
  // zero even though BALL.CPP still owns the scored ball. watch_match_time
  // then routes SWAP_ENDS/init_swap_ends instead of the ordinary goal respot.
  if (
    match.clock.periodExpired
    && match.goal.phase === "awaiting-post-goal-handoff"
    && match.goal.justScored === 0
    && match.rules.matchMode === 0
    && match.rules.deadBallCount === 0
    && match.rules.gameAction === 0
  ) return true;
  // FOOTBALL.CPP nothing_happening treats centre, goal-kick, throw-in, and
  // non-wall free-kick modes as safe whistle boundaries. A centre restart is
  // therefore allowed to terminate the match even though game_action and the
  // dead-ball counter remain active.
  const matchMode = match.rules.matchMode;
  if (
    matchMode > CSSOCCER_MATCH_MODE.CORNER_BR
    && matchMode < CSSOCCER_MATCH_MODE.PEN_KICK_A
  ) {
    const directKickWithWall = (
      matchMode === CSSOCCER_MATCH_MODE.DF_KICK_A
      || matchMode === CSSOCCER_MATCH_MODE.DF_KICK_B
    ) && (match.rules.foulRestart?.wall?.members?.length ?? 0) > 0;
    return !directKickWithWall;
  }
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
    || player.livePendingShot !== undefined
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
  const ball = currentLifecycleSwapEndsBall(match, nextTick);
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
      state: clearCssoccerRuleRestart(match.rules.state),
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
      ballStatus: "halftime-dead-ball",
      pendingAction: null,
      action: null,
      launch: null,
    },
  };
}

function enterCurrentSecondHalfCentre(match, nextTick) {
  const goal = match.goal.phase === "awaiting-post-goal-handoff"
    ? resumeCssoccerCurrentGoalAfterPeriodTransition(match.goal, { score: match.score })
    : match.goal;
  const teams = match.teams.map((team) => ({
    ...clone(team),
    nativeTeamSlot: team.nativeTeamSlot === "A" ? "B" : "A",
    nativeUserToken: team.nativeUserToken === -1 ? -2 : -1,
  }));
  // RULES.CPP swap_teams memcpy-swaps the live match_player structs and only
  // rewrites their physical tm_player slots. Preserve the current locomotion
  // and animation here; this tick's process_teams/process_anims visits decide
  // individually whether a new centre run resets the frame.
  const remappedPlayers = match.players.map((player) => ({
    ...clone(player),
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
    goal,
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
  // init_centre rewrites ball_zone1/2 to 68/69 after reset_ball but retains
  // the existing zone1/2 centres. swap_teams does not mirror or exchange
  // those source globals.
  const zoning = createCssoccerZoneState({
    A: {
      ballZone: 68,
      zoneCenter: clone(match.kickoff.zoning.A.zoneCenter),
    },
    B: {
      ballZone: 69,
      zoneCenter: clone(match.kickoff.zoning.B.zoneCenter),
    },
  });
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
      goStep: false,
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
      zoning,
      motion,
      readiness: deriveKickoffReadiness({ players, ball, officials: swapped.officials }),
    },
  };
}

function enterCurrentFullTime(match, nextTick) {
  const ball = currentLifecycleSwapEndsBall(match, nextTick);
  const possession = currentLifecycleClearPossession(match.possession);
  const players = match.players.map((player) => currentLifecycleStandingPlayer(player, nextTick));
  return {
    ...match,
    phase: "full-time-terminal",
    ball,
    possession,
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
      // watch_match_time enters SWAP_ENDS through init_match_mode. The
      // existing centre game_action/set_piece globals survive, while
      // init_swap_ends reinstalls the 40-tick dead-ball count.
      gameAction: match.rules.gameAction,
      setPiece: match.rules.setPiece,
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

/** BALL.CPP reset_ball as owned by RULES.CPP init_swap_ends. */
function currentLifecycleSwapEndsBall(match, nextTick) {
  const position = {
    x: match.ball.ball.position.x,
    y: match.ball.ball.position.y,
    z: F32(CSSOCCER_KICKOFF_CONSTANTS.ballDiameter / 2),
  };
  return createBallMatchState({
    ball: {
      ...clone(match.ball.ball),
      tick: nextTick,
      position,
      displacement: { x: F32(0), y: F32(0), z: F32(0) },
      inAir: 0,
      inGoal: 0,
      still: 1,
      // reset_ball zeros the displacement and marks the ball still, but does
      // not rewrite the ball_speed global calculated earlier in this tick.
      speed: match.ball.ball.speed,
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
    outcome: { kind: "swap-ends", status: "halftime" },
  });
}

function currentLifecycleClearPossession(possession) {
  return createPossessionState({
    ...clone(possession),
    owner: 0,
    lastTouch: 0,
    inHands: 0,
    players: possession.players.map((player) => ({ ...clone(player), possession: 0 })),
  });
}

function currentLifecycleStandingPlayer(source, nextTick) {
  const player = clearLivePlayerActions(source);
  const sourceMotion = source.liveMotion;
  return {
    ...player,
    previousPosition: clone(player.position),
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
      kind: "stand",
      teamRate: sourceMotion?.teamRate ?? source.gameplay.pace,
      target: { x: source.target.x, y: source.target.y },
      goStep: sourceMotion?.goStep ?? source.goalGoStep ?? false,
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

function currentTeamRates(players, gameMinute) {
  return players.map((player) => {
    const initialRate = player.gameplay.pace;
    const injuryBaseRate = player.injury?.baseRate;
    const value = Number.isSafeInteger(injuryBaseRate)
      ? gameMinute === player.injury.playerMinutes
        // init_player_stats writes the already-fatigued injured rate. It
        // remains the tm_rate store until the next integer-minute edge.
        ? initialRate
        : projectCssoccerInjuredRate({
            baseRate: injuryBaseRate,
            playerMinutes: gameMinute,
            stamina: player.gameplay.stamina,
          })
      : (() => {
          const fatigueCurve = F32((
            Math.sin(((Math.PI * gameMinute) / 120) - (Math.PI / 2)) + 1
          ) / 2);
          const fatigue = F32(
            fatigueCurve * ((129 - player.gameplay.stamina) / 140) * initialRate,
          );
          return Math.trunc(initialRate - fatigue);
        })();
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
      state: clearCssoccerRuleRestart(match.rules.state),
    },
    clock: {
      ...match.clock,
      running: true,
    },
    control: {
      ...match.control,
      activePlayerId: selectCentreControlPlayer(match, taker),
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
  centrePassContactFrame,
  centrePassPlayerFrame,
  centrePassReceiverFrame,
  nearest,
  command,
  playerDistanceFrame,
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
  let players = match.players.map((player, index) => {
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
  if (centrePassContactFrame === null) {
    throw new Error("Centre-pass animation lost its process_teams contact frame.");
  }
  const contact = centrePassContactFrame;
  const frame = contact.frame;
  let ball = match.ball;
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
    const supportIntent = resolveCurrentCentreSupportIntent(match, nextTick);
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
      wantedReceiver: supportIntent.holderWantPassNativePlayer
        === centrePassReceiverFrame.nativePlayerNumber,
    });
    ball = released.ball;
    possession = released.possession;
    rng = { ...match.rng, state: released.rng };
    control = reselectReleasedControl(match, receiver, nearest);
    const sourceSelected = centrePassPlayerFrame?.find(({ id }) => (
      id === control.activePlayerId
    ));
    const traversal = nativeContactTraversalOrder(match.tick & 1);
    if (
      sourceSelected !== undefined
      && traversal.indexOf(sourceSelected.nativePlayerNumber)
        > traversal.indexOf(taker.nativePlayerNumber)
    ) {
      // The newly selected player reaches user_intelligence after the pass
      // has made the ball free. user_intelligence delegates to intelligence,
      // so this is a source free-ball interception visit, not a neutral
      // post-loop user-input visit.
      const visited = planFreeBallIntercept(
        sourceSelected,
        {
          ...match,
          ball,
          possession,
          control,
        },
        nextTick,
        command,
        { incrementRunCountBeforeAction: true },
      );
      if (visited === null) {
        throw new Error("Centre-pass release selection produced no source interception.");
      }
      const animated = stepLocomotionAnimation(
        visited,
        visited.liveMotion,
        possession,
        nextTick,
      );
      players = players.map((player) => (
        player.id === animated.id ? animated : player
      ));
    }
    const opponentNearPath = selectFreeBallNearPathPlayer(
      {
        ...match,
        players: centrePassPlayerFrame,
        ball,
        possession,
      },
      taker.nativeTeamSlot === "A" ? "B" : "A",
      command,
      ball,
    );
    if (opponentNearPath !== null) {
      if (!(playerDistanceFrame instanceof Map)) {
        throw new Error("Centre-pass release lost the source player-distance frame.");
      }
      const releaseVisitIndex = traversal.indexOf(taker.nativePlayerNumber);
      const sourceByNativePlayer = new Map(centrePassPlayerFrame.map((player) => [
        player.nativePlayerNumber,
        player,
      ]));
      const visits = traversal.flatMap((nativePlayerNumber, visitIndex) => {
        const player = sourceByNativePlayer.get(nativePlayerNumber);
        if (player === undefined) {
          throw new Error(
            `Centre-pass release lost native player ${nativePlayerNumber}.`,
          );
        }
        if (!player.active) return [];
        const distance = playerDistanceFrame.get(player.id);
        if (!Number.isFinite(distance)) {
          throw new Error(
            `Centre-pass release lost source distance for ${player.id}.`,
          );
        }
        const afterRelease = visitIndex >= releaseVisitIndex;
        return [{
          playerId: player.id,
          nativePlayerNumber,
          ballPosition: clone(
            afterRelease ? ball.ball.position : centrePassContactFrame.ballPosition,
          ),
          canBeOffside: match.rules.canBeOffside,
          distance,
          interaction: "none",
          possession: clone(afterRelease ? possession : match.possession),
        }];
      });
      const opponentJourney = stepOpponentFreeBallJourney({
        command,
        frozenLimboPrediction: null,
        match: {
          ...match,
          players,
          ball,
          possession,
          rng,
          control,
        },
        nearPath: opponentNearPath,
        nextTick,
        sourceReleaseNativePlayer: taker.nativePlayerNumber,
        sourcePredictionState: null,
        skipPlayerIds: new Set(),
        sourcePlayers: centrePassPlayerFrame,
        sourcePossessionOwner: match.possession.owner,
        visits,
        wantPassNativePlayer: supportIntent.holderWantPassNativePlayer,
      });
      const plannedOpponent = opponentJourney.players.find(
        ({ id }) => id === opponentNearPath.id,
      );
      const currentOpponent = players.find(
        ({ id }) => id === opponentNearPath.id,
      );
      if (plannedOpponent === undefined || currentOpponent === undefined) {
        throw new Error("Centre-pass release lost its opponent near-path player.");
      }
      if (plannedOpponent !== currentOpponent) {
        const animatedOpponent = (
          plannedOpponent.liveFirstTimeIntercept?.phaseTick === nextTick
        )
          ? plannedOpponent
          : stepLocomotionAnimation(
              plannedOpponent,
              plannedOpponent.liveMotion,
              possession,
              nextTick,
            );
        players = opponentJourney.players.map((player) => (
          player.id === animatedOpponent.id ? animatedOpponent : player
        ));
      }
      rng = { ...rng, state: opponentJourney.rng };
    }
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

function applyOpenPlayCollectedUserVisit({
  ball,
  command,
  events,
  match,
  nextTick,
  players,
  sourcePlayers,
  sourcePossessionOwner,
  visits,
}) {
  const handoff = events.findLast(({ type }) => type === "ball-collected-control-handoff");
  const retainedActiveCollection = handoff === undefined
    && sourcePossessionOwner === 0
    ? visits.findLast((visit) => (
        visit.interaction === "collect"
        && visit.playerId === match.control.activePlayerId
        && visit.nativePlayerNumber === visit.possession.owner
      ))
    : undefined;
  if (
    handoff?.sourceUserVisit === false
    || (handoff === undefined && retainedActiveCollection === undefined)
  ) {
    return players;
  }
  const activePlayerId = handoff?.activePlayerId
    ?? retainedActiveCollection.playerId;
  const player = players.find(({ id }) => id === activePlayerId);
  if (player === undefined) {
    throw new Error("Collected-ball user visit lost its newly controlled player.");
  }
  const sourcePlayer = sourcePlayers.find(({ id }) => id === player.id);
  if (sourcePlayer === undefined) {
    throw new Error("Collected-ball user visit lost its pre-team source player.");
  }
  // BALLINT.CPP collect_ball/reselect executes inside ball_interact, before
  // this same player's user_play/do_action slot. For STAND/RUN, run_action
  // enters user_run whenever the newly selected player now owns the ball.
  // That action path replaces even a still-busy I_RUN_ON journey; an
  // I_INTERCEPT journey was already cleared by collect_ball itself.
  if (player.action.action.value > CSSOCCER_NATIVE_ACTIONS.RUN) return players;
  const visited = applyCurrentSourceUserVisit({
    ball,
    ballPossession: match.possession.owner,
    command,
    match: { ...match, players },
    nextTick,
    player,
    sourcePlayer,
  });
  return players.map((candidate) => candidate.id === visited.id ? visited : candidate);
}

function applyCurrentSourceUserVisit({
  ball,
  ballPossession,
  command,
  match,
  nextTick,
  player,
  sourcePlayer,
}) {
  const teamRate = currentTeamRates(match.players, match.clock.gameMinute)
    .find(({ id }) => id === player.id)?.value;
  if (!Number.isSafeInteger(teamRate)) {
    throw new Error("Current source user visit lost its dynamic team rate.");
  }
  const intelligence = advanceCurrentSourceUserIntelligence(player);
  const vector = sourceUserVector(player, command);
  if (vector.x !== 0 || vector.y !== 0) {
    const target = {
      x: F32(player.position.x + (vector.x * 256)),
      y: F32(player.position.y + (vector.y * 256)),
    };
    const speed = actualPlayerSpeed({
      pitchLength: 1280,
      teamRate,
      speedIntent: CSSOCCER_SPEED_INTENT.normal,
      intentionCount: 0,
      sideStep: false,
      nativePlayer: player.nativePlayerNumber,
      ballPossession,
      ballInHands: false,
      keeperNativePlayers: [1, 12],
      userControlIndex: 1,
      burstTimer: 0,
    });
    const forward = sourceForwardDisplacement({
      facing: player.facing,
      targetOffset: {
        x: F32(target.x - player.position.x),
        y: F32(target.y - player.position.y),
      },
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
      target: { ...target, z: player.position.z },
      intelligence,
      action: createCssoccerActionState({
        tick: nextTick,
        playerId: player.id,
        actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
        facingX: facing.x,
        facingY: facing.y,
      }),
      liveMotion: projectCssoccerWantPassMotion({
        sourcePlayer,
        intelligence,
        liveMotion: {
          kind: "run",
          teamRate,
          target,
          goStep: false,
          goCount: 0,
          goDisplacement: clone(forward.displacement),
          directionMode: 0,
          resetAnimationFrame: false,
          sideStepDirection: null,
          animationId: null,
          animationFrameStep: null,
        },
      }),
    };
  }
  const speed = actualPlayerSpeed({
    pitchLength: 1280,
    teamRate,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: false,
    nativePlayer: player.nativePlayerNumber,
    ballPossession,
    ballInHands: false,
    keeperNativePlayers: [1, 12],
    userControlIndex: 1,
    burstTimer: 0,
  });
  const sourceAction = sourcePlayer.action.action.value;
  const displacement = sourceAction === CSSOCCER_NATIVE_ACTIONS.STAND
    || player.liveMotion.goStep
    || player.liveMotion.goStop === true
    ? { x: F32(0), y: F32(0) }
    : {
        x: F32(F32(player.facing.x * F32(0.5)) * speed),
        y: F32(F32(player.facing.y * F32(0.5)) * speed),
      };
  const position = {
    ...updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement,
    }),
    z: player.position.z,
  };
  const facing = turnSourceFacing({
    facing: player.facing,
    target: {
      x: F32(ball.ball.position.x - position.x),
      y: F32(ball.ball.position.y - position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate },
    ).maxTurnRadians,
  }).facing;
  const target = { x: player.position.x, y: player.position.y };
  return {
    ...clone(player),
    previousPosition: clone(player.position),
    previousFacing: clone(player.facing),
    position,
    velocity: { ...clone(displacement), z: F32(0) },
    facing,
    target: { ...target, z: player.position.z },
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
      teamRate,
      target,
      goStep: player.liveMotion.goStep,
      goCount: 0,
      goDisplacement: displacement,
      directionMode: 1,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: null,
      animationFrameStep: null,
    },
  };
}

function advanceCurrentSourceUserIntelligence(player) {
  if (player.intelligence.count <= 0) return clone(player.intelligence);
  const count = player.intelligence.count - 1;
  if (count > 0) {
    return { ...clone(player.intelligence), count };
  }
  // user_intelligence/intelligence both execute before do_action. Expiring
  // I_RUN_ON reaches reset_ideas, which also clears the source-global
  // want_pass owner before this visit's user run or stand action.
  return { special: 0, move: 0, count: 0 };
}

function resolveCurrentCentreSupportIntent(match, nextTick) {
  const byNativePlayer = new Map(match.players.map((player) => [
    player.nativePlayerNumber,
    player,
  ]));
  const visits = nativeContactTraversalOrder(match.tick & 1).flatMap((nativePlayerNumber) => {
    const player = byNativePlayer.get(nativePlayerNumber);
    if (player === undefined) {
      throw new Error(`Centre-pass support intent lost native player ${nativePlayerNumber}.`);
    }
    if (!player.active) return [];
    return [{
      playerId: player.id,
      nativePlayerNumber,
      ballPosition: clone(match.ball.ball.position),
      canBeOffside: match.rules.canBeOffside,
      distance: sourceDistance2d({
        x: F32(player.position.x - match.ball.ball.position.x),
        y: F32(player.position.y - match.ball.ball.position.y),
      }),
      interaction: "none",
      possession: {
        owner: match.possession.owner,
        lastTouch: match.possession.lastTouch,
        inHands: match.possession.inHands,
      },
    }];
  });
  return resolveCssoccerFreePlaySupportIntent({
    candidateWindow: "all",
    controlledPlayerId: match.control.activePlayerId,
    defensiveLines: captureOpenPlayDefensiveLines(match.players),
    holderVisitCompleted: false,
    justScored: match.goal.justScored !== 0,
    logicCount: NATIVE_CAPTURE_LOGIC_COUNT_ROOT + Math.max(0, nextTick - 2),
    nextTick,
    offsideEnabled: match.config.rules.offside === true,
    players: match.players,
    possession: match.possession,
    rngSeed: match.rng.state.seed,
    sourcePossession: match.possession,
    supportMe: false,
    takerId: match.kickoff.owner.takerId,
    visits,
  });
}

function reselectReleasedControl(match, receiver, nearest) {
  if (
    receiver.nativeTeamSlot === match.control.nativeTeamSlot
    && receiver.role !== "keeper"
    && receiver.active
  ) {
    return {
      ...match.control,
      activePlayerId: receiver.id,
    };
  }
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

function selectCentreControlPlayer(match, taker) {
  if (match.kickoff.owner.country === match.control.country) return taker.id;
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
  // init_run_act retains RUN_ACT while stop_and_face turns in place with the
  // standing clip. go_forward installs MC_RUN only when alignment clears.
  const running = action === CSSOCCER_NATIVE_ACTIONS.RUN
    && motion?.goStop !== true;
  const sideStep = running && (
    motion?.kind === "side-step"
    || motion?.goStep === true
    || motion?.lastPlan?.choice === "side-step"
  );
  let kind = "stand";
  let id = STAND_ANIMATION;
  let frameStep = STAND_FRAME_STEP;
  if (motion?.kind === "socks") {
    kind = "socks";
    id = motion.animationId;
    frameStep = motion.animationFrameStep;
  } else if (motion?.kind === "first-time-must-face") {
    kind = "stand";
    id = STAND_ANIMATION;
    frameStep = STAND_FRAME_STEP;
  } else if (running) {
    kind = sideStep ? "side-step" : "run";
    const continuingSideStep = sideStep
      && player.animation.kind === "side-step"
      && Number.isFinite(motion?.animationFrameStep)
      && !Number.isSafeInteger(motion?.animationId)
      && motion?.resetAnimationFrame !== true;
    id = sideStep
      ? Number.isSafeInteger(motion?.animationId)
        ? motion.animationId
        : continuingSideStep
          ? player.animation.id
          : TROT_ANIMATION_BY_DIRECTION[
            motion?.sideStepDirection ?? sourceSideStepDirection(player)
          ]
      : RUN_ANIMATION;
    if (!Number.isSafeInteger(motion?.teamRate)) {
      throw new Error(`Locomotion animation lost the current rate for ${player.id}.`);
    }
    const speed = currentPlayerSpeed(player, motion.teamRate, sideStep, possession);
    const initializedFrameStep = sideStep
      ? F32(speed * SIDE_STEP_FRAME_STEP / 2)
      : F32(RUN_FRAME_STEP * (speed / RUN_REFERENCE_SPEED));
    frameStep = Number.isFinite(motion?.animationFrameStep)
      ? F32(motion.animationFrameStep)
      : initializedFrameStep;
  }
  const changed = player.animation.id !== id;
  const preservesTrotPhase = kind === "side-step"
    && player.animation.kind === "side-step";
  const resetsFromSourceMotion = motion?.resetAnimationFrame === true
    || (
      (kind === "stand" || kind === "socks")
      && motion?.lastPlan?.choice === "arrived"
    )
    || (
      // init_run_act briefly installs stand animation for stop_and_face;
      // go_forward can clear the stop in the same visit and reinstall MC_RUN.
      // The final action/id therefore stay RUN while tm_frm still resets.
      kind === "run"
      && motion?.lastPlan?.choice === "rotate-and-run"
      && motion?.goStop === false
    );
  const advancedFrame = motion?.sourceAnimationVisitComplete === true
    ? F32(player.animation.frame)
    : resetsFromSourceMotion || (changed && !preservesTrotPhase)
    ? F32(0)
    : F32(player.animation.frame + player.animation.frameStep);
  // The linked ACTIONS.OBJ has a post-increment branch absent from the
  // checked-in process_anims source: MC_RUN with tm_limp set keeps only the
  // first half of the run cycle by subtracting 0.5 once modf(tm_frm) exceeds
  // 0.5. FOOTBALL.OBJ init_player_stats raises tm_limp only when the
  // post-injury effective fitness is below 25.
  const frame = (
    id === RUN_ANIMATION
    && player.injury?.effectiveFitness < 25
    && advancedFrame - Math.trunc(advancedFrame) > 0.5
  )
    ? F32(advancedFrame - 0.5)
    : advancedFrame;
  const advanced = clone(player);
  if (
    action === CSSOCCER_NATIVE_ACTIONS.STAND
    && advanced.sourceHeldBallTween?.freeTime < -1
  ) {
    // stand_action stores the post-process_anims pose in ls_anim/ls_frm on
    // every visit. Preserve that raw, unbounded frame when the player later
    // leaves STAND; get_mcball_coords indexes the contiguous player_p domain
    // from this capture rather than the player's current RUN animation.
    advanced.sourceHeldBallTween = {
      ...clone(advanced.sourceHeldBallTween),
      capture: {
        animationId: Math.abs(id),
        animationFrame: frame,
      },
    };
  }
  if (advanced.liveMotion?.sourceAnimationVisitComplete === true) {
    // This marker suppresses only the process_anims slot in the visit that
    // initialized the clip. The following source tick advances normally.
    delete advanced.liveMotion.sourceAnimationVisitComplete;
  }
  if (advanced.liveMotion?.resetAnimationFrame === true) {
    // init_*_anim consumes this reset once; it is not persistent motion
    // state and must not pin the new clip to frame zero on later visits.
    advanced.liveMotion.resetAnimationFrame = false;
  }
  return {
    ...advanced,
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
  // ACTIONS.CPP uses calc_dist here. Its 0.1 floor keeps an already-reached
  // side-step target at the exact zero vector instead of dividing 0 / 0.
  const distance = sourceDistance2d(target);
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
  const facingDistance = sourceDistance2d({ x: facing.x, y: facing.y });
  const nx = F32(facing.x / facingDistance);
  const ny = F32(facing.y / facingDistance);
  const distance = sourceDistance2d({ x: local.x, y: local.y });
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
  const observedAllStanding = match.players.every((player) => (
    player.active
    && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
    && Math.hypot(
      player.target.x - player.position.x,
      player.target.y - player.position.y,
    ) <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.motion.imThereDistance.value
  ));
  const halftimePositioning = match.kickoff?.restartKind === "halftime"
    && match.kickoff.phase === "centre-positioning";
  const postGoalPositioning = match.kickoff?.restartKind === "post-goal"
    && match.kickoff.phase === "centre-positioning";
  const observedPosition = halftimePositioning
    ? taker.previousPosition ?? taker.position
    : taker.position;
  const observedFacing = halftimePositioning
    ? taker.previousFacing ?? taker.facing
    : taker.facing;
  const toBall = {
    x: ball.x - observedPosition.x,
    y: ball.y - observedPosition.y,
  };
  const distance = Math.hypot(toBall.x, toBall.y);
  const cosine = distance === 0
    ? 1
    : ((toBall.x * observedFacing.x) + (toBall.y * observedFacing.y)) / distance;
  const observedTakerReady = taker.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
    && distance < CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.besideBall.value * 3
    && cosine > CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.facingAngle.value;
  const refereeReady = match.officials.officials[0].action
    === CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value;
  let setPieceWaitTicks = match.kickoff?.readiness?.setPieceWaitTicks
    ?? CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.setPieceWaitTicks.value;
  let forcedStanding = false;
  // A halftime await_swap visit cannot re-enter await_set_kick after it calls
  // init_centre, so its first decrement is on the following tick. A post-goal
  // respot initializes the centre in process_ball before match_rules enters
  // ball_situation, so await_set_kick decrements MAX_SETP_WAIT on that same
  // entry tick. At zero the source stores one and forces readiness forever.
  if (
    (
      halftimePositioning
      && match.kickoff.phaseTick > 1
    )
    || (
      postGoalPositioning
      && match.kickoff.phaseTick > 0
    )
  ) {
    setPieceWaitTicks -= 1;
    if (setPieceWaitTicks === 0) {
      setPieceWaitTicks = 1;
      forcedStanding = true;
    }
  }
  const allStanding = observedAllStanding || forcedStanding;
  // INTELL.CPP set_there_flags latches already_there once the taker qualifies.
  const takerReady = halftimePositioning
    ? Boolean(match.kickoff.readiness?.takerReady) || observedTakerReady
    : observedTakerReady;
  return {
    allStanding,
    takerReady,
    refereeReady,
    readyForLaunch: allStanding && takerReady && refereeReady,
    setPieceWaitTicks,
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

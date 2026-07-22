import {
  CSSOCCER_NATIVE_ACTIONS,
  createCssoccerActionState,
} from "./actionState.mjs";
import {
  CSSOCCER_SPEED_INTENT,
  actualPlayerSpeed,
  sourceAngleCosine,
  sourceDistance2d,
  sourceFacingDirection,
  sourceForwardDisplacement,
  sourceFullPlayerSpeed,
  sourceGetThereTime,
  turnSourceFacing,
  updateSourcePosition2d,
} from "./motionState.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  projectCssoccerKeeperSourceConstants,
  projectCssoccerMotionSourceProfile,
  projectCssoccerTravelSourceProfile,
} from "./nativeGameplayProfile.mjs";
import { resolveCssoccerKeeperPosition } from "./keeperAi.mjs";
import { selectCssoccerDribbleRun } from "./dribbleState.mjs";
import {
  createCssoccerTacticsState,
  resolveCssoccerZonalTarget,
} from "./tacticsState.mjs";
import {
  assertCssoccerZoneState,
  createCssoccerZoneState,
  stepCssoccerZoneState,
} from "./zoneState.mjs";

const F32 = Math.fround;
const PITCH_LENGTH = 1280;
const PITCH_WIDTH = 800;
const SOCKS_PROBABILITY = 15;
const SOCKS_RIGHT_ANIMATION = 62;
const SOCKS_LEFT_ANIMATION = 63;
const SOCKS_FRAME_STEP = F32(1 / (20 * 68 / 40));
const RUN_ON_INTELLIGENCE_MOVE = 8;
const MIN_HELP_CHANCE = 2;
const CALL_DISTANCE = F32(CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 60);
const DANGER_DISTANCE = F32(CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 8);
const DRIBBLE_DANGER_DISTANCE = F32(
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 13,
);

export const CSSOCCER_FREE_PLAY_PLAYER_REDUCER_SOURCE = deepFreeze({
  files: [
    {
      file: "ACTIONS.CPP",
      functions: [
        "process_teams",
        "go_team",
        "init_run_act",
        "go_forward",
        "process_dir",
      ],
    },
    {
      file: "INTELL.CPP",
      functions: [
        "find_zonal_target",
        "get_there_time",
        "help_chance",
        "intelligence",
        "we_have_ball",
      ],
    },
  ],
  transition:
    "the first normal-play process_teams pass after centre readiness clears match_mode",
  currentStateOnly: true,
});

/** Project one ordinary find_zonal_target/go_forward source visit. */
export function projectCssoccerFreePlayZonalPlayerVisit(input = {}) {
  requirePlainObject(input, "free-play zonal player visit");
  requireExactKeys(input, [
    "allowSideStep",
    "ballPosition",
    "nextTick",
    "player",
    "possession",
    "tactics",
    "teamRate",
    "zoning",
  ], "free-play zonal player visit");
  if (typeof input.allowSideStep !== "boolean") {
    throw new TypeError("Zonal player visit allowSideStep must be boolean.");
  }
  if (!Number.isSafeInteger(input.nextTick) || input.nextTick < 1) {
    throw new TypeError("Zonal player visit nextTick must be positive.");
  }
  if (!Number.isSafeInteger(input.teamRate) || input.teamRate < 0 || input.teamRate > 255) {
    throw new TypeError("Zonal player visit teamRate must be a byte.");
  }
  requirePlainObject(input.player, "zonal player visit player");
  if (input.player.liveMotion === undefined) {
    throw new Error("Zonal player visit requires current player motion.");
  }
  requirePlainObject(input.possession, "zonal player visit possession");
  requireExactKeys(
    input.possession,
    ["inHands", "lastTouch", "owner"],
    "zonal player visit possession",
  );
  requirePlainObject(input.zoning, "zonal player visit zoning");
  requireExactKeys(input.zoning, [
    "analogue",
    "ballZone",
    "teamInPossession",
    "zoneCenter",
  ], "zonal player visit zoning");
  return planZonalPlayer({
    player: input.player,
    motion: input.player.liveMotion,
    teamRate: input.teamRate,
  }, {
    allowSideStep: input.allowSideStep,
    ballPosition: requireF32Point(input.ballPosition, "zonal player visit ball"),
    nextTick: input.nextTick,
    possession: input.possession,
    tactics: currentTacticsState(input.tactics),
    targetOverride: null,
    zoning: input.zoning,
  });
}

/**
 * Materialize the first ordinary process_teams visit from current kickoff,
 * ball, possession, tactics, rate, and control state. No retained player
 * destination, action, or pose is accepted by this reducer.
 */
export function stepCssoccerFreePlayOpeningTeamTransition(input = {}) {
  requirePlainObject(input, "free-play opening team transition");
  requireExactKeys(input, [
    "ballPosition",
    "postTakerBallPosition",
    "controlledPlayerId",
    "kickoffMotion",
    "logicCount",
    "nextTick",
    "players",
    "possession",
    "receiverId",
    "rngSeed",
    "sourceTick",
    "tactics",
    "takerId",
    "teamRates",
    "zoning",
  ], "free-play opening team transition");
  if (!Number.isSafeInteger(input.nextTick) || input.nextTick < 1) {
    throw new TypeError("Opening team transition nextTick must be a positive integer.");
  }
  if (!Number.isSafeInteger(input.sourceTick) || input.sourceTick !== input.nextTick - 1) {
    throw new TypeError("Opening team transition sourceTick must precede nextTick exactly.");
  }
  if (!Number.isSafeInteger(input.logicCount) || input.logicCount < 0) {
    throw new TypeError("Opening team transition logicCount must be a non-negative integer.");
  }
  if (!Array.isArray(input.players) || input.players.length !== 22) {
    throw new Error("Opening team transition requires all 22 current players.");
  }
  if (!Array.isArray(input.kickoffMotion?.players) || input.kickoffMotion.players.length !== 22) {
    throw new Error("Opening team transition requires the current 22-player kickoff motion.");
  }
  if (!new Set(["positioning", "settled"]).has(input.kickoffMotion.status)) {
    throw new Error("Opening team transition received an invalid current kickoff status.");
  }
  const ballPosition = requireF32Point(input.ballPosition, "opening transition ball");
  const postTakerBallPosition = requireF32Point(
    input.postTakerBallPosition,
    "opening transition post-taker ball",
  );
  const tactics = currentTacticsState(input.tactics);
  const zoning = assertCssoccerZoneState(input.zoning);
  const rates = currentRateMap(input.teamRates, input.players);
  const kickoffById = new Map(input.kickoffMotion.players.map((player) => [player.id, player]));
  const taker = requireCentreTaker(input.players, input.takerId);
  const receiverTarget = currentCentreReceiverTarget(taker.nativeTeamSlot);
  const visits = new Map(input.players.map((player) => {
    const visitBallPosition = sourceBallForPlayer({
      nativePlayerNumber: player.nativePlayerNumber,
      takerNativePlayerNumber: taker.nativePlayerNumber,
      sourceTick: input.sourceTick,
      preTaker: ballPosition,
      postTaker: postTakerBallPosition,
    });
    return [player.id, {
      ballPosition: visitBallPosition,
      distance: sourceDistance2d({
        x: F32(visitBallPosition.x - player.position.x),
        y: F32(visitBallPosition.y - player.position.y),
      }),
      possession: input.possession,
    }];
  }));
  const supportRun = selectSourceSupportRun({
    controlledPlayerId: input.controlledPlayerId,
    logicCount: input.logicCount,
    players: input.players,
    possession: input.possession,
    rngSeed: input.rngSeed,
    takerId: input.takerId,
    visits,
  });

  return input.players.map((player) => {
    const kickoff = kickoffById.get(player.id);
    if (kickoff === undefined) throw new Error(`Opening transition lost ${player.id}.`);
    if (player.id === input.takerId) return clone(player);
    const teamRate = rates.get(player.id);
    const current = {
      player,
      motion: kickoff,
      teamRate,
    };
    const sourceBallPosition = sourceBallForPlayer({
      nativePlayerNumber: player.nativePlayerNumber,
      takerNativePlayerNumber: taker.nativePlayerNumber,
      sourceTick: input.sourceTick,
      preTaker: ballPosition,
      postTaker: postTakerBallPosition,
    });
    if (
      (player.role === "keeper" && kickoff.settled)
      || player.id === input.controlledPlayerId
    ) {
      return settlePlayer(current, {
        ballPosition: sourceBallPosition,
        nextTick: input.nextTick,
        possession: input.possession,
        rngSeed: input.rngSeed,
      });
    }
    const planned = planZonalPlayer(current, {
      allowSideStep: supportRun?.playerId !== player.id,
      ballPosition: sourceBallPosition,
      nextTick: input.nextTick,
      possession: input.possession,
      tactics,
      targetOverride: player.role === "keeper"
        ? kickoff.target
        : supportRun?.playerId === player.id
        ? supportRun.target
        : player.id === input.receiverId
          ? receiverTarget
          : null,
      zoning: openingZoning(player, zoning),
    });
    if (supportRun?.playerId !== player.id) return planned;
    return {
      ...planned,
      intelligence: {
        special: 0,
        move: RUN_ON_INTELLIGENCE_MOVE,
        count: planned.liveMotion.goCount + 1,
      },
      liveMotion: {
        ...planned.liveMotion,
        kind: "support-run",
        wantPassStat: supportRun.wantPassStat,
      },
    };
  });
}

/** Continue the source-ordered team visits while the centre taker is active. */
export function stepCssoccerFreePlayOpeningTeamContinuation(input = {}) {
  requirePlainObject(input, "free-play opening team continuation");
  requireExactKeys(input, [
    "ballPosition",
    "controlledPlayerId",
    "logicCount",
    "nextTick",
    "players",
    "possession",
    "postTakerBallPosition",
    "receiverId",
    "rngSeed",
    "sourceTick",
    "tactics",
    "takerId",
    "teamRates",
    "zoning",
  ], "free-play opening team continuation");
  if (!Number.isSafeInteger(input.sourceTick) || input.sourceTick !== input.nextTick - 1) {
    throw new TypeError("Opening team continuation sourceTick must precede nextTick exactly.");
  }
  if (!Number.isSafeInteger(input.logicCount) || input.logicCount < 0) {
    throw new TypeError("Opening team continuation logicCount must be a non-negative integer.");
  }
  if (!Array.isArray(input.players) || input.players.length !== 22) {
    throw new Error("Opening team continuation requires all 22 current players.");
  }
  const preTaker = requireF32Point(input.ballPosition, "opening continuation ball");
  const postTaker = requireF32Point(
    input.postTakerBallPosition,
    "opening continuation post-taker ball",
  );
  const tactics = currentTacticsState(input.tactics);
  const zoning = assertCssoccerZoneState(input.zoning);
  const rates = currentRateMap(input.teamRates, input.players);
  const taker = requireCentreTaker(input.players, input.takerId);
  const receiverTarget = currentCentreReceiverTarget(taker.nativeTeamSlot);
  const visits = new Map(input.players.map((player) => {
    const ballPosition = sourceBallForPlayer({
      nativePlayerNumber: player.nativePlayerNumber,
      takerNativePlayerNumber: taker.nativePlayerNumber,
      sourceTick: input.sourceTick,
      preTaker,
      postTaker,
    });
    return [player.id, {
      ballPosition,
      distance: sourceDistance2d({
        x: F32(ballPosition.x - player.position.x),
        y: F32(ballPosition.y - player.position.y),
      }),
      possession: input.possession,
    }];
  }));
  const supportRun = selectSourceSupportRun({
    controlledPlayerId: input.controlledPlayerId,
    logicCount: input.logicCount,
    players: input.players,
    possession: input.possession,
    rngSeed: input.rngSeed,
    takerId: input.takerId,
    visits,
  });
  return input.players.map((player) => {
    if (player.id === input.takerId) return clone(player);
    if (player.liveMotion === undefined) {
      throw new Error(`Opening team continuation lost current motion for ${player.id}.`);
    }
    const current = {
      player,
      motion: player.liveMotion,
      teamRate: rates.get(player.id),
    };
    const ballPosition = sourceBallForPlayer({
      nativePlayerNumber: player.nativePlayerNumber,
      takerNativePlayerNumber: taker.nativePlayerNumber,
      sourceTick: input.sourceTick,
      preTaker,
      postTaker,
    });
    if (
      (
        player.role === "keeper"
        && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
      )
      || player.id === input.controlledPlayerId
    ) {
      return settlePlayer(current, {
        ballPosition,
        nextTick: input.nextTick,
        possession: input.possession,
        rngSeed: input.rngSeed,
      });
    }
    const continuingSupportRun = player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
      && player.intelligence.count > 1
      && player.liveMotion.kind === "support-run";
    const planned = planZonalPlayer(current, {
      allowSideStep: supportRun?.playerId !== player.id,
      ballPosition,
      nextTick: input.nextTick,
      possession: input.possession,
      tactics,
      targetOverride: player.role === "keeper"
        ? player.liveMotion.target
        : supportRun?.playerId === player.id
        ? supportRun.target
        : continuingSupportRun
        ? player.liveMotion.target
        : player.id === input.receiverId
          ? receiverTarget
          : null,
      zoning: openingZoning(player, zoning),
    });
    if (supportRun?.playerId === player.id) {
      return {
        ...planned,
        intelligence: {
          special: 0,
          move: RUN_ON_INTELLIGENCE_MOVE,
          count: planned.liveMotion.goCount + 1,
        },
        liveMotion: {
          ...planned.liveMotion,
          kind: "support-run",
          wantPassStat: supportRun.wantPassStat,
        },
      };
    }
    if (!continuingSupportRun) return planned;
    return {
      ...planned,
      intelligence: {
        special: 0,
        move: RUN_ON_INTELLIGENCE_MOVE,
        count: player.intelligence.count - 1,
      },
      liveMotion: {
        ...planned.liveMotion,
        kind: "support-run",
        wantPassStat: player.liveMotion.wantPassStat,
      },
    };
  });
}

/** Continue ordinary current-state team work without consuming the local user visit. */
export function stepCssoccerFreePlayTeamJourneyContinuation(input = {}) {
  requirePlainObject(input, "free-play team journey continuation");
  requireExactKeys(input, [
    "controlledPlayerId",
    "logicCount",
    "nextTick",
    "possessionKicks",
    "players",
    "possessionRuns",
    "rngSeed",
    "supportRun",
    "tactics",
    "takerId",
    "teamRates",
    "visits",
    "zoneAnalogue",
    "zoneBallPosition",
  ], "free-play team journey continuation");
  if (!Array.isArray(input.players) || input.players.length !== 22) {
    throw new Error("Team journey continuation requires all 22 current players.");
  }
  if (!Number.isSafeInteger(input.logicCount) || input.logicCount < 0) {
    throw new TypeError("Team journey logicCount must be a non-negative integer.");
  }
  const tactics = currentTacticsState(input.tactics);
  const rates = currentRateMap(input.teamRates, input.players);
  const visits = currentVisitMap(input.visits, input.players);
  const zoneAnchor = visits.values().next().value;
  const finalPossession = [...visits.values()].at(-1).possession;
  if (["collect", "hold", "rebound"].includes(zoneAnchor.interaction)) {
    throw new Error("Team journey requires an explicit pre-team zone anchor when the first visit moves the ball.");
  }
  const zoneBallPosition = input.zoneBallPosition === null
    ? zoneAnchor.ballPosition
    : requireF32Point(input.zoneBallPosition, "team journey frozen zone ball");
  if (typeof input.zoneAnalogue !== "boolean") {
    throw new TypeError("Team journey zoneAnalogue must be boolean.");
  }
  const zones = stepCssoccerZoneState(createCssoccerZoneState(), {
    ballPosition: zoneBallPosition,
    ballOutOfPlay: 0,
    matchMode: 0,
    ballInHands: zoneAnchor.possession.inHands === 0 ? 0 : 1,
    possessionPlayer: zoneAnchor.possession.owner,
  });
  if (!Array.isArray(input.possessionRuns)) {
    throw new TypeError("Team journey possessionRuns must be an array.");
  }
  const possessionRuns = new Set(input.possessionRuns);
  if (
    possessionRuns.size !== input.possessionRuns.length
    || input.possessionRuns.some((id) => !input.players.some((player) => player.id === id))
  ) {
    throw new Error("Team journey possessionRuns changed player identity.");
  }
  if (!Array.isArray(input.possessionKicks)) {
    throw new TypeError("Team journey possessionKicks must be an array.");
  }
  const possessionKicks = new Set(input.possessionKicks);
  if (
    possessionKicks.size !== input.possessionKicks.length
    || input.possessionKicks.some((id) => !input.players.some((player) => player.id === id))
    || input.possessionKicks.some((id) => possessionRuns.has(id))
  ) {
    throw new Error("Team journey possessionKicks changed player identity or overlapped a run.");
  }
  const dribblePlayers = input.players.map((player) => ({
    nativePlayer: player.nativePlayerNumber,
    action: player.action.action.value,
    distance: visits.get(player.id).distance,
    on: player.active,
    position: { x: player.position.x, y: player.position.y },
  }));
  const supportRun = currentSupportRun(input.supportRun, input.players);
  return input.players.map((originalPlayer) => {
    const expiredRunOn = originalPlayer.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
      && originalPlayer.intelligence.count <= 1;
    const player = expiredRunOn
      ? {
          ...originalPlayer,
          intelligence: { special: 0, move: 0, count: 0 },
        }
      : originalPlayer;
    const visit = visits.get(player.id);
    if (player.id === input.takerId || player.id === input.controlledPlayerId) {
      return clone(player);
    }
    if (player.liveMotion === undefined) {
      throw new Error(`Team journey continuation lost current motion for ${player.id}.`);
    }
    const current = {
      player,
      motion: player.liveMotion,
      teamRate: rates.get(player.id),
    };
    if (possessionKicks.has(player.id)) {
      return clone(player);
    }
    if (player.role === "keeper") {
      const pendingShot = input.players.find((candidate) => (
        candidate.liveShot?.phase === "shot-released"
        && candidate.liveShot.targetKeeperNativePlayer === player.nativePlayerNumber
      ));
      const waitsForShot = pendingShot !== undefined && (
        (player.nativePlayerNumber === 1 && visit.ballPosition.x < PITCH_LENGTH / 2)
        || (player.nativePlayerNumber === 12 && visit.ballPosition.x > PITCH_LENGTH / 2)
      );
      if (waitsForShot) {
        // ACTIONS.CPP stand_action suppresses find_zonal_target while the
        // keeper-side shot_pending value is non-zero. He still processes
        // direction and animation at the standing action slot.
        const keeperVisitIndex = input.visits.findIndex(
          ({ playerId }) => playerId === player.id,
        );
        const shooterVisitIndex = input.visits.findIndex(
          ({ playerId }) => playerId === pendingShot.id,
        );
        if (keeperVisitIndex < 0 || shooterVisitIndex < 0) {
          throw new Error("Pending-shot keeper wait lost native traversal identity.");
        }
        const waiting = settlePlayer(current, {
          ballPosition: visit.ballPosition,
          nextTick: input.nextTick,
          possession: visit.possession,
          rngSeed: input.rngSeed,
        });
        return {
          ...waiting,
          liveMotion: {
            ...waiting.liveMotion,
            // A same-tick shot released after this keeper's visit is not yet
            // pending when stand_action replans and reinitializes MC_STAND.
            // If the shooter visited first, shot_pending suppresses that reset.
            resetAnimationFrame: pendingShot.liveShot.release?.tick === input.nextTick
              && keeperVisitIndex < shooterVisitIndex,
          },
        };
      }
      const keeperPosition = resolveCssoccerKeeperPosition({
        ...player,
        attributes: player.gameplay,
      }, {
        pitch: {
          length: PITCH_LENGTH,
          width: PITCH_WIDTH,
          ratio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
        },
        ball: {
          position: visit.ballPosition,
          inAir: false,
          inHands: visit.possession.inHands !== 0,
        },
        possession: visit.possession.owner,
        sourceConstants: projectCssoccerKeeperSourceConstants(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        ),
      });
      if (
        !Object.is(keeperPosition.target.x, player.position.x)
        || !Object.is(keeperPosition.target.y, player.position.y)
        || player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
      ) {
        const positioned = planZonalPlayer(current, {
          ballPosition: visit.ballPosition,
          nextTick: input.nextTick,
          possession: visit.possession,
          tactics,
          targetOverride: keeperPosition.target,
          zoning: null,
        });
        return {
          ...positioned,
          liveMotion: {
            ...positioned.liveMotion,
            // find_zonal_target executes go_forward immediately and then
            // clears the keeper journey countdown before process_dir.
            goCount: 0,
          },
        };
      }
      return settlePlayer(current, {
        ballPosition: visit.ballPosition,
        nextTick: input.nextTick,
        possession: visit.possession,
        rngSeed: input.rngSeed,
      });
    }
    const continuingSupportRun = player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
      && player.intelligence.count > 1
      && player.liveMotion.kind === "support-run";
    const resetSupportRunOpposesPossession = finalPossession.owner !== 0
      && (player.nativePlayerNumber < 12) !== (finalPossession.owner < 12);
    const continuingResetSupportRun = player.intelligence.move === 0
      && player.intelligence.count === 0
      && player.liveMotion.kind === "support-run"
      && (
        finalPossession.owner === 0
        || resetSupportRunOpposesPossession
        || !sourceThinkingTick(input.logicCount, player.gameplay.flair)
      );
    if (continuingResetSupportRun) {
      const continued = continueSourceSupportJourney(current, {
        ballPosition: visit.ballPosition,
        nextTick: input.nextTick,
        possession: visit.possession,
        processDirection: player.liveMotion.goCount > 1,
      });
      if (player.liveMotion.goCount > 1) return continued;
      const planned = planZonalPlayer({
        player: continued,
        motion: continued.liveMotion,
        teamRate: rates.get(player.id),
      }, {
        ballPosition: visit.ballPosition,
        nextTick: input.nextTick,
        possession: visit.possession,
        tactics,
        targetOverride: null,
        zoning: liveZoning(continued, zones, visit.possession, input.zoneAnalogue),
      });
      return {
        ...planned,
        previousPosition: clone(player.position),
        previousFacing: clone(player.facing),
        velocity: {
          x: F32(planned.position.x - player.position.x),
          y: F32(planned.position.y - player.position.y),
          z: F32(planned.position.z - player.position.z),
        },
        intelligence: { special: 0, move: 0, count: 0 },
        liveMotion: {
          ...planned.liveMotion,
          // run_action reaches the old target, find_zonal_target installs and
          // executes the replacement journey, then clears go_cnt this visit.
          goCount: 0,
        },
      };
    }
    const continuingResetDribble = player.intelligence.move === 0
      && player.intelligence.count === 0
      && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
      && player.liveMotion.kind === "run-with-ball"
      && player.liveContact === undefined
      && visit.possession.owner !== player.nativePlayerNumber;
    if (continuingResetDribble) {
      const continued = continueSourceSupportJourney(current, {
        ballPosition: visit.ballPosition,
        nextTick: input.nextTick,
        possession: visit.possession,
        processDirection: player.liveMotion.goCount > 1,
      });
      return {
        ...continued,
        intelligence: clone(player.intelligence),
        liveMotion: {
          ...continued.liveMotion,
          kind: "run-with-ball",
        },
      };
    }
    if (
      supportRun?.playerId === player.id
      || continuingSupportRun
    ) {
      const planned = planZonalPlayer(current, {
        allowSideStep: false,
        ballPosition: visit.ballPosition,
        nextTick: input.nextTick,
        possession: visit.possession,
        tactics,
        targetOverride: supportRun?.target ?? player.liveMotion.target,
        zoning: liveZoning(player, zones, visit.possession, input.zoneAnalogue),
      });
      return {
        ...planned,
        intelligence: {
          special: 0,
          move: RUN_ON_INTELLIGENCE_MOVE,
          count: supportRun === null
            ? player.intelligence.count - 1
            : planned.liveMotion.goCount + 1,
        },
        liveMotion: {
          ...planned.liveMotion,
          kind: "support-run",
          wantPassStat: supportRun?.wantPassStat ?? player.liveMotion.wantPassStat,
        },
      };
    }
    // process_teams is source-ordered: ball_interact may transfer possession
    // more than once before the completed team snapshot is published. The
    // player executes got_ball against the owner recorded at his own visit.
    if (visit.possession.owner === player.nativePlayerNumber) {
      if (!possessionRuns.has(player.id)) {
        throw new Error(`Team journey has no current possession intent for ${player.id}.`);
      }
      const continuing = player.intelligence.count > 1
        && player.liveMotion.kind === "run-with-ball";
      const dribble = continuing
        ? {
            target: clone(player.liveMotion.target),
            intelligenceCount: player.intelligence.count - 1,
            goCount: Math.max(0, player.liveMotion.goCount - 1),
            mustPass: player.liveMotion.mustPass === true,
          }
        : selectCssoccerDribbleRun({
            ball: {
              x: visit.ballPosition.x,
              y: visit.ballPosition.y,
            },
            pitch: {
              length: PITCH_LENGTH,
              ratio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
              width: PITCH_WIDTH,
            },
            player: {
              nativePlayer: player.nativePlayerNumber,
              position: { x: player.position.x, y: player.position.y },
              facing: clone(player.facing),
              flair: player.gameplay.flair,
              distance: visit.distance,
            },
            players: dribblePlayers,
            seed: input.rngSeed,
          });
      const planned = planZonalPlayer(current, {
        ballPosition: visit.ballPosition,
        nextTick: input.nextTick,
        possession: visit.possession,
        tactics,
        targetOverride: dribble.target,
        zoning: liveZoning(player, zones, visit.possession, input.zoneAnalogue),
      });
      return {
        ...planned,
        intelligence: {
          special: 0,
          move: 0,
          count: dribble.intelligenceCount,
        },
        liveMotion: {
          ...planned.liveMotion,
          kind: "run-with-ball",
          mustPass: dribble.mustPass,
          goCount: continuing
            ? dribble.goCount
            : Math.max(0, dribble.goCount - 1),
          // Busy I_DRIBBLE keeps the installed fstep. Contact recovery is the
          // exception: process_anims reinstalls locomotion after the team visit.
          animationFrameStep: continuing && player.liveContact === undefined
            ? player.animation.frameStep
            : planned.liveMotion.animationFrameStep,
        },
      };
    }
    return planZonalPlayer(current, {
      ballPosition: visit.ballPosition,
      nextTick: input.nextTick,
      possession: visit.possession,
      tactics,
      targetOverride: null,
      zoning: liveZoning(player, zones, visit.possession, input.zoneAnalogue),
    });
  });
}

/** INTELL.CPP get_target/tunnel_pos while RULES.CPP owns SWAP_ENDS. */
export function stepCssoccerFreePlayHalftimeTunnelJourney(input = {}) {
  requirePlainObject(input, "free-play halftime tunnel journey");
  requireExactKeys(input, [
    "ballPosition",
    "nextTick",
    "players",
    "possession",
    "teamRates",
    "tunnel",
  ], "free-play halftime tunnel journey");
  if (!Array.isArray(input.players) || input.players.length !== 22) {
    throw new Error("Halftime tunnel journey requires all 22 current players.");
  }
  if (!Number.isSafeInteger(input.nextTick) || input.nextTick < 1) {
    throw new TypeError("Halftime tunnel journey nextTick must be positive.");
  }
  const ballPosition = requireF32Point(input.ballPosition, "halftime tunnel ball");
  const tunnel = requireF32Point(input.tunnel, "halftime tunnel source anchor");
  const rates = currentRateMap(input.teamRates, input.players);
  const ratio = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  const transitionDistance = F32(ratio * 0.8);
  const approachY = tunnel.y > PITCH_WIDTH / 2 ? PITCH_WIDTH : 0;

  return input.players.map((player) => {
    if (player.liveMotion === undefined) {
      throw new Error(`Halftime tunnel journey lost current motion for ${player.id}.`);
    }
    const targetX = F32(tunnel.x + (player.nativeTeamSlot === "A" ? -ratio : ratio));
    const aligned = Math.abs(player.liveMotion.target.y - tunnel.y) < ratio
      || (
        player.position.x >= F32(targetX - transitionDistance)
        && player.position.x <= F32(targetX + transitionDistance)
      );
    const targetY = F32(aligned ? tunnel.y : approachY);
    // find_zonal_target stores tx/ty after subtracting the current position,
    // then init_run_act reconstructs go_tx/go_ty from those stored floats.
    // Preserve that f32 subtract/add boundary rather than retaining the
    // ideal tunnel coordinate across visits.
    const target = {
      x: F32(F32(targetX - player.position.x) + player.position.x),
      y: F32(F32(targetY - player.position.y) + player.position.y),
    };
    return planZonalPlayer({
      player,
      motion: player.liveMotion,
      teamRate: rates.get(player.id),
    }, {
      ballPosition,
      nextTick: input.nextTick,
      possession: input.possession,
      tactics: null,
      targetOverride: target,
      zoning: null,
    });
  });
}

function continueSourceSupportJourney(current, {
  ballPosition,
  nextTick,
  possession,
  processDirection,
}) {
  const { player, motion, teamRate } = current;
  const offset = {
    x: F32(motion.target.x - player.position.x),
    y: F32(motion.target.y - player.position.y),
  };
  const speed = actualPlayerSpeed({
    pitchLength: PITCH_LENGTH,
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
  const goDisplacement = motion.goStep
    ? clone(motion.goDisplacement)
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
  const facing = processDirection
    ? turnSourceFacing({
        facing: player.facing,
        target: motion.directionMode === 1
          ? {
              x: F32(ballPosition.x - position.x),
              y: F32(ballPosition.y - position.y),
            }
          : {
              x: F32(motion.target.x - position.x),
              y: F32(motion.target.y - position.y),
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
    velocity: { ...clone(goDisplacement), z: F32(0) },
    facing,
    intelligence: { special: 0, move: 0, count: 0 },
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
      goDisplacement,
      animationFrameStep: player.animation.frameStep,
    },
  };
}

/**
 * Resolve the source-global want_pass state visible when process_teams reaches
 * the current holder, together with any support run started on this visit.
 */
export function resolveCssoccerFreePlaySupportIntent(input = {}) {
  requirePlainObject(input, "free-play support intent");
  requireExactKeys(input, [
    "controlledPlayerId",
    "logicCount",
    "players",
    "possession",
    "rngSeed",
    "sourcePossession",
    "takerId",
    "visits",
  ], "free-play support intent");
  if (!Array.isArray(input.players) || input.players.length !== 22) {
    throw new Error("Free-play support intent requires all 22 current players.");
  }
  if (!Number.isSafeInteger(input.logicCount) || input.logicCount < 0) {
    throw new TypeError("Free-play support intent logicCount must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(input.rngSeed) || input.rngSeed < 0 || input.rngSeed > 127) {
    throw new TypeError("Free-play support intent RNG seed must be in 0..127.");
  }
  if (
    !Number.isSafeInteger(input.sourcePossession?.lastTouch)
    || input.sourcePossession.lastTouch < 0
    || input.sourcePossession.lastTouch > 22
  ) {
    throw new TypeError("Free-play support intent source lastTouch must be in 0..22.");
  }
  const sourceLastTouch = input.sourcePossession.lastTouch;
  const currentRequests = input.players.filter((player) => (
    player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
    && player.intelligence.count > 0
  ));
  if (currentRequests.length > 1) {
    throw new Error("Source want_pass has more than one current support owner.");
  }
  for (const player of currentRequests) {
    if (
      player.liveMotion?.kind !== "support-run"
      || !Number.isSafeInteger(player.liveMotion.wantPassStat)
      || player.liveMotion.wantPassStat < 1
      || player.liveMotion.wantPassStat > 22
    ) {
      throw new Error("Source want_pass lost its exact want_pass_stat owner.");
    }
  }
  // INTELL.CPP process_comments compares the player who owned the ball when
  // this request began (want_pass_stat) with the current last_touch. Any
  // change, including a same-team collection, clears the requester before
  // process_teams can install another I_RUN_ON request.
  const resetRequester = currentRequests.find(
    (player) => player.liveMotion.wantPassStat !== sourceLastTouch,
  );
  const players = resetRequester === undefined
    ? input.players
    : input.players.map((player) => player.id === resetRequester.id
      ? {
          ...player,
          intelligence: { special: 0, move: 0, count: 0 },
        }
      : player);
  const visits = currentVisitMap(input.visits, players);
  const holder = players.find(
    (player) => player.nativePlayerNumber === input.possession.owner,
  );
  if (input.possession.owner !== 0 && holder === undefined) {
    throw new Error("Free-play support intent lost the current ball holder.");
  }
  const continuing = holder === undefined
    ? []
    : players.filter((player) => (
        player.nativeTeamSlot === holder.nativeTeamSlot
        && player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
        && player.intelligence.count > 0
      ));
  if (continuing.length > 1) {
    throw new Error("Source want_pass has more than one current support owner.");
  }
  const run = continuing.length === 0
    ? selectSourceSupportRun({
        controlledPlayerId: input.controlledPlayerId,
        logicCount: input.logicCount,
        players,
        possession: input.possession,
        rngSeed: input.rngSeed,
        takerId: input.takerId,
        visits,
      })
    : null;
  const requester = continuing[0]
    ?? (run === null ? undefined : players.find(({ id }) => id === run.playerId));
  let holderWantPassNativePlayer = 0;
  if (holder !== undefined && requester !== undefined && requester.id !== holder.id) {
    const requesterIndex = input.visits.findIndex(({ playerId }) => playerId === requester.id);
    const holderIndex = input.visits.findIndex(({ playerId }) => playerId === holder.id);
    if (requesterIndex < 0 || holderIndex < 0) {
      throw new Error("Free-play support intent lost source traversal order.");
    }
    const clearsBeforeHolder = continuing.length === 1
      && requester.intelligence.count <= 1
      && requesterIndex < holderIndex;
    const startsBeforeHolder = continuing.length === 1 || requesterIndex < holderIndex;
    if (startsBeforeHolder && !clearsBeforeHolder) {
      holderWantPassNativePlayer = requester.nativePlayerNumber;
    }
  }
  return deepFreeze({
    holderWantPassNativePlayer,
    resetPlayerId: resetRequester?.id ?? null,
    run,
  });
}

function currentSupportRun(value, players) {
  if (value === null) return null;
  requirePlainObject(value, "team journey support run");
  requireExactKeys(
    value,
    ["playerId", "target", "wantPassStat"],
    "team journey support run",
  );
  if (!players.some(({ id }) => id === value.playerId)) {
    throw new Error("Team journey support run changed player identity.");
  }
  if (
    !Number.isSafeInteger(value.wantPassStat)
    || value.wantPassStat < 1
    || value.wantPassStat > 22
  ) {
    throw new TypeError("Team journey support run wantPassStat must be in 1..22.");
  }
  const target = requireF32Point(value.target, "team journey support target");
  return {
    playerId: value.playerId,
    target: { x: target.x, y: target.y },
    wantPassStat: value.wantPassStat,
  };
}

function selectSourceSupportRun({
  controlledPlayerId,
  logicCount,
  players,
  possession,
  rngSeed,
  takerId,
  visits,
}) {
  if (possession.owner === 0) return null;
  if (players.some((player) => (
    player.intelligence.move === RUN_ON_INTELLIGENCE_MOVE
    && player.intelligence.count > 0
  ))) return null;
  const holder = players.find(
    (player) => player.nativePlayerNumber === possession.owner,
  );
  if (holder === undefined) {
    throw new Error("Team journey support run lost the current ball holder.");
  }
  const holderSlot = holder.nativeTeamSlot;
  const holderVisit = visits.get(holder.id);
  if (holderVisit === undefined) {
    throw new Error("Team journey support run lost the holder visit.");
  }
  const ordered = players
    .filter((player) => player.nativeTeamSlot === holderSlot)
    .slice()
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
  const opponentsNearHolder = sourceOpponentCountNearBall({
    ballPosition: holderVisit.ballPosition,
    holder,
    players,
  });
  for (const player of ordered) {
    if (
      player.id === holder.id
      || player.id === controlledPlayerId
      || player.id === takerId
      || player.role === "keeper"
      || !player.active
      || player.action.action.value > 2
      || player.intelligence.count !== 0
      || !sourceThinkingTick(logicCount, player.gameplay.flair)
    ) continue;
    const visit = visits.get(player.id);
    if (visit === undefined) {
      throw new Error(`Team journey support run lost the visit for ${player.id}.`);
    }
    if (visit.distance >= CALL_DISTANCE) continue;
    const help = sourceHelpChance({
      ballPosition: visit.ballPosition,
      opponentsNearHolder,
      player,
      players,
    });
    if (rngSeed > Math.max(MIN_HELP_CHANCE, help)) continue;
    return {
      playerId: player.id,
      target: sourceSupportRunTarget({
        ballPosition: visit.ballPosition,
        holder,
        holderFacing: sourceHolderFacingAtRequesterVisit({ holder, requester: player }),
      }),
      wantPassStat: holder.nativePlayerNumber,
    };
  }
  return null;
}

function sourceThinkingTick(logicCount, flair) {
  const period = Math.trunc((130 - flair) / 2);
  if (period <= 0) throw new Error("Source thinking period must be positive.");
  return logicCount % period === 0;
}

function sourceOpponentCountNearBall({ ballPosition, holder, players }) {
  return players.filter((player) => (
    player.active
    && player.nativeTeamSlot !== holder.nativeTeamSlot
    && sourceDistance2d({
      x: F32(player.position.x - ballPosition.x),
      y: F32(player.position.y - ballPosition.y),
    }) <= DRIBBLE_DANGER_DISTANCE
  )).length;
}

function sourceHelpChance({ ballPosition, opponentsNearHolder, player, players }) {
  let x = F32(player.position.x - ballPosition.x);
  if (
    (player.nativeTeamSlot === "A" && x < 0)
    || (player.nativeTeamSlot === "B" && x > 0)
  ) x = F32(x * 2);
  const y = F32(ballPosition.y - player.position.y);
  const range = F32(
    sourceDistance2d({ x, y })
      / F32(CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 2),
  );
  const flairFactor = 64 + Math.trunc(player.gameplay.flair / 2);
  const holderPressure = Math.trunc(opponentsNearHolder * 80 * flairFactor / 128);
  const localPressure = Math.trunc(
    sourceOpponentCountAroundPlayer(player, players) * 64 * flairFactor / 128,
  );
  return Math.trunc(32 + holderPressure - localPressure - (range * range));
}

function sourceOpponentCountAroundPlayer(subject, players) {
  const x = Math.trunc(subject.position.x);
  const y = Math.trunc(subject.position.y);
  return players.filter((player) => (
    player.active
    && player.nativeTeamSlot !== subject.nativeTeamSlot
    && sourceDistance2d({
      x: F32(player.position.x - x),
      y: F32(player.position.y - y),
    }) <= DANGER_DISTANCE
  )).length;
}

function sourceHolderFacingAtRequesterVisit({ holder, requester }) {
  const holderRunsBeforeRequester = holder.nativePlayerNumber < requester.nativePlayerNumber;
  const continuesHeldBallRun = holder.action.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
    && holder.intelligence.move === 0
    && holder.intelligence.count > 1
    && holder.liveMotion?.kind === "run-with-ball";
  if (!holderRunsBeforeRequester || !continuesHeldBallRun) return holder.facing;

  // ACTIONS.CPP go_team visits same-team slots in ascending order and calls
  // process_dir after each player's action. A later we_have_ball requester
  // therefore reads the holder's already-turned tm_xdis/tm_ydis.
  return turnSourceFacing({
    facing: holder.facing,
    target: {
      x: F32(holder.liveMotion.target.x - holder.position.x),
      y: F32(holder.liveMotion.target.y - holder.position.y),
    },
    maxTurnRadians: projectCssoccerMotionSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      { teamRate: holder.liveMotion.teamRate },
    ).maxTurnRadians,
  }).facing;
}

function sourceSupportRunTarget({ ballPosition, holder, holderFacing }) {
  const x = F32(holder.nativeTeamSlot === "A"
    ? PITCH_LENGTH - ballPosition.x
    : -ballPosition.x);
  const y = F32((PITCH_WIDTH / 2) - ballPosition.y);
  const distance = sourceDistance2d({ x, y });
  const passDistance = F32(
    F32(CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 8)
      + (holder.gameplay.power / 3.6),
  );
  const difference = F32(
    (holderFacing.x * x / distance)
      + (holderFacing.y * y / distance),
  );
  const kickingDistance = F32(
    F32(passDistance * (2 + difference) / 2)
      - F32(CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 2),
  );
  if ((distance / 2) < kickingDistance) {
    return {
      x: F32(ballPosition.x + (x / 2)),
      y: F32(ballPosition.y + (y / 2)),
    };
  }
  return {
    x: F32(ballPosition.x + (x / distance * kickingDistance)),
    y: F32(ballPosition.y + (y / distance * kickingDistance)),
  };
}

function currentVisitMap(visits, players) {
  if (!Array.isArray(visits) || visits.length !== players.length) {
    throw new Error("Team journey continuation requires one source-order visit per player.");
  }
  const byId = new Map();
  for (const [index, visit] of visits.entries()) {
    requirePlainObject(visit, `team journey visit ${index}`);
    requireExactKeys(visit, [
      "ballPosition",
      "distance",
      "interaction",
      "nativePlayerNumber",
      "playerId",
      "possession",
    ], `team journey visit ${index}`);
    const player = players.find(({ id }) => id === visit.playerId);
    if (
      player === undefined
      || player.nativePlayerNumber !== visit.nativePlayerNumber
      || byId.has(visit.playerId)
    ) {
      throw new Error(`Team journey visit ${index} changed player identity.`);
    }
    const ballPosition = requireF32Point(
      visit.ballPosition,
      `team journey visit ${visit.playerId} ball`,
    );
    if (!Object.is(visit.distance, F32(visit.distance)) || visit.distance < 0) {
      throw new TypeError(`Team journey visit ${visit.playerId} distance is invalid.`);
    }
    if (!["collect", "hold", "kick-held", "none", "pass-release", "punt-release", "rebound", "same-team-skip", "shot-release", "skipped"].includes(
      visit.interaction,
    )) {
      throw new TypeError(`Team journey visit ${visit.playerId} interaction is invalid.`);
    }
    requirePlainObject(visit.possession, `team journey visit ${visit.playerId} possession`);
    requireExactKeys(
      visit.possession,
      ["inHands", "lastTouch", "owner"],
      `team journey visit ${visit.playerId} possession`,
    );
    for (const [field, value] of Object.entries(visit.possession)) {
      if (!Number.isSafeInteger(value) || value < 0 || value > 22) {
        throw new TypeError(`Team journey visit ${visit.playerId} ${field} is invalid.`);
      }
    }
    byId.set(visit.playerId, {
      ballPosition,
      distance: visit.distance,
      interaction: visit.interaction,
      possession: clone(visit.possession),
    });
  }
  return byId;
}

function openingZoning(player, zoning) {
  const slot = zoning[player.nativeTeamSlot];
  return {
    analogue: zoning.analogue,
    ballZone: slot.ballZone,
    zoneCenter: clone(slot.zoneCenter),
    teamInPossession: false,
  };
}

function liveZoning(player, zones, possession, analogue) {
  const slot = zones[player.nativeTeamSlot];
  const lastTouch = possession.lastTouch;
  return {
    analogue,
    ballZone: slot.ballZone,
    zoneCenter: slot.zoneCenter,
    teamInPossession: lastTouch !== 0 && (
      (player.nativeTeamSlot === "A" && lastTouch < 12)
      || (player.nativeTeamSlot === "B" && lastTouch > 11)
    ),
  };
}

function sourceBallForPlayer({
  nativePlayerNumber,
  takerNativePlayerNumber,
  sourceTick,
  preTaker,
  postTaker,
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

function requireCentreTaker(players, takerId) {
  const taker = players.find(({ id }) => id === takerId);
  if (taker === undefined || taker.role !== "taker") {
    throw new Error("Current centre transition lost its source-selected taker.");
  }
  return taker;
}

function currentCentreReceiverTarget(nativeTeamSlot) {
  if (nativeTeamSlot === "A") return { x: F32(720), y: F32(410) };
  if (nativeTeamSlot === "B") return { x: F32(560), y: F32(390) };
  throw new Error("Current centre receiver target requires native team A or B.");
}

function settlePlayer(
  { player, motion, teamRate },
  { ballPosition, nextTick, possession, rngSeed },
) {
  const target = {
    x: F32(ballPosition.x - player.position.x),
    y: F32(ballPosition.y - player.position.y),
  };
  const keeper = player.role === "keeper";
  const sameTeamPossession = possession.owner !== 0
    && (possession.owner < 12) === (player.nativePlayerNumber < 12);
  const adjustsSocks = keeper
    && sameTeamPossession
    && sourceDistance2d(target)
      > CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 50
    && rngSeed < SOCKS_PROBABILITY;
  const turnedFacing = target.x === 0 && target.y === 0
    ? clone(player.facing)
    : turnSourceFacing({
        facing: player.facing,
        target,
        maxTurnRadians: projectCssoccerMotionSourceProfile(
          CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
          { teamRate },
        ).maxTurnRadians,
      }).facing;
  const facing = adjustsSocks ? clone(player.facing) : turnedFacing;
  return updatePlayer(player, {
    nextTick,
    position: player.position,
    facing,
    actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
    liveMotion: {
      kind: adjustsSocks ? "socks" : "stand",
      teamRate,
      target: clone(ballPosition),
      goStep: motion.goStep,
      goCount: 0,
      goDisplacement: { x: F32(0), y: F32(0) },
      directionMode: adjustsSocks ? 2 : 1,
      resetAnimationFrame: true,
      sideStepDirection: null,
      animationId: adjustsSocks
        ? (rngSeed & 1 ? SOCKS_LEFT_ANIMATION : SOCKS_RIGHT_ANIMATION)
        : null,
      animationFrameStep: adjustsSocks ? SOCKS_FRAME_STEP : null,
    },
  });
}

function planZonalPlayer(
  { player, motion, teamRate },
  {
    allowSideStep = true,
    ballPosition,
    nextTick,
    possession,
    tactics,
    targetOverride,
    zoning,
  },
) {
  const zonal = targetOverride === null
    ? resolveCssoccerZonalTarget(tactics, {
        nativeTeamSlot: player.nativeTeamSlot,
        nativePlayerNumber: player.nativePlayerNumber,
        ballZone: zoning.ballZone,
        zoneCenter: zoning.zoneCenter,
        teamInPossession: zoning.teamInPossession,
        pitchLength: PITCH_LENGTH,
        pitchWidth: PITCH_WIDTH,
        analogue: zoning.analogue,
        ballPosition,
      })
    : null;
  const resolvedTarget = targetOverride ?? zonal.target;
  const firstOffset = zonal !== null && player.nativeTeamSlot === "B"
    ? {
        x: F32((PITCH_LENGTH - zonal.source.x) - player.position.x),
        y: F32((PITCH_WIDTH - zonal.source.y) - player.position.y),
      }
    : {
        x: F32(resolvedTarget.x - player.position.x),
        y: F32(resolvedTarget.y - player.position.y),
      };
  const target = zonal === null
    ? resolvedTarget
    : {
        x: F32(firstOffset.x + player.position.x),
        y: F32(firstOffset.y + player.position.y),
      };
  const offset = zonal === null
    ? firstOffset
    : {
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
  const alignment = sourceAngleCosine({ target: offset, facing: player.facing });
  let goStep = motion.goStep;
  let stepMode = 1;
  if (alignment >= Math.cos(motionProfile.maxTurnRadians)) {
    goStep = false;
    stepMode = 2;
  }
  const holdsPosition = player.role !== "keeper"
    && player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
    && distance <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8;
  const arrived = !holdsPosition && distance < travelProfile.imThereDistance;
  const sideStep = allowSideStep && !holdsPosition && !arrived && (
    (goStep && distance < travelProfile.stepRange * 2)
    || (!goStep && distance < travelProfile.stepRange)
  );
  const speed = actualPlayerSpeed({
    pitchLength: PITCH_LENGTH,
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

  let position;
  let facingTarget;
  let kind;
  let sideStepDirection = null;
  let goCount = 0;
  let goDisplacement = { x: F32(0), y: F32(0) };
  let resetAnimationFrame = false;
  if (holdsPosition) {
    position = { x: player.position.x, y: player.position.y };
    facingTarget = {
      x: F32(ballPosition.x - position.x),
      y: F32(ballPosition.y - position.y),
    };
    kind = "stand";
  } else if (arrived) {
    position = { x: target.x, y: target.y };
    facingTarget = {
      x: F32(ballPosition.x - position.x),
      y: F32(ballPosition.y - position.y),
    };
    kind = "stand";
    resetAnimationFrame = true;
  } else if (sideStep) {
    const initialGoCount = Math.trunc(distance / speed + 1);
    goDisplacement = {
      x: F32(offset.x / initialGoCount),
      y: F32(offset.y / initialGoCount),
    };
    goCount = Math.max(0, initialGoCount - 1);
    position = updateSourcePosition2d({
      position: { x: player.position.x, y: player.position.y },
      displacement: goDisplacement,
    });
    facingTarget = stepMode === 1
      ? {
          x: F32(ballPosition.x - position.x),
          y: F32(ballPosition.y - position.y),
        }
      : {
          x: F32(target.x - position.x),
          y: F32(target.y - position.y),
        };
    kind = "side-step";
    sideStepDirection = sourceSideStepDirection(player, target);
  } else {
    const travel = sourceGetThereTime({
      position: { x: player.position.x, y: player.position.y },
      target,
      facing: player.facing,
      speed: sourceFullPlayerSpeed({
        pitchLength: PITCH_LENGTH,
        teamRate,
        celebrating: false,
      }),
      maxTurn2Radians: travelProfile.maxTurn2Radians,
      imThereDistance: travelProfile.imThereDistance,
      canRotateAndRun: [
        CSSOCCER_NATIVE_ACTIONS.STAND,
        CSSOCCER_NATIVE_ACTIONS.RUN,
      ].includes(player.action.action.value),
      mustFace: null,
    });
    goCount = Math.max(0, travel.ticks - 1);
    if (travel.stopAndFace) {
      const turnTicks = Math.trunc(
        Math.abs(Math.acos(alignment) / motionProfile.maxTurnRadians),
      );
      const moveTicks = travel.ticks - turnTicks;
      if (moveTicks <= 0 || moveTicks >= 2000) {
        throw new Error(`Opening transition produced an invalid journey for ${player.id}.`);
      }
      goDisplacement = {
        x: F32(offset.x / moveTicks),
        y: F32(offset.y / moveTicks),
      };
      const mayStart = sourceAngleCosine({
        target: goDisplacement,
        facing: player.facing,
      }) >= Math.cos(motionProfile.maxTurnRadians);
      position = mayStart
        ? updateSourcePosition2d({
            position: { x: player.position.x, y: player.position.y },
            displacement: goDisplacement,
          })
        : { x: player.position.x, y: player.position.y };
      kind = mayStart ? "run" : "stand";
      resetAnimationFrame = true;
    } else {
      goDisplacement = sourceForwardDisplacement({
        facing: player.facing,
        targetOffset: offset,
        speed,
      }).displacement;
      position = updateSourcePosition2d({
        position: { x: player.position.x, y: player.position.y },
        displacement: goDisplacement,
      });
      kind = possession.owner === player.nativePlayerNumber
        ? "run-with-ball"
        : "run";
    }
    facingTarget = {
      x: F32(target.x - position.x),
      y: F32(target.y - position.y),
    };
  }
  const facing = facingTarget.x === 0 && facingTarget.y === 0
    ? clone(player.facing)
    : turnSourceFacing({
        facing: player.facing,
        target: facingTarget,
        maxTurnRadians: motionProfile.maxTurnRadians,
      }).facing;
  return updatePlayer(player, {
    nextTick,
    position: { ...position, z: player.position.z },
    facing,
    actionId: holdsPosition || arrived
      ? CSSOCCER_NATIVE_ACTIONS.STAND
      : CSSOCCER_NATIVE_ACTIONS.RUN,
    liveMotion: {
      kind,
      teamRate,
      target: clone(target),
      // init_stand_act does not clear the previous go_step flag. A later
      // run_back/find_zonal_target visit reads it when choosing STEP_RANGE.
      goStep: holdsPosition || arrived ? motion.goStep : sideStep,
      goCount,
      goDisplacement,
      directionMode: holdsPosition || arrived
        ? 1
        : sideStep && stepMode === 1 ? 1 : 0,
      resetAnimationFrame,
      sideStepDirection,
      animationId: null,
      animationFrameStep: null,
    },
  });
}

function updatePlayer(player, { nextTick, position, facing, actionId, liveMotion }) {
  const previousPosition = clone(player.position);
  const previousFacing = clone(player.facing);
  return {
    ...clone(player),
    previousPosition,
    previousFacing,
    position: clone(position),
    velocity: {
      x: F32(position.x - previousPosition.x),
      y: F32(position.y - previousPosition.y),
      z: F32(position.z - previousPosition.z),
    },
    facing: clone(facing),
    target: { ...clone(liveMotion.target), z: F32(0) },
    action: createCssoccerActionState({
      tick: nextTick,
      playerId: player.id,
      actionId,
      facingX: facing.x,
      facingY: facing.y,
    }),
    liveMotion: clone(liveMotion),
  };
}

function sourceSideStepDirection(player, target) {
  const vector = {
    x: F32(target.x - player.position.x),
    y: F32(target.y - player.position.y),
  };
  const distance = sourceDistance2d(vector);
  const normalized = {
    x: F32(vector.x / distance),
    y: F32(vector.y / distance),
  };
  return 1 + sourceFacingDirection({
    x: F32(
      (normalized.x * player.facing.x)
      + (normalized.y * player.facing.y)
    ),
    y: F32(
      (normalized.y * player.facing.x)
      - (normalized.x * player.facing.y)
    ),
  });
}

function currentTacticsState(tactics) {
  requirePlainObject(tactics, "free-play tactics");
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

function currentRateMap(teamRates, players) {
  if (!Array.isArray(teamRates) || teamRates.length !== 22) {
    throw new Error("Opening transition requires 22 explicit dynamic team rates.");
  }
  const byId = new Map();
  teamRates.forEach((entry, index) => {
    const player = players[index];
    if (
      entry.id !== player.id
      || entry.nativePlayerNumber !== player.nativePlayerNumber
      || entry.valueType !== "u8"
      || entry.numericBits !== entry.value.toString(16).padStart(2, "0")
    ) {
      throw new Error(`Opening transition team rate changed identity for ${player.id}.`);
    }
    byId.set(entry.id, entry.value);
  });
  return byId;
}

function requireF32Point(value, label) {
  requirePlainObject(value, label);
  const point = { x: value.x, y: value.y, z: value.z ?? F32(0) };
  if (Object.values(point).some((entry) => !Object.is(entry, F32(entry)))) {
    throw new TypeError(`${label} must contain exact float32 coordinates.`);
  }
  return point;
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function requirePlainObject(value, label) {
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

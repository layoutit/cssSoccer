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
  projectCssoccerMotionSourceProfile,
  projectCssoccerTravelSourceProfile,
} from "./nativeGameplayProfile.mjs";
import { selectCssoccerDribbleRun } from "./dribbleState.mjs";
import {
  createCssoccerTacticsState,
  resolveCssoccerZonalTarget,
} from "./tacticsState.mjs";
import {
  createCssoccerZoneState,
  stepCssoccerZoneState,
} from "./zoneState.mjs";

const F32 = Math.fround;
const PITCH_LENGTH = 1280;
const PITCH_WIDTH = 800;
const TEAM_A_RESTART_ZONE = 68;
const TEAM_B_RESTART_ZONE = 69;
const SOCKS_PROBABILITY = 15;
const SOCKS_RIGHT_ANIMATION = 62;
const SOCKS_LEFT_ANIMATION = 63;
const SOCKS_FRAME_STEP = F32(1 / (20 * 68 / 40));

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
      functions: ["find_zonal_target", "get_there_time", "intelligence"],
    },
  ],
  transition:
    "the first normal-play process_teams pass after centre readiness clears match_mode",
  currentStateOnly: true,
});

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
    "nextTick",
    "players",
    "possession",
    "receiverId",
    "rngSeed",
    "sourceTick",
    "tactics",
    "takerId",
    "teamRates",
  ], "free-play opening team transition");
  if (!Number.isSafeInteger(input.nextTick) || input.nextTick < 1) {
    throw new TypeError("Opening team transition nextTick must be a positive integer.");
  }
  if (!Number.isSafeInteger(input.sourceTick) || input.sourceTick !== input.nextTick - 1) {
    throw new TypeError("Opening team transition sourceTick must precede nextTick exactly.");
  }
  if (!Array.isArray(input.players) || input.players.length !== 22) {
    throw new Error("Opening team transition requires all 22 current players.");
  }
  if (!Array.isArray(input.kickoffMotion?.players) || input.kickoffMotion.players.length !== 22) {
    throw new Error("Opening team transition requires the settled 22-player kickoff motion.");
  }
  if (input.kickoffMotion.status !== "settled") {
    throw new Error("Opening team transition requires a settled current kickoff.");
  }
  const ballPosition = requireF32Point(input.ballPosition, "opening transition ball");
  const postTakerBallPosition = requireF32Point(
    input.postTakerBallPosition,
    "opening transition post-taker ball",
  );
  const tactics = currentTacticsState(input.tactics);
  const rates = currentRateMap(input.teamRates, input.players);
  const kickoffById = new Map(input.kickoffMotion.players.map((player) => [player.id, player]));
  const taker = requireCentreTaker(input.players, input.takerId);
  const receiverTarget = currentCentreReceiverTarget(taker.nativeTeamSlot);

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
      player.role === "keeper"
      || player.id === input.controlledPlayerId
    ) {
      return settlePlayer(current, {
        ballPosition: sourceBallPosition,
        nextTick: input.nextTick,
        possession: input.possession,
        rngSeed: input.rngSeed,
      });
    }
    return planZonalPlayer(current, {
      ballPosition: sourceBallPosition,
      nextTick: input.nextTick,
      possession: input.possession,
      tactics,
      targetOverride: player.id === input.receiverId
        ? receiverTarget
        : null,
      zoning: openingZoning(player),
    });
  });
}

/** Continue the source-ordered team visits while the centre taker is active. */
export function stepCssoccerFreePlayOpeningTeamContinuation(input = {}) {
  requirePlainObject(input, "free-play opening team continuation");
  requireExactKeys(input, [
    "ballPosition",
    "controlledPlayerId",
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
  ], "free-play opening team continuation");
  if (!Number.isSafeInteger(input.sourceTick) || input.sourceTick !== input.nextTick - 1) {
    throw new TypeError("Opening team continuation sourceTick must precede nextTick exactly.");
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
  const rates = currentRateMap(input.teamRates, input.players);
  const taker = requireCentreTaker(input.players, input.takerId);
  const receiverTarget = currentCentreReceiverTarget(taker.nativeTeamSlot);
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
    if (player.role === "keeper" || player.id === input.controlledPlayerId) {
      return settlePlayer(current, {
        ballPosition,
        nextTick: input.nextTick,
        possession: input.possession,
        rngSeed: input.rngSeed,
      });
    }
    return planZonalPlayer(current, {
      ballPosition,
      nextTick: input.nextTick,
      possession: input.possession,
      tactics,
      targetOverride: player.id === input.receiverId
        ? receiverTarget
        : null,
      zoning: openingZoning(player),
    });
  });
}

/** Continue ordinary current-state team work without consuming the local user visit. */
export function stepCssoccerFreePlayTeamJourneyContinuation(input = {}) {
  requirePlainObject(input, "free-play team journey continuation");
  requireExactKeys(input, [
    "controlledPlayerId",
    "nextTick",
    "possessionKicks",
    "players",
    "possessionRuns",
    "rngSeed",
    "tactics",
    "takerId",
    "teamRates",
    "visits",
    "zoneBallPosition",
  ], "free-play team journey continuation");
  if (!Array.isArray(input.players) || input.players.length !== 22) {
    throw new Error("Team journey continuation requires all 22 current players.");
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
  return input.players.map((player) => {
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
      return settlePlayer(current, {
        ballPosition: visit.ballPosition,
        nextTick: input.nextTick,
        possession: visit.possession,
        rngSeed: input.rngSeed,
      });
    }
    if (finalPossession.owner === player.nativePlayerNumber) {
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
        zoning: liveZoning(player, zones, visit.possession),
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
          goCount: continuing
            ? dribble.goCount
            : Math.max(0, dribble.goCount - 1),
        },
      };
    }
    return planZonalPlayer(current, {
      ballPosition: visit.ballPosition,
      nextTick: input.nextTick,
      possession: visit.possession,
      tactics,
      targetOverride: null,
      zoning: liveZoning(player, zones, visit.possession),
    });
  });
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

function openingZoning(player) {
  return {
    ballZone: player.nativeTeamSlot === "A"
      ? TEAM_A_RESTART_ZONE
      : TEAM_B_RESTART_ZONE,
    zoneCenter: { x: F32(0), y: F32(0) },
    teamInPossession: false,
  };
}

function liveZoning(player, zones, possession) {
  const slot = zones[player.nativeTeamSlot];
  const lastTouch = possession.lastTouch;
  return {
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
  { ballPosition, nextTick, possession, tactics, targetOverride, zoning },
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
        analogue: true,
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
  const holdsPosition = player.action.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
    && distance <= CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8;
  const arrived = !holdsPosition && distance < travelProfile.imThereDistance;
  const sideStep = !holdsPosition && !arrived && (
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
      goStep: !holdsPosition && !arrived && sideStep,
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

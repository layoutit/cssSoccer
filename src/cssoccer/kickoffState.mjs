import { assertCssoccerMatchLifecycle } from "./matchLifecycle.mjs";
import {
  sourceAngleCosine,
  sourceDistance2d,
} from "./motionState.mjs";
import { assertCssoccerTacticsState } from "./tacticsState.mjs";
import { assertCssoccerTeamState } from "./teamState.mjs";

const f32 = Math.fround;

export const CSSOCCER_KICKOFF_STATE_SCHEMA = "cssoccer-kickoff-state@1";
export const CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA = "cssoccer-kickoff-source-profile@1";
export const CSSOCCER_KICKOFF_ACTION_REQUEST_SCHEMA = "cssoccer-kickoff-action-request@1";
export const CSSOCCER_KICKOFF_LAUNCH_RECEIPT_SCHEMA = "cssoccer-parent-launch-receipt@1";

export const CSSOCCER_KICKOFF_CONSTANTS = deepFreeze({
  pitchLength: f32(1280),
  pitchWidth: f32(800),
  centreSpot: { x: f32(640), y: f32(400) },
  ballDiameter: f32(4),
  centreTacticRow: 68,
  defendingTacticRow: 69,
  centreDeadBallTicks: 40,
  centreGameAction: 1,
  centreSetPiece: 3,
  centreMatchMode: 5,
  normalMatchMode: 0,
  centrePassType: 5,
  readyDirectionMode: 6,
  readyRunningOffset: -2,
});

export const CSSOCCER_KICKOFF_NATIVE_PHASE_FIELD_CONTRACT = deepFreeze([
  { fieldId: "clock.clock_running", valueType: "u8" },
  { fieldId: "clock.match_half", valueType: "u8" },
  { fieldId: "lifecycle.kick_off", valueType: "u8" },
  { fieldId: "lifecycle.kickoff", valueType: "u8" },
  { fieldId: "lifecycle.team_a", valueType: "u8" },
  { fieldId: "lifecycle.team_b", valueType: "u8" },
  { fieldId: "rules.dead_ball_count", valueType: "i32" },
  { fieldId: "rules.game_action", valueType: "i16" },
  { fieldId: "rules.match_mode", valueType: "u8" },
  { fieldId: "rules.set_piece", valueType: "u8" },
]);

export const CSSOCCER_KICKOFF_SOURCE = deepFreeze({
  files: [
    {
      file: "FOOTBALL.CPP",
      sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
      producers: ["initial centre mode", "second-half centre mode", "clock_running", "kickoff"],
    },
    {
      file: "RULES.CPP",
      sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
      producers: ["centre_takers", "init_centre", "all_standing", "await_set_kick", "ready_set_kick"],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["plr_facing", "set_there_flags", "centre_pos", "get_target", "find_zonal_target"],
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: ["parent-owned pass launch"],
    },
  ],
  requiredProfile: [
    "KP_OFFLINE",
    "FACING_ANGLE",
    "BESIDE_BALL",
    "MAX_SETP_WAIT",
    "STAND_ACT",
    "RUN_ACT",
    "PICKUP_ACT",
    "referee action ids",
  ],
  sourceOrder: [
    "select two strict-first closest row-68 tactical positions",
    "hold ball at centre and publish centre dead-ball fields",
    "position taker, receiver, both teams, and keepers",
    "wait for all_standing, sticky already_there, and referee readiness",
    "request the source centre pass from the parent action/ball owner",
    "clear dead-ball fields and start the clock only with a matching launch receipt",
  ],
  unsupportedHere: [
    "player movement or action animation materialization",
    "referee movement materialization",
    "pass velocity, ball contact, possession, or receiver control",
    "goal-respot centre ownership",
  ],
});

export class CssoccerUnsupportedKickoffError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedKickoffError";
    this.code = "CSSOCCER_UNSUPPORTED_KICKOFF";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/**
 * Create the source-owned opening or post-swap centre state. The caller supplies
 * compiled constants that are not published by the prepared fixture; no native
 * capture is consulted by this reducer.
 */
export function createCssoccerKickoffState({
  lifecycle,
  tacticsState,
  sourceProfile,
} = {}) {
  const profile = requireSourceProfile(sourceProfile);
  assertCssoccerMatchLifecycle(lifecycle);
  const teamState = assertCssoccerTeamState(lifecycle.teamState);
  requireReadyTactics(tacticsState);
  const matchHalf = requireKickoffLifecycle(lifecycle);
  const teamBySlot = requireTeamBySlot(teamState.current.nativeTeamBySlot);
  const players = createTargetPlayers(teamState, tacticsState, profile, "A");
  const taker = players.find(({ role }) => role === "taker");
  const receiver = players.find(({ role }) => role === "receiver");
  const ownerCountry = teamBySlot.A;

  if (
    taker === undefined
    || receiver === undefined
    || taker.country !== ownerCountry
    || receiver.country !== ownerCountry
  ) {
    throw new Error("The centre taker and receiver must belong to current native team A.");
  }

  return assertCssoccerKickoffState(deepFreeze({
    schema: CSSOCCER_KICKOFF_STATE_SCHEMA,
    fixtureId: "spain-argentina-full-match",
    phase: "centre-positioning",
    phaseTick: 0,
    matchHalf,
    teamBySlot,
    owner: {
      country: ownerCountry,
      nativeTeamSlot: "A",
      fixtureTeamIndex: fixtureTeamIndex(ownerCountry),
      takerId: taker.id,
      takerNativePlayerNumber: taker.nativePlayerNumber,
      receiverId: receiver.id,
      receiverNativePlayerNumber: receiver.nativePlayerNumber,
    },
    players,
    ball: heldCentreBall(),
    rules: centreRules(),
    clock: {
      clockRunning: 0,
      matchHalf,
      kickoff: matchHalf === 0 ? 0 : 1,
    },
    readiness: {
      setPieceWaitTicks: profile.setPieceWaitTicks,
      alreadyThere: false,
      allStanding: false,
      refereeReady: false,
      readyForLaunch: false,
      players: null,
    },
    pendingAction: null,
    lastLaunchReceipt: null,
    bindings: kickoffBindings(teamState, tacticsState, profile),
    sourceProfile: profile,
  }));
}

/**
 * Resolve the source-owned player targets for any centre restart. Unlike the
 * opening-kickoff state machine, this pure setup accepts the native slot that
 * earned the restart and does not own player motion or launch timing.
 */
export function createCssoccerCentreSetup({
  lifecycle,
  tacticsState,
  sourceProfile,
  nativeTeamSlot,
} = {}) {
  const profile = requireSourceProfile(sourceProfile);
  assertCssoccerMatchLifecycle(lifecycle);
  const teamState = assertCssoccerTeamState(lifecycle.teamState);
  requireReadyTactics(tacticsState);
  requireTeamSlot(nativeTeamSlot, "centre native team slot");
  const teamBySlot = requireTeamBySlot(teamState.current.nativeTeamBySlot);
  const players = createTargetPlayers(
    teamState,
    tacticsState,
    profile,
    nativeTeamSlot,
  );
  const taker = players.find(({ role }) => role === "taker");
  const receiver = players.find(({ role }) => role === "receiver");
  const ownerCountry = teamBySlot[nativeTeamSlot];
  if (
    taker === undefined
    || receiver === undefined
    || taker.nativeTeamSlot !== nativeTeamSlot
    || receiver.nativeTeamSlot !== nativeTeamSlot
  ) {
    throw new Error(`Centre restart lost its native-team-${nativeTeamSlot} takers.`);
  }
  return deepFreeze({
    teamBySlot,
    owner: {
      country: ownerCountry,
      nativeTeamSlot,
      fixtureTeamIndex: fixtureTeamIndex(ownerCountry),
      takerId: taker.id,
      takerNativePlayerNumber: taker.nativePlayerNumber,
      receiverId: receiver.id,
      receiverNativePlayerNumber: receiver.nativePlayerNumber,
    },
    players,
    ball: heldCentreBall(),
    rules: {
      ...centreRules(),
      matchMode: nativeTeamSlot === "A" ? 5 : 6,
    },
  });
}

/**
 * Observe one positioning tick. Player kinematics are ordinary browser/runtime
 * state supplied by the parent scheduler, never retained native samples.
 */
export function stepCssoccerKickoffState(state, {
  players,
  refereeAction,
} = {}) {
  const current = assertCssoccerKickoffState(state);
  if (current.phase !== "centre-positioning") {
    throw new Error("Kickoff positioning may advance only before its parent launch request.");
  }
  requireInt16(refereeAction, "kickoff referee action");
  const officialIds = Object.values(current.sourceProfile.officialActionIds);
  if (!officialIds.includes(refereeAction)) {
    throw new CssoccerUnsupportedKickoffError(
      "referee-action",
      `Referee action ${refereeAction} is not bound by the kickoff source profile.`,
      { refereeAction },
    );
  }

  const observations = requirePlayerObservations(players, current.players);
  const observedPlayers = observations.map((observation, index) => (
    observePlayer(current, current.players[index], observation)
  ));
  const taker = observedPlayers.find(({ role }) => role === "taker");
  let setPieceWaitTicks = current.readiness.setPieceWaitTicks - 1;
  let allStanding;
  if (setPieceWaitTicks !== 0) {
    allStanding = observedPlayers.every(({ active, settled }) => !active || settled);
  } else {
    setPieceWaitTicks = 1;
    allStanding = true;
  }
  const alreadyThere = current.readiness.alreadyThere || taker.takerReady;
  const refereeReady = refereeAction === current.sourceProfile.officialActionIds.ready;
  const readyForLaunch = allStanding && alreadyThere && refereeReady;
  const readiness = deepFreeze({
    setPieceWaitTicks,
    alreadyThere,
    allStanding,
    refereeReady,
    readyForLaunch,
    players: observedPlayers,
  });
  const pendingAction = readyForLaunch
    ? kickoffActionRequest(current)
    : null;

  return assertCssoccerKickoffState(deepFreeze({
    ...clone(current),
    phase: readyForLaunch ? "action-pending" : "centre-positioning",
    phaseTick: current.phaseTick + 1,
    readiness,
    pendingAction,
  }));
}

/**
 * Apply the parent action/ball owner's exact launch receipt. The receipt binds
 * the implementation profile but deliberately carries no replay-fed ball data.
 */
export function completeCssoccerKickoffLaunch(state, receipt) {
  const current = assertCssoccerKickoffState(state);
  if (current.phase !== "action-pending" || current.pendingAction === null) {
    throw new Error("Kickoff launch completion requires the current centre-pass request.");
  }
  const checkedReceipt = requireLaunchReceipt(receipt, current.pendingAction);
  return assertCssoccerKickoffState(deepFreeze({
    ...clone(current),
    phase: "normal-play",
    ball: {
      status: "released-by-parent-launch",
      position: null,
      possession: null,
      launchProfileHash: checkedReceipt.profileHash,
    },
    rules: normalRules(),
    clock: {
      clockRunning: 1,
      matchHalf: current.matchHalf,
      kickoff: 0,
    },
    pendingAction: null,
    lastLaunchReceipt: checkedReceipt,
  }));
}

/** Return only fields owned by this reducer; launch-owned ball fields are absent. */
export function projectCssoccerKickoffNativePhaseFields(state) {
  const current = assertCssoccerKickoffState(state);
  const values = {
    "clock.clock_running": current.clock.clockRunning,
    "clock.match_half": current.clock.matchHalf,
    "lifecycle.kick_off": 1,
    "lifecycle.kickoff": current.clock.kickoff,
    "lifecycle.team_a": fixtureTeamIndex(current.teamBySlot.A),
    "lifecycle.team_b": fixtureTeamIndex(current.teamBySlot.B),
    "rules.dead_ball_count": current.rules.deadBallCount,
    "rules.game_action": current.rules.gameAction,
    "rules.match_mode": current.rules.matchMode,
    "rules.set_piece": current.rules.setPiece,
  };
  return deepFreeze(CSSOCCER_KICKOFF_NATIVE_PHASE_FIELD_CONTRACT.map((field) => (
    typedValue(field.fieldId, field.valueType, values[field.fieldId])
  )));
}

export function assertCssoccerKickoffState(state) {
  requirePlainObject(state, "cssoccer kickoff state");
  requireExactKeys(state, [
    "ball",
    "bindings",
    "clock",
    "fixtureId",
    "lastLaunchReceipt",
    "matchHalf",
    "owner",
    "pendingAction",
    "phase",
    "phaseTick",
    "players",
    "readiness",
    "rules",
    "schema",
    "sourceProfile",
    "teamBySlot",
  ], "cssoccer kickoff state");
  if (
    state.schema !== CSSOCCER_KICKOFF_STATE_SCHEMA
    || state.fixtureId !== "spain-argentina-full-match"
    || !["centre-positioning", "action-pending", "normal-play"].includes(state.phase)
    || !Number.isSafeInteger(state.phaseTick)
    || state.phaseTick < 0
    || ![0, 1].includes(state.matchHalf)
  ) {
    throw new Error(`cssoccer kickoff state must use ${CSSOCCER_KICKOFF_STATE_SCHEMA}.`);
  }

  const profile = requireSourceProfile(state.sourceProfile);
  const teamBySlot = requireTeamBySlot(state.teamBySlot);
  requireOwner(state.owner, teamBySlot);
  const players = requireTargetPlayers(state.players, state.owner, teamBySlot);
  requireBindings(state.bindings, profile);
  requireReadiness(state.readiness, profile, players, state.phase);
  requirePhaseState(state);
  return state;
}

function createTargetPlayers(teamState, tacticsState, profile, ownerSlot) {
  const roster = teamState.players
    .map((player) => ({
      id: player.id,
      country: player.country,
      nativeTeamSlot: player.current.nativeTeamSlot,
      nativePlayerNumber: player.current.nativePlayerNumber,
      active: player.current.active,
    }))
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
  requireNativeRoster(roster);
  const takers = selectCentreTakers(roster, tacticsState, ownerSlot);

  return deepFreeze(roster.map((player) => {
    let role = "outfield";
    let target;
    let targetOwner;
    if (player.nativePlayerNumber === 1) {
      role = "keeper";
      target = {
        x: profile.keeperOffline,
        y: f32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y - 1),
      };
      targetOwner = "INTELL.CPP find_zonal_target KP_A";
    } else if (player.nativePlayerNumber === 12) {
      role = "keeper";
      target = {
        x: f32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength - profile.keeperOffline),
        y: f32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y - 1),
      };
      targetOwner = "INTELL.CPP find_zonal_target KP_B";
    } else if (player.nativePlayerNumber === takers.taker) {
      role = "taker";
      target = {
        x: CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x,
        y: f32(
          CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y
            + (ownerSlot === "A" ? -10 : 10),
        ),
      };
      targetOwner = "INTELL.CPP centre_pos centre_guy_1";
    } else if (player.nativePlayerNumber === takers.receiver) {
      role = "receiver";
      target = {
        x: f32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x + 5),
        y: f32(
          CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y
            + (ownerSlot === "A" ? 10 : -10),
        ),
      };
      targetOwner = "INTELL.CPP centre_pos centre_guy_2";
    } else {
      const row = player.nativeTeamSlot === ownerSlot
        ? CSSOCCER_KICKOFF_CONSTANTS.centreTacticRow
        : CSSOCCER_KICKOFF_CONSTANTS.defendingTacticRow;
      const index = player.nativeTeamSlot === "A"
        ? player.nativePlayerNumber - 2
        : player.nativePlayerNumber - 13;
      const [sourceX, sourceY] = tacticsState.slots[player.nativeTeamSlot].values[row][index];
      target = player.nativeTeamSlot === "A"
        ? { x: f32(sourceX), y: f32(sourceY) }
        : {
          x: f32(CSSOCCER_KICKOFF_CONSTANTS.pitchLength - sourceX),
          y: f32(CSSOCCER_KICKOFF_CONSTANTS.pitchWidth - sourceY),
        };
      targetOwner = `INTELL.CPP get_target row ${row}`;
    }
    return {
      ...player,
      role,
      target: { x: f32(target.x), y: f32(target.y) },
      targetOwner,
    };
  }));
}

function selectCentreTakers(roster, tacticsState, ownerSlot) {
  const candidates = roster.filter(({ nativeTeamSlot, nativePlayerNumber, active }) => (
    nativeTeamSlot === ownerSlot
    && nativePlayerNumber >= (ownerSlot === "A" ? 2 : 13)
    && nativePlayerNumber <= (ownerSlot === "A" ? 11 : 22)
    && active
  ));
  if (candidates.length < 2) {
    throw new Error(`A centre restart requires two active native-team-${ownerSlot} outfield players.`);
  }
  const selected = [];
  for (let pass = 0; pass < 2; pass += 1) {
    let minimum = 1000;
    let picked = null;
    for (const candidate of candidates) {
      if (selected.includes(candidate.nativePlayerNumber)) continue;
      const index = candidate.nativePlayerNumber - (ownerSlot === "A" ? 2 : 13);
      const [x, y] = tacticsState.slots[ownerSlot].values[
        CSSOCCER_KICKOFF_CONSTANTS.centreTacticRow
      ][index];
      const distance = Math.trunc(sourceDistance2d({
        x: f32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x - f32(x)),
        y: f32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y - f32(y)),
      }));
      if (distance < minimum) {
        minimum = distance;
        picked = candidate.nativePlayerNumber;
      }
    }
    if (picked === null) throw new Error("The centre tactic row did not yield two takers.");
    selected.push(picked);
  }
  return { taker: selected[0], receiver: selected[1] };
}

function observePlayer(state, target, observation) {
  const actionIds = state.sourceProfile.actionIds;
  const settled = observation.action === actionIds.stand
    || observation.action === actionIds.pickup
    || observation.directionMode === CSSOCCER_KICKOFF_CONSTANTS.readyDirectionMode
    || (
      observation.action === actionIds.run
      && observation.offState === CSSOCCER_KICKOFF_CONSTANTS.readyRunningOffset
    );
  const targetVector = {
    x: f32(target.target.x - observation.position.x),
    y: f32(target.target.y - observation.position.y),
  };
  const targetDistance = sourceDistance2d(targetVector);
  let facingBall = false;
  let facingCosine = null;
  let takerReady = false;
  if (target.role === "taker") {
    const ballVector = {
      x: f32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x - observation.position.x),
      y: f32(CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y - observation.position.y),
    };
    facingCosine = sourceAngleCosine({
      target: ballVector,
      facing: observation.facing,
    });
    facingBall = facingCosine > state.sourceProfile.facingAngle;
    takerReady = observation.action === actionIds.stand
      && facingBall
      && targetDistance < f32(state.sourceProfile.besideBall * 3);
  }
  return deepFreeze({
    id: target.id,
    nativePlayerNumber: target.nativePlayerNumber,
    role: target.role,
    active: observation.active,
    action: observation.action,
    directionMode: observation.directionMode,
    offState: observation.offState,
    settled,
    targetDistance,
    facingCosine,
    facingBall,
    takerReady,
  });
}

function kickoffActionRequest(state) {
  return deepFreeze({
    schema: CSSOCCER_KICKOFF_ACTION_REQUEST_SCHEMA,
    type: "pass",
    nativePlayerNumber: state.owner.takerNativePlayerNumber,
    targetPlayerNumber: state.owner.receiverNativePlayerNumber,
    passType: CSSOCCER_KICKOFF_CONSTANTS.centrePassType,
    launch: "parent-owned",
  });
}

function heldCentreBall() {
  return deepFreeze({
    status: "held-at-centre",
    position: {
      x: CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x,
      y: CSSOCCER_KICKOFF_CONSTANTS.centreSpot.y,
      z: f32(CSSOCCER_KICKOFF_CONSTANTS.ballDiameter / 2),
    },
    possession: 0,
    launchProfileHash: null,
  });
}

function centreRules() {
  return deepFreeze({
    deadBallCount: CSSOCCER_KICKOFF_CONSTANTS.centreDeadBallTicks,
    gameAction: CSSOCCER_KICKOFF_CONSTANTS.centreGameAction,
    setPiece: CSSOCCER_KICKOFF_CONSTANTS.centreSetPiece,
    matchMode: CSSOCCER_KICKOFF_CONSTANTS.centreMatchMode,
  });
}

function normalRules() {
  return deepFreeze({
    deadBallCount: 0,
    gameAction: 0,
    setPiece: 0,
    matchMode: CSSOCCER_KICKOFF_CONSTANTS.normalMatchMode,
  });
}

function kickoffBindings(teamState, tacticsState, profile) {
  return deepFreeze({
    sourceProfileHash: profile.profileHash,
    teamAuthoritySha256: teamState.bindings.teamAuthoritySha256,
    nativeStateSha256: teamState.bindings.nativeStateSha256,
    nativeFieldContractSha256: teamState.bindings.nativeFieldContractSha256,
    tacticsTableSha256BySlot: {
      A: tacticsState.slots.A.tableSha256,
      B: tacticsState.slots.B.tableSha256,
    },
  });
}

function requireKickoffLifecycle(lifecycle) {
  const half = lifecycle.clock.matchHalf;
  const expectedPhase = half === 0
    ? "opening-kickoff"
    : "halftime-end-swap-second-half-kickoff";
  if (
    ![0, 1].includes(half)
    || lifecycle.clock.phase !== expectedPhase
    || lifecycle.clock.terminal
    || lifecycle.teamState.current.matchHalf !== half
  ) {
    throw new Error("Kickoff state requires the opening or post-swap second-half lifecycle boundary.");
  }
  return half;
}

function requireReadyTactics(state) {
  assertCssoccerTacticsState(state);
  if (state.status !== "ready") {
    throw new Error("Kickoff targets require the ready prepared F_4_3_3 tactic table.");
  }
  return state;
}

function requireSourceProfile(value) {
  if (value === undefined || value === null) {
    throw new CssoccerUnsupportedKickoffError(
      "source-profile",
      "Kickoff setup requires explicit compiled constants and action ids.",
      { required: CSSOCCER_KICKOFF_SOURCE.requiredProfile },
    );
  }
  requirePlainObject(value, "kickoff source profile");
  requireExactKeys(value, [
    "actionIds",
    "besideBall",
    "facingAngle",
    "keeperOffline",
    "officialActionIds",
    "profileHash",
    "schema",
    "setPieceWaitTicks",
  ], "kickoff source profile");
  if (
    value.schema !== CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA
    || !isSha256(value.profileHash)
  ) {
    throw new CssoccerUnsupportedKickoffError(
      "source-profile",
      `Kickoff source profile must use ${CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA} and a SHA-256 binding.`,
    );
  }
  requirePositiveF32(value.keeperOffline, "kickoff KP_OFFLINE");
  if (value.keeperOffline >= CSSOCCER_KICKOFF_CONSTANTS.centreSpot.x) {
    throw new RangeError("kickoff KP_OFFLINE must stay inside the half pitch.");
  }
  requireF32(value.facingAngle, "kickoff FACING_ANGLE");
  if (value.facingAngle < -1 || value.facingAngle > 1) {
    throw new RangeError("kickoff FACING_ANGLE must be in -1..1.");
  }
  requirePositiveF32(value.besideBall, "kickoff BESIDE_BALL");
  requirePositiveSafeInteger(value.setPieceWaitTicks, "kickoff MAX_SETP_WAIT");
  const actionIds = requireActionIds(value.actionIds);
  const officialActionIds = requireOfficialActionIds(value.officialActionIds);
  return deepFreeze({
    schema: value.schema,
    profileHash: value.profileHash,
    keeperOffline: value.keeperOffline,
    facingAngle: value.facingAngle,
    besideBall: value.besideBall,
    setPieceWaitTicks: value.setPieceWaitTicks,
    actionIds,
    officialActionIds,
  });
}

function requireActionIds(value) {
  requirePlainObject(value, "kickoff player action ids");
  requireExactKeys(value, ["pickup", "run", "stand"], "kickoff player action ids");
  for (const [name, action] of Object.entries(value)) {
    requireInt16(action, `kickoff ${name} action`);
  }
  if (new Set(Object.values(value)).size !== 3) {
    throw new Error("Kickoff stand, run, and pickup action ids must be distinct.");
  }
  return deepFreeze({ stand: value.stand, run: value.run, pickup: value.pickup });
}

function requireOfficialActionIds(value) {
  requirePlainObject(value, "kickoff referee action ids");
  requireExactKeys(value, ["normal", "positioning", "ready", "waitForKick"], "kickoff referee action ids");
  for (const [name, action] of Object.entries(value)) {
    requireInt16(action, `kickoff referee ${name} action`);
  }
  if (new Set(Object.values(value)).size !== 4) {
    throw new Error("Kickoff referee action ids must be distinct.");
  }
  return deepFreeze({
    normal: value.normal,
    positioning: value.positioning,
    ready: value.ready,
    waitForKick: value.waitForKick,
  });
}

function requirePlayerObservations(value, targets) {
  if (!Array.isArray(value) || value.length !== targets.length) {
    throw new Error("Kickoff positioning requires exactly 22 current player observations.");
  }
  const byId = new Map();
  for (const observation of value) {
    requirePlainObject(observation, "kickoff player observation");
    requireExactKeys(observation, [
      "action",
      "active",
      "directionMode",
      "facing",
      "id",
      "nativePlayerNumber",
      "offState",
      "position",
    ], "kickoff player observation");
    if (byId.has(observation.id)) throw new Error(`Duplicate kickoff observation ${observation.id}.`);
    requirePlayerId(observation.id, "kickoff observation id");
    requirePlayerNumber(observation.nativePlayerNumber, "kickoff observation native player");
    requireBoolean(observation.active, "kickoff observation active");
    requireInt16(observation.action, "kickoff observation action");
    requireInt16(observation.directionMode, "kickoff observation directionMode");
    requireInt16(observation.offState, "kickoff observation offState");
    requireF32Point(observation.position, "kickoff observation position");
    requireF32Point(observation.facing, "kickoff observation facing");
    byId.set(observation.id, observation);
  }
  return targets.map((target) => {
    const observation = byId.get(target.id);
    if (
      observation === undefined
      || observation.nativePlayerNumber !== target.nativePlayerNumber
      || observation.active !== target.active
    ) {
      throw new Error(`Kickoff observation identity/native slot diverged for ${target.id}.`);
    }
    return observation;
  });
}

function requireNativeRoster(roster) {
  if (
    roster.length !== 22
    || roster.some((player, index) => player.nativePlayerNumber !== index + 1)
    || new Set(roster.map(({ id }) => id)).size !== 22
  ) {
    throw new Error("Kickoff requires the exact 22-player native slot roster.");
  }
}

function requireTargetPlayers(value, owner, teamBySlot) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Kickoff state must retain exactly 22 player targets.");
  }
  const ids = new Set();
  const nativePlayers = new Set();
  for (const player of value) {
    requirePlainObject(player, "kickoff target player");
    requireExactKeys(player, [
      "active",
      "country",
      "id",
      "nativePlayerNumber",
      "nativeTeamSlot",
      "role",
      "target",
      "targetOwner",
    ], "kickoff target player");
    requirePlayerId(player.id, "kickoff target player id");
    requireCountry(player.country, "kickoff target player country");
    requireTeamSlot(player.nativeTeamSlot, "kickoff target player slot");
    requirePlayerNumber(player.nativePlayerNumber, "kickoff target player number");
    requireBoolean(player.active, "kickoff target player active");
    requireF32Point(player.target, "kickoff target");
    const expectedSlot = player.nativePlayerNumber < 12 ? "A" : "B";
    if (
      player.nativeTeamSlot !== expectedSlot
      || player.country !== teamBySlot[expectedSlot]
    ) {
      throw new Error(`Kickoff target identity/native slot diverged for ${player.id}.`);
    }
    if (!["keeper", "outfield", "receiver", "taker"].includes(player.role)) {
      throw new Error("Kickoff target player role is unsupported.");
    }
    if (typeof player.targetOwner !== "string" || player.targetOwner.length === 0) {
      throw new Error("Kickoff target player must retain its source owner.");
    }
    if (ids.has(player.id) || nativePlayers.has(player.nativePlayerNumber)) {
      throw new Error("Kickoff target player ids and native numbers must be unique.");
    }
    ids.add(player.id);
    nativePlayers.add(player.nativePlayerNumber);
  }
  const taker = value.find(({ role }) => role === "taker");
  const receiver = value.find(({ role }) => role === "receiver");
  if (
    value.filter(({ role }) => role === "keeper").length !== 2
    || value.filter(({ role }) => role === "taker").length !== 1
    || value.filter(({ role }) => role === "receiver").length !== 1
    || taker?.id !== owner.takerId
    || taker?.nativePlayerNumber !== owner.takerNativePlayerNumber
    || taker?.nativeTeamSlot !== "A"
    || receiver?.id !== owner.receiverId
    || receiver?.nativePlayerNumber !== owner.receiverNativePlayerNumber
    || receiver?.nativeTeamSlot !== "A"
  ) {
    throw new Error("Kickoff target roles diverged from the centre owner.");
  }
  return value;
}

function requireOwner(value, teamBySlot) {
  requirePlainObject(value, "kickoff owner");
  requireExactKeys(value, [
    "country",
    "fixtureTeamIndex",
    "nativeTeamSlot",
    "receiverId",
    "receiverNativePlayerNumber",
    "takerId",
    "takerNativePlayerNumber",
  ], "kickoff owner");
  requireCountry(value.country, "kickoff owner country");
  requirePlayerId(value.takerId, "kickoff taker id");
  requirePlayerId(value.receiverId, "kickoff receiver id");
  requirePlayerNumber(value.takerNativePlayerNumber, "kickoff taker native player");
  requirePlayerNumber(value.receiverNativePlayerNumber, "kickoff receiver native player");
  if (
    value.nativeTeamSlot !== "A"
    || value.country !== teamBySlot.A
    || value.fixtureTeamIndex !== fixtureTeamIndex(value.country)
    || value.takerId === value.receiverId
    || value.takerNativePlayerNumber === value.receiverNativePlayerNumber
  ) {
    throw new Error("Kickoff owner/taker mapping changed.");
  }
}

function requireBindings(value, profile) {
  requirePlainObject(value, "kickoff bindings");
  requireExactKeys(value, [
    "nativeFieldContractSha256",
    "nativeStateSha256",
    "sourceProfileHash",
    "tacticsTableSha256BySlot",
    "teamAuthoritySha256",
  ], "kickoff bindings");
  for (const key of ["nativeFieldContractSha256", "nativeStateSha256", "teamAuthoritySha256"]) {
    if (!isSha256(value[key])) throw new Error(`Kickoff binding ${key} must be SHA-256.`);
  }
  requirePlainObject(value.tacticsTableSha256BySlot, "kickoff tactic bindings");
  requireExactKeys(value.tacticsTableSha256BySlot, ["A", "B"], "kickoff tactic bindings");
  if (
    value.sourceProfileHash !== profile.profileHash
    || !isSha256(value.tacticsTableSha256BySlot.A)
    || !isSha256(value.tacticsTableSha256BySlot.B)
  ) {
    throw new Error("Kickoff source or tactic binding changed.");
  }
}

function requireReadiness(value, profile, targets, phase) {
  requirePlainObject(value, "kickoff readiness");
  requireExactKeys(value, [
    "allStanding",
    "alreadyThere",
    "players",
    "readyForLaunch",
    "refereeReady",
    "setPieceWaitTicks",
  ], "kickoff readiness");
  requirePositiveSafeInteger(value.setPieceWaitTicks, "kickoff set-piece wait ticks");
  if (value.setPieceWaitTicks > profile.setPieceWaitTicks) {
    throw new Error("Kickoff set-piece wait ticks exceeded the source profile.");
  }
  for (const key of ["allStanding", "alreadyThere", "readyForLaunch", "refereeReady"]) {
    requireBoolean(value[key], `kickoff readiness ${key}`);
  }
  if (value.players !== null) {
    if (!Array.isArray(value.players) || value.players.length !== targets.length) {
      throw new Error("Kickoff readiness must retain all 22 observed players.");
    }
    for (let index = 0; index < value.players.length; index += 1) {
      const player = requireObservedPlayer(value.players[index]);
      const target = targets[index];
      if (
        player.id !== target.id
        || player.nativePlayerNumber !== target.nativePlayerNumber
        || player.role !== target.role
        || player.active !== target.active
      ) {
        throw new Error(`Kickoff readiness identity diverged for ${target.id}.`);
      }
    }
  }
  if (
    value.readyForLaunch !== (value.allStanding && value.alreadyThere && value.refereeReady)
    || ((phase === "action-pending" || phase === "normal-play") && !value.readyForLaunch)
  ) {
    throw new Error("Kickoff readiness flags diverged from the phase.");
  }
}

function requireObservedPlayer(value) {
  requirePlainObject(value, "kickoff observed player");
  requireExactKeys(value, [
    "action",
    "active",
    "directionMode",
    "facingBall",
    "facingCosine",
    "id",
    "nativePlayerNumber",
    "offState",
    "role",
    "settled",
    "takerReady",
    "targetDistance",
  ], "kickoff observed player");
  requirePlayerId(value.id, "kickoff observed player id");
  requirePlayerNumber(value.nativePlayerNumber, "kickoff observed player number");
  requireInt16(value.action, "kickoff observed player action");
  requireInt16(value.directionMode, "kickoff observed player directionMode");
  requireInt16(value.offState, "kickoff observed player offState");
  requireBoolean(value.active, "kickoff observed player active");
  requireBoolean(value.settled, "kickoff observed player settled");
  requireBoolean(value.facingBall, "kickoff observed player facingBall");
  requireBoolean(value.takerReady, "kickoff observed player takerReady");
  requireF32(value.targetDistance, "kickoff observed player targetDistance");
  if (value.facingCosine !== null) requireF32(value.facingCosine, "kickoff observed player facingCosine");
  if (!["keeper", "outfield", "receiver", "taker"].includes(value.role)) {
    throw new Error("Kickoff observed player role is unsupported.");
  }
  return value;
}

function requirePhaseState(state) {
  requirePlainObject(state.ball, "kickoff ball");
  requireExactKeys(state.ball, ["launchProfileHash", "position", "possession", "status"], "kickoff ball");
  requirePlainObject(state.rules, "kickoff rules");
  requireExactKeys(state.rules, ["deadBallCount", "gameAction", "matchMode", "setPiece"], "kickoff rules");
  requirePlainObject(state.clock, "kickoff clock");
  requireExactKeys(state.clock, ["clockRunning", "kickoff", "matchHalf"], "kickoff clock");
  if (state.clock.matchHalf !== state.matchHalf) throw new Error("Kickoff clock half changed.");

  if (state.phase === "normal-play") {
    if (
      state.ball.status !== "released-by-parent-launch"
      || state.ball.position !== null
      || state.ball.possession !== null
      || !isSha256(state.ball.launchProfileHash)
      || !sameValue(state.rules, normalRules())
      || state.clock.clockRunning !== 1
      || state.clock.kickoff !== 0
      || state.pendingAction !== null
    ) {
      throw new Error("Normal-play kickoff state must be released by one parent launch.");
    }
    requireLaunchReceipt(state.lastLaunchReceipt, kickoffActionRequest(state));
    if (state.lastLaunchReceipt.profileHash !== state.ball.launchProfileHash) {
      throw new Error("Kickoff ball release and launch receipt hashes diverged.");
    }
    return;
  }

  if (
    !sameValue(state.ball, heldCentreBall())
    || !sameValue(state.rules, centreRules())
    || state.clock.clockRunning !== 0
    || state.clock.kickoff !== (state.matchHalf === 0 ? 0 : 1)
    || state.lastLaunchReceipt !== null
  ) {
    throw new Error("Active centre state must hold the ball and dead-ball fields.");
  }
  if (state.phase === "action-pending") {
    const expected = kickoffActionRequest(state);
    if (!sameValue(state.pendingAction, expected)) {
      throw new Error("Kickoff action-pending state changed its source centre pass.");
    }
  } else if (state.pendingAction !== null) {
    throw new Error("Kickoff positioning cannot expose a launch request before readiness.");
  }
}

function requireLaunchReceipt(value, request) {
  if (value === undefined || value === null) {
    throw new CssoccerUnsupportedKickoffError(
      "kick-launch",
      "The centre phase cannot enter live play without a parent launch receipt.",
      { request },
    );
  }
  requirePlainObject(value, "kickoff parent launch receipt");
  requireExactKeys(value, [
    "actionType",
    "nativePlayerNumber",
    "profileHash",
    "schema",
    "targetPlayerNumber",
    "type",
  ], "kickoff parent launch receipt");
  if (
    value.schema !== CSSOCCER_KICKOFF_LAUNCH_RECEIPT_SCHEMA
    || value.type !== "launch-applied"
    || value.actionType !== request.type
    || value.nativePlayerNumber !== request.nativePlayerNumber
    || value.targetPlayerNumber !== request.targetPlayerNumber
    || !isSha256(value.profileHash)
  ) {
    throw new CssoccerUnsupportedKickoffError(
      "kick-launch",
      "The parent launch receipt does not match the pending source centre pass.",
      { request },
    );
  }
  return deepFreeze(clone(value));
}

function requireTeamBySlot(value) {
  requirePlainObject(value, "kickoff teamBySlot");
  requireExactKeys(value, ["A", "B"], "kickoff teamBySlot");
  requireCountry(value.A, "kickoff native team A");
  requireCountry(value.B, "kickoff native team B");
  if (value.A === value.B) throw new Error("Kickoff native slots must contain different countries.");
  return deepFreeze({ A: value.A, B: value.B });
}

function fixtureTeamIndex(country) {
  requireCountry(country, "fixture team country");
  return country === "spain" ? 0 : 1;
}

function typedValue(fieldId, valueType, value) {
  requireNumericType(value, valueType, fieldId);
  return deepFreeze({
    fieldId,
    valueType,
    value,
    numericBits: numericBits(value, valueType),
  });
}

function requireNumericType(value, valueType, label) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer ${valueType}.`);
  }
  const [minimum, maximum] = ({
    i16: [-0x8000, 0x7fff],
    i32: [-0x80000000, 0x7fffffff],
    u8: [0, 0xff],
  })[valueType] ?? [];
  if (minimum === undefined || value < minimum || value > maximum) {
    throw new RangeError(`${label} is outside ${valueType}.`);
  }
}

function numericBits(value, valueType) {
  const bytes = valueType === "i32" ? 4 : valueType === "i16" ? 2 : 1;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "i32") view.setInt32(0, value, false);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else view.setUint8(0, value);
  return [...new Uint8Array(buffer)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function requireF32Point(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y"], label);
  requireF32(value.x, `${label} x`);
  requireF32(value.y, `${label} y`);
  return value;
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(f32(value), value)) {
    throw new TypeError(`${label} must be a finite, exactly rounded f32.`);
  }
}

function requirePositiveF32(value, label) {
  requireF32(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
}

function requireInt16(value, label) {
  if (!Number.isInteger(value) || value < -0x8000 || value > 0x7fff) {
    throw new TypeError(`${label} must be an i16 integer.`);
  }
}

function requirePositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
}

function requirePlayerNumber(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 22) {
    throw new TypeError(`${label} must be an integer in 1..22.`);
  }
}

function requirePlayerId(value, label) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} must be a fixed-fixture player id.`);
  }
}

function requireCountry(value, label) {
  if (value !== "spain" && value !== "argentina") {
    throw new Error(`${label} must be spain or argentina.`);
  }
}

function requireTeamSlot(value, label) {
  if (value !== "A" && value !== "B") throw new Error(`${label} must be A or B.`);
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
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

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!sameValue(actual, wanted)) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/u.test(value ?? "");
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

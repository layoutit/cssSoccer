import {
  CSSOCCER_BOUNDARY_CONSTANTS,
  CSSOCCER_MATCH_MODE,
} from "./boundaryState.mjs";
import {
  CSSOCCER_TACTICS_STATE_SCHEMA,
  assertCssoccerTacticsState,
} from "./tacticsState.mjs";

const f32 = Math.fround;

export const CSSOCCER_RESTART_STATE_SCHEMA = "cssoccer-restart-state@1";
export const CSSOCCER_OUT_OF_PLAY_DELAY_SCHEMA = "cssoccer-out-of-play-delay@1";

export const CSSOCCER_RESTART_CONSTANTS = deepFreeze({
  outOfPlayTicks: 25,
  pitchRatio: f32(CSSOCCER_BOUNDARY_CONSTANTS.pitchLength / 120),
  ballDiameter: f32(4),
  setPiece: { corner: 1, throwIn: 2, goalKick: 7 },
  deadBallTicks: { corner: 20, goalKick: 100, throwIn: 100 },
  setPieceWaitTicks: 5000,
  throwIntention: 6,
});

export const CSSOCCER_RESTART_SOURCE = deepFreeze({
  files: [
    {
      file: "RULES.CPP",
      sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
      producers: ["throw_taker", "get_taker", "init_corner", "init_gkick", "init_throw", "init_match_mode"],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["gkick_pos", "corner_pos", "throw_in_pos"],
    },
    {
      file: "BALL.CPP",
      sha256: "7d043a49395d3f5bd039188b8100dd40142e075aebf2fbe8fd2517c5a9e9bd99",
      producers: ["reset_ball", "respot_ball", "pitch_bounds"],
    },
    {
      file: "MATHS.CPP",
      sha256: "c7f61a26ce63ab439829f8c84a840f2c781704a44f2d06f149cf872013a96107",
      producers: ["calc_dist"],
    },
  ],
  semantics: [
    "out-of-play countdown starts at 25 and respots on the tick that reaches zero",
    "taker candidates are visited in native player-number order and strict first ties win",
    "team B tactical and special-position coordinates are mirrored through both pitch axes",
  ],
  integrationBoundary: {
    goalCrossing: "ball and goal reducers run before boundary classification",
    postGoalCentre: "B17 lifecycle/kickoff integration owns CENTRE_A and CENTRE_B execution",
  },
});

const DEFAULT_PREFERRED_KICKERS = deepFreeze({
  corner: { A: 0, B: 0 },
  goalKick: { A: 1, B: 12 },
});

const RESTART_SPECS = deepFreeze({
  CORNER_TL: cornerSpec("B", 64, 67, "left", "top"),
  CORNER_BL: cornerSpec("B", 66, 65, "left", "bottom"),
  CORNER_TR: cornerSpec("A", 65, 66, "right", "top"),
  CORNER_BR: cornerSpec("A", 67, 64, "right", "bottom"),
  GOAL_KICK_TL: goalKickSpec("A", 11, 20, "left", "top"),
  GOAL_KICK_BL: goalKickSpec("A", 19, 12, "left", "bottom"),
  GOAL_KICK_TR: goalKickSpec("B", 12, 19, "right", "top"),
  GOAL_KICK_BR: goalKickSpec("B", 20, 11, "right", "bottom"),
  THROW_IN_A: throwSpec("A"),
  THROW_IN_B: throwSpec("B"),
});

/** Bind the boundary decision to the native 25-tick BALL.CPP delay. */
export function createCssoccerOutOfPlayDelay(boundary) {
  const checked = requireBoundary(boundary);
  return deepFreeze({
    schema: CSSOCCER_OUT_OF_PLAY_DELAY_SCHEMA,
    status: "countdown",
    remainingTicks: CSSOCCER_RESTART_CONSTANTS.outOfPlayTicks,
    restartRequired: false,
    boundary: clone(checked),
  });
}

/** Advance exactly one native logic tick; the 25th call requests the respot. */
export function stepCssoccerOutOfPlayDelay(state) {
  requirePlainObject(state, "out-of-play delay");
  if (state.schema !== CSSOCCER_OUT_OF_PLAY_DELAY_SCHEMA) {
    throw new Error(`out-of-play delay must use ${CSSOCCER_OUT_OF_PLAY_DELAY_SCHEMA}.`);
  }
  requireBoundary(state.boundary);
  requireIntegerRange(state.remainingTicks, 0, CSSOCCER_RESTART_CONSTANTS.outOfPlayTicks, "remainingTicks");
  if (state.status !== "countdown" || state.restartRequired || state.remainingTicks === 0) {
    throw new Error("out-of-play delay has already reached its restart tick.");
  }
  const remainingTicks = state.remainingTicks - 1;
  return deepFreeze({
    schema: CSSOCCER_OUT_OF_PLAY_DELAY_SCHEMA,
    status: remainingTicks === 0 ? "restart-required" : "countdown",
    remainingTicks,
    restartRequired: remainingTicks === 0,
    boundary: clone(state.boundary),
  });
}

/**
 * Reproduce RULES.CPP's preferred-kicker and closest-tactical-position choice.
 * The browser must supply a prepared tactic table; no oracle state is read.
 */
export function selectCssoccerRestartTaker({
  kind,
  nativeTeamSlot,
  ballPosition,
  ballZones,
  players,
  tacticsState,
  preferredPlayerNumber = 0,
} = {}) {
  if (!["corner", "goal-kick", "throw-in"].includes(kind)) {
    throw new Error("kind must be corner, goal-kick, or throw-in.");
  }
  requireTeamSlot(nativeTeamSlot, "nativeTeamSlot");
  const ball = requirePoint(ballPosition, "ballPosition");
  const zones = requireBallZones(ballZones);
  const roster = requireRoster(players);
  requireReadyTactics(tacticsState);
  requirePreferredPlayer(preferredPlayerNumber, nativeTeamSlot);

  if (preferredPlayerNumber !== 0) {
    const preferred = roster[preferredPlayerNumber - 1];
    if (preferred.active > 0) return preferredPlayerNumber;
  }

  const first = nativeTeamSlot === "A"
    ? (kind === "goal-kick" ? 1 : 2)
    : (kind === "goal-kick" ? 12 : 13);
  const last = nativeTeamSlot === "A" ? 11 : 22;
  let minimum = 1000;
  let taker = 0;

  for (let playerNumber = first; playerNumber <= last; playerNumber += 1) {
    if (roster[playerNumber - 1].active <= 0) continue;
    const distance = Math.trunc(sourceDistanceFor({
      nativeTeamSlot,
      playerNumber,
      ball,
      zones,
      tacticsState,
    }));
    if (distance < minimum) {
      minimum = distance;
      taker = playerNumber;
    }
  }
  if (taker === 0) {
    throw new Error("No active restart taker is within the source 1000-unit selection bound.");
  }
  return taker;
}

/** Initialize source-exact corner, goal-kick, or throw-in state from a boundary result. */
export function initializeCssoccerRestart({
  boundary,
  players,
  tacticsState,
  seed,
  ballZones,
  preferredKickers = DEFAULT_PREFERRED_KICKERS,
} = {}) {
  const checkedBoundary = requireBoundary(boundary);
  const spec = RESTART_SPECS[checkedBoundary.mode];
  const roster = requireRoster(players);
  requireReadyTactics(tacticsState);
  requireIntegerRange(seed, 0, 127, "seed");
  const preferred = requirePreferredKickers(preferredKickers);
  const restartZones = spec.kind === "throw-in" ? requireBallZones(ballZones) : spec.zones;
  const ballPosition = restartBallPosition(checkedBoundary, spec);
  const preferredPlayerNumber = spec.kind === "corner"
    ? preferred.corner[spec.team]
    : spec.kind === "goal-kick"
      ? preferred.goalKick[spec.team]
      : 0;
  const taker = selectCssoccerRestartTaker({
    kind: spec.kind,
    nativeTeamSlot: spec.team,
    ballPosition,
    ballZones: restartZones,
    players: roster,
    tacticsState,
    preferredPlayerNumber,
  });
  const incidentPosition = restartIncidentPosition(checkedBoundary, spec, ballPosition);
  const takerTarget = restartTakerTarget({ spec, ballPosition, incidentPosition, seed });
  const lastTouch = spec.kind === "throw-in" ? (spec.team === "A" ? 1 : 12) : taker;

  return deepFreeze({
    schema: CSSOCCER_RESTART_STATE_SCHEMA,
    kind: spec.kind,
    mode: checkedBoundary.mode,
    matchMode: checkedBoundary.matchMode,
    awardedNativeTeam: spec.team,
    boundary: clone(checkedBoundary),
    source: CSSOCCER_RESTART_SOURCE,
    seed,
    ball: {
      position: { ...ballPosition, z: f32(CSSOCCER_RESTART_CONSTANTS.ballDiameter / 2) },
      displacement: { x: f32(0), y: f32(0), z: f32(0) },
      spin: { xy: f32(0), z: f32(0) },
      inAir: 0,
      inGoal: 0,
      inHands: 0,
      still: 1,
      outOfPlay: 0,
      possession: 0,
      lastTouch,
    },
    ballZones: clone(restartZones),
    incidentPosition,
    taker: {
      nativePlayerNumber: taker,
      nativeTeamSlot: spec.team,
      target: takerTarget,
      intention: spec.kind === "throw-in" ? CSSOCCER_RESTART_CONSTANTS.throwIntention : null,
      controllerRequest: "parent-owned",
    },
    preKeeperTouchPatch: spec.kind === "throw-in"
      ? { operation: "preserve" }
      : { operation: "set", value: taker },
    rules: {
      deadBallCount: CSSOCCER_RESTART_CONSTANTS.deadBallTicks[toCamelKind(spec.kind)],
      gameAction: 1,
      matchMode: checkedBoundary.matchMode,
      setPiece: CSSOCCER_RESTART_CONSTANTS.setPiece[toCamelKind(spec.kind)],
      setPieceTaker: taker,
      setPieceWaitCount: CSSOCCER_RESTART_CONSTANTS.setPieceWaitTicks,
      canBeOffside: 0,
      playAdvantage: 0,
      alreadyThere: 0,
      reselection: 0,
      support: 0,
      userTaker: 0,
    },
    clock: { stopClock: spec.kind === "throw-in" ? 1 : 0 },
  });
}

/** Emit the exact retained field subset used to qualify restart respots. */
export function projectCssoccerRestartTypedSamples(restart) {
  assertCssoccerRestartState(restart);
  const values = [
    ["ball.in_air", "i32", restart.ball.inAir],
    ["ball.in_goal", "u8", restart.ball.inGoal],
    ["ball.in_hands", "u8", restart.ball.inHands],
    ["ball.last_touch", "i32", restart.ball.lastTouch],
    ["ball.out_of_play", "i32", restart.ball.outOfPlay],
    ["ball.possession", "i32", restart.ball.possession],
    ["ball.spin_xy", "f32", restart.ball.spin.xy],
    ["ball.spin_z", "f32", restart.ball.spin.z],
    ["ball.still", "i32", restart.ball.still],
    ["ball.x", "f32", restart.ball.position.x],
    ["ball.x_displacement", "f32", restart.ball.displacement.x],
    ["ball.y", "f32", restart.ball.position.y],
    ["ball.y_displacement", "f32", restart.ball.displacement.y],
    ["ball.z", "f32", restart.ball.position.z],
    ["ball.z_displacement", "f32", restart.ball.displacement.z],
    ["clock.stop_clock", "u8", restart.clock.stopClock],
    ["rules.dead_ball_count", "i32", restart.rules.deadBallCount],
    ["rules.game_action", "i16", restart.rules.gameAction],
    ["rules.match_mode", "u8", restart.rules.matchMode],
    ["rules.set_piece", "u8", restart.rules.setPiece],
  ];
  return deepFreeze(values.map(([fieldId, valueType, value]) => ({
    fieldId,
    valueType,
    value,
    numericBits: numericBits(valueType, value),
  })));
}

export function assertCssoccerRestartState(state) {
  requirePlainObject(state, "restart state");
  if (state.schema !== CSSOCCER_RESTART_STATE_SCHEMA) {
    throw new Error(`restart state must use ${CSSOCCER_RESTART_STATE_SCHEMA}.`);
  }
  const boundary = requireBoundary(state.boundary);
  if (
    state.kind !== boundary.kind
    || state.mode !== boundary.mode
    || state.matchMode !== boundary.matchMode
    || state.awardedNativeTeam !== boundary.awardedNativeTeam
  ) {
    throw new Error("restart state diverged from its boundary decision.");
  }
  const spec = RESTART_SPECS[state.mode];
  requirePoint3(state.ball?.position, "restart ball position");
  requirePoint3(state.ball?.displacement, "restart ball displacement");
  requirePoint(state.ball?.spin, "restart ball spin", "xy", "z");
  requirePlayerNumber(state.ball.lastTouch, "restart lastTouch");
  requirePlayerNumber(state.taker?.nativePlayerNumber, "restart taker");
  if (state.taker.nativeTeamSlot !== spec.team) throw new Error("restart taker is in the wrong native slot.");
  if (state.rules?.matchMode !== state.matchMode || state.rules?.setPiece !== CSSOCCER_RESTART_CONSTANTS.setPiece[toCamelKind(spec.kind)]) {
    throw new Error("restart rule flags diverged from the restart mode.");
  }
  return state;
}

function cornerSpec(team, zoneA, zoneB, side, vertical) {
  return { kind: "corner", team, zones: { A: zoneA, B: zoneB }, side, vertical };
}

function goalKickSpec(team, zoneA, zoneB, side, vertical) {
  return { kind: "goal-kick", team, zones: { A: zoneA, B: zoneB }, side, vertical };
}

function throwSpec(team) {
  return { kind: "throw-in", team, zones: null, side: null, vertical: null };
}

function restartBallPosition(boundary, spec) {
  const { pitchLength, pitchWidth, centreY } = CSSOCCER_BOUNDARY_CONSTANTS;
  const ratio = CSSOCCER_RESTART_CONSTANTS.pitchRatio;
  if (spec.kind === "throw-in") return clone(boundary.incidentPosition);
  if (spec.kind === "corner") {
    return {
      x: spec.side === "left" ? f32(ratio - 1) : f32(pitchLength - ratio + 1),
      y: spec.vertical === "top" ? f32(ratio - 1) : f32(pitchWidth - ratio + 1),
    };
  }
  return {
    x: spec.side === "left" ? f32(5.8 * ratio) : f32(pitchLength - (5.8 * ratio)),
    y: spec.vertical === "top" ? f32(centreY - (5 * ratio)) : f32(centreY + (5 * ratio)),
  };
}

function restartIncidentPosition(boundary, spec, ball) {
  if (spec.kind === "throw-in") return clone(boundary.incidentPosition);
  if (spec.kind === "goal-kick") return clone(ball);
  return {
    x: f32(ball.x + (spec.side === "left" ? -4 : 4)),
    y: f32(ball.y + (spec.vertical === "top" ? -8 : 8)),
  };
}

function restartTakerTarget({ spec, ballPosition, incidentPosition, seed }) {
  let world;
  if (spec.kind === "corner") {
    world = clone(incidentPosition);
  } else if (spec.kind === "throw-in") {
    world = {
      x: incidentPosition.x,
      y: f32(incidentPosition.y + (incidentPosition.y < CSSOCCER_BOUNDARY_CONSTANTS.centreY ? -8 : 8)),
    };
  } else {
    const angle = f32((64 - seed) * (3.1415 / (8 * 64)));
    // RULES.CPP declares taker_x/taker_y as int. The trigonometric result is
    // therefore truncated on assignment before gkick_pos reads it as a float.
    world = {
      x: f32(Math.trunc(
        ballPosition.x + (spec.team === "A" ? -1 : 1) * (Math.cos(angle) * 4),
      )),
      y: f32(Math.trunc(ballPosition.y + (Math.sin(angle) * 4))),
    };
  }
  const sourceFrame = spec.team === "A" ? clone(world) : {
    x: f32(CSSOCCER_BOUNDARY_CONSTANTS.pitchLength - world.x),
    y: f32(CSSOCCER_BOUNDARY_CONSTANTS.pitchWidth - world.y),
  };
  return { world, sourceFrame };
}

function sourceDistanceFor({ nativeTeamSlot, playerNumber, ball, zones, tacticsState }) {
  let dx;
  let dy;
  if (playerNumber === 1) {
    dx = f32(ball.x);
    dy = f32(ball.y - CSSOCCER_BOUNDARY_CONSTANTS.centreY);
  } else if (playerNumber === 12) {
    // Preserve the RULES.CPP get_taker bug: pitch_len is used without ballx.
    dx = CSSOCCER_BOUNDARY_CONSTANTS.pitchLength;
    dy = f32(ball.y - CSSOCCER_BOUNDARY_CONSTANTS.centreY);
  } else {
    const outfieldIndex = nativeTeamSlot === "A" ? playerNumber - 2 : playerNumber - 13;
    const [targetX, targetY] = tacticsState.slots[nativeTeamSlot].values[zones[nativeTeamSlot]][outfieldIndex];
    dx = nativeTeamSlot === "A"
      ? f32(ball.x - targetX)
      : f32(f32(CSSOCCER_BOUNDARY_CONSTANTS.pitchLength - ball.x) - targetX);
    dy = nativeTeamSlot === "A"
      ? f32(ball.y - targetY)
      : f32(f32(CSSOCCER_BOUNDARY_CONSTANTS.pitchWidth - ball.y) - targetY);
  }
  const squared = f32(f32(dx * dx) + f32(dy * dy));
  return f32(Math.max(Math.sqrt(squared), 0.1));
}

function requireBoundary(value) {
  requirePlainObject(value, "boundary result");
  const spec = RESTART_SPECS[value.mode];
  if (
    !spec
    || value.kind !== spec.kind
    || value.matchMode !== CSSOCCER_MATCH_MODE[value.mode]
    || value.awardedNativeTeam !== spec.team
    || typeof value.boundary !== "string"
  ) {
    throw new Error("boundary result is not a supported exact restart decision.");
  }
  if (spec.kind === "throw-in") {
    requirePoint(value.incidentPosition, "throw-in incidentPosition");
    const expectedY = value.boundary === "top-touchline" ? 0 : value.boundary === "bottom-touchline" ? 799 : null;
    if (expectedY === null || value.incidentPosition.y !== expectedY) {
      throw new Error("throw-in boundary and incident position disagree.");
    }
  } else if (value.incidentPosition !== null) {
    throw new Error("goal-line boundary results must not contain an incident position.");
  } else if (value.boundary !== `${spec.side}-goal-line`) {
    throw new Error("goal-line boundary and restart mode disagree.");
  }
  return value;
}

function requireRoster(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("players must contain exactly 22 native roster entries.");
  }
  return value.map((player, index) => {
    requirePlainObject(player, `players[${index}]`);
    if (player.nativePlayerNumber !== index + 1 || !Number.isSafeInteger(player.active) || player.active < 0) {
      throw new Error("players must be in native order with a non-negative integer active value.");
    }
    return { nativePlayerNumber: player.nativePlayerNumber, active: player.active };
  });
}

function requireReadyTactics(value) {
  assertCssoccerTacticsState(value);
  if (value.schema !== CSSOCCER_TACTICS_STATE_SCHEMA || value.status !== "ready") {
    throw new Error("restart selection requires a ready prepared tactic table.");
  }
}

function requireBallZones(value) {
  requirePlainObject(value, "ballZones");
  requireIntegerRange(value.A, 0, 69, "ballZones.A");
  requireIntegerRange(value.B, 0, 69, "ballZones.B");
  return { A: value.A, B: value.B };
}

function requirePreferredKickers(value) {
  requirePlainObject(value, "preferredKickers");
  requirePlainObject(value.corner, "preferredKickers.corner");
  requirePlainObject(value.goalKick, "preferredKickers.goalKick");
  for (const team of ["A", "B"]) {
    requirePreferredPlayer(value.corner[team], team);
    requirePreferredPlayer(value.goalKick[team], team);
  }
  return value;
}

function requirePreferredPlayer(value, team) {
  if (!Number.isSafeInteger(value)) throw new TypeError("preferred player must be an integer.");
  if (value === 0) return;
  const minimum = team === "A" ? 1 : 12;
  const maximum = team === "A" ? 11 : 22;
  if (value < minimum || value > maximum) {
    throw new Error(`preferred player for team ${team} must be 0 or ${minimum}..${maximum}.`);
  }
}

function requirePoint(value, label, xKey = "x", yKey = "y") {
  requirePlainObject(value, label);
  if (!Number.isFinite(value[xKey]) || !Number.isFinite(value[yKey])) {
    throw new TypeError(`${label} must contain finite ${xKey} and ${yKey}.`);
  }
  return { [xKey]: f32(value[xKey]), [yKey]: f32(value[yKey]) };
}

function requirePoint3(value, label) {
  requirePlainObject(value, label);
  if (!["x", "y", "z"].every((key) => Number.isFinite(value[key]))) {
    throw new TypeError(`${label} must contain finite x, y, and z.`);
  }
}

function requirePlayerNumber(value, label) {
  requireIntegerRange(value, 1, 22, label);
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

function numericBits(valueType, value) {
  const bytes = valueType === "u8" ? 1 : valueType === "i16" ? 2 : 4;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "f32") view.setFloat32(0, f32(value), false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "u8") view.setUint8(0, value);
  else throw new Error(`Unsupported typed restart field ${valueType}.`);
  return [...new Uint8Array(buffer)].map((entry) => entry.toString(16).padStart(2, "0")).join("");
}

function toCamelKind(kind) {
  return kind === "goal-kick" ? "goalKick" : kind === "throw-in" ? "throwIn" : kind;
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

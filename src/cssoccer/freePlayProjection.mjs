import {
  CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
  CSSOCCER_NATIVE_FIELDS,
} from "./nativeFieldContract.mjs";
import { sourceFacingDirection } from "./motionState.mjs";
import { CSSOCCER_PRESENTATION_CAMERA_PRESET } from "./polycssScene.mjs";

export const CSSOCCER_FREE_PLAY_PROJECTION_SCHEMA =
  "cssoccer-free-play-native-field-projection@1";

const F32 = Math.fround;
const CAPTURE_ROOT_LOGIC_COUNT = 180;
const COUNTRY_INDEX = Object.freeze({ spain: 0, argentina: 1 });

/**
 * Project one immutable free-play snapshot onto the pinned native field
 * contract. This function observes current state only; it cannot advance the
 * engine and receives no reference samples or expected outcomes.
 */
export function projectCssoccerFreePlaySnapshot({
  snapshot,
  preparedScene,
  fields = CSSOCCER_NATIVE_FIELDS,
} = {}) {
  requireSnapshot(snapshot);
  requireFieldContract(fields);
  const camera = projectCamera(preparedScene);
  const match = snapshot.match;
  const values = new Map();

  projectBall(values, match);
  projectCameraFields(values, camera);
  projectClock(values, match);
  projectLifecycle(values, match);
  projectPlayers(values, match);
  projectRng(values, match);
  projectRules(values, match);
  projectScore(values, match);

  const projected = {};
  for (const field of fields) {
    if (!values.has(field.id)) {
      throw new Error(`Free-play projection has no current value for ${field.id}.`);
    }
    const value = values.get(field.id);
    requireTypedValue(value, field.valueType, field.id);
    projected[field.id] = value;
  }
  return deepFreeze({
    schema: CSSOCCER_FREE_PLAY_PROJECTION_SCHEMA,
    snapshotTick: snapshot.tick,
    phase: "post_tick",
    fieldContractSha256: CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
    values: projected,
  });
}

function projectBall(output, state) {
  const ball = state.ball.ball;
  set(output, "ball.in_air", ball.inAir);
  set(output, "ball.in_goal", ball.inGoal);
  set(output, "ball.in_hands", state.possession.inHands);
  set(output, "ball.last_touch", state.possession.lastTouch);
  set(output, "ball.out_of_play", ball.outOfPlay);
  set(output, "ball.possession", state.possession.owner);
  set(output, "ball.speed", ball.speed);
  set(output, "ball.spin_state", ball.spin.nativeState);
  set(output, "ball.spin_xy", ball.spin.xy);
  set(output, "ball.spin_z", ball.spin.z);
  set(output, "ball.still", ball.still);
  set(output, "ball.x", ball.position.x);
  set(output, "ball.x_displacement", ball.displacement.x);
  set(output, "ball.y", ball.position.y);
  set(output, "ball.y_displacement", ball.displacement.y);
  set(output, "ball.z", ball.position.z);
  set(output, "ball.z_displacement", ball.displacement.z);
}

function projectCamera(preparedScene) {
  const target = preparedScene?.cameraAnchor?.target;
  const preset = CSSOCCER_PRESENTATION_CAMERA_PRESET;
  if (!Array.isArray(target) || target.length !== 3 || target.some((value) => !Number.isFinite(value))) {
    throw new Error("Free-play projection requires the prepared camera anchor.");
  }
  const distance = F32(preset.perspective * preset.zoom);
  const pitch = preset.rotX * Math.PI / 180;
  const yaw = preset.rotY * Math.PI / 180;
  const horizontal = distance * Math.cos(pitch);
  const renderer = {
    x: target[0] + horizontal * Math.cos(yaw),
    y: target[1] - distance * Math.sin(pitch),
    z: target[2] + horizontal * Math.sin(yaw),
  };
  return deepFreeze({
    distance,
    fixed: 1,
    in_game: 1,
    mode: 0,
    target_x: F32(target[0]),
    target_y: F32(-target[2]),
    target_z: F32(target[1]),
    x: F32(renderer.x),
    y: F32(-renderer.z),
    z: F32(renderer.y),
  });
}

function projectCameraFields(output, camera) {
  for (const [name, value] of Object.entries(camera)) set(output, `camera.${name}`, value);
}

function projectClock(output, state) {
  const clock = state.clock;
  set(output, "clock.clock_running", clock.running ? 1 : 0);
  set(output, "clock.injury_time", 0);
  set(output, "clock.line_up", 0);
  // The adapter coordinate is the command tick; the resulting immutable
  // engine snapshot is one state tick ahead of that coordinate.
  set(output, "clock.logic_count", CAPTURE_ROOT_LOGIC_COUNT + Math.max(0, clock.tick - 1));
  set(output, "clock.match_half", clock.matchHalf);
  set(output, "clock.minutes", clock.gameMinute);
  set(output, "clock.rolling_clock", 0);
  set(output, "clock.seconds", F32(clock.gameSecond));
  // FOOTBALL.CPP's stop_clock flag is independent from whether the display
  // clock is currently running during the centre setup.
  set(output, "clock.stop_clock", 0);
  set(output, "clock.time_factor", state.config.timing.timeFactor);
}

function projectLifecycle(output, state) {
  set(output, "lifecycle.end_game", state.clock.terminal ? 1 : 0);
  set(output, "lifecycle.kick_off", state.kickoff.owner.nativeTeamSlot === "A" ? 1 : 0);
  // FOOTBALL.CPP's `kickoff` lifecycle global is not centre readiness; the
  // opening restart keeps it clear before, during, and after the centre pass.
  set(output, "lifecycle.kickoff", 0);
  set(output, "lifecycle.match_factor_fixed", 0);
  set(output, "lifecycle.team_a", COUNTRY_INDEX[state.config.teams.home]);
  set(output, "lifecycle.team_a_on", 1);
  set(output, "lifecycle.team_b", COUNTRY_INDEX[state.config.teams.away]);
  set(output, "lifecycle.team_b_on", 1);
  set(output, "lifecycle.watch", 1);
}

function projectPlayers(output, state) {
  const possession = new Map(
    state.possession.players.map((player) => [player.stableId, player.possession]),
  );
  for (const player of state.players) {
    const playerPossession = possession.get(player.id);
    if (playerPossession === undefined) {
      throw new Error(`Free-play projection lost possession state for ${player.id}.`);
    }
    const prefix = `players.${player.id}.`;
    const action = player.action.action.value;
    const selected = state.control.activePlayerId === player.id;
    set(output, `${prefix}action`, action);
    set(output, `${prefix}animation`, player.animation.id);
    set(output, `${prefix}animation_frame`, player.animation.frame);
    set(output, `${prefix}ball_state`, player.ballState);
    set(output, `${prefix}control`, selected ? 1 : 0);
    set(output, `${prefix}face_direction`, sourceFacingDirection(player.facing));
    set(output, `${prefix}native_player`, player.nativePlayerNumber);
    set(output, `${prefix}on`, player.active ? 1 : 0);
    set(output, `${prefix}possession`, playerPossession);
    set(output, `${prefix}stable_id`, player.id);
    set(output, `${prefix}x`, player.position.x);
    set(output, `${prefix}x_displacement`, player.facing.x);
    set(output, `${prefix}y`, player.position.y);
    set(output, `${prefix}y_displacement`, player.facing.y);
    set(output, `${prefix}z`, player.position.z);
    set(output, `${prefix}z_displacement`, player.velocity.z);
  }
}

function projectRng(output, state) {
  set(output, "rng.rand_seed", state.rng.state.randSeed);
  set(output, "rng.seed", state.rng.state.seed);
}

function projectRules(output, state) {
  set(output, "rules.dead_ball_count", state.rules.deadBallCount);
  set(output, "rules.direct_free_kick", 0);
  set(output, "rules.game_action", state.rules.gameAction);
  set(output, "rules.match_mode", state.rules.matchMode);
  set(output, "rules.offside_now", 0);
  set(output, "rules.offside_on", state.config.rules.offside ? 1 : 0);
  set(output, "rules.penalty_game", 0);
  set(output, "rules.set_piece", state.rules.setPiece);
}

function projectScore(output, state) {
  set(output, "score.goal_scorer", 0);
  set(output, "score.just_scored", 0);
  set(output, "score.team_a", state.score.goals[state.config.teams.home]);
  set(output, "score.team_b", state.score.goals[state.config.teams.away]);
}

function requireSnapshot(value) {
  if (
    value?.schema !== "cssoccer-free-play-snapshot@1"
    || !Number.isSafeInteger(value.tick)
    || value.tick < 0
    || value.match?.schema !== "cssoccer-free-play-state@1"
    || value.match.tick !== value.tick
  ) {
    throw new Error("Free-play projection requires one immutable engine snapshot.");
  }
}

function requireFieldContract(fields) {
  if (
    !Array.isArray(fields)
    || fields.length !== CSSOCCER_NATIVE_FIELDS.length
    || fields.some((field, index) => (
      field.id !== CSSOCCER_NATIVE_FIELDS[index].id
      || field.valueType !== CSSOCCER_NATIVE_FIELDS[index].valueType
    ))
  ) {
    throw new Error("Free-play projection requires the exact pinned field contract.");
  }
}

function requireTypedValue(value, type, fieldId) {
  if (type === "string") {
    if (typeof value !== "string") throw new TypeError(`${fieldId} must be string.`);
    return;
  }
  if (!Number.isFinite(value)) throw new TypeError(`${fieldId} must be finite.`);
  if (type === "f32") {
    if (!Object.is(F32(value), value)) throw new TypeError(`${fieldId} must be exact f32.`);
    return;
  }
  if (!Number.isSafeInteger(value)) throw new TypeError(`${fieldId} must be an integer.`);
  const width = Number(type.slice(1));
  const signed = type.startsWith("i");
  const minimum = signed ? -(2 ** (width - 1)) : 0;
  const maximum = signed ? (2 ** (width - 1)) - 1 : (2 ** width) - 1;
  if (value < minimum || value > maximum) throw new RangeError(`${fieldId} is outside ${type}.`);
}

function set(map, id, value) {
  if (map.has(id)) throw new Error(`Free-play projection duplicated ${id}.`);
  map.set(id, value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

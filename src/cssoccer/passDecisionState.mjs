import {
  normalizeSourceVector,
  sourceAngleCosine,
  sourceDistance2d,
} from "./motionState.mjs";
import {
  advanceCssoccerNativeRng,
  createCssoccerNativeRngState,
} from "./randomState.mjs";

const F32 = Math.fround;
const TURN_ACTION = 2;
const KICK_AHEAD_ANGLE = 0.966;
const VISION_MULTIPLIER = 5;
const DIAGONAL = 0.7071068;
const MAX_PASS_PROBABILITY = 5;
const MIN_PASS_PROBABILITY = 125;
const GREED_FACTOR = 100;
const PITCH_LENGTH = 1280;
const PITCH_CENTER_Y = 400;
const MIN_SHOOT_DISTANCE_MULTIPLIER = 12;
// INTELL.OBJ plr_facing compares against the emitted qword constant 0.95.
// The source comment says five degrees, but the compiled game is authoritative.
const FACING_ANGLE = 0.95;

export const CSSOCCER_PASS_DECISION_SOURCE = deepFreeze({
  file: "INTELL.CPP",
  sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
  producers: [
    "in_kicking_range",
    "can_i_pass",
    "angle_of_vis",
    "opp_around",
    "pass_decide",
  ],
  sourceLines: {
    firstTimeStrike: "1500-1605",
    angleOfVision: "4305-4340",
    opponentCount: "4386-4411",
    kickingRange: "6418-6454",
    candidateFilter: "6479-6640",
    preferenceAndSelection: "6664-6847",
  },
  constants: {
    diagonal: DIAGONAL,
    kickAheadAngle: KICK_AHEAD_ANGLE,
    maxPassProbability: MAX_PASS_PROBABILITY,
    minPassProbability: MIN_PASS_PROBABILITY,
    visionMultiplier: VISION_MULTIPLIER,
  },
  supportedBoundary:
    "ordinary or crossing outfield pass_decide for computer and local-user selection, with optional source want_pass candidate and no keeper throw",
});

/**
 * Resolve the ordinary source AI pass candidate table and its RNG side effects.
 *
 * This is roster/state driven: it has no fixture, tick, player-id, coordinate,
 * or expected-value branch. A selected pass is reported to the caller; a
 * rejected table leaves the caller free to continue got_ball into punt/run.
 */
export function resolveCssoccerAiNormalPass(input = {}) {
  if (input?.match?.cross === true) {
    throw new Error("AI normal-pass requires match.cross to be false.");
  }
  return resolveCssoccerAiPassDecision(input);
}

/** Resolve either ordinary or crossing pass_decide from source-owned state. */
export function resolveCssoccerAiPassDecision(input = {}) {
  requirePlainObject(input, "AI normal-pass input");
  requireExactKeys(input, ["ball", "holder", "match", "players", "rng"], "AI normal-pass input");
  const ball = requirePoint(input.ball, "AI normal-pass ball");
  const holder = requireHolder(input.holder);
  const match = requireMatch(input.match);
  const players = requirePlayers(input.players, holder.nativePlayer);
  let rng = createCssoccerNativeRngState(input.rng);

  if (match.ballInHands) {
    throw new Error(
      "AI pass decision does not support keeper throws.",
    );
  }

  // pass_decide builds the complete passee table before its preference loop
  // calls af_randomize. Every can_i_pass check therefore observes the same
  // entry seed; only scoring and weighted selection advance the RNG cursor.
  const passTable = buildSourcePassTable({
    ball,
    holder,
    match,
    players,
    seed: rng.seed,
  });

  const candidates = [];
  for (const { candidate, passType } of passTable) {
    const scored = sourcePreference({
      ball,
      candidate,
      holder,
      match,
      passType,
      players,
    });
    rng = advanceCssoccerNativeRng(rng);
    candidates.push({
      nativePlayer: candidate.nativePlayer,
      passType: passType === 5 && scored.pathThreat > rng.seed / 2 ? -1 : passType,
      preference: scored.preference,
      pathThreat: scored.pathThreat,
    });
  }

  candidates.sort((left, right) => (
    left.preference - right.preference
    || left.nativePlayer - right.nativePlayer
  ));

  let selected = null;
  for (const candidate of candidates) {
    rng = advanceCssoccerNativeRng(rng);
    let chance = Math.max(
      MAX_PASS_PROBABILITY,
      Math.min(MIN_PASS_PROBABILITY, candidate.preference),
    );
    if (match.setPiece) chance = Math.trunc(chance / 2);
    if (rng.seed > chance) {
      selected = candidate;
      break;
    }
  }
  if (selected === null && match.mustPass && candidates.length > 0) {
    [selected] = candidates;
  }

  return deepFreeze({
    outcome: selected === null ? "no-pass" : "pass",
    targetNativePlayer: selected?.nativePlayer ?? null,
    passType: selected?.passType ?? null,
    candidates,
    rng,
  });
}

/** Resolve pass_decide's deterministic local-user candidate preference. */
export function resolveCssoccerUserPassDecision(input = {}) {
  requirePlainObject(input, "user pass-decision input");
  requireExactKeys(
    input,
    ["ball", "holder", "match", "players", "rng"],
    "user pass-decision input",
  );
  const ball = requirePoint(input.ball, "user pass-decision ball");
  const holder = requireHolder(input.holder);
  const match = requireMatch(input.match);
  const players = requirePlayers(input.players, holder.nativePlayer);
  const rng = createCssoccerNativeRngState(input.rng);
  if (match.ballInHands) {
    throw new Error("User pass decision does not support keeper throws.");
  }

  // pass_decide does not call af_randomize on the user-controlled branch. It
  // gives preference zero to the closest candidate within plr_facing's five
  // degree cone, leaves all others at 100, then takes the first sorted entry.
  const passTable = buildSourcePassTable({
    ball,
    holder,
    match,
    players,
    seed: rng.seed,
  });
  let closestIndex = -1;
  let closestDistance = 2000;
  const candidates = passTable.map(({ candidate, passType }, index) => {
    const offset = {
      x: F32(candidate.position.x - holder.position.x),
      y: F32(candidate.position.y - holder.position.y),
    };
    const distance = sourceDistance2d(offset);
    const facing = (
      (offset.x * holder.facing.x) + (offset.y * holder.facing.y)
    ) / distance > FACING_ANGLE;
    if (facing && distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
    return {
      nativePlayer: candidate.nativePlayer,
      passType,
      preference: 100,
      facingDistance: facing ? distance : null,
    };
  });
  if (closestIndex >= 0) candidates[closestIndex].preference = 0;
  candidates.sort((left, right) => left.preference - right.preference);
  const selected = candidates[0] ?? null;
  return deepFreeze({
    outcome: selected === null ? "no-pass" : "pass",
    targetNativePlayer: selected?.nativePlayer ?? null,
    passType: selected?.passType ?? null,
    candidates,
    rng,
  });
}

/** Resolve user_spec_kick -> taker_pass_f for a standing directional press. */
export function resolveCssoccerUserDirectionalPass(input = {}) {
  requirePlainObject(input, "user directional-pass input");
  requireExactKeys(
    input,
    ["ball", "direction", "holder", "players", "rng"],
    "user directional-pass input",
  );
  const ball = requirePoint(input.ball, "user directional-pass ball");
  const direction = requirePoint(input.direction, "user directional-pass direction");
  const holder = requireHolder(input.holder);
  const players = requirePlayers(input.players, holder.nativePlayer);
  const rng = createCssoccerNativeRngState(input.rng);
  if (direction.x === 0 && direction.y === 0) {
    throw new Error("User directional pass requires a non-zero movement direction.");
  }
  const directionLength = sourceDistance2d(direction);
  const candidates = [];
  let selected = null;
  for (const candidate of sourceTeamMateOrder(players, holder.nativePlayer)) {
    if (!candidate.on || candidate.action > TURN_ACTION) continue;
    const offset = sourceIntegerOffset(candidate.position, ball);
    const distance = sourceDistance2d({ x: F32(offset.x), y: F32(offset.y) });
    const facing = (
      (offset.x * direction.x) + (offset.y * direction.y)
    ) / (distance * directionLength) > FACING_ANGLE;
    if (!facing) continue;
    const passType = sourcePassType({
      ball,
      candidate,
      holder,
      seed: rng.seed,
    });
    if (passType === 0) continue;
    const accepted = {
      nativePlayer: candidate.nativePlayer,
      passType,
      distance,
    };
    candidates.push(accepted);
    selected ??= accepted;
  }
  if (selected !== null) {
    return deepFreeze({
      outcome: "pass",
      targetNativePlayer: selected.nativePlayer,
      passType: selected.passType,
      candidates,
      rng,
    });
  }

  const normalizedDirection = normalizeSourceVector(direction);
  const relative = {
    x: F32(
      normalizedDirection.x * holder.facing.x
        + normalizedDirection.y * holder.facing.y,
    ),
    y: F32(
      normalizedDirection.y * holder.facing.x
        - normalizedDirection.x * holder.facing.y,
    ),
  };
  return deepFreeze({
    outcome: "directed",
    targetNativePlayer: 0,
    passType: 1 + sourceDirection(relative.x, relative.y),
    candidates,
    rng,
  });
}

function buildSourcePassTable({ ball, holder, match, players, seed }) {
  const passTable = [];
  if (match.wantPassNativePlayer !== 0) {
    const wanted = players.find(
      ({ nativePlayer }) => nativePlayer === match.wantPassNativePlayer,
    );
    if (
      wanted !== undefined
      && wanted.nativePlayer !== holder.nativePlayer
      && (
        wanted.controlled
        || match.setPiece
        || sourcePlayerFacingCandidate({ ball, candidate: wanted, holder })
      )
    ) {
      let passType = sourcePassType({ ball, candidate: wanted, holder, seed });
      if (passType === 0 && match.cross) {
        passType = sourceCrossPassType({ ball, candidate: wanted, holder });
      }
      if (passType !== 0) passTable.push({ candidate: wanted, passType });
    }
  }
  for (const candidate of sourceTeamMateOrder(players, holder.nativePlayer)) {
    if (candidate.nativePlayer === match.wantPassNativePlayer) continue;
    let passType = sourcePassType({ ball, candidate, holder, seed });
    if (passType !== 0) {
      if (!sourceCandidateVisible({
        ball,
        candidate,
        cross: match.cross,
        holder,
      })) continue;
    } else if (match.cross) {
      passType = sourceCrossPassType({ ball, candidate, holder });
    }
    if (passType === 0) continue;
    passTable.push({ candidate, passType });
  }
  return passTable;
}

function sourcePlayerFacingCandidate({ ball, candidate, holder }) {
  const offset = sourceIntegerOffset(candidate.position, ball);
  const distance = sourceDistance2d({ x: F32(offset.x), y: F32(offset.y) });
  return (
    (offset.x * holder.facing.x) + (offset.y * holder.facing.y)
  ) / distance > FACING_ANGLE;
}

/**
 * Replay the pass_decide side effects produced by a computer player's
 * first_time_strike checks across a go_to_path prediction scan.
 *
 * The source temporarily moves the ball to every predicted intercept point,
 * calls the ordinary pass decision, restores the ball, and keeps the advanced
 * global RNG state. Player distances deliberately remain the process_teams
 * distances supplied by the caller, matching the native temporary-ball path.
 */
export function resolveCssoccerFirstTimePassSearch(input = {}) {
  requirePlainObject(input, "first-time pass search input");
  requireExactKeys(input, [
    "holder",
    "match",
    "players",
    "predictions",
    "rng",
  ], "first-time pass search input");
  const holder = requireHolder(input.holder);
  const match = requireMatch(input.match);
  const players = requirePlayers(input.players, holder.nativePlayer);
  if (match.ballInHands || match.cross) {
    throw new Error("First-time pass search supports ordinary free-ball pass decisions only.");
  }
  if (!Array.isArray(input.predictions) || input.predictions.length > 25) {
    throw new TypeError("First-time pass predictions must contain at most 25 source points.");
  }
  const predictions = input.predictions.map((entry, index) => (
    requireFirstTimePrediction(entry, index)
  ));

  let rng = createCssoccerNativeRngState(input.rng);
  const evaluations = [];
  for (const prediction of predictions) {
    const beforeCalls = rng.calls;
    const decision = resolveCssoccerAiNormalPass({
      ball: prediction.ball,
      holder: {
        ...holder,
        facing: prediction.facing,
        // first_time_strike saves tm_srng, recomputes it from the temporary
        // fake_ball_poss point, and lets pass_decide observe that value when
        // neither shot nor punt was selected. Restore remains the caller's.
        shootingRange: sourceFirstTimeShootingRange(holder, prediction.ball),
      },
      match,
      players,
      rng,
    });
    rng = decision.rng;
    evaluations.push({
      ball: prediction.ball,
      facing: prediction.facing,
      outcome: decision.outcome,
      targetNativePlayer: decision.targetNativePlayer,
      passType: decision.passType,
      candidates: decision.candidates.map(({
        nativePlayer,
        passType,
        preference,
        pathThreat,
      }) => ({
        nativePlayer,
        passType,
        preference,
        pathThreat,
      })),
      candidateCount: decision.candidates.length,
      rngCalls: rng.calls - beforeCalls,
    });
  }

  return deepFreeze({ evaluations, rng });
}

function sourceFirstTimeShootingRange(holder, ball) {
  const goalX = holder.nativePlayer < 12 ? PITCH_LENGTH : 0;
  const goalOffset = {
    x: F32(goalX - ball.x),
    y: F32(PITCH_CENTER_Y - ball.y),
  };
  return sourceDistance2d(goalOffset)
    < (holder.pitchRatio * MIN_SHOOT_DISTANCE_MULTIPLIER) + (holder.power * 3);
}

function requireFirstTimePrediction(value, index) {
  const label = `first-time pass prediction ${index}`;
  requirePlainObject(value, label);
  requireExactKeys(value, ["ball", "facing"], label);
  return deepFreeze({
    ball: requirePoint(value.ball, `${label} ball`),
    facing: requirePoint(value.facing, `${label} facing`),
  });
}

function sourcePassType({ ball, candidate, holder, seed }) {
  if (!candidate.on || candidate.action > TURN_ACTION) return 0;
  const offset = sourceIntegerOffset(candidate.position, ball);
  const normalized = normalizeSourceVector({ x: F32(offset.x), y: F32(offset.y) });
  const distance = sourceDistance2d({ x: F32(offset.x), y: F32(offset.y) });
  const kickingDistance = F32((holder.pitchRatio * 8) + (holder.power / 3.6));
  const difference = F32(
    holder.facing.x * normalized.x + holder.facing.y * normalized.y,
  );
  let passType;
  if (difference > KICK_AHEAD_ANGLE) {
    if (distance > kickingDistance * 4) return 0;
    passType = distance > kickingDistance * 2 ? -1 : 5;
  } else {
    const directionalDistance = F32(kickingDistance * (1.5 + difference / 2));
    if (distance > directionalDistance) return 0;
    const relative = {
      x: F32(normalized.x * holder.facing.x + normalized.y * holder.facing.y),
      y: F32(normalized.y * holder.facing.x - normalized.x * holder.facing.y),
    };
    passType = 1 + sourceDirection(relative.x, relative.y);
  }

  let skillDirection = passType;
  if (skillDirection > 6 && skillDirection < 9) skillDirection -= 6;
  else if (skillDirection > 0 && skillDirection < 4) skillDirection = 4 - skillDirection;
  else return passType;
  return holder.flair > skillDirection * seed * 0.5 ? passType : 0;
}

function sourceCandidateVisible({ ball, candidate, cross, holder }) {
  const offset = sourceIntegerOffset(candidate.position, ball);
  const integerDistance = Math.trunc(sourceDistance2d({
    x: F32(offset.x),
    y: F32(offset.y),
  }));
  if (integerDistance > holder.vision * VISION_MULTIPLIER) return false;
  const kickingDistance = F32((holder.pitchRatio * 8) + (holder.power / 3.6));
  const closeEnough = Math.trunc(integerDistance / 2) < kickingDistance;
  let visible = closeEnough;
  if (!visible && cross) {
    const projectedX = offset.x + holder.position.x;
    const attackingBox = holder.nativePlayer < 12
      ? projectedX > holder.pitchRatio * 102
      : projectedX < holder.pitchRatio * 18;
    visible = Math.trunc(integerDistance / 2) > kickingDistance && attackingBox;
  } else if (!visible) {
    const facing = normalizeSourceVector(holder.facing);
    const angle = (
      (offset.x * facing.x) + (offset.y * facing.y)
    ) / candidate.distanceToBall;
    visible = angle >= DIAGONAL;
  }
  if (!visible) return false;
  const keeper = candidate.nativePlayer === 1 || candidate.nativePlayer === 12;
  return !keeper || candidate.distanceToBall >= holder.pitchRatio * 10;
}

function sourceCrossPassType({ ball, candidate, holder }) {
  if (!candidate.on || candidate.action > TURN_ACTION) return 0;
  const offset = sourceIntegerOffset(candidate.position, ball);
  const distance = Math.trunc(sourceDistance2d({
    x: F32(offset.x),
    y: F32(offset.y),
  }));
  if (
    distance > holder.vision * VISION_MULTIPLIER * 1.4
    || distance <= holder.pitchRatio * 8
  ) {
    return 0;
  }
  const attackingBox = holder.nativePlayer < 12
    ? candidate.position.x > holder.pitchRatio * 102
    : candidate.position.x < holder.pitchRatio * 18;
  if (!attackingBox) return 0;
  const alignment = sourceAngleCosine({
    target: { x: F32(offset.x), y: F32(offset.y) },
    facing: holder.facing,
  });
  if (alignment <= -0.174 || alignment >= 0.707) return 0;
  return holder.facing.x * offset.y > holder.facing.y * offset.x ? 16 : 17;
}

function sourcePreference({ ball, candidate, holder, match, passType, players }) {
  const dangerArea = F32(holder.pitchRatio * 8);
  const opponentCount = players.filter((player) => (
    opposingTeams(player.nativePlayer, candidate.nativePlayer)
    && player.on
    && Math.trunc(sourceDistance2d({
      x: F32(player.position.x - Math.trunc(candidate.position.x)),
      y: F32(player.position.y - Math.trunc(candidate.position.y)),
    })) <= dangerArea
  )).length;
  let preference = 64 + opponentCount * (64 + Math.trunc(holder.flair / 2));
  const optimumDistance = F32(holder.pitchRatio * 10);
  if (candidate.distanceToBall < optimumDistance) {
    preference = Math.trunc(preference + optimumDistance - candidate.distanceToBall);
  }

  // Preserve the source comparison exactly: GOAL_KICK_BR (10) < mode <
  // GOAL_KICK_TL (7) is impossible, so ordinary builds always take -64.
  preference -= 64;
  if (holder.shootingRange) preference += GREED_FACTOR;

  const candidateIndex = candidate.nativePlayer - 1;
  const back = candidateIndex > 11
    ? candidate.position.x > holder.position.x
    : candidate.position.x < holder.position.x;
  const xDifference = candidateIndex > 11
    ? candidate.position.x - holder.position.x
    : holder.position.x - candidate.position.x;
  const directionPenalty = back
    ? (xDifference * holder.flair) / 128
    : (xDifference / 5) * holder.flair / 128;
  preference = Math.trunc(preference + directionPenalty);

  const target = {
    x: F32((candidate.position.x - ball.x) / candidate.distanceToBall),
    y: F32((candidate.position.y - ball.y) / candidate.distanceToBall),
  };
  let pathThreat = F32(0);
  for (const opponent of players.filter((player) => (
    opposingTeams(player.nativePlayer, candidate.nativePlayer)
  ))) {
    if (!opponent.on || opponent.distanceToBall >= candidate.distanceToBall * 1.25) continue;
    const direction = {
      x: F32((opponent.position.x - ball.x) / opponent.distanceToBall),
      y: F32((opponent.position.y - ball.y) / opponent.distanceToBall),
    };
    let alignment = F32(target.x * direction.x + target.y * direction.y);
    if (alignment <= 0) continue;
    alignment = F32(
      alignment * alignment
        * (96 + Math.trunc(holder.flair / 2))
        * candidate.distanceToBall / opponent.distanceToBall,
    );
    pathThreat = F32(pathThreat + alignment * Math.trunc(holder.flair / 32));
  }
  preference = Math.trunc(preference + (passType === 16 || passType === 17
    ? pathThreat / 5
    : pathThreat));
  if (passType === 16 || passType === 17) preference = Math.trunc(preference / 4);
  if (match.wantPassNativePlayer === candidate.nativePlayer) {
    preference -= candidate.flair;
  }
  return { preference, pathThreat };
}

function sourceTeamMateOrder(players, holderNativePlayer) {
  return players
    .filter((candidate) => (
      candidate.nativePlayer !== holderNativePlayer
      && !opposingTeams(candidate.nativePlayer, holderNativePlayer)
    ))
    .sort((left, right) => right.nativePlayer - left.nativePlayer);
}

function opposingTeams(left, right) {
  return (left <= 11) !== (right <= 11);
}

function sourceIntegerOffset(position, ball) {
  return {
    x: Math.trunc(position.x - ball.x),
    y: Math.trunc(position.y - ball.y),
  };
}

function sourceDirection(x, y) {
  if (y >= 0) {
    if (x >= 0) {
      if (x > y) return x > y * 2 ? 4 : 3;
      return y > x * 2 ? 2 : 3;
    }
    if (-x > y) return -x > y * 2 ? 0 : 1;
    return y > -x * 2 ? 2 : 1;
  }
  if (x >= 0) {
    if (x > -y) return x > -y * 2 ? 4 : 5;
    return -y > x * 2 ? 6 : 5;
  }
  if (-x > -y) return -x > -y * 2 ? 0 : 7;
  return -y > -x * 2 ? 6 : 7;
}

function requireHolder(value) {
  requirePlainObject(value, "AI normal-pass holder");
  requireExactKeys(value, [
    "facing",
    "flair",
    "nativePlayer",
    "pitchRatio",
    "position",
    "power",
    "shootingRange",
    "vision",
  ], "AI normal-pass holder");
  return deepFreeze({
    nativePlayer: requireInteger(value.nativePlayer, 1, 22, "holder nativePlayer"),
    position: requirePoint(value.position, "holder position"),
    facing: requirePoint(value.facing, "holder facing"),
    pitchRatio: requirePositiveFinite(value.pitchRatio, "holder pitchRatio"),
    power: requireInteger(value.power, 0, 255, "holder power"),
    flair: requireInteger(value.flair, 0, 255, "holder flair"),
    vision: requireInteger(value.vision, 0, 255, "holder vision"),
    shootingRange: requireBoolean(value.shootingRange, "holder shootingRange"),
  });
}

function requireMatch(value) {
  requirePlainObject(value, "AI normal-pass match");
  requireExactKeys(value, [
    "ballInHands",
    "cross",
    "mustPass",
    "setPiece",
    "wantPassNativePlayer",
  ], "AI normal-pass match");
  return deepFreeze({
    ballInHands: requireBoolean(value.ballInHands, "match ballInHands"),
    cross: requireBoolean(value.cross, "match cross"),
    mustPass: requireBoolean(value.mustPass, "match mustPass"),
    setPiece: requireBoolean(value.setPiece, "match setPiece"),
    wantPassNativePlayer: requireInteger(
      value.wantPassNativePlayer,
      0,
      22,
      "match wantPassNativePlayer",
    ),
  });
}

function requirePlayers(value, holderNativePlayer) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 22) {
    throw new TypeError("AI normal-pass players must contain 2..22 source players.");
  }
  const seen = new Set();
  const players = value.map((entry, index) => {
    requirePlainObject(entry, `AI normal-pass player ${index}`);
    requireExactKeys(entry, [
      "action",
      "controlled",
      "distanceToBall",
      "flair",
      "nativePlayer",
      "on",
      "position",
    ], `AI normal-pass player ${index}`);
    const nativePlayer = requireInteger(entry.nativePlayer, 1, 22, `player ${index} nativePlayer`);
    if (seen.has(nativePlayer)) throw new Error(`Duplicate native player ${nativePlayer}.`);
    seen.add(nativePlayer);
    return {
      nativePlayer,
      action: requireInteger(entry.action, -0x8000, 0x7fff, `player ${nativePlayer} action`),
      controlled: requireBoolean(entry.controlled, `player ${nativePlayer} controlled`),
      on: requireBoolean(entry.on, `player ${nativePlayer} on`),
      position: requirePoint(entry.position, `player ${nativePlayer} position`),
      distanceToBall: requirePositiveFinite(
        entry.distanceToBall,
        `player ${nativePlayer} distanceToBall`,
      ),
      flair: requireInteger(entry.flair, 0, 255, `player ${nativePlayer} flair`),
    };
  });
  if (!seen.has(holderNativePlayer)) {
    throw new Error(`AI normal-pass roster is missing holder ${holderNativePlayer}.`);
  }
  return deepFreeze(players);
}

function requirePoint(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y"], label);
  return deepFreeze({
    x: requireFinite(value.x, `${label}.x`),
    y: requireFinite(value.y, `${label}.y`),
  });
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const keys = expected.slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(keys)) {
    throw new Error(`${label} keys changed.`);
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

function requireInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
  return value;
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function requirePositiveFinite(value, label) {
  requireFinite(value, label);
  if (value <= 0) throw new TypeError(`${label} must be positive.`);
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

import { sourceDistance2d } from "./motionState.mjs";

const F32 = Math.fround;
const SOURCE_PI = 3.1415926536;
const DRIBBLE_DANGER_MULTIPLIER = 13;
const DRIBBLE_TARGET_DISTANCE = 500;
const DRIBBLE_ROTATION_RADIANS = 0.174;
const PITCH_BOUNDARY_MARGIN = 16;
const TURN_ACTION = 2;

export const CSSOCCER_DRIBBLE_SOURCE = deepFreeze({
  file: "INTELL.CPP",
  sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
  producers: ["get_opp_dir_tab", "dribble_dir", "go_dribble", "make_run"],
  constants: {
    dangerArea: "prat * 13",
    directionSearchRadians: DRIBBLE_ROTATION_RADIANS,
    targetDistance: DRIBBLE_TARGET_DISTANCE,
  },
  supportedBoundary:
    "source make_run direction selection through go_dribble; init_run_act and its post-run boundary fallback remain caller-owned",
});

/**
 * Resolve the source make_run -> dribble_dir -> go_dribble target.
 *
 * The selector is roster- and pitch-driven. It contains no fixture identity,
 * player identity, tick, or oracle value, and works symmetrically for either
 * native team. `players` may be a full roster or any source-ordered active
 * subset; opponents are always evaluated by native player number.
 */
export function selectCssoccerDribbleRun(input = {}) {
  requirePlainObject(input, "dribble run input");
  requireExactKeys(input, ["ball", "pitch", "player", "players", "seed"], "dribble run input");
  const ball = requirePoint(input.ball, "dribble ball");
  const pitch = requirePitch(input.pitch);
  const player = requireDribbler(input.player);
  const players = requirePlayers(input.players, player.nativePlayer);
  requireIntegerRange(input.seed, 0, 127, "dribble seed");

  const baseDirection = makeRunDirection(player, pitch);
  const opponents = getOpponentDirectionTable({ ball, pitch, player, players });
  const avoided = avoidDribbleOpponents({
    ball,
    direction: baseDirection,
    opponents,
    pitch,
    player,
    seed: input.seed,
  });
  const target = {
    x: F32(player.position.x + avoided.direction.x * DRIBBLE_TARGET_DISTANCE),
    y: F32(player.position.y + avoided.direction.y * DRIBBLE_TARGET_DISTANCE),
  };
  const flairScale = Math.trunc(player.flair / 8);

  return deepFreeze({
    baseDirection,
    direction: avoided.direction,
    target,
    opponentCount: opponents.length,
    directionAttempts: avoided.attempts,
    mustPass: avoided.mustPass,
    intelligenceMove: "dribble",
    intelligenceCount: 18 - flairScale,
    goCount: 19 - flairScale,
  });
}

function makeRunDirection(player, pitch) {
  const teamA = player.nativePlayer < 12;
  const attackingEdge = F32(pitch.ratio * 10);
  const px = teamA
    ? F32(player.position.x - (pitch.length - attackingEdge))
    : F32(attackingEdge - player.position.x);

  if (px <= 0) {
    return { x: F32(teamA ? 1 : -1), y: F32(0) };
  }

  let x = F32(0);
  if (px < attackingEdge) {
    const angle = px * SOURCE_PI / (pitch.ratio * 20);
    x = F32(Math.cos(angle));
    if (!teamA) x = F32(-x);
  }
  let y = F32(Math.sqrt(1 - x * x));
  if (player.position.y > pitch.width / 2) y = F32(-y);
  return { x, y };
}

function getOpponentDirectionTable({ ball, pitch, player, players }) {
  const flairRange = Math.trunc((128 - player.flair) / 12) - 5;
  const range = F32(
    pitch.ratio * DRIBBLE_DANGER_MULTIPLIER
      + pitch.ratio * flairRange,
  );
  // BALLINT.CPP computes tm_dist once before process_teams. make_run may run
  // after collect_ball has moved the ball, but get_opp_dir_tab deliberately
  // keeps using that pre-visit distance as both its divisor and range test.
  const playerDistance = player.distance;
  const teamA = player.nativePlayer < 12;

  return players
    .filter((candidate) => (candidate.nativePlayer < 12) !== teamA)
    .sort((left, right) => left.nativePlayer - right.nativePlayer)
    .flatMap((opponent) => {
      const opponentDistance = opponent.distance;
      const x = F32((opponent.position.x - ball.x) / opponentDistance);
      const y = F32((opponent.position.y - ball.y) / opponentDistance);
      const difference = F32(
        1 + player.facing.x * x + player.facing.y * y,
      );
      const activeRange = F32(
        range / 4 + range * difference * 3 / 8,
      );
      if (
        !opponent.on
        || opponentDistance > activeRange
        || opponent.action >= TURN_ACTION
      ) {
        return [];
      }
      return [{
        nativePlayer: opponent.nativePlayer,
        position: opponent.position,
        attackPotential: F32(1 - playerDistance / activeRange),
      }];
    });
}

function avoidDribbleOpponents({ ball, direction, opponents, pitch, player, seed }) {
  if (opponents.length === 0) {
    return { direction, attempts: 0, mustPass: false };
  }

  const sine = F32(Math.sin(DRIBBLE_ROTATION_RADIANS));
  const cosine = F32(Math.cos(DRIBBLE_ROTATION_RADIANS));
  let current = { ...direction };
  let left = { ...direction };
  let right = { ...direction };
  let rotateLeft = seed < 64;
  let attempts = 0;

  while (true) {
    const future = {
      x: F32(
        ball.x
          + current.x * pitch.ratio * DRIBBLE_DANGER_MULTIPLIER / 4,
      ),
      y: F32(
        ball.y
          + current.y * pitch.ratio * DRIBBLE_DANGER_MULTIPLIER / 4,
      ),
    };
    const blocked = opponents.some((opponent) => {
      const offset = {
        x: F32(future.x - opponent.position.x),
        y: F32(future.y - opponent.position.y),
      };
      const distance = sourceDistance2d(offset);
      const difference = F32(
        player.facing.x * offset.x / distance
          + player.facing.y * offset.y / distance,
      );
      const weightedDistance = F32(distance * (2 - difference));
      return weightedDistance < pitch.ratio * DRIBBLE_DANGER_MULTIPLIER / 2;
    });
    const outside = future.x < PITCH_BOUNDARY_MARGIN
      || future.x > pitch.length - PITCH_BOUNDARY_MARGIN
      || future.y < PITCH_BOUNDARY_MARGIN
      || future.y > pitch.width - PITCH_BOUNDARY_MARGIN;

    if (!blocked && !outside) {
      return { direction: current, attempts, mustPass: false };
    }

    if (rotateLeft) {
      current = {
        x: F32(left.x * cosine - left.y * sine),
        y: F32(left.y * cosine + left.x * sine),
      };
      left = { ...current };
    } else {
      current = {
        x: F32(right.x * cosine + right.y * sine),
        y: F32(right.y * cosine - right.x * sine),
      };
      right = { ...current };
    }
    rotateLeft = !rotateLeft;
    attempts += 1;

    if (attempts === 37) {
      const centre = {
        x: F32(pitch.length / 2 - ball.x),
        y: F32(pitch.width / 2 - ball.y),
      };
      const distance = sourceDistance2d(centre);
      return {
        direction: {
          x: F32(centre.x / distance),
          y: F32(centre.y / distance),
        },
        attempts,
        mustPass: true,
      };
    }
  }
}

function distanceToBall(position, ball) {
  return sourceDistance2d({
    x: F32(position.x - ball.x),
    y: F32(position.y - ball.y),
  });
}

function requirePitch(value) {
  requirePlainObject(value, "dribble pitch");
  requireExactKeys(value, ["length", "ratio", "width"], "dribble pitch");
  requirePositiveFinite(value.length, "dribble pitch length");
  requirePositiveF32(value.ratio, "dribble pitch ratio");
  requirePositiveFinite(value.width, "dribble pitch width");
  return value;
}

function requireDribbler(value) {
  requirePlainObject(value, "dribble player");
  requireExactKeys(
    value,
    ["distance", "facing", "flair", "nativePlayer", "position"],
    "dribble player",
  );
  requireNonNegativeF32(value.distance, "dribble player distance");
  requireF32Point(value.position, "dribble player position");
  requireF32Point(value.facing, "dribble player facing");
  requireIntegerRange(value.flair, 0, 128, "dribble player flair");
  requireIntegerRange(value.nativePlayer, 1, 22, "dribble player nativePlayer");
  return value;
}

function requirePlayers(value, nativePlayer) {
  if (!Array.isArray(value)) throw new TypeError("dribble players must be an array.");
  const seen = new Set();
  const players = value.map((player, index) => {
    const label = `dribble players[${index}]`;
    requirePlainObject(player, label);
    requireExactKeys(player, ["action", "distance", "nativePlayer", "on", "position"], label);
    requireIntegerRange(player.nativePlayer, 1, 22, `${label} nativePlayer`);
    requireIntegerRange(player.action, 0, 0x7fff, `${label} action`);
    requirePositiveF32(player.distance, `${label} distance`);
    if (typeof player.on !== "boolean") throw new TypeError(`${label} on must be boolean.`);
    requireF32Point(player.position, `${label} position`);
    if (seen.has(player.nativePlayer)) {
      throw new Error(`dribble players repeats native player ${player.nativePlayer}.`);
    }
    seen.add(player.nativePlayer);
    return player;
  });
  if (!seen.has(nativePlayer)) {
    throw new Error(`dribble players is missing native player ${nativePlayer}.`);
  }
  return players;
}

function requirePoint(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y"], label);
  requireF32(value.x, `${label} x`);
  requireF32(value.y, `${label} y`);
  return value;
}

function requireF32Point(value, label) {
  return requirePoint(value, label);
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(F32(value), value)) {
    throw new TypeError(`${label} must be a finite, exactly rounded f32.`);
  }
}

function requirePositiveF32(value, label) {
  requireF32(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
}

function requireNonNegativeF32(value, label) {
  requireF32(value, label);
  if (value < 0) throw new RangeError(`${label} must not be negative.`);
}

function requirePositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be positive and finite.`);
  }
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} keys must be exactly ${expected.join(", ")}.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

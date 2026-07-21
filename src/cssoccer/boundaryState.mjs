const f32 = Math.fround;

const RULES_CPP_SHA256 = "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8";

export const CSSOCCER_MATCH_MODE = Object.freeze({
  NORMAL: 0,
  CORNER_TL: 1,
  CORNER_BL: 2,
  CORNER_TR: 3,
  CORNER_BR: 4,
  CENTRE_A: 5,
  CENTRE_B: 6,
  GOAL_KICK_TL: 7,
  GOAL_KICK_BL: 8,
  GOAL_KICK_TR: 9,
  GOAL_KICK_BR: 10,
  THROW_IN_A: 11,
  THROW_IN_B: 12,
  IF_KICK_A: 13,
  IF_KICK_B: 14,
  DF_KICK_A: 15,
  DF_KICK_B: 16,
  PEN_KICK_A: 17,
  PEN_KICK_B: 18,
  SWAP_ENDS: 19,
});

export const CSSOCCER_BOUNDARY_CONSTANTS = Object.freeze({
  pitchLength: f32(1280),
  pitchWidth: f32(800),
  centreY: f32(400),
});

export const CSSOCCER_BOUNDARY_SOURCE = deepFreeze({
  file: "RULES.CPP",
  sha256: RULES_CPP_SHA256,
  producer: "bounds_rules",
  lines: "762-890",
  semantics: [
    "BALL.CPP goal recognition owns in-goal crossings before bounds_rules",
    "goal lines are resolved before touchlines",
    "top/bottom restart variants split at cntspot_y",
    "throw incidents preserve x and clamp y to 0 or pitch_wid-1",
  ],
});

/**
 * Classify one native f32 ball position using RULES.CPP::bounds_rules.
 * Native team slots are deliberate: countries swap slots at half time.
 */
export function classifyCssoccerBoundary({
  position,
  lastTouch,
  teamAOn = 1,
  teamBOn = 1,
  inGoal = 0,
} = {}) {
  const ball = requirePosition(position);
  requirePlayerNumber(lastTouch, "lastTouch");
  requireFlag(teamAOn, "teamAOn");
  requireFlag(teamBOn, "teamBOn");
  requireFlag(inGoal, "inGoal");

  // BALL.CPP runs goal recognition before pitch_bounds. A scored crossing is
  // therefore owned by the goal/post-goal reducers and must never be
  // reclassified as a goal kick or corner by this narrower bounds reducer.
  if (inGoal === 1) return null;

  const top = ball.y <= CSSOCCER_BOUNDARY_CONSTANTS.centreY;
  const touchedByA = lastTouch < 12;

  if (ball.x < 0) {
    if (touchedByA) {
      return teamBOn
        ? result(top ? "CORNER_TL" : "CORNER_BL", "corner", "B", "left-goal-line")
        : result(top ? "GOAL_KICK_TL" : "GOAL_KICK_BL", "goal-kick", "A", "left-goal-line");
    }
    return teamAOn
      ? result(top ? "GOAL_KICK_TL" : "GOAL_KICK_BL", "goal-kick", "A", "left-goal-line")
      : result(top ? "CORNER_TL" : "CORNER_BL", "corner", "B", "left-goal-line");
  }

  if (ball.x >= CSSOCCER_BOUNDARY_CONSTANTS.pitchLength) {
    if (!touchedByA) {
      return teamAOn
        ? result(top ? "CORNER_TR" : "CORNER_BR", "corner", "A", "right-goal-line")
        : result(top ? "GOAL_KICK_TR" : "GOAL_KICK_BR", "goal-kick", "B", "right-goal-line");
    }
    return teamBOn
      ? result(top ? "GOAL_KICK_TR" : "GOAL_KICK_BR", "goal-kick", "B", "right-goal-line")
      : result(top ? "CORNER_TR" : "CORNER_BR", "corner", "A", "right-goal-line");
  }

  if (ball.y < 0 || ball.y >= CSSOCCER_BOUNDARY_CONSTANTS.pitchWidth) {
    const awardedNativeTeam = touchedByA
      ? (teamBOn ? "B" : "A")
      : (teamAOn ? "A" : "B");
    const mode = awardedNativeTeam === "A" ? "THROW_IN_A" : "THROW_IN_B";
    const boundary = ball.y < 0 ? "top-touchline" : "bottom-touchline";
    return result(mode, "throw-in", awardedNativeTeam, boundary, {
      x: ball.x,
      y: ball.y < 0 ? f32(0) : f32(CSSOCCER_BOUNDARY_CONSTANTS.pitchWidth - 1),
    });
  }

  return null;
}

function result(mode, kind, awardedNativeTeam, boundary, incidentPosition = null) {
  return deepFreeze({
    kind,
    mode,
    matchMode: CSSOCCER_MATCH_MODE[mode],
    awardedNativeTeam,
    boundary,
    incidentPosition,
  });
}

function requirePosition(value) {
  requirePlainObject(value, "position");
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "x" || keys[1] !== "y") {
    throw new TypeError("position must contain exactly x and y.");
  }
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError("position x and y must be finite numbers.");
  }
  return Object.freeze({ x: f32(value.x), y: f32(value.y) });
}

function requirePlayerNumber(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 22) {
    throw new RangeError(`${label} must be a native player number from 1 through 22.`);
  }
}

function requireFlag(value, label) {
  if (value !== 0 && value !== 1) {
    throw new TypeError(`${label} must be 0 or 1.`);
  }
}

function requirePlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

import { CSSOCCER_MATCH_MODE } from "./boundaryState.mjs";
import {
  advanceCssoccerNativeRng,
  createCssoccerNativeRngState,
} from "./randomState.mjs";

export const CSSOCCER_FOUL_SCHEMA = "cssoccer-foul-state@1";

const f32 = Math.fround;

export const CSSOCCER_RULE_PITCH = deepFreeze({
  length: f32(1280),
  width: f32(800),
  centreX: f32(640),
  centreY: f32(400),
  ratio: f32(1280 / 120),
});

export const CSSOCCER_FOUL_SOURCE = deepFreeze({
  file: "RULES.CPP",
  sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
  functions: {
    penaltyArea: "penalty, lines 1385-1400",
    punishment: "punish_foul, lines 1566-1716",
    advantage: "init_foul/retake_foul, lines 1721-1792",
    freeKickPlacement: "init_fkick/init_dfkick, lines 1814-1839 and 2058-2224",
    penaltyPlacement: "init_penalty, lines 2229-2303",
    restartModes: "init_match_mode, lines 2308-2435",
  },
  processFlags: {
    file: "FOOTBALL.CPP",
    sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
    lines: "276-300",
  },
  contactProducers: [
    { file: "INTELL.CPP", producer: "player_ints", lines: "4455-4505", direct: 1 },
    { file: "ACTIONS.CPP", producer: "tussle_collision", lines: "4328-4440", direct: 1 },
  ],
  deadBallCount: 50,
  foulWeights: { indirect: 1, direct: 3, penalty: 10 },
});

export class CssoccerUnsupportedRuleSemanticsError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedRuleSemanticsError";
    this.code = code;
    this.detail = deepFreeze(clone(detail));
  }
}

export function createCssoccerFoulState() {
  return deepFreeze({
    schema: CSSOCCER_FOUL_SCHEMA,
    playAdvantage: 0,
    pending: null,
    lastDecision: null,
  });
}

/**
 * Resolve RULES.CPP::init_foul from a source-owned foul candidate.
 * The browser RNG is advanced in the same two call sites; no native decision is accepted.
 */
export function resolveCssoccerFoulCall(state, {
  candidate,
  offenderPosition,
  refereePosition,
  ballPossession,
  justScored,
  freeKicksEnabled,
  refereeAccuracy,
  refereeStrictness,
  manDown,
  rng,
} = {}) {
  const current = assertCssoccerFoulState(state);
  if (current.playAdvantage !== 0) {
    throw new Error("A new foul cannot be resolved while source advantage is pending.");
  }
  const event = requireFoulCandidate(candidate);
  const incident = requirePosition(offenderPosition, "offenderPosition");
  const referee = requirePosition(refereePosition, "refereePosition");
  requireIntegerRange(ballPossession, 0, 22, "ballPossession");
  requireFlag(justScored, "justScored");
  requireFlag(freeKicksEnabled, "freeKicksEnabled");
  requireIntegerRange(refereeAccuracy, 0, 255, "refereeAccuracy");
  requireIntegerRange(refereeStrictness, 0, 255, "refereeStrictness");
  requireFiniteNonnegative(manDown, "manDown");

  const visibilityRng = advanceCssoccerNativeRng(createCssoccerNativeRngState(rng));
  const refereeDistance = f32(sourceDistance(
    f32(incident.x - referee.x),
    f32(incident.y - referee.y),
  ) / CSSOCCER_RULE_PITCH.ratio);
  let visibilityThreshold = refereeDistance === 0
    ? Number.POSITIVE_INFINITY
    : f32(f32(refereeAccuracy / refereeDistance) * f32(2 * manDown));
  if (visibilityThreshold > 128) visibilityThreshold = f32(128);
  const seen = justScored === 0
    && freeKicksEnabled === 1
    && (event.forceSeen === 1 || visibilityRng.seed < visibilityThreshold);

  if (!seen) {
    const decision = {
      status: "ignored",
      reason: justScored === 1
        ? "just-scored"
        : freeKicksEnabled === 0
          ? "free-kicks-disabled"
          : "referee-did-not-see",
      candidate: event,
      incidentPosition: incident,
      visibilitySeed: visibilityRng.seed,
      visibilityThreshold,
    };
    return deepFreeze({
      state: { ...clone(current), lastDecision: decision },
      decision,
      rng: visibilityRng,
    });
  }

  const base = {
    candidate: event,
    fouler: event.fouler,
    direct: event.direct,
    offsideNow: event.offsideNow,
    incidentPosition: incident,
    visibilitySeed: visibilityRng.seed,
    visibilityThreshold,
  };
  if (event.offsideNow === 1) {
    const decision = { ...base, status: "restart-required", reason: "offside-no-advantage" };
    return deepFreeze({
      state: { ...clone(current), lastDecision: decision },
      decision,
      rng: visibilityRng,
    });
  }

  const advantageRng = advanceCssoccerNativeRng(visibilityRng);
  const possessionTeam = ballPossession === 0 ? null : nativeTeamFor(ballPossession);
  const foulingTeam = nativeTeamFor(event.fouler);
  let status;
  let reason;
  if (ballPossession === 0 && advantageRng.seed > refereeStrictness) {
    status = "advantage-pending";
    reason = "free-ball-temporary-advantage";
  } else if (ballPossession === 0 || possessionTeam === foulingTeam) {
    status = "restart-required";
    reason = ballPossession === 0 ? "free-ball-no-advantage" : "fouling-team-possession";
  } else {
    status = "advantage-complete";
    reason = "favoured-team-possession";
  }
  const decision = {
    ...base,
    status,
    reason,
    advantageSeed: advantageRng.seed,
  };
  const pending = status === "advantage-pending" ? clone(decision) : null;
  return deepFreeze({
    state: {
      ...clone(current),
      playAdvantage: pending === null ? 0 : 1,
      pending,
      lastDecision: decision,
    },
    decision,
    rng: advantageRng,
  });
}

/** Resolve FOOTBALL.CPP::process_flags for an already-seen foul. */
export function resolveCssoccerAdvantage(state, { ballPossession } = {}) {
  const current = assertCssoccerFoulState(state);
  requireIntegerRange(ballPossession, 0, 22, "ballPossession");
  if (current.playAdvantage !== 1 || current.pending === null) {
    throw new Error("Advantage resolution requires a pending source foul.");
  }
  if (ballPossession === 0) {
    return deepFreeze({ state: current, decision: current.pending });
  }
  const foulingTeam = nativeTeamFor(current.pending.fouler);
  const possessionTeam = nativeTeamFor(ballPossession);
  const restart = possessionTeam === foulingTeam;
  const decision = {
    ...clone(current.pending),
    status: restart ? "restart-required" : "advantage-complete",
    reason: restart ? "fouling-team-collected" : "favoured-team-collected",
  };
  return deepFreeze({
    state: {
      ...clone(current),
      playAdvantage: 0,
      pending: null,
      lastDecision: decision,
    },
    decision,
  });
}

export function cssoccerIncidentIsPenalty({ fouler, incidentPosition } = {}) {
  requirePlayerNumber(fouler, "penalty fouler");
  const incident = requirePosition(incidentPosition, "incidentPosition");
  const halfBoxLength = f32(CSSOCCER_RULE_PITCH.ratio * 18);
  const halfBoxWidth = f32(CSSOCCER_RULE_PITCH.ratio * 22);
  if (incident.x < CSSOCCER_RULE_PITCH.centreX) {
    return fouler < 12
      && incident.x < halfBoxLength
      && incident.y < f32(CSSOCCER_RULE_PITCH.centreY + halfBoxWidth)
      && incident.y > f32(CSSOCCER_RULE_PITCH.centreY - halfBoxWidth);
  }
  return fouler > 11
    && incident.x > f32(CSSOCCER_RULE_PITCH.length - halfBoxLength)
    && incident.y < f32(CSSOCCER_RULE_PITCH.centreY + halfBoxWidth)
    && incident.y > f32(CSSOCCER_RULE_PITCH.centreY - halfBoxWidth);
}

export function calculateCssoccerFoulNastiness({
  offenderDistanceToBall,
  refereeStrictness,
  manDown,
} = {}) {
  requireFiniteNonnegative(offenderDistanceToBall, "offenderDistanceToBall");
  requireIntegerRange(refereeStrictness, 0, 255, "refereeStrictness");
  requireFiniteNonnegative(manDown, "manDown");
  let nastiness = f32(
    f32(Math.sqrt(f32(offenderDistanceToBall * 4)))
      * f32(refereeStrictness / 6),
  );
  if (manDown === 0) nastiness = f32(nastiness / 3);
  return nastiness;
}

export function createCssoccerFoulRestart({
  decision,
  candidates,
  preferredTaker = null,
} = {}) {
  const foul = requireRestartDecision(decision);
  const awardedNativeTeam = foul.fouler < 12 ? "B" : "A";
  const penalty = foul.direct === 1 && cssoccerIncidentIsPenalty({
    fouler: foul.fouler,
    incidentPosition: foul.incidentPosition,
  });
  const kind = penalty ? "penalty" : foul.direct === 1 ? "direct" : "indirect";
  const mode = kind === "penalty"
    ? `PEN_KICK_${awardedNativeTeam}`
    : `${kind === "direct" ? "DF" : "IF"}_KICK_${awardedNativeTeam}`;
  const taker = selectCssoccerFoulTaker({
    awardedNativeTeam,
    incidentPosition: foul.incidentPosition,
    candidates,
    preferredTaker: kind === "indirect" ? null : preferredTaker,
  });
  const ballPosition = kind === "penalty"
    ? {
      x: awardedNativeTeam === "A"
        ? f32(CSSOCCER_RULE_PITCH.length - f32(CSSOCCER_RULE_PITCH.ratio * 12))
        : f32(CSSOCCER_RULE_PITCH.ratio * 12),
      y: CSSOCCER_RULE_PITCH.centreY,
    }
    : clone(foul.incidentPosition);
  const takerPlacement = kind === "penalty"
    ? {
      status: "source-formula-requires-prepared-constant",
      anchor: "penalty-spot",
      constant: "PEN_RUNUP_DIST",
      xDirection: awardedNativeTeam === "A" ? -1 : 1,
    }
    : {
      status: "source-formula-requires-prepared-constant",
      anchor: "incident-position",
      constant: "BESIDE_BALL",
      goalAnchor: {
        x: foul.fouler < 12 ? f32(0) : CSSOCCER_RULE_PITCH.length,
        y: CSSOCCER_RULE_PITCH.centreY,
      },
    };
  return deepFreeze({
    schema: "cssoccer-foul-restart@1",
    kind,
    mode,
    matchMode: CSSOCCER_MATCH_MODE[mode],
    awardedNativeTeam,
    fouler: foul.fouler,
    incidentPosition: clone(foul.incidentPosition),
    ballPosition,
    taker,
    takerPlacement,
    gameAction: kind === "penalty" ? 2 : 1,
    formation: kind === "penalty" ? "gather-outside-box" : "ten-yards-away",
    deadBallCount: CSSOCCER_FOUL_SOURCE.deadBallCount,
    canBeOffside: kind === "penalty" ? 0 : 1,
    foulPoints: CSSOCCER_FOUL_SOURCE.foulWeights[kind],
  });
}

export function selectCssoccerFoulTaker({
  awardedNativeTeam,
  incidentPosition,
  candidates,
  preferredTaker = null,
} = {}) {
  requireNativeTeam(awardedNativeTeam, "awardedNativeTeam");
  const incident = requirePosition(incidentPosition, "incidentPosition");
  const available = requireTakerCandidates(candidates)
    .filter((candidate) => candidate.nativeTeam === awardedNativeTeam && candidate.active === 1)
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
  if (available.length === 0) {
    throw new CssoccerUnsupportedRuleSemanticsError(
      "no-active-restart-taker",
      "The awarded native team has no source-eligible outfield restart taker.",
      { awardedNativeTeam },
    );
  }
  if (preferredTaker !== null) {
    requirePlainObject(preferredTaker, "preferredTaker");
    requirePlayerId(preferredTaker.playerId, "preferredTaker.playerId");
    requirePlayerNumber(preferredTaker.nativePlayerNumber, "preferredTaker.nativePlayerNumber");
    const preferred = available.find((candidate) => (
      candidate.playerId === preferredTaker.playerId
      && candidate.nativePlayerNumber === preferredTaker.nativePlayerNumber
    ));
    if (preferred) return deepFreeze({ ...clone(preferred), selection: "preferred-active" });
  }
  const target = awardedNativeTeam === "A"
    ? incident
    : {
      x: f32(CSSOCCER_RULE_PITCH.length - incident.x),
      y: f32(CSSOCCER_RULE_PITCH.width - incident.y),
    };
  let selected = null;
  let minimumDistance = 1000;
  for (const candidate of available) {
    const distance = sourceDistance(
      f32(target.x - candidate.tacticalPosition.x),
      f32(target.y - candidate.tacticalPosition.y),
    );
    if (distance < minimumDistance) {
      minimumDistance = distance;
      selected = candidate;
    }
  }
  if (selected === null) {
    throw new CssoccerUnsupportedRuleSemanticsError(
      "restart-taker-distance-out-of-range",
      "No active source candidate was inside RULES.CPP's initial taker distance bound.",
      { awardedNativeTeam, initialMinimum: 1000 },
    );
  }
  return deepFreeze({
    ...clone(selected),
    selection: "nearest-tactical-position",
    tacticalDistance: f32(minimumDistance),
  });
}

export function materializeCssoccerFoulTakerPlacement(restart, sourceConstant) {
  requirePlainObject(restart, "foul restart");
  if (restart.schema !== "cssoccer-foul-restart@1") {
    throw new Error("taker placement requires a cssoccer foul restart descriptor.");
  }
  requireFinitePositive(sourceConstant, `prepared ${restart.takerPlacement?.constant ?? "constant"}`);
  if (restart.kind === "penalty") {
    return deepFreeze({
      x: f32(restart.ballPosition.x + restart.takerPlacement.xDirection * sourceConstant),
      y: restart.ballPosition.y,
    });
  }
  const vector = {
    x: f32(restart.takerPlacement.goalAnchor.x - restart.ballPosition.x),
    y: f32(restart.takerPlacement.goalAnchor.y - restart.ballPosition.y),
  };
  const distance = sourceDistance(vector.x, vector.y);
  if (!(distance > 0)) {
    throw new CssoccerUnsupportedRuleSemanticsError(
      "zero-free-kick-placement-vector",
      "The checked source free-kick placement would divide by zero at the goal anchor.",
    );
  }
  return deepFreeze({
    x: f32(restart.ballPosition.x - f32(vector.x * sourceConstant / distance)),
    y: f32(restart.ballPosition.y - f32(vector.y * sourceConstant / distance)),
  });
}

export function assertCssoccerFoulState(state) {
  requirePlainObject(state, "foul state");
  if (state.schema !== CSSOCCER_FOUL_SCHEMA) {
    throw new Error(`foul state must use ${CSSOCCER_FOUL_SCHEMA}.`);
  }
  requireFlag(state.playAdvantage, "foul playAdvantage");
  if ((state.playAdvantage === 0) !== (state.pending === null)) {
    throw new Error("foul pending state and playAdvantage flag diverged.");
  }
  return state;
}

function requireFoulCandidate(value) {
  requirePlainObject(value, "foul candidate");
  const allowed = new Set([
    "type",
    "fouler",
    "fallenPlayer",
    "source",
    "direct",
    "forceSeen",
    "offsideNow",
    "playerId",
  ]);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) {
    throw new CssoccerUnsupportedRuleSemanticsError(
      "unbound-foul-candidate-fields",
      "Foul candidate contains fields not owned by the source rule boundary.",
      { fields: extras },
    );
  }
  if (value.type !== "foul-candidate") {
    throw new TypeError("foul candidate type must be foul-candidate.");
  }
  requirePlayerNumber(value.fouler, "foul candidate fouler");
  if (value.fallenPlayer !== undefined && value.fallenPlayer !== null) {
    requirePlayerNumber(value.fallenPlayer, "foul candidate fallenPlayer");
  }
  const specs = {
    player_ints: { direct: 1, forceSeen: 0, offsideNow: 0 },
    tussle_collision: { direct: 1, forceSeen: 0, offsideNow: 0 },
    offside_rule: { direct: 0, forceSeen: 1, offsideNow: 1 },
    double_touch: { direct: 0, forceSeen: 1, offsideNow: 0 },
  };
  const spec = specs[value.source];
  if (!spec) {
    throw new CssoccerUnsupportedRuleSemanticsError(
      "unbound-foul-producer",
      "Rules reject contact, AI, or action foul semantics without a checked Actua producer.",
      { source: value.source ?? null },
    );
  }
  for (const key of ["direct", "forceSeen", "offsideNow"]) {
    if (value[key] !== undefined) {
      requireFlag(value[key], `foul candidate ${key}`);
      if (value[key] !== spec[key]) {
        throw new Error(`foul candidate ${key} contradicts its source producer.`);
      }
    }
  }
  if (value.playerId !== undefined) requirePlayerId(value.playerId, "foul candidate playerId");
  return deepFreeze({
    type: value.type,
    fouler: value.fouler,
    fallenPlayer: value.fallenPlayer ?? null,
    source: value.source,
    direct: spec.direct,
    forceSeen: spec.forceSeen,
    offsideNow: spec.offsideNow,
    playerId: value.playerId ?? null,
  });
}

function requireRestartDecision(value) {
  requirePlainObject(value, "foul decision");
  if (value.status !== "restart-required") {
    throw new Error("foul restart requires a restart-required decision.");
  }
  requirePlayerNumber(value.fouler, "foul decision fouler");
  requireFlag(value.direct, "foul decision direct");
  return {
    ...clone(value),
    incidentPosition: requirePosition(value.incidentPosition, "foul decision incidentPosition"),
  };
}

function requireTakerCandidates(value) {
  if (!Array.isArray(value)) throw new TypeError("restart taker candidates must be an array.");
  const ids = new Set();
  const numbers = new Set();
  return value.map((entry, index) => {
    requirePlainObject(entry, `restart taker candidate ${index}`);
    const allowed = ["playerId", "nativePlayerNumber", "active", "tacticalPosition"];
    const extras = Object.keys(entry).filter((key) => !allowed.includes(key));
    if (extras.length > 0) throw new Error(`restart taker candidate has unsupported fields: ${extras.join(", ")}.`);
    requirePlayerId(entry.playerId, "restart candidate playerId");
    requirePlayerNumber(entry.nativePlayerNumber, "restart candidate nativePlayerNumber");
    requireFlag(entry.active, "restart candidate active");
    const nativeTeam = nativeTeamFor(entry.nativePlayerNumber);
    if (entry.nativePlayerNumber === 1 || entry.nativePlayerNumber === 12) {
      throw new Error("Foul restart taker candidates must be the ten source outfield players.");
    }
    if (ids.has(entry.playerId) || numbers.has(entry.nativePlayerNumber)) {
      throw new Error("restart taker candidates must have unique ids and native player numbers.");
    }
    ids.add(entry.playerId);
    numbers.add(entry.nativePlayerNumber);
    return {
      playerId: entry.playerId,
      nativePlayerNumber: entry.nativePlayerNumber,
      nativeTeam,
      active: entry.active,
      tacticalPosition: requirePosition(entry.tacticalPosition, "restart candidate tacticalPosition"),
    };
  });
}

function nativeTeamFor(nativePlayerNumber) {
  return nativePlayerNumber < 12 ? "A" : "B";
}

function requireNativeTeam(value, label) {
  if (value !== "A" && value !== "B") throw new TypeError(`${label} must be A or B.`);
}

function requirePosition(value, label) {
  requirePlainObject(value, label);
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "x" || keys[1] !== "y") {
    throw new TypeError(`${label} must contain exactly x and y.`);
  }
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError(`${label} x and y must be finite.`);
  }
  return deepFreeze({ x: f32(value.x), y: f32(value.y) });
}

function sourceDistance(x, y) {
  return f32(Math.sqrt(f32(f32(x * x) + f32(y * y))));
}

function requirePlayerId(value, label) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} must be a fixed-fixture stable player id.`);
  }
}

function requirePlayerNumber(value, label) {
  requireIntegerRange(value, 1, 22, label);
}

function requireFlag(value, label) {
  if (value !== 0 && value !== 1) throw new TypeError(`${label} must be 0 or 1.`);
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
}

function requireFiniteNonnegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite nonnegative number.`);
  }
}

function requireFinitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a finite positive number.`);
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

import { CSSOCCER_RULE_PITCH } from "./foulState.mjs";

export const CSSOCCER_OFFSIDE_SCHEMA = "cssoccer-offside-state@1";
export const CSSOCCER_LIVE_OFFSIDE_SNAPSHOT_SCHEMA = "cssoccer-live-offside-snapshot@1";

const f32 = Math.fround;

export const CSSOCCER_OFFSIDE_SOURCE = deepFreeze({
  position: {
    file: "INTELL.CPP",
    sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
    producer: "offside_rule",
    lines: "7953-8014",
  },
  linesman: {
    file: "RULES.CPP",
    sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
    producer: "init_offside",
    lines: "1405-1449",
  },
  enablement: {
    file: "FOOTBALL.CPP",
    sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
    lines: "3410-3415",
  },
  flags: {
    clear: 0,
    seen: 1,
    potential: -1,
    runningBack: -2,
  },
});

/**
 * Freeze the source offside line at the actual live kick.
 *
 * BALLINT.CPP::player_distances publishes defense_a/defense_b from the
 * deepest active outfield defender. INTELL.CPP::offside_rule then requires an
 * attacker to be in the opponents' half, beyond that line by prat, and ahead
 * of the released ball. The browser owns this snapshot; no prepared or replay
 * flag participates in the decision.
 */
export function createCssoccerLiveOffsideSnapshot({
  tick,
  ballPosition,
  passer,
  players,
  enabled = 1,
  canBeOffside = 1,
} = {}) {
  requireIntegerRange(tick, 0, Number.MAX_SAFE_INTEGER, "live offside kick tick");
  requireFlag(enabled, "live offside enabled");
  requireFlag(canBeOffside, "live offside canBeOffside");
  const ball = requirePosition(ballPosition, "live offside kick ball position");
  const roster = requireLivePlayers(players);
  const checkedPasser = requireLivePasser(passer, roster);
  const attackingNativeTeam = checkedPasser.nativePlayerNumber < 12 ? "A" : "B";
  const defendingNativeTeam = attackingNativeTeam === "A" ? "B" : "A";
  const defenders = roster.filter((player) => (
    player.nativeTeam === defendingNativeTeam
    && player.active === 1
    && player.role !== "keeper"
  ));
  if (defenders.length === 0) {
    throw new Error("Live offside requires one current active outfield defender.");
  }
  const defenderLine = attackingNativeTeam === "A"
    ? Math.max(...defenders.map(({ position }) => position.x))
    : Math.min(...defenders.map(({ position }) => position.x));
  const margin = CSSOCCER_RULE_PITCH.ratio;
  const candidates = enabled === 1 && canBeOffside === 1
    ? roster
      .filter((player) => (
        player.active === 1
        && player.nativeTeam === attackingNativeTeam
        && player.id !== checkedPasser.playerId
      ))
      .filter((player) => attackingNativeTeam === "A"
        ? player.position.x > CSSOCCER_RULE_PITCH.centreX
          && player.position.x > ball.x
          && player.position.x > f32(defenderLine + margin)
        : player.position.x < CSSOCCER_RULE_PITCH.centreX
          && ball.x >= player.position.x
          && player.position.x < f32(defenderLine - margin))
      .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber)
      .map((player) => ({
        playerId: player.id,
        nativePlayerNumber: player.nativePlayerNumber,
        kickPosition: clone(player.position),
      }))
    : [];
  return deepFreeze({
    schema: CSSOCCER_LIVE_OFFSIDE_SNAPSHOT_SCHEMA,
    status: candidates.length === 0 ? "clear" : "pending",
    kickTick: tick,
    ballPosition: ball,
    passerId: checkedPasser.playerId,
    passerNativePlayerNumber: checkedPasser.nativePlayerNumber,
    attackingNativeTeam,
    defendingNativeTeam,
    defenderLine: f32(defenderLine),
    sourceMargin: f32(margin),
    candidates,
  });
}

/** Resolve current touch/interference against one immutable live-kick snapshot. */
export function resolveCssoccerLiveOffsideSnapshot(snapshot, {
  ballPosition,
  lastTouch,
  players,
  refereeStrictness,
  stoppage = null,
} = {}) {
  const current = assertCssoccerLiveOffsideSnapshot(snapshot);
  const ball = requirePosition(ballPosition, "live offside current ball position");
  const roster = requireLivePlayers(players);
  requireIntegerRange(lastTouch, 0, 22, "live offside lastTouch");
  requireIntegerRange(refereeStrictness, 0, 255, "live offside refereeStrictness");
  if (stoppage !== null && (typeof stoppage !== "string" || stoppage.length === 0)) {
    throw new TypeError("live offside stoppage must be null or a non-empty string.");
  }
  if (current.status === "clear") {
    return deepFreeze({ status: "clear", snapshot: null, event: null });
  }
  if (stoppage !== null) {
    return cancelledLiveOffside(current, `stoppage:${stoppage}`);
  }

  const candidateByNumber = new Map(
    current.candidates.map((candidate) => [candidate.nativePlayerNumber, candidate]),
  );
  if (lastTouch !== 0 && lastTouch !== current.passerNativePlayerNumber) {
    const toucher = roster.find(({ nativePlayerNumber }) => nativePlayerNumber === lastTouch);
    if (toucher === undefined) throw new Error("Live offside lost the current touching player.");
    if (toucher.nativeTeam === current.defendingNativeTeam) {
      return cancelledLiveOffside(current, "defender-touch");
    }
    const candidate = candidateByNumber.get(lastTouch);
    if (candidate === undefined) {
      return cancelledLiveOffside(current, "onside-teammate-touch");
    }
    return involvedLiveOffside(current, candidate, toucher.position, "candidate-touch");
  }

  const threshold = f32(refereeStrictness * 1.1);
  for (const candidate of current.candidates) {
    const player = roster.find(({ id }) => id === candidate.playerId);
    if (player === undefined || player.nativePlayerNumber !== candidate.nativePlayerNumber) {
      throw new Error("Live offside candidate lost its stable current player mapping.");
    }
    if (player.active !== 1) continue;
    const distanceToBall = sourceDistance(
      f32(player.position.x - ball.x),
      f32(player.position.y - ball.y),
    );
    if (distanceToBall < threshold) {
      return involvedLiveOffside(
        current,
        candidate,
        player.position,
        "active-interference",
        distanceToBall,
      );
    }
  }
  return deepFreeze({ status: "pending", snapshot: current, event: null });
}

export function assertCssoccerLiveOffsideSnapshot(snapshot) {
  requirePlainObject(snapshot, "live offside snapshot");
  if (snapshot.schema !== CSSOCCER_LIVE_OFFSIDE_SNAPSHOT_SCHEMA) {
    throw new Error(`live offside snapshot must use ${CSSOCCER_LIVE_OFFSIDE_SNAPSHOT_SCHEMA}.`);
  }
  if (!new Set(["clear", "pending"]).has(snapshot.status)) {
    throw new Error("live offside snapshot status must be clear or pending.");
  }
  requireIntegerRange(snapshot.kickTick, 0, Number.MAX_SAFE_INTEGER, "live offside snapshot kickTick");
  requirePosition(snapshot.ballPosition, "live offside snapshot ballPosition");
  requirePlayerId(snapshot.passerId, "live offside snapshot passerId");
  requirePlayerNumber(snapshot.passerNativePlayerNumber, "live offside snapshot passerNativePlayerNumber");
  if (!new Set(["A", "B"]).has(snapshot.attackingNativeTeam)) {
    throw new Error("live offside snapshot attackingNativeTeam must be A or B.");
  }
  if (snapshot.defendingNativeTeam !== (snapshot.attackingNativeTeam === "A" ? "B" : "A")) {
    throw new Error("live offside snapshot defendingNativeTeam is inconsistent.");
  }
  requireFinite(snapshot.defenderLine, "live offside snapshot defenderLine");
  requireFiniteNonnegative(snapshot.sourceMargin, "live offside snapshot sourceMargin");
  if (!Array.isArray(snapshot.candidates)) {
    throw new TypeError("live offside snapshot candidates must be an array.");
  }
  const ids = new Set();
  const numbers = new Set();
  for (const candidate of snapshot.candidates) {
    requirePlainObject(candidate, "live offside snapshot candidate");
    requirePlayerId(candidate.playerId, "live offside snapshot candidate playerId");
    requirePlayerNumber(
      candidate.nativePlayerNumber,
      "live offside snapshot candidate nativePlayerNumber",
    );
    requirePosition(candidate.kickPosition, "live offside snapshot candidate kickPosition");
    if (ids.has(candidate.playerId) || numbers.has(candidate.nativePlayerNumber)) {
      throw new Error("live offside snapshot candidates must be unique.");
    }
    ids.add(candidate.playerId);
    numbers.add(candidate.nativePlayerNumber);
  }
  if ((snapshot.status === "clear") !== (snapshot.candidates.length === 0)) {
    throw new Error("live offside snapshot status and candidates diverged.");
  }
  return snapshot;
}

export function createCssoccerOffsideState({ players, enabled = 1, practice = 0 } = {}) {
  requireFlag(enabled, "offside enabled");
  requireFlag(practice, "offside practice");
  const records = requirePlayerDescriptors(players).map((player) => ({
    id: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    tmOff: player.tmOff,
  }));
  return deepFreeze({
    schema: CSSOCCER_OFFSIDE_SCHEMA,
    configuredEnabled: enabled,
    practice,
    offsideOn: practice === 1 ? 0 : enabled,
    offsideNow: 0,
    players: records,
  });
}

/** Execute one player visit in INTELL.CPP::offside_rule native order. */
export function stepCssoccerOffsidePlayer(state, {
  playerId,
  nativePlayerNumber,
  position,
  distanceToBall,
  matchMode,
  ballPossession,
  ballReleased,
  lastTouch,
  ballPosition,
  defenseA,
  defenseB,
  canBeOffside,
  justScored,
  refereeStrictness,
  refereeAccuracy,
  linesmanPosition,
  seed,
} = {}) {
  const current = assertCssoccerOffsideState(state);
  requirePlayerId(playerId, "offside playerId");
  requirePlayerNumber(nativePlayerNumber, "offside nativePlayerNumber");
  const player = current.players.find(({ id }) => id === playerId);
  if (!player || player.nativePlayerNumber !== nativePlayerNumber) {
    throw new Error("Stable player id and current native player number do not match offside state.");
  }
  const playerPosition = requirePosition(position, "offside player position");
  const ball = requirePosition(ballPosition, "offside ball position");
  const linesman = requirePosition(linesmanPosition, "offside linesman position");
  requireFiniteNonnegative(distanceToBall, "offside distanceToBall");
  requireIntegerRange(matchMode, 0, 19, "offside matchMode");
  requireIntegerRange(ballPossession, 0, 22, "offside ballPossession");
  requireIntegerRange(ballReleased, -32768, 32767, "offside ballReleased");
  requirePlayerNumber(lastTouch, "offside lastTouch");
  requireFinite(defenseA, "offside defenseA");
  requireFinite(defenseB, "offside defenseB");
  requireFlag(canBeOffside, "offside canBeOffside");
  requireFlag(justScored, "offside justScored");
  requireIntegerRange(refereeStrictness, 0, 255, "offside refereeStrictness");
  requireIntegerRange(refereeAccuracy, 0, 255, "offside refereeAccuracy");
  requireIntegerRange(seed, 0, 127, "offside seed");

  if (current.offsideOn === 0) {
    return deepFreeze({
      state: current,
      event: null,
      ballReleased,
      review: null,
    });
  }

  const teamA = nativePlayerNumber < 12;
  let tmOff = player.tmOff;
  let nextBallReleased = ballReleased;
  let review = null;
  const releaseReview = teamA
    ? matchMode === 0
      && ballPossession === 0
      && ballReleased > 0
      && lastTouch < 12
      && lastTouch !== nativePlayerNumber
      && tmOff !== 0
      && ball.x < playerPosition.x
    : matchMode === 0
      && ballPossession === 0
      && ballReleased < 0
      && lastTouch > 11
      && lastTouch !== nativePlayerNumber
      && tmOff !== 0
      && ball.x >= playerPosition.x;

  if (releaseReview) {
    const margin = teamA
      ? f32(playerPosition.x - defenseB)
      : f32(defenseA - playerPosition.x);
    let distanceFactor = f32(
      f32(CSSOCCER_RULE_PITCH.width - sourceDistance(
        f32(playerPosition.x - linesman.x),
        f32(playerPosition.y - linesman.y),
      )) / CSSOCCER_RULE_PITCH.ratio,
    );
    distanceFactor = f32(
      f32(refereeAccuracy / 2)
        + f32(refereeAccuracy * f32(
          f32(f32(distanceFactor * distanceFactor) * 0.000740740)
            - f32(0.07 * distanceFactor)
            + 1,
        )),
    );
    if (distanceFactor < 1) distanceFactor = f32(1);
    const threshold = f32(f32(distanceFactor / 2) + margin);
    const seen = seed < threshold;
    tmOff = seen ? 1 : -1;
    if (!seen) {
      const releaseAdjustment = Math.trunc((128 - refereeAccuracy) / 4);
      if (nextBallReleased < 0) {
        nextBallReleased += releaseAdjustment;
        if (nextBallReleased > 0) nextBallReleased = 0;
      } else {
        nextBallReleased -= releaseAdjustment;
        if (nextBallReleased < 0) nextBallReleased = 0;
      }
    }
    review = {
      seen,
      margin,
      distanceFactor,
      threshold,
      seed,
      linesman: teamA ? "bottom" : "top",
    };
  } else {
    const potential = teamA
      ? ballPossession < 12
        && playerPosition.x > CSSOCCER_RULE_PITCH.centreX
        && canBeOffside === 1
        && playerPosition.x > f32(defenseB + CSSOCCER_RULE_PITCH.ratio)
        && justScored === 0
      : (ballPossession > 11 || ballPossession === 0)
        && playerPosition.x < CSSOCCER_RULE_PITCH.centreX
        && canBeOffside === 1
        && playerPosition.x < f32(defenseA - CSSOCCER_RULE_PITCH.ratio)
        && justScored === 0;
    if (potential) {
      if (tmOff === 0) tmOff = -1;
    } else {
      tmOff = 0;
    }
  }

  let event = null;
  let offsideNow = current.offsideNow;
  if (
    tmOff === 1
    && matchMode === 0
    && justScored === 0
    && distanceToBall < f32(refereeStrictness * 1.1)
  ) {
    offsideNow = 1;
    tmOff = 0;
    event = {
      type: "foul-candidate",
      fouler: nativePlayerNumber,
      fallenPlayer: null,
      source: "offside_rule",
      direct: 0,
      forceSeen: 1,
      offsideNow: 1,
      playerId,
    };
  }

  const next = {
    ...clone(current),
    offsideNow,
    players: current.players.map((entry) => entry.id === playerId
      ? { ...clone(entry), tmOff }
      : clone(entry)),
  };
  return deepFreeze({
    state: next,
    event,
    ballReleased: nextBallReleased,
    review,
  });
}

export function syncCssoccerOffsidePlayerFlag(state, {
  playerId,
  nativePlayerNumber,
  tmOff,
} = {}) {
  const current = assertCssoccerOffsideState(state);
  requirePlayerId(playerId, "offside sync playerId");
  requirePlayerNumber(nativePlayerNumber, "offside sync nativePlayerNumber");
  requireTmOff(tmOff, "offside sync tmOff");
  const player = current.players.find(({ id }) => id === playerId);
  if (!player || player.nativePlayerNumber !== nativePlayerNumber) {
    throw new Error("Offside sync stable id and current native number do not match.");
  }
  return deepFreeze({
    ...clone(current),
    players: current.players.map((entry) => entry.id === playerId
      ? { ...clone(entry), tmOff }
      : clone(entry)),
  });
}

export function markCssoccerOffsideInvolvement(state, {
  playerId,
  nativePlayerNumber,
} = {}) {
  const current = assertCssoccerOffsideState(state);
  requirePlayerId(playerId, "offside involvement playerId");
  requirePlayerNumber(nativePlayerNumber, "offside involvement nativePlayerNumber");
  const player = current.players.find(({ id }) => id === playerId);
  if (player === undefined || player.nativePlayerNumber !== nativePlayerNumber) {
    throw new Error("Offside involvement stable id and current native number do not match.");
  }
  return deepFreeze({
    ...clone(current),
    offsideNow: 1,
    players: current.players.map((entry) => entry.id === playerId
      ? { ...clone(entry), tmOff: 0 }
      : clone(entry)),
  });
}

export function clearCssoccerOffsideRestart(state) {
  const current = assertCssoccerOffsideState(state);
  return deepFreeze({ ...clone(current), offsideNow: 0 });
}

export function remapCssoccerOffsidePlayers(state, mappings) {
  const current = assertCssoccerOffsideState(state);
  const map = requirePlayerDescriptors(mappings);
  const byId = new Map(map.map(({ id, nativePlayerNumber }) => [id, nativePlayerNumber]));
  if (current.players.some(({ id }) => !byId.has(id))) {
    throw new Error("Offside remapping must preserve all stable player ids.");
  }
  for (const player of current.players) {
    const expected = player.nativePlayerNumber < 12
      ? player.nativePlayerNumber + 11
      : player.nativePlayerNumber - 11;
    if (byId.get(player.id) !== expected) {
      throw new Error("Offside remapping must be the source 11-player halftime slot swap.");
    }
  }
  return deepFreeze({
    ...clone(current),
    players: current.players.map((entry) => ({
      ...clone(entry),
      nativePlayerNumber: byId.get(entry.id),
      tmOff: 0,
    })),
  });
}

export function assertCssoccerOffsideState(state) {
  requirePlainObject(state, "offside state");
  if (state.schema !== CSSOCCER_OFFSIDE_SCHEMA) {
    throw new Error(`offside state must use ${CSSOCCER_OFFSIDE_SCHEMA}.`);
  }
  requireFlag(state.configuredEnabled, "offside configuredEnabled");
  requireFlag(state.practice, "offside practice");
  requireFlag(state.offsideOn, "offside offsideOn");
  requireFlag(state.offsideNow, "offside offsideNow");
  if (state.offsideOn !== (state.practice === 1 ? 0 : state.configuredEnabled)) {
    throw new Error("Offside enablement diverged from the configured/practice source rule.");
  }
  if (!Array.isArray(state.players) || state.players.length !== 22) {
    throw new Error("Offside state must contain exactly 22 stable players.");
  }
  const ids = new Set();
  const numbers = new Set();
  for (const player of state.players) {
    requirePlainObject(player, "offside player");
    requirePlayerId(player.id, "offside player id");
    requirePlayerNumber(player.nativePlayerNumber, "offside native player number");
    requireTmOff(player.tmOff, "offside tmOff");
    if (ids.has(player.id) || numbers.has(player.nativePlayerNumber)) {
      throw new Error("Offside players must have unique stable ids and native numbers.");
    }
    ids.add(player.id);
    numbers.add(player.nativePlayerNumber);
  }
  return state;
}

function requirePlayerDescriptors(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Offside players must provide exactly 22 descriptors.");
  }
  const ids = new Set();
  const numbers = new Set();
  return value.map((entry, index) => {
    requirePlainObject(entry, `offside player descriptor ${index}`);
    const extras = Object.keys(entry).filter((key) => !["id", "nativePlayerNumber", "tmOff"].includes(key));
    if (extras.length > 0) throw new Error("Offside descriptors support only id, nativePlayerNumber, and tmOff.");
    requirePlayerId(entry.id, "offside descriptor id");
    requirePlayerNumber(entry.nativePlayerNumber, "offside descriptor nativePlayerNumber");
    const tmOff = entry.tmOff ?? 0;
    requireTmOff(tmOff, "offside descriptor tmOff");
    if (ids.has(entry.id) || numbers.has(entry.nativePlayerNumber)) {
      throw new Error("Offside descriptors must be unique.");
    }
    ids.add(entry.id);
    numbers.add(entry.nativePlayerNumber);
    return { id: entry.id, nativePlayerNumber: entry.nativePlayerNumber, tmOff };
  });
}

function requireTmOff(value, label) {
  if (![0, 1, -1, -2].includes(value)) {
    throw new TypeError(`${label} must be the native 0, 1, -1, or -2 flag.`);
  }
}

function sourceDistance(x, y) {
  return f32(Math.sqrt(f32(f32(x * x) + f32(y * y))));
}

function requireLivePasser(value, players) {
  requirePlainObject(value, "live offside passer");
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "nativePlayerNumber" || keys[1] !== "playerId") {
    throw new TypeError("live offside passer must contain exactly playerId and nativePlayerNumber.");
  }
  requirePlayerId(value.playerId, "live offside passer playerId");
  requirePlayerNumber(value.nativePlayerNumber, "live offside passer nativePlayerNumber");
  const player = players.find(({ id }) => id === value.playerId);
  if (
    player === undefined
    || player.nativePlayerNumber !== value.nativePlayerNumber
    || player.active !== 1
  ) {
    throw new Error("Live offside passer must be the current active stable player.");
  }
  return { playerId: value.playerId, nativePlayerNumber: value.nativePlayerNumber };
}

function requireLivePlayers(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Live offside requires exactly 22 current players.");
  }
  const ids = new Set();
  const numbers = new Set();
  return value.map((entry, index) => {
    requirePlainObject(entry, `live offside player ${index}`);
    const keys = Object.keys(entry).sort();
    const expected = ["active", "id", "nativePlayerNumber", "position", "role"];
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new TypeError(
        `live offside player ${index} must contain exactly active, id, nativePlayerNumber, position, and role.`,
      );
    }
    requirePlayerId(entry.id, `live offside player ${index} id`);
    requirePlayerNumber(
      entry.nativePlayerNumber,
      `live offside player ${index} nativePlayerNumber`,
    );
    requireFlag(entry.active, `live offside player ${index} active`);
    if (entry.role !== "keeper" && entry.role !== "outfield") {
      throw new Error(`live offside player ${index} role must be keeper or outfield.`);
    }
    const position = requirePosition(entry.position, `live offside player ${index} position`);
    if (ids.has(entry.id) || numbers.has(entry.nativePlayerNumber)) {
      throw new Error("Live offside current players must have unique identities and slots.");
    }
    ids.add(entry.id);
    numbers.add(entry.nativePlayerNumber);
    return {
      id: entry.id,
      nativePlayerNumber: entry.nativePlayerNumber,
      nativeTeam: entry.nativePlayerNumber < 12 ? "A" : "B",
      active: entry.active,
      role: entry.role,
      position,
    };
  });
}

function cancelledLiveOffside(snapshot, reason) {
  return deepFreeze({
    status: "cancelled",
    snapshot: null,
    event: {
      type: "offside-cancelled",
      reason,
      kickTick: snapshot.kickTick,
      passerId: snapshot.passerId,
    },
  });
}

function involvedLiveOffside(
  snapshot,
  candidate,
  position,
  reason,
  distanceToBall = null,
) {
  return deepFreeze({
    status: "involved",
    snapshot: null,
    event: {
      type: "offside-involvement",
      reason,
      kickTick: snapshot.kickTick,
      playerId: candidate.playerId,
      nativePlayerNumber: candidate.nativePlayerNumber,
      incidentPosition: clone(position),
      distanceToBall,
    },
  });
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

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
}

function requireFiniteNonnegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite nonnegative number.`);
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

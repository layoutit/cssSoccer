export const CSSOCCER_DISCIPLINE_SCHEMA = "cssoccer-discipline-state@1";

export const CSSOCCER_DISCIPLINE_SOURCE = deepFreeze({
  file: "RULES.CPP",
  sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
  functions: {
    yellow: "big_yeller, lines 1454-1468",
    dismissal: "ger_em_off, lines 1473-1531",
    cardDecision: "send_off_plr, lines 1536-1561",
    statistics: "inc_yellow/inc_red, lines 1992-2003",
    halftimeSwap: "swap_teams, lines 392-421",
  },
  removal: {
    file: "INTELL.CPP",
    sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
    functions: "remove_player/init_off_int, lines 8028-8093",
  },
  realSpeed: 20,
  goalkeeperNumbers: [1, 12],
  maximumDismissalsPerNativeTeam: 5,
});

export class CssoccerUnsupportedDisciplineError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedDisciplineError";
    this.code = code;
    this.detail = deepFreeze(clone(detail));
  }
}

export function createCssoccerDisciplineState({ players, bookingsEnabled = 1 } = {}) {
  requireFlag(bookingsEnabled, "bookingsEnabled");
  const records = requirePlayerDescriptors(players).map(({ id, nativePlayerNumber, active }) => ({
    id,
    nativePlayerNumber,
    tmBook: 0,
    tmFouls: 0,
    guyOn: active,
    ruleEligible: active === 1,
    status: active === 1 ? "active" : "unavailable",
    lastCard: null,
  }));
  return deepFreeze({
    schema: CSSOCCER_DISCIPLINE_SCHEMA,
    bookingsEnabled,
    playersOff: { A: 0, B: 0 },
    playerOnOff: 0,
    players: records,
  });
}

export function resolveCssoccerCard(state, {
  playerId,
  nativePlayerNumber,
  direct,
  nastiness,
  seed,
} = {}) {
  const current = assertCssoccerDisciplineState(state);
  requirePlayerId(playerId, "card playerId");
  requirePlayerNumber(nativePlayerNumber, "card nativePlayerNumber");
  requireFlag(direct, "card direct");
  requireFiniteNonnegative(nastiness, "card nastiness");
  requireIntegerRange(seed, 0, 127, "card seed");
  const player = requireMappedPlayer(current, playerId, nativePlayerNumber);

  let reason = "threshold-not-met";
  let card = null;
  if (direct === 0) reason = "indirect-foul";
  else if (current.bookingsEnabled === 0) reason = "bookings-disabled";
  else if (nativePlayerNumber === 1 || nativePlayerNumber === 12) reason = "goalkeeper-exempt";
  else if (!player.ruleEligible) reason = "player-ineligible";
  else if (current.playerOnOff !== 0) {
    throw new CssoccerUnsupportedDisciplineError(
      "dismissal-transition-active",
      "A second card cannot be resolved while the native player_on_off transition is active.",
      { playerOnOff: current.playerOnOff },
    );
  } else {
    const nativeTeam = nativeTeamFor(nativePlayerNumber);
    const canDismiss = current.playersOff[nativeTeam]
      < CSSOCCER_DISCIPLINE_SOURCE.maximumDismissalsPerNativeTeam;
    if (player.tmBook !== 0) {
      if (nastiness > seed && canDismiss) card = "red";
      else if (nastiness > seed && !canDismiss) reason = "dismissal-cap";
    } else if (nastiness > seed * 4) {
      if (canDismiss) card = "red";
      else reason = "dismissal-cap";
    } else if (nastiness > seed) {
      card = "yellow";
    }
  }

  if (card === null) {
    return deepFreeze({
      state: current,
      event: {
        type: "discipline-decision",
        playerId,
        nativePlayerNumber,
        card: null,
        reason,
        nastiness,
        seed,
      },
    });
  }

  const nativeTeam = nativeTeamFor(nativePlayerNumber);
  const cardTicks = card === "yellow"
    ? 3 * CSSOCCER_DISCIPLINE_SOURCE.realSpeed
    : 6 * CSSOCCER_DISCIPLINE_SOURCE.realSpeed;
  const players = current.players.map((entry) => entry.id === playerId
    ? {
      ...clone(entry),
      tmBook: entry.tmBook + (card === "yellow" ? 1 : 5),
      ruleEligible: card === "red" ? false : entry.ruleEligible,
      status: card === "red" ? "dismissal-pending" : entry.status,
      lastCard: card,
    }
    : clone(entry));
  const next = {
    ...clone(current),
    players,
    playersOff: {
      ...clone(current.playersOff),
      [nativeTeam]: current.playersOff[nativeTeam] + (card === "red" ? 1 : 0),
    },
    playerOnOff: card === "red" ? nativePlayerNumber : 0,
  };
  return deepFreeze({
    state: next,
    event: {
      type: "discipline-decision",
      playerId,
      nativePlayerNumber,
      nativeTeam,
      card,
      reason: card === "yellow" ? "first-card-threshold" : "dismissal-threshold",
      cardTicks,
      tmBook: players.find(({ id }) => id === playerId).tmBook,
      playerOnOff: next.playerOnOff,
      ruleEligible: card !== "red",
      nastiness,
      seed,
    },
  });
}

/** Complete INTELL.CPP's tunnel transition after a red-card decision. */
export function completeCssoccerDismissal(state, { playerId } = {}) {
  const current = assertCssoccerDisciplineState(state);
  requirePlayerId(playerId, "dismissed playerId");
  const player = current.players.find(({ id }) => id === playerId);
  if (!player || player.status !== "dismissal-pending") {
    throw new Error("Dismissal completion requires the current dismissal-pending player.");
  }
  if (current.playerOnOff !== player.nativePlayerNumber) {
    throw new Error("Discipline playerOnOff no longer names the pending player.");
  }
  return deepFreeze({
    ...clone(current),
    playerOnOff: 0,
    players: current.players.map((entry) => entry.id === playerId
      ? { ...clone(entry), guyOn: 0, ruleEligible: false, status: "dismissed" }
      : clone(entry)),
  });
}

export function addCssoccerFoulPoints(state, {
  playerId,
  nativePlayerNumber,
  points,
} = {}) {
  const current = assertCssoccerDisciplineState(state);
  requirePlayerId(playerId, "foul playerId");
  requirePlayerNumber(nativePlayerNumber, "foul nativePlayerNumber");
  if (![1, 3, 10].includes(points)) {
    throw new TypeError("foul points must be the native indirect/direct/penalty weight 1, 3, or 10.");
  }
  requireMappedPlayer(current, playerId, nativePlayerNumber);
  return deepFreeze({
    ...clone(current),
    players: current.players.map((entry) => entry.id === playerId
      ? { ...clone(entry), tmFouls: entry.tmFouls + points }
      : clone(entry)),
  });
}

/** Keep stable player ids while the native A/B player-number slots swap at half time. */
export function remapCssoccerDisciplinePlayers(state, mappings) {
  const current = assertCssoccerDisciplineState(state);
  if (current.playerOnOff !== 0) {
    throw new CssoccerUnsupportedDisciplineError(
      "dismissal-transition-active",
      "Native player slots cannot be remapped during a dismissal transition.",
      { playerOnOff: current.playerOnOff },
    );
  }
  const map = requirePlayerDescriptors(mappings);
  if (map.some(({ active }) => active !== 1)) {
    throw new Error("Discipline remapping changes native slots only; active state stays discipline-owned.");
  }
  const byId = new Map(map.map((entry) => [entry.id, entry.nativePlayerNumber]));
  if (current.players.some(({ id }) => !byId.has(id))) {
    throw new Error("Discipline remapping must preserve every stable player id.");
  }
  for (const player of current.players) {
    const expected = player.nativePlayerNumber < 12
      ? player.nativePlayerNumber + 11
      : player.nativePlayerNumber - 11;
    if (byId.get(player.id) !== expected) {
      throw new Error("Discipline remapping must be the source 11-player halftime slot swap.");
    }
  }
  return deepFreeze({
    ...clone(current),
    playersOff: { A: current.playersOff.B, B: current.playersOff.A },
    players: current.players.map((entry) => ({
      ...clone(entry),
      nativePlayerNumber: byId.get(entry.id),
    })),
  });
}

export function eligibleCssoccerRuleCandidates(state, candidates) {
  const current = assertCssoccerDisciplineState(state);
  if (!Array.isArray(candidates)) throw new TypeError("rule candidates must be an array.");
  return deepFreeze(candidates.filter((candidate) => {
    requirePlainObject(candidate, "rule candidate");
    requirePlayerId(candidate.playerId, "rule candidate playerId");
    requirePlayerNumber(candidate.nativePlayerNumber, "rule candidate nativePlayerNumber");
    const player = requireMappedPlayer(current, candidate.playerId, candidate.nativePlayerNumber);
    return player.ruleEligible && player.guyOn === 1;
  }).map(clone));
}

export function assertCssoccerDisciplineState(state) {
  requirePlainObject(state, "discipline state");
  if (state.schema !== CSSOCCER_DISCIPLINE_SCHEMA) {
    throw new Error(`discipline state must use ${CSSOCCER_DISCIPLINE_SCHEMA}.`);
  }
  requireFlag(state.bookingsEnabled, "discipline bookingsEnabled");
  requirePlainObject(state.playersOff, "discipline playersOff");
  requireIntegerRange(state.playersOff.A, 0, 5, "discipline playersOff.A");
  requireIntegerRange(state.playersOff.B, 0, 5, "discipline playersOff.B");
  requireIntegerRange(state.playerOnOff, 0, 22, "discipline playerOnOff");
  if (!Array.isArray(state.players) || state.players.length !== 22) {
    throw new Error("discipline state must contain exactly 22 stable players.");
  }
  const ids = new Set();
  const numbers = new Set();
  for (const player of state.players) {
    requirePlainObject(player, "discipline player");
    requirePlayerId(player.id, "discipline player id");
    requirePlayerNumber(player.nativePlayerNumber, "discipline native player number");
    if (ids.has(player.id) || numbers.has(player.nativePlayerNumber)) {
      throw new Error("discipline players must have unique ids and native player numbers.");
    }
    ids.add(player.id);
    numbers.add(player.nativePlayerNumber);
    requireIntegerRange(player.tmBook, 0, 0x7fffffff, "discipline tmBook");
    requireIntegerRange(player.tmFouls, 0, 0x7fffffff, "discipline tmFouls");
    requireFlag(player.guyOn, "discipline guyOn");
    if (typeof player.ruleEligible !== "boolean") {
      throw new TypeError("discipline ruleEligible must be boolean.");
    }
    if (!["active", "unavailable", "dismissal-pending", "dismissed"].includes(player.status)) {
      throw new Error("discipline player status is unsupported.");
    }
    if (player.lastCard !== null && player.lastCard !== "yellow" && player.lastCard !== "red") {
      throw new Error("discipline lastCard is unsupported.");
    }
  }
  const pending = state.players.filter(({ status }) => status === "dismissal-pending");
  if (
    (state.playerOnOff === 0 && pending.length !== 0)
    || (state.playerOnOff !== 0 && (
      pending.length !== 1 || pending[0].nativePlayerNumber !== state.playerOnOff
    ))
  ) {
    throw new Error("discipline dismissal transition is inconsistent.");
  }
  return state;
}

function requirePlayerDescriptors(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("discipline players must provide exactly 22 descriptors.");
  }
  const ids = new Set();
  const numbers = new Set();
  return value.map((entry, index) => {
    requirePlainObject(entry, `discipline player descriptor ${index}`);
    const keys = Object.keys(entry);
    if (keys.some((key) => !["id", "nativePlayerNumber", "active"].includes(key))) {
      throw new Error("discipline player descriptors support only id, nativePlayerNumber, and active.");
    }
    requirePlayerId(entry.id, "discipline descriptor id");
    requirePlayerNumber(entry.nativePlayerNumber, "discipline descriptor nativePlayerNumber");
    const active = entry.active ?? 1;
    requireFlag(active, "discipline descriptor active");
    if (ids.has(entry.id) || numbers.has(entry.nativePlayerNumber)) {
      throw new Error("discipline player descriptors must be unique.");
    }
    ids.add(entry.id);
    numbers.add(entry.nativePlayerNumber);
    return { id: entry.id, nativePlayerNumber: entry.nativePlayerNumber, active };
  });
}

function requireMappedPlayer(state, playerId, nativePlayerNumber) {
  const player = state.players.find(({ id }) => id === playerId);
  if (!player || player.nativePlayerNumber !== nativePlayerNumber) {
    throw new Error("Stable player id and current native player number do not match discipline state.");
  }
  return player;
}

function nativeTeamFor(nativePlayerNumber) {
  return nativePlayerNumber < 12 ? "A" : "B";
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

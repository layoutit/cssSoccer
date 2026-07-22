import {
  addCssoccerFoulPoints,
  assertCssoccerDisciplineState,
  completeCssoccerDismissal,
  createCssoccerDisciplineState,
  eligibleCssoccerRuleCandidates,
  remapCssoccerDisciplinePlayers,
  resolveCssoccerCard,
} from "./disciplineState.mjs";
import {
  assertCssoccerFoulState,
  calculateCssoccerFoulNastiness,
  createCssoccerFoulRestart,
  createCssoccerFoulState,
  resolveCssoccerAdvantage,
  resolveCssoccerFoulCall,
} from "./foulState.mjs";
import {
  assertCssoccerOffsideState,
  clearCssoccerOffsideRestart,
  createCssoccerOffsideState,
  remapCssoccerOffsidePlayers,
  stepCssoccerOffsidePlayer,
} from "./offsideState.mjs";

export const CSSOCCER_RULE_SCHEMA = "cssoccer-rule-state@1";

export const CSSOCCER_RULE_SOURCE = deepFreeze({
  rules: {
    file: "RULES.CPP",
    sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
  },
  intelligence: {
    file: "INTELL.CPP",
    sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
  },
  actions: {
    file: "ACTIONS.CPP",
    sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
  },
  football: {
    file: "FOOTBALL.CPP",
    sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
  },
  fixtureReferee: {
    accuracy: 100,
    strictness: 80,
    source:
      "TEST.CPP line 534 selects the Euro referee; EURO_VAR.CPP line 1150 initializes vision 100; FOOTBALL.CPP line 1243 stores ref_accuracy",
  },
  processOrder: [
    "source-owned foul or offside candidate",
    "referee visibility",
    "advantage decision",
    "discipline decision for direct fouls",
    "penalty/direct/indirect restart and stable taker",
  ],
});

export function createCssoccerRuleState({
  players,
  freeKicksEnabled = 1,
  bookingsEnabled = 1,
  offsideEnabled = 1,
  practice = 0,
  refereeAccuracy = CSSOCCER_RULE_SOURCE.fixtureReferee.accuracy,
  refereeStrictness = CSSOCCER_RULE_SOURCE.fixtureReferee.strictness,
} = {}) {
  const descriptors = requireRulePlayers(players);
  requireFlag(freeKicksEnabled, "rule freeKicksEnabled");
  requireFlag(bookingsEnabled, "rule bookingsEnabled");
  requireFlag(offsideEnabled, "rule offsideEnabled");
  requireFlag(practice, "rule practice");
  requireIntegerRange(refereeAccuracy, 0, 255, "rule refereeAccuracy");
  requireIntegerRange(refereeStrictness, 0, 255, "rule refereeStrictness");
  return deepFreeze({
    schema: CSSOCCER_RULE_SCHEMA,
    config: {
      freeKicksEnabled,
      bookingsEnabled,
      offsideEnabled,
      practice,
      refereeAccuracy,
      refereeStrictness,
    },
    foul: createCssoccerFoulState(),
    discipline: createCssoccerDisciplineState({
      players: descriptors,
      bookingsEnabled,
    }),
    offside: createCssoccerOffsideState({
      players: descriptors.map(({ id, nativePlayerNumber }) => ({ id, nativePlayerNumber })),
      enabled: offsideEnabled,
      practice,
    }),
    lastRestart: null,
    lastDisciplineEvent: null,
  });
}

/** Resolve a checked contact/offside/double-touch producer and materialize any restart. */
export function resolveCssoccerRuleFoul(state, {
  candidate,
  offenderPosition,
  refereePosition,
  ballPossession,
  justScored,
  manDown,
  offenderDistanceToBall,
  rng,
  takerCandidates,
  preferredTaker = null,
} = {}) {
  const current = assertCssoccerRuleState(state);
  const playerId = requireCandidateIdentity(current, candidate);
  const foul = resolveCssoccerFoulCall(current.foul, {
    candidate,
    offenderPosition,
    refereePosition,
    ballPossession,
    justScored,
    freeKicksEnabled: current.config.freeKicksEnabled,
    refereeAccuracy: current.config.refereeAccuracy,
    refereeStrictness: current.config.refereeStrictness,
    manDown,
    rng,
  });
  const base = {
    ...clone(current),
    foul: foul.state,
  };
  if (foul.decision.status !== "restart-required") {
    return deepFreeze({
      state: base,
      decision: foul.decision,
      restart: null,
      disciplineEvent: null,
      rng: foul.rng,
    });
  }
  const completed = completeRuleRestart(base, {
    decision: foul.decision,
    playerId,
    manDown,
    offenderDistanceToBall,
    takerCandidates,
    preferredTaker,
    disciplineSeed: foul.rng.seed,
  });
  return deepFreeze({ ...completed, decision: foul.decision, rng: foul.rng });
}

export function resolveCssoccerRuleAdvantage(state, {
  ballPossession,
  offenderDistanceToBall,
  manDown,
  takerCandidates,
  preferredTaker = null,
  disciplineSeed,
} = {}) {
  const current = assertCssoccerRuleState(state);
  const advantage = resolveCssoccerAdvantage(current.foul, { ballPossession });
  const base = { ...clone(current), foul: advantage.state };
  if (advantage.decision.status !== "restart-required") {
    return deepFreeze({
      state: base,
      decision: advantage.decision,
      restart: null,
      disciplineEvent: null,
    });
  }
  requireIntegerRange(disciplineSeed, 0, 127, "advantage disciplineSeed");
  const playerId = advantage.decision.candidate?.playerId;
  if (typeof playerId !== "string") {
    throw new Error("Pending advantage lost its stable offender identity.");
  }
  const completed = completeRuleRestart(base, {
    decision: advantage.decision,
    playerId,
    manDown,
    offenderDistanceToBall,
    takerCandidates,
    preferredTaker,
    disciplineSeed,
  });
  return deepFreeze({ ...completed, decision: advantage.decision });
}

/**
 * Execute one source offside visit and, when active interference is flagged,
 * route its forced-seen indirect foul through the same restart reducer.
 */
export function stepCssoccerRuleOffside(state, context) {
  const current = assertCssoccerRuleState(state);
  requirePlainObject(context, "rule offside context");
  const offside = stepCssoccerOffsidePlayer(current.offside, context);
  const base = { ...clone(current), offside: offside.state };
  if (offside.event === null) {
    return deepFreeze({
      state: base,
      event: null,
      decision: null,
      restart: null,
      disciplineEvent: null,
      ballReleased: offside.ballReleased,
      review: offside.review,
      rng: context.rng,
    });
  }
  const routed = resolveCssoccerRuleFoul(base, {
    candidate: offside.event,
    offenderPosition: context.position,
    refereePosition: context.refereePosition,
    ballPossession: context.ballPossession,
    justScored: context.justScored,
    manDown: 0,
    offenderDistanceToBall: context.distanceToBall,
    rng: context.rng,
    takerCandidates: context.takerCandidates,
    preferredTaker: null,
  });
  return deepFreeze({
    ...routed,
    event: offside.event,
    ballReleased: offside.ballReleased,
    review: offside.review,
  });
}

export function clearCssoccerRuleRestart(state) {
  const current = assertCssoccerRuleState(state);
  if (current.foul.playAdvantage !== 0) {
    throw new Error("A rule restart cannot clear while advantage remains pending.");
  }
  return deepFreeze({
    ...clone(current),
    offside: clearCssoccerOffsideRestart(current.offside),
    lastRestart: null,
    lastDisciplineEvent: null,
  });
}

export function completeCssoccerRuleDismissal(state, { playerId } = {}) {
  const current = assertCssoccerRuleState(state);
  return deepFreeze({
    ...clone(current),
    discipline: completeCssoccerDismissal(current.discipline, { playerId }),
  });
}

export function remapCssoccerRulePlayers(state, mappings) {
  const current = assertCssoccerRuleState(state);
  const descriptors = requireRulePlayers(mappings);
  if (current.foul.playAdvantage !== 0 || current.lastRestart !== null) {
    throw new Error("Rule native slots may only remap at a clear halftime boundary.");
  }
  return deepFreeze({
    ...clone(current),
    discipline: remapCssoccerDisciplinePlayers(
      current.discipline,
      descriptors.map(({ id, nativePlayerNumber }) => ({ id, nativePlayerNumber })),
    ),
    offside: remapCssoccerOffsidePlayers(
      current.offside,
      descriptors.map(({ id, nativePlayerNumber }) => ({ id, nativePlayerNumber })),
    ),
  });
}

export function assertCssoccerRuleState(state) {
  requirePlainObject(state, "rule state");
  if (state.schema !== CSSOCCER_RULE_SCHEMA) {
    throw new Error(`rule state must use ${CSSOCCER_RULE_SCHEMA}.`);
  }
  requirePlainObject(state.config, "rule config");
  requireFlag(state.config.freeKicksEnabled, "rule config freeKicksEnabled");
  requireFlag(state.config.bookingsEnabled, "rule config bookingsEnabled");
  requireFlag(state.config.offsideEnabled, "rule config offsideEnabled");
  requireFlag(state.config.practice, "rule config practice");
  requireIntegerRange(state.config.refereeAccuracy, 0, 255, "rule config refereeAccuracy");
  requireIntegerRange(state.config.refereeStrictness, 0, 255, "rule config refereeStrictness");
  assertCssoccerFoulState(state.foul);
  assertCssoccerDisciplineState(state.discipline);
  assertCssoccerOffsideState(state.offside);
  const disciplineIds = state.discipline.players.map(({ id, nativePlayerNumber }) => `${id}:${nativePlayerNumber}`);
  const offsideIds = state.offside.players.map(({ id, nativePlayerNumber }) => `${id}:${nativePlayerNumber}`);
  if (JSON.stringify(disciplineIds) !== JSON.stringify(offsideIds)) {
    throw new Error("Rule discipline and offside stable player mappings diverged.");
  }
  return state;
}

function completeRuleRestart(state, {
  decision,
  playerId,
  manDown,
  offenderDistanceToBall,
  takerCandidates,
  preferredTaker,
  disciplineSeed,
}) {
  requireFiniteNonnegative(manDown, "rule restart manDown");
  requireFiniteNonnegative(offenderDistanceToBall, "rule restart offenderDistanceToBall");
  requireIntegerRange(disciplineSeed, 0, 127, "rule restart disciplineSeed");
  const nastiness = calculateCssoccerFoulNastiness({
    offenderDistanceToBall,
    refereeStrictness: state.config.refereeStrictness,
    manDown,
  });
  const card = resolveCssoccerCard(state.discipline, {
    playerId,
    nativePlayerNumber: decision.fouler,
    direct: decision.direct,
    nastiness,
    seed: disciplineSeed,
  });
  const eligible = eligibleCssoccerRuleCandidates(card.state, takerCandidates);
  const restart = createCssoccerFoulRestart({
    decision,
    candidates: eligible,
    preferredTaker,
  });
  const discipline = addCssoccerFoulPoints(card.state, {
    playerId,
    nativePlayerNumber: decision.fouler,
    points: restart.foulPoints,
  });
  const next = {
    ...clone(state),
    discipline,
    lastRestart: restart,
    lastDisciplineEvent: card.event,
  };
  return {
    state: next,
    restart,
    disciplineEvent: card.event,
  };
}

function requireCandidateIdentity(state, candidate) {
  requirePlainObject(candidate, "rule foul candidate");
  requirePlayerId(candidate.playerId, "rule foul candidate playerId");
  requireIntegerRange(candidate.fouler, 1, 22, "rule foul candidate fouler");
  const player = state.discipline.players.find(({ id }) => id === candidate.playerId);
  if (!player || player.nativePlayerNumber !== candidate.fouler) {
    throw new Error("Rule foul candidate stable identity does not match the native offender.");
  }
  if (!player.ruleEligible || player.guyOn !== 1) {
    throw new Error("Dismissed or unavailable players cannot create new rule candidates.");
  }
  return candidate.playerId;
}

function requireRulePlayers(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Rule state requires exactly 22 stable player descriptors.");
  }
  const ids = new Set();
  const numbers = new Set();
  return value.map((entry, index) => {
    requirePlainObject(entry, `rule player descriptor ${index}`);
    const extras = Object.keys(entry).filter((key) => !["id", "nativePlayerNumber", "active"].includes(key));
    if (extras.length > 0) throw new Error("Rule player descriptors support only id, nativePlayerNumber, and active.");
    requirePlayerId(entry.id, "rule player id");
    requireIntegerRange(entry.nativePlayerNumber, 1, 22, "rule nativePlayerNumber");
    const active = entry.active ?? 1;
    requireFlag(active, "rule player active");
    if (ids.has(entry.id) || numbers.has(entry.nativePlayerNumber)) {
      throw new Error("Rule player descriptors must have unique ids and native numbers.");
    }
    ids.add(entry.id);
    numbers.add(entry.nativePlayerNumber);
    return { id: entry.id, nativePlayerNumber: entry.nativePlayerNumber, active };
  });
}

function requirePlayerId(value, label) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} must be a fixed-fixture stable player id.`);
  }
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

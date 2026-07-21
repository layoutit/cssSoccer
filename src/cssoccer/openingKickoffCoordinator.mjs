import {
  assertCssoccerActionState,
  createCssoccerActionState,
} from "./actionState.mjs";
import {
  createBallMatchState,
  stepBallMatchState,
} from "./ballMatchState.mjs";
import {
  CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA,
  launchCssoccerCentrePass,
} from "./centrePassLaunch.mjs";
import {
  assertCssoccerKickoffPlayerMotion,
  stepCssoccerKickoffPlayerMotion,
} from "./kickoffPlayerMotion.mjs";
import {
  assertCssoccerKickoffState,
  completeCssoccerKickoffLaunch,
  stepCssoccerKickoffState,
} from "./kickoffState.mjs";
import {
  assertCssoccerNativeGameplayProfile,
} from "./nativeGameplayProfile.mjs";
import {
  assertCssoccerOfficialState,
  createCssoccerOpeningOfficialState,
  projectCssoccerOpeningRefereeAction,
  stepCssoccerOpeningOfficialState,
} from "./officialState.mjs";
import { createPossessionState } from "./possessionState.mjs";

const FIXTURE_ID = "spain-argentina-full-match";

export const CSSOCCER_OPENING_KICKOFF_COORDINATOR_SCHEMA =
  "cssoccer-opening-kickoff-coordinator@1";

export const CSSOCCER_OPENING_KICKOFF_SOURCE_ORDER = deepFreeze([
  "process_ball: advance the held centre ball",
  "match_rules: observe prior player/official state and resolve await_set_kick",
  "process_flags: consume the current source player_stamina tm_rate projection",
  "process_teams: advance the 22 kickoff players only while positioning continues",
  "process_offs: advance the opening referee only while positioning continues",
]);

export const CSSOCCER_OPENING_KICKOFF_COORDINATOR_SOURCE = deepFreeze({
  files: [
    {
      file: "FOOTBALL.CPP",
      sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
      producers: ["process_ball", "match_rules", "process_teams", "process_offs"],
    },
    {
      file: "RULES.CPP",
      sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
      producers: ["all_standing", "await_set_kick", "decide_set_kick", "ready_set_kick"],
    },
  ],
  sourceOrder: CSSOCCER_OPENING_KICKOFF_SOURCE_ORDER,
  qualification: {
    officialState: "source-derived-native-refs-uncaptured",
    endToEndNativeExact: false,
    reason:
      "The coordinator composes accepted reducers, but official refs are uncaptured and player motion has a bounded native-exact frontier.",
  },
  supportedSubset: [
    "opening and post-swap native-team-A centre positioning",
    "static centre-ball processing while the set piece is active",
    "22-player stand/run positioning and sticky kickoff readiness",
    "source-derived referee positioning through ready action 4",
    "one native-player-7 to native-player-10 pre-contact launch receipt",
  ],
  unsupportedAfterLaunch: [
    "MCC_PASS animation contact and physical ball release",
    "receiver contact, control, or rebound resolution",
    "normal-play scheduling, rules, officials, motion, or possession",
  ],
});

const STATE_KEYS = Object.freeze([
  "ball",
  "bindings",
  "fixtureId",
  "kickoff",
  "kickoffMotion",
  "launch",
  "milestones",
  "official",
  "phase",
  "phaseTick",
  "possession",
  "schema",
  "sourceOrder",
  "tick",
  "unsupportedAfterLaunch",
]);

const MILESTONE_KEYS = Object.freeze([
  "kickoffReadyTick",
  "launchReceiptTick",
  "playersSettledTick",
  "refereeReadyTick",
]);

export class CssoccerUnsupportedOpeningKickoffCoordinatorError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedOpeningKickoffCoordinatorError";
    this.code = "CSSOCCER_UNSUPPORTED_OPENING_KICKOFF_COORDINATOR";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/**
 * Bind accepted opening reducers at one ordinary browser/runtime boundary.
 * Ignored source, captures, and parity records never enter this state.
 */
export function createCssoccerOpeningKickoffCoordinator(input = {}) {
  requirePlainObject(input, "opening kickoff coordinator input");
  requireExactKeys(input, [
    "ball",
    "kickoff",
    "kickoffMotion",
    "nativeGameplayProfile",
    "possession",
  ], "opening kickoff coordinator input");

  const profile = assertCssoccerNativeGameplayProfile(input.nativeGameplayProfile);
  const kickoff = assertCssoccerKickoffState(input.kickoff);
  const kickoffMotion = assertCssoccerKickoffPlayerMotion(input.kickoffMotion);
  const ball = requireExactBall(input.ball);
  const possession = requireExactPossession(input.possession);

  if (
    kickoff.phase !== "centre-positioning"
    || kickoff.phaseTick !== 0
    || kickoffMotion.initialTick !== 0
    || kickoffMotion.tick !== 0
  ) {
    throw new Error("Opening kickoff coordination must begin at the centre-positioning tick-zero seam.");
  }
  requireReducerBindings({ kickoff, kickoffMotion, profile });
  requireHeldCentreBall(ball, kickoff, ball.ball.tick);
  requireFreePossession(possession, kickoff.teamBySlot);

  const official = createCssoccerOpeningOfficialState({
    centreOwner: kickoff.owner.nativeTeamSlot,
    nativeGameplayProfile: profile,
  });
  const tick = ball.ball.tick;
  return assemble({
    tick,
    phaseTick: 0,
    phase: "centre-positioning",
    kickoff,
    kickoffMotion,
    official,
    ball,
    possession,
    launch: null,
    milestones: {
      playersSettledTick: kickoffMotion.status === "settled" ? tick : null,
      refereeReadyTick: official.status === "ready" ? tick : null,
      kickoffReadyTick: null,
      launchReceiptTick: null,
    },
    bindings: coordinatorBindings({ kickoff, kickoffMotion, profile }),
  });
}

/**
 * Advance one source tick. Rules observe the prior team/official stores;
 * process_teams and process_offs run later only if rules did not launch.
 */
export function stepCssoccerOpeningKickoffCoordinator(state, options = {}) {
  const current = assertCssoccerOpeningKickoffCoordinator(state);
  requirePlainObject(options, "opening kickoff coordinator step options");
  requireExactKeys(
    options,
    options.teamRates === undefined ? [] : ["teamRates"],
    "opening kickoff coordinator step options",
  );
  if (current.phase === "launch-receipt") {
    fail(
      "post-launch-contact",
      "The opening coordinator stops at the launch receipt; MCC_PASS contact and receiver control need their downstream owners.",
      { tick: current.tick },
    );
  }
  if (current.tick === 0xffffffff) {
    fail("tick-overflow", "Opening kickoff cannot advance beyond uint32 tick range.");
  }

  const tick = current.tick + 1;
  const phaseTick = current.phaseTick + 1;

  // FOOTBALL.CPP: process_ball precedes match_rules.
  const ballStep = stepBallMatchState(current.ball);
  if (ballStep.events.length !== 0) {
    fail(
      "held-ball",
      "The centre ball emitted an event before the accepted launch seam.",
      { events: ballStep.events },
    );
  }
  requireHeldCentreBall(ballStep.state, current.kickoff, tick);

  // RULES.CPP reads the previous process_teams/process_offs stores. Official
  // action 3 is an internal non-ready state absent from kickoffState's compact
  // profile, so only its ready predicate is projected into that reducer.
  const kickoff = stepCssoccerKickoffState(current.kickoff, {
    players: kickoffObservations(current.kickoffMotion),
    refereeAction: kickoffReadinessAction(current),
  });

  if (kickoff.phase === "action-pending") {
    const taker = current.kickoffMotion.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === kickoff.owner.takerNativePlayerNumber,
    );
    if (taker === undefined) {
      throw new Error("Opening kickoff motion lost its native centre taker.");
    }
    const takerAction = createCssoccerActionState({
      tick,
      playerId: taker.id,
      actionId: taker.action,
      facingX: taker.facing.x,
      facingY: taker.facing.y,
    });
    const launch = launchCssoccerCentrePass({
      tick,
      kickoff,
      ball: ballStep.state,
      possession: current.possession,
      takerAction,
      gameplayProfile: {
        schema: current.bindings.nativeGameplayProfileSchema,
        profileHash: current.bindings.nativeGameplayProfileHash,
      },
    });
    const completedKickoff = completeCssoccerKickoffLaunch(kickoff, launch.receipt);
    return assemble({
      tick,
      phaseTick,
      phase: "launch-receipt",
      kickoff: completedKickoff,
      kickoffMotion: current.kickoffMotion,
      official: current.official,
      ball: launch.ball,
      possession: launch.possession,
      launch,
      milestones: {
        ...clone(current.milestones),
        kickoffReadyTick: tick,
        launchReceiptTick: tick,
      },
      bindings: clone(current.bindings),
    });
  }

  // FOOTBALL.CPP: teams and officials advance after match_rules.
  const kickoffMotion = stepCssoccerKickoffPlayerMotion(
    current.kickoffMotion,
    options.teamRates === undefined ? {} : { teamRates: options.teamRates },
  );
  const official = current.official.status === "ready"
    ? current.official
    : stepCssoccerOpeningOfficialState(current.official);
  const milestones = clone(current.milestones);
  if (milestones.playersSettledTick === null && kickoffMotion.status === "settled") {
    milestones.playersSettledTick = tick;
  }
  if (milestones.refereeReadyTick === null && official.status === "ready") {
    milestones.refereeReadyTick = tick;
  }

  return assemble({
    tick,
    phaseTick,
    phase: "centre-positioning",
    kickoff,
    kickoffMotion,
    official,
    ball: ballStep.state,
    possession: current.possession,
    launch: null,
    milestones,
    bindings: clone(current.bindings),
  });
}

export function assertCssoccerOpeningKickoffCoordinator(state) {
  requirePlainObject(state, "opening kickoff coordinator state");
  requireExactKeys(state, STATE_KEYS, "opening kickoff coordinator state");
  if (
    state.schema !== CSSOCCER_OPENING_KICKOFF_COORDINATOR_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || !["centre-positioning", "launch-receipt"].includes(state.phase)
    || !Number.isSafeInteger(state.phaseTick)
    || state.phaseTick < 0
  ) {
    throw new Error(
      `Opening kickoff coordinator must use ${CSSOCCER_OPENING_KICKOFF_COORDINATOR_SCHEMA}.`,
    );
  }
  requireUint32(state.tick, "opening kickoff coordinator tick");
  if (state.tick < state.phaseTick) {
    throw new Error("Opening kickoff phase ticks cannot precede the absolute start tick.");
  }
  if (!sameValue(state.sourceOrder, CSSOCCER_OPENING_KICKOFF_SOURCE_ORDER)) {
    throw new Error("Opening kickoff source order changed.");
  }
  if (!sameValue(
    state.unsupportedAfterLaunch,
    CSSOCCER_OPENING_KICKOFF_COORDINATOR_SOURCE.unsupportedAfterLaunch,
  )) {
    throw new Error("Opening kickoff post-launch boundary changed.");
  }

  const kickoff = assertCssoccerKickoffState(state.kickoff);
  const kickoffMotion = assertCssoccerKickoffPlayerMotion(state.kickoffMotion);
  const official = assertCssoccerOfficialState(state.official);
  const ball = requireExactBall(state.ball);
  const possession = requireExactPossession(state.possession);
  requireBindings(state.bindings, { kickoff, kickoffMotion, official });
  requireMilestones(state.milestones, state);

  if (
    kickoff.matchHalf !== kickoffMotion.matchHalf
    || !sameValue(kickoff.teamBySlot, kickoffMotion.teamBySlot)
    || official.centreOwner !== kickoff.owner.nativeTeamSlot
    || ball.ball.tick !== state.tick
    || kickoff.phaseTick !== state.phaseTick
  ) {
    throw new Error("Opening kickoff reducers diverged in half, owner, tick, or native-team mapping.");
  }

  if (state.phase === "centre-positioning") {
    if (
      state.launch !== null
      || kickoff.phase !== "centre-positioning"
      || kickoffMotion.tick !== state.phaseTick
      || official.tick > state.phaseTick
      || state.milestones.kickoffReadyTick !== null
      || state.milestones.launchReceiptTick !== null
    ) {
      throw new Error("Opening kickoff positioning state crossed its launch seam.");
    }
    requireHeldCentreBall(ball, kickoff, state.tick);
    requireFreePossession(possession, kickoff.teamBySlot);
  } else {
    if (
      kickoff.phase !== "normal-play"
      || state.phaseTick < 1
      || kickoffMotion.tick !== state.phaseTick - 1
      || official.tick > state.phaseTick - 1
    ) {
      throw new Error("Opening kickoff launch receipt has an invalid source cursor.");
    }
    requireLaunch(state.launch, state);
  }
  return state;
}

function assemble(parts) {
  const state = deepFreeze({
    schema: CSSOCCER_OPENING_KICKOFF_COORDINATOR_SCHEMA,
    fixtureId: FIXTURE_ID,
    sourceOrder: clone(CSSOCCER_OPENING_KICKOFF_SOURCE_ORDER),
    unsupportedAfterLaunch: clone(
      CSSOCCER_OPENING_KICKOFF_COORDINATOR_SOURCE.unsupportedAfterLaunch,
    ),
    ...parts,
  });
  return assertCssoccerOpeningKickoffCoordinator(state);
}

function kickoffObservations(motion) {
  return motion.players.map((player) => ({
    id: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    active: player.active,
    action: player.action,
    directionMode: player.directionMode,
    // kickoffPlayerMotion's accepted stand/run subset has no animation offset
    // owner. Zero is the only supported observation until that seam is bound.
    offState: 0,
    position: clone(player.position),
    facing: clone(player.facing),
  }));
}

function kickoffReadinessAction(state) {
  const actual = projectCssoccerOpeningRefereeAction(state.official);
  return actual === state.kickoff.sourceProfile.officialActionIds.ready
    ? state.kickoff.sourceProfile.officialActionIds.ready
    : state.kickoff.sourceProfile.officialActionIds.positioning;
}

function coordinatorBindings({ kickoff, kickoffMotion, profile }) {
  return {
    nativeGameplayProfileSchema: profile.schema,
    nativeGameplayProfileHash: profile.profileHash,
    kickoffSourceProfileHash: kickoff.bindings.sourceProfileHash,
    nativeBuildSha256: profile.bindings.nativeBuildSha256,
    sourceRevision: profile.bindings.sourceRevision,
    teamAuthoritySha256: kickoff.bindings.teamAuthoritySha256,
    nativeFieldContractSha256: kickoff.bindings.nativeFieldContractSha256,
    kickoffMotionSourceRevision: kickoffMotion.bindings.sourceRevision,
  };
}

function requireReducerBindings({ kickoff, kickoffMotion, profile }) {
  if (
    kickoff.bindings.sourceProfileHash !== profile.profileHash
    || kickoffMotion.bindings.nativeGameplayProfileHash !== profile.profileHash
    || kickoffMotion.bindings.kickoffSourceProfileHash !== profile.profileHash
    || kickoffMotion.bindings.nativeBuildSha256 !== profile.bindings.nativeBuildSha256
    || kickoffMotion.bindings.sourceRevision !== profile.bindings.sourceRevision
    || kickoff.matchHalf !== kickoffMotion.matchHalf
    || !sameValue(kickoff.teamBySlot, kickoffMotion.teamBySlot)
  ) {
    throw new Error("Opening kickoff reducers do not share one native gameplay/profile mapping.");
  }
}

function requireBindings(value, { kickoff, kickoffMotion, official }) {
  requirePlainObject(value, "opening kickoff coordinator bindings");
  requireExactKeys(value, [
    "kickoffMotionSourceRevision",
    "kickoffSourceProfileHash",
    "nativeBuildSha256",
    "nativeFieldContractSha256",
    "nativeGameplayProfileHash",
    "nativeGameplayProfileSchema",
    "sourceRevision",
    "teamAuthoritySha256",
  ], "opening kickoff coordinator bindings");
  const expected = {
    nativeGameplayProfileSchema: "cssoccer-native-gameplay-profile@1",
    nativeGameplayProfileHash: kickoff.bindings.sourceProfileHash,
    kickoffSourceProfileHash: kickoff.bindings.sourceProfileHash,
    nativeBuildSha256: kickoffMotion.bindings.nativeBuildSha256,
    sourceRevision: kickoffMotion.bindings.sourceRevision,
    teamAuthoritySha256: kickoff.bindings.teamAuthoritySha256,
    nativeFieldContractSha256: kickoff.bindings.nativeFieldContractSha256,
    kickoffMotionSourceRevision: kickoffMotion.bindings.sourceRevision,
  };
  if (
    !sameValue(value, expected)
    || official.bindings.nativeGameplayProfileHash !== value.nativeGameplayProfileHash
    || official.bindings.nativeBuildSha256 !== value.nativeBuildSha256
    || official.bindings.sourceRevision !== value.sourceRevision
  ) {
    throw new Error("Opening kickoff coordinator bindings changed.");
  }
}

function requireMilestones(value, state) {
  requirePlainObject(value, "opening kickoff milestones");
  requireExactKeys(value, MILESTONE_KEYS, "opening kickoff milestones");
  const startTick = state.tick - state.phaseTick;
  for (const [key, tick] of Object.entries(value)) {
    if (tick !== null && (
      !Number.isSafeInteger(tick)
      || tick < startTick
      || tick > state.tick
    )) {
      throw new Error(`Opening kickoff milestone ${key} is outside this run.`);
    }
  }
  if ((value.playersSettledTick !== null) !== (state.kickoffMotion.status === "settled")) {
    throw new Error("Opening kickoff player-settled milestone diverged from motion state.");
  }
  if ((value.refereeReadyTick !== null) !== (state.official.status === "ready")) {
    throw new Error("Opening kickoff referee-ready milestone diverged from official state.");
  }
  const launched = state.phase === "launch-receipt";
  if (
    (value.kickoffReadyTick !== null) !== launched
    || (value.launchReceiptTick !== null) !== launched
    || (launched && (
      value.kickoffReadyTick !== state.tick
      || value.launchReceiptTick !== state.tick
    ))
  ) {
    throw new Error("Opening kickoff ready/launch milestones diverged from phase.");
  }
}

function requireLaunch(value, state) {
  requirePlainObject(value, "opening kickoff launch");
  if (
    value.schema !== CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA
    || value.tick !== state.tick
    || value.matchHalf !== state.kickoff.matchHalf
    || !sameValue(value.owner, state.kickoff.owner)
    || value.bindings?.gameplayProfileHash !== state.bindings.nativeGameplayProfileHash
    || value.bindings?.kickoffProfileHash !== state.bindings.kickoffSourceProfileHash
    || !sameValue(value.receipt, state.kickoff.lastLaunchReceipt)
    || !sameValue(value.ball, state.ball)
    || !sameValue(value.possession, state.possession)
  ) {
    throw new Error("Opening kickoff launch receipt diverged from accepted reducers.");
  }
  const action = assertCssoccerActionState(value.action);
  if (
    action.tick !== state.tick
    || action.playerId !== state.kickoff.owner.takerId
    || action.action.value !== 15
    || state.possession.owner !== state.kickoff.owner.takerNativePlayerNumber
    || !Array.isArray(value.nativeFields?.action)
    || !Array.isArray(value.nativeFields?.ball)
    || !Array.isArray(value.nativeFields?.possession)
  ) {
    throw new Error("Opening kickoff launch action, possession, or typed fields changed.");
  }
}

function requireExactBall(value) {
  const canonical = createBallMatchState(value);
  if (!sameValue(canonical, value)) {
    throw new Error("Opening kickoff ball changed while canonicalizing typed state.");
  }
  return canonical;
}

function requireHeldCentreBall(ball, kickoff, tick) {
  const source = ball.ball;
  if (
    source.tick !== tick
    || kickoff.ball.status === "held-at-centre" && !sameValue(source.position, kickoff.ball.position)
    || !sameValue(source.position, source.previousPosition)
    || source.position.x !== 640
    || source.position.y !== 400
    || source.position.z !== 2
    || source.displacement.x !== 0
    || source.displacement.y !== 0
    || source.displacement.z !== 0
    || source.speed !== 0
    || source.inAir !== 0
    || source.still !== 1
  ) {
    throw new Error("Opening kickoff requires the exact static held centre ball.");
  }
}

function requireExactPossession(value) {
  const canonical = createPossessionState(value);
  if (!sameValue(canonical, value)) {
    throw new Error("Opening kickoff possession changed while canonicalizing identities.");
  }
  return canonical;
}

function requireFreePossession(possession, teamBySlot) {
  if (
    possession.owner !== 0
    || possession.lastTouch !== 0
    || possession.inHands !== 0
    || possession.players.some(({ possession: count }) => count !== 0)
  ) {
    throw new Error("Opening kickoff requires one free, untouched centre ball.");
  }
  for (const player of possession.players) {
    const country = player.nativePlayer <= 11 ? teamBySlot.A : teamBySlot.B;
    const roster = player.nativePlayer <= 11
      ? player.nativePlayer
      : player.nativePlayer - 11;
    const expected = `${country}-player-${String(roster).padStart(2, "0")}`;
    if (player.stableId !== expected) {
      throw new Error(`Opening kickoff native player ${player.nativePlayer} must map to ${expected}.`);
    }
  }
}

function fail(boundary, message, detail = {}) {
  throw new CssoccerUnsupportedOpeningKickoffCoordinatorError(boundary, message, detail);
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

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${label} must contain exactly the supported fields.`);
  }
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be an exact uint32.`);
  }
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
    );
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

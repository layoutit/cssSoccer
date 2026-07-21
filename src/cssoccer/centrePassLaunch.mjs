import {
  CSSOCCER_NATIVE_ACTIONS,
  assertCssoccerActionState,
  createCssoccerActionState,
} from "./actionState.mjs";
import { createBallMatchState } from "./ballMatchState.mjs";
import { projectBallNativeFields } from "./ballState.mjs";
import {
  CSSOCCER_KICKOFF_LAUNCH_RECEIPT_SCHEMA,
  assertCssoccerKickoffState,
} from "./kickoffState.mjs";
import { sourceFacingDirection } from "./motionState.mjs";
import {
  collectPossession,
  createPossessionState,
  projectPossessionNativeFields,
} from "./possessionState.mjs";

const f32 = Math.fround;

export const CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA = "cssoccer-centre-pass-launch@1";

export const CSSOCCER_CENTRE_PASS_CONSTANTS = deepFreeze({
  nativePlayerNumber: 7,
  targetPlayerNumber: 10,
  passType: 5,
  standAction: CSSOCCER_NATIVE_ACTIONS.STAND,
  kickAction: CSSOCCER_NATIVE_ACTIONS.KICK,
  kickAnimation: 39,
  passContact: f32(48 / 99),
  centreSpot: { x: f32(640), y: f32(400), z: f32(2) },
});

export const CSSOCCER_CENTRE_PASS_SOURCE = deepFreeze({
  files: [
    {
      file: "RULES.CPP",
      sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
      producers: ["await_set_kick", "decide_set_kick", "ready_set_kick"],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["make_pass pass_type 5"],
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: ["init_kick_act", "KICK_ACT"],
    },
    {
      file: "BALLINT.CPP",
      sha256: "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
      producers: ["collect_ball", "hold_ball while set_piece_on"],
    },
  ],
  sourceOrder: [
    "collect native player 7 while the centre set piece remains active",
    "select pass type 5 toward native player 10",
    "initialize MC_PASSL and KICK_ACT on native player 7",
    "keep the set-piece ball held until the later animation contact owner",
    "return the matching parent launch receipt",
  ],
  downstreamOwners: [
    "kick animation frame and motion-capture offsets",
    "MCC_PASS contact and pass_ball release",
    "receiver run/action materialization",
  ],
});

export class CssoccerUnsupportedCentrePassError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedCentrePassError";
    this.code = "CSSOCCER_UNSUPPORTED_CENTRE_PASS";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/**
 * Materialize RULES.CPP's centre-pass request at its exact pre-contact seam.
 *
 * Native process order reaches this function after the current free-ball step
 * and while SETP_CENTRE is still active. collect_ball therefore transfers
 * possession without moving the set-piece ball. make_pass then initializes
 * KICK_ACT; the later animation/contact owner moves and releases the ball.
 */
export function launchCssoccerCentrePass({
  tick,
  kickoff,
  ball,
  possession,
  takerAction,
  gameplayProfile,
} = {}) {
  requireUint32(tick, "centre-pass tick");
  const centre = requirePendingKickoff(kickoff);
  const profile = requireGameplayProfile(gameplayProfile, centre);
  const currentBall = requireHeldCentreBall(ball, tick, centre);
  const currentPossession = requireFreeCentrePossession(possession, centre);
  const currentAction = requireTakerAction(takerAction, tick, centre);

  // BALLINT.CPP collect_ball runs before RULES.CPP decide_set_kick.
  const nextPossession = collectPossession(
    currentPossession,
    CSSOCCER_CENTRE_PASS_CONSTANTS.nativePlayerNumber,
  );

  // INTELL.CPP pass_type 5 -> MC_PASSL; ACTIONS.CPP init_kick_act -> KICK_ACT.
  const nextAction = createCssoccerActionState({
    tick,
    playerId: centre.owner.takerId,
    actionId: CSSOCCER_CENTRE_PASS_CONSTANTS.kickAction,
    facingX: currentAction.facing.x.value,
    facingY: currentAction.facing.y.value,
  });

  const receipt = deepFreeze({
    schema: CSSOCCER_KICKOFF_LAUNCH_RECEIPT_SCHEMA,
    type: "launch-applied",
    actionType: centre.pendingAction.type,
    nativePlayerNumber: centre.pendingAction.nativePlayerNumber,
    targetPlayerNumber: centre.pendingAction.targetPlayerNumber,
    profileHash: profile.profileHash,
  });

  return deepFreeze({
    schema: CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA,
    tick,
    matchHalf: centre.matchHalf,
    owner: clone(centre.owner),
    request: clone(centre.pendingAction),
    bindings: {
      kickoffProfileHash: centre.bindings.sourceProfileHash,
      gameplayProfileHash: profile.profileHash,
    },
    action: nextAction,
    ball: currentBall,
    possession: nextPossession,
    nativeFields: {
      action: [
        nextAction.action,
        nextAction.facing.x,
        nextAction.facing.y,
      ],
      ball: projectBallNativeFields(currentBall.ball),
      possession: projectPossessionNativeFields(nextPossession),
    },
    receipt,
  });
}

function requirePendingKickoff(value) {
  try {
    assertCssoccerKickoffState(value);
  } catch (error) {
    throw new CssoccerUnsupportedCentrePassError(
      "kickoff-request",
      `Centre-pass launch requires an accepted kickoff state: ${error.message}`,
    );
  }
  const request = value.pendingAction;
  if (
    value.phase !== "action-pending"
    || request === null
    || request.type !== "pass"
    || request.nativePlayerNumber !== CSSOCCER_CENTRE_PASS_CONSTANTS.nativePlayerNumber
    || request.targetPlayerNumber !== CSSOCCER_CENTRE_PASS_CONSTANTS.targetPlayerNumber
    || request.passType !== CSSOCCER_CENTRE_PASS_CONSTANTS.passType
    || request.launch !== "parent-owned"
    || value.owner.nativeTeamSlot !== "A"
    || value.owner.takerNativePlayerNumber !== CSSOCCER_CENTRE_PASS_CONSTANTS.nativePlayerNumber
    || value.owner.receiverNativePlayerNumber !== CSSOCCER_CENTRE_PASS_CONSTANTS.targetPlayerNumber
    || value.owner.country !== value.teamBySlot.A
  ) {
    throw new CssoccerUnsupportedCentrePassError(
      "kickoff-request",
      "Only the exact native 7 to 10 source centre-pass request may launch.",
      { request },
    );
  }
  return value;
}

function requireGameplayProfile(value, kickoff) {
  requirePlainObject(value, "centre-pass gameplay profile");
  if (
    typeof value.schema !== "string"
    || value.schema.length === 0
    || !isSha256(value.profileHash)
    || value.profileHash !== kickoff.bindings.sourceProfileHash
  ) {
    throw new CssoccerUnsupportedCentrePassError(
      "gameplay-profile",
      "Centre-pass gameplay profile must match the kickoff source-profile hash.",
      {
        expectedProfileHash: kickoff.bindings.sourceProfileHash,
        actualProfileHash: value?.profileHash ?? null,
      },
    );
  }
  return value;
}

function requireHeldCentreBall(value, tick, kickoff) {
  let current;
  try {
    current = createBallMatchState(value);
  } catch (error) {
    throw new CssoccerUnsupportedCentrePassError(
      "ball-state",
      `Centre-pass launch requires exact ball state: ${error.message}`,
    );
  }
  if (!sameValue(current, value)) {
    throw new CssoccerUnsupportedCentrePassError(
      "ball-state",
      "Centre-pass ball input changed f32 values while being canonicalized.",
    );
  }
  const expected = createBallMatchState({
    ball: {
      tick,
      position: kickoff.ball.position,
      previousPosition: kickoff.ball.position,
      rng: current.ball.rng,
    },
  });
  if (
    kickoff.ball.status !== "held-at-centre"
    || kickoff.ball.possession !== 0
    || current.ball.tick !== tick
    || !sameValue(current, expected)
  ) {
    throw new CssoccerUnsupportedCentrePassError(
      "ball-state",
      "Centre-pass launch requires the exact static centre ball at the current tick.",
      { tick, ballTick: current.ball.tick },
    );
  }
  return current;
}

function requireFreeCentrePossession(value, kickoff) {
  let current;
  try {
    current = createPossessionState(value);
  } catch (error) {
    throw new CssoccerUnsupportedCentrePassError(
      "possession-state",
      `Centre-pass launch requires exact possession state: ${error.message}`,
    );
  }
  if (!sameValue(current, value)) {
    throw new CssoccerUnsupportedCentrePassError(
      "possession-state",
      "Centre-pass possession input changed while being canonicalized.",
    );
  }
  if (
    current.owner !== 0
    || current.lastTouch !== 0
    || current.inHands !== 0
    || current.players.some(({ possession }) => possession !== 0)
  ) {
    throw new CssoccerUnsupportedCentrePassError(
      "possession-state",
      "The centre pass can collect only the free reset ball once.",
    );
  }
  for (const player of current.players) {
    const expected = stableIdForNative(player.nativePlayer, kickoff.teamBySlot);
    if (player.stableId !== expected) {
      throw new CssoccerUnsupportedCentrePassError(
        "owner-identity",
        `Native player ${player.nativePlayer} must map to ${expected} for this half.`,
      );
    }
  }
  return current;
}

function requireTakerAction(value, tick, kickoff) {
  try {
    assertCssoccerActionState(value);
  } catch (error) {
    throw new CssoccerUnsupportedCentrePassError(
      "action-state",
      `Centre-pass launch requires exact taker action state: ${error.message}`,
    );
  }
  if (
    value.tick !== tick
    || value.playerId !== kickoff.owner.takerId
    || value.action.value !== CSSOCCER_CENTRE_PASS_CONSTANTS.standAction
    || !Object.is(value.facing.x.value, f32(0))
    || !Object.is(value.facing.y.value, f32(1))
    || sourceFacingDirection({
      x: value.facing.x.value,
      y: value.facing.y.value,
    }) !== 2
  ) {
    throw new CssoccerUnsupportedCentrePassError(
      "action-state",
      "Centre-pass taker must be native 7 standing at the accepted +Y centre facing.",
      { tick, playerId: value.playerId, action: value.action.value },
    );
  }
  return value;
}

function stableIdForNative(nativePlayer, teamBySlot) {
  const country = nativePlayer <= 11 ? teamBySlot.A : teamBySlot.B;
  const rosterNumber = nativePlayer <= 11 ? nativePlayer : nativePlayer - 11;
  return `${country}-player-${String(rosterNumber).padStart(2, "0")}`;
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be an exact uint32.`);
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

function isSha256(value) {
  return /^[a-f0-9]{64}$/u.test(value ?? "");
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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

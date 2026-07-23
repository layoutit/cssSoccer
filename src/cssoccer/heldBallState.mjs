import { CSSOCCER_NATIVE_ACTIONS } from "./actionState.mjs";
import { createBallMatchState } from "./ballMatchState.mjs";
import {
  CSSOCCER_BALL_CONSTANTS,
  projectBallNativeFields,
} from "./ballState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  assertCssoccerNativeFixturePlayerProfile,
} from "./nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  assertCssoccerNativeGameplayProfile,
} from "./nativeGameplayProfile.mjs";
import {
  createPossessionState,
  holdPossession,
  projectPossessionNativeFields,
} from "./possessionState.mjs";

const F32 = Math.fround;
const FIXTURE_ID = "spain-argentina-full-match";
const KEEPER_NATIVE_PLAYER_NUMBERS = new Set([1, 12]);

export const CSSOCCER_HELD_BALL_STATE_SCHEMA = "cssoccer-held-ball-state@1";
export const CSSOCCER_HELD_BALL_OWNER_FRAME_SCHEMA =
  "cssoccer-held-ball-owner-frame@1";
export const CSSOCCER_HELD_BALL_PROFILE_HASH =
  "38fec419a1ff0662f9e13cc7bfa195d330dc06f659ccb60a36e5145f1af240f0";

const PROFILE_BODY = deepFreeze({
  schema: "cssoccer-held-ball-profile@1",
  bindings: {
    sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
    ballInteractionSha256:
      "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
    nativeBuildSha256:
      "cd06f847e2376951791a68a57fed3c38a13496e801c3dc66e98aa1d9abf9c544",
    nativeGameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  },
  constants: {
    atFeetDistance: F32(10),
    runFrameAmplitude: F32(4),
    ballDiameter: CSSOCCER_BALL_CONSTANTS.ballDiameter,
  },
  branches: {
    owner: "current normal-outfield feet-possession owner",
    actionRule: "RUN_ACT animated offset; every other i16 action uses AT_FEET_DIST",
    setPieceActive: false,
    ballInHands: false,
    motionCaptureTween: false,
    deadBallCount: 0,
  },
});

export const CSSOCCER_HELD_BALL_PROFILE = deepFreeze({
  ...clone(PROFILE_BODY),
  profileHash: CSSOCCER_HELD_BALL_PROFILE_HASH,
});

export const CSSOCCER_HELD_BALL_SOURCE = deepFreeze({
  fixtureId: FIXTURE_ID,
  qualifiedBranch: "normal-outfield feet possession without a set piece or mocap tween",
  files: [
    {
      file: "BALLINT.CPP",
      sha256:
        "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
      producers: ["hold_ball"],
    },
    {
      file: "ANDYDEFS.H",
      sha256:
        "13d13dca2910a7685be7603e25bc9fa936253f5aa72f73eef3f54e851fbbce34",
      producers: ["match_player tm_poss/go_txdis/go_tydis layout"],
    },
  ],
  sourceOrder: [
    "BALL.CPP process_ball recomputes possessed-ball speed/still only after the owner contact becomes negative",
    "ACTIONS.CPP process_anims publishes the owner's current tm_frm",
    "BALLINT.CPP hold_ball increments tm_poss and copies prior go_txdis/go_tydis",
    "RUN_ACT uses fractional tm_frm; every other action uses the ordinary at-feet offset",
  ],
  supported: [
    "any current normal-outfield owner already holding the ball at the feet",
    "RUN_ACT animated feet offset and ordinary non-RUN at-feet offset",
    "no set piece, no goalkeeper hands, no post-control mocap tween",
    "exact possessed-ball prepass followed by normal at-feet hold",
    "current goalkeeper SAVE_ACT contact hold and KPHOLD_ACT facing hold",
  ],
  unsupported: [
    "set-piece, throw, keeper get-up suppression, and dead-ball branches",
    "post-control tm_ftime tween and get_mcball_coords",
    "goalkeeper ownership at the feet",
  ],
});

const BINDINGS = deepFreeze({
  heldBallProfileHash: CSSOCCER_HELD_BALL_PROFILE_HASH,
  nativeGameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  nativeFixturePlayerProfileHash: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  ballInteractionSourceSha256:
    CSSOCCER_HELD_BALL_PROFILE.bindings.ballInteractionSha256,
});

const STATE_KEYS = Object.freeze([
  "ball",
  "bindings",
  "fixtureId",
  "lastOwnerFrame",
  "owner",
  "phase",
  "possession",
  "profile",
  "qualification",
  "schema",
  "tick",
]);

export class CssoccerUnsupportedHeldBallError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedHeldBallError";
    this.code = "CSSOCCER_UNSUPPORTED_HELD_BALL";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/** Bind an accepted ordinary physical ball to its current outfield feet owner. */
export function createCssoccerHeldBallState(input = {}) {
  requirePlainObject(input, "held-ball baseline input");
  requireExactKeys(input, [
    "ball",
    "fixturePlayerProfile",
    "gameplayProfile",
    "possession",
  ], "held-ball baseline input");
  const gameplayProfile = assertCssoccerNativeGameplayProfile(input.gameplayProfile);
  const fixtureProfile = assertCssoccerNativeFixturePlayerProfile(
    input.fixturePlayerProfile,
  );
  const ball = createBallMatchState(input.ball);
  const possession = createPossessionState(input.possession);
  if (
    gameplayProfile.profileHash !== BINDINGS.nativeGameplayProfileHash
    || fixtureProfile.profileHash !== BINDINGS.nativeFixturePlayerProfileHash
  ) {
    fail("profile-binding", "Held-ball gameplay or fixture profile binding changed.");
  }
  if (
    ball.limbo.active !== 0
    || ball.outcome !== null
    || ball.ball.inGoal !== 0
    || ball.ball.outOfPlay !== 0
  ) {
    fail(
      "baseline-ball",
      "Held-ball transition requires an accepted ordinary in-play ball.",
      { tick: ball.ball.tick },
    );
  }
  const owner = requirePossessionOwner(possession, fixtureProfile);
  return assemble({
    tick: ball.ball.tick,
    phase: "held-ball-baseline",
    ball,
    possession,
    owner,
    lastOwnerFrame: null,
  });
}

/** Create the strict typed ordinary owner frame consumed by hold_ball. */
export function createCssoccerHeldBallOwnerFrame(input = {}) {
  requirePlainObject(input, "held-ball owner-frame input");
  requireExactKeys(input, [
    "actionId",
    "animationFrame",
    "ballInHands",
    "deadBallCount",
    "facing",
    "fixturePlayerProfile",
    "gameplayProfile",
    "goDisplacement",
    "motionCaptureTween",
    "nativePlayerNumber",
    "position",
    "setPieceActive",
    "stableId",
    "tick",
  ], "held-ball owner-frame input");
  const gameplayProfile = assertCssoccerNativeGameplayProfile(input.gameplayProfile);
  const fixtureProfile = assertCssoccerNativeFixturePlayerProfile(
    input.fixturePlayerProfile,
  );
  requireUint32(input.tick, "held-ball owner-frame tick");
  requirePlayerId(input.stableId, "held-ball owner stableId");
  requireInt16(input.actionId, "held-ball owner action id");
  if (
    !isNormalOutfieldNativePlayer(input.nativePlayerNumber)
    || input.setPieceActive !== false
    || input.ballInHands !== false
    || input.motionCaptureTween !== false
    || input.deadBallCount !== 0
    || gameplayProfile.profileHash !== BINDINGS.nativeGameplayProfileHash
    || fixtureProfile.profileHash !== BINDINGS.nativeFixturePlayerProfileHash
  ) {
    fail(
      "owner-branch",
      "Held-ball owner frame must select the normal outfield feet-possession branch.",
      {
        tick: input.tick,
        stableId: input.stableId,
        nativePlayerNumber: input.nativePlayerNumber,
        actionId: input.actionId,
      },
    );
  }
  if (!fixtureOwnerMatchesNormalTimeSlot(
    fixtureProfile,
    input.stableId,
    input.nativePlayerNumber,
  )) {
    fail("owner-identity", "Held-ball owner stable identity or native slot changed.");
  }
  const position = requireVector(input.position, "held-ball owner position");
  const facing = requirePlanarVector(input.facing, "held-ball owner facing");
  const goDisplacement = requirePlanarVector(
    input.goDisplacement,
    "held-ball owner prior go displacement",
  );
  const animationFrame = requireF32(
    input.animationFrame,
    "held-ball owner animation frame",
  );
  const facingLength = Math.sqrt((facing.x * facing.x) + (facing.y * facing.y));
  if (
    !Object.is(position.z, F32(0))
    || Math.abs(facingLength - 1) > 0.0001
    || animationFrame < 0
  ) {
    fail("owner-motion", "Held-ball owner position, facing, or frame is outside the ordinary planar branch.");
  }
  return requireOwnerFrame(deepFreeze({
    schema: CSSOCCER_HELD_BALL_OWNER_FRAME_SCHEMA,
    tick: input.tick,
    stableId: input.stableId,
    nativePlayerNumber: input.nativePlayerNumber,
    bindings: clone(BINDINGS),
    branches: clone(CSSOCCER_HELD_BALL_PROFILE.branches),
    action: typedScalar(
      `players.${input.stableId}.action`,
      "i16",
      input.actionId,
    ),
    animationFrame: typedScalar(
      `players.${input.stableId}.animation_frame`,
      "f32",
      animationFrame,
    ),
    position: typedVector(`players.${input.stableId}`, position),
    facing: typedPlanarVector(`players.${input.stableId}`, facing, "displacement"),
    goDisplacement: typedPlanarVector(
      `players.${input.stableId}.go`,
      goDisplacement,
      "displacement",
    ),
  }));
}

/** Advance process_ball then the normal outfield BALLINT.CPP hold_ball branch. */
export function stepCssoccerHeldBallState(state, input = {}) {
  const current = assertCssoccerHeldBallState(state);
  requirePlainObject(input, "held-ball step input");
  requireExactKeys(input, ["ownerFrame"], "held-ball step input");
  if (current.phase !== "held-ball-baseline") {
    fail(
      "qualified-window",
      "A held-ball baseline may be consumed exactly once by its contiguous owner frame.",
      { currentTick: current.tick },
    );
  }
  const ownerFrame = requireOwnerFrame(input.ownerFrame);
  if (
    ownerFrame.tick !== current.tick + 1
    || ownerFrame.stableId !== current.owner.stableId
    || ownerFrame.nativePlayerNumber !== current.owner.nativePlayerNumber
  ) {
    fail(
      "owner-lineage",
      "Held-ball owner frame is not contiguous with its possession owner.",
      {
        baseline: {
          tick: current.tick,
          stableId: current.owner.stableId,
          nativePlayerNumber: current.owner.nativePlayerNumber,
        },
        frame: {
          tick: ownerFrame.tick,
          stableId: ownerFrame.stableId,
          nativePlayerNumber: ownerFrame.nativePlayerNumber,
        },
      },
    );
  }
  const physical = ownerFrame.action.value === CSSOCCER_NATIVE_ACTIONS.CONTROL
    ? {
        state: createBallMatchState({
          ...clone(current.ball),
          ball: {
            ...clone(current.ball.ball),
            tick: ownerFrame.tick,
          },
        }),
        events: [],
      }
    : { state: stepCssoccerPossessedBallState(current.ball), events: [] };
  if (
    physical.events.length !== 0
    || physical.state.ball.tick !== ownerFrame.tick
    || physical.state.limbo.active !== 0
    || physical.state.outcome !== null
  ) {
    fail(
      "physical-ball",
      "Normal hold_ball cannot consume a physical ball event, limbo, or outcome.",
      { events: physical.events },
    );
  }
  const possession = holdPossession(current.possession);
  const fraction = ownerFrame.animationFrame.value
    - Math.trunc(ownerFrame.animationFrame.value);
  const distance = ownerFrame.action.value === CSSOCCER_NATIVE_ACTIONS.RUN
    ? CSSOCCER_HELD_BALL_PROFILE.constants.atFeetDistance
      + (CSSOCCER_HELD_BALL_PROFILE.constants.runFrameAmplitude * (fraction - 0.5))
    : CSSOCCER_HELD_BALL_PROFILE.constants.atFeetDistance;
  const ball = createBallMatchState({
    ...clone(physical.state),
    ball: {
      ...clone(physical.state.ball),
      position: {
        x: F32(
          ownerFrame.position.x.value
            + (ownerFrame.facing.x.value * distance),
        ),
        y: F32(
          ownerFrame.position.y.value
            + (ownerFrame.facing.y.value * distance),
        ),
        z: F32(CSSOCCER_HELD_BALL_PROFILE.constants.ballDiameter / 2),
      },
      displacement: {
        x: ownerFrame.goDisplacement.x.value,
        y: ownerFrame.goDisplacement.y.value,
        z: F32(0),
      },
      inAir: 0,
    },
  });
  return assemble({
    tick: ownerFrame.tick,
    phase: "normal-held-ball",
    ball,
    possession,
    owner: clone(current.owner),
    lastOwnerFrame: ownerFrame,
  });
}

/** BALL.CPP possessed-ball prepass: speed/still update without trajectory. */
export function stepCssoccerPossessedBallState(input) {
  const current = createBallMatchState(input);
  if (current.limbo.active !== 0 || current.outcome !== null) {
    fail("possessed-ball-prepass", "Possessed-ball prepass requires no limbo or outcome.");
  }
  return stepPossessedBallPhysicalState(current);
}

/**
 * BALL.CPP's possessed process_ball branch during the post-goal countdown.
 * Once just_scored reaches zero, BALLINT.CPP may let an outfielder collect
 * the ball in the net before respot_ball runs. ball_trajectory keeps the
 * owned ball fixed, ball_collision publishes prev_ball*, and the ordinary
 * ball_out_of_play countdown continues.
 */
export function stepCssoccerPossessedGoalCountdownState(input) {
  const current = createBallMatchState(input);
  if (
    current.limbo.active !== 0
    || current.outcome?.kind !== "goal"
    || current.ball.inGoal !== 1
    || current.ball.outOfPlay < 1
  ) {
    fail(
      "possessed-goal-countdown",
      "Possessed post-goal ball requires one active qualified goal countdown.",
    );
  }
  const physical = stepPossessedBallPhysicalState(current);
  if (physical.ball.outOfPlay === 1) {
    return deepFreeze({
      state: physical,
      events: [{ type: "ball-post-goal-respot-required", outOfPlay: 0 }],
    });
  }
  const state = createBallMatchState({
    ...clone(physical),
    ball: {
      ...clone(physical.ball),
      outOfPlay: physical.ball.outOfPlay - 1,
    },
  });
  return deepFreeze({
    state,
    events: [{
      type: "ball-post-goal-countdown",
      outOfPlay: state.ball.outOfPlay,
    }],
  });
}

function stepPossessedBallPhysicalState(current) {
  const displacement = current.ball.displacement;
  const total = F32(
    Math.abs(displacement.x)
      + Math.abs(displacement.y)
      + Math.abs(displacement.z),
  );
  return createBallMatchState({
    ...clone(current),
    ball: {
      ...clone(current.ball),
      tick: current.ball.tick + 1,
      // BALL.CPP ball_collision stores the owned ball position before the
      // later BALLINT.CPP hold_ball visit moves it to the player's feet.
      previousPosition: clone(current.ball.position),
      speed: Math.trunc(Math.sqrt(total)),
      still: displacement.x !== 0 || displacement.y !== 0 ? 0 : 1,
    },
  });
}

/**
 * BALLINT.CPP hold_ball for a current goalkeeper catch. This is deliberately
 * separate from the qualified outfield held-ball state: it accepts only
 * native keeper hands and derives the next ball from the current owner frame.
 */
export function stepCssoccerKeeperHeldBall(input = {}) {
  requirePlainObject(input, "keeper held-ball input");
  requireExactKeys(
    input,
    ["ball", "owner", "possession", "tick"],
    "keeper held-ball input",
  );
  const ball = createBallMatchState(input.ball);
  const possession = createPossessionState(input.possession);
  requireUint32(input.tick, "keeper held-ball tick");
  requirePlainObject(input.owner, "keeper held-ball owner");
  requireExactKeys(
    input.owner,
    [
      "action",
      "facing",
      "goDisplacement",
      "nativePlayerNumber",
      "position",
      "saveOffset",
    ],
    "keeper held-ball owner",
  );
  const nativePlayerNumber = input.owner.nativePlayerNumber;
  if (
    !KEEPER_NATIVE_PLAYER_NUMBERS.has(nativePlayerNumber)
    || possession.owner !== nativePlayerNumber
    || possession.inHands !== 1
    || ball.ball.tick + 1 !== input.tick
    || ball.limbo.active !== 0
    || ball.outcome !== null
  ) {
    fail(
      "keeper-hands-owner",
      "Keeper hold requires one contiguous current native keeper-hands owner.",
    );
  }
  const action = input.owner.action;
  requireInt16(action, "keeper held-ball action");
  const position = requireVector(input.owner.position, "keeper held-ball owner position");
  const facing = requirePlanarVector(input.owner.facing, "keeper held-ball owner facing");
  const goDisplacement = requirePlanarVector(
    input.owner.goDisplacement,
    "keeper held-ball owner go displacement",
  );
  const saveOffset = requireVector(
    input.owner.saveOffset,
    "keeper held-ball save offset",
  );
  const physical = stepCssoccerPossessedBallState(ball);
  const holdingSave = action === 10;
  const handsDistance = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value;
  const nextPosition = holdingSave
    ? {
        x: F32(position.x + saveOffset.x),
        y: F32(position.y + saveOffset.y),
        z: F32(position.z + saveOffset.z),
      }
    : {
        x: F32(position.x + facing.x * handsDistance),
        y: F32(position.y + facing.y * handsDistance),
        z: F32(
          position.z
            + CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.contact.playerHeight.value / 2,
        ),
      };
  const heldBall = createBallMatchState({
    ...clone(physical),
    ball: {
      ...clone(physical.ball),
      position: nextPosition,
      displacement: {
        x: goDisplacement.x,
        y: goDisplacement.y,
        z: F32(0),
      },
      inAir: 0,
      still: goDisplacement.x === 0 && goDisplacement.y === 0 ? 1 : 0,
    },
  });
  return deepFreeze({
    ball: heldBall,
    possession: holdPossession(possession),
    owner: {
      nativePlayerNumber,
      action,
      branch: holdingSave ? "save-contact" : "keeper-hold",
    },
  });
}

/** Project only physical-ball and possession fields owned by this transition. */
export function projectCssoccerHeldBallNativeFields(state) {
  const current = assertCssoccerHeldBallState(state);
  if (current.phase !== "normal-held-ball") {
    fail("projection-baseline", "Held-ball native fields require the completed transition.");
  }
  const ballFields = projectBallNativeFields(current.ball.ball)
    .filter(({ fieldId }) => !fieldId.startsWith("rng."));
  const possessionFields = projectPossessionNativeFields(current.possession)
    .filter(({ fieldId }) => (
      fieldId.startsWith("ball.")
      || fieldId === `players.${current.owner.stableId}.possession`
    ))
    .map(({ fieldId, valueType, value }) => typedSample(
      current.tick,
      fieldId,
      valueType,
      value,
    ));
  return deepFreeze([...ballFields, ...possessionFields]
    .sort((left, right) => left.fieldId.localeCompare(right.fieldId)));
}

export function assertCssoccerHeldBallState(state) {
  requirePlainObject(state, "held-ball state");
  requireExactKeys(state, STATE_KEYS, "held-ball state");
  requireUint32(state.tick, "held-ball state tick");
  if (
    state.schema !== CSSOCCER_HELD_BALL_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || !["held-ball-baseline", "normal-held-ball"].includes(state.phase)
    || !sameValue(state.profile, CSSOCCER_HELD_BALL_PROFILE)
    || !sameValue(state.bindings, BINDINGS)
    || !sameValue(state.qualification, CSSOCCER_HELD_BALL_SOURCE)
  ) {
    throw new Error(`Held-ball state must use ${CSSOCCER_HELD_BALL_STATE_SCHEMA}.`);
  }
  const ball = createBallMatchState(state.ball);
  const possession = createPossessionState(state.possession);
  if (
    ball.ball.tick !== state.tick
    || ball.limbo.active !== 0
    || ball.outcome !== null
    || !isNormalOutfieldNativePlayer(possession.owner)
    || possession.inHands !== 0
    || !sameValue(ball, state.ball)
    || !sameValue(possession, state.possession)
  ) {
    throw new Error("Held-ball nested ball/possession state changed type, bits, or ownership.");
  }
  requirePlainObject(state.owner, "held-ball owner");
  requireExactKeys(
    state.owner,
    ["nativePlayerNumber", "stableId"],
    "held-ball owner",
  );
  requirePlayerId(state.owner.stableId, "held-ball owner stableId");
  const possessionOwner = possession.players.find(
    ({ nativePlayer }) => nativePlayer === possession.owner,
  );
  if (
    state.owner.nativePlayerNumber !== possession.owner
    || possessionOwner?.stableId !== state.owner.stableId
    || possessionOwner.possession <= 0
  ) {
    throw new Error("Held-ball owner identity diverged from possession.");
  }
  if (state.phase === "held-ball-baseline") {
    if (state.lastOwnerFrame !== null) {
      throw new Error("Held-ball baseline cannot contain a processed owner frame.");
    }
  } else {
    const frame = requireOwnerFrame(state.lastOwnerFrame);
    if (
      frame.tick !== state.tick
      || frame.stableId !== state.owner.stableId
      || frame.nativePlayerNumber !== state.owner.nativePlayerNumber
    ) {
      throw new Error("Held-ball processed owner frame changed lineage.");
    }
  }
  return state;
}

function assemble(parts) {
  return assertCssoccerHeldBallState(deepFreeze({
    schema: CSSOCCER_HELD_BALL_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    profile: clone(CSSOCCER_HELD_BALL_PROFILE),
    bindings: clone(BINDINGS),
    qualification: clone(CSSOCCER_HELD_BALL_SOURCE),
    ...parts,
  }));
}

function requirePossessionOwner(possession, fixtureProfile) {
  if (!isNormalOutfieldNativePlayer(possession.owner) || possession.inHands !== 0) {
    fail(
      "possession-owner",
      "Held-ball baseline requires normal feet possession by one outfield player.",
    );
  }
  const nativePlayerNumber = possession.owner;
  const owner = possession.players.find(
    ({ nativePlayer }) => nativePlayer === nativePlayerNumber,
  );
  if (
    owner === undefined
    || !fixtureOwnerMatchesNormalTimeSlot(
      fixtureProfile,
      owner.stableId,
      nativePlayerNumber,
    )
    || owner.possession <= 0
  ) {
    fail("possession-owner", "Held-ball possession owner identity or counter changed.");
  }
  return deepFreeze({
    stableId: owner.stableId,
    nativePlayerNumber,
  });
}

/** RULES.CPP swap_teams performs exactly one 11-player block exchange. */
function fixtureOwnerMatchesNormalTimeSlot(
  fixtureProfile,
  stableId,
  nativePlayerNumber,
) {
  const fixtureOwner = fixtureProfile.players.find(({ id }) => id === stableId);
  if (fixtureOwner === undefined) return false;
  const kickoff = fixtureOwner.kickoffNativePlayerNumber;
  const postSwap = kickoff <= 11 ? kickoff + 11 : kickoff - 11;
  return nativePlayerNumber === kickoff || nativePlayerNumber === postSwap;
}

function requireOwnerFrame(value) {
  requirePlainObject(value, "held-ball owner frame");
  requireExactKeys(value, [
    "action",
    "animationFrame",
    "bindings",
    "branches",
    "facing",
    "goDisplacement",
    "nativePlayerNumber",
    "position",
    "schema",
    "stableId",
    "tick",
  ], "held-ball owner frame");
  requireUint32(value.tick, "held-ball owner frame tick");
  if (
    value.schema !== CSSOCCER_HELD_BALL_OWNER_FRAME_SCHEMA
    || !isNormalOutfieldNativePlayer(value.nativePlayerNumber)
    || !sameValue(value.bindings, BINDINGS)
    || !sameValue(value.branches, CSSOCCER_HELD_BALL_PROFILE.branches)
  ) {
    fail("owner-frame", `Held-ball owner frame must use ${CSSOCCER_HELD_BALL_OWNER_FRAME_SCHEMA}.`);
  }
  requirePlayerId(value.stableId, "held-ball owner frame stableId");
  requireTypedScalar(
    value.action,
    `players.${value.stableId}.action`,
    "i16",
  );
  requireInt16(value.action.value, "held-ball owner frame action");
  requireTypedScalar(
    value.animationFrame,
    `players.${value.stableId}.animation_frame`,
    "f32",
  );
  requireTypedVector(value.position, `players.${value.stableId}`);
  requireTypedPlanarVector(
    value.facing,
    `players.${value.stableId}`,
    "displacement",
  );
  requireTypedPlanarVector(
    value.goDisplacement,
    `players.${value.stableId}.go`,
    "displacement",
  );
  return value;
}

function typedVector(prefix, value) {
  return deepFreeze({
    x: typedScalar(`${prefix}.x`, "f32", value.x),
    y: typedScalar(`${prefix}.y`, "f32", value.y),
    z: typedScalar(`${prefix}.z`, "f32", value.z),
  });
}

function typedPlanarVector(prefix, value, suffix) {
  return deepFreeze({
    x: typedScalar(`${prefix}.x_${suffix}`, "f32", value.x),
    y: typedScalar(`${prefix}.y_${suffix}`, "f32", value.y),
  });
}

function requireTypedVector(value, prefix) {
  requirePlainObject(value, `${prefix} typed vector`);
  requireExactKeys(value, ["x", "y", "z"], `${prefix} typed vector`);
  requireTypedScalar(value.x, `${prefix}.x`, "f32");
  requireTypedScalar(value.y, `${prefix}.y`, "f32");
  requireTypedScalar(value.z, `${prefix}.z`, "f32");
}

function requireTypedPlanarVector(value, prefix, suffix) {
  requirePlainObject(value, `${prefix} typed planar vector`);
  requireExactKeys(value, ["x", "y"], `${prefix} typed planar vector`);
  requireTypedScalar(value.x, `${prefix}.x_${suffix}`, "f32");
  requireTypedScalar(value.y, `${prefix}.y_${suffix}`, "f32");
}

function typedScalar(fieldId, valueType, value) {
  return deepFreeze({
    fieldId,
    valueType,
    value,
    numericBits: numericBits(valueType, value),
  });
}

function typedSample(tick, fieldId, valueType, value) {
  return deepFreeze({
    schema: "cssoccer-parity-stream@1",
    recordType: "sample",
    tick,
    phase: "post_tick",
    ...typedScalar(fieldId, valueType, value),
  });
}

function requireTypedScalar(value, fieldId, valueType) {
  requirePlainObject(value, `${fieldId} typed scalar`);
  requireExactKeys(
    value,
    ["fieldId", "numericBits", "value", "valueType"],
    `${fieldId} typed scalar`,
  );
  if (
    value.fieldId !== fieldId
    || value.valueType !== valueType
    || value.numericBits !== numericBits(valueType, value.value)
  ) {
    fail("typed-owner-field", `${fieldId} changed value type or numeric bits.`);
  }
  return value;
}

function requireVector(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y", "z"], label);
  return {
    x: requireF32(value.x, `${label}.x`),
    y: requireF32(value.y, `${label}.y`),
    z: requireF32(value.z, `${label}.z`),
  };
}

function requirePlanarVector(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y"], label);
  return {
    x: requireF32(value.x, `${label}.x`),
    y: requireF32(value.y, `${label}.y`),
  };
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(value, F32(value))) {
    throw new TypeError(`${label} must already be an exact finite f32.`);
  }
  return value;
}

function numericBits(valueType, value) {
  const widths = { u8: 1, i16: 2, u16: 2, i32: 4, f32: 4 };
  const width = widths[valueType];
  if (width === undefined) throw new Error(`Unsupported held-ball value type ${valueType}.`);
  const bytes = new Uint8Array(width);
  const view = new DataView(bytes.buffer);
  if (valueType === "u8") view.setUint8(0, value);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "u16") view.setUint16(0, value, false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else view.setFloat32(0, value, false);
  return [...bytes]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function requireUint32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be a uint32.`);
  }
}

function requireInt16(value, label) {
  if (!Number.isSafeInteger(value) || value < -0x8000 || value > 0x7fff) {
    throw new TypeError(`${label} must be an i16.`);
  }
}

function isNormalOutfieldNativePlayer(value) {
  return Number.isSafeInteger(value)
    && value >= 1
    && value <= 22
    && !KEEPER_NATIVE_PLAYER_NUMBERS.has(value);
}

function requirePlayerId(value, label) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} is not a fixed-fixture player id.`);
  }
}

function fail(boundary, message, detail = {}) {
  throw new CssoccerUnsupportedHeldBallError(boundary, message, detail);
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
  if (!sameValue(actual, expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, clone(child)]),
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

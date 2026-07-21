import { CSSOCCER_NATIVE_ACTIONS } from "./actionState.mjs";
import {
  createBallMatchState,
  stepBallMatchState,
} from "./ballMatchState.mjs";
import {
  projectBallNativeFields,
} from "./ballState.mjs";
import {
  CSSOCCER_CENTRE_PASS_CONSTANTS,
  CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA,
} from "./centrePassLaunch.mjs";
import {
  collectPossession,
  createPossessionState,
  holdPossession,
  projectPossessionNativeFields,
  releasePossession,
} from "./possessionState.mjs";
import {
  advanceCssoccerNativeRng,
  createCssoccerNativeRngState,
} from "./randomState.mjs";

const f32 = Math.fround;

export const CSSOCCER_CENTRE_PASS_ACTION_SCHEMA =
  "cssoccer-centre-pass-action@1";
export const CSSOCCER_CENTRE_PASS_ACTION_PROFILE_SCHEMA =
  "cssoccer-centre-pass-action-profile@1";

/**
 * Operands recovered from the pinned compiled program and the prepared
 * MC_PASSL/contact table. Callers must pass this profile explicitly so a
 * future preparation change cannot silently alter native action arithmetic.
 */
export const CSSOCCER_CENTRE_PASS_ACTION_PROFILE = deepFreeze({
  schema: CSSOCCER_CENTRE_PASS_ACTION_PROFILE_SCHEMA,
  animationId: 39,
  animationFrames: 99,
  baseFrameStep: f32(0.06060606241226196),
  contact: f32(0.4848484992980957),
  localContactOffset: {
    x: f32(9.694164276123047),
    y: f32(-5.616666793823242),
    z: f32(1.9474040269851685),
  },
  movementDistance: 10.14,
  targetDistance: f32(100),
  standAnimationId: 78,
  pass: {
    pitchScale: f32(10.666666984558105),
    pitchLength: 1280,
    pitchWidth: 800,
    lowPassDistanceScale: 18,
    airDecay: 0.01400000000000001,
    airFriction: 0.986,
    groundDecay: 0.03500000000000003,
    groundFriction: 0.965,
    endSpeed: f32(5),
    accuracyArc: 0.1,
    pi: 3.1415926536,
    degrees: 180,
    touchBox: f32(8),
    atFeetDistance: f32(10),
    ballDiameter: f32(4),
  },
});

export const CSSOCCER_CENTRE_PASS_ACTION_SOURCE = deepFreeze({
  files: [
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: [
        "rotate_offs",
        "init_kick_act",
        "kick_action",
        "process_anims",
        "init_stand_act",
      ],
    },
    {
      file: "BALLINT.CPP",
      sha256: "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
      producers: ["ball_interact", "hold_ball", "control_ball", "collect_ball"],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["pass_ahead", "choose_pass", "pass_ball"],
    },
    {
      file: "TEST.EXE",
      sha256: "760d752bd5cf967d30295578a8c4e1b9118f93d83ceaacedc70a79f8166bd63e",
      producers: ["compiled frame, offset, movement, pitch, and pass operands"],
    },
    {
      file: "TEST.MAP",
      sha256: "dee5c35320e3b538f880c698ecfc2ad88bd565cb298da216a5b8c654b644d88c",
      producers: ["compiled producer and global addresses"],
    },
  ],
  compiledEvidence: {
    initKickAction: "object 1:0x25708",
    kickAction: "object 1:0x258bd",
    rotateOffsets: "object 1:0x24572",
    passAhead: "object 1:0x3d7a1",
    passBall: "object 1:0x3dcf5",
    holdBall: "object 1:0x31340",
    ballInteraction: "object 1:0x31f3b",
    passFrameStep: "MC_PASSL prepared f32 bits 3d783e10",
    pitchScale: "object 3:0xde80 f32 bits 412aaaab",
    passMovementDistance: "object 3:0x182f f64",
    passContactOffsets: "object 3:0xe260 save_offs slot 39",
  },
  sourceOrder: [
    "process_anims advances MC_PASSL",
    "ball_interact tweens the held ball using the pre-action taker position",
    "kick_action releases on the first frame at or beyond MCC_PASS",
    "pass_ball advances exactly one af_randomize call and launches a ground pass",
    "kick_action advances the taker unless init_stand_act finished the kick",
    "later native-player-10 ball_interact either leaves the pass free or collects it",
  ],
  explicitInputs: [
    "dynamic tm_mcspd at launch",
    "receiver position and go displacement at pass release",
    "dynamic taker tm_ac and exact pre-pass RNG state",
    "whether source want_pass names the receiver and suppresses accuracy offsets",
    "receiver pre-action samples and source-resolved control acceptance",
    "post-action process_dir facing on taker recovery",
  ],
});

const ACTION_STATE_KEYS = Object.freeze([
  "ball",
  "bindings",
  "matchHalf",
  "owner",
  "phase",
  "possession",
  "profile",
  "receiptTick",
  "release",
  "schema",
  "startTick",
  "taker",
  "tick",
]);
const TAKER_KEYS = Object.freeze([
  "actionId",
  "animationFrame",
  "animationId",
  "animationStep",
  "contact",
  "contactOffset",
  "facing",
  "motionCaptureSpeed",
  "movement",
  "nativePlayerNumber",
  "position",
  "stableId",
]);
const OWNER_KEYS = Object.freeze([
  "country",
  "fixtureTeamIndex",
  "nativeTeamSlot",
  "receiverId",
  "receiverNativePlayerNumber",
  "takerId",
  "takerNativePlayerNumber",
]);
const BINDING_KEYS = Object.freeze([
  "gameplayProfileHash",
  "kickoffProfileHash",
]);
const RELEASE_KEYS = Object.freeze([
  "directionOffset",
  "nativeReceiverNumber",
  "passSpeed",
  "powerOffset",
  "rng",
  "stableReceiverId",
  "targetDistance",
  "targetOffset",
  "tick",
]);
const PROJECTED_BALL_FIELDS = new Set([
  "ball.in_air",
  "ball.speed",
  "ball.spin_xy",
  "ball.spin_z",
  "ball.still",
  "ball.x",
  "ball.x_displacement",
  "ball.y",
  "ball.y_displacement",
  "ball.z",
  "ball.z_displacement",
]);

export class CssoccerUnsupportedCentrePassActionError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedCentrePassActionError";
    this.code = "CSSOCCER_UNSUPPORTED_CENTRE_PASS_ACTION";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/**
 * Consume the accepted launch seam and publish its first processed MC_PASSL
 * frame. The returned state is already the caller's launch tick, matching
 * ACTIONS.CPP's first post-launch action frame.
 */
export function createCssoccerCentrePassAction({
  launch,
  profile,
  taker,
} = {}) {
  const accepted = requireLaunch(launch);
  const compiled = requireActionProfile(profile);
  const initialTaker = requireInitialTaker(taker, accepted, compiled);
  if (accepted.tick === 0) {
    fail("launch-state", "Centre-pass action launch tick must have a preceding source tick.");
  }

  const initial = {
    schema: CSSOCCER_CENTRE_PASS_ACTION_SCHEMA,
    tick: accepted.tick - 1,
    startTick: accepted.tick,
    matchHalf: accepted.matchHalf,
    phase: "kick-held",
    owner: clone(accepted.owner),
    bindings: clone(accepted.bindings),
    profile: compiled,
    taker: initialTaker,
    ball: createBallMatchState(accepted.ball),
    possession: createPossessionState(accepted.possession),
    release: null,
    receiptTick: null,
  };
  return advanceActionTick(initial, accepted.tick, {});
}

export function stepCssoccerCentrePassAction(state, context = {}) {
  const current = requireActionState(state);
  if (current.phase === "complete") {
    fail("action-complete", "The recovered centre-pass action cannot advance again.");
  }
  requirePlainObject(context, "centre-pass action context");
  requireOnlyKeys(
    context,
    ["receiver", "recovery", "release"],
    "centre-pass action context",
  );
  return advanceActionTick(current, current.tick + 1, context);
}

export function assertCssoccerCentrePassActionState(state) {
  return requireActionState(state);
}

/** Publish only fields owned or explicitly accepted by this action seam. */
export function projectCssoccerCentrePassActionNativeFields(state) {
  const current = requireActionState(state);
  const takerId = current.owner.takerId;
  const possessionFields = projectPossessionNativeFields(current.possession)
    .filter(({ fieldId }) => (
      fieldId === "ball.in_hands"
      || fieldId === "ball.last_touch"
      || fieldId === "ball.possession"
      || fieldId === `players.${current.owner.takerId}.possession`
      || fieldId === `players.${current.owner.receiverId}.possession`
    ))
    .map(({ fieldId, valueType, value }) => (
      typedField(current.tick, fieldId, valueType, value)
    ));
  const ballFields = projectBallNativeFields(current.ball.ball)
    .filter(({ fieldId }) => PROJECTED_BALL_FIELDS.has(fieldId));
  const takerFields = [
    typedField(current.tick, `players.${takerId}.native_player`, "i16", 7),
    typedField(current.tick, `players.${takerId}.action`, "i16", current.taker.actionId),
    typedField(current.tick, `players.${takerId}.animation`, "u16", current.taker.animationId),
    typedField(
      current.tick,
      `players.${takerId}.animation_frame`,
      "f32",
      current.taker.animationFrame,
    ),
    typedField(current.tick, `players.${takerId}.x`, "f32", current.taker.position.x),
    typedField(
      current.tick,
      `players.${takerId}.x_displacement`,
      "f32",
      current.taker.facing.x,
    ),
    typedField(current.tick, `players.${takerId}.y`, "f32", current.taker.position.y),
    typedField(
      current.tick,
      `players.${takerId}.y_displacement`,
      "f32",
      current.taker.facing.y,
    ),
    typedField(current.tick, `players.${takerId}.z`, "f32", current.taker.position.z),
    typedField(current.tick, `players.${takerId}.z_displacement`, "f32", f32(0)),
  ];
  return deepFreeze([...ballFields, ...possessionFields, ...takerFields]);
}

function advanceActionTick(state, tick, context) {
  rejectUnexpectedContext(state, tick, context);
  let ball = state.ball;
  let possession = state.possession;
  let release = state.release;
  let receiptTick = state.receiptTick;
  let phase = state.phase;
  const taker = mutableTaker(state.taker);

  taker.animationFrame = f32(taker.animationFrame + taker.animationStep);

  if (possession.owner === CSSOCCER_CENTRE_PASS_CONSTANTS.nativePlayerNumber) {
    ball = tweenHeldKickBall(ball, taker, tick);
    if (taker.animationFrame >= taker.contact) {
      if (context.release === undefined) {
        fail(
          "ground-pass-release",
          `Tick ${tick} reaches MCC_PASS and requires explicit target, accuracy, and RNG inputs.`,
        );
      }
      const launched = releaseGroundPass({
        ball,
        possession,
        owner: state.owner,
        profile: state.profile,
        input: context.release,
        tick,
      });
      ball = launched.ball;
      possession = launched.possession;
      release = launched.release;
      phase = "ground-pass";
    }
  } else if (taker.animationFrame < taker.contact) {
    fail(
      "pre-contact-possession",
      "Native player 7 lost possession before MCC_PASS; the canonical stolen-ball branch is not selected here.",
    );
  }

  if (possession.owner !== CSSOCCER_CENTRE_PASS_CONSTANTS.nativePlayerNumber) {
    if (tick !== release?.tick) {
      const interacted = advanceReceiverInteraction({
        ball,
        possession,
        owner: state.owner,
        profile: state.profile,
        input: context.receiver,
        tick,
      });
      ball = interacted.ball;
      possession = interacted.possession;
      if (interacted.collected) {
        receiptTick = tick;
        phase = "receiver-held";
      }
    }
  }

  const finishes = taker.animationFrame + taker.animationStep >= 1;
  if (finishes) {
    const recovery = requireRecovery(context.recovery, state.owner, tick);
    taker.actionId = CSSOCCER_NATIVE_ACTIONS.STAND;
    taker.animationId = state.profile.standAnimationId;
    taker.animationFrame = f32(0);
    taker.contact = f32(-1);
    taker.movement = { x: f32(0), y: f32(0) };
    taker.facing = recovery.postDirectionFacing;
    phase = "complete";
  } else {
    if (context.recovery !== undefined) {
      fail("recovery-input", `Tick ${tick} does not yet enter init_stand_act.`);
    }
    taker.position.x = f32(taker.position.x + taker.movement.x);
    taker.position.y = f32(taker.position.y + taker.movement.y);
  }

  const next = deepFreeze({
    schema: CSSOCCER_CENTRE_PASS_ACTION_SCHEMA,
    tick,
    startTick: state.startTick,
    matchHalf: state.matchHalf,
    phase,
    owner: clone(state.owner),
    bindings: clone(state.bindings),
    profile: state.profile,
    taker,
    ball,
    possession,
    release,
    receiptTick,
  });
  return requireActionState(next);
}

function tweenHeldKickBall(ball, taker, tick) {
  const current = createBallMatchState(ball);
  const position = current.ball.position;
  const target = {
    x: taker.position.x + taker.contactOffset.x,
    y: taker.position.y + taker.contactOffset.y,
    z: taker.position.z + taker.contactOffset.z,
  };
  const ratio = taker.animationFrame / taker.contact;
  return createBallMatchState({
    ...current,
    ball: {
      ...current.ball,
      tick,
      position: {
        x: f32(position.x + ((target.x - position.x) * ratio)),
        y: f32(position.y + ((target.y - position.y) * ratio)),
        z: f32(position.z + ((target.z - position.z) * ratio)),
      },
    },
  });
}

function releaseGroundPass({ ball, possession, owner, profile, input, tick }) {
  const releaseInput = requireReleaseInput(input, owner);
  const currentBall = createBallMatchState(ball);
  const currentPossession = createPossessionState(possession);
  const randomized = advanceCssoccerNativeRng(releaseInput.rng);
  const target = chooseGroundPassTarget({
    ball: currentBall.ball,
    receiver: releaseInput.receiver,
    profile,
  });
  const accuracyRange = 128 - releaseInput.takerAccuracy;
  const accuracySample = releaseInput.wantedReceiver
    ? 0
    : Math.trunc((randomized.seed * accuracyRange) / 128);
  let directionOffset = f32(
    (accuracySample * profile.pass.accuracyArc)
      * (profile.pass.pi / profile.pass.degrees),
  );
  const powerOffset = f32(accuracySample / 32);
  if (!releaseInput.wantedReceiver && (randomized.seed & 64) !== 0) {
    directionOffset = f32(-directionOffset);
  }

  const ox = f32(target.x / target.distance);
  const oy = f32(target.y / target.distance);
  const cosine = Math.cos(directionOffset);
  const sine = Math.sin(directionOffset);
  const nx = f32((ox * cosine) - (oy * sine));
  const ny = f32((oy * cosine) + (ox * sine));
  const accurateTarget = {
    x: f32(nx * target.distance),
    y: f32(ny * target.distance),
  };
  const endSpeed = f32(profile.pass.endSpeed - powerOffset);
  const passSpeed = f32(
    endSpeed + (target.distance * profile.pass.groundDecay),
  );
  const displacement = {
    x: f32((passSpeed * accurateTarget.x) / target.distance),
    y: f32((passSpeed * accurateTarget.y) / target.distance),
    z: f32(0),
  };
  const nextBall = createBallMatchState({
    ...currentBall,
    ball: {
      ...currentBall.ball,
      tick,
      position: {
        ...currentBall.ball.position,
        z: f32(profile.pass.ballDiameter / 2),
      },
      displacement,
      inAir: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: f32(0),
        fullZ: f32(0),
        xy: f32(0),
        z: f32(0),
      },
      rng: randomized,
    },
  });
  const nextPossession = releasePossession(currentPossession);
  return deepFreeze({
    ball: nextBall,
    possession: nextPossession,
    release: {
      tick,
      stableReceiverId: owner.receiverId,
      nativeReceiverNumber: 10,
      targetOffset: { x: target.x, y: target.y },
      targetDistance: target.distance,
      directionOffset,
      powerOffset,
      passSpeed,
      rng: randomized,
    },
  });
}

function chooseGroundPassTarget({ ball, receiver, profile }) {
  let x = f32(receiver.position.x - ball.position.x);
  let y = f32(receiver.position.y - ball.position.y);
  let a = x;
  let b = y;
  let distance = sourceDistance(x, y);
  let intersection = false;
  const lowPassDistance = profile.pass.pitchScale
    * profile.pass.lowPassDistanceScale;

  for (let index = 1; index < 40; index += 1) {
    a = f32(a + receiver.goDisplacement.x);
    b = f32(b + receiver.goDisplacement.y);
    const projectedDistance = sourceDistance(a, b);
    let passSpeed;
    let travelTicks;
    if (projectedDistance > lowPassDistance) {
      passSpeed = f32(
        profile.pass.endSpeed + 4
          + (projectedDistance * profile.pass.airDecay),
      );
      travelTicks = Math.trunc(
        Math.log((profile.pass.endSpeed + 4) / passSpeed)
          / Math.log(profile.pass.airFriction),
      );
    } else {
      passSpeed = f32(
        profile.pass.endSpeed
          + (projectedDistance * profile.pass.groundDecay),
      );
      travelTicks = Math.trunc(
        Math.log(profile.pass.endSpeed / passSpeed)
          / Math.log(profile.pass.groundFriction),
      );
    }
    if (travelTicks <= index) {
      intersection = true;
      break;
    }
  }
  if (intersection) {
    x = f32(a + receiver.goDisplacement.x);
    y = f32(b + receiver.goDisplacement.y);
  }

  const absoluteX = x + ball.position.x;
  const absoluteY = y + ball.position.y;
  if (absoluteX < 0) x = f32(profile.pass.pitchScale - ball.position.x);
  if (absoluteX > profile.pass.pitchLength) {
    x = f32(
      (profile.pass.pitchLength - profile.pass.pitchScale) - ball.position.x,
    );
  }
  if (absoluteY < 0) y = f32(profile.pass.pitchScale - ball.position.y);
  if (absoluteY > profile.pass.pitchWidth) {
    y = f32(
      (profile.pass.pitchWidth - profile.pass.pitchScale) - ball.position.y,
    );
  }
  distance = sourceDistance(x, y);
  return { x, y, distance };
}

function advanceReceiverInteraction({ ball, possession, owner, profile, input, tick }) {
  if (input === undefined) {
    fail(
      "receiver-frame",
      `Tick ${tick} requires native player 10's explicit pre-action sample.`,
    );
  }
  const receiver = requireReceiverFrame(input, owner, tick);
  const physical = stepBallMatchState(ball).state;
  let nextPossession = createPossessionState(possession);
  let collected = false;

  if (nextPossession.owner === 0) {
    const contactDistance = sourceDistance(
      physical.ball.position.x - receiver.position.x,
      physical.ball.position.y - receiver.position.y,
    );
    const contact = contactDistance <= profile.pass.touchBox
      && physical.ball.position.z >= receiver.position.z
      && physical.ball.position.z < receiver.position.z + 25;
    if (contact && receiver.collect !== true) {
      fail(
        "receiver-contact",
        `Tick ${tick} enters TOUCHB_BOX and requires the source contact result.`,
        { contactDistance },
      );
    }
    if (!contact && receiver.collect) {
      fail(
        "receiver-contact",
        `Tick ${tick} cannot collect outside the compiled TOUCHB_BOX.`,
        { contactDistance },
      );
    }
    if (contact) {
      if (receiver.controlAccepted !== true) {
        fail(
          "receiver-control",
          "The failed-control/rebound branch is outside the canonical centre pass; pass its source-accepted result explicitly.",
        );
      }
      nextPossession = collectPossession(nextPossession, 10);
      collected = true;
    } else if (receiver.controlAccepted !== null) {
      fail("receiver-control", "Control acceptance is valid only on a qualified contact tick.");
    }
  } else if (nextPossession.owner === 10) {
    if (receiver.collect || receiver.controlAccepted !== null) {
      fail("receiver-frame", "An owned ball must be held, not recollected.");
    }
    nextPossession = holdPossession(nextPossession);
  } else {
    fail("receiver-frame", `Unsupported receiver owner ${nextPossession.owner}.`);
  }

  const nextBall = nextPossession.owner === 10
    ? holdReceiverBall(physical, receiver, profile)
    : physical;
  return deepFreeze({
    ball: nextBall,
    possession: nextPossession,
    collected,
  });
}

function holdReceiverBall(ball, receiver, profile) {
  const current = createBallMatchState(ball);
  const fraction = receiver.animationFrame - Math.trunc(receiver.animationFrame);
  const distance = receiver.actionId === CSSOCCER_NATIVE_ACTIONS.RUN
    ? profile.pass.atFeetDistance + (4 * (fraction - 0.5))
    : profile.pass.atFeetDistance;
  return createBallMatchState({
    ...current,
    ball: {
      ...current.ball,
      position: {
        x: f32(receiver.position.x + (receiver.facing.x * distance)),
        y: f32(receiver.position.y + (receiver.facing.y * distance)),
        z: f32(profile.pass.ballDiameter / 2),
      },
      displacement: {
        x: receiver.goDisplacement.x,
        y: receiver.goDisplacement.y,
        z: f32(0),
      },
      inAir: 0,
    },
  });
}

function requireLaunch(value) {
  requirePlainObject(value, "centre-pass launch");
  if (value.schema !== CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA) {
    fail(
      "launch-state",
      `Centre-pass action requires ${CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA}.`,
    );
  }
  const request = value.request;
  const owner = value.owner;
  const action = value.action;
  if (
    !Number.isSafeInteger(value.tick)
    || value.tick < 1
    || value.tick > 0xffffffff
    || (value.matchHalf !== 0 && value.matchHalf !== 1)
    || request?.type !== "pass"
    || request.nativePlayerNumber !== 7
    || request.targetPlayerNumber !== 10
    || request.passType !== 5
    || owner?.nativeTeamSlot !== "A"
    || owner.takerNativePlayerNumber !== 7
    || owner.receiverNativePlayerNumber !== 10
    || owner.takerId !== `${owner.country}-player-07`
    || owner.receiverId !== `${owner.country}-player-10`
    || action?.playerId !== owner.takerId
    || action.action?.value !== CSSOCCER_NATIVE_ACTIONS.KICK
  ) {
    fail("launch-state", "Centre-pass action launch identity/request changed.");
  }
  const ball = createBallMatchState(value.ball);
  const possession = createPossessionState(value.possession);
  if (
    ball.ball.tick !== value.tick
    || possession.owner !== 7
    || possession.lastTouch !== 7
    || playerPossession(possession, 7) !== 1
    || !isF32Value(ball.ball.position.x, 640)
    || !isF32Value(ball.ball.position.y, 400)
    || !isF32Value(ball.ball.position.z, 2)
    || ball.ball.displacement.x !== 0
    || ball.ball.displacement.y !== 0
    || ball.ball.displacement.z !== 0
  ) {
    fail("launch-state", "Centre-pass action requires the exact accepted held-centre seam.");
  }
  if (
    value.bindings?.gameplayProfileHash !== value.bindings?.kickoffProfileHash
    || typeof value.bindings.gameplayProfileHash !== "string"
  ) {
    fail("launch-state", "Centre-pass action launch profile bindings changed.");
  }
  return value;
}

function requireActionProfile(value) {
  if (!sameValue(value, CSSOCCER_CENTRE_PASS_ACTION_PROFILE)) {
    fail(
      "action-profile",
      "Centre-pass action profile must preserve every prepared/compiled operand and numeric bit.",
    );
  }
  return CSSOCCER_CENTRE_PASS_ACTION_PROFILE;
}

function requireInitialTaker(value, launch, profile) {
  requirePlainObject(value, "centre-pass taker input");
  requireOnlyKeys(value, ["motionCaptureSpeed", "position"], "centre-pass taker input");
  const position = requireVector(value.position, "centre-pass taker position");
  const motionCaptureSpeed = requireF32(
    value.motionCaptureSpeed,
    "centre-pass motion-capture speed",
  );
  if (
    !isF32Value(position.x, 640)
    || !isF32Value(position.y, 390)
    || !isF32Value(position.z, 0)
    || motionCaptureSpeed <= 0
  ) {
    fail(
      "taker-input",
      "Centre-pass taker must begin at the native centre position with positive exact tm_mcspd.",
    );
  }
  const facing = {
    x: requireF32(launch.action.facing?.x?.value, "centre-pass facing x"),
    y: requireF32(launch.action.facing?.y?.value, "centre-pass facing y"),
  };
  if (!isF32Value(facing.x, 0) || !isF32Value(facing.y, 1)) {
    fail("taker-input", "The canonical native-A centre taker must face positive Y.");
  }
  const animationStep = f32(profile.baseFrameStep * motionCaptureSpeed);
  const contactOffset = rotateContactOffset(
    profile.localContactOffset,
    facing,
  );
  return {
    stableId: launch.owner.takerId,
    nativePlayerNumber: 7,
    actionId: CSSOCCER_NATIVE_ACTIONS.KICK,
    animationId: profile.animationId,
    animationFrame: f32(0),
    animationStep,
    motionCaptureSpeed,
    contact: profile.contact,
    contactOffset,
    position,
    facing,
    movement: {
      x: f32(profile.movementDistance * animationStep * facing.x),
      y: f32(profile.movementDistance * animationStep * facing.y),
    },
  };
}

function rotateContactOffset(local, facing) {
  let nx = facing.x;
  let ny = facing.y;
  const facingDistance = sourceDistance(nx, ny);
  nx = f32(nx / facingDistance);
  ny = f32(ny / facingDistance);
  let x = local.x;
  let y = local.y;
  let z = local.z;
  const distance = sourceDistance(x, y);
  if (distance > 1) {
    x = f32(x / distance);
    y = f32(y / distance);
    const rotatedX = f32((x * nx) - (y * ny));
    const rotatedY = f32((y * nx) + (x * ny));
    x = f32(rotatedX * distance);
    y = f32(rotatedY * distance);
  } else {
    x = f32(0);
    y = f32(0);
    z = f32(0);
  }
  return { x, y, z };
}

function requireReleaseInput(value, owner) {
  requirePlainObject(value, "centre-pass release input");
  requireOnlyKeys(
    value,
    ["ballLimbo", "receiver", "rng", "simulation", "takerAccuracy", "wantedReceiver"],
    "centre-pass release input",
  );
  if (value.simulation !== true) {
    fail("ground-pass-release", "Canonical pass accuracy requires SIMULATION GameType.");
  }
  requirePlainObject(value.ballLimbo, "centre-pass release ballLimbo");
  requireOnlyKeys(value.ballLimbo, ["active"], "centre-pass release ballLimbo");
  if (value.ballLimbo.active !== false) {
    fail("ground-pass-release", "Canonical centre pass requires inactive ball limbo.");
  }
  if (
    !Number.isSafeInteger(value.takerAccuracy)
    || value.takerAccuracy < 0
    || value.takerAccuracy > 128
  ) {
    fail("ground-pass-release", "Taker tm_ac must be an integer in 0..128.");
  }
  if (typeof value.wantedReceiver !== "boolean") {
    fail(
      "ground-pass-release",
      "Centre-pass release must state whether source want_pass names the receiver.",
    );
  }
  const receiver = requireReleaseReceiver(value.receiver, owner);
  let rng;
  try {
    rng = createCssoccerNativeRngState(value.rng);
  } catch (error) {
    fail("ground-pass-release", `Exact pre-pass RNG state is required: ${error.message}`);
  }
  if (!sameValue(rng, value.rng)) {
    fail("ground-pass-release", "Pre-pass RNG state changed while being canonicalized.");
  }
  return {
    receiver,
    rng,
    simulation: true,
    takerAccuracy: value.takerAccuracy,
    wantedReceiver: value.wantedReceiver,
  };
}

function requireReleaseReceiver(value, owner) {
  requirePlainObject(value, "centre-pass release receiver");
  requireOnlyKeys(
    value,
    ["actionId", "goDisplacement", "nativePlayerNumber", "position", "stableId"],
    "centre-pass release receiver",
  );
  const position = requireVector(value.position, "centre-pass release receiver position");
  const goDisplacement = requirePlanarVector(
    value.goDisplacement,
    "centre-pass release receiver movement",
  );
  if (
    value.stableId !== owner.receiverId
    || value.nativePlayerNumber !== 10
    || value.actionId !== CSSOCCER_NATIVE_ACTIONS.RUN
    || goDisplacement.x <= 0
  ) {
    fail(
      "ground-pass-release",
      "The exact centre pass targets forward-running native player 10.",
    );
  }
  return {
    stableId: value.stableId,
    nativePlayerNumber: 10,
    actionId: value.actionId,
    position,
    goDisplacement,
  };
}

function requireReceiverFrame(value, owner, tick) {
  requirePlainObject(value, "centre-pass receiver frame");
  requireOnlyKeys(
    value,
    [
      "actionId",
      "animationFrame",
      "collect",
      "controlAccepted",
      "facing",
      "goDisplacement",
      "nativePlayerNumber",
      "position",
      "stableId",
      "tick",
    ],
    "centre-pass receiver frame",
  );
  if (
    value.tick !== tick
    || value.stableId !== owner.receiverId
    || value.nativePlayerNumber !== 10
    || (value.actionId !== CSSOCCER_NATIVE_ACTIONS.STAND
      && value.actionId !== CSSOCCER_NATIVE_ACTIONS.RUN
      && value.actionId !== CSSOCCER_NATIVE_ACTIONS.STOP)
    || typeof value.collect !== "boolean"
    || (value.controlAccepted !== null && typeof value.controlAccepted !== "boolean")
  ) {
    fail("receiver-frame", `Tick ${tick} receiver identity/action/result changed.`);
  }
  return {
    tick,
    stableId: owner.receiverId,
    nativePlayerNumber: 10,
    actionId: value.actionId,
    animationFrame: requireF32(
      value.animationFrame,
      "centre-pass receiver animation frame",
    ),
    position: requireVector(value.position, "centre-pass receiver position"),
    facing: requirePlanarVector(value.facing, "centre-pass receiver facing"),
    goDisplacement: requirePlanarVector(
      value.goDisplacement,
      "centre-pass receiver movement",
    ),
    collect: value.collect,
    controlAccepted: value.controlAccepted,
  };
}

function requireRecovery(value, owner, tick) {
  if (value === undefined) {
    fail(
      "recovery-direction",
      `Tick ${tick} enters init_stand_act and requires the later process_dir facing result.`,
    );
  }
  requirePlainObject(value, "centre-pass recovery input");
  requireOnlyKeys(value, ["postDirectionFacing", "stableId"], "centre-pass recovery input");
  if (value.stableId !== owner.takerId) {
    fail("recovery-direction", "Recovery direction stable identity changed.");
  }
  return {
    stableId: owner.takerId,
    postDirectionFacing: requirePlanarVector(
      value.postDirectionFacing,
      "centre-pass recovery facing",
    ),
  };
}

function requireActionState(value) {
  requirePlainObject(value, "centre-pass action state");
  requireExactKeys(value, ACTION_STATE_KEYS, "centre-pass action state");
  if (value.schema !== CSSOCCER_CENTRE_PASS_ACTION_SCHEMA) {
    fail(
      "action-state",
      `Centre-pass action state must use ${CSSOCCER_CENTRE_PASS_ACTION_SCHEMA}.`,
    );
  }
  requireUint32(value.tick, "centre-pass action tick");
  requireUint32(value.startTick, "centre-pass action startTick");
  if (value.tick < value.startTick || (value.matchHalf !== 0 && value.matchHalf !== 1)) {
    fail("action-state", "Centre-pass action tick/half changed.");
  }
  if (!new Set(["kick-held", "ground-pass", "receiver-held", "complete"]).has(value.phase)) {
    fail("action-state", `Unsupported centre-pass phase ${String(value.phase)}.`);
  }
  if (!sameValue(value.profile, CSSOCCER_CENTRE_PASS_ACTION_PROFILE)) {
    fail("action-state", "Centre-pass action profile changed in flight.");
  }
  requirePlainObject(value.owner, "centre-pass action owner");
  requireExactKeys(value.owner, OWNER_KEYS, "centre-pass action owner");
  if (
    (value.owner.country !== "spain" && value.owner.country !== "argentina")
    || value.owner.fixtureTeamIndex !== (value.owner.country === "spain" ? 0 : 1)
    || value.owner.country !== (value.matchHalf === 0 ? "spain" : "argentina")
    || value.owner.nativeTeamSlot !== "A"
    || value.owner.takerNativePlayerNumber !== 7
    || value.owner.receiverNativePlayerNumber !== 10
    || value.owner.takerId !== `${value.owner.country}-player-07`
    || value.owner.receiverId !== `${value.owner.country}-player-10`
  ) {
    fail("action-state", "Centre-pass action owner identity changed.");
  }
  requirePlainObject(value.bindings, "centre-pass action bindings");
  requireExactKeys(value.bindings, BINDING_KEYS, "centre-pass action bindings");
  if (
    !isSha256(value.bindings.kickoffProfileHash)
    || value.bindings.gameplayProfileHash !== value.bindings.kickoffProfileHash
  ) {
    fail("action-state", "Centre-pass source/gameplay profile binding changed.");
  }
  requirePlainObject(value.taker, "centre-pass action taker");
  requireExactKeys(value.taker, TAKER_KEYS, "centre-pass action taker");
  requireTakerState(value.taker, value);
  let ball;
  let possession;
  try {
    ball = createBallMatchState(value.ball);
    possession = createPossessionState(value.possession);
  } catch (error) {
    fail("action-state", `Centre-pass ball/possession state changed: ${error.message}`);
  }
  if (
    !sameValue(ball, value.ball)
    || !sameValue(possession, value.possession)
    || ball.ball.tick !== value.tick
  ) {
    fail("action-state", "Centre-pass nested state changed value type or numeric bits.");
  }
  requireReleaseState(value.release, value, ball);
  const expectedOwner = value.phase === "kick-held" ? 7
    : value.phase === "ground-pass" ? 0
      : 10;
  if (possession.owner !== expectedOwner) {
    fail("action-state", `Phase ${value.phase} requires possession owner ${expectedOwner}.`);
  }
  if (
    (value.release === null) !== (value.phase === "kick-held")
    || (value.receiptTick === null) !== (value.phase === "kick-held" || value.phase === "ground-pass")
  ) {
    fail("action-state", "Centre-pass release/receipt markers changed.");
  }
  if (value.receiptTick !== null) requireUint32(value.receiptTick, "centre-pass receiptTick");
  return value;
}

function requireReleaseState(value, state, ball) {
  if (value === null) {
    if (state.tick >= centrePassReleaseTick(state)) {
      fail("action-state", "Centre-pass state passed MCC_PASS without a release record.");
    }
    return;
  }
  requirePlainObject(value, "centre-pass release state");
  requireExactKeys(value, RELEASE_KEYS, "centre-pass release state");
  const targetOffset = requirePlanarVector(
    value.targetOffset,
    "centre-pass release target offset",
  );
  const targetDistance = requireF32(
    value.targetDistance,
    "centre-pass release target distance",
  );
  const directionOffset = requireF32(
    value.directionOffset,
    "centre-pass release direction offset",
  );
  const powerOffset = requireF32(
    value.powerOffset,
    "centre-pass release power offset",
  );
  const passSpeed = requireF32(value.passSpeed, "centre-pass release speed");
  let rng;
  try {
    rng = createCssoccerNativeRngState(value.rng);
  } catch (error) {
    fail("action-state", `Centre-pass release RNG changed: ${error.message}`);
  }
  if (
    value.tick !== centrePassReleaseTick(state)
    || value.tick > state.tick
    || value.stableReceiverId !== state.owner.receiverId
    || value.nativeReceiverNumber !== 10
    || targetDistance !== sourceDistance(targetOffset.x, targetOffset.y)
    || powerOffset < 0
    || passSpeed <= 0
    || !sameValue(rng, value.rng)
    || !sameValue(rng, ball.ball.rng)
  ) {
    fail("action-state", "Centre-pass release record changed type, identity, RNG, or numeric bits.");
  }
}

function centrePassReleaseTick(state) {
  let frame = f32(0);
  const maximumTicks = Math.ceil(1 / state.taker.animationStep) + 1;
  for (let index = 0; index < maximumTicks; index += 1) {
    frame = f32(frame + state.taker.animationStep);
    if (frame >= state.profile.contact) return state.startTick + index;
  }
  fail("action-state", "MC_PASSL never reaches its compiled contact frame.");
}

function requireTakerState(taker, state) {
  if (
    taker.stableId !== state.owner.takerId
    || taker.nativePlayerNumber !== 7
    || !Number.isSafeInteger(taker.actionId)
    || !Number.isSafeInteger(taker.animationId)
  ) {
    fail("action-state", "Centre-pass taker identity/action changed.");
  }
  for (const [value, label] of [
    [taker.animationFrame, "animation frame"],
    [taker.animationStep, "animation step"],
    [taker.motionCaptureSpeed, "motion-capture speed"],
    [taker.contact, "contact"],
  ]) requireF32(value, `centre-pass taker ${label}`);
  requireVector(taker.position, "centre-pass taker position");
  requireVector(taker.contactOffset, "centre-pass taker contact offset");
  requirePlanarVector(taker.facing, "centre-pass taker facing");
  requirePlanarVector(taker.movement, "centre-pass taker movement");
  const processedTicks = state.tick - state.startTick + 1;
  const maximumTicks = Math.ceil(1 / taker.animationStep) + 1;
  if (processedTicks < 1 || processedTicks > maximumTicks) {
    fail("action-state", "Centre-pass action lifetime exceeds the exact MC_PASSL recurrence.");
  }
  let expectedFrame = f32(0);
  for (let index = 0; index < processedTicks; index += 1) {
    expectedFrame = f32(expectedFrame + taker.animationStep);
  }
  const expectedMovement = {
    x: f32(state.profile.movementDistance * taker.animationStep * 0),
    y: f32(state.profile.movementDistance * taker.animationStep),
  };
  const movementTicks = state.phase === "complete"
    ? processedTicks - 1
    : processedTicks;
  let expectedY = f32(390);
  for (let index = 0; index < movementTicks; index += 1) {
    expectedY = f32(expectedY + expectedMovement.y);
  }
  if (
    !isF32Value(taker.position.x, 640)
    || taker.position.y !== expectedY
    || !isF32Value(taker.position.z, 0)
    || taker.contactOffset.x !== f32(5.616666793823242)
    || taker.contactOffset.y !== f32(9.694164276123047)
    || taker.contactOffset.z !== state.profile.localContactOffset.z
  ) {
    fail("action-state", "Centre-pass taker position/contact recurrence changed.");
  }
  if (state.phase === "complete") {
    if (
      taker.actionId !== CSSOCCER_NATIVE_ACTIONS.STAND
      || taker.animationId !== state.profile.standAnimationId
      || taker.animationFrame !== 0
      || taker.contact !== -1
      || taker.movement.x !== 0
      || taker.movement.y !== 0
      || expectedFrame + taker.animationStep < 1
    ) {
      fail("action-state", "Completed centre pass must retain exact stand recovery state.");
    }
  } else if (
    taker.actionId !== CSSOCCER_NATIVE_ACTIONS.KICK
    || taker.animationId !== state.profile.animationId
    || taker.contact !== state.profile.contact
    || taker.animationFrame !== expectedFrame
    || taker.facing.x !== 0
    || taker.facing.y !== 1
    || taker.movement.x !== expectedMovement.x
    || taker.movement.y !== expectedMovement.y
    || expectedFrame + taker.animationStep >= 1
  ) {
    fail("action-state", "Active centre pass must remain MC_PASSL KICK_ACT.");
  }
}

function rejectUnexpectedContext(state, tick, context) {
  if (context.release !== undefined && state.possession.owner !== 7) {
    fail("ground-pass-release", `Tick ${tick} cannot repeat pass release.`);
  }
  if (context.receiver !== undefined && state.possession.owner === 7) {
    fail("receiver-frame", `Tick ${tick} has not released the ball yet.`);
  }
}

function mutableTaker(value) {
  return {
    ...value,
    contactOffset: { ...value.contactOffset },
    position: { ...value.position },
    facing: { ...value.facing },
    movement: { ...value.movement },
  };
}

function playerPossession(state, nativePlayer) {
  return state.players.find((player) => player.nativePlayer === nativePlayer)?.possession;
}

function sourceDistance(x, y) {
  const result = f32(Math.sqrt((x * x) + (y * y)));
  return result > 0.1 ? result : f32(0.1);
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
  if (!Number.isFinite(value) || !Object.is(value, f32(value))) {
    fail("numeric-input", `${label} must already be an exact finite f32.`);
  }
  return value;
}

function isF32Value(value, expected) {
  return Object.is(value, f32(expected));
}

function requireUint32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    fail("numeric-input", `${label} must be a uint32.`);
  }
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function typedField(tick, fieldId, valueType, value) {
  return {
    schema: "cssoccer-parity-stream@1",
    recordType: "sample",
    tick,
    phase: "post_tick",
    fieldId,
    valueType,
    value,
    numericBits: numericBits(valueType, value),
  };
}

function numericBits(valueType, value) {
  const widths = { u8: 1, i16: 2, u16: 2, i32: 4, f32: 4 };
  const bytes = new Uint8Array(widths[valueType]);
  const view = new DataView(bytes.buffer);
  if (valueType === "u8") view.setUint8(0, value);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "u16") view.setUint16(0, value, false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else if (valueType === "f32") view.setFloat32(0, value, false);
  else throw new Error(`Unsupported centre-pass projection type ${valueType}.`);
  return [...bytes]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function fail(boundary, message, detail) {
  throw new CssoccerUnsupportedCentrePassActionError(boundary, message, detail);
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null)
  ) {
    fail("shape", `${label} must be a plain object.`);
  }
}

function requireOnlyKeys(value, keys, label) {
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) fail("shape", `${label} has unsupported fields: ${extras.join(", ")}.`);
}

function requireExactKeys(value, keys, label) {
  requireOnlyKeys(value, keys, label);
  const missing = keys.filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) fail("shape", `${label} is missing fields: ${missing.join(", ")}.`);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
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

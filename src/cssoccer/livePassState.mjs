import { createBallMatchState } from "./ballMatchState.mjs";
import { CSSOCCER_NATIVE_ACTIONS } from "./actionState.mjs";
import {
  createPossessionState,
  releasePossession,
} from "./possessionState.mjs";
import {
  advanceCssoccerNativeRng,
  createCssoccerNativeRngState,
} from "./randomState.mjs";

const F32 = Math.fround;
const CHIP_GRAVITY = F32(0.6);

export const CSSOCCER_LIVE_PASS_SOURCE = deepFreeze({
  files: [
    {
      file: "BALLINT.CPP",
      sha256: "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
      producers: ["ball_interact pre-contact KICK_ACT tween"],
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: ["init_kick_act contact and rotate_offs bindings"],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["choose_pass", "pass_ahead", "pass_ball"],
    },
  ],
  supportedBoundary:
    "KICK_ACT held-ball tween, including the source-legal 25-tick out-of-play countdown and keeper goal kicks, with receiver ground/chip/cross release and local directed or charged ground release",
});

/** Apply BALLINT.CPP's possessed pre-contact kick tween for one source tick. */
export function stepCssoccerKickHeldBall(input = {}) {
  requirePlainObject(input, "kick-held ball input");
  requireExactKeys(input, ["ball", "owner", "possession", "tick"], "kick-held ball input");
  const ball = createBallMatchState(input.ball);
  const possession = createPossessionState(input.possession);
  requireUint32(input.tick, "kick-held ball tick");
  if (input.tick !== ball.ball.tick + 1) {
    throw new Error("kick-held ball ticks must be contiguous");
  }
  const owner = requireKickOwner(input.owner);
  const qualifiedPostGoalBall = ball.outcome?.kind === "goal"
    && ball.ball.inGoal === 1
    && ball.ball.outOfPlay > 0;
  const qualifiedBoundaryBall = ball.outcome?.kind === "boundary"
    && ball.ball.inGoal === 0
    && ball.ball.outOfPlay > 0;
  if (
    possession.owner !== owner.nativePlayerNumber
    || possession.inHands !== 0
    || ball.limbo.active !== 0
    || (
      !qualifiedPostGoalBall
      && !qualifiedBoundaryBall
      && (
        ball.outcome !== null
        || ball.ball.inGoal !== 0
        || ball.ball.outOfPlay !== 0
      )
    )
  ) {
    throw new Error("kick-held ball requires its ordinary feet-possession owner");
  }

  const position = {};
  for (const axis of ["x", "y", "z"]) {
    // Watcom evaluates this float expression in x87 precision and stores once.
    position[axis] = F32(
      ball.ball.position[axis]
        + (
          (owner.position[axis] + owner.contactOffset[axis])
          - ball.ball.position[axis]
        ) * owner.animationFrame / owner.contact,
    );
  }
  const nextBall = createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      tick: input.tick,
      position,
    },
  });
  return deepFreeze({
    ball: nextBall,
    possession: clone(possession),
  });
}

/** Apply the generic non-crossing ground branch of INTELL.CPP pass_ball. */
export function releaseCssoccerGroundPass(input = {}) {
  requirePlainObject(input, "ground-pass release input");
  requireExactKeys(input, [
    "ball",
    "possession",
    "profile",
    "receiver",
    "rng",
    "takerAccuracy",
    "tick",
    "wantedReceiver",
  ], "ground-pass release input");
  const ball = createBallMatchState(input.ball);
  const possession = createPossessionState(input.possession);
  requireUint32(input.tick, "ground-pass release tick");
  if (ball.ball.tick !== input.tick) {
    throw new Error("ground-pass release must consume the current contact-tick ball");
  }
  if (
    possession.owner < 1
    || possession.owner > 22
    || possession.owner === 1
    || possession.owner === 12
    || possession.inHands !== 0
  ) {
    throw new Error("ground-pass release requires an ordinary outfield possession owner");
  }
  if (
    !Number.isSafeInteger(input.takerAccuracy)
    || input.takerAccuracy < 0
    || input.takerAccuracy > 128
    || typeof input.wantedReceiver !== "boolean"
  ) {
    throw new TypeError("ground-pass release requires typed accuracy and wanted-receiver inputs");
  }
  const receiver = requireGroundPassReceiver(input.receiver, possession.owner);
  const pass = requireGroundPassProfile(input.profile);
  const rng = createCssoccerNativeRngState(input.rng);
  const randomized = advanceCssoccerNativeRng(rng);
  const target = chooseGroundPassTarget({
    ball: ball.ball,
    receiver,
    pass,
  });
  const accuracyRange = 128 - input.takerAccuracy;
  const accuracySample = input.wantedReceiver
    ? 0
    : Math.trunc((randomized.seed * accuracyRange) / 128);
  let directionOffset = F32(
    (accuracySample * pass.accuracyArc) * (pass.pi / pass.degrees),
  );
  const powerOffset = F32(accuracySample / 32);
  if (!input.wantedReceiver && (randomized.seed & 64) !== 0) {
    directionOffset = F32(-directionOffset);
  }
  const ox = F32(target.x / target.distance);
  const oy = F32(target.y / target.distance);
  const cosine = Math.cos(directionOffset);
  const sine = Math.sin(directionOffset);
  const nx = F32((ox * cosine) - (oy * sine));
  const ny = F32((oy * cosine) + (ox * sine));
  const accurateTarget = {
    x: F32(nx * target.distance),
    y: F32(ny * target.distance),
  };
  const endSpeed = F32(pass.endSpeed - powerOffset);
  const passSpeed = F32(endSpeed + (target.distance * pass.groundDecay));
  const displacement = {
    x: F32((passSpeed * accurateTarget.x) / target.distance),
    y: F32((passSpeed * accurateTarget.y) / target.distance),
    z: F32(0),
  };
  const nextBall = createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      tick: input.tick,
      position: {
        ...clone(ball.ball.position),
        z: F32(pass.ballDiameter / 2),
      },
      displacement,
      inAir: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
      rng: randomized,
    },
  });
  return deepFreeze({
    ball: nextBall,
    possession: releasePossession(possession),
    rng: randomized,
    release: {
      tick: input.tick,
      ownerNativePlayer: possession.owner,
      receiverStableId: receiver.stableId,
      receiverNativePlayer: receiver.nativePlayerNumber,
      receiverStopped: receiver.stoppedForPass,
      targetOffset: { x: target.x, y: target.y },
      targetDistance: target.distance,
      directionOffset,
      powerOffset,
      passSpeed,
    },
  });
}

/** Apply the generic pass_type -1 aerial branch of INTELL.CPP pass_ball. */
export function releaseCssoccerChipPass(input = {}) {
  requirePlainObject(input, "chip-pass release input");
  requireExactKeys(input, [
    "ball",
    "possession",
    "profile",
    "receiver",
    "rng",
    "takerAccuracy",
    "tick",
    "wantedReceiver",
  ], "chip-pass release input");
  const ball = createBallMatchState(input.ball);
  const possession = createPossessionState(input.possession);
  requireUint32(input.tick, "chip-pass release tick");
  if (ball.ball.tick !== input.tick) {
    throw new Error("chip-pass release must consume the current contact-tick ball");
  }
  if (
    possession.owner < 1
    || possession.owner > 22
    || possession.owner === 1
    || possession.owner === 12
    || possession.inHands !== 0
  ) {
    throw new Error("chip-pass release requires an ordinary outfield possession owner");
  }
  if (
    !Number.isSafeInteger(input.takerAccuracy)
    || input.takerAccuracy < 0
    || input.takerAccuracy > 128
    || typeof input.wantedReceiver !== "boolean"
  ) {
    throw new TypeError("chip-pass release requires typed accuracy and wanted-receiver inputs");
  }
  const receiver = requireGroundPassReceiver(input.receiver, possession.owner);
  const pass = requireGroundPassProfile(input.profile);
  const rng = createCssoccerNativeRngState(input.rng);
  const randomized = advanceCssoccerNativeRng(rng);
  const target = chooseGroundPassTarget({
    ball: ball.ball,
    receiver,
    pass,
  });
  const accuracyRange = 128 - input.takerAccuracy;
  const accuracySample = input.wantedReceiver
    ? 0
    : Math.trunc((randomized.seed * accuracyRange) / 128);
  let directionOffset = F32(
    (accuracySample * pass.accuracyArc) * (pass.pi / pass.degrees),
  );
  const powerOffset = F32(accuracySample / 32);
  if (!input.wantedReceiver && (randomized.seed & 64) !== 0) {
    directionOffset = F32(-directionOffset);
  }
  const ox = F32(target.x / target.distance);
  const oy = F32(target.y / target.distance);
  const cosine = Math.cos(directionOffset);
  const sine = Math.sin(directionOffset);
  const nx = F32((ox * cosine) - (oy * sine));
  const ny = F32((oy * cosine) + (ox * sine));
  const accurateTarget = {
    x: F32(nx * target.distance),
    y: F32(ny * target.distance),
  };
  const endSpeed = F32(pass.endSpeed - powerOffset);
  const passSpeed = F32(
    endSpeed + 4 + (target.distance * pass.airDecay),
  );
  let travelTicks = Math.trunc(
    Math.log((endSpeed + 4) / passSpeed) / Math.log(pass.airFriction),
  );
  if (travelTicks < 0.1) travelTicks = 1;
  const displacement = {
    x: F32((passSpeed * accurateTarget.x) / target.distance),
    y: F32((passSpeed * accurateTarget.y) / target.distance),
    z: F32(
      // INTELL.CPP declares t as int, so t/2 truncates before gravity is
      // applied. Odd flight durations must not gain an extra half tick.
      Math.trunc(travelTicks / 2) * CHIP_GRAVITY
        - (ball.ball.position.z / travelTicks),
    ),
  };
  if (displacement.z > 14) displacement.z = F32(14);
  const nextBall = createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      tick: input.tick,
      displacement,
      inAir: 1,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
      rng: randomized,
    },
  });
  return deepFreeze({
    ball: nextBall,
    possession: releasePossession(possession),
    rng: randomized,
    release: {
      tick: input.tick,
      ownerNativePlayer: possession.owner,
      receiverStableId: receiver.stableId,
      receiverNativePlayer: receiver.nativePlayerNumber,
      receiverStopped: receiver.stoppedForPass,
      targetOffset: { x: target.x, y: target.y },
      targetDistance: target.distance,
      directionOffset,
      powerOffset,
      passSpeed,
      inAir: 1,
      travelTicks,
    },
  });
}

/** Apply INTELL.CPP's crossing pass_ball branch to a current receiver. */
export function releaseCssoccerCrossPass(input = {}) {
  requirePlainObject(input, "cross-pass release input");
  requireExactKeys(input, [
    "ball",
    "playerHeight",
    "possession",
    "profile",
    "receiver",
    "rng",
    "takerAccuracy",
    "tick",
    "wantedReceiver",
  ], "cross-pass release input");
  const ball = createBallMatchState(input.ball);
  const possession = createPossessionState(input.possession);
  requireUint32(input.tick, "cross-pass release tick");
  if (ball.ball.tick !== input.tick) {
    throw new Error("cross-pass release must consume the current contact-tick ball");
  }
  if (
    possession.owner < 1
    || possession.owner > 22
    || possession.owner === 1
    || possession.owner === 12
    || possession.inHands !== 0
  ) {
    throw new Error("cross-pass release requires an ordinary outfield possession owner");
  }
  if (
    !Number.isSafeInteger(input.takerAccuracy)
    || input.takerAccuracy < 0
    || input.takerAccuracy > 128
    || typeof input.wantedReceiver !== "boolean"
    || !Number.isFinite(input.playerHeight)
    || F32(input.playerHeight) !== input.playerHeight
    || input.playerHeight <= 6
  ) {
    throw new TypeError("cross-pass release requires typed accuracy, height, and receiver inputs");
  }
  const receiver = requireGroundPassReceiver(input.receiver, possession.owner);
  const pass = requireGroundPassProfile(input.profile);
  const randomized = advanceCssoccerNativeRng(createCssoccerNativeRngState(input.rng));
  const target = chooseCrossPassTarget({
    ball: ball.ball,
    receiver,
    pass,
  });
  const accuracySample = input.wantedReceiver
    ? 0
    : Math.trunc((randomized.seed * (128 - input.takerAccuracy)) / 128);
  let directionOffset = F32(
    (accuracySample * pass.accuracyArc) * (pass.pi / pass.degrees),
  );
  const powerOffset = F32(accuracySample / 32);
  if (!input.wantedReceiver && (randomized.seed & 64) !== 0) {
    directionOffset = F32(-directionOffset);
  }
  const ox = F32(target.x / target.distance);
  const oy = F32(target.y / target.distance);
  const cosine = Math.cos(directionOffset);
  const sine = Math.sin(directionOffset);
  const nx = F32((ox * cosine) - (oy * sine));
  const ny = F32((oy * cosine) + (ox * sine));
  const accurateTarget = {
    x: F32(nx * target.distance),
    y: F32(ny * target.distance),
  };
  const endSpeed = F32(7 - powerOffset);
  const passSpeed = F32(endSpeed + 4 + (target.distance * pass.airDecay));
  let travelTicks = Math.trunc(
    Math.log((endSpeed + 4) / passSpeed) / Math.log(pass.airFriction),
  );
  if (travelTicks < 0.1) travelTicks = 1;
  const displacement = {
    x: F32((passSpeed * accurateTarget.x) / target.distance),
    y: F32((passSpeed * accurateTarget.y) / target.distance),
    z: F32(
      ((input.playerHeight - 6 - ball.ball.position.z) / travelTicks)
        + Math.trunc(travelTicks / 2) * CHIP_GRAVITY,
    ),
  };
  if (displacement.z > 14) displacement.z = F32(14);
  const nextBall = createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      tick: input.tick,
      displacement,
      inAir: 1,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
      rng: randomized,
    },
  });
  return deepFreeze({
    ball: nextBall,
    possession: releasePossession(possession),
    rng: randomized,
    release: {
      tick: input.tick,
      ownerNativePlayer: possession.owner,
      receiverStableId: receiver.stableId,
      receiverNativePlayer: receiver.nativePlayerNumber,
      receiverStopped: true,
      targetOffset: { x: target.x, y: target.y },
      targetDistance: target.distance,
      directionOffset,
      powerOffset,
      passSpeed,
      inAir: 1,
      travelTicks,
      cross: true,
    },
  });
}

/** Apply the moving-user SPACT_FPASS branch when pass_decide finds no receiver. */
export function releaseCssoccerDirectedGroundPass(input = {}) {
  requirePlainObject(input, "directed-pass release input");
  requireExactKeys(input, [
    "ball",
    "direction",
    "possession",
    "profile",
    "rng",
    "tick",
  ], "directed-pass release input");
  const pass = requireGroundPassProfile(input.profile);
  return releaseDirectedGroundPass({
    ...input,
    pass,
    targetDistance: F32(pass.pitchScale * 14),
  });
}

/** Apply user_spec_kick's released SPACT_GRND power-pass branch. */
export function releaseCssoccerChargedGroundPass(input = {}) {
  requirePlainObject(input, "charged-ground-pass release input");
  requireExactKeys(input, [
    "ball",
    "charge",
    "direction",
    "possession",
    "profile",
    "rng",
    "tick",
  ], "charged-ground-pass release input");
  if (!Number.isSafeInteger(input.charge) || input.charge < 1 || input.charge > 30) {
    throw new TypeError("charged-ground-pass release charge must be an integer in 1..30");
  }
  const pass = requireGroundPassProfile(input.profile);
  return releaseDirectedGroundPass({
    ball: input.ball,
    direction: input.direction,
    possession: input.possession,
    rng: input.rng,
    tick: input.tick,
    pass,
    targetDistance: F32(pass.pitchScale * input.charge),
  });
}

function releaseDirectedGroundPass({
  ball: ballInput,
  direction: directionInput,
  possession: possessionInput,
  rng: rngInput,
  tick,
  pass,
  targetDistance,
}) {
  const ball = createBallMatchState(ballInput);
  const possession = createPossessionState(possessionInput);
  requireUint32(tick, "directed-pass release tick");
  if (ball.ball.tick !== tick) {
    throw new Error("directed-pass release must consume the current contact-tick ball");
  }
  if (
    possession.owner < 1
    || possession.owner > 22
    || possession.owner === 1
    || possession.owner === 12
    || possession.inHands !== 0
  ) {
    throw new Error("directed-pass release requires an ordinary outfield possession owner");
  }
  const direction = requirePlanarVector(directionInput, "directed-pass direction");
  const directionDistance = sourceDistance(direction.x, direction.y);
  const randomized = advanceCssoccerNativeRng(createCssoccerNativeRngState(rngInput));
  const nx = F32(direction.x / directionDistance);
  const ny = F32(direction.y / directionDistance);
  const passSpeed = F32(pass.endSpeed + (targetDistance * pass.groundDecay));
  const displacement = {
    x: F32(passSpeed * nx),
    y: F32(passSpeed * ny),
    z: F32(0),
  };
  const nextBall = createBallMatchState({
    ...clone(ball),
    ball: {
      ...clone(ball.ball),
      tick,
      position: { ...clone(ball.ball.position), z: F32(pass.ballDiameter / 2) },
      displacement,
      inAir: 0,
      spin: {
        swerve: 0,
        count: 0,
        nativeState: 0,
        fullXY: F32(0),
        fullZ: F32(0),
        xy: F32(0),
        z: F32(0),
      },
      rng: randomized,
    },
  });
  return deepFreeze({
    ball: nextBall,
    possession: releasePossession(possession),
    rng: randomized,
    release: {
      tick,
      ownerNativePlayer: possession.owner,
      receiverStableId: null,
      receiverNativePlayer: 0,
      receiverStopped: false,
      targetOffset: {
        x: F32(nx * targetDistance),
        y: F32(ny * targetDistance),
      },
      targetDistance,
      directionOffset: F32(0),
      powerOffset: F32(0),
      passSpeed,
    },
  });
}

function chooseGroundPassTarget({ ball, receiver, pass }) {
  let x = F32(receiver.position.x - ball.position.x);
  let y = F32(receiver.position.y - ball.position.y);
  let a = x;
  let b = y;
  let distance = sourceDistance(x, y);
  let intersection = false;
  const lowPassDistance = pass.pitchScale * pass.lowPassDistanceScale;
  for (let index = 1; index < 40; index += 1) {
    a = F32(a + receiver.goDisplacement.x);
    b = F32(b + receiver.goDisplacement.y);
    const projectedDistance = sourceDistance(a, b);
    let passSpeed;
    let travelTicks;
    if (projectedDistance > lowPassDistance) {
      passSpeed = F32(
        pass.endSpeed + 4 + (projectedDistance * pass.airDecay),
      );
      travelTicks = Math.trunc(
        Math.log((pass.endSpeed + 4) / passSpeed) / Math.log(pass.airFriction),
      );
    } else {
      passSpeed = F32(pass.endSpeed + (projectedDistance * pass.groundDecay));
      travelTicks = Math.trunc(
        Math.log(pass.endSpeed / passSpeed) / Math.log(pass.groundFriction),
      );
    }
    if (travelTicks <= index) {
      intersection = true;
      break;
    }
  }
  if (intersection) {
    x = F32(a + receiver.goDisplacement.x);
    y = F32(b + receiver.goDisplacement.y);
  }
  const absoluteX = x + ball.position.x;
  const absoluteY = y + ball.position.y;
  if (absoluteX < 0) x = F32(pass.pitchScale - ball.position.x);
  if (absoluteX > pass.pitchLength) {
    x = F32((pass.pitchLength - pass.pitchScale) - ball.position.x);
  }
  if (absoluteY < 0) y = F32(pass.pitchScale - ball.position.y);
  if (absoluteY > pass.pitchWidth) {
    y = F32((pass.pitchWidth - pass.pitchScale) - ball.position.y);
  }
  distance = sourceDistance(x, y);
  return { x, y, distance };
}

function chooseCrossPassTarget({ ball, receiver, pass }) {
  let x = F32(receiver.position.x - ball.position.x);
  let y = F32(receiver.position.y - ball.position.y);
  const goal = receiver.nativePlayerNumber < 12
    ? {
        x: F32(pass.pitchLength - receiver.position.x),
        y: F32((pass.pitchWidth / 2) - receiver.position.y),
      }
    : {
        x: F32(-receiver.position.x),
        y: F32((pass.pitchWidth / 2) - receiver.position.y),
      };
  const closeToGoalLine = receiver.nativePlayerNumber < 12
    ? goal.x <= pass.pitchScale
    : goal.x > -pass.pitchScale;
  if (!closeToGoalLine) {
    const goalDistance = sourceDistance(goal.x, goal.y);
    x = F32(x + (goal.x * pass.pitchScale) / goalDistance);
    y = F32(y + (goal.y * pass.pitchScale) / goalDistance);
  }
  const absoluteX = x + ball.position.x;
  const absoluteY = y + ball.position.y;
  if (absoluteX < 0) x = F32(pass.pitchScale - ball.position.x);
  if (absoluteX > pass.pitchLength) {
    x = F32((pass.pitchLength - pass.pitchScale) - ball.position.x);
  }
  if (absoluteY < 0) y = F32(pass.pitchScale - ball.position.y);
  if (absoluteY > pass.pitchWidth) {
    y = F32((pass.pitchWidth - pass.pitchScale) - ball.position.y);
  }
  return { x, y, distance: sourceDistance(x, y) };
}

function requireGroundPassReceiver(value, ownerNativePlayer) {
  requirePlainObject(value, "ground-pass receiver");
  requireExactKeys(value, [
    "action",
    "goDisplacement",
    "nativePlayerNumber",
    "position",
    "stableId",
  ], "ground-pass receiver");
  if (
    !Number.isSafeInteger(value.nativePlayerNumber)
    || value.nativePlayerNumber < 1
    || value.nativePlayerNumber > 22
    || value.nativePlayerNumber === ownerNativePlayer
    || (value.nativePlayerNumber < 12) !== (ownerNativePlayer < 12)
    || !Number.isSafeInteger(value.action)
    || typeof value.stableId !== "string"
    || value.stableId.length === 0
  ) {
    throw new Error(
      "ground-pass receiver must be a distinct same-team player "
        + `(owner ${ownerNativePlayer}, receiver ${String(value.nativePlayerNumber)})`,
    );
  }
  const position = requireVector(value.position, "ground-pass receiver position");
  const goDisplacement = requirePlanarVector(
    value.goDisplacement,
    "ground-pass receiver displacement",
  );
  // choose_pass stops receivers that are not running toward the opposing goal
  // before pass_ahead evaluates their future position.
  const runsForward = value.action === CSSOCCER_NATIVE_ACTIONS.RUN
    && (value.nativePlayerNumber < 12
      ? goDisplacement.x > 0
      : goDisplacement.x < 0);
  return {
    stableId: value.stableId,
    nativePlayerNumber: value.nativePlayerNumber,
    action: value.action,
    position,
    goDisplacement: runsForward
      ? goDisplacement
      : { x: F32(0), y: F32(0) },
    stoppedForPass: !runsForward,
  };
}

function requireGroundPassProfile(value) {
  requirePlainObject(value, "ground-pass profile");
  const pass = value.pass;
  requirePlainObject(pass, "ground-pass profile.pass");
  for (const key of [
    "accuracyArc",
    "airDecay",
    "airFriction",
    "ballDiameter",
    "degrees",
    "endSpeed",
    "groundDecay",
    "groundFriction",
    "lowPassDistanceScale",
    "pi",
    "pitchLength",
    "pitchScale",
    "pitchWidth",
  ]) {
    if (!Number.isFinite(pass[key])) {
      throw new TypeError(`ground-pass profile.pass.${key} must be finite`);
    }
  }
  return pass;
}

function sourceDistance(x, y) {
  const distance = F32(Math.sqrt((x * x) + (y * y)));
  return distance > 0.1 ? distance : F32(0.1);
}

function requireKickOwner(value) {
  requirePlainObject(value, "kick-held ball owner");
  requireExactKeys(value, [
    "action",
    "animationFrame",
    "contact",
    "contactOffset",
    "nativePlayerNumber",
    "position",
  ], "kick-held ball owner");
  if (
    value.action !== CSSOCCER_NATIVE_ACTIONS.KICK
    || !Number.isSafeInteger(value.nativePlayerNumber)
    || value.nativePlayerNumber < 1
    || value.nativePlayerNumber > 22
  ) {
    throw new Error("kick-held ball owner must be a current KICK_ACT player");
  }
  const animationFrame = requireF32(value.animationFrame, "kick-held animation frame");
  const contact = requireF32(value.contact, "kick-held contact");
  if (animationFrame < 0 || animationFrame >= 1 || contact <= 0) {
    throw new Error("kick-held ball tween requires an active kick animation frame");
  }
  return {
    action: value.action,
    animationFrame,
    contact,
    contactOffset: requireVector(value.contactOffset, "kick-held contact offset"),
    nativePlayerNumber: value.nativePlayerNumber,
    position: requireVector(value.position, "kick-held owner position"),
  };
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
  if (!Number.isFinite(value) || F32(value) !== value) {
    throw new TypeError(`${label} must be an exact f32`);
  }
  return value;
}

function requireUint32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new TypeError(`${label} must be an exact u32`);
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}`);
  }
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

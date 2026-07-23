import { CSSOCCER_MATCH_MODE } from "./boundaryState.mjs";
import { CSSOCCER_NATIVE_GAMEPLAY_PROFILE } from "./nativeGameplayProfile.mjs";

const F32 = Math.fround;

export const CSSOCCER_ACTUA_GAMEPLAY_CAMERA = deepFreeze({
  schema: "cssoccer-actua-gameplay-camera@1",
  source: Object.freeze({
    file: "3D_UPD2.CPP",
    routine: "process_camera",
    mode: 8,
    label: "WIRE",
  }),
  modes: {
    wire: {
      file: "3D_UPD2.CPP",
      routine: "process_camera",
      mode: 8,
      label: "WIRE",
    },
    goalKickLeft: {
      file: "3D_UPD2.CPP",
      routine: "process_camera",
      mode: 9,
      label: "GOAL KICK LEFT",
    },
    goalKickRight: {
      file: "3D_UPD2.CPP",
      routine: "process_camera",
      mode: 10,
      label: "GOAL KICK RIGHT",
    },
    cornerLeft: {
      file: "3D_UPD2.CPP",
      routine: "process_camera",
      mode: 11,
      label: "CORNER LEFT",
    },
    cornerRight: {
      file: "3D_UPD2.CPP",
      routine: "process_camera",
      mode: 12,
      label: "CORNER RIGHT",
    },
    throwIn: {
      file: "3D_UPD2.CPP",
      routine: "process_camera",
      mode: 13,
      label: "THROW IN",
    },
    faceCelebration: {
      file: "3D_UPD2.CPP",
      routine: "process_camera",
      mode: 15,
      label: "FACE CELEBRATION",
    },
    tunnelView: {
      file: "3D_UPD2.CPP",
      routine: "process_camera",
      mode: 16,
      label: "TUNNEL VIEW",
    },
  },
  pitch: Object.freeze({
    length: 1280,
    width: 800,
    centre: Object.freeze([640, 400]),
  }),
  setDistance: 260,
  setHeight: 100,
  restart: {
    pitchRatio: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value,
    // The prepared Spain/Argentina renderer binding decodes these dimensions
    // from the compiled stad_info selected by the full-match native stage.
    stadiumPerimeter: {
      stW: 190,
      stL: 190,
      stH: 290,
      cameraHeightLimit: 360,
    },
  },
  celebration: {
    scoreWait: 220,
    entryDelay: 30,
    entryCountdownExclusive: 190,
    targetHeight: 24,
    distanceDivisor: 1.5,
    heightDivisor: 1.5,
  },
  // RULES.CPP init_swap_ends selects camera 16. The linked native build binds
  // setup.stadium to stadlist[0], whose retained tunnel row is (595, 31, -1425).
  tunnel: {
    matchMode: 19,
    eye: [640, 400, 40],
    target: [595, 1425, 31],
  },
  openingEffectiveBall: { x: 640, y: 400, z: 2 },
  openingPreviousSample: {
    schema: "cssoccer-actua-opening-previous-camera@1",
    sourceBoundary:
      "3D_UPD2.CPP old_cam and old_t values at the line_up to gameplay handoff",
    nextRenderedTick: 0,
    gameplay: {
      eye: [
        638.1781616210938,
        895.5472412109375,
        236.50567626953125,
      ],
      target: [
        640,
        400,
        2,
      ],
    },
  },
  maxDifference: 140,
  moveRate: 0.1,
  targetRateMultiplier: 1.5,
  projectionScale: 440,
  polycssTileSize: 50,
});

/** Create the source camera at the first rendered gameplay sample. */
export function createCssoccerActuaGameplayCamera({
  tick = 0,
  effectiveBall = { x: 640, y: 400, z: 2 },
} = {}) {
  requireTick(tick);
  const ball = requireGameplayPoint(effectiveBall, "Actua camera effective ball");
  const desired = projectCssoccerActuaWireCamera(ball);
  const rendered = tick === 0 && isOpeningCentreBall(ball)
    ? createPose(CSSOCCER_ACTUA_GAMEPLAY_CAMERA.openingPreviousSample.gameplay)
    : desired;
  return createCameraState({
    tick,
    sourceMode: CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.wire.mode,
    modeEnteredTick: tick,
    justScored: 0,
    matchMode: 0,
    lastTouch: 0,
    restartTaker: null,
    trackedPlayer: null,
    effectiveBall: ball,
    desired,
    rendered,
  });
}

/**
 * Advance one source-labelled first-render camera sample from the last
 * completed gameplay pose and its rule selector.
 */
export function stepCssoccerActuaGameplayCamera(camera, {
  tick,
  effectiveBall,
  justScored = 0,
  goalScorer = null,
  matchMode = 0,
  lastTouch,
  restartTaker,
} = {}) {
  const current = requireCameraState(camera);
  requireTick(tick);
  if (tick !== current.tick + 1) {
    throw new Error(`Actua gameplay camera expected tick ${current.tick + 1}; received ${tick}.`);
  }
  const ball = requireGameplayPoint(effectiveBall, "Actua camera effective ball");
  const countdown = requireJustScored(justScored);
  const rulesMode = requireMatchMode(matchMode);
  const touch = requireLastTouch(lastTouch);
  const taker = requireRestartTaker(restartTaker);
  const sourceMode = nextSourceMode(current, countdown, rulesMode, taker);
  const modeEnteredTick = sourceMode === current.sourceMode
    ? current.modeEnteredTick
    : tick;
  const trackedPlayer = sourceMode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.faceCelebration.mode
    ? requireGoalScorer(goalScorer)
    : null;
  const desired = projectModeCamera(sourceMode, { ball, trackedPlayer });
  const renderedGameplay = smoothPose(current.rendered.gameplay, desired.gameplay);
  const rendered = createPose(renderedGameplay);
  return createCameraState({
    tick,
    sourceMode,
    modeEnteredTick,
    justScored: countdown,
    matchMode: rulesMode,
    lastTouch: touch,
    restartTaker: taker,
    trackedPlayer,
    effectiveBall: ball,
    desired,
    rendered,
  });
}

/** Direct translation of 3D_UPD2.CPP camera == 8 (WIRE). */
export function projectCssoccerActuaWireCamera(effectiveBall) {
  const ball = requireGameplayPoint(effectiveBall, "Actua WIRE camera effective ball");
  const { length, width, centre } = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.pitch;
  const [centreX, centreY] = centre;
  const distance = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setDistance + 20;
  const height = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setHeight + 20;
  const targetX = F32(ball.x);
  const targetY = F32(ball.y);
  const targetZ = F32(ball.z);

  let ballX;
  let ballY;
  if (targetX > centreX) {
    ballX = F32(length - targetX);
    ballY = F32(centreY - targetY);
  } else {
    ballX = F32(-targetX);
    ballY = F32(centreY - targetY);
  }
  let magnitude = F32(Math.hypot(ballX, ballY));
  if (!(magnitude > 0)) {
    throw new Error("Actua WIRE camera cannot normalize its effective-ball vector.");
  }
  ballX = F32(ballX / magnitude);
  ballY = F32(ballY / magnitude);

  let difference = F32(Math.acos(clampUnit(-ballY)));
  difference = targetX > centreX
    ? F32(((targetX - centreX) / centreX) * difference)
    : F32(-((centreX - targetX) / centreX) * difference);
  const directionX = F32(Math.sin(difference));
  const directionY = F32(-Math.cos(difference));

  let cameraX = F32(targetX - directionX * distance);
  let cameraY = F32(
    targetY - directionY * (distance - (distance * (targetY / (width * 2)))),
  );
  const verticalRatio = F32(F32(targetY - centreY) / F32(centreY));
  const cameraZ = F32(
    height - ((height * 0.8) * Math.abs(verticalRatio)),
  );
  if (targetY < centreY) cameraY = F32(cameraY + (centreY - targetY) / 20);

  ballX = F32(cameraX - targetX);
  ballY = F32(cameraY - targetY);
  magnitude = F32(Math.hypot(ballX, ballY));
  const adjustedTargetX = F32(targetX + (ballX * cameraZ / (magnitude * 5)));
  const adjustedTargetY = F32(targetY + (ballY * cameraZ / (magnitude * 5)));
  const adjustedTargetZ = F32(targetZ / 2);

  return createPose({
    eye: [cameraX, cameraY, cameraZ],
    target: [adjustedTargetX, adjustedTargetY, adjustedTargetZ],
  });
}

/** Direct translation of 3D_UPD2.CPP camera == 9 (left goal kick). */
export function projectCssoccerActuaGoalKickLeftCamera(effectiveBall) {
  const ball = requireGameplayPoint(
    effectiveBall,
    "Actua left-goal-kick camera effective ball",
  );
  const { centre } = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.pitch;
  const [centreX, centreY] = centre;
  return createRestartPose({
    eye: [
      F32(ball.x - CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setDistance),
      F32(centreY),
      F32(ball.z / 2 + CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setHeight),
    ],
    target: [
      F32(ball.x + ((centreX - ball.x) / 10)),
      F32(ball.y),
      F32(ball.z),
    ],
  });
}

/** Direct translation of 3D_UPD2.CPP camera == 10 (right goal kick). */
export function projectCssoccerActuaGoalKickRightCamera(effectiveBall) {
  const ball = requireGameplayPoint(
    effectiveBall,
    "Actua right-goal-kick camera effective ball",
  );
  const { centre } = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.pitch;
  const [centreX, centreY] = centre;
  return createRestartPose({
    eye: [
      F32(ball.x + CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setDistance),
      F32(centreY),
      F32(ball.z / 2 + CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setHeight),
    ],
    target: [
      F32(ball.x - ((ball.x - centreX) / 10)),
      F32(ball.y),
      F32(ball.z),
    ],
  });
}

/** Direct translation of 3D_UPD2.CPP camera == 11 (left corner). */
export function projectCssoccerActuaCornerLeftCamera(effectiveBall) {
  return projectCssoccerActuaCornerCamera(effectiveBall, { rightGoal: false });
}

/** Direct translation of 3D_UPD2.CPP camera == 12 (right corner). */
export function projectCssoccerActuaCornerRightCamera(effectiveBall) {
  return projectCssoccerActuaCornerCamera(effectiveBall, { rightGoal: true });
}

/** Direct translation of 3D_UPD2.CPP camera == 13 (throw-in). */
export function projectCssoccerActuaThrowInCamera(effectiveBall) {
  const ball = requireGameplayPoint(
    effectiveBall,
    "Actua throw-in camera effective ball",
  );
  const { centre } = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.pitch;
  const cameraY = ball.y > centre[1]
    ? F32(ball.y + CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setDistance / 2)
    : F32(ball.y - CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setDistance / 2);
  return createRestartPose({
    eye: [
      F32(ball.x),
      cameraY,
      F32(ball.z + CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setHeight / 4),
    ],
    target: [F32(ball.x), F32(ball.y), F32(ball.z)],
  });
}

function projectCssoccerActuaCornerCamera(effectiveBall, { rightGoal }) {
  const side = rightGoal ? "right" : "left";
  const ball = requireGameplayPoint(
    effectiveBall,
    `Actua ${side}-corner camera effective ball`,
  );
  const { length, centre } = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.pitch;
  const targetXOffset = F32(
    CSSOCCER_ACTUA_GAMEPLAY_CAMERA.restart.pitchRatio * 12,
  );
  const targetX = rightGoal
    ? F32(length - targetXOffset)
    : targetXOffset;
  const targetY = F32(centre[1]);
  const ballXDistance = F32(ball.x - targetX);
  const ballYDistance = F32(ball.y - targetY);
  const distance = F32(Math.hypot(ballXDistance, ballYDistance));
  if (!(distance > 0)) {
    throw new Error(`Actua ${side}-corner camera cannot normalize its ball vector.`);
  }
  const divisor = rightGoal ? 2 : 1;
  return createRestartPose({
    eye: [
      F32(
        ball.x
          + (ballXDistance * CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setDistance / distance)
            / divisor,
      ),
      F32(
        ball.y
          + (ballYDistance * CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setDistance / distance)
            / divisor,
      ),
      F32(CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setHeight / 4),
    ],
    target: [targetX, targetY, F32(0)],
  });
}

function createRestartPose({ eye, target }) {
  const perimeter = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.restart.stadiumPerimeter;
  const { length, width } = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.pitch;
  const limitedEye = [
    F32(Math.max(-perimeter.stL / 2, Math.min(length + perimeter.stL / 2, eye[0]))),
    F32(Math.max(-perimeter.stW / 2, Math.min(width + perimeter.stW / 2, eye[1]))),
    F32(Math.min(perimeter.cameraHeightLimit, eye[2])),
  ];
  return createPose({ eye: limitedEye, target });
}

/** Direct translation of 3D_UPD2.CPP camera == 15 (FACE CELEBRATION). */
export function projectCssoccerActuaFaceCelebrationCamera(goalScorer) {
  const scorer = requireGoalScorer(goalScorer);
  const profile = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.celebration;
  const distance = F32(CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setDistance);
  const targetX = F32(scorer.position.x);
  const targetY = F32(scorer.position.y);
  const cameraX = F32(
    targetX + F32(scorer.displacement.x) * distance / profile.distanceDivisor,
  );
  const cameraY = F32(
    targetY + F32(scorer.displacement.y) * distance / profile.distanceDivisor,
  );
  const cameraZ = F32(
    CSSOCCER_ACTUA_GAMEPLAY_CAMERA.setHeight / profile.heightDivisor,
  );
  return createPose({
    eye: [cameraX, cameraY, cameraZ],
    target: [targetX, targetY, F32(profile.targetHeight)],
  });
}

/** Direct translation of 3D_UPD2.CPP camera == 16 (TUNNEL VIEW). */
export function projectCssoccerActuaTunnelCamera() {
  const { eye, target } = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.tunnel;
  return createPose({ eye, target });
}

/** Matrix applied once to .polycss-scene under a 440px CSS perspective. */
export function cssoccerActuaSceneMatrix3d(camera) {
  const state = requireCameraState(camera);
  const { eye, target } = state.rendered.renderer;
  const [xRow, yRow, zRow] = rendererViewRows(eye, target);
  const tile = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.polycssTileSize;
  const projection = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.projectionScale;
  return Object.freeze([
    xRow[1] / tile,
    -yRow[1] / tile,
    -zRow[1] / tile,
    0,
    xRow[0] / tile,
    -yRow[0] / tile,
    -zRow[0] / tile,
    0,
    xRow[2] / tile,
    -yRow[2] / tile,
    -zRow[2] / tile,
    0,
    -dot(xRow, eye),
    dot(yRow, eye),
    projection + dot(zRow, eye),
    1,
  ]);
}

export function formatCssoccerActuaSceneMatrix3d(camera) {
  const values = cssoccerActuaSceneMatrix3d(camera);
  return `matrix3d(${values.map(formatCssNumber).join(",")})`;
}

/**
 * Project screen-space movement onto the gameplay pitch for the current camera.
 * Browser movement is +x right and +y down; gameplay remains on its source axes.
 */
export function createCssoccerActuaGameplayInputBasis(camera) {
  const state = requireCameraState(camera);
  const { eye, target } = state.rendered.gameplay;
  const forwardX = target[0] - eye[0];
  const forwardY = target[1] - eye[1];
  const magnitude = Math.hypot(forwardX, forwardY);
  if (!(magnitude > 0)) {
    throw new Error("Actua gameplay camera cannot publish a pitch-relative input basis.");
  }
  const normalizedX = forwardX / magnitude;
  const normalizedY = forwardY / magnitude;
  return deepFreeze({
    schema: "cssoccer-camera-relative-input-basis@1",
    screenRight: [canonicalZero(-normalizedY), canonicalZero(normalizedX)],
    screenDown: [canonicalZero(-normalizedX), canonicalZero(-normalizedY)],
  });
}

function canonicalZero(value) {
  return value === 0 ? 0 : value;
}

function isOpeningCentreBall(ball) {
  const opening = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.openingEffectiveBall;
  return ball.x === opening.x && ball.y === opening.y && ball.z === opening.z;
}

/** Source projection helper used by prepare-time landmark sizing and tests. */
export function projectCssoccerActuaRendererPoint(point, camera, {
  viewportWidth = 640,
  viewportHeight = 400,
} = {}) {
  const rendererPoint = requireVec3(point, "Actua renderer projection point");
  const state = requireCameraState(camera);
  const { eye, target } = state.rendered.renderer;
  const [xRow, yRow, zRow] = rendererViewRows(eye, target);
  const relative = rendererPoint.map((value, index) => value - eye[index]);
  const cameraX = dot(xRow, relative);
  const cameraY = dot(yRow, relative);
  const cameraZ = dot(zRow, relative);
  if (Math.abs(cameraZ) <= 1e-9) {
    throw new Error("Actua renderer point reached the gameplay camera plane.");
  }
  const projection = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.projectionScale;
  return Object.freeze([
    viewportWidth / 2 + projection * cameraX / cameraZ,
    viewportHeight / 2 - projection * cameraY / cameraZ,
    cameraZ,
  ]);
}

function smoothPose(previous, desired) {
  return {
    eye: smoothVector(previous.eye, desired.eye, 1),
    target: smoothVector(
      previous.target,
      desired.target,
      CSSOCCER_ACTUA_GAMEPLAY_CAMERA.targetRateMultiplier,
    ),
  };
}

function smoothVector(previous, desired, rateMultiplier) {
  const maxDifference = F32(CSSOCCER_ACTUA_GAMEPLAY_CAMERA.maxDifference);
  const moveRate = F32(CSSOCCER_ACTUA_GAMEPLAY_CAMERA.moveRate);
  return previous.map((oldValue, index) => {
    const requested = desired[index];
    // 3D_UPD2.CPP stores each requested-minus-old delta in a float before
    // clamping and multiplying it by the static float move_rate.
    const difference = F32(requested - oldValue);
    const clampedDifference = Math.abs(difference) > maxDifference
      ? F32(Math.sign(difference) * maxDifference)
      : difference;
    return F32(oldValue + clampedDifference * moveRate * rateMultiplier);
  });
}

function createPose(gameplay) {
  const eye = requireVec3(gameplay.eye, "Actua gameplay camera eye").map(F32);
  const target = requireVec3(gameplay.target, "Actua gameplay camera target").map(F32);
  return deepFreeze({
    gameplay: {
      eye,
      target,
    },
    renderer: {
      eye: gameplayToRenderer(eye),
      target: gameplayToRenderer(target),
    },
  });
}

function createCameraState({
  tick,
  sourceMode,
  modeEnteredTick,
  justScored,
  matchMode,
  lastTouch,
  restartTaker,
  trackedPlayer,
  effectiveBall,
  desired,
  rendered,
}) {
  const source = sourceForMode(sourceMode);
  return deepFreeze({
    schema: CSSOCCER_ACTUA_GAMEPLAY_CAMERA.schema,
    tick,
    source,
    sourceMode,
    sourceLabel: source.label,
    modeEnteredTick,
    justScored,
    matchMode,
    lastTouch,
    restartTaker,
    trackedPlayer: trackedPlayer === null ? null : cloneGoalScorer(trackedPlayer),
    effectiveBall: {
      x: F32(effectiveBall.x),
      y: F32(effectiveBall.y),
      z: F32(effectiveBall.z),
    },
    desired,
    rendered,
    projection: {
      scale: CSSOCCER_ACTUA_GAMEPLAY_CAMERA.projectionScale,
      polycssTileSize: CSSOCCER_ACTUA_GAMEPLAY_CAMERA.polycssTileSize,
    },
  });
}

function rendererViewRows(eye, target) {
  const deltaX = target[0] - eye[0];
  const deltaY = target[1] - eye[1];
  const deltaZ = target[2] - eye[2];
  const horizontal = Math.hypot(deltaX, deltaZ);
  const radius = Math.hypot(horizontal, deltaY);
  if (!(horizontal > 0) || !(radius > 0)) {
    throw new Error("Actua gameplay camera eye and target do not define a view basis.");
  }
  const cosineTheta = deltaZ / horizontal;
  const sineTheta = deltaX / horizontal;
  const cosinePhi = horizontal / radius;
  const sinePhi = deltaY / radius;
  return Object.freeze([
    Object.freeze([cosineTheta, 0, -sineTheta]),
    Object.freeze([
      -sineTheta * sinePhi,
      cosinePhi,
      -cosineTheta * sinePhi,
    ]),
    Object.freeze([
      sineTheta * cosinePhi,
      sinePhi,
      cosineTheta * cosinePhi,
    ]),
  ]);
}

function gameplayToRenderer([x, y, z]) {
  return Object.freeze([x, z, -y]);
}

function requireCameraState(value) {
  const source = isPlainObject(value?.source) ? sourceForMode(value.sourceMode) : null;
  if (
    !isPlainObject(value)
    || value.schema !== CSSOCCER_ACTUA_GAMEPLAY_CAMERA.schema
    || !Number.isSafeInteger(value.tick)
    || value.tick < 0
    || source === null
    || value.source.mode !== source.mode
    || value.source.label !== source.label
    || value.source.file !== source.file
    || value.source.routine !== source.routine
    || value.sourceLabel !== source.label
    || !Number.isSafeInteger(value.modeEnteredTick)
    || value.modeEnteredTick < 0
    || value.modeEnteredTick > value.tick
    || !Number.isSafeInteger(value.justScored)
    || value.justScored < 0
    || value.justScored > CSSOCCER_ACTUA_GAMEPLAY_CAMERA.celebration.scoreWait
    || !Number.isSafeInteger(value.matchMode)
    || value.matchMode < 0
    || value.matchMode > 255
    || !isLastTouch(value.lastTouch)
    || !isRestartTaker(value.restartTaker)
    || (value.sourceMode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.faceCelebration.mode
      ? !isGoalScorer(value.trackedPlayer)
      : value.trackedPlayer !== null)
    || !isPose(value.desired)
    || !isPose(value.rendered)
  ) {
    throw new Error(`Actua gameplay camera must use ${CSSOCCER_ACTUA_GAMEPLAY_CAMERA.schema}.`);
  }
  return value;
}

function nextSourceMode(current, justScored, matchMode, restartTaker) {
  const wire = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.wire.mode;
  const celebration = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.faceCelebration.mode;
  const tunnel = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.tunnelView.mode;
  const currentMode = sourceModeAfterProjection(current);
  if (matchMode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.tunnel.matchMode) return tunnel;
  if (currentMode === celebration) return justScored === 0 ? wire : celebration;
  if (
    currentMode === wire
    && justScored > 0
    && justScored < CSSOCCER_ACTUA_GAMEPLAY_CAMERA.celebration.entryCountdownExclusive
  ) {
    return celebration;
  }
  if (isRestartMode(currentMode)) {
    if (
      isTakerBoundRestartMode(currentMode)
      && matchMode === CSSOCCER_MATCH_MODE.NORMAL
      && restartTaker === null
    ) {
      throw new Error(
        `Actua camera mode ${currentMode} requires the source restart taker before release.`,
      );
    }
    return currentMode;
  }
  const restartMode = restartModeForMatchMode(matchMode);
  if (restartMode !== null) return restartMode;
  return wire;
}

function projectModeCamera(mode, { ball, trackedPlayer }) {
  if (mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.goalKickLeft.mode) {
    return projectCssoccerActuaGoalKickLeftCamera(ball);
  }
  if (mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.goalKickRight.mode) {
    return projectCssoccerActuaGoalKickRightCamera(ball);
  }
  if (mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.cornerLeft.mode) {
    return projectCssoccerActuaCornerLeftCamera(ball);
  }
  if (mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.cornerRight.mode) {
    return projectCssoccerActuaCornerRightCamera(ball);
  }
  if (mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.throwIn.mode) {
    return projectCssoccerActuaThrowInCamera(ball);
  }
  if (mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.faceCelebration.mode) {
    return projectCssoccerActuaFaceCelebrationCamera(trackedPlayer);
  }
  if (mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.tunnelView.mode) {
    return projectCssoccerActuaTunnelCamera();
  }
  return projectCssoccerActuaWireCamera(ball);
}

function sourceModeAfterProjection(camera) {
  const mode = camera.sourceMode;
  const wire = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.wire.mode;
  if (
    mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.goalKickLeft.mode
    && !isLeftGoalKickMode(camera.matchMode)
  ) {
    return wire;
  }
  if (
    mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.goalKickRight.mode
    && !isRightGoalKickMode(camera.matchMode)
  ) {
    return wire;
  }
  if (
    (
      mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.cornerLeft.mode
      || mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.cornerRight.mode
      || mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.throwIn.mode
    )
    && camera.matchMode === CSSOCCER_MATCH_MODE.NORMAL
    && camera.lastTouch !== camera.restartTaker
  ) {
    return wire;
  }
  return mode;
}

function restartModeForMatchMode(matchMode) {
  if (isLeftGoalKickMode(matchMode)) {
    return CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.goalKickLeft.mode;
  }
  if (isRightGoalKickMode(matchMode)) {
    return CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.goalKickRight.mode;
  }
  if (
    matchMode === CSSOCCER_MATCH_MODE.CORNER_TL
    || matchMode === CSSOCCER_MATCH_MODE.CORNER_BL
  ) {
    return CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.cornerLeft.mode;
  }
  if (
    matchMode === CSSOCCER_MATCH_MODE.CORNER_TR
    || matchMode === CSSOCCER_MATCH_MODE.CORNER_BR
  ) {
    return CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.cornerRight.mode;
  }
  if (
    matchMode === CSSOCCER_MATCH_MODE.THROW_IN_A
    || matchMode === CSSOCCER_MATCH_MODE.THROW_IN_B
  ) {
    return CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.throwIn.mode;
  }
  return null;
}

function isLeftGoalKickMode(matchMode) {
  return matchMode === CSSOCCER_MATCH_MODE.GOAL_KICK_TL
    || matchMode === CSSOCCER_MATCH_MODE.GOAL_KICK_BL;
}

function isRightGoalKickMode(matchMode) {
  return matchMode === CSSOCCER_MATCH_MODE.GOAL_KICK_TR
    || matchMode === CSSOCCER_MATCH_MODE.GOAL_KICK_BR;
}

function isRestartMode(mode) {
  return mode >= CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.goalKickLeft.mode
    && mode <= CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.throwIn.mode;
}

function isTakerBoundRestartMode(mode) {
  return mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.cornerLeft.mode
    || mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.cornerRight.mode
    || mode === CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.throwIn.mode;
}

function sourceForMode(mode) {
  const source = Object.values(CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes)
    .find((candidate) => candidate.mode === mode);
  if (source === undefined) {
    throw new Error(`Unsupported Actua gameplay camera mode ${String(mode)}.`);
  }
  return source;
}

function requireJustScored(value) {
  if (
    !Number.isSafeInteger(value)
    || value < 0
    || value > CSSOCCER_ACTUA_GAMEPLAY_CAMERA.celebration.scoreWait
  ) {
    throw new TypeError("Actua camera just_scored must be inside the source countdown.");
  }
  return value;
}

function requireMatchMode(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
    throw new TypeError("Actua camera match_mode must be an unsigned byte.");
  }
  return value;
}

function requireLastTouch(value) {
  if (!isLastTouch(value)) {
    throw new TypeError("Actua camera last_touch must be an integer from 0 through 22.");
  }
  return value;
}

function isLastTouch(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 22;
}

function requireRestartTaker(value) {
  if (!isRestartTaker(value)) {
    throw new TypeError(
      "Actua camera restart taker must be null or a native player number from 1 through 22.",
    );
  }
  return value;
}

function isRestartTaker(value) {
  return value === null
    || (Number.isSafeInteger(value) && value >= 1 && value <= 22);
}

function requireGoalScorer(value) {
  if (!isGoalScorer(value)) {
    throw new TypeError("Actua face-celebration camera requires the exact goal-scorer pose.");
  }
  return deepFreeze(cloneGoalScorer(value));
}

function isGoalScorer(value) {
  return isPlainObject(value)
    && Number.isSafeInteger(value.nativePlayerNumber)
    && value.nativePlayerNumber >= 1
    && value.nativePlayerNumber <= 22
    && isPlainObject(value.position)
    && [value.position.x, value.position.y, value.position.z].every(Number.isFinite)
    && isPlainObject(value.displacement)
    && [value.displacement.x, value.displacement.y].every(Number.isFinite);
}

function cloneGoalScorer(value) {
  return {
    nativePlayerNumber: value.nativePlayerNumber,
    position: {
      x: F32(value.position.x),
      y: F32(value.position.y),
      z: F32(value.position.z),
    },
    displacement: {
      x: F32(value.displacement.x),
      y: F32(value.displacement.y),
    },
  };
}

function isPose(value) {
  return isPlainObject(value)
    && isPlainObject(value.gameplay)
    && isPlainObject(value.renderer)
    && isVec3(value.gameplay.eye)
    && isVec3(value.gameplay.target)
    && isVec3(value.renderer.eye)
    && isVec3(value.renderer.target);
}

function requireGameplayPoint(value, label) {
  if (
    !isPlainObject(value)
    || !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new TypeError(`${label} must be a finite gameplay point.`);
  }
  return Object.freeze({ x: F32(value.x), y: F32(value.y), z: F32(value.z) });
}

function requireVec3(value, label) {
  if (!isVec3(value)) throw new TypeError(`${label} must be a finite vec3.`);
  return [...value];
}

function isVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function requireTick(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Actua gameplay camera tick must be a non-negative safe integer.");
  }
}

function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function formatCssNumber(value) {
  if (!Number.isFinite(value)) throw new TypeError("CSS camera matrix must be finite.");
  return String(Math.abs(value) < 1e-15 ? 0 : value);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

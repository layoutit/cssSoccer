import assert from "node:assert/strict";
import test from "node:test";

import {
  CSSOCCER_ACTUA_GAMEPLAY_CAMERA,
  createCssoccerActuaGameplayInputBasis,
  createCssoccerActuaGameplayCamera,
  cssoccerActuaSceneMatrix3d,
  formatCssoccerActuaSceneMatrix3d,
  projectCssoccerActuaFaceCelebrationCamera,
  projectCssoccerActuaRendererPoint,
  projectCssoccerActuaTunnelCamera,
  projectCssoccerActuaWireCamera,
  stepCssoccerActuaGameplayCamera,
} from "../src/cssoccer/actuaGameplayCamera.mjs";

const MOVED_BALL = Object.freeze({
  x: 939.5397338867188,
  y: 194.89068603515625,
  z: 21.6130428314209,
});

const SECOND_GOAL_SCORER_AT_TICK_1070 = Object.freeze({
  nativePlayerNumber: 7,
  position: Object.freeze({
    x: 1039.334228515625,
    y: 317.87371826171875,
    z: 0,
  }),
  displacement: Object.freeze({
    x: 0.705271303653717,
    y: -0.7089374661445618,
  }),
});

test("translates the Actua camera 8 WIRE source formula with f32 stores", () => {
  const kickoff = createCssoccerActuaGameplayCamera();
  assert.equal(kickoff.schema, CSSOCCER_ACTUA_GAMEPLAY_CAMERA.schema);
  assert.equal(kickoff.sourceMode, 8);
  assert.equal(kickoff.sourceLabel, "WIRE");
  assert.deepEqual(kickoff.source, CSSOCCER_ACTUA_GAMEPLAY_CAMERA.modes.wire);
  assert.deepEqual(kickoff.desired.gameplay, {
    eye: [640, 610, 120],
    target: [640, 424, 1],
  });
  assert.deepEqual(kickoff.rendered.renderer, {
    eye: [640, 120, -610],
    target: [640, 1, -424],
  });

  const moved = projectCssoccerActuaWireCamera(MOVED_BALL);
  assert.deepEqual(moved.gameplay, {
    eye: [705.6130981445312, 340.2804260253906, 70.77376556396484],
    target: [927.5177612304688, 202.36256408691406, 10.80652141571045],
  });
});

test("publishes an orthonormal pitch basis for camera-relative browser movement", () => {
  const kickoff = createCssoccerActuaGameplayInputBasis(
    createCssoccerActuaGameplayCamera(),
  );
  assert.deepEqual(kickoff, {
    schema: "cssoccer-camera-relative-input-basis@1",
    screenRight: [1, 0],
    screenDown: [0, 1],
  });

  const moved = createCssoccerActuaGameplayInputBasis(
    createCssoccerActuaGameplayCamera({ effectiveBall: MOVED_BALL }),
  );
  assert.ok(moved.screenRight[0] > 0);
  assert.ok(moved.screenRight[1] > 0);
  assert.ok(moved.screenDown[0] < 0);
  assert.ok(moved.screenDown[1] > 0);
  assert.ok(Math.abs(Math.hypot(...moved.screenRight) - 1) < 1e-12);
  assert.ok(Math.abs(
    moved.screenRight[0] * moved.screenDown[0]
      + moved.screenRight[1] * moved.screenDown[1],
  ) < 1e-12);
});

test("translates camera 15 and its delayed goal-celebration state transition", () => {
  const nativeTick1071 = projectCssoccerActuaFaceCelebrationCamera(
    SECOND_GOAL_SCORER_AT_TICK_1070,
  );
  assert.deepEqual(nativeTick1071.gameplay, {
    eye: [1161.581298828125, 194.99122619628906, 66.66666412353516],
    target: [1039.334228515625, 317.87371826171875, 24],
  });

  const initial = createCssoccerActuaGameplayCamera();
  const waiting = stepCssoccerActuaGameplayCamera(initial, {
    tick: 1,
    effectiveBall: MOVED_BALL,
    justScored: 190,
  });
  assert.equal(waiting.sourceMode, 8);
  assert.equal(waiting.modeEnteredTick, 0);

  const celebration = stepCssoccerActuaGameplayCamera(waiting, {
    tick: 2,
    effectiveBall: MOVED_BALL,
    justScored: 189,
    goalScorer: SECOND_GOAL_SCORER_AT_TICK_1070,
  });
  assert.equal(celebration.sourceMode, 15);
  assert.equal(celebration.sourceLabel, "FACE CELEBRATION");
  assert.equal(celebration.modeEnteredTick, 2);
  assert.equal(celebration.justScored, 189);
  assert.deepEqual(celebration.trackedPlayer, SECOND_GOAL_SCORER_AT_TICK_1070);
  assert.deepEqual(celebration.desired, nativeTick1071);
  assert.notDeepEqual(celebration.rendered, celebration.desired);

  const resumed = stepCssoccerActuaGameplayCamera(celebration, {
    tick: 3,
    effectiveBall: MOVED_BALL,
    justScored: 0,
  });
  assert.equal(resumed.sourceMode, 8);
  assert.equal(resumed.sourceLabel, "WIRE");
  assert.equal(resumed.modeEnteredTick, 3);
  assert.equal(resumed.trackedPlayer, null);
});

test("fails closed when the celebration transition has no exact scorer pose", () => {
  const initial = createCssoccerActuaGameplayCamera();
  assert.throws(
    () => stepCssoccerActuaGameplayCamera(initial, {
      tick: 1,
      effectiveBall: MOVED_BALL,
      justScored: 189,
    }),
    /requires the exact goal-scorer pose/u,
  );
  assert.throws(
    () => stepCssoccerActuaGameplayCamera(initial, {
      tick: 1,
      effectiveBall: MOVED_BALL,
      justScored: 221,
    }),
    /inside the source countdown/u,
  );
});

test("translates camera 16 and follows the retained SWAP_ENDS transition", () => {
  const tunnel = projectCssoccerActuaTunnelCamera();
  assert.deepEqual(tunnel.gameplay, {
    eye: [640, 400, 40],
    target: [595, 1425, 31],
  });

  const initial = createCssoccerActuaGameplayCamera();
  const entered = stepCssoccerActuaGameplayCamera(initial, {
    tick: 1,
    effectiveBall: MOVED_BALL,
    matchMode: 19,
  });
  assert.equal(entered.sourceMode, 16);
  assert.equal(entered.sourceLabel, "TUNNEL VIEW");
  assert.equal(entered.matchMode, 19);
  assert.deepEqual(entered.desired, tunnel);
  assert.equal(entered.trackedPlayer, null);

  const resumed = stepCssoccerActuaGameplayCamera(entered, {
    tick: 2,
    effectiveBall: MOVED_BALL,
    matchMode: 5,
  });
  assert.equal(resumed.sourceMode, 8);
  assert.equal(resumed.sourceLabel, "WIRE");
  assert.equal(resumed.modeEnteredTick, 2);
});

test("terminal presentation binds tunnel mode with one deterministic centred-WIRE end card", () => {
  const initial = createCssoccerActuaGameplayCamera();
  const celebration = stepCssoccerActuaGameplayCamera(initial, {
    tick: 1,
    effectiveBall: MOVED_BALL,
    justScored: 189,
    goalScorer: SECOND_GOAL_SCORER_AT_TICK_1070,
  });
  const held = stepCssoccerActuaGameplayCamera(initial, {
    tick: 1,
    effectiveBall: MOVED_BALL,
    matchMode: 19,
    terminal: true,
  });
  assert.equal(held.sourceMode, 16);
  assert.equal(held.modeEnteredTick, 1);
  assert.deepEqual(held.desired, projectCssoccerActuaTunnelCamera());
  assert.deepEqual(held.rendered, initial.rendered);
  assert.notDeepEqual(held.rendered, held.desired);

  const afterCelebration = stepCssoccerActuaGameplayCamera(celebration, {
    tick: 2,
    effectiveBall: MOVED_BALL,
    justScored: 188,
    matchMode: 19,
    terminal: true,
  });
  assert.deepEqual(afterCelebration.rendered, initial.rendered);
  assert.notDeepEqual(afterCelebration.rendered, celebration.rendered);
  assert.throws(
    () => stepCssoccerActuaGameplayCamera(initial, {
      tick: 1,
      effectiveBall: MOVED_BALL,
      matchMode: 19,
      terminal: 1,
    }),
    /terminal flag must be boolean/u,
  );
  assert.throws(
    () => stepCssoccerActuaGameplayCamera(initial, {
      tick: 1,
      effectiveBall: MOVED_BALL,
      terminal: true,
    }),
    /requires source match mode 19/u,
  );
});

test("applies Actua's clamped camera buffer instead of snapping", () => {
  const initial = createCssoccerActuaGameplayCamera();
  const stepped = stepCssoccerActuaGameplayCamera(initial, {
    tick: 1,
    effectiveBall: MOVED_BALL,
  });

  assert.deepEqual(stepped.desired.gameplay, {
    eye: [705.6130981445312, 340.2804260253906, 70.77376556396484],
    target: [927.5177612304688, 202.36256408691406, 10.80652141571045],
  });
  assert.deepEqual(stepped.rendered.gameplay, {
    eye: [646.561279296875, 596, 115.07737731933594],
    target: [661, 403, 2.470978260040283],
  });
  assert.equal(Object.isFrozen(stepped), true);
  assert.equal(Object.isFrozen(stepped.rendered.renderer.eye), true);
});

test("publishes the native view as one scene matrix and exact kickoff landmarks", () => {
  const camera = createCssoccerActuaGameplayCamera();
  const matrix = cssoccerActuaSceneMatrix3d(camera);
  assert.equal(matrix.length, 16);
  assert.ok(matrix.every(Number.isFinite));
  assert.match(formatCssoccerActuaSceneMatrix3d(camera), /^matrix3d\([^)]*\)$/u);

  const upperTouchline = projectCssoccerActuaRendererPoint([640, 0.35, 0], camera);
  const centreSpot = projectCssoccerActuaRendererPoint([640, 0.35, -400], camera);
  const circleLeft = projectCssoccerActuaRendererPoint([531.337, 0.35, -400], camera);
  const circleRight = projectCssoccerActuaRendererPoint([748.663, 0.35, -400], camera);

  assertClose(upperTouchline[0], 320, 1e-9);
  assertClose(upperTouchline[1], 26.564368294500298, 1e-9);
  assertClose(centreSpot[1], 177.42061433421486, 1e-9);
  assertClose(circleLeft[0], 121.92070074278169, 1e-9);
  assertClose(circleRight[0], 518.0792992572183, 1e-9);
});

function assertClose(actual, expected, tolerance) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

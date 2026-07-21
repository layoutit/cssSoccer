import {
  CSSOCCER_NATIVE_FIELD_CONTRACT,
  CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
} from "./nativeFieldContract.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  assertCssoccerNativeGameplayProfile,
} from "./nativeGameplayProfile.mjs";

const F32 = Math.fround;
const FIXTURE_ID = "spain-argentina-full-match";

export const CSSOCCER_OFFICIAL_STATE_SCHEMA =
  "cssoccer-opening-official-state@1";

export const CSSOCCER_OFFICIAL_STRUCT = deepFreeze({
  sourceName: "officials",
  byteSize: 52,
  packing: 4,
  fields: [
    field("x", 0, "f32"),
    field("y", 4, "f32"),
    field("z", 8, "f32"),
    field("dir_x", 12, "f32"),
    field("dir_y", 16, "f32"),
    field("anim", 20, "f32"),
    field("frm", 24, "f32"),
    field("fstep", 28, "f32"),
    field("goto_x", 32, "f32"),
    field("goto_y", 36, "f32"),
    field("act", 40, "i32"),
    field("go", 44, "i32"),
    field("target", 48, "i16"),
    field("newanim", 50, "u8"),
  ],
  trailingPaddingBytes: 1,
  declarationDefect: {
    file: "EXTERNS.H",
    sha256: "025a5317b52a158801bc63120dda75f5f1eaa47137e843d1b04fc146d6f540af",
    detail:
      "The checked declaration omits target, while ACTIONS.CPP/RULES.CPP use it and TEST.EXE stores/loads it as i16 at byte 48.",
  },
});

export const CSSOCCER_OFFICIAL_CONSTANTS = deepFreeze({
  pitch: {
    length: integerConstant("pitch_len", "i32", 1280),
    width: integerConstant("pitch_wid", "i32", 800),
    centreX: integerConstant("cntspot_x", "i32", 640),
    centreY: integerConstant("cntspot_y", "i32", 400),
  },
  prat: f32Constant("prat", "412aaaab"),
  centreOffsetMultiplier: integerConstant("init_centre multiplier", "i32", 5),
  linesmanOffsetMultiplier: integerConstant("init_officials multiplier", "i32", 2),
  movement: {
    arrivalComparison: f64Constant(
      "goto_target distance comparison",
      2.6,
      "4004cccccccccccd",
    ),
    storedStep: f32Constant("goto_target spd store", "40266666"),
    distanceFloor: f32Constant("calc_dist minimum return", "3dcccccd"),
  },
  turn: {
    storedRadians: f32Constant("at_target max store", "3e860a92"),
    sourceFormula: "PI / 12",
    comparison: "dif < cos(storedRadians)",
  },
  actions: {
    normal: integerConstant("process_ref follow play", "i32", 0),
    positioning: integerConstant("process_ref goto target", "i32", 1),
    waitForKick: integerConstant("process_ref await kicker", "i32", 2),
    turning: integerConstant("process_ref stand and turn", "i32", 3),
    ready: integerConstant("process_ref facing target", "i32", 4),
  },
  animations: {
    jog: f32Constant("MC_JOG compiled id", "42920000"),
    stand: f32Constant("MC_STAND compiled id", "429c0000"),
    plead: f32Constant("MC_PLEAD compiled id", "429c0000"),
  },
  frameSteps: {
    jog: f32Constant("MC_JOG_FS compiled store", "3d8d3dcb"),
    stand: f32Constant("MC_STAND_FS compiled store", "3d520d21"),
    plead: f32Constant("MC_PLEAD_FS compiled store", "3c800000"),
  },
  initialFrame: f32Constant("init_officials referee frm", "3f19999a"),
});

const SOURCE_FILES = deepFreeze([
  {
    file: "ACTIONS.CPP",
    sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
    producers: ["init_officials"],
  },
  {
    file: "RULES.CPP",
    sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
    producers: [
      "init_centre",
      "init_ref_stand",
      "init_ref_jog",
      "goto_target",
      "at_target",
      "process_ref",
    ],
  },
  {
    file: "EXTERNS.H",
    sha256: "025a5317b52a158801bc63120dda75f5f1eaa47137e843d1b04fc146d6f540af",
    producers: ["officials declaration", "refs[3] declaration"],
  },
  {
    file: "TEST.MAP",
    sha256: "dee5c35320e3b538f880c698ecfc2ad88bd565cb298da216a5b8c654b644d88c",
    producers: ["compiled refs and official-function addresses"],
  },
]);

export const CSSOCCER_OFFICIAL_SOURCE = deepFreeze({
  classification: "source-derived-native-refs-uncaptured",
  files: SOURCE_FILES,
  compiledEvidence: {
    testExeSha256:
      "760d752bd5cf967d30295578a8c4e1b9118f93d83ceaacedc70a79f8166bd63e",
    refs: "object 3:0x40dc8",
    initOfficials: "object 1:0x1fddb",
    initCentre: "object 1:0x4cd93",
    initRefStand: "object 1:0x50884",
    initRefJog: "object 1:0x5099c",
    gotoTarget: "object 1:0x510e4",
    atTarget: "object 1:0x511e1",
    processRef: "object 1:0x516c6",
    processOfficials: "object 1:0x517dc",
  },
  numericModel: {
    sourceCompiler: "Watcom 10.5 /fp5",
    floatStores: "Every C float local and officials float member is rounded with Math.fround.",
    intermediateEvaluation:
      "JavaScript f64 evaluates source x87/libm expressions; every observable C float store is explicitly rounded to f32.",
    comparisons:
      "Stored f32 distance/dot values are compared with source f64 literals or libm results.",
    animationCadence:
      "This subset applies init_ref_jog/init_ref_stand stores but does not advance anim_officials frames.",
  },
  nativeQualification: {
    fieldContractSha256: CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
    capturedRefs: false,
    exactParityClaim: false,
    reason: "The accepted 412-field native contract has no refs[] domain.",
  },
  supportedSubset: [
    "init_officials",
    "CENTRE_A and CENTRE_B referee target selection",
    "goto_target action 1 to action 3",
    "ball-facing at_target action 3 to ready action 4",
    "immutable initialization of both linesmen",
  ],
  unsupportedHere: [
    "normal-play referee following",
    "wait-for-kick action 2",
    "player-target referee turning",
    "fouls, restarts, throw-ins, corners, goals, and end swapping",
    "linesman following or any official animation-frame cadence",
    "native refs[] parity publication",
  ],
});

const BINDINGS = deepFreeze({
  evidenceClass: CSSOCCER_OFFICIAL_SOURCE.classification,
  nativeExactParity: false,
  nativeRefsCaptured: false,
  nativeFieldContractSha256: CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
  nativeGameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  nativeBuildSha256:
    "5db9d52f4dec6e71d2a1df1009c803967455a3683b1c87e271669165ef43a3e3",
  compiledTestExeSha256:
    "760d752bd5cf967d30295578a8c4e1b9118f93d83ceaacedc70a79f8166bd63e",
  compiledTestMapSha256:
    "dee5c35320e3b538f880c698ecfc2ad88bd565cb298da216a5b8c654b644d88c",
  sourceFiles: Object.fromEntries(SOURCE_FILES.map(({ file, sha256 }) => [file, sha256])),
});

const STATE_KEYS = Object.freeze([
  "bindings",
  "centreOwner",
  "fixtureId",
  "officials",
  "phase",
  "schema",
  "status",
  "tick",
]);
const OFFICIAL_KEYS = Object.freeze([
  "action",
  "animation",
  "facing",
  "go",
  "goto",
  "id",
  "index",
  "position",
  "role",
  "target",
]);

export class CssoccerUnsupportedOfficialStateError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedOfficialStateError";
    this.code = "CSSOCCER_UNSUPPORTED_OFFICIAL_STATE";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/**
 * Apply source init_officials followed by the referee-owned part of
 * init_centre. This state is source/compiled-derived because refs[] is absent
 * from the accepted native field capture.
 */
export function createCssoccerOpeningOfficialState(input = {}) {
  requirePlainObject(input, "opening official input");
  requireExactKeys(
    input,
    ["centreOwner", "nativeGameplayProfile"],
    "opening official input",
  );
  const profile = assertCssoccerNativeGameplayProfile(input.nativeGameplayProfile);
  const centreOwner = requireCentreOwner(input.centreOwner);
  requireBoundProfile(profile);

  const officials = initialOfficials(centreOwner, profile.constants.prat.value);
  return assemble({ centreOwner, officials, tick: 0 });
}

/** Advance exactly one supported process_ref opening-centre invocation. */
export function stepCssoccerOpeningOfficialState(state) {
  const current = assertCssoccerOfficialState(state);
  const referee = current.officials[0];
  if (referee.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value) {
    fail(
      "ready",
      "Opening official motion is complete; normal play is outside this reducer.",
      { action: referee.action, tick: current.tick },
    );
  }

  let nextReferee;
  if (referee.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value) {
    nextReferee = gotoTarget(referee);
  } else if (referee.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.turning.value) {
    nextReferee = atBallTarget(referee);
  } else {
    fail(
      "referee-action",
      `Referee action ${referee.action} is outside opening positioning/turning.`,
      { action: referee.action },
    );
  }

  return assemble({
    centreOwner: current.centreOwner,
    officials: [nextReferee, current.officials[1], current.officials[2]],
    tick: current.tick + 1,
  });
}

export function projectCssoccerOpeningRefereeAction(state) {
  return assertCssoccerOfficialState(state).officials[0].action;
}

export function assertCssoccerOfficialState(state) {
  requirePlainObject(state, "opening official state");
  requireExactKeys(state, STATE_KEYS, "opening official state");
  if (
    state.schema !== CSSOCCER_OFFICIAL_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || state.phase !== "opening-centre"
    || !Number.isSafeInteger(state.tick)
    || state.tick < 0
  ) {
    throw new Error(`Opening official state must use ${CSSOCCER_OFFICIAL_STATE_SCHEMA}.`);
  }
  const centreOwner = requireCentreOwner(state.centreOwner);
  requireBindings(state.bindings);
  if (!Array.isArray(state.officials) || state.officials.length !== 3) {
    throw new Error("Opening official state must retain exactly refs[0..2].");
  }
  state.officials.forEach((official, index) => requireOfficial(official, index));

  const referee = state.officials[0];
  const supportedActions = [
    CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value,
    CSSOCCER_OFFICIAL_CONSTANTS.actions.turning.value,
    CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value,
  ];
  if (!supportedActions.includes(referee.action)) {
    fail(
      "referee-action",
      `Referee action ${referee.action} is outside the opening-centre subset.`,
      { action: referee.action, supportedActions },
    );
  }
  const expectedStatus = statusForAction(referee.action);
  if (state.status !== expectedStatus) {
    throw new Error("Opening official status diverged from referee action.");
  }
  requireRefereeShape(referee, state.tick, centreOwner);

  const expectedLinesmen = initialLinesmen(CSSOCCER_OFFICIAL_CONSTANTS.prat.value);
  if (!sameValue(state.officials.slice(1), expectedLinesmen)) {
    throw new Error("Opening linesmen changed outside their initialization subset.");
  }
  return state;
}

function assemble({ centreOwner, officials, tick }) {
  const state = deepFreeze({
    schema: CSSOCCER_OFFICIAL_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    tick,
    phase: "opening-centre",
    status: statusForAction(officials[0].action),
    centreOwner,
    officials: officials.map((official) => clone(official)),
    bindings: clone(BINDINGS),
  });
  return assertCssoccerOfficialState(state);
}

function initialOfficials(centreOwner, prat) {
  return [initialReferee(centreOwner, prat), ...initialLinesmen(prat)];
}

function initialReferee(centreOwner, prat) {
  const { centreX, centreY } = CSSOCCER_OFFICIAL_CONSTANTS.pitch;
  const direction = centreOwner === "A" ? 1 : -1;
  const gotoX = F32(
    centreX.value
      + (direction * prat * CSSOCCER_OFFICIAL_CONSTANTS.centreOffsetMultiplier.value),
  );
  return officialRecord({
    id: "referee-00",
    index: 0,
    role: "referee",
    x: F32(centreX.value),
    y: F32(centreY.value),
    dirX: F32(0),
    dirY: F32(1),
    animationId: CSSOCCER_OFFICIAL_CONSTANTS.animations.plead.value,
    frame: CSSOCCER_OFFICIAL_CONSTANTS.initialFrame.value,
    frameStep: CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.plead.value,
    gotoX,
    gotoY: F32(centreY.value),
    action: CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value,
  });
}

function initialLinesmen(prat) {
  const { centreX, width } = CSSOCCER_OFFICIAL_CONSTANTS.pitch;
  const offset = prat * CSSOCCER_OFFICIAL_CONSTANTS.linesmanOffsetMultiplier.value;
  return [
    officialRecord({
      id: "assistant-referee-01",
      index: 1,
      role: "linesman-top",
      x: F32(centreX.value),
      y: F32(-offset),
      dirX: F32(0),
      dirY: F32(1),
      animationId: CSSOCCER_OFFICIAL_CONSTANTS.animations.stand.value,
      frame: F32(0),
      frameStep: CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.stand.value,
      gotoX: F32(centreX.value),
      gotoY: F32(-offset),
      action: CSSOCCER_OFFICIAL_CONSTANTS.actions.normal.value,
    }),
    officialRecord({
      id: "assistant-referee-02",
      index: 2,
      role: "linesman-bottom",
      x: F32(centreX.value),
      y: F32(width.value + offset),
      dirX: F32(0),
      dirY: F32(-1),
      animationId: CSSOCCER_OFFICIAL_CONSTANTS.animations.stand.value,
      frame: F32(0),
      frameStep: CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.stand.value,
      gotoX: F32(centreX.value),
      gotoY: F32(width.value + offset),
      action: CSSOCCER_OFFICIAL_CONSTANTS.actions.normal.value,
    }),
  ];
}

function officialRecord({
  id,
  index,
  role,
  x,
  y,
  dirX,
  dirY,
  animationId,
  frame,
  frameStep,
  gotoX,
  gotoY,
  action,
}) {
  return {
    id,
    index,
    role,
    position: { x, y, z: F32(0) },
    facing: { x: dirX, y: dirY },
    animation: {
      id: animationId,
      frame,
      frameStep,
      newAnimation: 1,
    },
    goto: { x: gotoX, y: gotoY },
    action,
    go: 0,
    target: 0,
  };
}

function gotoTarget(official) {
  let tx = F32(official.goto.x - official.position.x);
  let ty = F32(official.goto.y - official.position.y);
  const distance = sourceDistance(tx, ty);
  tx = F32(tx / distance);
  ty = F32(ty / distance);

  const next = clone(official);
  next.facing = { x: tx, y: ty };
  let speed;
  if (distance > CSSOCCER_OFFICIAL_CONSTANTS.movement.arrivalComparison.value) {
    initializeJog(next);
    speed = CSSOCCER_OFFICIAL_CONSTANTS.movement.storedStep.value;
  } else {
    initializeStand(next);
    next.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.turning.value;
    speed = F32(0);
  }
  next.position.x = F32(next.position.x + (tx * speed));
  next.position.y = F32(next.position.y + (ty * speed));
  return deepFreeze(next);
}

function atBallTarget(official) {
  const ballX = F32(CSSOCCER_OFFICIAL_CONSTANTS.pitch.centreX.value);
  const ballY = F32(CSSOCCER_OFFICIAL_CONSTANTS.pitch.centreY.value);
  let x = F32(ballX - official.position.x);
  let y = F32(ballY - official.position.y);
  const ballDistance = sourceDistance(x, y);
  x = F32(x / ballDistance);
  y = F32(y / ballDistance);

  const xd = official.facing.x;
  const yd = official.facing.y;
  const difference = F32((x * xd) + (y * yd));
  let max = CSSOCCER_OFFICIAL_CONSTANTS.turn.storedRadians.value;
  let nx;
  let ny;
  const next = clone(official);

  if (difference < Math.cos(max)) {
    if ((x * yd) > (y * xd)) max = F32(-max);
    nx = F32((xd * Math.cos(max)) - (yd * Math.sin(max)));
    ny = F32((yd * Math.cos(max)) + (xd * Math.sin(max)));
  } else {
    nx = x;
    ny = y;
    next.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value;
  }

  const directionLength = sourceDistance(nx, ny);
  next.facing = {
    x: F32(nx / directionLength),
    y: F32(ny / directionLength),
  };
  return deepFreeze(next);
}

function initializeJog(official) {
  const { jog } = CSSOCCER_OFFICIAL_CONSTANTS.animations;
  if (Math.abs(official.animation.id) !== jog.value) {
    official.animation = {
      id: jog.value,
      frame: F32(0),
      frameStep: CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.jog.value,
      newAnimation: 1,
    };
  }
}

function initializeStand(official) {
  const { stand } = CSSOCCER_OFFICIAL_CONSTANTS.animations;
  if (Math.abs(official.animation.id) !== stand.value) {
    official.animation = {
      id: stand.value,
      frame: F32(0),
      frameStep: CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.stand.value,
      newAnimation: 1,
    };
  }
}

function sourceDistance(x, y) {
  const result = F32(Math.sqrt((x * x) + (y * y)));
  return result > 0.1
    ? result
    : CSSOCCER_OFFICIAL_CONSTANTS.movement.distanceFloor.value;
}

function requireRefereeShape(referee, tick, centreOwner) {
  const expectedTarget = initialReferee(
    centreOwner,
    CSSOCCER_OFFICIAL_CONSTANTS.prat.value,
  ).goto;
  if (!sameValue(referee.goto, expectedTarget)) {
    throw new Error("Opening referee target diverged from init_centre.");
  }
  if (
    !Object.is(referee.position.y, F32(400))
    || !Object.is(referee.position.z, F32(0))
    || referee.target !== 0
    || referee.go !== 0
  ) {
    throw new Error("Opening referee left the supported centre/ball subset.");
  }
  const minimumX = Math.min(640, expectedTarget.x);
  const maximumX = Math.max(640, expectedTarget.x);
  if (referee.position.x < minimumX || referee.position.x > maximumX) {
    throw new Error("Opening referee position passed its centre target.");
  }
  const facingLength = sourceDistance(referee.facing.x, referee.facing.y);
  if (Math.abs(facingLength - 1) > 0.000002) {
    throw new Error("Opening referee facing is not a source-normalized vector.");
  }

  const { positioning, turning, ready } = CSSOCCER_OFFICIAL_CONSTANTS.actions;
  const { jog, plead, stand } = CSSOCCER_OFFICIAL_CONSTANTS.animations;
  const { jog: jogStep, plead: pleadStep, stand: standStep } =
    CSSOCCER_OFFICIAL_CONSTANTS.frameSteps;
  let expectedAnimation;
  let expectedFrame;
  let expectedStep;
  if (tick === 0 && referee.action === positioning.value) {
    expectedAnimation = plead.value;
    expectedFrame = CSSOCCER_OFFICIAL_CONSTANTS.initialFrame.value;
    expectedStep = pleadStep.value;
  } else if (referee.action === positioning.value) {
    expectedAnimation = jog.value;
    expectedFrame = F32(0);
    expectedStep = jogStep.value;
  } else if (referee.action === turning.value || referee.action === ready.value) {
    expectedAnimation = stand.value;
    expectedFrame = F32(0);
    expectedStep = standStep.value;
  }
  if (
    !Object.is(referee.animation.id, expectedAnimation)
    || !Object.is(referee.animation.frame, expectedFrame)
    || !Object.is(referee.animation.frameStep, expectedStep)
    || referee.animation.newAnimation !== 1
  ) {
    throw new Error("Opening referee animation stores diverged from source initialization.");
  }
}

function requireOfficial(official, index) {
  requirePlainObject(official, `refs[${index}]`);
  requireExactKeys(official, OFFICIAL_KEYS, `refs[${index}]`);
  const identities = [
    ["referee-00", "referee"],
    ["assistant-referee-01", "linesman-top"],
    ["assistant-referee-02", "linesman-bottom"],
  ];
  if (
    official.id !== identities[index][0]
    || official.role !== identities[index][1]
    || official.index !== index
  ) {
    throw new Error(`refs[${index}] identity changed.`);
  }
  requireF32Point3(official.position, `refs[${index}] position`);
  requireF32Point2(official.facing, `refs[${index}] facing`);
  requireF32Point2(official.goto, `refs[${index}] goto`);
  requirePlainObject(official.animation, `refs[${index}] animation`);
  requireExactKeys(
    official.animation,
    ["frame", "frameStep", "id", "newAnimation"],
    `refs[${index}] animation`,
  );
  requireF32(official.animation.id, `refs[${index}] animation id`);
  requireF32(official.animation.frame, `refs[${index}] animation frame`);
  requireF32(official.animation.frameStep, `refs[${index}] animation frameStep`);
  requireInteger(official.animation.newAnimation, 0, 0xff, `refs[${index}] newanim`);
  requireI32(official.action, `refs[${index}] action`);
  requireI32(official.go, `refs[${index}] go`);
  requireInteger(official.target, -0x8000, 0x7fff, `refs[${index}] target`);
}

function requireBindings(value) {
  requirePlainObject(value, "official bindings");
  if (!sameValue(value, BINDINGS)) {
    throw new Error("Opening official source/build/native-field bindings changed.");
  }
}

function requireBoundProfile(profile) {
  if (
    profile.profileHash !== BINDINGS.nativeGameplayProfileHash
    || profile.bindings.sourceRevision !== BINDINGS.sourceRevision
    || profile.bindings.nativeBuildSha256 !== BINDINGS.nativeBuildSha256
    || profile.bindings.compiledEvidence.testExeSha256
      !== BINDINGS.compiledTestExeSha256
    || profile.bindings.compiledEvidence.testMapSha256
      !== BINDINGS.compiledTestMapSha256
  ) {
    throw new Error("Official reducer and native gameplay profile bindings diverged.");
  }
  const ids = profile.constants.officialActionIds;
  if (
    ids.normal.value !== CSSOCCER_OFFICIAL_CONSTANTS.actions.normal.value
    || ids.positioning.value !== CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value
    || ids.waitForKick.value !== CSSOCCER_OFFICIAL_CONSTANTS.actions.waitForKick.value
    || ids.ready.value !== CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value
  ) {
    throw new Error("Official action ids diverged from the accepted gameplay profile.");
  }
}

function statusForAction(action) {
  if (action === CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value) {
    return "positioning";
  }
  if (action === CSSOCCER_OFFICIAL_CONSTANTS.actions.turning.value) {
    return "turning";
  }
  if (action === CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value) {
    return "ready";
  }
  fail("referee-action", `Referee action ${action} has no opening status.`, { action });
}

function requireCentreOwner(value) {
  if (value !== "A" && value !== "B") {
    throw new Error("Opening centreOwner must be native team slot A or B.");
  }
  return value;
}

function requireF32Point2(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y"], label);
  requireF32(value.x, `${label} x`);
  requireF32(value.y, `${label} y`);
}

function requireF32Point3(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y", "z"], label);
  requireF32(value.x, `${label} x`);
  requireF32(value.y, `${label} y`);
  requireF32(value.z, `${label} z`);
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(F32(value), value)) {
    throw new TypeError(`${label} must be finite and exactly rounded f32.`);
  }
}

function requireI32(value, label) {
  requireInteger(value, -0x80000000, 0x7fffffff, label);
}

function requireInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
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

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!sameValue(actual, wanted)) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function field(name, offset, valueType) {
  return { name, offset, valueType };
}

function f32Constant(sourceSymbol, numericBits) {
  return {
    sourceSymbol,
    valueType: "f32",
    value: f32FromBits(numericBits),
    numericBits,
  };
}

function f64Constant(sourceSymbol, value, numericBits) {
  return { sourceSymbol, valueType: "f64", value, numericBits };
}

function integerConstant(sourceSymbol, valueType, value) {
  return { sourceSymbol, valueType, value };
}

function f32FromBits(bits) {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, Number.parseInt(bits, 16), false);
  return view.getFloat32(0, false);
}

function fail(boundary, message, detail = {}) {
  throw new CssoccerUnsupportedOfficialStateError(boundary, message, detail);
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
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

if (CSSOCCER_NATIVE_FIELD_CONTRACT.fields.some(({ id }) => id.startsWith("officials."))) {
  throw new Error("Native official fields now exist; requalify this source-derived reducer.");
}

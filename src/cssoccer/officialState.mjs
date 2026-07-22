import {
  CSSOCCER_NATIVE_FIELD_CONTRACT,
  CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
} from "./nativeFieldContract.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  assertCssoccerNativeGameplayProfile,
} from "./nativeGameplayProfile.mjs";

const F32 = Math.fround;
const FIXTURE_ID = "spain-argentina-full-match";

export const CSSOCCER_OFFICIAL_STATE_SCHEMA =
  "cssoccer-official-state@1";

export const CSSOCCER_OFFICIAL_PARENT_TRANSITION = deepFreeze({
  centre: "init-centre",
  corner: "init-corner",
  goalKick: "init-goal-kick",
  throwIn: "init-throw-in",
  freeKick: "init-free-kick",
  penalty: "init-penalty",
  setKickReady: "set-kick-ready",
  setKickReleased: "set-kick-released",
});

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
    trotB: f32Constant("MC_TROTB compiled id", "42800000"),
    trotH: f32Constant("MC_TROTH compiled id", "42820000"),
    trotG: f32Constant("MC_TROTG compiled id", "42840000"),
    trotC: f32Constant("MC_TROTC compiled id", "42860000"),
    trotD: f32Constant("MC_TROTD compiled id", "42880000"),
    trotF: f32Constant("MC_TROTF compiled id", "428a0000"),
    trotA: f32Constant("MC_TROTA compiled id", "428c0000"),
    trotE: f32Constant("MC_TROTE compiled id", "428e0000"),
    run: f32Constant("MC_RUN compiled id", "42900000"),
    jog: f32Constant("MC_JOG compiled id", "42920000"),
    stand: f32Constant("MC_STAND compiled id", "429c0000"),
    plead: f32Constant("MC_PLEAD compiled id", "429c0000"),
  },
  frameSteps: {
    trot: f32Constant("MC_TROTA_FS compiled store", "3d800000"),
    run: f32Constant("MC_RUN_FS compiled store", "3d9d89d9"),
    jog: f32Constant("MC_JOG_FS compiled store", "3d8d3dcb"),
    stand: f32Constant("MC_STAND_FS compiled store", "3d520d21"),
    plead: f32Constant("MC_PLEAD_FS compiled store", "3c800000"),
  },
  thinking: {
    accuracyBase: integerConstant("offc_thinking accuracy base", "i32", 129),
    accuracyDivisor: integerConstant("offc_thinking accuracy divisor", "i32", 4),
    periodIncrement: integerConstant("offc_thinking period increment", "i32", 1),
    stoppageDelayBase: integerConstant("lman_follow stoppage delay base", "i32", 12),
  },
  assistantFollow: {
    defenseScale: f64Constant(
      "lman_follow defense interpolation divisor",
      1.25,
      "3ff4000000000000",
    ),
    tolerance: f64Constant("lman_follow x tolerance", 2, "4000000000000000"),
    storedStep: f32Constant("lman_follow x store step", "40000000"),
  },
  followPlay: {
    facingDistance: f64Constant(
      "follow_play ball-facing comparison",
      0.2,
      "3fc999999999999a",
    ),
    targetScale: f64Constant(
      "follow_play centre-to-ball target scale",
      0.5,
      "3fe0000000000000",
    ),
    teamOffsetMultiplier: integerConstant("follow_play last-touch offset", "i32", 10),
    moveDistanceMultiplier: integerConstant("follow_play movement threshold", "i32", 2),
    keepAwayDistanceMultiplier: integerConstant("follow_play keep-away threshold", "i32", 10),
    keepAwayNumerator: integerConstant("follow_play keep-away numerator", "i32", 50),
    storedStep: f32Constant("follow_play movement step", "400ccccd"),
  },
  matchModes: {
    normal: integerConstant("normal play match_mode", "u8", 0),
    penaltyA: integerConstant("PEN_KICK_A", "u8", 17),
    penaltyB: integerConstant("PEN_KICK_B", "u8", 18),
    swapEnds: integerConstant("SWAP_ENDS", "u8", 19),
  },
  playerActions: {
    throw: integerConstant("THROW_ACT", "i16", 11),
  },
  initialization: {
    preKickoffAnimationTicks: integerConstant(
      "FOOTBALL.CPP LINE_UP_DELAY + 40 compiled countdown",
      "i32",
      180,
    ),
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
      "init_corner",
      "init_gkick",
      "init_throw",
      "init_fkick",
      "init_dfkick",
      "init_penalty",
      "await_set_kick",
      "ready_set_kick",
      "offc_thinking",
      "init_ref_stand",
      "init_ref_run",
      "init_ref_jog",
      "init_rtrot_anim",
      "init_refs_anim",
      "lman_follow",
      "await_kicker",
      "goto_target",
      "at_target",
      "follow_play",
      "process_ref",
      "process_lman",
      "anim_officials",
      "process_offs",
    ],
  },
  {
    file: "DATA.H",
    sha256: "7dba31d4e9af11b4c7686faa1bf75802142579db99bd41b23d5bfcd065f0bb99",
    producers: ["official animation ids and source frame counts"],
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

export const CSSOCCER_OFFICIAL_PRODUCER_CONTRACT = deepFreeze({
  schema: "cssoccer-official-producer-contract@1",
  parentTransitions: [
    parentTransition("init_centre", ["refs[0].act", "refs[0].target", "refs[0].goto_x", "refs[0].goto_y"]),
    parentTransition("init_corner", ["refs[0].act", "refs[0].target", "refs[0].goto_x", "refs[0].goto_y"]),
    parentTransition("init_gkick", ["refs[0].act", "refs[0].target", "refs[0].goto_x", "refs[0].goto_y"]),
    parentTransition("init_throw", ["refs[1..2].act", "refs[1..2].goto_x", "refs[1..2].goto_y"]),
    parentTransition("init_fkick/init_dfkick", ["refs[0].act", "refs[0].target", "refs[0].goto_x", "refs[0].goto_y"]),
    parentTransition("init_penalty", ["refs[0].act", "refs[0].target", "refs[0].goto_x", "refs[0].goto_y"]),
    parentTransition("await_set_kick", ["refs[0].act"]),
    parentTransition("ready_set_kick", ["refs[0].act"]),
  ],
  processOrder: [
    "process_ref(refs[0])",
    "process_lman(refs[1])",
    "process_lman(refs[2])",
    "anim_officials(refs[0])",
    "anim_officials(refs[1])",
    "anim_officials(refs[2])",
  ],
  functions: [
    producer("offc_thinking", "object 1:0x50812", [
      "logic_cnt", "ref_accuracy",
    ], [], []),
    producer("init_ref_stand", "object 1:0x50884", [
      "refs[].anim",
    ], ["refs[].anim", "refs[].newanim", "refs[].frm", "refs[].fstep"], []),
    producer("init_ref_run", "object 1:0x508ef", [
      "refs[].anim",
    ], ["refs[].anim", "refs[].newanim", "refs[].frm", "refs[].fstep"], []),
    producer("init_ref_jog", "object 1:0x5099c", [
      "refs[].anim",
    ], ["refs[].anim", "refs[].newanim", "refs[].frm", "refs[].fstep"], []),
    producer("init_rtrot_anim", "object 1:0x50a49", [
      "refs[].x", "refs[].y", "refs[].dir_x", "refs[].dir_y",
      "refs[].goto_x", "refs[].goto_y",
    ], ["refs[].anim", "refs[].newanim", "refs[].frm", "refs[].fstep"], [
      "calc_dist", "get_dir",
    ]),
    producer("init_refs_anim", "object 1:0x50bff", [
      "requested animation", "refs[].anim",
    ], ["refs[].anim", "refs[].newanim", "refs[].frm", "refs[].fstep"], [
      "init_ref_stand", "init_ref_run", "init_ref_jog", "init_rtrot_anim",
    ]),
    producer("lman_follow", "object 1:0x50c70", [
      "match_mode", "ref_accuracy", "ballx", "bally", "defense_a", "defense_b",
      "pitch_wid", "cntspot_x", "cntspot_y", "refs[].x", "refs[].y", "refs[].go",
      "refs[].anim",
    ], [
      "refs[].x", "refs[].dir_x", "refs[].dir_y", "refs[].goto_x", "refs[].go",
      "refs[].anim", "refs[].newanim", "refs[].frm", "refs[].fstep",
    ], ["init_refs_anim"]),
    producer("await_kicker", "object 1:0x50fb0", [
      "match_mode", "ktaker", "teams[].tm_act", "ref_wait", "practice",
    ], ["refs[0].act", "ref_wait", "match_mode"], [
      "init_refs_anim", "init_match_mode", "init_stand_act", "holder_lose_ball",
    ]),
    producer("goto_target", "object 1:0x510e4", [
      "refs[].x", "refs[].y", "refs[].goto_x", "refs[].goto_y",
    ], [
      "refs[].x", "refs[].y", "refs[].dir_x", "refs[].dir_y", "refs[].act",
      "refs[].anim", "refs[].newanim", "refs[].frm", "refs[].fstep",
    ], ["calc_dist", "init_refs_anim"]),
    producer("at_target", "object 1:0x511e1", [
      "ballx", "bally", "teams[].tm_x", "refs[].x", "refs[].y", "refs[].dir_x",
      "refs[].dir_y", "refs[].target",
    ], ["refs[].dir_x", "refs[].dir_y", "refs[].act"], ["calc_dist"]),
    producer("follow_play", "object 1:0x513cc", [
      "match_mode", "ballx", "bally", "last_touch", "dead_ball_cnt", "prat",
      "cntspot_x", "cntspot_y", "refs[0].x", "refs[0].y", "refs[0].dir_x",
      "refs[0].dir_y",
    ], [
      "refs[0].x", "refs[0].y", "refs[0].dir_x", "refs[0].dir_y",
      "refs[0].goto_x", "refs[0].goto_y", "refs[0].anim", "refs[0].newanim",
      "refs[0].frm", "refs[0].fstep",
    ], ["calc_dist", "init_refs_anim"]),
    producer("process_ref", "object 1:0x516c6", [
      "match_mode", "refs[0].act",
    ], ["refs[0]"], ["follow_play", "goto_target", "await_kicker", "at_target"]),
    producer("process_lman", "object 1:0x51768", [
      "refs[].act",
    ], ["refs[]"], ["lman_follow", "goto_target"]),
    producer("anim_officials", "object 1:0x517b3", [
      "refs[].frm", "refs[].fstep",
    ], ["refs[].frm"], []),
    producer("process_offs", "object 1:0x517dc", [
      "refs[0]", "refs[1]", "refs[2]",
    ], ["refs[0]", "refs[1]", "refs[2]"], ["process_ref", "process_lman", "anim_officials"]),
  ],
  globals: [
    globalBinding("refs", "officials[3]", "object 3:0x40dc8"),
    globalBinding("teams", "match_player[22]", "object 3:0x3fc4c"),
    globalBinding("cntspot_x", "i32", "object 3:0x0de54"),
    globalBinding("cntspot_y", "i32", "object 3:0x0de58"),
    globalBinding("pitch_wid", "i32", "object 3:0x0de64"),
    globalBinding("prat", "f32", "object 3:0x0de80"),
    globalBinding("logic_cnt", "i32", "object 3:0x41030"),
    globalBinding("last_touch", "i32", "object 3:0x4111c"),
    globalBinding("ktaker", "i32", "object 3:0x41264"),
    globalBinding("ref_accuracy", "i32", "object 3:0x41330"),
    globalBinding("ref_wait", "i32", "object 3:0x41338"),
    globalBinding("ballx", "f32", "object 3:0x41518"),
    globalBinding("bally", "f32", "object 3:0x4151c"),
    globalBinding("match_mode", "u8", "object 3:0x415c0"),
    globalBinding("dead_ball_cnt", "i32", "object 3:0x415c4"),
    globalBinding("defense_a", "i32", "object 3:0x415c8"),
    globalBinding("defense_b", "i32", "object 3:0x415cc"),
    globalBinding("practice", "u8", "object 3:0x41aac"),
  ],
  helpers: [
    { sourceName: "get_dir(float,float)", compiledAddress: "object 1:0x3cb66" },
    { sourceName: "calc_dist(float,float)", compiledAddress: "object 1:0x44cd4" },
  ],
  parentOwnedSideEffects: {
    producer: "await_kicker",
    reason: "The current match-rules/restart reducers remain authoritative.",
    stores: [
      "ref_wait decrement/timeout",
      "match_mode throw turnover",
      "taker stand action",
      "holder ball release",
    ],
  },
});

export const CSSOCCER_OFFICIAL_SOURCE = deepFreeze({
  classification: "source-derived-complete-native-refs-captured",
  files: SOURCE_FILES,
  compiledEvidence: {
    testExeSha256:
      "760d752bd5cf967d30295578a8c4e1b9118f93d83ceaacedc70a79f8166bd63e",
    refs: "object 3:0x40dc8",
    initOfficials: "object 1:0x1fddb",
    initCentre: "object 1:0x4cd93",
    offcThinking: "object 1:0x50812",
    initRefStand: "object 1:0x50884",
    initRefRun: "object 1:0x508ef",
    initRefJog: "object 1:0x5099c",
    initRtrotAnim: "object 1:0x50a49",
    initRefsAnim: "object 1:0x50bff",
    lmanFollow: "object 1:0x50c70",
    awaitKicker: "object 1:0x50fb0",
    gotoTarget: "object 1:0x510e4",
    atTarget: "object 1:0x511e1",
    followPlay: "object 1:0x513cc",
    processRef: "object 1:0x516c6",
    processLinesman: "object 1:0x51768",
    animateOfficial: "object 1:0x517b3",
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
      "Each process_offs step clears consumed newanim, runs all three official producers in source order, then advances all three f32 frames once.",
  },
  producerContract: CSSOCCER_OFFICIAL_PRODUCER_CONTRACT,
  nativeQualification: {
    fieldContractSha256: CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
    capturedRefs: true,
    exactParityClaim: false,
    reason: "The accepted 454-field native contract captures every refs[0..2] member; exact frontier publication remains pending.",
  },
  implemented: [
    "init_officials and both centre owners",
    "process_ref actions 0 through 4",
    "process_lman actions 0 and 1",
    "open-play following and defensive-line assistants",
    "wait-for-kick release observation without stealing parent rule stores",
    "directional trot, stand, run, jog, turning, and f32 animation cadence",
    "SWAP_ENDS standing behavior and rematch initialization",
  ],
  pendingQualification: ["complete refs[] exact frontier publication"],
});

const BINDINGS = deepFreeze({
  evidenceClass: CSSOCCER_OFFICIAL_SOURCE.classification,
  nativeExactParity: false,
  nativeRefsCaptured: true,
  nativeFieldContractSha256: CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
  nativeGameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  nativeBuildSha256:
    "cd06f847e2376951791a68a57fed3c38a13496e801c3dc66e98aa1d9abf9c544",
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
const FRAME_KEYS = Object.freeze([
  "ball",
  "deadBallCount",
  "kickTaker",
  "lastTouch",
  "matchMode",
  "players",
  "refereeAccuracy",
  "tick",
]);
const FRAME_PLAYER_KEYS = Object.freeze([
  "action",
  "active",
  "id",
  "nativePlayerNumber",
  "position",
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

/** Apply source init_officials, init_centre, and the source line-up cadence. */
export function createCssoccerOfficialState(input = {}) {
  requirePlainObject(input, "official input");
  requireExactKeys(input, ["centreOwner", "nativeGameplayProfile"], "official input");
  const profile = assertCssoccerNativeGameplayProfile(input.nativeGameplayProfile);
  const centreOwner = requireCentreOwner(input.centreOwner);
  requireBoundProfile(profile);
  const officials = initialOfficials(centreOwner, profile.constants.prat.value);
  for (
    let index = 0;
    index < CSSOCCER_OFFICIAL_CONSTANTS.initialization.preKickoffAnimationTicks.value;
    index += 1
  ) {
    for (const official of officials) advanceAnimationFrame(official);
  }
  for (const official of officials) official.animation.newAnimation = 0;
  return assemble({ centreOwner, officials, tick: 0 });
}

/** Advance exactly one complete RULES.CPP process_offs invocation. */
export function stepCssoccerOfficialState(state, input = {}) {
  const current = assertCssoccerOfficialState(state);
  const frame = requireOfficialFrame(input, current.tick + 1);
  const officials = current.officials.map((official) => clone(official));
  for (const official of officials) official.animation.newAnimation = 0;

  processReferee(officials[0], frame);
  processAssistant(officials[1], frame);
  processAssistant(officials[2], frame);
  for (const official of officials) advanceAnimationFrame(official);

  return assemble({
    centreOwner: current.centreOwner,
    officials,
    tick: frame.tick,
  });
}

/** Apply the RULES.CPP parent stores that surround process_offs. */
export function applyCssoccerOfficialParentTransition(state, input = {}) {
  const current = assertCssoccerOfficialState(state);
  requirePlainObject(input, "official parent transition");
  requireExactKeys(
    input,
    ["ball", "centreOwner", "kind"],
    "official parent transition",
  );
  requireF32Point2(input.ball, "official parent transition ball");
  const kinds = Object.values(CSSOCCER_OFFICIAL_PARENT_TRANSITION);
  if (!kinds.includes(input.kind)) {
    throw new Error(`Unsupported official parent transition ${String(input.kind)}.`);
  }
  if (
    input.centreOwner !== null
    && input.centreOwner !== "A"
    && input.centreOwner !== "B"
  ) {
    throw new Error("Official parent transition centreOwner must be A, B, or null.");
  }
  if (
    (input.kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.centre)
    !== (input.centreOwner !== null)
  ) {
    throw new Error("Only init-centre accepts one bound centre owner.");
  }

  const officials = current.officials.map((official) => clone(official));
  const referee = officials[0];
  const { centreX, centreY } = CSSOCCER_OFFICIAL_CONSTANTS.pitch;
  const prat = CSSOCCER_OFFICIAL_CONSTANTS.prat.value;
  if (input.kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.centre) {
    const direction = input.centreOwner === "A" ? 1 : -1;
    referee.goto.x = F32(
      centreX.value
        + (direction * prat * CSSOCCER_OFFICIAL_CONSTANTS.centreOffsetMultiplier.value),
    );
    referee.goto.y = F32(centreY.value);
    referee.target = 0;
    referee.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value;
  } else if (
    input.kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.corner
    || input.kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.goalKick
  ) {
    referee.goto.x = F32(centreX.value + ((input.ball.x - centreX.value) / 2));
    referee.goto.y = F32(centreY.value + ((input.ball.y - centreY.value) / 2));
    referee.target = 0;
    referee.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value;
  } else if (input.kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.throwIn) {
    const assistant = input.ball.y > centreY.value ? officials[2] : officials[1];
    const threshold = prat * 4;
    assistant.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value;
    assistant.goto.y = assistant.position.y;
    if (assistant.position.x > input.ball.x + threshold) {
      assistant.goto.x = F32(input.ball.x + threshold);
    } else if (assistant.position.x < input.ball.x - threshold) {
      assistant.goto.x = F32(input.ball.x - threshold);
    } else {
      assistant.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.normal.value;
    }
  } else if (input.kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.freeKick) {
    const rx = F32(referee.position.x - input.ball.x);
    const ry = F32(referee.position.y - input.ball.y);
    const distance = sourceDistance(rx, ry);
    const besideBall = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.kickoff.besideBall.value;
    referee.goto.x = F32(input.ball.x + ((rx * besideBall * 16) / distance));
    referee.goto.y = F32(input.ball.y + ((ry * besideBall * 16) / distance));
    referee.target = 0;
    referee.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value;
  } else if (input.kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.penalty) {
    referee.goto.x = input.ball.x;
    referee.goto.y = F32(centreY.value - (prat * 10));
    referee.target = 0;
    referee.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value;
  } else if (input.kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.setKickReady) {
    if (referee.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value) {
      referee.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.waitForKick.value;
    }
  } else if (input.kind === CSSOCCER_OFFICIAL_PARENT_TRANSITION.setKickReleased) {
    referee.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.normal.value;
  }

  return assemble({
    centreOwner: input.centreOwner ?? current.centreOwner,
    officials,
    tick: current.tick,
  });
}

export function projectCssoccerRefereeAction(state) {
  return assertCssoccerOfficialState(state).officials[0].action;
}

export function projectCssoccerOfficialNativeFields(state) {
  const current = assertCssoccerOfficialState(state);
  const fields = current.officials.flatMap((official) => {
    const prefix = `officials.${official.id}`;
    return [
      typedField(`${prefix}.action`, "i32", official.action),
      typedField(`${prefix}.animation`, "f32", official.animation.id),
      typedField(`${prefix}.animation_frame`, "f32", official.animation.frame),
      typedField(`${prefix}.animation_frame_step`, "f32", official.animation.frameStep),
      typedField(`${prefix}.direction_x`, "f32", official.facing.x),
      typedField(`${prefix}.direction_y`, "f32", official.facing.y),
      typedField(`${prefix}.go`, "i32", official.go),
      typedField(`${prefix}.goto_x`, "f32", official.goto.x),
      typedField(`${prefix}.goto_y`, "f32", official.goto.y),
      typedField(`${prefix}.new_animation`, "u8", official.animation.newAnimation),
      typedField(`${prefix}.target`, "i16", official.target),
      typedField(`${prefix}.x`, "f32", official.position.x),
      typedField(`${prefix}.y`, "f32", official.position.y),
      typedField(`${prefix}.z`, "f32", official.position.z),
    ];
  });
  fields.sort((left, right) => left.fieldId.localeCompare(right.fieldId));
  return deepFreeze(fields);
}

export function assertCssoccerOfficialState(state) {
  requirePlainObject(state, "official state");
  requireExactKeys(state, STATE_KEYS, "official state");
  if (
    state.schema !== CSSOCCER_OFFICIAL_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || state.phase !== "match-officials"
    || !Number.isSafeInteger(state.tick)
    || state.tick < 0
  ) {
    throw new Error(`Official state must use ${CSSOCCER_OFFICIAL_STATE_SCHEMA}.`);
  }
  requireCentreOwner(state.centreOwner);
  requireBindings(state.bindings);
  if (!Array.isArray(state.officials) || state.officials.length !== 3) {
    throw new Error("Official state must retain exactly refs[0..2].");
  }
  state.officials.forEach((official, index) => requireOfficial(official, index));

  const referee = state.officials[0];
  const supportedActions = Object.values(CSSOCCER_OFFICIAL_CONSTANTS.actions)
    .map(({ value }) => value);
  if (!supportedActions.includes(referee.action)) {
    fail(
      "referee-action",
      `Referee action ${referee.action} is outside process_ref.`,
      { action: referee.action, supportedActions },
    );
  }
  const expectedStatus = statusForAction(referee.action);
  if (state.status !== expectedStatus) {
    throw new Error("Official status diverged from referee action.");
  }
  for (const assistant of state.officials.slice(1)) {
    if (![0, 1, 3].includes(assistant.action)) {
      fail("assistant-action", `${assistant.id} action ${assistant.action} is outside process_lman.`);
    }
  }
  return state;
}

function assemble({ centreOwner, officials, tick }) {
  const state = deepFreeze({
    schema: CSSOCCER_OFFICIAL_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    tick,
    phase: "match-officials",
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

function atTarget(official, frame) {
  const target = official.target === 0
    ? frame.ball
    : playerTarget(frame.players, official.target);
  let x = F32(target.x - official.position.x);
  // RULES.CPP uses tm_x for both player-target axes; preserve that source store.
  let y = F32(target.y - official.position.y);
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

function processReferee(referee, frame) {
  if (frame.matchMode === CSSOCCER_OFFICIAL_CONSTANTS.matchModes.swapEnds.value) {
    initializeStand(referee);
    return;
  }
  if (referee.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.normal.value) {
    Object.assign(referee, clone(followPlay(referee, frame)));
  } else if (referee.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value) {
    Object.assign(referee, clone(gotoTarget(referee)));
  } else if (referee.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.waitForKick.value) {
    awaitKicker(referee, frame);
  } else if (
    referee.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.turning.value
    || referee.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value
  ) {
    Object.assign(referee, clone(atTarget(referee, frame)));
  } else {
    fail("referee-action", `Referee action ${referee.action} is outside process_ref.`);
  }
}

function processAssistant(assistant, frame) {
  if (assistant.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.normal.value) {
    lmanFollow(assistant, frame);
  } else if (assistant.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value) {
    Object.assign(assistant, clone(gotoTarget(assistant)));
  } else if (assistant.action === CSSOCCER_OFFICIAL_CONSTANTS.actions.turning.value) {
    // RULES.CPP process_lman has no case 3; the assistant remains at the incident.
  } else {
    fail("assistant-action", `${assistant.id} action ${assistant.action} is outside process_lman.`);
  }
}

function lmanFollow(assistant, frame) {
  if (frame.matchMode !== CSSOCCER_OFFICIAL_CONSTANTS.matchModes.normal.value) {
    initializeStand(assistant);
    assistant.go = 12 + Math.trunc((129 - frame.refereeAccuracy) / 4);
    return;
  }
  if (assistant.go > 0) {
    assistant.go -= 1;
    return;
  }

  const defense = defensiveLines(frame.players);
  const { centreX, centreY, width } = CSSOCCER_OFFICIAL_CONSTANTS.pitch;
  if (assistant.position.y < centreY.value) {
    assistant.facing.x = F32(0);
    assistant.facing.y = F32(1);
    const interpolation = frame.ball.x > centreX.value
      ? F32(((frame.ball.x - defense.teamA) / 1.25)
        * (width.value - frame.ball.y) / width.value)
      : F32(0);
    moveAssistant(
      assistant,
      F32(defense.teamA + interpolation),
      CSSOCCER_OFFICIAL_CONSTANTS.animations.trotG.value,
      CSSOCCER_OFFICIAL_CONSTANTS.animations.trotC.value,
      frame.refereeAccuracy,
    );
  } else {
    assistant.facing.x = F32(0);
    assistant.facing.y = F32(-1);
    const interpolation = frame.ball.x < centreX.value
      ? F32(((defense.teamB - frame.ball.x) / 1.25)
        * frame.ball.y / width.value)
      : F32(0);
    moveAssistant(
      assistant,
      F32(defense.teamB + interpolation),
      CSSOCCER_OFFICIAL_CONSTANTS.animations.trotC.value,
      CSSOCCER_OFFICIAL_CONSTANTS.animations.trotG.value,
      frame.refereeAccuracy,
    );
  }
}

function moveAssistant(assistant, targetX, positiveAnimation, negativeAnimation, accuracy) {
  if (targetX - 2 > assistant.position.x) {
    assistant.goto.x = F32(assistant.position.x + 2);
    if (assistant.animation.id !== positiveAnimation) initializeTrot(assistant);
    assistant.position.x = assistant.goto.x;
  } else if (targetX + 2 < assistant.position.x) {
    assistant.goto.x = F32(assistant.position.x - 2);
    if (assistant.animation.id !== negativeAnimation) initializeTrot(assistant);
    assistant.position.x = assistant.goto.x;
  } else {
    initializeStand(assistant);
    assistant.go = 12 + Math.trunc((129 - accuracy) / 4);
  }
}

function awaitKicker(referee, frame) {
  initializeStand(referee);
  if (frame.kickTaker === 0) {
    fail("wait-for-kick", "process_ref action 2 requires a current native kick taker.");
  }
  const taker = frame.players[frame.kickTaker - 1];
  if (
    frame.matchMode === CSSOCCER_OFFICIAL_CONSTANTS.matchModes.normal.value
    && taker.action !== CSSOCCER_OFFICIAL_CONSTANTS.playerActions.throw.value
  ) {
    referee.action = CSSOCCER_OFFICIAL_CONSTANTS.actions.normal.value;
  }
}

function followPlay(referee, frame) {
  const next = clone(referee);
  if (frame.matchMode !== CSSOCCER_OFFICIAL_CONSTANTS.matchModes.normal.value) {
    return deepFreeze(next);
  }
  let x = F32(frame.ball.x - next.position.x);
  let y = F32(frame.ball.y - next.position.y);
  let ballDistance = sourceDistance(x, y);
  if (ballDistance > CSSOCCER_OFFICIAL_CONSTANTS.followPlay.facingDistance.value) {
    next.facing.x = F32(x / ballDistance);
    next.facing.y = F32(y / ballDistance);
  }

  const { centreX, centreY } = CSSOCCER_OFFICIAL_CONSTANTS.pitch;
  const prat = CSSOCCER_OFFICIAL_CONSTANTS.prat.value;
  let tx = F32(
    centreX.value
      + ((frame.ball.x - centreX.value) * 0.5)
      + (frame.lastTouch < 12 ? prat * 10 : prat * -10),
  );
  let ty = F32(centreY.value + ((frame.ball.y - centreY.value) * 0.5));
  tx = F32(tx - next.position.x);
  ty = F32(ty - next.position.y);
  let distance = sourceDistance(tx, ty);
  if (distance > prat * 2) {
    if (ballDistance > 0.2 && ballDistance < prat * 10 && frame.deadBallCount === 0) {
      tx = F32(tx - ((x * 50) / ballDistance));
      ty = F32(ty - ((y * 50) / ballDistance));
      distance = sourceDistance(tx, ty);
    }
    if (distance > prat * 2) {
      next.goto.x = F32(next.position.x + tx);
      next.goto.y = F32(next.position.y + ty);
      tx = F32(tx / distance);
      ty = F32(ty / distance);
      initializeTrot(next);
      const speed = CSSOCCER_OFFICIAL_CONSTANTS.followPlay.storedStep.value;
      next.position.x = F32(next.position.x + (tx * speed));
      next.position.y = F32(next.position.y + (ty * speed));
    } else {
      initializeStand(next);
    }
  } else {
    initializeStand(next);
  }
  return deepFreeze(next);
}

function initializeJog(official) {
  const { jog } = CSSOCCER_OFFICIAL_CONSTANTS.animations;
  if (Math.abs(official.animation.id) === CSSOCCER_OFFICIAL_CONSTANTS.animations.run.value) {
    official.animation.id = jog.value;
    official.animation.frameStep = CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.jog.value;
  } else if (Math.abs(official.animation.id) !== jog.value) {
    official.animation = {
      id: jog.value,
      frame: F32(0),
      frameStep: CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.jog.value,
      newAnimation: 1,
    };
  }
}

function initializeRun(official) {
  const { run, jog } = CSSOCCER_OFFICIAL_CONSTANTS.animations;
  if (Math.abs(official.animation.id) === jog.value) {
    official.animation.id = run.value;
    official.animation.frameStep = CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.run.value;
  } else if (Math.abs(official.animation.id) !== run.value) {
    official.animation = {
      id: run.value,
      frame: F32(0),
      frameStep: CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.run.value,
      newAnimation: 1,
    };
  }
}

function initializeTrot(official) {
  let x = F32(official.goto.x - official.position.x);
  let y = F32(official.goto.y - official.position.y);
  const distance = sourceDistance(x, y);
  official.animation.frameStep = CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.trot.value;
  x = F32(x / distance);
  y = F32(y / distance);
  const nx = F32((x * official.facing.x) + (y * official.facing.y));
  const ny = F32((y * official.facing.x) - (x * official.facing.y));
  if (
    official.animation.id < CSSOCCER_OFFICIAL_CONSTANTS.animations.trotB.value
    || official.animation.id > CSSOCCER_OFFICIAL_CONSTANTS.animations.trotE.value
  ) {
    official.animation.frame = F32(0);
    official.animation.newAnimation = 1;
  }
  const byDirection = [
    CSSOCCER_OFFICIAL_CONSTANTS.animations.trotE.value,
    CSSOCCER_OFFICIAL_CONSTANTS.animations.trotD.value,
    CSSOCCER_OFFICIAL_CONSTANTS.animations.trotC.value,
    CSSOCCER_OFFICIAL_CONSTANTS.animations.trotB.value,
    CSSOCCER_OFFICIAL_CONSTANTS.animations.trotA.value,
    CSSOCCER_OFFICIAL_CONSTANTS.animations.trotH.value,
    CSSOCCER_OFFICIAL_CONSTANTS.animations.trotG.value,
    CSSOCCER_OFFICIAL_CONSTANTS.animations.trotF.value,
  ];
  official.animation.id = byDirection[sourceDirection(nx, ny)];
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

function advanceAnimationFrame(official) {
  official.animation.frame = F32(
    official.animation.frame + official.animation.frameStep,
  );
}

function sourceDistance(x, y) {
  const result = F32(Math.sqrt((x * x) + (y * y)));
  return result > 0.1
    ? result
    : CSSOCCER_OFFICIAL_CONSTANTS.movement.distanceFloor.value;
}

function sourceDirection(x, y) {
  if (y >= 0) {
    if (x >= 0) {
      if (x > y) return x > y * 2 ? 4 : 3;
      return y > x * 2 ? 2 : 3;
    }
    if (-x > y) return -x > y * 2 ? 0 : 1;
    return y > -x * 2 ? 2 : 1;
  }
  if (x >= 0) {
    if (x > -y) return x > -y * 2 ? 4 : 5;
    return -y > x * 2 ? 6 : 5;
  }
  if (-x > -y) return -x > -y * 2 ? 0 : 7;
  return -y > -x * 2 ? 6 : 7;
}

function defensiveLines(players) {
  let teamA = CSSOCCER_OFFICIAL_CONSTANTS.pitch.centreX.value;
  let teamB = CSSOCCER_OFFICIAL_CONSTANTS.pitch.centreX.value;
  for (let index = 0; index < players.length; index += 1) {
    const player = players[index];
    if (player.active <= 0) continue;
    if (index < 11) {
      if (index !== 0 && player.position.x < teamA) teamA = player.position.x;
    } else if (index !== 11 && player.position.x > teamB) {
      teamB = player.position.x;
    }
  }
  return { teamA, teamB };
}

function playerTarget(players, nativePlayerNumber) {
  const player = players[nativePlayerNumber - 1];
  if (player === undefined) {
    fail("player-target", `Official target ${nativePlayerNumber} is outside teams[22].`);
  }
  return { x: player.position.x, y: player.position.x };
}

function requireOfficialFrame(value, expectedTick) {
  requirePlainObject(value, "official frame input");
  requireExactKeys(value, FRAME_KEYS, "official frame input");
  if (value.tick !== expectedTick || !Number.isSafeInteger(value.tick)) {
    throw new Error(`Official frame must advance contiguously to tick ${expectedTick}.`);
  }
  requireF32Point2(value.ball, "official frame ball");
  requireInteger(value.matchMode, 0, 0xff, "official frame matchMode");
  requireI32(value.lastTouch, "official frame lastTouch");
  requireI32(value.deadBallCount, "official frame deadBallCount");
  requireInteger(value.refereeAccuracy, 0, 0xff, "official frame refereeAccuracy");
  requireInteger(value.kickTaker, 0, 22, "official frame kickTaker");
  if (!Array.isArray(value.players) || value.players.length !== 22) {
    throw new Error("Official frame must retain all 22 native players.");
  }
  value.players.forEach((player, index) => {
    requirePlainObject(player, `official frame player ${index + 1}`);
    requireExactKeys(player, FRAME_PLAYER_KEYS, `official frame player ${index + 1}`);
    if (
      player.nativePlayerNumber !== index + 1
      || typeof player.id !== "string"
      || player.id.length === 0
    ) {
      throw new Error(`Official frame player ${index + 1} lost native identity/order.`);
    }
    requireInteger(player.active, -0x8000, 0x7fff, `${player.id} active`);
    requireInteger(player.action, -0x8000, 0x7fff, `${player.id} action`);
    requireF32Point2(player.position, `${player.id} position`);
  });
  return value;
}

function typedField(fieldId, valueType, value) {
  return {
    fieldId,
    valueType,
    value,
    numericBits: numericBits(valueType, value),
  };
}

function numericBits(valueType, value) {
  if (valueType === "u8") return value.toString(16).padStart(2, "0");
  const byteLength = valueType === "i16" ? 2 : 4;
  const bytes = new Uint8Array(byteLength);
  const view = new DataView(bytes.buffer);
  if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else if (valueType === "f32") view.setFloat32(0, value, false);
  else throw new Error(`Unsupported official projection type ${valueType}.`);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
    throw new Error("Official source/build/native-field bindings changed.");
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
  if (action === CSSOCCER_OFFICIAL_CONSTANTS.actions.normal.value) {
    return "following-play";
  }
  if (action === CSSOCCER_OFFICIAL_CONSTANTS.actions.positioning.value) {
    return "positioning";
  }
  if (action === CSSOCCER_OFFICIAL_CONSTANTS.actions.waitForKick.value) {
    return "waiting-for-kick";
  }
  if (action === CSSOCCER_OFFICIAL_CONSTANTS.actions.turning.value) {
    return "turning";
  }
  if (action === CSSOCCER_OFFICIAL_CONSTANTS.actions.ready.value) {
    return "ready";
  }
  fail("referee-action", `Referee action ${action} has no process_ref status.`, { action });
}

function requireCentreOwner(value) {
  if (value !== "A" && value !== "B") {
    throw new Error("Official centreOwner must be native team slot A or B.");
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

function producer(sourceName, compiledAddress, reads, writes, calls) {
  return { sourceName, compiledAddress, reads, writes, calls };
}

function parentTransition(sourceName, writes) {
  return { sourceName, writes };
}

function globalBinding(sourceName, valueType, compiledAddress) {
  return { sourceName, valueType, compiledAddress };
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

if (CSSOCCER_NATIVE_FIELD_CONTRACT.fields.filter(({ id }) => id.startsWith("officials.")).length !== 42) {
  throw new Error("Native official fields must capture all 42 refs[0..2] members.");
}

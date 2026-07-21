import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  assertCssoccerNativeFixturePlayerProfile,
} from "./nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  assertCssoccerNativeGameplayProfile,
} from "./nativeGameplayProfile.mjs";
import {
  CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
} from "./centrePassAction.mjs";

const F32 = Math.fround;
const FIXTURE_ID = "spain-argentina-full-match";
const PLAYER_COUNT = 22;
const BASELINE_TICK = 11;
const QUALIFIED_THROUGH_TICK = 230;
const STAND_ACTION = 0;
const RUN_ACTION = 1;
const FALL_ACTION = 5;
const STEAL_ACTION = 14;
const KICK_ACTION = 15;
const STOP_ACTION = 20;
const CENTRE_PASS_ANIMATION = CSSOCCER_CENTRE_PASS_ACTION_PROFILE.animationId;
const CENTRE_PASS_PREPARED_FRAME_COUNT = 33;
const BACKHEEL_RIGHT_ANIMATION = 52;
const BACKHEEL_LEFT_ANIMATION = 53;
const CHIP_RIGHT_ANIMATION = 36;
const CHIP_LEFT_ANIMATION = 37;
const SOCKS_RIGHT_ANIMATION = 62;
const SOCKS_LEFT_ANIMATION = 63;
const BARGE_ANIMATION = 74;
const FALL_RIGHT_ANIMATION = 90;
const GET_UP_FRONT_ANIMATION = 95;
const TROT_A_ANIMATION = 70;
const RUN_ANIMATION = 72;
const STAND_ANIMATION = 78;
const SOCKS_FRAME_COUNT = 68;
const BACKHEEL_FRAME_COUNT = 32;
const CHIP_FRAME_COUNT = 30;
const BARGE_FRAME_COUNT = 27;
const FALL_RIGHT_FRAME_COUNT = 34;
const GET_UP_FRONT_FRAME_COUNT = 87;
const TROT_A_FRAME_COUNT = 32;
const RUN_FRAME_COUNT = 26;
const STAND_FRAME_COUNT = 39;
const RUN_REFERENCE_SPEED = 3.19;
const TROT_A_FRAME_STEP = 1 / (20 * TROT_A_FRAME_COUNT / 40);
const RUN_FRAME_STEP = 1 / (20 * RUN_FRAME_COUNT / 40);
const BARGE_FRAME_STEP = 1 / (20 * BARGE_FRAME_COUNT / 40);
const FALL_RIGHT_FRAME_STEP = F32(1 / (20 * FALL_RIGHT_FRAME_COUNT / 40));
const GET_UP_FRONT_BASE_FRAME_STEP = F32(1 / (20 * GET_UP_FRONT_FRAME_COUNT / 40));
const STAND_FRAME_STEP = F32(1 / (20 * STAND_FRAME_COUNT / 40));
const SOCKS_FRAME_STEP = F32(1 / (20 * SOCKS_FRAME_COUNT / 40));
const BACKHEEL_BASE_FRAME_STEP = F32(1 / (20 * BACKHEEL_FRAME_COUNT / 40));
const BACKHEEL_CONTACT = F32(65 / 97);
const BACKHEEL_PHASE_SCALE = F32(0.8);
const BACKHEEL_MOVEMENT_DISTANCE = 10.14;
const BACKHEEL_TARGET_DISTANCE = F32(100);
const CHIP_BASE_FRAME_STEP = F32(1 / (20 * CHIP_FRAME_COUNT / 40));
const CHIP_CONTACT = F32(40 / 91);
const BACKHEEL_LOCAL_CONTACT_OFFSET = deepFreeze({
  right: {
    x: F32(3.7007970809936523),
    y: F32(2.4974191188812256),
    z: F32(1.7749890089035034),
  },
  left: {
    x: F32(3.7007970809936523),
    y: F32(-2.4974191188812256),
    z: F32(1.7749890089035034),
  },
});
const CHIP_LOCAL_CONTACT_OFFSET = deepFreeze({
  right: {
    x: F32(9.38531494140625),
    y: F32(2.523958921432495),
    z: F32(3.210542917251587),
  },
  left: {
    x: F32(9.38531494140625),
    y: F32(-2.523958921432495),
    z: F32(3.210542917251587),
  },
});
// ACTIONS.OBJ save_offs[animation * 3] is the compiled authority for these
// contact points. rotate_offs negates the stored local y before rotating it.
// Keeping the complete make_pass table here prevents fixture/player branches
// in the live engine when pass_decide selects a different kick direction.
const PASS_KICK_PROFILE_BY_TYPE = deepFreeze({
  [-1]: passKickProfile({
    mode: "phase-foot",
    frameCount: 30,
    contact: 40 / 91,
    leftAnimation: 37,
    rightAnimation: 36,
    offsets: {
      36: [9.38531494140625, 2.523958921432495, 3.210542917251587],
      37: [9.38531494140625, -2.523958921432495, 3.210542917251587],
    },
  }),
  1: passKickProfile({
    mode: "phase-foot",
    frameCount: 32,
    contact: 65 / 97,
    leftAnimation: 53,
    rightAnimation: 52,
    offsets: {
      52: [3.7007970809936523, 2.4974191188812256, 1.7749890089035034],
      53: [3.7007970809936523, -2.4974191188812256, 1.7749890089035034],
    },
  }),
  2: passKickProfile({
    mode: "left",
    frameCount: 33,
    contact: 57 / 100,
    leftAnimation: 49,
    offsets: { 49: [3.405055046081543, -1.8382829427719116, 1.6730740070343018] },
  }),
  3: passKickProfile({
    mode: "left",
    frameCount: 32,
    contact: 46 / 96,
    leftAnimation: 51,
    offsets: { 51: [9.746830940246582, 1.4651540517807007, 1.7421150207519531] },
  }),
  4: passKickProfile({
    mode: "left",
    frameCount: 33,
    contact: 48 / 101,
    leftAnimation: 47,
    offsets: { 47: [8.232559204101562, -3.2525808811187744, 2.2474780082702637] },
  }),
  5: passKickProfile({
    mode: "phase-foot",
    // DATA.H aliases MC_PASSL and MC_TOEL to 39, so init_kick_anim's
    // case(MC_TOEL) selects the compiled 0.7 phase multiplier here.
    phaseScale: 0.7,
    frameCount: 33,
    contact: 48 / 99,
    leftAnimation: 39,
    rightAnimation: 38,
    offsets: {
      38: [9.694164276123047, 5.616666793823242, 1.9474040269851685],
      39: [9.694164276123047, -5.616666793823242, 1.9474040269851685],
    },
  }),
  6: passKickProfile({
    mode: "right",
    frameCount: 33,
    contact: 48 / 101,
    rightAnimation: 46,
    offsets: { 46: [8.232559204101562, 3.2525808811187744, 2.2474780082702637] },
  }),
  7: passKickProfile({
    mode: "right",
    frameCount: 32,
    contact: 46 / 96,
    rightAnimation: 50,
    offsets: { 50: [9.746830940246582, -1.4651540517807007, 1.7421150207519531] },
  }),
  8: passKickProfile({
    mode: "right",
    frameCount: 33,
    contact: 57 / 100,
    rightAnimation: 48,
    offsets: { 48: [3.405055046081543, 1.8382829427719116, 1.6730740070343018] },
  }),
  16: passKickProfile({
    mode: "fixed-left",
    frameCount: 36,
    contact: 42 / 110,
    leftAnimation: 41,
    offsets: { 41: [9.730934143066406, -1.3606940507888794, 1.8029530048370361] },
  }),
  17: passKickProfile({
    mode: "fixed-right",
    frameCount: 36,
    contact: 42 / 110,
    rightAnimation: 40,
    offsets: { 40: [9.730934143066406, 1.3606940507888794, 1.8029530048370361] },
  }),
});
// INTELL.CPP make_shoot shares the directional make_pass table, but its
// straight type -1 branch is the distinct MC_SHOOTL/R initializer. The
// contact rows are the exact immutable ACTIONS.OBJ save_offs initializers.
const SHOT_KICK_PROFILE_BY_TYPE = deepFreeze({
  ...PASS_KICK_PROFILE_BY_TYPE,
  [-1]: passKickProfile({
    mode: "shoot-phase-foot",
    frameCount: 36,
    contact: 38 / 109,
    leftAnimation: 35,
    rightAnimation: 34,
    offsets: {
      34: [7.5185089111328125, 5.521873950958252, 1.78097403049469],
      35: [7.5185089111328125, -5.521873950958252, 1.78097403049469],
    },
  }),
});
const SOCKS_PROBABILITY = 15;
const TROT_ANIMATION_BY_DIRECTION = Object.freeze({
  1: 71,
  2: 68,
  3: 67,
  4: 64,
  5: 70,
  6: 65,
  7: 66,
  8: 69,
});
const TROT_FRAME_COUNT_BY_ANIMATION = Object.freeze({
  64: 27,
  65: 27,
  66: 28,
  67: 28,
  68: 25,
  69: 25,
  70: 32,
  71: 26,
});
const LOCOMOTION_KINDS = new Set([
  "backheel",
  "barge",
  "centre-pass",
  "fall-right",
  "get-up-front",
  "run",
  "run-with-ball",
  "side-step",
  "socks-left",
  "socks-right",
  "stand",
]);
const QUALIFIED_SIDE_STEP_DIRECTIONS = new Set(
  Object.keys(TROT_ANIMATION_BY_DIRECTION).map(Number),
);
const SHA256 = /^[a-f0-9]{64}$/u;

export const CSSOCCER_PLAYER_ANIMATION_STATE_SCHEMA =
  "cssoccer-player-animation-state@1";

export const CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA =
  "cssoccer-player-animation-profile@1";

export const CSSOCCER_PLAYER_ANIMATION_BASELINE_HASH =
  "ecd082a0c4ba7e293c60a5aa3df711f5409ad74bf80055d228e2176153648f6a";

const BINDINGS = deepFreeze({
  sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  sourceDataSha256:
    "41b50b841edcde0d72b8929b94e33e959788672b4c848d423afc40ff5b4bae29",
  nativeSourceSha256:
    "136874496399a7acb712b28b6effb53f689c84ca373fb42af67ebf20f3b8cc45",
  nativeBuildSha256:
    "5db9d52f4dec6e71d2a1df1009c803967455a3683b1c87e271669165ef43a3e3",
  nativeScenarioSha256:
    "5fc29151faf3ff344c37562b42148322ae0b976385cd8615fcccfcf8b529eb81",
  nativeProfileSha256:
    "ea2df6e20494efbaa95e3d292db2a25969d8dc0c255d0d7c2c6393f8a5713acc",
  nativeFieldContractSha256:
    "6d21511c288f9553628079ffeaa4a6538d4eb1a8e4b36acb4f1d0c44de42a76e",
  nativeRawSha256:
    "1b46cb63a708d6af237d3af91d6c5846bc456e93ef6b5d731a1d36cbcaffabdb",
  nativeStateSha256:
    "eb858bed9ad9d36670e97a98ea49235d8009246ded16e00dcb54c5dc1aef2fdd",
  nativeGameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  nativeFixturePlayerProfileHash: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
});

export const CSSOCCER_PLAYER_ANIMATION_SOURCE = deepFreeze({
  fixtureId: FIXTURE_ID,
  baselineTick: BASELINE_TICK,
  qualifiedThroughTick: QUALIFIED_THROUGH_TICK,
  files: [
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: [
        "actual_spd",
        "init_kick_act MC_PASSL frame-step/contact binding",
        "init_kick_act/init_kick_anim MC_BACKHEELL request, advanced-run-phase MC_BACKHEELR selection, frame remap, and cadence/contact binding",
        "init_get_up I_GET_UP busy intention",
        "init_socks_anim MC_SOCKS_FS binding",
        "init_stop_act STOP_ACT/MC_STAND binding",
        "init_stand_anim",
        "init_run_anim MC_RUN frame-zero and tm_newanim phase-reset binding",
        "init_trot_anim",
        "stand_action SOCKS_PROB odd/even MC_SOCKSL/MC_SOCKSR selection",
        "player_tussles/tussle_collision caller-owned MC_BARGE acceptance",
        "init_barge_anim MC_BARGE_FS launch binding",
        "init_steal_act transient STEAL_ACT/MC_PASSL before tussle resolution",
        "tussle_collision/init_fall caller-owned FALL_ACT/MC_FALLR acceptance",
        "init_fallr_anim MC_FALLR frame-zero and cadence binding",
        "fall_action go_cnt==1 MC_GETUPF launch, team-rate cadence scaling, and limbo binding",
        "init_getupf_anim MC_GETUPF frame-zero and base cadence binding",
        "init_run_act side-step profile",
        "process_anims MC_BARGE countdown and MC_GETUPF limbo continuation",
        "go_team process_anims-before-action order",
      ],
    },
    {
      file: "ANDYDEFS.H",
      sha256: "13d13dca2910a7685be7603e25bc9fa936253f5aa72f73eef3f54e851fbbce34",
      producers: [
        "match_player.tm_anim",
        "match_player.tm_frm",
        "match_player.tm_fstep",
        "match_player.tm_newanim source phase-reset signal",
      ],
    },
    {
      file: "DATA.H",
      sha256: "7dba31d4e9af11b4c7686faa1bf75802142579db99bd41b23d5bfcd065f0bb99",
      producers: [
        "MC_PASSL 39 / 33 prepared frames",
        "MCC_PASS 48 / 99 timeline contact",
        "MC_BACKHEELR 52 / 32 frames",
        "MC_BACKHEELL 53 / 32 frames",
        "MCC_BACKHEEL 65 / 97 timeline contact",
        "MC_SOCKSR 62 / 68 frames",
        "MC_SOCKSL 63 / 68 frames",
        "MC_TROTB 64 / 27 frames",
        "MC_TROTH 65 / 27 frames",
        "MC_TROTC 67 / 28 frames",
        "MC_TROTD 68 / 25 frames",
        "MC_TROTF 69 / 25 frames",
        "MC_TROTA 70 / 32 frames",
        "MC_TROTE 71 / 26 frames",
        "MC_RUN 72 / 26 frames",
        "MC_BARGE 74 / 27 frames",
        "MC_STAND 78 / 39 frames",
        "MC_FALLR 90 / 34 prepared frames",
        "MC_GETUPF 95 / 87 prepared frames",
      ],
    },
    {
      file: "3D_UPD2.CPP",
      sha256: "af2009e0787951cb3d7471cef1fb307598069e80f3fa558d4c5dd72026c36714",
      producers: ["fractional tm_frm renderer projection"],
    },
    {
      repository: "TalonBraveInfo/gremlin-soccer",
      revision: "2232754037ba7e2dfbf3f0d7dbe4dd6574380225",
      file: "archive/Andys/Andys Defines.h",
      blobSha: "2d1a40be6927a8a22dc0b877b5e8936e74c46cf8",
      sha256: "33baac46facaec4a7c942313a800dd7f1f43c7e8b5e4ba6b3f28993e344b4fb2",
      lines: {
        getUpIntention: 171,
        socksProbability: 296,
        socksFrameStep: 393,
        bargeFrameStep: 397,
        fallAction: 134,
        stealAction: 144,
        fallRightFrameStep: 413,
        getUpFrontFrameStep: 417,
        trotAFrameStep: 394,
        runFrameStep: 395,
        standFrameStep: 401,
        runReferenceSpeed: 480,
      },
    },
    {
      file: "FOOTBALL.CPP",
      sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
      producers: ["player_stamina source tm_rate update before process_teams"],
    },
    {
      file: "RULES.CPP",
      sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
      producers: ["match_clock", "add_player_time"],
    },
    {
      file: "BALLINT.CPP",
      sha256: "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
      producers: ["ball_interact before ordinary player intelligence/action"],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: [
        "find_zonal_target goalkeeper route into init_run_act and same-position init_stand_act",
        "make_pass pass_type 1 route into init_kick_act MC_BACKHEELL/MCC_BACKHEEL",
      ],
    },
  ],
  constants: {
    actionIds: {
      stand: STAND_ACTION,
      run: RUN_ACTION,
      fall: FALL_ACTION,
      stealTransient: STEAL_ACTION,
      centrePass: KICK_ACTION,
      stop: STOP_ACTION,
    },
    animationIds: {
      centrePass: CENTRE_PASS_ANIMATION,
      backheelRight: BACKHEEL_RIGHT_ANIMATION,
      backheelLeft: BACKHEEL_LEFT_ANIMATION,
      socksRight: SOCKS_RIGHT_ANIMATION,
      socksLeft: SOCKS_LEFT_ANIMATION,
      barge: BARGE_ANIMATION,
      sideStepDirection1: TROT_ANIMATION_BY_DIRECTION[1],
      sideStepDirection2: TROT_ANIMATION_BY_DIRECTION[2],
      sideStepDirection3: TROT_ANIMATION_BY_DIRECTION[3],
      sideStepDirection4: TROT_ANIMATION_BY_DIRECTION[4],
      sideStepDirection5: TROT_A_ANIMATION,
      sideStepDirection6: TROT_ANIMATION_BY_DIRECTION[6],
      sideStepDirection7: TROT_ANIMATION_BY_DIRECTION[7],
      sideStepDirection8: TROT_ANIMATION_BY_DIRECTION[8],
      fallRight: FALL_RIGHT_ANIMATION,
      getUpFront: GET_UP_FRONT_ANIMATION,
      run: RUN_ANIMATION,
      stand: STAND_ANIMATION,
    },
    frameCounts: {
      centrePassPrepared: CENTRE_PASS_PREPARED_FRAME_COUNT,
      centrePassTimeline: CSSOCCER_CENTRE_PASS_ACTION_PROFILE.animationFrames,
      backheel: BACKHEEL_FRAME_COUNT,
      chip: CHIP_FRAME_COUNT,
      socks: SOCKS_FRAME_COUNT,
      barge: BARGE_FRAME_COUNT,
      sideStepDirection1: TROT_FRAME_COUNT_BY_ANIMATION[71],
      sideStepDirection2: TROT_FRAME_COUNT_BY_ANIMATION[68],
      sideStepDirection3: TROT_FRAME_COUNT_BY_ANIMATION[67],
      sideStepDirection4: TROT_FRAME_COUNT_BY_ANIMATION[64],
      sideStepDirection5: TROT_A_FRAME_COUNT,
      sideStepDirection6: TROT_FRAME_COUNT_BY_ANIMATION[65],
      sideStepDirection7: TROT_FRAME_COUNT_BY_ANIMATION[66],
      sideStepDirection8: TROT_FRAME_COUNT_BY_ANIMATION[69],
      fallRight: FALL_RIGHT_FRAME_COUNT,
      getUpFront: GET_UP_FRONT_FRAME_COUNT,
      run: RUN_FRAME_COUNT,
      stand: STAND_FRAME_COUNT,
    },
    idle: {
      socksProbability: SOCKS_PROBABILITY,
    },
    kick: {
      backheelContact: BACKHEEL_CONTACT,
      backheelLocalContactOffset: BACKHEEL_LOCAL_CONTACT_OFFSET,
      backheelMovementDistance: BACKHEEL_MOVEMENT_DISTANCE,
      backheelPhaseScale: BACKHEEL_PHASE_SCALE,
      backheelTargetDistance: BACKHEEL_TARGET_DISTANCE,
      chipContact: CHIP_CONTACT,
      chipLocalContactOffset: CHIP_LOCAL_CONTACT_OFFSET,
      rightFootPhaseStart: 0.3,
      rightFootPhaseEnd: 0.8,
    },
    cadence: {
      sideStepFrameStepFormula: "actual_spd(side-step) * (1 / (20 * 32 / 40)) / 2",
      centrePassFrameStepFormula: "MC_PASSL prepared base frame step * dynamic tm_mcspd",
      centrePassContact: CSSOCCER_CENTRE_PASS_ACTION_PROFILE.contact,
      backheelFrameStepFormula: "(1 / (20 * 32 / 40)) * dynamic tm_mcspd",
      chipFrameStepFormula: "(1 / (20 * 30 / 40)) * dynamic tm_mcspd",
      bargeFrameStepFormula: "(1 / (20 * 27 / 40)) * actual_spd(barge launch) / 3.19",
      fallRightFrameStepFormula: "1 / (20 * 34 / 40)",
      getUpFrontFrameStepFormula: "f32(1 / (20 * 87 / 40)) * f32((tm_rate + 128) / 128)",
      socksFrameStepFormula: "1 / (20 * 68 / 40)",
      runFrameStepFormula: "1 / (20 * 26 / 40)",
      runWithBallSpeedFormula: "pitch_len / ((20 - (tm_rate / 64 * 4)) * 20)",
      standFrameStepFormula: "1 / (20 * 39 / 40)",
      runReferenceSpeed: RUN_REFERENCE_SPEED,
    },
  },
  processOrder: [
    "the centre-pass initializer runs before go_team on its launch tick, so its first retained frame is one MC_PASSL step",
    "process_anims adds the stored f32 tm_fstep to f32 tm_frm",
    "make_pass may initialize MC_BACKHEELL after process_anims; init_kick_anim selects MC_BACKHEELR when the advanced MC_RUN fractional phase is in [0.3, 0.8), subtracts 0.3, and scales the launch frame by f32 0.8",
    "make_pass type -1 initializes MC_CHIPL with the same advanced-run phase foot selection, dynamic tm_mcspd cadence, and compiled MCC_CHIP contact",
    "init_kick_act rotates the selected mocap contact offset, binds MC_PASS_DIST 10.14 movement, and points go_tx/go_ty 100 units along the launch facing",
    "the explicit downstream action/motion profile may retain or initialize MC_STAND/MC_RUN/directional trot, with tm_newanim distinguishing same-animation phase reset from continuation",
    "stand_action may initialize odd-seed MC_SOCKSL or even-seed MC_SOCKSR after process_anims, resetting the retained launch frame to zero",
    "a goalkeeper same-position find_zonal_target may initialize MC_STAND before stand_action performs that socks selection in the same tick",
    "player_tussles runs after both go_team calls and may initialize MC_BARGE from MC_RUN by retaining the advanced run frame and adding 0.5",
    "process_anims advances MC_BARGE and decrements its caller-owned countdown before RUN_ACT may retain it or init_run_act/init_trot_anim may replace it when the source plan changes",
    "init_steal_act may launch transient STEAL_ACT/MC_PASSL during go_team before the later player_tussles collision overwrites retained state with FALL_ACT/MC_FALLR frame zero",
    "fall_action may replace MC_FALLR with MC_GETUPF frame zero after process_anims when go_cnt decrements to one, then stores trunc(1 / scaled tm_fstep) in tm_limbo",
    "while tm_limbo is nonzero, process_anims advances MC_GETUPF and decrements limbo before ordinary player action is skipped",
    "the renderer selects floor(frac(tm_frm) * resolved frame count)",
  ],
  inputSeam: {
    owner: "downstream AI/motion producer",
    facts: [
      "typed action",
      "source initializer decision and explicit tm_newanim phase-reset signal",
      "go-step locomotion and relative direction",
      "ball-possession speed branch",
      "stand idle-variant decision from source RNG, stand conditions, and goalkeeper same-position zonal reset",
      "ordinary match-mode entry and caller-owned stand go-count",
      "explicit caller-owned tussle-collision acceptance and barge launch possession speed branch",
      "explicit caller-owned tussle-fall acceptance",
      "fall countdown reaching exactly one for the source get-up-front initializer",
      "current team rate",
      "dynamic centre-pass tm_mcspd and contact",
      "dynamic backheel tm_mcspd, compiled MCC_BACKHEEL contact, and source-selected foot",
    ],
    schedulerStatus: "profile contract only; this module does not claim the match scheduler materializes these facts",
  },
  supported: [
    "the bound all-22 tick 11 baseline",
    "normal no-possession, no-burst, no-side-step MC_RUN cadence",
    "source ball-possession MC_RUN cadence",
    "all source directions 1..8 side-step cadence across MC_TROTE/MC_TROTD/MC_TROTC/MC_TROTB/MC_TROTA/MC_TROTH/MC_TROTG/MC_TROTF",
    "MC_STAND cadence",
    "explicit STAND_ACT/RUN_ACT/STOP_ACT profile continuation or source initializer",
    "centre-pass KICK_ACT/MC_PASSL dynamic tm_mcspd cadence and compiled MCC_PASS contact",
    "KICK_ACT MC_BACKHEELL request selecting MC_BACKHEELR from advanced MC_RUN phase, dynamic tm_mcspd cadence, and compiled MCC_BACKHEEL contact",
    "STAND_ACT MC_SOCKSL initialization and MC_SOCKS_FS cadence",
    "STAND_ACT MC_SOCKSR initialization and MC_SOCKS_FS cadence",
    "RUN_ACT MC_BARGE initialization from an explicitly accepted tussle and MC_BARGE_FS continuation",
    "FALL_ACT MC_FALLR initialization from an explicitly accepted tussle and 34-frame source cadence",
    "FALL_ACT MC_GETUPF initialization at fall countdown one, exact team-rate-scaled cadence, and limbo continuation",
    "dynamic source tm_rate supplied by the ordinary player profile state",
    "retained qualification through tick 230",
  ],
  unsupported: [
    "jog, keeper-with-ball-in-hands, user burst, and intercept cadence",
    "other non-qualified kick, tackle, control, restart, celebration, and mocap contact instants",
    "renderer tween state beyond the explicit tm_newanim phase-reset input signal",
  ],
});

const BASELINE_ROWS = [
  ["spain-player-01", 1, RUN_ACTION, RUN_ANIMATION, "3f8bda02"],
  ["spain-player-02", 2, RUN_ACTION, RUN_ANIMATION, "3f810187"],
  ["spain-player-03", 3, RUN_ACTION, RUN_ANIMATION, "3f9fa0ec"],
  ["spain-player-04", 4, RUN_ACTION, RUN_ANIMATION, "3f6f7162"],
  ["spain-player-05", 5, RUN_ACTION, RUN_ANIMATION, "3f78deaa"],
  ["spain-player-06", 6, RUN_ACTION, RUN_ANIMATION, "3f9bb265"],
  ["spain-player-07", 7, RUN_ACTION, RUN_ANIMATION, "3f95164b"],
  ["spain-player-08", 8, RUN_ACTION, RUN_ANIMATION, "3f9fa0ec"],
  ["spain-player-09", 9, RUN_ACTION, RUN_ANIMATION, "3f8325ac"],
  ["spain-player-10", 10, RUN_ACTION, TROT_A_ANIMATION, "3f6963ed"],
  ["spain-player-11", 11, RUN_ACTION, RUN_ANIMATION, "3fa57a95"],
  ["argentina-player-01", 12, RUN_ACTION, RUN_ANIMATION, "3f7cda0a"],
  ["argentina-player-02", 13, RUN_ACTION, RUN_ANIMATION, "3f79da7f"],
  ["argentina-player-03", 14, RUN_ACTION, RUN_ANIMATION, "3f8188e0"],
  ["argentina-player-04", 15, RUN_ACTION, RUN_ANIMATION, "3f87a669"],
  ["argentina-player-05", 16, RUN_ACTION, RUN_ANIMATION, "3f79da7f"],
  ["argentina-player-06", 17, RUN_ACTION, RUN_ANIMATION, "3fa6598d"],
  ["argentina-player-07", 18, RUN_ACTION, RUN_ANIMATION, "3fa49df4"],
  ["argentina-player-08", 19, RUN_ACTION, RUN_ANIMATION, "3f9ed392"],
  ["argentina-player-09", 20, RUN_ACTION, RUN_ANIMATION, "3f94631c"],
  ["argentina-player-10", 21, RUN_ACTION, RUN_ANIMATION, "3f98b030"],
  ["argentina-player-11", 22, RUN_ACTION, RUN_ANIMATION, "3f9a2d89"],
];

const PROFILE_BY_ID = new Map(
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map((player) => [player.id, player]),
);

export class CssoccerUnsupportedPlayerAnimationError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedPlayerAnimationError";
    this.code = "CSSOCCER_UNSUPPORTED_PLAYER_ANIMATION";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/** Bind one ordinary action/locomotion decision to the source animation seam. */
export function createCssoccerPlayerAnimationProfile(input = {}) {
  requirePlainObject(input, "player animation profile input");
  const kind = input.kind;
  if (!LOCOMOTION_KINDS.has(kind)) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "locomotion",
      `Player animation locomotion ${kind} is outside the qualified opening subset.`,
      { kind },
    );
  }
  const runPhaseReset = isRunLocomotion(kind)
    && Object.hasOwn(input, "phaseReset");
  const keys = kind === "side-step"
    ? ["direction", "initialize", "kind", "schema", "teamRate"]
    : kind === "barge"
      ? [
          "initialize",
          "kind",
          "schema",
          "teamRate",
          "tussleAccepted",
          "withBall",
        ]
      : kind === "fall-right"
        ? ["initialize", "kind", "schema", "teamRate", "tussleAccepted"]
      : kind === "get-up-front"
        ? ["fallCountdown", "initialize", "kind", "schema", "teamRate"]
      : kind === "backheel"
        ? [
            "contact",
            "foot",
            "initialize",
            "kind",
            "motionCaptureSpeed",
            "schema",
            "teamRate",
          ]
      : kind === "centre-pass"
      ? [
          "contact",
          "initialize",
          "kind",
          "motionCaptureSpeed",
          "schema",
          "teamRate",
        ]
      : runPhaseReset
        ? ["initialize", "kind", "phaseReset", "schema", "teamRate"]
        : ["initialize", "kind", "schema", "teamRate"];
  requireExactKeys(input, keys, "player animation profile input");
  if (input.schema !== CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA) {
    throw new Error(`Player animation profile must use ${CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA}.`);
  }
  requireBoolean(input.initialize, "player animation profile initialize");
  if (runPhaseReset) {
    requireBoolean(input.phaseReset, "player animation profile phaseReset");
    if (input.phaseReset && !input.initialize) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "run-phase-reset",
        "Player animation run phase reset requires the source initializer branch.",
      );
    }
  }
  requireU8(input.teamRate, "player animation profile teamRate");
  if (kind === "barge") {
    requireBoolean(input.tussleAccepted, "player animation profile tussleAccepted");
    requireBoolean(input.withBall, "player animation profile withBall");
    if (input.tussleAccepted !== input.initialize) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "barge-tussle-acceptance",
        "Player animation barge initialization must be declared by its caller-owned tussle acceptance.",
        {
          initialize: input.initialize,
          tussleAccepted: input.tussleAccepted,
        },
      );
    }
  }
  if (kind === "fall-right") {
    requireBoolean(input.tussleAccepted, "player animation profile tussleAccepted");
    if (input.tussleAccepted !== input.initialize) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "fall-tussle-acceptance",
        "Player animation fall initialization must be declared by its caller-owned tussle acceptance.",
        {
          initialize: input.initialize,
          tussleAccepted: input.tussleAccepted,
        },
      );
    }
  }
  if (kind === "get-up-front") {
    requireUint32(input.fallCountdown, "player animation profile fallCountdown");
    if (input.fallCountdown !== 1) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "get-up-fall-countdown",
        "Player animation get-up-front initialization requires source fall countdown one.",
        { fallCountdown: input.fallCountdown },
      );
    }
  }
  if (kind === "side-step" && !QUALIFIED_SIDE_STEP_DIRECTIONS.has(input.direction)) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "side-step-direction",
      `Player animation side-step direction ${input.direction} is outside the qualified directional-trot frontier.`,
      { direction: input.direction },
    );
  }
  if (kind === "centre-pass") {
    requirePositiveF32(
      input.motionCaptureSpeed,
      "player animation profile motionCaptureSpeed",
    );
    requireF32(input.contact, "player animation profile contact");
    if (input.contact !== CSSOCCER_CENTRE_PASS_ACTION_PROFILE.contact) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "centre-pass-contact",
        "Player animation centre-pass contact changed from the compiled MCC_PASS profile.",
        { contact: input.contact },
      );
    }
  }
  if (kind === "backheel") {
    if (input.foot !== "left" && input.foot !== "right") {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "backheel-foot",
        `Player animation backheel foot ${input.foot} is outside the source selector.`,
        { foot: input.foot },
      );
    }
    requirePositiveF32(
      input.motionCaptureSpeed,
      "player animation backheel motionCaptureSpeed",
    );
    requireF32(input.contact, "player animation backheel contact");
    if (input.contact !== BACKHEEL_CONTACT) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "backheel-contact",
        "Player animation backheel contact changed from compiled MCC_BACKHEEL.",
        { contact: input.contact },
      );
    }
  }
  return deepFreeze(clone(input));
}

/** Resolve the source animation id and f32 cadence for opening locomotion. */
export function projectCssoccerOpeningLocomotionAnimation(input = {}) {
  requirePlainObject(input, "opening locomotion animation input");
  const keys = input.kind === "side-step"
    ? ["direction", "kind", "teamRate"]
    : ["kind", "teamRate"];
  requireExactKeys(input, keys, "opening locomotion animation input");
  if (!["run", "run-with-ball", "side-step", "stand"].includes(input.kind)) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "opening-locomotion",
      `Opening animation locomotion ${input.kind} is unsupported.`,
    );
  }
  const profile = createCssoccerPlayerAnimationProfile({
    schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
    kind: input.kind,
    ...(input.kind === "side-step" ? { direction: input.direction } : {}),
    initialize: true,
    teamRate: input.teamRate,
  });
  const locomotion = stateLocomotion(profile);
  return deepFreeze({
    animation: animationForLocomotion(locomotion),
    frameStep: frameStepForLocomotion(locomotion, profile.teamRate),
  });
}

function projectCssoccerKickLaunch(input, profileByType, sourceFunction) {
  requirePlainObject(input, "pass kick launch input");
  requireExactKeys(input, [
    "animation",
    "animationFrame",
    "animationFrameStep",
    "facing",
    "motionCaptureSpeed",
    "passType",
    "teamRate",
  ], "pass kick launch input");
  const animation = requireU16(input.animation, "pass kick launch animation");
  const animationFrame = requireF32(
    input.animationFrame,
    "pass kick launch animationFrame",
  );
  const animationFrameStep = requirePositiveF32(
    input.animationFrameStep,
    "pass kick launch animationFrameStep",
  );
  const motionCaptureSpeed = requirePositiveF32(
    input.motionCaptureSpeed,
    "pass kick launch motionCaptureSpeed",
  );
  if (!Number.isSafeInteger(input.passType)) {
    throw new TypeError("pass kick launch passType must be an integer");
  }
  requireU8(input.teamRate, "pass kick launch teamRate");
  const facing = requireLaunchFacing(input.facing);
  const profile = profileByType[input.passType];
  if (profile === undefined) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "pass-kick-type",
      `Pass kick type ${String(input.passType)} is outside ${sourceFunction}.`,
      { passType: input.passType },
    );
  }
  const launch = sourcePassKickLaunch(
    profile,
    animation,
    F32(animationFrame + animationFrameStep),
  );
  const localContactOffset = profile.offsets[launch.animation];
  if (localContactOffset === undefined) {
    throw new Error(`Pass kick animation ${launch.animation} has no compiled contact offset.`);
  }
  const frameStep = F32(profile.baseFrameStep * motionCaptureSpeed);
  return deepFreeze({
    action: KICK_ACTION,
    animation: launch.animation,
    animationFrame: launch.frame,
    animationFrameStep: frameStep,
    contact: profile.contact,
    contactOffset: rotateSourceOffset(localContactOffset, facing),
    foot: launch.foot,
    movement: {
      x: F32(BACKHEEL_MOVEMENT_DISTANCE * frameStep * facing.x),
      y: F32(BACKHEEL_MOVEMENT_DISTANCE * frameStep * facing.y),
    },
    targetDistance: BACKHEEL_TARGET_DISTANCE,
  });
}

/** Project make_pass -> init_anim -> init_kick_act for any source pass kick. */
export function projectCssoccerPassKickLaunch(input = {}) {
  return projectCssoccerKickLaunch(input, PASS_KICK_PROFILE_BY_TYPE, "make_pass");
}

/** Project make_shoot -> init_anim -> init_kick_act for any source shot kick. */
export function projectCssoccerShotKickLaunch(input = {}) {
  return projectCssoccerKickLaunch(input, SHOT_KICK_PROFILE_BY_TYPE, "make_shoot");
}

/** Project the generic make_pass type-1 -> init_kick_act backheel launch. */
export function projectCssoccerBackheelKickLaunch(input = {}) {
  requirePlainObject(input, "backheel kick launch input");
  requireExactKeys(input, [
    "animationFrame",
    "animationFrameStep",
    "facing",
    "motionCaptureSpeed",
    "teamRate",
  ], "backheel kick launch input");
  const launch = projectCssoccerPassKickLaunch({
    ...input,
    animation: RUN_ANIMATION,
    passType: 1,
  });
  createCssoccerPlayerAnimationProfile({
    schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
    kind: "backheel",
    initialize: true,
    teamRate: input.teamRate,
    foot: launch.foot,
    motionCaptureSpeed: input.motionCaptureSpeed,
    contact: BACKHEEL_CONTACT,
  });
  return launch;
}

/** Project the generic make_pass type--1 -> init_kick_act chip launch. */
export function projectCssoccerChipKickLaunch(input = {}) {
  requirePlainObject(input, "chip kick launch input");
  requireExactKeys(input, [
    "animationFrame",
    "animationFrameStep",
    "facing",
    "motionCaptureSpeed",
    "teamRate",
  ], "chip kick launch input");
  return projectCssoccerPassKickLaunch({
    ...input,
    animation: RUN_ANIMATION,
    passType: -1,
  });
}

const BASELINE = assemble({
  tick: BASELINE_TICK,
  players: BASELINE_ROWS.map(([id, nativePlayerNumber, action, animation, frameBits]) => (
    createPlayer({ id, nativePlayerNumber, action, animation, frameBits })
  )),
});

/** Return the immutable, fully bound first all-player stand/run boundary. */
export function createCssoccerPlayerAnimationState({
  nativeFixturePlayerProfile,
  nativeGameplayProfile,
} = {}) {
  const playerProfile = assertCssoccerNativeFixturePlayerProfile(nativeFixturePlayerProfile);
  const gameplayProfile = assertCssoccerNativeGameplayProfile(nativeGameplayProfile);
  if (
    playerProfile.profileHash !== BINDINGS.nativeFixturePlayerProfileHash
    || gameplayProfile.profileHash !== BINDINGS.nativeGameplayProfileHash
    || playerProfile.bindings.nativeBuildSha256 !== BINDINGS.nativeBuildSha256
    || playerProfile.bindings.nativeScenarioSha256 !== BINDINGS.nativeScenarioSha256
    || playerProfile.bindings.nativeFieldContractSha256 !== BINDINGS.nativeFieldContractSha256
    || playerProfile.bindings.nativeRawSha256 !== BINDINGS.nativeRawSha256
  ) {
    throw new Error("Player animation initialization profiles do not match the accepted fixture bindings.");
  }
  return BASELINE;
}

/**
 * Advance one bounded source tick. Inputs carry typed actions plus ordinary
 * source locomotion profiles; retained animation samples never enter this reducer.
 */
export function stepCssoccerPlayerAnimationState(state, input = {}) {
  const current = assertCssoccerPlayerAnimationState(state);
  requirePlainObject(input, "player animation step input");
  requireExactKeys(input, ["players", "tick"], "player animation step input");
  requireUint32(input.tick, "player animation step tick");
  if (input.tick !== current.tick + 1) {
    throw new Error(`Player animation ticks must be contiguous; expected ${current.tick + 1}.`);
  }
  if (input.tick > QUALIFIED_THROUGH_TICK) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "qualified-window",
      `Player animation is qualified only through tick ${QUALIFIED_THROUGH_TICK}; the next native action/animation seam is unsupported.`,
      { requestedTick: input.tick },
    );
  }
  const actions = requirePlayerActions(input.players);
  const players = current.players.map((player) => (
    advancePlayer(player, actions.get(player.id))
  ));
  return assemble({ tick: input.tick, players });
}

/** Return exactly the retained tm_anim/tm_frm parity fields. */
export function projectCssoccerPlayerAnimationNativeFields(state) {
  const current = assertCssoccerPlayerAnimationState(state);
  return deepFreeze(current.players.flatMap((player) => [
    clone(player.animation),
    clone(player.animationFrame),
  ]).sort((left, right) => left.fieldId.localeCompare(right.fieldId)));
}

/** Project the shape consumed by playerRenderState without owning transforms. */
export function projectCssoccerPlayerAnimationRenderSlots(state) {
  const current = assertCssoccerPlayerAnimationState(state);
  return deepFreeze(current.players.map((player) => {
    const slotId = player.animation.value;
    const frameCount = frameCountForAnimation(slotId);
    const nativeFrame = player.animationFrame.value;
    const fractionalFrame = nativeFrame - Math.floor(nativeFrame);
    const frame = Math.floor(fractionalFrame * frameCount);
    if (!Number.isSafeInteger(frame) || frame < 0 || frame >= frameCount) {
      throw new Error(`${player.id} projected an invalid prepared animation frame.`);
    }
    return {
      rootId: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      animation: { slotId, frame },
    };
  }));
}

export function assertCssoccerPlayerAnimationState(state) {
  requirePlainObject(state, "player animation state");
  requireExactKeys(state, [
    "baselineHash",
    "bindings",
    "fixtureId",
    "matchHalf",
    "players",
    "qualifiedThroughTick",
    "schema",
    "tick",
  ], "player animation state");
  if (
    state.schema !== CSSOCCER_PLAYER_ANIMATION_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
    || state.matchHalf !== 0
    || state.baselineHash !== CSSOCCER_PLAYER_ANIMATION_BASELINE_HASH
    || state.qualifiedThroughTick !== QUALIFIED_THROUGH_TICK
  ) {
    throw new Error(`Player animation state must use ${CSSOCCER_PLAYER_ANIMATION_STATE_SCHEMA}.`);
  }
  requireUint32(state.tick, "player animation state tick");
  if (state.tick < BASELINE_TICK || state.tick > QUALIFIED_THROUGH_TICK) {
    throw new Error("Player animation state escaped its qualified opening interval.");
  }
  requireBindings(state.bindings);
  if (JSON.stringify(state.bindings) !== JSON.stringify(BINDINGS)) {
    throw new Error("Player animation state binding changed.");
  }
  if (!Array.isArray(state.players) || state.players.length !== PLAYER_COUNT) {
    throw new Error("Player animation state requires exactly 22 players.");
  }
  for (const [index, player] of state.players.entries()) {
    requirePlayer(player, index);
  }
  return state;
}

function assemble({ tick, players }) {
  const state = deepFreeze({
    schema: CSSOCCER_PLAYER_ANIMATION_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    baselineHash: CSSOCCER_PLAYER_ANIMATION_BASELINE_HASH,
    bindings: clone(BINDINGS),
    tick,
    matchHalf: 0,
    qualifiedThroughTick: QUALIFIED_THROUGH_TICK,
    players,
  });
  return assertCssoccerPlayerAnimationState(state);
}

function createPlayer({ id, nativePlayerNumber, action, animation, frameBits }) {
  const profile = PROFILE_BY_ID.get(id);
  if (profile?.kickoffNativePlayerNumber !== nativePlayerNumber) {
    throw new Error(`Player animation baseline profile is missing ${id}.`);
  }
  const locomotion = locomotionForAction(action, animation);
  const teamRate = profile.attributes.pace;
  const frameStep = frameStepForLocomotion(locomotion, teamRate);
  return {
    id,
    nativePlayerNumber,
    teamRate,
    locomotion,
    action: typedInteger(`players.${id}.action`, "i16", action),
    animation: typedInteger(`players.${id}.animation`, "u16", animation),
    animationLimbo: typedInteger(`players.${id}.animation_limbo`, "i16", 0),
    animationFrame: typedF32(`players.${id}.animation_frame`, f32FromBits(frameBits)),
    animationFrameStep: typedF32(`players.${id}.animation_frame_step`, frameStep),
  };
}

function advancePlayer(player, input) {
  const advancedFrame = F32(player.animationFrame.value + player.animationFrameStep.value);
  const advancedLimbo = player.locomotion.kind === "get-up-front"
    ? player.animationLimbo.value - 1
    : 0;
  const { action, profile } = input;
  const nextLocomotion = stateLocomotion(profile);
  const changed = action.value !== player.action.value
    || !sameValue(nextLocomotion, player.locomotion);
  if (!profile.initialize && changed) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "profile-transition",
      `${player.id} changed action or locomotion without a source animation initializer.`,
      {
        id: player.id,
        actionBefore: player.action.value,
        actionAfter: action.value,
        locomotionBefore: clone(player.locomotion),
        locomotionAfter: clone(nextLocomotion),
      },
    );
  }
  if (
    player.locomotion.kind === "get-up-front"
    && nextLocomotion.kind !== "get-up-front"
    && player.animationLimbo.value > 1
  ) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "get-up-limbo",
      `${player.id} cannot leave MC_GETUPF before source animation limbo expires.`,
      { id: player.id, animationLimbo: player.animationLimbo.value },
    );
  }
  if (profile.initialize && profile.kind === "get-up-front") {
    if (player.locomotion.kind !== "fall-right") {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "get-up-transition",
        `${player.id} can initialize MC_GETUPF only from the source fall action.`,
        { id: player.id, locomotionBefore: clone(player.locomotion) },
      );
    }
    const frameStep = frameStepForLocomotion(nextLocomotion, profile.teamRate);
    return {
      ...clone(player),
      teamRate: profile.teamRate,
      locomotion: nextLocomotion,
      action: clone(action),
      animation: typedInteger(
        player.animation.fieldId,
        "u16",
        GET_UP_FRONT_ANIMATION,
      ),
      // fall_action launches after process_anims, resets the pose, and binds limbo.
      animationLimbo: typedInteger(
        player.animationLimbo.fieldId,
        "i16",
        Math.trunc(1 / frameStep),
      ),
      animationFrame: typedF32(player.animationFrame.fieldId, F32(0)),
      animationFrameStep: typedF32(player.animationFrameStep.fieldId, frameStep),
    };
  }
  if (profile.initialize && profile.kind === "backheel") {
    if (!isRunLocomotion(player.locomotion.kind)) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "backheel-transition",
        `${player.id} can initialize a backheel only from the qualified MC_RUN phase.`,
        { id: player.id, locomotionBefore: clone(player.locomotion) },
      );
    }
    const launch = sourceKickLaunch(advancedFrame);
    if (profile.foot !== launch.foot) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "backheel-foot",
        `${player.id} backheel foot disagrees with the source MC_RUN phase selector.`,
        { id: player.id, expected: launch.foot, actual: profile.foot },
      );
    }
    const frameStep = frameStepForLocomotion(nextLocomotion, profile.teamRate);
    return {
      ...clone(player),
      teamRate: profile.teamRate,
      locomotion: nextLocomotion,
      action: clone(action),
      animationLimbo: typedInteger(player.animationLimbo.fieldId, "i16", 0),
      animation: typedInteger(
        player.animation.fieldId,
        "u16",
        animationForLocomotion(nextLocomotion),
      ),
      // make_pass follows process_anims and remaps the advanced run phase.
      animationFrame: typedF32(player.animationFrame.fieldId, launch.frame),
      animationFrameStep: typedF32(player.animationFrameStep.fieldId, frameStep),
    };
  }
  if (profile.initialize && profile.kind === "centre-pass") {
    const frameStep = frameStepForLocomotion(nextLocomotion, profile.teamRate);
    return {
      ...clone(player),
      teamRate: profile.teamRate,
      locomotion: nextLocomotion,
      action: clone(action),
      animationLimbo: typedInteger(player.animationLimbo.fieldId, "i16", 0),
      animation: typedInteger(
        player.animation.fieldId,
        "u16",
        CENTRE_PASS_ANIMATION,
      ),
      // match_rules launches the centre pass before go_team/process_anims.
      animationFrame: typedF32(player.animationFrame.fieldId, frameStep),
      animationFrameStep: typedF32(player.animationFrameStep.fieldId, frameStep),
    };
  }
  if (profile.initialize && profile.kind === "barge") {
    const frameStep = frameStepForLocomotion(nextLocomotion, profile.teamRate);
    return {
      ...clone(player),
      teamRate: profile.teamRate,
      locomotion: nextLocomotion,
      action: clone(action),
      animationLimbo: typedInteger(player.animationLimbo.fieldId, "i16", 0),
      animation: typedInteger(
        player.animation.fieldId,
        "u16",
        BARGE_ANIMATION,
      ),
      // player_tussles follows go_team/process_anims and preserves run phase.
      animationFrame: typedF32(
        player.animationFrame.fieldId,
        F32(advancedFrame + 0.5),
      ),
      animationFrameStep: typedF32(player.animationFrameStep.fieldId, frameStep),
    };
  }
  if (profile.initialize && profile.kind === "fall-right") {
    const frameStep = frameStepForLocomotion(nextLocomotion, profile.teamRate);
    return {
      ...clone(player),
      teamRate: profile.teamRate,
      locomotion: nextLocomotion,
      action: clone(action),
      animationLimbo: typedInteger(player.animationLimbo.fieldId, "i16", 0),
      animation: typedInteger(
        player.animation.fieldId,
        "u16",
        FALL_RIGHT_ANIMATION,
      ),
      // player_tussles/init_fall follows process_anims and resets the fall pose.
      animationFrame: typedF32(player.animationFrame.fieldId, F32(0)),
      animationFrameStep: typedF32(player.animationFrameStep.fieldId, frameStep),
    };
  }
  if (!profile.initialize) {
    if (profile.kind === "get-up-front" && advancedLimbo <= 0) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "get-up-limbo",
        `${player.id} MC_GETUPF continuation reached the source limbo boundary.`,
        { id: player.id, animationLimbo: player.animationLimbo.value },
      );
    }
    return {
      ...clone(player),
      teamRate: profile.teamRate,
      locomotion: nextLocomotion,
      action: clone(action),
      animationLimbo: typedInteger(
        player.animationLimbo.fieldId,
        "i16",
        profile.kind === "get-up-front" ? advancedLimbo : 0,
      ),
      animationFrame: typedF32(player.animationFrame.fieldId, advancedFrame),
    };
  }

  const animation = animationForLocomotion(nextLocomotion);
  const shouldReset = profile.kind === "stand"
    || isSocksLocomotion(profile.kind)
    || (
      isRunLocomotion(profile.kind)
      && (player.animation.value !== RUN_ANIMATION || profile.phaseReset === true)
    )
    || (profile.kind === "side-step" && !isTrotAnimation(player.animation.value));
  return {
    ...clone(player),
    teamRate: profile.teamRate,
    locomotion: nextLocomotion,
    action: clone(action),
    animationLimbo: typedInteger(player.animationLimbo.fieldId, "i16", 0),
    animation: typedInteger(player.animation.fieldId, "u16", animation),
    animationFrame: typedF32(
      player.animationFrame.fieldId,
      shouldReset ? F32(0) : advancedFrame,
    ),
    animationFrameStep: typedF32(
      player.animationFrameStep.fieldId,
      frameStepForLocomotion(nextLocomotion, profile.teamRate),
    ),
  };
}

function requirePlayerActions(players) {
  if (!Array.isArray(players) || players.length !== PLAYER_COUNT) {
    throw new Error("Player animation step requires exactly 22 typed player actions.");
  }
  const actions = new Map();
  for (const [index, entry] of players.entries()) {
    requirePlainObject(entry, `player animation action ${index}`);
    requireExactKeys(
      entry,
      ["action", "id", "nativePlayerNumber", "profile"],
      `player animation action ${index}`,
    );
    const expected = BASELINE_ROWS[index];
    if (entry.id !== expected[0] || entry.nativePlayerNumber !== expected[1]) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "native-order",
        `Player animation action ${index} changed stable identity or native order.`,
      );
    }
    requireTypedInteger(
      entry.action,
      `players.${entry.id}.action`,
      "i16",
      `player animation action ${entry.id}`,
    );
    const profile = createCssoccerPlayerAnimationProfile(entry.profile);
    if (
      entry.action.value !== STAND_ACTION
      && entry.action.value !== RUN_ACTION
      && entry.action.value !== FALL_ACTION
      && entry.action.value !== KICK_ACTION
      && entry.action.value !== STOP_ACTION
    ) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "action",
        `Player animation action ${entry.action.value} is outside the source-qualified opening subset.`,
        { id: entry.id, action: entry.action.value },
      );
    }
    requireActionLocomotion(entry.action.value, profile.kind, entry.id);
    actions.set(entry.id, deepFreeze({
      action: clone(entry.action),
      profile,
    }));
  }
  return actions;
}

function requirePlayer(player, index) {
  requirePlainObject(player, `player animation player ${index}`);
  requireExactKeys(player, [
    "action",
    "animation",
    "animationFrame",
    "animationFrameStep",
    "animationLimbo",
    "id",
    "locomotion",
    "nativePlayerNumber",
    "teamRate",
  ], `player animation player ${index}`);
  const expected = BASELINE_ROWS[index];
  if (player.id !== expected[0] || player.nativePlayerNumber !== expected[1]) {
    throw new Error(`Player animation player ${index} changed stable identity or native order.`);
  }
  requireTypedInteger(
    player.action,
    `players.${player.id}.action`,
    "i16",
    `${player.id} action`,
  );
  requireTypedInteger(
    player.animation,
    `players.${player.id}.animation`,
    "u16",
    `${player.id} animation`,
  );
  requireTypedF32(
    player.animationFrame,
    `players.${player.id}.animation_frame`,
    `${player.id} animation frame`,
  );
  requireTypedF32(
    player.animationFrameStep,
    `players.${player.id}.animation_frame_step`,
    `${player.id} animation frame step`,
  );
  requireTypedInteger(
    player.animationLimbo,
    `players.${player.id}.animation_limbo`,
    "i16",
    `${player.id} animation limbo`,
  );
  requireU8(player.teamRate, `${player.id} teamRate`);
  const locomotion = requireStateLocomotion(player.locomotion, `${player.id} locomotion`);
  requireActionLocomotion(player.action.value, locomotion.kind, player.id);
  if (player.animation.value !== animationForLocomotion(locomotion)) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "action-animation",
      `${player.id} action, locomotion, and animation are outside the qualified opening mapping.`,
    );
  }
  if (
    (locomotion.kind === "get-up-front" && player.animationLimbo.value <= 0)
    || (locomotion.kind !== "get-up-front" && player.animationLimbo.value !== 0)
  ) {
    throw new Error(`${player.id} animation limbo changed from its source lifecycle.`);
  }
  const expectedStep = frameStepForLocomotion(locomotion, player.teamRate);
  if (
    player.animationFrameStep.value !== expectedStep
    || player.animationFrameStep.numericBits !== f32Bits(expectedStep)
  ) {
    throw new Error(`${player.id} animation frame step changed from its source formula.`);
  }
}

function runningActualSpeed(teamRate, seconds) {
  requireU8(teamRate, "player animation teamRate");
  return F32(1280 / ((seconds - ((teamRate / 64) * 4)) * 20));
}

function sideStepActualSpeed(teamRate) {
  requireU8(teamRate, "player animation side-step teamRate");
  return F32(1280 / ((24 - ((teamRate / 64) * 4)) * 20));
}

function sourceKickLaunch(advancedFrame, phaseScale = BACKHEEL_PHASE_SCALE) {
  let phase = F32(advancedFrame - Math.floor(advancedFrame));
  let foot;
  if (phase >= 0.3 && phase < 0.8) {
    phase = F32(phase - 0.3);
    foot = "right";
  } else {
    phase = F32(phase < 0.3 ? phase + 0.2 : phase - 0.8);
    foot = "left";
  }
  return {
    foot,
    frame: F32(phase * phaseScale),
  };
}

function sourcePassKickLaunch(profile, animation, advancedFrame) {
  const runPhase = animation === RUN_ANIMATION;
  const jogPhase = animation === 73;
  const bargePhase = animation === BARGE_ANIMATION;
  const phaseFrame = jogPhase || (
    (profile.mode === "phase-foot" || profile.mode === "shoot-phase-foot")
    && bargePhase
  )
    ? F32(advancedFrame + 0.5)
    : advancedFrame;

  if (profile.mode === "shoot-phase-foot") {
    if (!runPhase && !jogPhase && !bargePhase) {
      // ACTIONS.CPP init_kick_anim uses the requested MC_SHOOTL row at frame
      // zero whenever the previous clip is not RUN/JOG/BARGE.
      return { animation: profile.leftAnimation, foot: "left", frame: F32(0) };
    }
    let phase = F32(phaseFrame - Math.floor(phaseFrame));
    let foot;
    if (phase >= 0.25 && phase < 0.75) {
      phase = F32(phase - 0.25);
      foot = "right";
    } else {
      phase = F32(phase < 0.25 ? phase + 0.25 : phase - 0.75);
      foot = "left";
    }
    return {
      animation: foot === "right" ? profile.rightAnimation : profile.leftAnimation,
      foot,
      frame: F32(phase * 0.6),
    };
  }

  if (profile.mode === "phase-foot") {
    if (runPhase || jogPhase || bargePhase) {
      const selected = sourceKickLaunch(phaseFrame, profile.phaseScale);
      return {
        animation: selected.foot === "right"
          ? profile.rightAnimation
          : profile.leftAnimation,
        foot: selected.foot,
        frame: selected.frame,
      };
    }
    return { animation: profile.leftAnimation, foot: "left", frame: F32(0) };
  }

  if (profile.mode === "fixed-left") {
    return { animation: profile.leftAnimation, foot: "left", frame: F32(0) };
  }
  if (profile.mode === "fixed-right") {
    return { animation: profile.rightAnimation, foot: "right", frame: F32(0) };
  }

  let frame = F32(0);
  if (runPhase || jogPhase) {
    let phase = F32(phaseFrame - Math.floor(phaseFrame));
    if (profile.mode === "left") {
      if (phase < 0.3) phase = F32(phase + 0.2);
      else if (phase > 0.8) phase = F32(phase - 0.8);
      else phase = F32(0);
    } else if (profile.mode === "right") {
      phase = phase >= 0.3 && phase < 0.8
        ? F32(phase - 0.3)
        : F32(0);
    } else {
      throw new Error(`Unsupported pass kick initializer ${profile.mode}.`);
    }
    frame = F32(phase * BACKHEEL_PHASE_SCALE);
  }
  return profile.mode === "left"
    ? { animation: profile.leftAnimation, foot: "left", frame }
    : { animation: profile.rightAnimation, foot: "right", frame };
}

function passKickProfile({
  mode,
  phaseScale = BACKHEEL_PHASE_SCALE,
  frameCount,
  contact,
  leftAnimation = null,
  rightAnimation = null,
  offsets,
}) {
  return deepFreeze({
    mode,
    phaseScale: F32(phaseScale),
    frameCount,
    baseFrameStep: F32(1 / (20 * frameCount / 40)),
    contact: F32(contact),
    leftAnimation,
    rightAnimation,
    offsets: Object.fromEntries(Object.entries(offsets).map(([animation, values]) => [
      animation,
      { x: F32(values[0]), y: F32(values[1]), z: F32(values[2]) },
    ])),
  });
}

function requireLaunchFacing(value) {
  requirePlainObject(value, "backheel kick launch facing");
  requireExactKeys(value, ["x", "y"], "backheel kick launch facing");
  const facing = {
    x: requireF32(value.x, "backheel kick launch facing.x"),
    y: requireF32(value.y, "backheel kick launch facing.y"),
  };
  if (Math.abs(sourcePlanarDistance(facing.x, facing.y) - 1) > 0.0001) {
    throw new TypeError("backheel kick launch facing must be normalized");
  }
  return facing;
}

function rotateSourceOffset(local, facing) {
  const facingDistance = sourcePlanarDistance(facing.x, facing.y);
  const nx = F32(facing.x / facingDistance);
  const ny = F32(facing.y / facingDistance);
  const offsetDistance = sourcePlanarDistance(local.x, local.y);
  if (offsetDistance <= 1) return { x: F32(0), y: F32(0), z: F32(0) };
  const x = F32(local.x / offsetDistance);
  const y = F32(local.y / offsetDistance);
  const rotatedX = F32(F32(x * nx) - F32(y * ny));
  const rotatedY = F32(F32(y * nx) + F32(x * ny));
  return {
    x: F32(rotatedX * offsetDistance),
    y: F32(rotatedY * offsetDistance),
    z: local.z,
  };
}

function sourcePlanarDistance(x, y) {
  return F32(Math.sqrt(F32(F32(x * x) + F32(y * y))));
}

function frameStepForLocomotion(locomotion, teamRate) {
  if (locomotion.kind === "stand") return STAND_FRAME_STEP;
  if (isSocksLocomotion(locomotion.kind)) return SOCKS_FRAME_STEP;
  if (locomotion.kind === "fall-right") return FALL_RIGHT_FRAME_STEP;
  if (locomotion.kind === "get-up-front") {
    return F32(
      GET_UP_FRONT_BASE_FRAME_STEP * F32((teamRate + 128) / 128),
    );
  }
  if (locomotion.kind === "backheel") {
    return F32(BACKHEEL_BASE_FRAME_STEP * locomotion.motionCaptureSpeed);
  }
  if (locomotion.kind === "barge") {
    const seconds = locomotion.withBall ? 20 : 18;
    return F32(
      BARGE_FRAME_STEP * (runningActualSpeed(teamRate, seconds) / RUN_REFERENCE_SPEED),
    );
  }
  if (locomotion.kind === "run") {
    return F32(RUN_FRAME_STEP * (runningActualSpeed(teamRate, 18) / RUN_REFERENCE_SPEED));
  }
  if (locomotion.kind === "run-with-ball") {
    return F32(RUN_FRAME_STEP * (runningActualSpeed(teamRate, 20) / RUN_REFERENCE_SPEED));
  }
  if (
    locomotion.kind === "side-step"
    && QUALIFIED_SIDE_STEP_DIRECTIONS.has(locomotion.direction)
  ) {
    return F32(sideStepActualSpeed(teamRate) * TROT_A_FRAME_STEP / 2);
  }
  if (locomotion.kind === "centre-pass") {
    return F32(
      CSSOCCER_CENTRE_PASS_ACTION_PROFILE.baseFrameStep
        * locomotion.motionCaptureSpeed,
    );
  }
  throw new CssoccerUnsupportedPlayerAnimationError(
    "locomotion",
    `Player animation locomotion ${locomotion.kind} has no qualified frame-step formula.`,
  );
}

function animationForLocomotion(locomotion) {
  if (locomotion.kind === "stand") return STAND_ANIMATION;
  if (locomotion.kind === "socks-right") return SOCKS_RIGHT_ANIMATION;
  if (locomotion.kind === "socks-left") return SOCKS_LEFT_ANIMATION;
  if (locomotion.kind === "barge") return BARGE_ANIMATION;
  if (locomotion.kind === "fall-right") return FALL_RIGHT_ANIMATION;
  if (locomotion.kind === "get-up-front") return GET_UP_FRONT_ANIMATION;
  if (locomotion.kind === "backheel") {
    return locomotion.foot === "right"
      ? BACKHEEL_RIGHT_ANIMATION
      : BACKHEEL_LEFT_ANIMATION;
  }
  if (isRunLocomotion(locomotion.kind)) return RUN_ANIMATION;
  if (
    locomotion.kind === "side-step"
    && QUALIFIED_SIDE_STEP_DIRECTIONS.has(locomotion.direction)
  ) {
    return TROT_ANIMATION_BY_DIRECTION[locomotion.direction];
  }
  if (locomotion.kind === "centre-pass") return CENTRE_PASS_ANIMATION;
  throw new CssoccerUnsupportedPlayerAnimationError(
    "locomotion",
    `Player animation locomotion ${locomotion.kind} has no qualified animation id.`,
  );
}

function frameCountForAnimation(animation) {
  if (animation === CENTRE_PASS_ANIMATION) return CENTRE_PASS_PREPARED_FRAME_COUNT;
  if (animation === BACKHEEL_RIGHT_ANIMATION || animation === BACKHEEL_LEFT_ANIMATION) {
    return BACKHEEL_FRAME_COUNT;
  }
  if (animation === SOCKS_RIGHT_ANIMATION) return SOCKS_FRAME_COUNT;
  if (animation === SOCKS_LEFT_ANIMATION) return SOCKS_FRAME_COUNT;
  if (animation === BARGE_ANIMATION) return BARGE_FRAME_COUNT;
  if (animation === FALL_RIGHT_ANIMATION) return FALL_RIGHT_FRAME_COUNT;
  if (animation === GET_UP_FRONT_ANIMATION) return GET_UP_FRONT_FRAME_COUNT;
  if (TROT_FRAME_COUNT_BY_ANIMATION[animation]) {
    return TROT_FRAME_COUNT_BY_ANIMATION[animation];
  }
  if (animation === RUN_ANIMATION) return RUN_FRAME_COUNT;
  if (animation === STAND_ANIMATION) return STAND_FRAME_COUNT;
  throw new CssoccerUnsupportedPlayerAnimationError(
    "prepared-slot",
    `Player animation ${animation} has no qualified prepared slot.`,
  );
}

function locomotionForAction(action, animation) {
  if (action === STAND_ACTION && animation === STAND_ANIMATION) {
    return deepFreeze({ kind: "stand" });
  }
  if (action === RUN_ACTION && animation === RUN_ANIMATION) {
    return deepFreeze({ kind: "run" });
  }
  if (action === RUN_ACTION && isTrotAnimation(animation)) {
    const direction = Object.entries(TROT_ANIMATION_BY_DIRECTION)
      .find(([, animationId]) => animationId === animation)?.[0];
    if (direction !== undefined) {
      return deepFreeze({ kind: "side-step", direction: Number(direction) });
    }
  }
  throw new CssoccerUnsupportedPlayerAnimationError(
    "action",
    `Player animation action ${action}/animation ${animation} has no qualified baseline locomotion.`,
  );
}

function stateLocomotion(profile) {
  if (profile.kind === "barge") {
    return deepFreeze({ kind: profile.kind, withBall: profile.withBall });
  }
  if (profile.kind === "side-step") {
    return deepFreeze({ kind: profile.kind, direction: profile.direction });
  }
  if (profile.kind === "centre-pass") {
    return deepFreeze({
      kind: profile.kind,
      motionCaptureSpeed: profile.motionCaptureSpeed,
      contact: profile.contact,
    });
  }
  if (profile.kind === "backheel") {
    return deepFreeze({
      kind: profile.kind,
      foot: profile.foot,
      motionCaptureSpeed: profile.motionCaptureSpeed,
      contact: profile.contact,
    });
  }
  if (profile.kind === "get-up-front") {
    return deepFreeze({
      kind: profile.kind,
      fallCountdown: profile.fallCountdown,
    });
  }
  return deepFreeze({ kind: profile.kind });
}

function requireStateLocomotion(value, label) {
  requirePlainObject(value, label);
  if (!LOCOMOTION_KINDS.has(value.kind)) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "locomotion",
      `${label} ${value.kind} is outside the qualified opening subset.`,
    );
  }
  const keys = value.kind === "side-step"
    ? ["direction", "kind"]
    : value.kind === "barge"
      ? ["kind", "withBall"]
      : value.kind === "centre-pass"
      ? ["contact", "kind", "motionCaptureSpeed"]
      : value.kind === "backheel"
        ? ["contact", "foot", "kind", "motionCaptureSpeed"]
      : value.kind === "get-up-front"
        ? ["fallCountdown", "kind"]
      : ["kind"];
  requireExactKeys(value, keys, label);
  if (
    value.kind === "side-step"
    && !QUALIFIED_SIDE_STEP_DIRECTIONS.has(value.direction)
  ) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "side-step-direction",
      `${label} direction ${value.direction} is outside the qualified directional-trot frontier.`,
    );
  }
  if (value.kind === "barge") {
    requireBoolean(value.withBall, `${label} withBall`);
  }
  if (value.kind === "centre-pass") {
    requirePositiveF32(value.motionCaptureSpeed, `${label} motionCaptureSpeed`);
    requireF32(value.contact, `${label} contact`);
    if (value.contact !== CSSOCCER_CENTRE_PASS_ACTION_PROFILE.contact) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "centre-pass-contact",
        `${label} contact changed from the compiled MCC_PASS profile.`,
      );
    }
  }
  if (value.kind === "backheel") {
    if (value.foot !== "left" && value.foot !== "right") {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "backheel-foot",
        `${label} foot ${value.foot} is outside the source selector.`,
      );
    }
    requirePositiveF32(value.motionCaptureSpeed, `${label} motionCaptureSpeed`);
    requireF32(value.contact, `${label} contact`);
    if (value.contact !== BACKHEEL_CONTACT) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "backheel-contact",
        `${label} contact changed from compiled MCC_BACKHEEL.`,
      );
    }
  }
  if (value.kind === "get-up-front") {
    requireUint32(value.fallCountdown, `${label} fallCountdown`);
    if (value.fallCountdown !== 1) {
      throw new CssoccerUnsupportedPlayerAnimationError(
        "get-up-fall-countdown",
        `${label} must preserve source fall countdown one.`,
        { fallCountdown: value.fallCountdown },
      );
    }
  }
  return value;
}

function requireActionLocomotion(action, kind, playerId) {
  const accepted = kind === "stand"
    ? [STAND_ACTION, STOP_ACTION]
    : isSocksLocomotion(kind)
      ? [STAND_ACTION]
      : kind === "barge"
        ? [RUN_ACTION]
        : kind === "fall-right"
          ? [FALL_ACTION]
          : kind === "get-up-front"
            ? [FALL_ACTION]
          : kind === "centre-pass" || kind === "backheel"
            ? [KICK_ACTION]
            : [RUN_ACTION];
  if (!accepted.includes(action)) {
    throw new CssoccerUnsupportedPlayerAnimationError(
      "action-locomotion",
      `${playerId} action ${action} cannot use ${kind} locomotion.`,
      { action, kind, accepted },
    );
  }
}

function isRunLocomotion(kind) {
  return kind === "run" || kind === "run-with-ball";
}

function isSocksLocomotion(kind) {
  return kind === "socks-left" || kind === "socks-right";
}

function isTrotAnimation(animation) {
  return animation >= 64 && animation <= 71;
}

function typedInteger(fieldId, valueType, value) {
  const width = valueType === "u16" || valueType === "i16" ? 4 : 2;
  return {
    fieldId,
    valueType,
    value,
    numericBits: value.toString(16).padStart(width, "0"),
  };
}

function typedF32(fieldId, value) {
  const rounded = F32(value);
  return {
    fieldId,
    valueType: "f32",
    value: rounded,
    numericBits: f32Bits(rounded),
  };
}

function requireTypedInteger(value, fieldId, valueType, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["fieldId", "numericBits", "value", "valueType"], label);
  if (
    value.fieldId !== fieldId
    || value.valueType !== valueType
    || !Number.isInteger(value.value)
    || value.value < 0
    || value.value > 0xffff
    || value.numericBits !== value.value.toString(16).padStart(4, "0")
  ) {
    throw new TypeError(`${label} must preserve exact ${valueType} value and bits.`);
  }
}

function requireTypedF32(value, fieldId, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["fieldId", "numericBits", "value", "valueType"], label);
  if (
    value.fieldId !== fieldId
    || value.valueType !== "f32"
    || !Number.isFinite(value.value)
    || value.numericBits !== f32Bits(value.value)
  ) {
    throw new TypeError(`${label} must preserve exact f32 value and bits.`);
  }
}

function requireBindings(value) {
  requirePlainObject(value, "player animation bindings");
  requireExactKeys(value, Object.keys(BINDINGS), "player animation bindings");
  if (!/^[a-f0-9]{40}$/u.test(value.sourceRevision ?? "")) {
    throw new Error("Player animation source revision is invalid.");
  }
  for (const key of Object.keys(BINDINGS).filter((key) => key !== "sourceRevision")) {
    if (!SHA256.test(value[key] ?? "")) {
      throw new Error(`Player animation ${key} binding is invalid.`);
    }
  }
}

function f32FromBits(bits) {
  if (!/^[a-f0-9]{8}$/u.test(bits)) throw new Error("Invalid player animation f32 bits.");
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, Number.parseInt(bits, 16), false);
  return view.getFloat32(0, false);
}

function f32Bits(value) {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  return view.getUint32(0, false).toString(16).padStart(8, "0");
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new TypeError(`${label} must be an exact u32.`);
  }
}

function requireU8(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new TypeError(`${label} must be an exact u8.`);
  }
}

function requireU16(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new TypeError(`${label} must be an exact u16.`);
  }
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || F32(value) !== value) {
    throw new TypeError(`${label} must be an exact f32.`);
  }
  return value;
}

function requirePositiveF32(value, label) {
  requireF32(value, label);
  if (value <= 0) throw new TypeError(`${label} must be positive.`);
  return value;
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
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
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

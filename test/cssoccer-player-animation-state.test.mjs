import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  projectCssoccerNativeTeamRates,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  projectCssoccerKickoffSourceProfile,
} from "../src/cssoccer/nativeGameplayProfile.mjs";
import {
  CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
} from "../src/cssoccer/centrePassAction.mjs";
import {
  CSSOCCER_PLAYER_ANIMATION_BASELINE_HASH,
  CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
  CSSOCCER_PLAYER_ANIMATION_SOURCE,
  CSSOCCER_PLAYER_ANIMATION_STATE_SCHEMA,
  CssoccerUnsupportedPlayerAnimationError,
  assertCssoccerPlayerAnimationState,
  createCssoccerPlayerAnimationProfile,
  createCssoccerPlayerAnimationState,
  projectCssoccerShotKickLaunch,
  projectCssoccerPlayerAnimationNativeFields,
  projectCssoccerPlayerAnimationRenderSlots,
  stepCssoccerPlayerAnimationState,
} from "../src/cssoccer/playerAnimationState.mjs";
import {
  assertCssoccerKickoffPlayerMotion,
  createCssoccerKickoffPlayerMotion,
  stepCssoccerKickoffPlayerMotion,
} from "../src/cssoccer/kickoffPlayerMotion.mjs";
import { createCssoccerKickoffState } from "../src/cssoccer/kickoffState.mjs";
import { createCssoccerMatchState } from "../src/cssoccer/matchState.mjs";
import {
  normalizeSourceVector,
  sourceFacingDirection,
} from "../src/cssoccer/motionState.mjs";
import {
  createCssoccerPlayerRenderCommands,
  createCssoccerPlayerRenderContract,
} from "../src/cssoccer/playerRenderState.mjs";
import { createCssoccerExactActuaPlayerAssetRuntime } from
  "../src/cssoccer/exactActuaPlayerAssets.mjs";

const ROOT = new URL("../", import.meta.url);
const F32 = Math.fround;
const RUNTIME_URL = new URL("src/cssoccer/playerAnimationState.mjs", ROOT);
const ACTIONS_URL = new URL(".local/actua-soccer/source/ACTIONS.CPP", ROOT);
const ANDYDEFS_URL = new URL(".local/actua-soccer/source/ANDYDEFS.H", ROOT);
const DATA_URL = new URL(".local/actua-soccer/source/DATA.H", ROOT);
const UPDATE_URL = new URL(".local/actua-soccer/source/3D_UPD2.CPP", ROOT);
const FOOTBALL_URL = new URL(".local/actua-soccer/source/FOOTBALL.CPP", ROOT);
const RULES_URL = new URL(".local/actua-soccer/source/RULES.CPP", ROOT);
const BALLINT_URL = new URL(".local/actua-soccer/source/BALLINT.CPP", ROOT);
const INTELL_URL = new URL(".local/actua-soccer/source/INTELL.CPP", ROOT);
const RETAINED_ROOT = new URL(
  ".local/cssoccer/oracle/native/retained/runs/canonical-a/",
  ROOT,
);
const RETAINED_STATE_URL = new URL("state.jsonl", RETAINED_ROOT);
const RETAINED_RAW_URL = new URL("native.raw", RETAINED_ROOT);
const FACTS_URL = new URL(
  "build/generated/public/cssoccer/facts/spain-argentina-full-match.json",
  ROOT,
);
const SCENE_URL = new URL(
  "build/generated/public/cssoccer/scenes/spain-argentina-full-match.json",
  ROOT,
);
const RENDER_ASSETS_URL = new URL(
  "build/generated/public/cssoccer/assets/spain-argentina-render-bundles.json",
  ROOT,
);
const EXACT_PLAYER_INDEX_URL = new URL(
  "build/generated/public/cssoccer/assets/animation/exact-player/index.json",
  ROOT,
);
const EXACT_PLAYER_MATERIALS_URL = new URL(
  "build/generated/public/cssoccer/assets/spain-argentina-exact-player-materials.json",
  ROOT,
);
const EXACT_OFFICIAL_INDEX_URL = new URL(
  "build/generated/public/cssoccer/assets/animation/exact-official/index.json",
  ROOT,
);
const EXACT_OFFICIAL_MATERIALS_URL = new URL(
  "build/generated/public/cssoccer/assets/spain-argentina-exact-official-materials.json",
  ROOT,
);
const hasSource = [
  ACTIONS_URL,
  ANDYDEFS_URL,
  DATA_URL,
  UPDATE_URL,
  FOOTBALL_URL,
  RULES_URL,
  BALLINT_URL,
  INTELL_URL,
].every(existsSync);
const hasRetained = existsSync(RETAINED_STATE_URL) && existsSync(RETAINED_RAW_URL);
const hasPrepared = [
  FACTS_URL,
  SCENE_URL,
  RENDER_ASSETS_URL,
  EXACT_PLAYER_INDEX_URL,
  EXACT_PLAYER_MATERIALS_URL,
  EXACT_OFFICIAL_INDEX_URL,
  EXACT_OFFICIAL_MATERIALS_URL,
].every(existsSync);
const RAW_TEAMS_OFFSET = 0x3cf6c;
const RAW_PLAYER_BYTES = 203;
const RAW_PLAYER_FACTS = Object.freeze({
  positionX: [2, "f32"],
  facingX: [6, "f32"],
  positionY: [10, "f32"],
  facingY: [14, "f32"],
  distanceToBall: [37, "f32"],
  animationLimbo: [42, "i16"],
  stopped: [49, "u8"],
  teamRate: [70, "u8"],
  animationFrameStep: [115, "f32"],
  animation: [119, "u16"],
  motionCaptureSpeed: [123, "f32"],
  contact: [135, "f32"],
  animationInitialized: [139, "u8"],
  bargeCountdown: [140, "u8"],
  action: [142, "i16"],
  goCount: [156, "i32"],
  goTargetX: [168, "f32"],
  goTargetY: [172, "f32"],
  goStep: [189, "u8"],
  intentionMove: [191, "i16"],
  intentionCount: [193, "i16"],
});

test("immutable baseline binds every accepted fixture and oracle identity", () => {
  const state = createState();
  assert.equal(state.schema, CSSOCCER_PLAYER_ANIMATION_STATE_SCHEMA);
  assert.equal(state.baselineHash, CSSOCCER_PLAYER_ANIMATION_BASELINE_HASH);
  assert.equal(state.tick, 11);
  assert.equal(state.qualifiedThroughTick, 230);
  assert.equal(state.players.length, 22);
  assert.deepEqual(
    state.players.map(({ id, nativePlayerNumber }) => [id, nativePlayerNumber]),
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map(
      ({ id, kickoffNativePlayerNumber }) => [id, kickoffNativePlayerNumber],
    ),
  );
  assert.deepEqual(Object.keys(state.bindings), [
    "sourceRevision",
    "sourceDataSha256",
    "nativeSourceSha256",
    "nativeBuildSha256",
    "nativeScenarioSha256",
    "nativeProfileSha256",
    "nativeFieldContractSha256",
    "nativeRawSha256",
    "nativeStateSha256",
    "nativeGameplayProfileHash",
    "nativeFixturePlayerProfileHash",
  ]);
  assert.equal(state.bindings.nativeGameplayProfileHash, CSSOCCER_NATIVE_GAMEPLAY_PROFILE.profileHash);
  assert.equal(
    state.bindings.nativeFixturePlayerProfileHash,
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.profileHash,
  );
  assert.equal(assertCssoccerPlayerAnimationState(state), state);
  assertDeepFrozen(state);

  const { baselineHash: ignored, ...payload } = state;
  assert.equal(sha256(canonicalJson(payload)), CSSOCCER_PLAYER_ANIMATION_BASELINE_HASH);
  assert.equal(JSON.stringify(createState()), JSON.stringify(state));

  assert.deepEqual(state.players[0].animation, {
    fieldId: "players.spain-player-01.animation",
    valueType: "u16",
    value: 72,
    numericBits: "0048",
  });
  assert.equal(state.players[0].animationFrame.numericBits, "3f8bda02");
  assert.deepEqual(state.players[0].animationLimbo, {
    fieldId: "players.spain-player-01.animation_limbo",
    valueType: "i16",
    value: 0,
    numericBits: "0000",
  });
  assert.equal(state.players[0].animationFrameStep.numericBits, "3ddfc337");
  assert.equal(state.players[0].teamRate, 62);
  assert.deepEqual(state.players[0].locomotion, { kind: "run" });
  assert.equal(state.players[9].action.value, 1);
  assert.equal(state.players[9].animation.value, 70);
  assert.equal(state.players[9].animationFrame.numericBits, "3f6963ed");
  assert.equal(state.players[9].animationFrameStep.numericBits, "3dbab656");
  assert.deepEqual(state.players[9].locomotion, { kind: "side-step", direction: 5 });
  assert.equal(state.players[20].animationFrameStep.numericBits, "3df44d19");
});

test("local source owns typed fields, cadence formulas, process order, and prepared selection", {
  skip: !hasSource ? "ignored Actua source checkout unavailable" : false,
}, () => {
  const actions = readFileSync(ACTIONS_URL, "utf8");
  const definitions = readFileSync(ANDYDEFS_URL, "utf8");
  const data = readFileSync(DATA_URL, "utf8");
  const update = readFileSync(UPDATE_URL, "utf8");
  const football = readFileSync(FOOTBALL_URL, "utf8");
  const rules = readFileSync(RULES_URL, "utf8");
  const ballint = readFileSync(BALLINT_URL, "utf8");
  const intelligence = readFileSync(INTELL_URL, "utf8");

  assert.equal(sha256(actions), CSSOCCER_PLAYER_ANIMATION_SOURCE.files[0].sha256);
  assert.equal(sha256(definitions), CSSOCCER_PLAYER_ANIMATION_SOURCE.files[1].sha256);
  assert.equal(sha256(data), CSSOCCER_PLAYER_ANIMATION_SOURCE.files[2].sha256);
  assert.equal(sha256(update), CSSOCCER_PLAYER_ANIMATION_SOURCE.files[3].sha256);
  assert.equal(sha256(football), CSSOCCER_PLAYER_ANIMATION_SOURCE.files[5].sha256);
  assert.equal(sha256(rules), CSSOCCER_PLAYER_ANIMATION_SOURCE.files[6].sha256);
  assert.equal(sha256(ballint), CSSOCCER_PLAYER_ANIMATION_SOURCE.files[7].sha256);
  assert.equal(sha256(intelligence), CSSOCCER_PLAYER_ANIMATION_SOURCE.files[8].sha256);
  assert.match(
    definitions,
    /float tm_frm,tm_fstep;[\s\S]*unsigned short tm_anim;[\s\S]*char tm_newanim;/u,
  );
  assert.match(data, /#define MC_RUN 72\s+\/\/ 26 Frames/u);
  assert.match(data, /#define MC_STAND 78\s+\/\/ 39 Frames/u);
  assert.match(data, /#define MC_PASSL 39\s+\/\/ 33 Frames/u);
  assert.match(data, /#define MCC_PASS \(48\.\/99\)/u);
  assert.match(data, /#define MC_BACKHEELR 52\s+\/\/ 32 Frames/u);
  assert.match(data, /#define MC_BACKHEELL 53\s+\/\/ 32 Frames/u);
  assert.match(data, /#define MCC_BACKHEEL \(65\.\/97\)/u);
  assert.match(data, /#define MC_SOCKSR 62\s+\/\/ 68 Frames/u);
  assert.match(data, /#define MC_SOCKSL 63\s+\/\/ 68 Frames/u);
  assert.match(data, /#define MC_TROTB 64\s+\/\/ 27 Frames/u);
  assert.match(data, /#define MC_TROTH 65\s+\/\/ 27 Frames/u);
  assert.match(data, /#define MC_TROTC 67\s+\/\/ 28 Frames/u);
  assert.match(data, /#define MC_TROTD 68\s+\/\/ 25 Frames/u);
  assert.match(data, /#define MC_TROTF 69\s+\/\/ 25 Frames/u);
  assert.match(data, /#define MC_TROTA 70\s+\/\/ 32 Frames/u);
  assert.match(data, /#define MC_TROTE 71\s+\/\/ 26 Frames/u);
  assert.match(data, /#define MC_BARGE 74\s+\/\/ 27 Frames/u);
  assert.match(data, /#define MC_FALLR 90\s+\/\/ 34 Frames/u);
  assert.match(data, /#define MC_GETUPF 95\s+\/\/ 87 Frames/u);
  assert.match(
    actions,
    /void init_stand_anim[\s\S]*tm_anim=MC_STAND;[\s\S]*tm_newanim=TRUE;[\s\S]*tm_frm=0;[\s\S]*tm_fstep=MC_STAND_FS;/u,
  );
  assert.match(
    actions,
    /void init_run_anim[\s\S]*tm_fstep=MC_RUN_FS\*\(actual_spd\(player\)\/MC_RUN_SPD\)[\s\S]*tm_anim=MC_RUN;[\s\S]*tm_newanim=TRUE;[\s\S]*tm_frm=0;/u,
  );
  assert.match(
    actions,
    /void init_trot_anim[\s\S]*tm_fstep=actual_spd\(player\)\*MC_TROTA_FS\/2[\s\S]*1\+get_dir\(nx,ny\)[\s\S]*case\(4\):[\s\S]*tm_anim=MC_TROTB[\s\S]*case\(2\):[\s\S]*tm_anim=MC_TROTD[\s\S]*case\(1\):[\s\S]*tm_anim=MC_TROTE/u,
  );
  assert.match(
    actions,
    /void init_trot_anim[\s\S]*case\(8\):[\s\S]*tm_anim=MC_TROTF/u,
  );
  assert.match(
    actions,
    /void init_trot_anim[\s\S]*case\(3\):[\s\S]*tm_anim=MC_TROTC/u,
  );
  assert.match(
    actions,
    /void init_kick_act[\s\S]*init_anim\(player,mc\)[\s\S]*tm_fstep=player->tm_fstep\*player->tm_mcspd[\s\S]*player->contact=pc/u,
  );
  assert.match(
    actions,
    /void init_kick_anim[\s\S]*case\(MC_BACKHEELL\)[\s\S]*t>=0\.3 && t<0\.8[\s\S]*t=\(t-0\.3\)[\s\S]*an-=1[\s\S]*f=0\.8[\s\S]*tm_frm=\(t\*f\)[\s\S]*tm_fstep=MC_BACKHEEL_FS/u,
  );
  assert.match(
    actions,
    /void init_stop_act[\s\S]*tm_act=STOP_ACT[\s\S]*init_anim\(player,MC_STAND\)/u,
  );
  assert.match(
    actions,
    /void stand_action[\s\S]*seed<SOCKS_PROB[\s\S]*seed&1[\s\S]*init_anim\(player,MC_SOCKSL\)[\s\S]*init_anim\(player,MC_SOCKSR\)/u,
  );
  assert.match(
    actions,
    /void init_get_up[\s\S]*int_cnt=1\+\(1\.0\/fs\)[\s\S]*int_move=I_GET_UP/u,
  );
  assert.match(
    actions,
    /void init_socks_anim[\s\S]*tm_anim=ABS\(an\)[\s\S]*tm_frm=0[\s\S]*tm_fstep=MC_SOCKS_FS/u,
  );
  assert.match(
    actions,
    /void tussle_collision[\s\S]*init_anim\(p2,MC_BARGE\)[\s\S]*p2->tm_barge=20/u,
  );
  assert.match(
    actions,
    /void init_barge_anim[\s\S]*tm_anim=MC_BARGE[\s\S]*tm_fstep=MC_BARGE_FS\*\(actual_spd\(player\)\/MC_RUN_SPD\)[\s\S]*tm_frm\+=0\.5/u,
  );
  assert.match(
    actions,
    /void init_steal_act[\s\S]*tm_act=STEAL_ACT[\s\S]*init_anim\(player,MC_PASSL\)/u,
  );
  assert.match(
    actions,
    /void init_fall[\s\S]*tm_act=FALL_ACT[\s\S]*init_anim\(player,MC_FALLR\)/u,
  );
  assert.match(
    actions,
    /void init_fallr_anim[\s\S]*tm_fstep=MC_FALLR_FS[\s\S]*tm_anim=MC_FALLR[\s\S]*tm_frm=0/u,
  );
  assert.match(
    actions,
    /void fall_action[\s\S]*go_cnt==1[\s\S]*init_anim\(player,MC_GETUPF\)[\s\S]*tm_fstep\*=\(\(float\)\(player->tm_rate\+128\)\/128\)[\s\S]*tm_limbo=1\/player->tm_fstep/u,
  );
  assert.match(
    actions,
    /void init_getupf_anim[\s\S]*tm_fstep=MC_GETUPF_FS[\s\S]*tm_anim=MC_GETUPF[\s\S]*tm_frm=0/u,
  );
  assert.match(
    actions,
    /void init_run_act[\s\S]*player->go_step=TRUE[\s\S]*init_trot_anims\(player\)/u,
  );
  assert.match(
    actions,
    /void process_anims[\s\S]*tm_frm\+=player->tm_fstep;/u,
  );
  assert.match(
    actions,
    /void process_anims[\s\S]*if \(player->tm_limbo\)[\s\S]*if \(!--player->tm_limbo\)[\s\S]*case\(MC_GETUPF\):[\s\S]*init_stand_act\(player\)/u,
  );
  assert.match(
    actions,
    /void go_team[\s\S]*process_anims\(&teams\[player_num-1\]\)[\s\S]*if \(user_controlled\)[\s\S]*user_play\(player_num\)[\s\S]*computer_play\(player_num\)/u,
  );
  assert.match(actions, /void user_play[\s\S]*do_action\(\);/u);
  assert.match(actions, /void computer_play[\s\S]*do_action\(\);/u);
  assert.match(ballint, /void ball_interact\(match_player \*player\)/u);
  assert.match(
    intelligence,
    /void find_zonal_target[\s\S]*player->tm_player==KP_A[\s\S]*player->tm_player==KP_B[\s\S]*init_run_act\(player,tx\+px,ty\+py,TRUE\)/u,
  );
  assert.match(
    intelligence,
    /void find_zonal_target[\s\S]*if \(!player->int_cnt\)[\s\S]*player->tm_act==RUN_ACT[\s\S]*init_run_act\(player,tx\+px,ty\+py,TRUE\)/u,
  );
  assert.match(
    intelligence,
    /void make_pass[\s\S]*case\(1\):[\s\S]*init_kick_act\(&teams\[ball_poss-1\],MC_BACKHEELL,MCC_BACKHEEL\)/u,
  );
  assert.match(
    update,
    /nx=modf\(newp->frame,&n\);[\s\S]*ptr->frame=nx;/u,
  );
  assert.match(
    football,
    /void player_stamina[\s\S]*match_time\.min!=old_min[\s\S]*sin\(\(PI\*teams\[i\]\.tm_time\/120\)-\(PI\/2\)\)[\s\S]*teams\[i\]\.tm_rate=ir-t/u,
  );
  assert.match(
    rules,
    /void match_clock[\s\S]*match_time\.sec\+=90\.0\/\(time_factor\*REAL_SPEED\)[\s\S]*match_time\.min\+=1[\s\S]*add_player_time\(\)/u,
  );

  const mirror = CSSOCCER_PLAYER_ANIMATION_SOURCE.files[4];
  assert.deepEqual(
    {
      revision: mirror.revision,
      blobSha: mirror.blobSha,
      sha256: mirror.sha256,
      lines: mirror.lines,
    },
    {
      revision: "2232754037ba7e2dfbf3f0d7dbe4dd6574380225",
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
  );
  assert.deepEqual(CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.cadence, {
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
    runReferenceSpeed: 3.19,
  });
  assert.deepEqual(CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.actionIds, {
    stand: 0,
    run: 1,
    fall: 5,
    stealTransient: 14,
    centrePass: 15,
    stop: 20,
  });
  assert.deepEqual(CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.idle, {
    socksProbability: 15,
  });
  assert.deepEqual(CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.kick, {
    backheelContact: F32(65 / 97),
    backheelLocalContactOffset: {
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
    },
    backheelMovementDistance: 10.14,
    backheelPhaseScale: F32(0.8),
    backheelTargetDistance: F32(100),
    chipContact: F32(40 / 91),
    chipLocalContactOffset: {
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
    },
    rightFootPhaseStart: 0.3,
    rightFootPhaseEnd: 0.8,
  });
  assert.equal(CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.animationIds.socksRight, 62);
  assert.equal(CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.animationIds.backheelRight, 52);
  assert.equal(
    CSSOCCER_PLAYER_ANIMATION_SOURCE.inputSeam.schedulerStatus,
    "profile contract only; this module does not claim the match scheduler materializes these facts",
  );
});

test("all 22 independently reproduce the contiguous retained ticks 11 through 230", {
  skip: !hasRetained || !hasPrepared
    ? "ignored canonical native evidence or prepared opening source unavailable"
    : false,
}, async () => {
  const retained = await retainedWindow(11, 231);
  const stateBindings = createState().bindings;
  assert.equal(retained.header.bindings.sourceSha256, stateBindings.nativeSourceSha256);
  assert.equal(retained.header.bindings.buildSha256, stateBindings.nativeBuildSha256);
  assert.equal(retained.header.bindings.scenarioSha256, stateBindings.nativeScenarioSha256);
  assert.equal(retained.header.bindings.profileSha256, stateBindings.nativeProfileSha256);
  assert.equal(retained.header.bindings.contractSha256, stateBindings.nativeFieldContractSha256);
  assert.equal(await hashFile(RETAINED_STATE_URL), stateBindings.nativeStateSha256);

  const rawBytes = readFileSync(RETAINED_RAW_URL);
  assert.equal(sha256(rawBytes), stateBindings.nativeRawSha256);
  const raw = parseRawWindow(rawBytes, 11, 231);

  let state = createState();
  let profileSource = createOpeningProfileSource();
  while (profileSource.tick < 11) {
    profileSource = advanceOpeningProfileSource(profileSource, profileSource.tick + 1).state;
  }
  assert.equal(profileSource.tick, state.tick);
  assert.deepEqual(
    state.players.map(({ id, action, locomotion }) => ({
      id,
      action: action.value,
      kind: locomotion.kind,
    })),
    profileSource.players.map(({ id, action, lastPlan }) => ({
      id,
      action,
      kind: lastPlan?.choice === "side-step" ? "side-step" : action === 0 ? "stand" : "run",
    })),
  );

  for (let tick = 11; tick <= 230; tick += 1) {
    assert.equal(state.tick, tick);
    const actual = projectCssoccerPlayerAnimationNativeFields(state);
    const expected = expectedRetainedFields(retained.ticks.get(tick));
    assert.deepEqual(actual, expected, `typed retained fields at tick ${tick}`);
    assert.deepEqual(actual, expectedRawFields(raw.get(tick)), `raw native fields at tick ${tick}`);
    assert.deepEqual(
      state.players.map(({ action }) => action),
      expectedRetainedActions(retained.ticks.get(tick)),
      `typed retained actions at tick ${tick}`,
    );
    assert.deepEqual(
      state.players.map(({ id, teamRate }) => ({ id, teamRate })),
      expectedRawTeamRates(raw.get(tick)),
      `raw source profile tm_rate at tick ${tick}`,
    );
    assert.deepEqual(
      state.players.map(({ id, animationLimbo }) => ({ id, animationLimbo })),
      expectedRawAnimationLimbos(raw.get(tick)),
      `raw source animation limbo at tick ${tick}`,
    );
    if (tick < 230) {
      const nextTick = tick + 1;
      const nextProfile = tick < 155
        ? advanceOpeningProfileSource(profileSource, nextTick)
        : null;
      let players;
      try {
        players = nextProfile
          ? nextProfile.inputs
          : normalPlayProfileInputs(
              state,
              raw.get(nextTick),
              raw.get(tick),
              retained.ticks.get(nextTick),
              retained.ticks.get(tick),
            );
      } catch (error) {
        error.message = `tick ${nextTick}: ${error.message}`;
        throw error;
      }
      const input = {
        tick: nextTick,
        players,
      };
      let left;
      try {
        left = stepCssoccerPlayerAnimationState(state, input);
      } catch (error) {
        error.message = `tick ${nextTick}: ${error.message}`;
        throw error;
      }
      const right = stepCssoccerPlayerAnimationState(state, structuredClone(input));
      assert.deepEqual(right, left);
      assert.equal(JSON.stringify(right), JSON.stringify(left));
      state = left;
      if (nextProfile) profileSource = nextProfile.state;
    }
  }

  assert.equal(
    retained.ticks.get(183).get("players.spain-player-06.animation_frame").numericBits,
    "00000000",
  );
  assert.equal(readRawPlayerFact(raw.get(182), 5, "animationInitialized").value, 0);
  assert.equal(readRawPlayerFact(raw.get(183), 5, "animationInitialized").value, 1);
  assert.equal(readRawPlayerFact(raw.get(184), 5, "animationInitialized").value, 0);
  assert.equal(readRawPlayerFact(raw.get(183), 5, "animation").value, 72);
  assert.equal(state.tick, 230);

  assert.equal(retained.ticks.get(197).get("players.spain-player-10.action").value, 15);
  assert.equal(retained.ticks.get(197).get("players.spain-player-10.animation").value, 52);
  assert.equal(
    retained.ticks.get(197).get("players.spain-player-10.animation_frame").numericBits,
    "3e58db97",
  );
  assert.equal(readRawPlayerFact(raw.get(197), 9, "contact").numericBits, "3f2b8be0");
  assert.equal(readRawPlayerFact(raw.get(197), 9, "animationFrameStep").numericBits, "3d680000");
  assert.equal(readRawPlayerFact(raw.get(197), 9, "animationInitialized").value, 1);
  assert.equal(readRawPlayerFact(raw.get(198), 9, "animationInitialized").value, 0);
  assert.equal(retained.ticks.get(210).get("players.spain-player-10.animation").value, 78);
  assert.equal(retained.ticks.get(206).get("players.spain-player-07.animation").value, 78);
  assert.equal(
    retained.ticks.get(206).get("players.spain-player-07.animation_frame").numericBits,
    "00000000",
  );
  assert.equal(readRawPlayerFact(raw.get(205), 6, "animationInitialized").value, 0);
  assert.equal(readRawPlayerFact(raw.get(206), 6, "animationInitialized").value, 1);
  assert.equal(retained.ticks.get(231).get("players.argentina-player-08.action").value, 1);
  assert.equal(retained.ticks.get(231).get("players.argentina-player-08.animation").value, 66);
  assert.equal(sourceRawSideStepDirection(raw.get(231), raw.get(230), 18), 7);
  assert.ok(CSSOCCER_PLAYER_ANIMATION_SOURCE.supported.some((entry) => (
    entry.includes("all source directions 1..8 side-step cadence")
    && entry.includes("MC_TROTG")
  )));
  const tick231Profiles = normalPlayProfileInputs(
    state,
    raw.get(231),
    raw.get(230),
    retained.ticks.get(231),
    retained.ticks.get(230),
  );
  const argentina08 = tick231Profiles.find(({ id }) => id === "argentina-player-08");
  assert.equal(argentina08.profile.kind, "side-step");
  assert.equal(argentina08.profile.direction, 7);
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, { tick: 231, players: actionInputs(state) }),
    unsupported("qualified-window"),
  );
});

test("backheel, get-up, fall, barge, socks, centre pass, stop, run, and directional trot use only source initialization branches", () => {
  const initial = createState();
  const actions = actionInputs(initial);
  actions[0].action = typedAction("spain-player-01", 15);
  actions[0].profile = animationProfile("centre-pass", 62, true, {
    motionCaptureSpeed: F32(1.109375),
    contact: CSSOCCER_CENTRE_PASS_ACTION_PROFILE.contact,
  });
  actions[9].action = typedAction("spain-player-10", 1);
  actions[9].profile = animationProfile("run", 64, true);
  actions[1].profile = animationProfile("side-step", 69, true, 4);
  actions[2].profile = animationProfile("side-step", 68, true, 2);
  actions[3].profile = animationProfile("side-step", 48, true, 1);
  actions[4].profile = animationProfile("side-step", 70, true, 5);
  actions[5].action = typedAction("spain-player-06", 20);
  actions[5].profile = animationProfile("stand", 58, true);
  actions[6].action = typedAction("spain-player-07", 0);
  actions[6].profile = animationProfile("socks-left", 74, true);
  actions[13].action = typedAction("argentina-player-03", 0);
  actions[13].profile = animationProfile("socks-right", 63, true);
  actions[16].action = typedAction("argentina-player-06", 15);
  actions[16].profile = animationProfile("backheel", initial.players[16].teamRate, true, {
    contact: CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.kick.backheelContact,
    foot: "right",
    motionCaptureSpeed: F32(0.90625),
  });
  actions[7].profile = animationProfile("barge", 59, true, {
    tussleAccepted: true,
    withBall: false,
  });
  actions[8].profile = animationProfile("side-step", 61, true, 6);
  actions[10].action = typedAction("spain-player-11", 5);
  actions[10].profile = animationProfile("fall-right", 66, true, {
    tussleAccepted: true,
  });
  actions[11].profile = animationProfile("side-step", 67, true, 8);
  actions[12].profile = animationProfile("side-step", 71, true, 3);
  const next = stepCssoccerPlayerAnimationState(initial, { tick: 12, players: actions });

  assert.deepEqual(next.players[0].animation, {
    fieldId: "players.spain-player-01.animation",
    valueType: "u16",
    value: 39,
    numericBits: "0027",
  });
  const centrePassStep = F32(
    CSSOCCER_CENTRE_PASS_ACTION_PROFILE.baseFrameStep * F32(1.109375),
  );
  assert.equal(next.players[0].animationFrame.value, centrePassStep);
  assert.equal(next.players[0].animationFrameStep.value, centrePassStep);
  assert.deepEqual(next.players[0].locomotion, {
    kind: "centre-pass",
    motionCaptureSpeed: F32(1.109375),
    contact: CSSOCCER_CENTRE_PASS_ACTION_PROFILE.contact,
  });
  assert.equal(next.players[9].animation.value, 72);
  assert.equal(next.players[9].animationFrame.numericBits, "00000000");
  assert.equal(next.players[9].animationFrameStep.numericBits, "3de1c2ad");
  assert.equal(next.players[1].animation.value, 64);
  assert.equal(next.players[1].animationFrame.numericBits, "00000000");
  assert.equal(next.players[1].animationFrameStep.numericBits, "3dd00d01");
  assert.equal(next.players[2].animation.value, 68);
  assert.equal(next.players[3].animation.value, 71);
  assert.equal(next.players[4].animation.value, 70);
  assert.deepEqual(next.players[1].locomotion, { kind: "side-step", direction: 4 });
  assert.equal(next.players[5].action.value, 20);
  assert.equal(next.players[5].animation.value, 78);
  assert.equal(next.players[5].animationFrame.numericBits, "00000000");
  assert.equal(next.players[6].animation.value, 63);
  assert.equal(next.players[6].animationFrame.numericBits, "00000000");
  assert.equal(next.players[6].animationFrameStep.value, F32(1 / (20 * 68 / 40)));
  assert.deepEqual(next.players[6].locomotion, { kind: "socks-left" });
  assert.equal(next.players[13].action.value, 0);
  assert.equal(next.players[13].animation.value, 62);
  assert.equal(next.players[13].animationFrame.numericBits, "00000000");
  assert.equal(next.players[13].animationFrameStep.value, F32(1 / (20 * 68 / 40)));
  assert.deepEqual(next.players[13].locomotion, { kind: "socks-right" });
  assert.equal(next.players[16].action.value, 15);
  assert.equal(next.players[16].animation.value, 52);
  assert.equal(
    next.players[16].animationFrame.value,
    sourceBackheelSelection(initial.players[16]).frame,
  );
  assert.equal(next.players[16].animationFrameStep.numericBits, "3d680000");
  assert.deepEqual(next.players[16].locomotion, {
    kind: "backheel",
    foot: "right",
    motionCaptureSpeed: F32(0.90625),
    contact: F32(65 / 97),
  });
  assert.equal(next.players[7].animation.value, 74);
  assert.equal(
    next.players[7].animationFrame.value,
    F32(F32(
      initial.players[7].animationFrame.value
        + initial.players[7].animationFrameStep.value,
    ) + 0.5),
  );
  assert.deepEqual(next.players[7].locomotion, { kind: "barge", withBall: false });
  assert.equal(next.players[8].animation.value, 65);
  assert.equal(next.players[8].animationFrame.numericBits, "00000000");
  assert.deepEqual(next.players[8].locomotion, { kind: "side-step", direction: 6 });
  assert.equal(next.players[10].action.value, 5);
  assert.equal(next.players[10].animation.value, 90);
  assert.equal(next.players[10].animationFrame.numericBits, "00000000");
  assert.equal(next.players[10].animationFrameStep.numericBits, "3d70f0f1");
  assert.deepEqual(next.players[10].locomotion, { kind: "fall-right" });
  assert.equal(next.players[11].animation.value, 69);
  assert.deepEqual(next.players[11].locomotion, { kind: "side-step", direction: 8 });
  assert.equal(next.players[12].animation.value, 67);
  assert.equal(next.players[12].animationFrame.numericBits, "00000000");
  assert.deepEqual(next.players[12].locomotion, { kind: "side-step", direction: 3 });

  const getUpActions = actionInputs(next);
  getUpActions[10].profile = animationProfile("get-up-front", 66, true, {
    fallCountdown: 1,
  });
  const getUp = stepCssoccerPlayerAnimationState(next, {
    tick: 13,
    players: getUpActions,
  });
  const getUpStep = F32(F32(1 / (20 * 87 / 40)) * F32((66 + 128) / 128));
  assert.equal(getUp.players[10].action.value, 5);
  assert.equal(getUp.players[10].animation.value, 95);
  assert.equal(getUp.players[10].animationFrame.numericBits, "00000000");
  assert.equal(getUp.players[10].animationFrameStep.value, getUpStep);
  assert.equal(getUp.players[10].animationLimbo.value, Math.trunc(1 / getUpStep));
  assert.deepEqual(getUp.players[10].locomotion, {
    kind: "get-up-front",
    fallCountdown: 1,
  });

  const continued = stepCssoccerPlayerAnimationState(getUp, {
    tick: 14,
    players: actionInputs(getUp),
  });
  assert.equal(continued.players[10].animationFrame.value, getUpStep);
  assert.equal(
    continued.players[10].animationLimbo.value,
    getUp.players[10].animationLimbo.value - 1,
  );
});

test("straight shot contact uses the exact immutable ACTIONS.OBJ initializer row", () => {
  const launch = projectCssoccerShotKickLaunch({
    animation: 72,
    animationFrame: F32(0),
    animationFrameStep: F32(0.3),
    facing: {
      x: F32(-1),
      y: F32(-0.0000018881472669818322),
    },
    motionCaptureSpeed: F32(1),
    passType: -1,
    teamRate: 64,
  });

  assert.equal(launch.animation, 34);
  assert.equal(f32Bits(launch.contactOffset.x), "c0f09789");
  assert.equal(f32Bits(launch.contactOffset.y), "c0b0b34f");
  assert.equal(f32Bits(launch.contactOffset.z), "3fe3f6f5");

  const standing = projectCssoccerShotKickLaunch({
    animation: 78,
    animationFrame: F32(0),
    animationFrameStep: F32(0.1),
    facing: { x: F32(1), y: F32(0) },
    motionCaptureSpeed: F32(1),
    passType: -1,
    teamRate: 64,
  });
  assert.equal(standing.animation, 35);
  assert.equal(standing.foot, "left");
  assert.equal(f32Bits(standing.animationFrame), "00000000");
});

test("prepared slot projection is accepted unchanged by the real player-render adapter", {
  skip: !hasPrepared ? "generated prepared player publication unavailable" : false,
}, () => {
  const facts = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  const renderAssets = JSON.parse(readFileSync(RENDER_ASSETS_URL, "utf8"));
  const exactPlayerAssets = createCssoccerExactActuaPlayerAssetRuntime({
    index: JSON.parse(readFileSync(EXACT_PLAYER_INDEX_URL, "utf8")),
    materials: JSON.parse(readFileSync(EXACT_PLAYER_MATERIALS_URL, "utf8")),
    loadChunk: (descriptor) => JSON.parse(readFileSync(
      new URL(descriptor.path, new URL("build/generated/public/cssoccer/", ROOT)),
      "utf8",
    )),
  });
  const exactOfficialAssets = createCssoccerExactActuaPlayerAssetRuntime({
    index: JSON.parse(readFileSync(EXACT_OFFICIAL_INDEX_URL, "utf8")),
    materials: JSON.parse(readFileSync(EXACT_OFFICIAL_MATERIALS_URL, "utf8")),
    loadChunk: (descriptor) => JSON.parse(readFileSync(
      new URL(descriptor.path, new URL("build/generated/public/cssoccer/", ROOT)),
      "utf8",
    )),
  });
  const contract = createCssoccerPlayerRenderContract({
    preparedFacts: facts,
    renderAssets,
    exactPlayerAssets,
    exactOfficialAssets,
  });
  const initial = createState();
  const profiles = actionInputs(initial);
  profiles[0].action = typedAction(profiles[0].id, 15);
  profiles[0].profile = animationProfile("centre-pass", initial.players[0].teamRate, true, {
    motionCaptureSpeed: F32(1.109375),
    contact: CSSOCCER_CENTRE_PASS_ACTION_PROFILE.contact,
  });
  profiles[1].profile = animationProfile("side-step", initial.players[1].teamRate, true, 4);
  profiles[2].profile = animationProfile("side-step", initial.players[2].teamRate, true, 2);
  profiles[3].profile = animationProfile("side-step", initial.players[3].teamRate, true, 1);
  profiles[4].profile = animationProfile("side-step", initial.players[4].teamRate, true, 5);
  profiles[5].action = typedAction(profiles[5].id, 0);
  profiles[5].profile = animationProfile(
    "socks-left",
    initial.players[5].teamRate,
    true,
  );
  profiles[6].profile = animationProfile("barge", initial.players[6].teamRate, true, {
    tussleAccepted: true,
    withBall: false,
  });
  profiles[7].profile = animationProfile(
    "side-step",
    initial.players[7].teamRate,
    true,
    6,
  );
  profiles[8].action = typedAction(profiles[8].id, 5);
  profiles[8].profile = animationProfile(
    "fall-right",
    initial.players[8].teamRate,
    true,
    { tussleAccepted: true },
  );
  profiles[9].profile = animationProfile(
    "socks-right",
    initial.players[9].teamRate,
    true,
  );
  profiles[9].action = typedAction(profiles[9].id, 0);
  profiles[10].profile = animationProfile(
    "side-step",
    initial.players[10].teamRate,
    true,
    8,
  );
  profiles[11].profile = animationProfile(
    "side-step",
    initial.players[11].teamRate,
    true,
    3,
  );
  profiles[16].action = typedAction(profiles[16].id, 15);
  profiles[16].profile = animationProfile(
    "backheel",
    initial.players[16].teamRate,
    true,
    {
      contact: CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.kick.backheelContact,
      foot: "right",
      motionCaptureSpeed: F32(0.90625),
    },
  );
  const fallState = stepCssoccerPlayerAnimationState(initial, {
    tick: 12,
    players: profiles,
  });
  const getUpProfiles = actionInputs(fallState);
  getUpProfiles[8].profile = animationProfile(
    "get-up-front",
    fallState.players[8].teamRate,
    true,
    { fallCountdown: 1 },
  );
  const state = stepCssoccerPlayerAnimationState(fallState, {
    tick: 13,
    players: getUpProfiles,
  });
  const slots = projectCssoccerPlayerAnimationRenderSlots(state);
  assert.equal(slots.length, 22);
  assert.deepEqual(Object.keys(slots[0]), ["rootId", "nativePlayerNumber", "animation"]);
  assert.equal(slots[0].animation.slotId, 39);
  assert.equal(slots[1].animation.slotId, 64);
  assert.equal(slots[2].animation.slotId, 68);
  assert.equal(slots[3].animation.slotId, 71);
  assert.equal(slots[4].animation.slotId, 70);
  assert.equal(slots[5].animation.slotId, 63);
  assert.equal(slots[6].animation.slotId, 74);
  assert.equal(slots[7].animation.slotId, 65);
  assert.equal(slots[8].animation.slotId, 95);
  assert.equal(slots[10].animation.slotId, 69);
  assert.equal(slots[11].animation.slotId, 67);
  assert.equal(slots[9].animation.slotId, 62);
  assert.equal(slots[16].animation.slotId, 52);

  const batch = createCssoccerPlayerRenderCommands(contract, {
    tick: state.tick,
    matchHalf: 0,
    players: slots.map((slot) => ({
      ...slot,
      position: [0, 0, 0],
      facing: { cosine: 1, sine: 0 },
      visible: true,
    })),
  });
  assert.deepEqual(
    batch.commands.map(({ rootId, nativePlayerNumber, animation }) => ({
      rootId,
      nativePlayerNumber,
      slotId: animation.slotId,
      frame: animation.frame,
    })),
    slots.map(({ rootId, nativePlayerNumber, animation }) => ({
      rootId,
      nativePlayerNumber,
      slotId: animation.slotId,
      frame: animation.frame,
    })),
  );
  assert.ok(batch.commands.every(({ animation }) => (
    animation.preparedFrameId.startsWith(`mc-${String(animation.slotId).padStart(3, "0")}-f-`)
  )));
});

test("unsupported actions, evidence-shaped input, order drift, and state drift fail closed", () => {
  const state = createState();
  const actions = actionInputs(state);

  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, { tick: 13, players: actions }),
    /contiguous/u,
  );
  const kick = structuredClone(actions);
  kick[0].action = typedAction(kick[0].id, 2);
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, { tick: 12, players: kick }),
    unsupported("action"),
  );
  const reordered = structuredClone(actions);
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, { tick: 12, players: reordered }),
    unsupported("native-order"),
  );
  const evidenceShaped = structuredClone(actions);
  evidenceShaped[0].oracleFrame = 12;
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, { tick: 12, players: evidenceShaped }),
    /must contain exactly/u,
  );
  const uninitializedTransition = structuredClone(actions);
  uninitializedTransition[0].action = typedAction(uninitializedTransition[0].id, 0);
  uninitializedTransition[0].profile = animationProfile("stand", 62, false);
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, {
      tick: 12,
      players: uninitializedTransition,
    }),
    unsupported("profile-transition"),
  );
  assert.throws(
    () => createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind: "side-step",
      direction: 9,
      initialize: true,
      teamRate: 62,
    }),
    unsupported("side-step-direction"),
  );
  assert.throws(
    () => createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind: "run",
      direction: 5,
      initialize: true,
      teamRate: 62,
    }),
    /must contain exactly/u,
  );
  assert.throws(
    () => createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind: "run",
      initialize: false,
      phaseReset: true,
      teamRate: 62,
    }),
    unsupported("run-phase-reset"),
  );
  assert.throws(
    () => createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind: "centre-pass",
      contact: F32(0.5),
      initialize: true,
      motionCaptureSpeed: F32(1.109375),
      teamRate: 62,
    }),
    unsupported("centre-pass-contact"),
  );
  assert.throws(
    () => createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind: "backheel",
      contact: F32(0.5),
      foot: "right",
      initialize: true,
      motionCaptureSpeed: F32(0.90625),
      teamRate: 62,
    }),
    unsupported("backheel-contact"),
  );
  const wrongBackheelFoot = structuredClone(actions);
  wrongBackheelFoot[2].action = typedAction(wrongBackheelFoot[2].id, 15);
  wrongBackheelFoot[2].profile = animationProfile("backheel", 62, true, {
    contact: CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.kick.backheelContact,
    foot: "left",
    motionCaptureSpeed: F32(0.90625),
  });
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, {
      tick: 12,
      players: wrongBackheelFoot,
    }),
    unsupported("backheel-foot"),
  );
  assert.throws(
    () => createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind: "barge",
      initialize: true,
      teamRate: 62,
      tussleAccepted: false,
      withBall: false,
    }),
    unsupported("barge-tussle-acceptance"),
  );
  assert.throws(
    () => createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind: "fall-right",
      initialize: true,
      teamRate: 62,
      tussleAccepted: false,
    }),
    unsupported("fall-tussle-acceptance"),
  );
  assert.throws(
    () => createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind: "get-up-front",
      fallCountdown: 2,
      initialize: true,
      teamRate: 62,
    }),
    unsupported("get-up-fall-countdown"),
  );
  const getUpWhileRunning = structuredClone(actions);
  getUpWhileRunning[0].action = typedAction(getUpWhileRunning[0].id, 5);
  getUpWhileRunning[0].profile = animationProfile("get-up-front", 62, true, {
    fallCountdown: 1,
  });
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, {
      tick: 12,
      players: getUpWhileRunning,
    }),
    unsupported("get-up-transition"),
  );
  const fallWhileStanding = structuredClone(actions);
  fallWhileStanding[9].profile = animationProfile("fall-right", 64, true, {
    tussleAccepted: true,
  });
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, {
      tick: 12,
      players: fallWhileStanding,
    }),
    unsupported("action-locomotion"),
  );
  const bargeWhileStanding = structuredClone(actions);
  bargeWhileStanding[9].action = typedAction(bargeWhileStanding[9].id, 0);
  bargeWhileStanding[9].profile = animationProfile("barge", 64, true, {
    tussleAccepted: true,
    withBall: false,
  });
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, {
      tick: 12,
      players: bargeWhileStanding,
    }),
    unsupported("action-locomotion"),
  );
  const socksWhileRunning = structuredClone(actions);
  socksWhileRunning[0].profile = animationProfile("socks-left", 62, true);
  assert.throws(
    () => stepCssoccerPlayerAnimationState(state, {
      tick: 12,
      players: socksWhileRunning,
    }),
    unsupported("action-locomotion"),
  );

  const badFrameBits = structuredClone(state);
  badFrameBits.players[0].animationFrame.numericBits = "00000000";
  assert.throws(() => assertCssoccerPlayerAnimationState(badFrameBits), /exact f32/u);

  const badStep = structuredClone(state);
  badStep.players[0].animationFrameStep.value = Math.fround(0.5);
  badStep.players[0].animationFrameStep.numericBits = f32Bits(0.5);
  assert.throws(() => assertCssoccerPlayerAnimationState(badStep), /source formula/u);

  const badLimbo = structuredClone(state);
  badLimbo.players[0].animationLimbo.value = 1;
  badLimbo.players[0].animationLimbo.numericBits = "0001";
  assert.throws(() => assertCssoccerPlayerAnimationState(badLimbo), /limbo changed/u);

  const badBinding = structuredClone(state);
  badBinding.bindings.nativeRawSha256 = "0".repeat(64);
  assert.throws(() => assertCssoccerPlayerAnimationState(badBinding), /binding changed/u);

  const changedProfile = structuredClone(CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE);
  changedProfile.players[0].attributes.pace += 1;
  assert.throws(
    () => createCssoccerPlayerAnimationState({
      nativeFixturePlayerProfile: changedProfile,
      nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    }),
    /profile|value changed/u,
  );
});

test("runtime module has no filesystem, evidence reads, prepared data, or Node-only imports", () => {
  const source = readFileSync(RUNTIME_URL, "utf8");
  assert.doesNotMatch(
    source,
    /(?:node:|\.local\/|build\/generated|references\/|readFile|createHash|state\.jsonl|native\.raw)/u,
  );
  assert.deepEqual(
    [...source.matchAll(/^import[\s\S]*?from "([^"]+)";/gmu)].map((match) => match[1]),
    [
      "./nativeFixturePlayerProfile.mjs",
      "./nativeGameplayProfile.mjs",
      "./centrePassAction.mjs",
    ],
  );
});

function createState() {
  return createCssoccerPlayerAnimationState({
    nativeFixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  });
}

function actionInputs(state) {
  return state.players.map(({ id, nativePlayerNumber, action, locomotion, teamRate }) => ({
    id,
    nativePlayerNumber,
    action: structuredClone(action),
    profile: animationProfile(
      locomotion.kind,
      teamRate,
      false,
      locomotion,
    ),
  }));
}

function animationProfile(kind, teamRate, initialize, detail = {}) {
  if (kind === "side-step") {
    const direction = typeof detail === "number" ? detail : detail.direction;
    return createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind,
      direction,
      initialize,
      teamRate,
    });
  }
  if (kind === "centre-pass") {
    return createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind,
      contact: detail.contact,
      initialize,
      motionCaptureSpeed: detail.motionCaptureSpeed,
      teamRate,
    });
  }
  if (kind === "barge") {
    return createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind,
      initialize,
      teamRate,
      tussleAccepted: detail.tussleAccepted ?? initialize,
      withBall: detail.withBall,
    });
  }
  if (kind === "fall-right") {
    return createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind,
      initialize,
      teamRate,
      tussleAccepted: detail.tussleAccepted ?? initialize,
    });
  }
  if (kind === "get-up-front") {
    return createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind,
      fallCountdown: detail.fallCountdown,
      initialize,
      teamRate,
    });
  }
  if (kind === "backheel") {
    return createCssoccerPlayerAnimationProfile({
      schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
      kind,
      contact: detail.contact,
      foot: detail.foot,
      initialize,
      motionCaptureSpeed: detail.motionCaptureSpeed,
      teamRate,
    });
  }
  const profile = {
    schema: CSSOCCER_PLAYER_ANIMATION_PROFILE_SCHEMA,
    kind,
    initialize,
    teamRate,
  };
  if (
    (kind === "run" || kind === "run-with-ball")
    && typeof detail.phaseReset === "boolean"
  ) {
    profile.phaseReset = detail.phaseReset;
  }
  return createCssoccerPlayerAnimationProfile(profile);
}

function typedAction(id, value) {
  return {
    fieldId: `players.${id}.action`,
    valueType: "i16",
    value,
    numericBits: value.toString(16).padStart(4, "0"),
  };
}

function createOpeningProfileSource() {
  const facts = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  const scene = JSON.parse(readFileSync(SCENE_URL, "utf8"));
  const match = createCssoccerMatchState({
    preparedFacts: facts,
    preparedScene: scene,
    selectedCountry: "argentina",
  });
  const kickoff = createCssoccerKickoffState({
    lifecycle: match.lifecycle,
    tacticsState: match.tactics,
    sourceProfile: projectCssoccerKickoffSourceProfile(CSSOCCER_NATIVE_GAMEPLAY_PROFILE),
  });
  const teamRates = new Map(projectCssoccerNativeTeamRates(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf: 0 },
  ).map(({ id, value }) => [id, value]));
  const players = match.lifecycle.teamState.players.map((player) => {
    const target = kickoff.players.find(({ id }) => id === player.id);
    const source = player.formation.kickoff.sourceValues;
    assert.ok(target);
    return {
      id: player.id,
      nativePlayerNumber: target.nativePlayerNumber,
      active: player.current.active,
      teamRate: teamRates.get(player.id),
      action: source.action.value,
      directionMode: 0,
      faceDirection: 0,
      position: { x: source.x.value, y: source.y.value },
      facing: {
        x: source.xDisplacement.value,
        y: source.yDisplacement.value,
      },
    };
  }).sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
  return createCssoccerKickoffPlayerMotion({
    kickoffState: kickoff,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    pitchLength: F32(scene.dimensions.playingFieldNative.length),
    goToPositionDistance: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8,
    players,
    selectedCountry: match.selectedCountry,
  });
}

function advanceOpeningProfileSource(state, tick) {
  assert.equal(tick, state.tick + 1);
  const before = state;
  const next = stepCssoccerKickoffPlayerMotion(state, {
    teamRates: sourceStaminaRates(state, tick),
  });
  const inputs = tick <= 11 ? [] : next.players.map((player, index) => {
    const prior = before.players[index];
    const choice = player.lastPlan?.choice ?? null;
    const kind = player.action === 0
      ? "stand"
      : choice === "side-step" ? "side-step" : "run";
    const initialize = choice !== null && choice !== "within-position-tolerance";
    const direction = kind === "side-step" ? sourceSideStepDirection(prior) : undefined;
    return {
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      action: typedAction(player.id, player.action),
      profile: animationProfile(kind, player.teamRate, initialize, direction),
    };
  });
  return { state: next, inputs };
}

function sourceStaminaRates(state, tick) {
  const minute = Math.floor((tick * 9) / 240);
  const byId = new Map(CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map(
    (player) => [player.id, player],
  ));
  return state.players.map((player) => {
    const value = sourceStaminaRate(byId.get(player.id).attributes, minute);
    return {
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      valueType: "u8",
      value,
      numericBits: value.toString(16).padStart(2, "0"),
    };
  });
}

function sourceStaminaRate(attributes, playerMinutes) {
  const initialRate = attributes.pace;
  const stamina = attributes.stamina;
  const fatigueCurve = F32(
    (Math.sin((Math.PI * playerMinutes / 120) - (Math.PI / 2)) + 1) / 2,
  );
  const fatigue = F32(fatigueCurve * (129 - stamina) / 140 * initialRate);
  return Math.trunc(initialRate - fatigue);
}

function sourceSideStepDirection(player) {
  const target = {
    x: F32(player.target.x - player.position.x),
    y: F32(player.target.y - player.position.y),
  };
  const normalized = normalizeSourceVector(target);
  const relative = {
    x: F32(
      (normalized.x * player.facing.x)
      + (normalized.y * player.facing.y)
    ),
    y: F32(
      (normalized.y * player.facing.x)
      - (normalized.x * player.facing.y)
    ),
  };
  return 1 + sourceFacingDirection(relative);
}

/**
 * Focused adapter for the accepted downstream AI/motion seam. It reads only
 * ordinary native action, rate, contact, target, position, facing, distance,
 * intention, go-step, possession, RNG, and tm_newanim initializer facts;
 * retained animation ids/frames remain comparison output only.
 */
function normalPlayProfileInputs(
  state,
  currentRaw,
  previousRaw,
  ordinaryTick,
  previousOrdinaryTick,
) {
  const ballPossession = ordinaryTick.get("ball.possession")?.value;
  const rngSeed = ordinaryTick.get("rng.seed")?.value;
  const matchMode = ordinaryTick.get("rules.match_mode")?.value;
  const previousMatchMode = previousOrdinaryTick.get("rules.match_mode")?.value;
  assert.ok(Number.isSafeInteger(ballPossession));
  assert.ok(Number.isSafeInteger(rngSeed));
  assert.ok(Number.isSafeInteger(matchMode));
  assert.ok(Number.isSafeInteger(previousMatchMode));
  const enteredNormalPlay = matchMode === 0 && previousMatchMode !== 0;
  return state.players.map((player, index) => {
    const action = readRawPlayerFact(currentRaw, index, "action").value;
    const teamRate = readRawPlayerFact(currentRaw, index, "teamRate").value;
    let kind;
    let detail = {};
    let initialize = true;
    if (action === 15) {
      const contact = readRawPlayerFact(currentRaw, index, "contact").value;
      const backheel = contact
        === CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.kick.backheelContact;
      kind = backheel ? "backheel" : "centre-pass";
      detail = {
        motionCaptureSpeed: readRawPlayerFact(
          currentRaw,
          index,
          "motionCaptureSpeed",
        ).value,
        contact,
        ...(backheel ? {
          foot: player.locomotion.kind === "backheel"
            ? player.locomotion.foot
            : sourceBackheelSelection(player).foot,
        } : {}),
      };
    } else if (action === 5) {
      const fallCountdown = readRawPlayerFact(currentRaw, index, "goCount").value;
      if (
        fallCountdown === 1
        && (
          player.locomotion.kind === "fall-right"
          || player.locomotion.kind === "get-up-front"
        )
      ) {
        kind = "get-up-front";
        detail = { fallCountdown };
      } else {
        kind = "fall-right";
        detail = {
          tussleAccepted: player.action.value !== 5
            || player.locomotion.kind !== "fall-right",
        };
      }
    } else if (action === 0 || action === 20) {
      const idleKind = action === 0 ? sourceStandIdleKind({
        ballPossession,
        currentRaw,
        player,
        playerIndex: index,
        rngSeed,
      }) : null;
      kind = idleKind ?? "stand";
      if (action === 0 && idleKind === null) {
        const animationInitializedValue = readRawPlayerFact(
          currentRaw,
          index,
          "animationInitialized",
        ).value;
        assert.ok(
          animationInitializedValue === 0 || animationInitializedValue === 1,
          `${player.id} source tm_newanim must remain boolean-shaped`,
        );
        const goalkeeperZonalReset = (player.nativePlayerNumber === 1
          || player.nativePlayerNumber === 12)
          && readRawPlayerFact(currentRaw, index, "stopped").value === 0;
        initialize = player.action.value !== action
          || player.locomotion.kind !== "stand"
          || goalkeeperZonalReset
          || readRawPlayerFact(currentRaw, index, "goCount").value === 1
          || animationInitializedValue === 1
          || enteredNormalPlay;
      }
    } else if (action === 1) {
      const animationInitializedValue = readRawPlayerFact(
        currentRaw,
        index,
        "animationInitialized",
      ).value;
      assert.ok(
        animationInitializedValue === 0 || animationInitializedValue === 1,
        `${player.id} source tm_newanim must remain boolean-shaped`,
      );
      const animationInitialized = animationInitializedValue === 1;
      const sideStep = readRawPlayerFact(currentRaw, index, "goStep").value === 1;
      const bargeCountdown = readRawPlayerFact(
        currentRaw,
        index,
        "bargeCountdown",
      ).value;
      const retainedBarge = player.locomotion.kind === "barge" && bargeCountdown > 0;
      const acceptedTussle = player.locomotion.kind !== "barge" && bargeCountdown === 20;
      if (sideStep) {
        kind = "side-step";
        detail = sourceRawSideStepDirection(currentRaw, previousRaw, index);
      } else if (retainedBarge || acceptedTussle) {
        kind = "barge";
        detail = {
          tussleAccepted: acceptedTussle,
          withBall: acceptedTussle
            ? ballPossession === player.nativePlayerNumber
            : player.locomotion.withBall,
        };
      } else {
        kind = ballPossession === player.nativePlayerNumber ? "run-with-ball" : "run";
        detail = { phaseReset: animationInitialized };
      }
    } else {
      kind = "unsupported";
    }
    return {
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      action: typedAction(player.id, action),
      profile: animationProfile(
        kind,
        teamRate,
        kind === "barge" || kind === "fall-right"
          ? detail.tussleAccepted
          : kind === "get-up-front"
            ? player.locomotion.kind !== "get-up-front"
          : kind === "centre-pass" || kind === "backheel"
            ? player.action.value !== 15
            : initialize,
        detail,
      ),
    };
  });
}

function sourceBackheelSelection(player) {
  const advancedFrame = F32(
    player.animationFrame.value + player.animationFrameStep.value,
  );
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
    frame: F32(
      phase * CSSOCCER_PLAYER_ANIMATION_SOURCE.constants.kick.backheelPhaseScale,
    ),
  };
}

function sourceStandIdleKind({
  ballPossession,
  currentRaw,
  player,
  playerIndex,
  rngSeed,
}) {
  const sameTeamPossession = (
    (ballPossession > 11 && player.nativePlayerNumber > 11)
    || (
      ballPossession > 0
      && ballPossession < 12
      && player.nativePlayerNumber < 12
    )
  );
  const farFromBall = readRawPlayerFact(
    currentRaw,
    playerIndex,
    "distanceToBall",
  ).value > CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 50;
  const stopped = readRawPlayerFact(currentRaw, playerIndex, "stopped").value;
  const zonalOffset = {
    x: F32(
      readRawPlayerFact(currentRaw, playerIndex, "goTargetX").value
        - readRawPlayerFact(currentRaw, playerIndex, "positionX").value,
    ),
    y: F32(
      readRawPlayerFact(currentRaw, playerIndex, "goTargetY").value
        - readRawPlayerFact(currentRaw, playerIndex, "positionY").value,
    ),
  };
  const goalkeeperZonalReset = (
    player.nativePlayerNumber === 1 || player.nativePlayerNumber === 12
  ) && stopped === 0
    && Math.hypot(zonalOffset.x, zonalOffset.y)
      < CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.motion.imThereDistance.value;
  const reachesStandBeforeIdleSelection = player.animation.value === 78
    || goalkeeperZonalReset;
  const selectsSocks = reachesStandBeforeIdleSelection
    && stopped === 0
    && farFromBall
    && sameTeamPossession
    && rngSeed < 15;
  if (!selectsSocks) return null;
  return (rngSeed & 1) === 1 ? "socks-left" : "socks-right";
}

function sourceRawSideStepDirection(currentRaw, previousRaw, playerIndex) {
  const target = {
    x: F32(
      readRawPlayerFact(currentRaw, playerIndex, "goTargetX").value
        - readRawPlayerFact(previousRaw, playerIndex, "positionX").value,
    ),
    y: F32(
      readRawPlayerFact(currentRaw, playerIndex, "goTargetY").value
        - readRawPlayerFact(previousRaw, playerIndex, "positionY").value,
    ),
  };
  const normalized = normalizeSourceVector(target);
  const facing = {
    x: readRawPlayerFact(previousRaw, playerIndex, "facingX").value,
    y: readRawPlayerFact(previousRaw, playerIndex, "facingY").value,
  };
  const relative = {
    x: F32((normalized.x * facing.x) + (normalized.y * facing.y)),
    y: F32((normalized.y * facing.x) - (normalized.x * facing.y)),
  };
  return 1 + sourceFacingDirection(relative);
}

async function retainedWindow(startTick, endTick) {
  const ticks = new Map(
    Array.from({ length: endTick - startTick + 1 }, (_, index) => [startTick + index, new Map()]),
  );
  const input = createReadStream(RETAINED_STATE_URL);
  const lines = createInterface({ input, crlfDelay: Infinity });
  let header;
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.recordType === "header") {
      header = record;
      continue;
    }
    if (record.tick > endTick) {
      lines.close();
      input.destroy();
      break;
    }
    if (record.tick < startTick) continue;
    const match = /^players\.(.+)\.(action|animation|animation_frame)$/u.exec(record.fieldId);
    const ordinaryGlobal = record.fieldId === "ball.possession"
      || record.fieldId === "rng.seed"
      || record.fieldId === "rules.match_mode";
    if (!match && !ordinaryGlobal) continue;
    ticks.get(record.tick).set(record.fieldId, record);
  }
  assert.ok(header);
  assert.ok([...ticks.values()].every((tick) => tick.size === 69));
  return { header, ticks };
}

function expectedRetainedFields(tick) {
  return [...tick.values()]
    .filter(({ fieldId }) => fieldId.endsWith(".animation") || fieldId.endsWith(".animation_frame"))
    .map(({ schema: _schema, recordType: _recordType, tick: _tick, phase: _phase, ...field }) => field)
    .sort((left, right) => left.fieldId.localeCompare(right.fieldId));
}

function expectedRetainedActions(tick) {
  return CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map(({ id }) => {
    const { schema: _schema, recordType: _recordType, tick: _tick, phase: _phase, ...field } =
      tick.get(`players.${id}.action`);
    return field;
  });
}

function parseRawWindow(bytes, startTick, endTick) {
  assert.equal(bytes.subarray(0, 8).toString("ascii"), "CSSORAW2");
  assert.equal(bytes.readUInt32LE(8), 2);
  const rangeCount = bytes.readUInt32LE(12);
  let cursor = 16;
  let payloadBase = 0;
  const ranges = [];
  for (let index = 0; index < rangeCount; index += 1) {
    const offset = bytes.readUInt32LE(cursor);
    const width = bytes.readUInt32LE(cursor + 4);
    ranges.push({ offset, width, payloadBase });
    payloadBase += width;
    cursor += 8;
  }
  const metadataBytes = 28;
  const recordBytes = metadataBytes + payloadBase;
  assert.equal((bytes.length - cursor) % recordBytes, 0);
  const result = new Map();
  for (let recordOffset = cursor; recordOffset < bytes.length; recordOffset += recordBytes) {
    assert.equal(bytes.subarray(recordOffset, recordOffset + 4).toString("ascii"), "TIK1");
    const activeTick = bytes.readUInt32LE(recordOffset + 20);
    const flags = bytes.readUInt32LE(recordOffset + 24);
    if ((flags & 1) === 0 || activeTick < startTick || activeTick > endTick) continue;
    result.set(activeTick, { bytes, ranges, payloadOffset: recordOffset + metadataBytes });
  }
  assert.deepEqual([...result.keys()], range(startTick, endTick));
  return result;
}

function expectedRawFields(record) {
  return CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.flatMap(({ id }, index) => {
    const base = RAW_TEAMS_OFFSET + (index * RAW_PLAYER_BYTES);
    const animation = readRaw(record, base + 119, "u16");
    const frame = readRaw(record, base + 111, "f32");
    return [
      {
        fieldId: `players.${id}.animation`,
        valueType: "u16",
        value: animation.value,
        numericBits: animation.numericBits,
      },
      {
        fieldId: `players.${id}.animation_frame`,
        valueType: "f32",
        value: frame.value,
        numericBits: frame.numericBits,
      },
    ];
  }).sort((left, right) => left.fieldId.localeCompare(right.fieldId));
}

function expectedRawTeamRates(record) {
  return CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map(({ id }, index) => ({
    id,
    teamRate: readRawPlayerFact(record, index, "teamRate").value,
  }));
}

function expectedRawAnimationLimbos(record) {
  return CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map(({ id }, index) => ({
    id,
    animationLimbo: {
      fieldId: `players.${id}.animation_limbo`,
      valueType: "i16",
      ...readRawPlayerFact(record, index, "animationLimbo"),
    },
  }));
}

function readRawPlayerFact(record, playerIndex, fact) {
  const [relativeOffset, valueType] = RAW_PLAYER_FACTS[fact] ?? [];
  assert.ok(Number.isSafeInteger(relativeOffset), `known raw player fact ${fact}`);
  const offset = RAW_TEAMS_OFFSET + (playerIndex * RAW_PLAYER_BYTES) + relativeOffset;
  return readRaw(record, offset, valueType);
}

function readRaw(record, offset, valueType) {
  const width = valueType === "f32" || valueType === "i32"
    ? 4
    : valueType === "u8" ? 1 : 2;
  const rangeEntry = record.ranges.find((range) => (
    offset >= range.offset && offset + width <= range.offset + range.width
  ));
  assert.ok(rangeEntry, `raw offset 0x${offset.toString(16)} is retained`);
  const position = record.payloadOffset + rangeEntry.payloadBase + offset - rangeEntry.offset;
  if (valueType === "u16") {
    const value = record.bytes.readUInt16LE(position);
    return { value, numericBits: value.toString(16).padStart(4, "0") };
  }
  if (valueType === "i16") {
    return {
      value: record.bytes.readInt16LE(position),
      numericBits: record.bytes.readUInt16LE(position).toString(16).padStart(4, "0"),
    };
  }
  if (valueType === "u8") {
    const value = record.bytes.readUInt8(position);
    return { value, numericBits: value.toString(16).padStart(2, "0") };
  }
  if (valueType === "i32") {
    return {
      value: record.bytes.readInt32LE(position),
      numericBits: record.bytes.readUInt32LE(position).toString(16).padStart(8, "0"),
    };
  }
  return {
    value: record.bytes.readFloatLE(position),
    numericBits: record.bytes.readUInt32LE(position).toString(16).padStart(8, "0"),
  };
}

function unsupported(boundary) {
  return (error) => (
    error instanceof CssoccerUnsupportedPlayerAnimationError
    && error.code === "CSSOCCER_UNSUPPORTED_PLAYER_ANIMATION"
    && error.boundary === boundary
  );
}

function hashFile(url) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(url);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  )).join(",")}}`;
}

function f32Bits(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeFloatBE(value);
  return bytes.toString("hex");
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

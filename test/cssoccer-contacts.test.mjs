import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_CONTACT_SOURCE,
  CSSOCCER_PLAYER_TUSSLE_SOURCE,
  CssoccerUnsupportedPlayerTussleError,
  applyKeeperSaveResult,
  collectKeeperHandling,
  createContactProfile,
  createContactState,
  createCssoccerPlayerTussleFrame,
  nativeContactTraversalOrder,
  projectContactNativeFields,
  projectCssoccerPlayerTussleNativeFields,
  resolveCssoccerLooseBallControl,
  runContactScript,
  stepCssoccerPlayerTussleFrame,
  stepContactState,
} from "../src/cssoccer/contactState.mjs";
import {
  actualPlayerSpeed,
  sourceForwardDisplacement,
  updateSourcePosition2d,
} from "../src/cssoccer/motionState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
} from "../src/cssoccer/nativeGameplayProfile.mjs";
import {
  canNativeKeeperHandle,
  collectPossession,
  createPossessionState,
  releasePossession,
} from "../src/cssoccer/possessionState.mjs";
import {
  CSSOCCER_NATIVE_CONTACT_ACTION,
  UnsupportedContactSemanticsError,
  resolvePlayerTussles,
  resolveTacklePlayerContacts,
} from "../src/cssoccer/tackleState.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const retainedStateUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const retainedRawUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/native.raw",
  import.meta.url,
);
const matchContractUrl = new URL(
  "../references/spain-argentina-match.json",
  import.meta.url,
);
const footballUrl = new URL("FOOTBALL.CPP", sourceRoot);
const andydefsUrl = new URL("ANDYDEFS.H", sourceRoot);
const rulesUrl = new URL("RULES.CPP", sourceRoot);
const evidenceTestOptions = {
  skip: !existsSync(new URL("BALLINT.CPP", sourceRoot))
    || !existsSync(new URL("ACTIONS.CPP", sourceRoot))
    || !existsSync(new URL("INTELL.CPP", sourceRoot))
    || !existsSync(retainedStateUrl)
      ? "ignored source/native contact evidence is unavailable"
      : false,
};
const tussleEvidenceOptions = {
  skip: evidenceTestOptions.skip
    || !existsSync(retainedRawUrl)
    || !existsSync(matchContractUrl)
    || !existsSync(footballUrl)
    || !existsSync(andydefsUrl)
      ? "ignored source/native tussle evidence is unavailable"
      : false,
};

const F32 = Math.fround;
const TUSSLE_PRIOR_TICK = 214;
const TUSSLE_TICK = 215;
const NEXT_TUSSLE_TICK = 245;
const NEXT_CONTACT_TICK = 292;

const SOURCE_PROFILE = Object.freeze({
  touchBallBox: 10,
  atFeetDistance: 10,
  ballRadius: 2,
  playerHeight: 30,
  playerSize: 7,
  pitchRatio: 10,
  verticalBallDamp: 0.6,
  saveContact: 12,
  effectiveTackle: 2,
  fallRate: 1,
  refereeStrictness: 128,
});

test("loose-ball control is selected from live geometry, speed, facing, attributes, and RNG", () => {
  const ball = {
    position: { x: F32(660), y: F32(404), z: F32(2) },
    displacement: { x: F32(4.8), y: F32(0.6), z: F32(0) },
    speed: 2,
    inAir: 0,
    inGoal: 0,
    wantPass: 10,
  };
  const player = {
    nativePlayer: 10,
    action: CSSOCCER_NATIVE_CONTACT_ACTION.run,
    position: { x: F32(664), y: F32(409), z: F32(0) },
    faceDirection: 7,
    control: 76,
  };
  const accepted = resolveCssoccerLooseBallControl({
    ball,
    player,
    seed: 100,
    touchBallBox: 8,
    playerHeight: 25,
  });
  assert.equal(accepted.contact, true);
  assert.equal(accepted.controlAccepted, true);

  const missed = resolveCssoccerLooseBallControl({
    ball,
    player: {
      ...player,
      position: { x: F32(700), y: F32(409), z: F32(0) },
    },
    seed: 100,
    touchBallBox: 8,
    playerHeight: 25,
  });
  assert.deepEqual(missed, {
    contact: false,
    controlAccepted: null,
    difficulty: null,
    distance: missed.distance,
  });
});

test("checked source pins contact order, ownership mutation, and native action bindings", evidenceTestOptions, () => {
  const files = [
    ["BALLINT.CPP", "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327"],
    ["ACTIONS.CPP", "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508"],
    ["INTELL.CPP", "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad"],
  ];
  for (const [file, sha256] of files) {
    const bytes = readFileSync(new URL(file, sourceRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256);
  }
  const ballInt = readFileSync(new URL("BALLINT.CPP", sourceRoot), "utf8");
  const actions = readFileSync(new URL("ACTIONS.CPP", sourceRoot), "utf8");
  const intelligence = readFileSync(new URL("INTELL.CPP", sourceRoot), "utf8");
  assert.match(
    ballInt,
    /holder_lose_ball\(\);[\s\S]*collect_ball\(player\);[\s\S]*player->go_step=TRUE/u,
  );
  assert.match(
    ballInt,
    /ball_poss=player->tm_player;[\s\S]*player->tm_poss=1/u,
  );
  assert.match(
    actions,
    /init_tussles\(\);[\s\S]*if \(frame\)[\s\S]*go_team\(p\);[\s\S]*go_team\(p\);[\s\S]*player_tussles\(\);/u,
  );
  assert.match(
    intelligence,
    /player->tm_act==TACKLE_ACT[\s\S]*player->tm_act==STEAL_ACT[\s\S]*init_fall\(&teams\[i-1\]\)/u,
  );
  assert.deepEqual(CSSOCCER_CONTACT_SOURCE.updateOrder, [
    "player_ball_interaction",
    "player_tackle_interaction",
    "intelligence_and_action",
    "tussle_enlistment",
    "cross_team_tussles_after_both_teams",
  ]);
  assert.deepEqual(CSSOCCER_NATIVE_CONTACT_ACTION, {
    stand: 0,
    run: 1,
    turn: 2,
    tackle: 3,
    jump: 4,
    fall: 5,
    save: 10,
    keeperHold: 12,
    steal: 15,
    control: 17,
    strike: 18,
  });
});

test("tick 215 reconstructs the generic p1 tussle fall and matches typed plus raw state", tussleEvidenceOptions, async () => {
  const retained = await readRetainedTicks([TUSSLE_PRIOR_TICK, TUSSLE_TICK]);
  const frame = qualifiedTussleFrame();
  const transition = stepCssoccerPlayerTussleFrame(frame);
  const event = transition.events[0];
  assert.deepEqual(event, {
    type: "player-tussle-fall",
    left: { stableId: "spain-player-10", nativePlayerNumber: 10 },
    right: { stableId: "argentina-player-10", nativePlayerNumber: 21 },
    fallen: { stableId: "spain-player-10", nativePlayerNumber: 10 },
    shover: { stableId: "argentina-player-10", nativePlayerNumber: 21 },
    leftShoved: true,
    force: 402,
    releasedPossession: false,
    postFallShove: true,
  });
  assert.equal(transition.ballPossession.value, 7);
  assert.equal(transition.nativeFall.goCount.value, 16);
  assert.equal(transition.nativeFall.animationFrameStep.numericBits, "3d70f0f1");

  const projection = projectCssoccerPlayerTussleNativeFields(transition);
  assert.equal(projection.length, 27);
  assert.equal(new Set(projection.map(({ fieldId }) => fieldId)).size, 27);
  const expected = retained.get(TUSSLE_TICK);
  const raw = retainedRawRecord(TUSSLE_TICK);
  for (const field of projection) {
    assert.deepEqual(field, scalarRecord(requiredSample(expected, field.fieldId)), field.fieldId);
    if (field.valueType !== "string") {
      assert.deepEqual(field, rawTussleField(raw, field.fieldId), `raw ${field.fieldId}`);
    }
  }

  const fallen = transition.players.find(({ stableId }) => stableId === "spain-player-10");
  assert.deepEqual(fallen.goDisplacement.x, rawInternalField(
    raw,
    10,
    160,
    "f32",
    fallen.goDisplacement.x.fieldId,
  ));
  assert.deepEqual(fallen.goDisplacement.y, rawInternalField(
    raw,
    10,
    164,
    "f32",
    fallen.goDisplacement.y.fieldId,
  ));
  for (const [field, offset, type] of [
    [transition.nativeFall.animationFrameStep, 115, "f32"],
    [transition.nativeFall.directionMode, 109, "i16"],
    [transition.nativeFall.goCount, 156, "i32"],
    [transition.nativeFall.goTarget.x, 168, "f32"],
    [transition.nativeFall.goTarget.y, 172, "f32"],
    [transition.nativeFall.newAnimation, 139, "u8"],
  ]) {
    assert.deepEqual(field, rawInternalField(raw, 10, offset, type, field.fieldId));
  }

  const inputFields = typedLeaves(frame);
  for (const fieldId of [
    "players.spain-player-10.action",
    "players.spain-player-10.animation",
    "players.spain-player-10.animation_frame",
    "players.spain-player-10.x",
    "players.spain-player-10.y",
    "native.players.spain-player-10.go_txdis",
    "native.players.spain-player-10.go_tydis",
  ]) {
    const output = typedLeaves(transition).get(fieldId);
    assert.ok(output, `output ${fieldId}`);
    assert.notDeepEqual(inputFields.get(fieldId), output, `${fieldId} must be derived`);
  }
  assert.equal(
    [...inputFields.keys()].some((fieldId) => fieldId.endsWith(".go_tx") || fieldId.endsWith(".go_ty")),
    false,
    "post-fall targets are not accepted as runtime inputs",
  );
});

test("typed identity, pair order, bits, branch, and compiled bindings fail before mutation", tussleEvidenceOptions, () => {
  const frame = qualifiedTussleFrame();
  const before = JSON.stringify(frame);
  assert.equal(Object.isFrozen(frame), true);

  const wrongBits = structuredClone(frame);
  wrongBits.players[0].position.x.numericBits = "00000000";
  assert.throws(
    () => stepCssoccerPlayerTussleFrame(wrongBits),
    (error) => error instanceof CssoccerUnsupportedPlayerTussleError
      && error.boundary === "typed-field",
  );

  const reversed = structuredClone(frame);
  reversed.players.reverse();
  assert.throws(
    () => stepCssoccerPlayerTussleFrame(reversed),
    (error) => error instanceof CssoccerUnsupportedPlayerTussleError
      && error.boundary === "pair-order",
  );

  const wrongIdentity = structuredClone(frame);
  wrongIdentity.players[0].stableId = "spain-player-08";
  assert.throws(
    () => stepCssoccerPlayerTussleFrame(wrongIdentity),
    (error) => error instanceof CssoccerUnsupportedPlayerTussleError
      && error.boundary === "player-identity",
  );

  const wrongBuild = structuredClone(frame);
  wrongBuild.bindings.nativeBuildSha256 = "0".repeat(64);
  assert.throws(
    () => stepCssoccerPlayerTussleFrame(wrongBuild),
    (error) => error instanceof CssoccerUnsupportedPlayerTussleError
      && error.boundary === "frame-binding",
  );

  const bargeLaunch = structuredClone(frame);
  bargeLaunch.players[1].animation = typedTestValue(
    "players.argentina-player-10.animation",
    "u16",
    72,
  );
  const bargingFall = stepCssoccerPlayerTussleFrame(bargeLaunch);
  assert.equal(bargingFall.events[0].type, "player-tussle-fall");
  assert.equal(bargingFall.players[1].animation.value, 74);
  assert.equal(bargingFall.players[1].bargeCountdown.value, 20);

  const raw = retainedRawRecord(TUSSLE_PRIOR_TICK);
  const invalidInput = tusslePlayerInput(raw, retainedRawRecord(TUSSLE_TICK), 10);
  invalidInput.position.x = 0.1;
  assert.throws(
    () => createCssoccerPlayerTussleFrame({
      ...tussleFrameInput(),
      players: [
        invalidInput,
        tusslePlayerInput(raw, retainedRawRecord(TUSSLE_TICK), 21),
      ],
    }),
    /exact finite f32/u,
  );
  assert.equal(JSON.stringify(frame), before);
});

test("packed player ABI proves the tick-215 injury rewrite is not contact spill", tussleEvidenceOptions, () => {
  const prior = retainedRawRecord(TUSSLE_PRIOR_TICK);
  const current = retainedRawRecord(TUSSLE_TICK);
  const priorAttributes = Array.from({ length: 7 }, (_, index) => prior.readPlayer(10, 70 + index, "u8"));
  const currentAttributes = Array.from({ length: 7 }, (_, index) => current.readPlayer(10, 70 + index, "u8"));
  assert.deepEqual(priorAttributes, [32, 92, 76, 83, 47, 104, 71]);
  assert.deepEqual(currentAttributes, [28, 80, 75, 81, 47, 102, 65]);

  const fallByteOffsets = expandedFallByteOffsets(
    CSSOCCER_PLAYER_TUSSLE_SOURCE.abi.fallWrites,
  );
  for (let offset = 70; offset <= 76; offset += 1) {
    assert.equal(fallByteOffsets.has(offset), false, `attribute byte ${offset}`);
  }
  const andydefs = readFileSync(andydefsUrl, "utf8");
  const football = readFileSync(footballUrl, "utf8");
  const rules = readFileSync(rulesUrl, "utf8");
  for (const { file, sha256 } of CSSOCCER_PLAYER_TUSSLE_SOURCE.files) {
    assert.equal(
      createHash("sha256").update(readFileSync(new URL(file, sourceRoot))).digest("hex"),
      sha256,
      file,
    );
  }
  assert.match(
    andydefs,
    /unsigned char tm_rate;[\s\S]*tm_pow;[\s\S]*tm_cont;[\s\S]*tm_flair;[\s\S]*tm_vis;[\s\S]*tm_ac;[\s\S]*tm_stam;/u,
  );
  assert.match(
    football,
    /void init_player_stats\(short p\)[\s\S]*tm_rate=[\s\S]*tm_pow=[\s\S]*tm_cont=[\s\S]*tm_stam=/u,
  );
  assert.match(rules, /void inc_inj\(short p,short i\)[\s\S]*tm_inj\+=i/u);
  assert.equal(
    CSSOCCER_PLAYER_TUSSLE_SOURCE.abi.attributeBlock.producer,
    "linked tussle/contact path -> RULES.CPP inc_inj -> FOOTBALL.CPP init_player_stats (instruction trace; substitution state zero)",
  );
  assert.match(CSSOCCER_PLAYER_TUSSLE_SOURCE.abi.conclusion, /no fall\/contact field overlaps/u);
});

test("tick 245 reconstructs the generic non-fall shove and MC_BARGE launch", tussleEvidenceOptions, async () => {
  const retained = await readRetainedTicks([NEXT_TUSSLE_TICK]);
  const transition = stepCssoccerPlayerTussleFrame(
    createCssoccerPlayerTussleFrame(bargeTussleFrameInput()),
  );
  assert.equal(transition.events[0].type, "player-tussle-shove");
  assert.equal(transition.events[0].bargeLaunched, true);
  assert.deepEqual(transition.events[0].shover, {
    stableId: "spain-player-11",
    nativePlayerNumber: 11,
  });
  assert.deepEqual(transition.events[0].shoved, {
    stableId: "argentina-player-04",
    nativePlayerNumber: 15,
  });
  assert.equal(transition.nativeFall, null);
  assert.equal(transition.ballPossession.value, 7);

  const expected = retained.get(NEXT_TUSSLE_TICK);
  for (const field of projectCssoccerPlayerTussleNativeFields(transition)) {
    assert.deepEqual(field, scalarRecord(requiredSample(expected, field.fieldId)), field.fieldId);
  }
  const raw = retainedRawRecord(NEXT_TUSSLE_TICK);
  const shover = transition.players.find(({ nativePlayerNumber }) => nativePlayerNumber === 11);
  assert.deepEqual(shover.animationFrameStep, rawInternalField(
    raw,
    11,
    115,
    "f32",
    shover.animationFrameStep.fieldId,
  ));
  assert.deepEqual(shover.bargeCountdown, rawInternalField(
    raw,
    11,
    140,
    "u8",
    shover.bargeCountdown.fieldId,
  ));

  assert.deepEqual(scanRawContactFrontier(TUSSLE_TICK, NEXT_TUSSLE_TICK), [{
    tick: NEXT_TUSSLE_TICK,
    nativePlayerNumber: 11,
    kind: "barge-launch",
    action: 1,
    animation: 74,
    bargeCountdown: 20,
  }]);
  assert.deepEqual(scanRawContactFrontier(NEXT_TUSSLE_TICK, NEXT_CONTACT_TICK), [{
    tick: NEXT_CONTACT_TICK,
    nativePlayerNumber: 18,
    kind: "fall",
    action: 5,
    animation: 90,
    bargeCountdown: 0,
  }]);
  assert.deepEqual(CSSOCCER_PLAYER_TUSSLE_SOURCE.nextUnsupported, {
    tick: NEXT_CONTACT_TICK,
    fieldId: "players.argentina-player-07.action",
    producer: "ACTIONS.CPP player_tussles -> tussle_collision -> init_fall",
  });
});

test("possession release, collection, and keeper back-pass boundaries keep one-or-zero owners", () => {
  const initialPlayers = makePlayers({ owner: 6, ownerCount: 9 });
  const initial = createPossessionState({
    owner: 6,
    lastTouch: 6,
    previousTouch: 18,
    preKeeperTouch: 6,
    inHands: 0,
    cannotPickUp: 6,
    players: possessionPlayers(initialPlayers),
  });
  const released = releasePossession(initial);
  assert.equal(released.owner, 0);
  assert.ok(released.players.every(({ possession }) => possession === 0));

  const collected = collectPossession(released, 8);
  assert.equal(collected.owner, 8);
  assert.equal(collected.lastTouch, 8);
  assert.equal(collected.previousTouch, 6);
  assert.equal(collected.cannotPickUp, 8);
  assert.deepEqual(
    collected.players.filter(({ possession }) => possession > 0),
    [{ nativePlayer: 8, stableId: "spain-player-08", possession: 1 }],
  );
  assert.equal(canNativeKeeperHandle({ nativePlayer: 1, inPenaltyArea: true, cannotPickUp: 6 }), false);
  assert.equal(canNativeKeeperHandle({ nativePlayer: 1, inPenaltyArea: true, cannotPickUp: 18 }), true);
  assert.equal(canNativeKeeperHandle({ nativePlayer: 12, inPenaltyArea: true, cannotPickUp: 18 }), false);
  assert.equal(canNativeKeeperHandle({ nativePlayer: 12, inPenaltyArea: true, cannotPickUp: 6 }), true);
  assert.equal(canNativeKeeperHandle({ nativePlayer: 12, inPenaltyArea: false, cannotPickUp: 6 }), false);
});

test("native team traversal and in-team tie order are stable, including cross-team transfer order", () => {
  assert.deepEqual(nativeContactTraversalOrder(1), [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  ]);
  assert.deepEqual(nativeContactTraversalOrder(0), [
    12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  ]);

  const sameTeam = makeState({
    frameParity: 1,
    ball: ballAt(4, 0),
    playerOverrides: {
      2: playerAt(0, 0, { facing: { x: 1, y: 0 }, faceDirection: 4 }),
      3: playerAt(8, 0, { facing: { x: -1, y: 0 }, faceDirection: 0 }),
    },
  });
  assert.equal(stepContactState(sameTeam).state.possession.owner, 2);

  const crossTeamAFirst = makeState({
    frameParity: 1,
    ball: ballAt(4, 0),
    playerOverrides: {
      2: playerAt(0, 0, { facing: { x: 1, y: 0 }, faceDirection: 4 }),
      13: playerAt(8, 0, { facing: { x: -1, y: 0 }, faceDirection: 0 }),
    },
  });
  const aFirst = stepContactState(crossTeamAFirst);
  assert.equal(aFirst.state.possession.owner, 13);
  assert.deepEqual(
    aFirst.events.filter(({ type }) => type.includes("possession") || type.includes("collect"))
      .map(({ type, nativePlayer }) => [type, nativePlayer]),
    [
      ["ball-collect", 2],
      ["possession-release", 2],
      ["ball-collect", 13],
    ],
  );

  const crossTeamBFirst = createContactState({ ...crossTeamAFirst, frameParity: 0 });
  assert.equal(stepContactState(crossTeamBFirst).state.possession.owner, 2);
});

test("release followed by a teammate contact is a deterministic pass collection seam", () => {
  const owned = makeState({
    owner: 6,
    ownerCount: 4,
    lastTouch: 6,
    ball: ballAt(400, 400),
    playerOverrides: {
      6: playerAt(350, 400),
      8: playerAt(400, 400, { action: CSSOCCER_NATIVE_CONTACT_ACTION.run }),
    },
  });
  const possession = releasePossession(owned.possession);
  const state = createContactState({
    ...owned,
    players: owned.players.map((player) => ({ ...player, possession: 0 })),
    possession,
  });
  const first = stepContactState(state);
  const second = stepContactState(state);
  assert.equal(first.state.possession.owner, 8);
  assert.equal(first.state.possession.lastTouch, 8);
  assert.equal(first.state.players.find(({ nativePlayer }) => nativePlayer === 8).possession, 1);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("tackle collection and keeper catch preserve typed ownership/action fields", () => {
  const tackleState = makeState({
    owner: 18,
    ownerCount: 7,
    lastTouch: 18,
    frameParity: 0,
    rng: { randSeed: 2539, seed: 107 },
    ball: {
      position: { x: 649.648681640625, y: 292.80712890625, z: 2 },
      displacement: { x: 0, y: 0, z: 0 },
      speed: 0,
      inAir: 0,
      inGoal: 0,
      wantPass: 0,
    },
    playerOverrides: {
      6: playerAt(646.0291748046875, 292.2212829589844, {
        action: CSSOCCER_NATIVE_CONTACT_ACTION.tackle,
        facing: { x: 0.9871530532836914, y: 0.1597771793603897 },
        faceDirection: 4,
        goDisplacement: { x: 6.357265472412109, y: 1.028964877128601 },
        power: 60,
        control: 55,
        flair: 48,
        goCount: 10,
      }),
      18: playerAt(651.2464599609375, 282.93560791015625, {
        facing: { x: -0.15977796912193298, y: 0.9871529340744019 },
        faceDirection: 2,
        goDisplacement: { x: 0, y: 0 },
        possession: 7,
      }),
    },
  });
  const tackled = stepContactState(tackleState).state;
  assert.equal(tackled.possession.owner, 6);
  assert.equal(tackled.possession.lastTouch, 6);
  assert.deepEqual(tackled.ball.position, {
    x: 655.9006958007812,
    y: 293.8190612792969,
    z: 2,
  });
  assert.deepEqual(tackled.ball.displacement, {
    x: 6.357265472412109,
    y: 1.028964877128601,
    z: 0,
  });
  assertProjectedFields(tackled, new Map([
    ["ball.in_hands", typedTestValue("ball.in_hands", "u8", 0)],
    ["ball.last_touch", typedTestValue("ball.last_touch", "i32", 6)],
    ["ball.possession", typedTestValue("ball.possession", "i32", 6)],
    ["players.argentina-player-07.action", typedTestValue("players.argentina-player-07.action", "i16", 0)],
    ["players.argentina-player-07.possession", typedTestValue("players.argentina-player-07.possession", "i16", 0)],
    ["players.spain-player-06.action", typedTestValue("players.spain-player-06.action", "i16", 3)],
    ["players.spain-player-06.possession", typedTestValue("players.spain-player-06.possession", "i16", 1)],
  ]), [
    "ball.in_hands",
    "ball.last_touch",
    "ball.possession",
    "players.argentina-player-07.action",
    "players.argentina-player-07.possession",
    "players.spain-player-06.action",
    "players.spain-player-06.possession",
  ]);

  const saveState = makeState({
    owner: 10,
    ownerCount: 8,
    lastTouch: 10,
    playerOverrides: {
      12: playerAt(1251.5560302734375, 293.109130859375, {
        action: CSSOCCER_NATIVE_CONTACT_ACTION.save,
        inPenaltyArea: true,
      }),
    },
  });
  const caught = applyKeeperSaveResult(saveState, {
    nativePlayer: 12,
    outcome: "catch",
  }).state;
  assert.equal(caught.possession.owner, 12);
  assert.equal(caught.possession.inHands, 1);
  assertProjectedFields(caught, new Map([
    ["ball.in_hands", typedTestValue("ball.in_hands", "u8", 1)],
    ["ball.last_touch", typedTestValue("ball.last_touch", "i32", 12)],
    ["ball.possession", typedTestValue("ball.possession", "i32", 12)],
    ["players.argentina-player-01.action", typedTestValue("players.argentina-player-01.action", "i16", 10)],
    ["players.argentina-player-01.possession", typedTestValue("players.argentina-player-01.possession", "i16", 1)],
    ["players.spain-player-10.possession", typedTestValue("players.spain-player-10.possession", "i16", 0)],
  ]), [
    "ball.in_hands",
    "ball.last_touch",
    "ball.possession",
    "players.argentina-player-01.action",
    "players.argentina-player-01.possession",
    "players.spain-player-10.possession",
  ]);
});

test("keeper handling and block seams enforce boundaries and require engine rebound state", () => {
  const teammateBackPass = makeState({
    owner: 6,
    ownerCount: 3,
    lastTouch: 6,
    cannotPickUp: 6,
    playerOverrides: { 1: playerAt(10, 10, { inPenaltyArea: true }) },
  });
  assert.throws(
    () => collectKeeperHandling(teammateBackPass, 1),
    (error) => error instanceof UnsupportedContactSemanticsError,
  );

  const opponentTouch = makeState({
    owner: 18,
    ownerCount: 3,
    lastTouch: 18,
    cannotPickUp: 18,
    playerOverrides: { 1: playerAt(10, 10, { inPenaltyArea: true }) },
  });
  const handled = collectKeeperHandling(opponentTouch, 1).state;
  assert.equal(handled.possession.owner, 1);
  assert.equal(handled.possession.inHands, 1);

  const blockState = makeState({
    playerOverrides: {
      1: playerAt(10, 10, {
        action: CSSOCCER_NATIVE_CONTACT_ACTION.save,
        inPenaltyArea: true,
      }),
    },
  });
  assert.throws(
    () => applyKeeperSaveResult(blockState, { nativePlayer: 1, outcome: "block" }),
    (error) => error instanceof UnsupportedContactSemanticsError
      && /engine-produced rebound/u.test(error.message),
  );
  const rebound = {
    position: { x: 20, y: 12, z: 8 },
    displacement: { x: -4, y: 1, z: 2 },
    speed: 1,
    inAir: 1,
    inGoal: 0,
    wantPass: 0,
  };
  const blocked = applyKeeperSaveResult(blockState, {
    nativePlayer: 1,
    outcome: "block",
    rebound,
  }).state;
  assert.equal(blocked.possession.owner, 0);
  assert.equal(blocked.possession.lastTouch, 1);
  assert.deepEqual(blocked.ball, rebound);
});

test("tackle interruption releases possession before FALL_ACT and exposes the foul seam", () => {
  const state = makeState({
    owner: 13,
    ownerCount: 6,
    lastTouch: 13,
    playerOverrides: {
      2: playerAt(100, 100, {
        action: CSSOCCER_NATIVE_CONTACT_ACTION.tackle,
        power: 100,
        goCount: 10,
      }),
      13: playerAt(104, 100, {
        action: CSSOCCER_NATIVE_CONTACT_ACTION.stand,
        power: 20,
        possession: 6,
      }),
    },
  });
  const result = resolveTacklePlayerContacts({
    players: state.players,
    possession: state.possession,
    tacklerNativePlayer: 2,
    seed: 0,
    profile: state.profile,
  });
  assert.equal(result.possession.owner, 0);
  assert.equal(result.players.find(({ nativePlayer }) => nativePlayer === 13).action, 5);
  assert.deepEqual(result.events.map(({ type }) => type), [
    "possession-release",
    "action-interrupt",
    "foul-candidate",
  ]);

  const unsupported = makeState({
    playerOverrides: {
      2: playerAt(100, 100, {
        action: CSSOCCER_NATIVE_CONTACT_ACTION.tackle,
        power: 0,
        goCount: 10,
      }),
      13: playerAt(104, 100, { power: 255 }),
    },
  });
  const ridden = resolveTacklePlayerContacts({
    players: unsupported.players,
    possession: unsupported.possession,
    tacklerNativePlayer: 2,
    seed: 127,
    profile: unsupported.profile,
  });
  assert.equal(ridden.players.find(({ nativePlayer }) => nativePlayer === 13).action, 4);
  assert.ok(ridden.events.some(({ type, nativePlayer, reason }) => (
    type === "action-interrupt"
      && nativePlayer === 13
      && reason === "ride-over-tackle"
  )));
});

test("player-player tussles use stable cross-team pair order and source shove arithmetic", () => {
  const state = makeState({
    playerOverrides: {
      2: playerAt(0, 0, {
        action: CSSOCCER_NATIVE_CONTACT_ACTION.stand,
        animation: 72,
        goDisplacement: { x: 1, y: 0 },
        power: 64,
      }),
      13: playerAt(5, 0, {
        action: CSSOCCER_NATIVE_CONTACT_ACTION.run,
        goDisplacement: { x: -0.5, y: 0 },
        power: 64,
      }),
    },
  });
  const result = resolvePlayerTussles({
    players: state.players,
    possession: state.possession,
    traversalOrder: nativeContactTraversalOrder(1),
    seed: 100,
    profile: state.profile,
  });
  const right = result.players.find(({ nativePlayer }) => nativePlayer === 13);
  const left = result.players.find(({ nativePlayer }) => nativePlayer === 2);
  assert.equal(right.position.x, 6);
  assert.equal(right.position.y, 0);
  assert.equal(left.animation, 74);
  assert.equal(left.barge, 20);
  assert.deepEqual(result.events, [
    { type: "player-tussle", left: 2, right: 13, leftShoved: false },
    { type: "barge-animation", nativePlayer: 2 },
  ]);
});

test("all 22 players advance deterministically and unsupported motion contacts fail explicitly", () => {
  const state = makeState({
    frameParity: 1,
    ball: ballAt(4, 0),
    playerOverrides: {
      2: playerAt(0, 0, { facing: { x: 1, y: 0 }, faceDirection: 4 }),
      13: playerAt(8, 0, { facing: { x: -1, y: 0 }, faceDirection: 0 }),
    },
  });
  const steps = [{}, {}, {}, {}];
  const first = runContactScript(state, steps);
  const second = runContactScript(state, steps);
  assert.equal(first.state.tick, 4);
  assert.equal(first.state.players.length, 22);
  assert.equal(new Set(first.state.players.map(({ stableId }) => stableId)).size, 22);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(
    first.state.possession.players.filter(({ possession }) => possession > 0).length,
    first.state.possession.owner ? 1 : 0,
  );

  const controlWithoutPreparedContact = makeState({
    frameParity: 1,
    ball: ballAt(0, 0),
    playerOverrides: {
      2: playerAt(0, 0, { action: CSSOCCER_NATIVE_CONTACT_ACTION.control }),
    },
  });
  assert.throws(
    () => stepContactState(controlWithoutPreparedContact),
    (error) => error instanceof UnsupportedContactSemanticsError
      && /prepared motion-capture/u.test(error.message),
  );
  assert.throws(
    () => createContactProfile({ ...SOURCE_PROFILE, playerHeight: undefined }),
    /playerHeight must be finite/u,
  );
});

test("runtime contact modules contain no evidence or filesystem reads", () => {
  for (const file of ["contactState.mjs", "possessionState.mjs", "tackleState.mjs"]) {
    const source = readFileSync(new URL(`../src/cssoccer/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /node:fs|\.local\/|state\.jsonl|readFile|createReadStream/u);
  }
});

function makeState({
  owner = 0,
  ownerCount = owner ? 1 : 0,
  lastTouch = owner,
  previousTouch = 0,
  preKeeperTouch = owner && owner !== 1 && owner !== 12 ? owner : 0,
  inHands = 0,
  cannotPickUp = owner && owner !== 1 && owner !== 12 ? owner : 0,
  frameParity = 1,
  deadBall = 0,
  justScored = 0,
  penaltyGame = 0,
  setPiece = 0,
  playerOverrides = {},
  ball = ballAt(-10000, -10000),
  rng,
  profile = SOURCE_PROFILE,
} = {}) {
  const players = makePlayers({ owner, ownerCount, overrides: playerOverrides });
  const possession = createPossessionState({
    owner,
    lastTouch,
    previousTouch,
    preKeeperTouch,
    inHands,
    cannotPickUp,
    players: possessionPlayers(players),
  });
  return createContactState({
    tick: 0,
    frameParity,
    deadBall,
    justScored,
    penaltyGame,
    setPiece,
    players,
    ball,
    possession,
    rng,
    profile,
  });
}

function makePlayers({ owner = 0, ownerCount = 0, overrides = {} } = {}) {
  return Array.from({ length: 22 }, (_, index) => {
    const nativePlayer = index + 1;
    const team = nativePlayer < 12 ? "spain" : "argentina";
    const roster = nativePlayer < 12 ? nativePlayer : nativePlayer - 11;
    const override = overrides[nativePlayer] ?? {};
    return {
      nativePlayer,
      stableId: `${team}-player-${String(roster).padStart(2, "0")}`,
      active: 1,
      action: CSSOCCER_NATIVE_CONTACT_ACTION.stand,
      animation: 78,
      barge: 0,
      position: { x: nativePlayer * 1000, y: nativePlayer * 1000, z: 0 },
      facing: { x: 1, y: 0 },
      faceDirection: 4,
      goDisplacement: { x: 0, y: 0 },
      power: 64,
      control: 128,
      flair: 64,
      goCount: 0,
      animationFrame: 0,
      strike: 0,
      possession: nativePlayer === owner ? ownerCount : 0,
      touchedBall: false,
      kickedBusy: false,
      inPenaltyArea: nativePlayer === 1 || nativePlayer === 12,
      protectsPossession: false,
      retainsPossessionOutsideHeight: false,
      motionContact: null,
      save: null,
      ...override,
      position: { x: nativePlayer * 1000, y: nativePlayer * 1000, z: 0, ...override.position },
      facing: { x: 1, y: 0, ...override.facing },
      goDisplacement: { x: 0, y: 0, ...override.goDisplacement },
      possession: override.possession ?? (nativePlayer === owner ? ownerCount : 0),
    };
  });
}

function playerAt(x, y, override = {}) {
  return { position: { x, y, z: 0 }, ...override };
}

function ballAt(x, y) {
  return {
    position: { x, y, z: 2 },
    displacement: { x: 0, y: 0, z: 0 },
    speed: 0,
    inAir: 0,
    inGoal: 0,
    wantPass: 0,
  };
}

function possessionPlayers(players) {
  return players.map(({ nativePlayer, stableId, possession }) => ({
    nativePlayer,
    stableId,
    possession,
  }));
}

function assertProjectedFields(state, expected, fieldIds) {
  const actual = new Map(
    projectContactNativeFields(state).map((record) => [record.fieldId, record]),
  );
  for (const fieldId of fieldIds) {
    assert.deepEqual(actual.get(fieldId), {
      fieldId,
      valueType: expected.get(fieldId).valueType,
      value: expected.get(fieldId).value,
      numericBits: expected.get(fieldId).numericBits,
    });
  }
}

function qualifiedTussleFrame() {
  return createCssoccerPlayerTussleFrame(tussleFrameInput());
}

function tussleFrameInput() {
  const prior = retainedRawRecord(TUSSLE_PRIOR_TICK);
  const current = retainedRawRecord(TUSSLE_TICK);
  return {
    tick: TUSSLE_TICK,
    frameParity: 1,
    seed: current.read(0x3e818, "i16"),
    ballPossession: current.read(0x3e430, "i32"),
    refereeStrictness: 128,
    players: [
      tusslePlayerInput(prior, current, 10),
      tusslePlayerInput(prior, current, 21),
    ],
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    fixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  };
}

function bargeTussleFrameInput() {
  const prior = retainedRawRecord(244);
  const current = retainedRawRecord(245);
  return {
    tick: 245,
    frameParity: 1,
    seed: current.read(0x3e818, "i16"),
    ballPossession: current.read(0x3e430, "i32"),
    refereeStrictness: 128,
    players: [
      tusslePlayerInput(prior, current, 11, {
        animationOverwritten: true,
        motionOverwritten: false,
      }),
      tusslePlayerInput(prior, current, 15, {
        animationOverwritten: false,
        motionOverwritten: false,
      }),
    ],
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    fixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  };
}

function tusslePlayerInput(
  prior,
  current,
  nativePlayerNumber,
  {
    animationOverwritten = nativePlayerNumber === 10,
    motionOverwritten = nativePlayerNumber === 10,
  } = {},
) {
  const priorPosition = {
    x: prior.readPlayer(nativePlayerNumber, 2, "f32"),
    y: prior.readPlayer(nativePlayerNumber, 10, "f32"),
  };
  const priorFacing = {
    x: prior.readPlayer(nativePlayerNumber, 6, "f32"),
    y: prior.readPlayer(nativePlayerNumber, 14, "f32"),
  };
  const targetOffset = {
    x: current.readPlayer(nativePlayerNumber, 176, "f32"),
    y: current.readPlayer(nativePlayerNumber, 180, "f32"),
  };
  const action = prior.readPlayer(nativePlayerNumber, 142, "i16");
  const forward = action === CSSOCCER_NATIVE_CONTACT_ACTION.run
    && motionOverwritten
    ? sourceForwardDisplacement({
        facing: priorFacing,
        targetOffset,
        speed: actualPlayerSpeed({
          pitchLength: 1280,
          teamRate: prior.readPlayer(nativePlayerNumber, 70, "u8"),
          speedIntent: "normal",
          intentionCount: 0,
          sideStep: false,
          nativePlayer: nativePlayerNumber,
          ballPossession: current.read(0x3e430, "i32"),
          ballInHands: current.read(0x3e3a1, "u8") !== 0,
          keeperNativePlayers: [1, 12],
          userControlIndex: 0,
          burstTimer: 0,
        }),
      })
    : {
        displacement: action === CSSOCCER_NATIVE_CONTACT_ACTION.run
          ? {
              x: current.readPlayer(nativePlayerNumber, 160, "f32"),
              y: current.readPlayer(nativePlayerNumber, 164, "f32"),
            }
          : { x: F32(0), y: F32(0) },
      };
  const position = action === CSSOCCER_NATIVE_CONTACT_ACTION.run
    ? updateSourcePosition2d({
        position: priorPosition,
        displacement: forward.displacement,
      })
    : priorPosition;
  const stableId = stableIdForNativeTest(nativePlayerNumber);
  return {
    stableId,
    nativePlayerNumber,
    on: current.readPlayer(nativePlayerNumber, 44, "i16"),
    action,
    animation: animationOverwritten
      ? prior.readPlayer(nativePlayerNumber, 119, "u16")
      : current.readPlayer(nativePlayerNumber, 119, "u16"),
    animationFrame: animationOverwritten
      ? F32(
          prior.readPlayer(nativePlayerNumber, 111, "f32")
            + prior.readPlayer(nativePlayerNumber, 115, "f32"),
        )
      : current.readPlayer(nativePlayerNumber, 111, "f32"),
    animationFrameStep: animationOverwritten
      ? prior.readPlayer(nativePlayerNumber, 115, "f32")
      : current.readPlayer(nativePlayerNumber, 115, "f32"),
    position: {
      x: position.x,
      y: position.y,
      z: prior.readPlayer(nativePlayerNumber, 18, "f32"),
    },
    facing: motionOverwritten
      ? priorFacing
      : {
          x: current.readPlayer(nativePlayerNumber, 6, "f32"),
          y: current.readPlayer(nativePlayerNumber, 14, "f32"),
        },
    zDisplacement: prior.readPlayer(nativePlayerNumber, 22, "f32"),
    goDisplacement: forward.displacement,
    power: prior.readPlayer(nativePlayerNumber, 71, "u8"),
    rate: prior.readPlayer(nativePlayerNumber, 70, "u8"),
    possession: prior.readPlayer(nativePlayerNumber, 144, "i16"),
    bargeCountdown: current.readPlayer(nativePlayerNumber, 140, "u8"),
  };
}

const retainedTickCache = new Map();

async function readRetainedTicks(ticks) {
  const missing = ticks.filter((tick) => !retainedTickCache.has(tick));
  if (missing.length > 0) {
    const wanted = new Set(missing);
    const maximum = Math.max(...missing);
    const input = createReadStream(retainedStateUrl);
    const lines = createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
      const record = JSON.parse(line);
      if (record.recordType !== "sample") continue;
      if (record.tick > maximum) {
        lines.close();
        input.destroy();
        break;
      }
      if (!wanted.has(record.tick)) continue;
      if (!retainedTickCache.has(record.tick)) retainedTickCache.set(record.tick, new Map());
      retainedTickCache.get(record.tick).set(record.fieldId, record);
    }
  }
  for (const tick of ticks) {
    assert.equal(retainedTickCache.get(tick)?.size, 412, `retained tick ${tick}`);
  }
  return new Map(ticks.map((tick) => [tick, retainedTickCache.get(tick)]));
}

const rawRecordCache = new Map();
let rawLayoutCache;

function retainedRawRecord(tick) {
  if (rawRecordCache.has(tick)) return rawRecordCache.get(tick);
  const layout = retainedRawLayout();
  for (
    let offset = layout.descriptorOffset;
    offset < layout.bytes.length;
    offset += layout.recordBytes
  ) {
    const recordTick = layout.bytes.readUInt32LE(offset + 20);
    const flags = layout.bytes.readUInt32LE(offset + 24);
    if (recordTick !== tick || (flags & layout.raw.flags.active) === 0) continue;
    const record = rawRecordAt(layout, offset);
    rawRecordCache.set(tick, record);
    return record;
  }
  assert.fail(`active raw tick ${tick}`);
}

function retainedRawLayout() {
  if (rawLayoutCache) return rawLayoutCache;
  const bytes = readFileSync(retainedRawUrl);
  const raw = JSON.parse(readFileSync(matchContractUrl, "utf8")).oracle.capture.raw;
  assert.equal(bytes.subarray(0, 8).toString("ascii"), raw.magic);
  let descriptorOffset = 16;
  let payloadBytes = 0;
  const rangeCount = bytes.readUInt32LE(12);
  assert.ok(rangeCount > 0 && rangeCount <= raw.ranges.length);
  const ranges = raw.ranges.slice(0, rangeCount).map((expected) => {
    const range = {
      offset: bytes.readUInt32LE(descriptorOffset),
      bytes: bytes.readUInt32LE(descriptorOffset + 4),
      payloadBase: payloadBytes,
    };
    assert.deepEqual({ offset: range.offset, bytes: range.bytes }, expected);
    descriptorOffset += 8;
    payloadBytes += range.bytes;
    return range;
  });
  rawLayoutCache = {
    bytes,
    raw,
    ranges,
    descriptorOffset,
    recordBytes: raw.metadataBytes + payloadBytes,
  };
  return rawLayoutCache;
}

function rawRecordAt(layout, offset) {
  function read(address, type) {
    const range = layout.ranges.find((entry) => (
      address >= entry.offset && address < entry.offset + entry.bytes
    ));
    assert.ok(range, `raw address 0x${address.toString(16)}`);
    const cursor = offset + layout.raw.metadataBytes + range.payloadBase
      + address - range.offset;
    return readRawValue(layout.bytes, cursor, type);
  }
  return {
    tick: layout.bytes.readUInt32LE(offset + 20),
    read,
    readPlayer(nativePlayerNumber, playerOffset, type) {
      return read(0x3cf6c + ((nativePlayerNumber - 1) * 203) + playerOffset, type);
    },
  };
}

function readRawValue(bytes, offset, type) {
  if (type === "u8") return bytes.readUInt8(offset);
  if (type === "i16") return bytes.readInt16LE(offset);
  if (type === "u16") return bytes.readUInt16LE(offset);
  if (type === "i32") return bytes.readInt32LE(offset);
  if (type === "f32") return bytes.readFloatLE(offset);
  throw new Error(`Unsupported raw value type ${type}.`);
}

function rawTussleField(raw, fieldId) {
  if (fieldId === "ball.possession") {
    return typedTestValue(fieldId, "i32", raw.read(0x3e430, "i32"));
  }
  const match = /^players\.(spain|argentina)-player-(\d\d)\.(.+)$/u.exec(fieldId);
  assert.ok(match, `raw tussle field ${fieldId}`);
  const nativePlayerNumber = match[1] === "spain"
    ? Number(match[2])
    : Number(match[2]) + 11;
  const facts = {
    action: [142, "i16"],
    animation: [119, "u16"],
    animation_frame: [111, "f32"],
    native_player: [0, "i16"],
    on: [44, "i16"],
    possession: [144, "i16"],
    x: [2, "f32"],
    x_displacement: [6, "f32"],
    y: [10, "f32"],
    y_displacement: [14, "f32"],
    z: [18, "f32"],
    z_displacement: [22, "f32"],
  };
  const [offset, valueType] = facts[match[3]] ?? [];
  assert.notEqual(offset, undefined, `raw tussle suffix ${match[3]}`);
  return typedTestValue(
    fieldId,
    valueType,
    raw.readPlayer(nativePlayerNumber, offset, valueType),
  );
}

function rawInternalField(raw, nativePlayerNumber, offset, valueType, fieldId) {
  return typedTestValue(
    fieldId,
    valueType,
    raw.readPlayer(nativePlayerNumber, offset, valueType),
  );
}

function typedTestValue(fieldId, valueType, value) {
  if (valueType === "string") {
    return { fieldId, valueType, value, numericBits: null };
  }
  const widths = { u8: 1, i16: 2, u16: 2, i32: 4, f32: 4 };
  const bytes = new Uint8Array(widths[valueType]);
  const view = new DataView(bytes.buffer);
  if (valueType === "u8") view.setUint8(0, value);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "u16") view.setUint16(0, value, false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else view.setFloat32(0, value, false);
  return {
    fieldId,
    valueType,
    value,
    numericBits: [...bytes]
      .map((entry) => entry.toString(16).padStart(2, "0"))
      .join(""),
  };
}

function requiredSample(fields, fieldId) {
  const sample = fields?.get(fieldId);
  assert.ok(sample, `retained field ${fieldId}`);
  return sample;
}

function scalarRecord(record) {
  return {
    fieldId: record.fieldId,
    valueType: record.valueType,
    value: record.value,
    numericBits: record.numericBits,
  };
}

function typedLeaves(value, result = new Map()) {
  if (Array.isArray(value)) {
    for (const child of value) typedLeaves(child, result);
    return result;
  }
  if (!value || typeof value !== "object") return result;
  if (
    typeof value.fieldId === "string"
    && typeof value.valueType === "string"
    && Object.hasOwn(value, "numericBits")
  ) {
    result.set(value.fieldId, scalarRecord(value));
    return result;
  }
  for (const child of Object.values(value)) typedLeaves(child, result);
  return result;
}

function expandedFallByteOffsets(writes) {
  const result = new Set();
  const add = (offset, bytes) => {
    for (let index = 0; index < bytes; index += 1) result.add(offset + index);
  };
  for (const offset of writes.facing) add(offset, 4);
  add(writes.z, 4);
  add(writes.directionMode, 2);
  add(writes.animationFrame, 4);
  add(writes.animationFrameStep, 4);
  add(writes.animation, 2);
  add(writes.newAnimation, 1);
  add(writes.action, 2);
  add(writes.possession, 2);
  add(writes.goCount, 4);
  for (const offset of writes.goDisplacement) add(offset, 4);
  for (const offset of writes.goTarget) add(offset, 4);
  return result;
}

function scanRawContactFrontier(startTick, endTick) {
  const layout = retainedRawLayout();
  const previous = new Map();
  const events = [];
  for (
    let offset = layout.descriptorOffset;
    offset < layout.bytes.length;
    offset += layout.recordBytes
  ) {
    const tick = layout.bytes.readUInt32LE(offset + 20);
    const flags = layout.bytes.readUInt32LE(offset + 24);
    if ((flags & layout.raw.flags.active) === 0 || tick > endTick) continue;
    const raw = rawRecordAt(layout, offset);
    for (let nativePlayerNumber = 1; nativePlayerNumber <= 22; nativePlayerNumber += 1) {
      const action = raw.readPlayer(nativePlayerNumber, 142, "i16");
      const animation = raw.readPlayer(nativePlayerNumber, 119, "u16");
      const bargeCountdown = raw.readPlayer(nativePlayerNumber, 140, "u8");
      const prior = previous.get(nativePlayerNumber);
      if (
        tick > startTick
        && tick <= endTick
        && prior
        && (
          (action === CSSOCCER_NATIVE_CONTACT_ACTION.fall
            && prior.action !== CSSOCCER_NATIVE_CONTACT_ACTION.fall)
          || (bargeCountdown === 20 && prior.bargeCountdown !== 20)
        )
      ) {
        events.push({
          tick,
          nativePlayerNumber,
          kind: action === CSSOCCER_NATIVE_CONTACT_ACTION.fall
            && prior.action !== CSSOCCER_NATIVE_CONTACT_ACTION.fall
              ? "fall"
              : "barge-launch",
          action,
          animation,
          bargeCountdown,
        });
      }
      previous.set(nativePlayerNumber, { action, bargeCountdown });
    }
  }
  return events;
}

function stableIdForNativeTest(nativePlayerNumber) {
  const country = nativePlayerNumber <= 11 ? "spain" : "argentina";
  const roster = nativePlayerNumber <= 11
    ? nativePlayerNumber
    : nativePlayerNumber - 11;
  return `${country}-player-${String(roster).padStart(2, "0")}`;
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_KEEPER_AI_SOURCE,
  CSSOCCER_KEEPER_GAPS,
  cssoccerKeeperBoxStatus,
  resolveCssoccerKeeperPosition,
  selectCssoccerKeeperIntent,
  selectCssoccerKeeperSaveTarget,
} from "../src/cssoccer/keeperAi.mjs";
import {
  CSSOCCER_PLAYER_AI_GAPS,
  CSSOCCER_PLAYER_AI_SOURCE,
  chooseCssoccerPossessionIntent,
  createCssoccerPlayerAiState,
  materializeCssoccerPlayerIntent,
  stepCssoccerPlayerAi,
  syncCssoccerPlayerAiState,
} from "../src/cssoccer/playerAi.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  projectCssoccerKeeperSourceConstants,
} from "../src/cssoccer/nativeGameplayProfile.mjs";
import {
  advanceCssoccerNativeRng,
  createCssoccerNativeRngState,
} from "../src/cssoccer/randomState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  projectCssoccerNativePlayerAttributes,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_TEAM_AI_SOURCE,
  createCssoccerTeamAiSelectors,
  createCssoccerTeamAiState,
  selectCssoccerNearPathPlayer,
  selectCssoccerNearestPlayer,
  stepCssoccerTeamAi,
} from "../src/cssoccer/teamAi.mjs";
import {
  CSSOCCER_TACTICS_GAPS,
  CSSOCCER_TACTICS_SOURCE,
  createCssoccerTacticsState,
  createUnsupportedCssoccerTacticsState,
  resolveCssoccerZonalTarget,
} from "../src/cssoccer/tacticsState.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const retainedUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const retainedRawUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/native.raw",
  import.meta.url,
);
const sourceFiles = [
  "ACTIONS.CPP",
  "BALLINT.CPP",
  "FOOTBALL.CPP",
  "INTELL.CPP",
  "EURO_MAT.CPP",
  "TAC_433.TAC",
].map((file) => new URL(file, sourceRoot));
const evidenceTestOptions = {
  skip: sourceFiles.every(existsSync) && existsSync(retainedUrl) && existsSync(retainedRawUrl)
    ? false
    : "ignored Actua source/native evidence is unavailable",
};
const f32 = Math.fround;

test("source metadata pins the live intelligence, native order, and fixed F_4_3_3 owners", evidenceTestOptions, () => {
  const hashes = {
    "ACTIONS.CPP": "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
    "BALLINT.CPP": "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
    "FOOTBALL.CPP": "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
    "INTELL.CPP": "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
    "TAC_433.TAC": "79b999a42b9b32062445f10aeb35be3110f6e6c5c4e0a68454df271b538903d9",
  };
  for (const [file, hash] of Object.entries(hashes)) {
    assert.equal(sha256(readFileSync(new URL(file, sourceRoot))), hash);
  }
  assert.equal(CSSOCCER_PLAYER_AI_SOURCE.sha256, hashes["INTELL.CPP"]);
  assert.equal(CSSOCCER_KEEPER_AI_SOURCE.nativeKeeperNumbers.join(","), "1,12");
  assert.equal(
    CSSOCCER_KEEPER_AI_SOURCE.nativeGameplayProfileHash,
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  );
  assert.equal(CSSOCCER_PLAYER_AI_SOURCE.closeInNumber, 2);
  assert.deepEqual(CSSOCCER_PLAYER_AI_SOURCE.interactiveActionIds, [0, 1]);
  assert.equal(CSSOCCER_TACTICS_SOURCE.formationId, 0);
  assert.equal(CSSOCCER_TACTICS_SOURCE.tableRows, 70);
  assert.match(CSSOCCER_TEAM_AI_SOURCE.processOrder, /A then B when true/u);

  const football = sourceText("FOOTBALL.CPP");
  const actions = sourceText("ACTIONS.CPP");
  const ballInt = sourceText("BALLINT.CPP");
  const intelligence = sourceText("INTELL.CPP");
  const euroMatch = sourceText("EURO_MAT.CPP");
  assert.match(football, /frame=\(frame\) \? 0:1;[\s\S]*process_teams\(\);/u);
  assert.match(actions, /if \(frame\)[\s\S]*p=1;[\s\S]*else[\s\S]*p=12;[\s\S]*go_team\(p\);/u);
  assert.match(ballInt, /for \(player_num=0; player_num<players; player_num\+\+\)[\s\S]*if \(d<ad\)/u);
  assert.match(intelligence, /for \(int i=p_num\+10; i>=p_num; i--\)[\s\S]*if \(d<closest\)/u);
  assert.match(intelligence, /void intelligence\(match_player \*player\)[\s\S]*free_ball\(player\)[\s\S]*got_ball\(player\)[\s\S]*we_have_ball\(player\)[\s\S]*opp_has_ball\(player\)/u);
  assert.match(euroMatch, /EUROmatch_info\.tac_1\s*=\s*0;[\s\S]*EUROmatch_info\.tac_2\s*=\s*0;/u);
});

test("prepared tactics resolve exact table cells, mirror B, and reject unbound modes", evidenceTestOptions, () => {
  const tactics = sourceTactics();
  const values = tactics.slots.A.values;
  assert.deepEqual(values[0][0], [72, 152]);
  assert.deepEqual(values[68][0], [288, 280]);
  const a = resolveCssoccerZonalTarget(tactics, {
    nativeTeamSlot: "A",
    nativePlayerNumber: 2,
    ballZone: 0,
    teamInPossession: false,
  });
  const b = resolveCssoccerZonalTarget(tactics, {
    nativeTeamSlot: "B",
    nativePlayerNumber: 13,
    ballZone: 0,
    teamInPossession: false,
  });
  assert.deepEqual(a.target, { x: 72, y: 152 });
  assert.deepEqual(b.target, { x: 1208, y: 648 });
  assert.equal(a.tableRow, 0);
  assert.equal(resolveCssoccerZonalTarget(tactics, {
    nativeTeamSlot: "A",
    nativePlayerNumber: 2,
    ballZone: 0,
    teamInPossession: true,
  }).tableRow, 32);
  assert.throws(
    () => resolveCssoccerZonalTarget(createUnsupportedCssoccerTacticsState(), {
      nativeTeamSlot: "A",
      nativePlayerNumber: 2,
      ballZone: 0,
      teamInPossession: false,
    }),
    /ready prepared tactic table/u,
  );
  assert.throws(() => resolveCssoccerZonalTarget(tactics, {
    nativeTeamSlot: "A",
    nativePlayerNumber: 1,
    ballZone: 0,
    teamInPossession: false,
  }), /outfield players/u);
  const analogue = resolveCssoccerZonalTarget(tactics, {
    nativeTeamSlot: "A",
    nativePlayerNumber: 2,
    ballZone: 0,
    teamInPossession: false,
    analogue: true,
    ballPosition: { x: 80, y: 100 },
  });
  assert.equal(analogue.status, "exact-analogue-interpolation");
  assert.ok(Number.isFinite(analogue.target.x));
  assert.ok(Number.isFinite(analogue.target.y));
  assert.equal(
    CSSOCCER_TACTICS_GAPS.find(({ id }) => id === "prepared-tactic-table")?.status,
    "implemented",
  );
});

test("nearest and near-path selectors preserve the two distinct native tie orders", () => {
  const state = createCssoccerTeamAiState(syntheticTeamState("argentina"));
  const teamA = state.players.filter(({ nativeTeamSlot }) => nativeTeamSlot === "A");
  const snapshots = teamA.map((player) => syncCssoccerPlayerAiState(player, {
    position: { x: f32(100), y: f32(100), z: f32(0) },
    actionClass: "stand-run-turn",
  }));
  assert.equal(
    selectCssoccerNearestPlayer(snapshots, { x: 100, y: 100, z: 0 }).nativePlayerNumber,
    1,
  );
  assert.equal(
    selectCssoccerNearPathPlayer(snapshots, {
      target: { x: 100, y: 100, z: 0 },
      pitchRatio: 1280 / 120,
    }).nativePlayerNumber,
    11,
  );
  const keeper = snapshots[0];
  const outfield = syncCssoccerPlayerAiState(snapshots[1], {
    position: { x: f32(103), y: f32(100), z: f32(0) },
  });
  const farKeeper = syncCssoccerPlayerAiState(keeper, {
    position: { x: f32(105), y: f32(100), z: f32(0) },
  });
  assert.equal(selectCssoccerNearPathPlayer([farKeeper, outfield], {
    target: { x: 100, y: 100, z: 0 },
    pitchRatio: 1,
  }).nativePlayerNumber, 2);
});

test("team AI consumes the bound native fixture attributes, never prepared roster pace", () => {
  const state = createCssoccerTeamAiState(syntheticTeamState("argentina"));
  const projected = projectCssoccerNativePlayerAttributes(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf: 0 },
  );
  assert.equal(
    state.nativeFixturePlayerProfileHash,
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  );
  assert.equal(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
    "412e210fa430ea0c78474e26e71629cdfaf8bb9ac8360ee91e1edac8f67e3eec",
  );
  assert.equal(state.matchHalf, 0);
  assert.deepEqual(
    state.players
      .map(({ id, nativePlayerNumber, attributes }) => ({
        id,
        nativePlayerNumber,
        attributes,
      }))
      .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber),
    projected,
  );
  assert.deepEqual(state.players.find(({ id }) => id === "spain-player-01").attributes, {
    pace: 62,
    power: 78,
    control: 30,
    flair: 43,
    vision: 89,
    accuracy: 65,
    stamina: 89,
    discipline: 44,
  });
  assert.deepEqual(state.players.find(({ id }) => id === "argentina-player-08").attributes, {
    pace: 89,
    power: 70,
    control: 90,
    flair: 85,
    vision: 113,
    accuracy: 99,
    stamina: 92,
    discipline: 83,
  });
  assert.throws(() => createCssoccerTeamAiState({
    ...syntheticTeamState("argentina"),
    players: syntheticTeamState("argentina").players.map((player) => (
      player.id === "spain-player-01"
        ? { ...player, current: { ...player.current, nativePlayerNumber: 2 } }
        : player
    )),
  }), /native fixture profile/u);
});

test("exactly 21 non-selected players and both keepers advance in alternating native order", evidenceTestOptions, () => {
  for (const selectedCountry of ["spain", "argentina"]) {
    const activePlayerId = `${selectedCountry}-player-07`;
    const initial = createCssoccerTeamAiState(syntheticTeamState(selectedCountry));
    const first = stepCssoccerTeamAi(initial, liveContext(activePlayerId));
    assert.equal(first.decisions.length, 21);
    assert.equal(new Set(first.state.lastProcessedOrder).size, 21);
    assert.ok(!first.state.lastProcessedOrder.includes(activePlayerId));
    assert.equal(first.state.lastProcessedOrder[0], "spain-player-01");
    assert.ok(first.decisions.some(({ kind }) => kind === "keeper-position"));
    assert.deepEqual(
      first.decisions.filter(({ kind }) => kind === "keeper-position")
        .map(({ nativePlayerNumber }) => nativePlayerNumber)
        .sort((a, b) => a - b),
      [1, 12],
    );
    assert.equal(
      first.state.players.find(({ id }) => id === activePlayerId).native.control.value,
      1,
    );
    assert.equal(
      first.state.players.filter(({ native }) => native.control.value === 1).length,
      1,
    );
    const second = stepCssoccerTeamAi(first.state, liveContext(activePlayerId));
    assert.equal(second.state.lastProcessedOrder[0], "argentina-player-01");
    assert.equal(second.decisions.length, 21);
    assert.deepEqual(
      second.decisions.filter(({ kind }) => kind === "keeper-position")
        .map(({ nativePlayerNumber }) => nativePlayerNumber)
        .sort((a, b) => a - b),
      [1, 12],
    );

    const repeatFirst = stepCssoccerTeamAi(
      createCssoccerTeamAiState(syntheticTeamState(selectedCountry)),
      liveContext(activePlayerId),
    );
    const repeatSecond = stepCssoccerTeamAi(
      repeatFirst.state,
      liveContext(activePlayerId),
    );
    assert.equal(JSON.stringify(repeatFirst), JSON.stringify(first));
    assert.equal(JSON.stringify(repeatSecond), JSON.stringify(second));
  }
});

test("both country choices stay byte-identical through a changing source RNG window", () => {
  for (const selectedCountry of ["spain", "argentina"]) {
    const first = runAiWindow(selectedCountry, 24);
    const repeat = runAiWindow(selectedCountry, 24);
    assert.equal(JSON.stringify(first), JSON.stringify(repeat));
    assert.deepEqual(first.map(({ decisionCount }) => decisionCount), Array(24).fill(21));
    assert.ok(first.every(({ keeperNumbers }) => keeperNumbers.join(",") === "1,12"));
    assert.deepEqual(
      first.map(({ sourceFrame }) => sourceFrame),
      Array.from({ length: 24 }, (_, index) => index % 2 === 0),
    );
  }
});

test("busy/rethink, support, mark/retrieve, and possession precedence stay semantic", evidenceTestOptions, () => {
  const state = createCssoccerTeamAiState(syntheticTeamState("argentina"));
  const base = state.players.find(({ id }) => id === "spain-player-06");
  const busy = syncCssoccerPlayerAiState(base, {
    intelligence: {
      ...base.intelligence,
      move: "intercept",
      count: 2,
    },
  });
  const busyStep = stepCssoccerPlayerAi(busy, playerContext({ possession: 0 }));
  assert.equal(busyStep.lastIntent.kind, "busy");
  assert.equal(busyStep.intelligence.count, 1);
  const resumed = stepCssoccerPlayerAi(busyStep, playerContext({ possession: 0 }));
  assert.notEqual(resumed.lastIntent.kind, "busy");
  assert.equal(resumed.intelligence.count >= 0, true);

  const support = stepCssoccerPlayerAi(base, playerContext({
    possession: 2,
    logicCount: 0,
    supportFacts: {
      [base.id]: {
        askForPass: true,
        runTarget: { x: 900, y: 400 },
        runTicks: 8,
      },
    },
  }));
  assert.equal(support.lastIntent.kind, "support");
  assert.equal(support.intelligence.move, "run-on");

  const retrieveContext = playerContext({ possession: 12 });
  retrieveContext.match.ball.position = { ...base.position };
  retrieveContext.selectors.distanceRankById[base.id] = 1;
  retrieveContext.selectors.nearestBySlot.A = base.nativePlayerNumber;
  retrieveContext.retrieveFacts = {
    [base.id]: {
      inClose: true,
      holderFacing: "side",
      target: { x: 650, y: 400 },
    },
  };
  const retrieve = stepCssoccerPlayerAi(base, retrieveContext);
  assert.equal(retrieve.lastIntent.kind, "retrieve");
  assert.equal(retrieve.lastIntent.style, "forceful");

  const markContext = playerContext({ possession: 12 });
  markContext.selectors.distanceRankById[base.id] = 11;
  const mark = stepCssoccerPlayerAi(base, markContext);
  assert.equal(mark.lastIntent.kind, "mark");

  const shoot = chooseCssoccerPossessionIntent(base, {
    shoot: true,
    passTarget: { id: "spain-player-07", nativePlayerNumber: 7 },
    punt: true,
    runTarget: { x: 800, y: 400 },
  });
  assert.equal(shoot.kind, "shoot");
  const cross = chooseCssoccerPossessionIntent(base, {
    shoot: false,
    crossPassTarget: { id: "spain-player-07", nativePlayerNumber: 7 },
    passTarget: { id: "spain-player-08", nativePlayerNumber: 8 },
  });
  assert.equal(cross.kind, "pass");
  assert.equal(cross.mode, "cross");
  assert.throws(() => chooseCssoccerPossessionIntent(base, {}), /source-backed/u);
  assert.throws(() => materializeCssoccerPlayerIntent(shoot, {}), /unavailable/u);
  assert.ok(CSSOCCER_PLAYER_AI_GAPS.some(({ id }) => id === "numeric-action-semantics"));
});

test("bound action classification preserves busy native actions and re-enters on RUN", () => {
  const state = createCssoccerTeamAiState(syntheticTeamState("argentina"));
  const base = state.players.find(({ id }) => id === "spain-player-07");
  const kick = syncCssoccerPlayerAiState(base, {
    action: typedValue(`players.${base.id}.action`, "i16", 15),
  });
  assert.equal(kick.actionClass, "unbound-numeric-action");
  const preserved = stepCssoccerPlayerAi(kick, playerContext({ possession: 0 }));
  assert.equal(preserved.lastIntent.kind, "preserve-action");
  assert.equal(preserved.lastIntent.action.value, 15);

  const run = syncCssoccerPlayerAiState(kick, {
    action: typedValue(`players.${base.id}.action`, "i16", 1),
  });
  assert.equal(run.actionClass, "stand-run-turn");
  assert.throws(() => syncCssoccerPlayerAiState(base, {
    action: typedValue(`players.${base.id}.action`, "i16", 15),
    actionClass: "stand-run-turn",
  }), /contradicts/u);
});

test("auto-user pressure guards defer selected-team force branches for both choices", () => {
  for (const selectedCountry of ["spain", "argentina"]) {
    const state = createCssoccerTeamAiState(syntheticTeamState(selectedCountry));
    const selected = state.players.find(({ id }) => id === `${selectedCountry}-player-06`);
    const opponent = state.players.find(({ country, id }) => (
      country !== selectedCountry && id.endsWith("player-06")
    ));
    const selectedSlot = selected.nativeTeamSlot;
    const opponentHolder = opponent.nativeTeamSlot === "A" ? 2 : 13;
    const selectedHolder = selectedSlot === "A" ? 2 : 13;

    const selectedContext = pressureContext(selected, opponentHolder, selectedSlot);
    const deferred = stepCssoccerPlayerAi(selected, selectedContext);
    assert.equal(deferred.lastIntent.kind, "preserve-action");
    assert.equal(deferred.lastIntent.reason, "source-auto-user-pressure-guard");

    const opponentContext = pressureContext(opponent, selectedHolder, selectedSlot);
    const retrieved = stepCssoccerPlayerAi(opponent, opponentContext);
    assert.equal(retrieved.lastIntent.kind, "retrieve");
    assert.equal(retrieved.lastIntent.style, "forceful");
  }
});

test("keeper position, save, handling, and distribution boundaries are symmetric and explicit", () => {
  const keepers = [syntheticKeeper(1), syntheticKeeper(12)];
  const pitch = { length: 1280, width: 800, ratio: 1280 / 120 };
  assert.equal(cssoccerKeeperBoxStatus(keepers[0], pitch), true);
  assert.equal(cssoccerKeeperBoxStatus(keepers[1], pitch), true);
  const sourceConstants = projectCssoccerKeeperSourceConstants(
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  );
  const left = resolveCssoccerKeeperPosition(keepers[0], {
    pitch,
    ball: { position: { x: 100, y: 360, z: 2 } },
    possession: 12,
    sourceConstants,
  });
  const right = resolveCssoccerKeeperPosition(keepers[1], {
    pitch,
    ball: { position: { x: 1180, y: 440, z: 2 } },
    possession: 1,
    sourceConstants,
  });
  assert.equal(left.mode, "close-angle");
  assert.equal(right.mode, "close-angle");
  assert.ok(Math.abs(left.target.x - (1280 - right.target.x)) < 1e-9);
  assert.ok(Math.abs(left.target.y - (800 - right.target.y)) < 1e-9);

  const predictions = Array.from({ length: 8 }, (_, index) => ({
    x: 20 - index * 2,
    y: 400,
    z: 2,
  }));
  const forced = selectCssoccerKeeperSaveTarget(keepers[0], {
    pitch,
    sourceConstants,
    predictions,
    forced: true,
  });
  assert.equal(forced.predictionIndex, 3);
  const save = selectCssoccerKeeperIntent(keepers[0], {
    pitch,
    ball: { position: { x: 20, y: 400, z: 2 }, inAir: true },
    possession: 0,
    shotPending: true,
    shotAcknowledged: false,
    cannotPickUp: 0,
    predictions,
    sourceConstants,
    seed: 64,
  });
  assert.equal(save.kind, "save");
  assert.equal(save.actionStatus, "current-source-bound");

  const distribution = selectCssoccerKeeperIntent(keepers[0], {
    pitch,
    ball: { position: { x: 10, y: 400, z: 2 }, inHands: true },
    possession: 1,
    distribution: {
      punt: false,
      passTarget: {
        id: "spain-player-02",
        nativePlayerNumber: 2,
        position: { x: 20, y: 400, z: 0 },
      },
    },
    seed: 0,
  });
  assert.equal(distribution.kind, "distribute");
  assert.equal(distribution.mode, "throw");
  assert.throws(() => resolveCssoccerKeeperPosition(keepers[0], {
    pitch,
    ball: { position: { x: 100, y: 400, z: 2 } },
    possession: 12,
  }), /source constants/u);
});

test("corrected retained seams qualify the first live AI boundary without entering step input", evidenceTestOptions, () => {
  const retained = retainedTicks(new Set([0, 1, 171, 172, 178, 185, 186]));
  const profileBindings = CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.bindings;
  assert.equal(retained.header.bindings.sourceSha256, "136874496399a7acb712b28b6effb53f689c84ca373fb42af67ebf20f3b8cc45");
  assert.equal(retained.header.bindings.buildSha256, profileBindings.nativeBuildSha256);
  assert.equal(retained.header.bindings.scenarioSha256, profileBindings.nativeScenarioSha256);
  assert.equal(retained.header.bindings.contractSha256, profileBindings.nativeFieldContractSha256);
  assert.equal(retained.header.tickRange.start, 0);
  assert.equal(retained.header.tickRange.count, 2725);
  assert.equal(retained.stateSha256, profileBindings.nativeStateSha256);
  assert.equal(sha256(readFileSync(retainedRawUrl)), profileBindings.nativeRawSha256);
  const tick0 = retained.ticks.get(0);
  const tick1 = retained.ticks.get(1);
  const tick171 = retained.ticks.get(171);
  const tick172 = retained.ticks.get(172);
  const tick178 = retained.ticks.get(178);
  const tick185 = retained.ticks.get(185);
  const tick186 = retained.ticks.get(186);
  const ids = fixedPlayerIds();
  assert.deepEqual(ids.map((id) => tick0.get(`players.${id}.native_player`).value), [
    ...Array.from({ length: 11 }, (_, index) => index + 12),
    ...Array.from({ length: 11 }, (_, index) => index + 1),
  ]);
  for (const id of ids) {
    assertTyped(tick0.get(`players.${id}.action`), "i16");
    assertTyped(tick0.get(`players.${id}.control`), "u8");
    assert.equal(tick0.get(`players.${id}.action`).value, 0);
    assert.equal(tick1.get(`players.${id}.action`).value, 1);
    assert.equal(tick171.get(`players.${id}.action`).value, 0);
    assertTyped(tick172.get(`players.${id}.action`), "i16");
    assertTyped(tick172.get(`players.${id}.control`), "u8");
    assertTyped(tick178.get(`players.${id}.action`), "i16");
    assertTyped(tick178.get(`players.${id}.control`), "u8");
  }
  assert.deepEqual(controlledPlayerIds(tick171, ids), []);
  assert.deepEqual(controlledPlayerIds(tick172, ids), ["argentina-player-07"]);
  assert.deepEqual(controlledPlayerIds(tick178, ids), ["argentina-player-10"]);
  assert.equal(tick172.get("players.argentina-player-07.control").numericBits, "01");
  assert.equal(tick172.get("players.spain-player-07.action").value, 15);
  assert.equal(tick172.get("players.spain-player-07.action").numericBits, "000f");
  assert.equal(tick178.get("players.argentina-player-10.control").numericBits, "01");
  assert.equal(tick185.get("players.spain-player-07.action").value, 0);
  assert.equal(tick186.get("players.spain-player-07.action").value, 1);
  for (const id of ids.filter((id) => ![
    "argentina-player-01",
    "argentina-player-07",
    "spain-player-01",
    "spain-player-07",
  ].includes(id))) {
    assert.equal(tick172.get(`players.${id}.action`).value, 1);
  }
  for (const keeperId of ["spain-player-01", "argentina-player-01"]) {
    assert.equal(tick172.get(`players.${keeperId}.control`).value, 0);
    assert.equal(tick172.get(`players.${keeperId}.action`).value, 0);
  }
  assert.equal(ids.filter((id) => id !== "argentina-player-07").length, 21);

  // Exercise the engine independently from the retained records above. The
  // native stream qualifies field/type/order expectations only; none of its
  // values are supplied to construction or step input.
  const result = stepCssoccerTeamAi(
    createCssoccerTeamAiState(syntheticTeamState("argentina")),
    liveContext("argentina-player-07"),
  );
  assert.equal(result.decisions.length, 21);
  assert.deepEqual(
    result.state.players.map(({ nativePlayerNumber }) => nativePlayerNumber).slice().sort((a, b) => a - b),
    Array.from({ length: 22 }, (_, index) => index + 1),
  );
  const selected = result.state.players.find(({ id }) => id === "argentina-player-07");
  assert.equal(selected.native.action.valueType, "i16");
  assert.equal(selected.native.control.valueType, "u8");
  assert.equal(selected.native.control.value, 1);

  const handoff = stepCssoccerTeamAi(
    createCssoccerTeamAiState(syntheticTeamState("argentina")),
    liveContext("argentina-player-10"),
  );
  assert.equal(handoff.decisions.length, 21);
  assert.deepEqual(
    handoff.decisions.filter(({ kind }) => kind === "keeper-position")
      .map(({ nativePlayerNumber }) => nativePlayerNumber)
      .sort((a, b) => a - b),
    [1, 12],
  );
  assert.equal(
    CSSOCCER_PLAYER_AI_GAPS.find(({ id }) => id === "native-intelligence-state")?.status,
    "unsupported",
  );
  assert.equal(
    CSSOCCER_KEEPER_GAPS.find(({ id }) => id === "keeper-native-intelligence-state")?.status,
    "implemented-current-state",
  );
});

test("runtime AI modules have no source, retained evidence, or filesystem dependency", () => {
  for (const file of ["teamAi.mjs", "playerAi.mjs", "keeperAi.mjs", "tacticsState.mjs"]) {
    const text = readFileSync(new URL(`../src/cssoccer/${file}`, import.meta.url), "utf8");
    const imports = [...text.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);
    assert.ok(imports.every((specifier) => specifier.startsWith("./")));
    assert.doesNotMatch(text, /\.local\/|state\.jsonl|node:fs|readFile|oracle\/native/u);
  }
});

function liveContext(activePlayerId) {
  return {
    activePlayerId,
    rngState: createCssoccerNativeRngState(),
    tactics: sourceTactics(),
    match: baseMatch({ possession: 0 }),
    pathTargets: {
      A: { x: 620, y: 400, z: 2 },
      B: { x: 660, y: 400, z: 2 },
    },
    predictions: Array.from({ length: 8 }, (_, index) => ({
      x: 640 + index,
      y: 400,
      z: 2,
    })),
    sourceConstants: sourceConstants(),
    keeperFacts: {
      "spain-player-01": {},
      "argentina-player-01": {},
    },
  };
}

function playerContext(overrides = {}) {
  const match = baseMatch(overrides);
  const selectors = {
    nearestBySlot: { A: 2, B: 13 },
    nearPathBySlot: { A: 2, B: 13 },
    interceptorBySlot: { A: 0, B: 0 },
    distanceRankById: Object.fromEntries(fixedPlayerIds().map((id) => [id, 5])),
  };
  return {
    match,
    tactics: sourceTactics(),
    selectors,
    pathTargets: {
      A: { x: 620, y: 400, z: 2 },
      B: { x: 660, y: 400, z: 2 },
    },
    sourceConstants: sourceConstants(),
    predictions: Array.from({ length: 8 }, (_, index) => ({
      x: 640 + index,
      y: 400,
      z: 2,
    })),
    supportFacts: overrides.supportFacts,
  };
}

function baseMatch(overrides = {}) {
  return {
    livePlay: true,
    possession: overrides.possession ?? 0,
    ball: { position: { x: f32(640), y: f32(400), z: f32(2) } },
    ballInHands: false,
    ballInAir: false,
    ballOutOfPlay: false,
    ballZoneBySlot: { A: 0, B: 0 },
    pitch: { length: 1280, width: 800, ratio: 1280 / 120 },
    logicCount: overrides.logicCount ?? 0,
    shotPending: false,
    shotAcknowledged: false,
    cannotPickUp: 0,
    seed: 64,
    analogue: false,
  };
}

function sourceConstants() {
  return {
    keeper: projectCssoccerKeeperSourceConstants(CSSOCCER_NATIVE_GAMEPLAY_PROFILE),
  };
}

function runAiWindow(selectedCountry, tickCount) {
  const activePlayerId = `${selectedCountry}-player-07`;
  let state = createCssoccerTeamAiState(syntheticTeamState(selectedCountry));
  let rng = createCssoccerNativeRngState();
  const trace = [];
  for (let index = 0; index < tickCount; index += 1) {
    const context = liveContext(activePlayerId);
    context.rngState = rng;
    const result = stepCssoccerTeamAi(state, context);
    trace.push({
      tick: result.state.tick,
      sourceFrame: result.state.sourceFrame,
      decisionCount: result.decisions.length,
      processedOrder: result.state.lastProcessedOrder,
      keeperNumbers: result.decisions
        .filter(({ kind }) => kind.startsWith("keeper-"))
        .map(({ nativePlayerNumber }) => nativePlayerNumber)
        .sort((left, right) => left - right),
      decisions: result.decisions,
    });
    state = result.state;
    rng = advanceCssoccerNativeRng(rng);
  }
  return trace;
}

function pressureContext(player, possession, selectedTeamSlot) {
  const context = playerContext({ possession });
  context.selectedTeamSlot = selectedTeamSlot;
  context.match.ball.position = { ...player.position };
  context.selectors.distanceRankById[player.id] = 1;
  context.selectors.nearestBySlot[player.nativeTeamSlot] = player.nativePlayerNumber;
  context.retrieveFacts = {
    [player.id]: {
      inClose: true,
      holderFacing: "side",
      target: { x: f32(650), y: f32(400) },
    },
  };
  return context;
}

function syntheticTeamState(selectedCountry) {
  return {
    schema: "cssoccer-team-state@1",
    fixtureId: "spain-argentina-full-match",
    control: { selectedCountry },
    players: fixedPlayerIds().map((id) => syntheticTeamPlayer(id)),
  };
}

function syntheticTeamPlayer(id) {
  const country = id.startsWith("spain-") ? "spain" : "argentina";
  const rosterIndex = Number(id.slice(-2)) - 1;
  const nativePlayerNumber = rosterIndex + (country === "spain" ? 1 : 12);
  const x = f32(country === "spain" ? 200 + rosterIndex * 24 : 1080 - rosterIndex * 24);
  const y = f32(160 + rosterIndex * 48);
  const facingX = f32(country === "spain" ? 1 : -1);
  return {
    id,
    country,
    identity: {
      attributes: {
        pace: 64,
        power: 64,
        control: 64,
        flair: 64,
        vision: 64,
        accuracy: 64,
        stamina: 64,
        discipline: 64,
      },
    },
    kickoff: { active: { value: 1 } },
    current: {
      nativePlayerNumber,
      action: 0,
    },
    formation: {
      kickoff: {
        sourceValues: {
          x: { value: x },
          y: { value: y },
          z: { value: f32(0) },
          xDisplacement: { value: facingX },
          yDisplacement: { value: f32(0) },
          on: { value: 1 },
        },
      },
    },
  };
}

function syntheticKeeper(nativePlayerNumber) {
  return {
    id: nativePlayerNumber === 1 ? "spain-player-01" : "argentina-player-01",
    nativePlayerNumber,
    position: {
      x: nativePlayerNumber === 1 ? 8 : 1272,
      y: 400,
      z: 0,
    },
    attributes: { flair: 20, vision: 64, pace: 64 },
  };
}

let tacticsCache;
function sourceTactics() {
  if (tacticsCache) return tacticsCache;
  if (!existsSync(new URL("TAC_433.TAC", sourceRoot))) {
    const values = Array.from({ length: 70 }, () => (
      Array.from({ length: 10 }, () => [0, 0])
    ));
    tacticsCache = createCssoccerTacticsState({
      A: { formationId: 0, tableSha256: "0".repeat(64), values },
      B: { formationId: 0, tableSha256: "0".repeat(64), values },
    });
    return tacticsCache;
  }
  const bytes = readFileSync(new URL("TAC_433.TAC", sourceRoot));
  assert.equal(bytes.length, 70 * 10 * 2 * 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const values = Array.from({ length: 70 }, () => Array.from({ length: 10 }, () => {
    const point = [view.getInt32(offset, true), view.getInt32(offset + 4, true)];
    offset += 8;
    return point;
  }));
  tacticsCache = createCssoccerTacticsState({
    A: { formationId: 0, tableSha256: CSSOCCER_TACTICS_SOURCE.files[0].sha256, values },
    B: { formationId: 0, tableSha256: CSSOCCER_TACTICS_SOURCE.files[0].sha256, values },
  });
  return tacticsCache;
}

function retainedTicks(wantedTicks) {
  const ticks = new Map([...wantedTicks].map((tick) => [tick, new Map()]));
  const bytes = readFileSync(retainedUrl);
  let header;
  for (const line of bytes.toString("utf8").trim().split("\n")) {
    const record = JSON.parse(line);
    if (record.recordType === "header") {
      header = record;
    } else if (wantedTicks.has(record.tick)) {
      ticks.get(record.tick).set(record.fieldId, record);
    }
  }
  return { header, stateSha256: sha256(bytes), ticks };
}

function controlledPlayerIds(tick, ids) {
  return ids.filter((id) => tick.get(`players.${id}.control`).value === 1);
}

function fixedPlayerIds() {
  return ["argentina", "spain"].flatMap((country) => Array.from(
    { length: 11 },
    (_, index) => `${country}-player-${String(index + 1).padStart(2, "0")}`,
  ));
}

function assertTyped(record, valueType) {
  assert.ok(record);
  assert.equal(record.valueType, valueType);
  assert.match(record.numericBits, valueType === "u8" ? /^[a-f0-9]{2}$/u : /^[a-f0-9]{4}$/u);
}

function typedValue(fieldId, valueType, value) {
  const bytes = valueType === "u8" ? 1 : 2;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "u8") view.setUint8(0, value);
  else view.setInt16(0, value, false);
  return {
    fieldId,
    valueType,
    value,
    numericBits: [...new Uint8Array(buffer)]
      .map((entry) => entry.toString(16).padStart(2, "0"))
      .join(""),
  };
}

function sourceText(file) {
  return readFileSync(new URL(file, sourceRoot), "latin1");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

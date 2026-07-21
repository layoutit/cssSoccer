import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import { createBallMatchState } from "../src/cssoccer/ballMatchState.mjs";
import {
  CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA,
} from "../src/cssoccer/centrePassLaunch.mjs";
import {
  createCssoccerKickoffPlayerMotion,
} from "../src/cssoccer/kickoffPlayerMotion.mjs";
import {
  CSSOCCER_KICKOFF_CONSTANTS,
  createCssoccerKickoffState,
} from "../src/cssoccer/kickoffState.mjs";
import {
  stepCssoccerMatchLifecycle,
} from "../src/cssoccer/matchLifecycle.mjs";
import { createCssoccerMatchState } from "../src/cssoccer/matchState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  projectCssoccerNativeTeamRates,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  projectCssoccerKickoffSourceProfile,
} from "../src/cssoccer/nativeGameplayProfile.mjs";
import {
  CSSOCCER_OPENING_KICKOFF_COORDINATOR_SCHEMA,
  CSSOCCER_OPENING_KICKOFF_COORDINATOR_SOURCE,
  CSSOCCER_OPENING_KICKOFF_SOURCE_ORDER,
  CssoccerUnsupportedOpeningKickoffCoordinatorError,
  assertCssoccerOpeningKickoffCoordinator,
  createCssoccerOpeningKickoffCoordinator,
  stepCssoccerOpeningKickoffCoordinator,
} from "../src/cssoccer/openingKickoffCoordinator.mjs";
import {
  createCssoccerPlayerStaminaState,
  projectCssoccerPlayerStaminaTeamRates,
  stepCssoccerPlayerStaminaState,
} from "../src/cssoccer/playerStaminaState.mjs";
import { createPossessionState } from "../src/cssoccer/possessionState.mjs";

const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const fixtureFiles = {
  facts: new URL("facts/spain-argentina-full-match.json", generatedRoot),
  scene: new URL("scenes/spain-argentina-full-match.json", generatedRoot),
};
const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const sourceFiles = Object.fromEntries(
  CSSOCCER_OPENING_KICKOFF_COORDINATOR_SOURCE.files.map(({ file }) => [
    file,
    new URL(file, sourceRoot),
  ]),
);
const retainedUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const fixtureOptions = skipUnless(
  Object.values(fixtureFiles),
  "prepared opening coordinator fixture",
);
const sourceOptions = skipUnless(
  Object.values(sourceFiles),
  "ignored pinned Actua source",
);
const retainedOptions = skipUnless(
  [...Object.values(fixtureFiles), retainedUrl],
  "prepared fixture and retained native frontier",
);

const matchCache = new Map();
const secondHalfLifecycleCache = new Map();

test("source tick order keeps rules one store behind teams and officials", fixtureOptions, () => {
  let state = createCoordinator(openingInput("argentina"));
  assert.equal(state.schema, CSSOCCER_OPENING_KICKOFF_COORDINATOR_SCHEMA);
  assert.deepEqual(state.sourceOrder, CSSOCCER_OPENING_KICKOFF_SOURCE_ORDER);
  assert.equal(state.tick, 0);
  assert.equal(state.kickoffMotion.tick, 0);
  assert.equal(state.official.tick, 0);
  assert.equal(state.kickoff.phaseTick, 0);
  assert.equal(Object.isFrozen(state), true);

  state = advanceTo(state, 21);
  assert.equal(state.official.officials[0].action, 3);
  assert.equal(state.kickoff.readiness.refereeReady, false);
  assert.equal(state.ball.ball.tick, 21);

  state = advanceTo(state, 34);
  assert.equal(state.official.officials[0].action, 4);
  assert.equal(state.milestones.refereeReadyTick, 34);
  assert.equal(state.kickoff.readiness.refereeReady, false);

  state = stepCoordinator(state);
  assert.equal(state.tick, 35);
  assert.equal(state.kickoff.readiness.refereeReady, true);
  assert.equal(state.phase, "centre-positioning");
});

test("opening native team A reaches one deterministic 7-to-10 launch for either user country", fixtureOptions, () => {
  const runs = ["spain", "argentina"].map((selectedCountry) => (
    runToLaunch(createCoordinator(openingInput(selectedCountry)))
  ));

  for (const state of runs) {
    assert.equal(assertCssoccerOpeningKickoffCoordinator(state), state);
    assert.equal(state.phase, "launch-receipt");
    assert.equal(state.tick, 172);
    assert.equal(state.phaseTick, 172);
    assert.deepEqual(state.milestones, {
      playersSettledTick: 171,
      refereeReadyTick: 34,
      kickoffReadyTick: 172,
      launchReceiptTick: 172,
    });
    assert.equal(state.kickoff.phase, "normal-play");
    assert.equal(state.kickoff.clock.clockRunning, 1);
    assert.equal(state.kickoffMotion.tick, 171);
    assert.equal(state.official.tick, 34);
    assert.equal(state.launch.schema, CSSOCCER_CENTRE_PASS_LAUNCH_SCHEMA);
    assert.equal(state.launch.owner.country, "spain");
    assert.equal(state.launch.owner.takerId, "spain-player-07");
    assert.equal(state.launch.owner.receiverId, "spain-player-10");
    assert.equal(state.launch.request.nativePlayerNumber, 7);
    assert.equal(state.launch.request.targetPlayerNumber, 10);
    assert.equal(state.launch.action.action.value, 15);
    assert.equal(state.launch.ball.ball.tick, 172);
    assert.deepEqual(state.launch.ball.ball.position, { x: 640, y: 400, z: 2 });
    assert.equal(state.launch.possession.owner, 7);
    assert.equal(nativePlayer(state.possession, 7).stableId, "spain-player-07");
    assert.equal(nativePlayer(state.possession, 7).possession, 1);
  }

  assert.equal(
    JSON.stringify(runs[0]),
    JSON.stringify(runToLaunch(createCoordinator(openingInput("spain")))),
  );
  assert.equal(
    JSON.stringify(runs[1]),
    JSON.stringify(runToLaunch(createCoordinator(openingInput("argentina")))),
  );
});

test("post-swap native team A preserves Argentina identities through its launch receipt", fixtureOptions, () => {
  const first = runToLaunch(createCoordinator(secondHalfInput("argentina")));
  const duplicate = runToLaunch(createCoordinator(secondHalfInput("argentina")));

  assert.equal(first.phase, "launch-receipt");
  assert.equal(first.tick, 1674);
  assert.deepEqual(first.milestones, {
    playersSettledTick: 1673,
    refereeReadyTick: 1534,
    kickoffReadyTick: 1674,
    launchReceiptTick: 1674,
  });
  assert.equal(first.launch.matchHalf, 1);
  assert.deepEqual(first.launch.owner, {
    country: "argentina",
    nativeTeamSlot: "A",
    fixtureTeamIndex: 1,
    takerId: "argentina-player-07",
    takerNativePlayerNumber: 7,
    receiverId: "argentina-player-10",
    receiverNativePlayerNumber: 10,
  });
  assert.equal(first.launch.request.nativePlayerNumber, 7);
  assert.equal(first.launch.request.targetPlayerNumber, 10);
  assert.equal(first.launch.action.playerId, "argentina-player-07");
  assert.equal(first.possession.owner, 7);
  assert.equal(nativePlayer(first.possession, 7).stableId, "argentina-player-07");
  assert.equal(nativePlayer(first.possession, 12).stableId, "spain-player-01");
  assert.equal(JSON.stringify(first), JSON.stringify(duplicate));
});

test("launch is terminal here and malformed reducer seams fail closed", fixtureOptions, () => {
  const input = openingInput("spain");
  const launched = runToLaunch(createCoordinator(input));
  assert.throws(
    () => stepCoordinator(launched),
    (error) => error instanceof CssoccerUnsupportedOpeningKickoffCoordinatorError
      && error.boundary === "post-launch-contact",
  );

  const wrongBall = structuredClone(input.ball);
  wrongBall.ball.position.x = 641;
  assert.throws(
    () => createCoordinator({ ...input, ball: wrongBall }),
    /changed while canonicalizing|held centre ball/u,
  );

  const wrongPossession = structuredClone(input.possession);
  const player7 = nativePlayer(wrongPossession, 7);
  const player18 = nativePlayer(wrongPossession, 18);
  [player7.stableId, player18.stableId] = [player18.stableId, player7.stableId];
  assert.throws(
    () => createCoordinator({ ...input, possession: wrongPossession }),
    /must map/u,
  );

  const wrongMotion = structuredClone(input.kickoffMotion);
  wrongMotion.bindings.nativeGameplayProfileHash = "f".repeat(64);
  assert.throws(
    () => createCoordinator({ ...input, kickoffMotion: wrongMotion }),
    /profile bindings diverged|bindings changed|share one native gameplay/u,
  );

  const widened = { ...createCoordinator(input), contact: true };
  assert.throws(
    () => assertCssoccerOpeningKickoffCoordinator(widened),
    /exactly the supported fields/u,
  );
});

test("pinned source fixes ball-rules-teams-officials order and same-call launch", sourceOptions, () => {
  for (const { file, sha256 } of CSSOCCER_OPENING_KICKOFF_COORDINATOR_SOURCE.files) {
    assert.equal(hash(readFileSync(sourceFiles[file])), sha256, `${file} hash`);
  }
  const football = readFileSync(sourceFiles["FOOTBALL.CPP"], "latin1");
  assert.match(
    football,
    /process_ball\(\);[\s\S]*match_rules\(\);[\s\S]*process_flags\(\);[\s\S]*process_teams\(\);[\s\S]*process_offs\(\);/u,
  );
  const rules = readFileSync(sourceFiles["RULES.CPP"], "latin1");
  assert.match(
    rules,
    /char all_standing\(\)[\s\S]*--setp_wait_cnt[\s\S]*return\(\(i<=players\) \? TRUE:FALSE\);/u,
  );
  assert.match(
    rules,
    /void await_set_kick\(\)[\s\S]*all_standing\(\) && already_there[\s\S]*refs\[0\]\.act==4[\s\S]*refs\[0\]\.act=2[\s\S]*decide_set_kick\(\);[\s\S]*ready_set_kick\(\);/u,
  );
  assert.equal(CSSOCCER_OPENING_KICKOFF_COORDINATOR_SOURCE.qualification.endToEndNativeExact, false);
});

test("retained state agrees after the minute-one stamina edge through the launch motion seam", retainedOptions, async () => {
  const expected = await retainedPlayerX(new Set([26, 27]));
  let state = createCoordinator(openingInput("argentina"));
  state = advanceTo(state, 26);
  const player26 = state.kickoffMotion.players.find(({ nativePlayerNumber }) => (
    nativePlayerNumber === 1
  ));
  assert.equal(f32Bits(player26.position.x), expected.get(26).numericBits);

  state = stepCoordinator(state);
  const player27 = state.kickoffMotion.players.find(({ nativePlayerNumber }) => (
    nativePlayerNumber === 1
  ));
  assert.equal(expected.get(27).numericBits, "44053da6");
  assert.equal(f32Bits(player27.position.x), expected.get(27).numericBits);
  assert.equal(CSSOCCER_OPENING_KICKOFF_COORDINATOR_SOURCE.qualification.endToEndNativeExact, false);
});

test("runtime coordinator is browser-safe and cannot read source, retained state, or oracle data", () => {
  const source = readFileSync(
    new URL("../src/cssoccer/openingKickoffCoordinator.mjs", import.meta.url),
    "utf8",
  );
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(
    source,
    /node:|\.local\/|state\.jsonl|native\.raw|readFile|createReadStream|oracle/u,
  );
  assert.match(source, /post-launch-contact/u);
  assert.match(source, /MCC_PASS contact/u);
});

function createCoordinator(input) {
  return createCssoccerOpeningKickoffCoordinator({
    ...input,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  });
}

function openingInput(selectedCountry) {
  const match = preparedMatch(selectedCountry);
  return {
    kickoff: match.kickoff,
    kickoffMotion: match.kickoffMotion,
    ball: match.ball,
    possession: match.possession,
  };
}

function secondHalfInput(selectedCountry) {
  const match = preparedMatch(selectedCountry);
  const lifecycle = secondHalfLifecycle(selectedCountry);
  const kickoff = createCssoccerKickoffState({
    lifecycle,
    tacticsState: match.tactics,
    sourceProfile: projectCssoccerKickoffSourceProfile(
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    ),
  });
  const rates = new Map(projectCssoccerNativeTeamRates(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf: 1 },
  ).map(({ id, value }) => [id, value]));
  const playersById = new Map(lifecycle.teamState.players.map((player) => [
    player.id,
    player,
  ]));
  const players = kickoff.players.map((target) => {
    const player = playersById.get(target.id);
    const source = player?.formation?.kickoff?.sourceValues;
    assert.ok(player);
    assert.ok(source);
    assert.ok(rates.has(target.id));
    return {
      id: target.id,
      nativePlayerNumber: target.nativePlayerNumber,
      active: target.active,
      teamRate: rates.get(target.id),
      action: source.action.value,
      directionMode: 0,
      faceDirection: 0,
      position: { x: source.x.value, y: source.y.value },
      facing: {
        x: source.xDisplacement.value,
        y: source.yDisplacement.value,
      },
    };
  });
  const kickoffMotion = createCssoccerKickoffPlayerMotion({
    kickoffState: kickoff,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    pitchLength: CSSOCCER_KICKOFF_CONSTANTS.pitchLength,
    goToPositionDistance:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8,
    players,
    selectedCountry,
  });
  const tick = lifecycle.clock.tick;
  const ball = createBallMatchState({
    ball: {
      tick,
      position: kickoff.ball.position,
      previousPosition: kickoff.ball.position,
    },
  });
  const possession = createPossessionState({
    players: lifecycle.teamState.players
      .map((player) => ({
        nativePlayer: player.current.nativePlayerNumber,
        stableId: player.id,
        possession: 0,
      }))
      .sort((left, right) => left.nativePlayer - right.nativePlayer),
  });
  return { kickoff, kickoffMotion, ball, possession };
}

function preparedMatch(selectedCountry) {
  if (!matchCache.has(selectedCountry)) {
    matchCache.set(selectedCountry, createCssoccerMatchState({
      preparedFacts: JSON.parse(readFileSync(fixtureFiles.facts, "utf8")),
      preparedScene: JSON.parse(readFileSync(fixtureFiles.scene, "utf8")),
      selectedCountry,
    }));
  }
  return matchCache.get(selectedCountry);
}

function secondHalfLifecycle(selectedCountry) {
  if (!secondHalfLifecycleCache.has(selectedCountry)) {
    let lifecycle = preparedMatch(selectedCountry).lifecycle;
    while (lifecycle.clock.phase !== "halftime-end-swap-second-half-kickoff") {
      lifecycle = stepCssoccerMatchLifecycle(lifecycle).state;
    }
    secondHalfLifecycleCache.set(selectedCountry, lifecycle);
  }
  return secondHalfLifecycleCache.get(selectedCountry);
}

function runToLaunch(state) {
  const maximumTick = state.tick + 300;
  let current = state;
  while (current.phase !== "launch-receipt") {
    assert.ok(current.tick < maximumTick, "opening kickoff coordinator must not deadlock");
    current = stepCoordinator(current);
  }
  return current;
}

function advanceTo(state, tick) {
  let current = state;
  while (current.tick < tick) {
    current = stepCoordinator(current);
  }
  assert.equal(current.tick, tick);
  return current;
}

const openingStaminaByTick = new Map([[
  0,
  createCssoccerPlayerStaminaState({
    nativeFixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  }),
]]);

function stepCoordinator(state) {
  if (state.kickoff.matchHalf !== 0) {
    return stepCssoccerOpeningKickoffCoordinator(state);
  }
  const tick = state.tick + 1;
  let stamina = openingStaminaByTick.get(tick);
  if (stamina === undefined) {
    const previous = openingStaminaByTick.get(tick - 1);
    assert.ok(previous, `opening stamina tick ${tick - 1}`);
    stamina = stepCssoccerPlayerStaminaState(previous, {
      tick,
      gameMinute: Math.floor((tick * 9) / 240),
    });
    openingStaminaByTick.set(tick, stamina);
  }
  return stepCssoccerOpeningKickoffCoordinator(state, {
    teamRates: projectCssoccerPlayerStaminaTeamRates(stamina),
  });
}

function nativePlayer(possession, number) {
  return possession.players.find(({ nativePlayer }) => nativePlayer === number);
}

async function retainedPlayerX(wantedTicks) {
  const expected = new Map();
  const lines = createInterface({ input: createReadStream(retainedUrl) });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (
      wantedTicks.has(record.tick)
      && record.fieldId === "players.spain-player-01.x"
    ) {
      expected.set(record.tick, record);
    }
    if (record.tick > Math.max(...wantedTicks)) {
      lines.close();
      break;
    }
  }
  assert.equal(expected.size, wantedTicks.size);
  return expected;
}

function f32Bits(value) {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  return view.getUint32(0, false).toString(16).padStart(8, "0");
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function skipUnless(urls, label) {
  const missing = urls.filter((url) => !existsSync(url));
  return {
    skip: missing.length === 0
      ? false
      : `${label} unavailable: ${missing.map(({ pathname }) => pathname).join(", ")}`,
  };
}

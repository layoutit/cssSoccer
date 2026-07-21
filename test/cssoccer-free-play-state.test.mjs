import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_FREE_PLAY_SEEDED_PATHS,
  CSSOCCER_FREE_PLAY_STATE_SCHEMA,
  assertCssoccerFreePlayState,
  createCssoccerFreePlayRematchState,
  createCssoccerFreePlayState,
  deriveCssoccerFreePlayKickoffReadiness,
  setCssoccerFreePlayPaused,
} from "../src/cssoccer/freePlayState.mjs";

const HASH = "a".repeat(64);
const realFactsUrl = new URL(
  "../build/generated/public/cssoccer/facts/spain-argentina-full-match.json",
  import.meta.url,
);
const realSceneUrl = new URL(
  "../build/generated/public/cssoccer/scenes/spain-argentina-full-match.json",
  import.meta.url,
);

test("free-play state defaults to one fresh deterministic Argentina-owned match", () => {
  const fixture = createPreparedFixture();
  const first = createCssoccerFreePlayState(fixture);
  const second = createCssoccerFreePlayState(structuredClone(fixture));

  assert.deepEqual(first, second);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.players, second.players);
  assert.notStrictEqual(first.players[0], second.players[0]);
  assert.notStrictEqual(first.teams[0], second.teams[0]);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.schema, CSSOCCER_FREE_PLAY_STATE_SCHEMA);
  assert.equal(first.tick, 0);
  assert.equal(first.phase, "opening-kickoff");
  assert.equal(first.teams.length, 2);
  assert.equal(first.players.length, 22);
  assert.equal(first.officials.officials.length, 3);
  assert.equal(first.actors.count, 26);
  assert.equal(new Set(first.players.map(({ id }) => id)).size, 22);
  assert.equal(first.control.kind, "local-user");
  assert.equal(first.control.country, "argentina");
  assert.equal(first.control.teamId, "team-argentina");
  assert.equal(first.control.nativeTeamSlot, "B");
  assert.equal(first.control.activePlayerId, null);
  assert.equal(first.config.rules.offside, true);
  assert.equal(first.rules.state.config.offsideEnabled, 1);
  assert.equal(
    first.bindings.rulesSha256,
    "a36e7cfa33f1ec4c14fdcc94c373afc8dbb61b19a8ff8183adb20f42a95ddf2d",
  );
  assert.equal(first.control.eligiblePlayerIds.length, 11);
  assert.ok(first.control.eligiblePlayerIds.every((id) => id.startsWith("argentina-")));
  assert.deepEqual(first.ball.ball.position, { x: 640, y: 400, z: 2 });
  assert.equal(first.possession.owner, 0);
  assert.equal(first.clock.running, false);
  assert.deepEqual(first.score.goals, { spain: 0, argentina: 0 });
  assert.equal(first.kickoff.owner.country, "spain");
  assert.equal(first.kickoff.owner.nativeTeamSlot, "A");
  assert.equal(first.kickoff.phase, "source-initialization");
  assert.equal(first.kickoff.phaseTick, 0);
  assert.equal(first.kickoff.readiness.allStanding, false);
  assert.equal(first.kickoff.readiness.takerReady, false);
  assert.equal(first.kickoff.readiness.refereeReady, false);
  assert.equal(first.kickoff.readiness.readyForLaunch, false);
  assert.deepEqual(first.players[0].position, {
    x: Math.fround(640 - ((640 / 60) * 2)),
    y: Math.fround(640),
    z: Math.fround(0),
  });
  assert.deepEqual(first.players[11].position, {
    x: Math.fround(640 + ((640 / 60) * 2)),
    y: Math.fround(640),
    z: Math.fround(0),
  });
  assert.deepEqual(first.players[0].facing, { x: 1, y: 0 });
  assert.deepEqual(first.players[11].facing, { x: -1, y: 0 });
  assert.equal(first.players[0].animation.id, 78);
  assert.equal(first.players[0].animation.status, "source-initialized");
  assert.deepEqual(deriveCssoccerFreePlayKickoffReadiness(first), first.kickoff.readiness);
  assert.equal(assertCssoccerFreePlayState(first), first);
});

test("free-play state gives Spain the same local-user ownership and preserves it on rematch", () => {
  const fixture = createPreparedFixture();
  const state = createCssoccerFreePlayState({ ...fixture, controlCountry: "spain" });

  assert.equal(state.config.controlCountry, "spain");
  assert.equal(state.control.country, "spain");
  assert.equal(state.control.teamId, "team-spain");
  assert.equal(state.control.nativeTeamSlot, "A");
  assert.equal(state.control.nativeUserToken, -1);
  assert.equal(state.control.eligiblePlayerIds.length, 11);
  assert.ok(state.control.eligiblePlayerIds.every((id) => id.startsWith("spain-player-")));
  assert.equal(state.kickoff.motion.selectedCountry, "spain");
  assert.equal(assertCssoccerFreePlayState(state), state);

  const rematch = createCssoccerFreePlayRematchState(state, fixture);
  assert.equal(rematch.config.controlCountry, "spain");
  assert.equal(rematch.control.country, "spain");
  assert.equal(rematch.session.rematchIndex, 1);
  assert.throws(
    () => createCssoccerFreePlayState({ ...fixture, controlCountry: "brazil" }),
    /exactly spain or argentina/u,
  );
});

test("prepared replay, capture, and retained-state extras cannot affect initialization", () => {
  const baselineFixture = createPreparedFixture();
  const poisonedFixture = structuredClone(baselineFixture);
  poisonedFixture.preparedFacts.input = {
    schema: "poison-command-stream",
    commands: [{ tick: 999, moveX: 127, moveY: -127, buttons: 63 }],
  };
  poisonedFixture.preparedFacts.inputBindingSha256 = "b".repeat(64);
  poisonedFixture.preparedFacts.bindings = {
    nativeInputSha256: "c".repeat(64),
    nativeStateSha256: "d".repeat(64),
  };
  poisonedFixture.preparedScene.native = {
    terminalTick: 999,
    initialState: { tick: 999, poison: "native-state-poison" },
  };
  for (const group of ["players", "officials", "ball"]) {
    for (const root of poisonedFixture.preparedScene.roots[group]) {
      root.initialBinding = {
        tick: 999,
        sourceValues: { x: 123456 },
        poison: "retained-root-poison",
      };
    }
  }

  const baseline = createCssoccerFreePlayState(baselineFixture);
  const poisoned = createCssoccerFreePlayState(poisonedFixture);
  assert.deepEqual(poisoned, baseline);
  const serialized = JSON.stringify(poisoned);
  assert.doesNotMatch(serialized, /poison-command-stream|native-state-poison|retained-root-poison/u);
  assert.doesNotMatch(serialized, /nativeInputSha256|nativeStateSha256|inputBindingSha256/u);
});

test("changing the explicit seed changes only documented RNG state", () => {
  const fixture = createPreparedFixture();
  const baseline = createCssoccerFreePlayState(fixture);
  const changed = createCssoccerFreePlayState({ ...fixture, seed: 0x1234_5678 });
  assert.notDeepEqual(changed.rng, baseline.rng);
  assert.notDeepEqual(changed.ball.ball.rng, baseline.ball.ball.rng);
  assert.deepEqual(CSSOCCER_FREE_PLAY_SEEDED_PATHS, ["rng", "ball.ball.rng"]);
  assert.deepEqual(withoutSeededPaths(changed), withoutSeededPaths(baseline));
});

test("pause owns no hidden progress and rematch creates a fresh initial state", () => {
  const fixture = createPreparedFixture();
  const initial = createCssoccerFreePlayState(fixture);
  const paused = setCssoccerFreePlayPaused(initial, true, { reason: "user" });
  assert.equal(paused.session.paused, true);
  assert.equal(paused.session.pauseReason, "user");
  assert.equal(paused.tick, initial.tick);
  assert.deepEqual(paused.players, initial.players);
  assert.deepEqual(paused.ball, initial.ball);
  assert.deepEqual(paused.rng, initial.rng);
  const resumed = setCssoccerFreePlayPaused(paused, false);
  assert.equal(resumed.session.paused, false);
  assert.equal(resumed.session.pauseReason, null);
  assert.deepEqual(resumed.players, initial.players);
  assert.deepEqual(resumed.ball, initial.ball);

  const rematch = createCssoccerFreePlayRematchState(paused, fixture);
  assert.notStrictEqual(rematch, initial);
  assert.notStrictEqual(rematch.players[0], initial.players[0]);
  assert.equal(rematch.session.rematchIndex, 1);
  assert.equal(rematch.session.paused, false);
  assert.deepEqual(rematch.rng, initial.rng);
  assert.deepEqual(
    { ...rematch, session: { ...rematch.session, rematchIndex: 0 } },
    initial,
  );
});

test("free-play state fails closed when a whitelisted fixture fact or actor is missing", () => {
  const missingPlayer = createPreparedFixture();
  missingPlayer.preparedScene.roots.players.pop();
  assert.throws(
    () => createCssoccerFreePlayState(missingPlayer),
    /requires 22 player roots/u,
  );

  const wrongTiming = createPreparedFixture();
  wrongTiming.preparedFacts.timing.tickRateHz = 60;
  assert.throws(
    () => createCssoccerFreePlayState(wrongTiming),
    /timing changed/u,
  );

  const wrongTeam = createPreparedFixture();
  wrongTeam.preparedFacts.teams.teams[1].country = "brazil";
  assert.throws(
    () => createCssoccerFreePlayState(wrongTeam),
    /argentina team changed/u,
  );
});

test("free-play state has no replay/oracle engine dependency", () => {
  const source = readFileSync(
    new URL("../src/cssoccer/freePlayState.mjs", import.meta.url),
    "utf8",
  );
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.ok(imports.every((specifier) => (
    !/browserMatchEngine|matchState|oracle|capture|prepare|\.local/u.test(specifier)
  )));
  assert.doesNotMatch(source, /preparedFacts\.input|nativeInputSha256|sourceInputAtTick/u);
});

test("current prepared publication creates the same browser-owned initial contract", {
  skip: !existsSync(realFactsUrl) || !existsSync(realSceneUrl)
    ? "prepared cssoccer publication is unavailable"
    : false,
}, () => {
  const state = createCssoccerFreePlayState({
    preparedFacts: JSON.parse(readFileSync(realFactsUrl, "utf8")),
    preparedScene: JSON.parse(readFileSync(realSceneUrl, "utf8")),
  });
  assert.equal(state.players.length, 22);
  assert.equal(state.players[0].identity.name, "A. Zubizaretta");
  assert.equal(state.players[11].identity.name, "S. Goycoechea");
  assert.deepEqual(state.kickoff.owner, {
    country: "spain",
    nativeTeamSlot: "A",
    takerId: "spain-player-07",
    receiverId: "spain-player-10",
  });
  assert.equal(state.control.country, "argentina");
});

function createPreparedFixture() {
  const teams = [
    createPreparedTeam("spain", 0),
    createPreparedTeam("argentina", 1),
  ];
  const starters = teams.flatMap(({ roster }) => roster.starters);
  const tactics = Array.from({ length: 70 }, (_, row) => (
    Array.from({ length: 10 }, (_, index) => [
      120 + (index * 50) + row,
      140 + (index * 25) + row,
    ])
  ));
  const preparedFacts = {
    schema: "cssoccer-prepared-fixture-facts@1",
    id: "spain-argentina-full-match",
    status: "ready",
    control: {
      countries: ["spain", "argentina"],
      canonicalProfile: "argentina-control",
      ownershipSymmetryProfile: "spain-control",
      users: 1,
      autoPlayer: -1,
    },
    teams: {
      schema: "cssoccer-team-preparation@1",
      fixtureId: "spain-argentina-full-match",
      authoritySha256: HASH,
      sourceRevision: "fixture-source-revision",
      teams,
      starters,
    },
    tactics: {
      schema: "cssoccer-prepared-tactics@1",
      fixtureId: "spain-argentina-full-match",
      formationId: 0,
      formationSymbol: "F_4_3_3",
      layout: { rows: 70, outfieldPlayers: 10, coordinates: 2 },
      tableSha256: HASH,
      values: tactics,
    },
    timing: {
      tickRateHz: 20,
      timestepSeconds: 0.05,
      timeFactor: 2,
      playMinutesPerHalf: 1,
      fullMatchPlayMinutes: 2,
      gameMinutesPerHalf: 45,
      ticksPerHalf: 1_200,
      fullMatchPlayTicks: 2_400,
      liveBallOverrun: {
        allowed: true,
        maxTicksPerHalf: 200,
        clockResetAtEndSwap: "keep-minutes-reset-seconds",
      },
      publiclyConfigurable: false,
    },
    timingSha256: HASH,
    rules: {
      competition: { id: 0 },
      simulation: { id: 1 },
      offside: false,
      wind: false,
      substitutes: false,
      bookings: true,
      freeKicks: true,
      audio: false,
      drawsFinal: true,
      extraTime: false,
      penalties: false,
    },
    rulesSha256: HASH,
    seed: { value: 3523 },
    input: { poison: "ignored" },
    bindings: { nativeInputSha256: "b".repeat(64) },
    sourceFacts: {
      officials: {
        rendererIdentities: [22, 23, 24].map((nativeRendererIndex) => ({
          nativeRendererIndex,
        })),
      },
    },
  };
  const preparedScene = {
    schema: "cssoccer-prepared-match-scene@1",
    id: "spain-argentina-full-match",
    status: "ready",
    roots: {
      players: starters.map((starter) => ({
        id: starter.id,
        country: starter.id.startsWith("spain-") ? "spain" : "argentina",
        kind: "player",
        stableDom: true,
        nativeRuntimeIndex: starter.nativeRuntimeIndex,
        nativeRendererIndex: starter.nativeRendererIndex,
        initialBinding: { poison: "ignored-player-retained-state" },
      })),
      officials: [
        ["referee-00", 22],
        ["assistant-referee-01", 23],
        ["assistant-referee-02", 24],
      ].map(([id, nativeRendererIndex]) => ({
        id,
        country: null,
        kind: "official",
        stableDom: true,
        nativeRuntimeIndex: null,
        nativeRendererIndex,
        initialBinding: { poison: "ignored-official-retained-state" },
      })),
      ball: [{
        id: "ball-00",
        country: null,
        kind: "ball",
        stableDom: true,
        nativeRuntimeIndex: null,
        nativeRendererIndex: null,
        initialBinding: { poison: "ignored-ball-retained-state" },
      }],
    },
    native: { poison: "ignored-native-scene-state" },
  };
  return { preparedFacts, preparedScene };
}

function createPreparedTeam(country, teamIndex) {
  const nativeStart = teamIndex * 11;
  const starters = Array.from({ length: 11 }, (_, index) => {
    const nativeRuntimeIndex = nativeStart + index;
    return {
      id: `${country}-player-${String(index + 1).padStart(2, "0")}`,
      name: `${country} player ${index + 1}`,
      sourceRosterIndex: index,
      nativeRuntimeIndex,
      nativeRendererIndex: nativeRuntimeIndex,
      squadNumber: index,
      position: index === 0 ? 0 : index < 5 ? 1 : index < 8 ? 2 : 3,
      skinTone: 0,
      flags: 0,
      goalIndex: 3,
      attributes: {
        accuracy: 40 + index,
        control: 41 + index,
        discipline: 42 + index,
        flair: 43 + index,
        pace: 44 + index,
        power: 45 + index,
        stamina: 46 + index,
        vision: 47 + index,
      },
      sourceRecordByteRange: [nativeRuntimeIndex * 33, (nativeRuntimeIndex + 1) * 33],
      sourceRecordSha256: HASH,
    };
  });
  return {
    id: `team-${country}`,
    country,
    label: country === "spain" ? "Spain" : "Argentina",
    sourceTeamId: country === "spain" ? 2 : 20,
    nativeTeamSlot: teamIndex === 0 ? "A" : "B",
    nativeUserToken: teamIndex === 0 ? -1 : -2,
    identity: {
      name: country,
      nickname: country,
      coach: `${country} coach`,
      countryCode: country === "spain" ? "SP" : "AR",
      ranking: teamIndex + 1,
      teamNumber: country === "spain" ? 2 : 20,
      formation: 0,
      autoFormation: 0,
      computerFormation: 9,
    },
    formation: {
      selected: 0,
      automatic: 0,
      computer: 9,
      tacticsSha256: HASH,
    },
    kit: { bindingSha256: HASH },
    roster: {
      rosterSha256: HASH,
      startersSha256: HASH,
      starters,
    },
  };
}

function withoutSeededPaths(state) {
  const copy = structuredClone(state);
  delete copy.rng;
  delete copy.ball.ball.rng;
  return copy;
}

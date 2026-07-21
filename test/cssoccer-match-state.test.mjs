import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_MATCH_STATE_SOURCE,
  assertCssoccerMatchState,
  createCssoccerMatchState,
  resetCssoccerMatchState,
} from "../src/cssoccer/matchState.mjs";
import { CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH } from "../src/cssoccer/nativeFixturePlayerProfile.mjs";

const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const fixtureFiles = {
  facts: new URL("facts/spain-argentina-full-match.json", generatedRoot),
  scene: new URL("scenes/spain-argentina-full-match.json", generatedRoot),
};
const missing = Object.values(fixtureFiles).filter((url) => !existsSync(url));
const fixtureOptions = {
  skip: missing.length > 0
    ? `prepared fixture unavailable: ${missing.map(({ pathname }) => pathname).join(", ")}`
    : false,
};

test("root kickoff state binds every accepted deterministic core for either country", fixtureOptions, () => {
  const fixture = readFixture();
  const argentina = createCssoccerMatchState({
    ...fixture,
    selectedCountry: "argentina",
  });
  const spain = createCssoccerMatchState({
    ...fixture,
    selectedCountry: "spain",
  });

  for (const state of [argentina, spain]) {
    assert.equal(assertCssoccerMatchState(state), state);
    assert.equal(state.tick, 0);
    assert.equal(state.lifecycle.clock.tick, 0);
    assert.equal(state.lifecycle.clock.phase, "opening-kickoff");
    assert.deepEqual(state.lifecycle.score.goals, { spain: 0, argentina: 0 });
    assert.deepEqual(state.ball.ball.position, { x: 640, y: 400, z: 2 });
    assert.equal(state.ball.ball.tick, 0);
    assert.equal(state.possession.owner, 0);
    assert.equal(state.possession.players.length, 22);
    assert.deepEqual(state.rng, {
      schema: "cssoccer-native-rng@1",
      state: 3523,
      randSeed: 3181,
      seed: 109,
      calls: 0,
    });
    assert.deepEqual(state.ball.ball.rng, state.rng);
    assert.equal(state.zones.A.ballZone, 0);
    assert.equal(state.zones.B.ballZone, 0);
    assert.equal(state.tactics.status, "ready");
    assert.equal(
      state.tactics.slots.A.tableSha256,
      "79b999a42b9b32062445f10aeb35be3110f6e6c5c4e0a68454df271b538903d9",
    );
    assert.deepEqual(state.tactics.slots.A.values[0][0], [72, 152]);
    assert.deepEqual(state.tactics.slots.A.values[68][0], [288, 280]);
    assert.deepEqual(state.tactics.slots.B.values[69][9], [592, 632]);
    assert.equal(state.userControl.tick, -1);
    assert.equal(state.teamAi.tick, 0);
    assert.equal(state.teamAi.players.length, 22);
    assert.equal(state.kickoff.phase, "centre-positioning");
    assert.equal(state.kickoff.phaseTick, 0);
    assert.equal(state.kickoff.players.length, 22);
    assert.equal(state.kickoffMotion.tick, 0);
    assert.equal(state.kickoffMotion.players.length, 22);
    assert.equal(state.kickoffMotion.selectedCountry, state.selectedCountry);
    assert.equal(state.kickoffMotion.bindings.nativeGameplayProfileHash,
      "9961b831e5dc4d8efc602cb00b8c2fd506010d9072f4903eeb5c55e498dd8a82");
    assert.equal(state.officials.tick, 0);
    assert.equal(state.officials.centreOwner, "A");
    assert.equal(state.officials.officials.length, 3);
    assert.equal(state.officials.officials[0].action, 1);
    assert.equal(state.playerMotion.tick, 0);
    assert.equal(state.playerMotion.matchHalf, 0);
    assert.equal(state.playerMotion.players.length, 22);
    assert.equal(state.playerMotion.selectedCountry, state.selectedCountry);
    assert.equal(
      state.playerMotion.profileHash,
      "9961b831e5dc4d8efc602cb00b8c2fd506010d9072f4903eeb5c55e498dd8a82",
    );
    assert.equal(
      state.bindings.nativeFixturePlayerProfileHash,
      CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
    );
    assert.equal(Object.isFrozen(state), true);
  }

  assert.equal(argentina.selectedCountry, "argentina");
  assert.equal(argentina.bindings.controlProfile, "argentina-control");
  assert.equal(argentina.lifecycle.teamState.control.currentNativeTeamSlot, "B");
  assert.equal(spain.selectedCountry, "spain");
  assert.equal(spain.bindings.controlProfile, "spain-control");
  assert.equal(spain.lifecycle.teamState.control.currentNativeTeamSlot, "A");
  assert.deepEqual(argentina.ball, spain.ball);
  assert.deepEqual(argentina.possession, spain.possession);
  assert.deepEqual(argentina.tactics, spain.tactics);
  assert.equal(CSSOCCER_MATCH_STATE_SOURCE.fixedTiming.publiclyConfigurable, false);
});

test("root kickoff reset is byte-identical and cannot change country", fixtureOptions, () => {
  const baseline = createCssoccerMatchState({
    ...readFixture(),
    selectedCountry: "argentina",
  });
  const reset = resetCssoccerMatchState(baseline);
  assert.deepEqual(reset, baseline);
  assert.equal(JSON.stringify(reset), JSON.stringify(baseline));
});

test("root state rejects widened timing, seed, tactics, and typed seams", fixtureOptions, () => {
  const fixture = readFixture();
  assert.throws(() => createCssoccerMatchState({
    ...fixture,
    selectedCountry: "argentina",
    preparedFacts: {
      ...fixture.preparedFacts,
      timing: { ...fixture.preparedFacts.timing, publiclyConfigurable: true },
    },
  }), /fixed hidden two-minute/u);
  assert.throws(() => createCssoccerMatchState({
    ...fixture,
    selectedCountry: "argentina",
    preparedFacts: {
      ...fixture.preparedFacts,
      seed: { ...fixture.preparedFacts.seed, value: 3524 },
    },
  }), /seed/u);
  assert.throws(() => createCssoccerMatchState({
    ...fixture,
    selectedCountry: "argentina",
    preparedFacts: { ...fixture.preparedFacts, tactics: undefined },
  }), /tactic table/u);

  const baseline = createCssoccerMatchState({
    ...fixture,
    selectedCountry: "spain",
  });
  assert.throws(() => assertCssoccerMatchState({
    ...baseline,
    rng: { ...baseline.rng, seed: 108 },
  }), /seed must equal/u);
  assert.throws(() => assertCssoccerMatchState({
    ...baseline,
    duration: 2,
  }), /must contain exactly/u);
});

test("root match state has no source, oracle, parity, or filesystem runtime dependency", () => {
  const source = readFileSync(new URL("../src/cssoccer/matchState.mjs", import.meta.url), "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(source, /\.local\/|state\.jsonl|oracle|parity|node:fs|readFile/u);
});

function readFixture() {
  return {
    preparedFacts: JSON.parse(readFileSync(fixtureFiles.facts, "utf8")),
    preparedScene: JSON.parse(readFileSync(fixtureFiles.scene, "utf8")),
  };
}

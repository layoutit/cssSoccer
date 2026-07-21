import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_FREE_PLAY_CANDIDATE_IDENTITY_SCHEMA,
  CSSOCCER_FREE_PLAY_ENGINE_INDEPENDENCE_CHECK_ID,
  qualifyCssoccerFreePlayEngineIndependence,
} from "../src/cssoccer/freePlayEngineIndependence.mjs";
import { createCssoccerFreePlayState } from "../src/cssoccer/freePlayState.mjs";
import { engineIndependenceSubjectSha256 } from "../src/parity/io.mjs";

const GENERATED = new URL("../build/generated/public/cssoccer/", import.meta.url);
const FACTS = new URL("facts/spain-argentina-full-match.json", GENERATED);
const SCENE = new URL("scenes/spain-argentina-full-match.json", GENERATED);
const fixtureOptions = {
  skip: [FACTS, SCENE].some((file) => !existsSync(file))
    ? "prepared cssoccer fixture is unavailable"
    : false,
};

test("browser qualification binds the free-play command scenario and candidate runtime", fixtureOptions, async () => {
  const fixture = createFixture("argentina");
  const identity = candidateIdentity();
  const scenario = commandScenario(fixture.facts, identity);
  const qualified = await qualifyCssoccerFreePlayEngineIndependence({
    freePlayState: fixture.state,
    scenario,
    candidateIdentity: identity,
    nativeIdentity: nativeIdentity(fixture.facts),
    cryptoImpl: webcrypto,
  });

  assert.equal(qualified.schema, "cssoccer-engine-independence@1");
  assert.equal(qualified.status, "pass");
  assert.equal(qualified.bindings.scenarioSha256, scenario.bindings.scenarioSha256);
  assert.equal(qualified.bindings.profileSha256, scenario.bindings.profileSha256);
  assert.equal(qualified.bindings.inputSha256, scenario.bindings.commandSha256);
  assert.equal(qualified.bindings.contractSha256, scenario.bindings.fieldContractSha256);
  assert.equal(qualified.bindings.sourceSha256, identity.sourceSha256);
  assert.equal(qualified.bindings.buildSha256, identity.buildSha256);
  assert.equal(qualified.runtimeSnapshotSha256, identity.buildSha256);
  assert.equal(qualified.preparedInputSha256, scenario.bindings.commandSha256);
  assert.equal(qualified.check.id, CSSOCCER_FREE_PLAY_ENGINE_INDEPENDENCE_CHECK_ID);
  assert.equal(qualified.check.status, "pass");
  assert.equal(qualified.check.subjectSha256, engineIndependenceSubjectSha256(qualified));
  assert.deepEqual(qualified.blockers, []);
  assert.equal(Object.isFrozen(qualified), true);
});

test("qualification rejects native identity reuse and failed zero-substitution checks", fixtureOptions, async () => {
  const fixture = createFixture("spain");
  const native = nativeIdentity(fixture.facts);
  const reused = { ...candidateIdentity(), sourceSha256: native.sourceSha256 };
  await assert.rejects(
    qualifyCssoccerFreePlayEngineIndependence({
      freePlayState: fixture.state,
      scenario: commandScenario(fixture.facts, reused),
      candidateIdentity: reused,
      nativeIdentity: native,
      cryptoImpl: webcrypto,
    }),
    /must differ from the native oracle/u,
  );
  await assert.rejects(
    qualifyCssoccerFreePlayEngineIndependence({
      freePlayState: fixture.state,
      scenario: commandScenario(fixture.facts, candidateIdentity()),
      candidateIdentity: {
        ...candidateIdentity(),
        checks: { ...candidateIdentity().checks, nativeReplayReads: 1 },
      },
      nativeIdentity: native,
      cryptoImpl: webcrypto,
    }),
    /zero-substitution checks/u,
  );
});

test("qualification source is filesystem independent and exposes an explicit free-play API", () => {
  const source = readFileSync(
    new URL("../src/cssoccer/freePlayEngineIndependence.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /qualifyCssoccerFreePlayEngineIndependence/u);
  assert.doesNotMatch(source, /node:|\.local\/|state\.jsonl|native\.raw|readFile|createReadStream/u);
});

function createFixture(selectedCountry) {
  const facts = JSON.parse(readFileSync(FACTS, "utf8"));
  const scene = JSON.parse(readFileSync(SCENE, "utf8"));
  return {
    facts,
    state: createCssoccerFreePlayState({
      preparedFacts: facts,
      preparedScene: scene,
      selectedCountry,
    }),
  };
}

function commandScenario(facts, identity) {
  return Object.freeze({
    schema: "cssoccer-free-play-command-scenario@1",
    bindings: Object.freeze({
      buildSha256: identity.buildSha256,
      commandSha256: sha('{"tick":0,"moveX":0,"moveY":0,"buttons":0}\n'),
      fieldContractSha256: facts.bindings.nativeFieldContractSha256,
      profileSha256: facts.bindings.nativeProfileSha256,
      scenarioSha256: facts.bindings.nativeScenarioSha256,
      seed: facts.seed.value,
      sourceSha256: identity.sourceSha256,
      timestepMilliseconds: 50,
    }),
    commands: Object.freeze([{ tick: 0, moveX: 0, moveY: 0, buttons: 0 }]),
  });
}

function nativeIdentity(facts) {
  return Object.freeze({
    sourceSha256: facts.bindings.nativeSourceSha256,
    buildSha256: facts.bindings.nativeBuildSha256,
  });
}

function candidateIdentity() {
  return Object.freeze({
    schema: CSSOCCER_FREE_PLAY_CANDIDATE_IDENTITY_SCHEMA,
    qualifiedAt: "2026-07-19T13:00:00.000Z",
    sourceSha256: sha("free-play candidate source"),
    buildSha256: sha("free-play candidate build"),
    harnessSha256: sha("free-play candidate harness"),
    captureAdapterSha256: sha("free-play scenario adapter"),
    checks: Object.freeze({
      browserOwnedState: true,
      nativeReplayReads: 0,
      preparedInputOnly: true,
      retainedStateReads: 0,
      sourceCheckoutReads: 0,
    }),
  });
}

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

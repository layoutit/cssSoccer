import assert from "node:assert/strict";
import test from "node:test";

import {
  CSSOCCER_CONTROL_COUNTRIES,
  CSSOCCER_SLICE_ID,
  CSSOCCER_SOURCE_DATA,
  createCssoccerSlicePlan,
} from "../src/prepare/cssoccer/slicePlan.mjs";

test("the static descriptor pins the one Spain-Argentina source slice", () => {
  assert.equal(CSSOCCER_SLICE_ID, "spain-argentina-full-match");
  assert.equal(
    CSSOCCER_SOURCE_DATA.source.revision,
    "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  );
  assert.deepEqual(CSSOCCER_CONTROL_COUNTRIES, ["spain", "argentina"]);
  assert.deepEqual(
    {
      home: CSSOCCER_SOURCE_DATA.fixture.home.sourceTeamId,
      away: CSSOCCER_SOURCE_DATA.fixture.away.sourceTeamId,
      competition: CSSOCCER_SOURCE_DATA.fixture.competition.id,
      simulation: CSSOCCER_SOURCE_DATA.fixture.simulationMode.id,
      duration: CSSOCCER_SOURCE_DATA.fixture.duration.fullMatchPlayMinutes,
      half: CSSOCCER_SOURCE_DATA.fixture.duration.playMinutesPerHalf,
      timeFactor: CSSOCCER_SOURCE_DATA.fixture.duration.timeFactor,
      tickRateHz: CSSOCCER_SOURCE_DATA.fixture.duration.tickRateHz,
    },
    {
      home: 2,
      away: 20,
      competition: 0,
      simulation: 1,
      duration: 2,
      half: 1,
      timeFactor: 2,
      tickRateHz: 20,
    },
  );
  assert.equal(CSSOCCER_SOURCE_DATA.fixture.duration.publiclyConfigurable, false);
  assert.equal(CSSOCCER_SOURCE_DATA.fixture.duration.fullMatchPlayTicks, 2400);
  assert.equal(CSSOCCER_SOURCE_DATA.status, "ready");
  assert.equal(CSSOCCER_SOURCE_DATA.nativeProfileBindings.status, "ready");
  assert.ok(Object.isFrozen(CSSOCCER_SOURCE_DATA));
  assert.ok(Object.isFrozen(CSSOCCER_SOURCE_DATA.fixture.duration));
});

test("the slice plan accepts exactly the two control profiles", () => {
  const spain = createCssoccerSlicePlan();
  assert.equal(spain.id, "spain-argentina-full-match");
  assert.deepEqual(spain.control, {
    country: "spain",
    nativeTeamSlot: "A",
    nativeUserToken: -1,
    requiredProfileKey: "spain-control",
  });

  const argentina = createCssoccerSlicePlan({
    fixtureId: "spain-argentina-full-match",
    sceneId: "spain-argentina-full-match",
    controlCountry: "argentina",
    homeTeamId: 2,
    awayTeamId: 20,
    competitionId: 0,
    simulationModeId: 1,
    durationMinutes: 2,
    halfDurationMinutes: 1,
    timeFactor: 2,
    tickRateHz: 20,
  });
  assert.deepEqual(argentina.control, {
    country: "argentina",
    nativeTeamSlot: "B",
    nativeUserToken: -2,
    requiredProfileKey: "argentina-control",
  });
  assert.equal(argentina.fixture.homeTeamId, 2);
  assert.equal(argentina.fixture.awayTeamId, 20);
  assert.equal(argentina.nativeProfileGate.ready, true);
  assert.equal(argentina.nativeProfileGate.capture.terminalMatchHalf, 11);
  assert.deepEqual(argentina.nativeProfileGate.capture.clockAdvanceCounts, [1223, 1200]);
  assert.equal(argentina.nativeProfileGate.capture.regulationTicks, 2400);
  assert.deepEqual(argentina.nativeProfileGate.capture.liveBallOverrunTicks, [23, 0]);
  assert.equal(
    argentina.nativeProfileGate.profile.fullMatchExecutableSha256,
    "112d06d258857fc8506d2ad1653052890b07d27af45f159106fd7b99069d9d9d",
  );
  assert.ok(Object.isFrozen(argentina));
  assert.ok(Object.isFrozen(argentina.prepare.actors));
});

test("the slice plan rejects widened teams, durations, competitions, and routes", () => {
  const invalidRequests = [
    [{ controlCountry: "france" }, /exactly spain or argentina/u],
    [{ controlCountry: "Spain" }, /exactly spain or argentina/u],
    [{ controlCountry: null }, /exactly spain or argentina/u],
    [{ fixtureId: "argentina-spain" }, /fixtureId is fixed/u],
    [{ sceneId: "training" }, /sceneId is fixed/u],
    [{ homeTeamId: 20 }, /homeTeamId is fixed/u],
    [{ awayTeamId: 2 }, /awayTeamId is fixed/u],
    [{ competitionId: 1 }, /competitionId is fixed/u],
    [{ simulationModeId: 0 }, /simulationModeId is fixed/u],
    [{ durationMinutes: 1 }, /durationMinutes is fixed/u],
    [{ durationMinutes: 5 }, /durationMinutes is fixed/u],
    [{ durationMinutes: 90 }, /durationMinutes is fixed/u],
    [{ halfDurationMinutes: 2 }, /halfDurationMinutes is fixed/u],
    [{ timeFactor: 5 }, /timeFactor is fixed/u],
    [{ tickRateHz: 60 }, /tickRateHz is fixed/u],
    [{ nativeFixtureContractSha256: "0".repeat(64) }, /nativeFixtureContractSha256 is fixed/u],
    [{ nativeScenarioSha256: "0".repeat(64) }, /nativeScenarioSha256 is fixed/u],
    [{ nativeFieldContractSha256: "0".repeat(64) }, /nativeFieldContractSha256 is fixed/u],
    [{ nativeCaptureSha256: "0".repeat(64) }, /nativeCaptureSha256 is fixed/u],
    [{ nativeFixtureProfileSha256: "0".repeat(64) }, /nativeFixtureProfileSha256 is fixed/u],
    [{ nativeFullMatchExecutableSha256: "0".repeat(64) }, /nativeFullMatchExecutableSha256 is fixed/u],
    [{ nativeTerminalMatchHalf: 10 }, /nativeTerminalMatchHalf is fixed/u],
    [{ team: "spain" }, /Unsupported cssoccer slice option: team/u],
    [{ seed: 1, timestepSeconds: 0.05 }, /seed, timestepSeconds/u],
  ];

  for (const [request, expected] of invalidRequests) {
    assert.throws(() => createCssoccerSlicePlan(request), expected);
  }

  for (const request of [null, [], new Date(), Object.create(null)]) {
    assert.throws(
      () => createCssoccerSlicePlan(request),
      /slice request must be a plain object/u,
    );
  }
});

test("retained actor ids and native indices are stable and complete", () => {
  const actors = CSSOCCER_SOURCE_DATA.retainedScene.actors;
  assert.equal(actors.length, 26);
  assert.equal(new Set(actors.map(({ id }) => id)).size, actors.length);

  const spain = actors.filter(({ country }) => country === "spain");
  const argentina = actors.filter(({ country }) => country === "argentina");
  const officials = actors.filter(({ kind }) => kind === "official");
  assert.deepEqual(spain.map(({ id }) => id), playerIds("spain"));
  assert.deepEqual(argentina.map(({ id }) => id), playerIds("argentina"));
  assert.deepEqual(spain.map(({ nativeRendererIndex }) => nativeRendererIndex), range(0, 10));
  assert.deepEqual(argentina.map(({ nativeRendererIndex }) => nativeRendererIndex), range(11, 21));
  assert.deepEqual(officials.map(({ nativeRendererIndex }) => nativeRendererIndex), [22, 23, 24]);
  assert.equal(actors.at(-1).id, "ball-00");
  assert.equal(CSSOCCER_SOURCE_DATA.retainedScene.staticObjectIds.length, 9);
});

test("archive inputs have exact whole-file ranges and offset-table contracts", () => {
  const expected = {
    euro: [12346272, 968, 121, "024accf02afeeeeebc43af649754191ac1b192f5c955fb5335e50d8acc2f7177"],
    eurorend: [6613404, 1832, 229, "0c38ab865fcd1d62d7c0f3f88b861f4c43643caf402dea6fbe9b0f042fd340cb"],
    fap: [1452928, 216, 27, "4eb101f8b8bd44eca0b8824400476e4a8dbb704eb43c926e4d5bea5dbba26ff3"],
    fapf: [279252, 32, 4, "be064e6f13b91e2ebad8451e787a1bfe085aef256fc328433b7112d751fc1a67"],
  };

  assert.equal(CSSOCCER_SOURCE_DATA.archiveFormat.indexRecordBytes, 8);
  assert.equal(CSSOCCER_SOURCE_DATA.archiveFormat.endianness, "little");
  assert.equal(CSSOCCER_SOURCE_DATA.archiveFormat.selectorToRecord, "selector / 8");

  for (const archive of CSSOCCER_SOURCE_DATA.archives) {
    const [dataBytes, indexBytes, records, dataSha256] = expected[archive.id];
    assert.equal(archive.data.bytes, dataBytes);
    assert.deepEqual(archive.data.byteRange, [0, dataBytes]);
    assert.equal(archive.data.sha256, dataSha256);
    assert.equal(archive.index.bytes, indexBytes);
    assert.deepEqual(archive.index.byteRange, [0, indexBytes]);
    assert.equal(archive.index.records, records);
    assert.equal(records * 8, indexBytes);
    assert.equal(archive.index.last.offset + archive.index.last.size, dataBytes);
  }
});

test("retail team records stay pinned and native profile bindings are complete", () => {
  assert.deepEqual(
    CSSOCCER_SOURCE_DATA.unavailableStaticInputs.map(({ names, name }) => names ?? [name]),
    [["ACTREND.EQU"]],
  );
  const expectedTeamRecords = new Map([
    ["BIN_SPAIN", [[4531150, 4551480], 20330, "e3b2ef9fece408a8a33e92e435a83a2e3ba572c8392ffab920508076648af19d"]],
    ["BIN_SPAIN2", [[5415708, 5420892], 5184, "70874af96eac5c775796e5952762a2383be2400fffa5f28cd25f5fdbbc9cb675"]],
    ["BIN_ARGENTIA", [[4897090, 4917420], 20330, "715ff950c11f026ffa21f6ac9610a4fcfff8e1ea3e0a98c681910d6701bd7f02"]],
    ["BIN_ARGENTI2", [[5509020, 5514204], 5184, "19cf6ff8480373c8c7f4918565a0ce5193920d8bf0ce10ac25b2de7bd6bcdea2"]],
  ]);
  for (const team of [
    CSSOCCER_SOURCE_DATA.fixture.home,
    CSSOCCER_SOURCE_DATA.fixture.away,
  ]) {
    for (const selector of team.teamAssetSelectors) {
      assert.equal(selector.recordIndex, selector.selector / 8);
      const [byteRange, bytes, sha256] = expectedTeamRecords.get(selector.symbol);
      assert.deepEqual(selector.byteRange, byteRange);
      assert.equal(selector.bytes, bytes);
      assert.equal(selector.sha256, sha256);
    }
  }

  const bindings = CSSOCCER_SOURCE_DATA.nativeProfileBindings;
  assert.equal(bindings.schema, "cssoccer-native-profile-bindings@1");
  assert.equal(bindings.capture.playTicks, 2423);
  assert.equal(bindings.capture.fullMatchPlaySeconds, 121.15);
  assert.equal(bindings.capture.terminalTick, bindings.capture.ticks - 1);
  for (const profile of Object.values(bindings.profiles)) {
    for (const [key, value] of Object.entries(profile)) {
      if (key === "country" || key === "teamSlot") continue;
      assert.match(value, /^[0-9a-f]{64}$/u);
    }
  }

  const serialized = JSON.stringify(CSSOCCER_SOURCE_DATA);
  assert.doesNotMatch(serialized, /\/Users\//u);
  assert.doesNotMatch(serialized, /\.local\//u);
});

function playerIds(country) {
  return Array.from(
    { length: 11 },
    (_, index) => `${country}-player-${String(index + 1).padStart(2, "0")}`,
  );
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

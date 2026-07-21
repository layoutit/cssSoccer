import assert from "node:assert/strict";
import test from "node:test";

import {
  CSSOCCER_PERFORMANCE_TRACE_RESULT_SCHEMA,
  CSSOCCER_PERFORMANCE_TRACE_RUNTIME_SCHEMA,
  CSSOCCER_PERFORMANCE_TRACE_WINDOWS,
  createCssoccerPerformanceTraceRuntime,
} from "../src/cssoccer/performanceTraceRuntime.mjs";

test("runs 240 measured rAF frames through the fixed-step product callback", async () => {
  const fixture = runtimeFixture();
  const contract = fixture.runtime.contract();
  assert.equal(contract.schema, CSSOCCER_PERFORMANCE_TRACE_RUNTIME_SCHEMA);
  assert.equal(contract.status, "ready");
  assert.equal(contract.frameCount, 240);
  assert.deepEqual(contract.windows, CSSOCCER_PERFORMANCE_TRACE_WINDOWS);
  assert.equal(runtimeFixture({ controlCountry: "spain" }).runtime.contract().controlCountry, "spain");

  const result = await fixture.runtime.run("opening-live", {
    startMarker: "opening:start",
    endMarker: "opening:end",
  });
  assert.equal(result.schema, CSSOCCER_PERFORMANCE_TRACE_RESULT_SCHEMA);
  assert.equal(result.status, "complete");
  assert.equal(result.samples.length, 240);
  assert.deepEqual(result.samples[0], {
    frame: 0,
    tick: 0,
    simulationSteps: 0,
    elapsedMs: 16,
    frameMs: 16,
    stepCallMs: 0,
    productSimulationMs: 0,
    phases: { productAnimationFrame: 0, productSimulation: 0 },
    cameraPhases: { preparedLivePublication: 0 },
  });
  assert.equal(result.samples.at(-1).frame, 239);
  assert.equal(result.samples.at(-1).tick, 76);
  assert.equal(result.window.endTick, 76);
  assert.equal(result.samples.at(-1).elapsedMs, 3_840);
  assert.deepEqual(fixture.ticks, Array.from({ length: 77 }, (_, tick) => tick));
  assert.deepEqual(fixture.markers.map(({ marker }) => marker), ["opening:start", "opening:end"]);
  assert.equal(fixture.markers[0].stepCount, 1);
  assert.equal(fixture.markers[1].stepCount, 77);
  await assert.rejects(
    fixture.runtime.run("opening-live", { startMarker: "again:start", endMarker: "again:end" }),
    /only one retained window/u,
  );
});

test("fast-forwards outside trace markers and measures the exact halftime window", async () => {
  const fixture = runtimeFixture();
  const result = await fixture.runtime.run("halftime-rule-transition", {
    startMarker: "halftime:start",
    endMarker: "halftime:end",
  });
  assert.equal(result.window.startTick, 1_180);
  assert.equal(result.samples[0].tick, 1_180);
  assert.equal(result.samples.at(-1).tick, 1_256);
  assert.equal(result.window.endTick, 1_256);
  assert.equal(fixture.ticks.length, 1_257);
  assert.equal(fixture.markers[0].stepCount, 1_181, "product setup precedes the measured marker");
  assert.equal(fixture.markers[1].stepCount, 1_257);
  assert.deepEqual(fixture.ticks, Array.from({ length: 1_257 }, (_, tick) => tick));
});

test("fails closed on route, root, request, construction, and marker drift", async () => {
  assert.throws(() => runtimeFixture({ ready: false }).runtime.contract(), /ready canonical/u);
  assert.throws(
    () => runtimeFixture({ controlCountry: "france" }).runtime.contract(),
    /ready canonical/u,
  );
  assert.throws(() => runtimeFixture({ playerRootCount: 21 }).runtime.contract(), /37 stable roots, 22 players/u);
  assert.throws(() => runtimeFixture({ nativeRequestCount: 1 }).runtime.contract(), /zero errors or construction/u);
  assert.throws(() => runtimeFixture({ constructionCount: 1 }).runtime.contract(), /zero errors or construction/u);
  await assert.rejects(
    runtimeFixture().runtime.run("unknown", { startMarker: "a", endMarker: "b" }),
    /Unknown css.soccer production performance window/u,
  );
  await assert.rejects(
    runtimeFixture().runtime.run("opening-live", { startMarker: "same", endMarker: "same" }),
    /unique trace markers/u,
  );
});

function runtimeFixture({
  ready = true,
  playerRootCount = 22,
  nativeRequestCount = 0,
  constructionCount = 0,
  controlCountry = "argentina",
} = {}) {
  let now = 0;
  let rafTimestamp = 0;
  const ticks = [];
  const markers = [];
  const productScheduler = { accumulator: 0, lastTimestamp: null };
  const integrity = {
    rootCount: 37,
    skyBackdropRootCount: 1,
    playerRootCount,
    officialRootCount: 3,
    exactOfficialRootCount: 3,
    stableIdentityCount: 37,
    connectedRootCount: 37,
    pageErrorCount: 0,
    nativeRequestCount,
    presentationInterpolationMs: 0,
    presentationCameraInterpolated: false,
    presentationInterpolatedRootCount: 0,
    packedFrameStyleFrameSetCount: 4,
    packedFrameStyleLoadedChunkCount: 8,
    packedFrameStyleChunkLimitPerFrameSet: 12,
    packedFrameStyleChunkOverflowCount: 0,
    runtimeConstruction: {
      sourceParseCount: constructionCount,
      geometryBuildCount: 0,
      topologyBuildCount: 0,
      materialBuildCount: 0,
      assetBuildCount: 0,
      atlasBuildCount: 0,
    },
  };
  const runtime = createCssoccerPerformanceTraceRuntime({
    getReadyState: () => ({
      ready,
      status: ready ? "ready" : "choice",
      fixtureId: "spain-argentina-full-match",
      controlCountry,
    }),
    getBindings: bindings,
    getIntegrity: () => integrity,
    stepProductTick() {
      const tick = ticks.length;
      ticks.push(tick);
      return { frame: { tick } };
    },
    beginProductFrameTrace(timestamp) {
      productScheduler.accumulator = 0;
      productScheduler.lastTimestamp = timestamp;
      return { tick: ticks.at(-1), presentationInterpolationMs: 0 };
    },
    stepProductFrame(timestamp) {
      productScheduler.accumulator += timestamp - productScheduler.lastTimestamp;
      productScheduler.lastTimestamp = timestamp;
      let simulationSteps = 0;
      while (productScheduler.accumulator >= 50 && simulationSteps < 5) {
        ticks.push(ticks.length);
        productScheduler.accumulator -= 50;
        simulationSteps += 1;
      }
      const productSimulationMs = simulationSteps;
      const preparedLivePublicationMs = simulationSteps * 0.5;
      now += productSimulationMs + preparedLivePublicationMs;
      return {
        tick: ticks.at(-1),
        simulationSteps,
        productSimulationMs,
        preparedLivePublicationMs,
      };
    },
    requestAnimationFrameImpl(callback) {
      rafTimestamp = Math.max(rafTimestamp + 16, now);
      now = rafTimestamp;
      queueMicrotask(() => callback(rafTimestamp));
    },
    performanceImpl: { now: () => now },
    consoleImpl: {
      timeStamp(marker) {
        markers.push({ marker, stepCount: ticks.length });
      },
    },
  });
  return { runtime, ticks, markers };
}

function bindings() {
  return {
    gameplayProfileHash: "1".repeat(64),
    rulesSha256: "2".repeat(64),
    sourceRevision: "3".repeat(40),
    tacticsTableSha256: "4".repeat(64),
    teamAuthoritySha256: "5".repeat(64),
    timingSha256: "6".repeat(64),
  };
}

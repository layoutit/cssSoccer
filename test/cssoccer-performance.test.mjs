import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CSSOCCER_PERFORMANCE_BLOCKER_SCHEMA,
  CSSOCCER_PERFORMANCE_DEBUG_SCHEMA,
  CSSOCCER_PERFORMANCE_OVEN_SCHEMA,
  assertCssoccerPerformanceDebugContract,
  assertCssoccerPerformanceOvenReport,
  atomicWriteJson,
  createCssoccerBrowserResidency,
  createCssoccerPerformanceBlocker,
  createCssoccerPerformanceOvenReport,
  createCssoccerPerformanceRun,
  summarizeCssoccerChromeTrace,
} from "../src/performance/performanceOven.mjs";

test("normalizes three exact 240-frame windows into the current css.soccer Oven contract", () => {
  const runs = [
    run("opening-live", 160, "opening-kickoff-to-live-play"),
    run("goal-rule", 360, "live-play-and-goal-restart"),
    run("second-half", 1_760, "second-half-live-play"),
  ];
  const report = createCssoccerPerformanceOvenReport({
    runId: "cssoccer-perf-fixture",
    generatedAt: "2026-07-17T13:00:00.000Z",
    browser: browser(),
    machine: { platform: "darwin", arch: "arm64", cpu: "fixture", logicalCpus: 8 },
    scenario: scenario(),
    runs,
    artifacts: {
      report: ".local/cssoccer/performance/current.json",
      runs: runs.map(({ artifacts }) => artifacts),
    },
    provenance: {
      files: {
        "src/performance/performanceOven.mjs": { bytes: 1, sha256: "a".repeat(64) },
      },
    },
  });

  assert.equal(report.schema, CSSOCCER_PERFORMANCE_OVEN_SCHEMA);
  assert.equal(report.status, "pass");
  assert.equal(report.metrics.runCount, 3);
  assert.equal(report.metrics.p95FrameMs, 16);
  assert.equal(report.metrics.longTaskAtOrAbove50Count, 0);
  assert.equal(report.metrics.retainedJsHeapGrowthBytes, 0);
  assert.equal(report.metrics.droppedFrameRatio, 0);
  assert.equal(report.verdict.failCount, 0);
  assert.equal(report.history.at(-1).runId, report.runId);
  assert.equal(report.diagnostics.primaryTarget, null);
  assert.equal(assertCssoccerPerformanceOvenReport(report), report);
});

test("fails closed on run-count, frame, root, and deterministic-binding drift", () => {
  const accepted = run("opening-live", 160, "opening-kickoff-to-live-play");
  assert.throws(() => createCssoccerPerformanceOvenReport({
    runId: "two-runs",
    generatedAt: "2026-07-17T13:00:00.000Z",
    browser: browser(),
    machine: { platform: "darwin" },
    scenario: scenario(),
    runs: [accepted, accepted],
    artifacts: { report: "report.json" },
    provenance: { files: { "source.mjs": { bytes: 1, sha256: "a".repeat(64) } } },
  }), /exactly three/u);

  const samples = sampleSeries(160);
  assert.throws(() => createCssoccerPerformanceRun({
    ...runInput("short", 160, "short", samples.slice(1)),
  }), /exactly 240 samples/u);
  const rootDrift = createCssoccerPerformanceRun({
    ...runInput("roots", 600, "root-drift", sampleSeries(600)),
    integrity: { ...integrity(), playerRootCount: 21 },
  });
  const rootDriftReport = createCssoccerPerformanceOvenReport({
    runId: "root-drift",
    generatedAt: "2026-07-17T13:00:00.000Z",
    browser: browser(),
    machine: { platform: "darwin" },
    scenario: scenario(),
    runs: [accepted, rootDrift, run("second-half", 1_760, "second-half-live-play")],
    artifacts: { report: "report.json" },
    provenance: { files: { "source.mjs": { bytes: 1, sha256: "a".repeat(64) } } },
  });
  assert.equal(rootDriftReport.status, "fail");
  assert.equal(rootDriftReport.metrics.rootCoverageViolationCount, 1);

  const changed = structuredClone(accepted);
  changed.bindings.rulesSha256 = "f".repeat(64);
  assert.throws(() => createCssoccerPerformanceOvenReport({
    runId: "binding-drift",
    generatedAt: "2026-07-17T13:00:00.000Z",
    browser: browser(),
    machine: { platform: "darwin" },
    scenario: scenario(),
    runs: [accepted, changed, run("second-half", 1_760, "second-half-live-play")],
    artifacts: { report: "report.json" },
    provenance: { files: { "source.mjs": { bytes: 1, sha256: "a".repeat(64) } } },
  }), /bindings changed/u);
});

test("accepts only a source-labeled three-window production debug seam", () => {
  const value = {
    schema: CSSOCCER_PERFORMANCE_DEBUG_SCHEMA,
    status: "ready",
    route: "/",
    fixtureId: "spain-argentina-full-match",
    frameCount: 240,
    measurement: measurement(),
    bindings: bindings(),
    windows: [
      { id: "opening-live", startTick: 160, frameCount: 240, activity: "opening-live-play" },
      { id: "goal-rule", startTick: 360, frameCount: 240, activity: "goal-and-restart" },
      { id: "second-half", startTick: 1_760, frameCount: 240, activity: "second-half-live-play" },
    ],
    phaseDefinitions: phaseDefinitions(),
  };
  assert.equal(assertCssoccerPerformanceDebugContract(value).status, "ready");
  assert.throws(() => assertCssoccerPerformanceDebugContract({
    ...value,
    windows: value.windows.slice(0, 2),
  }), /exactly three/u);
  assert.throws(() => assertCssoccerPerformanceDebugContract({
    ...value,
    route: "/perf-fixture",
  }), /canonical route/u);
});

test("summarizes exclusive main-thread work and treats 50 ms as a long task", () => {
  const events = [
    { ph: "M", name: "thread_name", pid: 7, tid: 9, args: { name: "CrRendererMain" } },
    marker("window:start", 100_000),
    { ph: "X", name: "RunTask", cat: "toplevel", pid: 7, tid: 9, ts: 100_000, dur: 60_000 },
    { ph: "X", name: "FunctionCall", cat: "devtools.timeline", pid: 7, tid: 9, ts: 110_000, dur: 10_000 },
    { ph: "X", name: "Layout", cat: "devtools.timeline", pid: 7, tid: 9, ts: 120_000, dur: 10_000 },
    { ph: "I", name: "BeginFrame", pid: 7, tid: 10, ts: 130_000, args: { frameSeqId: 1 } },
    { ph: "I", name: "BeginFrame", pid: 7, tid: 10, ts: 140_000, args: { frameSeqId: 2 } },
    { ph: "I", name: "DroppedFrame", pid: 7, tid: 10, ts: 140_000, args: { frameSeqId: 2 } },
    { ph: "I", name: "UpdateCounters", pid: 7, tid: 9, ts: 150_000, args: { data: { jsHeapSizeUsed: 100, documents: 1, nodes: 40, jsEventListeners: 3 } } },
    { ph: "I", name: "UpdateCounters", pid: 7, tid: 9, ts: 160_000, args: { data: { jsHeapSizeUsed: 120, documents: 1, nodes: 40, jsEventListeners: 3 } } },
    marker("window:end", 200_000),
  ];
  const summary = summarizeCssoccerChromeTrace(events, {
    startMarker: "window:start",
    endMarker: "window:end",
    bucketDurationMs: 50,
  });
  assert.equal(summary.measurementWindow.durationMs, 100);
  assert.equal(summary.longTasks.atOrAboveBoundaryCount, 1);
  assert.equal(summary.longTasks.maxMs, 60);
  assert.equal(summary.groups.scripting.durationMs, 10);
  assert.equal(summary.groups.rendering.durationMs, 10);
  assert.equal(summary.groups.other.durationMs, 40);
  assert.equal(summary.health.frameDelivery.beginFrameCount, 2);
  assert.equal(summary.health.frameDelivery.droppedFrameCount, 1);
  assert.equal(summary.health.frameDelivery.droppedFrameRatio, 0.5);
  assert.equal(summary.health.counters.jsHeapSizeUsed.delta, 20);

  const exactBoundary = events.map((event) => (
    event.name === "RunTask" ? { ...event, dur: 50_000 } : event
  ));
  assert.equal(summarizeCssoccerChromeTrace(exactBoundary, {
    startMarker: "window:start",
    endMarker: "window:end",
  }).longTasks.atOrAboveBoundaryCount, 1);
});

test("atomically publishes validated JSON and retains a precise no-seam blocker", async () => {
  const root = await mkdtemp(join(tmpdir(), "cssoccer-performance-"));
  try {
    const path = join(root, "blocked", "performance-trace-blocker.json");
    const blocker = createCssoccerPerformanceBlocker({
      detectedAt: "2026-07-17T13:00:00.000Z",
      target: "http://127.0.0.1:5207/cssoccer/",
      browser: browser(),
      inspected: {
        ready: true,
        status: "ready",
        fixtureId: "spain-argentina-full-match",
        pageErrorCount: 0,
        requests: { nativeRequestCount: 0 },
        mount: {
          rootCount: 37,
          skyBackdropRootCount: 1,
          playerRootCount: 22,
          officialRootCount: 3,
          exactOfficialRootCount: 3,
          runtimeConstruction: zeroConstruction(),
        },
      },
      missingMethods: ["performanceTraceContract", "runPerformanceTraceWindow"],
    });
    assert.equal(blocker.schema, CSSOCCER_PERFORMANCE_BLOCKER_SCHEMA);
    assert.equal(blocker.publication.currentReportPublished, false);
    const published = await atomicWriteJson(path, blocker, {
      validate(value) {
        assert.equal(value.status, "blocked");
      },
    });
    assert.equal(published.path, path);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), blocker);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function run(id, startTick, activity) {
  return createCssoccerPerformanceRun(runInput(id, startTick, activity, sampleSeries(startTick)));
}

function runInput(id, startTick, activity, samples) {
  return {
    id,
    window: { id, startTick, endTick: startTick + 239, frameCount: 240, activity },
    bindings: bindings(),
    samples,
    trace: passingTrace(id),
    residency: createCssoccerBrowserResidency({
      before: residencySnapshot(),
      after: residencySnapshot(),
    }),
    integrity: integrity(),
    phaseDefinitions: phaseDefinitions(),
    startupReadyMs: 800,
    artifacts: {
      trace: `.local/cssoccer/performance/runs/${id}/trace.json`,
      samples: `.local/cssoccer/performance/runs/${id}/samples.json`,
    },
  };
}

function sampleSeries(startTick) {
  return Array.from({ length: 240 }, (_, frame) => ({
    frame,
    tick: startTick + frame,
    simulationSteps: frame === 0 ? 0 : 1,
    elapsedMs: frame * 16,
    frameMs: 16,
    stepCallMs: 1,
    productSimulationMs: 0.75,
    phases: { productionStep: 0.75 },
    cameraPhases: { preparedPublication: 0.25 },
  }));
}

function passingTrace(id) {
  return summarizeCssoccerChromeTrace([
    { ph: "M", name: "thread_name", pid: 7, tid: 9, args: { name: "CrRendererMain" } },
    marker(`${id}:start`, 100_000),
    { ph: "X", name: "RunTask", cat: "toplevel", pid: 7, tid: 9, ts: 100_000, dur: 40_000 },
    { ph: "X", name: "FunctionCall", cat: "devtools.timeline", pid: 7, tid: 9, ts: 110_000, dur: 5_000 },
    marker(`${id}:end`, 200_000),
  ], { startMarker: `${id}:start`, endMarker: `${id}:end` });
}

function marker(message, ts) {
  return { ph: "I", name: "TimeStamp", pid: 7, tid: 9, ts, args: { data: { message } } };
}

function phaseDefinitions() {
  return {
    runtime: [{
      id: "productionStep",
      label: "browser production match step",
      producer: "src/cssoccer/client.mjs",
      nextProbe: "Measure the same bounded production step with fixed scenario bindings.",
    }],
    camera: [{
      id: "preparedPublication",
      label: "prepared PolyCSS publication",
      producer: "src/cssoccer/polycssScene.mjs",
      nextProbe: "Separate stable transform and prepared-frame publication costs.",
    }],
  };
}

function integrity() {
  return {
    rootCount: 37,
    skyBackdropRootCount: 1,
    playerRootCount: 22,
    officialRootCount: 3,
    exactOfficialRootCount: 3,
    stableIdentityCount: 37,
    connectedRootCount: 37,
    pageErrorCount: 0,
    nativeRequestCount: 0,
    presentationInterpolationMs: 0,
    presentationCameraInterpolated: false,
    presentationInterpolatedRootCount: 0,
    packedFrameStyleFrameSetCount: 4,
    packedFrameStyleLoadedChunkCount: 8,
    packedFrameStyleChunkLimitPerFrameSet: 12,
    packedFrameStyleChunkOverflowCount: 0,
    runtimeConstruction: zeroConstruction(),
  };
}

function residencySnapshot() {
  return {
    jsHeapUsedBytes: 16 * 1024 * 1024,
    jsHeapTotalBytes: 32 * 1024 * 1024,
    documentCount: 1,
    domNodeCount: 5_000,
    jsEventListenerCount: 24,
  };
}

function zeroConstruction() {
  return {
    sourceParseCount: 0,
    geometryBuildCount: 0,
    topologyBuildCount: 0,
    materialBuildCount: 0,
    atlasBuildCount: 0,
    assetBuildCount: 0,
  };
}

function scenario() {
  return {
    id: "spain-argentina-full-match",
    route: "/",
    servedRoute: "/cssoccer/",
    controlCountry: "argentina",
    measurement: measurement(),
    bindings: bindings(),
  };
}

function measurement() {
  return {
    frameLoop: "canonical-product-fixed-step-raf@1",
    simulationStepMs: 50,
    maxSimulationStepsPerFrame: 5,
    presentation: "direct-current-state-transform-publication@1",
    presentationInterpolationMs: 0,
  };
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

function browser() {
  return {
    engine: "Chrome",
    version: "126.0.0.0",
    product: "Chrome/126.0.0.0",
    executable: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  };
}

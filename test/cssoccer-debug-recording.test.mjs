import assert from "node:assert/strict";
import test from "node:test";

import {
  CSSOCCER_DEBUG_RECORDING_STATUS_SCHEMA,
  CSSOCCER_MANUAL_PERFORMANCE_TRACE_SCHEMA,
  createCssoccerDebugRecorder,
  cssoccerDebugRecordingFilename,
} from "../src/cssoccer/debugRecording.mjs";

test("manual recorder captures real frame, product, long-task, DOM, and heap performance evidence", () => {
  let now = 100;
  const downloads = [];
  const statuses = [];
  const browser = performanceWindow(() => now);
  const document = {
    hidden: false,
    visibilityState: "visible",
    getElementsByTagName: () => ({ length: 512 }),
  };
  const state = debugState();
  const recorder = createCssoccerDebugRecorder({
    state,
    window: browser.window,
    document,
    fixedStepMilliseconds: 50,
    sampleIntervalMilliseconds: 250,
    maxSamples: 20,
    download: (recording) => downloads.push(recording),
    onStateChange: (status) => statuses.push(status),
  });

  assert.equal(recorder.start(), true);
  assert.equal(recorder.start(), false);
  assert.equal(recorder.status().schema, CSSOCCER_DEBUG_RECORDING_STATUS_SCHEMA);
  assert.equal(recorder.status().recording, true);
  assert.equal(recorder.status().sampleCount, 1);
  assert.equal(recorder.status().frameCount, 0);
  assert.equal(recorder.status().tickCount, 0);
  assert.equal(recorder.status().startTick, 7);

  now = 116.7;
  browser.stepAnimationFrame(116.7);
  now = 133.4;
  browser.stepAnimationFrame(133.4);
  now = 180;
  browser.stepAnimationFrame(180);

  state.inputState.keyboardCodes = ["KeyW"];
  state.lastInputCommand = { tick: 8, moveX: 0, moveY: -127, buttons: 0 };
  state.liveFrame = liveFrame(8);
  recorder.recordEvent("keyboard-input", {
    code: "KeyW",
    pressed: true,
    keyboardCodes: ["KeyW"],
  });
  recorder.recordProductTick({
    frame: state.liveFrame,
    command: state.lastInputCommand,
    markers: { kickoff: 0, matchMode: 1, setPiece: 0 },
    timings: { productSimulationMs: 1.25, preparedLivePublicationMs: 0.75 },
  });
  recorder.recordAnimationFrame({
    timestamp: 180,
    callbackMs: 2.5,
    simulationSteps: 1,
    elapsedMs: 46.6,
    accumulatorMs: 13.4,
    startTick: 7,
    endTick: 8,
  });
  browser.emitLongTask({
    name: "self",
    startTime: 150,
    duration: 55,
    attribution: [{ name: "unknown", containerType: "window" }],
  });

  now = 350;
  browser.memory.usedJSHeapSize = 12_500_000;
  browser.fireSampleTimer();
  assert.equal(recorder.status().sampleCount, 2);
  assert.equal(recorder.status().frameCount, 2);
  assert.equal(recorder.status().productFrameCount, 1);
  assert.equal(recorder.status().tickCount, 1);
  assert.equal(recorder.status().longTaskCount, 1);
  assert.equal(recorder.status().currentFrame.hitchesOver33Ms, 1);

  now = 400;
  const recording = recorder.stop("stop");
  assert.equal(recording.schema, CSSOCCER_MANUAL_PERFORMANCE_TRACE_SCHEMA);
  assert.equal(recording.metadata.kind, "manual-live-performance");
  assert.equal(recording.metadata.fixtureId, "spain-argentina-full-match");
  assert.equal(recording.metadata.controlCountry, "argentina");
  assert.equal(recording.metadata.measurement.frameLoop, "canonical-product-fixed-step-raf@1");
  assert.deepEqual(recording.metadata.sampling, {
    kind: "passive-raf-with-canonical-product-phases",
    sampleIntervalMilliseconds: 250,
    sampleLimit: 20,
    eventLimit: 10_000,
    fixedStepMilliseconds: 50,
    frameBudgetsMilliseconds: { hz60: 16.667, hz30: 33.333, hz20: 50 },
  });
  assert.equal(recording.metadata.capabilities.animationFrameSampler, true);
  assert.equal(recording.metadata.capabilities.longTaskObserver, true);
  assert.equal(recording.metadata.capabilities.performanceMemory, true);
  assert.equal(recording.metadata.prepared.sceneSha256, "b".repeat(64));
  assert.equal(recording.metadata.prepared.provenanceSha256, "c".repeat(64));
  assert.equal(recording.metadata.prepared.bindings.nativeScenarioSha256, "a".repeat(64));
  assert.deepEqual(recording.samples.map(({ reason }) => reason), ["start", "sample", "stop"]);
  assert.deepEqual(recording.samples.map(({ snapshot }) => snapshot.tick), [7, 8, 8]);
  assert.equal(recording.samples[1].frame.frames, 2);
  assert.equal(recording.samples[1].frame.p95Ms, 46.6);
  assert.equal(recording.samples[1].frame.longFramesOver33Ms, 1);
  assert.equal(recording.samples[1].product.animationFrameCallbacks.p95Ms, 2.5);
  assert.equal(recording.samples[1].product.productSimulationMs.p95Ms, 1.25);
  assert.equal(recording.samples[1].snapshot.dom.rootCount, 37);
  assert.equal(recording.samples[1].snapshot.dom.leafCount, 714);
  assert.equal(recording.samples[1].snapshot.dom.documentNodeCount, 512);
  assert.equal(recording.samples[1].snapshot.publication.runtimeConstructionCount, 0);
  assert.deepEqual(recording.summary.frameTiming, {
    elapsedMs: 300,
    frames: 2,
    averageMs: 31.65,
    minMs: 16.7,
    p50Ms: 16.7,
    p95Ms: 46.6,
    p99Ms: 46.6,
    maxMs: 46.6,
    effectiveFps: 31.596,
    longFramesOver16Ms: 2,
    longFramesOver33Ms: 1,
    longFramesOver50Ms: 0,
  });
  assert.equal(recording.summary.product.tickCount, 1);
  assert.equal(recording.summary.product.animationFrameCallbacks.p95Ms, 2.5);
  assert.equal(recording.summary.product.productSimulationMs.p95Ms, 1.25);
  assert.equal(recording.summary.product.preparedLivePublicationMs.p95Ms, 0.75);
  assert.equal(recording.summary.product.simulationSteps.total, 1);
  assert.equal(recording.summary.longTasks.supported, true);
  assert.equal(recording.summary.longTasks.count, 1);
  assert.equal(recording.summary.longTasks.maxMs, 55);
  assert.equal(recording.summary.memory.delta, 2_500_000);
  assert.equal(recording.summary.dom.roots.delta, 0);
  assert.equal(recording.summary.pageErrorCount, 0);
  assert.equal(recording.summary.eventsByKind["frame-hitch"], 1);
  assert.equal(recording.summary.eventsByKind["long-task"], 1);
  assert.equal(recording.summary.eventsByKind["keyboard-input"], 1);
  assert.equal(recording.durationMs, 300);
  assert.equal(Object.isFrozen(recording), true);
  assert.equal(Object.isFrozen(recording.samples[1].product), true);
  assert.deepEqual(downloads, [recording]);
  assert.equal(browser.window.__cssoccerLastPerformanceRecording, recording);
  assert.equal(browser.window.__cssoccerLastRecording, recording);
  assert.equal(recorder.lastRecording(), recording);
  assert.equal(
    JSON.parse(recorder.serializeLastRecording()).schema,
    CSSOCCER_MANUAL_PERFORMANCE_TRACE_SCHEMA,
  );
  assert.match(
    cssoccerDebugRecordingFilename(recording),
    /^cssoccer-perf-spain-argentina-full-match-.+\.json$/u,
  );
  assert.equal(recorder.status().recording, false);
  assert.equal(recorder.status().last.p95FrameMs, 46.6);
  assert.equal(statuses.at(-1).recording, false);
});

test("manual performance recorder refuses to start before the canonical match is ready", () => {
  const state = debugState();
  state.ready = false;
  const recorder = createCssoccerDebugRecorder({
    state,
    window: { performance: { now: () => 0 } },
    document: {},
    download: () => undefined,
  });
  assert.equal(recorder.start(), false);
  assert.equal(recorder.lastRecording(), null);
});

function performanceWindow(now) {
  let nextId = 1;
  const animationFrames = new Map();
  const timers = new Map();
  let observer = null;
  const memory = {
    usedJSHeapSize: 10_000_000,
    totalJSHeapSize: 20_000_000,
    jsHeapSizeLimit: 100_000_000,
  };
  class PerformanceObserver {
    static supportedEntryTypes = ["longtask"];

    constructor(callback) {
      this.callback = callback;
      this.records = [];
      observer = this;
    }

    observe(options) {
      assert.deepEqual(options, { type: "longtask", buffered: false });
    }

    takeRecords() {
      return this.records.splice(0);
    }

    disconnect() {}
  }
  const window = {
    location: { href: "https://css.soccer/" },
    navigator: {
      userAgent: "cssoccer-test",
      platform: "test",
      hardwareConcurrency: 8,
      deviceMemory: 16,
    },
    performance: { now, timeOrigin: 1_000, memory },
    PerformanceObserver,
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
    requestAnimationFrame(callback) {
      const id = nextId++;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      animationFrames.delete(id);
    },
    setInterval(callback) {
      const id = nextId++;
      timers.set(id, callback);
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    },
  };
  return {
    window,
    memory,
    stepAnimationFrame(timestamp) {
      assert.equal(animationFrames.size, 1);
      const [[id, callback]] = animationFrames;
      animationFrames.delete(id);
      callback(timestamp);
    },
    fireSampleTimer() {
      assert.equal(timers.size, 1);
      [...timers.values()][0]();
    },
    emitLongTask(entry) {
      observer.callback({ getEntries: () => [entry] });
    },
  };
}

function debugState() {
  return {
    ready: true,
    route: { fixtureId: "spain-argentina-full-match" },
    manifest: {
      schema: "cssoccer-prepared-manifest@1",
      defaultScene: {
        id: "spain-argentina-full-match",
        sha256: "b".repeat(64),
      },
      provenance: { sha256: "c".repeat(64) },
      bindings: { nativeScenarioSha256: "a".repeat(64) },
    },
    controlCountry: "argentina",
    oracleEngineIndependence: null,
    matchState: { tick: 7 },
    liveFrame: liveFrame(7),
    mount: {
      stats: () => ({
        rootCount: 37,
        playerRootCount: 22,
        officialRootCount: 3,
        exactOfficialRootCount: 3,
        stableIdentityCount: 37,
        connectedRootCount: 37,
        leafCount: 714,
        connectedLeafCount: 714,
        detachedLeafCount: 0,
        lastLiveRenderTick: 8,
        liveRenderApplyCount: 9,
        livePlayerTransformApplyCount: 50,
        livePlayerAnimationFrameApplyCount: 4,
        livePlayerAnimationFrameSkipCount: 2,
        frameStyleApplyCount: 6,
        frameRootStyleWriteCount: 6,
        frameLeafFullStyleWriteCount: 0,
        frameLeafTransformWriteCount: 12,
        frameLeafUnchangedSkipCount: 20,
        runtimeConstruction: {
          sourceParseCount: 0,
          geometryBuildCount: 0,
          topologyBuildCount: 0,
          materialBuildCount: 0,
          assetBuildCount: 0,
          atlasBuildCount: 0,
        },
      }),
    },
    requestAudit: {
      snapshot: () => ({
        preparedRequestCount: 5,
        nativeRequestCount: 0,
        sourceRequestCount: 0,
        rejectedRequestCount: 0,
      }),
    },
    inputState: {
      focused: true,
      paused: false,
      keyboardCodes: [],
      pointers: [],
    },
    inputMode: "keyboard",
    lastInputCommand: { tick: 7, moveX: 0, moveY: 0, buttons: 0 },
    errors: [],
  };
}

function liveFrame(tick) {
  return {
    schema: "cssoccer-live-render-frame@1",
    tick,
    phase: tick === 7 ? "opening-kickoff" : "first-half-live-clock",
    terminal: false,
    matchHalf: 0,
    renderHalf: 0,
    score: { spain: 0, argentina: 0 },
    clock: { minutes: 0, seconds: tick / 20, running: tick > 7 },
    selectedPlayerId: "argentina-player-01",
  };
}

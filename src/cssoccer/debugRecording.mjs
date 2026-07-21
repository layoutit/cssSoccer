import {
  CSSOCCER_PERFORMANCE_MEASUREMENT,
} from "./performanceTraceRuntime.mjs";

export const CSSOCCER_MANUAL_PERFORMANCE_TRACE_SCHEMA =
  "cssoccer-manual-performance-trace@1";
export const CSSOCCER_DEBUG_RECORDING_STATUS_SCHEMA =
  "cssoccer-debug-recording-status@2";
export const CSSOCCER_PERFORMANCE_RECORDING_SAMPLE_MS = 250;
export const CSSOCCER_MANUAL_TRACE_MAX_SAMPLES = 2_400;

const MAX_EVENTS = 10_000;
const FRAME_BUDGET_60HZ_MS = 1_000 / 60;
const FRAME_BUDGET_30HZ_MS = 1_000 / 30;
const FRAME_BUDGET_20HZ_MS = 1_000 / 20;

export function createCssoccerDebugRecorder({
  state,
  window: windowImpl = globalThis.window,
  document: documentImpl = globalThis.document,
  fixedStepMilliseconds = 50,
  sampleIntervalMilliseconds = CSSOCCER_PERFORMANCE_RECORDING_SAMPLE_MS,
  maxSamples = CSSOCCER_MANUAL_TRACE_MAX_SAMPLES,
  download = (recording) => downloadCssoccerDebugRecording(recording, {
    document: documentImpl,
    window: windowImpl,
  }),
  onStateChange = () => undefined,
} = {}) {
  requirePlainObject(state, "css.soccer debug recording state");
  requirePositiveFinite(fixedStepMilliseconds, "css.soccer debug recording fixed step");
  requirePositiveFinite(
    sampleIntervalMilliseconds,
    "css.soccer performance recording sample interval",
  );
  requirePositiveInteger(maxSamples, "css.soccer debug recording sample limit");
  requireFunction(download, "css.soccer debug recording download");
  requireFunction(onStateChange, "css.soccer debug recording state listener");

  let active = null;
  let last = null;
  let measurements = null;
  let startedAtMonotonic = 0;
  let sampleWindowStartedAt = 0;
  let sampleTimer = null;
  let frameHandle = null;
  let lastFrameAt = null;
  let longTaskObserver = null;

  function status() {
    const currentFrame = measurements?.latestFrameStats ?? emptyFrameStats(0);
    return deepFreeze({
      schema: CSSOCCER_DEBUG_RECORDING_STATUS_SCHEMA,
      recording: active !== null,
      sampleCount: active?.samples.length ?? 0,
      frameCount: measurements?.frameTimes.length ?? 0,
      productFrameCount: measurements?.callbackTimes.length ?? 0,
      tickCount: measurements?.tickSimulationTimes.length ?? 0,
      eventCount: active?.events.length ?? 0,
      longTaskCount: measurements?.longTaskTimes.length ?? 0,
      durationMs: active === null ? 0 : round(elapsedMilliseconds()),
      startedAt: active?.metadata.startedAt ?? null,
      startTick: active?.samples[0]?.snapshot.tick ?? null,
      currentTick: active === null ? null : currentTick(state),
      currentFrame: {
        p95Ms: currentFrame.p95Ms,
        maxMs: currentFrame.maxMs,
        hitchesOver33Ms: measurements?.hitchesOver33Count ?? 0,
      },
      last: last === null
        ? null
        : {
            stoppedAt: last.stoppedAt,
            stopReason: last.stopReason,
            durationMs: last.durationMs,
            sampleCount: last.summary.sampleCount,
            frameCount: last.summary.frameTiming.frames,
            productFrameCount: last.summary.product.animationFrameCallbacks.samples,
            tickCount: last.summary.product.tickCount,
            eventCount: last.summary.eventCount,
            longTaskCount: last.summary.longTasks.count,
            startTick: last.summary.startTick,
            endTick: last.summary.endTick,
            p95FrameMs: last.summary.frameTiming.p95Ms,
            p99FrameMs: last.summary.frameTiming.p99Ms,
            maxFrameMs: last.summary.frameTiming.maxMs,
            hitchesOver33Ms: last.summary.frameTiming.longFramesOver33Ms,
          },
    });
  }

  function start() {
    if (active !== null || state.ready !== true) return false;
    const startedAt = timestamp();
    startedAtMonotonic = monotonicNow(windowImpl);
    sampleWindowStartedAt = startedAtMonotonic;
    measurements = createMeasurements();
    active = {
      schema: CSSOCCER_MANUAL_PERFORMANCE_TRACE_SCHEMA,
      metadata: createMetadata(state, windowImpl, documentImpl, {
        fixedStepMilliseconds,
        maxSamples,
        sampleIntervalMilliseconds,
        startedAt,
      }),
      samples: [],
      events: [],
    };
    active.metadata.capabilities.animationFrameSampler = startFrameSampler();
    active.metadata.capabilities.longTaskObserver = startLongTaskObserver();
    captureSample("start", { notify: false });
    startSampleTimer();
    notify();
    return true;
  }

  function recordProductTick(published) {
    if (active === null || measurements === null) return false;
    requirePlainObject(published, "css.soccer recorded product tick");
    const simulationMs = finiteNonNegativeOrZero(published.timings?.productSimulationMs);
    const publicationMs = finiteNonNegativeOrZero(
      published.timings?.preparedLivePublicationMs,
    );
    measurements.tickSimulationTimes.push(simulationMs);
    measurements.tickSimulationWindow.push(simulationMs);
    measurements.publicationTimes.push(publicationMs);
    measurements.publicationWindow.push(publicationMs);
    measurements.lastTick = published.frame?.tick ?? currentTick(state);
    return true;
  }

  function recordAnimationFrame(frame) {
    if (active === null || measurements === null) return false;
    requirePlainObject(frame, "css.soccer recorded animation frame");
    const callbackMs = finiteNonNegativeOrZero(frame.callbackMs);
    const elapsedMs = finiteNonNegativeOrZero(frame.elapsedMs);
    const accumulatorMs = finiteNonNegativeOrZero(frame.accumulatorMs);
    const simulationSteps = Number.isSafeInteger(frame.simulationSteps)
      && frame.simulationSteps >= 0
      ? frame.simulationSteps
      : 0;
    measurements.callbackTimes.push(callbackMs);
    measurements.callbackWindow.push(callbackMs);
    measurements.schedulerElapsedTimes.push(elapsedMs);
    measurements.schedulerElapsedWindow.push(elapsedMs);
    measurements.accumulatorTimes.push(accumulatorMs);
    measurements.accumulatorWindow.push(accumulatorMs);
    measurements.simulationSteps.push(simulationSteps);
    measurements.simulationStepsWindow.push(simulationSteps);
    measurements.lastProductFrame = {
      callbackMs,
      simulationSteps,
      tick: frame.endTick ?? currentTick(state),
    };
    if (callbackMs > FRAME_BUDGET_60HZ_MS) {
      appendEvent("product-frame-over-budget", {
        callbackMs: round(callbackMs),
        thresholdMs: round(FRAME_BUDGET_60HZ_MS),
        simulationSteps,
        startTick: frame.startTick ?? null,
        endTick: frame.endTick ?? null,
      });
    }
    return true;
  }

  function recordEvent(kind, details = {}) {
    if (active === null) return false;
    if (typeof kind !== "string" || kind.trim() === "") {
      throw new TypeError("css.soccer debug recording event kind must be a string.");
    }
    requirePlainObject(details, "css.soccer debug recording event details");
    appendEvent(kind, details);
    return true;
  }

  function stop(reason = "stop", { download: shouldDownload = true } = {}) {
    if (active === null || measurements === null) return null;
    if (!new Set(["stop", "limit", "dispose"]).has(reason)) {
      throw new RangeError("css.soccer debug recording stop reason is unsupported.");
    }
    if (typeof shouldDownload !== "boolean") {
      throw new TypeError("css.soccer debug recording download flag must be boolean.");
    }
    stopSampleTimer();
    flushLongTaskRecords();
    if (reason !== "dispose") {
      captureSample(reason === "limit" ? "limit" : "stop", { notify: false });
    }
    stopFrameSampler();
    stopLongTaskObserver();
    const finished = active;
    finished.stoppedAt = timestamp();
    finished.durationMs = elapsedMilliseconds();
    finished.stopReason = reason;
    finished.summary = summarizeRecording(finished, measurements);
    last = deepFreeze(finished);
    active = null;
    measurements = null;
    exposeLastRecording(windowImpl, last);
    notify();
    if (reason !== "dispose" && shouldDownload) {
      try {
        download(last);
      } catch {
        // The frozen in-memory trace and COPY TRACE remain available when a
        // browser blocks automatic downloads.
      }
    }
    return last;
  }

  function lastRecording() {
    return last;
  }

  function serializeLastRecording() {
    return last === null ? null : JSON.stringify(last, null, 2);
  }

  function dispose() {
    if (active !== null) stop("dispose", { download: false });
    else {
      stopSampleTimer();
      stopFrameSampler();
      stopLongTaskObserver();
    }
  }

  function startSampleTimer() {
    stopSampleTimer();
    if (typeof windowImpl?.setInterval !== "function") return false;
    sampleTimer = windowImpl.setInterval(() => {
      if (active === null) return;
      if (active.samples.length >= maxSamples - 1) {
        stop("limit");
        return;
      }
      captureSample("sample");
    }, sampleIntervalMilliseconds);
    return true;
  }

  function stopSampleTimer() {
    if (sampleTimer === null) return;
    windowImpl?.clearInterval?.(sampleTimer);
    sampleTimer = null;
  }

  function startFrameSampler() {
    stopFrameSampler();
    if (typeof windowImpl?.requestAnimationFrame !== "function") return false;
    lastFrameAt = null;
    frameHandle = windowImpl.requestAnimationFrame(tickFrameSampler);
    return true;
  }

  function stopFrameSampler() {
    if (frameHandle !== null) windowImpl?.cancelAnimationFrame?.(frameHandle);
    frameHandle = null;
    lastFrameAt = null;
  }

  function tickFrameSampler(now) {
    if (active === null || measurements === null) {
      frameHandle = null;
      return;
    }
    if (Number.isFinite(now) && lastFrameAt !== null) {
      const frameMs = Math.max(0, now - lastFrameAt);
      measurements.frameTimes.push(frameMs);
      measurements.frameWindow.push(frameMs);
      if (frameMs > FRAME_BUDGET_30HZ_MS) {
        measurements.hitchesOver33Count += 1;
        appendEvent("frame-hitch", {
          frameMs: round(frameMs),
          thresholdMs: round(FRAME_BUDGET_30HZ_MS),
          phase: currentPhase(state),
          paused: state.inputState?.paused === true,
          focused: state.inputState?.focused === true,
          documentHidden: documentImpl?.hidden === true,
          productFrame: clone(measurements.lastProductFrame),
        });
      }
    }
    if (Number.isFinite(now)) lastFrameAt = now;
    frameHandle = windowImpl.requestAnimationFrame(tickFrameSampler);
  }

  function startLongTaskObserver() {
    stopLongTaskObserver();
    const Observer = windowImpl?.PerformanceObserver;
    const supported = Observer?.supportedEntryTypes;
    if (
      typeof Observer !== "function"
      || (Array.isArray(supported) && !supported.includes("longtask"))
    ) return false;
    try {
      longTaskObserver = new Observer((list) => {
        for (const entry of list.getEntries()) recordLongTask(entry);
      });
      longTaskObserver.observe({ type: "longtask", buffered: false });
      return true;
    } catch {
      longTaskObserver = null;
      return false;
    }
  }

  function flushLongTaskRecords() {
    if (longTaskObserver === null) return;
    for (const entry of longTaskObserver.takeRecords?.() ?? []) recordLongTask(entry);
  }

  function stopLongTaskObserver() {
    longTaskObserver?.disconnect?.();
    longTaskObserver = null;
  }

  function recordLongTask(entry) {
    if (active === null || measurements === null) return;
    const durationMs = finiteNonNegativeOrZero(entry?.duration);
    if (durationMs <= 0) return;
    measurements.longTaskTimes.push(durationMs);
    const elapsedMs = Number.isFinite(entry?.startTime)
      ? Math.max(0, entry.startTime - startedAtMonotonic)
      : elapsedMilliseconds();
    appendEvent("long-task", {
      durationMs: round(durationMs),
      name: typeof entry?.name === "string" ? entry.name : null,
      attribution: projectLongTaskAttribution(entry?.attribution),
    }, elapsedMs);
  }

  function captureSample(reason, { notify: shouldNotify = true } = {}) {
    if (active === null || measurements === null) return;
    const captureStartedAt = monotonicNow(windowImpl);
    const frame = consumeFrameWindow(measurements, captureStartedAt - sampleWindowStartedAt);
    const product = consumeProductWindow(measurements);
    const snapshot = captureSnapshot(state, windowImpl, documentImpl);
    const captureMs = Math.max(0, monotonicNow(windowImpl) - captureStartedAt);
    active.samples.push({
      sequence: active.samples.length,
      reason,
      elapsedMs: round(Math.max(0, captureStartedAt - startedAtMonotonic)),
      wallTime: timestamp(),
      captureMs: round(captureMs),
      frame,
      product,
      snapshot,
    });
    measurements.latestFrameStats = frame;
    sampleWindowStartedAt = captureStartedAt;
    if (shouldNotify) notify();
  }

  function appendEvent(kind, details, elapsedMs = elapsedMilliseconds()) {
    if (active === null || active.events.length >= MAX_EVENTS) return false;
    active.events.push({
      sequence: active.events.length,
      elapsedMs: round(Math.max(0, elapsedMs)),
      wallTime: timestamp(),
      tick: currentTick(state),
      kind,
      details: clone(details),
    });
    return true;
  }

  function elapsedMilliseconds() {
    return Math.max(0, monotonicNow(windowImpl) - startedAtMonotonic);
  }

  function notify() {
    onStateChange(status());
  }

  return Object.freeze({
    dispose,
    isRecording: () => active !== null,
    lastRecording,
    recordAnimationFrame,
    recordEvent,
    recordProductTick,
    serializeLastRecording,
    start,
    status,
    stop,
  });
}

export function downloadCssoccerDebugRecording(recording, {
  document: documentImpl = globalThis.document,
  window: windowImpl = globalThis.window,
} = {}) {
  if (!recording || recording.schema !== CSSOCCER_MANUAL_PERFORMANCE_TRACE_SCHEMA) return null;
  const BlobImpl = windowImpl?.Blob ?? globalThis.Blob;
  const URLImpl = windowImpl?.URL ?? globalThis.URL;
  if (
    !documentImpl?.createElement
    || typeof BlobImpl !== "function"
    || typeof URLImpl?.createObjectURL !== "function"
  ) return null;
  const blob = new BlobImpl([JSON.stringify(recording, null, 2)], {
    type: "application/json",
  });
  const url = URLImpl.createObjectURL(blob);
  const link = documentImpl.createElement("a");
  const filename = cssoccerDebugRecordingFilename(recording);
  link.href = url;
  link.download = filename;
  link.hidden = true;
  documentImpl.body?.appendChild(link);
  link.click();
  link.remove();
  windowImpl?.setTimeout?.(() => URLImpl.revokeObjectURL(url), 1_000);
  return filename;
}

export async function copyCssoccerDebugRecording(recording, {
  document: documentImpl = globalThis.document,
  window: windowImpl = globalThis.window,
} = {}) {
  if (!recording || recording.schema !== CSSOCCER_MANUAL_PERFORMANCE_TRACE_SCHEMA) return false;
  const text = JSON.stringify(recording, null, 2);
  if (typeof windowImpl?.navigator?.clipboard?.writeText === "function") {
    await windowImpl.navigator.clipboard.writeText(text);
    return true;
  }
  if (!documentImpl?.createElement || typeof documentImpl.execCommand !== "function") {
    return false;
  }
  const textarea = documentImpl.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  documentImpl.body?.appendChild(textarea);
  textarea.select();
  const copied = documentImpl.execCommand("copy") === true;
  textarea.remove();
  return copied;
}

export function cssoccerDebugRecordingFilename(recording) {
  const fixture = safeFilenamePart(recording?.metadata?.fixtureId ?? "match");
  const stamp = String(recording?.metadata?.startedAt ?? timestamp())
    .replace(/[:.]/gu, "-")
    .toLowerCase();
  return `cssoccer-perf-${fixture}-${stamp}.json`;
}

function createMetadata(state, windowImpl, documentImpl, {
  fixedStepMilliseconds,
  maxSamples,
  sampleIntervalMilliseconds,
  startedAt,
}) {
  const manifest = state.manifest ?? {};
  const performanceImpl = windowImpl?.performance;
  return {
    kind: "manual-live-performance",
    fixtureId: state.route?.fixtureId ?? manifest.defaultScene?.id ?? null,
    controlCountry: state.controlCountry ?? null,
    startedAt,
    pageUrl: windowImpl?.location?.href ?? null,
    userAgent: windowImpl?.navigator?.userAgent ?? null,
    platform: windowImpl?.navigator?.platform ?? null,
    hardwareConcurrency: finiteOrNull(windowImpl?.navigator?.hardwareConcurrency),
    deviceMemoryGiB: finiteOrNull(windowImpl?.navigator?.deviceMemory),
    measurement: clone(CSSOCCER_PERFORMANCE_MEASUREMENT),
    sampling: {
      kind: "passive-raf-with-canonical-product-phases",
      sampleIntervalMilliseconds,
      sampleLimit: maxSamples,
      eventLimit: MAX_EVENTS,
      fixedStepMilliseconds,
      frameBudgetsMilliseconds: {
        hz60: round(FRAME_BUDGET_60HZ_MS),
        hz30: round(FRAME_BUDGET_30HZ_MS),
        hz20: round(FRAME_BUDGET_20HZ_MS),
      },
    },
    capabilities: {
      animationFrameSampler: false,
      longTaskObserver: false,
      performanceMemory: performanceImpl?.memory !== undefined,
      documentVisibility: typeof documentImpl?.visibilityState === "string",
    },
    viewport: {
      width: finiteOrNull(windowImpl?.innerWidth),
      height: finiteOrNull(windowImpl?.innerHeight),
      devicePixelRatio: finiteOrNull(windowImpl?.devicePixelRatio),
    },
    prepared: {
      manifestSchema: manifest.schema ?? null,
      sceneId: manifest.defaultScene?.id ?? null,
      sceneSha256: manifest.defaultScene?.sha256 ?? null,
      provenanceSha256: manifest.provenance?.sha256 ?? null,
      bindings: clone(manifest.bindings ?? {}),
    },
    engine: state.engine === null || state.engine === undefined
      ? null
      : {
          schema: state.engine.schema ?? null,
          snapshot: clone(state.engine.snapshot?.() ?? null),
        },
  };
}

function createMeasurements() {
  return {
    frameTimes: [],
    frameWindow: [],
    callbackTimes: [],
    callbackWindow: [],
    schedulerElapsedTimes: [],
    schedulerElapsedWindow: [],
    accumulatorTimes: [],
    accumulatorWindow: [],
    simulationSteps: [],
    simulationStepsWindow: [],
    tickSimulationTimes: [],
    tickSimulationWindow: [],
    publicationTimes: [],
    publicationWindow: [],
    longTaskTimes: [],
    hitchesOver33Count: 0,
    lastProductFrame: null,
    lastTick: null,
    latestFrameStats: emptyFrameStats(0),
  };
}

function consumeFrameWindow(measurements, elapsedMs) {
  const values = measurements.frameWindow.splice(0);
  return summarizeFrameTiming(values, elapsedMs);
}

function consumeProductWindow(measurements) {
  const callbacks = measurements.callbackWindow.splice(0);
  const schedulerElapsed = measurements.schedulerElapsedWindow.splice(0);
  const accumulators = measurements.accumulatorWindow.splice(0);
  const steps = measurements.simulationStepsWindow.splice(0);
  const simulation = measurements.tickSimulationWindow.splice(0);
  const publication = measurements.publicationWindow.splice(0);
  return {
    animationFrameCallbacks: summarizeTiming(callbacks),
    schedulerElapsedMs: summarizeTiming(schedulerElapsed),
    accumulatorMs: summarizeTiming(accumulators),
    simulationSteps: summarizeSimulationSteps(steps),
    productSimulationMs: summarizeTiming(simulation),
    preparedLivePublicationMs: summarizeTiming(publication),
  };
}

function captureSnapshot(state, windowImpl, documentImpl) {
  const frame = state.liveFrame ?? null;
  const match = state.matchState ?? null;
  const mount = safeSnapshot(() => state.mount?.stats?.() ?? null);
  const requests = safeSnapshot(() => state.requestAudit?.snapshot?.() ?? null);
  const performanceImpl = windowImpl?.performance;
  const memory = performanceImpl?.memory;
  return {
    tick: frame?.tick ?? match?.tick ?? null,
    phase: frame?.phase ?? match?.phase ?? null,
    score: clone(frame?.score ?? match?.score?.goals ?? null),
    selectedPlayerId: frame?.selectedPlayerId
      ?? match?.control?.activePlayerId
      ?? null,
    focused: state.inputState?.focused === true,
    paused: state.inputState?.paused === true,
    inputMode: state.inputMode ?? null,
    pageErrorCount: Array.isArray(state.errors) ? state.errors.length : 0,
    document: {
      hidden: documentImpl?.hidden === true,
      visibilityState: documentImpl?.visibilityState ?? null,
    },
    memory: memory
      ? {
          usedJSHeapSize: finiteOrNull(memory.usedJSHeapSize),
          totalJSHeapSize: finiteOrNull(memory.totalJSHeapSize),
          jsHeapSizeLimit: finiteOrNull(memory.jsHeapSizeLimit),
        }
      : null,
    dom: {
      documentNodeCount: finiteOrNull(documentImpl?.getElementsByTagName?.("*")?.length),
      rootCount: mount?.rootCount ?? null,
      playerRootCount: mount?.playerRootCount ?? null,
      stableIdentityCount: mount?.stableIdentityCount ?? null,
      connectedRootCount: mount?.connectedRootCount ?? null,
      leafCount: mount?.leafCount ?? null,
      connectedLeafCount: mount?.connectedLeafCount ?? null,
      detachedLeafCount: mount?.detachedLeafCount ?? null,
    },
    publication: {
      lastLiveRenderTick: mount?.lastLiveRenderTick ?? null,
      liveRenderApplyCount: mount?.liveRenderApplyCount ?? null,
      playerTransformApplyCount: mount?.livePlayerTransformApplyCount ?? null,
      playerAnimationFrameApplyCount: mount?.livePlayerAnimationFrameApplyCount ?? null,
      playerAnimationFrameSkipCount: mount?.livePlayerAnimationFrameSkipCount ?? null,
      frameStyleApplyCount: mount?.frameStyleApplyCount ?? null,
      frameRootStyleWriteCount: mount?.frameRootStyleWriteCount ?? null,
      frameLeafFullStyleWriteCount: mount?.frameLeafFullStyleWriteCount ?? null,
      frameLeafTransformWriteCount: mount?.frameLeafTransformWriteCount ?? null,
      frameLeafUnchangedSkipCount: mount?.frameLeafUnchangedSkipCount ?? null,
      runtimeConstructionCount: sumFiniteValues(mount?.runtimeConstruction),
    },
    requests: requests === null
      ? null
      : {
          preparedRequestCount: requests.preparedRequestCount ?? null,
          nativeRequestCount: requests.nativeRequestCount ?? null,
          sourceRequestCount: requests.sourceRequestCount ?? null,
          rejectedRequestCount: requests.rejectedRequestCount ?? null,
        },
  };
}

function summarizeRecording(recording, measurements) {
  const first = recording.samples[0] ?? null;
  const last = recording.samples.at(-1) ?? null;
  return {
    durationMs: round(recording.durationMs ?? 0),
    sampleCount: recording.samples.length,
    eventCount: recording.events.length,
    eventsByKind: countBy(recording.events, ({ kind }) => kind),
    startTick: first?.snapshot.tick ?? null,
    endTick: last?.snapshot.tick ?? null,
    startPhase: first?.snapshot.phase ?? null,
    endPhase: last?.snapshot.phase ?? null,
    finalScore: clone(last?.snapshot.score ?? null),
    pageErrorCount: Math.max(0, ...recording.samples.map(({ snapshot }) => (
      snapshot.pageErrorCount ?? 0
    ))),
    hiddenSampleCount: recording.samples.filter(({ snapshot }) => (
      snapshot.document.hidden === true
    )).length,
    frameTiming: summarizeFrameTiming(measurements.frameTimes, recording.durationMs ?? 0),
    product: {
      tickCount: measurements.tickSimulationTimes.length,
      animationFrameCallbacks: summarizeTiming(measurements.callbackTimes),
      schedulerElapsedMs: summarizeTiming(measurements.schedulerElapsedTimes),
      accumulatorMs: summarizeTiming(measurements.accumulatorTimes),
      simulationSteps: summarizeSimulationSteps(measurements.simulationSteps),
      productSimulationMs: summarizeTiming(measurements.tickSimulationTimes),
      preparedLivePublicationMs: summarizeTiming(measurements.publicationTimes),
    },
    longTasks: {
      supported: recording.metadata.capabilities.longTaskObserver,
      count: measurements.longTaskTimes.length,
      ...summarizeTiming(measurements.longTaskTimes),
    },
    memory: summarizeGauge(recording.samples, ["snapshot", "memory", "usedJSHeapSize"]),
    dom: {
      documentNodes: summarizeGauge(
        recording.samples,
        ["snapshot", "dom", "documentNodeCount"],
      ),
      roots: summarizeGauge(recording.samples, ["snapshot", "dom", "rootCount"]),
      connectedRoots: summarizeGauge(
        recording.samples,
        ["snapshot", "dom", "connectedRootCount"],
      ),
      leaves: summarizeGauge(recording.samples, ["snapshot", "dom", "leafCount"]),
      connectedLeaves: summarizeGauge(
        recording.samples,
        ["snapshot", "dom", "connectedLeafCount"],
      ),
    },
    recordingCaptureMs: summarizeTiming(recording.samples.map(({ captureMs }) => captureMs)),
  };
}

function summarizeFrameTiming(values, elapsedMs) {
  const timing = summarizeTiming(values);
  return {
    elapsedMs: round(Math.max(0, elapsedMs)),
    frames: timing.samples,
    averageMs: timing.averageMs,
    minMs: timing.minMs,
    p50Ms: timing.p50Ms,
    p95Ms: timing.p95Ms,
    p99Ms: timing.p99Ms,
    maxMs: timing.maxMs,
    effectiveFps: timing.averageMs > 0 ? round(1_000 / timing.averageMs) : 0,
    longFramesOver16Ms: values.filter((value) => value > FRAME_BUDGET_60HZ_MS).length,
    longFramesOver33Ms: values.filter((value) => value > FRAME_BUDGET_30HZ_MS).length,
    longFramesOver50Ms: values.filter((value) => value > FRAME_BUDGET_20HZ_MS).length,
  };
}

function emptyFrameStats(elapsedMs) {
  return summarizeFrameTiming([], elapsedMs);
}

function summarizeTiming(values) {
  if (values.length === 0) {
    return {
      samples: 0,
      totalMs: 0,
      averageMs: 0,
      minMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
    };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    samples: values.length,
    totalMs: round(total),
    averageMs: round(total / values.length),
    minMs: round(sorted[0]),
    p50Ms: round(percentileSorted(sorted, 0.5)),
    p95Ms: round(percentileSorted(sorted, 0.95)),
    p99Ms: round(percentileSorted(sorted, 0.99)),
    maxMs: round(sorted.at(-1)),
  };
}

function summarizeSimulationSteps(values) {
  return {
    frames: values.length,
    total: values.reduce((sum, value) => sum + value, 0),
    max: Math.max(0, ...values),
    zeroStepFrames: values.filter((value) => value === 0).length,
    multiStepFrames: values.filter((value) => value > 1).length,
  };
}

function summarizeGauge(samples, path) {
  const values = samples
    .map((sample) => path.reduce((value, key) => value?.[key], sample))
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) {
    return { supported: false, start: null, end: null, delta: null, min: null, max: null };
  }
  return {
    supported: true,
    start: values[0],
    end: values.at(-1),
    delta: values.at(-1) - values[0],
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function projectLongTaskAttribution(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((entry) => ({
    name: entry?.name ?? null,
    containerType: entry?.containerType ?? null,
    containerName: entry?.containerName ?? null,
    containerId: entry?.containerId ?? null,
    containerSrc: entry?.containerSrc ?? null,
  }));
}

function currentTick(state) {
  return state.liveFrame?.tick ?? state.matchState?.tick ?? null;
}

function currentPhase(state) {
  return state.liveFrame?.phase ?? state.matchState?.phase ?? null;
}

function exposeLastRecording(windowImpl, recording) {
  if (!windowImpl || (typeof windowImpl !== "object" && typeof windowImpl !== "function")) return;
  for (const name of ["__cssoccerLastPerformanceRecording", "__cssoccerLastRecording"]) {
    Object.defineProperty(windowImpl, name, {
      configurable: true,
      enumerable: false,
      value: recording,
    });
  }
}

function safeSnapshot(read) {
  try {
    return read();
  } catch {
    return null;
  }
}

function sumFiniteValues(value) {
  if (!value || typeof value !== "object") return null;
  return Object.values(value).reduce((sum, entry) => (
    typeof entry === "number" && Number.isFinite(entry) ? sum + entry : sum
  ), 0);
}

function countBy(values, keyFor) {
  const counts = {};
  for (const value of values) {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function percentileSorted(values, percentile) {
  if (values.length === 0) return 0;
  return values[Math.max(0, Math.ceil(values.length * percentile) - 1)];
}

function timestamp() {
  return new Date().toISOString();
}

function monotonicNow(windowImpl) {
  return typeof windowImpl?.performance?.now === "function"
    ? windowImpl.performance.now()
    : Date.now();
}

function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finiteNonNegativeOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function safeFilenamePart(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "") || "match";
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

function requireFunction(value, label) {
  if (typeof value !== "function") throw new TypeError(`${label} must be a function.`);
}

function requirePositiveFinite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`);
  }
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

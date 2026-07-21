import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";

export const CSSOCCER_PERFORMANCE_OVEN_SCHEMA =
  "cssoccer-performance-tracing-oven@1";
export const CSSOCCER_PERFORMANCE_HISTORY_SCHEMA =
  "cssoccer-performance-history-point@1";
export const CSSOCCER_PERFORMANCE_DIAGNOSTICS_SCHEMA =
  "cssoccer-performance-diagnostics@1";
export const CSSOCCER_PERFORMANCE_WINDOW_SCHEMA =
  "cssoccer-performance-window@1";
export const CSSOCCER_PERFORMANCE_DEBUG_SCHEMA =
  "cssoccer-production-performance-trace@2";
export const CSSOCCER_PERFORMANCE_BLOCKER_SCHEMA =
  "cssoccer-performance-trace-blocker@1";
export const CSSOCCER_BROWSER_RESIDENCY_SCHEMA =
  "cssoccer-browser-residency@1";

export const CSSOCCER_PERFORMANCE_REQUIREMENTS = Object.freeze({
  runCount: 3,
  frameCount: 240,
  rootCount: 37,
  playerRootCount: 22,
  p95FrameMs: 33,
  longTaskBoundaryMs: 50,
});

export const CSSOCCER_PERFORMANCE_BUDGETS = Object.freeze({
  p95FrameMs: 33,
  p95StepCallMs: 33,
  maxSimulationStepsPerFrame: 1,
  pageErrorCount: 0,
  nativeRequestCount: 0,
  runtimeConstructionCount: 0,
  longTaskAtOrAbove50Count: 0,
  domNodeGrowthCount: 0,
  documentGrowthCount: 0,
  eventListenerGrowthCount: 0,
  packedFrameStyleChunkOverflowCount: 0,
  rootCoverageViolationCount: 0,
  windowBindingMismatchCount: 0,
});

const SHA256 = /^[a-f0-9]{64}$/u;
const PERFORMANCE_MEASUREMENT = Object.freeze({
  frameLoop: "canonical-product-fixed-step-raf@1",
  simulationStepMs: 50,
  maxSimulationStepsPerFrame: 5,
  presentation: "direct-current-state-transform-publication@1",
  presentationInterpolationMs: 0,
});
const BINDING_KEYS = Object.freeze([
  "gameplayProfileHash",
  "rulesSha256",
  "sourceRevision",
  "tacticsTableSha256",
  "teamAuthoritySha256",
  "timingSha256",
]);
const CONSTRUCTION_KEYS = Object.freeze([
  "sourceParseCount",
  "geometryBuildCount",
  "topologyBuildCount",
  "materialBuildCount",
  "atlasBuildCount",
  "assetBuildCount",
]);
const TRACE_GROUP_DEFINITIONS = Object.freeze({
  scripting: Object.freeze({ label: "JS / scripting" }),
  rendering: Object.freeze({ label: "style / layout" }),
  painting: Object.freeze({ label: "paint / composite" }),
  other: Object.freeze({ label: "other renderer work" }),
});

export function assertCssoccerPerformanceDebugContract(value) {
  requirePlainObject(value, "css.soccer performance debug contract");
  if (
    value.schema !== CSSOCCER_PERFORMANCE_DEBUG_SCHEMA
    || value.status !== "ready"
    || value.route !== "/"
    || value.fixtureId !== "spain-argentina-full-match"
    || value.frameCount !== CSSOCCER_PERFORMANCE_REQUIREMENTS.frameCount
  ) {
    throw new Error(
      `css.soccer performance debug contract must use ${CSSOCCER_PERFORMANCE_DEBUG_SCHEMA} on the canonical route.`,
    );
  }
  const bindings = assertBindings(value.bindings, "performance debug bindings");
  const measurement = assertMeasurement(value.measurement, "performance debug measurement");
  if (!Array.isArray(value.windows) || value.windows.length !== 3) {
    throw new Error("css.soccer performance debug contract requires exactly three production windows.");
  }
  const ids = new Set();
  for (const window of value.windows) {
    requirePlainObject(window, "performance debug window");
    if (
      typeof window.id !== "string"
      || window.id.length === 0
      || ids.has(window.id)
      || !Number.isSafeInteger(window.startTick)
      || window.startTick < 0
      || typeof window.activity !== "string"
      || window.activity.length === 0
      || window.frameCount !== CSSOCCER_PERFORMANCE_REQUIREMENTS.frameCount
    ) {
      throw new Error("css.soccer performance debug windows must be unique, bounded, and source-labeled.");
    }
    ids.add(window.id);
  }
  assertPhaseDefinitions(value.phaseDefinitions?.runtime, "runtime phase definitions");
  assertPhaseDefinitions(value.phaseDefinitions?.camera, "camera phase definitions");
  return Object.freeze({ ...value, bindings, measurement });
}

export function createCssoccerPerformanceRun({
  id,
  window,
  bindings,
  samples,
  trace,
  residency,
  integrity,
  phaseDefinitions,
  startupReadyMs,
  artifacts,
} = {}) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("css.soccer performance run id must be non-empty.");
  }
  const acceptedWindow = assertWindow(window);
  const acceptedBindings = assertBindings(bindings, "performance run bindings");
  const acceptedSamples = assertSamples(samples, acceptedWindow);
  if (acceptedSamples.at(-1).tick !== acceptedWindow.endTick) {
    throw new Error("css.soccer performance window end tick does not match its product-frame samples.");
  }
  const acceptedTrace = assertTraceSummary(trace);
  const acceptedResidency = assertBrowserResidency(residency);
  const acceptedIntegrity = assertIntegrity(integrity);
  finiteNonNegative(startupReadyMs, "performance startupReadyMs");
  requirePlainObject(artifacts, "performance run artifacts");
  if (!artifacts.trace || !artifacts.samples) {
    throw new Error("css.soccer performance runs must bind raw trace and sample artifacts.");
  }

  const frameSeries = acceptedSamples.map((sample) => Object.freeze({
    frame: sample.frame,
    tick: sample.tick,
    elapsedMs: sample.elapsedMs,
    frameMs: sample.frameMs,
  }));
  const stepSeries = acceptedSamples.map((sample) => Object.freeze({
    frame: sample.frame,
    tick: sample.tick,
    simulationSteps: sample.simulationSteps,
    stepCallMs: sample.stepCallMs,
  }));
  const runtimePhaseTiming = summarizePhases(
    acceptedSamples,
    phaseDefinitions?.runtime,
    "phases",
    "cssoccer-runtime-dispatch-phase-summary@1",
  );
  const cameraPhaseTiming = summarizePhases(
    acceptedSamples,
    phaseDefinitions?.camera,
    "cameraPhases",
    "cssoccer-camera-publication-phase-summary@1",
  );
  const frameValues = frameSeries.map(({ frameMs }) => frameMs);
  const stepValues = stepSeries.map(({ stepCallMs }) => stepCallMs);
  const slowestSteps = [...stepSeries]
    .sort((left, right) => right.stepCallMs - left.stepCallMs || left.tick - right.tick)
    .slice(0, 12);

  return deepFreeze({
    schema: CSSOCCER_PERFORMANCE_WINDOW_SCHEMA,
    id,
    status: "passed",
    window: acceptedWindow,
    bindings: acceptedBindings,
    startupReadyMs,
    frameTiming: {
      p95FrameMs: percentile(frameValues, 0.95),
      p99FrameMs: percentile(frameValues, 0.99),
      maxFrameMs: Math.max(...frameValues),
      over33msRatio: frameValues.filter((value) => value > 33).length / frameValues.length,
      series: frameSeries,
    },
    stepTiming: {
      p95StepCallMs: percentile(stepValues, 0.95),
      maxStepCallMs: Math.max(...stepValues),
      slowestSteps,
      series: stepSeries,
      phaseTiming: runtimePhaseTiming,
      cameraPhaseTiming,
    },
    trace: acceptedTrace,
    residency: acceptedResidency,
    integrity: acceptedIntegrity,
    artifacts: clone(artifacts),
  });
}

export function assertCssoccerPerformanceRun(value, expectedBindings) {
  requirePlainObject(value, "css.soccer performance run");
  if (
    value.schema !== CSSOCCER_PERFORMANCE_WINDOW_SCHEMA
    || value.status !== "passed"
    || typeof value.id !== "string"
    || value.id.length === 0
  ) {
    throw new Error("css.soccer performance run is incomplete.");
  }
  const window = assertWindow(value.window);
  const bindings = assertBindings(value.bindings, "performance run bindings");
  if (expectedBindings && canonicalJson(bindings) !== canonicalJson(expectedBindings)) {
    throw new Error("css.soccer performance run bindings changed between windows.");
  }
  assertFrameTiming(value.frameTiming, window);
  assertStepTiming(value.stepTiming, window);
  assertTraceSummary(value.trace);
  assertBrowserResidency(value.residency);
  assertIntegrity(value.integrity);
  finiteNonNegative(value.startupReadyMs, "performance startupReadyMs");
  if (!value.artifacts?.trace || !value.artifacts?.samples) {
    throw new Error("css.soccer performance run artifacts are incomplete.");
  }
  return value;
}

export function createCssoccerPerformanceOvenReport({
  runId,
  generatedAt,
  browser,
  machine,
  scenario,
  runs,
  artifacts,
  provenance,
  priorHistory = [],
} = {}) {
  if (typeof runId !== "string" || runId.length === 0 || !isIsoTimestamp(generatedAt)) {
    throw new Error("css.soccer performance report requires a timestamped run id.");
  }
  requirePlainObject(browser, "performance browser");
  if (!browser.engine || !browser.version || browser.headless !== true) {
    throw new Error("css.soccer performance evidence requires a named headless real-browser target.");
  }
  requirePlainObject(machine, "performance machine");
  requirePlainObject(scenario, "performance scenario");
  if (
    scenario.id !== "spain-argentina-full-match"
    || scenario.route !== "/"
    || !["spain", "argentina"].includes(scenario.controlCountry)
  ) {
    throw new Error("css.soccer performance report must bind one canonical fixture control country.");
  }
  const expectedBindings = assertBindings(scenario.bindings, "performance scenario bindings");
  const measurement = assertMeasurement(scenario.measurement, "performance scenario measurement");
  if (!Array.isArray(runs) || runs.length !== CSSOCCER_PERFORMANCE_REQUIREMENTS.runCount) {
    throw new Error("css.soccer performance report requires exactly three retained browser runs.");
  }
  const runIds = new Set();
  const windowIds = new Set();
  for (const run of runs) {
    assertCssoccerPerformanceRun(run, expectedBindings);
    if (runIds.has(run.id) || windowIds.has(run.window.id)) {
      throw new Error("css.soccer performance report contains duplicate runs or windows.");
    }
    runIds.add(run.id);
    windowIds.add(run.window.id);
  }
  requirePlainObject(artifacts, "performance report artifacts");
  requirePlainObject(provenance?.files, "performance report provenance files");
  if (!artifacts.report || Object.keys(provenance.files).length === 0) {
    throw new Error("css.soccer performance report must bind its report and measured source files.");
  }

  const metrics = aggregateMetrics(runs);
  const checks = createBudgetChecks(metrics);
  const status = checks.every(({ status: checkStatus }) => checkStatus === "pass")
    ? "pass"
    : "fail";
  const comparisonKey = sha256Hex(canonicalJson({
    browser: {
      engine: browser.engine,
      executable: browser.executable,
      version: browser.version,
    },
    viewport: browser.viewport,
    measurement,
    scenario: {
      id: scenario.id,
      route: scenario.route,
      controlCountry: scenario.controlCountry,
      bindings: expectedBindings,
      windows: runs.map(({ window }) => ({
        id: window.id,
        startTick: window.startTick,
        frameCount: window.frameCount,
        activity: window.activity,
      })),
    },
  }));
  const historyPoint = createHistoryPoint({
    runId,
    generatedAt,
    status,
    comparisonKey,
    browser,
    scenario,
    metrics,
    runs,
  });
  const history = normalizedHistory(priorHistory, historyPoint);
  const report = {
    schema: CSSOCCER_PERFORMANCE_OVEN_SCHEMA,
    status,
    runId,
    generatedAt,
    trust: {
      classification: "browser-output-performance-evidence",
      preparedRoute: true,
      nativeParityClaim: false,
      visualParityClaim: false,
    },
    browser: clone(browser),
    machine: clone(machine),
    scenario: clone(scenario),
    metrics,
    budgets: { ...CSSOCCER_PERFORMANCE_BUDGETS },
    verdict: {
      status,
      passCount: checks.filter(({ status: checkStatus }) => checkStatus === "pass").length,
      failCount: checks.filter(({ status: checkStatus }) => checkStatus === "fail").length,
      checks,
    },
    artifacts: clone(artifacts),
    provenance: clone(provenance),
    runs: clone(runs),
    history,
  };
  report.diagnostics = createDiagnostics(report, comparisonKey);
  return deepFreeze(assertCssoccerPerformanceOvenReport(report));
}

export function assertCssoccerPerformanceOvenReport(value) {
  requirePlainObject(value, "css.soccer Performance Tracing report");
  if (
    value.schema !== CSSOCCER_PERFORMANCE_OVEN_SCHEMA
    || !["pass", "fail"].includes(value.status)
    || !value.runId
    || !isIsoTimestamp(value.generatedAt)
  ) {
    throw new Error("css.soccer Performance Tracing report identity is invalid.");
  }
  if (
    value.trust?.classification !== "browser-output-performance-evidence"
    || value.trust.preparedRoute !== true
    || value.trust.nativeParityClaim !== false
    || value.trust.visualParityClaim !== false
  ) {
    throw new Error("css.soccer Performance Tracing report weakened its browser-output trust boundary.");
  }
  const bindings = assertBindings(value.scenario?.bindings, "performance scenario bindings");
  assertMeasurement(value.scenario?.measurement, "performance scenario measurement");
  if (!Array.isArray(value.runs) || value.runs.length !== 3) {
    throw new Error("css.soccer Performance Tracing report must retain three runs.");
  }
  for (const run of value.runs) assertCssoccerPerformanceRun(run, bindings);
  const recomputed = aggregateMetrics(value.runs);
  if (canonicalJson(recomputed) !== canonicalJson(value.metrics)) {
    throw new Error("css.soccer Performance Tracing report metrics do not reconcile with its runs.");
  }
  const checks = createBudgetChecks(value.metrics);
  if (canonicalJson(checks) !== canonicalJson(value.verdict?.checks)) {
    throw new Error("css.soccer Performance Tracing report budget verdict is contradictory.");
  }
  const expectedStatus = checks.every(({ status }) => status === "pass") ? "pass" : "fail";
  if (
    value.status !== expectedStatus
    || value.verdict.status !== expectedStatus
    || value.verdict.passCount !== checks.filter(({ status }) => status === "pass").length
    || value.verdict.failCount !== checks.filter(({ status }) => status === "fail").length
  ) {
    throw new Error("css.soccer Performance Tracing status and budget counts do not reconcile.");
  }
  if (!value.artifacts?.report || !isPlainObject(value.provenance?.files)) {
    throw new Error("css.soccer Performance Tracing artifacts or provenance are missing.");
  }
  return value;
}

export function summarizeCssoccerChromeTrace(
  traceEvents,
  { startMarker, endMarker, bucketDurationMs = 50 } = {},
) {
  if (!Array.isArray(traceEvents) || traceEvents.length === 0) {
    throw new Error("Chrome trace must contain events.");
  }
  if (!startMarker || !endMarker) throw new Error("Chrome trace requires unique measurement markers.");
  finitePositive(bucketDurationMs, "trace bucketDurationMs");
  const start = findTraceMarker(traceEvents, startMarker);
  const end = findTraceMarker(traceEvents, endMarker);
  if (!start || !end || end.ts <= start.ts) {
    throw new Error("Chrome trace is missing ordered production-window markers.");
  }
  const mainThread = findRendererMainThread(traceEvents, start.pid);
  if (!mainThread) throw new Error("Chrome trace is missing the renderer main-thread identity.");
  const startUs = start.ts;
  const endUs = end.ts;
  const durationMs = (endUs - startUs) / 1_000;
  const boundedRendererEvents = traceEvents.filter((event) => (
    event?.pid === mainThread.pid
    && Number.isFinite(event.ts)
    && event.ts >= startUs
    && event.ts <= endUs
  ));
  const events = traceEvents
    .filter((event) => (
      event?.ph === "X"
      && event.pid === mainThread.pid
      && event.tid === mainThread.tid
      && Number.isFinite(event.ts)
      && Number.isFinite(event.dur)
      && event.dur >= 0
      && event.ts < endUs
      && event.ts + event.dur > startUs
    ))
    .map((event, index) => ({
      index,
      event,
      startUs: Math.max(startUs, event.ts),
      endUs: Math.min(endUs, event.ts + event.dur),
      group: classifyTraceEvent(event),
    }))
    .filter(({ endUs: clippedEnd, startUs: clippedStart }) => clippedEnd > clippedStart);
  const bucketCount = Math.max(1, Math.ceil(durationMs / bucketDurationMs));
  const groupStats = Object.fromEntries(Object.entries(TRACE_GROUP_DEFINITIONS).map(([id, definition]) => [id, {
    label: definition.label,
    durationMs: 0,
    inclusiveDurationMs: 0,
    count: 0,
    maxMs: 0,
    timeline: {
      mode: "exclusive-classified-thread-time",
      bucketDurationMs,
      values: Array.from({ length: bucketCount }, () => 0),
    },
  }]));
  for (const entry of events) {
    const duration = (entry.endUs - entry.startUs) / 1_000;
    const stats = groupStats[entry.group];
    stats.count += 1;
    stats.inclusiveDurationMs += duration;
    stats.maxMs = Math.max(stats.maxMs, duration);
  }
  const byThread = new Map();
  for (const entry of events) {
    const key = `${entry.event.pid}:${entry.event.tid}`;
    const list = byThread.get(key) ?? [];
    list.push(entry);
    byThread.set(key, list);
  }
  for (const entries of byThread.values()) {
    const boundaries = [...new Set(entries.flatMap(({ startUs: a, endUs: b }) => [a, b]))]
      .sort((left, right) => left - right);
    const starts = [...entries].sort((left, right) => (
      left.startUs - right.startUs
      || left.endUs - right.endUs
      || left.index - right.index
    ));
    const active = new Set();
    let startCursor = 0;
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const segmentStart = boundaries[index];
      const segmentEnd = boundaries[index + 1];
      if (segmentEnd <= segmentStart) continue;
      while (startCursor < starts.length && starts[startCursor].startUs <= segmentStart) {
        active.add(starts[startCursor]);
        startCursor += 1;
      }
      for (const entry of active) {
        if (entry.endUs <= segmentStart) active.delete(entry);
      }
      let selected = null;
      for (const entry of active) {
        if (entry.endUs < segmentEnd) continue;
        if (selected === null
            || entry.startUs > selected.startUs
            || (entry.startUs === selected.startUs && entry.endUs < selected.endUs)
            || (entry.startUs === selected.startUs
              && entry.endUs === selected.endUs
              && entry.index > selected.index)) {
          selected = entry;
        }
      }
      if (!selected) continue;
      const stats = groupStats[selected.group];
      const segmentMs = (segmentEnd - segmentStart) / 1_000;
      stats.durationMs += segmentMs;
      distributeTimeline(
        stats.timeline.values,
        (segmentStart - startUs) / 1_000,
        (segmentEnd - startUs) / 1_000,
        bucketDurationMs,
      );
    }
  }
  const taskEvents = events.filter(({ event }) => isRendererTask(event));
  const longTasks = taskEvents
    .map(({ event, startUs: taskStart, endUs: taskEnd }) => ({
      name: event.name,
      startMs: (taskStart - startUs) / 1_000,
      durationMs: (taskEnd - taskStart) / 1_000,
    }))
    .filter(({ durationMs: taskDuration }) => taskDuration >= 50)
    .sort((left, right) => right.durationMs - left.durationMs || left.startMs - right.startMs);
  const topEvents = events
    .map(({ event, startUs: eventStart, endUs: eventEnd, group }) => ({
      name: event.name ?? "unnamed",
      group,
      startMs: (eventStart - startUs) / 1_000,
      durationMs: (eventEnd - eventStart) / 1_000,
    }))
    .sort((left, right) => right.durationMs - left.durationMs || left.startMs - right.startMs)
    .slice(0, 30);
  const hotWindows = Array.from({ length: bucketCount }, (_, bucket) => {
    const contributors = Object.entries(groupStats)
      .map(([id, stats]) => ({ id, label: stats.label, durationMs: stats.timeline.values[bucket] }))
      .filter(({ durationMs: value }) => value > 0)
      .sort((left, right) => right.durationMs - left.durationMs);
    return {
      bucket,
      startMs: bucket * bucketDurationMs,
      endMs: Math.min(durationMs, (bucket + 1) * bucketDurationMs),
      classifiedThreadTimeMs: contributors.reduce((sum, { durationMs: value }) => sum + value, 0),
      contributors,
    };
  });
  const beginFrameCount = countUniqueFrameEvents(boundedRendererEvents, "BeginFrame");
  const droppedFrameCount = countUniqueFrameEvents(boundedRendererEvents, "DroppedFrame");
  const minorGc = summarizeDurationEvents(boundedRendererEvents, "MinorGC");
  const majorGc = summarizeDurationEvents(boundedRendererEvents, "MajorGC");
  return deepFreeze({
    schema: "cssoccer-browser-performance-trace-summary@2",
    attributionMode: "exclusive-classified-thread-time@1",
    measurementWindow: {
      status: "bounded",
      startMarker,
      endMarker,
      startTimestampUs: startUs,
      endTimestampUs: endUs,
      durationMs,
    },
    mainThread,
    groups: roundTraceGroups(groupStats),
    longTasks: {
      boundaryMs: 50,
      atOrAboveBoundaryCount: longTasks.length,
      maxMs: longTasks[0]?.durationMs ?? 0,
      entries: longTasks.slice(0, 30),
    },
    health: {
      frameDelivery: {
        beginFrameCount,
        droppedFrameCount,
        droppedFrameRatio: beginFrameCount === 0 ? 0 : droppedFrameCount / beginFrameCount,
      },
      garbageCollection: {
        minor: minorGc,
        major: majorGc,
      },
      counters: {
        jsHeapSizeUsed: summarizeTraceCounter(boundedRendererEvents, "jsHeapSizeUsed"),
        documents: summarizeTraceCounter(boundedRendererEvents, "documents"),
        nodes: summarizeTraceCounter(boundedRendererEvents, "nodes"),
        jsEventListeners: summarizeTraceCounter(boundedRendererEvents, "jsEventListeners"),
      },
    },
    hotWindows,
    topEvents,
  });
}

export function createCssoccerBrowserResidency({ before, after } = {}) {
  const acceptedBefore = normalizeResidencySnapshot(before, "before");
  const acceptedAfter = normalizeResidencySnapshot(after, "after");
  return deepFreeze({
    schema: CSSOCCER_BROWSER_RESIDENCY_SCHEMA,
    collection: "forced-gc-before-and-after@1",
    before: acceptedBefore,
    after: acceptedAfter,
    delta: Object.fromEntries(Object.keys(acceptedBefore).map((key) => (
      [key, acceptedAfter[key] - acceptedBefore[key]]
    ))),
  });
}

export function createCssoccerPerformanceBlocker({
  detectedAt = new Date().toISOString(),
  target,
  browser,
  inspected,
  missingMethods,
  reason = "missing-production-performance-seam",
} = {}) {
  if (!isIsoTimestamp(detectedAt) || !target || !Array.isArray(missingMethods) || missingMethods.length === 0) {
    throw new Error("css.soccer performance blocker requires time, target, and missing methods.");
  }
  return deepFreeze({
    schema: CSSOCCER_PERFORMANCE_BLOCKER_SCHEMA,
    status: "blocked",
    detectedAt,
    reason,
    message: "The canonical route has no bounded production frame/step trace seam; static mounted-DOM timing is not valid B23 evidence.",
    target,
    browser: clone(browser ?? null),
    observed: {
      ready: inspected?.ready === true,
      status: inspected?.status ?? null,
      fixtureId: inspected?.fixtureId ?? null,
      rootCount: inspected?.mount?.rootCount ?? null,
      playerRootCount: inspected?.mount?.playerRootCount ?? null,
      runtimeConstruction: clone(inspected?.mount?.runtimeConstruction ?? null),
      nativeRequestCount: inspected?.requests?.nativeRequestCount ?? null,
      pageErrorCount: inspected?.pageErrorCount ?? null,
      missingMethods: [...missingMethods],
    },
    required: {
      debugSchema: CSSOCCER_PERFORMANCE_DEBUG_SCHEMA,
      contractMethod: "window.__cssoccerDebug.performanceTraceContract()",
      runMethod: "window.__cssoccerDebug.runPerformanceTraceWindow(windowId)",
      runCount: 3,
      frameCount: 240,
      rootCount: 37,
      playerRootCount: 22,
      p95FrameMs: CSSOCCER_PERFORMANCE_REQUIREMENTS.p95FrameMs,
      longTaskBoundaryMs: 50,
    },
    publication: {
      rawTracePublished: false,
      currentReportPublished: false,
      ovenBound: false,
    },
  });
}

export async function atomicWriteJson(path, value, { validate } = {}) {
  if (typeof path !== "string" || path.length === 0) throw new TypeError("Atomic JSON path is required.");
  if (typeof validate === "function") validate(value);
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, path);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporary, { force: true });
    throw error;
  }
  return Object.freeze({ path, bytes: Buffer.byteLength(bytes), sha256: sha256Hex(bytes) });
}

export function canonicalJson(value) {
  return JSON.stringify(sortJson(value));
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function aggregateMetrics(runs) {
  const frameValues = runs.flatMap(({ frameTiming }) => frameTiming.series.map(({ frameMs }) => frameMs));
  const stepValues = runs.flatMap(({ stepTiming }) => stepTiming.series.map(({ stepCallMs }) => stepCallMs));
  const simulationSteps = runs.flatMap(({ stepTiming }) => (
    stepTiming.series.map(({ simulationSteps: count }) => count)
  ));
  const construction = runs.reduce((sum, run) => (
    sum + Object.values(run.integrity.runtimeConstruction).reduce((total, value) => total + value, 0)
  ), 0);
  const rootCoverageViolationCount = runs.filter(({ integrity }) => (
    integrity.rootCount !== 37
    || integrity.skyBackdropRootCount !== 1
    || integrity.playerRootCount !== 22
    || integrity.officialRootCount !== 3
    || integrity.exactOfficialRootCount !== 3
    || integrity.stableIdentityCount !== 37
    || integrity.connectedRootCount !== 37
  )).length;
  const referenceBindings = canonicalJson(runs[0].bindings);
  const windowBindingMismatchCount = runs.filter((run) => canonicalJson(run.bindings) !== referenceBindings).length;
  return deepFreeze({
    runCount: runs.length,
    startupReadyMs: Math.max(...runs.map(({ startupReadyMs }) => startupReadyMs)),
    p95FrameMs: Math.max(...runs.map(({ frameTiming }) => frameTiming.p95FrameMs)),
    p99FrameMs: Math.max(...runs.map(({ frameTiming }) => frameTiming.p99FrameMs)),
    maxFrameMs: Math.max(...frameValues),
    over33msRatio: Math.max(...runs.map(({ frameTiming }) => frameTiming.over33msRatio)),
    p95StepCallMs: Math.max(...runs.map(({ stepTiming }) => stepTiming.p95StepCallMs)),
    maxStepCallMs: Math.max(...stepValues),
    maxSimulationStepsPerFrame: Math.max(...simulationSteps),
    simulationUpdateFrameRatio:
      simulationSteps.filter((count) => count > 0).length / simulationSteps.length,
    residencyTransitionStepCount: 0,
    pageErrorCount: runs.reduce((sum, run) => sum + run.integrity.pageErrorCount, 0),
    nativeRequestCount: runs.reduce((sum, run) => sum + run.integrity.nativeRequestCount, 0),
    runtimeConstructionCount: construction,
    longTaskAtOrAbove50Count: runs.reduce((sum, run) => (
      sum + run.trace.longTasks.atOrAboveBoundaryCount
    ), 0),
    traceBeginFrameCount: runs.reduce((sum, run) => (
      sum + run.trace.health.frameDelivery.beginFrameCount
    ), 0),
    traceDroppedFrameCount: runs.reduce((sum, run) => (
      sum + run.trace.health.frameDelivery.droppedFrameCount
    ), 0),
    droppedFrameRatio: Math.max(...runs.map((run) => (
      run.trace.health.frameDelivery.droppedFrameRatio
    ))),
    minorGcCount: runs.reduce((sum, run) => (
      sum + run.trace.health.garbageCollection.minor.count
    ), 0),
    majorGcCount: runs.reduce((sum, run) => (
      sum + run.trace.health.garbageCollection.major.count
    ), 0),
    retainedJsHeapGrowthBytes: Math.max(0, ...runs.map((run) => (
      run.residency.delta.jsHeapUsedBytes
    ))),
    domNodeGrowthCount: Math.max(0, ...runs.map((run) => (
      run.residency.delta.domNodeCount
    ))),
    documentGrowthCount: Math.max(0, ...runs.map((run) => (
      run.residency.delta.documentCount
    ))),
    eventListenerGrowthCount: Math.max(0, ...runs.map((run) => (
      run.residency.delta.jsEventListenerCount
    ))),
    packedFrameStyleChunkOverflowCount: runs.reduce((sum, run) => (
      sum + run.integrity.packedFrameStyleChunkOverflowCount
    ), 0),
    rootCoverageViolationCount,
    windowBindingMismatchCount,
  });
}

function createBudgetChecks(metrics) {
  return Object.entries(CSSOCCER_PERFORMANCE_BUDGETS).map(([id, limit]) => {
    const actual = metrics[id];
    finiteNonNegative(actual, `performance metric ${id}`);
    return Object.freeze({
      id,
      actual,
      limit,
      operator: "<=",
      status: actual <= limit ? "pass" : "fail",
    });
  });
}

function createHistoryPoint({ runId, generatedAt, status, comparisonKey, browser, scenario, metrics, runs }) {
  const traceGroups = aggregateTraceGroups(runs);
  return deepFreeze({
    schema: CSSOCCER_PERFORMANCE_HISTORY_SCHEMA,
    runId,
    generatedAt,
    status,
    comparisonKey,
    context: {
      browserTarget: `${browser.engine} ${browser.version}`,
      viewport: clone(browser.viewport),
      scenarioId: scenario.id,
      controlCountry: scenario.controlCountry,
      measurement: clone(scenario.measurement),
      bindings: clone(scenario.bindings),
      windows: runs.map(({ window }) => clone(window)),
    },
    metrics: {
      startupReadyMs: metrics.startupReadyMs,
      p95FrameMs: metrics.p95FrameMs,
      p99FrameMs: metrics.p99FrameMs,
      maxFrameMs: metrics.maxFrameMs,
      over33msRatio: metrics.over33msRatio,
      p95StepCallMs: metrics.p95StepCallMs,
      maxStepCallMs: metrics.maxStepCallMs,
      maxSimulationStepsPerFrame: metrics.maxSimulationStepsPerFrame,
      simulationUpdateFrameRatio: metrics.simulationUpdateFrameRatio,
      residencyTransitionStepCount: metrics.residencyTransitionStepCount,
      droppedFrameRatio: metrics.droppedFrameRatio,
      retainedJsHeapGrowthBytes: metrics.retainedJsHeapGrowthBytes,
      domNodeGrowthCount: metrics.domNodeGrowthCount,
      packedFrameStyleChunkOverflowCount: metrics.packedFrameStyleChunkOverflowCount,
    },
    budgets: { ...CSSOCCER_PERFORMANCE_BUDGETS },
    traceGroups,
  });
}

function normalizedHistory(priorHistory, current) {
  const accepted = Array.isArray(priorHistory)
    ? priorHistory.filter((point) => (
      point?.schema === CSSOCCER_PERFORMANCE_HISTORY_SCHEMA
      && point.comparisonKey === current.comparisonKey
      && isIsoTimestamp(point.generatedAt)
      && point.runId !== current.runId
    ))
    : [];
  accepted.sort((left, right) => Date.parse(left.generatedAt) - Date.parse(right.generatedAt));
  return deepFreeze([...accepted.slice(-119), current]);
}

function createDiagnostics(report, comparisonKey) {
  const budgetGaps = report.verdict.checks
    .filter(({ status }) => status === "fail")
    .map(({ id, actual, limit }) => ({
      id,
      actual,
      limit,
      excess: actual - limit,
      ratioToLimit: limit === 0 ? null : actual / limit,
      percentOverLimit: limit === 0 ? null : ((actual - limit) / limit) * 100,
    }));
  const previous = [...report.history].reverse().find((point) => point.runId !== report.runId) ?? null;
  const metricChanges = previous
    ? Object.fromEntries(Object.keys(report.metrics).filter((key) => Number.isFinite(previous.metrics?.[key]))
      .map((key) => [key, report.metrics[key] - previous.metrics[key]]))
    : {};
  const perRun = report.runs.map((run) => ({
    runId: run.id,
    frameSpikes: [...run.frameTiming.series]
      .sort((left, right) => right.frameMs - left.frameMs || left.frame - right.frame)
      .slice(0, 20)
      .map((sample) => ({
        ...sample,
        overBudgetMs: Math.max(0, sample.frameMs - CSSOCCER_PERFORMANCE_BUDGETS.p95FrameMs),
      })),
    stepSpikes: run.stepTiming.slowestSteps,
    phaseBottlenecks: phaseEntries(run.stepTiming.phaseTiming),
    cameraPhaseBottlenecks: phaseEntries(run.stepTiming.cameraPhaseTiming),
    traceGroups: Object.entries(run.trace.groups).map(([id, value]) => ({ id, ...value })),
    frameDelivery: run.trace.health.frameDelivery,
    garbageCollection: run.trace.health.garbageCollection,
    residency: run.residency,
    hotWindows: run.trace.hotWindows,
    topEvents: run.trace.topEvents,
    structure: { integrity: run.integrity },
  }));
  const phaseBottlenecks = perRun.flatMap((run) => run.phaseBottlenecks.map((phase) => ({
    ...phase,
    runId: run.runId,
  })));
  const cameraPhaseBottlenecks = perRun.flatMap((run) => run.cameraPhaseBottlenecks.map((phase) => ({
    ...phase,
    runId: run.runId,
  })));
  const actionItems = budgetGaps.map((gap, index) => actionForGap(gap, index + 1, perRun));
  return deepFreeze({
    schema: CSSOCCER_PERFORMANCE_DIAGNOSTICS_SCHEMA,
    runId: report.runId,
    generatedAt: report.generatedAt,
    primaryTarget: actionItems[0] ?? null,
    budgetGaps,
    comparison: {
      comparable: previous !== null,
      previousRunId: previous?.runId ?? null,
      previousGeneratedAt: previous?.generatedAt ?? null,
      metricChanges,
    },
    runs: perRun,
    phaseBottlenecks,
    cameraPhaseBottlenecks,
    traceGroups: Object.entries(aggregateTraceGroups(report.runs)).map(([id, value]) => ({ id, ...value })),
    residencySpikes: perRun.map((run) => ({
      runId: run.runId,
      ...run.residency.delta,
    })),
    actionItems,
    rerun: {
      command: "pnpm perf:trace -- --check",
      comparisonKey,
      compareAgainstRunId: report.runId,
      protocol: [
        "Keep the same browser, viewport, scenario bindings, and three source-labeled windows.",
        "Change at most one measured producer before rerunning.",
        "Reject any run with root, request, error, construction, or trace-window drift.",
      ],
      requiredIntegrity: {
        pageErrorCount: 0,
        nativeRequestCount: 0,
        runtimeConstructionCount: 0,
      },
      successCriteria: report.verdict.checks.map(({ id, operator, limit }) => ({ id, operator, limit })),
    },
    caveats: [
      "This is headless real-Chrome timing of the canonical product fixed-step rAF callback, not a native parity claim.",
      "Chrome tracing and per-frame timers add observer overhead; comparable reruns keep the same observer boundary.",
      "Prepared route, 37-root structure, 22-player plus three exact-official coverage, one source marker, camera plus exact-player 50 ms interpolation, bounded animation sidecars, and current free-play bindings are integrity gates.",
    ],
  });
}

function actionForGap(gap, priority, runs) {
  const phase = [...runs.flatMap(({ phaseBottlenecks }) => phaseBottlenecks)]
    .sort((left, right) => right.maxMs - left.maxMs)[0];
  const integrityProducer = gap.id.includes("Construction")
    ? "src/cssoccer/polycssScene.mjs"
    : gap.id.includes("nativeRequest") || gap.id.includes("pageError")
      ? "src/cssoccer/client.mjs"
      : null;
  const producer = integrityProducer ?? phase?.producer ?? "src/cssoccer/client.mjs";
  return {
    id: `budget-${gap.id}`,
    priority,
    target: gap.id,
    producer,
    signal: `${gap.id} ${gap.actual} exceeds ${gap.limit}`,
    evidence: { actual: gap.actual, limit: gap.limit, excess: gap.excess },
    nextAction: `Inspect the retained trace and bounded phase samples for ${producer}; keep scenario and observer bindings fixed.`,
    verifyMetrics: [gap.id],
  };
}

function aggregateTraceGroups(runs) {
  const result = {};
  for (const id of Object.keys(TRACE_GROUP_DEFINITIONS)) {
    const groups = runs.map((run) => run.trace.groups[id]).filter(Boolean);
    result[id] = {
      label: TRACE_GROUP_DEFINITIONS[id].label,
      durationMs: groups.reduce((sum, group) => sum + group.durationMs, 0),
      count: groups.reduce((sum, group) => sum + group.count, 0),
      maxMs: Math.max(0, ...groups.map((group) => group.maxMs)),
    };
  }
  return result;
}

function summarizePhases(samples, definitions, sampleKey, schema) {
  const accepted = assertPhaseDefinitions(definitions, `${sampleKey} definitions`);
  const phases = {};
  for (const definition of accepted) {
    const values = samples.map((sample) => sample[sampleKey][definition.id]);
    phases[definition.id] = {
      label: definition.label,
      producer: definition.producer,
      nextProbe: definition.nextProbe,
      sampleCount: values.length,
      totalMs: sum(values),
      averageMs: sum(values) / values.length,
      p50Ms: percentile(values, 0.5),
      p95Ms: percentile(values, 0.95),
      maxMs: Math.max(...values),
      attributedShare: values.length / samples.length,
    };
  }
  return deepFreeze({ schema, sampleCount: samples.length, phases });
}

function assertPhaseDefinitions(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must contain at least one bounded producer.`);
  }
  const ids = new Set();
  for (const definition of value) {
    if (
      !definition?.id
      || ids.has(definition.id)
      || !definition.label
      || !definition.producer
      || !definition.nextProbe
    ) {
      throw new Error(`${label} contains an incomplete or duplicate producer.`);
    }
    ids.add(definition.id);
  }
  return value;
}

function assertSamples(value, window) {
  if (!Array.isArray(value) || value.length !== window.frameCount) {
    throw new Error(`css.soccer performance window ${window.id} must contain exactly ${window.frameCount} samples.`);
  }
  let priorElapsed = -Infinity;
  let priorTick = window.startTick;
  return value.map((sample, index) => {
    requirePlainObject(sample, `performance sample ${index}`);
    if (
      sample.frame !== index
      || !Number.isSafeInteger(sample.tick)
      || sample.tick < priorTick
      || !Number.isSafeInteger(sample.simulationSteps)
      || sample.simulationSteps < 0
      || sample.simulationSteps > PERFORMANCE_MEASUREMENT.maxSimulationStepsPerFrame
      || sample.tick - priorTick !== sample.simulationSteps
      || !Number.isFinite(sample.elapsedMs)
      || sample.elapsedMs < 0
      || sample.elapsedMs < priorElapsed
    ) {
      throw new Error(`css.soccer performance samples must follow the product scheduler at frame ${index}.`);
    }
    priorElapsed = sample.elapsedMs;
    priorTick = sample.tick;
    finiteNonNegative(sample.frameMs, `performance sample ${index} frameMs`);
    finiteNonNegative(sample.stepCallMs, `performance sample ${index} stepCallMs`);
    finiteNonNegative(sample.productSimulationMs, `performance sample ${index} productSimulationMs`);
    requirePlainObject(sample.phases, `performance sample ${index} phases`);
    requirePlainObject(sample.cameraPhases, `performance sample ${index} camera phases`);
    for (const [id, duration] of Object.entries({ ...sample.phases, ...sample.cameraPhases })) {
      finiteNonNegative(duration, `performance sample ${index} phase ${id}`);
    }
    return clone(sample);
  });
}

function assertWindow(value) {
  requirePlainObject(value, "performance window");
  if (
    typeof value.id !== "string"
    || value.id.length === 0
    || !Number.isSafeInteger(value.startTick)
    || value.startTick < 0
    || value.frameCount !== 240
    || !Number.isSafeInteger(value.endTick)
    || value.endTick < value.startTick
    || value.endTick > value.startTick
      + value.frameCount * PERFORMANCE_MEASUREMENT.maxSimulationStepsPerFrame
    || typeof value.activity !== "string"
    || value.activity.length === 0
  ) {
    throw new Error("css.soccer performance window must bind 240 source-labeled product frames.");
  }
  return deepFreeze(clone(value));
}

function assertFrameTiming(value, window) {
  requirePlainObject(value, "performance frame timing");
  const series = value.series;
  if (!Array.isArray(series) || series.length !== window.frameCount) {
    throw new Error("css.soccer performance frame series is incomplete.");
  }
  let priorTick = window.startTick;
  const values = series.map((sample, index) => {
    if (
      sample?.frame !== index
      || !Number.isSafeInteger(sample.tick)
      || sample.tick < priorTick
    ) {
      throw new Error("css.soccer performance frame series does not follow product time.");
    }
    priorTick = sample.tick;
    finiteNonNegative(sample.elapsedMs, "performance frame elapsedMs");
    finiteNonNegative(sample.frameMs, "performance frameMs");
    return sample.frameMs;
  });
  if (priorTick !== window.endTick) {
    throw new Error("css.soccer performance frame series end tick changed.");
  }
  const expected = {
    p95FrameMs: percentile(values, 0.95),
    p99FrameMs: percentile(values, 0.99),
    maxFrameMs: Math.max(...values),
    over33msRatio: values.filter((entry) => entry > 33).length / values.length,
  };
  for (const [key, metric] of Object.entries(expected)) {
    if (value[key] !== metric) throw new Error(`css.soccer performance ${key} does not reconcile.`);
  }
}

function assertStepTiming(value, window) {
  requirePlainObject(value, "performance step timing");
  if (!Array.isArray(value.series) || value.series.length !== window.frameCount) {
    throw new Error("css.soccer performance step series is incomplete.");
  }
  let priorTick = window.startTick;
  const values = value.series.map((sample, index) => {
    if (
      sample?.frame !== index
      || !Number.isSafeInteger(sample.tick)
      || !Number.isSafeInteger(sample.simulationSteps)
      || sample.simulationSteps < 0
      || sample.simulationSteps > PERFORMANCE_MEASUREMENT.maxSimulationStepsPerFrame
      || sample.tick - priorTick !== sample.simulationSteps
    ) {
      throw new Error("css.soccer performance step series does not follow the product scheduler.");
    }
    priorTick = sample.tick;
    finiteNonNegative(sample.stepCallMs, "performance stepCallMs");
    return sample.stepCallMs;
  });
  if (priorTick !== window.endTick) {
    throw new Error("css.soccer performance step series end tick changed.");
  }
  if (
    value.p95StepCallMs !== percentile(values, 0.95)
    || value.maxStepCallMs !== Math.max(...values)
    || !Array.isArray(value.slowestSteps)
  ) {
    throw new Error("css.soccer performance step metrics do not reconcile.");
  }
  assertPhaseSummary(value.phaseTiming, "cssoccer-runtime-dispatch-phase-summary@1");
  assertPhaseSummary(value.cameraPhaseTiming, "cssoccer-camera-publication-phase-summary@1");
}

function assertPhaseSummary(value, schema) {
  if (
    value?.schema !== schema
    || value.sampleCount !== 240
    || !isPlainObject(value.phases)
    || Object.keys(value.phases).length === 0
  ) {
    throw new Error(`css.soccer performance phase summary must use ${schema}.`);
  }
  for (const [id, phase] of Object.entries(value.phases)) {
    if (
      !id
      || !phase?.label
      || !phase.producer
      || !phase.nextProbe
      || phase.sampleCount !== 240
    ) {
      throw new Error("css.soccer performance phase summary lacks producer evidence.");
    }
    for (const key of ["totalMs", "averageMs", "p50Ms", "p95Ms", "maxMs", "attributedShare"]) {
      finiteNonNegative(phase[key], `performance phase ${id}.${key}`);
    }
  }
}

function assertTraceSummary(value) {
  if (
    value?.schema !== "cssoccer-browser-performance-trace-summary@2"
    || value.attributionMode !== "exclusive-classified-thread-time@1"
    || value.measurementWindow?.status !== "bounded"
    || !isPlainObject(value.groups)
    || value.longTasks?.boundaryMs !== 50
    || !Number.isSafeInteger(value.longTasks.atOrAboveBoundaryCount)
    || value.longTasks.atOrAboveBoundaryCount < 0
    || !isPlainObject(value.health?.frameDelivery)
    || !isPlainObject(value.health?.garbageCollection)
    || !isPlainObject(value.health?.counters)
    || !Array.isArray(value.hotWindows)
    || !Array.isArray(value.topEvents)
  ) {
    throw new Error("css.soccer Chrome trace summary is incomplete or unbounded.");
  }
  const frameDelivery = value.health.frameDelivery;
  for (const key of ["beginFrameCount", "droppedFrameCount"]) {
    if (!Number.isSafeInteger(frameDelivery[key]) || frameDelivery[key] < 0) {
      throw new Error(`css.soccer Chrome trace frame delivery ${key} is invalid.`);
    }
  }
  finiteNonNegative(frameDelivery.droppedFrameRatio, "trace droppedFrameRatio");
  if (frameDelivery.droppedFrameRatio > 1) {
    throw new Error("css.soccer Chrome trace dropped-frame ratio exceeds one.");
  }
  for (const key of ["minor", "major"]) {
    const summary = value.health.garbageCollection[key];
    if (!Number.isSafeInteger(summary?.count) || summary.count < 0) {
      throw new Error(`css.soccer Chrome trace ${key} GC count is invalid.`);
    }
    finiteNonNegative(summary.durationMs, `trace ${key} GC durationMs`);
    finiteNonNegative(summary.maxMs, `trace ${key} GC maxMs`);
  }
  for (const key of ["jsHeapSizeUsed", "documents", "nodes", "jsEventListeners"]) {
    assertTraceCounterSummary(value.health.counters[key], key);
  }
  for (const [id, group] of Object.entries(value.groups)) {
    if (
      !id
      || !group?.label
      || !Number.isFinite(group.durationMs)
      || group.durationMs < 0
      || !Number.isFinite(group.inclusiveDurationMs)
      || group.inclusiveDurationMs < 0
      || !Number.isFinite(group.count)
      || group.count < 0
      || !Number.isFinite(group.maxMs)
      || group.maxMs < 0
      || group.timeline?.mode !== "exclusive-classified-thread-time"
      || !Number.isFinite(group.timeline.bucketDurationMs)
      || !Array.isArray(group.timeline.values)
    ) {
      throw new Error(`css.soccer Chrome trace group ${id} is invalid.`);
    }
  }
  return deepFreeze(clone(value));
}

function assertBrowserResidency(value) {
  if (
    value?.schema !== CSSOCCER_BROWSER_RESIDENCY_SCHEMA
    || value.collection !== "forced-gc-before-and-after@1"
  ) {
    throw new Error("css.soccer browser residency must force GC before and after its window.");
  }
  const before = normalizeResidencySnapshot(value.before, "before");
  const after = normalizeResidencySnapshot(value.after, "after");
  const expectedDelta = Object.fromEntries(Object.keys(before).map((key) => (
    [key, after[key] - before[key]]
  )));
  if (canonicalJson(value.delta) !== canonicalJson(expectedDelta)) {
    throw new Error("css.soccer browser residency deltas do not reconcile.");
  }
  return deepFreeze(clone(value));
}

function normalizeResidencySnapshot(value, label) {
  requirePlainObject(value, `performance residency ${label}`);
  const accepted = {};
  for (const key of [
    "jsHeapUsedBytes",
    "jsHeapTotalBytes",
    "documentCount",
    "domNodeCount",
    "jsEventListenerCount",
  ]) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) {
      throw new Error(`css.soccer performance residency ${label}.${key} is invalid.`);
    }
    accepted[key] = value[key];
  }
  return deepFreeze(accepted);
}

function assertTraceCounterSummary(value, label) {
  if (value?.available === false) return value;
  if (
    value?.available !== true
    || !Number.isSafeInteger(value.sampleCount)
    || value.sampleCount <= 0
  ) {
    throw new Error(`css.soccer Chrome trace counter ${label} is invalid.`);
  }
  for (const key of ["first", "last", "delta", "min", "max"]) {
    if (!Number.isFinite(value[key])) {
      throw new Error(`css.soccer Chrome trace counter ${label}.${key} is invalid.`);
    }
  }
  return value;
}

function assertIntegrity(value) {
  requirePlainObject(value, "performance run integrity");
  const integerKeys = [
    "rootCount",
    "playerRootCount",
    "stableIdentityCount",
    "connectedRootCount",
    "pageErrorCount",
    "nativeRequestCount",
    "packedFrameStyleFrameSetCount",
    "packedFrameStyleLoadedChunkCount",
    "packedFrameStyleChunkLimitPerFrameSet",
    "packedFrameStyleChunkOverflowCount",
  ];
  for (const key of integerKeys) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) {
      throw new Error(`css.soccer performance integrity ${key} must be a non-negative integer.`);
    }
  }
  if (
    value.presentationInterpolationMs !== PERFORMANCE_MEASUREMENT.presentationInterpolationMs
    || value.presentationCameraInterpolated !== false
    || value.presentationInterpolatedRootCount !== 0
    || value.packedFrameStyleChunkLimitPerFrameSet <= 0
    || value.packedFrameStyleLoadedChunkCount
      > value.packedFrameStyleFrameSetCount * value.packedFrameStyleChunkLimitPerFrameSet
    || value.packedFrameStyleChunkOverflowCount !== 0
  ) {
    throw new Error("css.soccer performance integrity requires direct 20 Hz publication and bounded frame styles.");
  }
  requirePlainObject(value.runtimeConstruction, "performance runtime construction");
  for (const key of CONSTRUCTION_KEYS) {
    if (!Number.isSafeInteger(value.runtimeConstruction[key]) || value.runtimeConstruction[key] < 0) {
      throw new Error(`css.soccer performance runtime construction ${key} is invalid.`);
    }
  }
  return deepFreeze(clone(value));
}

function assertBindings(value, label) {
  requirePlainObject(value, label);
  const keys = Object.keys(value).sort();
  if (canonicalJson(keys) !== canonicalJson([...BINDING_KEYS].sort())) {
    throw new Error(`${label} must use the exact deterministic binding set.`);
  }
  if (!/^[a-f0-9]{40}$/u.test(value.sourceRevision ?? "")) {
    throw new Error(`${label}.sourceRevision must be the pinned source revision.`);
  }
  for (const key of BINDING_KEYS.filter((key) => key !== "sourceRevision")) {
    if (!SHA256.test(value[key] ?? "")) throw new Error(`${label}.${key} must be SHA-256.`);
  }
  return deepFreeze(clone(value));
}

function assertMeasurement(value, label) {
  requirePlainObject(value, label);
  if (canonicalJson(value) !== canonicalJson(PERFORMANCE_MEASUREMENT)) {
    throw new Error(`${label} must measure the canonical fixed-step product rAF with transform interpolation.`);
  }
  return deepFreeze(clone(value));
}

function phaseEntries(summary) {
  return Object.entries(summary.phases)
    .map(([id, value]) => ({ id, ...value }))
    .sort((left, right) => right.maxMs - left.maxMs || left.id.localeCompare(right.id));
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("Percentile requires samples.");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function classifyTraceEvent(event) {
  const name = String(event?.name ?? "");
  const category = String(event?.cat ?? "");
  if (/Paint|Raster|Composite|DrawFrame|Commit/u.test(name)) return "painting";
  if (/Layout|UpdateLayoutTree|RecalculateStyles|PrePaint|Layerize/u.test(name)) return "rendering";
  if (/FunctionCall|EvaluateScript|RunMicrotasks|FireAnimationFrame|EventDispatch|TimerFire|v8/u.test(name)
      || /(?:^|,)v8|devtools\.timeline/u.test(category)) return "scripting";
  return "other";
}

function findTraceMarker(events, marker) {
  return events.find((event) => {
    if (!Number.isFinite(event?.ts)) return false;
    const message = event.args?.data?.message
      ?? event.args?.data?.name
      ?? event.args?.message
      ?? event.args?.name;
    return message === marker;
  }) ?? null;
}

function findRendererMainThread(events, preferredPid) {
  const candidates = events.filter((event) => (
    event?.ph === "M"
    && event.name === "thread_name"
    && event.args?.name === "CrRendererMain"
    && Number.isSafeInteger(event.pid)
    && Number.isSafeInteger(event.tid)
  ));
  const preferred = candidates.find(({ pid }) => pid === preferredPid);
  const value = preferred ?? candidates[0];
  return value ? { pid: value.pid, tid: value.tid, name: "CrRendererMain" } : null;
}

function countUniqueFrameEvents(events, name) {
  const identities = new Set();
  for (const event of events) {
    if (event.name !== name) continue;
    const frameSeqId = event.args?.frameSeqId ?? event.args?.data?.frameSeqId;
    identities.add(frameSeqId === undefined
      ? `${event.pid}:${event.tid}:${event.ts}`
      : String(frameSeqId));
  }
  return identities.size;
}

function summarizeDurationEvents(events, name) {
  const durations = events
    .filter((event) => event.name === name)
    .map((event) => Number.isFinite(event.dur) ? event.dur / 1_000 : 0);
  return {
    count: durations.length,
    durationMs: roundMetric(sum(durations)),
    maxMs: roundMetric(Math.max(0, ...durations)),
  };
}

function summarizeTraceCounter(events, key) {
  const values = events
    .filter((event) => event.name === "UpdateCounters")
    .map((event) => event.args?.data?.[key] ?? event.args?.[key])
    .filter(Number.isFinite);
  if (values.length === 0) return { available: false };
  return {
    available: true,
    sampleCount: values.length,
    first: values[0],
    last: values.at(-1),
    delta: values.at(-1) - values[0],
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function isRendererTask(event) {
  const name = String(event?.name ?? "");
  return /(?:^|::)RunTask$|^Task$/u.test(name);
}

function distributeTimeline(values, startMs, endMs, bucketDurationMs) {
  const first = Math.max(0, Math.floor(startMs / bucketDurationMs));
  const last = Math.min(values.length - 1, Math.floor(Math.max(startMs, endMs - Number.EPSILON) / bucketDurationMs));
  for (let bucket = first; bucket <= last; bucket += 1) {
    const bucketStart = bucket * bucketDurationMs;
    const bucketEnd = bucketStart + bucketDurationMs;
    values[bucket] += Math.max(0, Math.min(endMs, bucketEnd) - Math.max(startMs, bucketStart));
  }
}

function roundTraceGroups(groups) {
  const rounded = {};
  for (const [id, group] of Object.entries(groups)) {
    rounded[id] = {
      ...group,
      durationMs: roundMetric(group.durationMs),
      inclusiveDurationMs: roundMetric(group.inclusiveDurationMs),
      maxMs: roundMetric(group.maxMs),
      timeline: {
        ...group.timeline,
        values: group.timeline.values.map(roundMetric),
      },
    };
  }
  return rounded;
}

function roundMetric(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function finiteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative.`);
  return value;
}

function finitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be finite and positive.`);
  return value;
}

function isIsoTimestamp(value) {
  return typeof value === "string" && /T/u.test(value) && Number.isFinite(Date.parse(value));
}

function requirePlainObject(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object.`);
  return value;
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
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

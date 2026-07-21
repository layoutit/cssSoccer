#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { cpus, platform, arch, totalmem, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCssoccerPerformanceDebugContract,
  assertCssoccerPerformanceOvenReport,
  atomicWriteJson,
  canonicalJson,
  createCssoccerBrowserResidency,
  createCssoccerPerformanceBlocker,
  createCssoccerPerformanceOvenReport,
  createCssoccerPerformanceRun,
  summarizeCssoccerChromeTrace,
} from "../src/performance/performanceOven.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_PORT = 5207;
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_OUTPUT_ROOT = join(REPO_ROOT, ".local/cssoccer/performance");
const EXACT_PLAYER_PROFILE = "exact-player-22";
const EXACT_PLAYER_FRAME_COUNT = 240;
const EXACT_PLAYER_HEAP_GROWTH_BUDGET_BYTES = 2 * 1024 * 1024;
const CHROME_CANDIDATES = Object.freeze([
  process.env.CSSOCCER_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
].filter(Boolean));
const VIEWPORT = Object.freeze({
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
const TRACE_CATEGORIES = [
  "toplevel",
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "blink.console",
  "blink.user_timing",
  "v8",
  "cc",
].join(",");

class PerformanceTraceBlockedError extends Error {
  constructor(report) {
    super(report.message);
    this.name = "PerformanceTraceBlockedError";
    this.report = report;
  }
}

class CdpClient {
  static async connect(url, timeoutMs) {
    const socket = new WebSocket(url);
    await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Chrome DevTools.")), timeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolvePromise();
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Could not connect to Chrome DevTools."));
      }, { once: true });
    });
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => this.receive(event.data));
    socket.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) reject(new Error("Chrome DevTools closed."));
      this.pending.clear();
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
    return () => listeners.delete(listener);
  }

  waitFor(method, timeoutMs, predicate = () => true) {
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        remove();
        reject(new Error(`Timed out waiting for Chrome DevTools ${method}.`));
      }, timeoutMs);
      const remove = this.on(method, (params, message) => {
        if (!predicate(params, message)) return;
        clearTimeout(timer);
        remove();
        resolvePromise(params);
      });
    });
  }

  receive(raw) {
    const message = JSON.parse(String(raw));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      else pending.resolve(message.result ?? {});
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) {
      listener(message.params ?? {}, message);
    }
  }

  close() {
    this.socket.close();
  }
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
} else {
  await main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}

async function main() {
  let server = null;
  let chrome = null;
  let profile = null;
  let cdp = null;
  try {
    const target = options.url ?? `http://127.0.0.1:${options.port}/`;
    const buildBinding = await collectProductionBuildBinding();
    if (!options.url) server = await startProductionPreview(options.port, options.timeoutMs);
    await waitForHttp(target, options.timeoutMs);

    profile = await mkdtemp(join(tmpdir(), "cssoccer-performance-"));
    const executable = await resolveChromeExecutable();
    const launched = await launchChrome(executable, profile, options.timeoutMs);
    chrome = launched.process;
    cdp = await CdpClient.connect(launched.webSocketUrl, options.timeoutMs);
    const version = await cdp.send("Browser.getVersion");
    const browser = browserMetadata(version, executable);

    const warmup = await openPreparedMatch(cdp, target, options.timeoutMs);
    try {
      const missingMethods = await evaluate(cdp, warmup.sessionId, `(() => {
        const api = window.__cssoccerDebug;
        const missing = [];
        if (typeof api?.performanceTraceContract !== "function") missing.push("performanceTraceContract");
        if (typeof api?.runPerformanceTraceWindow !== "function") missing.push("runPerformanceTraceWindow");
        if (typeof api?.prepareExactPlayer22PerformanceTrace !== "function") missing.push("prepareExactPlayer22PerformanceTrace");
        if (typeof api?.runExactPlayer22PerformanceTraceWindow !== "function") missing.push("runExactPlayer22PerformanceTraceWindow");
        return missing;
      })()`);
      if (missingMethods.length > 0) {
        const blocker = createCssoccerPerformanceBlocker({
          target,
          browser,
          inspected: warmup.inspected,
          missingMethods,
        });
        const blockedPath = join(options.outputRoot, "blocked/performance-trace-blocker.json");
        const published = await atomicWriteJson(blockedPath, blocker);
        throw new PerformanceTraceBlockedError({
          ...blocker,
          artifact: {
            path: relativeRepo(blockedPath),
            bytes: published.bytes,
            sha256: published.sha256,
          },
        });
      }
    } finally {
      await warmup.close();
    }

    const probe = await openPreparedMatch(cdp, target, options.timeoutMs);
    let debugContract;
    try {
      debugContract = assertCssoccerPerformanceDebugContract(await evaluate(
        cdp,
        probe.sessionId,
        "window.__cssoccerDebug.performanceTraceContract()",
        { awaitPromise: true },
      ));
    } finally {
      await probe.close();
    }

    const generatedAt = new Date().toISOString();
    const runId = `cssoccer-${generatedAt.replace(/[:.]/gu, "-")}`;
    const runs = [];
    for (const [index, window] of debugContract.windows.entries()) {
      runs.push(await captureWindow({
        browser,
        cdp,
        debugContract,
        index,
        runId,
        target,
        window,
      }));
    }

    const exactCapture = await captureExactPlayer22Profile({
      browser,
      buildBinding,
      cdp,
      runId,
      target,
    });
    const exactPlayer22 = exactCapture.profile;
    const reportPath = join(options.outputRoot, "canonical-current.json");
    const runReportPath = join(options.outputRoot, "runs", runId, "canonical-report.json");
    const suitePath = join(options.outputRoot, "current.json");
    const runSuitePath = join(options.outputRoot, "runs", runId, "report.json");
    const provenance = { files: await collectProvenance(runs, exactPlayer22, buildBinding) };
    const priorHistory = await readPriorHistory(reportPath);
    const report = createCssoccerPerformanceOvenReport({
      runId,
      generatedAt,
      browser,
      machine: machineMetadata(),
      scenario: {
        id: "spain-argentina-full-match",
        route: "/",
        servedRoute: new URL(target).pathname,
        controlCountry: "argentina",
        measurement: debugContract.measurement,
        bindings: debugContract.bindings,
        windows: debugContract.windows,
        productionBuild: buildBinding,
      },
      runs,
      artifacts: {
        report: relativeRepo(reportPath),
        retainedReport: relativeRepo(runReportPath),
        runs: runs.map(({ artifacts }) => artifacts),
      },
      provenance,
      priorHistory,
    });
    assertCssoccerPerformanceOvenReport(report);

    const priorSuite = await readJsonIfPresent(suitePath);
    const suite = createPerformanceSuite({
      runId,
      generatedAt,
      buildBinding,
      canonical: report,
      exactPlayer22,
      priorSuite,
      artifacts: {
        report: relativeRepo(suitePath),
        retainedReport: relativeRepo(runSuitePath),
      },
    });

    await atomicWriteJson(runReportPath, report, { validate: assertCssoccerPerformanceOvenReport });
    await atomicWriteJson(exactCapture.reportPath, exactPlayer22, {
      validate: assertExactPlayer22Profile,
    });
    await atomicWriteJson(runSuitePath, suite, { validate: assertPerformanceSuite });
    if (suite.status !== "pass") {
      const failedPath = join(options.outputRoot, "failed", runId, "report.json");
      await atomicWriteJson(failedPath, suite, { validate: assertPerformanceSuite });
      console.error(JSON.stringify({
        status: "fail",
        report: relativeRepo(failedPath),
        canonicalVerdict: report.verdict,
        exactPlayer22Verdict: exactPlayer22.verdict,
      }, null, 2));
      process.exitCode = 2;
      return;
    }
    await atomicWriteJson(reportPath, report, { validate: assertCssoccerPerformanceOvenReport });
    await atomicWriteJson(suitePath, suite, { validate: assertPerformanceSuite });
    console.log(JSON.stringify({
      status: "pass",
      report: relativeRepo(suitePath),
      runId,
      canonicalMetrics: report.metrics,
      exactPlayer22Metrics: exactPlayer22.metrics,
      browser: report.browser,
      scenario: report.scenario,
      ovenBound: false,
    }, null, 2));
  } catch (error) {
    if (error instanceof PerformanceTraceBlockedError) {
      console.error(JSON.stringify(error.report, null, 2));
      process.exitCode = 2;
      return;
    }
    throw error;
  } finally {
    cdp?.close();
    await stopProcess(chrome);
    await stopProcess(server);
    if (profile) await rm(profile, { recursive: true, force: true });
  }
}

async function captureWindow({ browser, cdp, debugContract, index, runId, target, window }) {
  const page = await openPreparedMatch(cdp, target, options.timeoutMs);
  const id = `run-${String(index + 1).padStart(2, "0")}-${window.id}`;
  const startMarker = `cssoccer-performance:${runId}:${id}:start`;
  const endMarker = `cssoccer-performance:${runId}:${id}:end`;
  let tracingStarted = false;
  try {
    const contract = assertCssoccerPerformanceDebugContract(await evaluate(
      cdp,
      page.sessionId,
      "window.__cssoccerDebug.performanceTraceContract()",
      { awaitPromise: true },
    ));
    if (canonicalJson(contract) !== canonicalJson(debugContract)) {
      throw new Error(`Performance debug contract changed before ${id}.`);
    }
    const residencyBefore = await captureBrowserResidency(cdp, page.sessionId);
    await cdp.send("Tracing.start", {
      categories: TRACE_CATEGORIES,
      options: "record-until-full",
      transferMode: "ReturnAsStream",
    });
    tracingStarted = true;
    const windowResult = await evaluate(
      cdp,
      page.sessionId,
      `window.__cssoccerDebug.runPerformanceTraceWindow(${JSON.stringify(window.id)}, ${JSON.stringify({ startMarker, endMarker })})`,
      { awaitPromise: true },
    );
    const traceComplete = cdp.waitFor("Tracing.tracingComplete", options.timeoutMs);
    await cdp.send("Tracing.end");
    const { stream } = await traceComplete;
    tracingStarted = false;
    if (!stream) throw new Error(`Chrome returned no trace stream for ${id}.`);
    const rawTrace = await readTraceStream(cdp, stream);
    const trace = summarizeCssoccerChromeTrace(rawTrace.traceEvents, { startMarker, endMarker });
    const residency = createCssoccerBrowserResidency({
      before: residencyBefore,
      after: await captureBrowserResidency(cdp, page.sessionId),
    });
    const inspected = await evaluate(cdp, page.sessionId, "window.__cssoccerDebug.inspect()");
    const integrity = mergeIntegrity(page, inspected, windowResult?.integrity);
    const samples = windowResult?.samples;
    const measuredWindow = windowResult?.window;
    if (
      canonicalJson(windowResult?.measurement) !== canonicalJson(debugContract.measurement)
      || canonicalJson(windowResult?.bindings) !== canonicalJson(debugContract.bindings)
      || measuredWindow?.id !== window.id
      || measuredWindow.startTick !== window.startTick
      || measuredWindow.frameCount !== window.frameCount
    ) {
      throw new Error(`Performance product-frame result changed its contract during ${id}.`);
    }
    const runRoot = join(options.outputRoot, "runs", runId, id);
    const tracePath = join(runRoot, "trace.json");
    const samplesPath = join(runRoot, "samples.json");
    await atomicWriteJson(tracePath, rawTrace);
    await atomicWriteJson(samplesPath, {
      schema: "cssoccer-performance-window-samples@1",
      runId: id,
      window: measuredWindow,
      samples,
      residency,
      integrity,
      browser,
    });
    return createCssoccerPerformanceRun({
      id,
      window: measuredWindow,
      bindings: debugContract.bindings,
      samples,
      trace,
      residency,
      integrity,
      phaseDefinitions: debugContract.phaseDefinitions,
      startupReadyMs: page.startupReadyMs,
      artifacts: {
        trace: relativeRepo(tracePath),
        samples: relativeRepo(samplesPath),
      },
    });
  } finally {
    if (tracingStarted) await cdp.send("Tracing.end").catch(() => undefined);
    await page.close();
  }
}

async function captureExactPlayer22Profile({ browser, buildBinding, cdp, runId, target }) {
  const page = await openPreparedMatch(cdp, target, options.timeoutMs);
  const id = "run-04-exact-player-22";
  const startMarker = `cssoccer-performance:${runId}:${id}:start`;
  const endMarker = `cssoccer-performance:${runId}:${id}:end`;
  const runRoot = join(options.outputRoot, "runs", runId, id);
  const tracePath = join(runRoot, "trace.json");
  const samplesPath = join(runRoot, "samples.json");
  const reportPath = join(runRoot, "report.json");
  let tracingStarted = false;
  try {
    const paused = await evaluate(cdp, page.sessionId, `(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Escape",
      }));
      return true;
    })()`);
    if (paused !== true) throw new Error("Could not pause the exact-player-22 canonical page.");
    const pausedState = await waitForDebug(cdp, page.sessionId, options.timeoutMs, (value) => (
      value?.ready === true && value?.input?.paused === true
    ));
    assertPreparedIntegrity(pausedState, page.pageErrors, page.requestUrls);

    const sweep = await evaluate(cdp, page.sessionId, `(async () => {
      const started = performance.now();
      const coverage = await window.__cssoccerDebug.auditExactPlayerCoverage();
      return { durationMs: performance.now() - started, coverage };
    })()`, { awaitPromise: true });
    assertExactPlayerSweep(sweep);
    const setup = await evaluate(
      cdp,
      page.sessionId,
      "window.__cssoccerDebug.prepareExactPlayer22PerformanceTrace()",
      { awaitPromise: true },
    );
    assertExactPlayer22Setup(setup, buildBinding);
    const residencyBefore = await captureBrowserResidency(cdp, page.sessionId);

    await cdp.send("Tracing.start", {
      categories: TRACE_CATEGORIES,
      options: "record-until-full",
      transferMode: "ReturnAsStream",
    });
    tracingStarted = true;
    const windowResult = await evaluate(
      cdp,
      page.sessionId,
      `window.__cssoccerDebug.runExactPlayer22PerformanceTraceWindow(${JSON.stringify({ startMarker, endMarker })})`,
      { awaitPromise: true },
    );
    const traceComplete = cdp.waitFor("Tracing.tracingComplete", options.timeoutMs);
    await cdp.send("Tracing.end");
    const { stream } = await traceComplete;
    tracingStarted = false;
    if (!stream) throw new Error("Chrome returned no trace stream for exact-player-22.");
    const rawTrace = await readTraceStream(cdp, stream);
    const trace = summarizeCssoccerChromeTrace(rawTrace.traceEvents, { startMarker, endMarker });
    const residency = createCssoccerBrowserResidency({
      before: residencyBefore,
      after: await captureBrowserResidency(cdp, page.sessionId),
    });
    const inspected = await evaluate(cdp, page.sessionId, "window.__cssoccerDebug.inspect()");
    assertPreparedIntegrity(inspected, page.pageErrors, page.requestUrls);
    const profile = createExactPlayer22Profile({
      browser,
      buildBinding,
      id,
      inspected,
      page,
      residency,
      runId,
      setup,
      sweep,
      trace,
      windowResult,
      artifacts: {
        report: relativeRepo(reportPath),
        trace: relativeRepo(tracePath),
        samples: relativeRepo(samplesPath),
      },
    });
    await atomicWriteJson(tracePath, rawTrace);
    await atomicWriteJson(samplesPath, {
      schema: "cssoccer-exact-player-22-performance-samples@1",
      runId,
      profile: EXACT_PLAYER_PROFILE,
      samples: windowResult.samples,
      sweep,
      setup,
      residency,
      trace,
      buildBinding,
    });
    return { profile, reportPath };
  } finally {
    if (tracingStarted) await cdp.send("Tracing.end").catch(() => undefined);
    await page.close();
  }
}

function createExactPlayer22Profile({
  artifacts,
  browser,
  buildBinding,
  id,
  inspected,
  page,
  residency,
  runId,
  setup,
  sweep,
  trace,
  windowResult,
}) {
  if (windowResult?.schema !== "cssoccer-exact-player-22-performance-window@1"
      || windowResult.status !== "complete"
      || windowResult.profile !== EXACT_PLAYER_PROFILE
      || windowResult.frameCount !== EXACT_PLAYER_FRAME_COUNT
      || !Array.isArray(windowResult.samples)
      || windowResult.samples.length !== EXACT_PLAYER_FRAME_COUNT) {
    throw new Error("Exact-player-22 browser result is incomplete.");
  }
  const frameValues = windowResult.samples.map(({ frameMs }) => frameMs);
  const stepValues = windowResult.samples.map(({ stepCallMs }) => stepCallMs);
  const retainedHeapGrowthBytes = Math.max(0, residency.delta.jsHeapUsedBytes);
  const metrics = Object.freeze({
    frameCount: windowResult.samples.length,
    p95FrameMs: percentile(frameValues, 0.95),
    p99FrameMs: percentile(frameValues, 0.99),
    maxFrameMs: Math.max(...frameValues),
    p95StepCallMs: percentile(stepValues, 0.95),
    maxStepCallMs: Math.max(...stepValues),
    longTaskAtOrAbove50Count: trace.longTasks.atOrAboveBoundaryCount,
    scriptingMs: trace.groups.scripting.durationMs,
    renderingMs: trace.groups.rendering.durationMs,
    paintingMs: trace.groups.painting.durationMs,
    otherRendererMs: trace.groups.other.durationMs,
    retainedJsHeapGrowthBytes: retainedHeapGrowthBytes,
    domNodeGrowthCount: Math.max(0, residency.delta.domNodeCount),
    documentGrowthCount: Math.max(0, residency.delta.documentCount),
    eventListenerGrowthCount: Math.max(0, residency.delta.jsEventListenerCount),
    childListMutationRecordCount: windowResult.mutations.records,
    addedNodeCount: windowResult.mutations.addedNodes,
    removedNodeCount: windowResult.mutations.removedNodes,
    allPlayersChangedFrameCount: windowResult.activity.allPlayersChangedFrameCount,
    keyDivergenceFrameCount: windowResult.keys.divergenceFrameCount,
    measuredSidecarRequestCount: windowResult.cache.runtimeDelta.requestCount,
    measuredDecodedChunkCount: windowResult.cache.runtimeDelta.decodedChunkCount,
    measuredCacheEvictionCount: windowResult.cache.runtimeDelta.cacheEvictionCount,
    measuredTransformWriteCount: windowResult.writes.delta.transformWrites,
    measuredMaterialXWriteCount: windowResult.writes.delta.backgroundPositionXWrites,
    measuredMaterialYWriteCount: windowResult.writes.delta.backgroundPositionYWrites,
    measuredVisibilityWriteCount: windowResult.writes.delta.visibilityWrites,
    measuredUnchangedPropertySkipCount: windowResult.writes.delta.unchangedPropertySkips,
    measuredRedundantStateSkipCount: windowResult.writes.delta.redundantStateSkips,
    cacheEntriesAfter: windowResult.cache.after.entries,
    pendingLoadsAfter: windowResult.cache.after.pendingLoads,
    decodedBytesAfter: windowResult.cache.after.decodedBytes,
    cacheEvictionsAfterFullSweep: setup.after.cacheEvictionCount,
  });
  const budgets = Object.freeze({
    p95FrameMs: 33,
    longTaskAtOrAbove50Count: 0,
    retainedJsHeapGrowthBytes: EXACT_PLAYER_HEAP_GROWTH_BUDGET_BYTES,
    domNodeGrowthCount: 0,
    documentGrowthCount: 0,
    eventListenerGrowthCount: 0,
    childListMutationRecordCount: 0,
    addedNodeCount: 0,
    removedNodeCount: 0,
    allPlayersChangedFrameCount: EXACT_PLAYER_FRAME_COUNT,
    keyDivergenceFrameCount: 0,
    measuredSidecarRequestCount: 0,
    measuredDecodedChunkCount: 0,
    measuredCacheEvictionCount: 0,
    cacheEntriesAfter: 24,
    pendingLoadsAfter: 0,
    decodedBytesAfter: buildBinding.exactPlayer.cacheDecodedByteLimit,
  });
  const checks = [
    checkAtMost("p95FrameMs", metrics.p95FrameMs, budgets.p95FrameMs),
    checkAtMost("longTaskAtOrAbove50Count", metrics.longTaskAtOrAbove50Count, 0),
    checkAtMost("retainedJsHeapGrowthBytes", metrics.retainedJsHeapGrowthBytes, budgets.retainedJsHeapGrowthBytes),
    checkAtMost("domNodeGrowthCount", metrics.domNodeGrowthCount, 0),
    checkAtMost("documentGrowthCount", metrics.documentGrowthCount, 0),
    checkAtMost("eventListenerGrowthCount", metrics.eventListenerGrowthCount, 0),
    checkAtMost("childListMutationRecordCount", metrics.childListMutationRecordCount, 0),
    checkAtMost("addedNodeCount", metrics.addedNodeCount, 0),
    checkAtMost("removedNodeCount", metrics.removedNodeCount, 0),
    checkExactly("allPlayersChangedFrameCount", metrics.allPlayersChangedFrameCount, EXACT_PLAYER_FRAME_COUNT),
    checkAtMost("keyDivergenceFrameCount", metrics.keyDivergenceFrameCount, 0),
    checkAtMost("measuredSidecarRequestCount", metrics.measuredSidecarRequestCount, 0),
    checkAtMost("measuredDecodedChunkCount", metrics.measuredDecodedChunkCount, 0),
    checkAtMost("measuredCacheEvictionCount", metrics.measuredCacheEvictionCount, 0),
    checkAtMost("cacheEntriesAfter", metrics.cacheEntriesAfter, 24),
    checkAtMost("pendingLoadsAfter", metrics.pendingLoadsAfter, 0),
    checkAtMost("decodedBytesAfter", metrics.decodedBytesAfter, budgets.decodedBytesAfter),
    checkExactly("playerRootCount", windowResult.activity.playerRootCount, 22),
    checkExactly("connectedRootCount", windowResult.activity.connectedRootCount, 22),
    checkExactly("leafCount", windowResult.activity.leafCount, 286),
    checkExactly("connectedLeafCount", windowResult.activity.connectedLeafCount, 286),
    checkAtMost("pageErrorCount", Math.max(page.pageErrors.length, inspected.pageErrorCount), 0),
    checkAtMost("nativeRequestCount", inspected.requests.nativeRequestCount, 0),
    checkAtMost("sourceRequestCount", inspected.requests.sourceRequestCount, 0),
    checkAtMost("fallbackStateCount", windowResult.cache.after.fallbackStateCount, 0),
    checkAtMost("unavailableStateCount", windowResult.cache.after.unavailableStateCount, 0),
    checkAtMost("loadFailureCount", windowResult.cache.after.loadFailureCount, 0),
    checkAtMost("runtimeConstructionCount", Object.values(inspected.mount.runtimeConstruction)
      .reduce((sum, value) => sum + value, 0), 0),
  ];
  const status = checks.every(({ status: checkStatus }) => checkStatus === "pass")
    ? "pass"
    : "fail";
  return assertExactPlayer22Profile(Object.freeze({
    schema: "cssoccer-exact-player-22-performance-profile@1",
    status,
    id,
    runId,
    profile: EXACT_PLAYER_PROFILE,
    browser,
    route: "/",
    fixtureId: "spain-argentina-full-match",
    controlCountry: "argentina",
    buildBinding,
    sweep,
    setup,
    samples: windowResult.samples,
    keys: windowResult.keys,
    activity: windowResult.activity,
    cache: windowResult.cache,
    writes: windowResult.writes,
    mutations: windowResult.mutations,
    residency,
    trace,
    metrics,
    budgets,
    verdict: Object.freeze({
      status,
      passCount: checks.filter(({ status: checkStatus }) => checkStatus === "pass").length,
      failCount: checks.filter(({ status: checkStatus }) => checkStatus === "fail").length,
      checks: Object.freeze(checks),
    }),
    artifacts,
  }));
}

async function openPreparedMatch(cdp, target, timeoutMs) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const pageErrors = [];
  const requestUrls = [];
  const removers = [];
  const onSession = (method, listener) => {
    removers.push(cdp.on(method, (params, message) => {
      if (message.sessionId === sessionId) listener(params);
    }));
  };
  onSession("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    pageErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || "page exception");
  });
  onSession("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type !== "error" && type !== "assert") return;
    pageErrors.push(args?.map(({ value, description }) => value ?? description ?? "").join(" ") || type);
  });
  onSession("Log.entryAdded", ({ entry }) => {
    if (entry?.level === "error") pageErrors.push(entry.text || "browser log error");
  });
  onSession("Network.requestWillBeSent", ({ request }) => {
    if (request?.url) requestUrls.push(request.url);
  });
  onSession("Network.loadingFailed", ({ requestId, errorText, canceled }) => {
    if (!canceled) pageErrors.push(`network ${requestId}: ${errorText}`);
  });
  onSession("Network.responseReceived", ({ response }) => {
    if (response?.status >= 400) pageErrors.push(`HTTP ${response.status}: ${response.url}`);
  });
  await Promise.all([
    cdp.send("Page.enable", {}, sessionId),
    cdp.send("Runtime.enable", {}, sessionId),
    cdp.send("Network.enable", {}, sessionId),
    cdp.send("Log.enable", {}, sessionId),
    cdp.send("Emulation.setDeviceMetricsOverride", VIEWPORT, sessionId),
  ]);
  await cdp.send("Target.activateTarget", { targetId });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `Object.defineProperty(globalThis, "__cssoccerDisableLiveScheduler", { configurable: false, enumerable: false, writable: false, value: true });`,
  }, sessionId);
  const startedAt = performance.now();
  try {
    await cdp.send("Page.navigate", { url: target }, sessionId);
    const choosing = await waitForDebug(cdp, sessionId, timeoutMs, (value) => (
      value?.status === "choosing-country" || value?.status === "error"
    ));
    if (choosing?.status !== "choosing-country" || choosing.pageErrorCount !== 0) {
      throw new Error(`Performance route team selector failed integrity: ${JSON.stringify(choosing)}`);
    }
    const selected = await evaluate(cdp, sessionId, `(() => {
      const button = document.querySelector('[data-country-choice="argentina"]');
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (selected !== true) throw new Error("Could not select Argentina through the product UI.");
    const inspected = await waitForDebug(cdp, sessionId, timeoutMs, (value) => (
      value?.ready === true || value?.status === "error"
    ));
    const startupReadyMs = performance.now() - startedAt;
    assertPreparedIntegrity(inspected, pageErrors, requestUrls);
    return {
      targetId,
      sessionId,
      inspected,
      startupReadyMs,
      pageErrors,
      requestUrls,
      async close() {
        for (const remove of removers.splice(0)) remove();
        await cdp.send("Target.closeTarget", { targetId }).catch(() => undefined);
      },
    };
  } catch (error) {
    for (const remove of removers.splice(0)) remove();
    await cdp.send("Target.closeTarget", { targetId }).catch(() => undefined);
    throw error;
  }
}

async function captureBrowserResidency(cdp, sessionId) {
  await cdp.send("HeapProfiler.collectGarbage", {}, sessionId);
  const [heap, dom] = await Promise.all([
    cdp.send("Runtime.getHeapUsage", {}, sessionId),
    cdp.send("Memory.getDOMCounters", {}, sessionId),
  ]);
  return {
    jsHeapUsedBytes: integerMetric(heap.usedSize, "JS heap used bytes"),
    jsHeapTotalBytes: integerMetric(heap.totalSize, "JS heap total bytes"),
    documentCount: integerMetric(dom.documents, "document count"),
    domNodeCount: integerMetric(dom.nodes, "DOM node count"),
    jsEventListenerCount: integerMetric(dom.jsEventListeners, "event listener count"),
  };
}

function integerMetric(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Chrome returned invalid ${label}: ${String(value)}.`);
  }
  return value;
}

function assertPreparedIntegrity(inspected, pageErrors, requestUrls) {
  if (
    inspected?.ready !== true
    || inspected.status !== "ready"
    || inspected.fixtureId !== "spain-argentina-full-match"
    || inspected.controlCountry !== "argentina"
    || inspected.mount?.rootCount !== 37
    || inspected.mount.skyBackdropRootCount !== 1
    || inspected.mount.playerRootCount !== 22
    || inspected.mount.officialRootCount !== 3
    || inspected.mount.exactOfficialRootCount !== 3
    || inspected.mount.stableIdentityCount !== 37
    || inspected.mount.connectedRootCount !== 37
    || inspected.mount.presentationInterpolationMs !== 0
    || inspected.mount.presentationCameraInterpolated !== false
    || inspected.mount.presentationInterpolatedRootCount !== 0
    || !Number.isSafeInteger(inspected.mount.packedFrameStyles?.frameSetCount)
    || !Number.isSafeInteger(inspected.mount.packedFrameStyles?.loadedChunkCount)
    || !Number.isSafeInteger(inspected.mount.packedFrameStyles?.chunkLimitPerFrameSet)
    || inspected.mount.packedFrameStyles.chunkLimitPerFrameSet <= 0
    || inspected.mount.packedFrameStyles.loadedChunkCount
      > inspected.mount.packedFrameStyles.frameSetCount
        * inspected.mount.packedFrameStyles.chunkLimitPerFrameSet
  ) {
    throw new Error(`Canonical prepared route integrity failed: ${JSON.stringify(inspected)}`);
  }
  if (pageErrors.length > 0 || inspected.pageErrorCount !== 0) {
    throw new Error(`Canonical prepared route reported page errors: ${pageErrors.join("\n")}`);
  }
  if (
    inspected.requests?.nativeRequestCount !== 0
    || inspected.requests?.sourceRequestCount !== 0
    || inspected.requests?.rejectedRequestCount !== 0
  ) {
    throw new Error(`Canonical prepared route requested forbidden data: ${JSON.stringify(inspected.requests)}`);
  }
  const forbidden = requestUrls.filter((url) => (
    /(?:\/\.local\/|\/source\/|\/native\/|\/oracle\/|\.(?:exe|dll|lib|dat|obj|off)(?:[?#]|$))/iu.test(url)
  ));
  if (forbidden.length > 0) throw new Error(`Canonical prepared route requested native/source paths: ${forbidden.join(", ")}`);
  for (const [key, value] of Object.entries(inspected.mount.runtimeConstruction ?? {})) {
    if (value !== 0) throw new Error(`Canonical prepared route runtime construction ${key} is ${value}.`);
  }
}

function mergeIntegrity(page, inspected, reported) {
  if (reported !== undefined && reported !== null && typeof reported !== "object") {
    throw new Error("Performance window integrity payload must be an object.");
  }
  assertPreparedIntegrity(inspected, page.pageErrors, page.requestUrls);
  const mount = inspected.mount;
  const measured = {
    rootCount: mount.rootCount,
    skyBackdropRootCount: mount.skyBackdropRootCount,
    playerRootCount: mount.playerRootCount,
    officialRootCount: mount.officialRootCount,
    exactOfficialRootCount: mount.exactOfficialRootCount,
    stableIdentityCount: mount.stableIdentityCount,
    connectedRootCount: mount.connectedRootCount,
    pageErrorCount: Math.max(page.pageErrors.length, inspected.pageErrorCount),
    nativeRequestCount: inspected.requests.nativeRequestCount,
    presentationInterpolationMs: mount.presentationInterpolationMs,
    presentationCameraInterpolated: mount.presentationCameraInterpolated,
    presentationInterpolatedRootCount: mount.presentationInterpolatedRootCount,
    packedFrameStyleFrameSetCount: mount.packedFrameStyles.frameSetCount,
    packedFrameStyleLoadedChunkCount: mount.packedFrameStyles.loadedChunkCount,
    packedFrameStyleChunkLimitPerFrameSet: mount.packedFrameStyles.chunkLimitPerFrameSet,
    packedFrameStyleChunkOverflowCount: Math.max(
      0,
      mount.packedFrameStyles.loadedChunkCount
        - mount.packedFrameStyles.frameSetCount * mount.packedFrameStyles.chunkLimitPerFrameSet,
    ),
    runtimeConstruction: mount.runtimeConstruction,
  };
  if (reported && canonicalJson(reported) !== canonicalJson(measured)) {
    throw new Error("Performance window integrity diverged from the post-window route inspection.");
  }
  return measured;
}

function assertExactPlayerSweep(value) {
  const coverage = value?.coverage;
  if (!Number.isFinite(value?.durationMs) || value.durationMs < 0
      || coverage?.schema !== "cssoccer-exact-player-browser-coverage@1"
      || coverage.status !== "pass"
      || coverage.sequences !== 124
      || coverage.chunks !== 426
      || coverage.requestedStates !== 140_568
      || coverage.appliedStates !== 140_568
      || coverage.appliedFaceStates !== 1_827_384
      || coverage.exactKeyMatch !== true
      || coverage.runtimeDelta.loadFailureCount !== 0
      || coverage.runtimeDelta.unavailableStateCount !== 0
      || coverage.runtimeDelta.fallbackStateCount !== 0
      || coverage.cache.entries !== 24
      || coverage.cache.limit !== 24
      || coverage.cache.pendingLoads !== 0
      || coverage.roots.before.rootCount !== 37
      || coverage.roots.after.rootCount !== 37
      || coverage.roots.before.connectedRootCount !== 37
      || coverage.roots.after.connectedRootCount !== 37) {
    throw new Error(`Exact-player full sweep failed: ${JSON.stringify(value)}`);
  }
  return value;
}

function assertExactPlayer22Setup(value, buildBinding) {
  if (value?.schema !== "cssoccer-exact-player-22-performance-setup@1"
      || value.status !== "ready"
      || value.playerRootCount !== 22
      || !Number.isFinite(value.durationMs)
      || value.durationMs < 0
      || value.after.entries !== 24
      || value.after.limit !== 24
      || value.after.pendingLoads !== 0
      || value.after.decodedBytes > buildBinding.exactPlayer.cacheDecodedByteLimit
      || value.after.loadFailureCount !== 0
      || value.after.unavailableStateCount !== 0
      || value.after.fallbackStateCount !== 0) {
    throw new Error(`Exact-player-22 setup failed: ${JSON.stringify(value)}`);
  }
  return value;
}

function assertExactPlayer22Profile(value) {
  if (value?.schema !== "cssoccer-exact-player-22-performance-profile@1"
      || !["pass", "fail"].includes(value.status)
      || value.profile !== EXACT_PLAYER_PROFILE
      || value.fixtureId !== "spain-argentina-full-match"
      || value.route !== "/"
      || value.controlCountry !== "argentina"
      || value.buildBinding?.schema !== "cssoccer-production-build-binding@1"
      || !Array.isArray(value.samples)
      || value.samples.length !== EXACT_PLAYER_FRAME_COUNT
      || value.metrics?.frameCount !== EXACT_PLAYER_FRAME_COUNT
      || !Array.isArray(value.verdict?.checks)
      || !value.artifacts?.report
      || !value.artifacts?.trace
      || !value.artifacts?.samples) {
    throw new Error("Exact-player-22 performance profile is incomplete.");
  }
  const expectedStatus = value.verdict.checks.every(({ status }) => status === "pass")
    ? "pass"
    : "fail";
  if (value.status !== expectedStatus
      || value.verdict.status !== expectedStatus
      || value.verdict.passCount !== value.verdict.checks.filter(({ status }) => status === "pass").length
      || value.verdict.failCount !== value.verdict.checks.filter(({ status }) => status === "fail").length) {
    throw new Error("Exact-player-22 performance verdict is contradictory.");
  }
  return value;
}

function createPerformanceSuite({
  artifacts,
  buildBinding,
  canonical,
  exactPlayer22,
  generatedAt,
  priorSuite,
  runId,
}) {
  assertCssoccerPerformanceOvenReport(canonical);
  assertExactPlayer22Profile(exactPlayer22);
  const status = canonical.status === "pass" && exactPlayer22.status === "pass"
    ? "pass"
    : "fail";
  const priorExact = priorSuite?.schema === "cssoccer-production-performance-suite@1"
    ? priorSuite.profiles?.exactPlayer22 ?? null
    : null;
  const comparableMetricIds = [
    "p95StepCallMs",
    "maxStepCallMs",
    "scriptingMs",
    "renderingMs",
    "paintingMs",
  ];
  const comparison = priorExact?.status === "pass"
    ? {
        baselineRunId: priorExact.runId,
        metrics: Object.fromEntries(comparableMetricIds.map((id) => [id, {
          baseline: priorExact.metrics[id],
          current: exactPlayer22.metrics[id],
          delta: exactPlayer22.metrics[id] - priorExact.metrics[id],
        }])),
      }
    : null;
  return assertPerformanceSuite(Object.freeze({
    schema: "cssoccer-production-performance-suite@1",
    status,
    runId,
    generatedAt,
    profile: EXACT_PLAYER_PROFILE,
    buildBinding,
    profiles: Object.freeze({ canonical, exactPlayer22 }),
    comparison,
    artifacts,
  }));
}

function assertPerformanceSuite(value) {
  if (value?.schema !== "cssoccer-production-performance-suite@1"
      || !["pass", "fail"].includes(value.status)
      || value.profile !== EXACT_PLAYER_PROFILE
      || !value.runId
      || !value.artifacts?.report
      || !value.artifacts?.retainedReport
      || value.buildBinding?.schema !== "cssoccer-production-build-binding@1") {
    throw new Error("css.soccer production performance suite is incomplete.");
  }
  assertCssoccerPerformanceOvenReport(value.profiles?.canonical);
  assertExactPlayer22Profile(value.profiles?.exactPlayer22);
  const expectedStatus = value.profiles.canonical.status === "pass"
    && value.profiles.exactPlayer22.status === "pass"
    ? "pass"
    : "fail";
  if (value.status !== expectedStatus) {
    throw new Error("css.soccer production performance suite status is contradictory.");
  }
  return value;
}

function checkAtMost(id, actual, limit) {
  if (!Number.isFinite(actual) || !Number.isFinite(limit)) {
    throw new Error(`Invalid exact-player-22 metric ${id}.`);
  }
  return Object.freeze({
    id,
    actual,
    limit,
    operator: "<=",
    status: actual <= limit ? "pass" : "fail",
  });
}

function checkExactly(id, actual, expected) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    throw new Error(`Invalid exact-player-22 metric ${id}.`);
  }
  return Object.freeze({
    id,
    actual,
    limit: expected,
    operator: "===",
    status: actual === expected ? "pass" : "fail",
  });
}

function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

async function readTraceStream(cdp, stream) {
  let text = "";
  try {
    while (true) {
      const chunk = await cdp.send("IO.read", { handle: stream });
      text += chunk.base64Encoded
        ? Buffer.from(chunk.data, "base64").toString("utf8")
        : chunk.data;
      if (chunk.eof) break;
    }
  } finally {
    await cdp.send("IO.close", { handle: stream }).catch(() => undefined);
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.traceEvents)) throw new Error("Chrome trace stream contains no traceEvents array.");
  return parsed;
}

async function collectProductionBuildBinding() {
  const distRoot = join(REPO_ROOT, "dist");
  const htmlPath = join(distRoot, "index.html");
  await access(htmlPath);
  const html = await readFile(htmlPath, "utf8");
  const mainMatch = html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/u);
  const styleMatch = html.match(/<link[^>]+href="([^"]*\/assets\/index-[^"]+\.css)"/u);
  if (!mainMatch || !styleMatch) {
    throw new Error("Production build has no hashed css.soccer module and stylesheet.");
  }
  const toDistPath = (urlPath) => join(distRoot, urlPath.replace(/^\//u, ""));
  const mainPath = toDistPath(mainMatch[1]);
  const stylePath = toDistPath(styleMatch[1]);
  const manifestPath = join(distRoot, "cssoccer/manifest.json");
  const exactIndexPath = join(
    distRoot,
    "cssoccer/assets/animation/exact-player/index.json",
  );
  const materialsPath = join(
    distRoot,
    "cssoccer/assets/spain-argentina-exact-player-materials.json",
  );
  const exactIndex = JSON.parse(await readFile(exactIndexPath, "utf8"));
  if (exactIndex?.counts?.sequences !== 124
      || exactIndex.counts.chunks !== 426
      || exactIndex.counts.samples !== 140_568
      || exactIndex.counts.faceStates !== 1_827_384
      || exactIndex.cache?.maxDecodedChunks !== 24) {
    throw new Error("Production build exact-player index is incomplete.");
  }
  const distFiles = await walkFiles(distRoot);
  const treeEntries = [];
  let totalBytes = 0;
  for (const path of distFiles.sort()) {
    const info = await stat(path);
    const entry = {
      path: relative(distRoot, path).split("\\").join("/"),
      bytes: info.size,
      sha256: await sha256File(path),
    };
    totalBytes += entry.bytes;
    treeEntries.push(entry);
  }
  const descriptorDecodedBytes = exactIndex.sequences.flatMap(({ chunks }) => chunks.map((chunk) => (
    chunk.bytes + chunk.faceStateCount * (chunk.transformIndexWidthBits / 8 + 1)
  )));
  descriptorDecodedBytes.sort((left, right) => right - left);
  const fileBinding = async (path) => {
    const info = await stat(path);
    return Object.freeze({
      path: relativeRepo(path),
      bytes: info.size,
      sha256: await sha256File(path),
    });
  };
  return Object.freeze({
    schema: "cssoccer-production-build-binding@1",
    status: "ready",
    fileCount: treeEntries.length,
    totalBytes,
    treeSha256: createHash("sha256").update(canonicalJson(treeEntries)).digest("hex"),
    indexHtml: await fileBinding(htmlPath),
    mainModule: await fileBinding(mainPath),
    stylesheet: await fileBinding(stylePath),
    manifest: await fileBinding(manifestPath),
    exactPlayer: Object.freeze({
      index: await fileBinding(exactIndexPath),
      materials: await fileBinding(materialsPath),
      contractSha256: exactIndex.contractSha256,
      viewContractSha256: exactIndex.viewContractSha256,
      topologySha256: exactIndex.topologySha256,
      geometryId: exactIndex.geometryId,
      sequenceCount: exactIndex.counts.sequences,
      chunkCount: exactIndex.counts.chunks,
      sampleCount: exactIndex.counts.samples,
      faceStateCount: exactIndex.counts.faceStates,
      cacheLimit: exactIndex.cache.maxDecodedChunks,
      cacheDecodedByteLimit: descriptorDecodedBytes.slice(0, 24)
        .reduce((sum, value) => sum + value, 0),
    }),
  });
}

async function collectProvenance(runs, exactPlayer22, buildBinding) {
  const paths = new Set([
    "index.html",
    "vite.config.mjs",
    "src/performance/performanceOven.mjs",
    "tools/performance-trace-oven.mjs",
    "build/generated/public/cssoccer/manifest.json",
    buildBinding.mainModule.path,
    buildBinding.stylesheet.path,
    buildBinding.manifest.path,
    buildBinding.exactPlayer.index.path,
    buildBinding.exactPlayer.materials.path,
  ]);
  for (const folder of [
    "src/cssoccer",
    "build/generated/public/cssoccer/assets",
    "build/generated/public/cssoccer/scenes",
    "build/generated/public/cssoccer/facts",
  ]) {
    for (const path of await walkFiles(join(REPO_ROOT, folder))) paths.add(relativeRepo(path));
  }
  for (const run of runs) {
    paths.add(run.artifacts.trace);
    paths.add(run.artifacts.samples);
  }
  paths.add(exactPlayer22.artifacts.trace);
  paths.add(exactPlayer22.artifacts.samples);
  const result = {};
  for (const path of [...paths].sort()) {
    const absolute = resolve(REPO_ROOT, path);
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error(`Performance provenance input is not a file: ${path}`);
    result[path] = { bytes: info.size, sha256: await sha256File(absolute) };
  }
  return result;
}

async function walkFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...await walkFiles(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}

async function readPriorHistory(path) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(value?.history) ? value.history : [];
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return [];
    throw error;
  }
}

async function readJsonIfPresent(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function waitForDebug(cdp, sessionId, timeoutMs, predicate) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(cdp, sessionId, "window.__cssoccerDebug?.inspect?.() ?? null");
      if (predicate(last)) return last;
    } catch (error) {
      if (!/context|navigation|destroyed/iu.test(String(error))) throw error;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for css.soccer debug state: ${JSON.stringify(last)}`);
}

async function evaluate(cdp, sessionId, expression, { awaitPromise = false } = {}) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function startProductionPreview(port, timeoutMs) {
  const vite = join(REPO_ROOT, "node_modules/vite/bin/vite.js");
  await access(vite);
  const child = spawn(process.execPath, [
    vite,
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ], { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, timeoutMs);
    return child;
  } catch (error) {
    await stopProcess(child);
    throw new Error(`Could not start css.soccer production preview: ${stderr}`, { cause: error });
  }
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function launchChrome(executable, profilePath, timeoutMs) {
  const child = spawn(executable, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const webSocketUrl = await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out starting headless Chrome.")), timeoutMs);
    let output = "";
    const onData = (chunk) => {
      output += chunk.toString("utf8");
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/u);
      if (!match) return;
      clearTimeout(timer);
      child.stderr.off("data", onData);
      child.stderr.resume();
      resolvePromise(match[1]);
    };
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited ${code}: ${output}`));
    });
  });
  return { process: child, webSocketUrl };
}

async function resolveChromeExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next declared real Chrome target.
    }
  }
  throw new Error("No supported local Google Chrome executable is available.");
}

function browserMetadata(info, executable) {
  const product = String(info.product ?? "Chrome/unknown");
  return {
    engine: product.split("/")[0] || "Chrome",
    version: product.split("/")[1] || product,
    product,
    userAgent: info.userAgent,
    revision: info.revision,
    executable,
    headless: true,
    viewport: { ...VIEWPORT },
  };
}

function machineMetadata() {
  const processors = cpus();
  return {
    platform: platform(),
    arch: arch(),
    cpu: processors[0]?.model ?? "unknown",
    logicalCpus: processors.length,
    totalMemoryBytes: totalmem(),
    node: process.version,
  };
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    delay(2_000).then(() => child.kill("SIGKILL")),
  ]);
}

function relativeRepo(path) {
  return relative(REPO_ROOT, path).split("\\").join("/");
}

function parseArgs(args) {
  const parsed = {
    check: false,
    help: false,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    url: null,
    profile: EXACT_PLAYER_PROFILE,
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--check") parsed.check = true;
    else if (value === "--help" || value === "-h") parsed.help = true;
    else if (value === "--url") parsed.url = new URL(requireArg(args[++index], value)).href;
    else if (value === "--port") parsed.port = positiveInteger(requireArg(args[++index], value), value);
    else if (value === "--timeout-ms") parsed.timeoutMs = positiveInteger(requireArg(args[++index], value), value);
    else if (value === "--output-root") parsed.outputRoot = resolve(REPO_ROOT, requireArg(args[++index], value));
    else if (value === "--profile") parsed.profile = requireArg(args[++index], value);
    else throw new Error(`Unknown option ${value}.`);
  }
  if (parsed.profile !== EXACT_PLAYER_PROFILE) {
    throw new Error(`--profile must be ${EXACT_PLAYER_PROFILE}.`);
  }
  return parsed;
}

function requireArg(value, flag) {
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function positiveInteger(value, flag) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error(`${flag} must be a positive integer.`);
  return result;
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function printHelp() {
  console.log(`Usage: node tools/performance-trace-oven.mjs --check --profile ${EXACT_PLAYER_PROFILE} [options]\n\nOptions:\n  --url <url>           Use an existing production css.soccer server\n  --port <number>       Vite preview port when starting a server (default: ${DEFAULT_PORT})\n  --timeout-ms <number> Browser/server timeout (default: ${DEFAULT_TIMEOUT_MS})\n  --output-root <path>  Ignored local performance artifact root\n  --profile <name>      Required trace profile (${EXACT_PLAYER_PROFILE})\n`);
}

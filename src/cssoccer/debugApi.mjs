export function installCssoccerDebugApi(
  state,
  { debugTools, performanceTraceRuntime, visualCaptureRuntime },
  target = globalThis,
) {
  if (!target || (typeof target !== "object" && typeof target !== "function")) {
    throw new Error("css.soccer debug API requires a browser target.");
  }
  let exactPlayerPerformanceRunning = false;
  const api = Object.freeze({
    get ready() {
      return state.ready;
    },
    get status() {
      return state.status;
    },
    get manifest() {
      return state.manifest;
    },
    get scene() {
      return state.sceneData;
    },
    get route() {
      return state.route;
    },
    get controlCountry() {
      return state.controlCountry;
    },
    get match() {
      return state.matchState;
    },
    get live() {
      return state.liveFrame;
    },
    setPreparedFrame(rootId, frameIndex) {
      if (!state.mount) throw new Error("Prepared css.soccer match is not mounted.");
      return state.mount.setPreparedFrame(rootId, frameIndex);
    },
    errors() {
      return Object.freeze([...state.errors]);
    },
    events() {
      return inspectEngineEvents(state);
    },
    requestStats() {
      return state.requestAudit.snapshot();
    },
    debugPanelState() {
      return debugTools?.state?.() ?? null;
    },
    setDebugPanel(enabled) {
      return debugTools?.setVisible?.(enabled) ?? false;
    },
    toggleDebugPanel() {
      return debugTools?.toggleVisible?.() ?? false;
    },
    recordingStatus() {
      return debugTools?.recordingApi?.status?.() ?? null;
    },
    startRecording() {
      return debugTools?.recordingApi?.start?.() ?? false;
    },
    stopRecording(options = {}) {
      return debugTools?.recordingApi?.stop?.(options) ?? null;
    },
    lastRecording() {
      return debugTools?.recordingApi?.last?.() ?? null;
    },
    copyLastRecording() {
      return debugTools?.recordingApi?.copyLast?.() ?? Promise.resolve(false);
    },
    performanceTraceContract() {
      return performanceTraceRuntime.contract();
    },
    runPerformanceTraceWindow(windowId, markers) {
      return performanceTraceRuntime.run(windowId, markers);
    },
    async runExactPlayer22PerformanceTraceWindow(markers) {
      if (exactPlayerPerformanceRunning) {
        throw new Error("An exact-player-22 performance window is already running.");
      }
      exactPlayerPerformanceRunning = true;
      try {
        return await runExactPlayer22PerformanceTraceWindow(state, target, markers);
      } finally {
        exactPlayerPerformanceRunning = false;
      }
    },
    prepareExactPlayer22PerformanceTrace() {
      return prepareExactPlayer22PerformanceTrace(state, target);
    },
    beginVisualCapture() {
      return visualCaptureRuntime.begin();
    },
    advanceVisualCaptureToTick(targetTick) {
      return visualCaptureRuntime.advanceToTick(targetTick);
    },
    endVisualCapture() {
      return visualCaptureRuntime.end();
    },
    visualCaptureState() {
      return visualCaptureRuntime.state();
    },
    auditExactPlayerCoverage() {
      return auditExactPlayerCoverage(state);
    },
    async setExactPlayerEvidenceState(rootId, exactState) {
      if (!state.mount || !state.exactPlayerAssets) {
        throw new Error("Exact player evidence requires the mounted canonical match.");
      }
      await state.exactPlayerAssets.preload(exactState);
      return state.mount.setExactPlayerEvidenceState(rootId, exactState);
    },
    inspect() {
      const mount = state.mount?.stats?.() ?? null;
      const match = state.matchState === null
        ? null
        : Object.freeze({
          tick: state.matchState.tick,
          matchHalf: state.matchState.clock.matchHalf,
          phase: state.matchState.phase,
          selectedCountry: state.matchState.config.controlCountry,
          gameplayProfileHash: state.matchState.bindings.gameplayProfileHash,
        });
      const engineSnapshot = state.engine?.snapshot?.() ?? null;
      const engine = engineSnapshot === null
        ? null
        : Object.freeze({
            schema: state.engine.schema,
            snapshotSchema: engineSnapshot.schema,
            tick: engineSnapshot.tick,
            phase: engineSnapshot.phase,
            paused: engineSnapshot.paused,
          });
      const live = state.liveFrame === null
        ? null
        : Object.freeze({
            schema: state.liveFrame.schema,
            tick: state.liveFrame.tick,
            matchHalf: state.liveFrame.matchHalf,
            phase: state.liveFrame.phase,
            terminal: state.liveFrame.terminal,
            score: Object.freeze({ ...state.liveFrame.score }),
            clock: Object.freeze({ ...state.liveFrame.clock }),
            selectedPlayerId: state.liveFrame.selectedPlayerId,
            playerHighlight: Object.freeze({
              rootId: state.liveFrame.playerHighlight.rootId,
              playerId: state.liveFrame.playerHighlight.playerId,
              visible: state.liveFrame.playerHighlight.visible,
              type: state.liveFrame.playerHighlight.type.semantic,
              familyId: state.liveFrame.playerHighlight.family.id,
              frameIndex: state.liveFrame.playerHighlight.family.frameIndex,
              ordinaryShadow: state.liveFrame.playerHighlight.ordinaryShadow,
              position: Object.freeze([
                ...state.liveFrame.playerHighlight.transform.position,
              ]),
            }),
          });
      const input = inspectInputState(state);
      const events = inspectEngineEvents(state);
      return Object.freeze({
        ready: state.ready,
        status: state.status,
        fixtureId: state.route?.fixtureId ?? null,
        controlCountry: state.controlCountry,
        pageErrorCount: state.errors.length,
        requests: state.requestAudit.snapshot(),
        mount,
        match,
        live,
        input,
        engine,
        events,
        debugPanel: debugTools?.state?.() ?? null,
      });
    },
  });

  Object.defineProperty(target, "__cssoccerDebug", {
    configurable: true,
    enumerable: false,
    value: api,
  });
  return api;
}

async function auditExactPlayerCoverage(state) {
  const runtime = state.exactPlayerAssets;
  const mount = state.mount;
  if (!state.ready || !runtime || !mount) {
    throw new Error("Exact player coverage requires the mounted canonical match.");
  }
  if (state.inputState?.paused !== true) {
    throw new Error("Exact player coverage requires the match to be paused.");
  }
  const index = runtime.index;
  if (index?.counts?.samples !== 140_568
      || index.counts.faceStates !== 1_827_384
      || index.counts.chunks !== 426) {
    throw new Error("Exact player coverage index is not the complete prepared domain.");
  }
  const before = runtime.stats();
  const mountBefore = mount.stats();
  const requestedKeys = [];
  const appliedKeys = [];
  let requestedStates = 0;
  let appliedStates = 0;
  let appliedFaceStates = 0;
  let visibleFaceStates = 0;
  let hiddenFaceStates = 0;
  let materialSelectorStates = 0;
  let chunkCount = 0;

  for (const sequence of index.sequences) {
    for (const descriptor of sequence.chunks) {
      await runtime.preload({
        slotId: sequence.slotId,
        localFrameIndex: descriptor.frameStart,
        yawIndex: 0,
      });
      chunkCount += 1;
      for (
        let localFrameIndex = descriptor.frameStart;
        localFrameIndex < descriptor.frameEnd;
        localFrameIndex += 1
      ) {
        for (let yawIndex = 0; yawIndex < 24; yawIndex += 1) {
          const key = `${sequence.slotId}:${localFrameIndex}:${yawIndex}`;
          const request = { slotId: sequence.slotId, localFrameIndex, yawIndex };
          requestedKeys.push(key);
          requestedStates += 1;
          let sampleFaceCount = 0;
          runtime.applySample(request, (
            faceIndex,
            transform,
            visible,
            materialSelectorOffset,
          ) => {
            if (faceIndex !== sampleFaceCount
                || typeof transform !== "string"
                || typeof visible !== "boolean"
                || (materialSelectorOffset !== null
                  && !Number.isSafeInteger(materialSelectorOffset))) {
              throw new Error(`Exact player face state changed at ${key}:${faceIndex}.`);
            }
            sampleFaceCount += 1;
            appliedFaceStates += 1;
            if (visible) visibleFaceStates += 1;
            else hiddenFaceStates += 1;
            if (materialSelectorOffset !== null) materialSelectorStates += 1;
          });
          if (sampleFaceCount !== 13) {
            throw new Error(`Exact player state ${key} did not apply 13 faces.`);
          }
          appliedKeys.push(key);
          appliedStates += 1;
        }
      }
    }
  }
  const after = runtime.stats();
  const mountAfter = mount.stats();
  const [requestedKeySha256, appliedKeySha256] = await Promise.all([
    sha256Text(`${requestedKeys.join("\n")}\n`),
    sha256Text(`${appliedKeys.join("\n")}\n`),
  ]);
  return {
    schema: "cssoccer-exact-player-browser-coverage@1",
    status: "pass",
    indexContractSha256: index.contractSha256,
    viewContractSha256: index.viewContractSha256,
    geometryId: index.geometryId,
    topologySha256: index.topologySha256,
    sequences: index.sequences.length,
    chunks: chunkCount,
    requestedStates,
    appliedStates,
    appliedFaceStates,
    visibleFaceStates,
    hiddenFaceStates,
    materialSelectorStates,
    firstKey: requestedKeys[0],
    lastKey: requestedKeys.at(-1),
    requestedKeySha256,
    appliedKeySha256,
    exactKeyMatch: requestedKeySha256 === appliedKeySha256,
    runtimeDelta: counterDelta(before, after),
    cache: {
      entries: after.cacheEntries,
      limit: after.cacheLimit,
      pendingLoads: after.pendingLoads,
      cachedPaths: after.cachedPaths,
    },
    roots: {
      before: exactRootIntegrity(mountBefore),
      after: exactRootIntegrity(mountAfter),
    },
  };
}

async function runExactPlayer22PerformanceTraceWindow(state, target, markers) {
  if (!state.ready || !state.mount || !state.exactPlayerAssets
      || target.__cssoccerDisableLiveScheduler !== true
      || state.inputState?.paused !== true) {
    throw new Error(
      "Exact-player-22 performance tracing requires one paused scheduler-disabled canonical match.",
    );
  }
  const startMarker = markers?.startMarker;
  const endMarker = markers?.endMarker;
  if (typeof startMarker !== "string" || startMarker.length === 0
      || typeof endMarker !== "string" || endMarker.length === 0
      || startMarker === endMarker) {
    throw new Error("Exact-player-22 performance tracing requires unique markers.");
  }
  const runtime = state.exactPlayerAssets;
  const mount = state.mount;
  const sequences = exactPlayer22Sequences(runtime);
  const setupBefore = runtime.stats();
  const setupStarted = target.performance.now();
  const setupStates = sequences.map((sequence, index) => ({
    slotId: sequence.slotId,
    localFrameIndex: index % 16,
    yawIndex: index % 24,
  }));
  await runtime.preloadMany(setupStates);
  const setupMs = target.performance.now() - setupStarted;
  const setupAfter = runtime.stats();
  const frameStates = Array.from({ length: 240 }, (_, frame) => (
    Object.freeze(sequences.map((sequence, index) => Object.freeze({
      slotId: sequence.slotId,
      localFrameIndex: (frame + index) % 16,
      yawIndex: (frame * 5 + index) % 24,
    })))
  ));
  mount.applyExactPlayerPerformanceStates(sequences.map((sequence, index) => ({
    slotId: sequence.slotId,
    localFrameIndex: (index + 15) % 16,
    yawIndex: (index + 23) % 24,
  })));
  const raf = target.requestAnimationFrame?.bind(target);
  if (typeof raf !== "function") throw new Error("Exact-player-22 trace requires requestAnimationFrame.");
  await nextAnimationFrame(raf);
  let priorRafTimestamp = await nextAnimationFrame(raf);
  const assetBefore = runtime.stats();
  const mountBefore = mount.exactPlayerPerformanceStats();
  const mutation = { records: 0, addedNodes: 0, removedNodes: 0 };
  const observer = new target.MutationObserver((records) => {
    for (const record of records) {
      mutation.records += 1;
      mutation.addedNodes += record.addedNodes.length;
      mutation.removedNodes += record.removedNodes.length;
    }
  });
  const sceneHost = target.document.getElementById("scene");
  if (!sceneHost) throw new Error("Exact-player-22 trace requires the canonical #scene host.");
  observer.observe(sceneHost, { childList: true, subtree: true });
  const samples = [];
  const requestedKeys = [];
  const appliedKeys = [];
  let keyDivergenceCount = 0;
  let allPlayersChangedFrameCount = 0;
  target.console.timeStamp(startMarker);
  try {
    for (let frame = 0; frame < frameStates.length; frame += 1) {
      const rafTimestamp = await nextAnimationFrame(raf);
      const stepStarted = target.performance.now();
      const result = mount.applyExactPlayerPerformanceStates(frameStates[frame]);
      const stepCallMs = target.performance.now() - stepStarted;
      const exactKeyMatch = result.requestedKeys.every((key, index) => (
        key === result.appliedKeys[index]
      ));
      if (!exactKeyMatch) keyDivergenceCount += 1;
      if (result.changedCount === 22) allPlayersChangedFrameCount += 1;
      requestedKeys.push(...result.requestedKeys);
      appliedKeys.push(...result.appliedKeys);
      samples.push(Object.freeze({
        frame,
        frameMs: rafTimestamp - priorRafTimestamp,
        stepCallMs,
        playerRootCount: result.playerRootCount,
        connectedRootCount: result.connectedRootCount,
        changedCount: result.changedCount,
        exactKeyMatch,
      }));
      priorRafTimestamp = rafTimestamp;
    }
  } finally {
    target.console.timeStamp(endMarker);
    observer.disconnect();
  }
  const assetAfter = runtime.stats();
  const mountAfter = mount.exactPlayerPerformanceStats();
  const [requestedKeySha256, appliedKeySha256] = await Promise.all([
    sha256Text(`${requestedKeys.join("\n")}\n`),
    sha256Text(`${appliedKeys.join("\n")}\n`),
  ]);
  return Object.freeze({
    schema: "cssoccer-exact-player-22-performance-window@1",
    status: "complete",
    profile: "exact-player-22",
    frameCount: samples.length,
    setup: Object.freeze({
      setupMs,
      runtimeDelta: Object.freeze(numericCounterDelta(setupBefore, setupAfter)),
    }),
    samples: Object.freeze(samples),
    keys: Object.freeze({
      requestedCount: requestedKeys.length,
      appliedCount: appliedKeys.length,
      requestedKeySha256,
      appliedKeySha256,
      divergenceFrameCount: keyDivergenceCount,
    }),
    activity: Object.freeze({
      playerRootCount: mountAfter.playerRootCount,
      connectedRootCount: mountAfter.connectedRootCount,
      leafCount: mountAfter.leafCount,
      connectedLeafCount: mountAfter.connectedLeafCount,
      allPlayersChangedFrameCount,
    }),
    cache: Object.freeze({
      before: exactCacheStats(assetBefore),
      after: exactCacheStats(assetAfter),
      runtimeDelta: Object.freeze(numericCounterDelta(assetBefore, assetAfter)),
    }),
    writes: Object.freeze({
      before: mountBefore.counters,
      after: mountAfter.counters,
      delta: Object.freeze(numericCounterDelta(mountBefore.counters, mountAfter.counters)),
    }),
    mutations: Object.freeze({ ...mutation }),
  });
}

async function prepareExactPlayer22PerformanceTrace(state, target) {
  if (!state.ready || !state.mount || !state.exactPlayerAssets
      || target.__cssoccerDisableLiveScheduler !== true
      || state.inputState?.paused !== true) {
    throw new Error(
      "Exact-player-22 setup requires one paused scheduler-disabled canonical match.",
    );
  }
  const runtime = state.exactPlayerAssets;
  const sequences = exactPlayer22Sequences(runtime);
  const before = runtime.stats();
  const started = target.performance.now();
  const states = sequences.map((sequence, index) => ({
    slotId: sequence.slotId,
    localFrameIndex: index % 16,
    yawIndex: index % 24,
  }));
  await runtime.preloadMany(states);
  state.mount.applyExactPlayerPerformanceStates(sequences.map((sequence, index) => ({
    slotId: sequence.slotId,
    localFrameIndex: (index + 15) % 16,
    yawIndex: (index + 23) % 24,
  })));
  const after = runtime.stats();
  return Object.freeze({
    schema: "cssoccer-exact-player-22-performance-setup@1",
    status: "ready",
    durationMs: target.performance.now() - started,
    playerRootCount: state.mount.exactPlayerPerformanceStats().playerRootCount,
    before: exactCacheStats(before),
    after: exactCacheStats(after),
    runtimeDelta: Object.freeze(numericCounterDelta(before, after)),
  });
}

function exactPlayer22Sequences(runtime) {
  const sequences = runtime.index?.sequences?.slice(0, 22) ?? [];
  if (sequences.length !== 22 || sequences.some(({ frameCount }) => frameCount < 16)) {
    throw new Error("Exact-player-22 performance tracing requires 22 bounded prepared sequences.");
  }
  return sequences;
}

function exactCacheStats(value) {
  return Object.freeze({
    entries: value.cacheEntries,
    limit: value.cacheLimit,
    pendingLoads: value.pendingLoads,
    decodedBytes: value.decodedBytes,
    requestCount: value.requestCount,
    cacheHitCount: value.cacheHitCount,
    cacheMissCount: value.cacheMissCount,
    cacheEvictionCount: value.cacheEvictionCount,
    loadFailureCount: value.loadFailureCount,
    decodedChunkCount: value.decodedChunkCount,
    unavailableStateCount: value.unavailableStateCount,
    fallbackStateCount: value.fallbackStateCount,
  });
}

function numericCounterDelta(before, after) {
  return Object.fromEntries(Object.keys(after)
    .filter((key) => Number.isFinite(before[key]) && Number.isFinite(after[key]))
    .map((key) => [key, after[key] - before[key]]));
}

function nextAnimationFrame(requestAnimationFrameImpl) {
  return new Promise((resolve) => requestAnimationFrameImpl(resolve));
}

function counterDelta(before, after) {
  const output = {};
  for (const key of [
    "requestCount",
    "cacheHitCount",
    "cacheMissCount",
    "cacheEvictionCount",
    "loadFailureCount",
    "decodedChunkCount",
    "sampleApplyCount",
    "unavailableStateCount",
    "fallbackStateCount",
  ]) output[key] = after[key] - before[key];
  return output;
}

function exactRootIntegrity(stats) {
  return {
    rootCount: stats.rootCount,
    playerRootCount: stats.playerRootCount,
    stableIdentityCount: stats.stableIdentityCount,
    connectedRootCount: stats.connectedRootCount,
    leafCount: stats.leafCount,
    connectedLeafCount: stats.connectedLeafCount,
    runtimeConstruction: { ...stats.runtimeConstruction },
  };
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function uninstallCssoccerDebugApi(api, target = globalThis) {
  if (target?.__cssoccerDebug === api) delete target.__cssoccerDebug;
}

function inspectEngineEvents(state) {
  return Object.freeze((state.engine?.snapshot?.()?.lastStep?.events ?? []).map((event) => (
    Object.freeze({ ...event })
  )));
}

function inspectInputState(state) {
  const lastCommand = state.lastInputCommand === null
    ? null
    : Object.freeze({ ...state.lastInputCommand });
  return Object.freeze({
    schema: "cssoccer-debug-input@1",
    focused: state.inputState.focused,
    paused: state.inputState.paused,
    keyboardCodes: Object.freeze([...state.inputState.keyboardCodes]),
    lastCommand,
  });
}

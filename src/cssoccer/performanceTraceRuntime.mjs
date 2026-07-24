export const CSSOCCER_PERFORMANCE_TRACE_RUNTIME_SCHEMA =
  "cssoccer-production-performance-trace@2";
export const CSSOCCER_PERFORMANCE_TRACE_RESULT_SCHEMA =
  "cssoccer-production-performance-window-result@2";

const FIXTURE_ID = "spain-argentina-full-match";
const FRAME_COUNT = 240;
const SHA256 = /^[a-f0-9]{64}$/u;
const BINDING_KEYS = Object.freeze([
  "gameplayProfileHash",
  "rulesSha256",
  "sourceRevision",
  "tacticsTableSha256",
  "teamAuthoritySha256",
  "timingSha256",
]);

export const CSSOCCER_PERFORMANCE_MEASUREMENT = deepFreeze({
  frameLoop: "canonical-product-fixed-step-raf@1",
  simulationStepMs: 50,
  maxSimulationStepsPerFrame: 5,
  presentation: "direct-current-state-transform-publication@1",
  presentationInterpolationMs: 0,
});

export const CSSOCCER_PERFORMANCE_TRACE_WINDOWS = deepFreeze([
  {
    id: "opening-live",
    startTick: 0,
    frameCount: FRAME_COUNT,
    activity: "opening-kickoff-and-first-half-live",
  },
  {
    id: "halftime-rule-transition",
    startTick: 1_180,
    frameCount: FRAME_COUNT,
    activity: "first-half-live-halftime-whistle-and-transition",
  },
  {
    id: "second-half-restart",
    startTick: 1_500,
    frameCount: FRAME_COUNT,
    activity: "halftime-transition-second-half-kickoff-and-live-play",
  },
]);

export const CSSOCCER_PERFORMANCE_PHASE_DEFINITIONS = deepFreeze({
  runtime: [{
    id: "productAnimationFrame",
    label: "canonical product fixed-step animation-frame callback",
    producer: "src/cssoccer/client.mjs",
    nextProbe: "Separate input, browser engine, and render-frame construction inside the same product callback.",
  }, {
    id: "productSimulation",
    label: "product input, browser engine, and live render-frame construction",
    producer: "src/cssoccer/client.mjs",
    nextProbe: "Separate input sampling, browser engine stepping, and live render-frame construction.",
  }],
  camera: [{
    id: "preparedLivePublication",
    label: "prepared camera, player, ball, and HUD publication",
    producer: "src/cssoccer/polycssScene.mjs",
    nextProbe: "Separate camera, stable-root transforms, prepared animation frames, and HUD publication.",
  }],
});

export function createCssoccerPerformanceTraceRuntime({
  getReadyState,
  getBindings,
  getIntegrity,
  stepProductTick,
  beginProductFrameTrace,
  stepProductFrame,
  requestAnimationFrameImpl,
  performanceImpl,
  consoleImpl,
} = {}) {
  requireFunction(getReadyState, "performance ready-state provider");
  requireFunction(getBindings, "performance binding provider");
  requireFunction(getIntegrity, "performance integrity provider");
  requireFunction(stepProductTick, "performance product-tick step");
  requireFunction(beginProductFrameTrace, "performance product-frame initializer");
  requireFunction(stepProductFrame, "performance product animation-frame step");
  let running = false;
  let consumed = false;

  function contract() {
    const ready = requireReadyState(getReadyState());
    const bindings = requireBindings(getBindings());
    const integrity = requireIntegrity(getIntegrity());
    return deepFreeze({
      schema: CSSOCCER_PERFORMANCE_TRACE_RUNTIME_SCHEMA,
      status: "ready",
      route: "/",
      fixtureId: FIXTURE_ID,
      controlCountry: ready.controlCountry,
      frameCount: FRAME_COUNT,
      measurement: CSSOCCER_PERFORMANCE_MEASUREMENT,
      bindings,
      windows: CSSOCCER_PERFORMANCE_TRACE_WINDOWS,
      phaseDefinitions: CSSOCCER_PERFORMANCE_PHASE_DEFINITIONS,
      integrity,
    });
  }

  async function run(windowId, markers = {}) {
    if (running) throw new Error("A css.soccer production performance window is already running.");
    if (consumed) throw new Error("A css.soccer production performance page may run only one retained window.");
    if (typeof windowId !== "string" || windowId.length === 0) {
      throw new TypeError("css.soccer production performance window id is required.");
    }
    const selected = CSSOCCER_PERFORMANCE_TRACE_WINDOWS.find(({ id }) => id === windowId);
    if (!selected) throw new Error(`Unknown css.soccer production performance window ${windowId}.`);
    const raf = requireFunction(requestAnimationFrameImpl, "requestAnimationFrame");
    const clock = requireClock(performanceImpl);
    const timestamp = requireTimestamp(consoleImpl);
    const { startMarker, endMarker } = requireMarkers(markers);
    const acceptedContract = contract();
    running = true;
    try {
      // Product startup publishes tick zero immediately, then the fixed-step rAF
      // loop presents it until the first 50 ms simulation boundary. Reproduce
      // that same route before opening the retained trace marker.
      for (let tick = 0; tick <= selected.startTick; tick += 1) {
        const result = await maybeAwait(stepProductTick());
        requireProductTick(result, tick);
      }

      // Fast-forwarding is intentionally outside the measured marker. Cross one
      // animation-frame boundary before tracing the directly published state.
      let settleStarted = await nextAnimationFrame(raf);
      let priorRafTimestamp = settleStarted;
      while (
        priorRafTimestamp - settleStarted
        <= acceptedContract.measurement.presentationInterpolationMs
      ) {
        priorRafTimestamp = await nextAnimationFrame(raf);
      }
      const baseline = await maybeAwait(beginProductFrameTrace(priorRafTimestamp));
      requireProductFrameBaseline(baseline, selected.startTick, acceptedContract.measurement);

      timestamp(startMarker);
      const samples = [];
      let priorTick = selected.startTick;
      for (let frame = 0; frame < selected.frameCount; frame += 1) {
        requireReadyState(getReadyState());
        const rafTimestamp = await nextAnimationFrame(raf);
        const stepStarted = clock.now();
        const productFrame = await maybeAwait(stepProductFrame(rafTimestamp));
        const stepCallMs = clock.now() - stepStarted;
        requireProductFrame(productFrame, priorTick, acceptedContract.measurement);
        const frameMs = rafTimestamp - priorRafTimestamp;
        samples.push(deepFreeze({
          frame,
          tick: productFrame.tick,
          simulationSteps: productFrame.simulationSteps,
          residencyTransition: productFrame.residencyTransition,
          elapsedMs: frameMs + (samples.at(-1)?.elapsedMs ?? 0),
          frameMs,
          stepCallMs,
          productSimulationMs: productFrame.productSimulationMs,
          phases: {
            productAnimationFrame: stepCallMs,
            productSimulation: productFrame.productSimulationMs,
          },
          cameraPhases: {
            preparedLivePublication: productFrame.preparedLivePublicationMs,
          },
        }));
        priorTick = productFrame.tick;
        priorRafTimestamp = rafTimestamp;
      }
      timestamp(endMarker);
      consumed = true;
      const integrity = requireIntegrity(getIntegrity());
      const measuredWindow = deepFreeze({
        ...selected,
        endTick: samples.at(-1).tick,
      });
      return deepFreeze({
        schema: CSSOCCER_PERFORMANCE_TRACE_RESULT_SCHEMA,
        status: "complete",
        fixtureId: FIXTURE_ID,
        measurement: acceptedContract.measurement,
        window: measuredWindow,
        bindings: acceptedContract.bindings,
        samples,
        integrity,
      });
    } finally {
      running = false;
    }
  }

  return Object.freeze({
    schema: CSSOCCER_PERFORMANCE_TRACE_RUNTIME_SCHEMA,
    contract,
    run,
  });
}

function requireProductTick(value, tick) {
  if (!isPlainObject(value) || value.frame?.tick !== tick) {
    throw new Error(`css.soccer performance product setup did not publish tick ${tick}.`);
  }
  return value;
}

function requireProductFrameBaseline(value, tick, measurement) {
  if (
    !isPlainObject(value)
    || value.tick !== tick
    || value.presentationInterpolationMs !== measurement.presentationInterpolationMs
  ) {
    throw new Error(`css.soccer performance product frame baseline did not settle at tick ${tick}.`);
  }
  return value;
}

function requireProductFrame(value, priorTick, measurement) {
  if (
    !isPlainObject(value)
    || !Number.isSafeInteger(value.tick)
    || value.tick < priorTick
    || !Number.isSafeInteger(value.simulationSteps)
    || value.simulationSteps < 0
    || value.simulationSteps > measurement.maxSimulationStepsPerFrame
    || value.tick - priorTick !== value.simulationSteps
    || typeof value.residencyTransition !== "boolean"
  ) {
    throw new Error("css.soccer performance product frame drifted from the fixed-step scheduler.");
  }
  finiteNonNegative(value.productSimulationMs, "product frame simulation timing");
  finiteNonNegative(value.preparedLivePublicationMs, "product frame publication timing");
  return value;
}

function requireReadyState(value) {
  if (
    !isPlainObject(value)
    || value.ready !== true
    || value.status !== "ready"
    || value.fixtureId !== FIXTURE_ID
    || !["spain", "argentina"].includes(value.controlCountry)
  ) {
    throw new Error("css.soccer performance tracing requires the ready canonical two-team route.");
  }
  return value;
}

function requireIntegrity(value) {
  if (
    !isPlainObject(value)
    || value.rootCount !== 37
    || value.skyBackdropRootCount !== 1
    || value.playerRootCount !== 22
    || value.officialRootCount !== 3
    || value.exactOfficialRootCount !== 3
    || value.stableIdentityCount !== 37
    || value.connectedRootCount !== 37
    || value.pageErrorCount !== 0
    || value.nativeRequestCount !== 0
    || value.presentationInterpolationMs !== CSSOCCER_PERFORMANCE_MEASUREMENT.presentationInterpolationMs
    || value.presentationCameraInterpolated !== false
    || value.presentationInterpolatedRootCount !== 0
    || !Number.isSafeInteger(value.packedFrameStyleFrameSetCount)
    || value.packedFrameStyleFrameSetCount < 0
    || !Number.isSafeInteger(value.packedFrameStyleLoadedChunkCount)
    || value.packedFrameStyleLoadedChunkCount < 0
    || !Number.isSafeInteger(value.packedFrameStyleChunkLimitPerFrameSet)
    || value.packedFrameStyleChunkLimitPerFrameSet <= 0
    || value.packedFrameStyleChunkOverflowCount !== 0
    || !isPlainObject(value.runtimeConstruction)
    || Object.values(value.runtimeConstruction).some((count) => count !== 0)
  ) {
    throw new Error("css.soccer production performance integrity requires 37 stable roots, 22 players, three exact officials, bounded frame styles, and zero errors or construction.");
  }
  return deepFreeze(clone(value));
}

function requireBindings(value) {
  if (!isPlainObject(value)) throw new TypeError("css.soccer performance bindings must be a plain object.");
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...BINDING_KEYS].sort())) {
    throw new Error("css.soccer performance bindings must use the current free-play binding set.");
  }
  if (!/^[a-f0-9]{40}$/u.test(value.sourceRevision ?? "")) {
    throw new Error("css.soccer performance source revision must be pinned.");
  }
  for (const key of BINDING_KEYS.filter((key) => key !== "sourceRevision")) {
    if (!SHA256.test(value[key] ?? "")) {
      throw new Error(`css.soccer performance ${key} must be SHA-256.`);
    }
  }
  return deepFreeze(clone(value));
}

function requireMarkers(value) {
  if (
    !isPlainObject(value)
    || typeof value.startMarker !== "string"
    || value.startMarker.length === 0
    || typeof value.endMarker !== "string"
    || value.endMarker.length === 0
    || value.startMarker === value.endMarker
  ) {
    throw new Error("css.soccer production performance run requires unique trace markers.");
  }
  return value;
}

function requireClock(value) {
  if (!value || typeof value.now !== "function") {
    throw new Error("css.soccer production performance run requires performance.now().");
  }
  return value;
}

function requireTimestamp(value) {
  if (!value || typeof value.timeStamp !== "function") {
    throw new Error("css.soccer production performance run requires console.timeStamp().");
  }
  return value.timeStamp.bind(value);
}

function finiteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`css.soccer ${label} must be finite and non-negative.`);
  }
  return value;
}

function nextAnimationFrame(raf) {
  return new Promise((resolve) => raf(resolve));
}

function maybeAwait(value) {
  return value && typeof value.then === "function" ? value : Promise.resolve(value);
}

function requireFunction(value, label) {
  if (typeof value !== "function") throw new TypeError(`css.soccer ${label} must be a function.`);
  return value;
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

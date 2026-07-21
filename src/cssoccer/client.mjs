import {
  CSSOCCER_BROWSER_CONTROL,
  applyCssoccerBrowserKey,
  applyCssoccerBrowserPointer,
  createCssoccerBrowserInputCommand,
  createCssoccerBrowserInputState,
  isCssoccerDebugKey,
  isCssoccerGameplayKey,
  releaseAllCssoccerBrowserInput,
  releaseCssoccerBrowserPointer,
  setCssoccerBrowserInputFocus,
  setCssoccerBrowserInputPaused,
} from "./browserInput.mjs";
import { createCssoccerFreePlayEngine } from "./freePlayEngine.mjs";
import {
  createCssoccerFreePlayRematchState,
  createCssoccerFreePlayState,
} from "./freePlayState.mjs";
import {
  installCssoccerDebugApi,
  uninstallCssoccerDebugApi,
} from "./debugApi.mjs";
import { createCssoccerDebugTools } from "./debugTools.mjs";
import { requireControlCountry } from "./fixtureContract.mjs";
import {
  createCssoccerNativeHudState,
  createCssoccerNativeHudView,
  projectCssoccerNormalTimeHudClock,
} from "./nativeHudView.mjs";
import {
  createCssoccerPreparedRequestAudit,
  loadPreparedAnimationFrameStyles,
  loadPreparedManifest,
  loadPreparedMatchScene,
} from "./manifestClient.mjs";
import {
  createCssoccerFreePlayRenderFrame,
  createCssoccerPlayerRenderContract,
} from "./playerRenderState.mjs";
import {
  mountPreparedMatchScene,
} from "./polycssScene.mjs";
import {
  createCssoccerPerformanceTraceRuntime,
} from "./performanceTraceRuntime.mjs";
import { createCssoccerRouteState } from "./routeState.mjs";

const FIXED_STEP_MILLISECONDS = 50;
const MAX_STEPS_PER_ANIMATION_FRAME = 5;
const CONTROL_COUNTRY_ORDER = Object.freeze(["spain", "argentina"]);
const TOUCH_CONTROL_ORDER = Object.freeze([
  CSSOCCER_BROWSER_CONTROL.MOVE_UP,
  CSSOCCER_BROWSER_CONTROL.MOVE_LEFT,
  CSSOCCER_BROWSER_CONTROL.MOVE_DOWN,
  CSSOCCER_BROWSER_CONTROL.MOVE_RIGHT,
  CSSOCCER_BROWSER_CONTROL.FIRE_1,
  CSSOCCER_BROWSER_CONTROL.FIRE_2,
]);
export function mountCssoccerClient({
  document: documentImpl = globalThis.document,
  window: windowImpl = globalThis.window,
  fetchImpl = globalThis.fetch,
  createMatchState = createCssoccerFreePlayState,
  resetMatchState = createCssoccerFreePlayRematchState,
  createEngine = createCssoccerFreePlayEngine,
  consumeInputCommand = () => undefined,
  liveScheduler = false,
} = {}) {
  if (!documentImpl || !windowImpl) {
    throw new Error("css.soccer requires a browser document and window.");
  }
  requireFunction(createMatchState, "createMatchState");
  requireFunction(resetMatchState, "resetMatchState");
  requireFunction(createEngine, "createEngine");
  requireFunction(consumeInputCommand, "consumeInputCommand");
  if (typeof liveScheduler !== "boolean") {
    throw new TypeError("css.soccer liveScheduler must be boolean.");
  }

  const sceneHost = documentImpl.getElementById("scene");
  const countryChoiceHost = documentImpl.getElementById("country-choice");
  const hudHost = documentImpl.getElementById("match-hud");
  const touchHost = documentImpl.getElementById("touch-controls");
  const statusHost = documentImpl.getElementById("status");
  if (!sceneHost || !countryChoiceHost || !hudHost || !touchHost || !statusHost) {
    throw new Error(
      "css.soccer requires #scene, #country-choice, #match-hud, #touch-controls, and #status on its one route.",
    );
  }

  const countryChoiceButtons = requireCountryChoices(countryChoiceHost);
  const touchButtons = requireTouchControls(touchHost);
  const state = {
    ready: false,
    status: "booting",
    route: null,
    manifest: null,
    sceneData: null,
    preparedFacts: null,
    renderAssets: null,
    exactPlayerAssets: null,
    exactOfficialAssets: null,
    matchState: null,
    engine: null,
    playerRenderContract: null,
    controlCountry: null,
    mount: null,
    inputState: createCssoccerBrowserInputState(),
    inputMode: detectInputMode(windowImpl),
    hudState: null,
    lastInputCommand: null,
    liveFrame: null,
    liveScheduler: null,
    requestAudit: createCssoccerPreparedRequestAudit(),
    errors: [],
  };
  const performanceFrameScheduler = {
    accumulator: 0,
    lastTimestamp: null,
    previousInput: null,
  };
  let performanceInitialFramePublished = false;
  let countryChoiceWaiter = null;
  let startPromise = null;
  let rematchPromise = null;
  let destroyed = false;
  let visualCaptureDepth = 0;

  const hudView = createCssoccerNativeHudView({ host: hudHost });
  const debugTools = createCssoccerDebugTools({
    state,
    sceneHost,
    document: documentImpl,
    window: windowImpl,
    fixedStepMilliseconds: FIXED_STEP_MILLISECONDS,
  });
  const performanceTraceRuntime = createCssoccerPerformanceTraceRuntime({
    getReadyState: performanceReadyState,
    getBindings: performanceBindings,
    getIntegrity: performanceIntegrity,
    stepProductTick: performanceStepProductTick,
    beginProductFrameTrace: beginPerformanceProductFrameTrace,
    stepProductFrame: stepPerformanceProductFrame,
    requestAnimationFrameImpl: windowImpl.requestAnimationFrame?.bind(windowImpl),
    performanceImpl: windowImpl.performance,
    consoleImpl: windowImpl.console,
  });
  const removeInputListeners = installInputListeners();
  const debugApi = installCssoccerDebugApi(
    state,
    {
      debugTools,
      performanceTraceRuntime,
      visualCaptureRuntime: Object.freeze({
        begin: beginVisualCapture,
        advanceToTick: advanceVisualCaptureToTick,
        end: endVisualCapture,
        state: visualCaptureState,
      }),
    },
    windowImpl,
  );
  const onPageHide = () => destroy();
  const onWindowError = (event) => {
    recordError(event.message || String(event.error || "page error"));
  };
  const onUnhandledRejection = (event) => {
    recordError(String(event.reason?.message || event.reason || "unhandled rejection"));
  };
  windowImpl.addEventListener("pagehide", onPageHide);
  windowImpl.addEventListener("error", onWindowError);
  windowImpl.addEventListener("unhandledrejection", onUnhandledRejection);

  const boot = main().catch((error) => {
    recordError(error);
    return null;
  });

  async function main() {
    documentImpl.body.dataset.productView = "1";
    documentImpl.body.dataset.portSlug = "cssoccer";
    documentImpl.body.dataset.release = "full-match-alpha";
    state.route = createCssoccerRouteState(windowImpl.location?.search ?? "");
    documentImpl.body.dataset.fixtureId = state.route.fixtureId;
    setStatus("loading-manifest", "Loading prepared Spain vs Argentina match…");
    state.manifest = await loadPreparedManifest(
      state.route,
      fetchImpl,
      state.requestAudit,
    );
    if (destroyed) return null;
    return waitForCountryChoice();
  }

  function waitForCountryChoice() {
    if (countryChoiceWaiter !== null) {
      throw new Error("css.soccer is already waiting for one team choice.");
    }
    setStatus("choosing-country", "Choose Spain or Argentina");
    countryChoiceHost.hidden = false;
    countryChoiceHost.setAttribute("aria-busy", "false");
    for (const button of countryChoiceButtons) button.disabled = false;
    countryChoiceButtons[0].focus?.({ preventScroll: true });
    return new Promise((resolve, reject) => {
      countryChoiceWaiter = { resolve, reject };
    });
  }

  function chooseControlCountry(country) {
    if (destroyed || state.status !== "choosing-country" || countryChoiceWaiter === null) return;
    const accepted = requireControlCountry(country);
    const waiter = countryChoiceWaiter;
    countryChoiceWaiter = null;
    countryChoiceHost.setAttribute("aria-busy", "true");
    for (const button of countryChoiceButtons) button.disabled = true;
    countryChoiceHost.hidden = true;
    startFixture(accepted).then(waiter.resolve, waiter.reject);
  }

  async function startFixture(country) {
    if (destroyed) throw new Error("css.soccer client has been destroyed.");
    if (startPromise) return startPromise;
    startPromise = (async () => {
      state.controlCountry = country;
      documentImpl.body.dataset.controlCountry = country;
      setStatus("loading-scene", "Loading prepared match scene…");
      const {
        entry,
        sceneData,
        renderAssets,
        exactPlayerAssets,
        exactOfficialAssets,
        preparedFacts,
      } = await loadPreparedMatchScene(
        state.manifest,
        state.route,
        fetchImpl,
        state.requestAudit,
      );
      const initialAnimationFrames = sceneData.meshes
        .filter(({ kind, frameSetId }) => frameSetId !== null && kind !== "player")
        .map(({ frameSetId, initialFrameIndex }) => ({
          frameSetId,
          frameIndex: initialFrameIndex,
        }));
      documentImpl.body.dataset.cssoccerAnimationStyles = initialAnimationFrames.length > 0
        ? "loading"
        : "inline";
      const initialStyleFileCount = await loadPreparedAnimationFrameStyles(
        renderAssets,
        initialAnimationFrames,
      );
      documentImpl.body.dataset.cssoccerAnimationStyles = initialStyleFileCount > 0
        ? "ready"
        : "inline";
      if (destroyed) throw new Error("css.soccer client was destroyed while loading.");
      state.sceneData = sceneData;
      state.preparedFacts = preparedFacts;
      state.renderAssets = renderAssets;
      state.exactPlayerAssets = exactPlayerAssets;
      state.exactOfficialAssets = exactOfficialAssets;
      state.matchState = createMatchState({
        preparedFacts,
        preparedScene: sceneData,
        controlCountry: country,
      });
      requireMatchCountry(state.matchState, country, "created match state");
      initializeFreePlayEngine();
      ensurePlayerRenderContract();
      const initialLiveFrame = createCssoccerFreePlayRenderFrame(
        state.playerRenderContract,
        { snapshot: state.engine.snapshot() },
      );
      setStatus("loading-player-animation", "Loading initial exact Actua actor poses…");
      await Promise.all([
        exactPlayerAssets.preloadMany(exactPlayerFrameRequests(initialLiveFrame)),
        exactOfficialAssets.preloadMany(exactOfficialFrameRequests(initialLiveFrame)),
      ]);
      documentImpl.body.dataset.sceneId = entry.id;
      setStatus("mounting", "Mounting prepared PolyCSS match…");
      state.mount = await mountPreparedMatchScene({
        host: sceneHost,
        sceneData,
        renderAssets,
        exactPlayerAssets,
        exactOfficialAssets,
        initialLiveFrame,
      });
      if (destroyed) throw new Error("css.soccer client was destroyed while mounting.");
      publishCurrentSnapshot();
      state.ready = true;
      renderHud();
      sceneHost.focus?.({ preventScroll: true });
      if (shouldRunLiveScheduler()) startLiveScheduler();
      setStatus("ready", "Match ready");
      return country;
    })().catch((error) => {
      state.ready = false;
      state.controlCountry = null;
      state.matchState = null;
      state.engine = null;
      state.playerRenderContract = null;
      state.exactPlayerAssets = null;
      state.exactOfficialAssets = null;
      state.hudState = null;
      state.liveFrame = null;
      hudHost.hidden = true;
      delete documentImpl.body.dataset.controlCountry;
      startPromise = null;
      recordError(error);
      throw error;
    });
    return startPromise;
  }

  function installInputListeners() {
    const listeners = [];
    const listen = (target, type, listener, options) => {
      target.addEventListener(type, listener, options);
      listeners.push(() => target.removeEventListener(type, listener, options));
    };

    for (const button of countryChoiceButtons) {
      listen(button, "click", () => chooseControlCountry(button.dataset.countryChoice));
    }

    listen(windowImpl, "keydown", (event) => {
      if (destroyed || hasBrowserShortcutModifier(event)) return;
      if (isInteractiveTarget(event.target)) return;
      if (isCssoccerDebugKey(event.code)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        if (!event.repeat) debugTools.toggleVisible();
        return;
      }
      if (!state.ready) return;
      if (event.code === "Enter" && state.liveFrame?.terminal) {
        event.preventDefault();
        if (!event.repeat) rematch().catch(recordError);
        return;
      }
      if (event.code === "Escape") {
        event.preventDefault();
        if (event.repeat) return;
        setPaused(!state.inputState.paused);
        return;
      }
      if (!isCssoccerGameplayKey(event.code)) return;
      event.preventDefault();
      if (event.repeat || state.inputState.keyboardCodes.includes(event.code)) return;
      setInputMode("keyboard");
      const nextInputState = applyCssoccerBrowserKey(state.inputState, {
        code: event.code,
        pressed: true,
      });
      if (nextInputState === state.inputState) return;
      state.inputState = nextInputState;
      debugTools.recordEvent("keyboard-input", {
        code: event.code,
        pressed: true,
        keyboardCodes: [...state.inputState.keyboardCodes],
      });
      publishInputCommand();
    });
    listen(windowImpl, "keyup", (event) => {
      if (destroyed) return;
      if (isCssoccerDebugKey(event.code) && !isInteractiveTarget(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }
      if (!state.ready) return;
      if (!isCssoccerGameplayKey(event.code)) return;
      if (!state.inputState.keyboardCodes.includes(event.code)) return;
      event.preventDefault();
      state.inputState = applyCssoccerBrowserKey(state.inputState, {
        code: event.code,
        pressed: false,
      });
      debugTools.recordEvent("keyboard-input", {
        code: event.code,
        pressed: false,
        keyboardCodes: [...state.inputState.keyboardCodes],
      });
      publishInputCommand();
    });
    listen(windowImpl, "blur", () => {
      if (state.ready && !destroyed) setFocused(false);
    });
    listen(windowImpl, "focus", () => {
      if (state.ready && !destroyed) setFocused(true);
    });
    listen(documentImpl, "visibilitychange", () => {
      if (state.ready && !destroyed && documentImpl.visibilityState === "hidden") {
        setFocused(false);
      }
    });

    for (const button of touchButtons) {
      listen(button, "pointerdown", (event) => {
        if (!state.ready || destroyed || !isPointerId(event.pointerId)) return;
        event.preventDefault();
        setInputMode("touch");
        try {
          button.setPointerCapture?.(event.pointerId);
        } catch {
          // Global release still neutralizes a pointer that ends before capture.
        }
        state.inputState = applyCssoccerBrowserPointer(state.inputState, {
          control: button.dataset.cssoccerControl,
          pointerId: event.pointerId,
          pressed: true,
        });
        debugTools.recordEvent("pointer-input", {
          control: button.dataset.cssoccerControl,
          pointerId: event.pointerId,
          pressed: true,
        });
        renderTouchControls();
        publishInputCommand();
      });
      listen(button, "lostpointercapture", releasePointer);
      listen(button, "contextmenu", (event) => event.preventDefault());
    }
    listen(windowImpl, "pointerup", releasePointer);
    listen(windowImpl, "pointercancel", releasePointer);

    return () => {
      for (const remove of listeners.splice(0).reverse()) remove();
    };
  }

  function releasePointer(event) {
    if (!state.ready || destroyed || !isPointerId(event.pointerId)) return;
    if (!state.inputState.pointers.some(({ pointerId }) => pointerId === event.pointerId)) return;
    event.preventDefault?.();
    state.inputState = releaseCssoccerBrowserPointer(state.inputState, {
      pointerId: event.pointerId,
    });
    debugTools.recordEvent("pointer-input", {
      pointerId: event.pointerId,
      pressed: false,
    });
    renderTouchControls();
    publishInputCommand();
  }

  function setPaused(paused) {
    state.inputState = setCssoccerBrowserInputPaused(state.inputState, paused);
    debugTools.recordEvent("pause-change", { paused });
    documentImpl.body.dataset.matchPaused = String(paused);
    renderTouchControls();
    publishInputCommand();
  }

  function setFocused(focused) {
    if (state.inputState.focused === focused) return;
    state.inputState = setCssoccerBrowserInputFocus(state.inputState, focused);
    debugTools.recordEvent("focus-change", { focused });
    documentImpl.body.dataset.matchFocused = String(focused);
    renderTouchControls();
    publishInputCommand();
  }

  function setInputMode(mode) {
    if (state.inputMode === mode) return;
    state.inputMode = mode;
    documentImpl.body.dataset.inputMode = mode;
  }

  function publishInputCommand() {
    if (!state.ready || !state.matchState || destroyed) return null;
    if (state.liveScheduler !== null) return state.lastInputCommand;
    const emitted = createCssoccerBrowserInputCommand(state.inputState, {
      tick: state.matchState.tick,
      movementBasis: state.mount.gameplayInputBasis(),
    });
    state.lastInputCommand = emitted.command;
    consumeCommand(emitted.command);
    return emitted.command;
  }

  function shouldRunLiveScheduler() {
    return liveScheduler
      && windowImpl.__cssoccerDisableLiveScheduler !== true;
  }

  function startLiveScheduler() {
    if (state.liveScheduler !== null) return;
    if (!state.engine || !state.mount || !state.liveFrame) {
      throw new Error("css.soccer live scheduling requires its free-play engine and mounted scene.");
    }
    const requestFrame = windowImpl.requestAnimationFrame?.bind(windowImpl);
    const cancelFrame = windowImpl.cancelAnimationFrame?.bind(windowImpl);
    requireFunction(requestFrame, "requestAnimationFrame");
    requireFunction(cancelFrame, "cancelAnimationFrame");
    ensurePlayerRenderContract();
    const scheduler = {
      accumulator: 0,
      animationFrameId: null,
      lastTimestamp: null,
      previousInput: null,
      requestFrame,
      cancelFrame,
      pendingTick: null,
      stopped: false,
    };
    state.liveScheduler = scheduler;
    if (!state.liveFrame.terminal) scheduleAnimationFrame();
  }

  function scheduleAnimationFrame() {
    const scheduler = state.liveScheduler;
    if (
      scheduler === null
      || scheduler.stopped
      || scheduler.animationFrameId !== null
      || scheduler.pendingTick !== null
    ) return;
    scheduler.animationFrameId = scheduler.requestFrame(onAnimationFrame);
  }

  function onAnimationFrame(timestamp) {
    const scheduler = state.liveScheduler;
    if (scheduler === null || scheduler.stopped || destroyed) return;
    scheduler.animationFrameId = null;
    const recording = debugTools.isRecording();
    const callbackStarted = recording ? monotonicNow() : 0;
    const startTick = state.liveFrame?.tick ?? null;
    let advanced;
    try {
      advanced = advanceProductFrameScheduler(scheduler, timestamp, {
        active: visualCaptureDepth === 0
          && !state.inputState.paused
          && state.inputState.focused,
        isTerminal: () => state.liveFrame.terminal,
        step: publishLiveTick,
      });
    } catch (error) {
      stopLiveScheduler();
      recordError(error);
      return;
    }
    if (recording) {
      debugTools.recordAnimationFrame({
        timestamp,
        callbackMs: monotonicNow() - callbackStarted,
        simulationSteps: advanced.steps,
        elapsedMs: advanced.elapsed,
        accumulatorMs: advanced.accumulator,
        startTick,
        endTick: state.liveFrame?.tick ?? null,
      });
    }
    if (!state.liveFrame.terminal) scheduleAnimationFrame();
    else stopLiveScheduler();
  }

  function publishLiveTick() {
    const scheduler = state.liveScheduler;
    if (scheduler === null || scheduler.stopped) {
      throw new Error("css.soccer live tick requires an active scheduler.");
    }
    const transaction = prepareProductTick(scheduler.previousInput);
    if (transaction.missingExactStates.length === 0) {
      const published = transaction.commit();
      scheduler.previousInput = published.input;
      return published.frame;
    }
    scheduler.pendingTick = transaction;
    preloadExactTransaction(transaction).then(() => {
      if (destroyed || scheduler.stopped || scheduler.pendingTick !== transaction) return;
      const published = transaction.commit();
      scheduler.previousInput = published.input;
      scheduler.pendingTick = null;
      if (!published.frame.terminal) scheduleAnimationFrame();
      else stopLiveScheduler();
    }).catch((error) => {
      if (scheduler.pendingTick === transaction) scheduler.pendingTick = null;
      stopLiveScheduler();
      recordError(error);
    });
    return null;
  }

  function publishCurrentSnapshot() {
    if (!state.engine || !state.mount) {
      throw new Error("css.soccer current publication requires the free-play engine and mounted scene.");
    }
    const snapshot = state.engine.snapshot();
    const frame = createCssoccerFreePlayRenderFrame(ensurePlayerRenderContract(), { snapshot });
    state.mount.applyLiveRenderFrame(frame);
    state.matchState = snapshot.match;
    state.liveFrame = frame;
    return frame;
  }

  function publishProductTick(previousInput) {
    const transaction = prepareProductTick(previousInput);
    if (transaction.missingExactStates.length > 0) {
      const missing = transaction.missingExactStates[0];
      throw new Error(
        `Full Match Alpha requested non-resident Actua animation ${missing.slotId}:${missing.localFrameIndex}.`,
      );
    }
    return transaction.commit();
  }

  function prepareProductTick(previousInput) {
    const now = debugTools.isRecording() || windowImpl.__cssoccerDisableLiveScheduler === true
      ? monotonicNow
      : null;
    const simulationStarted = now?.() ?? 0;
    const emitted = createCssoccerBrowserInputCommand(state.inputState, {
      tick: state.engine.snapshot().tick,
      previousInput,
      movementBasis: state.mount.gameplayInputBasis(),
    });
    const snapshot = state.engine.step(emitted.command);
    const frame = createCssoccerFreePlayRenderFrame(state.playerRenderContract, {
      snapshot,
    });
    const productSimulationMs = now === null ? 0 : now() - simulationStarted;
    const exactPlayerStates = exactPlayerFrameRequests(frame);
    const exactOfficialStates = exactOfficialFrameRequests(frame);
    const missingExactStates = [
      ...exactPlayerStates.filter((request) => !state.exactPlayerAssets.has(request))
        .map((request) => ({ ...request, actorKind: "player" })),
      ...exactOfficialStates.filter((request) => !state.exactOfficialAssets.has(request))
        .map((request) => ({ ...request, actorKind: "official" })),
    ];
    let committed = false;
    const commit = () => {
      if (committed) throw new Error("Full Match Alpha tick transaction was already committed.");
      const unresolved = [
        ...exactPlayerFrameRequests(frame)
          .filter((request) => !state.exactPlayerAssets.has(request))
          .map((request) => ({ ...request, actorKind: "player" })),
        ...exactOfficialFrameRequests(frame)
          .filter((request) => !state.exactOfficialAssets.has(request))
          .map((request) => ({ ...request, actorKind: "official" })),
      ][0];
      if (unresolved) {
        throw new Error(
          `Full Match Alpha cannot commit non-resident Actua animation ${unresolved.slotId}:${unresolved.localFrameIndex}.`,
        );
      }
      committed = true;
      const publicationStarted = now?.() ?? 0;
      state.mount.applyLiveRenderFrame(frame);
      state.matchState = snapshot.match;
      state.lastInputCommand = emitted.command;
      state.liveFrame = frame;
      consumeCommand(emitted.command);
      renderHud();
      const preparedLivePublicationMs = now === null ? 0 : now() - publicationStarted;
      const published = Object.freeze({
        frame,
        command: emitted.command,
        input: emitted.input,
        markers: Object.freeze({
          kickoff: snapshot.match.kickoff.phase,
          matchMode: snapshot.match.rules.matchMode,
          setPiece: snapshot.match.rules.setPiece,
          gameAction: snapshot.match.rules.gameAction,
          deadBallCount: snapshot.match.rules.deadBallCount,
        }),
        timings: Object.freeze({ productSimulationMs, preparedLivePublicationMs }),
      });
      debugTools.recordProductTick(published);
      return published;
    };
    return Object.freeze({
      frame,
      exactPlayerStates: Object.freeze(exactPlayerStates),
      exactOfficialStates: Object.freeze(exactOfficialStates),
      missingExactStates: Object.freeze(missingExactStates),
      commit,
    });
  }

  function preloadExactTransaction(transaction) {
    return Promise.all([
      state.exactPlayerAssets.preloadMany(transaction.exactPlayerStates),
      state.exactOfficialAssets.preloadMany(transaction.exactOfficialStates),
    ]);
  }

  function performanceReadyState() {
    return {
      ready: state.ready,
      status: state.status,
      fixtureId: state.route?.fixtureId ?? null,
      controlCountry: state.controlCountry,
    };
  }

  function performanceBindings() {
    if (!state.matchState) {
      throw new Error("css.soccer performance tracing requires a current match binding.");
    }
    return { ...state.matchState.bindings };
  }

  function performanceIntegrity() {
    if (!state.mount) {
      throw new Error("css.soccer performance tracing requires the mounted prepared scene.");
    }
    const mount = state.mount.stats();
    const packed = mount.packedFrameStyles;
    return {
      rootCount: mount.rootCount,
      skyBackdropRootCount: mount.skyBackdropRootCount,
      playerRootCount: mount.playerRootCount,
      officialRootCount: mount.officialRootCount,
      exactOfficialRootCount: mount.exactOfficialRootCount,
      stableIdentityCount: mount.stableIdentityCount,
      connectedRootCount: mount.connectedRootCount,
      pageErrorCount: state.errors.length,
      nativeRequestCount: state.requestAudit.snapshot().nativeRequestCount,
      presentationInterpolationMs: mount.presentationInterpolationMs,
      presentationCameraInterpolated: mount.presentationCameraInterpolated,
      presentationInterpolatedRootCount: mount.presentationInterpolatedRootCount,
      packedFrameStyleFrameSetCount: packed.frameSetCount,
      packedFrameStyleLoadedChunkCount: packed.loadedChunkCount,
      packedFrameStyleChunkLimitPerFrameSet: packed.chunkLimitPerFrameSet,
      packedFrameStyleChunkOverflowCount: Math.max(
        0,
        packed.loadedChunkCount - packed.frameSetCount * packed.chunkLimitPerFrameSet,
      ),
      runtimeConstruction: { ...mount.runtimeConstruction },
    };
  }

  async function performanceStepProductTick() {
    requirePerformanceTracePage();
    if (!performanceInitialFramePublished) {
      performanceInitialFramePublished = true;
      return Object.freeze({
        frame: state.liveFrame,
        command: null,
        input: null,
        markers: null,
        timings: Object.freeze({
          productSimulationMs: 0,
          preparedLivePublicationMs: 0,
        }),
      });
    }
    const published = await publishPerformanceProductTick(performanceFrameScheduler.previousInput);
    performanceFrameScheduler.previousInput = published.input;
    return published;
  }

  function beginPerformanceProductFrameTrace(timestamp) {
    requirePerformanceTracePage();
    requireFrameTimestamp(timestamp);
    performanceFrameScheduler.accumulator = 0;
    performanceFrameScheduler.lastTimestamp = timestamp;
    return Object.freeze({
      tick: state.liveFrame.tick,
      presentationInterpolationMs: state.mount.stats().presentationInterpolationMs,
    });
  }

  async function stepPerformanceProductFrame(timestamp) {
    requirePerformanceTracePage();
    let productSimulationMs = 0;
    let preparedLivePublicationMs = 0;
    const advanced = await advanceAsyncProductFrameScheduler(
      performanceFrameScheduler,
      timestamp,
      {
        active: true,
        isTerminal: () => state.liveFrame.terminal,
        step: async () => {
          const published = await publishPerformanceProductTick(
            performanceFrameScheduler.previousInput,
          );
          performanceFrameScheduler.previousInput = published.input;
          productSimulationMs += published.timings.productSimulationMs;
          preparedLivePublicationMs += published.timings.preparedLivePublicationMs;
          return published.frame;
        },
      },
    );
    return Object.freeze({
      tick: state.liveFrame.tick,
      simulationSteps: advanced.steps,
      productSimulationMs,
      preparedLivePublicationMs,
    });
  }

  async function publishPerformanceProductTick(previousInput) {
    const transaction = prepareProductTick(previousInput);
    if (transaction.missingExactStates.length > 0) {
      await preloadExactTransaction(transaction);
    }
    return transaction.commit();
  }

  function requirePerformanceTracePage() {
    if (
      windowImpl.__cssoccerDisableLiveScheduler !== true
      || state.liveScheduler !== null
      || !state.ready
      || !state.engine
      || !state.liveFrame
    ) {
      throw new Error(
        "css.soccer performance tracing requires one ready scheduler-disabled canonical page.",
      );
    }
  }

  function monotonicNow() {
    return typeof windowImpl.performance?.now === "function"
      ? windowImpl.performance.now()
      : Date.now();
  }

  function ensurePlayerRenderContract() {
    state.playerRenderContract ??= createCssoccerPlayerRenderContract({
      preparedFacts: state.preparedFacts,
      renderAssets: state.renderAssets,
      exactPlayerAssets: state.exactPlayerAssets,
      exactOfficialAssets: state.exactOfficialAssets,
    });
    return state.playerRenderContract;
  }

  function consumeCommand(command) {
    try {
      const result = consumeInputCommand(command);
      if (result && typeof result.then === "function") result.catch(recordError);
    } catch (error) {
      recordError(error);
    }
  }

  function stopLiveScheduler() {
    const scheduler = state.liveScheduler;
    if (scheduler === null || scheduler.stopped) return;
    scheduler.stopped = true;
    if (scheduler.animationFrameId !== null) {
      scheduler.cancelFrame(scheduler.animationFrameId);
      scheduler.animationFrameId = null;
    }
  }

  function beginVisualCapture() {
    if (!state.ready || destroyed || !state.liveFrame) {
      throw new Error("css.soccer visual capture requires a ready live match.");
    }
    visualCaptureDepth += 1;
    documentImpl.body.dataset.visualCaptureFrozen = "true";
    return visualCaptureState();
  }

  async function advanceVisualCaptureToTick(targetTick) {
    if (visualCaptureDepth <= 0) {
      throw new Error("css.soccer visual capture must be frozen before deterministic stepping.");
    }
    if (!Number.isSafeInteger(targetTick) || targetTick < state.liveFrame.tick) {
      throw new RangeError("css.soccer visual capture target tick must not precede the live tick.");
    }
    while (state.liveFrame.tick < targetTick) {
      const published = await performanceStepProductTick();
      if (published.frame.tick > targetTick) {
        throw new Error("css.soccer visual capture stepped past its target tick.");
      }
    }
    return visualCaptureState();
  }

  function endVisualCapture() {
    if (visualCaptureDepth <= 0) {
      throw new Error("css.soccer visual capture is not frozen.");
    }
    visualCaptureDepth -= 1;
    if (visualCaptureDepth === 0) {
      delete documentImpl.body.dataset.visualCaptureFrozen;
    }
    return visualCaptureState();
  }

  function visualCaptureState() {
    return Object.freeze({
      frozen: visualCaptureDepth > 0,
      depth: visualCaptureDepth,
      tick: state.liveFrame?.tick ?? null,
      phase: state.liveFrame?.phase ?? null,
    });
  }

  function renderHud() {
    if (!state.matchState) return null;
    const live = state.liveFrame;
    state.hudState = createCssoccerNativeHudState({
      clock: projectCssoccerNormalTimeHudClock(live?.clock
        ? { minutes: live.clock.minutes, seconds: live.clock.seconds }
        : {
            minutes: state.matchState.clock.gameMinute,
            seconds: state.matchState.clock.gameSecond,
          }),
    });
    documentImpl.body.dataset.matchPaused = String(state.inputState.paused);
    documentImpl.body.dataset.matchFocused = String(state.inputState.focused);
    documentImpl.body.dataset.inputMode = state.inputMode;
    documentImpl.body.dataset.matchTerminal = String(
      live?.terminal ?? state.matchState.clock.terminal === true,
    );
    renderTouchControls();
    return hudView.render(state.hudState);
  }

  function renderTouchControls() {
    const active = new Set(state.inputState.pointers.map(({ control }) => control));
    for (const button of touchButtons) {
      button.setAttribute(
        "aria-pressed",
        String(active.has(button.dataset.cssoccerControl)),
      );
    }
  }

  function rematch() {
    if (rematchPromise) return rematchPromise;
    const terminal = state.liveFrame?.terminal
      ?? state.matchState?.clock?.terminal === true;
    if (!terminal) {
      return Promise.reject(new Error("A cssoccer rematch is available only at full time."));
    }
    rematchPromise = (async () => {
      debugTools.recordEvent("rematch", { previousTick: state.liveFrame?.tick ?? null });
      const nextMatch = resetMatchState(state.matchState, {
        preparedFacts: state.preparedFacts,
        preparedScene: state.sceneData,
      });
      requireMatchCountry(nextMatch, state.controlCountry, "reset match state");
      const nextEngine = createEngine({ initialState: nextMatch });
      const nextPlayerRenderContract = createCssoccerPlayerRenderContract({
        preparedFacts: state.preparedFacts,
        renderAssets: state.renderAssets,
        exactPlayerAssets: state.exactPlayerAssets,
        exactOfficialAssets: state.exactOfficialAssets,
      });
      const nextFrame = createCssoccerFreePlayRenderFrame(nextPlayerRenderContract, {
        snapshot: nextEngine.snapshot(),
      });
      state.ready = false;
      setStatus("loading-player-animation", "Loading rematch exact Actua actor poses…");
      await Promise.all([
        state.exactPlayerAssets.preloadMany(exactPlayerFrameRequests(nextFrame)),
        state.exactOfficialAssets.preloadMany(exactOfficialFrameRequests(nextFrame)),
      ]);
      if (destroyed) throw new Error("css.soccer client was destroyed while loading the rematch.");

      stopLiveScheduler();
      state.liveScheduler = null;
      state.inputState = releaseAllCssoccerBrowserInput(state.inputState);
      renderTouchControls();
      const focused = state.inputState.focused;
      state.inputState = createCssoccerBrowserInputState();
      if (!focused) state.inputState = setCssoccerBrowserInputFocus(state.inputState, false);
      state.mount?.resetLiveRenderState?.();
      state.matchState = nextMatch;
      state.engine = nextEngine;
      state.playerRenderContract = nextPlayerRenderContract;
      state.lastInputCommand = null;
      state.liveFrame = null;
      performanceInitialFramePublished = false;
      performanceFrameScheduler.accumulator = 0;
      performanceFrameScheduler.lastTimestamp = null;
      performanceFrameScheduler.previousInput = null;
      publishCurrentSnapshot();
      state.ready = true;
      if (shouldRunLiveScheduler()) startLiveScheduler();
      else renderHud();
      sceneHost.focus?.({ preventScroll: true });
      setStatus("ready", "Match ready");
      return state.liveFrame;
    })().finally(() => {
      rematchPromise = null;
    });
    return rematchPromise;
  }

  function initializeFreePlayEngine() {
    if (!state.matchState) {
      throw new Error("css.soccer free play requires current browser-owned match state.");
    }
    state.engine = createEngine({ initialState: state.matchState });
  }

  function recordError(error) {
    const message = error instanceof Error
      ? error.stack || error.message
      : String(error || "css.soccer error");
    if (state.errors.at(-1) !== message) state.errors.push(message);
    debugTools.recordEvent("page-error", { message });
    documentImpl.body.dataset.portError = message.split("\n", 1)[0];
    state.ready = false;
    setStatus("error", message.split("\n", 1)[0]);
  }

  function setStatus(kind, message = kind) {
    state.status = kind;
    documentImpl.body.dataset.portStatus = kind;
    statusHost.textContent = message;
    debugTools.sync();
  }

  function destroy() {
    if (destroyed) return;
    stopLiveScheduler();
    if (state.ready && state.matchState) {
      state.inputState = releaseAllCssoccerBrowserInput(state.inputState);
      publishInputCommand();
    }
    destroyed = true;
    if (countryChoiceWaiter !== null) {
      countryChoiceWaiter.resolve(null);
      countryChoiceWaiter = null;
    }
    countryChoiceHost.hidden = true;
    for (const button of countryChoiceButtons) button.disabled = true;
    removeInputListeners();
    windowImpl.removeEventListener("pagehide", onPageHide);
    windowImpl.removeEventListener("error", onWindowError);
    windowImpl.removeEventListener("unhandledrejection", onUnhandledRejection);
    debugTools.destroy();
    hudView.destroy();
    state.mount?.destroy();
    state.exactPlayerAssets?.dispose();
    state.exactOfficialAssets?.dispose();
    state.mount = null;
    state.exactPlayerAssets = null;
    state.exactOfficialAssets = null;
    state.matchState = null;
    state.engine = null;
    state.playerRenderContract = null;
    state.hudState = null;
    state.lastInputCommand = null;
    state.liveFrame = null;
    state.liveScheduler = null;
    visualCaptureDepth = 0;
    state.ready = false;
    setStatus("destroyed", "Match closed");
    delete documentImpl.body.dataset.matchPaused;
    delete documentImpl.body.dataset.matchFocused;
    delete documentImpl.body.dataset.inputMode;
    delete documentImpl.body.dataset.matchTerminal;
    delete documentImpl.body.dataset.portError;
    delete documentImpl.body.dataset.release;
    delete documentImpl.body.dataset.controlCountry;
    delete documentImpl.body.dataset.visualCaptureFrozen;
    uninstallCssoccerDebugApi(debugApi, windowImpl);
  }

  return Object.freeze({ state, boot, destroy });
}

function exactPlayerFrameRequests(frame) {
  if (!Array.isArray(frame?.players?.commands)) {
    throw new Error("Exact Actua residency requires one live player command batch.");
  }
  return frame.players.commands.map(({ animation }) => ({
    slotId: animation.slotId,
    localFrameIndex: animation.frame,
  }));
}

function exactOfficialFrameRequests(frame) {
  if (!Array.isArray(frame?.officials?.commands) || frame.officials.commands.length !== 3) {
    throw new Error("Exact Actua residency requires the referee and both assistant commands.");
  }
  return frame.officials.commands.map(({ animation }) => ({
    slotId: animation.slotId,
    localFrameIndex: animation.frame,
  }));
}

function requireCountryChoices(host) {
  const buttons = [...host.querySelectorAll("[data-country-choice]")];
  const countries = buttons.map(({ dataset }) => dataset.countryChoice);
  if (JSON.stringify(countries) !== JSON.stringify(CONTROL_COUNTRY_ORDER)) {
    throw new Error("css.soccer must expose exactly Spain and Argentina as team choices.");
  }
  for (const button of buttons) {
    if (
      button.tagName !== "BUTTON"
      || button.getAttribute("type") !== "button"
      || !button.getAttribute("aria-label")
    ) {
      throw new Error("css.soccer team choices must be accessible buttons.");
    }
  }
  return buttons;
}

function requireTouchControls(host) {
  const buttons = [...host.querySelectorAll("[data-cssoccer-control]")];
  const controls = buttons.map(({ dataset }) => dataset.cssoccerControl);
  if (JSON.stringify(controls) !== JSON.stringify(TOUCH_CONTROL_ORDER)) {
    throw new Error("css.soccer touch controls must expose the exact six accepted controls.");
  }
  for (const button of buttons) {
    if (
      button.tagName !== "BUTTON"
      || button.getAttribute("type") !== "button"
      || !button.getAttribute("aria-label")
      || button.getAttribute("aria-pressed") !== "false"
    ) {
      throw new Error("css.soccer touch controls must be accessible toggle buttons.");
    }
  }
  return buttons;
}

function requireMatchCountry(matchState, country, label) {
  if (
    matchState === null
    || typeof matchState !== "object"
    || matchState.schema !== "cssoccer-free-play-state@1"
    || matchState.config?.controlCountry !== country
    || !Number.isSafeInteger(matchState.tick)
    || matchState.tick < 0
  ) {
    throw new Error(`${label} must retain the selected country and an exact non-negative tick.`);
  }
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.("button, input, select, textarea, a, [contenteditable='true']"));
}

function detectInputMode(windowImpl) {
  try {
    return windowImpl.matchMedia?.("(any-pointer: coarse)").matches
      ? "touch"
      : "keyboard";
  } catch {
    return "keyboard";
  }
}

function isPointerId(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

function hasBrowserShortcutModifier(event) {
  return Boolean(event.metaKey || event.ctrlKey || event.altKey);
}

function advanceProductFrameScheduler(scheduler, timestamp, {
  active,
  isTerminal,
  step,
}) {
  requireFrameTimestamp(timestamp);
  requireFunction(isTerminal, "product scheduler terminal check");
  requireFunction(step, "product scheduler step");
  if (!active) {
    scheduler.accumulator = 0;
    scheduler.lastTimestamp = null;
    return Object.freeze({ steps: 0, elapsed: 0, accumulator: 0 });
  }
  if (scheduler.lastTimestamp === null) {
    scheduler.lastTimestamp = timestamp;
    return Object.freeze({ steps: 0, elapsed: 0, accumulator: scheduler.accumulator });
  }
  const elapsed = Math.max(0, Math.min(timestamp - scheduler.lastTimestamp, 250));
  scheduler.lastTimestamp = timestamp;
  scheduler.accumulator += elapsed;
  let steps = 0;
  while (
    scheduler.accumulator >= FIXED_STEP_MILLISECONDS
    && steps < MAX_STEPS_PER_ANIMATION_FRAME
    && !isTerminal()
  ) {
    const result = step();
    scheduler.accumulator -= FIXED_STEP_MILLISECONDS;
    steps += 1;
    if (result === null) break;
  }
  if (steps === MAX_STEPS_PER_ANIMATION_FRAME) scheduler.accumulator = 0;
  return Object.freeze({ steps, elapsed, accumulator: scheduler.accumulator });
}

async function advanceAsyncProductFrameScheduler(scheduler, timestamp, {
  active,
  isTerminal,
  step,
}) {
  requireFrameTimestamp(timestamp);
  requireFunction(isTerminal, "async product scheduler terminal check");
  requireFunction(step, "async product scheduler step");
  if (!active) {
    scheduler.accumulator = 0;
    scheduler.lastTimestamp = null;
    return Object.freeze({ steps: 0, elapsed: 0, accumulator: 0 });
  }
  if (scheduler.lastTimestamp === null) {
    scheduler.lastTimestamp = timestamp;
    return Object.freeze({ steps: 0, elapsed: 0, accumulator: scheduler.accumulator });
  }
  const elapsed = Math.max(0, Math.min(timestamp - scheduler.lastTimestamp, 250));
  scheduler.lastTimestamp = timestamp;
  scheduler.accumulator += elapsed;
  let steps = 0;
  while (
    scheduler.accumulator >= FIXED_STEP_MILLISECONDS
    && steps < MAX_STEPS_PER_ANIMATION_FRAME
    && !isTerminal()
  ) {
    await step();
    scheduler.accumulator -= FIXED_STEP_MILLISECONDS;
    steps += 1;
  }
  if (steps === MAX_STEPS_PER_ANIMATION_FRAME) scheduler.accumulator = 0;
  return Object.freeze({ steps, elapsed, accumulator: scheduler.accumulator });
}

function requireFrameTimestamp(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError("css.soccer product animation-frame timestamp must be finite and non-negative.");
  }
  return value;
}

function requireFunction(value, label) {
  if (typeof value !== "function") throw new TypeError(`css.soccer ${label} must be a function.`);
}

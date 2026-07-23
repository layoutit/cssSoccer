#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_PORT = 5199;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_VIEWPORT_DIMENSION = 10_000;
const EMULATED_TOUCH_POINTS = 5;
const KEYBOARD_CASES = Object.freeze([
  { code: "KeyW", expected: { tick: 0, moveX: 0, moveY: -127, buttons: 0 } },
  { code: "KeyS", expected: { tick: 0, moveX: 0, moveY: 127, buttons: 0 } },
  { code: "KeyA", expected: { tick: 0, moveX: -127, moveY: 0, buttons: 0 } },
  { code: "KeyD", expected: { tick: 0, moveX: 127, moveY: 0, buttons: 0 } },
  { code: "KeyJ", expected: { tick: 0, moveX: 0, moveY: 0, buttons: 1 } },
  { code: "KeyK", expected: { tick: 0, moveX: 0, moveY: 0, buttons: 2 } },
  { code: "ArrowUp", expected: { tick: 0, moveX: 0, moveY: -127, buttons: 0 } },
  { code: "ArrowDown", expected: { tick: 0, moveX: 0, moveY: 127, buttons: 0 } },
  { code: "ArrowLeft", expected: { tick: 0, moveX: -127, moveY: 0, buttons: 0 } },
  { code: "ArrowRight", expected: { tick: 0, moveX: 127, moveY: 0, buttons: 0 } },
  { code: "KeyZ", expected: { tick: 0, moveX: 0, moveY: 0, buttons: 1 } },
  { code: "Space", expected: { tick: 0, moveX: 0, moveY: 0, buttons: 1 } },
  { code: "Numpad0", expected: { tick: 0, moveX: 0, moveY: 0, buttons: 1 } },
  { code: "NumpadDecimal", expected: { tick: 0, moveX: 0, moveY: 0, buttons: 2 } },
]);
const KEYBOARD_CHORDS = Object.freeze([
  {
    id: "modern",
    codes: ["KeyW", "KeyD", "KeyJ", "KeyK"],
    expected: { tick: 0, moveX: 90, moveY: -90, buttons: 3 },
  },
  {
    id: "classic",
    codes: ["ArrowDown", "ArrowLeft", "KeyZ", "NumpadDecimal"],
    expected: { tick: 0, moveX: -90, moveY: 90, buttons: 3 },
  },
]);
const FORBIDDEN_GAMEPLAY_CODES = Object.freeze(["Enter", "ShiftLeft", "ShiftRight"]);
const CHROME_CANDIDATES = Object.freeze([
  process.env.CSSOCCER_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
].filter(Boolean));

class CdpClient {
  static async connect(url, timeoutMs) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Chrome DevTools.")), timeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
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
    for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
  }

  close() {
    this.socket.close();
  }
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

let server = null;
let chrome = null;
let profile = null;
let cdp = null;
try {
  const target = options.url
    ? normalizeTargetUrl(options.url)
    : `http://127.0.0.1:${options.port}/`;
  if (!options.url) server = await startVite(options.port, options.timeoutMs);
  await waitForHttp(target, options.timeoutMs);

  profile = await mkdtemp(join(tmpdir(), "cssoccer-smoke-"));
  const chromeExecutable = await resolveChromeExecutable();
  const launched = await launchChrome(chromeExecutable, profile, options.timeoutMs);
  chrome = launched.process;
  cdp = await CdpClient.connect(launched.webSocketUrl, options.timeoutMs);
  const browserInfo = await cdp.send("Browser.getVersion");
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const pageErrors = [];
  const requestUrls = [];

  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    pageErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || "page exception");
  });
  cdp.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type !== "error" && type !== "assert") return;
    pageErrors.push(args?.map(({ value, description }) => value ?? description ?? "").join(" ") || type);
  });
  cdp.on("Log.entryAdded", ({ entry }) => {
    if (entry?.level === "error") pageErrors.push(entry.text || "browser log error");
  });
  cdp.on("Network.requestWillBeSent", ({ request }) => {
    if (request?.url) requestUrls.push(request.url);
  });
  cdp.on("Network.loadingFailed", ({ requestId, errorText, canceled }) => {
    if (!canceled) pageErrors.push(`network ${requestId}: ${errorText}`);
  });
  cdp.on("Network.responseReceived", ({ response }) => {
    if (response?.status >= 400) pageErrors.push(`HTTP ${response.status}: ${response.url}`);
  });

  await Promise.all([
    cdp.send("Page.enable", {}, sessionId),
    cdp.send("Runtime.enable", {}, sessionId),
    cdp.send("Network.enable", {}, sessionId),
    cdp.send("Log.enable", {}, sessionId),
  ]);
  await configureBrowserEnvironment(cdp, sessionId, options);
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `Object.defineProperty(globalThis, "__cssoccerDisableLiveScheduler", { configurable: false, enumerable: false, writable: false, value: true });`,
  }, sessionId);
  await cdp.send("Page.navigate", { url: target }, sessionId);
  const teamSelection = await chooseCountryThroughUi(
    cdp,
    sessionId,
    options.country,
    options.timeoutMs,
  );
  const inspected = await waitForDebugState(cdp, sessionId, options.timeoutMs, (state) => (
    state?.ready === true || state?.status === "error"
  ));
  const reportedErrors = await evaluate(cdp, sessionId, "window.__cssoccerDebug?.errors?.() ?? []");
  assert(
    inspected?.ready === true && inspected.status === "ready",
    `match did not reach ready: ${JSON.stringify({ inspected, pageErrors, reportedErrors })}`,
  );
  assert(inspected.controlCountry === options.country, "debug control-country binding changed");
  assert(inspected.pageErrorCount === 0, `debug recorded page errors: ${JSON.stringify(inspected)}`);
  const startupRequests = [
    "/cssoccer/manifest.json",
    "/cssoccer/scenes/spain-argentina-full-match.json",
    "/cssoccer/assets/spain-argentina-render-bundles.json",
    "/cssoccer/assets/animation/exact-player/index.json",
    "/cssoccer/assets/spain-argentina-exact-player-materials.json",
    "/cssoccer/assets/animation/exact-official/index.json",
    "/cssoccer/assets/spain-argentina-exact-official-materials.json",
    "/cssoccer/facts/spain-argentina-full-match.json",
  ];
  assert(
    inspected.requests?.preparedRequestCount >= startupRequests.length
      && JSON.stringify(inspected.requests.urls.slice(0, startupRequests.length))
        === JSON.stringify(startupRequests)
      && inspected.requests.urls.slice(startupRequests.length).every((url) => (
        /^\/cssoccer\/assets\/animation\/(?:(?:player-highlight-marker)\/(?:slot-[0-9]{3}|frames-[0-9]{6}-[0-9]{6})|exact-(?:player|official)\/slot-[0-9]{3}\/frames-[0-9]{3}-[0-9]{3})\.json$/u.test(url)
      )),
    `expected eight startup JSON requests plus only packed animation sidecars: ${JSON.stringify(inspected.requests)}`,
  );
  assert(inspected.requests?.nativeRequestCount === 0, "runtime requested native data");
  assert(inspected.requests?.sourceRequestCount === 0, "runtime requested source data");
  assert(inspected.requests?.rejectedRequestCount === 0, "runtime attempted a rejected data request");
  assertMountStats(inspected.mount);

  const dom = await evaluate(cdp, sessionId, `(() => {
    const roots = [...document.querySelectorAll("[data-cssoccer-root-id]")];
    const actorRoots = roots.filter((root) => (
      root.dataset.cssoccerKind === "player" || root.dataset.cssoccerKind === "official"
    ));
    const actorLeaves = actorRoots.flatMap((root) => (
      [...root.querySelectorAll(".cssoccer-exact-player-model > s")]
    ));
    const firstPlayerLeaves = [...document.querySelectorAll(
      "[data-cssoccer-kind=player] .cssoccer-exact-player-model > s",
    )].slice(0, 13);
    const playerTexturePaths = [
      "/cssoccer/assets/textures/spain-argentina-exact-player-materials.png",
    ];
    const firstPlayerTextureStyles = firstPlayerLeaves.map((leaf) => {
      const style = getComputedStyle(leaf);
      return {
        width: style.width,
        height: style.height,
        backgroundImage: style.backgroundImage,
        backgroundPositionX: style.backgroundPositionX,
        backgroundPositionY: style.backgroundPositionY,
        backgroundSize: style.backgroundSize,
      };
    });
    const firstPlayerTexturedStyles = firstPlayerTextureStyles.filter((style) => (
      style.backgroundImage !== "none"
    ));
    const firstPlayerTextureContractValid = firstPlayerTexturedStyles.length > 0
      && firstPlayerTexturedStyles.every((style) => {
      const width = Number.parseFloat(style.width);
      const height = Number.parseFloat(style.height);
      const offsetX = -Number.parseFloat(style.backgroundPositionX);
      const offsetY = -Number.parseFloat(style.backgroundPositionY);
      const [backgroundWidth, backgroundHeight] = style.backgroundSize
        .split(" ")
        .map(Number.parseFloat);
      return playerTexturePaths.some((path) => style.backgroundImage.includes(path))
        && Number.isFinite(width)
        && Number.isFinite(height)
        && Number.isFinite(offsetX)
        && Number.isFinite(offsetY)
        && Number.isFinite(backgroundWidth)
        && Number.isFinite(backgroundHeight)
        && width > 0
        && height > 0
        && backgroundWidth > 0
        && backgroundHeight > 0
        && offsetX >= 0
        && offsetY >= 0;
      });
    const hiddenRootIds = roots.filter((root) => {
      const style = getComputedStyle(root);
      return !root.isConnected || style.display === "none" || style.visibility === "hidden";
    }).map((root) => root.dataset.cssoccerRootId);
    const emptyRootIds = roots.filter((root) => (
      root.childElementCount === 0 && root.dataset.cssoccerRootId !== "sky-backdrop"
    ))
      .map((root) => root.dataset.cssoccerRootId);
    return {
      rootCount: roots.length,
      uniqueRootIds: new Set(roots.map((root) => root.dataset.cssoccerRootId)).size,
      hiddenRootIds,
      emptyRootIds,
      actorRootCount: actorRoots.length,
      actorLeafCount: actorLeaves.length,
      hiddenActorLeafCount: actorLeaves.filter((leaf) => (
        getComputedStyle(leaf).visibility === "hidden"
      )).length,
      unclassifiedHiddenActorLeafCount: actorLeaves.filter((leaf) => (
        getComputedStyle(leaf).visibility === "hidden"
        && leaf.closest(".cssoccer-exact-player-model") === null
        && !["native-backface", "unavailable-native-variant"].includes(
          leaf.dataset.cssoccerSourcePanelVisibility,
        )
      )).length,
      visibleUnavailableActorLeafCount: actorLeaves.filter((leaf) => (
        leaf.dataset.cssoccerSourcePanelVisibility === "unavailable-native-variant"
        && getComputedStyle(leaf).visibility !== "hidden"
      )).length,
      actorBackfaceVisibleCount: actorLeaves.filter((leaf) => (
        getComputedStyle(leaf).backfaceVisibility === "visible"
      )).length,
      firstPlayerLeafCount: firstPlayerLeaves.length,
      firstPlayerTexturedLeafCount: firstPlayerTexturedStyles.length,
      firstPlayerTextureContractValid,
      firstPlayerTextureStyles: firstPlayerTexturedStyles.slice(0, 2),
      polycssCameraCount: document.querySelectorAll("#scene > .polycss-camera").length,
      guiNodeCount: document.querySelectorAll("#app button, #app output, #app input, #app select, #app #country-choice, #app #match-hud, #app #touch-controls, #app #status, #app [data-country-choice], #app [data-cssoccer-control]").length,
      appChildCount: document.getElementById("app")?.children.length,
      sceneTabIndex: document.getElementById("scene")?.getAttribute("tabindex"),
      countryChoices: [...document.querySelectorAll("[data-country-choice]")]
        .map(({ dataset }) => dataset.countryChoice),
      hasCountryChoice: document.getElementById("country-choice") !== null,
      countryChoiceHidden: document.getElementById("country-choice")?.hidden,
      hudHidden: document.getElementById("match-hud")?.hidden,
      hudCountry: document.getElementById("hud-selected-country")?.textContent,
      touchControlCount: document.querySelectorAll("[data-cssoccer-control]").length,
      status: document.body.dataset.portStatus,
    };
  })()`);
  assert(dom.rootCount === 37 && dom.uniqueRootIds === 37, `unstable root DOM: ${JSON.stringify(dom)}`);
  assert(
    JSON.stringify(dom.hiddenRootIds)
      === JSON.stringify(["player-highlight-local-user-1"]),
    `only the tick-zero highlight may be hidden with the exact opening camera: ${JSON.stringify(dom.hiddenRootIds)}`,
  );
  assert(dom.emptyRootIds.length === 0, `empty prepared roots: ${JSON.stringify(dom.emptyRootIds)}`);
  assert(
    dom.actorRootCount === 25
      && dom.actorLeafCount === 322
      && dom.unclassifiedHiddenActorLeafCount === 0
      && dom.visibleUnavailableActorLeafCount === 0
      && dom.actorBackfaceVisibleCount === 322
      && dom.firstPlayerLeafCount === 13,
    `unstable or hidden prepared actor leaves: ${JSON.stringify(dom)}`,
  );
  assert(
    dom.firstPlayerTextureContractValid,
    `source player texture contract failed: ${JSON.stringify(dom.firstPlayerTextureStyles)}`,
  );
  assert(dom.polycssCameraCount === 1 && dom.status === "ready", `canonical scene DOM is not ready: ${JSON.stringify(dom)}`);
  assert(
    dom.guiNodeCount === 12
      && dom.appChildCount === 5
      && dom.sceneTabIndex === "0",
    `product kickoff shell changed: ${JSON.stringify(dom)}`,
  );
  assert(
    JSON.stringify(dom.countryChoices) === JSON.stringify(["spain", "argentina"])
      && dom.hasCountryChoice === true
      && dom.countryChoiceHidden === true
      && dom.hudHidden === false
      && dom.touchControlCount === 6,
    `country/HUD/control contract changed: ${JSON.stringify(dom)}`,
  );
  const readyShell = await evaluate(cdp, sessionId, responsiveShellExpression());
  assertResponsiveShell(readyShell, options);

  const keyboardMatrix = await evaluate(cdp, sessionId, keyboardMatrixExpression());
  assertKeyboardMatrix(keyboardMatrix);

  const debugRecordingRoundTrip = await evaluate(cdp, sessionId, `(() => {
    const debug = window.__cssoccerDebug;
    const dispatch = (type, code, repeat = false) => {
      const event = new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        code,
        repeat,
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const before = debug.inspect().input;
    const openDownPrevented = dispatch("keydown", "KeyX");
    const openUpPrevented = dispatch("keyup", "KeyX");
    const open = debug.debugPanelState();
    const panel = document.getElementById("cssoccer-debug-panel");
    const panelVisible = panel.hidden === false;
    const repeatPrevented = dispatch("keydown", "KeyX", true);
    const repeatVisible = debug.debugPanelState().visible;
    dispatch("keyup", "KeyX", true);
    const closeDownPrevented = dispatch("keydown", "KeyX");
    const closeUpPrevented = dispatch("keyup", "KeyX");
    return {
      openDownPrevented,
      openUpPrevented,
      closeDownPrevented,
      closeUpPrevented,
      repeatPrevented,
      repeatVisible,
      openVisible: open.visible,
      panelVisible,
      stepProductTickType: typeof debug.stepProductTick,
      captureOraclePostTickType: typeof debug.captureOraclePostTick,
      runPerformanceTraceWindowType: typeof debug.runPerformanceTraceWindow,
      finalVisible: debug.debugPanelState().visible,
      before,
      after: debug.inspect().input,
    };
  })()`);
  assert(
    debugRecordingRoundTrip.openDownPrevented === true
      && debugRecordingRoundTrip.openUpPrevented === true
      && debugRecordingRoundTrip.closeDownPrevented === true
      && debugRecordingRoundTrip.closeUpPrevented === true
      && debugRecordingRoundTrip.repeatPrevented === true
      && debugRecordingRoundTrip.repeatVisible === true
      && debugRecordingRoundTrip.openVisible === true
      && debugRecordingRoundTrip.panelVisible === true
      && debugRecordingRoundTrip.stepProductTickType === "undefined"
      && debugRecordingRoundTrip.captureOraclePostTickType === "undefined"
      && debugRecordingRoundTrip.runPerformanceTraceWindowType === "function"
      && debugRecordingRoundTrip.finalVisible === false,
    `X debug-menu shortcut changed: ${JSON.stringify(debugRecordingRoundTrip)}`,
  );
  assert(
    debugRecordingRoundTrip.before.focused === true
      && debugRecordingRoundTrip.before.paused === false
      && debugRecordingRoundTrip.before.keyboardCodes.length === 0
      && debugRecordingRoundTrip.after.focused === true
      && debugRecordingRoundTrip.after.paused === false
      && debugRecordingRoundTrip.after.keyboardCodes.length === 0
      && JSON.stringify(debugRecordingRoundTrip.before)
        === JSON.stringify(debugRecordingRoundTrip.after),
    `read-only debug inspection changed gameplay input: ${JSON.stringify(debugRecordingRoundTrip)}`,
  );

  const pauseRoundTrip = await evaluate(cdp, sessionId, `(() => {
    const toggle = () => window.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Escape",
    }));
    toggle();
    const paused = document.body.dataset.matchPaused;
    const pausedInput = window.__cssoccerDebug.inspect().input;
    toggle();
    return {
      paused,
      pausedInput,
      resumed: document.body.dataset.matchPaused,
      resumedInput: window.__cssoccerDebug.inspect().input,
    };
  })()`);
  assert(
    pauseRoundTrip.paused === "true" && pauseRoundTrip.resumed === "false",
    `keyboard pause handoff changed: ${JSON.stringify(pauseRoundTrip)}`,
  );
  assertNeutralInput(
    pauseRoundTrip.pausedInput,
    { focused: true, paused: true },
    "paused keyboard input",
  );
  assertNeutralInput(
    pauseRoundTrip.resumedInput,
    { focused: true, paused: false },
    "resumed keyboard input",
  );

  const focusRoundTrip = await evaluate(cdp, sessionId, `(() => {
    window.dispatchEvent(new Event("blur"));
    const lost = document.body.dataset.matchFocused;
    const lostInput = window.__cssoccerDebug.inspect().input;
    window.dispatchEvent(new Event("focus"));
    return {
      lost,
      lostInput,
      recovered: document.body.dataset.matchFocused,
      recoveredInput: window.__cssoccerDebug.inspect().input,
    };
  })()`);
  assert(
    focusRoundTrip.lost === "false" && focusRoundTrip.recovered === "true",
    `focus neutralization handoff changed: ${JSON.stringify(focusRoundTrip)}`,
  );
  assertNeutralInput(
    focusRoundTrip.lostInput,
    { focused: false, paused: false },
    "blurred keyboard input",
  );
  assertNeutralInput(
    focusRoundTrip.recoveredInput,
    { focused: true, paused: false },
    "refocused keyboard input",
  );

  const livePerformanceRecording = await captureLivePerformanceRecording({
    client: cdp,
    options,
    target,
    timeoutMs: options.timeoutMs,
  });
  assert(
    livePerformanceRecording.schema === "cssoccer-manual-performance-trace@1"
      && livePerformanceRecording.durationMs >= 700
      && livePerformanceRecording.sampleCount >= 4
      && livePerformanceRecording.sampleReasons.includes("sample")
      && livePerformanceRecording.frameCount >= 20
      && livePerformanceRecording.p95FrameMs > 0
      && livePerformanceRecording.maxFrameMs >= livePerformanceRecording.p95FrameMs
      && livePerformanceRecording.productFrameCount >= 20
      && livePerformanceRecording.productCallbackTotalMs > 0
      && livePerformanceRecording.tickCount >= 8
      && livePerformanceRecording.simulationTimingCount === livePerformanceRecording.tickCount
      && livePerformanceRecording.publicationTimingCount === livePerformanceRecording.tickCount
      && livePerformanceRecording.simulationTotalMs > 0
      && livePerformanceRecording.publicationTotalMs > 0
      && livePerformanceRecording.endTick > livePerformanceRecording.startTick
      && livePerformanceRecording.rootStart === 37
      && livePerformanceRecording.rootEnd === 37
      && livePerformanceRecording.rootDelta === 0
      && livePerformanceRecording.connectedRootDelta === 0
      && livePerformanceRecording.runtimeConstructionCount === 0
      && livePerformanceRecording.pageErrorCount === 0
      && livePerformanceRecording.animationFrameSampler === true
      && livePerformanceRecording.longTaskObserver === true
      && livePerformanceRecording.agency.tick >= 190
      && livePerformanceRecording.agency.controlledMovedCount > 0
      && livePerformanceRecording.agency.ballMoved === true
      && livePerformanceRecording.agency.controlledPlayerId?.startsWith(`${options.country}-player-`)
      && livePerformanceRecording.agency.heldCommand?.moveY < -120
      && Math.hypot(
        livePerformanceRecording.agency.heldCommand?.moveX ?? 0,
        livePerformanceRecording.agency.heldCommand?.moveY ?? 0,
      ) >= 126,
    `live performance recording is not measuring the canonical scheduler: ${JSON.stringify(
      livePerformanceRecording,
    )}`,
  );

  const finalState = await evaluate(cdp, sessionId, "window.__cssoccerDebug?.inspect?.() ?? null");
  assert(
    finalState?.ready === true && finalState?.pageErrorCount === 0,
    `browser interaction checks damaged the real route: ${JSON.stringify(finalState)}`,
  );

  const forbiddenRequests = requestUrls.filter((value) => (
    /(?:\/\.local\/|\/source\/|\/native\/|\/oracle\/|\.(?:exe|dll|lib|dat|obj|off)(?:[?#]|$))/iu.test(value)
  ));
  assert(forbiddenRequests.length === 0, `browser requested native/source paths: ${forbiddenRequests.join(", ")}`);
  assert(pageErrors.length === 0, `browser errors:\n${pageErrors.join("\n")}`);

  console.log(JSON.stringify({
    status: "pass",
    browser: {
      product: browserInfo.product,
      userAgent: browserInfo.userAgent,
      executable: chromeExecutable,
      headless: true,
    },
    url: target,
    country: options.country,
    teamSelection,
    viewport: {
      requested: options.viewport,
      width: readyShell.viewport.width,
      height: readyShell.viewport.height,
    },
    input: {
      coarsePointer: readyShell.device.coarsePointer,
      maxTouchPoints: readyShell.device.maxTouchPoints,
    },
    kickoffScene: {
      guiNodeCount: readyShell.guiNodeCount,
      appChildCount: readyShell.appChildCount,
      inViewport: true,
    },
    interactions: {
      keyboardMatrix: {
        keyCount: keyboardMatrix.single.length,
        chordCount: keyboardMatrix.chords.length,
        forbiddenKeyCount: keyboardMatrix.forbidden.length,
      },
      keyboardPause: "pass",
      focusNeutralization: "pass",
      debugInspection: {
        stepProductTick: debugRecordingRoundTrip.stepProductTickType,
        captureOraclePostTick: debugRecordingRoundTrip.captureOraclePostTickType,
        runPerformanceTraceWindow: debugRecordingRoundTrip.runPerformanceTraceWindowType,
      },
      livePerformanceRecording,
    },
    preparedRequests: inspected.requests.preparedRequestCount,
    rootCounts: {
      static: inspected.mount.staticRootCount,
      highlights: inspected.mount.highlightRootCount,
      players: inspected.mount.playerRootCount,
      officials: inspected.mount.officialRootCount,
      ball: inspected.mount.ballRootCount,
      total: inspected.mount.rootCount,
    },
    distinctPlayerPositions: inspected.mount.distinctPlayerPositionCount,
    ballPosition: inspected.mount.ballPosition,
    runtimeConstruction: inspected.mount.runtimeConstruction,
    pageErrors: pageErrors.length,
  }, null, 2));
} finally {
  cdp?.close();
  await stopProcess(chrome);
  await stopProcess(server);
  if (profile) await rm(profile, { recursive: true, force: true });
}
process.exit(0);

async function chooseCountryThroughUi(client, sessionId, country, timeoutMs) {
  const choosing = await waitForDebugState(client, sessionId, timeoutMs, (state) => (
    state?.status === "choosing-country" || state?.status === "error"
  ));
  assert(
    choosing?.status === "choosing-country"
      && choosing.ready === false
      && choosing.controlCountry === null
      && choosing.pageErrorCount === 0,
    `pre-match team choice did not open cleanly: ${JSON.stringify(choosing)}`,
  );
  const before = await evaluate(client, sessionId, `(() => {
    const host = document.getElementById("country-choice");
    const box = host?.getBoundingClientRect();
    const style = host ? getComputedStyle(host) : null;
    const choices = [...document.querySelectorAll("[data-country-choice]")].map((button) => ({
      country: button.dataset.countryChoice,
      label: button.getAttribute("aria-label"),
      disabled: button.disabled,
      type: button.getAttribute("type"),
    }));
    return {
      choices,
      hostHidden: host?.hidden,
      hostVisible: host !== null
        && host.hidden === false
        && style.display !== "none"
        && style.visibility !== "hidden"
        && box.width > 0
        && box.height > 0,
      hudHidden: document.getElementById("match-hud")?.hidden,
      route: location.pathname + location.search + location.hash,
    };
  })()`);
  assert(
    before.route === "/"
      && before.hostHidden === false
      && before.hostVisible === true
      && before.hudHidden === true
      && JSON.stringify(before.choices.map(({ country: value }) => value))
        === JSON.stringify(["spain", "argentina"])
      && before.choices.every(({ disabled, label, type }) => (
        disabled === false && typeof label === "string" && label.length > 0 && type === "button"
      )),
    `pre-match team choice UI changed: ${JSON.stringify(before)}`,
  );
  const clicked = await evaluate(client, sessionId, `(() => {
    const button = document.querySelector(
      ${JSON.stringify(`[data-country-choice="${country}"]`)},
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert(clicked === true, `could not choose ${country} through the product UI`);
  return Object.freeze({
    status: "pass",
    country,
    route: before.route,
    choices: before.choices.map(({ country: value }) => value),
  });
}

async function captureLivePerformanceRecording({ client, options, target, timeoutMs }) {
  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
  try {
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Log.enable", {}, sessionId),
    ]);
    await configureBrowserEnvironment(client, sessionId, options);
    await client.send("Page.bringToFront", {}, sessionId);
    await client.send("Page.navigate", { url: target }, sessionId);
    await chooseCountryThroughUi(client, sessionId, options.country, timeoutMs);
    const inspected = await waitForDebugState(client, sessionId, timeoutMs, (state) => (
      state?.ready === true || state?.status === "error"
    ));
    assert(
      inspected?.ready === true
        && inspected.status === "ready"
        && inspected.controlCountry === options.country
        && Number.isSafeInteger(inspected.live?.tick)
        && inspected.live.tick >= 0,
      `live performance page did not start on the canonical route: ${JSON.stringify(inspected)}`,
    );
    return await evaluate(client, sessionId, `(async () => {
      const debug = window.__cssoccerDebug;
      debug.setDebugPanel(true);
      const started = debug.startRecording();
      if (!started) throw new Error("Could not start manual css.soccer performance recording.");
      await new Promise((resolve) => setTimeout(resolve, 900));
      const trace = debug.stopRecording({ download: false });
      const summary = trace.summary;
      const lastSample = trace.samples.at(-1);
      const beforeMatch = debug.match;
      const controlledCountry = ${JSON.stringify(options.country)};
      const beforeControlled = Object.fromEntries(beforeMatch.players
        .filter(({ country }) => country === controlledCountry)
        .map(({ id, position }) => [id, { ...position }]));
      const beforeBall = { ...beforeMatch.ball.ball.position };
      window.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "KeyW",
      }));
      const agencyDeadline = performance.now() + 15_000;
      while ((debug.inspect().live?.tick ?? -1) < 190) {
        if (performance.now() >= agencyDeadline) {
          throw new Error("Free-play agency smoke did not reach tick 190.");
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const heldCommand = { ...debug.inspect().input.lastCommand };
      window.dispatchEvent(new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        code: "KeyW",
      }));
      const afterMatch = debug.match;
      const controlledMovedCount = afterMatch.players
        .filter(({ country }) => country === controlledCountry)
        .filter(({ id, position }) => {
          const before = beforeControlled[id];
          return before === undefined
            || position.x !== before.x
            || position.y !== before.y
            || position.z !== before.z;
        }).length;
      const afterBall = afterMatch.ball.ball.position;
      return {
        schema: trace.schema,
        durationMs: trace.durationMs,
        sampleCount: trace.samples.length,
        sampleReasons: trace.samples.map(({ reason }) => reason),
        startTick: summary.startTick,
        endTick: summary.endTick,
        frameCount: summary.frameTiming.frames,
        p95FrameMs: summary.frameTiming.p95Ms,
        p99FrameMs: summary.frameTiming.p99Ms,
        maxFrameMs: summary.frameTiming.maxMs,
        hitchesOver33Ms: summary.frameTiming.longFramesOver33Ms,
        productFrameCount: summary.product.animationFrameCallbacks.samples,
        productCallbackTotalMs: summary.product.animationFrameCallbacks.totalMs,
        tickCount: summary.product.tickCount,
        simulationTimingCount: summary.product.productSimulationMs.samples,
        publicationTimingCount: summary.product.preparedLivePublicationMs.samples,
        simulationTotalMs: summary.product.productSimulationMs.totalMs,
        publicationTotalMs: summary.product.preparedLivePublicationMs.totalMs,
        longTaskCount: summary.longTasks.count,
        rootStart: summary.dom.roots.start,
        rootEnd: summary.dom.roots.end,
        rootDelta: summary.dom.roots.delta,
        connectedRootDelta: summary.dom.connectedRoots.delta,
        heapSupported: summary.memory.supported,
        heapDelta: summary.memory.delta,
        runtimeConstructionCount: lastSample.snapshot.publication.runtimeConstructionCount,
        pageErrorCount: summary.pageErrorCount,
        animationFrameSampler: trace.metadata.capabilities.animationFrameSampler,
        longTaskObserver: trace.metadata.capabilities.longTaskObserver,
        agency: {
          tick: afterMatch.tick,
          controlledPlayerId: afterMatch.control.activePlayerId,
          heldCommand,
          controlledMovedCount,
          ballMoved: afterBall.x !== beforeBall.x
            || afterBall.y !== beforeBall.y
            || afterBall.z !== beforeBall.z,
          ball: { before: beforeBall, after: { ...afterBall } },
        },
      };
    })()`, { awaitPromise: true });
  } finally {
    await client.send("Target.closeTarget", { targetId }).catch(() => undefined);
  }
}

async function configureBrowserEnvironment(client, sessionId, options) {
  if (options.viewport) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: options.viewport.width,
      height: options.viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: options.viewport.width,
      screenHeight: options.viewport.height,
      positionX: 0,
      positionY: 0,
      dontSetVisibleSize: false,
    }, sessionId);
  }
  if (options.coarsePointer) {
    await client.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: EMULATED_TOUCH_POINTS,
    }, sessionId);
  }
}

function responsiveShellExpression() {
  return `(() => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      visualWidth: window.visualViewport?.width ?? window.innerWidth,
      visualHeight: window.visualViewport?.height ?? window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    };
    const measure = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        hidden: element.hidden === true,
        display: style.display,
        visibility: style.visibility,
        visible: element.hidden !== true
          && style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || 1) > 0
          && box.width > 0
          && box.height > 0,
      };
    };
    return {
      route: {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        title: document.title,
        productView: document.body.dataset.productView,
        portSlug: document.body.dataset.portSlug,
      },
      viewport,
      device: {
        coarsePointer: matchMedia("(any-pointer: coarse)").matches,
        finePointer: matchMedia("(any-pointer: fine)").matches,
        maxTouchPoints: navigator.maxTouchPoints,
      },
      elements: Object.fromEntries(Object.entries({
        app: "app",
        scene: "scene",
        matchHud: "match-hud",
        countryChoice: "country-choice",
        touchControls: "touch-controls",
        status: "status",
      }).map(([key, id]) => [key, measure(document.getElementById(id))])),
      guiNodeCount: document.querySelectorAll("#app button, #app output, #app input, #app select, #app #country-choice, #app #match-hud, #app #touch-controls, #app #status, #app [data-country-choice], #app [data-cssoccer-control]").length,
      appChildCount: document.getElementById("app")?.children.length,
      sceneTabIndex: document.getElementById("scene")?.getAttribute("tabindex"),
    };
  })()`;
}

function keyboardMatrixExpression() {
  return `(() => {
    const cases = ${JSON.stringify(KEYBOARD_CASES)};
    const chords = ${JSON.stringify(KEYBOARD_CHORDS)};
    const forbiddenCodes = ${JSON.stringify(FORBIDDEN_GAMEPLAY_CODES)};
    const dispatch = (type, code) => {
      const event = new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        code,
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const inspect = () => window.__cssoccerDebug.inspect().input;
    const single = cases.map((entry) => {
      const downPrevented = dispatch("keydown", entry.code);
      const down = inspect();
      const upPrevented = dispatch("keyup", entry.code);
      return {
        ...entry,
        downPrevented,
        down,
        upPrevented,
        up: inspect(),
      };
    });
    const chordResults = chords.map((entry) => {
      const downPrevented = entry.codes.map((code) => dispatch("keydown", code));
      const down = inspect();
      const upPrevented = [...entry.codes].reverse().map((code) => dispatch("keyup", code));
      return {
        ...entry,
        downPrevented,
        down,
        upPrevented,
        up: inspect(),
      };
    });
    const forbidden = forbiddenCodes.map((code) => {
      const before = inspect();
      const downPrevented = dispatch("keydown", code);
      const down = inspect();
      const upPrevented = dispatch("keyup", code);
      return {
        code,
        before,
        downPrevented,
        down,
        upPrevented,
        up: inspect(),
      };
    });
    return { single, chords: chordResults, forbidden, final: inspect() };
  })()`;
}

function assertKeyboardMatrix(matrix) {
  assert(matrix?.single?.length === KEYBOARD_CASES.length, (
    `keyboard single-key matrix changed: ${JSON.stringify(matrix)}`
  ));
  for (const result of matrix.single) {
    assert(result.downPrevented === true && result.upPrevented === true, (
      `gameplay key ${result.code} was not exclusively handled: ${JSON.stringify(result)}`
    ));
    assertInputSnapshot(result.down, {
      keyboardCodes: [result.code],
      command: result.expected,
      label: `keydown ${result.code}`,
    });
    assertNeutralInput(
      result.up,
      { focused: true, paused: false },
      `keyup ${result.code}`,
    );
  }
  assert(matrix.chords?.length === KEYBOARD_CHORDS.length, (
    `keyboard chord matrix changed: ${JSON.stringify(matrix?.chords)}`
  ));
  for (const result of matrix.chords) {
    assert(result.downPrevented.every(Boolean) && result.upPrevented.every(Boolean), (
      `keyboard chord ${result.id} was not exclusively handled: ${JSON.stringify(result)}`
    ));
    assertInputSnapshot(result.down, {
      keyboardCodes: [...result.codes].sort(),
      command: result.expected,
      label: `${result.id} chord`,
    });
    assertNeutralInput(
      result.up,
      { focused: true, paused: false },
      `${result.id} chord release`,
    );
  }
  assert(matrix.forbidden?.length === FORBIDDEN_GAMEPLAY_CODES.length, (
    `forbidden gameplay matrix changed: ${JSON.stringify(matrix?.forbidden)}`
  ));
  for (const result of matrix.forbidden) {
    assert(result.downPrevented === false && result.upPrevented === false, (
      `non-gameplay key ${result.code} was captured: ${JSON.stringify(result)}`
    ));
    assert(
      JSON.stringify(result.before) === JSON.stringify(result.down)
        && JSON.stringify(result.before) === JSON.stringify(result.up),
      `non-gameplay key ${result.code} changed input: ${JSON.stringify(result)}`,
    );
  }
  assertNeutralInput(
    matrix.final,
    { focused: true, paused: false },
    "keyboard matrix final state",
  );
}

function assertInputSnapshot(input, { keyboardCodes, command, label }) {
  assert(input?.schema === "cssoccer-debug-input@1", `${label} lost input schema`);
  assert(input.focused === true && input.paused === false, (
    `${label} changed focus/pause: ${JSON.stringify(input)}`
  ));
  assert(JSON.stringify(input.keyboardCodes) === JSON.stringify(keyboardCodes), (
    `${label} held codes changed: ${JSON.stringify(input)}`
  ));
  assertCommand(input.lastCommand, command, label);
}

function assertNeutralInput(input, { focused, paused }, label, tick = 0) {
  assert(input?.schema === "cssoccer-debug-input@1", `${label} lost input schema`);
  assert(input.focused === focused && input.paused === paused, (
    `${label} changed focus/pause: ${JSON.stringify(input)}`
  ));
  assert(Array.isArray(input.keyboardCodes) && input.keyboardCodes.length === 0, (
    `${label} retained held codes: ${JSON.stringify(input)}`
  ));
  assertCommand(
    input.lastCommand,
    { tick, moveX: 0, moveY: 0, buttons: 0 },
    label,
  );
}

function assertCommand(actual, expected, label) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), (
    `${label} command changed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  ));
}

function assertResponsiveShell(shell, options) {
  assert(shell?.route?.pathname === "/" && shell.route.search === "" && shell.route.hash === "", (
    `smoke left the canonical root route: ${JSON.stringify(shell?.route)}`
  ));
  assert(
    shell.route.title === "css.soccer: Full Match Alpha"
      && shell.route.productView === "1"
      && shell.route.portSlug === "cssoccer",
    `smoke did not load the real product shell: ${JSON.stringify(shell.route)}`,
  );
  assert(
    Number.isInteger(shell.viewport.width)
      && Number.isInteger(shell.viewport.height)
      && shell.viewport.width > 0
      && shell.viewport.height > 0,
    `smoke has invalid browser metrics: ${JSON.stringify(shell.viewport)}`,
  );
  if (options.viewport) {
    assert(
      shell.viewport.width === options.viewport.width
        && shell.viewport.height === options.viewport.height
        && shell.viewport.screenWidth === options.viewport.width
        && shell.viewport.screenHeight === options.viewport.height,
      `viewport emulation drifted: ${JSON.stringify(shell.viewport)}`,
    );
  }
  assert(
    shell.device.coarsePointer === options.coarsePointer,
    `coarse-pointer emulation drifted: ${JSON.stringify(shell.device)}`,
  );
  if (options.coarsePointer) {
    assert(
      shell.device.maxTouchPoints === EMULATED_TOUCH_POINTS,
      `touch emulation drifted: ${JSON.stringify(shell.device)}`,
    );
  }

  assertInsideViewport(shell.elements.app, shell.viewport, "#app");
  assertInsideViewport(shell.elements.scene, shell.viewport, "#scene");
  assertInsideViewport(shell.elements.matchHud, shell.viewport, "#match-hud");
  assert(
    shell.elements.countryChoice?.hidden === true
      && shell.elements.countryChoice.visible === false,
    "country choice must close after the selected team starts",
  );
  assert(shell.elements.status?.visible === false, "ready status stayed visible over the match");
  assert(
    shell.elements.touchControls?.visible === options.coarsePointer,
    `touch controls visibility drifted: ${JSON.stringify(shell.elements.touchControls)}`,
  );
  assert(
    shell.guiNodeCount === 12
      && shell.appChildCount === 5
      && shell.sceneTabIndex === "0",
    `route product shell changed: ${JSON.stringify(shell)}`,
  );
}

function assertInsideViewport(rect, viewport, label) {
  const tolerance = 1;
  assert(rect?.visible === true, `${label} is not visible: ${JSON.stringify(rect)}`);
  assert(
    rect.left >= -tolerance
      && rect.top >= -tolerance
      && rect.right <= viewport.width + tolerance
      && rect.bottom <= viewport.height + tolerance,
    `${label} escaped ${viewport.width}x${viewport.height}: ${JSON.stringify(rect)}`,
  );
}

function assertMountStats(mount) {
  assert(mount?.rootCount === 37, `expected 37 source-bound mounted roots: ${JSON.stringify(mount)}`);
  assert(mount.staticRootCount === 9, "expected nine static roots");
  assert(mount.highlightRootCount === 1, "expected one prepared highlight root");
  assert(mount.playerRootCount === 22, "expected 22 player roots");
  assert(mount.officialRootCount === 3, "expected three mounted officials");
  assert(mount.exactOfficialRootCount === 3, "expected three exact official roots");
  assert(mount.ballRootCount === 1, "expected one ball root");
  assert(mount.stableIdentityCount === 37 && mount.connectedRootCount === 37, "stable root identities changed");
  assert(
    mount.frameSetRootCount === 1 && mount.initialFrameRootCount === 1,
    "prepared animation roots changed",
  );
  assert(Number.isSafeInteger(mount.leafCount) && mount.leafCount > 0, "prepared scene mounted no visible leaves");
  assert(mount.distinctPlayerPositionCount === 22, "prepared player transforms overlap");
  assert(
    JSON.stringify(mount.ballPosition) === JSON.stringify([640, 2, -400]),
    `prepared ball is not at kickoff center: ${JSON.stringify(mount.ballPosition)}`,
  );
  for (const key of [
    "sourceParseCount",
    "geometryBuildCount",
    "topologyBuildCount",
    "materialBuildCount",
    "atlasBuildCount",
    "assetBuildCount",
  ]) {
    assert(mount.runtimeConstruction?.[key] === 0, `runtime construction ${key} is not zero`);
  }
  assert(
    mount.camera?.schema === "cssoccer-actua-gameplay-camera@1"
      && mount.camera?.status === "source-gameplay-camera",
    `camera is not the source gameplay camera: ${JSON.stringify(mount.camera)}`,
  );
  assert(
    mount.camera?.source?.file === "3D_UPD2.CPP"
      && [8, 15, 16].includes(mount.camera?.sourceMode),
    `camera is outside the compiled source modes: ${JSON.stringify(mount.camera)}`,
  );
  assert(
    [mount.camera?.rendered?.renderer?.eye, mount.camera?.rendered?.renderer?.target]
      .every((point) => Array.isArray(point)
        && point.length === 3
        && point.every(Number.isFinite)),
    `camera did not publish a finite renderer pose: ${JSON.stringify(mount.camera)}`,
  );
  assert(
    typeof mount.camera?.sceneMatrix === "string"
      && mount.camera.sceneMatrix.startsWith("matrix3d("),
    `camera did not publish its prepared scene matrix: ${JSON.stringify(mount.camera)}`,
  );
}

async function waitForDebugState(client, sessionId, timeoutMs, predicate) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(client, sessionId, "window.__cssoccerDebug?.inspect?.() ?? null");
      if (predicate(last)) return last;
    } catch (error) {
      if (!/context|navigation|destroyed/iu.test(String(error))) throw error;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for css.soccer debug state: ${JSON.stringify(last)}`);
}

async function evaluate(client, sessionId, expression, { awaitPromise = false } = {}) {
  const result = await client.send("Runtime.evaluate", {
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

async function startVite(port, timeoutMs) {
  const vite = join(REPO_ROOT, "node_modules", "vite", "bin", "vite.js");
  await access(vite);
  const child = spawn(process.execPath, [
    vite,
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const errors = [];
  child.stderr.on("data", (chunk) => errors.push(chunk.toString("utf8")));
  child.stdout.on("data", () => undefined);
  child.once("exit", (code) => {
    if (code !== null && code !== 0) errors.push(`Vite exited ${code}`);
  });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, timeoutMs);
  } catch (error) {
    await stopProcess(child);
    throw new Error(`Could not start css.soccer Vite:\n${errors.join("")}`, { cause: error });
  }
  return child;
}

async function launchChrome(executable, profilePath, timeoutMs) {
  const child = spawn(executable, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const webSocketUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out starting headless Chrome.")), timeoutMs);
    let output = "";
    const finish = (value, error) => {
      clearTimeout(timer);
      child.stderr.off("data", onData);
      child.off("exit", onExit);
      child.stderr.resume();
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      output += chunk.toString("utf8");
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/u);
      if (match) finish(match[1]);
    };
    const onExit = (code) => finish(null, new Error(`Chrome exited ${code}: ${output}`));
    child.stderr.on("data", onData);
    child.once("exit", onExit);
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
  throw new Error("Google Chrome is unavailable. Set CSSOCCER_CHROME_PATH to the real Chrome executable.");
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error;
    }
    await delay(75);
  }
  throw new Error(`Timed out waiting for ${url}: ${String(last)}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    delay(2_000).then(() => false),
  ]);
  if (!exited && child.exitCode === null) child.kill("SIGKILL");
  if (!exited) {
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(2_000),
    ]);
  }
}

function normalizeTargetUrl(value) {
  const url = new URL(value);
  if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname)) {
    throw new Error("Browser smoke accepts only a loopback css.soccer URL.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Browser smoke accepts only the canonical root route.");
  }
  return url.toString();
}

function parseArgs(args) {
  const parsed = {
    coarsePointer: false,
    country: "argentina",
    help: false,
    mode: "free-play",
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    url: null,
    viewport: null,
  };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--coarse-pointer") {
      requireUniqueOption(seen, arg);
      parsed.coarsePointer = true;
    } else if (arg === "--url") {
      requireUniqueOption(seen, arg);
      parsed.url = requiredValue(args, ++index, arg);
    } else if (arg === "--port") {
      requireUniqueOption(seen, arg);
      parsed.port = positiveInteger(requiredValue(args, ++index, arg), arg);
    } else if (arg === "--timeout-ms") {
      requireUniqueOption(seen, arg);
      parsed.timeoutMs = positiveInteger(requiredValue(args, ++index, arg), arg);
    } else if (arg === "--country") {
      requireUniqueOption(seen, arg);
      parsed.country = requiredValue(args, ++index, arg);
    } else if (arg === "--mode") {
      requireUniqueOption(seen, arg);
      parsed.mode = requiredValue(args, ++index, arg);
    } else if (arg === "--viewport") {
      requireUniqueOption(seen, arg);
      parsed.viewport = parseViewport(requiredValue(args, ++index, arg));
    }
    else throw new Error(`Unknown browser smoke option ${arg}.`);
  }
  if (!["spain", "argentina"].includes(parsed.country)) {
    throw new Error("--country must be spain or argentina on the current free-play route.");
  }
  if (parsed.mode !== "free-play") {
    throw new Error("--mode must be free-play.");
  }
  return parsed;
}

function requireUniqueOption(seen, flag) {
  if (seen.has(flag)) throw new Error(`${flag} may be provided only once.`);
  seen.add(flag);
}

function parseViewport(value) {
  const match = /^(?<width>[1-9][0-9]*)x(?<height>[1-9][0-9]*)$/u.exec(value);
  if (!match) throw new Error("--viewport must be strict WxH positive integers, for example 390x844.");
  const width = Number(match.groups.width);
  const height = Number(match.groups.height);
  if (
    !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width > MAX_VIEWPORT_DIMENSION
    || height > MAX_VIEWPORT_DIMENSION
  ) {
    throw new Error(`--viewport dimensions must be between 1 and ${MAX_VIEWPORT_DIMENSION}.`);
  }
  return Object.freeze({ width, height });
}

function requiredValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function positiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${flag} requires a positive integer.`);
  return parsed;
}

function printHelp() {
  console.log(`Usage: node tools/smoke-browser.mjs [options]

Runs the canonical css.soccer route in real Google Chrome headlessly.

Options:
  --url <loopback-url>  Reuse an existing canonical root server.
  --port <port>         Temporary Vite port. Default: ${DEFAULT_PORT}
  --country <country>   Team chosen through the product UI: spain or argentina.
  --mode <mode>         Current product mode. Must be free-play.
  --viewport <WxH>      Strict explicit browser viewport, for example 390x844.
  --coarse-pointer      Emulate a coarse pointer with ${EMULATED_TOUCH_POINTS} touch points.
  --timeout-ms <ms>     Browser/server timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --help                Show this help.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

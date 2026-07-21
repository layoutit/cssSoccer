import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Window } from "happy-dom";

import { mountCssoccerClient } from "../src/cssoccer/client.mjs";

const INDEX_HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const GENERATED_ROOT = new URL("../build/generated/public/cssoccer/", import.meta.url);
const GENERATED_FILES = [
  "manifest.json",
  "scenes/spain-argentina-full-match.json",
  "assets/spain-argentina-render-bundles.json",
  "assets/animation/exact-player/index.json",
  "assets/spain-argentina-exact-player-materials.json",
  "facts/spain-argentina-full-match.json",
];
const missing = GENERATED_FILES.filter((path) => !existsSync(new URL(path, GENERATED_ROOT)));
const preparedOptions = {
  skip: missing.length > 0
    ? `prepared browser fixture unavailable: ${missing.join(", ")}`
    : false,
};
const preparedBytes = new Map();

test("canonical route chooses Spain through the pre-match UI and preserves keyboard handoff", preparedOptions, async () => {
  const window = routeWindow();
  const commands = [];
  const requestedUrls = [];
  const client = mountCssoccerClient({
    document: window.document,
    window,
    fetchImpl(input) {
      requestedUrls.push(String(input));
      return preparedFetch(input);
    },
    consumeInputCommand(command) {
      commands.push(command);
    },
  });
  try {
    await waitFor(() => client.state.status === "choosing-country");
    const countryChoice = window.document.getElementById("country-choice");
    assert.equal(client.state.ready, false);
    assert.equal(client.state.controlCountry, null);
    assert.equal(countryChoice.hidden, false);
    assert.equal(countryChoice.getAttribute("aria-busy"), "false");
    assert.deepEqual(
      [...countryChoice.querySelectorAll("[data-country-choice]")]
        .map(({ dataset }) => dataset.countryChoice),
      ["spain", "argentina"],
    );
    countryChoice.querySelector("[data-country-choice='spain']").click();
    await client.boot;
    assert.equal(
      requestedUrls.some((url) => /assets\/animation\/actor-player-f[12]\//u.test(url)),
      false,
      "the exact 13-plane product must not load unused full-player frame sidecars",
    );
    assert.equal(client.state.ready, true);
    assert.equal(client.state.status, "ready");
    assert.equal(client.state.controlCountry, "spain");
    assert.equal(client.state.matchState.tick, 0);
    assert.equal(window.document.body.dataset.controlCountry, "spain");
    assert.equal(window.document.body.dataset.portStatus, "ready");
    assert.equal(countryChoice.hidden, true);
    assert.equal(window.document.getElementById("match-hud").hidden, false);
    assert.equal(window.document.getElementById("hud-clock").dataset.nativeHudText, "0:00");
    assert.equal(commands.length, 0);
    const initialInput = window.__cssoccerDebug.inspect().input;
    assert.deepEqual(initialInput, {
      schema: "cssoccer-debug-input@1",
      focused: true,
      paused: false,
      keyboardCodes: [],
      lastCommand: null,
    });
    assertFrozenInputSnapshot(initialInput);
    assert.equal(window.__cssoccerDebug.setInput, undefined);
    assert.equal(window.__cssoccerDebug.applyInput, undefined);
    assert.deepEqual(window.__cssoccerDebug.events(), []);
    assert.throws(() => initialInput.keyboardCodes.push("KeyW"), TypeError);
    assert.deepEqual(window.__cssoccerDebug.inspect().input.keyboardCodes, []);

    key(window, "keydown", "KeyW");
    assertCanonicalCommand(commands.at(-1), {
      tick: 0,
      moveX: 0,
      moveY: -127,
      buttons: 0,
    });
    assert.deepEqual(window.__cssoccerDebug.inspect().input, {
      schema: "cssoccer-debug-input@1",
      focused: true,
      paused: false,
      keyboardCodes: ["KeyW"],
      lastCommand: commands.at(-1),
    });
    key(window, "keydown", "KeyD");
    assertCanonicalCommand(commands.at(-1), {
      tick: 0,
      moveX: 90,
      moveY: -90,
      buttons: 0,
    });
    key(window, "keyup", "KeyW");
    assertCanonicalCommand(commands.at(-1), {
      tick: 0,
      moveX: 127,
      moveY: 0,
      buttons: 0,
    });
    key(window, "keyup", "KeyD");

    const touchUp = window.document.querySelector("[data-cssoccer-control='move-up']");
    pointer(touchUp, window, "pointerdown", 7);
    assertCanonicalCommand(commands.at(-1), {
      tick: 0,
      moveX: 0,
      moveY: -127,
      buttons: 0,
    });
    assert.equal(touchUp.getAttribute("aria-pressed"), "true");
    assert.equal(window.document.body.dataset.inputMode, "touch");
    pointer(window, window, "pointercancel", 7);
    assertCanonicalCommand(commands.at(-1), neutralCommand(0));
    assert.equal(touchUp.getAttribute("aria-pressed"), "false");

    let beforeIgnored = commands.length;
    assert.equal(key(window, "keydown", "Enter").defaultPrevented, false);
    assert.equal(key(window, "keydown", "ShiftLeft").defaultPrevented, false);
    for (const modifier of ["metaKey", "ctrlKey", "altKey"]) {
      assert.equal(
        key(window, "keydown", "KeyJ", window, { [modifier]: true }).defaultPrevented,
        false,
      );
    }
    assert.equal(commands.length, beforeIgnored, "UI and browser shortcuts stay outside gameplay");

    const debugDown = key(window, "keydown", "KeyX");
    assert.equal(debugDown.defaultPrevented, true);
    assert.equal(window.__cssoccerDebug.debugPanelState().visible, true);
    assert.equal(window.document.getElementById("cssoccer-debug-panel").hidden, false);
    assert.equal(window.document.getElementById("cssoccer-debug-recording-toggle").textContent, "RECORD");
    assert.equal(key(window, "keyup", "KeyX").defaultPrevented, true);
    key(window, "keydown", "KeyX", window, { repeat: true });
    assert.equal(window.__cssoccerDebug.debugPanelState().visible, true);
    key(window, "keydown", "KeyX");
    key(window, "keyup", "KeyX");
    assert.equal(window.__cssoccerDebug.debugPanelState().visible, false);
    assert.equal(commands.length, beforeIgnored, "debug shortcut never enters gameplay input");

    const interactive = window.document.createElement("button");
    window.document.body.append(interactive);
    assert.equal(key(window, "keydown", "KeyJ", interactive).defaultPrevented, false);
    assert.equal(commands.length, beforeIgnored, "interactive targets retain their keyboard events");
    interactive.remove();

    key(window, "keydown", "KeyJ");
    assert.equal(commands.at(-1).buttons, 1);
    const beforeRepeat = commands.length;
    assert.equal(key(window, "keydown", "KeyJ", window, { repeat: true }).defaultPrevented, true);
    assert.equal(commands.length, beforeRepeat, "repeated gameplay keydown does not republish");
    key(window, "keyup", "KeyJ", window, { ctrlKey: true });
    assertCanonicalCommand(commands.at(-1), neutralCommand(0));
    beforeIgnored = commands.length;
    key(window, "keyup", "KeyJ", window, { metaKey: true });
    assert.equal(commands.length, beforeIgnored, "out-of-order modified keyup stays silent");

    key(window, "keydown", "KeyW");
    const beforePause = commands.length;
    key(window, "keydown", "Escape");
    assert.equal(commands.length, beforePause + 1, "pause publishes one neutral transition");
    assertCanonicalCommand(commands.at(-1), neutralCommand(0));
    assert.equal(window.document.body.dataset.matchPaused, "true");
    assert.deepEqual(window.__cssoccerDebug.inspect().input, {
      schema: "cssoccer-debug-input@1",
      focused: true,
      paused: true,
      keyboardCodes: [],
      lastCommand: neutralCommand(0),
    });
    const beforePausedInput = commands.length;
    key(window, "keydown", "KeyD");
    assert.equal(commands.length, beforePausedInput, "paused gameplay presses stay silent");
    assertCanonicalCommand(commands.at(-1), neutralCommand(0));
    key(window, "keydown", "Escape", window, { repeat: true });
    assert.equal(commands.length, beforePausedInput, "repeated pause keydown stays silent");
    assert.equal(window.document.body.dataset.matchPaused, "true");
    key(window, "keydown", "Escape");
    assert.equal(commands.length, beforePausedInput + 1, "resume publishes one neutral transition");
    assert.equal(window.document.body.dataset.matchPaused, "false");

    key(window, "keydown", "ArrowLeft");
    window.dispatchEvent(new window.Event("blur"));
    assertCanonicalCommand(commands.at(-1), neutralCommand(0));
    assert.equal(window.document.body.dataset.matchFocused, "false");
    assert.deepEqual(window.__cssoccerDebug.inspect().input, {
      schema: "cssoccer-debug-input@1",
      focused: false,
      paused: false,
      keyboardCodes: [],
      lastCommand: neutralCommand(0),
    });
    const beforeBlurredInput = commands.length;
    key(window, "keydown", "ArrowRight");
    assert.equal(commands.length, beforeBlurredInput, "blurred gameplay presses stay silent");
    assertCanonicalCommand(commands.at(-1), neutralCommand(0));
    window.dispatchEvent(new window.Event("focus"));
    assert.equal(window.document.body.dataset.matchFocused, "true");

    key(window, "keydown", "Space");
    assert.equal(commands.at(-1).buttons, 1);
    const liveInput = window.__cssoccerDebug.inspect().input;
    assert.deepEqual(liveInput.keyboardCodes, ["Space"]);
    assertCanonicalCommand(liveInput.lastCommand, {
      tick: 0,
      moveX: 0,
      moveY: 0,
      buttons: 1,
    });
    assertFrozenInputSnapshot(liveInput);
    assert.equal(window.__cssoccerDebug.chooseCountry, undefined);
    const beforeDestroy = commands.length;
    client.destroy();
    assert.equal(commands.length, beforeDestroy + 1);
    assertCanonicalCommand(commands.at(-1), neutralCommand(0));
    assert.equal(window.__cssoccerDebug, undefined);
    key(window, "keydown", "KeyW");
    assert.equal(commands.length, beforeDestroy + 1, "destroy removes browser listeners");
  } finally {
    client.destroy();
    window.close();
  }
});

test("canonical client exposes only its current free-play engine and read-only state", preparedOptions, async () => {
  const window = routeWindow();
  const client = mountCssoccerClient({
    document: window.document,
    window,
    fetchImpl: preparedFetch,
  });
  try {
    await chooseCountryAndBoot(client, window, "argentina");
    assert.equal(client.state.engine.schema, "cssoccer-free-play-engine@1");
    assert.equal(Object.hasOwn(client.state, "oracleEngine"), false);
    assert.equal(Object.hasOwn(client.state, "oracleEngineIndependence"), false);
    assert.equal(window.__cssoccerDebug.oracleCaptureStatus, undefined);
    assert.equal(window.__cssoccerDebug.captureOraclePostTick, undefined);
    const snapshot = client.state.engine.snapshot();
    assert.equal(snapshot.schema, "cssoccer-free-play-snapshot@1");
    assert.equal(snapshot.match, client.state.matchState);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(window.__cssoccerDebug.stepProductTick, undefined);
    assert.equal(typeof window.__cssoccerDebug.performanceTraceContract, "function");
    assert.equal(typeof window.__cssoccerDebug.runPerformanceTraceWindow, "function");
    assert.equal(typeof window.__cssoccerDebug.beginVisualCapture, "function");
    assert.equal(typeof window.__cssoccerDebug.endVisualCapture, "function");
    assert.equal(typeof window.__cssoccerDebug.visualCaptureState, "function");
    assert.deepEqual(window.__cssoccerDebug.inspect().engine, {
      schema: "cssoccer-free-play-engine@1",
      snapshotSchema: "cssoccer-free-play-snapshot@1",
      tick: 0,
      phase: "opening-kickoff",
      paused: false,
    });
    assert.deepEqual(window.__cssoccerDebug.inspect().events, []);
  } finally {
    client.destroy();
    window.close();
  }
});

test("canonical client rematches terminal browser-owned state on the same prepared roots", preparedOptions, async () => {
  const window = routeWindow();
  const client = mountCssoccerClient({
    document: window.document,
    window,
    fetchImpl: preparedFetch,
  });
  try {
    await chooseCountryAndBoot(client, window, "argentina");
    const roots = [...window.document.querySelectorAll("[data-cssoccer-root-id]")];
    const engine = client.state.engine;
    while (!engine.snapshot().match.clock.terminal) {
      const before = engine.snapshot();
      assert.ok(before.tick < 5_000, "client rematch fixture must reach full time");
      engine.step({ tick: before.tick, moveX: 0, moveY: 0, buttons: 0 });
    }
    const terminal = engine.snapshot();
    client.state.matchState = terminal.match;
    client.state.liveFrame = { terminal: true, tick: terminal.tick };

    key(window, "keydown", "Enter");
    await waitFor(() => client.state.ready && client.state.liveFrame?.tick === 0);

    const inspected = window.__cssoccerDebug.inspect();
    assert.equal(
      inspected.ready,
      true,
      JSON.stringify(window.__cssoccerDebug.errors()),
    );
    assert.equal(inspected.status, "ready");
    assert.equal(inspected.live.tick, 0);
    assert.equal(inspected.live.terminal, false);
    assert.deepEqual(inspected.live.score, { spain: 0, argentina: 0 });
    assert.equal(client.state.matchState.session.rematchIndex, 1);
    assert.deepEqual(
      [...window.document.querySelectorAll("[data-cssoccer-root-id]")],
      roots,
    );
    assert.deepEqual(window.__cssoccerDebug.errors(), []);
  } finally {
    client.destroy();
    window.close();
  }
});

test("canonical live route advances at 20 Hz, renders stable roots, and freezes on pause or blur", preparedOptions, async () => {
  const window = routeWindow();
  const animationFrames = installManualAnimationFrames(window);
  const commands = [];
  const client = mountCssoccerClient({
    document: window.document,
    window,
    fetchImpl: preparedFetch,
    liveScheduler: true,
    consumeInputCommand(command) {
      commands.push(command);
    },
  });
  try {
    await chooseCountryAndBoot(client, window, "argentina");
    assert.equal(window.__cssoccerDebug.inspect().live.tick, 0);
    assert.equal(client.state.mount.stats().lastLiveRenderTick, 0);
    assert.equal(commands.length, 0);
    const engine = client.state.engine;
    const selectedRoot = client.state.mount.getHandle("argentina-player-10");
    const selectedElement = selectedRoot.element;
    const positionAtKickoff = [...selectedRoot.transform.position];

    key(window, "keydown", "KeyX");
    key(window, "keyup", "KeyX");
    const recordButton = window.document.getElementById("cssoccer-debug-recording-toggle");
    recordButton.click();
    assert.equal(recordButton.textContent, "STOP");
    assert.equal(window.__cssoccerDebug.recordingStatus().recording, true);
    key(window, "keydown", "KeyW");
    await animationFrames.step(0);
    await animationFrames.step(50);
    recordButton.click();
    const manualTrace = window.__cssoccerDebug.lastRecording();
    assert.equal(recordButton.textContent, "RECORD");
    assert.equal(manualTrace.schema, "cssoccer-manual-performance-trace@1");
    assert.deepEqual(manualTrace.samples.map(({ reason }) => reason), ["start", "stop"]);
    assert.deepEqual(manualTrace.samples.map(({ snapshot }) => snapshot.tick), [0, 1]);
    assert.equal(manualTrace.summary.frameTiming.frames, 1);
    assert.equal(manualTrace.summary.frameTiming.p95Ms, 50);
    assert.equal(manualTrace.summary.frameTiming.longFramesOver33Ms, 1);
    assert.equal(manualTrace.summary.product.tickCount, 1);
    assert.equal(manualTrace.summary.product.animationFrameCallbacks.samples, 2);
    assert.equal(manualTrace.summary.product.productSimulationMs.samples, 1);
    assert.equal(manualTrace.summary.product.preparedLivePublicationMs.samples, 1);
    assert.equal(manualTrace.samples[1].snapshot.dom.rootCount, 37);
    assert.equal(manualTrace.samples[1].snapshot.dom.playerRootCount, 22);
    assert.equal(manualTrace.samples[1].snapshot.publication.runtimeConstructionCount, 0);
    assert.equal(manualTrace.events.some(({ kind }) => kind === "keyboard-input"), true);
    assert.equal(window.document.getElementById("cssoccer-debug-recording-copy").hidden, false);
    key(window, "keyup", "KeyW");
    const touchUp = window.document.querySelector("[data-cssoccer-control='move-up']");
    pointer(touchUp, window, "pointerdown", 7);
    assert.equal(window.document.body.dataset.inputMode, "touch");
    key(window, "keydown", "KeyX");
    key(window, "keyup", "KeyX");
    assert.equal(window.__cssoccerDebug.debugPanelState().visible, false);
    for (let tick = 2; tick <= 190; tick += 1) {
      await animationFrames.step(tick * 50);
    }
    const live = window.__cssoccerDebug.inspect().live;
    assert.equal(live.tick, 190);
    assert.equal(live.selectedPlayerId, "argentina-player-10");
    assert.equal(client.state.engine, engine, "keyboard and touch advance one engine instance");
    const currentSnapshot = client.state.engine.snapshot();
    const currentDebug = window.__cssoccerDebug.inspect();
    assert.equal(currentSnapshot.tick, 190);
    assert.equal(currentSnapshot.match, client.state.matchState);
    assert.equal(client.state.mount.stats().lastLiveRenderTick, 190);
    assert.equal(currentDebug.engine.tick, 190);
    assert.equal(currentDebug.match.tick, 190);
    assert.equal(currentDebug.live.tick, 190);
    assert.deepEqual(client.state.hudState.clock, {
      minutes: currentDebug.live.clock.minutes,
      seconds: currentDebug.live.clock.seconds,
    });
    assert.deepEqual(Object.keys(client.state.hudState).sort(), ["clock", "schema"]);
    assert.equal(client.state.lastInputCommand.tick, 189);
    const movementBasis = client.state.mount.gameplayInputBasis();
    const heldMagnitude = Math.hypot(
      client.state.lastInputCommand.moveX,
      client.state.lastInputCommand.moveY,
    );
    const heldForwardDot = -(
      client.state.lastInputCommand.moveX * movementBasis.screenDown[0]
      + client.state.lastInputCommand.moveY * movementBasis.screenDown[1]
    );
    assert.ok(heldMagnitude >= 126 && heldMagnitude <= 128);
    assert.ok(heldForwardDot > 125);
    assert.equal(commands.length, 190);
    assert.deepEqual(commands.map(({ tick }) => tick), range(0, 189));
    assert.notDeepEqual(selectedRoot.transform.position, positionAtKickoff);
    assert.equal(client.state.mount.getHandle("argentina-player-10").element, selectedElement);
    assert.equal(client.state.mount.stats().stableIdentityCount, 37);
    assert.deepEqual(client.state.mount.stats().runtimeConstruction, {
      sourceParseCount: 0,
      geometryBuildCount: 0,
      topologyBuildCount: 0,
      materialBuildCount: 0,
      assetBuildCount: 0,
      atlasBuildCount: 0,
    });

    key(window, "keydown", "Escape");
    await animationFrames.step(9_550);
    await animationFrames.step(9_600);
    assert.equal(window.__cssoccerDebug.inspect().live.tick, 190);
    assert.equal(commands.length, 190);

    key(window, "keydown", "Escape");
    await animationFrames.step(9_650);
    await animationFrames.step(9_700);
    assert.equal(window.__cssoccerDebug.inspect().live.tick, 191);
    assertCanonicalCommand(commands.at(-1), neutralCommand(190));

    window.dispatchEvent(new window.Event("blur"));
    await animationFrames.step(9_750);
    await animationFrames.step(9_800);
    assert.equal(window.__cssoccerDebug.inspect().live.tick, 191);
    window.dispatchEvent(new window.Event("focus"));
    await animationFrames.step(9_850);
    await animationFrames.step(9_900);
    assert.equal(window.__cssoccerDebug.inspect().live.tick, 192);
    assertCanonicalCommand(commands.at(-1), neutralCommand(191));
    assert.equal(client.state.mount.getHandle("argentina-player-10").element, selectedElement);

    assert.deepEqual(window.__cssoccerDebug.beginVisualCapture(), {
      frozen: true,
      depth: 1,
      tick: 192,
      phase: window.__cssoccerDebug.inspect().live.phase,
    });
    assert.equal(window.document.body.dataset.visualCaptureFrozen, "true");
    await animationFrames.step(9_950);
    await animationFrames.step(10_000);
    assert.equal(window.__cssoccerDebug.inspect().live.tick, 192);
    assert.deepEqual(window.__cssoccerDebug.endVisualCapture(), {
      frozen: false,
      depth: 0,
      tick: 192,
      phase: window.__cssoccerDebug.inspect().live.phase,
    });
    assert.equal(window.document.body.dataset.visualCaptureFrozen, undefined);
    await animationFrames.step(10_050);
    await animationFrames.step(10_100);
    assert.equal(window.__cssoccerDebug.inspect().live.tick, 193);
  } finally {
    client.destroy();
    assert.equal(animationFrames.pending(), 0);
    assert.equal(window.document.getElementById("cssoccer-debug-root"), null);
    window.close();
  }
});

test("the product route exposes only the two-team selector and match controls", () => {
  const window = routeWindow();
  try {
    const countryChoice = window.document.getElementById("country-choice");
    assert.ok(countryChoice);
    assert.equal(countryChoice.hidden, true);
    assert.deepEqual(
      [...window.document.querySelectorAll("[data-country-choice]")]
        .map(({ dataset }) => dataset.countryChoice),
      ["spain", "argentina"],
    );
    assert.deepEqual(
      [...window.document.querySelectorAll("[data-cssoccer-control]")]
        .map(({ dataset }) => dataset.cssoccerControl),
      ["move-up", "move-left", "move-down", "move-right", "fire-1", "fire-2"],
    );
    assert.ok(window.document.getElementById("match-hud"));
    assert.ok(window.document.getElementById("touch-controls"));
    assert.ok(window.document.getElementById("status"));
    assert.equal(window.document.querySelector("input, select, [data-duration]"), null);
    assert.equal(window.document.getElementById("scene").getAttribute("tabindex"), "0");
    assert.equal(window.document.querySelector("main")?.children.length, 5);
    assert.doesNotMatch(INDEX_HTML, /duration|match length|minutes per half/iu);
  } finally {
    window.close();
  }
});

function routeWindow() {
  const window = new Window({ url: "http://cssoccer.test/" });
  window.document.write(INDEX_HTML);
  window.document.close();
  installManualPopover(window.document.getElementById("match-hud"));
  return window;
}

function installManualPopover(host) {
  Object.defineProperties(host, {
    showPopover: {
      configurable: true,
      value() { this.dataset.testPopoverOpen = "true"; },
    },
    hidePopover: {
      configurable: true,
      value() { delete this.dataset.testPopoverOpen; },
    },
  });
}

function installManualAnimationFrames(window) {
  let nextId = 1;
  const callbacks = new Map();
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value(callback) {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value(id) {
      callbacks.delete(id);
    },
  });
  return {
    pending() {
      return callbacks.size;
    },
    async step(timestamp) {
      assert(callbacks.size >= 1, "the live route owns at least one animation frame");
      const current = [...callbacks];
      for (const [id] of current) callbacks.delete(id);
      for (const [, callback] of current) callback(timestamp);
      if (callbacks.size === 0) {
        await waitFor(() => callbacks.size >= 1);
      }
    },
  };
}

async function preparedFetch(input) {
  const url = new URL(String(input), "http://cssoccer.test/");
  if (!url.pathname.startsWith("/cssoccer/")) return new Response("not found", { status: 404 });
  const relative = url.pathname.slice("/cssoccer/".length);
  if (!preparedBytes.has(relative)) {
    preparedBytes.set(relative, readFile(new URL(relative, GENERATED_ROOT)));
  }
  try {
    return new Response(await preparedBytes.get(relative), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

function key(window, type, code, target = window, options = {}) {
  const event = new window.KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    code,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

function pointer(target, window, type, pointerId) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  target.dispatchEvent(event);
  return event;
}

function assertCanonicalCommand(actual, expected) {
  assert.deepEqual(actual, expected);
  assert.deepEqual(Object.keys(actual).sort(), ["buttons", "moveX", "moveY", "tick"]);
  assert.equal(Object.isFrozen(actual), true);
}

function assertFrozenInputSnapshot(snapshot) {
  assert.equal(Object.getPrototypeOf(snapshot), Object.prototype);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.keyboardCodes), true);
  if (snapshot.lastCommand !== null) {
    assert.equal(Object.getPrototypeOf(snapshot.lastCommand), Object.prototype);
    assert.equal(Object.isFrozen(snapshot.lastCommand), true);
  }
}

function neutralCommand(tick) {
  return { tick, moveX: 0, moveY: 0, buttons: 0 };
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

async function waitFor(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for client state.");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function chooseCountryAndBoot(client, window, country) {
  await waitFor(() => client.state.status === "choosing-country");
  const button = window.document.querySelector(`[data-country-choice='${country}']`);
  assert.ok(button, `missing ${country} team choice`);
  button.click();
  await client.boot;
  assert.equal(client.state.controlCountry, country);
}

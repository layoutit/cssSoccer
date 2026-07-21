import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Window } from "happy-dom";

import {
  CSSOCCER_NATIVE_HUD_STATE_SCHEMA,
  assertCssoccerNativeHudState,
  createCssoccerNativeHudState,
  createCssoccerNativeHudView,
  projectCssoccerNormalTimeHudClock,
} from "../src/cssoccer/nativeHudView.mjs";

const INDEX_HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const STYLES = readFileSync(new URL("../src/cssoccer/styles.css", import.meta.url), "utf8");

test("route keeps team and touch input outside the source-faithful native HUD", () => {
  const window = routeWindow();
  try {
    const countryChoice = window.document.getElementById("country-choice");
    assert.equal(countryChoice.hidden, true);
    assert.equal(countryChoice.getAttribute("role"), "dialog");
    assert.deepEqual(
      [...countryChoice.querySelectorAll("[data-country-choice]")]
        .map(({ dataset }) => dataset.countryChoice),
      ["spain", "argentina"],
    );
    const touch = window.document.getElementById("touch-controls");
    assert.equal(touch.parentElement.id, "app");
    assert.deepEqual(
      [...touch.querySelectorAll("[data-cssoccer-control]")]
        .map(({ dataset }) => dataset.cssoccerControl),
      ["move-up", "move-left", "move-down", "move-right", "fire-1", "fire-2"],
    );

    const hud = window.document.getElementById("match-hud");
    assert.equal(hud.hidden, true);
    assert.equal(hud.getAttribute("popover"), "manual");
    assert.equal(hud.getAttribute("aria-label"), "Native Actua match display");
    assert.equal(window.document.getElementById("hud-clock").tagName, "TIME");
    assert.equal(hud.querySelectorAll("[data-native-hud-glyph-slot]").length, 5);
    assert.equal(
      hud.querySelector("#hud-scorebar, #hud-scoreboard, #hud-half, #hud-notice, #hud-footer, #hud-actions"),
      null,
    );
    assert.doesNotMatch(hud.textContent, /Full Match Alpha|Playing as|Pause|Kick-off|WASD/u);
    assert.match(
      STYLES,
      /spain-argentina-hud-glyphs\.png/u,
      "the runtime uses the prepared native glyph atlas",
    );
    assert.match(STYLES, /image-rendering:\s*pixelated;/u);
    assert.match(
      STYLES,
      /#match-hud\s*\{[^}]*z-index:\s*2147483647;/su,
      "the native framebuffer HUD stays above every source-camera 3D depth",
    );
  } finally {
    window.close();
  }
});

test("source period-readiness time projects onto fixed normal time", () => {
  assert.deepEqual(
    projectCssoccerNormalTimeHudClock({ minutes: 90, seconds: 2.25 }),
    { minutes: 90, seconds: 0 },
  );
  assert.deepEqual(
    projectCssoccerNormalTimeHudClock({ minutes: 44, seconds: 59.75 }),
    { minutes: 44, seconds: 59.75 },
  );
  assert.throws(
    () => projectCssoccerNormalTimeHudClock({ minutes: -1, seconds: 0 }),
    /non-negative match time/u,
  );
});

test("native HUD state contains only the source clock", () => {
  const state = createCssoccerNativeHudState();
  assert.deepEqual(state, {
    schema: CSSOCCER_NATIVE_HUD_STATE_SCHEMA,
    clock: { minutes: 0, seconds: 0 },
  });
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.clock));
  assert.doesNotThrow(() => assertCssoccerNativeHudState(state));
  for (const legacyKey of ["goals", "notice", "phase", "selectedCountry", "activePlayer", "inputMode"]) {
    assert.throws(
      () => createCssoccerNativeHudState({ [legacyKey]: null }),
      new RegExp(`does not accept ${legacyKey}`, "u"),
    );
  }
  assert.throws(
    () => createCssoccerNativeHudState({ clock: { minutes: 90, seconds: 1 } }),
    /0:00\.\.90:00/u,
  );
});

test("native HUD selects proportional prepared glyphs for the Actua clock", () => {
  const window = routeWindow();
  try {
    const view = createCssoccerNativeHudView({
      host: window.document.getElementById("match-hud"),
    });
    view.render(createCssoccerNativeHudState({
      clock: { minutes: 1, seconds: 52.5 },
    }));
    const clock = window.document.getElementById("hud-clock");
    const slots = [...clock.querySelectorAll("[data-native-hud-glyph-slot]")];
    assert.equal(clock.dataset.nativeHudText, "1:52");
    assert.equal(clock.getAttribute("datetime"), "PT1M52S");
    assert.equal(clock.getAttribute("aria-label"), "1 minutes 52 seconds");
    assert.deepEqual(slots.map(({ hidden, dataset }) => (
      hidden ? null : dataset.glyph
    )), [null, "1", ":", "5", "2"]);

    view.render(createCssoccerNativeHudState({
      clock: { minutes: 46, seconds: 7.75 },
    }));
    assert.equal(clock.dataset.nativeHudText, "46:07");
    assert.deepEqual(slots.map(({ hidden, dataset }) => (
      hidden ? null : dataset.glyph
    )), ["4", "6", ":", "0", "7"]);

    view.destroy();
    assert.equal(window.document.getElementById("match-hud").hidden, true);
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

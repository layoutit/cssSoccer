export const CSSOCCER_NATIVE_HUD_STATE_SCHEMA = "cssoccer-native-hud-state@1";

const HUD_STATE_KEYS = Object.freeze(["clock", "schema"]);
const CLOCK_SLOT_COUNT = 5;
const CLOCK_GLYPHS = /^[0-9:]$/u;

export function createCssoccerNativeHudState(options = {}) {
  requirePlainObject(options, "cssoccer native HUD options");
  requireOnlyKeys(options, ["clock"], "cssoccer native HUD options");
  return assertCssoccerNativeHudState(deepFreeze({
    schema: CSSOCCER_NATIVE_HUD_STATE_SCHEMA,
    clock: clone(options.clock ?? { minutes: 0, seconds: 0 }),
  }));
}

export function projectCssoccerNormalTimeHudClock(clock) {
  requirePlainObject(clock, "cssoccer source clock");
  requireExactKeys(clock, ["minutes", "seconds"], "cssoccer source clock");
  if (
    !Number.isInteger(clock.minutes)
    || clock.minutes < 0
    || !Number.isFinite(clock.seconds)
    || clock.seconds < 0
    || clock.seconds >= 60
  ) {
    throw new RangeError("cssoccer source clock must be a non-negative match time.");
  }
  return deepFreeze(clock.minutes >= 90
    ? { minutes: 90, seconds: 0 }
    : { minutes: clock.minutes, seconds: clock.seconds });
}

export function assertCssoccerNativeHudState(state) {
  requirePlainObject(state, "cssoccer native HUD state");
  requireExactKeys(state, HUD_STATE_KEYS, "cssoccer native HUD state");
  if (state.schema !== CSSOCCER_NATIVE_HUD_STATE_SCHEMA) {
    throw new Error(`cssoccer native HUD state must use ${CSSOCCER_NATIVE_HUD_STATE_SCHEMA}.`);
  }
  requirePlainObject(state.clock, "cssoccer native HUD clock");
  requireExactKeys(state.clock, ["minutes", "seconds"], "cssoccer native HUD clock");
  if (
    !Number.isInteger(state.clock.minutes)
    || state.clock.minutes < 0
    || state.clock.minutes > 90
    || !Number.isFinite(state.clock.seconds)
    || state.clock.seconds < 0
    || state.clock.seconds >= 60
    || (state.clock.minutes === 90 && state.clock.seconds !== 0)
  ) {
    throw new RangeError("cssoccer native HUD clock must stay inside 0:00..90:00.");
  }
  return state;
}

export function createCssoccerNativeHudView({ host } = {}) {
  if (!host || host.id !== "match-hud" || typeof host.querySelector !== "function") {
    throw new Error("cssoccer native HUD view requires the #match-hud host.");
  }
  if (
    host.getAttribute("popover") !== "manual"
    || typeof host.showPopover !== "function"
    || typeof host.hidePopover !== "function"
  ) {
    throw new Error("cssoccer native HUD requires the browser manual Popover top layer.");
  }
  const clock = host.querySelector("#hud-clock");
  const glyphSlots = [...host.querySelectorAll("[data-native-hud-glyph-slot]")];
  if (!clock || clock.tagName !== "TIME" || glyphSlots.length !== CLOCK_SLOT_COUNT) {
    throw new Error("cssoccer native HUD requires one clock and five prepared glyph slots.");
  }

  let destroyed = false;
  let popoverOpen = false;
  return Object.freeze({
    render(state) {
      if (destroyed) throw new Error("cssoccer native HUD view has been destroyed.");
      const current = assertCssoccerNativeHudState(state);
      renderClock(host, clock, glyphSlots, current.clock);
      if (!popoverOpen || !host.matches(":popover-open")) {
        host.showPopover();
        popoverOpen = true;
      }
      return current;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (popoverOpen) {
        host.hidePopover();
        popoverOpen = false;
      }
      host.hidden = true;
    },
  });
}

function renderClock(host, clock, glyphSlots, value) {
  const seconds = Math.floor(value.seconds);
  const text = `${value.minutes}:${String(seconds).padStart(2, "0")}`;
  if (text.length > CLOCK_SLOT_COUNT) {
    throw new RangeError("cssoccer native HUD clock exceeds its five prepared glyph slots.");
  }
  const glyphs = text.padStart(CLOCK_SLOT_COUNT, " ");
  for (let index = 0; index < glyphSlots.length; index += 1) {
    const slot = glyphSlots[index];
    const glyph = glyphs[index];
    if (glyph === " ") {
      slot.hidden = true;
      delete slot.dataset.glyph;
      continue;
    }
    if (!CLOCK_GLYPHS.test(glyph)) {
      throw new Error(`cssoccer native HUD has no prepared glyph for ${glyph}.`);
    }
    slot.dataset.glyph = glyph;
    slot.hidden = false;
  }
  clock.setAttribute("datetime", `PT${value.minutes}M${seconds}S`);
  clock.setAttribute("aria-label", `${value.minutes} minutes ${seconds} seconds`);
  clock.dataset.nativeHudText = text;
  host.hidden = false;
}

function requireOnlyKeys(value, keys, label) {
  const unexpected = Object.keys(value).filter((key) => !keys.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} does not accept ${unexpected.join(", ")}.`);
  }
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

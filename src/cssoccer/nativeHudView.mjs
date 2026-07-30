import { CSSOCCER_MATCH_MODE } from "./boundaryState.mjs";

export const CSSOCCER_NATIVE_HUD_STATE_SCHEMA = "cssoccer-native-hud-state@7";

const HUD_STATE_KEYS = Object.freeze([
  "cameraMessage",
  "clock",
  "goalHistory",
  "halftimeTransitionTicks",
  "justScored",
  "kickoffMenuActive",
  "matchMode",
  "phase",
  "possession",
  "restartMenuActive",
  "schema",
  "score",
  "tick",
]);
const CLOCK_SLOT_COUNT = 5;
const CAMERA_MESSAGE_SLOT_COUNT = 4;
const POSSESSION_SLOT_COUNT = 20;
const SCORE_SLOT_COUNT = 5;
const TEAM_A = "SPAIN";
const TEAM_B = "ARGENTINA";
const NATIVE_VIEWPORT_WIDTH = 640;
const NATIVE_VIEWPORT_HEIGHT = 400;
const FONT_ASCII_BASE = 48;
const FONT_BAND_HEIGHT = 135;
const FONT_PROFILES = deepFreeze({
  normal: {
    id: "normal",
    columns: 9,
    cellWidth: 16,
    cellHeight: 14,
    atlasBandY: 0,
    offset: 0,
    presentationScale: 2,
    widths: [
      7, 6, 7, 7, 7, 7, 7, 7, 7, 7, 3, 4, 6, 7, 6, 4,
      3, 7, 7, 7, 7, 7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 7,
      7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 7,
    ],
  },
  menu: {
    id: "menu",
    columns: 10,
    cellWidth: 16,
    cellHeight: 13,
    atlasBandY: 70,
    offset: 7,
    presentationScale: 1,
    widths: [
      11, 8, 11, 11, 11, 10, 11, 11, 11, 11, 5, 9, 11, 11, 11, 7,
      5, 14, 11, 12, 12, 9, 9, 14, 12, 5, 8, 13, 9, 16, 13, 14,
      11, 14, 12, 10, 11, 12, 13, 16, 14, 11, 13,
    ],
  },
});
const COLOR_BAND_INDEX = Object.freeze({
  neutral: 0,
  "team-a": 1,
  "team-b": 2,
  heading: 3,
  scorer: 4,
});
const SOURCE_HALFTIME_PHASES = new Set(["halftime-whistle", "halftime-transition"]);
const SOURCE_FULL_TIME_PHASE = "full-time-terminal";
const SOURCE_HALFTIME_BOUNDARY_PHASE = "halftime-end-swap-second-half-kickoff";
const SOURCE_PHASES = new Set([
  "opening-kickoff",
  "first-half-live-clock",
  ...SOURCE_HALFTIME_PHASES,
  SOURCE_HALFTIME_BOUNDARY_PHASE,
  "second-half-live-clock",
  SOURCE_FULL_TIME_PHASE,
]);
const HALFTIME_MENU_MAX_SLIDE = 108;
const HALFTIME_MENU_SLIDE_PER_TICK = 5;
const SOURCE_CAMERA_MESSAGE_RENDER_TICKS = 40;
const SOURCE_KICKOFF_MENU_SLIDE = 44;
const SOURCE_KICKOFF_MENU_HOLD = 240;
const SOURCE_MENU_RATE_PER_RENDER_TICK = 5;
const SOURCE_KICKOFF_MENU_RENDER_TICKS = (
  Math.ceil(SOURCE_KICKOFF_MENU_SLIDE / SOURCE_MENU_RATE_PER_RENDER_TICK)
  + Math.ceil(SOURCE_KICKOFF_MENU_HOLD / SOURCE_MENU_RATE_PER_RENDER_TICK)
  + Math.ceil(SOURCE_KICKOFF_MENU_SLIDE / SOURCE_MENU_RATE_PER_RENDER_TICK)
);
// RULES.CPP initializes corner, throw-in, and goal-kick menus immediately
// before the first rendered restart frame. The native render loop has already
// consumed that frame's five slide units, leaving 65 visible restart frames.
const SOURCE_RESTART_MENU_RENDER_TICKS = 65;

export function createCssoccerNativeHudState(options = {}) {
  requirePlainObject(options, "cssoccer native HUD options");
  requireOnlyKeys(
    options,
    [
      "clock",
      "goalHistory",
      "halftimeTransitionTicks",
      "justScored",
      "matchMode",
      "phase",
      "possession",
      "restartMenuStartedTick",
      "score",
      "tick",
    ],
    "cssoccer native HUD options",
  );
  const tick = options.tick ?? 0;
  const phase = options.phase ?? "opening-kickoff";
  const restartMenuStartedTick = options.restartMenuStartedTick ?? null;
  if (
    restartMenuStartedTick !== null
    && (
      !Number.isSafeInteger(restartMenuStartedTick)
      || restartMenuStartedTick < 0
      || restartMenuStartedTick > tick
    )
  ) {
    throw new TypeError(
      "cssoccer native HUD restartMenuStartedTick must be null or a prior non-negative tick.",
    );
  }
  const sourceRenderedTick = Math.max(0, tick - 1);
  return assertCssoccerNativeHudState(deepFreeze({
    schema: CSSOCCER_NATIVE_HUD_STATE_SCHEMA,
    cameraMessage: phase === "opening-kickoff"
      && sourceRenderedTick < SOURCE_CAMERA_MESSAGE_RENDER_TICKS
      ? "WIRE"
      : null,
    clock: clone(options.clock ?? { minutes: 0, seconds: 0 }),
    goalHistory: clone(options.goalHistory ?? []),
    halftimeTransitionTicks: options.halftimeTransitionTicks ?? 0,
    justScored: options.justScored ?? 0,
    kickoffMenuActive: phase === "opening-kickoff"
      && sourceRenderedTick < SOURCE_KICKOFF_MENU_RENDER_TICKS,
    matchMode: options.matchMode ?? CSSOCCER_MATCH_MODE.NORMAL,
    phase,
    possession: clone(options.possession ?? null),
    restartMenuActive: restartMenuStartedTick !== null
      && tick - restartMenuStartedTick < SOURCE_RESTART_MENU_RENDER_TICKS,
    score: clone(options.score ?? { spain: 0, argentina: 0 }),
    tick,
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

/**
 * Reproduce EURO_INT.CPP GetPLAYERSname(..., INITIAL_SURNAME).
 *
 * The retained native SCRIPT.96 fixture replaces the first two donor teams
 * with source roster names in title case. The original routine only recognizes
 * a surname as a run of uppercase letters, so "J.A. Goicoechea" intentionally
 * projects to "G." in the native halftime score breakdown.
 */
export function projectCssoccerNativeInitialSurname(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("cssoccer native player name must be a non-empty string.");
  }
  const output = [];
  const isUpper = (value) => value >= "A" && value <= "Z";
  const isLower = (value) => value >= "a" && value <= "z";

  for (let index = 0; index < name.length; index += 1) {
    if (isUpper(name[index]) && isLower(name[index + 1])) {
      output.push(name[index], ".", " ");
    }
    if (name[index] === "-" && output.length > 1) {
      output.splice(output.length - 2, 1, "-");
    }
  }

  for (let index = 0; index < name.length; index += 1) {
    if (isUpper(name[index]) && isUpper(name[index + 1])) {
      output.push(
        index > 0 && isUpper(name[index - 1])
          ? name[index].toLowerCase()
          : name[index],
      );
      continue;
    }
    if (isUpper(name[index]) && index > 0 && isUpper(name[index - 1])) {
      output.push(name[index].toLowerCase());
      if (name[index + 1] === " ") output.push(" ");
    }
  }

  return output.join("").trimEnd();
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
  requirePlainObject(state.score, "cssoccer native HUD score");
  requireExactKeys(state.score, ["argentina", "spain"], "cssoccer native HUD score");
  for (const country of ["spain", "argentina"]) {
    if (
      !Number.isSafeInteger(state.score[country])
      || state.score[country] < 0
      || state.score[country] > 99
    ) {
      throw new RangeError("cssoccer native HUD scores must stay inside 0..99.");
    }
  }
  if (!Number.isSafeInteger(state.tick) || state.tick < 0) {
    throw new TypeError("cssoccer native HUD tick must be a non-negative safe integer.");
  }
  if (state.cameraMessage !== null && state.cameraMessage !== "WIRE") {
    throw new Error("cssoccer native HUD camera message must be WIRE or null.");
  }
  if (typeof state.kickoffMenuActive !== "boolean") {
    throw new TypeError("cssoccer native HUD kickoff menu state must be boolean.");
  }
  if (typeof state.restartMenuActive !== "boolean") {
    throw new TypeError("cssoccer native HUD restart menu state must be boolean.");
  }
  if (!SOURCE_PHASES.has(state.phase)) {
    throw new Error(`cssoccer native HUD has no source presentation for ${String(state.phase)}.`);
  }
  if (
    !Number.isSafeInteger(state.matchMode)
    || state.matchMode < CSSOCCER_MATCH_MODE.NORMAL
    || state.matchMode > CSSOCCER_MATCH_MODE.SWAP_ENDS
  ) {
    throw new RangeError("cssoccer native HUD matchMode must stay inside 0..19.");
  }
  if (state.possession !== null) {
    requirePlainObject(state.possession, "cssoccer native HUD possession");
    requireExactKeys(
      state.possession,
      ["country", "label"],
      "cssoccer native HUD possession",
    );
    if (
      !["spain", "argentina"].includes(state.possession.country)
      || typeof state.possession.label !== "string"
      || state.possession.label.length === 0
      || state.possession.label.length > POSSESSION_SLOT_COUNT
    ) {
      throw new Error("cssoccer native HUD possession is invalid.");
    }
  }
  if (
    !Number.isSafeInteger(state.halftimeTransitionTicks)
    || state.halftimeTransitionTicks < 0
  ) {
    throw new TypeError(
      "cssoccer native HUD halftimeTransitionTicks must be a non-negative safe integer.",
    );
  }
  if (
    !Number.isSafeInteger(state.justScored)
    || state.justScored < 0
    || state.justScored > 220
  ) {
    throw new RangeError("cssoccer native HUD justScored must stay inside 0..220.");
  }
  if (!Array.isArray(state.goalHistory)) {
    throw new TypeError("cssoccer native HUD goalHistory must be an array.");
  }
  for (const entry of state.goalHistory) {
    requirePlainObject(entry, "cssoccer native HUD goal history entry");
    requireExactKeys(
      entry,
      ["country", "label", "minute"],
      "cssoccer native HUD goal history entry",
    );
    if (
      !["spain", "argentina"].includes(entry.country)
      || typeof entry.label !== "string"
      || entry.label.length === 0
      || entry.label.length > 24
      || !Number.isSafeInteger(entry.minute)
      || entry.minute < 1
      || entry.minute > 120
    ) {
      throw new Error("cssoccer native HUD goal history entry is invalid.");
    }
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
  materializeStableHudLeaves(host);
  const clock = host.querySelector("#hud-clock");
  const cameraMessage = host.querySelector("#hud-camera-message");
  const possessionTeamA = host.querySelector("#hud-possession-team-a");
  const possessionTeamB = host.querySelector("#hud-possession-team-b");
  const teamA = host.querySelector("#hud-team-a");
  const score = host.querySelector("#hud-score");
  const teamB = host.querySelector("#hud-team-b");
  const halftimeMenu = host.querySelector("#hud-halftime-menu");
  const halftimeHeading = host.querySelector("#hud-halftime-heading");
  const halftimeTeamA = host.querySelector("#hud-halftime-team-a");
  const halftimeScoreA = host.querySelector("#hud-halftime-score-a");
  const halftimeScoreB = host.querySelector("#hud-halftime-score-b");
  const halftimeTeamB = host.querySelector("#hud-halftime-team-b");
  const halftimeScorerA = host.querySelector("#hud-halftime-scorer-a");
  const halftimeScorerB = host.querySelector("#hud-halftime-scorer-b");
  const clockSlots = preparedGlyphSlots(clock);
  const cameraMessageSlots = preparedGlyphSlots(cameraMessage);
  const possessionTeamASlots = preparedGlyphSlots(possessionTeamA);
  const possessionTeamBSlots = preparedGlyphSlots(possessionTeamB);
  const teamASlots = preparedGlyphSlots(teamA);
  const scoreSlots = preparedGlyphSlots(score);
  const teamBSlots = preparedGlyphSlots(teamB);
  const halftimeTextRuns = {
    heading: preparedGlyphSlots(halftimeHeading),
    teamA: preparedGlyphSlots(halftimeTeamA),
    scoreA: preparedGlyphSlots(halftimeScoreA),
    scoreB: preparedGlyphSlots(halftimeScoreB),
    teamB: preparedGlyphSlots(halftimeTeamB),
    scorerA: preparedGlyphSlots(halftimeScorerA),
    scorerB: preparedGlyphSlots(halftimeScorerB),
  };
  if (
    !clock
    || clock.tagName !== "TIME"
    || !cameraMessage
    || !possessionTeamA
    || !possessionTeamB
    || !teamA
    || !score
    || !teamB
    || clockSlots.length !== CLOCK_SLOT_COUNT
    || cameraMessageSlots.length !== CAMERA_MESSAGE_SLOT_COUNT
    || possessionTeamASlots.length !== POSSESSION_SLOT_COUNT
    || possessionTeamBSlots.length !== POSSESSION_SLOT_COUNT
    || teamASlots.length !== TEAM_A.length
    || scoreSlots.length !== SCORE_SLOT_COUNT
    || teamBSlots.length !== TEAM_B.length
    || !halftimeMenu
    || halftimeTextRuns.heading.length !== 9
    || halftimeTextRuns.teamA.length !== TEAM_A.length
    || halftimeTextRuns.scoreA.length !== 2
    || halftimeTextRuns.scoreB.length !== 2
    || halftimeTextRuns.teamB.length !== TEAM_B.length
    || halftimeTextRuns.scorerA.length !== 32
    || halftimeTextRuns.scorerB.length !== 32
  ) {
    throw new Error("cssoccer native HUD requires its prepared match and halftime leaves.");
  }

  let destroyed = false;
  let popoverOpen = false;
  return Object.freeze({
    render(state) {
      if (destroyed) throw new Error("cssoccer native HUD view has been destroyed.");
      const current = assertCssoccerNativeHudState(state);
      renderClock(clock, clockSlots, current.clock);
      renderCameraMessage(cameraMessage, cameraMessageSlots, current.cameraMessage);
      renderPossession({
        current,
        teamA: possessionTeamA,
        teamASlots: possessionTeamASlots,
        teamB: possessionTeamB,
        teamBSlots: possessionTeamBSlots,
      });
      const scoreMenuVisible = SOURCE_HALFTIME_PHASES.has(current.phase)
        || current.phase === SOURCE_FULL_TIME_PHASE;
      // Once the halftime menu has slid away, the source framebuffer resumes
      // the normal bottom score during await_swap.
      const normalScoreVisible = !scoreMenuVisible
        && !current.kickoffMenuActive
        && !current.restartMenuActive
        && current.justScored === 0;
      if (scoreMenuVisible) {
        renderScoreMenu({
          menu: halftimeMenu,
          current,
          heading: current.phase === SOURCE_FULL_TIME_PHASE ? "FULL TIME" : "HALF TIME",
          elements: {
            heading: halftimeHeading,
            teamA: halftimeTeamA,
            scoreA: halftimeScoreA,
            scoreB: halftimeScoreB,
            teamB: halftimeTeamB,
            scorerA: halftimeScorerA,
            scorerB: halftimeScorerB,
          },
          slots: halftimeTextRuns,
        });
      } else {
        halftimeMenu.hidden = true;
      }
      for (const element of [teamA, score, teamB]) element.hidden = !normalScoreVisible;
      if (normalScoreVisible) {
        renderSourceText(teamA, teamASlots, TEAM_A, {
          anchorX: 280,
          y: 386,
          justification: "right",
          colorBand: "team-a",
          fontProfile: "menu",
        });
        renderSourceText(
          score,
          scoreSlots,
          `${current.score.spain}=${current.score.argentina}`,
          {
            anchorX: 320,
            y: 386,
            justification: "center",
            colorBand: "neutral",
            fontProfile: "menu",
          },
        );
        renderSourceText(teamB, teamBSlots, TEAM_B, {
          anchorX: 360,
          y: 386,
          justification: "left",
          colorBand: "team-b",
          fontProfile: "menu",
        });
      }
      score.setAttribute(
        "aria-label",
        `Spain ${current.score.spain}, Argentina ${current.score.argentina}`,
      );
      if (!popoverOpen || !host.matches(":popover-open")) {
        host.showPopover();
        popoverOpen = true;
      }
      host.hidden = false;
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

function renderCameraMessage(element, glyphSlots, message) {
  if (message === null) {
    element.hidden = true;
    return;
  }
  renderSourceText(element, glyphSlots, message, {
    anchorX: 320,
    y: 25,
    justification: "center",
    colorBand: "scorer",
    fontProfile: "menu",
  });
  element.setAttribute("aria-label", `${message.toLowerCase()} camera`);
  element.hidden = false;
}

function renderPossession({
  current,
  teamA,
  teamASlots,
  teamB,
  teamBSlots,
}) {
  const throwIn = current.matchMode === CSSOCCER_MATCH_MODE.THROW_IN_A
    || current.matchMode === CSSOCCER_MATCH_MODE.THROW_IN_B;
  if (current.possession === null || throwIn) {
    teamA.hidden = true;
    teamB.hidden = true;
    return;
  }
  const home = current.possession.country === "spain";
  const target = home ? teamA : teamB;
  const slots = home ? teamASlots : teamBSlots;
  teamA.hidden = !home;
  teamB.hidden = home;
  renderSourceText(target, slots, current.possession.label, {
    anchorX: home ? 8 : NATIVE_VIEWPORT_WIDTH - 8,
    y: 1,
    justification: home ? "left" : "right",
    colorBand: home ? "team-a" : "team-b",
    fontProfile: "menu",
  });
  target.setAttribute("aria-label", `${current.possession.country} ${current.possession.label}`);
}

function renderScoreMenu({ menu, current, heading, elements, slots }) {
  const scorerLines = {
    spain: formatSourceScorerLines(current.goalHistory, "spain"),
    argentina: formatSourceScorerLines(current.goalHistory, "argentina"),
  };
  const scoreRowCount = Math.max(scorerLines.spain.length, scorerLines.argentina.length);
  const nativeMenuHeight = ((104 + scoreRowCount * 13 + 84) >> 5) << 4;
  const menuHeight = nativeMenuHeight * 2;
  const initialSlide = Math.min(HALFTIME_MENU_MAX_SLIDE, nativeMenuHeight - 20);
  const slide = Math.max(
    0,
    initialSlide - current.halftimeTransitionTicks * HALFTIME_MENU_SLIDE_PER_TICK,
  );
  const top = NATIVE_VIEWPORT_HEIGHT - menuHeight + (slide + 12) * 2;
  menu.style.setProperty("--native-menu-height", `${menuHeight}em`);
  menu.style.setProperty("--native-menu-filter-height", `${menuHeight - 102}em`);
  menu.style.setProperty("--native-menu-bottom-edge-y", `${menuHeight - 51}em`);
  menu.style.setProperty("--native-menu-bottom-corner-y", `${menuHeight - 64}em`);
  menu.style.left = centeredNativeCoordinate(-288);
  menu.style.top = centeredNativeCoordinate(top - (NATIVE_VIEWPORT_HEIGHT / 2));
  const verticalSegments = Math.max(0, Math.min(4, (menuHeight - 128) / 32));
  for (const column of menu.querySelectorAll(".hud-menu-edge-column")) {
    [...column.children].forEach((child, index) => {
      child.hidden = index >= verticalSegments;
    });
  }
  menu.setAttribute("aria-label", heading === "FULL TIME" ? "Full time" : "Half time");
  renderLocalSourceText(elements.heading, slots.heading, heading, {
    anchorX: 288,
    y: 56,
    justification: "center",
    colorBand: "heading",
  });
  renderLocalSourceText(elements.teamA, slots.teamA, TEAM_A, {
    anchorX: 220,
    y: 80,
    justification: "right",
    colorBand: "neutral",
  });
  renderLocalSourceText(elements.scoreA, slots.scoreA, String(current.score.spain), {
    anchorX: 262,
    y: 80,
    justification: "right",
    colorBand: "neutral",
  });
  renderLocalSourceText(elements.scoreB, slots.scoreB, String(current.score.argentina), {
    anchorX: 314,
    y: 80,
    justification: "left",
    colorBand: "neutral",
  });
  renderLocalSourceText(elements.teamB, slots.teamB, TEAM_B, {
    anchorX: 356,
    y: 80,
    justification: "left",
    colorBand: "neutral",
  });
  renderLocalSourceText(elements.scorerA, slots.scorerA, scorerLines.spain.join(" "), {
    anchorX: 80,
    y: 104,
    justification: "left",
    colorBand: "scorer",
  });
  renderLocalSourceText(elements.scorerB, slots.scorerB, scorerLines.argentina.join(" "), {
    anchorX: 356,
    y: 104,
    justification: "left",
    colorBand: "scorer",
  });
  elements.scoreA.setAttribute("aria-label", `Spain ${current.score.spain}`);
  elements.scoreB.setAttribute("aria-label", `Argentina ${current.score.argentina}`);
  elements.scorerA.setAttribute("aria-label", scorerLines.spain.join(", ") || "No Spain scorers");
  elements.scorerB.setAttribute(
    "aria-label",
    scorerLines.argentina.join(", ") || "No Argentina scorers",
  );
  menu.hidden = false;
}

function renderLocalSourceText(element, slots, text, options) {
  renderSourceText(element, slots, text, { ...options, coordinateSpace: "local" });
}

function formatSourceScorerLines(goalHistory, country) {
  const byScorer = new Map();
  for (const goal of goalHistory.filter((entry) => entry.country === country)) {
    const minutes = byScorer.get(goal.label) ?? [];
    minutes.push(goal.minute);
    byScorer.set(goal.label, minutes);
  }
  return [...byScorer].map(([label, minutes]) => `${label} ${minutes.join(",")}`);
}

function renderClock(clock, glyphSlots, value) {
  const seconds = Math.floor(value.seconds);
  const text = `${value.minutes}:${String(seconds).padStart(2, "0")}`;
  renderSourceText(clock, glyphSlots, text, {
    anchorX: 320,
    y: 1,
    justification: "center",
    colorBand: "neutral",
    fontProfile: "menu",
  });
  clock.setAttribute("datetime", `PT${value.minutes}M${seconds}S`);
  clock.setAttribute("aria-label", `${value.minutes} minutes ${seconds} seconds`);
}

function renderSourceText(element, glyphSlots, text, {
  anchorX,
  y,
  justification,
  colorBand,
  coordinateSpace = "viewport",
  fontProfile = "menu",
}) {
  if (text.length > glyphSlots.length) {
    throw new RangeError(
      `cssoccer native HUD text ${text} exceeds its ${glyphSlots.length} prepared glyph slots.`,
    );
  }
  const font = FONT_PROFILES[fontProfile];
  if (!font) {
    throw new Error(`cssoccer native HUD has no prepared ${fontProfile} font profile.`);
  }
  const glyphs = [...text].map((character) => sourceGlyph(character, font));
  const sourceLength = glyphs.reduce((sum, glyph) => sum + glyph.sourceAdvance, 0);
  const length = sourceLength * font.presentationScale;
  const x = justification === "right"
    ? anchorX - length
    : justification === "center"
      ? anchorX - ((sourceLength >> 1) * font.presentationScale)
      : anchorX;
  const bandIndex = COLOR_BAND_INDEX[colorBand];
  if (bandIndex === undefined) {
    throw new Error(`cssoccer native HUD has no prepared ${colorBand} colour band.`);
  }
  element.style.left = coordinateSpace === "local"
    ? `${x}em`
    : centeredNativeCoordinate(x - (NATIVE_VIEWPORT_WIDTH / 2));
  element.style.top = coordinateSpace === "local"
    ? `${y}em`
    : centeredNativeCoordinate(y - (NATIVE_VIEWPORT_HEIGHT / 2));
  element.dataset.nativeHudFont = font.id;
  element.dataset.nativeHudText = text;
  for (let index = 0; index < glyphSlots.length; index += 1) {
    const slot = glyphSlots[index];
    const glyph = glyphs[index];
    if (!glyph) {
      resetGlyphSlot(slot);
      continue;
    }
    slot.dataset.glyph = glyph.character;
    slot.style.setProperty("--native-hud-glyph-width", `${glyph.advance}em`);
    slot.style.setProperty(
      "--native-hud-glyph-x",
      `${-(glyph.column * font.cellWidth)}em`,
    );
    slot.style.setProperty(
      "--native-hud-glyph-y",
      `${-(bandIndex * FONT_BAND_HEIGHT + font.atlasBandY + glyph.row * font.cellHeight)}em`,
    );
    slot.hidden = false;
  }
}

function sourceGlyph(character, font) {
  let mapped = character;
  if (mapped === " ") mapped = ";";
  if (mapped === ".") mapped = "@";
  if (mapped === ",") mapped = "?";
  if (mapped >= "a" && mapped <= "z") mapped = mapped.toUpperCase();
  if (mapped === "O") mapped = "0";
  if (mapped === "&") mapped = "O";
  const glyphIndex = mapped.codePointAt(0) - FONT_ASCII_BASE;
  const width = font.widths[glyphIndex];
  if (width === undefined) {
    throw new Error(`cssoccer native HUD has no prepared glyph for ${character}.`);
  }
  const atlasIndex = glyphIndex + font.offset;
  return {
    character: mapped,
    column: atlasIndex % font.columns,
    row: Math.floor(atlasIndex / font.columns),
    sourceAdvance: width + 1,
    advance: (width + 1) * font.presentationScale,
  };
}

function resetGlyphSlot(slot) {
  slot.hidden = true;
  delete slot.dataset.glyph;
  slot.style.removeProperty("--native-hud-glyph-width");
  slot.style.removeProperty("--native-hud-glyph-x");
  slot.style.removeProperty("--native-hud-glyph-y");
}

function materializeStableHudLeaves(host) {
  const documentImpl = host.ownerDocument;
  for (const run of host.querySelectorAll("[data-native-hud-slot-count]")) {
    const count = Number(run.dataset.nativeHudSlotCount);
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error("cssoccer native HUD text capacity must be a positive integer.");
    }
    if (run.children.length === 0) {
      for (let index = 0; index < count; index += 1) {
        const slot = documentImpl.createElement("span");
        slot.dataset.nativeHudGlyphSlot = String(index);
        slot.setAttribute("aria-hidden", "true");
        slot.hidden = true;
        run.append(slot);
      }
    }
    if (run.children.length !== count) {
      throw new Error("cssoccer native HUD text run changed its stable leaf count.");
    }
  }
  for (const edge of host.querySelectorAll("[data-native-menu-edge-count]")) {
    const count = Number(edge.dataset.nativeMenuEdgeCount);
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error("cssoccer native menu edge count must be a positive integer.");
    }
    if (edge.children.length === 0) {
      const orientation = edge.classList.contains("hud-menu-edge-row")
        ? "hud-menu-horizontal-edge"
        : "hud-menu-vertical-edge";
      for (let index = 0; index < count; index += 1) {
        const leaf = documentImpl.createElement("span");
        leaf.classList.add("hud-menu-sprite", orientation);
        leaf.setAttribute("aria-hidden", "true");
        edge.append(leaf);
      }
    }
    if (edge.children.length !== count) {
      throw new Error("cssoccer native menu edge changed its stable leaf count.");
    }
  }
}

function preparedGlyphSlots(element) {
  return element
    ? [...element.querySelectorAll(":scope > [data-native-hud-glyph-slot]")]
    : [];
}

function centeredNativeCoordinate(offset) {
  return `calc(50% ${offset < 0 ? "-" : "+"} ${Math.abs(offset)}em)`;
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

import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  CSSOCCER_REPO_ROOT,
  delay,
  sha256,
  withHeadlessCssoccerBrowser,
} from "./headless-cssoccer-browser.mjs";
import { captureSettledCssoccerFrame } from "./settled-cssoccer-capture.mjs";

const CONTROL_TO_KEY = Object.freeze({
  "move-up": "KeyW",
  "move-down": "KeyS",
  "move-left": "KeyA",
  "move-right": "KeyD",
  "fire-1": "KeyJ",
  "fire-2": "KeyK",
});
const TOUCH_POINTERS = Object.freeze({
  "move-up": 101,
  "move-down": 102,
  "move-left": 103,
  "move-right": 104,
  "fire-1": 105,
  "fire-2": 106,
});
const OFFICIAL_CONTRACT = Object.freeze([
  Object.freeze({ id: "referee-00", role: "referee" }),
  Object.freeze({ id: "assistant-referee-01", role: "linesman-top" }),
  Object.freeze({ id: "assistant-referee-02", role: "linesman-bottom" }),
]);

export async function runAdaptiveFreePlayBrowser({
  port = 5211,
  timeoutMs = 300_000,
  inputMode = "keyboard",
  captureRoot = null,
  sampleCaptureRoot = null,
  sampleCaptureTargets = [],
  controlCountry = "argentina",
} = {}) {
  if (inputMode !== "keyboard" && inputMode !== "touch") {
    throw new Error("Adaptive Full Match Alpha input mode must be keyboard or touch.");
  }
  if (!["spain", "argentina"].includes(controlCountry)) {
    throw new Error("Adaptive Full Match Alpha country must be spain or argentina.");
  }
  const checkedSampleTargets = validateSampleCaptureTargets(
    sampleCaptureRoot,
    sampleCaptureTargets,
  );
  const captures = [];
  const sampleCaptures = [];
  const report = await withHeadlessCssoccerBrowser({
    port,
    timeoutMs,
    viewport: inputMode === "touch"
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 },
    coarsePointer: inputMode === "touch",
    controlCountry,
  }, async (browser) => {
    const initialRootCount = await browser.evaluate(`(() => {
      globalThis.__cssoccerAdaptiveRoots = [...document.querySelectorAll("[data-cssoccer-root-id]")];
      return globalThis.__cssoccerAdaptiveRoots.length;
    })()`);
    if (initialRootCount !== 37) {
      throw new Error(`Adaptive match expected 37 prepared roots, got ${initialRootCount}.`);
    }
    const startedAt = Date.now();
    const deadline = startedAt + timeoutMs;
    const phases = new Set();
    const eventTypes = new Set();
    const events = [];
    const eventCounts = new Map();
    const controlledPlayers = new Set();
    const restartKinds = new Set();
    const positions = new Map();
    const inputBranches = new Set();
    const possessionTransitions = [];
    const actionStates = new Set();
    const officialTracks = createOfficialTracks();
    const stageTicks = {};
    let controls = new Set();
    let previousOwner = null;
    let previousOwnerCountry = null;
    let moved = false;
    let paused = null;
    let possessionAcquired = false;
    let possessionRetained = false;
    let possessionLost = false;
    let restartEncountered = false;
    let terminal = null;
    let last = null;
    let nextSampleCaptureIndex = 0;

    while (Date.now() < deadline) {
      const sample = await browser.evaluate(sampleExpression());
      last = sample;
      if (sample.status === "error") {
        const productErrors = await browser.evaluate("window.__cssoccerDebug.errors()");
        throw new Error(`Adaptive Full Match Alpha product error: ${JSON.stringify({
          productErrors,
          pageErrors: browser.pageErrors,
          inspect: await browser.evaluate("window.__cssoccerDebug.inspect()"),
          sample,
        })}`);
      }
      phases.add(sample.phase);
      phases.add(sample.clockPhase);
      recordOfficialSample(officialTracks, sample);
      if (sample.active?.id) controlledPlayers.add(sample.active.id);
      for (const event of sample.events) {
        eventTypes.add(event.type);
        eventCounts.set(event.type, (eventCounts.get(event.type) ?? 0) + 1);
        if (!events.some((known) => known.type === event.type)) {
          events.push(event);
        }
      }
      for (const state of [
        sample.active?.livePass,
        sample.active?.liveShot,
        sample.active?.liveContact,
        sample.active?.liveKeeper,
      ]) {
        if (state) actionStates.add(state);
      }
      if (sample.active) {
        const before = positions.get(sample.active.id);
        if (
          before
          && (before.x !== sample.active.position.x || before.y !== sample.active.position.y)
        ) moved = true;
        positions.set(sample.active.id, sample.active.position);
      }
      if (sample.owner !== previousOwner || sample.ownerCountry !== previousOwnerCountry) {
        possessionTransitions.push({
          tick: sample.tick,
          owner: sample.owner,
          country: sample.ownerCountry,
        });
      }
      if (sample.ownerCountry === controlCountry) {
        possessionAcquired = true;
        if (previousOwnerCountry === controlCountry && sample.owner === previousOwner) {
          possessionRetained = true;
        }
      }
      if (previousOwnerCountry === controlCountry && sample.ownerCountry !== controlCountry) {
        possessionLost = true;
      }
      previousOwner = sample.owner;
      previousOwnerCountry = sample.ownerCountry;

      const restart = restartKind(sample);
      if (restart !== null) {
        restartKinds.add(restart);
        if (!new Set(["opening", "halftime"]).has(restart)) restartEncountered = true;
      }

      if (captureRoot && stageTicks.live === undefined && sample.tick >= 220 && moved) {
        await capture(browser, captureRoot, "01-live-interaction.png", sample.tick, captures, "First half");
        stageTicks.live = sample.tick;
      }
      if (captureRoot && stageTicks.restart === undefined && restartEncountered) {
        await capture(browser, captureRoot, "02-restart.png", sample.tick, captures, null);
        stageTicks.restart = sample.tick;
      }
      if (
        captureRoot
        && stageTicks.halftime === undefined
        && sample.phase.startsWith("halftime")
        && sample.halftimeTransitionTicks >= 60
      ) {
        await capture(browser, captureRoot, "03-halftime.png", sample.tick, captures, "Half-time");
        stageTicks.halftime = sample.tick;
      }
      const sampleTarget = checkedSampleTargets[nextSampleCaptureIndex] ?? null;
      if (
        sampleTarget !== null
        && sample.matchHalf === sampleTarget.matchHalf
        && sample.halfLiveTicks >= sampleTarget.halfLiveTick
        && sample.clockRunning === true
      ) {
        const frameName = `frame-${String(nextSampleCaptureIndex + 1).padStart(2, "0")}.png`;
        await capture(
          browser,
          sampleCaptureRoot,
          frameName,
          sample.tick,
          sampleCaptures,
          sampleTarget.matchHalf === 0 ? "First half" : "Second half",
        );
        sampleCaptures.at(-1).target = sampleTarget;
        nextSampleCaptureIndex += 1;
      }

      if (paused === null && sample.tick >= 300 && !sample.terminal) {
        await applyControls(browser, inputMode, controls, new Set());
        controls = new Set();
        await togglePause(browser);
        const pauseStart = await browser.evaluate(sampleExpression());
        await delay(275);
        const pauseEnd = await browser.evaluate(sampleExpression());
        const pauseInput = await browser.evaluate("window.__cssoccerDebug.inspect().input");
        await togglePause(browser);
        paused = {
          tick: pauseStart.tick,
          stable: pauseStart.tick === pauseEnd.tick,
          inputNeutral: pauseInput.paused === true
            && pauseInput.keyboardCodes.length === 0,
        };
      }

      if (sample.terminal) {
        terminal = sample;
        if (captureRoot && stageTicks.fulltime === undefined) {
          await capture(browser, captureRoot, "04-full-time.png", sample.tick, captures, "Full-time");
          stageTicks.fulltime = sample.tick;
        }
        break;
      }

      const desired = chooseAdaptiveControls(sample);
      inputBranches.add([...desired].sort().join("+"));
      if (!sameSet(controls, desired)) {
        await applyControls(browser, inputMode, controls, desired);
        controls = desired;
      }
      await delay(35);
    }
    await applyControls(browser, inputMode, controls, new Set());
    if (terminal === null) {
      throw new Error(`Adaptive Full Match Alpha timed out: ${JSON.stringify(last)}`);
    }
    if (nextSampleCaptureIndex !== checkedSampleTargets.length) {
      throw new Error(`Adaptive Full Match Alpha missed visual samples: ${JSON.stringify({
        captured: nextSampleCaptureIndex,
        requested: checkedSampleTargets.length,
        last,
      })}`);
    }
    const beforeRematch = await browser.evaluate(sampleExpression());
    const terminalInspect = await browser.evaluate("window.__cssoccerDebug.inspect()");
    await browser.evaluate(`window.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Enter",
    }))`);
    let rematch = null;
    const rematchDeadline = Date.now() + 5_000;
    while (Date.now() < rematchDeadline) {
      rematch = await browser.evaluate(`(() => {
        const inspected = window.__cssoccerDebug.inspect();
        return {
          ready: inspected.ready,
          status: inspected.status,
          tick: inspected.live?.tick,
          phase: inspected.live?.phase,
          terminal: inspected.live?.terminal,
          score: inspected.live?.score,
          errors: window.__cssoccerDebug.errors(),
        };
      })()`);
      if (rematch.status === "error") {
        throw new Error(`Full Match Alpha rematch failed: ${JSON.stringify(rematch.errors)}`);
      }
      if (rematch.ready === true && rematch.tick === 0 && rematch.terminal === false) break;
      await delay(25);
    }
    const stableRoots = await browser.evaluate(`(() => {
      const roots = [...document.querySelectorAll("[data-cssoccer-root-id]")];
      return roots.length === 37
        && globalThis.__cssoccerAdaptiveRoots.length === 37
        && roots.every((root, index) => root === globalThis.__cssoccerAdaptiveRoots[index]);
    })()`);
    rematch = { ...rematch, stableRoots };
    const forbiddenRequests = browser.requestUrls.filter((url) => (
      /(?:\/\.local\/|\/source\/|\/native\/|\/oracle\/|\.(?:exe|dll|lib|dat|obj|off)(?:[?#]|$))/iu.test(url)
    ));
    return {
      schema: "cssoccer-full-match-alpha-adaptive-browser@1",
      status: "pass",
      generatedAt: new Date().toISOString(),
      browser: browser.browser,
      route: {
        url: browser.target,
        canonical: true,
        fixtureId: terminalInspect.fixtureId,
        controlCountry: terminalInspect.controlCountry,
      },
      inputMode,
      timing: {
        tickRateHz: 20,
        playMinutesPerHalf: 1,
        elapsedWallMs: Date.now() - startedAt,
        terminalTick: terminal.tick,
      },
      phases: [...phases],
      interaction: {
        moved,
        possessionAcquired,
        possessionRetained,
        possessionLost,
        controlledPlayers: [...controlledPlayers],
        possessionTransitions,
        eventTypes: [...eventTypes].sort(),
        eventCounts: Object.fromEntries([...eventCounts].sort(([left], [right]) => (
          left.localeCompare(right)
        ))),
        events,
        actionStates: [...actionStates].sort(),
        inputBranches: [...inputBranches].sort(),
        restartKinds: [...restartKinds].sort(),
        restartEncountered,
        pause: paused,
        officials: summarizeOfficialTracks(officialTracks),
      },
      terminal: {
        tick: terminal.tick,
        phase: terminal.phase,
        score: terminal.score,
        matchHalf: terminal.matchHalf,
      },
      rematch,
      integrity: {
        pageErrors: browser.pageErrors,
        forbiddenRequests,
        nativeRequestCount: terminalInspect.requests.nativeRequestCount,
        runtimeConstruction: terminalInspect.mount.runtimeConstruction,
        rootCount: terminalInspect.mount.rootCount,
      },
      evidence: {
        stageTicks,
        captures: captures.map(({ data, ...entry }) => entry),
        sampleCaptures: sampleCaptures.map(({ data, ...entry }) => entry),
      },
    };
  });
  assertAdaptiveReport(report);
  if (captureRoot) {
    const contactSheet = await writeContactSheet(captureRoot, captures);
    report.evidence.contactSheet = contactSheet;
  }
  return report;
}

export function assertAdaptiveReport(report) {
  const requiredPhases = [
    "opening-kickoff",
    "first-half-live-clock",
    "halftime-whistle",
    "halftime-transition",
    "halftime-end-swap-second-half-kickoff",
    "second-half-live-clock",
    "full-time-terminal",
  ];
  const eventTypes = new Set(report?.interaction?.eventTypes ?? []);
  const pass = [...eventTypes].some((type) => /pass/u.test(type));
  const shot = [...eventTypes].some((type) => /shot|punt|goal/u.test(type));
  const contact = [...eventTypes].some((type) => /tackle|steal|contact|foul/u.test(type));
  if (
    report?.status !== "pass"
    || report.route?.canonical !== true
    || !["spain", "argentina"].includes(report.route?.controlCountry)
    || report.timing?.tickRateHz !== 20
    || report.timing?.playMinutesPerHalf !== 1
    || report.terminal?.phase !== "full-time-terminal"
    || report.terminal?.matchHalf !== 11
    || !requiredPhases.every((phase) => report.phases.includes(phase))
    || report.interaction?.moved !== true
    || report.interaction?.possessionAcquired !== true
    || report.interaction?.possessionRetained !== true
    || report.interaction?.possessionLost !== true
    || report.interaction?.restartEncountered !== true
    || report.interaction?.pause?.stable !== true
    || report.interaction?.pause?.inputNeutral !== true
    || pass !== true
    || shot !== true
    || contact !== true
    || !validOfficialEvidence(report.interaction?.officials)
    || report.rematch?.ready !== true
    || report.rematch?.tick !== 0
    || report.rematch?.terminal !== false
    || report.rematch?.stableRoots !== true
    || report.integrity?.pageErrors?.length !== 0
    || report.integrity?.forbiddenRequests?.length !== 0
    || report.integrity?.nativeRequestCount !== 0
    || Object.values(report.integrity?.runtimeConstruction ?? {}).some((count) => count !== 0)
  ) {
    throw new Error(`Adaptive Full Match Alpha acceptance failed: ${JSON.stringify(report)}`);
  }
  return report;
}

export function sampleExpression() {
  return `(() => {
    const debug = window.__cssoccerDebug;
    const match = debug.match;
    const liveOfficialCommands = debug.live?.officials?.commands ?? [];
    const active = match.players.find(({ id }) => id === match.control.activePlayerId) ?? null;
    const owner = match.possession.owner;
    const ownerPlayer = match.players.find(({ nativePlayerNumber }) => nativePlayerNumber === owner) ?? null;
    const stateName = (value) => value == null
      ? null
      : String(value.phase ?? value.kind ?? value.status ?? value.action ?? "active");
    return {
      ready: debug.ready,
      status: debug.status,
      tick: match.tick,
      phase: match.phase,
      clockPhase: match.clock.phase,
      clockRunning: match.clock.running,
      terminal: match.clock.terminal === true,
      matchHalf: match.clock.matchHalf,
      halfLiveTicks: match.clock.halfLiveTicks,
      halftimeTransitionTicks: match.clock.halftimeTransitionTicks,
      score: { ...match.score.goals },
      ball: { ...match.ball.ball.position },
      owner,
      ownerCountry: ownerPlayer?.country ?? null,
      lastTouch: match.possession.lastTouch,
      controlSlot: match.control.nativeTeamSlot,
      active: active === null ? null : {
        id: active.id,
        nativePlayerNumber: active.nativePlayerNumber,
        nativeTeamSlot: active.nativeTeamSlot,
        position: { ...active.position },
        facing: { ...active.facing },
        action: active.action.action.value,
        livePass: stateName(active.livePass),
        liveShot: stateName(active.liveShot),
        liveContact: stateName(active.liveContact),
        liveKeeper: stateName(active.liveKeeper),
      },
      officials: match.officials.officials.map((official, index) => {
        const command = liveOfficialCommands[index] ?? null;
        return {
          id: official.id,
          role: official.role,
          position: { ...official.position },
          action: official.action,
          sourceAnimationId: official.animation.id,
          sourceAnimationFrame: official.animation.frame,
          renderRootId: command?.rootId ?? null,
          renderPosition: command === null ? null : [...command.transform.position],
          renderAnimationSlotId: command?.animation?.slotId ?? null,
          renderAnimationFrame: command?.animation?.frame ?? null,
        };
      }),
      kickoff: {
        phase: match.kickoff.phase,
        restartKind: match.kickoff.restartKind ?? null,
      },
      rules: {
        phase: match.rules.phase,
        matchMode: match.rules.matchMode,
        setPiece: match.rules.setPiece,
        deadBallCount: match.rules.deadBallCount,
        boundary: match.rules.boundary?.descriptor?.kind ?? match.rules.boundary?.kind ?? null,
        foul: match.rules.foulRestart?.descriptor?.kind ?? match.rules.foulRestart?.kind ?? null,
        offside: match.rules.liveOffside?.status ?? null,
      },
      events: debug.events().map((event) => ({
        type: event.type,
        tick: event.tick,
        playerId: event.playerId ?? null,
        receiverId: event.receiverId ?? null,
        kind: event.kind ?? null,
        passType: event.passType ?? null,
      })),
    };
  })()`;
}

function createOfficialTracks() {
  return new Map(OFFICIAL_CONTRACT.map(({ id, role }) => [id, {
    id,
    role,
    sampleCount: 0,
    missingStateCount: 0,
    projectionMismatchCount: 0,
    positions: new Set(),
    sourceAnimationStates: new Set(),
    sourceAnimationIds: new Set(),
    renderAnimationStates: new Set(),
    renderAnimationSlotIds: new Set(),
    renderFrameIndices: new Set(),
    actions: new Set(),
    bounds: {
      x: { min: Infinity, max: -Infinity },
      y: { min: Infinity, max: -Infinity },
      z: { min: Infinity, max: -Infinity },
    },
    halfXBounds: [
      { min: Infinity, max: -Infinity },
      { min: Infinity, max: -Infinity },
    ],
    first: null,
    last: null,
    examples: [],
  }]));
}

function recordOfficialSample(tracks, sample) {
  const officials = Array.isArray(sample.officials) ? sample.officials : [];
  for (const expected of OFFICIAL_CONTRACT) {
    const track = tracks.get(expected.id);
    const official = officials.find(({ id }) => id === expected.id) ?? null;
    track.sampleCount += 1;
    if (!validOfficialSample(official, expected)) {
      track.missingStateCount += 1;
      continue;
    }
    const projectionMatches = official.renderRootId === official.id
      && official.renderAnimationSlotId === official.sourceAnimationId
      && official.renderPosition[0] === official.position.x
      && official.renderPosition[1] === official.position.z
      && official.renderPosition[2] === -official.position.y;
    if (!projectionMatches) track.projectionMismatchCount += 1;
    const positionKey = [official.position.x, official.position.y, official.position.z].join(":");
    const sourceAnimationKey = [
      official.sourceAnimationId,
      official.sourceAnimationFrame,
    ].join(":");
    const renderAnimationKey = [
      official.renderAnimationSlotId,
      official.renderAnimationFrame,
    ].join(":");
    const positionChanged = !track.positions.has(positionKey);
    const animationChanged = !track.renderAnimationStates.has(renderAnimationKey);
    track.positions.add(positionKey);
    track.sourceAnimationStates.add(sourceAnimationKey);
    track.sourceAnimationIds.add(official.sourceAnimationId);
    track.renderAnimationStates.add(renderAnimationKey);
    track.renderAnimationSlotIds.add(official.renderAnimationSlotId);
    track.renderFrameIndices.add(official.renderAnimationFrame);
    track.actions.add(official.action);
    for (const axis of ["x", "y", "z"]) {
      track.bounds[axis].min = Math.min(track.bounds[axis].min, official.position[axis]);
      track.bounds[axis].max = Math.max(track.bounds[axis].max, official.position[axis]);
    }
    if (sample.matchHalf === 0 || sample.matchHalf === 1) {
      const bounds = track.halfXBounds[sample.matchHalf];
      bounds.min = Math.min(bounds.min, official.position.x);
      bounds.max = Math.max(bounds.max, official.position.x);
    }
    const state = {
      tick: sample.tick,
      matchHalf: sample.matchHalf,
      position: { ...official.position },
      action: official.action,
      sourceAnimation: {
        id: official.sourceAnimationId,
        frame: official.sourceAnimationFrame,
      },
      renderedAnimation: {
        slotId: official.renderAnimationSlotId,
        frame: official.renderAnimationFrame,
      },
    };
    if (track.first === null) track.first = state;
    track.last = state;
    if ((positionChanged || animationChanged) && track.examples.length < 16) {
      track.examples.push(state);
    }
  }
}

function summarizeOfficialTracks(tracks) {
  return OFFICIAL_CONTRACT.map(({ id }) => {
    const track = tracks.get(id);
    return {
      id: track.id,
      role: track.role,
      sampleCount: track.sampleCount,
      missingStateCount: track.missingStateCount,
      projectionMismatchCount: track.projectionMismatchCount,
      positionStateCount: track.positions.size,
      sourceAnimationStateCount: track.sourceAnimationStates.size,
      sourceAnimationIds: [...track.sourceAnimationIds].sort((left, right) => left - right),
      renderAnimationStateCount: track.renderAnimationStates.size,
      renderAnimationSlotIds: [...track.renderAnimationSlotIds].sort((left, right) => left - right),
      renderFrameIndices: [...track.renderFrameIndices].sort((left, right) => left - right),
      actions: [...track.actions].sort((left, right) => left - right),
      positionBounds: finiteBounds(track.bounds),
      halfXBounds: track.halfXBounds.map((bounds) => finiteRange(bounds)),
      first: track.first,
      last: track.last,
      examples: track.examples,
    };
  });
}

function validOfficialSample(official, expected) {
  return official !== null
    && official.id === expected.id
    && official.role === expected.role
    && [official.position?.x, official.position?.y, official.position?.z].every(Number.isFinite)
    && Number.isSafeInteger(official.action)
    && Number.isFinite(official.sourceAnimationId)
    && Number.isFinite(official.sourceAnimationFrame)
    && official.renderRootId === expected.id
    && Array.isArray(official.renderPosition)
    && official.renderPosition.length === 3
    && official.renderPosition.every(Number.isFinite)
    && Number.isSafeInteger(official.renderAnimationSlotId)
    && Number.isSafeInteger(official.renderAnimationFrame);
}

function validOfficialEvidence(officials) {
  if (!Array.isArray(officials) || officials.length !== OFFICIAL_CONTRACT.length) return false;
  return OFFICIAL_CONTRACT.every((expected, index) => {
    const official = officials[index];
    const dynamic = official?.id === expected.id
      && official.role === expected.role
      && official.sampleCount >= 100
      && official.missingStateCount === 0
      && official.projectionMismatchCount === 0
      && official.positionStateCount > 1
      && official.sourceAnimationStateCount > 1
      && official.renderAnimationStateCount > 1
      && official.renderFrameIndices.length > 1
      && official.first !== null
      && official.last !== null;
    if (!dynamic) return false;
    if (expected.role === "linesman-top") {
      return official.positionBounds.y.max < 0
        && official.positionBounds.x.min < 640;
    }
    if (expected.role === "linesman-bottom") {
      return official.positionBounds.y.min > 800
        && official.positionBounds.x.max > 640;
    }
    return true;
  });
}

function finiteBounds(bounds) {
  return Object.fromEntries(Object.entries(bounds).map(([axis, range]) => [axis, finiteRange(range)]));
}

function finiteRange(range) {
  return Number.isFinite(range.min) && Number.isFinite(range.max)
    ? { min: range.min, max: range.max }
    : null;
}

function chooseAdaptiveControls(sample) {
  const desired = new Set();
  const active = sample.active;
  if (active === null || sample.terminal) return desired;
  const owns = sample.owner === active.nativePlayerNumber;
  const cycle = sample.tick % 180;
  let targetX = sample.ball.x;
  let targetY = sample.ball.y;
  if (owns) {
    const attackRight = active.nativeTeamSlot === "A";
    targetX = attackRight ? 1_210 : 70;
    targetY = cycle >= 100 && cycle < 145
      ? (Math.floor(sample.tick / 180) % 2 === 0 ? 18 : 782)
      : 400;
  }
  const dx = targetX - active.position.x;
  const dy = targetY - active.position.y;
  if (dx < -4) desired.add("move-left");
  if (dx > 4) desired.add("move-right");
  if (dy < -4) desired.add("move-up");
  if (dy > 4) desired.add("move-down");
  const distance = Math.hypot(sample.ball.x - active.position.x, sample.ball.y - active.position.y);
  if (owns) {
    if (cycle >= 22 && cycle < 31) desired.add("fire-2");
    if (cycle >= 68 && cycle < 80) desired.add("fire-1");
    if (cycle >= 125 && cycle < 133) desired.add("fire-2");
  } else if (distance < 150) {
    if (cycle >= 40 && cycle < 48) desired.add("fire-1");
    if (cycle >= 112 && cycle < 120) desired.add("fire-2");
  }
  return desired;
}

async function applyControls(browser, inputMode, current, desired) {
  const released = [...current].filter((control) => !desired.has(control));
  const pressed = [...desired].filter((control) => !current.has(control));
  if (released.length === 0 && pressed.length === 0) return;
  if (inputMode === "keyboard") {
    await browser.evaluate(`(() => {
      const dispatch = (type, code) => window.dispatchEvent(new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        code,
      }));
      for (const code of ${JSON.stringify(released.map((control) => CONTROL_TO_KEY[control]))}) dispatch("keyup", code);
      for (const code of ${JSON.stringify(pressed.map((control) => CONTROL_TO_KEY[control]))}) dispatch("keydown", code);
    })()`);
    return;
  }
  await browser.evaluate(`(() => {
    const pointers = ${JSON.stringify(TOUCH_POINTERS)};
    const dispatch = (type, control) => {
      const target = document.querySelector('[data-cssoccer-control="' + control + '"]');
      if (!target) throw new Error("Missing touch control " + control);
      target.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: pointers[control],
        pointerType: "touch",
        isPrimary: control === "move-up",
      }));
    };
    for (const control of ${JSON.stringify(released)}) dispatch("pointerup", control);
    for (const control of ${JSON.stringify(pressed)}) dispatch("pointerdown", control);
  })()`);
}

async function togglePause(browser) {
  await browser.evaluate(`window.dispatchEvent(new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code: "Escape",
  }))`);
}

function restartKind(sample) {
  if (sample.rules.boundary) return `boundary:${sample.rules.boundary}`;
  if (sample.rules.foul) return `foul:${sample.rules.foul}`;
  if (sample.events.some(({ type }) => type === "goal-awarded")) return "goal";
  if (sample.kickoff.restartKind === "halftime") return "halftime";
  if (sample.kickoff.phase !== "open-play" && sample.tick < 220) return "opening";
  return null;
}

async function capture(browser, root, name, tick, captures, expectedHalf) {
  const result = await captureSettledCssoccerFrame(browser, join(root, name));
  const hud = await browser.evaluate(`(() => {
    const host = document.getElementById("match-hud");
    const clock = document.getElementById("hud-clock");
    const inspect = window.__cssoccerDebug.inspect();
    const bounds = host.getBoundingClientRect();
    const liveCommands = window.__cssoccerDebug.live.officials.commands;
    const liveOfficials = window.__cssoccerDebug.match.officials.officials;
    const officials = ["referee-00", "assistant-referee-01", "assistant-referee-02"]
      .map((id, index) => {
        const root = document.querySelector('[data-cssoccer-root-id="' + id + '"]');
        const rect = root.getBoundingClientRect();
        const style = getComputedStyle(root);
        const command = liveCommands[index];
        const official = liveOfficials[index];
        return {
          id,
          connected: root.isConnected,
          hidden: root.hidden,
          visible: !root.hidden
            && style.display !== "none"
            && style.visibility !== "hidden"
            && rect.right > 0
            && rect.bottom > 0
            && rect.left < innerWidth
            && rect.top < innerHeight,
          materialId: root.dataset.cssoccerMaterialId,
          modelId: root.dataset.cssoccerModelId,
          leafCount: root.querySelectorAll(".cssoccer-exact-player-model > s").length,
          sourceState: {
            role: official.role,
            position: { ...official.position },
            action: official.action,
            animationId: official.animation.id,
            animationFrame: official.animation.frame,
          },
          renderState: {
            rootId: command.rootId,
            position: [...command.transform.position],
            animationSlotId: command.animation.slotId,
            animationFrame: command.animation.frame,
          },
          bounds: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          },
        };
      });
    return {
      visible: !host.hidden && getComputedStyle(host).display !== "none"
        && bounds.width > 0 && bounds.height > 0,
      topLayerOpen: host.matches(":popover-open"),
      clock: clock.dataset.nativeHudText,
      clockAriaLabel: clock.getAttribute("aria-label"),
      glyphCount: clock.querySelectorAll("[data-native-hud-glyph-slot]").length,
      legacyHudNodeCount: host.querySelectorAll(
        "#hud-scorebar, #hud-scoreboard, #hud-half, #hud-notice, #hud-footer, #hud-actions, #hud-rematch",
      ).length,
      officials,
      live: {
        phase: inspect.live?.phase ?? null,
        matchHalf: inspect.live?.matchHalf ?? null,
        terminal: inspect.live?.terminal === true,
      },
    };
  })()`);
  const stageValid = expectedHalf === null
    || (expectedHalf === "First half" && hud.live.matchHalf === 0 && !hud.live.terminal)
    || (expectedHalf === "Second half" && hud.live.matchHalf === 1 && !hud.live.terminal)
    || (expectedHalf === "Half-time" && hud.live.phase?.startsWith("halftime"))
    || (expectedHalf === "Full-time" && hud.live.terminal === true);
  if (
    hud.visible !== true
    || hud.topLayerOpen !== true
    || !/^(?:[0-8]?\d|90):[0-5]\d$/u.test(hud.clock)
    || !/^\d+ minutes \d+ seconds$/u.test(hud.clockAriaLabel)
    || hud.glyphCount !== 5
    || hud.legacyHudNodeCount !== 0
    || !stageValid
  ) {
    throw new Error(`Full Match Alpha evidence HUD failed at ${name}: ${JSON.stringify(hud)}`);
  }
  captures.push({
    id: name.replace(/\.png$/u, ""),
    tick,
    path: relative(CSSOCCER_REPO_ROOT, result.path),
    bytes: result.bytes,
    sha256: result.sha256,
    readiness: result.readiness,
    hud,
    data: result.data,
  });
}

function validateSampleCaptureTargets(root, targets) {
  if (root === null) {
    if (targets.length !== 0) {
      throw new Error("Adaptive visual sample targets require sampleCaptureRoot.");
    }
    return [];
  }
  if (typeof root !== "string" || root.length === 0) {
    throw new Error("Adaptive visual sample capture root must be a non-empty path.");
  }
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("Adaptive visual sample capture requires at least one target.");
  }
  const checked = targets.map((target, index) => {
    if (
      target === null
      || typeof target !== "object"
      || (target.matchHalf !== 0 && target.matchHalf !== 1)
      || !Number.isSafeInteger(target.halfLiveTick)
      || target.halfLiveTick < 1
      || target.halfLiveTick > 1_199
    ) {
      throw new Error(`Invalid adaptive visual sample target ${index}: ${JSON.stringify(target)}`);
    }
    return Object.freeze({
      matchHalf: target.matchHalf,
      halfLiveTick: target.halfLiveTick,
    });
  });
  for (let index = 1; index < checked.length; index += 1) {
    const previous = checked[index - 1];
    const current = checked[index];
    if (
      current.matchHalf < previous.matchHalf
      || (current.matchHalf === previous.matchHalf
        && current.halfLiveTick <= previous.halfLiveTick)
    ) {
      throw new Error("Adaptive visual sample targets must be strictly ordered by half and live tick.");
    }
  }
  return checked;
}

async function writeContactSheet(root, captures) {
  if (captures.length !== 4) {
    throw new Error(`Full Match Alpha evidence requires four frames, got ${captures.length}.`);
  }
  const width = 1440;
  const height = 900;
  const labels = ["LIVE INTERACTION", "STATE-DRIVEN RESTART", "HALF-TIME", "FULL-TIME"];
  const cells = captures.map((entry, index) => {
    const x = (index % 2) * 720;
    const y = Math.floor(index / 2) * 450;
    return `<g transform="translate(${x} ${y})"><image width="720" height="450" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${entry.data}"/><rect x="12" y="12" width="260" height="30" rx="4" fill="rgba(0,0,0,.78)"/><text x="24" y="33" fill="#fff" font-family="system-ui,sans-serif" font-size="15" font-weight="700">${labels[index]} · TICK ${entry.tick}</text></g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${cells}</svg>\n`;
  const path = join(root, "contact-sheet.svg");
  await mkdir(root, { recursive: true });
  await writeFile(path, svg);
  return {
    path: relative(CSSOCCER_REPO_ROOT, path),
    bytes: Buffer.byteLength(svg),
    sha256: sha256(svg),
  };
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_ROOT = join(REPO_ROOT, "output", "player-highlight-evidence");
const SCREENSHOT_PATH = join(OUTPUT_ROOT, "frame-live-player-highlight.png");
const REPORT_PATH = join(OUTPUT_ROOT, "report.json");
const PORT = 5201;
const TARGET_URL = `http://127.0.0.1:${PORT}/`;
const TIMEOUT_MS = 45_000;
const SESSION = `cssoccer-player-highlight-${process.pid}`;

const options = parseArgs(process.argv.slice(2));
let server = null;
let browserOpened = false;
let serverOutput = "";

try {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  server = startVite();
  await waitForHttp(TARGET_URL, TIMEOUT_MS);

  await runPlaywright([
    "--json",
    "open",
    TARGET_URL,
    "--browser",
    "chrome",
  ]);
  browserOpened = true;
  await runPlaywright(["resize", "1440", "900"]);

  // The snapshot is deliberately taken before interaction so locator and page
  // state are inspected on the sole production route before commands are sent.
  await runPlaywright(["--json", "snapshot"]);

  const capture = await runPlaywrightJson([
    "--json",
    "run-code",
    browserScenarioSource(),
  ]);
  assertCapture(capture);

  await runPlaywright([
    "--json",
    "screenshot",
    "--filename",
    SCREENSHOT_PATH,
    "--full-page",
  ]);
  const screenshotBytes = await readFile(SCREENSHOT_PATH);
  const report = Object.freeze({
    schema: "cssoccer-player-highlight-evidence@1",
    mode: options.mode,
    capturedAt: new Date().toISOString(),
    route: TARGET_URL,
    viewport: { width: 1440, height: 900 },
    screenshot: {
      file: SCREENSHOT_PATH,
      byteLength: screenshotBytes.byteLength,
      sha256: createHash("sha256").update(screenshotBytes).digest("hex"),
    },
    capture,
  });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: options.mode,
    tick: capture.live.tick,
    playerId: capture.live.playerHighlight.playerId,
    highlightType: capture.live.playerHighlight.type,
    rootCount: capture.mount.rootCount,
    stableIdentityCount: capture.mount.stableIdentityCount,
    runtimeConstruction: capture.mount.runtimeConstruction,
    screenshot: report.screenshot,
    report: REPORT_PATH,
  }, null, 2)}\n`);
} catch (error) {
  const detail = serverOutput.trim();
  process.stderr.write(`${error.stack || error.message}\n`);
  if (detail) process.stderr.write(`${detail}\n`);
  process.exitCode = 1;
} finally {
  if (browserOpened) {
    await runPlaywright(["close"], { allowFailure: true });
  }
  await stopProcess(server);
}

function parseArgs(args) {
  let mode = null;
  let check = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--mode") {
      mode = args[index + 1] ?? null;
      index += 1;
    } else if (arg === "--check") {
      check = true;
    } else {
      throw new Error(`Unknown player-highlight capture option ${arg}.`);
    }
  }
  if (mode !== "free-play" || !check) {
    throw new Error(
      "Player-highlight evidence requires exactly --mode free-play --check.",
    );
  }
  return Object.freeze({ mode, check });
}

function startVite() {
  const child = spawn(
    "pnpm",
    ["exec", "vite", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => {
    serverOutput = appendBounded(serverOutput, String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    serverOutput = appendBounded(serverOutput, String(chunk));
  });
  return child;
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) {
      throw new Error(`Canonical css.soccer Vite server exited with ${server.exitCode}.`);
    }
    try {
      const response = await fetch(url, { redirect: "error" });
      if (response.ok) return;
    } catch {
      // The one strict-port server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function runPlaywright(args, { allowFailure = false } = {}) {
  try {
    return await execFileAsync(
      "npx",
      [
        "--yes",
        "--package",
        "@playwright/cli",
        "playwright-cli",
        `-s=${SESSION}`,
        ...args,
      ],
      {
        cwd: REPO_ROOT,
        env: process.env,
        maxBuffer: 16 * 1024 * 1024,
        timeout: TIMEOUT_MS,
      },
    );
  } catch (error) {
    if (allowFailure) return null;
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Playwright CLI failed${output ? `:\n${output}` : "."}`);
  }
}

async function runPlaywrightJson(args) {
  const { stdout } = await runPlaywright(args);
  let envelope;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    throw new Error(`Playwright CLI returned invalid JSON:\n${stdout}`);
  }
  if (typeof envelope.result !== "string") {
    throw new Error(`Playwright CLI omitted its scenario result: ${stdout}`);
  }
  return JSON.parse(envelope.result);
}

function browserScenarioSource() {
  return String.raw`async page => {
    const pageErrors = [];
    const failedRequests = [];
    page.on("pageerror", error => pageErrors.push(error.stack || error.message));
    page.on("console", message => {
      if (["error", "assert"].includes(message.type())) pageErrors.push(message.text());
    });
    page.on("requestfailed", request => {
      failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "failed" });
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const inspected = window.__cssoccerDebug?.inspect?.();
      return inspected?.ready === true || inspected?.status === "error";
    }, null, { timeout: 30000 });
    const initialInspection = await page.evaluate(() => window.__cssoccerDebug.inspect());
    if (!initialInspection.ready || initialInspection.status !== "ready") {
      throw new Error("Canonical css.soccer route did not reach ready state: "
        + JSON.stringify(initialInspection));
    }

    const rootsBefore = await page.locator("[data-cssoccer-root-id]").evaluateAll(
      roots => roots.map(root => root.dataset.cssoccerRootId),
    );
    await page.waitForFunction(() => {
      const live = window.__cssoccerDebug?.live;
      return live?.tick >= 175 && live.playerHighlight.visible === true;
    }, null, { timeout: 30000 });
    const beforeMove = await page.evaluate(() => {
      const debug = window.__cssoccerDebug;
      const live = debug.live;
      const command = live.players.commands.find(({ rootId }) => rootId === live.selectedPlayerId);
      return {
        tick: live.tick,
        selectedPlayerId: live.selectedPlayerId,
        position: [...command.transform.position],
      };
    });

    await page.keyboard.down("d");
    await page.waitForFunction(() => (
      window.__cssoccerDebug?.inspect?.().input.lastCommand?.moveX === 127
    ));
    const keyboardCommand = await page.evaluate(() => ({
      ...window.__cssoccerDebug.inspect().input.lastCommand,
    }));
    await page.waitForTimeout(350);
    await page.keyboard.up("d");
    await page.waitForFunction(() => (
      window.__cssoccerDebug?.inspect?.().input.lastCommand?.moveX === 0
    ));

    const touchRight = page.locator('[data-cssoccer-control="move-right"]');
    await touchRight.dispatchEvent("pointerdown", {
      pointerId: 77,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      buttons: 1,
    });
    await page.waitForFunction(() => (
      window.__cssoccerDebug?.inspect?.().input.lastCommand?.moveX === 127
    ));
    const touchCommand = await page.evaluate(() => ({
      ...window.__cssoccerDebug.inspect().input.lastCommand,
    }));
    const touchPressed = await touchRight.getAttribute("aria-pressed");
    await page.waitForTimeout(350);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerup", {
      pointerId: 77,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      buttons: 0,
      bubbles: true,
      cancelable: true,
    })));
    await page.waitForFunction(() => (
      window.__cssoccerDebug?.inspect?.().input.lastCommand?.moveX === 0
    ));

    await page.waitForFunction(() => {
      const inspected = window.__cssoccerDebug?.inspect?.();
      return inspected?.live?.tick >= 190
        && inspected.live.playerHighlight.visible === true;
    }, null, { timeout: 30000 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => (
      document.body.dataset.matchPaused === "true"
      && window.__cssoccerDebug?.inspect?.().input.paused === true
    ));
    await page.waitForTimeout(150);

    const inspected = await page.evaluate(() => {
      const debug = window.__cssoccerDebug;
      const inspection = debug.inspect();
      const live = debug.live;
      const selectedCommand = live.players.commands.find(
        ({ rootId }) => rootId === live.selectedPlayerId,
      );
      const marker = document.querySelector(
        '[data-cssoccer-root-id="player-highlight-local-user-1"]',
      );
      const roots = [...document.querySelectorAll("[data-cssoccer-root-id]")];
      const hud = {
        score: {
          spain: document.getElementById("hud-score-spain")?.textContent,
          argentina: document.getElementById("hud-score-argentina")?.textContent,
        },
        clock: document.getElementById("hud-clock")?.textContent,
        phase: document.getElementById("match-hud")?.dataset.phase,
        notice: document.getElementById("hud-notice")?.textContent,
        activePlayer: document.getElementById("hud-active-player")?.textContent,
        selectedCountry: document.getElementById("hud-selected-country")?.textContent,
        paused: document.getElementById("match-hud")?.dataset.paused,
      };
      const beforeMutationTick = live.tick;
      const originalPosition = live.playerHighlight.transform.position[0];
      const directMutationAccepted = Reflect.set(
        live.playerHighlight.transform.position,
        0,
        originalPosition + 1000,
      );
      const inspectionMutationAccepted = Reflect.set(
        inspection.live.playerHighlight.position,
        0,
        originalPosition + 1000,
      );
      return {
        inspection,
        mount: inspection.mount,
        live: {
          tick: live.tick,
          phase: live.phase,
          score: { ...live.score },
          clock: { ...live.clock },
          selectedPlayerId: live.selectedPlayerId,
          selectedPlayerPosition: [...selectedCommand.transform.position],
          playerHighlight: {
            rootId: live.playerHighlight.rootId,
            playerId: live.playerHighlight.playerId,
            visible: live.playerHighlight.visible,
            type: live.playerHighlight.type.semantic,
            familyId: live.playerHighlight.family.id,
            frameIndex: live.playerHighlight.family.frameIndex,
            materialId: live.playerHighlight.material.id,
            facingMode: live.playerHighlight.facingMode,
            blinkMode: live.playerHighlight.blinkMode,
            ordinaryShadow: live.playerHighlight.ordinaryShadow,
            position: [...live.playerHighlight.transform.position],
          },
        },
        markerDom: marker === null ? null : {
          connected: marker.isConnected,
          hidden: marker.hidden,
          kind: marker.dataset.cssoccerKind,
          playerId: marker.dataset.cssoccerHighlightPlayerId,
          type: marker.dataset.cssoccerHighlightType,
          familyId: marker.dataset.cssoccerHighlightFamily,
          ordinaryShadow: marker.dataset.cssoccerHighlightOrdinaryShadow,
        },
        hud,
        rootsAfter: roots.map(root => root.dataset.cssoccerRootId),
        uniqueRootCount: new Set(roots.map(root => root.dataset.cssoccerRootId)).size,
        readOnly: {
          liveFrozen: Object.isFrozen(live),
          highlightFrozen: Object.isFrozen(live.playerHighlight),
          highlightPositionFrozen: Object.isFrozen(live.playerHighlight.transform.position),
          inspectionFrozen: Object.isFrozen(inspection),
          inspectionLiveFrozen: Object.isFrozen(inspection.live),
          directMutationAccepted,
          inspectionMutationAccepted,
          beforeMutationTick,
          positionAfterMutationAttempt: live.playerHighlight.transform.position[0],
        },
      };
    });
    await page.waitForTimeout(150);
    const tickAfterReadOnlyChecks = await page.evaluate(
      () => window.__cssoccerDebug.live.tick,
    );

    return {
      pageErrors,
      failedRequests,
      initialInspection,
      beforeMove,
      keyboardCommand,
      touchCommand,
      touchPressed,
      rootsBefore,
      tickAfterReadOnlyChecks,
      ...inspected,
    };
  }`;
}

function assertCapture(capture) {
  const failures = [];
  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const { mount, live, markerDom, hud } = capture;
  const zeroConstruction = mount?.runtimeConstruction
    && Object.values(mount.runtimeConstruction).every((value) => value === 0);
  check(capture.pageErrors?.length === 0, "page emitted errors");
  check(capture.failedRequests?.length === 0, "page emitted failed requests");
  check(capture.initialInspection?.requests?.nativeRequestCount === 0, "runtime requested native data");
  check(capture.initialInspection?.requests?.sourceRequestCount === 0, "runtime requested source data");
  check(mount?.rootCount === 37, "prepared route did not mount exactly 37 source-bound roots");
  check(mount?.highlightRootCount === 1, "prepared route did not mount exactly one highlight");
  check(mount?.officialRootCount === 3, "prepared route did not mount all three officials");
  check(mount?.exactOfficialRootCount === 3, "prepared route did not mount exact official assets");
  check(mount?.stableIdentityCount === 37, "prepared root identity changed");
  check(mount?.connectedRootCount === 37, "prepared root detached");
  check(mount?.detachedLeafCount === 0, "prepared leaf detached");
  check(zeroConstruction, "browser performed runtime geometry construction");
  check(capture.uniqueRootCount === 37, "prepared root ids are not unique");
  check(sameArray(capture.rootsBefore, capture.rootsAfter), "prepared root order or identity changed");
  check(live?.tick >= 190, "live match did not reach the evidence tick");
  check(live?.selectedPlayerId?.startsWith("argentina-player-"), "control left Argentina");
  check(live?.playerHighlight?.playerId === live?.selectedPlayerId, "marker lost current control");
  check(live?.playerHighlight?.visible === true, "current marker is not visible");
  check(live?.playerHighlight?.rootId === "player-highlight-local-user-1", "marker root changed");
  check(live?.playerHighlight?.materialId === "player-highlight-colour-0", "marker material changed");
  check(live?.playerHighlight?.ordinaryShadow === "suppressed", "ordinary shadow was not excluded");
  check(sameVector(live?.playerHighlight?.position, live?.selectedPlayerPosition), "marker does not follow the live player");
  check(sameVector(live?.playerHighlight?.position, mount?.highlightPosition), "mounted marker transform diverged");
  check(mount?.highlightPreparedFrameIndex === live?.playerHighlight?.frameIndex, "mounted marker frame diverged");
  check(markerDom?.connected === true && markerDom.hidden === false, "marker DOM is hidden or detached");
  check(markerDom?.kind === "highlight", "marker DOM kind changed");
  check(markerDom?.playerId === live?.playerHighlight?.playerId, "marker DOM player changed");
  check(markerDom?.type === live?.playerHighlight?.type, "marker DOM type changed");
  check(markerDom?.familyId === live?.playerHighlight?.familyId, "marker DOM family changed");
  check(markerDom?.ordinaryShadow === live?.playerHighlight?.ordinaryShadow, "marker DOM shadow state changed");
  check(!sameVector(capture.beforeMove?.position, live?.selectedPlayerPosition), "live commands did not move the selected player");
  check(normalizedCommandEqual(capture.keyboardCommand, capture.touchCommand), "keyboard and touch commands diverged");
  check(capture.touchPressed === "true", "touch pressed feedback was not published");
  check(hud?.score?.spain === String(live?.score?.spain), "Spain HUD score diverged");
  check(hud?.score?.argentina === String(live?.score?.argentina), "Argentina HUD score diverged");
  check(hud?.clock === formatClock(live?.clock), "HUD clock diverged");
  check(hud?.phase === live?.phase, "HUD phase diverged");
  check(hud?.activePlayer === live?.selectedPlayerId, "HUD active player diverged");
  check(hud?.selectedCountry === "Argentina", "HUD selected country diverged");
  check(hud?.paused === "true" && hud?.notice === "Paused", "HUD pause feedback diverged");
  check(capture.readOnly?.liveFrozen === true, "live render snapshot is mutable");
  check(capture.readOnly?.highlightFrozen === true, "highlight snapshot is mutable");
  check(capture.readOnly?.highlightPositionFrozen === true, "highlight position is mutable");
  check(capture.readOnly?.inspectionFrozen === true, "debug inspection is mutable");
  check(capture.readOnly?.inspectionLiveFrozen === true, "debug live inspection is mutable");
  check(capture.readOnly?.directMutationAccepted === false, "live marker accepted mutation");
  check(capture.readOnly?.inspectionMutationAccepted === false, "debug marker accepted mutation");
  check(
    capture.readOnly?.positionAfterMutationAttempt === live?.playerHighlight?.position?.[0],
    "marker position changed through a consumer",
  );
  check(
    capture.tickAfterReadOnlyChecks === capture.readOnly?.beforeMutationTick,
    "read-only inspection advanced gameplay",
  );
  if (failures.length > 0) {
    throw new Error(`Player-highlight evidence failed:\n- ${failures.join("\n- ")}\n${JSON.stringify(capture, null, 2)}`);
  }
}

function normalizedCommandEqual(left, right) {
  return left?.moveX === 127
    && left.moveY === 0
    && left.buttons === 0
    && right?.moveX === left.moveX
    && right.moveY === left.moveY
    && right.buttons === left.buttons;
}

function formatClock(clock) {
  if (!clock) return "";
  return `${String(clock.minutes).padStart(2, "0")}:${String(Math.floor(clock.seconds)).padStart(2, "0")}`;
}

function sameArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function sameVector(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => Object.is(value, right[index]));
}

function appendBounded(current, next) {
  return `${current}${next}`.slice(-16_384);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

#!/usr/bin/env node
import { join, relative } from "node:path";

import {
  CSSOCCER_REPO_ROOT,
  atomicWriteJson,
  withHeadlessCssoccerBrowser,
} from "./support/headless-cssoccer-browser.mjs";
import {
  assertAdaptiveReport,
  runAdaptiveFreePlayBrowser,
} from "./support/adaptive-free-play-browser.mjs";

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log("Usage: node tools/capture-free-play-evidence.mjs --check [--country <spain|argentina>]");
} else {
  await main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}

async function main() {
  const generatedAt = new Date().toISOString();
  const runId = generatedAt.replace(/[:.]/gu, "-");
  const runRoot = join(
    CSSOCCER_REPO_ROOT,
    ".local/cssoccer/free-play/evidence/runs",
    runId,
  );
  const adaptive = assertAdaptiveReport(await runAdaptiveFreePlayBrowser({
    port: 5212,
    timeoutMs: 210_000,
    inputMode: "keyboard",
    captureRoot: runRoot,
    controlCountry: options.country,
  }));
  const touch = await captureTouchLayout(runRoot, options.country);
  const report = {
    schema: "cssoccer-full-match-alpha-visual-evidence@1",
    status: "pass",
    generatedAt,
    runId,
    route: adaptive.route,
    stages: adaptive.evidence,
    keyboard: {
      inputMode: adaptive.inputMode,
      inputBranchCount: adaptive.interaction.inputBranches.length,
      pause: adaptive.interaction.pause,
      fullMatch: true,
    },
    touch,
    terminal: adaptive.terminal,
    rematch: adaptive.rematch,
    integrity: adaptive.integrity,
  };
  assertEvidenceReport(report);
  const retainedPath = join(runRoot, "report.json");
  const currentPath = join(
    CSSOCCER_REPO_ROOT,
    ".local/cssoccer/free-play/evidence/current.json",
  );
  const [retained, current] = await Promise.all([
    atomicWriteJson(retainedPath, report),
    atomicWriteJson(currentPath, report),
  ]);
  console.log(JSON.stringify({
    status: "pass",
    report: relative(CSSOCCER_REPO_ROOT, current.path),
    retainedReport: relative(CSSOCCER_REPO_ROOT, retained.path),
    reportSha256: current.sha256,
    stages: report.stages.captures,
    contactSheet: report.stages.contactSheet,
    touch: report.touch,
    terminal: report.terminal,
  }, null, 2));
}

async function captureTouchLayout(runRoot, controlCountry) {
  return withHeadlessCssoccerBrowser({
    port: 5213,
    timeoutMs: 90_000,
    viewport: { width: 390, height: 844 },
    coarsePointer: true,
    controlCountry,
  }, async (browser) => {
    const matrix = await browser.evaluate(`(async () => {
      const cases = [
        ["move-up", { moveX: 0, moveY: -127, buttons: 0 }],
        ["move-left", { moveX: -127, moveY: 0, buttons: 0 }],
        ["move-down", { moveX: 0, moveY: 127, buttons: 0 }],
        ["move-right", { moveX: 127, moveY: 0, buttons: 0 }],
        ["fire-1", { moveX: 0, moveY: 0, buttons: 1 }],
        ["fire-2", { moveX: 0, moveY: 0, buttons: 2 }],
      ];
      const commandProjection = () => {
        const command = window.__cssoccerDebug.inspect().input.lastCommand;
        return command === null ? null : {
          moveX: command.moveX,
          moveY: command.moveY,
          buttons: command.buttons,
        };
      };
      const waitForCommand = async (expected) => {
        const deadline = performance.now() + 2_000;
        while (performance.now() < deadline) {
          const command = commandProjection();
          if (JSON.stringify(command) === JSON.stringify(expected)) return command;
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        throw new Error("Touch command was not published: " + JSON.stringify({
          expected,
          actual: commandProjection(),
        }));
      };
      const results = [];
      for (let index = 0; index < cases.length; index += 1) {
        const [control, expected] = cases[index];
        const target = document.querySelector('[data-cssoccer-control="' + control + '"]');
        const pointerId = 201 + index;
        target.dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "touch",
          isPrimary: index === 0,
        }));
        const down = await waitForCommand(expected);
        const ariaPressedDuringHold = target.getAttribute("aria-pressed");
        target.dispatchEvent(new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "touch",
          isPrimary: index === 0,
        }));
        await waitForCommand({ moveX: 0, moveY: 0, buttons: 0 });
        results.push({
          control,
          expected,
          down,
          ariaPressedDuringHold,
          ariaPressedAfterRelease: target.getAttribute("aria-pressed"),
        });
      }
      const controls = [...document.querySelectorAll("[data-cssoccer-control]")];
      const host = document.getElementById("touch-controls");
      const hostStyle = getComputedStyle(host);
      const inspect = window.__cssoccerDebug.inspect();
      return {
        coarsePointer: matchMedia("(any-pointer: coarse)").matches,
        maxTouchPoints: navigator.maxTouchPoints,
        controlCount: controls.length,
        visible: hostStyle.display !== "none" && host.getBoundingClientRect().height > 0,
        labels: controls.map((control) => control.getAttribute("aria-label")),
        results,
        finalInput: inspect.input,
        pageErrorCount: inspect.pageErrorCount,
        runtimeConstruction: inspect.mount.runtimeConstruction,
      };
    })()`, { awaitPromise: true });
    const screenshot = await browser.screenshot(join(runRoot, "05-touch-layout.png"));
    const valid = matrix.coarsePointer === true
      && matrix.maxTouchPoints === 5
      && matrix.controlCount === 6
      && matrix.visible === true
      && matrix.results.every((result) => (
        JSON.stringify(result.down) === JSON.stringify(result.expected)
        && result.ariaPressedDuringHold === "true"
        && result.ariaPressedAfterRelease === "false"
      ))
      && matrix.finalInput.keyboardCodes.length === 0
      && matrix.finalInput.lastCommand.moveX === 0
      && matrix.finalInput.lastCommand.moveY === 0
      && matrix.finalInput.lastCommand.buttons === 0
      && matrix.pageErrorCount === 0
      && Object.values(matrix.runtimeConstruction).every((count) => count === 0);
    if (!valid) throw new Error(`Touch layout evidence failed: ${JSON.stringify(matrix)}`);
    return {
      ...matrix,
      status: "pass",
      screenshot: {
        path: relative(CSSOCCER_REPO_ROOT, screenshot.path),
        bytes: screenshot.bytes,
        sha256: screenshot.sha256,
      },
    };
  });
}

function assertEvidenceReport(report) {
  const stageKeys = Object.keys(report.stages?.stageTicks ?? {}).sort();
  const expectedOfficialMaterials = new Map([
    ["referee-00", "actua-referee-material"],
    ["assistant-referee-01", "actua-assistant-referee-material"],
    ["assistant-referee-02", "actua-assistant-referee-material"],
  ]);
  const officialEvidence = report.stages?.captures.flatMap(({ hud }) => hud.officials ?? []) ?? [];
  const visibleOfficialIds = new Set(
    officialEvidence.filter(({ visible }) => visible).map(({ id }) => id),
  );
  const exactOfficialEvidence = officialEvidence.length === 12
    && officialEvidence.every(({ id, connected, leafCount, materialId, modelId }) => (
      expectedOfficialMaterials.get(id) === materialId
      && connected === true
      && leafCount === 12
      && (id === "referee-00" ? modelId === "player_fr" : modelId === "player_fl")
    ));
  if (
    report.status !== "pass"
    || JSON.stringify(stageKeys) !== JSON.stringify(["fulltime", "halftime", "live", "restart"])
    || report.stages.captures.length !== 4
    || !exactOfficialEvidence
    || visibleOfficialIds.size !== 3
    || !report.stages.contactSheet?.sha256
    || report.keyboard?.fullMatch !== true
    || report.keyboard?.inputBranchCount < 3
    || report.touch?.status !== "pass"
    || report.terminal?.phase !== "full-time-terminal"
    || report.rematch?.tick !== 0
    || report.integrity?.pageErrors?.length !== 0
  ) {
    throw new Error(`Full Match Alpha evidence acceptance failed: ${JSON.stringify(report)}`);
  }
  return report;
}

function parseArgs(args) {
  const options = { check: false, country: "argentina", help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--country") options.country = args[++index];
    else throw new Error(`Unknown evidence option ${arg}.`);
  }
  if (!options.help && options.check !== true) {
    throw new Error("--check is required for release acceptance.");
  }
  if (!options.help && !["spain", "argentina"].includes(options.country)) {
    throw new Error("--country must be spain or argentina.");
  }
  return options;
}

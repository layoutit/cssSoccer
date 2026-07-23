#!/usr/bin/env node
import { join, relative } from "node:path";

import {
  CSSOCCER_REPO_ROOT,
  atomicWriteJson,
} from "./support/headless-cssoccer-browser.mjs";
import {
  assertAdaptiveReport,
  runAdaptiveFreePlayBrowser,
} from "./support/adaptive-free-play-browser.mjs";

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
} else {
  await main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}

async function main() {
  const report = assertAdaptiveReport(await runAdaptiveFreePlayBrowser({
    port: options.port,
    timeoutMs: options.timeoutMs,
    inputMode: "keyboard",
    controlCountry: options.country,
  }));
  const runId = report.generatedAt.replace(/[:.]/gu, "-");
  const root = join(CSSOCCER_REPO_ROOT, ".local/cssoccer/free-play/adaptive");
  const [retained, countryCurrent, current] = await Promise.all([
    atomicWriteJson(join(root, "runs", `${runId}-${options.country}`, "report.json"), report),
    atomicWriteJson(join(root, `current-${options.country}.json`), report),
    atomicWriteJson(join(root, "current.json"), report),
  ]);
  console.log(JSON.stringify({
    status: "pass",
    report: relative(CSSOCCER_REPO_ROOT, current.path),
    countryReport: relative(CSSOCCER_REPO_ROOT, countryCurrent.path),
    retainedReport: relative(CSSOCCER_REPO_ROOT, retained.path),
    reportSha256: current.sha256,
    terminal: report.terminal,
    rematch: report.rematch,
    interaction: {
      controlledPlayers: report.interaction.controlledPlayers.length,
      possessionTransitions: report.interaction.possessionTransitions.length,
      eventTypes: report.interaction.eventTypes,
      restartKinds: report.interaction.restartKinds,
      inputBranches: report.interaction.inputBranches.length,
      officials: report.interaction.officials.map((official) => ({
        id: official.id,
        positionStateCount: official.positionStateCount,
        renderAnimationStateCount: official.renderAnimationStateCount,
        missingStateCount: official.missingStateCount,
        projectionMismatchCount: official.projectionMismatchCount,
      })),
    },
    integrity: report.integrity,
  }, null, 2));
}

function parseArgs(args) {
  const options = {
    check: false,
    country: null,
    fullMatch: false,
    help: false,
    port: 5211,
    timeoutMs: 300_000,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--full-match") options.fullMatch = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--country") options.country = args[++index];
    else if (arg === "--port") options.port = positiveInteger(args[++index], arg);
    else if (arg === "--timeout-ms") options.timeoutMs = positiveInteger(args[++index], arg);
    else throw new Error(`Unknown adaptive smoke option ${arg}.`);
  }
  if (!options.help) {
    if (!["spain", "argentina"].includes(options.country)) {
      throw new Error("--country must be spain or argentina.");
    }
    if (options.fullMatch !== true) throw new Error("--full-match is required.");
    if (options.check !== true) throw new Error("--check is required for release acceptance.");
  }
  return options;
}

function positiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} requires a positive integer.`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node tools/smoke-free-play-adaptive.mjs --country <spain|argentina> --full-match --check

Runs one real-scheduler, public-debug-snapshot, adaptive keyboard match through
full time and rematch on the canonical Full Match Alpha route.`);
}

#!/usr/bin/env node
import { randomBytes } from "node:crypto";
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
  console.log("Usage: node tools/capture-random-match-frames.mjs --check [--country <spain|argentina>]");
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
    ".local/cssoccer/free-play/random-frames/runs",
    runId,
  );
  const seed = randomBytes(4).readUInt32BE(0);
  const targets = randomTargets(seed);
  const adaptive = assertAdaptiveReport(await runAdaptiveFreePlayBrowser({
    port: 5215,
    timeoutMs: 300_000,
    inputMode: "keyboard",
    sampleCaptureRoot: runRoot,
    sampleCaptureTargets: targets,
    controlCountry: options.country,
  }));
  const captures = adaptive.evidence.sampleCaptures;
  const report = {
    schema: "cssoccer-full-match-alpha-random-frames@1",
    status: "pass",
    generatedAt,
    runId,
    seed,
    browser: adaptive.browser,
    route: adaptive.route,
    inputMode: adaptive.inputMode,
    targets,
    captures,
    terminal: adaptive.terminal,
    rematch: adaptive.rematch,
    integrity: adaptive.integrity,
  };
  assertReport(report);
  const retained = await atomicWriteJson(join(runRoot, "report.json"), report);
  const current = await atomicWriteJson(join(
    CSSOCCER_REPO_ROOT,
    ".local/cssoccer/free-play/random-frames/current.json",
  ), report);
  console.log(JSON.stringify({
    status: "pass",
    report: relative(CSSOCCER_REPO_ROOT, current.path),
    retainedReport: relative(CSSOCCER_REPO_ROOT, retained.path),
    reportSha256: current.sha256,
    browser: report.browser,
    route: report.route,
    seed,
    captures,
  }, null, 2));
}

function randomTargets(seed) {
  const ranges = [
    [90, 210],
    [250, 430],
    [470, 650],
    [690, 880],
    [920, 1_110],
  ];
  let state = seed >>> 0;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return [0, 1].flatMap((matchHalf) => ranges.map(([minimum, maximum]) => ({
    matchHalf,
    halfLiveTick: minimum + (next() % (maximum - minimum + 1)),
  })));
}

function assertReport(report) {
  if (
    report.status !== "pass"
    || report.route?.canonical !== true
    || report.captures?.length !== 10
    || new Set(report.captures.map(({ sha256 }) => sha256)).size !== 10
    || report.captures.some(({ readiness }) => (
      readiness?.ready !== true
      || readiness.stableFrames < 3
      || readiness.runningTransformAnimations !== 0
      || readiness.focusVisible !== false
      || readiness.imageReadiness?.failureCount !== 0
    ))
    || report.integrity?.pageErrors?.length !== 0
    || report.terminal?.phase !== "full-time-terminal"
    || report.rematch?.tick !== 0
  ) {
    throw new Error(`Random Full Match Alpha frame evidence failed: ${JSON.stringify(report)}`);
  }
}

function parseArgs(args) {
  const options = { check: false, country: "argentina", help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--country") options.country = args[++index];
    else throw new Error(`Unknown random frame capture option ${arg}.`);
  }
  if (!options.help && options.check !== true) {
    throw new Error("--check is required for random frame evidence.");
  }
  if (!options.help && !["spain", "argentina"].includes(options.country)) {
    throw new Error("--country must be spain or argentina.");
  }
  return options;
}

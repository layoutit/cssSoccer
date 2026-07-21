#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { createCssoccerFreePlayEngine } from "../src/cssoccer/freePlayEngine.mjs";
import { createCssoccerFreePlayState } from "../src/cssoccer/freePlayState.mjs";
import {
  CSSOCCER_REPO_ROOT,
  atomicWriteJson,
  sha256,
} from "./support/headless-cssoccer-browser.mjs";

const options = parseArgs(process.argv.slice(2));
const FULL_MATCH_TICK_CEILING = 9_000;
const AGENCY_BRANCH_TICK_CEILING = 800;
if (options.help) {
  printHelp();
} else {
  await main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}

async function main() {
  const fixture = await loadPreparedFixture();
  const specifications = [
    { id: "seed-3523-a", initialSeed: 3523, commandSeed: 0x17a2_0f31 },
    { id: "seed-golden-b", initialSeed: 0x9e37_79b9, commandSeed: 0x3141_5926 },
    { id: "seed-cafe-c", initialSeed: 0xcafe_babe, commandSeed: 0x2718_2818 },
  ];
  const runs = [];
  for (const specification of specifications) {
    runs.push(runSoak(fixture, specification, FULL_MATCH_TICK_CEILING, options.country));
  }
  const repeated = runSoak(
    fixture,
    { ...specifications[0], id: "seed-3523-a-repeat" },
    FULL_MATCH_TICK_CEILING,
    options.country,
  );
  const branchRuns = [
    runSoak(fixture, { id: "branch-1", initialSeed: 3523, commandSeed: 0x0101_0101 }, AGENCY_BRANCH_TICK_CEILING, options.country),
    runSoak(fixture, { id: "branch-2", initialSeed: 3523, commandSeed: 0x0202_0202 }, AGENCY_BRANCH_TICK_CEILING, options.country),
    runSoak(fixture, { id: "branch-3", initialSeed: 3523, commandSeed: 0x0303_0303 }, AGENCY_BRANCH_TICK_CEILING, options.country),
  ];
  const report = {
    schema: "cssoccer-full-match-alpha-multiseed-soak@1",
    status: "pass",
    generatedAt: new Date().toISOString(),
    scenario: {
      fixtureId: "spain-argentina-full-match",
      controlCountry: options.country,
      tickRateHz: 20,
      fullMatchTickCeiling: FULL_MATCH_TICK_CEILING,
      commandOwnership: "current-state-valid-browser-command",
      seedCount: runs.length,
    },
    runs,
    determinism: {
      runId: runs[0].id,
      repeatedRunId: repeated.id,
      commandSha256: runs[0].commandSha256,
      repeatedCommandSha256: repeated.commandSha256,
      worldEventSha256: runs[0].worldEventSha256,
      repeatedWorldEventSha256: repeated.worldEventSha256,
      exact: runs[0].commandSha256 === repeated.commandSha256
        && runs[0].worldEventSha256 === repeated.worldEventSha256,
    },
    agency: {
      branches: branchRuns.map(({ id, commandSha256, worldEventSha256 }) => ({
        id,
        commandSha256,
        worldEventSha256,
      })),
      distinctCommandCount: new Set(branchRuns.map(({ commandSha256 }) => commandSha256)).size,
      distinctWorldEventCount: new Set(branchRuns.map(({ worldEventSha256 }) => worldEventSha256)).size,
    },
  };
  assertSoakReport(report);
  const path = join(CSSOCCER_REPO_ROOT, ".local/cssoccer/free-play/soak/current.json");
  const artifact = await atomicWriteJson(path, report);
  console.log(JSON.stringify({
    status: "pass",
    country: options.country,
    report: relative(CSSOCCER_REPO_ROOT, artifact.path),
    reportSha256: artifact.sha256,
    seeds: runs.map(({ id, terminalTick, score, eventTypeCount, restartKinds }) => ({
      id,
      terminalTick,
      score,
      eventTypeCount,
      restartKinds,
    })),
    determinism: report.determinism,
    agency: report.agency,
  }, null, 2));
}

function runSoak(fixture, specification, tickCeiling, controlCountry) {
  const initialState = createCssoccerFreePlayState({
    ...fixture,
    controlCountry,
    seed: specification.initialSeed,
  });
  const engine = createCssoccerFreePlayEngine({ initialState });
  const random = createRandom(specification.commandSeed);
  const commands = [];
  const trace = [];
  const eventCounts = new Map();
  const phases = new Set();
  const clockPhases = new Set();
  const restartKinds = new Set();
  const pauses = [];
  let finiteChecks = 0;
  while (!engine.snapshot().match.clock.terminal && engine.snapshot().tick < tickCeiling) {
    const before = engine.snapshot();
    if (before.tick === 400 || before.tick === 1_600) {
      const identity = engine.snapshot();
      const serialized = JSON.stringify(identity);
      pauses.push({
        tick: identity.tick,
        stableIdentity: identity === engine.snapshot(),
        stableBytes: serialized === JSON.stringify(engine.snapshot()),
      });
    }
    const command = chooseSoakCommand(before.match, random);
    commands.push(command);
    let after;
    try {
      after = engine.step(command);
    } catch (error) {
      throw new Error(
        `${specification.id} failed at tick ${before.tick}: ${JSON.stringify({
          command,
          matchHalf: before.match.clock.matchHalf,
          phase: before.match.phase,
          kickoff: before.match.kickoff.phase,
          teamBySlot: Object.fromEntries(before.match.teams.map((team) => [
            team.nativeTeamSlot,
            team.country,
          ])),
        })}\n${error?.stack || String(error)}`,
        { cause: error },
      );
    }
    phases.add(after.match.phase);
    clockPhases.add(after.match.clock.phase);
    for (const event of after.lastStep.events) {
      eventCounts.set(event.type, (eventCounts.get(event.type) ?? 0) + 1);
    }
    const restart = restartKind(after.match);
    if (restart) restartKinds.add(restart);
    if (after.tick % 20 === 0 || after.match.clock.terminal) {
      assertFiniteState(after.match);
      assertStateInvariants(after);
      finiteChecks += 1;
      trace.push(projectWorld(after));
    }
  }
  const final = engine.snapshot();
  assertFiniteState(final.match);
  assertStateInvariants(final);
  const commandBytes = commands.map((command) => JSON.stringify(command)).join("\n") + "\n";
  const worldEvent = {
    trace,
    events: Object.fromEntries([...eventCounts].sort(([left], [right]) => left.localeCompare(right))),
    final: projectWorld(final),
  };
  return {
    id: specification.id,
    initialSeed: specification.initialSeed >>> 0,
    commandSeed: specification.commandSeed >>> 0,
    commandCount: commands.length,
    commandSha256: sha256(commandBytes),
    worldEventSha256: sha256(JSON.stringify(worldEvent)),
    terminal: final.match.clock.terminal,
    terminalTick: final.tick,
    terminalPhase: final.match.phase,
    score: { ...final.match.score.goals },
    phases: [...phases],
    clockPhases: [...clockPhases],
    restartKinds: [...restartKinds].sort(),
    eventTypeCount: eventCounts.size,
    events: worldEvent.events,
    pauses,
    finiteChecks,
  };
}

function chooseSoakCommand(match, random) {
  const active = match.players.find(({ id }) => id === match.control.activePlayerId);
  let dx = random() < 0.5 ? -1 : 1;
  let dy = random() < 0.5 ? -1 : 1;
  if (active) {
    const owns = match.possession.owner === active.nativePlayerNumber;
    const target = owns
      ? {
          x: active.nativeTeamSlot === "A" ? 1_180 : 100,
          y: random() < 0.16 ? (random() < 0.5 ? 20 : 780) : 400,
        }
      : match.ball.ball.position;
    dx = Math.sign(target.x - active.position.x);
    dy = Math.sign(target.y - active.position.y);
    if (random() < 0.12) dx *= -1;
    if (random() < 0.12) dy *= -1;
  }
  if (random() < 0.16) dx = 0;
  if (random() < 0.16) dy = 0;
  const diagonal = dx !== 0 && dy !== 0;
  const magnitude = diagonal ? 90 : 127;
  const buttonRoll = random();
  const buttons = buttonRoll < 0.055
    ? 1
    : buttonRoll < 0.11
      ? 2
      : buttonRoll < 0.125
        ? 3
        : 0;
  return {
    tick: match.tick,
    moveX: dx * magnitude,
    moveY: dy * magnitude,
    buttons,
  };
}

function projectWorld(snapshot) {
  const match = snapshot.match;
  return {
    tick: snapshot.tick,
    phase: match.phase,
    half: match.clock.matchHalf,
    score: { ...match.score.goals },
    ball: { ...match.ball.ball.position },
    owner: match.possession.owner,
    lastTouch: match.possession.lastTouch,
    selectedPlayerId: match.control.activePlayerId,
    selectedPosition: match.players.find(({ id }) => id === match.control.activePlayerId)?.position ?? null,
    rng: match.rng.state,
    restart: restartKind(match),
    events: snapshot.lastStep?.events.map(({ type }) => type) ?? [],
  };
}

function restartKind(match) {
  if (match.rules.boundary) {
    return `boundary:${match.rules.boundary.descriptor?.kind ?? match.rules.boundary.kind ?? "active"}`;
  }
  if (match.rules.foulRestart) {
    return `foul:${match.rules.foulRestart.descriptor?.kind ?? match.rules.foulRestart.kind ?? "active"}`;
  }
  if (match.kickoff.restartKind) return `kickoff:${match.kickoff.restartKind}`;
  return null;
}

function assertStateInvariants(snapshot) {
  const match = snapshot.match;
  const playerNumbers = new Set(match.players.map(({ nativePlayerNumber }) => nativePlayerNumber));
  if (
    snapshot.tick !== match.tick
    || match.ball.ball.tick !== match.tick
    || match.players.length !== 22
    || playerNumbers.size !== 22
    || (match.possession.owner !== 0 && !playerNumbers.has(match.possession.owner))
    || !Number.isSafeInteger(match.score.goals.spain)
    || !Number.isSafeInteger(match.score.goals.argentina)
  ) {
    throw new Error(`Free-play soak invariant failed at tick ${snapshot.tick}.`);
  }
}

function assertFiniteState(value, path = "match") {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Non-finite soak state at ${path}.`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertFiniteState(value[index], `${path}[${index}]`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) assertFiniteState(child, `${path}.${key}`);
}

function assertSoakReport(report) {
  const requiredPhases = [
    "first-half-live-clock",
    "halftime-whistle",
    "halftime-transition",
    "halftime-end-swap-second-half-kickoff",
    "second-half-live-clock",
    "full-time-terminal",
  ];
  if (
    report.status !== "pass"
    || report.runs.length < 3
    || report.runs.some((run) => (
      run.terminal !== true
      || run.terminalPhase !== "full-time-terminal"
      || run.pauses.length !== 2
      || run.pauses.some(({ stableIdentity, stableBytes }) => !stableIdentity || !stableBytes)
      || run.finiteChecks < 100
      || !requiredPhases.every((phase) => run.clockPhases.includes(phase))
    ))
    || report.determinism.exact !== true
    || report.agency.distinctCommandCount !== 3
    || report.agency.distinctWorldEventCount < 3
  ) {
    throw new Error(`Full Match Alpha soak acceptance failed: ${JSON.stringify(report)}`);
  }
  return report;
}

async function loadPreparedFixture() {
  const root = join(CSSOCCER_REPO_ROOT, "build/generated/public/cssoccer");
  const [facts, scene] = await Promise.all([
    readFile(join(root, "facts/spain-argentina-full-match.json"), "utf8"),
    readFile(join(root, "scenes/spain-argentina-full-match.json"), "utf8"),
  ]);
  return { preparedFacts: JSON.parse(facts), preparedScene: JSON.parse(scene) };
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 0x1_0000_0000;
  };
}

function parseArgs(args) {
  const options = { check: false, country: "argentina", help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--country") options.country = args[++index];
    else throw new Error(`Unknown free-play soak option ${arg}.`);
  }
  if (!options.help && options.check !== true) {
    throw new Error("--check is required for release acceptance.");
  }
  if (!options.help && !["spain", "argentina"].includes(options.country)) {
    throw new Error("--country must be spain or argentina.");
  }
  return options;
}

function printHelp() {
  console.log("Usage: node tools/run-free-play-soak.mjs --check [--country <spain|argentina>]");
}

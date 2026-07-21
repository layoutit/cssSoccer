#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { cp, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parityContractSha256 } from "../src/parity/io.mjs";

const execute = promisify(execFile);
const repoRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const contract = JSON.parse(await readFile(join(repoRoot, "references", "actua-soccer-oracle.json"), "utf8"));
const fixtureContractPath = join(repoRoot, "references", "spain-argentina-match.json");
const fixtureContractBytes = await readFile(fixtureContractPath);
const fixtureContract = JSON.parse(fixtureContractBytes.toString("utf8"));
const sourceRoot = join(repoRoot, contract.checkout);
const command = process.argv[2] ?? "help";
const frameSequenceTool = process.env.FRAME_SEQUENCE_ORACLE_TOOL
  ?? join(homedir(), ".codex", "skills", "frame-sequence-oracle", "scripts", "frame-sequence.mjs");
const rawFlags = Object.freeze({
  active: 0x01,
  frame: 0x02,
  phaseChanged: 0x04,
  kickoff: 0x08,
  terminal: 0x10,
  setPieceInput: 0x20
});
const nativeOffsets = Object.freeze({
  userList: 0x3955c,
  euroTeamA: 0x395b6,
  euroTeamB: 0x395b7,
  substitutes: 0x3989a,
  teams: 0x3cf6c,
  matchTime: 0x3e0e0,
  kickOff: 0x3e313,
  stopClock: 0x3e336,
  logicCount: 0x3e350,
  spinBall: 0x3e364,
  ballInGoal: 0x3e3a0,
  ballInHands: 0x3e3a1,
  gameAction: 0x3e3a2,
  teamAGoals: 0x3e3a8,
  teamBGoals: 0x3e3ac,
  justScored: 0x3e3b4,
  goalScorer: 0x3e3bc,
  ballSpeed: 0x3e404,
  ballInAir: 0x3e420,
  ballPossession: 0x3e430,
  ballStill: 0x3e438,
  lastTouch: 0x3e43c,
  ballOutOfPlay: 0x3e484,
  penaltyGame: 0x3e540,
  directFreeKick: 0x3e58c,
  setPiece: 0x3e58e,
  offsideNow: 0x3e64c,
  kickoff: 0x3e744,
  endGame: 0x3e745,
  teamA: 0x3e746,
  teamB: 0x3e747,
  injuryTime: 0x3e74a,
  matchHalf: 0x3e74d,
  lineUp: 0x3e754,
  playerBeingSubbed: 0x3e756,
  playerOnOff: 0x3e758,
  playerComingOn: 0x3e75a,
  timeFactor: 0x3e808,
  clockRunning: 0x3e80c,
  rollingClock: 0x3e810,
  randSeed: 0x3e816,
  seed: 0x3e818,
  ballXDisplacement: 0x3e82c,
  ballYDisplacement: 0x3e830,
  ballZDisplacement: 0x3e834,
  ballX: 0x3e838,
  ballY: 0x3e83c,
  ballZ: 0x3e840,
  ballZSpin: 0x3e894,
  ballXYSpin: 0x3e898,
  matchMode: 0x3e8e0,
  deadBallCount: 0x3e8e4,
  offsideOn: 0x3edaa,
  matchFactorFixed: 0x3edc0,
  watch: 0x3edc2,
  teamAOn: 0x3edcd,
  teamBOn: 0x3edce,
  cameraDistance: 0xdb14,
  inGame: 0xdb18,
  cameraMode: 0xdb1a,
  cameraFixed: 0x45d5c,
  cameraTargetX: 0x48f20,
  cameraTargetY: 0x48f24,
  cameraTargetZ: 0x48f28,
  cameraX: 0x48f2c,
  cameraY: 0x48f30,
  cameraZ: 0x48f34,
  subPending: 0x54c80
});

if (command === "setup") {
  console.log(JSON.stringify(await setup(), null, 2));
} else if (command === "verify") {
  console.log(JSON.stringify(await verify(), null, 2));
} else if (command === "verify-runner") {
  console.log(JSON.stringify(await verifyRunner(), null, 2));
} else if (command === "verify-fixture") {
  console.log(JSON.stringify(await verifyFixture(parseFixtureRequest(process.argv.slice(3))), null, 2));
} else if (command === "capture-full-match") {
  console.log(JSON.stringify(await captureFullMatch(), null, 2));
} else if (command === "verify-native-raw") {
  console.log(JSON.stringify(await verifyNativeRaw(process.argv[3]), null, 2));
} else {
  console.log("Usage: node tools/actua-soccer-oracle.mjs <setup|verify|verify-runner|verify-fixture|capture-full-match|verify-native-raw [path]>");
}

async function setup() {
  if (!existsSync(join(sourceRoot, ".git"))) {
    await mkdir(dirname(sourceRoot), { recursive: true });
    await run("git", ["clone", contract.repository, sourceRoot], repoRoot);
  }
  await run("git", ["fetch", "--quiet", "origin", contract.revision], sourceRoot);
  const head = await revision();
  const worktreeMissing = contract.requiredFiles.some((path) => !existsSync(join(sourceRoot, path)));
  if (head === contract.revision && worktreeMissing) {
    await run("git", ["read-tree", "HEAD"], sourceRoot);
    await run("git", ["checkout-index", "--all"], sourceRoot);
  }
  if (head !== contract.revision) {
    const status = (await run("git", ["status", "--short"], sourceRoot)).stdout.trim();
    if (status) throw new Error("Actua Soccer oracle checkout is dirty at the wrong revision; refusing to replace local work.");
    await run("git", ["checkout", "--detach", contract.revision], sourceRoot);
  }
  return verify();
}

async function verify() {
  if (!existsSync(join(sourceRoot, ".git"))) {
    throw new Error("Actua Soccer oracle source is missing. Run pnpm source:setup.");
  }
  const head = await revision();
  if (head !== contract.revision) {
    throw new Error(`Actua Soccer oracle revision mismatch: expected ${contract.revision}, got ${head}.`);
  }
  const missing = contract.requiredFiles.filter((path) => !existsSync(join(sourceRoot, path)));
  if (missing.length) throw new Error("Actua Soccer oracle checkout is incomplete: " + missing.join(", "));
  const origin = (await run("git", ["remote", "get-url", "origin"], sourceRoot)).stdout.trim();
  return {
    schema: "cssoccer-actua-soccer-oracle-verification@1",
    status: "pass",
    sourceRoot,
    origin,
    revision: head,
    requiredFiles: contract.requiredFiles.length,
    dirty: Boolean((await run("git", ["status", "--short"], sourceRoot)).stdout.trim())
  };
}

async function verifyRunner() {
  const source = await verify();
  const runner = contract.runner;
  if (!runner) throw new Error("Actua Soccer oracle runner contract is missing.");

  const sourceHashes = {};
  for (const [path, expected] of Object.entries(runner.sourceArtifacts)) {
    const absolute = join(sourceRoot, path);
    const actual = await sha256File(absolute);
    if (actual !== expected) {
      throw new Error(`Oracle source artifact hash mismatch for ${path}: expected ${expected}, got ${actual}.`);
    }
    sourceHashes[path] = actual;
  }

  const toolHashes = {};
  for (const [name, tool] of Object.entries(runner.tools)) {
    const absolute = join(repoRoot, tool.path);
    const actual = await sha256File(absolute);
    if (actual !== tool.sha256) {
      throw new Error(`Pinned tool hash mismatch for ${name}: expected ${tool.sha256}, got ${actual}.`);
    }
    toolHashes[name] = {
      version: tool.version,
      path: tool.path,
      sha256: actual,
      ...(tool.releaseArchiveSha256 ? { releaseArchiveSha256: tool.releaseArchiveSha256 } : {})
    };
  }

  const outputRoot = join(repoRoot, runner.outputRoot);
  const workRoot = join(outputRoot, "work");
  const dosRoot = join(workRoot, "EURO96");
  const gameRoot = join(dosRoot, "GAME");
  const scriptRoot = join(dosRoot, "SCRIPT");
  const captureRoot = join(workRoot, "capture");
  const homeRoot = join(workRoot, "home");
  await rm(workRoot, { recursive: true, force: true });
  await Promise.all([
    mkdir(scriptRoot, { recursive: true }),
    mkdir(captureRoot, { recursive: true }),
    mkdir(homeRoot, { recursive: true })
  ]);
  await cp(sourceRoot, gameRoot, {
    recursive: true,
    filter: (path) => path !== join(sourceRoot, ".git")
  });
  await cp(join(sourceRoot, "SCRIPT.96"), join(scriptRoot, "SCRIPT.96"));

  const executablePath = join(gameRoot, "TEST.EXE");
  const executable = await readFile(executablePath);
  const appliedPatches = [];
  for (const patch of runner.patches) {
    const expected = Buffer.from(patch.expected, "hex");
    const replacement = Buffer.from(patch.replacement, "hex");
    if (expected.length !== replacement.length) {
      throw new Error(`Oracle patch ${patch.name} changes executable length.`);
    }
    const actual = executable.subarray(patch.offset, patch.offset + expected.length);
    if (!actual.equals(expected)) {
      throw new Error(
        `Oracle patch ${patch.name} preimage mismatch at ${patch.offset}: expected ${patch.expected}, got ${actual.toString("hex")}.`
      );
    }
    replacement.copy(executable, patch.offset);
    appliedPatches.push({ name: patch.name, offset: patch.offset, bytes: replacement.length });
  }
  await writeFile(executablePath, executable);
  const patchedExecutableSha256 = sha256(executable);
  if (patchedExecutableSha256 !== runner.patchedExecutableSha256) {
    throw new Error(
      `Patched oracle executable hash mismatch: expected ${runner.patchedExecutableSha256}, got ${patchedExecutableSha256}.`
    );
  }

  const dosbox = join(repoRoot, runner.tools.dosboxX.path);
  const launch = runner.launch;
  const launchArguments = [
    "-defaultconf",
    "-defaultmapper",
    "-silent",
    "-nogui",
    "-nomenu",
    "-fastlaunch",
    "-set",
    `dosbox quit warning=${launch.dos.quitWarning}`,
    "-set",
    `dos mcb corruption becomes application free memory=${launch.dos.repairMcbCorruption}`,
    "-set",
    `dos minimum mcb segment=${launch.dos.minimumMcbSegment}`,
    "-set",
    `cpu core=${launch.cpuCore}`,
    "-set",
    `cpu cycles=${launch.cpuCycles}`,
    "-set",
    `dosbox captures=${captureRoot}`,
    "-c",
    `mount c \"${dosRoot}\"`,
    "-c",
    "c:",
    "-c",
    "cd GAME",
    "-c",
    `DX-CAPTURE /V /-D TEST.EXE ${launch.arguments.join(" ")} > BOOT.LOG`,
    "-c",
    "exit"
  ];
  const startedAt = Date.now();
  const processResult = await runOutcome(dosbox, launchArguments, repoRoot, {
    ...process.env,
    HOME: homeRoot,
    SDL_VIDEODRIVER: "dummy",
    SDL_AUDIODRIVER: "dummy"
  }, launch.watchdogSeconds * 1000);
  const wallMilliseconds = Date.now() - startedAt;
  if (processResult.timedOut) {
    throw new Error(`Pinned DOSBox-X runner exceeded its ${launch.watchdogSeconds}-second failure watchdog.`);
  }
  const actualExitCode = processResult.exitCode;
  if (!launch.expectedExitCodes.includes(actualExitCode)) {
    throw new Error(
      `Pinned DOSBox-X runner exit mismatch: expected ${launch.expectedExitCodes.join(" or ")}, got ${
        actualExitCode ?? processResult.signal ?? "unknown"
      }.\n${processResult.stderr || processResult.stdout}`
    );
  }
  if (processResult.signal) {
    throw new Error(`Pinned DOSBox-X runner terminated by ${processResult.signal}; a graceful exit is required.`);
  }
  if (wallMilliseconds > launch.expectedMaxRuntimeSeconds * 1000) {
    throw new Error(
      `Pinned DOSBox-X runner took ${wallMilliseconds}ms; expected at most ${launch.expectedMaxRuntimeSeconds * 1000}ms.`
    );
  }
  const fatalHostMarkers = ["DOS fatal memory error", "Corrupt MCB chain", "libc++abi: terminating"];
  const fatalHostMarker = fatalHostMarkers.find(
    (marker) => processResult.stderr.includes(marker) || processResult.stdout.includes(marker)
  );
  if (fatalHostMarker) {
    throw new Error(`Pinned DOSBox-X runner emitted fatal host marker: ${fatalHostMarker}.`);
  }

  const bootLogPath = join(gameRoot, "BOOT.LOG");
  const bootLog = await readFile(bootLogPath);
  const bootText = bootLog.toString("latin1");
  const missingMarkers = launch.bootMarkers.filter((marker) => !bootText.includes(marker));
  if (missingMarkers.length) {
    throw new Error(`Native match boot log is missing markers: ${missingMarkers.join(", ")}.`);
  }
  if (bootText.includes("DOS/4GW fatal error")) {
    throw new Error("Native match failed inside DOS/4GW before its normal exit.");
  }

  const videos = [];
  for (const entry of await readdir(captureRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".avi")) continue;
    const path = join(captureRoot, entry.name);
    videos.push({ path, size: (await stat(path)).size });
  }
  videos.sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
  const matchVideo = videos[0];
  if (!matchVideo || matchVideo.size < launch.capture.minimumBytes) {
    throw new Error(
      `Native match video is missing or too small: expected at least ${launch.capture.minimumBytes} bytes.`
    );
  }

  const ffprobe = join(repoRoot, runner.tools.ffprobe.path);
  const probeResult = await run(ffprobe, [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    matchVideo.path
  ], repoRoot);
  const probe = JSON.parse(probeResult.stdout);
  const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
  if (
    videoStream?.width !== launch.capture.width ||
    videoStream?.height !== launch.capture.height
  ) {
    throw new Error(
      `Native match video dimensions mismatch: expected ${launch.capture.width}x${launch.capture.height}, got ${
        videoStream ? `${videoStream.width}x${videoStream.height}` : "no video stream"
      }.`
    );
  }

  const proofFramePath = join(captureRoot, "match-proof.png");
  const ffmpeg = join(repoRoot, runner.tools.ffmpeg.path);
  await run(ffmpeg, [
    "-y",
    "-loglevel",
    "error",
    "-err_detect",
    "ignore_err",
    "-i",
    matchVideo.path,
    "-vf",
    `select=eq(n\\,${launch.capture.proofFrameIndex})`,
    "-frames:v",
    "1",
    proofFramePath
  ], repoRoot);
  const proofFrameStat = await stat(proofFramePath);
  if (proofFrameStat.size < 10_000) {
    throw new Error(`Native match proof frame is unexpectedly small: ${proofFrameStat.size} bytes.`);
  }

  const report = {
    schema: "cssoccer-actua-soccer-runner-verification@1",
    status: "pass",
    verifiedAt: new Date().toISOString(),
    source: {
      repository: source.origin,
      revision: source.revision,
      dirty: source.dirty,
      hashes: sourceHashes
    },
    tools: toolHashes,
    patch: {
      applied: appliedPatches,
      patchedExecutableSha256
    },
    invocation: {
      executable: runner.tools.dosboxX.path,
      arguments: launchArguments,
      environment: {
        HOME: relative(repoRoot, homeRoot),
        SDL_VIDEODRIVER: "dummy",
        SDL_AUDIODRIVER: "dummy"
      },
      networkAccess: "not-used",
      visibleWindow: false
    },
    exit: {
      expectedCodes: launch.expectedExitCodes,
      actualCode: actualExitCode,
      signal: processResult.signal,
      gracefulProgramExit: true,
      wallMilliseconds,
      expectedMaxRuntimeSeconds: launch.expectedMaxRuntimeSeconds,
      failureWatchdogSeconds: launch.watchdogSeconds,
      behavior: "The patched rolling-demo match returns through the native frontend cleanup and DOSBox-X exits normally.",
      stderrSha256: sha256(Buffer.from(processResult.stderr))
    },
    matchBoot: {
      markers: launch.bootMarkers,
      bootLog: await fileEvidence(bootLogPath),
      matchVideo: {
        ...(await fileEvidence(matchVideo.path)),
        width: videoStream.width,
        height: videoStream.height,
        codec: videoStream.codec_name ?? null,
        frameRate: videoStream.avg_frame_rate ?? null
      },
      proofFrame: {
        ...(await fileEvidence(proofFramePath)),
        frameIndex: launch.capture.proofFrameIndex
      }
    }
  };
  const reportPath = join(outputRoot, "current.json");
  await writeJsonAtomic(reportPath, report);
  return { ...report, report: relative(repoRoot, reportPath) };
}

async function verifyFixture(request) {
  const normalizedRequest = validateFixtureRequest(request);
  const source = await verify();
  const runner = contract.runner;
  const fixture = fixtureContract.fixture;
  const oracle = fixtureContract.oracle;

  if (fixtureContract.schema !== "cssoccer-native-fixture-contract@1") {
    throw new Error("Unsupported Spain-Argentina native fixture contract schema.");
  }
  if (fixtureContract.source.revision !== source.revision) {
    throw new Error(
      `Native fixture source revision mismatch: expected ${fixtureContract.source.revision}, got ${source.revision}.`
    );
  }
  const runnerPatchSetSha256 = sha256(Buffer.from(canonicalJson(runner.patches)));
  requireHash("quick runner patch set", runnerPatchSetSha256, oracle.quickRunnerPatchSetSha256);

  const sourceHashes = {};
  for (const path of [fixtureContract.source.executable, fixtureContract.source.teamRecordSource, fixtureContract.source.script]) {
    const actual = await sha256File(join(sourceRoot, path));
    const expected = runner.sourceArtifacts[path];
    requireHash(`source artifact ${path}`, actual, expected);
    sourceHashes[path] = actual;
  }

  const sourceExecutable = await readFile(join(sourceRoot, fixtureContract.source.executable));
  const sourceTeamRecords = await readFile(join(sourceRoot, fixtureContract.source.teamRecordSource));
  const sourceScript = await readFile(join(sourceRoot, fixtureContract.source.script), "latin1");
  const teams = {
    spain: readAndVerifyTeamRecord(sourceTeamRecords, fixture.home),
    argentina: readAndVerifyTeamRecord(sourceTeamRecords, fixture.away)
  };
  if (teams.spain.starters.length + teams.argentina.starters.length !== 22) {
    throw new Error("Native fixture must resolve exactly 22 starters.");
  }

  requireHash("rules", hashCanonical(fixture.rules), fixture.rulesSha256);
  requireHash("timing", hashCanonical(fixture.timing), fixture.timingSha256);
  requireHash("seed", hashCanonical(fixture.seed), fixture.seedSha256);

  const testCommandScenario = createNativeTestCommandScenario(oracle.testCommandScenario);
  requireHash(
    "test command scenario",
    sha256(testCommandScenario),
    oracle.testCommandScenario.sha256,
  );
  if (testCommandScenario.length !== oracle.testCommandScenario.bytes) {
    throw new Error(
      `Test command scenario byte mismatch: expected ${oracle.testCommandScenario.bytes}, got ${testCommandScenario.length}.`,
    );
  }

  const rejectionTests = verifyFixtureRejections();
  const outputRoot = join(repoRoot, oracle.outputRoot);
  const workRoot = join(outputRoot, "work");
  await rm(workRoot, { recursive: true, force: true });
  await mkdir(workRoot, { recursive: true });
  const commandScenarioPath = join(outputRoot, "command-scenario.jsonl");
  await writeFileAtomic(commandScenarioPath, testCommandScenario);

  const orderedProfileKeys = [fixture.canonicalProfile, fixture.ownershipSymmetryProfile];
  if (new Set(orderedProfileKeys).size !== 2 || orderedProfileKeys.some((key) => !oracle.profiles[key])) {
    throw new Error("Fixture contract must name distinct canonical and ownership-symmetry profiles.");
  }
  const stages = await Promise.all(
    orderedProfileKeys.map((profileKey) => prepareFixtureProfile({
      profileKey,
      profile: oracle.profiles[profileKey],
      sourceExecutable,
      sourceTeamRecords,
      sourceScript,
      workRoot
    }))
  );
  const startedAt = Date.now();
  const profileRuns = oracle.launch.parallelProfiles
    ? await Promise.all(stages.map(runFixtureProfile))
    : await runFixtureProfilesSerially(stages);
  const verificationWallMilliseconds = Date.now() - startedAt;

  const scenarioBinding = {
    schema: "cssoccer-native-scenario-binding@1",
    fixtureId: fixtureContract.id,
    homeTeamId: fixture.home.sourceTeamId,
    awayTeamId: fixture.away.sourceTeamId,
    controlCountries: fixture.controlCountries,
    users: fixture.users,
    autoPlayer: fixture.autoPlayer,
    rulesSha256: fixture.rulesSha256,
    timingSha256: fixture.timingSha256,
    seedSha256: fixture.seedSha256,
    commandScenarioSha256: oracle.testCommandScenario.sha256
  };
  const scenarioSha256 = hashCanonical(scenarioBinding);
  const fixtureContractSha256 = sha256(fixtureContractBytes);
  const oraclePatchSha256 = hashCanonical({
    runnerPatches: runner.patches,
    transfers: [fixture.home, fixture.away].map(({ country, sourceOffset, runtimeOffset }) => ({
      country,
      sourceOffset,
      runtimeOffset,
      bytes: fixtureContract.teamRecordLayout.bytes
    })),
    commonPatches: oracle.commonPatches,
    profiles: oracle.profiles,
    scriptReplacements: oracle.scriptReplacements,
    scriptTeamData: oracle.scriptTeamData
  });
  const nativeDataSetSha256 = hashCanonical({
    sourceRevision: source.revision,
    sourceHashes,
    teams: {
      spain: teams.spain.hashes,
      argentina: teams.argentina.hashes
    }
  });

  const profiles = {};
  for (const run of profileRuns) {
    const profileBinding = {
      schema: "cssoccer-native-profile@1",
      fixtureId: fixtureContract.id,
      profileKey: run.profileKey,
      country: run.country,
      teamSlot: run.teamSlot,
      teamUsersMask: run.teamUsersMask,
      users: fixture.users,
      autoPlayer: fixture.autoPlayer,
      executableSha256: run.executableSha256,
      scriptSha256: run.scriptSha256,
      scenarioSha256,
      commandScenarioSha256: oracle.testCommandScenario.sha256,
      controlledTeamSha256: teams[run.country].hashes.teamSha256,
      controlledRosterSha256: teams[run.country].hashes.rosterSha256,
      controlledTacticsSha256: teams[run.country].hashes.tacticsSha256,
      controlledKitSha256: teams[run.country].kitSha256
    };
    profiles[run.profileKey] = {
      schema: profileBinding.schema,
      status: "pass",
      country: run.country,
      teamSlot: run.teamSlot,
      teamUsersMask: run.teamUsersMask,
      playerSelection: "AUTOPLAYER",
      playerSelectionValue: fixture.autoPlayer,
      profileSha256: hashCanonical(profileBinding),
      executable: {
        path: relative(repoRoot, run.executablePath),
        sha256: run.executableSha256
      },
      script: {
        path: relative(repoRoot, run.scriptPath),
        sha256: run.scriptSha256
      },
      bootLog: await fileEvidence(run.bootLogPath),
      exit: run.exit,
      nativeEvidence: run.nativeEvidence,
      hashes: {
        fixtureContractSha256,
        scenarioSha256,
        commandScenarioSha256: oracle.testCommandScenario.sha256,
        teamSha256: teams[run.country].hashes.teamSha256,
        rosterSha256: teams[run.country].hashes.rosterSha256,
        tacticsSha256: teams[run.country].hashes.tacticsSha256,
        kitSha256: teams[run.country].kitSha256
      }
    };
  }

  const report = {
    schema: "cssoccer-native-fixture-verification@1",
    status: "pass",
    verifiedAt: new Date().toISOString(),
    fixture: {
      id: fixtureContract.id,
      home: { country: fixture.home.country, label: fixture.home.label, sourceTeamId: fixture.home.sourceTeamId },
      away: { country: fixture.away.country, label: fixture.away.label, sourceTeamId: fixture.away.sourceTeamId },
      allowedControlCountries: fixture.controlCountries,
      canonicalProfile: fixture.canonicalProfile,
      ownershipSymmetryProfile: fixture.ownershipSymmetryProfile,
      users: fixture.users,
      playerSelection: "AUTOPLAYER",
      playerSelectionValue: fixture.autoPlayer,
      starters: [...teams.spain.starters, ...teams.argentina.starters],
      starterCount: teams.spain.starters.length + teams.argentina.starters.length
    },
    teams,
    rules: { ...fixture.rules, sha256: fixture.rulesSha256 },
    timing: { ...fixture.timing, sha256: fixture.timingSha256 },
    seed: { ...fixture.seed, sha256: fixture.seedSha256 },
    testCommandScenario: {
      ...oracle.testCommandScenario,
      path: relative(repoRoot, commandScenarioPath)
    },
    request: normalizedRequest,
    profiles,
    rejectionTests,
    bindings: {
      fixtureContractSha256,
      oraclePatchSha256,
      nativeDataSetSha256,
      scenarioSha256,
      commandScenarioSha256: oracle.testCommandScenario.sha256,
      runnerPatchSetSha256
    },
    execution: {
      parallelProfiles: oracle.launch.parallelProfiles,
      verificationWallMilliseconds,
      networkAccess: "not-used",
      visibleWindow: false
    },
    source: {
      repository: source.origin,
      revision: source.revision,
      hashes: sourceHashes
    }
  };
  const reportPath = join(outputRoot, "current.json");
  await writeJsonAtomic(reportPath, report);
  return { ...report, report: relative(repoRoot, reportPath) };
}

async function prepareFixtureProfile({
  profileKey,
  profile,
  sourceExecutable,
  sourceTeamRecords,
  sourceScript,
  workRoot,
  runnerPatches = contract.runner.patches,
  executablePatches = [],
  expectedExecutableSha256 = profile.expectedExecutableSha256
}) {
  const profileRoot = join(workRoot, profileKey);
  const dosRoot = join(profileRoot, "EURO96");
  const gameRoot = join(dosRoot, "GAME");
  const scriptRoot = join(dosRoot, "SCRIPT");
  const homeRoot = join(profileRoot, "home");
  await Promise.all([
    cp(sourceRoot, gameRoot, {
      recursive: true,
      filter: (path) => path !== join(sourceRoot, ".git")
    }),
    mkdir(scriptRoot, { recursive: true }),
    mkdir(homeRoot, { recursive: true })
  ]);

  const executable = Buffer.from(sourceExecutable);
  const appliedPatches = [];
  for (const patch of runnerPatches) applyExecutablePatch(executable, patch, appliedPatches);
  for (const team of [fixtureContract.fixture.home, fixtureContract.fixture.away]) {
    const bytes = fixtureContract.teamRecordLayout.bytes;
    const record = sourceTeamRecords.subarray(team.sourceOffset, team.sourceOffset + bytes);
    record.copy(executable, team.runtimeOffset);
  }
  for (const patch of fixtureContract.oracle.commonPatches) {
    applyExecutablePatch(executable, patch, appliedPatches);
  }
  for (const patch of profile.patches) applyExecutablePatch(executable, patch, appliedPatches);
  for (const patch of executablePatches) applyExecutablePatch(executable, patch, appliedPatches);
  const executableSha256 = sha256(executable);
  requireHash(`${profileKey} executable`, executableSha256, expectedExecutableSha256);

  let script = sourceScript;
  for (const replacement of fixtureContract.oracle.scriptReplacements) {
    script = replaceExactlyOnce(script, replacement.before, replacement.after);
  }
  const { sha256: scriptTeamDataSha256, ...scriptTeamDataBinding } =
    fixtureContract.oracle.scriptTeamData;
  requireHash(
    "source-backed SCRIPT.96 team data binding",
    hashCanonical(scriptTeamDataBinding),
    scriptTeamDataSha256,
  );
  script = applySourceBackedScriptTeamData(script, sourceTeamRecords, scriptTeamDataBinding);
  const scriptBytes = Buffer.from(script, "latin1");
  const scriptSha256 = sha256(scriptBytes);
  requireHash(`${profileKey} script`, scriptSha256, fixtureContract.oracle.expectedScriptSha256);

  const executablePath = join(gameRoot, fixtureContract.source.executable);
  const gameScriptPath = join(gameRoot, fixtureContract.source.script);
  const scriptPath = join(scriptRoot, fixtureContract.source.script);
  await Promise.all([
    writeFile(executablePath, executable),
    writeFile(gameScriptPath, scriptBytes),
    writeFile(scriptPath, scriptBytes)
  ]);
  const loggedHomePlayers = readAndVerifyTeamRecord(
    sourceTeamRecords,
    fixtureContract.fixture.home,
  ).roster.slice(0, 20).map((player, index) => ({
    player: index,
    sourceRosterIndex: index,
    ...player.attributes,
    fitness: scriptTeamDataBinding.fitness,
  }));
  return {
    profileKey,
    country: profile.country,
    teamSlot: profile.teamSlot,
    teamUsersMask: profile.teamUsersMask,
    profileRoot,
    dosRoot,
    gameRoot,
    homeRoot,
    executablePath,
    executableSha256,
    scriptPath,
    scriptSha256,
    loggedHomePlayers,
    appliedPatches
  };
}

function applySourceBackedScriptTeamData(script, sourceTeamRecords, binding) {
  if (binding.schema !== "cssoccer-oracle-script-team-data@1") {
    throw new Error("Source-backed SCRIPT.96 team data binding is unsupported.");
  }
  if (!Number.isInteger(binding.fitness) || binding.fitness < 0 || binding.fitness > 100) {
    throw new Error("Source-backed SCRIPT.96 fitness must be an integer from 0 through 100.");
  }
  if (binding.nativeAttributeNormalization !== "trunc(sourceValue * 128 / 100)") {
    throw new Error("Source-backed SCRIPT.96 native attribute normalization is unsupported.");
  }
  const fixtureTeams = Object.fromEntries([
    fixtureContract.fixture.home,
    fixtureContract.fixture.away,
  ].map((team) => [team.country, readAndVerifyTeamRecord(sourceTeamRecords, team)]));
  if (!Array.isArray(binding.teams) || binding.teams.length !== 2) {
    throw new Error("Source-backed SCRIPT.96 binding must contain exactly two teams.");
  }
  const lines = script.split("\n");
  const seenHeaders = new Set();
  for (const descriptor of binding.teams) {
    const team = fixtureTeams[descriptor.country];
    if (!team) throw new Error(`SCRIPT.96 team binding has unknown country ${descriptor.country}.`);
    const expectedTeamIndex = descriptor.country === fixtureContract.fixture.home.country ? 0 : 1;
    if (descriptor.targetTeamIndex !== expectedTeamIndex) {
      throw new Error(`${descriptor.country} SCRIPT.96 target team index must be ${expectedTeamIndex}.`);
    }
    if (
      !Number.isInteger(descriptor.playerCount)
      || descriptor.playerCount !== 20
      || descriptor.playerCount > team.roster.length
    ) {
      throw new Error(`${descriptor.country} SCRIPT.96 binding must select exactly 20 source players.`);
    }
    if (!/^[A-Z]{3}$/u.test(descriptor.shortNamePrefix ?? "")) {
      throw new Error(`${descriptor.country} SCRIPT.96 short-name prefix must contain three A-Z letters.`);
    }
    const header = `> ${descriptor.targetHeader}`;
    const headerMatches = lines.flatMap((line, index) => (
      line.trim() === header ? [index] : []
    ));
    const candidateBlocks = headerMatches.map((headerIndex) => {
      const playerLines = [];
      for (let index = headerIndex + 1; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (trimmed.startsWith(">")) break;
        if (trimmed.startsWith("t:")) playerLines.push(index);
      }
      return playerLines;
    }).filter((playerLines) => playerLines.length === descriptor.playerCount);
    if (candidateBlocks.length !== 1 || seenHeaders.has(header)) {
      throw new Error(
        `${descriptor.country} SCRIPT.96 donor block with ${descriptor.playerCount} player rows must resolve exactly once.`,
      );
    }
    seenHeaders.add(header);
    const [playerLines] = candidateBlocks;
    for (let index = 0; index < descriptor.playerCount; index += 1) {
      const player = team.roster[index];
      const shortName = `${descriptor.shortNamePrefix}${String(index + 1).padStart(2, "0")}`;
      lines[playerLines[index]] = rewriteScriptPlayerLine(
        lines[playerLines[index]],
        player,
        binding.fitness,
        shortName,
      );
    }
  }
  return lines.join("\n");
}

function rewriteScriptPlayerLine(line, player, fitness, shortName) {
  let rewritten = replaceScriptToken(line, /(\bt:\s*")[^"]*(")/u, `$1${player.name}$2`, "name");
  rewritten = replaceScriptToken(rewritten, /(\bgoal:\s*)-?\d+/u, `$1${player.goalIndex}`, "goal");
  rewritten = replaceScriptToken(
    rewritten,
    /(\bposn:\s*)\S+/u,
    `$1${["GK", "DF", "MD", "FD"][player.position]}`,
    "position",
  );
  for (const [token, key] of [
    ["pace", "pace"],
    ["pow", "power"],
    ["cntl", "control"],
    ["flar", "flair"],
    ["visn", "vision"],
    ["acc", "accuracy"],
    ["stam", "stamina"],
    ["disc", "discipline"],
  ]) {
    rewritten = replaceScriptToken(
      rewritten,
      new RegExp(`(\\b${token}:\\s*)-?\\d+`, "u"),
      `$1${player.attributes[key]}`,
      token,
    );
  }
  rewritten = replaceScriptToken(rewritten, /(\bfit:\s*)-?\d+/u, `$1${fitness}`, "fitness");
  rewritten = replaceScriptToken(
    rewritten,
    /(\bname:\s*")[^"]*(")/u,
    `$1${shortName}$2`,
    "short name",
  );
  return rewritten;
}

function replaceScriptToken(line, pattern, replacement, label) {
  const matches = line.match(new RegExp(pattern.source, `${pattern.flags}g`));
  if (matches?.length !== 1) {
    throw new Error(`SCRIPT.96 player ${label} token must resolve exactly once.`);
  }
  return line.replace(pattern, replacement);
}

async function runFixtureProfile(stage) {
  const runner = contract.runner;
  const launch = runner.launch;
  const fixtureLaunch = fixtureContract.oracle.launch;
  const bootLogPath = join(stage.gameRoot, "FIXTURE.LOG");
  const dosbox = join(repoRoot, runner.tools.dosboxX.path);
  const launchArguments = [
    "-defaultconf",
    "-defaultmapper",
    "-silent",
    "-nogui",
    "-nomenu",
    "-fastlaunch",
    "-set",
    `dosbox quit warning=${launch.dos.quitWarning}`,
    "-set",
    `dos mcb corruption becomes application free memory=${launch.dos.repairMcbCorruption}`,
    "-set",
    `dos minimum mcb segment=${launch.dos.minimumMcbSegment}`,
    "-set",
    `cpu core=${launch.cpuCore}`,
    "-set",
    `cpu cycles=${launch.cpuCycles}`,
    "-c",
    `mount c "${stage.dosRoot}"`,
    "-c",
    "c:",
    "-c",
    "cd GAME",
    "-c",
    `${fixtureContract.source.executable} ${fixtureLaunch.arguments.join(" ")} > FIXTURE.LOG`,
    "-c",
    "exit"
  ];
  const startedAt = Date.now();
  const outcome = await runOutcome(dosbox, launchArguments, repoRoot, {
    ...process.env,
    HOME: stage.homeRoot,
    SDL_VIDEODRIVER: "dummy",
    SDL_AUDIODRIVER: "dummy"
  }, fixtureLaunch.watchdogSeconds * 1000);
  const wallMilliseconds = Date.now() - startedAt;
  if (outcome.timedOut) {
    throw new Error(`${stage.profileKey} exceeded its ${fixtureLaunch.watchdogSeconds}-second watchdog.`);
  }
  if (outcome.exitCode !== 0 || outcome.signal) {
    throw new Error(
      `${stage.profileKey} failed to exit cleanly: ${outcome.exitCode ?? outcome.signal ?? "unknown"}.\n${outcome.stderr}`
    );
  }
  if (wallMilliseconds > fixtureLaunch.expectedMaxRuntimeSeconds * 1000) {
    throw new Error(
      `${stage.profileKey} took ${wallMilliseconds}ms; expected at most ${fixtureLaunch.expectedMaxRuntimeSeconds * 1000}ms.`
    );
  }
  const hostText = `${outcome.stdout}\n${outcome.stderr}`;
  for (const marker of ["DOS fatal memory error", "Corrupt MCB chain", "libc++abi: terminating"]) {
    if (hostText.includes(marker)) throw new Error(`${stage.profileKey} emitted fatal host marker: ${marker}.`);
  }

  const bootText = await readFile(bootLogPath, "latin1");
  if (bootText.includes("DOS/4GW fatal error")) {
    throw new Error(`${stage.profileKey} failed inside DOS/4GW.`);
  }
  const selectedLabel = fixtureContract.fixture[stage.teamSlot === "A" ? "home" : "away"].label.toUpperCase();
  const requiredMarkers = [
    ...contract.runner.launch.bootMarkers,
    `User 0\t${selectedLabel}`,
    `Home Team:  ${fixtureContract.fixture.home.label.toUpperCase()}`,
    `Away Team:  ${fixtureContract.fixture.away.label.toUpperCase()}`,
    "Number Of Users Playing Next Match:  1",
    "User 0\tKEYBOARD ONE",
    "Bookings:\t\tON",
    "Freekicks:\t\tON"
  ];
  const missingMarkers = requiredMarkers.filter((marker) => !bootText.includes(marker));
  if (missingMarkers.length) {
    throw new Error(`${stage.profileKey} native log is missing markers: ${missingMarkers.join(", ")}.`);
  }
  if (/User [1-9][0-9]*\t/u.test(bootText)) {
    throw new Error(`${stage.profileKey} initialized more than the one allowed user.`);
  }
  const loggedHomePlayers = parseNativeFixturePlayerRows(bootText);
  requireValue(
    `${stage.profileKey} logged source-backed home players`,
    loggedHomePlayers,
    stage.loggedHomePlayers,
  );
  return {
    ...stage,
    bootLogPath,
    exit: {
      code: outcome.exitCode,
      signal: outcome.signal,
      gracefulProgramExit: true,
      wallMilliseconds,
      watchdogSeconds: fixtureLaunch.watchdogSeconds
    },
    nativeEvidence: {
      selectedCountry: stage.country,
      selectedTeamSlot: stage.teamSlot,
      selectedTeamUsersMask: stage.teamUsersMask,
      userCount: 1,
      playerSelection: "AUTOPLAYER",
      fixture: `${fixtureContract.fixture.home.label} vs ${fixtureContract.fixture.away.label}`,
      loggedSourceTeam: fixtureContract.fixture.home.country,
      loggedSourcePlayerRows: loggedHomePlayers.length,
      cleanFrontendReturn: true,
      cleanDosExit: true,
      markers: requiredMarkers
    }
  };
}

function parseNativeFixturePlayerRows(text) {
  const rows = [];
  const pattern = /plyr\s+(\d+)\s+\((\d+)\)\s+pace:\s*(-?\d+)\s+power:\s*(-?\d+)\s+cntrl:\s*(-?\d+)\s+flair:\s*(-?\d+)\s+vision:\s*(-?\d+)\s+accry:\s*(-?\d+)\s+stam:\s*(-?\d+)\s+disc:\s*(-?\d+)\s+fit:\s*(-?\d+)/gu;
  for (const match of text.matchAll(pattern)) {
    const values = match.slice(1).map(Number);
    rows.push({
      player: values[0],
      sourceRosterIndex: values[1],
      pace: values[2],
      power: values[3],
      control: values[4],
      flair: values[5],
      vision: values[6],
      accuracy: values[7],
      stamina: values[8],
      discipline: values[9],
      fitness: values[10],
    });
  }
  return rows;
}

async function runFixtureProfilesSerially(stages) {
  const results = [];
  for (const stage of stages) results.push(await runFixtureProfile(stage));
  return results;
}

async function captureFullMatch() {
  const source = await verify();
  const fixture = fixtureContract.fixture;
  const oracle = fixtureContract.oracle;
  const capture = oracle.capture;
  if (capture?.schema !== "cssoccer-native-capture-contract@1") {
    throw new Error("Native full-match capture contract is missing or unsupported.");
  }
  if (capture.canonicalRuns !== 2 || capture.canonicalProfile !== fixture.canonicalProfile) {
    throw new Error("Native capture must retain exactly two runs of the canonical fixture profile.");
  }
  if (capture.ownershipProfile !== fixture.ownershipSymmetryProfile) {
    throw new Error("Native capture ownership profile must match the fixture symmetry profile.");
  }

  const fullRunnerPatches = capture.fullRunnerPatches.map((name) => {
    const matches = contract.runner.patches.filter((patch) => patch.name === name);
    if (matches.length !== 1) throw new Error(`Full-match runner patch ${name} must resolve exactly once.`);
    return matches[0];
  });
  requireHash("full-match runner patch set", hashCanonical(fullRunnerPatches), capture.fullRunnerPatchSetSha256);
  requireHash("full-match executable patch set", hashCanonical(capture.executablePatches), capture.executablePatchSetSha256);
  const { sha256: inputAdapterSha256, ...inputAdapterBinding } = capture.inputAdapter;
  requireHash("native set-piece input adapter", hashCanonical(inputAdapterBinding), inputAdapterSha256);
  const transport = await verifyNativeCaptureTransport(capture);

  const sourceExecutable = await readFile(join(sourceRoot, fixtureContract.source.executable));
  const sourceTeamRecords = await readFile(join(sourceRoot, fixtureContract.source.teamRecordSource));
  const sourceScript = await readFile(join(sourceRoot, fixtureContract.source.script), "latin1");
  const sourceHashes = {};
  for (const path of [fixtureContract.source.executable, fixtureContract.source.teamRecordSource, fixtureContract.source.script]) {
    const actual = await sha256File(join(sourceRoot, path));
    requireHash(`source artifact ${path}`, actual, contract.runner.sourceArtifacts[path]);
    sourceHashes[path] = actual;
  }
  const teams = {
    spain: readAndVerifyTeamRecord(sourceTeamRecords, fixture.home),
    argentina: readAndVerifyTeamRecord(sourceTeamRecords, fixture.away)
  };
  requireHash("rules", hashCanonical(fixture.rules), fixture.rulesSha256);
  requireHash("timing", hashCanonical(fixture.timing), fixture.timingSha256);
  requireHash("seed", hashCanonical(fixture.seed), fixture.seedSha256);
  const testCommandScenario = createNativeTestCommandScenario(oracle.testCommandScenario);
  requireHash(
    "test command scenario",
    sha256(testCommandScenario),
    oracle.testCommandScenario.sha256,
  );

  const scenarioBinding = createNativeScenarioBinding();
  const scenarioSha256 = hashCanonical(scenarioBinding);
  const sourceSha256 = hashCanonical({
    schema: "cssoccer-native-source-set@1",
    revision: source.revision,
    artifacts: sourceHashes,
    sourceMapSha256: transport.sourceMapSha256,
    matchPlayerStructSha256: transport.matchPlayerStructSha256,
    userInfoStructSha256: transport.userInfoStructSha256,
    teams: {
      spain: teams.spain.hashes,
      argentina: teams.argentina.hashes
    }
  });
  const { definitions, fields, phases } = buildNativeFieldContract();
  const contractSha256 = parityContractSha256({ phases, fields });
  const profileKey = capture.canonicalProfile;
  const profile = oracle.profiles[profileKey];
  const profileBinding = createNativeCaptureProfileBinding({
    profileKey,
    profile,
    executableSha256: profile.expectedFullMatchExecutableSha256,
    scenarioSha256,
    sourceSha256,
    transport,
    runnerPatchSetSha256: capture.fullRunnerPatchSetSha256,
    executablePatchSetSha256: capture.executablePatchSetSha256,
    inputAdapterSha256
  });
  const profileSha256 = hashCanonical(profileBinding);
  const buildSha256 = hashCanonical({
    schema: "cssoccer-native-oracle-build@1",
    executableSha256: profile.expectedFullMatchExecutableSha256,
    scriptSha256: oracle.expectedScriptSha256,
    runnerPatchSetSha256: capture.fullRunnerPatchSetSha256,
    executablePatchSetSha256: capture.executablePatchSetSha256,
    inputAdapterSha256,
    transportBinarySha256: transport.binarySha256,
    transportSourcePatchSha256: transport.sourcePatchSha256
  });
  const bindings = {
    scenarioId: scenarioSha256.slice(0, 16),
    scenarioSha256,
    profileSha256,
    inputSha256: oracle.testCommandScenario.sha256,
    sourceSha256,
    buildSha256,
    contractSha256
  };
  const scenarioDescriptor = {
    schema: "cssoccer-native-scenario@1",
    binding: scenarioBinding,
    scenarioSha256,
    sourceRevision: source.revision,
    fixture: {
      home: { country: fixture.home.country, sourceTeamId: fixture.home.sourceTeamId },
      away: { country: fixture.away.country, sourceTeamId: fixture.away.sourceTeamId },
      users: fixture.users,
      autoPlayer: fixture.autoPlayer,
      rules: fixture.rules,
      timing: fixture.timing,
      seed: fixture.seed
    },
    testCommandScenario: {
      schema: oracle.testCommandScenario.schema,
      ticks: oracle.testCommandScenario.ticks,
      sha256: oracle.testCommandScenario.sha256
    }
  };
  const profileDescriptor = {
    schema: "cssoccer-native-capture-profile@1",
    binding: profileBinding,
    profileSha256,
    buildSha256,
    transport,
    inputAdapter: capture.inputAdapter,
    control: {
      country: profile.country,
      teamSlot: profile.teamSlot,
      teamUsersMask: profile.teamUsersMask,
      playerSelection: "AUTOPLAYER",
      playerSelectionValue: fixture.autoPlayer
    }
  };

  const outputRoot = join(repoRoot, capture.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const candidateRoot = join(outputRoot, `.capture-${process.pid}-${Date.now()}`);
  const workRoot = join(candidateRoot, "work");
  const runsRoot = join(candidateRoot, "runs");
  const generatedAt = new Date().toISOString();
  await Promise.all([mkdir(workRoot, { recursive: true }), mkdir(runsRoot, { recursive: true })]);

  try {
    const runNames = ["canonical-a", "canonical-b"];
    const stages = await Promise.all(runNames.map((runName) => prepareFixtureProfile({
      profileKey: `${profileKey}-${runName}`,
      profile,
      sourceExecutable,
      sourceTeamRecords,
      sourceScript,
      workRoot,
      runnerPatches: fullRunnerPatches,
      executablePatches: capture.executablePatches,
      expectedExecutableSha256: profile.expectedFullMatchExecutableSha256
    })));
    const launchedAt = Date.now();
    let nativeRuns;
    if (capture.launch.parallelCanonicalRuns) {
      const outcomes = await Promise.allSettled(stages.map((stage, index) => runNativeCapture({
        stage,
        runName: runNames[index],
        runRoot: join(runsRoot, runNames[index]),
        captureFrames: true,
        launch: capture.launch
      })));
      const failures = outcomes.filter((outcome) => outcome.status === "rejected");
      if (failures.length) throw failures[0].reason;
      nativeRuns = outcomes.map((outcome) => outcome.value);
    } else {
      nativeRuns = await runNativeCapturesSerially(stages, runNames, runsRoot, capture.launch);
    }
    const canonicalWallMilliseconds = Date.now() - launchedAt;

    const normalizationContext = {
      generatedAt,
      bindings,
      definitions,
      fields,
      phases,
      starters: [...teams.spain.starters, ...teams.argentina.starters],
      scenarioDescriptor,
      profileDescriptor
    };
    const normalizedRuns = [];
    for (const nativeRun of nativeRuns) {
      normalizedRuns.push(await normalizeCanonicalNativeCapture(nativeRun, normalizationContext));
    }

    const ownershipProfile = oracle.profiles[capture.ownershipProfile];
    const ownershipStage = await prepareFixtureProfile({
      profileKey: `${capture.ownershipProfile}-focused`,
      profile: ownershipProfile,
      sourceExecutable,
      sourceTeamRecords,
      sourceScript,
      workRoot
    });
    const ownershipRun = await runNativeCapture({
      stage: ownershipStage,
      runName: "spain-ownership",
      runRoot: join(runsRoot, "spain-ownership"),
      captureFrames: false,
      launch: oracle.launch
    });
    const ownership = await validateOwnershipSymmetry({
      canonicalRawPath: nativeRuns[0].rawPath,
      ownershipRawPath: ownershipRun.rawPath,
      scenarioSha256,
      timingSha256: fixture.timingSha256
    });
    await writeJsonAtomic(join(ownershipRun.runRoot, "ownership.json"), ownership);

    const identity = await compareCanonicalNativeCaptures(normalizedRuns);
    await rm(workRoot, { recursive: true, force: true });

    const retainedRoot = join(outputRoot, "retained");
    await rm(retainedRoot, { recursive: true, force: true });
    await rename(candidateRoot, retainedRoot);
    const frameEvidence = await publishNativeFrameEvidence(retainedRoot, normalizedRuns[0].frameCount);

    const finalRuns = {};
    for (const normalized of normalizedRuns) {
      const finalRunRoot = join(retainedRoot, "runs", normalized.runName);
      finalRuns[normalized.runName] = {
        status: "pass",
        ticks: normalized.ticks,
        terminalTick: normalized.terminalTick,
        frameCount: normalized.frameCount,
        exit: normalized.exit,
        artifacts: {
          raw: await fileEvidence(join(finalRunRoot, "native.raw")),
          state: await fileEvidence(join(finalRunRoot, "state.jsonl")),
          scenario: await fileEvidence(join(finalRunRoot, "scenario.json")),
          profile: await fileEvidence(join(finalRunRoot, "profile.json")),
          phaseMarkers: await fileEvidence(join(finalRunRoot, "phase-markers.json")),
          frames: await fileEvidence(join(finalRunRoot, "frames.json")),
          bootLog: await fileEvidence(join(finalRunRoot, "native.log"))
        },
        phaseSummary: normalized.phaseSummary
      };
    }
    const finalOwnershipRoot = join(retainedRoot, "runs", "spain-ownership");
    const report = {
      schema: "cssoccer-native-full-match-capture@1",
      status: "pass",
      verifiedAt: new Date().toISOString(),
      fixtureId: fixtureContract.id,
      bindings,
      source: {
        repository: source.origin,
        revision: source.revision,
        hashes: sourceHashes
      },
      transport,
      execution: {
        canonicalRuns: capture.canonicalRuns,
        parallelCanonicalRuns: capture.launch.parallelCanonicalRuns,
        canonicalWallMilliseconds,
        visibleWindow: false,
        networkAccess: "not-used"
      },
      canonical: {
        profile: profileKey,
        runs: finalRuns,
        exactIdentity: identity,
        frameEvidence
      },
      ownership: {
        ...ownership,
        artifacts: {
          raw: await fileEvidence(join(finalOwnershipRoot, "native.raw")),
          report: await fileEvidence(join(finalOwnershipRoot, "ownership.json")),
          bootLog: await fileEvidence(join(finalOwnershipRoot, "native.log"))
        }
      }
    };
    const reportPath = join(outputRoot, "current.json");
    await writeJsonAtomic(reportPath, report);
    return { ...report, report: relative(repoRoot, reportPath) };
  } catch (error) {
    const failedRoot = join(outputRoot, "failed");
    await rm(failedRoot, { recursive: true, force: true });
    if (existsSync(candidateRoot)) {
      await writeJsonAtomic(join(candidateRoot, "failure.json"), {
        schema: "cssoccer-native-capture-failure@1",
        failedAt: new Date().toISOString(),
        message: error.message
      });
      await rename(candidateRoot, failedRoot);
    }
    throw error;
  }
}

async function verifyNativeRaw(pathArgument) {
  const rawPath = resolve(
    repoRoot,
    pathArgument ?? ".local/cssoccer/oracle/native/failed/runs/canonical-a/native.raw",
  );
  const sourceTeamRecords = await readFile(
    join(sourceRoot, fixtureContract.source.teamRecordSource),
  );
  const teams = [
    readAndVerifyTeamRecord(sourceTeamRecords, fixtureContract.fixture.home),
    readAndVerifyTeamRecord(sourceTeamRecords, fixtureContract.fixture.away),
  ];
  const parsed = await parseNativeRaw(rawPath);
  const active = activeNativeRecords(parsed, relative(repoRoot, rawPath));
  const report = buildNativePhaseReport(
    active,
    teams.flatMap((team) => team.starters),
  );
  return {
    schema: "cssoccer-native-raw-verification@1",
    status: "pass",
    path: relative(repoRoot, rawPath),
    rawSha256: await sha256File(rawPath),
    phaseReport: report,
  };
}

function createNativeScenarioBinding() {
  const fixture = fixtureContract.fixture;
  return {
    schema: "cssoccer-native-scenario-binding@1",
    fixtureId: fixtureContract.id,
    homeTeamId: fixture.home.sourceTeamId,
    awayTeamId: fixture.away.sourceTeamId,
    controlCountries: fixture.controlCountries,
    users: fixture.users,
    autoPlayer: fixture.autoPlayer,
    rulesSha256: fixture.rulesSha256,
    timingSha256: fixture.timingSha256,
    seedSha256: fixture.seedSha256,
    commandScenarioSha256: fixtureContract.oracle.testCommandScenario.sha256
  };
}

function createNativeCaptureProfileBinding({
  profileKey,
  profile,
  executableSha256,
  scenarioSha256,
  sourceSha256,
  transport,
  runnerPatchSetSha256,
  executablePatchSetSha256,
  inputAdapterSha256
}) {
  return {
    schema: "cssoccer-native-capture-profile-binding@1",
    fixtureId: fixtureContract.id,
    profileKey,
    country: profile.country,
    teamSlot: profile.teamSlot,
    teamUsersMask: profile.teamUsersMask,
    users: fixtureContract.fixture.users,
    autoPlayer: fixtureContract.fixture.autoPlayer,
    executableSha256,
    scriptSha256: fixtureContract.oracle.expectedScriptSha256,
    scenarioSha256,
    sourceSha256,
    commandScenarioSha256: fixtureContract.oracle.testCommandScenario.sha256,
    runnerPatchSetSha256,
    executablePatchSetSha256,
    inputAdapterSha256,
    transportRevision: transport.revision,
    transportBinarySha256: transport.binarySha256,
    transportSourcePatchSha256: transport.sourcePatchSha256
  };
}

async function verifyNativeCaptureTransport(capture) {
  const transport = capture.transport;
  const sourceCheckout = join(repoRoot, dirname(dirname(dirname(transport.sourcePatch))));
  const actualRevision = (await run("git", ["rev-parse", "HEAD"], sourceCheckout)).stdout.trim();
  requireValue("native transport revision", actualRevision, transport.revision);
  const actualRepository = (await run("git", ["remote", "get-url", "origin"], sourceCheckout)).stdout.trim();
  requireValue("native transport repository", actualRepository, transport.repository);
  const diff = (await run("git", ["diff", "--binary", "--", "src/cpu/core_normal.cpp"], sourceCheckout)).stdout;
  if (!diff) throw new Error("Native oracle transport source patch is missing.");
  requireHash("native transport source patch", sha256(Buffer.from(diff)), transport.sourcePatchSha256);
  const binaryPath = join(repoRoot, transport.binary);
  requireHash("native transport binary", await sha256File(binaryPath), transport.binarySha256);
  requireHash("native source map", await sha256File(join(sourceRoot, "TEST.MAP")), transport.sourceMapSha256);
  requireHash("native match_player structure", await sha256File(join(sourceRoot, "ANDYDEFS.H")), transport.matchPlayerStructSha256);
  requireHash("native user_info structure", await sha256File(join(sourceRoot, "EURODEFS.H")), transport.userInfoStructSha256);
  requireValue("native raw magic", capture.raw.magic, "CSSORAW2");
  requireValue("native raw version", capture.raw.version, 2);
  requireValue("native raw metadata bytes", capture.raw.metadataBytes, 28);
  return {
    repository: actualRepository,
    revision: actualRevision,
    sourcePatchSha256: transport.sourcePatchSha256,
    binary: transport.binary,
    binarySha256: transport.binarySha256,
    sourceMapSha256: transport.sourceMapSha256,
    matchPlayerStructSha256: transport.matchPlayerStructSha256,
    userInfoStructSha256: transport.userInfoStructSha256,
    rawSchema: capture.raw.magic,
    rawVersion: capture.raw.version,
    rawRanges: capture.raw.ranges
  };
}

function buildNativeFieldContract() {
  const definitions = [];
  const add = ({ id, label, sourceOwner, meaning, unit = null, valueType, offset, value }) => {
    definitions.push({
      id,
      label,
      sourceOwner,
      meaning,
      unit,
      valueType,
      read: offset === undefined ? () => value : (record) => readNativeValue(record, offset, valueType)
    });
  };
  const global = (id, label, sourceOwner, meaning, valueType, offset, unit = null) => {
    add({ id, label, sourceOwner, meaning, valueType, offset, unit });
  };

  global("ball.in_air", "Ball in air", "EXTERNS.H ball_inair; BALL.CPP", "Native airborne state.", "i32", nativeOffsets.ballInAir);
  global("ball.in_goal", "Ball in goal", "EXTERNS.H ball_in_goal; BALL.CPP", "Native goal-volume flag.", "u8", nativeOffsets.ballInGoal);
  global("ball.in_hands", "Ball in hands", "EXTERNS.H ball_in_hands; BALLINT.CPP", "Native goalkeeper-hand flag.", "u8", nativeOffsets.ballInHands);
  global("ball.last_touch", "Ball last touch", "EXTERNS.H last_touch; BALLINT.CPP", "Native last-touch player index.", "i32", nativeOffsets.lastTouch);
  global("ball.out_of_play", "Ball out of play", "EXTERNS.H ball_out_of_play; BALL.CPP", "Native out-of-play countdown/state.", "i32", nativeOffsets.ballOutOfPlay);
  global("ball.possession", "Ball possession", "EXTERNS.H ball_poss; BALLINT.CPP", "Native possession player index.", "i32", nativeOffsets.ballPossession);
  global("ball.speed", "Ball speed", "EXTERNS.H ball_speed; BALL.CPP", "Native scalar ball speed.", "i32", nativeOffsets.ballSpeed, "native-speed");
  global("ball.spin_xy", "Ball XY spin", "EXTERNS.H ball_xyspin; BALL.CPP", "Native horizontal ball spin.", "f32", nativeOffsets.ballXYSpin, "native-spin");
  global("ball.spin_z", "Ball Z spin", "EXTERNS.H ball_zspin; BALL.CPP", "Native vertical ball spin.", "f32", nativeOffsets.ballZSpin, "native-spin");
  global("ball.spin_state", "Ball spin state", "EXTERNS.H spin_ball; BALL.CPP", "Native spin-state counter.", "i32", nativeOffsets.spinBall);
  global("ball.still", "Ball still", "EXTERNS.H ball_still; BALL.CPP", "Native stationary-ball state.", "i32", nativeOffsets.ballStill);
  global("ball.x", "Ball X", "EXTERNS.H ballx; BALL.CPP", "Native ball X position.", "f32", nativeOffsets.ballX, "native-position");
  global("ball.x_displacement", "Ball X displacement", "EXTERNS.H ballxdis; BALL.CPP", "Native per-tick ball X displacement.", "f32", nativeOffsets.ballXDisplacement, "native-position-per-tick");
  global("ball.y", "Ball Y", "EXTERNS.H bally; BALL.CPP", "Native ball Y position.", "f32", nativeOffsets.ballY, "native-position");
  global("ball.y_displacement", "Ball Y displacement", "EXTERNS.H ballydis; BALL.CPP", "Native per-tick ball Y displacement.", "f32", nativeOffsets.ballYDisplacement, "native-position-per-tick");
  global("ball.z", "Ball Z", "EXTERNS.H ballz; BALL.CPP", "Native ball Z position.", "f32", nativeOffsets.ballZ, "native-position");
  global("ball.z_displacement", "Ball Z displacement", "EXTERNS.H ballzdis; BALL.CPP", "Native per-tick ball Z displacement.", "f32", nativeOffsets.ballZDisplacement, "native-position-per-tick");

  global("camera.distance", "Camera distance", "EXTERNS.H camera_dist; 3D_UPD2.CPP", "Native camera distance.", "f32", nativeOffsets.cameraDistance, "native-position");
  global("camera.fixed", "Camera fixed", "3DENG.C camera_fixed", "Native fixed-camera flag.", "u8", nativeOffsets.cameraFixed);
  global("camera.in_game", "Camera in game", "EXTERNS.H in_game; 3DENG.C", "Native in-match rendering flag.", "u8", nativeOffsets.inGame);
  global("camera.mode", "Camera mode", "EXTERNS.H camera; 3D_UPD2.CPP", "Native camera mode.", "u8", nativeOffsets.cameraMode);
  global("camera.target_x", "Camera target X", "3DENG.C tx", "Native camera target X.", "f32", nativeOffsets.cameraTargetX, "native-position");
  global("camera.target_y", "Camera target Y", "3DENG.C ty", "Native camera target Y.", "f32", nativeOffsets.cameraTargetY, "native-position");
  global("camera.target_z", "Camera target Z", "3DENG.C tz", "Native camera target Z.", "f32", nativeOffsets.cameraTargetZ, "native-position");
  global("camera.x", "Camera X", "3DENG.C camera_x", "Native camera X.", "f32", nativeOffsets.cameraX, "native-position");
  global("camera.y", "Camera Y", "3DENG.C camera_y", "Native camera Y.", "f32", nativeOffsets.cameraY, "native-position");
  global("camera.z", "Camera Z", "3DENG.C camera_z", "Native camera Z.", "f32", nativeOffsets.cameraZ, "native-position");

  global("clock.clock_running", "Clock running", "FOOTBALL.CPP clock_running; RULES.CPP", "Native match-clock running flag.", "u8", nativeOffsets.clockRunning);
  global("clock.injury_time", "Injury time", "FOOTBALL.CPP injury_time", "Native injury-time minutes.", "i16", nativeOffsets.injuryTime, "game-minutes");
  global("clock.line_up", "Line-up countdown", "FOOTBALL.CPP line_up", "Native line-up and kickoff countdown.", "i16", nativeOffsets.lineUp, "ticks");
  global("clock.logic_count", "Logic count", "EXTERNS.H logic_cnt; FOOTBALL.CPP", "Native fixed-step logic counter.", "i32", nativeOffsets.logicCount, "ticks");
  global("clock.match_half", "Match half", "FOOTBALL.CPP match_half; RULES.CPP", "Native lifecycle half/state value.", "u8", nativeOffsets.matchHalf);
  global("clock.minutes", "Match minutes", "EXTERNS.H mtime.min; RULES.CPP", "Native displayed game minutes.", "u16", nativeOffsets.matchTime, "game-minutes");
  global("clock.rolling_clock", "Rolling clock", "FOOTBALL.CPP rolling_clock; RULES.CPP", "Native transition clock.", "i32", nativeOffsets.rollingClock, "ticks");
  global("clock.seconds", "Match seconds", "EXTERNS.H mtime.sec; RULES.CPP", "Native fractional displayed game seconds.", "f32", nativeOffsets.matchTime + 4, "game-seconds");
  global("clock.stop_clock", "Stop clock", "RULES.CPP stop_clock", "Native clock-stop flag.", "u8", nativeOffsets.stopClock);
  global("clock.time_factor", "Time factor", "EXTERNS.H time_factor; RULES.CPP", "Native real-time match scaling factor.", "i32", nativeOffsets.timeFactor);

  global("lifecycle.end_game", "End game", "FOOTBALL.CPP end_game", "Native end-game flag.", "u8", nativeOffsets.endGame);
  global("lifecycle.kick_off", "Kick-off owner", "FOOTBALL.CPP kick_off", "Native kick-off ownership/state.", "u8", nativeOffsets.kickOff);
  global("lifecycle.kickoff", "Kickoff state", "FOOTBALL.CPP kickoff", "Native kickoff state.", "u8", nativeOffsets.kickoff);
  global("lifecycle.match_factor_fixed", "Match factor fixed", "EXTERNS.H mf_fixed; FOOTBALL.CPP", "Native fixed match-factor flag.", "u8", nativeOffsets.matchFactorFixed);
  global("lifecycle.team_a", "Team A", "FOOTBALL.CPP team_a", "Native team-A fixture index.", "u8", nativeOffsets.teamA);
  global("lifecycle.team_a_on", "Team A on", "EXTERNS.H team_a_on; ACTIONS.CPP", "Native team-A active flag.", "u8", nativeOffsets.teamAOn);
  global("lifecycle.team_b", "Team B", "FOOTBALL.CPP team_b", "Native team-B fixture index.", "u8", nativeOffsets.teamB);
  global("lifecycle.team_b_on", "Team B on", "EXTERNS.H team_b_on; ACTIONS.CPP", "Native team-B active flag.", "u8", nativeOffsets.teamBOn);
  global("lifecycle.watch", "Watch state", "EXTERNS.H watch; FOOTBALL.CPP", "Native watch/timing state.", "u8", nativeOffsets.watch);

  global("rng.rand_seed", "Random seed state", "EXTERNS.H rand_seed; MATHS.CPP", "Native mutable RNG state.", "i16", nativeOffsets.randSeed);
  global("rng.seed", "Seed", "EXTERNS.H seed; MATHS.CPP", "Native secondary RNG seed.", "i16", nativeOffsets.seed);

  global("rules.dead_ball_count", "Dead-ball count", "EXTERNS.H dead_ball_cnt; RULES.CPP", "Native dead-ball countdown.", "i32", nativeOffsets.deadBallCount, "ticks");
  global("rules.direct_free_kick", "Direct free kick", "EXTERNS.H direct_fk; RULES.CPP", "Native direct-free-kick flag.", "u8", nativeOffsets.directFreeKick);
  global("rules.game_action", "Game action", "EXTERNS.H game_action; RULES.CPP", "Native current game action.", "i16", nativeOffsets.gameAction);
  global("rules.match_mode", "Match mode", "EXTERNS.H match_mode; RULES.CPP", "Native restart and lifecycle mode.", "u8", nativeOffsets.matchMode);
  global("rules.offside_now", "Offside now", "EXTERNS.H offside_now; RULES.CPP", "Native immediate offside flag.", "u8", nativeOffsets.offsideNow);
  global("rules.offside_on", "Offside enabled", "EXTERNS.H offside_on; RULES.CPP", "Native offside rule enablement.", "u8", nativeOffsets.offsideOn);
  global("rules.penalty_game", "Penalty game", "FOOTBALL.CPP penalty_game; RULES.CPP", "Native shootout state.", "u8", nativeOffsets.penaltyGame);
  global("rules.set_piece", "Set piece", "EXTERNS.H set_piece_on; RULES.CPP", "Native set-piece state.", "u8", nativeOffsets.setPiece);

  global("score.goal_scorer", "Goal scorer", "EXTERNS.H goal_scorer; RULES.CPP", "Native latest goal-scorer index.", "i32", nativeOffsets.goalScorer);
  global("score.just_scored", "Just scored", "EXTERNS.H just_scored; RULES.CPP", "Native post-goal countdown/state.", "i32", nativeOffsets.justScored);
  global("score.team_a", "Team A goals", "EXTERNS.H team_a_goals; RULES.CPP", "Native team-A score.", "i32", nativeOffsets.teamAGoals, "goals");
  global("score.team_b", "Team B goals", "EXTERNS.H team_b_goals; RULES.CPP", "Native team-B score.", "i32", nativeOffsets.teamBGoals, "goals");

  const playerMembers = [
    { suffix: "stable_id", label: "Stable id", valueType: "string", member: "stable-id", meaning: "Prepared stable starter identity." },
    { suffix: "native_player", label: "Native player", valueType: "i16", member: "tm_player", offset: 0, meaning: "Native player identifier." },
    { suffix: "x", label: "X", valueType: "f32", member: "tm_x", offset: 2, meaning: "Native player X position.", unit: "native-position" },
    { suffix: "x_displacement", label: "X displacement", valueType: "f32", member: "tm_xdis", offset: 6, meaning: "Native player X displacement.", unit: "native-position-per-tick" },
    { suffix: "y", label: "Y", valueType: "f32", member: "tm_y", offset: 10, meaning: "Native player Y position.", unit: "native-position" },
    { suffix: "y_displacement", label: "Y displacement", valueType: "f32", member: "tm_ydis", offset: 14, meaning: "Native player Y displacement.", unit: "native-position-per-tick" },
    { suffix: "z", label: "Z", valueType: "f32", member: "tm_z", offset: 18, meaning: "Native player Z position.", unit: "native-position" },
    { suffix: "z_displacement", label: "Z displacement", valueType: "f32", member: "tm_zdis", offset: 22, meaning: "Native player Z displacement.", unit: "native-position-per-tick" },
    { suffix: "face_direction", label: "Face direction", valueType: "i16", member: "face_dir", offset: 107, meaning: "Native facing direction." },
    { suffix: "on", label: "On pitch", valueType: "i16", member: "guy_on", offset: 44, meaning: "Native active/on-pitch state." },
    { suffix: "control", label: "Control", valueType: "u8", member: "control", offset: 46, meaning: "Native player control state." },
    { suffix: "ball_state", label: "Ball state", valueType: "i16", member: "ball_state", offset: 61, meaning: "Native player-ball state." },
    { suffix: "animation", label: "Animation", valueType: "u16", member: "tm_anim", offset: 119, meaning: "Native animation identifier." },
    { suffix: "animation_frame", label: "Animation frame", valueType: "f32", member: "tm_frm", offset: 111, meaning: "Native animation frame." },
    { suffix: "action", label: "Action", valueType: "i16", member: "tm_act", offset: 142, meaning: "Native player action." },
    { suffix: "possession", label: "Possession", valueType: "i16", member: "tm_poss", offset: 144, meaning: "Native player possession/action state." }
  ];
  const teamEntries = [
    { team: fixtureContract.fixture.home, start: 0 },
    { team: fixtureContract.fixture.away, start: 11 }
  ];
  for (const { team, start } of teamEntries) {
    for (let starter = 0; starter < fixtureContract.teamRecordLayout.startersPerTeam; starter += 1) {
      const stableId = `${team.country}-player-${String(starter + 1).padStart(2, "0")}`;
      const runtimeIndex = start + starter;
      for (const member of playerMembers) {
        add({
          id: `players.${stableId}.${member.suffix}`,
          label: `${stableId} ${member.label}`,
          sourceOwner: member.member === "stable-id"
            ? `fixture ${team.country} starter ${starter + 1}`
            : `ANDYDEFS.H match_player.${member.member}; teams[${runtimeIndex}]`,
          meaning: member.meaning,
          unit: member.unit ?? null,
          valueType: member.valueType,
          ...(member.offset === undefined
            ? { value: stableId }
            : { offset: nativeOffsets.teams + runtimeIndex * 203 + member.offset })
        });
      }
    }
  }

  definitions.sort((a, b) => a.id.localeCompare(b.id));
  const fields = definitions.map(({ read: _read, ...field }) => field);
  const phases = [{ id: "post_tick", order: 0 }];
  return { definitions, fields, phases };
}

async function runNativeCapture({ stage, runName, runRoot, captureFrames, launch }) {
  await rm(runRoot, { recursive: true, force: true });
  const captureRoot = join(runRoot, "native-frames");
  await Promise.all([mkdir(runRoot, { recursive: true }), mkdir(captureRoot, { recursive: true })]);
  const rawPath = join(runRoot, "native.raw");
  const guestLogPath = join(stage.gameRoot, "NATIVE.LOG");
  const retainedLogPath = join(runRoot, "native.log");
  const runnerLaunch = contract.runner.launch;
  const dosbox = join(repoRoot, fixtureContract.oracle.capture.transport.binary);
  const launchArguments = [
    "-defaultconf",
    "-defaultmapper",
    "-silent",
    "-nogui",
    "-nomenu",
    "-fastlaunch",
    "-set",
    `dosbox quit warning=${runnerLaunch.dos.quitWarning}`,
    "-set",
    `dos mcb corruption becomes application free memory=${runnerLaunch.dos.repairMcbCorruption}`,
    "-set",
    `dos minimum mcb segment=${runnerLaunch.dos.minimumMcbSegment}`,
    "-set",
    `cpu core=${runnerLaunch.cpuCore}`,
    "-set",
    `cpu cycles=${runnerLaunch.cpuCycles}`,
    "-set",
    `dosbox captures=${captureRoot}`,
    "-c",
    `mount c "${stage.dosRoot}"`,
    "-c",
    "c:",
    "-c",
    "cd GAME",
    "-c",
    `${fixtureContract.source.executable} ${launch.arguments.join(" ")} > NATIVE.LOG`,
    "-c",
    "exit"
  ];
  const startedAt = Date.now();
  const outcome = await runOutcome(dosbox, launchArguments, repoRoot, {
    ...process.env,
    HOME: stage.homeRoot,
    SDL_VIDEODRIVER: "dummy",
    SDL_AUDIODRIVER: "dummy",
    CSSOCCER_ORACLE_RAW: rawPath,
    CSSOCCER_ORACLE_FRAMES: captureFrames ? "1" : "0"
  }, launch.watchdogSeconds * 1000);
  const wallMilliseconds = Date.now() - startedAt;
  if (outcome.timedOut) throw new Error(`${runName} exceeded its ${launch.watchdogSeconds}-second watchdog.`);
  if (outcome.exitCode !== 0 || outcome.signal) {
    throw new Error(`${runName} failed to exit cleanly: ${outcome.exitCode ?? outcome.signal ?? "unknown"}.\n${outcome.stderr}`);
  }
  if (wallMilliseconds > launch.expectedMaxRuntimeSeconds * 1000) {
    throw new Error(`${runName} took ${wallMilliseconds}ms; expected at most ${launch.expectedMaxRuntimeSeconds * 1000}ms.`);
  }
  const hostText = `${outcome.stdout}\n${outcome.stderr}`;
  for (const marker of ["DOS fatal memory error", "Corrupt MCB chain", "libc++abi: terminating"]) {
    if (hostText.includes(marker)) throw new Error(`${runName} emitted fatal host marker: ${marker}.`);
  }
  const bootText = await readFile(guestLogPath, "latin1");
  if (bootText.includes("DOS/4GW fatal error")) throw new Error(`${runName} failed inside DOS/4GW.`);
  const missingMarkers = contract.runner.launch.bootMarkers.filter((marker) => !bootText.includes(marker));
  if (missingMarkers.length) throw new Error(`${runName} native log is missing markers: ${missingMarkers.join(", ")}.`);
  await cp(guestLogPath, retainedLogPath);
  const rawStat = await stat(rawPath);
  if (rawStat.size < 10_000) throw new Error(`${runName} native raw stream is unexpectedly small: ${rawStat.size} bytes.`);
  const processReport = {
    schema: "cssoccer-native-process@1",
    runName,
    status: "pass",
    exitCode: outcome.exitCode,
    signal: outcome.signal,
    gracefulProgramExit: true,
    wallMilliseconds,
    watchdogSeconds: launch.watchdogSeconds,
    visibleWindow: false,
    stdoutSha256: sha256(Buffer.from(outcome.stdout)),
    stderrSha256: sha256(Buffer.from(outcome.stderr))
  };
  await writeJsonAtomic(join(runRoot, "process.json"), processReport);
  return {
    runName,
    runRoot,
    rawPath,
    captureRoot,
    retainedLogPath,
    executableSha256: stage.executableSha256,
    scriptSha256: stage.scriptSha256,
    exit: {
      code: outcome.exitCode,
      signal: outcome.signal,
      gracefulProgramExit: true,
      wallMilliseconds,
      watchdogSeconds: launch.watchdogSeconds
    }
  };
}

async function runNativeCapturesSerially(stages, runNames, runsRoot, launch) {
  const results = [];
  for (let index = 0; index < stages.length; index += 1) {
    results.push(await runNativeCapture({
      stage: stages[index],
      runName: runNames[index],
      runRoot: join(runsRoot, runNames[index]),
      captureFrames: true,
      launch
    }));
  }
  return results;
}

async function parseNativeRaw(path) {
  const buffer = await readFile(path);
  if (buffer.length < 16 || buffer.subarray(0, 8).toString("ascii") !== "CSSORAW2") {
    throw new Error(`${relative(repoRoot, path)} has an invalid native raw magic.`);
  }
  const version = buffer.readUInt32LE(8);
  const rangeCount = buffer.readUInt32LE(12);
  requireValue("native raw version", version, fixtureContract.oracle.capture.raw.version);
  requireValue("native raw range count", rangeCount, fixtureContract.oracle.capture.raw.ranges.length);
  let cursor = 16;
  let payloadBase = 0;
  const ranges = [];
  for (let index = 0; index < rangeCount; index += 1) {
    if (cursor + 8 > buffer.length) throw new Error("Native raw range header is truncated.");
    const offset = buffer.readUInt32LE(cursor);
    const bytes = buffer.readUInt32LE(cursor + 4);
    const expected = fixtureContract.oracle.capture.raw.ranges[index];
    requireValue(`native raw range ${index}`, { offset, bytes }, expected);
    ranges.push({ offset, bytes, payloadBase });
    payloadBase += bytes;
    cursor += 8;
  }
  const metadataBytes = fixtureContract.oracle.capture.raw.metadataBytes;
  const recordBytes = metadataBytes + payloadBase;
  const remaining = buffer.length - cursor;
  if (remaining <= 0 || remaining % recordBytes !== 0) {
    throw new Error(`Native raw record domain is truncated: ${remaining} bytes is not divisible by ${recordBytes}.`);
  }
  const count = remaining / recordBytes;
  const records = [];
  for (let index = 0; index < count; index += 1) {
    const recordOffset = cursor + index * recordBytes;
    if (buffer.readUInt32LE(recordOffset) !== 0x314b4954) {
      throw new Error(`Native raw record ${index} has an invalid TIK1 marker.`);
    }
    const sequence = buffer.readUInt32LE(recordOffset + 4);
    if (sequence !== index) throw new Error(`Native raw sequence is not contiguous at record ${index}: got ${sequence}.`);
    records.push({
      buffer,
      ranges,
      sequence,
      eip: buffer.readUInt32LE(recordOffset + 8),
      imageBase: buffer.readUInt32LE(recordOffset + 12),
      dataBase: buffer.readUInt32LE(recordOffset + 16),
      activeTick: buffer.readUInt32LE(recordOffset + 20),
      flags: buffer.readUInt32LE(recordOffset + 24),
      payloadOffset: recordOffset + metadataBytes
    });
  }
  return { path, buffer, ranges, records, recordBytes };
}

function readNativeValue(record, offset, valueType) {
  const range = record.ranges.find((candidate) => offset >= candidate.offset && offset < candidate.offset + candidate.bytes);
  if (!range) throw new Error(`Native field offset 0x${offset.toString(16)} is outside the captured ranges.`);
  const width = valueType === "f32" || valueType.endsWith("32") ? 4 : valueType.endsWith("16") ? 2 : 1;
  if (offset + width > range.offset + range.bytes) {
    throw new Error(`Native field at 0x${offset.toString(16)} crosses a capture range boundary.`);
  }
  const position = record.payloadOffset + range.payloadBase + offset - range.offset;
  if (valueType === "u8") return record.buffer.readUInt8(position);
  if (valueType === "i8") return record.buffer.readInt8(position);
  if (valueType === "u16") return record.buffer.readUInt16LE(position);
  if (valueType === "i16") return record.buffer.readInt16LE(position);
  if (valueType === "u32") return record.buffer.readUInt32LE(position);
  if (valueType === "i32") return record.buffer.readInt32LE(position);
  if (valueType === "f32") return record.buffer.readFloatLE(position);
  throw new Error(`Unsupported native value type ${valueType}.`);
}

function activeNativeRecords(parsed, label) {
  const active = parsed.records.filter((record) => (record.flags & rawFlags.active) !== 0);
  if (!active.length) throw new Error(`${label} contains no active native ticks.`);
  if (active[0].activeTick !== 0 || (active[0].flags & rawFlags.kickoff) === 0) {
    throw new Error(`${label} does not begin at opening kickoff tick 0.`);
  }
  const terminalIndex = active.findIndex((record) => (record.flags & rawFlags.terminal) !== 0);
  if (terminalIndex < 0) throw new Error(`${label} never reaches the full-time terminal state.`);
  const retained = active.slice(0, terminalIndex + 1);
  for (let index = 0; index < retained.length; index += 1) {
    if (retained[index].activeTick !== index) {
      throw new Error(`${label} active ticks are not contiguous at ${index}: got ${retained[index].activeTick}.`);
    }
  }
  if (readNativeValue(retained.at(-1), nativeOffsets.matchHalf, "u8") !== 11) {
    throw new Error(`${label} terminal tick does not have match_half = 11.`);
  }
  return retained;
}

async function normalizeCanonicalNativeCapture(nativeRun, context) {
  const parsed = await parseNativeRaw(nativeRun.rawPath);
  const active = activeNativeRecords(parsed, nativeRun.runName);
  const phaseReport = buildNativePhaseReport(active, context.starters);
  const header = {
    schema: "cssoccer-parity-stream@1",
    recordType: "header",
    role: "reference",
    streamId: `native-${context.bindings.scenarioId}-${fixtureContract.oracle.capture.canonicalProfile}`,
    generatedAt: context.generatedAt,
    bindings: context.bindings,
    tickRange: { start: 0, count: active.length },
    phases: context.phases,
    fields: context.fields,
    engineIndependence: null
  };
  await Promise.all([
    writeJsonAtomic(join(nativeRun.runRoot, "scenario.json"), context.scenarioDescriptor),
    writeJsonAtomic(join(nativeRun.runRoot, "profile.json"), context.profileDescriptor),
    writeJsonAtomic(join(nativeRun.runRoot, "phase-markers.json"), phaseReport)
  ]);
  await writeNativeParityState(join(nativeRun.runRoot, "state.jsonl"), header, active, context.definitions);
  const frameReport = await normalizeNativeFrames(nativeRun, active, parsed.records);
  return {
    runName: nativeRun.runName,
    runRoot: nativeRun.runRoot,
    ticks: active.length,
    terminalTick: active.at(-1).activeTick,
    frameCount: frameReport.frames.length,
    phaseSummary: phaseReport.summary,
    exit: nativeRun.exit
  };
}

function buildNativePhaseReport(active, starters) {
  const value = (record, offset, type) => readNativeValue(record, offset, type);
  const fixtureIntegrity = validateNativeFixtureIntegrity(active, starters);
  for (const record of active) {
    if (value(record, nativeOffsets.timeFactor, "i32") !== fixtureContract.fixture.timing.timeFactor) {
      throw new Error(`Native time_factor changed at tick ${record.activeTick}.`);
    }
    if (value(record, nativeOffsets.penaltyGame, "u8") !== 0) {
      throw new Error(`Canonical native match entered a penalty shootout at tick ${record.activeTick}.`);
    }
  }
  const halfTransitionIndex = active.findIndex((record) => value(record, nativeOffsets.matchHalf, "u8") === 1);
  if (halfTransitionIndex <= 0) throw new Error("Canonical native match never reached the second-half lifecycle state.");
  const timing = fixtureContract.fixture.timing;
  const gameClockSeconds = (record) =>
    value(record, nativeOffsets.matchTime, "u16") * 60 +
    value(record, nativeOffsets.matchTime + 4, "f32");
  const gameSecondsPerAdvance = timing.gameMinutesPerHalf * 60 / timing.ticksPerHalf;
  const clockAdvanceCounts = [0, 0];
  for (let index = 1; index < active.length; index += 1) {
    const previous = active[index - 1];
    const current = active[index];
    const previousClock = gameClockSeconds(previous);
    const currentClock = gameClockSeconds(current);
    const delta = currentClock - previousClock;
    if (!Number.isFinite(currentClock)) {
      throw new Error(`Native game clock became non-finite at tick ${current.activeTick}.`);
    }
    if (delta < 0) {
      const previousHalf = value(previous, nativeOffsets.matchHalf, "u8");
      const currentHalf = value(current, nativeOffsets.matchHalf, "u8");
      if (
        previousHalf !== 0
        || currentHalf !== 1
        || currentClock !== timing.gameMinutesPerHalf * 60
        || previousClock < currentClock
        || timing.liveBallOverrun.clockResetAtEndSwap !== "keep-minutes-reset-seconds"
      ) {
        throw new Error(`Native game clock regressed unexpectedly at tick ${current.activeTick}.`);
      }
      continue;
    }
    if (delta === 0) continue;
    if (delta !== gameSecondsPerAdvance) {
      throw new Error(`Native game clock advanced ${delta} seconds at tick ${current.activeTick}; expected ${gameSecondsPerAdvance}.`);
    }
    const currentHalf = value(current, nativeOffsets.matchHalf, "u8");
    const halfIndex = currentHalf === 0 ? 0 : currentHalf === 1 || currentHalf === 11 ? 1 : -1;
    if (halfIndex < 0) throw new Error(`Native game clock advanced in unsupported half state ${currentHalf}.`);
    clockAdvanceCounts[halfIndex] += 1;
  }
  const liveBallOverrunTicks = clockAdvanceCounts.map((count) => count - timing.ticksPerHalf);
  if (
    timing.liveBallOverrun.allowed !== true
    || liveBallOverrunTicks.some(
      (count) => count < 0 || count > timing.liveBallOverrun.maxTicksPerHalf,
    )
  ) {
    throw new Error(
      `Native play-clock tick counts exceed the bound: ${JSON.stringify(clockAdvanceCounts)}.`,
    );
  }
  const halfGameSeconds = timing.gameMinutesPerHalf * 60;
  const fullGameSeconds = halfGameSeconds * 2;
  const halftimeStartIndex = active.findIndex((record) =>
    value(record, nativeOffsets.matchHalf, "u8") === 0 &&
    value(record, nativeOffsets.clockRunning, "u8") === 0 &&
    gameClockSeconds(record) >= halfGameSeconds
  );
  if (halftimeStartIndex <= 0 || halftimeStartIndex >= halfTransitionIndex) {
    throw new Error("Canonical native match did not retain a clock-stopped halftime interval.");
  }
  const secondHalfLivePlayIndex = active.findIndex((record, index) =>
    index >= halfTransitionIndex &&
    value(record, nativeOffsets.matchHalf, "u8") === 1 &&
    value(record, nativeOffsets.clockRunning, "u8") === 1
  );
  if (secondHalfLivePlayIndex < 0) throw new Error("Canonical native match never resumed live play after the halftime end swap.");
  const terminalIndex = active.length - 1;
  const terminal = active[terminalIndex];
  if (gameClockSeconds(terminal) !== fullGameSeconds) {
    throw new Error(`Canonical native match ended at ${gameClockSeconds(terminal)} game seconds instead of ${fullGameSeconds}.`);
  }
  const halfValues = [...new Set(active.map((record) => value(record, nativeOffsets.matchHalf, "u8")))];
  if (canonicalJson(halfValues) !== canonicalJson([0, 1, 11])) {
    throw new Error(`Canonical native half progression mismatch: ${JSON.stringify(halfValues)}.`);
  }
  const phaseChangedTicks = active
    .filter((record) => (record.flags & rawFlags.phaseChanged) !== 0)
    .map((record) => record.activeTick);
  if (canonicalJson(phaseChangedTicks) !== canonicalJson([
    active[halfTransitionIndex].activeTick,
    terminal.activeTick
  ])) {
    throw new Error(`Native sampler phase-change markers mismatch: ${JSON.stringify(phaseChangedTicks)}.`);
  }
  const setPieceInputTicks = active
    .filter((record) => (record.flags & rawFlags.setPieceInput) !== 0)
    .map((record) => record.activeTick);
  for (const record of active.filter((entry) => (entry.flags & rawFlags.setPieceInput) !== 0)) {
    if (value(record, nativeOffsets.setPiece, "u8") === 0) {
      throw new Error(`Native set-piece input adapter pulsed outside a set piece at tick ${record.activeTick}.`);
    }
  }

  const opening = active[0];
  const secondHalfKickoff = active[halfTransitionIndex];
  const secondHalfLivePlay = active[secondHalfLivePlayIndex];
  const openingCentroids = nativeTeamCentroids(opening);
  const secondHalfCentroids = nativeTeamCentroids(secondHalfKickoff);
  const openingDelta = openingCentroids.teamA - openingCentroids.teamB;
  const secondHalfDelta = secondHalfCentroids.teamA - secondHalfCentroids.teamB;
  if (openingDelta === 0 || secondHalfDelta === 0 || openingDelta * secondHalfDelta >= 0) {
    throw new Error("Native halftime evidence does not prove that the teams swapped pitch ends.");
  }

  const markers = [
    {
      tick: 0,
      phase: "opening-kickoff",
      matchHalf: value(opening, nativeOffsets.matchHalf, "u8"),
      lineUp: value(opening, nativeOffsets.lineUp, "i16"),
      gameMinute: value(opening, nativeOffsets.matchTime, "u16")
    },
    {
      tick: active[halftimeStartIndex].activeTick,
      phase: "halftime-whistle",
      matchHalf: value(active[halftimeStartIndex], nativeOffsets.matchHalf, "u8"),
      matchMode: value(active[halftimeStartIndex], nativeOffsets.matchMode, "u8"),
      clockRunning: value(active[halftimeStartIndex], nativeOffsets.clockRunning, "u8"),
      gameMinute: value(active[halftimeStartIndex], nativeOffsets.matchTime, "u16"),
      gameSecond: value(active[halftimeStartIndex], nativeOffsets.matchTime + 4, "f32")
    },
    {
      tick: active[halfTransitionIndex].activeTick,
      phase: "halftime-end-swap-second-half-kickoff",
      matchHalf: value(active[halfTransitionIndex], nativeOffsets.matchHalf, "u8"),
      lineUp: value(active[halfTransitionIndex], nativeOffsets.lineUp, "i16"),
      matchMode: value(active[halfTransitionIndex], nativeOffsets.matchMode, "u8"),
      gameMinute: value(active[halfTransitionIndex], nativeOffsets.matchTime, "u16")
    },
    {
      tick: secondHalfLivePlay.activeTick,
      phase: "second-half-live-play",
      matchHalf: value(secondHalfLivePlay, nativeOffsets.matchHalf, "u8"),
      lineUp: value(secondHalfLivePlay, nativeOffsets.lineUp, "i16"),
      gameMinute: value(secondHalfLivePlay, nativeOffsets.matchTime, "u16")
    },
    {
      tick: terminal.activeTick,
      phase: "full-time-terminal",
      matchHalf: value(terminal, nativeOffsets.matchHalf, "u8"),
      lineUp: value(terminal, nativeOffsets.lineUp, "i16"),
      gameMinute: value(terminal, nativeOffsets.matchTime, "u16")
    }
  ];
  return {
    schema: "cssoccer-native-phase-markers@1",
    status: "pass",
    markers,
    endSwap: {
      status: "pass",
      openingCentroids,
      secondHalfCentroids,
      openingTeamDelta: openingDelta,
      secondHalfTeamDelta: secondHalfDelta
    },
    fixtureIntegrity,
    timing: {
      status: "pass",
      tickRateHz: timing.tickRateHz,
      gameSecondsPerAdvance,
      clockAdvanceCounts,
      regulationTicks: timing.fullMatchPlayTicks,
      liveBallOverrunTicks,
      playTicks: clockAdvanceCounts[0] + clockAdvanceCounts[1],
      realSecondsByHalf: clockAdvanceCounts.map((count) => count / timing.tickRateHz),
      fullMatchPlaySeconds: (clockAdvanceCounts[0] + clockAdvanceCounts[1]) / timing.tickRateHz
    },
    summary: {
      ticks: active.length,
      terminalTick: terminal.activeTick,
      halfValues,
      phaseChangedTicks,
      setPieceInputPulseCount: setPieceInputTicks.length,
      setPieceInputAdapterUsed: setPieceInputTicks.length > 0,
      liveBallOverrunTicks,
      firstSetPieceInputPulseTick: setPieceInputTicks[0] ?? null,
      openingKickoffTick: 0,
      halftimeWhistleTick: active[halftimeStartIndex].activeTick,
      halftimeTick: active[halfTransitionIndex].activeTick,
      secondHalfKickoffTick: secondHalfKickoff.activeTick,
      secondHalfLivePlayTick: secondHalfLivePlay.activeTick,
      fullTimeTick: terminal.activeTick,
      finalGameMinute: value(terminal, nativeOffsets.matchTime, "u16"),
      terminalMatchHalf: value(terminal, nativeOffsets.matchHalf, "u8")
    }
  };
}

function validateNativeFixtureIntegrity(active, starters) {
  if (fixtureContract.fixture.rules.substitutes !== false) {
    throw new Error("Canonical native fixture must disable substitutions.");
  }
  if (!Array.isArray(starters) || starters.length !== 22) {
    throw new Error("Canonical native fixture integrity requires exactly 22 source starters.");
  }
  const attributeKeys = [
    "pace",
    "power",
    "control",
    "flair",
    "vision",
    "accuracy",
    "stamina",
    "discipline",
  ];
  const injuryAdjustedAttributeKeys = ["control", "flair", "accuracy", "stamina"];
  const nativeAttribute = (sourceValue) => Math.trunc(sourceValue * 128 / 100);
  const opening = active[0];
  for (const [playerIndex, starter] of starters.entries()) {
    for (const [attributeIndex, attribute] of attributeKeys.entries()) {
      const actual = readNativeValue(
        opening,
        nativeOffsets.teams + playerIndex * 203 + 70 + attributeIndex,
        "u8",
      );
      const expected = nativeAttribute(starter.attributes[attribute]);
      if (actual !== expected) {
        throw new Error(
          `Native opening ${starter.stableStarterId} ${attribute} mismatch: expected ${expected}, got ${actual}.`,
        );
      }
    }
  }
  const previousPlayers = new Map();
  const injuryRefreshes = [];
  for (const record of active) {
    for (const [label, offset, valueType] of [
      ["substitutes", nativeOffsets.substitutes, "u8"],
      ["player_being_subbed", nativeOffsets.playerBeingSubbed, "i16"],
      ["player_on_off", nativeOffsets.playerOnOff, "i16"],
      ["player_coming_on", nativeOffsets.playerComingOn, "i16"],
      ["sub_pending", nativeOffsets.subPending, "u8"],
    ]) {
      const actual = readNativeValue(record, offset, valueType);
      if (actual !== 0) {
        throw new Error(`Native ${label} changed to ${actual} at tick ${record.activeTick} with substitutions off.`);
      }
    }
    const secondHalfOrder = (readNativeValue(record, nativeOffsets.matchHalf, "u8") & 1) !== 0;
    const expectedOrder = secondHalfOrder
      ? [...starters.slice(11), ...starters.slice(0, 11)]
      : starters;
    for (const [playerIndex, starter] of expectedOrder.entries()) {
      const attributes = Object.fromEntries(attributeKeys.map((attribute, attributeIndex) => [
        attribute,
        readNativeValue(
          record,
          nativeOffsets.teams + playerIndex * 203 + 70 + attributeIndex,
          "u8",
        ),
      ]));
      const injury = readNativeValue(
        record,
        nativeOffsets.teams + playerIndex * 203 + 93,
        "u16",
      );
      const previous = previousPlayers.get(starter.stableStarterId);
      if (previous) {
        if (injury < previous.injury) {
          throw new Error(
            `Native ${starter.stableStarterId} injury regressed at tick ${record.activeTick}.`,
          );
        }
        const changed = attributeKeys.slice(2).filter(
          (attribute) => attributes[attribute] !== previous.attributes[attribute],
        );
        if (changed.length) {
          if (
            injury <= previous.injury
            || canonicalJson(changed) !== canonicalJson(injuryAdjustedAttributeKeys)
            || changed.some((attribute) => attributes[attribute] > previous.attributes[attribute])
          ) {
            throw new Error(
              `Native ${starter.stableStarterId} has an unexplained fixed-profile change at tick ${record.activeTick}: ${changed.join(", ")}.`,
            );
          }
          injuryRefreshes.push({
            tick: record.activeTick,
            stableStarterId: starter.stableStarterId,
            injuryBefore: previous.injury,
            injuryAfter: injury,
            changedAttributes: changed,
          });
        }
      }
      previousPlayers.set(starter.stableStarterId, { attributes, injury });
    }
  }
  return {
    schema: "cssoccer-native-fixture-integrity@1",
    status: "pass",
    sourceStarterCount: starters.length,
    openingAttributesPerStarter: attributeKeys.length,
    injuryProfileProducer: "linked TEST.MAP RULES.CPP inc_inj -> FOOTBALL.CPP init_player_stats",
    injuryAdjustedAttributes: injuryAdjustedAttributeKeys,
    injuryRefreshes,
    nativeAttributeNormalization: fixtureContract.oracle.scriptTeamData.nativeAttributeNormalization,
    verifiedTicks: active.length,
    substitutions: "disabled-and-zero-through-full-time",
  };
}

function nativeTeamCentroids(record) {
  const centroid = (start) => {
    let total = 0;
    for (let index = 0; index < 11; index += 1) {
      total += readNativeValue(record, nativeOffsets.teams + (start + index) * 203 + 2, "f32");
    }
    return total / 11;
  };
  return { teamA: centroid(0), teamB: centroid(11) };
}

async function writeNativeParityState(path, header, active, definitions) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  const handle = await open(temporary, "w");
  try {
    await handle.writeFile(JSON.stringify(header) + "\n");
    for (const record of active) {
      const lines = [];
      for (const definition of definitions) {
        const value = definition.read(record);
        lines.push(stringifyNativeSample({
          schema: "cssoccer-parity-stream@1",
          recordType: "sample",
          tick: record.activeTick,
          phase: "post_tick",
          fieldId: definition.id,
          valueType: definition.valueType,
          value,
          numericBits: nativeNumericBits(definition.valueType, value)
        }));
      }
      await handle.writeFile(lines.join("\n") + "\n");
    }
  } finally {
    await handle.close();
  }
  await rename(temporary, path);
}

function stringifyNativeSample(sample) {
  if (!Object.is(sample.value, -0)) return JSON.stringify(sample);
  const marker = "__cssoccer_negative_zero__";
  return JSON.stringify({ ...sample, value: marker }).replace(JSON.stringify(marker), "-0");
}

function nativeNumericBits(valueType, value) {
  if (valueType === "string") return null;
  if (valueType === "f32") {
    if (!Number.isFinite(value) || !Object.is(Math.fround(value), value)) {
      throw new Error(`Native f32 value is not finite and exactly representable: ${String(value)}.`);
    }
    const bytes = Buffer.allocUnsafe(4);
    bytes.writeFloatBE(value);
    return bytes.toString("hex");
  }
  const width = Number(valueType.slice(1));
  if (!Number.isSafeInteger(value)) throw new Error(`Native ${valueType} value is not a safe integer: ${String(value)}.`);
  return BigInt.asUintN(width, BigInt(value)).toString(16).padStart(width / 4, "0");
}

async function normalizeNativeFrames(nativeRun, active, allRecords) {
  const requests = active.filter((record) => (record.flags & rawFlags.frame) !== 0);
  const allRequests = allRecords.filter(
    (record) => (record.flags & rawFlags.active) !== 0 && (record.flags & rawFlags.frame) !== 0
  );
  const sourceFrames = (await readdir(nativeRun.captureRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /_(\d+)\.png$/iu.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      index: Number(entry.name.match(/_(\d+)\.png$/iu)[1])
    }))
    .sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
  if (sourceFrames.length !== allRequests.length) {
    throw new Error(
      `${nativeRun.runName} frame transport mismatch: ${allRequests.length} source-marked requests produced ${sourceFrames.length} PNG files.`
    );
  }
  for (let index = 0; index < requests.length; index += 1) {
    if (allRequests[index] !== requests[index]) {
      throw new Error(`${nativeRun.runName} frame request order diverged before full time at index ${index}.`);
    }
  }
  const postTerminalRequests = allRequests.slice(requests.length);
  if (postTerminalRequests.some((record) => record.activeTick <= active.at(-1).activeTick)) {
    throw new Error(`${nativeRun.runName} has an unaccounted frame request inside the retained match domain.`);
  }
  const framesRoot = join(nativeRun.runRoot, "frames");
  await rm(framesRoot, { recursive: true, force: true });
  await mkdir(framesRoot, { recursive: true });
  const frames = [];
  for (let index = 0; index < requests.length; index += 1) {
    const sourcePath = join(nativeRun.captureRoot, sourceFrames[index].name);
    const filename = `frame_${String(index).padStart(4, "0")}.png`;
    const targetPath = join(framesRoot, filename);
    await cp(sourcePath, targetPath);
    const dimensions = await readPngDimensions(targetPath);
    requireValue(`${nativeRun.runName} frame ${index} dimensions`, dimensions, { width: 640, height: 400 });
    const request = requests[index];
    frames.push({
      index,
      tick: request.activeTick,
      phaseChanged: (request.flags & rawFlags.phaseChanged) !== 0,
      kickoff: (request.flags & rawFlags.kickoff) !== 0,
      terminal: (request.flags & rawFlags.terminal) !== 0,
      filename,
      width: dimensions.width,
      height: dimensions.height,
      sha256: await sha256File(targetPath)
    });
  }
  const report = {
    schema: "cssoccer-native-frame-domain@1",
    status: "pass",
    cadenceTicks: fixtureContract.oracle.capture.framesEveryTicks,
    transport: {
      emittedFrames: sourceFrames.length,
      retainedMatchFrames: requests.length,
      discardedPostTerminalFrames: postTerminalRequests.length,
      firstDiscardedActiveTick: postTerminalRequests[0]?.activeTick ?? null
    },
    frames
  };
  await writeJsonAtomic(join(nativeRun.runRoot, "frames.json"), report);
  await rm(nativeRun.captureRoot, { recursive: true, force: true });
  return report;
}

async function readPngDimensions(path) {
  const bytes = await readFile(path);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature) || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error(`${relative(repoRoot, path)} is not a supported PNG frame.`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function validateOwnershipSymmetry({ canonicalRawPath, ownershipRawPath, scenarioSha256, timingSha256 }) {
  const [canonicalParsed, ownershipParsed] = await Promise.all([
    parseNativeRaw(canonicalRawPath),
    parseNativeRaw(ownershipRawPath)
  ]);
  const firstActive = (parsed, label) => {
    const record = parsed.records.find((candidate) => (candidate.flags & rawFlags.active) !== 0);
    if (!record || record.activeTick !== 0 || (record.flags & rawFlags.kickoff) === 0) {
      throw new Error(`${label} ownership fixture does not reach opening kickoff.`);
    }
    return record;
  };
  const decode = (record) => ({
    user: {
      team: readNativeValue(record, nativeOffsets.userList, "u8"),
      player: readNativeValue(record, nativeOffsets.userList + 1, "i8"),
      control: readNativeValue(record, nativeOffsets.userList + 2, "i8"),
      teamHAflag: readNativeValue(record, nativeOffsets.userList + 3, "u8")
    },
    euroTeamA: readNativeValue(record, nativeOffsets.euroTeamA, "u8"),
    euroTeamB: readNativeValue(record, nativeOffsets.euroTeamB, "u8"),
    timeFactor: readNativeValue(record, nativeOffsets.timeFactor, "i32"),
    matchHalf: readNativeValue(record, nativeOffsets.matchHalf, "u8"),
    lineUp: readNativeValue(record, nativeOffsets.lineUp, "i16")
  });
  const argentina = decode(firstActive(canonicalParsed, "Argentina-control"));
  const spain = decode(firstActive(ownershipParsed, "Spain-control"));
  const homeTeamId = fixtureContract.fixture.home.sourceTeamId;
  const awayTeamId = fixtureContract.fixture.away.sourceTeamId;
  const homeRuntimeSlot = 0;
  const awayRuntimeSlot = 1;
  for (const [label, value] of [["Argentina-control EUROteamA", argentina.euroTeamA], ["Spain-control EUROteamA", spain.euroTeamA]]) {
    requireValue(label, value, homeRuntimeSlot);
  }
  for (const [label, value] of [["Argentina-control EUROteamB", argentina.euroTeamB], ["Spain-control EUROteamB", spain.euroTeamB]]) {
    requireValue(label, value, awayRuntimeSlot);
  }
  requireValue("Argentina-control user team", argentina.user.team, argentina.euroTeamB);
  requireValue("Spain-control user team", spain.user.team, spain.euroTeamA);
  requireValue("Spain-control home/away flag", spain.user.teamHAflag, 0);
  requireValue("Argentina-control automatic player", argentina.user.player, fixtureContract.fixture.autoPlayer);
  requireValue("Spain-control automatic player", spain.user.player, fixtureContract.fixture.autoPlayer);
  requireValue("Argentina-control time factor", argentina.timeFactor, fixtureContract.fixture.timing.timeFactor);
  requireValue("Spain-control time factor", spain.timeFactor, fixtureContract.fixture.timing.timeFactor);
  return {
    schema: "cssoccer-native-control-ownership@1",
    status: "pass",
    fixtureId: fixtureContract.id,
    scenarioSha256,
    timingSha256,
    unchangedFixture: true,
    unchangedTiming: true,
    sourceTeams: {
      home: { country: fixtureContract.fixture.home.country, sourceTeamId: homeTeamId, runtimeSlot: homeRuntimeSlot },
      away: { country: fixtureContract.fixture.away.country, sourceTeamId: awayTeamId, runtimeSlot: awayRuntimeSlot }
    },
    ownershipProof: "UserList[0].team selects the patched EUROteamA/EUROteamB runtime slot; TeamHAflag is retained as observed metadata.",
    profiles: {
      "argentina-control": argentina,
      "spain-control": spain
    }
  };
}

async function compareCanonicalNativeCaptures(normalizedRuns) {
  if (normalizedRuns.length !== 2) throw new Error("Canonical identity gate requires exactly two normalized runs.");
  const [first, second] = normalizedRuns;
  const artifactNames = [
    "native.raw",
    "state.jsonl",
    "scenario.json",
    "profile.json",
    "phase-markers.json",
    "frames.json",
    "native.log"
  ];
  const artifacts = {};
  for (const name of artifactNames) {
    const firstHash = await sha256File(join(first.runRoot, name));
    const secondHash = await sha256File(join(second.runRoot, name));
    requireHash(`canonical ${name} byte identity`, secondHash, firstHash);
    artifacts[name] = firstHash;
  }
  const firstFrames = await frameFileEvidence(join(first.runRoot, "frames"));
  const secondFrames = await frameFileEvidence(join(second.runRoot, "frames"));
  requireValue("canonical frame filename and byte identity", secondFrames, firstFrames);
  return {
    status: "pass",
    byteIdentical: true,
    runs: [first.runName, second.runName],
    artifacts,
    frames: {
      count: firstFrames.length,
      sha256: sha256(Buffer.from(canonicalJson(firstFrames)))
    }
  };
}

async function frameFileEvidence(framesRoot) {
  const names = (await readdir(framesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^frame_[0-9]{4}\.png$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const evidence = [];
  for (const name of names) evidence.push({ name, sha256: await sha256File(join(framesRoot, name)) });
  return evidence;
}

async function publishNativeFrameEvidence(retainedRoot, expectedFrames) {
  if (!existsSync(frameSequenceTool)) throw new Error(`Frame-sequence oracle tool is missing: ${frameSequenceTool}.`);
  const framesA = join(retainedRoot, "runs", "canonical-a", "frames");
  const framesB = join(retainedRoot, "runs", "canonical-b", "frames");
  const evidenceRoot = join(retainedRoot, "frame-sequence");
  const packageA = join(evidenceRoot, "canonical-a");
  const packageB = join(evidenceRoot, "canonical-b");
  const compareRoot = join(evidenceRoot, "a-a-exact");
  const commonPackageArguments = [
    "--replace",
    "--expected-frames",
    String(expectedFrames),
    "--keyframes",
    "auto",
    "--lead-frames",
    "1",
    "--no-gif"
  ];
  const [packagedA, packagedB] = await Promise.all([
    run(process.execPath, [frameSequenceTool,
      "package", "--frames", framesA, "--out", packageA, "--label", "canonical_a", ...commonPackageArguments
    ], repoRoot),
    run(process.execPath, [frameSequenceTool,
      "package", "--frames", framesB, "--out", packageB, "--label", "canonical_b", ...commonPackageArguments
    ], repoRoot)
  ]);
  const packageReportA = JSON.parse(packagedA.stdout);
  const packageReportB = JSON.parse(packagedB.stdout);
  if (!packageReportA.ok || !packageReportB.ok) throw new Error("Native frame-sequence packaging failed.");
  const comparisonResult = await run(process.execPath, [frameSequenceTool,
    "compare",
    "--expected", framesA,
    "--actual", framesB,
    "--out", compareRoot,
    "--label", "native_a_a_exact",
    "--replace",
    "--expected-frames", String(expectedFrames),
    "--mean-threshold", "0",
    "--changed-threshold", "0",
    "--channel-threshold", "0",
    "--diff-frames", "none"
  ], repoRoot);
  const comparison = JSON.parse(comparisonResult.stdout);
  if (!comparison.ok || !comparison.pass) throw new Error("Native A/A frame sequence is not exact.");
  return {
    schema: "cssoccer-native-frame-evidence@1",
    status: "pass",
    calibratedAA: true,
    exact: true,
    expectedFrames,
    dimensions: { width: 640, height: 400 },
    thresholds: comparison.thresholds,
    comparedFrames: comparison.comparedFrameCount,
    missingActual: comparison.missingActual,
    missingExpected: comparison.missingExpected,
    manifests: {
      canonicalA: relative(repoRoot, packageReportA.manifestPath),
      canonicalB: relative(repoRoot, packageReportB.manifestPath),
      comparison: relative(repoRoot, comparison.manifestPath)
    }
  };
}

function readAndVerifyTeamRecord(source, team) {
  const layout = fixtureContract.teamRecordLayout;
  const record = source.subarray(team.sourceOffset, team.sourceOffset + layout.bytes);
  if (record.length !== layout.bytes) throw new Error(`${team.country} team record is truncated.`);
  const players = [];
  for (let index = 0; index < layout.players; index += 1) {
    const offset = layout.playerOffset + index * layout.playerBytes;
    players.push({
      sourceRosterIndex: index,
      stableStarterId: index < layout.startersPerTeam
        ? `${team.country}-player-${String(index + 1).padStart(2, "0")}`
        : null,
      name: readCString(record, offset, 20),
      goalIndex: record.readInt8(offset + 20),
      attributes: {
        pace: record.readInt8(offset + 21),
        power: record.readInt8(offset + 22),
        control: record.readInt8(offset + 23),
        flair: record.readInt8(offset + 24),
        vision: record.readInt8(offset + 25),
        accuracy: record.readInt8(offset + 26),
        stamina: record.readInt8(offset + 27),
        discipline: record.readInt8(offset + 28)
      },
      flags: record.readInt8(offset + 29),
      squadNumber: record.readInt8(offset + 30),
      position: record.readInt8(offset + 31),
      skinTone: record.readInt8(offset + 32)
    });
  }
  const hashes = {
    teamSha256: sha256(record),
    rosterSha256: sha256(record.subarray(layout.playerOffset)),
    startersSha256: sha256(
      record.subarray(layout.playerOffset, layout.playerOffset + layout.startersPerTeam * layout.playerBytes)
    ),
    tacticsSha256: sha256(Buffer.concat([record.subarray(124, 136), record.subarray(140, 144)]))
  };
  const facts = {
    country: team.country,
    label: team.label,
    sourceTeamId: team.sourceTeamId,
    name: readCString(record, 0, 23),
    coach: readCString(record, 23, 24),
    nickname: readCString(record, 92, 13),
    ranking: record.readInt32LE(108),
    teamNumber: record.readInt32LE(112),
    playerControl: record.readInt8(116),
    fixtureNumber: record.readInt8(117),
    bigFlag: record.readInt32LE(120),
    formation: record.readInt32LE(124),
    autoFormation: record.readInt32LE(128),
    cupKey: record.readInt32LE(132),
    countryCode: readCString(record, 136, 3),
    computerFormation: record.readInt32LE(140),
    roster: players,
    starters: players.slice(0, layout.startersPerTeam),
    hashes,
    kitBinding: team.kitBinding,
    kitSha256: team.kitBinding.sha256
  };
  const expected = team.expected;
  for (const key of [
    "name",
    "coach",
    "nickname",
    "countryCode",
    "ranking",
    "teamNumber",
    "bigFlag",
    "formation",
    "autoFormation",
    "computerFormation"
  ]) {
    requireValue(`${team.country} ${key}`, facts[key], expected[key]);
  }
  for (const [key, actual] of Object.entries(hashes)) requireHash(`${team.country} ${key}`, actual, expected[key]);
  requireValue(`${team.country} starter names`, facts.starters.map(({ name }) => name), expected.starterNames);
  const { kind: kitKind, sha256: expectedKitSha256, ...kitBinding } = team.kitBinding;
  if (kitKind !== "source-symbol-and-selector-binding-no-payload-claim") {
    throw new Error(`${team.country} kit binding overclaims unavailable payload bytes.`);
  }
  requireHash(`${team.country} kit binding`, hashCanonical(kitBinding), expectedKitSha256);
  return facts;
}

function createNativeTestCommandScenario(contract) {
  if (contract.schema !== "cssoccer-native-test-command-scenario@1") {
    throw new Error("Unsupported native test command scenario schema.");
  }
  if (!Number.isSafeInteger(contract.ticks) || contract.ticks <= 0) {
    throw new Error("Native test command scenario ticks must be a positive safe integer.");
  }
  if (
    JSON.stringify(Object.keys(contract.command).sort()) !== JSON.stringify(["buttons", "moveX", "moveY"])
    || !Object.values(contract.command).every(Number.isInteger)
  ) {
    throw new Error("Native test command scenario command must contain exact integer axes and buttons.");
  }
  const lines = [];
  for (let tick = 0; tick < contract.ticks; tick += 1) {
    lines.push(JSON.stringify({ tick, ...contract.command }));
  }
  return Buffer.from(lines.join("\n") + "\n");
}

function verifyFixtureRejections() {
  const tests = [];
  const fields = [
    ["homeTeamId", fixtureContract.rejections.homeTeamIds],
    ["awayTeamId", fixtureContract.rejections.awayTeamIds],
    ["durationMinutes", fixtureContract.rejections.durationMinutes],
    ["halfDurationMinutes", fixtureContract.rejections.halfDurationMinutes],
    ["competitionId", fixtureContract.rejections.competitionIds],
    ["simulationModeId", fixtureContract.rejections.simulationModeIds],
    ["controlCountry", fixtureContract.rejections.controlCountries]
  ];
  for (const [field, values] of fields) {
    for (const value of values) {
      let message = null;
      try {
        validateFixtureRequest({ [field]: value });
      } catch (error) {
        message = error.message;
      }
      if (!message) throw new Error(`Fixture rejection test unexpectedly accepted ${field}=${JSON.stringify(value)}.`);
      tests.push({ field, value, status: "rejected", message });
    }
  }
  return { status: "pass", count: tests.length, tests };
}

function validateFixtureRequest(request) {
  const fixture = fixtureContract.fixture;
  const normalized = {
    homeTeamId: request.homeTeamId ?? fixture.home.sourceTeamId,
    awayTeamId: request.awayTeamId ?? fixture.away.sourceTeamId,
    durationMinutes: request.durationMinutes ?? fixture.timing.fullMatchPlayMinutes,
    halfDurationMinutes: request.halfDurationMinutes ?? fixture.timing.playMinutesPerHalf,
    competitionId: request.competitionId ?? fixture.rules.competition.id,
    simulationModeId: request.simulationModeId ?? fixture.rules.simulation.id,
    controlCountry: request.controlCountry ?? null
  };
  requireValue("homeTeamId", normalized.homeTeamId, fixture.home.sourceTeamId);
  requireValue("awayTeamId", normalized.awayTeamId, fixture.away.sourceTeamId);
  requireValue("durationMinutes", normalized.durationMinutes, fixture.timing.fullMatchPlayMinutes);
  requireValue("halfDurationMinutes", normalized.halfDurationMinutes, fixture.timing.playMinutesPerHalf);
  requireValue("competitionId", normalized.competitionId, fixture.rules.competition.id);
  requireValue("simulationModeId", normalized.simulationModeId, fixture.rules.simulation.id);
  if (normalized.controlCountry !== null && !fixture.controlCountries.includes(normalized.controlCountry)) {
    throw new Error(`controlCountry must be exactly ${fixture.controlCountries.join(" or ")}.`);
  }
  return normalized;
}

function parseFixtureRequest(arguments_) {
  const definitions = {
    "--home-team": ["homeTeamId", "number"],
    "--away-team": ["awayTeamId", "number"],
    "--duration-minutes": ["durationMinutes", "number"],
    "--half-duration-minutes": ["halfDurationMinutes", "number"],
    "--competition": ["competitionId", "number"],
    "--simulation": ["simulationModeId", "number"],
    "--control-country": ["controlCountry", "string"]
  };
  const request = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const separator = argument.indexOf("=");
    const option = separator >= 0 ? argument.slice(0, separator) : argument;
    const definition = definitions[option];
    if (!definition) throw new Error(`Unsupported verify-fixture option: ${option}.`);
    const raw = separator >= 0 ? argument.slice(separator + 1) : arguments_[++index];
    if (raw === undefined || raw === "") throw new Error(`${option} requires a value.`);
    const [key, type] = definition;
    if (Object.hasOwn(request, key)) throw new Error(`${option} was provided more than once.`);
    if (type === "number") {
      if (!/^-?[0-9]+$/u.test(raw)) throw new Error(`${option} requires an integer.`);
      request[key] = Number(raw);
    } else {
      request[key] = raw;
    }
  }
  return request;
}

function applyExecutablePatch(buffer, patch, appliedPatches = []) {
  const expected = Buffer.from(patch.expected, "hex");
  const replacement = Buffer.from(patch.replacement, "hex");
  if (expected.length !== replacement.length) throw new Error(`Patch ${patch.name} changes executable length.`);
  const actual = buffer.subarray(patch.offset, patch.offset + expected.length);
  if (!actual.equals(expected)) {
    throw new Error(
      `Patch ${patch.name} preimage mismatch at ${patch.offset}: expected ${patch.expected}, got ${actual.toString("hex")}.`
    );
  }
  replacement.copy(buffer, patch.offset);
  appliedPatches.push({ name: patch.name, offset: patch.offset, bytes: replacement.length });
}

function replaceExactlyOnce(value, before, after) {
  const first = value.indexOf(before);
  if (first < 0 || value.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected exactly one script token ${before}.`);
  }
  return value.slice(0, first) + after + value.slice(first + before.length);
}

function readCString(buffer, offset, bytes) {
  const value = buffer.subarray(offset, offset + bytes);
  const terminator = value.indexOf(0);
  return value.subarray(0, terminator < 0 ? value.length : terminator).toString("latin1");
}

function requireHash(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label} hash mismatch: expected ${expected}, got ${actual}.`);
}

function requireValue(label, actual, expected) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function hashCanonical(value) {
  return sha256(Buffer.from(canonicalJson(value)));
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

async function revision() {
  return (await run("git", ["rev-parse", "HEAD"], sourceRoot)).stdout.trim();
}

async function run(file, args, cwd) {
  try {
    return await execute(file, args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`${file} ${args.join(" ")} failed:\n${error.stderr || error.stdout || error.message}`);
  }
}

async function runOutcome(file, args, cwd, env, timeout) {
  try {
    const result = await execute(file, args, {
      cwd,
      env,
      maxBuffer: 16 * 1024 * 1024,
      timeout,
      killSignal: "SIGKILL"
    });
    return { ...result, exitCode: 0, signal: null, timedOut: false };
  } catch (error) {
    if (typeof error.code !== "number" && !error.signal) {
      throw new Error(`${file} ${args.join(" ")} failed:\n${error.stderr || error.stdout || error.message}`);
    }
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: typeof error.code === "number" ? error.code : null,
      signal: error.signal ?? null,
      timedOut: Boolean(error.killed && error.signal === "SIGKILL")
    };
  }
}

async function sha256File(path) {
  return sha256(await readFile(path));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileEvidence(path) {
  const details = await stat(path);
  return {
    path: relative(repoRoot, path),
    bytes: details.size,
    sha256: await sha256File(path)
  };
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n");
  await rename(temporary, path);
}

async function writeFileAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  await writeFile(temporary, value);
  await rename(temporary, path);
}

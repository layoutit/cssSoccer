#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  mkdtemp,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCssoccerOracleCandidateHeader,
  serializeCssoccerOracleSamples,
} from "../src/cssoccer/oracleState.mjs";
import { canonicalJson, sha256Hex } from "../src/parity/io.mjs";
import {
  parseCssoccerFreePlayCommandScenario,
} from "./support/free-play-scenario-adapter.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_PORT = 5203;
const DEFAULT_TIMEOUT_MS = 30_000;
const NATIVE_POINTER = join(REPO_ROOT, ".local/cssoccer/oracle/native/current.json");
const DEFAULT_OUTPUT_ROOT = join(REPO_ROOT, ".local/cssoccer/parity/free-play");
const FREE_PLAY_CAPTURE_MODULE = join(REPO_ROOT, "tools/free-play-parity-capture.mjs");
const COMMAND_SCENARIO_PATH = join(
  REPO_ROOT,
  ".local/cssoccer/oracle/fixture/command-scenario.jsonl",
);
const PREPARED_FACTS_PATH = join(
  REPO_ROOT,
  "build/generated/public/cssoccer/facts/spain-argentina-full-match.json",
);
const CHROME_CANDIDATES = Object.freeze([
  process.env.CSSOCCER_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
].filter(Boolean));

class FreePlayParityCaptureBlockedError extends Error {
  constructor(report) {
    super(report.message);
    this.name = "FreePlayParityCaptureBlockedError";
    this.report = report;
  }
}

const options = parseArgs(process.argv.slice(2));
async function main() {
  if (options.help) {
    printHelp();
    return;
  }

  let server = null;
  try {
  const native = await readNativePointer();
  const target = options.url ?? `http://127.0.0.1:${options.port}/cssoccer/`;
  if (!options.url) server = await startVite(options.port, options.timeoutMs);
  await waitForHttp(target, options.timeoutMs);

  const generatedAt = new Date().toISOString();
  const candidateIdentity = await createCandidateIdentity(generatedAt);
  const commandScenario = await readCommandScenario(native, candidateIdentity);
  if (options.lifecycleSmoke !== null) {
    const smoke = await captureLifecycleSmoke({
      country: options.lifecycleSmoke,
      native,
      target,
      candidateIdentity,
      commandScenario,
    });
    console.log(JSON.stringify(smoke, null, 2));
    return;
  }
  const canonicalA = await captureCompleteRun({
    runId: "canonical-a",
    country: "argentina",
    generatedAt,
    native,
    target,
    candidateIdentity,
    commandScenario,
  });
  const canonicalB = await captureCompleteRun({
    runId: "canonical-b",
    country: "argentina",
    generatedAt,
    native,
    target,
    candidateIdentity,
    commandScenario,
  });
  assert(
    canonicalA.bytes === canonicalB.bytes
      && canonicalA.sha256 === canonicalB.sha256,
    "Argentina browser captures were not byte-identical",
  );
  const spain = await captureLifecycleSmoke({
    country: "spain",
    native,
    target,
    candidateIdentity,
    commandScenario,
  });

  const report = {
    schema: "cssoccer-free-play-parity-capture@1",
    status: "pass",
    verifiedAt: new Date().toISOString(),
    fixtureId: native.fixtureId,
    bindings: canonicalA.bindings,
    nativeReferenceBindings: native.bindings,
    tickRange: { start: 0, count: commandScenario.commands.length },
    canonical: {
      country: "argentina",
      byteIdentical: true,
      runs: { "canonical-a": canonicalA, "canonical-b": canonicalB },
    },
    spainLifecycleSmoke: spain,
    execution: {
      headless: true,
      scenarioKind: "test-only-bound-command-scenario",
      presentationMountRequired: false,
      ovenPublication: false,
    },
  };
  await atomicJson(join(options.outputRoot, "free-play-capture.json"), report);
  console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (error instanceof FreePlayParityCaptureBlockedError) {
      await atomicJson(
        join(options.outputRoot, "blocked/free-play-capture-blocker.json"),
        error.report,
      );
      console.error(JSON.stringify(error.report, null, 2));
      process.exitCode = 2;
    } else {
      console.error(error?.stack || String(error));
      process.exitCode = 1;
    }
  } finally {
    await stopProcess(server);
  }
}

async function captureCompleteRun({
  runId,
  country,
  generatedAt,
  native,
  target,
  candidateIdentity,
  commandScenario,
}) {
  const browser = await openBrowserMatch({
    country,
    native,
    target,
    candidateIdentity,
    commandScenario,
  });
  const runPath = join(options.outputRoot, "retained/runs", runId, "state.jsonl");
  const temporary = `${runPath}.tmp-${process.pid}`;
  try {
    const status = browser.captureStatus;
    if (status.status !== "ready") throw blockedReport({ country, native, status, target });
    const fields = await browser.evaluate("window.__cssoccerDebug.freePlayFieldContract()") ;
    const header = createCssoccerOracleCandidateHeader({
      streamId: "cssoccer-browser-argentina-control",
      generatedAt,
      bindings: status.bindings,
      tickCount: commandScenario.commands.length,
      fields,
      engineIndependence: status.engineIndependence,
    });

    await mkdir(dirname(runPath), { recursive: true });
    const output = await open(temporary, "wx");
    try {
      await output.write(`${JSON.stringify(header)}\n`);
      for (let tick = 0; tick < commandScenario.commands.length; tick += 1) {
        let projection;
        try {
          projection = await browser.evaluate(
            "window.__cssoccerDebug.stepFreePlayScenario()",
            { awaitPromise: true },
          );
        } catch (error) {
          throw new Error(
            `${runId} browser capture failed at tick ${tick}: ${error.message}`,
            { cause: error },
          );
        }
        assert(
          projection?.tick === tick && projection.phase === "post_tick",
          `browser capture broke contiguous order at tick ${tick}`,
        );
        await output.write(serializeCssoccerOracleSamples(projection.samples));
      }
      await output.sync();
    } finally {
      await output.close();
    }
    await rename(temporary, runPath);

    const metadata = await stat(runPath);
    return Object.freeze({
      status: "pass",
      bindings: status.bindings,
      path: relativeLocal(runPath),
      bytes: metadata.size,
      sha256: await sha256File(runPath),
      ticks: commandScenario.commands.length,
      lastCommandTick: commandScenario.commands.length - 1,
    });
  } finally {
    await rm(temporary, { force: true });
    await browser.close();
  }
}

async function captureLifecycleSmoke({
  country,
  native,
  target,
  candidateIdentity,
  commandScenario,
}) {
  const browser = await openBrowserMatch({
    country,
    native,
    target,
    candidateIdentity,
    commandScenario,
  });
  try {
    const status = browser.captureStatus;
    if (status.status !== "ready") throw blockedReport({ country, native, status, target });
    for (let tick = 0; tick < commandScenario.commands.length; tick += 1) {
      let projection;
      try {
        projection = await browser.evaluate(
          "window.__cssoccerDebug.stepFreePlayScenario()",
          { awaitPromise: true },
        );
      } catch (error) {
        throw new Error(
          `${country} lifecycle smoke failed at tick ${tick}: ${error.message}`,
          { cause: error },
        );
      }
      assert(projection?.tick === tick, `Spain lifecycle smoke broke at tick ${tick}`);
    }
    const inspected = await browser.evaluate("window.__cssoccerDebug.inspect()") ;
    assert(
      inspected?.freePlayEngine?.tick === commandScenario.commands.length
        && inspected.freePlayEngine.nextCommandTick === commandScenario.commands.length
        && inspected.freePlayEngine.complete === true,
      "Spain smoke did not consume the bound free-play command scenario",
    );
    return Object.freeze({
      status: "pass",
      country,
      ticks: commandScenario.commands.length,
      lastCommandTick: commandScenario.commands.length - 1,
    });
  } finally {
    await browser.close();
  }
}

async function openBrowserMatch({
  country,
  native,
  target,
  candidateIdentity,
  commandScenario,
}) {
  const profile = await mkdtemp(join(tmpdir(), "cssoccer-free-play-parity-"));
  const chromeExecutable = await resolveChromeExecutable();
  const launched = await launchChrome(chromeExecutable, profile, options.timeoutMs);
  const cdp = await CdpClient.connect(launched.webSocketUrl, options.timeoutMs);
  const pageErrors = [];
  let sessionId;
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    ({ sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true }));
    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      pageErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || "page exception");
    });
    cdp.on("Log.entryAdded", ({ entry }) => {
      if (entry?.level === "error") {
        pageErrors.push([
          entry.text || "browser log error",
          entry.url || "",
        ].filter(Boolean).join(" @ "));
      }
    });
    await Promise.all([
      cdp.send("Page.enable", {}, sessionId),
      cdp.send("Runtime.enable", {}, sessionId),
      cdp.send("Log.enable", {}, sessionId),
    ]);
    const shellUrl = new URL("/cssoccer/manifest.json", target).href;
    const navigation = await cdp.send("Page.navigate", { url: shellUrl }, sessionId);
    await delay(50);
    await cdp.send("Page.setDocumentContent", {
      frameId: navigation.frameId,
      html: "<!doctype html><meta charset=utf-8><link rel=icon href=\"data:,\"><title>cssoccer exact parity capture</title>",
    }, sessionId);
    // Ignore only navigation-shell diagnostics (Chrome requests favicon.ico
    // before setDocumentContent, but reports that request asynchronously).
    // Engine/module errors are collected after the shell settles below.
    await delay(50);
    pageErrors.length = 0;
    const inspected = await evaluate(cdp, sessionId, `
      (async () => {
        const capture = await import("/tools/free-play-parity-capture.mjs");
        return capture.installCssoccerFreePlayParityCapture({
          candidateIdentity: ${JSON.stringify(candidateIdentity)},
          commandScenario: ${JSON.stringify(commandScenario)},
          country: ${JSON.stringify(country)},
          inputAdapter: ${JSON.stringify(native.inputAdapter)},
          nativeIdentity: ${JSON.stringify({
            sourceSha256: native.bindings.sourceSha256,
            buildSha256: native.bindings.buildSha256,
          })},
        });
      })()
    `, { awaitPromise: true });
    const reportedErrors = await evaluate(
      cdp,
      sessionId,
      "window.__cssoccerDebug?.errors?.() ?? []",
    );
    assert(
      inspected?.ready === true,
      `browser parity engine did not become ready: ${JSON.stringify({ inspected, pageErrors, reportedErrors })}`,
    );
    assert(inspected.controlCountry === country, "browser selected-country binding changed");
    assert(
      inspected.scenarioKind === "test-only-bound-command-scenario"
        && inspected.mount === null,
      "browser free-play scenario unexpectedly depended on the presentation mount",
    );
    assert(
      inspected.requests?.preparedRequestCount === 3
        && inspected.requests.nativeRequestCount === 0
        && inspected.requests.sourceRequestCount === 0
        && inspected.requests.rejectedRequestCount === 0,
      "browser parity capture request boundary changed",
    );
    assert(
      inspected.pageErrorCount === 0 && pageErrors.length === 0,
      `browser reported page errors: ${JSON.stringify({ pageErrors, reportedErrors })}`,
    );
    const captureStatus = await evaluate(
      cdp,
      sessionId,
      "window.__cssoccerDebug.freePlayScenarioStatus()",
    );
    assertCandidateBindings(captureStatus?.bindings, native.bindings, candidateIdentity);
    return {
      captureStatus,
      evaluate(expression, evaluateOptions) {
        return evaluate(cdp, sessionId, expression, evaluateOptions);
      },
      async close() {
        cdp.close();
        await stopProcess(launched.process);
        await rm(profile, { recursive: true, force: true });
      },
    };
  } catch (error) {
    cdp.close();
    await stopProcess(launched.process);
    await rm(profile, { recursive: true, force: true });
    throw error;
  }
}

function blockedReport({ country, native, status, target }) {
  return new FreePlayParityCaptureBlockedError({
    schema: "cssoccer-free-play-parity-capture-blocker@1",
    status: "blocked",
    detectedAt: new Date().toISOString(),
    firstBlocker: status.firstBlocker,
    message: blockerMessage(status.firstBlocker),
    fixtureId: native.fixtureId,
    country,
    target,
    expected: {
      tickRange: { start: 0, count: status.commandCount },
      lastCommandTick: status.commandCount - 1,
    },
    observed: {
      nextTick: status.nextTick,
      phase: status.phase,
      fieldCount: status.fieldCount,
      bindings: status.bindings,
    },
    execution: {
      headless: true,
      nativeReplaySubstitution: false,
      jsonlPublished: false,
      ovenPublication: false,
    },
  });
}

function blockerMessage(code) {
  return `Bound free-play command scenario is blocked by ${String(code)}.`;
}

class CdpClient {
  static async connect(url, timeoutMs) {
    const socket = new WebSocket(url);
    await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Chrome DevTools.")), timeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolvePromise();
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Could not connect to Chrome DevTools."));
      }, { once: true });
    });
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => this.receive(event.data));
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
  }

  receive(raw) {
    const message = JSON.parse(String(raw));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      else pending.resolve(message.result ?? {});
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
  }

  close() {
    this.socket.close();
  }
}

async function readNativePointer() {
  const pointer = JSON.parse(await readFile(NATIVE_POINTER, "utf8"));
  assert(pointer?.schema === "cssoccer-native-full-match-capture@1", "native capture pointer schema changed");
  assert(pointer.status === "pass", "native capture pointer is not passing");
  const canonical = pointer.canonical?.runs?.["canonical-a"];
  assert(Number.isSafeInteger(canonical?.terminalTick), "native terminal tick is missing");
  assert(canonical.ticks === canonical.terminalTick + 1, "native tick range is not contiguous");
  assertNativeBindings(pointer.bindings);
  const profilePath = join(REPO_ROOT, canonical.artifacts.profile.path);
  const profile = JSON.parse(await readFile(profilePath, "utf8"));
  assert(
    profile?.inputAdapter?.schema === "cssoccer-native-set-piece-input-adapter@1"
      && profile.inputAdapter.sha256 === profile.binding?.inputAdapterSha256,
    "native set-piece input adapter binding changed",
  );
  return Object.freeze({
    fixtureId: pointer.fixtureId,
    bindings: Object.freeze({ ...pointer.bindings }),
    inputAdapter: Object.freeze({ ...profile.inputAdapter }),
    terminalTick: canonical.terminalTick,
    tickCount: canonical.ticks,
  });
}

async function readCommandScenario(native, candidateIdentity) {
  const [commandScenarioText, facts] = await Promise.all([
    readFile(COMMAND_SCENARIO_PATH, "utf8"),
    readFile(PREPARED_FACTS_PATH, "utf8").then(JSON.parse),
  ]);
  assert(
    sha256Hex(commandScenarioText) === native.bindings.inputSha256,
    "bound free-play command scenario hash diverged from native scenario identity",
  );
  assert(
    facts?.seed?.value === 3523
      && facts?.timing?.timestepSeconds === 0.05
      && facts?.bindings?.nativeScenarioSha256 === native.bindings.scenarioSha256,
    "prepared free-play seed/timestep/scenario identity changed",
  );
  return parseCssoccerFreePlayCommandScenario(commandScenarioText, {
    buildSha256: candidateIdentity.buildSha256,
    commandSha256: native.bindings.inputSha256,
    fieldContractSha256: native.bindings.contractSha256,
    profileSha256: native.bindings.profileSha256,
    scenarioSha256: native.bindings.scenarioSha256,
    seed: facts.seed.value,
    sourceSha256: candidateIdentity.sourceSha256,
    timestepMilliseconds: 50,
  });
}

function assertNativeBindings(value) {
  const keys = [
    "scenarioId", "scenarioSha256", "profileSha256", "inputSha256",
    "sourceSha256", "buildSha256", "contractSha256",
  ];
  assert(value?.scenarioId === value?.scenarioSha256?.slice(0, 16), "native scenario id is invalid");
  assert(
    keys.slice(1).every((key) => /^[a-f0-9]{64}$/u.test(value?.[key] ?? "")),
    "native parity binding is not SHA-256",
  );
}

function assertCandidateBindings(actual, native, identity) {
  assert(
    actual?.scenarioId === native.scenarioId
      && actual.scenarioSha256 === native.scenarioSha256
      && actual.profileSha256 === native.profileSha256
      && actual.inputSha256 === native.inputSha256
      && actual.contractSha256 === native.contractSha256,
    "browser/native scenario, profile, input, or contract binding diverged",
  );
  assert(
    actual.sourceSha256 === identity.sourceSha256
      && actual.buildSha256 === identity.buildSha256,
    "browser candidate source/build identity diverged from the checked harness",
  );
  assert(
    actual.sourceSha256 !== native.sourceSha256
      && actual.buildSha256 !== native.buildSha256,
    "browser candidate reused native source/build identity",
  );
}

async function createCandidateIdentity(qualifiedAt) {
  const sourceRoot = join(REPO_ROOT, "src/cssoccer");
  const modules = (await readdir(sourceRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => entry.name)
    .sort();
  const runtimeFiles = {};
  for (const name of modules) {
    runtimeFiles[`src/cssoccer/${name}`] = await sha256File(join(sourceRoot, name));
  }
  const enginePath = join(sourceRoot, "freePlayEngine.mjs");
  const engineSource = await readFile(enginePath, "utf8");
  const sourceSha256 = sha256Hex(engineSource);
  const buildSha256 = sha256Hex(canonicalJson({
    schema: "cssoccer-browser-runtime-snapshot@1",
    files: runtimeFiles,
  }));
  const freePlayCaptureModuleSha256 = await sha256File(FREE_PLAY_CAPTURE_MODULE);
  const harnessFiles = {
    ...Object.fromEntries([
      "src/cssoccer/freePlayEngineIndependence.mjs",
      "src/cssoccer/freePlayContract.mjs",
      "src/cssoccer/freePlayEngine.mjs",
      "src/cssoccer/freePlayProjection.mjs",
      "src/cssoccer/freePlayState.mjs",
      "src/cssoccer/oracleState.mjs",
    ].map((path) => [path, runtimeFiles[path]])),
    "tools/free-play-parity-capture.mjs": freePlayCaptureModuleSha256,
  };
  const captureFiles = {
    "src/cssoccer/freePlayProjection.mjs": runtimeFiles["src/cssoccer/freePlayProjection.mjs"],
    "src/cssoccer/oracleState.mjs": runtimeFiles["src/cssoccer/oracleState.mjs"],
    "tools/free-play-parity-capture.mjs": freePlayCaptureModuleSha256,
    "tools/support/free-play-scenario-adapter.mjs": await sha256File(
      join(REPO_ROOT, "tools/support/free-play-scenario-adapter.mjs"),
    ),
    "tools/capture-free-play-parity.mjs": await sha256File(fileURLToPath(import.meta.url)),
  };
  const forbiddenReads = engineSource.match(
    /node:|\.local\/|state\.jsonl|native\.raw|references\/|readFile|createReadStream/gu,
  ) ?? [];
  assert(forbiddenReads.length === 0, "browser engine source reads native/source/retained artifacts");
  return Object.freeze({
    schema: "cssoccer-browser-candidate-identity@1",
    qualifiedAt,
    sourceSha256,
    buildSha256,
    harnessSha256: sha256Hex(canonicalJson({
      schema: "cssoccer-free-play-parity-harness@1",
      files: harnessFiles,
    })),
    captureAdapterSha256: sha256Hex(canonicalJson({
      schema: "cssoccer-free-play-parity-adapter@1",
      files: captureFiles,
    })),
    checks: Object.freeze({
      browserOwnedState: true,
      nativeReplayReads: 0,
      preparedInputOnly: true,
      retainedStateReads: 0,
      sourceCheckoutReads: 0,
    }),
  });
}

async function evaluate(client, sessionId, expression, { awaitPromise = false } = {}) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function waitForDebug(client, sessionId, timeoutMs, predicate) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(client, sessionId, "window.__cssoccerDebug?.inspect?.() ?? null");
      if (predicate(last)) return last;
    } catch (error) {
      if (!/context|navigation|destroyed/iu.test(String(error))) throw error;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for css.soccer debug state: ${JSON.stringify(last)}`);
}

async function startVite(port, timeoutMs) {
  const vite = join(REPO_ROOT, "node_modules/vite/bin/vite.js");
  await access(vite);
  const child = spawn(process.execPath, [
    vite, "--host", "127.0.0.1", "--port", String(port), "--strictPort",
  ], {
    cwd: REPO_ROOT,
    env: { ...process.env, CSSOCCER_EXACT_CAPTURE: "1" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/cssoccer/`, timeoutMs);
    return child;
  } catch (error) {
    await stopProcess(child);
    throw new Error(`Could not start css.soccer Vite: ${stderr}`, { cause: error });
  }
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function launchChrome(executable, profilePath, timeoutMs) {
  const child = spawn(executable, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const webSocketUrl = await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out starting headless Chrome.")), timeoutMs);
    let output = "";
    const onData = (chunk) => {
      output += chunk.toString("utf8");
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/u);
      if (!match) return;
      clearTimeout(timer);
      child.stderr.off("data", onData);
      child.stderr.resume();
      resolvePromise(match[1]);
    };
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited ${code}: ${output}`));
    });
  });
  return { process: child, webSocketUrl };
}

async function resolveChromeExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next declared local Chrome executable.
    }
  }
  throw new Error("No supported local Chrome executable is available.");
}

async function sha256File(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", resolvePromise);
    stream.once("error", reject);
  });
  return hash.digest("hex");
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  await rename(temporary, path);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    delay(2_000).then(() => child.kill("SIGKILL")),
  ]);
}

function relativeLocal(path) {
  return path.slice(REPO_ROOT.length + 1);
}

function parseArgs(args) {
  const parsed = {
    check: false,
    help: false,
    lifecycleSmoke: null,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    url: null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--check") parsed.check = true;
    else if (value === "--help" || value === "-h") parsed.help = true;
    else if (value === "--lifecycle-smoke") {
      const country = requireArg(args[++index], value);
      if (!new Set(["argentina", "spain"]).has(country)) {
        throw new Error("--lifecycle-smoke must be argentina or spain.");
      }
      parsed.lifecycleSmoke = country;
    }
    else if (value === "--url") parsed.url = new URL(requireArg(args[++index], value)).href;
    else if (value === "--port") parsed.port = positiveInteger(requireArg(args[++index], value), value);
    else if (value === "--timeout-ms") parsed.timeoutMs = positiveInteger(requireArg(args[++index], value), value);
    else if (value === "--output-root") parsed.outputRoot = resolve(REPO_ROOT, requireArg(args[++index], value));
    else throw new Error(`Unknown option ${value}.`);
  }
  return parsed;
}

function requireArg(value, flag) {
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function positiveInteger(value, flag) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error(`${flag} must be a positive integer.`);
  return result;
}

function printHelp() {
  console.log(`Usage: node tools/capture-free-play-parity.mjs --check [options]\n\nOptions:\n  --url <url>           Use an existing css.soccer server\n  --port <number>       Vite port when starting a local server (default: ${DEFAULT_PORT})\n  --timeout-ms <number> Browser/server timeout (default: ${DEFAULT_TIMEOUT_MS})\n  --output-root <path>  Ignored local capture root\n  --lifecycle-smoke <country>  Run only one country lifecycle smoke\n`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

await main();

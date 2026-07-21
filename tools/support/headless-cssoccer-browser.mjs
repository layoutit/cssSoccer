import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const CSSOCCER_REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const CHROME_CANDIDATES = Object.freeze([
  process.env.CSSOCCER_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
].filter(Boolean));

export async function withHeadlessCssoccerBrowser({
  port,
  timeoutMs = 240_000,
  viewport = { width: 1440, height: 900 },
  coarsePointer = false,
  disableLiveScheduler = false,
  controlCountry = "argentina",
} = {}, callback) {
  requirePort(port);
  if (!["spain", "argentina"].includes(controlCountry)) {
    throw new Error("Headless css.soccer control country must be spain or argentina.");
  }
  if (typeof callback !== "function") throw new TypeError("Headless css.soccer callback is required.");
  const target = `http://127.0.0.1:${port}/`;
  let server = null;
  let chrome = null;
  let profile = null;
  let cdp = null;
  try {
    server = await startVite(port, timeoutMs);
    await waitForHttp(target, timeoutMs);
    profile = await mkdtemp(join(tmpdir(), "cssoccer-alpha-"));
    const executable = await resolveChromeExecutable();
    const launched = await launchChrome(executable, profile, timeoutMs);
    chrome = launched.process;
    cdp = await CdpClient.connect(launched.webSocketUrl, timeoutMs);
    const version = await cdp.send("Browser.getVersion");
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const pageErrors = [];
    const requestUrls = [];
    const removers = [];
    const onSession = (method, listener) => {
      removers.push(cdp.on(method, (params, message) => {
        if (message.sessionId === sessionId) listener(params);
      }));
    };
    onSession("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      pageErrors.push(
        exceptionDetails?.exception?.description
          || exceptionDetails?.text
          || "page exception",
      );
    });
    onSession("Runtime.consoleAPICalled", ({ type, args }) => {
      if (type !== "error" && type !== "assert") return;
      pageErrors.push(args?.map(({ value, description }) => (
        value ?? description ?? ""
      )).join(" ") || type);
    });
    onSession("Log.entryAdded", ({ entry }) => {
      if (entry?.level === "error") pageErrors.push(entry.text || "browser log error");
    });
    onSession("Network.requestWillBeSent", ({ request }) => {
      if (request?.url) requestUrls.push(request.url);
    });
    onSession("Network.loadingFailed", ({ requestId, errorText, canceled }) => {
      if (!canceled) pageErrors.push(`network ${requestId}: ${errorText}`);
    });
    onSession("Network.responseReceived", ({ response }) => {
      if (response?.status >= 400) pageErrors.push(`HTTP ${response.status}: ${response.url}`);
    });
    await Promise.all([
      cdp.send("Page.enable", {}, sessionId),
      cdp.send("Runtime.enable", {}, sessionId),
      cdp.send("Network.enable", {}, sessionId),
      cdp.send("Log.enable", {}, sessionId),
      cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      }, sessionId),
    ]);
    if (coarsePointer) {
      await cdp.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 5,
      }, sessionId);
    }
    const globals = [
      ...(disableLiveScheduler
        ? [`Object.defineProperty(globalThis, "__cssoccerDisableLiveScheduler", { configurable: false, enumerable: false, writable: false, value: true });`]
        : []),
    ].join(" ");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: globals }, sessionId);
    await cdp.send("Page.navigate", { url: target }, sessionId);
    const choosing = await waitForDebug(cdp, sessionId, timeoutMs, (value) => (
      value?.status === "choosing-country" || value?.status === "error"
    ));
    if (choosing?.status !== "choosing-country" || choosing.pageErrorCount !== 0) {
      throw new Error(`Canonical team selector failed integrity: ${JSON.stringify(choosing)}`);
    }
    const selected = await evaluate(cdp, sessionId, `(() => {
      const button = document.querySelector(${JSON.stringify(
        `[data-country-choice="${controlCountry}"]`,
      )});
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (selected !== true) throw new Error(`Could not select ${controlCountry} through the product UI.`);
    const inspected = await waitForDebug(cdp, sessionId, timeoutMs, (value) => (
      value?.ready === true || value?.status === "error"
    ));
    if (inspected?.status === "error") {
      const productError = await evaluate(
        cdp,
        sessionId,
        "document.body.dataset.portError ?? null",
      );
      if (productError) pageErrors.push(productError);
    }
    assertCanonicalReady(inspected, pageErrors, requestUrls, controlCountry);
    const context = Object.freeze({
      browser: Object.freeze({
        product: version.product,
        userAgent: version.userAgent,
        executable,
        headless: true,
        captureTransport: "playwright-compatible-cdp-clip",
      }),
      coarsePointer,
      controlCountry,
      pageErrors,
      requestUrls,
      target,
      viewport: Object.freeze({ ...viewport }),
      evaluate: (expression, options = {}) => evaluate(
        cdp,
        sessionId,
        expression,
        options,
      ),
      screenshot: async (path, {
        explicitClip = true,
        fromSurface = true,
      } = {}) => {
        const { visualViewport } = await cdp.send("Page.getLayoutMetrics", {}, sessionId);
        const clip = {
          x: visualViewport.pageX,
          y: visualViewport.pageY,
          width: Math.ceil(viewport.width / visualViewport.scale),
          height: Math.ceil(viewport.height / visualViewport.scale),
          scale: visualViewport.scale,
        };
        const result = await cdp.send("Page.captureScreenshot", {
          format: "png",
          fromSurface,
          ...(explicitClip ? { clip, captureBeyondViewport: false } : {}),
        }, sessionId);
        const bytes = Buffer.from(result.data, "base64");
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
        return Object.freeze({
          path,
          bytes: bytes.length,
          sha256: sha256(bytes),
          data: result.data,
          capture: Object.freeze({ explicitClip, fromSurface, visualViewport }),
        });
      },
    });
    try {
      return await callback(context);
    } finally {
      for (const remove of removers.splice(0)) remove();
      await cdp.send("Target.closeTarget", { targetId }).catch(() => undefined);
    }
  } finally {
    cdp?.close();
    await stopProcess(chrome);
    await stopProcess(server);
    if (profile) await rm(profile, { recursive: true, force: true });
  }
}

export async function atomicWriteJson(path, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, bytes);
  await rename(temporary, path);
  return Object.freeze({ path, bytes: bytes.length, sha256: sha256(bytes) });
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  static async connect(url, timeoutMs) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Chrome DevTools.")), timeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
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
    socket.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) reject(new Error("Chrome DevTools closed."));
      this.pending.clear();
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({
        id,
        params,
        method,
        ...(sessionId ? { sessionId } : {}),
      }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
    return () => listeners.delete(listener);
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
    for (const listener of this.listeners.get(message.method) ?? []) {
      listener(message.params ?? {}, message);
    }
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(cdp, sessionId, expression, { awaitPromise = false } = {}) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description
        || result.exceptionDetails.text
        || "Browser evaluation failed.",
    );
  }
  return result.result?.value;
}

async function waitForDebug(cdp, sessionId, timeoutMs, predicate) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(cdp, sessionId, "window.__cssoccerDebug?.inspect?.() ?? null");
      if (predicate(last)) return last;
    } catch (error) {
      last = error;
    }
    await delay(75);
  }
  throw new Error(`Timed out waiting for css.soccer debug state: ${String(last)}`);
}

function assertCanonicalReady(inspected, pageErrors, requestUrls, controlCountry) {
  if (
    inspected?.ready !== true
    || inspected.status !== "ready"
    || inspected.fixtureId !== "spain-argentina-full-match"
    || inspected.controlCountry !== controlCountry
    || inspected.pageErrorCount !== 0
    || inspected.mount?.rootCount !== 37
    || inspected.mount.skyBackdropRootCount !== 1
    || inspected.mount.playerRootCount !== 22
    || inspected.mount.officialRootCount !== 3
    || inspected.mount.exactOfficialRootCount !== 3
    || inspected.mount.stableIdentityCount !== 37
    || inspected.mount.connectedRootCount !== 37
  ) {
    throw new Error(`Canonical Full Match Alpha route failed integrity: ${JSON.stringify({
      inspected,
      pageErrors,
    })}`);
  }
  if (
    inspected.requests?.nativeRequestCount !== 0
    || inspected.requests?.sourceRequestCount !== 0
    || inspected.requests?.rejectedRequestCount !== 0
  ) {
    throw new Error(`Canonical route requested forbidden data: ${JSON.stringify(inspected.requests)}`);
  }
  if (Object.values(inspected.mount.runtimeConstruction ?? {}).some((count) => count !== 0)) {
    throw new Error(`Canonical route performed runtime construction: ${JSON.stringify(inspected.mount.runtimeConstruction)}`);
  }
  const forbidden = requestUrls.filter((url) => (
    /(?:\/\.local\/|\/source\/|\/native\/|\/oracle\/|\.(?:exe|dll|lib|dat|obj|off)(?:[?#]|$))/iu.test(url)
  ));
  if (pageErrors.length > 0 || forbidden.length > 0) {
    throw new Error(`Canonical route browser integrity failed: ${JSON.stringify({ pageErrors, forbidden })}`);
  }
}

async function startVite(port, timeoutMs) {
  const executable = join(CSSOCCER_REPO_ROOT, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [
    executable,
    "--host", "127.0.0.1",
    "--port", String(port),
    "--strictPort",
  ], {
    cwd: CSSOCCER_REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const errors = [];
  child.stderr.on("data", (chunk) => errors.push(chunk.toString("utf8")));
  child.stdout.on("data", () => undefined);
  child.once("exit", (code) => {
    if (code !== null && code !== 0) errors.push(`Vite exited ${code}`);
  });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, timeoutMs);
  } catch (error) {
    await stopProcess(child);
    throw new Error(`Could not start css.soccer Vite:\n${errors.join("")}`, { cause: error });
  }
  return child;
}

async function launchChrome(executable, profilePath, timeoutMs) {
  const child = spawn(executable, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const webSocketUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out starting headless Chrome.")), timeoutMs);
    let output = "";
    const finish = (value, error) => {
      clearTimeout(timer);
      child.stderr.off("data", onData);
      child.off("exit", onExit);
      child.stderr.resume();
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      output += chunk.toString("utf8");
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/u);
      if (match) finish(match[1]);
    };
    const onExit = (code) => finish(null, new Error(`Chrome exited ${code}: ${output}`));
    child.stderr.on("data", onData);
    child.once("exit", onExit);
  });
  return { process: child, webSocketUrl };
}

async function resolveChromeExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to the next declared real Chrome target.
    }
  }
  throw new Error("Google Chrome is unavailable. Set CSSOCCER_CHROME_PATH.");
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error;
    }
    await delay(75);
  }
  throw new Error(`Timed out waiting for ${url}: ${String(last)}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    delay(2_000).then(() => false),
  ]);
  if (!exited && child.exitCode === null) child.kill("SIGKILL");
}

function requirePort(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) {
    throw new TypeError("Headless css.soccer port must be a valid TCP port.");
  }
}

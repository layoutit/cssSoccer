#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  CSSOCCER_REPO_ROOT,
  atomicWriteJson,
  sha256,
  withHeadlessCssoccerBrowser,
} from "./support/headless-cssoccer-browser.mjs";

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log("Usage: node tools/capture-exact-player-evidence.mjs --check");
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
    ".local/cssoccer/exact-player-evidence/runs",
    runId,
  );
  const browserEvidence = await withHeadlessCssoccerBrowser({
    port: 5216,
    timeoutMs: 420_000,
    viewport: { width: 1440, height: 900 },
    controlCountry: "argentina",
  }, async (browser) => {
    const coverageEnvelope = await browser.evaluate(
      "(" + runCoverageInBrowser.toString() + ")()",
      { awaitPromise: true },
    );
    const captures = [];
    for (const plan of visualPlans()) {
      const visual = await browser.evaluate(
        "(" + prepareVisualInBrowser.toString() + ")(" + JSON.stringify(plan) + ")",
        { awaitPromise: true },
      );
      const screenshot = await browser.screenshot(join(runRoot, plan.id + ".png"));
      captures.push({
        ...plan,
        visual,
        path: relative(CSSOCCER_REPO_ROOT, screenshot.path),
        bytes: screenshot.bytes,
        sha256: screenshot.sha256,
        data: screenshot.data,
      });
    }
    const finalInspect = await browser.evaluate("window.__cssoccerDebug.inspect()");
    return {
      browser: browser.browser,
      target: browser.target,
      controlCountry: browser.controlCountry,
      coverageEnvelope,
      captures,
      finalInspect,
      pageErrors: [...browser.pageErrors],
      forbiddenRequests: browser.requestUrls.filter((url) => (
        /(?:\/\.local\/|\/source\/|\/native\/|\/oracle\/|\.(?:exe|dll|lib|dat|obj|off)(?:[?#]|$))/iu.test(url)
      )),
    };
  });

  const contactSheets = await writeContactSheets(runRoot, browserEvidence.captures);
  const captures = browserEvidence.captures.map(({ data: _data, ...capture }) => capture);
  const report = {
    schema: "cssoccer-exact-player-canonical-evidence@1",
    status: "pass",
    generatedAt,
    runId,
    route: {
      url: browserEvidence.target,
      canonical: true,
      fixtureId: browserEvidence.finalInspect.fixtureId,
      controlCountry: browserEvidence.controlCountry,
      renderer: "mounted canonical exact-player roots",
      secondRenderer: false,
    },
    browser: browserEvidence.browser,
    coverage: browserEvidence.coverageEnvelope.coverage,
    mutations: browserEvidence.coverageEnvelope.childListMutations,
    captures,
    contactSheets,
    integrity: {
      pageErrors: browserEvidence.pageErrors,
      debugPageErrorCount: browserEvidence.finalInspect.pageErrorCount,
      requests: browserEvidence.finalInspect.requests,
      forbiddenRequests: browserEvidence.forbiddenRequests,
      mount: browserEvidence.finalInspect.mount,
    },
  };
  assertEvidence(report);
  const retained = await atomicWriteJson(join(runRoot, "report.json"), report);
  const current = await atomicWriteJson(join(
    CSSOCCER_REPO_ROOT,
    ".local/cssoccer/exact-player-evidence/current.json",
  ), report);
  console.log(JSON.stringify({
    status: "pass",
    report: relative(CSSOCCER_REPO_ROOT, current.path),
    retainedReport: relative(CSSOCCER_REPO_ROOT, retained.path),
    reportSha256: current.sha256,
    coverage: {
      states: report.coverage.appliedStates,
      faceStates: report.coverage.appliedFaceStates,
      keySha256: report.coverage.appliedKeySha256,
      chunks: report.coverage.chunks,
      cache: report.coverage.cache,
    },
    captures: captures.map((capture) => ({
      id: capture.id,
      country: capture.country,
      action: capture.action,
      view: capture.view,
      path: capture.path,
      sha256: capture.sha256,
    })),
    contactSheets,
  }, null, 2));
}

async function runCoverageInBrowser() {
  if (!window.__cssoccerDebug.inspect().input.paused) {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Escape",
    }));
  }
  const deadline = performance.now() + 2_000;
  while (!window.__cssoccerDebug.inspect().input.paused) {
    if (performance.now() > deadline) throw new Error("Could not pause exact coverage.");
    await new Promise((resolvePromise) => requestAnimationFrame(resolvePromise));
  }
  const mutation = { records: 0, added: 0, removed: 0 };
  const observer = new MutationObserver((records) => {
    mutation.records += records.length;
    for (const record of records) {
      mutation.added += record.addedNodes.length;
      mutation.removed += record.removedNodes.length;
    }
  });
  observer.observe(document.getElementById("scene"), {
    childList: true,
    subtree: true,
  });
  const coverage = await window.__cssoccerDebug.auditExactPlayerCoverage();
  observer.disconnect();
  return {
    coverage,
    childListMutations: mutation,
    inspect: window.__cssoccerDebug.inspect(),
  };
}

async function prepareVisualInBrowser(plan) {
  const exactState = {
    slotId: plan.slotId,
    localFrameIndex: plan.localFrameIndex,
    yawIndex: plan.yawIndex,
  };
  const applied = await window.__cssoccerDebug.setExactPlayerEvidenceState(
    plan.rootId,
    exactState,
  );
  const roots = [...document.querySelectorAll(
    "[data-cssoccer-kind=player].cssoccer-exact-player-screen-root",
  )];
  for (const rootEntry of roots) {
    rootEntry.hidden = rootEntry.id !== "cssoccer-root-" + plan.rootId;
    rootEntry.style.zIndex = rootEntry.id === "cssoccer-root-" + plan.rootId ? "1000" : "";
  }
  const root = document.getElementById("cssoccer-root-" + plan.rootId);
  root.hidden = false;
  root.style.transform = "translate3d(400px,210px,0) scale(1)";
  root.style.transformOrigin = "0 0";
  document.activeElement?.blur?.();
  await document.fonts.ready;
  await new Promise((resolvePromise) => requestAnimationFrame(() => (
    requestAnimationFrame(resolvePromise)
  )));
  const leaves = [...root.querySelectorAll(
    ".cssoccer-exact-player-model > [data-cssoccer-exact-face-index]",
  )];
  const visibleLeaves = leaves.filter((leaf) => (
    getComputedStyle(leaf).visibility !== "hidden"
  ));
  const numberLeaf = leaves.find((leaf) => (
    leaf.dataset.cssoccerExactFaceIndex === "12"
  ));
  const textureStyles = leaves.map((leaf) => {
    const style = getComputedStyle(leaf);
    return {
      connected: leaf.isConnected,
      visibility: style.visibility,
      width: style.width,
      height: style.height,
      backgroundImage: style.backgroundImage,
      transform: style.transform,
    };
  });
  const active = document.activeElement;
  return {
    applied,
    route: location.pathname + location.search,
    rootId: plan.rootId,
    country: plan.country,
    action: plan.action,
    view: plan.view,
    state: exactState,
    leafCount: leaves.length,
    connectedLeafCount: leaves.filter((leaf) => leaf.isConnected).length,
    visibleLeafCount: visibleLeaves.length,
    uniqueVisibleTransforms: new Set(
      visibleLeaves.map((leaf) => getComputedStyle(leaf).transform),
    ).size,
    texturePathValid: textureStyles.every(({ backgroundImage }) => (
      backgroundImage.includes(
        "/cssoccer/assets/textures/spain-argentina-exact-player-materials.png"
      )
    )),
    rasterValid: textureStyles.every(({ width, height }) => (
      width === "32px" && height === "64px"
    )),
    number: numberLeaf === undefined ? null : {
      visibility: getComputedStyle(numberLeaf).visibility,
      backgroundPositionX: getComputedStyle(numberLeaf).backgroundPositionX,
      backgroundPositionY: getComputedStyle(numberLeaf).backgroundPositionY,
      transform: getComputedStyle(numberLeaf).transform,
    },
    focusVisible: active?.matches?.(":focus-visible") === true,
    bodyOutline: getComputedStyle(document.body).outlineStyle,
    pageErrorCount: window.__cssoccerDebug.inspect().pageErrorCount,
  };
}

function visualPlans() {
  const states = [
    { action: "stand", slotId: 78, localFrameIndex: 19, view: "front", yawIndex: 0 },
    { action: "run", slotId: 72, localFrameIndex: 13, view: "side", yawIndex: 6 },
    { action: "shoot", slotId: 34, localFrameIndex: 18, view: "back", yawIndex: 12 },
    { action: "sliding-tackle", slotId: 85, localFrameIndex: 49, view: "diagonal", yawIndex: 21 },
  ];
  return ["spain", "argentina"].flatMap((country) => states.map((state) => ({
    id: country + "-" + state.action + "-" + state.view,
    country,
    rootId: country + "-player-10",
    ...state,
  })));
}

async function writeContactSheets(root, captures) {
  const settings = { columns: 2, cellWidth: 720, cellHeight: 450 };
  const combined = await writeContactSheet(
    root,
    "both-teams-contact-sheet.svg",
    captures,
    settings,
  );
  const teams = {};
  for (const country of ["spain", "argentina"]) {
    teams[country] = await writeContactSheet(
      root,
      country + "-contact-sheet.svg",
      captures.filter((capture) => capture.country === country),
      settings,
    );
  }
  return { combined, teams };
}

async function writeContactSheet(root, filename, captures, settings) {
  const rows = Math.ceil(captures.length / settings.columns);
  const width = settings.columns * settings.cellWidth;
  const height = rows * settings.cellHeight;
  const cells = captures.map((capture, index) => {
    const x = (index % settings.columns) * settings.cellWidth;
    const y = Math.floor(index / settings.columns) * settings.cellHeight;
    const label = capture.country.toUpperCase() + " · "
      + capture.action.toUpperCase() + " · "
      + capture.view.toUpperCase() + " · "
      + capture.slotId + ":" + capture.localFrameIndex + ":" + capture.yawIndex;
    return "<g transform=\"translate(" + x + " " + y + ")\">"
      + "<image width=\"" + settings.cellWidth + "\" height=\"" + settings.cellHeight
      + "\" preserveAspectRatio=\"xMidYMid slice\" href=\"data:image/png;base64,"
      + capture.data + "\"/>"
      + "<rect x=\"12\" y=\"12\" width=\"560\" height=\"30\" rx=\"4\" fill=\"rgba(0,0,0,.78)\"/>"
      + "<text x=\"24\" y=\"33\" fill=\"#fff\" font-family=\"system-ui,sans-serif\""
      + " font-size=\"15\" font-weight=\"700\">" + label + "</text></g>";
  }).join("");
  const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width
    + "\" height=\"" + height + "\" viewBox=\"0 0 " + width + " " + height
    + "\">" + cells + "</svg>\n";
  const path = join(root, filename);
  await mkdir(root, { recursive: true });
  await writeFile(path, svg);
  return {
    path: relative(CSSOCCER_REPO_ROOT, path),
    bytes: Buffer.byteLength(svg),
    sha256: sha256(svg),
    captures: captures.length,
  };
}

function assertEvidence(report) {
  const coverage = report.coverage;
  const rootsEqual = JSON.stringify(coverage.roots.before)
    === JSON.stringify(coverage.roots.after);
  const captureHashes = new Set(report.captures.map(({ sha256: value }) => value));
  const runtimeConstruction = report.integrity.mount?.runtimeConstruction ?? {};
  const capturesInvalid = report.captures.some(({ visual }) => (
    visual.applied !== true
    || visual.leafCount !== 13
    || visual.connectedLeafCount !== 13
    || visual.visibleLeafCount <= 0
    || visual.uniqueVisibleTransforms <= 0
    || visual.texturePathValid !== true
    || visual.rasterValid !== true
    || visual.focusVisible !== false
    || visual.bodyOutline !== "none"
    || visual.pageErrorCount !== 0
  ));
  if (
    report.route.canonical !== true
    || report.route.secondRenderer !== false
    || coverage.status !== "pass"
    || coverage.sequences !== 124
    || coverage.chunks !== 426
    || coverage.requestedStates !== 140_568
    || coverage.appliedStates !== 140_568
    || coverage.appliedFaceStates !== 1_827_384
    || coverage.firstKey !== "0:0:0"
    || coverage.lastKey !== "130:27:23"
    || coverage.exactKeyMatch !== true
    || coverage.runtimeDelta.sampleApplyCount !== 140_568
    || coverage.runtimeDelta.loadFailureCount !== 0
    || coverage.runtimeDelta.unavailableStateCount !== 0
    || coverage.runtimeDelta.fallbackStateCount !== 0
    || coverage.cache.entries > coverage.cache.limit
    || coverage.cache.limit !== 24
    || coverage.cache.pendingLoads !== 0
    || !rootsEqual
    || report.mutations.records !== 0
    || report.mutations.added !== 0
    || report.mutations.removed !== 0
    || report.captures.length !== 8
    || captureHashes.size !== report.captures.length
    || capturesInvalid
    || report.contactSheets.combined.captures !== 8
    || Object.values(report.contactSheets.teams).some(({ captures }) => captures !== 4)
    || report.integrity.pageErrors.length !== 0
    || report.integrity.debugPageErrorCount !== 0
    || report.integrity.forbiddenRequests.length !== 0
    || report.integrity.requests.nativeRequestCount !== 0
    || report.integrity.requests.sourceRequestCount !== 0
    || report.integrity.requests.rejectedRequestCount !== 0
    || report.integrity.mount.rootCount !== 37
    || report.integrity.mount.skyBackdropRootCount !== 1
    || report.integrity.mount.playerRootCount !== 22
    || report.integrity.mount.officialRootCount !== 3
    || report.integrity.mount.exactOfficialRootCount !== 3
    || report.integrity.mount.connectedRootCount !== 37
    || report.integrity.mount.stableIdentityCount !== 37
    || report.integrity.mount.detachedLeafCount !== 0
    || Object.values(runtimeConstruction).some((count) => count !== 0)
  ) {
    report.status = "fail";
    throw new Error("Exact player canonical evidence failed: " + JSON.stringify(report));
  }
}

function parseArgs(args) {
  const output = { check: false, help: false };
  for (const argument of args) {
    if (argument === "--check") output.check = true;
    else if (argument === "--help" || argument === "-h") output.help = true;
    else throw new Error("Unknown exact-player evidence option " + argument + ".");
  }
  if (!output.help && output.check !== true) {
    throw new Error("--check is required for exact-player release evidence.");
  }
  return output;
}

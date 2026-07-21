import assert from "node:assert/strict";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import {
  ENGINE_INDEPENDENCE_SCHEMA,
  PARITY_STREAM_SCHEMA,
  engineIndependenceSubjectSha256,
  parityContractSha256,
  parseParityJsonl,
  sha256Hex,
} from "../src/parity/io.mjs";
import { compareNativeParity } from "../src/parity/nativeParity.mjs";
import { buildDifferentialBundle } from "../src/parity/differentialBundle.mjs";
import {
  VISUAL_CAPTURE_PROFILE_SCHEMA,
  VISUAL_DOMAINS,
  VISUAL_WINDOWS,
  buildVisualCaptureManifest,
  buildVisualParityBundle,
  buildVisualParityData,
  calibrateVisualSourceAA,
  compareVisualCaptures,
  publishVisualParityBundleAtomic,
} from "../src/parity/visualParity.mjs";
import { main as captureNativeFrames, parseCaptureArguments } from "../tools/capture-native-frames.mjs";
import { main as captureBrowserFrames } from "../tools/capture-browser-frames.mjs";
import { parseArguments as parsePublishArguments, readDifferentialTestingData } from "../tools/publish-visual-parity.mjs";

const GENERATED_AT = "2026-07-17T12:00:00.000Z";
const QUALIFIED_AT = "2026-07-17T11:59:00.000Z";
const scenarioSha256 = sha256Hex("synthetic cssoccer visual scenario");
const profileSha256 = sha256Hex("synthetic cssoccer capture profile");
const inputSha256 = sha256Hex("synthetic cssoccer input stream");
const phases = Object.freeze([{ id: "state", order: 0 }]);
const fields = Object.freeze([{
  id: "match.clock",
  label: "Match clock",
  sourceOwner: "synthetic fixture",
  meaning: "Synthetic exact state link for visual transport tests.",
  unit: "tick",
  valueType: "i32",
}]);
const contractSha256 = parityContractSha256({ phases, fields });
const referenceSourceSha256 = sha256Hex("synthetic native source");
const referenceBuildSha256 = sha256Hex("synthetic native build");
const candidateSourceSha256 = sha256Hex("synthetic browser source");
const candidateBuildSha256 = sha256Hex("synthetic browser build");

test("capture manifests enforce count, dimensions, profile identity, and lead-frame alignment", () => {
  const root = mkdtempSync(join(tmpdir(), "cssoccer-visual-structure-"));
  try {
    const profile = visualProfile();
    const completeRoot = join(root, "complete");
    const nativeA = buildCapture(completeRoot, profile, "native-a");

    const missingRoot = join(root, "missing");
    makeFrameTree(missingRoot, profile, { omit: { domainId: "ball", ordinal: 4 } });
    assert.throws(
      () => captureManifest(missingRoot, profile, "native-b"),
      /must contain exactly 5 numbered frames/u,
    );

    const dimensionRoot = join(root, "dimension");
    makeFrameTree(dimensionRoot, profile, { dimensionDrift: { domainId: "hud", ordinal: 3 } });
    assert.throws(
      () => captureManifest(dimensionRoot, profile, "browser"),
      /must be 2x2/u,
    );

    const changedProfile = structuredClone(profile);
    changedProfile.framePlan[3].tick += 1;
    const profileRoot = join(root, "profile");
    const browserProfileDrift = buildCapture(profileRoot, changedProfile, "browser");
    assert.throws(
      () => compareVisualCaptures({
        reference: nativeA,
        candidate: browserProfileDrift,
        calibration: calibrateVisualSourceAA(nativeA, buildCapture(join(root, "native-b"), profile, "native-b")),
      }),
      /capture profile hashes differ/u,
    );

    const leadRoot = join(root, "lead");
    const browserLeadDrift = buildCapture(leadRoot, profile, "browser", { holdLeadFrame: true });
    assert.throws(
      () => compareVisualCaptures({
        reference: nativeA,
        candidate: browserLeadDrift,
        calibration: calibrateVisualSourceAA(nativeA, buildCapture(join(root, "native-b-2"), profile, "native-b")),
      }),
      /lead-frame motion begins at different ordinals/u,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source A/A calibration and isolated full-match windows satisfy the installed Visual Parity contract", async () => {
  const root = mkdtempSync(join(tmpdir(), "cssoccer-visual-pass-"));
  try {
    const fixture = makeFixture(root);
    assert.equal(fixture.calibration.status, "pass");
    for (const domain of fixture.calibration.domains) {
      assert.deepEqual(
        {
          channelDelta: domain.tolerance.channelDelta,
          meanAbsoluteDelta: domain.tolerance.meanAbsoluteDelta,
          changedPixelRatio: domain.tolerance.changedPixelRatio,
        },
        { channelDelta: 0, meanAbsoluteDelta: 0, changedPixelRatio: 0 },
      );
    }
    assert.equal(fixture.report.status, "pass");
    assert.equal(fixture.report.comparisons.length, 5);
    assert.equal(fixture.payload.domains.length, 5);
    assert.equal(fixture.payload.comparisons.every((comparison) => comparison.status === "pass"), true);
    for (const comparison of fixture.payload.comparisons) {
      assert.deepEqual(Object.keys(comparison.domains), VISUAL_DOMAINS.map((domain) => domain.id));
      for (const domain of Object.values(comparison.domains)) {
        assert.match(domain.reference.src, /^data:image\/png;base64,/u);
        assert.match(domain.candidate.src, /^data:image\/png;base64,/u);
        assert.match(domain.diff.src, /^data:image\/png;base64,/u);
      }
    }
    const installed = await installedContract();
    assert.equal(installed.assertVisualParityData(fixture.payload), fixture.payload);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("visual comparison selects the earliest aligned window and domain failure without widening calibration", () => {
  const root = mkdtempSync(join(tmpdir(), "cssoccer-visual-fail-"));
  try {
    const profile = visualProfile();
    const nativeA = buildCapture(join(root, "native-a"), profile, "native-a");
    const nativeB = buildCapture(join(root, "native-b"), profile, "native-b");
    const browser = buildCapture(join(root, "browser"), profile, "browser", {
      mutation: { domainId: "ball", ordinal: 2, pixel: 0, value: 255 },
    });
    const calibration = calibrateVisualSourceAA(nativeA, nativeB);
    const report = compareVisualCaptures({ reference: nativeA, candidate: browser, calibration });
    assert.equal(report.status, "fail");
    assert.deepEqual(report.earliestFailure, {
      frame: 2,
      windowId: "goal-or-set-piece",
      tick: 20,
      domainId: "ball",
      domainLabel: "Ball",
    });
    assert.equal(report.comparisons[2].domains.ball.status, "fail");
    assert.equal(report.comparisons[2].domains.players.status, "pass");
    assert.equal(calibration.domains.find((domain) => domain.id === "ball").tolerance.channelDelta, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("atomic Visual Parity publication validates staged generations and preserves current on rejection", async () => {
  const root = mkdtempSync(join(tmpdir(), "cssoccer-visual-publish-"));
  try {
    const fixture = makeFixture(join(root, "fixture"));
    const contract = await installedContract();
    const bundle = buildVisualParityBundle({
      payload: fixture.payload,
      report: fixture.report,
      calibration: fixture.calibration,
      publishedAt: GENERATED_AT,
    });
    const outputRoot = join(root, "publication");
    const publication = await publishVisualParityBundleAtomic(bundle, outputRoot, {
      validateGeneration: (payloadPath) => contract.assertVisualParityData(JSON.parse(readFileSync(payloadPath, "utf8"))),
    });
    assert.equal(lstatSync(join(outputRoot, "current")).isSymbolicLink(), true);
    assert.equal(contract.assertVisualParityData(JSON.parse(readFileSync(publication.payloadPath, "utf8"))).schema, "burnlist-visual-parity-data@1");
    const retainedGeneration = realpathSync(join(outputRoot, "current"));
    const laterBundle = buildVisualParityBundle({
      payload: fixture.payload,
      report: fixture.report,
      calibration: fixture.calibration,
      publishedAt: "2026-07-17T12:01:00.000Z",
    });
    await assert.rejects(
      publishVisualParityBundleAtomic(laterBundle, outputRoot, {
        validateGeneration: () => { throw new Error("synthetic Visual Parity contract rejection"); },
      }),
      /synthetic Visual Parity contract rejection/u,
    );
    assert.equal(realpathSync(join(outputRoot, "current")), retainedGeneration);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("capture and publisher CLIs have no implicit live Oven publication path", () => {
  assert.throws(
    () => parsePublishArguments([
      "--native-a", "a", "--native-b", "b", "--browser", "c", "--differential-data", "d",
    ], {}),
    /outputRoot is required/u,
  );
  assert.throws(
    () => parseCaptureArguments([
      "--profile", "profile.json", "--output-root", "out", "--role", "native-a",
      "--source-sha256", "0".repeat(64), "--build-sha256", "1".repeat(64),
    ]),
    /Exactly one of --source-root or --command is required/u,
  );
});

test("native and browser capture wrappers package every domain through the frame-sequence workflow", async () => {
  const root = mkdtempSync(join(tmpdir(), "cssoccer-visual-capture-cli-"));
  try {
    const profile = visualProfile();
    const profilePath = join(root, "profile.json");
    writeFileSync(profilePath, `${JSON.stringify(profile)}\n`);
    const sourceRoot = join(root, "source");
    makeFrameTree(root, profile);
    const frameRoot = join(root, "frames");
    const sink = { write() {} };
    const nativeOutput = join(root, "native-output");
    await captureNativeFrames([
      "--profile", profilePath,
      "--source-root", frameRoot,
      "--output-root", nativeOutput,
      "--role", "native-a",
      "--source-sha256", referenceSourceSha256,
      "--build-sha256", referenceBuildSha256,
      "--generated-at", GENERATED_AT,
    ], { stdout: sink });
    const nativeManifest = JSON.parse(readFileSync(join(nativeOutput, "capture.json"), "utf8"));
    assert.equal(nativeManifest.role, "native-a");
    assert.equal(nativeManifest.domains.length, 5);
    assert.equal(nativeManifest.domains.every((domain) => domain.frames.length === 5), true);

    const browserOutput = join(root, "browser-output");
    await captureBrowserFrames([
      "--profile", profilePath,
      "--source-root", frameRoot,
      "--output-root", browserOutput,
      "--source-sha256", candidateSourceSha256,
      "--build-sha256", candidateBuildSha256,
      "--generated-at", GENERATED_AT,
    ], { stdout: sink });
    const browserManifest = JSON.parse(readFileSync(join(browserOutput, "capture.json"), "utf8"));
    assert.equal(browserManifest.role, "browser");
    assert.equal(browserManifest.renderer.mode, "headless");
    assert.equal(browserManifest.captureProfileSha256, nativeManifest.captureProfileSha256);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeFixture(root) {
  const profile = visualProfile();
  const nativeA = buildCapture(join(root, "native-a"), profile, "native-a");
  const nativeB = buildCapture(join(root, "native-b"), profile, "native-b");
  const browser = buildCapture(join(root, "browser"), profile, "browser");
  const calibration = calibrateVisualSourceAA(nativeA, nativeB);
  const report = compareVisualCaptures({ reference: nativeA, candidate: browser, calibration });
  const differentialTesting = passingDifferentialData(join(root, "differential"));
  const payload = buildVisualParityData(report, calibration, differentialTesting);
  return { nativeA, nativeB, browser, calibration, report, differentialTesting, payload };
}

function visualProfile() {
  return {
    schema: VISUAL_CAPTURE_PROFILE_SCHEMA,
    fixtureId: "synthetic-spain-argentina",
    bindings: {
      scenarioId: scenarioSha256.slice(0, 16),
      scenarioSha256,
      profileSha256,
      inputSha256,
      contractSha256,
    },
    dimensions: { width: 2, height: 2 },
    matteRgb: [0, 0, 0],
    leadFrameCount: 2,
    framePlan: VISUAL_WINDOWS.map((window, ordinal) => ({
      ordinal,
      tick: ordinal * 10,
      phase: ordinal === 4 ? "full-time" : "live",
      windowId: window.id,
      label: window.label,
    })),
    domains: VISUAL_DOMAINS.map((domain) => ({ ...domain })),
  };
}

function buildCapture(root, profile, role, options = {}) {
  makeFrameTree(root, profile, options);
  return captureManifest(root, profile, role);
}

function captureManifest(root, profile, role) {
  const domainFrameRoots = Object.fromEntries(profile.domains.map((domain) => [domain.id, join(root, "frames", domain.id)]));
  const browser = role === "browser";
  const manifest = buildVisualCaptureManifest({
    profile,
    role,
    manifestRoot: root,
    domainFrameRoots,
    sourceSha256: browser ? candidateSourceSha256 : referenceSourceSha256,
    buildSha256: browser ? candidateBuildSha256 : referenceBuildSha256,
    renderer: { id: browser ? "synthetic-browser" : "synthetic-native", label: browser ? "Synthetic browser" : "Synthetic native", mode: "headless" },
    generatedAt: GENERATED_AT,
  });
  return { manifest, root };
}

function makeFrameTree(root, profile, {
  omit = null,
  dimensionDrift = null,
  holdLeadFrame = false,
  mutation = null,
} = {}) {
  for (const [domainIndex, domain] of profile.domains.entries()) {
    const directory = join(root, "frames", domain.id);
    mkdirSync(directory, { recursive: true });
    for (const frame of profile.framePlan) {
      if (omit?.domainId === domain.id && omit.ordinal === frame.ordinal) continue;
      const drift = dimensionDrift?.domainId === domain.id && dimensionDrift.ordinal === frame.ordinal;
      const width = drift ? 1 : profile.dimensions.width;
      const height = drift ? 1 : profile.dimensions.height;
      const effectiveOrdinal = holdLeadFrame && frame.ordinal === 1 ? 0 : frame.ordinal;
      const value = 10 + domainIndex * 20 + effectiveOrdinal * 3;
      const pixels = Buffer.alloc(width * height * 3, value);
      if (mutation?.domainId === domain.id && mutation.ordinal === frame.ordinal) pixels[mutation.pixel] = mutation.value;
      writeFileSync(join(directory, `frame_${String(frame.ordinal).padStart(4, "0")}.ppm`), ppm(width, height, pixels));
    }
  }
}

function ppm(width, height, pixels) {
  return Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`, "ascii"), pixels]);
}

function passingDifferentialData(root) {
  const comparison = compareNativeParity(
    parseParityJsonl(makeParityJsonl("reference")),
    parseParityJsonl(makeParityJsonl("candidate")),
  );
  const bundle = buildDifferentialBundle(comparison, {
    publishedAt: GENERATED_AT,
    scenarioLabel: "Synthetic Spain Argentina visual windows",
  });
  for (const file of bundle.files) {
    const path = join(root, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.bytes);
  }
  return readDifferentialTestingData(join(root, "current.json"));
}

function makeParityJsonl(role) {
  const browser = role === "candidate";
  const bindings = {
    scenarioId: scenarioSha256.slice(0, 16),
    scenarioSha256,
    profileSha256,
    inputSha256,
    sourceSha256: browser ? candidateSourceSha256 : referenceSourceSha256,
    buildSha256: browser ? candidateBuildSha256 : referenceBuildSha256,
    contractSha256,
  };
  const header = {
    schema: PARITY_STREAM_SCHEMA,
    recordType: "header",
    role,
    streamId: `${role}-visual-window-state`,
    generatedAt: GENERATED_AT,
    bindings,
    tickRange: { start: 0, count: VISUAL_WINDOWS.length },
    phases,
    fields,
    engineIndependence: browser ? engineIndependence(bindings) : null,
  };
  const records = [header];
  for (let tick = 0; tick < VISUAL_WINDOWS.length; tick += 1) {
    records.push({
      schema: PARITY_STREAM_SCHEMA,
      recordType: "sample",
      tick,
      phase: "state",
      fieldId: "match.clock",
      valueType: "i32",
      value: tick,
      numericBits: tick.toString(16).padStart(8, "0"),
    });
  }
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function engineIndependence(bindings) {
  const metadata = {
    schema: ENGINE_INDEPENDENCE_SCHEMA,
    status: "pass",
    qualifiedAt: QUALIFIED_AT,
    bindings,
    runtimeSnapshotSha256: bindings.buildSha256,
    preparedInputSha256: bindings.inputSha256,
    harnessSha256: sha256Hex("synthetic visual harness"),
    captureAdapterSha256: sha256Hex("synthetic visual capture adapter"),
    check: {
      status: "pass",
      id: "synthetic-visual-engine-independence@1",
      sha256: sha256Hex("synthetic visual checker"),
      subjectSha256: "0".repeat(64),
    },
    blockers: [],
  };
  metadata.check.subjectSha256 = engineIndependenceSubjectSha256(metadata);
  return metadata;
}

async function installedContract() {
  const configured = process.env.BURNLIST_VISUAL_PARITY_CONTRACT;
  const specifier = configured
    ? configured.startsWith("/") || configured.startsWith(".")
      ? pathToFileURL(resolve(configured)).href
      : configured
    : pathToFileURL(fileURLToPath(new URL("../../burnlist/ovens/visual-parity/engine/visual-parity-contract.mjs", import.meta.url))).href;
  return import(specifier);
}

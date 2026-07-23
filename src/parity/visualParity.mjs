import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

import { canonicalJson, sha256Hex } from "./io.mjs";

export const VISUAL_CAPTURE_PROFILE_SCHEMA = "cssoccer-visual-capture-profile@1";
export const VISUAL_CAPTURE_SCHEMA = "cssoccer-visual-capture@1";
export const VISUAL_CALIBRATION_SCHEMA = "cssoccer-visual-source-aa-calibration@1";
export const VISUAL_COMPARISON_SCHEMA = "cssoccer-visual-comparison@1";
export const VISUAL_BUNDLE_FILES_SCHEMA = "cssoccer-visual-parity-bundle-files@1";
export const VISUAL_PARITY_DATA_SCHEMA = "burnlist-visual-parity-data@1";

export const VISUAL_WINDOWS = Object.freeze([
  Object.freeze({ id: "kickoff", label: "Kickoff" }),
  Object.freeze({ id: "open-play", label: "Open play" }),
  Object.freeze({ id: "goal-or-set-piece", label: "Goal or set piece" }),
  Object.freeze({ id: "second-half", label: "Second-half play" }),
  Object.freeze({ id: "full-time", label: "Full time" }),
]);

export const VISUAL_DOMAINS = Object.freeze([
  Object.freeze({ id: "pitch", label: "Pitch", isolation: "render-pass", qualification: "target" }),
  Object.freeze({ id: "players", label: "Players", isolation: "render-pass", qualification: "target" }),
  Object.freeze({ id: "ball", label: "Ball", isolation: "render-pass", qualification: "target" }),
  Object.freeze({ id: "officials", label: "Officials", isolation: "render-pass", qualification: "target" }),
  Object.freeze({ id: "hud", label: "HUD", isolation: "render-pass", qualification: "target" }),
]);

const SHA256 = /^[a-f0-9]{64}$/u;
const SCENARIO_ID = /^[a-f0-9]{16}$/u;
const DOMAIN_ID = /^[a-z][a-z0-9-]*$/u;
const IMAGE_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/u;
const COMMON_BINDINGS = [
  "scenarioId", "scenarioSha256", "profileSha256", "inputSha256", "contractSha256",
];
const FULL_BINDINGS = [...COMMON_BINDINGS, "sourceSha256", "buildSha256"];

export class VisualParityError extends Error {
  constructor(message) {
    super(message);
    this.name = "VisualParityError";
  }
}

export function captureProfileSha256(profile) {
  assertVisualCaptureProfile(profile);
  return sha256Hex(canonicalJson(profile));
}

export function readVisualCaptureProfile(path) {
  const profile = parseJsonFile(path, "visual capture profile");
  assertVisualCaptureProfile(profile);
  return profile;
}

export function assertVisualCaptureProfile(profile, label = "visual capture profile") {
  plainObject(profile, label);
  exactKeys(profile, [
    "schema", "fixtureId", "bindings", "dimensions", "matteRgb", "leadFrameCount", "framePlan", "domains",
  ], label);
  if (profile.schema !== VISUAL_CAPTURE_PROFILE_SCHEMA) fail(`${label}.schema`, `must equal ${VISUAL_CAPTURE_PROFILE_SCHEMA}`);
  text(profile.fixtureId, `${label}.fixtureId`, 160);
  assertCommonBindings(profile.bindings, `${label}.bindings`);
  assertDimensions(profile.dimensions, `${label}.dimensions`);
  assertMatte(profile.matteRgb, `${label}.matteRgb`);
  safeInteger(profile.leadFrameCount, `${label}.leadFrameCount`, 2);
  if (!Array.isArray(profile.framePlan) || profile.framePlan.length < VISUAL_WINDOWS.length) {
    fail(`${label}.framePlan`, `must contain at least ${VISUAL_WINDOWS.length} aligned frames`);
  }
  if (profile.leadFrameCount > profile.framePlan.length) {
    fail(`${label}.leadFrameCount`, "must not exceed framePlan length");
  }
  const windowIds = new Set();
  let previousTick = -1;
  profile.framePlan.forEach((frame, index) => {
    const frameLabel = `${label}.framePlan[${index}]`;
    plainObject(frame, frameLabel);
    exactKeys(frame, ["ordinal", "tick", "phase", "windowId", "label"], frameLabel);
    if (frame.ordinal !== index) fail(`${frameLabel}.ordinal`, `must be contiguous and equal ${index}`);
    safeInteger(frame.tick, `${frameLabel}.tick`, 0);
    if (frame.tick < previousTick) fail(`${frameLabel}.tick`, "must not precede the previous aligned tick");
    previousTick = frame.tick;
    text(frame.phase, `${frameLabel}.phase`, 80);
    text(frame.label, `${frameLabel}.label`, 160);
    if (frame.windowId !== null) {
      if (!VISUAL_WINDOWS.some((window) => window.id === frame.windowId)) {
        fail(`${frameLabel}.windowId`, "uses an unsupported full-match visual window");
      }
      if (windowIds.has(frame.windowId)) fail(`${frameLabel}.windowId`, "must be unique");
      windowIds.add(frame.windowId);
    }
  });
  const missingWindows = VISUAL_WINDOWS.filter((window) => !windowIds.has(window.id)).map((window) => window.id);
  if (missingWindows.length) fail(`${label}.framePlan`, `is missing windows: ${missingWindows.join(", ")}`);
  assertDomainDefinitions(profile.domains, `${label}.domains`);
  return profile;
}

export function buildVisualCaptureManifest({
  profile,
  role,
  manifestRoot,
  domainFrameRoots,
  sourceSha256,
  buildSha256,
  renderer,
  generatedAt = new Date().toISOString(),
}) {
  assertVisualCaptureProfile(profile);
  if (!["native-a", "native-b", "browser"].includes(role)) fail("capture role", "must be native-a, native-b, or browser");
  digest(sourceSha256, "sourceSha256");
  digest(buildSha256, "buildSha256");
  timestamp(generatedAt, "generatedAt");
  assertRenderer(renderer, "renderer");
  const root = resolve(manifestRoot);
  plainObject(domainFrameRoots, "domainFrameRoots");
  const domains = profile.domains.map((domain) => {
    const framesRoot = domainFrameRoots[domain.id];
    if (typeof framesRoot !== "string" || !framesRoot) fail(`domainFrameRoots.${domain.id}`, "must name a frame directory");
    const files = listNumberedFrames(resolve(framesRoot));
    if (files.length !== profile.framePlan.length) {
      fail(`domainFrameRoots.${domain.id}`, `must contain exactly ${profile.framePlan.length} numbered frames; found ${files.length}`);
    }
    const frames = profile.framePlan.map((planned) => {
      const file = files[planned.ordinal];
      if (!file || file.ordinal !== planned.ordinal) {
        fail(`domainFrameRoots.${domain.id}`, `breaks contiguous frame order at ordinal ${planned.ordinal}`);
      }
      const bytes = readFileSync(file.path);
      const image = readRgbImage(bytes, { label: file.path, matteRgb: profile.matteRgb });
      if (image.width !== profile.dimensions.width || image.height !== profile.dimensions.height) {
        fail(file.path, `must be ${profile.dimensions.width}x${profile.dimensions.height}; found ${image.width}x${image.height}`);
      }
      return {
        ...planned,
        path: containedRelativePath(root, file.path),
        sha256: sha256Hex(bytes),
        width: image.width,
        height: image.height,
      };
    });
    return {
      ...domain,
      frames,
      leadAnalysis: leadFrameAnalysis(frames, root, profile.leadFrameCount, profile.matteRgb),
    };
  });
  const captureProfile = captureProfileSha256(profile);
  const bindings = { ...profile.bindings, sourceSha256, buildSha256 };
  const identity = {
    role,
    renderer,
    bindings,
    captureProfileSha256: captureProfile,
    frames: domains.flatMap((domain) => domain.frames.map((frame) => ({
      domainId: domain.id,
      ordinal: frame.ordinal,
      sha256: frame.sha256,
    }))),
  };
  const captureId = sha256Hex(canonicalJson(identity)).slice(0, 24);
  const manifest = {
    schema: VISUAL_CAPTURE_SCHEMA,
    role,
    captureId,
    generatedAt,
    renderer: structuredClone(renderer),
    bindings,
    captureProfileSha256: captureProfile,
    dimensions: structuredClone(profile.dimensions),
    matteRgb: [...profile.matteRgb],
    leadFrameCount: profile.leadFrameCount,
    framePlan: structuredClone(profile.framePlan),
    domains,
  };
  const completed = { ...manifest, artifactSha256: sha256Hex(canonicalJson(manifest)) };
  assertVisualCaptureManifest(completed, { root });
  return completed;
}

export function writeVisualCaptureManifest(path, manifest) {
  const root = dirname(resolve(path));
  assertVisualCaptureManifest(manifest, { root });
  writeFileSync(path, `${canonicalJson(manifest)}\n`, { flag: "wx", mode: 0o644 });
  return path;
}

export function readVisualCaptureManifest(path) {
  const resolved = resolve(path);
  const manifest = parseJsonFile(resolved, "visual capture manifest");
  assertVisualCaptureManifest(manifest, { root: dirname(resolved) });
  return { manifest, root: dirname(resolved), path: resolved };
}

export function assertVisualCaptureManifest(manifest, { root = null, label = "visual capture manifest" } = {}) {
  plainObject(manifest, label);
  exactKeys(manifest, [
    "schema", "role", "captureId", "generatedAt", "renderer", "bindings", "captureProfileSha256",
    "dimensions", "matteRgb", "leadFrameCount", "framePlan", "domains", "artifactSha256",
  ], label);
  if (manifest.schema !== VISUAL_CAPTURE_SCHEMA) fail(`${label}.schema`, `must equal ${VISUAL_CAPTURE_SCHEMA}`);
  if (!["native-a", "native-b", "browser"].includes(manifest.role)) fail(`${label}.role`, "is unsupported");
  if (typeof manifest.captureId !== "string" || !/^[a-f0-9]{24}$/u.test(manifest.captureId)) fail(`${label}.captureId`, "must be a 24-character digest prefix");
  timestamp(manifest.generatedAt, `${label}.generatedAt`);
  assertRenderer(manifest.renderer, `${label}.renderer`);
  assertFullBindings(manifest.bindings, `${label}.bindings`);
  digest(manifest.captureProfileSha256, `${label}.captureProfileSha256`);
  assertDimensions(manifest.dimensions, `${label}.dimensions`);
  assertMatte(manifest.matteRgb, `${label}.matteRgb`);
  safeInteger(manifest.leadFrameCount, `${label}.leadFrameCount`, 2);
  if (!Array.isArray(manifest.framePlan) || manifest.framePlan.length < VISUAL_WINDOWS.length) fail(`${label}.framePlan`, "is incomplete");
  const syntheticProfile = {
    schema: VISUAL_CAPTURE_PROFILE_SCHEMA,
    fixtureId: "capture-manifest-validation",
    bindings: Object.fromEntries(COMMON_BINDINGS.map((key) => [key, manifest.bindings[key]])),
    dimensions: manifest.dimensions,
    matteRgb: manifest.matteRgb,
    leadFrameCount: manifest.leadFrameCount,
    framePlan: manifest.framePlan,
    domains: manifest.domains.map((domain) => ({
      id: domain?.id,
      label: domain?.label,
      isolation: domain?.isolation,
      qualification: domain?.qualification,
    })),
  };
  assertVisualCaptureProfile(syntheticProfile, `${label}.profileProjection`);
  if (!Array.isArray(manifest.domains) || manifest.domains.length !== VISUAL_DOMAINS.length) fail(`${label}.domains`, "is incomplete");
  manifest.domains.forEach((domain, domainIndex) => {
    const domainLabel = `${label}.domains[${domainIndex}]`;
    exactKeys(domain, ["id", "label", "isolation", "qualification", "frames", "leadAnalysis"], domainLabel);
    if (!Array.isArray(domain.frames) || domain.frames.length !== manifest.framePlan.length) fail(`${domainLabel}.frames`, "must match framePlan length");
    domain.frames.forEach((frame, index) => {
      const frameLabel = `${domainLabel}.frames[${index}]`;
      exactKeys(frame, ["ordinal", "tick", "phase", "windowId", "label", "path", "sha256", "width", "height"], frameLabel);
      if (canonicalJson(Object.fromEntries(["ordinal", "tick", "phase", "windowId", "label"].map((key) => [key, frame[key]])))
        !== canonicalJson(manifest.framePlan[index])) fail(frameLabel, "must retain the aligned frame plan");
      relativeFile(frame.path, `${frameLabel}.path`);
      digest(frame.sha256, `${frameLabel}.sha256`);
      if (frame.width !== manifest.dimensions.width || frame.height !== manifest.dimensions.height) fail(frameLabel, "dimensions drift from the capture profile");
      if (root !== null) {
        const path = containedPath(resolve(root), frame.path);
        if (!existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) fail(path, "must be a real captured frame file");
        const bytes = readFileSync(path);
        if (sha256Hex(bytes) !== frame.sha256) fail(path, "does not match its recorded frame hash");
        const image = readRgbImage(bytes, { label: path, matteRgb: manifest.matteRgb });
        if (image.width !== frame.width || image.height !== frame.height) fail(path, "decoded dimensions drift from the manifest");
      }
    });
    assertLeadAnalysis(domain.leadAnalysis, manifest.leadFrameCount, `${domainLabel}.leadAnalysis`);
  });
  digest(manifest.artifactSha256, `${label}.artifactSha256`);
  const { artifactSha256, ...identity } = manifest;
  if (sha256Hex(canonicalJson(identity)) !== artifactSha256) fail(`${label}.artifactSha256`, "does not bind the capture manifest");
  return manifest;
}

export function calibrateVisualSourceAA(captureAInput, captureBInput) {
  const captureA = normalizeCaptureInput(captureAInput, "native A capture");
  const captureB = normalizeCaptureInput(captureBInput, "native B capture");
  if (captureA.manifest.role !== "native-a" || captureB.manifest.role !== "native-b") {
    fail("source A/A calibration", "requires native-a and native-b captures");
  }
  assertAlignedCaptures(captureA.manifest, captureB.manifest, {
    label: "source A/A calibration",
    requireSourceAndBuild: true,
    requireLeadMotionAlignment: true,
  });
  const domains = captureA.manifest.domains.map((domainA) => {
    const domainB = domainById(captureB.manifest, domainA.id);
    const samples = domainA.frames.map((frameA, index) => {
      const frameB = domainB.frames[index];
      const reference = readManifestFrame(captureA, frameA);
      const candidate = readManifestFrame(captureB, frameB);
      return { ordinal: frameA.ordinal, ...compareRgbImages(reference, candidate, 0) };
    });
    const maximumAbsoluteDelta = Math.max(...samples.map((sample) => sample.maximumAbsoluteDelta));
    const meanAbsoluteDelta = Math.max(...samples.map((sample) => sample.meanAbsoluteDelta));
    const changedPixelRatio = Math.max(...samples.map((sample) => sample.ratio));
    const tolerance = {
      schema: "cssoccer-visual-parity-tolerance@1",
      channelDelta: maximumAbsoluteDelta,
      meanAbsoluteDelta,
      changedPixelRatio,
      rationale: maximumAbsoluteDelta === 0
        ? `Two deterministic native runs matched exactly across ${samples.length} aligned ${domainA.label} frames.`
        : `Two deterministic native runs measured this maximum renderer-boundary residual across ${samples.length} aligned ${domainA.label} frames.`,
    };
    return { id: domainA.id, label: domainA.label, tolerance, samples };
  });
  const calibration = {
    schema: VISUAL_CALIBRATION_SCHEMA,
    status: "pass",
    calibratedAt: laterTimestamp(captureA.manifest.generatedAt, captureB.manifest.generatedAt),
    captureProfileSha256: captureA.manifest.captureProfileSha256,
    bindings: commonBindings(captureA.manifest.bindings),
    captures: {
      nativeA: captureDescriptor(captureA.manifest),
      nativeB: captureDescriptor(captureB.manifest),
    },
    dimensions: structuredClone(captureA.manifest.dimensions),
    leadFrameCount: captureA.manifest.leadFrameCount,
    frameCount: captureA.manifest.framePlan.length,
    domains,
  };
  const completed = { ...calibration, calibrationSha256: sha256Hex(canonicalJson(calibration)) };
  assertVisualCalibration(completed);
  return completed;
}

export function assertVisualCalibration(calibration, label = "visual source A/A calibration") {
  plainObject(calibration, label);
  exactKeys(calibration, [
    "schema", "status", "calibratedAt", "captureProfileSha256", "bindings", "captures", "dimensions",
    "leadFrameCount", "frameCount", "domains", "calibrationSha256",
  ], label);
  if (calibration.schema !== VISUAL_CALIBRATION_SCHEMA || calibration.status !== "pass") fail(label, "must be a passing source A/A calibration");
  timestamp(calibration.calibratedAt, `${label}.calibratedAt`);
  digest(calibration.captureProfileSha256, `${label}.captureProfileSha256`);
  assertCommonBindings(calibration.bindings, `${label}.bindings`);
  exactKeys(calibration.captures, ["nativeA", "nativeB"], `${label}.captures`);
  for (const key of ["nativeA", "nativeB"]) {
    const capture = calibration.captures[key];
    exactKeys(capture, ["role", "captureId", "artifactSha256", "sourceSha256", "buildSha256"], `${label}.captures.${key}`);
    digest(capture.artifactSha256, `${label}.captures.${key}.artifactSha256`);
    digest(capture.sourceSha256, `${label}.captures.${key}.sourceSha256`);
    digest(capture.buildSha256, `${label}.captures.${key}.buildSha256`);
  }
  if (calibration.captures.nativeA.role !== "native-a" || calibration.captures.nativeB.role !== "native-b") fail(`${label}.captures`, "must retain native A/B roles");
  assertDimensions(calibration.dimensions, `${label}.dimensions`);
  safeInteger(calibration.leadFrameCount, `${label}.leadFrameCount`, 2);
  safeInteger(calibration.frameCount, `${label}.frameCount`, VISUAL_WINDOWS.length);
  if (!Array.isArray(calibration.domains) || calibration.domains.length !== VISUAL_DOMAINS.length) fail(`${label}.domains`, "must cover every visual domain");
  calibration.domains.forEach((domain, index) => {
    const expected = VISUAL_DOMAINS[index];
    if (domain?.id !== expected.id || domain.label !== expected.label || !Array.isArray(domain.samples) || domain.samples.length !== calibration.frameCount) fail(`${label}.domains[${index}]`, "does not retain the calibrated domain sequence");
    assertTolerance(domain.tolerance, `${label}.domains[${index}].tolerance`);
    domain.samples.forEach((sample, sampleIndex) => assertDifference(sample, calibration.dimensions, `${label}.domains[${index}].samples[${sampleIndex}]`, true));
  });
  digest(calibration.calibrationSha256, `${label}.calibrationSha256`);
  const { calibrationSha256, ...identity } = calibration;
  if (sha256Hex(canonicalJson(identity)) !== calibrationSha256) fail(`${label}.calibrationSha256`, "does not bind the calibration report");
  return calibration;
}

export function compareVisualCaptures({ reference: referenceInput, candidate: candidateInput, calibration }) {
  const reference = normalizeCaptureInput(referenceInput, "visual reference capture");
  const candidate = normalizeCaptureInput(candidateInput, "visual candidate capture");
  if (reference.manifest.role !== "native-a" || candidate.manifest.role !== "browser") fail("visual comparison", "requires native-a reference and browser candidate captures");
  assertVisualCalibration(calibration);
  assertAlignedCaptures(reference.manifest, candidate.manifest, {
    label: "native/browser visual comparison",
    requireSourceAndBuild: false,
    requireLeadMotionAlignment: true,
  });
  if (reference.manifest.captureProfileSha256 !== calibration.captureProfileSha256
    || reference.manifest.artifactSha256 !== calibration.captures.nativeA.artifactSha256) {
    fail("visual comparison", "reference capture is not the calibrated native A artifact");
  }
  const windowFrames = reference.manifest.framePlan.filter((frame) => frame.windowId !== null);
  const previewFiles = [];
  const comparisons = windowFrames.map((planned, frameIndex) => {
    const domains = {};
    for (const definition of VISUAL_DOMAINS) {
      const referenceFrame = domainById(reference.manifest, definition.id).frames[planned.ordinal];
      const candidateFrame = domainById(candidate.manifest, definition.id).frames[planned.ordinal];
      const referenceImage = readManifestFrame(reference, referenceFrame);
      const candidateImage = readManifestFrame(candidate, candidateFrame);
      const tolerance = calibration.domains.find((domain) => domain.id === definition.id).tolerance;
      const difference = compareRgbImages(referenceImage, candidateImage, tolerance.channelDelta);
      const status = difference.maximumAbsoluteDelta <= tolerance.channelDelta
        && difference.meanAbsoluteDelta <= tolerance.meanAbsoluteDelta
        && difference.ratio <= tolerance.changedPixelRatio ? "pass" : "fail";
      const directory = `previews/frame_${String(frameIndex).padStart(4, "0")}_${planned.windowId}/${definition.id}`;
      const referencePng = encodeRgbPng(referenceImage);
      const candidatePng = encodeRgbPng(candidateImage);
      const diffPng = encodeRgbPng(diffRgbImage(referenceImage, candidateImage));
      const images = {
        reference: previewDescriptor("Actua Soccer native", `${directory}/reference.png`, referencePng, referenceImage),
        candidate: previewDescriptor("css.soccer", `${directory}/candidate.png`, candidatePng, candidateImage),
        diff: previewDescriptor("Absolute RGB diff", `${directory}/diff.png`, diffPng, referenceImage),
      };
      for (const [kind, bytes] of [["reference", referencePng], ["candidate", candidatePng], ["diff", diffPng]]) {
        previewFiles.push({ path: images[kind].path, bytes });
      }
      domains[definition.id] = { label: definition.label, status, difference, images };
    }
    const status = VISUAL_DOMAINS.every((domain) => domains[domain.id].status === "pass") ? "pass" : "fail";
    return {
      id: `${reference.manifest.bindings.scenarioId}-visual-frame-${frameIndex}`,
      label: `${planned.label} · tick ${planned.tick}`,
      frame: frameIndex,
      captureOrdinal: planned.ordinal,
      tick: planned.tick,
      phase: planned.phase,
      windowId: planned.windowId,
      status,
      domains,
    };
  });
  const earliestFailure = firstVisualFailure(comparisons);
  const report = {
    schema: VISUAL_COMPARISON_SCHEMA,
    status: earliestFailure === null ? "pass" : "fail",
    comparedAt: laterTimestamp(reference.manifest.generatedAt, candidate.manifest.generatedAt),
    captureProfileSha256: reference.manifest.captureProfileSha256,
    calibrationSha256: calibration.calibrationSha256,
    bindings: {
      ...commonBindings(reference.manifest.bindings),
      reference: captureBindingDescriptor(reference.manifest),
      candidate: captureBindingDescriptor(candidate.manifest),
    },
    dimensions: structuredClone(reference.manifest.dimensions),
    leadFrameCount: reference.manifest.leadFrameCount,
    leadChecks: Object.fromEntries(VISUAL_DOMAINS.map((domain) => [domain.id, {
      referenceFirstMotionOrdinal: domainById(reference.manifest, domain.id).leadAnalysis.firstMotionOrdinal,
      candidateFirstMotionOrdinal: domainById(candidate.manifest, domain.id).leadAnalysis.firstMotionOrdinal,
      aligned: true,
    }])),
    comparisons,
    earliestFailure,
  };
  const reportSha256 = sha256Hex(canonicalJson(reportProjection(report)));
  const completed = { ...report, reportSha256, previewFiles };
  assertVisualComparison(completed);
  return completed;
}

export function assertVisualComparison(report, label = "visual comparison") {
  plainObject(report, label);
  if (report.schema !== VISUAL_COMPARISON_SCHEMA) fail(`${label}.schema`, `must equal ${VISUAL_COMPARISON_SCHEMA}`);
  if (!new Set(["pass", "fail"]).has(report.status)) fail(`${label}.status`, "must be pass or fail");
  timestamp(report.comparedAt, `${label}.comparedAt`);
  digest(report.captureProfileSha256, `${label}.captureProfileSha256`);
  digest(report.calibrationSha256, `${label}.calibrationSha256`);
  assertCommonBindings(report.bindings, `${label}.bindings`, { allowExtra: ["reference", "candidate"] });
  for (const side of ["reference", "candidate"]) {
    exactKeys(report.bindings[side], ["role", "captureId", "artifactSha256", "sourceSha256", "buildSha256"], `${label}.bindings.${side}`);
    for (const key of ["artifactSha256", "sourceSha256", "buildSha256"]) digest(report.bindings[side][key], `${label}.bindings.${side}.${key}`);
  }
  assertDimensions(report.dimensions, `${label}.dimensions`);
  safeInteger(report.leadFrameCount, `${label}.leadFrameCount`, 2);
  if (!Array.isArray(report.comparisons) || report.comparisons.length !== VISUAL_WINDOWS.length) fail(`${label}.comparisons`, `must contain ${VISUAL_WINDOWS.length} full-match windows`);
  let expectedStatus = "pass";
  report.comparisons.forEach((comparison, index) => {
    const comparisonLabel = `${label}.comparisons[${index}]`;
    if (comparison.frame !== index || comparison.windowId !== VISUAL_WINDOWS[index].id) fail(comparisonLabel, "breaks canonical visual window order");
    if (!new Set(["pass", "fail"]).has(comparison.status)) fail(`${comparisonLabel}.status`, "must be pass or fail");
    for (const domain of VISUAL_DOMAINS) {
      const entry = comparison.domains?.[domain.id];
      if (!entry || entry.label !== domain.label || !new Set(["pass", "fail"]).has(entry.status)) fail(`${comparisonLabel}.domains.${domain.id}`, "is incomplete");
      assertDifference(entry.difference, report.dimensions, `${comparisonLabel}.domains.${domain.id}.difference`);
      for (const kind of ["reference", "candidate", "diff"]) assertPreview(entry.images?.[kind], report.dimensions, `${comparisonLabel}.domains.${domain.id}.images.${kind}`);
    }
    const reconciled = VISUAL_DOMAINS.every((domain) => comparison.domains[domain.id].status === "pass") ? "pass" : "fail";
    if (comparison.status !== reconciled) fail(`${comparisonLabel}.status`, "does not reconcile target domains");
    if (reconciled === "fail") expectedStatus = "fail";
  });
  if (report.status !== expectedStatus) fail(`${label}.status`, "does not reconcile comparisons");
  digest(report.reportSha256, `${label}.reportSha256`);
  if (sha256Hex(canonicalJson(reportProjection(report))) !== report.reportSha256) fail(`${label}.reportSha256`, "does not bind the comparison metrics");
  if (!Array.isArray(report.previewFiles) || report.previewFiles.length !== VISUAL_WINDOWS.length * VISUAL_DOMAINS.length * 3) fail(`${label}.previewFiles`, "must retain every screenshot triplet");
  return report;
}

export function buildVisualParityData(report, calibration, differentialTesting) {
  assertVisualComparison(report);
  assertVisualCalibration(calibration);
  const scenario = assertPassingDifferentialLink(differentialTesting, report);
  if (scenario.frameCount !== report.comparisons.length) {
    fail("Differential Testing scenario frameCount", `must equal the ${report.comparisons.length} aligned visual windows`);
  }
  const domains = VISUAL_DOMAINS.map((domain) => ({
    ...domain,
    tolerance: structuredClone(calibration.domains.find((entry) => entry.id === domain.id).tolerance),
  }));
  const comparisons = report.comparisons.map((comparison) => ({
    id: comparison.id,
    label: comparison.label,
    frame: comparison.frame,
    status: comparison.status,
    domains: Object.fromEntries(VISUAL_DOMAINS.map((domain) => {
      const entry = comparison.domains[domain.id];
      return [domain.id, {
        label: domain.label,
        status: entry.status,
        reference: ovenImage(entry.images.reference),
        candidate: ovenImage(entry.images.candidate),
        diff: ovenImage(entry.images.diff),
        difference: structuredClone(entry.difference),
      }];
    })),
  }));
  const payload = {
    schema: VISUAL_PARITY_DATA_SCHEMA,
    differentialTesting: structuredClone(differentialTesting),
    domains,
    comparisons,
  };
  assertVisualParityData(payload);
  return payload;
}

export function assertVisualParityData(payload, label = "Visual Parity data") {
  plainObject(payload, label);
  exactKeys(payload, ["schema", "differentialTesting", "domains", "comparisons"], label);
  if (payload.schema !== VISUAL_PARITY_DATA_SCHEMA) fail(`${label}.schema`, `must equal ${VISUAL_PARITY_DATA_SCHEMA}`);
  if (payload.differentialTesting?.schema !== "burnlist-differential-testing-data@1") fail(`${label}.differentialTesting`, "must be normalized Differential Testing data");
  const scenarioId = payload.differentialTesting.scenarioCatalog?.selectedScenarioId;
  const scenario = payload.differentialTesting.scenarioCatalog?.scenarios?.find((entry) => entry.id === scenarioId);
  if (!scenario) fail(`${label}.differentialTesting`, "must retain one selected scenario");
  assertDomainDefinitions(payload.domains.map(({ tolerance: _tolerance, ...domain }) => domain), `${label}.domains`);
  payload.domains.forEach((domain, index) => assertTolerance(domain.tolerance, `${label}.domains[${index}].tolerance`));
  if (!Array.isArray(payload.comparisons) || payload.comparisons.length !== scenario.frameCount) fail(`${label}.comparisons`, "must match selected scenario frameCount");
  let previousFrame = -1;
  const ids = new Set();
  payload.comparisons.forEach((comparison, index) => {
    const comparisonLabel = `${label}.comparisons[${index}]`;
    if (typeof comparison.id !== "string" || !comparison.id || ids.has(comparison.id)) fail(`${comparisonLabel}.id`, "must be non-empty and unique");
    ids.add(comparison.id);
    text(comparison.label, `${comparisonLabel}.label`, 200);
    safeInteger(comparison.frame, `${comparisonLabel}.frame`, 0);
    if (comparison.frame <= previousFrame) fail(`${comparisonLabel}.frame`, "must be strictly ordered");
    previousFrame = comparison.frame;
    exactKeys(comparison.domains, VISUAL_DOMAINS.map((domain) => domain.id), `${comparisonLabel}.domains`);
    for (const domain of payload.domains) {
      const entry = comparison.domains[domain.id];
      if (!entry || entry.label !== domain.label) fail(`${comparisonLabel}.domains.${domain.id}`, "must retain the declared label");
      for (const kind of ["reference", "candidate", "diff"]) assertOvenImage(entry[kind], `${comparisonLabel}.domains.${domain.id}.${kind}`);
      const dimensions = { width: entry.reference.width, height: entry.reference.height };
      if (![entry.candidate, entry.diff].every((image) => image.width === dimensions.width && image.height === dimensions.height)) fail(`${comparisonLabel}.domains.${domain.id}`, "screenshot triplet dimensions differ");
      assertDifference(entry.difference, dimensions, `${comparisonLabel}.domains.${domain.id}.difference`);
      const expected = entry.difference.maximumAbsoluteDelta <= domain.tolerance.channelDelta
        && entry.difference.meanAbsoluteDelta <= domain.tolerance.meanAbsoluteDelta
        && entry.difference.ratio <= domain.tolerance.changedPixelRatio ? "pass" : "fail";
      if (entry.status !== expected) fail(`${comparisonLabel}.domains.${domain.id}.status`, "does not reconcile its calibrated tolerance");
    }
    const expectedStatus = payload.domains.filter((domain) => domain.qualification === "target")
      .every((domain) => comparison.domains[domain.id].status === "pass") ? "pass" : "fail";
    if (comparison.status !== expectedStatus) fail(`${comparisonLabel}.status`, "does not reconcile target domains");
  });
  return payload;
}

export function buildVisualParityBundle({ payload, report, calibration, publishedAt = report?.comparedAt }) {
  assertVisualParityData(payload);
  assertVisualComparison(report);
  assertVisualCalibration(calibration);
  timestamp(publishedAt, "publishedAt");
  const currentBytes = Buffer.from(`${canonicalJson(payload)}\n`, "utf8");
  const metrics = {
    ...reportProjection(report),
    reportSha256: report.reportSha256,
    publishedAt,
  };
  const metricsBytes = Buffer.from(`${canonicalJson(metrics)}\n`, "utf8");
  const calibrationBytes = Buffer.from(`${canonicalJson(calibration)}\n`, "utf8");
  const files = [
    { path: "current.json", bytes: currentBytes },
    { path: "metrics.json", bytes: metricsBytes },
    { path: "calibration.json", bytes: calibrationBytes },
    ...report.previewFiles.map((file) => ({ path: file.path, bytes: Buffer.from(file.bytes) })),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const generationId = sha256Hex(canonicalJson(files.map((file) => ({
    path: file.path,
    size: file.bytes.length,
    sha256: sha256Hex(file.bytes),
  }))));
  const bundle = { schema: VISUAL_BUNDLE_FILES_SCHEMA, generationId, files };
  assertVisualBundleFiles(bundle);
  return bundle;
}

export async function publishVisualParityBundleAtomic(bundle, publicationRoot, { validateGeneration } = {}) {
  assertVisualBundleFiles(bundle);
  if (typeof validateGeneration !== "function") fail("validateGeneration", "must check the staged payload with the installed Visual Parity contract");
  const root = resolve(publicationRoot);
  mkdirSync(root, { recursive: true });
  assertRealDirectory(root, "publication root");
  const generationsRoot = join(root, "generations");
  mkdirSync(generationsRoot, { recursive: true });
  assertRealDirectory(generationsRoot, "generation root");
  const currentLink = join(root, "current");
  if (existsSync(currentLink) && !lstatSync(currentLink).isSymbolicLink()) fail(currentLink, "exists and is not the atomic current-generation symlink");
  const temporaryRoot = mkdtempSync(join(generationsRoot, ".tmp-"));
  const finalRoot = join(generationsRoot, bundle.generationId);
  const temporaryLink = join(root, `.current-${process.pid}-${randomUUID()}`);
  try {
    for (const file of bundle.files) {
      const target = containedPath(temporaryRoot, file.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.bytes, { flag: "wx", mode: 0o644 });
      fsyncFile(target);
    }
    fsyncTreeDirectories(temporaryRoot);
    await validateGeneration(join(temporaryRoot, "current.json"));
    if (existsSync(finalRoot)) {
      assertRealDirectory(finalRoot, "published generation");
      rmSync(temporaryRoot, { recursive: true, force: true });
    } else {
      try {
        renameSync(temporaryRoot, finalRoot);
      } catch (error) {
        if (!new Set(["EEXIST", "ENOTEMPTY"]).has(error.code)) throw error;
        rmSync(temporaryRoot, { recursive: true, force: true });
      }
      fsyncDirectory(generationsRoot);
    }
    await validateGeneration(join(finalRoot, "current.json"));
    symlinkSync(relative(root, finalRoot), temporaryLink, "dir");
    renameSync(temporaryLink, currentLink);
    fsyncDirectory(root);
    return Object.freeze({
      generationId: bundle.generationId,
      generationRoot: finalRoot,
      payloadPath: join(currentLink, "current.json"),
      metricsPath: join(currentLink, "metrics.json"),
    });
  } catch (error) {
    rmSync(temporaryRoot, { recursive: true, force: true });
    rmSync(temporaryLink, { force: true });
    throw error;
  }
}

export function encodeRgbPng(image) {
  assertRgbImage(image, "PNG image");
  const rows = Buffer.alloc((image.width * 3 + 1) * image.height);
  const stride = image.width * 3;
  for (let y = 0; y < image.height; y += 1) {
    const offset = y * (stride + 1);
    rows[offset] = 0;
    image.pixels.copy(rows, offset + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(rows, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function readRgbImage(input, { label = "image", matteRgb = [0, 0, 0] } = {}) {
  const bytes = Buffer.isBuffer(input) ? Buffer.from(input) : readFileSync(input);
  assertMatte(matteRgb, "matteRgb");
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return readPng(bytes, label, matteRgb);
  if (bytes.subarray(0, 2).toString("ascii") === "P6") return readPpm(bytes, label);
  fail(label, "must be an 8-bit PNG or binary PPM/P6 image");
}

function assertVisualBundleFiles(bundle) {
  if (!bundle || bundle.schema !== VISUAL_BUNDLE_FILES_SCHEMA || !Array.isArray(bundle.files)) fail("visual bundle", "must contain checked bundle files");
  digest(bundle.generationId, "visual bundle generationId");
  const paths = new Set();
  for (const file of bundle.files) {
    if (!file || typeof file.path !== "string" || !Buffer.isBuffer(file.bytes)) fail("visual bundle file", "must contain a relative path and Buffer bytes");
    relativeFile(file.path, "visual bundle file path");
    if (paths.has(file.path)) fail(file.path, "duplicates a visual bundle file");
    paths.add(file.path);
  }
  for (const required of ["current.json", "metrics.json", "calibration.json"]) if (!paths.has(required)) fail("visual bundle", `is missing ${required}`);
}

function assertPassingDifferentialLink(data, report) {
  if (data?.schema !== "burnlist-differential-testing-data@1") fail("Differential Testing data", "uses an unsupported schema");
  if (data.trust?.status !== "pass" || (data.trust.blockers?.length ?? 0) !== 0 || data.trust.reportStatus !== "pass") fail("Differential Testing data", "must carry a current passing trusted report");
  if (data.refresh?.status !== "complete" || data.refresh?.report?.result !== "pass" || data.refresh?.report?.check?.status !== "pass") fail("Differential Testing data", "must carry a checked complete refresh");
  if (data.adapter?.engineIndependence?.status !== "pass") fail("Differential Testing data", "must retain passing engine independence");
  if (data.summary?.fields?.failed !== 0 || data.summary?.fields?.blocked !== 0
    || data.summary?.frames?.failed !== 0 || data.summary?.frames?.blocked !== 0) fail("Differential Testing data", "must have zero current failed or blocked exact fields/samples");
  const scenarioId = data.scenarioCatalog?.selectedScenarioId;
  const scenario = data.scenarioCatalog?.scenarios?.find((entry) => entry.id === scenarioId);
  if (!scenario || scenario.id !== report.bindings.scenarioId) fail("Differential Testing data", "must select the visual comparison scenario");
  const expected = {
    replaySha256: report.bindings.inputSha256,
    profileSha256: report.bindings.profileSha256,
    contractSha256: report.bindings.contractSha256,
  };
  for (const [key, value] of Object.entries(expected)) if (scenario[key] !== value) fail(`Differential Testing scenario.${key}`, "does not match the visual comparison binding");
  const bindings = data.adapter?.bindings;
  for (const key of COMMON_BINDINGS) {
    const reportKey = key === "scenarioId" ? report.bindings.scenarioId : report.bindings[key];
    const bindingKey = key === "contractSha256" ? "comparisonContractSha256" : key;
    if (bindings?.[bindingKey] !== reportKey) fail(`Differential Testing adapter.bindings.${bindingKey}`, "does not match the visual comparison");
  }
  for (const side of ["reference", "candidate"]) {
    for (const key of ["sourceSha256", "buildSha256"]) {
      if (bindings?.[side]?.[key] !== report.bindings[side][key]) fail(`Differential Testing adapter.bindings.${side}.${key}`, "does not match the visual capture");
    }
  }
  return scenario;
}

function reportProjection(report) {
  return {
    schema: report.schema,
    status: report.status,
    comparedAt: report.comparedAt,
    captureProfileSha256: report.captureProfileSha256,
    calibrationSha256: report.calibrationSha256,
    bindings: report.bindings,
    dimensions: report.dimensions,
    leadFrameCount: report.leadFrameCount,
    leadChecks: report.leadChecks,
    comparisons: report.comparisons.map((comparison) => ({
      ...comparison,
      domains: Object.fromEntries(Object.entries(comparison.domains).map(([id, domain]) => [id, {
        ...domain,
        images: Object.fromEntries(Object.entries(domain.images).map(([kind, image]) => [kind, {
          label: image.label,
          path: image.path,
          width: image.width,
          height: image.height,
          sha256: image.sha256,
        }])),
      }])),
    })),
    earliestFailure: report.earliestFailure,
  };
}

function assertAlignedCaptures(left, right, { label, requireSourceAndBuild, requireLeadMotionAlignment }) {
  if (left.captureProfileSha256 !== right.captureProfileSha256) fail(label, "capture profile hashes differ");
  for (const key of COMMON_BINDINGS) if (left.bindings[key] !== right.bindings[key]) fail(label, `${key} bindings differ`);
  if (requireSourceAndBuild) {
    for (const key of ["sourceSha256", "buildSha256"]) if (left.bindings[key] !== right.bindings[key]) fail(label, `${key} bindings differ`);
  }
  for (const key of ["dimensions", "matteRgb", "framePlan"]) if (canonicalJson(left[key]) !== canonicalJson(right[key])) fail(label, `${key} differ`);
  if (left.leadFrameCount !== right.leadFrameCount) fail(label, "lead-frame counts differ");
  if (canonicalJson(left.domains.map(domainProjection)) !== canonicalJson(right.domains.map(domainProjection))) fail(label, "render domains differ");
  if (requireLeadMotionAlignment) {
    for (const domain of VISUAL_DOMAINS) {
      if (domainById(left, domain.id).leadAnalysis.firstMotionOrdinal !== domainById(right, domain.id).leadAnalysis.firstMotionOrdinal) {
        fail(label, `${domain.label} lead-frame motion begins at different ordinals`);
      }
    }
  }
}

function domainProjection(domain) {
  return { id: domain.id, label: domain.label, isolation: domain.isolation, qualification: domain.qualification };
}

function normalizeCaptureInput(input, label) {
  if (input?.manifest && typeof input.root === "string") {
    assertVisualCaptureManifest(input.manifest, { root: input.root, label });
    return { manifest: input.manifest, root: resolve(input.root) };
  }
  fail(label, "must include a checked manifest and its local root");
}

function readManifestFrame(capture, frame) {
  return readRgbImage(readFileSync(containedPath(capture.root, frame.path)), {
    label: frame.path,
    matteRgb: capture.manifest.matteRgb,
  });
}

function leadFrameAnalysis(frames, root, count, matteRgb) {
  const base = readRgbImage(readFileSync(containedPath(root, frames[0].path)), { label: frames[0].path, matteRgb });
  const comparedOrdinals = [];
  let firstMotionOrdinal = null;
  let stablePrefixCount = 1;
  for (let ordinal = 1; ordinal < count; ordinal += 1) {
    const current = readRgbImage(readFileSync(containedPath(root, frames[ordinal].path)), { label: frames[ordinal].path, matteRgb });
    const difference = compareRgbImages(base, current, 0);
    comparedOrdinals.push({ ordinal, meanAbsoluteDelta: difference.meanAbsoluteDelta, changedPixelRatio: difference.ratio });
    if (firstMotionOrdinal === null && difference.changedPixels > 0) firstMotionOrdinal = ordinal;
    if (firstMotionOrdinal === null) stablePrefixCount += 1;
  }
  return { baselineOrdinal: 0, comparedOrdinals, firstMotionOrdinal, stablePrefixCount };
}

function assertLeadAnalysis(value, count, label) {
  exactKeys(value, ["baselineOrdinal", "comparedOrdinals", "firstMotionOrdinal", "stablePrefixCount"], label);
  if (value.baselineOrdinal !== 0 || !Array.isArray(value.comparedOrdinals) || value.comparedOrdinals.length !== count - 1) fail(label, "does not cover the declared lead frames");
  if (value.firstMotionOrdinal !== null) safeInteger(value.firstMotionOrdinal, `${label}.firstMotionOrdinal`, 1);
  safeInteger(value.stablePrefixCount, `${label}.stablePrefixCount`, 1);
}

export function compareRgbImages(reference, candidate, channelDelta) {
  assertRgbImage(reference, "reference image");
  assertRgbImage(candidate, "candidate image");
  if (reference.width !== candidate.width || reference.height !== candidate.height) fail("visual comparison", "image dimensions differ");
  safeInteger(channelDelta, "channelDelta", 0);
  if (channelDelta > 255) fail("channelDelta", "must not exceed 255");
  let absoluteSum = 0;
  let maximumAbsoluteDelta = 0;
  let changedPixels = 0;
  const totalPixels = reference.width * reference.height;
  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    let changed = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const index = pixel * 3 + channel;
      const delta = Math.abs(reference.pixels[index] - candidate.pixels[index]);
      absoluteSum += delta;
      maximumAbsoluteDelta = Math.max(maximumAbsoluteDelta, delta);
      if (delta > channelDelta) changed = true;
    }
    if (changed) changedPixels += 1;
  }
  return {
    changedPixels,
    totalPixels,
    ratio: changedPixels / totalPixels,
    meanAbsoluteDelta: absoluteSum / (totalPixels * 3),
    maximumAbsoluteDelta,
  };
}

export function diffRgbImage(reference, candidate) {
  const pixels = Buffer.alloc(reference.pixels.length);
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = Math.min(255, Math.abs(reference.pixels[index] - candidate.pixels[index]) * 4);
  return { width: reference.width, height: reference.height, pixels };
}

function firstVisualFailure(comparisons) {
  for (const comparison of comparisons) {
    for (const domain of VISUAL_DOMAINS) {
      if (comparison.domains[domain.id].status === "fail") {
        return { frame: comparison.frame, windowId: comparison.windowId, tick: comparison.tick, domainId: domain.id, domainLabel: domain.label };
      }
    }
  }
  return null;
}

function previewDescriptor(label, path, bytes, image) {
  return { label, path, width: image.width, height: image.height, sha256: sha256Hex(bytes), dataUrl: `data:image/png;base64,${bytes.toString("base64")}` };
}

function ovenImage(image) {
  return { label: image.label, src: image.dataUrl, width: image.width, height: image.height };
}

function assertPreview(image, dimensions, label) {
  exactKeys(image, ["label", "path", "width", "height", "sha256", "dataUrl"], label);
  text(image.label, `${label}.label`, 160);
  relativeFile(image.path, `${label}.path`);
  digest(image.sha256, `${label}.sha256`);
  if (image.width !== dimensions.width || image.height !== dimensions.height) fail(label, "dimensions differ from the visual comparison");
  assertPngDataUrl(image.dataUrl, image.width, image.height, `${label}.dataUrl`);
}

function assertOvenImage(image, label) {
  exactKeys(image, ["label", "src", "width", "height"], label);
  text(image.label, `${label}.label`, 160);
  safeInteger(image.width, `${label}.width`, 1);
  safeInteger(image.height, `${label}.height`, 1);
  assertPngDataUrl(image.src, image.width, image.height, `${label}.src`);
}

function assertPngDataUrl(value, width, height, label) {
  const match = typeof value === "string" ? value.match(IMAGE_DATA_URL) : null;
  if (!match) fail(label, "must be a PNG data URL");
  const image = readRgbImage(Buffer.from(match[1], "base64"), { label });
  if (image.width !== width || image.height !== height) fail(label, "decoded dimensions differ from its descriptor");
}

function assertDifference(value, dimensions, label, allowOrdinal = false) {
  plainObject(value, label);
  const keys = ["changedPixels", "totalPixels", "ratio", "meanAbsoluteDelta", "maximumAbsoluteDelta"];
  if (allowOrdinal) keys.unshift("ordinal");
  exactKeys(value, keys, label);
  if (allowOrdinal) safeInteger(value.ordinal, `${label}.ordinal`, 0);
  const totalPixels = dimensions.width * dimensions.height;
  if (!Number.isSafeInteger(value.changedPixels) || value.changedPixels < 0 || value.changedPixels > totalPixels || value.totalPixels !== totalPixels) fail(label, "contains invalid pixel counts");
  if (value.ratio !== value.changedPixels / totalPixels) fail(`${label}.ratio`, "does not equal changedPixels / totalPixels");
  finiteRange(value.meanAbsoluteDelta, `${label}.meanAbsoluteDelta`, 0, 255);
  finiteRange(value.maximumAbsoluteDelta, `${label}.maximumAbsoluteDelta`, value.meanAbsoluteDelta, 255);
}

function assertTolerance(value, label) {
  exactKeys(value, ["schema", "channelDelta", "meanAbsoluteDelta", "changedPixelRatio", "rationale"], label);
  if (value.schema !== "cssoccer-visual-parity-tolerance@1") fail(`${label}.schema`, "must use cssoccer-visual-parity-tolerance@1");
  safeInteger(value.channelDelta, `${label}.channelDelta`, 0);
  if (value.channelDelta > 255) fail(`${label}.channelDelta`, "must not exceed 255");
  finiteRange(value.meanAbsoluteDelta, `${label}.meanAbsoluteDelta`, 0, 255);
  finiteRange(value.changedPixelRatio, `${label}.changedPixelRatio`, 0, 1);
  text(value.rationale, `${label}.rationale`, 320);
}

function captureDescriptor(manifest) {
  return {
    role: manifest.role,
    captureId: manifest.captureId,
    artifactSha256: manifest.artifactSha256,
    sourceSha256: manifest.bindings.sourceSha256,
    buildSha256: manifest.bindings.buildSha256,
  };
}

function captureBindingDescriptor(manifest) {
  return captureDescriptor(manifest);
}

function commonBindings(bindings) {
  return Object.fromEntries(COMMON_BINDINGS.map((key) => [key, bindings[key]]));
}

function domainById(manifest, id) {
  const domain = manifest.domains.find((entry) => entry.id === id);
  if (!domain) fail("visual capture", `is missing domain ${id}`);
  return domain;
}

function assertDomainDefinitions(domains, label) {
  if (!Array.isArray(domains) || domains.length !== VISUAL_DOMAINS.length) fail(label, `must define exactly ${VISUAL_DOMAINS.length} isolated target domains`);
  domains.forEach((domain, index) => {
    const expected = VISUAL_DOMAINS[index];
    exactKeys(domain, ["id", "label", "isolation", "qualification"], `${label}[${index}]`);
    if (!DOMAIN_ID.test(domain.id) || canonicalJson(domain) !== canonicalJson(expected)) fail(`${label}[${index}]`, `must equal the canonical ${expected.label} target domain`);
  });
}

function assertRenderer(renderer, label) {
  plainObject(renderer, label);
  exactKeys(renderer, ["id", "label", "mode"], label);
  text(renderer.id, `${label}.id`, 80);
  text(renderer.label, `${label}.label`, 160);
  if (renderer.mode !== "headless") fail(`${label}.mode`, "must be headless");
}

function assertCommonBindings(bindings, label, { allowExtra = [] } = {}) {
  plainObject(bindings, label);
  exactKeys(bindings, [...COMMON_BINDINGS, ...allowExtra], label);
  if (typeof bindings.scenarioId !== "string" || !SCENARIO_ID.test(bindings.scenarioId)) fail(`${label}.scenarioId`, "must be a 16-character lowercase hexadecimal id");
  for (const key of COMMON_BINDINGS.slice(1)) digest(bindings[key], `${label}.${key}`);
  if (bindings.scenarioId !== bindings.scenarioSha256.slice(0, 16)) fail(`${label}.scenarioId`, "must prefix scenarioSha256");
}

function assertFullBindings(bindings, label) {
  plainObject(bindings, label);
  exactKeys(bindings, FULL_BINDINGS, label);
  assertCommonBindings(Object.fromEntries(COMMON_BINDINGS.map((key) => [key, bindings[key]])), label);
  digest(bindings.sourceSha256, `${label}.sourceSha256`);
  digest(bindings.buildSha256, `${label}.buildSha256`);
}

function assertDimensions(value, label) {
  exactKeys(value, ["width", "height"], label);
  safeInteger(value.width, `${label}.width`, 1);
  safeInteger(value.height, `${label}.height`, 1);
}

function assertMatte(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((channel) => !Number.isSafeInteger(channel) || channel < 0 || channel > 255)) fail(label, "must be three 8-bit RGB channels");
}

function listNumberedFrames(root) {
  if (!existsSync(root) || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) fail(root, "must be a real frame directory");
  const frames = [];
  const ordinals = new Set();
  for (const name of readdirSync(root)) {
    const match = name.match(/(?:^|_)(\d+)\.(?:png|ppm)$/iu);
    if (!match) continue;
    const ordinal = Number(match[1]);
    if (!Number.isSafeInteger(ordinal) || ordinals.has(ordinal)) fail(root, `contains duplicate or invalid frame ordinal ${match[1]}`);
    const path = join(root, name);
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) fail(path, "must be a real frame file");
    ordinals.add(ordinal);
    frames.push({ ordinal, path });
  }
  return frames.sort((left, right) => left.ordinal - right.ordinal);
}

function containedRelativePath(root, path) {
  const value = relative(root, resolve(path)).split(sep).join("/");
  relativeFile(value, path);
  return value;
}

function containedPath(root, relativePath) {
  relativeFile(relativePath, "relative path");
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) fail(relativePath, "escapes its declared root");
  return target;
}

function relativeFile(value, label) {
  if (typeof value !== "string" || !value || isAbsolute(value) || value.split("/").some((part) => !part || part === "." || part === "..")) fail(label, "must be a contained relative file path");
}

function parseJsonFile(path, label) {
  let value;
  try { value = JSON.parse(readFileSync(path, "utf8")); } catch (error) { fail(label, `cannot be read: ${error.message}`); }
  return value;
}

function readPpm(bytes, label) {
  let offset = 0;
  const token = () => {
    while (offset < bytes.length && (bytes[offset] <= 32 || bytes[offset] === 35)) {
      if (bytes[offset] === 35) while (offset < bytes.length && bytes[offset++] !== 10) {}
      else offset += 1;
    }
    const start = offset;
    while (offset < bytes.length && bytes[offset] > 32) offset += 1;
    return bytes.subarray(start, offset).toString("ascii");
  };
  if (token() !== "P6") fail(label, "uses an unsupported PPM magic");
  const width = Number(token());
  const height = Number(token());
  const maximum = Number(token());
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1 || maximum !== 255) fail(label, "uses unsupported PPM dimensions or range");
  if (offset < bytes.length && bytes[offset] <= 32) offset += 1;
  const pixels = bytes.subarray(offset);
  if (pixels.length !== width * height * 3) fail(label, "has a truncated or trailing PPM pixel payload");
  return { width, height, pixels: Buffer.from(pixels) };
}

function readPng(bytes, label, matteRgb) {
  let offset = 8;
  let width = null;
  let height = null;
  let bitDepth = null;
  let colorType = null;
  let interlace = null;
  let palette = null;
  let transparency = null;
  const idat = [];
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) fail(label, `has a truncated ${type} PNG chunk`);
    const data = bytes.subarray(dataStart, dataEnd);
    const recordedCrc = bytes.readUInt32BE(dataEnd);
    if (crc32(Buffer.concat([typeBytes, data])) !== recordedCrc) fail(label, `has an invalid ${type} PNG checksum`);
    offset = dataEnd + 4;
    if (type === "IHDR") {
      if (width !== null || length !== 13) fail(label, "has an invalid IHDR chunk");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[10] !== 0 || data[11] !== 0) fail(label, "uses unsupported PNG compression or filtering");
      interlace = data[12];
    } else if (type === "PLTE") palette = Buffer.from(data);
    else if (type === "tRNS") transparency = Buffer.from(data);
    else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") { ended = true; break; }
  }
  if (!ended || offset !== bytes.length || width === null || width < 1 || height < 1 || bitDepth !== 8 || interlace !== 0 || ![0, 2, 3, 4, 6].includes(colorType) || idat.length === 0) fail(label, "uses an unsupported or incomplete PNG encoding");
  if (colorType === 3 && (!palette || palette.length === 0 || palette.length % 3 !== 0)) fail(label, "is missing its indexed PNG palette");
  const channels = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]).get(colorType);
  const stride = width * channels;
  let inflated;
  try { inflated = inflateSync(Buffer.concat(idat)); } catch (error) { fail(label, `has invalid compressed PNG data: ${error.message}`); }
  if (inflated.length !== (stride + 1) * height) fail(label, "has a truncated or trailing PNG scanline payload");
  const pixels = Buffer.alloc(width * height * 3);
  let sourceOffset = 0;
  let targetOffset = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset++];
    const row = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + stride));
    sourceOffset += stride;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? row[index - channels] : 0;
      const up = previous[index] ?? 0;
      const upLeft = index >= channels ? previous[index - channels] : 0;
      if (filter === 1) row[index] = (row[index] + left) & 255;
      else if (filter === 2) row[index] = (row[index] + up) & 255;
      else if (filter === 3) row[index] = (row[index] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) row[index] = (row[index] + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) fail(label, `uses unsupported PNG filter ${filter}`);
    }
    for (let x = 0; x < width; x += 1) {
      const pixel = x * channels;
      let red;
      let green;
      let blue;
      let alpha = 255;
      if (colorType === 0 || colorType === 4) {
        red = green = blue = row[pixel];
        if (colorType === 4) alpha = row[pixel + 1];
      } else if (colorType === 3) {
        const paletteIndex = row[pixel];
        if (paletteIndex * 3 + 2 >= palette.length) fail(label, "references a missing PNG palette entry");
        red = palette[paletteIndex * 3];
        green = palette[paletteIndex * 3 + 1];
        blue = palette[paletteIndex * 3 + 2];
        alpha = transparency?.[paletteIndex] ?? 255;
      } else {
        red = row[pixel];
        green = row[pixel + 1];
        blue = row[pixel + 2];
        if (colorType === 6) alpha = row[pixel + 3];
      }
      pixels[targetOffset++] = compositeChannel(red, alpha, matteRgb[0]);
      pixels[targetOffset++] = compositeChannel(green, alpha, matteRgb[1]);
      pixels[targetOffset++] = compositeChannel(blue, alpha, matteRgb[2]);
    }
    previous = row;
  }
  return { width, height, pixels };
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function compositeChannel(channel, alpha, matte) {
  return Math.round((channel * alpha + matte * (255 - alpha)) / 255);
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const cornerDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= cornerDistance) return left;
  return upDistance <= cornerDistance ? up : upLeft;
}

function assertRgbImage(image, label) {
  if (!image || !Number.isSafeInteger(image.width) || image.width < 1 || !Number.isSafeInteger(image.height) || image.height < 1 || !Buffer.isBuffer(image.pixels) || image.pixels.length !== image.width * image.height * 3) fail(label, "must contain width, height, and RGB pixels");
}

function exactKeys(value, keys, label) {
  plainObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(label, `must contain exactly keys ${expected.join(", ")}`);
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(label, "must be an object");
}

function safeInteger(value, label, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) fail(label, `must be a safe integer >= ${minimum}`);
}

function finiteRange(value, label, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) fail(label, `must be a finite number in [${minimum}, ${maximum}]`);
}

function digest(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(label, "must be a lowercase SHA-256 digest");
}

function text(value, label, maximum) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) fail(label, `must be non-empty text no longer than ${maximum} characters`);
}

function timestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) fail(label, "must be a parseable timestamp");
}

function laterTimestamp(left, right) {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function fail(label, message) {
  throw new VisualParityError(`${label} ${message}.`);
}

function assertRealDirectory(path, label) {
  const metadata = lstatSync(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail(label, `must be a real directory: ${path}`);
}

function fsyncFile(path) {
  const descriptor = openSync(path, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function fsyncDirectory(path) {
  const descriptor = openSync(path, "r");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function fsyncTreeDirectories(root) {
  const directories = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    directories.push(current);
    for (const name of readdirSync(current)) {
      const child = join(current, name);
      const metadata = lstatSync(child);
      if (metadata.isDirectory() && !metadata.isSymbolicLink()) stack.push(child);
    }
  }
  directories.sort((left, right) => right.length - left.length).forEach(fsyncDirectory);
}

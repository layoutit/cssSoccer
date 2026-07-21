#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";

const CHECK = process.argv.includes("--check");
const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const productEntry = resolve(repoRoot, "src/cssoccer/main.mjs");
const generatedRoot = resolve(repoRoot, "build/generated/public/cssoccer");
const distRoot = resolve(repoRoot, "dist");
const findings = [];

if (!CHECK || process.argv.some((argument, index) => (
  index > 1 && argument !== "--check"
))) {
  throw new Error("Usage: node tools/check-exact-player-runtime-boundary.mjs --check");
}

const productGraph = await collectModuleGraph(productEntry, repoRoot);
const productPaths = new Set(productGraph.modules.map(({ path }) => path));
for (const path of productPaths) {
  if (path.startsWith("src/prepare/")) {
    finding("product-imports-prepare", path);
  }
  if (path.startsWith("tools/") || path.startsWith("test/") || path.includes("/.local/")) {
    finding("product-imports-private-surface", path);
  }
}

const obsoleteSourcePaths = [
  "src/cssoccer/actuaNativeProjection.mjs",
  "src/cssoccer/headTextureStyle.mjs",
  "src/cssoccer/playerModelLab.mjs",
  "src/cssoccer/sourceCameraFacingMesh.mjs",
  "src/prepare/cssoccer/sourceCameraFacingMesh.mjs",
  "src/prepare/cssoccer/exactActuaMatchPlayers.mjs",
  "src/prepare/cssoccer/exactActuaPlayerRender.mjs",
  "bench/model-lab/model-lab.html",
  "bench/model-lab/modelLab.mjs",
  "tools/publish-model-lab-preview.mjs",
  "tools/publish-model-lab-visual-parity.mjs",
  "tools/publish-model-lab.mjs",
  "tools/publish-exact-match-player-models.mjs",
  "tools/publish-source-shirt-front-preview.mjs",
];
for (const path of obsoleteSourcePaths) {
  if (existsSync(resolve(repoRoot, path))) finding("obsolete-source-present", path);
  if (productPaths.has(path)) finding("obsolete-source-reachable", path);
}

const exactRuntimePaths = [
  "src/cssoccer/exactActuaPlayerAssets.mjs",
  "src/cssoccer/exactActuaPlayerMesh.mjs",
  "src/cssoccer/playerRenderState.mjs",
  "src/cssoccer/polycssScene.mjs",
];
const exactLeafRuntimePaths = exactRuntimePaths.slice(0, 3);
const forbiddenRuntimeRules = [
  ["native-player-projection", /\bprojectExactActuaPlayer(?:Coordinates|Sample)\b/u],
  ["runtime-camera-facing-projection", /\b(?:createSourceCameraFacingRuntime|cssoccerSourceCameraFacingLeafStyle|cssoccerSourceViewDirection)\b/u],
  ["runtime-homography", /\b(?:unitSquareToQuad|homograph(?:y|ic)|projectiveW)\b/iu],
  ["runtime-source-parser", /\b(?:decodeActua|parseActua|DATA\.OBJ|ACTREND\.(?:DAT|OFF))\b/u],
  ["runtime-frame-deep-freeze", /\bdeepFreeze\b/u],
  ["runtime-object-write-log", /\b(?:ledger\.writes|writeLog|writes\.push)\b/u],
];
for (const path of exactRuntimePaths) {
  const source = await requiredText(resolve(repoRoot, path), path);
  for (const [rule, pattern] of forbiddenRuntimeRules) {
    if (pattern.test(source)) finding(rule, path);
  }
}
for (const path of exactLeafRuntimePaths) {
  const source = await requiredText(resolve(repoRoot, path), path);
  if (/\b(?:formatNumber|formatMatrix|DOMMatrix|matrix3d\s*\()\b/iu.test(source)) {
    finding("runtime-face-matrix-formatting", path);
  }
  if (/from\s+["'][^"']*(?:Geometry|Materials|Atlas|prepare)[^"']*["']/iu.test(source)) {
    finding("runtime-player-builder-import", path);
  }
}

const renderRuntimePath = "src/cssoccer/renderBundleMesh.mjs";
const renderRuntimeSource = await requiredText(
  resolve(repoRoot, renderRuntimePath),
  renderRuntimePath,
);
if (/from\s+["'][^"']*sourceCameraFacingMesh/u.test(renderRuntimeSource)
    || /\bcreateSourceCameraFacingRuntime\b/u.test(renderRuntimeSource)) {
  finding("product-renderer-camera-facing-branch", renderRuntimePath);
}
if (!/Object\.hasOwn\(frameSet,\s*"sourceCameraFacing"\)/u.test(renderRuntimeSource)
    || !/Obsolete source camera-facing frame-set fields are forbidden\./u.test(renderRuntimeSource)) {
  finding("product-renderer-camera-facing-rejection-missing", renderRuntimePath);
}

const manifestPath = resolve(generatedRoot, "manifest.json");
const scenePath = resolve(generatedRoot, "scenes/spain-argentina-full-match.json");
const renderPath = resolve(generatedRoot, "assets/spain-argentina-render-bundles.json");
const indexPath = resolve(generatedRoot, "assets/animation/exact-player/index.json");
const materialsPath = resolve(
  generatedRoot,
  "assets/spain-argentina-exact-player-materials.json",
);
const [manifest, scene, renderAssets, index, materials] = await Promise.all([
  requiredJson(manifestPath, "prepared manifest"),
  requiredJson(scenePath, "prepared scene"),
  requiredJson(renderPath, "prepared render publication"),
  requiredJson(indexPath, "exact player index"),
  requiredJson(materialsPath, "exact player materials"),
]);

const manifestPaths = manifest.preparedFiles?.map(({ path }) => path) ?? [];
const generatedPaths = await walkFiles(generatedRoot);
const forbiddenGeneratedPath = /(?:^|\/)(?:model-lab(?:\/|\.)?|spain-argentina-body-unprojected\.png|spain-argentina-exact-players\.(?:json|png)|actor-player-f[12](?:\/|\.)?)/u;
for (const path of [...new Set([...manifestPaths, ...generatedPaths])]) {
  if (forbiddenGeneratedPath.test(path)) finding("obsolete-generated-player-asset", path);
}
for (const requiredPath of [
  "assets/animation/exact-player/index.json",
  "assets/spain-argentina-exact-player-materials.json",
  "assets/textures/spain-argentina-exact-player-materials.png",
]) {
  if (!manifestPaths.includes(requiredPath)) finding("canonical-player-asset-missing", requiredPath);
}

const indexSource = await requiredText(indexPath, "exact player index");
if (/player_f[12]|coordinates|projectedCorners|projectiveW|depthBits/u.test(indexSource)) {
  finding("duplicate-or-source-geometry-in-index", repoRelative(indexPath));
}
if (index.cache?.policy !== "bounded-lru-transactional-frame-residency"
    || index.cache?.maxDecodedChunks !== 24
    || index.cache?.eagerWholeDomain !== false) {
  finding("exact-player-cache-boundary-changed", repoRelative(indexPath));
}

const geometryIds = new Set([
  index.geometryId,
  materials.geometryId,
  ...Object.values(materials.materialProfiles ?? {}).map(({ geometryId }) => geometryId),
  ...(materials.fixturePlayers ?? []).map(({ geometryId }) => geometryId),
].filter(Boolean));
if (geometryIds.size !== 1
    || !geometryIds.has("actua-player-28p-13f-one-basis")) {
  finding("multiple-exact-player-geometry-ids", [...geometryIds].sort().join(","));
}
if (materials.counts?.profiles !== 2
    || materials.counts?.fixturePlayers !== 22
    || materials.counts?.faceBindingsPerProfile !== 13
    || Object.keys(materials.materialProfiles ?? {}).length !== 2) {
  finding("exact-player-material-profile-contract-changed", repoRelative(materialsPath));
}
if (Object.values(materials.materialProfiles ?? {}).some((profile) => (
  Object.hasOwn(profile?.shirtNumbers ?? {}, "fallback")
))) {
  finding("exact-player-shirt-number-fallback", repoRelative(materialsPath));
}
if (materials.runtime?.missingMaterialPolicy !== "reject"
    || materials.runtime?.missingNumberPolicy !== "reject"
    || materials.runtime?.geometryMutation !== false
    || materials.runtime?.matrixMutationByMaterial !== false
    || materials.runtime?.atlasConstruction !== false) {
  finding("exact-player-material-runtime-rejection-policy", repoRelative(materialsPath));
}

const playerMeshes = (scene.meshes ?? []).filter(({ kind }) => kind === "player");
if (playerMeshes.length !== 22
    || playerMeshes.some(({ bundleId, frameSetId, initialFrameIndex }) => (
      bundleId !== "exact-actua-player-one-basis"
      || frameSetId !== null
      || initialFrameIndex !== null
    ))) {
  finding("canonical-player-mesh-binding-changed", repoRelative(scenePath));
}
const playerRoots = scene.roots?.players ?? [];
if (playerRoots.length !== 22
    || playerRoots.some(({ initialBinding }) => (
      initialBinding?.animation?.frameSetId !== null
    ))) {
  finding("canonical-player-root-binding-changed", repoRelative(scenePath));
}
if ((renderAssets.frameSets ?? []).some((frameSet) => (
  Object.hasOwn(frameSet, "sourceCameraFacing")
  || Object.hasOwn(frameSet, "sourcePrimitiveTopologyHash")
  || /^actor-player-f[12]$/u.test(frameSet.id)
))) {
  finding("runtime-projected-player-frame-set-present", repoRelative(renderPath));
}

const distGraph = await collectBuiltGraph(distRoot);
const distSource = distGraph.modules.map(({ source }) => source).join("\n");
for (const [rule, pattern] of [
  ["built-native-player-projection", /\bprojectExactActuaPlayer(?:Coordinates|Sample)\b/u],
  ["built-camera-facing-projection", /\b(?:createSourceCameraFacingRuntime|cssoccerSourceCameraFacingLeafStyle|cssoccerSourceViewDirection)\b/u],
  ["built-homography", /\b(?:unitSquareToQuad|homograph(?:y|ic))\b/iu],
  ["built-obsolete-player-asset", /spain-argentina-exact-players\.(?:json|png)|actor-player-f[12]\//u],
  ["built-model-lab", /\b(?:mountCssoccerPlayerModelLab|cssoccer-model-lab|model-lab)\b/u],
]) {
  if (pattern.test(distSource)) finding(rule, "dist:connected-module-graph");
}

const report = {
  schema: "cssoccer-exact-player-runtime-boundary-report@1",
  status: findings.length === 0 ? "pass" : "fail",
  mode: "check",
  productGraph: {
    entry: repoRelative(productEntry),
    modules: productGraph.modules.length,
    edges: productGraph.edges,
    prepareModules: [...productPaths].filter((path) => path.startsWith("src/prepare/")).length,
  },
  builtGraph: {
    modules: distGraph.modules.length,
    bytes: distGraph.modules.reduce((sum, { source }) => sum + Buffer.byteLength(source), 0),
    sha256: sha256(Buffer.from(distSource)),
  },
  publication: {
    manifestFiles: manifestPaths.length,
    exactChunks: index.counts?.chunks,
    geometryIds: [...geometryIds].sort(),
    materialProfiles: Object.keys(materials.materialProfiles ?? {}).sort(),
    playerRoots: playerRoots.length,
    playerMeshes: playerMeshes.length,
    runtimeProjectedFrameSets: (renderAssets.frameSets ?? [])
      .filter((frameSet) => Object.hasOwn(frameSet, "sourceCameraFacing"))
      .length,
  },
  findings,
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "pass") process.exitCode = 1;

async function collectModuleGraph(entry, boundaryRoot) {
  const modules = new Map();
  let edges = 0;
  async function visit(path) {
    const absolutePath = resolve(path);
    if (modules.has(absolutePath)) return;
    const source = await requiredText(absolutePath, repoRelative(absolutePath));
    modules.set(absolutePath, { path: repoRelative(absolutePath), source });
    for (const specifier of moduleSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      const dependency = await resolveModule(dirname(absolutePath), specifier);
      if (!inside(dependency, boundaryRoot)) {
        finding("product-import-escaped-repo", repoRelative(dependency));
        continue;
      }
      edges += 1;
      await visit(dependency);
    }
  }
  await visit(entry);
  return { modules: [...modules.values()], edges };
}

async function collectBuiltGraph(root) {
  const indexPath = resolve(root, "index.html");
  const html = await requiredText(indexPath, "dist/index.html");
  const entries = [...html.matchAll(
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/gu,
  )].map((match) => match[1]);
  if (entries.length === 0) throw new Error("dist/index.html has no connected module entry.");
  const modules = new Map();
  async function visit(path) {
    const absolutePath = resolve(path);
    if (modules.has(absolutePath)) return;
    const source = await requiredText(absolutePath, repoRelative(absolutePath));
    modules.set(absolutePath, { path: repoRelative(absolutePath), source });
    for (const specifier of moduleSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      await visit(await resolveModule(dirname(absolutePath), specifier));
    }
  }
  for (const entry of entries) {
    const relativeEntry = entry.replace(/^\//u, "");
    await visit(resolve(root, relativeEntry));
  }
  return { modules: [...modules.values()] };
}

function moduleSpecifiers(source) {
  const values = [];
  const pattern = /\b(?:import|export)\s+(?:[^"']*?\s+from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu;
  for (const match of source.matchAll(pattern)) values.push(match[1] ?? match[2]);
  return values;
}

async function resolveModule(parent, specifier) {
  const direct = resolve(parent, specifier);
  const candidates = extname(direct)
    ? [direct]
    : [direct, `${direct}.mjs`, `${direct}.js`, `${direct}.css`];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next deterministic extension.
    }
  }
  throw new Error(`Unable to resolve module ${specifier} from ${repoRelative(parent)}.`);
}

async function walkFiles(root) {
  const output = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) output.push(relative(root, path).split(sep).join("/"));
    }
  }
  await walk(root);
  return output.sort();
}

async function requiredJson(path, label) {
  const source = await requiredText(path, label);
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

async function requiredText(path, label) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Missing ${label}: ${error.message}`);
  }
}

function inside(path, root) {
  const value = relative(resolve(root), resolve(path));
  return value !== "" && !value.startsWith("..") && !value.split(sep).includes("..");
}

function repoRelative(path) {
  const value = relative(repoRoot, resolve(path));
  return value.split(sep).join("/");
}

function finding(rule, location) {
  findings.push({ rule, location });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

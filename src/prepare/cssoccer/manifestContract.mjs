export const CSSOCCER_PREPARED_MANIFEST_SCHEMA = "cssoccer-prepared-manifest@1";
export const CSSOCCER_PREPARED_SCENE_SCHEMA = "cssoccer-prepared-match-scene@1";
export const CSSOCCER_PREPARED_FIXTURE_ID = "spain-argentina-full-match";
export const CSSOCCER_PREPARED_MANIFEST_PATH = "build/generated/public/cssoccer/manifest.json";
export const CSSOCCER_PREPARED_SCENE_PATH =
  "build/generated/public/cssoccer/scenes/spain-argentina-full-match.json";
export const CSSOCCER_PREPARED_SCENE_URL =
  "/cssoccer/scenes/spain-argentina-full-match.json";

const CONTROL_COUNTRIES = Object.freeze(["spain", "argentina"]);
const EXACT_PLAYER_RENDER_BINDING_ID = "exact-actua-player-one-basis";
const EXACT_OFFICIAL_RENDER_BINDING_ID = "exact-actua-official-one-basis";
const ANIMATION_STYLE_PATH = /^assets\/animation\/(?:(?:player-highlight-marker)\/(?:slot-[0-9]{3}|frames-[0-9]{6}-[0-9]{6})\.json|exact-(?:player|official)\/(?:index\.json|slot-[0-9]{3}\/frames-[0-9]{3}-[0-9]{3}\.json))$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/u;
const BINDING_KEYS = Object.freeze([
  "sourceDataSha256",
  "fixtureContractSha256",
  "nativeScenarioSha256",
  "nativeFieldContractSha256",
  "nativeCaptureSha256",
  "prepareInputsSha256",
]);
const ROOT_GROUPS = Object.freeze([
  Object.freeze({ key: "static", meshKind: "static", count: 9 }),
  Object.freeze({ key: "highlights", meshKind: "highlight", count: 1 }),
  Object.freeze({ key: "players", meshKind: "player", count: 22 }),
  Object.freeze({ key: "officials", meshKind: "official", count: 3 }),
  Object.freeze({ key: "ball", meshKind: "ball", count: 1 }),
]);
const ZERO_CONSTRUCTION_KEYS = Object.freeze([
  "sourceParseCount",
  "geometryBuildCount",
  "topologyBuildCount",
  "materialBuildCount",
  "atlasBuildCount",
  "assetBuildCount",
]);

export function validateCssoccerPreparedManifest(manifest) {
  requirePlainObject(manifest, "prepared manifest");
  if (manifest.schema !== CSSOCCER_PREPARED_MANIFEST_SCHEMA || manifest.status !== "ready") {
    throw new Error("Prepared css.soccer manifest must use the ready manifest contract.");
  }
  const defaultScene = validateManifestSceneEntry(manifest.defaultScene, "default scene");
  if (defaultScene.id !== CSSOCCER_PREPARED_FIXTURE_ID) {
    throw new Error("Prepared css.soccer manifest must default to the fixed Spain-Argentina fixture.");
  }
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length !== 1) {
    throw new Error("Prepared css.soccer manifest must contain exactly one scene.");
  }
  const scene = validateManifestSceneEntry(manifest.scenes[0], "scene entry");
  if (
    scene.id !== CSSOCCER_PREPARED_FIXTURE_ID
    || scene.sceneUrl !== CSSOCCER_PREPARED_SCENE_URL
    || defaultScene.sceneUrl !== scene.sceneUrl
    || defaultScene.bytes !== scene.bytes
    || defaultScene.sha256 !== scene.sha256
  ) {
    throw new Error("Prepared css.soccer scene entry changed the canonical fixture or URL.");
  }
  validateFixedFixture(manifest.fixture, "manifest fixture", { labels: true });
  requirePlainObject(manifest.bindings, "prepared manifest bindings");
  for (const key of BINDING_KEYS) requireSha256(manifest.bindings[key], key);
  validatePreparedFiles(manifest.preparedFiles, scene);
  validateProvenance(manifest.provenance);
  return manifest;
}

export function validateCssoccerPreparedScene(scene) {
  requirePlainObject(scene, "prepared scene");
  if (
    scene.schema !== CSSOCCER_PREPARED_SCENE_SCHEMA
    || scene.id !== CSSOCCER_PREPARED_FIXTURE_ID
    || scene.status !== "ready"
  ) {
    throw new Error("Prepared css.soccer scene changed the canonical scene contract.");
  }
  validateFixedFixture(scene.fixture, "scene fixture");
  if (
    scene.axes?.coordinateSpace !== "Actua renderer world"
    || scene.axes?.verticalAxis !== "y"
    || !finiteVec3(scene.cameraAnchor?.target)
    || !finiteVec3(scene.cameraAnchor?.playingFieldCenter)
  ) {
    throw new Error("Prepared css.soccer scene must bind its source renderer axes and camera anchor.");
  }
  const rootKinds = validateSceneRoots(scene.roots);
  validateSceneMeshes(scene.meshes, rootKinds);
  validateSkyBackdrop(scene.backdrop, scene.dimensions?.stadiumContext);
  validateSceneReferences(scene.preparedFiles);
  if (
    scene.preparedFiles.skyBackdrop.path !== scene.backdrop.asset.path
    || scene.preparedFiles.skyBackdrop.sha256 !== scene.backdrop.asset.sha256
  ) {
    throw new Error("Prepared css.soccer sky backdrop changed from its scene file binding.");
  }
  if (
    scene.native?.initialState?.status !== "ready"
    || scene.native.initialState.tick !== 0
    || scene.native.initialState.phase !== "post_tick"
    || scene.native.initialState.playerBindings !== 22
    || scene.native.initialState.ballBindings !== 1
  ) {
    throw new Error("Prepared css.soccer scene must bind the exact native tick-zero state.");
  }
  for (const value of [
    scene.native?.scenarioSha256,
    scene.native?.fieldContractSha256,
    scene.native?.captureSha256,
    scene.native?.initialState?.rawSha256,
    scene.native?.initialState?.stateSha256,
  ]) requireSha256(value, "prepared scene native binding");
  if (
    scene.metrics?.staticRootCount !== 9
    || scene.metrics?.highlightRootCount !== 1
    || scene.metrics?.playerRootCount !== 22
    || scene.metrics?.officialRootCount !== 3
    || scene.metrics?.exactOfficialRootCount !== 3
    || scene.metrics?.ballRootCount !== 1
    || scene.metrics?.skyBackdropRootCount !== 1
    || scene.metrics?.stableRootCount !== 37
    || scene.metrics?.mergeLossless !== true
  ) {
    throw new Error("Prepared css.soccer scene metrics changed from the exact fixed root contract.");
  }
  requirePlainObject(scene.runtimeConstruction, "prepared scene runtime construction");
  if (ZERO_CONSTRUCTION_KEYS.some((key) => scene.runtimeConstruction[key] !== 0)) {
    throw new Error("Prepared css.soccer scene may not require runtime construction.");
  }
  return scene;
}

function validateFixedFixture(fixture, label, { labels = false } = {}) {
  requirePlainObject(fixture, label);
  if (
    fixture.home?.country !== "spain"
    || fixture.home.sourceTeamId !== 2
    || fixture.away?.country !== "argentina"
    || fixture.away.sourceTeamId !== 20
    || (labels && (fixture.home.label !== "Spain" || fixture.away.label !== "Argentina"))
    || JSON.stringify(fixture.controlCountries) !== JSON.stringify(CONTROL_COUNTRIES)
    || fixture.durationMinutes !== 2
    || fixture.halfDurationMinutes !== 1
    || fixture.publiclyConfigurableDuration !== false
  ) {
    throw new Error(`Prepared css.soccer ${label} widened the fixed country or duration contract.`);
  }
}

function validateManifestSceneEntry(entry, label) {
  requirePlainObject(entry, `prepared manifest ${label}`);
  if (
    entry.sceneUrl !== CSSOCCER_PREPARED_SCENE_URL
    || !Number.isSafeInteger(entry.bytes)
    || entry.bytes <= 0
  ) {
    throw new Error(`Prepared css.soccer manifest ${label} is not byte-bound to the canonical URL.`);
  }
  requireSha256(entry.sha256, `prepared manifest ${label} sha256`);
  return entry;
}

function validatePreparedFiles(files, sceneEntry) {
  if (!Array.isArray(files) || files.length < 12) {
    throw new Error(
      "Prepared css.soccer manifest must bind its exact base files and only prepared animation sidecars.",
    );
  }
  const paths = new Set();
  for (const [index, descriptor] of files.entries()) {
    requirePlainObject(descriptor, `prepared file descriptor ${index}`);
    if (
      typeof descriptor.path !== "string"
      || descriptor.path.length === 0
      || descriptor.url !== `/cssoccer/${descriptor.path}`
      || typeof descriptor.mediaType !== "string"
      || !Number.isSafeInteger(descriptor.bytes)
      || descriptor.bytes <= 0
      || !Array.isArray(descriptor.references)
      || paths.has(descriptor.path)
    ) {
      throw new Error(`Prepared css.soccer file descriptor ${index} is not fully bound.`);
    }
    requireSha256(descriptor.sha256, `prepared file descriptor ${index} sha256`);
    requireSha256(descriptor.lineageSha256, `prepared file descriptor ${index} lineageSha256`);
    paths.add(descriptor.path);
  }
  const animationStylePaths = [...paths].filter((path) => path.startsWith("assets/animation/"));
  if (animationStylePaths.some((path) => !ANIMATION_STYLE_PATH.test(path))) {
    throw new Error("Prepared css.soccer manifest contains an unknown animation sidecar.");
  }
  const sceneDescriptor = files.find(({ path }) => (
    path === CSSOCCER_PREPARED_SCENE_URL.slice("/cssoccer/".length)
  ));
  if (
    sceneDescriptor?.bytes !== sceneEntry.bytes
    || sceneDescriptor?.sha256 !== sceneEntry.sha256
  ) {
    throw new Error("Prepared css.soccer manifest scene entry diverges from its file descriptor.");
  }
  const textureDescriptor = files.find(({ path }) => (
    path === "assets/textures/spain-argentina-match.png"
  ));
  if (
    textureDescriptor?.url !== "/cssoccer/assets/textures/spain-argentina-match.png"
    || textureDescriptor?.mediaType !== "image/png"
  ) {
    throw new Error("Prepared css.soccer manifest is missing its source-decoded match texture atlas.");
  }
  const preparedTexturePaths = [
    "assets/textures/spain-argentina-pitch.png",
    "assets/textures/spain-argentina-marking-pixel.png",
    "assets/textures/spain-argentina-hud-glyphs.png",
    "assets/textures/spain-argentina-stadium.png",
    "assets/textures/spain-argentina-sky.png",
    "assets/textures/spain-argentina-exact-player-materials.png",
    "assets/textures/spain-argentina-exact-official-materials.png",
  ];
  if (preparedTexturePaths.some((path) => {
    const descriptor = files.find((entry) => entry.path === path);
    return descriptor?.url !== `/cssoccer/${path}` || descriptor.mediaType !== "image/png";
  })) {
    throw new Error("Prepared css.soccer manifest is missing a source-decoded visual texture.");
  }
}

function validateProvenance(provenance) {
  requirePlainObject(provenance, "prepared manifest provenance");
  if (
    provenance.schema !== "cssoccer-prepared-provenance@1"
    || provenance.path !== "provenance.json"
    || provenance.url !== "/cssoccer/provenance.json"
    || !Number.isSafeInteger(provenance.bytes)
    || provenance.bytes <= 0
  ) {
    throw new Error("Prepared css.soccer manifest must bind its canonical provenance.");
  }
  requireSha256(provenance.sha256, "prepared manifest provenance sha256");
}

function validateSceneRoots(roots) {
  requirePlainObject(roots, "prepared scene roots");
  const rootKinds = new Map();
  for (const { key, meshKind, count } of ROOT_GROUPS) {
    const entries = roots[key];
    if (!Array.isArray(entries) || entries.length !== count) {
      throw new Error(`Prepared css.soccer scene requires exactly ${count} ${key} roots.`);
    }
    for (const root of entries) {
      if (
        !root
        || !SAFE_ID.test(root.id ?? "")
        || root.stableDom !== true
        || rootKinds.has(root.id)
      ) {
        throw new Error(`Prepared css.soccer ${key} root is not unique and stable.`);
      }
      rootKinds.set(root.id, meshKind);
    }
  }
  return rootKinds;
}

function validateSceneMeshes(meshes, rootKinds) {
  if (!Array.isArray(meshes) || meshes.length !== 36) {
    throw new Error("Prepared css.soccer scene must contain exactly 36 prepared mesh roots.");
  }
  const ids = new Set();
  const players = [];
  let ball = null;
  for (const [index, mesh] of meshes.entries()) {
    if (
      !mesh
      || !SAFE_ID.test(mesh.id ?? "")
      || ids.has(mesh.id)
      || rootKinds.get(mesh.id) !== mesh.kind
      || mesh.stableDom !== true
      || typeof mesh.bundleId !== "string"
      || mesh.bundleId.length === 0
      || (mesh.frameSetId !== null && typeof mesh.frameSetId !== "string")
      || !preparedTransform(mesh.transform)
      || Object.hasOwn(mesh, "polygons")
      || Object.hasOwn(mesh, "assets")
    ) {
      throw new Error(`Prepared css.soccer scene mesh ${index} is not a stable prepared binding.`);
    }
    if (mesh.kind === "player") players.push(mesh);
    if (mesh.kind === "ball") ball = mesh;
    if (mesh.kind === "player") {
      if (
        mesh.bundleId !== EXACT_PLAYER_RENDER_BINDING_ID
        || mesh.frameSetId !== null
        || mesh.initialFrameIndex !== null
      ) {
        throw new Error(`Prepared css.soccer exact player ${mesh.id} has a legacy frame set.`);
      }
    } else if (mesh.kind === "official") {
      if (
        mesh.bundleId !== EXACT_OFFICIAL_RENDER_BINDING_ID
        || mesh.frameSetId !== null
        || mesh.initialFrameIndex !== null
      ) {
        throw new Error(`Prepared css.soccer official ${mesh.id} lost its exact binding.`);
      }
    } else if (mesh.kind === "highlight") {
      if (
        typeof mesh.frameSetId !== "string"
        || mesh.frameSetId.length === 0
        || !Number.isSafeInteger(mesh.initialFrameIndex)
        || mesh.initialFrameIndex < 0
      ) {
        throw new Error(`Prepared css.soccer animated root ${mesh.id} has no prepared frame.`);
      }
    } else if (mesh.frameSetId !== null || mesh.initialFrameIndex !== null) {
      throw new Error(`Prepared css.soccer static root ${mesh.id} may not select an animation frame.`);
    }
    ids.add(mesh.id);
  }
  if (
    ids.size !== rootKinds.size
    || [...rootKinds.keys()].some((id) => !ids.has(id))
    || new Set(players.map(({ transform }) => transform.position.join(","))).size !== 22
    || JSON.stringify(ball?.transform?.position) !== "[640,2,-400]"
  ) {
    throw new Error("Prepared css.soccer scene root bindings overlap or changed kickoff placement.");
  }
}

function validateSceneReferences(preparedFiles) {
  requirePlainObject(preparedFiles, "prepared scene file references");
  for (const key of [
    "facts",
    "renderBundles",
    "exactPlayerIndex",
    "exactPlayerMaterials",
    "exactOfficialIndex",
    "exactOfficialMaterials",
    "skyBackdrop",
  ]) {
    const reference = preparedFiles[key];
    if (!reference || typeof reference.path !== "string" || reference.path.length === 0) {
      throw new Error(`Prepared css.soccer scene is missing its ${key} reference.`);
    }
    requireSha256(reference.sha256, `prepared scene ${key} sha256`);
  }
  if (new Set(Object.values(preparedFiles).map(({ path }) => path)).size
      !== Object.keys(preparedFiles).length) {
    throw new Error("Prepared css.soccer scene file references must be distinct.");
  }
}

function validateSkyBackdrop(backdrop, stadiumDimensions) {
  requirePlainObject(backdrop, "prepared sky backdrop");
  requirePlainObject(backdrop.asset, "prepared sky backdrop asset");
  requirePlainObject(backdrop.projection, "prepared sky backdrop projection");
  requirePlainObject(stadiumDimensions, "prepared stadium dimensions");
  if (
    backdrop.schema !== "cssoccer-prepared-sky-backdrop@1"
    || backdrop.id !== "sky-backdrop"
    || backdrop.kind !== "sky"
    || backdrop.sourceId !== "BM_C1X/COL_C1X"
    || backdrop.stableDom !== true
    || backdrop.runtimeConstruction !== false
    || backdrop.asset.path !== "assets/textures/spain-argentina-sky.png"
    || backdrop.asset.url !== "/cssoccer/assets/textures/spain-argentina-sky.png"
    || backdrop.asset.width !== 640
    || backdrop.asset.height !== 480
    || backdrop.projection.schema !== "cssoccer-native-sky-projection@1"
    || backdrop.projection.sourceFile !== "3DENG.C"
    || backdrop.projection.sourceRoutine !== "ground"
    || backdrop.projection.horizontalRepeat !== true
    || backdrop.projection.runtimeConstruction === true
    || !["st_w", "st_l", "st_h"].every((key) => (
      Number.isFinite(stadiumDimensions[key]) && stadiumDimensions[key] > 0
    ))
    || JSON.stringify(backdrop.stadiumDimensions) !== JSON.stringify(stadiumDimensions)
  ) {
    throw new Error("Prepared css.soccer sky backdrop changed its exact source binding.");
  }
  requireSha256(backdrop.asset.sha256, "prepared sky backdrop asset sha256");
}

function preparedTransform(value) {
  return value
    && Object.getPrototypeOf(value) === Object.prototype
    && JSON.stringify(Object.keys(value).sort()) === '["position","rotation","scale"]'
    && finiteVec3(value.position)
    && finiteVec3(value.rotation)
    && value.scale === 1;
}

function finiteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 binding.`);
  }
}

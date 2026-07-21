import { defaultSceneEntryForRoute } from "./routeState.mjs";
import {
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT,
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256,
} from "./playerHighlightContract.mjs";
import {
  CSSOCCER_PACKED_FRAME_LEAF_STYLES,
  configureCssoccerPackedFrameStyleLoader,
  installCssoccerPackedFrameStyles,
  preloadCssoccerPackedFrameStyles,
} from "./renderBundleMesh.mjs";
import { createCssoccerExactActuaPlayerAssetRuntime } from
  "./exactActuaPlayerAssets.mjs";

const PREPARE_COMMAND = "pnpm prepare:cssoccer";
const FIXTURE_ID = "spain-argentina-full-match";
const MANIFEST_SCHEMA = "cssoccer-prepared-manifest@1";
const SCENE_SCHEMA = "cssoccer-prepared-match-scene@1";
const RENDER_PUBLICATION_SCHEMA = "cssoccer-prepared-fixture-render-bundles@1";
const FACTS_SCHEMA = "cssoccer-prepared-fixture-facts@1";
const SCENE_URL = "/cssoccer/scenes/spain-argentina-full-match.json";
const TEXTURE_PATH = "assets/textures/spain-argentina-match.png";
const PITCH_TEXTURE_PATH = "assets/textures/spain-argentina-pitch.png";
const MARKING_PIXEL_PATH = "assets/textures/spain-argentina-marking-pixel.png";
const HUD_GLYPH_TEXTURE_PATH = "assets/textures/spain-argentina-hud-glyphs.png";
const STADIUM_TEXTURE_PATH = "assets/textures/spain-argentina-stadium.png";
const SKY_TEXTURE_PATH = "assets/textures/spain-argentina-sky.png";
const EXACT_PLAYER_TEXTURE_PATH = "assets/textures/spain-argentina-exact-player-materials.png";
const EXACT_PLAYER_INDEX_PATH = "assets/animation/exact-player/index.json";
const EXACT_PLAYER_MATERIALS_PATH = "assets/spain-argentina-exact-player-materials.json";
const EXACT_OFFICIAL_TEXTURE_PATH = "assets/textures/spain-argentina-exact-official-materials.png";
const EXACT_OFFICIAL_INDEX_PATH = "assets/animation/exact-official/index.json";
const EXACT_OFFICIAL_MATERIALS_PATH = "assets/spain-argentina-exact-official-materials.json";
const TEXTURE_PATHS = new Set([
  TEXTURE_PATH,
  PITCH_TEXTURE_PATH,
  MARKING_PIXEL_PATH,
  HUD_GLYPH_TEXTURE_PATH,
  STADIUM_TEXTURE_PATH,
  SKY_TEXTURE_PATH,
  EXACT_PLAYER_TEXTURE_PATH,
  EXACT_OFFICIAL_TEXTURE_PATH,
]);
const REQUIRED_FILES = Object.freeze([
  TEXTURE_PATH,
  PITCH_TEXTURE_PATH,
  MARKING_PIXEL_PATH,
  HUD_GLYPH_TEXTURE_PATH,
  STADIUM_TEXTURE_PATH,
  SKY_TEXTURE_PATH,
  EXACT_PLAYER_TEXTURE_PATH,
  EXACT_PLAYER_INDEX_PATH,
  EXACT_PLAYER_MATERIALS_PATH,
  EXACT_OFFICIAL_TEXTURE_PATH,
  EXACT_OFFICIAL_INDEX_PATH,
  EXACT_OFFICIAL_MATERIALS_PATH,
  "assets/spain-argentina-render-bundles.json",
  "facts/spain-argentina-full-match.json",
  "scenes/spain-argentina-full-match.json",
]);
const ANIMATION_STYLE_PATH = /^assets\/animation\/(?:(?:player-highlight-marker)\/(?:slot-[0-9]{3}|frames-[0-9]{6}-[0-9]{6})\.json|exact-(?:player|official)\/(?:index\.json|slot-[0-9]{3}\/frames-[0-9]{3}-[0-9]{3}\.json))$/u;
const HASH = /^[0-9a-f]{64}$/u;
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const NATIVE_REQUEST = /(?:^|\/)(?:native|oracle)(?:\/|$)|\.(?:exe|dll|lib)$/iu;
const SOURCE_REQUEST = /(?:^|\/)(?:source|\.local)(?:\/|$)|\.(?:c|cc|cpp|h|hpp|dat|obj|off)$/iu;

export function createCssoccerPreparedRequestAudit() {
  const counts = {
    preparedRequestCount: 0,
    nativeRequestCount: 0,
    sourceRequestCount: 0,
    rejectedRequestCount: 0,
  };
  const urls = [];

  return Object.freeze({
    record(url) {
      try {
        const checked = validatePreparedUrl(url);
        counts.preparedRequestCount += 1;
        urls.push(checked);
        return checked;
      } catch (error) {
        const value = String(url ?? "");
        if (NATIVE_REQUEST.test(value)) counts.nativeRequestCount += 1;
        if (SOURCE_REQUEST.test(value)) counts.sourceRequestCount += 1;
        counts.rejectedRequestCount += 1;
        throw error;
      }
    },
    snapshot() {
      return Object.freeze({
        ...counts,
        urls: Object.freeze([...urls]),
      });
    },
  });
}

export async function loadPreparedManifest(
  routeState,
  fetchImpl = globalThis.fetch,
  requestAudit = createCssoccerPreparedRequestAudit(),
) {
  if (routeState?.fixtureId !== FIXTURE_ID || routeState?.manifestUrl !== "/cssoccer/manifest.json") {
    throw new Error("css.soccer runtime accepts only the canonical prepared fixture route.");
  }
  const manifest = await fetchPreparedJson(routeState.manifestUrl, fetchImpl, requestAudit, {
    notFoundMessage: missingPreparedManifestMessage(routeState.manifestUrl),
  });
  assertPreparedManifest(manifest, routeState);
  return manifest;
}

export async function loadPreparedMatchScene(
  manifest,
  routeState,
  fetchImpl = globalThis.fetch,
  requestAudit = createCssoccerPreparedRequestAudit(),
) {
  assertPreparedManifest(manifest, routeState);
  const entry = defaultSceneEntryForRoute(manifest, routeState);
  const sceneData = await fetchPreparedJson(entry.sceneUrl, fetchImpl, requestAudit, {
    bytes: entry.bytes,
    sha256: entry.sha256,
    notFoundMessage: "Missing prepared css.soccer match scene at " + entry.sceneUrl
      + ". Run " + PREPARE_COMMAND + " first.",
  });
  assertPreparedScene(sceneData, manifest, routeState);

  const renderReference = sceneData.preparedFiles.renderBundles;
  const renderDescriptor = descriptorForPath(manifest, renderReference.path);
  if (renderDescriptor.sha256 !== renderReference.sha256) {
    throw new Error("Prepared render-bundle hash changed between scene and manifest.");
  }
  const renderAssets = await fetchPreparedJson(
    renderDescriptor.url,
    fetchImpl,
    requestAudit,
    {
      bytes: renderDescriptor.bytes,
      sha256: renderDescriptor.sha256,
      notFoundMessage: "Missing prepared css.soccer render bundles at " + renderDescriptor.url
        + ". Run " + PREPARE_COMMAND + " first.",
    },
  );
  if (
    !isPlainObject(renderAssets)
    || renderAssets.schema !== RENDER_PUBLICATION_SCHEMA
    || renderAssets.id !== FIXTURE_ID
    || renderAssets.status !== "ready"
  ) {
    throw new Error("Prepared css.soccer render-bundle publication is not canonical and ready.");
  }
  for (const frameSet of renderAssets.frameSets ?? []) {
    if (frameSet.frameLeafStyleEncoding !== CSSOCCER_PACKED_FRAME_LEAF_STYLES) continue;
    const promises = new Map();
    for (const styleFile of frameSet.frameStyleFiles ?? []) {
      const descriptor = descriptorForPath(manifest, styleFile.path);
      const reference = renderDescriptor.references.find(({ path }) => path === descriptor.path);
      if (reference?.sha256 !== descriptor.sha256) {
        throw new Error(`Prepared animation sidecar ${descriptor.path} is not bound to the render publication.`);
      }
    }
    configureCssoccerPackedFrameStyleLoader(frameSet, (frameIndex) => {
      const styleFile = frameSet.frameStyleFiles.find(({ frameStart, frameEnd }) => (
        frameIndex >= frameStart && frameIndex < frameEnd
      ));
      if (!styleFile) {
        throw new Error(`Prepared animation frame ${frameIndex} has no sidecar for ${frameSet.id}.`);
      }
      let promise = promises.get(styleFile.path);
      if (!promise) {
        const descriptor = descriptorForPath(manifest, styleFile.path);
        promise = fetchPreparedJson(descriptor.url, fetchImpl, requestAudit, {
          bytes: descriptor.bytes,
          sha256: descriptor.sha256,
          notFoundMessage: "Missing prepared css.soccer animation styles at " + descriptor.url
            + ". Run " + PREPARE_COMMAND + " first.",
        }).then((sidecar) => installCssoccerPackedFrameStyles(frameSet, sidecar));
        promises.set(styleFile.path, promise);
        promise.then(
          () => {
            if (promises.get(styleFile.path) === promise) promises.delete(styleFile.path);
          },
          () => {
            if (promises.get(styleFile.path) === promise) promises.delete(styleFile.path);
          },
        );
      }
      return promise;
    });
  }
  assertNoPrivateRuntimePayload(renderAssets, "prepared render-bundle publication");

  const exactPlayerIndexReference = sceneData.preparedFiles.exactPlayerIndex;
  const exactPlayerIndexDescriptor = descriptorForPath(manifest, EXACT_PLAYER_INDEX_PATH);
  if (exactPlayerIndexDescriptor.sha256 !== exactPlayerIndexReference?.sha256) {
    throw new Error("Prepared exact-player index hash changed between scene and manifest.");
  }
  const exactPlayerIndex = await fetchPreparedJson(
    exactPlayerIndexDescriptor.url,
    fetchImpl,
    requestAudit,
    {
      bytes: exactPlayerIndexDescriptor.bytes,
      sha256: exactPlayerIndexDescriptor.sha256,
      notFoundMessage: "Missing prepared exact Actua player index at "
        + exactPlayerIndexDescriptor.url
        + ". Run " + PREPARE_COMMAND + " first.",
    },
  );
  const exactPlayerMaterialsReference = sceneData.preparedFiles.exactPlayerMaterials;
  const exactPlayerMaterialsDescriptor = descriptorForPath(manifest, EXACT_PLAYER_MATERIALS_PATH);
  if (exactPlayerMaterialsDescriptor.sha256 !== exactPlayerMaterialsReference?.sha256) {
    throw new Error("Prepared exact-player material hash changed between scene and manifest.");
  }
  const exactPlayerMaterials = await fetchPreparedJson(
    exactPlayerMaterialsDescriptor.url,
    fetchImpl,
    requestAudit,
    {
      bytes: exactPlayerMaterialsDescriptor.bytes,
      sha256: exactPlayerMaterialsDescriptor.sha256,
      notFoundMessage: "Missing prepared exact Actua player materials at "
        + exactPlayerMaterialsDescriptor.url
        + ". Run " + PREPARE_COMMAND + " first.",
    },
  );
  const exactPlayerAssets = createCssoccerExactActuaPlayerAssetRuntime({
    index: exactPlayerIndex,
    materials: exactPlayerMaterials,
    loadChunk(chunkDescriptor) {
      const descriptor = descriptorForPath(manifest, chunkDescriptor.path);
      if (
        descriptor.bytes !== chunkDescriptor.bytes
        || descriptor.sha256 !== chunkDescriptor.sha256
      ) throw new Error(`Prepared exact-player chunk ${chunkDescriptor.path} is not manifest-bound.`);
      return fetchPreparedJson(descriptor.url, fetchImpl, requestAudit, {
        bytes: descriptor.bytes,
        sha256: descriptor.sha256,
        notFoundMessage: "Missing prepared exact Actua player animation chunk at "
          + descriptor.url + ". Run " + PREPARE_COMMAND + " first.",
      });
    },
  });
  assertPreparedExactPlayers(exactPlayerAssets);

  const exactOfficialIndexReference = sceneData.preparedFiles.exactOfficialIndex;
  const exactOfficialIndexDescriptor = descriptorForPath(manifest, EXACT_OFFICIAL_INDEX_PATH);
  if (exactOfficialIndexDescriptor.sha256 !== exactOfficialIndexReference?.sha256) {
    throw new Error("Prepared exact-official index hash changed between scene and manifest.");
  }
  const exactOfficialIndex = await fetchPreparedJson(
    exactOfficialIndexDescriptor.url,
    fetchImpl,
    requestAudit,
    {
      bytes: exactOfficialIndexDescriptor.bytes,
      sha256: exactOfficialIndexDescriptor.sha256,
      notFoundMessage: "Missing prepared exact Actua official index at "
        + exactOfficialIndexDescriptor.url
        + ". Run " + PREPARE_COMMAND + " first.",
    },
  );
  const exactOfficialMaterialsReference = sceneData.preparedFiles.exactOfficialMaterials;
  const exactOfficialMaterialsDescriptor = descriptorForPath(
    manifest,
    EXACT_OFFICIAL_MATERIALS_PATH,
  );
  if (exactOfficialMaterialsDescriptor.sha256 !== exactOfficialMaterialsReference?.sha256) {
    throw new Error("Prepared exact-official material hash changed between scene and manifest.");
  }
  const exactOfficialMaterials = await fetchPreparedJson(
    exactOfficialMaterialsDescriptor.url,
    fetchImpl,
    requestAudit,
    {
      bytes: exactOfficialMaterialsDescriptor.bytes,
      sha256: exactOfficialMaterialsDescriptor.sha256,
      notFoundMessage: "Missing prepared exact Actua official materials at "
        + exactOfficialMaterialsDescriptor.url
        + ". Run " + PREPARE_COMMAND + " first.",
    },
  );
  const exactOfficialAssets = createCssoccerExactActuaPlayerAssetRuntime({
    index: exactOfficialIndex,
    materials: exactOfficialMaterials,
    loadChunk(chunkDescriptor) {
      const descriptor = descriptorForPath(manifest, chunkDescriptor.path);
      if (
        descriptor.bytes !== chunkDescriptor.bytes
        || descriptor.sha256 !== chunkDescriptor.sha256
      ) throw new Error(`Prepared exact-official chunk ${chunkDescriptor.path} is not manifest-bound.`);
      return fetchPreparedJson(descriptor.url, fetchImpl, requestAudit, {
        bytes: descriptor.bytes,
        sha256: descriptor.sha256,
        notFoundMessage: "Missing prepared exact Actua official animation chunk at "
          + descriptor.url + ". Run " + PREPARE_COMMAND + " first.",
      });
    },
  });
  assertPreparedExactOfficials(exactOfficialAssets);

  const factsReference = sceneData.preparedFiles.facts;
  const factsDescriptor = descriptorForPath(manifest, factsReference.path);
  if (factsDescriptor.sha256 !== factsReference.sha256) {
    throw new Error("Prepared fixture-facts hash changed between scene and manifest.");
  }
  const preparedFacts = await fetchPreparedJson(
    factsDescriptor.url,
    fetchImpl,
    requestAudit,
    {
      bytes: factsDescriptor.bytes,
      sha256: factsDescriptor.sha256,
      notFoundMessage: "Missing prepared css.soccer fixture facts at " + factsDescriptor.url
        + ". Run " + PREPARE_COMMAND + " first.",
    },
  );
  assertPreparedFacts(preparedFacts);

  return Object.freeze({
    entry,
    sceneData,
    renderAssets,
    exactPlayerAssets,
    exactOfficialAssets,
    preparedFacts,
  });
}

export function assertPreparedExactPlayers(value) {
  if (
    value?.schema !== "cssoccer-exact-actua-player-asset-runtime@1"
    || value.index?.schema !== "cssoccer-exact-actua-player-animation-index@1"
    || value.index?.counts?.samples !== 140_568
    || value.index?.counts?.faceStates !== 1_827_384
    || value.materials?.schema !== "cssoccer-exact-actua-player-materials@1"
    || value.materials?.counts?.fixturePlayers !== 22
    || value.materials?.geometryId !== value.index?.geometryId
    || value.materials?.topologySha256 !== value.index?.topologySha256
  ) {
    throw new Error("Prepared exact Actua player publication is incomplete.");
  }
  assertNoPrivateRuntimePayload(value.index, "prepared exact Actua player index");
  assertNoPrivateRuntimePayload(value.materials, "prepared exact Actua player materials");
  return value;
}

export function assertPreparedExactOfficials(value) {
  if (
    value?.schema !== "cssoccer-exact-actua-official-asset-runtime@1"
    || value.index?.schema !== "cssoccer-exact-actua-official-animation-index@1"
    || value.index?.counts?.samples !== 1_632
    || value.index?.counts?.faceStates !== 19_584
    || value.materials?.schema !== "cssoccer-exact-actua-official-materials@1"
    || value.materials?.counts?.fixtureOfficials !== 3
    || value.materials?.geometryId !== value.index?.geometryId
    || value.materials?.topologySha256 !== value.index?.topologySha256
  ) {
    throw new Error("Prepared exact Actua official publication is incomplete.");
  }
  assertNoPrivateRuntimePayload(value.index, "prepared exact Actua official index");
  assertNoPrivateRuntimePayload(value.materials, "prepared exact Actua official materials");
  return value;
}

/** Preload only the animation slots needed for the first visible composition. */
export async function loadPreparedAnimationFrameStyles(
  renderAssets,
  frameRequests,
) {
  if (!isPlainObject(renderAssets)
      || !Array.isArray(renderAssets.frameSets)
      || !Array.isArray(frameRequests)) {
    throw new Error("Prepared cssoccer animation publication is incomplete.");
  }
  const frameSets = new Map(renderAssets.frameSets.map((frameSet) => [frameSet.id, frameSet]));
  const uniqueRequests = new Map();
  for (const request of frameRequests) {
    const frameSet = frameSets.get(request?.frameSetId);
    if (!frameSet || !Number.isSafeInteger(request.frameIndex)) {
      throw new Error("Prepared cssoccer animation preload request is invalid.");
    }
    if (frameSet.frameLeafStyleEncoding !== CSSOCCER_PACKED_FRAME_LEAF_STYLES) continue;
    const styleFile = frameSet.frameStyleFiles.find(({ frameStart, frameEnd }) => (
      request.frameIndex >= frameStart && request.frameIndex < frameEnd
    ));
    if (!styleFile) throw new Error(`Prepared cssoccer frame ${request.frameIndex} is unbound.`);
    uniqueRequests.set(styleFile.path, { frameSet, frameIndex: request.frameIndex });
  }
  await Promise.all([...uniqueRequests.values()].map(({ frameSet, frameIndex }) => (
    preloadCssoccerPackedFrameStyles(frameSet, frameIndex)
  )));
  return uniqueRequests.size;
}

export function assertPreparedFacts(value) {
  if (
    !isPlainObject(value)
    || value.schema !== FACTS_SCHEMA
    || value.id !== FIXTURE_ID
    || value.status !== "ready"
    || !Array.isArray(value.countries)
    || value.countries.length !== 2
    || value.control?.countries?.join(",") !== "spain,argentina"
    || value.teams?.schema !== "cssoccer-team-preparation@1"
    || value.teams?.starters?.length !== 22
    || value.tactics?.schema !== "cssoccer-prepared-tactics@1"
    || value.tactics?.formationId !== 0
    || value.tactics?.values?.length !== 70
    || value.playerHighlight?.schema !== "cssoccer-prepared-player-highlight@1"
    || value.playerHighlight.contractSha256 !== CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256
    || value.playerHighlight.rootId !== "player-highlight-local-user-1"
    || value.playerHighlight.frameSetId !== "player-highlight-marker"
    || value.playerHighlight.bundleId !== "player-highlight-marker"
    || value.playerHighlight.sourcePointListSha256
      !== CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.geometry.sourcePointListSha256
    || value.playerHighlight.stableLeafCount !== 1
    || value.playerHighlight.frameIds?.join(",")
      !== CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.markerFamilies.map(({ id }) => id).join(",")
  ) {
    throw new Error("Prepared css.soccer fixture facts are not canonical and ready.");
  }
  assertNoPrivateRuntimePayload(value, "prepared fixture facts");
  return value;
}

export function missingPreparedManifestMessage(url) {
  return "Missing prepared css.soccer manifest at " + url
    + ". Run " + PREPARE_COMMAND + " first.";
}

export function assertPreparedManifest(manifest, routeState) {
  if (
    !isPlainObject(manifest)
    || manifest.schema !== MANIFEST_SCHEMA
    || manifest.status !== "ready"
  ) {
    throw new Error("Prepared css.soccer manifest is not ready. Run " + PREPARE_COMMAND + " first.");
  }
  const entry = defaultSceneEntryForRoute(manifest, routeState);
  if (
    manifest.defaultScene?.id !== FIXTURE_ID
    || manifest.defaultScene?.sceneUrl !== SCENE_URL
    || !entry
    || entry.sceneUrl !== SCENE_URL
    || !Number.isSafeInteger(entry.bytes)
    || entry.bytes <= 0
    || !HASH.test(entry.sha256 ?? "")
  ) {
    throw new Error("Prepared css.soccer manifest changed its one canonical scene.");
  }
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length !== 1) {
    throw new Error("Prepared css.soccer manifest must publish exactly one scene.");
  }
  const fixture = manifest.fixture;
  if (
    fixture?.home?.country !== "spain"
    || fixture.home.sourceTeamId !== 2
    || fixture?.away?.country !== "argentina"
    || fixture.away.sourceTeamId !== 20
    || JSON.stringify(fixture.controlCountries) !== '["spain","argentina"]'
    || fixture.durationMinutes !== 2
    || fixture.halfDurationMinutes !== 1
    || fixture.publiclyConfigurableDuration !== false
  ) {
    throw new Error("Prepared css.soccer manifest widened the fixed match contract.");
  }
  const bindingKeys = [
    "sourceDataSha256",
    "fixtureContractSha256",
    "nativeScenarioSha256",
    "nativeFieldContractSha256",
    "nativeCaptureSha256",
    "prepareInputsSha256",
  ];
  if (!isPlainObject(manifest.bindings)
      || bindingKeys.some((key) => !HASH.test(manifest.bindings[key] ?? ""))) {
    throw new Error("Prepared css.soccer manifest is missing exact source/native bindings.");
  }
  if (!Array.isArray(manifest.preparedFiles)
      || manifest.preparedFiles.length < REQUIRED_FILES.length) {
    throw new Error("Prepared css.soccer manifest changed its prepared file set.");
  }
  const paths = manifest.preparedFiles.map((descriptor) => validatePreparedDescriptor(descriptor));
  const pathSet = new Set(paths);
  if (pathSet.size !== paths.length
      || REQUIRED_FILES.some((path) => !pathSet.has(path))
      || paths.some((path) => (
        !REQUIRED_FILES.includes(path) && !ANIMATION_STYLE_PATH.test(path)
      ))) {
    throw new Error("Prepared css.soccer manifest changed its prepared file set.");
  }
  if (
    manifest.provenance?.schema !== "cssoccer-prepared-provenance@1"
    || manifest.provenance.path !== "provenance.json"
    || manifest.provenance.url !== "/cssoccer/provenance.json"
    || !Number.isSafeInteger(manifest.provenance.bytes)
    || manifest.provenance.bytes <= 0
    || !HASH.test(manifest.provenance.sha256 ?? "")
  ) {
    throw new Error("Prepared css.soccer manifest is missing its bound provenance.");
  }
  assertNoPrivateRuntimePayload(manifest, "prepared manifest");
  return manifest;
}

export function assertPreparedScene(sceneData, manifest, routeState) {
  if (
    !isPlainObject(sceneData)
    || sceneData.schema !== SCENE_SCHEMA
    || sceneData.id !== routeState.fixtureId
    || sceneData.status !== "ready"
  ) {
    throw new Error("Prepared css.soccer scene id or schema does not match the canonical fixture.");
  }
  const fixture = sceneData.fixture;
  if (
    fixture?.home?.country !== "spain"
    || fixture.home.sourceTeamId !== 2
    || fixture?.away?.country !== "argentina"
    || fixture.away.sourceTeamId !== 20
    || JSON.stringify(fixture.controlCountries) !== '["spain","argentina"]'
    || fixture.durationMinutes !== 2
    || fixture.halfDurationMinutes !== 1
    || fixture.publiclyConfigurableDuration !== false
  ) {
    throw new Error("Prepared css.soccer scene widened the fixed match contract.");
  }
  if (!Array.isArray(sceneData.meshes) || sceneData.meshes.length !== 36) {
    throw new Error("Prepared css.soccer scene must bind exactly 36 prepared mesh roots.");
  }
  if (
    !isPlainObject(sceneData.axes)
    || sceneData.axes.coordinateSpace !== "Actua renderer world"
    || sceneData.axes.verticalAxis !== "y"
    || !isFiniteVec3(sceneData.cameraAnchor?.target)
    || !isFiniteVec3(sceneData.cameraAnchor?.playingFieldCenter)
  ) {
    throw new Error("Prepared css.soccer scene is missing its source-axis camera anchor.");
  }
  const renderReference = validateSceneReference(
    sceneData.preparedFiles?.renderBundles,
    "assets/spain-argentina-render-bundles.json",
  );
  const factsReference = validateSceneReference(
    sceneData.preparedFiles?.facts,
    "facts/spain-argentina-full-match.json",
  );
  const exactPlayerIndexReference = validateSceneReference(
    sceneData.preparedFiles?.exactPlayerIndex,
    EXACT_PLAYER_INDEX_PATH,
  );
  const exactPlayerMaterialsReference = validateSceneReference(
    sceneData.preparedFiles?.exactPlayerMaterials,
    EXACT_PLAYER_MATERIALS_PATH,
  );
  const exactOfficialIndexReference = validateSceneReference(
    sceneData.preparedFiles?.exactOfficialIndex,
    EXACT_OFFICIAL_INDEX_PATH,
  );
  const exactOfficialMaterialsReference = validateSceneReference(
    sceneData.preparedFiles?.exactOfficialMaterials,
    EXACT_OFFICIAL_MATERIALS_PATH,
  );
  const skyBackdropReference = validateSceneReference(
    sceneData.preparedFiles?.skyBackdrop,
    SKY_TEXTURE_PATH,
  );
  if (
    !isPlainObject(sceneData.backdrop)
    || sceneData.backdrop.schema !== "cssoccer-prepared-sky-backdrop@1"
    || sceneData.backdrop.id !== "sky-backdrop"
    || sceneData.backdrop.kind !== "sky"
    || sceneData.backdrop.sourceId !== "BM_C1X/COL_C1X"
    || sceneData.backdrop.stableDom !== true
    || sceneData.backdrop.runtimeConstruction !== false
    || sceneData.backdrop.asset?.path !== SKY_TEXTURE_PATH
    || sceneData.backdrop.asset?.url !== `/cssoccer/${SKY_TEXTURE_PATH}`
    || sceneData.backdrop.asset?.width !== 640
    || sceneData.backdrop.asset?.height !== 480
    || sceneData.backdrop.asset?.sha256 !== skyBackdropReference.sha256
    || sceneData.backdrop.projection?.schema !== "cssoccer-native-sky-projection@1"
    || sceneData.backdrop.projection?.sourceFile !== "3DENG.C"
    || sceneData.backdrop.projection?.sourceRoutine !== "ground"
    || sceneData.backdrop.projection?.horizontalRepeat !== true
    || !isPlainObject(sceneData.backdrop.stadiumDimensions)
  ) {
    throw new Error("Prepared css.soccer scene is missing its exact source sky backdrop.");
  }
  for (const reference of [
    renderReference,
    factsReference,
    exactPlayerIndexReference,
    exactPlayerMaterialsReference,
    exactOfficialIndexReference,
    exactOfficialMaterialsReference,
    skyBackdropReference,
  ]) {
    const descriptor = descriptorForPath(manifest, reference.path);
    if (descriptor.sha256 !== reference.sha256) {
      throw new Error(`Prepared scene reference ${reference.path} changed from the manifest binding.`);
    }
  }
  assertNoPrivateRuntimePayload(sceneData, "prepared scene");
  return sceneData;
}

function descriptorForPath(manifest, path) {
  const descriptors = manifest.preparedFiles.filter((descriptor) => descriptor.path === path);
  if (descriptors.length !== 1) {
    throw new Error(`Prepared css.soccer manifest does not bind ${path} exactly once.`);
  }
  return descriptors[0];
}

function validatePreparedDescriptor(descriptor) {
  if (!isPlainObject(descriptor)) throw new Error("Prepared file descriptor must be an object.");
  const path = validatePreparedPath(descriptor.path);
  const expectedMediaType = TEXTURE_PATHS.has(path) ? "image/png" : "application/json";
  if (
    descriptor.url !== `/cssoccer/${path}`
    || descriptor.mediaType !== expectedMediaType
    || !Number.isSafeInteger(descriptor.bytes)
    || descriptor.bytes <= 0
    || !HASH.test(descriptor.sha256 ?? "")
    || !HASH.test(descriptor.lineageSha256 ?? "")
    || !Array.isArray(descriptor.references)
  ) {
    throw new Error(`Prepared file descriptor ${path} is not fully bound.`);
  }
  if (!TEXTURE_PATHS.has(path)) validatePreparedUrl(descriptor.url);
  return path;
}

function validateSceneReference(reference, expectedPath) {
  if (
    !isPlainObject(reference)
    || reference.path !== expectedPath
    || !HASH.test(reference.sha256 ?? "")
  ) {
    throw new Error(`Prepared scene must bind ${expectedPath}.`);
  }
  return reference;
}

async function fetchPreparedJson(url, fetchImpl, requestAudit, expected) {
  if (typeof fetchImpl !== "function") {
    throw new Error("css.soccer requires fetch to load prepared output.");
  }
  if (!requestAudit || typeof requestAudit.record !== "function") {
    throw new Error("css.soccer prepared requests require an audit counter.");
  }
  const checkedUrl = requestAudit.record(url);
  const response = await fetchImpl(checkedUrl);
  if (!response?.ok) {
    if (response?.status === 404) throw new Error(expected.notFoundMessage);
    throw new Error("Failed to load " + checkedUrl + ": " + (response?.status ?? "no response"));
  }
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Expected prepared JSON from " + checkedUrl + ". Run " + PREPARE_COMMAND + " first.");
  }
  if (typeof response.arrayBuffer !== "function") {
    throw new Error("Prepared response from " + checkedUrl + " did not expose exact bytes.");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (expected.bytes !== undefined && bytes.byteLength !== expected.bytes) {
    throw new Error(`Prepared response byte count changed for ${checkedUrl}.`);
  }
  if (expected.sha256 !== undefined) {
    const actual = await sha256Hex(bytes);
    if (actual !== expected.sha256) {
      throw new Error(`Prepared response SHA-256 changed for ${checkedUrl}.`);
    }
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`Prepared response from ${checkedUrl} is not valid UTF-8.`, { cause: error });
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Prepared response from ${checkedUrl} is not valid JSON.`, { cause: error });
  }
}

function validatePreparedUrl(value) {
  if (
    typeof value !== "string"
    || !value.startsWith("/cssoccer/")
    || value.includes("\\")
    || value.includes("%")
    || value.includes("?")
    || value.includes("#")
    || value.includes("//")
    || NATIVE_REQUEST.test(value)
    || SOURCE_REQUEST.test(value)
  ) {
    throw new Error(`Runtime request is not a canonical prepared css.soccer JSON URL: ${String(value)}.`);
  }
  const path = value.slice("/cssoccer/".length);
  validatePreparedPath(path);
  if (!path.endsWith(".json")) {
    throw new Error(`Runtime request is not prepared JSON: ${value}.`);
  }
  return value;
}

function validatePreparedPath(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Prepared runtime path must be a non-empty string.");
  }
  const segments = value.split("/");
  if (segments.some((segment) => !SAFE_PATH_SEGMENT.test(segment))) {
    throw new Error(`Prepared runtime path is not canonical: ${value}.`);
  }
  return value;
}

async function sha256Hex(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("css.soccer requires Web Crypto to verify prepared output.");
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function assertNoPrivateRuntimePayload(value, label) {
  const text = JSON.stringify(value);
  if (/(?:\/Users\/|\/home\/|\/Volumes\/|\/private\/(?:tmp|var)\/|\/tmp\/|\/var\/folders\/|(?:^|[^A-Za-z0-9._-])\.local[\\/]|file:(?:\/\/)?|(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/])/iu.test(text)) {
    throw new Error(`${label} leaks a private or ignored local path.`);
  }
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function isFiniteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

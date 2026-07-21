import assert from "node:assert/strict";
import test from "node:test";

import {
  CSSOCCER_PREPARED_FIXTURE_ID,
  CSSOCCER_PREPARED_MANIFEST_PATH,
  CSSOCCER_PREPARED_SCENE_PATH,
  CSSOCCER_PREPARED_SCENE_URL,
  validateCssoccerPreparedManifest,
  validateCssoccerPreparedScene,
} from "../src/prepare/cssoccer/manifestContract.mjs";

const HASH = "ab".repeat(32);

function manifest() {
  const sceneEntry = {
    id: CSSOCCER_PREPARED_FIXTURE_ID,
    sceneUrl: CSSOCCER_PREPARED_SCENE_URL,
    bytes: 123,
    sha256: HASH,
  };
  return {
    schema: "cssoccer-prepared-manifest@1",
    status: "ready",
    defaultScene: { ...sceneEntry },
    scenes: [{ ...sceneEntry }],
    fixture: {
      home: { country: "spain", label: "Spain", sourceTeamId: 2 },
      away: { country: "argentina", label: "Argentina", sourceTeamId: 20 },
      controlCountries: ["spain", "argentina"],
      durationMinutes: 2,
      halfDurationMinutes: 1,
      publiclyConfigurableDuration: false,
    },
    bindings: {
      sourceDataSha256: HASH,
      fixtureContractSha256: HASH,
      nativeScenarioSha256: HASH,
      nativeFieldContractSha256: HASH,
      nativeCaptureSha256: HASH,
      prepareInputsSha256: HASH,
    },
    preparedFiles: [
      descriptor("assets/render.json", 100),
      descriptor("assets/textures/spain-argentina-hud-glyphs.png", 125, "image/png"),
      descriptor("assets/textures/spain-argentina-match.png", 150, "image/png"),
      descriptor("assets/textures/spain-argentina-marking-pixel.png", 1, "image/png"),
      descriptor("assets/textures/spain-argentina-pitch.png", 175, "image/png"),
      descriptor("assets/textures/spain-argentina-stadium.png", 180, "image/png"),
      descriptor("assets/textures/spain-argentina-sky.png", 182, "image/png"),
      descriptor("assets/textures/spain-argentina-exact-player-materials.png", 185, "image/png"),
      descriptor("assets/textures/spain-argentina-exact-official-materials.png", 187, "image/png"),
      descriptor("assets/animation/exact-player/index.json", 190),
      descriptor("assets/spain-argentina-exact-player-materials.json", 195),
      descriptor("assets/animation/exact-official/index.json", 197),
      descriptor("assets/spain-argentina-exact-official-materials.json", 198),
      descriptor("facts/fixture.json", 200),
      descriptor("scenes/spain-argentina-full-match.json", 123),
    ],
    provenance: {
      schema: "cssoccer-prepared-provenance@1",
      path: "provenance.json",
      url: "/cssoccer/provenance.json",
      bytes: 300,
      sha256: HASH,
    },
  };
}

function descriptor(path, bytes, mediaType = "application/json") {
  return {
    path,
    url: `/cssoccer/${path}`,
    mediaType,
    bytes,
    sha256: HASH,
    lineageSha256: HASH,
    references: [],
  };
}

function scene() {
  const roots = {
    static: Array.from({ length: 9 }, (_, index) => stableRoot(`static-${index + 1}`)),
    highlights: [stableRoot("player-highlight-local-user-1")],
    players: ["spain", "argentina"].flatMap((country) => (
      Array.from({ length: 11 }, (_, index) => stableRoot(
        `${country}-player-${String(index + 1).padStart(2, "0")}`,
      ))
    )),
    officials: Array.from({ length: 3 }, (_, index) => stableRoot(`official-${index + 1}`)),
    ball: [stableRoot("ball-00")],
  };
  const transform = (position) => ({ position, rotation: [0, 0, 0], scale: 1 });
  const meshes = [
    ...roots.static.map((root, index) => mesh(root.id, "static", transform([index, 0, 0]))),
    mesh(
      "player-highlight-local-user-1",
      "highlight",
      transform([0, 0, 0]),
      true,
    ),
    ...roots.players.map((root, index) => mesh(
      root.id,
      "player",
      transform([100 + index, 0, -100 - index]),
      true,
    )),
    ...roots.officials.map((root, index) => mesh(
      root.id,
      "official",
      transform([600 + index, 0, -400]),
      true,
    )),
    mesh("ball-00", "ball", transform([640, 2, -400])),
  ];
  return {
    schema: "cssoccer-prepared-match-scene@1",
    id: CSSOCCER_PREPARED_FIXTURE_ID,
    status: "ready",
    fixture: {
      home: { country: "spain", sourceTeamId: 2 },
      away: { country: "argentina", sourceTeamId: 20 },
      controlCountries: ["spain", "argentina"],
      durationMinutes: 2,
      halfDurationMinutes: 1,
      publiclyConfigurableDuration: false,
    },
    axes: { coordinateSpace: "Actua renderer world", verticalAxis: "y" },
    dimensions: { stadiumContext: { st_w: 190, st_l: 190, st_h: 290 } },
    cameraAnchor: { target: [640, 0, -400], playingFieldCenter: [640, 0, -400] },
    backdrop: skyBackdrop(),
    roots,
    meshes,
    preparedFiles: {
      facts: { path: "facts/fixture.json", sha256: HASH },
      renderBundles: { path: "assets/render.json", sha256: HASH },
      exactPlayerIndex: {
        path: "assets/animation/exact-player/index.json",
        sha256: HASH,
      },
      exactPlayerMaterials: {
        path: "assets/spain-argentina-exact-player-materials.json",
        sha256: HASH,
      },
      exactOfficialIndex: {
        path: "assets/animation/exact-official/index.json",
        sha256: HASH,
      },
      exactOfficialMaterials: {
        path: "assets/spain-argentina-exact-official-materials.json",
        sha256: HASH,
      },
      skyBackdrop: {
        path: "assets/textures/spain-argentina-sky.png",
        sha256: HASH,
      },
    },
    native: {
      scenarioSha256: HASH,
      fieldContractSha256: HASH,
      captureSha256: HASH,
      initialState: {
        status: "ready",
        tick: 0,
        phase: "post_tick",
        rawSha256: HASH,
        stateSha256: HASH,
        playerBindings: 22,
        ballBindings: 1,
      },
    },
    metrics: {
      staticRootCount: 9,
      highlightRootCount: 1,
      playerRootCount: 22,
      officialRootCount: 3,
      exactOfficialRootCount: 3,
      ballRootCount: 1,
      skyBackdropRootCount: 1,
      stableRootCount: 37,
      mergeLossless: true,
    },
    runtimeConstruction: {
      sourceParseCount: 0,
      geometryBuildCount: 0,
      topologyBuildCount: 0,
      materialBuildCount: 0,
      atlasBuildCount: 0,
      assetBuildCount: 0,
    },
  };
}

function skyBackdrop() {
  return {
    schema: "cssoccer-prepared-sky-backdrop@1",
    id: "sky-backdrop",
    kind: "sky",
    sourceId: "BM_C1X/COL_C1X",
    stableDom: true,
    asset: {
      path: "assets/textures/spain-argentina-sky.png",
      url: "/cssoccer/assets/textures/spain-argentina-sky.png",
      width: 640,
      height: 480,
      sha256: HASH,
    },
    projection: {
      schema: "cssoccer-native-sky-projection@1",
      sourceFile: "3DENG.C",
      sourceRoutine: "ground",
      horizontalRepeat: true,
    },
    stadiumDimensions: { st_w: 190, st_l: 190, st_h: 290 },
    runtimeConstruction: false,
  };
}

function stableRoot(id) {
  return { id, stableDom: true };
}

function mesh(id, kind, transform, animated = false) {
  if (kind === "player") {
    return {
      id,
      kind,
      stableDom: true,
      bundleId: "exact-actua-player-one-basis",
      frameSetId: null,
      transform,
      initialFrameIndex: null,
    };
  }
  if (kind === "official") {
    return {
      id,
      kind,
      stableDom: true,
      bundleId: "exact-actua-official-one-basis",
      frameSetId: null,
      transform,
      initialFrameIndex: null,
    };
  }
  return {
    id,
    kind,
    stableDom: true,
    bundleId: `bundle-${kind}`,
    frameSetId: animated ? `frames-${kind}` : null,
    transform,
    initialFrameIndex: animated ? 0 : null,
  };
}

test("the shared prepared seam fixes one manifest and scene path", () => {
  assert.equal(CSSOCCER_PREPARED_MANIFEST_PATH, "build/generated/public/cssoccer/manifest.json");
  assert.equal(
    CSSOCCER_PREPARED_SCENE_PATH,
    "build/generated/public/cssoccer/scenes/spain-argentina-full-match.json",
  );
  assert.equal(validateCssoccerPreparedManifest(manifest()).status, "ready");
  assert.equal(validateCssoccerPreparedScene(scene()).id, CSSOCCER_PREPARED_FIXTURE_ID);
});

test("the prepared seam rejects alternate products and unbound output", () => {
  const widened = manifest();
  widened.fixture.controlCountries.push("france");
  assert.throws(() => validateCssoccerPreparedManifest(widened), /widened/u);

  const alternate = manifest();
  alternate.scenes.push({ id: "other", sceneUrl: "/other.json" });
  assert.throws(() => validateCssoccerPreparedManifest(alternate), /exactly one scene/u);

  const unbound = manifest();
  unbound.bindings.nativeCaptureSha256 = null;
  assert.throws(() => validateCssoccerPreparedManifest(unbound), /SHA-256 binding/u);

  const overlapping = scene();
  const playerMeshes = overlapping.meshes.filter(({ kind }) => kind === "player");
  playerMeshes[1].transform.position = [...playerMeshes[0].transform.position];
  assert.throws(() => validateCssoccerPreparedScene(overlapping), /overlap|placement/u);
});

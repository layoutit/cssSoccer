import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Window } from "happy-dom";

import {
  createCssoccerPreparedRequestAudit,
  loadPreparedManifest,
  loadPreparedMatchScene,
} from "../src/cssoccer/manifestClient.mjs";
import { mountPreparedMatchScene } from "../src/cssoccer/polycssScene.mjs";
import { createCssoccerExactActuaPlayerAssetRuntime } from
  "../src/cssoccer/exactActuaPlayerAssets.mjs";
import { CSSOCCER_ACTUA_GAMEPLAY_CAMERA } from "../src/cssoccer/actuaGameplayCamera.mjs";
import { createCssoccerRouteState } from "../src/cssoccer/routeState.mjs";
import {
  buildCssoccerPreparedRenderBundle,
  buildCssoccerPreparedRenderFrameSet,
} from "../src/prepare/cssoccer/renderBundle.mjs";
import { CSSOCCER_LIVE_RENDER_FRAME_SCHEMA } from "../src/cssoccer/playerRenderState.mjs";
import {
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT,
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256,
} from "../src/cssoccer/playerHighlightContract.mjs";

const HASH = "ab".repeat(32);
const FIXTURE_ID = "spain-argentina-full-match";
const BUNDLE_PATH = "assets/spain-argentina-render-bundles.json";
const EXACT_PLAYER_INDEX_PATH = "assets/animation/exact-player/index.json";
const EXACT_PLAYER_MATERIALS_PATH = "assets/spain-argentina-exact-player-materials.json";
const EXACT_PLAYER_TEXTURE_PATH =
  "assets/textures/spain-argentina-exact-player-materials.png";
const EXACT_OFFICIAL_INDEX_PATH = "assets/animation/exact-official/index.json";
const EXACT_OFFICIAL_MATERIALS_PATH = "assets/spain-argentina-exact-official-materials.json";
const EXACT_OFFICIAL_TEXTURE_PATH =
  "assets/textures/spain-argentina-exact-official-materials.png";
const SKY_TEXTURE_PATH = "assets/textures/spain-argentina-sky.png";
const FACTS_PATH = "facts/spain-argentina-full-match.json";
const SCENE_PATH = "scenes/spain-argentina-full-match.json";
const GENERATED_ROOT = new URL("../build/generated/public/cssoccer/", import.meta.url);
const ZERO_CONSTRUCTION = Object.freeze({
  sourceParseCount: 0,
  geometryBuildCount: 0,
  topologyBuildCount: 0,
  materialBuildCount: 0,
  assetBuildCount: 0,
});

let fixturePromise;

test("loads the exact prepared manifest, scene, and bound render publication only", async () => {
  const fixture = await syntheticPreparedFixture();
  const audit = createCssoccerPreparedRequestAudit();
  const route = createCssoccerRouteState("");
  const fetchImpl = fixtureFetch(fixture.files);

  const manifest = await loadPreparedManifest(route, fetchImpl, audit);
  const loaded = await loadPreparedMatchScene(manifest, route, fetchImpl, audit);

  assert.deepEqual(loaded.sceneData, fixture.scene);
  assert.deepEqual(loaded.renderAssets, fixture.renderAssets);
  assert.equal(
    loaded.exactPlayerAssets.schema,
    "cssoccer-exact-actua-player-asset-runtime@1",
  );
  assert.deepEqual(loaded.exactPlayerAssets.index, fixture.exactPlayerAssets.index);
  assert.deepEqual(loaded.exactPlayerAssets.materials, fixture.exactPlayerAssets.materials);
  assert.equal(
    loaded.exactOfficialAssets.schema,
    "cssoccer-exact-actua-official-asset-runtime@1",
  );
  assert.deepEqual(loaded.exactOfficialAssets.index, fixture.exactOfficialAssets.index);
  assert.deepEqual(loaded.exactOfficialAssets.materials, fixture.exactOfficialAssets.materials);
  assert.deepEqual(loaded.preparedFacts, fixture.facts);
  assert.deepEqual(audit.snapshot(), {
    preparedRequestCount: 8,
    nativeRequestCount: 0,
    sourceRequestCount: 0,
    rejectedRequestCount: 0,
    urls: [
      "/cssoccer/manifest.json",
      "/cssoccer/scenes/spain-argentina-full-match.json",
      "/cssoccer/assets/spain-argentina-render-bundles.json",
      "/cssoccer/assets/animation/exact-player/index.json",
      "/cssoccer/assets/spain-argentina-exact-player-materials.json",
      "/cssoccer/assets/animation/exact-official/index.json",
      "/cssoccer/assets/spain-argentina-exact-official-materials.json",
      "/cssoccer/facts/spain-argentina-full-match.json",
    ],
  });

  const tamperedFiles = new Map(fixture.files);
  const originalRenderBytes = fixture.files.get(
    "/cssoccer/assets/spain-argentina-render-bundles.json",
  );
  tamperedFiles.set(
    "/cssoccer/assets/spain-argentina-render-bundles.json",
    Buffer.from(originalRenderBytes.toString("utf8").replace('"status":"ready"', '"status":"reedy"'), "utf8"),
  );
  await assert.rejects(
    loadPreparedMatchScene(
      manifest,
      route,
      fixtureFetch(tamperedFiles),
      createCssoccerPreparedRequestAudit(),
    ),
    /SHA-256 changed/u,
  );

  const rejectedAudit = createCssoccerPreparedRequestAudit();
  assert.throws(
    () => rejectedAudit.record("/cssoccer/native/state.json"),
    /not a canonical prepared/u,
  );
  assert.equal(rejectedAudit.snapshot().nativeRequestCount, 1);
  assert.equal(rejectedAudit.snapshot().preparedRequestCount, 0);
});

test("mounts every source-bound root including all three exact officials", async () => {
  const fixture = await syntheticPreparedFixture();
  const window = new Window({ url: "http://cssoccer.test/" });
  try {
    const host = window.document.createElement("section");
    host.id = "scene";
    window.document.body.append(host);
    const mounted = await mountPreparedMatchScene({
      host,
      sceneData: fixture.scene,
      renderAssets: fixture.renderAssets,
      exactPlayerAssets: fixture.exactPlayerAssets,
      exactOfficialAssets: fixture.exactOfficialAssets,
      initialLiveFrame: fixture.initialLiveFrame,
    });
    const stats = mounted.stats();

    assert.equal(host.querySelectorAll("[data-cssoccer-root-id]").length, 37);
    assert.equal(stats.rootCount, 37);
    assert.equal(stats.skyBackdropRootCount, 1);
    assert.equal(stats.staticRootCount, 9);
    assert.equal(stats.highlightRootCount, 1);
    assert.equal(stats.playerRootCount, 22);
    assert.equal(stats.officialRootCount, 3);
    assert.equal(stats.exactOfficialRootCount, 3);
    assert.equal(stats.ballRootCount, 1);
    assert.equal(stats.initialFrameRootCount, 1);
    assert.equal(stats.distinctPlayerPositionCount, 22);
    assert.deepEqual(stats.ballPosition, [640, 2, -400]);
    assert.equal(stats.stableIdentityCount, 37);
    assert.equal(stats.connectedRootCount, 37);
    assert.equal(stats.highlightVisible, false);
    assert.equal(stats.connectedLeafCount, stats.leafCount);
    assert.equal(stats.detachedLeafCount, 0);
    const exactPlayerLeaves = [...host.querySelectorAll("[data-cssoccer-exact-face-index]")];
    assert.equal(exactPlayerLeaves.length, 322);
    assert.ok(exactPlayerLeaves.every(({ isConnected }) => isConnected));
    assert.equal(
      new Set(exactPlayerLeaves.map(({ dataset }) => dataset.cssoccerExactGeometryId)).size,
      2,
    );
    assert.equal(stats.presentationInterpolationMs, 0);
    assert.equal(stats.presentationCameraInterpolated, false);
    assert.equal(stats.presentationInterpolatedRootCount, 0);
    assert.deepEqual(stats.runtimeConstruction, {
      ...ZERO_CONSTRUCTION,
      atlasBuildCount: 0,
    });
    assert.equal(stats.camera.schema, CSSOCCER_ACTUA_GAMEPLAY_CAMERA.schema);
    assert.equal(stats.camera.status, "source-gameplay-camera");
    assert.equal(stats.camera.coordinateSpace, "Actua renderer world");
    assert.equal(stats.camera.tick, 0);
    assert.equal(stats.camera.sourceMode, 8);
    assert.deepEqual(stats.camera.rendered.gameplay.eye, [640, 610, 120]);
    assert.deepEqual(stats.camera.rendered.gameplay.target, [640, 424, 1]);
    assert.deepEqual(stats.camera.projection, {
      scale: 440,
      polycssTileSize: 50,
    });
    assert.match(stats.camera.sceneMatrix, /^matrix3d\(/u);
    assert.equal(stats.skyBackdrop.sourceX, 0);
    assert.equal(stats.skyBackdrop.sourceY, 562);
    assert.equal(mounted.getHandle("sky-backdrop").element.dataset.cssoccerSourceId, "BM_C1X/COL_C1X");

    const player = mounted.getHandle("spain-player-01");
    const root = player.element;
    assert.equal(mounted.scene.sceneElement.style.transitionProperty, "");
    assert.equal(mounted.scene.sceneElement.style.transitionDuration, "");
    assert.equal(root.style.transitionProperty, "");
    assert.equal(root.style.transitionDuration, "");
    assert.equal(mounted.getHandle("ball-00").element.style.transitionDuration, "");
    const leaves = [...player.leaves];
    assert.equal(leaves.length, 13);
    assert.equal(root.dataset.cssoccerCountry, "spain");
    assert.equal(root.dataset.cssoccerNativeRuntimeIndex, "0");
    assert.deepEqual(player.transform.position, [618.6666870117188, 0, -640]);
    assert.deepEqual(
      mounted.getHandle("argentina-player-01").transform.position,
      [661.3333129882812, 0, -640],
    );
    assert.deepEqual(mounted.getHandle("ball-00").transform.position, [640, 2, -400]);
    assert.equal(mounted.setPreparedFrame("spain-player-01", 1), false);
    assert.equal(player.element, root);
    assert.ok(leaves.every((leaf, index) => player.leaves[index] === leaf));
    assert.equal(mounted.setPreparedFrame("static-01", 1), false);
    assert.equal(mounted.stats().stableIdentityCount, 37);
    assert.equal(mounted.stats().frameStyleApplyCount, stats.frameStyleApplyCount);

    const playerRoots = fixture.scene.meshes.filter(({ kind }) => kind === "player");
    const liveFrame = {
      schema: CSSOCCER_LIVE_RENDER_FRAME_SCHEMA,
      tick: 0,
      camera: {
        effectiveBall: { x: 700, y: 500, z: 4 },
        justScored: 0,
        matchMode: 0,
        goalScorer: null,
      },
      selectedPlayerId: playerRoots[0].id,
      playerHighlight: syntheticHighlightCommand({
        player: playerRoots[0],
        nativePlayerNumber: 1,
        position: [700, 0, -500],
      }),
      players: {
        commands: playerRoots.map((mesh, index) => ({
          rootId: mesh.id,
          nativePlayerNumber: index + 1,
          visible: index !== 3,
          transform: {
            ...structuredClone(mesh.transform),
            position: index === 0
              ? [700, 0, -500]
              : [...mesh.transform.position],
          },
          facing: { cosine: 1, sine: 0, yawDegrees: 0 },
          animation: {
            slotId: 78,
            frame: index === 0 ? 1 : 0,
            preparedFrameIndex: 2_878 + (index === 0 ? 1 : 0),
          },
        })),
      },
      officials: structuredClone(fixture.initialLiveFrame.officials),
      ball: {
        rootId: "ball-00",
        visible: true,
        transform: { position: [700, 4, -500], rotation: [0, 0, 0], scale: 1 },
      },
    };
    const rootIdentities = new Map(mounted.handles.map(({ id, handle }) => [id, handle.element]));
    assert.equal(mounted.applyLiveRenderFrame(liveFrame), 0);
    assert.deepEqual(player.transform.position, [700, 0, -500]);
    assert.deepEqual(mounted.getHandle("ball-00").transform.position, [700, 4, -500]);
    assert.equal(mounted.getHandle(playerRoots[3].id).element.hidden, true);
    assert.equal(host.dataset.cssoccerLiveTick, undefined);
    assert.equal(host.dataset.cssoccerSelectedPlayerId, playerRoots[0].id);
    assert.equal(host.dataset.cssoccerHighlightPlayerId, playerRoots[0].id);
    assert.equal(mounted.getHandle("player-highlight-local-user-1").element.hidden, false);
    assert.deepEqual(
      mounted.getHandle("player-highlight-local-user-1").transform.position,
      [700, 0, -500],
    );
    assert.equal(mounted.stats().lastLiveRenderTick, 0);
    assert.equal(mounted.stats().liveRenderApplyCount, 1);
    assert.equal(mounted.stats().hiddenPlayerRootCount, 1);
    assert.ok(mounted.handles.every(({ id, handle }) => rootIdentities.get(id) === handle.element));
    assert.throws(
      () => mounted.applyLiveRenderFrame({ ...liveFrame, tick: 2 }),
      /expected tick 1/u,
    );

    const nextFrame = {
      ...liveFrame,
      tick: 1,
      selectedPlayerId: null,
      playerHighlight: syntheticHighlightCommand(),
      players: {
        commands: liveFrame.players.commands.map((command, index) => ({
          ...command,
          visible: true,
          animation: {
            slotId: 78,
            frame: index === 0 ? 0 : 1,
            preparedFrameIndex: index === 0 ? 0 : 1,
          },
        })),
      },
      officials: {
        commands: liveFrame.officials.commands.map((command, index) => (
          index === 0
            ? { ...command, animation: { slotId: 73, frame: 1 } }
            : command
        )),
      },
    };
    assert.equal(mounted.applyLiveRenderFrame(nextFrame), 1);
    const optimizedStats = mounted.stats();
    assert.equal(optimizedStats.connectedRootCount, 37);
    assert.equal(optimizedStats.connectedLeafCount, optimizedStats.leafCount);
    assert.equal(optimizedStats.detachedLeafCount, 0);
    assert.equal(optimizedStats.livePlayerHiddenSkipCount, 1);
    assert.equal(optimizedStats.livePlayerIdleAnimationFreezeCount, 0);
    assert.ok(optimizedStats.livePlayerAnimationFrameApplyCount > 0);
    assert.ok(optimizedStats.liveOfficialAnimationFrameApplyCount > 0);
    assert.ok(mounted.handles.every(({ handle }) => handle.element.isConnected));

    mounted.destroy();
    mounted.destroy();
    assert.equal(host.querySelectorAll("[data-cssoccer-root-id]").length, 0);
  } finally {
    window.close();
  }
});

test("fails closed on root drift, raw mesh payloads, and runtime construction", async () => {
  const fixture = await syntheticPreparedFixture();
  const window = new Window();
  try {
    const host = window.document.createElement("section");
    window.document.body.append(host);
    const missingBall = structuredClone(fixture.scene);
    missingBall.roots.ball = [];
    await assert.rejects(
      mountPreparedMatchScene({
        host,
        sceneData: missingBall,
        renderAssets: fixture.renderAssets,
        exactPlayerAssets: fixture.exactPlayerAssets,
        exactOfficialAssets: fixture.exactOfficialAssets,
        initialLiveFrame: fixture.initialLiveFrame,
      }),
      /exactly 1 ball roots/u,
    );

    const rawMesh = structuredClone(fixture.scene);
    rawMesh.meshes[0].polygons = [{ vertices: [] }];
    await assert.rejects(
      mountPreparedMatchScene({
        host,
        sceneData: rawMesh,
        renderAssets: fixture.renderAssets,
        exactPlayerAssets: fixture.exactPlayerAssets,
        exactOfficialAssets: fixture.exactOfficialAssets,
        initialLiveFrame: fixture.initialLiveFrame,
      }),
      /not a stable root binding/u,
    );

    const mismatchedBinding = structuredClone(fixture.scene);
    mismatchedBinding.meshes[0].bundleId = "ball-model";
    await assert.rejects(
      mountPreparedMatchScene({
        host,
        sceneData: mismatchedBinding,
        renderAssets: fixture.renderAssets,
        exactPlayerAssets: fixture.exactPlayerAssets,
        exactOfficialAssets: fixture.exactOfficialAssets,
        initialLiveFrame: fixture.initialLiveFrame,
      }),
      /changed its render-bundle binding/u,
    );

    const construction = structuredClone(fixture.renderAssets);
    construction.runtimeConstruction.topologyBuildCount = 1;
    await assert.rejects(
      mountPreparedMatchScene({
        host,
        sceneData: fixture.scene,
        renderAssets: construction,
        exactPlayerAssets: fixture.exactPlayerAssets,
        exactOfficialAssets: fixture.exactOfficialAssets,
        initialLiveFrame: fixture.initialLiveFrame,
      }),
      /zero runtime construction/u,
    );
  } finally {
    window.close();
  }
});

test("product mount source has no raw polygon, scene.add, or runtime fetch path", async () => {
  const source = await readFile(
    new URL("../src/cssoccer/polycssScene.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /scene\s*\.\s*add\s*\(/u);
  assert.doesNotMatch(source, /\.polygons\b/u);
  assert.doesNotMatch(source, /\bfetch\s*\(/u);
  assert.match(source, /mountCssoccerRenderBundle(?:FrameSet)?Mesh/u);
});

async function syntheticPreparedFixture() {
  fixturePromise ??= buildSyntheticPreparedFixture();
  return fixturePromise;
}

async function buildSyntheticPreparedFixture() {
  const staticBundle = await buildCssoccerPreparedRenderBundle({
    id: "static-model",
    polygons: framePolygons(0, "#2b783b"),
  });
  const highlightFrameSet = await buildCssoccerPreparedRenderFrameSet({
    id: "player-highlight-marker",
    frames: CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.markerFamilies.map((family, index) => ({
      id: family.id,
      polygons: framePolygons(0, ["#ffef72", "#73d7ff", "#ff8c72", "#e58cff"][index]),
    })),
  });
  const ballBundle = await buildCssoccerPreparedRenderBundle({
    id: "ball-model",
    polygons: framePolygons(0, "#ece9dc"),
  });
  const roots = syntheticRoots();
  const meshes = [
    ...roots.static.map((root) => mesh(
      root.id,
      "static",
      "static-model",
      null,
      preparedTransform([0, 0, 0]),
      null,
    )),
    ...roots.highlights.map((root) => mesh(
      root.id,
      "highlight",
      "player-highlight-marker",
      "player-highlight-marker",
      preparedTransform([0, 0, 0]),
      0,
    )),
    ...roots.players.map((root) => mesh(
      root.id,
      "player",
      "exact-actua-player-one-basis",
      null,
      playerKickoffTransform(root),
      null,
    )),
    ...roots.officials.map((root, index) => mesh(
      root.id,
      "official",
      "exact-actua-official-one-basis",
      null,
      preparedTransform([640, 0, -(328 + index * 72)]),
      null,
    )),
    ...roots.ball.map((root) => mesh(
      root.id,
      "ball",
      "ball-model",
      null,
      preparedTransform([640, 2, -400]),
      null,
    )),
  ];
  const rootBindings = meshes.map(({ id, bundleId, frameSetId }) => ({
    rootId: id,
    bundleId,
    frameSetId,
  }));
  const renderAssets = {
    schema: "cssoccer-prepared-fixture-render-bundles@1",
    id: FIXTURE_ID,
    status: "ready",
    bundles: [staticBundle, highlightFrameSet.bundle, ballBundle],
    frameSets: [highlightFrameSet],
    rootBindings,
    counts: {
      bundles: 3,
      frameSets: 1,
      staticRootBindings: 9,
      highlightRootBindings: 1,
      actorRootBindings: 26,
      rootBindings: 36,
      leaves: staticBundle.leafCount + highlightFrameSet.bundle.leafCount
        + ballBundle.leafCount,
      preparedFrames: highlightFrameSet.frameCount,
    },
    runtimeConstruction: { ...ZERO_CONSTRUCTION },
    lineage: {
      productionReference: "cssQuake",
      pattern: "prepare-time stable DOM serialization with same-topology frame-style swaps",
    },
  };
  const renderBytes = jsonBytes(renderAssets);
  const renderSha256 = sha256(renderBytes);
  const exactPlayerIndexBytes = await readFile(new URL(EXACT_PLAYER_INDEX_PATH, GENERATED_ROOT));
  const exactPlayerMaterialsBytes = await readFile(
    new URL(EXACT_PLAYER_MATERIALS_PATH, GENERATED_ROOT),
  );
  const exactPlayerIndex = JSON.parse(exactPlayerIndexBytes);
  const exactPlayerMaterials = JSON.parse(exactPlayerMaterialsBytes);
  const exactPlayerIndexSha256 = sha256(exactPlayerIndexBytes);
  const exactPlayerMaterialsSha256 = sha256(exactPlayerMaterialsBytes);
  const exactPlayerChunk = exactPlayerIndex.sequences
    .find(({ slotId }) => slotId === 78).chunks[0];
  const exactPlayerChunkBytes = await readFile(new URL(exactPlayerChunk.path, GENERATED_ROOT));
  const exactPlayerAssets = createCssoccerExactActuaPlayerAssetRuntime({
    index: exactPlayerIndex,
    materials: exactPlayerMaterials,
    loadChunk: async (descriptor) => JSON.parse(await readFile(
      new URL(descriptor.path, GENERATED_ROOT),
      "utf8",
    )),
  });
  await exactPlayerAssets.preload({ slotId: 78, localFrameIndex: 0 });
  const exactOfficialIndexBytes = await readFile(
    new URL(EXACT_OFFICIAL_INDEX_PATH, GENERATED_ROOT),
  );
  const exactOfficialMaterialsBytes = await readFile(
    new URL(EXACT_OFFICIAL_MATERIALS_PATH, GENERATED_ROOT),
  );
  const exactOfficialIndex = JSON.parse(exactOfficialIndexBytes);
  const exactOfficialMaterials = JSON.parse(exactOfficialMaterialsBytes);
  const exactOfficialIndexSha256 = sha256(exactOfficialIndexBytes);
  const exactOfficialMaterialsSha256 = sha256(exactOfficialMaterialsBytes);
  const exactOfficialChunk = exactOfficialIndex.sequences
    .find(({ slotId }) => slotId === 78).chunks[0];
  const exactOfficialChunkBytes = await readFile(
    new URL(exactOfficialChunk.path, GENERATED_ROOT),
  );
  const exactOfficialAssets = createCssoccerExactActuaPlayerAssetRuntime({
    index: exactOfficialIndex,
    materials: exactOfficialMaterials,
    loadChunk: async (descriptor) => JSON.parse(await readFile(
      new URL(descriptor.path, GENERATED_ROOT),
      "utf8",
    )),
  });
  await exactOfficialAssets.preloadMany([
    { slotId: 78, localFrameIndex: 0 },
    { slotId: 73, localFrameIndex: 1 },
  ]);
  const facts = {
    schema: "cssoccer-prepared-fixture-facts@1",
    id: FIXTURE_ID,
    status: "ready",
    countries: [
      { country: "spain", sourceTeamId: 2 },
      { country: "argentina", sourceTeamId: 20 },
    ],
    control: { countries: ["spain", "argentina"] },
    teams: {
      schema: "cssoccer-team-preparation@1",
      starters: Array.from({ length: 22 }, (_, index) => ({ id: index + 1 })),
    },
    tactics: {
      schema: "cssoccer-prepared-tactics@1",
      formationId: 0,
      values: Array.from({ length: 70 }, () => []),
    },
    playerHighlight: {
      schema: "cssoccer-prepared-player-highlight@1",
      contractSha256: CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256,
      rootId: "player-highlight-local-user-1",
      frameSetId: "player-highlight-marker",
      bundleId: "player-highlight-marker",
      frameIds: CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.markerFamilies.map(({ id }) => id),
      sourcePointListSha256:
        CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.geometry.sourcePointListSha256,
      stableLeafCount: 1,
      runtimeConstruction: { ...ZERO_CONSTRUCTION },
    },
  };
  const factsBytes = jsonBytes(facts);
  const factsSha256 = sha256(factsBytes);
  const scene = {
    schema: "cssoccer-prepared-match-scene@1",
    id: FIXTURE_ID,
    status: "ready",
    fixture: {
      home: { country: "spain", sourceTeamId: 2 },
      away: { country: "argentina", sourceTeamId: 20 },
      controlCountries: ["spain", "argentina"],
      durationMinutes: 2,
      halfDurationMinutes: 1,
      publiclyConfigurableDuration: false,
    },
    axes: {
      coordinateSpace: "Actua renderer world",
      components: { x: "pitch length", y: "vertical", z: "negative pitch width" },
      gameplayToRenderer: { x: "x", y: "z", z: "-y" },
      verticalAxis: "y",
    },
    dimensions: {
      playingFieldNative: { length: 1280, width: 800 },
      stadiumContext: { st_w: 190, st_l: 190, st_h: 290 },
    },
    cameraAnchor: {
      status: "prepared-static-framing; parent B9 owns native camera binding",
      target: [640, 0, -400],
      playingFieldCenter: [640, 0, -400],
    },
    backdrop: {
      schema: "cssoccer-prepared-sky-backdrop@1",
      id: "sky-backdrop",
      kind: "sky",
      sourceId: "BM_C1X/COL_C1X",
      stableDom: true,
      asset: {
        path: SKY_TEXTURE_PATH,
        url: `/cssoccer/${SKY_TEXTURE_PATH}`,
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
    },
    roots,
    meshes,
    preparedFiles: {
      facts: { path: FACTS_PATH, sha256: factsSha256 },
      renderBundles: { path: BUNDLE_PATH, sha256: renderSha256 },
      exactPlayerIndex: {
        path: EXACT_PLAYER_INDEX_PATH,
        sha256: exactPlayerIndexSha256,
      },
      exactPlayerMaterials: {
        path: EXACT_PLAYER_MATERIALS_PATH,
        sha256: exactPlayerMaterialsSha256,
      },
      exactOfficialIndex: {
        path: EXACT_OFFICIAL_INDEX_PATH,
        sha256: exactOfficialIndexSha256,
      },
      exactOfficialMaterials: {
        path: EXACT_OFFICIAL_MATERIALS_PATH,
        sha256: exactOfficialMaterialsSha256,
      },
      skyBackdrop: { path: SKY_TEXTURE_PATH, sha256: HASH },
    },
    runtimeConstruction: {
      ...ZERO_CONSTRUCTION,
      atlasBuildCount: 0,
    },
  };
  const sceneBytes = jsonBytes(scene);
  const sceneSha256 = sha256(sceneBytes);
  const manifest = syntheticManifest({
    factsBytes,
    factsSha256,
    renderBytes,
    renderSha256,
    exactPlayerIndexBytes,
    exactPlayerIndexSha256,
    exactPlayerMaterialsBytes,
    exactPlayerMaterialsSha256,
    exactPlayerChunk,
    exactPlayerChunkBytes,
    exactOfficialIndexBytes,
    exactOfficialIndexSha256,
    exactOfficialMaterialsBytes,
    exactOfficialMaterialsSha256,
    exactOfficialChunk,
    exactOfficialChunkBytes,
    sceneBytes,
    sceneSha256,
  });
  const manifestBytes = jsonBytes(manifest);
  const files = new Map([
    ["/cssoccer/manifest.json", manifestBytes],
    ["/cssoccer/scenes/spain-argentina-full-match.json", sceneBytes],
    ["/cssoccer/assets/spain-argentina-render-bundles.json", renderBytes],
    [`/cssoccer/${EXACT_PLAYER_INDEX_PATH}`, exactPlayerIndexBytes],
    [`/cssoccer/${EXACT_PLAYER_MATERIALS_PATH}`, exactPlayerMaterialsBytes],
    [`/cssoccer/${exactPlayerChunk.path}`, exactPlayerChunkBytes],
    [`/cssoccer/${EXACT_OFFICIAL_INDEX_PATH}`, exactOfficialIndexBytes],
    [`/cssoccer/${EXACT_OFFICIAL_MATERIALS_PATH}`, exactOfficialMaterialsBytes],
    [`/cssoccer/${exactOfficialChunk.path}`, exactOfficialChunkBytes],
    ["/cssoccer/facts/spain-argentina-full-match.json", factsBytes],
  ]);
  const initialLiveFrame = syntheticLiveFrame(scene);
  return {
    exactPlayerAssets,
    exactOfficialAssets,
    facts,
    files,
    initialLiveFrame,
    manifest,
    renderAssets,
    scene,
  };
}

function syntheticManifest({
  factsBytes,
  factsSha256,
  renderBytes,
  renderSha256,
  exactPlayerIndexBytes,
  exactPlayerIndexSha256,
  exactPlayerMaterialsBytes,
  exactPlayerMaterialsSha256,
  exactPlayerChunk,
  exactPlayerChunkBytes,
  exactOfficialIndexBytes,
  exactOfficialIndexSha256,
  exactOfficialMaterialsBytes,
  exactOfficialMaterialsSha256,
  exactOfficialChunk,
  exactOfficialChunkBytes,
  sceneBytes,
  sceneSha256,
}) {
  const descriptor = (path, bytes, sha, mediaType = "application/json") => ({
    path,
    url: `/cssoccer/${path}`,
    mediaType,
    bytes,
    sha256: sha,
    lineageSha256: HASH,
    references: [],
  });
  const sceneEntry = {
    id: FIXTURE_ID,
    sceneUrl: "/cssoccer/scenes/spain-argentina-full-match.json",
    bytes: sceneBytes.byteLength,
    sha256: sceneSha256,
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
      descriptor(BUNDLE_PATH, renderBytes.byteLength, renderSha256),
      descriptor(
        EXACT_PLAYER_INDEX_PATH,
        exactPlayerIndexBytes.byteLength,
        exactPlayerIndexSha256,
      ),
      descriptor(
        EXACT_PLAYER_MATERIALS_PATH,
        exactPlayerMaterialsBytes.byteLength,
        exactPlayerMaterialsSha256,
      ),
      descriptor(
        exactPlayerChunk.path,
        exactPlayerChunkBytes.byteLength,
        exactPlayerChunk.sha256,
      ),
      descriptor(
        EXACT_OFFICIAL_INDEX_PATH,
        exactOfficialIndexBytes.byteLength,
        exactOfficialIndexSha256,
      ),
      descriptor(
        EXACT_OFFICIAL_MATERIALS_PATH,
        exactOfficialMaterialsBytes.byteLength,
        exactOfficialMaterialsSha256,
      ),
      descriptor(
        exactOfficialChunk.path,
        exactOfficialChunkBytes.byteLength,
        exactOfficialChunk.sha256,
      ),
      descriptor("assets/textures/spain-argentina-hud-glyphs.png", 1, HASH, "image/png"),
      descriptor("assets/textures/spain-argentina-match.png", 1, HASH, "image/png"),
      descriptor("assets/textures/spain-argentina-marking-pixel.png", 1, HASH, "image/png"),
      descriptor("assets/textures/spain-argentina-pitch.png", 1, HASH, "image/png"),
      descriptor("assets/textures/spain-argentina-stadium.png", 1, HASH, "image/png"),
      descriptor(SKY_TEXTURE_PATH, 1, HASH, "image/png"),
      descriptor(EXACT_PLAYER_TEXTURE_PATH, 1, HASH, "image/png"),
      descriptor(EXACT_OFFICIAL_TEXTURE_PATH, 1, HASH, "image/png"),
      descriptor(FACTS_PATH, factsBytes.byteLength, factsSha256),
      descriptor(SCENE_PATH, sceneBytes.byteLength, sceneSha256),
    ],
    provenance: {
      schema: "cssoccer-prepared-provenance@1",
      path: "provenance.json",
      url: "/cssoccer/provenance.json",
      bytes: 123,
      sha256: HASH,
    },
  };
}

function syntheticRoots() {
  const staticRoots = Array.from({ length: 9 }, (_, index) => ({
    id: `static-${String(index + 1).padStart(2, "0")}`,
    kind: "prepared-static",
    sourceId: `source-static-${index + 1}`,
    stableDom: true,
  }));
  const players = ["spain", "argentina"].flatMap((country, teamIndex) => (
    Array.from({ length: 11 }, (_, index) => ({
      id: `${country}-player-${String(index + 1).padStart(2, "0")}`,
      kind: "player",
      country,
      nativeRuntimeIndex: teamIndex * 11 + index,
      nativeRendererIndex: teamIndex * 11 + index,
      stableDom: true,
      modelId: "actua-player-28p-13f-one-basis",
      materialId: `${country}-player-material`,
    }))
  ));
  const officials = ["referee-00", "assistant-referee-01", "assistant-referee-02"]
    .map((id, index) => ({
      id,
      kind: "official",
      country: null,
      nativeRuntimeIndex: null,
      nativeRendererIndex: 22 + index,
      stableDom: true,
      modelId: index === 0 ? "player_fr" : "player_fl",
      materialId: index === 0
        ? "actua-referee-material"
        : "actua-assistant-referee-material",
    }));
  return {
    static: staticRoots,
    highlights: [{
      id: "player-highlight-local-user-1",
      kind: "highlight",
      country: "argentina",
      stableDom: true,
      sourceId: "plhi_p",
    }],
    players,
    officials,
    ball: [{
      id: "ball-00",
      kind: "ball",
      country: null,
      nativeRuntimeIndex: null,
      nativeRendererIndex: null,
      stableDom: true,
      modelId: "ball",
      materialId: null,
    }],
  };
}

function syntheticHighlightCommand({
  player = null,
  nativePlayerNumber = null,
  position = [0, 0, 0],
} = {}) {
  const visible = player !== null;
  return {
    rootId: "player-highlight-local-user-1",
    playerId: player?.id ?? null,
    nativePlayerNumber,
    visible,
    type: visible
      ? { value: 1, id: "player-highlight-normal", semantic: "normal" }
      : { value: 0, id: "player-highlight-off", semantic: "off" },
    family: visible
      ? { id: "player-highlight-family-normal", frameIndex: 0, frameId: "player-highlight-family-normal" }
      : { id: null, frameIndex: 0, frameId: "player-highlight-family-normal" },
    material: { hcol: 0, id: "player-highlight-colour-0" },
    facingMode: visible ? "field-aligned" : "none",
    blinkMode: visible ? "steady" : "hidden",
    ordinaryShadow: visible ? "suppressed" : "eligible",
    transform: preparedTransform(position),
  };
}

function syntheticLiveFrame(scene) {
  const playerMeshes = scene.meshes.filter(({ kind }) => kind === "player");
  const officialMeshes = scene.meshes.filter(({ kind }) => kind === "official");
  return {
    schema: CSSOCCER_LIVE_RENDER_FRAME_SCHEMA,
    tick: 0,
    terminal: false,
    camera: {
      effectiveBall: { x: 640, y: 400, z: 2 },
      justScored: 0,
      matchMode: 0,
      goalScorer: null,
    },
    selectedPlayerId: null,
    playerHighlight: syntheticHighlightCommand(),
    players: {
      commands: playerMeshes.map((mesh, index) => ({
        rootId: mesh.id,
        nativePlayerNumber: index + 1,
        visible: true,
        transform: structuredClone(mesh.transform),
        facing: { cosine: 1, sine: 0, yawDegrees: 0 },
        animation: {
          slotId: 78,
          frame: 0,
          preparedFrameIndex: 2_878,
        },
      })),
    },
    officials: {
      commands: officialMeshes.map((mesh, index) => ({
        rootId: mesh.id,
        role: index === 0 ? "referee" : "assistant-referee",
        visible: true,
        transform: structuredClone(mesh.transform),
        facing: { cosine: 1, sine: 0, yawDegrees: 0 },
        animation: { slotId: 78, frame: 0 },
        material: {
          materialProfileId: index === 0
            ? "actua-referee-material"
            : "actua-assistant-referee-material",
          nativeRenderType: index === 0 ? 3 : 4,
        },
      })),
    },
    ball: {
      rootId: "ball-00",
      visible: true,
      transform: preparedTransform([640, 2, -400]),
    },
  };
}

function mesh(id, kind, bundleId, frameSetId, transform, initialFrameIndex) {
  return { id, kind, stableDom: true, bundleId, frameSetId, transform, initialFrameIndex };
}

function playerKickoffTransform(root) {
  const teamIndex = root.country === "spain" ? 0 : 1;
  const indexInTeam = root.nativeRuntimeIndex - teamIndex * 11;
  return preparedTransform([
    teamIndex === 0 ? 618.6666870117188 : 661.3333129882812,
    0,
    -(640 - indexInTeam * 24),
  ]);
}

function preparedTransform(position) {
  return { position, rotation: [0, 0, 0], scale: 1 };
}

function framePolygons(z, color) {
  return [
    { vertices: [[0, 0, z], [2, 0, z], [2, 1, z], [0, 1, z]], color },
    { vertices: [[0, 0, z], [1, 0, z], [0, 1, z]], color },
  ];
}

function fixtureFetch(files) {
  return async (url) => {
    const bytes = files.get(String(url));
    if (!bytes) return new Response("not found", { status: 404 });
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  };
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assembleCssoccerPreparedFixture } from "../src/prepare/cssoccer/fixtureAssembler.mjs";
import {
  CSSOCCER_PREPARED_ASSEMBLY_REQUEST,
  prepareCssoccer,
} from "../src/prepare/cssoccer/prepare.mjs";
import {
  validateCssoccerPreparedManifest,
  validateCssoccerPreparedScene,
} from "../src/prepare/cssoccer/manifestContract.mjs";

const SHA256 = /^[0-9a-f]{64}$/u;
const ZERO_RUNTIME_CONSTRUCTION = Object.freeze({
  sourceParseCount: 0,
  geometryBuildCount: 0,
  topologyBuildCount: 0,
  materialBuildCount: 0,
  assetBuildCount: 0,
});

test("assembles and transactionally publishes the current real fixture", {
  timeout: 1_800_000,
}, async () => {
  const fixture = await assembleCssoccerPreparedFixture(CSSOCCER_PREPARED_ASSEMBLY_REQUEST);
  assert.equal(fixture.schema, "cssoccer-assembled-prepared-fixture@1");
  const preparedPaths = fixture.files.map(({ path }) => path);
  assert.deepEqual(preparedPaths.slice(0, 8), [
    "assets/textures/spain-argentina-match.png",
    "assets/textures/spain-argentina-pitch.png",
    "assets/textures/spain-argentina-marking-pixel.png",
    "assets/textures/spain-argentina-hud-glyphs.png",
    "assets/textures/spain-argentina-stadium.png",
    "assets/textures/spain-argentina-sky.png",
    "assets/textures/spain-argentina-exact-player-materials.png",
    "assets/textures/spain-argentina-exact-official-materials.png",
  ]);
  assert.deepEqual(preparedPaths.slice(-7), [
    "assets/spain-argentina-render-bundles.json",
    "assets/animation/exact-player/index.json",
    "assets/spain-argentina-exact-player-materials.json",
    "assets/animation/exact-official/index.json",
    "assets/spain-argentina-exact-official-materials.json",
    "facts/spain-argentina-full-match.json",
    "scenes/spain-argentina-full-match.json",
  ]);
  assert.equal(preparedPaths.length, 447);
  assert.equal(preparedPaths.slice(8, 434).length, 426);
  assert.ok(preparedPaths.slice(8, 434).every((path) => (
    /^assets\/animation\/exact-player\/slot-[0-9]{3}\/frames-[0-9]{3}-[0-9]{3}\.json$/u.test(path)
  )));
  assert.equal(preparedPaths.slice(434, 439).length, 5);
  assert.ok(preparedPaths.slice(434, 439).every((path) => (
    /^assets\/animation\/exact-official\/slot-(073|078)\/frames-[0-9]{3}-[0-9]{3}\.json$/u.test(path)
  )));
  assert.equal(preparedPaths.slice(439, -7).length, 1);
  assert.ok(preparedPaths.slice(439, -7).every((path) => (
    /^assets\/animation\/player-highlight-marker\/frames-[0-9]{6}-[0-9]{6}\.json$/u.test(path)
  )));
  assert.equal(fixture.sourceArtifacts.length, 37);
  assert.equal(new Set(fixture.sourceArtifacts.map(({ id }) => id)).size, 37);
  assert.ok(fixture.sourceArtifacts.every(({ bytes, sha256 }) => (
    Number.isSafeInteger(bytes) && bytes >= 0 && SHA256.test(sha256)
  )));
  assert.deepEqual(
    fixture.sourceArtifacts.find(({ id }) => id === "source:FOOTY.PAL"),
    {
      id: "source:FOOTY.PAL",
      bytes: 768,
      sha256: "73918cecf278e00172e0607053cd8c62e9c4172f70b7cb8e8884d2261a9ae436",
    },
  );
  assert.deepEqual(
    fixture.sourceArtifacts.find(({ id }) => id === "source:TAC_433.TAC"),
    {
      id: "source:TAC_433.TAC",
      bytes: 5_600,
      sha256: "79b999a42b9b32062445f10aeb35be3110f6e6c5c4e0a68454df271b538903d9",
    },
  );
  assert.deepEqual(
    fixture.sourceArtifacts.find(({ id }) => id === "source:FGFX.C"),
    {
      id: "source:FGFX.C",
      bytes: 3_519,
      sha256: "aa059d7e461db12b12f1127bdba00052150fe3da0211948fd0938c40423fabfa",
    },
  );
  assert.deepEqual(fixture.manifest.bindings, {
    sourceDataSha256: "1ed505aa19ab2111aeb04fe2b0590a1bad99b1eae9887c472f197c2dd2e90798",
    fixtureContractSha256:
      "0d2f0790fe207b3587bbbcecf5fe3ae7fa19444cda6850c6ab8f5a9ddfb7213f",
    nativeScenarioSha256: "5fc29151faf3ff344c37562b42148322ae0b976385cd8615fcccfcf8b529eb81",
    nativeFieldContractSha256:
      "6d21511c288f9553628079ffeaa4a6538d4eb1a8e4b36acb4f1d0c44de42a76e",
    nativeCaptureSha256: "1b46cb63a708d6af237d3af91d6c5846bc456e93ef6b5d731a1d36cbcaffabdb",
  });

  const textureFile = fileAtPath(fixture, "assets/textures/spain-argentina-match.png");
  const pitchTextureFile = fileAtPath(fixture, "assets/textures/spain-argentina-pitch.png");
  const markingPixelFile = fileAtPath(
    fixture,
    "assets/textures/spain-argentina-marking-pixel.png",
  );
  const hudGlyphTextureFile = fileAtPath(
    fixture,
    "assets/textures/spain-argentina-hud-glyphs.png",
  );
  const stadiumTextureFile = fileAtPath(
    fixture,
    "assets/textures/spain-argentina-stadium.png",
  );
  const skyBackdropFile = fileAtPath(
    fixture,
    "assets/textures/spain-argentina-sky.png",
  );
  const exactPlayerTextureFile = fileAtPath(
    fixture,
    "assets/textures/spain-argentina-exact-player-materials.png",
  );
  const exactOfficialTextureFile = fileAtPath(
    fixture,
    "assets/textures/spain-argentina-exact-official-materials.png",
  );
  const bundleFile = fileAtPath(fixture, "assets/spain-argentina-render-bundles.json");
  const exactPlayerIndexFile = fileAtPath(
    fixture,
    "assets/animation/exact-player/index.json",
  );
  const exactPlayerMaterialsFile = fileAtPath(
    fixture,
    "assets/spain-argentina-exact-player-materials.json",
  );
  const exactOfficialIndexFile = fileAtPath(
    fixture,
    "assets/animation/exact-official/index.json",
  );
  const exactOfficialMaterialsFile = fileAtPath(
    fixture,
    "assets/spain-argentina-exact-official-materials.json",
  );
  const factsFile = fileWithPrefix(fixture, "facts/");
  const sceneFile = fileWithPrefix(fixture, "scenes/");
  const publication = bundleFile.json;
  const facts = factsFile.json;
  const scene = sceneFile.json;
  assert.equal(Object.hasOwn(facts, "input"), false);
  assert.doesNotMatch(
    JSON.stringify(facts),
    /"(?:commandStreamSha256|inputBindingSha256|inputSha256|nativeInputSha256)"/u,
  );
  assert.equal(textureFile.mediaType, "image/png");
  assert.equal(textureFile.bytes.length, 148_278);
  assert.equal(pitchTextureFile.mediaType, "image/png");
  assert.equal(pitchTextureFile.bytes.readUInt32BE(16), 1_680);
  assert.equal(pitchTextureFile.bytes.readUInt32BE(20), 1_160);
  assert.equal(markingPixelFile.mediaType, "image/png");
  assert.equal(markingPixelFile.bytes.readUInt32BE(16), 1);
  assert.equal(markingPixelFile.bytes.readUInt32BE(20), 1);
  assert.equal(hudGlyphTextureFile.mediaType, "image/png");
  assert.equal(hudGlyphTextureFile.bytes.readUInt32BE(16), 72);
  assert.equal(hudGlyphTextureFile.bytes.readUInt32BE(20), 105);
  assert.equal(stadiumTextureFile.mediaType, "image/png");
  assert.equal(stadiumTextureFile.bytes.readUInt32BE(16), 1_024);
  assert.equal(stadiumTextureFile.bytes.readUInt32BE(20), 768);
  assert.equal(skyBackdropFile.mediaType, "image/png");
  assert.equal(skyBackdropFile.bytes.readUInt32BE(16), 640);
  assert.equal(skyBackdropFile.bytes.readUInt32BE(20), 480);
  assert.equal(exactPlayerTextureFile.mediaType, "image/png");
  assert.equal(exactPlayerTextureFile.bytes.readUInt32BE(16), 1_088);
  assert.equal(exactPlayerTextureFile.bytes.readUInt32BE(20), 858);
  assert.equal(exactOfficialTextureFile.mediaType, "image/png");
  assert.equal(exactOfficialTextureFile.expectedSha256,
    exactOfficialMaterialsFile.json.atlas.sha256);
  assert.deepEqual(facts.materials.matchAtlas.palette.skinPalette, {
    status: "user-validated-source-palette-selection",
    bodySymbol: "BM_XLATINO",
    selectedSymbol: "COL_XCAUCASA",
    selectedSelector: 1536,
  });
  assert.deepEqual(
    facts.materials.matchAtlas.palette.overrides.filter(({ id }) => id.endsWith("skin")),
    [
      { id: "spain-skin", selector: 1536, firstEntry: 80, entries: 8 },
      { id: "argentina-skin", selector: 1536, firstEntry: 88, entries: 8 },
    ],
  );
  assert.equal(facts.tactics.schema, "cssoccer-prepared-tactics@1");
  assert.equal(facts.tactics.formationId, 0);
  assert.deepEqual(facts.tactics.values[0][0], [72, 152]);
  assert.deepEqual(Object.fromEntries(
    Object.entries(scene.roots).map(([kind, roots]) => [kind, roots.length]),
  ), { ball: 1, highlights: 1, officials: 3, players: 22, static: 9 });
  assert.equal(scene.meshes.length, 36);
  assert.equal(new Set(scene.meshes.map(({ id }) => id)).size, 36);
  assert.ok(scene.meshes.every((mesh) => (
    mesh.stableDom === true && typeof mesh.bundleId === "string"
  )));
  assert.ok(scene.meshes.every(({ transform }) => (
    JSON.stringify(Object.keys(transform).sort()) === '["position","rotation","scale"]'
    && transform.position.length === 3
    && transform.position.every(Number.isFinite)
    && transform.rotation.length === 3
    && transform.rotation.every(Number.isFinite)
    && transform.scale === 1
  )));
  const playerMeshes = scene.meshes.filter(({ kind }) => kind === "player");
  const officialMeshes = scene.meshes.filter(({ kind }) => kind === "official");
  const actorMeshes = scene.meshes.filter(({ kind }) => (
    kind === "player" || kind === "official" || kind === "ball"
  ));
  const ballMesh = scene.meshes.find(({ kind }) => kind === "ball");
  assert.equal(new Set(playerMeshes.map(({ transform }) => transform.position.join(","))).size, 22);
  assert.equal(new Set(actorMeshes.map(({ transform }) => transform.position.join(","))).size, 26);
  assert.deepEqual(ballMesh.transform.position, [640, 2, -400]);
  assert.equal(ballMesh.initialFrameIndex, null);
  assert.ok(scene.meshes.filter(({ kind }) => kind === "static")
    .every(({ initialFrameIndex }) => initialFrameIndex === null));
  assert.ok(playerMeshes.every(({ bundleId, frameSetId, initialFrameIndex }) => (
    bundleId === "exact-actua-player-one-basis"
    && frameSetId === null
    && initialFrameIndex === null
  )));
  assert.ok(officialMeshes.every(({ bundleId, frameSetId, initialFrameIndex, reasonCode }) => (
    bundleId === "exact-actua-official-one-basis"
      && frameSetId === null
      && initialFrameIndex === null
      && reasonCode === null
  )));
  assert.deepEqual(
    scene.meshes.find(({ id }) => id === "spain-player-01").transform.rotation,
    [0, 0, 0],
  );
  assert.deepEqual(
    scene.meshes.find(({ id }) => id === "argentina-player-01").transform.rotation,
    [0, 180, 0],
  );
  assert.deepEqual(
    officialMeshes.map(({ id, transform }) => ({
      id,
      position: transform.position,
      rotation: transform.rotation,
    })),
    [
      {
        id: "referee-00",
        position: [640, 0, -400],
        rotation: [0, 90, 0],
      },
      {
        id: "assistant-referee-01",
        position: [640, 0, 32],
        rotation: [0, 90, 0],
      },
      {
        id: "assistant-referee-02",
        position: [640, 0, -832],
        rotation: [0, -90, 0],
      },
    ],
  );
  assert.ok(scene.roots.officials.every(({ initialBinding }) => (
    initialBinding.animation.slotId === 78
      && initialBinding.animation.preparedFrameIndex
        === initialBinding.animation.sourcePosePreparedFrameIndex
      && initialBinding.animation.sourcePosePreparedFrameIndex
        === initialBinding.animation.lookup.preparedFrameStart
          + initialBinding.animation.localFrameIndex
      && initialBinding.animation.renderStatus === "prepared-source-bound"
  )));
  assert.deepEqual(scene.runtimeConstruction, {
    ...ZERO_RUNTIME_CONSTRUCTION,
    atlasBuildCount: 0,
  });
  assert.deepEqual(scene.preparedFiles, {
    facts: { path: factsFile.path, sha256: factsFile.expectedSha256 },
    renderBundles: { path: bundleFile.path, sha256: bundleFile.expectedSha256 },
    exactPlayerIndex: {
      path: exactPlayerIndexFile.path,
      sha256: exactPlayerIndexFile.expectedSha256,
    },
    exactPlayerMaterials: {
      path: exactPlayerMaterialsFile.path,
      sha256: exactPlayerMaterialsFile.expectedSha256,
    },
    exactOfficialIndex: {
      path: exactOfficialIndexFile.path,
      sha256: exactOfficialIndexFile.expectedSha256,
    },
    exactOfficialMaterials: {
      path: exactOfficialMaterialsFile.path,
      sha256: exactOfficialMaterialsFile.expectedSha256,
    },
    skyBackdrop: {
      path: skyBackdropFile.path,
      sha256: skyBackdropFile.expectedSha256,
    },
  });

  assert.deepEqual(publication.counts, {
    bundles: 11,
    frameSets: 1,
    staticRootBindings: 9,
    highlightRootBindings: 1,
    actorRootBindings: 26,
    rootBindings: 36,
    sourcePolygons: 828,
    leaves: 828,
    droppedSourcePolygons: 0,
    preparedFrames: 4,
  });
  assert.deepEqual(publication.runtimeConstruction, ZERO_RUNTIME_CONSTRUCTION);
  assert.equal(publication.rootBindings.length, 36);
  assert.equal(new Set(publication.rootBindings.map(({ rootId }) => rootId)).size, 36);
  assert.deepEqual(
    publication.frameSets.map(({ frameCount }) => frameCount),
    [4],
  );
  const pitchBundle = publication.bundles.find(({ id }) => id === "static-pitch");
  assert.equal(pitchBundle.polygonCount, 1);
  assert.equal(pitchBundle.leafCount, 1);
  assert.deepEqual(pitchBundle.assets, [{
    url: "/cssoccer/assets/textures/spain-argentina-pitch.png",
    mediaType: "image/png",
    width: 1_680,
    height: 1_160,
    sha256: pitchTextureFile.expectedSha256,
  }]);
  assert.match(pitchBundle.meshHtml, /\bcssoccer-two-sided-face\b/u);
  const markingBundle = publication.bundles.find(({ id }) => id === "static-pitch-markings");
  assert.equal(markingBundle.polygonCount, 76);
  assert.equal(markingBundle.leafCount, 76);
  assert.equal(markingBundle.droppedSourcePolygonCount, 0);
  assert.ok(markingBundle.leaves.every(({ tag }) => tag === "s"));
  assert.deepEqual(markingBundle.assets, [{
    url: "/cssoccer/assets/textures/spain-argentina-marking-pixel.png",
    mediaType: "image/png",
    width: 1,
    height: 1,
    sha256: markingPixelFile.expectedSha256,
  }]);
  assert.deepEqual(
    publication.bundles.filter(({ assets }) => assets.length > 0).map(({ id }) => id),
    [
      "static-pitch",
      "static-pitch-markings",
      "static-goal-left",
      "static-goal-right",
      "static-corner-flags",
      "static-stadium-stand-1",
      "static-stadium-stand-2",
      "static-stadium-stand-3",
      "static-stadium-stand-4",
      "player-highlight-marker",
    ],
  );
  const goalBundles = publication.bundles.filter(({ id }) => (
    id === "static-goal-left" || id === "static-goal-right"
  ));
  assert.deepEqual(goalBundles.map(({ polygonCount, leafCount }) => ({
    polygonCount,
    leafCount,
  })), [
    { polygonCount: 40, leafCount: 40 },
    { polygonCount: 40, leafCount: 40 },
  ]);
  assert.ok(goalBundles.every(({ assets }) => (
    assets.length === 1
    && assets[0].url === "/cssoccer/assets/textures/spain-argentina-stadium.png"
    && assets[0].sha256 === stadiumTextureFile.expectedSha256
  )));
  const cornerFlagBundle = publication.bundles.find(({ id }) => id === "static-corner-flags");
  assert.equal(cornerFlagBundle.polygonCount, 28);
  assert.equal(cornerFlagBundle.leafCount, 28);
  assert.equal(cornerFlagBundle.droppedSourcePolygonCount, 0);
  assert.deepEqual(cornerFlagBundle.assets, [{
    url: "/cssoccer/assets/textures/spain-argentina-match.png",
    mediaType: "image/png",
    width: 2048,
    height: 256,
    sha256: textureFile.expectedSha256,
  }]);
  const stadiumBundles = publication.bundles.filter(({ id }) => (
    id.startsWith("static-stadium-stand-")
  ));
  assert.equal(stadiumBundles.reduce((sum, bundle) => sum + bundle.polygonCount, 0), 526);
  assert.ok(stadiumBundles.every(({ leaves }) => leaves.every(({ classes }) => (
    classes.includes("cssoccer-two-sided-face")
  ))));
  assert.ok(stadiumBundles.every(({ assets }) => (
    assets.length === 1
    && assets[0].url === "/cssoccer/assets/textures/spain-argentina-stadium.png"
    && assets[0].sha256 === stadiumTextureFile.expectedSha256
  )));
  assert.ok(publication.bundles.every(({ droppedSourcePolygonCount }) => (
    droppedSourcePolygonCount === 0
  )));
  assert.ok(publication.bundles.every(({ assets, runtimeConstruction, kind }) => (
    assets.length === (kind === "polycss-textured-mesh" ? 1 : 0)
    && JSON.stringify(runtimeConstruction) === JSON.stringify(ZERO_RUNTIME_CONSTRUCTION)
  )));
  assert.ok(publication.frameSets.every(({ frames, frameCount, runtimeConstruction }) => (
    frames.length === frameCount
    && JSON.stringify(runtimeConstruction) === JSON.stringify(ZERO_RUNTIME_CONSTRUCTION)
  )));
  assert.ok(publication.frameSets.every((frameSet) => (
    frameSet.bundle.droppedSourcePolygonCount === 0
    && frameSet.bundle.droppedSourcePolygonIndices.length === 0
    && !Object.hasOwn(frameSet, "sourceCameraFacing")
    && !Object.hasOwn(frameSet, "sourcePrimitiveTopologyHash")
    && frameSet.frames.every(({ leafStyles, sourcePoints }) => (
      frameSet.frameLeafStyleEncoding === "cssquake-packed-frame-styles@3"
        && leafStyles === undefined
        && sourcePoints === undefined
        && frameSet.frameStyleFiles.length === (
          frameSet.id === "player-highlight-marker"
            ? Math.ceil(frameSet.frameCount / 48)
            : facts.actors.poseFrameSets.slots.length
        )
        && frameSet.frameStyleFiles.every(({ path, frameStart, frameEnd }) => (
          path.startsWith(`assets/animation/${frameSet.id}/`)
          && Number.isSafeInteger(frameStart)
          && Number.isSafeInteger(frameEnd)
          && frameEnd > frameStart
        ))
        && frameSet.frameStyleFiles.every(({ frameStart }, index, files) => (
          frameStart === (index === 0 ? 0 : files[index - 1].frameEnd)
        ))
        && frameSet.frameStyleFiles.at(-1).frameEnd === frameSet.frameCount
    ))
  )));
  const animationStyleFiles = fixture.files.filter(({ json }) => (
    json?.schema === "cssoccer-packed-render-frame-styles@1"
  ));
  assert.equal(
    animationStyleFiles.length,
    publication.frameSets.reduce((sum, frameSet) => sum + frameSet.frameStyleFiles.length, 0),
  );
  assert.ok(animationStyleFiles.every(({ json }) => (
    json.schema === "cssoccer-packed-render-frame-styles@1"
    && json.version === 3
    && json.frames.length === json.frameEnd - json.frameStart
  )));
  for (const frameSet of publication.frameSets) {
    assert.equal(animationStyleFiles
      .filter(({ json }) => json.frameSetId === frameSet.id)
      .reduce((sum, { json }) => sum + json.frames.length, 0), frameSet.frameCount);
  }
  const frameSetsById = new Map(publication.frameSets.map((frameSet) => [frameSet.id, frameSet]));
  const actorRoots = new Map(
    [...scene.roots.players, ...scene.roots.officials]
      .map((root) => [root.id, root]),
  );
  for (const mesh of officialMeshes) {
    const initial = actorRoots.get(mesh.id).initialBinding;
    assert.equal(mesh.bundleId, "exact-actua-official-one-basis");
    assert.equal(mesh.frameSetId, null);
    assert.equal(mesh.initialFrameIndex, null);
    assert.match(initial.animation.preparedFrameId, /^mc-078-f-[0-9]{3}$/u);
    assert.ok(Number.isSafeInteger(initial.animation.preparedFrameIndex));
    assert.equal(initial.animation.frameSetId, null);
    assert.equal(initial.animation.renderStatus, "prepared-source-bound");
  }
  for (const mesh of playerMeshes) {
    const initial = actorRoots.get(mesh.id).initialBinding;
    assert.equal(initial.animation.frameSetId, null);
    assert.equal(mesh.frameSetId, null);
    assert.equal(mesh.initialFrameIndex, null);
    assert.ok(Number.isSafeInteger(initial.animation.preparedFrameIndex));
  }
  const highlightMesh = scene.meshes.find(({ kind }) => kind === "highlight");
  const highlightRoot = scene.roots.highlights.find(({ id }) => id === highlightMesh.id);
  const highlightFrameSet = frameSetsById.get(highlightMesh.frameSetId);
  assert.equal(highlightMesh.initialFrameIndex, 0);
  assert.equal(highlightFrameSet.frames[highlightMesh.initialFrameIndex].id,
    "player-highlight-family-normal");
  assert.equal(Object.hasOwn(highlightRoot, "initialBinding"), false);
  assert.deepEqual(scene.native.initialState, {
    status: "ready",
    tick: 0,
    phase: "post_tick",
    rawSha256: "1b46cb63a708d6af237d3af91d6c5846bc456e93ef6b5d731a1d36cbcaffabdb",
    stateSha256: "eb858bed9ad9d36670e97a98ea49235d8009246ded16e00dcb54c5dc1aef2fdd",
    playerBindings: 22,
    ballBindings: 1,
    officialBindings: {
      status: "exact-source-initialization-native-fields-unavailable",
      count: 3,
      renderStatus: "prepared-source-bound",
    },
  });
  for (const root of scene.roots.players) {
    const initial = root.initialBinding;
    assert.equal(initial.status, "exact-native-tick-zero");
    assert.equal(initial.tick, 0);
    assert.equal(initial.phase, "post_tick");
    assert.deepEqual(
      Object.keys(initial.sourceValues).sort(),
      [
        "action",
        "animation",
        "animationFrame",
        "nativePlayer",
        "on",
        "stableId",
        "x",
        "xDisplacement",
        "y",
        "yDisplacement",
        "z",
      ],
    );
    assert.equal(initial.sourceValues.stableId.value, root.id);
    assert.equal(initial.sourceValues.on.value, 1);
    assert.equal(initial.sourceValues.nativePlayer.value, root.nativeRuntimeIndex + 1);
    assert.ok(Object.values(initial.sourceValues).every((sample) => (
      typeof sample.fieldId === "string"
      && typeof sample.valueType === "string"
      && (sample.valueType === "string" ? sample.numericBits === null : /^[0-9a-f]+$/u.test(sample.numericBits))
    )));
    assert.equal(initial.lineage.rawSha256, scene.native.initialState.rawSha256);
    assert.equal(initial.lineage.stateSha256, scene.native.initialState.stateSha256);
  }
  const refereeInitial = scene.roots.officials[0].initialBinding;
  assert.equal(
    refereeInitial.status,
    "exact-source-initialization-native-official-fields-unavailable",
  );
  assert.equal(refereeInitial.sourceValues.animationFrame.numericBits, "3f19999a");
  assert.deepEqual(
    refereeInitial.lineage.sourceFiles.map(({ id, sha256 }) => ({ id, sha256 })),
    [
      {
        id: "source:ACTIONS.CPP",
        sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      },
      {
        id: "source:DATA.H",
        sha256: "7dba31d4e9af11b4c7686faa1bf75802142579db99bd41b23d5bfcd065f0bb99",
      },
      {
        id: "source:3D_UPD2.CPP",
        sha256: "af2009e0787951cb3d7471cef1fb307598069e80f3fa558d4c5dd72026c36714",
      },
    ],
  );

  assert.deepEqual(exactPlayerIndexFile.json.counts, {
    sequences: 124,
    poseOccurrences: 5_857,
    yawBins: 24,
    samples: 140_568,
    facesPerSample: 13,
    faceStates: 1_827_384,
    chunks: 426,
  });
  assert.deepEqual(exactPlayerIndexFile.json.cache, {
    policy: "bounded-lru-transactional-frame-residency",
    maxDecodedChunks: 24,
    eagerWholeDomain: false,
    eviction: "least-recently-used-after-request-touch",
    publication: "requested frame commits only after every referenced chunk is resident",
  });
  assert.equal(exactPlayerMaterialsFile.json.counts.profiles, 2);
  assert.equal(exactPlayerMaterialsFile.json.counts.fixturePlayers, 22);
  assert.equal(exactPlayerMaterialsFile.json.atlas.path, exactPlayerTextureFile.path);
  assert.equal(exactPlayerMaterialsFile.json.atlas.requestCount, 1);
  assert.equal(
    exactPlayerMaterialsFile.json.geometryId,
    exactPlayerIndexFile.json.geometryId,
  );

  assert.equal(facts.timing.fullMatchPlayMinutes, 2);
  assert.equal(facts.timing.playMinutesPerHalf, 1);
  assert.equal(facts.timing.publiclyConfigurable, false);
  assert.deepEqual(facts.control.countries, ["spain", "argentina"]);
  assert.deepEqual(facts.actors.counts, {
    ...facts.actors.counts,
    actors: 26,
    players: 22,
    officials: 3,
    balls: 1,
    stableRoots: 26,
    renderAssets: 1,
    animatedRenderAssets: 0,
    staticRenderAssets: 1,
    preparedRenderFrames: 0,
  });
  assert.deepEqual(
    facts.actors.poseFrameSets.slots.map(({ id }) => id),
    facts.animations.slots
      .filter(({ resolvedFrameCount }) => (
        Number.isSafeInteger(resolvedFrameCount) && resolvedFrameCount > 0
      ))
      .map(({ id }) => id),
  );
  assert.ok(facts.actors.poseFrameSets.slots.every(({ frames }) => frames.every((frame) => (
    !("points" in frame) && !("models" in frame) && SHA256.test(frame.sourceFrameSha256)
  ))));
  assert.ok(facts.actors.renderAssets.every((asset) => (
    !("frames" in asset)
    && !("polygons" in asset)
    && asset.preparedPayloadPath === bundleFile.path
  )));
  assert.equal(facts.animations.slots.length, 132);
  assert.ok(facts.animations.slots.every(({ posePayload }) => (
    !Array.isArray(posePayload?.frames)
    || posePayload.frames.every((frame) => !("coordinates" in frame))
  )));
  assert.equal(facts.materials.counts.decodedFrames, 508);
  assert.deepEqual(facts.materials.pitchSurface.worldBounds, {
    x: [-200, 1480],
    z: [-980, 180],
  });
  assert.deepEqual(facts.materials.pitchSurface.visualPitchSource, {
    sourceArchive: "EUROREND.DAT",
    pitchBitmap: "BM_PC",
    pitchSelector: 920,
    pitchPalette: "COL_P5",
    pitchPaletteSelector: 544,
    selection: "retained-native-frame-50-visual-binding",
  });
  assert.equal(facts.materials.pitchSurface.componentBake.outputRenderLeaves, 1);
  assert.equal(facts.materials.pitchSurface.nativeSampler.panMask, "0x1f1f");
  assert.equal(facts.materials.markingPixel.alphaMode, "opaque");
  assert.equal(
    facts.materials.hudGlyphAtlas.path,
    "assets/textures/spain-argentina-hud-glyphs.png",
  );
  assert.equal(facts.materials.stadiumAtlas.textureTable.records, 49);
  assert.equal(facts.materials.stadiumAtlas.triangleCutouts.count, 83);
  assert.equal(facts.materials.counts.generatedPlayerPanelFiles, 0);
  assert.equal(facts.materials.counts.generatedStadiumTextureFiles, 1);
  assert.equal(facts.materials.counts.generatedSkyBackdropFiles, 1);
  assert.equal(facts.materials.counts.generatedTextureFiles, 6);
  assert.equal(facts.materials.counts.decodedIndexedBytes, 5_201_920);
  assert.ok(facts.materials.archives.every(({ entries }) => entries.every(({ decode }) => (
    !("sourceBytesBase64" in decode)
    && (!Array.isArray(decode.frames)
      || decode.frames.every((frame) => !("indexedPixelsBase64" in frame)))
  ))));
  // The canonical facts payload retains only source-backed visual contracts.
  assert.ok(Buffer.byteLength(JSON.stringify(facts)) < 4_000_000);
  assert.ok(fixture.files.every(({ expectedSha256 }) => SHA256.test(expectedSha256)));

  const tempParent = await mkdtemp(join(tmpdir(), "cssoccer-fixture-assembler-"));
  const outputRoot = join(tempParent, "public");
  try {
    const report = await prepareCssoccer({ assembledFixture: fixture, outputRoot });
    assert.equal(report.schema, "cssoccer-prepared-publication-report@1");
    assert.equal(report.status, "ready");
    assert.equal(report.fileCount, 449);
    assert.ok(SHA256.test(report.treeSha256));

    const manifest = JSON.parse(await readFile(join(outputRoot, "manifest.json"), "utf8"));
    const publishedScene = JSON.parse(await readFile(
      join(outputRoot, "scenes/spain-argentina-full-match.json"),
      "utf8",
    ));
    const provenance = JSON.parse(await readFile(join(outputRoot, "provenance.json"), "utf8"));
    validateCssoccerPreparedManifest(manifest);
    validateCssoccerPreparedScene(publishedScene);
    assert.equal(provenance.schema, "cssoccer-prepared-provenance@1");
    assert.equal(provenance.sourceArtifacts.length, 37);
    assert.deepEqual(
      manifest.preparedFiles.map(({ path }) => path).sort(),
      fixture.files.map(({ path }) => path).sort(),
    );
    assert.equal(manifest.bindings.prepareInputsSha256, report.prepareInputsSha256);
    assert.equal(manifest.provenance.sha256, report.provenanceSha256);
  } finally {
    await rm(tempParent, { recursive: true, force: true });
  }
});

test("real fixture assembly rejects every widened prepared route", async () => {
  await assert.rejects(
    assembleCssoccerPreparedFixture({
      ...CSSOCCER_PREPARED_ASSEMBLY_REQUEST,
      fixtureId: "other-fixture",
    }),
    /canonical prepared route/u,
  );
  await assert.rejects(
    assembleCssoccerPreparedFixture({
      ...CSSOCCER_PREPARED_ASSEMBLY_REQUEST,
      scenePath: "scenes/other.json",
    }),
    /canonical prepared route/u,
  );
  await assert.rejects(
    assembleCssoccerPreparedFixture({
      ...CSSOCCER_PREPARED_ASSEMBLY_REQUEST,
      controlCountry: "france",
    }),
    /requires exactly/u,
  );
});

function fileWithPrefix(fixture, prefix) {
  const files = fixture.files.filter(({ path }) => path.startsWith(prefix));
  assert.equal(files.length, 1);
  return files[0];
}

function fileAtPath(fixture, path) {
  const file = fixture.files.find((entry) => entry.path === path);
  assert.ok(file, `missing prepared file ${path}`);
  return file;
}

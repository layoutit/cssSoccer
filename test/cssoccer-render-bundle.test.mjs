import assert from "node:assert/strict";
import test from "node:test";

import { Window } from "happy-dom";

import {
  CSSOCCER_RENDER_BUNDLE_SCHEMA,
  CSSOCCER_RENDER_FRAME_SET_SCHEMA,
  buildCssoccerPreparedRenderBundle,
  buildCssoccerPreparedRenderFrameSet,
} from "../src/prepare/cssoccer/renderBundle.mjs";
import {
  CSSOCCER_PACKED_FRAME_LEAF_STYLES,
  packageCssoccerRenderFrameStyles,
} from "../src/prepare/cssoccer/renderBundlePackaging.mjs";
import {
  assertCssoccerPreparedRenderBundle,
  assertCssoccerPreparedRenderFrameSet,
  installCssoccerPackedFrameStyles,
  mountCssoccerRenderBundleFrameSetMesh,
  mountCssoccerRenderBundleMesh,
} from "../src/cssoccer/renderBundleMesh.mjs";

const HASH = "ab".repeat(32);
const TEXTURE_URL = "/cssoccer/assets/textures/spain-argentina-match.png";

const framePolygons = (z, color) => [
  {
    vertices: [[0, 0, z], [2, 0, z], [2, 1, z], [0, 1, z]],
    color,
  },
  {
    vertices: [[0, 0, z], [1, 0, z], [0, 1, z]],
    color,
  },
];

const framePolygonsWithCull = (z, color) => [
  framePolygons(z, color)[0],
  {
    vertices: [[3, 0, z], [3, 0, z], [3, 0, z]],
    color,
  },
  framePolygons(z, color)[1],
];

const framePolygonsWithShiftedCull = (z, color) => [
  {
    vertices: [[0, 0, z], [0, 0, z], [0, 0, z], [0, 0, z]],
    color,
  },
  framePolygons(z, color)[1],
  {
    vertices: [[4, 0, z], [5, 0, z], [4, 1, z]],
    color,
  },
];

test("serializes deterministic asset-free solid PolyCSS HTML/CSS at prepare time", async () => {
  const input = { id: "synthetic-static", polygons: framePolygonsWithCull(0, "#e03030") };
  const first = await buildCssoccerPreparedRenderBundle(input);
  const second = await buildCssoccerPreparedRenderBundle(input);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.schema, CSSOCCER_RENDER_BUNDLE_SCHEMA);
  assert.deepEqual(Object.keys(first), [
    "schema",
    "id",
    "kind",
    "polycssVersion",
    "styleClassName",
    "topologyHash",
    "polygonCount",
    "leafCount",
    "droppedSourcePolygonCount",
    "droppedSourcePolygonIndices",
    "meshHtml",
    "meshCss",
    "rootStyle",
    "leafStyles",
    "leaves",
    "assets",
    "lineage",
    "runtimeConstruction",
    "bundleHash",
  ]);
  assert.equal(first.polygonCount, 3);
  assert.equal(first.leafCount, 2);
  assert.equal(first.droppedSourcePolygonCount, 1);
  assert.deepEqual(first.droppedSourcePolygonIndices, [1]);
  assert.deepEqual(first.leaves.map(({ sourcePolygonIndex }) => sourcePolygonIndex), [0, 2]);
  assert.deepEqual(first.assets, []);
  assert.deepEqual(first.runtimeConstruction, zeroConstruction());
  assert.equal(first.lineage.productionReference, "cssQuake");
  assert.ok(first.lineage.files.includes("cssQuake/src/prepare/bundle.mjs"));
  assert.ok(first.lineage.files.includes("cssQuake/src/runtime/renderBundleMesh.ts"));
  assert.match(first.meshHtml, /^<div class="polycss-mesh cssoccer-rb-[0-9a-f]{16}">/u);
  assert.doesNotMatch(
    JSON.stringify(first),
    /(?:\/Users\/|\.local\/|<s\b|<img\b|url\s*\(|blob:|data:|clip-path|gradient\s*\()/iu,
  );
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.leaves));
});

test("mounts prepared markup with zero runtime construction", async () => {
  const bundle = await buildCssoccerPreparedRenderBundle({
    id: "synthetic-mount",
    polygons: framePolygons(0, "#ececec"),
  });
  const window = new Window({ url: "http://cssoccer.test/" });
  try {
    const host = window.document.createElement("div");
    host.className = "polycss-scene";
    window.document.body.append(host);

    assert.equal(assertCssoccerPreparedRenderBundle(bundle, window.document), bundle);
    const handle = mountCssoccerRenderBundleMesh(host, bundle, {
      transform: { position: [4, 5, 6] },
    });

    assert.equal(host.children.length, 1);
    assert.equal(handle.element, host.firstElementChild);
    assert.equal(handle.leaves.length, 2);
    assert.equal("setPolygons" in handle, false);
    assert.match(handle.element.style.transform, /^translate3d\(/u);
    assert.deepEqual(handle.runtimeConstruction(), zeroConstruction());
    assert.deepEqual(handle.stats(), {
      ...zeroConstruction(),
      frameStyleApplyCount: 0,
      frameRootStyleWriteCount: 0,
      frameLeafFullStyleWriteCount: 0,
      frameLeafTransformWriteCount: 0,
      frameLeafUnchangedSkipCount: 0,
      leafCount: 2,
    });
    assert.ok(window.document.getElementById("polycss-styles"));
    assert.equal(
      window.document.getElementById(`cssoccer-style-${bundle.styleClassName}`).textContent,
      bundle.meshCss,
    );

    handle.remove();
    handle.remove();
    assert.equal(host.children.length, 0);
  } finally {
    window.close();
  }
});

test("swaps prepared same-topology frame styles without replacing any leaf", async () => {
  const frameSet = await buildCssoccerPreparedRenderFrameSet({
    id: "synthetic-player",
    frames: [
      { id: "idle", polygons: framePolygons(0, "#df3030") },
      { id: "stride", polygons: framePolygons(1, "#3080df") },
    ],
  });
  const repeated = await buildCssoccerPreparedRenderFrameSet({
    id: "synthetic-player",
    frames: [
      { id: "idle", polygons: framePolygons(0, "#df3030") },
      { id: "stride", polygons: framePolygons(1, "#3080df") },
    ],
  });

  assert.equal(JSON.stringify(frameSet), JSON.stringify(repeated));
  assert.equal(frameSet.schema, CSSOCCER_RENDER_FRAME_SET_SCHEMA);
  assert.deepEqual(Object.keys(frameSet), [
    "schema",
    "id",
    "kind",
    "polycssVersion",
    "topologyHash",
    "frameCount",
    "polygonCount",
    "leafCount",
    "droppedSourcePolygonCount",
    "droppedSourcePolygonIndices",
    "rootPropertyNames",
    "frameLeafStyleEncoding",
    "bundle",
    "frames",
    "lineage",
    "runtimeConstruction",
    "frameSetHash",
  ]);
  assert.equal(frameSet.frameCount, 2);
  assert.equal(frameSet.polygonCount, 2);
  assert.equal(frameSet.leafCount, 2);
  assert.deepEqual(frameSet.droppedSourcePolygonIndices, []);
  assert.equal(frameSet.frameLeafStyleEncoding, "inline-css-text@1");
  assert.deepEqual(frameSet.runtimeConstruction, zeroConstruction());

  const window = new Window({ url: "http://cssoccer.test/" });
  try {
    const host = window.document.createElement("div");
    host.className = "polycss-scene";
    window.document.body.append(host);
    assert.equal(assertCssoccerPreparedRenderFrameSet(frameSet, window.document), frameSet);

    const handle = mountCssoccerRenderBundleFrameSetMesh(host, frameSet, 0);
    const root = handle.element;
    const leaves = [...handle.leaves];
    const firstStyles = leaves.map((leaf) => leaf.style.cssText);
    const childCount = root.childNodes.length;

    assert.equal(handle.getFrameIndex(), 0);
    assert.equal(handle.setFrameIndex(1), true);
    assert.equal(handle.getFrameIndex(), 1);
    assert.equal(root.childNodes.length, childCount);
    assert.ok(leaves.every((leaf, index) => leaf === handle.leaves[index]));
    assert.notDeepEqual(leaves.map((leaf) => leaf.style.cssText), firstStyles);
    assert.equal(handle.setFrameIndex(-1), false);
    assert.equal(handle.setFrameIndex(0), true);
    assert.ok(leaves.every((leaf, index) => leaf === handle.leaves[index]));
    assert.deepEqual(handle.runtimeConstruction(), zeroConstruction());
    assert.equal(handle.stats().frameStyleApplyCount, 3);
  } finally {
    window.close();
  }
});

test("requires the exact initial cssQuake v3 animation sidecar before mount", async () => {
  const inlineFrameSet = await buildCssoccerPreparedRenderFrameSet({
    id: "synthetic-packed-player",
    frames: [
      { id: "idle", polygons: framePolygons(0, "#df3030") },
      { id: "stride", polygons: framePolygons(1, "#3080df") },
    ],
  });
  const packaged = packageCssoccerRenderFrameStyles({ frameSets: [inlineFrameSet] });
  const frameSet = packaged.publication.frameSets[0];
  const sidecar = packaged.styleFiles[0].json;

  assert.equal(frameSet.frameLeafStyleEncoding, CSSOCCER_PACKED_FRAME_LEAF_STYLES);
  assert.deepEqual(frameSet.frameStyleFiles, [{
    path: "assets/animation/synthetic-packed-player/frames-000000-000002.json",
    frameStart: 0,
    frameEnd: 2,
  }]);
  assert.ok(frameSet.frames.every((frame) => frame.leafStyles === undefined));
  assert.equal(sidecar.version, 3);
  assert.ok(JSON.stringify(packaged.publication).length < JSON.stringify({
    frameSets: [inlineFrameSet],
  }).length);

  const window = new Window({ url: "http://cssoccer.test/" });
  try {
    const host = window.document.createElement("div");
    host.className = "polycss-scene";
    window.document.body.append(host);
    assert.throws(
      () => mountCssoccerRenderBundleFrameSetMesh(host, frameSet, 1),
      /initial frame 1 was not preloaded/u,
    );
    assert.equal(host.children.length, 0);
    installCssoccerPackedFrameStyles(frameSet, sidecar);
    const handle = mountCssoccerRenderBundleFrameSetMesh(host, frameSet, 1);
    assert.equal(handle.getFrameIndex(), 1);
    assert.equal(host.children.length, 1);
  } finally {
    window.close();
  }
});

test("serializes and mounts direct-image textured quads from the generated match atlas", async () => {
  const material = {
    texture: TEXTURE_URL,
    key: "source-player-page-0",
    imageSource: {
      url: TEXTURE_URL,
      width: 1280,
      height: 256,
      sourceRect: { x: 0, y: 0, width: 256, height: 256 },
      imageRendering: "pixelated",
    },
    presentation: {
      backend: "image",
      lighting: "source",
      projection: "affine",
      imageRendering: "pixelated",
    },
    assetSha256: HASH,
  };
  const strideMaterial = {
    ...material,
    key: "source-player-texture-13",
    imageSource: {
      ...material.imageSource,
      sourceRect: { x: 32, y: 27, width: 27, height: 27 },
    },
  };
  const texturedPolygon = (z, frameMaterial = material) => ({
    vertices: [[0, 0, z], [2, 0, z], [2, 2, z], [0, 2, z]],
    color: "#ffffff",
    material: frameMaterial,
    textureAlphaMode: "mask",
    uvs: [[0, 1], [1, 1], [1, 0], [0, 0]],
  });
  const frameSet = await buildCssoccerPreparedRenderFrameSet({
    id: "source-textured-player",
    frames: [
      { id: "idle", polygons: [texturedPolygon(0)] },
      { id: "stride", polygons: [texturedPolygon(1, strideMaterial)] },
    ],
  });

  assert.equal(frameSet.kind, "polycss-textured-frame-set");
  assert.equal(frameSet.bundle.kind, "polycss-textured-mesh");
  assert.deepEqual(frameSet.bundle.assets, [{
    url: TEXTURE_URL,
    mediaType: "image/png",
    width: 1280,
    height: 256,
    sha256: HASH,
  }]);
  assert.deepEqual(frameSet.bundle.leaves.map(({ tag }) => tag), ["s"]);
  assert.match(
    frameSet.bundle.meshCss,
    /background-image:url\("?\/cssoccer\/assets\/textures\/spain-argentina-match\.png"?\)/u,
  );
  assert.match(frameSet.bundle.meshCss, /background-color:transparent/u);
  assert.ok(frameSet.frames.every(({ leafStyles }) => (
    leafStyles.every((style) => style.includes("background-color:transparent"))
  )));
  const affineQuad = await buildCssoccerPreparedRenderBundle({
    id: "source-textured-affine-quad",
    polygons: [{
      ...texturedPolygon(0),
      uvs: [[0.1, 0.9], [0.8, 0.8], [0.7, 0.1], [0.2, 0.2]],
    }],
  });
  assert.equal(affineQuad.kind, "polycss-textured-mesh");
  assert.deepEqual(affineQuad.leaves.map(({ tag }) => tag), ["s"]);
  assert.match(affineQuad.meshCss, /spain-argentina-match\.png/u);
  const window = new Window({ url: "http://cssoccer.test/" });
  try {
    const host = window.document.createElement("div");
    host.className = "polycss-scene";
    window.document.body.append(host);
    const handle = mountCssoccerRenderBundleFrameSetMesh(host, frameSet, 0);
    const leaf = handle.leaves[0];
    assert.equal(leaf.tagName.toLowerCase(), "s");
    assert.match(leaf.style.backgroundImage, /spain-argentina-match\.png/u);
    assert.equal(leaf.style.backgroundColor, "transparent");
    const firstBackgroundPosition = leaf.style.backgroundPosition;
    assert.equal(handle.setFrameIndex(1), true);
    assert.equal(handle.leaves[0], leaf);
    assert.notEqual(leaf.style.backgroundPosition, firstBackgroundPosition);
    assert.deepEqual(handle.runtimeConstruction(), zeroConstruction());
  } finally {
    window.close();
  }
});

test("rejects obsolete player-number presentation fields", async () => {
  const polygon = {
    vertices: [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]],
    color: "#980000",
    material: {
      texture: TEXTURE_URL,
      key: "obsolete-player-number",
      imageSource: {
        url: TEXTURE_URL,
        width: 2048,
        height: 256,
        sourceRect: { x: 1536, y: 62, width: 23, height: 27 },
        imageRendering: "pixelated",
      },
      presentation: {
        backend: "image",
        lighting: "source",
        projection: "affine",
        imageRendering: "pixelated",
      },
      assetSha256: HASH,
    },
    textureAlphaMode: "mask",
    uvs: [[0, 1], [1, 1], [1, 0], [0, 0]],
  };
  polygon.preparedPlayerNumberTextures = { schema: "obsolete-player-numbers@1" };
  await assert.rejects(
    buildCssoccerPreparedRenderFrameSet({
      id: "obsolete-player-number-path",
      frames: [{ id: "stand", polygons: [polygon] }],
    }),
    /obsolete player presentation field/u,
  );
});

test("rejects the removed source-camera-facing frame-set contract", async () => {
  assert.throws(
    () => buildCssoccerPreparedRenderFrameSet({
      id: "removed-camera-facing-player",
      frames: [
        { id: "idle", polygons: framePolygons(0, "#ffffff") },
        { id: "stride", polygons: framePolygons(1, "#ffffff") },
      ],
      sourceCameraFacing: { schema: "cssoccer-source-camera-facing-frame-set@1" },
    }),
    /Source camera-facing render frame sets are obsolete/u,
  );
  await assert.rejects(
    buildCssoccerPreparedRenderFrameSet({
      id: "removed-source-points",
      frames: [
        { id: "idle", polygons: framePolygons(0, "#ffffff"), sourcePoints: [0, 0, 0] },
        { id: "stride", polygons: framePolygons(1, "#ffffff"), sourcePoints: [0, 0, 0] },
      ],
    }),
    /contains obsolete source points/u,
  );
  const prepared = await buildCssoccerPreparedRenderFrameSet({
    id: "forbidden-camera-facing-player",
    frames: [
      { id: "idle", polygons: framePolygons(0, "#ffffff") },
      { id: "stride", polygons: framePolygons(1, "#ffffff") },
    ],
  });
  const forbidden = {
    ...prepared,
    sourcePrimitiveTopologyHash: "cd".repeat(32),
    sourceCameraFacing: {
      schema: "cssoccer-source-camera-facing-frame-set@1",
    },
    frameLeafStyleEncoding: "source-camera-facing-source-points@1",
  };
  const window = new Window({ url: "http://cssoccer.test/" });
  try {
    const host = window.document.createElement("div");
    window.document.body.append(host);
    assert.throws(
      () => assertCssoccerPreparedRenderFrameSet(forbidden, window.document),
      /Obsolete source camera-facing frame-set fields are forbidden/u,
    );
    assert.throws(
      () => mountCssoccerRenderBundleFrameSetMesh(host, forbidden, 0),
      /Obsolete source camera-facing frame-set fields are forbidden/u,
    );
  } finally {
    window.close();
  }
});

test("fails closed on assets, topology changes, and tampered prepared payloads", async () => {
  await assert.rejects(
    buildCssoccerPreparedRenderBundle({
      id: "textured",
      polygons: [{
        ...framePolygons(0, "#ffffff")[0],
        texture: "/not-allowed.png",
      }],
    }),
    /unsupported runtime texture input/u,
  );
  await assert.rejects(
    buildCssoccerPreparedRenderFrameSet({
      id: "changed-topology",
      frames: [
        { id: "first", polygons: framePolygons(0, "#ffffff") },
        { id: "second", polygons: [framePolygons(1, "#ffffff")[0]] },
      ],
    }),
    /does not preserve polygon topology/u,
  );
  await assert.rejects(
    buildCssoccerPreparedRenderFrameSet({
      id: "changed-cull-map",
      frames: [
        { id: "first", polygons: framePolygonsWithCull(0, "#ffffff") },
        { id: "second", polygons: framePolygonsWithShiftedCull(1, "#ffffff") },
      ],
    }),
    /polygon-to-leaf|replaced PolyCSS leaf|changed PolyCSS topology/u,
  );

  const bundle = await buildCssoccerPreparedRenderBundle({
    id: "tamper-target",
    polygons: framePolygons(0, "#ffffff"),
  });
  const frameSet = await buildCssoccerPreparedRenderFrameSet({
    id: "tamper-frames",
    frames: [
      { id: "first", polygons: framePolygons(0, "#ffffff") },
      { id: "second", polygons: framePolygons(1, "#aaaaaa") },
    ],
  });
  const window = new Window();
  try {
    assert.throws(
      () => assertCssoccerPreparedRenderBundle({
        ...bundle,
        meshHtml: bundle.meshHtml.replace("</div>", "<img src=x></div>"),
      }, window.document),
      /HTML\/CSS|unsafe/u,
    );
    assert.throws(
      () => assertCssoccerPreparedRenderBundle({ ...bundle, assets: ["asset.png"] }, window.document),
      /material kind does not match its asset list/u,
    );
    assert.throws(
      () => assertCssoccerPreparedRenderBundle({
        ...bundle,
        droppedSourcePolygonCount: 1,
        droppedSourcePolygonIndices: [0],
      }, window.document),
      /dropped-source mapping/u,
    );

    const tamperedFrames = JSON.parse(JSON.stringify(frameSet));
    tamperedFrames.frames[1].leafStyles[0] = "background-image:url(evil.png)";
    assert.throws(
      () => assertCssoccerPreparedRenderFrameSet(tamperedFrames, window.document),
      /unsafe CSS|asset-backed|unsafe background-image/u,
    );
    const tamperedFrameMapping = JSON.parse(JSON.stringify(frameSet));
    tamperedFrameMapping.droppedSourcePolygonIndices = [0];
    assert.throws(
      () => assertCssoccerPreparedRenderFrameSet(tamperedFrameMapping, window.document),
      /not bound to its base bundle/u,
    );
  } finally {
    window.close();
  }
});

function zeroConstruction() {
  return {
    sourceParseCount: 0,
    geometryBuildCount: 0,
    topologyBuildCount: 0,
    materialBuildCount: 0,
    assetBuildCount: 0,
  };
}

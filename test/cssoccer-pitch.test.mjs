import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decodeActuaFaceList,
  decodeActuaOffsetArchive,
  decodeActuaPointList,
  decodeWatcomOmf32Object,
  readActuaB6GeometryInputs,
} from "../src/prepare/cssoccer/formatAdapters.mjs";
import { decodeCssoccerPitchSlice } from "../src/prepare/cssoccer/pitchParser.mjs";
import { buildCssoccerPitchPreparedScene } from "../src/prepare/cssoccer/sceneBuilder.mjs";
import { mergeCssoccerPreparedPolygons } from "../src/prepare/cssoccer/sceneMerge.mjs";
import { prepareCssoccerPitchSurfaceAsset } from "../src/prepare/cssoccer/sourceTextureAtlas.mjs";
const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);

test("prepares the retained native BM_PC and COL_P5 turf without runtime construction", () => {
  const pitch = prepareCssoccerPitchSurfaceAsset({
    euroRendDatBytes: readFileSync(new URL("EUROREND.DAT", sourceRoot)),
    euroRendOffBytes: readFileSync(new URL("EUROREND.OFF", sourceRoot)),
  });

  assert.deepEqual(pitch.source, {
    sourceArchive: "EUROREND.DAT",
    pitchBitmap: "BM_PC",
    pitchSelector: 920,
    pitchPalette: "COL_P5",
    pitchPaletteSelector: 544,
    selection: "retained-native-frame-50-visual-binding",
  });
  assert.equal(pitch.width, 1680);
  assert.equal(pitch.height, 1160);
  assert.equal(
    pitch.rgbaSha256,
    "d0395721245045d802774200afee24eaca7d4b2463fc5a653d5c97d4e5bccf4b",
  );
  assert.equal(
    pitch.assetFile.expectedSha256,
    "4652fa1051af33eb514074d6e0b0dd7abae7ccb8a37e35deafb216fe4001a266",
  );
});

test("decodes the pinned OMF geometry and native visual stadium selectors", async () => {
  const inputs = await readActuaB6GeometryInputs({ sourceRoot });

  assert.deepEqual(inputs.inputHashes, {
    dataObjectSha256: "af643e660c93c51d0abe3ee7ef3ac276918fabfd9766af15e309df18776d873b",
    engineObjectSha256: "49de827ef363e9367855bcf5ddfe7b6f20eca55d0907a4fc07da233010cbe733",
    archiveDataSha256: "0c38ab865fcd1d62d7c0f3f88b861f4c43643caf402dea6fbe9b0f042fd340cb",
    archiveIndexSha256: "96e6cea4bb91667cd204faa928696006048cf35a4e0baabefe83eca5d06dcb87",
  });
  assert.equal(inputs.dataObject.byteLength, 28_660);
  assert.equal(inputs.dataObject.recordCount, 198);
  assert.equal(inputs.dataObject.uncheckedRecordCount, 0);
  assert.equal(inputs.dataObject.symbolNames.length, 179);
  assert.equal(inputs.archive.recordCount, 229);
  assert.equal(inputs.archive.gapByteCount, 8);
  assert.equal(inputs.stadiumSelectors.entryIndex, 0);
  assert.deepEqual(inputs.stadiumSelectors.layout.dimensions, {
    st_w: 190,
    st_l: 190,
    st_h: 290,
  });
  assert.deepEqual(
    inputs.stadiumSelectors.bindings.map((binding) => ({
      slot: binding.slot,
      offset: binding.offset,
      pointsFile: binding.pointsFile,
      facesFile: binding.facesFile,
      pointsSelector: binding.pointsSelector,
      facesSelector: binding.facesSelector,
      pointCount: binding.pointCount,
      faceCount: binding.faceCount,
    })),
    [
      { slot: 1, offset: [1653.927978515625, 0, -462.26800537109375], pointsFile: "PTS_STAD04", facesFile: "FCE_STAD04", pointsSelector: 1016, facesSelector: 1008, pointCount: 142, faceCount: 139 },
      { slot: 2, offset: [640.6950073242188, 0, 294.7879943847656], pointsFile: "PTS_STAD01", facesFile: "FCE_STAD01", pointsSelector: 1032, facesSelector: 1024, pointCount: 86, faceCount: 45 },
      { slot: 3, offset: [-366.375, 0, -394.760009765625], pointsFile: "PTS_STAD02", facesFile: "FCE_STAD02", pointsSelector: 1064, facesSelector: 1056, pointCount: 142, faceCount: 139 },
      { slot: 4, offset: [640.583984375, 0, -1116.4990234375], pointsFile: "PTS_STAD03", facesFile: "FCE_STAD03", pointsSelector: 1048, facesSelector: 1040, pointCount: 98, faceCount: 52 },
    ],
  );
  assert.deepEqual({
    tableSymbol: inputs.stadiumSelectors.textures.tableSymbol,
    tableSelector: inputs.stadiumSelectors.textures.tableSelector,
    tableBytes: inputs.stadiumSelectors.textures.tableRecord.size,
    bitmapSelectors: inputs.stadiumSelectors.textures.bitmapSelectors,
    bitmapBytes: inputs.stadiumSelectors.textures.bitmapRecords.map(({ size }) => size),
    nativeMapPages: inputs.stadiumSelectors.textures.nativeMapPages,
  }, {
    tableSymbol: "TMD_STAD0",
    tableSelector: 1000,
    tableBytes: 1_568,
    bitmapSelectors: [328, 336],
    bitmapBytes: [65_536, 65_536],
    nativeMapPages: [8, 9],
  });

  const pitchPoints = decodeActuaPointList(inputs.dataObject.symbolBytes("pitch_p"), { id: "pitch_p" });
  const pitchFaces = decodeActuaFaceList(inputs.dataObject.symbolBytes("pitch_f"), {
    id: "pitch_f",
    pointCount: pitchPoints.pointCount,
  });
  assert.equal(pitchPoints.pointCount, 38);
  assert.equal(pitchFaces.faceCount, 18);
  assert.deepEqual([...new Set(pitchFaces.faces.map(({ primitive }) => primitive))], ["polygon"]);
});

test("fails closed on malformed native containers and face references", () => {
  const corruptObject = Buffer.from(readFileSync(new URL("DATA.OBJ", sourceRoot)));
  const firstRecordLength = corruptObject.readUInt16LE(1);
  const checksumOffset = firstRecordLength + 2;
  corruptObject[checksumOffset] = corruptObject[checksumOffset] === 0xff
    ? 0xfe
    : corruptObject[checksumOffset] + 1;
  assert.throws(
    () => decodeWatcomOmf32Object(corruptObject, { label: "corrupt DATA.OBJ" }),
    /invalid OMF checksum/u,
  );

  const index = Buffer.alloc(16);
  index.writeUInt32LE(0, 0);
  index.writeUInt32LE(3, 4);
  index.writeUInt32LE(2, 8);
  index.writeUInt32LE(2, 12);
  assert.throws(
    () => decodeActuaOffsetArchive({ dataBytes: Buffer.alloc(4), indexBytes: index }),
    /overlaps/u,
  );

  const invalidFace = Buffer.alloc(10);
  invalidFace.writeUInt16LE(1, 0);
  invalidFace.writeInt16LE(2, 2);
  invalidFace.writeInt16LE(22, 4);
  invalidFace.writeInt16LE(1, 6);
  invalidFace.writeInt16LE(0, 8);
  assert.throws(
    () => decodeActuaFaceList(invalidFace, { id: "invalid face", pointCount: 1 }),
    /outside 0\.\.0/u,
  );
});

test("prebakes the exact retained pitch, stadium, goals, flags, and official roots", async () => {
  const slice = await decodeCssoccerPitchSlice({ sourceRoot });

  assert.deepEqual(slice.dimensions, {
    nativeUnitsPerYard: 16,
    yards: { length: 80, width: 50 },
    playingFieldNative: { length: 1280, width: 800 },
    simplePitchOuterBounds: { x: [-200, 1480], z: [-980, 180] },
    stadiumContext: { st_w: 190, st_l: 190, st_h: 290 },
  });
  assert.deepEqual(slice.axes.components, ["x", "y", "z"]);
  assert.deepEqual(slice.axes.gameplayToRenderer, ["x", "z", "-y"]);
  assert.deepEqual(slice.axes.playingField, { x: [0, 1280], y: [0, null], z: [-800, 0] });
  assert.equal(slice.objects.length, 29);
  assert.equal(slice.officialRoots.length, 3);
  assert.deepEqual(slice.officialRoots.map(({ nativeRendererIndex }) => nativeRendererIndex), [22, 23, 24]);
  assert.deepEqual(
    slice.objects
      .filter(({ role }) => role === "goal")
      .map(({ sourceObject, sourcePoints, sourceFaces, sourceDetail }) => ({
        sourceObject,
        sourcePoints,
        sourceFaces,
        sourceDetail,
      })),
    [
      { sourceObject: "goal1_1", sourcePoints: "goal1c_p", sourceFaces: "goal_f1d", sourceDetail: "goal1_a" },
      { sourceObject: "goal2_1", sourcePoints: "goal2c_p", sourceFaces: "goal_f1dm", sourceDetail: "goal2_a" },
      { sourceObject: "goal3_1", sourcePoints: "goal3c_p", sourceFaces: "goal_f2dm", sourceDetail: "goal3_a" },
      { sourceObject: "goal4_1", sourcePoints: "goal3a_p", sourceFaces: "goal_f3d", sourceDetail: "goal4_a" },
      { sourceObject: "goal1_2", sourcePoints: "goal1cx_p", sourceFaces: "goal_f1dm", sourceDetail: "goal1_b" },
      { sourceObject: "goal2_2", sourcePoints: "goal2cx_p", sourceFaces: "goal_f1d", sourceDetail: "goal2_b" },
      { sourceObject: "goal3_2", sourcePoints: "goal3cx_p", sourceFaces: "goal_f2d", sourceDetail: "goal3_b" },
      { sourceObject: "goal4_2", sourcePoints: "goal3ax_p", sourceFaces: "goal_f3d", sourceDetail: "goal4_b" },
    ],
  );
  assert.deepEqual(slice.lineage.goalDetailTier, {
    selector: "objdepd",
    zScaleMinimum: 0,
    bindings: {
      goal1_a: { points: "goal1c_p", faces: "goal_f1d" },
      goal2_a: { points: "goal2c_p", faces: "goal_f1dm" },
      goal3_a: { points: "goal3c_p", faces: "goal_f2dm" },
      goal4_a: { points: "goal3a_p", faces: "goal_f3d" },
      goal1_b: { points: "goal1cx_p", faces: "goal_f1dm" },
      goal2_b: { points: "goal2cx_p", faces: "goal_f1d" },
      goal3_b: { points: "goal3cx_p", faces: "goal_f2d" },
      goal4_b: { points: "goal3ax_p", faces: "goal_f3d" },
    },
  });
  assert.deepEqual(slice.metrics, {
    sourceObjectInstanceCount: 29,
    uniqueStaticSymbolPairCount: 20,
    instancedPointCount: 916,
    sourceFaceInstanceCount: 700,
    sourceTriangleInstanceCount: 1336,
    polygonCount: 700,
    renderLeafCount: 700,
    uniqueSourceFaceIdCount: 700,
  });
  assert.ok(Object.isFrozen(slice));
  assert.ok(Object.isFrozen(slice.objects[0].polygons[0].vertices));
  assert.deepEqual(slice.lineage.presentationAdapters[0], {
    id: "native-line-ribbon",
    widthNative: 2,
  });
  const lineWidths = slice.objects
    .filter(({ role }) => role === "marking")
    .flatMap(({ polygons }) => polygons)
    .filter(({ source }) => source.sourcePrimitive === "line")
    .map(({ vertices }) => Math.hypot(
      vertices[0][0] - vertices[3][0],
      vertices[0][1] - vertices[3][1],
      vertices[0][2] - vertices[3][2],
    ));
  assert.ok(lineWidths.length > 0);
  assert.ok(lineWidths.every((width) => Math.abs(width - 2) < 0.000001));
  const flags = slice.objects.filter(({ role }) => role === "flag");
  assert.equal(flags.length, 4);
  assert.ok(flags.every(({ polygons }) => polygons.length === 7));
  assert.deepEqual(
    flags[0].polygons.map(({ color, source }) => [source.sourceColorCode, color]),
    [
      [31, "#ffffff"],
      [29, "#ebebeb"],
      [27, "#dbdbdb"],
      [29, "#ebebeb"],
      [29, "#ebebeb"],
      [-2579, "#ffffff"],
      [-2579, "#ffffff"],
    ],
  );
  assert.deepEqual(flags[0].polygons[5].vertices, [
    [0, 19, 0],
    [1.751, 6.629, 1.751],
    [0, 10, 0],
  ]);
  assert.deepEqual(
    slice.materials.find(({ id }) => id === "actua-flag-n2579"),
    {
      id: "actua-flag-n2579",
      role: "flag",
      color: "#ffffff",
      browserSafe: true,
      sourceColorCode: -2579,
      sourceKind: "native-texture-reference",
      preparedTextureRequired: true,
    },
  );
  const goalPolygons = slice.objects
    .filter(({ role }) => role === "goal")
    .flatMap(({ polygons }) => polygons);
  assert.deepEqual(
    [...new Map(goalPolygons.filter(({ source }) => source.sourceColorCode >= 0).map(({
      color,
      source,
    }) => [source.sourceColorCode, color]))].sort(([left], [right]) => left - right),
    [
      [22, "#aeaeae"],
      [24, "#bebebe"],
      [26, "#d3d3d3"],
      [28, "#e3e3e3"],
      [30, "#f3f3f3"],
    ],
  );
  const goalNetPolygons = goalPolygons.filter(({ source }) => source.sourceColorCode < 0);
  assert.equal(goalNetPolygons.length, 16);
  assert.deepEqual(
    [...new Set(goalNetPolygons.map(({ source }) => source.sourceColorCode))]
      .sort((left, right) => left - right),
    [-3000, -2999, -2998, -2997],
  );
  assert.ok(goalNetPolygons.every(({ preparedTextureRequired }) => (
    preparedTextureRequired === true
  )));
  const pitchColors = new Map(slice.objects
    .filter(({ role }) => role === "pitch")
    .flatMap(({ polygons }) => polygons)
    .map(({ color, source }) => [source.sourceColorCode, color]));
  assert.deepEqual([...pitchColors].sort(([left], [right]) => left - right), [
    [134, "#1c450c"],
    [138, "#305d1c"],
  ]);
  const stadiumSolidColors = new Map(slice.objects
    .filter(({ role }) => role === "stadium")
    .flatMap(({ polygons }) => polygons)
    .filter(({ source }) => source.sourceColorCode >= 0)
    .map(({ color, source }) => [source.sourceColorCode, color]));
  assert.deepEqual([...stadiumSolidColors].sort(([left], [right]) => left - right), [
    [159, "#8a048e"],
    [248, "#ef5151"],
    [249, "#791820"],
    [250, "#ff6161"],
    [255, "#ffffff"],
  ]);
  assert.doesNotMatch(JSON.stringify(slice), /\/Users\/|\.local\//u);
});

test("keeps source coverage and visible area exact while merging prepared leaves", () => {
  const source = (index) => ({ id: `face-${index}`, container: "synthetic", sourceFaceIndex: index });
  const merged = mergeCssoccerPreparedPolygons([
    {
      vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
      color: "#ffffff",
      materialId: "white",
      visibilityGroup: "pitch",
      paintOrder: 0,
      source: source(0),
    },
    {
      vertices: [[1, 0, 0], [2, 0, 0], [2, 0, 1], [1, 0, 1]],
      color: "#ffffff",
      materialId: "white",
      visibilityGroup: "pitch",
      paintOrder: 1,
      source: source(1),
    },
  ], { scopeId: "synthetic-adjacent" });

  assert.equal(merged.polygons.length, 1);
  assert.deepEqual(merged.polygons[0].sources.map(({ id }) => id), ["face-0", "face-1"]);
  assert.deepEqual(merged.metrics, {
    scopeId: "synthetic-adjacent",
    inputPolygonCount: 2,
    inputTriangleCount: 4,
    topologyComponentCount: 1,
    mergeCandidateCount: 2,
    acceptedMergeCandidateCount: 2,
    mergeOutputCount: 1,
    outputPolygonCount: 1,
    outputTriangleCount: 2,
    sourceFaceCoverageCount: 2,
    areaBefore: 2,
    areaAfter: 2,
    lossless: true,
  });

  const split = mergeCssoccerPreparedPolygons([
    { ...merged.polygons[0], vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], sources: [source(0)] },
    { ...merged.polygons[0], vertices: [[1, 0, 0], [2, 0, 0], [2, 0, 1], [1, 0, 1]], materialId: "other", sources: [source(1)] },
  ]);
  assert.equal(split.polygons.length, 2);
});

test("publishes a deterministic static PolyCSS scene with no runtime construction", async () => {
  const first = await buildCssoccerPitchPreparedScene({ sourceRoot });
  const second = await buildCssoccerPitchPreparedScene({ sourceRoot });

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.meshes.length, 9);
  assert.equal(first.roots.static.length, 9);
  assert.equal(first.roots.officials.length, 3);
  assert.deepEqual(first.runtimeConstruction, {
    sourceParseCount: 0,
    geometryBuildCount: 0,
    topologyBuildCount: 0,
    materialBuildCount: 0,
    atlasBuildCount: 0,
  });
  assert.deepEqual(first.metrics, {
    sourceObjectCount: 29,
    uniqueStaticSymbolPairCount: 20,
    sourcePointCount: 916,
    sourceFaceCount: 700,
    sourceTriangleCount: 1336,
    preparedPolygonCount: 700,
    meshCount: 9,
    officialRootCount: 3,
    mergeTopologyComponentCount: 560,
    mergeCandidateCount: 203,
    acceptedMergeCandidateCount: 50,
    mergeOutputCount: 17,
    renderLeafCount: 667,
    renderTriangleCount: 1270,
    sourceFaceCoverageCount: 700,
    mergeLossless: true,
  });

  const leaves = first.meshes.flatMap(({ polygons }) => polygons);
  assert.equal(leaves.length, first.metrics.renderLeafCount);
  assert.equal(leaves.flatMap(({ sources }) => sources).length, first.metrics.sourceFaceCount);
  for (const leaf of leaves) {
    assert.match(leaf.color, /^#[0-9a-f]{6}$/u);
    assert.ok(leaf.sources.length > 0);
    assert.ok(leaf.sources.every(({ id, container }) => id && ["DATA.OBJ", "EUROREND.DAT"].includes(container)));
  }
  const stadiumTextureLeaves = first.meshes
    .filter(({ id }) => id.startsWith("stadium-stand-"))
    .flatMap(({ polygons }) => polygons)
    .filter(({ sources }) => sources[0].sourceColorCode < 0);
  assert.equal(stadiumTextureLeaves.length, 234);
  assert.ok(stadiumTextureLeaves.every(({ sources }) => sources.length === 1));
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.meshes[0].polygons[0]));
  assert.doesNotMatch(JSON.stringify(first), /\/Users\/|\.local\//u);
});

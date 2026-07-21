import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { inflateSync } from "node:zlib";

import { decodeActuaOffsetArchive } from "../src/prepare/cssoccer/formatAdapters.mjs";
import {
  bindCssoccerCornerFlagTexture,
  bindCssoccerGoalNetTexture,
  bindCssoccerPreparedTextureRecord,
  prepareCssoccerSourceTextureAtlas,
} from "../src/prepare/cssoccer/sourceTextureAtlas.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const rendererRoot = new URL(
  "../.local/cssoccer/source-assets/actua-demo/extracted/",
  import.meta.url,
);
const retailRendererRoot = new URL(
  "../.local/cssoccer/source-assets/actua-retail-1996/extracted/",
  import.meta.url,
);
const sourceFiles = [
  "3DENG.OBJ",
  "EUROREND.DAT",
  "EUROREND.OFF",
];
const rendererFiles = ["ACTREND.DAT", "ACTREND.OFF"];
const missing = [
  ...sourceFiles.filter((file) => !existsSync(new URL(file, sourceRoot))),
  ...rendererFiles.filter((file) => !existsSync(new URL(file, rendererRoot))),
  ...rendererFiles.filter((file) => !existsSync(new URL(file, retailRendererRoot))),
];

test("prebakes native alpha for the retail Actua highlights and Spain player number 2", {
  skip: missing.length > 0 ? `ignored pinned source is unavailable: ${missing.join(", ")}` : false,
}, () => {
  const source = (file) => readFileSync(new URL(file, sourceRoot));
  const preparation = prepareCssoccerSourceTextureAtlas({
    actRendDatBytes: readFileSync(new URL("ACTREND.DAT", rendererRoot)),
    actRendOffBytes: readFileSync(new URL("ACTREND.OFF", rendererRoot)),
    retailActRendDatBytes: readFileSync(new URL("ACTREND.DAT", retailRendererRoot)),
    retailActRendOffBytes: readFileSync(new URL("ACTREND.OFF", retailRendererRoot)),
    threeDEngObjectBytes: source("3DENG.OBJ"),
    euroRendDatBytes: source("EUROREND.DAT"),
    euroRendOffBytes: source("EUROREND.OFF"),
    footyPalBytes: source("FOOTY.PAL"),
  });
  const binding = bindCssoccerPreparedTextureRecord(preparation, -2550);

  assert.deepEqual(preparation.metadata.playerNumberPrebake, {
    schema: "cssoccer-prepared-player-number-chroma-key@1",
    status: "ready-source-backed-prebaked-number-alpha",
    sourcePage: 6,
    sourceBands: [
      { team: "spain", selector: 1936, y: 62, height: 27 },
      { team: "argentina", selector: 1944, y: 89, height: 54 },
    ],
    transparentPaletteIndex: 1,
    nativeFaceDispatch: "source color < -2000 selects 3DENG.C polyt",
    projectionStage: "prepare-time",
    runtimeImageConstruction: false,
    runtimeAlphaMutation: false,
    shirtBackUvPresentation: "native-quad-uvs",
    shirtBackTexelPresentation:
      "vertical-and-horizontal-reflection-prebaked-in-generated-atlas",
  });
  assert.equal(binding.nativeTextureSlot, 550);
  assert.equal(binding.transparent, true);
  assert.deepEqual(binding.material.imageSource.sourceRect, {
    x: 1559,
    y: 62,
    width: 23,
    height: 27,
  });
  assert.deepEqual(binding.uvs, [[0, 1], [1, 1], [1, 0], [0, 0]]);

  const argentinaNumber15 = bindCssoccerPreparedTextureRecord(preparation, -2578);
  assert.equal(argentinaNumber15.nativeTextureSlot, 578);
  assert.deepEqual(argentinaNumber15.material.imageSource.sourceRect, {
    x: 1674,
    y: 116,
    width: 23,
    height: 27,
  });
  assert.deepEqual(argentinaNumber15.uvs, [[0, 1], [1, 1], [1, 0], [0, 0]]);

  const rgba = decodeFilterZeroRgbaPng(preparation.assetFile.bytes, 2048, 256);
  const cornerFlag = bindCssoccerCornerFlagTexture(preparation, -2579);
  assert.equal(preparation.metadata.counts.browserAtlasPlacements, 9);
  assert.deepEqual({
    sourceColorCode: cornerFlag.sourceColorCode,
    nativeTextureSlot: cornerFlag.nativeTextureSlot,
    archiveRecordIndex: cornerFlag.archiveRecordIndex,
    nativePage: cornerFlag.nativePage,
    sourceRect: cornerFlag.sourceRect,
    basisVertexIndexes: cornerFlag.basisVertexIndexes,
    textureRecordSha256: cornerFlag.textureRecordSha256,
    transparent: cornerFlag.transparent,
  }, {
    sourceColorCode: -2579,
    nativeTextureSlot: 579,
    archiveRecordIndex: 578,
    nativePage: 6,
    sourceRect: { x: 204, y: 142, width: 26, height: 29 },
    basisVertexIndexes: [2, 0, 1],
    textureRecordSha256:
      "4d3af4533933066821815be77e5fcec94a37cb04eb453d087fb395a9a1673466",
    transparent: true,
  });
  assert.deepEqual(cornerFlag.material.imageSource.sourceRect, {
    x: 1792,
    y: 64,
    width: 26,
    height: 32,
  });
  assert.deepEqual(cornerFlag.uvs, [[0, 1], [1, 1], [1, 0], [0, 0]]);
  assert.deepEqual(countAlphaTexels(rgba, 2048, cornerFlag.material.imageSource.sourceRect), {
    transparentTexels: 426,
    opaqueTexels: 406,
  });
  const flagColors = new Set();
  for (let y = 64; y < 96; y += 1) {
    for (let x = 1792; x < 1818; x += 1) {
      const offset = (y * 2048 + x) * 4;
      if (rgba[offset + 3] === 0) continue;
      assert.equal(rgba[offset + 1], 0);
      assert.equal(rgba[offset + 2], 0);
      flagColors.add(rgba[offset]);
    }
  }
  assert.deepEqual([...flagColors].sort((left, right) => left - right), [
    174, 178, 186, 190, 199, 207, 211, 219,
  ]);
  assert.throws(
    () => bindCssoccerCornerFlagTexture(preparation, -2580),
    /only accepts source texture -2579/u,
  );
  assert.deepEqual({
    status: preparation.metadata.stadiumAtlas.goalNets.status,
    bitmap: preparation.metadata.stadiumAtlas.goalNets.bitmap,
    softwarePaletteRemap:
      preparation.metadata.stadiumAtlas.goalNets.softwarePaletteRemap,
    transparentPaletteIndex:
      preparation.metadata.stadiumAtlas.goalNets.transparentPaletteIndex,
    triangleCutoutCount:
      preparation.metadata.stadiumAtlas.goalNets.triangleCutoutCount,
  }, {
    status: "ready-source-backed-bm-nets",
    bitmap: {
      symbol: "BM_NETS",
      selector: 320,
      selectorAuthority: {
        object: "3DENG.OBJ",
        function: "init3d",
        objectOffset: "0x00013ef4",
        instruction: "mov eax,0x00000140",
        sourceCall: "readfile(BM_NETS,maps[S_BM+7])",
      },
      nativePage: 15,
      width: 256,
      height: 256,
      sourceSha256:
        "8041471f193f40d64af669dafd32029d9206322d919172ab1716222c5773a4dc",
      remappedSha256:
        "97808dfe058a5723f30e84dc89288fa863949f77beb81a3ec5e7bc743891ceb3",
    },
    softwarePaletteRemap: 1,
    transparentPaletteIndex: 1,
    triangleCutoutCount: 8,
  });
  assert.deepEqual(preparation.metadata.stadiumAtlas.palette.overrides[0], {
    id: "spain-pitch",
    symbol: "COL_P5",
    selector: 544,
    firstEntry: 128,
    entries: 16,
  });
  const expectedGoalNets = [
    [-2997, 997, "c08e65b85e7db331d6439e8727b324586a45367c8d5ced2a0f2ab9a67d1adbb3"],
    [-2998, 998, "0f160ccea75ebb1f4d049b353104a60977c5cc236b201ecebb7136a798ba7ac2"],
    [-2999, 999, "7647f6557a0706e9457f9c4dc27c6e6894ef861e261c8c7a57d28d7f2ba5bd48"],
    [-3000, 1000, "72770400f679cc3059758900b9228ac3516d2aafee906c950e7941f7302c7c39"],
  ];
  const stadiumRgba = decodeFilterZeroRgbaPng(preparation.stadiumAssetFile.bytes, 1024, 768);
  for (const [sourceColorCode, nativeTextureSlot, textureRecordSha256] of expectedGoalNets) {
    const goalNet = bindCssoccerGoalNetTexture(preparation, sourceColorCode);
    assert.equal(goalNet.nativeTextureSlot, nativeTextureSlot);
    assert.equal(goalNet.nativePage, 15);
    assert.equal(goalNet.transparent, true);
    assert.equal(goalNet.textureRecordSha256, textureRecordSha256);
    assert.equal(goalNet.triangleMaterials.length, 2);
    let opaqueTexels = 0;
    for (const material of goalNet.triangleMaterials) {
      const counts = countAlphaTexels(
        stadiumRgba,
        1024,
        material.imageSource.sourceRect,
      );
      assert.ok(counts.transparentTexels > 0);
      opaqueTexels += counts.opaqueTexels;
    }
    assert.ok(opaqueTexels > 0);
  }
  assert.equal(bindCssoccerGoalNetTexture(preparation, -2996), null);
  assert.deepEqual(preparation.metadata.playerHighlightPrebake, {
    schema: "cssoccer-prepared-player-highlight-textures@1",
    status: "ready-source-backed-prebaked-highlight-alpha",
    sourceArchive: "retail-player-supplement",
    sourcePage: 6,
    sourceSelector: 584,
    sourceRecordSha256:
      "1138cf54ea07e96f6c71d8378bc0d0bd405e9ee99d36860707bd37b6c231fc68",
    sourceBand: { y: 0, height: 62 },
    transparentPaletteIndex: 1,
    markerFamilies: [
      {
        id: "player-highlight-family-normal",
        sourceName: "plhi1",
        nativeTextureSlot: 533,
        sourceColorCode: -2533,
        sourceRect: { x: 64, y: 0, width: 32, height: 31 },
      },
      {
        id: "player-highlight-family-cross",
        sourceName: "plhi2",
        nativeTextureSlot: 534,
        sourceColorCode: -2534,
        sourceRect: { x: 96, y: 0, width: 32, height: 31 },
      },
      {
        id: "player-highlight-family-ball-shoot",
        sourceName: "plhi3",
        nativeTextureSlot: 535,
        sourceColorCode: -2535,
        sourceRect: { x: 128, y: 0, width: 32, height: 31 },
      },
      {
        id: "player-highlight-family-star-special",
        sourceName: "plhi4",
        nativeTextureSlot: 536,
        sourceColorCode: -2536,
        sourceRect: { x: 0, y: 0, width: 32, height: 31 },
      },
    ],
    nativeFaceDispatch: "source color < -2000 selects 3DENG.C polyt",
    projectionStage: "prepare-time",
    runtimeImageConstruction: false,
    runtimeAlphaMutation: false,
  });

  const retailArchive = decodeActuaOffsetArchive({
    dataBytes: readFileSync(new URL("ACTREND.DAT", retailRendererRoot)),
    indexBytes: readFileSync(new URL("ACTREND.OFF", retailRendererRoot)),
    label: "retail player-highlight and number fixture",
  });
  const sourceHighlightPage = retailArchive.recordBytes(584);
  const expectedMarkers = [
    { code: -2533, slot: 533, x: 64, transparentTexels: 428 },
    { code: -2534, slot: 534, x: 96, transparentTexels: 240 },
    { code: -2535, slot: 535, x: 128, transparentTexels: 500 },
    { code: -2536, slot: 536, x: 0, transparentTexels: 552 },
  ];
  for (const marker of expectedMarkers) {
    const markerBinding = bindCssoccerPreparedTextureRecord(preparation, marker.code);
    assert.equal(markerBinding.nativeTextureSlot, marker.slot);
    assert.equal(markerBinding.transparent, true);
    assert.deepEqual(markerBinding.material.imageSource.sourceRect, {
      x: 1536 + marker.x,
      y: 0,
      width: 32,
      height: 31,
    });
    const alphaCounts = countAlphaTexels(rgba, 2048, {
      x: 1536 + marker.x,
      y: 0,
      width: 32,
      height: 31,
    });
    assert.deepEqual(alphaCounts, {
      transparentTexels: marker.transparentTexels,
      opaqueTexels: 32 * 31 - marker.transparentTexels,
    });
    assertMarkerOpaqueTexelsAreYellow(rgba, 2048, {
      x: 1536 + marker.x,
      y: 0,
      width: 32,
      height: 31,
    });
  }

  for (let nativeTextureSlot = 533; nativeTextureSlot <= 548; nativeTextureSlot += 1) {
    const binding = bindCssoccerPreparedTextureRecord(
      preparation,
      -(nativeTextureSlot + 2000),
    );
    const rect = binding.material.imageSource.sourceRect;
    assert.equal(binding.nativeTextureSlot, nativeTextureSlot);
    assert.equal(binding.transparent, true);
    assert.equal(rect.x >= 1536 && rect.x + rect.width <= 1792, true);
    assert.equal(rect.y >= 0 && rect.y + rect.height <= 62, true);
    for (let row = 0; row < rect.height; row += 1) {
      for (let column = 0; column < rect.width; column += 1) {
        const sourcePaletteIndex = sourceHighlightPage[
          (rect.y + row) * 256 + rect.x - 1536 + column
        ];
        const preparedAlpha = rgba[
          ((rect.y + row) * 2048 + rect.x + column) * 4 + 3
        ];
        assert.equal(
          preparedAlpha,
          sourcePaletteIndex === 0 || sourcePaletteIndex === 1 ? 0 : 255,
          `Highlight slot ${nativeTextureSlot} texel ${column},${row} lost native alpha.`,
        );
      }
    }
  }

  let transparentTexels = 0;
  let opaqueTexels = 0;
  for (let y = 62; y < 89; y += 1) {
    for (let x = 1559; x < 1582; x += 1) {
      const alpha = rgba[(y * 2048 + x) * 4 + 3];
      if (alpha === 0) transparentTexels += 1;
      else if (alpha === 255) opaqueTexels += 1;
      else assert.fail(`Unexpected number alpha ${alpha}.`);
    }
  }
  assert.deepEqual({ transparentTexels, opaqueTexels }, {
    transparentTexels: 326,
    opaqueTexels: 295,
  });

  const sourceNumbers = retailArchive.recordBytes(1936);
  for (let row = 0; row < 27; row += 1) {
    for (let column = 0; column < 23; column += 1) {
      const sourcePaletteIndex = sourceNumbers[
        (26 - row) * 256 + 23 + (22 - column)
      ];
      const preparedAlpha = rgba[
        (row + 62) * 2048 * 4 + (1536 + 23 + column) * 4 + 3
      ];
      assert.equal(
        preparedAlpha,
        sourcePaletteIndex === 0 || sourcePaletteIndex === 1 ? 0 : 255,
        `Spain number 2 texel ${column},${row} did not retain its 180-degree source rotation.`,
      );
    }
  }
});

function countAlphaTexels(rgba, imageWidth, rect) {
  let transparentTexels = 0;
  let opaqueTexels = 0;
  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const alpha = rgba[
        ((rect.y + row) * imageWidth + rect.x + column) * 4 + 3
      ];
      if (alpha === 0) transparentTexels += 1;
      else if (alpha === 255) opaqueTexels += 1;
      else assert.fail(`Unexpected prepared alpha ${alpha}.`);
    }
  }
  return { transparentTexels, opaqueTexels };
}

function assertMarkerOpaqueTexelsAreYellow(rgba, imageWidth, rect) {
  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const offset = ((rect.y + row) * imageWidth + rect.x + column) * 4;
      if (rgba[offset + 3] === 0) continue;
      assert.equal(rgba[offset], rgba[offset + 1]);
      assert.equal(rgba[offset] >= 188, true);
      assert.equal(rgba[offset + 2] <= 16, true);
    }
  }
}

function decodeFilterZeroRgbaPng(bytes, width, height) {
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scanlines = inflateSync(Buffer.concat(idat));
  assert.equal(scanlines.length, height * (1 + width * 4));
  const rgba = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceOffset = row * (1 + width * 4);
    assert.equal(scanlines[sourceOffset], 0);
    scanlines.copy(
      rgba,
      row * width * 4,
      sourceOffset + 1,
      sourceOffset + 1 + width * 4,
    );
  }
  return rgba;
}

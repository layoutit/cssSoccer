import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { parseCssoccerAnimationTable } from
  "../src/prepare/cssoccer/animationTable.mjs";
import { decodeFilterZeroRgbaPng } from
  "../src/prepare/cssoccer/exactActuaPlayerTextureCodec.mjs";
import { prepareCssoccerExactActuaPlayerGeometry } from
  "../src/prepare/cssoccer/exactActuaPlayerGeometry.mjs";
import {
  CSSOCCER_EXACT_ACTUA_PLAYER_MATERIALS_SCHEMA,
  prepareCssoccerExactActuaPlayerMaterials,
} from "../src/prepare/cssoccer/exactActuaPlayerMaterials.mjs";
import { prepareExactActuaPlayerModel } from
  "../src/prepare/cssoccer/exactActuaPlayerModel.mjs";
import { prepareCssoccerExactActuaPlayerSequences } from
  "../src/prepare/cssoccer/exactActuaPlayerSequences.mjs";
import { prepareCssoccerSourceTextureAtlas } from
  "../src/prepare/cssoccer/sourceTextureAtlas.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const demoRendererRoot = new URL(
  "../.local/cssoccer/source-assets/actua-demo/extracted/",
  import.meta.url,
);
const retailRendererRoot = new URL(
  "../.local/cssoccer/source-assets/actua-retail-1996/extracted/",
  import.meta.url,
);
const sourceFiles = [
  "DATA.H", "ACTIONS.CPP", "DATA.OBJ", "3DENG.C", "3DENG.OBJ", "EUROREND.DAT",
  "EUROREND.OFF",
];
const rendererFiles = ["ACTREND.DAT", "ACTREND.OFF"];
const missing = [
  ...sourceFiles.filter((file) => !existsSync(new URL(file, sourceRoot))),
  ...rendererFiles.filter((file) => !existsSync(new URL(file, demoRendererRoot))),
  ...rendererFiles.filter((file) => !existsSync(new URL(file, retailRendererRoot))),
];
const sourceTestOptions = {
  skip: missing.length > 0
    ? `ignored pinned source is unavailable: ${missing.join(", ")}`
    : false,
  timeout: 240_000,
};

test("prepares complete Spain/Argentina materials and all fixture numbers on one geometry", sourceTestOptions, () => {
  const prepared = prepareMaterials();
  const contract = prepared.publication;

  assert.equal(contract.schema, CSSOCCER_EXACT_ACTUA_PLAYER_MATERIALS_SCHEMA);
  assert.equal(contract.status, "ready-complete-two-profile-normalized-atlas");
  assert.deepEqual(contract.counts, {
    profiles: 2,
    fixturePlayers: 22,
    faceBindingsPerProfile: 13,
    supportedNumbersPerProfile: 15,
    textureEntries: 386,
    selectorOffsetsByFace: [60, 60, 60, 60, 7, 7, 7, 7, 7, 7, 7, 7, 1],
  });
  assert.equal(contract.atlas.requestCount, 1);
  assert.equal(contract.atlas.width, 1088);
  assert.equal(contract.atlas.height, 858);
  assert.equal(contract.atlas.sourceTextureEntries, 386);
  assert.equal(contract.entries[0].nativeTextureSlot, 1);
  assert.equal(contract.entries[355].nativeTextureSlot, 356);
  assert.equal(contract.entries[356].nativeTextureSlot, 549);
  assert.equal(contract.entries.at(-1).nativeTextureSlot, 578);
  assert.deepEqual(Object.keys(contract.materialProfiles), [
    "spain-player-material",
    "argentina-player-material",
  ]);
  for (const profile of Object.values(contract.materialProfiles)) {
    assert.equal(profile.geometryId, contract.geometryId);
    assert.equal(profile.topologySha256, contract.topologySha256);
    assert.equal(profile.faces.length, 13);
    assert.equal(profile.faces[2].semanticRole, "left-boot");
    assert.equal(profile.faces[3].semanticRole, "right-boot");
    assert.equal(Object.keys(profile.faces[2].slotsBySelectorOffset).length, 60);
    assert.deepEqual(profile.shirtNumbers.supported,
      Array.from({ length: 15 }, (_, index) => index + 1));
    assert.equal(Object.hasOwn(profile.shirtNumbers, "fallback"), false);
    assert.equal(Object.keys(profile.shirtNumbers.byPlayerNumber).length, 15);
    assert.equal(profile.invariantLeafStyle.width, "32px");
    assert.equal(profile.invariantLeafStyle.height, "64px");
    assert.equal(profile.invariantLeafStyle.backgroundSize, "1088px 858px");
  }
  assert.equal(contract.fixturePlayers.length, 22);
  assert.deepEqual(
    contract.fixturePlayers.map(({ playerNumber }) => playerNumber),
    [...Array.from({ length: 11 }, (_, index) => index + 1),
      ...Array.from({ length: 11 }, (_, index) => index + 1)],
  );
  assert.ok(contract.fixturePlayers.every(({ geometryId, topologySha256, numberBinding }) => (
    geometryId === contract.geometryId
    && topologySha256 === contract.topologySha256
    && numberBinding !== null
  )));
  assert.deepEqual(contract.runtime, {
    geometryMutation: false,
    matrixMutationByMaterial: false,
    atlasConstruction: false,
    missingMaterialPolicy: "reject",
    missingNumberPolicy: "reject",
  });
  assert.equal(prepared.assetFile.expectedSha256, contract.atlas.sha256);
  assert.match(contract.contractSha256, /^[a-f0-9]{64}$/u);
});

test("normalized number entry retains alpha, upright corner order, and transparent gutter", sourceTestOptions, () => {
  const prepared = prepareMaterials();
  const contract = prepared.publication;
  const rgba = decodeFilterZeroRgbaPng(prepared.assetFile.bytes);
  const number = contract.entries.find(({ nativeTextureSlot }) => nativeTextureSlot === 550);
  assert.deepEqual(number.projectedCornerBySourceCorner, [0, 1, 2, 3]);
  assert.deepEqual(number.normalizedCornerOrder, [0, 1, 2, 3]);
  assert.deepEqual(number.orientation.sourceCornerForNormalizedCorner, [0, 1, 2, 3]);
  let transparent = 0;
  let opaque = 0;
  for (let y = 0; y < number.atlasCell.cropHeight; y += 1) {
    for (let x = 0; x < number.atlasCell.cropWidth; x += 1) {
      const alpha = rgba.rgba[
        ((number.atlasCell.cropY + y) * rgba.width + number.atlasCell.cropX + x) * 4 + 3
      ];
      if (alpha === 0) transparent += 1;
      else if (alpha === 255) opaque += 1;
      else assert.fail(`Unexpected normalized number alpha ${alpha}.`);
    }
  }
  assert.ok(transparent > 0);
  assert.ok(opaque > 0);
  for (let x = number.atlasCell.x; x < number.atlasCell.x + number.atlasCell.width; x += 1) {
    const topAlpha = rgba.rgba[(number.atlasCell.y * rgba.width + x) * 4 + 3];
    const bottomAlpha = rgba.rgba[
      ((number.atlasCell.y + number.atlasCell.height - 1) * rgba.width + x) * 4 + 3
    ];
    assert.equal(topAlpha, 0);
    assert.equal(bottomAlpha, 0);
  }
});

test("boot slots preserve the native source RGBA without a presentation override", sourceTestOptions, () => {
  const prepared = prepareMaterials();
  const contract = prepared.publication;
  const atlas = decodeFilterZeroRgbaPng(prepared.assetFile.bytes);
  const boots = contract.entries.filter(({ nativeTextureSlot }) => (
    nativeTextureSlot >= 297 && nativeTextureSlot <= 356
  ));

  assert.deepEqual(contract.source.bootTextures, {
    faceIndexes: [2, 3],
    nativeTextureSlots: [297, 356],
    sourceRgbaPreserved: true,
    presentationOverride: false,
  });
  assert.equal(boots.length, 60);
  assert.ok(boots.every(({ presentation }) => presentation.kind === "source-rgba-nearest"));
  assert.equal(
    contract.entries.find(({ nativeTextureSlot }) => nativeTextureSlot === 296)
      .presentation.kind,
    "source-rgba-nearest",
  );

  let transparent = 0;
  const opaqueColors = new Set();
  for (const entry of boots) {
    for (let y = 0; y < entry.atlasCell.cropHeight; y += 1) {
      for (let x = 0; x < entry.atlasCell.cropWidth; x += 1) {
        const offset = (
          (entry.atlasCell.cropY + y) * atlas.width + entry.atlasCell.cropX + x
        ) * 4;
        const pixel = [...atlas.rgba.subarray(offset, offset + 4)];
        if (pixel[3] === 0) transparent += 1;
        else opaqueColors.add(pixel.slice(0, 3).join(","));
      }
    }
  }
  assert.ok(transparent > 0);
  assert.ok(opaqueColors.size > 1);
  assert.equal(opaqueColors.size === 1 && opaqueColors.has("32,32,32"), false);
});

let cached;
function prepareMaterials() {
  if (cached) return cached;
  const sourceBytes = (file) => readFileSync(new URL(file, sourceRoot));
  const demoBytes = (file) => readFileSync(new URL(file, demoRendererRoot));
  const retailBytes = (file) => readFileSync(new URL(file, retailRendererRoot));
  const animationTable = parseCssoccerAnimationTable({
    dataHBytes: sourceBytes("DATA.H"),
    actionsCppBytes: sourceBytes("ACTIONS.CPP"),
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    threeDEngCBytes: sourceBytes("3DENG.C"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
  });
  const sourceTextures = prepareCssoccerSourceTextureAtlas({
    actRendDatBytes: demoBytes("ACTREND.DAT"),
    actRendOffBytes: demoBytes("ACTREND.OFF"),
    retailActRendDatBytes: retailBytes("ACTREND.DAT"),
    retailActRendOffBytes: retailBytes("ACTREND.OFF"),
    threeDEngObjectBytes: sourceBytes("3DENG.OBJ"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
    footyPalBytes: sourceBytes("FOOTY.PAL"),
  });
  const modelInputs = {
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
  };
  const models = Object.fromEntries(["player_f1", "player_f2"].map((modelId) => [
    modelId,
    prepareExactActuaPlayerModel({ ...modelInputs, modelId }),
  ]));
  cached = prepareCssoccerExactActuaPlayerMaterials({
    animationTable,
    sequences: prepareCssoccerExactActuaPlayerSequences({ animationTable }),
    geometry: prepareCssoccerExactActuaPlayerGeometry({ models }),
    actRendDatBytes: demoBytes("ACTREND.DAT"),
    actRendOffBytes: demoBytes("ACTREND.OFF"),
    retailActRendDatBytes: retailBytes("ACTREND.DAT"),
    retailActRendOffBytes: retailBytes("ACTREND.OFF"),
    sourceAtlasPngBytes: sourceTextures.assetFile.bytes,
  });
  return cached;
}

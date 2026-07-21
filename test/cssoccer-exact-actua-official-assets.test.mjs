import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { parseCssoccerAnimationTable } from
  "../src/prepare/cssoccer/animationTable.mjs";
import { prepareCssoccerSourcePlayerModels } from
  "../src/prepare/cssoccer/actorParser.mjs";
import {
  CSSOCCER_EXACT_ACTUA_OFFICIAL_MATERIALS_SCHEMA,
  prepareCssoccerExactActuaOfficialMaterials,
} from "../src/prepare/cssoccer/exactActuaOfficialMaterials.mjs";
import {
  CSSOCCER_EXACT_ACTUA_OFFICIAL_INDEX_SCHEMA,
  CSSOCCER_EXACT_ACTUA_OFFICIAL_PACKAGING_SCHEMA,
  prepareCssoccerExactActuaOfficialPackaging,
} from "../src/prepare/cssoccer/exactActuaOfficialPackaging.mjs";
import { prepareCssoccerExactActuaOfficialSource } from
  "../src/prepare/cssoccer/exactActuaOfficialSource.mjs";
import {
  CSSOCCER_EXACT_ACTUA_OFFICIAL_VIEWS_SCHEMA,
  prepareCssoccerExactActuaOfficialViews,
} from "../src/prepare/cssoccer/exactActuaOfficialViews.mjs";
import { prepareCssoccerExactActuaPlayerGeometry } from
  "../src/prepare/cssoccer/exactActuaPlayerGeometry.mjs";
import { prepareExactActuaPlayerModel } from
  "../src/prepare/cssoccer/exactActuaPlayerModel.mjs";
import { decodeFilterZeroRgbaPng } from
  "../src/prepare/cssoccer/exactActuaPlayerTextureCodec.mjs";
import { prepareCssoccerSourceTextureAtlas } from
  "../src/prepare/cssoccer/sourceTextureAtlas.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const demoRoot = new URL("../.local/cssoccer/source-assets/actua-demo/extracted/", import.meta.url);
const retailRoot = new URL(
  "../.local/cssoccer/source-assets/actua-retail-1996/extracted/",
  import.meta.url,
);
const required = [
  ...["DATA.H", "ACTIONS.CPP", "DATA.OBJ", "3DENG.C", "3DENG.OBJ", "3D_UPD2.CPP",
    "EUROREND.DAT", "EUROREND.OFF", "FOOTY.PAL"].map((file) => new URL(file, sourceRoot)),
  ...[demoRoot, retailRoot].flatMap((root) => [
    new URL("ACTREND.DAT", root),
    new URL("ACTREND.OFF", root),
  ]),
];
const missing = required.filter((url) => !existsSync(url));
const sourceTestOptions = {
  skip: missing.length > 0 ? "ignored pinned official inputs are unavailable" : false,
  timeout: 240_000,
};

test("prepares exhaustive 12-face official views and five bounded exact chunks", sourceTestOptions, () => {
  const inputs = prepareInputs();
  const views = prepareCssoccerExactActuaOfficialViews(inputs);
  assert.equal(views.schema, CSSOCCER_EXACT_ACTUA_OFFICIAL_VIEWS_SCHEMA);
  assert.equal(views.counts.sequences, 2);
  assert.equal(views.counts.poseOccurrences, 68);
  assert.equal(views.counts.yawBins, 24);
  assert.equal(views.counts.samples, 1_632);
  assert.equal(views.counts.facesPerSample, 12);
  assert.equal(views.counts.faceStates, 19_584);
  assert.equal(
    views.counts.visible + views.counts.nativeHidden + views.counts.preparedDegenerate,
    views.counts.faceStates,
  );
  const chunks = [];
  const packaging = prepareCssoccerExactActuaOfficialPackaging({
    ...inputs,
    onChunk: (chunk) => chunks.push(chunk),
  }).contract;
  assert.equal(packaging.schema, CSSOCCER_EXACT_ACTUA_OFFICIAL_PACKAGING_SCHEMA);
  assert.equal(packaging.index.schema, CSSOCCER_EXACT_ACTUA_OFFICIAL_INDEX_SCHEMA);
  assert.deepEqual(packaging.index.counts, {
    sequences: 2,
    poseOccurrences: 68,
    yawBins: 24,
    samples: 1_632,
    facesPerSample: 12,
    faceStates: 19_584,
    chunks: 5,
  });
  assert.equal(chunks.length, 5);
  assert.deepEqual(packaging.index.sequences.map(({ slotId, frameCount, chunks: entries }) => ({
    slotId,
    frameCount,
    chunks: entries.length,
  })), [
    { slotId: 73, frameCount: 29, chunks: 2 },
    { slotId: 78, frameCount: 39, chunks: 3 },
  ]);
  assert.ok(chunks.every(({ metadata }) => (
    /^assets\/animation\/exact-official\/slot-(073|078)\/frames-\d{3}-\d{3}\.json$/u
      .test(metadata.path)
  )));
  assert.deepEqual(packaging.roundTrip, {
    samples: 1_632,
    faceStates: 19_584,
    status: "exhaustive",
  });
});

test("normalizes both exact official profiles with no missing-material fallback", sourceTestOptions, () => {
  const inputs = prepareInputs();
  const prepared = prepareCssoccerExactActuaOfficialMaterials({
    ...inputs,
    actRendDatBytes: inputs.demoBytes("ACTREND.DAT"),
    actRendOffBytes: inputs.demoBytes("ACTREND.OFF"),
    retailActRendDatBytes: inputs.retailBytes("ACTREND.DAT"),
    retailActRendOffBytes: inputs.retailBytes("ACTREND.OFF"),
    sourceAtlasPngBytes: inputs.sourceTextures.assetFile.bytes,
    officialSourceAtlas: inputs.sourceTextures.officialSourceAtlas,
  });
  const contract = prepared.publication;
  assert.equal(contract.schema, CSSOCCER_EXACT_ACTUA_OFFICIAL_MATERIALS_SCHEMA);
  assert.equal(contract.status, "ready-complete-two-official-profile-normalized-atlas");
  assert.equal(contract.counts.profiles, 2);
  assert.equal(contract.counts.fixtureOfficials, 3);
  assert.equal(contract.counts.faceBindingsPerProfile, 12);
  assert.equal(contract.counts.textureEntries, inputs.officialSource.texture.requiredSlots.length);
  assert.deepEqual(contract.fixtureOfficials.map(({ rootId }) => rootId), [
    "referee-00",
    "assistant-referee-01",
    "assistant-referee-02",
  ]);
  for (const profile of Object.values(contract.materialProfiles)) {
    assert.equal(profile.faces.length, 12);
    assert.equal(profile.shirtNumbers, null);
    assert.equal(Object.hasOwn(profile, "fallback"), false);
    assert.ok(profile.faces.every(({ slotsBySelectorOffset }) => (
      Object.values(slotsBySelectorOffset).every((binding) => binding !== null)
    )));
  }
  assert.deepEqual(contract.runtime, {
    geometryMutation: false,
    matrixMutationByMaterial: false,
    atlasConstruction: false,
    missingMaterialPolicy: "reject",
    missingNumberPolicy: "not-applicable",
  });
  const png = decodeFilterZeroRgbaPng(prepared.assetFile.bytes);
  assert.equal(png.width, contract.atlas.width);
  assert.equal(png.height, contract.atlas.height);
  assert.ok(png.rgba.some((value, index) => index % 4 === 3 && value === 0));
  assert.ok(png.rgba.some((value, index) => index % 4 === 3 && value === 255));
});

test("official preparation is byte deterministic", sourceTestOptions, () => {
  const inputs = prepareInputs();
  const prepare = () => {
    const chunkHashes = [];
    const packaging = prepareCssoccerExactActuaOfficialPackaging({
      ...inputs,
      onChunk: ({ metadata }) => chunkHashes.push(metadata.sha256),
    }).contract;
    const materials = prepareCssoccerExactActuaOfficialMaterials({
      ...inputs,
      actRendDatBytes: inputs.demoBytes("ACTREND.DAT"),
      actRendOffBytes: inputs.demoBytes("ACTREND.OFF"),
      retailActRendDatBytes: inputs.retailBytes("ACTREND.DAT"),
      retailActRendOffBytes: inputs.retailBytes("ACTREND.OFF"),
      sourceAtlasPngBytes: inputs.sourceTextures.assetFile.bytes,
      officialSourceAtlas: inputs.sourceTextures.officialSourceAtlas,
    });
    return {
      index: packaging.index.contractSha256,
      chunks: chunkHashes,
      materials: materials.publication.contractSha256,
      atlas: materials.assetFile.expectedSha256,
    };
  };
  assert.deepEqual(prepare(), prepare());
});

let cached;
function prepareInputs() {
  if (cached) return cached;
  const sourceBytes = (file) => readFileSync(new URL(file, sourceRoot));
  const demoBytes = (file) => readFileSync(new URL(file, demoRoot));
  const retailBytes = (file) => readFileSync(new URL(file, retailRoot));
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
  const playerModels = Object.fromEntries(["player_f1", "player_f2"].map((modelId) => [
    modelId,
    prepareExactActuaPlayerModel({ ...modelInputs, modelId }),
  ]));
  const officialSource = prepareCssoccerExactActuaOfficialSource({
    animationTable,
    playerGeometry: prepareCssoccerExactActuaPlayerGeometry({ models: playerModels }),
    sourcePlayerModelsPreparation: prepareCssoccerSourcePlayerModels({
      dataObjectBytes: sourceBytes("DATA.OBJ"),
    }),
    actRendDatBytes: demoBytes("ACTREND.DAT"),
    actRendOffBytes: demoBytes("ACTREND.OFF"),
    retailActRendDatBytes: retailBytes("ACTREND.DAT"),
    retailActRendOffBytes: retailBytes("ACTREND.OFF"),
    sourceAtlasPngBytes: sourceTextures.assetFile.bytes,
    officialSourceAtlas: sourceTextures.officialSourceAtlas,
    threeDEngCBytes: sourceBytes("3DENG.C"),
    threeDUpd2Bytes: sourceBytes("3D_UPD2.CPP"),
  });
  cached = { animationTable, officialSource, sourceTextures, sourceBytes, demoBytes, retailBytes };
  return cached;
}

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { parseCssoccerAnimationTable } from
  "../src/prepare/cssoccer/animationTable.mjs";
import { prepareCssoccerSourcePlayerModels } from
  "../src/prepare/cssoccer/actorParser.mjs";
import {
  CSSOCCER_EXACT_ACTUA_OFFICIAL_GEOMETRY_ID,
  CSSOCCER_EXACT_ACTUA_OFFICIAL_SOURCE_SCHEMA,
  prepareCssoccerExactActuaOfficialSource,
} from "../src/prepare/cssoccer/exactActuaOfficialSource.mjs";
import { prepareCssoccerExactActuaPlayerGeometry } from
  "../src/prepare/cssoccer/exactActuaPlayerGeometry.mjs";
import { prepareExactActuaPlayerModel } from
  "../src/prepare/cssoccer/exactActuaPlayerModel.mjs";
import { prepareCssoccerSourceTextureAtlas } from
  "../src/prepare/cssoccer/sourceTextureAtlas.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const demoRoot = new URL(
  "../.local/cssoccer/source-assets/actua-demo/extracted/",
  import.meta.url,
);
const retailRoot = new URL(
  "../.local/cssoccer/source-assets/actua-retail-1996/extracted/",
  import.meta.url,
);
const sourceFiles = [
  "DATA.H", "ACTIONS.CPP", "DATA.OBJ", "3DENG.C", "3DENG.OBJ", "3D_UPD2.CPP",
  "EUROREND.DAT", "EUROREND.OFF", "FOOTY.PAL",
];
const rendererFiles = ["ACTREND.DAT", "ACTREND.OFF"];
const missing = [
  ...sourceFiles.filter((file) => !existsSync(new URL(file, sourceRoot))),
  ...rendererFiles.filter((file) => !existsSync(new URL(file, demoRoot))),
  ...rendererFiles.filter((file) => !existsSync(new URL(file, retailRoot))),
];
const sourceTestOptions = {
  skip: missing.length > 0
    ? `ignored pinned source is unavailable: ${missing.join(", ")}`
    : false,
  timeout: 240_000,
};

test("pins exact referee and assistant source geometry, materials, roles, and poses", sourceTestOptions, () => {
  const contract = prepareOfficialSource();
  assert.equal(contract.schema, CSSOCCER_EXACT_ACTUA_OFFICIAL_SOURCE_SCHEMA);
  assert.equal(contract.status, "ready-exact-referee-and-two-assistants");
  assert.equal(contract.geometry.geometryId, CSSOCCER_EXACT_ACTUA_OFFICIAL_GEOMETRY_ID);
  assert.equal(contract.geometry.pointCount, 28);
  assert.equal(contract.geometry.faceCount, 12);
  assert.equal(contract.geometry.leafBasis.stableLeafCount, 12);
  assert.deepEqual(contract.counts, {
    officials: 3,
    sourceModels: 2,
    facesPerOfficial: 12,
    animationSequences: 2,
    poseOccurrences: 68,
    yawBins: 24,
    requiredTextureSlots: contract.texture.requiredSlots.length,
    provenTextureCrops: contract.texture.requiredSlots.length,
  });
  assert.deepEqual(contract.animations.map(({ slotId, frameCount }) => ({ slotId, frameCount })), [
    { slotId: 73, frameCount: 29 },
    { slotId: 78, frameCount: 39 },
  ]);
  assert.deepEqual(contract.lineage.nativeRoleBindings, [
    { nativeRendererIndex: 22, modelId: "player_fr", nativeRenderType: 3 },
    { nativeRendererIndex: 23, modelId: "player_fl", nativeRenderType: 4 },
    { nativeRendererIndex: 24, modelId: "player_fl", nativeRenderType: 4 },
  ]);
  assert.deepEqual(Object.keys(contract.materialProfiles), [
    "actua-referee-material",
    "actua-assistant-referee-material",
  ]);
  for (const profile of Object.values(contract.materialProfiles)) {
    assert.equal(profile.geometryId, contract.geometry.geometryId);
    assert.equal(profile.topologySha256, contract.geometry.topologySha256);
    assert.equal(profile.faces.length, 12);
    assert.deepEqual(profile.faces.map(({ selectorOffsets }) => selectorOffsets.length), [
      12, 12, 49, 53, 5, 7, 5, 7, 2, 6, 2, 6,
    ]);
  }
  assert.deepEqual(contract.texture.nativePages, [0, 3, 4, 5, 13, 14]);
  assert.equal(contract.texture.textureTableRecords, 1_006);
  assert.equal(contract.runtime.missingStatePolicy, "reject");
  assert.match(contract.texture.proofSha256, /^[a-f0-9]{64}$/u);
  assert.match(contract.contractSha256, /^[a-f0-9]{64}$/u);
  assert.ok(Object.isFrozen(contract));
});

let cached;
function prepareOfficialSource() {
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
  cached = prepareCssoccerExactActuaOfficialSource({
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
  return cached;
}

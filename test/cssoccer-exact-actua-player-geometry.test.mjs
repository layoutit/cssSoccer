import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { prepareExactActuaPlayerModel } from
  "../src/prepare/cssoccer/exactActuaPlayerModel.mjs";
import {
  CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_ID,
  CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA,
  exactActuaPlayerGeometryStateKey,
  prepareCssoccerExactActuaPlayerGeometry,
} from "../src/prepare/cssoccer/exactActuaPlayerGeometry.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const requiredFiles = ["DATA.OBJ", "EUROREND.DAT", "EUROREND.OFF"];
const missingFiles = requiredFiles.filter((file) => !existsSync(new URL(file, sourceRoot)));
const sourceTestOptions = {
  skip: missingFiles.length > 0
    ? `ignored pinned source is unavailable: ${missingFiles.join(", ")}`
    : false,
};

test("proves Spain and Argentina use one 28-point/13-face geometry basis", sourceTestOptions, () => {
  const models = prepareModels();
  const contract = prepareCssoccerExactActuaPlayerGeometry({ models });

  assert.equal(contract.schema, CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA);
  assert.equal(contract.geometry.geometryId, CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_ID);
  assert.equal(contract.geometry.pointCount, 28);
  assert.equal(contract.geometry.faceCount, 13);
  assert.equal(contract.geometry.leafBasis.stableLeafCount, 13);
  assert.deepEqual(contract.geometry.faceOrder, Array.from({ length: 13 }, (_, index) => index));
  assert.deepEqual(contract.geometry.stateAddress, {
    fields: ["preparedPoseIndex", "yawIndex"],
    yawCount: 24,
    yawStepDegrees: 15,
    excludedFields: ["team", "country", "modelId", "shirtNumber", "materialProfileId"],
  });
  assert.deepEqual(Object.keys(contract.materialProfiles), [
    "spain-player-material",
    "argentina-player-material",
  ]);
  for (const profile of Object.values(contract.materialProfiles)) {
    assert.equal(profile.geometryId, contract.geometry.geometryId);
    assert.equal(profile.topologySha256, contract.geometry.topologySha256);
    assert.equal(profile.bindings.length, 13);
    assert.equal(profile.bindings[12].selector,
      "prepared-shirt-number-for-team-and-native-player-number");
  }
  assert.deepEqual(contract.differingMaterialFaceIndices, [0, 1, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(exactActuaPlayerGeometryStateKey({ preparedPoseIndex: 0, yawIndex: 0 }), 0);
  assert.equal(exactActuaPlayerGeometryStateKey({ preparedPoseIndex: 5_856, yawIndex: 23 }), 140_567);
  assert.match(contract.geometry.topologySha256, /^[a-f0-9]{64}$/u);
  assert.match(contract.contractSha256, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(
    JSON.stringify({
      faces: contract.geometry.faces,
      leafBasis: contract.geometry.leafBasis,
      topologySha256: contract.geometry.topologySha256,
    }),
    /player_f[12]|spain|argentina|shirtNumber/u,
  );
  assert.ok(Object.isFrozen(contract));
});

test("rejects a second team geometry and keeps material changes geometry-neutral", sourceTestOptions, () => {
  const models = prepareModels();
  const changedMaterialModels = {
    ...models,
    player_f2: {
      ...models.player_f2,
      topology: {
        ...models.player_f2.topology,
        faces: models.player_f2.topology.faces.map((face, faceIndex) => (
          faceIndex === 1 ? { ...face, sourceColorCode: face.sourceColorCode - 1 } : face
        )),
      },
    },
  };
  assert.doesNotThrow(() => prepareCssoccerExactActuaPlayerGeometry({
    models: changedMaterialModels,
  }));

  const changedGeometryModels = {
    ...models,
    player_f2: {
      ...models.player_f2,
      topology: {
        ...models.player_f2.topology,
        faces: models.player_f2.topology.faces.map((face, faceIndex) => (
          faceIndex === 1
            ? { ...face, pointIndexes: [...face.pointIndexes].reverse() }
            : face
        )),
      },
    },
  };
  assert.throws(
    () => prepareCssoccerExactActuaPlayerGeometry({ models: changedGeometryModels }),
    /second exact player geometry table/u,
  );
  assert.throws(
    () => prepareCssoccerExactActuaPlayerGeometry({
      models: { ...models, player_f3: models.player_f2 },
    }),
    /accepts exactly player_f1 and player_f2/u,
  );
});

function prepareModels() {
  const inputs = {
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
  };
  return Object.fromEntries(["player_f1", "player_f2"].map((modelId) => [
    modelId,
    prepareExactActuaPlayerModel({ ...inputs, modelId }),
  ]));
}

function sourceBytes(file) {
  return readFileSync(new URL(file, sourceRoot));
}

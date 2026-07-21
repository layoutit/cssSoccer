import { createHash } from "node:crypto";

import { CSSOCCER_EXACT_ACTUA_PLAYER_MODEL_SCHEMA } from
  "./exactActuaPlayerModel.mjs";

export const CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA =
  "cssoccer-exact-actua-player-geometry@1";

export const CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_ID =
  "actua-player-28p-13f-one-basis";

const MODEL_IDS = Object.freeze(["player_f1", "player_f2"]);
const MATERIAL_PROFILE_BY_MODEL = Object.freeze({
  player_f1: Object.freeze({ id: "spain-player-material", country: "spain" }),
  player_f2: Object.freeze({ id: "argentina-player-material", country: "argentina" }),
});
const FACE_ROLES = Object.freeze([
  "head",
  "shirt-body",
  "left-boot",
  "right-boot",
  "left-shirt-sleeve",
  "left-lower-arm",
  "right-shirt-sleeve",
  "right-lower-arm",
  "left-shorts-thigh",
  "left-lower-leg",
  "right-shorts-thigh",
  "right-lower-leg",
  "shirt-number-panel",
]);

/**
 * Prove that player_f1/player_f2 are material profiles over one ordered source
 * geometry. The returned contract deliberately contains one geometry table.
 */
export function prepareCssoccerExactActuaPlayerGeometry({ models } = {}) {
  assertModels(models);
  const canonicalModel = models.player_f1;
  const geometryFaces = canonicalModel.topology.faces.map((face, faceIndex) => (
    normalizeGeometryFace(face, faceIndex)
  ));
  const topologyCore = {
    geometryId: CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_ID,
    pointCount: canonicalModel.topology.pointCount,
    faceCount: geometryFaces.length,
    faceOrder: geometryFaces.map(({ faceIndex }) => faceIndex),
    faces: geometryFaces,
    leafBasis: {
      tagName: "s",
      stableLeafCount: geometryFaces.length,
      stableLeafOrder: "source face index 0..12",
      canonicalCoordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
      transformOrigin: "0 0",
      runtimeNodeCreation: false,
      runtimeGeometryConstruction: false,
    },
  };
  const topologySha256 = sha256(Buffer.from(canonicalJson(topologyCore)));

  for (const modelId of MODEL_IDS) {
    const candidate = models[modelId];
    const candidateFaces = candidate.topology.faces.map((face, faceIndex) => (
      normalizeGeometryFace(face, faceIndex)
    ));
    if (canonicalJson(candidateFaces) !== canonicalJson(geometryFaces)) {
      throw new Error(`${modelId} introduces a second exact player geometry table.`);
    }
  }

  const materialProfiles = Object.fromEntries(MODEL_IDS.map((modelId) => {
    const profile = MATERIAL_PROFILE_BY_MODEL[modelId];
    const bindings = models[modelId].topology.faces.map((face, faceIndex) => ({
      faceIndex,
      semanticRole: FACE_ROLES[faceIndex],
      sourceColorCode: face.sourceColorCode,
      selector: faceIndex === 12
        ? "prepared-shirt-number-for-team-and-native-player-number"
        : "prepared-native-texture-slot-from-source-color-code",
    }));
    return [profile.id, {
      ...profile,
      sourceModelSymbol: modelId,
      geometryId: CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_ID,
      topologySha256,
      bindings,
    }];
  }));
  const differingMaterialFaceIndices = geometryFaces
    .map(({ faceIndex }) => faceIndex)
    .filter((faceIndex) => (
      models.player_f1.topology.faces[faceIndex].sourceColorCode
      !== models.player_f2.topology.faces[faceIndex].sourceColorCode
    ));
  const core = {
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA,
    status: "ready-one-geometry-two-material-profiles",
    geometry: {
      ...topologyCore,
      topologySha256,
      stateAddress: {
        fields: ["preparedPoseIndex", "yawIndex"],
        yawCount: 24,
        yawStepDegrees: 15,
        excludedFields: ["team", "country", "modelId", "shirtNumber", "materialProfileId"],
      },
    },
    materialProfiles,
    materialProfileBySourceModel: {
      player_f1: MATERIAL_PROFILE_BY_MODEL.player_f1.id,
      player_f2: MATERIAL_PROFILE_BY_MODEL.player_f2.id,
    },
    differingMaterialFaceIndices,
    lineage: {
      sourceRevision: canonicalModel.lineage.sourceRevision,
      dataObjectSha256: canonicalModel.lineage.dataObject.sha256,
      sourceModelSymbols: [...MODEL_IDS],
      sourceTopologySha256ByModel: Object.fromEntries(MODEL_IDS.map((modelId) => [
        modelId,
        models[modelId].topology.sourceBytesSha256,
      ])),
      proof: "primitive, dispatch, point indexes, primitive parameters, and face order are identical; source color codes are material bindings",
    },
  };
  return deepFreeze({
    ...core,
    contractSha256: sha256(Buffer.from(canonicalJson(core))),
  });
}

export function exactActuaPlayerGeometryStateKey({ preparedPoseIndex, yawIndex } = {}) {
  if (!Number.isSafeInteger(preparedPoseIndex) || preparedPoseIndex < 0 || preparedPoseIndex >= 5_857) {
    throw new RangeError("Exact Actua preparedPoseIndex must be inside 0..5856.");
  }
  if (!Number.isSafeInteger(yawIndex) || yawIndex < 0 || yawIndex >= 24) {
    throw new RangeError("Exact Actua yawIndex must be inside 0..23.");
  }
  return preparedPoseIndex * 24 + yawIndex;
}

function normalizeGeometryFace(face, faceIndex) {
  if (
    face?.faceIndex !== faceIndex
    || !Number.isSafeInteger(face.primitiveCode)
    || !Array.isArray(face.pointIndexes)
    || !Array.isArray(face.payload)
    || face.pointIndexes.length > face.payload.length
    || FACE_ROLES[faceIndex] === undefined
  ) throw new Error(`Exact player geometry face ${faceIndex} is invalid.`);
  const parameters = face.payload.slice(face.pointIndexes.length);
  return {
    faceIndex,
    leafId: `actua-player-face-${String(faceIndex).padStart(2, "0")}`,
    semanticRole: FACE_ROLES[faceIndex],
    primitiveCode: face.primitiveCode,
    dispatch: face.dispatch,
    pointIndexes: [...face.pointIndexes],
    primitiveParameters: parameters,
  };
}

function assertModels(models) {
  if (!models || typeof models !== "object" || Array.isArray(models)) {
    throw new TypeError("Exact Actua geometry preparation requires player_f1 and player_f2 models.");
  }
  const keys = Object.keys(models).sort();
  if (keys.join(",") !== [...MODEL_IDS].sort().join(",")) {
    throw new Error("Exact Actua geometry preparation accepts exactly player_f1 and player_f2.");
  }
  for (const modelId of MODEL_IDS) {
    const model = models[modelId];
    if (
      model?.schema !== CSSOCCER_EXACT_ACTUA_PLAYER_MODEL_SCHEMA
      || model.id !== modelId
      || model.topology?.pointCount !== 28
      || model.topology?.faceCount !== 13
      || model.topology.faces?.length !== 13
    ) throw new Error(`${modelId} is not the pinned exact 28-point/13-face model.`);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

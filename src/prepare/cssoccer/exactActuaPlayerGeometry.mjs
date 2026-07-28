import { createHash } from "node:crypto";

import { CSSOCCER_EXACT_ACTUA_PLAYER_MODEL_SCHEMA } from
  "./exactActuaPlayerModel.mjs";

export const CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA =
  "cssoccer-exact-actua-player-geometry@1";

export const CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_ID =
  "actua-player-28p-13f-one-basis";
export const CSSOCCER_EXACT_ACTUA_GOALKEEPER_GEOMETRY_ID =
  "actua-goalkeeper-28p-13f-one-basis";

const MODEL_IDS = Object.freeze([
  "player_f1",
  "player_f2",
  "player_fg1",
  "player_fg2",
]);
const GEOMETRY_VARIANTS = Object.freeze({
  outfield: Object.freeze({
    id: CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_ID,
    modelIds: Object.freeze(["player_f1", "player_f2"]),
  }),
  goalkeeper: Object.freeze({
    id: CSSOCCER_EXACT_ACTUA_GOALKEEPER_GEOMETRY_ID,
    modelIds: Object.freeze(["player_fg1", "player_fg2"]),
  }),
});
const MATERIAL_PROFILE_BY_MODEL = Object.freeze({
  player_f1: Object.freeze({
    id: "spain-player-material",
    country: "spain",
    geometryVariant: "outfield",
  }),
  player_f2: Object.freeze({
    id: "argentina-player-material",
    country: "argentina",
    geometryVariant: "outfield",
  }),
  player_fg1: Object.freeze({
    id: "spain-goalkeeper-material",
    country: "spain",
    geometryVariant: "goalkeeper",
  }),
  player_fg2: Object.freeze({
    id: "argentina-goalkeeper-material",
    country: "argentina",
    geometryVariant: "goalkeeper",
  }),
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
 * Prove the native outfield and goalkeeper geometry/material pairs. Each team
 * shares its role geometry with the opponent but keeps its own source colors.
 */
export function prepareCssoccerExactActuaPlayerGeometry({ models } = {}) {
  assertModels(models);
  const geometryVariants = Object.fromEntries(
    Object.entries(GEOMETRY_VARIANTS).map(([variantId, variant]) => {
      const canonicalModel = models[variant.modelIds[0]];
      const topology = prepareGeometryVariant({
        geometryId: variant.id,
        canonicalModel,
      });
      for (const modelId of variant.modelIds) {
        const candidateFaces = models[modelId].topology.faces.map(
          (face, faceIndex) => normalizeGeometryFace(face, faceIndex),
        );
        if (canonicalJson(candidateFaces) !== canonicalJson(topology.faces)) {
          throw new Error(
            `${modelId} does not share the exact ${variantId} geometry table.`,
          );
        }
      }
      return [variantId, topology];
    }),
  );
  if (
    geometryVariants.outfield.topologySha256
    === geometryVariants.goalkeeper.topologySha256
  ) {
    throw new Error("Native outfield and goalkeeper geometry unexpectedly collapsed.");
  }

  const materialProfiles = Object.fromEntries(MODEL_IDS.map((modelId) => {
    const profile = MATERIAL_PROFILE_BY_MODEL[modelId];
    const topology = geometryVariants[profile.geometryVariant];
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
      geometryId: topology.geometryId,
      topologySha256: topology.topologySha256,
      bindings,
    }];
  }));
  const differingMaterialFaceIndicesByVariant = Object.fromEntries(
    Object.entries(GEOMETRY_VARIANTS).map(([variantId, variant]) => {
      const [leftModelId, rightModelId] = variant.modelIds;
      return [
        variantId,
        geometryVariants[variantId].faces
          .map(({ faceIndex }) => faceIndex)
          .filter((faceIndex) => (
            models[leftModelId].topology.faces[faceIndex].sourceColorCode
            !== models[rightModelId].topology.faces[faceIndex].sourceColorCode
          )),
      ];
    }),
  );
  const canonicalModel = models.player_f1;
  const core = {
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA,
    status: "ready-two-native-geometries-four-material-profiles",
    // Keep the existing outfield field as the package compatibility surface
    // while variant-aware consumers move to geometryVariants.
    geometry: geometryVariants.outfield,
    geometryVariants,
    materialProfiles,
    materialProfileBySourceModel: Object.fromEntries(MODEL_IDS.map((modelId) => [
      modelId,
      MATERIAL_PROFILE_BY_MODEL[modelId].id,
    ])),
    differingMaterialFaceIndices:
      differingMaterialFaceIndicesByVariant.outfield,
    differingMaterialFaceIndicesByVariant,
    lineage: {
      sourceRevision: canonicalModel.lineage.sourceRevision,
      dataObjectSha256: canonicalModel.lineage.dataObject.sha256,
      sourceModelSymbols: [...MODEL_IDS],
      sourceTopologySha256ByModel: Object.fromEntries(MODEL_IDS.map((modelId) => [
        modelId,
        models[modelId].topology.sourceBytesSha256,
      ])),
      proof:
        "outfield opponents share one topology; goalkeeper opponents share a second wider native topology; source color codes remain material bindings",
    },
  };
  return deepFreeze({
    ...core,
    contractSha256: sha256(Buffer.from(canonicalJson(core))),
  });
}

function prepareGeometryVariant({ geometryId, canonicalModel }) {
  const faces = canonicalModel.topology.faces.map((face, faceIndex) => (
    normalizeGeometryFace(face, faceIndex)
  ));
  const core = {
    geometryId,
    pointCount: canonicalModel.topology.pointCount,
    faceCount: faces.length,
    faceOrder: faces.map(({ faceIndex }) => faceIndex),
    faces,
    stateAddress: {
      fields: ["preparedPoseIndex", "yawIndex"],
      yawCount: 24,
      yawStepDegrees: 15,
      excludedFields: [
        "team",
        "country",
        "modelId",
        "shirtNumber",
        "materialProfileId",
      ],
    },
    leafBasis: {
      tagName: "s",
      stableLeafCount: faces.length,
      stableLeafOrder: "source face index 0..12",
      canonicalCoordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
      transformOrigin: "0 0",
      runtimeNodeCreation: false,
      runtimeGeometryConstruction: false,
    },
  };
  return {
    ...core,
    topologySha256: sha256(Buffer.from(canonicalJson(core))),
  };
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
    throw new TypeError(
      "Exact Actua geometry preparation requires outfield and goalkeeper models.",
    );
  }
  const keys = Object.keys(models).sort();
  if (keys.join(",") !== [...MODEL_IDS].sort().join(",")) {
    throw new Error(
      "Exact Actua geometry preparation accepts exactly f1/f2/fg1/fg2.",
    );
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

import { createHash } from "node:crypto";

import { CSSOCCER_ANIMATION_TABLE_SCHEMA } from "./animationTable.mjs";
import {
  CSSOCCER_EXACT_ACTUA_OFFICIAL_SOURCE_SCHEMA,
  resolveCssoccerExactActuaOfficialFrames,
} from "./exactActuaOfficialSource.mjs";
import {
  CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX,
  CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER,
  CSSOCCER_EXACT_ACTUA_PLAYER_RASTER_COVERAGE,
  prepareCssoccerExactActuaActorViewSample,
} from "./exactActuaPlayerViews.mjs";

export const CSSOCCER_EXACT_ACTUA_OFFICIAL_VIEWS_SCHEMA =
  "cssoccer-exact-actua-official-views@1";

const FACE_COUNT = 12;
const SEQUENCE_COUNT = 11;
const POSE_COUNT = 312;
const YAW_COUNT = 24;
const SAMPLE_COUNT = POSE_COUNT * YAW_COUNT;
const FACE_STATE_COUNT = SAMPLE_COUNT * FACE_COUNT;

export function prepareCssoccerExactActuaOfficialViews({
  animationTable,
  officialSource,
  onSample = null,
} = {}) {
  const context = prepareContext({ animationTable, officialSource });
  if (onSample !== null && typeof onSample !== "function") {
    throw new TypeError("Exact official view onSample must be a function.");
  }
  const digest = createHash("sha256");
  const classifications = { visible: 0, nativeHidden: 0, preparedDegenerate: 0 };
  let samples = 0;
  let faceStates = 0;
  for (const sample of iterateSamples(context)) {
    if (sample.sampleIndex !== samples) throw new Error("Exact official samples are not contiguous.");
    for (const face of sample.faces) {
      faceStates += 1;
      if (face.visibility === "visible") classifications.visible += 1;
      else if (face.visibility === "native-hidden") classifications.nativeHidden += 1;
      else classifications.preparedDegenerate += 1;
    }
    digest.update(JSON.stringify(sample));
    digest.update("\n");
    if (onSample) onSample(sample);
    samples += 1;
  }
  if (samples !== SAMPLE_COUNT || faceStates !== FACE_STATE_COUNT) {
    throw new Error("Exact official pose/view domain count changed.");
  }
  const core = {
    schema: CSSOCCER_EXACT_ACTUA_OFFICIAL_VIEWS_SCHEMA,
    status: "ready-complete-official-pose-view-domain",
    geometryId: officialSource.geometry.geometryId,
    topologySha256: officialSource.geometry.topologySha256,
    officialSourceContractSha256: officialSource.contractSha256,
    counts: {
      sequences: SEQUENCE_COUNT,
      poseOccurrences: POSE_COUNT,
      yawBins: YAW_COUNT,
      samples,
      facesPerSample: FACE_COUNT,
      faceStates,
      ...classifications,
    },
    yaw: { indexes: Array.from({ length: YAW_COUNT }, (_, index) => index), stepDegrees: 15 },
    leafState: {
      raster: CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER,
      nativeRasterCoverage: CSSOCCER_EXACT_ACTUA_PLAYER_RASTER_COVERAGE,
      hiddenMatrix: CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX,
      preformattedTransform: true,
      runtimeProjection: false,
      runtimeHomography: false,
      runtimeMatrixFormatting: false,
    },
    exhaustiveStateSha256: digest.digest("hex"),
  };
  return deepFreeze({
    ...core,
    contractSha256: sha256(Buffer.from(canonicalJson(core))),
  });
}

export function* iterateCssoccerExactActuaOfficialViews({
  animationTable,
  officialSource,
} = {}) {
  yield* iterateSamples(prepareContext({ animationTable, officialSource }));
}

function* iterateSamples(context) {
  let preparedPoseIndex = 0;
  let sampleIndex = 0;
  for (const [sequenceIndex, animation] of context.officialSource.animations.entries()) {
    const frames = resolveCssoccerExactActuaOfficialFrames(
      context.animationTable,
      animation.slotId,
    );
    for (let localFrameIndex = 0; localFrameIndex < animation.frameCount; localFrameIndex += 1) {
      const frame = frames[localFrameIndex];
      if (frame?.exactFloat32PoseSha256 !== animation.frameSha256[localFrameIndex]) {
        throw new Error(`Exact official slot ${animation.slotId} frame ${localFrameIndex} changed.`);
      }
      for (let yawIndex = 0; yawIndex < YAW_COUNT; yawIndex += 1) {
        yield prepareCssoccerExactActuaActorViewSample({
          topology: context.topology,
          coordinates: frame.coordinates,
          sampleIndex,
          preparedPoseIndex,
          sequenceIndex,
          slotId: animation.slotId,
          localFrameIndex,
          yawIndex,
          expectedPoseSha256: frame.exactFloat32PoseSha256,
        });
        sampleIndex += 1;
      }
      preparedPoseIndex += 1;
    }
  }
  if (preparedPoseIndex !== POSE_COUNT || sampleIndex !== SAMPLE_COUNT) {
    throw new Error("Exact official iterator coverage changed.");
  }
}

function prepareContext({ animationTable, officialSource }) {
  if (
    animationTable?.schema !== CSSOCCER_ANIMATION_TABLE_SCHEMA
    || animationTable.slots?.length !== 132
  ) throw new Error("Exact official views require the complete animation table.");
  if (
    officialSource?.schema !== CSSOCCER_EXACT_ACTUA_OFFICIAL_SOURCE_SCHEMA
    || officialSource.status !== "ready-exact-referee-and-two-assistants"
    || officialSource.geometry?.pointCount !== 28
    || officialSource.geometry?.faceCount !== FACE_COUNT
    || officialSource.animations?.length !== SEQUENCE_COUNT
    || officialSource.counts?.poseOccurrences !== POSE_COUNT
  ) throw new Error("Exact official views require the complete source contract.");
  const topology = {
    pointCount: officialSource.geometry.pointCount,
    faceCount: officialSource.geometry.faceCount,
    faces: officialSource.geometry.faces.map((face) => ({
      faceIndex: face.faceIndex,
      primitiveCode: face.primitiveCode,
      dispatch: face.dispatch,
      pointIndexes: [...face.pointIndexes],
      payload: [...face.pointIndexes, ...face.primitiveParameters],
    })),
  };
  return { animationTable, officialSource, topology };
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

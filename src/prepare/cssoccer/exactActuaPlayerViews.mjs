import { createHash } from "node:crypto";

import { projectExactActuaPlayerCoordinates } from
  "./actuaNativeProjection.mjs";
import { CSSOCCER_ANIMATION_TABLE_SCHEMA } from "./animationTable.mjs";
import { CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA } from
  "./exactActuaPlayerGeometry.mjs";
import { CSSOCCER_EXACT_ACTUA_PLAYER_SEQUENCES_SCHEMA } from
  "./exactActuaPlayerSequences.mjs";

export const CSSOCCER_EXACT_ACTUA_PLAYER_VIEWS_SCHEMA =
  "cssoccer-exact-actua-player-views@1";

export const CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX =
  "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,-10000,1)";

const EXPECTED_POSES = 5_857;
const YAW_COUNT = 24;
const FACE_COUNT = 13;
const EXPECTED_SAMPLES = EXPECTED_POSES * YAW_COUNT;
const EXPECTED_FACE_STATES = EXPECTED_SAMPLES * FACE_COUNT;
const PROJECTIVE_W_EPSILON = 1e-9;

export const CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER = deepFreeze({
  schema: "cssoccer-exact-actua-player-leaf-raster@1",
  width: 32,
  height: 64,
  sourceCoordinates: [[0, 0], [32, 0], [32, 64], [0, 64]],
});

// The retained native/browser calibration has identical vertical coverage,
// while the native inclusive scan conversion covers one more pixel at the
// right edge. Apply this once while preparing matrices, never in the browser.
export const CSSOCCER_EXACT_ACTUA_PLAYER_RASTER_COVERAGE = deepFreeze({
  schema: "cssoccer-exact-actua-player-raster-coverage@1",
  method: "native-inclusive-right-edge",
  calibrationFrameCount: 39,
  horizontalRightEdgePixels: 1,
  verticalEdgePixels: 0,
});

/**
 * Exhaustively prepare and validate the one-basis pose/view domain without
 * retaining its verbose proof objects in memory. A caller may stream each
 * checked sample to a packaging experiment through onSample.
 */
export function prepareCssoccerExactActuaPlayerViews({
  animationTable,
  sequences,
  geometry,
  onSample = null,
} = {}) {
  const context = prepareContext({ animationTable, sequences, geometry });
  if (onSample !== null && typeof onSample !== "function") {
    throw new TypeError("Exact Actua view onSample must be a function.");
  }
  const digest = createHash("sha256");
  const classifications = {
    visible: 0,
    nativeHidden: 0,
    preparedDegenerate: 0,
  };
  const degenerateReasons = Object.create(null);
  const degenerateExamples = [];
  let sampleCount = 0;
  let faceStateCount = 0;
  for (const sample of iteratePreparedSamples(context)) {
    if (sample.sampleIndex !== sampleCount) {
      throw new Error(`Exact Actua view sample ${sampleCount} is not contiguous.`);
    }
    for (const face of sample.faces) {
      faceStateCount += 1;
      if (face.visibility === "visible") classifications.visible += 1;
      else if (face.visibility === "native-hidden") classifications.nativeHidden += 1;
      else {
        classifications.preparedDegenerate += 1;
        degenerateReasons[face.degenerateReason] =
          (degenerateReasons[face.degenerateReason] ?? 0) + 1;
        if (degenerateExamples.length < 32) {
          degenerateExamples.push({
            sampleIndex: sample.sampleIndex,
            preparedPoseIndex: sample.preparedPoseIndex,
            slotId: sample.slotId,
            localFrameIndex: sample.localFrameIndex,
            yawIndex: sample.yawIndex,
            faceIndex: face.faceIndex,
            reason: face.degenerateReason,
            projectedCorners: face.projectedCorners,
            projectiveW: face.projectiveW,
          });
        }
      }
    }
    digest.update(JSON.stringify(sample));
    digest.update("\n");
    if (onSample) onSample(sample);
    sampleCount += 1;
  }
  if (sampleCount !== EXPECTED_SAMPLES || faceStateCount !== EXPECTED_FACE_STATES) {
    throw new Error("Exact Actua one-basis view domain count changed.");
  }
  const core = {
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_VIEWS_SCHEMA,
    status: "ready-complete-one-basis-pose-view-domain",
    geometryId: geometry.geometry.geometryId,
    topologySha256: geometry.geometry.topologySha256,
    sequenceContractSha256: sequences.contractSha256,
    counts: {
      sequences: sequences.counts.sequences,
      poseOccurrences: EXPECTED_POSES,
      yawBins: YAW_COUNT,
      samples: sampleCount,
      facesPerSample: FACE_COUNT,
      faceStates: faceStateCount,
      ...classifications,
    },
    yaw: {
      indexes: Array.from({ length: YAW_COUNT }, (_, index) => index),
      stepDegrees: 15,
      wrapDegrees: 360,
    },
    leafState: {
      canonicalCoordinates: CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.sourceCoordinates,
      raster: CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER,
      nativeRasterCoverage: CSSOCCER_EXACT_ACTUA_PLAYER_RASTER_COVERAGE,
      transformOrigin: "0 0",
      preformattedTransform: true,
      hiddenMatrix: CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX,
      allowedRuntimeOperations: [
        "integer state lookup",
        "unchanged-state comparison",
        "preformatted style assignment",
      ],
      runtimeProjection: false,
      runtimeHomography: false,
      runtimeMatrixFormatting: false,
    },
    classification: {
      nativeHidden: "native facing/depth cull",
      preparedDegenerate: "native visible quad has no finite single-CSS-leaf homography",
      reasons: { ...degenerateReasons },
      examples: degenerateExamples,
    },
    exhaustiveStateSha256: digest.digest("hex"),
  };
  return deepFreeze({
    ...core,
    contractSha256: sha256(Buffer.from(canonicalJson(core))),
  });
}

export function* iterateCssoccerExactActuaPlayerViews({
  animationTable,
  sequences,
  geometry,
} = {}) {
  yield* iteratePreparedSamples(prepareContext({ animationTable, sequences, geometry }));
}

export function prepareCssoccerExactActuaPlayerViewSample({
  animationTable,
  sequences,
  geometry,
  preparedPoseIndex,
  yawIndex,
} = {}) {
  const context = prepareContext({ animationTable, sequences, geometry });
  if (!Number.isSafeInteger(preparedPoseIndex)
      || preparedPoseIndex < 0
      || preparedPoseIndex >= EXPECTED_POSES) {
    throw new RangeError("Exact Actua prepared pose must be inside 0..5856.");
  }
  if (!Number.isSafeInteger(yawIndex) || yawIndex < 0 || yawIndex >= YAW_COUNT) {
    throw new RangeError("Exact Actua yaw index must be inside 0..23.");
  }
  return prepareSample(context, preparedPoseIndex, yawIndex);
}

function* iteratePreparedSamples(context) {
  for (let preparedPoseIndex = 0; preparedPoseIndex < EXPECTED_POSES; preparedPoseIndex += 1) {
    for (let yawIndex = 0; yawIndex < YAW_COUNT; yawIndex += 1) {
      yield prepareSample(context, preparedPoseIndex, yawIndex);
    }
  }
}

function prepareSample(context, preparedPoseIndex, yawIndex) {
  const frameAddress = context.sequences.frameByPreparedIndex[preparedPoseIndex];
  const sequence = context.sequences.sequences.find(
    ({ slotId }) => slotId === frameAddress.slotId,
  );
  const sourceSlot = context.animationTable.slots[frameAddress.sourceSlotId];
  const sourceFrame = sourceSlot?.posePayload?.frames?.[frameAddress.localFrameIndex];
  if (sourceFrame?.sha256 !== frameAddress.sourceFrameSha256) {
    throw new Error(`Exact Actua prepared pose ${preparedPoseIndex} lost its source frame.`);
  }
  const mirrored = sequence.lineage.mode === "source-mirror-z";
  const coordinates = mirrored
    ? sourceFrame.coordinates.map((value, index) => index % 3 === 2 ? -value : value)
    : sourceFrame.coordinates;
  const materializedSha256 = exactPoseSha256(coordinates);
  if (materializedSha256 !== frameAddress.exactFloat32PoseSha256) {
    throw new Error(`Exact Actua prepared pose ${preparedPoseIndex} changed float32 bits.`);
  }
  return prepareCssoccerExactActuaActorViewSample({
    topology: context.projectionTopology,
    coordinates,
    sampleIndex: preparedPoseIndex * YAW_COUNT + yawIndex,
    preparedPoseIndex,
    sequenceIndex: sequence.sequenceIndex,
    slotId: sequence.slotId,
    localFrameIndex: frameAddress.localFrameIndex,
    yawIndex,
    expectedPoseSha256: materializedSha256,
  });
}

/** Prepare one checked 28-point actor pose/view using the shared native projection seam. */
export function prepareCssoccerExactActuaActorViewSample({
  topology,
  coordinates,
  sampleIndex,
  preparedPoseIndex,
  sequenceIndex,
  slotId,
  localFrameIndex,
  yawIndex,
  expectedPoseSha256,
} = {}) {
  if (!Number.isSafeInteger(yawIndex) || yawIndex < 0 || yawIndex >= YAW_COUNT) {
    throw new RangeError("Exact Actua actor yaw index must be inside 0..23.");
  }
  const materializedSha256 = exactPoseSha256(coordinates);
  if (materializedSha256 !== expectedPoseSha256) {
    throw new Error(`Exact Actua actor pose ${preparedPoseIndex} changed float32 bits.`);
  }
  const yawDegrees = yawIndex * 15;
  const projected = projectExactActuaPlayerCoordinates({
    topology,
    coordinates,
    preparedPoseIndex,
    yawDegrees,
    sourcePoseBitsSha256: materializedSha256,
  });
  const rasterCoverage = prepareNativeRasterCoverage(projected.faces);
  const faces = projected.faces.map((face) => prepareFaceState(face, rasterCoverage));
  return deepFreeze({
    sampleIndex,
    preparedPoseIndex,
    sequenceIndex,
    slotId,
    localFrameIndex,
    yawIndex,
    yawDegrees,
    exactFloat32PoseSha256: materializedSha256,
    faces,
  });
}

function prepareFaceState(face, rasterCoverage) {
  if (!face.visible) {
    return {
      faceIndex: face.faceIndex,
      visibility: "native-hidden",
      transform: CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX,
      materialSelectorOffset: null,
      depthBits: null,
      drawOrder: null,
      degenerateReason: null,
      projectedCorners: [],
      projectiveW: null,
    };
  }
  const rasterCorners = face.projectedCorners.map(
    (point) => applyNativeRasterCoverage(point, rasterCoverage),
  );
  const matrix = leafRasterQuadMatrix(rasterCorners, -face.depth);
  if (matrix.status === "degenerate") {
    return {
      faceIndex: face.faceIndex,
      visibility: "prepared-degenerate",
      transform: CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX,
      materialSelectorOffset: face.materialSelectorOffset,
      depthBits: face.depthBits,
      drawOrder: face.drawOrder,
      degenerateReason: matrix.reason,
      projectedCorners: face.projectedCorners,
      projectiveW: matrix.projectiveW,
    };
  }
  assertMatrixMapsUnitQuad(
    matrix.transform,
    rasterCorners,
    -face.depth,
    face.faceIndex,
  );
  return {
    faceIndex: face.faceIndex,
    visibility: "visible",
    transform: matrix.transform,
    materialSelectorOffset: face.materialSelectorOffset,
    depthBits: face.depthBits,
    drawOrder: face.drawOrder,
    degenerateReason: null,
    projectedCorners: face.projectedCorners,
    projectiveW: matrix.projectiveW,
  };
}

function leafRasterQuadMatrix(destination, cssDepth) {
  if (!Array.isArray(destination)
      || destination.length !== 4
      || destination.some((point) => (
        !Array.isArray(point) || point.length !== 2 || point.some((value) => !Number.isFinite(value))
      ))) return { status: "degenerate", reason: "invalid-native-corners", projectiveW: null };
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = destination;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  if (dx3 !== 0 || dy3 !== 0) {
    const denominator = dx1 * dy2 - dx2 * dy1;
    if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
      return { status: "degenerate", reason: "singular-native-quad", projectiveW: null };
    }
    g = (dx3 * dy2 - dx2 * dy3) / denominator;
    h = (dx1 * dy3 - dx3 * dy1) / denominator;
  }
  const projectiveW = [1, 1 + g, 1 + g + h, 1 + h];
  if (projectiveW.some((value) => !Number.isFinite(value) || value <= PROJECTIVE_W_EPSILON)) {
    return {
      status: "degenerate",
      reason: "projective-pole-in-leaf",
      projectiveW,
    };
  }
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const f = y0;
  const values = [
    a / CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.width,
    d / CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.width,
    cssDepth * g / CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.width,
    g / CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.width,
    b / CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.height,
    e / CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.height,
    cssDepth * h / CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.height,
    h / CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.height,
    0, 0, 1, 0,
    c, f, cssDepth, 1,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    return { status: "degenerate", reason: "non-finite-css-matrix", projectiveW };
  }
  return {
    status: "visible",
    transform: `matrix3d(${values.map(formatNumber).join(",")})`,
    projectiveW,
  };
}

function assertMatrixMapsUnitQuad(matrix, expected, expectedDepth, faceIndex) {
  const values = matrix.slice("matrix3d(".length, -1).split(",").map(Number);
  const source = CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.sourceCoordinates;
  source.forEach(([x, y], index) => {
    const w = values[3] * x + values[7] * y + values[15];
    const projectedX = (values[0] * x + values[4] * y + values[12]) / w;
    const projectedY = (values[1] * x + values[5] * y + values[13]) / w;
    const projectedZ = (values[2] * x + values[6] * y + values[14]) / w;
    if (
      Math.abs(projectedX - expected[index][0]) > 1e-7
      || Math.abs(projectedY - expected[index][1]) > 1e-7
      || Math.abs(projectedZ - expectedDepth) > 1e-7
    ) throw new Error(`Exact Actua face ${faceIndex} matrix failed its native-corner proof.`);
  });
}

function prepareNativeRasterCoverage(faces) {
  const projectedX = faces
    .filter(({ visible }) => visible)
    .flatMap(({ projectedCorners }) => projectedCorners.map(([x]) => x));
  const sourceMinX = Math.min(...projectedX);
  const sourceMaxX = Math.max(...projectedX);
  const sourceSpanX = sourceMaxX - sourceMinX;
  if (!Number.isFinite(sourceSpanX) || sourceSpanX <= 0) {
    throw new Error("Exact Actua player sample lacks a finite horizontal raster span.");
  }
  return {
    sourceMinX,
    scaleX: (
      sourceSpanX
      + CSSOCCER_EXACT_ACTUA_PLAYER_RASTER_COVERAGE.horizontalRightEdgePixels
    ) / sourceSpanX,
  };
}

function applyNativeRasterCoverage([x, y], coverage) {
  return [coverage.sourceMinX + (x - coverage.sourceMinX) * coverage.scaleX, y];
}

function prepareContext({ animationTable, sequences, geometry }) {
  if (
    animationTable?.schema !== CSSOCCER_ANIMATION_TABLE_SCHEMA
    || animationTable.slots?.length !== 132
  ) throw new Error("Exact Actua views require the complete animation table.");
  if (
    sequences?.schema !== CSSOCCER_EXACT_ACTUA_PLAYER_SEQUENCES_SCHEMA
    || sequences.counts?.sequences !== 124
    || sequences.counts?.poseOccurrences !== EXPECTED_POSES
    || sequences.frameByPreparedIndex?.length !== EXPECTED_POSES
  ) throw new Error("Exact Actua views require the complete sequence contract.");
  if (
    geometry?.schema !== CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA
    || geometry.geometry?.pointCount !== 28
    || geometry.geometry?.faceCount !== FACE_COUNT
    || geometry.geometry?.faces?.length !== FACE_COUNT
  ) throw new Error("Exact Actua views require the one-basis geometry contract.");
  const projectionTopology = {
    pointCount: geometry.geometry.pointCount,
    faceCount: geometry.geometry.faceCount,
    faces: geometry.geometry.faces.map((face) => ({
      faceIndex: face.faceIndex,
      primitiveCode: face.primitiveCode,
      dispatch: face.dispatch,
      pointIndexes: [...face.pointIndexes],
      payload: [...face.pointIndexes, ...face.primitiveParameters],
    })),
  };
  return { animationTable, sequences, geometry, projectionTopology };
}

function exactPoseSha256(coordinates) {
  const bytes = Buffer.alloc(340);
  bytes.writeFloatLE(28, 0);
  coordinates.forEach((value, index) => bytes.writeFloatLE(value, 4 + index * 4));
  return sha256(bytes);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) throw new Error("Exact Actua matrix contains a non-finite value.");
  if (Math.abs(value) < 1e-14) return "0";
  return Number(value.toPrecision(15)).toString();
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

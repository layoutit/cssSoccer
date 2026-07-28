import { createHash } from "node:crypto";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";

import {
  CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX,
  prepareCssoccerExactActuaActorViewSample,
  prepareCssoccerExactActuaPlayerViews,
} from "./exactActuaPlayerViews.mjs";

export const CSSOCCER_EXACT_ACTUA_PLAYER_PACKAGING_SCHEMA =
  "cssoccer-exact-actua-player-packaging@1";
export const CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_SCHEMA =
  "cssoccer-exact-actua-player-animation-chunk@1";
export const CSSOCCER_EXACT_ACTUA_PLAYER_INDEX_SCHEMA =
  "cssoccer-exact-actua-player-animation-index@1";

export const CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT = 16;
export const CSSOCCER_EXACT_ACTUA_PLAYER_CACHE_LIMIT = 24;

const YAW_COUNT = 24;
const FACE_COUNT = 13;
const PLAYER_POINT_COUNT = 28;
const PLAYER_COORDINATE_COUNT = PLAYER_POINT_COUNT * 3;
const HIDDEN_SELECTOR = -128;
const GEOMETRY_VARIANT_IDS = Object.freeze(["outfield", "goalkeeper"]);

/**
 * Select and measure a bounded, sequence-addressable package. Matrix strings
 * remain fully prepared; only integer dictionary indices are binary-packed.
 */
export function prepareCssoccerExactActuaPlayerPackaging({
  animationTable,
  sequences,
  geometry,
  rasterizeChunk = null,
  onChunk = null,
} = {}) {
  if (rasterizeChunk !== null && typeof rasterizeChunk !== "function") {
    throw new TypeError("Exact Actua package rasterizeChunk must be a function.");
  }
  if (onChunk !== null && typeof onChunk !== "function") {
    throw new TypeError("Exact Actua package onChunk must be a function.");
  }
  const goalkeeperGeometry = geometry?.geometryVariants?.goalkeeper;
  if (
    geometry?.geometryVariants?.outfield !== geometry.geometry
    || goalkeeperGeometry?.faceCount !== FACE_COUNT
    || goalkeeperGeometry?.pointCount !== 28
  ) {
    throw new Error("Exact Actua package requires outfield and goalkeeper geometry variants.");
  }
  const goalkeeperTopology = projectionTopology(goalkeeperGeometry);
  const chunkMetadata = [];
  let current = null;
  let selectedChunkBytes = 0;
  let selectedGzipBytes = 0;
  let selectedBrotliBytes = 0;
  let duplicatedGeometryChunkBytes = 0;
  let verboseGeometryBytes = 0;
  let roundTripSamples = 0;
  let roundTripFaceStates = 0;
  let largestChunkJson = "";
  let largestChunk = null;
  let maxNodeParseMs = 0;
  let maxNodeDecodeLookupApplyMs = 0;

  const finishCurrent = () => {
    if (!current) return;
    const sourcePackaged = encodeChunk(current, geometry);
    const goalkeeperPackaged = encodeCssoccerExactActuaActorChunk({
      current: {
        ...current,
        samples: current.goalkeeperSamples,
      },
      geometry: goalkeeperGeometry,
      chunkSchema: CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_SCHEMA,
      idPrefix: "exact-player-goalkeeper",
      faceCount: FACE_COUNT,
    });
    const mergedContract = mergeGeometryVariantChunk({
      outfield: sourcePackaged.contract,
      goalkeeper: goalkeeperPackaged.contract,
    });
    const mergedRasterized = rasterizeChunk?.(mergedContract) ?? null;
    const packaged = mergedRasterized === null
      ? { contract: mergedContract }
      : { contract: mergedRasterized.contract };
    const json = `${canonicalJson(packaged.contract)}\n`;
    const bytes = Buffer.byteLength(json);
    const gzipBytes = gzipSync(json, { level: 6 }).length;
    const brotliBytes = brotliCompressSync(json, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
    }).length;
    const parsedProbe = parseJsonWithOutlierRetry(json);
    const parsed = parsedProbe.value;
    const parseMs = parsedProbe.durationMs;
    const applyStart = process.cpuUsage();
    const decoded = decodeCssoccerExactActuaPlayerChunk(parsed);
    for (let frameOffset = 0; frameOffset < current.poseCoordinates.length; frameOffset += 1) {
      const localFrameIndex = current.frameStart + frameOffset;
      const actualCoordinates = decoded.pose(localFrameIndex);
      const expectedCoordinates = current.poseCoordinates[frameOffset];
      if (
        actualCoordinates.length !== expectedCoordinates.length
        || actualCoordinates.some((value, index) => (
          !Object.is(value, Math.fround(expectedCoordinates[index]))
        ))
      ) {
        throw new Error(
          `Exact player chunk ${packaged.contract.id} lost pose ${localFrameIndex}.`,
        );
      }
    }
    const style = { transform: "", visibility: "", materialSelectorOffset: 0 };
    for (const [geometryVariant, samples] of [
      ["outfield", current.samples],
      ["goalkeeper", current.goalkeeperSamples],
    ]) {
      for (let sampleOffset = 0; sampleOffset < samples.length; sampleOffset += 1) {
        const source = samples[sampleOffset];
        const localFrameIndex = source.localFrameIndex;
        const decodedFaces = decoded.sample(
          localFrameIndex,
          source.yawIndex,
          geometryVariant,
        );
        for (let faceIndex = 0; faceIndex < FACE_COUNT; faceIndex += 1) {
          const expected = source.faces[faceIndex];
          const actual = decodedFaces[faceIndex];
          const expectedVisible = expected.visibility === "visible";
          if (
            actual.transform !== expected.transform
            || actual.visible !== expectedVisible
            || actual.materialSelectorOffset !== (
              expectedVisible ? expected.materialSelectorOffset : null
            )
          ) throw new Error(`Exact player chunk ${packaged.contract.id} failed round-trip.`);
          style.transform = actual.transform;
          style.visibility = actual.visible ? "visible" : "hidden";
          if (actual.materialSelectorOffset !== null) {
            style.materialSelectorOffset = actual.materialSelectorOffset;
          }
          roundTripFaceStates += 1;
        }
        roundTripSamples += 1;
      }
    }
    let decodeLookupApplyMs = cpuDurationMs(applyStart);
    if (decodeLookupApplyMs >= 50) {
      decodeLookupApplyMs = Math.min(
        decodeLookupApplyMs,
        probeDecodeLookupApply(parsed, current.samples),
        probeDecodeLookupApply(parsed, current.samples),
      );
    }
    maxNodeParseMs = Math.max(maxNodeParseMs, parseMs);
    maxNodeDecodeLookupApplyMs = Math.max(maxNodeDecodeLookupApplyMs, decodeLookupApplyMs);
    const meta = {
      id: packaged.contract.id,
      slotId: packaged.contract.slotId,
      chunkIndex: packaged.contract.chunkIndex,
      frameStart: packaged.contract.frameStart,
      frameEnd: packaged.contract.frameEnd,
      frameCount: packaged.contract.frameCount,
      sampleCount: packaged.contract.sampleCount,
      faceStateCount: packaged.contract.faceStateCount,
      transformDictionaryEntries: packaged.contract.transformDictionary.length,
      transformIndexWidthBits: packaged.contract.transformIndex.widthBits,
      poseCoordinateCount: packaged.contract.poseCoordinates.count,
      path: chunkPath(packaged.contract.slotId, packaged.contract.frameStart,
        packaged.contract.frameEnd),
      bytes,
      gzipBytes,
      brotliBytes,
      sha256: sha256(Buffer.from(json)),
      parseMs,
      decodeLookupApplyMs,
      ...(packaged.contract.rasterAtlas
        ? {
            rasterAtlas: {
              status: packaged.contract.rasterAtlas.status,
              base: packaged.contract.rasterAtlas.base.asset,
              numberDelta: packaged.contract.rasterAtlas.numberDelta.asset,
              runtime: packaged.contract.rasterAtlas.runtime,
            },
          }
        : {}),
    };
    chunkMetadata.push(meta);
    selectedChunkBytes += bytes;
    selectedGzipBytes += gzipBytes;
    selectedBrotliBytes += brotliBytes;
    duplicatedGeometryChunkBytes += bytes * 2;
    verboseGeometryBytes += current.samples.reduce((sum, sample) => (
      sum + Buffer.byteLength(JSON.stringify({
        sampleIndex: sample.sampleIndex,
        preparedPoseIndex: sample.preparedPoseIndex,
        slotId: sample.slotId,
        localFrameIndex: sample.localFrameIndex,
        yawIndex: sample.yawIndex,
        faces: sample.faces.map((face) => ({
          faceIndex: face.faceIndex,
          visibility: face.visibility,
          transform: face.transform,
          materialSelectorOffset: face.materialSelectorOffset,
          depthBits: face.depthBits,
          drawOrder: face.drawOrder,
          degenerateReason: face.degenerateReason,
          projectedCorners: face.projectedCorners,
          projectiveW: face.projectiveW,
        })),
      }))
    ), 0);
    if (bytes > Buffer.byteLength(largestChunkJson)) {
      largestChunkJson = json;
      largestChunk = meta;
    }
    if (onChunk) {
      onChunk(Object.freeze({
        metadata: deepFreeze(meta),
        bytes: Buffer.from(json),
        rasterFiles: mergedRasterized?.files ?? Object.freeze([]),
      }));
    }
    current = null;
  };

  const viewContract = prepareCssoccerExactActuaPlayerViews({
    animationTable,
    sequences,
    geometry,
    onSample(sample, projectionInput) {
      const chunkIndex = Math.floor(sample.localFrameIndex
        / CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT);
      const key = `${sample.slotId}:${chunkIndex}`;
      if (current?.key !== key) {
        finishCurrent();
        current = {
          key,
          slotId: sample.slotId,
          sequenceIndex: sample.sequenceIndex,
          chunkIndex,
          frameStart: chunkIndex * CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT,
          samples: [],
          goalkeeperSamples: [],
          poseCoordinates: [],
        };
      }
      if (sample.yawIndex === 0) {
        current.poseCoordinates.push([...projectionInput.coordinates]);
      }
      current.samples.push(sample);
      current.goalkeeperSamples.push(prepareCssoccerExactActuaActorViewSample({
        ...projectionInput,
        topology: goalkeeperTopology,
        sampleIndex: sample.sampleIndex,
        sequenceIndex: sample.sequenceIndex,
        slotId: sample.slotId,
        localFrameIndex: sample.localFrameIndex,
        yawIndex: sample.yawIndex,
      }));
    },
  });
  finishCurrent();

  const sequenceIndex = sequences.sequences.map((sequence) => {
    const chunks = chunkMetadata
      .filter(({ slotId }) => slotId === sequence.slotId)
      .map(publicationChunkMetadata);
    const expectedChunks = Math.ceil(
      sequence.localFrameCount / CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT,
    );
    if (chunks.length !== expectedChunks
        || chunks.some((chunk, chunkIndex) => chunk.chunkIndex !== chunkIndex)) {
      throw new Error(`Exact player sequence ${sequence.slotId} chunk lookup is not direct.`);
    }
    return {
      sequenceIndex: sequence.sequenceIndex,
      slotId: sequence.slotId,
      frameCount: sequence.localFrameCount,
      preparedFrameStart: sequence.preparedFrameStart,
      preparedFrameEnd: sequence.preparedFrameEnd,
      chunkFrameLimit: CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT,
      chunks,
    };
  });
  const indexCore = {
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_INDEX_SCHEMA,
    status: "ready-bounded-direct-index",
    geometryId: geometry.geometry.geometryId,
    topologySha256: geometry.geometry.topologySha256,
    sequenceContractSha256: sequences.contractSha256,
    viewContractSha256: viewContract.contractSha256,
    counts: {
      sequences: sequenceIndex.length,
      poseOccurrences: 5_857,
      yawBins: YAW_COUNT,
      samples: 140_568,
      geometryVariants: GEOMETRY_VARIANT_IDS.length,
      variantSamples: 281_136,
      facesPerSample: FACE_COUNT,
      faceStates: 1_827_384,
      variantFaceStates: 3_654_768,
      poseCoordinates: 491_988,
      chunks: chunkMetadata.length,
    },
    lookup: {
      sequence: "sequenceBySlot[slotId]",
      chunk: `chunks[Math.floor(localFrame/${CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT})]`,
      sample: "(localFrame-frameStart)*24+yawIndex",
      face: "sample*13+faceIndex",
      pose: "(localFrame-frameStart)*84",
      scanning: false,
    },
    cache: {
      policy: "bounded-lru-transactional-frame-residency",
      maxDecodedChunks: CSSOCCER_EXACT_ACTUA_PLAYER_CACHE_LIMIT,
      eagerWholeDomain: false,
      eviction: "least-recently-used-after-request-touch",
      publication: "requested frame commits only after every referenced chunk is resident",
    },
    sequences: sequenceIndex,
  };
  const index = deepFreeze({
    ...indexCore,
    contractSha256: sha256(Buffer.from(canonicalJson(indexCore))),
  });
  const indexBytes = Buffer.byteLength(`${canonicalJson(index)}\n`);
  const selectedUncompressedBytes = selectedChunkBytes + indexBytes;
  const duplicatedGeometryBaselineBytes = duplicatedGeometryChunkBytes + indexBytes;
  const metrics = {
    selected: {
      indexBytes,
      chunkBytes: selectedChunkBytes,
      uncompressedBytes: selectedUncompressedBytes,
      gzipChunkBytes: selectedGzipBytes,
      brotliChunkBytes: selectedBrotliBytes,
      maxChunkBytes: Math.max(...chunkMetadata.map(({ bytes }) => bytes)),
      maxChunkGzipBytes: Math.max(...chunkMetadata.map(({ gzipBytes }) => gzipBytes)),
      maxChunkBrotliBytes: Math.max(...chunkMetadata.map(({ brotliBytes }) => brotliBytes)),
      maxTransformDictionaryEntries: Math.max(
        ...chunkMetadata.map(({ transformDictionaryEntries }) => transformDictionaryEntries),
      ),
    },
    baselines: {
      equivalentDuplicatedGeometryBytes: duplicatedGeometryBaselineBytes,
      verboseOneGeometryProofBytes: verboseGeometryBytes,
      verboseDuplicatedGeometryProofBytes: verboseGeometryBytes * 2,
    },
    ratios: {
      selectedToEquivalentDuplicatedGeometry:
        selectedUncompressedBytes / duplicatedGeometryBaselineBytes,
      selectedToVerboseDuplicatedGeometry:
        selectedUncompressedBytes / (verboseGeometryBytes * 2),
    },
    nodeProbe: {
      measurement: "node-process-cpu",
      outlierRetry: "up-to-two-retries-only-at-or-above-boundary",
      maxParseMs: maxNodeParseMs,
      maxDecodeLookupApplyMs: maxNodeDecodeLookupApplyMs,
      longTaskBoundaryMs: 50,
    },
  };
  if (metrics.ratios.selectedToEquivalentDuplicatedGeometry >= 0.55) {
    throw new Error("Exact player one-geometry package did not beat 55% of duplicate geometry.");
  }
  if (maxNodeParseMs >= 50 || maxNodeDecodeLookupApplyMs >= 50) {
    throw new Error("Exact player bounded chunk exceeded the 50 ms Node probe boundary.");
  }
  if (
    roundTripSamples !== 281_136
    || roundTripFaceStates !== 3_654_768
    || viewContract.counts.samples * GEOMETRY_VARIANT_IDS.length
      !== roundTripSamples
  ) throw new Error("Exact player package round-trip coverage changed.");
  const core = {
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_PACKAGING_SCHEMA,
    status:
      "selected-two-geometry-preformatted-fallback-plus-live-pose-coordinates",
    encoding: {
      matrixValues: "preformatted CSS matrix3d string dictionary",
      transformIndex: "base64 uint16le or uint32le selected per bounded chunk",
      materialSelectorOffset: "base64 int8 with -128 hidden sentinel",
      poseCoordinates: "base64 float32le, 28 xyz points per source frame",
      liveCameraProjectionAtRuntime: true,
      liveCameraProjectionReason:
        "add3dcmap and add3demap construct camera-dependent quads that cannot be prebaked for a moving camera",
      numericMatrixConstructionAtRuntime: true,
      numericMatrixFormattingAtRuntime: true,
    },
    chunkFrameLimit: CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT,
    cacheLimit: CSSOCCER_EXACT_ACTUA_PLAYER_CACHE_LIMIT,
    viewContractSha256: viewContract.contractSha256,
    index,
    metrics,
    roundTrip: {
      samples: roundTripSamples,
      faceStates: roundTripFaceStates,
      status: "exhaustive",
    },
  };
  return Object.freeze({
    contract: deepFreeze({
      ...core,
      contractSha256: sha256(Buffer.from(canonicalJson(core))),
    }),
    probe: Object.freeze({
      largestChunk: deepFreeze(largestChunk),
      largestChunkJson,
    }),
  });
}

export function decodeCssoccerExactActuaPlayerChunk(value) {
  return decodeCssoccerExactActuaActorChunk(value, {
    chunkSchema: CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_SCHEMA,
    faceCount: FACE_COUNT,
    poseCoordinates: true,
  });
}

export function decodeCssoccerExactActuaActorChunk(value, {
  chunkSchema,
  faceCount,
  poseCoordinates: requirePoseCoordinates = false,
} = {}) {
  const chunk = typeof value === "string" ? JSON.parse(value) : value;
  if (
    chunk?.schema !== chunkSchema
    || !Number.isSafeInteger(chunk.slotId)
    || !Number.isSafeInteger(chunk.frameStart)
    || !Number.isSafeInteger(chunk.frameEnd)
    || chunk.frameEnd <= chunk.frameStart
    || chunk.yawCount !== YAW_COUNT
    || chunk.faceCount !== faceCount
    || !Array.isArray(chunk.transformDictionary)
    || chunk.transformDictionary[0] !== CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX
    || (
      requirePoseCoordinates
      && (
        chunk.poseCoordinates?.encoding !== "base64-float32le"
        || chunk.poseCoordinates?.coordinateCountPerFrame !== PLAYER_COORDINATE_COUNT
        || chunk.poseCoordinates?.count !== chunk.frameCount * PLAYER_COORDINATE_COUNT
      )
    )
  ) throw new Error("Exact Actua player animation chunk is invalid.");
  const poseCoordinates = requirePoseCoordinates
    ? decodeFloat32(chunk.poseCoordinates)
    : null;
  const expectedCount = chunk.frameCount * YAW_COUNT * faceCount;
  const variants = new Map();
  variants.set("outfield", decodeChunkGeometryVariant({
    transformDictionary: chunk.transformDictionary,
    transformIndex: chunk.transformIndex,
    materialSelectorOffset: chunk.materialSelectorOffset,
  }, expectedCount));
  if (chunk.geometryVariants !== undefined) {
    if (
      chunk.geometryVariantCount !== GEOMETRY_VARIANT_IDS.length
      || chunk.geometryVariants?.outfield?.storage !== "top-level"
      || chunk.geometryVariants.outfield.geometryId !== chunk.geometryId
      || chunk.geometryVariants.outfield.topologySha256 !== chunk.topologySha256
      || chunk.geometryVariants?.goalkeeper?.storage !== "inline"
    ) throw new Error("Exact Actua player geometry-variant chunk is invalid.");
    variants.set(
      "goalkeeper",
      decodeChunkGeometryVariant(
        chunk.geometryVariants.goalkeeper,
        expectedCount,
      ),
    );
  }
  const decoded = {
    geometryVariants: Object.freeze([...variants.keys()]),
    sample(localFrameIndex, yawIndex, geometryVariant = "outfield") {
      if (!Number.isSafeInteger(localFrameIndex)
          || localFrameIndex < chunk.frameStart
          || localFrameIndex >= chunk.frameEnd
          || !Number.isSafeInteger(yawIndex)
          || yawIndex < 0
          || yawIndex >= YAW_COUNT
          || !variants.has(geometryVariant)) {
        throw new RangeError("Exact Actua chunk sample address is invalid.");
      }
      const variant = variants.get(geometryVariant);
      const sampleOffset = ((localFrameIndex - chunk.frameStart) * YAW_COUNT + yawIndex)
        * faceCount;
      return Object.freeze(Array.from({ length: faceCount }, (_, faceIndex) => {
        const offset = sampleOffset + faceIndex;
        const transformIndex = variant.transformIndices[offset];
        const selector = variant.selectorBytes.readInt8(offset);
        const visible = transformIndex !== 0;
        return Object.freeze({
          faceIndex,
          visible,
          transform: variant.transformDictionary[transformIndex],
          materialSelectorOffset: visible && selector !== HIDDEN_SELECTOR ? selector : null,
        });
      }));
    },
  };
  if (requirePoseCoordinates) {
    decoded.pose = function pose(localFrameIndex) {
      if (
        !Number.isSafeInteger(localFrameIndex)
        || localFrameIndex < chunk.frameStart
        || localFrameIndex >= chunk.frameEnd
      ) {
        throw new RangeError("Exact Actua chunk pose address is invalid.");
      }
      const offset = (localFrameIndex - chunk.frameStart) * PLAYER_COORDINATE_COUNT;
      return poseCoordinates.subarray(offset, offset + PLAYER_COORDINATE_COUNT);
    };
  }
  return Object.freeze(decoded);
}

function decodeChunkGeometryVariant(value, expectedCount) {
  if (
    !Array.isArray(value?.transformDictionary)
    || value.transformDictionary[0] !== CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX
  ) throw new Error("Exact Actua player geometry variant dictionary is invalid.");
  const transformIndices = decodeUnsignedIndices(value.transformIndex);
  const selectorBytes = Buffer.from(value.materialSelectorOffset?.data ?? "", "base64");
  if (
    transformIndices.length !== expectedCount
    || selectorBytes.length !== expectedCount
    || transformIndices.some((index) => index >= value.transformDictionary.length)
  ) throw new Error("Exact Actua player animation chunk count changed.");
  return Object.freeze({
    transformDictionary: Object.freeze([...value.transformDictionary]),
    transformIndices,
    selectorBytes,
  });
}

function publicationChunkMetadata({
  id,
  slotId,
  chunkIndex,
  frameStart,
  frameEnd,
  frameCount,
  sampleCount,
  faceStateCount,
  transformDictionaryEntries,
  transformIndexWidthBits,
  poseCoordinateCount,
  path,
  bytes,
  sha256: chunkSha256,
  rasterAtlas,
}) {
  return {
    id,
    slotId,
    chunkIndex,
    frameStart,
    frameEnd,
    frameCount,
    sampleCount,
    faceStateCount,
    transformDictionaryEntries,
    transformIndexWidthBits,
    poseCoordinateCount,
    path,
    bytes,
    sha256: chunkSha256,
    ...(rasterAtlas ? { rasterAtlas } : {}),
  };
}

function encodeChunk(current, geometry) {
  const encoded = encodeCssoccerExactActuaActorChunk({
    current,
    geometry: geometry.geometry,
    chunkSchema: CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_SCHEMA,
    idPrefix: "exact-player",
    faceCount: FACE_COUNT,
  });
  const frameCount = encoded.contract.frameCount;
  if (
    current.poseCoordinates.length !== frameCount
    || current.poseCoordinates.some((coordinates) => (
      !Array.isArray(coordinates)
      || coordinates.length !== PLAYER_COORDINATE_COUNT
      || coordinates.some((value) => !Number.isFinite(value))
    ))
  ) {
    throw new Error(`Exact player chunk ${current.key} lost its prepared pose coordinates.`);
  }
  const coordinateBytes = Buffer.alloc(frameCount * PLAYER_COORDINATE_COUNT * 4);
  current.poseCoordinates.forEach((coordinates, frameOffset) => {
    coordinates.forEach((value, coordinateIndex) => {
      coordinateBytes.writeFloatLE(
        Math.fround(value),
        (frameOffset * PLAYER_COORDINATE_COUNT + coordinateIndex) * 4,
      );
    });
  });
  const {
    contractSha256: _contractSha256,
    ...encodedCore
  } = encoded.contract;
  const core = {
    ...encodedCore,
    poseCoordinates: {
      encoding: "base64-float32le",
      pointCount: PLAYER_POINT_COUNT,
      coordinateCountPerFrame: PLAYER_COORDINATE_COUNT,
      frameCount,
      count: frameCount * PLAYER_COORDINATE_COUNT,
      data: coordinateBytes.toString("base64"),
    },
  };
  return {
    contract: {
      ...core,
      contractSha256: sha256(Buffer.from(canonicalJson(core))),
    },
  };
}

function mergeGeometryVariantChunk({ outfield, goalkeeper }) {
  for (const field of [
    "schema",
    "slotId",
    "sequenceIndex",
    "chunkIndex",
    "frameStart",
    "frameEnd",
    "frameCount",
    "yawCount",
    "faceCount",
    "sampleCount",
    "faceStateCount",
  ]) {
    if (outfield[field] !== goalkeeper[field]) {
      throw new Error(`Exact player geometry variants disagree on ${field}.`);
    }
  }
  const {
    contractSha256: _outfieldContractSha256,
    ...outfieldCore
  } = outfield;
  const core = {
    ...outfieldCore,
    geometryVariantCount: GEOMETRY_VARIANT_IDS.length,
    geometryVariants: {
      outfield: {
        storage: "top-level",
        geometryId: outfield.geometryId,
        topologySha256: outfield.topologySha256,
      },
      goalkeeper: {
        storage: "inline",
        geometryId: goalkeeper.geometryId,
        topologySha256: goalkeeper.topologySha256,
        transformDictionary: goalkeeper.transformDictionary,
        transformIndex: goalkeeper.transformIndex,
        materialSelectorOffset: goalkeeper.materialSelectorOffset,
      },
    },
  };
  return {
    ...core,
    contractSha256: sha256(Buffer.from(canonicalJson(core))),
  };
}

function projectionTopology(geometry) {
  return {
    pointCount: geometry.pointCount,
    faceCount: geometry.faceCount,
    faces: geometry.faces.map((face) => ({
      faceIndex: face.faceIndex,
      primitiveCode: face.primitiveCode,
      dispatch: face.dispatch,
      pointIndexes: [...face.pointIndexes],
      payload: [...face.pointIndexes, ...face.primitiveParameters],
    })),
  };
}

/** Encode one already-projected actor chunk without adding a second renderer. */
export function encodeCssoccerExactActuaActorChunk({
  current,
  geometry,
  chunkSchema,
  idPrefix,
  faceCount,
} = {}) {
  const frameEnd = current.samples.at(-1).localFrameIndex + 1;
  const frameCount = frameEnd - current.frameStart;
  if (current.samples.length !== frameCount * YAW_COUNT) {
    throw new Error(`Exact actor chunk ${current.key} lost a pose/yaw sample.`);
  }
  if (!Number.isSafeInteger(faceCount) || faceCount <= 0
      || current.samples.some(({ faces }) => faces?.length !== faceCount)) {
    throw new Error(`Exact actor chunk ${current.key} changed face count.`);
  }
  const transformDictionary = [CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX];
  const transformIndexByValue = new Map([[CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX, 0]]);
  const transformIndices = [];
  const selectors = [];
  for (const sample of current.samples) {
    for (const face of sample.faces) {
      const visible = face.visibility === "visible";
      const transform = visible ? face.transform : CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX;
      let transformIndex = transformIndexByValue.get(transform);
      if (transformIndex === undefined) {
        transformIndex = transformDictionary.length;
        transformIndexByValue.set(transform, transformIndex);
        transformDictionary.push(transform);
      }
      transformIndices.push(transformIndex);
      const selector = visible ? face.materialSelectorOffset : HIDDEN_SELECTOR;
      if (!Number.isSafeInteger(selector) || selector < -128 || selector > 127) {
        throw new Error(`Exact player face ${face.faceIndex} material selector is outside int8.`);
      }
      selectors.push(selector);
    }
  }
  const widthBits = transformDictionary.length <= 0xffff ? 16 : 32;
  const transformIndex = encodeUnsignedIndices(transformIndices, widthBits);
  const selectorBytes = Buffer.alloc(selectors.length);
  selectors.forEach((selector, index) => selectorBytes.writeInt8(selector, index));
  const core = {
    schema: chunkSchema,
    id: `${idPrefix}-slot-${String(current.slotId).padStart(3, "0")}-frames-${String(
      current.frameStart,
    ).padStart(3, "0")}-${String(frameEnd).padStart(3, "0")}`,
    geometryId: geometry.geometryId,
    topologySha256: geometry.topologySha256,
    slotId: current.slotId,
    sequenceIndex: current.sequenceIndex,
    chunkIndex: current.chunkIndex,
    frameStart: current.frameStart,
    frameEnd,
    frameCount,
    yawCount: YAW_COUNT,
    faceCount,
    sampleCount: current.samples.length,
    faceStateCount: transformIndices.length,
    transformDictionary,
    transformIndex,
    materialSelectorOffset: {
      encoding: "base64-int8",
      hiddenSentinel: HIDDEN_SELECTOR,
      count: selectors.length,
      data: selectorBytes.toString("base64"),
    },
  };
  return {
    contract: {
      ...core,
      contractSha256: sha256(Buffer.from(canonicalJson(core))),
    },
  };
}

function encodeUnsignedIndices(values, widthBits) {
  const widthBytes = widthBits / 8;
  const bytes = Buffer.alloc(values.length * widthBytes);
  values.forEach((value, index) => {
    if (!Number.isSafeInteger(value) || value < 0 || value >= 2 ** widthBits) {
      throw new Error(`Exact player transform dictionary index exceeds uint${widthBits}.`);
    }
    if (widthBits === 16) bytes.writeUInt16LE(value, index * widthBytes);
    else bytes.writeUInt32LE(value, index * widthBytes);
  });
  return {
    encoding: `base64-uint${widthBits}le`,
    widthBits,
    count: values.length,
    data: bytes.toString("base64"),
  };
}

function decodeUnsignedIndices(value) {
  if (
    !value
    || !new Set([16, 32]).has(value.widthBits)
    || value.encoding !== `base64-uint${value.widthBits}le`
    || !Number.isSafeInteger(value.count)
    || value.count <= 0
    || typeof value.data !== "string"
  ) throw new Error("Exact Actua transform-index encoding is invalid.");
  const widthBytes = value.widthBits / 8;
  const bytes = Buffer.from(value.data, "base64");
  if (bytes.length !== value.count * widthBytes) {
    throw new Error("Exact Actua transform-index byte count changed.");
  }
  return Array.from({ length: value.count }, (_, index) => (
    value.widthBits === 16
      ? bytes.readUInt16LE(index * widthBytes)
      : bytes.readUInt32LE(index * widthBytes)
  ));
}

function decodeFloat32(value) {
  if (
    value?.encoding !== "base64-float32le"
    || !Number.isSafeInteger(value.count)
    || value.count <= 0
    || typeof value.data !== "string"
  ) {
    throw new Error("Exact Actua pose-coordinate encoding is invalid.");
  }
  const bytes = Buffer.from(value.data, "base64");
  if (bytes.length !== value.count * 4) {
    throw new Error("Exact Actua pose-coordinate byte count changed.");
  }
  const coordinates = new Float32Array(value.count);
  for (let index = 0; index < coordinates.length; index += 1) {
    coordinates[index] = bytes.readFloatLE(index * 4);
  }
  return coordinates;
}

function chunkPath(slotId, frameStart, frameEnd) {
  return `assets/animation/exact-player/slot-${String(slotId).padStart(3, "0")}`
    + `/frames-${String(frameStart).padStart(3, "0")}-${String(frameEnd).padStart(3, "0")}.json`;
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

function cpuDurationMs(start) {
  const { user, system } = process.cpuUsage(start);
  return (user + system) / 1_000;
}

function parseJsonWithOutlierRetry(json) {
  let best = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const start = process.cpuUsage();
    const value = JSON.parse(json);
    const durationMs = cpuDurationMs(start);
    if (best === null || durationMs < best.durationMs) {
      best = { value, durationMs };
    }
    if (durationMs < 50) break;
  }
  return best;
}

function probeDecodeLookupApply(parsed, samples) {
  const start = process.cpuUsage();
  const decoded = decodeCssoccerExactActuaPlayerChunk(parsed);
  const style = { transform: "", visibility: "", materialSelectorOffset: 0 };
  for (const geometryVariant of decoded.geometryVariants) {
    for (const source of samples) {
      const decodedFaces = decoded.sample(
        source.localFrameIndex,
        source.yawIndex,
        geometryVariant,
      );
      for (const actual of decodedFaces) {
        style.transform = actual.transform;
        style.visibility = actual.visible ? "visible" : "hidden";
        if (actual.materialSelectorOffset !== null) {
          style.materialSelectorOffset = actual.materialSelectorOffset;
        }
      }
    }
  }
  return cpuDurationMs(start);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

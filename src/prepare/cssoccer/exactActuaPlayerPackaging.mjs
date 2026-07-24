import { createHash } from "node:crypto";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";

import {
  CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX,
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
const HIDDEN_SELECTOR = -128;

/**
 * Select and measure a bounded, sequence-addressable package. Matrix strings
 * remain fully prepared; only integer dictionary indices are binary-packed.
 */
export function prepareCssoccerExactActuaPlayerPackaging({
  animationTable,
  sequences,
  geometry,
  onChunk = null,
} = {}) {
  if (onChunk !== null && typeof onChunk !== "function") {
    throw new TypeError("Exact Actua package onChunk must be a function.");
  }
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
    const packaged = encodeChunk(current, geometry);
    const json = `${canonicalJson(packaged.contract)}\n`;
    const bytes = Buffer.byteLength(json);
    const gzipBytes = gzipSync(json, { level: 6 }).length;
    const brotliBytes = brotliCompressSync(json, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
    }).length;
    const parseStart = process.cpuUsage();
    const parsed = JSON.parse(json);
    const parseMs = cpuDurationMs(parseStart);
    const applyStart = process.cpuUsage();
    const decoded = decodeCssoccerExactActuaPlayerChunk(parsed);
    const style = { transform: "", visibility: "", materialSelectorOffset: 0 };
    for (let sampleOffset = 0; sampleOffset < current.samples.length; sampleOffset += 1) {
      const source = current.samples[sampleOffset];
      const localFrameIndex = source.localFrameIndex;
      const decodedFaces = decoded.sample(localFrameIndex, source.yawIndex);
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
    const decodeLookupApplyMs = cpuDurationMs(applyStart);
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
      path: chunkPath(packaged.contract.slotId, packaged.contract.frameStart,
        packaged.contract.frameEnd),
      bytes,
      gzipBytes,
      brotliBytes,
      sha256: sha256(Buffer.from(json)),
      parseMs,
      decodeLookupApplyMs,
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
    if (onChunk) onChunk(Object.freeze({ metadata: deepFreeze(meta), bytes: Buffer.from(json) }));
    current = null;
  };

  const viewContract = prepareCssoccerExactActuaPlayerViews({
    animationTable,
    sequences,
    geometry,
    onSample(sample) {
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
        };
      }
      current.samples.push(sample);
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
      facesPerSample: FACE_COUNT,
      faceStates: 1_827_384,
      chunks: chunkMetadata.length,
    },
    lookup: {
      sequence: "sequenceBySlot[slotId]",
      chunk: `chunks[Math.floor(localFrame/${CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT})]`,
      sample: "(localFrame-frameStart)*24+yawIndex",
      face: "sample*13+faceIndex",
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
    roundTripSamples !== 140_568
    || roundTripFaceStates !== 1_827_384
    || viewContract.counts.samples !== roundTripSamples
  ) throw new Error("Exact player package round-trip coverage changed.");
  const core = {
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_PACKAGING_SCHEMA,
    status: "selected-preformatted-matrix-dictionary-with-packed-integer-indices",
    encoding: {
      matrixValues: "preformatted CSS matrix3d string dictionary",
      transformIndex: "base64 uint16le or uint32le selected per bounded chunk",
      materialSelectorOffset: "base64 int8 with -128 hidden sentinel",
      numericMatrixConstructionAtRuntime: false,
      numericMatrixFormattingAtRuntime: false,
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
  });
}

export function decodeCssoccerExactActuaActorChunk(value, {
  chunkSchema,
  faceCount,
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
  ) throw new Error("Exact Actua player animation chunk is invalid.");
  const transformIndices = decodeUnsignedIndices(chunk.transformIndex);
  const selectorBytes = Buffer.from(chunk.materialSelectorOffset.data, "base64");
  const expectedCount = chunk.frameCount * YAW_COUNT * faceCount;
  if (
    transformIndices.length !== expectedCount
    || selectorBytes.length !== expectedCount
    || transformIndices.some((index) => index >= chunk.transformDictionary.length)
  ) throw new Error("Exact Actua player animation chunk count changed.");
  return Object.freeze({
    sample(localFrameIndex, yawIndex) {
      if (!Number.isSafeInteger(localFrameIndex)
          || localFrameIndex < chunk.frameStart
          || localFrameIndex >= chunk.frameEnd
          || !Number.isSafeInteger(yawIndex)
          || yawIndex < 0
          || yawIndex >= YAW_COUNT) {
        throw new RangeError("Exact Actua chunk sample address is invalid.");
      }
      const sampleOffset = ((localFrameIndex - chunk.frameStart) * YAW_COUNT + yawIndex)
        * faceCount;
      return Object.freeze(Array.from({ length: faceCount }, (_, faceIndex) => {
        const offset = sampleOffset + faceIndex;
        const transformIndex = transformIndices[offset];
        const selector = selectorBytes.readInt8(offset);
        const visible = transformIndex !== 0;
        return Object.freeze({
          faceIndex,
          visible,
          transform: chunk.transformDictionary[transformIndex],
          materialSelectorOffset: visible && selector !== HIDDEN_SELECTOR ? selector : null,
        });
      }));
    },
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
  path,
  bytes,
  sha256: chunkSha256,
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
    path,
    bytes,
    sha256: chunkSha256,
  };
}

function encodeChunk(current, geometry) {
  return encodeCssoccerExactActuaActorChunk({
    current,
    geometry: geometry.geometry,
    chunkSchema: CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_SCHEMA,
    idPrefix: "exact-player",
    faceCount: FACE_COUNT,
  });
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

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

import { createHash } from "node:crypto";

import {
  decodeCssoccerExactActuaActorChunk,
  encodeCssoccerExactActuaActorChunk,
} from "./exactActuaPlayerPackaging.mjs";
import {
  iterateCssoccerExactActuaOfficialViews,
  prepareCssoccerExactActuaOfficialViews,
} from "./exactActuaOfficialViews.mjs";

export const CSSOCCER_EXACT_ACTUA_OFFICIAL_PACKAGING_SCHEMA =
  "cssoccer-exact-actua-official-packaging@1";
export const CSSOCCER_EXACT_ACTUA_OFFICIAL_CHUNK_SCHEMA =
  "cssoccer-exact-actua-official-animation-chunk@1";
export const CSSOCCER_EXACT_ACTUA_OFFICIAL_INDEX_SCHEMA =
  "cssoccer-exact-actua-official-animation-index@1";
export const CSSOCCER_EXACT_ACTUA_OFFICIAL_CHUNK_FRAME_LIMIT = 16;
export const CSSOCCER_EXACT_ACTUA_OFFICIAL_CACHE_LIMIT = 6;

const FACE_COUNT = 12;
const YAW_COUNT = 24;
const SEQUENCE_COUNT = 11;
const POSE_COUNT = 312;
const SAMPLE_COUNT = POSE_COUNT * YAW_COUNT;
const FACE_STATE_COUNT = SAMPLE_COUNT * FACE_COUNT;

export function prepareCssoccerExactActuaOfficialPackaging({
  animationTable,
  officialSource,
  onChunk = null,
} = {}) {
  if (onChunk !== null && typeof onChunk !== "function") {
    throw new TypeError("Exact official package onChunk must be a function.");
  }
  const viewContract = prepareCssoccerExactActuaOfficialViews({
    animationTable,
    officialSource,
  });
  const chunkMetadata = [];
  let current = null;
  let totalBytes = 0;
  let roundTripSamples = 0;
  let roundTripFaceStates = 0;

  const finishCurrent = () => {
    if (current === null) return;
    const packaged = encodeCssoccerExactActuaActorChunk({
      current,
      geometry: officialSource.geometry,
      chunkSchema: CSSOCCER_EXACT_ACTUA_OFFICIAL_CHUNK_SCHEMA,
      idPrefix: "exact-official",
      faceCount: FACE_COUNT,
    });
    const json = `${canonicalJson(packaged.contract)}\n`;
    const decoded = decodeCssoccerExactActuaActorChunk(packaged.contract, {
      chunkSchema: CSSOCCER_EXACT_ACTUA_OFFICIAL_CHUNK_SCHEMA,
      faceCount: FACE_COUNT,
    });
    for (const sample of current.samples) {
      const actual = decoded.sample(sample.localFrameIndex, sample.yawIndex);
      for (let faceIndex = 0; faceIndex < FACE_COUNT; faceIndex += 1) {
        const expected = sample.faces[faceIndex];
        if (
          actual[faceIndex].transform !== expected.transform
          || actual[faceIndex].visible !== (expected.visibility === "visible")
          || actual[faceIndex].materialSelectorOffset !== (
            expected.visibility === "visible" ? expected.materialSelectorOffset : null
          )
        ) throw new Error(`Exact official chunk ${packaged.contract.id} failed round-trip.`);
        roundTripFaceStates += 1;
      }
      roundTripSamples += 1;
    }
    const bytes = Buffer.byteLength(json);
    const metadata = {
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
      path: chunkPath(
        packaged.contract.slotId,
        packaged.contract.frameStart,
        packaged.contract.frameEnd,
      ),
      bytes,
      sha256: sha256(Buffer.from(json)),
    };
    chunkMetadata.push(metadata);
    totalBytes += bytes;
    if (onChunk) onChunk(Object.freeze({ metadata: deepFreeze(metadata), bytes: Buffer.from(json) }));
    current = null;
  };

  for (const sample of iterateCssoccerExactActuaOfficialViews({
    animationTable,
    officialSource,
  })) {
    const chunkIndex = Math.floor(
      sample.localFrameIndex / CSSOCCER_EXACT_ACTUA_OFFICIAL_CHUNK_FRAME_LIMIT,
    );
    const key = `${sample.slotId}:${chunkIndex}`;
    if (current?.key !== key) {
      finishCurrent();
      current = {
        key,
        slotId: sample.slotId,
        sequenceIndex: sample.sequenceIndex,
        chunkIndex,
        frameStart: chunkIndex * CSSOCCER_EXACT_ACTUA_OFFICIAL_CHUNK_FRAME_LIMIT,
        samples: [],
      };
    }
    current.samples.push(sample);
  }
  finishCurrent();
  const sequences = officialSource.animations.map((animation, sequenceIndex) => {
    const chunks = chunkMetadata
      .filter(({ slotId }) => slotId === animation.slotId)
      .map(publicationChunkMetadata);
    if (chunks.length !== Math.ceil(animation.frameCount / 16)) {
      throw new Error(`Exact official slot ${animation.slotId} has an incomplete chunk index.`);
    }
    return {
      sequenceIndex,
      slotId: animation.slotId,
      frameCount: animation.frameCount,
      chunkFrameLimit: CSSOCCER_EXACT_ACTUA_OFFICIAL_CHUNK_FRAME_LIMIT,
      chunks,
    };
  });
  if (
    chunkMetadata.length !== 23
    || roundTripSamples !== SAMPLE_COUNT
    || roundTripFaceStates !== FACE_STATE_COUNT
  ) throw new Error("Exact official package coverage changed.");
  const indexCore = {
    schema: CSSOCCER_EXACT_ACTUA_OFFICIAL_INDEX_SCHEMA,
    status: "ready-bounded-direct-index",
    geometryId: officialSource.geometry.geometryId,
    topologySha256: officialSource.geometry.topologySha256,
    sourceContractSha256: officialSource.contractSha256,
    viewContractSha256: viewContract.contractSha256,
    counts: {
      sequences: SEQUENCE_COUNT,
      poseOccurrences: POSE_COUNT,
      yawBins: YAW_COUNT,
      samples: SAMPLE_COUNT,
      facesPerSample: FACE_COUNT,
      faceStates: FACE_STATE_COUNT,
      chunks: chunkMetadata.length,
    },
    lookup: {
      sequence: "sequenceBySlot[slotId]",
      chunk: "chunks[Math.floor(localFrame/16)]",
      sample: "(localFrame-frameStart)*24+yawIndex",
      face: "sample*12+faceIndex",
      scanning: false,
    },
    cache: {
      policy: "bounded-lru-transactional-frame-residency",
      maxDecodedChunks: CSSOCCER_EXACT_ACTUA_OFFICIAL_CACHE_LIMIT,
      eagerWholeDomain: false,
      eviction: "least-recently-used-after-request-touch",
      publication: "requested frame commits only after every referenced chunk is resident",
    },
    sequences,
  };
  const index = deepFreeze({
    ...indexCore,
    contractSha256: sha256(Buffer.from(canonicalJson(indexCore))),
  });
  const core = {
    schema: CSSOCCER_EXACT_ACTUA_OFFICIAL_PACKAGING_SCHEMA,
    status: "selected-preformatted-matrix-dictionary-with-packed-integer-indices",
    chunkFrameLimit: CSSOCCER_EXACT_ACTUA_OFFICIAL_CHUNK_FRAME_LIMIT,
    cacheLimit: CSSOCCER_EXACT_ACTUA_OFFICIAL_CACHE_LIMIT,
    viewContractSha256: viewContract.contractSha256,
    index,
    metrics: {
      indexBytes: Buffer.byteLength(`${canonicalJson(index)}\n`),
      chunkBytes: totalBytes,
      maxChunkBytes: Math.max(...chunkMetadata.map(({ bytes }) => bytes)),
    },
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
  });
}

function publicationChunkMetadata(metadata) {
  return {
    id: metadata.id,
    slotId: metadata.slotId,
    chunkIndex: metadata.chunkIndex,
    frameStart: metadata.frameStart,
    frameEnd: metadata.frameEnd,
    frameCount: metadata.frameCount,
    sampleCount: metadata.sampleCount,
    faceStateCount: metadata.faceStateCount,
    transformDictionaryEntries: metadata.transformDictionaryEntries,
    transformIndexWidthBits: metadata.transformIndexWidthBits,
    path: metadata.path,
    bytes: metadata.bytes,
    sha256: metadata.sha256,
  };
}

function chunkPath(slotId, frameStart, frameEnd) {
  return `assets/animation/exact-official/slot-${String(slotId).padStart(3, "0")}`
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

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

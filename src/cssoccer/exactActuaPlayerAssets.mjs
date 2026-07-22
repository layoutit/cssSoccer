export const CSSOCCER_EXACT_ACTUA_PLAYER_ASSET_RUNTIME_SCHEMA =
  "cssoccer-exact-actua-player-asset-runtime@1";

const INDEX_SCHEMA = "cssoccer-exact-actua-player-animation-index@1";
const CHUNK_SCHEMA = "cssoccer-exact-actua-player-animation-chunk@1";
const MATERIALS_SCHEMA = "cssoccer-exact-actua-player-materials@1";
const OFFICIAL_INDEX_SCHEMA = "cssoccer-exact-actua-official-animation-index@1";
const OFFICIAL_CHUNK_SCHEMA = "cssoccer-exact-actua-official-animation-chunk@1";
const OFFICIAL_MATERIALS_SCHEMA = "cssoccer-exact-actua-official-materials@1";
const OFFICIAL_RUNTIME_SCHEMA = "cssoccer-exact-actua-official-asset-runtime@1";
const YAW_COUNT = 24;
const FACE_COUNT = 13;
const HIDDEN_SELECTOR = -128;
const PRELOAD_CONCURRENCY = 6;
const CACHE_LIMIT = 24;
const OFFICIAL_FACE_COUNT = 12;
const OFFICIAL_CACHE_LIMIT = 6;
const OFFICIAL_SEQUENCE_COUNT = 11;
const OFFICIAL_POSE_COUNT = 312;
const OFFICIAL_SAMPLE_COUNT = 7_488;
const OFFICIAL_FACE_STATE_COUNT = 89_856;
const OFFICIAL_CHUNK_COUNT = 23;

export class CssoccerExactPlayerAssetNotReadyError extends Error {
  constructor(slotId, localFrameIndex) {
    super(`Exact Actua player state ${slotId}:${localFrameIndex} is not resident.`);
    this.name = "CssoccerExactPlayerAssetNotReadyError";
    this.slotId = slotId;
    this.localFrameIndex = localFrameIndex;
  }
}

export function createCssoccerExactActuaPlayerAssetRuntime({
  index,
  materials,
  loadChunk,
} = {}) {
  const configuration = assertIndexAndMaterials(index, materials);
  if (typeof loadChunk !== "function") {
    throw new TypeError("Exact Actua player assets require a checked chunk loader.");
  }
  const sequenceBySlot = new Map(index.sequences.map((sequence) => [sequence.slotId, sequence]));
  const cache = new Map();
  const recency = new Map();
  const pending = new Map();
  const counters = {
    requestCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cacheEvictionCount: 0,
    loadFailureCount: 0,
    decodedChunkCount: 0,
    decodedBytes: 0,
    sampleApplyCount: 0,
    unavailableStateCount: 0,
    fallbackStateCount: 0,
  };
  let disposed = false;
  let accessSequence = 0;

  const runtime = {
    schema: configuration.runtimeSchema,
    index,
    materials,
    preload,
    async preloadMany(requests) {
      requireAlive();
      if (!Array.isArray(requests)) {
        throw new TypeError("Exact Actua preloadMany requires an array.");
      }
      const uniqueAddresses = new Map();
      for (const request of requests) {
        const address = resolveAddress(sequenceBySlot, request);
        if (!uniqueAddresses.has(address.descriptor.path)) {
          uniqueAddresses.set(address.descriptor.path, address);
        }
      }
      const values = [...uniqueAddresses.values()];
      for (const address of values) markRecent(address.descriptor.path);
      for (let offset = 0; offset < values.length; offset += PRELOAD_CONCURRENCY) {
        await Promise.all(values.slice(offset, offset + PRELOAD_CONCURRENCY).map((address) => (
          preloadAddress(address, false)
        )));
      }
      return uniqueAddresses.size;
    },
    has(request) {
      requireAlive();
      const address = resolveAddress(sequenceBySlot, request);
      return cache.has(address.descriptor.path);
    },
    applySample(request, applyFace) {
      requireAlive();
      if (typeof applyFace !== "function") {
        throw new TypeError("Exact Actua sample application requires a face callback.");
      }
      const address = resolveAddress(sequenceBySlot, request);
      return applyResolvedSample(
        address,
        request.localFrameIndex,
        request.yawIndex,
        applyFace,
      );
    },
    applySampleFields(slotId, localFrameIndex, yawIndex, applyFace) {
      requireAlive();
      if (typeof applyFace !== "function") {
        throw new TypeError("Exact Actua sample application requires a face callback.");
      }
      const address = resolveAddressFields(sequenceBySlot, slotId, localFrameIndex);
      return applyResolvedSample(address, localFrameIndex, yawIndex, applyFace);
    },
    sample(request) {
      const faces = [];
      runtime.applySample(request, (
        faceIndex,
        transform,
        visible,
        materialSelectorOffset,
      ) => {
        faces.push({
          faceIndex,
          transform,
          visible,
          materialSelectorOffset,
        });
      });
      return faces;
    },
    stats() {
      return Object.freeze({
        ...counters,
        cacheEntries: cache.size,
        pendingLoads: pending.size,
        cacheLimit: index.cache.maxDecodedChunks,
        cachedPaths: Object.freeze([...cache.keys()].sort((left, right) => (
          recency.get(left) - recency.get(right)
        ))),
      });
    },
    dispose() {
      disposed = true;
      cache.clear();
      recency.clear();
      pending.clear();
      counters.decodedBytes = 0;
    },
  };
  return Object.freeze(runtime);

  function applyResolvedSample(address, localFrameIndex, yawValue, applyFace) {
      const decoded = resident(address.descriptor.path, true);
      if (!decoded) {
        counters.unavailableStateCount += 1;
        throw new CssoccerExactPlayerAssetNotReadyError(
          address.sequence.slotId,
          localFrameIndex,
        );
      }
      const yawIndex = requireYawIndex(yawValue);
      const sampleOffset = ((localFrameIndex - decoded.frameStart) * YAW_COUNT + yawIndex)
        * configuration.faceCount;
      for (let faceIndex = 0; faceIndex < configuration.faceCount; faceIndex += 1) {
        const offset = sampleOffset + faceIndex;
        const transformIndex = decoded.transformIndices[offset];
        const visible = transformIndex !== 0;
        applyFace(
          faceIndex,
          decoded.transformDictionary[transformIndex],
          visible,
          visible && decoded.selectors[offset] !== HIDDEN_SELECTOR
            ? decoded.selectors[offset]
            : null,
        );
      }
      counters.sampleApplyCount += 1;
      return true;
  }

  function preload(request) {
    requireAlive();
    const address = resolveAddress(sequenceBySlot, request);
    return preloadAddress(address, true);
  }

  function preloadAddress(address, markAccess) {
    const path = address.descriptor.path;
    if (markAccess) markRecent(path);
    const cached = resident(path, false);
    if (cached) {
      counters.cacheHitCount += 1;
      return Promise.resolve(path);
    }
    counters.cacheMissCount += 1;
    let promise = pending.get(path);
    if (!promise) {
      counters.requestCount += 1;
      promise = Promise.resolve().then(() => loadChunk(address.descriptor)).then((value) => {
        const decoded = decodeChunk(value, address.descriptor, index, configuration);
        cache.set(path, decoded);
        counters.decodedChunkCount += 1;
        counters.decodedBytes += decoded.decodedBytes;
        while (cache.size > index.cache.maxDecodedChunks) {
          const oldestPath = leastRecentPath(cache, recency);
          const oldest = cache.get(oldestPath);
          cache.delete(oldestPath);
          recency.delete(oldestPath);
          counters.cacheEvictionCount += 1;
          counters.decodedBytes -= oldest.decodedBytes;
        }
        return path;
      }).catch((error) => {
        counters.loadFailureCount += 1;
        if (!cache.has(path)) recency.delete(path);
        throw error;
      }).finally(() => {
        pending.delete(path);
      });
      pending.set(path, promise);
    }
    return promise;
  }

  function resident(path, markAccess) {
    const value = cache.get(path) ?? null;
    if (value && markAccess) markRecent(path);
    return value;
  }

  function markRecent(path) {
    accessSequence += 1;
    recency.set(path, accessSequence);
  }

  function requireAlive() {
    if (disposed) throw new Error("Exact Actua player asset runtime has been disposed.");
  }
}

function assertIndexAndMaterials(index, materials) {
  if (index?.schema === OFFICIAL_INDEX_SCHEMA) {
    if (
      index.status !== "ready-bounded-direct-index"
      || index.counts?.sequences !== OFFICIAL_SEQUENCE_COUNT
      || index.counts?.poseOccurrences !== OFFICIAL_POSE_COUNT
      || index.counts?.yawBins !== YAW_COUNT
      || index.counts?.samples !== OFFICIAL_SAMPLE_COUNT
      || index.counts?.facesPerSample !== OFFICIAL_FACE_COUNT
      || index.counts?.faceStates !== OFFICIAL_FACE_STATE_COUNT
      || index.counts?.chunks !== OFFICIAL_CHUNK_COUNT
      || index.lookup?.scanning !== false
      || index.cache?.policy !== "bounded-lru-transactional-frame-residency"
      || index.cache?.maxDecodedChunks !== OFFICIAL_CACHE_LIMIT
      || index.cache?.eagerWholeDomain !== false
      || index.cache?.eviction !== "least-recently-used-after-request-touch"
      || index.cache?.publication
        !== "requested frame commits only after every referenced chunk is resident"
      || !Array.isArray(index.sequences)
      || index.sequences.length !== OFFICIAL_SEQUENCE_COUNT
    ) throw new Error("Exact Actua official animation index is incomplete.");
    if (
      materials?.schema !== OFFICIAL_MATERIALS_SCHEMA
      || materials.status !== "ready-complete-two-official-profile-normalized-atlas"
      || materials.geometryId !== index.geometryId
      || materials.topologySha256 !== index.topologySha256
      || materials.counts?.profiles !== 2
      || materials.counts?.fixtureOfficials !== 3
      || !Number.isSafeInteger(materials.counts?.textureEntries)
      || materials.counts.textureEntries <= 0
      || materials.atlas?.requestCount !== 1
      || materials.runtime?.geometryMutation !== false
      || materials.runtime?.matrixMutationByMaterial !== false
      || materials.runtime?.missingMaterialPolicy !== "reject"
      || materials.runtime?.missingNumberPolicy !== "not-applicable"
    ) throw new Error("Exact Actua official material profiles are incomplete.");
    assertSequencePaths(index.sequences, {
      expectedPaths: OFFICIAL_CHUNK_COUNT,
      pathPattern:
        /^assets\/animation\/exact-official\/slot-(?:0(?:6[4-9]|7[0-3])|078)\/frames-[0-9]{3}-[0-9]{3}\.json$/u,
      label: "official",
    });
    return Object.freeze({
      runtimeSchema: OFFICIAL_RUNTIME_SCHEMA,
      chunkSchema: OFFICIAL_CHUNK_SCHEMA,
      faceCount: OFFICIAL_FACE_COUNT,
    });
  }
  if (
    index?.schema !== INDEX_SCHEMA
    || index.status !== "ready-bounded-direct-index"
    || index.counts?.sequences !== 124
    || index.counts?.poseOccurrences !== 5_857
    || index.counts?.yawBins !== YAW_COUNT
    || index.counts?.samples !== 140_568
    || index.counts?.faceStates !== 1_827_384
    || index.counts?.chunks !== 426
    || index.lookup?.scanning !== false
    || index.cache?.policy !== "bounded-lru-transactional-frame-residency"
    || index.cache?.maxDecodedChunks !== CACHE_LIMIT
    || index.cache?.eagerWholeDomain !== false
    || index.cache?.eviction !== "least-recently-used-after-request-touch"
    || index.cache?.publication
      !== "requested frame commits only after every referenced chunk is resident"
    || !Array.isArray(index.sequences)
    || index.sequences.length !== 124
  ) throw new Error("Exact Actua player animation index is incomplete.");
  if (
    materials?.schema !== MATERIALS_SCHEMA
    || materials.status !== "ready-complete-two-profile-normalized-atlas"
    || materials.geometryId !== index.geometryId
    || materials.topologySha256 !== index.topologySha256
    || materials.counts?.profiles !== 2
    || materials.counts?.fixturePlayers !== 22
    || materials.counts?.textureEntries !== 386
    || materials.atlas?.requestCount !== 1
    || materials.runtime?.geometryMutation !== false
    || materials.runtime?.matrixMutationByMaterial !== false
    || materials.runtime?.missingMaterialPolicy !== "reject"
    || materials.runtime?.missingNumberPolicy !== "reject"
  ) throw new Error("Exact Actua player material profiles are incomplete.");
  assertSequencePaths(index.sequences, {
    expectedPaths: 426,
    pathPattern:
      /^assets\/animation\/exact-player\/slot-[0-9]{3}\/frames-[0-9]{3}-[0-9]{3}\.json$/u,
    label: "player",
  });
  return Object.freeze({
    runtimeSchema: CSSOCCER_EXACT_ACTUA_PLAYER_ASSET_RUNTIME_SCHEMA,
    chunkSchema: CHUNK_SCHEMA,
    faceCount: FACE_COUNT,
  });
}

function assertSequencePaths(sequences, { expectedPaths, pathPattern, label }) {
  const paths = new Set();
  for (const sequence of sequences) {
    if (
      !Number.isSafeInteger(sequence.slotId)
      || !Number.isSafeInteger(sequence.frameCount)
      || sequence.frameCount <= 0
      || !Array.isArray(sequence.chunks)
      || sequence.chunks.length !== Math.ceil(sequence.frameCount / 16)
    ) throw new Error("Exact Actua player sequence index is invalid.");
    sequence.chunks.forEach((chunk, chunkIndex) => {
      if (
        chunk.slotId !== sequence.slotId
        || chunk.chunkIndex !== chunkIndex
        || !Number.isSafeInteger(chunk.frameStart)
        || !Number.isSafeInteger(chunk.frameEnd)
        || chunk.frameStart !== chunkIndex * 16
        || chunk.frameEnd <= chunk.frameStart
        || chunk.frameEnd > sequence.frameCount
        || !pathPattern.test(chunk.path ?? "")
        || paths.has(chunk.path)
      ) throw new Error(`Exact Actua ${label} chunk index is invalid.`);
      paths.add(chunk.path);
    });
  }
  if (paths.size !== expectedPaths) {
    throw new Error(`Exact Actua ${label} chunk paths are not total and unique.`);
  }
}

function resolveAddress(sequenceBySlot, request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new TypeError("Exact Actua player state address is invalid.");
  }
  return resolveAddressFields(sequenceBySlot, request.slotId, request.localFrameIndex);
}

function resolveAddressFields(sequenceBySlot, slotId, localFrameIndex) {
  const sequence = sequenceBySlot.get(slotId);
  if (
    !sequence
    || !Number.isSafeInteger(localFrameIndex)
    || localFrameIndex < 0
    || localFrameIndex >= sequence.frameCount
  ) throw new RangeError(`Exact Actua player state ${slotId}:${localFrameIndex} is unavailable.`);
  const chunkIndex = Math.floor(localFrameIndex / sequence.chunkFrameLimit);
  const descriptor = sequence.chunks[chunkIndex];
  if (!descriptor
      || localFrameIndex < descriptor.frameStart
      || localFrameIndex >= descriptor.frameEnd) {
    throw new Error("Exact Actua direct chunk lookup changed.");
  }
  return { sequence, descriptor };
}

function requireYawIndex(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= YAW_COUNT) {
    throw new RangeError("Exact Actua yaw index must be inside 0..23.");
  }
  return value;
}

function leastRecentPath(cache, recency) {
  let selected = null;
  let selectedSequence = Infinity;
  for (const path of cache.keys()) {
    const sequence = recency.get(path);
    if (!Number.isSafeInteger(sequence)) {
      throw new Error(`Exact Actua player cache path ${path} has no deterministic recency.`);
    }
    if (sequence < selectedSequence) {
      selected = path;
      selectedSequence = sequence;
    }
  }
  if (selected === null) throw new Error("Exact Actua player cache eviction has no candidate.");
  return selected;
}

function decodeChunk(chunk, descriptor, index, configuration) {
  if (
    !chunk
    || chunk.schema !== configuration.chunkSchema
    || chunk.geometryId !== index.geometryId
    || chunk.topologySha256 !== index.topologySha256
    || chunk.slotId !== descriptor.slotId
    || chunk.chunkIndex !== descriptor.chunkIndex
    || chunk.frameStart !== descriptor.frameStart
    || chunk.frameEnd !== descriptor.frameEnd
    || chunk.frameCount !== descriptor.frameCount
    || chunk.yawCount !== YAW_COUNT
    || chunk.faceCount !== configuration.faceCount
    || !Array.isArray(chunk.transformDictionary)
    || chunk.transformDictionary.length !== descriptor.transformDictionaryEntries
    || chunk.transformIndex?.widthBits !== descriptor.transformIndexWidthBits
    || chunk.transformIndex?.count !== descriptor.faceStateCount
    || chunk.materialSelectorOffset?.count !== descriptor.faceStateCount
  ) throw new Error(`Exact Actua player chunk ${descriptor.path} failed validation.`);
  const indexBytes = decodeBase64(chunk.transformIndex.data);
  const expectedIndexBytes = descriptor.faceStateCount * (chunk.transformIndex.widthBits / 8);
  const selectorBytes = decodeBase64(chunk.materialSelectorOffset.data);
  if (indexBytes.byteLength !== expectedIndexBytes
      || selectorBytes.byteLength !== descriptor.faceStateCount) {
    throw new Error(`Exact Actua player chunk ${descriptor.path} byte count changed.`);
  }
  const transformIndices = chunk.transformIndex.widthBits === 16
    ? uint16LittleEndian(indexBytes)
    : uint32LittleEndian(indexBytes);
  const selectors = new Int8Array(
    selectorBytes.buffer,
    selectorBytes.byteOffset,
    selectorBytes.byteLength,
  );
  for (const transformIndex of transformIndices) {
    if (transformIndex >= chunk.transformDictionary.length) {
      throw new Error(`Exact Actua player chunk ${descriptor.path} has an invalid transform index.`);
    }
  }
  return Object.freeze({
    path: descriptor.path,
    frameStart: descriptor.frameStart,
    frameEnd: descriptor.frameEnd,
    transformDictionary: Object.freeze([...chunk.transformDictionary]),
    transformIndices,
    selectors,
    decodedBytes: descriptor.bytes + indexBytes.byteLength + selectorBytes.byteLength,
  });
}

function decodeBase64(value) {
  if (typeof value !== "string" || typeof globalThis.atob !== "function") {
    throw new Error("Exact Actua player chunk requires browser base64 decoding.");
  }
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function uint16LittleEndian(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const output = new Uint16Array(bytes.byteLength / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = view.getUint16(index * 2, true);
  }
  return output;
}

function uint32LittleEndian(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const output = new Uint32Array(bytes.byteLength / 4);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = view.getUint32(index * 4, true);
  }
  return output;
}

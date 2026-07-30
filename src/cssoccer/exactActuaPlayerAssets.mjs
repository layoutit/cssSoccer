export const CSSOCCER_EXACT_ACTUA_PLAYER_ASSET_RUNTIME_SCHEMA =
  "cssoccer-exact-actua-player-asset-runtime@1";

const INDEX_SCHEMA = "cssoccer-exact-actua-player-animation-index@1";
const CHUNK_SCHEMA = "cssoccer-exact-actua-player-animation-chunk@1";
const MATERIALS_SCHEMA = "cssoccer-exact-actua-player-materials@1";
const RASTER_SCHEMA = "cssoccer-exact-actua-player-raster-atlas@1";
const OFFICIAL_INDEX_SCHEMA = "cssoccer-exact-actua-official-animation-index@1";
const OFFICIAL_CHUNK_SCHEMA = "cssoccer-exact-actua-official-animation-chunk@1";
const OFFICIAL_MATERIALS_SCHEMA = "cssoccer-exact-actua-official-materials@1";
const OFFICIAL_RUNTIME_SCHEMA = "cssoccer-exact-actua-official-asset-runtime@1";
const YAW_COUNT = 24;
const FACE_COUNT = 13;
const PLAYER_COORDINATE_COUNT = 28 * 3;
const RASTER_ENTRY_WORDS = 6;
const HIDDEN_SELECTOR = -128;
const PRELOAD_CONCURRENCY = 6;
const CACHE_LIMIT = 24;
const OFFICIAL_FACE_COUNT = 12;
const OFFICIAL_CACHE_LIMIT = 6;
const OFFICIAL_SEQUENCE_COUNT = 11;
const OFFICIAL_POSE_COUNT = 312;
const OFFICIAL_MIRRORED_SEQUENCE_COUNT = 3;
const OFFICIAL_POSE_COORDINATE_COUNT = OFFICIAL_POSE_COUNT * PLAYER_COORDINATE_COUNT;
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
    rasterSampleApplyCount: 0,
    rasterUnavailableCount: 0,
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
        request.geometryVariant ?? "outfield",
        applyFace,
      );
    },
    applySampleFields(slotId, localFrameIndex, yawIndex, applyFace) {
      requireAlive();
      if (typeof applyFace !== "function") {
        throw new TypeError("Exact Actua sample application requires a face callback.");
      }
      const address = resolveAddressFields(sequenceBySlot, slotId, localFrameIndex);
      return applyResolvedSample(
        address,
        localFrameIndex,
        yawIndex,
        "outfield",
        applyFace,
      );
    },
    applyVariantSampleFields(
      slotId,
      localFrameIndex,
      yawIndex,
      geometryVariant,
      applyFace,
    ) {
      requireAlive();
      if (typeof applyFace !== "function") {
        throw new TypeError("Exact Actua sample application requires a face callback.");
      }
      const address = resolveAddressFields(sequenceBySlot, slotId, localFrameIndex);
      return applyResolvedSample(
        address,
        localFrameIndex,
        yawIndex,
        geometryVariant,
        applyFace,
      );
    },
    applyRasterSampleFields(
      slotId,
      localFrameIndex,
      yawIndex,
      materialProfileId,
      shirtNumber,
      applySprite,
    ) {
      requireAlive();
      if (typeof applySprite !== "function") {
        throw new TypeError("Exact Actua raster sample application requires a sprite callback.");
      }
      const address = resolveAddressFields(sequenceBySlot, slotId, localFrameIndex);
      const decoded = resident(address.descriptor.path, true);
      if (!decoded) {
        counters.unavailableStateCount += 1;
        throw new CssoccerExactPlayerAssetNotReadyError(
          address.sequence.slotId,
          localFrameIndex,
        );
      }
      if (decoded.rasterAtlas === null) {
        counters.rasterUnavailableCount += 1;
        return false;
      }
      decoded.rasterAtlas.applySample(
        localFrameIndex,
        requireYawIndex(yawIndex),
        materialProfileId,
        shirtNumber,
        applySprite,
      );
      counters.rasterSampleApplyCount += 1;
      return true;
    },
    poseCoordinatesFields(slotId, localFrameIndex) {
      requireAlive();
      const address = resolveAddressFields(sequenceBySlot, slotId, localFrameIndex);
      const decoded = resident(address.descriptor.path, true);
      if (!decoded) {
        counters.unavailableStateCount += 1;
        throw new CssoccerExactPlayerAssetNotReadyError(
          address.sequence.slotId,
          localFrameIndex,
        );
      }
      const offset = (localFrameIndex - decoded.frameStart) * PLAYER_COORDINATE_COUNT;
      return decoded.poseCoordinates.subarray(offset, offset + PLAYER_COORDINATE_COUNT);
    },
    projectionTopologyFields(slotId, geometryVariant) {
      requireAlive();
      const sequence = sequenceBySlot.get(slotId);
      const direct = materials.geometryVariants?.[geometryVariant];
      const topology = sequence?.mirrored ? direct?.mirrored ?? direct : direct;
      if (
        !sequence
        || !topology
        || topology.pointCount !== 28
        || topology.faceCount !== configuration.faceCount
        || topology.faces?.length !== configuration.faceCount
      ) {
        throw new Error(
          `Exact Actua ${String(geometryVariant)} topology is unavailable for slot ${slotId}.`,
        );
      }
      return topology;
    },
    projectionSequenceMirroredFields(slotId) {
      requireAlive();
      const sequence = sequenceBySlot.get(slotId);
      if (!sequence || typeof sequence.mirrored !== "boolean") {
        throw new Error(`Exact Actua mirror state is unavailable for slot ${slotId}.`);
      }
      return sequence.mirrored;
    },
    projectionTweenBaselineFields() {
      requireAlive();
      if (configuration.runtimeSchema === CSSOCCER_EXACT_ACTUA_PLAYER_ASSET_RUNTIME_SCHEMA) {
        return runtime.poseCoordinatesFields(0, 0);
      }
      const coordinates = materials.tweenBaseline?.coordinates;
      if (
        !Array.isArray(coordinates)
        || coordinates.length !== PLAYER_COORDINATE_COUNT
        || coordinates.some((coordinate) => !Number.isFinite(coordinate))
      ) {
        throw new Error("Exact Actua official renderer tween baseline is unavailable.");
      }
      return new Float32Array(coordinates);
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

  function applyResolvedSample(
    address,
    localFrameIndex,
    yawValue,
    geometryVariant,
    applyFace,
  ) {
      const decoded = resident(address.descriptor.path, true);
      if (!decoded) {
        counters.unavailableStateCount += 1;
        throw new CssoccerExactPlayerAssetNotReadyError(
          address.sequence.slotId,
          localFrameIndex,
        );
      }
      const yawIndex = requireYawIndex(yawValue);
      const variant = decoded.geometryVariants[geometryVariant];
      if (!variant) {
        throw new Error(
          `Exact Actua geometry variant ${String(geometryVariant)} is unavailable.`,
        );
      }
      const sampleOffset = ((localFrameIndex - decoded.frameStart) * YAW_COUNT + yawIndex)
        * configuration.faceCount;
      for (let faceIndex = 0; faceIndex < configuration.faceCount; faceIndex += 1) {
        const offset = sampleOffset + faceIndex;
        const transformIndex = variant.transformIndices[offset];
        const visible = transformIndex !== 0;
        applyFace(
          faceIndex,
          variant.transformDictionary[transformIndex],
          visible,
          visible && variant.selectors[offset] !== HIDDEN_SELECTOR
            ? variant.selectors[offset]
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
      || index.counts?.mirroredSequences !== OFFICIAL_MIRRORED_SEQUENCE_COUNT
      || index.counts?.poseCoordinates !== OFFICIAL_POSE_COORDINATE_COUNT
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
      || materials.counts?.geometryVariants !== 1
      || materials.counts?.fixtureOfficials !== 3
      || materials.geometryVariants?.outfield?.pointCount !== 28
      || materials.geometryVariants.outfield.faceCount !== OFFICIAL_FACE_COUNT
      || materials.geometryVariants.outfield.faces?.length !== OFFICIAL_FACE_COUNT
      || materials.tweenBaseline?.coordinateCount !== PLAYER_COORDINATE_COUNT
      || materials.tweenBaseline.coordinates?.length !== PLAYER_COORDINATE_COUNT
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
      expectedMirroredSequences: OFFICIAL_MIRRORED_SEQUENCE_COUNT,
      pathPattern:
        /^assets\/animation\/exact-official\/slot-(?:0(?:6[4-9]|7[0-3])|078)\/frames-[0-9]{3}-[0-9]{3}\.json$/u,
      label: "official",
    });
    return Object.freeze({
      runtimeSchema: OFFICIAL_RUNTIME_SCHEMA,
      chunkSchema: OFFICIAL_CHUNK_SCHEMA,
      faceCount: OFFICIAL_FACE_COUNT,
      poseCoordinates: true,
    });
  }
  if (
    index?.schema !== INDEX_SCHEMA
    || index.status !== "ready-bounded-direct-index"
    || index.counts?.sequences !== 124
    || index.counts?.poseOccurrences !== 5_857
    || index.counts?.mirroredSequences !== 30
    || index.counts?.yawBins !== YAW_COUNT
    || index.counts?.samples !== 140_568
    || index.counts?.geometryVariants !== 2
    || index.counts?.variantSamples !== 281_136
    || index.counts?.faceStates !== 1_827_384
    || index.counts?.variantFaceStates !== 3_654_768
    || index.counts?.poseCoordinates !== 491_988
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
    || materials.status
      !== "ready-complete-four-profile-two-geometry-normalized-atlas"
    || materials.geometryId !== index.geometryId
    || materials.topologySha256 !== index.topologySha256
    || materials.counts?.profiles !== 4
    || materials.counts?.geometryVariants !== 2
    || materials.counts?.fixturePlayers !== 22
    || materials.counts?.textureEntries !== 562
    || materials.geometryVariants?.outfield?.geometryId !== index.geometryId
    || materials.geometryVariants.outfield.topologySha256 !== index.topologySha256
    || materials.geometryVariants.outfield.mirrored?.faceCount !== FACE_COUNT
    || materials.geometryVariants.outfield.mirrored?.faces?.length !== FACE_COUNT
    || materials.geometryVariants?.goalkeeper?.geometryId
      !== "actua-goalkeeper-28p-13f-one-basis"
    || materials.geometryVariants.goalkeeper.mirrored?.faceCount !== FACE_COUNT
    || materials.geometryVariants.goalkeeper.mirrored?.faces?.length !== FACE_COUNT
    || materials.atlas?.requestCount !== 1
    || materials.runtime?.geometryMutation !== false
    || materials.runtime?.matrixMutationByMaterial !== false
    || materials.runtime?.missingMaterialPolicy !== "reject"
    || materials.runtime?.missingNumberPolicy !== "reject"
  ) throw new Error("Exact Actua player material profiles are incomplete.");
  assertSequencePaths(index.sequences, {
    expectedPaths: 426,
    expectedMirroredSequences: 30,
    pathPattern:
      /^assets\/animation\/exact-player\/slot-[0-9]{3}\/frames-[0-9]{3}-[0-9]{3}\.json$/u,
    label: "player",
  });
  return Object.freeze({
    runtimeSchema: CSSOCCER_EXACT_ACTUA_PLAYER_ASSET_RUNTIME_SCHEMA,
    chunkSchema: CHUNK_SCHEMA,
    faceCount: FACE_COUNT,
    poseCoordinates: true,
  });
}

function assertSequencePaths(sequences, {
  expectedPaths,
  expectedMirroredSequences = null,
  pathPattern,
  label,
}) {
  const paths = new Set();
  let mirroredSequences = 0;
  for (const sequence of sequences) {
    if (
      !Number.isSafeInteger(sequence.slotId)
      || !Number.isSafeInteger(sequence.frameCount)
      || sequence.frameCount <= 0
      || (
        expectedMirroredSequences !== null
        && typeof sequence.mirrored !== "boolean"
      )
      || !Array.isArray(sequence.chunks)
      || sequence.chunks.length !== Math.ceil(sequence.frameCount / 16)
    ) throw new Error("Exact Actua player sequence index is invalid.");
    if (sequence.mirrored === true) mirroredSequences += 1;
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
  if (
    expectedMirroredSequences !== null
    && mirroredSequences !== expectedMirroredSequences
  ) {
    throw new Error(
      `Exact Actua ${label} mirrored sequence count changed.`,
    );
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
    || (
      configuration.poseCoordinates
      && (
        descriptor.poseCoordinateCount !== descriptor.frameCount * PLAYER_COORDINATE_COUNT
        || chunk.poseCoordinates?.encoding !== "base64-float32le"
        || chunk.poseCoordinates?.pointCount !== 28
        || chunk.poseCoordinates?.coordinateCountPerFrame !== PLAYER_COORDINATE_COUNT
        || chunk.poseCoordinates?.frameCount !== descriptor.frameCount
        || chunk.poseCoordinates?.count !== descriptor.poseCoordinateCount
      )
    )
  ) throw new Error(`Exact Actua player chunk ${descriptor.path} failed validation.`);
  const outfield = decodeChunkGeometryVariant({
    transformDictionary: chunk.transformDictionary,
    transformIndex: chunk.transformIndex,
    materialSelectorOffset: chunk.materialSelectorOffset,
  }, descriptor.faceStateCount, descriptor.path);
  const geometryVariants = { outfield };
  if (configuration.runtimeSchema === CSSOCCER_EXACT_ACTUA_PLAYER_ASSET_RUNTIME_SCHEMA) {
    if (
      chunk.geometryVariantCount !== 2
      || chunk.geometryVariants?.outfield?.storage !== "top-level"
      || chunk.geometryVariants.outfield.geometryId !== chunk.geometryId
      || chunk.geometryVariants.outfield.topologySha256 !== chunk.topologySha256
      || chunk.geometryVariants?.goalkeeper?.storage !== "inline"
      || chunk.geometryVariants.goalkeeper.geometryId
        !== "actua-goalkeeper-28p-13f-one-basis"
    ) {
      throw new Error(
        `Exact Actua player chunk ${descriptor.path} lost its geometry variants.`,
      );
    }
    geometryVariants.goalkeeper = decodeChunkGeometryVariant(
      chunk.geometryVariants.goalkeeper,
      descriptor.faceStateCount,
      descriptor.path,
    );
  }
  const rasterAtlas = decodeRasterAtlas(
    chunk.rasterAtlas ?? null,
    descriptor.rasterAtlas ?? null,
    descriptor,
    configuration,
  );
  const poseCoordinates = configuration.poseCoordinates
    ? float32LittleEndian(decodeBase64(chunk.poseCoordinates.data))
    : null;
  if (
    poseCoordinates !== null
    && poseCoordinates.length !== descriptor.poseCoordinateCount
  ) {
    throw new Error(`Exact Actua player chunk ${descriptor.path} pose byte count changed.`);
  }
  return Object.freeze({
    path: descriptor.path,
    frameStart: descriptor.frameStart,
    frameEnd: descriptor.frameEnd,
    geometryVariants: Object.freeze(geometryVariants),
    poseCoordinates,
    rasterAtlas,
    decodedBytes: descriptor.bytes
      + Object.values(geometryVariants).reduce(
        (sum, variant) => sum + variant.decodedBytes,
        0,
      )
      + (poseCoordinates?.byteLength ?? 0)
      + (rasterAtlas?.decodedBytes ?? 0),
  });
}

function decodeChunkGeometryVariant(value, expectedCount, chunkPath) {
  if (
    !Array.isArray(value?.transformDictionary)
    || value.transformDictionary[0]
      !== "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,-10000,1)"
    || !new Set([16, 32]).has(value.transformIndex?.widthBits)
    || value.transformIndex.count !== expectedCount
    || value.materialSelectorOffset?.count !== expectedCount
  ) throw new Error(`Exact Actua player chunk ${chunkPath} variant is invalid.`);
  const indexBytes = decodeBase64(value.transformIndex.data);
  const expectedIndexBytes = expectedCount * (value.transformIndex.widthBits / 8);
  const selectorBytes = decodeBase64(value.materialSelectorOffset.data);
  if (
    indexBytes.byteLength !== expectedIndexBytes
    || selectorBytes.byteLength !== expectedCount
  ) throw new Error(`Exact Actua player chunk ${chunkPath} byte count changed.`);
  const transformIndices = value.transformIndex.widthBits === 16
    ? uint16LittleEndian(indexBytes)
    : uint32LittleEndian(indexBytes);
  const selectors = new Int8Array(
    selectorBytes.buffer,
    selectorBytes.byteOffset,
    selectorBytes.byteLength,
  );
  for (const transformIndex of transformIndices) {
    if (transformIndex >= value.transformDictionary.length) {
      throw new Error(
        `Exact Actua player chunk ${chunkPath} has an invalid transform index.`,
      );
    }
  }
  return Object.freeze({
    transformDictionary: Object.freeze([...value.transformDictionary]),
    transformIndices,
    selectors,
    decodedBytes: indexBytes.byteLength + selectorBytes.byteLength,
  });
}

function decodeRasterAtlas(value, descriptor, chunkDescriptor, configuration) {
  if (value === null && descriptor === null) return null;
  if (
    configuration.runtimeSchema !== CSSOCCER_EXACT_ACTUA_PLAYER_ASSET_RUNTIME_SCHEMA
    || value?.schema !== RASTER_SCHEMA
    || value.status !== "ready-whole-player-indexed-raster"
    || descriptor?.status !== value.status
    || value.viewport?.width !== 640
    || value.viewport?.height !== 400
    || value.sampleCount !== chunkDescriptor.frameCount * YAW_COUNT
    || !Array.isArray(value.profileIds)
    || value.profileIds.length !== 4
    || new Set(value.profileIds).size !== value.profileIds.length
    || !Array.isArray(value.shirtNumbers)
    || value.shirtNumbers.length !== 11
    || value.shirtNumbers.some((number, index) => number !== index + 1)
    || value.baseNumber !== null
    || value.referenceNumber !== 10
    || value.runtime?.leavesPerPlayer !== 2
    || value.runtime?.canvas !== false
    || value.runtime?.webgl !== false
    || value.runtime?.geometryConstruction !== false
  ) {
    throw new Error(`Exact Actua player chunk ${chunkDescriptor.path} raster atlas is invalid.`);
  }
  const base = decodeRasterLayer(value.base, descriptor.base, {
    count: value.profileIds.length * value.sampleCount,
    label: "base",
    chunkPath: chunkDescriptor.path,
  });
  const numberDelta = decodeRasterLayer(value.numberDelta, descriptor.numberDelta, {
    count: value.profileIds.length * value.sampleCount * value.shirtNumbers.length,
    label: "number delta",
    chunkPath: chunkDescriptor.path,
  });
  const profileIndexById = new Map(
    value.profileIds.map((profileId, index) => [profileId, index]),
  );
  const numberIndexByValue = new Map(
    value.shirtNumbers.map((number, index) => [number, index]),
  );
  return Object.freeze({
    decodedBytes: base.entries.byteLength + numberDelta.entries.byteLength,
    applySample(
      localFrameIndex,
      yawIndex,
      materialProfileId,
      shirtNumber,
      applySprite,
    ) {
      const profileIndex = profileIndexById.get(materialProfileId);
      const numberIndex = numberIndexByValue.get(shirtNumber);
      if (profileIndex === undefined || numberIndex === undefined) {
        throw new Error(
          `Exact Actua raster binding ${String(materialProfileId)}:${String(shirtNumber)} is invalid.`,
        );
      }
      const sampleIndex = (
        (localFrameIndex - chunkDescriptor.frameStart) * YAW_COUNT + yawIndex
      );
      const baseOffset = (
        profileIndex * value.sampleCount + sampleIndex
      ) * RASTER_ENTRY_WORDS;
      const deltaOffset = (
        (
          profileIndex * value.sampleCount * value.shirtNumbers.length
          + sampleIndex * value.shirtNumbers.length
          + numberIndex
        ) * RASTER_ENTRY_WORDS
      );
      applyRasterLayer("base", base, baseOffset, applySprite);
      applyRasterLayer("numberDelta", numberDelta, deltaOffset, applySprite);
    },
  });
}

function decodeRasterLayer(value, descriptor, { count, label, chunkPath }) {
  if (
    !value?.asset
    || value.asset.path !== descriptor?.path
    || value.asset.sha256 !== descriptor?.sha256
    || value.asset.width !== descriptor?.width
    || value.asset.height !== descriptor?.height
    || value.asset.url !== descriptor?.url
    || !Number.isSafeInteger(value.asset.width)
    || value.asset.width <= 0
    || !Number.isSafeInteger(value.asset.height)
    || value.asset.height <= 0
    || value.entries?.encoding !== "base64-uint16le"
    || value.entries.entryWords !== RASTER_ENTRY_WORDS
    || value.entries.count !== count
  ) {
    throw new Error(`Exact Actua ${label} raster ${chunkPath} is invalid.`);
  }
  const bytes = decodeBase64(value.entries.data);
  if (bytes.byteLength !== count * RASTER_ENTRY_WORDS * 2) {
    throw new Error(`Exact Actua ${label} raster ${chunkPath} byte count changed.`);
  }
  return Object.freeze({
    asset: Object.freeze({ ...value.asset }),
    entries: uint16LittleEndian(bytes),
  });
}

function applyRasterLayer(kind, layer, offset, applySprite) {
  const entries = layer.entries;
  const width = entries[offset + 2];
  const height = entries[offset + 3];
  applySprite(
    kind,
    layer.asset.url,
    layer.asset.width,
    layer.asset.height,
    entries[offset],
    entries[offset + 1],
    width,
    height,
    entries[offset + 4],
    entries[offset + 5],
  );
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

function float32LittleEndian(bytes) {
  if (bytes.byteLength % 4 !== 0) {
    throw new Error("Exact Actua player pose byte count is not float32-aligned.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const output = new Float32Array(bytes.byteLength / 4);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = view.getFloat32(index * 4, true);
  }
  return output;
}

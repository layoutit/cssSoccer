import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CssoccerExactPlayerAssetNotReadyError,
  createCssoccerExactActuaPlayerAssetRuntime,
} from "../src/cssoccer/exactActuaPlayerAssets.mjs";

const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const index = readJson("assets/animation/exact-player/index.json");
const materials = readJson("assets/spain-argentina-exact-player-materials.json");

test("a delayed 22-player frame commits once, only after every exact state is resident", async () => {
  const waiting = [];
  const runtime = createCssoccerExactActuaPlayerAssetRuntime({
    index,
    materials,
    loadChunk(descriptor) {
      return new Promise((resolve) => {
        waiting.push({ descriptor, resolve });
      });
    },
  });
  const requested = distinctChunkRequests(22, 17);
  const initialPublication = Object.freeze({
    matchIdentity: "same-browser-owned-match",
    tick: 40,
    appliedKeys: Object.freeze(["previous-exact-frame"]),
  });
  let publication = initialPublication;
  const transaction = runtime.preloadMany(requested).then(() => {
    const appliedKeys = requested.map((request) => {
      const faces = runtime.sample(request);
      assert.equal(faces.length, 13);
      return stateKey(request);
    });
    publication = Object.freeze({
      matchIdentity: initialPublication.matchIdentity,
      tick: initialPublication.tick + 1,
      appliedKeys: Object.freeze(appliedKeys),
    });
  });

  for (const expectedBatchSize of [6, 6, 6]) {
    await waitFor(() => waiting.length === expectedBatchSize);
    assert.strictEqual(publication, initialPublication);
    assert.throws(
      () => runtime.sample(requested.at(-1)),
      CssoccerExactPlayerAssetNotReadyError,
    );
    releaseWaiting(waiting);
  }
  await waitFor(() => waiting.length === 4);
  assert.strictEqual(publication, initialPublication);
  assert.equal(runtime.stats().fallbackStateCount, 0);
  releaseWaiting(waiting);
  await transaction;

  assert.deepEqual(publication, {
    matchIdentity: "same-browser-owned-match",
    tick: 41,
    appliedKeys: requested.map(stateKey),
  });
  const stats = runtime.stats();
  assert.equal(stats.requestCount, 22);
  assert.equal(stats.decodedChunkCount, 22);
  assert.equal(stats.cacheEntries, 22);
  assert.equal(stats.cacheLimit, 24);
  assert.equal(stats.cacheEvictionCount, 0);
  assert.equal(stats.fallbackStateCount, 0);
  assert.equal(stats.loadFailureCount, 0);
  assert.equal(stats.decodedBytes, decodedByteBound(requested));
  assert.ok(stats.requestCount < index.counts.chunks, "route frame must not load the full domain");
});

test("the 24-chunk LRU is request-ordered even when network completion is reversed", async () => {
  const waiting = [];
  const runtime = createCssoccerExactActuaPlayerAssetRuntime({
    index,
    materials,
    loadChunk(descriptor) {
      return new Promise((resolve) => waiting.push({ descriptor, resolve }));
    },
  });
  const requested = distinctChunkRequests(26, 0);
  const firstSweep = runtime.preloadMany(requested.slice(0, 25));
  for (const expectedBatchSize of [6, 6, 6, 6, 1]) {
    await waitFor(() => waiting.length === expectedBatchSize);
    releaseWaiting(waiting, { reverse: true });
  }
  await firstSweep;

  const paths = requested.map(requestPath);
  assert.deepEqual(runtime.stats().cachedPaths, paths.slice(1, 25));
  assert.equal(runtime.has(requested[0]), false);
  assert.equal(runtime.stats().cacheEntries, 24);
  assert.equal(runtime.stats().cacheEvictionCount, 1);

  await runtime.preload(requested[1]);
  const lastLoad = runtime.preload(requested[25]);
  await waitFor(() => waiting.length === 1);
  releaseWaiting(waiting);
  await lastLoad;
  assert.deepEqual(runtime.stats().cachedPaths, [
    ...paths.slice(3, 25),
    paths[1],
    paths[25],
  ]);
  assert.equal(runtime.has(requested[1]), true);
  assert.equal(runtime.has(requested[2]), false);
  assert.equal(runtime.stats().cacheEntries, 24);
  assert.equal(runtime.stats().cacheEvictionCount, 2);
});

test("construction is cold and missing or corrupt sidecars fail without fallback", async () => {
  let loadCount = 0;
  const missing = createCssoccerExactActuaPlayerAssetRuntime({
    index,
    materials,
    loadChunk() {
      loadCount += 1;
      throw new Error("deliberate missing sidecar");
    },
  });
  assert.equal(loadCount, 0);
  assert.equal(missing.stats().cacheEntries, 0);
  assert.equal(missing.stats().fallbackStateCount, 0);
  await assert.rejects(missing.preload(distinctChunkRequests(1, 0)[0]), /missing sidecar/u);
  assert.equal(loadCount, 1);
  assert.equal(missing.stats().loadFailureCount, 1);
  assert.equal(missing.stats().cacheEntries, 0);
  assert.equal(missing.stats().fallbackStateCount, 0);

  const corrupt = createCssoccerExactActuaPlayerAssetRuntime({
    index,
    materials,
    loadChunk(descriptor) {
      return { ...readJson(descriptor.path), slotId: descriptor.slotId + 1 };
    },
  });
  await assert.rejects(corrupt.preload(distinctChunkRequests(1, 0)[0]), /failed validation/u);
  assert.equal(corrupt.stats().loadFailureCount, 1);
  assert.equal(corrupt.stats().cacheEntries, 0);
  assert.equal(corrupt.stats().fallbackStateCount, 0);
  assert.equal(index.cache.eagerWholeDomain, false);
});

function distinctChunkRequests(count, preferredFrame) {
  return index.sequences
    .filter(({ frameCount }) => frameCount > 1)
    .slice(0, count)
    .map((sequence, yawIndex) => ({
      slotId: sequence.slotId,
      localFrameIndex: Math.min(preferredFrame, sequence.frameCount - 1),
      yawIndex: yawIndex % 24,
    }));
}

function requestDescriptor(request) {
  const sequence = index.sequences.find(({ slotId }) => slotId === request.slotId);
  return sequence.chunks[Math.floor(request.localFrameIndex / sequence.chunkFrameLimit)];
}

function requestPath(request) {
  return requestDescriptor(request).path;
}

function decodedByteBound(requests) {
  return requests.reduce((sum, request) => {
    const descriptor = requestDescriptor(request);
    return sum + descriptor.bytes
      + descriptor.faceStateCount * (descriptor.transformIndexWidthBits / 8)
      + descriptor.faceStateCount;
  }, 0);
}

function stateKey({ slotId, localFrameIndex, yawIndex }) {
  return `${slotId}:${localFrameIndex}:${yawIndex}`;
}

function releaseWaiting(waiting, { reverse = false } = {}) {
  const batch = waiting.splice(0);
  if (reverse) batch.reverse();
  for (const { descriptor, resolve } of batch) resolve(readJson(descriptor.path));
}

async function waitFor(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for exact-player sidecars.");
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, generatedRoot), "utf8"));
}

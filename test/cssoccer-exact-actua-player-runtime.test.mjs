import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Window } from "happy-dom";

import {
  CssoccerExactPlayerAssetNotReadyError,
  createCssoccerExactActuaPlayerAssetRuntime,
} from "../src/cssoccer/exactActuaPlayerAssets.mjs";
import { mountExactActuaPlayerMesh } from "../src/cssoccer/exactActuaPlayerMesh.mjs";

const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const index = readJson("assets/animation/exact-player/index.json");
const materials = readJson("assets/spain-argentina-exact-player-materials.json");

test("cold exact states remain explicit until their checked sidecar is resident", async () => {
  let release;
  const runtime = createCssoccerExactActuaPlayerAssetRuntime({
    index,
    materials,
    loadChunk(descriptor) {
      return new Promise((resolve) => {
        release = () => resolve(readJson(descriptor.path));
      });
    },
  });
  const state = { slotId: 78, localFrameIndex: 0, yawIndex: 0 };
  assert.throws(() => runtime.sample(state), CssoccerExactPlayerAssetNotReadyError);
  const pending = runtime.preload(state);
  await Promise.resolve();
  assert.equal(runtime.has(state), false);
  assert.equal(typeof release, "function");
  release();
  await pending;
  assert.equal(runtime.has(state), true);
  const faces = runtime.sample(state);
  assert.equal(faces.length, 13);
  assert.ok(faces.every(({ transform }) => (
    typeof transform === "string" && !/NaN|Infinity/u.test(transform)
  )));
  assert.deepEqual(runtime.stats(), {
    requestCount: 1,
    cacheHitCount: 0,
    cacheMissCount: 1,
    cacheEvictionCount: 0,
    loadFailureCount: 0,
    decodedChunkCount: 1,
    decodedBytes: runtime.stats().decodedBytes,
    sampleApplyCount: 1,
    unavailableStateCount: 1,
    fallbackStateCount: 0,
    cacheEntries: 1,
    pendingLoads: 0,
    cacheLimit: 24,
    cachedPaths: ["assets/animation/exact-player/slot-078/frames-000-016.json"],
  });
  assert.ok(runtime.stats().decodedBytes > 0);
});

test("22-player mesh primitive keeps 13 identities and applies exact slot, frame, and yaw", async () => {
  const runtime = fileRuntime();
  await runtime.preload({ slotId: 78, localFrameIndex: 4 });
  const window = new Window();
  const root = window.document.createElement("div");
  window.document.body.append(root);
  const mesh = mountExactActuaPlayerMesh({
    root,
    assetRuntime: runtime,
    materialProfileId: "argentina-player-material",
    shirtNumber: 10,
    initialState: { slotId: 78, localFrameIndex: 4, yawIndex: 6 },
  });
  const identities = [...mesh.leaves];
  assert.equal(mesh.leaves.length, 13);
  assert.equal(root.children.length, 13);
  const beforeRepeatedState = mesh.stats();
  assert.equal(mesh.updateState({ slotId: 78, localFrameIndex: 4, yawIndex: 6 }), false);
  const afterRepeatedState = mesh.stats();
  for (const key of [
    "transformWrites",
    "backgroundPositionXWrites",
    "backgroundPositionYWrites",
    "visibilityWrites",
  ]) assert.equal(afterRepeatedState[key], beforeRepeatedState[key]);
  assert.equal(mesh.updateState({ slotId: 78, localFrameIndex: 5, yawIndex: 6 }), true);
  assert.deepEqual([...mesh.leaves], identities);
  assert.equal(root.children.length, 13);
  assert.equal(mesh.leaves[12].style.visibility, "hidden");
  assert.ok(mesh.leaves.every((leaf) => !/NaN|Infinity/u.test(leaf.style.transform)));
  const stats = mesh.stats();
  assert.equal(stats.identityStable, true);
  assert.equal(stats.nodeCreations, 0);
  assert.equal(stats.domInsertions, 0);
  assert.equal(stats.domRemovals, 0);
  assert.equal(stats.runtimeConstruction, 0);
  assert.equal(stats.redundantStateSkips, 1);
  assert.equal(stats.appliedStateKey, "78:5:6");
});

test("decoded cache is the measured 24-chunk LRU rather than the live domain", () => {
  assert.equal(index.cache.maxDecodedChunks, 24);
  assert.equal(index.cache.policy, "bounded-lru-transactional-frame-residency");
  assert.equal(index.cache.eagerWholeDomain, false);
  assert.equal(index.cache.runtimeWorkingSet, undefined);
});

test("corrupt exact sidecars fail explicitly without creating a fallback pose", async () => {
  const runtime = createCssoccerExactActuaPlayerAssetRuntime({
    index,
    materials,
    loadChunk(descriptor) {
      return { ...readJson(descriptor.path), slotId: descriptor.slotId + 1 };
    },
  });
  await assert.rejects(
    runtime.preload({ slotId: 78, localFrameIndex: 0 }),
    /failed validation/u,
  );
  assert.equal(runtime.stats().cacheEntries, 0);
  assert.throws(
    () => runtime.sample({ slotId: 78, localFrameIndex: 0, yawIndex: 0 }),
    CssoccerExactPlayerAssetNotReadyError,
  );
});

function fileRuntime() {
  return createCssoccerExactActuaPlayerAssetRuntime({
    index,
    materials,
    loadChunk: (descriptor) => readJson(descriptor.path),
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, generatedRoot), "utf8"));
}

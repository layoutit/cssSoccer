import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Window } from "happy-dom";

import {
  CssoccerExactPlayerAssetNotReadyError,
  createCssoccerExactActuaPlayerAssetRuntime,
} from "../src/cssoccer/exactActuaPlayerAssets.mjs";
import { mountExactActuaPlayerMesh } from
  "../src/cssoccer/exactActuaPlayerMesh.mjs";

const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const index = readJson("assets/animation/exact-official/index.json");
const materials = readJson("assets/spain-argentina-exact-official-materials.json");

test("exact official runtime loads only requested checked sidecars", async () => {
  const runtime = fileRuntime();
  const state = { slotId: 73, localFrameIndex: 0, yawIndex: 0 };
  assert.throws(() => runtime.sample(state), CssoccerExactPlayerAssetNotReadyError);
  await runtime.preload(state);
  const faces = runtime.sample(state);
  assert.equal(runtime.schema, "cssoccer-exact-actua-official-asset-runtime@1");
  assert.equal(faces.length, 12);
  assert.ok(faces.every(({ transform }) => (
    typeof transform === "string" && !/NaN|Infinity/u.test(transform)
  )));
  assert.equal(runtime.stats().cacheLimit, 6);
  assert.equal(runtime.stats().cacheEntries, 1);
  assert.equal(runtime.stats().fallbackStateCount, 0);
});

test("referee and assistant share the stable 12-leaf exact actor primitive", async () => {
  const runtime = fileRuntime();
  await runtime.preloadMany([
    { slotId: 73, localFrameIndex: 4 },
    { slotId: 78, localFrameIndex: 4 },
  ]);
  const window = new Window();
  for (const materialProfileId of [
    "actua-referee-material",
    "actua-assistant-referee-material",
  ]) {
    const root = window.document.createElement("div");
    window.document.body.append(root);
    const mesh = mountExactActuaPlayerMesh({
      root,
      assetRuntime: runtime,
      materialProfileId,
      shirtNumber: null,
      initialState: { slotId: 78, localFrameIndex: 4, yawIndex: 6 },
    });
    const identities = [...mesh.leaves];
    assert.equal(mesh.leaves.length, 12);
    assert.equal(root.children.length, 12);
    assert.equal(mesh.updateState({ slotId: 73, localFrameIndex: 4, yawIndex: 7 }), true);
    assert.deepEqual([...mesh.leaves], identities);
    assert.equal(mesh.stats().identityStable, true);
    assert.equal(mesh.stats().runtimeConstruction, 0);
  }
});

test("official runtime rejects absent material data and corrupt sidecars", async () => {
  const runtime = createCssoccerExactActuaPlayerAssetRuntime({
    index,
    materials,
    loadChunk: (descriptor) => ({ ...readJson(descriptor.path), faceCount: 13 }),
  });
  await assert.rejects(
    runtime.preload({ slotId: 78, localFrameIndex: 0 }),
    /failed validation/u,
  );
  assert.equal(runtime.stats().fallbackStateCount, 0);

  const checked = fileRuntime();
  await checked.preload({ slotId: 78, localFrameIndex: 0 });
  const window = new Window();
  const root = window.document.createElement("div");
  assert.throws(() => mountExactActuaPlayerMesh({
    root,
    assetRuntime: checked,
    materialProfileId: "actua-referee-material",
    shirtNumber: 1,
    initialState: { slotId: 78, localFrameIndex: 0, yawIndex: 0 },
  }), /does not accept a shirt-number binding/u);
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

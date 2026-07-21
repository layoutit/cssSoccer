import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createCssoccerFreePlayEngine } from "../src/cssoccer/freePlayEngine.mjs";
import { createCssoccerFreePlayState } from "../src/cssoccer/freePlayState.mjs";
import { createCssoccerExactActuaPlayerAssetRuntime } from
  "../src/cssoccer/exactActuaPlayerAssets.mjs";
import {
  CSSOCCER_LIVE_RENDER_FRAME_SCHEMA,
  CSSOCCER_PLAYER_RENDER_BATCH_SCHEMA,
  CSSOCCER_PLAYER_RENDER_CONTRACT_SCHEMA,
  assertCssoccerPlayerRenderCommands,
  createCssoccerFreePlayRenderFrame,
  createCssoccerPlayerRenderCommands,
  createCssoccerPlayerRenderContract,
} from "../src/cssoccer/playerRenderState.mjs";

const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const preparedFacts = readJson(new URL("facts/spain-argentina-full-match.json", generatedRoot));
const renderAssets = readJson(new URL("assets/spain-argentina-render-bundles.json", generatedRoot));
const preparedScene = readJson(new URL("scenes/spain-argentina-full-match.json", generatedRoot));
const exactPlayerIndex = readJson(new URL("assets/animation/exact-player/index.json", generatedRoot));
const exactPlayerMaterials = readJson(
  new URL("assets/spain-argentina-exact-player-materials.json", generatedRoot),
);
const exactOfficialIndex = readJson(
  new URL("assets/animation/exact-official/index.json", generatedRoot),
);
const exactOfficialMaterials = readJson(
  new URL("assets/spain-argentina-exact-official-materials.json", generatedRoot),
);
const exactPlayerAssets = createExactPlayerAssets();
const exactOfficialAssets = createExactOfficialAssets();
const contract = createCssoccerPlayerRenderContract({
  preparedFacts,
  renderAssets,
  exactPlayerAssets,
  exactOfficialAssets,
});

test("real generated facts and render publication bind exactly 22 stable player roots", () => {
  assert.equal(contract.schema, CSSOCCER_PLAYER_RENDER_CONTRACT_SCHEMA);
  assert.equal(contract.fixtureId, "spain-argentina-full-match");
  assert.deepEqual(contract.counts, {
    players: 22,
    preparedFrames: 5857,
    playerFrameSets: 1,
    playerHighlightFrames: 4,
    playerHighlightFrameSets: 1,
    officials: 3,
    officialFrameSets: 1,
  });
  assert.equal(contract.bindings.productionReference, "cssQuake");
  assert.equal(contract.bindings.stateArtifactSha256, preparedFacts.bindings.nativeStateSha256);
  assert.deepEqual(contract.players.map(({ rootId }) => rootId), [
    ...playerIds("spain"),
    ...playerIds("argentina"),
  ]);
  assert.deepEqual(contract.officials.map(({ rootId }) => rootId), [
    "referee-00",
    "assistant-referee-01",
    "assistant-referee-02",
  ]);
  assert.deepEqual(Object.keys(contract.frameIdsByFrameSet), [
    "exact-actua-player-one-basis",
  ]);
  assert.equal(contract.preparedFrameIndexBySlotFrame["120:0"], 4965);
  assert.equal(contract.preparedFrameIndexBySlotFrame["23:0"], 867);
  assert.equal(
    contract.frameIdsByFrameSet["exact-actua-player-one-basis"][4965],
    "mc-120-f-000",
  );
  assert.ok(Object.isFrozen(contract));
  assert.ok(Object.isFrozen(contract.players[0]));
  assert.ok(Object.isFrozen(contract.frameIdsByFrameSet["exact-actua-player-one-basis"]));
  assert.deepEqual(contract.playerHighlight.frameIds, [
    "player-highlight-family-normal",
    "player-highlight-family-cross",
    "player-highlight-family-ball-shoot",
    "player-highlight-family-star-special",
  ]);
  assert.equal(contract.playerHighlight.rootId, "player-highlight-local-user-1");
});

test("kickoff commands preserve real transforms, both countries, visibility, and prepared frames", () => {
  const frame = realPlayerFrame();
  const batch = createCssoccerPlayerRenderCommands(contract, frame);
  assert.equal(batch.schema, CSSOCCER_PLAYER_RENDER_BATCH_SCHEMA);
  assert.equal(batch.tick, 0);
  assert.equal(batch.matchHalf, 0);
  assert.deepEqual(batch.commands.map(({ nativePlayerNumber }) => nativePlayerNumber), range(1, 22));
  assert.deepEqual(batch.commands.map(({ rootId }) => rootId), [
    ...playerIds("spain"),
    ...playerIds("argentina"),
  ]);

  const spain = batch.commands[0];
  assert.deepEqual(spain.transform, {
    position: [618.6666870117188, 0, -640],
    rotation: [0, 0, 0],
    scale: 1,
  });
  assert.deepEqual(spain.facing, { cosine: 1, sine: 0, yawDegrees: 0 });
  assert.equal(spain.visible, true);
  assert.deepEqual(spain.animation, {
    slotId: 122,
    frame: 107,
    frameSetId: "exact-actua-player-one-basis",
    preparedFrameIndex: 5452,
    preparedFrameId: "mc-122-f-107",
  });
  assert.deepEqual(spain.material, {
    country: "spain",
    kitBindingSha256: "9da7015bb209bf13c951dbf3013c1271bd0451bf4f807f9e2227b13ba665fdd3",
    nativeRenderType: 1,
  });

  const argentina = batch.commands[11];
  assert.equal(argentina.rootId, "argentina-player-01");
  assert.deepEqual(argentina.transform.position, [661.3333129882812, 0, -640]);
  assert.deepEqual(argentina.transform.rotation, [0, 180, 0]);
  assert.equal(argentina.animation.frameSetId, "exact-actua-player-one-basis");
  assert.equal(argentina.animation.preparedFrameIndex, 5030);
  assert.equal(argentina.material.country, "argentina");
  assert.equal(argentina.material.nativeRenderType, 2);
  assert.equal(Object.isFrozen(batch), false);
  assert.equal(Object.isFrozen(batch.commands), false);
  assert.equal(Object.isFrozen(batch.commands[0].transform.position), false);
  assert.doesNotThrow(() => assertCssoccerPlayerRenderCommands(contract, batch));
});

test("second-half commands follow swapped native order and source-bound material orientation", () => {
  const batch = createCssoccerPlayerRenderCommands(contract, realPlayerFrame({ matchHalf: 1, tick: 1501 }));
  assert.equal(batch.commands[0].rootId, "argentina-player-01");
  assert.equal(batch.commands[10].rootId, "argentina-player-11");
  assert.equal(batch.commands[11].rootId, "spain-player-01");
  assert.equal(batch.commands[21].rootId, "spain-player-11");
  assert.ok(batch.commands.slice(0, 11).every(({ material }) => (
    material.country === "argentina" && material.nativeRenderType === 1
  )));
  assert.ok(batch.commands.slice(11).every(({ material }) => (
    material.country === "spain" && material.nativeRenderType === 2
  )));
  assert.equal(batch.commands[0].animation.frameSetId, "exact-actua-player-one-basis");
  assert.equal(batch.commands[11].animation.frameSetId, "exact-actua-player-one-basis");
  assert.deepEqual(batch.commands[0].transform.position, [661.3333129882812, 0, -640]);
  assert.deepEqual(batch.commands[11].transform.position, [618.6666870117188, 0, -640]);
});

test("an authoritative frame change swaps only the prepared frame on the same stable root", () => {
  const firstInput = realPlayerFrame();
  const first = createCssoccerPlayerRenderCommands(contract, firstInput);
  const changedInput = structuredClone(firstInput);
  changedInput.players[0].animation.frame = 108;
  changedInput.players[5].visible = false;
  const changed = createCssoccerPlayerRenderCommands(contract, changedInput);
  const before = first.commands[0];
  const after = changed.commands[0];
  assert.equal(after.rootId, before.rootId);
  assert.equal(after.animation.frameSetId, before.animation.frameSetId);
  assert.deepEqual(after.transform, before.transform);
  assert.equal(before.animation.preparedFrameIndex, 5452);
  assert.equal(after.animation.preparedFrameIndex, 5453);
  assert.equal(after.animation.preparedFrameId, "mc-122-f-108");
  assert.equal(changed.commands[5].visible, false);
  assert.deepEqual(
    Object.keys(after).sort(),
    ["animation", "facing", "material", "nativePlayerNumber", "rootId", "transform", "visible"],
  );
  assert.equal(JSON.stringify(changed).includes("geometry"), false);
  assert.equal(JSON.stringify(changed).includes("asset"), false);
  assert.equal(JSON.stringify(changed).includes("url"), false);
});

test("the same authoritative frame serializes byte-identically on repeated conversion", () => {
  const input = realPlayerFrame({ matchHalf: 1, tick: 1842 });
  const left = createCssoccerPlayerRenderCommands(contract, input);
  const right = createCssoccerPlayerRenderCommands(contract, structuredClone(input));
  assert.equal(JSON.stringify(left), JSON.stringify(right));
  assert.deepEqual(left, right);
});

test("engine keeper-save and heading branches resolve to source-prepared frames", () => {
  const input = realPlayerFrame();
  input.players[0].animation = { slotId: 23, frame: 48 };
  input.players[1].animation = { slotId: 81, frame: 37 };
  const batch = createCssoccerPlayerRenderCommands(contract, input);
  assert.deepEqual(batch.commands[0].animation, {
    slotId: 23,
    frame: 48,
    frameSetId: "exact-actua-player-one-basis",
    preparedFrameIndex: 915,
    preparedFrameId: "mc-023-f-048",
  });
  assert.deepEqual(batch.commands[1].animation, {
    slotId: 81,
    frame: 37,
    frameSetId: "exact-actua-player-one-basis",
    preparedFrameIndex: 3057,
    preparedFrameId: "mc-081-f-037",
  });
});

test("current free-play state resolves directly to prepared player, marker, and ball commands", () => {
  const engine = createRenderEngine();
  const frame = createCssoccerFreePlayRenderFrame(contract, {
    snapshot: engine.snapshot(),
  });
  assert.equal(frame.schema, CSSOCCER_LIVE_RENDER_FRAME_SCHEMA);
  assert.equal(frame.tick, 0);
  assert.equal(frame.phase, "opening-kickoff");
  assert.equal(frame.matchHalf, 0);
  assert.equal(frame.renderHalf, 0);
  assert.equal(frame.terminal, false);
  assert.deepEqual(frame.score, { spain: 0, argentina: 0 });
  assert.deepEqual(frame.ball.transform.position, [640, 2, -400]);
  assert.equal(frame.selectedPlayerId, null);
  assert.equal(frame.playerHighlight.rootId, "player-highlight-local-user-1");
  assert.equal(frame.playerHighlight.playerId, null);
  assert.equal(frame.playerHighlight.visible, false);
  assert.equal(frame.players.commands[0].rootId, "spain-player-01");
  assert.deepEqual(frame.officials.commands.map(({ rootId }) => rootId), [
    "referee-00",
    "assistant-referee-01",
    "assistant-referee-02",
  ]);
  assert.deepEqual(frame.officials.commands.map(({ animation }) => animation.slotId), [78, 78, 78]);
  assert.deepEqual(frame.officials.commands.map(({ material }) => material.nativeRenderType), [3, 4, 4]);
  assert.deepEqual(frame.players.commands[0].transform.position, [
    618.6666870117188,
    0,
    -640,
  ]);
  assert.equal(
    frame.players.commands[0].animation.preparedFrameIndex,
    contract.preparedFrameIndexBySlotFrame["78:0"],
  );
  assert.equal(Object.isFrozen(frame), false);
  assert.equal(Object.isFrozen(frame.ball.transform.position), false);
});

test("authoritative opening referee state switches the exact official animation address", () => {
  const engine = createRenderEngine();
  const before = createCssoccerFreePlayRenderFrame(contract, {
    snapshot: engine.snapshot(),
  });
  const beforeReferee = before.officials.commands[0];
  let after = before;
  for (let steps = 0; steps < 4 && after.officials.commands[0].animation.slotId === 78; steps += 1) {
    const snapshot = engine.snapshot();
    engine.step({ tick: snapshot.tick, moveX: 0, moveY: 0, buttons: 0 });
    after = createCssoccerFreePlayRenderFrame(contract, {
      snapshot: engine.snapshot(),
    });
  }
  const afterReferee = after.officials.commands[0];

  assert.deepEqual(
    [beforeReferee.animation.slotId, beforeReferee.animation.frame],
    [78, 23],
  );
  assert.deepEqual(
    [afterReferee.animation.slotId, afterReferee.animation.frame],
    [73, 0],
  );
  assert.notDeepEqual(afterReferee.transform.position, beforeReferee.transform.position);
  assert.deepEqual(
    after.officials.commands.slice(1).map(({ animation }) => animation.slotId),
    [78, 78],
  );
});

test("live Argentina control moves one prepared marker with the same stable player root", () => {
  const engine = createRenderEngine();
  advanceToOpenPlay(engine);
  const before = createCssoccerFreePlayRenderFrame(contract, {
    snapshot: engine.snapshot(),
  });
  const activeId = before.selectedPlayerId;
  assert.match(activeId, /^argentina-player-/u);
  assert.equal(before.playerHighlight.playerId, activeId);
  assert.equal(before.playerHighlight.visible, true);
  const beforePlayer = before.players.commands.find(({ rootId }) => rootId === activeId);
  assert.deepEqual(before.playerHighlight.transform.position, beforePlayer.transform.position);

  const current = engine.snapshot();
  engine.step({ tick: current.tick, moveX: 1, moveY: 0, buttons: 0 });
  const after = createCssoccerFreePlayRenderFrame(contract, {
    snapshot: engine.snapshot(),
  });
  const afterPlayer = after.players.commands.find(({ rootId }) => rootId === activeId);
  assert.equal(after.selectedPlayerId, activeId);
  assert.equal(after.playerHighlight.playerId, activeId);
  assert.deepEqual(after.playerHighlight.transform.position, afterPlayer.transform.position);
  assert.notDeepEqual(after.playerHighlight.transform.position, before.playerHighlight.transform.position);
  assert.equal(after.playerHighlight.ordinaryShadow, "suppressed");
});

test("unknown, duplicate, missing, widened, and non-finite player state fails closed", () => {
  const unknown = realPlayerFrame();
  unknown.players[0].rootId = "france-player-01";
  assert.throws(() => createCssoccerPlayerRenderCommands(contract, unknown), /Unknown prepared/u);

  const duplicate = realPlayerFrame();
  duplicate.players[1].rootId = duplicate.players[0].rootId;
  assert.throws(() => createCssoccerPlayerRenderCommands(contract, duplicate), /Duplicate prepared/u);

  const missing = realPlayerFrame();
  missing.players.pop();
  assert.throws(() => createCssoccerPlayerRenderCommands(contract, missing), /exactly 22/u);

  const unavailable = realPlayerFrame();
  unavailable.players[0].animation = { slotId: 122, frame: 201 };
  assert.throws(() => createCssoccerPlayerRenderCommands(contract, unavailable), /has no prepared frame/u);

  const badPosition = realPlayerFrame();
  badPosition.players[0].position[1] = Number.NaN;
  assert.throws(() => createCssoccerPlayerRenderCommands(contract, badPosition), /three finite numbers/u);

  const badFacing = realPlayerFrame();
  badFacing.players[0].facing.cosine = Number.POSITIVE_INFINITY;
  assert.throws(() => createCssoccerPlayerRenderCommands(contract, badFacing), /facing must be finite/u);

  const duplicateNative = realPlayerFrame();
  duplicateNative.players[1].nativePlayerNumber = 1;
  assert.throws(() => createCssoccerPlayerRenderCommands(contract, duplicateNative), /Duplicate cssoccer native player/u);

  const wrongHalfSlot = realPlayerFrame({ matchHalf: 1 });
  wrongHalfSlot.players[0].nativePlayerNumber = 1;
  assert.throws(() => createCssoccerPlayerRenderCommands(contract, wrongHalfSlot), /source-bound native slot/u);

  const widened = realPlayerFrame();
  widened.players[0].duration = 2;
  assert.throws(() => createCssoccerPlayerRenderCommands(contract, widened), /must contain exactly/u);
});

test("prepared lookup, root binding, and frame-id drift is rejected", () => {
  const lookupDrift = shallowFactsClone();
  lookupDrift.actors.poseFrameSets.preparedFrameIndexBySlotFrame["120:0"] = 4966;
  assert.throws(
    () => createCssoccerPlayerRenderContract({
      preparedFacts: lookupDrift,
      renderAssets,
      exactPlayerAssets,
      exactOfficialAssets,
    }),
    /frame lookup changed at 120:0/u,
  );

  const bindingDrift = shallowRenderClone();
  bindingDrift.rootBindings.find(({ rootId }) => rootId === "spain-player-01").frameSetId = "forbidden-frame-set";
  assert.throws(
    () => createCssoccerPlayerRenderContract({
      preparedFacts,
      renderAssets: bindingDrift,
      exactPlayerAssets,
      exactOfficialAssets,
    }),
    /root binding changed/u,
  );
});

test("source match atlas and per-team material lineage fail closed on drift", () => {
  const atlasDrift = shallowMaterialFactsClone();
  atlasDrift.materials.browserAtlas = {
    ...atlasDrift.materials.browserAtlas,
    sha256: "0".repeat(64),
  };
  assert.throws(
    () => createCssoccerPlayerRenderContract({
      preparedFacts: atlasDrift,
      renderAssets,
      exactPlayerAssets,
      exactOfficialAssets,
    }),
    /material bindings/u,
  );

  const teamDrift = shallowMaterialFactsClone();
  teamDrift.materials.materials[0].browserAtlasEntryIds.pop();
  assert.throws(
    () => createCssoccerPlayerRenderContract({
      preparedFacts: teamDrift,
      renderAssets,
      exactPlayerAssets,
      exactOfficialAssets,
    }),
    /kit binding/u,
  );
});

function realPlayerFrame({ matchHalf = 0, tick = 0 } = {}) {
  const rootsById = new Map(preparedScene.roots.players.map((root) => [root.id, root]));
  const meshesById = new Map(
    preparedScene.meshes.filter(({ kind }) => kind === "player").map((mesh) => [mesh.id, mesh]),
  );
  return {
    tick,
    matchHalf,
    players: contract.players.map((binding) => {
      const root = rootsById.get(binding.rootId);
      const mesh = meshesById.get(binding.rootId);
      const animation = root.initialBinding.animation;
      const kickoffNativePlayerNumber = root.nativeRuntimeIndex + 1;
      return {
        rootId: binding.rootId,
        nativePlayerNumber: matchHalf === 0
          ? kickoffNativePlayerNumber
          : kickoffNativePlayerNumber <= 11
            ? kickoffNativePlayerNumber + 11
            : kickoffNativePlayerNumber - 11,
        position: [...mesh.transform.position],
        facing: {
          cosine: root.initialBinding.rendererFacing.cosine,
          sine: root.initialBinding.rendererFacing.sine,
        },
        visible: root.initialBinding.sourceValues.on.value !== 0,
        animation: {
          slotId: animation.slotId,
          frame: animation.localFrameIndex,
        },
      };
    }),
  };
}

function createRenderEngine() {
  const initialState = createCssoccerFreePlayState({
    preparedFacts,
    preparedScene,
  });
  return createCssoccerFreePlayEngine({ initialState });
}

function advanceToOpenPlay(engine) {
  for (let steps = 0; steps < 240 && engine.snapshot().phase !== "open-play"; steps += 1) {
    const snapshot = engine.snapshot();
    engine.step({ tick: snapshot.tick, moveX: 0, moveY: 0, buttons: 0 });
  }
  assert.equal(engine.snapshot().phase, "open-play");
}

function shallowFactsClone() {
  return {
    ...preparedFacts,
    actors: {
      ...preparedFacts.actors,
      poseFrameSets: {
        ...preparedFacts.actors.poseFrameSets,
        preparedFrameIndexBySlotFrame: {
          ...preparedFacts.actors.poseFrameSets.preparedFrameIndexBySlotFrame,
        },
      },
    },
  };
}

function shallowMaterialFactsClone() {
  return {
    ...preparedFacts,
    materials: {
      ...preparedFacts.materials,
      browserAtlas: { ...preparedFacts.materials.browserAtlas },
      matchAtlas: {
        ...preparedFacts.materials.matchAtlas,
        browserAtlas: { ...preparedFacts.materials.matchAtlas.browserAtlas },
      },
      materials: preparedFacts.materials.materials.map((material) => ({
        ...material,
        browserAtlasEntryIds: [...material.browserAtlasEntryIds],
      })),
    },
  };
}

function shallowRenderClone() {
  return {
    ...renderAssets,
    rootBindings: renderAssets.rootBindings.map((binding) => ({ ...binding })),
    frameSets: renderAssets.frameSets.map((frameSet) => ({
      ...frameSet,
      frames: [...frameSet.frames],
    })),
  };
}

function createExactPlayerAssets() {
  return createCssoccerExactActuaPlayerAssetRuntime({
    index: exactPlayerIndex,
    materials: exactPlayerMaterials,
    loadChunk: (descriptor) => readJson(new URL(descriptor.path, generatedRoot)),
  });
}

function createExactOfficialAssets() {
  return createCssoccerExactActuaPlayerAssetRuntime({
    index: exactOfficialIndex,
    materials: exactOfficialMaterials,
    loadChunk: (descriptor) => readJson(new URL(descriptor.path, generatedRoot)),
  });
}

function playerIds(country) {
  return range(1, 11).map((number) => `${country}-player-${String(number).padStart(2, "0")}`);
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function readJson(url) {
  return JSON.parse(readFileSync(url, "utf8"));
}

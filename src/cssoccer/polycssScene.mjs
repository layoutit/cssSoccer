import {
  BASE_TILE,
  createPolyPerspectiveCamera,
  createPolyScene,
} from "@layoutit/polycss";

import { setCssoccerAttrs } from "./devtoolsAttrs.mjs";
import {
  inspectCssoccerPackedFrameStyleRuntime,
  mountCssoccerRenderBundleFrameSetMesh,
  mountCssoccerRenderBundleMesh,
} from "./renderBundleMesh.mjs";
import { mountExactActuaPlayerMesh } from "./exactActuaPlayerMesh.mjs";
import { createCssoccerSkyBackdropHandle } from "./skyBackdrop.mjs";
import { CSSOCCER_LIVE_RENDER_FRAME_SCHEMA } from "./playerRenderState.mjs";
import { CSSOCCER_PRESENTATION_CAMERA_PRESET } from "./presentationCameraPreset.mjs";
import {
  CSSOCCER_ACTUA_GAMEPLAY_CAMERA,
  createCssoccerActuaGameplayInputBasis,
  createCssoccerActuaGameplayCamera,
  formatCssoccerActuaSceneMatrix3d,
  projectCssoccerActuaRendererPoint,
  stepCssoccerActuaGameplayCamera,
} from "./actuaGameplayCamera.mjs";

export { CSSOCCER_PRESENTATION_CAMERA_PRESET } from "./presentationCameraPreset.mjs";

const FIXTURE_ID = "spain-argentina-full-match";
const EXACT_PLAYER_RENDER_BINDING_ID = "exact-actua-player-one-basis";
const EXACT_OFFICIAL_RENDER_BINDING_ID = "exact-actua-official-one-basis";
const RENDER_PUBLICATION_SCHEMA = "cssoccer-prepared-fixture-render-bundles@1";
export const CSSOCCER_PRESENTATION_INTERPOLATION_MS = 0;
const CSSOCCER_STAND_ANIMATION_SLOT = 78;
const FULL_RATE_ANIMATION_MAX_DISTANCE = 440;
const HALF_RATE_ANIMATION_MAX_DISTANCE = 760;
const MAX_PLAYER_ANIMATION_UPDATES_PER_FRAME = 6;
const EXACT_PLAYER_VIEWPORT_WIDTH = 640;
const EXACT_PLAYER_VIEWPORT_HEIGHT = 400;
const EXACT_PLAYER_ORIGIN_X = 320;
const EXACT_PLAYER_ORIGIN_Y = 267.368408203125;
const EXACT_PLAYER_SCALE_NUMERATOR = 55;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/u;
const ROOT_GROUPS = Object.freeze([
  Object.freeze({ key: "static", kind: "static", count: 9 }),
  Object.freeze({ key: "highlights", kind: "highlight", count: 1 }),
  Object.freeze({ key: "players", kind: "player", count: 22 }),
  Object.freeze({ key: "officials", kind: "official", count: 3 }),
  Object.freeze({ key: "ball", kind: "ball", count: 1 }),
]);
const ZERO_CONSTRUCTION_KEYS = Object.freeze([
  "sourceParseCount",
  "geometryBuildCount",
  "topologyBuildCount",
  "materialBuildCount",
  "assetBuildCount",
]);
const EXACT_PLAYER_PERFORMANCE_COUNTER_KEYS = Object.freeze([
  "updates",
  "transformWrites",
  "backgroundPositionXWrites",
  "backgroundPositionYWrites",
  "visibilityWrites",
  "redundantStateSkips",
  "unchangedPropertySkips",
  "nodeCreations",
  "domInsertions",
  "domRemovals",
  "domReorders",
  "runtimeConstruction",
]);

export async function mountPreparedMatchScene({
  host,
  sceneData,
  renderAssets,
  exactPlayerAssets,
  exactOfficialAssets,
  initialLiveFrame,
}) {
  if (!host || typeof host.appendChild !== "function") {
    throw new Error("Prepared css.soccer match requires a #scene host.");
  }
  const contract = assertPreparedMatchMountContract(sceneData, renderAssets);
  assertExactPlayerAssets(exactPlayerAssets);
  assertExactOfficialAssets(exactOfficialAssets);
  assertLiveRenderFrame(initialLiveFrame, null);
  const initialPlayerCommandByRootId = new Map(
    initialLiveFrame.players.commands.map((command) => [command.rootId, command]),
  );
  if (initialPlayerCommandByRootId.size !== 22) {
    throw new Error("Prepared css.soccer mount requires 22 unique tick-zero player commands.");
  }
  const initialOfficialCommandByRootId = new Map(
    initialLiveFrame.officials.commands.map((command) => [command.rootId, command]),
  );
  if (initialOfficialCommandByRootId.size !== 3) {
    throw new Error("Prepared css.soccer mount requires three unique tick-zero official commands.");
  }
  const cameraBinding = createPresentationCameraBinding(sceneData);
  const camera = createActuaGameplayCameraContext();
  let presentationCamera = createCssoccerActuaGameplayCamera();
  const scene = createPolyScene(host, {
    camera,
    ambientLight: { color: "#ffffff", intensity: Math.PI },
    directionalLight: {
      direction: [-0.4, -0.55, -0.65],
      color: "#ffffff",
      intensity: 0,
    },
    textureLighting: "baked",
    textureImageRendering: "pixelated",
    autoCenter: false,
    seamBleed: 0,
  });
  const exactPlayerOverlay = createExactPlayerOverlay(host);
  const skyBackdrop = createCssoccerSkyBackdropHandle({
    host,
    backdrop: sceneData.backdrop,
    camera: presentationCamera,
  });
  const applyPolycssCamera = scene.applyCamera;
  scene.applyCamera = () => {
    applyPolycssCamera();
    applyActuaGameplayCamera(scene.sceneElement, presentationCamera);
    skyBackdrop.apply(presentationCamera);
  };
  const handles = [];
  const mountedById = new Map();
  const handlesById = new Map();
  const elementsById = new Map();
  const presentationById = new Map();
  let destroyed = false;
  let lastLiveRenderTick = null;
  let liveRenderApplyCount = 0;
  let livePlayerTransformApplyCount = 0;
  let livePlayerAnimationFrameApplyCount = 0;
  let livePlayerAnimationFrameSkipCount = 0;
  let livePlayerIdleAnimationFreezeCount = 0;
  let livePlayerLodAnimationSkipCount = 0;
  let livePlayerAnimationBudgetSkipCount = 0;
  let livePlayerHiddenSkipCount = 0;
  let liveOfficialTransformApplyCount = 0;
  let liveOfficialAnimationFrameApplyCount = 0;
  let liveOfficialAnimationFrameSkipCount = 0;
  let liveBallTransformApplyCount = 0;
  let liveHighlightTransformApplyCount = 0;
  let liveHighlightFrameApplyCount = 0;
  let liveHighlightVisibilityApplyCount = 0;

  try {
    for (const mesh of sceneData.meshes) {
      const root = contract.rootsById.get(mesh.id);
      const binding = contract.bindingsByRootId.get(mesh.id);
      const bundle = contract.bundlesById.get(mesh.bundleId);
      const exactPlayer = mesh.kind === "player";
      const exactOfficial = mesh.kind === "official";
      const exactActor = exactPlayer || exactOfficial;
      const initialActorCommand = exactPlayer
        ? initialPlayerCommandByRootId.get(mesh.id)
        : exactOfficial
          ? initialOfficialCommandByRootId.get(mesh.id)
          : null;
      if (exactActor && !initialActorCommand) {
        throw new Error(`Prepared actor ${mesh.id} has no browser-owned tick-zero command.`);
      }
      const handle = exactActor
        ? mountExactMatchPlayer({
            overlay: exactPlayerOverlay,
            assetRuntime: exactPlayer ? exactPlayerAssets : exactOfficialAssets,
            materialProfileId: exactPlayer
              ? `${root.country}-player-material`
              : root.materialId,
            shirtNumber: exactPlayer ? root.nativeRuntimeIndex % 11 + 1 : null,
            presentationCamera,
            initialTransform: initialActorCommand.transform,
            initialAnimation: {
              slotId: initialActorCommand.animation.slotId,
              localFrameIndex: initialActorCommand.animation.frame,
            },
          })
        : mesh.frameSetId === null
          ? mountCssoccerRenderBundleMesh(scene.sceneElement, bundle)
          : mountCssoccerRenderBundleFrameSetMesh(
              scene.sceneElement,
              contract.frameSetsById.get(mesh.frameSetId),
              mesh.initialFrameIndex,
              { camera },
            );
      if (!exactActor) handle.setTransform(mesh.transform);
      const element = handle.element;
      element.id = `cssoccer-root-${mesh.id}`;
      element.setAttribute("aria-hidden", "true");
      setCssoccerAttrs(element, {
        rootId: mesh.id,
        kind: mesh.kind,
        stableRoot: true,
        bundleId: binding.bundleId,
        frameSetId: binding.frameSetId,
        initialFrameIndex: mesh.initialFrameIndex,
        sourceId: root.sourceId,
        country: root.country,
        nativeRuntimeIndex: root.nativeRuntimeIndex,
        nativeRendererIndex: root.nativeRendererIndex,
        modelId: root.modelId,
        materialId: root.materialId,
      });
      if (mesh.kind === "highlight") setHidden(element, true);
      const mounted = Object.freeze({
        id: mesh.id,
        index: handles.length,
        kind: mesh.kind,
        handle,
        exactActor,
        exactPlayer,
        exactOfficial,
      });
      handles.push(mounted);
      mountedById.set(mesh.id, mounted);
      handlesById.set(mesh.id, handle);
      elementsById.set(mesh.id, element);
      presentationById.set(mesh.id, createRootPresentationState(mesh, element.hidden));
    }
    scene.applyCamera();
    host.dataset.cssoccerFixtureId = sceneData.id;
    host.dataset.cssoccerCameraMode = String(presentationCamera.sourceMode);
    host.dataset.cssoccerCameraSource = presentationCamera.source.file;
    host.dataset.cssoccerStableRootCount = String(handles.length + 1);
    host.dataset.cssoccerExactPlayerRootCount = "22";
    host.dataset.cssoccerExactOfficialRootCount = "3";
  } catch (error) {
    for (const { handle } of handles) handle.remove();
    skyBackdrop.remove();
    exactPlayerOverlay.remove();
    scene.destroy();
    throw error;
  }

  const frozenHandles = Object.freeze(handles);
  return Object.freeze({
    camera,
    cameraBinding,
    scene,
    handles: frozenHandles,
    getHandle(rootId) {
      if (rootId === "sky-backdrop") return skyBackdrop;
      return handlesById.get(rootId) ?? null;
    },
    gameplayInputBasis() {
      if (destroyed) throw new Error("Prepared css.soccer scene has been destroyed.");
      return createCssoccerActuaGameplayInputBasis(presentationCamera);
    },
    setPreparedFrame(rootId, frameIndex) {
      const handle = handlesById.get(rootId);
      if (!handle) throw new Error(`Unknown prepared css.soccer root ${rootId}.`);
      if (typeof handle.setFrameIndex !== "function") return false;
      const changed = handle.setFrameIndex(frameIndex);
      if (changed) presentationById.get(rootId).lastPreparedFrameIndex = handle.getFrameIndex();
      return changed;
    },
    setExactPlayerEvidenceState(rootId, exactState) {
      if (destroyed) throw new Error("Prepared css.soccer scene has been destroyed.");
      const mounted = mountedById.get(rootId);
      if (!mounted?.exactPlayer
          || typeof mounted.handle.setExactPreparedState !== "function") {
        throw new Error(`Unknown exact css.soccer player root ${rootId}.`);
      }
      return mounted.handle.setExactPreparedState(exactState);
    },
    applyExactPlayerPerformanceStates(exactStates) {
      if (destroyed) throw new Error("Prepared css.soccer scene has been destroyed.");
      const players = frozenHandles.filter(({ exactPlayer }) => exactPlayer);
      if (!Array.isArray(exactStates) || exactStates.length !== players.length
          || players.length !== 22) {
        throw new Error("Exact player performance publication requires 22 prepared states.");
      }
      const requestedKeys = [];
      const appliedKeys = [];
      let changedCount = 0;
      for (let index = 0; index < players.length; index += 1) {
        const state = exactStates[index];
        const requestedKey = exactPlayerStateKey(state);
        requestedKeys.push(requestedKey);
        if (players[index].handle.setExactPreparedState(state)) changedCount += 1;
        appliedKeys.push(players[index].handle.getExactStateKey());
      }
      return Object.freeze({
        playerRootCount: players.length,
        connectedRootCount: players.reduce((count, { handle }) => (
          count + Number(handle.element.isConnected)
        ), 0),
        changedCount,
        requestedKeys: Object.freeze(requestedKeys),
        appliedKeys: Object.freeze(appliedKeys),
      });
    },
    exactPlayerPerformanceStats() {
      if (destroyed) throw new Error("Prepared css.soccer scene has been destroyed.");
      const players = frozenHandles.filter(({ exactPlayer }) => exactPlayer);
      const counters = Object.fromEntries(
        EXACT_PLAYER_PERFORMANCE_COUNTER_KEYS.map((key) => [key, 0]),
      );
      const appliedStateKeys = [];
      for (const { handle } of players) {
        const stats = handle.exactStats();
        for (const key of EXACT_PLAYER_PERFORMANCE_COUNTER_KEYS) counters[key] += stats[key];
        appliedStateKeys.push(stats.appliedStateKey);
      }
      return Object.freeze({
        playerRootCount: players.length,
        connectedRootCount: players.reduce((count, { handle }) => (
          count + Number(handle.element.isConnected)
        ), 0),
        leafCount: players.reduce((count, { handle }) => count + handle.leaves.length, 0),
        connectedLeafCount: players.reduce((count, { handle }) => (
          count + handle.leaves.reduce((leafCount, leaf) => leafCount + Number(leaf.isConnected), 0)
        ), 0),
        counters: Object.freeze(counters),
        appliedStateKeys: Object.freeze(appliedStateKeys),
      });
    },
    applyLiveRenderFrame(frame) {
      if (destroyed) throw new Error("Prepared css.soccer scene has been destroyed.");
      assertLiveRenderFrame(frame, lastLiveRenderTick);
      presentationCamera = advanceActuaGameplayCamera(presentationCamera, frame);
      applyActuaGameplayCamera(scene.sceneElement, presentationCamera);
      syncPolycssCameraFacing(camera, presentationCamera);
      skyBackdrop.apply(presentationCamera);
      setDatasetValue(host, "cssoccerCameraMode", presentationCamera.sourceMode);
      const goalScorerNativePlayer = frame.camera.goalScorer?.nativePlayerNumber ?? null;
      const highlight = frame.playerHighlight;
      const mountedHighlight = mountedById.get(highlight.rootId);
      if (mountedHighlight?.kind !== "highlight") {
        throw new Error(`Unknown prepared css.soccer highlight root ${highlight.rootId}.`);
      }
      if (typeof mountedHighlight.handle.setFrameIndex !== "function") {
        throw new Error(`${highlight.rootId} has no prepared marker frame set.`);
      }
      const highlightState = presentationById.get(highlight.rootId);
      const highlightTransformChanged = presentationTransformChanged(
        highlightState,
        highlight.transform,
      );
      if (highlightTransformChanged) {
        mountedHighlight.handle.setTransform(highlight.transform);
        recordPresentationTransform(highlightState, highlight.transform);
        liveHighlightTransformApplyCount += 1;
      }
      if (highlightState.lastPreparedFrameIndex !== highlight.family.frameIndex) {
        mountedHighlight.handle.setFrameIndex(highlight.family.frameIndex);
        highlightState.lastPreparedFrameIndex = highlight.family.frameIndex;
        liveHighlightFrameApplyCount += 1;
      }
      if (highlightState.visible !== highlight.visible) {
        liveHighlightVisibilityApplyCount += 1;
      }
      highlightState.latestTransform = highlight.transform;
      highlightState.visible = highlight.visible;
      setHidden(mountedHighlight.handle.element, !highlight.visible);
      setOptionalDatasetValue(
        mountedHighlight.handle.element,
        "cssoccerHighlightPlayerId",
        highlight.playerId,
      );
      setDatasetValue(
        mountedHighlight.handle.element,
        "cssoccerHighlightType",
        highlight.type.semantic,
      );
      setDatasetValue(
        mountedHighlight.handle.element,
        "cssoccerHighlightFamily",
        highlight.family.id === null ? "none" : highlight.family.id,
      );
      setDatasetValue(
        mountedHighlight.handle.element,
        "cssoccerHighlightOrdinaryShadow",
        highlight.ordinaryShadow,
      );
      let animationUpdates = 0;
      const commandCount = frame.players.commands.length;
      const commandStart = frame.tick % commandCount;
      for (let commandOffset = 0; commandOffset < commandCount; commandOffset += 1) {
        const command = frame.players.commands[(commandStart + commandOffset) % commandCount];
        const mounted = mountedById.get(command.rootId);
        if (mounted?.kind !== "player") {
          throw new Error(`Unknown prepared css.soccer player root ${command.rootId}.`);
        }
        if (typeof mounted.handle.setFrameIndex !== "function") {
          throw new Error(`${command.rootId} has no prepared animation frame set.`);
        }
        const state = presentationById.get(command.rootId);
        state.latestTransform = command.transform;
        const becameVisible = command.visible && !state.visible;
        state.visible = command.visible;
        if (!command.visible) {
          setHidden(mounted.handle.element, true);
          state.lastAnimationSlotId = animationSlotId(command);
          livePlayerHiddenSkipCount += 1;
          continue;
        }

        const transformChanged = presentationTransformChanged(state, command.transform);
        const slotId = animationSlotId(command);
        if (mounted.exactPlayer) {
          const result = mounted.handle.setExactStateFields(
            slotId,
            command.animation.frame,
            presentationCamera,
            command.transform,
            command.facing.yawDegrees,
          );
          if (transformChanged || result.presentationChanged) {
            livePlayerTransformApplyCount += 1;
          }
          if (result.sampleChanged) {
            livePlayerAnimationFrameApplyCount += 1;
          } else {
            livePlayerAnimationFrameSkipCount += 1;
          }
          state.lastPreparedFrameIndex = command.animation.preparedFrameIndex;
          state.lastAnimationSlotId = slotId;
          recordPresentationTransform(state, command.transform);
          setHidden(mounted.handle.element, !result.projectedVisible);
          continue;
        }
        const frameChanged = (
          state.lastPreparedFrameIndex !== command.animation.preparedFrameIndex
        );
        const slotChanged = state.lastAnimationSlotId !== slotId;
        const priorityAnimation = command.rootId === frame.selectedPlayerId
          || command.nativePlayerNumber === goalScorerNativePlayer;
        const cadence = presentationAnimationCadence(
          presentationCamera,
          command.transform.position,
        );
        const cadenceDue = (frame.tick + mounted.index) % cadence === 0;
        const idleFrozen = frameChanged
          && slotId === CSSOCCER_STAND_ANIMATION_SLOT
          && !slotChanged
          && !priorityAnimation;
        const lodSkipped = frameChanged
          && slotId !== CSSOCCER_STAND_ANIMATION_SLOT
          && !slotChanged
          && !priorityAnimation
          && !cadenceDue;
        const applyFrame = frameChanged
          && (becameVisible || slotChanged || priorityAnimation || (!idleFrozen && !lodSkipped));
        const budgetSkipped = applyFrame
          && !priorityAnimation
          && animationUpdates >= MAX_PLAYER_ANIMATION_UPDATES_PER_FRAME;

        if (transformChanged) {
          mounted.handle.setTransform(command.transform);
          recordPresentationTransform(state, command.transform);
          livePlayerTransformApplyCount += 1;
        }
        if (applyFrame && !budgetSkipped) {
          const applied = mounted.handle.setFrameIndex(command.animation.preparedFrameIndex);
          if (applied) {
            state.lastPreparedFrameIndex = command.animation.preparedFrameIndex;
            state.lastAnimationSlotId = slotId;
            livePlayerAnimationFrameApplyCount += 1;
            animationUpdates += 1;
          } else {
            livePlayerAnimationFrameSkipCount += 1;
          }
        } else if (frameChanged) {
          livePlayerAnimationFrameSkipCount += 1;
          if (idleFrozen) livePlayerIdleAnimationFreezeCount += 1;
          if (lodSkipped) livePlayerLodAnimationSkipCount += 1;
          if (budgetSkipped) livePlayerAnimationBudgetSkipCount += 1;
        } else {
          state.lastAnimationSlotId = slotId;
        }
        setHidden(mounted.handle.element, false);
      }
      for (const command of frame.officials.commands) {
        const mounted = mountedById.get(command.rootId);
        if (!mounted?.exactOfficial) {
          throw new Error(`Unknown prepared css.soccer official root ${command.rootId}.`);
        }
        const state = presentationById.get(command.rootId);
        state.latestTransform = command.transform;
        state.visible = command.visible;
        const transformChanged = presentationTransformChanged(state, command.transform);
        const result = mounted.handle.setExactStateFields(
          command.animation.slotId,
          command.animation.frame,
          presentationCamera,
          command.transform,
          command.facing.yawDegrees,
        );
        if (transformChanged || result.presentationChanged) {
          liveOfficialTransformApplyCount += 1;
        }
        if (result.sampleChanged) liveOfficialAnimationFrameApplyCount += 1;
        else liveOfficialAnimationFrameSkipCount += 1;
        state.lastAnimationSlotId = command.animation.slotId;
        state.lastPreparedFrameIndex = command.animation.frame;
        recordPresentationTransform(state, command.transform);
        setHidden(mounted.handle.element, !command.visible || !result.projectedVisible);
      }
      const mountedBall = mountedById.get(frame.ball.rootId);
      if (mountedBall?.kind !== "ball") {
        throw new Error(`Unknown prepared css.soccer ball root ${frame.ball.rootId}.`);
      }
      const ballState = presentationById.get(frame.ball.rootId);
      ballState.latestTransform = frame.ball.transform;
      ballState.visible = frame.ball.visible;
      if (frame.ball.visible && presentationTransformChanged(ballState, frame.ball.transform)) {
        mountedBall.handle.setTransform(frame.ball.transform);
        recordPresentationTransform(ballState, frame.ball.transform);
        liveBallTransformApplyCount += 1;
      }
      setHidden(mountedBall.handle.element, !frame.ball.visible);
      lastLiveRenderTick = frame.tick;
      liveRenderApplyCount += 1;
      setOptionalDatasetValue(host, "cssoccerSelectedPlayerId", frame.selectedPlayerId);
      setOptionalDatasetValue(host, "cssoccerHighlightPlayerId", highlight.playerId);
      return frame.tick;
    },
    resetLiveRenderState() {
      if (destroyed) throw new Error("Prepared css.soccer scene has been destroyed.");
      lastLiveRenderTick = null;
      liveRenderApplyCount = 0;
      livePlayerTransformApplyCount = 0;
      livePlayerAnimationFrameApplyCount = 0;
      livePlayerAnimationFrameSkipCount = 0;
      livePlayerIdleAnimationFreezeCount = 0;
      livePlayerLodAnimationSkipCount = 0;
      livePlayerAnimationBudgetSkipCount = 0;
      livePlayerHiddenSkipCount = 0;
      liveOfficialTransformApplyCount = 0;
      liveOfficialAnimationFrameApplyCount = 0;
      liveOfficialAnimationFrameSkipCount = 0;
      liveBallTransformApplyCount = 0;
      liveHighlightTransformApplyCount = 0;
      liveHighlightFrameApplyCount = 0;
      liveHighlightVisibilityApplyCount = 0;
      for (const [rootId, state] of presentationById) {
        state.lastAnimationSlotId = -1;
        state.visible = !mountedById.get(rootId).handle.element.hidden;
      }
      presentationCamera = createCssoccerActuaGameplayCamera();
      applyActuaGameplayCamera(scene.sceneElement, presentationCamera);
      syncPolycssCameraFacing(camera, presentationCamera);
      skyBackdrop.apply(presentationCamera);
      for (const mounted of frozenHandles) {
        if (mounted.exactActor) mounted.handle.refreshExactPresentation(presentationCamera);
      }
      delete host.dataset.cssoccerLiveTick;
      delete host.dataset.cssoccerSelectedPlayerId;
      delete host.dataset.cssoccerHighlightPlayerId;
    },
    stats() {
      const construction = zeroRuntimeConstruction(true);
      let leafCount = 0;
      let connectedLeafCount = 0;
      let frameStyleApplyCount = 0;
      let frameRootStyleWriteCount = 0;
      let frameLeafFullStyleWriteCount = 0;
      let frameLeafTransformWriteCount = 0;
      let frameLeafUnchangedSkipCount = 0;
      for (const { handle } of frozenHandles) {
        const handleStats = handle.stats();
        leafCount += handleStats.leafCount;
        connectedLeafCount += handle.leaves.reduce((count, leaf) => (
          count + Number(leaf.isConnected)
        ), 0);
        frameStyleApplyCount += handleStats.frameStyleApplyCount;
        frameRootStyleWriteCount += handleStats.frameRootStyleWriteCount;
        frameLeafFullStyleWriteCount += handleStats.frameLeafFullStyleWriteCount;
        frameLeafTransformWriteCount += handleStats.frameLeafTransformWriteCount;
        frameLeafUnchangedSkipCount += handleStats.frameLeafUnchangedSkipCount;
        for (const key of ZERO_CONSTRUCTION_KEYS) construction[key] += handleStats[key];
      }
      const stableIdentityCount = frozenHandles.reduce((count, { id, handle }) => (
        elementsById.get(id) === handle.element ? count + 1 : count
      ), 0) + Number(skyBackdrop.element.id === "cssoccer-root-sky-backdrop");
      const skyStats = skyBackdrop.stats();
      for (const key of ZERO_CONSTRUCTION_KEYS) construction[key] += skyStats[key];
      const packedFrameStyles = inspectCssoccerPackedFrameStyleRuntime(
        contract.frameSetsById.values(),
      );
      return Object.freeze({
        fixtureId: sceneData.id,
        rootCount: frozenHandles.length + 1,
        skyBackdropRootCount: 1,
        staticRootCount: contract.rootCounts.static,
        highlightRootCount: contract.rootCounts.highlight,
        playerRootCount: contract.rootCounts.player,
        officialRootCount: frozenHandles.filter(({ kind }) => kind === "official").length,
        exactOfficialRootCount: frozenHandles.filter(({ exactOfficial }) => exactOfficial).length,
        ballRootCount: contract.rootCounts.ball,
        highlightVisible: !mountedById.get("player-highlight-local-user-1").handle.element.hidden,
        highlightPosition: Object.freeze([
          ...presentationById.get("player-highlight-local-user-1").latestTransform.position,
        ]),
        highlightPreparedFrameIndex:
          presentationById.get("player-highlight-local-user-1").lastPreparedFrameIndex,
        frameSetRootCount: sceneData.meshes.filter(({ frameSetId }) => frameSetId !== null).length,
        initialFrameRootCount: sceneData.meshes.filter(({ initialFrameIndex }) => (
          Number.isSafeInteger(initialFrameIndex)
        )).length,
        distinctPlayerPositionCount: new Set(frozenHandles
          .filter(({ kind }) => kind === "player")
          .map(({ id }) => presentationById.get(id).latestTransform.position.join(","))).size,
        ballPosition: Object.freeze([
          ...presentationById.get("ball-00").latestTransform.position,
        ]),
        hiddenPlayerRootCount: frozenHandles.filter(({ kind, handle }) => (
          kind === "player" && handle.element.hidden
        )).length,
        hiddenStadiumLeafCount: 0,
        lastLiveRenderTick,
        liveRenderApplyCount,
        livePlayerTransformApplyCount,
        livePlayerAnimationFrameApplyCount,
        livePlayerAnimationFrameSkipCount,
        livePlayerIdleAnimationFreezeCount,
        livePlayerLodAnimationSkipCount,
        livePlayerAnimationBudgetSkipCount,
        livePlayerHiddenSkipCount,
        liveOfficialTransformApplyCount,
        liveOfficialAnimationFrameApplyCount,
        liveOfficialAnimationFrameSkipCount,
        liveBallTransformApplyCount,
        liveHighlightTransformApplyCount,
        liveHighlightFrameApplyCount,
        liveHighlightVisibilityApplyCount,
        stableIdentityCount,
        connectedRootCount: frozenHandles.filter(({ handle }) => handle.element.isConnected).length
          + skyStats.connectedRootCount,
        leafCount,
        connectedLeafCount,
        detachedLeafCount: leafCount - connectedLeafCount,
        frameStyleApplyCount,
        frameRootStyleWriteCount,
        frameLeafFullStyleWriteCount,
        frameLeafTransformWriteCount,
        frameLeafUnchangedSkipCount,
        packedFrameStyles,
        presentationInterpolationMs: CSSOCCER_PRESENTATION_INTERPOLATION_MS,
        presentationCameraInterpolated: hasTransformInterpolation(scene.sceneElement),
        presentationInterpolatedRootCount: frozenHandles.filter(({ kind, handle }) => (
          (kind === "player" || kind === "official" || kind === "ball" || kind === "highlight")
          && hasTransformInterpolation(handle.element)
        )).length,
        camera: createActuaGameplayCameraBinding(sceneData, presentationCamera),
        skyBackdrop: Object.freeze({
          ...skyBackdrop.projection(),
          backgroundPositionXWrites: skyStats.backgroundPositionXWrites,
          backgroundPositionYWrites: skyStats.backgroundPositionYWrites,
        }),
        stableRootIds: Object.freeze([
          "sky-backdrop",
          ...frozenHandles.map(({ id }) => id),
        ]),
        runtimeConstruction: Object.freeze(construction),
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const { handle } of frozenHandles) handle.remove();
      skyBackdrop.remove();
      exactPlayerOverlay.remove();
      mountedById.clear();
      handlesById.clear();
      elementsById.clear();
      presentationById.clear();
      scene.destroy();
      delete host.dataset.cssoccerFixtureId;
      delete host.dataset.cssoccerCameraMode;
      delete host.dataset.cssoccerCameraSource;
      delete host.dataset.cssoccerStableRootCount;
      delete host.dataset.cssoccerExactPlayerRootCount;
      delete host.dataset.cssoccerExactOfficialRootCount;
      delete host.dataset.cssoccerLiveTick;
      delete host.dataset.cssoccerSelectedPlayerId;
      delete host.dataset.cssoccerHighlightPlayerId;
    },
  });
}

function createExactPlayerOverlay(host) {
  const overlay = host.ownerDocument.createElement("div");
  overlay.className = "cssoccer-exact-player-overlay";
  overlay.dataset.cssoccerExactPlayerOverlay = "true";
  overlay.setAttribute("aria-hidden", "true");
  host.appendChild(overlay);
  return overlay;
}

function mountExactMatchPlayer({
  overlay,
  assetRuntime,
  materialProfileId,
  shirtNumber,
  presentationCamera,
  initialTransform,
  initialAnimation,
}) {
  const documentImpl = overlay.ownerDocument;
  const element = documentImpl.createElement("div");
  element.className = "cssoccer-exact-player-screen-root";
  const modelRoot = documentImpl.createElement("div");
  modelRoot.className = "cssoccer-exact-player-model";
  element.appendChild(modelRoot);
  overlay.appendChild(element);
  const transform = {};
  assignExactPlayerTransform(transform, initialTransform);
  let camera = presentationCamera;
  let playerYawDegrees = transform.rotation?.[1] ?? 0;
  let slotId = initialAnimation.slotId;
  let localFrameIndex = initialAnimation.localFrameIndex;
  const viewport = { viewportWidth: 0, viewportHeight: 0 };
  refreshExactPlayerViewport(overlay, viewport);
  let yawIndex = exactPlayerYawIndex(camera, transform.position, playerYawDegrees);
  const runtime = mountExactActuaPlayerMesh({
    root: modelRoot,
    assetRuntime,
    materialProfileId,
    shirtNumber,
    initialState: { slotId, localFrameIndex, yawIndex },
  });
  let appliedPresentation = null;
  let removed = false;
  const applyResult = {
    projectedVisible: true,
    presentationChanged: false,
    sampleChanged: false,
  };

  const apply = () => {
    const position = transform.position ?? [0, 0, 0];
    refreshExactPlayerViewport(overlay, viewport);
    const [screenX, screenY, depth] = projectCssoccerActuaRendererPoint(
      position,
      camera,
      viewport,
    );
    const nextYawIndex = exactPlayerYawIndex(camera, position, playerYawDegrees);
    const sampleChanged = runtime.updateStateFields(slotId, localFrameIndex, nextYawIndex);
    yawIndex = nextYawIndex;
    const projectedVisible = depth > 5;
    let presentationChanged = false;
    if (projectedVisible) {
      const scale = EXACT_PLAYER_SCALE_NUMERATOR / depth * (transform.scale ?? 1);
      const left = screenX - EXACT_PLAYER_ORIGIN_X * scale;
      const top = screenY - EXACT_PLAYER_ORIGIN_Y * scale;
      const presentation = `translate3d(${formatPresentationNumber(left)}px,${formatPresentationNumber(top)}px,0) scale(${formatPresentationNumber(scale)})`;
      if (presentation !== appliedPresentation) {
        element.style.transform = presentation;
        appliedPresentation = presentation;
        presentationChanged = true;
      }
    }
    element.hidden = !projectedVisible;
    applyResult.projectedVisible = projectedVisible;
    applyResult.presentationChanged = presentationChanged;
    applyResult.sampleChanged = sampleChanged;
    return applyResult;
  };

  const remove = () => {
    if (removed) return;
    removed = true;
    element.remove();
  };
  const zeroConstruction = () => Object.freeze({
    sourceParseCount: 0,
    geometryBuildCount: 0,
    topologyBuildCount: 0,
    materialBuildCount: 0,
    assetBuildCount: 0,
  });
  const handle = {
    element,
    leaves: runtime.leaves,
    transform,
    getFrameIndex: () => 0,
    setFrameIndex: () => false,
    setTransform(partial) {
      assignExactPlayerTransform(transform, partial);
      playerYawDegrees = transform.rotation?.[1] ?? playerYawDegrees;
      return apply().presentationChanged;
    },
    setExactState({
      slotId: nextSlotId,
      localFrameIndex: nextLocalFrameIndex,
      presentationCamera: nextCamera,
      transform: nextTransform,
      yawDegrees,
    }) {
      return setExactLiveState(
        nextSlotId,
        nextLocalFrameIndex,
        nextCamera,
        nextTransform,
        yawDegrees,
      );
    },
    setExactStateFields(
      nextSlotId,
      nextLocalFrameIndex,
      nextCamera,
      nextTransform,
      yawDegrees,
    ) {
      return setExactLiveState(
        nextSlotId,
        nextLocalFrameIndex,
        nextCamera,
        nextTransform,
        yawDegrees,
      );
    },
    setExactPreparedState({
      slotId: nextSlotId,
      localFrameIndex: nextLocalFrameIndex,
      yawIndex: nextYawIndex,
    }) {
      if (!Number.isSafeInteger(nextSlotId) || nextSlotId < 0
          || !Number.isSafeInteger(nextLocalFrameIndex) || nextLocalFrameIndex < 0
          || !Number.isSafeInteger(nextYawIndex) || nextYawIndex < 0 || nextYawIndex >= 24) {
        throw new RangeError("Exact Actua evidence state is outside its prepared domain.");
      }
      slotId = nextSlotId;
      localFrameIndex = nextLocalFrameIndex;
      yawIndex = nextYawIndex;
      return runtime.updateStateFields(slotId, localFrameIndex, yawIndex);
    },
    getExactStateKey() {
      return runtime.stats().appliedStateKey;
    },
    exactStats() {
      return runtime.stats();
    },
    refreshExactPresentation(nextCamera) {
      camera = nextCamera;
      return apply();
    },
    stats() {
      const runtimeStats = runtime.stats();
      return Object.freeze({
        ...zeroConstruction(),
        frameStyleApplyCount: runtimeStats.updates,
        frameRootStyleWriteCount: 0,
        frameLeafFullStyleWriteCount: 0,
        frameLeafTransformWriteCount: runtimeStats.transformWrites,
        frameLeafUnchangedSkipCount:
          runtimeStats.redundantStateSkips + runtimeStats.unchangedPropertySkips,
        leafCount: runtime.leaves.length,
        appliedStateKey: runtimeStats.appliedStateKey,
      });
    },
    runtimeConstruction: zeroConstruction,
    remove,
    dispose: remove,
  };

  function setExactLiveState(
    nextSlotId,
    nextLocalFrameIndex,
    nextCamera,
    nextTransform,
    yawDegrees,
  ) {
      if (!Number.isSafeInteger(nextSlotId) || nextSlotId < 0) {
        throw new RangeError("Exact Actua match player slot must be a non-negative integer.");
      }
      if (!Number.isSafeInteger(nextLocalFrameIndex) || nextLocalFrameIndex < 0) {
        throw new RangeError("Exact Actua match player local frame must be non-negative.");
      }
      if (!Number.isFinite(yawDegrees)) {
        throw new TypeError("Exact Actua match player yaw must be finite.");
      }
      slotId = nextSlotId;
      localFrameIndex = nextLocalFrameIndex;
      camera = nextCamera;
      playerYawDegrees = yawDegrees;
      assignExactPlayerTransform(transform, nextTransform);
      return apply();
  }
  return Object.freeze(handle);
}

function refreshExactPlayerViewport(overlay, viewport) {
  const windowImpl = overlay.ownerDocument.defaultView;
  viewport.viewportWidth = Number.isFinite(windowImpl?.innerWidth) && windowImpl.innerWidth > 0
    ? windowImpl.innerWidth
    : EXACT_PLAYER_VIEWPORT_WIDTH;
  viewport.viewportHeight = Number.isFinite(windowImpl?.innerHeight) && windowImpl.innerHeight > 0
    ? windowImpl.innerHeight
    : EXACT_PLAYER_VIEWPORT_HEIGHT;
  return viewport;
}

function exactPlayerStateKey(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || !Number.isSafeInteger(value.slotId) || value.slotId < 0
      || !Number.isSafeInteger(value.localFrameIndex) || value.localFrameIndex < 0
      || !Number.isSafeInteger(value.yawIndex) || value.yawIndex < 0 || value.yawIndex >= 24) {
    throw new RangeError("Exact Actua performance state is outside its prepared domain.");
  }
  return `${value.slotId}:${value.localFrameIndex}:${value.yawIndex}`;
}

function exactPlayerYawIndex(camera, playerPosition, playerYawDegrees) {
  const eye = camera.rendered.renderer.eye;
  const viewDegrees = Math.atan2(
    eye[2] - playerPosition[2],
    eye[0] - playerPosition[0],
  ) * 180 / Math.PI;
  const exactYaw = normalizeDegrees(playerYawDegrees - viewDegrees);
  return Math.round(exactYaw / 15) % 24;
}

function assignExactPlayerTransform(target, partial) {
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) {
    throw new TypeError("Exact Actua match player transform must be an object.");
  }
  for (const key in partial) {
    if (!Object.hasOwn(partial, key)) continue;
    if (key !== "position" && key !== "rotation" && key !== "scale") {
      throw new Error(`Unsupported exact Actua player transform field ${key}.`);
    }
  }
  if (partial.position !== undefined) target.position = exactFiniteVec3(partial.position, "position");
  if (partial.rotation !== undefined) target.rotation = exactFiniteVec3(partial.rotation, "rotation");
  if (partial.scale !== undefined) {
    if (!Number.isFinite(partial.scale) || partial.scale <= 0) {
      throw new TypeError("Exact Actua player scale must be finite and positive.");
    }
    target.scale = partial.scale;
  }
}

function exactFiniteVec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => !Number.isFinite(entry))) {
    throw new TypeError(`Exact Actua player ${label} must contain three finite values.`);
  }
  return value;
}

function formatPresentationNumber(value) {
  return String(Number(value.toFixed(6)));
}

function assertExactPlayerAssets(value) {
  if (
    !isPlainObject(value)
    || value.schema !== "cssoccer-exact-actua-player-asset-runtime@1"
    || value.index?.counts?.sequences !== 124
    || value.index?.counts?.faceStates !== 1_827_384
    || value.materials?.counts?.fixturePlayers !== 22
    || value.materials?.geometryId !== value.index?.geometryId
    || value.materials?.topologySha256 !== value.index?.topologySha256
  ) throw new Error("Prepared match scene requires the one-basis exact Actua player runtime.");
  return value;
}

function assertExactOfficialAssets(value) {
  if (
    !isPlainObject(value)
    || value.schema !== "cssoccer-exact-actua-official-asset-runtime@1"
    || value.index?.counts?.sequences !== 11
    || value.index?.counts?.faceStates !== 89_856
    || value.materials?.counts?.fixtureOfficials !== 3
    || value.materials?.geometryId !== value.index?.geometryId
    || value.materials?.topologySha256 !== value.index?.topologySha256
  ) throw new Error("Prepared match scene requires the exact Actua official runtime.");
  return value;
}

function createRootPresentationState(mesh, hidden) {
  const state = {
    lastAnimationSlotId: -1,
    lastPreparedFrameIndex: mesh.initialFrameIndex,
    latestTransform: mesh.transform,
    visible: !hidden,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scale: 1,
  };
  recordPresentationTransform(state, mesh.transform);
  return state;
}

function animationSlotId(command) {
  return Number.isSafeInteger(command.animation.slotId)
    ? command.animation.slotId
    : null;
}

function presentationAnimationCadence(camera, position) {
  const eye = camera.rendered.renderer.eye;
  const distance = Math.hypot(
    position[0] - eye[0],
    position[1] - eye[1],
    position[2] - eye[2],
  );
  if (distance <= FULL_RATE_ANIMATION_MAX_DISTANCE) return 2;
  if (distance <= HALF_RATE_ANIMATION_MAX_DISTANCE) return 4;
  return 8;
}

function presentationTransformChanged(state, transform) {
  return state.positionX !== transform.position[0]
    || state.positionY !== transform.position[1]
    || state.positionZ !== transform.position[2]
    || state.rotationX !== transform.rotation[0]
    || state.rotationY !== transform.rotation[1]
    || state.rotationZ !== transform.rotation[2]
    || state.scale !== transform.scale;
}

function recordPresentationTransform(state, transform) {
  state.positionX = transform.position[0];
  state.positionY = transform.position[1];
  state.positionZ = transform.position[2];
  state.rotationX = transform.rotation[0];
  state.rotationY = transform.rotation[1];
  state.rotationZ = transform.rotation[2];
  state.scale = transform.scale;
}

function hasTransformInterpolation(element) {
  return element.style.transitionProperty === "transform"
    && element.style.transitionDuration !== "0ms";
}

function assertLiveRenderFrame(frame, previousTick) {
  if (
    !isPlainObject(frame)
    || frame.schema !== CSSOCCER_LIVE_RENDER_FRAME_SCHEMA
    || !Number.isSafeInteger(frame.tick)
    || frame.tick < 0
    || !isPlainObject(frame.players)
    || !Array.isArray(frame.players.commands)
    || frame.players.commands.length !== 22
    || !isPlainObject(frame.officials)
    || !Array.isArray(frame.officials.commands)
    || frame.officials.commands.length !== 3
    || !isPlainObject(frame.ball)
    || frame.ball.rootId !== "ball-00"
    || typeof frame.ball.visible !== "boolean"
    || !isPreparedTransform(frame.ball.transform)
    || !isActuaCameraInput(frame.camera)
    || !isPlayerHighlightRenderCommand(frame.playerHighlight, frame.players.commands)
    || (frame.selectedPlayerId !== null
      && !frame.players.commands.some(({ rootId }) => rootId === frame.selectedPlayerId))
    || frame.playerHighlight.playerId !== frame.selectedPlayerId
  ) {
    throw new Error("Prepared css.soccer scene requires one valid live render frame.");
  }
  const expectedTick = previousTick === null ? 0 : previousTick + 1;
  if (frame.tick !== expectedTick) {
    throw new Error(`Prepared css.soccer live render expected tick ${expectedTick}.`);
  }
  for (const command of frame.players.commands) {
    if (
      !isPlainObject(command)
      || typeof command.rootId !== "string"
      || typeof command.visible !== "boolean"
      || !isPreparedTransform(command.transform)
      || !Number.isSafeInteger(command.animation?.preparedFrameIndex)
      || command.animation.preparedFrameIndex < 0
    ) {
      throw new Error("Prepared css.soccer player render command is invalid.");
    }
  }
  const officialIds = ["referee-00", "assistant-referee-01", "assistant-referee-02"];
  for (let index = 0; index < officialIds.length; index += 1) {
    const command = frame.officials.commands[index];
    if (
      !isPlainObject(command)
      || command.rootId !== officialIds[index]
      || typeof command.visible !== "boolean"
      || !isPreparedTransform(command.transform)
      || !Number.isSafeInteger(command.animation?.slotId)
      || !Number.isSafeInteger(command.animation?.frame)
      || !Number.isFinite(command.facing?.yawDegrees)
      || command.material?.materialProfileId !== (index === 0
        ? "actua-referee-material"
        : "actua-assistant-referee-material")
      || command.material?.nativeRenderType !== (index === 0 ? 3 : 4)
    ) throw new Error("Prepared css.soccer official render command is invalid.");
  }
  return frame;
}

function isPlayerHighlightRenderCommand(value, playerCommands) {
  if (
    !isPlainObject(value)
    || value.rootId !== "player-highlight-local-user-1"
    || typeof value.visible !== "boolean"
    || !isPlainObject(value.type)
    || !Number.isSafeInteger(value.type.value)
    || value.type.value < 0
    || value.type.value > 6
    || typeof value.type.id !== "string"
    || typeof value.type.semantic !== "string"
    || !isPlainObject(value.family)
    || !Number.isSafeInteger(value.family.frameIndex)
    || value.family.frameIndex < 0
    || value.family.frameIndex > 3
    || typeof value.family.frameId !== "string"
    || !isPlainObject(value.material)
    || value.material.hcol !== 0
    || value.material.id !== "player-highlight-colour-0"
    || !isPreparedTransform(value.transform)
    || !new Set(["none", "field-aligned", "player-facing"]).has(value.facingMode)
    || !new Set(["hidden", "steady", "source-half-cycle"]).has(value.blinkMode)
    || !new Set(["eligible", "suppressed"]).has(value.ordinaryShadow)
  ) return false;
  if (value.playerId === null) {
    return value.nativePlayerNumber === null
      && value.visible === false
      && value.type.value === 0
      && value.family.id === null
      && value.ordinaryShadow === "eligible";
  }
  const player = playerCommands.find(({ rootId }) => rootId === value.playerId);
  if (
    player === undefined
    || value.nativePlayerNumber !== player.nativePlayerNumber
    || value.type.value === 0
    || typeof value.family.id !== "string"
    || value.ordinaryShadow !== "suppressed"
    || !sameVector3(value.transform.position, player.transform.position)
  ) return false;
  const expectedRotation = value.facingMode === "player-facing"
    ? player.transform.rotation
    : [0, 0, 0];
  return sameVector3(value.transform.rotation, expectedRotation);
}

function sameVector3(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === 3
    && right.length === 3
    && left.every((value, index) => Object.is(value, right[index]));
}

export function assertPreparedMatchMountContract(sceneData, renderAssets) {
  if (
    !isPlainObject(sceneData)
    || sceneData.id !== FIXTURE_ID
    || sceneData.status !== "ready"
    || !Array.isArray(sceneData.meshes)
    || sceneData.meshes.length !== 36
  ) {
    throw new Error("Prepared css.soccer mount requires the canonical ready 36-root scene.");
  }
  assertZeroRuntimeConstruction(sceneData.runtimeConstruction, {
    label: "prepared scene",
    includeAtlas: true,
  });
  const { rootsById, rootCounts, rootKindById } = collectSceneRoots(sceneData.roots);
  const meshIds = new Set();
  for (const [index, mesh] of sceneData.meshes.entries()) {
    if (
      !isPlainObject(mesh)
      || !SAFE_ID.test(mesh.id ?? "")
      || mesh.stableDom !== true
      || rootKindById.get(mesh.id) !== mesh.kind
      || typeof mesh.bundleId !== "string"
      || (mesh.frameSetId !== null && typeof mesh.frameSetId !== "string")
      || !isPreparedTransform(mesh.transform)
      || (mesh.frameSetId === null
        ? mesh.initialFrameIndex !== null
        : !Number.isSafeInteger(mesh.initialFrameIndex) || mesh.initialFrameIndex < 0)
      || Object.hasOwn(mesh, "polygons")
      || Object.hasOwn(mesh, "objectUrls")
      || Object.hasOwn(mesh, "assets")
    ) {
      throw new Error(`Prepared scene mesh ${index} is not a stable root binding.`);
    }
    if (meshIds.has(mesh.id)) throw new Error(`Duplicate prepared scene root ${mesh.id}.`);
    meshIds.add(mesh.id);
  }
  if (meshIds.size !== rootsById.size || [...rootsById.keys()].some((id) => !meshIds.has(id))) {
    throw new Error("Prepared scene roots and mesh bindings do not match exactly.");
  }

  if (
    !isPlainObject(renderAssets)
    || renderAssets.schema !== RENDER_PUBLICATION_SCHEMA
    || renderAssets.id !== FIXTURE_ID
    || renderAssets.status !== "ready"
    || !Array.isArray(renderAssets.bundles)
    || !Array.isArray(renderAssets.frameSets)
    || !Array.isArray(renderAssets.rootBindings)
    || renderAssets.rootBindings.length !== 36
    || renderAssets.lineage?.productionReference !== "cssQuake"
  ) {
    throw new Error("Prepared css.soccer render-bundle publication is incomplete.");
  }
  assertZeroRuntimeConstruction(renderAssets.runtimeConstruction, {
    label: "render-bundle publication",
  });
  const bundlesById = uniqueById(renderAssets.bundles, "prepared render bundle");
  const frameSetsById = uniqueById(renderAssets.frameSets, "prepared render frame set");
  const bindingsByRootId = uniqueByKey(
    renderAssets.rootBindings,
    "rootId",
    "prepared render root binding",
  );
  if (
    renderAssets.counts?.bundles !== renderAssets.bundles.length
    || renderAssets.counts?.frameSets !== renderAssets.frameSets.length
    || renderAssets.counts?.staticRootBindings !== 9
    || renderAssets.counts?.highlightRootBindings !== 1
    || renderAssets.counts?.actorRootBindings !== 26
    || renderAssets.counts?.rootBindings !== 36
  ) {
    throw new Error("Prepared render-bundle publication counts changed from the fixed scene.");
  }
  for (const mesh of sceneData.meshes) {
    const binding = bindingsByRootId.get(mesh.id);
    const exactPlayerBinding = mesh.kind === "player"
      && mesh.bundleId === EXACT_PLAYER_RENDER_BINDING_ID
      && mesh.frameSetId === null;
    const exactOfficialBinding = mesh.kind === "official"
      && mesh.bundleId === EXACT_OFFICIAL_RENDER_BINDING_ID
      && mesh.frameSetId === null;
    if (
      !binding
      || binding.bundleId !== mesh.bundleId
      || (binding.frameSetId ?? null) !== mesh.frameSetId
      || (!exactPlayerBinding
        && !exactOfficialBinding
        && !bundlesById.has(mesh.bundleId))
    ) {
      throw new Error(`Prepared root ${mesh.id} changed its render-bundle binding.`);
    }
    if (mesh.frameSetId !== null) {
      const frameSet = frameSetsById.get(mesh.frameSetId);
      const publishedBundle = bundlesById.get(mesh.bundleId);
      if (
        !frameSet
        || frameSet.bundle?.id !== mesh.bundleId
        || frameSet.bundle?.bundleHash !== publishedBundle?.bundleHash
        || mesh.initialFrameIndex >= frameSet.frameCount
      ) {
        throw new Error(`Prepared root ${mesh.id} changed its stable frame-set binding.`);
      }
    }
  }
  if (bindingsByRootId.size !== meshIds.size
      || [...bindingsByRootId.keys()].some((id) => !meshIds.has(id))) {
    throw new Error("Prepared render root bindings do not match the scene exactly.");
  }
  return Object.freeze({
    bindingsByRootId,
    bundlesById,
    frameSetsById,
    rootCounts: Object.freeze(rootCounts),
    rootsById,
  });
}

function collectSceneRoots(roots) {
  if (!isPlainObject(roots)) throw new Error("Prepared scene roots must be grouped.");
  const rootsById = new Map();
  const rootKindById = new Map();
  const rootCounts = {};
  for (const { key, kind, count } of ROOT_GROUPS) {
    const entries = roots[key];
    if (!Array.isArray(entries) || entries.length !== count) {
      throw new Error(`Prepared scene requires exactly ${count} ${key} roots.`);
    }
    rootCounts[kind] = entries.length;
    for (const root of entries) {
      if (
        !isPlainObject(root)
        || !SAFE_ID.test(root.id ?? "")
        || root.stableDom !== true
      ) {
        throw new Error(`Prepared ${kind} root is not stable.`);
      }
      if (rootsById.has(root.id)) throw new Error(`Duplicate prepared root ${root.id}.`);
      rootsById.set(root.id, root);
      rootKindById.set(root.id, kind);
    }
  }
  return { rootsById, rootCounts, rootKindById };
}

function createActuaGameplayCameraContext() {
  if (BASE_TILE !== CSSOCCER_ACTUA_GAMEPLAY_CAMERA.polycssTileSize) {
    throw new Error("PolyCSS tile size changed from the Actua gameplay camera contract.");
  }
  return createPolyPerspectiveCamera({
    target: [0, 0, 0],
    perspective: CSSOCCER_ACTUA_GAMEPLAY_CAMERA.projectionScale,
    rotX: CSSOCCER_PRESENTATION_CAMERA_PRESET.rotX,
    rotY: CSSOCCER_PRESENTATION_CAMERA_PRESET.rotY,
    zoom: 1,
    distance: 0,
  });
}

function advanceActuaGameplayCamera(camera, frame) {
  const input = frame.camera;
  if (frame.tick === 0) {
    return createCssoccerActuaGameplayCamera({
      tick: 0,
      effectiveBall: input.effectiveBall,
    });
  }
  // The retained native terminal tick publishes the existing framebuffer and
  // has no update_3d camera sample. Hold the last rendered gameplay camera.
  if (frame.terminal) return camera;
  return stepCssoccerActuaGameplayCamera(camera, {
    tick: frame.tick,
    effectiveBall: input.effectiveBall,
    justScored: input.justScored,
    goalScorer: input.goalScorer,
    matchMode: input.matchMode,
    lastTouch: input.lastTouch,
    restartTaker: input.restartTaker,
  });
}

function applyActuaGameplayCamera(sceneElement, camera) {
  const transform = formatCssoccerActuaSceneMatrix3d(camera);
  if (sceneElement.style.transform !== transform) sceneElement.style.transform = transform;
  setDatasetValue(sceneElement, "cssoccerCameraSchema", camera.schema);
  setDatasetValue(sceneElement, "cssoccerCameraMode", camera.sourceMode);
}

function setHidden(element, hidden) {
  if (element.hidden === hidden) return false;
  element.hidden = hidden;
  return true;
}

function setDatasetValue(element, name, value) {
  const stringValue = String(value);
  if (element.dataset[name] === stringValue) return false;
  element.dataset[name] = stringValue;
  return true;
}

function setOptionalDatasetValue(element, name, value) {
  if (value !== null && value !== undefined) return setDatasetValue(element, name, value);
  if (!Object.hasOwn(element.dataset, name)) return false;
  delete element.dataset[name];
  return true;
}

function syncPolycssCameraFacing(camera, presentationCamera) {
  const { eye, target } = presentationCamera.rendered.renderer;
  const deltaX = target[0] - eye[0];
  const deltaY = target[1] - eye[1];
  const deltaZ = target[2] - eye[2];
  const horizontal = Math.hypot(deltaX, deltaZ);
  if (!(horizontal > 0)) {
    throw new Error("Actua gameplay camera cannot publish its source-facing direction.");
  }
  camera.state.rotX = -Math.atan2(-deltaY, horizontal) * 180 / Math.PI;
  camera.state.rotY = normalizeDegrees(
    Math.atan2(deltaX, deltaZ) * 180 / Math.PI - 90,
  );
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function createPresentationCameraBinding(sceneData) {
  if (
    sceneData.axes?.coordinateSpace !== "Actua renderer world"
    || sceneData.axes.verticalAxis !== "y"
    || !isFiniteVec3(sceneData.cameraAnchor?.target)
    || !isFiniteVec3(sceneData.cameraAnchor?.playingFieldCenter)
  ) {
    throw new Error("Prepared scene is missing its Actua renderer axes or camera anchor.");
  }
  return freezeStaticPresentation({
    presetId: CSSOCCER_PRESENTATION_CAMERA_PRESET.id,
    status: CSSOCCER_PRESENTATION_CAMERA_PRESET.status,
    nativeParity: CSSOCCER_PRESENTATION_CAMERA_PRESET.nativeParity,
    coordinateSpace: sceneData.axes.coordinateSpace,
    verticalAxis: sceneData.axes.verticalAxis,
    components: clonePreparedMetadata(sceneData.axes.components),
    gameplayToRenderer: clonePreparedMetadata(sceneData.axes.gameplayToRenderer),
    anchorStatus: sceneData.cameraAnchor.status,
    position: [...CSSOCCER_PRESENTATION_CAMERA_PRESET.position],
    sourceTarget: [...CSSOCCER_PRESENTATION_CAMERA_PRESET.sourceTarget],
    target: [...CSSOCCER_PRESENTATION_CAMERA_PRESET.target],
    presentationAxis: clonePreparedMetadata(
      CSSOCCER_PRESENTATION_CAMERA_PRESET.presentationAxis,
    ),
    playingFieldCenter: [...sceneData.cameraAnchor.playingFieldCenter],
    perspective: CSSOCCER_PRESENTATION_CAMERA_PRESET.perspective,
    rotX: CSSOCCER_PRESENTATION_CAMERA_PRESET.rotX,
    rotY: CSSOCCER_PRESENTATION_CAMERA_PRESET.rotY,
    zoom: CSSOCCER_PRESENTATION_CAMERA_PRESET.zoom,
    distance: CSSOCCER_PRESENTATION_CAMERA_PRESET.distance,
  });
}

function createActuaGameplayCameraBinding(sceneData, camera) {
  return {
    schema: camera.schema,
    status: "source-gameplay-camera",
    coordinateSpace: sceneData.axes.coordinateSpace,
    verticalAxis: sceneData.axes.verticalAxis,
    source: clonePreparedMetadata(camera.source),
    tick: camera.tick,
    sourceMode: camera.sourceMode,
    sourceLabel: camera.sourceLabel,
    modeEnteredTick: camera.modeEnteredTick,
    justScored: camera.justScored,
    lastTouch: camera.lastTouch,
    restartTaker: camera.restartTaker,
    trackedPlayer: clonePreparedMetadata(camera.trackedPlayer),
    effectiveBall: clonePreparedMetadata(camera.effectiveBall),
    desired: clonePreparedMetadata(camera.desired),
    rendered: clonePreparedMetadata(camera.rendered),
    projection: clonePreparedMetadata(camera.projection),
    sceneMatrix: formatCssoccerActuaSceneMatrix3d(camera),
  };
}

function uniqueById(entries, label) {
  return uniqueByKey(entries, "id", label);
}

function uniqueByKey(entries, key, label) {
  const byKey = new Map();
  for (const [index, entry] of entries.entries()) {
    const value = entry?.[key];
    if (!isPlainObject(entry) || !SAFE_ID.test(value ?? "")) {
      throw new Error(`${label} ${index} has no safe ${key}.`);
    }
    if (byKey.has(value)) throw new Error(`Duplicate ${label} ${value}.`);
    byKey.set(value, entry);
  }
  return byKey;
}

function assertZeroRuntimeConstruction(value, { label, includeAtlas = false }) {
  const keys = includeAtlas
    ? [...ZERO_CONSTRUCTION_KEYS, "atlasBuildCount"]
    : ZERO_CONSTRUCTION_KEYS;
  if (!isPlainObject(value) || keys.some((key) => value[key] !== 0)) {
    throw new Error(`${label} violates zero runtime construction.`);
  }
}

function zeroRuntimeConstruction(includeAtlas = false) {
  const value = Object.fromEntries(ZERO_CONSTRUCTION_KEYS.map((key) => [key, 0]));
  if (includeAtlas) value.atlasBuildCount = 0;
  return value;
}

function isActuaCameraInput(value) {
  if (
    !isPlainObject(value)
    || !isPlainObject(value.effectiveBall)
    || ![value.effectiveBall.x, value.effectiveBall.y, value.effectiveBall.z]
      .every(Number.isFinite)
    || !Number.isSafeInteger(value.justScored)
    || value.justScored < 0
    || value.justScored > CSSOCCER_ACTUA_GAMEPLAY_CAMERA.celebration.scoreWait
    || !Number.isSafeInteger(value.matchMode)
    || value.matchMode < 0
    || value.matchMode > 255
    || !Number.isSafeInteger(value.lastTouch)
    || value.lastTouch < 0
    || value.lastTouch > 22
    || !(
      value.restartTaker === null
      || (
        Number.isSafeInteger(value.restartTaker)
        && value.restartTaker >= 1
        && value.restartTaker <= 22
      )
    )
  ) {
    return false;
  }
  const scorer = value.goalScorer;
  return scorer === null || (
    isPlainObject(scorer)
    && Number.isSafeInteger(scorer.nativePlayerNumber)
    && scorer.nativePlayerNumber >= 1
    && scorer.nativePlayerNumber <= 22
    && isPlainObject(scorer.position)
    && [scorer.position.x, scorer.position.y, scorer.position.z].every(Number.isFinite)
    && isPlainObject(scorer.displacement)
    && [scorer.displacement.x, scorer.displacement.y].every(Number.isFinite)
  );
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function isFiniteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function isPreparedTransform(value) {
  if (
    !isPlainObject(value)
    || JSON.stringify(Object.keys(value).sort()) !== '["position","rotation","scale"]'
    || !isFiniteVec3(value.position)
    || !isFiniteVec3(value.rotation)
  ) {
    return false;
  }
  return (Number.isFinite(value.scale) && value.scale !== 0)
    || (isFiniteVec3(value.scale) && value.scale.every((entry) => entry !== 0));
}

function clonePreparedMetadata(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function freezeStaticPresentation(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeStaticPresentation(child);
  }
  return value;
}

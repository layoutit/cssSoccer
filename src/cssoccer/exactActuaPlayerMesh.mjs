export const CSSOCCER_EXACT_ACTUA_PLAYER_MESH_RUNTIME_SCHEMA =
  "cssoccer-exact-actua-player-mesh-runtime@2";

export function mountExactActuaPlayerMesh({
  root,
  assetRuntime,
  materialProfileId,
  shirtNumber,
  initialState,
} = {}) {
  assertRoot(root);
  assertAssetRuntime(assetRuntime);
  const profile = assetRuntime.materials.materialProfiles?.[materialProfileId];
  const faceCount = assetRuntime.index.counts.facesPerSample;
  if (
    !profile
    || profile.geometryId !== assetRuntime.index.geometryId
    || profile.topologySha256 !== assetRuntime.index.topologySha256
    || profile.faces?.length !== faceCount
  ) throw new Error(`Exact Actua material profile ${String(materialProfileId)} is invalid.`);
  let numberBinding = null;
  if (profile.shirtNumbers === null) {
    if (shirtNumber !== null && shirtNumber !== undefined) {
      throw new Error(`${materialProfileId} does not accept a shirt-number binding.`);
    }
  } else {
    if (!Number.isSafeInteger(shirtNumber) || shirtNumber < 1 || shirtNumber > 15) {
      throw new RangeError("Exact Actua shirt number must be inside 1..15.");
    }
    numberBinding = profile.shirtNumbers?.byPlayerNumber?.[shirtNumber] ?? null;
    if (!numberBinding) {
      throw new Error(`${materialProfileId} shirt number ${shirtNumber} is unavailable.`);
    }
  }
  if (root.childNodes.length !== 0) {
    throw new Error("Exact Actua player root must be empty before mount.");
  }
  const counters = {
    mountNodeCreations: 0,
    mountDomInsertions: 0,
    mountImmutableStyleWrites: 0,
    mountInitialStateWrites: 0,
    updates: 0,
    transformWrites: 0,
    backgroundPositionXWrites: 0,
    backgroundPositionYWrites: 0,
    visibilityWrites: 0,
    redundantStateSkips: 0,
    unchangedPropertySkips: 0,
    nodeCreations: 0,
    domInsertions: 0,
    domRemovals: 0,
    domReorders: 0,
    runtimeConstruction: 0,
  };
  root.style.position = "relative";
  root.style.width = "640px";
  root.style.height = "400px";
  root.style.transform = "scaleY(-1)";
  root.style.transformOrigin = "50% 50%";
  root.style.transformStyle = "preserve-3d";
  const invariant = profile.invariantLeafStyle;
  const leaves = Array.from({ length: faceCount }, (_, faceIndex) => {
    const leaf = root.ownerDocument.createElement("s");
    counters.mountNodeCreations += 1;
    leaf.dataset.cssoccerExactFaceIndex = String(faceIndex);
    leaf.dataset.cssoccerExactGeometryId = assetRuntime.index.geometryId;
    setMountStyle(leaf, "display", "block");
    setMountStyle(leaf, "position", "absolute");
    setMountStyle(leaf, "left", "0px");
    setMountStyle(leaf, "top", "0px");
    setMountStyle(leaf, "width", invariant.width);
    setMountStyle(leaf, "height", invariant.height);
    setMountStyle(leaf, "backgroundImage", invariant.backgroundImage);
    setMountStyle(leaf, "backgroundSize", invariant.backgroundSize);
    setMountStyle(leaf, "backgroundRepeat", invariant.backgroundRepeat);
    setMountStyle(leaf, "imageRendering", invariant.imageRendering);
    setMountStyle(leaf, "transformOrigin", invariant.transformOrigin);
    setMountStyle(leaf, "pointerEvents", "none");
    root.append(leaf);
    counters.mountDomInsertions += 1;
    return leaf;
  });
  const identities = Object.freeze([...leaves]);
  const cache = Array.from({ length: faceCount }, () => Object.create(null));
  let appliedStateKey = null;
  let currentMounting = false;
  let removed = false;
  applyState(initialState, true);

  return Object.freeze({
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_MESH_RUNTIME_SCHEMA,
    geometryId: assetRuntime.index.geometryId,
    topologySha256: assetRuntime.index.topologySha256,
    materialProfileId,
    shirtNumber,
    leaves: identities,
    updateState(state) {
      return applyState(state, false);
    },
    updateStateFields(slotId, localFrameIndex, yawIndex) {
      return applyStateFields(slotId, localFrameIndex, yawIndex, false);
    },
    stats() {
      return Object.freeze({
        ...counters,
        leafCount: leaves.length,
        identityStable: leaves.every((leaf, index) => leaf === identities[index]),
        connectedLeaves: leaves.filter((leaf) => leaf.isConnected).length,
        appliedStateKey,
      });
    },
    remove() {
      if (removed) return;
      removed = true;
      root.remove();
    },
  });

  function applyState(state, mounting) {
    const checked = checkedState(state);
    return applyStateFields(
      checked.slotId,
      checked.localFrameIndex,
      checked.yawIndex,
      mounting,
    );
  }

  function applyStateFields(slotId, localFrameIndex, yawIndex, mounting) {
    checkedStateFields(slotId, localFrameIndex, yawIndex);
    const stateKey = `${slotId}:${localFrameIndex}:${yawIndex}`;
    if (!mounting && stateKey === appliedStateKey) {
      counters.redundantStateSkips += 1;
      return false;
    }
    currentMounting = mounting;
    assetRuntime.applySampleFields(slotId, localFrameIndex, yawIndex, applyFace);
    appliedStateKey = stateKey;
    if (!mounting) counters.updates += 1;
    return true;
  }

  function applyFace(faceIndex, transform, visible, materialSelectorOffset) {
    const material = profile.shirtNumbers !== null
      && faceIndex === profile.shirtNumbers.faceIndex
      ? numberBinding
      : profile.faces[faceIndex].slotsBySelectorOffset?.[materialSelectorOffset] ?? null;
    if (visible && !material) {
      throw new Error(
        `${materialProfileId} face ${faceIndex} lacks selector ${materialSelectorOffset}.`,
      );
    }
    const leaf = leaves[faceIndex];
    const faceCache = cache[faceIndex];
    writeRuntimeProperty(
      leaf,
      faceCache,
      "transform",
      transform,
      "transformWrites",
      currentMounting,
    );
    writeRuntimeProperty(
      leaf,
      faceCache,
      "backgroundPositionX",
      material?.backgroundPositionX ?? faceCache.backgroundPositionX,
      "backgroundPositionXWrites",
      currentMounting,
    );
    writeRuntimeProperty(
      leaf,
      faceCache,
      "backgroundPositionY",
      material?.backgroundPositionY ?? faceCache.backgroundPositionY,
      "backgroundPositionYWrites",
      currentMounting,
    );
    writeRuntimeProperty(
      leaf,
      faceCache,
      "visibility",
      visible ? "visible" : "hidden",
      "visibilityWrites",
      currentMounting,
    );
  }

  function setMountStyle(leaf, property, value) {
    leaf.style[property] = value;
    counters.mountImmutableStyleWrites += 1;
  }

  function writeRuntimeProperty(
    leaf,
    faceCache,
    property,
    value,
    counter,
    mounting,
  ) {
    if (value === undefined || faceCache[property] === value) {
      if (!mounting) counters.unchangedPropertySkips += 1;
      return;
    }
    leaf.style[property] = value;
    faceCache[property] = value;
    if (mounting) counters.mountInitialStateWrites += 1;
    else counters[counter] += 1;
  }
}

function checkedState(value) {
  if (
    !value
    || typeof value !== "object"
    || !Number.isSafeInteger(value.slotId)
    || !Number.isSafeInteger(value.localFrameIndex)
    || !Number.isSafeInteger(value.yawIndex)
  ) throw new TypeError("Exact Actua player state address is invalid.");
  return value;
}

function checkedStateFields(slotId, localFrameIndex, yawIndex) {
  if (!Number.isSafeInteger(slotId)
      || !Number.isSafeInteger(localFrameIndex)
      || !Number.isSafeInteger(yawIndex)) {
    throw new TypeError("Exact Actua player state address is invalid.");
  }
}

function assertRoot(root) {
  if (!root || !root.ownerDocument || typeof root.append !== "function" || !root.style) {
    throw new TypeError("Exact Actua player mount requires a DOM element root.");
  }
}

function assertAssetRuntime(value) {
  const player = value?.schema === "cssoccer-exact-actua-player-asset-runtime@1"
    && value.index?.counts?.facesPerSample === 13
    && value.index?.counts?.faceStates === 1_827_384
    && value.materials?.counts?.fixturePlayers === 22;
  const official = value?.schema === "cssoccer-exact-actua-official-asset-runtime@1"
    && value.index?.counts?.facesPerSample === 12
    && value.index?.counts?.faceStates === 19_584
    && value.materials?.counts?.fixtureOfficials === 3;
  if (!player && !official) {
    throw new TypeError("Exact Actua actor mount requires a checked one-basis asset runtime.");
  }
}

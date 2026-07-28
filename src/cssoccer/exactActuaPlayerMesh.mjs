export const CSSOCCER_EXACT_ACTUA_PLAYER_MESH_RUNTIME_SCHEMA =
  "cssoccer-exact-actua-player-mesh-runtime@2";

export function mountExactActuaPlayerMesh({
  root,
  assetRuntime,
  materialProfileId,
  shirtNumber,
  initialState,
  viewportWidth = 640,
  viewportHeight = 400,
  splitNumberPanel = false,
} = {}) {
  assertRoot(root);
  assertAssetRuntime(assetRuntime);
  const profile = assetRuntime.materials.materialProfiles?.[materialProfileId];
  const geometryVariant = profile?.geometryVariant ?? "outfield";
  const geometry = assetRuntime.materials.geometryVariants?.[geometryVariant]
    ?? {
      geometryId: assetRuntime.index.geometryId,
      topologySha256: assetRuntime.index.topologySha256,
    };
  const faceCount = assetRuntime.index.counts.facesPerSample;
  if (
    !Number.isSafeInteger(viewportWidth)
    || viewportWidth <= 0
    || !Number.isSafeInteger(viewportHeight)
    || viewportHeight <= 0
  ) {
    throw new RangeError("Exact Actua player viewport must use positive integer dimensions.");
  }
  if (
    !profile
    || profile.geometryId !== geometry.geometryId
    || profile.topologySha256 !== geometry.topologySha256
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
    liveProjectionUpdates: 0,
    nodeCreations: 0,
    domInsertions: 0,
    domRemovals: 0,
    domReorders: 0,
    runtimeConstruction: 0,
  };
  root.style.position = "relative";
  root.style.width = `${viewportWidth}px`;
  root.style.height = `${viewportHeight}px`;
  root.style.transform = "scaleY(-1)";
  root.style.transformOrigin = "50% 50%";
  root.style.transformStyle = "preserve-3d";
  const invariant = profile.invariantLeafStyle;
  const primaryLeaves = Array.from({ length: faceCount }, (_, faceIndex) => (
    createLeaf(faceIndex, "primary")
  ));
  const numberFaceIndex = profile.shirtNumbers?.faceIndex ?? null;
  const numberSecondaryLeaf = splitNumberPanel && numberFaceIndex !== null
    ? createLeaf(numberFaceIndex, "secondary")
    : null;
  if (splitNumberPanel && numberSecondaryLeaf === null) {
    throw new Error("Exact Actua split number panel requires a shirt-number profile.");
  }
  if (numberSecondaryLeaf) {
    setMountStyle(
      primaryLeaves[numberFaceIndex],
      "clipPath",
      "polygon(0 0, 100% 0, 100% 100%)",
    );
    setMountStyle(
      numberSecondaryLeaf,
      "clipPath",
      "polygon(0 0, 100% 100%, 0 100%)",
    );
  }
  const leaves = [
    ...primaryLeaves,
    ...(numberSecondaryLeaf ? [numberSecondaryLeaf] : []),
  ];

  function createLeaf(faceIndex, part) {
    const leaf = root.ownerDocument.createElement("s");
    counters.mountNodeCreations += 1;
    leaf.dataset.cssoccerExactFaceIndex = String(faceIndex);
    leaf.dataset.cssoccerExactGeometryId = geometry.geometryId;
    leaf.dataset.cssoccerExactFacePart = part;
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
  }
  const identities = Object.freeze([...leaves]);
  const cache = Array.from({ length: leaves.length }, () => Object.create(null));
  let appliedStateKey = null;
  let currentMounting = false;
  let removed = false;
  applyState(initialState, true);

  return Object.freeze({
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_MESH_RUNTIME_SCHEMA,
    geometryId: geometry.geometryId,
    topologySha256: geometry.topologySha256,
    geometryVariant,
    materialProfileId,
    shirtNumber,
    leaves: identities,
    updateState(state) {
      return applyState(state, false);
    },
    updateStateFields(slotId, localFrameIndex, yawIndex) {
      return applyStateFields(slotId, localFrameIndex, yawIndex, false);
    },
    applyLiveProjection(stateKey, project) {
      if (typeof stateKey !== "string" || stateKey.length === 0) {
        throw new TypeError("Exact Actua live projection state key is invalid.");
      }
      if (typeof project !== "function") {
        throw new TypeError("Exact Actua live projection requires a projector.");
      }
      currentMounting = false;
      project(applyFace);
      appliedStateKey = stateKey;
      counters.updates += 1;
      counters.liveProjectionUpdates += 1;
      return true;
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
    if (typeof assetRuntime.applyVariantSampleFields === "function") {
      assetRuntime.applyVariantSampleFields(
        slotId,
        localFrameIndex,
        yawIndex,
        geometryVariant,
        applyFace,
      );
    } else {
      assetRuntime.applySampleFields(slotId, localFrameIndex, yawIndex, applyFace);
    }
    appliedStateKey = stateKey;
    if (!mounting) counters.updates += 1;
    return true;
  }

  function applyFace(
    faceIndex,
    transform,
    visible,
    materialSelectorOffset,
    _depth = null,
    secondaryTransform = null,
  ) {
    const material = profile.shirtNumbers !== null
      && faceIndex === profile.shirtNumbers.faceIndex
      ? numberBinding
      : profile.faces[faceIndex].slotsBySelectorOffset?.[materialSelectorOffset] ?? null;
    if (visible && !material) {
      throw new Error(
        `${materialProfileId} face ${faceIndex} lacks selector ${materialSelectorOffset}.`,
      );
    }
    const leaf = primaryLeaves[faceIndex];
    const faceCache = cache[faceIndex];
    applyLeaf(
      leaf,
      faceCache,
      transform,
      visible,
      material,
    );
    if (faceIndex === numberFaceIndex && numberSecondaryLeaf) {
      applyLeaf(
        numberSecondaryLeaf,
        cache[faceCount],
        secondaryTransform,
        visible && secondaryTransform !== null,
        material,
      );
    }
  }

  function applyLeaf(leaf, faceCache, transform, visible, material) {
    if (visible && transform !== null) {
      writeRuntimeProperty(
        leaf,
        faceCache,
        "transform",
        transform,
        "transformWrites",
        currentMounting,
      );
    }
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
    && value.index?.counts?.geometryVariants === 2
    && value.index?.counts?.variantFaceStates === 3_654_768
    && value.index?.counts?.poseCoordinates === 491_988
    && value.materials?.counts?.fixturePlayers === 22;
  const official = value?.schema === "cssoccer-exact-actua-official-asset-runtime@1"
    && value.index?.counts?.facesPerSample === 12
    && value.index?.counts?.faceStates === 89_856
    && value.materials?.counts?.fixtureOfficials === 3;
  if (!player && !official) {
    throw new TypeError("Exact Actua actor mount requires a checked one-basis asset runtime.");
  }
}

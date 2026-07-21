import {
  buildPolyMeshTransform,
  injectPolyBaseStyles,
} from "@layoutit/polycss";

const RENDER_BUNDLE_SCHEMA = "cssoccer-prepared-render-bundle@1";
const RENDER_FRAME_SET_SCHEMA = "cssoccer-prepared-render-frame-set@1";
const INLINE_FRAME_LEAF_STYLES = "inline-css-text@1";
export const CSSOCCER_PACKED_FRAME_LEAF_STYLES = "cssquake-packed-frame-styles@3";
const PACKED_FRAME_STYLES_SCHEMA = "cssoccer-packed-render-frame-styles@1";
const PACKED_FRAME_STYLES_VERSION = 3;
export const CSSOCCER_PACKED_FRAME_STYLE_CHUNK_LIMIT = 12;
const SAFE_ID = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/u;
const SAFE_HASH = /^[0-9a-f]{64}$/u;
const SAFE_STYLE_CLASS = /^cssoccer-rb-[0-9a-f]{16}$/u;
const SAFE_LEAF_CLASS = /^cssoccer-rbl-[0-9a-z]+$/u;
const SAFE_FRAME_STYLE_PATH = /^assets\/animation\/[a-z0-9][a-z0-9_-]*\/(?:slot-[0-9]{3}|frames-[0-9]{6}-[0-9]{6})\.json$/u;
const SAFE_PREPARED_LEAF_CLASSES = new Set(["cssoccer-two-sided-face"]);
const LEAF_TAGS = new Set(["b", "i", "s", "u"]);
const SAFE_ASSET_URL = /^\/cssoccer\/assets\/textures\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/u;
const SAFE_ROOT_PROPERTIES = new Set(["--polycss-paint"]);
const SAFE_LEAF_PROPERTIES = new Set([
  "background-attachment",
  "background-clip",
  "background-color",
  "background-image",
  "background-origin",
  "background-position",
  "background-position-x",
  "background-position-y",
  "background-repeat",
  "background-size",
  "background-blend-mode",
  "border-bottom-color",
  "border-bottom-style",
  "border-bottom-width",
  "border-image-outset",
  "border-image-repeat",
  "border-image-slice",
  "border-image-source",
  "border-image-width",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-shape",
  "border-top-color",
  "border-top-style",
  "border-top-width",
  "border-radius",
  "box-sizing",
  "color",
  "corner-bottom-left-shape",
  "corner-bottom-right-shape",
  "corner-top-left-shape",
  "corner-top-right-shape",
  "height",
  "image-rendering",
  "mask-image",
  "transform",
  "visibility",
  "width",
  "-webkit-mask-image",
  "--pnx",
  "--pny",
  "--pnz",
  "--polycss-atlas-height",
  "--polycss-atlas-leaf-sizing",
  "--polycss-atlas-width",
]);
const UNSAFE_CSS_VALUE = /(?:(?:linear|radial|conic)-gradient\s*\(|expression\s*\(|javascript:|data:|blob:|clip-path|[{}<>\r\n;])/iu;
const templatesByDocument = new WeakMap();
const stylesByDocument = new WeakMap();
const validatedBundlesByDocument = new WeakMap();
const validatedFrameSetsByDocument = new WeakMap();
const packedFrameStyleChunksByFrameSet = new WeakMap();
const packedFrameStyleLoadersByFrameSet = new WeakMap();
const packedBaseFrameStylesByFrameSet = new WeakMap();
const packedFrameStyleRuntimeByFrameSet = new WeakMap();

/** Mount one prepare-serialized mesh without receiving or rebuilding polygons. */
export function mountCssoccerRenderBundleMesh(sceneElement, bundle, options = {}) {
  const mounted = mountBundle(sceneElement, bundle);
  if (options.transform !== undefined) mounted.handle.setTransform(options.transform);
  return Object.freeze(mounted.handle);
}

/** Mount one stable frame set and swap only prepared root/leaf styles. */
export function mountCssoccerRenderBundleFrameSetMesh(
  sceneElement,
  frameSet,
  frameIndex = 0,
  options = {},
) {
  const document = ownerDocumentFor(sceneElement);
  assertCssoccerPreparedRenderFrameSet(frameSet, document);
  const mounted = mountBundle(sceneElement, frameSet.bundle, { skipValidation: true });
  const { counters, element, handle, leaves } = mounted;
  const preparedFrameState = createPreparedFrameState(frameSet, leaves.length);
  const requestedFrameIndex = boundedFrameIndex(frameSet, frameIndex);
  if (frameSet.frameLeafStyleEncoding === CSSOCCER_PACKED_FRAME_LEAF_STYLES
      && !canApplyPackedFrameStyles(frameSet, requestedFrameIndex)) {
    mounted.handle.remove();
    throw new Error(
      `Packed cssoccer initial frame ${requestedFrameIndex} was not preloaded for ${frameSet.id}.`,
    );
  }
  let currentFrameIndex = requestedFrameIndex;
  applyPreparedFrame(
    element,
    leaves,
    frameSet,
    currentFrameIndex,
    preparedFrameState,
    counters,
  );
  counters.frameStyleApplyCount += 1;
  Object.assign(handle, {
    getFrameIndex: () => currentFrameIndex,
    setFrameIndex(nextFrameIndex) {
      const bounded = boundedFrameIndex(frameSet, nextFrameIndex);
      if (bounded === currentFrameIndex) return false;
      if (frameSet.frameLeafStyleEncoding === CSSOCCER_PACKED_FRAME_LEAF_STYLES
          && !canApplyPackedFrameStyles(frameSet, bounded)) {
        requestPackedFrameStyles(frameSet, bounded);
        return false;
      }
      applyPreparedFrame(
        element,
        leaves,
        frameSet,
        bounded,
        preparedFrameState,
        counters,
      );
      currentFrameIndex = bounded;
      counters.frameStyleApplyCount += 1;
      return true;
    },
  });
  if (options.transform !== undefined) handle.setTransform(options.transform);
  return Object.freeze(handle);
}

/** Bind the hash-verifying manifest loader used for on-demand animation slots. */
export function configureCssoccerPackedFrameStyleLoader(frameSet, loader) {
  if (frameSet?.frameLeafStyleEncoding !== CSSOCCER_PACKED_FRAME_LEAF_STYLES
      || typeof loader !== "function") {
    throw new Error("Packed cssoccer frame-style loader is invalid.");
  }
  packedFrameStyleLoadersByFrameSet.set(frameSet, loader);
  return frameSet;
}

export function preloadCssoccerPackedFrameStyles(frameSet, frameIndex) {
  const bounded = boundedFrameIndex(frameSet, frameIndex);
  if (hasPackedFrameStyles(frameSet, bounded)) return Promise.resolve(false);
  const loader = packedFrameStyleLoadersByFrameSet.get(frameSet);
  if (!loader) {
    return Promise.reject(new Error(`Packed cssoccer frame loader is missing for ${frameSet.id}.`));
  }
  return Promise.resolve(loader(bounded)).then(() => {
    if (!hasPackedFrameStyles(frameSet, bounded)) {
      throw new Error(`Packed cssoccer frame ${bounded} did not load for ${frameSet.id}.`);
    }
    return true;
  });
}

/** Install one hash-verified cssQuake v3 slot sidecar without rebuilding DOM or geometry. */
export function installCssoccerPackedFrameStyles(frameSet, sidecar) {
  const descriptor = frameSet?.frameStyleFiles?.find(({ frameStart, frameEnd }) => (
    frameStart === sidecar?.frameStart && frameEnd === sidecar?.frameEnd
  ));
  if (frameSet?.frameLeafStyleEncoding !== CSSOCCER_PACKED_FRAME_LEAF_STYLES
      || sidecar?.schema !== PACKED_FRAME_STYLES_SCHEMA
      || sidecar.version !== PACKED_FRAME_STYLES_VERSION
      || sidecar.frameSetId !== frameSet.id
      || sidecar.topologyHash !== frameSet.topologyHash
      || sidecar.frameCount !== frameSet.frameCount
      || sidecar.leafCount !== frameSet.leafCount
      || !descriptor
      || !Number.isSafeInteger(sidecar.frameStart)
      || !Number.isSafeInteger(sidecar.frameEnd)
      || sidecar.frameStart < 0
      || sidecar.frameEnd <= sidecar.frameStart
      || sidecar.frameEnd > frameSet.frameCount
      || !Array.isArray(sidecar.frames)
      || sidecar.frames.length !== sidecar.frameEnd - sidecar.frameStart
      || sidecar.frames.some((frame) => (
        !Array.isArray(frame) || frame.length !== frameSet.leafCount
      ))) {
    throw new Error(`Packed cssoccer frame styles changed for ${String(frameSet?.id)}.`);
  }
  if (sidecar.frameStart === 0) {
    const baseFrame = sidecar.frames[0];
    for (let leafIndex = 0; leafIndex < frameSet.leafCount; leafIndex += 1) {
      const style = hydratePackedFrameStyle(baseFrame[leafIndex], baseFrame[leafIndex]);
      validateCanonicalStyle(style, SAFE_LEAF_PROPERTIES, `${frameSet.id} packed base leaf ${leafIndex}`);
      if (style !== frameSet.bundle.leafStyles[leafIndex]) {
        throw new Error(`Packed cssoccer base frame changed leaf ${leafIndex} for ${frameSet.id}.`);
      }
    }
  }
  validatePackedFrameStyleSidecar(frameSet, sidecar);
  let chunks = packedFrameStyleChunksByFrameSet.get(frameSet);
  if (!chunks) {
    chunks = new Map();
    packedFrameStyleChunksByFrameSet.set(frameSet, chunks);
  }
  const existing = chunks.get(sidecar.frameStart);
  if (existing && existing !== sidecar) {
    throw new Error(`Packed cssoccer frame chunk ${sidecar.frameStart} changed for ${frameSet.id}.`);
  }
  if (existing) chunks.delete(sidecar.frameStart);
  chunks.set(sidecar.frameStart, sidecar);
  const runtime = packedFrameStyleRuntime(frameSet);
  runtime.installCount += Number(!existing);
  while (chunks.size > CSSOCCER_PACKED_FRAME_STYLE_CHUNK_LIMIT) {
    const oldestFrameStart = chunks.keys().next().value;
    chunks.delete(oldestFrameStart);
    runtime.evictionCount += 1;
  }
  return frameSet;
}

export function inspectCssoccerPackedFrameStyleRuntime(frameSets) {
  if (!frameSets || typeof frameSets[Symbol.iterator] !== "function") {
    throw new TypeError("Packed cssoccer runtime inspection requires iterable frame sets.");
  }
  const unique = new Set(frameSets);
  const summary = {
    frameSetCount: 0,
    loadedChunkCount: 0,
    loadedFrameCount: 0,
    retainedTupleCount: 0,
    installCount: 0,
    evictionCount: 0,
    chunkLimitPerFrameSet: CSSOCCER_PACKED_FRAME_STYLE_CHUNK_LIMIT,
  };
  for (const frameSet of unique) {
    if (frameSet?.frameLeafStyleEncoding !== CSSOCCER_PACKED_FRAME_LEAF_STYLES) continue;
    summary.frameSetCount += 1;
    const chunks = packedFrameStyleChunksByFrameSet.get(frameSet);
    for (const sidecar of chunks?.values() ?? []) {
      summary.loadedChunkCount += 1;
      summary.loadedFrameCount += sidecar.frames.length;
      summary.retainedTupleCount += sidecar.frames.length * sidecar.leafCount;
    }
    const runtime = packedFrameStyleRuntimeByFrameSet.get(frameSet);
    summary.installCount += runtime?.installCount ?? 0;
    summary.evictionCount += runtime?.evictionCount ?? 0;
  }
  return Object.freeze(summary);
}

function requestPackedFrameStyles(frameSet, frameIndex) {
  if (!packedFrameStyleLoadersByFrameSet.has(frameSet)) return;
  preloadCssoccerPackedFrameStyles(frameSet, frameIndex).catch((error) => {
    globalThis.setTimeout(() => { throw error; }, 0);
  });
}

export function assertCssoccerPreparedRenderBundle(bundle, document = globalThis.document) {
  const checkedDocument = requiredDocument(document);
  if (validationSetFor(validatedBundlesByDocument, checkedDocument).has(bundle)) return bundle;
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new TypeError("Prepared css.soccer render bundle must be an object.");
  }
  if (bundle.schema !== RENDER_BUNDLE_SCHEMA
      || !new Set(["polycss-solid-mesh", "polycss-textured-mesh"]).has(bundle.kind)) {
    throw new Error("Unsupported prepared css.soccer render bundle contract.");
  }
  requireSafeId(bundle.id, "render bundle id");
  if (typeof bundle.polycssVersion !== "string" || bundle.polycssVersion.length === 0) {
    throw new Error("Prepared render bundle is not bound to a PolyCSS version.");
  }
  if (!SAFE_STYLE_CLASS.test(bundle.styleClassName)
      || !SAFE_HASH.test(bundle.topologyHash)
      || !SAFE_HASH.test(bundle.bundleHash)) {
    throw new Error("Prepared render bundle identity or hash is invalid.");
  }
  if (!Number.isSafeInteger(bundle.polygonCount) || bundle.polygonCount <= 0
      || !Number.isSafeInteger(bundle.leafCount) || bundle.leafCount <= 0
      || bundle.leafCount > bundle.polygonCount) {
    throw new Error("Prepared solid render bundle polygon/leaf counts are invalid.");
  }
  validateAssets(bundle.assets, bundle.kind);
  assertZeroConstruction(bundle.runtimeConstruction);
  assertCssQuakeLineage(bundle.lineage);
  if (!Array.isArray(bundle.leaves) || bundle.leaves.length !== bundle.leafCount
      || !Array.isArray(bundle.leafStyles) || bundle.leafStyles.length !== bundle.leafCount) {
    throw new Error("Prepared render bundle leaf contract is incomplete.");
  }

  validateCanonicalStyle(bundle.rootStyle, SAFE_ROOT_PROPERTIES, "render bundle root");
  for (let index = 0; index < bundle.leafCount; index += 1) {
    validateLeaf(bundle.leaves[index], index, bundle.polygonCount, bundle.leaves[index - 1]);
    validateCanonicalStyle(bundle.leafStyles[index], SAFE_LEAF_PROPERTIES, `render bundle leaf ${index}`);
  }
  assertCullMapping(bundle);
  const expectedHtml = renderMeshHtml(bundle.styleClassName, bundle.leaves);
  const expectedCss = renderMeshCss(
    bundle.styleClassName,
    bundle.leaves,
    bundle.rootStyle,
    bundle.leafStyles,
  );
  if (bundle.meshHtml !== expectedHtml || bundle.meshCss !== expectedCss) {
    throw new Error("Prepared render bundle HTML/CSS does not match its typed leaf contract.");
  }
  assertSafePayload(`${bundle.meshHtml}\n${bundle.meshCss}`, bundle.assets);
  validateTemplate(bundle, checkedDocument);
  validationSetFor(validatedBundlesByDocument, checkedDocument).add(bundle);
  return bundle;
}

export function assertCssoccerPreparedRenderFrameSet(frameSet, document = globalThis.document) {
  const checkedDocument = requiredDocument(document);
  if (validationSetFor(validatedFrameSetsByDocument, checkedDocument).has(frameSet)) return frameSet;
  if (!frameSet || typeof frameSet !== "object" || Array.isArray(frameSet)) {
    throw new TypeError("Prepared css.soccer render frame set must be an object.");
  }
  if (frameSet.schema !== RENDER_FRAME_SET_SCHEMA
      || !new Set(["polycss-solid-frame-set", "polycss-textured-frame-set"])
        .has(frameSet.kind)) {
    throw new Error("Unsupported prepared css.soccer render frame-set contract.");
  }
  requireSafeId(frameSet.id, "render frame-set id");
  if (!SAFE_HASH.test(frameSet.topologyHash) || !SAFE_HASH.test(frameSet.frameSetHash)) {
    throw new Error("Prepared render frame-set hash is invalid.");
  }
  assertCssoccerPreparedRenderBundle(frameSet.bundle, checkedDocument);
  if (frameSet.id !== frameSet.bundle.id
      || frameSet.polycssVersion !== frameSet.bundle.polycssVersion
      || frameSet.topologyHash !== frameSet.bundle.topologyHash
      || frameSet.polygonCount !== frameSet.bundle.polygonCount
      || frameSet.leafCount !== frameSet.bundle.leafCount
      || frameSet.droppedSourcePolygonCount !== frameSet.bundle.droppedSourcePolygonCount
      || JSON.stringify(frameSet.droppedSourcePolygonIndices)
        !== JSON.stringify(frameSet.bundle.droppedSourcePolygonIndices)) {
    throw new Error("Prepared render frame set is not bound to its base bundle.");
  }
  if ((frameSet.kind === "polycss-textured-frame-set")
      !== (frameSet.bundle.kind === "polycss-textured-mesh")) {
    throw new Error("Prepared render frame-set material kind changed from its bundle.");
  }
  if (!Array.isArray(frameSet.frames) || frameSet.frames.length < 2
      || frameSet.frameCount !== frameSet.frames.length) {
    throw new Error("Prepared render frame set needs at least two bound frames.");
  }
  if (!Array.isArray(frameSet.rootPropertyNames)
      || frameSet.rootPropertyNames.some((name) => !SAFE_ROOT_PROPERTIES.has(name))
      || new Set(frameSet.rootPropertyNames).size !== frameSet.rootPropertyNames.length
      || [...frameSet.rootPropertyNames].sort().join("\n") !== frameSet.rootPropertyNames.join("\n")) {
    throw new Error("Prepared render frame-set root properties are invalid.");
  }
  if (Object.hasOwn(frameSet, "sourceCameraFacing")
      || Object.hasOwn(frameSet, "sourcePrimitiveTopologyHash")) {
    throw new Error("Obsolete source camera-facing frame-set fields are forbidden.");
  }
  const frameLeafStyleEncoding = frameSet.frameLeafStyleEncoding;
  if (!new Set([INLINE_FRAME_LEAF_STYLES, CSSOCCER_PACKED_FRAME_LEAF_STYLES])
    .has(frameLeafStyleEncoding)) {
    throw new Error("Prepared render frame-set leaf-style encoding is invalid.");
  }
  if (frameLeafStyleEncoding === CSSOCCER_PACKED_FRAME_LEAF_STYLES
      && !validPackedFrameStyleFiles(frameSet.frameStyleFiles, frameSet.frameCount)) {
    throw new Error("Prepared packed render frame-set style file is invalid.");
  }
  assertZeroConstruction(frameSet.runtimeConstruction);
  assertCssQuakeLineage(frameSet.lineage);
  const ids = new Set();
  for (const [frameIndex, frame] of frameSet.frames.entries()) {
    requireSafeId(frame?.id, `render frame ${frameIndex} id`);
    if (ids.has(frame.id)) throw new Error(`Duplicate prepared render frame id ${frame.id}.`);
    ids.add(frame.id);
    const rootEntries = validateCanonicalStyle(
      frame.rootStyle,
      SAFE_ROOT_PROPERTIES,
      `render frame ${frame.id} root`,
    );
    if (JSON.stringify(rootEntries) !== JSON.stringify(frame.rootStyleEntries)) {
      throw new Error(`Prepared render frame ${frame.id} root entries changed.`);
    }
    if (frame.playerNumberLeafStyles !== undefined) {
      throw new Error(`Prepared render frame ${frame.id} contains obsolete player-number styles.`);
    }
    if (frameLeafStyleEncoding === CSSOCCER_PACKED_FRAME_LEAF_STYLES) {
      if (frame.leafStyles !== undefined) {
        throw new Error(`Prepared render frame ${frame.id} duplicated external leaf styles.`);
      }
    } else {
      if (!Array.isArray(frame.leafStyles) || frame.leafStyles.length !== frameSet.leafCount) {
        throw new Error(`Prepared render frame ${frame.id} leaf styles are incomplete.`);
      }
      frame.leafStyles.forEach((style, leafIndex) => (
        validateCanonicalStyle(style, SAFE_LEAF_PROPERTIES, `${frame.id} leaf ${leafIndex}`)
      ));
    }
    if (frame.sourcePoints !== undefined) {
      throw new Error(`Prepared render frame ${frame.id} has unbound source points.`);
    }
  }
  const firstFrame = frameSet.frames[0];
  if (firstFrame.rootStyle !== frameSet.bundle.rootStyle
      || (frameLeafStyleEncoding === INLINE_FRAME_LEAF_STYLES
        && JSON.stringify(firstFrame.leafStyles) !== JSON.stringify(frameSet.bundle.leafStyles))) {
    throw new Error("Prepared render frame set first frame changed from its base bundle.");
  }
  validationSetFor(validatedFrameSetsByDocument, checkedDocument).add(frameSet);
  return frameSet;
}

function validPackedFrameStyleFiles(files, frameCount) {
  if (!Array.isArray(files) || files.length === 0) return false;
  let expectedStart = 0;
  const paths = new Set();
  for (const file of files) {
    if (!file || typeof file !== "object" || Array.isArray(file)
        || Object.keys(file).sort().join(",") !== "frameEnd,frameStart,path"
        || !SAFE_FRAME_STYLE_PATH.test(file.path ?? "")
        || paths.has(file.path)
        || file.frameStart !== expectedStart
        || !Number.isSafeInteger(file.frameEnd)
        || file.frameEnd <= file.frameStart
        || file.frameEnd > frameCount) {
      return false;
    }
    paths.add(file.path);
    expectedStart = file.frameEnd;
  }
  return expectedStart === frameCount;
}

function mountBundle(sceneElement, bundle, { skipValidation = false } = {}) {
  const document = ownerDocumentFor(sceneElement);
  if (!skipValidation) assertCssoccerPreparedRenderBundle(bundle, document);
  injectPolyBaseStyles(document);
  ensureBundleStyle(document, bundle);
  const template = templateFor(document, bundle);
  const element = template.content.firstElementChild.cloneNode(true);
  const leaves = Array.from(element.children);
  sceneElement.appendChild(element);

  const counters = {
    sourceParseCount: 0,
    geometryBuildCount: 0,
    topologyBuildCount: 0,
    materialBuildCount: 0,
    assetBuildCount: 0,
    frameStyleApplyCount: 0,
    frameRootStyleWriteCount: 0,
    frameLeafFullStyleWriteCount: 0,
    frameLeafTransformWriteCount: 0,
    frameLeafUnchangedSkipCount: 0,
  };
  const transform = {};
  let appliedTransformStyle = null;
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    element.remove();
  };
  const handle = {
    element,
    leaves: Object.freeze(leaves),
    transform,
    setTransform(partial) {
      applyTransform(transform, partial);
      const style = buildPolyMeshTransform(transform);
      const nextStyle = style ?? "";
      if (nextStyle === appliedTransformStyle) return false;
      if (style) element.style.transform = style;
      else element.style.removeProperty("transform");
      appliedTransformStyle = nextStyle;
      return true;
    },
    stats() {
      return Object.freeze({
        ...counters,
        leafCount: leaves.length,
      });
    },
    runtimeConstruction() {
      return Object.freeze({
        sourceParseCount: counters.sourceParseCount,
        geometryBuildCount: counters.geometryBuildCount,
        topologyBuildCount: counters.topologyBuildCount,
        materialBuildCount: counters.materialBuildCount,
        assetBuildCount: counters.assetBuildCount,
      });
    },
    remove,
    dispose: remove,
  };
  return { counters, element, handle, leaves };
}

function applyPreparedFrame(
  element,
  leaves,
  frameSet,
  frameIndex,
  state = createPreparedFrameState(frameSet, leaves.length),
  counters = null,
) {
  const frame = frameSet.frames[frameIndex];
  for (const propertyName of frameSet.rootPropertyNames) {
    const value = preparedRootStyleValue(frame, propertyName);
    if (state.rootValues.get(propertyName) === value) continue;
    element.style.setProperty(propertyName, value);
    state.rootValues.set(propertyName, value);
    if (counters) counters.frameRootStyleWriteCount += 1;
  }
  if (frameSet.frameLeafStyleEncoding === CSSOCCER_PACKED_FRAME_LEAF_STYLES) {
    return applyPackedPreparedFrame(
      leaves,
      frameSet,
      frameIndex,
      state,
      counters,
    );
  }
  for (let index = 0; index < leaves.length; index += 1) {
    const style = frame.leafStyles[index];
    if (state.inlineLeafStyles[index] === style) {
      if (counters) counters.frameLeafUnchangedSkipCount += 1;
      continue;
    }
    leaves[index].style.cssText = style;
    state.inlineLeafStyles[index] = style;
    if (counters) counters.frameLeafFullStyleWriteCount += 1;
  }
  return true;
}

function applyPackedPreparedFrame(
  leaves,
  frameSet,
  frameIndex,
  state,
  counters,
) {
  const sidecar = packedFrameStyleChunk(frameSet, frameIndex);
  if (!sidecar && frameIndex !== 0) return false;
  const baseFrame = packedBaseFrameStyles(frameSet);
  const localFrameIndex = sidecar ? frameIndex - sidecar.frameStart : 0;
  const packedFrame = sidecar?.frames[localFrameIndex] ?? baseFrame;
  if (!packedFrame) throw new Error(`Packed cssoccer frame ${frameIndex} is missing.`);
  for (let leafIndex = 0; leafIndex < leaves.length; leafIndex += 1) {
    const frameStyle = packedFrame[leafIndex];
    const baseFrameStyle = baseFrame[leafIndex];
    const matrix = frameStyle[0] ?? "";
    const background = effectivePackedFrameStylePart(frameStyle, baseFrameStyle, 1);
    const extraStyle = effectivePackedFrameStylePart(frameStyle, baseFrameStyle, 2);
    const backgroundChanged = state.backgrounds[leafIndex] !== background;
    const extraStyleChanged = state.extraStyles[leafIndex] !== extraStyle;
    const matrixChanged = state.matrices[leafIndex] !== matrix;
    if (!state.packedInitialized || backgroundChanged || extraStyleChanged) {
      leaves[leafIndex].style.cssText = hydratePackedFrameStyle(frameStyle, baseFrameStyle);
      if (counters) counters.frameLeafFullStyleWriteCount += 1;
    } else if (matrixChanged) {
      applyPackedFrameTransform(leaves[leafIndex], matrix);
      if (counters) counters.frameLeafTransformWriteCount += 1;
    } else if (counters) {
      counters.frameLeafUnchangedSkipCount += 1;
    }
    state.matrices[leafIndex] = matrix;
    state.backgrounds[leafIndex] = background;
    state.extraStyles[leafIndex] = extraStyle;
  }
  state.packedInitialized = true;
  return true;
}

function createPreparedFrameState(frameSet, leafCount) {
  return {
    rootValues: new Map(),
    inlineLeafStyles: new Array(leafCount),
    matrices: new Array(leafCount),
    backgrounds: new Array(leafCount),
    extraStyles: new Array(leafCount),
    packedInitialized: frameSet.frameLeafStyleEncoding !== CSSOCCER_PACKED_FRAME_LEAF_STYLES,
  };
}

function preparedRootStyleValue(frame, propertyName) {
  for (const [name, value] of frame.rootStyleEntries) {
    if (name === propertyName) return value;
  }
  return "initial";
}

function effectivePackedFrameStylePart(frameStyle, baseFrameStyle, index) {
  return frameStyle.length > index && frameStyle[index] !== null
    ? frameStyle[index] ?? ""
    : baseFrameStyle[index] ?? "";
}

function applyPackedFrameTransform(leaf, matrix) {
  if (!matrix) {
    leaf.style.removeProperty("transform");
    return;
  }
  leaf.style.transform = matrix.includes("(") ? matrix : `matrix3d(${matrix})`;
}

function hasPackedFrameStyles(frameSet, frameIndex) {
  return packedFrameStyleChunk(frameSet, frameIndex) !== null;
}

function canApplyPackedFrameStyles(frameSet, frameIndex) {
  return frameIndex === 0 || hasPackedFrameStyles(frameSet, frameIndex);
}

function packedFrameStyleChunk(frameSet, frameIndex) {
  const chunks = packedFrameStyleChunksByFrameSet.get(frameSet);
  if (!chunks) return null;
  const descriptor = frameSet.frameStyleFiles.find(({ frameStart, frameEnd }) => (
    frameIndex >= frameStart && frameIndex < frameEnd
  ));
  if (!descriptor) return null;
  const sidecar = chunks.get(descriptor.frameStart) ?? null;
  if (sidecar) {
    chunks.delete(descriptor.frameStart);
    chunks.set(descriptor.frameStart, sidecar);
  }
  return sidecar;
}

function packedFrameStyleRuntime(frameSet) {
  let runtime = packedFrameStyleRuntimeByFrameSet.get(frameSet);
  if (!runtime) {
    runtime = { installCount: 0, evictionCount: 0 };
    packedFrameStyleRuntimeByFrameSet.set(frameSet, runtime);
  }
  return runtime;
}

function packedBaseFrameStyles(frameSet) {
  let baseFrame = packedBaseFrameStylesByFrameSet.get(frameSet);
  if (!baseFrame) {
    baseFrame = frameSet.bundle.leafStyles.map(splitPackedFrameStyle);
    packedBaseFrameStylesByFrameSet.set(frameSet, baseFrame);
  }
  return baseFrame;
}

function splitPackedFrameStyle(style) {
  let matrix = "";
  const background = [];
  const extra = [];
  for (const declaration of style.split(";")) {
    const separator = declaration.indexOf(":");
    const name = declaration.slice(0, separator);
    const value = declaration.slice(separator + 1);
    if (name === "transform") {
      matrix = value.startsWith("matrix3d(") && value.endsWith(")")
        ? value.slice("matrix3d(".length, -1)
        : value;
    } else if (name.startsWith("background-")) {
      background.push(declaration);
    } else {
      extra.push(declaration);
    }
  }
  return [matrix, background.join(";"), extra.join(";")];
}

function hydratePackedFrameStyle(frameStyle, baseFrameStyle) {
  validatePackedFrameStyleTuple(frameStyle);
  validatePackedFrameStyleTuple(baseFrameStyle);
  const matrix = frameStyle[0] ?? "";
  const background = frameStyle.length >= 2 && frameStyle[1] !== null
    ? frameStyle[1] ?? ""
    : baseFrameStyle[1] ?? "";
  const extraStyle = frameStyle.length >= 3 && frameStyle[2] !== null
    ? frameStyle[2] ?? ""
    : baseFrameStyle[2] ?? "";
  const declarations = [background, extraStyle]
    .filter(Boolean)
    .flatMap((style) => style.split(";"));
  if (matrix) {
    declarations.push(`transform:${matrix.includes("(") ? matrix : `matrix3d(${matrix})`}`);
  }
  return declarations
    .sort((left, right) => left.slice(0, left.indexOf(":"))
      .localeCompare(right.slice(0, right.indexOf(":"))))
    .join(";");
}

function validatePackedFrameStyleSidecar(frameSet, sidecar) {
  if (sidecar.playerNumbers !== undefined) {
    throw new Error(`Packed cssoccer frame styles contain obsolete player-number data.`);
  }
  const baseFrame = packedBaseFrameStyles(frameSet);
  for (let localFrameIndex = 0; localFrameIndex < sidecar.frames.length; localFrameIndex += 1) {
    const frame = sidecar.frames[localFrameIndex];
    for (let leafIndex = 0; leafIndex < frame.length; leafIndex += 1) {
      const style = hydratePackedFrameStyle(frame[leafIndex], baseFrame[leafIndex]);
      validateCanonicalStyle(
        style,
        SAFE_LEAF_PROPERTIES,
        `${frameSet.id} packed frame ${sidecar.frameStart + localFrameIndex} leaf ${leafIndex}`,
      );
    }
  }
}

function validatePackedFrameStyleTuple(value) {
  if (!Array.isArray(value)
      || value.length < 1
      || value.length > 3
      || value.some((entry) => entry !== null && typeof entry !== "string")) {
    throw new Error("Packed cssoccer leaf frame style is invalid.");
  }
}

function applyTransform(transform, partial) {
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) {
    throw new TypeError("Prepared render-bundle transform must be an object.");
  }
  for (const key of Object.keys(partial)) {
    if (!new Set(["position", "rotation", "scale"]).has(key)) {
      throw new Error(`Unsupported prepared render-bundle transform field ${key}.`);
    }
  }
  if (partial.position !== undefined) transform.position = finiteVec3(partial.position, "position");
  if (partial.rotation !== undefined) transform.rotation = finiteVec3(partial.rotation, "rotation");
  if (partial.scale !== undefined) {
    transform.scale = Number.isFinite(partial.scale)
      ? partial.scale
      : finiteVec3(partial.scale, "scale");
  }
}

function finiteVec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`Prepared render-bundle ${label} must be a finite vec3.`);
  }
  return [...value];
}

function validateLeaf(leaf, index, polygonCount, previousLeaf) {
  if (!leaf || typeof leaf !== "object" || leaf.index !== index
      || !Number.isSafeInteger(leaf.sourcePolygonIndex)
      || leaf.sourcePolygonIndex < 0
      || leaf.sourcePolygonIndex >= polygonCount
      || (previousLeaf && leaf.sourcePolygonIndex <= previousLeaf.sourcePolygonIndex)
      || !LEAF_TAGS.has(leaf.tag)) {
    throw new Error(`Prepared render bundle leaf ${index} metadata is invalid.`);
  }
  const ownClass = `cssoccer-rbl-${index.toString(36)}`;
  if (!Array.isArray(leaf.classes) || !leaf.classes.includes(ownClass)
      || new Set(leaf.classes).size !== leaf.classes.length
      || leaf.classes.join("\n") !== [...leaf.classes].sort().join("\n")
      || leaf.classes.some((name) => (
        !SAFE_ID.test(name)
        || (!SAFE_LEAF_CLASS.test(name)
          && !SAFE_PREPARED_LEAF_CLASSES.has(name)
          && !name.startsWith("polycss-"))
      ))) {
    throw new Error(`Prepared render bundle leaf ${index} classes are invalid.`);
  }
}

function assertCullMapping(bundle) {
  if (!Array.isArray(bundle.droppedSourcePolygonIndices)
      || !Number.isSafeInteger(bundle.droppedSourcePolygonCount)
      || bundle.droppedSourcePolygonCount !== bundle.droppedSourcePolygonIndices.length) {
    throw new Error("Prepared render bundle dropped-source mapping is incomplete.");
  }
  const surviving = new Set(bundle.leaves.map(({ sourcePolygonIndex }) => sourcePolygonIndex));
  const expectedDropped = Array.from(
    { length: bundle.polygonCount },
    (_unused, index) => index,
  ).filter((index) => !surviving.has(index));
  if (JSON.stringify(expectedDropped) !== JSON.stringify(bundle.droppedSourcePolygonIndices)) {
    throw new Error("Prepared render bundle dropped-source mapping is not the exact leaf complement.");
  }
}

function validateCanonicalStyle(style, allowedProperties, label) {
  if (typeof style !== "string") throw new Error(`${label} style must be a string.`);
  if (style === "") return [];
  const entries = style.split(";").map((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator <= 0) throw new Error(`${label} has malformed CSS.`);
    const name = declaration.slice(0, separator);
    const value = declaration.slice(separator + 1);
    if (!allowedProperties.has(name) || !value || UNSAFE_CSS_VALUE.test(value)) {
      throw new Error(`${label} contains unsafe CSS property ${name}.`);
    }
    if (name === "background-image" || name === "border-image-source") {
      validateCssImageValue(value, label, name);
    }
    if ((name === "mask-image" || name === "-webkit-mask-image") && value !== "none") {
      throw new Error(`${label} contains an unsupported CSS mask.`);
    }
    return [name, value];
  });
  const names = entries.map(([name]) => name);
  if (new Set(names).size !== names.length
      || names.join("\n") !== [...names].sort().join("\n")
      || entries.map(([name, value]) => `${name}:${value}`).join(";") !== style) {
    throw new Error(`${label} CSS is not canonical.`);
  }
  return entries;
}

function validateTemplate(bundle, document) {
  const template = document.createElement("template");
  template.innerHTML = bundle.meshHtml;
  if (template.content.children.length !== 1) {
    throw new Error("Prepared render bundle must contain exactly one mesh root.");
  }
  const root = template.content.firstElementChild;
  if (root.tagName.toLowerCase() !== "div"
      || root.attributes.length !== 1
      || root.getAttribute("class") !== `polycss-mesh ${bundle.styleClassName}`
      || root.children.length !== bundle.leafCount
      || root.childNodes.length !== root.children.length) {
    throw new Error("Prepared render bundle mesh root is unsafe or malformed.");
  }
  for (let index = 0; index < root.children.length; index += 1) {
    const leaf = root.children[index];
    if (leaf.tagName.toLowerCase() !== bundle.leaves[index].tag
        || leaf.attributes.length !== 1
        || leaf.getAttribute("class") !== bundle.leaves[index].classes.join(" ")
        || leaf.childNodes.length !== 0) {
      throw new Error(`Prepared render bundle leaf ${index} markup is unsafe or malformed.`);
    }
  }
}

function renderMeshHtml(styleClassName, leaves) {
  return `<div class="polycss-mesh ${styleClassName}">${leaves.map(({ tag, classes }) => (
    `<${tag} class="${classes.join(" ")}"></${tag}>`
  )).join("")}</div>`;
}

function renderMeshCss(styleClassName, leaves, rootStyle, leafStyles) {
  const rules = [];
  if (rootStyle) rules.push(`.${styleClassName}{${rootStyle}}`);
  leaves.forEach((_leaf, index) => {
    rules.push(
      `.${styleClassName}>.cssoccer-rbl-${index.toString(36)}{${leafStyles[index]}}`,
    );
  });
  return rules.join("");
}

function templateFor(document, bundle) {
  let byBundle = templatesByDocument.get(document);
  if (!byBundle) {
    byBundle = new WeakMap();
    templatesByDocument.set(document, byBundle);
  }
  let template = byBundle.get(bundle);
  if (!template) {
    template = document.createElement("template");
    template.innerHTML = bundle.meshHtml;
    byBundle.set(bundle, template);
  }
  return template;
}

function ensureBundleStyle(document, bundle) {
  let byCss = stylesByDocument.get(document);
  if (!byCss) {
    byCss = new Map();
    stylesByDocument.set(document, byCss);
  }
  if (byCss.has(bundle.meshCss)) return;
  const id = `cssoccer-style-${bundle.styleClassName}`;
  const existing = document.getElementById(id);
  if (existing) {
    if (existing.tagName.toLowerCase() !== "style" || existing.textContent !== bundle.meshCss) {
      throw new Error(`Prepared render bundle stylesheet id ${id} is already occupied.`);
    }
    byCss.set(bundle.meshCss, existing);
    return;
  }
  const style = document.createElement("style");
  style.id = id;
  style.textContent = bundle.meshCss;
  document.head.appendChild(style);
  byCss.set(bundle.meshCss, style);
}

function boundedFrameIndex(frameSet, frameIndex) {
  if (!Number.isSafeInteger(frameIndex)) {
    throw new Error("Prepared render frame index must be a safe integer.");
  }
  return ((frameIndex % frameSet.frameCount) + frameSet.frameCount) % frameSet.frameCount;
}

function assertZeroConstruction(value) {
  const expected = [
    "sourceParseCount",
    "geometryBuildCount",
    "topologyBuildCount",
    "materialBuildCount",
    "assetBuildCount",
  ];
  if (!value || typeof value !== "object"
      || expected.some((name) => value[name] !== 0)) {
    throw new Error("Prepared render bundle runtime-construction contract is not zero.");
  }
}

function assertCssQuakeLineage(lineage) {
  if (lineage?.productionReference !== "cssQuake"
      || !Array.isArray(lineage.files)
      || !lineage.files.includes("cssQuake/src/prepare/bundle.mjs")
      || !lineage.files.includes("cssQuake/src/runtime/renderBundleMesh.ts")) {
    throw new Error("Prepared render bundle is missing its launched CSSQuake lineage.");
  }
}

function validateAssets(assets, kind) {
  if (!Array.isArray(assets)) throw new Error("Prepared render bundle assets must be an array.");
  if ((kind === "polycss-solid-mesh") !== (assets.length === 0)) {
    throw new Error("Prepared render bundle material kind does not match its asset list.");
  }
  let previousUrl = "";
  for (const asset of assets) {
    if (!asset || typeof asset !== "object"
        || !SAFE_ASSET_URL.test(asset.url)
        || asset.mediaType !== "image/png"
        || !SAFE_HASH.test(asset.sha256)
        || !Number.isSafeInteger(asset.width)
        || !Number.isSafeInteger(asset.height)
        || asset.width <= 0
        || asset.height <= 0
        || asset.url <= previousUrl
        || Object.keys(asset).sort().join(",") !== "height,mediaType,sha256,url,width") {
      throw new Error("Prepared render bundle contains an invalid generated texture asset.");
    }
    previousUrl = asset.url;
  }
}

function assertSafePayload(value, assets) {
  if (/(?:<img\b|<script\b|<style\b|\son[a-z]+\s*=|@import|javascript:|data:|blob:|(?:^|[;{])\s*(?:filter|box-shadow|text-shadow|mix-blend-mode)\s*:|(?:linear|radial|conic)-gradient\s*\()/iu.test(value)) {
    throw new Error("Prepared render bundle contains unsafe markup or CSS.");
  }
  const allowed = new Set(assets.map(({ url }) => url));
  const referenced = [...value.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/giu)]
    .map((match) => match[1]);
  if (referenced.some((url) => !allowed.has(url))
      || new Set(referenced).size !== allowed.size) {
    throw new Error("Prepared render bundle CSS does not match its generated texture assets.");
  }
}

function validateCssImageValue(value, label, propertyName) {
  if (value === "none" || value === "initial") return;
  const match = value.match(/^url\(\s*["']?([^"')\s]+)["']?\s*\)$/u);
  if (!match || !SAFE_ASSET_URL.test(match[1])) {
    throw new Error(`${label} contains an unsafe ${propertyName}.`);
  }
}

function ownerDocumentFor(sceneElement) {
  if (!sceneElement || typeof sceneElement.appendChild !== "function") {
    throw new Error("Prepared render bundle requires a scene host.");
  }
  return requiredDocument(sceneElement.ownerDocument);
}

function requiredDocument(document) {
  if (!document || typeof document.createElement !== "function") {
    throw new Error("Prepared render bundle requires a DOM document.");
  }
  return document;
}

function validationSetFor(cache, document) {
  let values = cache.get(document);
  if (!values) {
    values = new WeakSet();
    cache.set(document, values);
  }
  return values;
}

function requireSafeId(value, label) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
}

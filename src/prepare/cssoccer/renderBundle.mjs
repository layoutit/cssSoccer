import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  createPolyPerspectiveCamera,
  createPolyScene,
} from "@layoutit/polycss";
import { Window } from "happy-dom";

export const CSSOCCER_RENDER_BUNDLE_SCHEMA = "cssoccer-prepared-render-bundle@1";
export const CSSOCCER_RENDER_FRAME_SET_SCHEMA = "cssoccer-prepared-render-frame-set@1";
const INLINE_FRAME_LEAF_STYLES = "inline-css-text@1";

const POLYCSS_VERSION = readPolycssVersion();
const SAFE_ID = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/u;
const SAFE_COLOR = /^#[0-9a-f]{6}$/u;
const MAX_COORDINATE = 10_000_000;
const LEAF_TAGS = new Set(["b", "i", "s", "u"]);
const FORBIDDEN_POLYGON_KEYS = Object.freeze([
  "objectUrl",
  "objectUrls",
  "src",
  "texture",
  "textureTriangles",
  "textureWrap",
  "url",
]);
const SAFE_ASSET_URL = /^\/cssoccer\/assets\/textures\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/u;
const SAFE_HASH = /^[0-9a-f]{64}$/u;
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
const CSSQUAKE_LINEAGE = deepFreeze({
  productionReference: "cssQuake",
  pattern: "prepare-time stable DOM serialization with same-topology frame-style swaps",
  files: [
    "cssQuake/src/prepare/bundle.mjs",
    "cssQuake/src/prepare/assets.mjs",
    "cssQuake/src/prepare/renderBundleHappyDom.mjs",
    "cssQuake/src/runtime/renderBundleMesh.ts",
  ],
});
const PREPARE_AMBIENT_LIGHT = Object.freeze({ color: "#ffffff", intensity: Math.PI });
const PREPARE_DIRECTIONAL_LIGHT = Object.freeze({
  color: "#ffffff",
  direction: Object.freeze([-0.4, -0.55, -0.65]),
  intensity: 0,
});

let renderQueue = Promise.resolve();

/**
 * Serialize one already-prepared solid polygon mesh. The returned bundle has
 * no polygons or asset references; browser runtime only clones its HTML/CSS.
 */
export function buildCssoccerPreparedRenderBundle({ id, polygons } = {}) {
  return enqueueRender(async () => {
    const built = await buildFrameSetInternal({
      id,
      frames: [{ id: "base", polygons }],
    });
    return built.bundle;
  });
}

/**
 * Serialize a stable animated mesh. Every frame must preserve input topology
 * and the exact PolyCSS leaf nodes selected for the first frame.
 */
export function buildCssoccerPreparedRenderFrameSet(request = {}) {
  if (Object.hasOwn(request, "sourceCameraFacing")) {
    throw new Error("Source camera-facing render frame sets are obsolete.");
  }
  const { id, frames } = request;
  return enqueueRender(() => buildFrameSetInternal({ id, frames }));
}

function enqueueRender(operation) {
  const run = renderQueue.then(operation, operation);
  renderQueue = run.catch(() => undefined);
  return run;
}

async function buildFrameSetInternal({ id, frames }) {
  requireSafeId(id, "render bundle id");
  const preparedFrames = prepareFrameInputs(frames);
  const assets = collectPreparedAssets(preparedFrames);
  const environment = createPrepareEnvironment();

  try {
    const host = environment.document.createElement("main");
    host.style.position = "absolute";
    host.style.left = "-100000px";
    host.style.top = "0";
    host.style.width = "1280px";
    host.style.height = "720px";
    environment.document.body.append(host);

    const camera = createPolyPerspectiveCamera({
      perspective: 900,
      zoom: 1,
      rotX: 88,
      rotY: 270,
      target: [0, 0, 0],
    });
    const scene = createPolyScene(host, {
      camera,
      ambientLight: PREPARE_AMBIENT_LIGHT,
      directionalLight: PREPARE_DIRECTIONAL_LIGHT,
      textureLighting: "baked",
      autoCenter: false,
      seamBleed: 0,
    });

    try {
      const handle = scene.add(meshInput(preparedFrames[0].polygons), {
        merge: false,
        meshResolution: "lossless",
        stableDom: true,
        excludeFromAutoCenter: true,
      });
      await handle.whenTexturesReady();

      const firstCapture = captureRenderedFrame(handle.element, preparedFrames[0], 0);
      const stableLeaves = firstCapture.nodes;
      const renderedFrames = [firstCapture.frame];

      for (let index = 1; index < preparedFrames.length; index += 1) {
        let capture;
        if (assets.length === 0) {
          handle.setPolygons(preparedFrames[index].polygons, {
            merge: false,
            stableDom: true,
            recomputeAutoCenter: false,
          });
          await handle.whenTexturesReady();
          capture = captureRenderedFrame(
            handle.element,
            preparedFrames[index],
            index,
            firstCapture.frame.leaves,
          );
          assertStableRenderedTopology(firstCapture, capture, stableLeaves, index, true);
        } else {
          const frameHandle = scene.add(meshInput(preparedFrames[index].polygons), {
            merge: false,
            meshResolution: "lossless",
            stableDom: true,
            excludeFromAutoCenter: true,
          });
          await frameHandle.whenTexturesReady();
          capture = captureRenderedFrame(
            frameHandle.element,
            preparedFrames[index],
            index,
            firstCapture.frame.leaves,
          );
          assertStableRenderedTopology(firstCapture, capture, stableLeaves, index, false);
          frameHandle.remove();
        }
        renderedFrames.push(capture.frame);
      }

      const topology = firstCapture.frame.leaves.map(({ tag, classes, sourcePolygonIndex }, index) => ({
        index,
        tag,
        classes,
        sourcePolygonIndex,
      }));
      const baseLeafStyles = preparedLeafStyles(firstCapture.frame, preparedFrames[0]);
      const topologyHash = sha256(canonicalJson(topology));
      const styleToken = sha256(canonicalJson({
        rootStyle: firstCapture.frame.rootStyle,
        leafStyles: baseLeafStyles,
        topology,
      })).slice(0, 16);
      const styleClassName = `cssoccer-rb-${styleToken}`;
      const leaves = topology.map((leaf) => ({
        ...leaf,
        classes: [...leaf.classes, `cssoccer-rbl-${leaf.index.toString(36)}`].sort(),
      }));
      const survivingSourcePolygonIndices = new Set(
        leaves.map(({ sourcePolygonIndex }) => sourcePolygonIndex),
      );
      const droppedSourcePolygonIndices = Array.from(
        { length: preparedFrames[0].polygons.length },
        (_unused, index) => index,
      ).filter((index) => !survivingSourcePolygonIndices.has(index));
      const meshHtml = renderMeshHtml(styleClassName, leaves);
      const meshCss = renderMeshCss(
        styleClassName,
        leaves,
        firstCapture.frame.rootStyle,
        baseLeafStyles,
      );
      assertSafePreparedCss(meshHtml, meshCss, assets);

      const bundleCore = {
        schema: CSSOCCER_RENDER_BUNDLE_SCHEMA,
        id,
        kind: assets.length === 0 ? "polycss-solid-mesh" : "polycss-textured-mesh",
        polycssVersion: POLYCSS_VERSION,
        styleClassName,
        topologyHash,
        polygonCount: preparedFrames[0].polygons.length,
        leafCount: leaves.length,
        droppedSourcePolygonCount: droppedSourcePolygonIndices.length,
        droppedSourcePolygonIndices,
        meshHtml,
        meshCss,
        rootStyle: firstCapture.frame.rootStyle,
        leafStyles: baseLeafStyles,
        leaves,
        assets,
        lineage: CSSQUAKE_LINEAGE,
        runtimeConstruction: zeroRuntimeConstruction(),
      };
      const bundle = deepFreeze({
        ...bundleCore,
        bundleHash: sha256(canonicalJson(bundleCore)),
      });

      if (renderedFrames.length === 1) return { bundle };

      const rootPropertyNames = [...new Set(renderedFrames.flatMap((frame) => (
        frame.rootStyleEntries.map(([name]) => name)
      )))].sort();
      const framesOut = renderedFrames.map((frame, frameIndex) => deepFreeze({
        id: frame.id,
        rootStyle: frame.rootStyle,
        rootStyleEntries: frame.rootStyleEntries,
        leafStyles: preparedLeafStyles(frame, preparedFrames[frameIndex]),
      }));
      const frameSetCore = {
        schema: CSSOCCER_RENDER_FRAME_SET_SCHEMA,
        id,
        kind: assets.length === 0
          ? "polycss-solid-frame-set"
          : "polycss-textured-frame-set",
        polycssVersion: POLYCSS_VERSION,
        topologyHash,
        frameCount: framesOut.length,
        polygonCount: bundle.polygonCount,
        leafCount: leaves.length,
        droppedSourcePolygonCount: bundle.droppedSourcePolygonCount,
        droppedSourcePolygonIndices: bundle.droppedSourcePolygonIndices,
        rootPropertyNames,
        frameLeafStyleEncoding: INLINE_FRAME_LEAF_STYLES,
        bundle,
        frames: framesOut,
        lineage: CSSQUAKE_LINEAGE,
        runtimeConstruction: zeroRuntimeConstruction(),
      };
      return deepFreeze({
        ...frameSetCore,
        frameSetHash: sha256(canonicalJson(frameSetCore)),
      });
    } finally {
      scene.destroy();
    }
  } finally {
    environment.close();
  }
}

function prepareFrameInputs(frames) {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error("Prepared render frame set requires at least one frame.");
  }
  const ids = new Set();
  const prepared = frames.map((frame, frameIndex) => {
    if (!frame || typeof frame !== "object") {
      throw new TypeError(`Prepared render frame ${frameIndex} must be an object.`);
    }
    requireSafeId(frame.id, `render frame ${frameIndex} id`);
    if (ids.has(frame.id)) throw new Error(`Duplicate prepared render frame id ${frame.id}.`);
    ids.add(frame.id);
    if (!Array.isArray(frame.polygons) || frame.polygons.length === 0) {
      throw new Error(`Prepared render frame ${frame.id} has no polygons.`);
    }
    if (frame.sourcePoints !== undefined) {
      throw new Error(`Prepared render frame ${frame.id} contains obsolete source points.`);
    }
    return Object.freeze({
      id: frame.id,
      polygons: Object.freeze(frame.polygons.map((polygon, polygonIndex) => (
        preparePolygon(polygon, frame.id, polygonIndex)
      ))),
    });
  });

  const firstTopology = prepared[0].polygons.map((polygon) => ({
    vertices: polygon.vertices.length,
    material: materialTopologyKey(polygon),
    marking: polygon.marking?.id ?? null,
  }));
  if (prepared.length > 1 && prepared.some((frame) => frame.polygons.some(({ marking }) => marking))) {
    throw new Error("Prepared logical pitch markings must be a static render bundle.");
  }
  for (const frame of prepared.slice(1)) {
    const topology = frame.polygons.map((polygon) => ({
      vertices: polygon.vertices.length,
      material: materialTopologyKey(polygon),
      marking: polygon.marking?.id ?? null,
    }));
    if (topology.length !== firstTopology.length
        || topology.some((entry, index) => (
          entry.vertices !== firstTopology[index].vertices
          || entry.material !== firstTopology[index].material
          || entry.marking !== firstTopology[index].marking
        ))) {
      throw new Error(`Prepared render frame ${frame.id} does not preserve polygon topology.`);
    }
  }
  return Object.freeze(prepared);
}

function materialTopologyKey(polygon) {
  if (!polygon.material) return null;
  const { imageSource, presentation } = polygon.material;
  return canonicalJson({
    assetSha256: polygon.material.assetSha256,
    texture: polygon.material.texture,
    imageWidth: imageSource.width,
    imageHeight: imageSource.height,
    presentation,
    textureAlphaMode: polygon.textureAlphaMode,
    uvCount: polygon.uvs.length,
  });
}

function preparePolygon(polygon, frameId, polygonIndex) {
  if (!polygon || typeof polygon !== "object" || Array.isArray(polygon)) {
    throw new TypeError(`${frameId} polygon ${polygonIndex} must be an object.`);
  }
  for (const key of FORBIDDEN_POLYGON_KEYS) {
    if (polygon[key] !== undefined) {
      throw new Error(`${frameId} polygon ${polygonIndex} uses unsupported runtime texture input (${key}).`);
    }
  }
  if (!Array.isArray(polygon.vertices) || polygon.vertices.length < 3) {
    throw new Error(`${frameId} polygon ${polygonIndex} needs at least three vertices.`);
  }
  const vertices = polygon.vertices.map((vertex, vertexIndex) => {
    if (!Array.isArray(vertex) || vertex.length !== 3) {
      throw new Error(`${frameId} polygon ${polygonIndex} vertex ${vertexIndex} is not a vec3.`);
    }
    return Object.freeze(vertex.map((value) => {
      if (!Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE) {
        throw new Error(`${frameId} polygon ${polygonIndex} has an unsafe coordinate.`);
      }
      return Object.is(value, -0) ? 0 : value;
    }));
  });
  const color = String(polygon.color ?? "").toLowerCase();
  if (!SAFE_COLOR.test(color)) {
    throw new Error(`${frameId} polygon ${polygonIndex} needs a six-digit solid color.`);
  }
  if (polygon.doubleSided !== undefined && typeof polygon.doubleSided !== "boolean") {
    throw new Error(`${frameId} polygon ${polygonIndex} has an invalid double-sided flag.`);
  }
  const doubleSided = polygon.doubleSided === true;
  const marking = prepareMarkingPresentation(polygon.marking, vertices, frameId, polygonIndex);
  if (polygon.material === undefined) {
    if (polygon.uvs !== undefined || polygon.textureAlphaMode !== undefined
        || polygon.preparedPlayerNumberTextures !== undefined || marking) {
      throw new Error(`${frameId} polygon ${polygonIndex} has texture fields without a material.`);
    }
    return Object.freeze({
      vertices: Object.freeze(vertices),
      color,
      ...(doubleSided ? { doubleSided: true } : {}),
    });
  }
  const material = prepareMaterial(polygon.material, frameId, polygonIndex);
  const uvs = prepareUvs(polygon.uvs, vertices.length, frameId, polygonIndex);
  if (polygon.textureStyleRemap !== undefined
      || polygon.preparedPlayerNumberTextures !== undefined) {
    throw new Error(`${frameId} polygon ${polygonIndex} uses an obsolete player presentation field.`);
  }
  const textureAlphaMode = polygon.textureAlphaMode ?? "mask";
  if (!new Set(["opaque", "mask", "blend"]).has(textureAlphaMode)) {
    throw new Error(`${frameId} polygon ${polygonIndex} has an invalid texture alpha mode.`);
  }
  return Object.freeze({
    vertices: Object.freeze(vertices),
    color,
    material,
    textureAlphaMode,
    uvs,
    ...(marking ? { marking } : {}),
    ...(doubleSided ? { doubleSided: true } : {}),
  });
}

function prepareMarkingPresentation(value, vertices, frameId, polygonIndex) {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${frameId} polygon ${polygonIndex} marking presentation is invalid.`);
  }
  const keys = Object.keys(value).sort();
  if (
    JSON.stringify(keys) !== JSON.stringify(["id", "kind"])
    || !SAFE_ID.test(value.id)
    || !new Set(["solid", "solid-circle"]).has(value.kind)
  ) {
    throw new Error(`${frameId} polygon ${polygonIndex} marking presentation changed.`);
  }
  if (vertices.length !== 4) {
    throw new Error(`${frameId} polygon ${polygonIndex} marking must be one prepared quad.`);
  }
  return deepFreeze({
    id: value.id,
    kind: value.kind,
  });
}

function prepareMaterial(material, frameId, polygonIndex) {
  if (!material || typeof material !== "object" || Array.isArray(material)) {
    throw new Error(`${frameId} polygon ${polygonIndex} material must be an object.`);
  }
  const keys = Object.keys(material).sort();
  const expectedKeys = ["assetSha256", "imageSource", "key", "presentation", "texture"];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${frameId} polygon ${polygonIndex} material has unsupported fields.`);
  }
  if (!SAFE_ASSET_URL.test(material.texture) || !SAFE_HASH.test(material.assetSha256)) {
    throw new Error(`${frameId} polygon ${polygonIndex} material asset identity is invalid.`);
  }
  if (typeof material.key !== "string" || !SAFE_ID.test(material.key)) {
    throw new Error(`${frameId} polygon ${polygonIndex} material key is invalid.`);
  }
  const imageSource = material.imageSource;
  if (
    !imageSource
    || typeof imageSource !== "object"
    || Array.isArray(imageSource)
    || imageSource.url !== material.texture
    || !Number.isSafeInteger(imageSource.width)
    || !Number.isSafeInteger(imageSource.height)
    || imageSource.width <= 0
    || imageSource.height <= 0
    || !new Set(["auto", "pixelated"]).has(imageSource.imageRendering)
  ) {
    throw new Error(`${frameId} polygon ${polygonIndex} material image source is invalid.`);
  }
  const sourceRect = imageSource.sourceRect;
  if (
    !sourceRect
    || ![sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height]
      .every(Number.isSafeInteger)
    || sourceRect.x < 0
    || sourceRect.y < 0
    || sourceRect.width <= 0
    || sourceRect.height <= 0
    || sourceRect.x + sourceRect.width > imageSource.width
    || sourceRect.y + sourceRect.height > imageSource.height
  ) {
    throw new Error(`${frameId} polygon ${polygonIndex} material source rectangle is invalid.`);
  }
  const presentation = material.presentation;
  if (
    !presentation
    || presentation.backend !== "image"
    || presentation.lighting !== "source"
    || presentation.projection !== "affine"
    || !new Set(["auto", "pixelated"]).has(presentation.imageRendering)
    || Object.keys(presentation).sort().join(",")
      !== "backend,imageRendering,lighting,projection"
  ) {
    throw new Error(`${frameId} polygon ${polygonIndex} material presentation is not the direct image path.`);
  }
  return deepFreeze({
    texture: material.texture,
    key: material.key,
    imageSource: {
      url: imageSource.url,
      width: imageSource.width,
      height: imageSource.height,
      sourceRect: {
        x: sourceRect.x,
        y: sourceRect.y,
        width: sourceRect.width,
        height: sourceRect.height,
      },
      imageRendering: imageSource.imageRendering,
    },
    presentation: {
      backend: "image",
      lighting: "source",
      projection: "affine",
      imageRendering: presentation.imageRendering,
    },
    assetSha256: material.assetSha256,
  });
}

function prepareUvs(value, vertexCount, frameId, polygonIndex) {
  if (!Array.isArray(value) || value.length !== vertexCount || vertexCount !== 4) {
    throw new Error(`${frameId} polygon ${polygonIndex} direct texture material requires four UVs.`);
  }
  const uvs = value.map((uv, uvIndex) => {
    if (!Array.isArray(uv) || uv.length !== 2
        || uv.some((coordinate) => !Number.isFinite(coordinate) || coordinate < 0 || coordinate > 1)) {
      throw new Error(`${frameId} polygon ${polygonIndex} UV ${uvIndex} is invalid.`);
    }
    return Object.freeze(uv.map((coordinate) => Object.is(coordinate, -0) ? 0 : coordinate));
  });
  const corners = new Set(uvs.map(([u, v]) => `${u}|${v}`));
  const doubledArea = Math.abs(uvs.reduce((sum, [u, v], index) => {
    const [nextU, nextV] = uvs[(index + 1) % uvs.length];
    return sum + u * nextV - nextU * v;
  }, 0));
  if (corners.size !== 4 || doubledArea <= Number.EPSILON) {
    throw new Error(`${frameId} polygon ${polygonIndex} UV quad is degenerate.`);
  }
  return Object.freeze(uvs);
}

function collectPreparedAssets(frames) {
  const byUrl = new Map();
  for (const frame of frames) {
    for (const polygon of frame.polygons) {
      const materials = polygon.material ? [polygon.material] : [];
      for (const material of materials) {
        const source = material.imageSource;
        const descriptor = {
          url: material.texture,
          mediaType: "image/png",
          width: source.width,
          height: source.height,
          sha256: material.assetSha256,
        };
        const prior = byUrl.get(descriptor.url);
        if (prior && canonicalJson(prior) !== canonicalJson(descriptor)) {
          throw new Error(`Prepared texture asset ${descriptor.url} has conflicting descriptors.`);
        }
        byUrl.set(descriptor.url, descriptor);
      }
    }
  }
  return deepFreeze([...byUrl.values()].sort((left, right) => left.url.localeCompare(right.url)));
}

function meshInput(polygons) {
  return {
    polygons,
    objectUrls: [],
    warnings: [],
    dispose() {},
  };
}

function captureRenderedFrame(element, frame, frameIndex, expectedLeaves = null) {
  const nodes = Array.from(element.children);
  if (nodes.length === 0 || nodes.length > frame.polygons.length) {
    throw new Error(
      `Prepared render frame ${frame.id} emitted ${nodes.length} leaves for ${frame.polygons.length} polygons.`,
    );
  }
  const leaves = nodes.map((leaf, index) => {
    const tag = leaf.tagName.toLowerCase();
    if (!LEAF_TAGS.has(tag)) {
      throw new Error(`Prepared render frame ${frame.id} emitted asset-backed or unsupported <${tag}>.`);
    }
    const rawSourcePolygonIndex = leaf.getAttribute("data-poly-index");
    const sourcePolygonIndex = rawSourcePolygonIndex === null && frameIndex > 0
      ? expectedLeaves?.[index]?.sourcePolygonIndex
      : Number(rawSourcePolygonIndex);
    if (!Number.isSafeInteger(sourcePolygonIndex)
        || sourcePolygonIndex < 0
        || sourcePolygonIndex >= frame.polygons.length
        || (index > 0 && sourcePolygonIndex <= Number(nodes[index - 1]?.getAttribute("data-poly-index")
          ?? expectedLeaves?.[index - 1]?.sourcePolygonIndex ?? -1))) {
      throw new Error(`Prepared render frame ${frame.id} lost polygon-to-leaf order at ${index}.`);
    }
    const classes = [
      ...leaf.classList,
      ...(leaf.getAttribute("data-polycss-double-sided") === "true"
        ? ["cssoccer-two-sided-face"]
        : []),
    ].sort();
    if (classes.some((name) => !SAFE_ID.test(name))) {
      throw new Error(`Prepared render frame ${frame.id} emitted an unsafe PolyCSS class.`);
    }
    return deepFreeze({ tag, classes, sourcePolygonIndex });
  });
  const root = canonicalStyle(element, SAFE_ROOT_PROPERTIES, `${frame.id} root`);
  const leafStyles = nodes.map((leaf, index) => {
    const label = `${frame.id} leaf ${index}`;
    return canonicalStyle(leaf, SAFE_LEAF_PROPERTIES, label).css;
  });
  if (leafStyles.some((style) => style.length === 0)) {
    throw new Error(`Prepared render frame ${frame.id} emitted an unstyled leaf.`);
  }
  return {
    nodes,
    frame: deepFreeze({
      id: frame.id,
      frameIndex,
      rootStyle: root.css,
      rootStyleEntries: root.entries,
      leafStyles,
      leaves,
    }),
  };
}

function preparedLeafStyles(capturedFrame, preparedFrame) {
  return capturedFrame.leafStyles.map((style, leafIndex) => {
    const leaf = capturedFrame.leaves[leafIndex];
    const polygon = preparedFrame.polygons[leaf.sourcePolygonIndex];
    const marking = polygon.marking;
    const transparentTextureBackground = polygon.material
      && polygon.textureAlphaMode !== "opaque";
    if (!marking && !transparentTextureBackground) return style;
    if (marking && leaf.tag !== "s") {
      throw new Error(`Logical marking ${marking.id} did not use PolyCSS's normal <s> path.`);
    }
    const entries = new Map(style.split(";").filter(Boolean).map((declaration) => {
      const separator = declaration.indexOf(":");
      return [declaration.slice(0, separator), declaration.slice(separator + 1)];
    }));
    if (transparentTextureBackground) entries.set("background-color", "transparent");
    if (marking) {
      entries.set("background-repeat", "repeat");
      entries.set("background-size", "1px 1px");
      entries.set("image-rendering", "pixelated");
      if (marking.kind === "solid-circle") {
        entries.set("border-radius", "50%");
      }
    }
    return [...entries]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${name}:${value}`)
      .join(";");
  });
}

function canonicalCssStyle(entries) {
  return [...entries]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
}

function assertStableRenderedTopology(first, next, stableLeaves, frameIndex, requireNodeIdentity) {
  if (next.nodes.length !== stableLeaves.length) {
    throw new Error(`Prepared render frame ${frameIndex} changed the PolyCSS leaf count.`);
  }
  for (let index = 0; index < stableLeaves.length; index += 1) {
    if (requireNodeIdentity && next.nodes[index] !== stableLeaves[index]) {
      throw new Error(`Prepared render frame ${frameIndex} replaced PolyCSS leaf ${index}.`);
    }
    const firstLeaf = first.frame.leaves[index];
    const nextLeaf = next.frame.leaves[index];
    if (firstLeaf.tag !== nextLeaf.tag
        || canonicalJson(firstLeaf.classes) !== canonicalJson(nextLeaf.classes)
        || firstLeaf.sourcePolygonIndex !== nextLeaf.sourcePolygonIndex) {
      throw new Error(`Prepared render frame ${frameIndex} changed PolyCSS topology at leaf ${index}.`);
    }
  }
}

function canonicalStyle(element, allowedProperties, label) {
  const byName = new Map();
  for (let index = 0; index < element.style.length; index += 1) {
    const name = element.style.item(index).trim().toLowerCase();
    const value = element.style.getPropertyValue(name).trim().replace(/\s+/gu, " ");
    const priority = element.style.getPropertyPriority(name);
    if (!name || !value) continue;
    if (!allowedProperties.has(name)) {
      throw new Error(`${label} emitted unsupported CSS property ${name}.`);
    }
    if (UNSAFE_CSS_VALUE.test(value)) {
      throw new Error(`${label} emitted unsafe CSS in ${name}.`);
    }
    if (name === "background-image" || name === "border-image-source") {
      validateCssImageValue(value, label, name);
    }
    if ((name === "mask-image" || name === "-webkit-mask-image") && value !== "none") {
      throw new Error(`${label} emitted an unsupported CSS mask.`);
    }
    byName.set(name, `${value}${priority ? ` !${priority}` : ""}`);
  }
  const entries = [...byName].sort(([left], [right]) => left.localeCompare(right));
  return deepFreeze({
    css: entries.map(([name, value]) => `${name}:${value}`).join(";"),
    entries,
  });
}

function renderMeshHtml(styleClassName, leaves) {
  const body = leaves.map(({ tag, classes }) => (
    `<${tag} class="${classes.join(" ")}"></${tag}>`
  )).join("");
  return `<div class="polycss-mesh ${styleClassName}">${body}</div>`;
}

function renderMeshCss(styleClassName, leaves, rootStyle, leafStyles) {
  const rules = [];
  if (rootStyle) rules.push(`.${styleClassName}{${rootStyle}}`);
  for (let index = 0; index < leaves.length; index += 1) {
    const leafClass = `cssoccer-rbl-${index.toString(36)}`;
    rules.push(`.${styleClassName}>.${leafClass}{${leafStyles[index]}}`);
  }
  return rules.join("");
}

function assertSafePreparedCss(meshHtml, meshCss, assets) {
  const value = `${meshHtml}\n${meshCss}`;
  if (/(?:<img\b|<script\b|<style\b|\son[a-z]+\s*=|@import|javascript:|data:|blob:|(?:^|[;{])\s*(?:filter|box-shadow|text-shadow|mix-blend-mode)\s*:|(?:linear|radial|conic)-gradient\s*\()/iu.test(value)) {
    throw new Error("Prepared render bundle contains markup or CSS outside the fast path.");
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
    throw new Error(`${label} emitted an unsafe ${propertyName}.`);
  }
}

function createPrepareEnvironment() {
  const window = new Window({ url: "http://cssoccer.prepare.invalid/" });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36",
  });
  Object.defineProperty(window, "CSS", {
    configurable: true,
    value: { supports: () => true },
  });
  window.matchMedia = (query) => ({
    matches: query.includes("pointer: fine") || query.includes("hover: hover"),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });

  const restorers = exposeGlobals({
    Blob: window.Blob,
    CSS: window.CSS,
    CustomEvent: window.CustomEvent,
    Document: window.Document,
    Element: window.Element,
    Event: window.Event,
    FileReader: window.FileReader,
    HTMLElement: window.HTMLElement,
    Image: window.Image,
    Node: window.Node,
    NodeList: window.NodeList,
    URL: window.URL,
    XMLSerializer: window.XMLSerializer,
    atob: window.atob.bind(window),
    btoa: window.btoa.bind(window),
    cancelAnimationFrame: clearTimeout,
    document: window.document,
    getComputedStyle: window.getComputedStyle.bind(window),
    location: window.location,
    navigator: window.navigator,
    performance: window.performance,
    requestAnimationFrame: (callback) => setTimeout(() => callback(window.performance.now()), 0),
    window,
  });
  return {
    document: window.document,
    close() {
      for (const restore of restorers.reverse()) restore();
      window.close();
    },
  };
}

function exposeGlobals(values) {
  return Object.entries(values).map(([name, value]) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
    return () => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    };
  });
}

function zeroRuntimeConstruction() {
  return Object.freeze({
    sourceParseCount: 0,
    geometryBuildCount: 0,
    topologyBuildCount: 0,
    materialBuildCount: 0,
    assetBuildCount: 0,
  });
}

function requireSafeId(value, label) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
}

function readPolycssVersion() {
  const entry = new URL(import.meta.resolve("@layoutit/polycss"));
  const manifest = JSON.parse(readFileSync(new URL("../package.json", entry), "utf8"));
  if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/iu.test(manifest.version)) {
    throw new Error("Could not bind the prepared render bundle to the installed PolyCSS version.");
  }
  return manifest.version;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  return JSON.stringify(sortForJson(value));
}

function sortForJson(value) {
  if (Array.isArray(value)) return value.map(sortForJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortForJson(child)]),
  );
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

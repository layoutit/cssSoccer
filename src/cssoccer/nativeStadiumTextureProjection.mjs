import {
  CSSOCCER_ACTUA_GAMEPLAY_CAMERA,
  projectCssoccerActuaRendererPoint,
} from "./actuaGameplayCamera.mjs";

const STADIUM_BUNDLE_PREFIX = "static-stadium-stand-";
const STADIUM_TEXTURE_ATTRIBUTE = "cssoccerNativeStadiumTexture";
const NATIVE_STADIUM_SCANLINE_RASTER_SCHEMA =
  "cssoccer-prepared-native-stadium-scanline-raster@4";
const NATIVE_STADIUM_RASTER_SOURCE_SCHEMA =
  "cssoccer-prepared-native-stadium-raster-source@2";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const VIEWPORT_WIDTH = 640;
const VIEWPORT_HEIGHT = 400;
const VIEWPORT_MARGIN = 32;
const NATIVE_NEAR_PLANE = 15;
const NATIVE_FIXED_SCALE = 0x0001_0000;
const SCANLINE_SLOT_COUNT = 32;
const MATRIX_EPSILON = 1e-9;
const MIN_PROJECTED_AREA = 4;

const BACKGROUND_PROPERTIES = Object.freeze([
  ["background-image", "--cssoccer-native-stadium-background-image"],
  ["background-position-x", "--cssoccer-native-stadium-background-position-x"],
  ["background-position-y", "--cssoccer-native-stadium-background-position-y"],
  ["background-size", "--cssoccer-native-stadium-background-size"],
  ["background-repeat", "--cssoccer-native-stadium-background-repeat"],
]);

/**
 * Retain native triangle correction on the prepared 3D leaf, and replace the
 * opaque crowd and billboard quads with a bounded screen-space strip pool.
 * The strip mapping follows polym's integer-projected vertices, fixed-point
 * edge slopes, and affine texture spans; all source UV/page facts are prepared.
 */
export function createCssoccerNativeStadiumTextureProjection({
  host,
  rasterSource,
}) {
  if (!host?.ownerDocument || typeof host.appendChild !== "function") {
    throw new Error("Native stadium projection requires the canonical scene host.");
  }

  const layer = host.ownerDocument.createElement("div");
  layer.className = "cssoccer-native-stadium-scanline-layer";
  layer.dataset.cssoccerNativeStadiumScanlineLayer = "true";
  const preparedRasterSource = prepareNativeRasterSource(rasterSource);
  const rasterLayer = createNativeRasterLayer(
    layer,
    preparedRasterSource.usedPaletteIndexes,
    preparedRasterSource.colors,
  );
  const slots = Array.from(
    { length: SCANLINE_SLOT_COUNT },
    (_unused, index) => createScanlineSlot(
      layer,
      rasterLayer,
      preparedRasterSource.usedPaletteIndexes,
      index,
    ),
  );
  host.appendChild(layer);

  const triangleRecords = [];
  const scanlineRecords = [];
  let registeredBundleCount = 0;
  let paintOrder = 0;
  let applyCount = 0;
  let transformWriteCount = 0;
  let slotAssignmentCount = 0;
  let activeScanlineFaceCount = 0;
  let nativeBackfaceHiddenCount = 0;
  let nearPlaneClippedFaceCount = 0;
  let visibleScanlineCandidateCount = 0;

  const register = ({ bundle, handle }) => {
    if (!bundle?.id?.startsWith(STADIUM_BUNDLE_PREFIX)) return false;
    if (!handle || !Array.isArray(handle.leaves)) {
      throw new Error(`Native stadium projection requires mounted leaves for ${bundle.id}.`);
    }
    if (
      bundle.leafStyles.length !== handle.leaves.length
      || bundle.leaves.length !== handle.leaves.length
    ) {
      throw new Error(`Native stadium projection lost prepared leaf parity for ${bundle.id}.`);
    }

    for (let index = 0; index < bundle.leaves.length; index += 1) {
      const leafMetadata = bundle.leaves[index];
      if (leafMetadata.tag !== "s") continue;
      const declarations = parseCanonicalDeclarations(bundle.leafStyles[index]);
      const matrix = parsePreparedMatrix3d(declarations.get("transform"), bundle.id, index);
      const materialProjection = leafMetadata.materialProjection
        ?? (hasProjectiveTerms(matrix) ? "projective" : "affine");
      const width = parsePreparedPixels(
        declarations.get("--polycss-atlas-width"),
        bundle.id,
        index,
        "width",
      );
      const height = parsePreparedPixels(
        declarations.get("--polycss-atlas-height"),
        bundle.id,
        index,
        "height",
      );
      const leaf = handle.leaves[index];

      if (materialProjection === "affine") {
        for (const [property, customProperty] of BACKGROUND_PROPERTIES) {
          const value = declarations.get(property);
          if (!value) {
            throw new Error(
              `Native stadium projection lost ${property} on ${bundle.id} leaf ${index}.`,
            );
          }
          leaf.style.setProperty(customProperty, value);
        }
        leaf.style.setProperty("background-image", "none");
        leaf.dataset[STADIUM_TEXTURE_ATTRIBUTE] = "triangle";
        triangleRecords.push({
          appliedTransform: null,
          height,
          leaf,
          matrix,
          width,
        });
      }

      if (materialProjection !== "affine" && materialProjection !== "projective") {
        throw new Error(
          `Native stadium projection has unknown material projection at ${bundle.id} leaf ${index}.`,
        );
      }
      if (!leafMetadata.nativeTextureRaster) continue;
      const nativeTextureRaster = requireNativeTextureRaster(
        leafMetadata.nativeTextureRaster,
        bundle.id,
        index,
      );
      const nativeRasterSource = preparedRasterSource.byId.get(
        nativeTextureRaster.sourceRasterId,
      );
      if (
        !nativeRasterSource
        || nativeRasterSource.width !== nativeTextureRaster.sourceRasterWidth
        || nativeRasterSource.height !== nativeTextureRaster.sourceRasterHeight
      ) {
        throw new Error(
          `Native stadium scanline raster lost its prepared pixels at ${bundle.id} leaf ${index}.`,
        );
      }
      const backgroundImage = declarations.get("background-image");
      const backgroundSize = declarations.get("background-size");
      if (!backgroundImage || !backgroundSize) {
        throw new Error(
          `Native stadium scanline raster lost its source image at ${bundle.id} leaf ${index}.`,
        );
      }
      scanlineRecords.push({
        active: false,
        backgroundImage,
        backgroundSize,
        bundleId: bundle.id,
        height,
        leaf,
        leafIndex: index,
        matrix,
        nativeRasterSource,
        nativeTextureRaster,
        nativeBackfaceHidden: false,
        paintOrder: paintOrder += 1,
        slot: null,
        fallbackTextureAttribute:
          materialProjection === "affine" ? "triangle" : null,
        width,
      });
    }
    registeredBundleCount += 1;
    return true;
  };

  const apply = (camera) => {
    applyCount += 1;
    for (const record of triangleRecords) {
      const projected = projectPreparedLeaf(record, camera);
      if (!isVisibleProjection(projected)) continue;
      const transform = formatCssHomography(
        nativeAffineCorrection(projected, record.width, record.height),
      );
      if (transform === record.appliedTransform) continue;
      record.leaf.style.setProperty(
        "--cssoccer-native-stadium-texture-transform",
        transform,
      );
      record.appliedTransform = transform;
      transformWriteCount += 1;
    }

    const candidates = scanlineRecords
      .map((record) => {
        const preparedLeaf = projectPreparedLeaf(record, camera);
        const projected = record.nativeTextureRaster.vertexCount === 3
          ? [preparedLeaf[0], preparedLeaf[1], preparedLeaf[3]]
          : preparedLeaf;
        const textured = projected.map(([x, y, depth], index) => {
          const [u, v] = record.nativeTextureRaster.rasterTextureFixed[index];
          return { x, y, depth, u, v };
        });
        const clipped = clipNativeTexturedPolygon(textured);
        const screenProjected = clipped.map(({ x, y, depth }) => [
          Math.trunc(x),
          Math.trunc(y),
          depth,
        ]);
        const nativeRasterProjected = clipped.map(({ x, y, depth, u, v }) => [
          Math.trunc(x),
          Math.trunc(VIEWPORT_HEIGHT - y),
          depth,
          u,
          v,
        ]);
        return {
          area: projectedArea(screenProjected),
          frontFacing:
            screenProjected.length >= 3
            && isNativeFrontFacing(screenProjected),
          nearPlaneClipped: clipped.length !== textured.length
            || textured.some(({ depth }) => depth < NATIVE_NEAR_PLANE),
          nativeRasterProjected,
          record,
          visible: isVisibleProjection(screenProjected),
        };
      });
    nearPlaneClippedFaceCount = candidates.filter(
      ({ nearPlaneClipped }) => nearPlaneClipped,
    ).length;
    const eligible = candidates
      .filter(({ frontFacing, record }) => {
        // The prepared leaf remains the source-coverage fallback when native
        // clipping makes its exact screen raster unavailable. Culling that
        // retained leaf creates holes between stands at camera-plane seams.
        setNativeBackfaceHidden(record, false);
        return frontFacing;
      })
      .filter(({ area, visible: isVisible }) => isVisible && area >= MIN_PROJECTED_AREA)
      .sort((left, right) => (
        right.area - left.area
        || left.record.paintOrder - right.record.paintOrder
      ));
    visibleScanlineCandidateCount = eligible.length;
    const visible = eligible.slice(0, slots.length);
    const selected = new Set(visible.map(({ record }) => record));
    const visibleByPaintOrder = [...visible].sort((left, right) => (
      left.record.paintOrder - right.record.paintOrder
    ));

    for (const record of scanlineRecords) {
      if (selected.has(record)) continue;
      deactivateScanlineRecord(record);
    }

    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      const entry = visibleByPaintOrder[index];
      if (!entry) {
        releaseScanlineSlot(slot);
        continue;
      }
      if (slot.record !== entry.record) {
        releaseScanlineSlot(slot);
        slot.record = entry.record;
        entry.record.slot = slot;
        slotAssignmentCount += 1;
      }
      const writes = applyNativeRasterRecord(
        entry.record,
        slot,
        entry.nativeRasterProjected,
      );
      transformWriteCount += writes;
    }
    activeScanlineFaceCount = visible.filter(({ record }) => record.active).length;
    nativeBackfaceHiddenCount = scanlineRecords.filter(
      ({ nativeBackfaceHidden }) => nativeBackfaceHidden,
    ).length;
  };

  return Object.freeze({
    element: layer,
    register,
    apply,
    remove() {
      for (const record of scanlineRecords) {
        deactivateScanlineRecord(record);
        setNativeBackfaceHidden(record, false);
      }
      layer.remove();
    },
    stats() {
      return Object.freeze({
        activeScanlineFaceCount,
        applyCount,
        registeredBundleCount,
        nativeBackfaceHiddenCount,
        nearPlaneClippedFaceCount,
        scanlineCandidateCount: scanlineRecords.length,
        scanlineSlotCount: slots.length,
        slotAssignmentCount,
        triangleLeafCount: triangleRecords.length,
        transformWriteCount,
        visibleScanlineCandidateCount,
      });
    },
  });
}

function createNativeRasterLayer(layer, paletteIndexes, colors) {
  const svg = layer.ownerDocument.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`);
  svg.setAttribute("width", String(VIEWPORT_WIDTH));
  svg.setAttribute("height", String(VIEWPORT_HEIGHT));
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("cssoccer-native-stadium-exact-raster");
  svg.dataset.cssoccerNativeStadiumExactRaster = "true";
  svg.style.setProperty("--cssoccer-native-stadium-raster-color-count", String(
    paletteIndexes.length,
  ));
  for (const paletteIndex of paletteIndexes) {
    svg.style.setProperty(
      `--cssoccer-native-stadium-raster-color-${paletteIndex}`,
      colors[paletteIndex],
    );
  }
  layer.appendChild(svg);
  return svg;
}

function createScanlineSlot(layer, rasterLayer, paletteIndexes, index) {
  const rasterGroup = layer.ownerDocument.createElementNS(SVG_NAMESPACE, "g");
  rasterGroup.dataset.cssoccerNativeStadiumRasterSlot = String(index);
  rasterGroup.style.display = "none";
  const rasterPaths = new Map();
  for (const paletteIndex of paletteIndexes) {
    const path = layer.ownerDocument.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("fill", `var(--cssoccer-native-stadium-raster-color-${paletteIndex})`);
    path.setAttribute("shape-rendering", "crispEdges");
    path.dataset.cssoccerNativeStadiumPaletteIndex = String(paletteIndex);
    rasterGroup.appendChild(path);
    rasterPaths.set(paletteIndex, {
      data: "",
      element: path,
    });
  }
  rasterLayer.appendChild(rasterGroup);

  const element = layer.ownerDocument.createElement("div");
  element.className = "cssoccer-native-stadium-scanline-face";
  element.dataset.cssoccerNativeStadiumScanlineSlot = String(index);
  element.hidden = true;
  layer.appendChild(element);
  return {
    backgroundImage: null,
    backgroundPositionX: null,
    backgroundPositionY: null,
    backgroundSize: null,
    sourceHeight: null,
    sourceWidth: null,
    bands: [],
    element,
    rasterGroup,
    rasterPaths,
    record: null,
  };
}

function applyNativeRasterRecord(record, slot, projected) {
  const paths = buildNativeRasterPaths(record, projected);
  if (paths === null) {
    throw new Error(
      `Native stadium raster ${record.nativeTextureRaster.sourceRasterId} `
      + "escaped its prepared indexed source.",
    );
  }
  slot.element.hidden = true;
  slot.rasterGroup.style.removeProperty("display");
  slot.rasterGroup.dataset.cssoccerNativeStadiumRasterFace =
    `${record.bundleId}:${record.leafIndex}`;
  let writes = 0;
  for (const [paletteIndex, mounted] of slot.rasterPaths) {
    const data = paths.get(paletteIndex) ?? "";
    if (mounted.data === data) continue;
    mounted.element.setAttribute("d", data);
    mounted.data = data;
    writes += 1;
  }
  record.leaf.dataset[STADIUM_TEXTURE_ATTRIBUTE] = "scanline";
  record.active = true;
  return writes;
}

function applyScanlineRecord(record, slot, projected) {
  const bands = buildNativeScanlineBands(record, projected);
  if (bands.length === 0) {
    deactivateScanlineRecord(record);
    return 0;
  }

  let writes = 0;
  const backgroundPositionX = `${-record.nativeTextureRaster.atlasSourceRect.x}px`;
  const backgroundPositionY = `${-record.nativeTextureRaster.atlasSourceRect.y}px`;
  const sourceWidth = `${record.nativeTextureRaster.atlasSourceRect.width}px`;
  const sourceHeight = `${record.nativeTextureRaster.atlasSourceRect.height}px`;
  if (slot.backgroundImage !== record.backgroundImage) {
    slot.element.style.setProperty(
      "--cssoccer-native-stadium-scanline-background-image",
      record.backgroundImage,
    );
    slot.backgroundImage = record.backgroundImage;
    writes += 1;
  }
  if (slot.backgroundSize !== record.backgroundSize) {
    slot.element.style.setProperty(
      "--cssoccer-native-stadium-scanline-background-size",
      record.backgroundSize,
    );
    slot.backgroundSize = record.backgroundSize;
    writes += 1;
  }
  if (slot.backgroundPositionX !== backgroundPositionX) {
    slot.element.style.setProperty(
      "--cssoccer-native-stadium-scanline-background-position-x",
      backgroundPositionX,
    );
    slot.backgroundPositionX = backgroundPositionX;
    writes += 1;
  }
  if (slot.backgroundPositionY !== backgroundPositionY) {
    slot.element.style.setProperty(
      "--cssoccer-native-stadium-scanline-background-position-y",
      backgroundPositionY,
    );
    slot.backgroundPositionY = backgroundPositionY;
    writes += 1;
  }
  if (slot.sourceWidth !== sourceWidth) {
    slot.element.style.setProperty(
      "--cssoccer-native-stadium-scanline-source-width",
      sourceWidth,
    );
    slot.sourceWidth = sourceWidth;
    writes += 1;
  }
  if (slot.sourceHeight !== sourceHeight) {
    slot.element.style.setProperty(
      "--cssoccer-native-stadium-scanline-source-height",
      sourceHeight,
    );
    slot.sourceHeight = sourceHeight;
    writes += 1;
  }
  const zIndex = String(record.paintOrder);
  if (slot.element.style.zIndex !== zIndex) {
    slot.element.style.zIndex = zIndex;
    writes += 1;
  }
  slot.element.dataset.cssoccerNativeStadiumScanlineFace =
    `${record.bundleId}:${record.leafIndex}`;
  slot.element.hidden = false;

  for (let index = 0; index < slot.bands.length; index += 1) {
    const mounted = slot.bands[index];
    const prepared = bands[index];
    if (!prepared) {
      mounted.element.hidden = true;
      continue;
    }
    mounted.element.hidden = false;
    const top = `${prepared.top}px`;
    const height = `${prepared.height}px`;
    const left = `${prepared.left}px`;
    const width = `${prepared.width}px`;
    if (mounted.top !== top) {
      mounted.element.style.top = top;
      mounted.top = top;
      writes += 1;
    }
    if (mounted.height !== height) {
      mounted.element.style.height = height;
      mounted.height = height;
      writes += 1;
    }
    if (mounted.left !== left) {
      mounted.element.style.left = left;
      mounted.left = left;
      writes += 1;
    }
    if (mounted.width !== width) {
      mounted.element.style.width = width;
      mounted.width = width;
      writes += 1;
    }
    if (mounted.transform !== prepared.transform) {
      mounted.element.style.setProperty(
        "--cssoccer-native-stadium-scanline-transform",
        prepared.transform,
      );
      mounted.transform = prepared.transform;
      writes += 1;
    }
  }
  record.leaf.dataset[STADIUM_TEXTURE_ATTRIBUTE] = "scanline";
  record.active = true;
  return writes;
}

function deactivateScanlineRecord(record) {
  if (record.leaf.dataset[STADIUM_TEXTURE_ATTRIBUTE] === "scanline") {
    if (record.fallbackTextureAttribute === null) {
      delete record.leaf.dataset[STADIUM_TEXTURE_ATTRIBUTE];
    } else {
      record.leaf.dataset[STADIUM_TEXTURE_ATTRIBUTE] =
        record.fallbackTextureAttribute;
    }
  }
  record.active = false;
  if (!record.slot) return;
  releaseScanlineSlot(record.slot);
}

function setNativeBackfaceHidden(record, hidden) {
  if (record.nativeBackfaceHidden === hidden) return;
  record.nativeBackfaceHidden = hidden;
  if (hidden) {
    record.leaf.style.setProperty("visibility", "hidden");
  } else {
    record.leaf.style.removeProperty("visibility");
  }
}

function releaseScanlineSlot(slot) {
  if (slot.record) slot.record.slot = null;
  slot.record = null;
  slot.element.hidden = true;
  slot.rasterGroup.style.display = "none";
  delete slot.rasterGroup.dataset.cssoccerNativeStadiumRasterFace;
  delete slot.element.dataset.cssoccerNativeStadiumScanlineFace;
}

function clipNativeTexturedPolygon(vertices) {
  if (vertices.length < 3) return [];
  const clipped = [];
  let previous = vertices.at(-1);
  let previousInside = previous.depth >= NATIVE_NEAR_PLANE;

  for (const current of vertices) {
    const currentInside = current.depth >= NATIVE_NEAR_PLANE;
    if (currentInside !== previousInside) {
      clipped.push(nativeNearPlaneIntersection(previous, current));
    }
    if (currentInside) clipped.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return clipped;
}

function nativeNearPlaneIntersection(first, second) {
  const amount = (
    (NATIVE_NEAR_PLANE - first.depth)
    / (second.depth - first.depth)
  );
  const projection = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.projectionScale;
  const midpointX = VIEWPORT_WIDTH / 2;
  const midpointY = VIEWPORT_HEIGHT / 2;
  const firstCameraX = (first.x - midpointX) * first.depth / projection;
  const firstCameraY = (midpointY - first.y) * first.depth / projection;
  const secondCameraX = (second.x - midpointX) * second.depth / projection;
  const secondCameraY = (midpointY - second.y) * second.depth / projection;
  const cameraX = firstCameraX + amount * (secondCameraX - firstCameraX);
  const cameraY = firstCameraY + amount * (secondCameraY - firstCameraY);
  return {
    x: midpointX + projection * cameraX / NATIVE_NEAR_PLANE,
    y: midpointY - projection * cameraY / NATIVE_NEAR_PLANE,
    depth: NATIVE_NEAR_PLANE,
    u: Math.trunc(first.u + amount * (second.u - first.u)),
    v: Math.trunc(first.v + amount * (second.v - first.v)),
  };
}

function buildNativeRasterPaths(record, projected) {
  const source = record.nativeRasterSource;
  if (!source) return null;
  const vertices = projected.map(([x, y, _depth, u, v]) => {
    return { x, y, u, v };
  });
  const minimumNativeY = Math.min(...vertices.map(({ y }) => y));
  const maximumNativeY = Math.max(...vertices.map(({ y }) => y));
  const startY = Math.max(0, VIEWPORT_HEIGHT - 1 - maximumNativeY);
  const endY = Math.min(VIEWPORT_HEIGHT, VIEWPORT_HEIGHT - minimumNativeY);
  if (!(endY > startY)) return new Map();
  const paths = new Map();

  for (let screenRow = startY; screenRow < endY; screenRow += 1) {
    const span = nativeSpanAtScreenRow(vertices, screenRow);
    if (!span) continue;
    const width = span.right.x - span.left.x;
    if (width <= 0) continue;
    const firstX = Math.max(0, span.left.x);
    const endX = Math.min(VIEWPORT_WIDTH, span.right.x);
    if (!(endX > firstX)) continue;
    const uStep = truncatingDivide(span.left.u - span.right.u, width);
    const vStep = truncatingDivide(span.left.v - span.right.v, width);
    let runPaletteIndex = null;
    let runStart = firstX;

    for (let x = firstX; x < endX; x += 1) {
      const sourceOffset = span.right.x - 1 - x;
      const sourceX = Math.floor(
        (span.right.u + uStep * sourceOffset) / NATIVE_FIXED_SCALE,
      );
      const sourceY = Math.floor(
        (span.right.v + vStep * sourceOffset) / NATIVE_FIXED_SCALE,
      );
      if (
        sourceX < 0
        || sourceX >= source.width
        || sourceY < 0
        || sourceY >= source.height
      ) {
        return null;
      }
      const paletteIndex = source.pixels[sourceY * source.width + sourceX];
      if (paletteIndex === runPaletteIndex) continue;
      if (runPaletteIndex !== null) {
        appendNativeRasterRun(
          paths,
          runPaletteIndex,
          runStart,
          x,
          screenRow,
        );
      }
      runPaletteIndex = paletteIndex;
      runStart = x;
    }
    if (runPaletteIndex !== null) {
      appendNativeRasterRun(
        paths,
        runPaletteIndex,
        runStart,
        endX,
        screenRow,
      );
    }
  }
  return paths;
}

function appendNativeRasterRun(paths, paletteIndex, startX, endX, screenRow) {
  const width = endX - startX;
  if (width <= 0) return;
  const prior = paths.get(paletteIndex) ?? "";
  paths.set(
    paletteIndex,
    `${prior}M${startX} ${screenRow}h${width}v1h-${width}z`,
  );
}

function buildNativeScanlineBands(record, projected) {
  const vertices = projected.map(([x, y], index) => {
    const [u, v] = record.nativeTextureRaster.rasterTextureFixed[index];
    return { x, y, u, v };
  });
  const minimumNativeY = Math.min(...vertices.map(({ y }) => y));
  const maximumNativeY = Math.max(...vertices.map(({ y }) => y));
  const startY = Math.max(0, VIEWPORT_HEIGHT - 1 - maximumNativeY);
  const endY = Math.min(VIEWPORT_HEIGHT, VIEWPORT_HEIGHT - minimumNativeY);
  if (!(endY > startY)) return [];
  const rowCount = endY - startY;
  const rowsPerBand = Math.max(1, Math.ceil(rowCount / SCANLINE_BAND_COUNT));
  const bands = [];

  for (let top = startY; top < endY; top += rowsPerBand) {
    const bottom = Math.min(endY, top + rowsPerBand);
    const topSpan = nativeSpanAtScreenRow(vertices, top);
    const bottomSpan = nativeSpanAtScreenRow(vertices, bottom - 1);
    if (!topSpan || !bottomSpan) continue;
    const left = Math.floor(Math.min(topSpan.left.x, bottomSpan.left.x));
    const right = Math.ceil(Math.max(topSpan.right.x, bottomSpan.right.x));
    if (!(right > left)) continue;
    const sampleRow = Math.floor((top + bottom - 1) / 2);
    const verticalRow = sampleRow + 1 < endY ? sampleRow + 1 : sampleRow - 1;
    const sampleSpan = nativeSpanAtScreenRow(vertices, sampleRow);
    const verticalSpan = nativeSpanAtScreenRow(vertices, verticalRow);
    if (
      !sampleSpan
      || !verticalSpan
      || Math.abs(sampleSpan.right.x - sampleSpan.left.x) <= MATRIX_EPSILON
    ) {
      continue;
    }
    const sourceProjection = triangleToPlane([
      texturePoint(sampleSpan.left),
      texturePoint(sampleSpan.right),
      texturePoint(verticalSpan.left),
    ]);
    const destinationProjection = triangleToPlane([
      [sampleSpan.left.x - left, sampleRow - top],
      [sampleSpan.right.x - left, sampleRow - top],
      [verticalSpan.left.x - left, verticalRow - top],
    ]);
    if (Math.abs(determinant3(sourceProjection)) <= MATRIX_EPSILON) continue;
    const sourceToDestination = normalize3(multiply3(
      destinationProjection,
      invert3(sourceProjection),
    ));
    bands.push({
      top,
      height: bottom - top,
      left,
      width: right - left,
      transform: formatCssHomography(sourceToDestination),
    });
  }
  return bands;
}

function triangleToPlane([origin, horizontal, vertical]) {
  return [
    horizontal[0] - origin[0],
    vertical[0] - origin[0],
    origin[0],
    horizontal[1] - origin[1],
    vertical[1] - origin[1],
    origin[1],
    0,
    0,
    1,
  ];
}

function nativeSpanAtScreenRow(vertices, screenRow) {
  const nativeRow = VIEWPORT_HEIGHT - 1 - screenRow;
  let minimumIndex = 0;
  for (let index = 1; index < vertices.length; index += 1) {
    if (vertices[index].y < vertices[minimumIndex].y) minimumIndex = index;
  }
  const left = nativeChainPointAtRow(vertices, minimumIndex, 1, nativeRow, "left");
  const right = nativeChainPointAtRow(vertices, minimumIndex, -1, nativeRow, "right");
  if (!left || !right) return null;
  return {
    left,
    right,
  };
}

function nativeChainPointAtRow(vertices, startIndex, direction, row, side) {
  let index = startIndex;
  for (let visited = 0; visited < vertices.length; visited += 1) {
    const nextIndex = (
      index + direction + vertices.length
    ) % vertices.length;
    const low = vertices[index];
    const high = vertices[nextIndex];
    if (high.y < low.y) return null;
    if (high.y === low.y) {
      index = nextIndex;
      continue;
    }
    if (row >= low.y && row < high.y) {
      return nativeEdgePointAtRow(low, high, row, side);
    }
    index = nextIndex;
  }
  return null;
}

function nativeEdgePointAtRow(low, high, row, side) {
  const rowCount = high.y - low.y;
  const denominator = rowCount + 1;
  const offset = row - low.y;
  const deltaX = high.x - low.x;
  let xFixed = low.x * NATIVE_FIXED_SCALE;
  let xStep;
  let textureOffset = offset;

  if (side === "left") {
    xStep = truncatingDivide(
      (deltaX + (deltaX < 0 ? -1 : 1)) * NATIVE_FIXED_SCALE,
      denominator,
    );
    if (deltaX < 0) {
      xFixed += xStep + NATIVE_FIXED_SCALE;
      textureOffset += 1;
    }
  } else {
    xFixed += NATIVE_FIXED_SCALE - 1;
    xStep = truncatingDivide(
      (deltaX + (deltaX > 0 ? 1 : -1)) * NATIVE_FIXED_SCALE,
      denominator,
    );
    if (deltaX > 0) {
      xFixed += xStep;
      textureOffset += 1;
    } else {
      xFixed += NATIVE_FIXED_SCALE;
    }
  }

  const uStep = truncatingDivide(high.u - low.u, denominator);
  const vStep = truncatingDivide(high.v - low.v, denominator);
  return {
    x: Math.floor((xFixed + xStep * offset) / NATIVE_FIXED_SCALE),
    u: low.u + uStep * textureOffset,
    v: low.v + vStep * textureOffset,
  };
}

function texturePoint({ u, v }) {
  return [u / NATIVE_FIXED_SCALE, v / NATIVE_FIXED_SCALE];
}

function truncatingDivide(numerator, denominator) {
  return Math.trunc(numerator / denominator);
}

function prepareNativeRasterSource(value) {
  if (
    value?.schema !== NATIVE_STADIUM_RASTER_SOURCE_SCHEMA
    || value.interpolation !== "polym-screen-space-fixed16"
    || value.runtimeImageConstruction !== false
    || !Array.isArray(value.colors)
    || value.colors.length !== 256
    || value.colors.some((color) => !/^#[0-9a-f]{6}$/u.test(color))
    || !Array.isArray(value.sources)
    || value.sources.length === 0
    || value.sourceCount !== value.sources.length
  ) {
    throw new Error("Prepared native stadium raster source is incomplete.");
  }
  const byId = new Map();
  const usedPaletteIndexes = new Set();
  for (const source of value.sources) {
    if (
      typeof source?.id !== "string"
      || source.id.length === 0
      || source.encoding !== "palette-index-u8-row-major-base64"
      || !Number.isSafeInteger(source.width)
      || source.width <= 0
      || !Number.isSafeInteger(source.height)
      || source.height <= 0
      || typeof source.pixelsBase64 !== "string"
      || typeof source.pixelsSha256 !== "string"
      || !/^[0-9a-f]{64}$/u.test(source.pixelsSha256)
    ) {
      throw new Error("Prepared native stadium raster source entry is invalid.");
    }
    const pixels = decodeBase64Bytes(source.pixelsBase64);
    if (pixels.length !== source.width * source.height) {
      throw new Error(`Prepared native stadium raster ${source.id} changed byte length.`);
    }
    for (const paletteIndex of pixels) usedPaletteIndexes.add(paletteIndex);
    if (byId.has(source.id)) {
      throw new Error(`Prepared native stadium raster source duplicates ${source.id}.`);
    }
    byId.set(source.id, Object.freeze({
      id: source.id,
      width: source.width,
      height: source.height,
      pixels,
    }));
  }
  return Object.freeze({
    byId,
    colors: Object.freeze([...value.colors]),
    usedPaletteIndexes: Object.freeze(
      [...usedPaletteIndexes].sort((left, right) => left - right),
    ),
  });
}

function decodeBase64Bytes(value) {
  let binary;
  try {
    binary = globalThis.atob(value);
  } catch (error) {
    throw new Error("Prepared native stadium raster source is not valid base64.", {
      cause: error,
    });
  }
  return Uint8Array.from(binary, (character) => character.codePointAt(0));
}

function requireNativeTextureRaster(value, bundleId, leafIndex) {
  if (
    value?.schema !== NATIVE_STADIUM_SCANLINE_RASTER_SCHEMA
    || value.interpolation !== "polym-screen-space-fixed16"
    || ![8, 9].includes(value.nativePage)
    || !Number.isSafeInteger(value.textureIndex)
    || ![3, 4].includes(value.vertexCount)
    || !Number.isSafeInteger(value.atlasWidth)
    || value.atlasWidth <= 0
    || !Number.isSafeInteger(value.atlasHeight)
    || value.atlasHeight <= 0
    || typeof value.sourceRasterId !== "string"
    || value.sourceRasterId.length === 0
    || !Number.isSafeInteger(value.sourceRasterWidth)
    || value.sourceRasterWidth <= 0
    || !Number.isSafeInteger(value.sourceRasterHeight)
    || value.sourceRasterHeight <= 0
    || !Array.isArray(value.nativeSourceTextureFixed)
    || value.nativeSourceTextureFixed.length !== value.vertexCount
    || !Array.isArray(value.rasterTextureFixed)
    || value.rasterTextureFixed.length !== value.vertexCount
    || value.rasterTextureFixed.some((coordinate) => (
      !Array.isArray(coordinate)
      || coordinate.length !== 2
      || coordinate.some((entry, axis) => (
        !Number.isSafeInteger(entry)
        || entry < 0
        || entry > [
          value.sourceRasterWidth,
          value.sourceRasterHeight,
        ][axis] * NATIVE_FIXED_SCALE
      ))
    ))
  ) {
    throw new Error(
      `Native stadium scanline metadata is invalid at ${bundleId} leaf ${leafIndex}.`,
    );
  }
  return value;
}

function parseCanonicalDeclarations(style) {
  return new Map(style.split(";").map((declaration) => {
    const separator = declaration.indexOf(":");
    return [
      declaration.slice(0, separator),
      declaration.slice(separator + 1),
    ];
  }));
}

function parsePreparedMatrix3d(value, bundleId, leafIndex) {
  const match = /^matrix3d\(([^)]+)\)$/u.exec(value ?? "");
  const matrix = match?.[1].split(",").map(Number);
  if (
    !matrix
    || matrix.length !== 16
    || matrix.some((entry) => !Number.isFinite(entry))
    || Math.abs(matrix[11]) > MATRIX_EPSILON
    || Math.abs(matrix[15] - 1) > MATRIX_EPSILON
  ) {
    throw new Error(
      `Native stadium projection requires one prepared image plane at ${bundleId} leaf ${leafIndex}.`,
    );
  }
  return Object.freeze(matrix);
}

function hasProjectiveTerms(matrix) {
  return (
    Math.abs(matrix[3]) > MATRIX_EPSILON
    || Math.abs(matrix[7]) > MATRIX_EPSILON
  );
}

function parsePreparedPixels(value, bundleId, leafIndex, axis) {
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/u.exec(value ?? "");
  const pixels = Number(match?.[1]);
  if (!(pixels > 0)) {
    throw new Error(
      `Native stadium projection lost prepared ${axis} at ${bundleId} leaf ${leafIndex}.`,
    );
  }
  return pixels;
}

function projectPreparedLeaf(record, camera) {
  const { matrix, width, height } = record;
  return Object.freeze([
    projectPreparedPoint(matrix, 0, 0, camera),
    projectPreparedPoint(matrix, width, 0, camera),
    projectPreparedPoint(matrix, width, height, camera),
    projectPreparedPoint(matrix, 0, height, camera),
  ]);
}

function projectPreparedPoint(matrix, x, y, camera) {
  const homogeneousScale = matrix[3] * x + matrix[7] * y + matrix[15];
  if (Math.abs(homogeneousScale) <= MATRIX_EPSILON) {
    throw new Error("Native stadium projection crossed its prepared projective horizon.");
  }
  const cssPoint = [
    (matrix[0] * x + matrix[4] * y + matrix[12]) / homogeneousScale,
    (matrix[1] * x + matrix[5] * y + matrix[13]) / homogeneousScale,
    (matrix[2] * x + matrix[6] * y + matrix[14]) / homogeneousScale,
  ];
  const tile = CSSOCCER_ACTUA_GAMEPLAY_CAMERA.polycssTileSize;
  return projectCssoccerActuaRendererPoint(
    [cssPoint[1] / tile, cssPoint[0] / tile, cssPoint[2] / tile],
    camera,
  );
}

function isVisibleProjection(projected) {
  if (projected.some((point) => point[2] <= MATRIX_EPSILON)) return false;
  const xs = projected.map((point) => point[0]);
  const ys = projected.map((point) => point[1]);
  return (
    Math.max(...xs) >= -VIEWPORT_MARGIN
    && Math.min(...xs) <= VIEWPORT_WIDTH + VIEWPORT_MARGIN
    && Math.max(...ys) >= -VIEWPORT_MARGIN
    && Math.min(...ys) <= VIEWPORT_HEIGHT + VIEWPORT_MARGIN
  );
}

function projectedArea(projected) {
  return Math.abs(projected.reduce((sum, [x, y], index) => {
    const [nextX, nextY] = projected[(index + 1) % projected.length];
    return sum + x * nextY - nextX * y;
  }, 0)) / 2;
}

function isNativeFrontFacing([first, second, third]) {
  const firstToSecondX = first[0] - second[0];
  const firstToSecondY = first[1] - second[1];
  const firstToThirdX = first[0] - third[0];
  const firstToThirdY = first[1] - third[1];
  // Native pnt.y grows upward from the framebuffer origin. The browser
  // projection helper returns top-origin Y, so the source winding sign flips.
  return (
    firstToSecondX * firstToThirdY
    > firstToThirdX * firstToSecondY
  );
}

function nativeAffineCorrection(projected, width, height) {
  const currentScreenQuad = projected.map(([x, y]) => [x, y]);
  const [topLeft, , bottomRight, bottomLeft] = currentScreenQuad;
  const nativeScreenQuad = [
    topLeft,
    [
      topLeft[0] + bottomRight[0] - bottomLeft[0],
      topLeft[1] + bottomRight[1] - bottomLeft[1],
    ],
    bottomRight,
    bottomLeft,
  ];
  const currentProjection = squareToQuad(currentScreenQuad);
  const nativeProjection = squareToQuad(nativeScreenQuad);
  const unitCorrection = multiply3(
    invert3(currentProjection),
    nativeProjection,
  );
  return normalize3(multiply3(
    [width, 0, 0, 0, height, 0, 0, 0, 1],
    multiply3(
      unitCorrection,
      [1 / width, 0, 0, 0, 1 / height, 0, 0, 0, 1],
    ),
  ));
}

function squareToQuad([topLeft, topRight, bottomRight, bottomLeft]) {
  const dx1 = topRight[0] - bottomRight[0];
  const dx2 = bottomLeft[0] - bottomRight[0];
  const dx3 = topLeft[0] - topRight[0] + bottomRight[0] - bottomLeft[0];
  const dy1 = topRight[1] - bottomRight[1];
  const dy2 = bottomLeft[1] - bottomRight[1];
  const dy3 = topLeft[1] - topRight[1] + bottomRight[1] - bottomLeft[1];
  if (Math.abs(dx3) <= MATRIX_EPSILON && Math.abs(dy3) <= MATRIX_EPSILON) {
    return [
      topRight[0] - topLeft[0],
      bottomLeft[0] - topLeft[0],
      topLeft[0],
      topRight[1] - topLeft[1],
      bottomLeft[1] - topLeft[1],
      topLeft[1],
      0,
      0,
      1,
    ];
  }
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) <= MATRIX_EPSILON) {
    throw new Error("Native stadium projection reached a degenerate screen quad.");
  }
  const projectiveX = (dx3 * dy2 - dx2 * dy3) / denominator;
  const projectiveY = (dx1 * dy3 - dx3 * dy1) / denominator;
  return [
    topRight[0] - topLeft[0] + projectiveX * topRight[0],
    bottomLeft[0] - topLeft[0] + projectiveY * bottomLeft[0],
    topLeft[0],
    topRight[1] - topLeft[1] + projectiveX * topRight[1],
    bottomLeft[1] - topLeft[1] + projectiveY * bottomLeft[1],
    topLeft[1],
    projectiveX,
    projectiveY,
    1,
  ];
}

function invert3(matrix) {
  const [
    a, b, c,
    d, e, f,
    g, h, i,
  ] = matrix;
  const determinant = (
    a * (e * i - f * h)
    - b * (d * i - f * g)
    + c * (d * h - e * g)
  );
  if (Math.abs(determinant) <= MATRIX_EPSILON) {
    throw new Error("Native stadium projection reached a singular transform.");
  }
  return [
    (e * i - f * h) / determinant,
    (c * h - b * i) / determinant,
    (b * f - c * e) / determinant,
    (f * g - d * i) / determinant,
    (a * i - c * g) / determinant,
    (c * d - a * f) / determinant,
    (d * h - e * g) / determinant,
    (b * g - a * h) / determinant,
    (a * e - b * d) / determinant,
  ];
}

function determinant3([
  a, b, c,
  d, e, f,
  g, h, i,
]) {
  return (
    a * (e * i - f * h)
    - b * (d * i - f * g)
    + c * (d * h - e * g)
  );
}

function multiply3(left, right) {
  const result = new Array(9);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] = (
        left[row * 3] * right[column]
        + left[row * 3 + 1] * right[column + 3]
        + left[row * 3 + 2] * right[column + 6]
      );
    }
  }
  return result;
}

function normalize3(matrix) {
  const scale = matrix[8];
  if (Math.abs(scale) <= MATRIX_EPSILON) {
    throw new Error("Native stadium projection lost its homogeneous scale.");
  }
  return matrix.map((value) => value / scale);
}

function formatCssHomography(matrix) {
  const [
    xx, xy, xt,
    yx, yy, yt,
    wx, wy, wt,
  ] = matrix;
  const values = [
    xx, yx, 0, wx,
    xy, yy, 0, wy,
    0, 0, 1, 0,
    xt, yt, 0, wt,
  ];
  return `matrix3d(${values.map(formatCssNumber).join(",")})`;
}

function formatCssNumber(value) {
  const normalized = Math.abs(value) <= 1e-10 ? 0 : value;
  return String(Number(normalized.toFixed(9)));
}

import { projectCssoccerActuaRendererPoint } from "./actuaGameplayCamera.mjs";

const CONTRACT_SCHEMA = "cssoccer-prepared-native-pitch-line-raster@1";
const MARKING_KIND = "native-screen-line";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const FIXED_POINT_SCALE = 65_536;
const SOURCE_NEAR_CLIP_DISTANCE = 15;

/**
 * Reproduce the source's tier-zero composition: retained world polygons plus
 * 3DENG.C/Render.c's camera-dependent integer center lines in one stable path.
 */
export function mountCssoccerNativePitchLineRaster({
  overlay,
  contract,
  markingHandle,
  markingBundle,
  camera,
}) {
  const prepared = requireContract(contract);
  if (!overlay?.ownerDocument || typeof overlay.insertBefore !== "function") {
    throw new Error("Native pitch-line raster requires the exact screen overlay.");
  }
  if (
    !markingHandle
    || !Array.isArray(markingHandle.leaves)
    || !markingBundle
    || !Array.isArray(markingBundle.leaves)
    || markingHandle.leaves.length !== markingBundle.leaves.length
  ) {
    throw new Error("Native pitch-line raster lost its prepared PolyCSS fallback.");
  }
  const fallbackLeaves = markingBundle.leaves
    .filter(({ marking }) => marking?.kind === MARKING_KIND)
    .map(({ index }) => markingHandle.leaves[index]);
  if (
    fallbackLeaves.length !== prepared.fallback.logicalLeafCount
    || fallbackLeaves.some((leaf) => !leaf)
  ) {
    throw new Error("Native pitch-line raster lost the 17 retained polygon bases.");
  }

  const documentImpl = overlay.ownerDocument;
  const svg = documentImpl.createElementNS(SVG_NAMESPACE, "svg");
  svg.classList.add("cssoccer-native-pitch-line-layer");
  svg.dataset.cssoccerNativePitchLineLayer = "true";
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute(
    "viewBox",
    `0 0 ${prepared.viewport.width} ${prepared.viewport.height}`,
  );
  svg.setAttribute("width", String(prepared.viewport.width));
  svg.setAttribute("height", String(prepared.viewport.height));
  svg.setAttribute("shape-rendering", "crispEdges");
  const path = documentImpl.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("fill", prepared.palette.color);
  svg.appendChild(path);
  overlay.insertBefore(svg, overlay.firstChild);

  let removed = false;
  let applyCount = 0;
  let pathWriteCount = 0;
  let lastPath = null;
  let lastPixelCount = 0;

  apply(camera);

  return Object.freeze({
    element: svg,
    apply,
    stats() {
      return Object.freeze({
        sourceSegmentCount: prepared.segments.length,
        retainedBasePolygonLeafCount: fallbackLeaves.length,
        connectedRootCount: Number(svg.isConnected),
        applyCount,
        pathWriteCount,
        pixelCount: lastPixelCount,
      });
    },
    remove() {
      if (removed) return;
      removed = true;
      svg.remove();
    },
  });

  function apply(nextCamera) {
    if (removed) throw new Error("Native pitch-line raster has been removed.");
    const pixels = new Set();
    for (const segment of prepared.segments) {
      const projected = segment.points.map((point) => (
        projectCssoccerActuaRendererPoint(point, nextCamera, {
          viewportWidth: prepared.viewport.width,
          viewportHeight: prepared.viewport.height,
        })
      ));
      const clipped = clipNativeLineToNearPlane(
        projected,
        prepared.viewport.width,
        prepared.viewport.height,
      );
      if (clipped === null) continue;
      const endpoints = clipped.map(([x, y]) => [
        Math.trunc(x),
        prepared.viewport.height - 1 - Math.trunc(prepared.viewport.height - y),
      ]);
      rasterNativeLine(
        endpoints[0],
        endpoints[1],
        prepared.viewport.width,
        prepared.viewport.height,
        pixels,
      );
    }
    const orderedPixels = [...pixels].sort((left, right) => left - right);
    const nextPath = orderedPixels.map((pixel) => {
      const x = pixel % prepared.viewport.width;
      const y = Math.trunc(pixel / prepared.viewport.width);
      return `M${x} ${y}h1v1h-1z`;
    }).join("");
    if (nextPath !== lastPath) {
      path.setAttribute("d", nextPath);
      lastPath = nextPath;
      pathWriteCount += 1;
    }
    lastPixelCount = pixels.size;
    applyCount += 1;
    return pixels.size;
  }
}

// addobjfc/addlinec in 3DENG.C stores unprojected screen numerators for points
// nearer than SCREENDIST, then intersects the line at z=15 before rasterizing.
// Projecting a behind-camera endpoint directly creates a false line across the
// sky, so reproduce that source clip in screen-relative homogeneous space.
function clipNativeLineToNearPlane(projected, width, height) {
  if (projected.every((point) => point[2] < SOURCE_NEAR_CLIP_DISTANCE)) {
    return null;
  }
  const centerX = width / 2;
  const centerY = height / 2;
  return projected.map((point, index) => {
    const depth = point[2];
    if (depth >= SOURCE_NEAR_CLIP_DISTANCE) return point;
    const other = projected[1 - index];
    const ratio = (SOURCE_NEAR_CLIP_DISTANCE - depth) / (other[2] - depth);
    const pointX = (point[0] - centerX) * depth / SOURCE_NEAR_CLIP_DISTANCE;
    const pointY = (point[1] - centerY) * depth / SOURCE_NEAR_CLIP_DISTANCE;
    const otherX = (other[0] - centerX) * other[2] / SOURCE_NEAR_CLIP_DISTANCE;
    const otherY = (other[1] - centerY) * other[2] / SOURCE_NEAR_CLIP_DISTANCE;
    return [
      centerX + pointX + ratio * (otherX - pointX),
      centerY + pointY + ratio * (otherY - pointY),
      SOURCE_NEAR_CLIP_DISTANCE,
    ];
  });
}

function requireContract(value) {
  if (
    !value
    || value.schema !== CONTRACT_SCHEMA
    || value.status !== "ready"
    || value.viewport?.width !== 640
    || value.viewport?.height !== 400
    || value.palette?.sourceIndex !== 22
    || value.palette?.color !== "#aeaeae"
    || value.raster?.sourceFile !== "Render.c"
    || value.raster?.routine !== "line"
    || value.raster?.fixedPointFractionBits !== 16
    || value.raster?.endpointInclusive !== true
    || value.raster?.antialias !== false
    || value.fallback?.rootId !== "pitch-markings"
    || value.fallback?.preparedMarkingKind !== MARKING_KIND
    || value.fallback?.logicalLeafCount !== 17
    || value.fallback?.composition !== "retained-world-polygon-plus-native-screen-line"
    || !Array.isArray(value.segments)
    || value.segments.length !== 28
    || value.segments.some(({ points }) => (
      !Array.isArray(points)
      || points.length !== 2
      || points.some((point) => (
        !Array.isArray(point)
        || point.length !== 3
        || point.some((coordinate) => !Number.isFinite(coordinate))
      ))
    ))
  ) {
    throw new Error("Native pitch-line raster contract is invalid.");
  }
  return value;
}

// Direct integer stepping equivalent to Render.c line() for the unclipped
// source segment. Restricting the monotonic major-axis index preserves the
// fixed-point accumulator while avoiding work on offscreen pixels.
function rasterNativeLine(first, second, width, height, pixels) {
  let [x1, y1] = first;
  let [x2, y2] = second;
  if (![x1, y1, x2, y2].every(Number.isSafeInteger)) return;
  const deltaX = Math.abs(x2 - x1);
  const deltaY = Math.abs(y2 - y1);
  if (deltaX >= deltaY) {
    if (x2 < x1) {
      [x1, x2] = [x2, x1];
      [y1, y2] = [y2, y1];
    }
    const count = x2 - x1 + 1;
    if (!Number.isSafeInteger(count) || count <= 0) return;
    const minor = Math.abs(y2 - y1) + 1;
    const step = Math.trunc((minor * FIXED_POINT_SCALE) / count);
    const sign = y2 >= y1 ? 1 : -1;
    const firstIndex = Math.max(0, -x1);
    const lastIndex = Math.min(count - 1, width - 1 - x1);
    for (let index = firstIndex; index <= lastIndex; index += 1) {
      const x = x1 + index;
      const y = y1 + sign * Math.trunc((index * step) / FIXED_POINT_SCALE);
      if (y >= 0 && y < height) pixels.add(y * width + x);
    }
    return;
  }
  if (y2 < y1) {
    [x1, x2] = [x2, x1];
    [y1, y2] = [y2, y1];
  }
  const count = y2 - y1 + 1;
  if (!Number.isSafeInteger(count) || count <= 0) return;
  const minor = Math.abs(x2 - x1) + 1;
  const step = Math.trunc((minor * FIXED_POINT_SCALE) / count);
  const sign = x2 >= x1 ? 1 : -1;
  const firstIndex = Math.max(0, -y1);
  const lastIndex = Math.min(count - 1, height - 1 - y1);
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const x = x1 + sign * Math.trunc((index * step) / FIXED_POINT_SCALE);
    const y = y1 + index;
    if (x >= 0 && x < width) pixels.add(y * width + x);
  }
}

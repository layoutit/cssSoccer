const F32 = Math.fround;

export const CSSOCCER_LIVE_ACTUA_PLAYER_PROJECTION_SCHEMA =
  "cssoccer-live-actua-player-projection@1";

export const CSSOCCER_NATIVE_PLAYER_LOGICAL_VIEWPORT = Object.freeze({
  width: 320,
  height: 200,
  projectionScale: 440,
  scaleX: 0.5,
  scaleY: 0.5,
  cutoffDistance: 5,
  screenDistance: 15,
});

const LEAF_WIDTH = 32;
const LEAF_HEIGHT = 64;
const PROJECTIVE_W_EPSILON = 1e-9;

/**
 * Apply the source addobjy/addpols projection for one prepared pose using the
 * current gameplay camera. Pose decoding and topology stay prepared; this is
 * the irreducible camera-dependent work the native renderer also performs.
 */
export function applyCssoccerLiveActuaPlayerProjection({
  topology,
  coordinates,
  camera,
  position,
  facing,
  viewport = CSSOCCER_NATIVE_PLAYER_LOGICAL_VIEWPORT,
} = {}, applyFace) {
  assertProjectionInput(topology, coordinates, camera, position, facing, viewport);
  if (typeof applyFace !== "function") {
    throw new TypeError("Live Actua player projection requires a face callback.");
  }
  const view = createView(camera, viewport);
  const points = projectPoints(coordinates, position, facing, view);
  let visibleFaceCount = 0;
  for (const face of topology.faces) {
    const projected = face.dispatch === "addpoly"
      ? projectAddpoly(face, points, view.cutoffDistance)
      : face.dispatch === "add3dcmap"
        ? projectAdd3dcmap(face, points, view.qa, view.cutoffDistance)
        : projectAdd3demap(face, points, view.qa, view.q, view.cutoffDistance);
    if (!projected.visible) {
      applyFace(face.faceIndex, null, false, null, null);
      continue;
    }
    const matrix = face.dispatch === "addpoly"
      ? leafRasterTriangleMatrices(projected.corners, -projected.depth)
      : leafRasterQuadMatrix(projected.corners, -projected.depth);
    if (matrix === null) {
      applyFace(face.faceIndex, null, false, null, null);
      continue;
    }
    visibleFaceCount += 1;
    applyFace(
      face.faceIndex,
      Array.isArray(matrix) ? matrix[0] : matrix,
      true,
      projected.materialSelectorOffset,
      projected.depth,
      Array.isArray(matrix) ? matrix[1] : null,
    );
  }
  return visibleFaceCount;
}

function createView(camera, viewport) {
  const [viewX, viewY, viewZ] = camera.rendered.renderer.eye.map(F32);
  let [targetX, targetY, targetZ] = camera.rendered.renderer.target.map(F32);
  targetX = F32(targetX - viewX);
  targetY = F32(targetY - viewY);
  targetZ = F32(targetZ - viewZ);
  let horizontalRange = targetX * targetX + targetZ * targetZ;
  if (horizontalRange < 1) {
    horizontalRange = 1;
    targetZ = 1;
  }
  const range = Math.sqrt(horizontalRange + targetY * targetY);
  horizontalRange = Math.sqrt(horizontalRange);
  const cth = F32(targetZ / horizontalRange);
  const sth = F32(targetX / horizontalRange);
  const cph = F32(horizontalRange / range);
  const sph = F32(targetY / range);
  const rows = [
    [cth, 0, F32(-sth)],
    [F32(-sth * sph), cph, F32(-cth * sph)],
    [F32(sth * cph), sph, F32(cth * cph)],
  ].map((row) => [
    ...row,
    F32(
      row[0] * F32(-viewX)
      + row[1] * F32(-viewY)
      + row[2] * F32(-viewZ),
    ),
  ]);
  const q = Math.trunc(
    viewport.projectionScale * ((viewport.scaleX + viewport.scaleY) / 2),
  );
  return {
    rows,
    q,
    qa: F32(q * 0.02),
    centerX: viewport.width >> 1,
    centerY: viewport.height >> 1,
    cutoffDistance: viewport.cutoffDistance,
    screenDistance: viewport.screenDistance,
  };
}

function projectPoints(coordinates, position, facing, view) {
  const [crot, srot] = facing;
  const [positionX, positionY, positionZ] = position;
  const points = new Float32Array(28 * 3);
  for (let pointIndex = 0; pointIndex < 28; pointIndex += 1) {
    const coordinateOffset = pointIndex * 3;
    const sourceX = coordinates[coordinateOffset];
    const sourceY = coordinates[coordinateOffset + 1];
    const sourceZ = coordinates[coordinateOffset + 2];
    const worldX = F32(sourceX * crot + sourceZ * srot + positionX);
    const worldY = F32(sourceY + positionY);
    const worldZ = F32(-sourceX * srot + sourceZ * crot + positionZ);
    const [rowX, rowY, rowZ] = view.rows;
    const rx = F32(worldX * rowX[0] + worldZ * rowX[2] + rowX[3]);
    const ry = F32(
      worldX * rowY[0] + worldY * rowY[1] + worldZ * rowY[2] + rowY[3],
    );
    const rz = F32(
      worldX * rowZ[0] + worldY * rowZ[1] + worldZ * rowZ[2] + rowZ[3],
    );
    let qrz;
    if (rz < view.screenDistance) {
      qrz = F32(1.5 - rz / view.screenDistance);
      qrz = F32(qrz * qrz);
      qrz = F32((view.q / view.screenDistance) * (qrz + 0.75));
    } else {
      qrz = F32(view.q / rz);
    }
    points[coordinateOffset] = rz;
    points[coordinateOffset + 1] = F32(rx * qrz + view.centerX);
    points[coordinateOffset + 2] = F32(ry * qrz + view.centerY);
  }
  return points;
}

function projectAddpoly(face, points, cutoffDistance) {
  const source = face.pointIndexes.map((pointIndex) => point(points, pointIndex));
  if (Math.min(...source.map(([depth]) => depth)) < cutoffDistance) return culled();
  const dx1 = F32(source[0][1] - source[1][1]);
  const dy1 = F32(source[0][2] - source[1][2]);
  const dx2 = F32(source[0][1] - source[2][1]);
  const dy2 = F32(source[0][2] - source[2][2]);
  if (!(dx1 * dy2 < dx2 * dy1)) return culled();
  let depth = source[0][0];
  for (let index = 1; index < source.length; index += 1) {
    depth = F32(depth + source[index][0]);
  }
  depth = F32(depth / source.length);
  return visible(
    source.map((value) => [Math.trunc(value[1]), Math.trunc(value[2])]),
    0,
    depth,
  );
}

function projectAdd3dcmap(face, points, qa, cutoffDistance) {
  const point1 = point(points, face.pointIndexes[0]);
  const point2 = point(points, face.pointIndexes[1]);
  if (Math.min(point1[0], point2[0]) < cutoffDistance) return culled();
  let dx1 = F32(point1[1] - point2[1]);
  let dy1 = F32(point1[2] - point2[2]);
  let dx2 = F32(dx1 * dx1 + dy1 * dy1);
  if (dx2 === 0) {
    dx1 = 1;
    dx2 = 1;
  }
  let tz2 = F32(
    face.primitiveParameters[0] * qa
    / (Math.sqrt(dx2) * F32(point1[0] + point2[0])),
  );
  let tz1 = F32(
    100 * F32(point2[0] - point1[0]) / face.primitiveParameters[1],
  );
  let selectorOffset = 0;
  let corners;
  if (tz1 >= 0) {
    if (tz1 > 0.78062475) selectorOffset -= tz1 > 0.92702481 ? 3 : 2;
    else if (tz1 > 0.48412292) selectorOffset -= 1;
    tz1 = F32(tz1 * tz2);
    const dy2 = F32(tz2 * dy1);
    dx2 = F32(tz2 * dx1);
    dy1 = F32(dy1 * tz1);
    dx1 = F32(dx1 * tz1);
    corners = [
      [point1[1] + dx1 - dy2, point1[2] + dy1 + dx2],
      [point1[1] + dx1 + dy2, point1[2] + dy1 - dx2],
      [point2[1] - dx1 + dy2, point2[2] - dy1 - dx2],
      [point2[1] - dx1 - dy2, point2[2] - dy1 + dx2],
    ];
  } else {
    if (tz1 < -0.78062475) selectorOffset += tz1 < -0.92702481 ? 3 : 2;
    else if (tz1 < -0.48412292) selectorOffset += 1;
    tz1 = F32(tz1 * tz2);
    const dy2 = F32(tz2 * dy1);
    dx2 = F32(tz2 * dx1);
    dy1 = F32(dy1 * tz1);
    dx1 = F32(dx1 * tz1);
    corners = [
      [point1[1] - dx1 - dy2, point1[2] - dy1 + dx2],
      [point1[1] - dx1 + dy2, point1[2] - dy1 - dx2],
      [point2[1] + dx1 + dy2, point2[2] + dy1 - dx2],
      [point2[1] + dx1 - dy2, point2[2] + dy1 + dx2],
    ];
  }
  return visible(integerCorners(corners), selectorOffset, F32((point1[0] + point2[0]) / 2));
}

function projectAdd3demap(face, points, qa, q, cutoffDistance) {
  const point1 = point(points, face.pointIndexes[0]);
  const point2 = point(points, face.pointIndexes[1]);
  const point3 = point(points, face.pointIndexes[2]);
  if (Math.min(point1[0], point2[0]) < cutoffDistance) return culled();
  let dx1 = F32(point1[1] - point2[1]);
  let dy1 = F32(point1[2] - point2[2]);
  const rx = F32(F32(point3[1] - point2[1]) * point3[0] / q);
  const ry = F32(F32(point3[2] - point2[2]) * point3[0] / q);
  let dx2 = F32(dx1 * dx1 + dy1 * dy1);
  if (dx2 === 0) {
    dx1 = 1;
    dx2 = 1;
  }
  let dy2 = F32(Math.sqrt(dx2));
  let tz2 = F32(qa / (dy2 * F32(point1[0] + point2[0])));
  let tz1 = F32(F32(rx * dy1 - ry * dx1) / dy2);
  if (tz1 < -1) tz1 = -1;
  if (tz1 > 1) tz1 = 1;
  let selectorOffset = -ellipseAngularColorOffset(tz1, point3[0] > point2[0]);
  const majorRadius = face.primitiveParameters[0];
  const minorRadius = face.primitiveParameters[1];
  tz1 = F32(tz1 * tz1);
  tz1 = F32(tz1 * F32((majorRadius - minorRadius) * (majorRadius + minorRadius)));
  dx2 = F32(tz2 * Math.sqrt(tz1 + minorRadius * minorRadius));
  dy2 = F32(100 * F32(point1[0] - point2[0]) / face.primitiveParameters[2]);
  let corners;
  if (dy2 >= 0) {
    if (dy2 > 0.555570233) selectorOffset -= dy2 > 0.836286155 ? 36 : 24;
    else if (dy2 > 0.195090322) selectorOffset -= 12;
    dy2 = F32(dy2 * tz2 * Math.sqrt(majorRadius * majorRadius - tz1));
    tz1 = F32(dy2 * dx1);
    tz2 = F32(dy2 * dy1);
    dx1 = F32(dx1 * dx2);
    dy1 = F32(dy1 * dx2);
    corners = [
      [point2[1] + dy1 - tz1, point2[2] - dx1 - tz2],
      [point2[1] - dy1 - tz1, point2[2] + dx1 - tz2],
      [point1[1] - dy1 + tz1, point1[2] + dx1 + tz2],
      [point1[1] + dy1 + tz1, point1[2] - dx1 + tz2],
    ];
  } else {
    if (dy2 < -0.258819045) selectorOffset += 12;
    dy2 = F32(dy2 * tz2 * Math.sqrt(majorRadius * majorRadius - tz1));
    tz1 = F32(dy2 * dx1);
    tz2 = F32(dy2 * dy1);
    dx1 = F32(dx1 * dx2);
    dy1 = F32(dy1 * dx2);
    corners = [
      [point2[1] + dy1 + tz1, point2[2] - dx1 + tz2],
      [point2[1] - dy1 + tz1, point2[2] + dx1 + tz2],
      [point1[1] - dy1 - tz1, point1[2] + dx1 - tz2],
      [point1[1] + dy1 - tz1, point1[2] - dx1 - tz2],
    ];
  }
  return visible(integerCorners(corners), selectorOffset, F32((point1[0] + point2[0]) / 2));
}

function ellipseAngularColorOffset(value, thirdIsDeeper) {
  if (thirdIsDeeper) {
    if (value > -0.2588) {
      if (value <= 0.7071) return value <= 0.2588 ? 9 : 10;
      return value <= 0.9659 ? 11 : 0;
    }
    if (value > -0.7071) return 8;
    return value > -0.9659 ? 7 : 6;
  }
  if (value <= 0.2588) {
    if (value > -0.7071) return value > -0.2588 ? 3 : 4;
    return value > -0.9659 ? 5 : 6;
  }
  if (value <= 0.7071) return 2;
  return value <= 0.9659 ? 1 : 0;
}

function leafRasterQuadMatrix(destination, cssDepth) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = destination;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  if (dx3 !== 0 || dy3 !== 0) {
    const denominator = dx1 * dy2 - dx2 * dy1;
    if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) return null;
    g = (dx3 * dy2 - dx2 * dy3) / denominator;
    h = (dx1 * dy3 - dx3 * dy1) / denominator;
  }
  const projectiveW = [1, 1 + g, 1 + g + h, 1 + h];
  if (projectiveW.some((value) => (
    !Number.isFinite(value) || value <= PROJECTIVE_W_EPSILON
  ))) return null;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const values = [
    a / LEAF_WIDTH,
    d / LEAF_WIDTH,
    cssDepth * g / LEAF_WIDTH,
    g / LEAF_WIDTH,
    b / LEAF_HEIGHT,
    e / LEAF_HEIGHT,
    cssDepth * h / LEAF_HEIGHT,
    h / LEAF_HEIGHT,
    0, 0, 1, 0,
    x0, y0, cssDepth, 1,
  ];
  if (values.some((value) => !Number.isFinite(value))) return null;
  return `matrix3d(${values.map(formatNumber).join(",")})`;
}

function leafRasterTriangleMatrices(destination, cssDepth) {
  const [point0, point1, point2, point3] = destination;
  const primary = leafRasterTriangleMatrix({
    origin: point0,
    xPoint: point1,
    opposite: point2,
    yPoint: null,
    cssDepth,
  });
  const secondary = leafRasterTriangleMatrix({
    origin: point0,
    xPoint: null,
    opposite: point2,
    yPoint: point3,
    cssDepth,
  });
  return primary === null || secondary === null ? null : [primary, secondary];
}

function leafRasterTriangleMatrix({
  origin,
  xPoint,
  opposite,
  yPoint,
  cssDepth,
}) {
  const xColumn = xPoint === null
    ? [
        (opposite[0] - yPoint[0]) / LEAF_WIDTH,
        (opposite[1] - yPoint[1]) / LEAF_WIDTH,
      ]
    : [
        (xPoint[0] - origin[0]) / LEAF_WIDTH,
        (xPoint[1] - origin[1]) / LEAF_WIDTH,
      ];
  const yColumn = yPoint === null
    ? [
        (opposite[0] - xPoint[0]) / LEAF_HEIGHT,
        (opposite[1] - xPoint[1]) / LEAF_HEIGHT,
      ]
    : [
        (yPoint[0] - origin[0]) / LEAF_HEIGHT,
        (yPoint[1] - origin[1]) / LEAF_HEIGHT,
      ];
  const values = [
    xColumn[0], xColumn[1], 0, 0,
    yColumn[0], yColumn[1], 0, 0,
    0, 0, 1, 0,
    origin[0], origin[1], cssDepth, 1,
  ];
  if (values.some((value) => !Number.isFinite(value))) return null;
  return `matrix3d(${values.map(formatNumber).join(",")})`;
}

function point(points, index) {
  const offset = index * 3;
  return [points[offset], points[offset + 1], points[offset + 2]];
}

function integerCorners(corners) {
  return corners.map(([x, y]) => [Math.trunc(x), Math.trunc(y)]);
}

function visible(corners, materialSelectorOffset, depth) {
  return { visible: true, corners, materialSelectorOffset, depth };
}

function culled() {
  return { visible: false };
}

function formatNumber(value) {
  if (Math.abs(value) < 1e-12) return "0";
  return Number(value.toPrecision(12)).toString();
}

function assertProjectionInput(topology, coordinates, camera, position, facing, viewport) {
  if (
    topology?.pointCount !== 28
    || topology?.faceCount !== 13
    || !Array.isArray(topology.faces)
    || topology.faces.length !== 13
    || topology.faces.some((face, faceIndex) => (
      face?.faceIndex !== faceIndex
      || !new Set(["addpoly", "add3dcmap", "add3demap"]).has(face.dispatch)
      || !Array.isArray(face.pointIndexes)
      || !Array.isArray(face.primitiveParameters)
    ))
    || !ArrayBuffer.isView(coordinates)
    || coordinates.length !== 84
    || !finiteVec3(camera?.rendered?.renderer?.eye)
    || !finiteVec3(camera?.rendered?.renderer?.target)
    || !finiteVec3(position)
    || !Array.isArray(facing)
    || facing.length !== 2
    || facing.some((value) => !Number.isFinite(value))
    || !Number.isSafeInteger(viewport?.width)
    || !Number.isSafeInteger(viewport?.height)
    || ![
      viewport.projectionScale,
      viewport.scaleX,
      viewport.scaleY,
      viewport.cutoffDistance,
      viewport.screenDistance,
    ].every(Number.isFinite)
  ) {
    throw new TypeError("Live Actua player projection input is invalid.");
  }
}

function finiteVec3(value) {
  return Array.isArray(value)
    && value.length === 3
    && value.every((entry) => Number.isFinite(entry));
}

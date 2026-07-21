import { CSSOCCER_EXACT_ACTUA_PLAYER_MODEL_SCHEMA } from
  "./exactActuaPlayerModel.mjs";

export const CSSOCCER_ACTUA_NATIVE_PROJECTION_SCHEMA =
  "cssoccer-actua-native-player-projection@1";

export const ACTUA_EXACT_PLAYER_CAMERA = Object.freeze({
  width: 640,
  height: 400,
  target: Object.freeze([0, 10, 0]),
  eyeY: 40,
  distance: 80,
  scaleX: 1,
  scaleY: 1,
  cutoffDistance: 5,
  screenDistance: 15,
});

const f32 = Math.fround;

/**
 * Evaluate the native player projection for geometry and material-selector
 * offsets only. This is the one-basis prepare seam used by every team.
 */
export function projectExactActuaPlayerCoordinates({
  topology,
  coordinates,
  preparedPoseIndex,
  yawDegrees,
  sourcePoseBitsSha256,
  camera = ACTUA_EXACT_PLAYER_CAMERA,
} = {}) {
  assertExactTopologyAndCoordinates(topology, coordinates);
  if (!Number.isSafeInteger(preparedPoseIndex) || preparedPoseIndex < 0) {
    throw new RangeError("Exact Actua preparedPoseIndex must be a non-negative integer.");
  }
  if (!Number.isFinite(yawDegrees)) throw new TypeError("Exact Actua yawDegrees must be finite.");
  if (typeof sourcePoseBitsSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(sourcePoseBitsSha256)) {
    throw new TypeError("Exact Actua source pose hash is invalid.");
  }
  const view = nativeViewContract(camera, yawDegrees);
  const sourcePoints = Array.from({ length: topology.pointCount }, (_, pointIndex) => {
    const offset = pointIndex * 3;
    return Object.freeze(coordinates.slice(offset, offset + 3));
  });
  const rotatedPoints = sourcePoints.map((point) => rotateAndProjectPoint(point, view));
  const selectorBase = -4096;
  const faces = topology.faces.map((face) => {
    const result = face.dispatch === "addpoly"
      ? projectAddpoly(face, rotatedPoints, selectorBase, camera.cutoffDistance)
      : face.dispatch === "add3dcmap"
        ? projectAdd3dcmap(face, rotatedPoints, selectorBase, view.qa, camera.cutoffDistance)
        : projectAdd3demap(face, rotatedPoints, selectorBase, view.qa, view.q, camera.cutoffDistance);
    return {
      schema: "cssoccer-actua-native-player-geometry-projection@1",
      preparedPoseIndex,
      yawDegrees,
      faceIndex: face.faceIndex,
      primitiveCode: face.primitiveCode,
      dispatch: face.dispatch,
      sourcePoseBitsSha256,
      visible: result.visible,
      cull: result.visible ? null : "native-facing-or-depth",
      projectedCorners: result.projectedCorners,
      projectedCornerType: "signed-int32",
      materialSelectorOffset: result.visible ? result.selectedColorCode - selectorBase : null,
      depth: result.depth,
      depthBits: result.visible ? float32Hex(result.depth) : null,
      drawOrder: null,
    };
  });
  faces
    .filter(({ visible }) => visible)
    .sort((left, right) => right.depth - left.depth || left.faceIndex - right.faceIndex)
    .forEach((face, drawOrder) => { face.drawOrder = drawOrder; });
  return Object.freeze({
    schema: "cssoccer-actua-native-player-geometry-sample@1",
    preparedPoseIndex,
    yawDegrees,
    sourcePoseBitsSha256,
    camera: view.publicContract,
    faces: Object.freeze(faces.map(deepFreeze)),
  });
}

/** Evaluate the original drawman/addobjy/addpols path for one prepared pose/view. */
export function projectExactActuaPlayerSample({
  model,
  poseIndex,
  yawDegrees,
  camera = ACTUA_EXACT_PLAYER_CAMERA,
  shirtNumber = 1,
} = {}) {
  assertExactModel(model);
  if (!Number.isSafeInteger(poseIndex) || poseIndex < 0 || poseIndex >= model.animation.poseCount) {
    throw new RangeError("Exact Actua poseIndex is outside the prepared MC_STAND range.");
  }
  if (!Number.isFinite(yawDegrees)) throw new TypeError("Exact Actua yawDegrees must be finite.");
  if (!Number.isSafeInteger(shirtNumber) || shirtNumber < 1 || shirtNumber > 15) {
    throw new RangeError("Exact Actua shirtNumber must be 1..15.");
  }
  const pose = model.animation.poses[poseIndex];
  const projectedGeometry = projectExactActuaPlayerCoordinates({
    topology: model.topology,
    coordinates: pose.coordinates,
    preparedPoseIndex: poseIndex,
    yawDegrees,
    sourcePoseBitsSha256: pose.sourceBytesSha256,
    camera,
  });
  const faces = projectedGeometry.faces.map((geometryFace) => {
    const face = model.topology.faces[geometryFace.faceIndex];
    const runtimeColorCode = face.faceIndex === 12
      ? -533 - 2016 - (model.id === "player_f2" ? 15 : 0) - (shirtNumber - 1)
      : face.sourceColorCode;
    const selectedColorCode = geometryFace.visible
      ? runtimeColorCode + geometryFace.materialSelectorOffset
      : null;
    return {
      schema: CSSOCCER_ACTUA_NATIVE_PROJECTION_SCHEMA,
      poseIndex,
      yawDegrees,
      faceIndex: face.faceIndex,
      sourceFaceId: face.id,
      primitiveCode: face.primitiveCode,
      dispatch: face.dispatch,
      sourceColorCode: face.sourceColorCode,
      runtimeColorCode,
      primitivePayload: face.payload,
      sourcePoseBitsSha256: pose.sourceBytesSha256,
      visible: geometryFace.visible,
      cull: geometryFace.cull,
      projectedCorners: geometryFace.projectedCorners,
      projectedCornerType: "signed-int32",
      nativeSelectedColorCode: selectedColorCode,
      requestedNativeTextureSlot: nativeTextureSlot(runtimeColorCode),
      nativeTextureSlot: geometryFace.visible ? nativeTextureSlot(selectedColorCode) : null,
      depth: geometryFace.depth,
      depthBits: geometryFace.depthBits,
      drawOrder: geometryFace.drawOrder,
    };
  });
  return Object.freeze({
    schema: "cssoccer-actua-native-player-sample@1",
    poseIndex,
    yawDegrees,
    sourcePoseBitsSha256: pose.sourceBytesSha256,
    camera: projectedGeometry.camera,
    faces: Object.freeze(faces.map(deepFreeze)),
  });
}

function nativeViewContract(camera, yawDegrees) {
  validateCamera(camera);
  const angle = f32(yawDegrees * Math.PI / 180);
  let viewX = f32(camera.distance * Math.cos(angle));
  const viewY = f32(camera.eyeY);
  let viewZ = f32(camera.distance * Math.sin(angle));
  let targetX = f32(camera.target[0]);
  let targetY = f32(camera.target[1]);
  let targetZ = f32(camera.target[2]);
  viewZ = f32(-viewZ);
  targetZ = f32(-targetZ);
  targetX = f32(targetX - viewX);
  targetY = f32(targetY - viewY);
  targetZ = f32(targetZ - viewZ);
  let horizontalRange = targetX * targetX + targetZ * targetZ;
  if (horizontalRange < 1) {
    horizontalRange = 1;
    targetZ = 1;
  }
  const range = Math.sqrt(horizontalRange + targetY * targetY);
  horizontalRange = Math.sqrt(horizontalRange);
  const cth = f32(targetZ / horizontalRange);
  const sth = f32(targetX / horizontalRange);
  const cph = f32(horizontalRange / range);
  const sph = f32(targetY / range);
  const tmp = [
    [cth, 0, f32(-sth)],
    [f32(-sth * sph), cph, f32(-cth * sph)],
    [f32(sth * cph), sph, f32(cth * cph)],
  ];
  const translation = [f32(-viewX), f32(-viewY), f32(-viewZ)];
  const matrix = tmp.map((row) => Object.freeze([
    row[0],
    row[1],
    row[2],
    f32(row[0] * translation[0] + row[1] * translation[1] + row[2] * translation[2]),
  ]));
  const q = Math.trunc(camera.width * ((camera.scaleX + camera.scaleY) / 2));
  const qa = f32(q * 2 / 100);
  return Object.freeze({
    matrix: Object.freeze(matrix),
    q,
    qa,
    centerX: camera.width >> 1,
    centerY: camera.height >> 1,
    screenDistance: camera.screenDistance,
    publicContract: Object.freeze({ ...camera, yawDegrees, angleFloat32: float32Hex(angle), q, qa }),
  });
}

function rotateAndProjectPoint(point, view) {
  const [x, y, z] = point;
  const matrix = view.matrix;
  const rx = f32(x * matrix[0][0] + z * matrix[0][2] + matrix[0][3]);
  const ry = f32(x * matrix[1][0] + y * matrix[1][1] + z * matrix[1][2] + matrix[1][3]);
  const rz = f32(x * matrix[2][0] + y * matrix[2][1] + z * matrix[2][2] + matrix[2][3]);
  let qrz;
  if (rz < view.screenDistance) {
    qrz = f32(1.5 - rz / view.screenDistance);
    qrz = f32(qrz * qrz);
    qrz = f32((view.q / view.screenDistance) * (qrz + 0.75));
  } else {
    qrz = f32(view.q / rz);
  }
  return Object.freeze([
    rz,
    f32(rx * qrz + view.centerX),
    f32(ry * qrz + view.centerY),
  ]);
}

function projectAddpoly(face, points, selectedColorCode, cutoffDistance) {
  const source = face.pointIndexes.map((pointIndex) => points[pointIndex]);
  if (Math.min(...source.map(([depth]) => depth)) < cutoffDistance) return culled();
  let dx1 = source[0][1];
  let dx2 = source[0][1];
  let dy1 = source[0][2];
  let dy2 = source[0][2];
  dx1 = f32(dx1 - source[1][1]);
  dy1 = f32(dy1 - source[1][2]);
  dx2 = f32(dx2 - source[2][1]);
  dy2 = f32(dy2 - source[2][2]);
  if (!(dx1 * dy2 < dx2 * dy1)) return culled();
  let depth = source[0][0];
  for (let index = 1; index < source.length; index += 1) depth = f32(depth + source[index][0]);
  depth = f32(depth / source.length);
  return visible(
    source.map((point) => Object.freeze([Math.trunc(point[1]), Math.trunc(point[2])])),
    selectedColorCode,
    depth,
  );
}

function projectAdd3dcmap(face, points, selectedColorCode, qa, cutoffDistance) {
  const point1 = points[face.pointIndexes[0]];
  const point2 = points[face.pointIndexes[1]];
  if (Math.min(point1[0], point2[0]) < cutoffDistance) return culled();
  let dx1 = f32(point1[1] - point2[1]);
  let dy1 = f32(point1[2] - point2[2]);
  let dx2 = f32(dx1 * dx1 + dy1 * dy1);
  if (dx2 === 0) {
    dx1 = 1;
    dx2 = 1;
  }
  let tz2 = f32(face.payload[2] * qa / (Math.sqrt(dx2) * f32(point1[0] + point2[0])));
  let tz1 = f32(100 * f32(point2[0] - point1[0]) / face.payload[3]);
  let color = selectedColorCode;
  let corners;
  if (tz1 >= 0) {
    if (tz1 > 0.78062475) color -= tz1 > 0.92702481 ? 3 : 2;
    else if (tz1 > 0.48412292) color -= 1;
    tz1 = f32(tz1 * tz2);
    const dy2 = f32(tz2 * dy1);
    dx2 = f32(tz2 * dx1);
    dy1 = f32(dy1 * tz1);
    dx1 = f32(dx1 * tz1);
    corners = [
      [point1[1] + dx1 - dy2, point1[2] + dy1 + dx2],
      [point1[1] + dx1 + dy2, point1[2] + dy1 - dx2],
      [point2[1] - dx1 + dy2, point2[2] - dy1 - dx2],
      [point2[1] - dx1 - dy2, point2[2] - dy1 + dx2],
    ];
  } else {
    if (tz1 < -0.78062475) color += tz1 < -0.92702481 ? 3 : 2;
    else if (tz1 < -0.48412292) color += 1;
    tz1 = f32(tz1 * tz2);
    const dy2 = f32(tz2 * dy1);
    dx2 = f32(tz2 * dx1);
    dy1 = f32(dy1 * tz1);
    dx1 = f32(dx1 * tz1);
    corners = [
      [point1[1] - dx1 - dy2, point1[2] - dy1 + dx2],
      [point1[1] - dx1 + dy2, point1[2] - dy1 - dx2],
      [point2[1] + dx1 + dy2, point2[2] + dy1 - dx2],
      [point2[1] + dx1 - dy2, point2[2] + dy1 + dx2],
    ];
  }
  return visible(integerCorners(corners), color, f32((point1[0] + point2[0]) / 2));
}

function projectAdd3demap(face, points, selectedColorCode, qa, q, cutoffDistance) {
  const point1 = points[face.pointIndexes[0]];
  const point2 = points[face.pointIndexes[1]];
  const point3 = points[face.pointIndexes[2]];
  if (Math.min(point1[0], point2[0]) < cutoffDistance) return culled();
  let dx1 = f32(point1[1] - point2[1]);
  let dy1 = f32(point1[2] - point2[2]);
  const rx = f32(f32(point3[1] - point2[1]) * point3[0] / q);
  const ry = f32(f32(point3[2] - point2[2]) * point3[0] / q);
  let dx2 = f32(dx1 * dx1 + dy1 * dy1);
  if (dx2 === 0) {
    dx1 = 1;
    dx2 = 1;
  }
  let dy2 = f32(Math.sqrt(dx2));
  let tz2 = f32(qa / (dy2 * f32(point1[0] + point2[0])));
  let tz1 = f32(f32(rx * dy1 - ry * dx1) / dy2);
  if (tz1 < -1) tz1 = -1;
  if (tz1 > 1) tz1 = 1;
  let color = selectedColorCode - ellipseAngularColorOffset(tz1, point3[0] > point2[0]);
  const majorRadius = face.payload[3];
  const minorRadius = face.payload[4];
  tz1 = f32(tz1 * tz1);
  tz1 = f32(tz1 * f32((majorRadius - minorRadius) * (majorRadius + minorRadius)));
  dx2 = f32(tz2 * Math.sqrt(tz1 + minorRadius * minorRadius));
  dy2 = f32(100 * f32(point1[0] - point2[0]) / face.payload[5]);
  let corners;
  if (dy2 >= 0) {
    if (dy2 > 0.555570233) color -= dy2 > 0.836286155 ? 36 : 24;
    else if (dy2 > 0.195090322) color -= 12;
    dy2 = f32(dy2 * tz2 * Math.sqrt(majorRadius * majorRadius - tz1));
    tz1 = f32(dy2 * dx1);
    tz2 = f32(dy2 * dy1);
    dx1 = f32(dx1 * dx2);
    dy1 = f32(dy1 * dx2);
    corners = [
      [point2[1] + dy1 - tz1, point2[2] - dx1 - tz2],
      [point2[1] - dy1 - tz1, point2[2] + dx1 - tz2],
      [point1[1] - dy1 + tz1, point1[2] + dx1 + tz2],
      [point1[1] + dy1 + tz1, point1[2] - dx1 + tz2],
    ];
  } else {
    if (dy2 < -0.258819045) color += 12;
    dy2 = f32(dy2 * tz2 * Math.sqrt(majorRadius * majorRadius - tz1));
    tz1 = f32(dy2 * dx1);
    tz2 = f32(dy2 * dy1);
    dx1 = f32(dx1 * dx2);
    dy1 = f32(dy1 * dx2);
    corners = [
      [point2[1] + dy1 + tz1, point2[2] - dx1 + tz2],
      [point2[1] - dy1 + tz1, point2[2] + dx1 + tz2],
      [point1[1] - dy1 - tz1, point1[2] + dx1 - tz2],
      [point1[1] + dy1 - tz1, point1[2] - dx1 - tz2],
    ];
  }
  return visible(integerCorners(corners), color, f32((point1[0] + point2[0]) / 2));
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

function visible(projectedCorners, selectedColorCode, depth) {
  return {
    visible: true,
    projectedCorners: Object.freeze(projectedCorners.map((corner) => Object.freeze(corner))),
    selectedColorCode,
    depth,
  };
}

function culled() {
  return { visible: false, projectedCorners: Object.freeze([]), selectedColorCode: null, depth: null };
}

function integerCorners(corners) {
  return corners.map(([x, y]) => [Math.trunc(x), Math.trunc(y)]);
}

function nativeTextureSlot(colorCode) {
  return colorCode < -2000 ? -colorCode - 2000 : -colorCode;
}

function float32Hex(value) {
  const bytes = Buffer.allocUnsafe(4);
  bytes.writeFloatLE(value, 0);
  return `0x${bytes.readUInt32LE(0).toString(16).padStart(8, "0")}`;
}

function validateCamera(camera) {
  if (
    !camera
    || !Number.isSafeInteger(camera.width)
    || !Number.isSafeInteger(camera.height)
    || !Array.isArray(camera.target)
    || camera.target.length !== 3
    || ![...camera.target, camera.eyeY, camera.distance, camera.scaleX, camera.scaleY,
      camera.cutoffDistance, camera.screenDistance].every(Number.isFinite)
  ) throw new TypeError("Exact Actua camera contract is invalid.");
}

function assertExactModel(model) {
  if (
    model?.schema !== CSSOCCER_EXACT_ACTUA_PLAYER_MODEL_SCHEMA
    || !new Set(["player_f1", "player_f2"]).has(model?.id)
    || model?.topology?.faceCount !== 13
    || model?.animation?.poseCount !== 39
  ) throw new TypeError("Exact Actua native projection requires a prepared player_f1/player_f2 contract.");
}

function assertExactTopologyAndCoordinates(topology, coordinates) {
  const faceCount = topology?.faceCount;
  if (
    topology?.pointCount !== 28
    || (faceCount !== 12 && faceCount !== 13)
    || !Array.isArray(topology.faces)
    || topology.faces.length !== faceCount
    || topology.faces.some((face, faceIndex) => (
      face?.faceIndex !== faceIndex
      || !new Set(["addpoly", "add3dcmap", "add3demap"]).has(face.dispatch)
      || !Array.isArray(face.pointIndexes)
      || !Array.isArray(face.payload)
    ))
    || !Array.isArray(coordinates)
    || coordinates.length !== 84
    || coordinates.some((value) => !Number.isFinite(value))
  ) throw new TypeError("Exact Actua coordinate projection requires a checked 28-point actor basis.");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

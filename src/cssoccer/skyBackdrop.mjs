const SKY_WIDTH = 640;
const SKY_HEIGHT = 480;
const SKY_PANORAMA_ARC = 2 * 3.1415 / 3;
const SKY_STADIUM_PADDING = 200;
const DEFAULT_STADIUM_DIMENSIONS = Object.freeze({
  st_w: 190,
  st_l: 190,
  st_h: 290,
});

/** Source-labelled screen-space projection from 3DENG.C ground(). */
export function projectCssoccerSkyBackdrop(camera, {
  viewportWidth = 640,
  viewportHeight = 400,
  stadiumDimensions = DEFAULT_STADIUM_DIMENSIONS,
} = {}) {
  const renderer = camera?.rendered?.renderer;
  const eye = requireVec3(renderer?.eye, "sky camera eye");
  const target = requireVec3(renderer?.target, "sky camera target");
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0
      || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    throw new TypeError("Sky viewport must have positive finite dimensions.");
  }
  const projectionScale = camera?.projection?.scale;
  if (!Number.isFinite(projectionScale) || projectionScale <= 0) {
    throw new TypeError("Sky camera must expose its source projection scale.");
  }
  const dimensions = requireStadiumDimensions(stadiumDimensions);
  const deltaX = target[0] - eye[0];
  const deltaY = target[1] - eye[1];
  const deltaZ = target[2] - eye[2];
  const horizontal = Math.hypot(deltaX, deltaZ);
  if (!(horizontal > 0)) {
    throw new Error("Sky camera eye and target do not define a horizontal view angle.");
  }
  const cosineTheta = clampUnit(deltaZ / horizontal);
  const sineTheta = deltaX / horizontal;
  const pan = Math.trunc(SKY_WIDTH * Math.acos(cosineTheta) / SKY_PANORAMA_ARC)
    % SKY_WIDTH;
  const sourceX = sineTheta < 0 ? (SKY_WIDTH - pan) % SKY_WIDTH : pan;
  const skyClip = projectNativeSkyClip({
    eye,
    target,
    projectionScale,
    viewportHeight,
    stadiumDimensions: dimensions,
  });
  // ground() walks the source bitmap and destination scanlines upward. Bind
  // the source row at screen y=0 after reproducing its stadium-height clip.
  const sourceY = skyClip.visibleHeight === 0
    ? Math.round(
      SKY_HEIGHT - viewportHeight / 2 - projectionScale * deltaY / horizontal,
    )
    : skyClip.sourceStartRow - (skyClip.visibleHeight - 1);
  return Object.freeze({
    schema: "cssoccer-native-sky-screen-projection@1",
    sourceX,
    sourceY,
    backgroundPositionX: sourceX === 0 ? 0 : -sourceX,
    backgroundPositionY: -sourceY,
    viewportWidth,
    viewportHeight,
    visibleHeight: skyClip.visibleHeight,
    sourceVisible:
      skyClip.visibleHeight > 0
      && sourceY < SKY_HEIGHT
      && sourceY + skyClip.visibleHeight > 0,
  });
}

export function createCssoccerSkyBackdropHandle({ host, backdrop, camera }) {
  if (!host || typeof host.prepend !== "function") {
    throw new TypeError("Prepared sky backdrop requires a scene host.");
  }
  assertPreparedBackdrop(backdrop);
  const element = host.ownerDocument.createElement("div");
  element.id = "cssoccer-root-sky-backdrop";
  element.className = "cssoccer-sky-backdrop";
  element.setAttribute("aria-hidden", "true");
  element.dataset.cssoccerRootId = backdrop.id;
  element.dataset.cssoccerKind = backdrop.kind;
  element.dataset.cssoccerStableRoot = "true";
  element.dataset.cssoccerSourceId = backdrop.sourceId;
  element.dataset.cssoccerAssetSha256 = backdrop.asset.sha256;
  element.style.backgroundImage = `url("${backdrop.asset.url}")`;
  element.style.bottom = "auto";
  host.prepend(element);
  let projection = null;
  let backgroundPositionXWrites = 0;
  let backgroundPositionYWrites = 0;
  let visibleHeightWrites = 0;
  let removed = false;

  const apply = (nextCamera) => {
    if (removed) throw new Error("Prepared sky backdrop has been removed.");
    const next = projectCssoccerSkyBackdrop(nextCamera, {
      viewportWidth: host.clientWidth || 640,
      viewportHeight: host.clientHeight || 400,
      stadiumDimensions: backdrop.stadiumDimensions,
    });
    if (projection?.backgroundPositionX !== next.backgroundPositionX) {
      element.style.backgroundPositionX = `${next.backgroundPositionX}px`;
      backgroundPositionXWrites += 1;
    }
    if (projection?.backgroundPositionY !== next.backgroundPositionY) {
      element.style.backgroundPositionY = `${next.backgroundPositionY}px`;
      backgroundPositionYWrites += 1;
    }
    if (projection?.visibleHeight !== next.visibleHeight) {
      element.style.height = `${next.visibleHeight}px`;
      visibleHeightWrites += 1;
    }
    projection = next;
    element.dataset.cssoccerSkySourceX = String(next.sourceX);
    element.dataset.cssoccerSkySourceY = String(next.sourceY);
    element.dataset.cssoccerSkyVisibleHeight = String(next.visibleHeight);
    return next;
  };
  apply(camera);

  return Object.freeze({
    element,
    apply,
    projection: () => projection,
    stats: () => Object.freeze({
      rootCount: 1,
      connectedRootCount: Number(element.isConnected),
      backgroundPositionXWrites,
      backgroundPositionYWrites,
      visibleHeightWrites,
      sourceParseCount: 0,
      geometryBuildCount: 0,
      topologyBuildCount: 0,
      materialBuildCount: 0,
      assetBuildCount: 0,
    }),
    remove() {
      if (removed) return;
      removed = true;
      element.remove();
    },
  });
}

function assertPreparedBackdrop(backdrop) {
  if (
    backdrop?.schema !== "cssoccer-prepared-sky-backdrop@1"
    || backdrop.id !== "sky-backdrop"
    || backdrop.kind !== "sky"
    || backdrop.sourceId !== "BM_C1X/COL_C1X"
    || backdrop.stableDom !== true
    || backdrop.runtimeConstruction !== false
    || backdrop.asset?.url !== "/cssoccer/assets/textures/spain-argentina-sky.png"
    || backdrop.asset?.width !== SKY_WIDTH
    || backdrop.asset?.height !== SKY_HEIGHT
    || !isStadiumDimensions(backdrop.stadiumDimensions)
  ) {
    throw new Error("Prepared sky backdrop changed its source-bound contract.");
  }
}

function projectNativeSkyClip({
  eye,
  target,
  projectionScale,
  viewportHeight,
  stadiumDimensions,
}) {
  const delta = target.map((value, index) => value - eye[index]);
  const horizontal = Math.hypot(delta[0], delta[2]);
  const radius = Math.hypot(horizontal, delta[1]);
  const cosineTheta = delta[2] / horizontal;
  const sineTheta = delta[0] / horizontal;
  const cosinePhi = horizontal / radius;
  const sinePhi = delta[1] / radius;
  const verticalRow = [
    -sineTheta * sinePhi,
    cosinePhi,
    -cosineTheta * sinePhi,
  ];
  const depthRow = [
    sineTheta * cosinePhi,
    sinePhi,
    cosineTheta * cosinePhi,
  ];
  const { st_l: stadiumLength, st_w: stadiumWidth, st_h: stadiumHeight } =
    stadiumDimensions;
  const nearX = -stadiumLength - SKY_STADIUM_PADDING;
  const farX = 1280 + stadiumLength + SKY_STADIUM_PADDING;
  const nearZ = stadiumWidth + SKY_STADIUM_PADDING;
  const farZ = -800 - stadiumWidth - SKY_STADIUM_PADDING;
  const corners = [
    [nearX, stadiumHeight, nearZ],
    [farX, stadiumHeight, nearZ],
    [farX, stadiumHeight, farZ],
    [nearX, stadiumHeight, farZ],
  ];
  const centerY = viewportHeight / 2;
  let lowestSkyOffset = centerY;
  let farthestDepth = 0;
  corners.forEach((point, index) => {
    const relative = point.map((value, axis) => value - eye[axis]);
    const vertical = dot(verticalRow, relative);
    const depth = dot(depthRow, relative);
    if ((index === 0 && depth > 0) || (index > 0 && depth > farthestDepth)) {
      lowestSkyOffset = Math.trunc(projectionScale * vertical / depth);
      farthestDepth = depth;
    }
  });
  if (lowestSkyOffset < -centerY) lowestSkyOffset = -centerY;
  const visibleHeight = Math.max(
    0,
    Math.min(viewportHeight, centerY - lowestSkyOffset),
  );
  let sourceDepthOffset = Math.trunc(
    lowestSkyOffset + projectionScale * delta[1] / horizontal,
  );
  if (sourceDepthOffset < 0) sourceDepthOffset = 0;
  if (
    SKY_HEIGHT - 1 - sourceDepthOffset
    < SKY_HEIGHT / 2 - lowestSkyOffset
  ) {
    sourceDepthOffset = SKY_HEIGHT / 2 + lowestSkyOffset;
  }
  return Object.freeze({
    visibleHeight,
    sourceStartRow: sineTheta < 0
      ? SKY_HEIGHT - sourceDepthOffset
      : SKY_HEIGHT - 1 - sourceDepthOffset,
  });
}

function requireVec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${label} must be a finite vec3.`);
  }
  return value;
}

function requireStadiumDimensions(value) {
  if (!isStadiumDimensions(value)) {
    throw new TypeError("Sky stadium dimensions must expose positive st_w, st_l, and st_h.");
  }
  return value;
}

function isStadiumDimensions(value) {
  return (
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && ["st_w", "st_l", "st_h"].every((key) => (
      Number.isFinite(value[key]) && value[key] > 0
    ))
  );
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

const SKY_WIDTH = 640;
const SKY_HEIGHT = 480;
const SKY_PANORAMA_ARC = 2 * 3.1415 / 3;

/** Source-labelled screen-space projection from 3DENG.C ground(). */
export function projectCssoccerSkyBackdrop(camera, {
  viewportWidth = 640,
  viewportHeight = 400,
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
  // The retained native 320x200 Stand2 frame binds this rounded M8 source
  // projection to BM_C1X row 390. It is the exact browser/native crop seam.
  const sourceY = Math.round(
    SKY_HEIGHT - viewportHeight / 2 - projectionScale * deltaY / horizontal,
  );
  return Object.freeze({
    schema: "cssoccer-native-sky-screen-projection@1",
    sourceX,
    sourceY,
    backgroundPositionX: sourceX === 0 ? 0 : -sourceX,
    backgroundPositionY: -sourceY,
    viewportWidth,
    viewportHeight,
    sourceVisible: sourceY < SKY_HEIGHT && sourceY + viewportHeight > 0,
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
  host.prepend(element);
  let projection = null;
  let backgroundPositionXWrites = 0;
  let backgroundPositionYWrites = 0;
  let removed = false;

  const apply = (nextCamera) => {
    if (removed) throw new Error("Prepared sky backdrop has been removed.");
    const next = projectCssoccerSkyBackdrop(nextCamera, {
      viewportWidth: host.clientWidth || 640,
      viewportHeight: host.clientHeight || 400,
    });
    if (projection?.backgroundPositionX !== next.backgroundPositionX) {
      element.style.backgroundPositionX = `${next.backgroundPositionX}px`;
      backgroundPositionXWrites += 1;
    }
    if (projection?.backgroundPositionY !== next.backgroundPositionY) {
      element.style.backgroundPositionY = `${next.backgroundPositionY}px`;
      backgroundPositionYWrites += 1;
    }
    projection = next;
    element.dataset.cssoccerSkySourceX = String(next.sourceX);
    element.dataset.cssoccerSkySourceY = String(next.sourceY);
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
  ) {
    throw new Error("Prepared sky backdrop changed its source-bound contract.");
  }
}

function requireVec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${label} must be a finite vec3.`);
  }
  return value;
}

function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

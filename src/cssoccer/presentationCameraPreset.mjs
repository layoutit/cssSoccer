import {
  createCssoccerActuaGameplayCamera,
  projectCssoccerActuaRendererPoint,
} from "./actuaGameplayCamera.mjs";

const SOURCE_KICKOFF_CAMERA = createCssoccerActuaGameplayCamera();

export const CSSOCCER_PRESENTATION_CAMERA_PRESET = deepFreeze({
  id: "native-mode-0-kickoff-preset-v3",
  status: "presentation-preset",
  nativeParity: "source-derived-native-tick-171-with-renderer-z-reflection-and-640x400-landmark-calibration",
  position: [640, 120, -610],
  sourceTarget: [640, 1, -424],
  target: [640, 1, -374.93],
  presentationAxis: {
    source: "Actua renderer z",
    mapping: "presentationZ = -800 - sourceZ",
    reflectionCentre: -400,
  },
  viewportWidth: 640,
  viewportHeight: 400,
  nativeProjectionScale: 512,
  perspective: 10886.64,
  rotX: -32.94,
  rotY: 270,
  zoom: 1.9866,
  distance: 0,
  polycssTileSize: 50,
});

/** Project one Actua renderer point through the source kickoff camera matrix. */
export function projectCssoccerKickoffPoint(point) {
  requireVector(point, "kickoff projection point");
  return projectCssoccerActuaRendererPoint(point, SOURCE_KICKOFF_CAMERA, {
    viewportWidth: CSSOCCER_PRESENTATION_CAMERA_PRESET.viewportWidth,
    viewportHeight: CSSOCCER_PRESENTATION_CAMERA_PRESET.viewportHeight,
  });
}

function requireVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${label} must be a finite vec3.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

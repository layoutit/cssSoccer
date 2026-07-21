import {
  CSSOCCER_FIXTURE_ID,
  CSSOCCER_MANIFEST_URL,
} from "./fixtureContract.mjs";

const ALTERNATE_PRODUCT_PARAMS = Object.freeze([
  "country",
  "duration",
  "fixture",
  "match",
  "scene",
  "team",
]);

export function createCssoccerRouteState(search = globalThis.location?.search ?? "") {
  const params = new URLSearchParams(search);
  const alternateParams = ALTERNATE_PRODUCT_PARAMS.filter((name) => params.has(name));
  if (alternateParams.length > 0) {
    throw new Error(
      "css.soccer has one canonical match route; remove alternate product parameters: "
        + alternateParams.join(", "),
    );
  }

  return Object.freeze({
    fixtureId: CSSOCCER_FIXTURE_ID,
    manifestUrl: CSSOCCER_MANIFEST_URL,
    path: "/",
    publicRoute: "/",
    usesManifestDefault: true,
  });
}

export function defaultSceneEntryForRoute(manifest, routeState) {
  const defaultSceneId = manifest?.defaultScene?.id;
  if (defaultSceneId !== routeState.fixtureId) return null;
  const scenes = Array.isArray(manifest?.scenes) ? manifest.scenes : [];
  return scenes.find((scene) => scene?.id === defaultSceneId) ?? null;
}

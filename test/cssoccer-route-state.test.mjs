import assert from "node:assert/strict";
import test from "node:test";

import {
  createCssoccerRouteState,
  defaultSceneEntryForRoute,
} from "../src/cssoccer/routeState.mjs";

test("the public route resolves only the canonical manifest-default fixture", () => {
  const route = createCssoccerRouteState();
  const entry = {
    id: "spain-argentina-full-match",
    sceneUrl: "/cssoccer/scenes/spain-argentina-full-match.json",
  };
  assert.equal(defaultSceneEntryForRoute({
    defaultScene: { id: "spain-argentina-full-match" },
    scenes: [entry],
  }, route), entry);
  assert.equal(defaultSceneEntryForRoute({
    defaultScene: { id: "another-match" },
    scenes: [entry],
  }, route), null);
  assert.throws(() => createCssoccerRouteState("?country=spain"), /one canonical match route/u);
});

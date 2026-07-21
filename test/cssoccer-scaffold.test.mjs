import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_CONTROL_COUNTRY_IDS,
  CSSOCCER_FIXTURE_ID,
  normalizeControlCountry,
  requireControlCountry,
} from "../src/cssoccer/fixtureContract.mjs";
import {
  loadPreparedManifest,
  missingPreparedManifestMessage,
} from "../src/cssoccer/manifestClient.mjs";
import { createCssoccerRouteState } from "../src/cssoccer/routeState.mjs";
import { inspectCssoccerScaffold } from "../tools/scaffold-cssoccer.mjs";

test("the scaffold exposes only Spain and Argentina for the fixed fixture", () => {
  assert.equal(CSSOCCER_FIXTURE_ID, "spain-argentina-full-match");
  assert.deepEqual(CSSOCCER_CONTROL_COUNTRY_IDS, ["spain", "argentina"]);
  assert.equal(normalizeControlCountry(" Spain "), "spain");
  assert.equal(normalizeControlCountry("ARGENTINA"), "argentina");
  assert.equal(normalizeControlCountry("france"), null);
  assert.throws(() => requireControlCountry("france"), /exactly spain or argentina/u);
});

test("the route is manifest-default and rejects alternate product routes", () => {
  assert.deepEqual(createCssoccerRouteState("?utm_source=launch"), {
    fixtureId: "spain-argentina-full-match",
    manifestUrl: "/cssoccer/manifest.json",
    path: "/",
    publicRoute: "/",
    usesManifestDefault: true,
  });
  for (const search of ["?team=spain", "?duration=90", "?scene=other", "?fixture=other"]) {
    assert.throws(() => createCssoccerRouteState(search), /one canonical match route/u);
  }
});

test("a missing manifest names the canonical prepare command", async () => {
  const route = createCssoccerRouteState();
  await assert.rejects(
    loadPreparedManifest(route, async () => response(404, {})),
    new RegExp(escapeRegExp(missingPreparedManifestMessage("/cssoccer/manifest.json")), "u"),
  );
});

test("only the canonical prepared manifest can load", async () => {
  const route = createCssoccerRouteState();
  const manifest = JSON.parse(readFileSync(new URL(
    "../build/generated/public/cssoccer/manifest.json",
    import.meta.url,
  ), "utf8"));
  const loadedManifest = await loadPreparedManifest(route, async () => response(200, manifest));
  assert.deepEqual(loadedManifest, manifest);

  await assert.rejects(
    loadPreparedManifest(route, async () => response(200, {
      ...manifest,
      defaultScene: { id: "other-match" },
    })),
    /canonical scene|default scene/u,
  );
});

test("the checked scaffold has one route and no native or prepare runtime imports", async () => {
  const report = await inspectCssoccerScaffold(new URL("..", import.meta.url).pathname);
  assert.equal(report.status, "ready");
  assert.equal(report.defaultRoute, "/");
  assert.equal(report.defaultControlCountry, null);
  assert.equal(report.controlSelection, "pre-match");
  assert.deepEqual(report.controlCountries, ["spain", "argentina"]);
  assert.deepEqual(report.parentIntegration, []);
  assert.match(report.downstreamPreparedData, /B6-B8/u);
});

function response(status, body) {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type" ? "application/json" : null;
      },
    },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

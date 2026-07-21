#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REQUIRED_FILES = Object.freeze([
  "package.json",
  ".env.example",
  "vite.config.mjs",
  "index.html",
  "src/cssoccer/main.mjs",
  "src/cssoccer/fixtureContract.mjs",
  "src/cssoccer/routeState.mjs",
  "src/cssoccer/manifestClient.mjs",
  "src/cssoccer/client.mjs",
  "src/cssoccer/polycssScene.mjs",
  "src/cssoccer/debugApi.mjs",
  "src/cssoccer/devtoolsAttrs.mjs",
  "src/cssoccer/styles.css",
  "src/prepare/cssoccer/manifestContract.mjs",
]);

const FORBIDDEN_RUNTIME_REFERENCES = Object.freeze([
  ".local/",
  "/capture/",
  "/oracle/",
  "/prepare/",
  "/source/",
  "actua-soccer-oracle",
]);

const FORBIDDEN_CSS = Object.freeze([
  ["backdrop", "filter"].join("-"),
  ["background", "blend", "mode"].join("-"),
  ["box", "shadow"].join("-"),
  ["clip", "path"].join("-"),
  "conic" + "-gradient(",
  "filter" + ":",
  "linear" + "-gradient(",
  "mask" + ":",
  ["mix", "blend", "mode"].join("-"),
  "radial" + "-gradient(",
  ["text", "shadow"].join("-"),
]);

export async function inspectCssoccerScaffold(repoRoot = process.cwd()) {
  const root = resolve(repoRoot);
  const files = new Map();
  for (const relativePath of REQUIRED_FILES) {
    const absolutePath = join(root, relativePath);
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) throw new Error("Scaffold path is not a file: " + relativePath);
    files.set(relativePath, await readFile(absolutePath, "utf8"));
  }

  const viteConfig = files.get("vite.config.mjs");
  if (!viteConfig.includes('"build/generated/public"')) {
    throw new Error("Vite must serve build/generated/public as its generated public root.");
  }

  const packageManifest = JSON.parse(files.get("package.json"));
  if (
    packageManifest.scripts?.build !== "vite build"
    || packageManifest.scripts?.test !== "node tools/run-test-suite.mjs unit"
    || packageManifest.scripts?.["test:assets"] !== "node tools/run-test-suite.mjs assets"
    || packageManifest.dependencies?.["@layoutit/polycss"] !== "^0.2.8"
    || packageManifest.devDependencies?.vite !== "^7.3.1"
  ) {
    throw new Error("Package scripts and PolyCSS/Vite dependencies are not wired for the scaffold.");
  }
  if (files.get(".env.example").trim() !== "CSSOCCER_VITE_PUBLIC_DIR=build/generated/public") {
    throw new Error("The generated-public environment seam changed unexpectedly.");
  }

  const html = files.get("index.html");
  for (const id of ["app", "scene", "country-choice", "match-hud", "status"]) {
    if (!html.includes('id="' + id + '"')) throw new Error("Default route is missing #" + id + ".");
  }
  const countryChoices = Array.from(
    html.matchAll(/data-country-choice="([^"]+)"/gu),
    (match) => match[1],
  );
  if (JSON.stringify(countryChoices) !== JSON.stringify(["spain", "argentina"])) {
    throw new Error("The product route must expose exactly Spain and Argentina before kickoff.");
  }
  const controls = Array.from(
    html.matchAll(/data-cssoccer-control="([^"]+)"/gu),
    (match) => match[1],
  );
  if (JSON.stringify(controls) !== JSON.stringify([
    "move-up",
    "move-left",
    "move-down",
    "move-right",
    "fire-1",
    "fire-2",
  ])) {
    throw new Error("The product route must expose exactly six semantic match controls.");
  }
  if (/(?:data-|id=|name=)["']?duration/iu.test(html)) {
    throw new Error("The fixed two-minute match must not expose a duration control.");
  }
  if (!html.includes('src="/src/cssoccer/main.mjs"')) {
    throw new Error("Default route must load the cssoccer runtime entry.");
  }

  for (const [relativePath, source] of files) {
    if (!relativePath.startsWith("src/cssoccer/") || !relativePath.endsWith(".mjs")) continue;
    const normalized = source.toLowerCase();
    for (const forbidden of FORBIDDEN_RUNTIME_REFERENCES) {
      if (normalized.includes(forbidden)) {
        throw new Error(relativePath + " references forbidden runtime material: " + forbidden);
      }
    }
  }

  const css = files.get("src/cssoccer/styles.css").toLowerCase();
  for (const forbidden of FORBIDDEN_CSS) {
    if (css.includes(forbidden)) throw new Error("Runtime CSS uses forbidden fast-path feature: " + forbidden);
  }

  const fixtureSource = files.get("src/cssoccer/fixtureContract.mjs");
  if (!fixtureSource.includes('"spain-argentina-full-match"')) {
    throw new Error("Scaffold fixture id does not match the source/data contract lane.");
  }
  const manifestSource = files.get("src/cssoccer/manifestClient.mjs");
  if (!manifestSource.includes("Run " + '" + PREPARE_COMMAND + "' + " first")) {
    throw new Error("Missing prepared output does not name the prepare command.");
  }

  return Object.freeze({
    status: "ready",
    fixtureId: "spain-argentina-full-match",
    controlCountries: Object.freeze(["spain", "argentina"]),
    defaultControlCountry: null,
    controlSelection: "pre-match",
    defaultRoute: "/",
    manifestUrl: "/cssoccer/manifest.json",
    requiredFileCount: REQUIRED_FILES.length,
    parentIntegration: Object.freeze([]),
    downstreamPreparedData: "B6-B8 publish data through the checked manifest seam.",
  });
}

async function main() {
  const report = await inspectCssoccerScaffold(process.argv[2] ?? process.cwd());
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";
if (currentFile === invokedFile || import.meta.url === pathToFileURL(invokedFile).href) {
  main().catch((error) => {
    process.stderr.write((error.stack || error.message || String(error)) + "\n");
    process.exitCode = 1;
  });
}

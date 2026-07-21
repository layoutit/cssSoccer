#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_SOURCE_ROOTS = Object.freeze([
  Object.freeze({ kind: "browser", path: "src/cssoccer/main.mjs" }),
  Object.freeze({ kind: "prepare", path: "src/prepare/cssoccer/fixtureAssembler.mjs" }),
]);
const DEFAULT_REFERENCE_PATH = "references/spain-argentina-match.json";
const DEFAULT_GENERATED_FACTS_PATH =
  "build/generated/public/cssoccer/facts/spain-argentina-full-match.json";
const DEFAULT_DIST_INDEX_PATH = "dist/index.html";
const POLICY_PATH = "src/cssoccer/freePlayContract.mjs";

const SOURCE_RULES = Object.freeze([
  rule("source-neutral-command-schema", /cssoccer-neutral-command-stream@1/gu),
  rule(
    "source-native-input-binding",
    /\b(?:commandSha256|commandStreamSha256|inputBindingSha256|nativeInputSha256)\b/gu,
  ),
  rule("source-command-fallback", /\bsourceInputAtTick\b/gu),
  rule("source-dual-drive-mode", /\bdriveMode\b/gu),
  rule("source-replay-terminal-tick", /\bTERMINAL_TICK\b/gu),
  rule(
    "source-tick-scheduled-opening",
    /\bOPENING_ANIMATION_BOOTSTRAP_LAST_TICK\b/gu,
  ),
  rule(
    "source-debug-capture-control",
    /\b(?:captureOraclePostTick|capturePostTick)\b/gu,
  ),
  rule("source-oracle-engine-control", /\boracleEngine(?:Independence)?\b/gu),
]);

const BUNDLE_RULES = Object.freeze([
  rule("bundle-neutral-command-schema", /cssoccer-neutral-command-stream@1/gu),
  rule("bundle-native-input-binding", /\bnativeInputSha256\b/gu),
  rule(
    "bundle-debug-capture-control",
    /\b(?:captureOraclePostTick|capturePostTick|oracleEngine)\b/gu,
  ),
]);

export async function scanCssoccerFreePlayBoundary({
  root = process.cwd(),
  sourceRoots = DEFAULT_SOURCE_ROOTS,
  referencePath = DEFAULT_REFERENCE_PATH,
  generatedFactsPath = DEFAULT_GENERATED_FACTS_PATH,
  distIndexPath = DEFAULT_DIST_INDEX_PATH,
} = {}) {
  const absoluteRoot = resolve(root);
  const modules = new Map();
  const importEdges = [];
  for (const sourceRoot of sourceRoots) {
    await visitSourceModule({
      absoluteRoot,
      absolutePath: resolve(absoluteRoot, sourceRoot.path),
      kind: sourceRoot.kind,
      modules,
      importEdges,
    });
  }

  const findings = [];
  for (const edge of importEdges) findings.push(...dependencyFindings(edge));
  for (const module of modules.values()) {
    if (module.relativePath === POLICY_PATH || extname(module.absolutePath) === ".css") continue;
    for (const sourceRule of SOURCE_RULES) {
      const lines = matchingLines(module.source, sourceRule.pattern);
      if (lines.length === 0) continue;
      const ruleId = sourceRule.id === "source-native-input-binding"
        && module.kinds.size === 1
        && module.kinds.has("prepare")
        ? "prepare-native-input-binding"
        : sourceRule.id;
      findings.push(createFinding({
        ruleId,
        surface: [...module.kinds].sort().join("+"),
        location: module.relativePath,
        evidence: { lines },
      }));
    }
  }

  findings.push(...await structuredJsonFindings({
    absoluteRoot,
    path: referencePath,
    surface: "reference",
    rules: [
      {
        id: "reference-prepared-command-stream",
        paths: ["$.fixture.input"],
      },
      {
        id: "reference-native-input-binding",
        paths: ["$.fixture.inputBindingSha256"],
      },
    ],
  }));
  findings.push(...await structuredJsonFindings({
    absoluteRoot,
    path: generatedFactsPath,
    surface: "generated-facts",
    rules: [
      {
        id: "generated-prepared-command-stream",
        paths: ["$.input"],
      },
      {
        id: "generated-native-input-binding",
        keyPattern: /^(?:inputBindingSha256|inputSha256|nativeInputSha256)$/u,
      },
    ],
  }));

  findings.push(...await scanConnectedBundle({ absoluteRoot, distIndexPath }));
  findings.sort(compareFindings);
  return Object.freeze({
    root: absoluteRoot,
    sourceGraphs: Object.freeze(sourceRoots.map((entry) => ({ ...entry }))),
    sourceModuleCount: modules.size,
    sourceImportEdgeCount: importEdges.length,
    findings: Object.freeze(findings),
  });
}

export function assessCssoccerFreePlayBoundary(findings, { mode = "check" } = {}) {
  if (!Array.isArray(findings)) throw new TypeError("Boundary findings must be an array.");
  if (mode !== "check") throw new Error(`Unknown boundary assessment mode ${mode}.`);
  return Object.freeze({
    status: findings.length === 0 ? "pass" : "fail",
    mode,
    unexpected: Object.freeze(findings.map(findingKey).sort()),
  });
}

export function findingKey(finding) {
  return `${finding.ruleId}|${finding.surface}|${finding.location}`;
}

async function visitSourceModule({
  absoluteRoot,
  absolutePath,
  kind,
  modules,
  importEdges,
}) {
  const realPath = normalize(absolutePath);
  const relativePath = repoRelative(absoluteRoot, realPath);
  const existing = modules.get(realPath);
  if (existing?.kinds.has(kind)) return;
  if (existing) {
    existing.kinds.add(kind);
  } else {
    const source = await readRequiredText(realPath, `production source module ${relativePath}`);
    modules.set(realPath, {
      absolutePath: realPath,
      relativePath,
      source,
      kinds: new Set([kind]),
    });
  }
  const source = modules.get(realPath).source;
  for (const specifier of parseModuleSpecifiers(source)) {
    if (!specifier.startsWith(".")) continue;
    const dependencyPath = await resolveLocalModule(dirname(realPath), specifier);
    const dependencyRelativePath = repoRelative(absoluteRoot, dependencyPath);
    importEdges.push({
      kind,
      from: relativePath,
      to: dependencyRelativePath,
      specifier,
    });
    await visitSourceModule({
      absoluteRoot,
      absolutePath: dependencyPath,
      kind,
      modules,
      importEdges,
    });
  }
}

function dependencyFindings(edge) {
  const ids = [];
  if (edge.to.endsWith("/browserMatchEngine.mjs")) {
    ids.push("dependency-browser-match-engine");
  }
  if (edge.to.endsWith("/browserEngineIndependence.mjs")) {
    ids.push("dependency-browser-engine-independence");
  }
  if (edge.to.endsWith("/oracleState.mjs")) ids.push("dependency-oracle-state");
  if (
    edge.to.startsWith("tools/")
    || edge.to.startsWith("test/")
    || edge.to.includes("/.local/")
  ) {
    ids.push("dependency-product-tool");
  }
  return ids.map((ruleId) => createFinding({
    ruleId,
    surface: `${edge.kind}-import-graph`,
    location: `${edge.from} -> ${edge.to}`,
    evidence: { specifier: edge.specifier },
  }));
}

async function structuredJsonFindings({ absoluteRoot, path, surface, rules }) {
  const absolutePath = resolve(absoluteRoot, path);
  const source = await readRequiredText(absolutePath, `${surface} ${path}`);
  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(`${surface} ${path} is not valid JSON: ${error.message}`);
  }
  const entries = flattenJson(value);
  const findings = [];
  for (const jsonRule of rules) {
    const matchedPaths = entries
      .filter((entry) => (
        jsonRule.paths?.includes(entry.path)
        || jsonRule.keyPattern?.test(entry.key)
      ))
      .map((entry) => entry.path)
      .sort();
    if (matchedPaths.length === 0) continue;
    findings.push(createFinding({
      ruleId: jsonRule.id,
      surface,
      location: path,
      evidence: { paths: matchedPaths },
    }));
  }
  return findings;
}

async function scanConnectedBundle({ absoluteRoot, distIndexPath }) {
  const indexAbsolutePath = resolve(absoluteRoot, distIndexPath);
  const html = await readRequiredText(indexAbsolutePath, `generated bundle index ${distIndexPath}`);
  const sourcePaths = [...html.matchAll(
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/gu,
  )].map((match) => match[1]);
  if (sourcePaths.length === 0) {
    throw new Error(`Generated bundle index ${distIndexPath} has no module script.`);
  }
  const distRoot = dirname(indexAbsolutePath);
  const queue = sourcePaths.map((sourcePath) => resolveDistSpecifier(distRoot, sourcePath));
  const visited = new Set();
  const bundleSources = [];
  while (queue.length > 0) {
    const absolutePath = normalize(queue.shift());
    if (visited.has(absolutePath)) continue;
    visited.add(absolutePath);
    const source = await readRequiredText(
      absolutePath,
      `connected generated bundle ${repoRelative(absoluteRoot, absolutePath)}`,
    );
    bundleSources.push({
      path: repoRelative(absoluteRoot, absolutePath),
      source,
    });
    for (const specifier of parseModuleSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      queue.push(resolve(dirname(absolutePath), specifier));
    }
  }
  const findings = [];
  for (const bundleRule of BUNDLE_RULES) {
    const files = bundleSources
      .filter(({ source }) => matchingLines(source, bundleRule.pattern).length > 0)
      .map(({ path }) => path)
      .sort();
    if (files.length === 0) continue;
    findings.push(createFinding({
      ruleId: bundleRule.id,
      surface: "generated-bundle-graph",
      location: "dist:connected-module-bundles",
      evidence: { files },
    }));
  }
  return findings;
}

function parseModuleSpecifiers(source) {
  const specifiers = [];
  const pattern = /\b(?:import|export)\s+(?:[^"']*?\s+from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1] ?? match[2]);
  return specifiers;
}

async function resolveLocalModule(parentPath, specifier) {
  const direct = resolve(parentPath, specifier);
  const candidates = extname(direct)
    ? [direct]
    : [direct, `${direct}.mjs`, `${direct}.js`, join(direct, "index.mjs")];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Production import ${specifier} from ${parentPath} cannot be resolved.`);
}

function resolveDistSpecifier(distRoot, specifier) {
  const withoutQuery = specifier.split(/[?#]/u, 1)[0];
  return withoutQuery.startsWith("/")
    ? resolve(distRoot, `.${withoutQuery}`)
    : resolve(distRoot, withoutQuery);
}

function matchingLines(source, pattern) {
  const matches = [];
  pattern.lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    matches.push(source.slice(0, match.index).split("\n").length);
  }
  return [...new Set(matches)].sort((left, right) => left - right);
}

function flattenJson(value, path = "$", key = "$", entries = []) {
  entries.push({ path, key, value });
  if (Array.isArray(value)) {
    value.forEach((child, index) => flattenJson(child, `${path}[${index}]`, String(index), entries));
  } else if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) {
      flattenJson(child, `${path}.${childKey}`, childKey, entries);
    }
  }
  return entries;
}

function createFinding({ ruleId, surface, location, evidence }) {
  return Object.freeze({ ruleId, surface, location, evidence: Object.freeze(evidence) });
}

function rule(id, pattern) {
  return Object.freeze({ id, pattern });
}

function compareFindings(left, right) {
  return findingKey(left).localeCompare(findingKey(right));
}

function repoRelative(root, path) {
  const answer = relative(root, path).split(sep).join("/");
  if (answer === ".." || answer.startsWith("../")) {
    throw new Error(`Production graph escaped the repository: ${path}`);
  }
  return answer;
}

async function readRequiredText(path, label) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`Missing ${label}.`);
    throw error;
  }
}

function formatFinding(finding) {
  const evidence = finding.evidence.lines
    ? ` lines=${finding.evidence.lines.join(",")}`
    : finding.evidence.paths
      ? ` paths=${finding.evidence.paths.join(",")}`
      : finding.evidence.files
        ? ` files=${finding.evidence.files.join(",")}`
        : "";
  return `- ${finding.ruleId} | ${finding.surface} | ${finding.location}${evidence}`;
}

function parseArgs(argv) {
  let root = process.cwd();
  let inventory = false;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") {
      root = argv[index + 1];
      if (!root) throw new Error("--root requires a path.");
      index += 1;
    } else if (argument === "--inventory") {
      inventory = true;
    } else if (argument === "--check") {
      check = true;
    } else {
      throw new Error(`Unknown argument ${argument}.`);
    }
  }
  if (check && inventory) throw new Error("--check cannot be combined with --inventory.");
  return { root, mode: check ? "check" : "inventory" };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scan = await scanCssoccerFreePlayBoundary({ root: options.root });
  for (const finding of scan.findings) process.stdout.write(`${formatFinding(finding)}\n`);
  if (options.mode === "inventory") {
    process.stdout.write(
      `free-play boundary inventory: ${scan.findings.length} violation(s) across ${scan.sourceModuleCount} production modules\n`,
    );
    return;
  }
  const assessment = assessCssoccerFreePlayBoundary(scan.findings, { mode: options.mode });
  if (assessment.status === "pass") {
    process.stdout.write("free-play boundary check: clean\n");
    return;
  }
  for (const key of assessment.unexpected) process.stderr.write(`unexpected boundary violation: ${key}\n`);
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

export const CHECK_FREE_PLAY_BOUNDARY_PATH = fileURLToPath(import.meta.url);

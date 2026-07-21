#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildDifferentialBundle, publishDifferentialBundleAtomic } from "../src/parity/differentialBundle.mjs";
import { compareNativeParityFiles, GAMEPLAY_FIELD_SELECTION } from "../src/parity/nativeParity.mjs";

export async function main(argv = process.argv.slice(2), {
  env = process.env,
  stdout = process.stdout,
} = {}) {
  const options = parseArguments(argv, env);
  const transport = await loadTransport(options.transportModule);
  const workRoot = join(options.outputRoot, ".work");
  mkdirSync(workRoot, { recursive: true });
  let comparison;
  let bundle;
  try {
    comparison = await compareNativeParityFiles(options.reference, options.candidate, {
      fieldSelection: GAMEPLAY_FIELD_SELECTION,
      sampleStoreRoot: join(workRoot, "samples"),
    });
    const historyRows = loadHistoricalRows(options.outputRoot, transport, comparison);
    bundle = buildDifferentialBundle(comparison, {
      publishedAt: options.publishedAt ?? comparison.candidateStream.header.generatedAt,
      title: options.title,
      subtitle: options.subtitle,
      scenarioLabel: options.scenarioLabel,
      historyRows,
      workspaceRoot: join(workRoot, "bundles"),
    });
    const publication = await publishDifferentialBundleAtomic(bundle, options.outputRoot, {
      validateGeneration: (manifestPath) => transport.assertDifferentialTestingBundle(manifestPath),
    });
    const result = {
      status: comparison.status,
      mismatchCount: comparison.mismatchCount,
      earliestMismatch: comparison.earliestMismatch,
      fieldSelection: comparison.fieldSelection,
      artifacts: {
        reference: comparison.bindings.reference,
        candidate: comparison.bindings.candidate,
      },
      engineIndependence: {
        status: comparison.engineIndependence.status,
        check: comparison.engineIndependence.check,
      },
      processing: comparison.processing,
      generationId: publication.generationId,
      manifestPath: publication.manifestPath,
    };
    stdout.write(`${JSON.stringify(result)}\n`);
    return result;
  } finally {
    if (comparison?.sampleStore?.root) rmSync(comparison.sampleStore.root, { recursive: true, force: true });
    if (bundle?.workspaceRoot) rmSync(bundle.workspaceRoot, { recursive: true, force: true });
  }
}

export function loadHistoricalRows(outputRoot, transport, comparison) {
  const generationsRoot = join(outputRoot, "generations");
  if (!existsSync(generationsRoot)) return [];
  if (
    typeof transport.assertDifferentialTestingBundle !== "function"
    || typeof transport.readDifferentialTestingBundleScenario !== "function"
  ) {
    throw new TypeError("Installed Differential Testing transport cannot recover retained history.");
  }
  const { bindings, tickRange, phases } = comparison.referenceStream.header;
  const scenarioId = bindings.scenarioId;
  const expectedContract = comparison.fieldSelection.comparisonContractSha256;
  const rows = [];
  for (const entry of readdirSync(generationsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const manifestPath = join(generationsRoot, entry.name, "current.json");
    if (!existsSync(manifestPath)) continue;
    const validated = transport.assertDifferentialTestingBundle(manifestPath);
    let scenario;
    try {
      scenario = transport.readDifferentialTestingBundleScenario(validated, scenarioId);
    } catch {
      continue;
    }
    const data = scenario.data;
    const catalog = data.scenarioCatalog?.scenarios?.find((item) => item.id === scenarioId);
    if (
      !catalog
      || catalog.frameCount !== tickRange.count
      || catalog.replaySha256 !== bindings.inputSha256
      || catalog.profileSha256 !== bindings.profileSha256
      || catalog.contractSha256 !== expectedContract
    ) continue;
    const latest = data.progress?.at(-1);
    if (!latest) continue;
    const typed = data.adapter?.typedExact;
    const phaseCount = Array.isArray(typed?.phaseOrder) && typed.phaseOrder.length > 0
      ? typed.phaseOrder.length
      : phases.length;
    const frame = Number.isSafeInteger(latest.frame)
      ? latest.frame
      : typed?.earliestMismatch === null
        ? tickRange.count
        : Math.floor(Number(typed?.flattenedTick) / phaseCount);
    rows.push({
      ...latest,
      fieldCount: latest.fieldCount ?? data.summary?.fields?.total,
      failedFieldCount: latest.failedFieldCount ?? data.summary?.fields?.failed,
      frames: tickRange.count,
      frame,
      firstFailingTick: latest.firstFailingTick ?? typed?.earliestMismatch?.tick ?? null,
      firstFailingLabel: latest.firstFailingLabel ?? typed?.earliestMismatch?.fieldLabel ?? null,
    });
  }
  return rows;
}

export function parseArguments(argv, env = process.env) {
  const options = {
    title: "cssoccer exact gameplay differential",
    transportModule: env.BURNLIST_DIFFERENTIAL_TESTING_TRANSPORT,
  };
  const valueFlags = new Map([
    ["--reference", "reference"],
    ["--candidate", "candidate"],
    ["--output-root", "outputRoot"],
    ["--transport-module", "transportModule"],
    ["--published-at", "publishedAt"],
    ["--title", "title"],
    ["--subtitle", "subtitle"],
    ["--scenario-label", "scenarioLabel"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--help") throw new UsageError(usage(), 0);
    const key = valueFlags.get(flag);
    if (!key) throw new UsageError(`Unknown argument ${flag}.\n\n${usage()}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new UsageError(`${flag} requires a value.\n\n${usage()}`);
    options[key] = value;
    index += 1;
  }
  for (const key of ["reference", "candidate", "outputRoot", "transportModule"]) {
    if (!options[key]) throw new UsageError(`${key} is required.\n\n${usage()}`);
  }
  options.reference = resolve(options.reference);
  options.candidate = resolve(options.candidate);
  options.outputRoot = resolve(options.outputRoot);
  return options;
}

export class UsageError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = "UsageError";
    this.exitCode = exitCode;
  }
}

async function loadTransport(specifier) {
  const normalized = specifier.startsWith("file:")
    ? specifier
    : specifier.startsWith("/") || specifier.startsWith(".")
      ? pathToFileURL(resolve(specifier)).href
      : specifier;
  const module = await import(normalized);
  if (typeof module.assertDifferentialTestingBundle !== "function") {
    throw new TypeError(`${specifier} does not export assertDifferentialTestingBundle`);
  }
  return module;
}

function usage() {
  return [
    "Usage: node tools/publish-differential-testing.mjs \\",
    "  --reference <native.jsonl> --candidate <browser.jsonl> \\",
    "  --output-root <atomic-bundle-root> --transport-module <burnlist transport module>",
    "",
    "The output root receives generations/<sha256>/ and an atomically replaced current symlink.",
    "Only explicit gameplay-state fields are compared; camera.* remains in visual parity.",
    "No dashboard binding or live current.json path is selected automatically.",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const stream = error.exitCode === 0 ? process.stdout : process.stderr;
    stream.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  });
}

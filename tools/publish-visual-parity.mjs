#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildVisualParityBundle,
  buildVisualParityData,
  calibrateVisualSourceAA,
  compareVisualCaptures,
  publishVisualParityBundleAtomic,
  readVisualCaptureManifest,
} from "../src/parity/visualParity.mjs";
import { sha256Hex } from "../src/parity/io.mjs";

export async function main(argv = process.argv.slice(2), {
  env = process.env,
  stdout = process.stdout,
} = {}) {
  const options = parseArguments(argv, env);
  if (options.help) {
    stdout.write(`${usage()}\n`);
    return { status: "help" };
  }
  const nativeA = readVisualCaptureManifest(options.nativeA);
  const nativeB = readVisualCaptureManifest(options.nativeB);
  const browser = readVisualCaptureManifest(options.browser);
  const calibration = calibrateVisualSourceAA(nativeA, nativeB);
  const report = compareVisualCaptures({ reference: nativeA, candidate: browser, calibration });
  const differentialTesting = readDifferentialTestingData(options.differentialData);
  const payload = buildVisualParityData(report, calibration, differentialTesting);
  const contract = await loadContract(options.contractModule);
  const bundle = buildVisualParityBundle({
    payload,
    report,
    calibration,
    publishedAt: options.publishedAt ?? report.comparedAt,
  });
  const publication = await publishVisualParityBundleAtomic(bundle, options.outputRoot, {
    validateGeneration: (payloadPath) => contract.assertVisualParityData(JSON.parse(readFileSync(payloadPath, "utf8"))),
  });
  const result = {
    status: report.status,
    earliestFailure: report.earliestFailure,
    generationId: publication.generationId,
    payloadPath: publication.payloadPath,
    metricsPath: publication.metricsPath,
  };
  stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

export function parseArguments(argv, env = process.env) {
  const options = {
    contractModule: env.CSSOCCER_VISUAL_PARITY_CONTRACT,
    help: false,
  };
  const flags = new Map([
    ["--native-a", "nativeA"],
    ["--native-b", "nativeB"],
    ["--browser", "browser"],
    ["--differential-data", "differentialData"],
    ["--output-root", "outputRoot"],
    ["--contract-module", "contractModule"],
    ["--published-at", "publishedAt"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--help") { options.help = true; continue; }
    const key = flags.get(flag);
    if (!key) throw new UsageError(`Unknown argument ${flag}.\n\n${usage()}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new UsageError(`${flag} requires a value.\n\n${usage()}`);
    options[key] = value;
    index += 1;
  }
  if (options.help) return options;
  for (const key of ["nativeA", "nativeB", "browser", "differentialData", "outputRoot", "contractModule"]) {
    if (!options[key]) throw new UsageError(`${key} is required.\n\n${usage()}`);
  }
  for (const key of ["nativeA", "nativeB", "browser", "differentialData", "outputRoot"]) options[key] = resolve(options[key]);
  return options;
}

export function readDifferentialTestingData(path) {
  const resolved = resolve(path);
  const value = JSON.parse(readFileSync(resolved, "utf8"));
  if (value?.schema === "burnlist-differential-testing-data@1") return value;
  if (value?.schema === "burnlist-differential-testing-scenario@1" && value.data?.schema === "burnlist-differential-testing-data@1") {
    return Array.isArray(value.data.fields) ? value.data : materializeDifferentialFields(value, dirname(resolved));
  }
  if (value?.schema === "burnlist-differential-testing-bundle@1") {
    const scenarioId = value.scenarioCatalog?.selectedScenarioId;
    const binding = value.scenarioBindings?.find((entry) => entry.scenarioId === scenarioId);
    if (!binding?.path) throw new Error("Differential Testing bundle does not bind its selected scenario.");
    const root = dirname(resolved);
    const scenarioPath = resolve(root, binding.path);
    if (scenarioPath !== root && !scenarioPath.startsWith(`${root}${sep}`)) throw new Error("Differential Testing scenario binding escapes its bundle root.");
    const scenarioBytes = readFileSync(scenarioPath);
    if (binding.size !== scenarioBytes.length || binding.sha256 !== sha256Hex(scenarioBytes)) throw new Error("Differential Testing scenario binding does not match its bytes.");
    const scenario = JSON.parse(scenarioBytes.toString("utf8"));
    if (scenario?.schema !== "burnlist-differential-testing-scenario@1" || scenario.data?.schema !== "burnlist-differential-testing-data@1") throw new Error("Differential Testing scenario bundle is invalid.");
    return materializeDifferentialFields(scenario, dirname(scenarioPath));
  }
  throw new Error("Expected normalized Differential Testing data, scenario data, or bundle manifest.");
}

function materializeDifferentialFields(scenario, scenarioRoot) {
  if (!Array.isArray(scenario.fieldIndex) || !scenario.records?.path) throw new Error("Differential Testing scenario does not bind field records.");
  const recordsPath = resolve(scenarioRoot, scenario.records.path);
  if (recordsPath !== scenarioRoot && !recordsPath.startsWith(`${scenarioRoot}${sep}`)) throw new Error("Differential Testing field records escape the scenario root.");
  const bytes = readFileSync(recordsPath);
  if (scenario.records.size !== bytes.length || scenario.records.sha256 !== sha256Hex(bytes) || scenario.records.count !== scenario.fieldIndex.length) throw new Error("Differential Testing field-record binding does not match its bytes.");
  const fields = scenario.fieldIndex.slice().sort((left, right) => left.ordinal - right.ordinal).map((index) => {
    const start = index.record?.offset;
    const end = start + index.record?.size;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(index.record?.size) || start < 0 || end > bytes.length) throw new Error(`Differential Testing field ${index.id} has an invalid byte range.`);
    const recordBytes = bytes.subarray(start, end);
    if (index.record.sha256 !== sha256Hex(recordBytes)) throw new Error(`Differential Testing field ${index.id} does not match its record hash.`);
    const record = JSON.parse(recordBytes.toString("utf8"));
    if (record?.schema !== "burnlist-differential-testing-field-record@1" || record.scenarioId !== scenario.scenarioId || record.id !== index.id || record.ordinal !== index.ordinal || !record.field) throw new Error(`Differential Testing field ${index.id} record is invalid.`);
    return record.field;
  });
  return { ...scenario.data, fields };
}

export class UsageError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = "UsageError";
    this.exitCode = exitCode;
  }
}

async function loadContract(specifier) {
  const normalized = specifier.startsWith("file:")
    ? specifier
    : specifier.startsWith("/") || specifier.startsWith(".")
      ? pathToFileURL(resolve(specifier)).href
      : specifier;
  const module = await import(normalized);
  if (typeof module.assertVisualParityData !== "function") throw new TypeError(`${specifier} does not export assertVisualParityData`);
  return module;
}

function usage() {
  return [
    "Usage: node tools/publish-visual-parity.mjs \\",
    "  --native-a <capture.json> --native-b <capture.json> --browser <capture.json> \\",
    "  --differential-data <checked-data-or-bundle.json> \\",
    "  --output-root <atomic-local-root> --contract-module <installed-contract.mjs>",
    "",
    "The command calibrates source A/A, compares five isolated full-match windows, validates with the installed contract,",
    "and atomically swaps <output-root>/current. It never selects a port 4510 binding or live current.json path.",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const stream = error.exitCode === 0 ? process.stdout : process.stderr;
    stream.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  });
}

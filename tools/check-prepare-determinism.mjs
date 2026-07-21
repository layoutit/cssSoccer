#!/usr/bin/env node

import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { prepareCssoccer } from "../src/prepare/cssoccer/prepare.mjs";
import { validateCssoccerPreparedPath } from "../src/prepare/cssoccer/paths.mjs";
import { canonicalJsonBytes, sha256Hex } from "../src/prepare/cssoccer/provenance.mjs";
import { loadCssoccerFixtureAssembler } from "./prepare-cssoccer.mjs";

export class CssoccerPrepareDeterminismError extends Error {
  constructor(message) {
    super(message);
    this.name = "CssoccerPrepareDeterminismError";
  }
}

export async function checkCssoccerPrepareDeterminism({
  assembledFixture,
  assembleFixture,
  temporaryParent = tmpdir(),
} = {}) {
  const hasFixture = assembledFixture !== undefined;
  const hasAssembler = assembleFixture !== undefined;
  if (hasFixture === hasAssembler) {
    throw new Error("Provide exactly one of assembledFixture or assembleFixture");
  }
  const workspace = await mkdtemp(join(resolve(temporaryParent), "cssoccer-prepare-check-"));
  try {
    const assembly = !hasFixture
      ? { assembleFixture }
      : { assembledFixture };
    await prepareCssoccer({ ...assembly, outputRoot: join(workspace, "run-a") });
    await prepareCssoccer({ ...assembly, outputRoot: join(workspace, "run-b") });
    const compared = await compareCssoccerPreparedPublications(
      join(workspace, "run-a"),
      join(workspace, "run-b"),
    );
    return Object.freeze({
      schema: "cssoccer-prepare-determinism-report@1",
      status: "pass",
      fileCount: compared.fileCount,
      bytes: compared.bytes,
      treeSha256: compared.treeSha256,
    });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export async function compareCssoccerPreparedPublications(leftRoot, rightRoot) {
  const [left, right] = await Promise.all([
    inspectPublication(leftRoot),
    inspectPublication(rightRoot),
  ]);
  if (left.length !== right.length) {
    throw new CssoccerPrepareDeterminismError(
      `Prepared publications contain different file counts: ${left.length} and ${right.length}`,
    );
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftFile = left[index];
    const rightFile = right[index];
    if (leftFile.path !== rightFile.path) {
      throw new CssoccerPrepareDeterminismError(
        `Prepared publication path mismatch: ${leftFile.path} versus ${rightFile.path}`,
      );
    }
    if (!leftFile.bytes.equals(rightFile.bytes)) {
      throw new CssoccerPrepareDeterminismError(
        `Prepared publication byte mismatch at ${leftFile.path} offset ${firstDifference(leftFile.bytes, rightFile.bytes)}`,
      );
    }
  }

  const entries = left.map(({ path, bytes, sha256 }) => ({
    path,
    bytes: bytes.byteLength,
    sha256,
  }));
  return Object.freeze({
    status: "pass",
    fileCount: entries.length,
    bytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    treeSha256: sha256Hex(canonicalJsonBytes(entries)),
  });
}

export async function runCheckPrepareDeterminismCli(
  argv = process.argv.slice(2),
  {
    cwd = process.cwd(),
    env = process.env,
    stdout = process.stdout,
  } = {},
) {
  const options = parseArguments(argv);
  if (options.help) {
    stdout.write(helpText());
    return Object.freeze({ status: "help" });
  }
  const specifier = options.assembler ?? env.CSSOCCER_PREPARED_ASSEMBLER;
  const assembleFixture = await loadCssoccerFixtureAssembler(specifier, cwd);
  const report = await checkCssoccerPrepareDeterminism({ assembleFixture });
  stdout.write(`${JSON.stringify(report)}\n`);
  return report;
}

async function inspectPublication(root) {
  const status = await lstat(root);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new CssoccerPrepareDeterminismError("Prepared publication root must be a real directory");
  }
  const records = [];
  await walk(root, "", records);
  records.sort((left, right) => compareStrings(left.path, right.path));
  return records;
}

async function walk(root, relativeDirectory, records) {
  const absoluteDirectory = relativeDirectory
    ? join(root, ...relativeDirectory.split("/"))
    : root;
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  entries.sort((left, right) => compareStrings(left.name, right.name));
  for (const entry of entries) {
    const path = relativeDirectory
      ? posix.join(relativeDirectory, entry.name)
      : entry.name;
    validateCssoccerPreparedPath(path, {
      allowReserved: true,
      label: "published file path",
    });
    if (entry.isSymbolicLink()) {
      throw new CssoccerPrepareDeterminismError(`Prepared publication contains symlink ${path}`);
    }
    if (entry.isDirectory()) {
      await walk(root, path, records);
      continue;
    }
    if (!entry.isFile()) {
      throw new CssoccerPrepareDeterminismError(`Prepared publication contains non-file ${path}`);
    }
    const bytes = await readFile(join(root, ...path.split("/")));
    records.push(Object.freeze({ path, bytes, sha256: sha256Hex(bytes) }));
  }
}

function firstDifference(left, right) {
  const shared = Math.min(left.byteLength, right.byteLength);
  for (let index = 0; index < shared; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return shared;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--assembler") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--assembler requires a value");
      if (options.assembler !== undefined) throw new Error("--assembler may be provided only once");
      options.assembler = value;
      index += 1;
      continue;
    }
    throw new Error(`Unsupported check-prepare-determinism argument: ${argument}`);
  }
  return options;
}

function helpText() {
  return [
    "Usage: node tools/check-prepare-determinism.mjs --assembler <module>",
    "",
    "The assembler is run twice into isolated temporary directories and compared byte for byte.",
    "No checked-in or default generated output is written.",
    "",
  ].join("\n");
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

if (isMainModule()) {
  runCheckPrepareDeterminismCli().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

function isMainModule() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
    : false;
}

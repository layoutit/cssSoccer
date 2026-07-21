#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { prepareCssoccer } from "../src/prepare/cssoccer/prepare.mjs";

export const CSSOCCER_ASSEMBLER_EXPORT = "assembleCssoccerPreparedFixture";

export async function loadCssoccerFixtureAssembler(specifier, cwd = process.cwd()) {
  if (typeof specifier !== "string" || specifier.length === 0) {
    throw new Error(
      "The cssoccer prepared-fixture assembler is not wired. Pass --assembler <module> "
      + "or set CSSOCCER_PREPARED_ASSEMBLER.",
    );
  }
  let url;
  if (specifier.startsWith("file:")) {
    url = new URL(specifier);
  } else {
    url = pathToFileURL(resolve(cwd, specifier));
  }
  if (url.protocol !== "file:") {
    throw new Error("The cssoccer assembler must be a local file module");
  }
  const loaded = await import(url.href);
  const assembler = loaded[CSSOCCER_ASSEMBLER_EXPORT];
  if (typeof assembler !== "function") {
    throw new Error(
      `Assembler module must export function ${CSSOCCER_ASSEMBLER_EXPORT}`,
    );
  }
  return assembler;
}

export async function runPrepareCssoccerCli(
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
  const assemblerSpecifier = options.assembler ?? env.CSSOCCER_PREPARED_ASSEMBLER;
  const assembleFixture = await loadCssoccerFixtureAssembler(assemblerSpecifier, cwd);
  const report = await prepareCssoccer({
    assembleFixture,
    outputRoot: options.outputRoot,
  });
  stdout.write(`${JSON.stringify(report)}\n`);
  return report;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--assembler" || argument === "--output-root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value`);
      }
      index += 1;
      const key = argument === "--assembler" ? "assembler" : "outputRoot";
      if (options[key] !== undefined) throw new Error(`${argument} may be provided only once`);
      options[key] = value;
      continue;
    }
    throw new Error(`Unsupported prepare-cssoccer argument: ${argument}`);
  }
  return options;
}

function helpText() {
  return [
    "Usage: node tools/prepare-cssoccer.mjs --assembler <module> [--output-root <directory>]",
    "",
    `The module must export async function ${CSSOCCER_ASSEMBLER_EXPORT}(request).`,
    "The callback returns one fully assembled fixture; this tool owns only validation and publication.",
    "",
  ].join("\n");
}

if (isMainModule()) {
  runPrepareCssoccerCli().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

function isMainModule() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
    : false;
}

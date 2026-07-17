#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const repoRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const contract = JSON.parse(await readFile(join(repoRoot, "references", "actua-soccer-oracle.json"), "utf8"));
const sourceRoot = join(repoRoot, contract.checkout);
const command = process.argv[2] ?? "help";

if (command === "setup") {
  console.log(JSON.stringify(await setup(), null, 2));
} else if (command === "verify") {
  console.log(JSON.stringify(await verify(), null, 2));
} else {
  console.log("Usage: node tools/actua-soccer-oracle.mjs <setup|verify>");
}

async function setup() {
  if (!existsSync(join(sourceRoot, ".git"))) {
    await mkdir(dirname(sourceRoot), { recursive: true });
    await run("git", ["clone", contract.repository, sourceRoot], repoRoot);
  }
  await run("git", ["fetch", "--quiet", "origin", contract.revision], sourceRoot);
  const head = await revision();
  const worktreeMissing = contract.requiredFiles.some((path) => !existsSync(join(sourceRoot, path)));
  if (head === contract.revision && worktreeMissing) {
    await run("git", ["read-tree", "HEAD"], sourceRoot);
    await run("git", ["checkout-index", "--all"], sourceRoot);
  }
  if (head !== contract.revision) {
    const status = (await run("git", ["status", "--short"], sourceRoot)).stdout.trim();
    if (status) throw new Error("Actua Soccer oracle checkout is dirty at the wrong revision; refusing to replace local work.");
    await run("git", ["checkout", "--detach", contract.revision], sourceRoot);
  }
  return verify();
}

async function verify() {
  if (!existsSync(join(sourceRoot, ".git"))) {
    throw new Error("Actua Soccer oracle source is missing. Run pnpm source:setup.");
  }
  const head = await revision();
  if (head !== contract.revision) {
    throw new Error(`Actua Soccer oracle revision mismatch: expected ${contract.revision}, got ${head}.`);
  }
  const missing = contract.requiredFiles.filter((path) => !existsSync(join(sourceRoot, path)));
  if (missing.length) throw new Error("Actua Soccer oracle checkout is incomplete: " + missing.join(", "));
  const origin = (await run("git", ["remote", "get-url", "origin"], sourceRoot)).stdout.trim();
  return {
    schema: "cssoccer-actua-soccer-oracle-verification@1",
    status: "pass",
    sourceRoot,
    origin,
    revision: head,
    requiredFiles: contract.requiredFiles.length,
    dirty: Boolean((await run("git", ["status", "--short"], sourceRoot)).stdout.trim())
  };
}

async function revision() {
  return (await run("git", ["rev-parse", "HEAD"], sourceRoot)).stdout.trim();
}

async function run(file, args, cwd) {
  try {
    return await execute(file, args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`${file} ${args.join(" ")} failed:\n${error.stderr || error.stdout || error.message}`);
  }
}

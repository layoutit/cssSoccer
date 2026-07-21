#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildVisualCaptureManifest,
  readVisualCaptureProfile,
  writeVisualCaptureManifest,
} from "../src/parity/visualParity.mjs";
import { canonicalJson } from "../src/parity/io.mjs";

export async function main(argv = process.argv.slice(2), options = {}) {
  const parsed = parseCaptureArguments(argv, options);
  if (parsed.help) {
    (options.stdout ?? process.stdout).write(`${usage(options.kind ?? "native")}\n`);
    return { status: "help" };
  }
  const profile = readVisualCaptureProfile(parsed.profile);
  prepareOutput(parsed.outputRoot, parsed.replace);
  const rawRoot = parsed.sourceRoot ?? join(parsed.outputRoot, "raw");
  const sequenceRoot = join(parsed.outputRoot, "sequences");
  mkdirSync(sequenceRoot, { recursive: true });
  const domainFrameRoots = {};
  for (const domain of profile.domains) {
    let source = join(rawRoot, domain.id);
    if (parsed.command) {
      mkdirSync(source, { recursive: true });
      runCaptureCommand(parsed.command, {
        ...process.env,
        CSSOCCER_VISUAL_ROLE: parsed.role,
        CSSOCCER_VISUAL_DOMAIN: domain.id,
        CSSOCCER_VISUAL_FRAMES_DIR: source,
        CSSOCCER_VISUAL_FRAME_PATTERN: join(source, `frame_%04d.${parsed.frameExtension}`),
        CSSOCCER_VISUAL_FRAME_COUNT: String(profile.framePlan.length),
        CSSOCCER_VISUAL_FRAME_PLAN: JSON.stringify(profile.framePlan),
      }, domain.id);
    }
    if (!existsSync(source)) throw new Error(`Missing ${domain.id} source frames: ${source}`);
    const packagedRoot = join(sequenceRoot, domain.id);
    packageWithFrameSequence({
      tool: parsed.frameTool,
      source,
      output: packagedRoot,
      label: `${parsed.role}_${domain.id}`,
      expectedFrames: profile.framePlan.length,
      leadFrames: profile.leadFrameCount - 1,
      keyframes: profile.framePlan.filter((frame) => frame.windowId !== null).map((frame) => frame.ordinal),
    });
    domainFrameRoots[domain.id] = join(packagedRoot, "frames");
  }
  writeFileSync(join(parsed.outputRoot, "capture-profile.json"), `${canonicalJson(profile)}\n`, { flag: "wx", mode: 0o644 });
  const manifest = buildVisualCaptureManifest({
    profile,
    role: parsed.role,
    manifestRoot: parsed.outputRoot,
    domainFrameRoots,
    sourceSha256: parsed.sourceSha256,
    buildSha256: parsed.buildSha256,
    renderer: { id: parsed.rendererId, label: parsed.rendererLabel, mode: "headless" },
    generatedAt: parsed.generatedAt ?? new Date().toISOString(),
  });
  const manifestPath = join(parsed.outputRoot, "capture.json");
  writeVisualCaptureManifest(manifestPath, manifest);
  const result = {
    status: "captured",
    role: manifest.role,
    captureId: manifest.captureId,
    captureProfileSha256: manifest.captureProfileSha256,
    frameCount: manifest.framePlan.length,
    domainCount: manifest.domains.length,
    manifestPath,
  };
  (options.stdout ?? process.stdout).write(`${JSON.stringify(result)}\n`);
  return result;
}

export function parseCaptureArguments(argv, {
  kind = "native",
  lockedRole = null,
  defaultRendererId = kind === "browser" ? "cssoccer-browser" : "actua-soccer-native",
  defaultRendererLabel = kind === "browser" ? "css.soccer browser" : "Actua Soccer native",
  env = process.env,
} = {}) {
  const options = {
    role: lockedRole,
    rendererId: defaultRendererId,
    rendererLabel: defaultRendererLabel,
    frameExtension: "png",
    frameTool: env.FRAME_SEQUENCE_ORACLE_TOOL
      ?? join(homedir(), ".codex", "skills", "frame-sequence-oracle", "scripts", "frame-sequence.mjs"),
    replace: false,
    help: false,
  };
  const values = new Map([
    ["--profile", "profile"],
    ["--source-root", "sourceRoot"],
    ["--command", "command"],
    ["--output-root", "outputRoot"],
    ["--role", "role"],
    ["--source-sha256", "sourceSha256"],
    ["--build-sha256", "buildSha256"],
    ["--renderer-id", "rendererId"],
    ["--renderer-label", "rendererLabel"],
    ["--frame-extension", "frameExtension"],
    ["--frame-tool", "frameTool"],
    ["--generated-at", "generatedAt"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--help") { options.help = true; continue; }
    if (flag === "--replace") { options.replace = true; continue; }
    const key = values.get(flag);
    if (!key) throw new UsageError(`Unknown argument ${flag}.\n\n${usage(kind)}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new UsageError(`${flag} requires a value.\n\n${usage(kind)}`);
    if (lockedRole && key === "role") throw new UsageError(`${kind} capture fixes role to ${lockedRole}.\n\n${usage(kind)}`);
    options[key] = value;
    index += 1;
  }
  if (options.help) return options;
  for (const key of ["profile", "outputRoot", "role", "sourceSha256", "buildSha256", "frameTool"]) {
    if (!options[key]) throw new UsageError(`${key} is required.\n\n${usage(kind)}`);
  }
  if (Boolean(options.sourceRoot) === Boolean(options.command)) throw new UsageError(`Exactly one of --source-root or --command is required.\n\n${usage(kind)}`);
  if (kind === "native" && !["native-a", "native-b"].includes(options.role)) throw new UsageError(`Native --role must be native-a or native-b.\n\n${usage(kind)}`);
  if (!new Set(["png", "ppm"]).has(options.frameExtension)) throw new UsageError(`--frame-extension must be png or ppm.\n\n${usage(kind)}`);
  for (const key of ["profile", "outputRoot", "frameTool", ...(options.sourceRoot ? ["sourceRoot"] : [])]) options[key] = resolve(options[key]);
  return options;
}

export class UsageError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = "UsageError";
    this.exitCode = exitCode;
  }
}

function prepareOutput(root, replace) {
  if (existsSync(root)) {
    if (!replace) throw new Error(`Output exists; pass --replace: ${root}`);
    rmSync(root, { recursive: true, force: true });
  }
  mkdirSync(root, { recursive: true });
}

function runCaptureCommand(command, env, domainId) {
  const result = spawnSync("zsh", ["-lc", command], { env, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Capture command failed for ${domainId} with exit ${result.status}: ${result.stderr ?? ""}`);
}

function packageWithFrameSequence({ tool, source, output, label, expectedFrames, leadFrames, keyframes }) {
  const args = [
    tool, "package",
    "--frames", source,
    "--out", output,
    "--label", label,
    "--expected-frames", String(expectedFrames),
    "--lead-frames", String(leadFrames),
    "--keyframes", keyframes.join(","),
  ];
  const result = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Frame-sequence packaging failed for ${label}: ${result.stderr ?? result.stdout ?? ""}`);
  let outputValue;
  try { outputValue = JSON.parse(result.stdout); } catch (error) { throw new Error(`Frame-sequence packaging returned invalid JSON for ${label}: ${error.message}`); }
  if (outputValue.frameCount !== expectedFrames) throw new Error(`Frame-sequence packaging returned ${outputValue.frameCount} frames for ${label}; expected ${expectedFrames}`);
}

function usage(kind) {
  const role = kind === "browser" ? "browser role is fixed" : "--role <native-a|native-b>";
  return [
    `Usage: node tools/capture-${kind === "browser" ? "browser" : "native"}-frames.mjs \\`,
    `  --profile <capture-profile.json> --output-root <new-local-directory> ${role} \\`,
    "  --source-sha256 <sha256> --build-sha256 <sha256> \\",
    "  (--source-root <domain-frame-root> | --command <headless-command>) [--replace]",
    "",
    "The source root must contain pitch/, players/, ball/, officials/, and hud/ numbered PNG/PPM frames.",
    "A command runs once per domain with CSSOCCER_VISUAL_* environment variables and must remain headless.",
    "Output is a local capture bundle only; this tool never binds an Oven or port 4510.",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const stream = error.exitCode === 0 ? process.stdout : process.stderr;
    stream.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  });
}

import {
  basename,
  dirname,
  isAbsolute,
  parse,
  posix,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";

import { CSSOCCER_PREPARED_MANIFEST_PATH } from "./manifestContract.mjs";

export const CSSOCCER_REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const CSSOCCER_OUTPUT_ROOT = resolve(
  CSSOCCER_REPO_ROOT,
  dirname(CSSOCCER_PREPARED_MANIFEST_PATH),
);
export const CSSOCCER_MANIFEST_FILE = basename(CSSOCCER_PREPARED_MANIFEST_PATH);
export const CSSOCCER_PROVENANCE_FILE = "provenance.json";

const RESERVED_FILES = new Set([
  CSSOCCER_MANIFEST_FILE,
  CSSOCCER_PROVENANCE_FILE,
]);
const ORIGINAL_DATA_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".dat",
  ".dll",
  ".exe",
  ".h",
  ".hpp",
  ".lib",
  ".obj",
  ".off",
]);
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export function resolveCssoccerOutputRoot(outputRoot = CSSOCCER_OUTPUT_ROOT) {
  if (typeof outputRoot !== "string" || outputRoot.length === 0 || outputRoot.includes("\0")) {
    throw new TypeError("cssoccer outputRoot must be a non-empty filesystem path");
  }
  const absolute = resolve(outputRoot);
  if (absolute === parse(absolute).root) {
    throw new Error("cssoccer outputRoot cannot be a filesystem root");
  }
  return absolute;
}

export function validateCssoccerPreparedPath(
  value,
  { allowReserved = false, label = "prepared output path" } = {},
) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new TypeError(`${label} must be a non-empty relative path`);
  }
  if (
    isAbsolute(value)
    || value.startsWith("/")
    || value.includes("\\")
    || value !== value.normalize("NFC")
    || posix.normalize(value) !== value
  ) {
    throw new Error(`${label} must be a canonical browser-relative path: ${JSON.stringify(value)}`);
  }

  const segments = value.split("/");
  if (
    segments.some((segment) => (
      segment === ""
      || segment === "."
      || segment === ".."
      || !SAFE_SEGMENT.test(segment)
    ))
  ) {
    throw new Error(`${label} contains an unsafe or traversal segment: ${JSON.stringify(value)}`);
  }

  const lowered = value.toLowerCase();
  if (!allowReserved && RESERVED_FILES.has(lowered)) {
    throw new Error(`${label} is reserved for transactional publication: ${value}`);
  }
  const extensionIndex = lowered.lastIndexOf(".");
  const extension = extensionIndex === -1 ? "" : lowered.slice(extensionIndex);
  if (ORIGINAL_DATA_EXTENSIONS.has(extension)) {
    throw new Error(`${label} may not publish an original source/data file: ${value}`);
  }
  return value;
}

export function resolveCssoccerPreparedPath(outputRoot, relativePath, options) {
  const root = resolveCssoccerOutputRoot(outputRoot);
  const checked = validateCssoccerPreparedPath(relativePath, options);
  const absolute = resolve(root, ...checked.split("/"));
  const fromRoot = relative(root, absolute);
  if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${posix.sep}`)) {
    throw new Error(`Prepared path escapes outputRoot: ${relativePath}`);
  }
  return absolute;
}

export function cssoccerPublicUrl(relativePath) {
  return `/cssoccer/${validateCssoccerPreparedPath(relativePath, {
    allowReserved: true,
    label: "prepared public URL path",
  })}`;
}

export function cssoccerPublicationSiblingPaths(outputRoot, token) {
  const root = resolveCssoccerOutputRoot(outputRoot);
  if (typeof token !== "string" || !/^[a-f0-9-]+$/u.test(token)) {
    throw new Error("Publication transaction token must be lowercase hexadecimal");
  }
  const parent = dirname(root);
  const name = basename(root);
  return Object.freeze({
    root,
    parent,
    staging: resolve(parent, `.${name}.stage-${token}`),
    backup: resolve(parent, `.${name}.backup-${token}`),
    lock: resolve(parent, `.${name}.publish-lock`),
  });
}

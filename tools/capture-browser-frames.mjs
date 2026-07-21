#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { main as captureMain } from "./capture-native-frames.mjs";

export function main(argv = process.argv.slice(2), options = {}) {
  return captureMain(argv, {
    ...options,
    kind: "browser",
    lockedRole: "browser",
    defaultRendererId: "cssoccer-browser",
    defaultRendererLabel: "css.soccer browser",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const stream = error.exitCode === 0 ? process.stdout : process.stderr;
    stream.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  });
}

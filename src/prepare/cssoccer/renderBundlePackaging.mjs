import { createHash } from "node:crypto";

import { canonicalJson } from "./provenance.mjs";

export const CSSOCCER_PACKED_FRAME_STYLES_SCHEMA =
  "cssoccer-packed-render-frame-styles@1";
export const CSSOCCER_PACKED_FRAME_STYLES_VERSION = 3;
export const CSSOCCER_PACKED_FRAME_LEAF_STYLES =
  "cssquake-packed-frame-styles@3";

const INLINE_FRAME_LEAF_STYLES = "inline-css-text@1";
const SAFE_ID = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/u;

/**
 * Move repeated animation leaf CSS out of the startup publication. This is
 * the cssQuake v3 frame-style contract adapted to cssoccer's canonical CSS:
 * one stable base DOM/CSS bundle remains inline and later frames inherit
 * unchanged background/extra declarations from frame zero.
 */
export function packageCssoccerRenderFrameStyles(publication) {
  if (!publication || typeof publication !== "object" || !Array.isArray(publication.frameSets)) {
    throw new TypeError("Prepared cssoccer render publication is incomplete.");
  }

  const styleFiles = [];
  const frameSets = publication.frameSets.map((frameSet) => {
    if (frameSet.frameLeafStyleEncoding !== INLINE_FRAME_LEAF_STYLES) {
      return frameSet;
    }
    requirePackableFrameSet(frameSet);
    const baseStyles = frameSet.frames[0].leafStyles.map(splitCanonicalFrameStyle);
    const frames = frameSet.frames.map((frame, frameIndex) => (
      frameIndex === 0
        ? baseStyles
        : frame.leafStyles.map((style, leafIndex) => (
            compactFrameStyle(splitCanonicalFrameStyle(style), baseStyles[leafIndex])
          ))
    ));
    if (frameSet.frames.some((frame) => frame.playerNumberLeafStyles !== undefined)) {
      throw new Error(`Prepared render frame set ${frameSet.id} contains obsolete player styles.`);
    }
    const chunks = animationFrameChunks(frameSet.frames);
    const frameStyleFiles = chunks.map(({ id: chunkId, frameStart, frameEnd }) => {
      const path = `assets/animation/${frameSet.id}/${chunkId}.json`;
      const styleFile = deepFreeze({
        schema: CSSOCCER_PACKED_FRAME_STYLES_SCHEMA,
        version: CSSOCCER_PACKED_FRAME_STYLES_VERSION,
        frameSetId: frameSet.id,
        topologyHash: frameSet.topologyHash,
        frameCount: frameSet.frameCount,
        leafCount: frameSet.leafCount,
        frameStart,
        frameEnd,
        frames: frames.slice(frameStart, frameEnd),
      });
      styleFiles.push(deepFreeze({
        frameSetId: frameSet.id,
        frameStart,
        frameEnd,
        path,
        json: styleFile,
      }));
      return deepFreeze({ path, frameStart, frameEnd });
    });

    const compactFrames = frameSet.frames.map((frame) => {
      const { leafStyles: _leafStyles, ...metadata } = frame;
      return metadata;
    });
    const {
      frameSetHash: _frameSetHash,
      frameLeafStyleEncoding: _frameLeafStyleEncoding,
      frames: _frames,
      ...frameSetMetadata
    } = frameSet;
    const compactCore = {
      ...frameSetMetadata,
      frameLeafStyleEncoding: CSSOCCER_PACKED_FRAME_LEAF_STYLES,
      frameStyleFiles,
      frames: compactFrames,
    };
    return deepFreeze({
      ...compactCore,
      frameSetHash: sha256(canonicalJson(compactCore)),
    });
  });

  return deepFreeze({
    publication: {
      ...publication,
      frameSets,
    },
    styleFiles,
  });
}

function animationFrameChunks(frames) {
  const slots = frames.map(({ id }) => /^mc-(\d{3})-f-/u.exec(id)?.[1] ?? null);
  if (slots.every((slot) => slot !== null)) {
    const chunks = [];
    let frameStart = 0;
    for (let frameIndex = 1; frameIndex <= frames.length; frameIndex += 1) {
      if (frameIndex < frames.length && slots[frameIndex] === slots[frameStart]) continue;
      chunks.push({
        id: `slot-${slots[frameStart]}`,
        frameStart,
        frameEnd: frameIndex,
      });
      frameStart = frameIndex;
    }
    return chunks;
  }
  const chunks = [];
  for (let frameStart = 0; frameStart < frames.length; frameStart += 64) {
    const frameEnd = Math.min(frames.length, frameStart + 64);
    chunks.push({
      id: `frames-${String(frameStart).padStart(6, "0")}-${String(frameEnd).padStart(6, "0")}`,
      frameStart,
      frameEnd,
    });
  }
  return chunks;
}

export function hydrateCssoccerPackedFrameStyle(frameStyle, baseFrameStyle) {
  requirePackedTuple(frameStyle, "packed frame style");
  requirePackedTuple(baseFrameStyle, "packed base frame style");
  const matrix = frameStyle[0] ?? "";
  const background = frameStyle.length >= 2 && frameStyle[1] !== null
    ? frameStyle[1] ?? ""
    : baseFrameStyle[1] ?? "";
  const extraStyle = frameStyle.length >= 3 && frameStyle[2] !== null
    ? frameStyle[2] ?? ""
    : baseFrameStyle[2] ?? "";
  return canonicalFrameStyle([matrix, background, extraStyle]);
}

function requirePackableFrameSet(frameSet) {
  if (!SAFE_ID.test(frameSet?.id ?? "")
      || !Number.isSafeInteger(frameSet.frameCount)
      || frameSet.frameCount < 2
      || !Number.isSafeInteger(frameSet.leafCount)
      || frameSet.leafCount <= 0
      || !Array.isArray(frameSet.frames)
      || frameSet.frames.length !== frameSet.frameCount
      || frameSet.frames.some((frame) => (
        !Array.isArray(frame.leafStyles) || frame.leafStyles.length !== frameSet.leafCount
      ))) {
    throw new Error(`Prepared render frame set ${String(frameSet?.id)} cannot be packed.`);
  }
}

function splitCanonicalFrameStyle(style) {
  if (typeof style !== "string" || style.length === 0) {
    throw new Error("Prepared render frame style must be non-empty canonical CSS.");
  }
  let matrix = "";
  const background = [];
  const extra = [];
  for (const declaration of style.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator <= 0) throw new Error("Prepared render frame style is malformed.");
    const name = declaration.slice(0, separator);
    const value = declaration.slice(separator + 1);
    if (name === "transform") {
      matrix = value.startsWith("matrix3d(") && value.endsWith(")")
        ? value.slice("matrix3d(".length, -1)
        : value;
    } else if (name.startsWith("background-")) {
      background.push(declaration);
    } else {
      extra.push(declaration);
    }
  }
  return [matrix, background.join(";"), extra.join(";")];
}

function compactFrameStyle(frameStyle, baseFrameStyle) {
  const [matrix, background, extraStyle] = frameStyle;
  if (extraStyle !== baseFrameStyle[2]) {
    return [matrix, background !== baseFrameStyle[1] ? background : null, extraStyle];
  }
  if (background !== baseFrameStyle[1]) return [matrix, background];
  return [matrix];
}

function canonicalFrameStyle([matrix, background, extraStyle]) {
  const declarations = [background, extraStyle]
    .filter(Boolean)
    .flatMap((style) => style.split(";"));
  if (matrix) {
    declarations.push(`transform:${matrix.includes("(") ? matrix : `matrix3d(${matrix})`}`);
  }
  return declarations
    .sort((left, right) => left.slice(0, left.indexOf(":"))
      .localeCompare(right.slice(0, right.indexOf(":"))))
    .join(";");
}

function requirePackedTuple(value, label) {
  if (!Array.isArray(value)
      || value.length < 1
      || value.length > 3
      || value.some((entry) => entry !== null && typeof entry !== "string")) {
    throw new Error(`${label} is invalid.`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

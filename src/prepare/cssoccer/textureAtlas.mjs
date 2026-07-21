import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { assertCssoccerTeamPreparation } from "./teamParser.mjs";

const sourceDataUrl = new URL(
  "../../../references/spain-argentina-source-data.json",
  import.meta.url,
);
const sourceData = JSON.parse(readFileSync(sourceDataUrl, "utf8"));

export const CSSOCCER_TEXTURE_ATLAS_SCHEMA = "cssoccer-texture-atlas-metadata@1";

const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 80;
const FRAME_BYTES = FRAME_WIDTH * FRAME_HEIGHT;
const PALETTE_BYTES = 16 * 3;
const EXPECTED_DECODED_ARCHIVE_HASHES = Object.freeze({
  fap: "174f02abdf04e279ce409a114124e6c38e95ff22937f26b724338a19934cc535",
  fapf: "11cdbc607713edf4a1d4b28a883fe92d55006f493b30a47573848acfdca37310",
});

export function parseCssoccerTextureAtlasMetadata({
  teamPreparation,
  fapEquBytes,
  fapDatBytes,
  fapOffBytes,
  fapfDatBytes,
  fapfOffBytes,
  threeDEngCBytes,
} = {}) {
  const descriptor = sourceData;
  assertCssoccerTeamPreparation(teamPreparation);
  validateDescriptor(descriptor);
  const fapEqu = readPinnedSource(fapEquBytes, "FAP.EQU", descriptor);
  const threeDEngC = readPinnedSource(threeDEngCBytes, "3DENG.C", descriptor);
  const decoderSourceLines = validateDecoderSource(threeDEngC.text);
  const symbols = parseEquSymbols(fapEqu.text);
  const archives = [
    parseArchive({
      id: "fap",
      dataBytes: fapDatBytes,
      indexBytes: fapOffBytes,
      symbols,
      descriptor,
    }),
    parseArchive({
      id: "fapf",
      dataBytes: fapfDatBytes,
      indexBytes: fapfOffBytes,
      symbols: null,
      descriptor,
    }),
  ];
  const entries = archives.flatMap((archive) => archive.entries);
  const animationEntries = entries.filter(({ kind }) => kind === "animation-payload");
  const paletteEntries = entries.filter(({ kind }) => kind === "palette-payload");
  const archiveDataBytes = archives.reduce((sum, archive) => sum + archive.data.bytes, 0);
  const archiveIndexBytes = archives.reduce((sum, archive) => sum + archive.index.bytes, 0);
  const recordPayloadBytes = archives.reduce((sum, archive) => sum + archive.payloadBytes, 0);
  const paddingBytes = archives.reduce((sum, archive) => sum + archive.paddingBytes, 0);
  const symbolDefinitionBytes = fapEqu.buffer.length;
  const sourceInputBytes = archiveDataBytes + archiveIndexBytes + symbolDefinitionBytes;
  const accountedBytes =
    recordPayloadBytes + paddingBytes + archiveIndexBytes + symbolDefinitionBytes;
  if (sourceInputBytes !== accountedBytes) {
    throw new Error("Texture source accounting lost " + (sourceInputBytes - accountedBytes) + " bytes.");
  }

  const decodedFrames = animationEntries.flatMap(({ decode }) => decode.frames);
  const decodedIndexedBytes = decodedFrames.length * FRAME_BYTES;
  const decodedIndexedSha256 = hashDecodedFrames(decodedFrames);
  const materials = teamPreparation.teams.map((team) => ({
    id: team.country + "-kit-material-binding",
    country: team.country,
    sourceTeamId: team.sourceTeamId,
    sourceSymbols: team.kit.symbols,
    assetSelectors: team.kit.assetSelectors,
    bindingSha256: team.kit.bindingSha256,
    browserAtlasEntryIds: [],
    status: "source-symbol-binding-payload-unsupported",
  }));

  if (
    archives[0].counts.animationEntries !== 15
    || archives[0].counts.paletteEntries !== 12
    || archives[0].counts.decodedFrames !== 452
    || archives[1].counts.animationEntries !== 2
    || archives[1].counts.paletteEntries !== 2
    || archives[1].counts.decodedFrames !== 56
    || decodedFrames.length !== 508
    || decodedIndexedBytes !== 5_201_920
  ) {
    throw new Error("Decoded FAP/FAPF frontend archive counts changed.");
  }

  return deepFreeze({
    schema: CSSOCCER_TEXTURE_ATLAS_SCHEMA,
    fixtureId: descriptor.id,
    sourceRevision: descriptor.source.revision,
    status: "decoded-frontend-indexed-frames-no-team-kit-atlas",
    counts: {
      archives: archives.length,
      entries: entries.length,
      animationEntries: animationEntries.length,
      paletteEntries: paletteEntries.length,
      unclassifiedEntries: entries.filter(({ kind }) => kind === "unclassified-payload").length,
      decodedFrames: decodedFrames.length,
      decodedIndexedBytes,
      archiveDataBytes,
      archiveIndexBytes,
      symbolDefinitionBytes,
      sourceInputBytes,
      recordPayloadBytes,
      paddingBytes,
      accountedBytes,
      unaccountedBytes: sourceInputBytes - accountedBytes,
      teamMaterialBindings: materials.length,
      browserAtlasPlacements: 0,
    },
    decodedIndexedSha256,
    archives,
    materials,
    browserAtlas: {
      placements: [],
      width: null,
      height: null,
      status: "not-built-frontend-animations-are-not-player-kit-materials",
    },
    lineage: {
      fapEqu: { file: "FAP.EQU", sha256: fapEqu.sha256 },
      decoder: {
        file: "3DENG.C",
        sha256: threeDEngC.sha256,
        lines: decoderSourceLines,
        contract:
          "128x80 base frame followed by unsigned changed-copy and unchanged-skip runs with zero terminators",
      },
    },
    unsupportedClasses: [
      {
        id: "team-kit-asset-payloads",
        reason:
          "Retail DATA.DAT and DATA.OFF are pinned, but this frontend-animation decoder does not parse their team-kit payload semantics.",
      },
      {
        id: "fapf-symbol-bindings",
        reason:
          "FAPF.EQU is absent from the pinned tree; FAPF animation and palette records are decoded structurally but retain numeric ids.",
        entryIds: entries.filter(({ archiveId }) => archiveId === "fapf").map(({ id }) => id),
      },
      {
        id: "browser-atlas-placement",
        reason:
          "FAP/FAPF are decoded frontend animations, not player kit materials; no product atlas placement is fabricated for them.",
      },
    ],
  });
}

function parseEquSymbols(source) {
  const symbols = [];
  const lines = source.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*#define\s+([A-Z][A-Z0-9_]*)\s+(\d+)\s*$/u);
    if (!match) continue;
    symbols.push({ symbol: match[1], selector: Number(match[2]), sourceLine: index + 1 });
  }
  if (symbols.length !== 27) {
    throw new Error("FAP.EQU symbol count changed: " + symbols.length + ".");
  }
  for (let index = 0; index < symbols.length; index += 1) {
    if (symbols[index].selector !== index * 8) {
      throw new Error("FAP.EQU selector " + symbols[index].symbol + " is not its record offset.");
    }
  }
  return symbols;
}

function parseArchive({ id, dataBytes, indexBytes, symbols, descriptor }) {
  const archiveDescriptor = descriptor.archives.find((archive) => archive.id === id);
  if (!archiveDescriptor) throw new Error("Static source-data does not describe " + id + ".");
  const data = readArchiveFile(dataBytes, archiveDescriptor.data);
  const index = readArchiveFile(indexBytes, archiveDescriptor.index);
  if (index.buffer.length !== archiveDescriptor.index.records * 8) {
    throw new Error(archiveDescriptor.index.name + " is not an eight-byte record table.");
  }
  if (symbols !== null && symbols.length !== archiveDescriptor.index.records) {
    throw new Error(id + " has no exact source-symbol mapping for every record.");
  }

  const entries = [];
  const paddingRanges = [];
  const decodedHash = createHash("sha256");
  let decodedFrames = 0;
  let decodedIndexedBytes = 0;
  let cursor = 0;
  for (let recordIndex = 0; recordIndex < archiveDescriptor.index.records; recordIndex += 1) {
    const offset = index.buffer.readUInt32LE(recordIndex * 8);
    const bytes = index.buffer.readUInt32LE(recordIndex * 8 + 4);
    const symbol = symbols?.[recordIndex] ?? null;
    if (offset < cursor || bytes <= 0 || offset + bytes > data.buffer.length) {
      throw new Error(id + " record " + recordIndex + " overlaps or falls outside its DAT file.");
    }
    if (offset > cursor) {
      const padding = data.buffer.subarray(cursor, offset);
      paddingRanges.push({
        byteRange: [cursor, offset],
        bytes: offset - cursor,
        sha256: sha256(padding),
      });
    }
    if (symbol !== null && symbol.selector / 8 !== recordIndex) {
      throw new Error(symbol.symbol + " no longer selects " + id + " record " + recordIndex + ".");
    }
    const payload = data.buffer.subarray(offset, offset + bytes);
    const kind = classifyRecord({ id, symbol, payload });
    let decode;
    if (kind === "animation-payload") {
      const decoded = decodeIndexedAnimation(payload, {
        archiveId: id,
        recordIndex,
        absoluteOffset: offset,
      });
      decode = decoded.output;
      decodedFrames += decoded.buffers.length;
      decodedIndexedBytes += decoded.buffers.length * FRAME_BYTES;
      for (const frame of decoded.buffers) decodedHash.update(frame);
    } else if (kind === "palette-payload") {
      decode = decodePalette(payload);
    } else {
      throw new Error(id + " record " + recordIndex + " was not structurally classified.");
    }
    entries.push({
      id: symbol === null
        ? id + ":record-" + String(recordIndex).padStart(2, "0")
        : id + ":" + symbol.symbol.toLowerCase(),
      archiveId: id,
      symbol: symbol?.symbol ?? null,
      selector: recordIndex * 8,
      recordIndex,
      kind,
      byteRange: [offset, offset + bytes],
      bytes,
      sha256: sha256(payload),
      source: symbol === null
        ? { file: archiveDescriptor.index.name, byteRange: [recordIndex * 8, recordIndex * 8 + 8] }
        : { file: "FAP.EQU", line: symbol.sourceLine },
      decode,
    });
    cursor = offset + bytes;
  }
  if (cursor < data.buffer.length) {
    const padding = data.buffer.subarray(cursor);
    paddingRanges.push({
      byteRange: [cursor, data.buffer.length],
      bytes: data.buffer.length - cursor,
      sha256: sha256(padding),
    });
    cursor = data.buffer.length;
  }

  const first = entries[0];
  const last = entries.at(-1);
  if (
    first.selector !== archiveDescriptor.index.first.selector
    || first.byteRange[0] !== archiveDescriptor.index.first.offset
    || first.bytes !== archiveDescriptor.index.first.size
    || last.selector !== archiveDescriptor.index.last.selector
    || last.byteRange[0] !== archiveDescriptor.index.last.offset
    || last.bytes !== archiveDescriptor.index.last.size
  ) {
    throw new Error(id + " archive endpoints disagree with static source-data.");
  }
  const decodedFramesSha256 = decodedHash.digest("hex");
  if (decodedFramesSha256 !== EXPECTED_DECODED_ARCHIVE_HASHES[id]) {
    throw new Error(id + " decoded frame bytes changed.");
  }
  const payloadBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const paddingBytes = paddingRanges.reduce((sum, padding) => sum + padding.bytes, 0);
  return {
    id,
    data: {
      file: archiveDescriptor.data.name,
      bytes: data.buffer.length,
      sha256: data.sha256,
    },
    index: {
      file: archiveDescriptor.index.name,
      bytes: index.buffer.length,
      records: entries.length,
      sha256: index.sha256,
      recordBytes: 8,
      endianness: "little",
    },
    counts: {
      entries: entries.length,
      animationEntries: entries.filter(({ kind }) => kind === "animation-payload").length,
      paletteEntries: entries.filter(({ kind }) => kind === "palette-payload").length,
      decodedFrames,
      decodedIndexedBytes,
    },
    decodedFramesSha256,
    payloadBytes,
    paddingBytes,
    accountedDataBytes: payloadBytes + paddingBytes,
    unaccountedDataBytes: data.buffer.length - payloadBytes - paddingBytes,
    paddingRanges,
    entries,
  };
}

function classifyRecord({ id, symbol, payload }) {
  if (symbol?.symbol.startsWith("COL_")) {
    if (payload.length !== PALETTE_BYTES) {
      throw new Error(symbol.symbol + " is not a 16-color RGB source palette.");
    }
    return "palette-payload";
  }
  if (symbol !== null) {
    if (!symbol.symbol.startsWith("FAP_") || payload.length < FRAME_BYTES + 1) {
      throw new Error(symbol.symbol + " is not a source-labelled FAP animation.");
    }
    return "animation-payload";
  }
  if (id === "fapf" && payload.length === PALETTE_BYTES) return "palette-payload";
  if (id === "fapf" && payload.length >= FRAME_BYTES + 1) return "animation-payload";
  return "unclassified-payload";
}

function decodeIndexedAnimation(payload, { archiveId, recordIndex, absoluteOffset }) {
  if (payload.length < FRAME_BYTES + 1) {
    throw new Error(archiveId + " record " + recordIndex + " lacks a base frame and terminator.");
  }
  const buffers = [Buffer.from(payload.subarray(0, FRAME_BYTES))];
  const frames = [decodedFrameOutput({
    index: 0,
    pixels: buffers[0],
    encodedByteRange: [absoluteOffset, absoluteOffset + FRAME_BYTES],
    encoding: "base-indexed8-frame",
  })];
  let position = FRAME_BYTES;
  let sequenceTerminatorOffset = null;
  while (position < payload.length) {
    if (payload[position] === 0) {
      sequenceTerminatorOffset = position;
      position += 1;
      break;
    }
    const encodedStart = position;
    const output = Buffer.from(buffers.at(-1));
    let pixelOffset = 0;
    let packetCount = 0;
    while (true) {
      if (position >= payload.length) {
        throw new Error(archiveId + " record " + recordIndex + " ends inside a delta frame.");
      }
      const changedCopyCount = payload[position++];
      if (changedCopyCount === 0) break;
      if (
        position + changedCopyCount > payload.length
        || pixelOffset + changedCopyCount > FRAME_BYTES
      ) {
        throw new Error(archiveId + " record " + recordIndex + " has an out-of-bounds changed run.");
      }
      payload.copy(output, pixelOffset, position, position + changedCopyCount);
      position += changedCopyCount;
      pixelOffset += changedCopyCount;
      if (position >= payload.length) {
        throw new Error(archiveId + " record " + recordIndex + " omits an unchanged skip run.");
      }
      pixelOffset += payload[position++];
      if (pixelOffset > FRAME_BYTES) {
        throw new Error(archiveId + " record " + recordIndex + " has an out-of-bounds skip run.");
      }
      packetCount += 1;
    }
    buffers.push(output);
    frames.push(decodedFrameOutput({
      index: frames.length,
      pixels: output,
      encodedByteRange: [absoluteOffset + encodedStart, absoluteOffset + position],
      encoding: "changed-copy-then-unchanged-skip-runs",
      packetCount,
    }));
  }
  if (sequenceTerminatorOffset === null) {
    throw new Error(archiveId + " record " + recordIndex + " omits its sequence terminator.");
  }
  if ([...payload.subarray(position)].some((value) => value !== 0)) {
    throw new Error(archiveId + " record " + recordIndex + " has nonzero bytes after its terminator.");
  }
  const aggregateHash = createHash("sha256");
  for (const frame of buffers) aggregateHash.update(frame);
  return {
    buffers,
    output: {
      status: "decoded-indexed8-frame-sequence",
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      pixelFormat: "indexed8",
      frameCount: frames.length,
      decodedBytes: frames.length * FRAME_BYTES,
      decodedFramesSha256: aggregateHash.digest("hex"),
      sequenceTerminatorByteRange: [
        absoluteOffset + sequenceTerminatorOffset,
        absoluteOffset + sequenceTerminatorOffset + 1,
      ],
      trailingZeroBytes: payload.length - position,
      frames,
    },
  };
}

function decodedFrameOutput({ index, pixels, encodedByteRange, encoding, packetCount = null }) {
  return {
    index,
    encoding,
    encodedByteRange,
    encodedPacketCount: packetCount,
    decodedBytes: pixels.length,
    sha256: sha256(pixels),
    indexedPixelsBase64: pixels.toString("base64"),
  };
}

function decodePalette(payload) {
  if (payload.length !== PALETTE_BYTES) {
    throw new Error("FAP palette does not contain 16 RGB triples.");
  }
  if ([...payload].some((component) => component > 63)) {
    throw new Error("FAP palette contains a component outside the source six-bit DAC range.");
  }
  return {
    status: "decoded-source-rgb6-palette",
    colors: Array.from({ length: 16 }, (_, colorIndex) => (
      Array.from(payload.subarray(colorIndex * 3, colorIndex * 3 + 3))
    )),
    colorCount: 16,
    componentEncoding: "unsigned-byte-values-in-source-0-to-63-dac-range",
    bytes: payload.length,
    sha256: sha256(payload),
    sourceBytesBase64: payload.toString("base64"),
  };
}

function hashDecodedFrames(frames) {
  const hash = createHash("sha256");
  for (const frame of frames) hash.update(Buffer.from(frame.indexedPixelsBase64, "base64"));
  return hash.digest("hex");
}

function validateDecoderSource(source) {
  const required = [
    [/#define FRM_WID 128/u, "128-pixel frame width"],
    [/#define FRM_HGT 80/u, "80-pixel frame height"],
    [/memcpy\(buffp,animp,FRM_WID\)/u, "full base-frame copy"],
    [/while \(tval=\*animp\+\+\)/u, "changed-copy run loop"],
    [/while \(tval--\) \(\*buffp\+\+\) = \(\*animp\+\+\);/u, "changed pixel copy"],
    [/tval=\*animp\+\+;/u, "unchanged skip count"],
    [/while \(tval--\) buffp\+\+;/u, "unchanged pixel skip"],
  ];
  for (const [pattern, label] of required) {
    if (!pattern.test(source)) throw new Error("3DENG.C changed its " + label + ".");
  }
  return {
    dimensions: [findLine(source, /^\s*#define FRM_WID 128$/u, "FRM_WID"), findLine(source, /^\s*#define FRM_HGT 80$/u, "FRM_HGT")],
    baseFrame: findLine(source, /^\s*memcpy\(buffp,animp,FRM_WID\);/u, "base frame copy"),
    deltaLoop: [
      findLine(source, /^\s*while \(tval=\*animp\+\+\)$/u, "delta loop"),
      findLine(source, /^\s*anim\.frmptr=animp;/u, "delta loop publication"),
    ],
  };
}

function validateDescriptor(descriptor) {
  if (
    descriptor?.schema !== "cssoccer-static-source-data@1"
    || descriptor.id !== "spain-argentina-full-match"
    || descriptor.archiveFormat?.indexRecordBytes !== 8
    || descriptor.archiveFormat?.endianness !== "little"
    || descriptor.archives?.find(({ id }) => id === "fap")?.index?.records !== 27
    || descriptor.archives?.find(({ id }) => id === "fapf")?.index?.records !== 4
    || descriptor.source?.retailGameDataArchive?.files?.length !== 2
  ) {
    throw new Error("Texture preparation requires the fixed frontend archives and missing-team-data contract.");
  }
}

function findLine(source, pattern, label) {
  const lines = source.split(/\r?\n/u);
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) throw new Error("Could not locate " + label + " in pinned source.");
  return index + 1;
}

function readPinnedSource(value, file, descriptor) {
  const expected = descriptor.source.files.find(({ name }) => name === file);
  if (!expected) throw new Error("Static source-data does not pin " + file + ".");
  const buffer = toBuffer(value, file);
  const digest = sha256(buffer);
  if (buffer.length !== expected.bytes || digest !== expected.sha256) {
    throw new Error(file + " does not match the pinned source descriptor.");
  }
  return { buffer, text: buffer.toString("latin1"), sha256: digest };
}

function readArchiveFile(value, expected) {
  const buffer = toBuffer(value, expected.name);
  const digest = sha256(buffer);
  if (buffer.length !== expected.bytes || digest !== expected.sha256) {
    throw new Error(expected.name + " does not match the pinned archive descriptor.");
  }
  return { buffer, sha256: digest };
}

function toBuffer(value, label) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError(label + " must be supplied as source bytes.");
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

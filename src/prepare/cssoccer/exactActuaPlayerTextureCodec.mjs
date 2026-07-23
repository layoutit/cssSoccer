import { deflateSync, inflateSync } from "node:zlib";

import { decodeActuaOffsetArchive } from "./formatAdapters.mjs";

const TEXTURE_RECORD_BYTES = 32;

/** Assemble the exact fixture player table during preparation. */
export function prepareExactActuaPlayerTextureTable({
  euroRendDatBytes,
  euroRendOffBytes,
  retailActRendDatBytes,
  retailActRendOffBytes,
}) {
  const exact = decodeActuaOffsetArchive({
    dataBytes: requireBytes(euroRendDatBytes, "exact EUROREND.DAT"),
    indexBytes: requireBytes(euroRendOffBytes, "exact EUROREND.OFF"),
    label: "Actua exact renderer",
  });
  const retail = decodeActuaOffsetArchive({
    dataBytes: requireBytes(retailActRendDatBytes, "retail ACTREND.DAT"),
    indexBytes: requireBytes(retailActRendOffBytes, "retail ACTREND.OFF"),
    label: "Actua retail renderer",
  });
  const matchBytes = exact.recordBytes(8);
  const playerBytes = exact.recordBytes(16);
  const retailBytes = retail.recordBytes(8);
  const firstNumberByte = (549 - 1) * TEXTURE_RECORD_BYTES;
  if (
    matchBytes.length !== 1_006 * TEXTURE_RECORD_BYTES
    || playerBytes.length !== 573 * TEXTURE_RECORD_BYTES
    || retailBytes.length !== matchBytes.length
  ) throw new Error("Exact fixture player texture-table records changed.");
  const output = Buffer.from(matchBytes);
  playerBytes.copy(output, 0, 0, firstNumberByte);
  retailBytes.copy(output, firstNumberByte, firstNumberByte, output.length);
  return output;
}

/** Assemble the canonical demo-base table plus every retained retail extension. */
export function prepareExactActuaOfficialTextureTable({
  actRendDatBytes,
  actRendOffBytes,
  retailActRendDatBytes,
  retailActRendOffBytes,
}) {
  const demo = decodeActuaOffsetArchive({
    dataBytes: requireBytes(actRendDatBytes, "demo ACTREND.DAT"),
    indexBytes: requireBytes(actRendOffBytes, "demo ACTREND.OFF"),
    label: "Actua demo renderer",
  });
  const retail = decodeActuaOffsetArchive({
    dataBytes: requireBytes(retailActRendDatBytes, "retail ACTREND.DAT"),
    indexBytes: requireBytes(retailActRendOffBytes, "retail ACTREND.OFF"),
    label: "Actua retail renderer",
  });
  const demoBytes = demo.recordBytes(8);
  const retailBytes = retail.recordBytes(8);
  if (
    demoBytes.length !== 573 * TEXTURE_RECORD_BYTES
    || retailBytes.length !== 1_006 * TEXTURE_RECORD_BYTES
  ) {
    throw new Error("Exact official texture-table record counts changed.");
  }
  const output = Buffer.from(retailBytes);
  demoBytes.copy(output, 0);
  return output;
}

/** Decode one native texture record into its source crop and corner order. */
export function decodeExactActuaTextureRecord(nativeTextureSlot, bytes) {
  if (bytes.length !== TEXTURE_RECORD_BYTES) {
    throw new Error(`Exact match texture slot ${nativeTextureSlot} is unavailable.`);
  }
  const rawWords = Array.from({ length: 8 }, (_, index) => bytes.readUInt32LE(index * 4));
  const v = rawWords.slice(0, 4).map((word) => (word & 0x00ff_ffff) / 0x0001_0000);
  const u = rawWords.slice(4).map((word) => (word & 0x00ff_ffff) / 0x0001_0000);
  const pages = new Set(rawWords.slice(0, 4).map((word) => word >>> 24));
  const page = rawWords[0] >>> 24;
  const minU = Math.min(...u);
  const maxU = Math.max(...u);
  const minV = Math.min(...v);
  const maxV = Math.max(...v);
  const sourceRect = Object.freeze({
    x: Math.round(minU),
    y: Math.round(minV),
    width: Math.round(maxU - minU),
    height: Math.round(maxV - minV),
  });
  if (pages.size !== 1 || sourceRect.width <= 0 || sourceRect.height <= 0) {
    throw new Error(`Exact match texture slot ${nativeTextureSlot} is not an axis-aligned quad.`);
  }
  const sourceCorners = [
    [sourceRect.x, sourceRect.y],
    [sourceRect.x + sourceRect.width, sourceRect.y],
    [sourceRect.x + sourceRect.width, sourceRect.y + sourceRect.height],
    [sourceRect.x, sourceRect.y + sourceRect.height],
  ];
  const projectedCornerBySourceCorner = sourceCorners.map(([sourceU, sourceV]) => {
    const index = u.findIndex((value, candidateIndex) => (
      Math.abs(value - sourceU) <= 1 / 0x0001_0000
      && Math.abs(v[candidateIndex] - sourceV) <= 1 / 0x0001_0000
    ));
    if (index < 0) {
      throw new Error(`Exact match texture slot ${nativeTextureSlot} has an unbound corner.`);
    }
    return index;
  });
  if (new Set(projectedCornerBySourceCorner).size !== 4) {
    throw new Error(`Exact match texture slot ${nativeTextureSlot} orientation is ambiguous.`);
  }
  return { page, sourceRect, rawWords: Object.freeze(rawWords), projectedCornerBySourceCorner };
}

/** Decode deterministic filter-zero 8-bit RGBA PNG bytes. */
export function decodeFilterZeroRgbaPng(bytes) {
  const input = requireBytes(bytes, "source atlas PNG");
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!input.subarray(0, 8).equals(signature)) throw new Error("Source atlas is not a PNG.");
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString("ascii", offset + 4, offset + 8);
    const payload = input.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      if (payload[8] !== 8 || payload[9] !== 6) {
        throw new Error("Source atlas PNG must be 8-bit RGBA.");
      }
    } else if (type === "IDAT") idat.push(payload);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  const scanlines = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  if (scanlines.length !== height * (stride + 1)) {
    throw new Error("Source atlas PNG scanline size changed.");
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const source = y * (stride + 1);
    if (scanlines[source] !== 0) {
      throw new Error("Source atlas PNG filter changed from deterministic filter zero.");
    }
    scanlines.copy(rgba, y * stride, source + 1, source + 1 + stride);
  }
  return { width, height, rgba };
}

/** Encode deterministic filter-zero 8-bit RGBA PNG bytes. */
export function encodeRgbaPng(width, height, rgba) {
  if (!Number.isSafeInteger(width) || width <= 0
      || !Number.isSafeInteger(height) || height <= 0) {
    throw new TypeError("RGBA PNG dimensions must be positive integers.");
  }
  const input = requireBytes(rgba, "RGBA pixels");
  if (input.length !== width * height * 4) {
    throw new Error("RGBA PNG pixel byte count changed.");
  }
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const target = y * (1 + width * 4);
    input.copy(scanlines, target + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, payload) {
  const name = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + payload.length);
  output.writeUInt32BE(payload.length, 0);
  name.copy(output, 4);
  payload.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, payload])), 8 + payload.length);
  return output;
}

function crc32(bytes) {
  let crc = 0xffff_ffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function requireBytes(value, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${label} must be bytes.`);
  }
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

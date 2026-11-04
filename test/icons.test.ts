import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

// The home-screen icons are pngs with no source in the repo, so the one thing
// that keeps them a set lives here. 13e03bc ("bolder app icon") grew the mark
// on icon-192 and icon-512 from 34.4% of the tile to 59.4% and left
// apple-touch-icon.png behind at the favicon's proportion, which is the icon
// ios puts on a home screen: two of three updated, nothing to say so. Read off
// the pixels rather than the file size, since that is where the drift is.
const ICONS = ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-512-maskable.png"];
const MARK_FRACTION = 0.59375; // 114/192 and 304/512, the proportion 13e03bc set
const TOLERANCE = 0.01; // antialiasing on a fractional radius, ~0.5px a side at 180

/** Decode an 8-bit non-interlaced rgb/rgba png to its raw pixel bytes. */
function decodePng(buf: Buffer): { width: number; height: number; channels: number; px: Buffer } {
  let off = 8; // past the signature
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8]!;
      colour = data[9]!;
      interlace = data[12]!;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len; // length + type + data + crc
  }
  if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) {
    throw new Error(`unsupported png: depth ${depth}, colour type ${colour}, interlace ${interlace}`);
  }
  const channels = colour === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(height * stride);
  // Undo the per-scanline filter: every byte is coded against its left (a),
  // above (b) and above-left (c) neighbour, so the rows reconstruct in order.
  for (let y = 0, pos = 0; y < height; y++) {
    const filter = raw[pos++]!;
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++, pos++) {
      const a = i >= channels ? cur[i - channels]! : 0;
      const b = prev ? prev[i]! : 0;
      const c = prev && i >= channels ? prev[i - channels]! : 0;
      let v = raw[pos]!;
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`unknown png filter ${filter}`);
      cur[i] = v & 0xff;
    }
  }
  return { width, height, channels, px };
}

/** The mark's bounding box and the tile's lowest alpha, in pixels. */
function readIcon(file: string) {
  const img = decodePng(readFileSync(fileURLToPath(new URL(`../public/favicons/${file}`, import.meta.url))));
  const at = (x: number, y: number): number[] => {
    const i = (y * img.width + x) * img.channels;
    return [img.px[i]!, img.px[i + 1]!, img.px[i + 2]!, img.channels === 4 ? img.px[i + 3]! : 255];
  };
  // The tile colour is whatever the corner is, so nothing here names a hex:
  // the palette is contract (test/contract.test.ts), the geometry is not.
  const tile = at(0, 0);
  let minX = img.width;
  let maxX = -1;
  let minY = img.height;
  let maxY = -1;
  let minAlpha = 255;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const p = at(x, y);
      minAlpha = Math.min(minAlpha, p[3]!);
      const off = Math.abs(p[0]! - tile[0]!) + Math.abs(p[1]! - tile[1]!) + Math.abs(p[2]! - tile[2]!);
      if (p[3]! > 128 && off > 30) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { width: img.width, height: img.height, minAlpha, mark: maxX - minX + 1, cx: (minX + maxX + 1) / 2 };
}

describe("home screen icons", () => {
  it.each(ICONS)("%s is a square opaque tile carrying the mark at one proportion", (file) => {
    const icon = readIcon(file);
    expect(icon.width, `${file} is not square`).toBe(icon.height);
    // A launcher masks the tile to its own shape, so the art goes edge to edge
    // and the corners are the system's to cut: a pre-rounded icon is a png
    // with transparent corners where the tile should be.
    expect(icon.minAlpha, `${file} has transparent pixels; home screen tiles are opaque`).toBe(255);
    expect(icon.cx, `${file}'s mark is off centre`).toBe(icon.width / 2);
    const fraction = icon.mark / icon.width;
    expect(
      Math.abs(fraction - MARK_FRACTION),
      `${file} draws the mark at ${(fraction * 100).toFixed(1)}% of the tile, the others at ${MARK_FRACTION * 100}%`,
    ).toBeLessThanOrEqual(TOLERANCE);
  });
});

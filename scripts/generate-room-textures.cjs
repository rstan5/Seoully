"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function pngGray(width, height, sample) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[(width + 1) * y] = 0;
    for (let x = 0; x < width; x += 1) raw[(width + 1) * y + 1 + x] = sample(x, y);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hash(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function wrapCell(value, period) {
  return ((value % period) + period) % period;
}

function wrapValueNoise(x, y, cellSize, seed, width, height) {
  if (width % cellSize !== 0 || height % cellSize !== 0) {
    throw new Error(`cellSize ${cellSize} must divide ${width}x${height}`);
  }
  const xs = x / cellSize;
  const ys = y / cellSize;
  const cellsX = width / cellSize;
  const cellsY = height / cellSize;
  const x0 = Math.floor(xs);
  const y0 = Math.floor(ys);
  const fx = xs - x0;
  const fy = ys - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(wrapCell(x0, cellsX), wrapCell(y0, cellsY), seed);
  const b = hash(wrapCell(x0 + 1, cellsX), wrapCell(y0, cellsY), seed);
  const c = hash(wrapCell(x0, cellsX), wrapCell(y0 + 1, cellsY), seed);
  const d = hash(wrapCell(x0 + 1, cellsX), wrapCell(y0 + 1, cellsY), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

const outDir = path.join(__dirname, "../apps/mobile/assets/room");
fs.mkdirSync(outDir, { recursive: true });

const files = {
  "plaster.png": pngGray(512, 512, (x, y) => {
    const n =
      wrapValueNoise(x, y, 64, 1, 512, 512) * 0.42 +
      wrapValueNoise(x, y, 16, 2, 512, 512) * 0.36 +
      wrapValueNoise(x, y, 8, 3, 512, 512) * 0.22;
    return clampByte(190 + (n - 0.5) * 18);
  }),
  "wood-floor.png": pngGray(512, 512, (x, y) => {
    const plankCount = 8;
    const plank = Math.floor((x / 512) * plankCount);
    const local = (x / 512) * plankCount - plank;
    const edge = Math.min(local, 1 - local);
    const seam = edge < 0.045 ? 0.86 + (edge / 0.045) * 0.14 : 1;
    const tone = 0.97 + (hash(plank, 0, 13) - 0.5) * 0.08;
    const grain =
      wrapValueNoise(x, y, 16, 20 + plank, 512, 512) * 0.4 +
      wrapValueNoise(x, y, 32, 21 + plank, 512, 512) * 0.3 +
      wrapValueNoise(x, y, 8, 22 + plank, 512, 512) * 0.3;
    const ring = Math.sin((y + wrapValueNoise(x, y, 64, 23, 512, 512) * 22) * 0.038);
    return clampByte((174 + (grain - 0.5) * 22 + ring * 7) * tone * seam);
  }),
  "wood-fine.png": pngGray(512, 512, (x, y) => {
    const grain =
      wrapValueNoise(x, y, 16, 7, 512, 512) * 0.62 +
      wrapValueNoise(x, y, 32, 8, 512, 512) * 0.26 +
      wrapValueNoise(x, y, 8, 9, 512, 512) * 0.12;
    const stripe = Math.sin((y + wrapValueNoise(x, y, 64, 10, 512, 512) * 10) * 0.09);
    return clampByte(186 + (grain - 0.5) * 18 + stripe * 4);
  }),
  "fabric.png": pngGray(256, 256, (x, y) => {
    const weave = ((x % 4 < 2 ? 1 : 0) + (y % 4 < 2 ? 1 : 0)) * 0.5;
    const n = wrapValueNoise(x, y, 8, 11, 256, 256);
    return clampByte(176 + weave * 14 + (n - 0.5) * 10);
  }),
  "cardboard.png": pngGray(128, 128, (x, y) => {
    const n = wrapValueNoise(x, y, 8, 12, 128, 128) * 0.65 + wrapValueNoise(x, y, 16, 13, 128, 128) * 0.35;
    return clampByte(172 + (n - 0.5) * 26);
  }),
  "vinyl.png": pngGray(128, 128, (x, y) => {
    const n = wrapValueNoise(x, y, 16, 14, 128, 128);
    return clampByte(190 + (n - 0.5) * 10);
  }),
  "paper.png": pngGray(128, 128, (x, y) => {
    const n = wrapValueNoise(x, y, 8, 15, 128, 128);
    return clampByte(196 + (n - 0.5) * 8);
  }),
};

for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(name, buf.length);
}

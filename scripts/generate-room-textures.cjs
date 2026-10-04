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

function valueNoise(x, y, scale, seed) {
  const xs = x / scale;
  const ys = y / scale;
  const x0 = Math.floor(xs);
  const y0 = Math.floor(ys);
  const fx = xs - x0;
  const fy = ys - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

const outDir = path.join(__dirname, "../apps/mobile/assets/room");
fs.mkdirSync(outDir, { recursive: true });

const files = {
  "plaster.png": pngGray(256, 256, (x, y) => {
    const n = valueNoise(x, y, 18, 1) * 0.55 + valueNoise(x, y, 6, 2) * 0.45;
    return clampByte(188 + (n - 0.5) * 22);
  }),
  "wood-floor.png": pngGray(256, 256, (x, y) => {
    const grain = valueNoise(x * 0.35, y, 7, 4) * 0.7 + valueNoise(x, y, 28, 5) * 0.3;
    const ring = Math.sin((y + valueNoise(x, y, 40, 6) * 18) * 0.11);
    return clampByte(176 + (grain - 0.5) * 28 + ring * 10);
  }),
  "wood-fine.png": pngGray(256, 256, (x, y) => {
    const grain = valueNoise(x * 0.45, y, 5, 7);
    return clampByte(186 + (grain - 0.5) * 16);
  }),
  "fabric.png": pngGray(128, 128, (x, y) => {
    const weave = ((x % 4 < 2 ? 1 : 0) + (y % 4 < 2 ? 1 : 0)) * 0.5;
    const n = valueNoise(x, y, 5, 8);
    return clampByte(178 + weave * 10 + (n - 0.5) * 12);
  }),
  "cardboard.png": pngGray(128, 128, (x, y) => {
    const n = valueNoise(x, y, 4, 9) * 0.65 + valueNoise(x, y, 11, 10) * 0.35;
    return clampByte(172 + (n - 0.5) * 26);
  }),
  "vinyl.png": pngGray(128, 128, (x, y) => {
    const n = valueNoise(x, y, 8, 11);
    return clampByte(190 + (n - 0.5) * 10);
  }),
  "paper.png": pngGray(128, 128, (x, y) => {
    const n = valueNoise(x, y, 6, 12);
    return clampByte(196 + (n - 0.5) * 8);
  }),
};

for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(name, buf.length);
}

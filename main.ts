// Post the Meme, Win the Feed — u-myronera-post-the-meme-win-the-feed-2de960bf
// Node 22+, standard library only.
//
// The entry is the X post itself: the house reads the post's likes, reposts
// and quotes after the deadline (score = likes + reposts + quotes). This
// program does two deterministic things, writing ONLY to $MAKEFUN_OUTPUT_DIR:
//   1. copies POST.json from the repository root to <output>/POST.json
//      (the gate reads the post's address from it);
//   2. renders the meme picture (meme.png, 1200x675) from typed code — a
//      hand-drawn 5x7 bitmap font on a pixel buffer, encoded as PNG with
//      node:zlib. No downloaded assets, no randomness, no timestamps, so
//      every run writes byte-identical files.
//
// The meme (decided in-session, for AI agent builders):
//   "MY AGENT SAID: JUST ONE BOUNTY"
//   "ME AT 3AM: 27 bounties entered / 14 agents running /
//    leaderboard #4,798 / earnings $0.00 — still worth it."
// It lands on what make.fun is: agents entering bounties, topping a
// leaderboard, getting paid — the joke every builder sends another builder.
//
// Run locally:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// ---------------------------------------------------------------------------
// 5x7 bitmap font (rows are 5 chars: '#' = ink, ' ' = blank).
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '00100', '00000', '00000', '00000', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00100', '00100'],
  ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

// ---------------------------------------------------------------------------
// Pixel buffer + drawing helpers (RGB, 1200x675).
// ---------------------------------------------------------------------------
const W = 1200;
const H = 675;

type RGB = [number, number, number];
const NAVY: RGB = [10, 15, 30];
const CARD: RGB = [20, 27, 48];
const GREEN: RGB = [34, 197, 94];
const WHITE: RGB = [240, 244, 255];
const MUTED: RGB = [148, 163, 196];
const GOLD: RGB = [250, 204, 21];
const RED: RGB = [248, 113, 113];

const px = new Uint8Array(W * H * 3);

function fillRect(x0: number, y0: number, w: number, h: number, c: RGB): void {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= W) continue;
      const i = (y * W + x) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function drawDot(x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale; // 5px glyph + 1px gap, per char
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[r][col] === '1') {
          fillRect(cx + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(y: number, s: string, scale: number, c: RGB): void {
  drawText(Math.floor((W - textWidth(s, scale)) / 2), y, s, scale, c);
}

// ---------------------------------------------------------------------------
// PNG encoding (color type 2, RGB, filter 0 per scanline), deterministic.
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// The meme.
// ---------------------------------------------------------------------------
function renderMeme(): void {
  fillRect(0, 0, W, H, NAVY);

  // Subtle dot grid.
  for (let gy = 24; gy < H; gy += 48) {
    for (let gx = 24; gx < W; gx += 48) {
      drawDot(gx, gy, [24, 32, 56]);
    }
  }

  // Header: green "mf" badge + make.fun wordmark, right side tag.
  fillRect(56, 44, 64, 64, GREEN);
  drawText(72, 62, 'MF', 4, NAVY);
  drawText(140, 58, 'MAKE.FUN', 5, WHITE);
  drawText(140, 102, 'WHERE AGENTS COMPETE', 2, MUTED);
  drawText(W - 56 - textWidth('BOUNTY MODE: ON', 2), 66, 'BOUNTY MODE: ON', 2, GREEN);

  // Green rule under header.
  fillRect(56, 132, W - 112, 4, GREEN);

  // Setup line + punchline.
  drawTextCentered(168, 'MY AGENT SAID:', 4, MUTED);
  drawTextCentered(212, '"JUST ONE BOUNTY"', 7, WHITE);
  drawTextCentered(286, 'FAMOUS LAST WORDS.', 3, GOLD);
  // Gold underline under the punchline, so the joke lands at a glance.
  fillRect(
    Math.floor((W - textWidth('FAMOUS LAST WORDS.', 3)) / 2),
    318,
    textWidth('FAMOUS LAST WORDS.', 3),
    4,
    GOLD,
  );

  // The 3AM card.
  fillRect(140, 344, W - 280, 212, CARD);
  // Card border (green, 4px).
  fillRect(140, 344, W - 280, 4, GREEN);
  fillRect(140, 552, W - 280, 4, GREEN);
  fillRect(140, 344, 4, 212, GREEN);
  fillRect(W - 144, 344, 4, 212, GREEN);

  drawText(180, 366, 'ME AT 3AM:', 4, GREEN);
  drawText(180, 412, '- 27 BOUNTIES ENTERED', 3, WHITE);
  drawText(180, 448, '- 14 AGENTS RUNNING', 3, WHITE);
  drawText(180, 484, '- LEADERBOARD: #4,798', 3, WHITE);
  drawText(180, 520, '- EARNINGS: $0.00', 3, RED);

  // Footer.
  drawTextCentered(592, 'STILL WORTH IT. PECAH TELUR SOON.', 3, GREEN);
  drawTextCentered(632, 'SEND THIS TO A BUILDER WHO NEEDS IT.', 2, MUTED);
}

// ---------------------------------------------------------------------------
// Entry point: write ONLY to $MAKEFUN_OUTPUT_DIR.
// ---------------------------------------------------------------------------
function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. The meme picture, rendered from typed code.
  renderMeme();
  writeFileSync(join(OUTPUT_DIR, 'meme.png'), encodePNG());

  // 2. POST.json: the post's address, which the gate reads.
  try {
    copyFileSync(join(BOT_DIR, 'POST.json'), join(OUTPUT_DIR, 'POST.json'));
  } catch (err) {
    console.error(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();

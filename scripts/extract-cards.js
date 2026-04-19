// scripts/extract-cards.js
// Run with: node scripts/extract-cards.js
// Requires: npm install sharp
// Extracts 40 card images from IMG_8051.jpeg, masking the number badge and year text.

import sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'IMG_8051.jpeg');
const OUT  = path.join(ROOT, 'public', 'images', 'cards');

// Grid boundaries (verified by pixel analysis on 1179×1447 source)
const COLS = [
  [58,  262],
  [279, 480],
  [499, 700],
  [717, 918],
  [936, 1136],
];
const ROWS = [
  [336, 458],
  [462, 587],
  [597, 718],
  [728, 848],
  [858, 977],
  [985, 1111],
  [1123,1234],
  [1262,1373],
];

// Card background fill colour (warm off-white matching card interior)
const BG = { r: 235, g: 233, b: 229, alpha: 255 };

await fs.mkdir(OUT, { recursive: true });

let cardNum = 1;
for (const [ry1, ry2] of ROWS) {
  for (const [cx1, cx2] of COLS) {
    const cw = cx2 - cx1;
    const ch = ry2 - ry1;

    // SVG overlay: white rectangles over badge (top-left) and year (bottom strip)
    const yearStart = 69;
    const svg = `<svg width="${cw}" height="${ch}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="36" height="21" fill="rgb(235,233,229)"/>
      <rect x="0" y="${yearStart}" width="${cw}" height="${ch - yearStart}" fill="rgb(235,233,229)"/>
    </svg>`;

    const outFile = path.join(OUT, `card-${String(cardNum).padStart(2,'0')}.png`);
    await sharp(SRC)
      .extract({ left: cx1, top: ry1, width: cw, height: ch })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toFile(outFile);

    console.log(`✅ card-${String(cardNum).padStart(2,'0')}.png  (${cw}×${ch})`);
    cardNum++;
  }
}
console.log(`\nExtracted ${cardNum - 1} cards to ${OUT}`);

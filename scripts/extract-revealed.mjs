// Extracts 40 unmasked card images (with number badge + year visible)
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'IMG_8051.jpeg');
const OUT  = path.join(ROOT, 'public', 'images', 'cards-revealed');

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

await fs.mkdir(OUT, { recursive: true });

let cardNum = 1;
for (const [ry1, ry2] of ROWS) {
  for (const [cx1, cx2] of COLS) {
    const outFile = path.join(OUT, `card-${String(cardNum).padStart(2,'0')}.png`);
    await sharp(SRC)
      .extract({ left: cx1, top: ry1, width: cx2 - cx1, height: ry2 - ry1 })
      .png()
      .toFile(outFile);
    process.stdout.write(`✅ card-${String(cardNum).padStart(2,'0')}.png\n`);
    cardNum++;
  }
}
console.log(`\nExtracted ${cardNum - 1} revealed cards to ${OUT}`);

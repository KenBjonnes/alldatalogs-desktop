/*
 * make-icon.mjs — renders build/icon.svg into build/icon.png (256) and build/icon.ico (16…256, PNG
 * entries) using the Electron we already ship, via Playwright and an in-page canvas. No image
 * libraries to install, no window ever shown.
 *
 *   node scripts/make-icon.mjs
 */
import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BUILD = join(here, '..', 'build');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

const svg = readFileSync(join(BUILD, 'icon.svg'), 'utf8');
const svgUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const app = await electron.launch({ executablePath: electronPath, args: [join(here, 'icon-main.js')] });
const page = await app.firstWindow();
await page.setContent('<canvas id="c"></canvas>');
const pngs = new Map();
for (const s of SIZES) {
  const dataUrl = await page.evaluate(async ({ svgUrl, s }) => {
    const img = new Image();
    img.src = svgUrl;
    await img.decode();
    const c = document.getElementById('c');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, s, s);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, s, s);
    return c.toDataURL('image/png');
  }, { svgUrl, s });
  pngs.set(s, Buffer.from(dataUrl.split(',')[1], 'base64'));
}
await app.close();

writeFileSync(join(BUILD, 'icon.png'), pngs.get(256));

// ICO container with PNG-compressed entries (supported since Windows Vista).
const entries = SIZES.map((s) => ({ s, buf: pngs.get(s) }));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
const dir = Buffer.alloc(16 * entries.length);
let offset = 6 + dir.length;
entries.forEach(({ s, buf }, i) => {
  const o = i * 16;
  dir.writeUInt8(s >= 256 ? 0 : s, o);      // width (0 = 256)
  dir.writeUInt8(s >= 256 ? 0 : s, o + 1);  // height
  dir.writeUInt8(0, o + 2);                 // palette
  dir.writeUInt8(0, o + 3);                 // reserved
  dir.writeUInt16LE(1, o + 4);              // planes
  dir.writeUInt16LE(32, o + 6);             // bpp
  dir.writeUInt32LE(buf.length, o + 8);
  dir.writeUInt32LE(offset, o + 12);
  offset += buf.length;
});
writeFileSync(join(BUILD, 'icon.ico'), Buffer.concat([header, dir, ...entries.map((e) => e.buf)]));
console.log(`wrote build/icon.png (256) and build/icon.ico (${SIZES.join(',')})`);

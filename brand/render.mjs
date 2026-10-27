// Renders the brand kit into brand/out/: 3D logo (avatar + transparent), X header, link preview.
// Needs a static server on the repo root:  python3 -m http.server 8766   then   node brand/render.mjs
// (playwright + Chromium; set CHROMIUM=/path if not the default)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out') + '/';
const BASE = process.env.BASE || 'http://127.0.0.1:8766';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const save = (file, dataUrl) => { fs.writeFileSync(OUT + file, Buffer.from(dataUrl.split(',')[1], 'base64')); console.log('wrote', file); };

async function logo(qs, file, size) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.goto(`${BASE}/brand/logo3d.html?size=${size}&${qs}`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 180000 });
  save(file, await p.evaluate(() => window.__png()));
  await p.close();
}
async function cover(kind, w, h, file, scale = 2) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await p.goto(`${BASE}/brand/cover.html?kind=${kind}`);
  await p.evaluate(() => window.__ready);
  await p.locator('#c').screenshot({ path: OUT + file });
  console.log('wrote', file);
  await p.close();
}
await logo('bg=1&dist=760', 'logo3d_avatar.png', 1024);
await logo('bg=0&dist=780', 'logo3d_transparent.png', 1024);
await cover('x', 1500, 500, 'x_header@2x.png');
await cover('x', 1500, 500, 'x_header.png', 1);
await cover('og', 1200, 630, 'og_image.png', 1);
await b.close();

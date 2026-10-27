// Renders the brand kit into brand/out/ from brand/scene.html (fully 3D, no game footage).
//   python3 -m http.server 8766   (repo root)   then   node brand/render.mjs
// Each image is rendered at 2× and also saved downscaled for extra sharpness (see brand/out/*).
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out') + '/';
const BASE = process.env.BASE || 'http://127.0.0.1:8766';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const only = process.argv.slice(2);
const JOBS = [
  ['avatar', 1024, 1024, 'avatar', 'scene.html'],
  ['banner', 1500, 500, 'x_header', 'banner.html'],
  ['og', 1200, 630, 'og_image', 'banner.html'],
];
for (const [kind, w, h, name, page] of JOBS) {
  if (only.length && !only.includes(kind)) continue;
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('ERR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('C', m.text().slice(0, 200)));
  await p.goto(`${BASE}/brand/${page}?kind=${kind}&pr=2`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 300000 });
  await p.evaluate(() => window.__ready);
  await p.locator('#stage').screenshot({ path: `${OUT}${name}@2x.png` });
  await p.close();
  // Lanczos downscale of the 2× render = supersampled, very crisp 1× image
  execFileSync('python3', ['-c', `from PIL import Image; im=Image.open('${OUT}${name}@2x.png').convert('RGB'); im.resize((${w},${h}), Image.LANCZOS).save('${OUT}${name}.png', optimize=True)${kind === 'avatar' ? `; im.resize((400,400), Image.LANCZOS).save('${OUT}avatar_400.png', optimize=True)` : ''}`]);
  console.log('wrote', name);
}
await b.close();

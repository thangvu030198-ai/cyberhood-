// Quét mã nguồn từng chế độ chơi, liệt kê model (extraModel("...")) để tải ngầm khi người chơi đang ở sảnh.
// Chạy: node scripts/gen-preload.mjs  (tự chạy trước mỗi lần build)
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MODES = {
  siege: ["src/siege"],
  raid: ["src/raid"],
  kart: ["src/level/KartScene.tsx", "src/level/kartFx.tsx", "src/level/kart.ts"],
  duel: ["src/level/DuelScene.tsx", "src/level/duel.ts", "src/level/fightClips.ts"],
};
const files = (p) => (fs.statSync(path.join(root, p)).isDirectory() ? fs.readdirSync(path.join(root, p)).map((f) => path.join(p, f)) : [p]).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
const extra = fs.readFileSync(path.join(root, "src/game/assets.ts"), "utf8");
const known = new Set([...extra.matchAll(/^\s+"?([a-z0-9_]+)"?: \d/gm)].map((m) => m[1]));
const out = {};
for (const [mode, paths] of Object.entries(MODES)) {
  const names = new Set();
  for (const p of paths) for (const f of files(p)) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    for (const m of src.matchAll(/["'`](mx_[a-z0-9_]+)["'`]/g)) if (known.has(m[1])) names.add(m[1]);
    // Đối thủ võ đài: base + "_walk"
    for (const m of src.matchAll(/base: "(mx_[a-z0-9_]+)"/g)) if (known.has(m[1] + "_walk")) names.add(m[1] + "_walk");
  }
  out[mode] = [...names].sort();
}
const body = `// Tự sinh bởi scripts/gen-preload.mjs — không sửa tay.\nexport const PRELOAD: Record<string, string[]> = ${JSON.stringify(out, null, 2)};\n`;
fs.writeFileSync(path.join(root, "src/game/preloadList.ts"), body);
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.length}`).join(", "));

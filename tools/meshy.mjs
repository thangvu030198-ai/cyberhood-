// Tạo model bằng Meshy text-to-3d: preview → refine (PBR) → tải GLB; tuỳ chọn rig + animation cơ bản.
// Key đọc từ biến môi trường MESHY_API_KEY, không ghi ra file.
import fs from "node:fs";
const KEY = process.env.MESHY_API_KEY;
const API = "https://api.meshy.ai/openapi";
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, path, body) {
  const res = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
async function poll(path, label) {
  for (;;) {
    const t = await req("GET", path);
    if (t.status === "SUCCEEDED") return t;
    if (t.status === "FAILED" || t.status === "CANCELED") throw new Error(`${label} ${t.status}: ${JSON.stringify(t.task_error ?? t).slice(0, 300)}`);
    await sleep(8000);
  }
}
async function download(url, out) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}
export const balance = async () => (await req("GET", "/v1/balance")).balance;

export async function make(item) {
  const state = fs.existsSync(`${item.name}.json`) ? JSON.parse(fs.readFileSync(`${item.name}.json`, "utf8")) : { name: item.name, prompt: item.prompt };
  const save = () => fs.writeFileSync(`${item.name}.json`, JSON.stringify(state, null, 2));
  if (!state.preview) {
    const r = await req("POST", "/v2/text-to-3d", {
      mode: "preview",
      prompt: item.prompt,
      negative_prompt: "low quality, blurry, text, watermark, logo, trademark",
      art_style: "realistic",
      ai_model: "latest",
      topology: "triangle",
      target_polycount: item.polycount ?? 30000,
      should_remesh: true,
      symmetry_mode: item.symmetry ?? "auto",
      ...(item.pose ? { pose_mode: item.pose } : {}),
    });
    state.preview = r.result;
    save();
    log(item.name, "preview", state.preview);
  }
  await poll(`/v2/text-to-3d/${state.preview}`, `${item.name} preview`);
  if (!state.refine) {
    const r = await req("POST", "/v2/text-to-3d", { mode: "refine", preview_task_id: state.preview, enable_pbr: true, ai_model: "latest" });
    state.refine = r.result;
    save();
    log(item.name, "refine", state.refine);
  }
  const done = await poll(`/v2/text-to-3d/${state.refine}`, `${item.name} refine`);
  state.glb = done.model_urls?.glb;
  state.thumb = done.thumbnail_url;
  save();
  await download(state.glb, `${item.name}.raw.glb`);
  if (state.thumb) await download(state.thumb, `${item.name}.png`).catch(() => {});
  log(item.name, "refined", (fs.statSync(`${item.name}.raw.glb`).size / 1e6).toFixed(1), "MB");
  if (item.rig) {
    if (!state.rig) {
      const r = await req("POST", "/v1/rigging", { input_task_id: state.refine, height_meters: item.height ?? 1.8 });
      state.rig = r.result;
      save();
      log(item.name, "rig", state.rig);
    }
    const rig = await poll(`/v1/rigging/${state.rig}`, `${item.name} rig`);
    state.rigResult = rig.result;
    save();
    const res = rig.result ?? {};
    if (res.rigged_character_glb_url) await download(res.rigged_character_glb_url, `${item.name}.rigged.glb`);
    for (const [k, v] of Object.entries(res.basic_animations ?? {})) {
      if (typeof v === "string" && v.includes(".glb")) await download(v, `${item.name}.${k.replace(/_glb_url$/, "")}.glb`).catch((e) => log("anim dl fail", k, e.message));
    }
    log(item.name, "rigged", Object.keys(res.basic_animations ?? {}).join(","));
  }
  return state;
}

if (process.argv[2]) {
  const items = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const conc = Number(process.argv[3] ?? 3);
  log("balance", await balance());
  const queue = [...items];
  await Promise.all(
    Array.from({ length: conc }, async () => {
      while (queue.length) {
        const it = queue.shift();
        try {
          await make(it);
        } catch (e) {
          log("FAIL", it.name, e.message);
        }
      }
    }),
  );
  log("balance", await balance());
}

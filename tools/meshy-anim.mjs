// node anim.mjs name:actionId:label ...  → <name>.anim_<label>.glb
import fs from "node:fs";
const KEY = process.env.MESHY_API_KEY || process.env.MESHY_KEY;
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const B = "https://api.meshy.ai/openapi/v1/animations";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function one(spec) {
  const [name, action, label] = spec.split(":");
  const out = `${name}.anim_${label}.glb`;
  if (fs.existsSync(out)) return console.log("skip", out);
  const rig = JSON.parse(fs.readFileSync(`${name}.json`, "utf8")).rig;
  let r = await fetch(B, { method: "POST", headers: H, body: JSON.stringify({ rig_task_id: rig, action_id: Number(action) }) });
  const j = await r.json(); if (!r.ok) return console.log("FAIL", spec, JSON.stringify(j));
  const id = j.result;
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const t = await (await fetch(`${B}/${id}`, { headers: H })).json();
    if (t.status === "SUCCEEDED") {
      const url = t.result?.animation_glb_url;
      if (!url) return console.log("NOURL", spec, JSON.stringify(t.result).slice(0, 300));
      fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
      return console.log("ok", out);
    }
    if (t.status === "FAILED" || t.status === "CANCELED") return console.log("FAIL", spec, JSON.stringify(t.task_error));
  }
}
const specs = process.argv.slice(2);
for (let i = 0; i < specs.length; i += 4) await Promise.all(specs.slice(i, i + 4).map(one));

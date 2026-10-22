// Chiêu thức dựng bằng model Meshy trong các màn đánh quái (đi ngang, nhìn từ trên, bắn tàu):
// - Nhân vật chính: tên lửa nạp nửa (đạn nạp cấp 1), chưởng rồng (nạp đầy), sóng kiếm, vòng chấn động khi dậm đất
// - Trùm: cầu đầu lâu (cầu lệ, đạn xoắn ốc, đạn thường), mảnh tinh thể máu (mảnh vỡ, loạt đạn nhỏ), tên lửa trùm,
//   gai băng trồi lên ở vùng nguy hiểm hình tròn, vòng chấn động khi đập / tiếp đất
// Quái thường giữ hiệu ứng quả cầu sáng cũ.

import { useRef } from "react";
import * as THREE from "three";
import type { FxEvent, PlatformerSim, Shot } from "./platformer";
import { qFlat, VfxPool, type VfxName, type VfxPut } from "../fx/skillVfx";

const DEPTH = 4;
const _q = new THREE.Quaternion();
const _up = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

/** Model cho từng viên đạn (null = giữ cách vẽ cũ) */
export function shotVfx(s: Shot): VfxName | null {
  if (!s.enemy) {
    if (s.kind === "chuong") return "chuong";
    if (s.kind === "wave") return "blade_wave";
    if ((!s.kind || s.kind === "bullet") && s.level === 1) return "missile";
    return null;
  }
  if (!s.boss) return null;
  if (s.missile) return "missile";
  if (s.kind === "orb") return "skull_orb";
  if (s.kind === "shard") return "blood_shard";
  if (!s.kind || s.kind === "bullet") return s.level === 2 ? "skull_orb" : "blood_shard";
  return null;
}

const SIZE: Partial<Record<VfxName, number>> = { chuong: 4, blade_wave: 2.6, missile: 4, skull_orb: 5, blood_shard: 8 };

function ShotModels({ sim, name }: { sim: PlatformerSim; name: VfxName }) {
  return (
    <VfxPool
      name={name}
      max={48}
      update={(put, t) => {
        const top = sim.mode === "topdown";
        const zz = (top ? -DEPTH / 2 + 1 : 0.3);
        for (const s of sim.shots) {
          if (shotVfx(s) !== name) continue;
          const ang = Math.atan2(s.vy || s.dy || 0, s.vx || s.dx || 1);
          const k = s.r * (SIZE[name] ?? 4);
          // Đầu lâu luôn nhìn ra màn hình, chỉ lắc lư; chưởng rồng uốn mình; tên lửa xoay tròn quanh trục bay
          if (name === "skull_orb") put(s.x, s.y, zz, qFlat(Math.sin(t * 7 + s.x) * 0.25, 0), k);
          else put(s.x, s.y, zz, qFlat(ang, name === "missile" ? t * 9 : name === "chuong" ? Math.sin(t * 8) * 0.5 : 0), k);
        }
      }}
    />
  );
}

/** Gai băng: trồi lên trong vùng nguy hiểm tròn của trùm khi vùng bùng lên, rồi lún xuống */
function Spikes({ sim }: { sim: PlatformerSim }) {
  return (
    <VfxPool
      name="ice_spike"
      max={24}
      update={(put) => {
        const top = sim.mode === "topdown";
        for (const h of sim.hazards) {
          if (!h.boss || h.shape !== "circle" || sim.time < h.liveAt) continue;
          const age = sim.time - h.liveAt;
          const dur = Math.max(0.35, h.endAt - h.liveAt) + 0.4;
          if (age > dur) continue;
          const rise = Math.min(1, age / 0.12) * Math.min(1, (dur - age) / 0.25);
          const k = h.r * 1.7 * Math.max(0.05, rise);
          if (top) put(h.x0, h.y0, -DEPTH / 2, _q.copy(_up), k);
          // Đi ngang: đặt trước đĩa báo vùng (z = DEPTH/2 + 0,15) để không bị che
          else {
            // Mọc từ mặt sàn ngay dưới tâm vùng (dò ô đặc từ tâm xuống)
            let gy = Math.floor(h.y0);
            const c = Math.floor(h.x0);
            while (gy > Math.floor(h.y0) - 6 && sim.tile(c, gy - 1) !== "#" && sim.tile(c, gy - 1) !== "o") gy--;
            put(h.x0, gy, DEPTH / 2 + 0.6, _q.identity(), k);
          }
        }
      }}
    />
  );
}

/** Vòng chấn động: nở ra từ chỗ trùm (hoặc người chơi) đập / dậm đất */
function Rings({ sim }: { sim: PlatformerSim }) {
  const seen = useRef(new WeakSet<FxEvent>());
  const live = useRef<{ x: number; y: number; at: number }[]>([]);
  return (
    <VfxPool
      name="shock_ring"
      max={8}
      shell={1.08}
      update={(put: VfxPut) => {
        for (const f of sim.fx) {
          if (seen.current.has(f)) continue;
          seen.current.add(f);
          if (f.kind !== "slam" && f.kind !== "land") continue;
          // Tiếp đất thường của người chơi thì bỏ qua, chỉ lấy cú tiếp đất của trùm
          const boss = sim.enemies.some((e) => e.kind === "boss" && e.alive && Math.abs(e.x - f.x) < 3 && Math.abs(e.y - f.y) < 3);
          if (f.kind === "land" && !boss) continue;
          live.current.push({ x: f.x, y: f.y, at: sim.time });
        }
        const top = sim.mode === "topdown";
        live.current = live.current.filter((r) => sim.time - r.at < 0.55);
        for (const r of live.current) {
          const u = (sim.time - r.at) / 0.55;
          const k = 1.5 + u * 6;
          if (top) put(r.x, r.y, -DEPTH / 2 + 0.05, _q.copy(_up), k, k * 0.35 * (1 - u), k);
          else put(r.x, r.y - 0.1, 0, _q.identity(), k, k * 0.4 * (1 - u), k * 0.5);
        }
      }}
    />
  );
}

export function SkillFx({ sim }: { sim: PlatformerSim }) {
  return (
    <>
      {(["chuong", "blade_wave", "missile", "skull_orb", "blood_shard"] as VfxName[]).map((n) => (
        <ShotModels key={n} sim={sim} name={n} />
      ))}
      <Spikes sim={sim} />
      <Rings sim={sim} />
    </>
  );
}

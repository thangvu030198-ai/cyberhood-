// Chiêu thức Công thành dựng bằng model Meshy (xem fx/skillVfx.tsx):
// - Người chơi: chùm tên lửa (đầu đạn là model tên lửa), lựu đạn plasma bay vòng cung rồi nằm chờ nổ,
//   thiên thạch pháo kích quỹ đạo rơi từ trời xuống, vòng sóng xung kích quanh thân
// - Boss Mech: dậm đất làm gai băng trồi lên + vòng chấn động; pháo thành: đạn thiên thạch băng rơi xuống vùng đỏ
import * as THREE from "three";
import { SIEGE, type SiegeSim } from "./siegeSim";
import { qDir, qYaw, VfxPool } from "../fx/skillVfx";

const _q = new THREE.Quaternion();

/** Vị trí tên lửa theo thời gian bay: vòng cung cao 9 m từ vai người chơi tới mục tiêu */
function missileAt(sim: SiegeSim, ms: SiegeSim["missiles"][number], k: number) {
  const u = sim.units[ms.id];
  return { x: ms.x0 + (u.x - ms.x0) * k, y: 2.2 + Math.sin(k * Math.PI) * 9, z: ms.z0 + (u.z - ms.z0) * k };
}

export function SiegeVfx({ sim }: { sim: SiegeSim }) {
  return (
    <>
      <VfxPool
        name="missile"
        max={24}
        update={(put, t) => {
          for (const ms of sim.missiles) {
            if (ms.hitAt === Infinity || sim.time < ms.at || sim.time >= ms.hitAt) continue;
            const k = Math.min(1, (sim.time - ms.at) / Math.max(0.05, ms.hitAt - ms.at));
            const a = missileAt(sim, ms, k);
            const b = missileAt(sim, ms, Math.min(1, k + 0.02));
            put(a.x, a.y, a.z, qDir(b.x - a.x, b.y - a.y, b.z - a.z, t * 8), 1.6);
          }
        }}
      />
      <VfxPool
        name="grenade"
        max={8}
        update={(put, t) => {
          for (const w of sim.warns) {
            if (w.kind !== "grenade" || sim.time >= w.liveAt) continue;
            const fuse = w.liveAt - w.warnAt;
            // Bay trong 55% thời gian ngòi rồi nằm lăn trên tuyết chờ nổ
            const k = Math.min(1, (sim.time - w.warnAt) / (fuse * 0.55));
            const fx = w.fromX ?? w.x0;
            const fz = w.fromZ ?? w.z0;
            const x = fx + (w.x0 - fx) * k;
            const z = fz + (w.z0 - fz) * k;
            const y = 0.45 + (1 - k) * 1.5 + Math.sin(k * Math.PI) * 5;
            const pulse = k >= 1 ? 1 + Math.max(0, Math.sin(t * 30)) * 0.15 : 1;
            put(x, y, z, _q.setFromEuler(new THREE.Euler(t * 9, t * 5, 0)), 0.9 * pulse);
          }
        }}
      />
      <VfxPool
        name="meteor"
        max={24}
        update={(put, t) => {
          for (const w of sim.warns) {
            if ((w.kind !== "orbital" && w.kind !== "cannon") || sim.time >= w.liveAt) continue;
            const u = (sim.time - w.warnAt) / Math.max(0.05, w.liveAt - w.warnAt);
            // Rơi chéo từ trên trời: chậm lúc đầu, nhanh dần
            const fall = 1 - u * u;
            // Lao chéo từ phía lâu đài (−z) xuống để lọt vào khung hình khi nhìn về phía thành
            const h = (w.kind === "orbital" ? 48 : 26) * fall;
            const size = w.kind === "orbital" ? 7 : 2.6;
            put(w.x0 + h * 0.15, 0.6 + h, w.z0 - h * 0.45, qDir(-0.15, -1, 0.45, t * 3), size);
          }
        }}
      />
      <VfxPool
        name="ice_spike"
        max={10}
        update={(put) => {
          for (const w of sim.warns) {
            if (w.kind !== "stomp" || sim.time < w.liveAt) continue;
            const age = sim.time - w.liveAt;
            if (age > 1.2) continue;
            const rise = Math.min(1, age / 0.1) * Math.min(1, (1.2 - age) / 0.35);
            put(w.x0, 0, w.z0, qYaw(w.x0 * 7), w.r * 1.6 * Math.max(0.05, rise));
          }
        }}
      />
      <VfxPool
        name="shock_ring"
        max={8}
        shell={1.08}
        update={(put) => {
          const P = sim.player;
          const cast = P.cds.shockwave - SIEGE.skills.shockwave.cd;
          const rings: [number, number, number, number][] = [];
          if (P.cds.shockwave > 0 && sim.time - cast < 0.6) rings.push([P.x, P.z, (sim.time - cast) / 0.6, SIEGE.skills.shockwave.r! * (P.stance === "tank" ? 1.3 : 1)]);
          for (const w of sim.warns) if (w.kind === "stomp" && sim.time >= w.liveAt && sim.time - w.liveAt < 0.6) rings.push([w.x0, w.z0, (sim.time - w.liveAt) / 0.6, w.r * 1.3]);
          for (const [x, z, u, r] of rings) {
            const k = r * 2 * (0.2 + u * 0.9);
            put(x, 0.1, z, _q.identity(), k, k * 0.3 * (1 - u) + 0.05, k);
          }
        }}
      />
    </>
  );
}

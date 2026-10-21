// Màn nhìn ngang: dãy mặt tiền nhà cũ sát sau làn chơi (nhiều tầng cửa sổ, cục nóng điều hoà, ban công,
// ống nước, biển hiệu nhỏ, vết ố), dây điện chằng chịt võng giữa các toà, và bóng thành phố dày đặc ánh đèn ở xa.
// Tất cả vẽ bằng canvas (có lớp phát sáng riêng), sinh theo hạt giống cố định của map.

import { useMemo } from "react";
import * as THREE from "three";
import { canvasPair } from "./cityBlocks";
import type { PlatformerSim } from "./platformer";

const NEON = ["#ff2fd0", "#00f0ff", "#ffe14a", "#7dff5a", "#ff6a2a", "#b46bff"];
const SHOP = ["PHỞ", "NET", "CÀ PHÊ", "SỬA ĐT", "KARAOKE", "THUỐC", "CẦM ĐỒ", "BAR", "ラーメン", "24H", "CHIP"];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Một toà mặt tiền 16 m × 14 m: 4 tầng, tầng trệt cửa hàng */
function facade(seed: number, tint: string) {
  const r = rng(seed);
  const W = 512;
  const H = 448;
  return canvasPair(W, H, (g, e) => {
    g.fillStyle = tint;
    g.fillRect(0, 0, W, H);
    // Mảng tường loang màu
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${0.03 + r() * 0.05})`;
      g.fillRect(r() * W, r() * H, 30 + r() * 120, 20 + r() * 80);
    }
    const floorH = 88;
    for (let f = 0; f < 4; f++) {
      const y0 = 8 + f * floorH;
      // Gờ sàn
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(0, y0 + floorH - 8, W, 6);
      for (let x = 14; x < W - 40; x += 64 + Math.floor(r() * 20)) {
        const ww = 36 + r() * 14;
        const lit = r() < 0.45;
        const col = r() < 0.6 ? "#ffcf7a" : r() < 0.5 ? "#8fe8ff" : "#ff8ad8";
        g.fillStyle = "#121420";
        g.fillRect(x - 3, y0 + 12, ww + 6, 52);
        for (const ctx of lit ? [g, e] : [g]) {
          ctx.fillStyle = lit ? col : "#1c2030";
          ctx.fillRect(x, y0 + 15, ww, 46);
        }
        // Song cửa / rèm
        g.fillStyle = "rgba(10,10,20,0.7)";
        g.fillRect(x + ww / 2 - 1, y0 + 15, 2, 46);
        if (lit && r() < 0.5) g.fillRect(x, y0 + 15, ww, 10 + r() * 20);
        // Cục nóng điều hoà dưới cửa sổ
        if (r() < 0.55) {
          g.fillStyle = "#8a8e96";
          g.fillRect(x + ww - 8, y0 + 64, 26, 16);
          g.fillStyle = "#2a2e36";
          g.beginPath();
          g.arc(x + ww + 5, y0 + 72, 5, 0, Math.PI * 2);
          g.fill();
        }
        // Ban công lan can
        if (r() < 0.25) {
          g.strokeStyle = "#3a3e48";
          g.lineWidth = 2;
          g.strokeRect(x - 6, y0 + 46, ww + 12, 18);
          for (let k = x - 4; k < x + ww + 6; k += 5) g.fillRect(k, y0 + 46, 1, 18);
        }
      }
      // Biển hiệu nhỏ hắt sáng
      if (r() < 0.6) {
        const c = NEON[Math.floor(r() * NEON.length)];
        const sx = r() * (W - 90);
        for (const ctx of [g, e]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = 3;
          ctx.strokeRect(sx, y0 + 4, 80, 22);
          ctx.fillStyle = c;
          ctx.font = "700 15px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(SHOP[Math.floor(r() * SHOP.length)], sx + 40, y0 + 20);
        }
      }
    }
    // Tầng trệt: cửa cuốn, cửa kính sáng
    const gy = 8 + 4 * floorH;
    for (let x = 6; x < W; x += 128) {
      if (r() < 0.5) {
        g.fillStyle = "#4a4e58";
        g.fillRect(x, gy, 110, H - gy);
        g.fillStyle = "#3a3e48";
        for (let y = gy; y < H; y += 6) g.fillRect(x, y, 110, 2);
      } else
        for (const ctx of [g, e]) {
          ctx.fillStyle = "rgba(120,230,255,0.55)";
          ctx.fillRect(x + 6, gy + 6, 98, H - gy - 6);
        }
    }
    // Ống nước và dây điện dọc tường
    g.fillStyle = "#30343e";
    for (let i = 0; i < 3; i++) g.fillRect(r() * W, 0, 5, H);
    g.strokeStyle = "rgba(10,10,14,0.9)";
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      const x = r() * W;
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 40, 120, x - 30, 260, x + r() * 60, H);
      g.stroke();
    }
    // Vệt ố chảy xuống
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.15})`;
      g.fillRect(r() * W, r() * H, 2 + r() * 4, 10 + r() * 50);
    }
  });
}

/** Bóng thành phố xa: hàng trăm toà tối với cửa sổ sáng lốm đốm */
function skylineTexture(seed: number) {
  const r = rng(seed);
  return canvasPair(1024, 256, (g, e) => {
    g.clearRect(0, 0, 1024, 256);
    for (let layer = 0; layer < 2; layer++)
      for (let x = 0; x < 1024; ) {
        const w = 20 + r() * 50;
        const h = 60 + r() * (layer ? 120 : 190);
        g.fillStyle = layer ? "#1a1430" : "#2a2048";
        g.fillRect(x, 256 - h, w, h);
        for (let wy = 256 - h + 6; wy < 250; wy += 8)
          for (let wx = x + 3; wx < x + w - 3; wx += 6)
            if (r() < 0.22)
              for (const ctx of [g, e]) {
                ctx.fillStyle = r() < 0.7 ? "#ffcf7a" : "#7fe8ff";
                ctx.fillRect(wx, wy, 3, 4);
              }
        if (r() < 0.15)
          for (const ctx of [g, e]) {
            ctx.fillStyle = NEON[Math.floor(r() * NEON.length)];
            ctx.fillRect(x + 2, 256 - h + 10, 4, Math.min(60, h - 20));
          }
        x += w + r() * 6;
      }
  });
}

/** Dây điện võng giữa hai điểm (đường xích treo) */
function cable(a: THREE.Vector3, b: THREE.Vector3, sag: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.03, 4, false);
}

const TINTS = ["#5a4e4a", "#4e5258", "#5c5244", "#4a4a5a", "#56483e"];

export function SideScenery({ sim }: { sim: PlatformerSim }) {
  // Hang Hollow Hotel: chỉ giữ bóng thành phố xa (nhìn qua cửa hang), không dựng dãy mặt tiền
  const climb = sim.mode === "climb" || sim.def.theme === "hotel";
  const data = useMemo(() => {
    const r = rng(sim.width * 31 + 7);
    const textures = Array.from({ length: 4 }, (_, i) => facade(sim.width + i * 13, TINTS[i % TINTS.length]));
    const segs: { x: number; z: number; tex: number; h: number }[] = [];
    if (!climb)
      for (let x = -6; x < sim.width + 16; ) {
        const h = 13 + r() * 5;
        segs.push({ x: x + 8, z: -5.5 - r() * 2, tex: Math.floor(r() * textures.length), h });
        x += 16 + (r() < 0.35 ? 3 + r() * 6 : 0);
      }
    const cables: THREE.BufferGeometry[] = [];
    for (let i = 0; i + 1 < segs.length; i++)
      for (let k = 0; k < 3; k++) {
        const a = segs[i];
        const b = segs[i + 1];
        const y = 7 + r() * 5;
        cables.push(cable(new THREE.Vector3(a.x + 4 + r() * 3, y, a.z + 0.4), new THREE.Vector3(b.x - 4 - r() * 3, y + (r() - 0.5) * 2, b.z + 0.4), 0.6 + r() * 1.2));
      }
    return { textures, segs, cables, sky: skylineTexture(sim.width + 99) };
  }, [sim, climb]);
  const mats = useMemo(
    () =>
      data.textures.map(
        (t) => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.glow, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.5, roughness: 0.9 }),
      ),
    [data],
  );
  const skyMat = useMemo(() => {
    const m = data.sky.map.clone();
    const g = data.sky.glow.clone();
    for (const t of [m, g]) {
      t.repeat.set(Math.max(1, (sim.width + 300) / 160), 1);
      t.needsUpdate = true;
    }
    return new THREE.MeshBasicMaterial({ map: m, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.2, 1.1, 1.4), toneMapped: false });
  }, [data, sim]);
  return (
    <group>
      {/* Bóng thành phố xa */}
      <mesh position={[sim.width / 2, climb ? sim.height / 2 : 22, -120]} material={skyMat}>
        <planeGeometry args={[sim.width + 300, climb ? sim.height + 80 : 70]} />
      </mesh>
      {data.segs.map((s, i) => (
        <mesh key={i} position={[s.x, s.h / 2, s.z]} material={mats[s.tex]}>
          <planeGeometry args={[16, s.h]} />
        </mesh>
      ))}
      {data.cables.map((geo, i) => (
        <mesh key={`c${i}`} geometry={geo}>
          <meshBasicMaterial color="#0a0a10" />
        </mesh>
      ))}
    </group>
  );
}

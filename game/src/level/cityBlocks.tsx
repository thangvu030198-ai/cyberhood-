// Màn nhìn từ trên: dựng khối nền thành từng toà nhà / hàng rào thật thay cho các ô vuông lặp lại.
// Gộp ô đặc thành hình chữ nhật lớn nhất, mỗi hình là một toà: mái kim loại kẻ mạch điện tử có lỗ thông gió,
// mặt tiền cửa cuốn + cửa sổ sáng đèn + poster neon (vẽ bằng canvas, phần sáng có bản phát quang riêng),
// dải neon chạy quanh mép mái, máy móc và xe bay đỗ trên mái. Bao quanh map là dãy cao ốc gắn biển neon.
// Toạ độ thế giới: x giữ nguyên, mặt sàn y = -2, z = -y mô phỏng.

import { Suspense, useMemo } from "react";
import * as THREE from "three";
import type { ExtraModel } from "../game/assets";
import { useFitted } from "../game/Showcase";
import type { PlatformerSim } from "./platformer";
import { topSkinned } from "./terrainSkin";

const FLOOR = -2;
const NEON = ["#ff2fd0", "#00f0ff", "#ffe14a", "#7dff5a", "#ff6a2a", "#b46bff"];
const VN_SIGNS = ["CIRCUITS", "PHO-NET", "COFFEE 24H", "KARAOKE", "PAWN SHOP", "NOODLES", "CHIP REPAIR", "CAPSULE INN", "PHARMACY", "NET CAFE", "CYBERHOOD", "ラーメン", "電脳", "居酒屋", "質屋"];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

type Rect = { c: number; r: number; w: number; h: number };

/** Gộp các ô đặc '#' thành những hình chữ nhật lớn (quét tham lam theo hàng rồi kéo dài xuống) */
export function mergeRects(sim: PlatformerSim): Rect[] {
  const seen = new Set<number>();
  const id = (c: number, r: number) => r * sim.width + c;
  const solid = (c: number, r: number) => sim.tile(c, r) === "#" && !seen.has(id(c, r)) && c >= 0 && c < sim.width && r >= 0 && r < sim.height;
  const out: Rect[] = [];
  for (let r = 0; r < sim.height; r++)
    for (let c = 0; c < sim.width; c++) {
      if (!solid(c, r)) continue;
      let w = 1;
      while (solid(c + w, r)) w++;
      let h = 1;
      while (r + h < sim.height && Array.from({ length: w }, (_, k) => solid(c + k, r + h)).every(Boolean)) h++;
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) seen.add(id(x, y));
      out.push({ c, r, w, h });
    }
  return out;
}

/** Vẽ một lớp màu + một lớp phát sáng cùng lúc (phát sáng chỉ có đèn, poster, dải neon) */
export function canvasPair(w: number, h: number, draw: (base: CanvasRenderingContext2D, glow: CanvasRenderingContext2D) => void) {
  const a = document.createElement("canvas");
  const b = document.createElement("canvas");
  a.width = b.width = w;
  a.height = b.height = h;
  const ga = a.getContext("2d")!;
  const gb = b.getContext("2d")!;
  gb.fillStyle = "#000";
  gb.fillRect(0, 0, w, h);
  draw(ga, gb);
  const ta = new THREE.CanvasTexture(a);
  const tb = new THREE.CanvasTexture(b);
  for (const t of [ta, tb]) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  return { map: ta, glow: tb };
}

/** Mái nhà: tấm thép xanh rêu, đường mạch điện tử, lỗ thông gió, ống dẫn, đèn báo nhỏ */
function roofTexture(seed: number, space = false) {
  const r = rng(seed);
  return canvasPair(256, 256, (g, e) => {
    g.fillStyle = space ? "#2a1a40" : "#1e2a2e";
    g.fillRect(0, 0, 256, 256);
    // Tấm thép ghép
    for (let y = 0; y < 256; y += 64)
      for (let x = 0; x < 256; x += 64) {
        g.fillStyle = space ? `rgb(${58 + r() * 16},${36 + r() * 12},${86 + r() * 16})` : `rgb(${30 + r() * 14},${44 + r() * 14},${48 + r() * 14})`;
        g.fillRect(x + 2, y + 2, 60, 60);
      }
    // Đường mạch điện tử
    g.strokeStyle = space ? "#9a6ad0" : "#3b5a60";
    g.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      let x = Math.floor(r() * 8) * 32 + 16;
      let y = Math.floor(r() * 8) * 32 + 16;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (r() < 0.5) x += (r() < 0.5 ? -1 : 1) * 32;
        else y += (r() < 0.5 ? -1 : 1) * 32;
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = space ? "#c08aff" : "#4f7a80";
      g.fillRect(x - 4, y - 4, 8, 8);
      // Vũ trụ: đường mạch phát sáng nhẹ
      if (space) {
        e.fillStyle = "#6a2a9a";
        e.fillRect(x - 3, y - 3, 6, 6);
      }
    }
    // Lỗ thông gió có nan
    for (let i = 0; i < 3; i++) {
      const x = 20 + r() * 190;
      const y = 20 + r() * 190;
      g.fillStyle = "#11181a";
      g.fillRect(x, y, 40, 28);
      g.fillStyle = "#2c3a3e";
      for (let k = 4; k < 28; k += 6) g.fillRect(x + 3, y + k, 34, 2);
    }
    // Đèn báo
    for (let i = 0; i < 6; i++) {
      const x = r() * 250;
      const y = r() * 250;
      const c = NEON[Math.floor(r() * NEON.length)];
      for (const ctx of [g, e]) {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    // Vết bẩn, rỉ
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`;
      g.fillRect(r() * 256, r() * 256, 3 + r() * 10, 2 + r() * 5);
    }
  });
}

/** Mặt tiền 2 m: cửa cuốn / cửa kính, cửa sổ sáng đèn, poster neon, ống điều hoà, vết bẩn. `barrier`: rào chắn sọc */
function facadeTexture(seed: number, barrier: boolean, space = false) {
  const r = rng(seed);
  return canvasPair(256, 256, (g, e) => {
    g.fillStyle = space ? "#3a2454" : barrier ? "#2a2830" : "#232633";
    g.fillRect(0, 0, 256, 256);
    if (space) {
      // Vách pháo đài vũ trụ: tấm hợp kim tím kẻ mạch, hai dải neon hồng
      g.strokeStyle = "#7a4aa8";
      g.lineWidth = 3;
      for (let y = 30; y < 256; y += 48) {
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x < 256; x += 32) g.lineTo(x + 32, y + (r() < 0.3 ? 16 : 0));
        g.stroke();
      }
      for (const ctx of [g, e]) {
        ctx.fillStyle = "#ff5fe0";
        ctx.fillRect(0, 4, 256, 5);
        ctx.fillRect(0, 247, 256, 4);
      }
      return;
    }
    if (barrier) {
      // Rào thép: sọc cảnh báo dưới chân, dải neon trên đỉnh
      for (let x = -40; x < 256; x += 40) {
        g.fillStyle = "#e0b020";
        g.beginPath();
        g.moveTo(x, 256);
        g.lineTo(x + 20, 256);
        g.lineTo(x + 50, 200);
        g.lineTo(x + 30, 200);
        g.fill();
      }
      g.fillStyle = "#3a3844";
      for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 4, 200);
      const c = NEON[Math.floor(r() * NEON.length)];
      for (const ctx of [g, e]) {
        ctx.fillStyle = c;
        ctx.fillRect(0, 6, 256, 6);
      }
      return;
    }
    // Tầng trên: cửa sổ (một số sáng đèn)
    for (let x = 14; x < 256; x += 60) {
      const lit = r() < 0.6;
      const c = lit ? (r() < 0.5 ? "#ffd27a" : "#7fe8ff") : "#151822";
      g.fillStyle = "#11131c";
      g.fillRect(x - 3, 17, 46, 56);
      for (const ctx of lit ? [g, e] : [g]) {
        ctx.fillStyle = c;
        ctx.fillRect(x, 20, 40, 50);
      }
      g.fillStyle = "#11131c";
      g.fillRect(x + 19, 20, 2, 50);
    }
    // Tầng trệt: cửa cuốn hoặc cửa kính sáng
    const door = r() < 0.5;
    g.fillStyle = door ? "#4a4e5c" : "#0f1a24";
    g.fillRect(20, 140, 120, 116);
    if (door) for (let y = 144; y < 256; y += 8) ((g.fillStyle = "#3a3e4a"), g.fillRect(20, y, 120, 3));
    else
      for (const ctx of [g, e]) {
        ctx.fillStyle = "rgba(90,220,255,0.55)";
        ctx.fillRect(26, 150, 108, 100);
      }
    // Poster neon
    const pc = NEON[Math.floor(r() * NEON.length)];
    for (const ctx of [g, e]) {
      ctx.strokeStyle = pc;
      ctx.lineWidth = 4;
      ctx.strokeRect(160, 120, 76, 100);
      ctx.fillStyle = pc;
      ctx.font = "700 22px monospace";
      ctx.textAlign = "center";
      ctx.fillText(VN_SIGNS[Math.floor(r() * VN_SIGNS.length)].slice(0, 5), 198, 176);
    }
    // Cục nóng điều hoà và ống
    g.fillStyle = "#5a5e68";
    g.fillRect(170, 86, 50, 26);
    g.fillStyle = "#2a2e38";
    g.beginPath();
    g.arc(195, 99, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#3a3e48";
    g.fillRect(244, 0, 6, 256);
    // Bẩn
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.12})`;
      g.fillRect(r() * 256, r() * 256, 2 + r() * 8, 4 + r() * 18);
    }
  });
}

function useTex(seed: number, kind: "roof" | "facade" | "barrier", space = false) {
  return useMemo(() => (kind === "roof" ? roofTexture(seed, space) : facadeTexture(seed, kind === "barrier", space)), [seed, kind, space]);
}

/** Vật liệu có texture lặp theo kích thước mặt (u: dài theo mét / 2, v: 1 tầng) */
function faceMaterial(t: { map: THREE.Texture; glow: THREE.Texture }, ru: number, rv: number) {
  const map = t.map.clone();
  const glow = t.glow.clone();
  for (const x of [map, glow]) {
    x.repeat.set(ru, rv);
    x.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({ map, emissiveMap: glow, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.6, roughness: 0.75, metalness: 0.25 });
}

function Block({ rect, height, seed, barrier, space = false }: { rect: Rect; height: number; seed: number; barrier: boolean; space?: boolean }) {
  const roof = useTex(seed % 3, "roof", space);
  const face = useTex(seed % 4, barrier ? "barrier" : "facade", space);
  const { c, r, w, h } = rect;
  const cx = c + w / 2;
  const cz = -(r + h / 2);
  const mats = useMemo(
    () => ({
      top: faceMaterial(roof, w / 3, h / 3),
      ns: faceMaterial(face, Math.max(1, Math.round(w / 2)), 1),
      ew: faceMaterial(face, Math.max(1, Math.round(h / 2)), 1),
    }),
    [roof, face, w, h],
  );
  const neon = useMemo(() => new THREE.Color(space ? "#ff5fe0" : NEON[seed % NEON.length]).multiplyScalar(2.4), [seed, space]);
  const top = FLOOR + height;
  return (
    <group>
      <mesh position={[cx, top, cz]} rotation-x={-Math.PI / 2} material={mats.top}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh position={[cx, FLOOR + height / 2, cz + h / 2]} material={mats.ns}>
        <planeGeometry args={[w, height]} />
      </mesh>
      <mesh position={[cx, FLOOR + height / 2, cz - h / 2]} rotation-y={Math.PI} material={mats.ns}>
        <planeGeometry args={[w, height]} />
      </mesh>
      <mesh position={[cx + w / 2, FLOOR + height / 2, cz]} rotation-y={Math.PI / 2} material={mats.ew}>
        <planeGeometry args={[h, height]} />
      </mesh>
      <mesh position={[cx - w / 2, FLOOR + height / 2, cz]} rotation-y={-Math.PI / 2} material={mats.ew}>
        <planeGeometry args={[h, height]} />
      </mesh>
      {/* Dải neon quanh mép mái */}
      {(!barrier || space) && (
        <>
          <mesh position={[cx, top + 0.03, cz + h / 2 - 0.05]}>
            <boxGeometry args={[w, 0.06, 0.06]} />
            <meshBasicMaterial color={neon} toneMapped={false} />
          </mesh>
          <mesh position={[cx + w / 2 - 0.05, top + 0.03, cz]}>
            <boxGeometry args={[0.06, 0.06, h]} />
            <meshBasicMaterial color={neon} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

const ROOF_PROPS: [ExtraModel, number][] = [
  ["mx_police_hovercar", 1.4],
  ["mx_veh_hovertruck", 1.6],
  ["mx_battery_cell", 1.2],
  ["mx_wz_comms", 3.4],
  ["mx_map_turret", 1.6],
  ["mx_supply_crate", 0.9],
  ["mx_veh_hoverbike", 1],
];

function Fitted({ name, height, position, rotY }: { name: ExtraModel; height: number; position: [number, number, number]; rotY: number }) {
  const { root } = useFitted(name, height, "height", 0.5);
  const obj = useMemo(() => root.clone(true), [root]);
  return <primitive object={obj} position={position} rotation-y={rotY} />;
}

/** Cục điều hoà mái nhà: hộp thép + quạt tròn */
function AcUnit({ position, rotY }: { position: [number, number, number]; rotY: number }) {
  return (
    <group position={position} rotation-y={rotY}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.9, 0.6, 0.7]} />
        <meshStandardMaterial color="#6a7280" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.61, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.26, 16]} />
        <meshStandardMaterial color="#20242c" />
      </mesh>
    </group>
  );
}

/** Biển neon dọc trên mặt cao ốc */
function TallSign({ position, rotY, text, color }: { position: [number, number, number]; rotY: number; text: string; color: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(8,4,18,0.9)";
    g.fillRect(0, 0, 512, 128);
    g.shadowColor = color;
    g.shadowBlur = 20;
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.strokeRect(8, 8, 496, 112);
    g.fillStyle = color;
    g.font = "700 64px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 256, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color]);
  return (
    <mesh position={position} rotation-y={rotY}>
      <planeGeometry args={[7, 1.75]} />
      <meshBasicMaterial map={tex} toneMapped={false} color={[1.8, 1.8, 1.8]} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Chỉ cao ốc mảnh (rộng ≤ ~½ chiều cao): model bè ngang co theo chiều cao 30–50 m sẽ phình ra lấn vào map
const SKYLINE: ExtraModel[] = ["mx_bld_skyscraper", "mx_bld_megacorp", "mx_bld_tower_round", "mx_bld_capsule_hotel", "mx_bld_pagoda"];

export function CityBlocks({ sim }: { sim: PlatformerSim }) {
  const farm = sim.def.theme === "parish";
  // Map đã có da model (terrainSkin.tsx): chỉ giữ dãy cao ốc và biển neon bao quanh
  const skinned = topSkinned(sim);
  // Bay bắn trong không gian: vách pháo đài tím cao bằng cả khối nền, không có cao ốc / biển hiệu bao quanh
  const space = sim.mode === "shmup";
  const data = useMemo(() => {
    const r = rng(sim.width * 977 + sim.height);
    const rects = mergeRects(sim);
    const blocks = rects.map((rect, i) => {
      const big = rect.w >= 3 && rect.h >= 3;
      const single = rect.w === 1 && rect.h === 1;
      const height = space ? 4 : farm ? (big ? 2.6 : single ? 1 : 1.3) : big ? 3.2 + r() * 1.2 : 2.2;
      return { rect, height, seed: i * 7 + 3, barrier: !big && !single, big };
    });
    const roofs: { key: string; el: "ac" | [ExtraModel, number]; pos: [number, number, number]; rot: number }[] = [];
    for (const b of blocks) {
      if (!b.big || space) continue;
      const top = FLOOR + b.height;
      const { c, r: row, w, h } = b.rect;
      const n = Math.min(4, Math.floor((w * h) / 12) + 1);
      for (let k = 0; k < n; k++) {
        const x = c + 1 + r() * (w - 2);
        const y = row + 1 + r() * (h - 2);
        const el = k === 0 && r() < 0.8 ? ROOF_PROPS[Math.floor(r() * ROOF_PROPS.length)] : "ac";
        roofs.push({ key: `${b.seed}-${k}`, el, pos: [x, top, -y], rot: r() * 6.28 });
      }
    }
    // Dãy cao ốc ngoài rìa phía bắc và phía tây (hướng camera nhìn tới), gắn biển neon
    const sky: { name: ExtraModel; pos: [number, number, number]; h: number; rot: number }[] = [];
    const signs: { pos: [number, number, number]; rot: number; text: string; color: string }[] = [];
    for (let x = -6; !space && x < sim.width + 12; x += 9 + r() * 4) {
      const h = 26 + r() * 22;
      sky.push({ name: SKYLINE[Math.floor(r() * SKYLINE.length)], pos: [x, FLOOR, -(sim.height + 16 + r() * 8)], h, rot: r() * 0.6 - 0.3 });
      signs.push({ pos: [x, FLOOR + 6 + r() * (h - 10), -(sim.height + 3.5)], rot: 0, text: VN_SIGNS[Math.floor(r() * VN_SIGNS.length)], color: NEON[Math.floor(r() * NEON.length)] });
    }
    if (!farm && !space)
      for (let y = -6; y < sim.height + 6; y += 9 + r() * 4) {
        const h = 26 + r() * 22;
        sky.push({ name: SKYLINE[Math.floor(r() * SKYLINE.length)], pos: [-(16 + r() * 8), FLOOR, -y], h, rot: Math.PI / 2 + r() * 0.6 - 0.3 });
        signs.push({ pos: [-3.5, FLOOR + 6 + r() * (h - 10), -y], rot: Math.PI / 2, text: VN_SIGNS[Math.floor(r() * VN_SIGNS.length)], color: NEON[Math.floor(r() * NEON.length)] });
      }
    return { blocks, roofs, sky, signs };
  }, [sim, farm]);
  return (
    <group>
      {!skinned &&
        data.blocks.map((b) => (
          <Block key={b.seed} rect={b.rect} height={b.height} seed={b.seed} barrier={b.barrier} space={space} />
        ))}
      {!skinned && data.roofs.map((p) =>
        p.el === "ac" ? (
          <AcUnit key={p.key} position={p.pos} rotY={p.rot} />
        ) : (
          <Suspense key={p.key} fallback={null}>
            <Fitted name={p.el[0]} height={p.el[1]} position={p.pos} rotY={p.rot} />
          </Suspense>
        ),
      )}
      {data.sky.map((s, i) => (
        <Suspense key={`k${i}`} fallback={null}>
          <Fitted name={s.name} height={s.h} position={s.pos} rotY={s.rot} />
        </Suspense>
      ))}
      {data.signs.map((s, i) => (
        <TallSign key={`s${i}`} position={s.pos} rotY={s.rot} text={s.text} color={s.color} />
      ))}
    </group>
  );
}

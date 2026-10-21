// Hiệu ứng chiến đấu cho màn 2D: hạt tia lửa / mảnh vỡ / lấp lánh, chữ bay lên khi nhặt đồ, vùng nguy hiểm
// báo trước (viền đỏ đầy dần rồi bùng lên), đạn đặc biệt của quái (lựu đạn, axit, bom, cầu lệ, đạn bắn tỉa,
// mảnh vảy), dấu hiệu báo đòn của quái (tia ngắm đỏ, nháy sắp nổ, khiên), và vệt chém cận chiến.
// Mọi thứ đọc trực tiếp từ PlatformerSim mỗi khung hình, dùng instanced mesh để nhẹ.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { FxEvent, Hazard, HazardKind, PlatformerSim, Shot } from "./platformer";
import { LEVEL_TUNING as T } from "./levelTuning";

const DEPTH = 4;

/** Chụp ảnh kiểm tra (?debug): làm chậm hạt và chữ bay để bắt đúng khoảnh khắc */
export const fxDebug = { slow: 1 };
const zFloor = (sim: PlatformerSim) => (sim.mode === "topdown" ? -DEPTH / 2 : 0);
const isTop = (sim: PlatformerSim) => sim.mode === "topdown";

// ---------------------------------------------------------------------------
// Hạt

type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; r: number; g: number; b: number; grav: number; drag: number };

const MAX_PARTICLES = 900;

type Burst = { n: number; speed: [number, number]; life: [number, number]; size: [number, number]; color: [number, number, number][]; grav: number; drag?: number; up?: number; spread?: number };

const BURSTS: Partial<Record<FxEvent["kind"], Burst>> = {
  hit: { n: 7, speed: [4, 9], life: [0.12, 0.28], size: [0.05, 0.1], color: [[3, 3, 3.2], [1.4, 2.8, 3.2]], grav: 6 },
  crit: { n: 22, speed: [6, 14], life: [0.2, 0.45], size: [0.07, 0.16], color: [[3.2, 2.6, 0.8], [3.2, 3.2, 3.2], [3, 1.6, 0.4]], grav: 8 },
  block: { n: 8, speed: [3, 7], life: [0.1, 0.25], size: [0.05, 0.09], color: [[0.6, 2.8, 3.2]], grav: 4 },
  boom: { n: 26, speed: [3, 9], life: [0.3, 0.75], size: [0.08, 0.2], color: [[3.2, 1.8, 0.4], [3.2, 0.9, 0.2], [3.2, 3, 2]], grav: 3, drag: 2 },
  bigboom: { n: 90, speed: [4, 16], life: [0.5, 1.4], size: [0.1, 0.3], color: [[3.2, 1.8, 0.4], [3.2, 0.9, 0.2], [3.2, 3, 2.2], [3, 0.5, 2.6]], grav: 4, drag: 1.4 },
  coin: { n: 7, speed: [1.5, 4], life: [0.25, 0.5], size: [0.05, 0.1], color: [[3.2, 2.6, 0.6], [3.2, 3.2, 2]], grav: -2, up: 2 },
  pickup: { n: 14, speed: [1.5, 5], life: [0.3, 0.7], size: [0.06, 0.12], color: [[1.2, 3.2, 2], [3.2, 3.2, 3.2]], grav: -3, up: 2.5 },
  slam: { n: 30, speed: [3, 8], life: [0.3, 0.6], size: [0.1, 0.22], color: [[1.4, 1.3, 1.5], [3, 2, 0.6]], grav: 10, up: 3, spread: 0.3 },
  hurt: { n: 14, speed: [3, 8], life: [0.2, 0.45], size: [0.06, 0.12], color: [[3.2, 0.3, 0.4], [3.2, 1.2, 1.2]], grav: 6 },
  land: { n: 6, speed: [1.5, 3], life: [0.2, 0.4], size: [0.06, 0.11], color: [[1.1, 1.1, 1.2]], grav: 2, up: 0.5, spread: 0.2 },
  dash: { n: 8, speed: [1, 3], life: [0.2, 0.4], size: [0.05, 0.1], color: [[0.6, 2.4, 3.2]], grav: 0 },
  checkpoint: { n: 30, speed: [2, 6], life: [0.5, 1], size: [0.06, 0.14], color: [[0.6, 3.2, 1.6], [3.2, 3.2, 3.2]], grav: -2, up: 3 },
  swing: { n: 5, speed: [2, 5], life: [0.12, 0.25], size: [0.04, 0.08], color: [[2.4, 3, 3.2]], grav: 0 },
};

/** Vụ nổ / vùng nguy hiểm vừa bùng lên: bắn hạt theo màu của loại vùng */
const HAZARD_RGB: Record<HazardKind, [number, number, number]> = {
  blast: [3.2, 1.6, 0.4],
  fire: [3.2, 1.1, 0.2],
  laser: [3.2, 0.5, 2.2],
  hands: [1.8, 0.7, 3.2],
  rock: [3, 1.5, 0.5],
  elec: [0.9, 2, 3.2],
  acid: [0.8, 3.2, 0.6],
  crystal: [0.7, 2.8, 3.2],
  tentacle: [1, 3, 0.8],
  shock: [2.6, 3, 3.2],
};

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function Particles({ sim }: { sim: PlatformerSim }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const list = useRef<Particle[]>([]);
  const seen = useRef(new WeakSet<FxEvent>());
  const seenHz = useRef(new Set<number>());
  const geo = useMemo(() => new THREE.OctahedronGeometry(0.5, 0), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const c = useMemo(() => new THREE.Color(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05) * fxDebug.slow;
    const top = isTop(sim);
    const zf = zFloor(sim);
    const ps = list.current;
    const spawn = (x: number, y: number, b: Burst, scale = 1, tint?: [number, number, number]) => {
      const n = Math.round(b.n * Math.min(2.5, scale));
      for (let i = 0; i < n && ps.length < MAX_PARTICLES; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(b.speed[0], b.speed[1]) * Math.sqrt(scale);
        const col = tint ?? b.color[i % b.color.length];
        const up = b.up ?? 0;
        // Đi ngang: toả trong mặt phẳng XY (+ chút chiều sâu); nhìn từ trên: toả trên mặt đất, bay lên theo z
        const spread = b.spread ?? 1;
        ps.push(
          top
            ? { x, y, z: zf + 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: up + rand(0, sp * 0.6), life: 0, max: rand(b.life[0], b.life[1]), size: rand(b.size[0], b.size[1]) * Math.sqrt(scale), r: col[0], g: col[1], b: col[2], grav: b.grav, drag: b.drag ?? 0 }
            : { x, y, z: 0.6 + rand(-0.3, 0.3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * spread + up, vz: rand(-1, 1) * sp * 0.3, life: 0, max: rand(b.life[0], b.life[1]), size: rand(b.size[0], b.size[1]) * Math.sqrt(scale), r: col[0], g: col[1], b: col[2], grav: b.grav, drag: b.drag ?? 0 },
        );
      }
    };
    for (const f of sim.fx) {
      if (seen.current.has(f)) continue;
      seen.current.add(f);
      const b = BURSTS[f.kind];
      if (!b) continue;
      const y = top ? f.y : f.y;
      spawn(f.x, y, b, f.kind === "boom" || f.kind === "bigboom" ? (f.n ?? 1) : 1);
      // Nổ to: thêm mảnh vỡ tối màu rơi xuống
      if (f.kind === "boom" || f.kind === "bigboom")
        spawn(f.x, y, { n: f.kind === "bigboom" ? 30 : 8, speed: [3, 8], life: [0.6, 1.2], size: [0.1, 0.22], color: [[0.25, 0.22, 0.28], [0.5, 0.35, 0.3]], grav: 18 }, f.n ?? 1);
    }
    // Vùng nguy hiểm vừa bùng lên: bụi / mảnh / tia lửa theo loại
    for (const h of sim.hazards) {
      if (seenHz.current.has(h.id) || sim.time < h.liveAt) continue;
      seenHz.current.add(h.id);
      const [x, y] = hazardBase(h, sim);
      spawn(x, y, { n: h.shape === "circle" ? 18 : 14, speed: [3, 8], life: [0.25, 0.6], size: [0.08, 0.18], color: [HAZARD_RGB[h.kind], [3, 3, 3]], grav: 8, up: top ? 2 : 3 });
    }
    if (seenHz.current.size > 400) seenHz.current.clear();

    const g = top ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, -1, 0);
    let w = 0;
    const mesh2 = mesh.current;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vx += g.x * p.grav * dt;
      p.vy += g.y * p.grav * dt;
      p.vz += g.z * p.grav * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.vz *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      ps[w++] = p;
    }
    ps.length = w;
    if (!mesh2) return;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const u = p.life / p.max;
      const s = p.size * (1 - u * 0.7);
      q.setFromAxisAngle(v.set(0.3, 1, 0.2).normalize(), p.life * 9 + i);
      m.compose(v.set(p.x, p.y, p.z), q, sc.set(s, s, s));
      mesh2.setMatrixAt(i, m);
      const fade = 1 - u;
      mesh2.setColorAt(i, c.setRGB(p.r * fade, p.g * fade, p.b * fade));
    }
    mesh2.count = ps.length;
    mesh2.instanceMatrix.needsUpdate = true;
    if (mesh2.instanceColor) mesh2.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, MAX_PARTICLES]} frustumCulled={false} renderOrder={5}>
      <meshBasicMaterial toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Chữ bay lên (nhặt đồ, vỡ khiên)

const TEXT_POOL = 28;
const textCache = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>();

function textTexture(text: string, color: string) {
  const key = `${text}|${color}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const font = "900 54px 'Bai Jamjuree', 'Segoe UI', sans-serif";
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 40;
  c.width = w;
  c.height = 84;
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = 10;
  g.strokeStyle = "rgba(10,6,20,0.92)";
  g.strokeText(text, w / 2, 44);
  g.shadowColor = color;
  g.shadowBlur = 16;
  g.fillStyle = color;
  g.fillText(text, w / 2, 44);
  g.shadowBlur = 0;
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fillText(text, w / 2, 41);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const out = { tex, aspect: w / 84 };
  if (textCache.size > 200) textCache.clear();
  textCache.set(key, out);
  return out;
}

function FloatTexts({ sim }: { sim: PlatformerSim }) {
  const group = useRef<THREE.Group>(null);
  const items = useRef<{ f: FxEvent; born: number; slot: number }[]>([]);
  const seen = useRef(new WeakSet<FxEvent>());
  const clockRef = useRef(0);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    clockRef.current += Math.min(dt, 0.1) * fxDebug.slow;
    const now = clockRef.current;
    for (const f of sim.fx) {
      if (!f.text || seen.current.has(f)) continue;
      seen.current.add(f);
      // Nhiều đồng xu nhặt cùng lúc: cộng dồn vào chữ đang bay gần đó thay vì chồng chữ
      if (f.kind === "coin") {
        const near = items.current.find((it) => it.f.kind === "coin" && now - it.born < 0.45);
        if (near) {
          const a = Number(near.f.text?.slice(1)) || 0;
          const b = Number(f.text.slice(1)) || 0;
          near.f = { ...near.f, text: `+${a + b}` };
          near.born = now - 0.05;
          continue;
        }
      }
      items.current.push({ f, born: now, slot: -1 });
      if (items.current.length > TEXT_POOL) items.current.shift();
    }
    items.current = items.current.filter((it) => now - it.born < 1.1);
    const top = isTop(sim);
    g.children.forEach((o, i) => {
      const sp = o as THREE.Sprite;
      const it = items.current[i];
      sp.visible = !!it;
      if (!it) return;
      const u = (now - it.born) / 1.1;
      const { tex, aspect } = textTexture(it.f.text!, it.f.color ?? "#ffffff");
      const mat = sp.material as THREE.SpriteMaterial;
      if (mat.map !== tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
      // Bật lên nhanh rồi trôi chậm, mờ dần ở cuối
      const rise = (1 - Math.pow(1 - Math.min(1, u * 1.6), 3)) * 1.3;
      const big = it.f.kind === "crit" ? 1.4 : it.f.kind === "coin" ? 0.85 : 1;
      const pop = (u < 0.12 ? 0.6 + (u / 0.12) * 0.55 : 1.15 - Math.min(0.15, (u - 0.12) * 0.6)) * big;
      const h = 0.46 * pop;
      sp.scale.set(h * aspect, h, 1);
      if (top) sp.position.set(it.f.x, it.f.y, zFloor(sim) + 2.2 + rise);
      else sp.position.set(it.f.x, it.f.y + 0.9 + rise, 1.2);
      mat.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: TEXT_POOL }, (_, i) => (
        <sprite key={i} visible={false} renderOrder={20}>
          <spriteMaterial transparent depthTest={false} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Vùng nguy hiểm

/** Điểm đặt hiệu ứng của vùng (chân cột / tâm vòng / giữa tia) */
function hazardBase(h: Hazard, sim: PlatformerSim): [number, number] {
  if (h.shape === "circle") return [h.x0, h.y0];
  if (h.shape === "line") return [(h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2];
  return [(h.x0 + h.x1) / 2, isTop(sim) ? (h.y0 + h.y1) / 2 : h.y0 + 0.3];
}

const HZ_POOL = 64;

function Hazards({ sim }: { sim: PlatformerSim }) {
  const planes = useRef<THREE.Group>(null);
  const discs = useRef<THREE.Group>(null);
  const geo = useMemo(
    () => ({
      plane: new THREE.PlaneGeometry(1, 1),
      disc: new THREE.CircleGeometry(1, 40),
      ring: new THREE.RingGeometry(0.9, 1, 48),
    }),
    [],
  );
  useFrame(({ clock }) => {
    const P = planes.current;
    const D = discs.current;
    if (!P || !D) return;
    const top = isTop(sim);
    const zf = zFloor(sim);
    const t = clock.elapsedTime;
    let np = 0;
    let nd = 0;
    const place = (o: THREE.Mesh, x: number, y: number, z: number, sx: number, sy: number, rot: number, col: [number, number, number], op: number) => {
      o.visible = true;
      o.position.set(x, y, z);
      o.rotation.set(0, 0, rot);
      o.scale.set(sx, sy, 1);
      const mat = o.material as THREE.MeshBasicMaterial;
      mat.color.setRGB(col[0], col[1], col[2]);
      mat.opacity = op;
    };
    for (const h of sim.hazards) {
      const warn = sim.time < h.liveAt;
      const live = !warn && sim.time <= h.endAt;
      const after = sim.time > h.endAt;
      const u = warn ? (sim.time - h.warnAt) / Math.max(0.05, h.liveAt - h.warnAt) : 1;
      const fadeOut = after ? Math.max(0, 1 - (sim.time - h.endAt) / 0.4) : 1;
      if (after && fadeOut <= 0) continue;
      const kc = HAZARD_RGB[h.kind];
      // Báo trước: nền đỏ mờ nhấp nháy dần nhanh + lõi sáng đầy dần; bùng: màu theo loại, sáng rực
      const blink = 0.5 + 0.5 * Math.sin(t * (10 + u * 26));
      const warnCol: [number, number, number] = [2.6, 0.25, 0.3];
      // Đi ngang: đặt trước mặt khối nền (z = DEPTH/2) để vòng báo không bị mặt đất che mất nửa dưới
      const z = top ? zf + 0.06 : DEPTH / 2 + 0.15;
      if (h.shape === "circle") {
        if (nd + 3 > D.children.length) continue;
        const base = D.children[nd++] as THREE.Mesh;
        const core = D.children[nd++] as THREE.Mesh;
        const ring = D.children[nd++] as THREE.Mesh;
        base.geometry = geo.disc;
        core.geometry = geo.disc;
        ring.geometry = geo.ring;
        if (warn) {
          place(base, h.x0, h.y0, z, h.r, h.r, 0, warnCol, 0.14 + blink * 0.12);
          place(core, h.x0, h.y0, z + 0.01, h.r * u, h.r * u, 0, warnCol, 0.3);
          place(ring, h.x0, h.y0, z + 0.02, h.r, h.r, 0, [3, 0.6, 0.5], 0.6 + blink * 0.4);
        } else {
          const k = live ? 1 : fadeOut;
          const s = h.r * (1 + (live ? 0.08 * Math.sin(t * 30) : 0.2 * (1 - fadeOut)));
          place(base, h.x0, h.y0, z, s, s, 0, kc, 0.75 * k);
          place(core, h.x0, h.y0, z + 0.01, s * 0.6, s * 0.6, 0, [3.2, 3.2, 3], 0.6 * k);
          place(ring, h.x0, h.y0, z + 0.02, s * 1.1, s * 1.1, 0, kc, 0.9 * k);
        }
      } else {
        if (np + 3 > P.children.length) continue;
        const base = P.children[np++] as THREE.Mesh;
        const core = P.children[np++] as THREE.Mesh;
        const edge = P.children[np++] as THREE.Mesh;
        let cx: number, cy: number, len: number, thick: number, rot: number;
        if (h.shape === "line") {
          cx = (h.x0 + h.x1) / 2;
          cy = (h.y0 + h.y1) / 2;
          len = Math.hypot(h.x1 - h.x0, h.y1 - h.y0);
          thick = h.r * 2;
          rot = Math.atan2(h.y1 - h.y0, h.x1 - h.x0);
        } else {
          cx = (h.x0 + h.x1) / 2;
          cy = (h.y0 + h.y1) / 2;
          len = h.x1 - h.x0;
          thick = h.y1 - h.y0;
          rot = 0;
        }
        if (warn) {
          place(base, cx, cy, z, len, thick, rot, warnCol, 0.12 + blink * 0.12);
          // Lõi đầy dần: tia thì chạy dọc chiều dài, cột thì dâng từ dưới lên
          if (h.shape === "line") place(core, cx, cy, z + 0.01, len, thick * u, rot, warnCol, 0.35);
          else place(core, cx, h.y0 + (thick * u) / 2, z + 0.01, len, thick * u, 0, warnCol, 0.3);
          place(edge, cx, cy, z + 0.02, len, h.shape === "line" ? 0.05 : thick, rot, [3, 0.6, 0.5], h.shape === "line" ? 0.8 * blink + 0.2 : 0.08);
        } else {
          const k = live ? 1 : fadeOut;
          const wob = live ? 1 + 0.12 * Math.sin(t * 40) : 1 + 0.4 * (1 - fadeOut);
          // Tia (laser) thì mảnh và sắc; cột / sàn thì dày
          const lineK = h.shape === "line" ? 0.7 : 1;
          place(base, cx, cy, z, len, thick * wob * lineK, rot, kc, 0.6 * k);
          place(core, cx, cy, z + 0.01, len, thick * 0.3 * wob * lineK, rot, [3.2, 3.2, 3.2], 0.85 * k);
          place(edge, cx, cy, z + 0.02, len * 1.02, thick * (h.shape === "line" ? 1.1 : 1.5) * wob, rot, kc, 0.18 * k);
        }
      }
    }
    for (let i = np; i < P.children.length; i++) P.children[i].visible = false;
    for (let i = nd; i < D.children.length; i++) D.children[i].visible = false;
  });
  const mat = () => <meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />;
  return (
    <>
      <group ref={planes}>
        {Array.from({ length: HZ_POOL * 3 }, (_, i) => (
          <mesh key={i} geometry={geo.plane} visible={false} renderOrder={4}>
            {mat()}
          </mesh>
        ))}
      </group>
      <group ref={discs}>
        {Array.from({ length: HZ_POOL * 3 }, (_, i) => (
          <mesh key={i} geometry={geo.disc} visible={false} renderOrder={4}>
            {mat()}
          </mesh>
        ))}
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Đạn đặc biệt của quái

const SPECIAL_POOL = 96;
const SPECIAL: Partial<Record<NonNullable<Shot["kind"]>, { rgb: [number, number, number]; scale: number; stretch: number }>> = {
  grenade: { rgb: [0.5, 0.55, 0.45], scale: 1.1, stretch: 1 },
  acid: { rgb: [0.8, 3.2, 0.5], scale: 1.4, stretch: 1.2 },
  bomb: { rgb: [0.35, 0.32, 0.4], scale: 1.6, stretch: 1.2 },
  orb: { rgb: [1.8, 0.8, 3.2], scale: 1.05, stretch: 1 },
  snipe: { rgb: [3.2, 0.5, 0.5], scale: 1, stretch: 7 },
  shard: { rgb: [3.2, 2.4, 0.6], scale: 1.2, stretch: 2.2 },
};

function SpecialShots({ sim }: { sim: PlatformerSim }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const glow = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const c = useMemo(() => new THREE.Color(), []);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  useFrame(({ clock }) => {
    const b = body.current;
    const g = glow.current;
    if (!b || !g) return;
    const top = isTop(sim);
    const zz = zFloor(sim) + (top ? 1 : 0.3);
    const t = clock.elapsedTime;
    let n = 0;
    for (const sh of sim.shots) {
      const spec = sh.kind && SPECIAL[sh.kind];
      if (!spec || n >= SPECIAL_POOL) continue;
      const ang = Math.atan2(sh.vy, sh.vx || 0.0001);
      q.setFromAxisAngle(zAxis, sh.kind === "grenade" || sh.kind === "bomb" ? t * 8 : ang);
      const r = sh.r * 2 * spec.scale;
      // Lựu đạn nhìn từ trên: nảy lên theo đường vòng cung (z) trong lúc bay
      let lift = 0;
      if (top && sh.lands && sh.maxLife) {
        const u = 1 - sh.life / sh.maxLife;
        lift = Math.sin(u * Math.PI) * 2.2;
      }
      m.compose(v.set(sh.x, sh.y, zz + lift), q, s.set(r * spec.stretch, r, r));
      b.setMatrixAt(n, m);
      // Lựu đạn đang chờ nổ: nháy đỏ ngày càng nhanh
      const armed = sh.kind === "grenade" && !sh.lands;
      const blink = armed ? (Math.sin(t * (14 + (1 - sh.life) * 30)) > 0 ? 1 : 0) : 0;
      b.setColorAt(n, armed && blink ? c.setRGB(3.2, 0.4, 0.3) : c.setRGB(...spec.rgb));
      const halo = sh.kind === "orb" ? 1.6 : 2.2;
      m.compose(v.set(sh.x, sh.y, zz + lift - 0.01), q, s.set(r * spec.stretch * halo, r * halo, r * halo));
      g.setMatrixAt(n, m);
      const gr = sh.kind === "grenade" || sh.kind === "bomb" ? (armed && blink ? [1.6, 0.2, 0.15] : [0.5, 0.3, 0.2]) : spec.rgb.map((x) => x * 0.35);
      g.setColorAt(n, c.setRGB(gr[0], gr[1], gr[2]));
      n++;
    }
    b.count = n;
    g.count = n;
    b.instanceMatrix.needsUpdate = true;
    g.instanceMatrix.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, SPECIAL_POOL]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 12, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glow} args={[undefined, undefined, SPECIAL_POOL]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 12, 8]} />
        <meshBasicMaterial toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Báo đòn của quái: tia ngắm đỏ (bắn tỉa), nháy sắp nổ, quầng nạp (laser, axit), khiên

const TELE_POOL = 24;

function Telegraphs({ sim }: { sim: PlatformerSim }) {
  const lines = useRef<THREE.Group>(null);
  const orbs = useRef<THREE.Group>(null);
  const shields = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const L = lines.current;
    const O = orbs.current;
    const S = shields.current;
    if (!L || !O || !S) return;
    const top = isTop(sim);
    const zf = zFloor(sim);
    const t = clock.elapsedTime;
    let nl = 0;
    let no = 0;
    let ns = 0;
    for (const e of sim.enemies) {
      if (!e.alive || !e.awake) continue;
      const cx = e.x;
      const cy = top ? e.y + e.h / 2 : e.y + e.h * 0.6;
      const z = top ? zf + 1.1 : 0.7;
      const k = sim.time - e.tele;
      if (e.trait === "sniper" && e.tele > 0 && nl < TELE_POOL) {
        // Tia ngắm: mảnh dần sáng dần, khoá mục tiêu thì nháy trắng
        const ox = top ? cx : cx + e.facing * 0.8;
        const oy = top ? cy : e.y + 1.35;
        const len = Math.hypot(e.aimX - ox, e.aimY - oy) + 4;
        const ang = Math.atan2(e.aimY - oy, e.aimX - ox);
        const locked = k >= T.traits.sniper.lock;
        const o = L.children[nl++] as THREE.Mesh;
        o.visible = true;
        o.position.set(ox + Math.cos(ang) * (len / 2), oy + Math.sin(ang) * (len / 2), z);
        o.rotation.set(0, 0, ang);
        o.scale.set(len, locked ? 0.07 : 0.035, 1);
        const mat = o.material as THREE.MeshBasicMaterial;
        const fl = locked && Math.sin(t * 50) > 0;
        mat.color.setRGB(fl ? 3.2 : 3.2, fl ? 3 : 0.3, fl ? 3 : 0.3);
        mat.opacity = 0.35 + 0.6 * Math.min(1, k / T.traits.sniper.aim);
      }
      const glowAt = (x: number, y: number, size: number, rgb: [number, number, number], op: number) => {
        if (no >= TELE_POOL) return;
        const o = O.children[no++] as THREE.Mesh;
        o.visible = true;
        o.position.set(x, y, z + 0.1);
        o.scale.setScalar(size);
        const mat = o.material as THREE.MeshBasicMaterial;
        mat.color.setRGB(...rgb);
        mat.opacity = op;
      };
      if (e.trait === "exploder" && e.tele > 0) {
        const u = Math.min(1, k / T.traits.exploder.fuse);
        const on = Math.sin(t * (12 + u * 40)) > 0;
        glowAt(cx, cy, 0.9 + u * 0.9, on ? [3.2, 0.5, 0.2] : [1.6, 0.3, 0.1], on ? 0.8 : 0.35);
      }
      if (e.trait === "laser" && e.tele > 0 && k < T.traits.laser.tele) glowAt(cx + (top ? 0 : e.facing * 0.5), top ? cy : e.y + 0.4, 0.3 + (k / T.traits.laser.tele) * 0.8, [3.2, 0.6, 2.4], 0.85);
      if (e.trait === "spitter" && e.tele > 0) glowAt(cx + (top ? 0 : e.facing * 0.4), top ? cy : e.y + 1.5, 0.3 + (k / T.traits.spitter.tele) * 0.5, [0.8, 3.2, 0.5], 0.8);
      if (e.trait === "shield" && e.tele > 0 && k < T.traits.shield.bashTele) glowAt(cx, cy, 1.4, [2.6, 3, 3.2], 0.25 + 0.25 * Math.sin(t * 30));
      if (e.trait === "shield" && e.shieldHp > 0 && ns < TELE_POOL) {
        // Khiên năng lượng trước mặt: nứt (mờ, nháy) khi còn 1 nhát
        const o = S.children[ns++] as THREE.Mesh;
        o.visible = true;
        const cracked = e.shieldHp <= 1;
        if (top) {
          const a = Math.atan2(e.aimY, e.aimX);
          o.position.set(cx + e.aimX * 0.7, cy + e.aimY * 0.7, zf + 1);
          o.rotation.set(Math.PI / 2, a + Math.PI / 2, 0, "ZXY");
          o.rotation.set(0, 0, a);
          o.scale.set(0.18, 1.6, 1.2);
        } else {
          o.position.set(cx + e.facing * 0.62, e.y + 1, 0.4);
          o.rotation.set(0, 0, 0);
          o.scale.set(0.16, 1.85, 1.3);
        }
        const mat = o.material as THREE.MeshBasicMaterial;
        const hurt = sim.time - e.hurtAt < 0.15;
        mat.color.setRGB(hurt ? 3.2 : 0.5, hurt ? 3.2 : 2.2, hurt ? 3.2 : 3.2);
        mat.opacity = cracked ? 0.25 + 0.2 * Math.sin(t * 25) : 0.5;
      }
    }
    for (let i = nl; i < L.children.length; i++) L.children[i].visible = false;
    for (let i = no; i < O.children.length; i++) O.children[i].visible = false;
    for (let i = ns; i < S.children.length; i++) S.children[i].visible = false;
  });
  const add = () => <meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />;
  return (
    <>
      <group ref={lines}>
        {Array.from({ length: TELE_POOL }, (_, i) => (
          <mesh key={i} visible={false} renderOrder={6}>
            <planeGeometry args={[1, 1]} />
            {add()}
          </mesh>
        ))}
      </group>
      <group ref={orbs}>
        {Array.from({ length: TELE_POOL }, (_, i) => (
          <mesh key={i} visible={false} renderOrder={6}>
            <sphereGeometry args={[0.5, 16, 12]} />
            {add()}
          </mesh>
        ))}
      </group>
      <group ref={shields}>
        {Array.from({ length: TELE_POOL }, (_, i) => (
          <mesh key={i} visible={false} renderOrder={6}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Vệt chém cận chiến: vành trăng khuyết quét qua, nhát kết liễu to và có hai lớp

const ARC_POOL = 12;

function MeleeArcs({ sim }: { sim: PlatformerSim }) {
  const outer = useRef<THREE.InstancedMesh>(null);
  const inner = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(
    () => ({
      outer: new THREE.RingGeometry(0.55, 1, 32, 1, -Math.PI * 0.5, Math.PI),
      inner: new THREE.RingGeometry(0.78, 0.95, 32, 1, -Math.PI * 0.45, Math.PI * 0.9),
    }),
    [],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const c = useMemo(() => new THREE.Color(), []);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  useFrame(() => {
    const a = outer.current;
    const b = inner.current;
    if (!a || !b) return;
    const top = isTop(sim);
    const zz = zFloor(sim) + (top ? 1 : 0.35);
    let n = 0;
    for (const sh of sim.shots) {
      if (sh.melee === undefined || n >= ARC_POOL) continue;
      const u = 1 - Math.max(0, sh.life / (sh.maxLife || 0.16));
      const dir = Math.atan2(sh.dy ?? 0, sh.dx ?? 1);
      // Quét từ trên xuống (nhát 2 quét ngược lại), nhát kết liễu quét rộng hơn
      const sweep = (sh.melee === 1 ? -1 : 1) * (sh.melee === 2 ? 1.2 : 0.9);
      const flip = (sh.dx ?? 1) < 0 ? -1 : 1;
      q.setFromAxisAngle(zAxis, dir + flip * sweep * (0.5 - u));
      const r = sh.r * (0.9 + u * 0.25);
      m.compose(v.set(sh.x - (sh.dx ?? 0) * 0.3, sh.y - (sh.dy ?? 0) * 0.3, zz), q, s.set(r, r, r));
      a.setMatrixAt(n, m);
      b.setMatrixAt(n, m);
      const k = 1 - u;
      const fin = sh.melee === 2;
      a.setColorAt(n, fin ? c.setRGB(3.2 * k, 2.2 * k, 0.6 * k) : c.setRGB(0.8 * k, 2.6 * k, 3.2 * k));
      b.setColorAt(n, c.setRGB(3.2 * k, 3.2 * k, 3.2 * k));
      n++;
    }
    a.count = n;
    b.count = n;
    a.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    if (a.instanceColor) a.instanceColor.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={outer} args={[geo.outer, undefined, ARC_POOL]} frustumCulled={false} renderOrder={7}>
        <meshBasicMaterial toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} opacity={0.7} />
      </instancedMesh>
      <instancedMesh ref={inner} args={[geo.inner, undefined, ARC_POOL]} frustumCulled={false} renderOrder={8}>
        <meshBasicMaterial toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

export function CombatFx({ sim }: { sim: PlatformerSim }) {
  return (
    <>
      <Hazards sim={sim} />
      <SpecialShots sim={sim} />
      <Telegraphs sim={sim} />
      <MeleeArcs sim={sim} />
      <Particles sim={sim} />
      <FloatTexts sim={sim} />
    </>
  );
}

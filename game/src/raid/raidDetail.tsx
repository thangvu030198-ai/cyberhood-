// Chi tiết đấu trường Leviathan:
// - Sinh vật: hồ quang điện bò dọc thân, nước bắn + vòng bọt ở chỗ thân xuyên mặt nước, vệt sóng sau đầu,
//   tia lửa khi trúng đạn, tia hơi thở sét thật (cột sáng nhấp nháy), cột nước khi quất đuôi / lao cắn.
// - Bầu trời: sét đánh xuống các cột thu lôi còn đứng và xuống mặt nước khi phóng điện.
// - Phố ngập: xe chìm nửa thân (model xe Meshy), đèn đường nhô khỏi nước nhấp nháy, biển quảng cáo holo EN/JP trên
//   cao ốc, đèn pha quét từ đỉnh tháp, trực thăng cảnh sát bay vòng rọi đèn, thùng hàng trôi.
// - Nguyên liệu cổ đại rơi dạng model 3D (Vảy Leviathan: model Meshy riêng; Sừng Sấm: pha lê; Lõi Tim Điện: lõi năng
//   lượng; Linh Hồn Biển Sâu: hồn ma) bay vòng cung từ chỗ bộ phận vỡ về người chơi.

import { Suspense, use, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extraModel, type ExtraModel } from "../game/assets";
import { useFitted } from "../game/Showcase";
import { RAID, type MaterialId, type RaidSim } from "./raidSim";

// ---------------------------------------------------------------------------
// Hồ quang dọc thân + nước bắn / bọt ở chỗ thân xuyên mặt nước + vệt sóng sau đầu

const ARCS = 48;
const SPLASH = 260;

export function LeviathanFx({ sim }: { sim: RaidSim }) {
  const arcs = useRef<THREE.InstancedMesh>(null);
  const foam = useRef<THREE.InstancedMesh>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const pool = useMemo(() => Array.from({ length: SPLASH }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, life: 0 })), []);
  const rings = useRef<{ x: number; z: number; at: number; s: number }[]>([]);
  const lastRing = useRef(0);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const d = useMemo(() => new THREE.Vector3(), []);
  const z = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const flat = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), []);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05);
    const t = clock.elapsedTime;
    const B = sim.body;
    const H = sim.head;
    // Hồ quang: đoạn thẳng gấp khúc ngẫu nhiên giữa hai đốt kề nhau, nháy liên tục
    const a = arcs.current;
    if (a && B.length) {
      let n = 0;
      const dead = sim.phase === "end";
      for (let k = 0; k < ARCS && !dead; k++) {
        const i = Math.floor(((k * 7.13 + Math.floor(t * 18) * 3.7) % 1) * (B.length - 2)) || (k % (B.length - 2));
        const p0 = B[i];
        const p1 = B[i + 1];
        const r = 3.2 * (1 - (i / B.length) * 0.6);
        const ang = (k * 2.4 + t * 9) % (Math.PI * 2);
        const ox = Math.cos(ang) * r;
        const oy = Math.sin(ang) * r + 0.6;
        const x0 = p0.x + ox * 0.9;
        const y0 = p0.y + oy;
        const z0 = p0.z + Math.sin(ang * 1.7) * r * 0.6;
        const x1 = p1.x + ox * (0.7 + Math.random() * 0.5);
        const y1 = p1.y + oy * (0.7 + Math.random() * 0.5);
        const z1 = p1.z - Math.sin(ang) * r * 0.5;
        d.set(x1 - x0, y1 - y0, z1 - z0);
        const len = d.length() || 1;
        q.setFromUnitVectors(z, d.divideScalar(len));
        m.compose(v.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), q, s.set(0.09, 0.09, len));
        a.setMatrixAt(n++, m);
      }
      a.count = n;
      a.instanceMatrix.needsUpdate = true;
    }
    // Chỗ thân xuyên mặt nước (đổi dấu độ cao so với y 0,35): nước bắn + vòng bọt
    const spawn = (x: number, zz: number, n: number, sp: number) => {
      for (let k = 0; k < n; k++) {
        const p = pool.find((o) => o.life <= 0);
        if (!p) return;
        const an = Math.random() * Math.PI * 2;
        p.x = x;
        p.y = 0.4;
        p.z = zz;
        p.vx = Math.cos(an) * sp * Math.random();
        p.vz = Math.sin(an) * sp * Math.random();
        p.vy = 3 + Math.random() * sp * 1.4;
        p.life = 0.6 + Math.random() * 0.6;
      }
    };
    if (B.length && t - lastRing.current > 0.12) {
      lastRing.current = t;
      for (let i = 0; i < B.length - 1; i += 1) {
        const y0 = B[i].y - 0.35;
        const y1 = B[i + 1].y - 0.35;
        if (y0 * y1 < 0) {
          spawn(B[i].x, B[i].z, 3, 4);
          if (Math.random() < 0.5) rings.current.push({ x: B[i].x, z: B[i].z, at: t, s: 3 + Math.random() * 2 });
        }
      }
      // Vệt sóng sau đầu khi đầu sát mặt nước
      if (H.y < 4 && sim.phase !== "end") rings.current.push({ x: H.x, z: H.z, at: t, s: 5 });
    }
    // Sự kiện mạnh: quất đuôi / cắn / nổ → cột nước lớn
    for (const w of sim.warns) {
      if (!w.done || w.byPlayer || (w as { splashed?: boolean }).splashed) continue;
      if (w.kind === "slam" || w.kind === "bite" || w.kind === "rain") {
        (w as { splashed?: boolean }).splashed = true;
        const x = w.kind === "bite" ? w.x1 : w.x0;
        const zz = w.kind === "bite" ? w.z1 : w.z0;
        spawn(x, zz, w.kind === "slam" ? 40 : 22, w.kind === "slam" ? 9 : 6);
        rings.current.push({ x, z: zz, at: t, s: w.r * 1.6 });
      }
    }
    const dr = drops.current;
    if (dr) {
      let n = 0;
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.vy -= 16 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.3) p.life = 0;
        m.compose(v.set(p.x, p.y, p.z), q.identity(), s.setScalar(0.12 + p.life * 0.18));
        dr.setMatrixAt(n++, m);
      }
      dr.count = n;
      dr.instanceMatrix.needsUpdate = true;
    }
    const f = foam.current;
    if (f) {
      rings.current = rings.current.filter((r) => t - r.at < 1.6);
      let n = 0;
      for (const r of rings.current) {
        if (n >= 120) break;
        const u = (t - r.at) / 1.6;
        m.compose(v.set(r.x, 0.42, r.z), flat, s.setScalar(r.s * (0.4 + u)));
        f.setMatrixAt(n++, m);
      }
      f.count = n;
      f.instanceMatrix.needsUpdate = true;
      (f.material as THREE.MeshBasicMaterial).opacity = 0.55;
    }
  });
  return (
    <>
      <instancedMesh ref={arcs} args={[undefined, undefined, ARCS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={[1.4, 3.2, 3.6]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={drops} args={[undefined, undefined, SPLASH]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color={[1.2, 1.6, 1.9]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={foam} args={[undefined, undefined, 120]} frustumCulled={false}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial color="#cfefff" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tia lửa khi trúng sinh vật / cột / lươn

const SPARKS = 220;
export function HitSparks({ sim }: { sim: RaidSim }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const pool = useMemo(() => Array.from({ length: SPARKS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, big: false })), []);
  const seen = useRef(0);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05);
    if (seen.current > sim.events.length) seen.current = sim.events.length;
    for (let i = seen.current; i < sim.events.length; i++) {
      const e = sim.events[i];
      if (e.kind !== "hit" && e.kind !== "boom") continue;
      const n = e.kind === "boom" ? (e.big ? 26 : 12) : e.byPlayer ? 6 : 3;
      for (let k = 0; k < n; k++) {
        const p = pool.find((o) => o.life <= 0);
        if (!p) break;
        const a = Math.random() * Math.PI * 2;
        const sp = (e.kind === "boom" ? 10 : 6) * (0.4 + Math.random());
        p.x = e.x;
        p.y = e.y;
        p.z = e.z;
        p.vx = Math.cos(a) * sp;
        p.vz = Math.sin(a) * sp;
        p.vy = 2 + Math.random() * sp;
        p.life = 0.3 + Math.random() * 0.35;
        p.big = e.kind === "boom";
      }
    }
    seen.current = sim.events.length;
    const o = ref.current;
    if (!o) return;
    let n = 0;
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      m.compose(v.set(p.x, p.y, p.z), q, s.setScalar((p.big ? 0.22 : 0.1) + p.life * 0.2));
      o.setMatrixAt(n++, m);
    }
    o.count = n;
    o.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={[3.2, 2.6, 1.2]} toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Tia hơi thở sét: cột sáng nhấp nháy từ miệng tới cuối dải, 0,6 s sau khi bùng

export function BreathBeams({ sim }: { sim: RaidSim }) {
  const group = useRef<THREE.Group>(null);
  // Ống trụ quay trục dài về Z để hướng theo tia
  const geo = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true).rotateX(Math.PI / 2), []);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const d = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    let n = 0;
    for (const w of sim.warns) {
      if (w.kind !== "breath" || !w.done || sim.time - w.liveAt > 0.6 || n >= g.children.length) continue;
      const o = g.children[n++] as THREE.Mesh;
      const H = sim.head;
      const y0 = H.y + 0.5;
      d.set(w.x1 - H.x, 0.8 - y0, w.z1 - H.z);
      const len = d.length();
      o.visible = true;
      o.position.set((H.x + w.x1) / 2, (y0 + 0.8) / 2, (H.z + w.z1) / 2);
      o.quaternion.setFromUnitVectors(zAxis, d.normalize());
      const u = (sim.time - w.liveAt) / 0.6;
      const r = w.r * (1 - u) * (0.75 + Math.sin(clock.elapsedTime * 60) * 0.25);
      o.scale.set(r, r, len);
    }
    for (; n < g.children.length; n++) g.children[n].visible = false;
  });
  return (
    <group ref={group}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={geo} visible={false}>
          <meshBasicMaterial color={[1.6, 3.4, 3.8]} toneMapped={false} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sét: đánh xuống cột thu lôi còn đứng (định kỳ) và xuống mặt nước khi phóng điện

function boltGeometry() {
  const pts: number[] = [];
  let x = 0;
  let z = 0;
  const N = 14;
  for (let i = 0; i < N; i++) {
    const y0 = 1 - i / N;
    const y1 = 1 - (i + 1) / N;
    const nx = x + (Math.random() - 0.5) * 0.18;
    const nz = z + (Math.random() - 0.5) * 0.18;
    pts.push(x, y0, z, nx, y1, nz);
    x = nx;
    z = nz;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

export function Lightning({ sim }: { sim: RaidSim }) {
  const geos = useMemo(() => Array.from({ length: 6 }, boltGeometry), []);
  const group = useRef<THREE.Group>(null);
  const bolts = useRef<{ x: number; z: number; y: number; at: number; g: number }[]>([]);
  const next = useRef(1);
  const seen = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const alive = sim.rods.filter((r) => r.alive);
    if (t > next.current && alive.length) {
      next.current = t + 1.2 + Math.random() * 2.5;
      const r = alive[Math.floor(Math.random() * alive.length)];
      bolts.current.push({ x: r.x, z: r.z, y: r.y + 9.5, at: t, g: Math.floor(Math.random() * 6) });
    }
    for (let i = seen.current; i < sim.events.length; i++) {
      if (sim.events[i].kind !== "zap") continue;
      for (let k = 0; k < 7; k++) bolts.current.push({ x: (Math.random() - 0.5) * 130, z: (Math.random() - 0.5) * 130, y: 0.4, at: t + k * 0.05, g: k % 6 });
    }
    seen.current = sim.events.length;
    bolts.current = bolts.current.filter((b) => t - b.at < 0.35);
    const g = group.current;
    if (!g) return;
    g.children.forEach((c, i) => {
      const b = bolts.current[i];
      c.visible = !!b && t >= b.at;
      if (!b) return;
      const l = c as THREE.LineSegments;
      l.geometry = geos[b.g];
      l.position.set(b.x, b.y, b.z);
      const h = 120 - b.y;
      l.scale.set(h * 0.6, h, h * 0.6);
      (l.material as THREE.LineBasicMaterial).opacity = 1 - (t - b.at) / 0.35;
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 12 }, (_, i) => (
        <lineSegments key={i} visible={false} frustumCulled={false}>
          <lineBasicMaterial color={[2.6, 3.4, 4]} toneMapped={false} transparent />
        </lineSegments>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Đạo cụ phố ngập

const CARS: [ExtraModel, number, number, number, number][] = [
  ["mx_car_taxi", -34, 30, 0.6, 0.25],
  ["mx_car_police", 64, -34, 2.1, -0.2],
  ["mx_car_sedan", -12, -48, 1.2, 0.3],
  ["mx_veh_bus", 30, 34, -0.5, -0.12],
  ["mx_car_van", -62, -14, 2.6, 0.18],
  ["mx_car_sports", 10, 58, 1.9, -0.3],
  ["mx_car_truck", -60, 50, 0.3, 0.1],
  ["mx_car_muscle", 60, -20, -1.1, 0.22],
];

function SunkCar({ name, x, z, ry, tilt }: { name: ExtraModel; x: number; z: number; ry: number; tilt: number }) {
  const { root } = useFitted(name, name === "mx_veh_bus" ? 11 : 4.6, "longest", 0.3);
  const o = useMemo(() => root.clone(true), [root]);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = -0.55 + Math.sin(clock.elapsedTime * 0.8 + x) * 0.06;
  });
  return (
    <group ref={ref} position={[x, -0.55, z]} rotation={[tilt, ry, tilt * 0.6]}>
      <primitive object={o} />
    </group>
  );
}

/** Đèn đường nhô khỏi mặt nước, thỉnh thoảng chập chờn */
function StreetLamps() {
  const lamps = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + 0.2;
      const R = 50 + (i % 3) * 9;
      out.push([Math.sin(a) * R, Math.cos(a) * R]);
    }
    return out.filter(([x, z]) => !(Math.abs(x) < 46 && z > -42 && z < 26) && RAID.towers.every((T) => Math.hypot(x - T.x, z - T.z) > T.r + 4) && RAID.roofs.every((r) => Math.abs(x - r.x) > r.half + 2 || Math.abs(z - r.z) > r.half + 2));
  }, []);
  const heads = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    heads.current?.children.forEach((c, i) => {
      const flick = Math.sin(t * 23 + i * 7) > 0.97 || (i % 5 === 0 && Math.sin(t * 3 + i) > 0.8);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setRGB(flick ? 0.3 : 3, flick ? 0.3 : 2.4, flick ? 0.3 : 1.4);
    });
  });
  return (
    <>
      {lamps.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation-y={Math.atan2(-x, -z)}>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.09, 0.12, 6, 6]} />
            <meshStandardMaterial color="#3a404a" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, 5.9, 0.7]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.06, 0.06, 1.4, 6]} />
            <meshStandardMaterial color="#3a404a" metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <group ref={heads}>
        {lamps.map(([x, z], i) => {
          const a = Math.atan2(-x, -z);
          return (
            <mesh key={i} position={[x + Math.sin(a) * 1.4, 5.8, z + Math.cos(a) * 1.4]}>
              <boxGeometry args={[0.5, 0.15, 0.3]} />
              <meshBasicMaterial color={[3, 2.4, 1.4]} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </>
  );
}

/** Biển quảng cáo holo EN/JP trên mặt cao ốc */
const ADS: [string, string, string][] = [
  ["LEVIATHAN ALERT", "警報 · 避難せよ", "#ff3d5a"],
  ["NEO BANK", "ネオ銀行 · 24H", "#36e7ff"],
  ["OMNI-DYNE", "未来を創る", "#ffd166"],
  ["RAMEN HOUSE", "ラーメン · 深夜営業", "#ff4fd8"],
  ["CHROME CLINIC", "義体クリニック", "#7dff9a"],
  ["FLOOD ZONE", "浸水区域 · 立入禁止", "#ff9a3c"],
];
function adTex([title, sub, color]: [string, string, string]) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")! as CanvasRenderingContext2D & { keepText?: boolean };
  g.keepText = true;
  g.fillStyle = "rgba(4,8,16,0.85)";
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = color;
  g.lineWidth = 8;
  g.shadowColor = color;
  g.shadowBlur = 20;
  g.strokeRect(10, 10, 492, 236);
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.font = "900 66px sans-serif";
  g.fillText(title, 256, 120);
  g.fillStyle = color;
  g.font = "700 40px sans-serif";
  g.fillText(sub, 256, 190);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function Billboards() {
  const texs = useMemo(() => ADS.map(adTex), []);
  const list = useMemo(
    () =>
      RAID.towers.flatMap((T, i) => {
        const w = T.r * 1.7;
        return [0, 1].map((k) => {
          const face = ((i + k * 2) % 4) * (Math.PI / 2) + i * 0.7;
          const d = w / 2 + 0.15;
          return { x: T.x + Math.sin(face) * d, z: T.z + Math.cos(face) * d, y: 14 + k * 16 + i * 4, ry: face, tex: texs[(i * 2 + k) % texs.length] };
        });
      }),
    [texs],
  );
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  useFrame(({ clock }) => {
    mats.current.forEach((m, i) => (m.opacity = 0.75 + Math.sin(clock.elapsedTime * 2 + i) * 0.15 + (Math.sin(clock.elapsedTime * 31 + i * 5) > 0.95 ? -0.5 : 0)));
  });
  return (
    <>
      {list.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} rotation-y={b.ry}>
          <planeGeometry args={[9, 4.5]} />
          <meshBasicMaterial ref={(m) => void (m && (mats.current[i] = m))} map={b.tex} toneMapped={false} transparent side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

/** Đèn pha quét từ đỉnh cao ốc */
function Searchlights() {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => new THREE.ConeGeometry(6, 70, 20, 1, true).translate(0, -35, 0), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((c, i) => {
      c.rotation.set(0.55 + Math.sin(t * 0.4 + i) * 0.25, t * 0.3 + i * 2.1, 0, "YXZ");
    });
  });
  return (
    <group ref={group}>
      {RAID.towers.map((T, i) => (
        <mesh key={i} geometry={geo} position={[T.x, T.h - 2, T.z]}>
          <meshBasicMaterial color="#bfe8ff" transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Trực thăng cảnh sát bay vòng trên đấu trường, rọi đèn xuống sinh vật */
function Chopper({ sim }: { sim: RaidSim }) {
  const { root } = useFitted("helicopter" as ExtraModel, 9, "longest", 0.35);
  const ref = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.ConeGeometry(3, 1, 16, 1, true).translate(0, -0.5, 0), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.12;
    const o = ref.current;
    if (!o) return;
    o.position.set(Math.sin(t) * 70, 46 + Math.sin(t * 3) * 3, Math.cos(t) * 60);
    o.rotation.set(0.08, t + Math.PI / 2, 0.12);
    const b = beam.current;
    if (b) {
      const H = sim.head;
      const dx = H.x - o.position.x;
      const dy = H.y - o.position.y;
      const dz = H.z - o.position.z;
      const len = Math.hypot(dx, dy, dz);
      b.position.copy(o.position);
      b.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx, dy, dz).normalize());
      b.scale.set(1, len, 1);
    }
  });
  return (
    <>
      <group ref={ref}>
        <primitive object={root} />
        <pointLight color="#ff3344" intensity={8} distance={14} position={[0, -1, 0]} />
      </group>
      <mesh ref={beam} geometry={geo}>
        <meshBasicMaterial color="#e8f6ff" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** Thùng hàng trôi dập dềnh */
function Debris() {
  const { root } = useFitted("mx_supply_crate" as ExtraModel, 1.6, "height", 0.3);
  const list = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const o = root.clone(true);
        const a = i * 2.39;
        const R = 20 + ((i * 17) % 50);
        return { o, x: Math.sin(a) * R, z: Math.cos(a) * R - 6, p: i };
      }).filter(({ x, z }) => RAID.roofs.every((r) => Math.abs(x - r.x) > r.half + 1 || Math.abs(z - r.z) > r.half + 1)),
    [root],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const d of list) {
      d.o.position.set(d.x + Math.sin(t * 0.2 + d.p) * 1.5, -0.2 + Math.sin(t * 1.3 + d.p) * 0.12, d.z + Math.cos(t * 0.17 + d.p) * 1.5);
      d.o.rotation.set(Math.sin(t + d.p) * 0.12, t * 0.1 + d.p, Math.cos(t * 0.9 + d.p) * 0.1);
    }
  });
  return (
    <>
      {list.map((d, i) => (
        <primitive key={i} object={d.o} />
      ))}
    </>
  );
}

export function StreetDressing({ sim }: { sim: RaidSim }) {
  return (
    <>
      {CARS.map(([n, x, z, ry, tilt]) => (
        <Suspense key={n} fallback={null}>
          <SunkCar name={n} x={x} z={z} ry={ry} tilt={tilt} />
        </Suspense>
      ))}
      <StreetLamps />
      <Billboards />
      <Searchlights />
      <Suspense fallback={null}>
        <Chopper sim={sim} />
        <Debris />
      </Suspense>
    </>
  );
}

// ---------------------------------------------------------------------------
// Nguyên liệu cổ đại rơi dạng model 3D, bay vòng cung về người chơi

function useMatModel(mat: MaterialId) {
  const raid = use(extraModel("mx_raid_all"));
  const crystal = use(extraModel("mx_wz_crystal" as ExtraModel));
  const core = use(extraModel("mx_sg_core" as ExtraModel));
  const vfx = use(extraModel("mx_vfx_all" as ExtraModel));
  return useMemo(() => {
    const src = mat === "lev_scale" ? (raid.scene.getObjectByName("rd_scale") ?? raid.scene) : mat === "lev_horn" ? crystal.scene : mat === "lev_core" ? core.scene : (vfx.scene.getObjectByName("vfx_skull_orb") ?? vfx.scene);
    const o = src.clone(true);
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    o.position.sub(c);
    const w = new THREE.Group();
    w.add(o);
    w.scale.setScalar(1.4 / Math.max(size.x, size.y, size.z, 1e-3));
    const tint = { lev_scale: "#36e7ff", lev_horn: "#ffd166", lev_core: "#ff4fd8", lev_soul: "#c38bff" }[mat];
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (!m.isMesh) return;
      const mm = (m.material as THREE.MeshStandardMaterial).clone();
      mm.emissive = new THREE.Color(tint);
      mm.emissiveMap = mm.map ?? null;
      mm.emissiveIntensity = 1.4;
      mm.toneMapped = false;
      m.material = mm;
    });
    return w;
  }, [mat, raid, crystal, core, vfx]);
}

function MatFlyer({ sim, mat, from, at }: { sim: RaidSim; mat: MaterialId; from: { x: number; y: number; z: number }; at: number }) {
  const model = useMatModel(mat);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    const u = Math.min(1, (sim.time - at) / 1.6);
    const P = sim.player;
    o.visible = u < 1;
    o.position.set(from.x + (P.x - from.x) * u, from.y + (P.y + 1.4 - from.y) * u + Math.sin(u * Math.PI) * 9, from.z + (P.z - from.z) * u);
    o.rotation.set(u * 6, u * 9, 0);
    o.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.6);
  });
  return (
    <group ref={ref}>
      <primitive object={model} />
      <pointLight color="#ffffff" intensity={6} distance={6} />
    </group>
  );
}

export function MaterialDrops({ sim }: { sim: RaidSim }) {
  // Mỗi sự kiện "material" ghép với vị trí bộ phận vỡ gần nhất trước đó (hoặc đầu rắn)
  const list = useRef<{ key: number; mat: MaterialId; from: { x: number; y: number; z: number }; at: number }[]>([]);
  const seen = useRef(0);
  const [, force] = useForce();
  useFrame(() => {
    let changed = false;
    for (let i = seen.current; i < sim.events.length; i++) {
      const e = sim.events[i];
      if (e.kind !== "material") continue;
      const brk = sim.events.slice(Math.max(0, i - 4), i).reverse().find((x) => x.kind === "break");
      const from = brk && brk.kind === "break" ? sim.partPos(brk.part) : { x: sim.head.x, y: sim.head.y + 2, z: sim.head.z };
      for (let k = 0; k < Math.min(4, e.n); k++) list.current.push({ key: i * 10 + k, mat: e.mat, from: { x: from.x + k, y: from.y, z: from.z }, at: sim.time + k * 0.12 });
      changed = true;
    }
    seen.current = sim.events.length;
    const before = list.current.length;
    list.current = list.current.filter((d) => sim.time - d.at < 2);
    if (changed || before !== list.current.length) force();
  });
  return (
    <>
      {list.current.map((d) => (
        <Suspense key={d.key} fallback={null}>
          <MatFlyer sim={sim} mat={d.mat} from={d.from} at={d.at} />
        </Suspense>
      ))}
    </>
  );
}

function useForce() {
  const [n, set] = useState(0);
  return [n, () => set((x) => x + 1)] as const;
}

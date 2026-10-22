// Cao ốc chi tiết cho đấu trường Leviathan (Neon City ngập nước), dựng thủ tục rồi GỘP LƯỚI theo vật liệu
// (vài lượt vẽ cho cả trăm toà nhà, không bị khe hở / gãy hình vì mỗi khối là hộp kín, UV tính theo mét):
// - Bệ toà (2 tầng cửa hàng): kính sáng, mái hiên, biển hiệu EN/JP
// - Thân: cửa sổ theo tầng (kết cấu 16 m × 16 m ngẫu nhiên đèn bật / tắt), gờ ngang mỗi 8 m, cột neon ở 4 góc
// - Tầng lùi (toà cao): thân hẹp hơn phía trên
// - Mái: phòng kỹ thuật, bồn nước, máy lạnh, ăng-ten có đèn đỏ nhấp nháy, sân đỗ trực thăng
// - Biển dọc chữ Nhật trên mặt toà, máy lạnh bám tường

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CylinderCollider, CuboidCollider, RigidBody } from "@react-three/rapier";
import { RAID } from "./raidSim";

type Rng = () => number;
const rngOf = (seed: number): Rng => {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/** Kết cấu mặt toà: 16 m × 16 m, mỗi ô cửa 1,6 m × 2 m, đèn bật ngẫu nhiên theo màu ấm / lạnh / hồng */
function facadeTexture(seed: number) {
  const r = rngOf(seed);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#121822";
  g.fillRect(0, 0, 512, 512);
  // Khung tầng
  g.fillStyle = "#1c2430";
  for (let y = 0; y < 8; y++) g.fillRect(0, y * 64 + 56, 512, 8);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 10; x++) {
      const on = r();
      g.fillStyle = on > 0.8 ? "#ffd99a" : on > 0.7 ? "#9fe6ff" : on > 0.66 ? "#ff8ad8" : on > 0.6 ? "#3a4a66" : "#0b1018";
      g.fillRect(6 + x * 51, y * 64 + 10, 40, 40);
      // Rèm / bóng người
      if (on > 0.6 && r() > 0.6) {
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.fillRect(6 + x * 51, y * 64 + 10, 40, 14 + r() * 20);
      }
      g.fillStyle = "rgba(255,255,255,0.06)";
      g.fillRect(6 + x * 51, y * 64 + 10, 3, 40);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Hộp có UV tính theo mét (lặp kết cấu mỗi `tile` mét) để cửa sổ đều nhau trên mọi kích thước */
function box(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, tile = 16) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Thứ tự mặt: +x, −x, +y, −y, +z, −z (4 đỉnh mỗi mặt)
  const size = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * size[f][0]) / tile, (uv.getY(i) * size[f][1]) / tile);
    }
  g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function colorize(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}

const NEON = ["#36e7ff", "#ff4fd8", "#ffd166", "#7dff9a", "#ff6a3c", "#b18cff"].map((c) => new THREE.Color(c).multiplyScalar(2.6));

type Spec = { x: number; z: number; w: number; d: number; h: number; ry: number; seed: number; base: number; detail: boolean };

/** Sinh các khối của một toà: thân (kính cửa sổ), kim loại (gờ, mái, máy lạnh…), neon (vạch sáng) */
function building(s: Spec, out: { shell: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[]; neon: THREE.BufferGeometry[]; blink: THREE.Vector3[] }) {
  const r = rngOf(s.seed);
  const cos = Math.cos(s.ry);
  const sin = Math.sin(s.ry);
  const P = (lx: number, lz: number) => [s.x + lx * cos + lz * sin, s.z - lx * sin + lz * cos] as const;
  const add = (arr: THREE.BufferGeometry[], w: number, h: number, d: number, lx: number, y: number, lz: number, tile = 16) => {
    const [x, z] = P(lx, lz);
    arr.push(box(w, h, d, x, y, z, s.ry, tile));
  };
  const neon = (w: number, h: number, d: number, lx: number, y: number, lz: number, c: THREE.Color) => {
    const [x, z] = P(lx, lz);
    out.neon.push(colorize(box(w, h, d, x, y, z, s.ry), c));
  };
  const col = NEON[Math.floor(r() * NEON.length)];
  const col2 = NEON[Math.floor(r() * NEON.length)];
  const y0 = s.base;
  // Bệ toà: rộng hơn 1,2 m, cao 7 m, có mái hiên và vạch neon
  const podium = 7;
  add(out.shell, s.w + 2.4, podium, s.d + 2.4, 0, y0 + podium / 2, 0, 8);
  add(out.metal, s.w + 3.4, 0.35, s.d + 3.4, 0, y0 + podium + 0.17, 0);
  neon(s.w + 3.5, 0.18, 0.18, 0, y0 + podium - 0.3, (s.d + 3.5) / 2, col);
  neon(s.w + 3.5, 0.18, 0.18, 0, y0 + podium - 0.3, -(s.d + 3.5) / 2, col);
  // Thân chính + tầng lùi
  const tiers = s.h > 50 ? 3 : s.h > 30 ? 2 : 1;
  let y = y0 + podium;
  let w = s.w;
  let d = s.d;
  const rest = s.h - podium;
  for (let t = 0; t < tiers; t++) {
    const th = (rest / tiers) * (t === tiers - 1 ? 0.9 : 1.05);
    add(out.shell, w, th, d, 0, y + th / 2, 0);
    // Gờ ngang mỗi 8 m
    if (s.detail) for (let k = 8; k < th - 1; k += 8) add(out.metal, w + 0.6, 0.28, d + 0.6, 0, y + k, 0);
    // Cột neon 4 góc
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      neon(0.22, th, 0.22, (sx * w) / 2, y + th / 2, (sz * d) / 2, t % 2 ? col2 : col);
    // Máy lạnh bám tường mặt trước
    if (s.detail)
      for (let k = 0; k < Math.min(10, th / 5); k++) {
        if (r() < 0.45) continue;
        add(out.metal, 1.1, 0.7, 0.6, (r() - 0.5) * (w - 2), y + 3 + r() * (th - 5), d / 2 + 0.3);
      }
    // Biển dọc chữ Nhật trên tầng đầu
    if (t === 0 && r() < 0.7) neon(0.25, Math.min(14, th * 0.7), 1.6, w / 2 + 0.2, y + th * 0.45, (r() - 0.5) * d * 0.6, col2);
    y += th;
    // Sân thượng tầng lùi: lan can neon
    if (t < tiers - 1) {
      neon(w, 0.12, 0.12, 0, y + 0.8, d / 2, col);
      w *= 0.78;
      d *= 0.78;
    }
  }
  // Mái: phòng kỹ thuật, bồn nước, máy lạnh, ăng-ten có đèn đỏ
  add(out.metal, w + 0.4, 0.5, d + 0.4, 0, y + 0.25, 0);
  add(out.metal, w * 0.4, 3, d * 0.35, -w * 0.15, y + 2, d * 0.1);
  if (s.detail) {
    for (let k = 0; k < 4; k++) add(out.metal, 1.4, 1, 1.2, (r() - 0.5) * w * 0.7, y + 1, (r() - 0.5) * d * 0.7);
    const [tx, tz] = P(w * 0.28, -d * 0.25);
    const tank = new THREE.CylinderGeometry(1.1, 1.1, 2.4, 14);
    tank.translate(tx, y + 2.2, tz);
    out.metal.push(tank);
    const leg = new THREE.CylinderGeometry(0.12, 0.12, 1, 6);
    leg.translate(tx, y + 0.9, tz);
    out.metal.push(leg);
  }
  const [ax, az] = P(w * 0.2, d * 0.2);
  const mast = new THREE.CylinderGeometry(0.08, 0.2, 9, 6);
  mast.translate(ax, y + 4.5, az);
  out.metal.push(mast);
  out.blink.push(new THREE.Vector3(ax, y + 9.2, az));
}

export function CityBlocks() {
  const data = useMemo(() => {
    const shell: THREE.BufferGeometry[] = [];
    const metal: THREE.BufferGeometry[] = [];
    const neon: THREE.BufferGeometry[] = [];
    const blink: THREE.Vector3[] = [];
    // 3 cao ốc giữa phố (rắn quấn quanh) – đầy đủ chi tiết
    RAID.towers.forEach((T, i) => building({ x: T.x, z: T.z, w: T.r * 1.7, d: T.r * 1.7, h: T.h, ry: i * 0.7, seed: 101 + i, base: -4, detail: true }, { shell, metal, neon, blink }));
    // Viền thành phố: 2 vòng toà cao thấp xen kẽ, chìm nửa thân
    const r = rngOf(7);
    for (let ring = 0; ring < 2; ring++)
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2 + ring * 0.1 + (r() - 0.5) * 0.05;
        const R = 104 + ring * 26 + r() * 8;
        building({ x: Math.sin(a) * R, z: Math.cos(a) * R, w: 11 + r() * 9, d: 11 + r() * 8, h: 26 + r() * (ring ? 70 : 40), ry: -a, seed: 300 + ring * 50 + i, base: -5, detail: ring === 0 }, { shell, metal, neon, blink });
      }
    return { shell: mergeGeometries(shell)!, metal: mergeGeometries(metal.map((g) => g.index ? g.toNonIndexed() : g).map((g) => (g.deleteAttribute("uv"), g)))!, neon: mergeGeometries(neon.map((g) => (g.deleteAttribute("uv"), g.deleteAttribute("normal"), g)))!, blink };
  }, []);
  const facade = useMemo(() => facadeTexture(42), []);
  const lights = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    const o = lights.current;
    if (!o) return;
    const on = Math.sin(clock.elapsedTime * 3) > 0;
    const m = new THREE.Matrix4();
    data.blink.forEach((p, i) => {
      m.makeScale(on ? 0.45 : 0.15, on ? 0.45 : 0.15, on ? 0.45 : 0.15).setPosition(p);
      o.setMatrixAt(i, m);
    });
    o.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <mesh geometry={data.shell}>
        <meshStandardMaterial map={facade} emissiveMap={facade} emissive="#ffffff" emissiveIntensity={0.85} color="#3c4a5e" roughness={0.25} metalness={0.65} />
      </mesh>
      <mesh geometry={data.metal}>
        <meshStandardMaterial color="#2a3038" roughness={0.6} metalness={0.7} />
      </mesh>
      <mesh geometry={data.neon}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <instancedMesh ref={lights} args={[undefined, undefined, data.blink.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={[3.4, 0.3, 0.3]} toneMapped={false} />
      </instancedMesh>
      <RigidBody type="fixed" colliders={false}>
        {RAID.towers.map((T, i) => (
          <CylinderCollider key={i} args={[T.h / 2, T.r + 1.2]} position={[T.x, T.h / 2 - 4, T.z]} />
        ))}
        {RAID.towers.map((T, i) => (
          <CuboidCollider key={`p${i}`} args={[T.r * 0.85 + 1.2, 3.5, T.r * 0.85 + 1.2]} position={[T.x, -0.5, T.z]} rotation={[0, i * 0.7, 0]} />
        ))}
      </RigidBody>
    </>
  );
}

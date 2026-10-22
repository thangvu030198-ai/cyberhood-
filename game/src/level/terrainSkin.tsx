// Lớp da địa hình dựng bằng model thật (Meshy) thay cho khối hộp kẻ ô:
// - Hollow Hotel: nhịp cầu đá gothic có lan can + vòm dưới gầm cho các dải cầu mỏng; bậc nhảy là gờ đá treo xích
// - Citadel: tường pháo đài bọc thép (ống, lỗ thông gió, đèn báo) ghép khối 2×2; bậc nhảy là sàn thép vạch cảnh báo
// - Hẻm Pha Lê (bay): vách hẻm là những tảng đá bazan có mạch pha lê, xoay / cao thấp ngẫu nhiên cho tự nhiên
// - Khu Săn Neon: dãy nhà phố thật (model toà nhà của sảnh) trên vỉa hè, giữa là đường nhựa có vạch kẻ
// - Giáo Xứ Neon: hàng rào sắt nghĩa địa, hàng ghế nhà thờ gãy, bia mộ, thánh giá đá, cây chết, chân nến
// Va chạm vẫn theo lưới ô của mô phỏng; model được co giãn khớp đúng mép ô.

import { Suspense, use, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { extraModel, type ExtraModel } from "../game/assets";
import type { PlatformerSim } from "./platformer";
import { mergeRects } from "./cityBlocks";

const DEPTH = 4;
const FLOOR = -2;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Gộp mọi mesh của model thành một lưới (đặt gốc ở giữa đáy) để vẽ hàng loạt bằng InstancedMesh */
function useInstanceSource(name: ExtraModel, selfLit = 0.3) {
  const gltf = use(extraModel(name));
  return useMemo(() => {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [];
    let material: THREE.MeshStandardMaterial | null = null;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      geos.push(g.index ? g : g);
      if (!material) material = (m.material as THREE.MeshStandardMaterial).clone();
    });
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false) ?? geos[0];
    merged.computeBoundingBox();
    const box = merged.boundingBox!;
    const size = box.getSize(new THREE.Vector3());
    // Gốc toạ độ: giữa đáy hộp bao
    merged.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const mat = material ?? new THREE.MeshStandardMaterial();
    const std = mat as THREE.MeshStandardMaterial;
    if (std.map && selfLit > 0) {
      std.emissiveMap = std.map;
      std.emissive = new THREE.Color("#ffffff");
      std.emissiveIntensity = selfLit;
    }
    return { geometry: merged, material: mat, size };
  }, [gltf, selfLit]);
}

/** Một vật cần đặt: gốc giữa đáy tại (x, y, z), kích thước mong muốn rộng w × cao h × sâu d, xoay quanh trục đứng */
type Placed = { x: number; y: number; z: number; w: number; h: number; d: number; rot?: number; tilt?: THREE.Quaternion };

/** Vẽ hàng loạt một model theo danh sách vị trí; tỉ lệ co giãn tính từ hộp bao thật của model */
function ModelSet({ name, items, selfLit = 0.3 }: { name: ExtraModel; items: Placed[]; selfLit?: number }) {
  const src = useInstanceSource(name, selfLit);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(src.geometry, src.material, Math.max(1, items.length));
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const mat = new THREE.Matrix4();
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot ?? 0);
      if (it.tilt) q.multiply(it.tilt);
      m.setMatrixAt(i, mat.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.w / src.size.x, it.h / src.size.y, it.d / src.size.z)));
    });
    m.count = items.length;
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    return m;
  }, [src, items]);
  return <primitive object={mesh} />;
}

// Tỉ lệ model gốc [rộng, cao, sâu] (đo từ file Meshy) và độ cao mặt sàn trong model (phần trăm chiều cao)
const DIMS = {
  bridge: { size: [1.9, 0.59, 0.72], deck: 0.67 },
  ledge: { size: [1.9, 0.91, 1.13], deck: 0.93 },
} as const;

// ---------------------------------------------------------------------------
// Màn đi ngang

/** Ô đặc thuộc "dải mỏng" (cầu): cột đặc chứa nó dày ≤ 2 ô và không chạm đáy map */
export function thinCell(sim: PlatformerSim, c: number, r: number) {
  if (sim.tile(c, r) !== "#") return false;
  let lo = r;
  while (lo > 0 && sim.tile(c, lo - 1) === "#") lo--;
  let hi = r;
  while (hi < sim.height - 1 && sim.tile(c, hi + 1) === "#") hi++;
  return lo > 0 && hi - lo + 1 <= 2;
}

/** Dải liên tục theo hàng của các ô thoả `pick` (chỉ lấy hàng trên cùng của dải) */
function runs(sim: PlatformerSim, pick: (c: number, r: number) => boolean) {
  const out: { c0: number; c1: number; r: number }[] = [];
  for (let r = 0; r < sim.height; r++) {
    let c = 0;
    while (c < sim.width) {
      if (!pick(c, r)) {
        c++;
        continue;
      }
      const c0 = c;
      while (c < sim.width && pick(c, r)) c++;
      out.push({ c0, c1: c, r });
    }
  }
  return out;
}

/** Map nào được phủ da model (Tiles bỏ vẽ những ô này) */
export function skinSkips(sim: PlatformerSim): ((c: number, r: number, t: string) => boolean) | null {
  const th = sim.def.theme;
  if (sim.mode !== "platform") return null;
  if (th === "hotel") return (c, r, t) => (t === "#" && thinCell(sim, c, r)) || t === "=";
  if (th === "skyline") return (_c, _r, t) => t === "#" || t === "=";
  return null;
}

function HotelSkin({ sim }: { sim: PlatformerSim }) {
  const data = useMemo(() => {
    const bridges: Placed[] = [];
    const ledges: Placed[] = [];
    const [bw, bh, bd] = DIMS.bridge.size;
    const [lw, lh, ld] = DIMS.ledge.size;
    // Mặt cầu: hàng trên cùng của dải mỏng
    for (const run of runs(sim, (c, r) => thinCell(sim, c, r) && sim.tile(c, r + 1) !== "#")) {
      const len = run.c1 - run.c0;
      const n = Math.max(1, Math.round(len / 3.4));
      const seg = len / n;
      const k = seg / bw;
      for (let i = 0; i < n; i++) {
        const h = bh * k;
        // Mặt cầu (67% chiều cao model) trùng mặt trên của ô
        bridges.push({ x: run.c0 + seg * (i + 0.5), y: run.r + 1 - h * DIMS.bridge.deck, z: 0, w: seg * 1.01, h, d: bd * k * 1.6 });
      }
    }
    for (const run of runs(sim, (c, r) => sim.tile(c, r) === "=")) {
      const len = run.c1 - run.c0;
      const k = Math.min(1.5, len / lw);
      const h = lh * k;
      ledges.push({ x: (run.c0 + run.c1) / 2, y: run.r + 1 - h * DIMS.ledge.deck, z: 0, w: len, h, d: ld * k * 1.4 });
    }
    return { bridges, ledges };
  }, [sim]);
  return (
    <Suspense fallback={null}>
      <ModelSet name="mx_tr_gothic_bridge" items={data.bridges} selfLit={0.35} />
      <ModelSet name="mx_tr_gothic_ledge" items={data.ledges} selfLit={0.4} />
    </Suspense>
  );
}

function CitadelSkin({ sim }: { sim: PlatformerSim }) {
  const data = useMemo(() => {
    const walls: Placed[] = [];
    const used = new Set<number>();
    const id = (c: number, r: number) => r * sim.width + c;
    const free = (c: number, r: number) => sim.tile(c, r) === "#" && !used.has(id(c, r)) && c >= 0 && c < sim.width && r >= 0;
    const r0 = rng(sim.width * 31 + 7);
    // Ghép tham lam khối 2×2 (ô thép to như tấm bọc pháo đài), còn lại 1×1
    for (let r = 0; r < sim.height; r++)
      for (let c = 0; c < sim.width; c++) {
        if (!free(c, r)) continue;
        const big = free(c + 1, r) && free(c, r + 1) && free(c + 1, r + 1);
        const s = big ? 2 : 1;
        for (let y = r; y < r + s; y++) for (let x = c; x < c + s; x++) used.add(id(x, y));
        // Lật ngẫu nhiên trái phải cho đỡ lặp
        walls.push({ x: c + s / 2, y: r, z: 0, w: s * 1.002, h: s * 1.002, d: DEPTH, rot: r0() < 0.5 ? 0 : Math.PI });
      }
    const cats: Placed[] = [];
    for (const run of runs(sim, (c, r) => sim.tile(c, r) === "=")) {
      const len = run.c1 - run.c0;
      cats.push({ x: (run.c0 + run.c1) / 2, y: run.r + 1 - 0.3, z: 0, w: len, h: 0.32, d: DEPTH * 0.6 });
    }
    return { walls, cats };
  }, [sim]);
  return (
    <Suspense fallback={null}>
      <ModelSet name="mx_tr_scifi_wall" items={data.walls} selfLit={0.35} />
      <ModelSet name="mx_tr_scifi_catwalk" items={data.cats} selfLit={0.6} />
    </Suspense>
  );
}

export function SideSkin({ sim }: { sim: PlatformerSim }) {
  if (sim.mode !== "platform") return null;
  if (sim.def.theme === "hotel") return <HotelSkin sim={sim} />;
  if (sim.def.theme === "skyline") return <CitadelSkin sim={sim} />;
  return null;
}

// ---------------------------------------------------------------------------
// Màn nhìn từ trên / bay (toạ độ thế giới: x, mặt sàn y = -2, z = -y mô phỏng)

/** Hẻm Pha Lê: vách đá bazan mạch pha lê */
function CrystalCanyon({ sim }: { sim: PlatformerSim }) {
  const items = useMemo(() => {
    const r0 = rng(sim.width * 13 + 5);
    const out: Placed[] = [];
    const used = new Set<number>();
    const id = (c: number, r: number) => r * sim.width + c;
    const free = (c: number, r: number) => sim.tile(c, r) === "#" && !used.has(id(c, r)) && c >= 0 && c < sim.width && r >= 0 && r < sim.height;
    for (let r = 0; r < sim.height; r++)
      for (let c = 0; c < sim.width; c++) {
        if (!free(c, r)) continue;
        const big = free(c + 1, r) && free(c, r + 1) && free(c + 1, r + 1);
        const s = big ? 2 : 1;
        for (let y = r; y < r + s; y++) for (let x = c; x < c + s; x++) used.add(id(x, y));
        // Tảng đá to hơn ô một chút cho kín khe, cao thấp và xoay ngẫu nhiên
        const k = s * (1.18 + r0() * 0.2);
        const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler((r0() - 0.5) * 0.3, 0, (r0() - 0.5) * 0.3));
        out.push({ x: c + s / 2, y: FLOOR - 0.4, z: -(r + s / 2), w: k, h: (1.8 + r0() * 2.6) * (big ? 1.2 : 0.9), d: k, rot: r0() * Math.PI * 2, tilt });
      }
    return out;
  }, [sim]);
  return (
    <Suspense fallback={null}>
      <ModelSet name="mx_tr_crystal_rock" items={items} selfLit={0.55} />
    </Suspense>
  );
}

// Toà nhà rộng (hợp khối phố dẹt), kích thước gốc [rộng, cao, sâu]
const WIDE_BUILDINGS: [ExtraModel, number, number, number][] = [
  ["mx_bld_shoprow", 1.9, 1.33, 1.9],
  ["mx_bld_noodle_bar", 1.88, 1.33, 1.9],
  ["mx_bld_police_station", 1.89, 1.11, 1.9],
  ["mx_bld_clinic", 1.72, 1.1, 1.9],
  ["mx_bld_hotel", 1.9, 1.35, 1.85],
  ["mx_bld_nightclub", 1.9, 0.74, 1.36],
  ["mx_bld_factory", 1.86, 1.82, 1.85],
  ["mx_bld_apartment", 1.61, 1.9, 1.53],
];

function Building({ name, x, z, w, d, h, rot }: { name: ExtraModel; x: number; z: number; w: number; d: number; h: number; rot: number }) {
  const gltf = use(extraModel(name));
  const obj = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const g = new THREE.Group();
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x, -box.min.y, -c.z);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.map) {
        mat.emissiveMap = mat.map;
        mat.emissive = new THREE.Color("#ffffff");
        mat.emissiveIntensity = 0.45;
      }
      m.material = mat;
    });
    const inner = new THREE.Group();
    inner.add(s);
    // Xoay 90° thì đổi rộng / sâu
    const sw = rot % Math.PI === 0 ? size.x : size.z;
    const sd = rot % Math.PI === 0 ? size.z : size.x;
    inner.rotation.y = rot;
    g.add(inner);
    g.scale.set(w / sw, h / size.y, d / sd);
    return g;
  }, [gltf, w, d, h, rot]);
  return <primitive object={obj} position={[x, FLOOR, z]} />;
}

/** Khu Săn Neon: mỗi khối phố là một (hoặc vài) toà nhà thật đứng trên vỉa hè */
function HuntCity({ sim }: { sim: PlatformerSim }) {
  const data = useMemo(() => {
    const r0 = rng(sim.width * 17 + 3);
    const list: { name: ExtraModel; x: number; z: number; w: number; d: number; h: number; rot: number }[] = [];
    const walks: { x: number; z: number; w: number; d: number }[] = [];
    for (const rect of mergeRects(sim)) {
      // Tường bao quanh map: không dựng nhà
      if (rect.c === 0 || rect.r === 0 || rect.c + rect.w >= sim.width || rect.r + rect.h >= sim.height) continue;
      walks.push({ x: rect.c + rect.w / 2, z: -(rect.r + rect.h / 2), w: rect.w + 0.9, d: rect.h + 0.9 });
      // Khối dài: chia thành vài toà liền nhau
      const along = rect.w >= rect.h;
      const long = along ? rect.w : rect.h;
      const short = along ? rect.h : rect.w;
      const n = Math.max(1, Math.round(long / Math.max(short, 4)));
      for (let i = 0; i < n; i++) {
        const [name, mw, mh, md] = WIDE_BUILDINGS[Math.floor(r0() * WIDE_BUILDINGS.length)];
        const seg = long / n;
        const cx = along ? rect.c + seg * (i + 0.5) : rect.c + rect.w / 2;
        const cy = along ? rect.r + rect.h / 2 : rect.r + seg * (i + 0.5);
        const w = (along ? seg : rect.w) - 0.15;
        const d = (along ? rect.h : seg) - 0.15;
        // Giữ tỉ lệ cao theo cạnh ngắn của khối, không cao quá để nhìn chéo không che người chơi
        const scale = Math.min(w / mw, d / md);
        const h = Math.min(6.2, Math.max(3, mh * scale * 0.9));
        // Mặt tiền quay ra đường gần nhất (phía nam / tây là hướng camera nhìn tới)
        const rot = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(r0() * 4)];
        list.push({ name, x: cx, z: -cy, w, d, h, rot });
      }
    }
    return { list, walks };
  }, [sim]);
  const curb = useMemo(() => {
    const t = curbTexture();
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, color: "#9aa0ac" });
  }, []);
  return (
    <>
      {data.walks.map((w, i) => (
        <mesh key={i} position={[w.x, FLOOR + 0.08, w.z]} material={curb} receiveShadow>
          <boxGeometry args={[w.w, 0.16, w.d]} />
        </mesh>
      ))}
      {data.list.map((b, i) => (
        <Suspense key={i} fallback={null}>
          <Building {...b} />
        </Suspense>
      ))}
    </>
  );
}

/** Gạch lát vỉa hè */
function curbTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5d6270";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const v = 80 + Math.floor(Math.random() * 30);
      g.fillStyle = `rgb(${v},${v + 4},${v + 14})`;
      g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

/** Mặt đường nhựa ướt có vạch kẻ cho Khu Săn */
export function asphaltTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1c1d24";
  g.fillRect(0, 0, 512, 512);
  // Hạt đá và vệt ướt
  for (let i = 0; i < 9000; i++) {
    const v = 20 + Math.random() * 30;
    g.fillStyle = `rgba(${v},${v},${v + 8},${0.4 + Math.random() * 0.5})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 20 + Math.random() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(70,60,120,0.35)");
    gr.addColorStop(1, "rgba(70,60,120,0)");
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Vết nứt mảnh
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    g.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) g.lineTo((x += (Math.random() - 0.5) * 40), (y += (Math.random() - 0.5) * 40));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Giáo Xứ Neon: hàng rào sắt, ghế nhà thờ, bia mộ, thánh giá, cây chết, chân nến */
function ParishYard({ sim }: { sim: PlatformerSim }) {
  const data = useMemo(() => {
    const r0 = rng(sim.width * 7 + 11);
    const fence: Placed[] = [];
    const pews: Placed[] = [];
    const graves: Placed[] = [];
    const crosses: Placed[] = [];
    const trees: { x: number; z: number; h: number; rot: number }[] = [];
    const candles: { x: number; z: number; rot: number }[] = [];
    const extras: { name: ExtraModel; x: number; z: number; h: number; rot: number; light?: string }[] = [];
    const solid = (c: number, r: number) => sim.tile(c, r) === "#";
    const grave = (x: number, z: number, rot: number) => graves.push({ x, y: FLOOR, z, w: 0.75, h: 1.0, d: 0.35, rot });
    const cross = (x: number, z: number, rot: number) => crosses.push({ x, y: FLOOR, z, w: 0.75, h: 1.5, d: 0.25, rot });
    // Hàng rào: dải ngang (kể cả tường bao) → từng đoạn hàng rào sắt dài ~2 ô
    for (const run of runs(sim, (c, r) => solid(c, r) && (solid(c - 1, r) || solid(c + 1, r)))) {
      const len = run.c1 - run.c0;
      if (len < 2) continue;
      const n = Math.max(1, Math.round(len / 2));
      const seg = len / n;
      for (let i = 0; i < n; i++) fence.push({ x: run.c0 + seg * (i + 0.5), y: FLOOR, z: -(run.r + 0.5), w: seg, h: 1.5, d: 0.5 });
    }
    // Dải dọc → hàng rào xoay 90°; ô lẻ → ghế nhà thờ gãy (hàng ghế) hoặc bia mộ
    for (let c = 0; c < sim.width; c++) {
      let r = 0;
      while (r < sim.height) {
        if (!(solid(c, r) && !solid(c - 1, r) && !solid(c + 1, r))) {
          r++;
          continue;
        }
        const from = r;
        while (r < sim.height && solid(c, r) && !solid(c - 1, r) && !solid(c + 1, r)) r++;
        const len = r - from;
        if (len >= 2) {
          const n = Math.max(1, Math.round(len / 2));
          const seg = len / n;
          for (let i = 0; i < n; i++) fence.push({ x: c + 0.5, y: FLOOR, z: -(from + seg * (i + 0.5)), w: seg, h: 1.5, d: 0.5, rot: Math.PI / 2 });
        } else if ((c + from) % 3 !== 0) pews.push({ x: c + 0.5, y: FLOOR, z: -(from + 0.5), w: 1.3, h: 1.1, d: 0.65 });
        else grave(c + 0.5, -(from + 0.5), (r0() - 0.5) * 0.4);
      }
    }
    // Nghĩa địa men theo tường bao (trang trí sát tường, không chắn lối đi chính)
    const deco = (c: number, r: number, side: number) => {
      if (solid(c, r)) return;
      const k = r0();
      const x = c + 0.5;
      const z = -(r + 0.5);
      const rot = side + (r0() - 0.5) * 0.5;
      if (k < 0.28) grave(x, z, rot);
      else if (k < 0.42) cross(x, z, side + (r0() - 0.5) * 0.4);
      else if (k < 0.53) trees.push({ x, z, h: 3 + r0() * 1.5, rot: r0() * 6.28 });
      else if (k < 0.62) candles.push({ x, z, rot: r0() * 6.28 });
      else if (k < 0.73) extras.push({ name: "mx_pr_broken_column", x, z, h: 2.2 + r0() * 1.2, rot });
      else if (k < 0.83) extras.push({ name: "mx_pr_skull_candles", x, z, h: 0.9, rot, light: "#ff5030" });
      else if (k < 0.91) extras.push({ name: "mx_pr_hanging_cage", x, z, h: 2.6, rot });
      else extras.push({ name: "mx_pr_neon_cross", x, z, h: 2.4, rot, light: "#ff2040" });
    };
    for (let c = 2; c < sim.width - 2; c += 2 + Math.floor(r0() * 3)) for (const r of [1, sim.height - 2]) deco(c, r, 0);
    for (let r = 3; r < sim.height - 3; r += 3 + Math.floor(r0() * 3)) for (const c of [1, sim.width - 2]) deco(c, r, Math.PI / 2);
    // Cảnh mốc ngoài tường bao: tháp chuông đổ nát hai góc, thập giá neon đỏ khổng lồ giữa hai cạnh dài
    extras.push({ name: "mx_pr_bell_tower", x: -3.5, z: -3, h: 9, rot: 0.5 });
    extras.push({ name: "mx_pr_bell_tower", x: sim.width + 3.5, z: -(sim.height - 3), h: 10, rot: -2.4 });
    extras.push({ name: "mx_pr_neon_cross", x: sim.width / 2, z: 2.5, h: 6, rot: 0, light: "#ff2040" });
    extras.push({ name: "mx_pr_neon_cross", x: sim.width / 2, z: -(sim.height + 2.5), h: 6, rot: Math.PI, light: "#ff2040" });
    return { fence, pews, graves, crosses, trees, candles, extras };
  }, [sim]);
  return (
    <Suspense fallback={null}>
      <ModelSet name="mx_pr_iron_fence" items={data.fence} selfLit={0.25} />
      <ModelSet name="mx_pr_broken_pew" items={data.pews} selfLit={0.3} />
      <ModelSet name="mx_pr_gravestone" items={data.graves} selfLit={0.3} />
      <ModelSet name="mx_pr_stone_cross" items={data.crosses} selfLit={0.3} />
      {data.trees.map((t, i) => (
        <FitProp key={`t${i}`} name="mx_pr_dead_tree" height={t.h} x={t.x} z={t.z} rot={t.rot} selfLit={0.2} />
      ))}
      {data.extras.map((t, i) => (
        <group key={`e${i}`}>
          <FitProp name={t.name} height={t.h} x={t.x} z={t.z} rot={t.rot} selfLit={t.light ? 0.9 : 0.3} />
          {t.light && <pointLight position={[t.x, FLOOR + t.h * 0.7, t.z]} color={t.light} intensity={t.h > 3 ? 18 : 4} distance={t.h > 3 ? 14 : 5} decay={1.5} />}
        </group>
      ))}
      {data.candles.map((t, i) => (
        <group key={`c${i}`}>
          <FitProp name="mx_pr_candle_stand" height={1.6} x={t.x} z={t.z} rot={t.rot} selfLit={0.6} />
          <pointLight position={[t.x, FLOOR + 1.7, t.z]} color="#ffb060" intensity={3} distance={5} decay={1.6} />
        </group>
      ))}
    </Suspense>
  );
}

function FitProp({ name, height, x, z, rot, selfLit = 0.3 }: { name: ExtraModel; height: number; x: number; z: number; rot: number; selfLit?: number }) {
  const gltf = use(extraModel(name));
  const obj = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x, -box.min.y, -c.z);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.map && selfLit > 0) {
        mat.emissiveMap = mat.map;
        mat.emissive = new THREE.Color("#ffffff");
        mat.emissiveIntensity = selfLit;
      }
      m.material = mat;
    });
    const g = new THREE.Group();
    g.add(s);
    g.scale.setScalar(height / size.y);
    return g;
  }, [gltf, height, selfLit]);
  return <primitive object={obj} position={[x, FLOOR, z]} rotation-y={rot} />;
}

export function TopSkin({ sim }: { sim: PlatformerSim }) {
  const th = sim.def.theme;
  if (sim.mode === "shmup" && th === "crystal") return <CrystalCanyon sim={sim} />;
  if (sim.mode === "topdown" && th === "harbor") return <HuntCity sim={sim} />;
  if (sim.mode === "topdown" && th === "parish") return <ParishYard sim={sim} />;
  return null;
}

/** Map nhìn từ trên đã có da model riêng: CityBlocks chỉ dựng phần cao ốc / biển hiệu bao quanh, không dựng khối */
export function topSkinned(sim: PlatformerSim) {
  const th = sim.def.theme;
  return (sim.mode === "shmup" && th === "crystal") || (sim.mode === "topdown" && (th === "harbor" || th === "parish"));
}

/**
 * Nền nghĩa địa Giáo Xứ: đất tối, đá cuội lát lệch rêu phủ, vết nứt, lá khô đỏ. Vẽ bằng canvas, lặp liền mạch
 * (đá chạm mép được vẽ lặp sang mép đối diện).
 */
export function graveyardTexture() {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  let seed = 17;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = "#17121a";
  g.fillRect(0, 0, S, S);
  const wrap = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
  };
  // Đất loang lổ
  for (let i = 0; i < 260; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 20 + r() * 70;
    const c = r() < 0.5 ? `rgba(40,30,34,${0.25 + r() * 0.3})` : `rgba(18,26,20,${0.3 + r() * 0.3})`;
    wrap((ox, oy) => {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, c);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    });
  }
  // Đá cuội: lưới lệch hàng, mỗi viên một sắc xám tím, mép tối, mặt sáng nhẹ phía trên
  const cell = 64;
  for (let row = 0; row < S / cell; row++)
    for (let col = 0; col < S / cell; col++) {
      if (r() < 0.22) continue; // chỗ mất đá: lộ đất
      const x = col * cell + (row % 2) * cell * 0.5 + (r() - 0.5) * 10;
      const y = row * cell + (r() - 0.5) * 10;
      const w = cell * (0.78 + r() * 0.14);
      const h = cell * (0.7 + r() * 0.18);
      const v = 38 + r() * 22;
      wrap((ox, oy) => {
        const px = x + ox;
        const py = y + oy;
        if (px > S + cell || py > S + cell || px < -cell * 2 || py < -cell * 2) return;
        g.fillStyle = "rgba(0,0,0,0.6)";
        g.beginPath();
        g.roundRect(px - 2, py - 2, w + 4, h + 4, 14);
        g.fill();
        g.fillStyle = `rgb(${v},${v - 4},${v + 8})`;
        g.beginPath();
        g.roundRect(px, py, w, h, 12);
        g.fill();
        const hl = g.createLinearGradient(px, py, px, py + h);
        hl.addColorStop(0, "rgba(255,255,255,0.08)");
        hl.addColorStop(1, "rgba(0,0,0,0.18)");
        g.fillStyle = hl;
        g.fill();
      });
    }
  // Rêu và cỏ mọc kẽ đá
  for (let i = 0; i < 900; i++) {
    const x = r() * S;
    const y = r() * S;
    g.fillStyle = `rgba(${40 + r() * 30},${60 + r() * 40},${30 + r() * 20},${0.25 + r() * 0.35})`;
    wrap((ox, oy) => g.fillRect(x + ox, y + oy, 2 + r() * 5, 2 + r() * 5));
  }
  // Vết nứt
  g.strokeStyle = "rgba(0,0,0,0.55)";
  g.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) {
    let x = r() * S;
    let y = r() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.5) * 40;
      y += (r() - 0.5) * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Lá khô đỏ cam rải rác
  for (let i = 0; i < 220; i++) {
    const x = r() * S;
    const y = r() * S;
    g.fillStyle = `rgba(${120 + r() * 80},${30 + r() * 40},${20},${0.5 + r() * 0.4})`;
    g.beginPath();
    g.ellipse(x, y, 3 + r() * 4, 1.5 + r() * 2, r() * 3.14, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

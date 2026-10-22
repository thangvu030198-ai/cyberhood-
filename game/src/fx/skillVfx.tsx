// Hiệu ứng chiêu thức dựng bằng model Meshy (gộp chung một file mx_vfx_all): chưởng rồng, sóng kiếm, tên lửa,
// lựu đạn plasma, thiên thạch pháo kích, cầu đầu lâu, gai băng, mảnh tinh thể máu, vòng chấn động.
// Mỗi model được chuẩn hoá về kích thước 1 (cạnh dài nhất), đặt tâm ở gốc, hướng bay +X, trên +Y;
// texture gốc được dùng làm ánh sáng tự phát để trông như năng lượng, thêm một lớp vỏ cộng sáng bao ngoài.
// Vẽ bằng instanced mesh: mỗi khung hình, nơi dùng gọi put() cho từng viên đạn / vùng hiệu ứng.

import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extraModel } from "../game/assets";

export type VfxName = "chuong" | "blade_wave" | "missile" | "grenade" | "meteor" | "skull_orb" | "ice_spike" | "blood_shard" | "shock_ring";

/** Xoay gốc (độ, thứ tự XYZ) để model nằm hướng +X (chưởng rồng: đầu rồng; tên lửa: mũi; mảnh máu: mũi nhọn); màu vỏ sáng; độ tự phát sáng của texture */
const DEF: Record<VfxName, { rot: [number, number, number]; shell: [number, number, number]; glow: number; anchor?: "base" }> = {
  chuong: { rot: [0, 0, -90], shell: [0.3, 1.4, 2.2], glow: 2.2 },
  blade_wave: { rot: [0, 0, 0], shell: [0.4, 1.6, 2.4], glow: 2.4 },
  missile: { rot: [0, 180, 0], shell: [2, 0.9, 0.2], glow: 1.2 },
  grenade: { rot: [0, 0, 0], shell: [2, 1.6, 0.2], glow: 1.4 },
  meteor: { rot: [0, 0, 0], shell: [2.4, 0.9, 0.2], glow: 1.8 },
  skull_orb: { rot: [0, 0, 0], shell: [1.6, 0.3, 2.2], glow: 2 },
  ice_spike: { rot: [0, 0, 0], shell: [0.4, 1.3, 2.2], glow: 1.4, anchor: "base" },
  blood_shard: { rot: [0, 0, -90], shell: [2.4, 0.2, 0.3], glow: 2.6 },
  shock_ring: { rot: [0, 0, 0], shell: [2.4, 1, 0.2], glow: 1.8, anchor: "base" },
};

type Part = { geo: THREE.BufferGeometry; mat: THREE.Material; shell: THREE.MeshBasicMaterial };

const cache = new Map<string, Part>();
/** ?debug: số hiệu ứng đang vẽ của từng model (chụp ảnh kiểm tra) */
export const vfxDebug: Record<string, number> = {};

function partOf(root: THREE.Object3D, name: VfxName): Part | null {
  const hit = cache.get(name);
  if (hit) return hit;
  const node = root.getObjectByName(`vfx_${name}`) ?? null;
  if (!node) return null;
  let mesh: THREE.Mesh | null = null;
  node.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  if (!mesh) return null;
  const m = mesh as THREE.Mesh;
  m.updateWorldMatrix(true, false);
  node.updateWorldMatrix(true, false);
  const geo = m.geometry.clone();
  // Đưa về toạ độ của node gốc (bỏ biến đổi của file), xoay theo DEF, đặt tâm, chuẩn hoá kích thước 1
  geo.applyMatrix4(new THREE.Matrix4().copy(node.matrixWorld).invert().multiply(m.matrixWorld));
  const d = DEF[name];
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...d.rot.map(THREE.MathUtils.degToRad) as [number, number, number])));
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const c = bb.getCenter(new THREE.Vector3());
  geo.translate(-c.x, d.anchor === "base" ? -bb.min.y : -c.y, -c.z);
  const k = 1 / Math.max(size.x, size.y, size.z, 1e-4);
  geo.scale(k, k, k);
  geo.computeBoundingSphere();
  const src = m.material as THREE.MeshStandardMaterial;
  const mat = new THREE.MeshStandardMaterial({
    map: src.map ?? null,
    normalMap: src.normalMap ?? null,
    roughness: 0.35,
    metalness: 0.2,
    emissiveMap: src.map ?? null,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: d.glow,
    toneMapped: false,
  });
  const shell = new THREE.MeshBasicMaterial({ color: new THREE.Color(...d.shell), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.BackSide });
  const part = { geo, mat, shell };
  cache.set(name, part);
  return part;
}

export type VfxPut = (x: number, y: number, z: number, q: THREE.Quaternion, sx: number, sy?: number, sz?: number) => void;

type PoolProps = {
  name: VfxName;
  max: number;
  /** Gọi mỗi khung hình: put() cho từng hiệu ứng đang hiện */
  update: (put: VfxPut, t: number) => void;
  /** Vỏ cộng sáng to hơn thân bao nhiêu lần (0 = không vẽ vỏ) */
  shell?: number;
};

function Pool({ name, max, update, shell = 1.22 }: PoolProps) {
  const g = use(extraModel("mx_vfx_all"));
  const part = useMemo(() => partOf(g.scene, name), [g, name]);
  const body = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const b = body.current;
    if (!b) return;
    const h = halo.current;
    let n = 0;
    const put: VfxPut = (x, y, z, q, sx, sy = sx, sz = sx) => {
      if (n >= max) return;
      m.compose(v.set(x, y, z), q, s.set(sx, sy, sz));
      b.setMatrixAt(n, m);
      if (h) {
        m.compose(v, q, s.multiplyScalar(shell));
        h.setMatrixAt(n, m);
      }
      n++;
    };
    update(put, clock.elapsedTime);
    b.count = n;
    vfxDebug[name] = n;
    b.instanceMatrix.needsUpdate = true;
    if (h) {
      h.count = n;
      h.instanceMatrix.needsUpdate = true;
    }
  });
  if (!part) return null;
  return (
    <>
      <instancedMesh ref={body} args={[part.geo, part.mat, max]} frustumCulled={false} />
      {shell > 0 && <instancedMesh ref={halo} args={[part.geo, part.shell, max]} frustumCulled={false} renderOrder={4} />}
    </>
  );
}

/** Một nhóm hiệu ứng cùng model; tự chờ tải model, không chặn cảnh */
export function VfxPool(props: PoolProps) {
  return (
    <Suspense fallback={null}>
      <Pool {...props} />
    </Suspense>
  );
}

// Tiện ích dựng hướng quay
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _a = new THREE.Vector3();
/** Quay quanh trục Z theo góc bay (màn đi ngang / nhìn từ trên), thêm lăn quanh trục bay */
export function qFlat(angle: number, roll = 0) {
  return _q.setFromEuler(_e.set(roll, 0, angle, "ZYX"));
}
/** Hướng +X của model trỏ theo vector (dx, dy, dz) trong không gian 3D, thêm lăn quanh trục bay */
export function qDir(dx: number, dy: number, dz: number, roll = 0) {
  const yaw = Math.atan2(-dz, dx);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return _q.setFromEuler(_e.set(roll, yaw, pitch, "YZX"));
}
/** Đứng thẳng, xoay quanh trục Y */
export function qYaw(yaw: number) {
  return _q.setFromAxisAngle(_a.set(0, 1, 0), yaw);
}

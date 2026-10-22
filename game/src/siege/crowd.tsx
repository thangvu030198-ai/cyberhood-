// Vẽ hàng trăm quân bằng GPU (GDD 4I.7 "vẽ hàng loạt"): lúc tải, "nướng" sẵn vài khung của clip chạy / bắn thành
// lưới tĩnh (áp xương lên từng đỉnh), rồi mỗi khung hình chỉ việc xếp mỗi quân vào InstancedMesh của khung hoạt ảnh
// phù hợp. Không cần khung xương cho từng quân nên 200 quân vẫn nhẹ. Quân chết đổ gục, lún dần vào tuyết.

import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { extraModel, type ExtraModel } from "../game/assets";
import { inPlace } from "../game/meshyAnim";
import type { Role, SiegeSim, Side } from "./siegeSim";

const WALK_FRAMES = 8;
const SHOOT_FRAMES = 2;
const HEIGHT = 1.85;

type Baked = { frames: THREE.BufferGeometry[]; material: THREE.Material; walkLen: number };

/** Nướng `n` khung đều nhau của `clip` thành lưới tĩnh (đứng thẳng, cao HEIGHT, chân ở y = 0, mặt nhìn +Z) */
function bake(scene: THREE.Object3D, clips: { clip: THREE.AnimationClip; n: number }[]): Baked {
  const root = cloneSkinned(scene);
  let mesh: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && (!mesh || m.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) mesh = m;
  });
  if (!mesh) throw new Error("crowd: model không có SkinnedMesh");
  const sm = mesh as THREE.SkinnedMesh;
  const mixer = new THREE.AnimationMixer(root);
  const frames: THREE.BufferGeometry[] = [];
  const v = new THREE.Vector3();
  let fit: { k: number; cx: number; cz: number; y0: number } | null = null;
  for (const { clip, n } of clips) {
    const c = inPlace(clip);
    const action = mixer.clipAction(c);
    action.play();
    for (let f = 0; f < n; f++) {
      mixer.setTime((c.duration * f) / n);
      root.updateMatrixWorld(true);
      sm.skeleton.update();
      const src = sm.geometry.attributes.position;
      const pos = new Float32Array(src.count * 3);
      for (let i = 0; i < src.count; i++) {
        v.fromBufferAttribute(src, i);
        sm.applyBoneTransform(i, v);
        v.applyMatrix4(sm.matrixWorld);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      if (sm.geometry.attributes.uv) g.setAttribute("uv", sm.geometry.attributes.uv);
      if (sm.geometry.index) g.setIndex(sm.geometry.index);
      // Chuẩn hoá theo khung đầu tiên: mọi khung dùng chung tỉ lệ để không "co giãn" khi chuyển khung
      if (!fit) {
        g.computeBoundingBox();
        const b = g.boundingBox!;
        fit = { k: HEIGHT / (b.max.y - b.min.y), cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2, y0: b.min.y };
      }
      g.translate(-fit.cx, -fit.y0, -fit.cz);
      g.scale(fit.k, fit.k, fit.k);
      g.computeVertexNormals();
      frames.push(g);
    }
    action.stop();
  }
  const mat = (sm.material as THREE.MeshStandardMaterial).clone();
  if (mat.map) {
    mat.emissiveMap = mat.map;
    mat.emissive = new THREE.Color("#ffffff");
    mat.emissiveIntensity = 0.12;
  }
  return { frames, material: mat, walkLen: clips[0].clip.duration };
}

/**
 * Biến thể quân mỗi phe (lọc từ kho model 3D): phe Hunter là lính công nghệ, lớp Hunter và NPC thành phố;
 * phe IXO (phe ác) là quái vật, zombie, golem. `walk`: clip chạy; `act`: clip bắn / tấn công.
 */
type Variant = { name: string; walk: ExtraModel; act: ExtraModel; roles: Role[] };
const V = (name: string, base: string, act: string, roles: Role[]): Variant => ({ name, walk: `${base}_run` as ExtraModel, act: `${base}_${act}` as ExtraModel, roles });
export const VARIANTS: Record<Side, Variant[]> = {
  0: [
    V("wz_heavy", "mx_wz_heavy", "walkshoot", ["infantry"]),
    V("cls_racer", "mx_cls_racer", "runshoot", ["infantry"]),
    V("cls_engineer", "mx_cls_engineer", "runshoot", ["infantry"]),
    V("npc_cop", "mx_npc_cop", "walk", ["infantry"]),
    V("dr_knight", "mx_dr_knight", "walk", ["shield"]),
    V("cls_hacker", "mx_cls_hacker", "runshoot", ["ranged"]),
    V("npc_medic", "mx_npc_medic", "walk", ["medic"]),
    V("cls_samurai", "mx_cls_samurai", "runshoot", ["special"]),
  ],
  1: [
    V("zmb_soldier", "mx_zmb_soldier", "attack", ["infantry"]),
    V("zmb_cyborg", "mx_zmb_cyborg", "attack", ["infantry"]),
    V("mon_mutant", "mx_mon_mutant", "attack", ["infantry"]),
    V("dr_goblin", "mx_dr_goblin", "walk", ["infantry"]),
    V("zmb_brute", "mx_zmb_brute", "attack", ["infantry"]),
    V("dr_golem", "mx_dr_golem", "walk", ["shield"]),
    V("mon_alien", "mx_mon_alien", "attack", ["ranged"]),
    V("zmb_hazmat", "mx_zmb_hazmat", "attack", ["medic"]),
    V("mon_robot_reaper", "mx_mon_robot_reaper", "attack", ["special"]),
    V("dr_werewolf", "mx_dr_werewolf", "walk", ["special"]),
  ],
};

/** Biến thể của một quân: theo vai trò, bộ binh xoay vòng nhiều kiểu */
export function variantOf(u: { side: Side; role: Role; id: number }) {
  const list = VARIANTS[u.side];
  const fit = list.map((v, i) => [v, i] as const).filter(([v]) => v.roles.includes(u.role));
  return fit.length ? fit[u.id % fit.length][1] : u.id % list.length;
}

const TINT: Record<Side, string> = { 0: "#ffffff", 1: "#ffffff" };

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();

function VariantCrowd({ sim, side, vi }: { sim: SiegeSim; side: Side; vi: number }) {
  const v = VARIANTS[side][vi];
  const base = use(extraModel(`mx_crowd_${v.name}` as ExtraModel));
  const walk = use(extraModel(v.walk));
  const act = use(extraModel(v.act));
  const baked = useMemo(
    () => bake(base.scene, [
      { clip: walk.animations[0] ?? base.animations[0], n: WALK_FRAMES },
      { clip: act.animations[0] ?? walk.animations[0], n: SHOOT_FRAMES },
    ]),
    [base, walk, act],
  );
  const members = useMemo(() => sim.units.filter((u) => u.side === side && u.role !== "tank" && variantOf(u) === vi), [sim, side, vi]);
  const cap = members.length + 1;
  const meshes = useMemo(
    () =>
      baked.frames.map((g) => {
        const m = new THREE.InstancedMesh(g, baked.material, cap);
        m.frustumCulled = false;
        m.count = 0;
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        return m;
      }),
    [baked, cap],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const counts = new Array(meshes.length).fill(0);
    const tint = _c.set(TINT[side]);
    for (const u of members) {
      const deadFor = u.alive ? 0 : sim.time - u.diedAt;
      if (!u.alive && deadFor > 4) continue;
      const moving = Math.hypot(u.vx, u.vz) > 0.6;
      const shooting = sim.time - u.shooting < 0.35;
      let f: number;
      if (!u.alive) f = 0;
      else if (shooting && !moving) f = WALK_FRAMES + (Math.floor(t * 8 + u.id) % SHOOT_FRAMES);
      else if (moving) f = Math.floor(((t * (Math.hypot(u.vx, u.vz) / 3.2)) / baked.walkLen + u.id * 0.137) * WALK_FRAMES) % WALK_FRAMES;
      else f = (u.id % 3) * 2; // đứng chờ: mỗi người một tư thế
      const m = meshes[f];
      const i = counts[f]++;
      if (u.alive) {
        _e.set(0, u.yaw, 0);
        _p.set(u.x, Math.abs(Math.sin(t * 9 + u.id)) * (moving ? 0.06 : 0), u.z);
      } else {
        // Đổ gục ra sau rồi lún vào tuyết
        const fall = Math.min(1, deadFor * 2.5);
        _e.set(-fall * 1.45, u.yaw, 0, "YXZ");
        _p.set(u.x, -Math.max(0, deadFor - 2) * 0.4, u.z);
      }
      _q.setFromEuler(_e);
      // Golem / Brute / Hiệp sĩ to con hơn; tay súng tinh nhuệ ("người thật") nhỉnh hơn
      const k = (u.role === "shield" ? 1.25 : u.role === "special" ? 1.12 : 1) * (u.hero ? 1.05 : 1);
      m.setMatrixAt(i, _m.compose(_p, _q, _s.set(k, k, k)));
      // Vừa trúng đòn: nháy sáng
      const flashK = u.alive && sim.time - u.hurtAt < 0.12 ? 2.2 : 1;
      m.setColorAt(i, _c.copy(tint).multiplyScalar((u.hero ? 1.1 : 1) * flashK));
    }
    meshes.forEach((m, f) => {
      m.count = counts[f];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  });
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

/** Vòng xanh dưới chân tiểu đội của người chơi, chấm sáng trên đầu tay súng tinh nhuệ ("người thật") */
function Marks({ sim }: { sim: SiegeSim }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const ringGeo = useMemo(() => new THREE.TorusGeometry(0.7, 0.07, 6, 24).rotateX(-Math.PI / 2), []);
  useFrame(({ clock }) => {
    const o = ref.current;
    if (!o) return;
    const t = clock.elapsedTime;
    let n = 0;
    for (const u of sim.units) {
      if (!u.alive || !(u.squad || u.hero) || n >= 96) continue;
      o.setMatrixAt(n, _m.compose(_p.set(u.x, u.squad ? 0.06 : 2.45 + Math.sin(t * 3 + u.id) * 0.05, u.z), _q.identity(), _s.setScalar(u.squad ? 1 : 0.2)));
      o.setColorAt(n, u.squad ? _c.set("#00ffa0") : _c.set(u.side === 0 ? "#7ff3ff" : "#ff7ae0"));
      n++;
    }
    o.count = n;
    o.instanceMatrix.needsUpdate = true;
    if (o.instanceColor) o.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[ringGeo, undefined, 96]} frustumCulled={false}>
      <meshBasicMaterial toneMapped={false} color={[1.5, 3, 2]} />
    </instancedMesh>
  );
}

export function Crowd({ sim }: { sim: SiegeSim }) {
  return (
    <>
      {([0, 1] as Side[]).map((side) =>
        VARIANTS[side].map((_, vi) => (
          <Suspense key={`${side}-${vi}`} fallback={null}>
            <VariantCrowd sim={sim} side={side} vi={vi} />
          </Suspense>
        )),
      )}
      <Marks sim={sim} />
    </>
  );
}

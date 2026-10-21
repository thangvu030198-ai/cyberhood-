// Hiển thị trang bị trong màn 2D: vũ khí cầm trên tay nhân vật, trang bị rơi trên đất (đúng model, cột sáng
// theo độ hiếm), và hình đạn riêng của từng vũ khí (tia ngắm, mũi tên, nhát chém vòng cung, sóng kiếm).

import { Suspense, use, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extraModel } from "../game/assets";
import { GEAR, type GearId, type WeaponId } from "./gear";
import type { PlatformerSim } from "./platformer";

const RARITY_RGB: Record<string, [number, number, number]> = {
  common: [1.6, 1.7, 1.8],
  rare: [0.5, 1.6, 3],
  epic: [2, 0.8, 3],
  legendary: [3, 2.1, 0.4],
  mythic: [3, 0.4, 0.6],
};

/** Cách cầm từng vũ khí: dài bao nhiêu mét, trục dài của model hướng về mũi/nòng, chỗ tay nắm (0 = mũi, 1 = đuôi).
 * `side`: cung cầm dọc, vuông góc với cánh tay */
const HOLD: Record<Exclude<WeaponId, "buster">, { len: number; tip: [number, number, number]; grip: number; side?: boolean }> = {
  ar: { len: 0.95, tip: [-1, 0, 0], grip: 0.62 },
  shotgun: { len: 1, tip: [-1, 0, 0], grip: 0.6 },
  sniper: { len: 1.15, tip: [-1, 0, 0], grip: 0.6 },
  bow: { len: 1.15, tip: [0, 1, 0], grip: 0.5, side: true },
  celestial: { len: 1.25, tip: [0, -1, 0], grip: 0.9 },
  frost: { len: 1.3, tip: [0, 1, 0], grip: 0.88 },
  cosmic: { len: 1.35, tip: [0, 1, 0], grip: 0.9 },
  scythe: { len: 1.5, tip: [0, 1, 0], grip: 0.85 },
};

/** Gắn model vũ khí vào xương bàn tay phải của nhân vật (xương Meshy chạy dọc trục +Y của nó) */
function HeldWeaponInner({ rig, weapon }: { rig: THREE.Object3D; weapon: Exclude<WeaponId, "buster"> }) {
  const gltf = use(extraModel(GEAR[weapon].model));
  useMemo(() => {
    let hand: THREE.Object3D | undefined;
    rig.traverse((o) => {
      if (!hand && (o as THREE.Bone).isBone && /^RightHand$/i.test(o.name)) hand = o;
    });
    if (!hand) return;
    const old = hand.getObjectByName("held-weapon");
    if (old) hand.remove(old);
    const h = HOLD[weapon];
    const obj = gltf.scene.clone(true);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.map) {
        mat.emissiveMap = mat.map;
        mat.emissive.set("#ffffff");
        mat.emissiveIntensity = 0.35;
      }
      m.material = mat;
    });
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const axis = new THREE.Vector3(...h.tip);
    const L = Math.abs(axis.dot(size)) || Math.max(size.x, size.y, size.z);
    const k = h.len / L;
    // Điểm nắm: từ mũi lùi về đuôi theo tỉ lệ grip
    const tip = center.clone().addScaledVector(axis, L / 2);
    const grip = tip.addScaledVector(axis, -L * h.grip);
    obj.scale.setScalar(k);
    obj.position.copy(grip).multiplyScalar(-k);
    const holder = new THREE.Group();
    holder.name = "held-weapon";
    holder.add(obj);
    // Quay trục mũi về hướng ngón tay (+Y của xương), cung thì nằm ngang theo +X của xương
    holder.quaternion.setFromUnitVectors(axis, h.side ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
    rig.updateMatrixWorld(true);
    const ws = hand.getWorldScale(new THREE.Vector3());
    const rs = rig.getWorldScale(new THREE.Vector3());
    // Xương mang tỉ lệ của cả khung nhân vật: bù lại để vũ khí giữ đúng kích thước mét trong thế giới của rig
    holder.scale.setScalar(rs.x / Math.max(1e-6, ws.x));
    holder.position.set(0, 0.06 / Math.max(1e-6, ws.x / rs.x), 0);
    hand.add(holder);
  }, [rig, gltf, weapon]);
  return null;
}

export function HeldWeapon({ rig, weapon }: { rig: THREE.Object3D; weapon: WeaponId }) {
  if (weapon === "buster") return null;
  return (
    <Suspense fallback={null}>
      <HeldWeaponInner rig={rig} weapon={weapon} />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Trang bị rơi trên đất: model thật xoay tròn, cột sáng màu độ hiếm

function GearDrop({ sim, index, gear, z }: { sim: PlatformerSim; index: number; gear: GearId; z: number }) {
  const gltf = use(extraModel(GEAR[gear].model));
  const obj = useMemo(() => {
    const s = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const k = 0.9 / Math.max(size.x, size.y, size.z);
    const c = box.getCenter(new THREE.Vector3());
    s.scale.setScalar(k);
    s.position.set(-c.x * k, -c.y * k, -c.z * k);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.map) {
        mat.emissiveMap = mat.map;
        mat.emissive.set("#ffffff");
        mat.emissiveIntensity = 0.6;
      }
      m.material = mat;
    });
    const g = new THREE.Group();
    g.add(s);
    return g;
  }, [gltf]);
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const rgb = RARITY_RGB[GEAR[gear].rarity];
  useFrame(({ clock }) => {
    const k = sim.pickups[index];
    const o = group.current;
    if (!o || !k) return;
    o.visible = !k.taken;
    const t = clock.elapsedTime;
    const top = sim.mode === "topdown";
    o.position.set(k.x, k.y + (top ? 0 : 0.55 + Math.sin(t * 3) * 0.08), top ? z + 0.7 + Math.sin(t * 3) * 0.08 : 0.2);
    if (spin.current) spin.current.rotation.y = t * 2;
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 4) * 0.1;
  });
  return (
    <group ref={group}>
      <group ref={spin} rotation-x={sim.mode === "topdown" ? Math.PI / 2 : 0}>
        <primitive object={obj} />
      </group>
      <mesh ref={beam} rotation-x={sim.mode === "topdown" ? Math.PI / 2 : 0}>
        <cylinderGeometry args={[0.08, 0.3, 4, 12, 1, true]} />
        <meshBasicMaterial color={rgb} transparent opacity={0.4} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Theo dõi danh sách đồ rơi; khi có trang bị mới rơi ra thì dựng model cho nó */
export function GearDrops({ sim, z }: { sim: PlatformerSim; z: number }) {
  const [list, setList] = useState<{ index: number; gear: GearId }[]>([]);
  const count = useRef(0);
  useFrame(() => {
    if (sim.pickups.length === count.current) return;
    count.current = sim.pickups.length;
    const next = sim.pickups.flatMap((k, index) => (k.drop.kind === "gear" ? [{ index, gear: k.drop.gear }] : []));
    if (next.length !== list.length) setList(next);
  });
  return (
    <>
      {list.map((g) => (
        <Suspense key={g.index} fallback={null}>
          <GearDrop sim={sim} index={g.index} gear={g.gear} z={z} />
        </Suspense>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Hình đạn của vũ khí trang bị

const POOL = 32;
/** Màu nhát chém / sóng kiếm theo vũ khí */
const BLADE_RGB: Partial<Record<WeaponId, [number, number, number]>> = {
  celestial: [3, 2.6, 1.6],
  frost: [0.8, 2.2, 3.4],
  scythe: [1.6, 0.9, 3.2],
  cosmic: [0.6, 3, 3.2],
};

export function WeaponShots({ sim, z }: { sim: PlatformerSim; z: number }) {
  const arcs = useRef<THREE.InstancedMesh>(null);
  const rods = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(
    () => ({
      // Vành trăng khuyết mở về phía +X (hướng chém)
      arc: new THREE.RingGeometry(0.62, 1, 28, 1, -Math.PI * 0.42, Math.PI * 0.84),
      rod: new THREE.CylinderGeometry(0.5, 0.5, 1, 6).rotateZ(Math.PI / 2),
    }),
    [],
  );
  useFrame(() => {
    const a = arcs.current;
    const r = rods.current;
    if (!a || !r) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const zAxis = new THREE.Vector3(0, 0, 1);
    const blade = BLADE_RGB[sim.weapon] ?? [2, 2, 2];
    const col = new THREE.Color();
    let na = 0;
    let nr = 0;
    const zz = z + (sim.mode === "topdown" ? 1 : 0.2);
    for (const shot of sim.shots) {
      if (shot.enemy || !shot.kind) continue;
      const dirX = shot.dx ?? Math.sign(shot.vx || 1);
      const dirY = shot.dy ?? 0;
      const ang = Math.atan2(shot.vy || dirY, shot.vx || dirX);
      if ((shot.kind === "slash" || shot.kind === "wave") && na < POOL) {
        const fade = shot.kind === "slash" ? Math.max(0, shot.life / (shot.maxLife || 0.14)) : 1;
        const a2 = shot.kind === "slash" ? Math.atan2(dirY, dirX) : ang;
        q.setFromAxisAngle(zAxis, a2);
        s.setScalar(shot.r * (shot.kind === "slash" ? 1.15 - fade * 0.15 : 1));
        m.compose(p.set(shot.x, shot.y, zz), q, s);
        a.setMatrixAt(na, m);
        a.setColorAt(na, col.setRGB(blade[0] * fade, blade[1] * fade, blade[2] * fade));
        na++;
      } else if ((shot.kind === "rail" || shot.kind === "arrow") && nr < POOL) {
        q.setFromAxisAngle(zAxis, ang);
        const len = shot.kind === "rail" ? 2.4 : 1.1;
        const thick = shot.kind === "rail" ? 0.12 + shot.level * 0.06 : 0.08 + shot.level * 0.04;
        s.set(len, thick, thick);
        m.compose(p.set(shot.x, shot.y, zz), q, s);
        r.setMatrixAt(nr, m);
        r.setColorAt(nr, shot.kind === "rail" ? col.setRGB(3, 1.4, 0.6) : col.setRGB(2.2, 3, 2.4));
        nr++;
      }
    }
    a.count = na;
    r.count = nr;
    a.instanceMatrix.needsUpdate = true;
    r.instanceMatrix.needsUpdate = true;
    if (a.instanceColor) a.instanceColor.needsUpdate = true;
    if (r.instanceColor) r.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={arcs} args={[geo.arc, undefined, POOL]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={rods} args={[geo.rod, undefined, POOL]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}

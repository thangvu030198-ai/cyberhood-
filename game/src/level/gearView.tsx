// Hiển thị trang bị trong màn 2D: vũ khí cầm trên tay nhân vật, trang bị rơi trên đất (đúng model, cột sáng
// theo độ hiếm), và hình đạn riêng của từng vũ khí (tia ngắm, mũi tên, nhát chém vòng cung, sóng kiếm).

import { Suspense, use, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extraModel } from "../game/assets";
import { GEAR, type ArmorId, type GearId, type WeaponId } from "./gear";
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

type Hold = { len: number; tip: [number, number, number]; grip: number; side?: boolean };
/** Súng tay mặc định và katana đeo lưng (model Meshy riêng, mũi / nòng hướng −X) */
const PISTOL: Hold = { len: 0.42, tip: [-1, 0, 0], grip: 0.72 };
const KATANA: Hold = { len: 1.05, tip: [-1, 0, 0], grip: 0.8 };

function findBone(rig: THREE.Object3D, re: RegExp) {
  let bone: THREE.Object3D | undefined;
  rig.traverse((o) => {
    if (!bone && (o as THREE.Bone).isBone && re.test(o.name)) bone = o;
  });
  return bone;
}

/** Dựng model vũ khí: điểm nắm ở gốc toạ độ, trục mũi theo `h.tip`, dài `h.len` mét */
function weaponObject(gltf: { scene: THREE.Object3D }, h: Hold) {
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
  return { obj, axis };
}

/** Gắn vào xương bàn tay phải (xương Meshy chạy dọc trục +Y của nó) */
function attachHand(rig: THREE.Object3D, gltf: { scene: THREE.Object3D }, h: Hold, name: string) {
  const hand = findBone(rig, /^RightHand$/i);
  if (!hand) return null;
  hand.getObjectByName(name)?.removeFromParent();
  const { obj, axis } = weaponObject(gltf, h);
  const holder = new THREE.Group();
  holder.name = name;
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
  return holder;
}

/**
 * Đeo kiếm chéo sau lưng: chuôi nhô qua vai phải, mũi chúc xuống hông trái. Tính trong hệ toạ độ của nhân vật
 * (mặt nhìn +Z, tay phải ở −X) rồi đổi về hệ của xương ngực để kiếm đi theo thân khi chạy nhảy.
 */
function attachBack(rig: THREE.Object3D, gltf: { scene: THREE.Object3D }, h: Hold, name: string) {
  const chest = findBone(rig, /^Spine02$/i) ?? findBone(rig, /^Spine/i);
  const frame = rig.parent;
  if (!chest || !frame) return null;
  chest.getObjectByName(name)?.removeFromParent();
  const { obj, axis } = weaponObject(gltf, h);
  const holder = new THREE.Group();
  holder.name = name;
  holder.add(obj);
  frame.updateMatrixWorld(true);
  const inFrame = frame.matrixWorld.clone().invert().multiply(chest.matrixWorld);
  const bp = new THREE.Vector3();
  const bq = new THREE.Quaternion();
  const bs = new THREE.Vector3();
  inFrame.decompose(bp, bq, bs);
  const pos = bp.clone().add(new THREE.Vector3(-0.3, 0.5, -0.2));
  const dir = new THREE.Vector3(0.64, -0.75, -0.12).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(axis, dir);
  holder.position.copy(pos).applyMatrix4(inFrame.clone().invert());
  holder.quaternion.copy(bq.clone().invert().multiply(q));
  holder.scale.set(1 / bs.x, 1 / bs.y, 1 / bs.z);
  chest.add(holder);
  return holder;
}

/**
 * Vũ khí trên người nhân vật chính, theo chế độ (nút L):
 * - chế độ súng: súng trên tay phải, kiếm đeo chéo sau lưng
 * - chế độ kiếm: kiếm rút ra tay phải, súng cất đi
 * Trang bị là súng thì cầm súng đó, là kiếm thì đeo / rút thanh đó; mặc định là súng tay + katana.
 */
function HeroArmsInner({ rig, sim }: { rig: THREE.Object3D; sim: PlatformerSim }) {
  const gun = sim.gunWeapon;
  const blade = sim.bladeGear ? (sim.weapon as Exclude<WeaponId, "buster">) : null;
  const gunGltf = use(extraModel(gun === "buster" ? "mx_w_pistol" : GEAR[gun].model));
  const bladeGltf = use(extraModel(blade ? GEAR[blade].model : "mx_w_katana"));
  const parts = useMemo(() => {
    const gh = gun === "buster" ? PISTOL : HOLD[gun as Exclude<WeaponId, "buster">];
    const bh = blade ? HOLD[blade] : KATANA;
    return {
      gun: attachHand(rig, gunGltf, gh, "held-gun"),
      sword: attachHand(rig, bladeGltf, bh, "held-sword"),
      back: attachBack(rig, bladeGltf, { ...bh, len: Math.min(bh.len, 1.1) }, "back-sword"),
    };
  }, [rig, gunGltf, bladeGltf, gun, blade]);
  // Tìm lại theo tên mỗi khung: StrictMode dựng hai lần, bản còn gắn trên xương mới là bản đang hiển thị
  const hand = useMemo(() => findBone(rig, /^RightHand$/i), [rig]);
  const chest = useMemo(() => findBone(rig, /^Spine02$/i) ?? findBone(rig, /^Spine/i), [rig]);
  useFrame(() => {
    const sword = sim.player.weaponMode === "sword";
    const g = hand?.getObjectByName("held-gun") ?? parts.gun;
    const w = hand?.getObjectByName("held-sword") ?? parts.sword;
    const b = chest?.getObjectByName("back-sword") ?? parts.back;
    if (g) g.visible = !sword;
    if (w) w.visible = sword;
    if (b) b.visible = !sword;
  });
  return null;
}

export function HeroArms({ rig, sim }: { rig: THREE.Object3D; sim: PlatformerSim }) {
  return (
    <Suspense fallback={null}>
      <HeroArmsInner rig={rig} sim={sim} />
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
      // Nhát cận chiến có vệt chém riêng (combatFx.tsx)
      if (shot.enemy || !shot.kind || shot.melee !== undefined) continue;
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

// ---------------------------------------------------------------------------
// Giáp mặc trên người: gắn model giáp vào xương ngực, giữ hướng đứng thẳng của nhân vật

const ARMOR_FIT: Record<string, { height: number; drop: number; depth: number }> = {
  darkset: { height: 1.05, drop: 0.32, depth: 0.02 },
  void: { height: 1.15, drop: 0.36, depth: -0.02 },
};

function WornArmorInner({ rig, armor }: { rig: THREE.Object3D; armor: Exclude<ArmorId, "none"> }) {
  const gltf = use(extraModel(GEAR[armor].model));
  useMemo(() => {
    let chest: THREE.Object3D | undefined;
    rig.traverse((o) => {
      if (!chest && (o as THREE.Bone).isBone && /^Spine02$/i.test(o.name)) chest = o;
    });
    if (!chest) return;
    const old = chest.getObjectByName("worn-armor");
    if (old) chest.remove(old);
    const fit = ARMOR_FIT[armor];
    const obj = gltf.scene.clone(true);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.map) {
        mat.emissiveMap = mat.map;
        mat.emissive.set("#ffffff");
        mat.emissiveIntensity = 0.4;
      }
      m.material = mat;
    });
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = fit.height / size.y;
    obj.scale.setScalar(k);
    obj.position.set(-c.x * k, -c.y * k - fit.drop, -c.z * k + fit.depth);
    const holder = new THREE.Group();
    holder.name = "worn-armor";
    holder.add(obj);
    // Đưa về hệ trục của cả nhân vật (đứng thẳng, nhìn +Z) dù xương ngực xoay thế nào lúc dựng
    rig.updateMatrixWorld(true);
    const boneQ = chest.getWorldQuaternion(new THREE.Quaternion());
    const rigQ = rig.getWorldQuaternion(new THREE.Quaternion());
    holder.quaternion.copy(boneQ.invert().multiply(rigQ));
    const ws = chest.getWorldScale(new THREE.Vector3());
    const rs = rig.getWorldScale(new THREE.Vector3());
    holder.scale.setScalar(rs.x / Math.max(1e-6, ws.x));
    chest.add(holder);
  }, [rig, gltf, armor]);
  return null;
}

export function WornArmor({ rig, armor }: { rig: THREE.Object3D; armor: ArmorId }) {
  if (armor === "none") return null;
  return (
    <Suspense fallback={null}>
      <WornArmorInner rig={rig} armor={armor} />
    </Suspense>
  );
}

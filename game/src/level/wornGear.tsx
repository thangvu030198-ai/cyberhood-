// Trang bị mặc trên người nhân vật chính, đọc trực tiếp từ tủ đồ (thay đồ là thấy ngay): giáp ở ngực, mũ trên đầu,
// găng ở hai bàn tay, giày ở hai bàn chân. Dùng chung cho sảnh, màn chơi và khung xem trước trong tủ đồ.

import { Suspense, use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { extraModel, type ExtraModel } from "../game/assets";
import { useGear } from "../game/gearStore";
import { useGame } from "../game/store";
import { GEAR, type AccessoryId } from "./gear";
import { WornArmor } from "./gearView";
import { buildRig, setAnim } from "./LevelScene";

/**
 * Cách đeo từng loại: xương gắn vào, cỡ (mét, theo chiều cao hoặc cạnh dài nhất), độ lệch so với xương
 * (hệ trục nhân vật: +Y lên, +Z trước mặt). `bone`: xoay theo xương (găng bám theo bàn tay);
 * còn lại giữ đứng thẳng theo thân (mũ, giày).
 */
type Fit = { bones: RegExp[]; size: number; by: "height" | "longest"; offset: [number, number, number]; bone?: boolean };
const FIT: Record<"head" | "hands" | "feet", Fit> = {
  head: { bones: [/^Head$/i], size: 0.36, by: "height", offset: [0, 0.13, 0.02] },
  hands: { bones: [/^LeftHand$/i, /^RightHand$/i], size: 0.2, by: "longest", offset: [0, 0.07, 0], bone: true },
  feet: { bones: [/^LeftFoot$/i, /^RightFoot$/i], size: 0.3, by: "longest", offset: [0, -0.05, 0.05] },
};

function findBone(rig: THREE.Object3D, re: RegExp) {
  let bone: THREE.Object3D | undefined;
  rig.traverse((o) => {
    if (!bone && (o as THREE.Bone).isBone && re.test(o.name)) bone = o;
  });
  return bone;
}

/** Dựng model đồ: tâm ở gốc toạ độ, đúng cỡ, vật liệu tự sáng nhẹ theo texture để không chìm trong đêm */
function partObject(scene: THREE.Object3D, fit: Fit) {
  const obj = scene.clone(true);
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
  const c = box.getCenter(new THREE.Vector3());
  const k = fit.size / (fit.by === "height" ? size.y : Math.max(size.x, size.y, size.z));
  obj.scale.setScalar(k);
  obj.position.set(-c.x * k, -c.y * k, -c.z * k);
  // Trục dài nhất của model (để găng nằm dọc theo bàn tay)
  const axis = size.x >= size.y && size.x >= size.z ? new THREE.Vector3(1, 0, 0) : size.y >= size.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  return { obj, axis };
}

function attach(rig: THREE.Object3D, bone: THREE.Object3D, scene: THREE.Object3D, fit: Fit, name: string) {
  bone.getObjectByName(name)?.removeFromParent();
  const { obj, axis } = partObject(scene, fit);
  const holder = new THREE.Group();
  holder.name = name;
  holder.add(obj);
  rig.updateMatrixWorld(true);
  const ws = bone.getWorldScale(new THREE.Vector3());
  const rs = rig.getWorldScale(new THREE.Vector3());
  const unit = rs.x / Math.max(1e-6, ws.x);
  holder.scale.setScalar(unit);
  if (fit.bone) {
    // Bám theo xương: trục dài của găng dọc theo ngón tay (+Y của xương Meshy)
    holder.quaternion.setFromUnitVectors(axis, new THREE.Vector3(0, 1, 0));
    holder.position.set(fit.offset[0] * unit, fit.offset[1] * unit, fit.offset[2] * unit);
  } else {
    // Đứng thẳng theo thân nhân vật dù xương xoay thế nào lúc dựng
    const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
    const rigQ = rig.getWorldQuaternion(new THREE.Quaternion());
    const rel = boneQ.invert().multiply(rigQ);
    holder.quaternion.copy(rel);
    holder.position.set(...fit.offset).applyQuaternion(rel).multiplyScalar(unit);
  }
  bone.add(holder);
  return holder;
}

function PartInner({ rig, slot, id }: { rig: THREE.Object3D; slot: keyof typeof FIT; id: AccessoryId }) {
  const gltf = use(extraModel(GEAR[id].model as ExtraModel));
  useEffect(() => {
    const fit = FIT[slot];
    const made: THREE.Object3D[] = [];
    fit.bones.forEach((re, i) => {
      const bone = findBone(rig, re);
      if (bone) made.push(attach(rig, bone, gltf.scene, fit, `worn-${slot}-${i}`));
    });
    // Tháo đồ / đổi đồ: gỡ model cũ khỏi xương
    return () => made.forEach((o) => o.removeFromParent());
  }, [rig, gltf, slot]);
  return null;
}

/** Toàn bộ đồ đang mặc trong tủ đồ, gắn lên khung xương `rig`. `armor` = false khi nơi gọi tự vẽ giáp riêng */
export function WornGear({ rig, armor = true }: { rig: THREE.Object3D; armor?: boolean }) {
  const head = useGear((s) => s.head);
  const hands = useGear((s) => s.hands);
  const feet = useGear((s) => s.feet);
  const body = useGear((s) => s.armor);
  return (
    <Suspense fallback={null}>
      {armor && <WornArmor key={body} rig={rig} armor={body} />}
      {head && <PartInner key={`h${head}`} rig={rig} slot="head" id={head} />}
      {hands && <PartInner key={`g${hands}`} rig={rig} slot="hands" id={hands} />}
      {feet && <PartInner key={`f${feet}`} rig={rig} slot="feet" id={feet} />}
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Khung xem trước 3D trong tủ đồ: nhân vật đứng thủ thế xoay chậm, mặc đúng đồ đang chọn

function PreviewHero() {
  const skin = useGame((s) => s.profile?.hunter ?? "soldier");
  const base = `mx_cls_${skin === "soldier" ? "racer" : skin}`;
  const walk = use(extraModel(`${base}_walk` as ExtraModel));
  const idle = use(extraModel(`${base}_idle` as ExtraModel));
  const rig = useMemo(() => buildRig(walk.scene, { idle: idle.animations[0] }, 1.8, 0.5), [walk, idle]);
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    setAnim(rig, "idle", 0.2);
    rig.mixer.update(Math.min(dt, 0.1));
    if (spin.current) spin.current.rotation.y += dt * 0.5;
  });
  return (
    <group ref={spin}>
      <primitive object={rig.scene} />
      <WornGear rig={rig.scene} />
    </group>
  );
}

export function GearPreview() {
  return (
    <div className="gbag__preview" aria-label="Xem trước trang phục">
      <Canvas dpr={1} camera={{ fov: 30, position: [0, 1.15, 4.4] }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}>
        <hemisphereLight args={["#cfd8ff", "#20102a", 1.2]} />
        <directionalLight position={[2, 4, 3]} intensity={2.2} />
        <directionalLight position={[-3, 2, -2]} intensity={1.6} color="#ff4fd8" />
        <Suspense fallback={null}>
          <PreviewHero />
        </Suspense>
        <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
          <circleGeometry args={[0.8, 40]} />
          <meshBasicMaterial color="#05d9e8" transparent opacity={0.18} />
        </mesh>
      </Canvas>
    </div>
  );
}

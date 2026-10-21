import { use, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { CuboidCollider } from "@react-three/rapier";
import { EcctrlVehicle, ShapeCastWheel, type EcctrlVehicleHandle } from "ecctrl/vehicle";
import { useJoystickStore } from "ecctrl/input";
import { PALETTE } from "./config";
import { models } from "./assets";
import { handles } from "./refs";
import { useGame } from "./store";

export type CarSpec = {
  id: number;
  name: string;
  position: [number, number, number];
  rotationY: number;
  /** Màu sơn thân xe */
  color: string;
  /** Màu đèn neon gầm xe */
  glow: string;
};

// Xe đậu quanh ngã tư xuất phát. Xe hướng về +Z khi rotationY = 0.
export const CARS: CarSpec[] = [
  { id: 1, name: "Kuro GT", position: [3.5, 1.2, 14], rotationY: 0, color: "#101014", glow: PALETTE.pink },
  { id: 2, name: "Vapor S", position: [-3.5, 1.2, -12], rotationY: Math.PI, color: "#c9d2dc", glow: PALETTE.cyan },
  { id: 3, name: "Ronin 77", position: [14, 1.2, -3.5], rotationY: Math.PI / 2, color: "#ff5a00", glow: PALETTE.amber },
  { id: 4, name: "Wraith", position: [-16, 1.2, 3.5], rotationY: -Math.PI / 2, color: "#4a1fb8", glow: PALETTE.purple },
  { id: 5, name: "Kuro GT", position: [3.5, 1.2, 44], rotationY: 0, color: "#b0003a", glow: PALETTE.pink },
  { id: 6, name: "Vapor S", position: [-60, 1.2, 3.5], rotationY: -Math.PI / 2, color: "#0b6b78", glow: PALETTE.cyan },
];

// Kích thước lấy từ model "Car Concept": bánh bán kính 0.384m, tâm x ±0.98,
// trục trước z = 1.485, trục sau z = -1.314. Model dời z -0.24 để thân xe nằm giữa khung vật lý.
const WHEEL_R = 0.384;
const WHEEL_X = 0.98;
const MODEL_Z = -0.24;
const FRONT_Z = 1.485 + MODEL_Z;
const REAR_Z = -1.314 + MODEL_Z;
const WHEEL_Y = -0.05;
/** Lúc đứng yên tâm bánh nằm thấp hơn điểm gắn khoảng 0.42m (đo từ hệ treo): dời model cho khớp vòm bánh */
const MODEL_Y = WHEEL_Y - 0.42 - WHEEL_R;
const WHEEL_NODES = { FL: "WheelFrontL", FR: "WheelFrontR", RL: "WheelRearL", RR: "WheelRearR" } as const;

const MAX_SPEED_KMH = 140;

/**
 * Gộp mọi lưới cùng vật liệu thành một: model gốc có ~40 lưới, mỗi lưới là một lệnh vẽ.
 * Thuộc tính đã lượng tử hoá (int16) được đổi về float để gộp được.
 */
export function mergeByMaterial(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.geometry;
    const g = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "uv"]) {
      const a = src.getAttribute(name) as THREE.BufferAttribute | undefined;
      if (!a) continue;
      const arr = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = a.getComponent(i, k);
      g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
    }
    if (src.index) g.setIndex(Array.from(src.index.array));
    g.applyMatrix4(mesh.matrixWorld);
    const mat = mesh.material as THREE.Material;
    const list = byMat.get(mat) ?? [];
    list.push(g);
    byMat.set(mat, list);
  });
  const merged = new THREE.Group();
  for (const [mat, geos] of byMat) {
    // Chỉ gộp các lưới có cùng bộ thuộc tính
    const groups = new Map<string, THREE.BufferGeometry[]>();
    for (const g of geos) {
      const key = Object.keys(g.attributes).sort().join(",");
      groups.set(key, [...(groups.get(key) ?? []), g]);
    }
    for (const list of groups.values()) {
      const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (geo) merged.add(new THREE.Mesh(geo, mat));
    }
  }
  return merged;
}

/** Gộp các phần của một bánh: lốp (hông + gai) thành một lưới, vành thành một lưới */
function mergeWheel(pivot: THREE.Group) {
  const tire = new THREE.Group();
  const rim = new THREE.Group();
  pivot.updateMatrixWorld(true);
  const parts: THREE.Mesh[] = [];
  pivot.traverse((o) => (o as THREE.Mesh).isMesh && parts.push(o as THREE.Mesh));
  let tireMat: THREE.Material | null = null;
  let rimMat: THREE.Material | null = null;
  for (const mesh of parts) {
    const name = (mesh.material as THREE.Material).name;
    const isTire = name.startsWith("Tire");
    const target = isTire ? tire : rim;
    if (isTire && (!tireMat || name === "Tiretread")) tireMat = mesh.material as THREE.Material;
    if (!isTire && (!rimMat || name === "Rim1")) rimMat = mesh.material as THREE.Material;
    const m = mesh.clone();
    m.matrix.copy(mesh.matrixWorld);
    m.matrix.decompose(m.position, m.quaternion, m.scale);
    target.add(m);
  }
  const out = new THREE.Group();
  for (const [g, mat] of [
    [tire, tireMat],
    [rim, rimMat],
  ] as const) {
    if (!mat || g.children.length === 0) continue;
    g.traverse((o) => (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material = mat));
    out.add(...mergeByMaterial(g).children);
  }
  // Model gốc dựng bánh trước đang đánh lái chéo: quay quanh trục X sẽ lắc như đĩa đảo.
  // Tìm góc lệch làm bánh mỏng nhất theo trục X rồi xoay thẳng lại.
  const meshes = out.children as THREE.Mesh[];
  const widthAt = (a: number) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    let min = Infinity;
    let max = -Infinity;
    for (const m of meshes) {
      const p = m.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i += 3) {
        const x = p.getX(i) * c + p.getZ(i) * s;
        if (x < min) min = x;
        if (x > max) max = x;
      }
    }
    return max - min;
  };
  let best = 0;
  let bestW = widthAt(0);
  for (let deg = -45; deg <= 45; deg += 0.5) {
    const w = widthAt(THREE.MathUtils.degToRad(deg));
    if (w < bestW - 1e-4) {
      bestW = w;
      best = THREE.MathUtils.degToRad(deg);
    }
  }
  if (best !== 0) {
    // x' = x·cos + z·sin chính là phép quay quanh Y một góc best
    for (const m of meshes) {
      m.geometry.rotateY(best);
      m.geometry.computeBoundingSphere();
    }
  }
  return out;
}

/** Thân xe từ model "Car Concept" (CC-BY 4.0), sơn lại; bánh xe được tách ra cho hệ vật lý */
function useCarModel(paint: string) {
  const gltf = use(models.car);
  return useMemo(() => {
    const body = gltf.scene.clone(true);
    // Mỗi vật liệu gốc chỉ nhân bản một lần cho mỗi xe, để các lưới cùng vật liệu gộp được với nhau
    const cache = new Map<THREE.Material, THREE.MeshPhysicalMaterial>();
    const hidden: THREE.Object3D[] = [];
    body.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshPhysicalMaterial;
      // Đĩa và má phanh khuất sau vành bánh: bỏ để bớt lệnh vẽ
      if (src.name === "Brake" || src.name === "Disc") {
        hidden.push(mesh);
        return;
      }
      const cached = cache.get(src);
      if (cached) {
        mesh.material = cached;
        return;
      }
      const m = src.clone();
      cache.set(src, m);
      if (/^Paint/.test(src.name)) {
        m.color.set(paint);
        m.metalness = 0.75;
        m.roughness = 0.28;
      } else if (src.name === "Headlight") {
        m.emissive.set("#dff6ff");
        m.emissiveIntensity = 3;
      } else if (src.name === "Brakelight") {
        m.emissive.set(PALETTE.pink);
        m.emissiveIntensity = 2.5;
      }
      mesh.material = m;
    });
    for (const h of hidden) h.removeFromParent();
    body.updateMatrixWorld(true);
    // Tách từng bánh (lốp, vành, đĩa phanh) vào một nhóm có gốc tại tâm bánh
    const wheels = {} as Record<keyof typeof WHEEL_NODES, THREE.Group>;
    for (const [key, name] of Object.entries(WHEEL_NODES) as [keyof typeof WHEEL_NODES, string][]) {
      const node = body.getObjectByName(name);
      const pivot = new THREE.Group();
      if (node) {
        const center = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
        pivot.position.copy(center);
        body.add(pivot);
        pivot.updateMatrixWorld(true);
        pivot.attach(node);
        body.remove(pivot);
        pivot.position.set(0, 0, 0);
      }
      wheels[key] = mergeWheel(pivot);
    }
    return { body: mergeByMaterial(body), wheels };
  }, [gltf, paint]);
}

let _glowTexture: THREE.CanvasTexture | null = null;
/** Vệt sáng gầm xe mờ dần ra mép thay vì một tấm chữ nhật màu đặc */
function glowTexture() {
  if (_glowTexture) return _glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glowTexture = new THREE.CanvasTexture(c);
  _glowTexture.colorSpace = THREE.SRGBColorSpace;
  return _glowTexture;
}

function CarBody({ body, glow, active }: { body: THREE.Object3D; glow: string; active: boolean }) {
  return (
    <group>
      <primitive object={body} position={[0, MODEL_Y, MODEL_Z]} />
      {/* underglow hắt xuống mặt đường */}
      <mesh position={[0, MODEL_Y + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 5.6]} />
        <meshBasicMaterial
          color={glow}
          map={glowTexture()}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {active && (
        <>
          <pointLight position={[0, MODEL_Y + 0.2, 0]} color={glow} intensity={25} distance={7} decay={2} />
          <Headlight />
        </>
      )}
    </group>
  );
}

function Headlight() {
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
  }, []);
  return (
    <>
      <spotLight
        ref={light}
        position={[0, 0.3, 2.3]}
        color="#e6f4ff"
        intensity={180}
        distance={45}
        angle={0.5}
        penumbra={0.6}
        decay={1.6}
      />
      <object3D ref={target} position={[0, -1, 14]} />
    </>
  );
}

function Car({ spec }: { spec: CarSpec }) {
  const ref = useRef<EcctrlVehicleHandle>(null);
  const { body, wheels } = useCarModel(spec.color);
  const active = useGame((s) => s.mode === "drive" && s.carId === spec.id);
  const [, getKeys] = useKeyboardControls();

  useEffect(() => {
    const id = spec.id;
    const register = () => {
      if (ref.current) handles.cars.set(id, ref.current);
    };
    register();
    // Handle có thể chưa sẵn sàng ở effect đầu tiên
    const t = setTimeout(register, 0);
    return () => {
      clearTimeout(t);
      handles.cars.delete(id);
    };
  }, [spec.id]);

  // ecctrl: useFrame của bánh xe chạy trước thân xe ở frame đầu, khi trọng lực còn bằng 0,
  // sinh NaN làm hỏng Rapier. Chỉ gắn bánh sau khi thân xe đã đọc được trọng lực.
  const [wheelsOn, setWheelsOn] = useState(false);
  const flippedFor = useRef(0);

  useFrame(() => {
    const car = ref.current;
    if (!car) return;
    if (!wheelsOn) {
      if (car.gravityMag > 0) setWheelsOn(true);
      return;
    }
    if (!active) {
      car.setMovement({ forward: false, backward: false, steerLeft: false, steerRight: false, brake: true });
      // Xe bỏ lại trong tư thế lật thì tự lật lại sau một lúc, tránh nằm chắn đường
      if (car.bodyYAxis.y < 0.4) {
        flippedFor.current += 1 / 60;
        if (flippedFor.current > 2.5) {
          flipCarUpright(spec.id);
          flippedFor.current = 0;
        }
      } else flippedFor.current = 0;
      return;
    }
    const keys = getKeys() as Record<string, boolean>;
    const stick = Object.values(useJoystickStore.getState().joysticks).find((j) => j.active);
    const sy = stick?.y ?? 0;
    const kmh = car.currLinVel.length() * 3.6;
    // Giới hạn tốc độ tối đa cho dễ lái trong phố
    const limiter = kmh > MAX_SPEED_KMH;
    car.setMovement({
      forward: (keys.forward || sy > 0.3) && !limiter,
      backward: keys.backward || sy < -0.3,
      steerLeft: keys.leftward,
      steerRight: keys.rightward,
      brake: keys.jump,
      joystickL: { x: stick?.x ?? 0, y: 0 },
    });
  });

  return (
    <EcctrlVehicle
      ref={ref}
      position={spec.position}
      rotation={[0, spec.rotationY, 0]}
      carConfig={{
        engineHorsepower: 8,
        engineMaxRPM: 6000,
        gearRatios: [12],
        maxSteerAngle: Math.PI / 5,
      }}
      linearDamping={0.05}
      angularDamping={0.6}
    >
      {/* Khối lượng dồn vào thân dưới, cabin gần như không nặng: trọng tâm thấp, xe không bốc đầu */}
      <CuboidCollider args={[1.1, 0.3, 2.1]} position={[0, 0.02, 0]} density={1.0} />
      <CuboidCollider args={[0.85, 0.22, 1.1]} position={[0, 0.5, -0.2]} density={0.05} />
      <CarBody body={body} glow={spec.glow} active={active} />
      {wheelsOn &&
        (
        [
          ["FL", WHEEL_X, FRONT_Z, true],
          ["FR", -WHEEL_X, FRONT_Z, true],
          ["RL", WHEEL_X, REAR_Z, false],
          ["RR", -WHEEL_X, REAR_Z, false],
        ] as const
      ).map(([key, x, z, front]) => (
        <ShapeCastWheel
          key={key}
          position={[x, WHEEL_Y, z]}
          rayShapeR={WHEEL_R}
          wheelModelRadius={WHEEL_R}
          driveWheel
          steerWheel={front}
          brakeWheel
          tireGripFactor={front ? 1.6 : 1.5}
        >
          <primitive object={wheels[key]} />
        </ShapeCastWheel>
      ))}
    </EcctrlVehicle>
  );
}

export function Vehicles() {
  return (
    <>
      {CARS.map((c) => (
        <Car key={c.id} spec={c} />
      ))}
    </>
  );
}

/** Chỉnh xe bị lật: đặt lại thẳng đứng, giữ hướng đầu xe. */
export function flipCarUpright(id: number) {
  const car = handles.cars.get(id);
  if (!car?.body) return;
  const fwd = car.bodyZAxis;
  const yaw = Math.atan2(fwd.x, fwd.z);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const p = car.body.translation();
  car.body.setTranslation({ x: p.x, y: p.y + 1.5, z: p.z }, true);
  car.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

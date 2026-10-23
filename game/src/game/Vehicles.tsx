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
import type { ParkingBay } from "../traffic/road";
import { TUNING } from "../traffic/tuning";
const VEHICLE = TUNING.playerCar;
import { claimBay, nearestFreeBay, releaseBays, ROAD } from "./trafficWorld";

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

// Xe lái được, đậu quanh ngã tư xuất phát. Xe hướng về +Z khi rotationY = 0.
// Vị trí ở đây chỉ là gợi ý: mỗi xe được dời vào ô đỗ trống gần nhất (dọc lề, ngoài làn chạy).
const CAR_HINTS: CarSpec[] = [
  { id: 1, name: "Kuro GT", position: [3.5, 1.2, 14], rotationY: 0, color: "#101014", glow: PALETTE.pink },
  { id: 2, name: "Vapor S", position: [-3.5, 1.2, -12], rotationY: Math.PI, color: "#c9d2dc", glow: PALETTE.cyan },
  { id: 3, name: "Ronin 77", position: [14, 1.2, -3.5], rotationY: Math.PI / 2, color: "#ff5a00", glow: PALETTE.amber },
  { id: 4, name: "Wraith", position: [-16, 1.2, 3.5], rotationY: -Math.PI / 2, color: "#4a1fb8", glow: PALETTE.purple },
  { id: 5, name: "Kuro GT", position: [3.5, 1.2, 44], rotationY: 0, color: "#b0003a", glow: PALETTE.pink },
  { id: 6, name: "Vapor S", position: [-60, 1.2, 3.5], rotationY: -Math.PI / 2, color: "#0b6b78", glow: PALETTE.cyan },
];

export const CARS: CarSpec[] = CAR_HINTS.map((c) => {
  const bay = nearestFreeBay(c.position[0], c.position[2]);
  if (!bay) return c;
  claimBay(bay, `car${c.id}`);
  return { ...c, position: [bay.x, 1.2, bay.z], rotationY: bay.yaw };
});

/** Xe bị bỏ lại ngoài ô đỗ: sau một lúc tự trượt vào ô trống gần nhất để không chắn đường */
type AutoPark = { since: number; from: THREE.Vector3; fromYaw: number; bay: ParkingBay | null; t: number };

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
export function glowTexture() {
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

function CarBody({ body, glow }: { body: THREE.Object3D; glow: string }) {
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
    </group>
  );
}

const _fwd = new THREE.Vector3();
const _glowColor = new THREE.Color();

/**
 * Đèn gầm và đèn pha của xe đang lái: một bộ đèn dùng chung luôn nằm trong cảnh, bám theo xe.
 * Gắn đèn riêng cho từng xe rồi bật/tắt khi lên xe sẽ làm đổi số đèn, mọi shader biên dịch lại và game giật.
 */
function DriveLights() {
  const under = useRef<THREE.PointLight>(null);
  const head = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => {
    if (head.current && target.current) head.current.target = target.current;
  }, []);
  useFrame(() => {
    const s = useGame.getState();
    const car = s.mode === "drive" && s.carId !== null ? handles.cars.get(s.carId) : null;
    const u = under.current;
    const h = head.current;
    const t = target.current;
    if (!u || !h || !t) return;
    u.intensity = car ? 25 : 0;
    h.intensity = car ? 180 : 0;
    if (!car) return;
    const p = car.currPos;
    _fwd.copy(car.bodyZAxis).setY(0).normalize();
    u.position.set(p.x, p.y + MODEL_Y + 0.2, p.z);
    u.color.copy(_glowColor.set(CARS.find((c) => c.id === s.carId)?.glow ?? "#ffffff"));
    h.position.set(p.x + _fwd.x * 2.3, p.y + 0.3, p.z + _fwd.z * 2.3);
    t.position.set(p.x + _fwd.x * 16, p.y - 1, p.z + _fwd.z * 16);
    t.updateMatrixWorld();
  });
  return (
    <>
      <pointLight ref={under} intensity={0} distance={7} decay={2} />
      <spotLight ref={head} color="#e6f4ff" intensity={0} distance={45} angle={0.5} penumbra={0.6} decay={1.6} />
      <object3D ref={target} />
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
  const park = useRef<AutoPark>({ since: 0, from: new THREE.Vector3(), fromYaw: 0, bay: null, t: 0 });
  /** Thời gian đã đứng yên, và xe đang ở chế độ đỗ (lực cản cao) */
  const rest = useRef(0);
  const restY = useRef(spec.position[1]);
  const locked = useRef(false);
  const pinned = useRef(false);

  useFrame((_, dt) => {
    const car = ref.current;
    if (!car) return;
    if (!wheelsOn) {
      if (car.gravityMag > 0) setWheelsOn(true);
      return;
    }
    if (!active) {
      car.setMovement({ forward: false, backward: false, steerLeft: false, steerRight: false, brake: true });
      autoPark(spec.id, car, park.current, dt);
      // Xe đỗ: hệ treo tính lực theo độ dài bước vật lý của frame trước, nên khi FPS dao động (máy yếu, cảnh nặng)
      // xe đứng yên vẫn nảy tưng tưng. Xe không ai lái, không trôi ngang thì tăng lực cản cho dao động tắt hẳn.
      const body = car.body;
      if (body) {
        const v = car.currLinVel;
        const still = Math.hypot(v.x, v.z) < 0.4 && !park.current.bay;
        rest.current = still ? rest.current + dt : 0;
        // Độ cao trung bình của thân xe (tâm dao động) để đặt xe khi khoá
        restY.current += (car.currPos.y - restY.current) * Math.min(1, dt * 3);
        if (!locked.current && rest.current > 0.5) {
          // Bước 1: lực cản lớn dập dao động
          body.setLinearDamping(PARKED_DAMPING);
          body.setAngularDamping(PARKED_DAMPING);
          locked.current = true;
        } else if (locked.current && !pinned.current && rest.current > 1.5 && car.bodyYAxis.y > 0.9) {
          // Bước 2: đặt xe thẳng đứng ở độ cao trung bình, khoá trục dọc và độ nghiêng (vẫn đẩy ngang được)
          const p = car.currPos;
          const yaw = Math.atan2(car.bodyZAxis.x, car.bodyZAxis.z);
          _yawQ.setFromAxisAngle(_Y, yaw);
          body.setTranslation({ x: p.x, y: restY.current, z: p.z }, true);
          body.setRotation({ x: _yawQ.x, y: _yawQ.y, z: _yawQ.z, w: _yawQ.w }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          body.setEnabledTranslations(true, false, true, true);
          body.setEnabledRotations(false, true, false, true);
          pinned.current = true;
        } else if (locked.current && !still) unlockCar(body, locked, pinned);
      }
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
    park.current.since = 0;
    park.current.bay = null;
    if (locked.current && car.body) unlockCar(car.body, locked, pinned);
    rest.current = 0;
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
      linearDamping={DRIVE_LIN_DAMPING}
      angularDamping={DRIVE_ANG_DAMPING}
    >
      {/* Khối lượng dồn vào thân dưới, cabin gần như không nặng: trọng tâm thấp, xe không bốc đầu */}
      <CuboidCollider args={[1.1, 0.3, 2.1]} position={[0, 0.02, 0]} density={1.0} />
      <CuboidCollider args={[0.85, 0.22, 1.1]} position={[0, 0.5, -0.2]} density={0.05} />
      <CarBody body={body} glow={spec.glow} />
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
          // Hệ treo: cứng vừa, giảm chấn mạnh hơn mặc định (180/16) để xe không nảy tưng tưng
          springK={VEHICLE.springK}
          dampingC={VEHICLE.dampingC}
        >
          <primitive object={wheels[key]} />
        </ShapeCastWheel>
      ))}
    </EcctrlVehicle>
  );
}

/** Lực cản khi xe đỗ (đủ lớn để dập dao động hệ treo trong vài frame) */
const PARKED_DAMPING = 8;
/** Lực cản khi chạy, khớp với prop của EcctrlVehicle */
const DRIVE_LIN_DAMPING = 0.05;
const DRIVE_ANG_DAMPING = 0.6;

function unlockCar(body: NonNullable<EcctrlVehicleHandle["body"]>, locked: { current: boolean }, pinned: { current: boolean }) {
  body.setLinearDamping(DRIVE_LIN_DAMPING);
  body.setAngularDamping(DRIVE_ANG_DAMPING);
  if (pinned.current) {
    body.setEnabledTranslations(true, true, true, true);
    body.setEnabledRotations(true, true, true, true);
  }
  locked.current = false;
  pinned.current = false;
}

export function Vehicles() {
  return (
    <>
      {CARS.map((c) => (
        <Car key={c.id} spec={c} />
      ))}
      <DriveLights />
    </>
  );
}

const PK = TUNING.parking;
const _yawQ = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);

/** Xe đang nằm gọn trong một ô đỗ (đúng chỗ, đúng hướng) */
function inBay(x: number, z: number, yaw: number) {
  return ROAD.bays.some((b) => Math.hypot(b.x - x, b.z - z) < 1.6 && Math.abs(Math.sin(b.yaw - yaw)) < 0.3);
}

/**
 * Xe lái được không ai dùng mà nằm ngoài ô đỗ (ví dụ người chơi bỏ giữa đường):
 * đợi người chơi đi xa rồi trượt xe vào ô trống gần nhất, nhường đường cho giao thông.
 */
function autoPark(id: number, car: EcctrlVehicleHandle, st: AutoPark, dt: number) {
  const body = car.body;
  if (!body) return;
  const p = car.currPos;
  const yaw = Math.atan2(car.bodyZAxis.x, car.bodyZAxis.z);
  if (st.bay) {
    // Đang trượt vào ô: nội suy vị trí và hướng, khử vận tốc
    st.t = Math.min(1, st.t + dt / PK.autoParkTime);
    const k = st.t * st.t * (3 - 2 * st.t);
    const x = st.from.x + (st.bay.x - st.from.x) * k;
    const z = st.from.z + (st.bay.z - st.from.z) * k;
    let dyaw = st.bay.yaw - st.fromYaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    _yawQ.setFromAxisAngle(_Y, st.fromYaw + dyaw * k);
    body.setTranslation({ x, y: Math.max(p.y, 0.9), z }, true);
    body.setRotation({ x: _yawQ.x, y: _yawQ.y, z: _yawQ.z, w: _yawQ.w }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (st.t >= 1) {
      st.bay = null;
      st.since = 0;
    }
    return;
  }
  if (inBay(p.x, p.z, yaw)) {
    st.since = 0;
    return;
  }
  const player = handles.player?.currPos;
  const far = !player || Math.hypot(player.x - p.x, player.z - p.z) > PK.autoParkPlayerDistance;
  st.since = far && car.currLinVel.length() < 1 ? st.since + dt : 0;
  if (st.since < PK.autoParkDelay) return;
  const owner = `car${id}`;
  releaseBays(owner);
  const bay = nearestFreeBay(p.x, p.z, owner);
  if (!bay) return;
  claimBay(bay, owner);
  st.bay = bay;
  st.t = 0;
  st.from.set(p.x, p.y, p.z);
  // Xe lật thì dựng lại trước
  st.fromYaw = yaw;
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

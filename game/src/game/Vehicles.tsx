import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { CuboidCollider } from "@react-three/rapier";
import { EcctrlVehicle, ShapeCastWheel, type EcctrlVehicleHandle } from "ecctrl/vehicle";
import { useJoystickStore } from "ecctrl/input";
import { PALETTE } from "./config";
import { handles } from "./refs";
import { useGame } from "./store";

export type CarSpec = {
  id: number;
  name: string;
  position: [number, number, number];
  rotationY: number;
  color: string;
  glow: string;
};

// Xe đậu quanh ngã tư xuất phát. Xe hướng về +Z khi rotationY = 0.
export const CARS: CarSpec[] = [
  { id: 1, name: "Kuro GT", position: [3.5, 1.2, 14], rotationY: 0, color: "#1b1030", glow: PALETTE.pink },
  { id: 2, name: "Vapor S", position: [-3.5, 1.2, -12], rotationY: Math.PI, color: "#0c1a24", glow: PALETTE.cyan },
  { id: 3, name: "Ronin 77", position: [14, 1.2, -3.5], rotationY: Math.PI / 2, color: "#22180a", glow: PALETTE.amber },
  { id: 4, name: "Wraith", position: [-16, 1.2, 3.5], rotationY: -Math.PI / 2, color: "#160c26", glow: PALETTE.purple },
  { id: 5, name: "Kuro GT", position: [3.5, 1.2, 44], rotationY: 0, color: "#2a0d18", glow: PALETTE.pink },
  { id: 6, name: "Vapor S", position: [-60, 1.2, 3.5], rotationY: -Math.PI / 2, color: "#0c1a24", glow: PALETTE.cyan },
];

const WHEEL_R = 0.42;
const WHEEL_X = 0.98;
const WHEEL_Z = 1.38;
const WHEEL_Y = -0.05;

const MAX_SPEED_KMH = 140;

function WheelModel({ glow }: { glow: string }) {
  const rim = useMemo(() => new THREE.Color(glow).multiplyScalar(3), [glow]);
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.3, 18]} />
        <meshStandardMaterial color="#0b0a10" roughness={0.8} />
      </mesh>
      <mesh>
        <torusGeometry args={[WHEEL_R * 0.62, 0.03, 6, 20]} />
        <meshBasicMaterial color={rim} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Thân xe low-poly kiểu coupe tương lai: thân thấp, cabin kính tối, dải đèn liền mạch. */
function CarBody({ color, glow, active }: { color: string; glow: string; active: boolean }) {
  const glowColor = useMemo(() => new THREE.Color(glow).multiplyScalar(2.5), [glow]);
  const head = useMemo(() => new THREE.Color("#dff6ff").multiplyScalar(active ? 6 : 1.6), [active]);
  const tail = useMemo(() => new THREE.Color(PALETTE.pink).multiplyScalar(active ? 5 : 1.8), [active]);
  return (
    <group>
      {/* thân dưới */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[2.0, 0.5, 4.3]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.25} />
      </mesh>
      {/* nắp capo vát */}
      <mesh position={[0, 0.33, 1.35]} rotation={[-0.12, 0, 0]}>
        <boxGeometry args={[1.9, 0.12, 1.5]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.25} />
      </mesh>
      {/* cabin kính */}
      <mesh position={[0, 0.58, -0.25]}>
        <boxGeometry args={[1.7, 0.5, 2.0]} />
        <meshStandardMaterial color="#05060b" metalness={1} roughness={0.08} />
      </mesh>
      {/* cánh gió sau */}
      <mesh position={[0, 0.55, -2.0]}>
        <boxGeometry args={[2.0, 0.06, 0.4]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.25} />
      </mesh>
      {/* dải đèn pha */}
      <mesh position={[0, 0.18, 2.16]}>
        <boxGeometry args={[1.8, 0.08, 0.04]} />
        <meshBasicMaterial color={head} toneMapped={false} />
      </mesh>
      {/* dải đèn hậu */}
      <mesh position={[0, 0.22, -2.16]}>
        <boxGeometry args={[1.9, 0.1, 0.04]} />
        <meshBasicMaterial color={tail} toneMapped={false} />
      </mesh>
      {/* viền neon hai bên sườn */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.01, -0.1, 0]}>
          <boxGeometry args={[0.03, 0.05, 3.6]} />
          <meshBasicMaterial color={glowColor} toneMapped={false} />
        </mesh>
      ))}
      {/* underglow hắt xuống mặt đường */}
      <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 4.8]} />
        <meshBasicMaterial color={glow} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>
      {active && (
        <>
          <pointLight position={[0, -0.3, 0]} color={glow} intensity={25} distance={7} decay={2} />
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

  useFrame(() => {
    const car = ref.current;
    if (!car) return;
    if (!wheelsOn) {
      if (car.gravityMag > 0) setWheelsOn(true);
      return;
    }
    if (!active) {
      car.setMovement({ forward: false, backward: false, steerLeft: false, steerRight: false, brake: true });
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
      <CuboidCollider args={[1.0, 0.32, 2.15]} position={[0, 0.05, 0]} density={1.2} />
      <CuboidCollider args={[0.85, 0.25, 1.0]} position={[0, 0.58, -0.25]} density={0.05} />
      <CarBody color={spec.color} glow={spec.glow} active={active} />
      {wheelsOn &&
        (
        [
          [WHEEL_X, WHEEL_Z, true],
          [-WHEEL_X, WHEEL_Z, true],
          [WHEEL_X, -WHEEL_Z, false],
          [-WHEEL_X, -WHEEL_Z, false],
        ] as const
      ).map(([x, z, front]) => (
        <ShapeCastWheel
          key={`${x}:${z}`}
          position={[x, WHEEL_Y, z]}
          rayShapeR={WHEEL_R}
          wheelModelRadius={WHEEL_R}
          driveWheel
          steerWheel={front}
          brakeWheel
          tireGripFactor={front ? 1.6 : 1.5}
        >
          <WheelModel glow={spec.glow} />
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

// Phòng thử xe (chỉ dùng khi phát triển): mặt phẳng + vỉa hè + xe người chơi, chạy với bước thời gian cố định
// cố định bằng cách tự gọi advance(), ghi lại độ cao/độ nghiêng thân xe mỗi frame để đo hệ treo.
import { createRoot } from "react-dom/client";
import { Suspense, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody, useRapier } from "@react-three/rapier";
import { Vehicles } from "../game/Vehicles";
import { Sidewalks } from "../game/CityRoads";
import { handles } from "../game/refs";
import { useGame } from "../game/store";
import { stepPhysics } from "../game/physicsStep";
import { TUNING } from "../traffic/tuning";

const params = new URLSearchParams(location.search);
// Ghi đè hệ treo để dò thông số: ?spring=..&damp=..
if (params.has("spring")) TUNING.playerCar.springK = Number(params.get("spring"));
if (params.has("damp")) TUNING.playerCar.dampingC = Number(params.get("damp"));

/** Mô phỏng FPS thấp: ?fps=25. Cách bước vật lý: ?mode=clamp (cắt bước như bản cũ) hoặc substep */
const FPS = Number(params.get("fps") ?? 60);
const DT = 1 / FPS;
/** ?jitter=1: frame dài ngắn xen kẽ (1/60 và 1/25) như khi game nặng */
const JITTER = params.has("jitter");
const MODE = params.get("mode") ?? "substep";
const STEPS = Number(params.get("steps") ?? 900);

const lab = { dt: 1 / 60 };

function Stepper() {
  const { step } = useRapier();
  useFrame(() => {
    // Độ dài frame giả lập (R3F tự đo thời gian thật nên không dùng delta của nó)
    const delta = lab.dt;
    if (MODE === "clamp") step(Math.min(delta, 1 / 40));
    else if (MODE === "raw") step(Math.min(delta, 0.1));
    else if (MODE === "fixed") step(1 / 60);
    else stepPhysics(step, delta);
  });
  return null;
}

type Row = [number, number, number, number, number, number];
const log: Row[] = [];
(window as unknown as { __log: Row[] }).__log = log;

function Telemetry() {
  useFrame(() => {
    const c = handles.cars.get(1);
    if (!c) return;
    const p = c.currPos;
    log.push([p.x, p.y, p.z, c.bodyYAxis.y, c.currLinVel.length(), c.currAngVel.length()]);
  });
  return null;
}

function Driver() {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    // Ngồi sẵn trong xe số 1
    useGame.setState({ mode: "drive", carId: 1, profile: { handle: "lab", body: "#222", glow: "#0ff" } });
    let t = performance.now();
    let i = 0;
    const run = () => {
      // Chạy nhiều frame mỗi lần để không phụ thuộc tốc độ vẽ thật
      for (let k = 0; k < 10 && i < STEPS; k++, i++) {
        lab.dt = JITTER ? (i % 3 === 0 ? 1 / 25 : 1 / 60) * (0.8 + ((i * 7919) % 100) / 250) : DT;
        t += lab.dt * 1000;
        advance(t, true);
      }
      if (i < STEPS) setTimeout(run, 0);
      else (window as unknown as { __done: boolean }).__done = true;
    };
    setTimeout(run, 500);
  }, [advance]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <KeyboardControls
    map={[
      { name: "forward", keys: ["KeyW"] },
      { name: "backward", keys: ["KeyS"] },
      { name: "leftward", keys: ["KeyA"] },
      { name: "rightward", keys: ["KeyD"] },
      { name: "jump", keys: ["Space"] },
      { name: "run", keys: ["ShiftLeft"] },
    ]}
  >
    <Canvas frameloop="never" camera={{ position: [10, 10, 30] }}>
      <ambientLight />
      <Suspense fallback={null}>
        <Physics paused>
          <Stepper />
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[400, 5, 400]} position={[0, -5, 0]} />
          </RigidBody>
          {params.has("curbs") && <Sidewalks />}
          <Vehicles />
          <Telemetry />
        </Physics>
        <Driver />
      </Suspense>
    </Canvas>
  </KeyboardControls>,
);

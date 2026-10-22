import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { BOARD_POS, contractPins, runtime, updateContract, type Pin } from "./contracts";

// Phần hình ảnh của hợp đồng: bảng hợp đồng ở Hub, cột sáng marker kiểu GTA, cổng đua,
// thùng tiếp tế, điểm thoát, cột sáng khi rơi đồ.

const PIN_POOL = 12;
const BEAM_LIFE = 2.6;

function boardTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(8,4,20,0.92)";
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = "#ffb000";
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 304);
  ctx.fillStyle = "#ffb000";
  ctx.font = "700 64px 'Chakra Petch', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CONTRACT · 契約", 256, 120);
  ctx.fillStyle = "#05d9e8";
  ctx.font = "700 34px 'JetBrains Mono', monospace";
  ctx.fillText("NEXUS · NEON CITY", 256, 185);
  ctx.fillStyle = "#e9e6ff";
  ctx.font = "28px 'JetBrains Mono', monospace";
  ctx.fillText("PRESS E · 受注", 256, 250);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bảng hợp đồng: cột trụ và màn hình hologram */
function Board() {
  const screen = useRef<THREE.Mesh>(null);
  const tex = useMemo(boardTexture, []);
  useFrame(({ clock }) => {
    if (screen.current) (screen.current.material as THREE.MeshBasicMaterial).opacity = 0.85 + Math.sin(clock.elapsedTime * 5) * 0.08;
  });
  return (
    <group position={BOARD_POS} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.5, 1.8, 0.5]} />
        <meshStandardMaterial color="#141022" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.82, 0]}>
        <boxGeometry args={[0.62, 0.06, 0.62]} />
        <meshBasicMaterial color={new THREE.Color("#ffb000").multiplyScalar(3)} toneMapped={false} />
      </mesh>
      <mesh ref={screen} position={[0, 2.55, 0]}>
        <planeGeometry args={[2.2, 1.375]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 2.4, 0.6]} color="#ffb000" intensity={14} distance={8} decay={2} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.3, 0.9, 0.3]} position={[0, 0.9, 0]} />
      </RigidBody>
    </group>
  );
}

const PIN_STYLE: Record<Pin["kind"], { radius: number; height: number }> = {
  marker: { radius: 1.6, height: 60 },
  objective: { radius: 1.2, height: 40 },
  extract: { radius: 3.5, height: 90 },
  crate: { radius: 1.4, height: 70 },
  car: { radius: 2.4, height: 30 },
  board: { radius: 0.9, height: 25 },
  battery: { radius: 0.6, height: 12 },
  gate: { radius: 2.6, height: 70 },
};

/** Cột sáng và vòng dưới đất cho mọi điểm cần tới */
function Pins() {
  const beams = useRef<(THREE.Mesh | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const crate = useRef<THREE.Group>(null);
  const crateLight = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const pins = contractPins();
    const t = clock.elapsedTime;
    for (let i = 0; i < PIN_POOL; i++) {
      const beam = beams.current[i];
      const ring = rings.current[i];
      if (!beam || !ring) continue;
      const pin = pins[i];
      beam.visible = ring.visible = !!pin;
      if (!pin) continue;
      const style = PIN_STYLE[pin.kind];
      beam.position.set(pin.x, style.height / 2, pin.z);
      beam.scale.set(style.radius, style.height, style.radius);
      ring.position.set(pin.x, 0.2, pin.z);
      ring.scale.setScalar(style.radius * (1.6 + Math.sin(t * 3 + i) * 0.15));
      const bm = beam.material as THREE.MeshBasicMaterial;
      bm.color.set(pin.color).multiplyScalar(2.2);
      bm.opacity = 0.2 + Math.sin(t * 2.5 + i) * 0.06;
      (ring.material as THREE.MeshBasicMaterial).color.set(pin.color).multiplyScalar(3);
    }
    if (crate.current) {
      crate.current.visible = !!runtime.crate;
      if (runtime.crate) {
        crate.current.position.set(runtime.crate.x, 0.6 + Math.sin(t * 2) * 0.1, runtime.crate.z);
        crate.current.rotation.y = t * 0.6;
      }
    }
    // Đèn để ngoài nhóm và chỉ đổi độ sáng, tránh biên dịch lại shader khi thùng xuất hiện
    if (crateLight.current) {
      crateLight.current.intensity = runtime.crate ? 20 : 0;
      if (runtime.crate) crateLight.current.position.set(runtime.crate.x, 1.2, runtime.crate.z);
    }
  });
  return (
    <>
      {Array.from({ length: PIN_POOL }, (_, i) => (
        <group key={i}>
          <mesh ref={(m) => void (beams.current[i] = m)} visible={false} frustumCulled={false}>
            <cylinderGeometry args={[1, 1, 1, 20, 1, true]} />
            <meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh ref={(m) => void (rings.current[i] = m)} visible={false} rotation-x={-Math.PI / 2} frustumCulled={false}>
            <ringGeometry args={[0.85, 1, 40]} />
            <meshBasicMaterial transparent opacity={0.9} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <group ref={crate} visible={false}>
        {/* Thân thùng là model Meshy (MeshyProps); ở đây chỉ còn vòng sáng dưới đất */}
        <mesh position={[0, -0.5, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.1, 1.3, 40]} />
          <meshBasicMaterial color={new THREE.Color("#b05cff").multiplyScalar(4)} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={crateLight} color="#b05cff" intensity={0} distance={10} decay={2} />
    </>
  );
}

/** Cổng đua: vòng tròn đứng ở checkpoint kế tiếp */
function RaceGate() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = runtime.mission;
    const g = ref.current;
    if (!g) return;
    const p = m?.type === "race" ? m.points[m.stage] : undefined;
    g.visible = !!p;
    if (!p) return;
    g.position.set(p.x, 4, p.z);
    g.rotation.y = clock.elapsedTime * 0.8;
  });
  return (
    <mesh ref={ref} visible={false}>
      <torusGeometry args={[5, 0.25, 12, 48]} />
      <meshBasicMaterial color={new THREE.Color("#05d9e8").multiplyScalar(4)} toneMapped={false} />
    </mesh>
  );
}

/** Cột sáng màu độ hiếm mỗi khi rơi đồ */
function LootBeams() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const t = performance.now() / 1000;
    runtime.beams = runtime.beams.filter((b) => t - b.born < BEAM_LIFE);
    for (let i = 0; i < 6; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const b = runtime.beams[i];
      mesh.visible = !!b;
      if (!b) continue;
      const k = (t - b.born) / BEAM_LIFE;
      mesh.position.set(b.pos.x, 15, b.pos.z);
      mesh.scale.set(0.6 + k * 0.6, 30, 0.6 + k * 0.6);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(b.color).multiplyScalar(3);
      mat.opacity = (1 - k) * 0.7;
    }
  });
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} visible={false} frustumCulled={false}>
          <cylinderGeometry args={[1, 1, 1, 16, 1, true]} />
          <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

/** Chạy logic hợp đồng mỗi frame */
function ContractDirector() {
  useFrame((_, dt) => updateContract(Math.min(dt, 0.1)));
  return null;
}

export function ContractScene() {
  return (
    <>
      <Board />
      <Pins />
      <RaceGate />
      <LootBeams />
      <ContractDirector />
    </>
  );
}

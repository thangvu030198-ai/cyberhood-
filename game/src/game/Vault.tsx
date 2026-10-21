import { use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { models } from "./assets";
import { PALETTE } from "./config";
import { VAULT_EXIT, VAULT_TERMINAL } from "./quests";
import { useGame } from "./store";
import { VAULT_DOOR, VAULT_ORIGIN } from "./story";
import { makeLabelTexture } from "./textures";

// Model hành lang ("Space Ship Hallway", yeeyeeman, CC-BY 4.0) có sàn ở y = -2.96, tâm x = 20.1,
// đầu hành lang ở z = 3.08. Dời model để sàn nằm ở y = 0, tâm x = 0, đầu hành lang ở z ≈ 1.
const MODEL_OFFSET: [number, number, number] = [-20.1, 2.96, -2];
const HALF_WIDTH = 4;
const LENGTH = 28.2;
const FRONT_Z = 1.08;

function Hallway() {
  const gltf = use(models.vault);
  const scene = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      // Tăng chất cyberpunk: đèn khe thông gió phát sáng cyan, mảng tường xanh hắt sáng
      if (m.name === "Vent_light") {
        m.emissive.set(PALETTE.cyan);
        m.emissiveIntensity = 2.2;
      } else if (m.name === "Wall_blue") {
        m.emissive.set("#2a3cff");
        m.emissiveIntensity = 0.8;
      } else if (m.name === "Glass") {
        m.transparent = true;
        m.opacity = 0.25;
      } else {
        m.color.multiplyScalar(0.55);
        m.metalness = 0.6;
        m.roughness = 0.35;
      }
      mesh.material = m;
    });
    return s;
  }, [gltf]);
  return <primitive object={scene} position={MODEL_OFFSET} />;
}

function Hologram() {
  const gltf = use(models.robot);
  const ref = useRef<THREE.Group>(null);
  const { scene, material } = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.cyan).multiplyScalar(1.6),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      wireframe: true,
      toneMapped: false,
    });
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.material = mat;
    });
    s.scale.setScalar(0.46);
    return { scene: s, material: mat };
  }, [gltf]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Nhấp nháy như tín hiệu chập chờn
    material.opacity = 0.35 + Math.sin(t * 9) * 0.05 + (Math.random() < 0.04 ? -0.25 : 0);
    if (ref.current) ref.current.rotation.y = Math.PI + Math.sin(t * 0.6) * 0.3;
  });

  return (
    <group ref={ref} position={[0, 0.9, -1.4]}>
      <primitive object={scene} />
    </group>
  );
}

function Terminal() {
  const screen = useMemo(() => makeLabelTexture("GHOST_0", "ROOT PROTOCOL // STANDBY", PALETTE.cyan), []);
  return (
    <group position={VAULT_TERMINAL}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 1, 0.8]} />
        <meshStandardMaterial color="#0d0b16" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.35, -0.1]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial map={screen} toneMapped={false} color={[1.6, 1.6, 1.6]} />
      </mesh>
      {/* bệ chiếu hologram */}
      <mesh position={[0, 0.06, -1.4]}>
        <cylinderGeometry args={[0.7, 0.8, 0.12, 24]} />
        <meshBasicMaterial color={new THREE.Color(PALETTE.cyan).multiplyScalar(2)} toneMapped={false} />
      </mesh>
      <Hologram />
      <pointLight position={[0, 2.4, -1]} color={PALETTE.cyan} intensity={40} distance={12} decay={2} />
    </group>
  );
}

function ExitPortal() {
  const label = useMemo(() => makeLabelTexture("EXIT", "THE UNDERGRID", PALETTE.amber), []);
  return (
    <group position={VAULT_EXIT}>
      {/* Biển chỉ nhìn thấy khi quay mặt về lối ra; camera đứng sau sẽ không bị che */}
      <mesh position={[0, 4.4, -0.6]}>
        <planeGeometry args={[2.2, 0.7]} />
        <meshBasicMaterial map={label} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 2.5, -0.5]} color={PALETTE.amber} intensity={20} distance={8} decay={2} />
    </group>
  );
}

export function Vault() {
  const location = useGame((s) => s.location);
  return (
    <group position={VAULT_ORIGIN}>
      {/* Chỉ vẽ khi người chơi ở trong vault; va chạm thì luôn có */}
      <group visible={location === "vault"}>
        <Hallway />
        <Terminal />
        <ExitPortal />
        {[-6, -13, -20].map((z) => (
          <pointLight key={z} position={[0, 4.5, z]} color="#7a6bff" intensity={35} distance={14} decay={2} />
        ))}
      </group>
      {/* Hộp vô hình chặn camera, thay cho việc raycast vào 53 nghìn tam giác của model */}
      <group visible={false}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (HALF_WIDTH + 0.5), 4, FRONT_Z - LENGTH / 2]} userData={{ cameraCollider: true }}>
            <boxGeometry args={[1, 8, LENGTH + 2]} />
          </mesh>
        ))}
        <mesh position={[0, 4, FRONT_Z + 0.5]} userData={{ cameraCollider: true }}>
          <boxGeometry args={[HALF_WIDTH * 2 + 2, 8, 1]} />
        </mesh>
        <mesh position={[0, 6.9, FRONT_Z - LENGTH / 2]} userData={{ cameraCollider: true }}>
          <boxGeometry args={[HALF_WIDTH * 2 + 2, 1, LENGTH + 2]} />
        </mesh>
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[HALF_WIDTH + 1, 0.5, LENGTH / 2 + 1]} position={[0, -0.5, FRONT_Z - LENGTH / 2]} />
        {[-1, 1].map((side) => (
          <CuboidCollider
            key={side}
            args={[0.5, 4, LENGTH / 2 + 1]}
            position={[side * (HALF_WIDTH + 0.5), 4, FRONT_Z - LENGTH / 2]}
          />
        ))}
        <CuboidCollider args={[HALF_WIDTH + 1, 4, 0.5]} position={[0, 4, FRONT_Z + 0.5]} />
        <CuboidCollider args={[HALF_WIDTH + 1, 4, 0.5]} position={[0, 4, FRONT_Z - LENGTH - 0.5]} />
        {/* bàn terminal */}
        <CuboidCollider args={[0.9, 0.5, 0.4]} position={[VAULT_TERMINAL[0], 0.5, VAULT_TERMINAL[2]]} />
      </RigidBody>
    </group>
  );
}

/** Cửa vào Server Vault ở The Undergrid: khung neon, đỏ khi khoá, xanh khi mở */
export function VaultDoor() {
  const unlocked = useGame((s) => s.quest.done.includes("ghost-signal"));
  const color = unlocked ? "#39ff88" : "#ff1f3d";
  const label = useMemo(
    () => makeLabelTexture("SERVER VAULT", unlocked ? "ACCESS GRANTED" : "LOCKED // ENCRYPTED", color),
    [unlocked, color],
  );
  const glow = useMemo(() => new THREE.Color(color).multiplyScalar(4), [color]);
  const portal = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (portal.current) portal.current.opacity = 0.25 + Math.sin(clock.elapsedTime * 3) * 0.1;
  });
  // Cửa áp lưng vào toà nhà, mặt hướng ra đường (+X)
  return (
    <group position={VAULT_DOOR} rotation={[0, Math.PI / 2, 0]}>
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]}>
          <boxGeometry args={[0.18, 3.4, 0.3]} />
          <meshBasicMaterial color={glow} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 3.45, 0]}>
        <boxGeometry args={[2.78, 0.18, 0.3]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.7, -0.05]}>
        <planeGeometry args={[2.4, 3.3]} />
        <meshBasicMaterial ref={portal} color={color} transparent opacity={0.3} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 4.2, 0]}>
        <planeGeometry args={[3.2, 1]} />
        <meshBasicMaterial map={label} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 2, 1.2]} color={color} intensity={25} distance={9} decay={2} />
    </group>
  );
}

import { use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { models } from "./assets";
import { CITY, PALETTE } from "./config";
import { handles } from "./refs";
import { useGame } from "./store";
import { makeSignTexture } from "./textures";

/** Quầy chợ đen Neon Bazaar ở góc phố gần điểm xuất phát */
export const SHOP_POS = new THREE.Vector3(10.2, CITY.SIDEWALK_HEIGHT, 13);
const SHOP_REACH = 3.4;

function VendorBot() {
  const gltf = use(models.robot);
  const { scene, mixer } = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    s.scale.setScalar(0.4);
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      // Người bán: tông cyan để phân biệt với người chơi
      if (m.name === "Main") {
        m.color.set("#0b2a33");
        m.emissive.set(PALETTE.cyan);
        m.emissiveIntensity = 0.45;
      }
      mesh.material = m;
    });
    const mixer = new THREE.AnimationMixer(s);
    const idle = gltf.animations.find((a) => a.name === "Idle");
    if (idle) mixer.clipAction(idle).play();
    return { scene: s, mixer };
  }, [gltf]);

  const wave = useMemo(() => gltf.animations.find((a) => a.name === "Wave"), [gltf]);
  const nearShop = useGame((s) => s.nearShop);
  useEffect(() => {
    if (!nearShop || !wave) return;
    const action = mixer.clipAction(wave);
    action.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.2).play();
    action.clampWhenFinished = false;
  }, [nearShop, wave, mixer]);

  useFrame((_, dt) => mixer.update(dt));
  return <primitive object={scene} position={[0.9, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />;
}

function Kiosk() {
  const sign = useMemo(() => makeSignTexture(1, false), []);
  const glow = useMemo(() => new THREE.Color(PALETTE.amber).multiplyScalar(3), []);
  return (
    <group>
      {/* quầy */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1, 1.1, 3]} />
        <meshStandardMaterial color="#151021" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[-0.51, 0.9, 0]}>
        <boxGeometry args={[0.02, 0.06, 3]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      {/* mái che và biển hiệu */}
      <mesh position={[0.4, 3, 0]}>
        <boxGeometry args={[2.4, 0.12, 3.6]} />
        <meshStandardMaterial color="#1d1630" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.82, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[3.6, 0.9]} />
        <meshBasicMaterial map={sign} color={[2.2, 2.2, 2.2]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {[-1.6, 1.6].map((z) => (
        <mesh key={z} position={[1.5, 1.5, z]}>
          <boxGeometry args={[0.1, 3, 0.1]} />
          <meshStandardMaterial color="#2a2536" />
        </mesh>
      ))}
      <pointLight position={[-1, 2.4, 0]} color={PALETTE.amber} intensity={30} distance={9} decay={2} />
    </group>
  );
}

export function Shop() {
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.2) return;
    last.current = clock.elapsedTime;
    const s = useGame.getState();
    const p = handles.player?.currPos;
    const near = s.mode === "foot" && !!p && Math.hypot(p.x - SHOP_POS.x, p.z - SHOP_POS.z) < SHOP_REACH;
    if (near !== s.nearShop) s.setNearShop(near);
    if (!near && s.shopOpen) s.setShopOpen(false);
  });

  return (
    <group position={SHOP_POS}>
      <Kiosk />
      <VendorBot />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 0.55, 1.5]} position={[0, 0.55, 0]} />
      </RigidBody>
    </group>
  );
}

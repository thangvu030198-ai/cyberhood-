import { useMemo } from "react";
import * as THREE from "three";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CITY, PALETTE } from "./config";
import { makeSignTexture } from "./textures";

/** Quầy chợ đen Neon Bazaar ở góc phố gần điểm xuất phát */
export const SHOP_POS = new THREE.Vector3(10.2, CITY.SIDEWALK_HEIGHT, 13);

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

/** Quầy chợ đen; người bán là NPC Vex (xem Npcs.tsx), mở hàng qua hội thoại */
export function Shop() {
  return (
    <group position={SHOP_POS}>
      <Kiosk />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 0.55, 1.5]} position={[0, 0.55, 0]} />
      </RigidBody>
    </group>
  );
}

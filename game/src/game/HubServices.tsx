// Sảnh: dựng các NPC dịch vụ (lò rèn, vòng quay, kho vũ khí, phòng thay đồ, người kể chuyện) — model Meshy
// có hoạt ảnh đứng / nhảy múa, biển neon tên dịch vụ trên đầu, vòng sáng dưới chân.

import { Suspense, use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { extraModel, type ExtraModel } from "./assets";
import { fitCharacter } from "./Player";
import { inPlace } from "./meshyAnim";
import { CITY } from "./config";
import { SERVICES, type Service } from "./services";

function signTexture(text: string, sub: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(8,4,18,0.88)";
  g.fillRect(0, 0, 512, 160);
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 144);
  g.fillStyle = color;
  g.textAlign = "center";
  g.font = "700 64px sans-serif";
  g.fillText(text, 256, 82);
  g.shadowBlur = 6;
  g.fillStyle = "#ffffff";
  g.font = "600 28px sans-serif";
  g.fillText(sub, 256, 130);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ServiceNpc({ s }: { s: Service }) {
  const base = use(extraModel(`${s.model}_walk` as ExtraModel));
  const anim = use(extraModel(`${s.model}_${s.clip}` as ExtraModel));
  const { scene, mixer } = useMemo(() => {
    const scene = cloneSkinned(base.scene);
    fitCharacter(scene, 1.8, 0);
    scene.traverse((o) => {
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
    const mixer = new THREE.AnimationMixer(scene);
    const clip = anim.animations[0] ?? base.animations[0];
    if (clip) mixer.clipAction(inPlace(clip)).play();
    return { scene, mixer };
  }, [base, anim]);
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);
  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1)));
  return <primitive object={scene} />;
}

function Station({ s }: { s: Service }) {
  const tex = useMemo(() => signTexture(s.sign, s.npc, s.color), [s]);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(clock.elapsedTime * 3) * 0.2;
  });
  const glow = useMemo(() => new THREE.Color(s.color).multiplyScalar(2.2), [s]);
  return (
    <group position={[s.x, CITY.SIDEWALK_HEIGHT, s.z]} rotation-y={s.yaw}>
      <Suspense fallback={null}>
        <ServiceNpc s={s} />
      </Suspense>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.9, 1.15, 40]} />
        <meshBasicMaterial color={glow} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      <sprite position={[0, 3, 0]} scale={[2.8, 0.88, 1]}>
        <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

export function HubServices() {
  return (
    <group>
      {SERVICES.map((s) => (
        <Station key={s.id} s={s} />
      ))}
    </group>
  );
}

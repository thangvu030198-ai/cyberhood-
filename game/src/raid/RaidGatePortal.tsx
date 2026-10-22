// Cổng Sinh Vật Cổ Đại ở khu an toàn (đại lộ phía đông): khung cổng đá cổ có gân điện, mặt cổng xoáy nước bão,
// đầu Leviathan nhô lên trên đỉnh, bảng "ANCIENT BEAST GATE · 古代獣ゲート". Đứng gần nhấn E để vào sảnh raid.
// Sau khi hạ Leviathan lần đầu: tượng đầu rắn trên bệ cạnh cổng. Thú cưng Leviathan con bay theo người chơi.

import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extraModel } from "../game/assets";
import { handles } from "../game/refs";
import { RAID_GATE } from "../game/config";
import { useGame } from "../game/store";
import { useRaid } from "./raidSession";

const VORTEX = /* glsl */ `
uniform float uTime; varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5; float r = length(p); float a = atan(p.y, p.x);
  float s = sin(a * 5.0 - r * 26.0 + uTime * 4.0) * 0.5 + 0.5;
  float bolt = smoothstep(0.96, 1.0, sin(a * 13.0 + uTime * 9.0) * 0.5 + 0.5) * step(r, 0.45);
  vec3 col = mix(vec3(0.02, 0.18, 0.3), vec3(0.3, 0.95, 1.0), s * smoothstep(0.5, 0.0, r)) + vec3(0.8, 1.0, 1.0) * bolt * 2.0;
  gl_FragColor = vec4(col * 1.6, smoothstep(0.5, 0.44, r));
}`;

function signTex() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#04121a";
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = "#36e7ff";
  g.lineWidth = 10;
  g.shadowColor = "#36e7ff";
  g.shadowBlur = 24;
  g.strokeRect(12, 12, 1000, 232);
  g.fillStyle = "#e8fbff";
  g.textAlign = "center";
  g.font = "900 92px sans-serif";
  g.fillText("ANCIENT BEAST GATE", 512, 118);
  g.shadowBlur = 0;
  g.fillStyle = "#ffd166";
  g.font = "700 50px sans-serif";
  g.fillText("古代獣ゲート · RAID 4–10", 512, 200);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function useHead(size: number) {
  const g = use(extraModel("mx_raid_all"));
  return useMemo(() => {
    const n = g.scene.getObjectByName("rd_lev_head");
    if (!n) return null;
    const o = n.clone(true);
    o.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(o);
    const s = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    o.position.sub(c);
    const w = new THREE.Group();
    w.add(o);
    w.scale.setScalar(size / Math.max(s.x, s.y, s.z));
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (m.isMesh) {
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.emissiveMap = mat.map;
        mat.emissive = new THREE.Color(1, 1, 1);
        mat.emissiveIntensity = 0.5;
        m.material = mat;
      }
    });
    return w;
  }, [g, size]);
}

function GateHead() {
  const head = useHead(6);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 10.5 + Math.sin(clock.elapsedTime * 1.2) * 0.25;
  });
  return head ? (
    <group ref={ref} position={[0, 10.5, -0.5]}>
      <primitive object={head} />
    </group>
  ) : null;
}

/** Tượng sau lần hạ đầu tiên: đầu Leviathan trên bệ đá vàng, bảng tên người hạ */
function Statue() {
  const first = useRaid((s) => s.firstKill.leviathan);
  const head = useHead(4);
  if (!first || !head) return null;
  return (
    <group position={[0, 0, 9]}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[1.8, 2.2, 1.8, 8]} />
        <meshStandardMaterial color="#3a3326" metalness={0.6} roughness={0.4} emissive="#ffb000" emissiveIntensity={0.15} />
      </mesh>
      <group position={[0, 3.6, 0]} rotation-y={Math.PI / 2}>
        <primitive object={head} />
      </group>
      <pointLight position={[0, 5, 2]} color="#ffd166" intensity={14} distance={10} />
    </group>
  );
}

/** Thú cưng Leviathan con: bay vòng quanh vai người chơi ở khu an toàn */
function Pet() {
  const has = useRaid((s) => s.pet);
  const head = useHead(0.9);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const o = ref.current;
    const p = handles.player?.currPos;
    if (!o || !p) return;
    const t = clock.elapsedTime;
    const g = useGame.getState();
    o.visible = g.location === "city";
    const tx = p.x + Math.cos(t * 0.9) * 1.4;
    const tz = p.z + Math.sin(t * 0.9) * 1.4;
    o.position.x += (tx - o.position.x) * 0.08;
    o.position.z += (tz - o.position.z) * 0.08;
    o.position.y = p.y + 1.8 + Math.sin(t * 2.4) * 0.15;
    o.rotation.y = -t * 0.9;
  });
  if (!has || !head) return null;
  return (
    <group ref={ref}>
      <primitive object={head} />
      <pointLight color="#5fe9ff" intensity={4} distance={4} />
    </group>
  );
}

export function RaidGatePortal() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }", fragmentShader: VORTEX, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), []);
  const sign = useMemo(signTex, []);
  useFrame(({ clock }) => (mat.uniforms.uTime.value = clock.elapsedTime));
  return (
    <>
      <group position={[RAID_GATE.x, 0, RAID_GATE.z]} rotation-y={-Math.PI / 2}>
        {/* Hai trụ đá cổ có gân điện */}
        {[-5, 5].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 4.5, 0]}>
              <boxGeometry args={[1.8, 9, 1.8]} />
              <meshStandardMaterial color="#1d2a2e" roughness={0.85} emissive="#36e7ff" emissiveIntensity={0.08} />
            </mesh>
            <mesh position={[0, 4.5, 0.92]}>
              <boxGeometry args={[0.18, 8.4, 0.05]} />
              <meshBasicMaterial color={[0.4, 2.6, 3.2]} toneMapped={false} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 9.3, 0]}>
          <boxGeometry args={[12, 1.2, 2]} />
          <meshStandardMaterial color="#1d2a2e" roughness={0.85} />
        </mesh>
        <mesh position={[0, 4.6, 0]} material={mat}>
          <planeGeometry args={[8.2, 8.4]} />
        </mesh>
        <mesh position={[0, 7.2, 1.05]}>
          <planeGeometry args={[7.6, 1.9]} />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 5, 3]} color="#36e7ff" intensity={30} distance={18} decay={1.5} />
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 2]}>
          <circleGeometry args={[5, 40]} />
          <meshStandardMaterial color="#0b2a33" emissive="#1f8fb0" emissiveIntensity={0.5} roughness={0.15} transparent opacity={0.85} />
        </mesh>
        <Suspense fallback={null}>
          <GateHead />
          <Statue />
        </Suspense>
      </group>
      <Suspense fallback={null}>
        <Pet />
      </Suspense>
    </>
  );
}

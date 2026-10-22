// Cổng Công Thành ở khu an toàn: hai tháp băng nhỏ, vòng cổng băng xanh, mặt cổng xoáy tuyết, bảng neon
// "CÔNG THÀNH · THÀNH BĂNG IXO", tuyết bay lơ lửng quanh cổng. Đứng gần nhấn E để vào sảnh chờ.

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useFitted } from "../game/Showcase";
import { SIEGE_GATE } from "../game/config";

const SWIRL_FRAG = /* glsl */ `
uniform float uTime; varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  float s = sin(a * 6.0 + r * 22.0 - uTime * 3.0) * 0.5 + 0.5;
  float core = smoothstep(0.5, 0.0, r);
  vec3 col = mix(vec3(0.2, 0.6, 1.0), vec3(0.9, 0.98, 1.0), s * core) * (0.6 + core * 1.8);
  float alpha = smoothstep(0.5, 0.42, r) * (0.55 + s * 0.35);
  gl_FragColor = vec4(col, alpha);
}`;

function signTexture() {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#06121f";
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = "#7ff3ff";
  g.lineWidth = 10;
  g.shadowColor = "#7ff3ff";
  g.shadowBlur = 24;
  g.strokeRect(12, 12, 1000, 232);
  g.fillStyle = "#e8fbff";
  g.font = "900 108px sans-serif";
  g.textAlign = "center";
  g.fillText("CÔNG THÀNH", 512, 128);
  g.shadowBlur = 0;
  g.fillStyle = "#ff7ae0";
  g.font = "700 46px sans-serif";
  g.fillText("ĐẠI CHIẾN THÀNH BĂNG IXO · 100 vs 100", 512, 200);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Towers() {
  const { root } = useFitted("mx_sg_tower", 9, "height", 0.35);
  const b = useMemo(() => root.clone(true), [root]);
  return (
    <>
      <primitive object={root} position={[-5.4, 0, 0]} />
      <primitive object={b} position={[5.4, 0, 0]} rotation-y={Math.PI} />
    </>
  );
}

export function SiegeGatePortal() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }", fragmentShader: SWIRL_FRAG, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide }), []);
  const sign = useMemo(signTexture, []);
  const flakes = useRef<THREE.Points>(null);
  const flakeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 260;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([(Math.random() - 0.5) * 12, Math.random() * 10, (Math.random() - 0.5) * 5], i * 3);
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame(({ clock }, dt) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    const a = flakeGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      a[i + 1] -= dt * 0.8;
      a[i] += Math.sin(clock.elapsedTime + i) * dt * 0.3;
      if (a[i + 1] < 0) a[i + 1] += 10;
    }
    flakeGeo.attributes.position.needsUpdate = true;
  });
  return (
    <group position={[SIEGE_GATE.x, 0, SIEGE_GATE.z]} rotation-y={Math.PI}>
      <Suspense fallback={null}>
        <Towers />
      </Suspense>
      {/* Vòng cổng băng */}
      <mesh position={[0, 4.6, 0]}>
        <torusGeometry args={[3.4, 0.35, 12, 48]} />
        <meshStandardMaterial color="#bfefff" emissive="#4fd8ff" emissiveIntensity={1.4} roughness={0.15} metalness={0.3} />
      </mesh>
      <mesh position={[0, 4.6, 0]} material={mat}>
        <circleGeometry args={[3.3, 48]} />
      </mesh>
      <mesh position={[0, 9.4, 0.2]}>
        <planeGeometry args={[8, 2]} />
        <meshBasicMaterial map={sign} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <points ref={flakes} geometry={flakeGeo}>
        <pointsMaterial color="#ffffff" size={0.12} transparent opacity={0.9} depthWrite={false} />
      </points>
      <pointLight position={[0, 4.5, 2]} color="#7fe8ff" intensity={30} distance={16} decay={1.5} />
      {/* Nền băng trước cổng */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <circleGeometry args={[5.5, 40]} />
        <meshStandardMaterial color="#cfeeff" emissive="#2a8fc0" emissiveIntensity={0.5} roughness={0.2} metalness={0.2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PALETTE, mulberry32 } from "./config";
import { useGame } from "./store";

/** Bầu trời: dải màu tím-đen, phía chân trời ửng hồng như ánh đèn thành phố hắt lên mây. */
export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color("#04020a") },
          mid: { value: new THREE.Color("#1a0a2e") },
          horizon: { value: new THREE.Color("#5a1446") },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
            c = mix(c, top, smoothstep(0.18, 0.7, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[900, 32, 16]} />
    </mesh>
  );
}

/** Mưa: các vệt ngắn rơi quanh camera, tái sử dụng khi rơi chạm đất. */
export function Rain({ count = 3500, radius = 40 }) {
  const ref = useRef<THREE.LineSegments>(null);
  const { positions, speeds } = useMemo(() => {
    const rand = mulberry32(5);
    const positions = new Float32Array(count * 6);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * radius * 2;
      const y = rand() * 30;
      const z = (rand() - 0.5) * radius * 2;
      positions.set([x, y, z, x + 0.02, y + 0.45, z], i * 6);
      speeds[i] = 18 + rand() * 10;
    }
    return { positions, speeds };
  }, [count, radius]);

  useFrame(({ camera }, dt) => {
    const lines = ref.current;
    if (!lines) return;
    lines.visible = useGame.getState().location === "city";
    if (!lines.visible) return;
    const step = Math.min(dt, 0.05);
    const attr = lines.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      const dy = speeds[i] * step;
      arr[o + 1] -= dy;
      arr[o + 4] -= dy;
      if (arr[o + 1] < 0) {
        arr[o + 1] += 30;
        arr[o + 4] += 30;
      }
    }
    attr.needsUpdate = true;
    // Mưa luôn bao quanh camera
    lines.position.set(camera.position.x, 0, camera.position.z);
  });

  return (
    <lineSegments ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#8fa8ff" transparent opacity={0.35} />
    </lineSegments>
  );
}

export function Lights() {
  return (
    <>
      <hemisphereLight args={["#6b4cff", "#1a0b1e", 0.6]} />
      <directionalLight position={[-60, 120, -40]} intensity={0.35} color="#9fb6ff" />
      {/* Vài đèn màu quanh ngã tư xuất phát để mặt đường ướt có phản chiếu */}
      <pointLight position={[8, 6, 8]} color={PALETTE.pink} intensity={120} distance={40} decay={2} />
      <pointLight position={[-8, 6, -8]} color={PALETTE.cyan} intensity={120} distance={40} decay={2} />
      <pointLight position={[-10, 8, 12]} color={PALETTE.purple} intensity={90} distance={40} decay={2} />
      <fogExp2 attach="fog" args={[PALETTE.fog, 0.012]} />
    </>
  );
}

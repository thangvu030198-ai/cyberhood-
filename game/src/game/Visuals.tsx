import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { BUILDINGS } from "./City";
import { CITY, CITY_PITCH, PALETTE, mulberry32 } from "./config";
import { makeAdTexture } from "./textures";
import { useGame } from "./store";

// Lớp hình ảnh trang trí: môi trường phản chiếu neon, biển quảng cáo hologram, máy bán hàng, hơi nước.

/** Môi trường phản chiếu dựng từ các tấm sáng neon, render một lần, không tải HDRI ngoài */
export function NeonEnvironment() {
  const quality = useGame((s) => s.quality);
  if (quality !== "high") return null;
  return (
    <Environment resolution={256} frames={1} background={false}>
      <color attach="background" args={["#06030d"]} />
      <Lightformer form="rect" intensity={3} color={PALETTE.pink} position={[-8, 4, -6]} scale={[14, 1.2, 1]} />
      <Lightformer form="rect" intensity={3} color={PALETTE.cyan} position={[8, 3, 6]} scale={[14, 1.2, 1]} />
      <Lightformer form="rect" intensity={2} color={PALETTE.purple} position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
      <Lightformer form="ring" intensity={4} color={PALETTE.amber} position={[10, 6, -10]} scale={3} />
      <Lightformer form="rect" intensity={1.5} color="#1a0b2e" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[40, 40, 1]} />
    </Environment>
  );
}

const AD_COPY: [string, string, string][] = [
  ["OMNI-DYNE", "WE OWN TOMORROW", PALETTE.cyan],
  ["GHOST_0", "LIVES", "#39ff88"],
  ["SYNTH NOODLE", "24H · 3 CRED", PALETTE.amber],
  ["NEURAL+", "OVERCLOCK −30%", PALETTE.pink],
  ["HOLO·YOU", "BE ANYONE", PALETTE.purple],
  ["ROOT ACCESS?", "JACK IN", "#ff1f3d"],
];

const holoVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const holoFragment = /* glsl */ `
  uniform sampler2D map;
  uniform float time;
  uniform float seed;
  varying vec2 vUv;
  float rand(float x) { return fract(sin(x * 91.17 + seed) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // Nhiễu ngang thỉnh thoảng như tín hiệu bị chập
    float band = step(0.97, rand(floor(time * 6.0))) * step(abs(uv.y - rand(floor(time * 6.0) + 3.0)), 0.06);
    uv.x += band * 0.04;
    vec3 col = texture2D(map, uv).rgb;
    float r = texture2D(map, uv + vec2(0.004, 0.0)).r;
    col.r = max(col.r, r * 0.8);
    float scan = 0.75 + 0.25 * sin(uv.y * 420.0 + time * 8.0);
    float flicker = 0.88 + 0.12 * step(0.5, rand(floor(time * 18.0)));
    float edge = smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x);
    gl_FragColor = vec4(col * scan * flicker * edge * 2.2, 1.0);
  }`;

/** Biển quảng cáo hologram lớn gắn trên mặt tiền các toà cao nhất */
export function HoloAds() {
  const ads = useMemo(() => {
    const tall = [...BUILDINGS].filter((b) => b.h > 45).sort((a, b) => b.h - a.h).slice(0, 10);
    return tall.map((b, i) => {
      const [title, sub, color] = AD_COPY[i % AD_COPY.length];
      const material = new THREE.ShaderMaterial({
        uniforms: { map: { value: makeAdTexture(title, sub, color) }, time: { value: 0 }, seed: { value: i * 7.3 } },
        vertexShader: holoVertex,
        fragmentShader: holoFragment,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      // Gắn lên mặt hướng ra đường của toà nhà
      const [nx, nz] = b.face;
      const w = 9;
      const h = 13;
      const y = Math.min(b.h - h / 2 - 2, b.h * 0.62);
      const x = nx !== 0 ? b.x + nx * (b.w / 2 + 0.8) : b.x;
      const z = nz !== 0 ? b.z + nz * (b.d / 2 + 0.8) : b.z;
      const rotY = nx !== 0 ? (nx > 0 ? Math.PI / 2 : -Math.PI / 2) : nz > 0 ? 0 : Math.PI;
      return { material, pos: [x, y, z] as [number, number, number], rotY, w, h };
    });
  }, []);

  useFrame(({ clock }) => {
    for (const a of ads) a.material.uniforms.time.value = clock.elapsedTime;
  });

  return (
    <>
      {ads.map((a, i) => (
        <mesh key={i} position={a.pos} rotation={[0, a.rotY, 0]} material={a.material}>
          <planeGeometry args={[a.w, a.h]} />
        </mesh>
      ))}
    </>
  );
}

/** Hơi nước bốc lên từ nắp cống giữa đường */
export function SteamVents() {
  const PER = 18;
  const vents = useMemo(() => {
    const rand = mulberry32(55);
    const streets = Array.from({ length: CITY.GRID + 1 }, (_, i) => (i - CITY.GRID / 2) * CITY_PITCH);
    return Array.from({ length: 14 }, () => {
      const s = streets[Math.floor(rand() * streets.length)];
      const along = (rand() - 0.5) * CITY_PITCH * CITY.GRID * 0.9;
      const lane = (rand() < 0.5 ? -1 : 1) * 3.5;
      return rand() < 0.5 ? new THREE.Vector3(s + lane, 0, along) : new THREE.Vector3(along, 0, s + lane);
    });
  }, []);
  const { geometry, offsets } = useMemo(() => {
    const rand = mulberry32(56);
    const pos = new Float32Array(vents.length * PER * 3);
    const offsets = new Float32Array(vents.length * PER);
    for (let i = 0; i < vents.length * PER; i++) offsets[i] = rand();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geometry: g, offsets };
  }, [vents]);
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame(({ clock }) => {
    const attr = geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = clock.elapsedTime;
    vents.forEach((v, vi) => {
      for (let k = 0; k < PER; k++) {
        const i = vi * PER + k;
        const life = (t * 0.35 + offsets[i]) % 1;
        arr[i * 3] = v.x + Math.sin(offsets[i] * 40 + t) * 0.4 * life;
        arr[i * 3 + 1] = 0.2 + life * 4.5;
        arr[i * 3 + 2] = v.z + Math.cos(offsets[i] * 30 + t) * 0.4 * life;
      }
    });
    attr.needsUpdate = true;
  });

  return (
    <>
      <points geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          map={texture}
          size={2.4}
          color="#b9a8ff"
          transparent
          opacity={0.32}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      {vents.map((v, i) => (
        <mesh key={i} position={[v.x, 0.02, v.z]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.7, 16]} />
          <meshStandardMaterial color="#0c0a12" metalness={0.9} roughness={0.4} />
        </mesh>
      ))}
    </>
  );
}

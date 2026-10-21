// Hollow Hotel: hang đá gothic nuốt trọn khách sạn cổ. Vách hang chạm khắc vòm nhọn (canvas), một cửa hang lớn
// nhìn ra thành phố lúc hoàng hôn, trụ gothic khổng lồ, nhũ đá, đèn chùm treo trên và dưới vực, dây cáp võng,
// giấy sách bay lơ lửng, đèn nến ấm. Toàn bộ chỉ để trang trí.

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { canvasPair } from "./cityBlocks";
import { useFitted } from "../game/Showcase";
import type { ExtraModel } from "../game/assets";
import type { PlatformerSim } from "./platformer";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Vách đá chạm khắc: khối đá, vòm cửa sổ nhọn, cột, hoa văn xoắn, đèn nến hắt sáng */
function gothicTexture(seed: number) {
  const r = rng(seed);
  return canvasPair(512, 512, (g, e) => {
    g.fillStyle = "#3a302c";
    g.fillRect(0, 0, 512, 512);
    // Khối đá xây
    for (let y = 0; y < 512; y += 32)
      for (let x = (y / 32) % 2 ? -24 : 0; x < 512; x += 48) {
        g.fillStyle = `rgb(${50 + r() * 22},${42 + r() * 18},${38 + r() * 16})`;
        g.fillRect(x + 2, y + 2, 44, 28);
      }
    // Vòm cửa sổ nhọn với kính tối, một số sáng ấm
    for (let x = 40; x < 512; x += 156) {
      const w = 90;
      const top = 70 + r() * 30;
      g.fillStyle = "#1a1412";
      g.beginPath();
      g.moveTo(x, 420);
      g.lineTo(x, top + 60);
      g.quadraticCurveTo(x, top, x + w / 2, top - 20);
      g.quadraticCurveTo(x + w, top, x + w, top + 60);
      g.lineTo(x + w, 420);
      g.fill();
      const lit = r() < 0.5;
      for (const ctx of lit ? [g, e] : [g]) {
        ctx.fillStyle = lit ? "rgba(255,170,90,0.55)" : "#221a18";
        ctx.fillRect(x + 12, top + 40, w - 24, 360 - top);
      }
      g.strokeStyle = "#6a5a50";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x + w / 2, top - 10);
      g.lineTo(x + w / 2, 420);
      g.stroke();
      // Cột chạm hai bên
      g.fillStyle = "#4e423c";
      g.fillRect(x - 18, 40, 14, 470);
      g.fillRect(x + w + 4, 40, 14, 470);
      g.strokeStyle = "#2a2220";
      g.lineWidth = 2;
      for (let y = 50; y < 500; y += 22) {
        g.beginPath();
        g.arc(x - 11, y, 6, 0, Math.PI);
        g.stroke();
      }
    }
    // Đèn nến trên vách
    for (let i = 0; i < 5; i++) {
      const x = r() * 500;
      const y = 200 + r() * 200;
      for (const ctx of [g, e]) {
        const gr = ctx.createRadialGradient(x, y, 1, x, y, 26);
        gr.addColorStop(0, "rgba(255,200,120,1)");
        gr.addColorStop(1, "rgba(255,140,60,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(x - 26, y - 26, 52, 52);
      }
    }
    // Rêu, ố, nứt
    for (let i = 0; i < 160; i++) {
      g.fillStyle = r() < 0.3 ? `rgba(60,90,60,${0.1 + r() * 0.15})` : `rgba(0,0,0,${0.08 + r() * 0.15})`;
      g.fillRect(r() * 512, r() * 512, 3 + r() * 20, 3 + r() * 30);
    }
  });
}

function Fit({ name, height, position, rotY = 0, selfLit = 0.45 }: { name: ExtraModel; height: number; position: [number, number, number]; rotY?: number; selfLit?: number }) {
  const { root } = useFitted(name, height, "height", selfLit);
  const obj = useMemo(() => root.clone(true), [root]);
  return <primitive object={obj} position={position} rotation-y={rotY} />;
}

/** Giấy sách bay lơ lửng trong hang */
function Pages({ width }: { width: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 80;
  const seeds = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: N }, () => [r() * width, r() * 22 - 4, -1 - r() * 10, r() * 6.28, 0.3 + r() * 0.6]);
  }, [width]);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    seeds.forEach(([x, y, z, ph, sp], i) => {
      const yy = ((y - t * sp * 0.6 + 30) % 30) - 6;
      e.set(Math.sin(t * sp + ph) * 1.2, t * sp + ph, Math.cos(t + ph) * 0.8);
      q.setFromEuler(e);
      mat.compose(new THREE.Vector3(x + Math.sin(t * 0.5 + ph) * 1.5, yy, z), q, new THREE.Vector3(1, 1, 1));
      m.setMatrixAt(i, mat);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <planeGeometry args={[0.22, 0.3]} />
      <meshStandardMaterial color="#e8dcc0" emissive="#5a4a30" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

export function CaveScenery({ sim }: { sim: PlatformerSim }) {
  const W = sim.width;
  const data = useMemo(() => {
    const r = rng(W * 13);
    const tex = gothicTexture(W);
    const wallMat = (ru: number, rv: number) => {
      const m = tex.map.clone();
      const g = tex.glow.clone();
      for (const t of [m, g]) {
        t.repeat.set(ru, rv);
        t.needsUpdate = true;
      }
      return new THREE.MeshStandardMaterial({ map: m, emissiveMap: g, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.3, roughness: 0.95 });
    };
    // Cửa hang lớn ở khoảng giữa map: vách chỉ có phần dưới và phần trên
    const open: [number, number] = [W * 0.42, W * 0.62];
    const walls: { x: number; y: number; w: number; h: number }[] = [];
    for (let x = -30; x < W + 30; x += 24) {
      const cx = x + 12;
      if (cx > open[0] && cx < open[1]) {
        walls.push({ x: cx, y: -14, w: 24, h: 18 });
        walls.push({ x: cx, y: 36, w: 24, h: 16 });
      } else walls.push({ x: cx, y: 8, w: 24, h: 62 });
    }
    const stalactites = Array.from({ length: Math.floor(W / 3) }, () => ({ x: r() * (W + 40) - 20, z: -1 - r() * 14, h: 1.5 + r() * 5, r: 0.3 + r() * 0.7 }));
    const pillars: number[] = [];
    for (let x = 14; x < W; x += 26 + r() * 8) pillars.push(x);
    const chandeliers: [number, number, number][] = [];
    for (let x = 8; x < W; x += 14 + r() * 8) chandeliers.push([x, 15 + r() * 5, -3 - r() * 6]);
    for (let x = 20; x < W; x += 24 + r() * 10) chandeliers.push([x, -3 - r() * 8, -2 - r() * 8]);
    const lights: number[] = [];
    for (let x = 10; x < W; x += 40) lights.push(x);
    return { wallMat, walls, stalactites, pillars, chandeliers, lights, open };
  }, [W]);
  const mats = useMemo(() => data.walls.map((w) => data.wallMat(w.w / 12, w.h / 12)), [data]);
  const ceilMat = useMemo(() => data.wallMat((W + 60) / 16, 2), [data, W]);
  const pillarMat = useMemo(() => data.wallMat(1, 4), [data]);
  return (
    <group>
      {/* Vách hang có cửa nhìn ra thành phố */}
      {data.walls.map((w, i) => (
        <mesh key={i} position={[w.x, w.y, -16]} material={mats[i]}>
          <planeGeometry args={[w.w, w.h]} />
        </mesh>
      ))}
      {/* Trần hang */}
      <mesh position={[W / 2, 25, -6]} rotation-x={Math.PI / 2} material={ceilMat}>
        <planeGeometry args={[W + 60, 22]} />
      </mesh>
      {/* Nhũ đá */}
      {data.stalactites.map((s, i) => (
        <mesh key={`t${i}`} position={[s.x, 25 - s.h / 2, s.z]} rotation-x={Math.PI}>
          <coneGeometry args={[s.r, s.h, 6]} />
          <meshStandardMaterial color="#4a3c34" roughness={1} />
        </mesh>
      ))}
      {/* Đáy vực tối có ánh lửa */}
      <mesh position={[W / 2, -24, -6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W + 60, 30]} />
        <meshStandardMaterial color="#1a100c" emissive="#3a1a08" emissiveIntensity={0.6} roughness={1} />
      </mesh>
      {/* Trụ gothic khổng lồ */}
      {/* Cột đá chạm khắc đỡ trần hang, đứng lùi sau làn chơi */}
      {data.pillars.map((x, i) => (
        <group key={`p${i}`} position={[x, 1, -12.5]}>
          <mesh material={pillarMat}>
            <cylinderGeometry args={[1.3, 1.6, 50, 10]} />
          </mesh>
          <mesh position={[0, 22, 0]} material={pillarMat}>
            <cylinderGeometry args={[2.4, 1.3, 3, 10]} />
          </mesh>
        </group>
      ))}
      {data.chandeliers.map((p, i) => (
        <Suspense key={`c${i}`} fallback={null}>
          <Fit name="mx_hh_chandelier" height={2.6} position={p} selfLit={0.8} />
        </Suspense>
      ))}
      {data.lights.map((x) => (
        <pointLight key={x} position={[x, 13, 1]} intensity={30} distance={26} decay={1.4} color="#ffb070" />
      ))}
      <Pages width={W} />
    </group>
  );
}

// Thiên nhiên chiếm lại phố ngập: đảo bùn phủ cỏ (cỏ đung đưa theo gió bằng shader), cây thủ tục (thân thon có vân vỏ,
// tán nhiều khối lá lồi lõm), vườn trên mái (cây + chậu), dây leo rủ trên cao ốc, cây chết nửa chìm (model Meshy),
// cây hologram trên vài mái, mảng rong / bèo nổi trên mặt nước. Tất cả vẽ instanced / gộp lưới.

import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { useFitted } from "../game/Showcase";
import type { ExtraModel } from "../game/assets";
import { RAID } from "./raidSim";

const rngOf = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/** Đảo bùn: thấp, mép thoai thoải, nằm NGOÀI lối rắn bơi (|x| < 44, −40 < z < 24) để thân rắn không xuyên qua */
export const ISLANDS = [
  { x: -68, z: 44, r: 6 },
  { x: 66, z: -22, r: 6 },
  { x: -22, z: -62, r: 6 },
  { x: 62, z: -62, r: 5.5 },
  { x: -66, z: -62, r: 6 },
  { x: -40, z: 64, r: 5 },
];
/** Điểm (x, z) có nằm trong lối rắn bơi không */
export const inSerpentPath = (x: number, z: number) => Math.abs(x) < 46 && z > -42 && z < 26;

function leafTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1f4a2a";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    g.fillStyle = ["#2f6b36", "#3f8a3f", "#1a3d24", "#56a24a", "#2a5a3a"][i % 5];
    g.beginPath();
    g.ellipse(x, y, 3 + Math.random() * 4, 1.5 + Math.random() * 2, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function barkTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3a2a1e";
  g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = i % 2 ? "#24180f" : "#4e3a28";
    g.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * 64;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 6, 40, x - 6, 80, x + 3, 128);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Một cây thủ tục: thân thon + 2 cành, tán 5–7 khối lá biến dạng nhiễu */
function treeGeometry(seed: number) {
  const r = rngOf(seed);
  const trunk: THREE.BufferGeometry[] = [];
  const crown: THREE.BufferGeometry[] = [];
  const h = 3.4 + r() * 2;
  const t = new THREE.CylinderGeometry(0.14, 0.32, h, 9, 4);
  // uốn nhẹ thân
  const p = t.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / h + 0.5;
    p.setX(i, p.getX(i) + Math.sin(y * 2.4 + seed) * 0.25 * y);
  }
  t.translate(0, h / 2, 0);
  trunk.push(t);
  for (let k = 0; k < 2; k++) {
    const b = new THREE.CylinderGeometry(0.06, 0.13, 1.8, 6);
    b.translate(0, 0.9, 0);
    b.rotateZ((k ? 1 : -1) * (0.6 + r() * 0.3));
    b.rotateY(r() * Math.PI * 2);
    b.translate(0, h * (0.55 + r() * 0.2), 0);
    trunk.push(b);
  }
  const n = 5 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const s = 1.1 + r() * 0.9;
    const g = new THREE.IcosahedronGeometry(s, 2);
    const q = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < q.count; i++) {
      const v = new THREE.Vector3(q.getX(i), q.getY(i), q.getZ(i));
      const f = 1 + (Math.sin(v.x * 3.1 + seed) * Math.cos(v.z * 2.7 + k) * 0.18 + (r() - 0.5) * 0.08);
      v.multiplyScalar(f);
      q.setXYZ(i, v.x, v.y * 0.8, v.z);
    }
    g.computeVertexNormals();
    const a = r() * Math.PI * 2;
    const rr = k === 0 ? 0 : 0.9 + r() * 0.6;
    g.translate(Math.cos(a) * rr, h + (k === 0 ? 0.6 : r() * 1.2 - 0.2), Math.sin(a) * rr);
    crown.push(g);
  }
  return { trunk: mergeGeometries(trunk.map((g) => g.toNonIndexed()))!, crown: mergeGeometries(crown.map((g) => g.toNonIndexed()))! };
}

/** Cỏ: lá mảnh, gió lay bằng shader (đỉnh lá lắc theo thời gian + vị trí) */
function useGrassMaterial() {
  return useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#3c8a3a", roughness: 0.9, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 };
      m.userData.shader = sh;
      sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uTime * 1.8 + wp.x * 0.35 + wp.z * 0.27) * 0.25 + sin(uTime * 3.7 + wp.x) * 0.06;
        transformed.x += sway * position.y * position.y;
        transformed.z += sway * 0.5 * position.y * position.y;`,
      );
    };
    return m;
  }, []);
}

function grassBlade() {
  const g = new THREE.PlaneGeometry(0.08, 0.7, 1, 3);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 0.35;
    p.setX(i, p.getX(i) * (1 - y / 0.7));
    p.setY(i, y);
  }
  return g;
}

function Islands() {
  const grassMat = useGrassMaterial();
  const blade = useMemo(grassBlade, []);
  const mud = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#3a3122";
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = ["#2c2418", "#4a3e2a", "#3f4a26", "#556b2f"][i % 4];
      g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const grass = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const r = rngOf(9);
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (const I of ISLANDS)
      for (let k = 0; k < 520; k++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * I.r * 0.92;
        const s = 0.7 + r() * 0.9;
        out.push(new THREE.Matrix4().compose(new THREE.Vector3(I.x + Math.cos(a) * d, 0.62 - (d / I.r) * 0.25, I.z + Math.sin(a) * d), q.setFromEuler(e.set((r() - 0.5) * 0.3, r() * Math.PI, 0)), new THREE.Vector3(s, s, s)));
      }
    return out;
  }, []);
  useFrame(({ clock }) => {
    const sh = grassMat.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
    if (sh) sh.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <>
      {ISLANDS.map((I, i) => (
        <mesh key={i} position={[I.x, 0.15, I.z]}>
          <cylinderGeometry args={[I.r, I.r + 1.6, 0.9, 40, 1]} />
          <meshStandardMaterial map={mud} color="#8a8a70" roughness={1} />
        </mesh>
      ))}
      <instancedMesh
        args={[blade, grassMat, grass.length]}
        frustumCulled={false}
        ref={(o) => {
          if (o && !o.userData.done) {
            grass.forEach((m, i) => o.setMatrixAt(i, m));
            o.instanceMatrix.needsUpdate = true;
            o.userData.done = true;
          }
        }}
      />
      <RigidBody type="fixed" colliders={false}>
        {ISLANDS.map((I, i) => (
          <CylinderCollider key={i} args={[0.3, I.r]} position={[I.x, 0.3, I.z]} />
        ))}
      </RigidBody>
    </>
  );
}

/** Cây trên đảo và vườn trên mái (instanced theo 3 kiểu cây) */
function Trees() {
  const kinds = useMemo(() => [11, 23, 37].map(treeGeometry), []);
  const leaf = useMemo(leafTexture, []);
  const bark = useMemo(barkTexture, []);
  const spots = useMemo(() => {
    const r = rngOf(31);
    const out: { x: number; y: number; z: number; s: number; ry: number; k: number }[] = [];
    for (const I of ISLANDS) for (let k = 0; k < 4; k++) {
      const a = r() * Math.PI * 2;
      const d = r() * I.r * 0.6;
      out.push({ x: I.x + Math.cos(a) * d, y: 0.55, z: I.z + Math.sin(a) * d, s: 0.9 + r() * 0.6, ry: r() * 6, k: k % 3 });
    }
    // Vườn trên mái không có cột thu lôi
    RAID.roofs.forEach((R, i) => {
      if (R.rod) return;
      for (let k = 0; k < 2; k++) out.push({ x: R.x + (k ? -1 : 1) * (R.half - 1.6), y: R.h, z: R.z + (i % 2 ? 1 : -1) * (R.half - 1.8), s: 0.6 + r() * 0.3, ry: r() * 6, k: (i + k) % 3 });
    });
    return out;
  }, []);
  return (
    <>
      {kinds.map((g, k) => {
        const list = spots.filter((s) => s.k === k);
        const set = (o: THREE.InstancedMesh | null) => {
          if (!o || o.userData.done) return;
          const m = new THREE.Matrix4();
          list.forEach((s, i) => o.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.ry), new THREE.Vector3(s.s, s.s, s.s))));
          o.instanceMatrix.needsUpdate = true;
          o.userData.done = true;
        };
        return (
          <group key={k}>
            <instancedMesh ref={set} args={[g.trunk, undefined, list.length]} frustumCulled={false}>
              <meshStandardMaterial map={bark} roughness={0.95} />
            </instancedMesh>
            <instancedMesh ref={set} args={[g.crown, undefined, list.length]} frustumCulled={false}>
              <meshStandardMaterial map={leaf} color="#9ad08a" roughness={0.85} emissive="#0a2a12" emissiveIntensity={0.4} />
            </instancedMesh>
          </group>
        );
      })}
    </>
  );
}

/** Dây leo rủ trên mặt cao ốc: dải lá hẹp dài, đung đưa */
function Vines() {
  const data = useMemo(() => {
    const r = rngOf(55);
    const geos: THREE.BufferGeometry[] = [];
    RAID.towers.forEach((T, i) => {
      const w = T.r * 1.7;
      for (let k = 0; k < 14; k++) {
        const face = Math.floor(r() * 4) * (Math.PI / 2) + i * 0.7;
        const along = (r() - 0.5) * w * 0.9;
        const len = 6 + r() * 14;
        const top = 8 + r() * (T.h * 0.5);
        const g = new THREE.PlaneGeometry(0.7 + r() * 0.6, len, 1, 6);
        const p = g.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j < p.count; j++) p.setZ(j, Math.sin(p.getY(j) * 0.6 + k) * 0.25);
        g.translate(0, -len / 2, 0.05);
        g.rotateY(face);
        const d = w / 2 + 0.08;
        g.translate(T.x + Math.sin(face) * d + Math.cos(face) * along, top, T.z + Math.cos(face) * d - Math.sin(face) * along);
        geos.push(g.toNonIndexed());
      }
    });
    return mergeGeometries(geos)!;
  }, []);
  const leaf = useMemo(leafTexture, []);
  return (
    <mesh geometry={data}>
      <meshStandardMaterial map={leaf} color="#7fbf6a" side={THREE.DoubleSide} roughness={0.9} emissive="#0a2010" emissiveIntensity={0.5} />
    </mesh>
  );
}

/** Rong / bèo nổi: mảng xanh trên mặt nước gần đảo và chân toà nhà */
function Algae() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d")!;
    for (let i = 0; i < 90; i++) {
      g.fillStyle = ["rgba(70,140,60,0.9)", "rgba(40,100,50,0.85)", "rgba(110,170,70,0.8)"][i % 3];
      g.beginPath();
      g.arc(64 + (Math.random() - 0.5) * 100, 64 + (Math.random() - 0.5) * 100, 3 + Math.random() * 7, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const list = useMemo(() => {
    const r = rngOf(77);
    const out: [number, number, number, number][] = [];
    for (const I of ISLANDS) for (let k = 0; k < 4; k++) out.push([I.x + (r() - 0.5) * I.r * 3, I.z + (r() - 0.5) * I.r * 3, 3 + r() * 4, r() * 6]);
    for (const T of RAID.towers) for (let k = 0; k < 3; k++) out.push([T.x + (r() - 0.5) * 22, T.z + (r() - 0.5) * 22, 2.5 + r() * 3, r() * 6]);
    return out;
  }, []);
  return (
    <>
      {list.map(([x, z, s, ry], i) => (
        <mesh key={i} position={[x, 0.43, z]} rotation={[-Math.PI / 2, 0, ry]}>
          <planeGeometry args={[s, s]} />
          <meshStandardMaterial map={tex} transparent depthWrite={false} roughness={0.8} />
        </mesh>
      ))}
    </>
  );
}

/** Cây chết nửa chìm (model Meshy) + cây hologram trên vài mái */
function ModelTrees() {
  const dead = useFitted("mx_pr_dead_tree" as ExtraModel, 7, "height", 0.3);
  const holo = useFitted("holotree" as ExtraModel, 3.4, "height", 0.6);
  const objs = useMemo(() => {
    const out: THREE.Object3D[] = [];
    const r = rngOf(91);
    const spots: [number, number][] = [
      [-30, -56],
      [50, -12],
      [-58, 4],
      [30, -62],
      [-18, 62],
      [58, 52],
      [70, 8],
      [-72, -26],
    ];
    for (const [x, z] of spots) {
      const o = dead.root.clone(true);
      o.position.set(x, -1.2, z);
      o.rotation.set((r() - 0.5) * 0.25, r() * 6, (r() - 0.5) * 0.25);
      o.scale.multiplyScalar(0.8 + r() * 0.5);
      out.push(o);
    }
    RAID.roofs.forEach((R, i) => {
      if (!R.rod || i % 2) return;
      const o = holo.root.clone(true);
      o.position.set(R.x - R.half + 1.5, R.h, R.z + R.half - 1.5);
      out.push(o);
    });
    return out;
  }, [dead, holo]);
  return (
    <>
      {objs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  );
}

/** Nấm phát quang + đèn lồng giấy trên đảo: chút ánh sáng ấm / lạnh cho đảo giữa phố tối */
function Glow() {
  const shrooms = useMemo(() => {
    const r = rngOf(123);
    const out: THREE.Matrix4[] = [];
    for (const I of ISLANDS)
      for (let k = 0; k < 18; k++) {
        const a = r() * Math.PI * 2;
        const d = (0.3 + r() * 0.65) * I.r;
        const s = 0.12 + r() * 0.22;
        out.push(new THREE.Matrix4().compose(new THREE.Vector3(I.x + Math.cos(a) * d, 0.6 + s * 0.4, I.z + Math.sin(a) * d), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.7, s)));
      }
    return out;
  }, []);
  return (
    <>
      <instancedMesh
        args={[undefined, undefined, shrooms.length]}
        frustumCulled={false}
        ref={(o) => {
          if (o && !o.userData.done) {
            shrooms.forEach((m, i) => o.setMatrixAt(i, m));
            o.instanceMatrix.needsUpdate = true;
            o.userData.done = true;
          }
        }}
      >
        <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color={[0.4, 2.8, 2.2]} toneMapped={false} />
      </instancedMesh>
      {ISLANDS.map((I, i) => (
        <group key={i} position={[I.x, 0, I.z]}>
          <mesh position={[I.r * 0.4, 2.3, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 2.2, 6]} />
            <meshStandardMaterial color="#3a2a1e" />
          </mesh>
          <mesh position={[I.r * 0.4, 3.5, 0]}>
            <sphereGeometry args={[0.32, 12, 10]} />
            <meshBasicMaterial color={i % 2 ? [3.2, 1.4, 0.5] : [3.2, 0.7, 1.6]} toneMapped={false} />
          </mesh>
          <pointLight position={[I.r * 0.4, 3.4, 0]} color={i % 2 ? "#ffb060" : "#ff70c0"} intensity={14} distance={16} />
          <pointLight position={[0, 1.4, 0]} color="#5fffd0" intensity={6} distance={10} />
        </group>
      ))}
    </>
  );
}

export function Nature() {
  return (
    <>
      <Islands />
      <Glow />
      <Trees />
      <Vines />
      <Algae />
      <Suspense fallback={null}>
        <ModelTrees />
      </Suspense>
    </>
  );
}

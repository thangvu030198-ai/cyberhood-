// Đấu trường Leviathan Điện: Neon City ngập nước lúc bão đêm. Dùng chung engine Hub (nhân vật, camera, súng, Mech);
// thành phố Hub ẩn đi khi vào trận. Gồm: mặt nước có gợn + lóe điện khi phóng điện, 3 cao ốc ngập giữa phố (rắn quấn
// quanh), 11 mái nhà thấp có dốc lên (chỗ tránh điện), 4 cột thu lôi, viền cao ốc chìm nửa thân làm phông, mưa bão,
// chớp. Leviathan: đầu (model Meshy) + 36 đốt thân dựng bằng ống vảy (vẽ instanced) + đuôi vây (Meshy); sừng pha lê,
// mảng vảy lưng, lõi đuôi phá được; lõi tim lộ ra khi ngã quỵ. Lươn máy, đồng đội (rig hoạt ảnh thật).

import { Suspense, use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { RAID_ORIGIN } from "../game/config";
import { extraModel } from "../game/assets";
import { buildRig, flash, setAnim, WHITE, type Rig } from "../level/LevelScene";
import { once } from "../game/meshyAnim";
import { RAID, ROLES, type Member, type RaidSim } from "./raidSim";
import { useRaid } from "./raidSession";
import { RaidDriver, RaidFx } from "./raidFx";

const O = RAID_ORIGIN;

// ---------------------------------------------------------------------------
// Bầu trời bão, sương, chớp

function Atmos({ sim }: { sim: RaidSim }) {
  const scene = useThree((s) => s.scene);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const flashL = useRef<THREE.DirectionalLight>(null);
  const next = useRef(3);
  useEffect(() => {
    const bg = scene.background;
    const fog = scene.fog;
    scene.background = new THREE.Color("#060a14");
    scene.fog = new THREE.FogExp2("#0a1424", 0.0065);
    return () => {
      scene.background = bg;
      scene.fog = fog;
    };
  }, [scene]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Chớp ngẫu nhiên, dày hơn khi phóng điện
    const zap = sim.events.length && sim.events[sim.events.length - 1].kind === "zap" && sim.time - sim.events[sim.events.length - 1].at < 0.4;
    if (t > next.current) next.current = t + 2 + Math.random() * 6;
    // Chớp đúp: hai tia loé ngắn ngay trước mốc
    const strike = zap || (next.current - t > 0 && next.current - t < 0.12) || (next.current - t > 0.2 && next.current - t < 0.28);
    if (flashL.current) flashL.current.intensity = strike ? 6 : 0;
    if (hemi.current) hemi.current.intensity = 0.55 + (strike ? 1.4 : 0);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#5a7ab8", "#081018", 0.55]} />
      <directionalLight position={[-40, 80, 30]} intensity={0.6} color="#7fa8ff" />
      <directionalLight ref={flashL} position={[20, 120, -40]} intensity={0} color="#cfe8ff" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Mặt nước: gợn sóng, ánh neon, lóe điện cyan khi phóng điện (báo trước: viền đỏ nháy)

const WATER_VERT = /* glsl */ `
uniform float uTime; varying vec2 vUv; varying vec3 vW;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); w.y += sin(w.x*0.15+uTime*1.3)*0.06 + cos(w.z*0.18+uTime)*0.05; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FRAG = /* glsl */ `
uniform float uTime; uniform float uWarn; uniform float uZap; varying vec2 vUv; varying vec3 vW;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 p = vW.xz*0.12;
  float r = n(p*3.0+uTime*0.4)*0.6 + n(p*7.0-uTime*0.7)*0.4;
  vec3 deep = vec3(0.02,0.05,0.09);
  vec3 neon = mix(vec3(0.9,0.2,0.8), vec3(0.1,0.8,1.0), n(p*0.6+3.1));
  vec3 col = deep + neon * pow(r,4.0) * 0.55;
  // Mưa rơi: chấm gợn nhỏ
  float drop = smoothstep(0.97, 1.0, n(vW.xz*2.2 + floor(uTime*6.0)*7.3));
  col += vec3(0.4,0.6,0.8)*drop*0.6;
  // Báo phóng điện: vân điện đỏ cam nhấp nháy; bùng: lưới điện cyan rực
  float arc = smoothstep(0.92, 1.0, 1.0 - abs(n(vW.xz*0.35 + uTime*3.0)*2.0 - 1.0));
  col += vec3(1.0,0.35,0.15) * arc * uWarn * (0.5+0.5*sin(uTime*24.0));
  col += vec3(0.3,0.95,1.0) * (arc*3.0 + 0.35) * uZap;
  gl_FragColor = vec4(col, 0.92);
}`;

function Water({ sim }: { sim: RaidSim }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: { uTime: { value: 0 }, uWarn: { value: 0 }, uZap: { value: 0 } }, transparent: true, depthWrite: false, toneMapped: false }), []);
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    const pend = sim.warns.find((w) => !w.done && (w.kind === "discharge" || w.kind === "tsunami"));
    mat.uniforms.uWarn.value = pend ? Math.min(1, (sim.time - pend.warnAt) / (pend.liveAt - pend.warnAt) + 0.3) : 0;
    const live = sim.warns.find((w) => w.done && (w.kind === "discharge" || w.kind === "tsunami") && sim.time - w.liveAt < 1.1);
    mat.uniforms.uZap.value = live ? 1 - (sim.time - live.liveAt) / 1.1 : 0;
  });
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.35, 0]} material={mat} renderOrder={1}>
        <planeGeometry args={[420, 420, 64, 64]} />
      </mesh>
      {/* Đáy phố ngập (mặt đường chìm) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]}>
        <planeGeometry args={[420, 420]} />
        <meshStandardMaterial color="#0b1118" roughness={0.9} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[200, 0.5, 200]} position={[0, -0.5, 0]} />
        {/* Tường biên đấu trường */}
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2;
          const R = RAID.arena.half + 4;
          return <CuboidCollider key={i} args={[R + 4, 6, 1]} position={[Math.sin(a) * R, 6, Math.cos(a) * R]} rotation={[0, a, 0]} />;
        })}
      </RigidBody>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cao ốc ngập (3 cột rắn quấn quanh) + viền thành phố chìm nửa thân

function towerTex(seed: number) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b1018";
  g.fillRect(0, 0, 128, 512);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 8; x++) {
      const r = Math.sin(seed * 91 + x * 13.1 + y * 7.7) * 0.5 + 0.5;
      g.fillStyle = r > 0.82 ? "#ffd27a" : r > 0.7 ? "#7fe8ff" : r > 0.62 ? "#ff6ad5" : "#141b26";
      g.fillRect(4 + x * 15.5, 4 + y * 8, 10, 4);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 3 cao ốc ngập giữa phố (rắn quấn quanh): thân kính tối cửa sổ sáng, vạch neon dọc cạnh, đỉnh ăng-ten đèn đỏ */
function Towers() {
  const items = useMemo(() => RAID.towers.map((_, i) => towerTex(i + 1)), []);
  return (
    <>
      {RAID.towers.map((T, i) => {
        const col = ["#36e7ff", "#ff4fd8", "#ffd166"][i % 3];
        const w = T.r * 1.7;
        return (
          <group key={i} position={[T.x, 0, T.z]} rotation-y={i * 0.7}>
            <mesh position={[0, T.h / 2 - 4, 0]}>
              <boxGeometry args={[w, T.h, w]} />
              <meshStandardMaterial map={items[i]} emissiveMap={items[i]} emissive="#ffffff" emissiveIntensity={0.9} color="#3a4658" roughness={0.3} metalness={0.6} />
            </mesh>
            {[
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ].map(([sx, sz], k) => (
              <mesh key={k} position={[(sx * w) / 2, T.h / 2 - 4, (sz * w) / 2]}>
                <boxGeometry args={[0.25, T.h, 0.25]} />
                <meshBasicMaterial color={col} toneMapped={false} />
              </mesh>
            ))}
            <mesh position={[0, T.h - 4 + 1.5, 0]}>
              <boxGeometry args={[w * 0.6, 3, w * 0.6]} />
              <meshStandardMaterial color="#1a2230" emissive={col} emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[0, T.h - 4 + 8, 0]}>
              <cylinderGeometry args={[0.15, 0.3, 10, 6]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            <mesh position={[0, T.h - 4 + 13, 0]}>
              <sphereGeometry args={[0.5, 8, 6]} />
              <meshBasicMaterial color={[3, 0.3, 0.3]} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <RigidBody type="fixed" colliders={false}>
        {RAID.towers.map((T, i) => (
          <CylinderCollider key={i} args={[T.h / 2, T.r]} position={[T.x, T.h / 2 - 4, T.z]} />
        ))}
      </RigidBody>
    </>
  );
}

/** Viền thành phố chìm nửa thân quanh đấu trường: khối cao ốc cửa sổ sáng, vạch neon ở mép mái */
function Skyline() {
  const texs = useMemo(() => [11, 12, 13, 14].map(towerTex), []);
  const blocks = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number; h: number; ry: number; t: number; c: string }[] = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + Math.sin(i * 3.1) * 0.04;
      const R = 108 + ((i * 37) % 4) * 14;
      out.push({ x: Math.sin(a) * R, z: Math.cos(a) * R, w: 12 + ((i * 7) % 5) * 3, d: 12 + ((i * 11) % 4) * 3, h: 28 + ((i * 13) % 7) * 11, ry: -a, t: i % 4, c: ["#36e7ff", "#ff4fd8", "#ffd166", "#7dff9a"][i % 4] });
    }
    return out;
  }, []);
  return (
    <>
      {blocks.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2 - 6, b.z]} rotation-y={b.ry}>
          <mesh>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial map={texs[b.t]} emissiveMap={texs[b.t]} emissive="#ffffff" emissiveIntensity={0.75} color="#2e3a4c" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0, b.h / 2, b.d / 2 + 0.05]}>
            <boxGeometry args={[b.w, 0.3, 0.1]} />
            <meshBasicMaterial color={b.c} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Mái nhà thấp: khối bê tông viền neon, có dốc lên, thùng nước / máy lạnh, chữ H

function Roofs() {
  const wallTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#151b26";
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = Math.random() < 0.4 ? "#ffcf6a" : Math.random() < 0.5 ? "#2a3550" : "#7fe8ff";
        g.globalAlpha = 0.85;
        g.fillRect(8 + x * 30, 10 + y * 30, 18, 12);
      }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <>
      {RAID.roofs.map((r, i) => {
        const s = r.half * 2;
        // Dốc quay về phía tâm đấu trường
        const a = Math.atan2(-r.x, -r.z);
        const rx = r.x + Math.sin(a) * (r.half + 3.4);
        const rz = r.z + Math.cos(a) * (r.half + 3.4);
        const slope = Math.atan2(r.h, 7);
        const col = r.rod ? "#36e7ff" : i % 2 ? "#ff4fd8" : "#ffd166";
        return (
          <group key={i}>
            <mesh position={[r.x, r.h / 2 - 1, r.z]}>
              <boxGeometry args={[s, r.h + 2, s]} />
              <meshStandardMaterial color="#2a313d" map={wallTex} emissiveMap={wallTex} emissive="#ffffff" emissiveIntensity={0.25} roughness={0.85} />
            </mesh>
            <mesh position={[r.x, r.h + 0.02, r.z]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[s - 0.4, s - 0.4]} />
              <meshStandardMaterial color="#39404c" roughness={0.95} />
            </mesh>
            {/* Viền neon */}
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} position={[r.x + (k === 0 ? r.half : k === 1 ? -r.half : 0), r.h + 0.12, r.z + (k === 2 ? r.half : k === 3 ? -r.half : 0)]} rotation-y={k < 2 ? 0 : Math.PI / 2}>
                <boxGeometry args={[0.18, 0.18, s]} />
                <meshBasicMaterial color={col} toneMapped={false} />
              </mesh>
            ))}
            {!r.rod && (
              <mesh position={[r.x, r.h + 0.05, r.z]} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[r.half * 0.45, r.half * 0.55, 32]} />
                <meshBasicMaterial color={col} toneMapped={false} transparent opacity={0.7} />
              </mesh>
            )}
            {/* Thùng nước + khối máy lạnh */}
            <mesh position={[r.x - r.half + 1.3, r.h + 1, r.z - r.half + 1.3]}>
              <cylinderGeometry args={[0.9, 0.9, 2, 12]} />
              <meshStandardMaterial color="#5b4a3a" roughness={0.8} />
            </mesh>
            <mesh position={[r.x + r.half - 1.2, r.h + 0.5, r.z + r.half - 1.6]}>
              <boxGeometry args={[1.8, 1, 1.4]} />
              <meshStandardMaterial color="#8a909a" metalness={0.5} roughness={0.5} />
            </mesh>
            {/* Dốc lên mái */}
            <mesh position={[rx, r.h / 2, rz]} rotation={[0, a, 0]}>
              <group rotation-x={slope}>
                <mesh>
                  <boxGeometry args={[3.2, 0.3, Math.hypot(7.4, r.h)]} />
                  <meshStandardMaterial color="#4a525e" roughness={0.9} />
                </mesh>
              </group>
            </mesh>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[r.half, r.h / 2, r.half]} position={[r.x, r.h / 2, r.z]} />
              <CuboidCollider args={[1.6, 0.15, Math.hypot(7.4, r.h) / 2]} position={[rx, r.h / 2, rz]} rotation={[slope, a, 0]} />
            </RigidBody>
          </group>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Cột thu lôi (model Meshy): hồ quang khi còn đứng, gãy đổ khi bị phá, dựng lại khi nạp

function useRaidModel(name: string) {
  const g = use(extraModel("mx_raid_all"));
  return useMemo(() => {
    const node = g.scene.getObjectByName(name);
    if (!node) return null;
    const o = node.clone(true);
    o.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const wrap = new THREE.Group();
    o.position.set(-c.x, -box.min.y, -c.z);
    wrap.add(o);
    wrap.userData.size = size;
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (m.isMesh) {
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        if (mat.map) {
          mat.emissiveMap = mat.map;
          mat.emissive = new THREE.Color(1, 1, 1);
          mat.emissiveIntensity = 0.35;
        }
        m.material = mat;
      }
    });
    return wrap;
  }, [g, name]);
}

function Rods({ sim }: { sim: RaidSim }) {
  const base = useRaidModel("rd_rod");
  const objs = useMemo(() => {
    if (!base) return [];
    const k = 9.5 / (base.userData.size as THREE.Vector3).y;
    return sim.rods.map(() => {
      const o = base.clone(true);
      o.scale.setScalar(k);
      return o;
    });
  }, [base, sim]);
  const arcs = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    sim.rods.forEach((r, i) => {
      const o = objs[i];
      if (!o) return;
      o.position.set(r.x, r.y, r.z);
      // Gãy: đổ nghiêng xuống mái trong 0,6 s; dựng lại khi nạp
      const fall = r.alive ? 0 : Math.min(1, (sim.time - r.downAt) / 0.6);
      o.rotation.set(fall * 1.35, i * 1.1, 0);
      const a = arcs.current?.children[i] as THREE.Mesh | undefined;
      if (a) {
        a.visible = r.alive;
        a.position.set(r.x, r.y + 9 + Math.sin(t * 20 + i) * 0.2, r.z);
        a.scale.setScalar(1 + Math.random() * 0.6);
        a.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      }
    });
  });
  return (
    <>
      {objs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      <group ref={arcs}>
        {sim.rods.map((_, i) => (
          <mesh key={i}>
            <icosahedronGeometry args={[0.8, 0]} />
            <meshBasicMaterial color={[0.6, 2.8, 3.4]} wireframe toneMapped={false} />
          </mesh>
        ))}
      </group>
      {sim.rods.map((r, i) => (
        <pointLight key={i} position={[r.x, r.y + 9, r.z]} color="#5fe9ff" intensity={12} distance={18} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Leviathan

/** Kết cấu vảy: lục giác xếp chồng màu xanh đen + gân điện cyan dọc sống */
function scaleTextures() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const e = document.createElement("canvas");
  e.width = 256;
  e.height = 256;
  const ge = e.getContext("2d")!;
  g.fillStyle = "#0b2a33";
  g.fillRect(0, 0, 256, 256);
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const cx = x * 32 + (y % 2) * 16;
      const cy = y * 30;
      const grd = g.createRadialGradient(cx, cy - 6, 2, cx, cy, 20);
      grd.addColorStop(0, "#2f6f7d");
      grd.addColorStop(0.7, "#123b47");
      grd.addColorStop(1, "#061419");
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(cx, cy, 17, 15, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#04090c";
      g.lineWidth = 2;
      g.stroke();
    }
  // Gân điện dọc
  for (const gg of [g, ge]) {
    gg.strokeStyle = gg === ge ? "#5ff3ff" : "#3fd8ff";
    gg.lineWidth = 3;
    for (const x of [64, 192]) {
      gg.beginPath();
      gg.moveTo(x, 0);
      for (let y = 0; y <= 256; y += 16) gg.lineTo(x + Math.sin(y * 0.2) * 8, y);
      gg.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  const te = new THREE.CanvasTexture(e);
  for (const x of [t, te]) {
    x.wrapS = x.wrapT = THREE.RepeatWrapping;
    x.repeat.set(2, 1);
  }
  t.colorSpace = THREE.SRGBColorSpace;
  return { t, te };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

function Leviathan({ sim }: { sim: RaidSim }) {
  const head = useRaidModel("rd_lev_head");
  const tail = useRaidModel("rd_lev_tail");
  const N = RAID.segments;
  const tex = useMemo(scaleTextures, []);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.t, emissiveMap: tex.te, emissive: new THREE.Color("#7ff6ff"), emissiveIntensity: 1.4, roughness: 0.45, metalness: 0.35 }), [tex]);
  const bodyGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).rotateX(Math.PI / 2), []);
  const spikeGeo = useMemo(() => new THREE.ConeGeometry(0.5, 2.2, 5).translate(0, 1.1, 0), []);
  const body = useRef<THREE.InstancedMesh>(null);
  const spikes = useRef<THREE.InstancedMesh>(null);
  const plates = useRef<THREE.Group>(null);
  const horns = useRef<THREE.Group>(null);
  const heart = useRef<THREE.Mesh>(null);
  const headG = useRef<THREE.Group>(null);
  const tailG = useRef<THREE.Group>(null);
  const eye = useRef<THREE.PointLight>(null);
  const headScale = useMemo(() => (head ? 14 / (head.userData.size as THREE.Vector3).z : 1), [head]);
  const tailScale = useMemo(() => (tail ? 9 / (tail.userData.size as THREE.Vector3).z : 1), [tail]);
  const hurtAt = useRef(-9);
  const seen = useRef(0);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const H = sim.head;
    for (let i = seen.current; i < sim.events.length; i++) if (sim.events[i].kind === "hit") hurtAt.current = sim.time;
    seen.current = sim.events.length;
    const hurt = Math.max(0, 1 - (sim.time - hurtAt.current) / 0.12);
    // Đầu
    if (headG.current) {
      headG.current.position.set(H.x, H.y - 1.5, H.z);
      headG.current.rotation.set(-H.pitch, H.yaw, H.mode === "down" || H.mode === "paralyzed" ? Math.sin(t * 9) * 0.06 + 0.25 : 0, "YXZ");
      if (head) flash(head, hurt * 0.6, WHITE);
    }
    if (eye.current) eye.current.intensity = H.mode === "rear" ? 40 + Math.sin(t * 30) * 10 : 18;
    // Thân: ống vảy nối các đốt, thon dần về đuôi; gai lưng
    const b = body.current;
    const sp = spikes.current;
    if (b && sp) {
      let prev = { x: H.x - Math.sin(H.yaw) * 2, y: H.y - 1.5, z: H.z - Math.cos(H.yaw) * 2 };
      for (let i = 0; i < N; i++) {
        const p = sim.body[i];
        _d.set(prev.x - p.x, prev.y - p.y, prev.z - p.z);
        const len = _d.length() || 0.01;
        _d.divideScalar(len);
        _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _d);
        const r = 3.3 * (1 - (i / N) * 0.62) * (1 + Math.sin(t * 3 - i * 0.5) * 0.03);
        _v.set((prev.x + p.x) / 2, (prev.y + p.y) / 2, (prev.z + p.z) / 2);
        _m.compose(_v, _q, _s.set(r, r, len * 1.18));
        b.setMatrixAt(i, _m);
        // Gai lưng: hướng lên theo pháp tuyến phía trên ống
        const up = _up.clone().sub(_d.clone().multiplyScalar(_up.dot(_d))).normalize();
        const qs = new THREE.Quaternion().setFromUnitVectors(_up, up);
        _m.compose(_v.clone().addScaledVector(up, r * 0.85), qs, _s.setScalar(r * 0.55 * (1 + (i % 2) * 0.3)));
        sp.setMatrixAt(i, _m);
        prev = p;
      }
      b.instanceMatrix.needsUpdate = true;
      sp.instanceMatrix.needsUpdate = true;
      bodyMat.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.4 + hurt * 2;
    }
    // Mảng vảy lưng + lõi đuôi (phá được): khối giáp phát sáng
    if (plates.current) {
      sim.parts.forEach((p, k) => {
        const o = plates.current!.children[k] as THREE.Mesh | undefined;
        if (!o) return;
        const at = RAID.parts[p.id].at;
        if (at === "head") {
          o.visible = false;
          return;
        }
        o.visible = !p.broken;
        const q = sim.body[at as number];
        o.position.set(q.x, q.y + 2.4, q.z);
        o.rotation.y = t * 0.6 + k;
        const s = 1 + Math.sin(t * 5 + k) * 0.08;
        o.scale.setScalar(s * (p.id === "tail" ? 1.4 : 1));
      });
    }
    // Sừng pha lê (phá được)
    if (horns.current) {
      (["hornL", "hornR"] as const).forEach((id, k) => {
        const o = horns.current!.children[k] as THREE.Mesh;
        const p = sim.parts.find((x) => x.id === id)!;
        o.visible = !p.broken && sim.phase !== "end";
        const q = sim.partPos(id);
        o.position.set(q.x, q.y + 0.5, q.z);
        o.rotation.set(0.3 * (k ? -1 : 1), H.yaw, 0.5 * (k ? -1 : 1));
      });
    }
    // Lõi tim lộ ra khi ngã quỵ / tê liệt
    if (heart.current) {
      const ex = sim.exposed();
      heart.current.visible = ex;
      if (ex) {
        const h = sim.heartPos();
        heart.current.position.set(h.x, h.y, h.z);
        heart.current.scale.setScalar(2.2 + Math.sin(t * 8) * 0.3);
      }
    }
    // Đuôi vây
    if (tailG.current) {
      const a = sim.body[N - 1];
      const b2 = sim.body[N - 2];
      tailG.current.position.set(a.x, a.y, a.z);
      tailG.current.rotation.set(0, Math.atan2(a.x - b2.x, a.z - b2.z), Math.sin(t * 2.5) * 0.3);
    }
  });
  return (
    <>
      <group ref={headG}>
        {head && <primitive object={head} scale={headScale} />}
        <pointLight ref={eye} position={[0, 3, 5]} color="#5fe9ff" intensity={18} distance={30} />
      </group>
      <group ref={tailG}>{tail && <primitive object={tail} scale={tailScale} position={[0, -1.5, 2]} />}</group>
      <instancedMesh ref={body} args={[bodyGeo, bodyMat, N]} frustumCulled={false} />
      <instancedMesh ref={spikes} args={[spikeGeo, undefined, N]} frustumCulled={false}>
        <meshStandardMaterial color="#0e3440" emissive="#1fb8d4" emissiveIntensity={0.7} roughness={0.35} metalness={0.4} />
      </instancedMesh>
      <group ref={plates}>
        {sim.parts.map((p) => (
          <mesh key={p.id}>
            <octahedronGeometry args={[1.6, 0]} />
            <meshStandardMaterial color="#ffd166" emissive={p.id === "tail" ? "#ff4fd8" : "#ffb000"} emissiveIntensity={2.2} roughness={0.2} metalness={0.6} />
          </mesh>
        ))}
      </group>
      <group ref={horns}>
        {[0, 1].map((k) => (
          <mesh key={k}>
            <coneGeometry args={[0.7, 4.2, 6]} />
            <meshStandardMaterial color="#bff6ff" emissive="#7ff3ff" emissiveIntensity={2.6} roughness={0.1} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      <mesh ref={heart} visible={false}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color={[3.4, 0.6, 2.6]} toneMapped={false} />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Lươn máy

function Eels({ sim }: { sim: RaidSim }) {
  const base = useRaidModel("rd_eel");
  const pool = useMemo(() => {
    if (!base) return [];
    const k = 3.2 / (base.userData.size as THREE.Vector3).z;
    return Array.from({ length: 12 }, () => {
      const o = base.clone(true);
      o.scale.setScalar(k);
      o.visible = false;
      return o;
    });
  }, [base]);
  useFrame(({ clock }) => {
    const alive = sim.eels.filter((e) => e.alive);
    pool.forEach((o, i) => {
      const e = alive[i];
      o.visible = !!e;
      if (!e) return;
      o.position.set(e.x, e.y, e.z);
      o.rotation.set(Math.sin(clock.elapsedTime * 3 + i) * 0.3, e.t * 0.8 + e.id + Math.PI / 2, 0);
    });
  });
  return (
    <>
      {pool.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Đồng đội: rig hoạt ảnh thật theo vai trò (Vệ binh: Samurai, Xung kích: Racer / Ninja, Y tế: Engineer, Phá giáp: Hacker)

const ROLE_MODEL = { tank: "samurai", dps: "racer", healer: "engineer", support: "hacker" } as const;

function useMemberRig(cls: "samurai" | "racer" | "engineer" | "hacker" | "ninja") {
  const run = use(extraModel(`mx_cls_${cls}_run` as never)) as { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
  const shoot = use(extraModel(`mx_cls_${cls}_runshoot` as never)) as { animations: THREE.AnimationClip[] };
  const idle = use(extraModel(`mx_cls_${cls}_idle` as never)) as { animations: THREE.AnimationClip[] };
  const death = use(extraModel(`mx_cls_${cls}_death` as never)) as { animations: THREE.AnimationClip[] };
  return useMemo(
    () => () => {
      const rig = buildRig(run.scene, { run: run.animations[0], shoot: shoot.animations[0], idle: idle.animations[0], death: death.animations[0] }, 1.8, 0.4);
      if (rig.actions.death) once(rig.actions.death);
      return rig;
    },
    [run, shoot, idle, death],
  );
}

function MemberView({ sim, m, make }: { sim: RaidSim; m: Member; make: () => Rig }) {
  const rig = useMemo(make, [make]);
  const ref = useRef<THREE.Group>(null);
  const mech = useRef<THREE.Mesh>(null);
  const was = useRef(true);
  useFrame((_, dt) => {
    const o = ref.current;
    if (!o) return;
    o.position.set(m.x, m.y + 0.35, m.z);
    o.rotation.y = m.yaw;
    const moving = Math.hypot(m.vx, m.vz) > 0.5;
    if (!m.alive) {
      if (was.current) setAnim(rig, "death", 0.1, true);
    } else setAnim(rig, sim.time - m.shootAt > -0.4 && !moving ? "shoot" : moving ? (sim.time - m.shootAt > -0.4 ? "shoot" : "run") : "idle", 0.2);
    was.current = m.alive;
    rig.mixer.update(Math.min(dt, 0.1));
    flash(rig.scene, Math.max(0, 1 - (sim.time - m.hurtAt) / 0.15) * 0.7, WHITE);
    // Biến hình Mech: khung giáp phát sáng bao quanh
    if (mech.current) {
      mech.current.visible = m.inMech && m.alive;
      mech.current.rotation.y += dt * 2;
    }
  });
  const c = ROLES[m.role].color;
  return (
    <group ref={ref}>
      <primitive object={rig.scene} />
      <mesh ref={mech} position={[0, 1.6, 0]} visible={false}>
        <octahedronGeometry args={[1.8, 0]} />
        <meshBasicMaterial color={c} wireframe toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.55, 0.75, 24]} />
        <meshBasicMaterial color={c} toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function RoleSquad({ sim, cls, members }: { sim: RaidSim; cls: "samurai" | "racer" | "engineer" | "hacker" | "ninja"; members: Member[] }) {
  const make = useMemberRig(cls);
  return (
    <>
      {members.map((m) => (
        <MemberView key={m.id} sim={sim} m={m} make={make} />
      ))}
    </>
  );
}

function Team({ sim }: { sim: RaidSim }) {
  const groups = useMemo(() => {
    const npc = sim.members.filter((m) => m.kind !== "player");
    const by: Record<string, Member[]> = {};
    for (const m of npc) {
      const cls = m.role === "dps" && m.id % 2 ? "ninja" : ROLE_MODEL[m.role];
      (by[cls] ??= []).push(m);
    }
    return by;
  }, [sim]);
  return (
    <>
      {Object.entries(groups).map(([cls, ms]) => (
        <Suspense key={cls} fallback={null}>
          <RoleSquad sim={sim} cls={cls as "samurai"} members={ms} />
        </Suspense>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bãi tập kết của đội: bệ nổi có đèn hiệu

function Camp() {
  const C = RAID.camp;
  return (
    <group position={[C.x, 0, C.z]}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[C.r, C.r + 0.6, 0.6, 32]} />
        <meshStandardMaterial color="#222a36" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.62, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[C.r - 0.8, C.r - 0.4, 48]} />
        <meshBasicMaterial color={[0.4, 2.4, 3]} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 4, 0]} color="#7fe8ff" intensity={20} distance={20} />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.3, C.r]} position={[0, 0.3, 0]} />
      </RigidBody>
    </group>
  );
}

function Rain() {
  const camera = useThree((s) => s.camera);
  const ref = useRef<THREE.LineSegments>(null);
  const geo = useMemo(() => {
    const n = 2200;
    const p = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 80;
      const y = Math.random() * 40;
      const z = (Math.random() - 0.5) * 80;
      p.set([x, y, z, x + 0.15, y + 1.1, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    const a = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < a.length; i += 6) {
      a[i + 1] -= dt * 38;
      a[i + 4] -= dt * 38;
      if (a[i + 1] < 0) {
        a[i + 1] += 40;
        a[i + 4] += 40;
      }
    }
    geo.attributes.position.needsUpdate = true;
    ref.current?.position.set(camera.position.x, 0, camera.position.z);
  });
  return (
    <lineSegments ref={ref} geometry={geo}>
      <lineBasicMaterial color="#9fc4ff" transparent opacity={0.35} />
    </lineSegments>
  );
}

export function RaidWorld() {
  const sim = useRaid((s) => s.sim);
  if (!sim) return null;
  return (
    <>
      <Atmos sim={sim} />
      <RaidDriver sim={sim} />
      <group position={[O.x, 0, O.z]}>
        <Water sim={sim} />
        <Camp />
        <Roofs />
        <Towers />
        <Skyline />
        <Suspense fallback={null}>
          <Rods sim={sim} />
          <Leviathan sim={sim} />
          <Eels sim={sim} />
        </Suspense>
        <Team sim={sim} />
        <RaidFx sim={sim} />
      </group>
      <Rain />
    </>
  );
}

// Bản đồ "Thành Băng IXO" (GDD 4I): cánh đồng tuyết rộng → hào băng có 3 cầu → 3 Máy phát khiên nối tia vào chóp
// lâu đài → khiên năng lượng hình vòm → tường thành băng 14 đoạn, cổng thép, pháo trên tường → sân trong 2 tháp canh →
// Lõi Thành trước toà lâu đài chính. Núi tuyết bao quanh, rừng thông, trại quân Hunter, tuyết rơi.
// Dựng bằng model Meshy (vẽ hàng loạt cho tường, tháp, cây, đá) + vật liệu tuyết / băng vẽ bằng code.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { SIEGE_ORIGIN } from "../game/config";
import { useFitted } from "../game/Showcase";
import type { ExtraModel } from "../game/assets";
import { ModelSet, type Placed } from "../level/terrainSkin";
import { SIEGE, type SiegeSim } from "./siegeSim";
import { useSiege } from "./siegeSession";
import { Crowd } from "./crowd";
import { SiegeDriver, SiegeFx } from "./siegeFx";
import { Tanks } from "./tanks";
import { SiegeCombat } from "./siegeCombat";

const O = SIEGE_ORIGIN;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------------------------------------------------------------------------
// Bầu trời u ám tuyết rơi: thay nền / sương mù / đèn của thành phố đêm khi đang ở Công thành

function SiegeAtmos() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const bg = scene.background;
    const fog = scene.fog;
    scene.background = new THREE.Color("#b9c7d8");
    scene.fog = new THREE.Fog("#c9d5e3", 70, 520);
    return () => {
      scene.background = bg;
      scene.fog = fog;
    };
  }, [scene]);
  return (
    <>
      <hemisphereLight args={["#f4f8ff", "#9fb0c6", 2.6]} />
      <directionalLight position={[O.x - 120, 160, O.z + 90]} intensity={3.4} color="#fff2dc" />
      <directionalLight position={[O.x + 90, 60, O.z - 140]} intensity={1.1} color="#9fd8ff" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Vật liệu vẽ bằng code

/** Tuyết: trắng ngả xanh, gợn sóng gió thổi, lấm tấm tinh thể lấp lánh */
function snowTexture() {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#e9eff7";
  g.fillRect(0, 0, S, S);
  const r = rng(91);
  for (let i = 0; i < 500; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 30 + r() * 120;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() < 0.5 ? "rgba(190,205,228,0.22)" : "rgba(255,255,255,0.35)";
    gr.addColorStop(0, c);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
  }
  // Gợn sóng gió (sastrugi)
  g.strokeStyle = "rgba(170,188,215,0.16)";
  g.lineWidth = 2;
  for (let i = 0; i < 160; i++) {
    const y = r() * S;
    const x = r() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + 40, y - 8, x + 90, y + 8, x + 140 + r() * 60, y);
    g.stroke();
  }
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() < 0.7 ? "rgba(255,255,255,0.9)" : "rgba(170,220,255,0.8)";
    g.fillRect(r() * S, r() * S, 1.4, 1.4);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Mặt băng hào: xanh thẫm trong, vết nứt trắng */
function iceTexture() {
  const S = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, "#1d4f7a");
  grad.addColorStop(0.5, "#2c6e9e");
  grad.addColorStop(1, "#194166");
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const r = rng(7);
  g.strokeStyle = "rgba(220,240,255,0.55)";
  for (let i = 0; i < 70; i++) {
    let x = r() * S;
    let y = r() * S;
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += (r() - 0.5) * 70;
      y += (r() - 0.5) * 70;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.25})`;
    g.beginPath();
    g.arc(r() * S, r() * S, 1 + r() * 6, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------------------
// Địa hình

function Snowfield() {
  const tex = useMemo(() => {
    const t = snowTexture();
    t.repeat.set(70, 70);
    return t;
  }, []);
  // Đồi tuyết thoải ngoài khu giao chiến + núi phủ tuyết vòng quanh chân trời
  const dunes = useMemo(() => {
    const g = new THREE.PlaneGeometry(1600, 1600, 160, 160);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      // Phẳng trong khu chơi (|x| < 170, −140 < z < 250), nhô dần ra ngoài
      const dx = Math.max(0, Math.abs(x) - 170);
      const dz = Math.max(0, z - 250, -140 - z);
      const k = Math.min(1, Math.hypot(dx, dz) / 120);
      const n = Math.sin(x * 0.021) * Math.cos(z * 0.017) * 9 + Math.sin(x * 0.053 + z * 0.041) * 4 + Math.sin(z * 0.009) * 12;
      p.setY(i, k * k * (14 + n) - 0.05);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const mountains = useMemo(() => {
    const r = rng(33);
    return Array.from({ length: 26 }, (_, i) => {
      const a = (i / 26) * Math.PI * 2 + r() * 0.2;
      const d = 560 + r() * 120;
      return { x: Math.sin(a) * d, z: 55 + Math.cos(a) * d, h: 120 + r() * 160, w: 120 + r() * 120, rot: r() * 6 };
    });
  }, []);
  const mtnGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 9, 6);
    const p = g.attributes.position;
    const r = rng(5);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0.49) continue;
      const k = 0.85 + r() * 0.3;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
      p.setY(i, y + (r() - 0.5) * 0.06);
    }
    g.translate(0, 0.5, 0);
    g.computeVertexNormals();
    // Đỉnh trắng, chân xám xanh
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i);
      const c = new THREE.Color().lerpColors(new THREE.Color("#7f93ad"), new THREE.Color("#f4f8ff"), Math.min(1, Math.max(0, (h - 0.25) * 2.2)));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={dunes} position={[0, 0, 55]}>
        <meshStandardMaterial map={tex} roughness={0.92} color="#ffffff" emissive="#dfe9f7" emissiveIntensity={0.28} />
      </mesh>
      {mountains.map((m, i) => (
        <mesh key={i} geometry={mtnGeo} position={[m.x, -2, m.z]} scale={[m.w, m.h, m.w * 0.8]} rotation-y={m.rot}>
          <meshStandardMaterial vertexColors roughness={0.95} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Hào băng chắn ngang cánh đồng, 3 cầu băng có lan can trụ băng */
function Moat() {
  const M = SIEGE.moat;
  const tex = useMemo(() => {
    const t = iceTexture();
    t.repeat.set(60, 2);
    return t;
  }, []);
  const width = M.z1 - M.z0;
  const gaps = [-170, ...M.bridges.flatMap((b) => [b - M.bridgeHalf, b + M.bridgeHalf]), 170];
  const walls: { x: number; w: number }[] = [];
  for (let i = 0; i < gaps.length; i += 2) walls.push({ x: (gaps[i] + gaps[i + 1]) / 2, w: gaps[i + 1] - gaps[i] });
  return (
    <group>
      {/* Lòng hào: băng xanh thẫm thấp hơn mặt tuyết, hai bờ dốc */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.1, (M.z0 + M.z1) / 2]}>
        <planeGeometry args={[340, width]} />
        <meshStandardMaterial map={tex} roughness={0.12} metalness={0.2} color="#9fd2ff" emissive="#0a2a48" emissiveIntensity={0.4} />
      </mesh>
      {[M.z0, M.z1].map((z, i) => (
        <mesh key={i} position={[0, -0.55, z]} rotation-x={i ? -0.9 : 0.9}>
          <boxGeometry args={[340, 1.6, 0.6]} />
          <meshStandardMaterial color="#dfe9f6" roughness={0.9} />
        </mesh>
      ))}
      {M.bridges.map((b) => (
        <group key={b} position={[b, 0, (M.z0 + M.z1) / 2]}>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[M.bridgeHalf * 2, 0.5, width + 3]} />
            <meshStandardMaterial color="#a9d6f5" roughness={0.25} metalness={0.15} transparent opacity={0.92} emissive="#2a6a9a" emissiveIntensity={0.25} />
          </mesh>
          {[-1, 1].map((s) =>
            [-1, 0, 1].map((k) => (
              <mesh key={`${s}${k}`} position={[s * (M.bridgeHalf - 0.3), 0.9, k * (width / 2)]}>
                <cylinderGeometry args={[0.18, 0.28, 1.6, 6]} />
                <meshStandardMaterial color="#c8ecff" roughness={0.2} emissive="#5fd0ff" emissiveIntensity={0.5} />
              </mesh>
            )),
          )}
        </group>
      ))}
      {/* Không cho người chơi bước xuống hào ngoài cầu */}
      <RigidBody type="fixed" colliders={false}>
        {walls.map((w, i) => (
          <CuboidCollider key={i} args={[w.w / 2, 1.5, width / 2]} position={[w.x, 1.2, (M.z0 + M.z1) / 2]} />
        ))}
      </RigidBody>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Lâu đài

const WALL_SEGS = 14;
const WALL_H = 9;
const TOWER_H = 17;

/** Một đoạn tường / tháp theo góc trên vòng tường (góc 0 = cổng, phía +z) */
const ringAt = (a: number, r = SIEGE.wall.r) => ({ x: Math.sin(a) * r, z: Math.cos(a) * r });

function Castle({ sim }: { sim: SiegeSim }) {
  const step = (Math.PI * 2) / WALL_SEGS;
  const chord = 2 * SIEGE.wall.r * Math.sin(step / 2);
  const walls: Placed[] = [];
  const towers: Placed[] = [];
  for (let i = 1; i < WALL_SEGS; i++) {
    const a = i * step;
    const p = ringAt(a);
    // Model tường dài theo trục X: xoay cho nằm dọc theo tiếp tuyến vòng
    walls.push({ x: p.x, y: 0, z: p.z, w: chord + 1.6, h: WALL_H, d: 4, rot: a + Math.PI / 2 });
  }
  for (let i = 0; i < WALL_SEGS; i++) {
    if (i === 0 || i === 1) continue; // hai bên cổng đã có tháp của cụm cổng
    const p = ringAt(i * step + step / 2);
    if (i % 2 === 0) towers.push({ x: p.x, y: 0, z: p.z, w: 8.5, h: TOWER_H, d: 8.5, rot: i });
  }
  // Hai tháp canh trong sân (mục tiêu chiếm)
  const inner: Placed[] = SIEGE.towers.map((t, i) => ({ x: t.x, y: 0, z: t.z - 3, w: 10, h: 22, d: 10, rot: i ? -0.6 : 0.6 }));
  return (
    <group>
      <Suspense fallback={null}>
        <ModelSet name="mx_sg_wall" items={walls} selfLit={0.25} />
        <ModelSet name="mx_sg_tower" items={[...towers, ...inner]} selfLit={0.25} />
        <Keep />
        <Gate sim={sim} />
        <Core sim={sim} />
      </Suspense>
      <RigidBody type="fixed" colliders={false}>
        {walls.map((w, i) => (
          <CuboidCollider key={i} args={[w.w / 2, WALL_H / 2, 1.8]} position={[w.x, WALL_H / 2, w.z]} rotation={[0, w.rot ?? 0, 0]} />
        ))}
        {[...towers, ...inner].map((t, i) => (
          <CylinderCollider key={`t${i}`} args={[t.h / 2, t.w * 0.42]} position={[t.x, t.h / 2, t.z]} />
        ))}
        {/* Toà lâu đài chính */}
        <CuboidCollider args={[18, 20, 8.5]} position={[0, 20, -26]} />
      </RigidBody>
      {/* Sân trong: nền đá băng lát, lò lửa tím soi sáng */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <circleGeometry args={[SIEGE.wall.r - 1, 48]} />
        <meshStandardMaterial color="#b9cde3" roughness={0.6} metalness={0.1} />
      </mesh>
      {[-14, 14].map((x) => (
        <group key={x} position={[x, 0, -4]}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.6, 0.9, 1.6, 8]} />
            <meshStandardMaterial color="#2a2638" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 2, 0]}>
            <sphereGeometry args={[0.55, 12, 10]} />
            <meshBasicMaterial color={[3, 0.6, 2.6]} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 2.4, 0]} color="#ff4fd8" intensity={30} distance={18} decay={1.6} />
        </group>
      ))}
      <Cannons sim={sim} />
    </group>
  );
}

function Keep() {
  const { root } = useFitted("mx_sg_keep", 44, "height", 0.3);
  return <primitive object={root} position={[0, 0, -26]} />;
}

/** Cổng đã vỡ chưa (đổi trạng thái React đúng một lần để gỡ va chạm) */
function useGateOpen(sim: SiegeSim) {
  const [open, setOpen] = useState(sim.gateOpen);
  useFrame(() => {
    if (!open && sim.gateOpen) setOpen(true);
  });
  return open;
}

/** Cổng thành: model cổng thép giữa hai tháp; vỡ thì đổ sập xuống, mở lối (gỡ va chạm) */
function Gate({ sim }: { sim: SiegeSim }) {
  const { root } = useFitted("mx_sg_gate", 15, "height", 0.25);
  const ref = useRef<THREE.Group>(null);
  const open = useGateOpen(sim);
  const fall = useRef(0);
  useFrame((_, dt) => {
    const o = ref.current;
    if (!o) return;
    fall.current = Math.min(1, fall.current + (sim.gateOpen ? dt * 0.8 : 0));
    // Đổ sụp: lún xuống, nghiêng về trước
    o.position.y = -fall.current * 9;
    o.rotation.x = fall.current * 0.35;
  });
  const p = ringAt(0);
  return (
    <group position={[p.x, 0, p.z]}>
      <group ref={ref}>
        <primitive object={root} scale={[1.5, 1, 1.4]} />
      </group>
      {!open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[SIEGE.wall.gateHalf + 1, 8, 3]} position={[0, 8, 0]} />
        </RigidBody>
      )}
    </group>
  );
}

/** Lõi Thành: vòng cổng năng lượng tím trước lâu đài, vòng giữ điểm sáng dần theo tiến độ */
function Core({ sim }: { sim: SiegeSim }) {
  const { root } = useFitted("mx_sg_core", 9, "longest", 0.6);
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const k = sim.coreHold / SIEGE.core.hold;
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = sim.phase === "core" ? 0.35 + Math.sin(t * 4) * 0.1 : 0.12;
      m.color.setRGB(0.4 + k * 2.6, 1.6 - k * 0.6, 3 - k * 1.5);
    }
    if (beam.current) {
      beam.current.visible = sim.phase === "core";
      beam.current.scale.set(1 + k, 1, 1 + k);
    }
  });
  const C = SIEGE.core;
  return (
    <group position={[C.x, 0, C.z]}>
      <primitive object={root} position={[0, 0, -2]} />
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
        <ringGeometry args={[C.r - 0.5, C.r, 64]} />
        <meshBasicMaterial transparent opacity={0.2} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={beam} position={[0, 40, 0]}>
        <cylinderGeometry args={[0.8, 2.2, 80, 16, 1, true]} />
        <meshBasicMaterial color={[2.4, 0.5, 2.6]} transparent opacity={0.35} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight position={[0, 4, 0]} color="#ff3fd8" intensity={60} distance={30} decay={1.6} />
    </group>
  );
}

/** Pháo trên tường thành (mục tiêu phá được), nòng xoay theo mục tiêu */
function Cannons({ sim }: { sim: SiegeSim }) {
  return (
    <Suspense fallback={null}>
      {SIEGE.cannons.map((c, i) => (
        <Cannon key={i} sim={sim} i={i} x={c.x} z={c.z} />
      ))}
    </Suspense>
  );
}

function Cannon({ sim, i, x, z }: { sim: SiegeSim; i: number; x: number; z: number }) {
  const { root } = useFitted("mx_sg_cannon", 6, "longest", 0.3);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const o = ref.current;
    const c = sim.obj("cannon", i);
    if (!o || !c) return;
    o.visible = c.alive;
    // Quay nòng ra phía cánh đồng (+z), lệch theo vị trí trên tường
    o.rotation.y = Math.atan2(x, z) - Math.PI / 2;
  });
  return (
    <group ref={ref} position={[x * 1.02, WALL_H + 0.2, z * 1.02]}>
      <primitive object={root} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Máy phát khiên + khiên năng lượng

function Generators({ sim }: { sim: SiegeSim }) {
  return (
    <Suspense fallback={null}>
      {SIEGE.generators.map((g, i) => (
        <Generator key={i} sim={sim} i={i} x={g.x} z={g.z} />
      ))}
    </Suspense>
  );
}

const SPIRE = new THREE.Vector3(0, 42, -26);

function Generator({ sim, i, x, z }: { sim: SiegeSim; i: number; x: number; z: number }) {
  const { root } = useFitted("mx_sg_generator", 11, "height", 0.35);
  const body = useRef<THREE.Group>(null);
  const orb = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const fallen = useRef(0);
  const beamGeo = useMemo(() => {
    const from = new THREE.Vector3(x, 10.2, z);
    const len = from.distanceTo(SPIRE);
    const g = new THREE.CylinderGeometry(0.25, 0.25, len, 8, 1, true);
    g.translate(0, len / 2, 0);
    return { g, from, dir: SPIRE.clone().sub(from).normalize() };
  }, [x, z]);
  useFrame(({ clock }, dt) => {
    const o = sim.obj("gen", i);
    if (!o) return;
    const t = clock.elapsedTime;
    const k = o.hp / o.maxHp;
    if (!o.alive) fallen.current = Math.min(1, fallen.current + dt * 0.6);
    if (body.current) {
      body.current.rotation.z = fallen.current * 0.5;
      body.current.position.y = -fallen.current * 2.5;
    }
    if (orb.current) {
      orb.current.visible = o.alive;
      const pulse = 1 + Math.sin(t * 5 + i) * 0.08;
      orb.current.scale.setScalar(pulse * (0.7 + k * 0.3));
      // Bị đánh: nhấp nháy đỏ
      const m = orb.current.material as THREE.MeshBasicMaterial;
      m.color.setRGB(0.6 + (1 - k) * 2.4 * (Math.sin(t * 20) > 0 ? 1 : 0.3), 2.4 * k + 0.4, 3.2 * k + 0.3);
    }
    if (beam.current) {
      beam.current.visible = o.alive;
      (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 9 + i) * 0.2;
    }
    if (light.current) light.current.intensity = o.alive ? 40 + Math.sin(t * 5) * 8 : 0;
  });
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamGeo.dir), [beamGeo]);
  return (
    <group>
      <group position={[x, 0, z]}>
        <group ref={body}>
          <primitive object={root} />
        </group>
        <mesh ref={orb} position={[0, 10.2, 0]}>
          <sphereGeometry args={[1.3, 20, 16]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
        <pointLight ref={light} position={[0, 10, 0]} color="#5fe8ff" distance={30} decay={1.5} />
        {/* Bệ tuyết dẫm nát quanh máy phát */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
          <circleGeometry args={[8, 32]} />
          <meshStandardMaterial color="#c3cfde" roughness={0.95} />
        </mesh>
      </group>
      <mesh ref={beam} geometry={beamGeo.g} position={beamGeo.from} quaternion={q}>
        <meshBasicMaterial color={[0.5, 2.6, 3.4]} transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[5, 2]} position={[x, 5, z]} />
      </RigidBody>
    </group>
  );
}

/** Khiên năng lượng: vòm bán cầu trong suốt, lưới lục giác chạy sáng, viền sáng ở rìa (fresnel). Sập: vỡ vụn, mờ dần */
const DOME_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const DOME_FRAG = /* glsl */ `
uniform float uTime; uniform float uFade; uniform vec3 uHit; uniform float uHitAt;
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
float hex(vec2 p) {
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
}
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float fr = pow(1.0 - abs(dot(V, normalize(vN))), 2.4);
  vec2 g = vec2(vUv.x * 90.0, vUv.y * 34.0);
  vec2 r = vec2(1.0, 1.7320508);
  vec2 a = mod(g, r) - r * 0.5;
  vec2 b = mod(g - r * 0.5, r) - r * 0.5;
  vec2 c = dot(a, a) < dot(b, b) ? a : b;
  float edge = smoothstep(0.42, 0.5, hex(c));
  float scan = smoothstep(0.0, 0.08, fract(vUv.y * 3.0 - uTime * 0.25)) * (1.0 - smoothstep(0.08, 0.2, fract(vUv.y * 3.0 - uTime * 0.25)));
  float hit = max(0.0, 1.0 - distance(vW, uHit) / 14.0) * max(0.0, 1.0 - (uTime - uHitAt) * 1.5);
  vec3 col = vec3(0.35, 0.85, 1.0) * (0.25 + edge * 0.9 + scan * 0.8) + vec3(0.6, 0.95, 1.0) * fr * 1.6 + vec3(1.0, 0.9, 1.0) * hit * 2.5;
  float alpha = (0.06 + fr * 0.55 + edge * 0.16 + scan * 0.12 + hit * 0.6) * uFade;
  gl_FragColor = vec4(col, alpha);
}`;

function Dome({ sim }: { sim: SiegeSim }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DOME_VERT,
        fragmentShader: DOME_FRAG,
        uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uHit: { value: new THREE.Vector3(0, -999, 0) }, uHitAt: { value: -9 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const ref = useRef<THREE.Mesh>(null);
  const fade = useRef(1);
  const lastHit = useRef(0);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    mat.uniforms.uTime.value = t;
    const up = sim.shieldUp;
    fade.current = up ? Math.min(1, fade.current + dt) : Math.max(0, fade.current - dt * 0.5);
    mat.uniforms.uFade.value = fade.current;
    if (ref.current) {
      ref.current.visible = fade.current > 0.01;
      // Sập: phình nhẹ ra rồi tan
      ref.current.scale.setScalar(1 + (1 - fade.current) * 0.15);
    }
    // Đạn đập vào khiên: gợn sáng ở chỗ trúng (lấy một tia đạn Hunter gần nhất chạm vòm)
    for (let i = sim.events.length - 1; i >= 0 && i > sim.events.length - 40; i--) {
      const e = sim.events[i];
      if (e.kind !== "tracer" || e.side !== 0 || e.at <= lastHit.current) continue;
      const r = Math.hypot(e.x1, e.z1);
      if (up && Math.abs(r - SIEGE.dome.r) < 14) {
        lastHit.current = e.at;
        const k = SIEGE.dome.r / (r || 1);
        mat.uniforms.uHit.value.set(O.x + e.x1 * k, 2 + Math.random() * 10, O.z + e.z1 * k);
        mat.uniforms.uHitAt.value = t;
        break;
      }
    }
  });
  return (
    <mesh ref={ref} material={mat}>
      <sphereGeometry args={[SIEGE.dome.r, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Trang trí: rừng thông, đá băng, trại quân Hunter, xe bọc thép

function Dressing() {
  const data = useMemo(() => {
    const r = rng(2024);
    const pines: Placed[] = [];
    const rocks: Placed[] = [];
    const clear = (x: number, z: number) => {
      if (Math.hypot(x, z) < SIEGE.dome.r + 6) return false;
      if (z > SIEGE.moat.z0 - 6 && z < SIEGE.moat.z1 + 6) return false;
      for (const g of SIEGE.generators) if (Math.hypot(x - g.x, z - g.z) < 14) return false;
      if (Math.abs(x) < 40 && z > 160) return false;
      return true;
    };
    // Rừng thông dày hai bên mép cánh đồng và sau lâu đài
    for (let i = 0; i < 420 && pines.length < 190; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const zone = r();
      const x = zone < 0.75 ? side * (120 + r() * 50) : (r() - 0.5) * 300;
      const z = zone < 0.75 ? -120 + r() * 360 : -95 - r() * 40;
      if (!clear(x, z)) continue;
      const h = 10 + r() * 9;
      pines.push({ x, y: 0, z, w: h * 0.6, h, d: h * 0.6, rot: r() * 6.28 });
    }
    // Đá băng rải trên cánh đồng làm chỗ nấp (tránh ba làn hành quân)
    for (let i = 0; i < 300 && rocks.length < 70; i++) {
      const x = (r() - 0.5) * 300;
      const z = -110 + r() * 340;
      if (!clear(x, z)) continue;
      if (SIEGE.moat.bridges.some((b) => Math.abs(x - b) < 9) && z > 60 && z < 180) continue;
      const s = 2 + r() * 4.5;
      rocks.push({ x, y: -0.3, z, w: s * 1.6, h: s * 0.6, d: s * 1.2, rot: r() * 6.28 });
    }
    // Băng vỡ dọc bờ hào
    for (let i = 0; i < 40; i++) {
      const x = (r() - 0.5) * 320;
      if (SIEGE.moat.bridges.some((b) => Math.abs(x - b) < 7)) continue;
      const z = r() < 0.5 ? SIEGE.moat.z0 - 1 : SIEGE.moat.z1 + 1;
      const s = 1.5 + r() * 2.5;
      rocks.push({ x, y: -0.4, z, w: s * 1.6, h: s * 0.6, d: s * 1.2, rot: r() * 6.28 });
    }
    return { pines, rocks };
  }, []);
  return (
    <Suspense fallback={null}>
      <ModelSet name="mx_sg_pine" items={data.pines} selfLit={0.15} />
      <ModelSet name="mx_sg_icerock" items={data.rocks} selfLit={0.35} />
      <Camp />
    </Suspense>
  );
}

function Prop({ name, size, at, rot = 0, by = "height", lit = 0.25 }: { name: ExtraModel; size: number; at: [number, number, number]; rot?: number; by?: "height" | "longest"; lit?: number }) {
  const { root } = useFitted(name, size, by, lit);
  const obj = useMemo(() => root.clone(true), [root]);
  return <primitive object={obj} position={at} rotation-y={rot} />;
}

/** Trại quân Hunter cuối cánh đồng: lều chỉ huy, cờ xanh, xe bọc thép chờ xuất kích, đèn pha */
function Camp() {
  const z = SIEGE.camp.z;
  const tents: [number, number, number][] = [
    [-34, z + 22, 0.4],
    [-18, z + 30, 0.1],
    [0, z + 34, 0],
    [18, z + 30, -0.1],
    [34, z + 22, -0.4],
    [-50, z + 12, 0.8],
    [50, z + 12, -0.8],
  ];
  return (
    <group>
      {tents.map(([x, zz, r], i) => (
        <Prop key={i} name="mx_sg_tent" size={7} by="longest" at={[x, 0, zz]} rot={Math.PI + r} />
      ))}
      {[-24, 24, -60, 60].map((x, i) => (
        <Prop key={`v${i}`} name="mx_sg_barricade" size={9} by="longest" at={[x, 0, z - 6 + (i > 1 ? 14 : 0)]} rot={Math.PI + (i % 2 ? -0.2 : 0.2)} />
      ))}
      {[-40, -12, 12, 40].map((x) => (
        <group key={x} position={[x, 0, z + 2]}>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 8, 6]} />
            <meshStandardMaterial color="#3a4250" metalness={0.7} />
          </mesh>
          <mesh position={[1.1, 6.6, 0]}>
            <planeGeometry args={[2.2, 1.4]} />
            <meshStandardMaterial color="#05d9e8" emissive="#05d9e8" emissiveIntensity={1.6} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, 8, z + 18]} color="#9fe8ff" intensity={80} distance={60} decay={1.4} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tuyết rơi quanh camera

function Snowfall() {
  const camera = useThree((s) => s.camera);
  const N = 3200;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3);
    const r = rng(77);
    for (let i = 0; i < N; i++) p.set([(r() - 0.5) * 120, r() * 50, (r() - 0.5) * 120], i * 3);
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const c = camera.position;
    dt = Math.min(dt, 0.05);
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      a[k + 1] -= dt * (2.2 + (i % 7) * 0.25);
      a[k] += dt * (1.6 + Math.sin(i + a[k + 1] * 0.2) * 0.8);
      a[k + 2] += dt * Math.cos(i * 1.7) * 0.6;
      // Giữ hạt tuyết trong khối 120 m quanh camera
      if (a[k + 1] < c.y - 20) a[k + 1] += 50;
      if (a[k] - c.x > 60) a[k] -= 120;
      if (a[k] - c.x < -60) a[k] += 120;
      if (a[k + 2] - c.z > 60) a[k + 2] -= 120;
      if (a[k + 2] - c.z < -60) a[k + 2] += 120;
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={0.16} transparent opacity={0.85} depthWrite={false} sizeAttenuation />
    </points>
  );
}

// ---------------------------------------------------------------------------

/**
 * Mặt đất vật lý của khu giao chiến (mặt trên ở y = 0) và vách biên. Không phụ thuộc texture/model nào,
 * nên gắn ngoài Suspense: có ngay khi vào trận, nhân vật không rơi xuyên đất lúc bản đồ còn đang tải.
 */
export function SiegeGround() {
  const sim = useSiege((s) => s.sim);
  if (!sim) return null;
  return (
    <RigidBody type="fixed" colliders={false} position={[O.x, 0, O.z]}>
      <CuboidCollider args={[200, 2, 210]} position={[0, -2, 50]} />
      {/* Ranh giới khu chơi: vách tuyết vô hình */}
      <CuboidCollider args={[2, 20, 210]} position={[-172, 18, 50]} />
      <CuboidCollider args={[2, 20, 210]} position={[172, 18, 50]} />
      <CuboidCollider args={[175, 20, 2]} position={[0, 18, 252]} />
      <CuboidCollider args={[175, 20, 2]} position={[0, 18, -140]} />
    </RigidBody>
  );
}

/** Toàn bộ bản đồ Công thành (gắn trong <Physics> của Hub khi location = "siege") */
export function SiegeWorld() {
  const sim = useSiege((s) => s.sim);
  if (!sim) return null;
  return (
    <>
      <SiegeAtmos />
      <SiegeDriver sim={sim} />
      <group position={[O.x, 0, O.z]}>
        <Snowfield />
        <Moat />
        <Castle sim={sim} />
        <Generators sim={sim} />
        <Dome sim={sim} />
        <Dressing />
        <Crowd sim={sim} />
        <SiegeFx sim={sim} />
        <Tanks sim={sim} />
        <SiegeCombat sim={sim} />
      </group>
      <Snowfall />
    </>
  );
}

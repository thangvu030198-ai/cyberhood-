// Đua kart camera sau lưng (học từ Chocobo Racing PS1) trên đường đua đêm giữa Neon City: mặt nhựa ướt
// có dải neon hai mép, rào chắn gạch chéo phát sáng, cổng vòm neon bắc qua đường, cao ốc bao quanh trường đua,
// trời đêm có sao và quầng sáng thành phố. Xe là xe Meshy của thành phố; HUD: thời gian, vòng, tốc độ, hạng, bản đồ.

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { DIFF_MODS, useDifficulty } from "../game/difficulty";
import * as THREE from "three";
import { create } from "zustand";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { extraModel, playSfx, type ExtraModel } from "../game/assets";
import { useGame } from "../game/store";
import { trackMission } from "../game/missionStore";
import { handles } from "../game/refs";
import { MISSION_GATE } from "../game/config";
import { KART, KartSim, type KartInput } from "./kart";
import { bindLevelKeys, levelInput } from "./levelInput";
import { ModeTouchPad, isTouchUi } from "./LevelHud";
import { PunchGrade } from "./retroEffects";
import { DriftFx, NitroFlames, SpeedLines, driftYaw, kartShake } from "./kartFx";
import { Quiet } from "./LevelScene";
import { asphaltTexture } from "./terrainSkin";

/** Thưởng theo thứ hạng về đích (CRED) */
export const KART_REWARD = [120, 80, 55, 35, 20, 10];

type KartState = { sim: KartSim | null; rewarded: boolean; start: () => void; leave: () => void };

export const useKart = create<KartState>((set) => ({
  sim: null,
  rewarded: false,
  start: () => {
    document.exitPointerLock?.();
    const sim = new KartSim();
    sim.aiMul = DIFF_MODS[useDifficulty.getState().level].kartAi;
    set({ sim, rewarded: false });
    useGame.getState().setLocation("level");
  },
  leave: () => {
    set({ sim: null });
    const body = handles.player?.body;
    if (body) {
      body.setTranslation({ x: MISSION_GATE.x, y: 1.3, z: MISSION_GATE.z + 4 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    useGame.getState().setLocation("city");
  },
}));

/** W/↑ ga, S/↓ phanh, A/D lái, giữ Space drift (nhả ra được turbo), J/K dùng vật phẩm */
function kartInput(): KartInput {
  const i = levelInput.state();
  return { gas: i.up || i.jump, brake: i.down, left: i.left, right: i.right, item: i.shoot || i.dash, drift: i.jump };
}

/** Xe của 6 tay đua: AI dùng xe phố, người chơi dùng siêu xe Velocity */
const KART_MODELS: ExtraModel[] = ["mx_car_sports", "mx_car_muscle", "mx_car_taxi", "mx_veh_buggy", "mx_car_police", "mx_velocity_car"];

export function KartCanvas() {
  const sim = useKart((s) => s.sim);
  const quality = useGame((s) => s.quality);
  if (!sim) return null;
  return (
    <Canvas
      className="level-canvas"
      dpr={quality === "high" ? [1, 1.25] : 1}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 62, near: 0.3, far: 900, position: [0, 4, -8] }}
    >
      <color attach="background" args={["#07041a"]} />
      <fog attach="fog" args={["#1b0d33", 70, 420]} />
      <KartDriver sim={sim} />
      <ChaseCamera sim={sim} />
      <hemisphereLight args={["#8a9cff", "#1a0a24", 0.9]} />
      <directionalLight position={[60, 120, 40]} intensity={1.3} color="#c8d4ff" />
      <directionalLight position={[-80, 30, -60]} intensity={1.2} color="#ff4fd8" />
      <NightSky />
      <Scenery sim={sim} />
      <Road sim={sim} />
      <Pads sim={sim} />
      {sim.karts.map((k) => (
        <Quiet key={k.id}>
          <Suspense fallback={null}>
            <KartCar sim={sim} id={k.id} model={KART_MODELS[k.id]} />
          </Suspense>
        </Quiet>
      ))}
      <Missiles sim={sim} />
      {sim.karts.map((k) => (
        <NitroFlames key={`n${k.id}`} sim={sim} id={k.id} />
      ))}
      <DriftFx sim={sim} />
      <SpeedLines sim={sim} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1} luminanceSmoothing={0.2} />
        <PunchGrade />
        <Vignette eskil={false} offset={0.35} darkness={0.4} />
      </EffectComposer>
    </Canvas>
  );
}

function KartDriver({ sim }: { sim: KartSim }) {
  const seen = useRef(0);
  useFrame((_, dt) => {
    if (!levelInput.paused) sim.update(Math.min(dt, 0.1), kartInput());
    for (let i = seen.current; i < sim.events.length; i++) {
      const e = sim.events[i];
      if (e.kart !== 5 && e.kind !== "hit") continue;
      if (e.kart === 5) kartShake.amount = Math.max(kartShake.amount, e.kind === "hit" ? 0.6 : e.kind === "boost" ? 0.3 : e.kind === "wall" ? 0.18 : 0);
      if (e.kind === "boost") playSfx("repeater", 0.5);
      else if (e.kind === "item" || e.kind === "lap") playSfx("pickup", 0.7);
      else if (e.kind === "hit") playSfx("enemyDestroy", e.kart === 5 ? 0.8 : 0.3);
      else if (e.kind === "finish") playSfx("pickup", 1);
    }
    seen.current = sim.events.length;
    // Danh sách sự kiện ngắn: bỏ cái cũ
    if (sim.events.length > 200) {
      sim.events.splice(0, 100);
      seen.current = sim.events.length;
    }
  });
  return null;
}

/** Camera sau lưng, thấp, hơi trễ khi vào cua; rung nhẹ khi tăng tốc */
function ChaseCamera({ sim }: { sim: KartSim }) {
  const camera = useThree((s) => s.camera);
  const pos = useRef(new THREE.Vector3());
  const first = useRef(true);
  const roll = useRef(0);
  useFrame((_, dt) => {
    const k = sim.player;
    const back = sim.track.at(k.s - 7.5, k.d * 0.85);
    const ahead = sim.track.at(k.s + 9, k.d * 0.6);
    const boosting = sim.time < k.boostUntil;
    const target = new THREE.Vector3(back.x, 3.1 + (boosting ? 0.1 * Math.sin(sim.time * 60) : 0), back.z);
    if (first.current) {
      pos.current.copy(target);
      first.current = false;
    }
    pos.current.lerp(target, 1 - Math.exp(-8 * Math.min(dt, 0.1)));
    camera.position.copy(pos.current);
    // Rung: turbo / va vách / trúng tên lửa
    kartShake.amount = Math.max(0, kartShake.amount - Math.min(dt, 0.1) * 1.6);
    const sh = kartShake.amount * kartShake.amount;
    const t = sim.time;
    camera.position.x += Math.sin(t * 71) * sh * 0.4;
    camera.position.y += Math.sin(t * 53) * sh * 0.3;
    camera.lookAt(ahead.x, 1.1, ahead.z);
    // Drift: nghiêng camera nhẹ theo hướng văng đuôi
    roll.current = THREE.MathUtils.damp(roll.current, -k.drift * 0.05, 6, Math.min(dt, 0.1));
    camera.rotateZ(roll.current);
    const cam = camera as THREE.PerspectiveCamera;
    // FOV giãn theo tốc độ, turbo giãn thêm (cảm giác lao vút)
    const fov = 58 + Math.min(1, Math.max(0, k.v) / KART.maxSpeed) * 8 + (boosting ? 12 : 0);
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov += (fov - cam.fov) * 0.12;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/** Dải đường nhựa + lề sọc + vạch đích, dựng từ các điểm mẫu của đường đua */
function Road({ sim }: { sim: KartSim }) {
  const { road, curbs, edges, start, checker } = useMemo(() => {
    const t = sim.track;
    const n = t.pts.length;
    const W = KART.halfWidth + 1.2;
    const strip = (from: number, to: number, y: number) => {
      const pos: number[] = [];
      const uv: number[] = [];
      for (let i = 0; i <= n; i++) {
        const s = i * t.step;
        const a = t.at(s, from);
        const b = t.at(s, to);
        pos.push(a.x, y, a.z, b.x, y, b.z);
        uv.push(0, s / 6, 1, s / 6);
      }
      const idx: number[] = [];
      for (let i = 0; i < n; i++) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const asphalt = (() => {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const g = c.getContext("2d")!;
      // Nhựa ướt tối, vạch giữa đứt khúc xanh ngọc phát sáng
      g.fillStyle = "#1d1c26";
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.12)";
        g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
      }
      g.fillStyle = "#38f6ff";
      g.fillRect(62, 0, 4, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const curbTex = (() => {
      const c = document.createElement("canvas");
      // Rào gạch chéo neon hồng / đen
      c.width = 32;
      c.height = 32;
      const g = c.getContext("2d")!;
      g.fillStyle = "#0b0612";
      g.fillRect(0, 0, 32, 32);
      g.fillStyle = "#ff2fd0";
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(12, 0);
      g.lineTo(32, 20);
      g.lineTo(32, 32);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(0, 20);
      g.lineTo(12, 32);
      g.lineTo(0, 32);
      g.closePath();
      g.fill();
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const road = { geo: strip(-W, W, 0.02), map: asphalt };
    const curbs = [strip(-W - 1, -W, 0.05), strip(W, W + 1, 0.05)].map((geo) => ({ geo, map: curbTex }));
    const edges = [strip(-W - 0.12, -W + 0.12, 0.08), strip(W - 0.12, W + 0.12, 0.08)];
    const s0 = t.at(0, 0);
    // Vạch xuất phát ô cờ
    const cv = document.createElement("canvas");
    cv.width = 128;
    cv.height = 16;
    const cg = cv.getContext("2d")!;
    for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) {
      cg.fillStyle = (x + y) % 2 ? "#0c0c12" : "#d8d8e0";
      cg.fillRect(x * 8, y * 8, 8, 8);
    }
    const checker = new THREE.CanvasTexture(cv);
    checker.magFilter = THREE.NearestFilter;
    checker.colorSpace = THREE.SRGBColorSpace;
    return { road, curbs, edges, start: s0, checker };
  }, [sim]);
  return (
    <group>
      <mesh geometry={road.geo}>
        <meshStandardMaterial map={road.map} emissiveMap={road.map} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.32} metalness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {curbs.map((c, i) => (
        <mesh key={i} geometry={c.geo}>
          <meshStandardMaterial map={c.map} emissiveMap={c.map} emissive="#ffffff" emissiveIntensity={1.4} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Dải neon chạy dọc hai mép đường */}
      {edges.map((geo, i) => (
        <mesh key={`e${i}`} geometry={geo}>
          <meshBasicMaterial color={i ? [0.4, 2.6, 3.2] : [3.2, 0.5, 2.4]} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Vạch xuất phát ca-rô */}
      <mesh position={[start.x, 0.06, start.z]} rotation={[-Math.PI / 2, 0, -start.yaw]}>
        <planeGeometry args={[(KART.halfWidth + 1.2) * 2, 1.4]} />
        <meshBasicMaterial map={checker} color={[1.2, 1.2, 1.3]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Trời đêm: vòm sao, quầng sáng thành phố tím hồng ở chân trời (không bị sương che) */
function NightSky() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const g = c.getContext("2d")!;
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, "#020108");
    gr.addColorStop(0.55, "#0a0624");
    gr.addColorStop(0.78, "#3a0f4a");
    gr.addColorStop(0.9, "#a0286a");
    gr.addColorStop(1, "#ff7a3a");
    g.fillStyle = gr;
    g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 900; i++) {
      const y = Math.random() * 300;
      g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.8})`;
      g.fillRect(Math.random() * 1024, y, Math.random() < 0.08 ? 2 : 1, Math.random() < 0.08 ? 2 : 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh>
      <sphereGeometry args={[700, 32, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

// Cao ốc bao quanh trường đua (model thành phố của sảnh)
const KART_TOWERS: ExtraModel[] = ["mx_bld_skyscraper", "mx_bld_megacorp", "mx_bld_tower_round", "mx_bld_apartment", "mx_bld_capsule_hotel", "mx_bld_pagoda", "mx_bld_hotel"];

function Tower({ name, x, z, h, rot }: { name: ExtraModel; x: number; z: number; h: number; rot: number }) {
  const gltf = use(extraModel(name));
  const obj = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x, -box.min.y, -c.z);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.map) {
        mat.emissiveMap = mat.map;
        mat.emissive = new THREE.Color("#ffffff");
        mat.emissiveIntensity = 0.75;
      }
      m.material = mat;
    });
    const g = new THREE.Group();
    g.add(s);
    g.scale.setScalar(h / size.y);
    return g;
  }, [gltf, h]);
  return <primitive object={obj} position={[x, 0, z]} rotation-y={rot} />;
}

/** Cổng vòm neon bắc qua đường */
function NeonArch({ x, z, yaw, width }: { x: number; z: number; yaw: number; width: number }) {
  const gltf = use(extraModel("mx_prop_neon_arch"));
  const obj = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x, -box.min.y, -c.z);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.map) {
        mat.emissiveMap = mat.map;
        mat.emissive = new THREE.Color("#ffffff");
        mat.emissiveIntensity = 1;
      }
      m.material = mat;
    });
    const g = new THREE.Group();
    g.add(s);
    const k = width / Math.max(size.x, size.z);
    g.scale.set(k, k * 1.1, k);
    return g;
  }, [gltf, width]);
  return <primitive object={obj} position={[x, 0, z]} rotation-y={yaw} />;
}

function Scenery({ sim }: { sim: KartSim }) {
  const half = KART.halfWidth + 2.2;
  const data = useMemo(() => {
    let seed = 91;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const t = sim.track;
    const arches: { x: number; z: number; yaw: number }[] = [];
    for (const f of [0.02, 0.25, 0.5, 0.75]) arches.push(t.at(t.length * f, 0));
    // Cọc tiêu phát sáng dọc hai bên
    const posts: { x: number; z: number; c: number }[] = [];
    for (let s = 5; s < t.length; s += 14)
      for (const side of [-1, 1]) {
        const p = t.at(s, side * (KART.halfWidth + 2.8));
        posts.push({ x: p.x, z: p.z, c: side });
      }
    // Cao ốc: rải ngoài đường đua, không quá gần mặt đường
    const towers: { name: ExtraModel; x: number; z: number; h: number; rot: number }[] = [];
    const near = (x: number, z: number, d: number) => {
      for (let s = 0; s < t.length; s += 6) {
        const p = t.at(s, 0);
        if (Math.hypot(p.x - x, p.z - z) < d) return true;
      }
      return false;
    };
    for (let i = 0; i < 70 && towers.length < 34; i++) {
      const a = r() * Math.PI * 2;
      const rad = 60 + r() * 260;
      const x = 30 + Math.cos(a) * rad;
      const z = 70 + Math.sin(a) * rad;
      if (near(x, z, 26)) continue;
      towers.push({ name: KART_TOWERS[Math.floor(r() * KART_TOWERS.length)], x, z, h: 24 + r() * 46, rot: r() * 6.28 });
    }
    return { arches, posts, towers };
  }, [sim]);
  const postRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const floor = useMemo(() => {
    const t = asphaltTexture();
    t.repeat.set(60, 60);
    return t;
  }, []);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    data.posts.forEach((p, i) => {
      postRef.current?.setMatrixAt(i, m.makeTranslation(p.x, 0.6, p.z));
      capRef.current?.setMatrixAt(i, m.makeTranslation(p.x, 1.28, p.z));
      capRef.current?.setColorAt(i, p.c < 0 ? c.setRGB(3.2, 0.5, 2.4) : c.setRGB(0.4, 2.6, 3.2));
    });
    for (const r of [postRef.current, capRef.current]) {
      if (!r) continue;
      r.instanceMatrix.needsUpdate = true;
      if (r.instanceColor) r.instanceColor.needsUpdate = true;
    }
  }, [data]);
  return (
    <group>
      {/* Nền nhựa ướt quanh trường đua */}
      <mesh rotation-x={-Math.PI / 2} position={[30, -0.01, 70]}>
        <circleGeometry args={[420, 48]} />
        <meshStandardMaterial map={floor} color="#5a5870" roughness={0.4} metalness={0.3} />
      </mesh>
      {data.towers.map((tw, i) => (
        <Suspense key={i} fallback={null}>
          <Tower {...tw} />
        </Suspense>
      ))}
      {data.arches.map((g, i) => (
        <Suspense key={`a${i}`} fallback={null}>
          <NeonArch x={g.x} z={g.z} yaw={g.yaw} width={half * 2 + 3} />
        </Suspense>
      ))}
      <instancedMesh ref={postRef} args={[undefined, undefined, data.posts.length]}>
        <cylinderGeometry args={[0.14, 0.2, 1.2, 8]} />
        <meshStandardMaterial color="#1a1a24" metalness={0.7} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[undefined, undefined, data.posts.length]}>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Tấm tăng tốc (mũi tên cam) và hộp vật phẩm (khối cầu vồng xoay) */
function Pads({ sim }: { sim: KartSim }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    sim.pads.forEach((p, i) => {
      const o = g.children[i];
      if (!o) return;
      const w = sim.track.at(p.s, p.d);
      o.position.set(w.x, p.kind === "boost" ? 0.07 : 1 + Math.sin(clock.elapsedTime * 3 + i) * 0.15, w.z);
      o.rotation.y = p.kind === "boost" ? w.yaw : clock.elapsedTime * 1.5;
      o.visible = p.kind === "boost" || sim.time >= p.takenUntil;
    });
  });
  return (
    <group ref={group}>
      {sim.pads.map((p, i) =>
        p.kind === "boost" ? (
          <mesh key={i} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[3.2, 3]} />
            <meshBasicMaterial color={[3, 1.2, 0.2]} toneMapped={false} transparent opacity={0.85} />
          </mesh>
        ) : (
          <mesh key={i}>
            <boxGeometry args={[0.9, 0.9, 0.9]} />
            <meshStandardMaterial color="#7ad6ff" emissive="#ff5fd0" emissiveIntensity={0.8} transparent opacity={0.85} />
          </mesh>
        ),
      )}
    </group>
  );
}

function KartCar({ sim, id, model }: { sim: KartSim; id: number; model: ExtraModel }) {
  const gltf = use(extraModel(model));
  const obj = useMemo(() => {
    const s = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const k = 3.4 / Math.max(size.x, size.y, size.z);
    s.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    // Đầu xe Meshy hướng -X: quay để hướng chạy +Z của đường đua
    const g = new THREE.Group();
    s.rotation.y = Math.PI / 2;
    g.add(s);
    return g;
  }, [gltf]);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const k = sim.karts[id];
    const w = sim.track.at(k.s, k.d);
    const o = ref.current;
    if (!o) return;
    o.position.set(w.x, 0.05, w.z);
    const spin = sim.time < k.spinUntil ? (k.spinUntil - sim.time) * 14 : 0;
    o.rotation.y = w.yaw + spin + driftYaw(sim, id);
    // Thân xe nghiêng ra ngoài khi drift
    o.rotation.z = THREE.MathUtils.damp(o.rotation.z, k.drift * 0.06, 8, 1 / 60);
    // Nhún nhẹ theo tốc độ
    o.position.y = 0.05 + Math.abs(Math.sin(sim.time * 18 + id)) * 0.03 * Math.min(1, k.v / 20);
  });
  return (
    <group ref={ref}>
      <primitive object={obj} />
    </group>
  );
}

function Missiles({ sim }: { sim: KartSim }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((o, i) => {
      const m = sim.missiles[i];
      o.visible = !!m;
      if (!m) return;
      const w = sim.track.at(m.s, m.d);
      o.position.set(w.x, 0.8, w.z);
      o.rotation.y = w.yaw;
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} visible={false} rotation-x={Math.PI / 2}>
          <capsuleGeometry args={[0.2, 0.8, 4, 8]} />
          <meshBasicMaterial color={[3, 0.6, 0.3]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th"];

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const c = Math.floor((t * 100) % 100);
  return `${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"${String(c).padStart(2, "0")}`;
}

export function KartHud() {
  const sim = useKart((s) => s.sim);
  const leave = useKart((s) => s.leave);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const st = useKart.getState();
      if (st.sim?.status === "finished" && !st.rewarded) {
        const r = st.sim.rank(st.sim.player);
        useGame.getState().addCred(KART_REWARD[r - 1]);
        if (r === 1) useGame.getState().addItem("chestKey", 1);
        trackMission("clear");
        useKart.setState({ rewarded: true });
      }
      tick((n) => n + 1);
    }, 50);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const unbind = bindLevelKeys(() => useKart.getState().leave());
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" && useKart.getState().sim?.status === "finished") useKart.getState().leave();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unbind();
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  // Bản đồ đường đua thu nhỏ (SVG)
  const map = useMemo(() => {
    if (!sim) return null;
    const t = sim.track;
    const xs = t.pts.map((p) => p.x);
    const zs = t.pts.map((p) => p.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const sc = 110 / Math.max(maxX - minX, maxZ - minZ);
    const px = (x: number) => 8 + (x - minX) * sc;
    const pz = (z: number) => 8 + (maxZ - z) * sc;
    const d = t.pts.filter((_, i) => i % 4 === 0).map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)},${pz(p.z).toFixed(1)}`).join(" ") + "Z";
    return { d, px, pz };
  }, [sim]);
  if (!sim || !map) return null;
  const k = sim.player;
  const rank = sim.rank(k);
  const raceTime = Math.max(0, (k.finishedAt ?? sim.time) - KART.introTime);
  const count = Math.ceil(KART.introTime - sim.time);
  return (
    <div className="lv kart">
      <div className="kart__time">
        <b>{fmt(raceTime)}</b>
        <span>
          LAP {Math.min(KART.laps, Math.max(1, k.lap))}/{KART.laps}
        </span>
        <span>{Math.round(Math.abs(k.v) * 3.6)} km/h</span>
      </div>
      <div className="kart__rank">{ORD[rank]}</div>
      <div className="kart__item">{k.item === "turbo" ? "TURBO" : k.item === "missile" ? "TÊN LỬA" : "—"}</div>
      <svg className="kart__map" viewBox="0 0 126 126">
        <path d={map.d} fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
        {sim.karts.map((c) => {
          const w = sim.track.at(c.s, 0);
          return <circle key={c.id} cx={map.px(w.x)} cy={map.pz(w.z)} r={c.id === 5 ? 4.5 : 3} fill={c.id === 5 ? "#ff3b3b" : "#2b6cff"} stroke="#000" strokeWidth="1" />;
        })}
      </svg>
      {sim.status === "intro" && <div className="lv__banner lv__banner--ready">{count > 0 ? count : "GO!"}</div>}
      {sim.status === "race" && sim.time - KART.introTime < 0.8 && <div className="lv__banner">GO!</div>}
      {sim.status === "finished" && (
        <div className="lv__panel">
          <p className="lv__panel-tag">VỀ ĐÍCH · HẠNG {rank}</p>
          <p>
            Thời gian {fmt(raceTime)} · +{KART_REWARD[rank - 1]} CRED{rank === 1 ? " · +1 Chìa rương" : ""}
          </p>
          <button className="lv__btn" onClick={leave}>
            Về thành phố <kbd>Enter</kbd>
          </button>
          <button className="lv__btn lv__btn--ghost" onClick={() => useKart.getState().start()}>
            Đua lại
          </button>
        </div>
      )}
      <ModeTouchPad
        left={[
          { k: "left", label: "◀" },
          { k: "right", label: "▶" },
        ]}
        right={[
          { k: "down", label: "PHANH" },
          { k: "shoot", label: "VẬT PHẨM" },
          { k: "jump", label: "DRIFT" },
          { k: "up", label: "GA", big: true },
        ]}
        onExit={leave}
      />
      <div className="lv__help" hidden={isTouchUi()}>
        <kbd>W</kbd> ga · <kbd>S</kbd> phanh · <kbd>A</kbd>
        <kbd>D</kbd> lái · giữ <kbd>Space</kbd> + lái = drift (tia lửa xanh → cam, nhả ra được turbo) · <kbd>J</kbd> dùng vật phẩm (turbo / tên lửa) · tấm cam = tăng tốc · <kbd>Esc</kbd> thoát
      </div>
    </div>
  );
}

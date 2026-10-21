// Đua kart camera sau lưng (học từ Chocobo Racing PS1): đường nhựa có lề sọc đỏ trắng, cổng thép gỉ đỏ,
// cọc tiêu, đồi cỏ, trời xanh mây trắng. Xe là xe Meshy của thành phố; HUD: thời gian, vòng, tốc độ, hạng, bản đồ.

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
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
import { RetroGrade } from "./retroEffects";
import { Quiet } from "./LevelScene";

/** Thưởng theo thứ hạng về đích (CRED) */
export const KART_REWARD = [120, 80, 55, 35, 20, 10];

type KartState = { sim: KartSim | null; rewarded: boolean; start: () => void; leave: () => void };

export const useKart = create<KartState>((set) => ({
  sim: null,
  rewarded: false,
  start: () => {
    document.exitPointerLock?.();
    set({ sim: new KartSim(), rewarded: false });
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

/** W/↑ ga, S/↓ phanh, A/D lái, J dùng vật phẩm */
function kartInput(): KartInput {
  const i = levelInput.state();
  return { gas: i.up || i.jump, brake: i.down, left: i.left, right: i.right, item: i.shoot || i.dash };
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
      <color attach="background" args={["#8fc4ff"]} />
      <fog attach="fog" args={["#c9e2ff", 80, 420]} />
      <KartDriver sim={sim} />
      <ChaseCamera sim={sim} />
      <hemisphereLight args={["#ffffff", "#5f8f3a", 1.7]} />
      <directionalLight position={[60, 120, 40]} intensity={2.4} color="#fff4e0" />
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
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1} luminanceSmoothing={0.2} />
        <RetroGrade strength={0.45} />
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
    camera.lookAt(ahead.x, 1.1, ahead.z);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = boosting ? 72 : 62;
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov += (fov - cam.fov) * 0.1;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/** Dải đường nhựa + lề sọc + vạch đích, dựng từ các điểm mẫu của đường đua */
function Road({ sim }: { sim: KartSim }) {
  const { road, curbs, start } = useMemo(() => {
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
      g.fillStyle = "#6f7378";
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
        g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
      }
      g.fillStyle = "#e9e3c8";
      g.fillRect(61, 0, 6, 64); // vạch giữa đứt khúc
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const curbTex = (() => {
      const c = document.createElement("canvas");
      c.width = 8;
      c.height = 16;
      const g = c.getContext("2d")!;
      g.fillStyle = "#d8262a";
      g.fillRect(0, 0, 8, 8);
      g.fillStyle = "#f4f4f4";
      g.fillRect(0, 8, 8, 8);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const road = { geo: strip(-W, W, 0.02), map: asphalt };
    const curbs = [strip(-W - 1, -W, 0.05), strip(W, W + 1, 0.05)].map((geo) => ({ geo, map: curbTex }));
    const s0 = t.at(0, 0);
    return { road, curbs, start: s0 };
  }, [sim]);
  return (
    <group>
      <mesh geometry={road.geo}>
        <meshStandardMaterial map={road.map} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      {curbs.map((c, i) => (
        <mesh key={i} geometry={c.geo}>
          <meshStandardMaterial map={c.map} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Vạch xuất phát ca-rô */}
      <mesh position={[start.x, 0.06, start.z]} rotation={[-Math.PI / 2, 0, -start.yaw]}>
        <planeGeometry args={[(KART.halfWidth + 1.2) * 2, 1.4]} />
        <meshBasicMaterial color="#f2f2f2" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Đồi cỏ, cổng thép gỉ đỏ bắc qua đường, cọc tiêu đen vàng, hàng rào trắng */
function Scenery({ sim }: { sim: KartSim }) {
  const gantries = useMemo(() => {
    const out: { x: number; z: number; yaw: number }[] = [];
    for (const f of [0.02, 0.1, 0.4, 0.66]) {
      const p = sim.track.at(sim.track.length * f, 0);
      out.push(p);
    }
    return out;
  }, [sim]);
  const cones = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (let s = 5; s < sim.track.length; s += 18)
      for (const side of [-1, 1]) {
        const p = sim.track.at(s, side * (KART.halfWidth + 2.8));
        out.push(p);
      }
    return out;
  }, [sim]);
  const coneRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    cones.forEach((c, i) => coneRef.current?.setMatrixAt(i, m.makeTranslation(c.x, 0.45, c.z)));
    if (coneRef.current) coneRef.current.instanceMatrix.needsUpdate = true;
  }, [cones]);
  const half = KART.halfWidth + 2.2;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[30, -0.01, 70]}>
        <circleGeometry args={[420, 48]} />
        <meshStandardMaterial color="#6fae46" roughness={1} />
      </mesh>
      {/* Đồi xa */}
      {[
        [-200, -120, 80],
        [220, 40, 100],
        [40, 320, 120],
        [-160, 260, 90],
      ].map(([x, z, r], i) => (
        <mesh key={i} position={[x, -r * 0.55, z]}>
          <sphereGeometry args={[r, 24, 12]} />
          <meshStandardMaterial color="#5c9a3c" roughness={1} />
        </mesh>
      ))}
      {/* Cổng thép bắc qua đường */}
      {gantries.map((g, i) => (
        <group key={i} position={[g.x, 0, g.z]} rotation-y={g.yaw}>
          {[-half, half].map((x) => (
            <mesh key={x} position={[x, 3.4, 0]}>
              <boxGeometry args={[0.6, 6.8, 0.6]} />
              <meshStandardMaterial color="#9a3c22" metalness={0.5} roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 6.6, 0]}>
            <boxGeometry args={[half * 2 + 0.6, 0.9, 0.6]} />
            <meshStandardMaterial color="#9a3c22" metalness={0.5} roughness={0.6} />
          </mesh>
          {i === 0 && (
            <mesh position={[0, 5.5, 0.32]}>
              <planeGeometry args={[half * 1.4, 1.2]} />
              <meshBasicMaterial color={[2.4, 0.5, 1.3]} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
      <instancedMesh ref={coneRef} args={[undefined, undefined, cones.length]}>
        <cylinderGeometry args={[0.12, 0.38, 0.9, 10]} />
        <meshStandardMaterial color="#f2c21a" roughness={0.6} />
      </instancedMesh>
      {/* Mây */}
      {[
        [-80, 70, 200],
        [90, 60, 260],
        [200, 80, 120],
        [-150, 75, 20],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} scale={[30, 8, 14]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial color="#ffffff" fog={false} />
        </mesh>
      ))}
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
    o.rotation.y = w.yaw + spin;
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
      <div className="lv__help">
        <kbd>W</kbd> ga · <kbd>S</kbd> phanh · <kbd>A</kbd>
        <kbd>D</kbd> lái · <kbd>J</kbd> dùng vật phẩm (turbo / tên lửa) · tấm cam = tăng tốc · <kbd>Esc</kbd> thoát
      </div>
    </div>
  );
}

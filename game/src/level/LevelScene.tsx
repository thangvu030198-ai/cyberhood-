// Màn đi ngang hiển thị bằng chính các model 3D của thành phố: camera nhìn ngang, nền là toà nhà Meshy,
// nhân vật và địch là model đã rig. Toàn bộ luật chơi nằm trong PlatformerSim (platformer.ts).

import { Suspense, use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { extraModel, models, playSfx, type ExtraModel } from "../game/assets";
import { inPlace, once } from "../game/meshyAnim";
import { fitCharacter } from "../game/Player";
import { useFitted } from "../game/Showcase";
import { useGame } from "../game/store";
import { LEVEL_TUNING as T } from "./levelTuning";
import { levelInput } from "./levelInput";
import { useLevel } from "./session";
import type { Enemy, PlatformerSim } from "./platformer";
import { THEMES, type LevelTheme } from "./themes";

/** Bề sâu khối nền (trục z), nhân vật đứng ở z = 0 */
const DEPTH = 4;
const CAM = { distance: 18.5, height: 2.4, fov: 40, lookAhead: 2.2, damp: 5, minY: 5.4, maxY: 12 };

export function LevelCanvas() {
  const sim = useLevel((s) => s.sim);
  const quality = useGame((s) => s.quality);
  if (!sim) return null;
  const th = THEMES[sim.def.theme];
  return (
    <Canvas
      className="level-canvas"
      dpr={quality === "high" ? [1, 1.25] : 1}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: CAM.fov, near: 0.5, far: 600, position: [sim.player.x, CAM.minY, CAM.distance] }}
    >
      <color attach="background" args={[th.fog]} />
      <fog attach="fog" args={[th.fog, th.fogNear, th.fogFar]} />
      <SimDriver sim={sim} />
      <LevelCamera sim={sim} />
      <hemisphereLight args={[th.hemi.sky, th.hemi.ground, th.hemi.intensity]} />
      <directionalLight position={[-20, 30, 25]} intensity={th.key.intensity} color={th.key.color} />
      <directionalLight position={[30, 10, -30]} intensity={th.rim.intensity} color={th.rim.color} />
      <Sky theme={th} />
      <Tiles sim={sim} theme={th} />
      <Checkpoints sim={sim} />
      <BossDoors sim={sim} />
      <Shots sim={sim} />
      <Pickups sim={sim} />
      <Fx sim={sim} />
      <Suspense fallback={null}>
        <Backdrop width={sim.width} theme={th} />
      </Suspense>
      <Suspense fallback={<PlaceholderHero sim={sim} />}>
        <Hero sim={sim} theme={th} />
      </Suspense>
      {sim.enemies.map((e) => (
        <Suspense key={e.id} fallback={null}>
          <EnemyModel sim={sim} enemy={e} />
        </Suspense>
      ))}
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.0} luminanceThreshold={1} luminanceSmoothing={0.2} />
        <Vignette eskil={false} offset={0.3} darkness={0.35} />
      </EffectComposer>
    </Canvas>
  );
}

/** Chạy mô phỏng theo thời gian thật, phát âm thanh theo sự kiện */
function SimDriver({ sim }: { sim: PlatformerSim }) {
  const seen = useRef(0);
  useFrame((_, dt) => {
    if (!levelInput.paused) sim.update(Math.min(dt, 0.1), levelInput.state());
    for (let i = seen.current; i < sim.fx.length; i++) {
      const f = sim.fx[i];
      if (f.kind === "shot") playSfx("blaster", 0.35);
      else if (f.kind === "hit") playSfx("enemyHurt", 0.4);
      else if (f.kind === "boom") playSfx("enemyDestroy", 0.6);
      else if (f.kind === "pickup" || f.kind === "checkpoint") playSfx("pickup", 0.7);
      else if (f.kind === "hurt") playSfx("enemyAttack", 0.5);
    }
    // Giữ danh sách hiệu ứng ngắn: bỏ những cái đã quá 1 giây
    const cut = sim.fx.findIndex((f) => sim.time - f.at < 1);
    if (cut > 0) sim.fx.splice(0, cut);
    else if (cut === -1) sim.fx.length = 0;
    seen.current = sim.fx.length;
  });
  return null;
}

function LevelCamera({ sim }: { sim: PlatformerSim }) {
  const camera = useThree((s) => s.camera);
  const look = useRef(new THREE.Vector3(sim.player.x, CAM.minY, 0));
  const aspect = useThree((s) => s.size.width / s.size.height);
  useFrame((_, dt) => {
    const p = sim.player;
    const halfW = Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)) * CAM.distance * aspect;
    let tx = p.x + p.facing * CAM.lookAhead;
    if (sim.bossActive) tx = (sim.def.bossArena[0] + sim.def.bossArena[1] + 1) / 2;
    tx = THREE.MathUtils.clamp(tx, halfW, Math.max(halfW, sim.width - halfW));
    const ty = THREE.MathUtils.clamp(p.y + CAM.height, CAM.minY, CAM.maxY);
    const k = 1 - Math.exp(-CAM.damp * Math.min(dt, 0.1));
    look.current.x += (tx - look.current.x) * k;
    look.current.y += (ty - look.current.y) * k;
    camera.position.set(look.current.x, look.current.y + 1.2, CAM.distance);
    camera.lookAt(look.current.x, look.current.y, 0);
  });
  return null;
}

/** Trời chạng vạng vùng cách ly: mặt trời đỏ thấp và dải mây tím */
function Sky({ theme }: { theme: LevelTheme }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    theme.sky.forEach((c, i) => grad.addColorStop(i / (theme.sky.length - 1), c));
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [theme]);
  return (
    <group>
      <mesh position={[100, 40, -260]}>
        <planeGeometry args={[1400, 260]} />
        <meshBasicMaterial map={tex} fog={false} depthWrite={false} />
      </mesh>
      <mesh position={[150, 22, -250]}>
        <circleGeometry args={[18, 48]} />
        <meshBasicMaterial color={theme.sun} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function panelTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#9aa2bd";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#c3c9dc";
  g.fillRect(3, 3, 58, 58);
  g.strokeStyle = "#6c7391";
  g.lineWidth = 2;
  g.strokeRect(3, 3, 58, 58);
  g.fillStyle = "#7d84a3";
  for (const [x, y] of [
    [8, 8],
    [56, 8],
    [8, 56],
    [56, 56],
  ])
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  g.fillStyle = "rgba(60,66,96,0.25)";
  g.fillRect(10, 30, 44, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

/** Khối nền, bậc một chiều và gai: mỗi loại một InstancedMesh */
function Tiles({ sim, theme }: { sim: PlatformerSim; theme: LevelTheme }) {
  const data = useMemo(() => {
    const solid: [number, number][] = [];
    const edges: [number, number][] = [];
    const ledges: [number, number][] = [];
    const spikes: [number, number][] = [];
    for (let c = 0; c < sim.width; c++)
      for (let r = 0; r < sim.height; r++) {
        const t = sim.tile(c, r);
        if (t === "#") {
          solid.push([c, r]);
          if (sim.tile(c, r + 1) !== "#") edges.push([c, r]);
        } else if (t === "=") ledges.push([c, r]);
        else if (t === "^") spikes.push([c, r]);
      }
    return { solid, edges, ledges, spikes };
  }, [sim]);
  const tex = useMemo(panelTexture, []);
  const refs = {
    solid: useRef<THREE.InstancedMesh>(null),
    edges: useRef<THREE.InstancedMesh>(null),
    ledges: useRef<THREE.InstancedMesh>(null),
    spikes: useRef<THREE.InstancedMesh>(null),
  };
  useEffect(() => {
    const m = new THREE.Matrix4();
    const place = (mesh: THREE.InstancedMesh | null, list: [number, number][], dy: number) => {
      if (!mesh) return;
      list.forEach(([c, r], i) => mesh.setMatrixAt(i, m.makeTranslation(c + 0.5, r + dy, 0)));
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(refs.solid.current, data.solid, 0.5);
    place(refs.edges.current, data.edges, 0.97);
    // Viền sáng chỉ chạy dọc mép trước của mặt đứng
    refs.edges.current?.position.set(0, 0, DEPTH / 2);
    place(refs.ledges.current, data.ledges, 0.88);
    place(refs.spikes.current, data.spikes, 0.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  return (
    <group>
      <instancedMesh ref={refs.solid} args={[undefined, undefined, data.solid.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, DEPTH]} />
        <meshStandardMaterial map={tex} color={theme.tile} roughness={0.7} metalness={0.15} />
      </instancedMesh>
      <instancedMesh ref={refs.edges} args={[undefined, undefined, data.edges.length]} frustumCulled={false}>
        <boxGeometry args={[1.001, 0.08, 0.08]} />
        <meshBasicMaterial color={theme.edge} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={refs.ledges} args={[undefined, undefined, data.ledges.length]} frustumCulled={false}>
        <boxGeometry args={[1, 0.22, DEPTH * 0.7]} />
        <meshStandardMaterial color={theme.ledge} emissive={theme.ledge} emissiveIntensity={0.9} />
      </instancedMesh>
      <instancedMesh ref={refs.spikes} args={[undefined, undefined, data.spikes.length]} frustumCulled={false}>
        <coneGeometry args={[0.38, 0.6, 4]} />
        <meshStandardMaterial color="#5a0f1c" emissive="#ff2a4d" emissiveIntensity={2.2} />
      </instancedMesh>
    </group>
  );
}

function Checkpoints({ sim }: { sim: PlatformerSim }) {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame(() => {
    sim.def.checkpoints.forEach((_, i) => {
      const m = mats.current[i];
      if (m) m.color.setRGB(...((i <= sim.checkpointIndex ? [0.4, 3, 1.2] : [2.4, 1.2, 0.2]) as [number, number, number]));
    });
  });
  return (
    <group>
      {sim.def.checkpoints.map(([x, y], i) => (
        <group key={i} position={[x, y, -1.2]}>
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 2.8, 8]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, 2.9, 0]}>
            <sphereGeometry args={[0.22, 12, 8]} />
            <meshBasicMaterial ref={(m) => void (mats.current[i] = m)} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Cửa laser phòng trùm: hiện khi trận đấu bắt đầu */
function BossDoors({ sim }: { sim: PlatformerSim }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.visible = sim.bossActive && sim.status !== "cleared";
    group.current.children.forEach((c) => ((c as THREE.Mesh).scale.x = 0.8 + Math.sin(clock.elapsedTime * 20) * 0.2));
  });
  const [a, b] = sim.def.bossArena;
  return (
    <group ref={group}>
      {[a - 0.5, b + 1.5].map((x) => (
        <mesh key={x} position={[x, sim.height / 2, 0]}>
          <boxGeometry args={[0.25, sim.height, 0.6]} />
          <meshBasicMaterial color={[3, 0.3, 0.5]} transparent opacity={0.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const SHOT_POOL = 40;
const SHOT_COLORS = {
  player: [new THREE.Color(1.2, 2.6, 3), new THREE.Color(0.6, 3, 1.4), new THREE.Color(3, 1.2, 3)],
  enemy: [new THREE.Color(3, 1.2, 0.3), new THREE.Color(3, 0.4, 0.4), new THREE.Color(2.6, 0.3, 2.2)],
};

function Shots({ sim }: { sim: PlatformerSim }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const n = Math.min(sim.shots.length, SHOT_POOL);
    for (let i = 0; i < n; i++) {
      const s = sim.shots[i];
      // Đạn kéo dài theo hướng bay
      const stretch = s.enemy ? 1 : 1.8;
      mat.makeScale(s.r * 2 * stretch, s.r * 2, s.r * 2).setPosition(s.x, s.y, 0.2);
      m.setMatrixAt(i, mat);
      m.setColorAt(i, (s.enemy ? SHOT_COLORS.enemy : SHOT_COLORS.player)[s.level]);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SHOT_POOL]} frustumCulled={false}>
      <sphereGeometry args={[0.5, 12, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Pickups({ sim }: { sim: PlatformerSim }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    sim.pickups.forEach((k, i) => {
      const o = g.children[i];
      if (!o) return;
      o.visible = !k.taken;
      o.position.set(k.x, k.y + 0.35 + Math.sin(clock.elapsedTime * 3 + i) * 0.1, 0);
      o.rotation.y = clock.elapsedTime * 2;
    });
  });
  // Viên máu rơi ra thêm khi hạ địch: tạo sẵn đủ chỗ
  const slots = sim.pickups.length + 24;
  return (
    <group ref={group}>
      {Array.from({ length: slots }, (_, i) => (
        <mesh key={i} visible={false}>
          <capsuleGeometry args={[0.16, 0.28, 4, 8]} />
          <meshBasicMaterial color={[0.4, 3, 1]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

const FX_POOL = 24;

/** Tia lửa khi trúng đạn, vụ nổ khi hạ địch: quả cầu phát sáng nở ra rồi tắt */
function Fx({ sim }: { sim: PlatformerSim }) {
  const group = useRef<THREE.Group>(null);
  const charge = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    let i = 0;
    for (let k = sim.fx.length - 1; k >= 0 && i < FX_POOL; k--) {
      const f = sim.fx[k];
      const life = f.kind === "boom" ? 0.55 : f.kind === "hit" ? 0.18 : f.kind === "land" ? 0.25 : 0;
      const age = sim.time - f.at;
      if (!life || age > life) continue;
      const o = g.children[i++] as THREE.Mesh;
      const u = age / life;
      const size = f.kind === "boom" ? 0.4 + u * 2.4 : f.kind === "land" ? 0.3 + u * 1.2 : 0.25 + u * 0.5;
      o.visible = true;
      o.position.set(f.x, f.y + (f.kind === "land" ? 0.1 : 0), 0.4);
      o.scale.set(size, f.kind === "land" ? size * 0.25 : size, size);
      const mat = o.material as THREE.MeshBasicMaterial;
      mat.opacity = 1 - u;
      mat.color.setRGB(...((f.kind === "boom" ? [3, 1.4, 0.4] : f.kind === "land" ? [1, 1, 1.4] : [2.6, 2.6, 3]) as [number, number, number]));
    }
    for (; i < FX_POOL; i++) g.children[i].visible = false;
    // Quầng nạp đạn quanh nhân vật
    const c = charge.current;
    if (c) {
      const p = sim.player;
      const lvl = p.charge >= T.shot.chargeFull ? 2 : p.charge >= T.shot.chargeMid ? 1 : 0;
      c.visible = lvl > 0 && sim.status === "playing";
      c.position.set(p.x, p.y + 1, 0.3);
      const pulse = 1 + Math.sin(sim.time * (lvl === 2 ? 40 : 22)) * 0.15;
      c.scale.setScalar((lvl === 2 ? 1.3 : 0.95) * pulse);
      (c.material as THREE.MeshBasicMaterial).color.setRGB(...((lvl === 2 ? [3, 1, 3] : [0.6, 3, 1.4]) as [number, number, number]));
    }
  });
  return (
    <>
      <group ref={group}>
        {Array.from({ length: FX_POOL }, (_, i) => (
          <mesh key={i} visible={false}>
            <sphereGeometry args={[0.5, 12, 8]} />
            <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={charge} visible={false}>
        <sphereGeometry args={[0.9, 16, 12]} />
        <meshBasicMaterial transparent opacity={0.28} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Nền: toà nhà và đạo cụ Meshy xếp thành ba lớp xa dần để có cảm giác thị sai khi camera chạy ngang

const BACK_BUILDINGS: ExtraModel[] = [
  "mx_bld_factory",
  "mx_bld_apartment",
  "mx_bld_clinic",
  "mx_bld_tower_round",
  "mx_bld_police_station",
  "mx_bld_skyscraper",
  "mx_bld_hotel",
  "mx_bld_capsule_hotel",
];

function Backdrop({ width, theme }: { width: number; theme: LevelTheme }) {
  const back = useMemo(() => {
    const list: { name: ExtraModel; x: number; h: number; z: number }[] = [];
    let i = 0;
    for (let x = 6; x < width + 30; x += 24) {
      list.push({ name: BACK_BUILDINGS[i % BACK_BUILDINGS.length], x, h: 22 + ((i * 7) % 4) * 5, z: -64 - (i % 2) * 16 });
      i++;
    }
    return list;
  }, [width]);
  return (
    <group>
      {/* Nền đất phía sau làn chơi */}
      <mesh rotation-x={-Math.PI / 2} position={[width / 2, -0.02, -60]}>
        <planeGeometry args={[width + 400, 116]} />
        <meshStandardMaterial color={theme.backFloor} roughness={0.95} />
      </mesh>
      {back.map((b, i) => (
        <Suspense key={i} fallback={null}>
          <Prop name={b.name} height={b.h} position={[b.x, 0, b.z]} rotationY={0} selfLit={theme.backSelfLit} />
        </Suspense>
      ))}
      {/* Lớp giữa: dấu tích vùng cách ly */}
      <Suspense fallback={null}>
        <Prop name="mx_map_watchtower" height={10} position={[24, 0, -34]} rotationY={0.3} />
        <Prop name="mx_map_crashed_mech" height={6} position={[46, 0, -28]} rotationY={-0.6} />
                <Prop name="mx_map_radio_tower" height={22} position={[125, 0, -44]} rotationY={0} />
        <Prop name="mx_veh_tank" height={3.2} position={[136, 0, -22]} rotationY={1.2} />
        <Prop name="mx_car_armored" height={2.4} position={[150, 0, -20]} rotationY={-0.4} />
        <Prop name="mx_map_watchtower" height={10} position={[160, 0, -34]} rotationY={-0.3} />
        <Prop name="mx_map_shield_gen" height={14} position={[178, 0, -34]} rotationY={0} selfLit={0.6} />
      </Suspense>
      <Suspense fallback={null}>
        <Prop name="mx_prop_trash_pile" height={1.6} position={[9, 2, -1.5]} rotationY={0.4} />
        <Prop name="mx_prop_trash_pile" height={1.6} position={[56, 2, -1.5]} rotationY={2} />
        <Prop name="mx_prop_trash_pile" height={1.6} position={[105, 2, -1.5]} rotationY={1} />
        <Prop name="mx_supply_crate" height={1.1} position={[38, 3, -1.5]} rotationY={0.3} />
        <Prop name="mx_supply_crate" height={1.1} position={[147, 2, -1.5]} rotationY={-0.2} />
      </Suspense>
      {/* Thành trì của Vane mờ xa phía cuối màn */}
      <Suspense fallback={null}>
        <Prop name="mx_map_citadel" height={90} position={[210, -4, -150]} rotationY={0} selfLit={0.4} />
      </Suspense>
    </group>
  );
}

function Prop({ name, height, position, rotationY, selfLit = 0.3 }: { name: ExtraModel; height: number; position: [number, number, number]; rotationY: number; selfLit?: number }) {
  const { root } = useFitted(name, height, "height", selfLit);
  return <primitive object={root} position={position} rotation={[0, rotationY, 0]} />;
}

// ---------------------------------------------------------------------------
// Nhân vật có xương: dựng một lần, đổi clip bằng crossfade

type Rig = { scene: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; current: string };

function buildRig(base: THREE.Object3D, clips: Record<string, THREE.AnimationClip | undefined>, height: number, selfLit = 0.25): Rig {
  const scene = cloneSkinned(base);
  fitCharacter(scene, height, 0);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    if (mat.map && !mat.emissiveMap) {
      mat.emissiveMap = mat.map;
      mat.emissive.set("#ffffff");
      mat.emissiveIntensity = selfLit;
    }
    m.material = mat;
  });
  const mixer = new THREE.AnimationMixer(scene);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const [name, clip] of Object.entries(clips)) {
    if (!clip) continue;
    const c = inPlace(clip);
    c.name = name;
    // Clip nhảy tự nâng Hips lên cao; độ cao thật đã do mô phỏng lo nên giữ Hips ở độ cao đứng
    if (name === "jump")
      for (const t of c.tracks) {
        if (!t.name.endsWith(".position") || !/hips/i.test(t.name)) continue;
        for (let i = 1; i < t.values.length; i += 3) t.values[i] = t.values[1];
      }
    actions[name] = mixer.clipAction(c);
  }
  for (const n of ["death", "jump", "hit", "attack"]) if (actions[n]) once(actions[n]);
  const first = actions.idle ?? actions.walk ?? Object.values(actions)[0];
  first?.play();
  return { scene, mixer, actions, current: first ? Object.keys(actions).find((k) => actions[k] === first)! : "" };
}

function setAnim(rig: Rig, name: string, fade = 0.15, restart = false) {
  const next = rig.actions[name];
  if (!next || (rig.current === name && !restart)) return;
  const prev = rig.actions[rig.current];
  next.reset().setEffectiveWeight(1).play();
  if (prev && prev !== next) next.crossFadeFrom(prev, fade, false);
  rig.current = name;
}

/** Tô màu đỏ / trắng khi trúng đạn, nhấp nháy khi bất tử */
function flash(scene: THREE.Object3D, amount: number, color: THREE.Color) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat.userData.baseEmissive) mat.userData.baseEmissive = { c: mat.emissive.clone(), i: mat.emissiveIntensity, map: mat.emissiveMap };
    const b = mat.userData.baseEmissive as { c: THREE.Color; i: number; map: THREE.Texture | null };
    if (amount > 0) {
      mat.emissive.copy(color);
      mat.emissiveIntensity = amount * 2;
      mat.emissiveMap = null;
    } else {
      mat.emissive.copy(b.c);
      mat.emissiveIntensity = b.i;
      mat.emissiveMap = b.map;
    }
  });
}
const WHITE = new THREE.Color(1, 1, 1);
const RED = new THREE.Color(1, 0.15, 0.1);

/** Hướng mặt: model Meshy nhìn +Z; quay về phía chạy nhưng chếch về camera một chút để thấy mặt */
const faceYaw = (facing: number) => facing * (Math.PI / 2 - 0.35);

function Hero({ sim, theme }: { sim: PlatformerSim; theme: LevelTheme }) {
  const skin = useGame((s) => s.profile?.hunter ?? "soldier");
  // Soldier là model Mixamo không có clip bắn khi chạy: dùng nhân vật Racer thay trong màn đi ngang
  const cls = skin === "soldier" ? "racer" : skin;
  const base = `mx_cls_${cls}` as const;
  const walk = use(extraModel(`${base}_walk`));
  const g = {
    idle: use(extraModel(`${base}_idle`)),
    run: use(extraModel(`${base}_run`)),
    runshoot: use(extraModel(`${base}_runshoot`)),
    jump: use(extraModel(`${base}_jump`)),
    hit: use(extraModel(`${base}_hit`)),
    death: use(extraModel(`${base}_death`)),
  };
  const { rig, air, climb } = useMemo(() => {
    const rig = buildRig(
      walk.scene,
      {
        walk: walk.animations[0],
        idle: g.idle.animations[0],
        run: g.run.animations[0],
        runshoot: g.runshoot.animations[0],
        jump: g.jump.animations[0],
        hit: g.hit.animations[0],
        death: g.death.animations[0],
      },
      1.8,
      0.6,
    );
    addOutline(rig.scene, theme.heroOutline, 0.022);
    return { rig, air: airWindow(g.jump.animations[0]), climb: new ClimbPose(rig.scene) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk, theme, ...Object.values(g)]);
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const yaw = useRef(faceYaw(1));
  const lean = useRef(0);
  const squash = useRef(1);
  const wasGround = useRef(true);
  const lastDust = useRef(0);
  useFrame((_, dt) => {
    const p = sim.player;
    const o = group.current;
    if (!o) return;
    dt = Math.min(dt, 0.1);
    o.position.set(p.x, p.y, 0);
    // Sát tường trên không: quay mặt vào tường để bám/leo; còn lại quay theo hướng chạy
    const onWall = p.wallNear !== 0 && sim.status === "playing" && p.knock <= 0;
    yaw.current = THREE.MathUtils.damp(yaw.current, faceYaw(onWall ? p.wallNear : p.facing), 16, dt);
    o.rotation.y = yaw.current;
    // Lướt: chúi người về trước; bám tường: ngả nhẹ ra khỏi tường. Đổi dần cho mượt
    const leanTarget = p.dashTime > 0 ? -p.facing * 0.22 : onWall ? -p.wallNear * 0.08 : 0;
    lean.current = THREE.MathUtils.damp(lean.current, leanTarget, 14, dt);
    o.rotation.z = lean.current;
    // Chạm đất: nén nhẹ rồi bật lại
    if (p.onGround && !wasGround.current) squash.current = 0.86;
    wasGround.current = p.onGround;
    squash.current = THREE.MathUtils.damp(squash.current, 1, 12, dt);
    o.scale.set(1 / Math.sqrt(squash.current), squash.current, 1 / Math.sqrt(squash.current));

    const shooting = sim.time - lastShotAt(sim) < 0.35;
    const jump = rig.actions.jump;
    if (sim.status === "dead") setAnim(rig, "death", 0.1);
    else if (p.knock > 0) setAnim(rig, "hit", 0.05);
    else if (!p.onGround && jump) {
      // Trên không: tư thế nhảy chọn theo vận tốc dọc (lên → đỉnh → rơi), không phát cả clip
      setAnim(rig, "jump", 0.1);
      const P = T.player;
      const u = p.vy > 0 ? 0.5 * (1 - Math.min(1, p.vy / P.jumpVel)) : 0.5 + 0.5 * Math.min(1, -p.vy / P.maxFall);
      const t = THREE.MathUtils.lerp(air.start, air.end, p.wall !== 0 ? 0.45 : u);
      jump.time = THREE.MathUtils.damp(jump.time, t, 20, dt);
      jump.timeScale = 0;
    } else if (Math.abs(p.vx) > 0.5) setAnim(rig, shooting || p.dashTime > 0 ? "runshoot" : "run", 0.12);
    else setAnim(rig, shooting ? "runshoot" : "idle", 0.15);
    const run = rig.actions.run;
    if (run) run.timeScale = p.dashTime > 0 ? 1.6 : 1.15;
    if (rig.actions.runshoot) rig.actions.runshoot.timeScale = Math.abs(p.vx) > 0.5 ? (p.dashTime > 0 ? 1.6 : 1.15) : 0.0001;
    rig.mixer.update(dt);
    // Động tác leo / trượt tường đè lên tư thế của clip, trộn dần vào và ra
    climb.apply(onWall ? p.wallNear : 0, p.vy, p.y, dt);
    // Trượt tường: bụi bắn ra ở chỗ tay chân miết vào tường
    if (onWall && p.vy < -1 && sim.time - lastDust.current > 0.12) {
      lastDust.current = sim.time;
      sim.fx.push({ kind: "land", x: p.x + p.wallNear * (p.w / 2), y: p.y + 0.4, at: sim.time });
    }
    // Nhấp nháy khi bất tử sau khi trúng đòn
    o.visible = sim.status === "dead" || p.invuln <= 0 || Math.floor(sim.time * 20) % 2 === 0;

    // Bóng tròn dưới chân: chiếu xuống mặt đất gần nhất bên dưới
    const sh = shadow.current;
    if (sh) {
      let gy = Math.floor(p.y);
      while (gy > 0 && sim.tile(Math.floor(p.x), gy - 1) === ".") gy--;
      const h = p.y - gy;
      sh.position.set(p.x, gy + 0.02, 0.3);
      sh.scale.setScalar(Math.max(0.35, 1 - h * 0.12));
      (sh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.45 - h * 0.05);
    }
    light.current?.position.set(p.x + p.facing * 0.5, p.y + 2.2, 2.2);
  });
  return (
    <>
      <group ref={group}>
        <primitive object={rig.scene} />
      </group>
      <mesh ref={shadow} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {/* Đèn rọi đi theo nhân vật chính để luôn sáng hơn nền */}
      <pointLight ref={light} intensity={9} distance={7} decay={1.6} color="#ffffff" />
    </>
  );
}

const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _d = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Động tác bám và leo tường dựng bằng tay (bộ hoạt ảnh không có clip leo): xoay xương tay chân theo
 * hướng trong không gian thế giới. Xương Meshy chạy dọc trục +Y nên chỉ cần quay +Y về hướng mong muốn.
 * Đang lên: hai tay thay nhau vươn lên bám tường, chân đạp tường theo nhịp độ cao (leo tay đôi).
 * Đang trượt xuống: một tay miết tường phía trên, chân co chống vào tường.
 */
class ClimbPose {
  private bones: Record<string, THREE.Bone> = {};
  private weight = 0;
  private side: -1 | 1 = 1;
  private rising = 0;

  constructor(scene: THREE.Object3D) {
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones[o.name] = o as THREE.Bone;
    });
  }

  apply(wall: -1 | 0 | 1, vy: number, height: number, dt: number) {
    if (wall !== 0) this.side = wall;
    this.weight = THREE.MathUtils.damp(this.weight, wall !== 0 ? 1 : 0, wall !== 0 ? 16 : 10, dt);
    this.rising = THREE.MathUtils.damp(this.rising, vy > 0.5 ? 1 : 0, 10, dt);
    if (this.weight < 0.01) return;
    const s = this.side;
    // Nhịp leo theo độ cao đã leo: mỗi ~1.4m đổi tay
    const c = Math.sin(height * 2.3);
    const r = this.rising;
    const mix = (a: [number, number, number], b: [number, number, number]) =>
      [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r, a[2] + (b[2] - a[2]) * r] as [number, number, number];
    // [trượt, leo] cho từng xương; tay/chân "gần" là bên trái hay phải tuỳ hướng tường không quan trọng vì nhìn ngang
    const pose: [string, [number, number, number]][] = [
      ["Spine01", mix([s * 0.15, 1, 0], [s * 0.22, 1, 0])],
      ["LeftArm", mix([s * 0.55, 0.8, 0.1], [s * 0.45, 0.55 + 0.4 * c, 0.15])],
      ["LeftForeArm", mix([s * 0.45, 0.9, 0], [s * 0.3, 1, 0])],
      ["RightArm", mix([-s * 0.25, -0.95, 0.2], [s * 0.45, 0.55 - 0.4 * c, -0.15])],
      ["RightForeArm", mix([s * 0.2, -0.9, 0.3], [s * 0.3, 1, 0])],
      ["LeftUpLeg", mix([s * 0.55, -0.45, 0.1], [s * 0.5, -0.55 - 0.35 * c, 0.1])],
      ["LeftLeg", mix([s * 0.35, -0.95, 0], [s * 0.2, -1, 0])],
      ["RightUpLeg", mix([s * 0.1, -1, -0.1], [s * 0.5, -0.55 + 0.35 * c, -0.1])],
      ["RightLeg", mix([s * 0.05, -1, 0], [s * 0.2, -1, 0])],
    ];
    for (const [name, dir] of pose) {
      const b = this.bones[name];
      if (!b?.parent) continue;
      b.parent.updateWorldMatrix(true, false);
      b.parent.getWorldQuaternion(_pq);
      _q.setFromUnitVectors(UP, _d.set(...dir).normalize());
      _q.premultiply(_pq.invert());
      b.quaternion.slerp(_q, this.weight);
      b.updateMatrixWorld(true);
    }
  }
}

/** Khoảng thời gian nhân vật lơ lửng trong clip nhảy: đo từ độ cao xương Hips */
function airWindow(clip: THREE.AnimationClip | undefined) {
  const fallback = { start: 0, end: clip?.duration ?? 1 };
  const track = clip?.tracks.find((t) => t.name.endsWith(".position") && /hips/i.test(t.name));
  if (!clip || !track) return fallback;
  const ys: number[] = [];
  for (let i = 1; i < track.values.length; i += 3) ys.push(track.values[i]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  if (hi - lo < 1e-3) return fallback;
  const cut = lo + (hi - lo) * 0.35;
  const first = ys.findIndex((y) => y > cut);
  let last = ys.length - 1;
  while (last > 0 && ys[last] <= cut) last--;
  if (first < 0 || last <= first) return fallback;
  return { start: track.times[first], end: track.times[last] };
}

/** Viền sáng quanh nhân vật: vỏ lưới mặt sau phình ra theo pháp tuyến, dùng chung bộ xương */
function addOutline(scene: THREE.Object3D, color: string, worldThickness: number) {
  scene.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
  });
  const ws = new THREE.Vector3();
  for (const m of meshes) {
    m.getWorldScale(ws);
    const thickness = worldThickness / Math.max(1e-6, ws.x);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), side: THREE.BackSide, toneMapped: false });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <skinning_vertex>",
        `#include <skinning_vertex>\n  transformed += normalize(objectNormal) * ${thickness.toFixed(6)};`,
      );
    };
    const shell = new THREE.SkinnedMesh(m.geometry, mat);
    shell.bind(m.skeleton, m.bindMatrix);
    shell.frustumCulled = false;
    shell.renderOrder = -1;
    m.parent!.add(shell);
    shell.position.copy(m.position);
    shell.quaternion.copy(m.quaternion);
    shell.scale.copy(m.scale);
  }
}

function lastShotAt(sim: PlatformerSim) {
  for (let i = sim.fx.length - 1; i >= 0; i--) if (sim.fx[i].kind === "shot") return sim.fx[i].at;
  return -9;
}

/** Hộp tạm trong lúc model nhân vật đang tải */
function PlaceholderHero({ sim }: { sim: PlatformerSim }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => ref.current?.position.set(sim.player.x, sim.player.y + 0.9, 0));
  return (
    <mesh ref={ref}>
      <capsuleGeometry args={[0.35, 1.1, 4, 8]} />
      <meshStandardMaterial color="#05d9e8" emissive="#05d9e8" emissiveIntensity={0.6} />
    </mesh>
  );
}

const ENEMY_MODEL: Record<Exclude<Enemy["kind"], "drone">, { base: string; clips: Record<string, string>; height: number }> = {
  trooper: { base: "mx_legion_android", clips: { walk: "walk", idle: "idle", shoot: "walkshoot", death: "death" }, height: 1.9 },
  zombie: { base: "mx_zmb_walker", clips: { walk: "walk", run: "run", attack: "attack", death: "death", hit: "stagger" }, height: 1.85 },
  boss: { base: "mx_mon_robot_reaper", clips: { walk: "walk", run: "run", attack: "attack", death: "death", scream: "scream", hit: "stagger" }, height: 3.6 },
};

function EnemyModel({ sim, enemy }: { sim: PlatformerSim; enemy: Enemy }) {
  if (enemy.kind === "drone") return <DroneModel sim={sim} enemy={enemy} />;
  return <RiggedEnemy sim={sim} enemy={enemy} spec={ENEMY_MODEL[enemy.kind]} />;
}

function RiggedEnemy({ sim, enemy, spec }: { sim: PlatformerSim; enemy: Enemy; spec: (typeof ENEMY_MODEL)["trooper"] }) {
  const entries = Object.entries(spec.clips);
  const gltfs = entries.map(([, file]) => use(extraModel(`${spec.base}_${file}` as ExtraModel)));
  const rig = useMemo(() => {
    const clips: Record<string, THREE.AnimationClip | undefined> = {};
    entries.forEach(([name], i) => (clips[name] = gltfs[i].animations[0]));
    return buildRig(gltfs[0].scene, clips, spec.height, enemy.kind === "boss" ? 0.45 : 0.35);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, gltfs);
  const group = useRef<THREE.Group>(null);
  const yaw = useRef(faceYaw(enemy.facing));
  useFrame((_, dt) => {
    const o = group.current;
    if (!o) return;
    const e = enemy;
    // Hạ xong thì nằm lại 1.2 giây rồi biến mất
    o.visible = e.alive || sim.time - e.deadAt < 1.2;
    if (!o.visible) return;
    const nearCam = Math.abs(e.x - sim.player.x) < 26;
    if (!nearCam) return;
    o.position.set(e.x, e.y, enemy.kind === "boss" ? -0.3 : 0);
    yaw.current = THREE.MathUtils.damp(yaw.current, faceYaw(e.facing), 10, dt);
    o.rotation.y = yaw.current;
    if (!e.alive) setAnim(rig, "death", 0.1);
    else if (sim.time - e.hurtAt < 0.15 && e.kind === "boss" && rig.actions.hit && e.move !== "jump") setAnim(rig, "walk", 0.1);
    else if (e.kind === "trooper") setAnim(rig, sim.time - e.firedAt < 0.6 ? "shoot" : Math.abs(e.vx) > 0.1 ? "walk" : "idle", 0.15);
    else if (e.kind === "zombie") setAnim(rig, Math.abs(e.vx) > 1.5 ? "run" : "walk", 0.2);
    else if (e.kind === "boss") {
      const anim = !e.awake ? "scream" : e.move === "volley" ? "attack" : e.move === "jump" ? "run" : "walk";
      setAnim(rig, anim, 0.2);
    }
    rig.mixer.update(Math.min(dt, 0.1) * (e.awake || e.kind !== "boss" ? 1 : 0.3));
    const hurt = sim.time - e.hurtAt;
    flash(rig.scene, e.alive && hurt < 0.1 ? 1 - hurt / 0.1 : 0, e.kind === "boss" ? WHITE : RED);
  });
  return (
    <group ref={group}>
      <primitive object={rig.scene} />
    </group>
  );
}

function DroneModel({ sim, enemy }: { sim: PlatformerSim; enemy: Enemy }) {
  const gltf = use(models.drone);
  const obj = useMemo(() => {
    const s = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const k = 1.3 / Math.max(size.x, size.y, size.z);
    s.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x * k, -c.y * k + enemy.h / 2, -c.z * k);
    const g = new THREE.Group();
    g.add(s);
    return g;
  }, [gltf, enemy.h]);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const o = group.current;
    if (!o) return;
    const age = sim.time - enemy.deadAt;
    o.visible = enemy.alive || age < 0.6;
    if (!o.visible) return;
    o.position.set(enemy.x, enemy.y - (enemy.alive ? 0 : age * age * 12), 0);
    o.rotation.y = enemy.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    o.rotation.z = enemy.alive ? Math.sin(clock.elapsedTime * 3 + enemy.id) * 0.15 : age * 6;
  });
  return (
    <group ref={group}>
      <primitive object={obj} />
    </group>
  );
}

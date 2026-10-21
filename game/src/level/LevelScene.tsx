// Màn đi ngang hiển thị bằng chính các model 3D của thành phố: camera nhìn ngang, nền là toà nhà Meshy,
// nhân vật và địch là model đã rig. Toàn bộ luật chơi nằm trong PlatformerSim (platformer.ts).

import {
  Component,
  Suspense,
  use,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Pixelation,
  Vignette,
} from "@react-three/postprocessing";
import { GameBoyPalette, RetroGrade } from "./retroEffects";
import { viewById } from "./views";
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
import { levelById, type LevelEntry, type RigLook } from "./registry";

/** Model tải lỗi (mạng, file thiếu) chỉ làm món đó biến mất, không làm sập cả màn */
export class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Màn nhìn từ trên: mặt phẳng chơi nằm ngang (cả thế giới xoay -90° quanh X), model dựng đứng lại */
const isTop = (sim: PlatformerSim) =>
  viewById(levelById(sim.def.id).view).plane === "top";
/** Góc dựng đứng model trong thế giới đã xoay (thứ tự Euler XYZ: quay mặt quanh trục đứng trước, dựng sau) */
const upright = (sim: PlatformerSim) => (isTop(sim) ? Math.PI / 2 : 0);
/** Đi 8 hướng: vật thể đứng trên mặt sàn (đáy khối nền), không lơ lửng giữa khối */
const zFloor = (sim: PlatformerSim) =>
  sim.mode === "topdown" ? -DEPTH / 2 : 0;
/** Góc quay mặt về hướng (dx, dy) trên mặt đất khi nhìn từ trên: model nhìn +Z, y mô phỏng nằm theo -z */
const groundYaw = (dx: number, dy: number) => Math.atan2(dx, -dy);
/** Góc đích gần góc hiện tại nhất (tránh quay vòng 360° khi đổi hướng qua ±π) */
const nearestAngle = (from: number, to: number) =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Chiều cao tường khi nhìn chéo sa bàn */
const TOP_WALL = 2.6;

/** Bề sâu khối nền (trục z), nhân vật đứng ở z = 0 */
const DEPTH = 4;
const CAM = {
  distance: 18.5,
  height: 2.4,
  fov: 40,
  lookAhead: 2.2,
  damp: 5,
  minY: 5.4,
  maxY: 12,
};

export function LevelCanvas() {
  const sim = useLevel((s) => s.sim);
  const quality = useGame((s) => s.quality);
  if (!sim) return null;
  const th = THEMES[sim.def.theme];
  const top = isTop(sim);
  return (
    <Canvas
      className="level-canvas"
      dpr={quality === "high" ? [1, 1.25] : 1}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{
        fov: CAM.fov,
        near: 0.5,
        far: 600,
        position: [sim.player.x, CAM.minY, CAM.distance],
      }}
    >
      <color attach="background" args={[th.fog]} />
      <fog attach="fog" args={[th.fog, th.fogNear, th.fogFar]} />
      <SimDriver sim={sim} />
      <LevelCamera sim={sim} theme={th} />
      <hemisphereLight
        args={[th.hemi.sky, th.hemi.ground, th.hemi.intensity]}
      />
      <directionalLight
        position={[-20, 30, 25]}
        intensity={th.key.intensity}
        color={th.key.color}
      />
      <directionalLight
        position={[30, 10, -30]}
        intensity={th.rim.intensity}
        color={th.rim.color}
      />
      {top ? (
        sim.mode === "topdown" ? (
          <FloorGround sim={sim} theme={th} entry={levelById(sim.def.id)} />
        ) : (
          <TopGround sim={sim} theme={th} />
        )
      ) : (
        <Sky theme={th} />
      )}
      <group rotation-x={top ? -Math.PI / 2 : 0}>
        <Tiles sim={sim} theme={th} />
        {!top && <Checkpoints sim={sim} />}
        <BossDoors sim={sim} />
        <Shots sim={sim} />
        <Pickups sim={sim} />
        <Chests sim={sim} />
        {sim.mode === "climb" && <GhostFog sim={sim} />}
        <Fx sim={sim} />
        {!top && (
          <Suspense fallback={null}>
            <Backdrop
              width={sim.width}
              theme={th}
              entry={levelById(sim.def.id)}
            />
          </Suspense>
        )}
        <Suspense fallback={<PlaceholderHero sim={sim} />}>
          <Hero sim={sim} theme={th} />
        </Suspense>
        {sim.mode === "shmup" && (
          <Suspense fallback={null}>
            <Hoverbike sim={sim} />
          </Suspense>
        )}
        {sim.enemies.map((e) => (
          <Quiet key={e.id}>
            <Suspense fallback={null}>
              <EnemyModel sim={sim} enemy={e} />
            </Suspense>
          </Quiet>
        ))}
      </group>
      <PostFx sim={sim} />
    </Canvas>
  );
}

/** Chạy mô phỏng theo thời gian thật, phát âm thanh theo sự kiện */
function SimDriver({ sim }: { sim: PlatformerSim }) {
  const seen = useRef(0);
  useFrame((_, dt) => {
    if (!levelInput.paused) {
      const i = levelInput.state();
      // Nhìn từ trên: lên màn hình = tiến (x mô phỏng), trái/phải màn hình = trục y mô phỏng
      const v = viewById(levelById(sim.def.id).view);
      let input = i;
      if (v.iso) {
        // Sa bàn xoay 45°: lên màn hình = (-x, +y) mô phỏng, phải màn hình = (+x, +y)
        const sx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
        const sy = (i.up || i.jump ? 1 : 0) - (i.down ? 1 : 0);
        const dx = sx - sy;
        const dy = sx + sy;
        input = {
          ...i,
          right: dx > 0,
          left: dx < 0,
          up: dy > 0,
          down: dy < 0,
          jump: false,
        };
      } else if (isTop(sim))
        input = {
          ...i,
          right: i.up || i.jump,
          left: i.down,
          up: i.left,
          down: i.right,
          jump: false,
        };
      sim.update(Math.min(dt, 0.1), input);
    }
    for (let i = seen.current; i < sim.fx.length; i++) {
      const f = sim.fx[i];
      if (f.kind === "shot") playSfx("blaster", 0.35);
      else if (f.kind === "hit") playSfx("enemyHurt", 0.4);
      else if (f.kind === "boom") playSfx("enemyDestroy", 0.6);
      else if (f.kind === "pickup" || f.kind === "checkpoint")
        playSfx("pickup", 0.7);
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

function LevelCamera({
  sim,
  theme,
}: {
  sim: PlatformerSim;
  theme: LevelTheme;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const look = useRef(new THREE.Vector3(sim.player.x, CAM.minY, 0));
  const zoom = useRef(1);
  const blend = useRef({
    fov: CAM.fov,
    distance: CAM.distance,
    yaw: 0,
    rise: 1.2,
  });
  const aspect = useThree((s) => s.size.width / s.size.height);
  const viewId = levelById(sim.def.id).view;
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1);
    const v = viewById(viewId);
    const p = sim.player;
    // Đổi góc nhìn: chuyển dần chứ không nhảy cảnh
    const b = blend.current;
    const kb = 1 - Math.exp(-6 * dt);
    b.fov += (v.fov - b.fov) * kb;
    b.distance += (v.distance - b.distance) * kb;
    b.yaw += (v.yaw - b.yaw) * kb;
    b.rise += (v.rise - b.rise) * kb;
    // Điện ảnh: đứng yên thì sát lại, lướt / chạy thì lùi ra
    const speedK = Math.min(1, Math.abs(p.vx) / T.player.dashSpeed);
    const zt =
      v.post === "cinema" ? (sim.bossActive ? 1.35 : 0.85 + speedK * 0.35) : 1;
    zoom.current += (zt - zoom.current) * (1 - Math.exp(-1.5 * dt));
    const dist = b.distance * zoom.current;
    if (Math.abs(camera.fov - b.fov) > 0.01) {
      camera.fov = b.fov;
      camera.updateProjectionMatrix();
    }
    // Sương mù lùi theo khoảng cách camera để góc nhìn phẳng (camera rất xa) không bị mờ hết
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = theme.fogNear + (dist - CAM.distance);
      scene.fog.far = theme.fogFar + (dist - CAM.distance);
    }
    const halfW = Math.tan(THREE.MathUtils.degToRad(b.fov / 2)) * dist * aspect;
    // Đi ngang: bám người chơi, nhìn trước theo hướng chạy. Leo tháp: giữ giữa tháp, bám theo chiều cao.
    // Bay: tâm màn hình chạy theo cuộn tự động
    let tx = p.x + p.facing * v.lookAhead;
    let ty = p.y + CAM.height;
    if (sim.mode === "climb") {
      tx = sim.width / 2;
      ty = p.y + 2;
    } else if (sim.mode === "shmup") {
      tx = sim.scrollX;
      ty = sim.height / 2;
    }
    if (sim.bossActive && sim.mode !== "climb")
      tx = (sim.def.bossArena[0] + sim.def.bossArena[1] + 1) / 2;
    if (sim.mode !== "climb")
      tx = THREE.MathUtils.clamp(tx, halfW, Math.max(halfW, sim.width - halfW));
    ty = THREE.MathUtils.clamp(
      ty,
      CAM.minY,
      Math.max(CAM.minY, sim.height - 6),
    );
    const k = 1 - Math.exp(-v.damp * dt);
    look.current.x += (tx - look.current.x) * k;
    look.current.y += (ty - look.current.y) * k;
    if (v.iso) {
      // Sa bàn: nhìn từ góc (+x, +z) xuống, chúc ~35°; thế giới đã xoay nên y mô phỏng nằm theo -z
      const k2 = 1 - Math.exp(-v.damp * dt);
      look.current.x += (p.x - look.current.x) * k2;
      look.current.y += (p.y - look.current.y) * k2;
      const tz = -look.current.y;
      const pitch = THREE.MathUtils.degToRad(35);
      const h = Math.cos(pitch) * dist;
      camera.up.set(0, 1, 0);
      camera.position.set(
        look.current.x + h * Math.SQRT1_2,
        Math.sin(pitch) * dist - 2,
        tz + h * Math.SQRT1_2,
      );
      camera.lookAt(look.current.x, -2, tz);
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = dist + 10;
        scene.fog.far = dist + 80;
      }
      return;
    }
    if (v.plane === "top") {
      // Nhìn từ trên: thế giới đã xoay nên trục y mô phỏng nằm theo -z; camera hơi lùi về sau cho có phối cảnh
      const cx = sim.scrollX;
      const cz = -sim.height / 2;
      camera.up.set(1, 0, 0);
      camera.position.set(cx - v.rise, dist, cz);
      camera.lookAt(cx + 2, 0, cz);
      return;
    }
    camera.up.set(0, 1, 0);
    camera.position.set(
      look.current.x + Math.sin(b.yaw) * dist,
      look.current.y + b.rise,
      Math.cos(b.yaw) * dist,
    );
    camera.lookAt(look.current.x, look.current.y, 0);
  });
  return null;
}

/** Hậu kỳ theo góc nhìn: 16-bit (vỡ hạt + giảm màu), Game Boy (4 sắc xanh), điện ảnh (hạt phim + quang sai) */
function PostFx({ sim }: { sim: PlatformerSim }) {
  const viewId = levelById(sim.def.id).view;
  const post = viewById(viewId).post;
  if (post === "gameboy")
    return (
      <EffectComposer multisampling={0}>
        <Pixelation granularity={6} />
        <GameBoyPalette />
      </EffectComposer>
    );
  if (post === "snes")
    return (
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={1.1}
          luminanceThreshold={0.95}
          luminanceSmoothing={0.25}
        />
        <RetroGrade />
        <Vignette eskil={false} offset={0.3} darkness={0.5} />
      </EffectComposer>
    );
  if (post === "cinema")
    return (
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={1.2}
          luminanceThreshold={0.95}
          luminanceSmoothing={0.25}
        />
        <ChromaticAberration offset={new THREE.Vector2(0.0009, 0.0006)} />
        <Noise opacity={0.06} />
        <Vignette eskil={false} offset={0.25} darkness={0.6} />
      </EffectComposer>
    );
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={1.0}
        luminanceThreshold={1}
        luminanceSmoothing={0.2}
      />
      <Vignette eskil={false} offset={0.3} darkness={0.35} />
    </EffectComposer>
  );
}

/** Mặt sàn khu phố khi đi 8 hướng: nền gạch dưới chân + đạo cụ đặt theo toạ độ ô (x, y) trên mặt đất */
function FloorGround({
  sim,
  theme,
  entry,
}: {
  sim: PlatformerSim;
  theme: LevelTheme;
  entry: LevelEntry;
}) {
  const tex = useMemo(() => {
    const t = panelTexture();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(sim.width / 2, sim.height / 2);
    return t;
  }, [sim]);
  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[sim.width / 2, -2.02, -sim.height / 2]}
      >
        <planeGeometry args={[sim.width, sim.height]} />
        <meshStandardMaterial
          map={tex}
          color={theme.backFloor}
          roughness={0.8}
        />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[sim.width / 2, -2.1, -sim.height / 2]}
      >
        <planeGeometry args={[sim.width + 200, sim.height + 200]} />
        <meshStandardMaterial color={theme.fog} roughness={1} />
      </mesh>
      {entry.props.map((pr, i) => (
        <Quiet key={i}>
          <Suspense fallback={null}>
            <Prop
              name={pr.name}
              height={pr.height}
              position={[pr.at[0], -2, -pr.at[1]]}
              rotationY={pr.rot ?? 0}
              selfLit={pr.selfLit}
            />
          </Suspense>
        </Quiet>
      ))}
    </group>
  );
}

/** Nền hẻm núi nhìn từ trên: đáy tím sẫm và những cụm pha lê Meshy dọc hai mép vách */
function TopGround({ sim, theme }: { sim: PlatformerSim; theme: LevelTheme }) {
  const crystals = useMemo(() => {
    const list: { x: number; z: number; h: number; rot: number }[] = [];
    for (let x = 8; x < sim.width; x += 13) {
      list.push({ x, z: 3.5, h: 2.6 + (x % 3) * 0.5, rot: x * 0.7 });
      list.push({
        x: x + 6,
        z: -sim.height - 3.5,
        h: 2.4 + (x % 4) * 0.4,
        rot: x * 1.3,
      });
    }
    return list;
  }, [sim]);
  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[sim.width / 2, -2.05, -sim.height / 2]}
      >
        <planeGeometry args={[sim.width + 80, sim.height + 80]} />
        <meshStandardMaterial color={theme.backFloor} roughness={0.9} />
      </mesh>
      {crystals.map((c, i) => (
        <Quiet key={i}>
          <Suspense fallback={null}>
            <Prop
              name="mx_wz_crystal"
              height={c.h}
              position={[c.x, 1.9, c.z]}
              rotationY={c.rot}
              selfLit={0.6}
            />
          </Suspense>
        </Quiet>
      ))}
    </group>
  );
}

/** Trời chạng vạng vùng cách ly: mặt trời đỏ thấp và dải mây tím */
function Sky({ theme }: { theme: LevelTheme }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    theme.sky.forEach((c, i) =>
      grad.addColorStop(i / (theme.sky.length - 1), c),
    );
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
    // Đi 8 hướng (sa bàn): tường thấp TOP_WALL đứng trên sàn thay vì khối dày DEPTH, để nhìn chéo không bị che
    const wallScale =
      sim.mode === "topdown"
        ? new THREE.Matrix4()
            .makeTranslation(0, 0, -DEPTH / 2 + TOP_WALL / 2)
            .scale(new THREE.Vector3(1, 1, TOP_WALL / DEPTH))
        : new THREE.Matrix4();
    const place = (
      mesh: THREE.InstancedMesh | null,
      list: [number, number][],
      dy: number,
    ) => {
      if (!mesh) return;
      list.forEach(([c, r], i) =>
        mesh.setMatrixAt(
          i,
          mesh === refs.solid.current
            ? m.makeTranslation(c + 0.5, r + dy, 0).multiply(wallScale)
            : m.makeTranslation(c + 0.5, r + dy, 0),
        ),
      );
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(refs.solid.current, data.solid, 0.5);
    place(refs.edges.current, data.edges, 0.97);
    // Viền sáng chỉ chạy dọc mép trước của mặt đứng
    refs.edges.current?.position.set(
      0,
      0,
      sim.mode === "topdown" ? -DEPTH / 2 + TOP_WALL : DEPTH / 2,
    );
    place(refs.ledges.current, data.ledges, 0.88);
    place(refs.spikes.current, data.spikes, 0.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  return (
    <group>
      <instancedMesh
        ref={refs.solid}
        args={[undefined, undefined, data.solid.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, DEPTH]} />
        <meshStandardMaterial
          map={tex}
          color={theme.tile}
          roughness={0.7}
          metalness={0.15}
        />
      </instancedMesh>
      <instancedMesh
        ref={refs.edges}
        args={[undefined, undefined, data.edges.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1.001, 0.08, 0.08]} />
        <meshBasicMaterial color={theme.edge} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={refs.ledges}
        args={[undefined, undefined, data.ledges.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 0.14, DEPTH * 0.55]} />
        <meshStandardMaterial
          color={theme.ledge}
          emissive={theme.ledge}
          emissiveIntensity={0.3}
          metalness={0.4}
          roughness={0.45}
        />
      </instancedMesh>
      <instancedMesh
        ref={refs.spikes}
        args={[undefined, undefined, data.spikes.length]}
        frustumCulled={false}
      >
        <coneGeometry args={[0.38, 0.6, 4]} />
        <meshStandardMaterial
          color="#5a0f1c"
          emissive="#ff2a4d"
          emissiveIntensity={2.2}
        />
      </instancedMesh>
    </group>
  );
}

function Checkpoints({ sim }: { sim: PlatformerSim }) {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame(() => {
    sim.def.checkpoints.forEach((_, i) => {
      const m = mats.current[i];
      if (m)
        m.color.setRGB(
          ...((i <= sim.checkpointIndex ? [0.4, 3, 1.2] : [2.4, 1.2, 0.2]) as [
            number,
            number,
            number,
          ]),
        );
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
            <meshBasicMaterial
              ref={(m) => void (mats.current[i] = m)}
              toneMapped={false}
            />
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
    group.current.children.forEach(
      (c) =>
        ((c as THREE.Mesh).scale.x =
          0.8 + Math.sin(clock.elapsedTime * 20) * 0.2),
    );
  });
  const [a, b] = sim.def.bossArena;
  return (
    <group ref={group}>
      {[a - 0.5, b + 1.5].map((x) => (
        <mesh key={x} position={[x, sim.height / 2, 0]}>
          <boxGeometry args={[0.25, sim.height, 0.6]} />
          <meshBasicMaterial
            color={[3, 0.3, 0.5]}
            transparent
            opacity={0.4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

const SHOT_POOL = 40;
const SHOT_COLORS = {
  player: [
    new THREE.Color(1.2, 2.6, 3),
    new THREE.Color(0.6, 3, 1.4),
    new THREE.Color(3, 1.2, 3),
  ],
  enemy: [
    new THREE.Color(3, 1.2, 0.3),
    new THREE.Color(3, 0.4, 0.4),
    new THREE.Color(2.6, 0.3, 2.2),
  ],
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
      mat
        .makeScale(s.r * 2 * stretch, s.r * 2, s.r * 2)
        .setPosition(
          s.x,
          s.y,
          zFloor(sim) + (sim.mode === "topdown" ? 1 : 0.2),
        );
      m.setMatrixAt(i, mat);
      m.setColorAt(
        i,
        (s.enemy ? SHOT_COLORS.enemy : SHOT_COLORS.player)[s.level],
      );
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, SHOT_POOL]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.5, 12, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

const PICKUP_POOL = 48;
const RARITY_GLOW: Record<string, [number, number, number]> = {
  common: [1.6, 1.7, 1.8],
  rare: [0.5, 1.6, 3],
  epic: [2, 0.8, 3],
  legendary: [3, 2.1, 0.4],
  mythic: [3, 0.4, 0.6],
};

/** Hình dạng đồ rơi: viên máu (xanh lá), linh kiện (khối bát diện + cột sáng màu độ hiếm), CRED (đồng xu),
 * Chìa rương (chìa xanh ngọc), mảnh Chìa mùa (mảnh đồng) */
function Pickups({ sim }: { sim: PlatformerSim }) {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(
    () => ({
      health: new THREE.CapsuleGeometry(0.16, 0.28, 4, 8),
      part: new THREE.OctahedronGeometry(0.3),
      cred: new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20).rotateX(
        Math.PI / 2,
      ),
      chestKey: new THREE.TorusGeometry(0.14, 0.05, 8, 16)
        .translate(0, 0.16, 0)
        .rotateZ(0),
      keyShard: new THREE.TetrahedronGeometry(0.26),
      beam: new THREE.CylinderGeometry(0.06, 0.18, 3, 10, 1, true).translate(
        0,
        1.5,
        0,
      ),
    }),
    [],
  );
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    let i = 0;
    for (const k of sim.pickups) {
      if (k.taken || i >= PICKUP_POOL) continue;
      const slot = g.children[i++] as THREE.Group;
      const body = slot.children[0] as THREE.Mesh;
      const beam = slot.children[1] as THREE.Mesh;
      slot.visible = true;
      const resting = k.vx === 0 && k.vy === 0;
      slot.position.set(
        k.x,
        k.y +
          (resting && sim.mode !== "topdown"
            ? 0.35 + Math.sin(t * 3 + i) * 0.08
            : 0.15),
        sim.mode === "topdown"
          ? zFloor(sim) + 0.5 + Math.sin(t * 3 + i) * 0.08
          : 0.2,
      );
      body.rotation.y = t * 2.4;
      const d = k.drop;
      body.geometry = geo[d.kind];
      const color =
        d.kind === "part"
          ? RARITY_GLOW[d.part.rarity]
          : d.kind === "cred"
            ? [3, 2.2, 0.4]
            : d.kind === "chestKey"
              ? [0.4, 3, 1.8]
              : d.kind === "keyShard"
                ? [2.4, 1.2, 0.5]
                : [0.4, 3, 1];
      (body.material as THREE.MeshBasicMaterial).color.setRGB(
        color[0],
        color[1],
        color[2],
      );
      // Cột sáng chỉ cho linh kiện từ Hiếm trở lên, cao dần theo độ hiếm
      const tall =
        d.kind === "part"
          ? ["common", "rare", "epic", "legendary", "mythic"].indexOf(
              d.part.rarity,
            )
          : -1;
      beam.visible = tall >= 1;
      if (beam.visible) {
        beam.scale.set(1, 0.6 + tall * 0.35, 1);
        const bm = beam.material as THREE.MeshBasicMaterial;
        bm.color.setRGB(color[0], color[1], color[2]);
        bm.opacity = 0.35 + Math.sin(t * 4) * 0.08;
      }
    }
    for (; i < PICKUP_POOL; i++) g.children[i].visible = false;
  });
  return (
    <group ref={group}>
      {Array.from({ length: PICKUP_POOL }, (_, i) => (
        <group key={i} visible={false}>
          <mesh geometry={geo.health}>
            <meshBasicMaterial toneMapped={false} />
          </mesh>
          <mesh geometry={geo.beam}>
            <meshBasicMaterial
              transparent
              depthWrite={false}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Sương ma dâng từ dưới tháp: khối mờ tím ngọc, mặt trên gợn sóng sáng */
function GhostFog({ sim }: { sim: PlatformerSim }) {
  const group = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.position.y = sim.fogY;
    group.current.visible = !sim.bossActive;
    if (surface.current) {
      const m = surface.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.55 + Math.sin(clock.elapsedTime * 3) * 0.1;
    }
  });
  const w = sim.width + 40;
  return (
    <group ref={group}>
      <mesh position={[sim.width / 2, -20, 0]}>
        <boxGeometry args={[w, 40, DEPTH + 6]} />
        <meshBasicMaterial
          color={[0.35, 0.15, 0.55]}
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={surface}
        position={[sim.width / 2, 0.05, 0]}
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry args={[w, DEPTH + 6]} />
        <meshBasicMaterial
          color={[1.2, 2.6, 2.2]}
          transparent
          opacity={0.6}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Xe bay hoverbike dưới chân người chơi ở chế độ bay */
function Hoverbike({ sim }: { sim: PlatformerSim }) {
  const { root } = useFitted("mx_veh_hoverbike", 2.8, "longest", 0.35);
  const ref = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const p = sim.player;
    const o = ref.current;
    if (!o) return;
    o.position.set(
      p.x - 0.1,
      p.y - 0.05 + Math.sin(clock.elapsedTime * 6) * 0.05,
      0,
    );
    // Nghiêng theo hướng bay
    o.rotation.z = THREE.MathUtils.damp(o.rotation.z, p.vy * 0.04, 8, 1 / 60);
    o.rotation.x = upright(sim);
    if (flame.current) flame.current.scale.x = 0.8 + Math.random() * 0.5;
  });
  return (
    <group ref={ref}>
      {/* Model xe bay dài theo trục X sẵn: giữ nguyên hướng, nhìn ngang thấy cả thân xe */}
      <primitive object={root} />
      <mesh ref={flame} position={[-1.5, 0.45, 0]} rotation-z={Math.PI / 2}>
        <coneGeometry args={[0.18, 0.9, 10]} />
        <meshBasicMaterial
          color={[0.6, 2.4, 3]}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

const CHEST_TINT = {
  bronze: "#e09a5a",
  silver: "#dfe8f5",
  gold: "#ffd23d",
} as const;

/** Rương giấu: hòm tiếp tế Meshy nhuộm theo bậc, viền sáng khi còn khoá, tắt sáng khi đã mở */
function Chests({ sim }: { sim: PlatformerSim }) {
  return (
    <>
      {sim.chests.map((_, i) => (
        <Quiet key={i}>
          <Suspense fallback={null}>
            <ChestModel sim={sim} index={i} />
          </Suspense>
        </Quiet>
      ))}
    </>
  );
}

function ChestModel({ sim, index }: { sim: PlatformerSim; index: number }) {
  const c = sim.chests[index];
  const { root } = useFitted(
    "mx_supply_crate",
    c.tier === "gold" ? 1.3 : 1.05,
    "height",
    0.3,
  );
  const glow = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  useMemo(() => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.color.set(CHEST_TINT[c.tier]);
      m.material = mat;
    });
  }, [root, c.tier]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y = c.opened
        ? 0.4
        : Math.sin(t * 1.5 + index) * 0.15;
      group.current.scale.setScalar(c.opened ? 0.9 : 1);
    }
    if (glow.current) {
      glow.current.visible = !c.opened;
      glow.current.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    }
  });
  const tint = new THREE.Color(CHEST_TINT[c.tier]).multiplyScalar(2.2);
  return (
    <group
      position={[c.x, c.y, sim.mode === "topdown" ? zFloor(sim) : -0.2]}
      rotation-x={upright(sim)}
    >
      <group ref={group}>
        <primitive object={root} />
      </group>
      <mesh ref={glow} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.7, 0.9, 32]} />
        <meshBasicMaterial
          color={tint}
          transparent
          opacity={0.7}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
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
      const life =
        f.kind === "boom"
          ? 0.55
          : f.kind === "hit"
            ? 0.18
            : f.kind === "land"
              ? 0.25
              : f.kind === "dust"
                ? 0.35
                : 0;
      const age = sim.time - f.at;
      if (!life || age > life) continue;
      const o = g.children[i++] as THREE.Mesh;
      const u = age / life;
      const size =
        f.kind === "boom"
          ? 0.4 + u * 2.4
          : f.kind === "land"
            ? 0.3 + u * 1.2
            : f.kind === "dust"
              ? 0.12 + u * 0.3
              : 0.25 + u * 0.5;
      o.visible = true;
      o.position.set(
        f.x,
        f.y + (f.kind === "land" ? 0.1 : f.kind === "dust" ? u * 0.4 : 0),
        zFloor(sim) + (sim.mode === "topdown" ? 1.2 : 0.4),
      );
      o.scale.set(size, f.kind === "land" ? size * 0.25 : size, size);
      const mat = o.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - u) * (f.kind === "dust" ? 0.5 : 1);
      mat.color.setRGB(
        ...((f.kind === "boom"
          ? [3, 1.4, 0.4]
          : f.kind === "land"
            ? [1, 1, 1.4]
            : f.kind === "dust"
              ? [0.75, 0.72, 0.8]
              : [2.6, 2.6, 3]) as [number, number, number]),
      );
    }
    for (; i < FX_POOL; i++) g.children[i].visible = false;
    // Quầng nạp đạn quanh nhân vật
    const c = charge.current;
    if (c) {
      const p = sim.player;
      const lvl =
        p.charge >= T.shot.chargeFull
          ? 2
          : p.charge >= T.shot.chargeMid
            ? 1
            : 0;
      c.visible = lvl > 0 && sim.status === "playing";
      c.position.set(
        p.x,
        p.y + (sim.mode === "topdown" ? 0 : 1),
        zFloor(sim) + (sim.mode === "topdown" ? 1 : 0.3),
      );
      const pulse = 1 + Math.sin(sim.time * (lvl === 2 ? 40 : 22)) * 0.15;
      c.scale.setScalar((lvl === 2 ? 1.3 : 0.95) * pulse);
      (c.material as THREE.MeshBasicMaterial).color.setRGB(
        ...((lvl === 2 ? [3, 1, 3] : [0.6, 3, 1.4]) as [
          number,
          number,
          number,
        ]),
      );
    }
  });
  return (
    <>
      <group ref={group}>
        {Array.from({ length: FX_POOL }, (_, i) => (
          <mesh key={i} visible={false}>
            <sphereGeometry args={[0.5, 12, 8]} />
            <meshBasicMaterial
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <mesh ref={charge} visible={false}>
        <sphereGeometry args={[0.9, 16, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Nền: toà nhà và đạo cụ Meshy xếp thành ba lớp xa dần để có cảm giác thị sai khi camera chạy ngang

function Backdrop({
  width,
  theme,
  entry,
}: {
  width: number;
  theme: LevelTheme;
  entry: LevelEntry;
}) {
  const back = useMemo(() => {
    const list: { name: ExtraModel; x: number; h: number; z: number }[] = [];
    let i = 0;
    for (let x = 6; x < width + 30; x += 24) {
      list.push({
        name: entry.backBuildings[i % entry.backBuildings.length],
        x,
        h: 22 + ((i * 7) % 4) * 5,
        z: -64 - (i % 2) * 16,
      });
      i++;
    }
    return list;
  }, [width, entry]);
  return (
    <group>
      {/* Nền đất phía sau làn chơi */}
      <mesh rotation-x={-Math.PI / 2} position={[width / 2, -0.02, -60]}>
        <planeGeometry args={[width + 400, 116]} />
        <meshStandardMaterial color={theme.backFloor} roughness={0.95} />
      </mesh>
      {back.map((b, i) => (
        <Quiet key={i}>
          <Suspense fallback={null}>
            <Prop
              name={b.name}
              height={b.h}
              position={[b.x, 0, b.z]}
              rotationY={0}
              selfLit={theme.backSelfLit}
            />
          </Suspense>
        </Quiet>
      ))}
      {/* Đạo cụ lớp giữa và sát làn chơi của từng map; mỗi món tải riêng để món nào xong hiện món đó */}
      {entry.props.map((pr, i) => (
        <Quiet key={`p${i}`}>
          <Suspense fallback={null}>
            <Prop
              name={pr.name}
              height={pr.height}
              position={pr.at}
              rotationY={pr.rot ?? 0}
              selfLit={pr.selfLit}
            />
          </Suspense>
        </Quiet>
      ))}
    </group>
  );
}

function Prop({
  name,
  height,
  position,
  rotationY,
  selfLit = 0.3,
}: {
  name: ExtraModel;
  height: number;
  position: [number, number, number];
  rotationY: number;
  selfLit?: number;
}) {
  const { root } = useFitted(name, height, "height", selfLit);
  return (
    <primitive object={root} position={position} rotation={[0, rotationY, 0]} />
  );
}

// ---------------------------------------------------------------------------
// Nhân vật có xương: dựng một lần, đổi clip bằng crossfade

export type Rig = {
  scene: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  current: string;
};

export function buildRig(
  base: THREE.Object3D,
  clips: Record<string, THREE.AnimationClip | undefined>,
  height: number,
  selfLit = 0.25,
): Rig {
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
  for (const n of ["death", "jump", "hit", "attack"])
    if (actions[n]) once(actions[n]);
  const first = actions.idle ?? actions.walk ?? Object.values(actions)[0];
  first?.play();
  return {
    scene,
    mixer,
    actions,
    current: first
      ? Object.keys(actions).find((k) => actions[k] === first)!
      : "",
  };
}

export function setAnim(rig: Rig, name: string, fade = 0.15, restart = false) {
  const next = rig.actions[name];
  if (!next || (rig.current === name && !restart)) return;
  const prev = rig.actions[rig.current];
  next.reset().setEffectiveWeight(1).play();
  if (prev && prev !== next) next.crossFadeFrom(prev, fade, false);
  rig.current = name;
}

/** Tô màu đỏ / trắng khi trúng đạn, nhấp nháy khi bất tử */
export function flash(scene: THREE.Object3D, amount: number, color: THREE.Color) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat.userData.baseEmissive)
      mat.userData.baseEmissive = {
        c: mat.emissive.clone(),
        i: mat.emissiveIntensity,
        map: mat.emissiveMap,
      };
    const b = mat.userData.baseEmissive as {
      c: THREE.Color;
      i: number;
      map: THREE.Texture | null;
    };
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
export const WHITE = new THREE.Color(1, 1, 1);
export const RED = new THREE.Color(1, 0.15, 0.1);

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
    return {
      rig,
      air: airWindow(g.jump.animations[0]),
      climb: new ClimbPose(rig.scene),
    };
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
    // Cưỡi xe bay: ngồi cao hơn mặt xe một chút
    o.position.set(p.x, p.y + (sim.mode === "shmup" ? 0.55 : 0), zFloor(sim));
    // Sát tường trên không: quay mặt vào tường để bám/leo; còn lại quay theo hướng chạy
    const onWall = p.wallNear !== 0 && sim.status === "playing" && p.knock <= 0;
    yaw.current = THREE.MathUtils.damp(
      yaw.current,
      sim.mode === "topdown"
        ? nearestAngle(yaw.current, groundYaw(p.aimX, p.aimY))
        : faceYaw(onWall ? p.wallNear : p.facing),
      16,
      dt,
    );
    o.rotation.y = yaw.current;
    o.rotation.x = upright(sim);
    // Lướt: chúi người về trước; bám tường: ngả nhẹ ra khỏi tường. Đổi dần cho mượt
    const leanTarget =
      p.dashTime > 0 ? -p.facing * 0.22 : onWall ? -p.wallNear * 0.08 : 0;
    lean.current = THREE.MathUtils.damp(lean.current, leanTarget, 14, dt);
    o.rotation.z = lean.current;
    // Chạm đất: nén nhẹ rồi bật lại
    if (p.onGround && !wasGround.current) squash.current = 0.86;
    wasGround.current = p.onGround;
    squash.current = THREE.MathUtils.damp(squash.current, 1, 12, dt);
    o.scale.set(
      1 / Math.sqrt(squash.current),
      squash.current,
      1 / Math.sqrt(squash.current),
    );

    const shooting = sim.time - lastShotAt(sim) < 0.35;
    const jump = rig.actions.jump;
    if (sim.status === "dead") setAnim(rig, "death", 0.1);
    else if (p.knock > 0) setAnim(rig, "hit", 0.05);
    else if (sim.mode === "shmup" && jump) {
      // Tư thế ngồi lái: khung giữa của clip nhảy (chân co)
      setAnim(rig, "jump", 0.1);
      jump.time = THREE.MathUtils.lerp(air.start, air.end, 0.5);
      jump.timeScale = 0;
    } else if (!p.onGround && jump) {
      // Trên không: tư thế nhảy chọn theo vận tốc dọc (lên → đỉnh → rơi), không phát cả clip
      setAnim(rig, "jump", 0.1);
      const P = T.player;
      const u =
        p.vy > 0
          ? 0.5 * (1 - Math.min(1, p.vy / P.jumpVel))
          : 0.5 + 0.5 * Math.min(1, -p.vy / P.maxFall);
      const t = THREE.MathUtils.lerp(
        air.start,
        air.end,
        p.wall !== 0 ? 0.45 : u,
      );
      jump.time = THREE.MathUtils.damp(jump.time, t, 20, dt);
      jump.timeScale = 0;
    } else if (Math.hypot(p.vx, sim.mode === "topdown" ? p.vy : 0) > 0.5)
      setAnim(rig, shooting || p.dashTime > 0 ? "runshoot" : "run", 0.12);
    else setAnim(rig, shooting ? "runshoot" : "idle", 0.15);
    const run = rig.actions.run;
    if (run) run.timeScale = p.dashTime > 0 ? 1.6 : 1.15;
    if (rig.actions.runshoot)
      rig.actions.runshoot.timeScale =
        Math.hypot(p.vx, sim.mode === "topdown" ? p.vy : 0) > 0.5
          ? p.dashTime > 0
            ? 1.6
            : 1.15
          : 0.0001;
    rig.mixer.update(dt);
    // Động tác leo / trượt tường đè lên tư thế của clip, trộn dần vào và ra
    climb.apply(onWall ? p.wallNear : 0, p.vy, p.y, dt);
    // Trượt tường: bụi bắn ra ở chỗ tay chân miết vào tường
    if (onWall && p.vy < -1 && sim.time - lastDust.current > 0.12) {
      lastDust.current = sim.time;
      sim.fx.push({
        kind: "dust",
        x: p.x + p.wallNear * (p.w / 2),
        y: p.y + 0.3,
        at: sim.time,
      });
    }
    // Nhấp nháy khi bất tử sau khi trúng đòn
    o.visible =
      sim.status === "dead" ||
      p.invuln <= 0 ||
      Math.floor(sim.time * 20) % 2 === 0;

    // Bóng tròn dưới chân: chiếu xuống mặt đất gần nhất bên dưới
    const sh = shadow.current;
    if (sh) {
      let gy = Math.floor(p.y);
      while (gy > 0 && sim.tile(Math.floor(p.x), gy - 1) === ".") gy--;
      const h = p.y - gy;
      sh.position.set(p.x, gy + 0.02, 0.3);
      sh.visible = sim.mode !== "topdown" && sim.mode !== "shmup";
      sh.scale.setScalar(Math.max(0.35, 1 - h * 0.12));
      (sh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0.1,
        0.45 - h * 0.05,
      );
    }
    // Đèn đặt hẳn phía trước mặt đứng của khối nền (z = DEPTH/2) để không đốt cháy sáng mặt tường khi bám tường
    light.current?.position.set(p.x, p.y + 1.6, DEPTH / 2 + 2.4);
  });
  return (
    <>
      <group ref={group}>
        <primitive object={rig.scene} />
      </group>
      <mesh ref={shadow} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial
          color="#000"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
      {/* Đèn rọi đi theo nhân vật chính để luôn sáng hơn nền */}
      <pointLight
        ref={light}
        intensity={6}
        distance={7}
        decay={1.4}
        color="#ffffff"
      />
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
    this.weight = THREE.MathUtils.damp(
      this.weight,
      wall !== 0 ? 1 : 0,
      wall !== 0 ? 16 : 10,
      dt,
    );
    this.rising = THREE.MathUtils.damp(this.rising, vy > 0.5 ? 1 : 0, 10, dt);
    if (this.weight < 0.01) return;
    const s = this.side;
    // Nhịp leo theo độ cao đã leo: mỗi ~1.4m đổi tay
    const c = Math.sin(height * 2.3);
    const r = this.rising;
    const mix = (a: [number, number, number], b: [number, number, number]) =>
      [
        a[0] + (b[0] - a[0]) * r,
        a[1] + (b[1] - a[1]) * r,
        a[2] + (b[2] - a[2]) * r,
      ] as [number, number, number];
    // [trượt, leo] cho từng xương; tay/chân "gần" là bên trái hay phải tuỳ hướng tường không quan trọng vì nhìn ngang
    const pose: [string, [number, number, number]][] = [
      ["Spine01", mix([s * 0.15, 1, 0], [s * 0.22, 1, 0])],
      ["LeftArm", mix([s * 0.55, 0.8, 0.1], [s * 0.45, 0.55 + 0.4 * c, 0.15])],
      ["LeftForeArm", mix([s * 0.45, 0.9, 0], [s * 0.3, 1, 0])],
      [
        "RightArm",
        mix([-s * 0.25, -0.95, 0.2], [s * 0.45, 0.55 - 0.4 * c, -0.15]),
      ],
      ["RightForeArm", mix([s * 0.2, -0.9, 0.3], [s * 0.3, 1, 0])],
      [
        "LeftUpLeg",
        mix([s * 0.55, -0.45, 0.1], [s * 0.5, -0.55 - 0.35 * c, 0.1]),
      ],
      ["LeftLeg", mix([s * 0.35, -0.95, 0], [s * 0.2, -1, 0])],
      [
        "RightUpLeg",
        mix([s * 0.1, -1, -0.1], [s * 0.5, -0.55 + 0.35 * c, -0.1]),
      ],
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
  const track = clip?.tracks.find(
    (t) => t.name.endsWith(".position") && /hips/i.test(t.name),
  );
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
export function addOutline(
  scene: THREE.Object3D,
  color: string,
  worldThickness: number,
) {
  scene.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh)
      meshes.push(o as THREE.SkinnedMesh);
  });
  const ws = new THREE.Vector3();
  for (const m of meshes) {
    m.getWorldScale(ws);
    const thickness = worldThickness / Math.max(1e-6, ws.x);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(1.6),
      side: THREE.BackSide,
      toneMapped: false,
    });
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
  for (let i = sim.fx.length - 1; i >= 0; i--)
    if (sim.fx[i].kind === "shot") return sim.fx[i].at;
  return -9;
}

/** Hộp tạm trong lúc model nhân vật đang tải */
function PlaceholderHero({ sim }: { sim: PlatformerSim }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() =>
    ref.current?.position.set(sim.player.x, sim.player.y + 0.9, 0),
  );
  return (
    <mesh ref={ref}>
      <capsuleGeometry args={[0.35, 1.1, 4, 8]} />
      <meshStandardMaterial
        color="#05d9e8"
        emissive="#05d9e8"
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}

function EnemyModel({ sim, enemy }: { sim: PlatformerSim; enemy: Enemy }) {
  if (enemy.kind === "drone") return <DroneModel sim={sim} enemy={enemy} />;
  return (
    <RiggedEnemy
      sim={sim}
      enemy={enemy}
      spec={levelById(sim.def.id).looks[enemy.kind]}
    />
  );
}

function RiggedEnemy({
  sim,
  enemy,
  spec,
}: {
  sim: PlatformerSim;
  enemy: Enemy;
  spec: RigLook;
}) {
  const entries = Object.entries(spec.clips);
  // Clip ghi đủ tên model ("mx_...") là mượn từ nhân vật Meshy khác (chung tên xương)
  const gltfs = entries.map(([, file]) =>
    use(
      extraModel(
        (file.startsWith("mx_") ? file : `${spec.base}_${file}`) as ExtraModel,
      ),
    ),
  );
  const rig = useMemo(() => {
    const clips: Record<string, THREE.AnimationClip | undefined> = {};
    entries.forEach(([name], i) => (clips[name] = gltfs[i].animations[0]));
    return buildRig(
      gltfs[0].scene,
      clips,
      spec.height,
      enemy.kind === "boss" ? 0.45 : 0.35,
    );
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
    o.position.set(
      e.x,
      e.y,
      zFloor(sim) +
        (enemy.kind === "boss" && sim.mode !== "topdown" ? -0.3 : 0),
    );
    o.rotation.x = upright(sim);
    yaw.current = THREE.MathUtils.damp(
      yaw.current,
      sim.mode === "topdown"
        ? nearestAngle(
            yaw.current,
            groundYaw(sim.player.x - e.x, sim.player.y - e.y),
          )
        : faceYaw(e.facing),
      10,
      dt,
    );
    o.rotation.y = yaw.current;
    if (!e.alive) setAnim(rig, "death", 0.1);
    else if (
      sim.time - e.hurtAt < 0.15 &&
      e.kind === "boss" &&
      rig.actions.hit &&
      e.move !== "jump"
    )
      setAnim(rig, "walk", 0.1);
    else if (e.kind === "trooper")
      setAnim(
        rig,
        sim.time - e.firedAt < 0.6
          ? "shoot"
          : Math.hypot(e.vx, sim.mode === "topdown" ? e.vy : 0) > 0.1
            ? "walk"
            : "idle",
        0.15,
      );
    else if (e.kind === "zombie")
      setAnim(
        rig,
        Math.hypot(e.vx, sim.mode === "topdown" ? e.vy : 0) > 1.5
          ? "run"
          : "walk",
        0.2,
      );
    else if (e.kind === "boss") {
      const anim = !e.awake
        ? "scream"
        : e.move === "volley"
          ? "attack"
          : e.move === "jump"
            ? "run"
            : "walk";
      setAnim(rig, anim, 0.2);
    }
    rig.mixer.update(
      Math.min(dt, 0.1) * (e.awake || e.kind !== "boss" ? 1 : 0.3),
    );
    const hurt = sim.time - e.hurtAt;
    flash(
      rig.scene,
      e.alive && hurt < 0.1 ? 1 - hurt / 0.1 : 0,
      e.kind === "boss" ? WHITE : RED,
    );
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
    o.position.set(
      enemy.x,
      enemy.y - (enemy.alive ? 0 : age * age * 12),
      zFloor(sim) + (sim.mode === "topdown" ? 1.6 : 0),
    );
    o.rotation.y = enemy.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    o.rotation.x = upright(sim);
    o.rotation.z = enemy.alive
      ? Math.sin(clock.elapsedTime * 3 + enemy.id) * 0.15
      : age * 6;
  });
  return (
    <group ref={group}>
      <primitive object={obj} />
    </group>
  );
}

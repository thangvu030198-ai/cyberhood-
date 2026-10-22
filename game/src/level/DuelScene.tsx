// Đấu trường đối kháng 1v1 (học từ Bloody Roar 2): sàn ô vuông rêu phong, hàng rào cọc quanh sàn,
// camera ngang tự zoom theo khoảng cách hai võ sĩ, hai thanh máu, đồng hồ hiệp, FIGHT! / K.O.

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { extraModel, playSfx, type ExtraModel } from "../game/assets";
import { once } from "../game/meshyAnim";
import { useFitted } from "../game/Showcase";
import { useGame } from "../game/store";
import { DUEL, RIVALS, type DuelInput, type DuelSim, type Fighter, type MoveId } from "./duel";
import { FIGHT_CLIPS, fightModel, type FightClip } from "./fightClips";
import { GEAR, type GearId } from "./gear";
import { DUEL_REWARD, settleDuel, useDuel } from "./duelSession";
import { bindLevelKeys, levelInput } from "./levelInput";
import { PunchGrade } from "./retroEffects";
import { addOutline, buildRig, flash, Quiet, RED, setAnim, WHITE } from "./LevelScene";

/** Phím: A/D đi, W/Space nhảy, S đỡ (giữ S + đòn = đòn thấp), J đấm, K đá, L né */
function duelInput(): DuelInput {
  const i = levelInput.state();
  return { left: i.left, right: i.right, jump: i.jump || i.up, block: i.down, punch: i.shoot, kick: i.dash, dodge: i.melee };
}

export function DuelCanvas() {
  const sim = useDuel((s) => s.sim);
  const quality = useGame((s) => s.quality);
  if (!sim) return null;
  return (
    <Canvas
      className="level-canvas"
      dpr={quality === "high" ? [1, 1.25] : 1}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 34, near: 0.3, far: 300, position: [0, 2.2, 11] }}
    >
      <color attach="background" args={["#07040f"]} />
      <fog attach="fog" args={["#1a0a26", 16, 62]} />
      <DuelDriver sim={sim} />
      <DuelCamera sim={sim} />
      <hemisphereLight args={["#9aa4ff", "#120618", 0.7]} />
      <directionalLight position={[-6, 12, 8]} intensity={2.2} color="#f0e8ff" />
      <directionalLight position={[8, 5, -6]} intensity={1.6} color="#ff4fd8" />
      <Arena />
      <Quiet>
        <Suspense fallback={null}>
          <Throne />
          <ArenaProps />
        </Suspense>
      </Quiet>
      <Quiet>
        <Suspense fallback={null}>
          <DuelFighter key={`p${sim.rival.id}`} sim={sim} who="player" />
        </Suspense>
      </Quiet>
      <Quiet>
        <Suspense fallback={null}>
          <DuelFighter key={sim.rival.id} sim={sim} who="foe" />
        </Suspense>
      </Quiet>
      <HitSparks sim={sim} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1} luminanceSmoothing={0.2} />
        <PunchGrade />
        <Vignette eskil={false} offset={0.3} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}

/** Khựng hình khi trúng đòn (hitstop) và rung camera: đòn nặng / đánh ngã khựng lâu hơn, rung mạnh hơn */
const impact = { freeze: 0, shake: 0 };

function DuelDriver({ sim }: { sim: DuelSim }) {
  const seen = useRef(0);
  useFrame((_, dt) => {
    impact.freeze -= dt;
    impact.shake = Math.max(0, impact.shake - dt * 2.5);
    if (!levelInput.paused && impact.freeze <= 0) sim.update(Math.min(dt, 0.1), duelInput());
    for (let i = seen.current; i < sim.events.length; i++) {
      const e = sim.events[i];
      if (e.kind === "hit" || e.kind === "knock" || e.kind === "ko") {
        const heavy = e.kind !== "hit" || (e.move && DUEL.moves[e.move].damage >= 10);
        impact.freeze = e.kind === "ko" ? 0.35 : heavy ? 0.11 : 0.05;
        impact.shake = Math.max(impact.shake, e.kind === "ko" ? 0.5 : heavy ? 0.28 : 0.1);
      } else if (e.kind === "block") impact.freeze = 0.04;
      if (e.kind === "hit" || e.kind === "knock") playSfx(e.kind === "knock" || (e.move && DUEL.moves[e.move].hit === "body") ? "enemyDestroy" : "enemyHurt", 0.6);
      else if (e.kind === "block") playSfx("blaster", 0.25);
      else if (e.kind === "ko") playSfx("enemyDestroy", 1);
    }
    seen.current = sim.events.length;
  });
  return null;
}

function DuelCamera({ sim }: { sim: DuelSim }) {
  const camera = useThree((s) => s.camera);
  const c = useRef(new THREE.Vector3(0, 1.4, 11));
  useFrame((_, dt) => {
    const mid = (sim.player.x + sim.foe.x) / 2;
    const gap = Math.abs(sim.player.x - sim.foe.x);
    // Hai người càng xa nhau camera càng lùi; K.O. thì sát lại
    const ko = sim.status !== "fight" && sim.status !== "intro";
    const dist = ko ? 6.5 : THREE.MathUtils.clamp(7 + gap * 0.9, 7.5, 15);
    const k = 1 - Math.exp(-4 * Math.min(dt, 0.1));
    c.current.x += (mid - c.current.x) * k;
    c.current.z += (dist - c.current.z) * k;
    const t = performance.now() / 1000;
    const sh = impact.shake * impact.shake;
    camera.position.set(c.current.x + Math.sin(t * 61) * sh * 0.5, 2.1 + Math.sin(t * 47) * sh * 0.35, c.current.z);
    camera.lookAt(c.current.x, 1.25, 0);
  });
  return null;
}

/** Sàn đấu: ô vuông rêu phong, mép đá, hàng cọc gỗ phía sau, khán đài tối */
/** Võ đài ngầm Neon: sàn thép vòng bát giác phát sáng, lồng lưới thép, khán giả bóng tối giơ đèn, màn hình lớn, giàn đèn */
function Arena() {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 1024;
    cv.height = 256;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#14131c";
    g.fillRect(0, 0, 1024, 256);
    // Tấm thép chống trượt
    for (let y = 0; y < 256; y += 32)
      for (let x = 0; x < 1024; x += 64) {
        const v = 26 + ((x * 7 + y * 3) % 13);
        g.fillStyle = `rgb(${v},${v},${v + 8})`;
        g.fillRect(x + 1, y + 1, 62, 30);
        g.fillStyle = "rgba(255,255,255,0.05)";
        for (let k = 0; k < 6; k++) g.fillRect(x + 6 + k * 10, y + 8 + (k % 2) * 10, 6, 2);
      }
    // Vòng bát giác neon giữa sàn + vạch xuất phát hai bên
    const ring = (r: number, col: string, w: number) => {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.shadowColor = col;
      g.shadowBlur = 18;
      g.beginPath();
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const px = 512 + Math.cos(a) * r * 3.2;
        const py = 128 + Math.sin(a) * r;
        if (k) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.stroke();
    };
    ring(110, "#00f0ff", 6);
    ring(70, "#ff2fd0", 3);
    g.shadowBlur = 0;
    g.fillStyle = "rgba(0,240,255,0.18)";
    g.font = "900 64px sans-serif";
    g.textAlign = "center";
    g.fillText("CYBERHOOD", 512, 150);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  // Lưới thép lồng đấu (trong suốt theo kênh alpha)
  const cage = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const g = cv.getContext("2d")!;
    g.strokeStyle = "rgba(170,180,200,0.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(64, 64);
    g.moveTo(64, 0);
    g.lineTo(0, 64);
    g.stroke();
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(30, 4);
    return t;
  }, []);
  // Khán giả: bóng người tối, lấm tấm đèn điện thoại và que neon
  const crowd = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 2048;
    cv.height = 256;
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, 2048, 256);
    let seed = 5;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let row = 0; row < 3; row++)
      for (let x = -20; x < 2068; x += 26 + r() * 14) {
        const y = 70 + row * 60 + r() * 10;
        const sh = 14 + r() * 6;
        g.fillStyle = `rgb(${8 + row * 6},${6 + row * 4},${16 + row * 8})`;
        g.beginPath();
        g.arc(x, y, sh * 0.6, 0, Math.PI * 2);
        g.fill();
        g.fillRect(x - sh, y + sh * 0.5, sh * 2, 80);
        if (r() < 0.25) {
          const col = ["#ff2fd0", "#00f0ff", "#ffe14a", "#ffffff"][Math.floor(r() * 4)];
          g.fillStyle = col;
          g.shadowColor = col;
          g.shadowBlur = 12;
          g.fillRect(x + (r() - 0.5) * 20, y - 30 - r() * 20, 4, r() < 0.5 ? 6 : 26);
          g.shadowBlur = 0;
        }
      }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const screen = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 256;
    const g = cv.getContext("2d")!;
    const gr = g.createLinearGradient(0, 0, 512, 256);
    gr.addColorStop(0, "#2a0a3a");
    gr.addColorStop(1, "#06223a");
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 256);
    g.textAlign = "center";
    g.fillStyle = "#ff2fd0";
    g.shadowColor = "#ff2fd0";
    g.shadowBlur = 20;
    g.font = "900 64px sans-serif";
    g.fillText("FIGHT NIGHT", 256, 120);
    g.fillStyle = "#00f0ff";
    g.shadowColor = "#00f0ff";
    g.font = "700 30px sans-serif";
    g.fillText("CYBERHOOD · VÕ ĐÀI NGẦM", 256, 180);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const posts = useMemo(() => Array.from({ length: 12 }, (_, i) => -11 + i * 2), []);
  const W = DUEL.arenaHalf * 2 + 4;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[W, 8]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.9} roughness={0.35} metalness={0.55} />
      </mesh>
      {/* Mép sàn neon */}
      <mesh position={[0, -0.25, 4.05]}>
        <boxGeometry args={[W, 0.5, 0.1]} />
        <meshStandardMaterial color="#101018" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, 4.06]}>
        <boxGeometry args={[W, 0.06, 0.06]} />
        <meshBasicMaterial color={[3.2, 0.5, 2.4]} toneMapped={false} />
      </mesh>
      {/* Lồng lưới thép trên cột kim loại, đèn led xanh dọc đỉnh */}
      {posts.map((x) => (
        <mesh key={x} position={[x, 1.6, -3.6]}>
          <cylinderGeometry args={[0.08, 0.1, 3.2, 8]} />
          <meshStandardMaterial color="#2a2a36" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1.6, -3.62]}>
        <planeGeometry args={[23, 3.2]} />
        <meshStandardMaterial map={cage} alphaMap={cage} transparent depthWrite={false} color="#8890a8" metalness={0.8} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 3.22, -3.6]}>
        <boxGeometry args={[23, 0.06, 0.06]} />
        <meshBasicMaterial color={[0.4, 2.6, 3.2]} toneMapped={false} />
      </mesh>
      {/* Khán đài: ba hàng khán giả bóng tối */}
      <mesh position={[0, 4, -13]}>
        <planeGeometry args={[64, 8]} />
        <meshBasicMaterial map={crowd} transparent />
      </mesh>
      <mesh position={[0, 1.2, -13.4]}>
        <boxGeometry args={[64, 10, 0.5]} />
        <meshStandardMaterial color="#0b0814" roughness={1} />
      </mesh>
      {/* Hai màn hình lớn treo cao */}
      {[-13, 13].map((x) => (
        <group key={x} position={[x, 8.5, -11]} rotation-y={-x * 0.02}>
          <mesh>
            <planeGeometry args={[9, 4.5]} />
            <meshBasicMaterial map={screen} toneMapped={false} color={[1.4, 1.4, 1.4]} />
          </mesh>
          <mesh position={[0, 0, -0.1]}>
            <boxGeometry args={[9.4, 4.9, 0.15]} />
            <meshStandardMaterial color="#111" metalness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Giàn đèn và ánh đèn màu */}
      <mesh position={[0, 11, -6]}>
        <boxGeometry args={[34, 0.3, 0.3]} />
        <meshStandardMaterial color="#222" metalness={0.8} />
      </mesh>
      {[-14, -7, 0, 7, 14].map((x) => (
        <mesh key={x} position={[x, 10.7, -6]}>
          <boxGeometry args={[0.8, 0.4, 0.5]} />
          <meshBasicMaterial color={[3, 3, 3]} toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={[-9, 6, 2]} intensity={22} distance={22} color="#ff2fd0" />
      <pointLight position={[9, 6, 2]} intensity={22} distance={22} color="#00f0ff" />
      <pointLight position={[0, 9, -1]} intensity={26} distance={24} color="#ffffff" />
    </group>
  );
}

/** Một đạo cụ Meshy đặt cố định quanh sàn đấu */
function Prop({ name, size, at, rot = 0, lit = 0.3 }: { name: ExtraModel; size: number; at: [number, number, number]; rot?: number; lit?: number }) {
  const { root } = useFitted(name, size, "height", lit);
  return <primitive object={root} position={at} rotation-y={rot} />;
}

/** Khán đài thép hai bên ngai, cột đèn sân vận động ở bốn góc, dàn loa cạnh lối vào: không khí võ đài ngầm */
function ArenaProps() {
  return (
    <>
      <Prop name="mx_du_bleachers" size={4.2} at={[-10.5, 0, -11]} rot={0.25} />
      <Prop name="mx_du_bleachers" size={4.2} at={[10.5, 0, -11]} rot={-0.25} />
      <Prop name="mx_du_bleachers" size={4.6} at={[-17, 0, -4]} rot={Math.PI / 2} />
      <Prop name="mx_du_bleachers" size={4.6} at={[17, 0, -4]} rot={-Math.PI / 2} />
      <Prop name="mx_du_floodlight" size={11} at={[-14, 0, -9]} rot={0.6} lit={0.5} />
      <Prop name="mx_du_floodlight" size={11} at={[14, 0, -9]} rot={-0.6} lit={0.5} />
      <Prop name="mx_du_speaker_stack" size={2.8} at={[-4.6, 0, -7]} rot={0.3} lit={0.4} />
      <Prop name="mx_du_speaker_stack" size={2.8} at={[4.6, 0, -7]} rot={-0.3} lit={0.4} />
      <Prop name="mx_du_speaker_stack" size={2.2} at={[-11.5, 0, -1]} rot={Math.PI / 2} lit={0.4} />
      <Prop name="mx_du_speaker_stack" size={2.2} at={[11.5, 0, -1]} rot={-Math.PI / 2} lit={0.4} />
      {/* Đèn rọi từ cột đèn xuống sàn: nhân vật sáng rõ, nền tối sâu */}
      <spotLight position={[-12, 10, -6]} target-position={[0, 0, 0]} angle={0.5} penumbra={0.6} intensity={180} distance={40} color="#e8f0ff" />
      <spotLight position={[12, 10, -6]} target-position={[0, 0, 0]} angle={0.5} penumbra={0.6} intensity={140} distance={40} color="#ffd6f0" />
    </>
  );
}

/** Ngai sắt của nhà vô địch đặt cuối sàn, sau hàng cọc: mục tiêu của cả thang đấu */
function Throne() {
  const { root } = useFitted("mx_dr_throne", 4.2, "height", 0.35);
  return <primitive object={root} position={[0, 0, -7.5]} />;
}

/** Clip võ thuật Meshy dùng cho cả hai võ sĩ (cùng tên xương nên đối thủ nào cũng diễn được) */
const STANCE = ["fidle", "fwalk", "fback", "block", "dodge", "facehit", "hitr", "knockdown", "getup", "taunt", "victory"] as const;
const MOVE_CLIPS = [...new Set(Object.values(DUEL.moves).map((m) => m.clip))] as FightClip[];
/** Đoạn có ích trong clip ngã / đứng dậy (giây trong clip): ngã 0 → 1.3, đứng dậy 4.2 → 6.7 */
const KNOCK_END = 1.3;
const GETUP = [4.2, 6.7] as const;

/** Tốc độ tua clip một đòn: phần trước lúc vung mạnh nhất phải gói gọn trong thời gian ra đòn (startup) */
function moveTiming(id: MoveId) {
  const m = DUEL.moves[id];
  const peak = FIGHT_CLIPS[m.clip as FightClip].peak;
  const lead = Math.min(peak, 0.5);
  const scale = THREE.MathUtils.clamp(lead / Math.max(0.05, m.startup), 1, 4);
  return { scale, start: Math.max(0, peak - m.startup * scale) };
}

function DuelFighter({ sim, who }: { sim: DuelSim; who: "player" | "foe" }) {
  const skin = useGame((s) => s.profile?.hunter ?? "soldier");
  const base = who === "player" ? `mx_cls_${skin === "soldier" ? "racer" : skin}` : sim.rival.base;
  const walk = use(extraModel(`${base}_walk` as ExtraModel));
  const names = [...STANCE, ...MOVE_CLIPS];
  const gltfs = names.map((n) => use(extraModel(fightModel(n as FightClip))));
  const rig = useMemo(() => {
    const clips: Record<string, THREE.AnimationClip> = {};
    names.forEach((n, i) => (clips[n] = gltfs[i].animations[0]));
    const r = buildRig(walk.scene, clips, who === "player" ? 1.8 : sim.rival.height, who === "player" ? 0.55 : 0.4);
    for (const n of [...MOVE_CLIPS, "facehit", "hitr", "knockdown", "getup", "dodge", "victory"]) if (r.actions[n]) once(r.actions[n]);
    if (who === "player") addOutline(r.scene, "#fff3a0", 0.02);
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk, who, sim, ...gltfs]);
  const group = useRef<THREE.Group>(null);
  const lastMove = useRef(-9);
  const lastHurt = useRef(-9);
  const phase = useRef<"" | "down" | "getup">("");
  useFrame((_, dt) => {
    const f: Fighter = who === "player" ? sim.player : sim.foe;
    const o = group.current;
    if (!o) return;
    o.position.set(f.x, f.y, 0);
    o.rotation.y = f.facing * (Math.PI / 2 - 0.25);
    const won = (who === "player" && sim.status === "won") || (who === "foe" && sim.status === "lost");
    const ko = (who === "player" && sim.status === "lost") || (who === "foe" && sim.status === "won");
    const play = (name: string, fade: number, restart = false, time = 0, scale = 1) => {
      setAnim(rig, name, fade, restart);
      const a = rig.actions[name];
      if (a && restart) {
        a.time = time;
        a.timeScale = scale;
      }
    };
    if (ko || sim.time < f.downUntil) {
      // Ngã: phát đoạn ngã một lần rồi nằm yên
      if (phase.current !== "down") {
        phase.current = "down";
        play("knockdown", 0.05, true, 0, 2.6);
      }
      const a = rig.actions.knockdown;
      if (a && a.time >= KNOCK_END) a.timeScale = 0;
    } else if (sim.lying(f)) {
      if (phase.current !== "getup") {
        phase.current = "getup";
        play("getup", 0.1, true, GETUP[0], (GETUP[1] - GETUP[0]) / DUEL.getupTime);
      }
    } else {
      phase.current = "";
      if (won) setAnim(rig, "victory", 0.3);
      else if (sim.status === "intro") setAnim(rig, who === "foe" ? "taunt" : "fidle", 0.3);
      else if (sim.time < f.stunUntil) {
        if (lastHurt.current !== f.hurtAt) {
          lastHurt.current = f.hurtAt;
          const clip = f.hurtKind === "face" ? "facehit" : "hitr";
          play(clip, 0.04, true, FIGHT_CLIPS[clip].peak * 0.5, 2.2);
        }
      } else if (sim.dodging(f)) setAnim(rig, "dodge", 0.05, sim.time - f.dodgeAt < 0.02);
      else if (f.move) {
        if (lastMove.current !== f.moveAt) {
          lastMove.current = f.moveAt;
          const t = moveTiming(f.move);
          play(DUEL.moves[f.move].clip, 0.05, true, t.start, t.scale);
        }
      } else if (f.blocking) setAnim(rig, "block", 0.08);
      else if (Math.abs(f.vx) > 0.3) setAnim(rig, f.vx * f.facing > 0 ? "fwalk" : "fback", 0.12);
      else setAnim(rig, "fidle", 0.2);
    }
    const dodge = rig.actions.dodge;
    if (dodge && rig.current === "dodge") dodge.timeScale = 1.43 / DUEL.dodge.time / 1.6;
    rig.mixer.update(Math.min(dt, 0.1));
    const hurt = sim.time - f.hurtAt;
    flash(rig.scene, hurt < 0.12 ? 1 - hurt / 0.12 : 0, who === "player" ? RED : WHITE);
  });
  return (
    <group ref={group}>
      <primitive object={rig.scene} />
    </group>
  );
}

const SPARKS = 8;

/** Tia lửa ở chỗ trúng đòn / đỡ đòn */
function HitSparks({ sim }: { sim: DuelSim }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    let i = 0;
    for (let k = sim.events.length - 1; k >= 0 && i < SPARKS; k--) {
      const e = sim.events[k];
      if (e.kind !== "hit" && e.kind !== "block") continue;
      const age = sim.time - e.at;
      if (age > 0.25) break;
      const o = g.children[i++] as THREE.Mesh;
      o.visible = true;
      const target = e.who === "player" ? sim.player : sim.foe;
      o.position.set(target.x - target.facing * 0.3, target.y + 1.3, 0.4);
      o.scale.setScalar((e.kind === "hit" ? 0.5 : 0.3) + age * 3);
      const mat = o.material as THREE.MeshBasicMaterial;
      mat.opacity = 1 - age / 0.25;
      mat.color.setRGB(...((e.kind === "hit" ? [3, 2, 0.6] : [0.6, 2, 3]) as [number, number, number]));
    }
    for (; i < SPARKS; i++) g.children[i].visible = false;
  });
  return (
    <group ref={group}>
      {Array.from({ length: SPARKS }, (_, i) => (
        <mesh key={i} visible={false}>
          {/* Vòng xung kích mỏng toả ra ở chỗ trúng đòn (kiểu manga) */}
          <ringGeometry args={[0.36, 0.5, 28]} />
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function DuelHud() {
  const sim = useDuel((s) => s.sim);
  const leave = useDuel((s) => s.leave);
  const prize = useDuel((s) => s.prize);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      settleDuel();
      tick((n) => n + 1);
    }, 50);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const unbind = bindLevelKeys(() => useDuel.getState().leave());
    const onKey = (e: KeyboardEvent) => {
      const s = useDuel.getState().sim;
      if (e.code === "Enter" && s && s.status !== "fight" && s.status !== "intro") useDuel.getState().leave();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unbind();
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  if (!sim) return null;
  const done = sim.status === "won" || sim.status === "lost" || sim.status === "draw";
  const bar = (f: Fighter, right = false) => (
    <div className={`duel__bar ${right ? "duel__bar--right" : ""}`}>
      <i style={{ width: `${(f.hp / (f === sim.foe ? sim.foeMaxHp : DUEL.maxHp)) * 100}%` }} />
    </div>
  );
  return (
    <div className="lv duel">
      <div className="duel__top">
        <div className="duel__side">
          <span className="duel__name">HUNTER</span>
          {bar(sim.player)}
        </div>
        <div className="duel__time">{Math.ceil(sim.timeLeft)}</div>
        <div className="duel__side duel__side--right">
          <span className="duel__name">
            {sim.rival.name} · BẬC {RIVALS.findIndex((r) => r.id === sim.rival.id) + 1}/{RIVALS.length}
          </span>
          {bar(sim.foe, true)}
        </div>
      </div>
      {sim.status === "intro" && (
        <div className="lv__banner lv__banner--ready">
          {sim.rival.name}
          <small className="duel__title">{sim.rival.title}</small>
        </div>
      )}
      {sim.status === "fight" && sim.time - DUEL.introTime < 0.8 && <div className="lv__banner">FIGHT!</div>}
      {done && (
        <div className="lv__panel">
          <p className="lv__panel-tag">{sim.status === "won" ? "K.O. · BẠN THẮNG" : sim.status === "lost" ? "K.O. · BẠN THUA" : "HOÀ"}</p>
          {sim.status === "won" && (
            <p>
              +{sim.rival.reward} CRED · +{DUEL_REWARD.chestKeys} Chìa rương
              {prize && ` · Nhận ${GEAR[prize as GearId].name} (vào Túi đồ)`}
            </p>
          )}
          {sim.status === "won" && RIVALS.findIndex((r) => r.id === sim.rival.id) < RIVALS.length - 1 && (
            <button className="lv__btn" onClick={() => useDuel.getState().start(RIVALS.findIndex((r) => r.id === sim.rival.id) + 1)}>
              Đấu bậc tiếp: {RIVALS[RIVALS.findIndex((r) => r.id === sim.rival.id) + 1].name}
            </button>
          )}
          <button className="lv__btn" onClick={leave}>
            Về thành phố <kbd>Enter</kbd>
          </button>
          <button className="lv__btn lv__btn--ghost" onClick={() => useDuel.getState().start(RIVALS.findIndex((r) => r.id === sim.rival.id))}>
            Đấu lại
          </button>
        </div>
      )}
      <div className="lv__help">
        <kbd>A</kbd>
        <kbd>D</kbd> di chuyển · <kbd>W</kbd> nhảy · <kbd>S</kbd> đỡ · <kbd>J</kbd> chuỗi đấm (jab–jab–móc–móc ngửa) · <kbd>K</kbd> chuỗi đá (gối–vòng cầu–đạp) · tiến+<kbd>J</kbd> chỏ · tiến+<kbd>K</kbd> phi cước · lùi+<kbd>K</kbd> đá lộn · <kbd>S</kbd>+<kbd>K</kbd> quét trụ · <kbd>L</kbd> né · <kbd>Esc</kbd> thoát
      </div>
    </div>
  );
}

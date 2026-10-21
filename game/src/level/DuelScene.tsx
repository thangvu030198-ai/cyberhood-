// Đấu trường đối kháng 1v1 (học từ Bloody Roar 2): sàn ô vuông rêu phong, hàng rào cọc quanh sàn,
// camera ngang tự zoom theo khoảng cách hai võ sĩ, hai thanh máu, đồng hồ hiệp, FIGHT! / K.O.

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { extraModel, playSfx, type ExtraModel } from "../game/assets";
import { once } from "../game/meshyAnim";
import { useGame } from "../game/store";
import { DUEL, type DuelInput, type DuelSim, type Fighter } from "./duel";
import { DUEL_REWARD, settleDuel, useDuel } from "./duelSession";
import { bindLevelKeys, levelInput } from "./levelInput";
import { RetroGrade } from "./retroEffects";
import { addOutline, buildRig, flash, Quiet, RED, setAnim, WHITE } from "./LevelScene";

/** Phím: A/D đi, W/Space nhảy, S đỡ, J đấm, K đá */
function duelInput(): DuelInput {
  const i = levelInput.state();
  return { left: i.left, right: i.right, jump: i.jump || i.up, block: i.down, punch: i.shoot, kick: i.dash };
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
      <color attach="background" args={["#3a1c12"]} />
      <fog attach="fog" args={["#5a2a18", 18, 60]} />
      <DuelDriver sim={sim} />
      <DuelCamera sim={sim} />
      <hemisphereLight args={["#ffe2c0", "#3a2a20", 1.6]} />
      <directionalLight position={[-6, 12, 8]} intensity={2.4} color="#fff0d8" />
      <directionalLight position={[8, 5, -6]} intensity={1.2} color="#ff8a4a" />
      <Arena />
      <Quiet>
        <Suspense fallback={null}>
          <DuelFighter sim={sim} who="player" />
        </Suspense>
      </Quiet>
      <Quiet>
        <Suspense fallback={null}>
          <DuelFighter sim={sim} who="foe" />
        </Suspense>
      </Quiet>
      <HitSparks sim={sim} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1} luminanceSmoothing={0.2} />
        <RetroGrade strength={0.7} />
        <Vignette eskil={false} offset={0.3} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}

function DuelDriver({ sim }: { sim: DuelSim }) {
  const seen = useRef(0);
  useFrame((_, dt) => {
    if (!levelInput.paused) sim.update(Math.min(dt, 0.1), duelInput());
    for (let i = seen.current; i < sim.events.length; i++) {
      const e = sim.events[i];
      if (e.kind === "hit") playSfx(e.move === "kick" ? "enemyDestroy" : "enemyHurt", 0.6);
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
    camera.position.set(c.current.x, 2.1, c.current.z);
    camera.lookAt(c.current.x, 1.25, 0);
  });
  return null;
}

/** Sàn đấu: ô vuông rêu phong, mép đá, hàng cọc gỗ phía sau, khán đài tối */
function Arena() {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const g = cv.getContext("2d")!;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y) % 2 ? "#5d6b4a" : "#6f7a55";
        g.fillRect(x * 64, y * 64, 64, 64);
        // vệt rêu và vết nứt
        g.fillStyle = "rgba(40,60,30,0.45)";
        for (let k = 0; k < 6; k++) g.fillRect(x * 64 + ((k * 37 + y * 11) % 56), y * 64 + ((k * 23 + x * 17) % 56), 10, 6);
        g.strokeStyle = "rgba(20,20,15,0.5)";
        g.strokeRect(x * 64 + 1, y * 64 + 1, 62, 62);
      }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const posts = useMemo(() => Array.from({ length: 23 }, (_, i) => -11 + i), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[DUEL.arenaHalf * 2 + 4, 8]} />
        <meshStandardMaterial map={tex} roughness={0.85} />
      </mesh>
      {/* Mép sàn */}
      <mesh position={[0, -0.25, 4.05]}>
        <boxGeometry args={[DUEL.arenaHalf * 2 + 4, 0.5, 0.1]} />
        <meshStandardMaterial color="#3d3a30" roughness={0.9} />
      </mesh>
      {/* Hàng cọc gỗ và dây thừng phía sau */}
      {posts.map((x) => (
        <mesh key={x} position={[x, 1.3, -3.6]}>
          <cylinderGeometry args={[0.12, 0.15, 2.6 + ((x * 7) % 3) * 0.2, 6]} />
          <meshStandardMaterial color="#8a4a26" roughness={0.8} />
        </mesh>
      ))}
      {[1.6, 2.3].map((y) => (
        <mesh key={y} position={[0, y, -3.6]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.03, 0.03, 23, 6]} />
          <meshStandardMaterial color="#c9a46a" />
        </mesh>
      ))}
      {/* Khán đài phía xa */}
      <mesh position={[0, 4, -16]}>
        <boxGeometry args={[60, 10, 2]} />
        <meshStandardMaterial color="#4a2416" roughness={1} />
      </mesh>
      {[-12, -4, 4, 12].map((x) => (
        <pointLight key={x} position={[x, 7, -6]} intensity={14} distance={20} color="#ffb070" />
      ))}
    </group>
  );
}

/** Model võ sĩ: nhân vật chọn của người chơi; đối thủ là vệ binh Citadel. Đấm/đá mượn clip của nhân vật Meshy khác */
const FOE = { base: "mx_ct_guard", height: 1.95 };
const BORROW = { punch: "mx_ct_guard_attack", kick: "mx_zmb_brute_attack", hit: "mx_vane_human_hit" } as const;

function DuelFighter({ sim, who }: { sim: DuelSim; who: "player" | "foe" }) {
  const skin = useGame((s) => s.profile?.hunter ?? "soldier");
  const base = who === "player" ? `mx_cls_${skin === "soldier" ? "racer" : skin}` : FOE.base;
  const m = (n: string) => use(extraModel(n as ExtraModel));
  const walk = m(`${base}_walk`);
  const run = m(`${base}_run`);
  const death = m(`${base}_death`);
  const idle = who === "player" ? m(`${base}_idle`) : walk;
  const punch = m(BORROW.punch);
  const kick = m(BORROW.kick);
  const hit = m(BORROW.hit);
  const rig = useMemo(() => {
    const r = buildRig(
      walk.scene,
      { idle: (who === "player" ? idle : walk).animations[0], walk: walk.animations[0], run: run.animations[0], death: death.animations[0], punch: punch.animations[0], kick: kick.animations[0], hit: hit.animations[0] },
      who === "player" ? 1.8 : FOE.height,
      who === "player" ? 0.55 : 0.4,
    );
    for (const n of ["punch", "kick"]) if (r.actions[n]) once(r.actions[n]);
    if (who === "player") addOutline(r.scene, "#fff3a0", 0.02);
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk, run, death, idle, punch, kick, hit, who]);
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const f: Fighter = who === "player" ? sim.player : sim.foe;
    const o = group.current;
    if (!o) return;
    o.position.set(f.x, f.y, 0);
    o.rotation.y = f.facing * (Math.PI / 2 - 0.25);
    const ko = (who === "player" && sim.status === "lost") || (who === "foe" && sim.status === "won");
    if (ko) setAnim(rig, "death", 0.1);
    else if (sim.time < f.stunUntil) setAnim(rig, "hit", 0.05, sim.time - f.hurtAt < 0.02);
    else if (f.move) setAnim(rig, f.move, 0.06, sim.time - f.moveAt < 0.02);
    else if (Math.abs(f.vx) > 0.3) setAnim(rig, "walk", 0.12);
    else setAnim(rig, "idle", 0.2);
    // Đỡ đòn: co người, khựng animation
    o.scale.set(1, f.blocking ? 0.92 : 1, 1);
    rig.mixer.update(Math.min(dt, 0.1) * (f.blocking ? 0.2 : f.move === "kick" ? 1.3 : f.move === "punch" ? 1.6 : 1));
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
          <icosahedronGeometry args={[0.5, 0]} />
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function DuelHud() {
  const sim = useDuel((s) => s.sim);
  const leave = useDuel((s) => s.leave);
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
      <i style={{ width: `${(f.hp / DUEL.maxHp) * 100}%` }} />
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
          <span className="duel__name">VỆ BINH CITADEL</span>
          {bar(sim.foe, true)}
        </div>
      </div>
      {sim.status === "intro" && <div className="lv__banner lv__banner--ready">ROUND 1</div>}
      {sim.status === "fight" && sim.time - DUEL.introTime < 0.8 && <div className="lv__banner">FIGHT!</div>}
      {done && (
        <div className="lv__panel">
          <p className="lv__panel-tag">{sim.status === "won" ? "K.O. · BẠN THẮNG" : sim.status === "lost" ? "K.O. · BẠN THUA" : "HOÀ"}</p>
          {sim.status === "won" && (
            <p>
              +{DUEL_REWARD.cred} CRED · +{DUEL_REWARD.chestKeys} Chìa rương
            </p>
          )}
          <button className="lv__btn" onClick={leave}>
            Về thành phố <kbd>Enter</kbd>
          </button>
          <button className="lv__btn lv__btn--ghost" onClick={() => useDuel.getState().start()}>
            Đấu lại
          </button>
        </div>
      )}
      <div className="lv__help">
        <kbd>A</kbd>
        <kbd>D</kbd> di chuyển · <kbd>W</kbd> nhảy · <kbd>S</kbd> đỡ · <kbd>J</kbd> đấm (3 đòn liên tiếp = combo) · <kbd>K</kbd> đá · <kbd>Esc</kbd> thoát
      </div>
    </div>
  );
}

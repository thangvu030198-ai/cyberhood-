// Cảm giác giao tranh Công thành: tia lửa + số sát thương bay lên khi trúng, vệt chém cận chiến, chùm tên lửa của
// người chơi, đồ rơi (đồng CRED xoay, hộp Stim, chìa, trang bị có cột sáng). Điều khiển kỹ năng Q/E/R/F, đổi thế X.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { handles } from "../game/refs";
import { useGame } from "../game/store";
import { useHunter } from "../game/hunter";
import { playSfx } from "../game/assets";
import { SIEGE_ORIGIN } from "../game/config";
import { SIEGE, type SiegeSim, type Skill, type Stance } from "./siegeSim";
import { SiegeVfx } from "./siegeVfx";

const O = SIEGE_ORIGIN;

// ---------------------------------------------------------------------------
// Số sát thương: sprite chữ (texture vẽ sẵn theo giá trị, dùng lại)

const textCache = new Map<string, THREE.Texture>();
function textTex(text: string, color: string) {
  const key = text + color;
  let t = textCache.get(key);
  if (t) return t;
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 64;
  const g = cv.getContext("2d")!;
  g.font = "900 44px sans-serif";
  g.textAlign = "center";
  g.lineWidth = 7;
  g.strokeStyle = "rgba(0,0,0,0.85)";
  g.strokeText(text, 64, 46);
  g.fillStyle = color;
  g.fillText(text, 64, 46);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (textCache.size > 300) textCache.clear();
  textCache.set(key, t);
  return t;
}

const NUMS = 36;
const SPARKS = 160;

function HitFx({ sim }: { sim: SiegeSim }) {
  const group = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const slashes = useRef<THREE.Group>(null);
  const pool = useMemo(() => Array.from({ length: SPARKS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, c: new THREE.Color() })), []);
  const seen = useRef(0);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const arcGeo = useMemo(() => new THREE.RingGeometry(1.4, 2.6, 24, 1, -1.1, 2.2).rotateX(-Math.PI / 2), []);
  useFrame(({ clock }, dt) => {
    dt = Math.min(dt, 0.05);
    const t = clock.elapsedTime;
    const burst = (x: number, z: number, n: number, color: string, y = 1.2, speed = 6) => {
      for (let k = 0; k < n; k++) {
        const p = pool.find((p) => p.life <= 0);
        if (!p) return;
        p.x = x;
        p.y = y;
        p.z = z;
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.4 + Math.random());
        p.vx = Math.cos(a) * sp;
        p.vz = Math.sin(a) * sp;
        p.vy = 2 + Math.random() * speed;
        p.life = 0.25 + Math.random() * 0.3;
        p.c.set(color).multiplyScalar(3);
      }
    };
    // Sự kiện mới: tia lửa, số sát thương, vệt chém
    const g = group.current;
    const sl = slashes.current;
    if (seen.current > sim.events.length) seen.current = sim.events.length;
    for (let i = seen.current; i < sim.events.length; i++) {
      const e = sim.events[i];
      if (e.kind === "hit") {
        burst(e.x, e.z, e.byPlayer ? 7 : 3, e.side === 0 ? "#7ff3ff" : "#ff7ae0");
        if (g && (e.byPlayer || e.crit)) {
          const spr = g.children.find((c) => !c.visible) as THREE.Sprite | undefined;
          if (spr) {
            spr.visible = true;
            spr.userData = { at: t, x: e.x + (Math.random() - 0.5), z: e.z + (Math.random() - 0.5) };
            const mat = spr.material as THREE.SpriteMaterial;
            mat.map = textTex(String(e.dmg), e.crit ? "#ffd23d" : "#ffffff");
            mat.needsUpdate = true;
            spr.scale.set(e.crit ? 2.6 : 1.8, e.crit ? 1.3 : 0.9, 1);
          }
        }
      } else if (e.kind === "melee") {
        burst(e.x, e.z, 5, e.side === 0 ? "#bff8ff" : "#ffb0e8", 1.4, 4);
        if (sl) {
          const arc = sl.children.find((c) => !c.visible) as THREE.Mesh | undefined;
          if (arc) {
            arc.visible = true;
            arc.position.set(e.x, 1.2, e.z);
            arc.rotation.y = Math.random() * Math.PI * 2;
            arc.userData = { at: t };
            ((arc.material as THREE.MeshBasicMaterial).color as THREE.Color).set(e.side === 0 ? "#7ff3ff" : "#ff4fd8").multiplyScalar(3);
          }
        }
      } else if (e.kind === "death") burst(e.x, e.z, 10, e.side === 0 ? "#05d9e8" : "#ff2fd0", 1.2, 7);
      else if (e.kind === "boom") burst(e.x, e.z, e.big ? 30 : 14, "#ffb060", 1, e.big ? 14 : 9);
    }
    seen.current = sim.events.length;
    if (g)
      for (const c of g.children) {
        if (!c.visible) continue;
        const age = t - (c.userData.at as number);
        if (age > 0.9) {
          c.visible = false;
          continue;
        }
        c.position.set(c.userData.x, 2.4 + age * 2.2, c.userData.z);
        (((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.min(1, (0.9 - age) * 3));
      }
    if (sl)
      for (const c of sl.children) {
        if (!c.visible) continue;
        const age = t - (c.userData.at as number);
        if (age > 0.18) {
          c.visible = false;
          continue;
        }
        c.scale.setScalar(0.8 + age * 3);
        ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - age / 0.18;
      }
    const sp = sparks.current;
    if (!sp) return;
    let n = 0;
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= 18 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      m.compose(v.set(p.x, p.y, p.z), q, s.setScalar(0.07 + p.life * 0.18));
      sp.setMatrixAt(n, m);
      sp.setColorAt(n, p.c);
      n++;
    }
    sp.count = n;
    sp.instanceMatrix.needsUpdate = true;
    if (sp.instanceColor) sp.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <group ref={group}>
        {Array.from({ length: NUMS }, (_, i) => (
          <sprite key={i} visible={false} renderOrder={20}>
            <spriteMaterial transparent depthTest={false} depthWrite={false} toneMapped={false} />
          </sprite>
        ))}
      </group>
      <group ref={slashes}>
        {Array.from({ length: 16 }, (_, i) => (
          <mesh key={i} geometry={arcGeo} visible={false}>
            <meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={sparks} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Chùm tên lửa của người chơi: bay vòng cung từ vai người chơi tới mục tiêu, để lại vệt sáng */
function Missiles({ sim }: { sim: SiegeSim }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    let n = 0;
    for (const ms of sim.missiles) {
      if (ms.hitAt === Infinity || sim.time < ms.at) continue;
      const u = sim.units[ms.id];
      const k = Math.min(1, (sim.time - ms.at) / Math.max(0.05, ms.hitAt - ms.at));
      // Mỗi quả kéo 5 đốm sáng làm vệt khói
      // Đầu đạn là model tên lửa (siegeVfx.tsx); ở đây chỉ vẽ vệt khói phía sau
      for (let j = 1; j < 6 && n < 200; j++) {
        const kk = Math.max(0, k - j * 0.04);
        v.set(ms.x0 + (u.x - ms.x0) * kk, 2.2 + Math.sin(kk * Math.PI) * 9, ms.z0 + (u.z - ms.z0) * kk);
        m.compose(v, q, s.setScalar(0.3 - j * 0.04));
        o.setMatrixAt(n++, m);
      }
    }
    o.count = n;
    o.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 200]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={[3, 1.6, 0.5]} toneMapped={false} />
    </instancedMesh>
  );
}

const DROP_POOL = 160;

/** Đồ rơi trên tuyết: đồng CRED vàng xoay, hộp Stim xanh, chìa rương, trang bị (cột sáng tím / băng) */
function Drops({ sim }: { sim: SiegeSim }) {
  const coins = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const a = coins.current;
    const b = beams.current;
    if (!a || !b) return;
    const t = clock.elapsedTime;
    let n = 0;
    let nb = 0;
    for (const d of sim.drops) {
      if (d.taken || n >= DROP_POOL) continue;
      const y = d.y + 0.45 + Math.sin(t * 3 + d.id) * 0.08;
      q.setFromEuler(e.set(Math.PI / 2, 0, t * 4 + d.id));
      const size = d.kind === "gear" ? 0.5 : d.kind === "cred" ? 0.24 : 0.36;
      m.compose(v.set(d.x, y, d.z), q, s.set(size, d.kind === "cred" ? 0.08 : size, size));
      a.setMatrixAt(n, m);
      a.setColorAt(n, d.kind === "cred" ? c.setRGB(3, 2.2, 0.4) : d.kind === "stim" ? c.setRGB(0.5, 3, 1) : d.kind === "key" ? c.setRGB(0.6, 3, 2.2) : d.ice ? c.setRGB(1, 2.6, 3.4) : c.setRGB(2.4, 0.8, 3.2));
      n++;
      if ((d.kind === "gear" || d.kind === "key") && nb < 40) {
        m.compose(v.set(d.x, 2.5, d.z), q.identity(), s.set(0.25, 5, 0.25));
        b.setMatrixAt(nb, m);
        b.setColorAt(nb, d.ice ? c.setRGB(0.6, 1.8, 2.6) : d.kind === "key" ? c.setRGB(0.4, 2, 1.4) : c.setRGB(1.6, 0.5, 2.4));
        nb++;
      }
    }
    a.count = n;
    b.count = nb;
    for (const o of [a, b]) {
      o.instanceMatrix.needsUpdate = true;
      if (o.instanceColor) o.instanceColor.needsUpdate = true;
    }
  });
  return (
    <>
      <instancedMesh ref={coins} args={[undefined, undefined, DROP_POOL]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 14]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={beams} args={[undefined, undefined, 40]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 8, 1, true]} />
        <meshBasicMaterial transparent opacity={0.45} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Điều khiển: Q/E/R/F kỹ năng (nhắm tâm màn hình xuống mặt tuyết), X đổi thế, thế Tanker = bộ giáp Mech

const SKILL_KEYS: Record<string, Skill> = { KeyQ: "grenade", KeyE: "missiles", KeyR: "orbital", KeyF: "shockwave" };
const STANCES: Stance[] = ["gunner", "melee", "tank"];

function Controls({ sim }: { sim: SiegeSim }) {
  const camera = useThree((s) => s.camera);
  const ray = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || useGame.getState().panelOpen) return;
      const sk = SKILL_KEYS[e.code];
      if (sk) {
        // Điểm nhắm: tia từ camera qua tâm màn hình chạm mặt tuyết (tối đa 40 m trước người chơi)
        camera.getWorldDirection(ray);
        const p = sim.player;
        let ax = p.x + ray.x * 14;
        let az = p.z + ray.z * 14;
        if (ray.y < -0.02) {
          const t = -camera.position.y / ray.y;
          ax = camera.position.x + ray.x * t - O.x;
          az = camera.position.z + ray.z * t - O.z;
        }
        const d = Math.hypot(ax - p.x, az - p.z);
        if (d > 40) (ax = p.x + ((ax - p.x) / d) * 40), (az = p.z + ((az - p.z) / d) * 40);
        if (sim.useSkill(sk, ax, az)) playSfx(sk === "orbital" ? "warn" : sk === "shockwave" ? "crit" : "transform", 0.8);
        else {
          const left = Math.ceil(sim.player.cds[sk] - sim.time);
          if (left > 0) useGame.getState().showToast(`${SIEGE.skills[sk].label}: hồi ${left}s`);
        }
      }
      if (e.code === "KeyX") {
        const next = STANCES[(STANCES.indexOf(sim.player.stance) + 1) % STANCES.length];
        if (sim.setStance(next)) playSfx("transform", 0.9);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim, camera, ray]);
  // Thế Tanker: mặc bộ giáp Mech của Hub (to, chậm, pháo mạnh) suốt thời gian giữ thế
  useFrame(() => {
    const h = useHunter.getState();
    const t = h.transform;
    const want = sim.player.stance === "tank" && sim.player.alive;
    if (want && t.phase !== "active") useHunter.setState({ transform: { ...t, phase: "active", timer: 9999, cooldown: 0, mechHp: 9999, mechMaxHp: 9999 } });
    else if (want && t.timer < 9000) useHunter.setState({ transform: { ...t, timer: 9999 } });
    else if (!want && t.phase === "active" && t.timer > 9000) useHunter.setState({ transform: { ...t, phase: "normal", timer: 0, cooldown: 0 } });
  });
  // Rời trận: trả lại dạng người
  useEffect(
    () => () => {
      const t = useHunter.getState().transform;
      if (t.timer > 9000) useHunter.setState({ transform: { ...t, phase: "normal", timer: 0, cooldown: 0 } });
    },
    [],
  );
  void handles;
  return null;
}

export function SiegeCombat({ sim }: { sim: SiegeSim }) {
  return (
    <>
      <Controls sim={sim} />
      <HitFx sim={sim} />
      <Missiles sim={sim} />
      <Drops sim={sim} />
      <SiegeVfx sim={sim} />
    </>
  );
}

// Trận raid: bước mô phỏng theo thời gian thật, đồng bộ người chơi (vị trí, độ cao, Mech, máu, gục / hồi sinh),
// điều khiển kỹ năng Q/E/R/F, và hiệu ứng: tia đạn đồng đội / lươn, số sát thương bay lên, vùng báo trước
// (quạt cắn, vòng quất đuôi, dải hơi thở sét, mưa vòng đỏ), vòng hồi máu, tên lửa / lựu đạn / thiên thạch (model Meshy).

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { handles } from "../game/refs";
import { useGame } from "../game/store";
import { fx } from "../game/Effects";
import { playSfx } from "../game/assets";
import { mechActive } from "../game/Mech";
import { RAID_ORIGIN } from "../game/config";
import { tr } from "../i18n/i18n";
import { qDir, VfxPool } from "../fx/skillVfx";
import { RAID, type RaidSim, type Skill } from "./raidSim";
import { useRaid } from "./raidSession";

const O = RAID_ORIGIN;
const _v = new THREE.Vector3();

/** Mỗi khung: vị trí người chơi → mô phỏng, bước mô phỏng, đồng bộ máu HUD, gục / hồi sinh, âm thanh sự kiện */
export function RaidDriver({ sim }: { sim: RaidSim }) {
  const seen = useRef(0);
  const wasAlive = useRef(true);
  useFrame((_, dt) => {
    const g = useGame.getState();
    const body = handles.player?.body;
    const pos = handles.player?.currPos;
    const P = sim.player;
    if (pos && P.alive) {
      const nx = pos.x - O.x;
      const nz = pos.z - O.z;
      P.vx = (nx - P.x) / Math.max(dt, 1e-3);
      P.vz = (nz - P.z) / Math.max(dt, 1e-3);
      P.x = nx;
      P.z = nz;
      P.y = Math.max(0, pos.y - 0.8);
    }
    P.inMech = mechActive();
    if (!g.panelOpen) sim.update(Math.min(dt, 0.1));
    const hp = Math.max(0, Math.round((P.hp / P.maxHp) * g.maxHp));
    if (hp !== g.hp) useGame.setState({ hp, lastDamageAt: hp < g.hp ? performance.now() / 1000 : g.lastDamageAt });
    if (!P.alive && wasAlive.current) playSfx("enemyDestroy", 0.9);
    if (P.alive && !wasAlive.current && body) {
      // Hồi sinh ở bãi tập kết (hoặc tại chỗ nếu Kỹ sư y tế cứu)
      body.setTranslation({ x: O.x + P.x, y: P.y + 1.5, z: O.z + P.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    wasAlive.current = P.alive;
    for (let i = seen.current; i < sim.events.length; i++) {
      const e = sim.events[i];
      if (e.kind === "boom") {
        fx.blast(_v.set(O.x + e.x, e.y + 0.5, O.z + e.z));
        const d = pos ? Math.hypot(O.x + e.x - pos.x, O.z + e.z - pos.z) : 99;
        if (d < 90) playSfx("enemyDestroy", Math.max(0.12, (e.big ? 1 : 0.5) * (1 - d / 90)));
      } else if (e.kind === "zap") playSfx("crit", 0.9);
      else if (e.kind === "playerHit") playSfx("enemyAttack", 0.35);
      else if (e.kind === "callout") playSfx("pickup", 0.5);
      else if (e.kind === "break") playSfx("crit", 1);
      else if (e.kind === "material") useGame.getState().showToast(`+${e.n} ${tr(MATS[e.mat])}`);
    }
    seen.current = sim.events.length;
    if (sim.phase === "end") useRaid.getState().settle();
  });
  return null;
}
const MATS = { lev_scale: "Vảy Leviathan", lev_horn: "Sừng Sấm", lev_core: "Lõi Tim Điện", lev_soul: "Linh Hồn Biển Sâu" } as const;

// ---------------------------------------------------------------------------
// Điều khiển kỹ năng: Q/E/R nhắm tâm màn hình xuống mặt nước (tối đa 45 m), F kỹ năng vai trò

const KEYS: Record<string, Skill> = { KeyQ: "grenade", KeyE: "missiles", KeyR: "orbital", KeyF: "role" };

function Controls({ sim }: { sim: RaidSim }) {
  const camera = useThree((s) => s.camera);
  const ray = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || useGame.getState().panelOpen) return;
      const sk = KEYS[e.code];
      if (!sk) return;
      camera.getWorldDirection(ray);
      const p = sim.player;
      let ax = p.x + ray.x * 16;
      let az = p.z + ray.z * 16;
      if (ray.y < -0.02) {
        const t = -camera.position.y / ray.y;
        ax = camera.position.x + ray.x * t - O.x;
        az = camera.position.z + ray.z * t - O.z;
      } else {
        // Nhắm lên trời: ném về phía đầu rắn
        ax = sim.head.x;
        az = sim.head.z;
      }
      const d = Math.hypot(ax - p.x, az - p.z);
      if (d > 45) (ax = p.x + ((ax - p.x) / d) * 45), (az = p.z + ((az - p.z) / d) * 45);
      if (sim.useSkill(sk, ax, az)) playSfx(sk === "orbital" ? "warn" : sk === "role" ? "transform" : "crit", 0.8);
      else {
        const left = Math.ceil(sim.cds[sk] - sim.time);
        if (left > 0) useGame.getState().showToast(`${tr(RAID.skills[sk].label)}: ${left}s`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sim, camera, ray]);
  return null;
}

// ---------------------------------------------------------------------------
// Tia đạn

const TRACERS = 120;
function Tracers({ sim }: { sim: RaidSim }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const z = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    let n = 0;
    for (let i = sim.events.length - 1; i >= 0 && n < TRACERS; i--) {
      const e = sim.events[i];
      if (e.kind !== "tracer") continue;
      const age = sim.time - e.at;
      if (age > 0.22) break;
      const dx = e.x1 - e.x0;
      const dy = e.y1 - e.y0;
      const dz = e.z1 - e.z0;
      const len = Math.hypot(dx, dy, dz) || 1;
      const u = Math.min(1, age / 0.18);
      q.setFromUnitVectors(z, p.set(dx / len, dy / len, dz / len));
      const k = 1 - age / 0.22;
      m.compose(p.set(e.x0 + dx * u, e.y0 + dy * u, e.z0 + dz * u), q, s.set(0.07 * (0.4 + k * 0.6), 0.07 * (0.4 + k * 0.6), Math.min(4, len)));
      o.setMatrixAt(n, m);
      o.setColorAt(n, e.member ? c.setRGB(1.6, 2.8, 3.4) : c.setRGB(3.4, 0.8, 2.8));
      n++;
    }
    o.count = n;
    o.instanceMatrix.needsUpdate = true;
    if (o.instanceColor) o.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, TRACERS]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Số sát thương / hồi máu bay lên

const texCache = new Map<string, THREE.Texture>();
function numTex(text: string, color: string) {
  const key = text + color;
  let t = texCache.get(key);
  if (t) return t;
  const cv = document.createElement("canvas");
  cv.width = 160;
  cv.height = 64;
  const g = cv.getContext("2d")! as CanvasRenderingContext2D & { keepText?: boolean };
  g.keepText = true;
  g.font = "900 46px sans-serif";
  g.textAlign = "center";
  g.lineWidth = 7;
  g.strokeStyle = "rgba(0,0,0,0.85)";
  g.strokeText(text, 80, 48);
  g.fillStyle = color;
  g.fillText(text, 80, 48);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (texCache.size > 300) texCache.clear();
  texCache.set(key, t);
  return t;
}

function Numbers({ sim }: { sim: RaidSim }) {
  const group = useRef<THREE.Group>(null);
  const seen = useRef(0);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    if (seen.current > sim.events.length) seen.current = sim.events.length;
    for (let i = seen.current; i < sim.events.length; i++) {
      const e = sim.events[i];
      const show = (e.kind === "hit" && (e.byPlayer || e.crit)) || e.kind === "heal";
      if (!show) continue;
      const spr = g.children.find((c) => !c.visible) as THREE.Sprite | undefined;
      if (!spr) break;
      const heal = e.kind === "heal";
      spr.visible = true;
      spr.userData = { at: t, x: e.x + (Math.random() - 0.5) * 1.5, y: heal ? 2.2 : e.y + 1, z: e.z + (Math.random() - 0.5) * 1.5 };
      const mat = spr.material as THREE.SpriteMaterial;
      mat.map = heal ? numTex(`+${e.amount}`, "#7dff9a") : numTex(String(e.dmg), e.crit ? "#ffd23d" : "#ffffff");
      mat.needsUpdate = true;
      const big = !heal && e.kind === "hit" && e.crit;
      spr.scale.set(big ? 3.4 : 2.4, big ? 1.36 : 0.96, 1);
    }
    seen.current = sim.events.length;
    for (const c of g.children) {
      if (!c.visible) continue;
      const age = t - (c.userData.at as number);
      if (age > 1) {
        c.visible = false;
        continue;
      }
      c.position.set(c.userData.x, c.userData.y + age * 2.4, c.userData.z);
      ((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.min(1, (1 - age) * 3);
    }
  });
  return (
    <group ref={group}>
      {Array.from({ length: 40 }, (_, i) => (
        <sprite key={i} visible={false} renderOrder={20}>
          <spriteMaterial transparent depthTest={false} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Vùng báo trước

const POOL = 40;
function Warns({ sim }: { sim: RaidSim }) {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => ({ disc: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), ring: new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), strip: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), fan: new THREE.CircleGeometry(1, 24, -0.45, 0.9).rotateX(-Math.PI / 2) }), []);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    let n = 0;
    for (const w of sim.warns) {
      if (w.kind === "discharge" || w.kind === "tsunami") continue;
      if (n + 2 > g.children.length) break;
      const u = Math.min(1, (sim.time - w.warnAt) / Math.max(0.05, w.liveAt - w.warnAt));
      const live = sim.time >= w.liveAt;
      const fill = g.children[n++] as THREE.Mesh;
      const edge = g.children[n++] as THREE.Mesh;
      fill.visible = edge.visible = true;
      const fm = fill.material as THREE.MeshBasicMaterial;
      const em = edge.material as THREE.MeshBasicMaterial;
      const blink = 0.5 + 0.5 * Math.sin(t * (12 + u * 30));
      // Mặt nước ở y 0,35; mái nhà cao hơn: vòng nằm trên mặt nước
      const y = 0.45;
      if (w.kind === "breath") {
        const dx = w.x1 - w.x0;
        const dz = w.z1 - w.z0;
        const len = Math.hypot(dx, dz);
        fill.geometry = edge.geometry = geo.strip;
        fill.position.set((w.x0 + w.x1) / 2, y, (w.z0 + w.z1) / 2);
        fill.rotation.set(0, Math.atan2(dx, dz) + Math.PI / 2, 0);
        fill.scale.set(len, 1, w.r * 2 * (live ? 1 : u));
        edge.position.copy(fill.position);
        edge.rotation.copy(fill.rotation);
        edge.scale.set(len, 1, w.r * 2);
      } else if (w.kind === "bite") {
        const dx = w.x1 - w.x0;
        const dz = w.z1 - w.z0;
        const len = Math.hypot(dx, dz);
        fill.geometry = edge.geometry = geo.fan;
        fill.position.set(w.x0, y, w.z0);
        fill.rotation.set(0, Math.atan2(dx, dz) - Math.PI / 2, 0);
        fill.scale.setScalar(len * (live ? 1 : u));
        edge.position.copy(fill.position);
        edge.rotation.copy(fill.rotation);
        edge.scale.setScalar(len);
      } else {
        fill.geometry = geo.disc;
        edge.geometry = geo.ring;
        fill.position.set(w.x0, y, w.z0);
        fill.rotation.set(0, 0, 0);
        fill.scale.setScalar(w.r * (live ? 1 : u));
        edge.position.set(w.x0, y + 0.01, w.z0);
        edge.rotation.set(0, 0, 0);
        edge.scale.setScalar(w.r);
      }
      if (w.byPlayer) {
        const orb = w.kind === "orbital";
        fm.color.setRGB(live ? 3 : orb ? 0.4 : 2.6, live ? 2.6 : orb ? 2 : 1.6, live ? 2 : orb ? 3 : 0.3);
        em.color.setRGB(orb ? 0.5 : 3, orb ? 2.4 : 2, orb ? 3.2 : 0.4);
      } else {
        fm.color.setRGB(live ? 3 : 2.4, live ? 1.4 : 0.25, live ? 0.4 : 0.3);
        em.color.setRGB(3, 0.4, 0.4);
      }
      fm.opacity = live ? Math.max(0, 1 - (sim.time - w.liveAt) * 2) : 0.25 + blink * 0.15;
      em.opacity = live ? 0 : 0.85;
    }
    for (; n < g.children.length; n++) g.children[n].visible = false;
  });
  return (
    <group ref={group}>
      {Array.from({ length: POOL * 2 }, (_, i) => (
        <mesh key={i} visible={false} renderOrder={5}>
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Chiêu của người chơi: tên lửa, lựu đạn, thiên thạch (model Meshy) + vòng hồi máu

function missileAt(sim: RaidSim, ms: RaidSim["missiles"][number], k: number) {
  const tg = sim.missileTarget(ms.tgt);
  return { x: ms.x0 + (tg.x - ms.x0) * k, y: 2.2 + (tg.y - 2.2) * k + Math.sin(k * Math.PI) * 10, z: ms.z0 + (tg.z - ms.z0) * k };
}

function SkillModels({ sim }: { sim: RaidSim }) {
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  return (
    <>
      <VfxPool
        name="missile"
        max={16}
        update={(put, t) => {
          for (const ms of sim.missiles) {
            if (ms.hitAt === Infinity || sim.time < ms.at || sim.time >= ms.hitAt) continue;
            const k = Math.min(1, (sim.time - ms.at) / Math.max(0.05, ms.hitAt - ms.at));
            const a = missileAt(sim, ms, k);
            const b = missileAt(sim, ms, Math.min(1, k + 0.02));
            put(a.x, a.y, a.z, qDir(b.x - a.x, b.y - a.y, b.z - a.z, t * 8), 1.6);
          }
        }}
      />
      <VfxPool
        name="grenade"
        max={6}
        update={(put, t) => {
          for (const w of sim.warns) {
            if (w.kind !== "grenade" || sim.time >= w.liveAt) continue;
            const k = Math.min(1, (sim.time - w.warnAt) / ((w.liveAt - w.warnAt) * 0.55));
            const fx0 = w.fromX ?? w.x0;
            const fz0 = w.fromZ ?? w.z0;
            put(fx0 + (w.x0 - fx0) * k, 0.8 + (1 - k) * 1.5 + Math.sin(k * Math.PI) * 5, fz0 + (w.z0 - fz0) * k, q.setFromEuler(e.set(t * 9, t * 5, 0)), 0.9);
          }
        }}
      />
      <VfxPool
        name="meteor"
        max={6}
        update={(put, t) => {
          for (const w of sim.warns) {
            if (w.kind !== "orbital" || sim.time >= w.liveAt) continue;
            const u = (sim.time - w.warnAt) / Math.max(0.05, w.liveAt - w.warnAt);
            const h = 48 * (1 - u * u);
            put(w.x0 + h * 0.15, 0.6 + h, w.z0 - h * 0.45, qDir(-0.15, -1, 0.45, t * 3), 7);
          }
        }}
      />
      <VfxPool
        name="shock_ring"
        max={10}
        shell={1.08}
        update={(put) => {
          // Vòng hồi máu xanh lá nở ra ở người được hồi
          for (let i = sim.events.length - 1; i >= 0; i--) {
            const ev = sim.events[i];
            if (sim.time - ev.at > 0.6) break;
            if (ev.kind !== "heal") continue;
            const u = (sim.time - ev.at) / 0.6;
            const k = 1.5 + u * 3;
            put(ev.x, 0.5, ev.z, q.identity(), k, 0.25 * (1 - u) + 0.02, k);
          }
        }}
      />
    </>
  );
}

export function RaidFx({ sim }: { sim: RaidSim }) {
  return (
    <>
      <Controls sim={sim} />
      <Tracers sim={sim} />
      <Numbers sim={sim} />
      <Warns sim={sim} />
      <SkillModels sim={sim} />
    </>
  );
}

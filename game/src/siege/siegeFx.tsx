// Chạy mô phỏng Công thành theo thời gian thật + hiệu ứng: tia đạn hai phe, vùng pháo báo trước trên tuyết,
// tia laser và dậm đất của Boss Mech, vòm trắng Bom Nova, nổ khi phá máy phát / cổng.

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { handles } from "../game/refs";
import { useGame } from "../game/store";
import { fx } from "../game/Effects";
import { playSfx } from "../game/assets";
import { useFitted } from "../game/Showcase";
import { mechActive } from "../game/Mech";
import { SIEGE_ORIGIN } from "../game/config";
import type { SiegeSim } from "./siegeSim";
import { useSiege } from "./siegeSession";

const O = SIEGE_ORIGIN;
const _v = new THREE.Vector3();

/** Mỗi khung: đưa vị trí người chơi vào mô phỏng, bước mô phỏng, đồng bộ máu / chết / hồi sinh với Hub */
export function SiegeDriver({ sim }: { sim: SiegeSim }) {
  const seen = useRef(0);
  const wasAlive = useRef(true);
  useFrame((_, dt) => {
    const g = useGame.getState();
    const body = handles.player?.body;
    const pos = handles.player?.currPos;
    if (pos && sim.player.alive) {
      sim.player.x = pos.x - O.x;
      sim.player.z = pos.z - O.z;
    }
    sim.player.inMech = mechActive();
    const hpBefore = sim.player.hp;
    if (!g.panelOpen) sim.update(Math.min(dt, 0.1));
    // Dạng Mech: giáp dày, chỉ nhận 1/4 sát thương
    if (sim.player.inMech && sim.player.stance !== "tank" && sim.player.alive && sim.player.hp < hpBefore) sim.player.hp = hpBefore - (hpBefore - sim.player.hp) * 0.25;
    // Máu người chơi hiển thị trên HUD Hub
    const hp = Math.max(0, Math.round((sim.player.hp / sim.player.maxHp) * g.maxHp));
    if (hp !== g.hp) useGame.setState({ hp, lastDamageAt: hp < g.hp ? performance.now() / 1000 : g.lastDamageAt });
    if (!sim.player.alive && wasAlive.current) {
      useGame.setState({ flatlinedAt: performance.now() / 1000 });
      playSfx("enemyDestroy", 0.9);
    }
    if (sim.player.alive && !wasAlive.current) {
      // Hồi sinh theo đợt ở trại / trong lâu đài
      useGame.setState({ flatlinedAt: null, hp: g.maxHp });
      if (body) {
        body.setTranslation({ x: O.x + sim.player.x, y: 1.5, z: O.z + sim.player.z }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
    wasAlive.current = sim.player.alive;
    for (let i = seen.current; i < sim.events.length; i++) {
      const e = sim.events[i];
      if (e.kind === "boom") {
        fx.blast(_v.set(O.x + e.x, 1.5, O.z + e.z));
        if (e.big) {
          fx.blast(_v.set(O.x + e.x + 2, 3, O.z + e.z - 1));
          fx.blast(_v.set(O.x + e.x - 2, 5, O.z + e.z + 1));
        }
        const d = pos ? Math.hypot(O.x + e.x - pos.x, O.z + e.z - pos.z) : 99;
        if (d < 80) playSfx("enemyDestroy", Math.max(0.15, (e.big ? 1 : 0.6) * (1 - d / 80)));
      } else if (e.kind === "playerHit") playSfx("enemyAttack", 0.35);
      else if (e.kind === "callout") playSfx("pickup", 0.6);
      else if (e.kind === "loot") {
        useSiege.getState().grant(e.drop);
        playSfx("pickup", e.drop.kind === "cred" ? 0.25 : 0.7);
      } else if (e.kind === "kill" && e.byPlayer) useSiege.getState().pushFeed(`HẠ ${e.victim.toUpperCase()}`, "#ff5a7a");
      else if (e.kind === "streak") {
        useSiege.getState().pushFeed(`ĐA SÁT ×${e.n}`, "#ffd166");
        if (e.n % 5 === 0) playSfx("pickup", 0.9);
      }
    }
    // Danh sách sự kiện có thể bị cắt bớt phía đầu: bám theo độ dài hiện tại
    seen.current = sim.events.length;
    if (sim.phase === "end") useSiege.getState().settle();
  });
  return null;
}

const TRACERS = 320;

/** Tia đạn: thanh sáng mảnh bay từ súng tới mục tiêu, phe Hunter xanh, IXO hồng, tay súng tinh nhuệ dày hơn */
function Tracers({ sim }: { sim: SiegeSim }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const c = useMemo(() => new THREE.Color(), []);
  const z = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  useFrame(() => {
    const o = ref.current;
    if (!o) return;
    let n = 0;
    for (let i = sim.events.length - 1; i >= 0 && n < TRACERS; i--) {
      const e = sim.events[i];
      if (e.kind !== "tracer") continue;
      const age = sim.time - e.at;
      if (age > 0.2) break;
      // Viên đạn bay dọc tia theo thời gian (đầu đạn sáng, dài 3 m)
      const dx = e.x1 - e.x0;
      const dz = e.z1 - e.z0;
      const len = Math.hypot(dx, dz) || 1;
      const u = Math.min(1, age / 0.16);
      const px = e.x0 + dx * u;
      const pz = e.z0 + dz * u;
      q.setFromUnitVectors(z, p.set(dx / len, 0, dz / len));
      // Mờ dần bằng cách thu mảnh lại (màu giữ sáng, không tối thành vạch đen)
      const k = 1 - age / 0.2;
      const thick = (e.hero ? 0.09 : 0.05) * (0.4 + 0.6 * k);
      m.compose(p.set(px, 1.35, pz), q, s.set(thick, thick, Math.min(3, len)));
      o.setMatrixAt(n, m);
      o.setColorAt(n, e.side === 0 ? c.setRGB(1.8, 2.6, 3.4) : c.setRGB(3.4, 0.6, 2.6));
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

const WARN_POOL = 40;

/** Vùng báo trước trên tuyết: vòng đỏ đầy dần (pháo, dậm đất), dải laser, vòm trắng Bom Nova */
function Warns({ sim }: { sim: SiegeSim }) {
  const group = useRef<THREE.Group>(null);
  const nova = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => ({ disc: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), ring: new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), strip: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2) }), []);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    let n = 0;
    let novaW: (typeof sim.warns)[number] | null = null;
    for (const w of sim.warns) {
      if (w.kind === "nova") {
        novaW = w;
        continue;
      }
      if (n + 2 > g.children.length) break;
      const u = Math.min(1, (sim.time - w.warnAt) / Math.max(0.05, w.liveAt - w.warnAt));
      const live = sim.time >= w.liveAt;
      const fill = g.children[n++] as THREE.Mesh;
      const edge = g.children[n++] as THREE.Mesh;
      for (const o of [fill, edge]) o.visible = true;
      const fm = fill.material as THREE.MeshBasicMaterial;
      const em = edge.material as THREE.MeshBasicMaterial;
      const blink = 0.5 + 0.5 * Math.sin(t * (12 + u * 30));
      if (w.kind === "laser") {
        const dx = w.x1 - w.x0;
        const dz = w.z1 - w.z0;
        const len = Math.hypot(dx, dz);
        fill.geometry = geo.strip;
        edge.geometry = geo.strip;
        fill.position.set((w.x0 + w.x1) / 2, 0.12, (w.z0 + w.z1) / 2);
        fill.rotation.set(0, Math.atan2(dx, dz) + Math.PI / 2, 0);
        fill.scale.set(len, 1, w.r * 2 * (live ? 1 : u));
        edge.position.copy(fill.position);
        edge.rotation.copy(fill.rotation);
        edge.scale.set(len, 1, w.r * 2);
      } else {
        fill.geometry = geo.disc;
        edge.geometry = geo.ring;
        fill.position.set(w.x0, 0.12, w.z0);
        fill.rotation.set(0, 0, 0);
        fill.scale.setScalar(w.r * (live ? 1 : u));
        edge.position.set(w.x0, 0.13, w.z0);
        edge.rotation.set(0, 0, 0);
        edge.scale.setScalar(w.r);
      }
      // Kỹ năng của người chơi: lựu đạn vàng cam, pháo quỹ đạo xanh lơ; của địch: đỏ
      if (w.byPlayer) {
        const orb = w.kind === "orbital";
        fm.color.setRGB(live ? 3 : orb ? 0.4 : 2.6, live ? 2.6 : orb ? 2 : 1.6, live ? 2 : orb ? 3 : 0.3);
        em.color.setRGB(orb ? 0.5 : 3, orb ? 2.4 : 2, orb ? 3.2 : 0.4);
      } else {
        fm.color.setRGB(live ? 3 : 2.4, live ? 1.4 : 0.25, live ? 0.4 : 0.3);
        em.color.setRGB(3, 0.4, 0.4);
      }
      fm.opacity = live ? Math.max(0, 1 - (sim.time - w.liveAt) * 2) : 0.25 + blink * 0.15;
      em.opacity = live ? 0 : 0.8;
    }
    for (; n < g.children.length; n++) g.children[n].visible = false;
    if (nova.current) {
      const m = nova.current.material as THREE.MeshBasicMaterial;
      if (novaW) {
        const u = Math.min(1, (sim.time - novaW.warnAt) / (novaW.liveAt - novaW.warnAt));
        const live = sim.time >= novaW.liveAt;
        nova.current.visible = true;
        nova.current.position.set(novaW.x0, 0, novaW.z0);
        nova.current.scale.setScalar(novaW.r * (live ? 1 + (sim.time - novaW.liveAt) * 0.6 : 0.15 + u * 0.85));
        m.opacity = live ? Math.max(0, 1 - (sim.time - novaW.liveAt) * 1.2) : 0.12 + 0.1 * Math.sin(t * (6 + u * 20));
        m.color.setRGB(live ? 4 : 2.6, live ? 4 : 2.6, live ? 4 : 3.4);
      } else nova.current.visible = false;
    }
  });
  return (
    <>
      <group ref={group}>
        {Array.from({ length: WARN_POOL * 2 }, (_, i) => (
          <mesh key={i} visible={false} renderOrder={5}>
            <meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <mesh ref={nova} visible={false}>
        <sphereGeometry args={[1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}

/** Boss Mech khổng lồ của phe IXO (giai đoạn Lõi Thành): bước nặng nề, rung khi dậm đất */
function BossMech({ sim }: { sim: SiegeSim }) {
  const { root } = useFitted("mx_colossus_mech", 13, "height", 0.35);
  const ref = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  useFrame(({ clock }, dt) => {
    const o = ref.current;
    const b = sim.boss;
    if (!o) return;
    o.visible = !!b && b.alive;
    if (!b || !b.alive) return;
    const t = clock.elapsedTime;
    const dx = b.x - o.position.x;
    const dz = b.z - o.position.z;
    if (Math.hypot(dx, dz) > 0.05) yaw.current = THREE.MathUtils.damp(yaw.current, Math.atan2(dx, dz), 3, dt);
    o.position.set(b.x, Math.abs(Math.sin(t * 2.2)) * 0.35, b.z);
    o.rotation.set(0, yaw.current, Math.sin(t * 2.2) * 0.03);
  });
  return (
    <group ref={ref} visible={false}>
      <primitive object={root} />
      <pointLight position={[0, 9, 2]} color="#ff3070" intensity={40} distance={25} />
    </group>
  );
}

export function SiegeFx({ sim }: { sim: SiegeSim }) {
  return (
    <>
      <Tracers sim={sim} />
      <Warns sim={sim} />
      <Suspense fallback={null}>
        <BossMech sim={sim} />
      </Suspense>
    </>
  );
}

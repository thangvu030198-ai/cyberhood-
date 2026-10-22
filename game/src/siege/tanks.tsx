// Tanker khổng lồ của hai phe, vẽ bằng khung xương thật (ít con nên dùng rig đầy đủ, hoạt ảnh mượt):
// - Phe Hunter: robot chiến đấu đỏ (Red Bot, TPS Demo) cao ~7,5 m: đi, bắn pháo giật nòng, trúng đòn
// - Phe IXO: Golem đá / Quái hai đầu cao ~8 m: đi, đập (mượn clip của zombie Brute)
// Chết: đổ sập, lún vào tuyết. Thanh máu lớn trên đầu.

import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extraModel } from "../game/assets";
import { buildRig, flash, setAnim, WHITE, type Rig } from "../level/LevelScene";
import { once } from "../game/meshyAnim";
import type { SiegeSim, Unit } from "./siegeSim";

type Look = { rig: Rig; walk: string; attack: string; idle: string; height: number };

function useHunterTank(): () => Look {
  const g = use(extraModel("redbot"));
  return useMemo(() => () => {
    const find = (n: string) => g.animations.find((a) => a.name === n);
    const rig = buildRig(g.scene, { walk: find("Walk-cycle"), attack: find("Cannon_Fire_Recoil"), idle: find("Idle-cycle"), hit: find("Damage_heavy") }, 7.5, 0.35);
    if (rig.actions.attack) once(rig.actions.attack);
    return { rig, walk: "walk", attack: "attack", idle: "idle", height: 7.5 };
  }, [g]);
}

function useMonsterTank(base: "mx_dr_golem" | "mx_dr_twinhead"): () => Look {
  const g = use(extraModel(`${base}_walk`));
  const atk = use(extraModel("mx_zmb_brute_attack"));
  return useMemo(() => () => {
    const rig = buildRig(g.scene, { walk: g.animations[0], attack: atk.animations[0] }, 8, 0.35);
    if (rig.actions.attack) once(rig.actions.attack);
    return { rig, walk: "walk", attack: "attack", idle: "walk", height: 8 };
  }, [g, atk]);
}

function TankUnit({ sim, u, make }: { sim: SiegeSim; u: Unit; make: () => Look }) {
  const look = useMemo(make, [make]);
  const ref = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);
  const barBg = useRef<THREE.Group>(null);
  const lastAtk = useRef(-9);
  const yaw = useRef(u.yaw);
  useFrame(({ camera }, dt) => {
    const o = ref.current;
    if (!o) return;
    dt = Math.min(dt, 0.1);
    const deadFor = u.alive ? 0 : sim.time - u.diedAt;
    o.visible = u.alive || deadFor < 6;
    if (!o.visible) return;
    yaw.current = THREE.MathUtils.damp(yaw.current, yaw.current + Math.atan2(Math.sin(u.yaw - yaw.current), Math.cos(u.yaw - yaw.current)), 4, dt);
    const R = look.rig;
    if (!u.alive) {
      // Đổ sập về phía trước rồi lún vào tuyết
      const k = Math.min(1, deadFor * 0.9);
      o.position.set(u.x, -Math.max(0, deadFor - 2.5) * 1.2, u.z);
      o.rotation.set(k * 1.35, yaw.current, 0, "YXZ");
    } else {
      o.position.set(u.x, 0, u.z);
      o.rotation.set(0, yaw.current, 0);
      const moving = Math.hypot(u.vx, u.vz) > 0.4;
      const atk = Math.max(u.meleeAt, u.shooting);
      if (atk !== lastAtk.current && sim.time - atk < 0.2) {
        lastAtk.current = atk;
        setAnim(R, look.attack, 0.1, true);
      } else if (sim.time - lastAtk.current > 0.9) setAnim(R, moving ? look.walk : look.idle, 0.25);
      const w = R.actions[look.walk];
      if (w) w.timeScale = moving ? Math.hypot(u.vx, u.vz) / 2.2 : 0.25;
    }
    R.mixer.update(dt);
    const hurt = sim.time - u.hurtAt;
    flash(R.scene, hurt < 0.15 ? 1 - hurt / 0.15 : 0, WHITE);
    // Thanh máu quay về camera
    if (barBg.current) {
      barBg.current.visible = u.alive;
      barBg.current.position.set(u.x, look.height + 1.2, u.z);
      barBg.current.quaternion.copy(camera.quaternion);
    }
    if (bar.current) {
      const k = Math.max(0, u.hp / u.maxHp);
      bar.current.scale.x = Math.max(0.001, k);
      bar.current.position.x = -(1 - k) * 2;
    }
  });
  const color = u.side === 0 ? "#05d9e8" : "#ff2fd0";
  return (
    <>
      <group ref={ref}>
        <primitive object={look.rig.scene} />
        <pointLight position={[0, look.height * 0.7, 1.5]} color={color} intensity={14} distance={10} />
      </group>
      <group ref={barBg}>
        <mesh>
          <planeGeometry args={[4.2, 0.42]} />
          <meshBasicMaterial color="#0a0614" transparent opacity={0.8} depthWrite={false} />
        </mesh>
        <mesh ref={bar} position={[0, 0, 0.01]}>
          <planeGeometry args={[4, 0.3]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

function HunterTanks({ sim }: { sim: SiegeSim }) {
  const make = useHunterTank();
  const tanks = useMemo(() => sim.units.filter((u) => u.role === "tank" && u.side === 0), [sim]);
  return (
    <>
      {tanks.map((u) => (
        <TankUnit key={u.id} sim={sim} u={u} make={make} />
      ))}
    </>
  );
}

function MonsterTanks({ sim, base, odd }: { sim: SiegeSim; base: "mx_dr_golem" | "mx_dr_twinhead"; odd: number }) {
  const make = useMonsterTank(base);
  const tanks = useMemo(() => sim.units.filter((u) => u.role === "tank" && u.side === 1).filter((_, i) => i % 2 === odd), [sim, odd]);
  return (
    <>
      {tanks.map((u) => (
        <TankUnit key={u.id} sim={sim} u={u} make={make} />
      ))}
    </>
  );
}

export function Tanks({ sim }: { sim: SiegeSim }) {
  return (
    <>
      <Suspense fallback={null}>
        <HunterTanks sim={sim} />
      </Suspense>
      <Suspense fallback={null}>
        <MonsterTanks sim={sim} base="mx_dr_golem" odd={0} />
      </Suspense>
      <Suspense fallback={null}>
        <MonsterTanks sim={sim} base="mx_dr_twinhead" odd={1} />
      </Suspense>
    </>
  );
}

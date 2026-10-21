import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extraModel, models, playSfx } from "./assets";
import { inPlace } from "./meshyAnim";
import { clipRootSpeed, Locomotion } from "./locomotion";
import { alarm } from "./trafficWorld";
import { fitCharacter } from "./Player";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CITY, CITY_HALF, CITY_PITCH, HUB_PEACEFUL, PALETTE, PLAYER, QUARANTINE, SAFE_ZONE, inQuarantine, inSafeZone, mulberry32 } from "./config";
import { fx } from "./Effects";
import { handles } from "./refs";
import { useGame } from "./store";
import { mergeByMaterial } from "./Vehicles";
import { questProgress } from "./quests";
import { lineOfSight, pushOutOfBuildings, raySphere } from "./world";

// Drone an ninh của OMNI-DYNE: tuần tra quanh điểm gốc, phát hiện thì bay vòng quanh người chơi và bắn laser.

type DroneState = "patrol" | "chase" | "flee" | "dead";
/**
 * legion: drone thường; trooper: lính Legion đi bộ (model Meshy); courier: drone đưa thư bỏ chạy (nhiệm vụ rượt đuổi);
 * boss: trùm Mech sự kiện phút 4
 */
export type DroneKind = "legion" | "trooper" | "courier" | "boss" | "zombie";

export type Drone = {
  id: number;
  kind: DroneKind;
  maxHp: number;
  /** Kích thước hiển thị và vùng trúng đạn */
  size: number;
  home: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  wander: THREE.Vector3;
  nextWander: number;
  hp: number;
  state: DroneState;
  nextShot: number;
  deadAt: number;
  hurtAt: number;
  /** Lần bắn gần nhất (để trùm chạy động tác giật pháo) */
  firedAt: number;
  orbit: number;
  /** Kiểu zombie (model + chỉ số) */
  look?: ZombieLook;
  /** Thời điểm đòn vồ của zombie chạm tới (theo đồng hồ game), -1 nếu không có */
  strikeAt?: number;
};

export type ZombieLook =
  | "zmb_walker"
  | "zmb_runner"
  | "zmb_soldier"
  | "zmb_nurse"
  | "zmb_brute"
  | "mon_psycho"
  | "mon_mutant"
  | "mon_alien"
  | "mon_robot_reaper"
  | "mon_cyborg_hound_rider"
  | "zmb_hazmat"
  | "zmb_cyborg";
/** Chỉ số theo kiểu: máu, tốc độ lảo đảo / lao tới, sát thương mỗi đòn, chiều cao model */
const ZOMBIE_STATS: Record<ZombieLook, { hp: number; walk: number; chase: number; dmg: number; height: number; count: number }> = {
  zmb_walker: { hp: 60, walk: 0.9, chase: 2.6, dmg: 8, height: 1.75, count: 5 },
  zmb_runner: { hp: 45, walk: 1.2, chase: 6.2, dmg: 6, height: 1.7, count: 4 },
  zmb_soldier: { hp: 110, walk: 0.9, chase: 3, dmg: 10, height: 1.85, count: 3 },
  zmb_nurse: { hp: 60, walk: 1, chase: 3.4, dmg: 9, height: 1.7, count: 2 },
  zmb_brute: { hp: 420, walk: 0.8, chase: 2.4, dmg: 24, height: 2.5, count: 2 },
  mon_psycho: { hp: 260, walk: 1.4, chase: 6.8, dmg: 18, height: 1.95, count: 1 },
  mon_mutant: { hp: 700, walk: 1, chase: 3.2, dmg: 30, height: 2.4, count: 1 },
  mon_alien: { hp: 300, walk: 1.1, chase: 5, dmg: 16, height: 2.3, count: 1 },
  mon_robot_reaper: { hp: 350, walk: 1, chase: 4.5, dmg: 20, height: 2, count: 1 },
  mon_cyborg_hound_rider: { hp: 150, walk: 1.2, chase: 4, dmg: 12, height: 1.85, count: 2 },
  zmb_hazmat: { hp: 90, walk: 0.9, chase: 3, dmg: 9, height: 1.8, count: 2 },
  zmb_cyborg: { hp: 140, walk: 1, chase: 3.6, dmg: 12, height: 1.85, count: 2 },
};
const ZOMBIE_REACH = 1.7;

const DRONE_COUNT = 14;
const TROOPER_COUNT = 8;
const TROOPER_HP = 80;
/** Lính đi bộ: tâm vùng trúng đạn ngang bụng, chân chạm đất */
const TROOPER_CENTER = 1.0;
const COURIER_HP = 160;
const BOSS_HP = 2400;
const COURIER_SPEED = 9;
/** Trùm là robot đi bộ: tâm vùng trúng đạn ở giữa thân, chân chạm đất */
const BOSS_CENTER = 2.7;
const BOSS_HEIGHT = 5.6;
const DRONE_HP = 100;
const HIT_RADIUS = 0.95;
const HOVER = 4.5;
const ATTACK_HEIGHT = 3.2;
const PATROL_SPEED = 4;
const CHASE_SPEED = 10;
const STANDOFF = 10;
const FIRE_RANGE = 28;
/** Drone không được lại gần camera hơn khoảng này, và bị ẩn nếu vẫn lọt vào quá sát */
const CAMERA_CLEAR = 6;
const CAMERA_HIDE = 3.5;

/** Danh sách drone dùng chung cho vũ khí và minimap */
export const drones: Drone[] = (() => {
  const rand = mulberry32(404);
  const streets = Array.from({ length: CITY.GRID + 1 }, (_, i) => (i - CITY.GRID / 2) * CITY_PITCH);
  const list: Drone[] = [];
  while (list.length < DRONE_COUNT) {
    const street = streets[Math.floor(rand() * streets.length)];
    const along = (rand() - 0.5) * CITY_HALF * 1.7;
    const alongX = rand() < 0.5;
    const home = alongX ? new THREE.Vector3(along, HOVER, street) : new THREE.Vector3(street, HOVER, along);
    // Không đặt drone sát điểm xuất phát
    if (Math.hypot(home.x - PLAYER.spawn[0], home.z - PLAYER.spawn[2]) < 35) continue;
    list.push({
      id: list.length,
      kind: "legion",
      maxHp: DRONE_HP,
      size: 1,
      home,
      pos: home.clone(),
      vel: new THREE.Vector3(),
      wander: home.clone(),
      nextWander: 0,
      hp: DRONE_HP,
      state: "patrol",
      nextShot: 0,
      deadAt: 0,
      hurtAt: -1,
      firedAt: -1,
      orbit: rand() * Math.PI * 2,
    });
  }
  // Lính Legion đi bộ tuần tra trên phố
  for (let i = 0; list.length < DRONE_COUNT + TROOPER_COUNT && i < 200; i++) {
    const street = streets[Math.floor(rand() * streets.length)];
    const along = (rand() - 0.5) * CITY_HALF * 1.6;
    const alongX = rand() < 0.5;
    const lane = (rand() < 0.5 ? -1 : 1) * 5;
    const home = alongX
      ? new THREE.Vector3(along, TROOPER_CENTER, street + lane)
      : new THREE.Vector3(street + lane, TROOPER_CENTER, along);
    if (Math.hypot(home.x - PLAYER.spawn[0], home.z - PLAYER.spawn[2]) < 40) continue;
    // Cứ 4 lính có 1 lính hạng nặng: to hơn, trâu hơn
    const heavy = (list.length - DRONE_COUNT) % 4 === 0;
    list.push({
      id: list.length,
      kind: "trooper",
      maxHp: heavy ? TROOPER_HP * 2.5 : TROOPER_HP,
      size: heavy ? 1.2 : 1,
      home,
      pos: home.clone(),
      vel: new THREE.Vector3(),
      wander: home.clone(),
      nextWander: 0,
      hp: heavy ? TROOPER_HP * 2.5 : TROOPER_HP,
      state: "patrol",
      nextShot: 0,
      deadAt: 0,
      hurtAt: -1,
      firedAt: -1,
      orbit: rand() * Math.PI * 2,
    });
  }
  // Zombie cyber lang thang trong Vùng cách ly phía tây
  for (const look of Object.keys(ZOMBIE_STATS) as ZombieLook[]) {
    const st = ZOMBIE_STATS[look];
    for (let k = 0; k < st.count; k++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * QUARANTINE.r * 0.85;
      const home = new THREE.Vector3(QUARANTINE.x + Math.cos(a) * r, TROOPER_CENTER, QUARANTINE.z + Math.sin(a) * r);
      list.push({
        id: list.length,
        kind: "zombie",
        look,
        maxHp: st.hp,
        size: st.height / 1.8,
        home,
        pos: home.clone(),
        vel: new THREE.Vector3(),
        wander: home.clone(),
        nextWander: 0,
        hp: st.hp,
        state: "patrol",
        nextShot: 0,
        deadAt: 0,
        hurtAt: -1,
        firedAt: -1,
        orbit: rand() * Math.PI * 2,
      });
    }
  }
  // Hai suất đặc biệt cho hợp đồng, nằm im (dead) tới khi được kích hoạt và không tự hồi sinh
  for (const kind of ["courier", "boss"] as const) {
    list.push({
      id: list.length,
      kind,
      maxHp: kind === "boss" ? BOSS_HP : COURIER_HP,
      size: kind === "boss" ? 3.2 : 1.2,
      home: new THREE.Vector3(),
      pos: new THREE.Vector3(0, -50, 0),
      vel: new THREE.Vector3(),
      wander: new THREE.Vector3(),
      nextWander: 0,
      hp: 0,
      state: "dead",
      nextShot: 0,
      deadAt: 0,
      hurtAt: -1,
      firedAt: -1,
      orbit: 0,
    });
  }
  // Hub hoà bình: không drone/lính/zombie nào trên phố (giữ danh sách để code cũ vẫn chạy)
  if (HUB_PEACEFUL)
    for (const d of list) {
      d.state = "dead";
      d.hp = 0;
      d.pos.set(0, -50, 0);
    }
  return list;
})();

/** Kích hoạt drone đặc biệt tại một điểm (hợp đồng gọi) */
export function spawnSpecial(kind: Exclude<DroneKind, "legion">, at: THREE.Vector3) {
  const d = drones.find((x) => x.kind === kind)!;
  d.pos.copy(at).setY(kind === "boss" ? BOSS_CENTER : HOVER);
  d.home.copy(d.pos);
  d.vel.set(0, 0, 0);
  d.hp = d.maxHp;
  d.state = kind === "courier" ? "flee" : "chase";
  d.nextShot = clock + 2;
  return d;
}

export function despawnSpecial(kind: Exclude<DroneKind, "legion">) {
  const d = drones.find((x) => x.kind === kind)!;
  d.state = "dead";
  d.pos.set(0, -50, 0);
}

export const specialDrone = (kind: Exclude<DroneKind, "legion">) => drones.find((x) => x.kind === kind)!;

/** Người nghe sự kiện hạ drone (hợp đồng: cộng kill, thanh biến hình, hoàn thành nhiệm vụ) */
type KillListener = (d: Drone) => void;
const killListeners = new Set<KillListener>();
export function onDroneKilled(fn: KillListener) {
  killListeners.add(fn);
  return () => void killListeners.delete(fn);
}

/** Hệ số sát thương người chơi gây ra cho từng loại (trùm Mech gần như miễn nhiễm súng thường) */
let bossDamageScale = 0.08;
export function setBossDamageScale(v: number) {
  bossDamageScale = v;
}

let clock = 0;

/** Tia bắn của người chơi chạm drone nào gần nhất */
export function hitDrones(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) {
  let best: Drone | null = null;
  let bestT = maxDist;
  for (const d of drones) {
    if (d.state === "dead") continue;
    const t = raySphere(origin, dir, d.pos, HIT_RADIUS * d.size);
    if (t !== null && t < bestT) {
      bestT = t;
      best = d;
    }
  }
  return best ? { drone: best, t: bestT } : null;
}

/** Drone còn sống gần nhất trong tầm nhìn, cho tính năng tự ngắm trên điện thoại */
export function nearestVisibleDrone(from: THREE.Vector3, forward: THREE.Vector3, range: number, maxAngle: number) {
  let best: Drone | null = null;
  let bestScore = Infinity;
  const to = new THREE.Vector3();
  for (const d of drones) {
    if (d.state === "dead") continue;
    to.subVectors(d.pos, from);
    const dist = to.length();
    if (dist > range) continue;
    const angle = to.normalize().angleTo(forward);
    if (angle > maxAngle) continue;
    if (!lineOfSight(from, d.pos)) continue;
    const score = dist * (1 + angle);
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function damageDrone(d: Drone, amount: number) {
  if (d.state === "dead") return;
  d.hp -= d.kind === "boss" ? amount * bossDamageScale : amount;
  d.hurtAt = clock;
  const game = useGame.getState();
  // Bị bắn thì drone này và đồng đội quanh đó lao vào truy đuổi
  for (const other of drones) {
    if ((other.kind === "legion" || other.kind === "trooper") && other.state !== "dead" && other.pos.distanceTo(d.pos) < 35) other.state = "chase";
  }
  if (d.hp > 0) {
    playSfx("enemyHurt", 0.7);
    return;
  }
  d.state = "dead";
  d.deadAt = clock;
  questProgress("kill");
  fx.blast(d.pos);
  if (d.kind === "boss") for (let i = 0; i < 6; i++) fx.blast(_away.copy(d.pos).add(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 3, (Math.random() - 0.5) * 6)));
  fx.chip(d.pos, (15 + Math.floor(Math.random() * 20) + game.wanted * 5) * (d.kind === "boss" ? 8 : 1));
  playSfx("enemyDestroy", 0.9);
  game.registerKill();
  for (const fn of killListeners) fn(d);
}

function respawnDelay(wanted: number) {
  return wanted >= 3 ? 8 : 22;
}

const _target = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _miss = new THREE.Vector3();
const _away = new THREE.Vector3();

/** Drone Legion chi tiết cao "S2WT Kamdo" (Hansalex, CC-BY 4.0): thân kim loại, mắt đỏ phát sáng */
function useKamdo(index: number) {
  const gltf = use(extraModel("kamdo"));
  return useMemo(() => {
    const s = gltf.scene.clone(true);
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const dim = box.getSize(new THREE.Vector3());
    const k = (1.7 * drones[index].size) / Math.max(dim.x, dim.y, dim.z);
    const c = box.getCenter(new THREE.Vector3());
    s.scale.setScalar(k);
    s.position.set(-c.x * k, -c.y * k, -c.z * k);
    const materials: THREE.MeshStandardMaterial[] = [];
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (drones[index].kind === "courier") mat.color.lerp(new THREE.Color("#ffc23d"), 0.6);
      mat.emissive.set(PALETTE.pink);
      mat.emissiveIntensity = 0.08;
      m.material = mat;
      materials.push(mat);
    });
    const root = new THREE.Group();
    root.add(s);
    return { scene: root, materials };
  }, [gltf, index]);
}

function KenneyDrone({ index }: { index: number }) {
  const gltf = use(models.drone);
  const { scene, materials } = useMemo(() => {
    // Mọi phần của drone dùng chung texture colormap: gộp thành một lưới, một vật liệu riêng mỗi drone
    const src = gltf.scene.clone(true);
    let material: THREE.MeshStandardMaterial | null = null;
    src.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!material) {
        material = (mesh.material as THREE.MeshStandardMaterial).clone();
        // Tông thép tối của OMNI-DYNE, đèn đỏ khi trúng đạn; drone đưa thư màu vàng, trùm màu đỏ
        const kind = drones[index].kind;
        material.color.multiplyScalar(0.55);
        if (kind === "courier") material.color.set("#d9a316");
        if (kind === "boss") material.color.set("#5a0f1c");
        material.emissive.set(PALETTE.pink);
        material.emissiveIntensity = 0.08;
      }
      mesh.material = material;
    });
    const s = mergeByMaterial(src);
    s.scale.setScalar(1.4 * drones[index].size);
    const root = new THREE.Group();
    root.add(s);
    return { scene: root, materials: material ? [material as THREE.MeshStandardMaterial] : [] };
  }, [gltf, index]);
  return <DroneBody index={index} scene={scene} materials={materials} />;
}

function KamdoDrone({ index }: { index: number }) {
  const { scene, materials } = useKamdo(index);
  return <DroneBody index={index} scene={scene} materials={materials} />;
}

/** Drone Legion: hiện drone Kenney trong lúc model Kamdo đang tải nền */
function DroneModel({ index }: { index: number }) {
  return (
    <Suspense fallback={<KenneyDrone index={index} />}>
      <KamdoDrone index={index} />
    </Suspense>
  );
}

function DroneBody({ index, scene, materials }: { index: number; scene: THREE.Object3D; materials: THREE.MeshStandardMaterial[] }) {
  const eye = useMemo(() => new THREE.Color("#ff1f3d").multiplyScalar(6), []);
  const ref = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    const d = drones[index];
    const g = ref.current;
    if (!g) return;
    // Ẩn drone khi nó lọt sát ống kính, tránh một khối khổng lồ che kín màn hình
    g.visible = d.state !== "dead" && d.pos.distanceTo(camera.position) > CAMERA_HIDE;
    if (!g.visible) return;
    g.position.copy(d.pos);
    g.position.y += Math.sin(clock * 2.2 + index) * 0.12;
    // Xoay về phía người chơi khi truy đuổi, theo hướng bay khi tuần tra
    const look = d.state === "chase" ? _aim.subVectors(_target, d.pos) : d.vel;
    if (look.lengthSq() > 0.01) {
      const yaw = Math.atan2(look.x, look.z);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, g.rotation.y + shortest(g.rotation.y, yaw), 0.15);
    }
    g.rotation.z = THREE.MathUtils.clamp(-d.vel.x * 0.02, -0.3, 0.3);
    const hurt = clock - d.hurtAt < 0.12;
    for (const m of materials) m.emissiveIntensity = hurt ? 1.6 : 0.08;
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
      <mesh position={[0, 0.35 * drones[index].size, 0.45 * drones[index].size]} scale={drones[index].size}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshBasicMaterial color={eye} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Lính Legion đi bộ (model Meshy, đã gắn xương): đi khi tuần tra, chạy khi truy đuổi */
const TROOPER_LOOKS = ["trooper", "sniper", "officer", "android"] as const;
/** Kiểu giáp nào có sẵn clip bắn/ngã riêng; kiểu còn lại mượn của sĩ quan (cùng bộ xương Meshy) */
const OWN_COMBAT_CLIPS = new Set(["sniper", "officer", "android"]);
const DEATH_SHOW = 2.6;

function TrooperModel({ index }: { index: number }) {
  const heavy = drones[index].size > 1;
  // Lính thường xoay vòng giữa bốn kiểu giáp Legion; lính nặng dùng model riêng
  const look = heavy ? "heavy" : TROOPER_LOOKS[index % TROOPER_LOOKS.length];
  const combat = (OWN_COMBAT_CLIPS.has(look) ? look : "officer") as "sniper" | "officer" | "android";
  const walkGltf = use(extraModel(`mx_legion_${look}_walk`));
  const runGltf = use(extraModel(`mx_legion_${look}_run`));
  const idleGltf = use(extraModel(`mx_legion_${combat}_idle`));
  const shootGltf = use(extraModel(`mx_legion_${combat}_walkshoot`));
  const deathGltf = use(extraModel(`mx_legion_${combat}_death`));
  const ref = useRef<THREE.Group>(null);
  const seen = useRef({ dead: false, fired: -1 });
  const { scene, loco, shoot, death, mats } = useMemo(() => {
    const s = cloneSkinned(walkGltf.scene);
    fitCharacter(s, heavy ? 2.25 : 1.85, -TROOPER_CENTER);
    const mats: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      // Dải visor đỏ tự sáng nhẹ theo texture để thấy lính trong đêm
      if (mat.map && !mat.emissiveMap) {
        mat.emissiveMap = mat.map;
        mat.emissive.set("#ffffff");
        mat.emissiveIntensity = 0.5;
      }
      m.material = mat;
      mats.push({ mat, base: mat.emissive.clone() });
    });
    const mixer = new THREE.AnimationMixer(s);
    const raw = (g: { animations: THREE.AnimationClip[] }) => g.animations[0];
    const act = (g: { animations: THREE.AnimationClip[] }) => (raw(g) ? mixer.clipAction(inPlace(raw(g))) : null);
    const loco = new Locomotion(mixer, act(idleGltf), act(walkGltf), act(runGltf), {
      walk: raw(walkGltf) ? clipRootSpeed(raw(walkGltf), s) : 0,
      run: raw(runGltf) ? clipRootSpeed(raw(runGltf), s) : 0,
    });
    return { scene: s, loco, shoot: act(shootGltf), death: act(deathGltf), mats };
  }, [walkGltf, runGltf, idleGltf, shootGltf, deathGltf, heavy]);
  useFrame(({ camera }, dt) => {
    const d = drones[index];
    const g = ref.current;
    if (!g) return;
    const step = Math.min(dt, 0.1);
    const dead = d.state === "dead";
    const dying = dead && clock - d.deadAt < DEATH_SHOW && d.pos.y > -10;
    g.visible = (!dead || dying) && d.pos.distanceTo(camera.position) < 90;
    if (!dead && seen.current.dead) {
      seen.current.dead = false;
      loco.release();
    }
    if (!g.visible) return;
    if (dying) {
      // Ngã xuống tại chỗ rồi biến mất
      if (!seen.current.dead) {
        seen.current.dead = true;
        loco.play(death, true);
      }
      loco.update(0, step);
      return;
    }
    g.position.copy(d.pos);
    const speed = Math.hypot(d.vel.x, d.vel.z);
    const look = d.state === "chase" ? _aim.subVectors(_target, d.pos) : d.vel;
    if (look.lengthSq() > 0.01) {
      const yaw = Math.atan2(look.x, look.z);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, g.rotation.y + shortest(g.rotation.y, yaw), 0.15);
    }
    // Mỗi phát bắn: giương súng bắn một nhịp rồi trở lại dáng đi/chạy
    if (d.firedAt !== seen.current.fired) {
      seen.current.fired = d.firedAt;
      if (d.state === "chase" && clock - d.firedAt < 0.2) loco.play(shoot);
    }
    const hurt = clock - d.hurtAt < 0.12;
    for (const { mat, base } of mats) {
      if (hurt) mat.emissive.setRGB(1, 0.15, 0.15);
      else mat.emissive.copy(base);
    }
    if (camera.position.distanceTo(d.pos) < 55) loco.update(speed, step);
  });
  return (
    <group ref={ref} visible={false}>
      <primitive object={scene} />
    </group>
  );
}

/** Zombie cyber (Meshy, đã gắn xương): lảo đảo khi lang thang, chạy khi lao tới, vồ đánh, gào khi phát hiện, ngã khi chết */
function ZombieModel({ index }: { index: number }) {
  const d0 = drones[index];
  const look = d0.look ?? "zmb_walker";
  const st = ZOMBIE_STATS[look];
  const g = {
    body: use(extraModel(`mx_${look}_walk`)),
    stagger: use(extraModel(`mx_${look}_stagger`)),
    run: use(extraModel(`mx_${look}_run`)),
    attack: use(extraModel(`mx_${look}_attack`)),
    scream: use(extraModel(`mx_${look}_scream`)),
    death: use(extraModel(`mx_${look}_death`)),
  };
  const ref = useRef<THREE.Group>(null);
  const prev = useRef({ state: "patrol" as DroneState, firedAt: -1, deadSeen: false, screamAt: -99 });
  const { scene, loco, acts, mats } = useMemo(() => {
    const s = cloneSkinned(g.body.scene);
    fitCharacter(s, st.height, -TROOPER_CENTER);
    const mats: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      if (mat.map && !mat.emissiveMap) {
        mat.emissiveMap = mat.map;
        mat.emissive.set("#b6ffb0");
        mat.emissiveIntensity = 0.3;
      }
      m.material = mat;
      mats.push({ mat, base: mat.emissive.clone() });
    });
    const mixer = new THREE.AnimationMixer(s);
    const raw = (gl: { animations: THREE.AnimationClip[] }) => gl.animations[0];
    const act = (gl: { animations: THREE.AnimationClip[] }) => (raw(gl) ? mixer.clipAction(inPlace(raw(gl))) : null);
    // Lảo đảo là dáng "đi", chạy là dáng lao tới; tốc độ clip đo từ root motion để chân không trượt
    const loco = new Locomotion(mixer, null, act(g.stagger), act(g.run), {
      walk: raw(g.stagger) ? clipRootSpeed(raw(g.stagger), s) : 0,
      run: raw(g.run) ? clipRootSpeed(raw(g.run), s) : 0,
      gaitWalk: st.walk,
      gaitRun: st.chase,
    });
    return { scene: s, loco, acts: { attack: act(g.attack), scream: act(g.scream), death: act(g.death) }, mats };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...Object.values(g), st.height]);
  useFrame(({ camera }, dt) => {
    const d = drones[index];
    const grp = ref.current;
    if (!grp) return;
    const step = Math.min(dt, 0.1);
    const p = prev.current;
    const dead = d.state === "dead";
    const dying = dead && clock - d.deadAt < DEATH_SHOW;
    grp.visible = (!dead || dying) && d.pos.distanceTo(camera.position) < 80;
    if (!dead && p.deadSeen) {
      p.deadSeen = false;
      loco.release();
    }
    if (!grp.visible) return;
    if (dying) {
      if (!p.deadSeen) {
        p.deadSeen = true;
        loco.play(acts.death, true);
      }
      loco.update(0, step);
      return;
    }
    // Vừa phát hiện người chơi: gào lên
    if (d.state === "chase" && p.state !== "chase" && clock - p.screamAt > 12) {
      p.screamAt = clock;
      loco.play(acts.scream);
    }
    p.state = d.state;
    if (d.firedAt !== p.firedAt) {
      p.firedAt = d.firedAt;
      if (d.state === "chase" && clock - d.firedAt < 0.2) loco.play(acts.attack);
    }
    grp.position.copy(d.pos);
    const speed = Math.hypot(d.vel.x, d.vel.z);
    const face = d.state === "chase" ? _aim.subVectors(_target, d.pos) : d.vel;
    if (face.lengthSq() > 0.01) {
      const yaw = Math.atan2(face.x, face.z);
      grp.rotation.y = THREE.MathUtils.lerp(grp.rotation.y, grp.rotation.y + shortest(grp.rotation.y, yaw), 0.12);
    }
    const hurt = clock - d.hurtAt < 0.12;
    for (const { mat, base } of mats) {
      if (hurt) mat.emissive.setRGB(1, 0.15, 0.15);
      else mat.emissive.copy(base);
    }
    if (camera.position.distanceTo(d.pos) < 55) loco.update(speed, step);
  });
  return (
    <group ref={ref} visible={false}>
      <primitive object={scene} />
    </group>
  );
}

/** Trùm Mech: robot đỏ đi bộ của Godot TPS Demo (CC-BY 3.0), bước đi và giật pháo khi bắn */
function BossModel({ index }: { index: number }) {
  const gltf = use(extraModel("redbot"));
  const ref = useRef<THREE.Group>(null);
  const { scene, mixer, walk, recoil, glow } = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    fitCharacter(s, BOSS_HEIGHT, -BOSS_CENTER);
    const glow: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 2.5);
      // Giáp đỏ sẫm dễ chìm trong đêm: thêm chút tự sáng theo texture
      if (!mat.emissiveMap && mat.map) {
        mat.emissiveMap = mat.map;
        mat.emissive.set("#ffffff");
        mat.emissiveIntensity = 0.35;
      }
      m.material = mat;
      glow.push({ mat, base: mat.emissive.clone() });
    });
    const mixer = new THREE.AnimationMixer(s);
    const clip = (n: string) => gltf.animations.find((a) => a.name === n);
    const walkClip = clip("Walk-cycle");
    const walk = walkClip ? mixer.clipAction(walkClip) : null;
    walk?.play();
    const recoilClip = clip("Cannon_Fire_Recoil");
    const recoil = recoilClip ? mixer.clipAction(recoilClip).setLoop(THREE.LoopOnce, 1) : null;
    return { scene: s, mixer, walk, recoil, glow };
  }, [gltf]);
  const lastFired = useRef(-1);
  const light = useRef<THREE.PointLight>(null);
  useFrame((_, dt) => {
    const d = drones[index];
    const g = ref.current;
    if (!g) return;
    g.visible = d.state !== "dead";
    // Đèn nằm ngoài nhóm, chỉ đổi độ sáng (đổi số đèn làm mọi shader biên dịch lại)
    if (light.current) {
      light.current.intensity = g.visible ? 60 : 0;
      light.current.position.set(d.pos.x, d.pos.y + 1, d.pos.z);
    }
    if (!g.visible) return;
    g.position.copy(d.pos);
    _aim.subVectors(_target, d.pos);
    if (_aim.lengthSq() > 0.01) {
      const yaw = Math.atan2(_aim.x, _aim.z);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, g.rotation.y + shortest(g.rotation.y, yaw), 0.1);
    }
    if (walk) walk.timeScale = THREE.MathUtils.clamp(d.vel.length() / 3, 0.2, 1.4);
    if (recoil && d.firedAt !== lastFired.current) {
      lastFired.current = d.firedAt;
      recoil.reset().fadeIn(0.05).play();
    }
    const hurt = clock - d.hurtAt < 0.12;
    for (const { mat, base } of glow) {
      if (hurt) mat.emissive.setRGB(1, 0.15, 0.15);
      else mat.emissive.copy(base);
    }
    mixer.update(Math.min(dt, 0.1));
  });
  return (
    <>
      <group ref={ref} visible={false}>
        <primitive object={scene} />
      </group>
      <pointLight ref={light} color="#ff3a2a" intensity={0} distance={14} decay={2} />
    </>
  );
}

function shortest(from: number, to: number) {
  return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export function Enemies() {
  useFrame(({ camera }, dt) => {
    clock += dt;
    const step = Math.min(dt, 1 / 20);
    const game = useGame.getState();
    const car = game.mode === "drive" && game.carId !== null ? handles.cars.get(game.carId) : null;
    const player = handles.player;
    // Trong vault thì drone ngoài phố mất dấu người chơi
    // Trong Vùng An toàn (Hub) người chơi không bị truy đuổi hay bắn
    const safe = inSafeZone(_target.x, _target.z);
    const alive = game.flatlinedAt === null && !!player && game.location === "city" && !safe;
    if (car) _target.copy(car.currPos).setY(car.currPos.y + 0.6);
    else if (player) _target.copy(player.currPos).setY(player.currPos.y + 0.5);
    const targetSpeed = car ? car.currLinVel.length() : (player?.currLinVel.length() ?? 0);
    const aggro = 28 + game.wanted * 12;

    for (const d of drones) {
      if (d.state === "dead") {
        if (d.kind !== "legion" && d.kind !== "trooper" && d.kind !== "zombie") continue;
        if (clock - d.deadAt > (d.kind === "zombie" ? 30 : respawnDelay(game.wanted))) {
          d.state = game.wanted >= 2 && d.kind !== "zombie" ? "chase" : "patrol";
          d.hp = d.maxHp;
          // Drone bay xuống từ trên cao, lính và zombie hiện lại ở điểm gốc
          d.pos.set(d.home.x, d.kind === "legion" ? 30 : TROOPER_CENTER, d.home.z);
          d.vel.set(0, 0, 0);
        }
        continue;
      }

      const dist = d.pos.distanceTo(_target);
      if (d.kind === "zombie") {
        updateZombie(d, dist, alive && !car, step);
        continue;
      }
      const sees = alive && dist < aggro * 1.6 && lineOfSight(d.pos, _target);

      if (d.state === "flee") {
        // Drone đưa thư: chạy ra xa người chơi, bám trong thành phố, lượn ngoằn ngoèo cho khó bắn
        _desired.subVectors(d.pos, _target).setY(0);
        if (_desired.lengthSq() < 0.01) _desired.set(1, 0, 0);
        _desired.normalize();
        _desired.x += Math.sin(clock * 0.9 + d.id) * 0.6;
        _desired.z += Math.cos(clock * 0.7 + d.id) * 0.6;
        // Gần mép thành phố thì quay vào trong
        if (Math.abs(d.pos.x) > CITY_HALF * 0.85) _desired.x -= Math.sign(d.pos.x) * 2;
        if (Math.abs(d.pos.z) > CITY_HALF * 0.85) _desired.z -= Math.sign(d.pos.z) * 2;
        _desired.normalize().multiplyScalar(dist > 60 ? COURIER_SPEED * 0.3 : COURIER_SPEED);
        _desired.y = (HOVER + 1 - d.pos.y) * 2;
      } else if (d.state === "patrol") {
        if (alive && dist < aggro && (sees || game.wanted >= 2)) d.state = "chase";
        if (clock > d.nextWander) {
          d.wander.set(
            d.home.x + (Math.random() - 0.5) * 24,
            d.kind === "trooper" ? TROOPER_CENTER : HOVER + Math.random() * 2,
            d.home.z + (Math.random() - 0.5) * 24,
          );
          d.nextWander = clock + 4 + Math.random() * 4;
        }
        _desired.subVectors(d.wander, d.pos);
        const len = _desired.length();
        _desired.multiplyScalar(len > 1 ? (d.kind === "trooper" ? 1.6 : PATROL_SPEED) / len : 0);
      } else {
        if ((d.kind === "legion" || d.kind === "trooper") && (!alive || (dist > aggro * 1.8 && game.wanted === 0))) {
          d.state = "patrol";
          continue;
        }
        // Bay vòng quanh mục tiêu ở khoảng cách STANDOFF
        d.orbit += step * 0.5;
        // Phía sau lưng người chơi là chỗ camera đứng: khi vòng qua đó thì bay vọt lên cao
        const camSide = Math.atan2(camera.position.z - _target.z, camera.position.x - _target.x);
        const behind = Math.max(0, Math.cos(d.orbit - camSide));
        const boss = d.kind === "boss";
        const trooper = d.kind === "trooper";
        const standoff = boss ? STANDOFF * 1.8 : trooper ? STANDOFF * 1.3 : STANDOFF;
        _desired.set(
          _target.x + Math.cos(d.orbit) * standoff,
          // Sà thấp khi tấn công để người chơi ngắm được
          boss ? BOSS_CENTER : trooper ? TROOPER_CENTER : ATTACK_HEIGHT + Math.sin(d.orbit * 1.7) * 0.8 + behind * behind * 9,
          _target.z + Math.sin(d.orbit) * standoff,
        );
        _desired.sub(d.pos);
        const len = _desired.length();
        const top = trooper ? CHASE_SPEED * 0.55 : CHASE_SPEED;
        _desired.multiplyScalar(len > 0.5 ? Math.min(top, len * 2) / len : 0);

        if (sees && dist < FIRE_RANGE && clock > d.nextShot) {
          d.nextShot = clock + Math.max(0.6, 1.5 - game.wanted * 0.15) + Math.random() * 0.6;
          shoot(d, dist, targetSpeed, !!car, game.wanted);
        }
      }

      // Đẩy drone ra xa camera nếu nó bay lại quá gần
      _away.subVectors(d.pos, camera.position);
      const camDist = _away.length();
      if (camDist < CAMERA_CLEAR) {
        _away.y = Math.abs(_away.y) + 1;
        _desired.addScaledVector(_away.normalize(), (CAMERA_CLEAR - camDist) * 4);
      }

      d.vel.lerp(_desired, 1 - Math.exp(-2.5 * step));
      d.pos.addScaledVector(d.vel, step);
      d.pos.y = d.kind === "boss" ? BOSS_CENTER : d.kind === "trooper" ? TROOPER_CENTER : THREE.MathUtils.clamp(d.pos.y - (d.pos.y > 14 ? 8 * step : 0), 2.5, 32);
      pushOutOfBuildings(d.pos);
      // Địch không bước vào Vùng An toàn (trừ trùm sự kiện, vốn chỉ xuất hiện khi đang làm hợp đồng)
      if (d.kind !== "boss") {
        const dx = d.pos.x - SAFE_ZONE.x;
        const dz = d.pos.z - SAFE_ZONE.z;
        const r = Math.hypot(dx, dz);
        const edge = SAFE_ZONE.r + 4;
        if (r < edge && r > 0.01) {
          d.pos.x = SAFE_ZONE.x + (dx / r) * edge;
          d.pos.z = SAFE_ZONE.z + (dz / r) * edge;
        }
      }
    }
  });

  return (
    <>
      {drones.map((d) =>
        d.kind === "boss" ? (
          <Suspense key={d.id} fallback={<KenneyDrone index={d.id} />}>
            <BossModel index={d.id} />
          </Suspense>
        ) : d.kind === "zombie" ? (
          <Suspense key={d.id} fallback={null}>
            <ZombieModel index={d.id} />
          </Suspense>
        ) : d.kind === "trooper" ? (
          <Suspense key={d.id} fallback={null}>
            <TrooperModel index={d.id} />
          </Suspense>
        ) : (
          <DroneModel key={d.id} index={d.id} />
        ),
      )}
    </>
  );
}

/** Zombie: lảo đảo quanh điểm gốc trong Vùng cách ly; thấy người chơi trong tầm 22m thì lao tới,
 * sát bên thì vồ đánh. Không rời khỏi vùng quá 30m (người chơi chạy thoát được) */
function updateZombie(d: Drone, dist: number, alive: boolean, step: number) {
  const st = ZOMBIE_STATS[d.look ?? "zmb_walker"];
  if (d.state === "patrol") {
    if (alive && dist < 22 && inQuarantine(_target.x, _target.z, 30)) {
      d.state = "chase";
      d.firedAt = clock - 10;
      d.nextShot = clock + 0.6;
    }
    if (clock > d.nextWander) {
      d.wander.set(d.home.x + (Math.random() - 0.5) * 14, TROOPER_CENTER, d.home.z + (Math.random() - 0.5) * 14);
      d.nextWander = clock + 5 + Math.random() * 6;
    }
    _desired.subVectors(d.wander, d.pos).setY(0);
    const len = _desired.length();
    _desired.multiplyScalar(len > 0.8 ? st.walk / len : 0);
  } else {
    if (!alive || dist > 40 || !inQuarantine(d.pos.x, d.pos.z, 30)) {
      d.state = "patrol";
      d.wander.copy(d.home);
      return;
    }
    _desired.subVectors(_target, d.pos).setY(0);
    const len = _desired.length();
    const reach = ZOMBIE_REACH * d.size;
    _desired.multiplyScalar(len > reach * 0.8 ? st.chase / len : 0);
    // Đứng sát thì vồ: ra đòn sau 0.45s vung tay
    if (len < reach && clock > d.nextShot) {
      d.firedAt = clock;
      d.strikeAt = clock + 0.45;
      d.nextShot = clock + 1.4 + Math.random() * 0.5;
    }
    if (d.strikeAt !== undefined && d.strikeAt >= 0 && clock >= d.strikeAt) {
      d.strikeAt = -1;
      // Người chơi lùi ra kịp trước khi đòn chạm tới thì né được
      if (len <= reach + 0.6) {
        useGame.getState().damagePlayer(st.dmg);
        playSfx("enemyAttack", 0.7);
      }
    }
  }
  d.vel.lerp(_desired, 1 - Math.exp(-4 * step));
  d.pos.addScaledVector(d.vel, step);
  d.pos.y = TROOPER_CENTER;
}

function shoot(d: Drone, dist: number, targetSpeed: number, inCar: boolean, wanted: number) {
  const hitChance = THREE.MathUtils.clamp(0.8 - dist / 70 - (targetSpeed > 6 ? 0.25 : 0), 0.15, 0.85);
  const hit = Math.random() < hitChance;
  d.firedAt = clock;
  if (hit) {
    // Súng của Legion là súng EMP: trúng Mech thì có thể trừ thời gian biến hình
    const boss = d.kind === "boss";
    fx.tracer(d.pos, _target, boss ? "#ff7a1f" : "#ff1f3d");
    useGame.getState().damagePlayer(((inCar ? 3 : 6) + wanted) * (boss ? 3 : 1), { emp: boss || Math.random() < 0.25 });
  } else {
    _miss.set(_target.x + (Math.random() - 0.5) * 4, Math.max(0.1, _target.y + (Math.random() - 0.6) * 2), _target.z + (Math.random() - 0.5) * 4);
    fx.tracer(d.pos, _miss, "#ff1f3d");
  }
  playSfx("enemyAttack", Math.max(0, 1 - dist / 45) * 0.8);
  alarm(d.pos.x, d.pos.z);
}

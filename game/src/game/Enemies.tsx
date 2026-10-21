import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extraModel, models, playSfx } from "./assets";
import { fitCharacter } from "./Player";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CITY, CITY_HALF, CITY_PITCH, PALETTE, PLAYER, mulberry32 } from "./config";
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
export type DroneKind = "legion" | "trooper" | "courier" | "boss";

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
};

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
function TrooperModel({ index }: { index: number }) {
  const heavy = drones[index].size > 1;
  const walkGltf = use(extraModel(heavy ? "mx_legion_heavy_walk" : "mx_legion_trooper_walk"));
  const runGltf = use(extraModel(heavy ? "mx_legion_heavy_run" : "mx_legion_trooper_run"));
  const ref = useRef<THREE.Group>(null);
  const { scene, mixer, walk, run, mats } = useMemo(() => {
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
    const walk = walkGltf.animations[0] ? mixer.clipAction(walkGltf.animations[0]) : null;
    const run = runGltf.animations[0] ? mixer.clipAction(runGltf.animations[0]) : null;
    walk?.play();
    run?.play();
    if (run) run.weight = 0;
    return { scene: s, mixer, walk, run, mats };
  }, [walkGltf, runGltf, heavy]);
  useFrame(({ camera }, dt) => {
    const d = drones[index];
    const g = ref.current;
    if (!g) return;
    g.visible = d.state !== "dead" && d.pos.distanceTo(camera.position) < 90;
    if (!g.visible) return;
    g.position.copy(d.pos);
    const speed = Math.hypot(d.vel.x, d.vel.z);
    const look = d.state === "chase" ? _aim.subVectors(_target, d.pos) : d.vel;
    if (look.lengthSq() > 0.01) {
      const yaw = Math.atan2(look.x, look.z);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, g.rotation.y + shortest(g.rotation.y, yaw), 0.15);
    }
    // Pha trộn đi/chạy theo tốc độ
    const k = THREE.MathUtils.clamp((speed - 2) / 3, 0, 1);
    if (walk) {
      walk.weight = 1 - k;
      walk.timeScale = THREE.MathUtils.clamp(speed / 1.6, 0.15, 1.6);
    }
    if (run) {
      run.weight = k;
      run.timeScale = THREE.MathUtils.clamp(speed / 5, 0.5, 1.4);
    }
    const hurt = clock - d.hurtAt < 0.12;
    for (const { mat, base } of mats) {
      if (hurt) mat.emissive.setRGB(1, 0.15, 0.15);
      else mat.emissive.copy(base);
    }
    if (camera.position.distanceTo(d.pos) < 55) mixer.update(Math.min(dt, 0.1));
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
    const alive = game.flatlinedAt === null && !!player && game.location === "city";
    if (car) _target.copy(car.currPos).setY(car.currPos.y + 0.6);
    else if (player) _target.copy(player.currPos).setY(player.currPos.y + 0.5);
    const targetSpeed = car ? car.currLinVel.length() : (player?.currLinVel.length() ?? 0);
    const aggro = 28 + game.wanted * 12;

    for (const d of drones) {
      if (d.state === "dead") {
        if (d.kind !== "legion" && d.kind !== "trooper") continue;
        if (clock - d.deadAt > respawnDelay(game.wanted)) {
          d.state = game.wanted >= 2 ? "chase" : "patrol";
          d.hp = d.maxHp;
          // Drone bay xuống từ trên cao, lính hiện lại ở điểm gốc
          d.pos.set(d.home.x, d.kind === "trooper" ? TROOPER_CENTER : 30, d.home.z);
          d.vel.set(0, 0, 0);
        }
        continue;
      }

      const dist = d.pos.distanceTo(_target);
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
    }
  });

  return (
    <>
      {drones.map((d) =>
        d.kind === "boss" ? (
          <Suspense key={d.id} fallback={<KenneyDrone index={d.id} />}>
            <BossModel index={d.id} />
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

function shoot(d: Drone, dist: number, targetSpeed: number, inCar: boolean, wanted: number) {
  const hitChance = THREE.MathUtils.clamp(0.8 - dist / 70 - (targetSpeed > 6 ? 0.25 : 0), 0.15, 0.85);
  const hit = Math.random() < hitChance;
  if (hit) {
    // Súng của Legion là súng EMP: trúng Mech thì có thể trừ thời gian biến hình
    const boss = d.kind === "boss";
    d.firedAt = clock;
    fx.tracer(d.pos, _target, boss ? "#ff7a1f" : "#ff1f3d");
    useGame.getState().damagePlayer(((inCar ? 3 : 6) + wanted) * (boss ? 3 : 1), { emp: boss || Math.random() < 0.25 });
  } else {
    _miss.set(_target.x + (Math.random() - 0.5) * 4, Math.max(0.1, _target.y + (Math.random() - 0.6) * 2), _target.z + (Math.random() - 0.5) * 4);
    fx.tracer(d.pos, _miss, "#ff1f3d");
  }
  playSfx("enemyAttack", Math.max(0, 1 - dist / 45) * 0.8);
}

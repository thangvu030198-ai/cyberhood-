import { use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { models, playSfx } from "./assets";
import { CITY, CITY_HALF, CITY_PITCH, PALETTE, PLAYER, mulberry32 } from "./config";
import { fx } from "./Effects";
import { handles } from "./refs";
import { useGame } from "./store";
import { mergeByMaterial } from "./Vehicles";
import { questProgress } from "./quests";
import { lineOfSight, pushOutOfBuildings, raySphere } from "./world";

// Drone an ninh của OMNI-DYNE: tuần tra quanh điểm gốc, phát hiện thì bay vòng quanh người chơi và bắn laser.

type DroneState = "patrol" | "chase" | "dead";

export type Drone = {
  id: number;
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
  orbit: number;
};

const DRONE_COUNT = 14;
const DRONE_HP = 100;
const HIT_RADIUS = 0.95;
const HOVER = 4.5;
const ATTACK_HEIGHT = 3.2;
const PATROL_SPEED = 4;
const CHASE_SPEED = 10;
const STANDOFF = 10;
const FIRE_RANGE = 28;

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
      orbit: rand() * Math.PI * 2,
    });
  }
  return list;
})();

let clock = 0;

/** Tia bắn của người chơi chạm drone nào gần nhất */
export function hitDrones(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) {
  let best: Drone | null = null;
  let bestT = maxDist;
  for (const d of drones) {
    if (d.state === "dead") continue;
    const t = raySphere(origin, dir, d.pos, HIT_RADIUS);
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
  d.hp -= amount;
  d.hurtAt = clock;
  const game = useGame.getState();
  // Bị bắn thì drone này và đồng đội quanh đó lao vào truy đuổi
  for (const other of drones) {
    if (other.state !== "dead" && other.pos.distanceTo(d.pos) < 35) other.state = "chase";
  }
  if (d.hp > 0) {
    playSfx("enemyHurt", 0.7);
    return;
  }
  d.state = "dead";
  d.deadAt = clock;
  questProgress("kill");
  fx.blast(d.pos);
  fx.chip(d.pos, 15 + Math.floor(Math.random() * 20) + game.wanted * 5);
  playSfx("enemyDestroy", 0.9);
  game.registerKill();
}

function respawnDelay(wanted: number) {
  return wanted >= 3 ? 8 : 22;
}

const _target = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _miss = new THREE.Vector3();

function DroneModel({ index }: { index: number }) {
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
        // Tông thép tối của OMNI-DYNE, đèn đỏ khi trúng đạn
        material.color.multiplyScalar(0.55);
        material.emissive.set(PALETTE.pink);
        material.emissiveIntensity = 0.08;
      }
      mesh.material = material;
    });
    const s = mergeByMaterial(src);
    return { scene: s, materials: material ? [material as THREE.MeshStandardMaterial] : [] };
  }, [gltf]);
  const eye = useMemo(() => new THREE.Color("#ff1f3d").multiplyScalar(6), []);
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    const d = drones[index];
    const g = ref.current;
    if (!g) return;
    g.visible = d.state !== "dead";
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
      <primitive object={scene} scale={1.4} />
      <mesh position={[0, 0.35, 0.45]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshBasicMaterial color={eye} toneMapped={false} />
      </mesh>
    </group>
  );
}

function shortest(from: number, to: number) {
  return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export function Enemies() {
  useFrame((_, dt) => {
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
        if (clock - d.deadAt > respawnDelay(game.wanted)) {
          d.state = game.wanted >= 2 ? "chase" : "patrol";
          d.hp = DRONE_HP;
          d.pos.set(d.home.x, 30, d.home.z); // bay xuống từ trên cao
          d.vel.set(0, 0, 0);
        }
        continue;
      }

      const dist = d.pos.distanceTo(_target);
      const sees = alive && dist < aggro * 1.6 && lineOfSight(d.pos, _target);

      if (d.state === "patrol") {
        if (alive && dist < aggro && (sees || game.wanted >= 2)) d.state = "chase";
        if (clock > d.nextWander) {
          d.wander.set(d.home.x + (Math.random() - 0.5) * 24, HOVER + Math.random() * 2, d.home.z + (Math.random() - 0.5) * 24);
          d.nextWander = clock + 4 + Math.random() * 4;
        }
        _desired.subVectors(d.wander, d.pos);
        const len = _desired.length();
        _desired.multiplyScalar(len > 1 ? PATROL_SPEED / len : 0);
      } else {
        if (!alive || (dist > aggro * 1.8 && game.wanted === 0)) {
          d.state = "patrol";
          continue;
        }
        // Bay vòng quanh mục tiêu ở khoảng cách STANDOFF
        d.orbit += step * 0.5;
        _desired.set(
          _target.x + Math.cos(d.orbit) * STANDOFF,
          // Sà thấp khi tấn công để người chơi ngắm được
          ATTACK_HEIGHT + Math.sin(d.orbit * 1.7) * 0.8,
          _target.z + Math.sin(d.orbit) * STANDOFF,
        );
        _desired.sub(d.pos);
        const len = _desired.length();
        _desired.multiplyScalar(len > 0.5 ? Math.min(CHASE_SPEED, len * 2) / len : 0);

        if (sees && dist < FIRE_RANGE && clock > d.nextShot) {
          d.nextShot = clock + Math.max(0.6, 1.5 - game.wanted * 0.15) + Math.random() * 0.6;
          shoot(d, dist, targetSpeed, !!car, game.wanted);
        }
      }

      d.vel.lerp(_desired, 1 - Math.exp(-2.5 * step));
      d.pos.addScaledVector(d.vel, step);
      d.pos.y = THREE.MathUtils.clamp(d.pos.y - (d.pos.y > 14 ? 8 * step : 0), 2.5, 32);
      pushOutOfBuildings(d.pos);
    }
  });

  return (
    <>
      {drones.map((d) => (
        <DroneModel key={d.id} index={d.id} />
      ))}
    </>
  );
}

function shoot(d: Drone, dist: number, targetSpeed: number, inCar: boolean, wanted: number) {
  const hitChance = THREE.MathUtils.clamp(0.8 - dist / 70 - (targetSpeed > 6 ? 0.25 : 0), 0.15, 0.85);
  const hit = Math.random() < hitChance;
  if (hit) {
    fx.tracer(d.pos, _target, "#ff1f3d");
    useGame.getState().damagePlayer((inCar ? 3 : 6) + wanted);
  } else {
    _miss.set(_target.x + (Math.random() - 0.5) * 4, Math.max(0.1, _target.y + (Math.random() - 0.6) * 2), _target.z + (Math.random() - 0.5) * 4);
    fx.tracer(d.pos, _miss, "#ff1f3d");
  }
  playSfx("enemyAttack", Math.max(0, 1 - dist / 45) * 0.8);
}

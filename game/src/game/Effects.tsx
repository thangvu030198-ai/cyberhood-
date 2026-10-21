import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PALETTE } from "./config";
import { handles } from "./refs";
import { useGame } from "./store";

// Hiệu ứng dùng pool cố định: tạo một lần, bật/tắt bằng visible. API ở mức module
// để vũ khí và kẻ địch gọi trực tiếp mà không cần React state.

const TRACER_POOL = 40;
const BLAST_POOL = 12;
const SPARK_POOL = 40;
const CHIP_POOL = 40;

const TRACER_LIFE = 0.11;
const SPARK_LIFE = 0.12;
const MUZZLE_LIGHT_LIFE = 0.07;
const BLAST_LIFE = 0.55;
const CHIP_LIFE = 60;
const CHIP_REACH_FOOT = 1.7;
const CHIP_REACH_CAR = 3.2;

type Tracer = { from: THREE.Vector3; to: THREE.Vector3; color: THREE.Color; born: number; alive: boolean };
type Blast = { pos: THREE.Vector3; born: number; alive: boolean };
/** Chớp sáng nhỏ: lửa đầu nòng và tia lửa chỗ đạn trúng */
type Spark = { pos: THREE.Vector3; color: THREE.Color; size: number; born: number; alive: boolean };
type Chip = { pos: THREE.Vector3; value: number; born: number; alive: boolean };

const tracers: Tracer[] = Array.from({ length: TRACER_POOL }, () => ({
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
  color: new THREE.Color(),
  born: 0,
  alive: false,
}));
const sparks: Spark[] = Array.from({ length: SPARK_POOL }, () => ({
  pos: new THREE.Vector3(),
  color: new THREE.Color(),
  size: 1,
  born: 0,
  alive: false,
}));
const muzzleLight = { pos: new THREE.Vector3(), color: new THREE.Color(), born: -Infinity };
const blasts: Blast[] = Array.from({ length: BLAST_POOL }, () => ({ pos: new THREE.Vector3(), born: 0, alive: false }));
const chips: Chip[] = Array.from({ length: CHIP_POOL }, () => ({
  pos: new THREE.Vector3(),
  value: 0,
  born: 0,
  alive: false,
}));

let clock = 0;

function take<T extends { alive: boolean; born: number }>(pool: T[]) {
  let oldest = pool[0];
  for (const item of pool) {
    if (!item.alive) return item;
    if (item.born < oldest.born) oldest = item;
  }
  return oldest;
}

export const fx = {
  tracer(from: THREE.Vector3, to: THREE.Vector3, color: string) {
    const t = take(tracers);
    t.from.copy(from);
    t.to.copy(to);
    t.color.set(color).multiplyScalar(5);
    t.born = clock;
    t.alive = true;
    spark(from, t.color, 0.22);
    spark(to, t.color, 0.38);
  },
  /** Lửa đầu nòng của người chơi: chớp sáng to hơn và hắt đèn ra xung quanh */
  muzzle(pos: THREE.Vector3, color: string) {
    const c = new THREE.Color(color).multiplyScalar(6);
    spark(pos, c, 0.45);
    muzzleLight.pos.copy(pos);
    muzzleLight.color.set(color);
    muzzleLight.born = clock;
  },
  blast(pos: THREE.Vector3) {
    const b = take(blasts);
    b.pos.copy(pos);
    b.born = clock;
    b.alive = true;
  },
  chip(pos: THREE.Vector3, value: number) {
    const c = take(chips);
    c.pos.set(pos.x, 0.8, pos.z);
    c.value = value;
    c.born = clock;
    c.alive = true;
  },
  /** Vị trí các chip còn trên đất, cho minimap */
  chips: () => chips.filter((c) => c.alive).map((c) => c.pos),
};

function spark(pos: THREE.Vector3, color: THREE.Color, size: number) {
  const s = take(sparks);
  s.pos.copy(pos);
  s.color.copy(color);
  s.size = size;
  s.born = clock;
  s.alive = true;
}

const Z = new THREE.Vector3(0, 0, 1);

export function Effects() {
  const tracerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const glowRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sparkRefs = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const blastRefs = useRef<(THREE.Mesh | null)[]>([]);
  const chipRefs = useRef<(THREE.Mesh | null)[]>([]);
  const tmp = useMemo(() => ({ dir: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const chipColor = useMemo(() => new THREE.Color(PALETTE.amber).multiplyScalar(3), []);
  const blastColor = useMemo(() => new THREE.Color(PALETTE.pink).multiplyScalar(4), []);

  useFrame((_, dt) => {
    clock += dt;

    tracers.forEach((t, i) => {
      const mesh = tracerRefs.current[i];
      const glow = glowRefs.current[i];
      if (!mesh || !glow) return;
      const age = clock - t.born;
      if (!t.alive || age > TRACER_LIFE) {
        t.alive = false;
        mesh.visible = glow.visible = false;
        return;
      }
      tmp.dir.subVectors(t.to, t.from);
      const len = tmp.dir.length();
      mesh.visible = glow.visible = true;
      mesh.position.addVectors(t.from, t.to).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(Z, tmp.dir.divideScalar(len || 1));
      const fade = 1 - age / TRACER_LIFE;
      mesh.scale.set(fade, fade, len);
      glow.position.copy(mesh.position);
      glow.quaternion.copy(mesh.quaternion);
      glow.scale.set(fade, fade, len);
      (mesh.material as THREE.MeshBasicMaterial).color.copy(t.color);
      const gm = glow.material as THREE.MeshBasicMaterial;
      gm.color.copy(t.color).multiplyScalar(0.25);
      gm.opacity = 0.6 * fade;
    });

    sparks.forEach((sp, i) => {
      const mesh = sparkRefs.current[i];
      if (!mesh) return;
      const age = clock - sp.born;
      if (!sp.alive || age > SPARK_LIFE) {
        sp.alive = false;
        mesh.visible = false;
        return;
      }
      const k = age / SPARK_LIFE;
      mesh.visible = true;
      mesh.position.copy(sp.pos);
      mesh.scale.setScalar(sp.size * (0.6 + k * 0.8));
      mesh.rotation.set(clock * 40 + i, i, clock * 30);
      const m = mesh.material as THREE.MeshBasicMaterial;
      m.color.copy(sp.color);
      m.opacity = 1 - k;
    });

    if (light.current) {
      const k = (clock - muzzleLight.born) / MUZZLE_LIGHT_LIFE;
      light.current.visible = k < 1;
      if (k < 1) {
        light.current.position.copy(muzzleLight.pos);
        light.current.color.copy(muzzleLight.color);
        light.current.intensity = 30 * (1 - k);
      }
    }

    blasts.forEach((b, i) => {
      const mesh = blastRefs.current[i];
      if (!mesh) return;
      const age = clock - b.born;
      if (!b.alive || age > BLAST_LIFE) {
        b.alive = false;
        mesh.visible = false;
        return;
      }
      const k = age / BLAST_LIFE;
      mesh.visible = true;
      mesh.position.copy(b.pos);
      mesh.scale.setScalar(0.4 + k * 3.2);
      (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    });

    // Chip $CRED: xoay, nhấp nhô, tự hút khi người chơi đến gần
    const s = useGame.getState();
    const car = s.mode === "drive" && s.carId !== null ? handles.cars.get(s.carId) : null;
    const playerPos = car ? car.currPos : handles.player?.currPos;
    const reach = car ? CHIP_REACH_CAR : CHIP_REACH_FOOT;
    chips.forEach((c, i) => {
      const mesh = chipRefs.current[i];
      if (!mesh) return;
      if (c.alive && clock - c.born > CHIP_LIFE) c.alive = false;
      if (c.alive && playerPos && s.flatlinedAt === null) {
        const dx = c.pos.x - playerPos.x;
        const dz = c.pos.z - playerPos.z;
        if (dx * dx + dz * dz < reach * reach) {
          c.alive = false;
          s.addCred(c.value);
        }
      }
      mesh.visible = c.alive;
      if (!c.alive) return;
      mesh.position.set(c.pos.x, c.pos.y + Math.sin(clock * 3 + i) * 0.15, c.pos.z);
      mesh.rotation.set(0, clock * 2.5 + i, 0);
    });
  });

  return (
    <>
      {tracers.map((_, i) => (
        <mesh key={`t${i}`} ref={(m) => void (tracerRefs.current[i] = m)} visible={false} frustumCulled={false}>
          <boxGeometry args={[0.05, 0.05, 1]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
      ))}
      {/* Quầng sáng mờ bao quanh lõi tia laser */}
      {tracers.map((_, i) => (
        <mesh key={`g${i}`} ref={(m) => void (glowRefs.current[i] = m)} visible={false} frustumCulled={false}>
          <boxGeometry args={[0.2, 0.2, 1]} />
          <meshBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {sparks.map((_, i) => (
        <mesh key={`s${i}`} ref={(m) => void (sparkRefs.current[i] = m)} visible={false} frustumCulled={false}>
          <octahedronGeometry args={[0.5, 0]} />
          <meshBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <pointLight ref={light} visible={false} distance={8} decay={2} />
      {blasts.map((_, i) => (
        <mesh key={`b${i}`} ref={(m) => void (blastRefs.current[i] = m)} visible={false}>
          <icosahedronGeometry args={[0.5, 1]} />
          <meshBasicMaterial color={blastColor} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {chips.map((_, i) => (
        <mesh key={`c${i}`} ref={(m) => void (chipRefs.current[i] = m)} visible={false}>
          <octahedronGeometry args={[0.28, 0]} />
          <meshBasicMaterial color={chipColor} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

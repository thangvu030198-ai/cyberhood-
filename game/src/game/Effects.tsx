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
const CHIP_POOL = 40;

const TRACER_LIFE = 0.11;
const BLAST_LIFE = 0.55;
const CHIP_LIFE = 60;
const CHIP_REACH_FOOT = 1.7;
const CHIP_REACH_CAR = 3.2;

type Tracer = { from: THREE.Vector3; to: THREE.Vector3; color: THREE.Color; born: number; alive: boolean };
type Blast = { pos: THREE.Vector3; born: number; alive: boolean };
type Chip = { pos: THREE.Vector3; value: number; born: number; alive: boolean };

const tracers: Tracer[] = Array.from({ length: TRACER_POOL }, () => ({
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
  color: new THREE.Color(),
  born: 0,
  alive: false,
}));
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

const Z = new THREE.Vector3(0, 0, 1);

export function Effects() {
  const tracerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const blastRefs = useRef<(THREE.Mesh | null)[]>([]);
  const chipRefs = useRef<(THREE.Mesh | null)[]>([]);
  const tmp = useMemo(() => ({ dir: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const chipColor = useMemo(() => new THREE.Color(PALETTE.amber).multiplyScalar(3), []);
  const blastColor = useMemo(() => new THREE.Color(PALETTE.pink).multiplyScalar(4), []);

  useFrame((_, dt) => {
    clock += dt;

    tracers.forEach((t, i) => {
      const mesh = tracerRefs.current[i];
      if (!mesh) return;
      const age = clock - t.born;
      if (!t.alive || age > TRACER_LIFE) {
        t.alive = false;
        mesh.visible = false;
        return;
      }
      tmp.dir.subVectors(t.to, t.from);
      const len = tmp.dir.length();
      mesh.visible = true;
      mesh.position.addVectors(t.from, t.to).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(Z, tmp.dir.divideScalar(len || 1));
      const fade = 1 - age / TRACER_LIFE;
      mesh.scale.set(fade, fade, len);
      (mesh.material as THREE.MeshBasicMaterial).color.copy(t.color);
    });

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

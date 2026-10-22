// Hiệu ứng đua xe (học từ Mario Kart 8 / CTR Nitro-Fueled): vệt gió tốc độ quanh màn hình, lửa nitro ở ống xả,
// tia lửa bánh xe khi drift (xanh → cam theo lực tích), vệt lốp trên mặt đường, rung camera khi turbo / va vách.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { KART, type KartSim } from "./kart";

/** Rung camera dùng chung: turbo / va vách / trúng tên lửa đẩy lên, tự tắt dần */
export const kartShake = { amount: 0 };

const LINES = 64;

/** Vệt gió: các sợi sáng mảnh bay vụt qua rìa màn hình, càng nhanh càng dày, turbo thì ngả xanh lam */
export function SpeedLines({ sim }: { sim: KartSim }) {
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: LINES }, (_, i) => {
        const a = (i / LINES) * Math.PI * 2 + Math.sin(i * 12.9) * 0.2;
        return { a, r: 1.15 + ((i * 37) % 10) / 14, z: ((i * 53) % 100) / 100, len: 0.6 + ((i * 29) % 10) / 10 };
      }),
    [],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const o = mesh.current;
    if (!o) return;
    // Bám theo camera: dựng trong toạ độ camera
    o.position.copy(camera.position);
    o.quaternion.copy(camera.quaternion);
    const k = sim.player;
    const boosting = sim.time < k.boostUntil;
    const speed = Math.max(0, k.v) / KART.maxSpeed;
    const amt = THREE.MathUtils.clamp((speed - 0.55) / 0.45, 0, 1) * 0.55 + (boosting ? 0.45 : 0);
    const mat = o.material as THREE.MeshBasicMaterial;
    mat.opacity = amt * 0.55;
    mat.color.setRGB(boosting ? 0.6 : 1, boosting ? 1.6 : 1, boosting ? 2.4 : 1);
    o.visible = amt > 0.02;
    let n = 0;
    for (const p of seeds) {
      p.z += dt * (1.2 + speed * 2.8 + (boosting ? 2 : 0));
      if (p.z > 1) p.z -= 1;
      // Từ xa (z = -9) bay về sát camera (z = -1), toả ra rìa màn hình
      const depth = -9 + p.z * 8;
      const spread = p.r * (1 + p.z * 1.6);
      v.set(Math.cos(p.a) * spread * 1.6, Math.sin(p.a) * spread, depth);
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize());
      s.set(0.012, 0.012, p.len * (0.6 + speed));
      m.compose(v, q, s);
      o.setMatrixAt(n++, m);
    }
    o.count = n;
    o.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, LINES]} frustumCulled={false} renderOrder={10}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

/** Đặt một nhóm theo xe: vị trí trên đường + hướng (cộng góc drift) */
function placeOnCar(o: THREE.Object3D, sim: KartSim, id: number) {
  const k = sim.karts[id];
  const w = sim.track.at(k.s, k.d);
  o.position.set(w.x, 0.05, w.z);
  o.rotation.y = w.yaw + driftYaw(sim, id);
}

/** Góc thân xe khi drift (đuôi văng ra ngoài cua) */
export function driftYaw(sim: KartSim, id: number) {
  const k = sim.karts[id];
  return k.drift * 0.38;
}

/** Lửa nitro hai ống xả: ngọn lửa xanh lam lõi trắng khi turbo, đốm cam nhỏ lúc ga thường */
export function NitroFlames({ sim, id }: { sim: KartSim; id: number }) {
  const group = useRef<THREE.Group>(null);
  const flames = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    placeOnCar(g, sim, id);
    const k = sim.karts[id];
    const boosting = sim.time < k.boostUntil;
    const t = clock.elapsedTime;
    for (let i = 0; i < flames.current.length; i++) {
      const f = flames.current[i];
      const core = i >= 2;
      const flick = 0.75 + Math.sin(t * 60 + i * 2.1) * 0.15 + Math.sin(t * 37 + i) * 0.1;
      const len = boosting ? (core ? 1.1 : 1.8) * flick : k.v > 2 ? 0.35 * flick : 0;
      f.visible = len > 0.01;
      f.scale.set(core ? 0.55 : 1, len, core ? 0.55 : 1);
      const mat = f.material as THREE.MeshBasicMaterial;
      if (core) mat.color.setRGB(2.4, 2.4, 2.6);
      else if (boosting) mat.color.setRGB(0.4, 1.4, 3.2);
      else mat.color.setRGB(2.4, 0.9, 0.25);
    }
  });
  return (
    <group ref={group}>
      {[-0.45, 0.45, -0.45, 0.45].map((x, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) flames.current[i] = m;
          }}
          position={[x, 0.5, -1.75]}
          rotation-x={-Math.PI / 2}
        >
          {/* Hình nón dựng từ gốc (miệng ống xả) toả về sau */}
          <coneGeometry args={[0.2, 1, 10, 1, true]} />
          <meshBasicMaterial transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

const SPARKS = 90;
const SKIDS = 360;

/** Tia lửa ở hai bánh sau khi drift + vệt lốp đen trên mặt đường (chỉ xe người chơi để nhẹ máy) */
export function DriftFx({ sim }: { sim: KartSim }) {
  const sparks = useRef<THREE.InstancedMesh>(null);
  const skids = useRef<THREE.InstancedMesh>(null);
  const pool = useMemo(() => Array.from({ length: SPARKS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, lv: 1 })), []);
  const marks = useMemo(() => ({ next: 0, last: -9, lastPos: [null, null] as (THREE.Vector3 | null)[] }), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const c = useMemo(() => new THREE.Color(), []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const sp = sparks.current;
    const sk = skids.current;
    if (!sp || !sk) return;
    dt = Math.min(dt, 0.05);
    const k = sim.player;
    placeOnCar(tmp, sim, k.id);
    tmp.updateMatrixWorld(true);
    const wheels = [new THREE.Vector3(-0.8, 0.15, -1.2), new THREE.Vector3(0.8, 0.15, -1.2)].map((p) => p.applyMatrix4(tmp.matrixWorld));
    const lv = k.driftCharge >= KART.drift.lv2 ? 2 : k.driftCharge >= KART.drift.lv1 ? 1 : 0;
    if (k.drift !== 0) {
      // Bắn tia lửa: càng tích nhiều càng dày
      const rate = lv === 2 ? 5 : lv === 1 ? 3 : 1;
      for (let n = 0; n < rate; n++) {
        const p = pool.find((p) => p.life <= 0);
        if (!p) break;
        const w = wheels[Math.random() < 0.5 ? 0 : 1];
        p.x = w.x;
        p.y = w.y;
        p.z = w.z;
        const a = Math.random() * Math.PI * 2;
        p.vx = Math.cos(a) * 2.5 - Math.sin(tmp.rotation.y) * 3;
        p.vz = Math.sin(a) * 2.5 - Math.cos(tmp.rotation.y) * 3;
        p.vy = 2 + Math.random() * 3;
        p.life = 0.25 + Math.random() * 0.2;
        p.lv = lv;
      }
      // Vệt lốp: mỗi bánh nối một đoạn từ vị trí trước tới vị trí hiện tại
      if (sim.time - marks.last > 0.03) {
        marks.last = sim.time;
        wheels.forEach((w, i) => {
          const prev = marks.lastPos[i];
          if (prev && prev.distanceTo(w) < 4) {
            const mid = prev.clone().add(w).multiplyScalar(0.5);
            const len = prev.distanceTo(w);
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(w.x - prev.x, w.z - prev.z));
            m.compose(v.set(mid.x, 0.075, mid.z), q, s.set(0.28, 1, len + 0.05));
            sk.setMatrixAt(marks.next, m);
            marks.next = (marks.next + 1) % SKIDS;
          }
          marks.lastPos[i] = w.clone();
        });
        sk.count = SKIDS;
        sk.instanceMatrix.needsUpdate = true;
      }
    } else marks.lastPos = [null, null];
    let n = 0;
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      m.compose(v.set(p.x, p.y, p.z), q.identity(), s.setScalar(0.06 + p.life * 0.15));
      sp.setMatrixAt(n, m);
      sp.setColorAt(n, p.lv === 2 ? c.setRGB(3, 1.3, 0.3) : p.lv === 1 ? c.setRGB(0.5, 1.6, 3.2) : c.setRGB(2.2, 2.2, 2));
      n++;
    }
    sp.count = n;
    sp.instanceMatrix.needsUpdate = true;
    if (sp.instanceColor) sp.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={sparks} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={skids} args={[undefined, undefined, SKIDS]} frustumCulled={false} count={0}>
        <boxGeometry args={[1, 0.01, 1]} />
        <meshBasicMaterial color="#050308" transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
    </>
  );
}

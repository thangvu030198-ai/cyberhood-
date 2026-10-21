import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { splitWheels, wheelGeometries, type WheelSpot } from "./carWheels";
import { useSetParts } from "./setParts";
import { CAR_YAW, DRIVE_MODELS, ensureTraffic, traffic } from "./trafficWorld";
import { TUNING } from "../traffic/tuning";
import { glowTexture } from "./Vehicles";

// Xe tự lái: vị trí lấy từ VehicleSim, mỗi loại model là một nhóm instancing cho thân xe.
// Bánh liền khối của model được khoét bỏ (carWheels.ts) và thay bằng bánh dựng sẵn tròn đều, dùng chung
// cho mọi xe: quay theo quãng đường, bánh trước đánh lái theo độ cong khi rẽ.

const _car = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _out = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _qr = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _x = new THREE.Vector3(1, 0, 0);
const BRAKE_ON = new THREE.Color(4, 0.15, 0.12);
const BRAKE_OFF = new THREE.Color(0.55, 0.02, 0.02);
const HEAD = new THREE.Color(1.4, 1.35, 1.2);
const NEON = ["#05d9e8", "#ff2a6d", "#ffb000", "#b05cff", "#39ff88"].map((c) => new THREE.Color(c).multiplyScalar(2.5));

/** Vị trí bánh của từng model, điền khi model tải xong */
const wheelSpots = new Map<number, WheelSpot[]>();

/** Ma trận thân xe theo trạng thái mô phỏng (đặt sát đất) */
function carMatrix(x: number, z: number, yaw: number, out: THREE.Matrix4) {
  return out.compose(_p.set(x, 0, z), _q.setFromAxisAngle(_up, yaw), _one);
}

function TrafficModel({ model }: { model: number }) {
  const spec = DRIVE_MODELS[model];
  const { parts } = useSetParts(spec.name, "", spec.length, "longest", spec.yaw ?? CAR_YAW);
  const set = useMemo(() => {
    const w = splitWheels(parts);
    traffic.wheelInfo[spec.name] = w.wheels.length;
    wheelSpots.set(model, w.wheels);
    return w;
  }, [parts, spec.name, model]);
  const mine = useMemo(() => traffic.vehicles?.vehicles.filter((v) => v.model === model) ?? [], [model]);
  const bodyRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const lights = useRef<THREE.InstancedMesh>(null);
  const lightGeo = useMemo(() => new THREE.PlaneGeometry(0.5, 0.32), []);
  const lightMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  // Vị trí đèn trong toạ độ xe: 2 đèn phanh phía sau, 2 đèn pha phía trước
  const lamps = useMemo(() => {
    const s = set.size;
    const y = s.y * 0.42;
    const x = s.x * 0.33;
    return [
      { x, y, z: -s.z / 2 - 0.04, back: true },
      { x: -x, y, z: -s.z / 2 - 0.04, back: true },
      { x, y: y * 0.9, z: s.z / 2 + 0.04, back: false },
      { x: -x, y: y * 0.9, z: s.z / 2 + 0.04, back: false },
    ];
  }, [set]);

  useFrame(() => {
    const L = lights.current;
    for (let i = 0; i < mine.length; i++) {
      const v = mine[i];
      carMatrix(v.x, v.z, v.yaw, _car);
      for (const mesh of bodyRefs.current) mesh?.setMatrixAt(i, _car);
      if (L) {
        lamps.forEach((l, li) => {
          _local.makeTranslation(l.x, l.y, l.z);
          L.setMatrixAt(i * 4 + li, _out.multiplyMatrices(_car, _local));
          L.setColorAt(i * 4 + li, l.back ? (v.braking ? BRAKE_ON : BRAKE_OFF) : HEAD);
        });
      }
    }
    for (const m of bodyRefs.current) if (m) m.instanceMatrix.needsUpdate = true;
    if (L) {
      L.instanceMatrix.needsUpdate = true;
      if (L.instanceColor) L.instanceColor.needsUpdate = true;
    }
  });

  if (mine.length === 0) return null;
  return (
    <>
      {set.body.map((p, i) => (
        <instancedMesh key={`b${i}`} ref={(r) => void (bodyRefs.current[i] = r)} args={[p.geometry, p.material, mine.length]} frustumCulled={false} />
      ))}
      <instancedMesh ref={lights} args={[lightGeo, lightMat, mine.length * 4]} frustumCulled={false} />
    </>
  );
}

/** Bánh xe dựng sẵn của mọi xe giao thông: 3 lớp instancing (lốp, mâm, vành neon) */
function TrafficWheels() {
  const vehicles = ensureTraffic().vehicles!.vehicles;
  const count = vehicles.length * 4;
  const geo = useMemo(() => wheelGeometries(), []);
  const tire = useRef<THREE.InstancedMesh>(null);
  const hub = useRef<THREE.InstancedMesh>(null);
  const neon = useRef<THREE.InstancedMesh>(null);
  // Góc đánh lái làm mượt theo từng xe
  const steer = useMemo(() => vehicles.map(() => ({ yaw: 0, angle: 0, init: false })), [vehicles]);
  const W = TUNING.vehicles;

  useFrame((_, dt) => {
    const T = tire.current;
    const H = hub.current;
    const N = neon.current;
    if (!T || !H || !N) return;
    const step = Math.min(dt, 0.1);
    let n = 0;
    vehicles.forEach((v, vi) => {
      const spots = wheelSpots.get(v.model);
      const st = steer[vi];
      // Góc lái suy từ tốc độ quay đầu xe: tan(lái) = chiều dài cơ sở × tốc độ quay / vận tốc
      let d = v.yaw - st.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const yawRate = st.init && step > 0 ? d / step : 0;
      st.yaw = v.yaw;
      st.init = true;
      if (!spots || spots.length < 4) return;
      const base = Math.abs(spots[0].center.z - spots[2].center.z) || 2.6;
      const target = v.v > 0.3 ? THREE.MathUtils.clamp(Math.atan((base * yawRate) / v.v), -0.55, 0.55) : st.angle;
      st.angle += (target - st.angle) * Math.min(1, step * 8);
      carMatrix(v.x, v.z, v.yaw, _car);
      for (const w of spots) {
        // Bánh quay theo quãng đường: góc = quãng đường / bán kính của chính bánh đó
        const spin = (v.wheel * W.wheelRadius) / w.radius;
        _qr.setFromAxisAngle(_x, spin);
        if (w.front) _qr.premultiply(_qs.setFromAxisAngle(_up, st.angle));
        _local.compose(w.center, _qr, _s.set(w.width, w.radius, w.radius));
        _out.multiplyMatrices(_car, _local);
        T.setMatrixAt(n, _out);
        H.setMatrixAt(n, _out);
        N.setMatrixAt(n, _out);
        N.setColorAt(n, NEON[v.model % NEON.length]);
        n++;
      }
    });
    for (const m of [T, H, N]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
    if (N.instanceColor) N.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={tire} args={[geo.tire, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color="#141218" roughness={0.85} metalness={0.05} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={hub} args={[geo.hub, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial color="#8d93a6" roughness={0.3} metalness={0.9} />
      </instancedMesh>
      <instancedMesh ref={neon} args={[geo.neon, undefined, count]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Xe giao thông (hiển thị, đặt ngoài <Physics>) */
export function TrafficCars() {
  const models = useMemo(() => [...new Set(ensureTraffic().vehicles!.vehicles.map((v) => v.model))], []);
  return (
    <>
      {models.map((m) => (
        <Suspense key={m} fallback={null}>
          <TrafficModel model={m} />
        </Suspense>
      ))}
      <TrafficWheels />
    </>
  );
}

/** Thân va chạm động học cho xe giao thông (đặt trong <Physics>): người chơi bị xe đẩy thay vì đi xuyên qua */
export function TrafficColliders() {
  const vehicles = ensureTraffic().vehicles!.vehicles;
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  useFrame(() => {
    vehicles.forEach((v, i) => {
      const b = bodies.current[i];
      if (!b) return;
      b.setNextKinematicTranslation({ x: v.x, y: 0.9, z: v.z });
      _q.setFromAxisAngle(_up, v.yaw);
      b.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    });
  });
  return (
    <>
      {vehicles.map((v, i) => (
        <RigidBody key={v.id} ref={(r) => void (bodies.current[i] = r)} type="kinematicPosition" colliders={false} position={[v.x, 0.9, v.z]}>
          <CuboidCollider args={[1, 0.8, v.halfLen]} />
        </RigidBody>
      ))}
    </>
  );
}

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { splitWheels } from "./carWheels";
import { useSetParts } from "./setParts";
import { CAR_YAW, DRIVE_MODELS, ensureTraffic, traffic } from "./trafficWorld";
import { glowTexture } from "./Vehicles";

// Xe tự lái: vị trí lấy từ VehicleSim, mỗi loại model là một nhóm instancing.
// Bánh xe tách khỏi thân (carWheels.ts) để quay theo quãng đường; đèn phanh sáng khi giảm tốc.

const _car = new THREE.Matrix4();
const _wheel = new THREE.Matrix4();
const _spin = new THREE.Matrix4();
const _out = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const BRAKE_ON = new THREE.Color(4, 0.15, 0.12);
const BRAKE_OFF = new THREE.Color(0.55, 0.02, 0.02);
const HEAD = new THREE.Color(1.4, 1.35, 1.2);

function TrafficModel({ model }: { model: number }) {
  const spec = DRIVE_MODELS[model];
  const { parts } = useSetParts(spec.name, "", spec.length, "longest", spec.yaw ?? CAR_YAW);
  const set = useMemo(() => {
    const w = splitWheels(parts);
    traffic.wheelInfo[spec.name] = w.wheels.length;
    return w;
  }, [parts, spec.name]);
  const mine = useMemo(() => traffic.vehicles?.vehicles.filter((v) => v.model === model) ?? [], [model]);
  const bodyRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const wheelRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
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
    const n = mine.length;
    for (let i = 0; i < n; i++) {
      const v = mine[i];
      _car.compose(_p.set(v.x, 0, v.z), _q.setFromAxisAngle(_up, v.yaw), _one);
      for (const mesh of bodyRefs.current) mesh?.setMatrixAt(i, _car);
      set.wheels.forEach((w, wi) => {
        const mesh = wheelRefs.current[wi];
        if (!mesh) return;
        _wheel.makeTranslation(w.center.x, w.center.y, w.center.z);
        _spin.makeRotationX(v.wheel);
        mesh.setMatrixAt(i, _out.multiplyMatrices(_car, _wheel).multiply(_spin));
      });
      const L = lights.current;
      if (L) {
        lamps.forEach((l, li) => {
          _wheel.makeTranslation(l.x, l.y, l.z);
          L.setMatrixAt(i * 4 + li, _out.multiplyMatrices(_car, _wheel));
          L.setColorAt(i * 4 + li, l.back ? (v.braking ? BRAKE_ON : BRAKE_OFF) : HEAD);
        });
      }
    }
    for (const m of [...bodyRefs.current, ...wheelRefs.current]) if (m) m.instanceMatrix.needsUpdate = true;
    if (lights.current) {
      lights.current.instanceMatrix.needsUpdate = true;
      if (lights.current.instanceColor) lights.current.instanceColor.needsUpdate = true;
    }
  });

  if (mine.length === 0) return null;
  return (
    <>
      {set.body.map((p, i) => (
        <instancedMesh key={`b${i}`} ref={(r) => void (bodyRefs.current[i] = r)} args={[p.geometry, p.material, mine.length]} frustumCulled={false} />
      ))}
      {set.wheels.map((w, i) => (
        <instancedMesh key={`w${i}`} ref={(r) => void (wheelRefs.current[i] = r)} args={[w.geometry, w.material, mine.length]} frustumCulled={false} />
      ))}
      <instancedMesh ref={lights} args={[lightGeo, lightMat, mine.length * 4]} frustumCulled={false} />
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

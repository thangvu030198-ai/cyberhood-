import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { axisOf, DIRS, opposite, type Dir } from "../traffic/road";
import { lightFor, pedLightFor } from "../traffic/signals";
import { TUNING } from "../traffic/tuning";
import { BLOCK_CENTERS, CITY, PALETTE } from "./config";
import { makeLaneTexture } from "./textures";
import { ROAD, traffic } from "./trafficWorld";

// Mặt đường dùng chung bản đồ đường của giao thông: vỉa hè bo góc, vạch tim đường, vạch phân làn đỗ,
// vạch dừng, vạch sang đường kẻ sọc, và đèn giao thông ở từng ngã tư.

const R = TUNING.road;
const MARK_Y = 0.012;

/** Hình chữ nhật nằm ngang (trên mặt XZ) có tâm (x, z), dài `len` theo hướng `yaw`, rộng `w` */
function flatRect(x: number, z: number, len: number, w: number, yaw: number, uvRepeat = 1) {
  const g = new THREE.PlaneGeometry(w, len);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * uvRepeat);
  g.rotateX(-Math.PI / 2);
  g.rotateY(yaw);
  g.translate(x, MARK_Y, z);
  return g;
}

export function RoadMarkings() {
  const { dashes, solids } = useMemo(() => {
    const dash: THREE.BufferGeometry[] = [];
    const solid: THREE.BufferGeometry[] = [];
    // Mỗi đoạn đường giữa hai ngã tư: vạch tim nét đứt, hai vạch phân làn đỗ, vạch dừng ở đầu làn
    for (const seg of ROAD.segments) {
      const a = ROAD.junctions[seg.from];
      const b = ROAD.junctions[seg.to];
      const [hx, hz] = DIRS[seg.dir];
      const yaw = Math.atan2(hx, hz);
      const len = Math.hypot(b.x - a.x, b.z - a.z) - 2 * R.crosswalkOuter;
      const cx = (a.x + b.x) / 2;
      const cz = (a.z + b.z) / 2;
      const [rx, rz] = [-hz, hx];
      // Mỗi đoạn có hai chiều: chỉ vẽ phần dùng chung (tim đường) một lần
      if (seg.dir < 2) dash.push(flatRect(cx, cz, len, 0.22, yaw, len / 6));
      // Vạch ngăn làn chạy với dải đỗ xe bên phải
      const edge = R.laneOffset + 1.75;
      solid.push(flatRect(cx + rx * edge, cz + rz * edge, len, 0.12, yaw));
      // Vạch dừng: từ tim đường sang mép phải, ngay trước vạch sang đường
      const stop = R.crosswalkOuter + 0.35;
      solid.push(flatRect(b.x - hx * stop + rx * edge * 0.5, b.z - hz * stop + rz * edge * 0.5, 0.45, edge, yaw + Math.PI / 2));
    }
    // Vạch sang đường: các sọc song song chiều xe chạy, trải ngang hết bề rộng đường
    for (const cw of ROAD.crosswalks) {
      const [hx, hz] = DIRS[cw.arm];
      const yaw = Math.atan2(hx, hz);
      const [rx, rz] = [-hz, hx];
      const band = R.crosswalkOuter - R.crosswalkInner;
      for (let off = -R.junctionHalf + 0.8; off <= R.junctionHalf - 0.6; off += 1.2) {
        solid.push(flatRect(cw.x + rx * off, cw.z + rz * off, band, 0.6, yaw));
      }
    }
    return { dashes: mergeGeometries(dash, false), solids: mergeGeometries(solid, false) };
  }, []);
  const lane = useMemo(() => {
    const t = makeLaneTexture();
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }, []);
  return (
    <>
      <mesh geometry={dashes}>
        <meshBasicMaterial map={lane} transparent color="#d8c87a" polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh geometry={solids}>
        <meshBasicMaterial color="#bdb7a2" polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </>
  );
}

/** Vỉa hè từng khối nhà, bo tròn bốn góc; va chạm = hai hộp chữ thập + bốn trụ ở góc */
export function Sidewalks() {
  const geo = useMemo(() => {
    const half = CITY.BLOCK / 2;
    const r = R.curbRadius;
    const shape = new THREE.Shape();
    shape.moveTo(-half + r, -half);
    shape.lineTo(half - r, -half);
    shape.absarc(half - r, -half + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(half, half - r);
    shape.absarc(half - r, half - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-half + r, half);
    shape.absarc(-half + r, half - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-half, -half + r);
    shape.absarc(-half + r, -half + r, r, Math.PI, Math.PI * 1.5, false);
    const one = new THREE.ExtrudeGeometry(shape, { depth: CITY.SIDEWALK_HEIGHT, bevelEnabled: false, curveSegments: 6 });
    one.rotateX(Math.PI / 2);
    one.translate(0, CITY.SIDEWALK_HEIGHT, 0);
    const all = BLOCK_CENTERS.flatMap((bx) => BLOCK_CENTERS.map((bz) => one.clone().translate(bx, 0, bz)));
    return mergeGeometries(all, false);
  }, []);
  const half = CITY.BLOCK / 2;
  const r = R.curbRadius;
  const h = CITY.SIDEWALK_HEIGHT / 2;
  return (
    <>
      <mesh geometry={geo} userData={{ cameraCollider: true }}>
        <meshStandardMaterial color={PALETTE.concrete} roughness={0.6} metalness={0.3} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {BLOCK_CENTERS.flatMap((bx) =>
          BLOCK_CENTERS.map((bz) => (
            <group key={`${bx}:${bz}`}>
              <CuboidCollider args={[half, h, half - r]} position={[bx, h, bz]} />
              <CuboidCollider args={[half - r, h, half]} position={[bx, h, bz]} />
              {[
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
              ].map(([sx, sz]) => (
                <CylinderCollider key={`${sx}${sz}`} args={[h, r]} position={[bx + sx * (half - r), h, bz + sz * (half - r)]} />
              ))}
            </group>
          )),
        )}
      </RigidBody>
    </>
  );
}

// ---------------------------------------------------------------------------
// Đèn giao thông

type Head = {
  junction: number;
  /** Nhánh mà xe đi tới từ đó */
  arm: Dir;
  x: number;
  z: number;
  /** Hướng mặt đèn xe (nhìn về phía xe đang tới) */
  yaw: number;
  /** Hướng mặt đèn đi bộ (nhìn sang bên kia đường) */
  pedYaw: number;
};

const POLE_H = 4.6;
const BULB = new THREE.SphereGeometry(0.16, 10, 8);
const COLORS = {
  red: [new THREE.Color(5, 0.25, 0.2), new THREE.Color(0.25, 0.02, 0.02)],
  yellow: [new THREE.Color(5, 3, 0.2), new THREE.Color(0.25, 0.16, 0.02)],
  green: [new THREE.Color(0.3, 5, 1.2), new THREE.Color(0.02, 0.22, 0.06)],
  walk: new THREE.Color(3.5, 3.5, 3.2),
  stop: new THREE.Color(4, 1, 0.2),
  off: new THREE.Color(0.1, 0.05, 0.02),
};

export function TrafficLights() {
  const heads = useMemo(() => {
    const list: Head[] = [];
    for (const jn of ROAD.junctions) {
      for (let a = 0 as Dir; a < 4; a = (a + 1) as Dir) {
        if (!jn.arms[a]) continue;
        // Xe tới từ nhánh a chạy theo hướng ngược lại; cột đèn ở góc bên phải của làn xe tới
        const h = opposite(a);
        const [hx, hz] = DIRS[h];
        const [ax, az] = DIRS[a];
        const [rx, rz] = [-hz, hx];
        const along = R.crosswalkOuter + 0.7;
        const side = R.junctionHalf + 0.9;
        list.push({
          junction: jn.id,
          arm: a,
          x: jn.x + ax * along + rx * side,
          z: jn.z + az * along + rz * side,
          yaw: Math.atan2(-hx, -hz),
          pedYaw: Math.atan2(-rx, -rz),
        });
      }
    }
    return list;
  }, []);

  const poles = useRef<THREE.InstancedMesh>(null);
  const boxes = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const peds = useRef<THREE.InstancedMesh>(null);
  const placed = useRef(false);
  const last = useRef(-1);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const off = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!placed.current && poles.current && boxes.current && bulbs.current && peds.current) {
      placed.current = true;
      heads.forEach((hd, i) => {
        poles.current!.setMatrixAt(i, m.compose(p.set(hd.x, POLE_H / 2, hd.z), q.identity(), one));
        q.setFromAxisAngle(up, hd.yaw);
        boxes.current!.setMatrixAt(i, m.compose(p.set(hd.x, POLE_H - 0.35, hd.z), q, one));
        for (let k = 0; k < 3; k++) {
          // Đỏ trên cùng, vàng giữa, xanh dưới; nhô ra mặt trước hộp đèn
          off.set(0, 0.36 - k * 0.36, 0.22).applyQuaternion(q);
          bulbs.current!.setMatrixAt(i * 3 + k, m.compose(p.set(hd.x + off.x, POLE_H - 0.35 + off.y, hd.z + off.z), q.identity(), one));
        }
        q.setFromAxisAngle(up, hd.pedYaw);
        off.set(0, 0, 0.14).applyQuaternion(q);
        peds.current!.setMatrixAt(i, m.compose(p.set(hd.x + off.x, 2.6, hd.z + off.z), q, one));
      });
      for (const r of [poles, boxes, bulbs, peds]) {
        r.current!.instanceMatrix.needsUpdate = true;
        r.current!.computeBoundingSphere();
      }
    }
    // Đổi màu đèn 5 lần mỗi giây là đủ
    const t = traffic.time;
    if (Math.abs(t - last.current) < 0.2) return;
    last.current = t;
    const B = bulbs.current;
    const P = peds.current;
    if (!B || !P) return;
    const flash = Math.floor(t * 2) % 2 === 0;
    heads.forEach((hd, i) => {
      const jn = ROAD.junctions[hd.junction];
      const light = lightFor(jn, axisOf(hd.arm), t);
      B.setColorAt(i * 3, COLORS.red[light === "red" ? 0 : 1]);
      B.setColorAt(i * 3 + 1, COLORS.yellow[light === "yellow" ? 0 : 1]);
      B.setColorAt(i * 3 + 2, COLORS.green[light === "green" ? 0 : 1]);
      // Đèn đi bộ cho vạch sang đường ở nhánh này: người đi theo trục vuông góc với nhánh
      const walkAxis = axisOf(hd.arm) === "x" ? "z" : "x";
      const ped = pedLightFor(jn, walkAxis, t);
      P.setColorAt(i, ped === "walk" ? COLORS.walk : ped === "flash" ? (flash ? COLORS.stop : COLORS.off) : COLORS.stop);
    });
    if (B.instanceColor) B.instanceColor.needsUpdate = true;
    if (P.instanceColor) P.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={poles} args={[undefined, undefined, heads.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.08, 0.1, POLE_H, 8]} />
        <meshStandardMaterial color="#2a2733" metalness={0.7} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={boxes} args={[undefined, undefined, heads.length]} frustumCulled={false}>
        <boxGeometry args={[0.42, 1.15, 0.36]} />
        <meshStandardMaterial color="#121018" metalness={0.5} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[BULB, undefined, heads.length * 3]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={peds} args={[undefined, undefined, heads.length]} frustumCulled={false}>
        <boxGeometry args={[0.3, 0.3, 0.08]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <RigidBody type="fixed" colliders={false}>
        {heads.map((hd, i) => (
          <CylinderCollider key={i} args={[POLE_H / 2, 0.14]} position={[hd.x, POLE_H / 2, hd.z]} />
        ))}
      </RigidBody>
    </>
  );
}

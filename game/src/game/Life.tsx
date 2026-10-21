import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { extraModel, type ExtraModel } from "./assets";
import { useSetParts } from "./setParts";
import { Pedestrians } from "./Pedestrians";
import { TrafficCars, TrafficColliders } from "./TrafficCars";
import { CAR_YAW, DRIVE_MODELS, ROAD, claimBay, isBayFree, releaseBays, stepTraffic } from "./trafficWorld";
import { BLOCK_CENTERS, BOARD_SPOT, CITY, CITY_HALF, PLAYER, mulberry32 } from "./config";
import { NPCS, VAULT_DOOR } from "./story";
import { SHOP_POS } from "./Shop";

// Thành phố có người ở: đạo cụ phố, xe đậu trong ô, giao thông và người đi bộ (src/traffic), trực thăng.
// Tất cả là model tải nền (xem src/assets/LICENSES.md), mỗi nhóm nằm trong Suspense riêng.

/** Vòng vỉa hè quanh mỗi khối nhà, tính từ tâm khối */
const CURB_RING = 19.3;
const SIDEWALK = CITY.SIDEWALK_HEIGHT;

/** Vị trí và hướng trên vòng vỉa hè quanh khối (bx, bz) tại quãng đường s */
function ringPoint(bx: number, bz: number, r: number, s: number, out: THREE.Vector3) {
  const side = r * 2;
  const total = side * 4;
  const d = ((s % total) + total) % total;
  const k = Math.floor(d / side);
  const f = d - k * side - r;
  if (k === 0) out.set(bx + f, 0, bz - r);
  else if (k === 1) out.set(bx + r, 0, bz + f);
  else if (k === 2) out.set(bx - f, 0, bz + r);
  else out.set(bx - r, 0, bz - f);
  return k;
}
const SIDE_YAW = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];

/** Điểm cần chừa trống (NPC, quầy, bảng hợp đồng, cửa vault, khu Hub) */
const KEEP_CLEAR: [number, number, number][] = [
  [SHOP_POS.x, SHOP_POS.z, 4],
  [BOARD_SPOT.x, BOARD_SPOT.z, 4],
  [VAULT_DOOR[0], VAULT_DOOR[2], 6],
  ...Object.values(NPCS)
    .filter((n) => !n.inVault)
    .map((n) => [n.pos[0], n.pos[2], 3] as [number, number, number]),
  [-11.5, 4, 10], // tủ đồ uống, máy tính, cổng dịch chuyển
  [11.5, 6, 13], // lò ion, cây holo, cánh tay robot
  [-11.5, -8.5, 4], // kệ vật phẩm đặc biệt
  [6.3, -4, 5], // bệ xoay xe Velocity
  [-6.6, -6.5, 3], // mô tô
  [11.4, 30, 3.5], // quầy mì
];
const clear = (x: number, z: number) => KEEP_CLEAR.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r);

function SetInstances({
  file,
  name,
  size,
  by = "height",
  yaw = 0,
  matrices,
  colliders,
}: {
  file: ExtraModel;
  name: string;
  size: number;
  by?: "height" | "longest";
  yaw?: number;
  matrices: THREE.Matrix4[];
  colliders?: boolean;
}) {
  const { parts, half } = useSetParts(file, name, size, by, yaw);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const out = useMemo(() => new THREE.Matrix4(), []);
  // Đạo cụ đứng yên: gán ma trận một lần khi InstancedMesh gắn vào
  const setRef = (pi: number) => (r: THREE.InstancedMesh | null) => {
    refs.current[pi] = r;
    if (!r) return;
    matrices.forEach((m, i) => r.setMatrixAt(i, out.multiplyMatrices(m, parts[pi].matrix)));
    r.instanceMatrix.needsUpdate = true;
    r.computeBoundingSphere();
  };
  const boxes = useMemo(() => {
    if (!colliders) return [];
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const e = new THREE.Euler();
    return matrices.map((m) => {
      m.decompose(p, q, s);
      e.setFromQuaternion(q);
      return { pos: [p.x, p.y + half.y, p.z] as [number, number, number], rot: [0, e.y, 0] as [number, number, number] };
    });
  }, [matrices, colliders, half]);
  return (
    <>
      {parts.map((part, i) => (
        <instancedMesh key={i} ref={setRef(i)} args={[part.geometry, part.material, matrices.length]} />
      ))}
      {colliders && boxes.length > 0 && (
        <RigidBody type="fixed" colliders={false}>
          {boxes.map((b, i) => (
            <CuboidCollider key={i} args={[half.x, half.y, half.z]} position={b.pos} rotation={b.rot} />
          ))}
        </RigidBody>
      )}
    </>
  );
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
function place(x: number, y: number, z: number, yaw: number) {
  return _m.compose(new THREE.Vector3(x, y, z), _q.setFromAxisAngle(_up, yaw), new THREE.Vector3(1, 1, 1)).clone();
}

const STREET_PROPS: { name: string; size: number; by?: "height" | "longest"; weight: number; collider?: boolean }[] = [
  { name: "traffic_cone", size: 0.75, weight: 3 },
  { name: "kaykit_dumpster", size: 2.2, by: "longest", weight: 2, collider: true },
  { name: "pm_lunar_lamp01", size: 3.2, weight: 3 },
  { name: "pm_lunar_outerlamp", size: 2.6, weight: 2, collider: true },
  { name: "pm_infopanel", size: 2.8, weight: 2, collider: true },
  { name: "pm_scifi_glassscreen", size: 2.4, by: "longest", weight: 1 },
  { name: "pm_scifi_machine", size: 3, weight: 1, collider: true },
  { name: "pm_scifi_antenna", size: 3.4, weight: 1 },
  { name: "pm_scifi_capsule", size: 2.2, weight: 1, collider: true },
  { name: "pm_scifi_battery", size: 1.4, weight: 1, collider: true },
  { name: "boombox", size: 0.7, by: "longest", weight: 1 },
  { name: "lantern", size: 2.4, weight: 1 },
  { name: "pm_colony_minipc", size: 1.2, by: "longest", weight: 1 },
];

/** Rải đạo cụ dọc mép vỉa hè mọi khối nhà, theo seed cố định */
function StreetProps({ density }: { density: number }) {
  const groups = useMemo(() => {
    const rand = mulberry32(909);
    const total = STREET_PROPS.reduce((a, p) => a + p.weight, 0);
    const byName = new Map<string, THREE.Matrix4[]>();
    const pos = new THREE.Vector3();
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        for (let s = 3; s < CURB_RING * 8; s += 9 + rand() * 7) {
          if (rand() > density) continue;
          const side = ringPoint(bx, bz, CURB_RING, s, pos);
          const along = (s % (CURB_RING * 2)) - CURB_RING;
          if (Math.abs(along) > CURB_RING - 3) continue; // chừa góc phố
          if (!clear(pos.x, pos.z)) continue;
          let pick = rand() * total;
          const prop = STREET_PROPS.find((p) => (pick -= p.weight) < 0) ?? STREET_PROPS[0];
          // Đạo cụ quay mặt ra đường
          const yaw = SIDE_YAW[side] - Math.PI / 2 + (rand() - 0.5) * 0.3;
          const list = byName.get(prop.name) ?? [];
          list.push(place(pos.x, SIDEWALK, pos.z, yaw));
          byName.set(prop.name, list);
        }
      }
    }
    return STREET_PROPS.filter((p) => byName.has(p.name)).map((p) => ({ ...p, matrices: byName.get(p.name)! }));
  }, [density]);
  return (
    <>
      {groups.map((g) => (
        <SetInstances key={g.name} file="street" name={g.name} size={g.size} by={g.by} matrices={g.matrices} colliders={g.collider} />
      ))}
    </>
  );
}

/** Xe chỉ để đỗ (không chạy): mô tô, xe tay ga */
const PARK_ONLY: { name: ExtraModel; length: number; yaw?: number }[] = [
  { name: "mx_veh_hoverbike", length: 2.3 },
  { name: "mx_veh_scooter", length: 1.8 },
  { name: "mx_veh_police_bike", length: 2.3 },
];
// Xe buýt, xe tải bay, xe rác không đỗ dọc phố
const PARK_MODELS = [...DRIVE_MODELS.filter((m) => m.length <= 6.5), ...PARK_ONLY];

/** Xe đậu gọn trong ô đỗ dọc lề đường (dùng chung danh sách ô với xe lái được), có va chạm */
function ParkedCars({ count }: { count: number }) {
  const groups = useMemo(() => {
    const rand = mulberry32(1331);
    const byName = new Map<string, THREE.Matrix4[]>();
    releaseBays("parked");
    const bays = ROAD.bays.slice().sort(() => rand() - 0.5);
    let made = 0;
    for (const bay of bays) {
      if (made >= count) break;
      if (!isBayFree(bay.id) || !clear(bay.x, bay.z) || Math.hypot(bay.x - PLAYER.spawn[0], bay.z - PLAYER.spawn[2]) < 14) continue;
      // Không đỗ sát ô đã có xe (chừa khoảng trống để xe lái được tự vào ô)
      if (rand() < 0.35) continue;
      claimBay(bay, "parked");
      const model = PARK_MODELS[Math.floor(rand() * PARK_MODELS.length)];
      const list = byName.get(model.name) ?? [];
      list.push(place(bay.x, 0, bay.z, bay.yaw));
      byName.set(model.name, list);
      made++;
    }
    return PARK_MODELS.filter((m) => byName.has(m.name)).map((m) => ({ ...m, matrices: byName.get(m.name)! }));
  }, [count]);
  return (
    <>
      {groups.map((g) => (
        <SetInstances key={g.name} file={g.name} name="" size={g.length} by="longest" yaw={g.yaw ?? CAR_YAW} matrices={g.matrices} colliders />
      ))}
    </>
  );
}

/** Chạy mô phỏng giao thông + người đi bộ mỗi frame */
function TrafficDirector() {
  useFrame((_, dt) => stepTraffic(dt));
  return null;
}

// ---------------------------------------------------------------------------
// Trên trời và ngoài rìa: trực thăng tuần tra, UFO lơ lửng, sân khấu neon

function useScene(file: ExtraModel, size: number, by: "height" | "longest" = "longest") {
  const gltf = use(extraModel(file));
  return useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / (by === "height" ? dim.y : Math.max(dim.x, dim.y, dim.z));
    scene.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    scene.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    const root = new THREE.Group();
    root.add(scene);
    return { root, scene, animations: gltf.animations };
  }, [gltf, size, by]);
}

function Helicopter() {
  const { root } = useScene("helicopter", 13);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.12;
    g.position.set(Math.cos(t) * 85, 46 + Math.sin(t * 3) * 3, Math.sin(t) * 85);
    g.rotation.set(0, -t + Math.PI, 0.12);
  });
  return (
    <group ref={ref}>
      <primitive object={root} />
    </group>
  );
}

function BigUfo() {
  const { root, scene, animations } = useScene("bigufo", 22);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  useMemo(() => {
    const hover = animations.find((a) => a.name === "hover") ?? animations[0];
    if (hover) mixer.clipAction(hover).play();
  }, [mixer, animations]);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    mixer.update(Math.min(dt, 0.1));
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.15;
  });
  return (
    <group ref={ref} position={[70, 58, -75]}>
      <primitive object={root} />
    </group>
  );
}

const PLATFORM_POS = new THREE.Vector3(CITY_HALF + 26, 0, 38);
function Platform() {
  const { root } = useScene("platform", 32);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = camera.position.distanceTo(PLATFORM_POS) < 170;
  });
  return (
    <group ref={ref} position={PLATFORM_POS}>
      <primitive object={root} />
    </group>
  );
}

/** Phần có va chạm (đạo cụ, xe đậu): đặt bên trong <Physics> */
export function LifeStatic({ quality }: { quality: "high" | "low" }) {
  return (
    <>
      <TrafficColliders />
      <Suspense fallback={null}>
        <StreetProps density={quality === "high" ? 0.75 : 0.4} />
      </Suspense>
      <Suspense fallback={null}>
        <ParkedCars count={quality === "high" ? 26 : 14} />
      </Suspense>
    </>
  );
}

/** Phần chuyển động không va chạm: người, robot, xe chạy, trên trời */
export function LifeDynamic({ quality }: { quality: "high" | "low" }) {
  const high = quality === "high";
  return (
    <>
      <TrafficDirector />
      <Pedestrians />
      <TrafficCars />
      <Suspense fallback={null}>
        <Helicopter />
      </Suspense>
      <Suspense fallback={null}>
        <BigUfo />
      </Suspense>
      {high && (
        <Suspense fallback={null}>
          <Platform />
        </Suspense>
      )}
    </>
  );
}

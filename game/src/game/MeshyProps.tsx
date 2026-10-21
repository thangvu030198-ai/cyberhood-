import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { extraModel, type ExtraModel } from "./assets";
import { CITY, CITY_HALF } from "./config";
import { useFitted } from "./Showcase";
import { fitCharacter } from "./Player";
import { runtime } from "./contracts";
import type { MechSlot } from "../sim/config";

// Model gốc tạo bằng Meshy cho Cyberhood (xem docs/MESHY_ASSETS.md): NPC Archivist, tượng mech Director Vane,
// mech Colossus, xe Velocity, kệ vật phẩm đặc biệt, pin năng lượng, thùng tiếp tế, linh kiện Mech khi rơi đồ.

const Y = CITY.SIDEWALK_HEIGHT;

/** Archivist đi qua đi lại trên vỉa hè cạnh bảng hợp đồng */
function Archivist() {
  const walkGltf = use(extraModel("mx_archivist_walk"));
  const ref = useRef<THREE.Group>(null);
  const { scene, mixer } = useMemo(() => {
    const s = cloneSkinned(walkGltf.scene);
    fitCharacter(s, 1.78, 0);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.frustumCulled = false;
    });
    const mixer = new THREE.AnimationMixer(s);
    if (walkGltf.animations[0]) mixer.clipAction(walkGltf.animations[0]).play();
    return { scene: s, mixer };
  }, [walkGltf]);
  const t = useRef(0);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const step = Math.min(dt, 0.1);
    t.current += step;
    // Đi 16 m rồi quay lại, tốc độ chậm rãi
    const span = 16;
    const speed = 0.9;
    const d = (t.current * speed) % (span * 2);
    const forward = d < span;
    g.position.set(-9.2, Y, -7 + (forward ? d : span * 2 - d));
    g.rotation.y = forward ? 0 : Math.PI;
    mixer.update(step * 0.75);
  });
  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

function Statue({ name, size, position, rotationY, selfLit, drawWithin }: {
  name: ExtraModel;
  size: number;
  position: [number, number, number];
  rotationY: number;
  selfLit: number;
  drawWithin: number;
}) {
  const { root } = useFitted(name, size, "height", selfLit);
  const ref = useRef<THREE.Group>(null);
  const at = useMemo(() => new THREE.Vector3(...position), [position]);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = camera.position.distanceTo(at) < drawWithin;
  });
  return (
    <group ref={ref} position={position} rotation={[0, rotationY, 0]}>
      <primitive object={root} />
    </group>
  );
}

/** Xe Velocity trưng bày trên bệ xoay phát sáng cạnh điểm xuất phát */
function VelocityShowcase() {
  const { root } = useFitted("mx_velocity_car", 4.6, "longest", 0.55);
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += Math.min(dt, 0.1) * 0.35;
  });
  return (
    <group position={[6.3, 0, -4]}>
      <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[3.1, 48]} />
        <meshStandardMaterial color="#120b20" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.95, 3.15, 64]} />
        <meshBasicMaterial color={new THREE.Color("#ff2a6d").multiplyScalar(3)} toneMapped={false} />
      </mesh>
      <group ref={spin} position={[0, 0.12, 0]}>
        <primitive object={root} />
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.4, 0.7, 2.4]} position={[0, 0.7, 0]} />
      </RigidBody>
    </group>
  );
}

const SHELF_ITEMS: { name: ExtraModel; label: string }[] = [
  { name: "mx_extra_coin", label: "Extra Coin" },
  { name: "mx_chrono_cube", label: "Chrono Cube" },
  { name: "mx_nova_bomb", label: "Nova Bomb" },
  { name: "mx_battery_cell", label: "Pin năng lượng" },
  { name: "mx_easter_egg", label: "Easter Egg" },
];

function ShelfItem({ name, z }: { name: ExtraModel; z: number }) {
  const { root } = useFitted(name, 0.75, "longest", 0.25);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.9 + z;
    ref.current.position.y = 1.35 + Math.sin(clock.elapsedTime * 1.6 + z) * 0.06;
  });
  return (
    <group ref={ref} position={[0, 1.35, z]}>
      <primitive object={root} />
    </group>
  );
}

/** Kệ hologram trưng bày vật phẩm đặc biệt của mùa, cạnh bảng hợp đồng */
function ItemShelf() {
  return (
    <group position={[-11.5, Y, -6]}>
      {SHELF_ITEMS.map((it, i) => {
        const z = -i * 1.15;
        return (
          <group key={it.name}>
            <mesh position={[0, 0.5, z]}>
              <cylinderGeometry args={[0.32, 0.4, 1, 20]} />
              <meshStandardMaterial color="#141022" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 1.02, z]}>
              <cylinderGeometry args={[0.34, 0.34, 0.04, 24]} />
              <meshBasicMaterial color={new THREE.Color("#05d9e8").multiplyScalar(3)} toneMapped={false} />
            </mesh>
            <Suspense fallback={null}>
              <ShelfItem name={it.name} z={z} />
            </Suspense>
          </group>
        );
      })}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.4, 0.55, 2.6]} position={[0, 0.55, -2.3]} />
      </RigidBody>
    </group>
  );
}

/** Pin năng lượng nằm trên phố trong hợp đồng */
function Batteries() {
  const { root } = useFitted("mx_battery_cell", 0.9, "longest", 0.6);
  const copies = useMemo(() => [0, 1, 2, 3, 4].map(() => root.clone(true)), [root]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    copies.forEach((_, i) => {
      const g = refs.current[i];
      if (!g) return;
      const b = runtime.batteries[i];
      g.visible = !!b;
      if (!b) return;
      g.position.set(b.x, 1 + Math.sin(clock.elapsedTime * 2 + i) * 0.15, b.z);
      g.rotation.y = clock.elapsedTime * 1.5 + i;
    });
  });
  return (
    <>
      {copies.map((c, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} visible={false}>
          <primitive object={c} />
        </group>
      ))}
    </>
  );
}

/** Thùng tiếp tế Meshy tại vị trí thả hàng của sự kiện phút 4 */
function SupplyCrate() {
  const { root } = useFitted("mx_supply_crate", 1.5, "longest", 0.3);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.visible = !!runtime.crate;
    if (runtime.crate) {
      g.position.set(runtime.crate.x, 0.05, runtime.crate.z);
      g.rotation.y = clock.elapsedTime * 0.3;
    }
  });
  return (
    <group ref={ref} visible={false}>
      <primitive object={root} />
    </group>
  );
}

const PART_MODEL: Record<MechSlot, ExtraModel> = {
  core: "mx_part_core",
  armor: "mx_part_armor",
  weapon: "mx_part_weapon",
  engine: "mx_part_engine",
};

function PartFloat({ slot }: { slot: MechSlot }) {
  const { root } = useFitted(PART_MODEL[slot], 1.1, "longest", 0.5);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = performance.now() / 1000;
    const beam = [...runtime.beams].reverse().find((b) => b.slot === slot && t - b.born < 2.4);
    g.visible = !!beam;
    if (!beam) return;
    const k = (t - beam.born) / 2.4;
    g.position.set(beam.pos.x, beam.pos.y + 1.4 + k * 1.2, beam.pos.z);
    g.rotation.y = t * 2.5;
    g.scale.setScalar(Math.min(1, k * 6) * (1 - Math.max(0, k - 0.8) * 5));
  });
  return (
    <group ref={ref} visible={false}>
      <primitive object={root} />
    </group>
  );
}

function Placed({ name, size, by = "longest", position, rotationY, selfLit = 0.3, collider }: {
  name: ExtraModel;
  size: number;
  by?: "height" | "longest";
  position: [number, number, number];
  rotationY: number;
  selfLit?: number;
  collider: [number, number, number];
}) {
  const { root } = useFitted(name, size, by, selfLit);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={root} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={collider} position={[0, collider[1], 0]} />
      </RigidBody>
    </group>
  );
}

/** Công trình bản đồ lớn ngoài rìa thành phố (Meshy): có hộp va chạm theo kích thước thật,
 * chỉ vẽ khi camera ở trong tầm `drawWithin` */
function Landmark({ name, height, position, rotationY = 0, selfLit = 0.3, drawWithin = 280, solid = true }: {
  name: ExtraModel;
  height: number;
  position: [number, number, number];
  rotationY?: number;
  selfLit?: number;
  drawWithin?: number;
  solid?: boolean;
}) {
  const { root } = useFitted(name, height, "height", selfLit);
  const half = useMemo(() => new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).multiplyScalar(0.5), [root]);
  const ref = useRef<THREE.Group>(null);
  const at = useMemo(() => new THREE.Vector3(...position), [position]);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = camera.position.distanceTo(at) < drawWithin;
  });
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group ref={ref}>
        <primitive object={root} />
      </group>
      {solid && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[half.x * 0.85, half.y, half.z * 0.85]} position={[0, half.y, 0]} />
        </RigidBody>
      )}
    </group>
  );
}

const toCity = (x: number, z: number) => Math.atan2(-x, -z);

/** Bản đồ ngoài rìa: Citadel của Vane (tây bắc) có máy phát khiên và tháp pháo canh, cổng dịch chuyển cuối
 * đại lộ phía nam, tàu đổ bộ ở bãi đông, khu đổ nát chiến trường và cửa hầm phía tây, Hollow Hotel phía nam xa */
function Landmarks() {
  const c: [number, number] = [-185, -165];
  return (
    <>
      <Suspense fallback={null}>
        <Landmark name="mx_map_citadel" height={58} position={[c[0], 0, c[1]]} rotationY={toCity(...c)} drawWithin={420} />
      </Suspense>
      <Suspense fallback={null}>
        <Landmark name="mx_map_shield_gen" height={20} position={[-150, 0, -178]} rotationY={toCity(-150, -178)} selfLit={0.5} />
        <Landmark name="mx_map_shield_gen" height={20} position={[-198, 0, -128]} rotationY={toCity(-198, -128)} selfLit={0.5} />
      </Suspense>
      <Suspense fallback={null}>
        {[
          [-140, -140],
          [-158, -126],
          [-126, -158],
        ].map(([x, z]) => (
          <Landmark key={`${x}${z}`} name="mx_map_turret" height={5} position={[x, 0, z]} rotationY={toCity(x, z)} drawWithin={220} />
        ))}
      </Suspense>
      <Suspense fallback={null}>
        <Landmark name="mx_map_gate" height={18} position={[0, 0, CITY_HALF + 22]} rotationY={Math.PI} selfLit={0.45} />
      </Suspense>
      <Suspense fallback={null}>
        <Landmark name="mx_map_dropship" height={9} position={[160, 0, -70]} rotationY={-2.2} />
      </Suspense>
      <Suspense fallback={null}>
        <Landmark name="mx_map_ruins" height={4.5} position={[-158, 0, 62]} rotationY={0.4} solid={false} drawWithin={220} />
      </Suspense>
      <Suspense fallback={null}>
        <Landmark name="mx_map_bunker" height={11} position={[-CITY_HALF - 16, 0, 104]} rotationY={Math.PI / 2} />
      </Suspense>
      <Suspense fallback={null}>
        <Landmark name="mx_map_hollow_hotel" height={42} position={[70, 0, CITY_HALF + 50]} rotationY={Math.PI} drawWithin={360} />
      </Suspense>
    </>
  );
}

/** Phần có va chạm (đặt trong <Physics>) */
export function MeshyStatic() {
  return (
    <>
      <Suspense fallback={null}>
        <VelocityShowcase />
      </Suspense>
      <Suspense fallback={null}>
        <Placed name="mx_cyber_bike" size={2.2} position={[-6.6, 0, -5]} rotationY={0.3} collider={[0.4, 0.6, 1.1]} />
        <Placed name="mx_cyber_bike" size={2.2} position={[-6.6, 0, -8]} rotationY={-0.2} collider={[0.4, 0.6, 1.1]} />
      </Suspense>
      <Suspense fallback={null}>
        <Placed name="mx_noodle_stall" size={3.2} position={[11.4, Y, 30]} rotationY={-Math.PI / 2} collider={[1.4, 1.3, 0.9]} />
      </Suspense>
      <ItemShelf />
      <Landmarks />
    </>
  );
}

/** Phần trang trí và hiệu ứng (đặt ngoài <Physics>) */
export function MeshyDynamic() {
  return (
    <>
      <Suspense fallback={null}>
        <Archivist />
      </Suspense>
      <Suspense fallback={null}>
        <Statue name="mx_director_vane_mech" size={22} position={[0, 0, -CITY_HALF - 40]} rotationY={0} selfLit={0.3} drawWithin={260} />
      </Suspense>
      <Suspense fallback={null}>
        <Statue name="mx_colossus_mech" size={10} position={[CITY_HALF + 22, 0, 10]} rotationY={-Math.PI / 2} selfLit={0.25} drawWithin={200} />
      </Suspense>
      <Suspense fallback={null}>
        <Batteries />
      </Suspense>
      <Suspense fallback={null}>
        <SupplyCrate />
      </Suspense>
      {(["core", "armor", "weapon", "engine"] as const).map((slot) => (
        <Suspense key={slot} fallback={null}>
          <PartFloat slot={slot} />
        </Suspense>
      ))}
    </>
  );
}

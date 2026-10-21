import { Suspense, use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { extraModel, type ExtraModel } from "./assets";
import { CITY, CITY_HALF, mulberry32 } from "./config";

// Model chất lượng cao tải nền (xem src/assets/LICENSES.md): đạo cụ Hub, đội xe bay, công trình điểm nhấn.
// Mỗi nhóm nằm trong Suspense riêng nên hiện ra ngay khi file của nó tải xong.

const SIDEWALK = CITY.SIDEWALK_HEIGHT;

/** Bản sao của scene, thu phóng cho chiều cao (hoặc cạnh dài nhất) bằng `size`, đáy đặt ở y = 0 */
export function useFitted(name: ExtraModel, size: number, by: "height" | "longest" = "height", selfLit = 0) {
  const gltf = use(extraModel(name));
  return useMemo(() => {
    const root = new THREE.Group();
    const scene = gltf.scene.clone(true);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / (by === "height" ? dim.y : Math.max(dim.x, dim.y, dim.z));
    scene.scale.setScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    scene.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      // Vật liệu phát sáng sáng hơn để bloom bắt được
      if (mat.emissiveMap || (mat.emissive && mat.emissive.getHex() !== 0)) mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 2);
      else if (selfLit > 0 && mat.isMeshStandardMaterial) {
        // Model không có đèn riêng: tự sáng nhẹ theo texture để không chìm trong đêm
        mat.emissiveMap = mat.map;
        mat.emissive.set(mat.map ? "#ffffff" : mat.color);
        mat.emissiveIntensity = selfLit;
      }
    });
    root.add(scene);
    return { root, animations: gltf.animations, scene };
  }, [gltf, size, by, selfLit]);
}

/** Chạy clip đầu tiên (hoặc clip được chỉ định) của model lặp lại */
function useLoop(scene: THREE.Object3D, clips: THREE.AnimationClip[], name?: string, speed = 1) {
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  useEffect(() => {
    const clip = (name && clips.find((c) => c.name === name)) || clips[0];
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.timeScale = speed;
    action.play();
    return () => void action.stop();
  }, [mixer, clips, name, speed]);
  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1)));
}

function Prop({
  name,
  size,
  by,
  position,
  rotationY = 0,
  animate,
  collider,
}: {
  name: ExtraModel;
  size: number;
  by?: "height" | "longest";
  position: [number, number, number];
  rotationY?: number;
  animate?: boolean;
  /** Nửa kích thước hộp va chạm [x, y, z] */
  collider?: [number, number, number];
}) {
  const { root, animations, scene } = useFitted(name, size, by);
  useLoop(scene, animate ? animations : []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={root} />
      {collider && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={collider} position={[0, collider[1], 0]} />
        </RigidBody>
      )}
    </group>
  );
}

/** Đạo cụ quanh Vùng An toàn: tủ đồ uống, góc hacker, biển neon, lò ion, cánh tay robot cạnh quầy Vex.
 * Có hộp va chạm nên phải đặt bên trong <Physics>. */
export function HubProps() {
  const y = SIDEWALK;
  return (
    <>
      <Suspense fallback={null}>
        <Prop name="fridge" size={2.1} position={[-11.6, y, 7.2]} rotationY={Math.PI / 2} collider={[0.45, 1.05, 0.45]} />
        <Prop name="fridge" size={2.1} position={[-11.6, y, 8.3]} rotationY={Math.PI / 2} collider={[0.45, 1.05, 0.45]} />
      </Suspense>
      <Suspense fallback={null}>
        <Prop name="computers" size={2.2} by="longest" position={[-11.4, y, -2.2]} rotationY={Math.PI / 2} collider={[0.6, 0.9, 1]} />
      </Suspense>
      <Suspense fallback={null}>
        <Prop name="love" size={2.6} by="longest" position={[-12.1, 4.4, 3]} rotationY={Math.PI / 2} />
      </Suspense>
      <Suspense fallback={null}>
        <Prop name="teleporter" size={2.6} position={[-11.3, y, 0.4]} rotationY={Math.PI / 2} collider={[0.4, 1.3, 0.4]} />
        <Prop name="holotree" size={3.2} position={[11.4, y, 7.5]} collider={[0.3, 1.6, 0.3]} />
      </Suspense>
      <Suspense fallback={null}>
        <Prop name="crate" size={1} position={[-11.3, y, 10.4]} rotationY={0.3} collider={[0.5, 0.5, 0.5]} />
        <Prop name="crate" size={1} position={[-11.5, y, 11.5]} rotationY={-0.2} collider={[0.5, 0.5, 0.5]} />
        <Prop name="crate" size={1} position={[-11.4, y + 1, 10.9]} rotationY={0.9} />
      </Suspense>
      <Suspense fallback={null}>
        <Prop name="iondrive" size={3.4} by="longest" position={[11.6, y, -1.5]} rotationY={-Math.PI / 2} animate collider={[0.9, 1.2, 1.6]} />
      </Suspense>
      <Suspense fallback={null}>
        <Prop name="robotarm" size={2.6} position={[11.8, y, 17]} rotationY={-Math.PI / 2} animate collider={[0.4, 1.3, 0.4]} />
      </Suspense>
    </>
  );
}

// ---------------------------------------------------------------------------
// Đội xe bay: xe nâng chở hàng, phi thuyền, UFO bay theo làn trên cao (thay các khối hộp phát sáng cũ)

type FleetKind = "forklift" | "spaceship" | "ufo";
const FLEET: { kind: FleetKind; size: number; share: number }[] = [
  { kind: "forklift", size: 7, share: 0.45 },
  { kind: "spaceship", size: 9, share: 0.35 },
  { kind: "ufo", size: 6, share: 0.2 },
];

/** Gộp mọi lưới của model thành danh sách (geometry, material, ma trận) để vẽ bằng InstancedMesh */
function useFleetParts(kind: FleetKind, size: number) {
  const { root } = useFitted(kind, size, "longest", 0.55);
  return useMemo(() => {
    root.updateMatrixWorld(true);
    const parts: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) parts.push({ geometry: m.geometry, material: m.material as THREE.Material, matrix: m.matrixWorld.clone() });
    });
    return parts;
  }, [root]);
}

function FleetGroup({ kind, size, ships }: { kind: FleetKind; size: number; ships: Ship[] }) {
  const parts = useFleetParts(kind, size);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const out = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const span = CITY_HALF * 4;
    ships.forEach((s, i) => {
      const d = ((((s.offset + s.speed * t) % span) + span) % span) - span / 2;
      const yaw = s.axis === 0 ? (s.speed > 0 ? Math.PI / 2 : -Math.PI / 2) : s.speed > 0 ? 0 : Math.PI;
      const bob = Math.sin(t * 0.7 + i) * 0.8;
      if (s.axis === 0) p.set(d, s.height + bob, s.lane);
      else p.set(s.lane, s.height + bob, d);
      q.setFromAxisAngle(up, yaw + (kind === "ufo" ? t * 0.8 : 0));
      m.compose(p, q, one);
      parts.forEach((part, pi) => refs.current[pi]?.setMatrixAt(i, out.multiplyMatrices(m, part.matrix)));
    });
    for (const r of refs.current) if (r) r.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      {parts.map((part, i) => (
        <instancedMesh
          key={i}
          ref={(r) => void (refs.current[i] = r)}
          args={[part.geometry, part.material, ships.length]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

type Ship = { axis: number; lane: number; height: number; offset: number; speed: number };

function SkyFleet({ count = 26 }: { count?: number }) {
  const groups = useMemo(() => {
    const rand = mulberry32(611);
    return FLEET.map((f, fi) => {
      const n = Math.max(2, Math.round(count * f.share));
      const ships: Ship[] = Array.from({ length: n }, (_, i) => ({
        axis: (i + fi) % 2,
        lane: (rand() - 0.5) * CITY_HALF * 1.8,
        height: 26 + Math.floor(rand() * 4) * 8,
        offset: rand() * CITY_HALF * 4,
        speed: (rand() < 0.5 ? -1 : 1) * (f.kind === "forklift" ? 9 + rand() * 6 : 14 + rand() * 14),
      }));
      return { ...f, ships };
    });
  }, [count]);
  return (
    <>
      {groups.map((g) => (
        <Suspense key={g.kind} fallback={null}>
          <FleetGroup kind={g.kind} size={g.size} ships={g.ships} />
        </Suspense>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Công trình điểm nhấn: khu phố Nhật thu nhỏ có chuyển động ở rìa thành phố, skyline đỏ phía xa

const TOKYO_POS = new THREE.Vector3(-CITY_HALF - 34, 0, -24);
/** Ngoài khoảng này Tokyo bị sương che gần hết: thôi vẽ cho đỡ nặng */
const TOKYO_DRAW = 170;

function TokyoLandmark() {
  const { root, animations, scene } = useFitted("tokyo", 46, "longest", 0.5);
  useLoop(scene, animations, undefined, 0.6);
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = camera.position.distanceTo(TOKYO_POS) < TOKYO_DRAW;
  });
  return (
    <group ref={group} position={TOKYO_POS} rotation={[0, Math.PI / 2, 0]}>
      <primitive object={root} />
    </group>
  );
}

function Skyline() {
  const { root } = useFitted("skyline", 520, "longest");
  useMemo(() => {
    // Skyline ở rất xa: tắt sương mù để thấy bóng thành phố đỏ trên nền trời
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshBasicMaterial).fog = false;
    });
  }, [root]);
  return <primitive object={root} position={[0, -6, -470]} />;
}

/** Phần trang trí không có va chạm: đội xe bay, công trình điểm nhấn (đặt ngoài <Physics>) */
export function Showcase({ quality }: { quality: "high" | "low" }) {
  return (
    <>
      <SkyFleet count={quality === "high" ? 26 : 14} />
      <Suspense fallback={null}>
        <TokyoLandmark />
      </Suspense>
      {quality === "high" && (
        <Suspense fallback={null}>
          <Skyline />
        </Suspense>
      )}
    </>
  );
}

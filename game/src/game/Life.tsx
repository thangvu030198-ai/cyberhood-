import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { extraModel, models, type ExtraModel } from "./assets";
import { BLOCK_CENTERS, BOARD_SPOT, CITY, CITY_HALF, CITY_PITCH, PLAYER, mulberry32 } from "./config";
import { fitCharacter } from "./Player";
import { handles } from "./refs";
import { NPCS, VAULT_DOOR } from "./story";
import { SHOP_POS } from "./Shop";
import { useGame } from "./store";

// Thành phố có người ở: người đi bộ trên vỉa hè, robot đi dạo, đạo cụ phố, xe đậu, xe chạy, trực thăng.
// Tất cả là model tải nền (xem src/assets/LICENSES.md), mỗi nhóm nằm trong Suspense riêng.

const STREETS = Array.from({ length: CITY.GRID + 1 }, (_, i) => (i - CITY.GRID / 2) * CITY_PITCH);
/** Vòng vỉa hè quanh mỗi khối nhà, tính từ tâm khối */
const WALK_RING = 17.6;
const CURB_RING = 18.8;
const SIDEWALK = CITY.SIDEWALK_HEIGHT;
const PERIM = WALK_RING * 8;

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
];
const clear = (x: number, z: number) => KEEP_CLEAR.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r);

// ---------------------------------------------------------------------------
// Người đi bộ: 21 avatar 100Avatars dùng chung khung xương Mixamo nên chạy thẳng clip "Walk" của nhân vật chính

type Ped = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  bx: number;
  bz: number;
  s: number;
  speed: number;
};

/**
 * Mỗi avatar đặt tên xương một kiểu ("mixamorig:Hips", "AvatarsR2_0002:Hips", "vis_char_002:mixamorig:Hips"),
 * sau khi GLTFLoader bỏ dấu ":" thành "AvatarsR2_0002Hips"... Đổi về đúng tên trong clip của Soldier
 * bằng cách khớp phần đuôi dài nhất với danh sách xương Mixamo.
 */
function normalizeMixamoBones(model: THREE.Object3D, canonical: string[]) {
  const suffixes = canonical.map((c) => c.replace(/^mixamorig/, "")).sort((x, y) => y.length - x.length);
  model.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    // Gộp nhiều avatar chung một file nên GLTFLoader thêm hậu tố "_1", "_2"... cho tên trùng
    const base = o.name.replace(/_\d+$/, "");
    const hit = suffixes.find((suf) => base.endsWith(suf));
    if (hit) o.name = `mixamorig${hit}`;
  });
}

const PED_DRAW = 75;
const PED_ANIMATE = 45;
const _pp = new THREE.Vector3();

function Crowd({ count }: { count: number }) {
  const a = use(extraModel("crowd_a"));
  const b = use(extraModel("crowd_b"));
  const soldier = use(models.soldier);
  const peds = useMemo(() => {
    const scenes = [...a.scenes, ...b.scenes];
    const walkSrc = soldier.animations.find((c) => c.name === "Walk");
    // Bỏ track vị trí: avatar khác tỉ lệ với Soldier, chỉ mượn chuyển động xoay của khớp
    const walk = walkSrc
      ? new THREE.AnimationClip("Walk", walkSrc.duration, walkSrc.tracks.filter((t) => t.name.endsWith(".quaternion")))
      : null;
    const boneNames = walk ? walk.tracks.map((t) => t.name.split(".")[0]) : [];
    const rand = mulberry32(2024);
    const list: Ped[] = [];
    for (let i = 0; i < count; i++) {
      const src = scenes[i % scenes.length];
      const model = cloneSkinned(src);
      if (walk) normalizeMixamoBones(model, boneNames);
      fitCharacter(model, 1.62 + rand() * 0.28, 0);
      model.rotation.y = Math.PI; // VRM nhìn về -Z
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.frustumCulled = false;
      });
      const root = new THREE.Group();
      root.add(model);
      const mixer = new THREE.AnimationMixer(model);
      if (walk) {
        const act = mixer.clipAction(walk);
        act.time = rand() * walk.duration;
        act.play();
      }
      const dir = rand() < 0.5 ? -1 : 1;
      list.push({
        root,
        mixer,
        bx: BLOCK_CENTERS[Math.floor(rand() * BLOCK_CENTERS.length)],
        bz: BLOCK_CENTERS[Math.floor(rand() * BLOCK_CENTERS.length)],
        s: rand() * PERIM,
        speed: dir * (1.05 + rand() * 0.45),
      });
    }
    return list;
  }, [a, b, soldier, count]);

  useFrame(({ camera }, dt) => {
    const step = Math.min(dt, 0.1);
    const player = handles.player?.currPos;
    for (const p of peds) {
      // Né người chơi: đứng lại khi người chơi chắn ngay trước mặt
      ringPoint(p.bx, p.bz, WALK_RING, p.s, _pp);
      const blocked = !!player && Math.hypot(player.x - _pp.x, player.z - _pp.z) < 1.3;
      if (!blocked) p.s += p.speed * step;
      const side = ringPoint(p.bx, p.bz, WALK_RING, p.s, _pp);
      p.root.position.set(_pp.x, SIDEWALK, _pp.z);
      p.root.rotation.y = SIDE_YAW[side] + (p.speed < 0 ? Math.PI : 0);
      const d = camera.position.distanceTo(p.root.position);
      p.root.visible = d < PED_DRAW;
      if (d < PED_ANIMATE && !blocked) p.mixer.update(step);
    }
  });

  return (
    <>
      {peds.map((p, i) => (
        <primitive key={i} object={p.root} />
      ))}
    </>
  );
}

/** Robot RobotExpressive đi dạo quanh các khối gần Hub, thỉnh thoảng vẫy tay */
function Robots({ count }: { count: number }) {
  const gltf = use(extraModel("robot"));
  const bots = useMemo(() => {
    const rand = mulberry32(77);
    const near = BLOCK_CENTERS.filter((c) => Math.abs(c) < CITY_PITCH);
    return Array.from({ length: count }, (_, i) => {
      const model = cloneSkinned(gltf.scene);
      fitCharacter(model, 1.5, 0);
      const root = new THREE.Group();
      root.add(model);
      const mixer = new THREE.AnimationMixer(model);
      const clip = (n: string) => gltf.animations.find((c) => c.name === n);
      const walk = clip("Walking") ? mixer.clipAction(clip("Walking")!) : null;
      const wave = clip("Wave") ? mixer.clipAction(clip("Wave")!).setLoop(THREE.LoopOnce, 1) : null;
      walk?.play();
      return {
        root,
        mixer,
        walk,
        wave,
        bx: near[i % near.length],
        bz: near[Math.floor(rand() * near.length)],
        s: rand() * PERIM,
        speed: (i % 2 ? 1 : -1) * 1.3,
        nextWave: 6 + rand() * 10,
        pause: 0,
      };
    });
  }, [gltf, count]);
  useFrame(({ camera }, dt) => {
    const step = Math.min(dt, 0.1);
    for (const b of bots) {
      b.nextWave -= step;
      if (b.nextWave <= 0 && b.wave && b.walk) {
        b.nextWave = 12 + Math.random() * 12;
        b.pause = b.wave.getClip().duration;
        b.walk.fadeOut(0.2);
        b.wave.reset().fadeIn(0.2).play();
      }
      if (b.pause > 0) {
        b.pause -= step;
        if (b.pause <= 0) b.walk?.reset().fadeIn(0.3).play();
      } else b.s += b.speed * step;
      const side = ringPoint(b.bx, b.bz, WALK_RING - 0.6, b.s, _pp);
      b.root.position.set(_pp.x, SIDEWALK, _pp.z);
      b.root.rotation.y = SIDE_YAW[side] + (b.speed < 0 ? Math.PI : 0);
      const d = camera.position.distanceTo(b.root.position);
      b.root.visible = d < PED_DRAW;
      if (d < PED_ANIMATE) b.mixer.update(step);
    }
  });
  return (
    <>
      {bots.map((b, i) => (
        <primitive key={i} object={b.root} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Đạo cụ phố và xe: vẽ bằng InstancedMesh theo từng scene trong file bộ (cars.glb, street.glb)

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 };

/** Các lưới của một scene trong file bộ, đã thu phóng về kích thước `size` (chiều dài hoặc chiều cao), đáy tại y = 0 */
function useSetParts(file: ExtraModel, sceneName: string, size: number, by: "height" | "longest") {
  const gltf = use(extraModel(file));
  return useMemo(() => {
    const scene = gltf.scenes.find((s) => s.name === sceneName);
    if (!scene) return { parts: [] as Part[], half: new THREE.Vector3() };
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / (by === "height" ? dim.y : Math.max(dim.x, dim.z));
    const c = box.getCenter(new THREE.Vector3());
    const fix = new THREE.Matrix4().makeScale(k, k, k).premultiply(new THREE.Matrix4().makeTranslation(-c.x * k, -box.min.y * k, -c.z * k));
    const parts: Part[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.emissiveMap || (mat.emissive && mat.emissive.getHex() !== 0)) mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 2);
      parts.push({ geometry: m.geometry, material: mat, matrix: new THREE.Matrix4().multiplyMatrices(fix, m.matrixWorld) });
    });
    return { parts, half: dim.multiplyScalar(k / 2) };
  }, [gltf, sceneName, size, by]);
}

function SetInstances({
  file,
  name,
  size,
  by = "height",
  matrices,
  colliders,
}: {
  file: ExtraModel;
  name: string;
  size: number;
  by?: "height" | "longest";
  matrices: THREE.Matrix4[];
  colliders?: boolean;
}) {
  const { parts, half } = useSetParts(file, name, size, by);
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
  { name: "scifi_helmet", size: 0.6, weight: 1 },
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

const CAR_MODELS: { name: string; length: number }[] = [
  { name: "kenney_sports_sedan", length: 4.6 },
  { name: "kenney_taxi", length: 4.5 },
  { name: "kenney_police", length: 4.7 },
  { name: "kenney_suv_luxury", length: 4.9 },
  { name: "kenney_van", length: 5.1 },
  { name: "kenney_race_future", length: 4.6 },
  { name: "kenney_delivery_truck", length: 6.2 },
  { name: "challenger", length: 5 },
];
const PARK_OFFSET = 6.3;

/** Xe đậu sát lề đường, có va chạm */
function ParkedCars({ count }: { count: number }) {
  const groups = useMemo(() => {
    const rand = mulberry32(1331);
    const byName = new Map<string, THREE.Matrix4[]>();
    let tries = 0;
    let made = 0;
    while (made < count && tries++ < count * 20) {
      const street = STREETS[Math.floor(rand() * STREETS.length)];
      const along = (rand() - 0.5) * CITY_HALF * 1.8;
      // Không đậu giữa ngã tư
      if (STREETS.some((s) => Math.abs(s - along) < 13)) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const alongX = rand() < 0.5;
      const x = alongX ? along : street + side * PARK_OFFSET;
      const z = alongX ? street + side * PARK_OFFSET : along;
      if (!clear(x, z) || Math.hypot(x - PLAYER.spawn[0], z - PLAYER.spawn[2]) < 14) continue;
      const yaw = (alongX ? Math.PI / 2 : 0) + (rand() < 0.5 ? Math.PI : 0);
      const model = CAR_MODELS[Math.floor(rand() * CAR_MODELS.length)];
      const list = byName.get(model.name) ?? [];
      list.push(place(x, 0, z, yaw));
      byName.set(model.name, list);
      made++;
    }
    return CAR_MODELS.filter((m) => byName.has(m.name)).map((m) => ({ ...m, matrices: byName.get(m.name)! }));
  }, [count]);
  return (
    <>
      {groups.map((g) => (
        <SetInstances key={g.name} file="cars" name={g.name} size={g.length} by="longest" matrices={g.matrices} colliders />
      ))}
    </>
  );
}

/** Xe chạy trên đường: chạy dọc làn, dừng khi có người/xe chắn phía trước, vòng lại ở rìa thành phố */
function Traffic({ count }: { count: number }) {
  const lanes = useMemo(() => {
    const rand = mulberry32(4242);
    return Array.from({ length: count }, (_, i) => ({
      model: CAR_MODELS[i % (CAR_MODELS.length - 1)].name,
      alongX: i % 2 === 0,
      street: STREETS[1 + Math.floor(rand() * (STREETS.length - 2))],
      dir: rand() < 0.5 ? -1 : 1,
      pos: (rand() - 0.5) * CITY_HALF * 2,
      speed: 8 + rand() * 5,
    }));
  }, [count]);
  return (
    <>
      {CAR_MODELS.slice(0, -1).map((m) => {
        const mine = lanes.filter((l) => l.model === m.name);
        return mine.length ? <TrafficGroup key={m.name} name={m.name} length={m.length} lanes={mine} /> : null;
      })}
    </>
  );
}

type Lane = { alongX: boolean; street: number; dir: number; pos: number; speed: number };

function TrafficGroup({ name, length, lanes }: { name: string; length: number; lanes: Lane[] }) {
  const { parts } = useSetParts("cars", name, length, "longest");
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const out = useMemo(() => new THREE.Matrix4(), []);
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    const g = useGame.getState();
    const car = g.mode === "drive" && g.carId !== null ? handles.cars.get(g.carId) : null;
    const who = car?.currPos ?? handles.player?.currPos;
    lanes.forEach((l, i) => {
      const lane = l.street - l.dir * 2.6; // đi bên phải đường
      const x = l.alongX ? l.pos : lane;
      const z = l.alongX ? lane : l.pos;
      // Dừng nếu người chơi ở ngay phía trước trong làn
      let blocked = false;
      if (who) {
        const ahead = ((l.alongX ? who.x - x : who.z - z) * l.dir);
        const sideways = Math.abs(l.alongX ? who.z - z : who.x - x);
        blocked = ahead > 0 && ahead < 9 && sideways < 2.4;
      }
      if (!blocked) l.pos += l.dir * l.speed * step;
      const lim = CITY_HALF + 20;
      if (l.pos > lim) l.pos = -lim;
      if (l.pos < -lim) l.pos = lim;
      const yaw = l.alongX ? (l.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : l.dir > 0 ? 0 : Math.PI;
      m.copy(place(x, 0, z, yaw));
      parts.forEach((part, pi) => refs.current[pi]?.setMatrixAt(i, out.multiplyMatrices(m, part.matrix)));
    });
    for (const r of refs.current) if (r) r.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      {parts.map((part, i) => (
        <instancedMesh key={i} ref={(r) => void (refs.current[i] = r)} args={[part.geometry, part.material, lanes.length]} frustumCulled={false} />
      ))}
    </>
  );
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
      <Suspense fallback={null}>
        <Crowd count={high ? 34 : 14} />
      </Suspense>
      <Suspense fallback={null}>
        <Robots count={high ? 5 : 2} />
      </Suspense>
      <Suspense fallback={null}>
        <Traffic count={high ? 10 : 5} />
      </Suspense>
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

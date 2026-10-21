import { use, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeParts } from "./mergeParts";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { models } from "./assets";
import { BUILDINGS, buildingTier, type Building } from "./City";
import { BLOCK_CENTERS, CITY, CITY_HALF, CITY_PITCH, mulberry32 } from "./config";
import { NPCS, VAULT_DOOR } from "./story";
import { SHOP_POS } from "./Shop";
import { useGame } from "./store";

// Dựng phố bằng bộ model Polygonal Mind (CC0): mặt tiền phố Nhật, biển hiệu neon, đèn đường,
// máy bán hàng, tàu bay. Mọi thứ đều instancing: mỗi lưới của model là một InstancedMesh.

type KitName = string;

/** Đồ trang trí mặt tiền chỉ gắn vào nhà khối hộp; nhà dựng bằng model Meshy đã có chi tiết riêng */
const BOX_BUILDINGS = BUILDINGS.filter((b) => !b.model);

/** Lấy scene của một model trong kit theo tên */
function useKitScene(name: KitName) {
  const gltf = use(models.kit);
  return useMemo(() => {
    const scene = gltf.scenes.find((s) => s.children[0]?.name === name);
    if (!scene) throw new Error(`Không tìm thấy model ${name} trong kit`);
    scene.updateMatrixWorld(true);
    return scene;
  }, [gltf, name]);
}

/** Các lưới (geometry, material, ma trận tương đối) của một model */
function useKitParts(name: KitName) {
  const scene = useKitScene(name);
  return useMemo(() => {
    const parts: { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      let material = mesh.material as THREE.Material;
      const std = material as THREE.MeshStandardMaterial;
      if (std.name === "Aero_Light_Mat") {
        // Chùm sáng của đèn đường: trong suốt, cộng sáng nhẹ, không che tầm nhìn
        material = new THREE.MeshBasicMaterial({
          map: std.map ?? std.emissiveMap ?? null,
          color: "#b9a6ff",
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      } else if (std.emissiveMap || std.emissive?.getHex()) {
        // Đèn neon trong kit sáng hơn để bloom bắt được
        std.emissiveIntensity = Math.max(std.emissiveIntensity, 2.2);
      }
      parts.push({ geometry: mesh.geometry, material, matrix: mesh.matrixWorld.clone() });
    });
    return mergeParts(parts);
  }, [scene]);
}

/** Vẽ một model tại nhiều vị trí bằng InstancedMesh */
export function KitInstances({ name, matrices }: { name: KitName; matrices: THREE.Matrix4[] }) {
  // Nhóm đông được chia theo 4 góc phần tư thành phố: phần nằm sau lưng camera bị loại khỏi lượt vẽ
  const chunks = useMemo(() => {
    if (matrices.length < 40) return [matrices];
    const out: THREE.Matrix4[][] = [[], [], [], []];
    const p = new THREE.Vector3();
    for (const m of matrices) {
      p.setFromMatrixPosition(m);
      out[(p.x >= 0 ? 1 : 0) + (p.z >= 0 ? 2 : 0)].push(m);
    }
    return out.filter((c) => c.length > 0);
  }, [matrices]);
  return (
    <>
      {chunks.map((c, i) => (
        <KitChunk key={i} name={name} matrices={c} cull={chunks.length > 1} />
      ))}
    </>
  );
}

function KitChunk({ name, matrices, cull }: { name: KitName; matrices: THREE.Matrix4[]; cull: boolean }) {
  const parts = useKitParts(name);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    parts.forEach((part, pi) => {
      const mesh = refs.current[pi];
      if (!mesh) return;
      matrices.forEach((t, i) => mesh.setMatrixAt(i, m.multiplyMatrices(t, part.matrix)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [parts, matrices]);
  if (matrices.length === 0) return null;
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh
          key={i}
          ref={(r) => void (refs.current[i] = r)}
          args={[p.geometry, p.material, matrices.length]}
          frustumCulled={cull}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tiện ích đặt vật theo mặt tường

type Face = { b: Building; n: [number, number]; width: number; cx: number; cz: number; tx: number; tz: number };

/** Bốn mặt tường của mỗi toà nhà, kèm pháp tuyến hướng ra ngoài và trục dọc mặt tường */
function faces(list: Building[]): Face[] {
  const out: Face[] = [];
  for (const b of list) {
    out.push({ b, n: [0, 1], width: b.w, cx: b.x, cz: b.z + b.d / 2, tx: 1, tz: 0 });
    out.push({ b, n: [0, -1], width: b.w, cx: b.x, cz: b.z - b.d / 2, tx: -1, tz: 0 });
    out.push({ b, n: [1, 0], width: b.d, cx: b.x + b.w / 2, cz: b.z, tx: 0, tz: -1 });
    out.push({ b, n: [-1, 0], width: b.d, cx: b.x - b.w / 2, cz: b.z, tx: 0, tz: 1 });
  }
  return out;
}

const _q = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);

function place(x: number, y: number, z: number, yaw: number, scale = 1) {
  _q.setFromAxisAngle(_y, yaw);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), new THREE.Vector3(scale, scale, scale));
}

/** Góc xoay để trục +Z của model hướng theo pháp tuyến n */
const yawZ = (n: [number, number]) => Math.atan2(n[0], n[1]);

/** Có đè lên chỗ dành riêng (quầy, NPC, cửa vault) không */
const RESERVED: [number, number][] = [
  [SHOP_POS.x, SHOP_POS.z],
  [VAULT_DOOR[0], VAULT_DOOR[2]],
  ...Object.values(NPCS)
    .filter((n) => !n.inVault)
    .map((n) => [n.pos[0], n.pos[2]] as [number, number]),
];
const nearReserved = (x: number, z: number, r: number) => RESERVED.some(([rx, rz]) => Math.hypot(rx - x, rz - z) < r);

// ---------------------------------------------------------------------------
// Mặt tiền tầng trệt và mái hiên

const MODULE_W = 2.27;
const STOREFRONTS = ["Wall_Module_01", "Wall_Module_02", "Wall_Module_03"];
const AWNINGS = ["Wall_Module_06", "Wall_Module_04"];

function Storefronts() {
  const groups = useMemo(() => {
    const rand = mulberry32(31);
    const fronts: Record<string, THREE.Matrix4[]> = Object.fromEntries(STOREFRONTS.map((k) => [k, []]));
    const awnings: Record<string, THREE.Matrix4[]> = Object.fromEntries(AWNINGS.map((k) => [k, []]));
    for (const f of faces(BOX_BUILDINGS)) {
      const count = Math.floor((f.width - 0.4) / MODULE_W);
      const start = -((count - 1) * MODULE_W) / 2;
      const yaw = yawZ(f.n);
      for (let i = 0; i < count; i++) {
        const t = start + i * MODULE_W;
        const x = f.cx + f.tx * t;
        const z = f.cz + f.tz * t;
        if (nearReserved(x, z, 1.8)) continue;
        const kind = STOREFRONTS[Math.floor(rand() * STOREFRONTS.length)];
        // Đáy module ở y = -0.26 trong model: nâng lên để chạm mặt vỉa hè
        fronts[kind].push(place(x, CITY.SIDEWALK_HEIGHT + 0.26, z, yaw));
        if (rand() < 0.45) {
          const a = AWNINGS[Math.floor(rand() * AWNINGS.length)];
          awnings[a].push(place(x, CITY.SIDEWALK_HEIGHT + 4.35, z, yaw));
        }
      }
    }
    return { fronts, awnings };
  }, []);
  return (
    <>
      {Object.entries(groups.fronts).map(([k, m]) => (
        <KitInstances key={k} name={k} matrices={m} />
      ))}
      {Object.entries(groups.awnings).map(([k, m]) => (
        <KitInstances key={k} name={k} matrices={m} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Biển hiệu neon phố Nhật chìa ra từ tường

/** Hướng chìa ra của từng biển trong model: "-x", "+x" (biển dạng lá cờ) hoặc "z" (áp phẳng vào tường) */
const SIGNS: Record<string, "-x" | "+x" | "z"> = {
  Japanese_Sign_01: "-x",
  Japanese_Sign_02: "-x",
  Japanese_Sign_03: "z",
  Japanese_Sign_04: "z",
  Japanese_Sign_05: "-x",
  Japanese_Sign_06: "+x",
  Japanese_Sign_07: "+x",
  Japanese_Sign_08: "+x",
  Japanese_Sign_09: "+x",
  Japanese_Sign_10: "+x",
  Japanese_Sign_11: "z",
  Japanese_Sign_12: "-x",
  Japanese_Sign_13: "+x",
  Japanese_Sign_14: "-x",
  Japanese_Sign_15: "-x",
  Japanese_Sign_16: "-x",
};

const SIGN_SCALE = 2.3;

function NeonSigns() {
  const groups = useMemo(() => {
    const rand = mulberry32(77);
    const names = Object.keys(SIGNS);
    const out: Record<string, THREE.Matrix4[]> = Object.fromEntries(names.map((k) => [k, []]));
    for (const f of faces(BOX_BUILDINGS)) {
      const n = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const name = names[Math.floor(rand() * names.length)];
        const t = (rand() - 0.5) * (f.width - 2);
        const y = 5.2 + rand() * Math.min(10, f.b.h - 7);
        const x = f.cx + f.tx * t + f.n[0] * 0.05;
        const z = f.cz + f.tz * t + f.n[1] * 0.05;
        const mode = SIGNS[name];
        // Biển lá cờ: trục ±X của model hướng ra ngoài tường; biển phẳng: trục +Z hướng ra ngoài
        const yaw =
          mode === "z"
            ? yawZ(f.n)
            : mode === "-x"
              ? Math.atan2(f.n[1], -f.n[0])
              : Math.atan2(-f.n[1], f.n[0]);
        out[name].push(place(x, CITY.SIDEWALK_HEIGHT + y, z, yaw, SIGN_SCALE));
      }
    }
    return out;
  }, []);
  return (
    <>
      {Object.entries(groups).map(([k, m]) => (
        <KitInstances key={k} name={k} matrices={m} />
      ))}
    </>
  );
}

/** Biển quảng cáo neon cỡ lớn gắn ở góc các toà cao */
function BigAds() {
  const groups = useMemo(() => {
    const rand = mulberry32(91);
    const names = ["Ad01_Art", "Ad02_Art", "Ad03_Art", "Ad04_Art"];
    const out: Record<string, THREE.Matrix4[]> = Object.fromEntries(names.map((k) => [k, []]));
    for (const f of faces(BOX_BUILDINGS.filter((b) => b.h > 25))) {
      if (rand() > 0.35) continue;
      const name = names[Math.floor(rand() * names.length)];
      // Mép trái của mặt tường, cao giữa thân nhà; quảng cáo chìa ra theo trục +Z của model
      const t = (f.width / 2 - 0.3) * (rand() < 0.5 ? -1 : 1);
      const x = f.cx + f.tx * t;
      const z = f.cz + f.tz * t;
      out[name].push(place(x, 12 + rand() * (f.b.h - 22), z, yawZ(f.n), 1.4));
    }
    return out;
  }, []);
  return (
    <>
      {Object.entries(groups).map(([k, m]) => (
        <KitInstances key={k} name={k} matrices={m} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Đèn đường, máy bán hàng, tủ điện, cột điện trên vỉa hè

/** Điểm dọc mép vỉa hè, kèm pháp tuyến hướng ra lòng đường */
function curbSpots(seed: number, perEdge: number, inset: number) {
  const rand = mulberry32(seed);
  const spots: { x: number; z: number; n: [number, number] }[] = [];
  const edge = CITY.BLOCK / 2 - inset;
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const edges: [number, number, [number, number], number, number][] = [
        [bx, bz + edge, [0, 1], 1, 0],
        [bx, bz - edge, [0, -1], 1, 0],
        [bx + edge, bz, [1, 0], 0, 1],
        [bx - edge, bz, [-1, 0], 0, 1],
      ];
      for (const [ex, ez, n, tx, tz] of edges) {
        for (let i = 0; i < perEdge; i++) {
          const t = ((i + 0.5) / perEdge - 0.5) * CITY.BLOCK * 0.86 + (rand() - 0.5) * 2;
          spots.push({ x: ex + tx * t, z: ez + tz * t, n });
        }
      }
    }
  }
  return spots;
}

const blockedByBuilding = (x: number, z: number, pad: number) =>
  BUILDINGS.some((b) => Math.abs(b.x - x) < b.w / 2 + pad && Math.abs(b.z - z) < b.d / 2 + pad);

function StreetFurniture() {
  const data = useMemo(() => {
    const lamps = curbSpots(5, 2, 0.5)
      .filter((s) => !nearReserved(s.x, s.z, 2.5))
      .map((s) => place(s.x, CITY.SIDEWALK_HEIGHT, s.z, yawZ(s.n), 0.62));

    const rand = mulberry32(9);
    const vend: THREE.Matrix4[] = [];
    const boxes: THREE.Matrix4[] = [];
    const posts: THREE.Matrix4[] = [];
    const colliders: { x: number; z: number; hx: number; hz: number }[] = [];
    for (const s of curbSpots(12, 3, 2.2)) {
      if (nearReserved(s.x, s.z, 3) || blockedByBuilding(s.x, s.z, 1.2)) continue;
      const r = rand();
      // Đặt sát tường, mặt trước quay ra đường
      if (r < 0.22) {
        vend.push(place(s.x, CITY.SIDEWALK_HEIGHT, s.z, yawZ(s.n)));
        colliders.push({ x: s.x, z: s.z, hx: 0.8, hz: 0.8 });
      } else if (r < 0.36) {
        boxes.push(place(s.x, CITY.SIDEWALK_HEIGHT, s.z, yawZ(s.n), 0.9));
        colliders.push({ x: s.x, z: s.z, hx: 0.9, hz: 0.6 });
      } else if (r < 0.46) {
        posts.push(place(s.x + s.n[0] * 1.2, CITY.SIDEWALK_HEIGHT, s.z + s.n[1] * 1.2, yawZ(s.n), 0.9));
      }
    }
    return { lamps, vend, boxes, posts, colliders };
  }, []);

  return (
    <>
      <KitInstances name="Aero_Lampost_01" matrices={data.lamps} />
      <KitInstances name="PoapMachine" matrices={data.vend} />
      <KitInstances name="ElectricBox01_Art" matrices={data.boxes} />
      <KitInstances name="ElectricPost02_Art" matrices={data.posts} />
      <RigidBody type="fixed" colliders={false}>
        {data.colliders.map((c, i) => (
          <CuboidCollider key={i} args={[c.hx, 1.1, c.hz]} position={[c.x, CITY.SIDEWALK_HEIGHT + 1.1, c.z]} />
        ))}
      </RigidBody>
    </>
  );
}

/** Miếu nhỏ và biển cảnh báo quanh cửa Server Vault ở The Undergrid */
function UndergridDressing() {
  const [dx, , dz] = VAULT_DOOR;
  const shrines = useMemo(() => [place(dx + 0.6, CITY.SIDEWALK_HEIGHT, dz + 4.2, Math.PI / 2, 0.9)], [dx, dz]);
  const warnings = useMemo(
    () => [
      place(dx + 0.4, CITY.SIDEWALK_HEIGHT + 1.6, dz - 2.2, Math.PI / 2, 1.4),
      place(dx + 0.4, CITY.SIDEWALK_HEIGHT + 1.6, dz + 2.2, Math.PI / 2, 1.4),
    ],
    [dx, dz],
  );
  const gate = useMemo(() => [place(dx + 0.2, CITY.SIDEWALK_HEIGHT, dz, Math.PI / 2, 0.19)], [dx, dz]);
  return (
    <>
      <KitInstances name="Shrine_Art" matrices={shrines} />
      <KitInstances name="WarningSign01_Art" matrices={warnings.slice(0, 1)} />
      <KitInstances name="WarningSign02_Art" matrices={warnings.slice(1)} />
      <KitInstances name="Aero_Door_01" matrices={gate} />
    </>
  );
}

/** Tháp ga sci-fi làm điểm mốc trên đường chân trời */
function Landmarks() {
  const towers = useMemo(
    () => [
      place(CITY_HALF + 70, 0, -40, 0.4, 2.2),
      place(-CITY_HALF - 80, 0, 60, -1.2, 2.6),
      place(30, 0, CITY_HALF + 90, 2.4, 2),
    ],
    [],
  );
  return <KitInstances name="Aero_Station_01_Art" matrices={towers} />;
}

/** Tàu bay chở khách chạy theo làn trên cao, thay cho khối hộp phát sáng cũ */
export function Airships({ count = 18 }) {
  const parts = useKitParts("Aero_Airship_01");
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const ships = useMemo(() => {
    const rand = mulberry32(12);
    return Array.from({ length: count }, (_, i) => ({
      axis: i % 2,
      lane: (rand() - 0.5) * CITY_HALF * 1.8,
      height: 34 + Math.floor(rand() * 3) * 10,
      offset: rand() * CITY_HALF * 4,
      speed: (rand() < 0.5 ? -1 : 1) * (10 + rand() * 10),
    }));
  }, [count]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const out = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const span = CITY_HALF * 4;
    ships.forEach((s, i) => {
      const d = ((((s.offset + s.speed * t) % span) + span) % span) - span / 2;
      const yaw = s.axis === 0 ? (s.speed > 0 ? Math.PI / 2 : -Math.PI / 2) : s.speed > 0 ? 0 : Math.PI;
      const bob = Math.sin(t * 0.8 + i) * 0.6;
      const p = s.axis === 0 ? [d, s.height + bob, s.lane] : [s.lane, s.height + bob, d];
      m.copy(place(p[0], p[1], p[2], yaw, 0.28));
      parts.forEach((part, pi) => {
        refs.current[pi]?.setMatrixAt(i, out.multiplyMatrices(m, part.matrix));
      });
    });
    for (const r of refs.current) if (r) r.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh
          key={i}
          ref={(r) => void (refs.current[i] = r)}
          args={[p.geometry, p.material, count]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}


// ---------------------------------------------------------------------------
// Nóc nhà: module mái, pin mặt trời, bãi đáp, tuabin, đèn tín hiệu (KayKit Space Base, CC0)

/** Đồ trên mái và tỉ lệ phóng to (KayKit dùng đơn vị nhỏ) */
const ROOF_PROPS: [string, number][] = [
  ["roofmodule_solarpanels", 4.5],
  ["roofmodule_cargo_A", 4.5],
  ["roofmodule_cargo_B", 4.5],
  ["roofmodule_base", 4.5],
  ["structure_low", 3.6],
  ["windturbine_low", 3.4],
  ["lights", 3.2],
  ["solarpanel", 4],
  ["cargo_A_stacked", 2.6],
];

function RoofTops() {
  const groups = useMemo(() => {
    const rand = mulberry32(404);
    const out: Record<string, THREE.Matrix4[]> = Object.fromEntries(
      [...ROOF_PROPS.map(([n]) => n), "landingpad_small", "ElectricBox01_Art"].map((k) => [k, []]),
    );
    for (const b of BOX_BUILDINGS) {
      const top = CITY.SIDEWALK_HEIGHT + b.h;
      const tier = buildingTier(b);
      // Toà thấp, không có tầng trên: có thể làm bãi đáp xe bay
      if (!tier && b.h < 40 && rand() < 0.3) {
        out.landingpad_small.push(place(b.x, top, b.z, 0, Math.min(b.w, b.d) / 2.4));
        continue;
      }
      const n = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const [name, scale] = ROOF_PROPS[Math.floor(rand() * ROOF_PROPS.length)];
        const x = b.x + (rand() - 0.5) * (b.w - 4);
        const z = b.z + (rand() - 0.5) * (b.d - 4);
        // Không đặt chồng lên tầng trên
        if (tier && Math.abs(x - tier.x) < tier.w / 2 + 2 && Math.abs(z - tier.z) < tier.d / 2 + 2) continue;
        out[name].push(place(x, top, z, Math.floor(rand() * 4) * (Math.PI / 2), scale));
      }
      if (rand() < 0.5) out.ElectricBox01_Art.push(place(b.x + b.w / 2 - 1.5, top, b.z + b.d / 2 - 1.5, rand() * 6, 1.2));
    }
    return out;
  }, []);
  return (
    <>
      {Object.entries(groups).map(([k, m]) => (
        <KitInstances key={k} name={k} matrices={m} />
      ))}
    </>
  );
}

/** Ban công và hộp cửa sổ rải trên các tầng phía trên tầng trệt */
function UpperFloors() {
  const groups = useMemo(() => {
    const rand = mulberry32(606);
    const names = ["Wall_Module_05", "Wall_Module_07", "Wall_Module_04"];
    const out: Record<string, THREE.Matrix4[]> = Object.fromEntries(names.map((k) => [k, []]));
    for (const f of faces(BOX_BUILDINGS)) {
      const cols = Math.floor((f.width - 0.4) / MODULE_W);
      const floors = Math.floor((f.b.h - 9) / 3);
      for (let c = 0; c < cols; c++) {
        // Một số cột có dãy ban công chạy dọc vài tầng liền
        if (rand() > 0.22) continue;
        const name = names[Math.floor(rand() * names.length)];
        const start = Math.floor(rand() * Math.max(1, floors - 3));
        const run = 2 + Math.floor(rand() * 4);
        const t = -((cols - 1) * MODULE_W) / 2 + c * MODULE_W;
        for (let k = start; k < Math.min(floors, start + run); k++) {
          const y = CITY.SIDEWALK_HEIGHT + 8.6 + k * 3;
          out[name].push(place(f.cx + f.tx * t, y, f.cz + f.tz * t, yawZ(f.n)));
        }
      }
    }
    return out;
  }, []);
  return (
    <>
      {Object.entries(groups).map(([k, m]) => (
        <KitInstances key={k} name={k} matrices={m} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Monorail treo chạy dọc phố x = CITY_PITCH (ranh Neon Bazaar / Chrome Arena)

const RAIL_X = CITY_PITCH;
const RAIL_Y = 15;
const RAIL_SEG = 16;

function Monorail() {
  const track = useMemo(() => {
    const segs: THREE.Matrix4[] = [];
    for (let z = -CITY_HALF; z <= CITY_HALF; z += RAIL_SEG) segs.push(place(RAIL_X, RAIL_Y, z, 0));
    return segs;
  }, []);
  const pillars = useMemo(() => {
    const out: number[] = [];
    // Cột đỡ đặt giữa các ngã tư, tránh lòng đường giao nhau
    for (let z = -CITY_HALF + RAIL_SEG; z < CITY_HALF; z += RAIL_SEG * 2) {
      if (BLOCK_CENTERS.some((c) => Math.abs(c - z) < CITY.BLOCK / 2 - 4)) out.push(z);
    }
    return out;
  }, []);
  const pillarMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1824", metalness: 0.8, roughness: 0.35 }), []);
  return (
    <>
      <KitInstances name="Train_Track_01" matrices={track} />
      {pillars.map((z) => (
        <mesh key={z} position={[RAIL_X, RAIL_Y / 2, z]} material={pillarMat}>
          <cylinderGeometry args={[0.55, 0.75, RAIL_Y, 12]} />
        </mesh>
      ))}
      <RigidBody type="fixed" colliders={false}>
        {pillars.map((z) => (
          <CuboidCollider key={z} args={[0.7, RAIL_Y / 2, 0.7]} position={[RAIL_X, RAIL_Y / 2, z]} />
        ))}
      </RigidBody>
      <Trains />
    </>
  );
}

/** Hai đoàn tàu chạy ngược chiều: một chạy trên ray, một treo dưới ray */
function Trains() {
  const top = useKitParts("Train_01_Art");
  const hang = useKitParts("Train_02_Art");
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const parts = useMemo(() => [...top.map((p) => ({ ...p, kind: 0 })), ...hang.map((p) => ({ ...p, kind: 1 }))], [top, hang]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const out = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    const span = CITY_HALF * 2;
    const t = clock.elapsedTime;
    parts.forEach((part, pi) => {
      const mesh = refs.current[pi];
      if (!mesh) return;
      for (let car = 0; car < 3; car++) {
        // Đoàn 3 toa, mỗi toa dài 16.6m
        const base = part.kind === 0 ? t * 14 : -t * 11 + span / 2;
        const z = ((((base - car * 17) % span) + span) % span) - CITY_HALF;
        m.copy(place(RAIL_X, RAIL_Y + (part.kind === 0 ? 1.1 : 0), z, part.kind === 0 ? 0 : Math.PI, 1));
        mesh.setMatrixAt(car, out.multiplyMatrices(m, part.matrix));
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  });
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh key={i} ref={(r) => void (refs.current[i] = r)} args={[p.geometry, p.material, 3]} frustumCulled={false} />
      ))}
    </>
  );
}

/** Chậu cây neon và màn hình CRT trước cửa hàng */
function SidewalkDecor() {
  const groups = useMemo(() => {
    const rand = mulberry32(321);
    const items: [string, number][] = [
      ["Pot_Vapor_01", 0.55],
      ["Pot_Vapor_02", 0.45],
      ["Pot_Retro_03", 0.35],
      ["Screen_Retro_01", 0.5],
      ["Screen_Retro_02", 0.45],
    ];
    const out: Record<string, THREE.Matrix4[]> = Object.fromEntries(items.map(([k]) => [k, []]));
    for (const sp of curbSpots(77, 3, 3.4)) {
      if (rand() > 0.45 || nearReserved(sp.x, sp.z, 3) || blockedByBuilding(sp.x, sp.z, 0.8)) continue;
      const [name, scale] = items[Math.floor(rand() * items.length)];
      out[name].push(place(sp.x, CITY.SIDEWALK_HEIGHT, sp.z, yawZ(sp.n), scale));
    }
    return out;
  }, []);
  return (
    <>
      {Object.entries(groups).map(([k, m]) => (
        <KitInstances key={k} name={k} matrices={m} />
      ))}
    </>
  );
}

/** Toàn bộ lớp trang trí bằng kit; chế độ đồ hoạ Thấp bỏ bớt đồ phụ */
export function KitDressing() {
  const high = useGame((s) => s.quality === "high");
  return (
    <>
      <Storefronts />
      {high && <UpperFloors />}
      {high && <RoofTops />}
      <Monorail />
      {high && <SidewalkDecor />}
      <NeonSigns />
      <BigAds />
      <StreetFurniture />
      <UndergridDressing />
      <Landmarks />
      <Airships />
    </>
  );
}

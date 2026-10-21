import { Suspense, use, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { MeshReflectorMaterial } from "@react-three/drei";
import { useGame } from "./store";
import { extraModel } from "./assets";
import { mergeParts, type Part } from "./mergeParts";
import {
  BLOCK_CENTERS,
  BOARD_SPOT,
  CITY,
  CITY_HALF,
  CITY_PITCH,
  DISTRICTS,
  NEON_COLORS,
  districtIdAt,
  PALETTE,
  mulberry32,
} from "./config";
import { NPCS, VAULT_DOOR } from "./story";
import { SIGN_COUNT, makeLaneTexture, makeRoadTexture, makeFacadeTextures } from "./textures";

export type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  variant: number;
  /** Hướng mặt tiền nhìn ra đường gần nhất: [nx, nz] */
  face: [number, number];
  neon: string | null;
  sign: number | null;
  /** Toà nhà dựng bằng model Meshy thay cho khối hộp; khi đó w/d/h là kích thước thật của model */
  model?: BuildingModel;
  /** Hệ số phóng đều theo XZ và hệ số kéo thêm theo chiều cao */
  scale?: [number, number];
  yaw?: number;
};

/** Kích thước chuẩn hoá (x, y, z) của các model nhà Meshy, đo sẵn từ file (mặt tiền hướng +Z) */
export const BUILDING_MODELS = {
  mx_bld_apartment: [1.61, 1.9, 1.54],
  mx_bld_clinic: [1.72, 1.1, 1.9],
  mx_bld_factory: [1.86, 1.82, 1.84],
  mx_bld_hotel: [1.89, 1.36, 1.85],
  mx_bld_nightclub: [1.9, 0.74, 1.36],
  mx_bld_pagoda: [0.88, 1.9, 0.88],
  mx_bld_shoprow: [1.9, 1.32, 1.9],
  mx_bld_skyscraper: [0.44, 1.9, 0.49],
  mx_bld_tower_round: [1.04, 1.9, 1.04],
  mx_bld_megacorp: [0.96, 1.9, 1.0],
  mx_bld_noodle_bar: [1.88, 1.32, 1.9],
  mx_bld_capsule_hotel: [0.88, 1.9, 0.9],
  mx_bld_police_station: [1.9, 1.11, 1.9],
} as const;
export type BuildingModel = keyof typeof BUILDING_MODELS;
const MODEL_LIMIT: Partial<Record<BuildingModel, number>> = { mx_bld_pagoda: 3, mx_bld_factory: 4, mx_bld_megacorp: 3, mx_bld_noodle_bar: 3, mx_bld_police_station: 3 };

const WINDOW_VARIANTS = 4;

/** Vùng không được xây: [x, z, bán kính] */
const RESERVED: [number, number, number][] = [
  [10.2, 13, 3.2], // quầy Neon Bazaar
  ...Object.values(NPCS)
    .filter((n) => !n.inVault)
    .map((n) => [n.pos[0], n.pos[2], 2.5] as [number, number, number]),
  [VAULT_DOOR[0], VAULT_DOOR[2], 4],
  [BOARD_SPOT.x, BOARD_SPOT.z, 2.8], // bảng hợp đồng
];

function generateBuildings(): Building[] {
  const rand = mulberry32(2077);
  const list: Building[] = [];
  const lot = CITY.BLOCK / 2;
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      for (const [ox, oz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const w = 12 + rand() * 5;
        const d = 12 + rand() * 5;
        const central = Math.hypot(bx, bz) < CITY_PITCH;
        const h = central ? 30 + rand() * 70 : 12 + rand() * 45;
        // Lùi vào trong lô một chút, chừa vỉa hè
        let x = bx + ox * (lot / 2) + ox * (lot - w) * 0.25 * rand();
        let z = bz + oz * (lot / 2) + oz * (lot - d) * 0.25 * rand();
        const faceX = rand() < 0.5;
        // Toà nhà lấn vào chỗ dành cho NPC, quầy hàng, cửa vault thì co lại và lùi về tâm block
        let bw = w;
        let bd = d;
        for (const [rx, rz, rr] of RESERVED) {
          for (let k = 0; k < 14 && Math.abs(rx - x) < bw / 2 + rr && Math.abs(rz - z) < bd / 2 + rr; k++) {
            bw -= 1;
            bd -= 1;
            x += (bx - x) * 0.1;
            z += (bz - z) * 0.1;
          }
        }
        const palette = DISTRICTS[districtIdAt(bx, bz)].neon;
        list.push({
          x,
          z,
          w: bw,
          d: bd,
          h,
          variant: Math.floor(rand() * WINDOW_VARIANTS),
          face: faceX ? [ox, 0] : [0, oz],
          neon: rand() < 0.7 ? palette[Math.floor(rand() * palette.length)] : null,
          sign: rand() < 0.65 ? Math.floor(rand() * SIGN_COUNT * 4) : null,
        });
      }
    }
  }
  return list;
}

/** Thay khoảng 40% khối hộp bằng nhà cyberpunk Meshy: chọn model có tỉ lệ cao/rộng gần nhất,
 * thu phóng cho vừa lô đất rồi cập nhật lại kích thước để va chạm và minimap khớp với model */
function assignModels(list: Building[]) {
  const rand = mulberry32(5150);
  const used: Partial<Record<BuildingModel, number>> = {};
  const names = Object.keys(BUILDING_MODELS) as BuildingModel[];
  for (const b of list) {
    if (rand() > 0.5) continue;
    // Mặt tiền (+Z của model) quay ra đường
    const yaw = Math.atan2(b.face[0], b.face[1]);
    const side = b.face[0] !== 0;
    const fits = names
      .filter((n) => (used[n] ?? 0) < (MODEL_LIMIT[n] ?? Infinity))
      .map((n) => {
        const [mx, my, mz] = BUILDING_MODELS[n];
        const ex = side ? mz : mx;
        const ez = side ? mx : mz;
        const s = Math.min(b.w / ex, b.d / ez);
        const natural = my * s;
        return { n, ex, ez, s, natural, err: Math.abs(Math.log(b.h / natural)) };
      })
      .sort((a, c) => a.err - c.err);
    const pick = fits[rand() < 0.65 ? 0 : Math.min(1, fits.length - 1)];
    if (!pick) continue;
    const sy = Math.min(1.4, Math.max(0.85, b.h / pick.natural));
    used[pick.n] = (used[pick.n] ?? 0) + 1;
    b.model = pick.n;
    b.scale = [pick.s, sy];
    b.yaw = yaw;
    b.w = pick.ex * pick.s;
    b.d = pick.ez * pick.s;
    b.h = pick.natural * sy;
    b.neon = null;
    b.sign = null;
  }
  return list;
}

/** Toà nhà làm phông nền phía xa, ngoài khu chơi được. */
function generateSkyline() {
  const rand = mulberry32(42);
  const list: Building[] = [];
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + rand() * 0.05;
    const r = CITY_HALF + 40 + rand() * 120;
    const s = 18 + rand() * 20;
    list.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      w: s,
      d: s,
      h: 60 + rand() * 160,
      variant: Math.floor(rand() * WINDOW_VARIANTS),
      face: [0, 0],
      neon: rand() < 0.4 ? NEON_COLORS[i % NEON_COLORS.length] : null,
      sign: null,
    });
  }
  return list;
}

/** Hộp có UV co giãn theo kích thước thật, để cửa sổ luôn ~1m x 2m. */
function buildingGeometry(w: number, h: number, d: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const faceWidths = [d, d, 0, 0, w, w]; // +x, -x, +y, -y, +z, -z
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      if (faceWidths[face] === 0) {
        uv.setXY(i, 0.99, 0.99); // mái: rơi vào ô tối
      } else {
        uv.setXY(i, uv.getX(i) * (faceWidths[face] / 12), uv.getY(i) * (h / 24));
      }
    }
  }
  uv.needsUpdate = true;
  geo.translate(0, h / 2, 0);
  return geo;
}

function useWindowMaterials() {
  return useMemo(
    () =>
      Array.from({ length: WINDOW_VARIANTS }, (_, i) => {
        const { map, emissive } = makeFacadeTextures(100 + i);
        // Kính và tường phản chiếu môi trường neon; cửa sổ sáng đèn qua emissiveMap
        return new THREE.MeshStandardMaterial({
          map,
          color: "#ffffff",
          roughness: 0.32,
          metalness: 0.55,
          emissive: "#ffffff",
          emissiveMap: emissive,
          emissiveIntensity: 1.35,
        });
      }),
    [],
  );
}

/** Tầng thu nhỏ trên đỉnh toà cao: lệch về một góc, cao khoảng 1/4 thân nhà */
export function buildingTier(b: Building) {
  if (b.h < 32 || b.model) return null;
  const k = Math.abs(Math.sin(b.x * 12.9898 + b.z * 78.233)) % 1;
  if (k < 0.25) return null;
  const w = b.w * (0.5 + k * 0.2);
  const d = b.d * (0.5 + (1 - k) * 0.2);
  return {
    w,
    d,
    h: b.h * (0.18 + k * 0.15),
    x: b.x + (k < 0.6 ? -1 : 1) * (b.w - w) * 0.35,
    z: b.z + (k < 0.45 || k > 0.8 ? -1 : 1) * (b.d - d) * 0.35,
  };
}

function Buildings({ list, withColliders }: { list: Building[]; withColliders: boolean }) {
  const materials = useWindowMaterials();
  const meshes = useMemo(
    () => list.filter((b) => !b.model).map((b) => ({ b, geo: buildingGeometry(b.w, b.h, b.d) })),
    [list],
  );
  // Nhà dựng bằng model: hộp vô hình để chặn camera, thay cho raycast vào lưới chi tiết
  const blockers = useMemo(() => {
    const boxes = list.filter((b) => b.model).map((b) => buildingGeometry(b.w, b.h, b.d).translate(b.x, CITY.SIDEWALK_HEIGHT, b.z));
    return boxes.length ? mergeGeometries(boxes, false) : null;
  }, [list]);
  // Toà cao có thêm tầng thu nhỏ trên đỉnh để phá dáng hộp
  const tiers = useMemo(
    () =>
      list
        .map((b) => {
          const t = buildingTier(b);
          return t ? { b, t, geo: buildingGeometry(t.w, t.h, t.d) } : null;
        })
        .filter((x) => x !== null),
    [list],
  );
  const base = withColliders ? CITY.SIDEWALK_HEIGHT : 0;
  // Gộp mọi khối nhà cùng vật liệu thành một lưới: từ hàng trăm lệnh vẽ xuống còn vài lệnh
  const merged = useMemo(() => {
    const byVariant: THREE.BufferGeometry[][] = Array.from({ length: WINDOW_VARIANTS }, () => []);
    for (const { b, geo } of meshes) byVariant[b.variant].push(geo.clone().translate(b.x, base, b.z));
    for (const { b, t, geo } of tiers) {
      byVariant[(b.variant + 1) % WINDOW_VARIANTS].push(geo.clone().translate(t.x, base + b.h, t.z));
    }
    return byVariant.map((list) => (list.length ? mergeGeometries(list, false) : null));
  }, [meshes, tiers, base]);
  return (
    <>
      {merged.map((geo, i) =>
        geo ? <mesh key={i} geometry={geo} material={materials[i]} userData={{ cameraCollider: withColliders }} /> : null,
      )}
      {withColliders && blockers && (
        <mesh geometry={blockers} visible={false} userData={{ cameraCollider: true }} />
      )}
      {withColliders && (
        <RigidBody type="fixed" colliders={false}>
          {list.map((b, i) => (
            <CuboidCollider key={i} args={[b.w / 2, b.h / 2, b.d / 2]} position={[b.x, b.h / 2, b.z]} />
          ))}
        </RigidBody>
      )}
    </>
  );
}

/** Viền neon ở bốn cạnh đứng và đường viền mái, gom thành InstancedMesh theo màu. */
function NeonTrim({ list }: { list: Building[] }) {
  const groups = useMemo(() => {
    const byColor = new Map<string, THREE.Matrix4[]>();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const b of list) {
      if (!b.neon) continue;
      const arr = byColor.get(b.neon) ?? [];
      const t = 0.14;
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        arr.push(
          m
            .clone()
            .compose(
              new THREE.Vector3(b.x + (sx * b.w) / 2, b.h / 2, b.z + (sz * b.d) / 2),
              q,
              new THREE.Vector3(t, b.h, t),
            ),
        );
      }
      // viền mái
      const top = b.h + 0.05;
      arr.push(m.clone().compose(new THREE.Vector3(b.x, top, b.z + b.d / 2), q, new THREE.Vector3(b.w, t, t)));
      arr.push(m.clone().compose(new THREE.Vector3(b.x, top, b.z - b.d / 2), q, new THREE.Vector3(b.w, t, t)));
      arr.push(m.clone().compose(new THREE.Vector3(b.x + b.w / 2, top, b.z), q, new THREE.Vector3(t, t, b.d)));
      arr.push(m.clone().compose(new THREE.Vector3(b.x - b.w / 2, top, b.z), q, new THREE.Vector3(t, t, b.d)));
      byColor.set(b.neon, arr);
    }
    return [...byColor.entries()];
  }, [list]);

  return (
    <>
      {groups.map(([color, mats]) => (
        <InstancedBoxes key={color} color={color} intensity={4} matrices={mats} />
      ))}
    </>
  );
}

function InstancedBoxes({
  color,
  intensity,
  matrices,
}: {
  color: string;
  intensity: number;
  matrices: THREE.Matrix4[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(intensity), [color, intensity]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]} frustumCulled={false}>
      <boxGeometry />
      <meshBasicMaterial color={c} toneMapped={false} fog />
    </instancedMesh>
  );
}


function Ground() {
  const size = CITY_HALF * 2 + 600;
  const quality = useGame((s) => s.quality);
  const road = useMemo(() => {
    const t = makeRoadTexture();
    t.repeat.set(size / 12, size / 12);
    return t;
  }, [size]);
  const lane = useMemo(() => {
    const t = makeLaneTexture();
    t.repeat.set(1, (CITY_HALF * 2) / 6);
    return t;
  }, []);
  const streetCenters = useMemo(
    () => Array.from({ length: CITY.GRID + 1 }, (_, i) => (i - CITY.GRID / 2) * CITY_PITCH),
    [],
  );
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[size / 2, 5, size / 2]} position={[0, -5, 0]} />
        {/* Vỉa hè của từng block */}
        {BLOCK_CENTERS.flatMap((bx) =>
          BLOCK_CENTERS.map((bz) => (
            <CuboidCollider
              key={`${bx}:${bz}`}
              args={[CITY.BLOCK / 2, CITY.SIDEWALK_HEIGHT / 2, CITY.BLOCK / 2]}
              position={[bx, CITY.SIDEWALK_HEIGHT / 2, bz]}
            />
          )),
        )}
        {/* Tường vô hình giữ người chơi trong thành phố */}
        {[
          [CITY_HALF + 1, 0],
          [-CITY_HALF - 1, 0],
          [0, CITY_HALF + 1],
          [0, -CITY_HALF - 1],
        ].map(([x, z], i) => (
          <CuboidCollider
            key={i}
            args={x !== 0 ? [1, 30, CITY_HALF + 2] : [CITY_HALF + 2, 30, 1]}
            position={[x, 30, z]}
          />
        ))}
      </RigidBody>

      <mesh rotation-x={-Math.PI / 2} userData={{ cameraCollider: true }}>
        <planeGeometry args={[size, size]} />
        {quality === "high" ? (
          // Mặt đường ướt: phản chiếu neon thật bằng planar reflection, có làm mờ theo độ nhám
          <MeshReflectorMaterial
            map={road}
            color="#8f88a8"
            roughness={0.42}
            metalness={0.5}
            resolution={512}
            blur={[280, 90]}
            mixBlur={1}
            mixStrength={7}
            mixContrast={1.05}
            depthScale={0.8}
            minDepthThreshold={0.3}
            maxDepthThreshold={1.3}
            mirror={0.65}
          />
        ) : (
          <meshStandardMaterial map={road} color="#9a93b0" roughness={0.28} metalness={0.65} />
        )}
      </mesh>

      {streetCenters.flatMap((c) => [
        <mesh key={`x${c}`} rotation-x={-Math.PI / 2} position={[c, 0.01, 0]}>
          <planeGeometry args={[0.6, CITY_HALF * 2]} />
          <meshBasicMaterial map={lane} transparent color="#bbb59a" />
        </mesh>,
        <mesh key={`z${c}`} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.01, c]}>
          <planeGeometry args={[0.6, CITY_HALF * 2]} />
          <meshBasicMaterial map={lane} transparent color="#bbb59a" />
        </mesh>,
      ])}

      {BLOCK_CENTERS.flatMap((bx) =>
        BLOCK_CENTERS.map((bz) => (
          <group key={`${bx}:${bz}`} position={[bx, 0, bz]}>
            <mesh position={[0, CITY.SIDEWALK_HEIGHT / 2, 0]} userData={{ cameraCollider: true }}>
              <boxGeometry args={[CITY.BLOCK, CITY.SIDEWALK_HEIGHT, CITY.BLOCK]} />
              <meshStandardMaterial color={PALETTE.concrete} roughness={0.6} metalness={0.3} />
            </mesh>
          </group>
        )),
      )}
    </>
  );
}


/** Toà nhà trong khu chơi được, dùng chung cho va chạm, tầm nhìn của drone và minimap. */
export const BUILDINGS = assignModels(generateBuildings());

/** Các lưới của một model nhà, chuẩn hoá theo BUILDING_MODELS: tâm XZ ở gốc, đáy ở y = 0 */
function useBuildingParts(name: BuildingModel) {
  const gltf = use(extraModel(name));
  return useMemo(() => {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const dim = box.getSize(new THREE.Vector3());
    const k = BUILDING_MODELS[name][1] / dim.y;
    const c = box.getCenter(new THREE.Vector3());
    const fix = new THREE.Matrix4().makeScale(k, k, k).premultiply(new THREE.Matrix4().makeTranslation(-c.x * k, -box.min.y * k, -c.z * k));
    const parts: Part[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      // Ban đêm: tự sáng nhẹ theo texture để mặt tiền không chìm vào bóng tối
      if (mat.map && !mat.emissiveMap) {
        mat.emissiveMap = mat.map;
        mat.emissive.set("#ffffff");
        mat.emissiveIntensity = 0.35;
      }
      parts.push({ geometry: m.geometry, material: mat, matrix: new THREE.Matrix4().multiplyMatrices(fix, m.matrixWorld) });
    });
    return mergeParts(parts);
  }, [gltf, name]);
}

function ModelBuildingGroup({ name, list }: { name: BuildingModel; list: Building[] }) {
  const parts = useBuildingParts(name);
  const setRef = (pi: number) => (r: THREE.InstancedMesh | null) => {
    if (!r) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    list.forEach((b, i) => {
      const [s, sy] = b.scale!;
      m.compose(new THREE.Vector3(b.x, CITY.SIDEWALK_HEIGHT, b.z), q.setFromAxisAngle(up, b.yaw ?? 0), new THREE.Vector3(s, s * sy, s));
      r.setMatrixAt(i, m.multiply(parts[pi].matrix));
    });
    r.instanceMatrix.needsUpdate = true;
    r.computeBoundingSphere();
  };
  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh key={i} ref={setRef(i)} args={[p.geometry, p.material, list.length]} />
      ))}
    </>
  );
}

/** Nhà cyberpunk dựng bằng model Meshy, mỗi loại model là một nhóm instancing */
function ModelBuildings({ list }: { list: Building[] }) {
  // Chia theo model và góc phần tư thành phố: nhóm nằm sau lưng camera bị loại khỏi lượt vẽ
  const groups = useMemo(() => {
    const out = new Map<string, { name: BuildingModel; list: Building[] }>();
    for (const b of list) {
      if (!b.model) continue;
      const key = `${b.model}:${b.x >= 0 ? 1 : 0}${b.z >= 0 ? 1 : 0}`;
      const g = out.get(key) ?? { name: b.model, list: [] };
      g.list.push(b);
      out.set(key, g);
    }
    return [...out.entries()];
  }, [list]);
  return (
    <>
      {groups.map(([key, g]) => (
        <Suspense key={key} fallback={null}>
          <ModelBuildingGroup name={g.name} list={g.list} />
        </Suspense>
      ))}
    </>
  );
}

export function City() {
  const buildings = BUILDINGS;
  const skyline = useMemo(generateSkyline, []);
  return (
    <>
      <Ground />
      <Buildings list={buildings} withColliders />
      <ModelBuildings list={buildings} />
      <Buildings list={skyline} withColliders={false} />
      <NeonTrim list={buildings.filter((b) => !b.model)} />
      <NeonTrim list={skyline} />
    </>
  );
}

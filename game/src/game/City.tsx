import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  BLOCK_CENTERS,
  CITY,
  CITY_HALF,
  CITY_PITCH,
  NEON_COLORS,
  PALETTE,
  mulberry32,
} from "./config";
import { SIGN_COUNT, makeLaneTexture, makeRoadTexture, makeSignTexture, makeWindowTexture } from "./textures";

type Building = {
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
};

const WINDOW_VARIANTS = 4;

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
        const x = bx + ox * (lot / 2) + ox * (lot - w) * 0.25 * rand();
        const z = bz + oz * (lot / 2) + oz * (lot - d) * 0.25 * rand();
        const faceX = rand() < 0.5;
        list.push({
          x,
          z,
          w,
          d,
          h,
          variant: Math.floor(rand() * WINDOW_VARIANTS),
          face: faceX ? [ox, 0] : [0, oz],
          neon: rand() < 0.7 ? NEON_COLORS[Math.floor(rand() * NEON_COLORS.length)] : null,
          sign: rand() < 0.65 ? Math.floor(rand() * SIGN_COUNT * 4) : null,
        });
      }
    }
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
        uv.setXY(i, uv.getX(i) * (faceWidths[face] / 8), uv.getY(i) * (h / 32));
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
        const map = makeWindowTexture(100 + i);
        return new THREE.MeshStandardMaterial({
          color: "#0f0c18",
          roughness: 0.55,
          metalness: 0.4,
          emissive: "#ffffff",
          emissiveMap: map,
          emissiveIntensity: 1.25,
        });
      }),
    [],
  );
}

function Buildings({ list, withColliders }: { list: Building[]; withColliders: boolean }) {
  const materials = useWindowMaterials();
  const meshes = useMemo(
    () => list.map((b) => ({ b, geo: buildingGeometry(b.w, b.h, b.d) })),
    [list],
  );
  return (
    <>
      {meshes.map(({ b, geo }, i) => (
        <mesh
          key={i}
          geometry={geo}
          material={materials[b.variant]}
          position={[b.x, withColliders ? CITY.SIDEWALK_HEIGHT : 0, b.z]}
          userData={{ cameraCollider: withColliders }}
        />
      ))}
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

function Signs({ list }: { list: Building[] }) {
  const signs = useMemo(() => {
    const rand = mulberry32(99);
    return list
      .filter((b) => b.sign !== null)
      .map((b) => {
        const vertical = rand() < 0.55;
        const idx = b.sign! % SIGN_COUNT;
        const tex = makeSignTexture(idx, vertical);
        const [nx, nz] = b.face;
        const sw = vertical ? 2 : 8;
        const sh = vertical ? 8 : 2;
        const along = (rand() - 0.5) * 0.5;
        const y = 5 + rand() * Math.min(18, b.h - 12);
        const x = nx !== 0 ? b.x + nx * (b.w / 2 + 0.6) : b.x + along * b.w;
        const z = nz !== 0 ? b.z + nz * (b.d / 2 + 0.6) : b.z + along * b.d;
        const rotY = nx !== 0 ? (nx > 0 ? Math.PI / 2 : -Math.PI / 2) : nz > 0 ? 0 : Math.PI;
        return { tex, pos: [x, y, z] as const, rotY, sw, sh };
      });
  }, [list]);
  return (
    <>
      {signs.map((s, i) => (
        <mesh key={i} position={s.pos as unknown as [number, number, number]} rotation={[0, s.rotY, 0]}>
          <planeGeometry args={[s.sw, s.sh]} />
          <meshBasicMaterial map={s.tex} color={[2.2, 2.2, 2.2]} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function Ground() {
  const size = CITY_HALF * 2 + 600;
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

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={road} color="#9a93b0" roughness={0.28} metalness={0.65} />
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
            <mesh position={[0, CITY.SIDEWALK_HEIGHT / 2, 0]}>
              <boxGeometry args={[CITY.BLOCK, CITY.SIDEWALK_HEIGHT, CITY.BLOCK]} />
              <meshStandardMaterial color={PALETTE.concrete} roughness={0.6} metalness={0.3} />
            </mesh>
          </group>
        )),
      )}
    </>
  );
}

/** Đèn đường dọc mép vỉa hè; phần đầu đèn phát sáng để bloom bắt. */
function StreetLights() {
  const { poles, heads } = useMemo(() => {
    const poles: THREE.Matrix4[] = [];
    const heads: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const edge = CITY.BLOCK / 2 - 0.6;
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        for (const t of [-0.75, -0.25, 0.25, 0.75]) {
          for (const [px, pz] of [
            [bx + t * CITY.BLOCK, bz + edge],
            [bx + t * CITY.BLOCK, bz - edge],
            [bx + edge, bz + t * CITY.BLOCK],
            [bx - edge, bz + t * CITY.BLOCK],
          ]) {
            poles.push(new THREE.Matrix4().compose(new THREE.Vector3(px, 3, pz), q, new THREE.Vector3(0.12, 6, 0.12)));
            heads.push(
              new THREE.Matrix4().compose(new THREE.Vector3(px, 6.05, pz), q, new THREE.Vector3(0.5, 0.12, 0.5)),
            );
          }
        }
      }
    }
    return { poles, heads };
  }, []);
  return (
    <>
      <InstancedBoxes color="#2a2536" intensity={1} matrices={poles} />
      <InstancedBoxes color={PALETTE.cyan} intensity={3} matrices={heads} />
    </>
  );
}

export function City() {
  const buildings = useMemo(generateBuildings, []);
  const skyline = useMemo(generateSkyline, []);
  return (
    <>
      <Ground />
      <Buildings list={buildings} withColliders />
      <Buildings list={skyline} withColliders={false} />
      <NeonTrim list={buildings} />
      <NeonTrim list={skyline} />
      <Signs list={buildings} />
      <StreetLights />
    </>
  );
}

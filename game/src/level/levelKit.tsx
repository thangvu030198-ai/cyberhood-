// Đặt một món trong bộ kit Polygonal Mind / KayKit (biển hiệu Nhật, mặt tiền cửa hàng, cột điện, container,
// máy bán hàng, mái nhà…) vào màn 2D: lấy đúng scene theo tên, nhân bản, chỉnh cỡ theo chiều cao.

import { Suspense, use, useMemo } from "react";
import * as THREE from "three";
import { models } from "../game/assets";

export type KitName =
  | "Aero_Airship_01" | "Aero_Door_01" | "Aero_Lampost_01" | "Aero_Station_01_Art"
  | `Japanese_Sign_${"01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "14" | "15" | "16"}`
  | "Pipe_02" | "Wall_01" | "Wall_03"
  | `Wall_Module_0${1 | 2 | 3 | 4 | 5 | 6 | 7}`
  | `Ad0${1 | 2 | 3 | 4 | 5 | 6}_Art`
  | "Column01_Art" | "ElectricBox01_Art" | "ElectricPost01_Art" | "ElectricPost02_Art" | "ElectricWire01_Art" | "Shrine_Art"
  | "WarningSign01_Art" | "WarningSign02_Art" | "Kiosco" | "PoapMachine" | "Robot" | "Tank"
  | "Column_Vapor_01" | "Pot_Retro_03" | "Pot_Vapor_01" | "Pot_Vapor_02" | "Screen_Retro_01" | "Screen_Retro_02"
  | "cargo_A_stacked" | "containers_A" | "containers_B" | "landingpad_small" | "lights"
  | "roofmodule_base" | "roofmodule_cargo_A" | "roofmodule_cargo_B" | "roofmodule_solarpanels" | "solarpanel" | "spacetruck"
  | "structure_low" | "windturbine_low" | "Train_01_Art" | "Train_02_Art" | "Train_Track_01";

export const JP_SIGNS = Array.from({ length: 16 }, (_, i) => `Japanese_Sign_${String(i + 1).padStart(2, "0")}` as KitName);
export const WALL_MODULES = Array.from({ length: 7 }, (_, i) => `Wall_Module_0${i + 1}` as KitName);
export const ADS = Array.from({ length: 6 }, (_, i) => `Ad0${i + 1}_Art` as KitName);

function KitInner({ name, height, by = "height", position, rotY = 0, rotX = 0 }: KitProps) {
  const gltf = use(models.kit);
  const obj = useMemo(() => {
    const src = gltf.scenes.find((s) => s.children[0]?.name === name);
    const g = new THREE.Group();
    if (!src) return g;
    const s = src.clone(true);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const std = m.material as THREE.MeshStandardMaterial;
      // Chùm sáng đèn: trong suốt cộng sáng; neon sáng mạnh cho bloom
      if (std.name === "Aero_Light_Mat")
        m.material = new THREE.MeshBasicMaterial({ map: std.map ?? null, color: "#b9a6ff", transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      else if (std.emissiveMap || std.emissive?.getHex()) std.emissiveIntensity = Math.max(std.emissiveIntensity, 2.2);
      m.frustumCulled = false;
    });
    s.position.set(0, 0, 0);
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const k = height / Math.max(1e-6, by === "height" ? size.y : Math.max(size.x, size.y, size.z));
    s.scale.multiplyScalar(k);
    const c = box.getCenter(new THREE.Vector3());
    s.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    g.add(s);
    return g;
  }, [gltf, name, height, by]);
  return <primitive object={obj} position={position} rotation={[rotX, rotY, 0]} />;
}

type KitProps = { name: KitName; height: number; by?: "height" | "longest"; position: [number, number, number]; rotY?: number; rotX?: number };

export function KitPiece(props: KitProps) {
  return (
    <Suspense fallback={null}>
      <KitInner {...props} />
    </Suspense>
  );
}

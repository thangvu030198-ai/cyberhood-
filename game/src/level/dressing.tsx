// Lớp trang trí cyberpunk tự sinh cho mọi màn 2D: biển hiệu neon phát sáng, đèn đường, đạo cụ dọc làn chơi
// (thùng hàng, quầy bán tự động, xe), dãy nhà tầng giữa cho có chiều sâu. Sinh theo hạt giống cố định từ bản đồ
// nên mỗi lần vào màn giống nhau; chỉ trang trí, không chặn đường.

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ExtraModel } from "../game/assets";
import { useFitted } from "../game/Showcase";
import type { PlatformerSim } from "./platformer";
import type { LevelEntry } from "./registry";
import type { ThemeId } from "./themes";
import { ADS, JP_SIGNS, KitPiece, WALL_MODULES, type KitName } from "./levelKit";

/** Đồ trang trí: model Meshy / model sảnh (x) hoặc món trong kit Polygonal Mind (k), chiều cao mét */
type Small = { x: ExtraModel; h: number } | { k: KitName; h: number };
const X = (x: ExtraModel, h: number): Small => ({ x, h });
const K = (k: KitName, h: number): Small => ({ k, h });

/** Đạo cụ nhỏ theo bối cảnh: dùng hết model đã có (Meshy, model sảnh, kit) để mỗi map một kiểu đồ vật */
const SMALLS: Record<ThemeId, Small[]> = {
  quarantine: [X("mx_prop_trash_pile", 1.3), X("mx_supply_crate", 1), X("mx_vending_kiosk", 2.2), X("mx_car_taxi", 1.5), X("mx_wz_sandbags", 1.1), X("mx_battery_cell", 1.1), X("mx_police_hovercar", 1.5), X("computers", 1.1), X("fridge", 1.9), X("forklift", 2.2), X("crate", 0.9), K("ElectricBox01_Art", 1.4), K("WarningSign01_Art", 1.6), K("Kiosco", 2.4), K("PoapMachine", 2.1), K("Pot_Vapor_02", 1.2)],
  harbor: [X("mx_prop_trash_pile", 1.2), X("mx_vending_kiosk", 2.2), X("mx_noodle_stall", 2.4), X("mx_veh_scooter", 1.2), X("mx_supply_crate", 1), X("mx_car_taxi", 1.5), K("Kiosco", 2.2), K("PoapMachine", 2), K("containers_B", 2.2), K("cargo_A_stacked", 2.2), K("Robot", 1.6), X("crate", 0.9), K("Pot_Vapor_01", 1.2), K("WarningSign02_Art", 1.5)],
  hotel: [X("mx_hh_planter", 2.4), X("mx_hh_luggage_cart", 1.6), X("mx_hh_armchair", 1.3), X("mx_hh_piano", 1.6), K("Pot_Retro_03", 1.2), K("Screen_Retro_02", 1.4), K("Shrine_Art", 2.4), X("crate", 0.9), X("mx_ct_brazier", 1.8)],
  warzone: [X("mx_wz_ammo", 1.2), X("mx_wz_sandbags", 1.2), X("mx_supply_crate", 1), X("mx_battery_cell", 1.1), K("containers_A", 2.4), K("cargo_A_stacked", 2.4)],
  crystal: [X("mx_wz_ammo", 1.2), X("mx_supply_crate", 1), K("containers_A", 2.4), K("cargo_A_stacked", 2.4), K("spacetruck", 2), K("landingpad_small", 0.6), K("solarpanel", 1.4), K("windturbine_low", 4), K("structure_low", 3)],
  skyline: [X("mx_ct_brazier", 2), X("mx_supply_crate", 1), X("mx_battery_cell", 1.2), X("mx_wz_ammo", 1.1), X("computers", 1.2), X("iondrive", 1.8), X("robotarm", 2.4), X("teleporter", 1.6), X("holotree", 2.4), K("Screen_Retro_01", 1.6), K("Column_Vapor_01", 3), K("ElectricBox01_Art", 1.4), K("Tank", 1.8)],
  parish: [X("mx_prop_trash_pile", 1.2), X("mx_vending_kiosk", 2.2), X("mx_veh_scooter", 1.2), X("mx_supply_crate", 1), X("mx_dr_rocks", 1), X("mx_battery_cell", 1.1), X("mx_car_taxi", 1.4), X("redbot", 2.2), X("robot", 1.4), X("computers", 1), X("mx_wz_ammo", 1), X("crate", 0.9), X("mx_map_crashed_mech", 2.4), X("holotree", 2), K("Robot", 1.6), K("Kiosco", 2.2), K("PoapMachine", 2), K("Tank", 1.6), K("containers_B", 2)],
};

/** Vẽ một món trang trí bất kể nguồn */
function Thing({ item, position, rotY = 0, scale = 1 }: { item: Small; position: [number, number, number]; rotY?: number; scale?: number }) {
  if ("k" in item) return <KitPiece name={item.k} height={item.h * scale} position={position} rotY={rotY} />;
  return (
    <Suspense fallback={null}>
      <FittedProp name={item.x} height={item.h * scale} position={position} rotY={rotY} />
    </Suspense>
  );
}

const SIGNS = ["PHỞ-NET", "MẠCH ĐIỆN TỬ", "CÀ PHÊ 24H", "CẦM ĐỒ", "SỬA CHIP", "BÚN BÒ", "SHOP", "CYBERHOOD", "NEON", "24H", "BAR", "ラーメン", "HOTEL", "クリニック", "PHỞ 24/7", "KARAOKE", "電脳", "ARCADE", "CLINIC", "合成肉", "LEGION", "SALE -70%", "カフェ", "CHIP SHOP", "VR ROOM"];
const NEON = ["#ff2fd0", "#00f0ff", "#ffe14a", "#7dff5a", "#ff6a2a", "#b46bff"];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Ảnh biển hiệu neon: chữ phát sáng trên nền tối có viền ống neon */
function signTexture(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(10,6,20,0.85)";
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.shadowColor = color;
  g.shadowBlur = 12;
  g.strokeRect(6, 6, 244, 84);
  g.fillStyle = "#ffffff";
  g.font = `700 ${text.length > 8 ? 30 : 42}px monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowBlur = 18;
  g.fillText(text, 128, 50);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = color;
  g.globalAlpha = 0.55;
  g.fillRect(0, 0, 256, 96);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function NeonSign({ position, text, color, width = 3, rotY = 0 }: { position: [number, number, number]; text: string; color: string; width?: number; rotY?: number }) {
  const tex = useMemo(() => signTexture(text, color), [text, color]);
  const c = new THREE.Color(color).multiplyScalar(2.2);
  return (
    <group position={position} rotation-y={rotY}>
      <mesh>
        <planeGeometry args={[width, width * 0.375]} />
        <meshBasicMaterial map={tex} toneMapped={false} color={[1.6, 1.6, 1.6]} side={THREE.DoubleSide} />
      </mesh>
      {/* Hai thanh treo */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * width * 0.35, width * 0.19 + 0.6, -0.02]}>
          <boxGeometry args={[0.05, 1.2, 0.05]} />
          <meshStandardMaterial color="#20202a" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
      {/* Viền ống neon dưới chân biển */}
      <mesh position={[0, -width * 0.2, 0.02]}>
        <boxGeometry args={[width * 0.9, 0.05, 0.05]} />
        <meshBasicMaterial color={c} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Đèn đường cong: cột thép, đầu đèn phát sáng, chóp sáng mờ hắt xuống */
function StreetLamp({ position, color, height = 4.2, rotY = 0 }: { position: [number, number, number]; color: string; height?: number; rotY?: number }) {
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(2.5), [color]);
  return (
    <group position={position} rotation-y={rotY}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.09, height, 8]} />
        <meshStandardMaterial color="#2a2a36" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0.45, height, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
        <meshStandardMaterial color="#2a2a36" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0.85, height - 0.08, 0]}>
        <boxGeometry args={[0.42, 0.1, 0.22]} />
        <meshBasicMaterial color={c} toneMapped={false} />
      </mesh>
      <mesh position={[0.85, height / 2 - 0.1, 0]}>
        <coneGeometry args={[1.1, height - 0.2, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

function FittedProp({ name, height, position, rotY = 0, selfLit = 0.45 }: { name: ExtraModel; height: number; position: [number, number, number]; rotY?: number; selfLit?: number }) {
  const { root } = useFitted(name, height, "height", selfLit);
  const obj = useMemo(() => root.clone(true), [root]);
  return <primitive object={obj} position={position} rotation={[0, rotY, 0]} />;
}

const lazy = (el: React.ReactNode, key: string | number) => (
  <Suspense key={key} fallback={null}>
    {el}
  </Suspense>
);

/** Màn nhìn ngang: đạo cụ trên mặt khối nền phía sau làn chơi, đèn đường, biển neon, dãy nhà tầng giữa */
export function SideDressing({ sim, entry, painted = false }: { sim: PlatformerSim; entry: LevelEntry; painted?: boolean }) {
  const items = useMemo(() => {
    const r = rng(sim.width * 131 + sim.height);
    const theme = sim.def.theme;
    const smalls = SMALLS[theme];
    // Mặt đất liền khối từ đáy lên tại cột c (0 = hố)
    const top = (c: number) => {
      let y = 0;
      while (y < sim.height && sim.tile(c, y) === "#") y++;
      return y;
    };
    const out: React.ReactNode[] = [];
    const climb = sim.mode === "climb";
    if (!climb) {
      for (let x = 8 + r() * 4; x < sim.width - 4; x += 5 + r() * 5) {
        const c = Math.floor(x);
        const y = top(c);
        if (y === 0 || y >= sim.height - 2 || top(c - 1) !== y || top(c + 1) !== y) continue;
        out.push(<Thing key={`s${c}`} item={smalls[Math.floor(r() * smalls.length)]} position={[x, y, -1.5]} rotY={(r() - 0.5) * 1.2} />);
      }
      for (let x = 12; theme !== "hotel" && x < sim.width - 4; x += 12) {
        const y = top(Math.floor(x));
        if (y === 0) continue;
        out.push(<StreetLamp key={`l${x}`} position={[x, y, -1.85]} color={NEON[Math.floor(r() * NEON.length)]} />);
      }
    }
    // Phố phía sau làn chơi (vùng cách ly, pháo đài): mặt tiền cửa hàng 3D, biển dọc kiểu Nhật, cột điện, quảng cáo
    // Có phông vẽ sẵn: chỉ giữ cột điện sát làn chơi, mặt tiền / biển / quảng cáo đã có trong ảnh
    if (!climb && painted) {
      for (let x = 16, i = 0; x < sim.width; x += 15, i++) {
        const y = top(Math.floor(x));
        if (y > 0) out.push(<KitPiece key={`e${i}`} name={i % 2 ? "ElectricPost01_Art" : "ElectricPost02_Art"} height={7} position={[x, y, -2.3]} />);
      }
    }
    if (!climb && !painted && (theme === "quarantine" || theme === "skyline")) {
      for (let x = -2, i = 0; x < sim.width + 6; x += 4.6, i++)
        out.push(<KitPiece key={`w${i}`} name={WALL_MODULES[Math.floor(r() * WALL_MODULES.length)]} height={5.2} position={[x, 0, -3.6]} rotY={0} />);
      for (let x = 5, i = 0; x < sim.width; x += 6 + r() * 5, i++)
        out.push(<KitPiece key={`j${i}`} name={JP_SIGNS[Math.floor(r() * JP_SIGNS.length)]} height={2.4 + r() * 1.6} position={[x, 4.2 + r() * 3.5, -3.1]} rotY={(r() < 0.5 ? 1 : -1) * Math.PI / 2} />);
      for (let x = 10, i = 0; x < sim.width; x += 22 + r() * 10, i++)
        out.push(<KitPiece key={`a${i}`} name={ADS[i % ADS.length]} height={3.2} position={[x, 9 + r() * 3, -5.2]} />);
      for (let x = 16, i = 0; x < sim.width; x += 15, i++) {
        const y = top(Math.floor(x));
        if (y > 0) out.push(<KitPiece key={`e${i}`} name={i % 2 ? "ElectricPost01_Art" : "ElectricPost02_Art"} height={7} position={[x, y, -2.3]} />);
      }
    }
    // Biển neon và dãy nhà giữa: đứng trên nền phía sau
    // Hang gothic (Hollow Hotel) không treo biển neon, không đèn đường
    const cave = theme === "hotel" || painted;
    for (let x = 6; !cave && x < sim.width + 10; x += 9 + r() * 6) {
      const h = climb ? 4 + r() * (sim.height - 8) : 4 + r() * 5;
      out.push(
        <NeonSign key={`n${x.toFixed(1)}`} position={[x, h, climb ? -6 - r() * 4 : -4.3 - r() * 0.5]} text={SIGNS[Math.floor(r() * SIGNS.length)]} color={NEON[Math.floor(r() * NEON.length)]} width={2.4 + r() * 1.6} />,
      );
    }
    if (entry.backBuildings.length && !painted)
      for (let x = 2, i = 0; x < sim.width + 20; x += 14 + r() * 6, i++) {
        const name = entry.backBuildings[(i * 3 + 1) % entry.backBuildings.length];
        out.push(lazy(<FittedProp name={name} height={12 + r() * 8} position={[x, 0, -22 - r() * 8]} rotY={(r() - 0.5) * 0.4} selfLit={0.32} />, `b${i}`));
      }
    return out;
  }, [sim, entry, painted]);
  return <group>{items}</group>;
}

/** Màn nhìn từ trên (đã đưa về toạ độ thế giới: x, mặt sàn y = -2, z = -y mô phỏng): đèn, biển neon, đạo cụ, vũng sáng */
export function TopDressing({ sim }: { sim: PlatformerSim }) {
  const items = useMemo(() => {
    const r = rng(sim.width * 71 + sim.height * 3);
    const smalls = SMALLS[sim.def.theme];
    const free = (c: number, y: number) => sim.tile(c, y) === ".";
    const wall = (c: number, y: number) => sim.tile(c, y) === "#";
    const out: React.ReactNode[] = [];
    const used = new Set<string>();
    // Không đặt đồ ở chỗ người chơi xuất phát
    const [sx, sy] = sim.def.start;
    let n = 0;
    for (let y = 1; y < sim.height - 1; y++)
      for (let c = 1; c < sim.width - 1; c++) {
        if (!free(c, y) || Math.hypot(c - sx, y - sy) < 4) continue;
        const nearWall = wall(c - 1, y) || wall(c + 1, y) || wall(c, y - 1) || wall(c, y + 1);
        if (!nearWall) continue;
        n++;
        const k = `${c},${y}`;
        const pos: [number, number, number] = [c + 0.5, -2, -(y + 0.5)];
        if (n % 9 === 0) {
          out.push(<StreetLamp key={`l${k}`} position={pos} color={NEON[n % NEON.length]} height={3.2} rotY={r() * 6.28} />);
          used.add(k);
        } else if (n % 4 === 0 && smalls.length) {
          out.push(<Thing key={`p${k}`} item={smalls[Math.floor(r() * smalls.length)]} position={pos} rotY={r() * 6.28} scale={0.85} />);
          used.add(k);
        }
      }
    // Biển neon dựng trên đỉnh tường, quay về phía camera
    let m = 0;
    for (let y = 2; y < sim.height - 2; y += 1)
      for (let c = 2; c < sim.width - 2; c++) {
        if (!wall(c, y) || !free(c, y - 1)) continue;
        if (++m % 11 !== 0) continue;
        out.push(
          <NeonSign key={`n${c},${y}`} position={[c + 0.5, -0.2 + r() * 0.8, -(y + 0.2)]} text={SIGNS[Math.floor(r() * SIGNS.length)]} color={NEON[Math.floor(r() * NEON.length)]} width={2.2} />,
        );
      }
    // Dây cáp điện bò ngoằn ngoèo trên sàn
    for (let i = 0; i < 14; i++) {
      const x0 = r() * sim.width;
      const y0 = r() * sim.height;
      const pts = Array.from({ length: 6 }, (_, k) => new THREE.Vector3(x0 + k * 1.6 + (r() - 0.5) * 2, -1.95, -(y0 + (r() - 0.5) * 3)));
      out.push(
        <mesh key={`cb${i}`} geometry={new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.05 + r() * 0.04, 5, false)}>
          <meshStandardMaterial color={r() < 0.3 ? "#3a2050" : "#14141c"} roughness={0.6} />
        </mesh>,
      );
    }
    // Vũng nước phản chiếu neon trên sàn
    for (let i = 0; i < 26; i++) {
      const c = Math.floor(r() * sim.width);
      const y = Math.floor(r() * sim.height);
      if (!free(c, y)) continue;
      const col = NEON[Math.floor(r() * NEON.length)];
      out.push(
        <mesh key={`w${i}`} rotation-x={-Math.PI / 2} position={[c + 0.5, -1.98, -(y + 0.5)]} scale={[1 + r() * 1.5, 0.6 + r(), 1]}>
          <circleGeometry args={[0.8, 20]} />
          <meshBasicMaterial color={col} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>,
      );
    }
    return out;
  }, [sim]);
  return <group>{items}</group>;
}

/** Giao thông trên trời phía sau: drone Kamdo, UFO, trực thăng, tàu vũ trụ, khí cầu, xe bay, chạy vòng theo bề ngang map */
const FLYERS: Small[] = [X("kamdo", 1.2), X("ufo", 2.4), X("bigufo", 6), X("helicopter", 3), X("spaceship", 4), K("Aero_Airship_01", 6), X("mx_veh_hovertruck", 2.4), X("mx_police_hovercar", 1.6), X("mx_dr_ship", 4), X("kamdo", 1.2)];

function Flyer({ item, lane, speed, phase, span }: { item: Small; lane: [number, number]; speed: number; phase: number; span: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const x = ((phase + t * speed) % (span + 80) + span + 80) % (span + 80) - 40;
    g.position.set(x, lane[0] + Math.sin(t * 0.7 + phase) * 0.8, lane[1]);
    g.rotation.y = speed > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.rotation.z = Math.sin(t * 0.9 + phase) * 0.06;
  });
  return (
    <group ref={ref}>
      <Thing item={item} position={[0, 0, 0]} />
    </group>
  );
}

export function SkyTraffic({ sim }: { sim: PlatformerSim }) {
  const list = useMemo(() => {
    const r = rng(sim.width * 5 + 17);
    const climb = sim.mode === "climb";
    return FLYERS.map((item, i) => ({
      item,
      lane: [climb ? 10 + r() * (sim.height - 10) : 13 + r() * 16, -18 - r() * 30] as [number, number],
      speed: (r() < 0.5 ? -1 : 1) * (3 + r() * 6),
      phase: r() * 300 + i * 40,
    }));
  }, [sim]);
  return (
    <group>
      {list.map((f, i) => (
        <Flyer key={i} item={f.item} lane={f.lane} speed={f.speed} phase={f.phase} span={sim.width} />
      ))}
    </group>
  );
}

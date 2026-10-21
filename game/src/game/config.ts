// Thông số thế giới và bảng màu neon dùng chung cho mọi module.

export const PALETTE = {
  pink: "#ff2a6d",
  cyan: "#05d9e8",
  purple: "#9d4dff",
  amber: "#ffb000",
  fog: "#0b0618",
  asphalt: "#14111d",
  concrete: "#1d1a26",
};

export const NEON_COLORS = [PALETTE.pink, PALETTE.cyan, PALETTE.purple, PALETTE.amber];

// Mỗi góc phần tư thành phố là một District có bảng màu neon riêng.
export type DistrictId = "bazaar" | "arena" | "haven" | "undergrid";

export const DISTRICTS: Record<DistrictId, { name: string; neon: string[] }> = {
  bazaar: { name: "Neon Bazaar", neon: [PALETTE.pink, PALETTE.amber, PALETTE.purple] },
  arena: { name: "Chrome Arena", neon: [PALETTE.cyan, "#dff6ff", PALETTE.purple] },
  haven: { name: "Data Haven", neon: ["#39ff88", PALETTE.cyan, "#b6ff3d"] },
  undergrid: { name: "The Undergrid", neon: ["#ff1f3d", PALETTE.purple, "#ff5e00"] },
};

export function districtIdAt(x: number, z: number): DistrictId {
  if (x >= 0) return z >= 0 ? "bazaar" : "arena";
  return z >= 0 ? "haven" : "undergrid";
}

// Lưới thành phố: GRID x GRID block, ngăn cách bởi các con đường.
export const CITY = {
  GRID: 4,
  BLOCK: 40,
  STREET: 16,
  SIDEWALK_HEIGHT: 0.15,
};

export const CITY_PITCH = CITY.BLOCK + CITY.STREET;
export const CITY_HALF = (CITY.GRID * CITY.BLOCK + (CITY.GRID + 1) * CITY.STREET) / 2;

/** Tâm của các block, đối xứng quanh gốc toạ độ (gốc là một ngã tư). */
export const BLOCK_CENTERS: number[] = Array.from(
  { length: CITY.GRID },
  (_, i) => (i - (CITY.GRID - 1) / 2) * CITY_PITCH,
);

export const PLAYER = {
  capsuleHalfHeight: 0.5,
  capsuleRadius: 0.3,
  floatHeight: 0.25,
  modelHeight: 1.8,
  spawn: [0, 3, 6] as [number, number, number],
};

/** Bộ sinh số ngẫu nhiên có seed, để thành phố giống nhau ở mọi lần tải. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bảng hợp đồng ở Vùng An toàn, trên vỉa hè cạnh điểm xuất phát */
export const BOARD_SPOT = { x: -10.2, y: 0.15, z: 3 };

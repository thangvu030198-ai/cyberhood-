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

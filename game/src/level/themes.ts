// Bảng màu từng màn đi ngang. Màn mới chỉ cần chọn một theme (hoặc thêm theme mới ở đây).
// Nguyên tắc: nền sáng, ít bão hoà và có sương; nhân vật chính có viền sáng nên luôn nổi lên trên nền.

export type ThemeId = "quarantine" | "harbor" | "skyline" | "hotel" | "warzone" | "crystal" | "parish";

export type LevelTheme = {
  /** Dải màu trời từ trên xuống */
  sky: string[];
  sun: [number, number, number];
  fog: string;
  fogNear: number;
  fogFar: number;
  hemi: { sky: string; ground: string; intensity: number };
  key: { color: string; intensity: number };
  rim: { color: string; intensity: number };
  /** Khối nền: màu nhuộm lên texture tấm kim loại, viền mép trước, bậc một chiều */
  tile: string;
  edge: [number, number, number];
  ledge: string;
  backFloor: string;
  /** Độ tự sáng của toà nhà nền (thấp = nhạt vào sương) */
  backSelfLit: number;
  /** Viền nhân vật chính */
  heroOutline: string;
  /** Mặt sàn khi nhìn từ trên: tấm kim loại (mặc định) hoặc nhựa đường ướt kẻ lưới neon */
  floor?: "panel" | "neon";
  /** Bề mặt khối nền nhìn ngang: tấm kim loại (mặc định) hoặc sàn lưới sắt gỉ (cầu treo) */
  tiles?: "panel" | "grate" | "stone";
};

export const THEMES: Record<ThemeId, LevelTheme> = {
  // Phong cách cyberpunk cho mọi map: đêm neon nhưng đủ sáng (đèn bầu trời mạnh, nhà nền tự phát sáng),
  // khối nền chrome tối với viền neon, nhân vật chính có viền vàng nổi trên nền tím xanh.

  // Giáo Xứ Neon: khu nhà thờ bỏ hoang giữa Neon City, biển hiệu hỏng chập chờn, sàn nhựa đường ướt kẻ lưới neon
  parish: {
    sky: ["#0a0418", "#2a0a3a", "#6a1a5a", "#ff3a8a"],
    sun: [3, 0.8, 2],
    fog: "#1c0f2c",
    fogNear: 40,
    fogFar: 140,
    hemi: { sky: "#eadcff", ground: "#2a1838", intensity: 2.1 },
    key: { color: "#ffd6f0", intensity: 2.3 },
    rim: { color: "#00e8ff", intensity: 1.8 },
    tile: "#4a4864",
    edge: [3, 0.4, 2.2],
    ledge: "#00f0ff",
    backFloor: "#3a3050",
    backSelfLit: 0.5,
    heroOutline: "#fff3a0",
    floor: "neon",
  },
  // Vùng cách ly lúc chạng vạng neon: trời chàm sang hồng cam, khối thép xanh viền cyan
  quarantine: {
    sky: ["#0b0a2e", "#2a1060", "#b0287a", "#ff7a4a"],
    sun: [3, 1.4, 1],
    fog: "#3a1a52",
    fogNear: 32,
    fogFar: 150,
    hemi: { sky: "#e0d4ff", ground: "#3a1e50", intensity: 2 },
    key: { color: "#ffd8ee", intensity: 2.3 },
    rim: { color: "#00f0ff", intensity: 2 },
    tile: "#6a7498",
    edge: [0.3, 2.6, 3],
    ledge: "#ff3ad9",
    backFloor: "#2c2044",
    backSelfLit: 0.5,
    heroOutline: "#fff3a0",
  },
  // Cảng neon về đêm: nước xanh sẫm, đèn hồng, khối kim loại xanh thép
  harbor: {
    sky: ["#041a2e", "#0a3a5a", "#0f6a8a", "#ff4fa0"],
    sun: [3, 1, 2],
    fog: "#0e2a40",
    fogNear: 34,
    fogFar: 150,
    // Phố đêm: ánh trời dịu để toà nhà có khối sáng tối rõ, đèn cửa sổ / biển neon tự sáng nổi lên
    hemi: { sky: "#9fc4ff", ground: "#0a1424", intensity: 1.15 },
    key: { color: "#ffe2c8", intensity: 2.2 },
    rim: { color: "#ff4fd8", intensity: 2.2 },
    tile: "#4a6a88",
    edge: [3, 0.5, 2.4],
    ledge: "#2ee6ff",
    backFloor: "#22364c",
    backSelfLit: 0.5,
    heroOutline: "#ffe066",
    floor: "neon",
  },
  // Hollow Hotel kiểu neon noir: ngọc bích điện tử và vàng hổ phách
  hotel: {
    sky: ["#140c22", "#3a2240", "#a85a3a", "#ffb070"],
    sun: [3, 1.8, 0.8],
    fog: "#2a1a22",
    fogNear: 30,
    fogFar: 120,
    hemi: { sky: "#ffe8d0", ground: "#2a1a1a", intensity: 1.9 },
    key: { color: "#ffd0a0", intensity: 2.4 },
    rim: { color: "#2fffd0", intensity: 1.6 },
    tile: "#b8aca0",
    // Mép đá chỉ ánh nến mờ, không phải dải neon
    edge: [0.9, 0.55, 0.25],
    ledge: "#2fffd0",
    backFloor: "#1a1216",
    backSelfLit: 0.3,
    heroOutline: "#7dfff0",
    tiles: "stone",
  },

  // Warzone: bãi chiến trường dưới trời đỏ khói, đèn pha cam và cyan
  warzone: {
    sky: ["#120a24", "#3a1240", "#c0402a", "#ffb040"],
    sun: [3, 1.6, 0.6],
    fog: "#3a1a2a",
    fogNear: 34,
    fogFar: 160,
    hemi: { sky: "#ffe8d8", ground: "#3a1a1a", intensity: 2 },
    key: { color: "#ffe0c0", intensity: 2.4 },
    rim: { color: "#00d8ff", intensity: 1.8 },
    tile: "#6a5a5a",
    edge: [3, 1.4, 0.3],
    ledge: "#ff9a3d",
    backFloor: "#2e1e24",
    backSelfLit: 0.45,
    heroOutline: "#fff3a0",
  },
  // Hẻm núi pha lê (nhìn từ trên): đáy tím sẫm, vách pha lê hồng tím phát sáng
  crystal: {
    sky: ["#14062e", "#2a0b4a", "#4a1460", "#6a1a70"],
    sun: [3, 1.2, 2.6],
    fog: "#2a0a3e",
    fogNear: 30,
    fogFar: 240,
    hemi: { sky: "#e8c8ff", ground: "#3a0e4a", intensity: 1.8 },
    key: { color: "#ffe2f6", intensity: 2.2 },
    rim: { color: "#5fd0ff", intensity: 1.6 },
    tile: "#b04fd8",
    edge: [3, 0.6, 2.4],
    ledge: "#ff7ad9",
    backFloor: "#3b0f4f",
    backSelfLit: 0.4,
    heroOutline: "#fff3a0",
  },
  // Citadel: tháp tập đoàn trong đêm, tím điện và hồng neon
  skyline: {
    sky: ["#05050f", "#1a0a3a", "#5a1a8a", "#ff2fa0"],
    sun: [3, 0.8, 2.4],
    fog: "#1c0f30",
    fogNear: 30,
    fogFar: 140,
    hemi: { sky: "#e4dcff", ground: "#1c1232", intensity: 2 },
    key: { color: "#ffffff", intensity: 2.3 },
    rim: { color: "#b04fff", intensity: 2 },
    tile: "#565672",
    edge: [2.4, 0.6, 3],
    ledge: "#4fc3ff",
    backFloor: "#1e1830",
    backSelfLit: 0.5,
    heroOutline: "#ffe066",
  },
};

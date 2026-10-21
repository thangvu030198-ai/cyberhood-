// Bảng màu từng màn đi ngang. Màn mới chỉ cần chọn một theme (hoặc thêm theme mới ở đây).
// Nguyên tắc: nền sáng, ít bão hoà và có sương; nhân vật chính có viền sáng nên luôn nổi lên trên nền.

export type ThemeId = "quarantine" | "harbor" | "skyline" | "hotel" | "warzone";

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
};

export const THEMES: Record<ThemeId, LevelTheme> = {
  // Vùng cách ly lúc hoàng hôn: trời xanh nhạt chuyển hồng cam, kim loại sáng màu thép
  quarantine: {
    sky: ["#4f86e8", "#9db9ff", "#ffc2d6", "#ffe0a3"],
    sun: [3, 2.2, 1.2],
    fog: "#f0c4d4",
    fogNear: 34,
    fogFar: 150,
    hemi: { sky: "#ffffff", ground: "#9c7a9a", intensity: 1.7 },
    key: { color: "#fff1dc", intensity: 2.4 },
    rim: { color: "#7fd8ff", intensity: 1.6 },
    tile: "#d4dcf2",
    edge: [0.4, 2.4, 2.6],
    ledge: "#ff7ad9",
    backFloor: "#c9a7bd",
    backSelfLit: 0.22,
    heroOutline: "#fff3a0",
  },
  // Cảng neon ban ngày: ngọc lam và cát
  harbor: {
    sky: ["#2fb4d8", "#8fe3f0", "#e8fbff", "#fff4d6"],
    sun: [3, 2.8, 1.8],
    fog: "#cdeff5",
    fogNear: 34,
    fogFar: 150,
    hemi: { sky: "#ffffff", ground: "#6f9aa0", intensity: 1.8 },
    key: { color: "#fffaf0", intensity: 2.5 },
    rim: { color: "#ffd27a", intensity: 1.4 },
    tile: "#e6eef0",
    edge: [2.6, 1.6, 0.4],
    ledge: "#2ee6c8",
    backFloor: "#a8cfd2",
    backSelfLit: 0.2,
    heroOutline: "#ff5fa8",
  },
  // Hollow Hotel: sảnh khách sạn sang trọng, ngọc bích + vàng, đèn ấm
  hotel: {
    sky: ["#1f6f6a", "#3fb7a3", "#ffd9a8", "#fff1d6"],
    sun: [3, 2.4, 1.4],
    fog: "#e9d9c4",
    fogNear: 30,
    fogFar: 130,
    hemi: { sky: "#fff7e8", ground: "#5f7f70", intensity: 1.8 },
    key: { color: "#ffe6c0", intensity: 2.2 },
    rim: { color: "#5fffd8", intensity: 1.5 },
    tile: "#e7dcc6",
    edge: [2.8, 2, 0.6],
    ledge: "#2fd6a8",
    backFloor: "#7a4b52",
    backSelfLit: 0.3,
    heroOutline: "#7dfff0",
  },
  // Warzone: hành tinh chiến tranh, cát cam dưới trời xanh ngọc, pha lê xanh dương
  warzone: {
    sky: ["#1e88c8", "#69c4e8", "#ffd6a0", "#ffb070"],
    sun: [3, 2, 1],
    fog: "#f2c9a0",
    fogNear: 34,
    fogFar: 160,
    hemi: { sky: "#ffffff", ground: "#a0704a", intensity: 1.8 },
    key: { color: "#fff0d8", intensity: 2.5 },
    rim: { color: "#6fd0ff", intensity: 1.5 },
    tile: "#e8c9a0",
    edge: [0.5, 2, 3],
    ledge: "#ff9a3d",
    backFloor: "#d6a676",
    backSelfLit: 0.18,
    heroOutline: "#fff3a0",
  },
  // Đỉnh toà tháp giữa mây: trắng xanh, viền tím
  skyline: {
    sky: ["#3b6cf0", "#78a8ff", "#cfe3ff", "#ffffff"],
    sun: [3, 3, 2.6],
    fog: "#dbe7ff",
    fogNear: 30,
    fogFar: 140,
    hemi: { sky: "#ffffff", ground: "#8a93c0", intensity: 1.9 },
    key: { color: "#ffffff", intensity: 2.3 },
    rim: { color: "#c49bff", intensity: 1.5 },
    tile: "#f0f2ff",
    edge: [1.8, 0.8, 3],
    ledge: "#4fc3ff",
    backFloor: "#b9c3e6",
    backSelfLit: 0.2,
    heroOutline: "#ffe066",
  },
};

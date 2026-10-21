// Các kiểu góc nhìn cho màn đi ngang, học từ game đời cũ:
// - 2.5D cổ điển (Mega Man X8 / PS2): phối cảnh ngang, thấy chiều sâu khối nền
// - Nghiêng PS2 (Klonoa, Pandemonium): camera xoay chéo ~25° và cao hơn, thấy rõ mặt bên và mặt trên
// - 16-bit (SNES / Mega Man X gốc): gần như phẳng, ảnh vỡ hạt và giảm số màu
// - Game Boy: phẳng hoàn toàn, 4 sắc xanh lá, hạt to
// - Điện ảnh: camera thấp, zoom theo nhịp (đứng yên thì gần, lướt thì xa), khung đen trên dưới khi đánh trùm

import { create } from "zustand";

export type ViewId = "classic" | "ps2" | "snes" | "gameboy" | "cinema";

export type ViewPreset = {
  id: ViewId;
  label: string;
  /** Học từ */
  inspired: string;
  fov: number;
  distance: number;
  /** Góc xoay ngang của camera quanh trục dọc (rad), 0 = nhìn thẳng ngang */
  yaw: number;
  /** Camera cao hơn điểm nhìn bao nhiêu (m) */
  rise: number;
  lookAhead: number;
  damp: number;
  post: "none" | "snes" | "gameboy" | "cinema";
};

export const VIEWS: ViewPreset[] = [
  { id: "classic", label: "2.5D cổ điển", inspired: "Mega Man X8 · PS2", fov: 40, distance: 18.5, yaw: 0, rise: 1.2, lookAhead: 2.2, damp: 5, post: "none" },
  { id: "ps2", label: "Nghiêng PS2", inspired: "Klonoa 2 · Pandemonium", fov: 42, distance: 17, yaw: 0.42, rise: 4.2, lookAhead: 3, damp: 4, post: "none" },
  { id: "snes", label: "16-bit", inspired: "Mega Man X · SNES", fov: 9, distance: 92, yaw: 0, rise: 0.4, lookAhead: 2.5, damp: 7, post: "snes" },
  { id: "gameboy", label: "Game Boy", inspired: "Mega Man Xtreme · Game Boy", fov: 9, distance: 80, yaw: 0, rise: 0.4, lookAhead: 2, damp: 8, post: "gameboy" },
  { id: "cinema", label: "Điện ảnh", inspired: "Shinobi · Strider 2 (PS2)", fov: 34, distance: 16, yaw: -0.18, rise: -0.6, lookAhead: 3.5, damp: 3, post: "cinema" },
];

export const viewById = (id: ViewId) => VIEWS.find((v) => v.id === id) ?? VIEWS[0];

const KEY = "cyberhood.levelView";

function loadView(): ViewId {
  try {
    const v = localStorage.getItem(KEY) as ViewId | null;
    if (v && VIEWS.some((x) => x.id === v)) return v;
  } catch {
    // bộ nhớ trình duyệt không dùng được: mặc định
  }
  return "classic";
}

export const useLevelView = create<{ view: ViewId; changedAt: number; next: () => void; set: (v: ViewId) => void }>((set, get) => ({
  view: loadView(),
  changedAt: 0,
  next: () => {
    const i = VIEWS.findIndex((v) => v.id === get().view);
    get().set(VIEWS[(i + 1) % VIEWS.length].id);
  },
  set: (view) => {
    try {
      localStorage.setItem(KEY, view);
    } catch {
      // bỏ qua
    }
    set({ view, changedAt: performance.now() });
  },
}));

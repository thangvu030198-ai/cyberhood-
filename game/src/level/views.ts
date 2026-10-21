// Các dạng 2D của màn đi ngang, học từ game đời cũ. Mỗi map dùng cố định một dạng (registry.ts):
// - 2.5D cổ điển (Mega Man X8 / PS2): phối cảnh ngang, thấy chiều sâu khối nền
// - Nghiêng PS2 (Klonoa, Pandemonium): camera xoay chéo ~25° và cao hơn, thấy rõ mặt bên và mặt trên
// - 16-bit (SNES / Mega Man X gốc): gần như phẳng, ảnh vỡ hạt và giảm số màu
// - Game Boy: phẳng hoàn toàn, 4 sắc xanh lá, hạt to
// - Điện ảnh: camera thấp, zoom theo nhịp (đứng yên thì gần, lướt thì xa), khung đen trên dưới khi đánh trùm

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
  { id: "snes", label: "16-bit", inspired: "Gradius III · Mega Man X (SNES)", fov: 9, distance: 92, yaw: 0, rise: 0.4, lookAhead: 2.5, damp: 7, post: "snes" },
  { id: "gameboy", label: "Game Boy", inspired: "Mega Man Xtreme · Game Boy", fov: 9, distance: 80, yaw: 0, rise: 0.4, lookAhead: 2, damp: 8, post: "gameboy" },
  { id: "cinema", label: "Điện ảnh", inspired: "Shinobi · Strider 2 (PS2)", fov: 34, distance: 16, yaw: -0.18, rise: -0.6, lookAhead: 3.5, damp: 3, post: "cinema" },
];

export const viewById = (id: ViewId) => VIEWS.find((v) => v.id === id) ?? VIEWS[0];

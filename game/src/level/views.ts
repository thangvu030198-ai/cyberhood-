// Các dạng 2D của màn đi ngang, học từ game đời cũ. Mỗi map dùng cố định một dạng (registry.ts):
// - 2.5D cổ điển (Mega Man X8 / PS2): phối cảnh ngang, thấy chiều sâu khối nền
// - Nghiêng PS2 (Klonoa, Pandemonium): camera xoay chéo ~25° và cao hơn, thấy rõ mặt bên và mặt trên
// - Màu retro 16-bit (SNES / Gradius III): camera gần như phẳng như game 2D cũ, hình vẫn 3D sắc nét,
//   chỉnh màu kiểu thập niên 90 (bóng tím, sáng cam, màu đậm)
// - Game Boy: phẳng hoàn toàn, 4 sắc xanh lá, hạt to
// - Điện ảnh: camera thấp, zoom theo nhịp (đứng yên thì gần, lướt thì xa), khung đen trên dưới khi đánh trùm

export type ViewId = "classic" | "ps2" | "snes" | "gameboy" | "cinema" | "topdown" | "iso" | "farm";

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
  /** "top": mặt phẳng chơi nằm ngang, camera trên cao nhìn xuống, tiến = lên trên màn hình */
  plane?: "side" | "top";
  /** Nhìn chéo sa bàn: camera xoay 45° và chúc xuống ~35°, bám theo người chơi */
  iso?: boolean;
  /** Nhìn từ trên kiểu nông trại: không xoay, chúc dốc ~58°, lên màn hình = lên bản đồ */
  farm?: boolean;
};

export const VIEWS: ViewPreset[] = [
  { id: "classic", label: "2.5D cổ điển", inspired: "Mega Man X8 · PS2", fov: 40, distance: 18.5, yaw: 0, rise: 1.2, lookAhead: 2.2, damp: 5, post: "none" },
  { id: "ps2", label: "Nghiêng PS2", inspired: "Klonoa 2 · Pandemonium", fov: 42, distance: 17, yaw: 0.42, rise: 4.2, lookAhead: 3, damp: 4, post: "none" },
  { id: "snes", label: "Màu retro 16-bit", inspired: "Gradius III · Mega Man X (SNES)", fov: 9, distance: 92, yaw: 0, rise: 0.4, lookAhead: 2.5, damp: 7, post: "snes" },
  { id: "gameboy", label: "Game Boy", inspired: "Mega Man Xtreme · Game Boy", fov: 9, distance: 80, yaw: 0, rise: 0.4, lookAhead: 2, damp: 8, post: "gameboy" },
  { id: "topdown", label: "Nhìn từ trên, cuộn dọc", inspired: "1942 · Raiden · bắn máy bay hẻm núi", fov: 40, distance: 36, yaw: 0, rise: 7, lookAhead: 0, damp: 6, post: "none", plane: "top" },
  { id: "iso", label: "Nhìn chéo sa bàn", inspired: "Final Fantasy Tactics (PS1)", fov: 26, distance: 46, yaw: 0, rise: 0, lookAhead: 0, damp: 6, post: "snes", plane: "top", iso: true },
  { id: "farm", label: "Nhìn từ trên kiểu nông trại", inspired: "Stardew Valley · Harvest Moon (SNES)", fov: 30, distance: 27, yaw: 0, rise: 0, lookAhead: 0, damp: 6, post: "snes", plane: "top", farm: true },
  { id: "cinema", label: "Điện ảnh", inspired: "Shinobi · Strider 2 (PS2)", fov: 38, distance: 24, yaw: -0.14, rise: 0.8, lookAhead: 3.5, damp: 3, post: "cinema" },
];

export const viewById = (id: ViewId) => VIEWS.find((v) => v.id === id) ?? VIEWS[0];

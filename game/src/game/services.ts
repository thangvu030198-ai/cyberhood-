// Các NPC dịch vụ ở sảnh (vùng an toàn quanh cổng nhiệm vụ): lò rèn đập đồ, vòng quay may mắn, kho vũ khí,
// phòng thay đồ (tủ đồ 6 ô), người kể chuyện (cốt truyện mùa S1). Đứng gần bấm E để mở.

import { create } from "zustand";
import { MISSION_GATE } from "./config";

export type ServiceId = "forge" | "spin" | "armory" | "wardrobe" | "story";

export type Service = {
  id: ServiceId;
  /** Tên NPC và nghề */
  npc: string;
  title: string;
  /** Model NPC Meshy có clip đứng / nhảy múa */
  model: string;
  clip: string;
  x: number;
  z: number;
  yaw: number;
  color: string;
  sign: string;
  greet: string;
};

const G = MISSION_GATE;

export const SERVICES: Service[] = [
  { id: "forge", npc: "Bác Thép", title: "Lò rèn · Đập đồ", model: "mx_civ_worker", clip: "idle", x: G.x - 7.5, z: G.z + 5, yaw: Math.PI / 2, color: "#ff6a2a", sign: "LÒ RÈN", greet: "Đưa đồ đây. Đập lên +10 thì cả Neon City phải nể, còn xui thì… tụt một cấp." },
  { id: "spin", npc: "Lucky Mai", title: "Vòng quay may mắn", model: "mx_civ_dancer", clip: "dance", x: G.x - 8, z: G.z + 11, yaw: Math.PI / 2, color: "#ff2fd0", sign: "QUAY SỐ", greet: "Mỗi ngày một lượt miễn phí nha! Jackpot có cả đồ Huyền thoại đó." },
  { id: "armory", npc: "Kho Vũ Khí Rook", title: "Cửa hàng trang bị", model: "mx_civ_courier", clip: "idle", x: G.x + 8.5, z: G.z + 10, yaw: -Math.PI / 2, color: "#ffe14a", sign: "VŨ KHÍ", greet: "Súng, mũ, găng, giày — đồ Hiếm trở xuống. Đồ xịn hơn thì tự đi mà nhặt." },
  { id: "wardrobe", npc: "Stylist Linh", title: "Phòng thay đồ", model: "mx_civ_student", clip: "idle", x: G.x + 4, z: G.z + 14, yaw: Math.PI, color: "#00f0ff", sign: "TỦ ĐỒ", greet: "Sáu ô trang bị: vũ khí, giáp, mũ, găng, giày, chip. Mặc vào là thấy khác liền." },
  { id: "story", npc: "Lão Kể Chuyện", title: "Biên niên sử Neon City", model: "mx_civ_elder", clip: "idle", x: G.x - 4, z: G.z + 15, yaw: Math.PI, color: "#7dff5a", sign: "CỐT TRUYỆN", greet: "Ngồi xuống đây, Hunter. Ta kể cho nghe vì sao Neon City thành ra thế này." },
];

export const SERVICE_REACH = 3;

export const serviceById = (id: ServiceId) => SERVICES.find((s) => s.id === id)!;

export const useService = create<{ open: ServiceId | null; setOpen: (id: ServiceId | null) => void }>((set) => ({
  open: null,
  setOpen: (open) => {
    if (open) document.exitPointerLock?.();
    set({ open });
  },
}));

/** Cốt truyện mùa S1: mở đầu chung + từng chương (map) */
export const STORY_PROLOGUE =
  "Năm 2097. Tập đoàn Legion của Director Vane nuốt trọn Neon City, khoá ba Chìa Mùa — Đồng, Ngọc Bích, Pha Lê — để niêm phong Pháo Đài Citadel, nơi giữ Lõi Ký Ức của cả thành phố. Bạn là Hunter của Cyberhood: nhận hợp đồng qua Cổng Nhiệm Vụ, giành lại ba chìa và chấm dứt triều đại của Vane.";

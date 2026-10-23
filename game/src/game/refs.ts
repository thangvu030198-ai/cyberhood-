import type { EcctrlHandle } from "ecctrl";
import type { EcctrlVehicleHandle } from "ecctrl/vehicle";

// Handle vật lý dùng chung giữa nhân vật, xe và camera.
// Để ngoài React state vì được đọc mỗi frame.
export const handles = {
  player: null as EcctrlHandle | null,
  cars: new Map<number, EcctrlVehicleHandle>(),
  /** Góc azimuth của camera (rad), minimap xoay theo */
  camYaw: 0,
  /** 0 = người thường, 1 = dạng Mech hoàn toàn; nội suy trong lúc biến hình */
  mechBlend: 0,
  /** Xoay camera theo góc azimuth (rad; 0 = nhìn về −z) — dùng khi dịch chuyển sang bản đồ khác */
  aimCamera: null as null | ((azimuth: number, polar?: number) => void),
  /** CameraControls của camera chính (công cụ quay phim / debug điều khiển trực tiếp) */
  camControls: null as unknown,
  /**
   * Vị trí thân nhân vật ở frame gần nhất. Khi cây cảnh tạm ẩn vì đang tải (Suspense) rồi hiện lại,
   * thân vật lý bị tạo lại: đặt nó về đây thay vì điểm xuất phát của sảnh.
   */
  lastPlayerPos: null as null | [number, number, number],
};

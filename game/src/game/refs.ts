import type { EcctrlHandle } from "ecctrl";
import type { EcctrlVehicleHandle } from "ecctrl/vehicle";

// Handle vật lý dùng chung giữa nhân vật, xe và camera.
// Để ngoài React state vì được đọc mỗi frame.
export const handles = {
  player: null as EcctrlHandle | null,
  cars: new Map<number, EcctrlVehicleHandle>(),
};

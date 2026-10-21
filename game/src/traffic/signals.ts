// Đèn giao thông của từng ngã tư, dùng chung cho xe và người đi bộ.
// Mỗi ngã tư chạy chu kỳ hai pha: pha trục Z (xe chạy dọc Z) rồi pha trục X, giữa hai pha có đỏ hết.
// Lệch pha theo vị trí ngã tư để xe chạy thẳng gặp "làn sóng xanh".

import type { Axis, Junction } from "./road";
import { TUNING } from "./tuning";

export type Light = "green" | "yellow" | "red";

const S = TUNING.signals;
/** Thời lượng một pha: xanh + vàng + đỏ hết */
export const PHASE = S.green + S.yellow + S.allRed;
export const CYCLE = PHASE * 2;

/** Thời điểm trong chu kỳ của ngã tư (0..CYCLE) */
export function cycleTime(j: Pick<Junction, "i" | "j">, t: number) {
  const offset = (j.i + j.j) * S.offsetPerBlock;
  return (((t + offset) % CYCLE) + CYCLE) % CYCLE;
}

/** Đèn cho xe chạy dọc trục `axis` tại ngã tư `j` ở thời điểm t */
export function lightFor(j: Pick<Junction, "i" | "j">, axis: Axis, t: number): Light {
  const c = cycleTime(j, t);
  // Pha đầu cho trục Z, pha sau cho trục X
  const local = axis === "z" ? c : c - PHASE;
  if (local < 0 || local >= PHASE) return "red";
  if (local < S.green) return "green";
  if (local < S.green + S.yellow) return "yellow";
  return "red";
}

/** Số giây còn lại của đèn đi bộ cho người đi dọc trục `walkAxis` (0 = không được đi) */
export function walkTimeLeft(j: Pick<Junction, "i" | "j">, walkAxis: Axis, t: number) {
  // Người đi dọc trục nào thì đi cùng pha với xe chạy song song trục đó
  const c = cycleTime(j, t);
  const local = walkAxis === "z" ? c : c - PHASE;
  if (local < 0 || local >= S.walk) return 0;
  return S.walk - local;
}

export type PedLight = "walk" | "flash" | "stop";

export function pedLightFor(j: Pick<Junction, "i" | "j">, walkAxis: Axis, t: number): PedLight {
  if (walkTimeLeft(j, walkAxis, t) > 0) return "walk";
  // Hết giờ đi nhưng xe song song vẫn còn xanh: nhấp nháy báo sắp hết
  return lightFor(j, walkAxis, t) === "green" ? "flash" : "stop";
}

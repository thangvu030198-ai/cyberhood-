import { GAME } from "./config";

// Năng lượng: tối đa 5, hồi 1/giờ; Solo Nhiệm vụ và hợp đồng tốn 1, Free Roam miễn phí.

export type Energy = { value: number; updatedAt: number };

const HOUR = 3600_000;

/** Tính năng lượng hiện tại theo thời gian đã trôi (không vượt mức tối đa) */
export function currentEnergy(e: Energy, now: number, maxBonus = 0): Energy {
  const max = GAME.energy.max + maxBonus;
  if (e.value >= max) return { value: e.value, updatedAt: now };
  const gained = Math.floor((now - e.updatedAt) / HOUR) * GAME.energy.regenPerHour;
  if (gained <= 0) return e;
  const value = Math.min(max, e.value + gained);
  // Giữ phần lẻ thời gian chưa đủ một giờ
  return { value, updatedAt: value >= max ? now : e.updatedAt + (gained / GAME.energy.regenPerHour) * HOUR };
}

export function spendEnergy(e: Energy, now: number, cost: number, maxBonus = 0): Energy | null {
  const cur = currentEnergy(e, now, maxBonus);
  if (cur.value < cost) return null;
  const max = GAME.energy.max + maxBonus;
  // Đang đầy thì bắt đầu tính giờ hồi từ lúc tiêu
  return { value: cur.value - cost, updatedAt: cur.value >= max ? now : cur.updatedAt };
}

/** Thời gian (ms) tới lần hồi tiếp theo */
export function msToNextEnergy(e: Energy, now: number) {
  return Math.max(0, HOUR - ((now - e.updatedAt) % HOUR));
}

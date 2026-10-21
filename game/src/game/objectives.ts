// Mục tiêu hiện tại để chỉ đường (mũi tên cạnh nhân vật, la bàn trên HUD).
// Hợp đồng đang chạy được ưu tiên (có giới hạn thời gian), sau đó tới nhiệm vụ cốt truyện.

import { contractPins, type Pin } from "./contracts";
import { HUB_PEACEFUL, MISSION_GATE } from "./config";
import { drones } from "./Enemies";
import { useHunter } from "./hunter";
import { currentStep, objectiveTarget } from "./quests";
import { handles } from "./refs";
import { useGame } from "./store";
import { questById } from "./story";

export type Objective = { x: number; z: number; label: string; color: string };

const PIN_LABEL: Record<Pin["kind"], string> = {
  objective: "Mục tiêu hợp đồng",
  car: "Xe cần cướp",
  extract: "Điểm rút lui",
  marker: "Nhiệm vụ hợp đồng",
  crate: "Thùng tiếp tế",
  battery: "Pin năng lượng",
  board: "Bảng hợp đồng",
  gate: "Cổng nhiệm vụ: vào màn",
};
/** Thứ tự ưu tiên khi hợp đồng có nhiều điểm cùng lúc */
const PIN_RANK: Pin["kind"][] = ["gate", "objective", "car", "extract", "crate", "marker", "battery"];

export function currentObjective(): Objective | null {
  const g = useGame.getState();
  const me = playerPos();
  if (!me) return null;

  if (useHunter.getState().contract && g.location === "city") {
    const pins = contractPins();
    for (const kind of PIN_RANK) {
      const list = pins.filter((p) => p.kind === kind);
      if (!list.length) continue;
      const best = list.reduce((a, b) => (dist(a, me) < dist(b, me) ? a : b));
      return { x: best.x, z: best.z, label: PIN_LABEL[kind], color: best.color };
    }
  }

  const q = questById(g.quest.active);
  const step = currentStep();
  if (step?.kind === "kill" && g.location === "city" && HUB_PEACEFUL) {
    // Hạ địch giờ diễn ra trong màn sau cổng nhiệm vụ
    return { x: MISSION_GATE.x, z: MISSION_GATE.z, label: `${q?.title ?? "Hạ Legion"} · qua cổng`, color: "#b05cff" };
  }
  if (step?.kind === "kill" && g.location === "city") {
    // Bước "hạ Legion": chỉ tới drone/lính Legion còn sống gần nhất
    let best: { x: number; z: number } | null = null;
    for (const d of drones) {
      if (d.state === "dead" || (d.kind !== "legion" && d.kind !== "trooper")) continue;
      if (!best || dist(d.pos, me) < dist(best, me)) best = { x: d.pos.x, z: d.pos.z };
    }
    if (best) return { ...best, label: q?.title ?? "Hạ Legion", color: "#ff2a6d" };
  }
  const t = objectiveTarget();
  if (t) return { x: t.x, z: t.z, label: q?.title ?? "Nhiệm vụ tiếp theo", color: "#ffb000" };
  return null;
}

function dist(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Vị trí người chơi (hoặc xe đang lái) */
export function playerPos(): { x: number; z: number } | null {
  const g = useGame.getState();
  const car = g.mode === "drive" && g.carId !== null ? handles.cars.get(g.carId) : null;
  const p = car ? car.currPos : handles.player?.currPos;
  return p ? { x: p.x, z: p.z } : null;
}

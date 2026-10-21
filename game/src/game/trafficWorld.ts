// Cầu nối giữa lõi mô phỏng giao thông (src/traffic) và game: một bản đồ đường, một bộ xe, một bộ người đi bộ,
// một đồng hồ đèn chung. Các component hiển thị chỉ đọc trạng thái ở đây.

import { buildRoadNetwork, type ParkingBay } from "../traffic/road";
import { buildPedGraph, PedSim } from "../traffic/peds";
import { VehicleSim, type Obstacle } from "../traffic/vehicles";
import { TUNING } from "../traffic/tuning";
import type { ExtraModel } from "./assets";
import { mulberry32 } from "./config";
import { handles } from "./refs";
import { useGame } from "./store";

export const ROAD = buildRoadNetwork();
export const PED_GRAPH = buildPedGraph(ROAD);

/** Model xe Meshy có đầu xe hướng -X: quay +90° để đầu xe hướng +Z */
export const CAR_YAW = Math.PI / 2;

/** Xe chạy trên phố: model, chiều dài (m), góc quay riêng nếu đầu xe không hướng -X */
export const DRIVE_MODELS: { name: ExtraModel; length: number; yaw?: number }[] = [
  { name: "mx_car_sedan", length: 4.8 },
  { name: "mx_car_taxi", length: 4.3 },
  { name: "mx_car_police", length: 4.9 },
  { name: "mx_car_sports", length: 4.6 },
  { name: "mx_car_muscle", length: 5 },
  { name: "mx_car_van", length: 5.2 },
  { name: "mx_car_truck", length: 9 },
  { name: "mx_car_armored", length: 5.4 },
  { name: "mx_veh_ambulance", length: 5.6 },
  { name: "mx_veh_limo", length: 6.4 },
  // Xe buýt dựng đầu xe hướng +X
  { name: "mx_veh_bus", length: 11, yaw: -Math.PI / 2 },
  { name: "mx_veh_hovertruck", length: 7 },
  { name: "mx_veh_garbage_truck", length: 8 },
];
export const TRAFFIC_LENGTHS = DRIVE_MODELS.map((m) => m.length);

export const traffic = {
  /** Đồng hồ đèn giao thông (giây), chạy theo thời gian game */
  time: 0,
  vehicles: null as VehicleSim | null,
  peds: null as PedSim | null,
  /** Chia người đi bộ theo loại hình: [0, crowd) avatar, rồi dân thường Meshy, rồi robot */
  mix: { crowd: 0, civ: 0, robot: 0 },
  /** Số bánh xe tách được cho từng model (debug) */
  wheelInfo: {} as Record<string, number>,
  /** Bật bằng phím F3 hoặc ?debug=traffic */
  debug: typeof location !== "undefined" && /debug=traffic/.test(location.search),
};

/** Tạo bộ mô phỏng (một lần, theo chất lượng đồ hoạ lúc khởi động) */
export function ensureTraffic() {
  if (traffic.vehicles && traffic.peds) return traffic;
  const quality = useGame.getState().quality;
  traffic.vehicles = new VehicleSim(ROAD, TRAFFIC_LENGTHS, TUNING.vehicles.count[quality], mulberry32(4242));
  const mix = TUNING.peds.mix[quality];
  traffic.peds = new PedSim(ROAD, PED_GRAPH, mix.crowd + mix.civ + mix.robot, mulberry32(2024));
  traffic.mix = mix;
  return traffic;
}

/** Tiếng súng / nổ: người đi bộ quanh đó bỏ chạy */
export function alarm(x: number, z: number) {
  traffic.peds?.alarm(x, z);
}

const obstacles: Obstacle[] = [];

/** Một bước mô phỏng cho cả thành phố, gọi một lần mỗi frame */
export function stepTraffic(dt: number) {
  const step = Math.min(dt, 0.1);
  traffic.time += step;
  const g = useGame.getState();
  const driving = g.mode === "drive" && g.carId !== null ? handles.cars.get(g.carId) : null;
  const player = handles.player?.currPos;

  // Người đi bộ né người chơi (hoặc xe người chơi đang lái)
  const who = driving ? driving.currPos : g.mode === "foot" ? player : null;
  traffic.peds?.update(step, traffic.time, { player: who ? { x: who.x, z: who.z } : null });

  // Vật cản cho xe tự lái: người chơi, mọi xe lái được (đang lái hoặc đang đỗ), người đi bộ trên lòng đường
  obstacles.length = 0;
  if (player && g.mode === "foot" && g.location === "city") {
    const v = handles.player!.currLinVel;
    obstacles.push({ x: player.x, z: player.z, vx: v.x, vz: v.z, r: 0.5, kind: "player" });
  }
  handles.cars.forEach((car) => {
    const p = car.currPos;
    const v = car.currLinVel;
    obstacles.push({ x: p.x, z: p.z, vx: v.x, vz: v.z, r: 2.3, kind: "car" });
  });
  if (traffic.peds) for (const p of traffic.peds.peds) if (traffic.peds.onRoad(p) || p.state === "flee") {
    obstacles.push({ x: p.x, z: p.z, vx: Math.sin(p.yaw) * p.speed, vz: Math.cos(p.yaw) * p.speed, r: 0.45, kind: "ped" });
  }
  traffic.vehicles?.update(step, traffic.time, obstacles);
}

// ---------------------------------------------------------------------------
// Ô đỗ xe: xe đậu cố định và xe lái được dùng chung một danh sách ô, không chồng lên nhau

const taken = new Map<number, string>();

export function claimBay(bay: ParkingBay, owner: string) {
  taken.set(bay.id, owner);
}

export function releaseBays(owner: string) {
  for (const [id, who] of taken) if (who === owner) taken.delete(id);
}

export function isBayFree(id: number, owner?: string) {
  const who = taken.get(id);
  return who === undefined || who === owner;
}

/** Ô trống gần điểm (x, z) nhất */
export function nearestFreeBay(x: number, z: number, owner?: string, skip?: (b: ParkingBay) => boolean) {
  let best: ParkingBay | null = null;
  let bestD = Infinity;
  for (const b of ROAD.bays) {
    if (!isBayFree(b.id, owner) || skip?.(b)) continue;
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

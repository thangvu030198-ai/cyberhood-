import * as THREE from "three";
import { BLOCK_CENTERS, BOARD_SPOT, CITY, CITY_PITCH, HUB_PEACEFUL, MISSION_GATE, PLAYER, inSafeZone } from "./config";
import { GAME } from "../sim/config";
import {
  addKill,
  canExtract,
  completeEvent,
  completeMission,
  lootSupplyDrop,
  startContract,
  tickContract,
  timeLeft,
  type Marker,
  type Vec2,
} from "../sim/contract";
import { gainMeter } from "../sim/transform";
import { RARITY_COLOR, type MechPart } from "../sim/loot";
import type { MechSlot } from "../sim/config";
import { despawnSpecial, drones, onDroneKilled, spawnSpecial, specialDrone } from "./Enemies";
import { handles } from "./refs";
import { useGame } from "./store";
import { useHunter } from "./hunter";
import { playSfx } from "./assets";

// Điều khiển hợp đồng 7 phút trong Neon City: đặt marker trên phố, chạy 4 loại nhiệm vụ
// (đua xe, cướp xe, giao hàng, rượt đuổi), sự kiện phút 4, điểm thoát. Quy tắc thưởng phạt nằm ở sim/contract.

/** Bảng hợp đồng ở Vùng An toàn, cạnh điểm xuất phát */
export const BOARD_POS = new THREE.Vector3(BOARD_SPOT.x, BOARD_SPOT.y, BOARD_SPOT.z);
const BOARD_REACH = 3.2;

const STREETS = Array.from({ length: CITY.GRID + 1 }, (_, i) => (i - CITY.GRID / 2) * CITY_PITCH);
const LANE = 3.5;
const MARKER_REACH = 6;
const CHECKPOINT_REACH = 8;

/** Mọi điểm đặt marker: giữa lòng đường, ngay cạnh mỗi khối nhà */
export const MARKER_SPOTS: Vec2[] = (() => {
  const out: Vec2[] = [];
  for (const s of STREETS) {
    for (const b of BLOCK_CENTERS) {
      out.push({ x: s + LANE, z: b }, { x: b, z: s - LANE });
    }
  }
  return out.filter((p) => Math.hypot(p.x - PLAYER.spawn[0], p.z - PLAYER.spawn[2]) > 30);
})();

/** Điểm thoát: các ngã tư vành ngoài thành phố */
const EDGE = STREETS[STREETS.length - 1];
export const EXTRACT_SPOTS: Vec2[] = [
  { x: EDGE, z: STREETS[1] },
  { x: -EDGE, z: STREETS[3] },
  { x: STREETS[1], z: -EDGE },
  { x: STREETS[3], z: EDGE },
];

export const MISSION_LABEL: Record<string, string> = {
  race: "Đua xe",
  carjack: "Cướp xe",
  delivery: "Giao hàng",
  chase: "Rượt đuổi",
};

export const EVENT_LABEL: Record<string, string> = {
  supply_drop: "Thả hàng tiếp tế",
  wanted_5_star: "Truy nã 5 sao",
  mini_boss_mech: "Trùm Mech",
};

type ActiveMission = {
  markerId: number;
  type: string;
  stage: number;
  /** Các điểm phải tới lần lượt (checkpoint đua, điểm giao) */
  points: Vec2[];
  deadline: number;
  carId: number | null;
};

/** Trạng thái chạy của hợp đồng (không lưu xuống máy) */
export const runtime = {
  mission: null as ActiveMission | null,
  crate: null as Vec2 | null,
  wantedUntil: 0,
  /** Hiệu ứng cột sáng khi rơi đồ */
  beams: [] as { pos: THREE.Vector3; color: string; born: number; slot?: MechSlot }[],
  /** Pin năng lượng nằm trên phố trong hợp đồng: nhặt được +15% thanh biến hình */
  batteries: [] as Vec2[],
  hintAt: 0,
};

const _p = new THREE.Vector3();

function playerPos(): Vec2 | null {
  const s = useGame.getState();
  const car = s.mode === "drive" && s.carId !== null ? handles.cars.get(s.carId) : null;
  const p = car?.currPos ?? handles.player?.currPos;
  return p ? { x: p.x, z: p.z } : null;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

function spotAround(from: Vec2, min: number, max: number): Vec2 {
  const ok = MARKER_SPOTS.filter((p) => {
    const d = dist(p, from);
    return d >= min && d <= max;
  });
  const list = ok.length ? ok : MARKER_SPOTS;
  return list[Math.floor(Math.random() * list.length)];
}

/** Lộ trình đua: đi qua 4 ngã tư liền kề, không quay lại chỗ cũ */
function raceRoute(from: Vec2): Vec2[] {
  const snap = (v: number) => STREETS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  let cur = { x: snap(from.x), z: snap(from.z) };
  const seen = new Set([`${cur.x},${cur.z}`]);
  const route: Vec2[] = [];
  for (let i = 0; i < 4; i++) {
    const next = [
      { x: cur.x + CITY_PITCH, z: cur.z },
      { x: cur.x - CITY_PITCH, z: cur.z },
      { x: cur.x, z: cur.z + CITY_PITCH },
      { x: cur.x, z: cur.z - CITY_PITCH },
    ].filter((p) => STREETS.includes(p.x) && STREETS.includes(p.z) && !seen.has(`${p.x},${p.z}`));
    if (!next.length) break;
    cur = next[Math.floor(Math.random() * next.length)];
    seen.add(`${cur.x},${cur.z}`);
    route.push(cur);
  }
  return route;
}

function toast(text: string) {
  useGame.getState().showToast(text);
}

/** Mở hợp đồng mới (tốn năng lượng). Trả về lý do nếu không mở được */
export function startNewContract(): string | null {
  const h = useHunter.getState();
  if (h.contract) return "Đang có hợp đồng";
  const c = startContract({
    seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
    mapId: "neon_city",
    markerSpots: MARKER_SPOTS,
    extractSpots: EXTRACT_SPOTS,
  });
  // Nhiệm vụ cướp xe đặt ngay tại một chiếc xe đang đậu
  const cars = [...handles.cars.entries()].sort(() => Math.random() - 0.5);
  for (const m of c.markers) {
    if (m.type !== "carjack") continue;
    const pick = cars.pop();
    if (pick) m.pos = { x: pick[1].currPos.x, z: pick[1].currPos.z };
  }
  if (!h.beginContract(c)) return "Hết năng lượng, chờ hồi (1/giờ)";
  runtime.mission = null;
  runtime.crate = null;
  runtime.wantedUntil = 0;
  runtime.batteries = Array.from({ length: GAME.consumables.battery.perMatch }, () => spotAround(playerPos() ?? { x: 0, z: 0 }, 40, 160));
  playSfx("pickup", 0.8);
  toast("Nhận hợp đồng: 6 nhiệm vụ trong 7 phút");
  return null;
}

function failMission(reason: string) {
  const m = runtime.mission;
  if (!m) return;
  if (m.type === "chase") despawnSpecial("courier");
  runtime.mission = null;
  toast(`${MISSION_LABEL[m.type]} thất bại: ${reason}. Có thể làm lại`);
}

function rewardMission(markerId: number) {
  const h = useHunter.getState();
  const c = h.contract;
  if (!c) return;
  const transforming = h.transform.phase === "active";
  const reward = completeMission(c, markerId, { transforming });
  runtime.mission = null;
  if (!reward) return;
  gainMeter(h.transform, "mission");
  showLoot(reward.drop);
  toast(`Hoàn thành nhiệm vụ +${reward.score}${reward.shard ? " · nhặt được Mảnh Chìa" : ""}`);
  useHunter.setState({ contract: c, transform: { ...h.transform } });
}

export function showLoot(part: MechPart) {
  const p = handles.player?.currPos ?? _p.set(0, 0, 0);
  runtime.beams.push({ pos: p.clone(), color: RARITY_COLOR[part.rarity], born: performance.now() / 1000, slot: part.slot });
  useHunter.getState().notifyDrop(part);
  playSfx("pickup", 0.9);
}

function startMission(m: Marker, here: Vec2, elapsed: number) {
  const s = useGame.getState();
  if (m.type === "race") {
    if (s.mode !== "drive") {
      if (elapsed - runtime.hintAt > 6) toast("Đua xe: hãy lái xe vào marker");
      runtime.hintAt = elapsed;
      return;
    }
    runtime.mission = { markerId: m.id, type: m.type, stage: 0, points: raceRoute(here), deadline: elapsed + 45, carId: s.carId };
    toast("Đua xe: qua 4 cổng trong 45 giây");
  } else if (m.type === "delivery") {
    const drop = spotAround(here, 110, 200);
    runtime.mission = { markerId: m.id, type: m.type, stage: 0, points: [drop], deadline: elapsed + Math.round(dist(here, drop) / 5 + 20), carId: null };
    toast("Giao hàng: mang gói hàng tới điểm giao");
  } else if (m.type === "carjack") {
    let best: number | null = null;
    let bestD = Infinity;
    handles.cars.forEach((car, id) => {
      const d = dist({ x: car.currPos.x, z: car.currPos.z }, m.pos);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    });
    runtime.mission = { markerId: m.id, type: m.type, stage: 0, points: [], deadline: elapsed + 75, carId: best };
    toast("Cướp xe: lên chiếc xe được đánh dấu (F) rồi giao tới gara");
  } else if (m.type === "chase") {
    spawnSpecial("courier", _p.set(m.pos.x + 8, 0, m.pos.z + 8));
    runtime.mission = { markerId: m.id, type: m.type, stage: 0, points: [], deadline: elapsed + 60, carId: null };
    toast("Rượt đuổi: hạ drone đưa thư màu vàng trong 60 giây");
  }
}

function updateMission(here: Vec2, elapsed: number) {
  const m = runtime.mission;
  if (!m) return;
  if (elapsed > m.deadline) return failMission("hết giờ");
  const s = useGame.getState();
  if (m.type === "race") {
    if (s.mode !== "drive") return failMission("bỏ xe giữa đường");
    const target = m.points[m.stage];
    if (target && dist(here, target) < CHECKPOINT_REACH) {
      m.stage++;
      playSfx("pickup", 0.5);
      if (m.stage >= m.points.length) rewardMission(m.markerId);
    }
  } else if (m.type === "delivery") {
    if (dist(here, m.points[0]) < MARKER_REACH) rewardMission(m.markerId);
  } else if (m.type === "carjack") {
    if (m.stage === 0 && s.mode === "drive" && s.carId === m.carId) {
      m.stage = 1;
      m.points = [spotAround(here, 100, 190)];
      useGame.setState({ wanted: Math.max(s.wanted, 2), lastCrimeAt: performance.now() / 1000 });
      toast("Đã cướp xe! Lái tới gara, Legion đang đuổi");
    } else if (m.stage === 1) {
      if (s.carId !== m.carId) return; // xuống xe tạm thời không tính là thất bại
      if (dist(here, m.points[0]) < MARKER_REACH + 2) rewardMission(m.markerId);
    }
  }
  // Rượt đuổi hoàn thành qua sự kiện hạ drone
}

function pickBatteries(here: Vec2) {
  const i = runtime.batteries.findIndex((b) => dist(here, b) < 3);
  if (i < 0) return;
  runtime.batteries.splice(i, 1);
  const h = useHunter.getState();
  gainMeter(h.transform, "battery");
  useHunter.setState({ transform: { ...h.transform } });
  playSfx("pickup", 0.8);
  toast(`Nhặt Pin năng lượng: +${GAME.transform.gain.battery}% biến hình`);
}

function updateEvent(here: Vec2, elapsed: number, dt: number) {
  const h = useHunter.getState();
  const c = h.contract!;
  const ev = c.event;
  if (!ev || ev.done) return;
  if (ev.type === "supply_drop" && runtime.crate && dist(here, runtime.crate) < 3.5) {
    const part = lootSupplyDrop(c);
    showLoot(part);
    const score = completeEvent(c);
    runtime.crate = null;
    toast(`Mở hàng tiếp tế +${score}`);
  }
  if (ev.type === "wanted_5_star") {
    // Trốn trong Vùng An toàn không tính: đồng hồ sống sót tạm dừng
    if (inSafeZone(here.x, here.z)) {
      runtime.wantedUntil += dt;
      if (elapsed - runtime.hintAt > 8) {
        runtime.hintAt = elapsed;
        toast("Truy nã: trốn trong Vùng An toàn không tính giờ, ra ngoài để sống sót");
      }
      return;
    }
    // Giữ 5 sao suốt 60 giây
    useGame.setState({ wanted: 5, lastCrimeAt: performance.now() / 1000 });
    if (elapsed >= runtime.wantedUntil) {
      const score = completeEvent(c, { survivedWanted: true });
      useGame.setState({ wanted: 2 });
      toast(`Sống sót qua truy nã 5 sao! +${score}`);
    }
  }
}

function beginEvent(type: string, here: Vec2, elapsed: number) {
  toast(`SỰ KIỆN: ${EVENT_LABEL[type]}`);
  playSfx("enemyAttack", 0.6);
  if (type === "supply_drop") {
    runtime.crate = spotAround(here, 60, 140);
    // Legion gần đó kéo tới tranh hàng
    const crate = runtime.crate;
    drones
      .filter((d) => (d.kind === "legion" || d.kind === "trooper") && d.state !== "dead")
      .sort((a, b) => dist({ x: a.pos.x, z: a.pos.z }, crate) - dist({ x: b.pos.x, z: b.pos.z }, crate))
      .slice(0, 3)
      .forEach((d) => {
        d.home.set(crate.x, d.home.y, crate.z);
        d.state = "chase";
      });
  } else if (type === "wanted_5_star") {
    runtime.wantedUntil = elapsed + 60;
  } else if (type === "mini_boss_mech") {
    const dir = Math.random() * Math.PI * 2;
    spawnSpecial("boss", _p.set(here.x + Math.cos(dir) * 40, 0, here.z + Math.sin(dir) * 40));
  }
}

/** Gọi mỗi frame từ <ContractDirector/> */
export function updateContract(dt: number) {
  const h = useHunter.getState();
  const c = h.contract;
  if (!c) return;
  const g = useGame.getState();
  if (g.flatlinedAt !== null) return endNow("dead");
  if (g.location !== "city" || HUB_PEACEFUL) return;
  const here = playerPos();
  if (!here) return;

  const tick = tickContract(c, dt);
  if (tick === "event_started" && c.event) beginEvent(c.event.type, here, c.elapsed);
  if (tick === "extract_visible") toast("Điểm thoát đã hiện (màu xanh). Tới đó để nhận thưởng!");
  if (tick === "timeout") return endNow("timeout");

  if (!runtime.mission) {
    for (const m of c.markers) {
      if (!m.done && dist(here, m.pos) < MARKER_REACH) {
        startMission(m, here, c.elapsed);
        break;
      }
    }
  }
  updateMission(here, c.elapsed);
  updateEvent(here, c.elapsed, dt);
  pickBatteries(here);

  if (canExtract(c, here)) return endNow("extracted");
}

function endNow(outcome: "extracted" | "dead" | "timeout") {
  despawnSpecial("courier");
  despawnSpecial("boss");
  runtime.mission = null;
  runtime.crate = null;
  runtime.batteries = [];
  const res = useHunter.getState().endContract(outcome);
  document.exitPointerLock?.();
  if (res && outcome === "extracted") playSfx("pickup", 1);
}

/** Bỏ hợp đồng giữa chừng: tính như chết (mất đồ cấp thấp) */
export function abandonContract() {
  endNow("dead");
}

// Hạ drone: cộng kill, thanh biến hình; drone đưa thư/trùm hoàn thành nhiệm vụ/sự kiện
onDroneKilled((d) => {
  const h = useHunter.getState();
  gainMeter(h.transform, "kill");
  const c = h.contract;
  if (c) {
    addKill(c);
    if (d.kind === "courier" && runtime.mission?.type === "chase") rewardMission(runtime.mission.markerId);
    if (d.kind === "boss" && c.event?.type === "mini_boss_mech") {
      const score = completeEvent(c);
      toast(`Hạ trùm Mech! +${score}`);
    }
  }
  useHunter.setState({ transform: { ...h.transform }, contract: c });
});

/** Mục tiêu đang cần tới (cho cột sáng và minimap) */
export type Pin = { x: number; z: number; color: string; kind: "marker" | "objective" | "extract" | "crate" | "car" | "board" | "battery" | "gate" };

export function contractPins(): Pin[] {
  const pins: Pin[] = [];
  const c = useHunter.getState().contract;
  if (HUB_PEACEFUL) {
    // Hub hoà bình: mọi việc đánh đấm nằm sau cổng nhiệm vụ
    if (!c) pins.push({ x: BOARD_POS.x, z: BOARD_POS.z, color: "#ffb000", kind: "board" });
    pins.push({ x: MISSION_GATE.x, z: MISSION_GATE.z, color: "#b05cff", kind: "gate" });
    return pins;
  }
  if (!c) {
    pins.push({ x: BOARD_POS.x, z: BOARD_POS.z, color: "#ffb000", kind: "board" });
    return pins;
  }
  const m = runtime.mission;
  if (m) {
    if (m.type === "carjack" && m.stage === 0 && m.carId !== null) {
      const car = handles.cars.get(m.carId);
      if (car) pins.push({ x: car.currPos.x, z: car.currPos.z, color: "#ff2a6d", kind: "car" });
    } else if (m.type === "chase") {
      const d = specialDrone("courier");
      if (d.state !== "dead") pins.push({ x: d.pos.x, z: d.pos.z, color: "#ffd23d", kind: "objective" });
    } else {
      const p = m.points[m.stage] ?? m.points[0];
      if (p) pins.push({ x: p.x, z: p.z, color: "#05d9e8", kind: "objective" });
    }
  } else {
    for (const mk of c.markers) if (!mk.done) pins.push({ x: mk.pos.x, z: mk.pos.z, color: "#ffb000", kind: "marker" });
  }
  if (runtime.crate) pins.push({ ...runtime.crate, color: "#b05cff", kind: "crate" });
  for (const b of runtime.batteries) pins.push({ ...b, color: "#05d9e8", kind: "battery" });
  if (c.extractVisible) pins.push({ ...c.extract, color: "#39ff88", kind: "extract" });
  return pins;
}

export function nearBoard() {
  const p = handles.player?.currPos;
  return !!p && useGame.getState().mode === "foot" && Math.hypot(p.x - BOARD_POS.x, p.z - BOARD_POS.z) < BOARD_REACH;
}

export const contractTimeLeft = () => {
  const c = useHunter.getState().contract;
  return c ? timeLeft(c) : 0;
};

export const MATCH = GAME.match;

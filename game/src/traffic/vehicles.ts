// Xe tự lái trên bản đồ đường: bám xe phía trước bằng mô hình IDM (tăng tốc / phanh mượt, giữ khoảng cách),
// dừng ở vạch khi đèn đỏ (đèn vàng thì dừng nếu kịp), rẽ ở ngã tư theo đường cong,
// rẽ trái nhường xe đi thẳng ngược chiều, không lao vào ngã tư khi làn ra đang tắc,
// và coi người chơi, xe của người chơi, người đi bộ trên lòng đường là vật cản.

import { axisOf, opposite, pointAt, type Path, type PathPoint, type RoadNetwork, type Turn } from "./road";
import { lightFor } from "./signals";
import { TUNING } from "./tuning";

const V = TUNING.vehicles;

export type Obstacle = {
  x: number;
  z: number;
  /** Vận tốc (để tính chênh lệch tốc độ trong IDM) */
  vx: number;
  vz: number;
  /** Bán kính / nửa chiều dài */
  r: number;
  kind: "player" | "car" | "ped";
};

export type Vehicle = {
  id: number;
  /** Chỉ số model hiển thị */
  model: number;
  halfLen: number;
  path: number;
  s: number;
  v: number;
  a: number;
  /** Các path sẽ đi tiếp (luôn có ít nhất nhánh rẽ + đoạn sau nó khi đang ở đoạn thẳng) */
  route: number[];
  /** Đã quyết định đi qua đèn vàng */
  committed: boolean;
  /** Hệ số tốc độ riêng, để xe không chạy đều như nhau */
  temper: number;
  x: number;
  z: number;
  yaw: number;
  wheel: number;
  braking: boolean;
  /** Đứng chờ bao lâu (chống kẹt khi hai xe chờ nhau) */
  stuck: number;
  /** Lý do đang dừng, cho chế độ debug */
  reason: "" | "leader" | "red" | "yellow" | "yield" | "blocked-exit" | "obstacle";
};

export type Rand = () => number;

export class VehicleSim {
  readonly vehicles: Vehicle[] = [];
  private pt: PathPoint = { x: 0, z: 0, yaw: 0 };

  readonly net: RoadNetwork;
  private rand: Rand;

  constructor(net: RoadNetwork, lengths: number[], count: number, rand: Rand) {
    this.net = net;
    this.rand = rand;
    const segs = net.segments;
    let tries = 0;
    while (this.vehicles.length < count && tries++ < count * 50) {
      const seg = segs[Math.floor(rand() * segs.length)];
      const s = 6 + rand() * (seg.length - 12);
      if (this.vehicles.some((o) => o.path === seg.id && Math.abs(o.s - s) < 14)) continue;
      const model = this.vehicles.length % lengths.length;
      const veh: Vehicle = {
        id: this.vehicles.length,
        model,
        halfLen: lengths[model] / 2,
        path: seg.id,
        s,
        v: V.desiredSpeed * 0.6,
        a: 0,
        route: [],
        committed: false,
        temper: 0.85 + rand() * 0.3,
        x: 0,
        z: 0,
        yaw: 0,
        wheel: rand() * 6,
        braking: false,
        stuck: 0,
        reason: "",
      };
      this.extendRoute(veh);
      this.place(veh);
      this.vehicles.push(veh);
    }
  }

  path(id: number): Path {
    return this.net.paths[id];
  }

  /** Bảo đảm route có nhánh rẽ kế tiếp và đoạn thẳng sau nó */
  private extendRoute(veh: Vehicle) {
    let last = veh.route.length ? this.path(veh.route[veh.route.length - 1]) : this.path(veh.path);
    while (veh.route.length < 2) {
      if (last.kind === "segment") {
        const choice = this.chooseTurn(last.next.map((id) => this.path(id)));
        veh.route.push(choice.id);
        last = choice;
      } else {
        veh.route.push(last.next[0]);
        last = this.path(last.next[0]);
      }
    }
  }

  private chooseTurn(options: Path[]): Path {
    const w = (t: Turn) => (t === "straight" ? V.turnWeights.straight : t === "right" ? V.turnWeights.right : t === "left" ? V.turnWeights.left : 0.01);
    const total = options.reduce((acc, p) => acc + w(p.turn), 0);
    let r = this.rand() * total;
    for (const p of options) if ((r -= w(p.turn)) < 0) return p;
    return options[options.length - 1];
  }

  private place(veh: Vehicle) {
    const p = pointAt(this.path(veh.path), veh.s, this.pt);
    veh.x = p.x;
    veh.z = p.z;
    veh.yaw = p.yaw;
  }

  /** Duyệt các điểm mẫu phía trước trên route, trả về false để dừng sớm */
  private walkRoute(veh: Vehicle, maxAhead: number, cb: (x: number, z: number, ahead: number, tx: number, tz: number) => boolean | void) {
    let path = this.path(veh.path);
    let base = -veh.s;
    let k = 0;
    while (true) {
      const cum = path.cum;
      for (let i = 0; i < cum.length - 1; i++) {
        const ahead = base + cum[i];
        if (ahead < 0) continue;
        if (ahead > maxAhead) return;
        const x = path.pts[i * 2];
        const z = path.pts[i * 2 + 1];
        const tx = path.pts[i * 2 + 2] - x;
        const tz = path.pts[i * 2 + 3] - z;
        const tl = Math.hypot(tx, tz) || 1;
        if (cb(x, z, ahead, tx / tl, tz / tl) === false) return;
      }
      base += path.length;
      if (k >= veh.route.length) return;
      path = this.path(veh.route[k++]);
    }
  }

  /** Gia tốc IDM với một "xe dẫn" cách `gap` mét, chạy tốc độ `vl` */
  private idm(v: number, v0: number, gap: number, vl: number) {
    const free = 1 - Math.pow(v / Math.max(v0, 0.1), 4);
    if (gap === Infinity) return V.maxAccel * free;
    const sStar = V.minGap + Math.max(0, v * V.headway + (v * (v - vl)) / (2 * Math.sqrt(V.maxAccel * V.comfortDecel)));
    const g = Math.max(gap, 0.05);
    return V.maxAccel * (free - (sStar / g) * (sStar / g));
  }

  /** Tốc độ mong muốn: chậm lại trước khúc cua sắp tới và trong khúc cua */
  private desired(veh: Vehicle) {
    const path = this.path(veh.path);
    const cruise = V.desiredSpeed * veh.temper;
    const turnSpeed = (t: Turn) => (t === "right" ? V.turnSpeedRight : t === "left" ? V.turnSpeedLeft : cruise);
    if (path.kind === "connector") return Math.min(cruise, turnSpeed(path.turn));
    const next = this.path(veh.route[0]);
    const vt = turnSpeed(next.turn);
    const dist = path.length - veh.s;
    // Tốc độ tối đa để kịp phanh êm xuống tốc độ vào cua
    return Math.min(cruise, Math.sqrt(vt * vt + 2 * V.comfortDecel * 0.7 * Math.max(0, dist)));
  }

  /**
   * Một bước mô phỏng.
   * @param t đồng hồ dùng cho đèn giao thông (giây)
   * @param obstacles vật cản ngoài (người chơi, xe người chơi, người đi bộ trên lòng đường)
   */
  update(dt: number, t: number, obstacles: Obstacle[]) {
    if (dt <= 0) return;
    const all: Obstacle[] = obstacles.slice();
    const vehObs = this.vehicles.map((o) => ({ x: o.x, z: o.z, vx: Math.sin(o.yaw) * o.v, vz: Math.cos(o.yaw) * o.v, r: o.halfLen, kind: "car" as const, yaw: o.yaw, id: o.id }));

    for (const veh of this.vehicles) {
      const path = this.path(veh.path);
      const v0 = this.desired(veh);
      let acc = this.idm(veh.v, v0, Infinity, 0);
      let reason = "" as Vehicle["reason"];
      const consider = (gap: number, vl: number, why: Vehicle["reason"]) => {
        const a = this.idm(veh.v, v0, gap, vl);
        if (a < acc) {
          acc = a;
          reason = why;
        }
      };

      // 1) Đèn giao thông, nhường rẽ trái, làn ra tắc: chỉ áp dụng khi còn đang trên đoạn thẳng
      if (path.kind === "segment") {
        const jn = this.net.junctions[path.to];
        const toLine = path.length - veh.s - veh.halfLen;
        const light = lightFor(jn, axisOf(path.dir), t);
        if (toLine > -0.5) {
          if (light === "red" && !veh.committed) consider(toLine + 0.3, 0, "red");
          else if (light === "yellow" && !veh.committed) {
            const brake = (veh.v * veh.v) / (2 * V.comfortDecel);
            if (toLine > brake * V.yellowStopMargin) consider(toLine + 0.3, 0, "yellow");
            else veh.committed = true;
          } else if (light === "green") veh.committed = toLine < 3 || veh.committed;
          const next = this.path(veh.route[0]);
          if (next.turn === "left" && toLine < 25 && this.mustYieldLeft(veh, path)) consider(toLine + 0.3, 0, "yield");
          if (toLine < 20 && this.exitBlocked(veh, next)) consider(toLine + 0.3, 0, "blocked-exit");
        }
      }

      // 2) Xe phía trước và vật cản trong hành lang làn
      const ignoreCrossing = veh.stuck > 6;
      const look = V.lookahead + veh.halfLen;
      const near: { o: Obstacle; yaw?: number; id?: number; best: number; ahead: number; tx: number; tz: number }[] = [];
      for (const o of [...all, ...vehObs]) {
        if ((o as { id?: number }).id === veh.id) continue;
        const dx = o.x - veh.x;
        const dz = o.z - veh.z;
        if (dx * dx + dz * dz > look * look) continue;
        // Chỉ xét vật ở phía trước
        if (dx * Math.sin(veh.yaw) + dz * Math.cos(veh.yaw) < -0.5) continue;
        near.push({ o, yaw: (o as { yaw?: number }).yaw, id: (o as { id?: number }).id, best: Infinity, ahead: 0, tx: 0, tz: 0 });
      }
      if (near.length) {
        this.walkRoute(veh, look, (x, z, ahead, tx, tz) => {
          for (const n of near) {
            const d = Math.hypot(n.o.x - x, n.o.z - z);
            if (d < n.best) {
              n.best = d;
              n.ahead = ahead;
              n.tx = tx;
              n.tz = tz;
            }
          }
        });
        for (const n of near) {
          if (n.best > V.laneHalfWidth + (n.o.kind === "car" ? 0.6 : n.o.r)) continue;
          const isVeh = n.id !== undefined;
          if (isVeh) {
            // Xe cắt ngang (lệch hướng nhiều): chỉ chờ nếu chưa kẹt quá lâu
            const diff = Math.abs(Math.atan2(Math.sin(n.yaw! - Math.atan2(n.tx, n.tz)), Math.cos(n.yaw! - Math.atan2(n.tx, n.tz))));
            if (diff > Math.PI / 3 && ignoreCrossing) continue;
          }
          const vl = n.o.vx * n.tx + n.o.vz * n.tz;
          const gap = n.ahead - veh.halfLen - (n.o.kind === "car" ? n.o.r : n.o.r + 0.4);
          consider(gap, Math.max(0, vl), isVeh ? "leader" : "obstacle");
        }
      }

      acc = Math.max(-V.maxDecel, Math.min(V.maxAccel, acc));
      veh.a = acc;
      veh.reason = acc < -0.05 || veh.v < 0.2 ? reason : "";
      veh.v = Math.max(0, veh.v + acc * dt);
      veh.s += veh.v * dt;
      veh.braking = acc < V.brakeLightDecel || (veh.v < 0.3 && reason !== "");
      veh.wheel += (veh.v * dt) / V.wheelRadius;
      veh.stuck = veh.v < 0.3 && reason !== "red" && reason !== "yellow" ? veh.stuck + dt : 0;

      // 3) Sang path kế tiếp
      let p = this.path(veh.path);
      while (veh.s > p.length) {
        veh.s -= p.length;
        veh.path = veh.route.shift()!;
        p = this.path(veh.path);
        if (p.kind === "segment") veh.committed = false;
        this.extendRoute(veh);
      }
      this.place(veh);
    }
  }

  /** Rẽ trái: chờ nếu có xe ngược chiều đang tới gần hoặc đang trong ngã tư đi thẳng / rẽ phải */
  private mustYieldLeft(veh: Vehicle, seg: Path) {
    const against = opposite(seg.dir);
    for (const o of this.vehicles) {
      if (o === veh) continue;
      const op = this.path(o.path);
      if (op.kind === "segment" && op.to === seg.to && op.dir === against) {
        const toLine = op.length - o.s;
        const next = this.path(o.route[0]);
        if (next.turn !== "left" && toLine < V.leftYieldDistance && (o.v > 1 || toLine < 6)) return true;
      } else if (op.kind === "connector" && op.from === seg.to && op.dir === against && op.turn !== "left") return true;
    }
    return false;
  }

  /** Làn ra sau ngã tư đã kín chỗ: đừng chạy vào giữa ngã tư rồi kẹt lại */
  private exitBlocked(veh: Vehicle, connector: Path) {
    const exitId = connector.next[0];
    for (const o of this.vehicles) {
      if (o === veh) continue;
      if (o.path === exitId && o.s < o.halfLen + veh.halfLen * 2 + V.minGap && o.v < 1) return true;
    }
    return false;
  }
}

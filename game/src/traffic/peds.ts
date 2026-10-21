// Người đi bộ: đi theo lộ trình trên mạng lối đi vỉa hè (vòng quanh từng khối nhà + vạch sang đường),
// chờ đèn đi bộ rồi mới sang đường ở vạch, tự né nhau và né người chơi bằng cách lệch sang một bên,
// thỉnh thoảng dừng chân, và bỏ chạy khi nghe tiếng súng.

import { lightFor, walkTimeLeft } from "./signals";
import type { Axis, RoadNetwork } from "./road";
import { TUNING } from "./tuning";
import type { Rand } from "./vehicles";

const P = TUNING.peds;

export type PedNode = { id: number; x: number; z: number; edges: number[] };
export type PedEdge = {
  id: number;
  a: number;
  b: number;
  len: number;
  kind: "side" | "cross";
  /** Với vạch sang đường: ngã tư và trục đi bộ để hỏi đèn */
  junction: number;
  walkAxis: Axis;
};

export type PedGraph = { nodes: PedNode[]; edges: PedEdge[] };

/** Mạng lối đi: 4 góc mỗi khối nhà, cạnh dọc vỉa hè và cạnh băng qua vạch sang đường */
export function buildPedGraph(net: RoadNetwork): PedGraph {
  const R = TUNING.road;
  const pitch = R.block + R.street;
  const r = P.walkRing;
  const blocks = net.streets.slice(0, -1).map((s) => s + pitch / 2);
  const nodes: PedNode[] = [];
  const edges: PedEdge[] = [];
  const nodeAt = new Map<string, PedNode>();
  const key = (x: number, z: number) => `${Math.round(x * 10)}:${Math.round(z * 10)}`;
  const node = (x: number, z: number) => {
    const k = key(x, z);
    let n = nodeAt.get(k);
    if (!n) {
      n = { id: nodes.length, x, z, edges: [] };
      nodes.push(n);
      nodeAt.set(k, n);
    }
    return n;
  };
  const link = (a: PedNode, b: PedNode, kind: PedEdge["kind"], junction = -1, walkAxis: Axis = "x") => {
    const e: PedEdge = { id: edges.length, a: a.id, b: b.id, len: Math.hypot(b.x - a.x, b.z - a.z), kind, junction, walkAxis };
    edges.push(e);
    a.edges.push(e.id);
    b.edges.push(e.id);
  };
  // Cạnh dọc vỉa hè quanh mỗi khối
  for (const bx of blocks) {
    for (const bz of blocks) {
      const c = [node(bx + r, bz + r), node(bx - r, bz + r), node(bx - r, bz - r), node(bx + r, bz - r)];
      for (let k = 0; k < 4; k++) link(c[k], c[(k + 1) % 4], "side");
    }
  }
  // Vạch sang đường giữa hai khối kề nhau, ở cả hai đầu dãy nhà
  for (let i = 0; i < blocks.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      const bx = blocks[i];
      const bz = blocks[j];
      if (i < blocks.length - 1) {
        // Băng qua đường chạy dọc Z (tại x giữa hai khối), người đi dọc trục X
        for (const side of [1, -1]) {
          const z = bz + side * r;
          const jn = net.junctionAt(i + 1, j + (side > 0 ? 1 : 0))!;
          link(node(bx + r, z), node(blocks[i + 1] - r, z), "cross", jn.id, "x");
        }
      }
      if (j < blocks.length - 1) {
        // Băng qua đường chạy dọc X, người đi dọc trục Z
        for (const side of [1, -1]) {
          const x = bx + side * r;
          const jn = net.junctionAt(i + (side > 0 ? 1 : 0), j + 1)!;
          link(node(x, bz + r), node(x, blocks[j + 1] - r), "cross", jn.id, "z");
        }
      }
    }
  }
  return { nodes, edges };
}

export type PedState = "walk" | "wait" | "cross" | "rest" | "flee";

export type Ped = {
  id: number;
  edge: number;
  /** Đi từ a sang b (true) hay ngược lại */
  forward: boolean;
  /** Quãng đường đã đi trên cạnh hiện tại */
  s: number;
  /** Lệch ngang khỏi tim lối đi (dương = bên phải hướng đi) */
  lateral: number;
  baseSpeed: number;
  /** Tốc độ thực tế (cho animation) */
  speed: number;
  state: PedState;
  timer: number;
  x: number;
  z: number;
  yaw: number;
  /** Cạnh trước đó, để tránh quay đầu ngay */
  prevEdge: number;
  fleeFrom: { x: number; z: number } | null;
  /** Đứng kẹt bao lâu (để gỡ kẹt) */
  blocked: number;
};

export type PedEnv = {
  /** Vị trí người chơi (hoặc xe người chơi), null nếu không có */
  player: { x: number; z: number } | null;
};

export class PedSim {
  readonly peds: Ped[] = [];
  private grid = new Map<number, Ped[]>();

  readonly net: RoadNetwork;
  readonly graph: PedGraph;
  private rand: Rand;

  constructor(
    net: RoadNetwork,
    graph: PedGraph,
    count: number,
    rand: Rand,
    /** Vị trí không được đặt người lúc đầu (ví dụ gần NPC cốt truyện) */
    avoid: (x: number, z: number) => boolean = () => false,
  ) {
    this.net = net;
    this.graph = graph;
    this.rand = rand;
    const sides = graph.edges.filter((e) => e.kind === "side");
    let tries = 0;
    while (this.peds.length < count && tries++ < count * 40) {
      const e = sides[Math.floor(rand() * sides.length)];
      const s = rand() * e.len;
      const forward = rand() < 0.5;
      const ped: Ped = {
        id: this.peds.length,
        edge: e.id,
        forward,
        s,
        lateral: (rand() - 0.5) * P.laneHalfWidth,
        baseSpeed: P.walkSpeed[0] + rand() * (P.walkSpeed[1] - P.walkSpeed[0]),
        speed: 0,
        state: "walk",
        timer: 0,
        x: 0,
        z: 0,
        yaw: 0,
        prevEdge: -1,
        fleeFrom: null,
        blocked: 0,
      };
      this.place(ped);
      if (avoid(ped.x, ped.z)) continue;
      if (this.peds.some((o) => Math.hypot(o.x - ped.x, o.z - ped.z) < 2)) continue;
      this.peds.push(ped);
    }
  }

  private ends(ped: Ped) {
    const e = this.graph.edges[ped.edge];
    const a = this.graph.nodes[ped.forward ? e.a : e.b];
    const b = this.graph.nodes[ped.forward ? e.b : e.a];
    return { e, a, b };
  }

  private place(ped: Ped) {
    const { e, a, b } = this.ends(ped);
    const dx = (b.x - a.x) / e.len;
    const dz = (b.z - a.z) / e.len;
    // bên phải hướng đi: (-dz, dx)
    ped.x = a.x + dx * ped.s - dz * ped.lateral;
    ped.z = a.z + dz * ped.s + dx * ped.lateral;
    return { dx, dz };
  }

  /** Tiếng súng: người đi bộ trong bán kính bỏ chạy ra xa */
  alarm(x: number, z: number) {
    for (const p of this.peds) {
      if (Math.hypot(p.x - x, p.z - z) > P.panicRadius) continue;
      p.state = "flee";
      p.timer = P.panicTime[0] + this.rand() * (P.panicTime[1] - P.panicTime[0]);
      p.fleeFrom = { x, z };
      // Đang đi về phía tiếng súng thì quay đầu
      const { a, b } = this.ends(p);
      const toward = Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z);
      if (toward) {
        p.forward = !p.forward;
        p.s = this.graph.edges[p.edge].len - p.s;
        p.lateral = -p.lateral;
      }
    }
  }

  /** Người đi bộ đang ở trên lòng đường (đang băng qua vạch) */
  onRoad(p: Ped) {
    // Hai đầu cạnh băng qua đường còn ~2.6m vỉa hè
    const e = this.graph.edges[p.edge];
    return e.kind === "cross" && p.s > 2.3 && p.s < e.len - 2.3;
  }

  private pickNext(ped: Ped, node: number): { edge: number; forward: boolean } {
    const n = this.graph.nodes[node];
    let options = n.edges.filter((id) => id !== ped.edge);
    if (options.length === 0) options = n.edges;
    let id: number;
    if (ped.state === "flee" && ped.fleeFrom) {
      // Chọn hướng làm tăng khoảng cách tới nơi nổ súng nhiều nhất
      const from = ped.fleeFrom;
      id = options.reduce((best, cur) => (this.farEnd(cur, node, from) > this.farEnd(best, node, from) ? cur : best), options[0]);
    } else {
      // Ưu tiên đi tiếp dọc vỉa hè; sang đường với xác suất vừa phải
      const weights = options.map((o) => (this.graph.edges[o].kind === "cross" ? 0.35 : 1));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = this.rand() * total;
      id = options[options.length - 1];
      for (let k = 0; k < options.length; k++) if ((r -= weights[k]) < 0) {
        id = options[k];
        break;
      }
    }
    const e = this.graph.edges[id];
    return { edge: id, forward: e.a === node };
  }

  private farEnd(edgeId: number, from: number, shot: { x: number; z: number }) {
    const e = this.graph.edges[edgeId];
    const other = this.graph.nodes[e.a === from ? e.b : e.a];
    return Math.hypot(other.x - shot.x, other.z - shot.z);
  }

  private bucket(x: number, z: number) {
    return Math.floor(x / 4) * 10007 + Math.floor(z / 4);
  }

  update(dt: number, t: number, env: PedEnv) {
    if (dt <= 0) return;
    // Lưới không gian 4m để tìm hàng xóm nhanh
    this.grid.clear();
    for (const p of this.peds) {
      const k = this.bucket(p.x, p.z);
      const list = this.grid.get(k);
      if (list) list.push(p);
      else this.grid.set(k, [p]);
    }

    for (const ped of this.peds) {
      const { e } = this.ends(ped);
      let target = ped.state === "flee" ? P.runSpeed : ped.baseSpeed;

      if (ped.state === "flee") {
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.state = e.kind === "cross" ? "cross" : "walk";
          ped.fleeFrom = null;
        }
      } else if (ped.state === "rest") {
        ped.timer -= dt;
        target = 0;
        if (ped.timer <= 0) ped.state = "walk";
      } else if (ped.state === "wait") {
        target = 0;
        const jn = this.net.junctions[e.junction];
        if (walkTimeLeft(jn, e.walkAxis, t) >= P.minWalkLeft) ped.state = "cross";
      }

      // Né nhau và né người chơi: chỉnh lệch ngang, giảm tốc nếu ngay phía trước có người
      const { a, b } = this.ends(ped);
      const dx = (b.x - a.x) / e.len;
      const dz = (b.z - a.z) / e.len;
      let push = 0;
      let slow = 1;
      const consider = (ox: number, oz: number, radius: number, avoidDist: number) => {
        const rx = ox - ped.x;
        const rz = oz - ped.z;
        const along = rx * dx + rz * dz;
        const side = -rx * dz + rz * dx; // dương = vật ở bên phải
        if (along < -0.3 || along > avoidDist) return;
        const clearance = radius + P.radius;
        if (Math.abs(side) > clearance + 0.4) return;
        // Lệch về phía ngược với vật cản, càng gần càng mạnh
        const k = 1 - along / avoidDist;
        push += (side >= 0 ? -1 : 1) * k * 2.2;
        // Chỉ giảm tốc vì người/vật ở phía trước (người phía sau tự lo né)
        if (along > 0 && along < clearance + 0.3 && Math.abs(side) < clearance) slow = Math.min(slow, Math.max(0, (along - 0.2) / (clearance + 0.1)));
      };
      const kx = Math.floor(ped.x / 4);
      const kz = Math.floor(ped.z / 4);
      for (let ix = kx - 1; ix <= kx + 1; ix++) {
        for (let iz = kz - 1; iz <= kz + 1; iz++) {
          const list = this.grid.get(ix * 10007 + iz);
          if (!list) continue;
          for (const o of list) if (o !== ped) consider(o.x, o.z, P.radius, 1.8);
        }
      }
      if (env.player) consider(env.player.x, env.player.z, 0.45, P.playerAvoid);
      const half = e.kind === "cross" ? 1.4 : P.laneHalfWidth;
      ped.lateral = Math.max(-half, Math.min(half, ped.lateral + push * dt));
      // Không có gì để né thì dần về làn bên phải của lối đi (người ngược chiều đi bên kia)
      if (push === 0) ped.lateral += (half * 0.45 - ped.lateral) * Math.min(1, dt * 0.6);

      // Gỡ kẹt: bị chặn đứng quá lâu (hai người chờ nhau ở góc phố) thì lách sang phía kia và đi chậm qua
      const moving = ped.state === "walk" || ped.state === "cross" || ped.state === "flee";
      ped.blocked = moving && slow < 0.15 ? ped.blocked + dt : Math.max(0, ped.blocked - dt * 2);
      if (ped.blocked > 1.5) {
        slow = 0.45;
        ped.lateral += (-Math.sign(ped.lateral || 1) * half - ped.lateral) * Math.min(1, dt * 3);
        if (ped.blocked > 3.5) ped.blocked = 0;
      }
      target *= slow;
      // Tăng/giảm tốc mượt (không giật từ đứng sang chạy)
      const accel = ped.state === "flee" ? 6 : 2.2;
      ped.speed += Math.max(-accel * dt * 2, Math.min(accel * dt, target - ped.speed));
      ped.s += ped.speed * dt;

      // Hết cạnh: chọn cạnh tiếp theo
      if (ped.s >= e.len) {
        const endNode = ped.forward ? e.b : e.a;
        const over = ped.s - e.len;
        const next = this.pickNext(ped, endNode);
        ped.prevEdge = ped.edge;
        ped.edge = next.edge;
        ped.forward = next.forward;
        ped.s = Math.min(over, 0.5);
        const ne = this.graph.edges[next.edge];
        if (ped.state !== "flee") {
          if (ne.kind === "cross") {
            const jn = this.net.junctions[ne.junction];
            ped.state = walkTimeLeft(jn, ne.walkAxis, t) >= P.minWalkLeft ? "cross" : "wait";
            if (ped.state === "wait") ped.s = 0;
          } else {
            ped.state = this.rand() < P.restChance ? "rest" : "walk";
            if (ped.state === "rest") ped.timer = P.restTime[0] + this.rand() * (P.restTime[1] - P.restTime[0]);
          }
        }
      }

      const dir = this.place(ped);
      if (ped.speed > 0.05 || ped.state === "wait") {
        const yaw = Math.atan2(dir.dx, dir.dz);
        const d = Math.atan2(Math.sin(yaw - ped.yaw), Math.cos(yaw - ped.yaw));
        ped.yaw += d * Math.min(1, dt * 8);
      }
    }
  }

  /** Có người đi bộ đang băng qua vạch khi đèn xe song song... dùng cho test: người sang đường sai đèn */
  crossingAgainstLight(t: number) {
    return this.peds.filter((p) => {
      const e = this.graph.edges[p.edge];
      if (e.kind !== "cross" || p.state === "flee" || !this.onRoad(p)) return false;
      // Vào đường khi được đi thì có thể vẫn đang đi lúc đèn đã chuyển; chỉ tính là sai khi xe cắt ngang đã xanh quá 4s
      const jn = this.net.junctions[e.junction];
      const crossAxis: Axis = e.walkAxis === "x" ? "z" : "x";
      return lightFor(jn, crossAxis, t) === "green" && lightFor(jn, crossAxis, t - 4) === "green";
    });
  }
}

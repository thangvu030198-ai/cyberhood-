import { describe, expect, it } from "vitest";
import { buildRoadNetwork, DIRS, pointAt, turnBetween, type Dir } from "./road";
import { CYCLE, lightFor, pedLightFor, walkTimeLeft } from "./signals";
import { VehicleSim, type Obstacle } from "./vehicles";
import { buildPedGraph, PedSim } from "./peds";
import { TUNING } from "./tuning";

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const net = buildRoadNetwork();

describe("bản đồ đường", () => {
  it("có 25 ngã tư, góc thành phố chỉ có 2 nhánh, ngã tư giữa có 4 nhánh", () => {
    expect(net.junctions.length).toBe(25);
    expect(net.junctionAt(0, 0)!.arms.filter(Boolean).length).toBe(2);
    expect(net.junctionAt(2, 2)!.arms.filter(Boolean).length).toBe(4);
    expect(net.junctionAt(0, 2)!.arms.filter(Boolean).length).toBe(3);
  });

  it("phân biệt rẽ trái / phải (đi bên phải đường)", () => {
    // Đi +Z rồi sang +X là rẽ trái; sang -X là rẽ phải
    expect(turnBetween(1, 0)).toBe("left");
    expect(turnBetween(1, 2)).toBe("right");
    expect(turnBetween(0, 0)).toBe("straight");
    expect(turnBetween(0, 2)).toBe("uturn");
  });

  it("mọi đoạn thẳng đều có nhánh đi tiếp, không có nhánh quay đầu", () => {
    for (const seg of net.segments) {
      expect(seg.next.length).toBeGreaterThan(0);
      for (const id of seg.next) expect(net.paths[id].turn).not.toBe("uturn");
    }
  });

  it("đường cong rẽ nối liền đúng điểm cuối làn vào với điểm đầu làn ra", () => {
    for (const seg of net.segments) {
      const ex = seg.pts[seg.pts.length - 2];
      const ez = seg.pts[seg.pts.length - 1];
      for (const id of seg.next) {
        const c = net.paths[id];
        expect(Math.hypot(c.pts[0] - ex, c.pts[1] - ez)).toBeLessThan(1e-6);
        const out = net.paths[c.next[0]];
        const cx = c.pts[c.pts.length - 2];
        const cz = c.pts[c.pts.length - 1];
        expect(Math.hypot(out.pts[0] - cx, out.pts[1] - cz)).toBeLessThan(1e-6);
      }
    }
  });

  it("xe đi bên phải tim đường", () => {
    for (const seg of net.segments) {
      const jn = net.junctions[seg.from];
      const [hx, hz] = DIRS[seg.dir as Dir];
      const p = pointAt(seg, seg.length / 2);
      // vector từ tim đường tới xe phải trùng hướng "bên phải" (-hz, hx)
      const offX = seg.dir % 2 === 0 ? 0 : p.x - jn.x;
      const offZ = seg.dir % 2 === 0 ? p.z - jn.z : 0;
      expect(offX * -hz + offZ * hx).toBeCloseTo(TUNING.road.laneOffset, 5);
    }
  });

  it("đường cong rẽ trái dài hơn rẽ phải, và không quá gắt", () => {
    const seg = net.segmentFrom(net.junctionAt(2, 1)!.id, 1)!;
    const turns = seg.next.map((id) => net.paths[id]);
    const left = turns.find((p) => p.turn === "left")!;
    const right = turns.find((p) => p.turn === "right")!;
    expect(left.length).toBeGreaterThan(right.length);
    // Góc đổi hướng giữa hai mẫu liên tiếp nhỏ (đường cong trơn)
    for (const p of [left, right]) {
      let prev = pointAt(p, 0).yaw;
      for (let s = 0.5; s < p.length; s += 0.5) {
        const y = pointAt(p, s).yaw;
        const d = Math.abs(Math.atan2(Math.sin(y - prev), Math.cos(y - prev)));
        expect(d).toBeLessThan(0.35);
        prev = y;
      }
    }
  });

  it("ô đỗ xe nằm ngoài làn chạy và cách xa ngã tư", () => {
    expect(net.bays.length).toBeGreaterThan(50);
    for (const b of net.bays) {
      for (const jn of net.junctions) {
        expect(Math.max(Math.abs(b.x - jn.x), Math.abs(b.z - jn.z))).toBeGreaterThanOrEqual(TUNING.parking.clearOfJunction - 0.01);
      }
    }
  });
});

describe("đèn giao thông", () => {
  const jn = { i: 1, j: 3 };
  it("không bao giờ xanh cả hai trục cùng lúc, và có lúc đỏ hết", () => {
    let allRed = 0;
    for (let t = 0; t < CYCLE * 3; t += 0.1) {
      const x = lightFor(jn, "x", t);
      const z = lightFor(jn, "z", t);
      expect(x !== "red" && z !== "red").toBe(false);
      if (x === "red" && z === "red") allRed++;
    }
    expect(allRed).toBeGreaterThan(0);
  });

  it("người đi bộ chỉ được đi khi xe cắt ngang đang đỏ", () => {
    for (let t = 0; t < CYCLE * 2; t += 0.1) {
      for (const axis of ["x", "z"] as const) {
        if (walkTimeLeft(jn, axis, t) > 0) {
          const crossing = axis === "x" ? "z" : "x";
          expect(lightFor(jn, crossing, t)).toBe("red");
          expect(pedLightFor(jn, axis, t)).toBe("walk");
        }
      }
    }
  });

  it("các ngã tư lệch pha nhau", () => {
    const a = lightFor({ i: 0, j: 0 }, "z", 5);
    const b = lightFor({ i: 2, j: 2 }, "z", 5);
    expect(a === b && lightFor({ i: 0, j: 0 }, "z", 20) === lightFor({ i: 2, j: 2 }, "z", 20)).toBe(false);
  });
});

describe("xe tự lái", () => {
  it("một xe tăng tốc tới tốc độ mong muốn rồi giữ ổn định", () => {
    const sim = new VehicleSim(net, [4.6], 1, seeded(1));
    const veh = sim.vehicles[0];
    // Tắt đèn bằng cách đặt xe giữa đoạn dài và chạy ít thời gian
    veh.s = 0;
    veh.v = 0;
    for (let i = 0; i < 60; i++) sim.update(0.05, 0, []);
    expect(veh.v).toBeGreaterThan(2);
    expect(veh.a).toBeLessThanOrEqual(TUNING.vehicles.maxAccel + 1e-9);
  });

  it("dừng sau vật cản đứng yên mà không đâm vào, có bật đèn phanh", () => {
    const sim = new VehicleSim(net, [4.6], 1, seeded(2));
    const veh = sim.vehicles[0];
    const seg = net.paths[veh.path];
    veh.s = 2;
    veh.v = 10;
    const block = pointAt(seg, 22);
    const obs: Obstacle[] = [{ x: block.x, z: block.z, vx: 0, vz: 0, r: 0.5, kind: "player" }];
    let braked = false;
    for (let i = 0; i < 400; i++) {
      sim.update(0.02, 1e6, obs);
      braked ||= veh.braking;
      if (veh.path !== seg.id) break;
    }
    expect(veh.path).toBe(seg.id);
    expect(22 - veh.s - veh.halfLen).toBeGreaterThan(0.6);
    expect(veh.v).toBeLessThan(0.3);
    expect(braked).toBe(true);
  });

  it("dừng trước vạch khi đèn đỏ", () => {
    const sim = new VehicleSim(net, [4.6], 1, seeded(3));
    const veh = sim.vehicles[0];
    const seg = net.paths[veh.path];
    const jn = net.junctions[seg.to];
    const axis = seg.dir % 2 === 0 ? "x" : "z";
    // Tìm một thời điểm đỏ kéo dài đủ lâu cho trục này
    let t0 = 0;
    while (!(lightFor(jn, axis, t0) === "red" && lightFor(jn, axis, t0 + 10) === "red")) t0 += 0.5;
    veh.s = seg.length - 25;
    veh.v = 8;
    for (let i = 0; i < 400; i++) sim.update(0.025, t0 + i * 0.025 * 0.001, []);
    expect(veh.path).toBe(seg.id);
    expect(seg.length - veh.s).toBeGreaterThanOrEqual(veh.halfLen - 0.01);
    expect(veh.v).toBeLessThan(0.3);
  });

  it("mô phỏng 3 phút với 24 xe: không chồng lên nhau, không vượt đèn đỏ, xe vẫn lưu thông", () => {
    const sim = new VehicleSim(net, [4.4, 4.8, 5.2, 9], 24, seeded(42));
    const dt = 0.05;
    let redRuns = 0;
    let minGap = Infinity;
    const travelled = new Map<number, number>();
    const prevPath = sim.vehicles.map((v) => v.path);
    for (let step = 0; step < 3600; step++) {
      const t = step * dt;
      sim.update(dt, t, []);
      sim.vehicles.forEach((v, i) => {
        travelled.set(v.id, (travelled.get(v.id) ?? 0) + v.v * dt);
        const before = net.paths[prevPath[i]];
        const now = net.paths[v.path];
        // Vừa rời đoạn thẳng để vào ngã tư khi đèn đã đỏ một lúc (không phải đèn vàng vừa chuyển)
        if (before.kind === "segment" && now.kind === "connector") {
          const jn = net.junctions[before.to];
          const axis = before.dir % 2 === 0 ? "x" : "z";
          if (lightFor(jn, axis, t) === "red" && lightFor(jn, axis, t - 1.5) === "red") redRuns++;
        }
        prevPath[i] = v.path;
      });
      // Khoảng cách giữa hai xe cùng làn
      for (const a of sim.vehicles) {
        for (const b of sim.vehicles) {
          if (a === b || a.path !== b.path || b.s <= a.s) continue;
          minGap = Math.min(minGap, b.s - a.s - a.halfLen - b.halfLen);
        }
      }
    }
    expect(redRuns).toBe(0);
    expect(minGap).toBeGreaterThan(0.3);
    const moved = [...travelled.values()].filter((d) => d > 150).length;
    expect(moved).toBeGreaterThan(18);
  });
});

describe("người đi bộ", () => {
  const graph = buildPedGraph(net);

  it("mạng lối đi liền mạch: mọi nút có ít nhất 2 cạnh, có vạch sang đường", () => {
    for (const n of graph.nodes) expect(n.edges.length).toBeGreaterThanOrEqual(2);
    expect(graph.edges.filter((e) => e.kind === "cross").length).toBe(48);
  });

  it("vạch sang đường của người đi bộ khớp vị trí vạch kẻ trên đường", () => {
    for (const e of graph.edges.filter((x) => x.kind === "cross")) {
      const a = graph.nodes[e.a];
      const b = graph.nodes[e.b];
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const cw = net.crosswalks.filter((c) => c.junction === e.junction);
      expect(cw.some((c) => Math.hypot(c.x - mx, c.z - mz) < 0.6)).toBe(true);
    }
  });

  it("chỉ bước xuống lòng đường khi đèn đi bộ xanh, và không đi xuyên qua nhau", () => {
    const sim = new PedSim(net, graph, 60, seeded(7));
    const dt = 0.05;
    let wrong = 0;
    let overlaps = 0;
    let crossed = 0;
    for (let step = 0; step < 4000; step++) {
      const t = step * dt;
      sim.update(dt, t, { player: null });
      wrong += sim.crossingAgainstLight(t).length;
      crossed += sim.peds.filter((p) => sim.onRoad(p)).length;
      if (step % 10 === 0) {
        for (let i = 0; i < sim.peds.length; i++)
          for (let j = i + 1; j < sim.peds.length; j++)
            if (Math.hypot(sim.peds[i].x - sim.peds[j].x, sim.peds[i].z - sim.peds[j].z) < 0.25) overlaps++;
      }
    }
    expect(wrong).toBe(0);
    expect(crossed).toBeGreaterThan(0);
    expect(overlaps).toBeLessThan(5);
  });

  it("không ai kẹt đứng im lâu khi đang đi (gỡ kẹt ở góc phố)", () => {
    const sim = new PedSim(net, graph, 80, seeded(13));
    const still = new Map<number, number>();
    let worst = 0;
    for (let step = 0; step < 4000; step++) {
      sim.update(0.05, step * 0.05, { player: null });
      for (const p of sim.peds) {
        const stuck = (p.state === "walk" || p.state === "cross") && p.speed < 0.05;
        const t = stuck ? (still.get(p.id) ?? 0) + 0.05 : 0;
        still.set(p.id, t);
        worst = Math.max(worst, t);
      }
    }
    expect(worst).toBeLessThan(8);
  });

  it("né người chơi đứng giữa lối đi", () => {
    const sim = new PedSim(net, graph, 1, seeded(9));
    const p = sim.peds[0];
    const e = graph.edges.find((x) => x.kind === "side")!;
    p.edge = e.id;
    p.forward = true;
    p.s = 2;
    p.lateral = 0;
    p.state = "walk";
    sim.update(0.01, 0, { player: null });
    const a = graph.nodes[p.forward ? e.a : e.b];
    const b = graph.nodes[p.forward ? e.b : e.a];
    const dx = (b.x - a.x) / e.len;
    const dz = (b.z - a.z) / e.len;
    const player = { x: a.x + dx * 7, z: a.z + dz * 7 };
    let minDist = Infinity;
    for (let i = 0; i < 200; i++) {
      sim.update(0.05, 0, { player });
      if (p.edge === e.id) minDist = Math.min(minDist, Math.hypot(p.x - player.x, p.z - player.z));
    }
    expect(minDist).toBeGreaterThan(0.6);
  });

  it("nghe tiếng súng thì chạy, rồi bình tĩnh lại", () => {
    const sim = new PedSim(net, graph, 30, seeded(11));
    const p = sim.peds[0];
    sim.alarm(p.x + 3, p.z);
    expect(p.state).toBe("flee");
    for (let i = 0; i < 40; i++) sim.update(0.05, 0, { player: null });
    expect(p.speed).toBeGreaterThan(TUNING.peds.walkSpeed[1] + 0.5);
    for (let i = 0; i < 300; i++) sim.update(0.05, 0, { player: null });
    expect(p.state).not.toBe("flee");
  });
});

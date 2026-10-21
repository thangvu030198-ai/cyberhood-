// Bản đồ đường đi chung cho xe, người đi bộ và đèn giao thông.
// Thuần TypeScript (không phụ thuộc three/React) để test và chạy được trên server sau này.
//
// Hệ trục: x sang đông, z sang nam (khớp với three.js nhìn từ trên xuống). Bốn hướng:
// 0 = +X, 1 = +Z, 2 = -X, 3 = -Z. Xe đi bên phải: vector "bên phải" của hướng (hx, hz) là (-hz, hx).

import { TUNING } from "./tuning";

export type Dir = 0 | 1 | 2 | 3;
export const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export const opposite = (d: Dir) => ((d + 2) % 4) as Dir;
/** Trục mà một hướng chạy dọc theo: hướng 0/2 chạy theo X, 1/3 chạy theo Z */
export const axisOf = (d: Dir): Axis => (d % 2 === 0 ? "x" : "z");
export type Axis = "x" | "z";
export type Turn = "straight" | "left" | "right" | "uturn";

/** Rẽ trái hay phải khi đổi từ hướng `a` sang hướng `b` */
export function turnBetween(a: Dir, b: Dir): Turn {
  if (a === b) return "straight";
  if (b === opposite(a)) return "uturn";
  const [ax, az] = DIRS[a];
  const [bx, bz] = DIRS[b];
  // Tích có hướng theo trục Y: âm là rẽ trái (đi +Z rồi rẽ sang +X là rẽ trái)
  return ax * bz - az * bx < 0 ? "left" : "right";
}

export type Junction = { id: number; i: number; j: number; x: number; z: number; arms: boolean[] };

export type Path = {
  id: number;
  kind: "segment" | "connector";
  /** Toạ độ lấy mẫu dọc tim làn: [x0, z0, x1, z1, ...] */
  pts: number[];
  /** Quãng đường tích luỹ tới từng điểm mẫu */
  cum: number[];
  length: number;
  /** Đoạn thẳng: đi từ ngã tư `from` tới ngã tư `to` theo hướng `dir` */
  from: number;
  to: number;
  dir: Dir;
  /** Nhánh rẽ: hướng vào / ra và kiểu rẽ, tại ngã tư `to` (= `from`) */
  dirOut: Dir;
  turn: Turn;
  /** Đường đi tiếp theo có thể chọn */
  next: number[];
};

export type Crosswalk = {
  junction: number;
  /** Nhánh của ngã tư nơi có vạch (vạch cắt ngang đường chạy theo hướng nhánh này) */
  arm: Dir;
  /** Tâm vạch và nửa chiều dài (dọc theo bề ngang đường) */
  x: number;
  z: number;
  /** Người đi bộ đi dọc trục này khi sang đường */
  walkAxis: Axis;
};

export type ParkingBay = { id: number; x: number; z: number; yaw: number; segment: number };

export type RoadNetwork = {
  streets: number[];
  junctions: Junction[];
  paths: Path[];
  segments: Path[];
  crosswalks: Crosswalk[];
  bays: ParkingBay[];
  junctionAt(i: number, j: number): Junction | undefined;
  /** Đoạn thẳng xuất phát từ ngã tư `junction` theo hướng `dir` */
  segmentFrom(junction: number, dir: Dir): Path | undefined;
};

const R = TUNING.road;

export function streetCenters(grid = R.grid, block = R.block, street = R.street) {
  const pitch = block + street;
  return Array.from({ length: grid + 1 }, (_, i) => (i - grid / 2) * pitch);
}

function right(d: Dir): [number, number] {
  const [hx, hz] = DIRS[d];
  return [-hz, hx];
}

/** Lấy mẫu đều theo quãng đường một đường cong Bezier bậc 3 */
function sampleBezier(p0: number[], p1: number[], p2: number[], p3: number[], step: number) {
  const fine: number[] = [];
  const N = 64;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    fine.push(a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]);
  }
  return resample(fine, step);
}

/** Lấy mẫu lại một đường gấp khúc với khoảng cách gần đều `step` */
function resample(line: number[], step: number) {
  const pts = [line[0], line[1]];
  const cum = [0];
  let acc = 0;
  let carry = 0;
  for (let k = 2; k < line.length; k += 2) {
    const x0 = line[k - 2];
    const z0 = line[k - 1];
    const dx = line[k] - x0;
    const dz = line[k + 1] - z0;
    const len = Math.hypot(dx, dz);
    let t = step - carry;
    while (t <= len) {
      pts.push(x0 + (dx * t) / len, z0 + (dz * t) / len);
      acc += step;
      cum.push(acc);
      t += step;
    }
    carry = len - (t - step);
  }
  const lx = line[line.length - 2];
  const lz = line[line.length - 1];
  const px = pts[pts.length - 2];
  const pz = pts[pts.length - 1];
  const tail = Math.hypot(lx - px, lz - pz);
  if (tail > 1e-6) {
    pts.push(lx, lz);
    cum.push(acc + tail);
  }
  return { pts, cum, length: cum[cum.length - 1] };
}

export function buildRoadNetwork(): RoadNetwork {
  const streets = streetCenters();
  const n = streets.length;
  const junctions: Junction[] = [];
  const index = new Map<string, Junction>();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const arms = [i < n - 1, j < n - 1, i > 0, j > 0];
      const jn: Junction = { id: junctions.length, i, j, x: streets[i], z: streets[j], arms };
      junctions.push(jn);
      index.set(`${i}:${j}`, jn);
    }
  }
  const junctionAt = (i: number, j: number) => index.get(`${i}:${j}`);
  const neighbor = (jn: Junction, d: Dir) => junctionAt(jn.i + DIRS[d][0], jn.j + DIRS[d][1]);

  const paths: Path[] = [];
  const segments: Path[] = [];
  const segIndex = new Map<string, Path>();

  // Đoạn thẳng giữa hai ngã tư liền kề, mỗi chiều một làn bên phải
  for (const a of junctions) {
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      if (!a.arms[d]) continue;
      const b = neighbor(a, d)!;
      const [hx, hz] = DIRS[d];
      const [rx, rz] = right(d);
      const sx = a.x + hx * R.stopLine + rx * R.laneOffset;
      const sz = a.z + hz * R.stopLine + rz * R.laneOffset;
      const ex = b.x - hx * R.stopLine + rx * R.laneOffset;
      const ez = b.z - hz * R.stopLine + rz * R.laneOffset;
      const { pts, cum, length } = resample([sx, sz, ex, ez], 2);
      const p: Path = { id: paths.length, kind: "segment", pts, cum, length, from: a.id, to: b.id, dir: d, dirOut: d, turn: "straight", next: [] };
      paths.push(p);
      segments.push(p);
      segIndex.set(`${a.id}:${d}`, p);
    }
  }
  const segmentFrom = (junction: number, dir: Dir) => segIndex.get(`${junction}:${dir}`);

  // Đường cong trong ngã tư: từ vạch dừng của nhánh vào tới đầu đoạn của nhánh ra
  for (const seg of segments) {
    const jn = junctions[seg.to];
    const hin = seg.dir;
    const outs: Dir[] = [];
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) if (jn.arms[d] && d !== opposite(hin)) outs.push(d);
    // Ngõ cụt (không xảy ra với lưới hiện tại) thì cho quay đầu
    if (outs.length === 0) outs.push(opposite(hin));
    for (const dout of outs) {
      const exit = segmentFrom(jn.id, dout)!;
      const p0 = [seg.pts[seg.pts.length - 2], seg.pts[seg.pts.length - 1]];
      const p3 = [exit.pts[0], exit.pts[1]];
      const span = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
      const k = turnBetween(hin, dout) === "straight" ? span / 3 : span * 0.42;
      const p1 = [p0[0] + DIRS[hin][0] * k, p0[1] + DIRS[hin][1] * k];
      const p2 = [p3[0] - DIRS[dout][0] * k, p3[1] - DIRS[dout][1] * k];
      const { pts, cum, length } = sampleBezier(p0, p1, p2, p3, R.sampleStep);
      const c: Path = {
        id: paths.length,
        kind: "connector",
        pts,
        cum,
        length,
        from: jn.id,
        to: jn.id,
        dir: hin,
        dirOut: dout,
        turn: turnBetween(hin, dout),
        next: [exit.id],
      };
      paths.push(c);
      seg.next.push(c.id);
    }
  }

  // Vạch sang đường ở mọi nhánh của mọi ngã tư
  const mid = (R.crosswalkInner + R.crosswalkOuter) / 2;
  const crosswalks: Crosswalk[] = [];
  for (const jn of junctions) {
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      if (!jn.arms[d]) continue;
      crosswalks.push({
        junction: jn.id,
        arm: d,
        x: jn.x + DIRS[d][0] * mid,
        z: jn.z + DIRS[d][1] * mid,
        // Vạch cắt ngang đường chạy theo trục của nhánh, nên người đi bộ đi theo trục còn lại
        walkAxis: axisOf(d) === "x" ? "z" : "x",
      });
    }
  }

  // Ô đỗ xe dọc lề phải của mỗi đoạn, chừa khoảng trống gần ngã tư
  const P = TUNING.parking;
  const bays: ParkingBay[] = [];
  for (const seg of segments) {
    const a = junctions[seg.from];
    const b = junctions[seg.to];
    const [hx, hz] = DIRS[seg.dir];
    const [rx, rz] = right(seg.dir);
    const total = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(hx, hz);
    for (let t = P.clearOfJunction + P.bayLength / 2; t <= total - P.clearOfJunction - P.bayLength / 2 + 1e-6; t += P.bayLength) {
      bays.push({
        id: bays.length,
        x: a.x + hx * t + rx * R.parkOffset,
        z: a.z + hz * t + rz * R.parkOffset,
        yaw,
        segment: seg.id,
      });
    }
  }

  return { streets, junctions, paths, segments, crosswalks, bays, junctionAt, segmentFrom };
}

export type PathPoint = { x: number; z: number; yaw: number };

/** Vị trí và hướng (yaw quanh trục Y, 0 = nhìn +Z) tại quãng đường s trên path */
export function pointAt(p: Path, s: number, out: PathPoint = { x: 0, z: 0, yaw: 0 }): PathPoint {
  const cum = p.cum;
  if (s <= 0) return setFromSeg(p, 0, 0, out);
  if (s >= p.length) return setFromSeg(p, cum.length - 2, 1, out);
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= s) lo = m;
    else hi = m;
  }
  return setFromSeg(p, lo, (s - cum[lo]) / (cum[hi] - cum[lo] || 1), out);
}

function setFromSeg(p: Path, k: number, f: number, out: PathPoint) {
  const x0 = p.pts[k * 2];
  const z0 = p.pts[k * 2 + 1];
  const x1 = p.pts[k * 2 + 2];
  const z1 = p.pts[k * 2 + 3];
  out.x = x0 + (x1 - x0) * f;
  out.z = z0 + (z1 - z0) * f;
  // Hướng trơn: nội suy giữa tiếp tuyến tại hai điểm mẫu (trung bình hai đoạn kề), tránh xe đổi hướng giật theo từng đoạn
  const a = tangentAt(p, k);
  const b = tangentAt(p, k + 1);
  out.yaw = a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * f;
  return out;
}

/** Tiếp tuyến tại điểm mẫu i: hướng trung bình của đoạn trước và đoạn sau */
function tangentAt(p: Path, i: number) {
  const n = p.pts.length / 2;
  const i0 = Math.max(0, i - 1);
  const i1 = Math.min(n - 1, i + 1);
  return Math.atan2(p.pts[i1 * 2] - p.pts[i0 * 2], p.pts[i1 * 2 + 1] - p.pts[i0 * 2 + 1]);
}

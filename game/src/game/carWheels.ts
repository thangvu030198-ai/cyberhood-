import * as THREE from "three";
import type { Part } from "./mergeParts";

export type WheelSpot = {
  /** Tâm trục bánh trong toạ độ xe (đầu xe +Z, đáy y = 0) */
  center: THREE.Vector3;
  radius: number;
  width: number;
  front: boolean;
};

export type WheelSet = {
  /** Thân xe đã khoét bỏ bánh liền khối của model */
  body: Part[];
  /** Vị trí bánh để gắn bánh dựng sẵn (tròn đều, quay không lắc) */
  wheels: WheelSpot[];
  /** Kích thước thân để đặt đèn */
  size: THREE.Vector3;
};

/**
 * Model xe Meshy là một khối liền: bánh xe nằm sẵn trong lưới và không tròn đều, quay lên sẽ méo/lắc.
 * Ở đây tìm vị trí bánh bằng hình học rồi khoét bỏ phần lưới đó, để gắn bánh dựng sẵn vào đúng chỗ:
 * 1) Các đỉnh sát mặt đất (dưới 6% chiều cao, phía ngoài thân) là chỗ lốp chạm đất, tạo 2 cụm theo trục Z.
 * 2) Tâm cụm là vị trí trục; bán kính suy từ dây cung, giới hạn theo cỡ bánh xe thật.
 * 3) Tam giác nằm trọn trong hình tròn bánh (mặt phẳng YZ) ở phía ngoài thân bị khoét.
 * Không tìm được 2 cụm rõ ràng thì giữ nguyên xe, không gắn bánh.
 */
export function splitWheels(parts: Part[]): WheelSet {
  const geos = parts.map((p) => {
    const g = p.geometry.clone();
    g.applyMatrix4(p.matrix);
    return g;
  });
  const box = new THREE.Box3();
  for (const g of geos) {
    g.computeBoundingBox();
    box.union(g.boundingBox!);
  }
  const size = box.getSize(new THREE.Vector3());
  const H = size.y;
  const W = size.x;
  const L = size.z;
  const fail = (): WheelSet => ({ body: parts, wheels: [], size });

  // Dải sát đất 6% chiều cao: chỉ còn chỗ lốp chạm đất (cản và thân xe nằm cao hơn)
  const band = H * 0.06;
  const N = 48;
  const bins = new Array(N).fill(0);
  for (const g of geos) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) - box.min.y < band && Math.abs(pos.getX(i)) > W * 0.18) {
        bins[Math.min(N - 1, Math.max(0, Math.floor(((pos.getZ(i) - box.min.z) / L) * N)))]++;
      }
    }
  }
  const cluster = (lo: number, hi: number) => {
    let peak = lo;
    for (let k = lo; k < hi; k++) if (bins[k] > bins[peak]) peak = k;
    if (bins[peak] < 8) return null;
    const th = bins[peak] * 0.12;
    let l = peak;
    let r = peak;
    while (l > lo && bins[l - 1] > th) l--;
    while (r < hi - 1 && bins[r + 1] > th) r++;
    const chord = ((r - l + 1) / N) * L;
    return { z: box.min.z + ((l + r + 1) / 2 / N) * L, r: (chord * chord) / 4 / (2 * band) + band / 2 };
  };
  const rear = cluster(0, N / 2);
  const front = cluster(N / 2, N);
  if (!rear || !front) return fail();
  const long = L > 6.5;
  const r = THREE.MathUtils.clamp((front.r + rear.r) / 2, long ? 0.45 : 0.3, long ? 0.62 : 0.46);
  const axles = [front.z, rear.z];
  const cy = box.min.y + r;

  // Khoét bánh liền khối: hình tròn rộng hơn bán kính một chút để không sót viền lốp
  const cut = r * 1.08;
  const lateral = [
    [Infinity, -Infinity],
    [Infinity, -Infinity],
  ];
  const body: Part[] = [];
  const v = new THREE.Vector3();
  geos.forEach((g, pi) => {
    const pos = g.attributes.position;
    const index = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i);
    const inWheel = (i: number) => {
      v.fromBufferAttribute(pos, i);
      if (Math.abs(v.x) < W * 0.22) return false;
      for (const az of axles) {
        const dz = v.z - az;
        const dy = v.y - cy;
        if (dz * dz + dy * dy < cut * cut) return true;
      }
      return false;
    };
    const keep: number[] = [];
    for (let t = 0; t < index.length; t += 3) {
      if (inWheel(index[t]) && inWheel(index[t + 1]) && inWheel(index[t + 2])) {
        for (let k = 0; k < 3; k++) {
          v.fromBufferAttribute(pos, index[t + k]);
          const side = v.x > 0 ? 0 : 1;
          lateral[side][0] = Math.min(lateral[side][0], Math.abs(v.x));
          lateral[side][1] = Math.max(lateral[side][1], Math.abs(v.x));
        }
      } else keep.push(index[t], index[t + 1], index[t + 2]);
    }
    const bodyGeo = g.clone();
    bodyGeo.setIndex(keep);
    body.push({ geometry: bodyGeo, material: parts[pi].material, matrix: new THREE.Matrix4() });
  });

  // Bề rộng lốp và vị trí ngang lấy từ phần vừa khoét (mỗi bên), có giới hạn hợp lý
  const wheels: WheelSpot[] = [];
  for (const [ai, az] of axles.entries()) {
    for (const side of [0, 1]) {
      const [lo, hi] = lateral[side];
      const ok = Number.isFinite(lo) && hi > lo;
      const width = THREE.MathUtils.clamp(ok ? hi - lo : 0.28, 0.22, long ? 0.45 : 0.36);
      const x = ok ? Math.min(hi - width / 2, W / 2 - width / 2) : W / 2 - width / 2;
      wheels.push({ center: new THREE.Vector3(side === 0 ? x : -x, cy, az), radius: r, width, front: ai === 0 });
    }
  }
  return { body, wheels, size };
}

/** Bánh xe dựng sẵn bán kính 1, rộng 1 (trục theo X): lốp hở hai mặt, mâm lõm có 5 nan, vành neon. Thu phóng theo từng xe. */
export function wheelGeometries() {
  // Lốp: mặt gai (ống hở) + hai mặt hông hình vành khăn, chừa lỗ để thấy mâm bên trong
  const tread = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
  tread.rotateZ(Math.PI / 2);
  const side = new THREE.RingGeometry(0.64, 1, 28, 1);
  const sideL = side.clone().rotateY(Math.PI / 2).translate(0.5, 0, 0);
  const sideR = side.clone().rotateY(-Math.PI / 2).translate(-0.5, 0, 0);
  const tire = mergeAll([tread, sideL, sideR]);
  // Mâm: đĩa lõm giữa + 5 nan ló ra hai mặt, nhìn rõ bánh đang quay
  const parts: THREE.BufferGeometry[] = [];
  const disc = new THREE.CylinderGeometry(0.64, 0.64, 0.5, 20);
  disc.rotateZ(Math.PI / 2);
  parts.push(disc);
  for (let k = 0; k < 5; k++) {
    const spoke = new THREE.BoxGeometry(0.96, 1.22, 0.14);
    spoke.rotateX((k / 5) * Math.PI);
    parts.push(spoke);
  }
  const hub = mergeAll(parts);
  const ring = new THREE.TorusGeometry(0.66, 0.045, 6, 28);
  ring.rotateY(Math.PI / 2);
  const neon = mergeAll([ring.clone().translate(0.5, 0, 0), ring.clone().translate(-0.5, 0, 0)]);
  return { tire, hub, neon };
}

function mergeAll(list: THREE.BufferGeometry[]) {
  const nonIndexed = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of nonIndexed) {
    g.deleteAttribute("uv");
  }
  const total = nonIndexed.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of nonIndexed) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return out;
}

import * as THREE from "three";
import type { Part } from "./mergeParts";

export type WheelSet = {
  /** Thân xe đã bỏ phần bánh */
  body: Part[];
  /** Bánh xe, mỗi bánh dời về tâm trục của nó để quay quanh trục X */
  wheels: { geometry: THREE.BufferGeometry; material: THREE.Material; center: THREE.Vector3 }[];
  /** Kích thước thân để đặt đèn phanh */
  size: THREE.Vector3;
};

/**
 * Model xe Meshy là một khối liền: tự tách bánh xe ra bằng hình học.
 * Xe đã được chuẩn hoá: đầu xe hướng +Z, đáy ở y = 0, tâm XZ ở gốc.
 * 1) Lấy các đỉnh sát mặt đất (dưới 12% chiều cao): đó là chỗ lốp chạm đất, tạo thành 2 cụm theo trục Z (trước/sau).
 * 2) Từ độ rộng cụm (dây cung) suy ra bán kính bánh, tâm trục nằm ở độ cao bằng bán kính.
 * 3) Tam giác nằm trọn trong hình tròn bánh (mặt phẳng YZ) và ở phía ngoài thân (|x| lớn) là bánh.
 * Không tìm được 2 cụm rõ ràng thì trả về nguyên xe, không có bánh quay.
 */
export function splitWheels(parts: Part[]): WheelSet {
  // Gom đỉnh (toạ độ đã nhân ma trận) để đo
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
  const fail = (): WheelSet => ({ body: parts, wheels: [], size });
  // Mỗi nửa xe tìm một cụm quanh đỉnh histogram
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
  const b = cluster(0, N / 2);
  const f = cluster(N / 2, N);
  if (!b || !f) return fail();
  // Bán kính đo từ dây cung còn nhiễu: giới hạn theo cỡ bánh xe thật (xe dài thì bánh to)
  const long = L > 6.5;
  const r = THREE.MathUtils.clamp((f.r + b.r) / 2, long ? 0.45 : 0.3, long ? 0.62 : 0.46);
  const axles = [f.z, b.z];

  const body: Part[] = [];
  const wheelTris = new Map<string, { mat: THREE.Material; idx: number[]; geo: THREE.BufferGeometry; center: THREE.Vector3 }>();
  parts.forEach((p, pi) => {
    const g = geos[pi].index ? geos[pi] : geos[pi];
    const pos = g.attributes.position;
    const index = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i);
    const keep: number[] = [];
    const v = new THREE.Vector3();
    const inWheel = (i: number) => {
      v.fromBufferAttribute(pos, i);
      if (Math.abs(v.x) < W * 0.2) return -1;
      for (let a = 0; a < 2; a++) {
        const dz = v.z - axles[a];
        const dy = v.y - (box.min.y + r);
        if (dz * dz + dy * dy < r * r * 1.06) return a * 2 + (v.x > 0 ? 0 : 1);
      }
      return -1;
    };
    for (let t = 0; t < index.length; t += 3) {
      const w0 = inWheel(index[t]);
      const w1 = inWheel(index[t + 1]);
      const w2 = inWheel(index[t + 2]);
      if (w0 >= 0 && w0 === w1 && w1 === w2) {
        const key = `${pi}:${w0}`;
        let entry = wheelTris.get(key);
        if (!entry) {
          const side = w0 % 2 === 0 ? 1 : -1;
          entry = { mat: p.material, idx: [], geo: g, center: new THREE.Vector3(side * W * 0.42, box.min.y + r, axles[w0 >> 1]) };
          wheelTris.set(key, entry);
        }
        entry.idx.push(index[t], index[t + 1], index[t + 2]);
      } else keep.push(index[t], index[t + 1], index[t + 2]);
    }
    const bodyGeo = g.clone();
    bodyGeo.setIndex(keep);
    body.push({ geometry: bodyGeo, material: p.material, matrix: new THREE.Matrix4() });
  });

  const wheels: WheelSet["wheels"] = [];
  for (const { mat, idx, geo, center } of wheelTris.values()) {
    if (idx.length < 30) continue;
    const wg = geo.clone();
    wg.setIndex(idx);
    // Tâm thật của bánh: trung bình các đỉnh của bánh theo X, theo YZ dùng tâm trục
    const pos = wg.attributes.position;
    let sx = 0;
    for (const i of idx) sx += pos.getX(i);
    center.x = sx / idx.length;
    wg.translate(-center.x, -center.y, -center.z);
    wheels.push({ geometry: wg, material: mat, center });
  }
  // Tách được ít nhất 3 bánh mới dùng, không thì trả nguyên xe
  if (wheels.length < 3) return fail();
  return { body, wheels, size };
}

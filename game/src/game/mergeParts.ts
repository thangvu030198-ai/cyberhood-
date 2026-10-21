import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Part = { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 };

const IDENTITY = new THREE.Matrix4();

/** Gộp các lưới dùng chung vật liệu thành một geometry (đã nhân ma trận), để mỗi model chỉ tốn
 * một lệnh vẽ cho mỗi vật liệu thay vì một lệnh cho mỗi mảnh lưới nhỏ */
export function mergeParts(parts: Part[]): Part[] {
  const groups = new Map<string, Part[]>();
  for (const p of parts) {
    const g = p.geometry;
    const key = `${p.material.uuid}|${g.index ? "i" : "n"}|${Object.keys(g.attributes).sort().join(",")}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  const out: Part[] = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const geoms = list.map((p) => {
      const g = p.geometry.clone();
      g.morphAttributes = {};
      // Thuộc tính có thể bị lượng tử hoá (Int16/Uint16 normalized) khác nhau giữa các lưới: đưa hết về Float32
      for (const [name, attr] of Object.entries(g.attributes)) {
        const a = attr as THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
        if ("isInterleavedBufferAttribute" in a || !(a.array instanceof Float32Array)) {
          const f = new Float32Array(a.count * a.itemSize);
          for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
          g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
        }
      }
      g.applyMatrix4(p.matrix);
      return g;
    });
    const merged = mergeGeometries(geoms, false);
    geoms.forEach((g) => g.dispose());
    if (merged) out.push({ geometry: merged, material: list[0].material, matrix: IDENTITY });
    else out.push(...list);
  }
  return out;
}

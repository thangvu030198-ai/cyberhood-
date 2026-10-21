import { use, useMemo } from "react";
import * as THREE from "three";
import { extraModel, type ExtraModel } from "./assets";
import { mergeParts, type Part } from "./mergeParts";

/** Các lưới của một scene trong file bộ (hoặc cả file nếu `sceneName` rỗng), đã thu phóng về kích thước `size`
 * (chiều dài hoặc chiều cao), đáy tại y = 0, quay thêm `yaw` để đầu model hướng +Z. Lưới cùng vật liệu được gộp. */
export function useSetParts(file: ExtraModel, sceneName: string, size: number, by: "height" | "longest", yaw = 0) {
  const gltf = use(extraModel(file));
  return useMemo(() => {
    const scene = sceneName ? gltf.scenes.find((s) => s.name === sceneName) : gltf.scene;
    if (!scene) return { parts: [] as Part[], half: new THREE.Vector3() };
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / (by === "height" ? dim.y : Math.max(dim.x, dim.z));
    const c = box.getCenter(new THREE.Vector3());
    const fix = new THREE.Matrix4()
      .makeScale(k, k, k)
      .premultiply(new THREE.Matrix4().makeTranslation(-c.x * k, -box.min.y * k, -c.z * k))
      .premultiply(new THREE.Matrix4().makeRotationY(yaw));
    const parts: Part[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.emissiveMap || (mat.emissive && mat.emissive.getHex() !== 0)) mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 2);
      parts.push({ geometry: m.geometry, material: mat, matrix: new THREE.Matrix4().multiplyMatrices(fix, m.matrixWorld) });
    });
    const half = dim.multiplyScalar(k / 2);
    // Sau khi quay 90°, chiều dài nằm theo trục Z
    if (Math.abs(Math.sin(yaw)) > 0.5) [half.x, half.z] = [half.z, half.x];
    return { parts: mergeParts(parts), half };
  }, [gltf, sceneName, size, by, yaw]);
}


import * as THREE from "three";

/** Clip Meshy có root motion (Hips di chuyển theo X/Z): ghim Hips tại chỗ, giữ nhún theo Y.
 * Mọi nhân vật rig bằng Meshy dùng chung tên xương nên clip của nhân vật này chạy được trên nhân vật khác. */
export function inPlace(clip: THREE.AnimationClip) {
  const c = clip.clone();
  for (const t of c.tracks) {
    if (!t.name.endsWith(".position")) continue;
    if (!/hips/i.test(t.name)) {
      // Chỉ Hips mới được dịch chuyển; vị trí các xương khác bỏ đi để khỏi lệch tỉ lệ giữa các nhân vật
      t.values = t.values.slice(0, 3);
      t.times = t.times.slice(0, 1);
      continue;
    }
    const v = t.values;
    const x0 = v[0];
    const z0 = v[2];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0;
      v[i + 2] = z0;
    }
  }
  return c;
}

/** Clip chạy một lần rồi đứng ở khung cuối (ngã chết, vẫy tay) */
export function once(action: THREE.AnimationAction) {
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  return action;
}

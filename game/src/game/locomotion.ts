import * as THREE from "three";
import { TUNING } from "../traffic/tuning";

const L = TUNING.locomotion;

/**
 * Pha trộn đứng / đi / chạy theo tốc độ di chuyển thật:
 * - cả ba clip chạy song song, chỉ đổi trọng số (không cắt clip) nên chuyển động liền mạch;
 * - đi và chạy giữ cùng pha bước chân (chuẩn hoá thời gian) để khi trộn không bị "hai chân";
 * - tốc độ clip = tốc độ thật / tốc độ tự nhiên của clip, nên chân không trượt trên mặt đất;
 * - clip một lần (vẫy tay, đánh, ngã) phủ lên trên, các clip nền tự giảm trọng số rồi trở lại.
 */
export class Locomotion {
  private overlay: THREE.AnimationAction | null = null;
  private overlayHold = false;
  private w = { idle: 1, walk: 0, run: 0 };
  /** Tốc độ (m/s) mà clip đi / chạy khớp bước chân khi timeScale = 1 */
  readonly walkSpeed: number;
  readonly runSpeed: number;
  /** Tốc độ di chuyển ứng với dáng đi / dáng chạy hoàn toàn (mặc định bằng tốc độ clip) */
  readonly gaitWalk: number;
  readonly gaitRun: number;

  readonly mixer: THREE.AnimationMixer;
  readonly idle: THREE.AnimationAction | null;
  readonly walk: THREE.AnimationAction | null;
  readonly run: THREE.AnimationAction | null;

  constructor(
    mixer: THREE.AnimationMixer,
    idle: THREE.AnimationAction | null,
    walk: THREE.AnimationAction | null,
    run: THREE.AnimationAction | null,
    speeds: { walk?: number; run?: number; gaitWalk?: number; gaitRun?: number } = {},
  ) {
    this.mixer = mixer;
    this.idle = idle;
    this.walk = walk;
    this.run = run;
    this.walkSpeed = speeds.walk && speeds.walk > 0.3 ? speeds.walk : L.walkClipSpeed;
    this.runSpeed = speeds.run && speeds.run > this.walkSpeed + 0.5 ? speeds.run : Math.max(L.runClipSpeed, this.walkSpeed * 2);
    this.gaitWalk = speeds.gaitWalk ?? this.walkSpeed;
    this.gaitRun = speeds.gaitRun ?? this.runSpeed;
    for (const a of [idle, walk, run]) {
      if (!a) continue;
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
      a.setEffectiveWeight(0);
    }
    idle?.setEffectiveWeight(1);
  }

  /** Trọng số mục tiêu theo tốc độ: 0 → đứng, walkSpeed → đi, runSpeed → chạy */
  static weights(speed: number, walkSpeed: number, runSpeed: number, hasRun: boolean) {
    if (speed <= L.idleBelow) return { idle: 1, walk: 0, run: 0 };
    if (speed < walkSpeed) {
      const k = (speed - L.idleBelow) / Math.max(0.01, walkSpeed - L.idleBelow);
      return { idle: 1 - k, walk: k, run: 0 };
    }
    if (!hasRun) return { idle: 0, walk: 1, run: 0 };
    const k = Math.min(1, (speed - walkSpeed) / Math.max(0.01, runSpeed - walkSpeed));
    return { idle: 0, walk: 1 - k, run: k };
  }

  /** Gọi mỗi frame với tốc độ ngang hiện tại (m/s) */
  update(speed: number, dt: number) {
    const target = Locomotion.weights(speed, this.gaitWalk, this.gaitRun, !!this.run);
    if (!this.idle) {
      // Không có clip đứng: dừng thì dừng hẳn clip đi tại chỗ
      target.walk += target.idle;
      target.idle = 0;
    }
    const k = 1 - Math.exp(-L.weightDamp * dt);
    this.w.idle += (target.idle - this.w.idle) * k;
    this.w.walk += (target.walk - this.w.walk) * k;
    this.w.run += (target.run - this.w.run) * k;

    // Clip phủ: giảm dần trọng số nền khi đang diễn, trả lại khi xong
    let base = 1;
    const ov = this.overlay;
    if (ov) {
      const clip = ov.getClip();
      const left = clip.duration - ov.time;
      const done = !ov.isRunning() || (!this.overlayHold && left < L.overlayFade);
      if (done && !this.overlayHold) {
        ov.fadeOut(L.overlayFade);
        this.overlay = null;
      } else base = 1 - ov.getEffectiveWeight();
    }
    this.idle?.setEffectiveWeight(this.w.idle * base);
    this.walk?.setEffectiveWeight(this.w.walk * base);
    this.run?.setEffectiveWeight(this.w.run * base);

    // Khớp bước chân: tốc độ clip theo tốc độ thật; chạy và đi cùng pha
    const scale = (natural: number) => THREE.MathUtils.clamp(Math.max(speed, L.idleBelow) / natural, L.minTimeScale, L.maxTimeScale);
    if (this.walk) this.walk.timeScale = this.w.walk > 0.01 || !this.idle ? scale(this.walkSpeed) : 1;
    if (this.run && this.walk) {
      this.run.timeScale = scale(this.runSpeed);
      const lead = this.w.run > this.w.walk ? this.run : this.walk;
      const follow = lead === this.run ? this.walk : this.run;
      const phase = lead.time / lead.getClip().duration;
      follow.time = phase * follow.getClip().duration;
    }
    // Không có clip đứng: đứng yên thì đóng băng clip đi để chân không bước tại chỗ
    if (!this.idle && this.walk && speed <= L.idleBelow) this.walk.timeScale = 0;
    this.mixer.update(dt);
  }

  /** Phát một clip phủ lên trên (vẫy tay, đánh, ngã). `hold` = giữ khung cuối (ngã chết) */
  play(action: THREE.AnimationAction | null, hold = false) {
    if (!action) return;
    if (this.overlay && this.overlay !== action) this.overlay.fadeOut(L.overlayFade);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1);
    action.fadeIn(L.overlayFade).play();
    this.overlay = action;
    this.overlayHold = hold;
  }

  /** Thả clip phủ đang giữ (hồi sinh sau khi ngã) */
  release() {
    if (this.overlay) this.overlay.fadeOut(L.overlayFade);
    this.overlay = null;
    this.overlayHold = false;
  }

  get busy() {
    return !!this.overlay;
  }
}

/**
 * Tốc độ tự nhiên của một clip đi/chạy, đo từ quãng đường xương Hips đi được trong clip (root motion),
 * nhân với tỉ lệ thế giới của xương cha. Trả về 0 nếu clip đứng tại chỗ.
 */
export function clipRootSpeed(clip: THREE.AnimationClip, root: THREE.Object3D) {
  const track = clip.tracks.find((t) => /hips/i.test(t.name) && t.name.endsWith(".position"));
  if (!track || track.times.length < 2) return 0;
  const v = track.values;
  const n = track.times.length;
  const dx = v[(n - 1) * 3] - v[0];
  const dz = v[(n - 1) * 3 + 2] - v[2];
  const dist = Math.hypot(dx, dz);
  const boneName = track.name.split(".")[0];
  const bone = root.getObjectByName(boneName);
  const scale = new THREE.Vector3(1, 1, 1);
  if (bone?.parent) {
    root.updateMatrixWorld(true);
    bone.parent.getWorldScale(scale);
    // Tỉ lệ so với gốc model (root có thể đã được đặt trong scene)
    const rootScale = new THREE.Vector3();
    root.getWorldScale(rootScale);
    scale.divide(rootScale);
    scale.multiply(root.scale);
  }
  const duration = track.times[n - 1] - track.times[0];
  return duration > 0 ? (dist * scale.x) / duration : 0;
}

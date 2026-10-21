import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { clipRootSpeed, Locomotion } from "./locomotion";
import { TUNING } from "../traffic/tuning";

const L = TUNING.locomotion;

function rig() {
  const root = new THREE.Object3D();
  const hips = new THREE.Bone();
  hips.name = "Hips";
  root.add(hips);
  const mixer = new THREE.AnimationMixer(root);
  const clip = (name: string, dist: number) =>
    new THREE.AnimationClip(name, 1, [new THREE.VectorKeyframeTrack("Hips.position", [0, 1], [0, 1, 0, 0, 1, dist])]);
  return { root, mixer, idle: clip("idle", 0), walk: clip("walk", 1.5), run: clip("run", 4.5) };
}

describe("trộn animation di chuyển", () => {
  it("trọng số đứng/đi/chạy luôn cộng lại bằng 1 và chuyển dần theo tốc độ", () => {
    let prevRun = 0;
    for (let v = 0; v <= 8; v += 0.1) {
      const w = Locomotion.weights(v, 1.5, 4.5, true);
      expect(w.idle + w.walk + w.run).toBeCloseTo(1, 6);
      expect(w.run).toBeGreaterThanOrEqual(prevRun - 1e-9);
      prevRun = w.run;
    }
    expect(Locomotion.weights(0, 1.5, 4.5, true).idle).toBe(1);
    expect(Locomotion.weights(1.5, 1.5, 4.5, true).walk).toBeCloseTo(1, 6);
    expect(Locomotion.weights(6, 1.5, 4.5, true).run).toBe(1);
  });

  it("đo tốc độ tự nhiên của clip từ root motion", () => {
    const r = rig();
    expect(clipRootSpeed(r.walk, r.root)).toBeCloseTo(1.5, 5);
    expect(clipRootSpeed(r.idle, r.root)).toBe(0);
  });

  it("tốc độ clip khớp tốc độ di chuyển (chân không trượt) trong giới hạn cho phép", () => {
    const r = rig();
    const loco = new Locomotion(r.mixer, r.mixer.clipAction(r.idle), r.mixer.clipAction(r.walk), r.mixer.clipAction(r.run), {
      walk: 1.5,
      run: 4.5,
    });
    for (let i = 0; i < 60; i++) loco.update(1.2, 1 / 60);
    expect(loco.walk!.timeScale).toBeCloseTo(1.2 / 1.5, 5);
    for (let i = 0; i < 60; i++) loco.update(20, 1 / 60);
    expect(loco.run!.timeScale).toBe(L.maxTimeScale);
  });

  it("trọng số thay đổi mượt, không nhảy cóc giữa hai frame", () => {
    const r = rig();
    const loco = new Locomotion(r.mixer, r.mixer.clipAction(r.idle), r.mixer.clipAction(r.walk), r.mixer.clipAction(r.run));
    let prev = loco.idle!.getEffectiveWeight();
    for (let i = 0; i < 30; i++) {
      loco.update(6, 1 / 60);
      const w = loco.idle!.getEffectiveWeight();
      expect(Math.abs(w - prev)).toBeLessThan(0.25);
      prev = w;
    }
  });

  it("đi và chạy giữ cùng pha bước chân", () => {
    const r = rig();
    const loco = new Locomotion(r.mixer, r.mixer.clipAction(r.idle), r.mixer.clipAction(r.walk), r.mixer.clipAction(r.run), {
      walk: 1.5,
      run: 4.5,
    });
    for (let i = 0; i < 100; i++) loco.update(3, 1 / 60);
    const pw = loco.walk!.time / r.walk.duration;
    const pr = loco.run!.time / r.run.duration;
    expect(Math.abs(pw - pr)).toBeLessThan(0.05);
  });
});

import { Suspense, use, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { extraModel, models, type ExtraModel } from "./assets";
import { CITY } from "./config";
import { clipRootSpeed, Locomotion } from "./locomotion";
import { inPlace } from "./meshyAnim";
import { fitCharacter } from "./Player";
import { handles } from "./refs";
import { ensureTraffic } from "./trafficWorld";
import type { Ped } from "../traffic/peds";

// Người đi bộ: vị trí, hướng và tốc độ lấy từ PedSim (src/traffic/peds.ts); ở đây chỉ dựng model và trộn animation.

const PED_DRAW = 75;
const PED_ANIMATE = 45;
const SIDEWALK = CITY.SIDEWALK_HEIGHT;

/** Đặt model theo agent và cập nhật animation; trả về khoảng cách tới camera */
function follow(root: THREE.Object3D, ped: Ped, camera: THREE.Camera) {
  // Đang băng qua đường thì đứng trên mặt đường, còn lại đứng trên vỉa hè
  root.position.set(ped.x, ensureTraffic().peds!.onRoad(ped) ? 0 : SIDEWALK, ped.z);
  root.rotation.y = ped.yaw;
  const d = camera.position.distanceTo(root.position);
  root.visible = d < PED_DRAW;
  return d;
}

// ---------------------------------------------------------------------------
// Avatar 100Avatars: khung xương Mixamo, mượn clip Idle/Walk/Run của Soldier

/**
 * Mỗi avatar đặt tên xương một kiểu ("mixamorig:Hips", "AvatarsR2_0002:Hips", "vis_char_002:mixamorig:Hips"),
 * sau khi GLTFLoader bỏ dấu ":" thành "AvatarsR2_0002Hips"... Đổi về đúng tên trong clip của Soldier
 * bằng cách khớp phần đuôi dài nhất với danh sách xương Mixamo.
 */
function normalizeMixamoBones(model: THREE.Object3D, canonical: string[]) {
  const suffixes = canonical.map((c) => c.replace(/^mixamorig/, "")).sort((x, y) => y.length - x.length);
  model.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    // Gộp nhiều avatar chung một file nên GLTFLoader thêm hậu tố "_1", "_2"... cho tên trùng
    const base = o.name.replace(/_\d+$/, "");
    const hit = suffixes.find((suf) => base.endsWith(suf));
    if (hit) o.name = `mixamorig${hit}`;
  });
}

/** Chỉ giữ track xoay: avatar khác tỉ lệ với Soldier nên không mượn track vị trí */
const rotationOnly = (c: THREE.AnimationClip | undefined) =>
  c ? new THREE.AnimationClip(c.name, c.duration, c.tracks.filter((t) => t.name.endsWith(".quaternion"))) : null;

function CrowdAvatars({ from, count }: { from: number; count: number }) {
  const a = use(extraModel("crowd_a"));
  const b = use(extraModel("crowd_b"));
  const soldier = use(models.soldier);
  const peds = useMemo(() => {
    const scenes = [...a.scenes, ...b.scenes];
    const clip = (n: string) => rotationOnly(soldier.animations.find((c) => c.name === n));
    const idle = clip("Idle");
    const walk = clip("Walk");
    const run = clip("Run");
    const boneNames = walk ? walk.tracks.map((t) => t.name.split(".")[0]) : [];
    return Array.from({ length: count }, (_, i) => {
      const model = cloneSkinned(scenes[i % scenes.length]);
      normalizeMixamoBones(model, boneNames);
      fitCharacter(model, 1.62 + ((i * 37) % 28) / 100, 0);
      model.rotation.y = Math.PI; // VRM nhìn về -Z
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.frustumCulled = false;
      });
      const root = new THREE.Group();
      root.name = "pedestrian";
      root.add(model);
      const mixer = new THREE.AnimationMixer(model);
      const act = (c: THREE.AnimationClip | null) => (c ? mixer.clipAction(c) : null);
      const loco = new Locomotion(mixer, act(idle), act(walk), act(run), { walk: 1.25, run: 3.6 });
      if (loco.walk) loco.walk.time = (i * 0.37) % walk!.duration;
      return { root, loco, agent: from + i };
    });
  }, [a, b, soldier, from, count]);

  useFrame(({ camera }, dt) => {
    const sim = ensureTraffic().peds!;
    const step = Math.min(dt, 0.1);
    for (const p of peds) {
      const ped = sim.peds[p.agent];
      if (!ped) continue;
      if (follow(p.root, ped, camera) < PED_ANIMATE) p.loco.update(ped.speed, step);
    }
  });
  return (
    <>
      {peds.map((p, i) => (
        <primitive key={i} object={p.root} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dân thường Meshy: clip đi/chạy riêng, đứng và vẫy tay mượn của nhân vật Meshy khác (cùng tên xương)

const OWN_IDLE = new Set(["courier", "elder", "dancer", "worker", "student", "biker"]);
const civClip = (model: ExtraModel, kind: "idle" | "wave") => {
  const who = model.replace(/^mx_(civ|npc)_|_walk$/g, "");
  if (kind === "idle" && who === "dancer") return "mx_civ_dancer_dance" as ExtraModel;
  return `mx_civ_${OWN_IDLE.has(who) ? who : "worker"}_${kind}` as ExtraModel;
};

export const CIVILIANS: ExtraModel[] = [
  "mx_civ_vendor_walk",
  "mx_civ_punk_walk",
  "mx_civ_salaryman_walk",
  "mx_civ_courier_walk",
  "mx_civ_elder_walk",
  "mx_civ_dancer_walk",
  "mx_civ_worker_walk",
  "mx_civ_student_walk",
  "mx_civ_biker_walk",
  "mx_npc_bartender_walk",
  "mx_npc_medic_walk",
  "mx_npc_cop_walk",
  "mx_npc_child_walk",
  "mx_npc_monk_walk",
  "mx_npc_dj_walk",
  "mx_npc_gangster_walk",
  "mx_npc_android_maid_walk",
];
/** Chiều cao riêng cho nhân vật không cao cỡ người lớn bình thường */
const CIV_HEIGHT: Partial<Record<ExtraModel, number>> = { mx_npc_child_walk: 1.3, mx_npc_cop_walk: 1.88 };
const WAVE_RANGE = 4;
const WAVE_COOLDOWN = 25;

function MeshyCivilian({ model, agent }: { model: ExtraModel; agent: number }) {
  const gltf = use(extraModel(model));
  const runGltf = use(extraModel(model.replace(/_walk$/, "_run") as ExtraModel));
  const idleGltf = use(extraModel(civClip(model, "idle")));
  const waveGltf = use(extraModel(civClip(model, "wave")));
  const civ = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    fitCharacter(s, CIV_HEIGHT[model] ?? 1.7 + (agent % 5) * 0.025, 0);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.map && !mat.emissiveMap) {
        mat.emissiveMap = mat.map;
        mat.emissive.set("#ffffff");
        mat.emissiveIntensity = 0.2;
      }
    });
    const root = new THREE.Group();
    root.name = "pedestrian";
    root.add(s);
    const mixer = new THREE.AnimationMixer(s);
    const raw = (g: { animations: THREE.AnimationClip[] }) => g.animations[0];
    // Đo tốc độ tự nhiên của clip đi/chạy từ root motion trước khi ghim tại chỗ, để chân không trượt
    const walkSpeed = raw(gltf) ? clipRootSpeed(raw(gltf), s) : 0;
    const runSpeed = raw(runGltf) ? clipRootSpeed(raw(runGltf), s) : 0;
    const act = (g: { animations: THREE.AnimationClip[] }) => (raw(g) ? mixer.clipAction(inPlace(raw(g))) : null);
    const loco = new Locomotion(mixer, act(idleGltf), act(gltf), act(runGltf), { walk: walkSpeed, run: runSpeed });
    if (loco.walk) loco.walk.time = (agent * 0.41) % loco.walk.getClip().duration;
    return { root, loco, wave: act(waveGltf), wavedAt: -99 };
  }, [gltf, runGltf, idleGltf, waveGltf, model, agent]);

  useFrame(({ camera, clock }, dt) => {
    const sim = ensureTraffic().peds!;
    const ped = sim.peds[agent];
    if (!ped) return;
    const step = Math.min(dt, 0.1);
    const t = clock.elapsedTime;
    const d = follow(civ.root, ped, camera);
    const player = handles.player?.currPos;
    // Người chơi đi ngang qua: dừng lại, quay sang vẫy tay (mỗi người tối đa một lần mỗi 25 giây)
    if (player && civ.wave && ped.state === "walk" && t - civ.wavedAt > WAVE_COOLDOWN) {
      const dist = Math.hypot(player.x - ped.x, player.z - ped.z);
      if (dist < WAVE_RANGE && dist > 1.4) {
        civ.wavedAt = t;
        ped.state = "rest";
        ped.timer = civ.wave.getClip().duration;
        civ.loco.play(civ.wave);
      }
    }
    if (player && t - civ.wavedAt < (civ.wave?.getClip().duration ?? 0)) {
      civ.root.rotation.y = Math.atan2(player.x - ped.x, player.z - ped.z);
    }
    if (d < PED_ANIMATE) civ.loco.update(ped.speed, step);
  });
  return <primitive object={civ.root} />;
}

// ---------------------------------------------------------------------------
// Robot RobotExpressive (có sẵn Idle/Walking/Running/Wave)

function Robots({ from, count }: { from: number; count: number }) {
  const gltf = use(extraModel("robot"));
  const bots = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const model = cloneSkinned(gltf.scene);
      fitCharacter(model, 1.5, 0);
      const root = new THREE.Group();
      root.add(model);
      const mixer = new THREE.AnimationMixer(model);
      const act = (n: string) => {
        const c = gltf.animations.find((x) => x.name === n);
        return c ? mixer.clipAction(c) : null;
      };
      const loco = new Locomotion(mixer, act("Idle"), act("Walking"), act("Running"), { walk: 1.5, run: 4.4 });
      return { root, loco, wave: act("Wave"), agent: from + i, nextWave: 8 + i * 3 };
    });
  }, [gltf, from, count]);
  useFrame(({ camera }, dt) => {
    const sim = ensureTraffic().peds!;
    const step = Math.min(dt, 0.1);
    for (const b of bots) {
      const ped = sim.peds[b.agent];
      if (!ped) continue;
      b.nextWave -= step;
      // Thỉnh thoảng dừng lại vẫy tay
      if (b.nextWave <= 0 && b.wave && ped.state === "walk") {
        b.nextWave = 14 + (b.agent % 7) * 2;
        ped.state = "rest";
        ped.timer = b.wave.getClip().duration;
        b.loco.play(b.wave);
      }
      if (follow(b.root, ped, camera) < PED_ANIMATE) b.loco.update(ped.speed, step);
    }
  });
  return (
    <>
      {bots.map((b, i) => (
        <primitive key={i} object={b.root} />
      ))}
    </>
  );
}

/** Mọi người đi bộ trên phố (đặt ngoài <Physics>) */
export function Pedestrians() {
  const { mix } = ensureTraffic();
  return (
    <>
      <Suspense fallback={null}>
        <CrowdAvatars from={0} count={mix.crowd} />
      </Suspense>
      {CIVILIANS.slice(0, mix.civ).map((m, i) => (
        <Suspense key={m} fallback={null}>
          <MeshyCivilian model={m} agent={mix.crowd + i} />
        </Suspense>
      ))}
      <Suspense fallback={null}>
        <Robots from={mix.crowd + mix.civ} count={mix.robot} />
      </Suspense>
    </>
  );
}

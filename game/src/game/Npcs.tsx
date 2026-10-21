import { Suspense, use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { extraModel, models, type ExtraModel } from "./assets";
import { inPlace } from "./meshyAnim";
import { fitCharacter } from "./Player";
import { MISSION_GATE, PALETTE } from "./config";
import { fx } from "./Effects";
import { activeShards, checkReach, interact, npcMarker, objectiveTarget, questProgress, VAULT_EXIT, VAULT_TERMINAL } from "./quests";
import { handles } from "./refs";
import { useGame, type Interactable } from "./store";
import { NPCS, SHARD_SPOTS, VAULT_DOOR, VAULT_ORIGIN, type NpcId } from "./story";
import { makeLabelTexture } from "./textures";
import { BOARD_POS } from "./contracts";

const TALK_REACH = 3.2;
const DOOR_REACH = 3.6;
const SHARD_REACH = 1.9;

function NpcBot({ id }: { id: NpcId }) {
  const npc = NPCS[id];
  const gltf = use(models.xbot);
  const group = useRef<THREE.Group>(null);
  const { scene, mixer } = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    fitCharacter(s, 1.8, 0);
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      // Android: thân tối bóng, các khớp phát sáng màu riêng của từng NPC
      if (/Joints/i.test(m.name)) {
        m.color.set(npc.glow);
        m.emissive.set(npc.glow);
        m.emissiveIntensity = 1.6;
      } else {
        m.color.set(npc.body).multiplyScalar(2.2);
        m.metalness = 0.8;
        m.roughness = 0.25;
      }
      mesh.material = m;
    });
    const mixer = new THREE.AnimationMixer(s);
    const idle = gltf.animations.find((a) => a.name === "idle");
    if (idle) mixer.clipAction(idle).play();
    return { scene: s, mixer };
  }, [gltf, npc]);

  // Bảng tên trên đầu: tên, vai trò, và dấu ! (có việc) hoặc ? (chờ báo cáo)
  const quest = useGame((s) => s.quest);
  const marker = useMemo(() => npcMarker(id), [id, quest]);
  const label = useMemo(() => makeLabelTexture(npc.name, npc.role.toUpperCase(), npc.glow, marker ?? undefined), [npc, marker]);

  // Vẫy tay khi người chơi mở hội thoại với NPC này
  const talking = useGame((s) => s.dialogue?.npc === id);
  const wave = useMemo(() => gltf.animations.find((a) => a.name === "agree"), [gltf]);
  useEffect(() => {
    if (!talking || !wave) return;
    mixer.clipAction(wave).reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.2).play();
  }, [talking, wave, mixer]);

  useFrame((_, dt) => {
    mixer.update(dt);
    const g = group.current;
    const p = handles.player?.currPos;
    if (!g || !p) return;
    // Quay mặt về phía người chơi khi đứng gần
    const dx = p.x - g.position.x;
    const dz = p.z - g.position.z;
    const target = dx * dx + dz * dz < 64 ? Math.atan2(dx, dz) : npc.yaw;
    const diff = ((((target - g.rotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += diff * Math.min(1, dt * 4);
  });

  return (
    <group ref={group} position={npc.pos} rotation={[0, npc.yaw, 0]}>
      <primitive object={scene} />
      <sprite position={[0, 2.45, 0]} scale={[1.9, 0.6, 1]}>
        <spriteMaterial map={label} toneMapped={false} depthWrite={false} />
      </sprite>
    </group>
  );
}

const MESHY_NPC: Partial<Record<NpcId, ExtraModel>> = {
  rook: "mx_npc_rook_walk",
  vex: "mx_npc_vex_walk",
  echo: "mx_npc_echo_walk",
};
const PACE = 1.6;

/**
 * NPC dựng bằng Meshy (đã gắn xương, chỉ có clip đi bộ): đi qua đi lại quanh chỗ đứng;
 * khi người chơi lại gần thì dừng lại và quay mặt về phía người chơi.
 */
function NpcMeshy({ id, model }: { id: NpcId; model: ExtraModel }) {
  const npc = NPCS[id];
  const gltf = use(extraModel(model));
  // Rig cũ chỉ có clip đi/chạy: mượn clip đứng thở và nói chuyện của nhân vật Meshy khác (cùng bộ xương)
  const idleGltf = use(extraModel("mx_civ_worker_idle"));
  const talkGltf = use(extraModel("mx_vane_human_talk"));
  const group = useRef<THREE.Group>(null);
  const { scene, mixer, action, idle, talk } = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    fitCharacter(s, id === "vex" ? 1.7 : 1.8, 0);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      // Chút tự sáng theo texture để nhân vật nổi bật dưới đèn neon
      if (mat.map && !mat.emissiveMap) {
        mat.emissiveMap = mat.map;
        mat.emissive.set("#ffffff");
        mat.emissiveIntensity = 0.22;
      }
    });
    const mixer = new THREE.AnimationMixer(s);
    const action = gltf.animations[0] ? mixer.clipAction(inPlace(gltf.animations[0])) : null;
    const idle = idleGltf.animations[0] ? mixer.clipAction(inPlace(idleGltf.animations[0])) : null;
    const talk = talkGltf.animations[0] ? mixer.clipAction(inPlace(talkGltf.animations[0])) : null;
    for (const a of [action, idle, talk]) a?.play();
    if (idle) idle.weight = 0;
    if (talk) talk.weight = 0;
    return { scene: s, mixer, action, idle, talk };
  }, [gltf, idleGltf, talkGltf, id]);

  const quest = useGame((s) => s.quest);
  const marker = useMemo(() => npcMarker(id), [id, quest]);
  const label = useMemo(() => makeLabelTexture(npc.name, npc.role.toUpperCase(), npc.glow, marker ?? undefined), [npc, marker]);
  const t = useRef(Math.random() * 10);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const step = Math.min(dt, 0.1);
    const p = handles.player?.currPos;
    const dist = p ? Math.hypot(p.x - npc.pos[0], p.z - npc.pos[2]) : 99;
    const near = dist < 7;
    // Đi qua lại khi vắng người; người chơi lại gần thì đứng thở, sát bên thì quay sang nói chuyện
    const w = { walk: near ? 0 : 1, idle: near && dist >= 3.5 ? 1 : 0, talk: dist < 3.5 ? 1 : 0 };
    if (action) action.weight = THREE.MathUtils.damp(action.weight, w.walk, 6, step);
    if (idle) idle.weight = THREE.MathUtils.damp(idle.weight, w.idle, 6, step);
    if (talk) talk.weight = THREE.MathUtils.damp(talk.weight, w.talk, 6, step);
    const side = [Math.cos(npc.yaw), -Math.sin(npc.yaw)];
    let targetYaw: number;
    if (near && p) {
      // Đứng lại, quay về phía người chơi
      targetYaw = Math.atan2(p.x - g.position.x, p.z - g.position.z);
    } else {
      t.current += step;
      const phase = (t.current * 0.45) % 2;
      const dir = phase < 1 ? 1 : -1;
      const k = phase < 1 ? phase : 2 - phase;
      const off = (k * 2 - 1) * PACE;
      g.position.set(npc.pos[0] + side[0] * off, npc.pos[1], npc.pos[2] + side[1] * off);
      targetYaw = Math.atan2(side[0] * dir, side[1] * dir);
      if (action) action.timeScale = 0.8;
    }
    const diff = ((((targetYaw - g.rotation.y) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += diff * Math.min(1, step * 6);
    mixer.update(step);
  });

  return (
    <group ref={group} position={npc.pos} rotation={[0, npc.yaw, 0]}>
      <primitive object={scene} />
      <sprite position={[0, 2.45, 0]} scale={[1.9, 0.6, 1]}>
        <spriteMaterial map={label} toneMapped={false} depthWrite={false} />
      </sprite>
    </group>
  );
}

/** Mảnh dữ liệu lơ lửng, chỉ xuất hiện khi đang làm bước thu thập */
function Shards() {
  const quest = useGame((s) => s.quest);
  const visible = useMemo(() => activeShards(), [quest]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const color = useMemo(() => new THREE.Color("#39ff88").multiplyScalar(4), []);
  useFrame(({ clock }) => {
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.y = clock.elapsedTime * 1.6 + i;
      g.position.y = SHARD_SPOTS[i][1] + Math.sin(clock.elapsedTime * 2 + i) * 0.2;
    });
  });
  return (
    <>
      {SHARD_SPOTS.map((p, i) =>
        visible.includes(i) ? (
          <group key={i} ref={(g) => void (refs.current[i] = g)} position={p}>
            <mesh rotation={[0.6, 0, 0.6]}>
              <boxGeometry args={[0.45, 0.45, 0.45]} />
              <meshBasicMaterial color={color} toneMapped={false} wireframe />
            </mesh>
            <mesh>
              <octahedronGeometry args={[0.2, 0]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <pointLight color="#39ff88" intensity={12} distance={6} decay={2} />
          </group>
        ) : null,
      )}
    </>
  );
}

/** Cột sáng chỉ đường tới mục tiêu nhiệm vụ */
function Beacon() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = objectiveTarget();
    const inVault = useGame.getState().location === "vault";
    const targetInVault = !!t && t.z > VAULT_ORIGIN[2] - 100;
    mesh.visible = !!t && inVault === targetInVault;
    if (!t || !mesh.visible) return;
    mesh.position.set(t.x, t.y + (inVault ? 3 : 40), t.z);
    mesh.scale.set(1, inVault ? 0.075 : 1, 1);
    if (mat.current) mat.current.opacity = 0.22 + Math.sin(clock.elapsedTime * 3) * 0.08;
  });
  return (
    <mesh ref={ref} visible={false} frustumCulled={false}>
      <cylinderGeometry args={[0.6, 0.6, 80, 16, 1, true]} />
      <meshBasicMaterial
        ref={mat}
        color={new THREE.Color(PALETTE.amber).multiplyScalar(2.5)}
        transparent
        opacity={0.25}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

const _p = new THREE.Vector3();

/** Quét thứ có thể tương tác gần người chơi, nhặt mảnh dữ liệu, kiểm tra bước "tới nơi" */
function InteractionScanner() {
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.15) return;
    last.current = clock.elapsedTime;
    const s = useGame.getState();
    const player = handles.player;
    if (!player || s.mode !== "foot" || s.flatlinedAt !== null) {
      if (s.nearInteract) s.setNearInteract(null);
      return;
    }
    const p = player.currPos;
    checkReach(p.x, p.z);

    // Nhặt mảnh dữ liệu
    for (const i of activeShards()) {
      const sp = SHARD_SPOTS[i];
      if (Math.hypot(p.x - sp[0], p.z - sp[2]) < SHARD_REACH) {
        s.addItem("shard", 1);
        fx.blast(_p.set(sp[0], sp[1], sp[2]));
        s.showToast("Nhặt được Data Shard");
        questProgress("collect");
        break;
      }
    }

    let best: Interactable | null = null;
    let bestD = Infinity;
    const consider = (target: Interactable, x: number, z: number, reach: number) => {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < reach && d < bestD) {
        bestD = d;
        best = target;
      }
    };
    if (s.location === "city") {
      for (const npc of Object.values(NPCS)) {
        if (!npc.inVault) consider({ kind: "npc", id: npc.id }, npc.pos[0], npc.pos[2], TALK_REACH);
      }
      consider({ kind: "door" }, VAULT_DOOR[0], VAULT_DOOR[2], DOOR_REACH);
      consider({ kind: "board" }, BOARD_POS.x, BOARD_POS.z, DOOR_REACH);
      consider({ kind: "gate" }, MISSION_GATE.x, MISSION_GATE.z, MISSION_GATE.reach);
    } else {
      consider({ kind: "exit" }, VAULT_ORIGIN[0] + VAULT_EXIT[0], VAULT_ORIGIN[2] + VAULT_EXIT[2] - 1.5, DOOR_REACH);
      consider({ kind: "terminal" }, VAULT_ORIGIN[0] + VAULT_TERMINAL[0], VAULT_ORIGIN[2] + VAULT_TERMINAL[2] + 1, DOOR_REACH);
    }
    const prev = s.nearInteract;
    const same = JSON.stringify(prev) === JSON.stringify(best);
    if (!same) s.setNearInteract(best);
  });
  return null;
}

/** Phím E tương tác, Q dùng Stim Pack, Tab/I mở túi đồ, phím số chọn lựa chọn hội thoại */
function InteractionKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Trong màn đi ngang, bàn phím thuộc về màn chơi
      if (useGame.getState().location === "level") return;
      if (e.repeat) return;
      const s = useGame.getState();
      if (s.profile === null) return;
      if (e.code === "KeyE" && !s.dialogue && !s.shopOpen && !s.inventoryOpen && !s.panelOpen && s.nearInteract) interact(s.nearInteract);
      if (e.code === "KeyQ" && !s.useStim() && (s.inventory.stim ?? 0) > 0 && s.hp >= s.maxHp) s.showToast("Máu đang đầy");
      if (e.code === "Tab" || e.code === "KeyI") {
        e.preventDefault();
        if (!s.dialogue && !s.shopOpen) {
          if (!s.inventoryOpen) document.exitPointerLock?.();
          s.setInventoryOpen(!s.inventoryOpen);
        }
      }
      if (e.code === "Escape") {
        if (s.inventoryOpen) s.setInventoryOpen(false);
        if (s.dialogue) s.setDialogue(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

export function Npcs() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {Object.values(NPCS)
          .filter((n) => !n.inVault)
          .map((n) => (
            <CuboidCollider key={n.id} args={[0.35, 0.9, 0.35]} position={[n.pos[0], n.pos[1] + 0.9, n.pos[2]]} />
          ))}
      </RigidBody>
      {(Object.keys(NPCS) as NpcId[])
        .filter((id) => !NPCS[id].inVault)
        .map((id) => {
          const model = MESHY_NPC[id];
          return model ? (
            <Suspense key={id} fallback={<NpcBot id={id} />}>
              <NpcMeshy id={id} model={model} />
            </Suspense>
          ) : (
            <NpcBot key={id} id={id} />
          );
        })}
      <Shards />
      <Beacon />
      <InteractionScanner />
      <InteractionKeys />
    </>
  );
}

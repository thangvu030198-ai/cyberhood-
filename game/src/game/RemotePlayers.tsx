// Người chơi khác đang ở cùng Hub: nhân vật theo lớp họ chọn, bảng tên màu riêng, di chuyển nội suy mượt
// giữa các gói trạng thái (~10 lần/giây). Người đang lái xe / trong Mech chỉ hiện bảng tên.

import { Suspense, use, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extraModel } from "./assets";
import { useGame } from "./store";
import { PLAYER } from "./config";
import { buildRig, setAnim, type Rig } from "../level/LevelScene";
import { peerStates, usePeers } from "../platform/net";

type Cls = "samurai" | "racer" | "engineer" | "hacker" | "ninja";
const CLASSES: Cls[] = ["samurai", "racer", "engineer", "hacker", "ninja"];
const toCls = (h: string): Cls => (CLASSES.includes(h as Cls) ? (h as Cls) : "racer");

function useRigFactory(cls: Cls) {
  const walk = use(extraModel(`mx_cls_${cls}_walk` as never)) as { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
  const run = use(extraModel(`mx_cls_${cls}_run` as never)) as { animations: THREE.AnimationClip[] };
  const idle = use(extraModel(`mx_cls_${cls}_idle` as never)) as { animations: THREE.AnimationClip[] };
  return useMemo(
    () => () => buildRig(walk.scene, { walk: walk.animations[0], run: run.animations[0], idle: idle.animations[0] }, 1.8, 0.35),
    [walk, run, idle],
  );
}

function nameTag(name: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 56;
  const g = c.getContext("2d")! as CanvasRenderingContext2D & { keepText?: boolean };
  g.keepText = true;
  g.fillStyle = "rgba(4,8,18,0.8)";
  g.beginPath();
  g.roundRect(4, 6, 248, 40, 10);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = "#7dffb0";
  g.beginPath();
  g.arc(26, 26, 6, 0, Math.PI * 2);
  g.fill();
  g.font = "700 22px 'Chakra Petch', sans-serif";
  g.textBaseline = "middle";
  g.fillStyle = "#ffffff";
  g.fillText(name.slice(0, 16), 42, 27, 200);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Chân nhân vật so với tâm thân vật lý (giống Player.tsx) */
const FEET_Y = -(PLAYER.capsuleHalfHeight + PLAYER.capsuleRadius + PLAYER.floatHeight);
const ANIMS = ["idle", "walk", "run", "run"];

function Remote({ id, make }: { id: string; make: () => Rig }) {
  const rig = useMemo(make, [make]);
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const first = peerStates.get(id);
  const tag = useMemo(() => nameTag(first?.n ?? "Hunter", first?.g ?? "#05d9e8"), [first?.n, first?.g]);
  const yaw = useRef(first?.r ?? 0);
  useFrame((_, dt) => {
    const s = peerStates.get(id);
    const o = ref.current;
    if (!s || !o) return;
    const k = 1 - Math.exp(-dt * 10);
    const far = Math.hypot(o.position.x - s.p[0], o.position.z - s.p[2]) > 12;
    // Nội suy tới vị trí mới; xa quá (dịch chuyển) thì nhảy thẳng tới
    if (far) o.position.set(s.p[0], s.p[1], s.p[2]);
    else o.position.lerp(new THREE.Vector3(s.p[0], s.p[1], s.p[2]), k);
    let d = s.r - yaw.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw.current += d * k;
    if (body.current) {
      body.current.rotation.y = yaw.current;
      body.current.visible = s.m === "foot";
    }
    o.visible = s.l === "city";
    setAnim(rig, ANIMS[s.a] ?? "idle", 0.2);
    rig.mixer.update(Math.min(dt, 0.1));
  });
  return (
    <group ref={ref} position={first ? first.p : [0, 0, 0]}>
      <group ref={body} position={[0, FEET_Y, 0]}>
        <primitive object={rig.scene} />
      </group>
      <sprite position={[0, FEET_Y + 2.35, 0]} scale={[1.45, 0.32, 1]} renderOrder={15}>
        <spriteMaterial map={tag} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

function ClassGroup({ cls, ids }: { cls: Cls; ids: string[] }) {
  const make = useRigFactory(cls);
  return (
    <>
      {ids.map((id) => (
        <Remote key={id} id={id} make={make} />
      ))}
    </>
  );
}

/** Tối đa 24 người gần nhất để giữ khung hình */
const MAX_SHOWN = 24;

export function RemotePlayers() {
  const ids = usePeers((s) => s.ids);
  const inCity = useGame((s) => s.location === "city");
  const groups = useMemo(() => {
    const by: Partial<Record<Cls, string[]>> = {};
    for (const id of ids.slice(0, MAX_SHOWN)) {
      const s = peerStates.get(id);
      if (!s) continue;
      (by[toCls(s.h)] ??= []).push(id);
    }
    return by;
  }, [ids]);
  if (!inCity) return null;
  return (
    <>
      {Object.entries(groups).map(([cls, list]) => (
        <Suspense key={cls} fallback={null}>
          <ClassGroup cls={cls as Cls} ids={list!} />
        </Suspense>
      ))}
    </>
  );
}

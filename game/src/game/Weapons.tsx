import { use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useButtonStore } from "ecctrl/input";
import { models, playSfx } from "./assets";
import { PALETTE } from "./config";
import { damageDrone, hitDrones, nearestVisibleDrone } from "./Enemies";
import { fx } from "./Effects";
import { handles } from "./refs";
import { useGame } from "./store";
import { rayBuildings, rayGround } from "./world";

const RANGE = 90;
const WEAPONS = {
  blaster: { cooldown: 0.28, damage: 34, sfx: "blaster" as const },
  repeater: { cooldown: 0.11, damage: 15, sfx: "repeater" as const },
};

/** Góc trợ ngắm (rad) khi bắn không ngắm và khi ngắm qua vai */
const ASSIST_HIP = 0.24;
const ASSIST_AIM = 0.08;

/** Kích thước súng mong muốn trong thế giới (m) */
const GUN_SIZE = 0.55;

/** Số liệu bắn gần nhất, chỉ để kiểm thử (?debug) */
export const combatDebug = { shots: 0, hits: 0, last: null as null | Record<string, unknown> };

// Đầu nòng súng của người chơi, nơi vệt laser xuất phát
const muzzle = new THREE.Object3D();

/** Súng gắn vào xương bàn tay phải của robot, đổi model khi mua Repeater. */
export function Gun({ hand, offset }: { hand: THREE.Object3D; offset: THREE.Vector3 }) {
  const repeater = useGame((s) => s.upgrades.repeater);
  const blaster = use(models.blaster);
  const rep = use(models.repeater);
  const scene = useMemo(() => (repeater ? rep : blaster).scene.clone(true), [repeater, rep, blaster]);
  const group = useRef<THREE.Group>(null);

  // Xương tay nằm trong armature đã bị co giãn: bù lại để súng có kích thước thật.
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    hand.updateWorldMatrix(true, false);
    const handScale = new THREE.Vector3();
    hand.getWorldScale(handScale);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    g.scale.setScalar(GUN_SIZE / size / handScale.x);
    g.add(muzzle);
    muzzle.position.set(0, 0.05, -size * 0.55);
    return () => {
      g.remove(muzzle);
    };
  }, [hand, scene]);

  return createPortal(
    // Nòng súng Kenney hướng -Z; xoay để nòng chạy dọc trục +Y của xương cẳng tay
    <group ref={group} rotation={[Math.PI / 2, 0, 0]} position={offset}>
      <primitive object={scene} />
    </group>,
    hand,
  );
}

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _chest = new THREE.Vector3();
const _flat = new THREE.Vector3();

/** Điều khiển bắn: chuột trái bắn, giữ chuột phải để ngắm; nút FIRE trên điện thoại có tự ngắm. */
export function PlayerCombat() {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const lastShot = useRef(-Infinity);
  const triggerHeld = useRef(false);
  const faceUntil = useRef(0);
  const pendingShot = useRef(false);

  useEffect(() => {
    let downX = 0;
    let downY = 0;
    let downAt = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (e.button === 2) useGame.getState().setAiming(true);
      if (e.button === 0) {
        downX = e.clientX;
        downY = e.clientY;
        downAt = performance.now();
        // Đang ngắm thì giữ chuột trái là bắn liên tục
        if (useGame.getState().aiming) triggerHeld.current = true;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (e.button === 2) useGame.getState().setAiming(false);
      if (e.button === 0) {
        const wasHeld = triggerHeld.current;
        triggerHeld.current = false;
        // Không ngắm: chỉ bắn khi là cú nhấp, không phải kéo xoay camera
        const click = Math.hypot(e.clientX - downX, e.clientY - downY) < 6 && performance.now() - downAt < 350;
        if (!wasHeld && click) pendingShot.current = true;
      }
    };
    const noMenu = (e: Event) => e.preventDefault();
    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    dom.addEventListener("contextmenu", noMenu);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      dom.removeEventListener("contextmenu", noMenu);
    };
  }, [dom]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = useGame.getState();
    const player = handles.player;
    if (!player) return;
    const canFire = s.mode === "foot" && s.flatlinedAt === null && !s.shopOpen;
    const touchFire = !!useButtonStore.getState().buttons.fire;

    // Nhân vật quay theo hướng camera khi ngắm hoặc vừa bắn
    player.setLockForward(canFire && (s.aiming || t < faceUntil.current));

    const wantsFire = pendingShot.current || triggerHeld.current || touchFire;
    pendingShot.current = false;
    if (!canFire || !wantsFire) return;

    const weapon = s.upgrades.repeater ? WEAPONS.repeater : WEAPONS.blaster;
    if (t - lastShot.current < weapon.cooldown) return;
    lastShot.current = t;
    faceUntil.current = t + 0.6;

    const damage = weapon.damage * (s.upgrades.overclock ? 1.5 : 1);
    _chest.copy(player.currPos).setY(player.currPos.y + 0.5);
    camera.getWorldDirection(_dir);

    if (touchFire) {
      // Tự ngắm: nhắm drone gần nhất phía trước camera
      _flat.copy(_dir).setY(0).normalize();
      const target = nearestVisibleDrone(_chest, _flat, 45, Math.PI * 0.45);
      if (target) _dir.subVectors(target.pos, _chest).normalize();
      _origin.copy(_chest);
    } else {
      // Tia bắn đi từ tâm màn hình; bỏ đoạn giữa camera và nhân vật
      _origin.copy(camera.position).addScaledVector(_dir, camera.position.distanceTo(_chest));
      // Trợ ngắm nhẹ: drone nằm gần tâm ngắm thì đạn hút vào. Ngắm qua vai thì vùng hút hẹp hơn.
      const assisted = nearestVisibleDrone(_origin, _dir, 70, s.aiming ? ASSIST_AIM : ASSIST_HIP);
      if (assisted) _dir.subVectors(assisted.pos, _origin).normalize();
    }

    const droneHit = hitDrones(_origin, _dir, RANGE);
    const wall = Math.min(rayBuildings(_origin, _dir, RANGE), rayGround(_origin, _dir));
    let dist = Math.min(RANGE, wall);
    if (droneHit && droneHit.t < wall) {
      dist = droneHit.t;
      damageDrone(droneHit.drone, damage);
      s.markHit();
    }
    _end.copy(_origin).addScaledVector(_dir, dist);
    combatDebug.shots++;
    if (droneHit && droneHit.t < wall) combatDebug.hits++;
    combatDebug.last = { origin: _origin.toArray(), dir: _dir.toArray(), wall, drone: droneHit?.t ?? null };

    muzzle.getWorldPosition(_muzzle);
    if (_muzzle.distanceTo(_chest) > 2) _muzzle.copy(_chest);
    fx.tracer(_muzzle, _end, PALETTE.cyan);
    playSfx(weapon.sfx, 0.55);
  });

  return null;
}

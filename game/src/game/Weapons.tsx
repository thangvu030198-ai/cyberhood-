import { use, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useButtonStore } from "ecctrl/input";
import { models, playSfx } from "./assets";
import { alarm } from "./trafficWorld";
import { HUB_PEACEFUL, PALETTE } from "./config";
import { damageDrone, hitDrones, nearestVisibleDrone } from "./Enemies";
import { fx } from "./Effects";
import { handles } from "./refs";
import { uiBlocking, useGame } from "./store";
import { rayBuildings, rayGround } from "./world";
import { MECH_DAMAGE_MUL, mechActive } from "./Mech";
import { isLocked, pointer, requestLock } from "./pointer";
import { siegeShot, siegeSlash, useSiege } from "../siege/siegeSession";
import { raidShot } from "../raid/raidSession";

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
  // Đo súng ngay khi vừa clone, lúc chưa gắn vào tay: kích thước không phụ thuộc ma trận thế giới
  // (nếu đo sau khi gắn, khung xương bị co 0.01 lần làm súng phình to gấp trăm lần)
  const { scene, size } = useMemo(() => {
    const s = (repeater ? rep : blaster).scene.clone(true);
    s.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(s).getSize(new THREE.Vector3()).length() || 1;
    return { scene: s, size };
  }, [repeater, rep, blaster]);
  const group = useRef<THREE.Group>(null);

  // Xương tay nằm trong armature đã bị co giãn: bù lại để súng có kích thước thật.
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    hand.updateWorldMatrix(true, false);
    const handScale = new THREE.Vector3();
    hand.getWorldScale(handScale);
    g.scale.setScalar(GUN_SIZE / size / handScale.x);
    g.add(muzzle);
    muzzle.position.set(0, 0.05, -size * 0.55);
    return () => {
      g.remove(muzzle);
    };
  }, [hand, size]);

  return createPortal(
    // Nòng súng Kenney hướng -Z; xoay để nòng chạy dọc trục +Y của xương cẳng tay
    <group ref={group} rotation={[Math.PI / 2, 0, 0]} position={offset}>
      <primitive object={scene} />
    </group>,
    hand,
  );
}

/** Đang ở sảnh hoà bình: không rút súng */
export const peaceful = () => HUB_PEACEFUL && useGame.getState().location === "city" && !mechActive();

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _chest = new THREE.Vector3();
const _flat = new THREE.Vector3();

/** Điều khiển bắn: khoá chuột rồi nhấp trái để bắn, giữ phải để ngắm; nút FIRE trên điện thoại có tự ngắm. */
export function PlayerCombat() {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const lastShot = useRef(-Infinity);
  const triggerHeld = useRef(false);
  const pendingShot = useRef(false);

  useEffect(() => {
    // Chỉ dùng khi không khoá được chuột: kéo để xoay camera, nhấp nhanh để bắn
    let downX = 0;
    let downY = 0;
    let downAt = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const s = useGame.getState();
      if (!isLocked(dom)) {
        // Cú nhấp đầu tiên chỉ để khoá chuột vào game, chưa bắn
        if (pointer.supported && e.button === 0 && !s.shopOpen) {
          requestLock(dom);
          return;
        }
        if (e.button === 2 && !peaceful()) s.setAiming(true);
        if (e.button === 0) {
          downX = e.clientX;
          downY = e.clientY;
          downAt = performance.now();
          if (s.aiming) triggerHeld.current = true;
        }
        return;
      }
      // Đã khoá chuột: trái bắn (giữ để bắn liên tục), phải ngắm
      if (e.button === 2 && !peaceful()) s.setAiming(true);
      if (e.button === 0) {
        pendingShot.current = true;
        triggerHeld.current = true;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (e.button === 2) useGame.getState().setAiming(false);
      if (e.button !== 0) return;
      const wasHeld = triggerHeld.current;
      triggerHeld.current = false;
      if (isLocked(dom)) return;
      const click = Math.hypot(e.clientX - downX, e.clientY - downY) < 6 && performance.now() - downAt < 350;
      if (!wasHeld && click) pendingShot.current = true;
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

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const s = useGame.getState();
    const player = handles.player;
    if (!player) return;
    // Vùng an toàn: súng cất đi, không ngắm, nhân vật quay theo hướng chạy với hai tay buông tự nhiên
    const canFire = s.mode === "foot" && s.flatlinedAt === null && !s.shopOpen && !s.panelOpen && !peaceful();
    const touchFire = !!useButtonStore.getState().buttons.fire;

    // Nhân vật luôn quay theo hướng camera (kiểu bắn góc nhìn thứ 3): xoay camera tới đâu thân quay tới đó
    const faceCamera = canFire && !uiBlocking(s);
    player.setLockForward(faceCamera);
    if (faceCamera && player.body) {
      // Lực xoay của ecctrl khá chậm: bám thẳng theo hướng camera để rê chuột tới đâu người quay tới đó
      camera.getWorldDirection(_flat);
      const aimYaw = Math.atan2(_flat.x, _flat.z);
      const q = player.body.rotation();
      const bodyYaw = 2 * Math.atan2(q.y, q.w);
      const diff = ((((aimYaw - bodyYaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const yaw = bodyYaw + diff * (1 - Math.exp(-18 * Math.min(dt, 0.1)));
      player.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      player.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    const wantsFire = pendingShot.current || triggerHeld.current || touchFire;
    pendingShot.current = false;
    if (!canFire || !wantsFire) return;

    const weapon = s.upgrades.repeater ? WEAPONS.repeater : WEAPONS.blaster;
    if (t - lastShot.current < weapon.cooldown) return;
    lastShot.current = t;

    const mech = mechActive();
    const damage = weapon.damage * (s.upgrades.overclock ? 1.5 : 1) * (mech ? MECH_DAMAGE_MUL : 1);
    // Dạng Mech: pháo trên tay robot cao ~4 m nằm ngang vai, không phải ngực người lính đã thu nhỏ bên trong
    _chest.copy(player.currPos).setY(player.currPos.y + (mechActive() ? 2.6 : 0.5));
    camera.getWorldDirection(_dir);

    // Bắn khi đang quay lưng với tâm ngắm: xoay người ngay về hướng bắn, không chờ quay từ từ
    _flat.copy(_dir).setY(0).normalize();
    const body = player.body;
    let snapped = false;
    if (body && !touchFire) {
      const q = body.rotation();
      const bodyYaw = 2 * Math.atan2(q.y, q.w);
      const aimYaw = Math.atan2(_flat.x, _flat.z);
      const diff = Math.abs(((((aimYaw - bodyYaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > 0.5) {
        body.setRotation({ x: 0, y: Math.sin(aimYaw / 2), z: 0, w: Math.cos(aimYaw / 2) }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        snapped = true;
      }
    }

    // Công thành ở thế Cận chiến / Tanker: chuột trái là chém / dậm đất thay vì bắn
    if (s.location === "siege" && useSiege.getState().sim?.player.stance !== "gunner") {
      if (siegeSlash(Math.atan2(_flat.x, _flat.z))) {
        s.markHit();
        playSfx("enemyAttack", 0.5);
      }
      return;
    }

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

    const siege = s.location === "siege" || s.location === "raid";
    const droneHit = siege ? null : hitDrones(_origin, _dir, RANGE);
    const wall = siege ? rayGround(_origin, _dir) : Math.min(rayBuildings(_origin, _dir, RANGE), rayGround(_origin, _dir));
    let dist = Math.min(RANGE, wall);
    if (siege) {
      // Công thành: đạn trúng quân địch / máy phát / cổng / pháo / Boss Mech
      // Raid: trúng lươn máy / cột thu lôi / bộ phận / lõi tim / đầu / thân Leviathan
      const t = (s.location === "raid" ? raidShot : siegeShot)(_origin.x, _origin.y, _origin.z, _dir.x, _dir.y, _dir.z, Math.min(RANGE, wall), damage);
      if (t !== null) {
        dist = t;
        s.markHit();
      }
    }
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
    // Vừa xoay người thì súng chưa kịp cập nhật vị trí: cho tia laser xuất phát trước ngực
    if (snapped || _muzzle.distanceTo(_chest) > 2) _muzzle.copy(_chest).addScaledVector(_flat, 0.6);
    combatDebug.last.muzzle = _muzzle.toArray();
    fx.tracer(_muzzle, _end, mech ? PALETTE.amber : PALETTE.cyan);
    if (mech) fx.blast(_end);
    fx.muzzle(_muzzle, PALETTE.cyan);
    playSfx(weapon.sfx, 0.55);
    // Tiếng súng làm người đi bộ quanh đó bỏ chạy
    alarm(_origin.x, _origin.z);
  });

  return null;
}

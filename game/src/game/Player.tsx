import { use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useKeyboardControls } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Ecctrl, type EcctrlHandle } from "ecctrl";
import { EcctrlAnimationStateController, useEcctrlAnimationStore } from "ecctrl/animation";
import { useButtonStore, useJoystickStore } from "ecctrl/input";
import { models } from "./assets";
import { PLAYER } from "./config";
import { handles } from "./refs";
import { uiBlocking, useGame, type Emote } from "./store";
import { Gun } from "./Weapons";

const CAR_REACH = 3.6;

// Animation của Soldier (Mixamo). Nhảy dùng tạm động tác chạy.
const CLIP_FOR_STATE: Record<string, string> = {
  IDLE: "Idle",
  WALK: "Walk",
  RUN: "Run",
  JUMP_START: "Run",
  JUMP_IDLE: "Run",
  JUMP_FALL: "Run",
  JUMP_LAND: "Idle",
};

// Biểu cảm mượn từ Xbot: cùng khung xương Mixamo nên dùng chung được clip
const CLIP_FOR_EMOTE: Record<Emote, string> = {
  wave: "agree",
  dance: "agree",
  thumbsUp: "headShake",
};

const _aimDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _worldQ = new THREE.Quaternion();
const _parentQ = new THREE.Quaternion();
const _white = new THREE.Color("#ffffff");

const FEET_Y = -(PLAYER.capsuleHalfHeight + PLAYER.capsuleRadius + PLAYER.floatHeight);

/** Đặt model đứng trên đáy capsule và cao ~1.8m (Box3 của SkinnedMesh cần cập nhật skeleton trước) */
export function fitCharacter(s: THREE.Object3D, height: number, feetY: number) {
  s.updateMatrixWorld(true);
  s.traverse((o) => {
    const skinned = o as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    skinned.skeleton.update();
    skinned.computeBoundingBox();
  });
  const box = new THREE.Box3().setFromObject(s, true);
  const scale = height / (box.max.y - box.min.y);
  s.scale.setScalar(scale);
  s.position.y = feetY - box.min.y * scale;
}

function CharacterModel() {
  const gltf = use(models.soldier);
  const xbot = use(models.xbot);
  const group = useRef<THREE.Group>(null);
  const pose = useRef<THREE.Group>(null);
  const { scene, suit, visor } = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    fitCharacter(s, PLAYER.modelHeight, FEET_Y);
    let suit: THREE.MeshStandardMaterial | null = null;
    let visor: THREE.MeshStandardMaterial | null = null;
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      if (/Visor/i.test(m.name)) visor = m;
      else suit = m;
      mesh.material = m;
    });
    return { scene: s, suit: suit as THREE.MeshStandardMaterial | null, visor: visor as THREE.MeshStandardMaterial | null };
  }, [gltf]);

  // Màu theo Netrunner ID: nhuộm bộ giáp theo màu vỏ, kính visor phát sáng màu neon
  const profile = useGame((s) => s.profile);
  useEffect(() => {
    const body = new THREE.Color(profile?.body ?? "#3a1a4a").multiplyScalar(3.2);
    if (suit) {
      suit.color.copy(body).lerp(_white, 0.45);
      suit.metalness = 0.45;
      suit.roughness = 0.45;
    }
    if (visor) {
      visor.emissive.set(profile?.glow ?? "#ff2a6d");
      visor.emissiveIntensity = 2.4;
    }
  }, [profile, suit, visor]);

  // Súng cầm ở bàn tay phải; tư thế ngắm xoay cánh tay trên theo hướng camera
  const arm = useMemo(() => {
    const bones: Record<string, THREE.Bone> = {};
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
    });
    const upper = bones.mixamorigRightArm;
    const lower = bones.mixamorigRightForeArm;
    const hand = bones.mixamorigRightHand;
    return upper && lower && hand ? { upper, lower, hand } : null;
  }, [scene]);

  const clips = useMemo(
    () => [...gltf.animations, ...xbot.animations.filter((a) => a.name === "agree" || a.name === "headShake")],
    [gltf, xbot],
  );
  const { actions } = useAnimations(clips, group);
  const animationState = useEcctrlAnimationStore((s) => s.animationState);
  const emote = useGame((s) => s.emote);
  const setEmote = useGame((s) => s.setEmote);
  const flatlined = useGame((s) => s.flatlinedAt !== null);
  const current = useRef<string | null>(null);
  const setReady = useGame((s) => s.setReady);
  useEffect(setReady, [setReady]);

  const clip = flatlined
    ? "Idle"
    : emote && animationState === "IDLE"
      ? CLIP_FOR_EMOTE[emote]
      : (CLIP_FOR_STATE[animationState] ?? "Idle");

  // Bắt đầu di chuyển thì huỷ biểu cảm.
  useEffect(() => {
    if (emote && animationState !== "IDLE") setEmote(null);
  }, [animationState, emote, setEmote]);

  useEffect(() => {
    if (current.current === clip) return;
    const next = actions[clip];
    if (!next) return;
    const prev = current.current ? actions[current.current] : null;
    const once = Object.values(CLIP_FOR_EMOTE).includes(clip);
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = true;
    next.fadeIn(0.2).play();
    prev?.fadeOut(0.2);
    current.current = clip;
  }, [actions, clip]);

  const camera = useThree((s) => s.camera);
  const fall = useRef(0);
  useFrame((_, dt) => {
    // Flatline: ngã ngửa ra sau (model không có clip chết)
    fall.current = THREE.MathUtils.damp(fall.current, flatlined ? 1 : 0, 6, dt);
    if (pose.current) {
      pose.current.rotation.x = -fall.current * (Math.PI / 2);
      pose.current.position.y = fall.current * (FEET_Y + 0.25);
    }
    if (!arm || !handles.player || flatlined) return;
    const aimingNow = useGame.getState().aiming || handles.player.lockForward;
    if (!aimingNow || useGame.getState().mode !== "foot") return;
    camera.getWorldDirection(_aimDir);
    _aimDir.y = THREE.MathUtils.clamp(_aimDir.y + 0.06, -0.6, 0.8);
    _aimDir.normalize();
    // Xương Mixamo hướng theo trục +Y: quay +Y của cánh tay trên về hướng ngắm
    _worldQ.setFromUnitVectors(_up, _aimDir);
    arm.upper.parent!.getWorldQuaternion(_parentQ);
    arm.upper.quaternion.copy(_parentQ.invert().multiply(_worldQ));
    arm.lower.quaternion.identity();
    arm.hand.quaternion.identity();
  });

  return (
    <group ref={group}>
      <group ref={pose}>
        <primitive object={scene} />
      </group>
      {arm && <Gun hand={arm.hand} offset={GUN_OFFSET} />}
    </group>
  );
}

const GUN_OFFSET = new THREE.Vector3(0, 0, 0);

/** Gom input bàn phím + joystick cảm ứng rồi đẩy vào Ecctrl mỗi frame. */
function useDriveInput(ecctrl: React.RefObject<EcctrlHandle | null>) {
  const [, getKeys] = useKeyboardControls();
  useFrame(() => {
    const ctrl = ecctrl.current;
    if (!ctrl) return;
    const state = useGame.getState();
    if (uiBlocking(state) || state.flatlinedAt !== null) {
      ctrl.setMovement({ forward: false, backward: false, leftward: false, rightward: false, run: false, jump: false, joystick: { x: 0, y: 0 } });
      return;
    }
    const keys = getKeys() as Record<string, boolean>;
    const joysticks = useJoystickStore.getState().joysticks;
    const stick = Object.values(joysticks).find((j) => j.active);
    const buttons = useButtonStore.getState().buttons;
    ctrl.setMovement({
      forward: keys.forward,
      backward: keys.backward,
      leftward: keys.leftward,
      rightward: keys.rightward,
      run: keys.run || !!buttons.run,
      jump: keys.jump || !!buttons.jump,
      joystick: stick ? { x: stick.x, y: stick.y } : { x: 0, y: 0 },
    });
  });
}

export function Player() {
  const ecctrl = useRef<EcctrlHandle>(null);
  const model = useRef<THREE.Group>(null);
  const mode = useGame((s) => s.mode);
  const setPosition = useGame((s) => s.setPosition);
  const setNearCar = useGame((s) => s.setNearCar);
  useDriveInput(ecctrl);

  useEffect(() => {
    handles.player = ecctrl.current;
    return () => {
      handles.player = null;
    };
  }, []);

  // Lên xe: tắt thân vật lý và ẩn model. Xuống xe: đặt nhân vật cạnh cửa lái.
  const prevCar = useRef<number | null>(null);
  useEffect(() => {
    const body = ecctrl.current?.body;
    if (!body) return;
    if (mode === "drive") {
      prevCar.current = useGame.getState().carId;
      body.setEnabled(false);
      if (model.current) model.current.visible = false;
      return;
    }
    const car = prevCar.current !== null ? handles.cars.get(prevCar.current) : null;
    if (car) {
      const side = car.bodyXAxis;
      const p = car.currPos;
      body.setTranslation({ x: p.x + side.x * 1.9, y: p.y + 1.2, z: p.z + side.z * 1.9 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    body.setEnabled(true);
    body.wakeUp();
    if (model.current) model.current.visible = true;
    prevCar.current = null;
  }, [mode]);

  const lastReport = useRef(0);
  useFrame(({ clock }) => {
    const ctrl = ecctrl.current;
    if (!ctrl) return;
    const state = useGame.getState();
    const driving = state.mode === "drive" && state.carId !== null ? handles.cars.get(state.carId) : null;
    const p = driving ? driving.currPos : ctrl.currPos;

    // Rơi khỏi bản đồ thì đưa về điểm xuất phát.
    if (!driving && p.y < -20 && ctrl.body) {
      ctrl.body.setTranslation({ x: PLAYER.spawn[0], y: PLAYER.spawn[1], z: PLAYER.spawn[2] }, true);
      ctrl.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }

    if (clock.elapsedTime - lastReport.current < 0.2) return;
    lastReport.current = clock.elapsedTime;
    setPosition(p.x, p.z);
    if (driving) {
      useGame.getState().setSpeed(Math.round(driving.currLinVel.length() * 3.6));
      return;
    }
    // Tìm xe gần nhất trong tầm với
    let near: number | null = null;
    let best = CAR_REACH;
    handles.cars.forEach((car, id) => {
      const d = car.currPos.distanceTo(p);
      if (d < best) {
        best = d;
        near = id;
      }
    });
    if (near !== state.nearCarId) setNearCar(near);
  });

  return (
    <>
      <EcctrlAnimationStateController ecctrl={ecctrl} />
      <Ecctrl
        ref={ecctrl}
        enable={mode === "foot"}
        position={PLAYER.spawn}
        capsuleHalfHeight={PLAYER.capsuleHalfHeight}
        capsuleRadius={PLAYER.capsuleRadius}
        floatHeight={PLAYER.floatHeight}
        maxWalkVel={3.2}
        maxRunVel={7.5}
        jumpVel={5}
        // Thế giới phẳng: khoá nghiêng để nhân vật không ngã khi FPS thấp.
        enabledRotations={[false, true, false]}
      >
        <group ref={model}>
          <CharacterModel />
        </group>
      </Ecctrl>
    </>
  );
}

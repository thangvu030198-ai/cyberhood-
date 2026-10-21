import { use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useKeyboardControls } from "@react-three/drei";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Ecctrl, type EcctrlHandle } from "ecctrl";
import { EcctrlAnimationStateController, useEcctrlAnimationStore } from "ecctrl/animation";
import { useButtonStore, useJoystickStore } from "ecctrl/input";
import robotDataUrl from "../assets/robot.glb?inline";
import { PLAYER } from "./config";
import { handles } from "./refs";
import { useGame, type Emote } from "./store";

const CAR_REACH = 3.6;

// Model được nhúng sẵn trong bundle và parse trực tiếp, không cần fetch file ngoài.
const robotPromise: Promise<GLTF> = (() => {
  const base64 = robotDataUrl.slice(robotDataUrl.indexOf(",") + 1);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new GLTFLoader().parseAsync(bytes.buffer, "");
})();

const CLIP_FOR_STATE: Record<string, string> = {
  IDLE: "Idle",
  WALK: "Walking",
  RUN: "Running",
  JUMP_START: "Jump",
  JUMP_IDLE: "Jump",
  JUMP_FALL: "Jump",
  JUMP_LAND: "Idle",
};

const CLIP_FOR_EMOTE: Record<Emote, string> = {
  wave: "Wave",
  dance: "Dance",
  thumbsUp: "ThumbsUp",
};

const FEET_Y = -(PLAYER.capsuleHalfHeight + PLAYER.capsuleRadius + PLAYER.floatHeight);

function RobotModel() {
  const gltf = use(robotPromise);
  const group = useRef<THREE.Group>(null);
  const scene = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    // Chuẩn hoá chiều cao model về ~1.8m, chân chạm đáy capsule.
    // Box3 của SkinnedMesh chỉ đúng sau khi skeleton đã cập nhật theo tư thế gốc.
    s.updateMatrixWorld(true);
    s.traverse((o) => {
      const skinned = o as THREE.SkinnedMesh;
      if (!skinned.isSkinnedMesh) return;
      skinned.skeleton.update();
      skinned.computeBoundingBox();
    });
    const box = new THREE.Box3().setFromObject(s, true);
    const scale = PLAYER.modelHeight / (box.max.y - box.min.y);
    s.scale.setScalar(scale);
    s.position.y = FEET_Y - box.min.y * scale;
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // Đổi màu robot sang tông cyberpunk: thân tối, phần "Main" phát sáng hồng neon.
      if (mat.name === "Main") {
        mesh.material = mat.clone();
        const m = mesh.material as THREE.MeshStandardMaterial;
        m.color.set("#3a1a4a");
        m.emissive.set("#ff2a6d");
        m.emissiveIntensity = 0.35;
      } else if (mat.name === "Grey") {
        mesh.material = mat.clone();
        (mesh.material as THREE.MeshStandardMaterial).color.set("#6f7a8c");
        (mesh.material as THREE.MeshStandardMaterial).metalness = 0.8;
        (mesh.material as THREE.MeshStandardMaterial).roughness = 0.3;
      }
    });
    return s;
  }, [gltf]);

  const { actions } = useAnimations(gltf.animations, group);
  const animationState = useEcctrlAnimationStore((s) => s.animationState);
  const emote = useGame((s) => s.emote);
  const setEmote = useGame((s) => s.setEmote);
  const current = useRef<string | null>(null);
  const setReady = useGame((s) => s.setReady);
  useEffect(setReady, [setReady]);

  const clip = emote && animationState === "IDLE" ? CLIP_FOR_EMOTE[emote] : CLIP_FOR_STATE[animationState] ?? "Idle";

  // Bắt đầu di chuyển thì huỷ biểu cảm.
  useEffect(() => {
    if (emote && animationState !== "IDLE") setEmote(null);
  }, [animationState, emote, setEmote]);

  useEffect(() => {
    if (current.current === clip) return;
    const next = actions[clip];
    if (!next) return;
    const prev = current.current ? actions[current.current] : null;
    const once = clip === "Jump" || Object.values(CLIP_FOR_EMOTE).includes(clip);
    next.reset();
    next.setLoop(once && clip !== "Dance" ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = true;
    next.fadeIn(0.18).play();
    prev?.fadeOut(0.18);
    current.current = clip;
  }, [actions, clip]);

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

/** Gom input bàn phím + joystick cảm ứng rồi đẩy vào Ecctrl mỗi frame. */
function useDriveInput(ecctrl: React.RefObject<EcctrlHandle | null>) {
  const [, getKeys] = useKeyboardControls();
  useFrame(() => {
    const ctrl = ecctrl.current;
    if (!ctrl) return;
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
          <RobotModel />
        </group>
      </Ecctrl>
    </>
  );
}

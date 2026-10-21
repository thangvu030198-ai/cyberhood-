import { use, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useKeyboardControls } from "@react-three/drei";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Ecctrl, type EcctrlHandle } from "ecctrl";
import { EcctrlAnimationStateController, useEcctrlAnimationStore } from "ecctrl/animation";
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from "ecctrl/camera";
import { useButtonStore, useJoystickStore } from "ecctrl/input";
import robotDataUrl from "../assets/robot.glb?inline";
import { PLAYER } from "./config";
import { useGame, type Emote } from "./store";

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
  const cameraControls = useRef<EcctrlCameraControlsHandle>(null);
  const scene = useThree((s) => s.scene);
  const setPosition = useGame((s) => s.setPosition);
  useDriveInput(ecctrl);

  // Camera không xuyên qua toà nhà.
  useEffect(() => {
    const cc = cameraControls.current;
    if (!cc) return;
    const colliders: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.cameraCollider) colliders.push(o);
    });
    cc.colliderMeshes = colliders;
    cc.distance = 6;
    cc.rotateTo(Math.PI, Math.PI * 0.42, false);
  }, [scene]);

  const lastReport = useRef(0);
  useFrame(({ clock }) => {
    const ctrl = ecctrl.current;
    const cc = cameraControls.current;
    if (!ctrl || !cc) return;
    const p = ctrl.currPos;
    // Rơi khỏi bản đồ thì đưa về điểm xuất phát.
    if (p.y < -20 && ctrl.body) {
      ctrl.body.setTranslation({ x: PLAYER.spawn[0], y: PLAYER.spawn[1], z: PLAYER.spawn[2] }, true);
      ctrl.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    cc.moveTo(p.x, p.y + 0.9, p.z, true);
    if (clock.elapsedTime - lastReport.current > 0.25) {
      lastReport.current = clock.elapsedTime;
      setPosition(p.x, p.z);
    }
  });

  return (
    <>
      <EcctrlAnimationStateController ecctrl={ecctrl} />
      <Ecctrl
        ref={ecctrl}
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
        <RobotModel />
      </Ecctrl>
      <EcctrlCameraControls
        ref={cameraControls}
        makeDefault
        smoothTime={0.08}
        minDistance={2.5}
        maxDistance={14}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI * 0.49}
      />
    </>
  );
}

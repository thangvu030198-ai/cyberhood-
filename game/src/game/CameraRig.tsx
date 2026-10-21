import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from "ecctrl/camera";
import { useButtonStore } from "ecctrl/input";
import { PLAYER } from "./config";
import { handles } from "./refs";
import { useGame } from "./store";
import { flipCarUpright } from "./Vehicles";

const FOOT_DISTANCE = 6;
const CAR_DISTANCE = 9.5;
/** Sau bao lâu không kéo chuột thì camera tự quay về sau đuôi xe (giây) */
const AUTO_FOLLOW_DELAY = 1.2;

function shortestAngle(from: number, to: number) {
  return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/** Camera góc nhìn thứ 3 dùng chung cho đi bộ và lái xe. */
export function CameraRig() {
  const cc = useRef<EcctrlCameraControlsHandle>(null);
  const scene = useThree((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const lastUserInput = useRef(-Infinity);

  useEffect(() => {
    const controls = cc.current;
    if (!controls) return;
    // Mặt đất và toà nhà chặn camera: khi kéo camera xuống thấp, nó áp sát nhân vật và ngửa lên trời.
    const colliders: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.cameraCollider) colliders.push(o);
    });
    // Đặt tâm camera vào nhân vật trước khi bật va chạm. Nếu tâm còn ở gốc toạ độ (sát mặt đất),
    // phép kiểm tra va chạm sẽ ép khoảng cách camera về gần 0.
    const [sx, sy, sz] = PLAYER.spawn;
    controls.setTarget(sx, sy, sz, false);
    controls.distance = FOOT_DISTANCE;
    controls.rotateTo(Math.PI, Math.PI * 0.42, false);
    controls.colliderMeshes = colliders;

    const onStart = () => (lastUserInput.current = Infinity);
    const onEnd = () => (lastUserInput.current = performance.now() / 1000);
    controls.addEventListener("controlstart", onStart);
    controls.addEventListener("controlend", onEnd);
    return () => {
      controls.removeEventListener("controlstart", onStart);
      controls.removeEventListener("controlend", onEnd);
    };
  }, [scene]);

  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    cc.current?.dollyTo(mode === "drive" ? CAR_DISTANCE : FOOT_DISTANCE, true);
  }, [mode]);

  useFrame(() => {
    const controls = cc.current;
    if (!controls) return;
    const { mode, carId } = useGame.getState();
    const car = mode === "drive" && carId !== null ? handles.cars.get(carId) : null;

    if (car) {
      const p = car.currPos;
      controls.moveTo(p.x, p.y + 1.3, p.z, true);
      const idle = performance.now() / 1000 - lastUserInput.current > AUTO_FOLLOW_DELAY;
      const speed = car.currLinVel.length();
      if (idle && speed > 2) {
        // Camera đứng sau đuôi xe: azimuth 0 nghĩa là camera ở phía +Z của mục tiêu.
        const fwd = car.bodyZAxis;
        const target = Math.atan2(-fwd.x, -fwd.z);
        const diff = shortestAngle(controls.azimuthAngle, target);
        controls.azimuthAngle += diff * 0.06;
      }
      return;
    }

    const player = handles.player;
    if (!player) return;
    const p = player.currPos;
    controls.moveTo(p.x, p.y + 0.6, p.z, true);
  });

  return (
    <EcctrlCameraControls
      ref={cc}
      makeDefault
      smoothTime={0.08}
      minDistance={2}
      maxDistance={16}
      minPolarAngle={0.3}
      // Cho phép kéo quá đường chân trời để ngửa lên nhìn toà nhà
      maxPolarAngle={Math.PI * 0.8}
    />
  );
}

/** Phím F lên/xuống xe, R lật xe lại. Trên cảm ứng dùng nút ENTER. */
export function Interaction() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "KeyF" || e.code === "KeyE") toggleCar();
      if (e.code === "KeyR") {
        const { mode, carId } = useGame.getState();
        if (mode === "drive" && carId !== null) flipCarUpright(carId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wasPressed = useRef(false);
  useFrame(() => {
    const pressed = !!useButtonStore.getState().buttons.enter;
    if (pressed && !wasPressed.current) toggleCar();
    wasPressed.current = pressed;
  });
  return null;
}

function toggleCar() {
  const { mode, nearCarId, enterCar, exitCar } = useGame.getState();
  if (mode === "drive") exitCar();
  else if (nearCarId !== null) enterCar(nearCarId);
}

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from "ecctrl/camera";
import { CameraControlsImpl } from "@react-three/drei";
import { useButtonStore } from "ecctrl/input";
import { PLAYER } from "./config";
import { handles } from "./refs";
import { uiBlocking, useGame } from "./store";
import { flipCarUpright } from "./Vehicles";
import { interact } from "./quests";
import { useHunter } from "./hunter";
import { inMechForm } from "./Mech";

const FOOT_DISTANCE = 6;
const CAR_DISTANCE = 9.5;
/** Dạng Mech cao gấp đôi: lùi camera để thấy toàn thân */
const MECH_DISTANCE = 10;
/** Khi ngắm: camera áp sát và lệch qua vai phải */
const AIM_DISTANCE = 3.2;
/** Độ nhạy chuột khi đã khoá (rad mỗi pixel) */
const MOUSE_SENSITIVITY = 0.0028;
/** Sau bao lâu không kéo chuột thì camera tự quay về sau đuôi xe (giây) */
const AUTO_FOLLOW_DELAY = 1.2;

const _lastTarget = new THREE.Vector3();

function shortestAngle(from: number, to: number) {
  return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/** Camera góc nhìn thứ 3 dùng chung cho đi bộ và lái xe. */
export function CameraRig() {
  const cc = useRef<EcctrlCameraControlsHandle>(null);
  const scene = useThree((s) => s.scene);
  const dom = useThree((s) => s.gl.domElement);
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
    controls.setTarget(sx, sy + 1.1, sz, false);
    controls.distance = FOOT_DISTANCE;
    controls.rotateTo(Math.PI, Math.PI * 0.475, false);
    controls.colliderMeshes = colliders;
    // Chuột phải dành cho ngắm bắn, không dùng để kéo dịch camera
    controls.mouseButtons.right = CameraControlsImpl.ACTION.NONE;

    // Khoá chuột: tự xử lý rê chuột để xoay camera, tắt kéo-xoay của CameraControls
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== dom) return;
      const aimScale = useGame.getState().aiming ? 0.6 : 1;
      controls.rotate(-e.movementX * MOUSE_SENSITIVITY * aimScale, -e.movementY * MOUSE_SENSITIVITY * aimScale, false);
      lastUserInput.current = performance.now() / 1000;
    };
    const unsubscribe = useGame.subscribe((s, prev) => {
      if (s.pointerLocked === prev.pointerLocked) return;
      controls.mouseButtons.left = s.pointerLocked ? CameraControlsImpl.ACTION.NONE : CameraControlsImpl.ACTION.ROTATE;
    });
    document.addEventListener("mousemove", onMove);

    const onStart = () => (lastUserInput.current = Infinity);
    const onEnd = () => (lastUserInput.current = performance.now() / 1000);
    controls.addEventListener("controlstart", onStart);
    controls.addEventListener("controlend", onEnd);
    return () => {
      document.removeEventListener("mousemove", onMove);
      unsubscribe();
      controls.removeEventListener("controlstart", onStart);
      controls.removeEventListener("controlend", onEnd);
    };
  }, [scene, dom]);

  const aiming = useGame((s) => s.aiming && s.mode === "foot");
  const mechOn = useHunter((s) => s.transform.phase === "active" || s.transform.phase === "transforming");
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    const controls = cc.current;
    if (!controls) return;
    controls.dollyTo(
      mode === "drive" ? CAR_DISTANCE : mechOn ? MECH_DISTANCE : aiming ? AIM_DISTANCE : FOOT_DISTANCE,
      true,
    );
    if (aiming) controls.setFocalOffset(0.75, 0.25, 0, true);
    else controls.setFocalOffset(0, 0, 0, true);
  }, [mode, aiming, mechOn]);

  useFrame(() => {
    const controls = cc.current;
    if (!controls) return;
    handles.camYaw = controls.azimuthAngle;
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
    // Dịch chuyển (vào/ra vault, hồi sinh): camera nhảy theo ngay, không bay vèo qua bản đồ
    if (p.distanceTo(_lastTarget) > 30) {
      controls.moveTo(p.x, p.y + 1.1, p.z, false);
      if (useGame.getState().location === "vault") controls.rotateTo(0, Math.PI * 0.47, false);
    }
    _lastTarget.copy(p);
    // Tâm camera trên đầu nhân vật: tâm ngắm nằm ngang tầm mắt, nhân vật ở nửa dưới màn hình
    controls.moveTo(p.x, p.y + 1.1, p.z, true);
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

/** Phím F lên/xuống xe, R lật xe, Esc đóng chợ. Trên cảm ứng: nút ENTER (xe) và TALK (tương tác). */
export function Interaction() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const s = useGame.getState();
      if (e.code === "KeyF") toggleCar();
      if (e.code === "Escape" && s.shopOpen) s.setShopOpen(false);
      if (e.code === "KeyR" && s.mode === "drive" && s.carId !== null) flipCarUpright(s.carId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const was = useRef({ enter: false, shop: false });
  useFrame(() => {
    const buttons = useButtonStore.getState().buttons;
    const enter = !!buttons.enter;
    const shop = !!buttons.talk;
    if (enter && !was.current.enter) toggleCar();
    if (shop && !was.current.shop) {
      const s = useGame.getState();
      if (s.nearInteract && !s.dialogue && !s.shopOpen) interact(s.nearInteract);
    }
    was.current = { enter, shop };
  });
  return null;
}

function toggleCar() {
  const s = useGame.getState();
  const { mode, nearCarId, enterCar, exitCar, flatlinedAt } = s;
  if (flatlinedAt !== null || uiBlocking(s) || s.location !== "city") return;
  if (mode === "foot" && inMechForm()) return s.showToast("Titan Frame không lái được xe");
  if (mode === "drive") exitCar();
  else if (nearCarId !== null) enterCar(nearCarId);
}

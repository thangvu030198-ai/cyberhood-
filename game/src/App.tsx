import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { KeyboardControls, useProgress } from "@react-three/drei";
import { Physics, useRapier } from "@react-three/rapier";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Joystick, VirtualButton } from "ecctrl/input";
import { City } from "./game/City";
import { Lights, Rain, Sky, SkyTraffic } from "./game/Atmosphere";
import { Player } from "./game/Player";
import { CameraRig, Interaction } from "./game/CameraRig";
import { CARS, Vehicles } from "./game/Vehicles";
import { handles } from "./game/refs";
import { districtAt, gridRef, useGame, type Emote } from "./game/store";

const KEYMAP = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
];

const EMOTE_KEYS: Record<string, Emote> = { Digit1: "wave", Digit2: "dance", Digit3: "thumbsUp" };

// Nút cảm ứng nằm trong hàng flex ở góc phải thay vì vị trí fixed mặc định của ecctrl.
const TOUCH_BUTTON = {
  position: "relative",
  width: "68px",
  height: "68px",
  background: "rgba(13, 2, 33, 0.55)",
  border: "1px solid rgba(255, 42, 109, 0.7)",
} as const;
const TOUCH_CAP = {
  width: "56px",
  height: "56px",
  background: "rgba(255, 42, 109, 0.25)",
  color: "#e9e6f5",
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  fontSize: "11px",
} as const;

function carName(id: number | null) {
  return CARS.find((c) => c.id === id)?.name ?? "";
}

function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

class Crash extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen">
        <p className="screen__tag">SIGNAL LOST</p>
        <h1 className="screen__title">Không khởi động được Cyberhood</h1>
        <p className="screen__body">
          Trình duyệt này chưa chạy được WebGL hoặc WebAssembly. Hãy thử Chrome, Edge hoặc Firefox bản mới trên máy tính.
        </p>
        <code className="screen__code">{this.state.error.message}</code>
      </div>
    );
  }
}

function LoadingScreen() {
  const { progress } = useProgress();
  return (
    <div className="screen">
      <p className="screen__tag">JACKING IN…</p>
      <h1 className="screen__title glitch" data-text="CYBERHOOD">
        CYBERHOOD
      </h1>
      <div className="bar">
        <div className="bar__fill" style={{ width: `${Math.max(8, progress)}%` }} />
      </div>
    </div>
  );
}

function Hud() {
  const x = useGame((s) => s.x);
  const z = useGame((s) => s.z);
  const setEmote = useGame((s) => s.setEmote);
  const ready = useGame((s) => s.ready);
  const mode = useGame((s) => s.mode);
  const carId = useGame((s) => s.carId);
  const nearCarId = useGame((s) => s.nearCarId);
  const speed = useGame((s) => s.speed);
  const [help, setHelp] = useState(true);
  const touch = isTouchDevice();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const emote = EMOTE_KEYS[e.code];
      if (emote) setEmote(emote);
      if (e.code === "KeyH") setHelp((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setEmote]);

  if (!ready) return <LoadingScreen />;

  return (
    <div className="hud">
      <header className="hud__top">
        <div className="brand">
          <span className="brand__name">CYBERHOOD</span>
          <span className="brand__build">build 0.1 · giai đoạn 1</span>
        </div>
        <div className="loc">
          <span className="loc__label">DISTRICT</span>
          <span className="loc__value">{districtAt(x, z)}</span>
          <span className="loc__grid">{gridRef(x, z)}</span>
        </div>
      </header>

      {mode === "foot" && nearCarId !== null && (
        <div className="prompt">
          <kbd>{touch ? "ENTER" : "F"}</kbd> Lên xe <strong>{carName(nearCarId)}</strong>
        </div>
      )}

      {mode === "drive" && (
        <div className="speedo" aria-label="Tốc độ">
          <span className="speedo__car">{carName(carId)}</span>
          <span className="speedo__value">{speed}</span>
          <span className="speedo__unit">km/h</span>
        </div>
      )}

      {help && !touch && (
        <aside className="help" aria-label="Điều khiển">
          {mode === "foot" ? (
            <dl>
              <dt>W A S D</dt>
              <dd>Di chuyển</dd>
              <dt>Shift</dt>
              <dd>Chạy</dd>
              <dt>Space</dt>
              <dd>Nhảy</dd>
              <dt>F</dt>
              <dd>Lên xe (đứng cạnh xe)</dd>
              <dt>Kéo chuột</dt>
              <dd>Xoay camera · kéo lên để ngửa nhìn toà nhà</dd>
              <dt>Cuộn</dt>
              <dd>Zoom</dd>
              <dt>1 2 3</dt>
              <dd>Vẫy tay · Nhảy múa · Like</dd>
              <dt>H</dt>
              <dd>Ẩn/hiện bảng này</dd>
            </dl>
          ) : (
            <dl>
              <dt>W / S</dt>
              <dd>Ga / Lùi</dd>
              <dt>A / D</dt>
              <dd>Đánh lái</dd>
              <dt>Space</dt>
              <dd>Phanh</dd>
              <dt>F</dt>
              <dd>Xuống xe</dd>
              <dt>R</dt>
              <dd>Lật xe lại</dd>
              <dt>Kéo chuột</dt>
              <dd>Nhìn quanh</dd>
              <dt>H</dt>
              <dd>Ẩn/hiện bảng này</dd>
            </dl>
          )}
        </aside>
      )}

      {touch && (
        <>
          <Joystick
            className="touch-stick"
            joystickWrapperStyle={{
              left: "max(12px, env(safe-area-inset-left, 0px))",
              bottom: "max(24px, env(safe-area-inset-bottom, 0px))",
            }}
            joystickBaseStyle={{ border: "2px solid #ff2a6d", background: "rgba(13, 2, 33, 0.45)" }}
            joystickKnobStyle={{ width: "56px", height: "56px", background: "rgba(5, 217, 232, 0.75)" }}
          />
          <div className="touch-buttons">
            {(mode === "drive" || nearCarId !== null) && <VirtualButton id="enter" label={mode === "drive" ? "EXIT" : "ENTER"} buttonWrapperStyle={TOUCH_BUTTON} buttonCapStyle={TOUCH_CAP} />}
            {mode === "foot" && <VirtualButton id="run" label="RUN" buttonWrapperStyle={TOUCH_BUTTON} buttonCapStyle={TOUCH_CAP} />}
            <VirtualButton id="jump" label={mode === "drive" ? "BRAKE" : "JUMP"} buttonWrapperStyle={TOUCH_BUTTON} buttonCapStyle={TOUCH_CAP} />
          </div>
          {mode === "foot" && (
            <button type="button" className="emote-btn" onClick={() => setEmote("wave")}>
              WAVE
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Bước vật lý không vượt quá 1/30 giây; FPS thấp thì game chậm lại thay vì nổ vật lý. */
const MAX_PHYSICS_DT = 1 / 30;

/**
 * ecctrl cộng lực mỗi frame theo world.timestep, nên mỗi frame phải đúng một bước vật lý.
 * Vì vậy tự bước thế giới theo thời gian frame (có giới hạn) thay cho vòng lặp mặc định.
 */
function PhysicsStepper() {
  const { step } = useRapier();
  useFrame((_, dt) => step(Math.min(dt, MAX_PHYSICS_DT)));
  return null;
}

function DebugHook() {
  const state = useThree();
  if (new URLSearchParams(location.search).has("debug")) {
    Object.assign(window, { __r3f: state, __game: useGame, __handles: handles });
  }
  return null;
}

const NO_CARS = typeof location !== "undefined" && new URLSearchParams(location.search).has("nocars");
const NO_FX = typeof location !== "undefined" && new URLSearchParams(location.search).has("nofx");

export default function App() {
  return (
    <Crash>
      <KeyboardControls map={KEYMAP}>
        <Canvas
          shadows={false}
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: "high-performance" }}
          camera={{ fov: 60, near: 0.1, far: 1200, position: [0, 4, 12] }}
        >
          <Suspense fallback={null}>
            <Sky />
            <Lights />
            <Physics timeStep="vary" paused>
              <PhysicsStepper />
              <City />
              <Player />
              {!NO_CARS && <Vehicles />}
            </Physics>
            <CameraRig />
            <Interaction />
            <SkyTraffic />
            <Rain />
            <DebugHook />
            {!NO_FX && (<EffectComposer multisampling={0}>
              <Bloom mipmapBlur intensity={1.1} luminanceThreshold={1} luminanceSmoothing={0.2} />
              <Vignette eskil={false} offset={0.25} darkness={0.75} />
            </EffectComposer>)}
          </Suspense>
        </Canvas>
        <Hud />
      </KeyboardControls>
    </Crash>
  );
}

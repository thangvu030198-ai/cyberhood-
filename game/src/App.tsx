import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { KeyboardControls, useProgress } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Joystick, VirtualButton } from "ecctrl/input";
import { City } from "./game/City";
import { Lights, Rain, Sky, SkyTraffic } from "./game/Atmosphere";
import { Player } from "./game/Player";
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
          <span className="brand__build">build 0.0 · giai đoạn 0</span>
        </div>
        <div className="loc">
          <span className="loc__label">DISTRICT</span>
          <span className="loc__value">{districtAt(x, z)}</span>
          <span className="loc__grid">{gridRef(x, z)}</span>
        </div>
      </header>

      {help && !touch && (
        <aside className="help" aria-label="Điều khiển">
          <dl>
            <dt>W A S D</dt>
            <dd>Di chuyển</dd>
            <dt>Shift</dt>
            <dd>Chạy</dd>
            <dt>Space</dt>
            <dd>Nhảy</dd>
            <dt>Kéo chuột</dt>
            <dd>Xoay camera</dd>
            <dt>Cuộn</dt>
            <dd>Zoom</dd>
            <dt>1 2 3</dt>
            <dd>Vẫy tay · Nhảy múa · Like</dd>
            <dt>H</dt>
            <dd>Ẩn/hiện bảng này</dd>
          </dl>
        </aside>
      )}

      {touch && (
        <>
          <Joystick className="touch-stick" />
          <div className="touch-buttons">
            <VirtualButton id="run" label="RUN" />
            <VirtualButton id="jump" label="JUMP" />
          </div>
          <button type="button" className="emote-btn" onClick={() => setEmote("wave")}>
            WAVE
          </button>
        </>
      )}
    </div>
  );
}

function DebugHook() {
  const state = useThree();
  if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __r3f: unknown }).__r3f = state;
  return null;
}

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
            <Physics timeStep={1 / 60}>
              <City />
              <Player />
            </Physics>
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

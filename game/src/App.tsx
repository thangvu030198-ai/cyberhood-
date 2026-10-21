import { Component, Suspense, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics, useRapier } from "@react-three/rapier";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { City } from "./game/City";
import { Lights, Rain, Sky } from "./game/Atmosphere";
import { Player } from "./game/Player";
import { CameraRig, Interaction } from "./game/CameraRig";
import { Vehicles } from "./game/Vehicles";
import { Enemies, damageDrone, drones } from "./game/Enemies";
import { ObjectiveArrow } from "./game/ObjectiveArrow";
import { TrafficDebug } from "./game/TrafficDebug";
import { traffic } from "./game/trafficWorld";
import { Effects } from "./game/Effects";
import { PlayerCombat, combatDebug } from "./game/Weapons";
import { Shop } from "./game/Shop";
import { GameRules } from "./game/GameRules";
import { Npcs } from "./game/Npcs";
import { ContractScene } from "./game/ContractScene";
import { MechController } from "./game/Mech";
import { HubProps, Showcase } from "./game/Showcase";
import { LifeDynamic, LifeStatic } from "./game/Life";
import { MeshyDynamic, MeshyStatic } from "./game/MeshyProps";
import { useHunter } from "./game/hunter";
import { runtime, startNewContract } from "./game/contracts";
import { Vault, VaultDoor } from "./game/Vault";
import { HoloAds, NeonEnvironment, SteamVents } from "./game/Visuals";
import { KitDressing } from "./game/Kit";
import { handles } from "./game/refs";
import { useGame } from "./game/store";
import { questProgress } from "./game/quests";
import { Hud } from "./ui/Hud";
import { HUB_PEACEFUL } from "./game/config";
import { LedBoards } from "./game/LedBoards";
import { LevelCanvas } from "./level/LevelScene";
import { LevelHud } from "./level/LevelHud";
import { DuelCanvas, DuelHud } from "./level/DuelScene";
import { useDuel } from "./level/duelSession";
import { KartCanvas, KartHud, useKart } from "./level/KartScene";
import { enterLevel, playLevel, useLevel } from "./level/session";

const KEYMAP = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
];

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

/** Bước vật lý không vượt quá 1/30 giây; FPS thấp thì game chậm lại thay vì nổ vật lý. */
/** Bước vật lý dài nhất: FPS tụt thì mô phỏng chậm lại chứ không bước dài, để hệ treo xe không nảy */
const MAX_PHYSICS_DT = 1 / 40;

/**
 * ecctrl cộng lực mỗi frame theo world.timestep, nên mỗi frame phải đúng một bước vật lý.
 * Vì vậy tự bước thế giới theo thời gian frame (có giới hạn) thay cho vòng lặp mặc định.
 */
function PhysicsStepper() {
  const { step } = useRapier();
  useFrame((_, dt) => step(Math.min(dt, MAX_PHYSICS_DT)));
  return null;
}

const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const NO_CARS = params.has("nocars");
const NO_FX = params.has("nofx");

function DebugHook() {
  const state = useThree();
  if (params.has("debug")) {
    Object.assign(window, {
      __r3f: state,
      __game: useGame,
      __handles: handles,
      __drones: drones,
      __damageDrone: damageDrone,
      __combat: combatDebug,
      __quests: { questProgress },
      __hunter: useHunter,
      __contract: { runtime, startNewContract },
      __traffic: traffic,
      __level: { useLevel, enterLevel, playLevel },
    });
  }
  return null;
}

export default function App() {
  const quality = useGame((s) => s.quality);
  // Trong màn đi ngang: thành phố đứng hình (không vẽ, không chạy) nhưng vẫn giữ nguyên trạng thái
  const inLevel = useGame((s) => s.location === "level");
  const inDuel = useDuel((s) => s.sim !== null);
  const inKart = useKart((s) => s.sim !== null);
  return (
    <Crash>
      <KeyboardControls map={KEYMAP}>
        <Canvas
          frameloop={inLevel ? "never" : "always"}
          style={{ visibility: inLevel ? "hidden" : "visible" }}
          shadows={false}
          dpr={quality === "high" ? [1, 1.25] : 1}
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
              <Shop />
              <Npcs />
              <Vault />
              <ContractScene />
              <HubProps />
              <LifeStatic quality={quality} />
              <MeshyStatic />
              <KitDressing />
            </Physics>
            <VaultDoor />
            <NeonEnvironment />
            <HoloAds />
            <SteamVents />
            {!HUB_PEACEFUL && <Enemies />}
            <MechController />
            <PlayerCombat />
            <Effects />
            <GameRules />
            <CameraRig />
            <Interaction />
            <Showcase quality={quality} />
            <LifeDynamic quality={quality} />
            <MeshyDynamic />
            <ObjectiveArrow />
            <LedBoards />
            <TrafficDebug />
            <Rain />
            <DebugHook />
            {!NO_FX && (
              <EffectComposer multisampling={0}>
                <Bloom mipmapBlur intensity={1.1} luminanceThreshold={1} luminanceSmoothing={0.2} />
                <Vignette eskil={false} offset={0.25} darkness={0.75} />
              </EffectComposer>
            )}
          </Suspense>
        </Canvas>
        {inLevel ? (
          <Suspense fallback={null}>
            {inKart ? (
              <>
                <KartCanvas />
                <KartHud />
              </>
            ) : inDuel ? (
              <>
                <DuelCanvas />
                <DuelHud />
              </>
            ) : (
              <>
                <LevelCanvas />
                <LevelHud />
              </>
            )}
          </Suspense>
        ) : (
          <Hud />
        )}
      </KeyboardControls>
    </Crash>
  );
}

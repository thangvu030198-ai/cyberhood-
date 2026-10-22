import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { GAME } from "../sim/config";
import { canTransform, damageMech, hitByEmp, startTransform, tickTransform } from "../sim/transform";
import { setBossDamageScale } from "./Enemies";
import { fx } from "./Effects";
import { handles } from "./refs";
import { setDamageHook, uiBlocking, useGame } from "./store";
import { useHunter } from "./hunter";
import { runtime } from "./contracts";
import { playSfx } from "./assets";

// Biến hình Titan Frame (GDD mục 5): phím T khi thanh đầy, Mech chịu đòn thay người,
// trúng EMP mất 5 giây, hết giờ hoặc hết máu thì trở lại và Mech mất 1 độ bền.

/** Hệ số sát thương súng khi đang là Mech (pháo) */
export const MECH_DAMAGE_MUL = 3;

export const mechActive = () => useHunter.getState().transform.phase === "active";
export const inMechForm = () => useHunter.getState().transform.phase !== "normal";

export function tryTransform() {
  const g = useGame.getState();
  const h = useHunter.getState();
  if (g.mode !== "foot" || g.flatlinedAt !== null || uiBlocking(g) || (g.location !== "city" && g.location !== "siege" && g.location !== "raid")) return;
  const mech = h.equippedMech();
  if (!mech) return g.showToast("Chưa trang bị Mech: nhấn G để vào Gara");
  if (!canTransform(h.transform, mech.durability)) {
    if (mech.durability <= 0) g.showToast("Mech hết độ bền: sửa ở Gara (G)");
    else if (h.transform.cooldown > 0) g.showToast(`Biến hình đang hồi: ${Math.ceil(h.transform.cooldown)}s`);
    else if (h.transform.meter < GAME.transform.meterMax) g.showToast("Thanh biến hình chưa đầy: hạ Legion, làm nhiệm vụ");
    return;
  }
  const t = { ...h.transform };
  startTransform(t, mech.durability, g.maxHp);
  useHunter.setState({ transform: t });
  playSfx("transform", 1);
  const p = handles.player?.currPos;
  if (p) {
    fx.blast(p);
    runtime.beams.push({ pos: p.clone(), color: "#ffb000", born: performance.now() / 1000 });
  }
}

export function MechController() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Trong màn đi ngang, bàn phím thuộc về màn chơi
      if (useGame.getState().location === "level") return;
      if (e.code === "KeyT" && !e.repeat) tryTransform();
    };
    window.addEventListener("keydown", onKey);
    // Trong dạng Mech, Mech chịu sát thương; lúc đang biến hình thì bất tử
    setDamageHook((amount, emp) => {
      const h = useHunter.getState();
      const phase = h.transform.phase;
      if (phase === "transforming") return true;
      if (phase !== "active") return false;
      damageMech(h.transform, amount);
      if (emp) hitByEmp(h.transform);
      return true;
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      setDamageHook(null);
    };
  }, []);

  useFrame((_, dt) => {
    const h = useHunter.getState();
    const step = Math.min(dt, 0.1);
    const t = h.transform;
    const prevPhase = t.phase;
    // Chết thì Mech sụp ngay
    if (useGame.getState().flatlinedAt !== null && t.phase === "active") t.timer = 0;
    const ev = tickTransform(t, step);
    if (ev === "activated") {
      const p = handles.player?.currPos;
      if (p) fx.blast(p);
    }
    if (ev === "reverted") {
      h.useMechDurability();
      useGame.getState().showToast("Trở lại dạng người · Mech −1 độ bền");
    }
    // Đồng hồ và thanh được đổi tại chỗ (HUD tự đọc theo nhịp); chỉ báo store khi đổi pha
    if (ev || t.phase !== prevPhase) useHunter.setState({ transform: { ...t } });
    // Trùm Mech gần như miễn nhiễm với súng thường, chỉ pháo Mech mới gây sát thương đầy đủ
    setBossDamageScale(t.phase === "active" ? 1 : 0.08);
    const target = t.phase === "active" || t.phase === "transforming" ? 1 : 0;
    handles.mechBlend += (target - handles.mechBlend) * Math.min(1, step * (t.phase === "transforming" ? 2.2 : 4));
  });
  return null;
}

// Bàn phím và nút cảm ứng cho màn đi ngang. A/D hoặc ←/→ chạy, Space nhảy, J bắn (giữ để nạp), K lướt.

import type { Input } from "./platformer";

const KEYS: Record<keyof Input, string[]> = {
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  jump: ["Space", "KeyW", "ArrowUp"],
  shoot: ["KeyJ", "KeyX"],
  dash: ["KeyK", "ShiftLeft", "ShiftRight", "KeyZ"],
};

const down = new Set<string>();
/** Nút cảm ứng đang giữ */
const touch: Input = { left: false, right: false, up: false, down: false, jump: false, shoot: false, dash: false };

export const levelInput = {
  paused: false,
  state(): Input {
    const k = (name: keyof Input) => touch[name] || KEYS[name].some((c) => down.has(c));
    return { left: k("left"), right: k("right"), up: k("up"), down: k("down"), jump: k("jump"), shoot: k("shoot"), dash: k("dash") };
  },
  setTouch(name: keyof Input, on: boolean) {
    touch[name] = on;
  },
  clear() {
    down.clear();
    for (const k of Object.keys(touch) as (keyof Input)[]) touch[k] = false;
  },
};

const GAME_CODES = new Set(Object.values(KEYS).flat());

/** Gắn bàn phím khi vào màn; trả hàm gỡ ra */
export function bindLevelKeys(onEscape: () => void) {
  const onDown = (e: KeyboardEvent) => {
    if (e.code === "Escape") {
      onEscape();
      return;
    }
    if (GAME_CODES.has(e.code)) e.preventDefault();
    down.add(e.code);
  };
  const onUp = (e: KeyboardEvent) => down.delete(e.code);
  const onBlur = () => down.clear();
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);
  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", onBlur);
    levelInput.clear();
  };
}

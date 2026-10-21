import { useGame } from "./store";

// Khoá chuột (Pointer Lock) kiểu game PC: rê chuột xoay camera, nhấp chuột bắn.
// Trình duyệt hoặc khung nhúng không cho khoá thì quay về kiểu kéo chuột để xoay.

export const pointer = {
  /** false khi trình duyệt từ chối khoá chuột */
  supported: typeof document !== "undefined" && "requestPointerLock" in Element.prototype,
};

export function isLocked(el: Element) {
  return document.pointerLockElement === el;
}

export function requestLock(el: HTMLElement) {
  try {
    const result = el.requestPointerLock() as unknown;
    if (result instanceof Promise) {
      result.catch(() => {
        pointer.supported = false;
        useGame.getState().setPointerLocked(false);
      });
    }
  } catch {
    pointer.supported = false;
  }
}

export function releaseLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

if (typeof document !== "undefined") {
  document.addEventListener("pointerlockchange", () => {
    useGame.getState().setPointerLocked(!!document.pointerLockElement);
  });
  document.addEventListener("pointerlockerror", () => {
    pointer.supported = false;
  });
}

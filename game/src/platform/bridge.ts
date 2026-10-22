// Cầu nối với website khi game chạy trong iframe (cách B). Chạy riêng ở subdomain (cách A) thì không làm gì.
// Luôn kiểm tra event.origin; chỉ gửi tin cho đúng origin của trang cha.

import { create } from "zustand";
import { PLATFORM, GAME_VERSION } from "./config";
import { PROTOCOL_VERSION, parseWebMessage, type GameToWeb, type WebToGame } from "./protocol";
import { setToken } from "./auth";

const embedded = typeof window !== "undefined" && window.parent !== window;
/** Origin trang cha đã xác thực (lấy từ tin nhắn hợp lệ đầu tiên hoặc document.referrer) */
let parentOrigin: string | null = null;

export const useBridge = create<{ embedded: boolean; lastSign: { ok: boolean; txHash?: string; error?: string } | null }>(() => ({
  embedded,
  lastSign: null,
}));

const allowed = (origin: string) => PLATFORM.allowedOrigins.includes(origin);

export function sendToWeb(msg: GameToWeb) {
  if (!embedded) return;
  const target = parentOrigin ?? referrerOrigin();
  if (!target || !allowed(target)) return;
  window.parent.postMessage(msg, target);
}

function referrerOrigin() {
  try {
    return document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    return null;
  }
}

function handle(msg: WebToGame) {
  if (msg.type === "AUTH") setToken(msg.payload.token);
  else if (msg.type === "LOGOUT") setToken(null);
  else if (msg.type === "SIGN_RESULT") useBridge.setState({ lastSign: msg.payload });
}

let started = false;
export function startBridge() {
  if (started || !embedded) return;
  started = true;
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || !allowed(e.origin)) return;
    const msg = parseWebMessage(e.data);
    if (!msg) return;
    parentOrigin = e.origin;
    handle(msg);
  });
  sendToWeb({ v: PROTOCOL_VERSION, type: "READY", payload: { version: GAME_VERSION } });
}

/** Game xin website mở chợ / ký đúc NFT — game không tự ký gì */
export const openMarket = (itemId: string) => sendToWeb({ v: PROTOCOL_VERSION, type: "OPEN_MARKET", payload: { itemId } });
export const requestMint = (itemId: string) => sendToWeb({ v: PROTOCOL_VERSION, type: "REQUEST_SIGN", payload: { action: "MINT_NFT", itemId } });

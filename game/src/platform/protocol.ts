// @cyberhood/protocol — bộ tin nhắn postMessage giữa website và game khi nhúng bằng iframe.
// Quy tắc: thêm loại tin nhắn mới, không sửa loại cũ; đổi cấu trúc thì tăng `v`.
// File này cố ý không phụ thuộc gì để tách ra gói dùng chung nguyên vẹn.

export const PROTOCOL_VERSION = 1 as const;

export type GameToWeb =
  | { v: 1; type: "READY"; payload?: { version: string } }
  | { v: 1; type: "REQUEST_SIGN"; payload: { action: "MINT_NFT"; itemId: string } }
  | { v: 1; type: "OPEN_MARKET"; payload: { itemId: string } }
  | { v: 1; type: "REQUEST_AUTH" }
  | { v: 1; type: "PROFILE"; payload: { name: string; hunter: string } };

export type WebToGame =
  | { v: 1; type: "AUTH"; payload: { token: string } }
  | { v: 1; type: "SIGN_RESULT"; payload: { ok: boolean; txHash?: string; error?: string } }
  | { v: 1; type: "LOGOUT" };

const WEB_TYPES = new Set(["AUTH", "SIGN_RESULT", "LOGOUT"]);

/** Kiểm tra hình dạng tin nhắn từ website (dữ liệu bên ngoài, không tin tưởng) */
export function parseWebMessage(data: unknown): WebToGame | null {
  if (!data || typeof data !== "object") return null;
  const m = data as { v?: unknown; type?: unknown; payload?: unknown };
  if (m.v !== PROTOCOL_VERSION || typeof m.type !== "string" || !WEB_TYPES.has(m.type)) return null;
  if (m.type === "AUTH") {
    const p = m.payload as { token?: unknown } | undefined;
    if (!p || typeof p.token !== "string" || p.token.length > 4096) return null;
  }
  if (m.type === "SIGN_RESULT") {
    const p = m.payload as { ok?: unknown } | undefined;
    if (!p || typeof p.ok !== "boolean") return null;
  }
  return m as WebToGame;
}

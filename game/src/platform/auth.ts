// Đăng nhập dùng chung: website (Platform API) giữ phiên, game chỉ nhận một JWT ngắn hạn qua
// play.cyberhood.xyz/#token=... hoặc tin nhắn AUTH, rồi đổi lấy phiên game. Game không biết người chơi đăng nhập bằng gì.

import { create } from "zustand";

export const useAuth = create<{ token: string | null }>(() => ({ token: null }));

export function setToken(token: string | null) {
  useAuth.setState({ token });
}

/** Đọc #token=... rồi xoá khỏi thanh địa chỉ để token không nằm trong lịch sử / ảnh chụp màn hình */
export function readHashToken() {
  if (typeof location === "undefined" || !location.hash.includes("token=")) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const t = params.get("token");
  if (t && t.length < 4096) setToken(t);
  params.delete("token");
  const rest = params.toString();
  history.replaceState(null, "", location.pathname + location.search + (rest ? `#${rest}` : ""));
}

/** Gọi Platform API /v1 kèm token (null khi chưa cấu hình API hoặc chưa có token) */
export async function api<T>(base: string, path: string, init: RequestInit = {}): Promise<T | null> {
  const token = useAuth.getState().token;
  if (!base || !token) return null;
  const res = await fetch(`${base}/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (res.status === 401) {
    setToken(null);
    return null;
  }
  if (!res.ok) throw new Error(`API ${path} ${res.status}`);
  return res.status === 204 ? null : ((await res.json()) as T);
}

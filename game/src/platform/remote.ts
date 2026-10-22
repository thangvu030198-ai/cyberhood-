// Remote config + manifest: chỉnh số liệu cân bằng, bật/tắt cổng mới mà không cần build lại game.
// - manifest.json { current, minSupported, cdn }: bản build thấp hơn minSupported thì báo người chơi tải lại.
// - game_config.json (cùng cấu trúc docs/game_config.json) + khoá "flags": { siege: true, raid: false, ... }.
// Không tải được thì game chạy bằng số liệu đóng gói sẵn — remote config chỉ ghi đè.

import { PLATFORM, GAME_VERSION } from "./config";
import { usePlatform } from "./state";

export type Manifest = { current: string; minSupported: string; cdn: string };

let remote: Record<string, unknown> = {};

/** So sánh phiên bản dạng a.b.c */
export function versionLess(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  return false;
}

async function getJson<T>(url: string, ms = 3000): Promise<T | null> {
  if (!url) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: "no-cache" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function bootRemote() {
  const [manifest, cfg] = await Promise.all([getJson<Manifest>(PLATFORM.manifestUrl), getJson<Record<string, unknown>>(PLATFORM.configUrl)]);
  if (manifest?.minSupported && versionLess(GAME_VERSION, manifest.minSupported)) usePlatform.setState({ outdated: true });
  if (cfg && typeof cfg === "object") {
    remote = cfg;
    const flags = cfg.flags;
    if (flags && typeof flags === "object") {
      const f: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(flags)) if (typeof v === "boolean") f[k] = v;
      usePlatform.setState({ flags: f });
    }
  }
}

/** Đọc một giá trị remote theo đường dẫn "mythicRaid.timeMin"; sai kiểu hoặc không có thì dùng giá trị mặc định */
export function rc<T extends number | string | boolean>(path: string, fallback: T): T {
  let cur: unknown = remote;
  for (const k of path.split(".")) {
    if (!cur || typeof cur !== "object") return fallback;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === typeof fallback ? (cur as T) : fallback;
}

/** Feature flag: mặc định bật, remote config tắt được từng cổng */
export const featureOn = (name: string) => usePlatform.getState().flags[name] !== false;

// Cấu hình nền tảng lấy lúc build (biến môi trường Vite) — mỗi môi trường dev / staging / production build riêng.
// Game không chứa code blockchain: ví, ký giao dịch, NFT đều nằm ở website và Chain Service; game chỉ gọi Platform API.

const env = import.meta.env as Record<string, string | undefined>;

/** Phiên bản bản build này (so với manifest.minSupported để báo người chơi tải lại) */
export const GAME_VERSION = env.VITE_GAME_VERSION ?? "1.0.0";

export const PLATFORM = {
  /** Gốc Platform API, ví dụ https://api.cyberhood.xyz — trống thì game chạy không cần server (lưu cục bộ / host artifact) */
  apiBase: (env.VITE_API_BASE ?? "").replace(/\/$/, ""),
  /** WebSocket server realtime (Colyseus / Nakama hoặc server tham chiếu trong /server) */
  wsUrl: env.VITE_WS_URL ?? "",
  /** manifest.json của CDN: { current, minSupported, cdn } */
  manifestUrl: env.VITE_MANIFEST_URL ?? "",
  /** Remote config (game_config.json): số liệu cân bằng + feature flag */
  configUrl: env.VITE_CONFIG_URL ?? "",
  /** Origin website được phép nhúng game bằng iframe và trao đổi postMessage */
  allowedOrigins: (env.VITE_ALLOWED_ORIGINS ?? "https://cyberhood.xyz,https://www.cyberhood.xyz,https://staging.cyberhood.xyz")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

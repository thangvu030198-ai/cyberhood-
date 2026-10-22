import { create } from "zustand";

/** Trạng thái nền tảng hiển thị trên giao diện */
export const usePlatform = create<{
  /** Nơi lưu hồ sơ: chỉ máy này / đám mây của host / tài khoản Platform API */
  save: "local" | "cloud" | "account";
  lastCloudSave: number;
  /** Tên tài khoản do host cung cấp (gợi ý điền sẵn ở màn tạo nhân vật) */
  accountName: string;
  /** Số người chơi khác đang online cùng bản đồ */
  online: number;
  net: "off" | "host" | "ws";
  /** Bản build quá cũ so với manifest.minSupported */
  outdated: boolean;
  flags: Record<string, boolean>;
}>(() => ({ save: "local", lastCloudSave: 0, accountName: "", online: 0, net: "off", outdated: false, flags: {} }));

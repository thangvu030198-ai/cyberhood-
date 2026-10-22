// Khởi động lớp nền tảng trước khi nạp game: token, cầu nối iframe, remote config, kéo bản lưu từ server.
// Mỗi bước đều có thời hạn: mạng chậm hay không có server thì game vẫn vào được bằng dữ liệu cục bộ.

import { readHashToken } from "./auth";
import { startBridge } from "./bridge";
import { bootRemote } from "./remote";
import { bootSave } from "./save";

const timeout = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function bootPlatform() {
  readHashToken();
  startBridge();
  await Promise.race([Promise.all([bootRemote(), bootSave()]), timeout(4000)]);
}

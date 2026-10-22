# Tích hợp game CYBERHOOD vào website

Tài liệu cho đội web và backend. Game client đã làm sẵn phần của mình theo kiến trúc
*website ↔ Platform API ↔ game*. Website không import code game, game không import code web.
Game **không chứa code blockchain**.

Mã nằm ở `game/src/platform/`:

| File | Vai trò |
|---|---|
| `config.ts` | Đọc biến môi trường lúc build (`game/.env.example`) |
| `protocol.ts` | Định nghĩa tin nhắn postMessage v1, tách được thành gói `@cyberhood/protocol` |
| `bridge.ts` | Cầu nối iframe: kiểm tra `event.origin`, gửi `READY` / `PROFILE` / `OPEN_MARKET` / `REQUEST_SIGN` |
| `auth.ts` | Nhận JWT ngắn hạn qua `#token=` hoặc tin nhắn `AUTH`; hàm `api()` gọi `/v1` |
| `save.ts` | Đồng bộ hồ sơ người chơi lên server, chọn nguồn theo thứ tự Platform API → host artifact → cục bộ |
| `net.ts` | Chơi chung trong Hub: WebSocket tới game server, hoặc phòng realtime của host artifact |
| `remote.ts` | Đọc `manifest.json`, remote config (`game_config.json`) và feature flag |
| `boot.ts` | Khởi động tất cả các phần trên trước khi nạp game, mỗi bước có giới hạn thời gian |

## 1. Nút "Chơi ngay" (cách A, khuyên dùng)

```
https://play.cyberhood.xyz/#token=<JWT ngắn hạn>
```

Game đọc token rồi xoá nó khỏi thanh địa chỉ. Không có token thì game vẫn chạy, chỉ lưu tiến trình trên máy.

## 2. Nhúng iframe (cách B)

Phía website:

```js
const GAME = "https://play.cyberhood.xyz";
const frame = document.querySelector("iframe#game");
window.addEventListener("message", async (e) => {
  if (e.origin !== GAME || e.source !== frame.contentWindow) return;
  const m = e.data;
  if (m?.v !== 1) return;
  if (m.type === "READY") frame.contentWindow.postMessage({ v: 1, type: "AUTH", payload: { token } }, GAME);
  if (m.type === "OPEN_MARKET") openMarket(m.payload.itemId);
  if (m.type === "REQUEST_SIGN") {
    const res = await walletFlow(m.payload); // ví và ký giao dịch nằm ở website
    frame.contentWindow.postMessage({ v: 1, type: "SIGN_RESULT", payload: res }, GAME);
  }
});
```

Game chỉ nhận tin từ các origin trong `VITE_ALLOWED_ORIGINS` và chỉ gửi tin cho đúng origin của trang cha.

Quy tắc version: khi cần tính năng mới thì thêm loại tin nhắn mới. Phải đổi cấu trúc thì tăng `v`.

## 3. Platform API mà game gọi

| Method | Đường dẫn | Dùng cho |
|---|---|---|
| GET | `/v1/me/save` | Lấy bản lưu `{savedAt, data:{"cyberhood.*": "<json>"}}`, trả `404`/`null` nếu chưa có |
| PUT | `/v1/me/save` | Ghi bản lưu, gọi tối đa 15 giây một lần khi có thay đổi và khi rời trang |
| GET | `/v1/auth/verify` | Game server gọi để kiểm tra JWT, trả `200 {id}` |

- Mọi request có header `Authorization: Bearer <JWT>`.
- Gặp `401` thì game bỏ token và chuyển về lưu cục bộ.
- Bản lưu mới hơn (`savedAt` lớn hơn) thắng.
- Kho đồ và NFT on-chain do API/Chain Service quản lý. Bản lưu này chỉ là tiến trình gameplay.

## 4. Chơi chung (Hub)

- Server tham chiếu ở `server/`, kèm giao thức, biến môi trường và test (`npm test`).
- Production dùng Colyseus hoặc Nakama, giữ đúng các tin `hello` / `state` / `peers`.
- Build game với `VITE_WS_URL=wss://rt.cyberhood.xyz`.
- Khi không có `VITE_WS_URL` và game chạy như artifact trên claude.ai, game dùng phòng realtime của host. Ai đang mở game và được chia sẻ quyền thì thấy nhau.

Mỗi người chơi gửi khoảng 10 gói mỗi giây, mỗi gói vài chục byte (vị trí, hướng, dáng đi, tên, lớp nhân vật).
Cả hai phía đều làm sạch dữ liệu nhận được.

## 5. Deploy có version

```
cdn.cyberhood.xyz/game/1.4.3/cyberhood.html   (thư mục bất biến)
cdn.cyberhood.xyz/game/manifest.json          { "current": "1.4.3", "minSupported": "1.4.0", "cdn": "..." }
cdn.cyberhood.xyz/game/game_config.json       giống docs/game_config.json, thêm khoá "flags"
```

- **Deploy hoặc rollback:** sửa `current`.
- **Bản build cũ:** nếu `VITE_GAME_VERSION` thấp hơn `minSupported`, HUD hiện nút "Có bản cập nhật mới · tải lại".
- **Feature flag:** `"flags": { "siege": false, "raid": true }` bật/tắt từng cổng mà không cần build lại. Mặc định là bật.
- **Remote config:** đọc bằng `rc("mythicRaid.timeMin", 12)`. Thiếu giá trị hoặc sai kiểu thì dùng số đóng gói sẵn.

## 6. Thứ tự làm phía backend

1. `GET/PUT /v1/me/save` và `/v1/auth/verify`. Website phát JWT ngắn hạn.
2. Deploy game lên `play.` cùng `manifest.json` và CDN có version.
3. Nút "Chơi ngay" trên website (cách A).
4. Chạy `server/` ở staging, sau đó chuyển sang Colyseus/Nakama.
5. Chợ, ví và NFT trên website, kết nối với game qua `OPEN_MARKET` / `REQUEST_SIGN`.

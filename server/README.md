# Server realtime tham chiếu (Hub CYBERHOOD)

Server WebSocket nhỏ để chạy nhiều người chơi thật ở **dev / staging**. Production thay bằng Colyseus hoặc Nakama
(`cyberhood-gameserver/`), giữ nguyên giao thức bên dưới thì game không phải build lại.

```bash
npm install
PORT=8787 ALLOWED_ORIGINS=https://play.cyberhood.space VERIFY_URL=https://api.cyberhood.space/v1/auth/verify npm start
npm test
```

Game kết nối khi build với `VITE_WS_URL=wss://rt.cyberhood.space` (xem `game/.env.example`).

## Giao thức (JSON)

| Hướng | Tin nhắn | Ghi chú |
|---|---|---|
| client → server | `{t:"hello", token, room}` | `token` = JWT ngắn hạn từ Platform API; `room` mặc định `hub` |
| client → server | `{t:"state", s}` | ~10 lần/giây; đứng yên thì 3 giây một lần |
| server → client | `{t:"peers", peers:[{id, s}]}` | 10 lần/giây, không gồm chính người nhận |

`s` (NetState): `{v:1, n:tên, h:lớp nhân vật, g:màu, l:khu vực, p:[x,y,z], r:hướng, a:dáng 0–3, m:foot|car|mech}`.
Server kiểm tra kiểu và kích thước (`validState`); client cũng làm sạch mọi gói nhận được (`sanitize` trong `net.ts`).

## Biến môi trường

| Biến | Mặc định | |
|---|---|---|
| `PORT` | 8787 | |
| `VERIFY_URL` | (trống) | Platform API trả 200 + `{id}` khi JWT hợp lệ. Trống = nhận khách, **chỉ dùng ở dev** |
| `ALLOWED_ORIGINS` | (trống) | Danh sách origin được kết nối, phân cách bằng dấu phẩy |
| `MAX_PER_ROOM` | 100 | |

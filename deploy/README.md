# Deploy CYBERHOOD lên server Ubuntu

| File | Vai trò |
|---|---|
| `deploy.sh` | Build game (bản tách file cho server), upload game + website + server chơi chung, đổi bản đang chạy bằng symlink `current` |
| `nginx.conf` | Website `cyberhood.xyz`, game `play.cyberhood.xyz`, nén gzip, cache dài cho file có mã băm, WebSocket `/rt` |
| `cyberhood-rt.service` | Chạy `server/server.mjs` bằng systemd trên cổng 8787 |

## Lần đầu
```bash
./deploy/deploy.sh user@IP_SERVER --setup        # cài nginx, certbot, node, cấu hình
# trỏ DNS cyberhood.xyz, www, play về IP server rồi trên server:
sudo certbot --nginx -d cyberhood.xyz -d www.cyberhood.xyz -d play.cyberhood.xyz
```

## Mỗi lần cập nhật
```bash
./deploy/deploy.sh user@IP_SERVER
```
Bản cũ được giữ 3 bản gần nhất trong `/var/www/cyberhood/play/`. Rollback: trỏ lại symlink `current`.

## Website
Sửa `web/assets/js/config.js` để đặt `gameUrl` (ví dụ `https://play.cyberhood.xyz`), `siteUrl`, `xHandle`.

## Ghi chú
- `npm run build` = bản cho server (file `.glb` thường, thư viện tách riêng để cache).
- `npm run build:artifact` = bản chạy trong artifact claude.ai (một file JS, model `.glb.wasm`).
- Nên bật thêm Cloudflare (miễn phí) trước server để cache model gần người chơi; nhớ bật WebSockets.

## Viết bài X bằng AI theo chủ đề (post-ai)

Ở bước "Post the signal" của Early Access, người chơi chọn chủ đề (Season 0, Neon City, Siege, Raid, Kart, Duel, Genesis, Uniswap v4 hook…) và website gọi `POST /api/post`. Nginx chuyển tới dịch vụ `cyberhood-postai` (cổng 8790) — dịch vụ này giữ key OpenAI, nên key **không bao giờ** nằm trong website.

1. Tạo file `deploy/secrets.env` trên máy bạn (file này bị git bỏ qua, không đưa lên GitHub):
   ```
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```
2. Lần đầu: `./deploy/deploy.sh user@IP --setup` (cài thêm service post-ai và thư mục `/etc/cyberhood`).
3. Mỗi lần deploy: `./deploy/deploy.sh user@IP` — script tự đọc `secrets.env`, ghi key vào `/etc/cyberhood/post-ai.env` (chmod 600, chỉ root đọc), rồi bật và khởi động lại `cyberhood-postai`.
4. Kiểm tra trên server: `curl -s http://127.0.0.1:8790/api/post/health` → `{"ok":true,"key":true}`.

Bảo vệ sẵn có: chỉ nhận yêu cầu từ tên miền website (`ALLOWED_ORIGINS`), 6 lần/phút và 40 lần/ngày mỗi IP, chủ đề cố định (không cho gửi prompt tuỳ ý), bài tối đa 280 ký tự, không hứa lợi nhuận. Không có key hoặc OpenAI lỗi → website tự dùng văn mẫu của chủ đề đó.
Đổi key: sửa `deploy/secrets.env` rồi deploy lại. Đổi model: `OPENAI_MODEL` trong cùng file.

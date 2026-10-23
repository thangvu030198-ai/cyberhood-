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

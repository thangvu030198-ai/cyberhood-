#!/usr/bin/env bash
# CYBERHOOD — cài toàn bộ lên một droplet Ubuntu (DigitalOcean) bằng một lệnh, chạy NGAY TRÊN SERVER.
#
#   sudo bash install.sh                                   # chưa có tên miền: web http://IP  ·  game http://IP:8080
#   sudo bash install.sh --domain cyberhood.xyz            # có tên miền (đã trỏ DNS): web + www + play.<domain>
#   sudo bash install.sh --domain cyberhood.xyz --email you@mail.com   # thêm HTTPS miễn phí (Let's Encrypt)
#   Thêm --x TenX --discord https://discord.gg/xxxx để hiện link X và Discord trên website
#
# Chạy lại bao nhiêu lần cũng được (cập nhật bản mới: giải nén gói mới rồi chạy lại).
# Gói gồm: web/ (website) · play/ (game đã build) · server/ (realtime) · post-ai/ (viết bài X) · secrets.env (key OpenAI)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="" EMAIL="" XH="Cyberhoodlabs" DISCORD=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --x) XH="${2#@}"; shift 2 ;;
    --discord) DISCORD="${2:-}"; shift 2 ;;
    *) echo "Tham số lạ: $1"; exit 1 ;;
  esac
done
[[ $EUID -eq 0 ]] || { echo "Hãy chạy bằng: sudo bash install.sh"; exit 1; }
for d in web play server post-ai signups; do [[ -d "$DIR/$d" ]] || { echo "Thiếu thư mục $d trong gói"; exit 1; }; done
export DEBIAN_FRONTEND=noninteractive

echo "== 1/7 Cài nginx, Node.js 20"
apt-get update -y
apt-get install -y nginx curl ca-certificates
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
IP="$(curl -fsS4 --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')"

echo "== 2/7 Chép website và game"
mkdir -p /var/www/cyberhood
rm -rf /var/www/cyberhood/web.new /var/www/cyberhood/play.new
cp -a "$DIR/web" /var/www/cyberhood/web.new
cp -a "$DIR/play" /var/www/cyberhood/play.new
rm -rf /var/www/cyberhood/play.new/_bake
rm -rf /var/www/cyberhood/web.old /var/www/cyberhood/play.old
[[ -d /var/www/cyberhood/web ]] && mv /var/www/cyberhood/web /var/www/cyberhood/web.old
[[ -d /var/www/cyberhood/play ]] && mv /var/www/cyberhood/play /var/www/cyberhood/play.old
mv /var/www/cyberhood/web.new /var/www/cyberhood/web
mv /var/www/cyberhood/play.new /var/www/cyberhood/play
chown -R www-data:www-data /var/www/cyberhood

echo "== 3/7 Cấu hình nginx"
if [[ -n "$DOMAIN" ]]; then
  WEB_LISTEN="listen 80;"; WEB_NAME="server_name $DOMAIN www.$DOMAIN;"
  GAME_LISTEN="listen 80;"; GAME_NAME="server_name play.$DOMAIN;"
else
  WEB_LISTEN="listen 80 default_server;"; WEB_NAME="server_name _;"
  GAME_LISTEN="listen 8080;"; GAME_NAME="server_name _;"
fi
cat > /etc/nginx/sites-available/cyberhood <<NGINX
# gzip on; đã có sẵn trong /etc/nginx/nginx.conf của Ubuntu — khai báo lại sẽ lỗi "duplicate"
gzip_vary on;
gzip_comp_level 6;
gzip_min_length 1024;
gzip_types text/css application/javascript application/json image/svg+xml model/gltf-binary application/wasm application/octet-stream;
map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }

# ---------- Website ----------
server {
  $WEB_LISTEN
  $WEB_NAME
  root /var/www/cyberhood/web;
  include /etc/nginx/mime.types;
  location = /index.html { add_header Cache-Control "no-cache"; }
  location = /assets/js/config.js { add_header Cache-Control "no-cache"; }
  location /assets/ { add_header Cache-Control "public, max-age=604800"; }
  location / { try_files \$uri \$uri/ /index.html; }
  # Viết bài X theo chủ đề (key OpenAI chỉ nằm trên server)
  location /api/post {
    proxy_pass http://127.0.0.1:8790;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_read_timeout 20s;
    client_max_body_size 4k;
  }
  # Đăng ký Early Access + trang quản trị có mật khẩu
  location /api/signup {
    proxy_pass http://127.0.0.1:8791;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    client_max_body_size 16k;
  }
  location /admin {
    proxy_pass http://127.0.0.1:8791;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
  }
}

# ---------- Game ----------
server {
  $GAME_LISTEN
  $GAME_NAME
  root /var/www/cyberhood/play;
  include /etc/nginx/mime.types;
  types { model/gltf-binary glb; }
  location = /index.html { add_header Cache-Control "no-cache"; }
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location /models/ { add_header Cache-Control "public, max-age=2592000"; }
  location /mattes/ { add_header Cache-Control "public, max-age=2592000"; }
  location / { try_files \$uri \$uri/ /index.html; }
  location /rt {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header Host \$host;
    proxy_read_timeout 3600s;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/cyberhood /etc/nginx/sites-enabled/cyberhood
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx || systemctl restart nginx

SCHEME=http
if [[ -n "$DOMAIN" && -n "$EMAIL" ]]; then
  echo "== HTTPS (Let's Encrypt) cho $DOMAIN, www.$DOMAIN, play.$DOMAIN"
  apt-get install -y certbot python3-certbot-nginx
  if certbot --nginx -n --agree-tos -m "$EMAIL" --redirect -d "$DOMAIN" -d "www.$DOMAIN" -d "play.$DOMAIN"; then SCHEME=https
  else echo "  ! certbot chưa cấp được chứng chỉ (DNS chưa trỏ về $IP?). Tạm chạy http, chạy lại lệnh sau khi DNS xong."; fi
fi

if [[ -n "$DOMAIN" ]]; then
  SITE="$SCHEME://$DOMAIN"; SITES="$SITE,$SCHEME://www.$DOMAIN"; GAME="$SCHEME://play.$DOMAIN"
else
  SITE="http://$IP"; SITES="$SITE"; GAME="http://$IP:8080"
fi
WS="${GAME/http/ws}/rt"

echo "== 4/7 Gắn địa chỉ thật vào game và website"
# Game được build với chỗ trống __CH_WS_URL__ / __CH_ALLOWED__ để một gói chạy được trên mọi IP / tên miền
grep -rl "__CH_WS_URL__\|__CH_ALLOWED__" /var/www/cyberhood/play/assets | while read -r f; do
  sed -i "s#__CH_WS_URL__#$WS#g; s#__CH_ALLOWED__#$SITES#g" "$f"
done
cat > /var/www/cyberhood/web/assets/js/config.js <<CFG
// Sinh tự động bởi install.sh — chạy lại install.sh để đổi.
window.CH_CONFIG = {
  gameUrl: '$GAME',
  siteUrl: '$SITE',
  aiEndpoint: '/api/post',
  signupEndpoint: '/api/signup',
  xHandle: '${XH//[^A-Za-z0-9_]/}',
  discordUrl: '${DISCORD//\'/}',
};
CFG
chown www-data:www-data /var/www/cyberhood/web/assets/js/config.js

echo "== 5/7 Server chơi chung (realtime, cổng 8787)"
mkdir -p /opt/cyberhood-server
cp -a "$DIR/server/." /opt/cyberhood-server/
( cd /opt/cyberhood-server && npm ci --omit=dev --no-audit --no-fund )
chown -R www-data:www-data /opt/cyberhood-server
cat > /etc/systemd/system/cyberhood-rt.service <<UNIT
[Unit]
Description=CYBERHOOD realtime hub server
After=network.target
[Service]
WorkingDirectory=/opt/cyberhood-server
ExecStart=$(command -v node) server.mjs
Environment=PORT=8787
Environment=ALLOWED_ORIGINS=$GAME
Restart=always
RestartSec=2
User=www-data
[Install]
WantedBy=multi-user.target
UNIT

echo "== 6/7 Máy viết bài X (post-ai, cổng 8790)"
mkdir -p /opt/cyberhood-postai /etc/cyberhood
cp "$DIR/post-ai/server.mjs" /opt/cyberhood-postai/server.mjs
chown -R www-data:www-data /opt/cyberhood-postai
chmod 700 /etc/cyberhood
if [[ -f "$DIR/secrets.env" ]]; then
  grep -E '^(OPENAI_API_KEY|OPENAI_MODEL)=' "$DIR/secrets.env" > /etc/cyberhood/post-ai.env || true
fi
touch /etc/cyberhood/post-ai.env
chmod 600 /etc/cyberhood/post-ai.env
cat > /etc/systemd/system/cyberhood-postai.service <<UNIT
[Unit]
Description=CYBERHOOD post writer (OpenAI key stays on the server)
After=network.target
[Service]
WorkingDirectory=/opt/cyberhood-postai
ExecStart=$(command -v node) server.mjs
EnvironmentFile=/etc/cyberhood/post-ai.env
Environment=PORT=8790
Environment=ALLOWED_ORIGINS=$SITES
Restart=always
RestartSec=2
User=www-data
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
UNIT

echo "== 6b/7 Lưu đăng ký Early Access (signups, cổng 8791) + trang /admin"
mkdir -p /opt/cyberhood-signups /var/lib/cyberhood
cp "$DIR/signups/server.mjs" "$DIR/signups/ethsig.mjs" /opt/cyberhood-signups/
chown -R www-data:www-data /opt/cyberhood-signups /var/lib/cyberhood
chmod 700 /var/lib/cyberhood
# Mật khẩu /admin: tạo một lần, giữ nguyên khi chạy lại (đổi: sửa /etc/cyberhood/signups.env rồi restart)
if ! grep -q '^ADMIN_PASSWORD=.' /etc/cyberhood/signups.env 2>/dev/null; then
  printf 'ADMIN_USER=admin\nADMIN_PASSWORD=%s\n' "$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-20)" > /etc/cyberhood/signups.env
fi
chmod 600 /etc/cyberhood/signups.env
cat > /etc/systemd/system/cyberhood-signups.service <<UNIT
[Unit]
Description=CYBERHOOD early-access signups + admin
After=network.target
[Service]
WorkingDirectory=/opt/cyberhood-signups
ExecStart=$(command -v node) server.mjs
EnvironmentFile=/etc/cyberhood/signups.env
Environment=PORT=8791
Environment=DATA_FILE=/var/lib/cyberhood/signups.jsonl
Environment=ALLOWED_ORIGINS=$SITES
Restart=always
RestartSec=2
User=www-data
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
UNIT

echo "== 7/7 Bật dịch vụ (tự chạy lại khi server khởi động)"
systemctl daemon-reload
systemctl enable --now cyberhood-rt cyberhood-postai cyberhood-signups
systemctl restart cyberhood-rt cyberhood-postai cyberhood-signups
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null; [[ -z "$DOMAIN" ]] && ufw allow 8080/tcp >/dev/null
fi
sleep 1
echo
echo "================ XONG ================"
echo " Website : $SITE"
echo " Game    : $GAME"
echo " Litepaper: $SITE/docs.html"
printf ' Realtime: '; systemctl is-active cyberhood-rt
printf ' Post AI : '; curl -fsS http://127.0.0.1:8790/api/post/health || echo "chưa chạy (xem: journalctl -u cyberhood-postai -n 50)"
echo
printf ' Signups : '; curl -fsS http://127.0.0.1:8791/api/signup/health || echo "chưa chạy (xem: journalctl -u cyberhood-signups -n 50)"
echo
echo " Quản trị đăng ký: $SITE/admin   ·   tài khoản: admin   ·   mật khẩu: $(sed -n 's/^ADMIN_PASSWORD=//p' /etc/cyberhood/signups.env)"
[[ "$SITE" == http://* ]] && echo "   (đang chạy http: nên gắn tên miền + --email để có HTTPS trước khi đăng nhập /admin qua mạng công cộng)"
echo
[[ -z "$DOMAIN" ]] && echo " Nhớ mở cổng 80 và 8080 trong Firewall của DigitalOcean (Networking → Firewalls) nếu bạn có dùng."
echo " Nhật ký: journalctl -u cyberhood-rt -f   ·   journalctl -u cyberhood-postai -f"

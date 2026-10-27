#!/usr/bin/env bash
# Build và đẩy CYBERHOOD lên server Ubuntu bằng một lệnh.
#   ./deploy/deploy.sh user@IP_SERVER            # build + upload game, web, realtime server
#   SKIP_BUILD=1 ./deploy/deploy.sh user@IP       # chỉ upload bản đã build
# Lần đầu trên server chạy: ./deploy/deploy.sh user@IP --setup
set -euo pipefail
HOST="${1:?Cách dùng: deploy.sh user@IP_SERVER [--setup]}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN_PLAY="${DOMAIN_PLAY:-play.cyberhood.space}"
VERSION="$(date +%Y%m%d-%H%M%S)"
# Bí mật cục bộ (không nằm trong git): deploy/secrets.env, ví dụ OPENAI_API_KEY=sk-...
if [[ -f "$ROOT/deploy/secrets.env" ]]; then set -a; . "$ROOT/deploy/secrets.env"; set +a; fi

if [[ "${2:-}" == "--setup" ]]; then
  echo "== Cài nginx, certbot, node trên $HOST"
  ssh "$HOST" 'sudo apt-get update -y && sudo apt-get install -y nginx certbot python3-certbot-nginx curl &&
    (command -v node >/dev/null || (curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs)) &&
    sudo mkdir -p /var/www/cyberhood/web /var/www/cyberhood/play /opt/cyberhood-server && sudo chown -R $USER /var/www/cyberhood /opt/cyberhood-server'
  scp "$ROOT/deploy/nginx.conf" "$HOST:/tmp/cyberhood.nginx"
  scp "$ROOT/deploy/cyberhood-rt.service" "$HOST:/tmp/cyberhood-rt.service"
  scp "$ROOT/deploy/cyberhood-postai.service" "$HOST:/tmp/cyberhood-postai.service"
  ssh "$HOST" 'sudo mv /tmp/cyberhood.nginx /etc/nginx/sites-available/cyberhood && sudo ln -sf /etc/nginx/sites-available/cyberhood /etc/nginx/sites-enabled/cyberhood &&
    sudo mv /tmp/cyberhood-rt.service /tmp/cyberhood-postai.service /etc/systemd/system/ &&
    sudo mkdir -p /opt/cyberhood-postai /etc/cyberhood && sudo chown $USER /opt/cyberhood-postai && sudo chmod 700 /etc/cyberhood &&
    sudo systemctl daemon-reload && sudo nginx -t && sudo systemctl reload nginx'
  echo "Xong. Trỏ DNS rồi chạy trên server: sudo certbot --nginx -d cyberhood.space -d www.cyberhood.space -d $DOMAIN_PLAY"
  exit 0
fi

if [[ -z "${SKIP_BUILD:-}" ]]; then
  echo "== Build game (bản tách file cho server, WebSocket qua /rt)"
  ( cd "$ROOT/game" && npm ci && VITE_WS_URL="wss://$DOMAIN_PLAY/rt" VITE_GAME_VERSION="$VERSION" npm run build )
fi

echo "== Upload game -> /var/www/cyberhood/play/$VERSION"
ssh "$HOST" "mkdir -p /var/www/cyberhood/play/$VERSION"
tar -C "$ROOT/game/dist" -czf - . | ssh "$HOST" "tar -C /var/www/cyberhood/play/$VERSION -xzf -"
# Đổi bản đang chạy: chỉ đổi symlink 'current' (nhanh, rollback được bằng cách trỏ lại bản cũ)
ssh "$HOST" "ln -sfn /var/www/cyberhood/play/$VERSION /var/www/cyberhood/play/current && ls -1dt /var/www/cyberhood/play/2* | tail -n +4 | xargs -r rm -rf"

echo "== Upload website"
tar -C "$ROOT/web" -czf - . | ssh "$HOST" "tar -C /var/www/cyberhood/web -xzf -"

echo "== Upload + khởi động lại realtime server"
tar -C "$ROOT/server" --exclude node_modules -czf - . | ssh "$HOST" "tar -C /opt/cyberhood-server -xzf - && cd /opt/cyberhood-server && npm ci --omit=dev && sudo systemctl enable --now cyberhood-rt && sudo systemctl restart cyberhood-rt"

echo "== Upload + khởi động lại máy viết bài X (post-ai)"
scp "$ROOT/deploy/post-ai/server.mjs" "$HOST:/opt/cyberhood-postai/server.mjs"
# Key OpenAI: chỉ khi biến OPENAI_API_KEY có trong shell máy bạn. Gửi qua ssh stdin, không ghi vào repo hay lịch sử lệnh của server.
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  printf 'OPENAI_API_KEY=%s\n' "$OPENAI_API_KEY" | ssh "$HOST" 'sudo install -m 600 -o root -g root /dev/stdin /etc/cyberhood/post-ai.env'
fi
ssh "$HOST" 'sudo test -f /etc/cyberhood/post-ai.env || echo "  (chưa có key: chạy lại với OPENAI_API_KEY=... để bật viết bài bằng AI; website tự dùng văn mẫu)"; sudo test -f /etc/cyberhood/post-ai.env && sudo systemctl enable --now cyberhood-postai && sudo systemctl restart cyberhood-postai || true'

echo "Đã deploy bản $VERSION. Rollback: ssh $HOST 'ln -sfn /var/www/cyberhood/play/<bản-cũ> /var/www/cyberhood/play/current'"

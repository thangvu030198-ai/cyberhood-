#!/usr/bin/env bash
# Build và đẩy CYBERHOOD lên server Ubuntu bằng một lệnh.
#   ./deploy/deploy.sh user@IP_SERVER            # build + upload game, web, realtime server
#   SKIP_BUILD=1 ./deploy/deploy.sh user@IP       # chỉ upload bản đã build
# Lần đầu trên server chạy: ./deploy/deploy.sh user@IP --setup
set -euo pipefail
HOST="${1:?Cách dùng: deploy.sh user@IP_SERVER [--setup]}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN_PLAY="${DOMAIN_PLAY:-play.cyberhood.xyz}"
VERSION="$(date +%Y%m%d-%H%M%S)"

if [[ "${2:-}" == "--setup" ]]; then
  echo "== Cài nginx, certbot, node trên $HOST"
  ssh "$HOST" 'sudo apt-get update -y && sudo apt-get install -y nginx certbot python3-certbot-nginx curl &&
    (command -v node >/dev/null || (curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs)) &&
    sudo mkdir -p /var/www/cyberhood/web /var/www/cyberhood/play /opt/cyberhood-server && sudo chown -R $USER /var/www/cyberhood /opt/cyberhood-server'
  scp "$ROOT/deploy/nginx.conf" "$HOST:/tmp/cyberhood.nginx"
  scp "$ROOT/deploy/cyberhood-rt.service" "$HOST:/tmp/cyberhood-rt.service"
  ssh "$HOST" 'sudo mv /tmp/cyberhood.nginx /etc/nginx/sites-available/cyberhood && sudo ln -sf /etc/nginx/sites-available/cyberhood /etc/nginx/sites-enabled/cyberhood &&
    sudo mv /tmp/cyberhood-rt.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo nginx -t && sudo systemctl reload nginx'
  echo "Xong. Trỏ DNS rồi chạy trên server: sudo certbot --nginx -d cyberhood.xyz -d www.cyberhood.xyz -d $DOMAIN_PLAY"
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

echo "Đã deploy bản $VERSION. Rollback: ssh $HOST 'ln -sfn /var/www/cyberhood/play/<bản-cũ> /var/www/cyberhood/play/current'"

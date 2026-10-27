#!/usr/bin/env bash
# Đóng gói CYBERHOOD để tải lên droplet: build game + chép website, server realtime, post-ai, install.sh → một file zip.
#   bash deploy/droplet/make-bundle.sh [thư-mục-ra]
# deploy/secrets.env (nếu có, không nằm trong git) được đưa vào gói để post-ai có key OpenAI.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/final}"
NAME="cyberhood-droplet"
STAGE="$(mktemp -d)/$NAME"
mkdir -p "$STAGE" "$OUT"

echo "== Build game (chỗ trống địa chỉ, install.sh điền khi cài)"
( cd "$ROOT/game" && rm -rf dist && VITE_WS_URL="__CH_WS_URL__" VITE_ALLOWED_ORIGINS="__CH_ALLOWED__" VITE_GAME_VERSION="$(date +%Y%m%d)" npm run build >/dev/null )
cp -a "$ROOT/game/dist" "$STAGE/play"
rm -rf "$STAGE/play/_bake"

echo "== Website, server realtime, post-ai"
cp -a "$ROOT/web" "$STAGE/web"
mkdir -p "$STAGE/server" "$STAGE/post-ai"
cp "$ROOT/server/server.mjs" "$ROOT/server/package.json" "$ROOT/server/package-lock.json" "$STAGE/server/"
cp "$ROOT/deploy/post-ai/server.mjs" "$STAGE/post-ai/"
mkdir -p "$STAGE/signups" && cp "$ROOT/deploy/signups/server.mjs" "$ROOT/deploy/signups/ethsig.mjs" "$STAGE/signups/"
cp "$ROOT/deploy/droplet/install.sh" "$ROOT/deploy/droplet/HUONG_DAN.txt" "$STAGE/"
if [[ -f "$ROOT/deploy/secrets.env" ]]; then cp "$ROOT/deploy/secrets.env" "$STAGE/secrets.env"; chmod 600 "$STAGE/secrets.env"; else echo "  (không có deploy/secrets.env: post-ai sẽ dùng văn mẫu)"; fi

echo "== Nén"
rm -f "$OUT/$NAME.zip"
( cd "$(dirname "$STAGE")" && zip -qr -9 "$OUT/$NAME.zip" "$NAME" )
ls -la "$OUT/$NAME.zip"

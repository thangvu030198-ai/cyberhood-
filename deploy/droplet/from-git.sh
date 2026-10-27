#!/usr/bin/env bash
# Cài CYBERHOOD thẳng từ mã nguồn GitHub, chạy NGAY TRÊN DROPLET — không cần tải file zip về máy Windows.
#
#   apt-get update && apt-get install -y git
#   git clone --depth 1 https://github.com/thangvu030198-ai/cyberhood-.git
#   cd cyberhood- && sudo bash deploy/droplet/from-git.sh            # thêm --domain / --email / --x / --discord nếu cần
#
# Cập nhật bản mới:  cd cyberhood- && git pull && sudo bash deploy/droplet/from-git.sh  (cùng tham số như lần trước)
# Script build game trên server rồi gọi install.sh với đúng các tham số bạn truyền vào.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[[ $EUID -eq 0 ]] || { echo "Hãy chạy bằng: sudo bash deploy/droplet/from-git.sh"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "== Chuẩn bị: Node.js 20, zip"
apt-get update -y
apt-get install -y curl ca-certificates zip unzip
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Build game cần ~2 GB RAM: droplet nhỏ thì thêm swap 2 GB (chỉ tạo một lần)
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if (( MEM_MB < 3500 )) && ! swapon --show | grep -q /swapfile; then
  echo "== RAM ${MEM_MB} MB: thêm swap 2 GB cho bước build"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Cài thư viện build game (lần đầu mất vài phút)"
( cd "$ROOT/game" && npm ci --no-audit --no-fund )

echo "== Build và đóng gói"
OUT="$(mktemp -d)"
NOSECRETS="${NOSECRETS:-}" bash "$ROOT/deploy/droplet/make-bundle.sh" "$OUT"
# deploy/secrets.env (nếu bạn tự tạo trên server) vẫn được dùng; không có thì install.sh hỏi key OpenAI
rm -rf "$OUT/x" && mkdir "$OUT/x" && unzip -q "$OUT/cyberhood-droplet.zip" -d "$OUT/x"

echo "== Cài đặt"
bash "$OUT/x/cyberhood-droplet/install.sh" "$@"
rm -rf "$OUT"

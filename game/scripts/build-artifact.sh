#!/bin/sh
# Build bản chạy trong artifact claude.ai: một file JS, model đổi đuôi .glb.wasm, trang dist/cyberhood.html
set -e
cd "$(dirname "$0")/.."
rm -rf dist && VITE_ARTIFACT=1 npx vite build 2>&1 | tail -2
for f in dist/models/*.glb; do mv "$f" "$f.wasm"; done
JS=$(ls dist/assets/*.js | xargs -n1 basename)
CSS=$(ls dist/assets/*.css)
{
  cat <<EOT
<title>Cyberhood</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+JP:wght@500;700&family=Noto+Sans+KR:wght@500;700&family=Noto+Sans+SC:wght@500;700&display=swap">
<style>
EOT
  cat $CSS
  cat <<EOT

</style>
<div id="root"></div>
<script type="module" src="assets/$JS"></script>
EOT
} > dist/cyberhood.html
echo "$JS"

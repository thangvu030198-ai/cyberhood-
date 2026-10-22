import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { mountI18n } from './i18n/mount'
import { bootPlatform } from './platform/boot'

mountI18n()

// Nền tảng (token, remote config, bản lưu trên server) khởi động trước, rồi mới nạp game:
// các store của game đọc localStorage lúc import, nên bản lưu kéo về phải có mặt trước đó.
bootPlatform().then(async () => {
  const [{ default: App }, { linkGame }] = await Promise.all([import('./App.tsx'), import('./platform/gameLink')])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  linkGame()
})

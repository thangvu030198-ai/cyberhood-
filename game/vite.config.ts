import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // Asset nhúng thẳng vào bundle để chạy được cả khi không fetch được file ngoài.
  assetsInclude: ["**/*.glb"],
  // Một file JS duy nhất (main.tsx nạp game bằng import() sau khi khởi động nền tảng): bản build là một thư mục bất biến trên CDN
  build: { target: "es2022", assetsInlineLimit: 0, chunkSizeWarningLimit: 6000, rollupOptions: { output: { inlineDynamicImports: true } } },
});

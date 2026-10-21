import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // Asset nhúng thẳng vào bundle để chạy được cả khi không fetch được file ngoài.
  assetsInclude: ["**/*.glb"],
  build: { target: "es2022", assetsInlineLimit: 0, chunkSizeWarningLimit: 6000 },
});

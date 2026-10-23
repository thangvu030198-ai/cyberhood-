import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Hai kiểu build:
 * - Server riêng / CDN (mặc định): tách thư viện nặng (three, r3f, rapier, postprocessing) thành file riêng.
 *   Thư viện ít đổi nên trình duyệt giữ cache qua nhiều lần cập nhật game; chỉ tải lại phần code game.
 * - Artifact claude.ai (VITE_ARTIFACT=1): một file JS duy nhất, model đổi đuôi .glb.wasm (scripts/build-artifact.sh).
 */
const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const artifact = env.VITE_ARTIFACT === "1";

export default defineConfig({
  base: "./",
  plugins: [react()],
  assetsInclude: ["**/*.glb"],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      output: artifact
        ? { inlineDynamicImports: true }
        : {
            manualChunks(id) {
              if (!id.includes("node_modules")) return undefined;
              if (id.includes("@dimforge") || id.includes("rapier")) return "vendor-physics";
              if (id.includes("postprocessing")) return "vendor-fx";
              if (id.includes("/three/")) return "vendor-three";
              if (id.includes("@react-three") || id.includes("three-stdlib") || id.includes("camera-controls") || id.includes("ecctrl")) return "vendor-r3f";
              if (id.includes("react")) return "vendor-react";
              return "vendor";
            },
          },
    },
  },
});

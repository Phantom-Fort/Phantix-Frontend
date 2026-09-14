import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// SecureGraph application shell. Browser config is same-origin; the dev server
// proxies /api upstream. Shared code lives in ../../packages/sg-shared.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget =
    env.API_PROXY_TARGET || process.env.API_PROXY_TARGET || "https://staging.phantix.site";
  const port = Number(env.DEV_PORT || process.env.DEV_PORT || 5175);
  return {
    plugins: [react()],
    publicDir: path.resolve(__dirname, "../../public"),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@app": path.resolve(__dirname, "./src"),
        "@sg": path.resolve(__dirname, "../../packages/sg-shared/src"),
        // Shared modules read the product docs as raw markdown; the alias is
        // the repo root, exactly as the Command Centre defines it.
        "@docs": path.resolve(__dirname, "../.."),
      },
    },
    server: {
      port,
      host: true,
      proxy: { "/api": { target: apiTarget, changeOrigin: true, secure: true, ws: true } },
    },
    build: { chunkSizeWarningLimit: 1200 },
  };
});

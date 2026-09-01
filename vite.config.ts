import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Command Centre dev server.
 * Proxy target is server-only (process.env Ã¢â‚¬â€ NOT VITE_*, never in browser bundle).
 *
 *   API_PROXY_TARGET   default https://staging.phantix.site
 *   DEV_PORT           default 5173
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.API_PROXY_TARGET || process.env.API_PROXY_TARGET || "https://staging.phantix.site";
  const port = Number(env.DEV_PORT || process.env.DEV_PORT || 5173);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@docs": path.resolve(__dirname, "."),
      },
    },
    server: {
      port,
      host: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          ws: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            charts: ["recharts"],
            motion: ["framer-motion"],
          },
        },
      },
    },
  };
});

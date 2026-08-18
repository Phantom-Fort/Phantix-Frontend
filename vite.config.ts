import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/** Upstream backend — only used by the dev proxy, never by browser bundles. */
const UPSTREAM = "https://staging.phantix.site";
const SANDBOX_APPLY = "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@docs": path.resolve(__dirname, "."),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: UPSTREAM,
        changeOrigin: true,
        secure: true,
        ws: true,
      },
      "/sandbox-apply": {
        target: SANDBOX_APPLY,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sandbox-apply/, ""),
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
});

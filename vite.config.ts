import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

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
        target: "https://staging.phantix.site",
        changeOrigin: true,
        secure: true,
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

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The blog is a client-only React app. It talks to the admin backend through
// `VITE_BLOG_API_URL` (absolute, or "/api/v1" when a same-origin rewrite is
// used). For local dev you can point a proxy at the backend instead:
//   BLOG_API_PROXY_TARGET=https://staging.phantix.site npm run dev
export default defineConfig(() => {
  const proxyTarget = process.env.BLOG_API_PROXY_TARGET;
  return {
    plugins: [react()],
    server: {
      port: 5178,
      host: true,
      ...(proxyTarget
        ? { proxy: { "/api": { target: proxyTarget, changeOrigin: true, secure: true } } }
        : {}),
    },
    build: { outDir: "dist", emptyOutDir: true },
  };
});

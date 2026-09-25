import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// The blog is a client-only React app. It talks to the admin backend through
// `VITE_BLOG_API_URL` (absolute, or "/api/v1" when a same-origin rewrite is
// used). For local dev you can point a proxy at the backend instead:
//   BLOG_API_PROXY_TARGET=https://staging.phantix.site npm run dev
export default defineConfig(() => {
  const proxyTarget = process.env.BLOG_API_PROXY_TARGET;
  return {
    plugins: [react()],
    // Shared brand assets (favicons, webmanifest, logos) live at the repo root,
    // exactly as the four operator apps point at them. Without this the
    // /favicon.ico, /favicon.svg, /apple-touch-icon.png and /site.webmanifest
    // links in index.html 404 on the built site.
    publicDir: path.resolve(__dirname, "../../public"),
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

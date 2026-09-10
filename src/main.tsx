import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App";
import { bootstrapTheme } from "./lib/theme";
import { initAnalytics } from "./lib/analytics";
import { loadBrandTokens } from "./lib/branding";
// Geist + Geist Mono (Xalgorix-style typography) — variable woff2, loaded first
// so the app never flashes a fallback face.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./index.css";

bootstrapTheme();
initAnalytics();
loadBrandTokens();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* reducedMotion="user" drops transform/layout animation for anyone who
        asked the OS for calmer motion; quick opacity fades still carry the
        reveal so content never snaps in (Learn UI — Performance & reduced
        motion). */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>,
);

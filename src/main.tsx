import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { bootstrapTheme } from "./lib/theme";
// Geist + Geist Mono (Xalgorix-style typography) — variable woff2, loaded first
// so the app never flashes a fallback face.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./index.css";

bootstrapTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

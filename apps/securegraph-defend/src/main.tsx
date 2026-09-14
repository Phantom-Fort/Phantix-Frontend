import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { setActiveApplication } from "@/lib/api";
import { setApplication } from "@sg/shell/api";
import App from "./App";
import "./index.css";

// Declare which application this bundle is before anything can call the API:
// every request carries X-Application, and the backend refuses a route this
// application does not own.
setActiveApplication("defend");
setApplication("defend");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

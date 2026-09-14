import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import { StoreProvider, ToastViewport } from "@/lib/store";
import DualControlOverlay from "@/components/DualControlOverlay";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import Overview from "./pages/Overview";
import Code from "./pages/Code";

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        <Route
          element={
            <ApplicationShell
              application={"code" as ApplicationKey}
              subtitle="Code"
              nav={NAV}
              hosts={HOSTS}
            />
          }
        >
          <Route path="/" element={<Overview application={"code" as ApplicationKey} />} />
          <Route path="/code-review" element={<Code />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

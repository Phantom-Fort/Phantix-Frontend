import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import { StoreProvider, ToastViewport } from "@/lib/store";
import DualControlOverlay from "@/components/DualControlOverlay";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import Overview from "./pages/Overview";
import Targets from "./pages/Targets";
import Scans from "./pages/Scans";
import PentestScope from "./pages/PentestScope";
import Vapt from "./pages/Vapt";
import VaptSchedules from "./pages/VaptSchedules";
import VaptProcedures from "./pages/VaptProcedures";
import VaptSettings from "./pages/VaptSettings";

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        <Route
          element={
            <ApplicationShell
              application={"attack" as ApplicationKey}
              subtitle="Attack"
              nav={NAV}
              hosts={HOSTS}
            />
          }
        >
          <Route path="/" element={<Overview application={"attack" as ApplicationKey} nav={NAV} />} />
          <Route path="/targets" element={<Targets />} />
          <Route path="/pentest-scope" element={<PentestScope />} />
          <Route path="/vapt" element={<Vapt />} />
          <Route path="/vapt/schedules" element={<VaptSchedules />} />
          <Route path="/vapt/procedures" element={<VaptProcedures />} />
          <Route path="/vapt/settings" element={<VaptSettings />} />
          <Route path="/scans" element={<Scans />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

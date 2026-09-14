import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import { StoreProvider, ToastViewport } from "@/lib/store";
import DualControlOverlay from "@/components/DualControlOverlay";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import Overview from "./pages/Overview";
import Assets from "./pages/Assets";
import AssetIntelligence from "./pages/AssetIntelligence";
import Risks from "./pages/Risks";
import ThreatIntel from "./pages/ThreatIntel";
import Cloud from "./pages/Cloud";
import Posture from "./pages/Posture";
import Alerts from "./pages/Alerts";

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        <Route
          element={
            <ApplicationShell
              application={"defend" as ApplicationKey}
              subtitle="Defend"
              nav={NAV}
              hosts={HOSTS}
            />
          }
        >
          <Route path="/" element={<Overview application={"defend" as ApplicationKey} />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/assets/intelligence" element={<AssetIntelligence />} />
          <Route path="/posture" element={<Posture />} />
          <Route path="/cloud" element={<Cloud />} />
          <Route path="/risks" element={<Risks />} />
          <Route path="/threat-intel" element={<ThreatIntel />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

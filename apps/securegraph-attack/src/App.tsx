import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import Agent from "@sg/pages/Agent";
import type { ApplicationKey } from "@sg/shell/types";
import Docs from "@sg/pages/Docs";
import DocPage from "@sg/pages/DocPage";
import DocsChrome from "@sg/pages/DocsChrome";
import { StoreProvider, ToastViewport } from "@sg/store";
import DualControlOverlay from "@sg/components/DualControlOverlay";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import Overview from "./pages/Overview";
import Targets from "./pages/Targets";
import Scans from "./pages/Scans";
import PentestScope from "./pages/PentestScope";
import AgiDrawer from "@sg/components/AgiDrawer";
import Vapt from "./pages/Vapt";
import VaptSchedules from "./pages/VaptSchedules";
import VaptProcedures from "./pages/VaptProcedures";
import VaptSettings from "./pages/VaptSettings";
import Mobile from "./pages/Mobile";
import SectionGate from "@sg/components/SectionGate";

export default function App() {
  return (
    <StoreProvider>
      <Routes>        <Route
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
          <Route path="/targets" element={<Targets title="Targets" />} />
          <Route path="/pentest-scope" element={<PentestScope />} />
          <Route
            path="/pentest-agent"
            element={
              <SectionGate section="attack.pentest_agent">
                <Agent initialMode="agi" allowAgi />
              </SectionGate>
            }
          />
          <Route
            path="/mobile"
            element={
              <SectionGate section="attack.mobile">
                <Mobile />
              </SectionGate>
            }
          />
          <Route path="/vapt" element={<Vapt />} />
          <Route path="/vapt/schedules" element={<VaptSchedules />} />
          <Route path="/vapt/procedures" element={<VaptProcedures />} />
          <Route path="/vapt/settings" element={<VaptSettings />} />
          <Route path="/scans" element={<Scans />} />
          <Route path="/assistant" element={<Agent allowAgi />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* Documentation renders outside the sidebar with its own top bar. */}
        <Route element={<DocsChrome />}>
          <Route path="/docs" element={<Docs application="attack" />} />
          <Route path="/docs/:docId" element={<DocPage />} />
        </Route>

      </Routes>
      <ToastViewport />
      <DualControlOverlay />
      <AgiDrawer />
    </StoreProvider>
  );
}

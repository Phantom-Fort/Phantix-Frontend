import React, { Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import Docs from "@sg/pages/Docs";
import DocPage from "@sg/pages/DocPage";
import DocsChrome from "@sg/pages/DocsChrome";
import { StoreProvider, ToastViewport } from "@sg/store";
import DualControlOverlay from "@sg/components/DualControlOverlay";
import { BrandLoader } from "@sg/components/BrandLoader";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import AgiDrawer from "@sg/components/AgiDrawer";
import SectionGate from "@sg/components/SectionGate";

const Agent = React.lazy(() => import("@sg/pages/Agent"));
const NotFound = React.lazy(() => import("@sg/pages/NotFound"));
const Overview = React.lazy(() => import("./pages/Overview"));
const Targets = React.lazy(() => import("./pages/Targets"));
const Scans = React.lazy(() => import("./pages/Scans"));
const PentestScope = React.lazy(() => import("./pages/PentestScope"));
const Vapt = React.lazy(() => import("./pages/Vapt"));
const VaptSchedules = React.lazy(() => import("./pages/VaptSchedules"));
const VaptProcedures = React.lazy(() => import("./pages/VaptProcedures"));
const VaptSettings = React.lazy(() => import("./pages/VaptSettings"));
const Mobile = React.lazy(() => import("./pages/Mobile"));

export default function App() {
  return (
    <StoreProvider>
      <Suspense fallback={<BrandLoader label="Attack" message="Loading" />}>
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
          <Route path="*" element={<NotFound homePath="/" />} />
        </Route>
        {/* Documentation renders outside the sidebar with its own top bar. */}
        <Route element={<DocsChrome />}>
          <Route path="/docs" element={<Docs application="attack" />} />
          <Route path="/docs/:docId" element={<DocPage />} />
        </Route>

      </Routes>
      </Suspense>
      <ToastViewport />
      <DualControlOverlay />
      <AgiDrawer />
    </StoreProvider>
  );
}

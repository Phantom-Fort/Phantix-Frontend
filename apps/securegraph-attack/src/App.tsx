import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import Login from "@sg/pages/Login";
import ChooseApp from "@sg/pages/ChooseApp";
import DeviceConfirm from "@sg/pages/DeviceConfirm";
import PasswordResetRequest from "@sg/pages/auth/PasswordResetRequest";
import PasswordResetComplete from "@sg/pages/auth/PasswordResetComplete";
import Docs from "@sg/pages/Docs";
import DocPage from "@sg/pages/DocPage";
import { StoreProvider, ToastViewport } from "@sg/store";
import DualControlOverlay from "@sg/components/DualControlOverlay";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import Overview from "./pages/Overview";
import Targets from "./pages/Targets";
import Scans from "./pages/Scans";
import PentestScope from "./pages/PentestScope";
import Agent from "./pages/Agent";
import AgiDrawer from "@sg/components/AgiDrawer";
import Vapt from "./pages/Vapt";
import VaptSchedules from "./pages/VaptSchedules";
import VaptProcedures from "./pages/VaptProcedures";
import VaptSettings from "./pages/VaptSettings";

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        {/* Sign-in — each application can authenticate on its own origin. */}
        <Route path="/login" element={<Login />} />
        <Route path="/choose-app" element={<ChooseApp />} />
        <Route path="/device-confirm" element={<DeviceConfirm />} />
        <Route path="/password-reset" element={<PasswordResetRequest />} />
        <Route path="/reset-password" element={<PasswordResetComplete />} />
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
          <Route path="/pentest-agent" element={<Agent initialMode="agi" />} />
          <Route path="/vapt" element={<Vapt />} />
          <Route path="/vapt/schedules" element={<VaptSchedules />} />
          <Route path="/vapt/procedures" element={<VaptProcedures />} />
          <Route path="/vapt/settings" element={<VaptSettings />} />
          <Route path="/scans" element={<Scans />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* Documentation renders full-width, without the application sidebar. */}
        <Route path="/docs" element={<Docs application="attack" />} />
        <Route path="/docs/:docId" element={<DocPage />} />

      </Routes>
      <ToastViewport />
      <DualControlOverlay />
      <AgiDrawer />
    </StoreProvider>
  );
}

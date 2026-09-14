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
import Code from "./pages/Code";
import ThreatModels from "./pages/ThreatModels";
import ContextProjects from "./pages/ContextProjects";

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
              application={"code" as ApplicationKey}
              subtitle="Code"
              nav={NAV}
              hosts={HOSTS}
            />
          }
        >
          <Route path="/" element={<Overview application={"code" as ApplicationKey} nav={NAV} />} />
          <Route path="/code-review" element={<Code />} />
          <Route path="/threat-models" element={<ThreatModels />} />
          <Route path="/context" element={<ContextProjects />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* Documentation renders full-width, without the application sidebar. */}
        <Route path="/docs" element={<Docs application="code" />} />
        <Route path="/docs/:docId" element={<DocPage />} />

      </Routes>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

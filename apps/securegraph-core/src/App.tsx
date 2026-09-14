import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import { StoreProvider, ToastViewport } from "@sg/store";
import DualControlOverlay from "@sg/components/DualControlOverlay";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ChooseApp from "./pages/ChooseApp";
import DeviceConfirm from "./pages/DeviceConfirm";
import GithubCallback from "./pages/GithubCallback";
import IntegrationOAuthCallback from "./pages/IntegrationOAuthCallback";
import Cookies from "./pages/Cookies";
import Privacy from "./pages/Privacy";
import SandboxApplyPublic from "./pages/SandboxApplyPublic";
import PasswordResetRequest from "./pages/auth/PasswordResetRequest";
import PasswordResetComplete from "./pages/auth/PasswordResetComplete";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import IntegrationsHub from "./pages/IntegrationsHub";
import Audit from "./pages/Audit";
import Agent from "./pages/Agent";
import AgentActivity from "./pages/AgentActivity";
import AuthorizerInbox from "./pages/AuthorizerInbox";
import PublicChrome from "./components/PublicChrome";
import Docs from "@sg/pages/Docs";
import DocPage from "@sg/pages/DocPage";
import Support from "./pages/Support";
import Sandbox from "./pages/Sandbox";

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        {/* Public / entry */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/choose-app" element={<ChooseApp />} />
        <Route path="/password-reset" element={<PasswordResetRequest />} />
        <Route path="/reset-password" element={<PasswordResetComplete />} />
        <Route path="/device-confirm" element={<DeviceConfirm />} />
        <Route path="/integrations/github/callback" element={<GithubCallback />} />
        <Route
          path="/integrations/oauth/:connectorId/callback"
          element={<IntegrationOAuthCallback />}
        />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/sandbox-apply" element={<SandboxApplyPublic />} />
        {/* Documentation is public: its own chrome, not the operator sidebar. */}
        <Route element={<PublicChrome />}>
          <Route path="/docs" element={<Docs />} />
          <Route path="/docs/:docId" element={<DocPage />} />
        </Route>

        {/* Authenticated Core shell */}
        <Route
          element={
            <ApplicationShell
              application={"core" as ApplicationKey}
              subtitle="Core"
              nav={NAV}
              hosts={HOSTS}
            />
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/integrations" element={<IntegrationsHub />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/agent" element={<Agent allowAgi={false} />} />
          <Route path="/agent-activity" element={<AgentActivity />} />
          <Route path="/authorizations" element={<AuthorizerInbox />} />
          <Route path="/support" element={<Support />} />
          <Route path="/sandbox" element={<Sandbox />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

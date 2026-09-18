import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import { StoreProvider, ToastViewport } from "@sg/store";
import DualControlOverlay from "@sg/components/DualControlOverlay";
import BrandLoader from "@sg/components/BrandLoader";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import Home from "./pages/Home";
import Login from "@sg/pages/Login";
import ChooseApp from "@sg/pages/ChooseApp";
import DeviceConfirm from "@sg/pages/DeviceConfirm";
import GithubCallback from "./pages/GithubCallback";
import IntegrationOAuthCallback from "./pages/IntegrationOAuthCallback";
import Cookies from "./pages/Cookies";
import Privacy from "./pages/Privacy";
import SandboxApplyPublic from "./pages/SandboxApplyPublic";
import PasswordResetRequest from "@sg/pages/auth/PasswordResetRequest";
import PasswordResetComplete from "@sg/pages/auth/PasswordResetComplete";
import PublicChrome from "./components/PublicChrome";
import Docs from "@sg/pages/Docs";
import DocPage from "@sg/pages/DocPage";

const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Assets = React.lazy(() => import("./pages/Assets"));
const Analytics = React.lazy(() => import("./pages/Analytics"));
const Reports = React.lazy(() => import("./pages/Reports"));
const ReportViewer = React.lazy(() => import("./pages/ReportViewer"));
const IntegrationsHub = React.lazy(() => import("./pages/IntegrationsHub"));
const Audit = React.lazy(() => import("./pages/Audit"));
const AgentActivity = React.lazy(() => import("./pages/AgentActivity"));
const AuthorizerInbox = React.lazy(() => import("./pages/AuthorizerInbox"));
const Support = React.lazy(() => import("./pages/Support"));
const Sandbox = React.lazy(() => import("./pages/Sandbox"));
const Agent = React.lazy(() => import("@sg/pages/Agent"));
const NotFound = React.lazy(() => import("@sg/pages/NotFound"));

export default function App() {
  return (
    <StoreProvider>
      <Suspense fallback={<BrandLoader label="Core" message="Loading" />}>
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
            <Route path="/docs" element={<Docs application="core" />} />
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
            <Route path="/assets" element={<Assets title="Assets" />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id/view" element={<ReportViewer />} />
            <Route path="/integrations" element={<IntegrationsHub />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/agent" element={<Navigate to="/assistant" replace />} />
            <Route path="/agent-activity" element={<AgentActivity />} />
            <Route path="/authorizations" element={<AuthorizerInbox />} />
            <Route path="/support" element={<Support />} />
            <Route path="/sandbox" element={<Sandbox />} />
            <Route path="/assistant" element={<Agent />} />
            <Route path="*" element={<NotFound homePath="/dashboard" />} />
          </Route>
        </Routes>
      </Suspense>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

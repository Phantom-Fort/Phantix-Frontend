import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { StoreProvider, ToastViewport, useStore } from "@/lib/store";
import { OperationsProvider } from "@/lib/operations";
import Layout from "@/components/Layout";
import DualControlOverlay from "@/components/DualControlOverlay";
import CookieConsent from "@/components/CookieConsent";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import DeviceConfirm from "@/pages/DeviceConfirm";
import GithubCallback from "@/pages/GithubCallback";
import Dashboard from "@/pages/Dashboard";
import Assets from "@/pages/Assets";
import Scans from "@/pages/Scans";
import Vapt from "@/pages/Vapt";
import Code from "@/pages/Code";
import Posture from "@/pages/Posture";
import Risks from "@/pages/Risks";
import Compliance from "@/pages/Compliance";
import Reports from "@/pages/Reports";
import Alerts from "@/pages/Alerts";
import Audit from "@/pages/Audit";
import People from "@/pages/People";
import Privacy from "@/pages/Privacy";
import Cookies from "@/pages/Cookies";
import Support from "@/pages/Support";
import Docs from "@/pages/Docs";
import DocPage from "@/pages/DocPage";
import AssetIntelligence from "@/pages/AssetIntelligence";
import AssetGraph from "@/pages/AssetGraph";
import SocDashboard from "@/pages/SocDashboard";
import SocWarRoom from "@/pages/SocWarRoom";
import SocPlaybooks from "@/pages/SocPlaybooks";
import SocAdvisor from "@/pages/SocAdvisor";
import SocLogPipeline from "@/pages/SocLogPipeline";
import SocAgentManager from "@/pages/SocAgentManager";
import SocCloudIntegration from "@/pages/SocCloudIntegration";
import IntegrationsHub from "@/pages/IntegrationsHub";
import AuthorizerInbox from "@/pages/AuthorizerInbox";
import Agent from "@/pages/Agent";
import AgentActivity from "@/pages/AgentActivity";
import Sandbox from "@/pages/Sandbox";
import SandboxApplyPublic from "@/pages/SandboxApplyPublic";
import ThreatIntel from "@/pages/ThreatIntel";
import Cloud from "@/pages/Cloud";
import PentestScope from "@/pages/PentestScope";
import ComplianceQuestionnaire from "@/pages/ComplianceQuestionnaire";
import ComplianceGaps from "@/pages/ComplianceGaps";
import ComplianceProfile from "@/pages/ComplianceProfile";
import ComplianceConnectors from "@/pages/ComplianceConnectors";
import Analytics from "@/pages/Analytics";
import Plans from "@/pages/Plans";
import VaptSchedules from "@/pages/VaptSchedules";
import VaptSettings from "@/pages/VaptSettings";
import VaptProcedures from "@/pages/VaptProcedures";
import ContextProjects from "@/pages/ContextProjects";
import ThreatModels from "@/pages/ThreatModels";
import PasswordResetRequest from "@/pages/auth/PasswordResetRequest";
import PasswordResetComplete from "@/pages/auth/PasswordResetComplete";
import { PLATFORM_IDENTITY_URL } from "@/lib/links";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useStore();
  const location = useLocation();
  if (!session?.authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

/** Bookmarks to /settings go to platform identity & keys. */
function PlatformSettingsRedirect() {
  useEffect(() => {
    window.location.replace(PLATFORM_IDENTITY_URL);
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
      Opening Platform settings...
    </div>
  );
}

// app.phantixlabs.com/demo --- landing-page entry into the guided demo tenant
function DemoEntry() {
  const { enterDemo } = useStore();
  const navigate = useNavigate();
  useEffect(() => {
    enterDemo();
    navigate("/dashboard", { replace: true });
  }, [enterDemo, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <img src="/logo-transparent.png" alt="" className="mx-auto h-16 w-16 animate-pulse-soft object-contain" />
        <p className="mt-4 text-sm text-slate-400">Preparing the demo tenant...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <OperationsProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/password-reset" element={<PasswordResetRequest />} />
          <Route path="/reset-password" element={<PasswordResetComplete />} />
          <Route path="/device-confirm" element={<DeviceConfirm />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/integrations/github/callback" element={<GithubCallback />} />
          <Route path="/demo" element={<DemoEntry />} />
          {/* Public sandbox application — no auth (entry from phantixlabs.com) */}
          <Route path="/sandbox-apply" element={<SandboxApplyPublic />} />

          <Route element={<Layout />}>
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/assets" element={<RequireAuth><Assets /></RequireAuth>} />
            <Route path="/assets/intelligence" element={<RequireAuth><AssetIntelligence /></RequireAuth>} />
            <Route path="/assets/intelligence/graph" element={<RequireAuth><AssetGraph /></RequireAuth>} />
            <Route path="/soc" element={<RequireAuth><SocDashboard /></RequireAuth>} />
            <Route path="/soc/war-room" element={<RequireAuth><SocWarRoom /></RequireAuth>} />
            <Route path="/soc/playbooks" element={<RequireAuth><SocPlaybooks /></RequireAuth>} />
            <Route path="/soc/advisor" element={<RequireAuth><SocAdvisor /></RequireAuth>} />
            <Route path="/soc/logs" element={<RequireAuth><SocLogPipeline /></RequireAuth>} />
            <Route path="/soc/agents" element={<RequireAuth><SocAgentManager /></RequireAuth>} />
            <Route path="/soc/cloud" element={<RequireAuth><SocCloudIntegration /></RequireAuth>} />
            <Route path="/integrations" element={<RequireAuth><IntegrationsHub /></RequireAuth>} />
            <Route path="/scans" element={<RequireAuth><Scans /></RequireAuth>} />
            <Route path="/code" element={<RequireAuth><Code /></RequireAuth>} />
            <Route path="/posture" element={<RequireAuth><Posture /></RequireAuth>} />
            <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
            <Route path="/plans" element={<RequireAuth><Plans /></RequireAuth>} />
            <Route path="/vapt" element={<RequireAuth><Vapt /></RequireAuth>} />
            <Route path="/vapt/schedules" element={<RequireAuth><VaptSchedules /></RequireAuth>} />
            <Route path="/vapt/settings" element={<RequireAuth><VaptSettings /></RequireAuth>} />
            <Route path="/vapt/procedures" element={<RequireAuth><VaptProcedures /></RequireAuth>} />
            <Route path="/threat-intel" element={<RequireAuth><ThreatIntel /></RequireAuth>} />
            <Route path="/cloud" element={<RequireAuth><Cloud /></RequireAuth>} />
            <Route path="/pentest/external-scope" element={<RequireAuth><PentestScope /></RequireAuth>} />
            <Route path="/risks" element={<RequireAuth><Risks /></RequireAuth>} />
            <Route path="/compliance" element={<RequireAuth><Compliance /></RequireAuth>} />
            <Route path="/compliance/questionnaire" element={<RequireAuth><ComplianceQuestionnaire /></RequireAuth>} />
            <Route path="/compliance/gaps" element={<RequireAuth><ComplianceGaps /></RequireAuth>} />
            <Route path="/compliance/profile" element={<RequireAuth><ComplianceProfile /></RequireAuth>} />
            <Route path="/compliance/connectors" element={<RequireAuth><ComplianceConnectors /></RequireAuth>} />
            <Route path="/context" element={<RequireAuth><ContextProjects /></RequireAuth>} />
            <Route path="/threat-models" element={<RequireAuth><ThreatModels /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
            <Route path="/agent" element={<RequireAuth><Agent /></RequireAuth>} />
            <Route path="/agent-activity" element={<RequireAuth><AgentActivity /></RequireAuth>} />
            <Route path="/sandbox" element={<RequireAuth><Sandbox /></RequireAuth>} />
            <Route path="/alerts" element={<RequireAuth><Alerts /></RequireAuth>} />
            <Route path="/audit" element={<RequireAuth><Audit /></RequireAuth>} />
            <Route path="/people" element={<RequireAuth><People /></RequireAuth>} />
            <Route path="/settings" element={<PlatformSettingsRedirect />} />
            <Route path="/settings/privacy" element={<RequireAuth><Privacy /></RequireAuth>} />
            <Route path="/support" element={<RequireAuth><Support /></RequireAuth>} />
            <Route path="/authorizations" element={<RequireAuth><AuthorizerInbox /></RequireAuth>} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/docs/:docId" element={<DocPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <DualControlOverlay />
        <CookieConsent />
        <ToastViewport />
        </BrowserRouter>
      </OperationsProvider>
    </StoreProvider>
  );
}

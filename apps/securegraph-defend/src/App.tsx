import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import Docs from "@sg/pages/Docs";
import DocPage from "@sg/pages/DocPage";
import { StoreProvider, ToastViewport } from "@sg/store";
import DualControlOverlay from "@sg/components/DualControlOverlay";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import Overview from "./pages/Overview";
import Assets from "./pages/Assets";
import AssetIntelligence from "./pages/AssetIntelligence";
import AssetGraph from "./pages/AssetGraph";
import Risks from "./pages/Risks";
import ThreatIntel from "./pages/ThreatIntel";
import Cloud from "./pages/Cloud";
import Posture from "./pages/Posture";
import Alerts from "./pages/Alerts";
import Compliance from "./pages/Compliance";
import ComplianceQuestionnaire from "./pages/ComplianceQuestionnaire";
import ComplianceGaps from "./pages/ComplianceGaps";
import ComplianceProfile from "./pages/ComplianceProfile";
import ComplianceConnectors from "./pages/ComplianceConnectors";
import SocDashboard from "./pages/SocDashboard";
import SocWarRoom from "./pages/SocWarRoom";
import SocPlaybooks from "./pages/SocPlaybooks";
import SocAdvisor from "./pages/SocAdvisor";
import SocLogPipeline from "./pages/SocLogPipeline";
import SocAgentManager from "./pages/SocAgentManager";
import SocCloudIntegration from "./pages/SocCloudIntegration";

export default function App() {
  return (
    <StoreProvider>
      <Routes>        <Route
          element={
            <ApplicationShell
              application={"defend" as ApplicationKey}
              subtitle="Defend"
              nav={NAV}
              hosts={HOSTS}
            />
          }
        >
          <Route path="/" element={<Overview application={"defend" as ApplicationKey} nav={NAV} />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/assets/intelligence" element={<AssetIntelligence />} />
          <Route path="/assets/intelligence/graph" element={<AssetGraph />} />
          <Route path="/posture" element={<Posture />} />
          <Route path="/cloud" element={<Cloud />} />
          <Route path="/risks" element={<Risks />} />
          <Route path="/threat-intel" element={<ThreatIntel />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/compliance/questionnaire" element={<ComplianceQuestionnaire />} />
          <Route path="/compliance/gaps" element={<ComplianceGaps />} />
          <Route path="/compliance/profile" element={<ComplianceProfile />} />
          <Route path="/compliance/connectors" element={<ComplianceConnectors />} />
          <Route path="/soc" element={<SocDashboard />} />
          <Route path="/soc/war-room" element={<SocWarRoom />} />
          <Route path="/soc/playbooks" element={<SocPlaybooks />} />
          <Route path="/soc/advisor" element={<SocAdvisor />} />
          <Route path="/soc/logs" element={<SocLogPipeline />} />
          <Route path="/soc/agents" element={<SocAgentManager />} />
          <Route path="/soc/cloud" element={<SocCloudIntegration />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* Documentation renders full-width, without the application sidebar. */}
        <Route path="/docs" element={<Docs application="defend" />} />
        <Route path="/docs/:docId" element={<DocPage />} />

      </Routes>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

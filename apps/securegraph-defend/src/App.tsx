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
import SectionGate from "@sg/components/SectionGate";

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
          <Route path="/assets" element={<Assets title="Assets" />} />
          <Route path="/assets/intelligence" element={<AssetIntelligence />} />
          <Route path="/assets/intelligence/graph" element={<AssetGraph />} />
          <Route path="/posture" element={<Posture />} />
          <Route path="/cloud" element={<SectionGate section="defend.cloud"><Cloud /></SectionGate>} />
          <Route path="/risks" element={<Risks />} />
          <Route path="/threat-intel" element={<SectionGate section="defend.threat_intel"><ThreatIntel /></SectionGate>} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/compliance" element={<SectionGate section="defend.compliance"><Compliance /></SectionGate>} />
          <Route path="/compliance/questionnaire" element={<SectionGate section="defend.compliance_questionnaire"><ComplianceQuestionnaire /></SectionGate>} />
          <Route path="/compliance/gaps" element={<SectionGate section="defend.compliance_gaps"><ComplianceGaps /></SectionGate>} />
          <Route path="/compliance/profile" element={<SectionGate section="defend.compliance_profile"><ComplianceProfile /></SectionGate>} />
          <Route path="/compliance/connectors" element={<SectionGate section="defend.compliance_connectors"><ComplianceConnectors /></SectionGate>} />
          <Route path="/soc" element={<SectionGate section="defend.soc"><SocDashboard /></SectionGate>} />
          <Route path="/soc/war-room" element={<SectionGate section="defend.soc_war_room"><SocWarRoom /></SectionGate>} />
          <Route path="/soc/playbooks" element={<SectionGate section="defend.soc_playbooks"><SocPlaybooks /></SectionGate>} />
          <Route path="/soc/advisor" element={<SectionGate section="defend.soc_advisor"><SocAdvisor /></SectionGate>} />
          <Route path="/soc/logs" element={<SectionGate section="defend.soc_logs"><SocLogPipeline /></SectionGate>} />
          <Route path="/soc/agents" element={<SectionGate section="defend.soc_agents"><SocAgentManager /></SectionGate>} />
          <Route path="/soc/cloud" element={<SectionGate section="defend.soc_cloud"><SocCloudIntegration /></SectionGate>} />
          <Route path="/assistant" element={<Agent />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* Documentation renders outside the sidebar with its own top bar. */}
        <Route element={<DocsChrome />}>
          <Route path="/docs" element={<Docs application="defend" />} />
          <Route path="/docs/:docId" element={<DocPage />} />
        </Route>

      </Routes>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

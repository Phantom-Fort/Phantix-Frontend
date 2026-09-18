import React, { Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { ApplicationShell } from "@sg/shell/ApplicationShell";
import type { ApplicationKey } from "@sg/shell/types";
import Docs from "@sg/pages/Docs";
import DocPage from "@sg/pages/DocPage";
import DocsChrome from "@sg/pages/DocsChrome";
import { StoreProvider, ToastViewport } from "@sg/store";
import DualControlOverlay from "@sg/components/DualControlOverlay";
import BrandLoader from "@sg/components/BrandLoader";
import { HOSTS } from "./hosts";
import { NAV } from "./nav";
import SectionGate from "@sg/components/SectionGate";

const Agent = React.lazy(() => import("@sg/pages/Agent"));
const NotFound = React.lazy(() => import("@sg/pages/NotFound"));
const Overview = React.lazy(() => import("./pages/Overview"));
const Assets = React.lazy(() => import("./pages/Assets"));
const AssetIntelligence = React.lazy(() => import("./pages/AssetIntelligence"));
const AssetGraph = React.lazy(() => import("./pages/AssetGraph"));
const Risks = React.lazy(() => import("./pages/Risks"));
const ThreatIntel = React.lazy(() => import("./pages/ThreatIntel"));
const Cloud = React.lazy(() => import("./pages/Cloud"));
const Posture = React.lazy(() => import("./pages/Posture"));
const Alerts = React.lazy(() => import("./pages/Alerts"));
const Compliance = React.lazy(() => import("./pages/Compliance"));
const ComplianceQuestionnaire = React.lazy(() => import("./pages/ComplianceQuestionnaire"));
const ComplianceGaps = React.lazy(() => import("./pages/ComplianceGaps"));
const ComplianceProfile = React.lazy(() => import("./pages/ComplianceProfile"));
const ComplianceConnectors = React.lazy(() => import("./pages/ComplianceConnectors"));
const SocDashboard = React.lazy(() => import("./pages/SocDashboard"));
const SocWarRoom = React.lazy(() => import("./pages/SocWarRoom"));
const SocPlaybooks = React.lazy(() => import("./pages/SocPlaybooks"));
const SocAdvisor = React.lazy(() => import("./pages/SocAdvisor"));
const SocLogPipeline = React.lazy(() => import("./pages/SocLogPipeline"));
const SocAgentManager = React.lazy(() => import("./pages/SocAgentManager"));
const SocCloudIntegration = React.lazy(() => import("./pages/SocCloudIntegration"));

export default function App() {
  return (
    <StoreProvider>
      <Suspense fallback={<BrandLoader label="Defend" message="Loading" />}>
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
          <Route path="*" element={<NotFound homePath="/" />} />
        </Route>
        {/* Documentation renders outside the sidebar with its own top bar. */}
        <Route element={<DocsChrome />}>
          <Route path="/docs" element={<Docs application="defend" />} />
          <Route path="/docs/:docId" element={<DocPage />} />
        </Route>

      </Routes>
      </Suspense>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

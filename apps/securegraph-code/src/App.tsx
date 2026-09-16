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
import Code from "./pages/Code";
import ProviderConnect from "./pages/ProviderConnect";
import ThreatModels from "./pages/ThreatModels";
import ContextProjects from "./pages/ContextProjects";

export default function App() {
  return (
    <StoreProvider>
      <Routes>        <Route
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
          <Route path="/code-review/providers/:provider" element={<ProviderConnect />} />
          <Route path="/code-review/:section" element={<Code />} />
          <Route path="/threat-models" element={<ThreatModels />} />
          <Route path="/context" element={<ContextProjects />} />
          <Route path="/assistant" element={<Agent />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* Documentation renders outside the sidebar with its own top bar. */}
        <Route element={<DocsChrome />}>
          <Route path="/docs" element={<Docs application="code" />} />
          <Route path="/docs/:docId" element={<DocPage />} />
        </Route>

      </Routes>
      <ToastViewport />
      <DualControlOverlay />
    </StoreProvider>
  );
}

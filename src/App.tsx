import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { StoreProvider, ToastViewport, useStore } from "@/lib/store";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Assets from "@/pages/Assets";
import Scans from "@/pages/Scans";
import Vapt from "@/pages/Vapt";
import Risks from "@/pages/Risks";
import Compliance from "@/pages/Compliance";
import Reports from "@/pages/Reports";
import Alerts from "@/pages/Alerts";
import Audit from "@/pages/Audit";
import People from "@/pages/People";
import Settings from "@/pages/Settings";
import Support from "@/pages/Support";
import Docs from "@/pages/Docs";
import DocPage from "@/pages/DocPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useStore();
  const location = useLocation();
  if (!session?.authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

// app.phantix.site/demo — landing-page entry into the guided demo tenant
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
        <p className="mt-4 text-sm text-slate-400">Preparing the demo tenant…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/demo" element={<DemoEntry />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/assets" element={<RequireAuth><Assets /></RequireAuth>} />
            <Route path="/scans" element={<RequireAuth><Scans /></RequireAuth>} />
            <Route path="/vapt" element={<RequireAuth><Vapt /></RequireAuth>} />
            <Route path="/risks" element={<RequireAuth><Risks /></RequireAuth>} />
            <Route path="/compliance" element={<RequireAuth><Compliance /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
            <Route path="/alerts" element={<RequireAuth><Alerts /></RequireAuth>} />
            <Route path="/audit" element={<RequireAuth><Audit /></RequireAuth>} />
            <Route path="/people" element={<RequireAuth><People /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/support" element={<RequireAuth><Support /></RequireAuth>} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/docs/:docId" element={<DocPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <ToastViewport />
      </BrowserRouter>
    </StoreProvider>
  );
}

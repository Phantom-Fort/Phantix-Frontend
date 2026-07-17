import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AppShell } from '@/components/layout/AppShell'
import { DualControlUnlock } from '@/components/auth/DualControlUnlock'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ToastContainer } from '@/components/shared/ToastContainer'
import { LoginPage } from '@/pages/public/LoginPage'
import { RegisterPage } from '@/pages/public/RegisterPage'
import { OrgDashboardPage } from '@/pages/dashboard/OrgDashboardPage'
import { SetupWizard } from '@/pages/onboarding/SetupWizard'
import { AssetList } from '@/pages/assets/AssetList'
import { DiscoveryJobs } from '@/pages/assets/DiscoveryJobs'
import { ScanJobs } from '@/pages/scans/ScanJobs'
import { ScanResults } from '@/pages/scans/ScanResults'
import { CampaignList } from '@/pages/vapt/CampaignList'
import { CampaignDetail } from '@/pages/vapt/CampaignDetail'
import { ReportList } from '@/pages/reports/ReportList'
import { TrackerBoard } from '@/pages/reports/TrackerBoard'
import { ComplianceDashboard } from '@/pages/compliance/ComplianceDashboard'
import { AlertSettings } from '@/pages/alerts/AlertSettings'
import { AuditLog } from '@/pages/audit/AuditLog'
import { AlertsNotifier } from '@/components/alerts/AlertsNotifier'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<OrgDashboardPage />} />
              <Route path="/onboarding" element={<SetupWizard />} />
              <Route path="/assets" element={<AssetList />} />
              <Route path="/discovery" element={<DiscoveryJobs />} />
              <Route path="/scans" element={<ScanJobs />} />
              <Route path="/scans/results" element={<ScanResults />} />
              <Route path="/vapt" element={<CampaignList />} />
              <Route path="/vapt/:id" element={<CampaignDetail />} />
              <Route path="/reports" element={<ReportList />} />
              <Route path="/tracker" element={<TrackerBoard />} />
              <Route path="/compliance" element={<ComplianceDashboard />} />
              <Route path="/alerts" element={<AlertSettings />} />
              <Route path="/audit" element={<AuditLog />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <DualControlUnlock />
          <ToastContainer />
          <AlertsNotifier />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

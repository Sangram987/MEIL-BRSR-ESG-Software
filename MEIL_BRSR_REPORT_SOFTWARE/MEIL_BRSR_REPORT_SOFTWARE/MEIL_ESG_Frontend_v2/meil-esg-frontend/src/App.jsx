import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Chatbot from './components/Chatbot';
import Layout from './components/Layout';
import OperatorLayout from './components/OperatorLayout';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Settings from './pages/Settings';

import AdminPortal from './pages/admin/AdminPortal';
import Organization from './pages/admin/Organization';
import Consolidation from './pages/admin/Consolidation';
import BrsrMapping from './pages/admin/BrsrMapping';
import Disclosures from './pages/admin/Disclosures';
import ValueChain from './pages/admin/ValueChain';
import RiskMatrix from './pages/admin/RiskMatrix';
import SdgAlignment from './pages/admin/SdgAlignment';
import AiInsights from './pages/admin/AiInsights';
import Reports from './pages/admin/Reports';

import ManagerPortal from './pages/manager/ManagerPortal';
import Approvals from './pages/manager/Approvals';
import BuSites from './pages/manager/BuSites';

import OperatorPortal from './pages/operator/OperatorPortal';
import DataEntry from './pages/operator/DataEntry';
import MySubmissions from './pages/operator/MySubmissions';

import VendorPortal from './pages/vendor/VendorPortal';
import VendorSubmit from './pages/vendor/VendorSubmit';
import VendorHistory from './pages/vendor/VendorHistory';

import Workbench from './pages/auditor/Workbench';
import VendorReview from './pages/auditor/VendorReview';
import Opinions from './pages/auditor/Opinions';

import SiteEngineerPortal from './pages/engineer/SiteEngineerPortal';
import ReviewVerificationPortal from './pages/review/ReviewVerificationPortal';
import SubsidiaryPortal from './pages/subsidiary/SubsidiaryPortal';
import AuditCenter from './pages/admin/AuditCenter';

import EvidenceCapture from './pages/operator/EvidenceCapture';
import EvidenceLineage from './pages/admin/EvidenceLineage';
import CapaManagement from './pages/admin/CapaManagement';

const THEME_KEY = 'meil-home-theme';

function getInitialTheme() {
  try {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme) return savedTheme === 'dark';
  } catch { /* Storage may be unavailable in private browsing. */ }
  return false;
}

export default function App() {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    try { window.localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light'); } catch { /* Ignore unavailable storage. */ }
  }, [isDark]);

  return (
    <div className={isDark ? 'app-theme-dark' : ''}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home isDark={isDark} onToggleTheme={() => setIsDark((current) => !current)} />} />
          <Route path="/login" element={<Login />} />

          {/* Group ESG Control Tower & Audit Center: admin & auditor */}
          <Route element={<ProtectedRoute roles={['admin', 'subsidiary', 'manager', 'auditor']}><Layout /></ProtectedRoute>}>
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin', 'auditor']}><Layout /></ProtectedRoute>}>
            <Route path="/admin" element={<AdminPortal />} />
            <Route path="/admin/approvals" element={<Approvals />} />
            <Route path="/admin/audit" element={<AuditCenter />} />
            <Route path="/admin/organization" element={<Organization />} />
            <Route path="/admin/consolidation" element={<Consolidation />} />
            <Route path="/admin/brsr-mapping" element={<BrsrMapping />} />
            <Route path="/admin/disclosures" element={<Disclosures />} />
            <Route path="/admin/value-chain" element={<ValueChain />} />
            <Route path="/admin/risk-management" element={<RiskMatrix />} />
            <Route path="/admin/sdg" element={<SdgAlignment />} />
            <Route path="/admin/ai-insights" element={<AiInsights />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/evidence-lineage" element={<EvidenceLineage />} />
            <Route path="/admin/capa" element={<CapaManagement />} />
            {/* Backward compatibility redirects for auditor */}
            <Route path="/auditor" element={<Navigate to="/admin/audit" replace />} />
            <Route path="/auditor/*" element={<Navigate to="/admin/audit" replace />} />
          </Route>

          {/* Portal 3: Subsidiary Governance & Multi-BU Review Portal */}
          <Route element={<ProtectedRoute roles={['subsidiary', 'manager', 'admin']}><Layout /></ProtectedRoute>}>
            <Route path="/subsidiary" element={<SubsidiaryPortal />} />
            <Route path="/subsidiary/approvals" element={<Approvals />} />
          </Route>

          {/* Portal 2: BU Manager Verification Portal */}
          <Route element={<ProtectedRoute roles={['manager', 'subsidiary', 'admin']}><Layout /></ProtectedRoute>}>
            <Route path="/review" element={<ReviewVerificationPortal />} />
            <Route path="/manager" element={<ReviewVerificationPortal />} />
            <Route path="/manager/approvals" element={<Approvals />} />
            <Route path="/manager/sites" element={<BuSites />} />
            <Route path="/manager/data-entry" element={<DataEntry />} />
            <Route path="/manager/capa" element={<CapaManagement />} />
          </Route>

          {/* Portal 1: Site Engineer Portal (Mobile-First) */}
          <Route element={<ProtectedRoute roles={['operator', 'admin']}><OperatorLayout /></ProtectedRoute>}>
            <Route path="/engineer" element={<SiteEngineerPortal />} />
            <Route path="/operator" element={<SiteEngineerPortal />} />
            <Route path="/operator/evidence" element={<EvidenceCapture />} />
            <Route path="/operator/data-entry" element={<DataEntry />} />
            <Route path="/operator/submissions" element={<MySubmissions />} />
          </Route>

          {/* Scope 3 Value Chain (retained backend connector) */}
          <Route element={<ProtectedRoute roles={['vendor', 'admin']}><OperatorLayout /></ProtectedRoute>}>
            <Route path="/vendor" element={<VendorPortal />} />
            <Route path="/vendor/submit" element={<VendorSubmit />} />
            <Route path="/vendor/history" element={<VendorHistory />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Chatbot />
      </BrowserRouter>
    </div>
  );
}

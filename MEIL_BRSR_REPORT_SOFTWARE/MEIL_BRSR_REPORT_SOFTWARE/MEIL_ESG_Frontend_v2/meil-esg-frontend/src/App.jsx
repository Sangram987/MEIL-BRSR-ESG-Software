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

const THEME_KEY = 'meil-home-theme';

function getInitialTheme() {
  try {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme) return savedTheme === 'dark';
  } catch { /* Storage may be unavailable in private browsing. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
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

          {/* Corporate portal (sidebar): Group Admin, BU Manager, Auditor */}
          <Route element={<ProtectedRoute roles={['admin', 'manager', 'auditor']}><Layout /></ProtectedRoute>}>
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin']}><Layout /></ProtectedRoute>}>
            <Route path="/admin" element={<AdminPortal />} />
            <Route path="/admin/organization" element={<Organization />} />
            <Route path="/admin/consolidation" element={<Consolidation />} />
            <Route path="/admin/brsr-mapping" element={<BrsrMapping />} />
            <Route path="/admin/disclosures" element={<Disclosures />} />
            <Route path="/admin/value-chain" element={<ValueChain />} />
            <Route path="/admin/risk-management" element={<RiskMatrix />} />
            <Route path="/admin/sdg" element={<SdgAlignment />} />
            <Route path="/admin/ai-insights" element={<AiInsights />} />
            <Route path="/admin/reports" element={<Reports />} />
          </Route>
          <Route element={<ProtectedRoute roles={['manager']}><Layout /></ProtectedRoute>}>
            <Route path="/manager" element={<ManagerPortal />} />
            <Route path="/manager/data-entry" element={<DataEntry />} />
            <Route path="/manager/approvals" element={<Approvals />} />
            <Route path="/manager/sites" element={<BuSites />} />
          </Route>
          <Route element={<ProtectedRoute roles={['auditor']}><Layout /></ProtectedRoute>}>
            <Route path="/auditor" element={<Workbench />} />
            <Route path="/auditor/vendors" element={<VendorReview />} />
            <Route path="/auditor/opinions" element={<Opinions />} />
          </Route>

          {/* Field portals (top-nav): Site Operator, Vendor */}
          <Route element={<ProtectedRoute roles={['operator']}><OperatorLayout /></ProtectedRoute>}>
            <Route path="/operator" element={<OperatorPortal />} />
            <Route path="/operator/data-entry" element={<DataEntry />} />
            <Route path="/operator/submissions" element={<MySubmissions />} />
          </Route>
          <Route element={<ProtectedRoute roles={['vendor']}><OperatorLayout /></ProtectedRoute>}>
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

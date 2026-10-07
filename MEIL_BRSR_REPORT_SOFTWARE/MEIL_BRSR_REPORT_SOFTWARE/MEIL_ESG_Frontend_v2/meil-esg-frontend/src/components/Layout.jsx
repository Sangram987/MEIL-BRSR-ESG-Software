import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileSpreadsheet, ClipboardCheck, FileDown, Menu, X, LogOut, Building2, Truck, ShieldAlert,
  BrainCircuit, Sigma, BookMarked, ScrollText, Globe2, Store, MapPinned, ShieldCheck, Scale, Settings as Cog, Layers,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import { FYS, ROLE_META } from '../data/brsr';
import NotificationBell from './NotificationBell';

// layer: 'brsr' = official SEBI disclosure, 'mgmt' = internal management add-on, 'integration' = workflow/data-collection layer
const NAV = {
  admin: [
    { to: '/admin', label: 'Command Center', icon: LayoutDashboard, end: true, layer: 'mgmt' },
    { to: '/admin/organization', label: 'Organization Tree', icon: Building2, layer: 'integration' },
    { to: '/admin/consolidation', label: 'Consolidation', icon: Sigma, layer: 'brsr' },
    { to: '/admin/brsr-mapping', label: 'BRSR Mapping', icon: BookMarked, layer: 'brsr' },
    { to: '/admin/disclosures', label: 'Section A & B', icon: ScrollText, layer: 'brsr' },
    { to: '/admin/value-chain', label: 'Value Chain (Scope 3)', icon: Truck, layer: 'integration' },
    { to: '/admin/risk-management', label: 'ESG Risk Matrix', icon: ShieldAlert, layer: 'mgmt' },
    { to: '/admin/sdg', label: 'SDG Alignment', icon: Globe2, layer: 'mgmt' },
    { to: '/admin/ai-insights', label: 'AI Analytics', icon: BrainCircuit, layer: 'mgmt' },
    { to: '/admin/reports', label: 'SEBI BRSR Reports', icon: FileDown, layer: 'brsr' },
  ],
  manager: [
    { to: '/manager', label: 'BU Overview', icon: LayoutDashboard, end: true },
    { to: '/manager/data-entry', label: 'Site Data Entry', icon: FileSpreadsheet },
    { to: '/manager/approvals', label: 'Review & Approvals', icon: ClipboardCheck },
    { to: '/manager/sites', label: 'BU Sites', icon: MapPinned },
  ],
  auditor: [
    { to: '/auditor', label: 'Assessment / Assurance', icon: ShieldCheck, end: true },
    { to: '/auditor/vendors', label: 'Vendor Data Review', icon: Store },
    { to: '/auditor/opinions', label: 'Opinions', icon: Scale },
  ],
  operator: [{ to: '/operator', label: 'Site Home', icon: LayoutDashboard, end: true }],
  vendor: [{ to: '/vendor', label: 'Vendor Home', icon: LayoutDashboard, end: true }],
};
const LAYER_DOT = { brsr: 'bg-indigo-500', mgmt: 'bg-amber-500', integration: 'bg-sky-500' };
const LAYER_LABEL = { brsr: 'Official BRSR disclosure', mgmt: 'Management add-on', integration: 'Workflow / data layer' };

export default function Layout() {
  const { user, ui, actions } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const links = NAV[user.role];
  const title = [...links, { to: '/settings', label: 'Account Preferences' }].filter((l) => loc.pathname === l.to || (l.to !== links[0].to && loc.pathname.startsWith(l.to + '/'))).sort((a, b) => b.to.length - a.to.length)[0]?.label || links[0].label;
  const logout = () => { actions.logout(); navigate('/'); };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3"><div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-sm">M</div><h1 className="font-semibold text-lg">MEIL ESG</h1></div>
        <div className="flex items-center gap-1"><NotificationBell /><button onClick={() => setMobile(!mobile)} aria-label="Menu" className="p-1.5 text-slate-600">{mobile ? <X size={24} /> : <Menu size={24} />}</button></div>
      </header>

      <aside className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 shadow-sm ${mobile ? 'translate-x-0 w-64' : '-translate-x-full'} md:sticky md:top-0 md:h-screen md:translate-x-0 ${collapsed ? 'md:w-20' : 'md:w-64'}`}>
        <div className="overflow-y-auto">
          <div className={`h-20 flex items-center border-b border-slate-100 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {!collapsed && (
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-10 w-10 min-w-[40px] bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-sm">M</div>
                <div className="whitespace-nowrap"><h2 className="font-bold text-slate-900 text-sm tracking-widest">MEIL GROUP</h2><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">BRSR Hub</p></div>
              </div>
            )}
            <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Toggle sidebar" aria-label="Toggle sidebar"><Menu size={20} /></button>
          </div>
          <nav className="p-3 space-y-1 mt-2">
            {!collapsed && <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">{ROLE_META[user.role].label} workspace</div>}
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setMobile(false)} title={collapsed ? l.label : (l.layer ? LAYER_LABEL[l.layer] : '')}
                className={({ isActive }) => `flex items-center rounded-lg text-sm font-semibold transition ${collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} ${isActive ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'}`}>
                <l.icon size={collapsed ? 22 : 18} />{!collapsed && <span className="whitespace-nowrap flex-1">{l.label}</span>}{!collapsed && l.layer && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${LAYER_DOT[l.layer]}`} />}
              </NavLink>
            ))}
            {!collapsed && user.role === 'admin' && (
              <div className="px-3 pt-3 pb-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 font-semibold">
                {Object.entries(LAYER_LABEL).map(([k, l]) => <span key={k} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${LAYER_DOT[k]}`} />{l}</span>)}
              </div>
            )}
            <NavLink to="/settings" onClick={() => setMobile(false)} title="Settings" className={({ isActive }) => `flex items-center rounded-lg text-sm font-semibold transition mt-3 ${collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} ${isActive ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-slate-500 hover:bg-slate-50 border border-transparent'}`}>
              <Cog size={collapsed ? 22 : 18} />{!collapsed && 'Settings'}
            </NavLink>
          </nav>
        </div>
        <div className="p-3 border-t border-slate-100">
          <div className={`bg-slate-50 rounded-xl border border-slate-200 ${collapsed ? 'p-2' : 'p-4'}`}>
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'mb-3'}`}>
              <div className="h-10 w-10 min-w-[40px] rounded-full bg-white flex items-center justify-center border border-slate-300 font-bold text-slate-600 text-sm">{user.name.split(' ').map((w) => w[0]).join('')}</div>
              {!collapsed && <div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{user.name}</p><p className="text-xs text-slate-500 truncate">{user.title}</p></div>}
            </div>
            {!collapsed && <button onClick={logout} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold"><LogOut size={14} /> Sign out</button>}
          </div>
        </div>
      </aside>
      {mobile && <div onClick={() => setMobile(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden" />}

      <main className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-hidden">
        <div className="hidden md:flex h-20 items-center justify-between px-8 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="fy">Financial year</label>
            <select id="fy" value={ui.fy} onChange={(e) => actions.setFY(e.target.value)} className="text-sm font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
              {FYS.map((f) => <option key={f}>{f}</option>)}
            </select>
            <NotificationBell />
          </div>
        </div>
        <div className="flex-1 md:overflow-y-auto p-4 sm:p-6 lg:p-8"><div className="max-w-7xl mx-auto"><Outlet /></div></div>
      </main>
    </div>
  );
}

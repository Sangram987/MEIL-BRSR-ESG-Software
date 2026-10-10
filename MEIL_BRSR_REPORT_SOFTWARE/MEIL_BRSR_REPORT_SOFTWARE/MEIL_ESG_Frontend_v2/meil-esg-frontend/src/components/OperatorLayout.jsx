import React, { useState } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import {
  HardHat, LogOut, Truck, LayoutDashboard, Camera, FileSpreadsheet,
  ClipboardList, Menu, X, ChevronRight, Sparkles, Building2, ShieldCheck, MapPin
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import { periodLabel, CURRENT_PERIOD, FYS } from '../data/brsr';
import NotificationBell from './NotificationBell';

export default function OperatorLayout() {
  const navigate = useNavigate();
  const loc = useLocation();
  const { user, ui, actions } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);

  const isVendor = user?.role === 'vendor';

  const links = isVendor
    ? [
        { to: '/admin/value-chain', label: 'Value Chain Overview', icon: ClipboardList, end: true, badge: 'Scope 3' },
      ]
    : [
        { to: '/engineer', label: 'My Sites & Dashboard', icon: LayoutDashboard, end: true, badge: 'Home' },
        { to: '/operator/evidence', label: '📸 Capture Evidence (Batch)', icon: Camera, badge: 'AI OCR' },
        { to: '/operator/data-entry', label: '✍ Comprehensive ESG Entry', icon: FileSpreadsheet, badge: '9 Principles' },
        { to: '/engineer?tab=processing', label: 'Processing Pipeline', icon: Sparkles },
        { to: '/engineer?tab=submissions', label: 'My Submissions', icon: ClipboardList },
        { to: '/engineer?tab=verification', label: 'Verification Results', icon: ShieldCheck },
        { to: '/engineer?tab=capa', label: 'CAPA / Corrections', icon: HardHat },
      ];

  const currentTitle = links.find((l) =>
    l.end ? loc.pathname === l.to : loc.pathname.startsWith(l.to)
  )?.label || (isVendor ? 'Value Chain Portal' : 'Site Engineer Portal');

  const logout = () => {
    actions.logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 ${isVendor ? 'bg-indigo-600' : 'bg-emerald-600'} rounded-lg flex items-center justify-center font-black text-white text-sm shadow-sm`}>
            {isVendor ? <Truck size={18} /> : <HardHat size={18} />}
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-tight">
              {isVendor ? 'MEIL VALUE CHAIN' : 'MEIL SITE ENGINEER'}
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold">{periodLabel(CURRENT_PERIOD)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setMobile(!mobile)}
            aria-label="Menu"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Modern Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 shadow-sm ${
          mobile ? 'translate-x-0 w-64' : '-translate-x-full'
        } md:sticky md:top-0 md:h-screen md:translate-x-0 ${collapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        <div className="overflow-y-auto flex-1">
          {/* Brand header */}
          <div className={`h-20 flex items-center border-b border-slate-100 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {!collapsed && (
              <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => navigate(links[0].to)}>
                <div className={`h-10 w-10 min-w-[40px] ${isVendor ? 'bg-indigo-600' : 'bg-emerald-600'} rounded-xl flex items-center justify-center font-bold text-white shadow-sm transition hover:scale-105`}>
                  {isVendor ? <Truck size={22} /> : <HardHat size={22} />}
                </div>
                <div className="whitespace-nowrap">
                  <h2 className="font-black text-slate-900 text-sm tracking-wider">
                    {isVendor ? 'VALUE CHAIN' : 'SITE ENGINEER'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {isVendor ? 'Scope 3 Disclosures' : 'Site Evidence Hub'}
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Site / Project Context Card in Sidebar */}
          {!collapsed && (
            <div className="p-3">
              <div className="bg-slate-900 text-white rounded-xl p-3 border border-slate-800 shadow-inner">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`h-2 w-2 rounded-full ${isVendor ? 'bg-indigo-400' : 'bg-emerald-400'} animate-pulse`} />
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    {isVendor ? 'Assigned Vendor' : 'Assigned Project'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate">
                  {user?.projectId ? 'Zojila Tunnel Package 1' : (user?.name || 'Site Field Office')}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>{periodLabel(CURRENT_PERIOD)}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                    <ShieldCheck size={11} /> Active
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {!collapsed && (
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">
                {isVendor ? 'Vendor Operations' : 'Site Operations'}
              </div>
            )}
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setMobile(false)}
                title={collapsed ? l.label : ''}
                className={({ isActive }) =>
                  `flex items-center rounded-xl text-sm font-semibold transition group ${
                    collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                  } ${
                    isActive
                      ? isVendor
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold shadow-sm'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                  }`
                }
              >
                <l.icon size={collapsed ? 22 : 18} className="shrink-0 group-hover:scale-110 transition-transform" />
                {!collapsed && <span className="whitespace-nowrap flex-1">{l.label}</span>}
                {!collapsed && l.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    l.badge === 'AI Verified'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {l.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Card & Signout at Bottom */}
        <div className="p-3 border-t border-slate-100">
          <div className={`bg-slate-50 rounded-xl border border-slate-200/80 ${collapsed ? 'p-2' : 'p-3'}`}>
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'mb-3'}`}>
              <div className="h-9 w-9 min-w-[36px] rounded-full bg-white flex items-center justify-center border border-slate-300 font-bold text-slate-700 text-xs shadow-sm">
                {(user?.name || 'User')
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{user?.name || 'Site Operator'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.title || (isVendor ? 'Vendor' : 'Site Engineer')}</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-700 py-2 rounded-lg text-xs font-bold transition shadow-xs"
              >
                <LogOut size={14} /> Sign out
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobile && (
        <div
          onClick={() => setMobile(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* Main Content Area with Top Bar */}
      <main className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-hidden">
        {/* Clean Desktop Top Bar */}
        <div className="hidden md:flex h-20 items-center justify-between px-8 bg-white border-b border-slate-200 shadow-xs z-10 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{currentTitle}</h2>
            <p className="text-xs text-slate-500 font-medium">
              MEIL Infrastructure & Utilities · {isVendor ? 'Vendor Data Portal' : 'On-Site Ground Operations'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 border border-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>{periodLabel(CURRENT_PERIOD)}</span>
            </div>
            <NotificationBell />
          </div>
        </div>

        {/* Scrollable Viewport */}
        <div className="flex-1 md:overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/70">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

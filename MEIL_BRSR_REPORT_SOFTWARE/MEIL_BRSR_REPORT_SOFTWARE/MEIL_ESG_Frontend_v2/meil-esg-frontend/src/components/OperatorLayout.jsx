import React from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { HardHat, LogOut, Truck } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { periodLabel, CURRENT_PERIOD } from '../data/brsr';
import NotificationBell from './NotificationBell';

// Field-worker shell shared by Site Operators and Vendors (big touch targets, dark top bar).
export default function OperatorLayout() {
  const navigate = useNavigate();
  const { user, actions } = useApp();
  const isVendor = user.role === 'vendor';
  const links = isVendor
    ? [{ to: '/vendor', label: 'Requests', end: true }, { to: '/vendor/submit', label: 'Submit ESG data' }, { to: '/vendor/history', label: 'History' }]
    : [{ to: '/operator', label: 'Site home', end: true }, { to: '/operator/data-entry', label: 'Data entry' }, { to: '/operator/submissions', label: 'My submissions' }];
  const logout = () => { actions.logout(); navigate('/'); };
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <button onClick={() => navigate(links[0].to)} className="flex items-center gap-3 group text-left">
            <div className={`${isVendor ? 'bg-indigo-400' : 'bg-emerald-500'} p-1.5 rounded-lg group-hover:scale-105 transition-transform`}>{isVendor ? <Truck size={20} className="text-slate-900" /> : <HardHat size={20} className="text-slate-900" />}</div>
            <div><h1 className="font-black text-base sm:text-lg tracking-wide leading-none">{isVendor ? 'MEIL VENDOR PORTAL' : 'MEIL FIELD APP'}</h1><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{isVendor ? 'Value-chain ESG data' : `Data capture · ${periodLabel(CURRENT_PERIOD)}`}</p></div>
          </button>
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell dark />
            <span className="hidden md:block text-xs text-slate-400 text-right leading-tight mr-2"><b className="text-slate-200 block">{user.name}</b>{user.title}</span>
            <button onClick={logout} className="flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 sm:px-4 py-2 rounded-lg transition"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </div>
        <nav className="border-t border-slate-800 bg-slate-900"><div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition ${isActive ? 'border-emerald-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>{l.label}</NavLink>)}
        </div></nav>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8"><Outlet /></main>
    </div>
  );
}

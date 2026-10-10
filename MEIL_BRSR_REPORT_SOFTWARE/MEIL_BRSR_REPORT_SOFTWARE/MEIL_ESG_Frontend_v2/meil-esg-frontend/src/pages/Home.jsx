import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, HardHat, Leaf, Truck, ShieldCheck, ChevronRight, Globe, Settings, Bell, HelpCircle, Moon, Sun, Play, Cpu, CheckCircle2, ArrowRight, Building2 } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { ROLE_META } from '../data/brsr';
import logo2 from '../assets/logo2.svg';
import GoogleTranslate from "../components/GoogleTranslate";
import video1 from "../Videos/video1.mp4";
import { Link } from "react-router-dom";
import VerigraphPipelineDemo from '../components/VerigraphPipelineDemo';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ESG_TRAJECTORY_DATA = [
  { fy: 'FY 21-22', scope1: 1840, scope2: 1220, renewablePct: 14 },
  { fy: 'FY 22-23', scope1: 1690, scope2: 1080, renewablePct: 19 },
  { fy: 'FY 23-24', scope1: 1520, scope2: 950, renewablePct: 25 },
  { fy: 'FY 24-25', scope1: 1380, scope2: 830, renewablePct: 31 },
  { fy: 'FY 25-26', scope1: 1210, scope2: 710, renewablePct: 38 },
];

const PORTALS = [
  {
    role: 'operator',
    icon: HardHat,
    title: 'Site Engineer Portal',
    badge: 'PORTAL 1 · INGESTION',
    hover: 'hover:border-emerald-500 hover:shadow-emerald-100',
    chip: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    btnText: 'text-emerald-700',
    text: 'Field data ingestion, physical invoice screening, OpenCV quality check, and site activity logs.',
  },
  {
    role: 'manager',
    icon: Users,
    title: 'BU Manager Verification Portal',
    badge: 'PORTAL 2 · BU VERIFICATION',
    hover: 'hover:border-sky-500 hover:shadow-sky-100',
    chip: 'bg-sky-50 border-sky-200 text-sky-700',
    btnText: 'text-sky-700',
    text: 'Business unit managerial queue, multi-agent validation, temporal anomaly screening, and BU sign-off.',
  },
  {
    role: 'subsidiary',
    icon: Building2,
    title: 'Subsidiary Governance Portal',
    badge: 'PORTAL 3 · MULTI-BU OVERSIGHT',
    hover: 'hover:border-indigo-500 hover:shadow-indigo-100',
    chip: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    btnText: 'text-indigo-700',
    text: 'Oversee all BU Managers, verify divisional consistency, and forward validated data to Group Admin.',
  },
  {
    role: 'admin',
    icon: Shield,
    title: 'Group ESG Control Tower',
    badge: 'PORTAL 4 · GROUP GOVERNANCE',
    hover: 'hover:border-purple-500 hover:shadow-purple-100',
    chip: 'bg-purple-50 border-purple-200 text-purple-700',
    btnText: 'text-purple-700',
    text: 'Enterprise multi-site consolidation, knowledge graph traceability, and statutory SEBI BRSR filing.',
  },
];

export default function Home({ isDark, onToggleTheme }) {
  const navigate = useNavigate();
  const { user } = useApp();
  const enter = (role) => {
    if (user?.role === role) navigate(ROLE_META[role].home);
    else navigate('/login', { state: { role, from: ROLE_META[role].home } });
  };

  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <div className={`min-h-screen font-sans selection:bg-emerald-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {/* Premium Top Navigation Bar */}
      <nav className={`sticky top-0 z-50 border-b backdrop-blur-md shadow-xs ${isDark ? 'border-slate-800 bg-slate-950/90' : 'border-slate-200 bg-white/90'}`}>
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">

          {/* Left: Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-sky-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-sm">
              <img src={logo2} alt="MEIL" className="h-6 w-6 object-contain" />
            </div>
            <div>
              <span className={`block font-black tracking-wide leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>MEIL GROUP</span>
              <span className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>BRSR Hub</span>
            </div>
          </div>

          {/* Right: Settings, Language, & CTA */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className={`hidden items-center gap-5 border-r pr-6 md:flex ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
              <GoogleTranslate />
              <button
                onClick={() => navigate(user ? '/settings' : '/login')}
                className="hover:text-emerald-600 transition"
                title="Settings"
              >
                <Settings size={20} />
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${isDark ? 'border-slate-700 text-amber-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              {isDark ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <Link
              to="/login"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-700 hover:shadow-md sm:px-6 sm:text-sm"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative isolate flex min-h-[480px] items-center overflow-hidden bg-slate-900 sm:min-h-[520px]">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        >
          <source src={video1} type="video/mp4" />
        </video>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/95 via-slate-900/80 to-slate-900/40" />
        
        <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300 backdrop-blur-sm">
              <Leaf size={14} />
              SEBI BRSR Compliance & Decarbonization Platform
            </div>
            <h1 className="mb-4 text-4xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl tracking-tight">
              Sustainability <br />
              <span className="text-emerald-400">Built on Precision.</span>
            </h1>
            <p className="mb-8 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
              Enterprise ESG intelligence, multi-site telemetry, and statutory BRSR filing across 250+ project sites.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#portals" className="rounded-xl bg-emerald-500 px-7 py-3.5 text-center text-sm font-bold text-slate-950 shadow-md transition hover:bg-emerald-400">
                Enter Workspaces
              </a>
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-6 py-3.5 text-center text-sm font-bold text-white transition hover:bg-white/20 flex items-center justify-center gap-2"
              >
                <Play size={16} />
                Watch System Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Aligned Impact Stats Grid */}
      <div className="max-w-7xl mx-auto px-6 -mt-10 relative z-20">
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4`}>
          <div className={`p-6 rounded-2xl border shadow-sm transition ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 block mb-1">Active Projects</span>
            <div className="text-3xl sm:text-4xl font-black text-emerald-600">250+</div>
            <span className="text-[11px] text-slate-400 font-medium">Pan-India construction sites</span>
          </div>
          <div className={`p-6 rounded-2xl border shadow-sm transition ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 block mb-1">BRSR Principles</span>
            <div className="text-3xl sm:text-4xl font-black text-sky-600">9 Principles</div>
            <span className="text-[11px] text-slate-400 font-medium">P1 through P9 disclosures</span>
          </div>
          <div className={`p-6 rounded-2xl border shadow-sm transition ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 block mb-1">Audit Traceability</span>
            <div className="text-3xl sm:text-4xl font-black text-indigo-600">100%</div>
            <span className="text-[11px] text-slate-400 font-medium">Evidence-backed hash logs</span>
          </div>
          <div className={`p-6 rounded-2xl border shadow-sm transition ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500 block mb-1">Consolidation Engine</span>
            <div className="text-3xl sm:text-4xl font-black text-teal-600">Live Rollup</div>
            <span className="text-[11px] text-slate-400 font-medium">Automated multi-tier rollup</span>
          </div>
        </div>
      </div>

      {/* High-Impact ESG Performance Graph Section */}
      <div className="max-w-7xl mx-auto px-6 mt-12 mb-20">
        <div className={`rounded-3xl border p-6 sm:p-8 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-2 border border-emerald-200">
                <Leaf size={14} /> Group Decarbonization Trajectory
              </div>
              <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                MEIL Emissions Reduction & Clean Energy Progress
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Annual direct emissions (Scope 1) vs indirect electricity (Scope 2) in tCO2e, alongside renewable energy share.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                ● Net Zero 2030 Target
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold">
                ● 38% Renewable Energy
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ESG_TRAJECTORY_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="scope1Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="scope2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis dataKey="fy" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: 12,
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                <Area type="monotone" dataKey="scope1" name="Scope 1 (tCO2e)" stroke="#0ea5e9" fill="url(#scope1Grad)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="scope2" name="Scope 2 (tCO2e)" stroke="#6366f1" fill="url(#scope2Grad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Role-Based Portals */}
      <div id="portals" className="max-w-7xl mx-auto px-6 mb-24">
        <div className="text-center mb-10">
          <h2 className={`mb-2 text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Operational Workspaces
          </h2>
          <p className={`max-w-xl mx-auto text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Role-based access designed for field engineers, BU managers, and executive ESG officers.
          </p>
        </div>

        {/* 3 Main Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PORTALS.map((r) => (
            <button
              key={r.role}
              onClick={() => enter(r.role)}
              className={`group relative overflow-hidden rounded-2xl border p-7 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between ${
                isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-xs'
              } ${r.hover}`}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`h-12 w-12 border rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${r.chip}`}>
                    <r.icon size={26} strokeWidth={2.2} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {r.badge}
                  </span>
                </div>
                <h3 className={`mb-2.5 flex items-center justify-between text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {r.title}
                  <ChevronRight className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={18} />
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {r.text}
                </p>
              </div>

              <div className={`mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold ${r.btnText}`}>
                <span>Enter Workspace</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className={`border-t py-8 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-black ${isDark ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>M</div>
            <span className="text-xs font-medium text-slate-500">© {new Date().getFullYear()} Megha Engineering & Infrastructures Limited. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-semibold text-slate-500">
            <span className="hover:text-emerald-600 cursor-pointer transition">SEBI BRSR Guidance</span>
            <span className="hover:text-emerald-600 cursor-pointer transition">Internal ESG Security</span>
            <span className="hover:text-emerald-600 cursor-pointer transition">Support Helpdesk</span>
          </div>
        </div>
      </footer>

      {/* 16-Step Live Demo Modal */}
      <VerigraphPipelineDemo
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
      />
    </div>
  );
}
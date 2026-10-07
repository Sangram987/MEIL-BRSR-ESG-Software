import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, HardHat, Leaf, Truck, ShieldCheck, ChevronRight, Globe, Settings, Bell, HelpCircle, Moon, Sun } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { ROLE_META } from '../data/brsr';
import logo2 from '../assets/logo2.svg';
import GoogleTranslate from "../components/GoogleTranslate";
import video1 from "../Videos/video1.mp4";
import { Link } from "react-router-dom";

const PORTALS = [
  { role: 'admin', icon: Shield, title: 'Group ESG Admin', hover: 'hover:border-indigo-400 hover:shadow-indigo-100', chip: 'bg-indigo-50 border-indigo-100 text-indigo-600', text: 'Controller access. Manage the hierarchy, auto-consolidate approved data, map to BRSR and export SEBI reports.' },
  { role: 'manager', icon: Users, title: 'BU Manager', hover: 'hover:border-sky-400 hover:shadow-sky-100', chip: 'bg-sky-50 border-sky-100 text-sky-600', text: 'Review site submissions against evidence: approve, request correction or reject before data rolls up.' },
  { role: 'operator', icon: HardHat, title: 'Site Operator', hover: 'hover:border-green-400 hover:shadow-green-100', chip: 'bg-green-50 border-green-100 text-green-600', text: 'Ground-level access. Enter site metrics for P1–P9, attach evidence and submit for verification.' },
  { role: 'vendor', icon: Truck, title: 'Vendor / Contractor', hover: 'hover:border-violet-400 hover:shadow-violet-100', chip: 'bg-violet-50 border-violet-100 text-violet-600', text: 'Answer MEIL data requests for Scope 3 and value-chain disclosures with supporting evidence.' },
  { role: 'auditor', icon: ShieldCheck, title: 'Assessment / Assurance', hover: 'hover:border-amber-400 hover:shadow-amber-100', chip: 'bg-amber-50 border-amber-100 text-amber-600', text: 'Independent verification of approved BRSR Core data, vendor submissions and formal opinions.' },
];

export default function Home({ isDark, onToggleTheme }) {
  const navigate = useNavigate();
  const { user } = useApp();
  const enter = (role) => {
    if (user?.role === role) navigate(ROLE_META[role].home);
    else navigate('/login', { state: { role, from: ROLE_META[role].home } });
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-sky-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {/* Premium Top Navigation Bar */}
      <nav className={`sticky top-0 z-50 border-b backdrop-blur-md shadow-sm ${isDark ? 'border-slate-800 bg-slate-950/90' : 'border-slate-200 bg-white/80'}`}>
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">

          {/* Left: Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <div className="h-10 w-10 bg-linear-to-br from-green-500 to-sky-500 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-md"><img src={logo2} /> </div>
            <div>
              <span className={`block font-black tracking-wide leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>MEIL GROUP</span>
              <span className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>BRSR Hub</span>
            </div>
          </div>

          {/* Right: Settings, Language, & CTA */}
          <div className="flex items-center gap-6">
            <div className={`hidden items-center gap-5 border-r pr-6 md:flex ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>

              {/* Language Selector */}
              <GoogleTranslate />

              {/* Settings & Notifications */}
              <button className="hover:text-indigo-600 transition relative">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
              </button>
              <button
                onClick={() => navigate(user ? '/settings' : '/login')}
                className="hover:text-indigo-600 transition">
                <Settings size={20} />
              </button>
              <button className="hover:text-indigo-600 transition">
                <HelpCircle size={20} />
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              aria-pressed={isDark}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700 text-amber-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              {isDark ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <Link
              to="/login"
              className="rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 sm:px-6 sm:text-sm"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Full-width Hero Banner */}
      <section className="relative isolate flex min-h-125 items-center overflow-hidden bg-slate-950 sm:min-h-140">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        >
          {/* Using a highly reliable, open-source placeholder video that does not block access */}
          <source src={video1} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-slate-950/90 via-slate-950/65 to-slate-950/25" />
        <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-20">
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-green-100 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-300" />
              </span>
              Live Consolidation Engine
            </div>
            <h1 className="mb-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl">
              Sustainability <br className="hidden sm:block" />
              <span className="text-green-300">Built on Precision.</span>
            </h1>
            <p className="mb-9 max-w-2xl text-base leading-relaxed text-slate-100 sm:text-lg md:text-xl">
              The centralized platform for Megha Engineering and Infrastructures Limited to track, manage, and report UN SDG alignment and SEBI BRSR disclosures across 250+ global sites.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="#portals" className="rounded-lg bg-green-500 px-8 py-3.5 text-center text-sm font-bold text-slate-950 shadow-lg transition hover:bg-green-400">
                Enter Workspaces
              </a>
              <a href="https://www.sebi.gov.in" target="_blank" rel="noreferrer" className="rounded-lg border border-white/50 bg-white/10 px-8 py-3.5 text-center text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20">
                View SEBI Guidelines
              </a>
            </div>
            <div className="mt-8 inline-flex items-center gap-4 rounded-xl border border-white/20 bg-slate-950/45 p-4 text-left backdrop-blur-sm">
              <div className="rounded-lg bg-green-400/15 p-3 text-green-300">
                <Leaf size={24} />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-300">Corporate Target</p>
                <p className="text-lg font-black text-white">Net Zero 2030</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Impact Stats Banner */}
      <div className="max-w-7xl mx-auto px-6 mb-32 relative z-10 -mt-10 lg:mt-0">
        <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl border shadow-xl md:grid-cols-4 ${isDark ? 'border-slate-800 bg-slate-800 shadow-black/20' : 'border-slate-200 bg-slate-200 shadow-slate-200/50'}`}>
          <div className={`p-8 text-center transition ${isDark ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-slate-50'}`}>
            <div className="text-4xl font-black text-indigo-600 mb-2">250+</div>
            <div className={`text-xs uppercase tracking-wider font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Active Projects</div>
          </div>
          <div className={`p-8 text-center transition ${isDark ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-slate-50'}`}>
            <div className="text-4xl font-black text-sky-500 mb-2">9</div>
            <div className={`text-xs uppercase tracking-wider font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>BRSR Principles</div>
          </div>
          <div className={`p-8 text-center transition ${isDark ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-slate-50'}`}>
            <div className="text-4xl font-black text-green-500 mb-2">100%</div>
            <div className={`text-xs uppercase tracking-wider font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Traceability</div>
          </div>
          <div className={`p-8 text-center transition ${isDark ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-slate-50'}`}>
            <div className="text-4xl font-black text-cyan-600 mb-2">Tier 3</div>
            <div className={`text-xs uppercase tracking-wider font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Data Roll-up</div>
          </div>
        </div>
      </div>

      {/* Role-Based Portals */}
      <div id="portals" className="max-w-7xl mx-auto px-6 mb-32">
        <div className="text-center mb-12">
          <h2 className={`mb-4 text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Access Your Workspace</h2>
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Five roles, one approval chain: Site → BU Manager → Group ESG → Assurance, plus the vendor branch for Scope 3.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PORTALS.map((r) => (
            //all Portal button
            <button key={r.role} onClick={() => enter(r.role)} className={`group relative overflow-hidden rounded-2xl border p-7 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-gray-200'} ${r.hover}`}>
              <div className={`h-12 w-14 border rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${r.chip}`}><r.icon size={28} strokeWidth={2} /></div>
              <h3 className={`mb-2 flex items-center justify-between text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{r.title}<ChevronRight className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={20} /></h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{r.text}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className={`border-t py-10 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-black ${isDark ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>M</div>
            <span className="text-sm font-medium text-slate-500">© {new Date().getFullYear()} Megha Engineering & Infrastructures Limited.</span>
          </div>
          <div className="flex items-center gap-8 text-sm font-bold text-slate-400">
            <span className="hover:text-indigo-600 cursor-pointer transition">Internal Support</span>
            <span className="hover:text-indigo-600 cursor-pointer transition">Privacy Policy</span>
            <span className="hover:text-indigo-600 cursor-pointer transition">BRSR Documentation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
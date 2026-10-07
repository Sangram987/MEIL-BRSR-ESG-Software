import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Shield, Users, HardHat, Truck, ShieldCheck, ArrowLeft, RotateCcw, Eye, EyeOff, LockKeyhole, Leaf, LoaderCircle } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { ROLE_META } from '../data/brsr';

const ROLES = [
  { id: 'admin', icon: Shield, accent: 'text-emerald-800 bg-emerald-100', text: 'Group reporting, BRSR mapping and consolidated disclosures.' },
  { id: 'manager', icon: Users, accent: 'text-sky-800 bg-sky-100', text: 'Review site submissions, evidence and approvals.' },
  { id: 'operator', icon: HardHat, accent: 'text-amber-800 bg-amber-100', text: 'Enter site ESG data and submit supporting evidence.' },
  { id: 'vendor', icon: Truck, accent: 'text-orange-800 bg-orange-100', text: 'Respond to MEIL value-chain data requests.' },
  { id: 'auditor', icon: ShieldCheck, accent: 'text-teal-800 bg-teal-100', text: 'Assure approved BRSR Core data and vendor submissions.' },
];

export default function Login() {
  const { actions, auth, toast } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const routeRole = Object.keys(ROLE_META).find((id) => loc.pathname === ROLE_META[id].home || loc.pathname.startsWith(`${ROLE_META[id].home}/`));
  const requestedRole = loc.state?.role || Object.keys(ROLE_META).find((id) => loc.state?.from === ROLE_META[id].home || loc.state?.from?.startsWith(`${ROLE_META[id].home}/`)) || routeRole;
  const [role, setRole] = useState(requestedRole || 'admin');
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const selected = ROLES.find((item) => item.id === role);
  const RoleIcon = selected.icon;

  const finishLogin = () => {
    const from = loc.state?.from;
    nav(from && (from === ROLE_META[role].home || from.startsWith(`${ROLE_META[role].home}/`)) ? from : ROLE_META[role].home, { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await auth.register({
          name: form.name,
          email: form.email,
          password: form.password,
          role,
        });
      } else {
        await auth.login({
          email: form.email,
          password: form.password,
          role,
        });
      }

      finishLogin();
    } catch (authError) {
      setError(
        authError.message ||
        'Unable to authenticate. Please try again.'
      );
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f5ef] p-3 sm:p-6 lg:p-10">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_-32px_rgba(15,48,40,0.35)] lg:min-h-[min(760px,calc(100vh-5rem))] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden min-h-160 flex-col justify-between overflow-hidden bg-[#123d34] p-10 text-white lg:flex xl:p-14">
          <img src="https://media.gettyimages.com/id/1239203748/photo/inside-a-meil-oil-rig-manufacturing-plant-in-india.jpg?s=612x612&w=gi&k=20&c=YG3SjCC70g4NTOSrUSktpyn-eD_Mf_jyD3GxubaEV-c=" alt="MEIL infrastructure project" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-linear-to-b from-[#123d34]/75 via-[#123d34]/65 to-[#123d34]" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d8f36a] text-lg font-black text-[#123d34]">M</div>
            <div><p className="text-sm font-extrabold tracking-wide">MEIL GROUP</p><p className="mt-0.5 text-[10px] font-bold uppercase text-white/65">BRSR Hub</p></div>
          </div>
          <div className="relative z-10 max-w-md pb-8">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-[#d8f36a]"><Leaf size={26} /></div>
            <p className="mb-4 text-xs font-bold uppercase text-[#d8f36a]">Responsible growth, built together</p>
            <h1 className="text-4xl font-semibold leading-tight xl:text-5xl">Every site.<br />One clear picture.</h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/75">A shared workspace for the people who collect, review and assure our sustainability data.</p>
          </div>
          <div className="relative z-10 flex items-center justify-between border-t border-white/20 pt-5 text-xs text-white/55"><span>MEIL Sustainability Reporting</span><span>FY 2026–27</span></div>
        </section>

        <section className="flex min-h-160 flex-col px-6 py-7 sm:px-10 sm:py-9 lg:px-14 lg:py-11 xl:px-20">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#123d34]"><ArrowLeft size={16} /> Home</Link>
            <button onClick={() => { if (window.confirm('Reset all demo data to the initial seed?')) { actions.reset(); toast('Demo data reset.'); } }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-rose-600"><RotateCcw size={13} /> Reset demo</button>
          </div>

          <div className="mx-auto my-auto w-full max-w-md py-10 animate-in slide-in-from-bottom-4">
            <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${selected.accent}`}><RoleIcon size={23} /></div>
            <p className="mb-2 text-xs font-bold uppercase text-[#527367]">MEIL BRSR Hub</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset your password'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{mode === 'forgot' ? 'Enter your work email to get help recovering access to your account.' : selected.text}</p>

            {(!requestedRole || mode === 'register') && mode !== 'forgot' && <label className="mt-6 block text-sm font-semibold text-slate-700">{mode === 'register' ? 'Register as' : 'Portal'}<select value={role} onChange={(event) => { setRole(event.target.value); setError(''); }} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#527367] focus:ring-2 focus:ring-[#527367]/15">{ROLES.map((item) => <option key={item.id} value={item.id}>{ROLE_META[item.id].label}</option>)}</select></label>}

            {mode !== 'forgot' && <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Authentication mode">
              {[['login', 'Sign in'], ['register', 'Register']].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => { setMode(value); setError(''); }} className={`h-10 rounded-md text-sm font-semibold transition ${mode === value ? 'bg-white text-[#123d34] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
            </div>}

            <form onSubmit={(event) => {
              if (mode !== 'forgot') return submit(event);
              event.preventDefault();
              setError('');
              setRecoveryMessage('Password recovery is not configured in this local demo. Please contact your system administrator.');
            }} className="mt-5 space-y-4">
              {mode === 'register' && <label className="block text-sm font-semibold text-slate-700">Full name<input required autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-3.5 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#527367] focus:ring-2 focus:ring-[#527367]/15" placeholder="Your full name" /></label>}
              <label className="block text-sm font-semibold text-slate-700">Work email<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-3.5 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#527367] focus:ring-2 focus:ring-[#527367]/15" placeholder="name@company.com" /></label>
              {mode !== 'forgot' && <label className="block text-sm font-semibold text-slate-700"><span className="flex items-center justify-between">Password{mode === 'login' && <button type="button" onClick={() => { setMode('forgot'); setError(''); setRecoveryMessage(''); }} className="text-xs font-semibold text-[#527367] transition hover:text-[#123d34]">Forgot password?</button>}</span><div className="relative mt-2"><input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="h-12 w-full rounded-lg border border-slate-200 px-3.5 pr-11 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#527367] focus:ring-2 focus:ring-[#527367]/15" placeholder="At least 8 characters" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-700">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
              {mode === 'register' && <label className="block text-sm font-semibold text-slate-700">Confirm password<input required minLength={8} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-3.5 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#527367] focus:ring-2 focus:ring-[#527367]/15" placeholder="Enter your password again" /></label>}
              {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">{error}</p>}
              {recoveryMessage && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm font-medium text-amber-800">{recoveryMessage}</p>}
              <button disabled={busy} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#123d34] px-4 text-sm font-bold text-white transition hover:bg-[#1b594b] disabled:cursor-wait disabled:opacity-70">{busy ? <LoaderCircle size={17} className="animate-spin" /> : <LockKeyhole size={16} />}{mode === 'login' ? 'Sign in to portal' : mode === 'register' ? 'Create account' : 'Request password help'}</button>
            </form>

            {mode === 'forgot' && <button type="button" onClick={() => { setMode('login'); setError(''); setRecoveryMessage(''); }} className="mt-5 w-full text-center text-sm font-semibold text-[#527367] transition hover:text-[#123d34]">Back to sign in</button>}
            <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">Local demo authentication only. Use a server-backed identity provider before production.</p>
          </div>
          <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} MEIL · BRSR Reporting Workspace</p>
        </section>
      </div>
    </main>
  );
}

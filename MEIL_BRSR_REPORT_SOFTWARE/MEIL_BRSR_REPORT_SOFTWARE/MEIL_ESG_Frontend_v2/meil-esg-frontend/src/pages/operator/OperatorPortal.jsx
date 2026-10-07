import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Flame, Droplets, ShieldPlus, AlertOctagon, UploadCloud, ChevronRight, Clock } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { PRINCIPLES, CURRENT_PERIOD, periodLabel } from '../../data/brsr';
import { StatusBadge, Card, Progress, dt } from '../../components/ui';

const QUICK = [
  { label: 'Log fuel / emissions', to: 'P6', icon: Flame, c: 'amber' }, { label: 'Log water usage', to: 'P6', icon: Droplets, c: 'sky' },
  { label: 'Log safety incident', to: 'P3', icon: ShieldPlus, c: 'rose' }, { label: 'Upload utility bills', to: 'P6', icon: UploadCloud, c: 'indigo', dashed: true },
];
const TONE = { amber: 'hover:border-amber-400 hover:bg-amber-50 bg-amber-100 text-amber-600', sky: 'hover:border-sky-400 hover:bg-sky-50 bg-sky-100 text-sky-600', rose: 'hover:border-rose-400 hover:bg-rose-50 bg-rose-100 text-rose-600', indigo: 'hover:border-indigo-400 hover:bg-indigo-50 bg-indigo-100 text-indigo-600' };

export default function OperatorPortal() {
  const { user, org, calc } = useApp();
  const navigate = useNavigate();
  const project = org.projects.find((p) => p.id === user.projectId);
  const status = calc.projectStatus(project.id, CURRENT_PERIOD);
  const mine = calc.submissions.filter((s) => s.projectId === project.id);
  const done = Object.values(status).filter((s) => s === 'approved' || s === 'submitted').length;
  const score = Math.round((done / PRINCIPLES.length) * 100);
  const fixes = mine.filter((s) => (s.status === 'correction_required' || s.status === 'rejected') && s.period === CURRENT_PERIOD);
  const activity = mine.flatMap((s) => s.history.map((h) => ({ ...h, s }))).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
  const go = (p) => navigate(`/operator/data-entry?principle=${p}`);
  const cta = { none: 'Enter data', draft: 'Continue draft', correction_required: 'Fix & re-submit', rejected: 'Fix & re-submit', submitted: 'View', approved: 'View' };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-lg text-white relative overflow-hidden">
        <HardHat size={250} className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-bold mb-3 border border-emerald-500/30">Active site workspace</div>
            <h1 className="text-3xl font-black tracking-tight mb-1">{project.name}</h1>
            <p className="text-sm text-slate-400">{calc.buById.get(project.buId).name} · {calc.subById.get(project.subId).name} · {user.name} · {periodLabel(CURRENT_PERIOD)}</p>
          </div>
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 min-w-[260px]">
            <p className="text-xs font-bold text-slate-400 mb-1">Monthly BRSR reporting · due 5 Oct 2026</p>
            <div className="flex items-center gap-3"><span className="text-3xl font-black text-emerald-400">{score}%</span><div className="flex-1"><Progress value={score} className="!bg-slate-700" /></div></div>
            <p className="text-[11px] text-slate-400 mt-1">{done} of 9 principles submitted or approved</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {QUICK.map((q) => (
              <button key={q.label} onClick={() => go(q.to)} className={`bg-white border-2 border-slate-200 ${TONE[q.c].split(' ').slice(0, 2).join(' ')} rounded-2xl p-4 flex flex-col items-center gap-3 transition shadow-sm ${q.dashed ? 'border-dashed' : ''}`}>
                <span className={`h-12 w-12 rounded-full flex items-center justify-center ${TONE[q.c].split(' ').slice(2).join(' ')}`}><q.icon size={24} /></span>
                <span className="text-xs font-bold text-slate-700 text-center">{q.label}</span>
              </button>
            ))}
          </div>

          {fixes.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-3">
              <h2 className="text-xs font-bold text-rose-800 flex items-center gap-2"><AlertOctagon size={16} /> Needs correction ({fixes.length})</h2>
              {fixes.map((f) => (
                <div key={f.id} className="bg-white border border-rose-100 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div><p className="text-sm font-bold text-slate-900">{f.principle} · {PRINCIPLES.find((p) => p.id === f.principle).label}</p><p className="text-xs text-slate-600 mt-1">{f.reviewer?.name}: “{f.reviewer?.comment}”</p></div>
                  <button onClick={() => go(f.principle)} className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-lg">Fix & re-submit</button>
                </div>
              ))}
            </div>
          )}

          <Card pad={false}>
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center"><h2 className="text-sm font-bold text-slate-900">{periodLabel(CURRENT_PERIOD)} checklist</h2><button onClick={() => navigate('/operator/data-entry')} className="text-xs font-bold text-blue-600 flex items-center gap-1">Open full form <ChevronRight size={14} /></button></div>
            <ul className="divide-y divide-slate-100">
              {PRINCIPLES.map((p) => (
                <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-[10px] font-black bg-slate-100 text-slate-600 rounded px-2 py-1 w-9 text-center">{p.id}</span>
                  <span className="flex-1 text-sm font-semibold text-slate-800">{p.label}</span>
                  <StatusBadge status={status[p.id]} />
                  <button onClick={() => go(p.id)} className="text-xs font-bold text-blue-600 hover:text-blue-800 w-28 text-right">{cta[status[p.id]]}</button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card>
          <h2 className="text-sm font-bold text-slate-900 mb-5">Recent activity</h2>
          {activity.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
          <div className="relative border-l-2 border-slate-100 ml-3 space-y-6">
            {activity.map((a, i) => (
              <div key={i} className="relative pl-6">
                <span className={`absolute -left-[9px] top-0.5 h-4 w-4 rounded-full border-2 bg-white ${/APPROVED|ASSURED/.test(a.action) ? 'border-emerald-500' : /CORRECTION|REJECT|EXCEPTION/.test(a.action) ? 'border-rose-500' : 'border-amber-500'}`} />
                <p className="text-xs font-bold text-slate-900">{a.s.principle} · {a.action.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{a.note || `${periodLabel(a.s.period)} · by ${a.by}`}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><Clock size={10} /> {dt(a.at)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

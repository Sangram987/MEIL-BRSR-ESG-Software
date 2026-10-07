import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, ClipboardCheck, AlertTriangle, Activity, MapPin } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import StatCard from '../../components/StatCard';
import { useApp } from '../../store/AppStore';
import { CURRENT_PERIOD, periodLabel, shortMonth } from '../../data/brsr';
import { validateValues } from '../../lib/validate';
import { Card, CardHeader, Btn, Badge, StatusBadge, Progress } from '../../components/ui';

export default function ManagerPortal() {
  const { user, calc, ui, org, actions, toast } = useApp();
  const nav = useNavigate();
  const bu = calc.buById.get(user.buId);
  const scope = { level: 'bu', id: user.buId };
  const projects = org.projects.filter((p) => p.buId === user.buId);
  const cov = calc.coverage(scope, CURRENT_PERIOD, ui.boundary);
  const mine = calc.submissions.filter((s) => calc.projById.get(s.projectId)?.buId === user.buId);
  const queue = mine.filter((s) => s.status === 'submitted');
  const flagged = queue.filter((s) => { const r = validateValues({ principle: s.principle, values: s.values, project: calc.projById.get(s.projectId), period: s.period, calc }); return r.errors.length + r.warnings.length > 0; }).length;
  const series = useMemo(() => calc.monthlyTotals(scope, ui.fy, ui.boundary, ['p6_dg', 'p6_mach', 'p6_petrol', 'p6_grid']).map((r) => ({ month: shortMonth(r.period), scope1: Math.round(((r.p6_dg + r.p6_mach) * 2.68 + r.p6_petrol * 2.31) / 1000), scope2: Math.round((r.p6_grid * 0.71) / 1000) })), [calc, ui]); // eslint-disable-line
  const attention = projects.filter((p) => { const st = Object.values(calc.projectStatus(p.id, CURRENT_PERIOD)); return st.some((s) => s === 'correction_required' || s === 'draft'); });
  const submissionRate = Math.round(((cov.counts.approved + cov.counts.submitted) / cov.expected) * 100);
  const remind = (p) => { actions.remind({ projectId: p.id, text: `${periodLabel(CURRENT_PERIOD)} data is incomplete — please finish and submit by 5 Oct.`, entity: p.name, actor: { name: user.name, role: user.role } }); toast(`Reminder sent to ${p.name}.`); };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900 tracking-tight">{bu.name}</h1><p className="text-sm text-slate-500 mt-1">{calc.subById.get(bu.subId).name} · manage site submissions and verify data before it rolls up to Group.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active sites" value={projects.length} unit="in this business unit" icon={MapPin} color="sky" />
        <StatCard title="Pending reviews" value={queue.length} unit="require your approval" icon={ClipboardCheck} color="amber" />
        <StatCard title="Flagged packets" value={flagged} unit="have system warnings" icon={AlertTriangle} color="rose" />
        <StatCard title={`${shortMonth(CURRENT_PERIOD)} submission rate`} value={`${submissionRate}%`} unit={`${cov.counts.approved} approved · ${cov.counts.submitted} submitted`} icon={Activity} color="emerald" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card pad={false} className="lg:col-span-2">
          <CardHeader title="BU emissions trend" subtitle={`Approved data · ${ui.fy} · tCO2e (illustrative factors)`} />
          <div className="h-72 p-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{ left: -10, right: 10, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / .12)' }} /><Legend iconType="circle" />
            <Area type="monotone" dataKey="scope1" name="Scope 1" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.15} strokeWidth={2.5} /><Area type="monotone" dataKey="scope2" name="Scope 2" stroke="#6366f1" fill="#6366f1" fillOpacity={0.12} strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div>
        </Card>
        <Card pad={false}>
          <CardHeader title="Data completeness" subtitle={periodLabel(CURRENT_PERIOD)} />
          <div className="p-5 space-y-3">
            <div className="flex justify-between text-sm font-bold"><span>Approved</span><span>{cov.pct}%</span></div><Progress value={cov.pct} />
            {[['submitted', 'Awaiting your review'], ['correction_required', 'With site for correction'], ['draft', 'Draft only'], ['none', 'Not started']].map(([k, l]) => <div key={k} className="flex justify-between text-sm"><span className="text-slate-600 flex items-center gap-2"><StatusBadge status={k} /></span><b>{cov.counts[k] || 0}</b></div>)}
            <p className="text-[11px] text-slate-400">Counts are site × principle packets ({projects.length} sites × 9).</p>
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col justify-between">
          <div><div className="flex items-center gap-3 mb-3"><div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><ClipboardCheck size={24} /></div><h3 className="text-lg font-bold text-slate-900">Review site submissions</h3></div>
            <p className="text-slate-500 text-sm mb-5">Check values against utility bills and logs; approve, send back for correction, or reject.</p></div>
          <Btn tone="dark" onClick={() => nav('/manager/approvals')}>Open review queue ({queue.length})</Btn>
        </Card>
        <Card className="flex flex-col justify-between">
          <div><div className="flex items-center gap-3 mb-3"><div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileSpreadsheet size={24} /></div><h3 className="text-lg font-bold text-slate-900">Enter data on behalf of a site</h3></div>
            <p className="text-slate-500 text-sm mb-5">For sites without connectivity. Entries are flagged as manager-entered in the audit trail.</p></div>
          <Btn tone="ghost" onClick={() => nav('/manager/data-entry')}>Launch data capture form</Btn>
        </Card>
      </div>
      <Card pad={false}>
        <CardHeader title="Sites needing attention" subtitle="Corrections outstanding or draft-only this month" right={<Btn tone="ghost" className="!py-1.5 !text-xs" onClick={() => nav('/manager/sites')}>All sites</Btn>} />
        {attention.length === 0 ? <p className="p-6 text-sm text-slate-500">All sites are on track.</p> : (
          <ul className="divide-y divide-slate-100">{attention.slice(0, 6).map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-center gap-3"><span className="flex-1 font-semibold text-sm text-slate-800">{p.name}<span className="block text-xs text-slate-500 font-normal">{p.state}</span></span>
              {Object.values(calc.projectStatus(p.id, CURRENT_PERIOD)).some((s) => s === 'correction_required') && <Badge tone="rose">Correction pending</Badge>}<Btn tone="ghost" className="!py-1 !text-xs" onClick={() => remind(p)}>Send reminder</Btn></li>))}</ul>)}
      </Card>
    </div>
  );
}

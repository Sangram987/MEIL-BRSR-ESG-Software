import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { PRINCIPLES, openPeriods, periodLabel } from '../../data/brsr';
import { Card, PageHeader, Table, inputCls, Btn, Badge } from '../../components/ui';

const DOT = { approved: 'bg-emerald-500', submitted: 'bg-amber-400', correction_required: 'bg-rose-500', rejected: 'bg-rose-600', draft: 'bg-slate-400', none: 'bg-slate-200' };

export default function BuSites() {
  const { user, org, calc, actions, toast } = useApp();
  const [period, setPeriod] = useState('2026-09');
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(false);
  const rows = org.projects.filter((p) => p.buId === user.buId && p.name.toLowerCase().includes(q.toLowerCase()))
    .map((p) => { const st = calc.projectStatus(p.id, period); return { p, st, ok: Object.values(st).filter((s) => s === 'approved').length }; })
    .filter((r) => !only || r.ok < 9);
  const remind = (p) => { actions.remind({ projectId: p.id, text: `${periodLabel(period)} data is incomplete.`, entity: p.name, actor: { name: user.name, role: user.role } }); toast(`Reminder sent to ${p.name}.`); };
  return (
    <div className="space-y-6">
      <PageHeader title="BU sites" subtitle="Per-principle submission status for every site in your business unit. Each dot is one BRSR principle (P1 → P9)." />
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input className={`${inputCls} !pl-9 !w-64`} placeholder="Search site…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={`${inputCls} !w-44`} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">{openPeriods().map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}</select>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Incomplete only</label>
        <div className="ml-auto hidden md:flex gap-3 text-[11px] font-semibold text-slate-500">{[['approved', 'Approved'], ['submitted', 'Submitted'], ['correction_required', 'Correction'], ['draft', 'Draft'], ['none', 'None']].map(([k, l]) => <span key={k} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${DOT[k]}`} />{l}</span>)}</div>
      </div>
      <Card pad={false}>
        <Table head={['Site', 'State', 'P1 – P9', { label: 'Approved', right: true }, '']}>
          {rows.map(({ p, st, ok }) => (
            <tr key={p.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-900">{p.name}{p.live && <Badge tone="blue" className="ml-2">Live</Badge>}</td><td className="px-4 py-3 text-slate-500">{p.state}</td>
              <td className="px-4 py-3"><div className="flex gap-1">{PRINCIPLES.map((pr) => <span key={pr.id} title={`${pr.id}: ${st[pr.id]}`} className={`h-3 w-3 rounded-full ${DOT[st[pr.id]]}`} />)}</div></td>
              <td className="px-4 py-3 text-right font-bold tabular-nums">{ok}/9</td><td className="px-4 py-3 text-right">{ok < 9 && <Btn tone="ghost" className="!py-1 !text-xs" onClick={() => remind(p)}>Remind</Btn>}</td></tr>
          ))}
        </Table>
        {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No sites match.</p>}
      </Card>
    </div>
  );
}

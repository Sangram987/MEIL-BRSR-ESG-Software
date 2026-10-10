import React, { useState } from 'react';
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';
import HierarchyFilter from '../../components/HierarchyFilter';
import { useApp } from '../../store/AppStore';
import { PRINCIPLES, CORE_ATTRS, INDICATORS } from '../../data/brsr';
import { fmt } from '../../lib/consolidate';
import { Card, CardHeader, PageHeader, Badge, Tabs, Table } from '../../components/ui';

export default function BrsrMapping() {
  const { calc, ui, state } = useApp();
  const [tab, setTab] = useState('core');
  const node = calc.nodeTotals(ui.scope, ui.fy, ui.boundary);
  const ops = state.assuranceOpinions[ui.fy] || {};
  const all = Object.values(INDICATORS);
  const coverage = PRINCIPLES.map((p) => { const ess = p.indicators.filter((i) => !i.lead); const filled = ess.filter((i) => node.t[i.id] > 0 || i.kind === 'stock' && node.t[i.id] > 0 || node.reporting > 0 && i.typ < 1).length; return { p, ess: ess.length, lead: p.indicators.length - ess.length, filled }; });
  return (
    <div className="space-y-6">
      <PageHeader title="BRSR Mapping" subtitle="Mapping of captured indicators to SEBI BRSR Section C principles, Core attributes, and UN SDGs." />
      <HierarchyFilter showProject={false} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'core', label: 'BRSR Core (9 attributes)', icon: ShieldCheck }, { id: 'principles', label: 'Principles P1–P9' }, { id: 'fields', label: 'Field dictionary' }]} />
      {tab === 'core' && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CORE_ATTRS.map((a, n) => {
            const fields = all.filter((i) => i.core === a.id); const op = ops[a.id];
            return (
              <Card key={a.id} className="flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2"><div><p className="text-xs font-bold text-slate-400">Attribute {n + 1}</p><h3 className="font-bold text-slate-900">{a.label}</h3></div>{op ? <Badge tone="emerald"><CheckCircle2 size={11} /> {op.status}</Badge> : <Badge tone="amber"><Circle size={11} /> Pending</Badge>}</div>
                <div className="flex flex-wrap gap-1">{a.sdg.map((s) => <Badge key={s} tone="sky">SDG {s}</Badge>)}</div>
                {a.site ? <ul className="text-xs text-slate-600 space-y-1">{fields.slice(0, 5).map((f) => <li key={f.id} className="flex justify-between gap-2"><span className="truncate">{f.label.trim()}</span><b className="tabular-nums">{fmt(node.t[f.id], 0)}</b></li>)}{fields.length > 5 && <li className="text-slate-400">+ {fields.length - 5} more fields</li>}</ul>
                  : <p className="text-xs text-slate-500">Financial attribute captured in Group Section A & B.</p>}
              </Card>);
          })}
        </div>)}
      {tab === 'principles' && (
        <Card pad={false}><CardHeader title="Principle coverage" subtitle="Indicators captured in this portal" />
          <Table head={['Principle', 'Pillar', 'SDGs', { label: 'Essential', right: true }, { label: 'Leadership', right: true }, 'Core fields']}>
            {coverage.map(({ p, ess, lead }) => (<tr key={p.id}><td className="px-4 py-3 font-bold"><Badge>{p.id}</Badge> {p.label}</td><td className="px-4 py-3">{{ E: 'Environmental', S: 'Social', G: 'Governance' }[p.pillar]}</td><td className="px-4 py-3">{p.sdg.map((s) => <Badge key={s} tone="sky" className="mr-1">{s}</Badge>)}</td><td className="px-4 py-3 text-right tabular-nums">{ess}</td><td className="px-4 py-3 text-right tabular-nums">{lead}</td><td className="px-4 py-3">{p.indicators.filter((i) => i.core).length || '–'}</td></tr>))}
          </Table></Card>)}
      {tab === 'fields' && (
        <Card pad={false}><CardHeader title={`${all.length} captured indicators`} subtitle="Aggregated for the selected scope" />
          <div className="max-h-[600px] overflow-y-auto"><Table head={['Indicator', 'Principle', 'Tier', 'Core attribute', 'Unit', { label: ui.fy, right: true }]}>
            {all.map((i) => (<tr key={i.id}><td className="px-4 py-2.5">{i.label.trim()}</td><td className="px-4 py-2.5"><Badge>{i.principle}</Badge></td><td className="px-4 py-2.5 text-xs">{i.lead ? 'Leadership' : 'Essential'}</td><td className="px-4 py-2.5 text-xs">{i.core ? CORE_ATTRS.find((a) => a.id === i.core).label : '–'}</td><td className="px-4 py-2.5 text-xs text-slate-500">{i.unit}</td><td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmt(node.t[i.id], 1)}</td></tr>))}
          </Table></div></Card>)}
    </div>
  );
}

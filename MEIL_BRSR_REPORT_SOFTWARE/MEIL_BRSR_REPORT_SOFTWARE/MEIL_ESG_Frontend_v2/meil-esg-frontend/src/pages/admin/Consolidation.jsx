import React from 'react';
import { ArrowRight, CheckCircle2, MinusCircle, ChevronRight, Sigma } from 'lucide-react';
import HierarchyFilter from '../../components/HierarchyFilter';
import { useApp } from '../../store/AppStore';
import { PRINCIPLES, CURRENT_PERIOD, periodLabel } from '../../data/brsr';
import { fmt, compact } from '../../lib/consolidate';
import { scopeName, boundaryLabel } from '../../lib/exporters';
import { Card, CardHeader, PageHeader, Badge, Progress, Table } from '../../components/ui';

const LEVELS = ['Approved project data', 'Business unit', 'Subsidiary', 'MEIL Group', 'BRSR indicators'];

export default function Consolidation() {
  const { calc, ui, org, actions } = useApp();
  const { scope, boundary, fy } = ui;
  const node = calc.nodeTotals(scope, fy, boundary);
  const rows = calc.rollup(scope, fy, boundary);
  const inc = rows.filter((r) => !r.excluded);
  const sum = (k) => inc.reduce((a, r) => a + r.kpi[k], 0);
  const checks = [['ghg', 'Scope 1+2 (tCO2e)'], ['energyGJ', 'Energy (GJ)'], ['waterWithdrawn', 'Water (KL)'], ['waste', 'Waste (MT)']].map(([k, l]) => ({ k, l, parent: node.kpi[k], kids: sum(k), diff: node.kpi[k] - sum(k) }));
  const reconciled = rows.length === 0 || checks.every((c) => Math.abs(c.diff) < 0.01 * Math.max(1, c.parent));
  const both = ['standalone', 'consolidated'].map((mode) => ({ mode, ...calc.nodeTotals(scope, fy, { ...boundary, mode }) }));
  const byPrinciple = PRINCIPLES.map((p) => { let ok = 0; const list = calc.projectsIn(scope, boundary); list.forEach((pr) => { if (calc.projectStatus(pr.id, CURRENT_PERIOD)[p.id] === 'approved') ok += 1; }); return { p, ok, total: list.length }; });
  const drill = (r) => { if (r.level !== 'project' && !r.excluded) actions.setScope({ level: r.level, id: r.id }); };
  const up = () => { if (scope.level === 'project') { const p = org.projects.find((x) => x.id === scope.id); actions.setScope({ level: 'bu', id: p.buId }); } else if (scope.level === 'bu') actions.setScope({ level: 'sub', id: org.bus.find((b) => b.id === scope.id).subId }); else if (scope.level === 'sub') actions.setScope({ level: 'group', id: 'meil' }); };

  return (
    <div className="space-y-6">
      <PageHeader badge={<><Sigma size={14} /> Auto-consolidation engine</>} title="Consolidation" subtitle="Nobody adds numbers by hand. Pick a scope and boundary — the system sums BU-approved project data up the hierarchy and reconciles every level." />
      <HierarchyFilter />
      <Card className="!p-4"><ol className="flex flex-wrap items-center gap-2 text-xs font-bold">{LEVELS.map((l, i) => <React.Fragment key={l}><li className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">{l}</li>{i < LEVELS.length - 1 && <ChevronRight size={14} className="text-slate-400" />}</React.Fragment>)}</ol>
        <p className="text-xs text-slate-500 mt-3">Boundary: <b>{boundaryLabel(boundary)}</b> — applied consistently to every figure on this screen, as BRSR requires.</p></Card>

      <Card pad={false}>
        <CardHeader title={`${scopeName(org, scope)} — ${scope.level === 'group' ? 'subsidiaries' : scope.level === 'sub' ? 'business units' : scope.level === 'bu' ? 'projects' : 'project'}`} subtitle={`${fy} · ${node.projects} projects in scope, ${node.reporting} with data · click a row to drill down`}
          right={scope.level !== 'group' && <button onClick={up} className="text-xs font-bold text-blue-600 hover:text-blue-800">↑ Up one level</button>} />
        {rows.length === 0 ? <p className="p-8 text-sm text-slate-500 text-center">A single project is selected. Choose a business unit to compare its projects.</p> : (
          <Table head={['Entity', { label: 'Sites', right: true }, { label: 'Scope 1', right: true }, { label: 'Scope 2', right: true }, { label: 'Energy GJ', right: true }, { label: 'Water KL', right: true }, { label: 'Waste MT', right: true }, { label: 'Workforce', right: true }, { label: 'LTIFR', right: true }]}>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => drill(r)} className={`${r.excluded ? 'opacity-40' : r.level !== 'project' ? 'cursor-pointer hover:bg-blue-50/40' : ''}`}>
                <td className="px-4 py-3"><div className="font-bold text-slate-900 flex items-center gap-2">{r.name}{r.level !== 'project' && !r.excluded && <ArrowRight size={13} className="text-slate-300" />}</div><div className="text-[11px] text-slate-500">{r.excluded ? 'Outside selected boundary' : r.tag}</div></td>
                <td className="px-4 py-3 text-right tabular-nums">{r.projects}</td>
                <td className="px-4 py-3 text-right tabular-nums">{compact(r.kpi.scope1)}</td><td className="px-4 py-3 text-right tabular-nums">{compact(r.kpi.scope2)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{compact(r.kpi.energyGJ)}</td><td className="px-4 py-3 text-right tabular-nums">{compact(r.kpi.waterWithdrawn)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{compact(r.kpi.waste)}</td><td className="px-4 py-3 text-right tabular-nums">{compact(r.kpi.headcount)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(r.kpi.ltifr, 2)}</td>
              </tr>))}
            <tr className="bg-slate-900 text-white font-black"><td className="px-4 py-3">Total — {scopeName(org, scope)}</td><td className="px-4 py-3 text-right">{node.projects}</td>
              <td className="px-4 py-3 text-right">{compact(node.kpi.scope1)}</td><td className="px-4 py-3 text-right">{compact(node.kpi.scope2)}</td><td className="px-4 py-3 text-right">{compact(node.kpi.energyGJ)}</td><td className="px-4 py-3 text-right">{compact(node.kpi.waterWithdrawn)}</td><td className="px-4 py-3 text-right">{compact(node.kpi.waste)}</td><td className="px-4 py-3 text-right">{compact(node.kpi.headcount)}</td><td className="px-4 py-3 text-right">{fmt(node.kpi.ltifr, 2)}</td></tr>
          </Table>)}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card pad={false}>
          <CardHeader title="Reconciliation check" subtitle="Parent total vs Σ children" right={reconciled ? <Badge tone="emerald"><CheckCircle2 size={12} /> Reconciled</Badge> : <Badge tone="rose">Mismatch</Badge>} />
          <ul className="divide-y divide-slate-100 text-sm">{checks.map((c) => <li key={c.k} className="px-5 py-3 flex justify-between"><span className="text-slate-600">{c.l}</span><span className="tabular-nums font-bold">{rows.length ? `Δ ${fmt(c.diff, 2)}` : '–'}</span></li>)}</ul>
        </Card>
        <Card pad={false}>
          <CardHeader title="Boundary impact" subtitle="Same scope, two boundaries" />
          <div className="p-5 space-y-3 text-sm">{both.map((b) => <div key={b.mode} className={`flex justify-between items-center p-3 rounded-lg border ${boundary.mode === b.mode ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}><span className="font-semibold capitalize">{b.mode}<span className="block text-[11px] text-slate-500 font-normal">{b.projects} sites</span></span><span className="font-black tabular-nums">{compact(b.kpi.ghg)} <span className="text-[11px] font-medium text-slate-400">tCO2e</span></span></div>)}</div>
        </Card>
        <Card pad={false}>
          <CardHeader title={`${periodLabel(CURRENT_PERIOD)} approvals by principle`} subtitle="Sites with approved packet" />
          <div className="p-5 space-y-2.5">{byPrinciple.map(({ p, ok, total }) => <div key={p.id} className="flex items-center gap-3 text-xs"><span className="w-7 font-black text-slate-500">{p.id}</span><div className="flex-1"><Progress value={total ? (ok / total) * 100 : 0} tone="blue" /></div><span className="w-14 text-right tabular-nums text-slate-600 font-bold">{ok}/{total}</span></div>)}</div>
        </Card>
      </div>
      <p className="text-[11px] text-slate-400 flex items-center gap-1"><MinusCircle size={12} /> Demo data: history is a deterministic seed dataset; live packets you submit/approve overwrite the matching site-month.</p>
    </div>
  );
}

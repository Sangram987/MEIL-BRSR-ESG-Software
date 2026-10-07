import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, AlertTriangle, Brain, TrendingDown, Zap, FileWarning } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import HierarchyFilter from '../../components/HierarchyFilter';
import { useApp } from '../../store/AppStore';
import { fyMonths, shortMonth, EF } from '../../data/brsr';
import { validateValues } from '../../lib/validate';
import { fmt } from '../../lib/consolidate';
import { Card, CardHeader, PageHeader, Badge, Btn } from '../../components/ui';

// Forecast = linear trend of the last 12 approved months (least-squares). Statistical, not ML.
function forecast(series, ahead = 3) {
  const n = series.length; if (n < 4) return [];
  const xs = series.map((_, i) => i), my = series.reduce((a, b) => a + b, 0) / n, mx = (n - 1) / 2;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (series[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return Array.from({ length: ahead }, (_, k) => Math.max(0, my + slope * (n + k - mx)));
}

export default function AiInsights() {
  const { calc, ui } = useApp();
  const nav = useNavigate();
  const scope = ui.scope;
  const data = useMemo(() => {
    const months = [...fyMonths('FY 2025-26'), ...fyMonths('FY 2026-27')];
    const rows = calc.monthlyTotals(scope, 'FY 2025-26', ui.boundary, ['p6_dg', 'p6_mach', 'p6_petrol']).concat(calc.monthlyTotals(scope, 'FY 2026-27', ui.boundary, ['p6_dg', 'p6_mach', 'p6_petrol']));
    const s1 = rows.map((r) => ({ p: r.period, v: ((r.p6_dg + r.p6_mach) * EF.dieselKgPerL + r.p6_petrol * EF.petrolKgPerL) / 1000 }));
    const last = s1.slice(-12); const f = forecast(last.map((x) => x.v));
    const lastP = last.at(-1)?.p || '2026-08'; const [y, m] = lastP.split('-').map(Number);
    const future = f.map((v, i) => { const d = new Date(y, m + i, 1); return { month: shortMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`), forecast: Math.round(v) }; });
    const chart = [...last.map((x, i) => ({ month: shortMonth(x.p), actual: Math.round(x.v), forecast: i === last.length - 1 ? Math.round(x.v) : undefined })), ...future];
    return { chart, months };
  }, [calc, scope, ui.boundary]);
  const alerts = useMemo(() => {
    const out = [];
    calc.submissions.filter((s) => s.status === 'submitted').forEach((s) => {
      const pr = calc.projById.get(s.projectId); const r = validateValues({ principle: s.principle, values: s.values, project: pr, period: s.period, calc });
      r.warnings.filter((w) => w.kind === 'spike').forEach((w) => out.push({ kind: 'spike', title: `Spike at ${pr.name}`, text: `${w.msg}`, sub: s }));
    });
    const missing = calc.submissions.filter((s) => s.status === 'submitted' && validateValues({ principle: s.principle, values: s.values, project: calc.projById.get(s.projectId), period: s.period, calc }).warnings.some((w) => w.kind === 'evidence'));
    return { spikes: out, missing };
  }, [calc]);
  const cutMach = fmt(calc.nodeTotals(scope, ui.fy, ui.boundary).t.p6_mach * 0.12 * EF.dieselKgPerL / 1000);
  return (
    <div className="space-y-6">
      <PageHeader badge={<><Sparkles size={14} /> Analytics engine</>} title="Predictive insights & anomalies" subtitle="Rule-based anomaly detection on submitted data and a linear-trend forecast of Scope 1. These are statistical checks, not a trained ML model." />
      <HierarchyFilter showProject={false} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card pad={false}><CardHeader title="Automated audits" icon={AlertTriangle} />
            <div className="p-4 space-y-3">
              {alerts.spikes.length === 0 && alerts.missing.length === 0 && <p className="text-sm text-slate-500">No open anomalies in the review queue.</p>}
              {alerts.spikes.slice(0, 4).map((a, i) => <div key={i} className="p-3 bg-rose-50 border border-rose-100 rounded-lg"><h3 className="text-sm font-bold text-rose-900">{a.title}</h3><p className="text-xs text-rose-700 mt-0.5">{a.text}</p><p className="text-[11px] text-rose-500 mt-1">{a.sub.id} · with BU Manager</p></div>)}
              {alerts.missing.length > 0 && <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg"><h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5"><FileWarning size={14} /> Missing evidence</h3><p className="text-xs text-amber-700 mt-0.5">{alerts.missing.length} submitted packet(s) contain core values without an attached bill/log.</p></div>}
            </div></Card>
          <Card pad={false}><CardHeader title="Optimization ideas" icon={Brain} />
            <div className="p-4"><div className="p-3 bg-slate-50 border border-slate-200 rounded-lg"><div className="flex items-center gap-2 mb-1.5"><Zap size={15} className="text-amber-500" /><h3 className="text-sm font-bold text-slate-900">Electrify heavy machinery</h3></div><p className="text-xs text-slate-600 mb-2">Shifting 12% of diesel machinery load to grid/electric in the selected scope would cut roughly:</p><p className="flex items-center gap-1.5 text-xs font-bold text-emerald-600"><TrendingDown size={14} /> −{cutMach} tCO2e / year <span className="text-slate-400 font-medium">(before added grid emissions)</span></p></div></div></Card>
        </div>
        <Card pad={false} className="lg:col-span-2 flex flex-col">
          <CardHeader title="Scope 1 forecast — next 3 months" subtitle="Least-squares trend on the last 12 approved months" right={<Badge tone="violet">Linear trend</Badge>} />
          <div className="flex-1 min-h-[320px] p-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.chart} margin={{ left: -6, right: 10, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} /><Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / .12)' }} /><Legend iconType="circle" />
            <Area type="monotone" dataKey="actual" name="Actual (tCO2e)" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2.5} connectNulls /><Area type="monotone" dataKey="forecast" name="Forecast" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeDasharray="5 5" strokeWidth={2.5} connectNulls /></AreaChart></ResponsiveContainer></div>
        </Card>
      </div>
      {alerts.spikes.length > 0 && <Btn tone="ghost" onClick={() => nav('/admin/consolidation')}>Open consolidation</Btn>}
    </div>
  );
}

import React from 'react';
import HierarchyFilter from '../../components/HierarchyFilter';
import { useApp } from '../../store/AppStore';
import { PRINCIPLES, SDGS } from '../../data/brsr';
import { fmt } from '../../lib/consolidate';
import { Card, PageHeader, Badge } from '../../components/ui';

const HEADLINE = { 6: (K) => [`${fmt(K.waterWithdrawn)} KL`, 'water withdrawn'], 7: (K) => [`${fmt(K.renewablePct, 1)}%`, 'renewable energy'], 13: (K) => [`${fmt(K.ghg)} tCO2e`, 'Scope 1+2'], 12: (K) => [`${fmt(K.wasteRecoveredPct)}%`, 'waste recovered'], 3: (K) => [fmt(K.ltifr, 2), 'LTIFR'], 5: (K) => [`${fmt(K.femaleWagePct, 1)}%`, 'female wage share'], 8: (K) => [fmt(K.headcount), 'people employed'], 10: (K) => [`${fmt(K.msmePct, 1)}%`, 'MSME procurement'], 16: (K) => [fmt(K.complaints), 'ethics & rights complaints'] };

export default function SdgAlignment() {
  const { calc, ui } = useApp();
  const K = calc.nodeTotals(ui.scope, ui.fy, ui.boundary).kpi;
  const map = {}; PRINCIPLES.forEach((p) => p.sdg.forEach((s) => { (map[s] ||= []).push(p); }));
  return (
    <div className="space-y-6">
      <PageHeader title="UN SDG alignment" subtitle="Every BRSR principle is mapped to the UN Sustainable Development Goals. Headline figures update with the selected scope." />
      <HierarchyFilter showProject={false} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.keys(SDGS).map(Number).map((s) => { const h = HEADLINE[s]?.(K); return (
          <Card key={s} className="flex gap-4"><div className="h-14 w-14 shrink-0 rounded-lg bg-slate-900 text-white flex items-center justify-center text-2xl font-black">{s}</div>
            <div className="min-w-0"><h3 className="font-bold text-slate-900 leading-tight">{SDGS[s]}</h3><div className="flex flex-wrap gap-1 my-2">{map[s].map((p) => <Badge key={p.id} tone="indigo">{p.id}</Badge>)}</div>
              {h ? <p className="text-sm"><b className="text-lg">{h[0]}</b> <span className="text-slate-500">{h[1]}</span></p> : <p className="text-xs text-slate-400">Qualitative — see principle disclosures.</p>}</div></Card>); })}
      </div>
    </div>
  );
}

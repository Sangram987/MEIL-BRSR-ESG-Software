import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../store/AppStore';
import { CURRENT_PERIOD, PRINCIPLES } from '../data/brsr';
import { fmt } from '../lib/consolidate';

// Live project map – every marker is a real project from the org tree, coloured by this month's data status.
export default function ProjectMap({ projects, height = 400 }) {
  const { calc, ui } = useApp();
  const list = projects || calc.org.projects;
  const pts = useMemo(() => list.map((p) => {
    const st = Object.values(calc.projectStatus(p.id, CURRENT_PERIOD));
    const ok = st.filter((s) => s === 'approved').length;
    const flagged = st.some((s) => s === 'correction_required' || s === 'rejected');
    const pending = st.some((s) => s === 'submitted');
    const color = flagged ? '#f59e0b' : ok === PRINCIPLES.length ? '#10b981' : pending || ok > 0 ? '#3b82f6' : '#94a3b8';
    const k = calc.projectTotals(p, ui.fy);
    return { p, color, ok, k };
  }), [list, calc, ui.fy]);
  return (
    <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm relative z-0" style={{ height }}>
      <MapContainer center={[22.59, 78.96]} zoom={4.5} minZoom={2} scrollWheelZoom={false} className="h-full w-full" style={{ background: '#f1f5f9' }}>
        <TileLayer attribution='&copy; <a href="https://www.esri.com/">Esri</a>' url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
        {pts.map(({ p, color, ok, k }) => {
          const t = k.t;
          const s12 = ((t.p6_dg + t.p6_mach) * 2.68 + t.p6_petrol * 2.31 + t.p6_grid * 0.71) / 1000;
          return (
            <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={p.live ? 8 : 6} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95 }}>
              <Popup>
                <div className="min-w-[210px] font-sans">
                  <h3 className="font-bold text-slate-900 text-sm leading-tight">{p.name}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-2">{p.state} · {calc.buById.get(p.buId)?.name}</p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span>Scope 1+2 ({ui.fy.slice(3)})</span><b>{fmt(s12)} tCO2e</b></div>
                    <div className="flex justify-between"><span>Water withdrawn</span><b>{fmt(t.p6_water)} KL</b></div>
                    <div className="flex justify-between"><span>Lost-time injuries</span><b>{fmt(t.p3_lti)}</b></div>
                    <div className="flex justify-between border-t border-slate-100 pt-1 mt-1"><span>This month approved</span><b className="text-blue-600">{ok}/9 principles</b></div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
export const MapLegend = () => (
  <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
    {[['#10b981', 'All 9 principles approved'], ['#3b82f6', 'In progress'], ['#f59e0b', 'Correction pending'], ['#94a3b8', 'No data yet']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{l}</span>)}
  </div>
);

import React from 'react';
import { Network } from 'lucide-react';
import { useApp } from '../store/AppStore';

// Group → Subsidiary → Business Unit → Project drill-down + reporting boundary.
// Reads/writes the shared scope in the store, so every admin screen stays in sync.
export default function HierarchyFilter({ showBoundary = true, showProject = true }) {
  const { org, ui, actions } = useApp();
  const { scope, boundary } = ui;
  const proj = scope.level === 'project' ? org.projects.find((p) => p.id === scope.id) : null;
  const bu = scope.level === 'bu' ? org.bus.find((b) => b.id === scope.id) : proj ? org.bus.find((b) => b.id === proj.buId) : null;
  const sub = scope.level === 'sub' ? org.subsidiaries.find((s) => s.id === scope.id) : bu ? org.subsidiaries.find((s) => s.id === bu.subId) : null;

  const sel = 'bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none max-w-[210px]';
  return (
    <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 px-1"><Network size={15} /> Scope</span>
      <select aria-label="Level: group" className={sel} value={sub ? sub.id : ''} onChange={(e) => actions.setScope(e.target.value ? { level: 'sub', id: e.target.value } : { level: 'group', id: 'meil' })}>
        <option value="">MEIL Group (all)</option>
        {org.subsidiaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select aria-label="Business unit" disabled={!sub} className={sel} value={bu ? bu.id : ''} onChange={(e) => actions.setScope(e.target.value ? { level: 'bu', id: e.target.value } : { level: 'sub', id: sub.id })}>
        <option value="">All business units</option>
        {sub && org.bus.filter((b) => b.subId === sub.id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      {showProject && (
        <select aria-label="Project" disabled={!bu} className={sel} value={proj ? proj.id : ''} onChange={(e) => actions.setScope(e.target.value ? { level: 'project', id: e.target.value } : { level: 'bu', id: bu.id })}>
          <option value="">All projects</option>
          {bu && org.projects.filter((p) => p.buId === bu.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {showBoundary && (
        <div className="flex items-center gap-2 sm:ml-auto pl-2 sm:border-l border-slate-200">
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200" role="group" aria-label="Reporting boundary">
            {[['consolidated', 'Consolidated'], ['standalone', 'Standalone']].map(([m, l]) => (
              <button key={m} onClick={() => actions.setBoundary({ ...boundary, mode: m })} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${boundary.mode === m ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
            ))}
          </div>
          <label className={`flex items-center gap-1.5 text-xs font-semibold ${boundary.mode === 'standalone' ? 'text-slate-300' : 'text-slate-600'}`}>
            <input type="checkbox" disabled={boundary.mode === 'standalone'} checked={boundary.includeJV} onChange={(e) => actions.setBoundary({ ...boundary, includeJV: e.target.checked })} /> Include JVs
          </label>
        </div>
      )}
    </div>
  );
}

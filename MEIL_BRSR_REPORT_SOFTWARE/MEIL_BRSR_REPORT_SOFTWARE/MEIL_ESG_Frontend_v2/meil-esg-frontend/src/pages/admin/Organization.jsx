import React, { useState } from 'react';
import { Building2, Layers, MapPin, Plus, Network, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { compact } from '../../lib/consolidate';
import { Btn, Card, Modal, PageHeader, Badge, inputCls, labelCls } from '../../components/ui';

export default function Organization() {
  const { org, calc, ui, user, actions, toast } = useApp();
  const [open, setOpen] = useState({});
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // {kind, ...}
  const [form, setForm] = useState({});
  const actor = { name: user.name, role: user.role };
  const tog = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const openModal = (m) => { setForm({}); setModal(m); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = () => {
    if (!form.name?.trim()) { toast('Name is required.', 'error'); return; }
    const kind = modal.kind;
    if (kind === 'bu' && !form.subId) { toast('Choose a subsidiary.', 'error'); return; }
    if (kind === 'project' && !form.buId) { toast('Choose a business unit.', 'error'); return; }
    const data = kind === 'sub' ? { name: form.name.trim(), relation: form.relation || 'subsidiary', ownership: +form.ownership || 100 } : kind === 'bu' ? { name: form.name.trim(), subId: form.subId } : { name: form.name.trim(), buId: form.buId, state: form.state || 'Telangana', turnoverCr: +form.turnoverCr || 90 };
    actions.addEntity({ kind, data, actor }); toast(`${data.name} added to the hierarchy.`); setModal(null);
  };
  const match = (p) => !q || p.name.toLowerCase().includes(q.toLowerCase());
  const REL = { parent: 'Parent division', subsidiary: 'Subsidiary', jv: 'Joint venture' };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Organization & Sites" subtitle={`Group → Subsidiary → Business Unit → Project. ${org.projects.length} project sites across ${org.subsidiaries.length} entities. The hierarchy drives consolidation and the standalone / consolidated boundary.`}
        actions={<><Btn tone="ghost" onClick={() => openModal({ kind: 'sub' })}><Plus size={16} /> Subsidiary</Btn><Btn tone="ghost" onClick={() => openModal({ kind: 'bu' })}><Plus size={16} /> Business unit</Btn><Btn onClick={() => openModal({ kind: 'project' })}><Plus size={16} /> Project site</Btn></>} />
      <div className="relative max-w-sm"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input className={`${inputCls} !pl-9`} placeholder="Find a project…" value={q} onChange={(e) => setQ(e.target.value)} /></div>

      <div className="bg-slate-900 text-white rounded-xl p-5 flex items-center justify-between shadow-md flex-wrap gap-3">
        <div className="flex items-center gap-4"><div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center"><Network size={24} /></div><div><h2 className="text-lg font-bold">{org.group.name}</h2><p className="text-sm text-slate-400">Group headquarters · Hyderabad</p></div></div>
        <div className="text-right text-xs text-slate-400">Group Scope 1+2 ({ui.fy})<b className="block text-xl text-white">{compact(calc.nodeTotals({ level: 'group', id: 'meil' }, ui.fy, ui.boundary).kpi.ghg)} tCO2e</b></div>
      </div>

      <div className="space-y-5 pl-3 md:pl-8 border-l-2 border-slate-200 ml-5">
        {org.subsidiaries.map((sub) => {
          const k = calc.nodeTotals({ level: 'sub', id: sub.id }, ui.fy, { mode: 'consolidated', includeJV: true });
          return (
            <Card key={sub.id} pad={false} className="relative">
              <div className="absolute top-8 -left-3 md:-left-8 w-3 md:w-8 h-0.5 bg-slate-200" />
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Building2 size={20} /></div>
                  <div><h3 className="font-bold text-slate-900">{sub.name}</h3><div className="flex gap-1.5 mt-1"><Badge tone="emerald">{sub.status}</Badge><Badge tone={sub.relation === 'jv' ? 'violet' : 'slate'}>{REL[sub.relation]}{sub.relation !== 'parent' ? ` · ${sub.ownership}%` : ''}</Badge></div></div></div>
                <div className="flex items-center gap-4 text-right"><div><p className="text-[11px] text-slate-500">Sites</p><b>{k.projects}</b></div><div><p className="text-[11px] text-slate-500">Scope 1+2</p><b>{compact(k.kpi.ghg)}</b></div>
                  <label className="text-xs font-semibold text-slate-600 flex flex-col">Relation<select className="border border-slate-300 rounded px-1.5 py-1 text-xs" value={sub.relation} onChange={(e) => { actions.updateSub({ id: sub.id, patch: { relation: e.target.value }, actor }); toast('Boundary classification updated.'); }}><option value="parent">Parent</option><option value="subsidiary">Subsidiary</option><option value="jv">Joint venture</option></select></label></div>
              </div>
              <div className="p-4 space-y-3 bg-slate-50/60 rounded-b-xl">
                {org.bus.filter((b) => b.subId === sub.id).map((bu) => {
                  const projs = org.projects.filter((p) => p.buId === bu.id); const shown = projs.filter(match);
                  if (q && shown.length === 0) return null;
                  const expanded = open[bu.id] || !!q;
                  return (
                    <div key={bu.id} className="bg-white rounded-lg border border-slate-200">
                      <button onClick={() => tog(bu.id)} aria-expanded={expanded} className="w-full flex items-center gap-2 p-3 text-left">
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<Layers className="text-indigo-500" size={16} /><span className="font-bold text-sm text-slate-800 flex-1">{bu.name}</span><Badge>{projs.length} sites</Badge>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 border-t border-slate-100">
                          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 py-2 max-h-64 overflow-y-auto">{shown.map((p) => <li key={p.id} className="flex items-center gap-2 text-sm text-slate-600"><MapPin size={13} className="text-slate-400 shrink-0" /><span className="truncate">{p.name}</span>{p.live && <Badge tone="blue">Live</Badge>}</li>)}</ul>
                          <button onClick={() => openModal({ kind: 'project' }) || setForm({ buId: bu.id })} className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-1"><Plus size={12} /> Add project site</button>
                        </div>)}
                    </div>);
                })}
              </div>
            </Card>);
        })}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={{ sub: 'Add subsidiary / entity', bu: 'Add business unit', project: 'Add project site' }[modal?.kind]} footer={<><Btn tone="ghost" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={save}>Add</Btn></>}>
        <div className="space-y-4">
          <div><label className={labelCls}>Name *</label><input className={inputCls} value={form.name || ''} onChange={set('name')} autoFocus /></div>
          {modal?.kind === 'sub' && <><div><label className={labelCls}>Relationship to MEIL (decides boundary)</label><select className={inputCls} value={form.relation || 'subsidiary'} onChange={set('relation')}><option value="subsidiary">Subsidiary</option><option value="jv">Joint venture / associate</option><option value="parent">Parent division</option></select></div><div><label className={labelCls}>Ownership %</label><input type="number" min="0" max="100" className={inputCls} value={form.ownership || ''} onChange={set('ownership')} /></div></>}
          {modal?.kind === 'bu' && <div><label className={labelCls}>Subsidiary *</label><select className={inputCls} value={form.subId || ''} onChange={set('subId')}><option value="">Select…</option>{org.subsidiaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
          {modal?.kind === 'project' && <><div><label className={labelCls}>Business unit *</label><select className={inputCls} value={form.buId || ''} onChange={set('buId')}><option value="">Select…</option>{org.bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div><label className={labelCls}>State / country</label><input className={inputCls} value={form.state || ''} onChange={set('state')} placeholder="Telangana" /></div><div><label className={labelCls}>Annual turnover (₹ Cr)</label><input type="number" className={inputCls} value={form.turnoverCr || ''} onChange={set('turnoverCr')} /></div></div></>}
        </div>
      </Modal>
    </div>
  );
}

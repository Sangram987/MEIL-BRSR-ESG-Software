import React, { useState } from 'react';
import { Scale, ShieldCheck } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { CORE_ATTRS, FYS } from '../../data/brsr';
import { Btn, Card, Modal, PageHeader, Badge, Table, inputCls, labelCls } from '../../components/ui';

// SEBI allows entities to choose "assessment" (internal/independent, no formal standard required)
// or "assurance" (external provider, against a recognised standard) for BRSR Core — this form
// captures whichever mode applies rather than hard-coding "assurance" everywhere.
const CONCLUSIONS = { assurance: ['Reasonable assurance', 'Limited assurance', 'Qualified', 'Not assured'], assessment: ['Satisfactory', 'Satisfactory with observations', 'Unsatisfactory', 'Not assessed'] };
const STANDARDS = ['ISAE 3000', 'SSAE 2000 (ICAI)', 'BRSR Core industry standard (2024)', 'Other / internal framework'];
const PROVIDER_TYPES = ['Independent external assurance provider', 'Independent external assessment agency', 'Statutory auditor', 'Internal audit (assessment only — cannot provide assurance)'];
const blankForm = { mode: 'assurance', status: CONCLUSIONS.assurance[0], provider: '', providerType: PROVIDER_TYPES[0], standard: STANDARDS[0], scope: '', methodology: '', evidenceTested: '', exceptions: '', independenceConfirmed: false, note: '' };

export default function Opinions() {
  const { state, user, actions, toast } = useApp();
  const [fy, setFy] = useState('FY 2026-27'); const [edit, setEdit] = useState(null); const [form, setForm] = useState(blankForm);
  const ops = state.assuranceOpinions[fy] || {};
  const openEdit = (a, o) => { setEdit(a); setForm(o ? { ...blankForm, ...o } : { ...blankForm }); };
  const save = () => {
    if (form.providerType.startsWith('Internal audit') && form.mode === 'assurance') { toast('SEBI does not allow an internal auditor to provide assurance — switch mode to Assessment or change the provider type.', 'error'); return; }
    if (!form.independenceConfirmed) { toast('Confirm the provider independence / no-conflict declaration first.', 'error'); return; }
    actions.issueOpinion({ fy, attr: edit.id, opinion: form, actor: { name: user.name, role: user.role } }); toast(`${form.mode === 'assessment' ? 'Assessment' : 'Assurance'} opinion recorded for ${edit.label}.`); setEdit(null);
  };
  return (
    <div className="space-y-6">
      <PageHeader badge={<><Scale size={14} /> BRSR Core</>} title="Assessment / assurance opinions" subtitle="Record the formal conclusion for each of the 9 BRSR Core attributes — SEBI allows either an independent assessment or a formal assurance engagement. These prints on the BRSR report." actions={<select className={`${inputCls} !w-auto`} value={fy} onChange={(e) => setFy(e.target.value)} aria-label="Financial year">{FYS.map((f) => <option key={f}>{f}</option>)}</select>} />
      <Card pad={false}><Table head={['#', 'Attribute', 'Mode', 'Conclusion', 'Provider', 'Date', '']}>{CORE_ATTRS.map((a, i) => { const o = ops[a.id]; return <tr key={a.id}><td className="px-4 py-3 text-slate-400 font-bold">{i + 1}</td><td className="px-4 py-3 font-semibold">{a.label}</td><td className="px-4 py-3">{o ? <Badge tone={o.mode === 'assessment' ? 'sky' : 'indigo'}>{o.mode === 'assessment' ? 'Assessment' : 'Assurance'}</Badge> : '–'}</td><td className="px-4 py-3">{o ? <Badge tone={/Qualified|Not assured|Unsatisfactory/.test(o.status) ? 'rose' : 'emerald'}>{o.status}</Badge> : <Badge tone="amber">Pending</Badge>}</td><td className="px-4 py-3 text-xs">{o?.provider || '–'}</td><td className="px-4 py-3 text-xs">{o?.at || '–'}</td><td className="px-4 py-3 text-right">{fy === 'FY 2026-27' && <Btn tone="ghost" className="!py-1 !text-xs" onClick={() => openEdit(a, o)}>{o ? 'Update' : 'Issue'}</Btn>}</td></tr>; })}</Table></Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={`Opinion — ${edit?.label}`} subtitle={fy} footer={<><Btn tone="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}><ShieldCheck size={16} /> Record opinion</Btn></>}>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className={labelCls}>Mode</label><select className={inputCls} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value, status: CONCLUSIONS[e.target.value][0] })}><option value="assurance">Assurance (external provider, recognised standard)</option><option value="assessment">Assessment (independent evaluation, no standard mandated)</option></select></div>
          <div><label className={labelCls}>Conclusion</label><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{CONCLUSIONS[form.mode].map((l) => <option key={l}>{l}</option>)}</select></div>
          <div><label className={labelCls}>Provider / agency name</label><input className={inputCls} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
          <div><label className={labelCls}>Provider type</label><select className={inputCls} value={form.providerType} onChange={(e) => setForm({ ...form, providerType: e.target.value })}>{PROVIDER_TYPES.map((p) => <option key={p}>{p}</option>)}</select></div>
          {form.mode === 'assurance' && <div><label className={labelCls}>Standard used</label><select className={inputCls} value={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.value })}>{STANDARDS.map((s) => <option key={s}>{s}</option>)}</select></div>}
          <div><label className={labelCls}>Scope of engagement</label><input className={inputCls} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="e.g. All sites in Tunnels & Transit BU" /></div>
          <div className="md:col-span-2"><label className={labelCls}>Methodology</label><textarea rows={2} className={inputCls} value={form.methodology} onChange={(e) => setForm({ ...form, methodology: e.target.value })} placeholder="Sampling approach, data sources, recalculation steps…" /></div>
          <div><label className={labelCls}>Evidence tested</label><textarea rows={2} className={inputCls} value={form.evidenceTested} onChange={(e) => setForm({ ...form, evidenceTested: e.target.value })} /></div>
          <div><label className={labelCls}>Exceptions / observations</label><textarea rows={2} className={inputCls} value={form.exceptions} onChange={(e) => setForm({ ...form, exceptions: e.target.value })} /></div>
          <div className="md:col-span-2"><label className={labelCls}>Basis / general note</label><textarea rows={2} className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <label className="md:col-span-2 flex items-start gap-2 text-sm font-semibold text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3"><input type="checkbox" className="mt-0.5" checked={form.independenceConfirmed} onChange={(e) => setForm({ ...form, independenceConfirmed: e.target.checked })} /> I confirm this provider is independent of the entity/group being reported on and has no conflict of interest (an internal auditor of the listed entity or group cannot provide assurance).</label>
        </div>
      </Modal>
    </div>
  );
}

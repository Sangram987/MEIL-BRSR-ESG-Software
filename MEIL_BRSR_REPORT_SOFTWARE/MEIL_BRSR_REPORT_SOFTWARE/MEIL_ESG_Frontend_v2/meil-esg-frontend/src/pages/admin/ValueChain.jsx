import React, { useState } from 'react';
import { Truck, Factory, ShieldCheck, AlertTriangle, Mail, Plus, Clock, Settings2, Info } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { vendorEmissions, vendorShare } from '../../data/brsr';
import { fmt, compact } from '../../lib/consolidate';
import { ICON_TONE, Btn, Card, CardHeader, Modal, PageHeader, Badge, StatusBadge, Table, inputCls, labelCls, dt } from '../../components/ui';

const CATS = ['Raw Materials', 'Equipment Leasing', 'Transportation', 'Contract Labor', 'Services'];
const APPLICABILITY = { voluntary_top250: 'Voluntary — top 250 listed entities (SEBI, Mar-2025 circular)', mandatory: 'Mandatory for this entity', not_applicable: 'Not applicable this cycle' };

export default function ValueChain() {
  const { state, user, actions, toast } = useApp();
  const [modal, setModal] = useState(false); const [addV, setAddV] = useState(false); const [cfg, setCfg] = useState(false);
  const [sel, setSel] = useState([]); const [due, setDue] = useState('2026-10-31'); const [msg, setMsg] = useState('Please share your H1 FY 2026-27 ESG data with supporting evidence.');
  const [nv, setNv] = useState({ name: '', category: CATS[0] });
  const vc = state.valueChainConfig;
  const [vcDraft, setVcDraft] = useState(vc);
  const actor = { name: user.name, role: user.role };
  const reqs = state.vendorRequests;
  const latest = (id) => reqs.filter((r) => r.vendorId === id).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
  const accepted = reqs.filter((r) => r.status === 'accepted');
  const s3 = accepted.reduce((a, r) => a + vendorEmissions(r.values) * vendorShare(r.values), 0);
  const flagged = state.vendors.filter((v) => v.safety === 'Flagged' || v.score < 65).length;
  const send = () => {
    if (!sel.length) { toast('Select at least one vendor.', 'error'); return; }
    actions.sendVendorRequests({ vendorIds: sel, period: 'H1 FY 2026-27', due, message: msg, actor }); setModal(false); setSel([]); toast(`Secure request sent to ${sel.length} vendor(s).`);
  };
  const add = () => { if (!nv.name.trim()) { toast('Vendor name is required.', 'error'); return; } actions.addVendor({ name: nv.name.trim(), category: nv.category }); setAddV(false); setNv({ name: '', category: CATS[0] }); toast('Vendor added to the value chain.'); };
  return (
    <div className="space-y-6">
      <PageHeader badge="BRSR Core · Scope 3" title="Value-Chain ESG Disclosures" subtitle="Supplier ESG evidence ingestion and revenue-share Scope 3 allocation."
        actions={<><Btn tone="ghost" onClick={() => { setVcDraft(vc); setCfg(true); }}><Settings2 size={16} /> Methodology</Btn><Btn tone="ghost" onClick={() => setAddV(true)}><Plus size={16} /> Add vendor</Btn><Btn tone="indigo" onClick={() => setModal(true)}><Mail size={16} /> Request ESG data</Btn></>} />
      <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800 flex items-start gap-2 leading-relaxed"><Info size={14} className="mt-0.5 shrink-0" /><span><b>{APPLICABILITY[vc.applicability]}.</b> Internal Scope 3 allocation estimate based on revenue share.</span></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[[Factory, 'blue', state.vendors.length, 'Vendors onboarded'], [ShieldCheck, 'emerald', `${Math.round((accepted.length / Math.max(1, state.vendors.length)) * 100)}%`, 'Data accepted'], [Truck, 'amber', compact(s3), 'Scope 3 allocated est. (tCO2e)'], [AlertTriangle, 'rose', flagged, 'High-risk vendors']].map(([I, c, v, l]) => (
          <div key={l} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4"><div className={`p-3 rounded-lg ${ICON_TONE[c]}`}><I size={24} /></div><div><p className="text-2xl font-black text-slate-900">{v}</p><p className="text-xs font-bold text-slate-500">{l}</p></div></div>))}
      </div>
      <Card pad={false}>
        <CardHeader title="Suppliers & contractors" subtitle="Latest request status per vendor" />
        <Table head={['Vendor', 'Category', { label: 'Reported Scope 3', right: true }, 'Safety', 'Latest request', 'Score']}>
          {state.vendors.map((v) => { const r = latest(v.id); const acc = reqs.filter((x) => x.vendorId === v.id && x.status === 'accepted').sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]; return (
            <tr key={v.id} className="hover:bg-slate-50"><td className="px-4 py-3"><b className="text-slate-900">{v.name}</b><div className="text-[11px] text-slate-400">{v.id}</div></td><td className="px-4 py-3 text-slate-600">{v.category}</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold">{acc ? fmt(vendorEmissions(acc.values) * vendorShare(acc.values), 0) : v.scope3 ? <span className="text-slate-400" title="Prior-year estimate, not yet assured">{fmt(v.scope3)} est.</span> : '–'}</td>
              <td className="px-4 py-3"><Badge tone={v.safety === 'Flagged' ? 'rose' : 'emerald'}>{v.safety}</Badge></td><td className="px-4 py-3">{r ? <><StatusBadge status={r.status} /><div className="text-[11px] text-slate-400 mt-0.5">{r.period} · sent {dt(r.sentAt)}</div></> : <span className="text-xs text-slate-400">Never requested</span>}</td>
              <td className="px-4 py-3"><b className={v.score >= 80 ? 'text-emerald-600' : v.score >= 65 ? 'text-amber-600' : 'text-rose-600'}>{v.score || '–'}</b></td></tr>); })}
        </Table>
      </Card>
      <Card pad={false}><CardHeader title="Outbound requests" icon={Clock} />
        <Table head={['Request', 'Vendor', 'Period', 'Due', 'Status']}>{reqs.map((r) => <tr key={r.id}><td className="px-4 py-3 text-xs font-bold text-indigo-600">{r.id}</td><td className="px-4 py-3 font-semibold">{state.vendors.find((v) => v.id === r.vendorId)?.name}</td><td className="px-4 py-3">{r.period}</td><td className="px-4 py-3">{r.due}</td><td className="px-4 py-3"><StatusBadge status={r.status} /></td></tr>)}</Table></Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Request vendor ESG data" subtitle="Vendors receive a secure link to the Vendor portal." footer={<><Btn tone="ghost" onClick={() => setModal(false)}>Cancel</Btn><Btn tone="indigo" onClick={send}><Mail size={16} /> Send request</Btn></>}>
        <div className="space-y-4">
          <div><label className={labelCls}>Vendors ({sel.length} selected)</label><div className="border border-slate-200 rounded-lg divide-y max-h-52 overflow-y-auto">{state.vendors.map((v) => <label key={v.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"><input type="checkbox" checked={sel.includes(v.id)} onChange={(e) => setSel(e.target.checked ? [...sel, v.id] : sel.filter((x) => x !== v.id))} /><span className="flex-1">{v.name}</span><span className="text-xs text-slate-400">{v.category}</span></label>)}</div></div>
          <div><label className={labelCls}>Due date</label><input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <div><label className={labelCls}>Message</label><textarea rows={3} className={inputCls} value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
        </div>
      </Modal>
      <Modal open={addV} onClose={() => setAddV(false)} title="Add vendor" footer={<><Btn tone="ghost" onClick={() => setAddV(false)}>Cancel</Btn><Btn onClick={add}>Add</Btn></>}>
        <div className="space-y-4"><div><label className={labelCls}>Vendor name *</label><input className={inputCls} value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} /></div><div><label className={labelCls}>Category</label><select className={inputCls} value={nv.category} onChange={(e) => setNv({ ...nv, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div></div>
      </Modal>
      <Modal open={cfg} onClose={() => setCfg(false)} title="Value-chain applicability & methodology" subtitle="Policy-driven configuration — not hard-coded, so it can follow SEBI's evolving rules"
        footer={<><Btn tone="ghost" onClick={() => setCfg(false)}>Cancel</Btn><Btn onClick={() => { actions.setValueChainConfig(vcDraft); setCfg(false); toast('Value-chain configuration updated.'); }}>Save</Btn></>}>
        <div className="space-y-4">
          <div><label className={labelCls}>Applicability for this entity</label><select className={inputCls} value={vcDraft.applicability} onChange={(e) => setVcDraft({ ...vcDraft, applicability: e.target.value })}><option value="voluntary_top250">Voluntary — top 250 listed entities (current SEBI position, FY2025-26+)</option><option value="mandatory">Mandatory for this entity</option><option value="not_applicable">Not applicable this cycle</option></select></div>
          <div><label className={labelCls}>Allocation method</label><select className={inputCls} value={vcDraft.allocationMethod} onChange={(e) => setVcDraft({ ...vcDraft, allocationMethod: e.target.value })}><option value="revenue_share">Revenue-share (MEIL revenue ÷ vendor total revenue)</option><option value="spend_share">Spend-share (MEIL spend ÷ vendor total revenue)</option><option value="direct">Direct — vendor reports MEIL-attributable figure directly</option></select></div>
          <div><label className={labelCls}>Methodology note (shown on every export)</label><textarea rows={3} className={inputCls} value={vcDraft.methodologyNote} onChange={(e) => setVcDraft({ ...vcDraft, methodologyNote: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}

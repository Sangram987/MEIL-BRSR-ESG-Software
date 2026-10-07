import React, { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { VENDOR_FIELDS, vendorEmissions, vendorShare } from '../../data/brsr';
import { fmt } from '../../lib/consolidate';
import { Btn, Card, Modal, PageHeader, StatusBadge, Table, FileChip, EvidenceViewer, inputCls, labelCls, Empty, dt } from '../../components/ui';

export default function VendorReview() {
  const { state, user, actions, toast } = useApp();
  const [open, setOpen] = useState(null); const [c, setC] = useState(''); const [doc, setDoc] = useState(null);
  const rows = [...state.vendorRequests].sort((a, b) => ({ submitted: 0, correction_required: 1, requested: 2, accepted: 3 }[a.status] - { submitted: 0, correction_required: 1, requested: 2, accepted: 3 }[b.status]));
  const r = open && state.vendorRequests.find((x) => x.id === open); const v = r && state.vendors.find((x) => x.id === r.vendorId);
  const act = { name: user.name, role: user.role };
  const decide = (d) => { if (d === 'correction' && !c.trim()) { toast('Tell the vendor what to fix.', 'error'); return; } actions.reviewVendor({ id: r.id, decision: d, comment: c.trim(), actor: act }); toast(d === 'accept' ? 'Accepted — allocated to Scope 3.' : 'Sent back to vendor.'); setOpen(null); setC(''); };
  return (
    <div className="space-y-6">
      <PageHeader title="Vendor data review" subtitle="Validate vendor submissions and evidence before they are counted in Scope 3 / value-chain disclosures." />
      <Card pad={false}>{rows.length === 0 ? <Empty title="No vendor requests" /> : <Table head={['Request', 'Vendor', 'Period', 'Status', 'Sent', '']}>{rows.map((x) => <tr key={x.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-xs font-bold text-indigo-600">{x.id}</td><td className="px-4 py-3 font-semibold">{state.vendors.find((y) => y.id === x.vendorId)?.name}</td><td className="px-4 py-3">{x.period}</td><td className="px-4 py-3"><StatusBadge status={x.status} /></td><td className="px-4 py-3 text-xs text-slate-500">{dt(x.sentAt)}</td><td className="px-4 py-3 text-right"><Btn tone={x.status === 'submitted' ? 'dark' : 'ghost'} className="!py-1.5 !text-xs" onClick={() => { setOpen(x.id); setC(''); }}>{x.status === 'submitted' ? 'Review' : 'View'}</Btn></td></tr>)}</Table>}</Card>
      {r && (
        <Modal open wide onClose={() => setOpen(null)} title={`${r.id} · ${v.name}`} subtitle={`${r.period} · ${v.category}`} footer={r.status === 'submitted' ? <><Btn tone="warn" onClick={() => decide('correction')}>Request correction</Btn><Btn tone="ok" onClick={() => decide('accept')}>Accept</Btn></> : <Btn tone="dark" onClick={() => setOpen(null)}>Close</Btn>}>
          {r.status === 'requested' ? <p className="text-sm text-slate-500">Awaiting vendor submission.</p> : (<>
            <div className="border border-slate-200 rounded-xl overflow-x-auto mb-4"><Table head={['Field', { label: 'Value', right: true }, 'Evidence']}>{VENDOR_FIELDS.map((f) => <tr key={f.id}><td className="px-4 py-2">{f.label}</td><td className="px-4 py-2 text-right font-bold tabular-nums">{r.values[f.id] !== undefined && r.values[f.id] !== '' ? fmt(+r.values[f.id], 1) : '–'} <span className="text-[11px] text-slate-400 font-normal">{f.unit}</span></td><td className="px-4 py-2">{r.evidence[f.id] ? <FileChip name={r.evidence[f.id]} onClick={() => setDoc({ name: r.evidence[f.id], site: v.name, value: fmt(+r.values[f.id], 1), unit: f.unit, indicator: f.label, period: r.period })} /> : f.ev && +r.values[f.id] > 0 ? <span className="text-[11px] font-bold text-rose-600">Missing</span> : '–'}</td></tr>)}</Table></div>
            <p className="text-sm mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">Scope 1+2: <b>{fmt(vendorEmissions(r.values), 1)} t</b> × MEIL share <b>{fmt(vendorShare(r.values) * 100, 1)}%</b> = <b>{fmt(vendorEmissions(r.values) * vendorShare(r.values), 1)} t</b> allocated to MEIL Scope 3.</p></>)}
          {r.status === 'submitted' && <><label className={labelCls}>Comment to vendor (required for correction)</label><textarea rows={3} className={inputCls} value={c} onChange={(e) => setC(e.target.value)} /></>}
        </Modal>)}
      <EvidenceViewer doc={doc} onClose={() => setDoc(null)} />
    </div>
  );
}

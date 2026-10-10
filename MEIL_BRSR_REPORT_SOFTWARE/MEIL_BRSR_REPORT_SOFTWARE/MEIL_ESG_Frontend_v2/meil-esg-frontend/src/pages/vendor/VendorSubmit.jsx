import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Paperclip, UploadCloud, X, Send, Lock, AlertCircle } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { VENDOR_FIELDS, vendorEmissions, vendorShare } from '../../data/brsr';
import { fmt } from '../../lib/consolidate';
import { Btn, Card, PageHeader, StatusBadge, inputCls, labelCls, Empty } from '../../components/ui';
import approvalsApi from '../../services/approvalsApi';
import evidenceApi from '../../services/evidenceApi';

export default function VendorSubmit() {
  const [uploading, setUploading,] = useState({});
  const { user, state, actions, toast } = useApp(); const [sp] = useSearchParams(); const nav = useNavigate();
  const v = state.vendors.find((x) => x.id === user?.vendorId || x.code === user?.vendorId || x.id === 'V-103') || state.vendors[0];
  const mine = state.vendorRequests.filter((r) => r.vendorId === user?.vendorId || (v && r.vendorId === v.id) || (v?.code && r.vendorId === v.code) || r.vendorId === 'V-103');
  const editable = mine.filter((r) => ['requested', 'correction_required'].includes(r.status));
  const [id, setId] = useState(sp.get('id') || editable[0]?.id);
  const req = mine.find((r) => r.id === id);
  const [vals, setVals] = useState({}); const [ev, setEv] = useState({}); const [tried, setTried] = useState(false);
  const refs = useRef({});
  useEffect(() => { setVals(req?.values || {}); setEv(req?.evidence || {}); setTried(false); }, [id]); // eslint-disable-line
  if (!req) return <div><PageHeader title="Submit ESG data" /><Card><Empty title="No open requests" text="MEIL hasn't requested data from you right now." /></Card></div>;
  const locked = !['requested', 'correction_required'].includes(req.status);
  const errs = {};
  VENDOR_FIELDS.forEach((f) => { const v = vals[f.id]; if (f.req && (v === '' || v == null)) errs[f.id] = 'Required (enter 0 if none)'; else if (v !== '' && v != null && +v < 0) errs[f.id] = 'Cannot be negative'; else if (f.ev && +v > 0 && !ev[f.id]) errs[f.id] = 'Attach supporting evidence'; });
  if (+vals.v_meil > +vals.v_turnover) errs.v_meil = 'Cannot exceed total revenue';
  const em = vendorEmissions(vals), share = vendorShare(vals);
  const submit = () => { setTried(true); if (Object.keys(errs).length) { toast(`${Object.keys(errs).length} field(s) need attention.`, 'error'); return; } actions.submitVendor({ id: req.id, values: vals, evidence: ev, actor: { name: user.name, role: 'vendor' } }); toast('Submitted for assurance review. Thank you.'); nav('/vendor'); };
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Submit ESG data" subtitle={`${req.period} · due ${req.due}. Attach a bill, register or log against every measured quantity.`} actions={<><select className={`${inputCls} !w-auto`} value={id} onChange={(e) => setId(e.target.value)} aria-label="Request">{mine.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.period}</option>)}</select><StatusBadge status={req.status} /></>} />
      {req.status === 'correction_required' && <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-900"><b>Correction requested:</b> {req.comment}</div>}
      {locked && <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-sm flex gap-2 items-center"><Lock size={16} /> This submission is {req.status === 'accepted' ? 'accepted and locked' : 'with the assurance reviewer'}.</div>}
      <Card className="grid md:grid-cols-2 gap-x-8 gap-y-5">
        {VENDOR_FIELDS.map((f) => (
          <div key={f.id}><label className={labelCls} htmlFor={f.id}>{f.label} {f.req && <span className="text-rose-500">*</span>}</label>
            <div className="flex"><input id={f.id} type="number" min="0" disabled={locked} className={`${inputCls} !rounded-r-none ${tried && errs[f.id] ? '!border-rose-400 !bg-rose-50' : ''}`} value={vals[f.id] ?? ''} onChange={(e) => setVals({ ...vals, [f.id]: e.target.value })} /><span className="inline-flex items-center px-3 border border-l-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-bold rounded-r-lg min-w-[88px] justify-center">{f.unit}</span></div>
            {f.ev && <div className="mt-1.5">{ev[f.id] ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5"><Paperclip size={11} />{ev[f.id]}{!locked && <button onClick={() => setEv({ ...ev, [f.id]: '' })} aria-label="Remove"><X size={11} /></button>}</span> : !locked && <><input ref={(el) => { refs.current[f.id] = el; }} type="file" className="hidden" onChange={async (e) => {
              const file =
                e.target.files?.[0];

              if (!file) return;

              if (
                file.size >
                25 * 1024 * 1024
              ) {
                toast(
                  'File is larger than 25 MB.',
                  'error'
                );
                return;
              }

              try {
                setUploading(
                  (current) => ({
                    ...current,
                    [f.id]: true,
                  })
                );

                const doc =
                  await evidenceApi.uploadDocument(
                    file
                  );

                setEv(
                  (current) => ({
                    ...current,
                    [f.id]:
                      doc.id,
                    [`${f.id}_name`]:
                      doc.name,
                  })
                );

                toast(
                  `${doc.name} uploaded.`
                );
              } catch (error) {
                toast(
                  error.message,
                  'error'
                );
              } finally {
                setUploading(
                  (current) => ({
                    ...current,
                    [f.id]: false,
                  })
                );
              }
            }} /><button type="button" onClick={() => refs.current[f.id]?.click()} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-700 border border-dashed border-slate-300 rounded px-2 py-0.5"><UploadCloud size={12} /> Attach evidence</button></>}</div>}
            {tried && errs[f.id] && <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1"><AlertCircle size={12} />{errs[f.id]}</p>}</div>))}
      </Card>
      <div className="bg-slate-900 text-white rounded-xl p-4 grid grid-cols-3 gap-4 text-center"><div><p className="text-[11px] text-slate-400">Your Scope 1+2 (est.)</p><p className="text-xl font-black">{fmt(em, 1)} t</p></div><div><p className="text-[11px] text-slate-400">MEIL revenue share</p><p className="text-xl font-black">{fmt(share * 100, 1)}%</p></div><div><p className="text-[11px] text-slate-400">Allocated to MEIL</p><p className="text-xl font-black">{fmt(em * share, 1)} t</p></div></div>
      {!locked && <div className="flex justify-end"><Btn tone="indigo" onClick={submit}><Send size={16} /> Submit to MEIL</Btn></div>}
    </div>
  );
}

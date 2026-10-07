import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UploadCloud, CheckCircle2, AlertCircle, Info, Paperclip, X, Lock, Send, Save, AlertTriangle, Calculator, MessageSquareWarning } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { PRINCIPLES, openPeriods, periodLabel, principleOf, EF, ENERGY_GJ } from '../../data/brsr';
import { validateValues } from '../../lib/validate';
import { fmt } from '../../lib/consolidate';
import { Modal, Btn, StatusBadge, Badge, PageHeader, Card, inputCls, labelCls } from '../../components/ui';
import evidenceApi from '../../services/evidenceApi';
import submissionApi from '../../services/submissionApi';

const DOT = { approved: 'bg-emerald-500', submitted: 'bg-amber-500', correction_required: 'bg-rose-500', rejected: 'bg-rose-500', draft: 'bg-slate-400', none: 'bg-slate-200' };

function LivePreview({ principle, values }) {
  const v = (id) => +values[id]?.v || 0;
  let rows = [];
  if (principle === 'P6') {
    const s1 = ((v('p6_dg') + v('p6_mach')) * EF.dieselKgPerL + v('p6_petrol') * EF.petrolKgPerL) / 1000;
    const s2 = (v('p6_grid') * EF.gridKgPerKWh) / 1000;
    const gj = (v('p6_grid') + v('p6_renew')) * ENERGY_GJ.kWh + (v('p6_dg') + v('p6_mach')) * ENERGY_GJ.dieselL + v('p6_petrol') * ENERGY_GJ.petrolL;
    rows = [['Scope 1 (fuel)', `${fmt(s1, 2)} tCO2e`], ['Scope 2 (grid)', `${fmt(s2, 2)} tCO2e`], ['Total energy', `${fmt(gj, 1)} GJ`], ['Water consumed', `${fmt(Math.max(0, v('p6_water') - v('p6_disch')))} KL`]];
  } else if (principle === 'P3') {
    const hc = v('p3_pm') + v('p3_pf') + v('p3_cm') + v('p3_cf');
    rows = [['Total workforce', fmt(hc)], ['Female share', hc ? `${fmt(((v('p3_pf') + v('p3_cf')) / hc) * 100, 1)}%` : '–'], ['LTIFR (month)', v('p3_manhrs') ? fmt((v('p3_lti') * 1e6) / v('p3_manhrs'), 2) : '–'], ['Female wage share', v('p3_wages') ? `${fmt((v('p3_wagesf') / v('p3_wages')) * 100, 1)}%` : '–']];
  } else if (principle === 'P8') {
    rows = [['MSME share of procurement', v('p8_proc') ? `${fmt((v('p8_msme') / v('p8_proc')) * 100, 1)}%` : '–']];
  } else return null;
  return (
    <div className="bg-slate-900 text-white rounded-xl p-4">
      <h3 className="text-xs font-bold text-slate-400 flex items-center gap-2 mb-3"><Calculator size={14} /> Live calculation (system-derived)</h3>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">{rows.map(([k, val]) => <div key={k}><dt className="text-[11px] text-slate-400">{k}</dt><dd className="text-lg font-black">{val}</dd></div>)}</dl>
      <p className="text-[10px] text-slate-500 mt-2">Emission factors are illustrative; the Group ESG team maintains the approved set.</p>
    </div>
  );
}

export default function DataEntry() {
  const { user, org, calc, toast } = useApp();
  const [sp] = useSearchParams();
  const isManager = user.role === 'manager';
  const projects = useMemo(() => (isManager ? org.projects.filter((p) => p.buId === user.buId) : org.projects.filter((p) => p.id === user.projectId)), [org, user, isManager]);
  const [projectId, setProjectId] = useState(projects[0]?.id);
  const [period, setPeriod] = useState('2026-09');
  const [principle, setPrinciple] = useState(PRINCIPLES.some((p) => p.id === sp.get('principle')) ? sp.get('principle') : 'P6');
  const [tier, setTier] = useState('essential');
  const [values, setValues] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const project = org.projects.find((p) => p.id === projectId);
  const existing = calc.byKey.get(`${projectId}|${period}|${principle}`);
  const locked = existing && ['submitted', 'approved'].includes(existing.status);
  const status = calc.projectStatus(projectId, period);
  const pr = principleOf(principle);
  const fileRef = useRef({});

  const [
    uploadingEvidence,
    setUploadingEvidence,
  ] = useState({});

  useEffect(() => { setValues(existing ? structuredClone(existing.values) : {}); setAttempted(false); }, [projectId, period, principle, existing?.id, existing?.status]); // eslint-disable-line
  useEffect(() => { const p = sp.get('principle'); if (p && PRINCIPLES.some((x) => x.id === p)) setPrinciple(p); }, [sp]);

  //An effect that loads the database submission.
  useEffect(() => {
    let cancelled = false;

    async function loadSubmission() {
      if (!projectId) {
        setExisting(null);
        return;
      }

      try {
        const result =
          await submissionApi.listSubmissions({
            projectId,
            reportingPeriodId: period,
          });

        const found = result.items.find(
          (item) =>
            item.principle === principle
        );

        if (!cancelled) {
          setExisting(found || null);
        }
      } catch (error) {
        if (!cancelled) {
          toast(error.message, 'error');
        }
      }
    }

    loadSubmission();

    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    period,
    principle,
    toast,
  ]);

  const result = useMemo(() => validateValues({ principle, values, project, period, calc }), [principle, values, project, period, calc]);
  const fields = pr.indicators.filter((i) => (tier === 'essential' ? !i.lead : i.lead));
  const setVal = (id, v) => setValues((s) => ({ ...s, [id]: { ev: '', ...s[id], v } }));
  const setEv = (id, name) => setValues((s) => ({ ...s, [id]: { v: '', ...s[id], ev: name } }));
  const msgFor = (id) => [...result.errors.filter((e) => e.id === id).map((e) => ({ ...e, sev: 'err' })), ...result.warnings.filter((w) => w.id === id).map((w) => ({ ...w, sev: 'warn' }))];
  const actor = { name: user.name, role: user.role };

  const onFile = async (
    id,
    file
  ) => {
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
      setUploadingEvidence(
        (current) => ({
          ...current,
          [id]: true,
        })
      );

      /*
       * First make sure an ESG value exists
       * in the backend. This creates the
       * submission/value row when necessary.
       */
      const draftValues =
        Object.fromEntries(
          Object.entries(
            values
          ).map(
            ([code, cell]) => [
              code,
              {
                v:
                  cell?.v ?? '',
                ev: '',
              },
            ]
          )
        );

      const submission =
        await submissionApi.saveSubmission(
          projectId,
          period,
          principle,
          draftValues,
          false
        );

      const valueRow =
        submission?.values?.[
        id
        ];

      if (
        !valueRow?.id
      ) {
        throw new Error(
          'Backend ESG value ID was not returned.'
        );
      }


      /*
       * Upload physical document.
       */
      const document =
        await evidenceApi.uploadDocument(
          file
        );


      /*
       * Link document to the
       * actual esg_values.id.
       */
      await evidenceApi.linkDocumentToValue(
        document.id,
        valueRow.id,
        `${principle} · ${id}`
      );


      /*
       * Store document ID in the form,
       * not just the filename.
       */
      setValues(
        (current) => ({
          ...current,

          [id]: {
            ...(current[id] || {}),
            v:
              current[id]?.v ??
              '',
            ev:
              document.id,
            evName:
              document.name,
          },
        })
      );

      toast(
        `${document.name} uploaded and linked successfully.`
      );
    } catch (error) {
      toast(
        error.message,
        'error'
      );
    } finally {
      setUploadingEvidence(
        (current) => ({
          ...current,
          [id]: false,
        })
      );
    }
  };

  //Data save function.
  const save = async () => {
    try {
      setSaving(true);

      await submissionApi.saveSubmission(
        projectId,
        period,
        principle,
        values,
        false
      );

      toast(
        `Draft saved for ${principle}.`
      );
    } catch (error) {
      toast(
        error.message,
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  //final submit.
  const doSubmit = async () => {
    try {
      setSaving(true);

      const saved =
        await submissionApi.saveSubmission(
          projectId,
          period,
          principle,
          values,
          true
        );

      setExisting(saved);
      setConfirm(null);

      toast(
        `${principle} submitted to the BU verification queue.`
      );
    } catch (error) {
      toast(
        error.message,
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    setAttempted(true);
    if (result.errors.length) { toast(`Fix ${result.errors.length} error${result.errors.length > 1 ? 's' : ''} before submitting.`, 'error'); return; }
    const filled = Object.values(values).some((c) => c.v !== '' && c.v != null);
    if (!filled) { toast('Enter at least one value.', 'error'); return; }
    if (result.warnings.length) setConfirm(result.warnings); else doSubmit();
  };

  if (!project) return <Card>No project is assigned to your profile.</Card>;
  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Project Data Capture" subtitle="Enter site-level metrics mapped to SEBI's 9 BRSR principles. Attach evidence to each value — BRSR Core data is assured against it." />

      <Card className="grid grid-cols-1 md:grid-cols-3 gap-4" >
        <div>
          <label className={labelCls} htmlFor="prj">Project / site</label>
          {isManager ? <select id="prj" className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            : <div className="px-3 py-2.5 text-sm font-bold bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2"><Lock size={13} className="text-slate-400" />{project.name}</div>}
        </div>
        <div><label className={labelCls}>Business unit · Subsidiary</label><div className="px-3 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-700 truncate">{calc.buById.get(project.buId).name} · {calc.subById.get(project.subId).name}</div></div>
        <div><label className={labelCls} htmlFor="period">Reporting period</label>
          <select id="period" className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)}>{openPeriods().map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}</select></div>
      </Card>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 overflow-x-auto" role="tablist" aria-label="BRSR principles">
        <div className="flex gap-2 min-w-max">
          {PRINCIPLES.map((p) => (
            <button key={p.id} role="tab" aria-selected={principle === p.id} onClick={() => setPrinciple(p.id)}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-lg transition flex items-center gap-2 border ${principle === p.id ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border-transparent'}`}>
              <span className={`px-2 py-0.5 rounded text-[10px] ${principle === p.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{p.id}</span>{p.label}
              <span className={`h-2 w-2 rounded-full ${DOT[status[p.id]]}`} title={status[p.id]} />
            </button>
          ))}
        </div>
      </div>

      {existing?.status === 'correction_required' && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex gap-3 text-sm text-rose-900"><MessageSquareWarning className="shrink-0 mt-0.5" size={18} /><div><b>Correction requested by {existing.reviewer?.name}:</b> {existing.reviewer?.comment}<p className="text-xs text-rose-700 mt-1">Fix the flagged values or evidence, then re-submit.</p></div></div>
      )}
      {existing?.status === 'rejected' && <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-900"><b>Rejected by {existing.reviewer?.name}:</b> {existing.reviewer?.comment}</div>}
      {locked && <div className="p-4 rounded-xl border border-slate-200 bg-slate-100 flex gap-3 text-sm text-slate-700 items-center"><Lock size={18} /> <span>This packet is <b>{existing.status === 'approved' ? 'approved and locked' : 'awaiting BU review'}</b>. It can't be edited{existing.status === 'approved' ? ' — raise a correction request with your BU Manager if a value is wrong.' : ' until the reviewer responds.'}</span><span className="ml-auto"><StatusBadge status={existing.status} /></span></div>}

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-5 gap-4">
          <div><h2 className="text-sm font-bold text-slate-800">{principle} · {pr.label}</h2><p className="text-xs text-slate-500 mt-1">{periodLabel(period)} · {project.name}</p></div>
          <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0" role="group">
            {[['essential', 'Essential (mandatory)'], ['leadership', 'Leadership (voluntary)']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTier(k)} className={`px-4 py-2 text-xs font-bold rounded-md transition ${tier === k ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="bg-blue-50 text-blue-800 p-3.5 rounded-xl flex items-start gap-3 text-xs font-medium mb-6 border border-blue-100 leading-relaxed">
          <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
          <p>Fields marked <b>*</b> are required (enter 0 if nothing occurred). <Badge tone="rose" className="mx-0.5">Core</Badge> fields feed SEBI's BRSR Core assurance — attach the bill, log or register that supports the number.</p>
        </div>

        {fields.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No {tier} indicators for this principle.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {fields.map((f) => {
            const c = values[f.id] || {}; const msgs = attempted || msgFor(f.id).some((m) => m.kind === 'spike' || m.kind === 'drop') ? msgFor(f.id) : [];
            const h = c.v !== '' && c.v != null ? null : calc.historyAvg(project, f.id, period);
            return (
              <div key={f.id}>
                <label className={labelCls} htmlFor={f.id}>{f.label.trim()} {f.req && <span className="text-rose-500">*</span>} {f.core && <Badge tone="rose" className="ml-1 align-middle">Core</Badge>}</label>
                <div className="flex shadow-sm rounded-lg">
                  <input id={f.id} type="number" min="0" step={f.int ? 1 : 0.01} inputMode="decimal" disabled={locked} placeholder={h?.avg != null ? `6-mo avg ${fmt(h.avg, f.int ? 0 : 1)}` : '0'} value={c.v ?? ''} onChange={(e) => setVal(f.id, e.target.value)}
                    className={`w-full bg-slate-50 border border-slate-300 border-r-0 rounded-l-lg px-3 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60 ${msgs.some((m) => m.sev === 'err') ? 'border-rose-400 bg-rose-50' : ''}`} />
                  <span className="inline-flex items-center px-3 border border-slate-300 bg-slate-100 text-slate-500 text-xs font-bold rounded-r-lg whitespace-nowrap min-w-[92px] justify-center">{f.unit}</span>
                </div>
                {f.ev && (
                  <div className="mt-1.5 flex items-center gap-2 min-h-6">
                    {c.ev ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 max-w-full">
                        <Paperclip
                          size={11}
                          className="shrink-0"
                        />

                        <span className="truncate">
                          {c.evName ||
                            `Evidence ${String(
                              c.ev
                            ).slice(0, 8)}`}
                        </span>

                        {!locked && (
                          <button
                            type="button"
                            onClick={() =>
                              setEv(
                                f.id,
                                ''
                              )
                            }
                            aria-label="Remove file"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </span>
                    ) : !locked ? (
                      <>
                        <input
                          ref={(el) => {
                            fileRef.current[
                              f.id
                            ] = el;
                          }}
                          type="file"
                          className="hidden"
                          onChange={(e) =>
                            onFile(
                              f.id,
                              e.target.files?.[0]
                            )
                          }
                        />

                        <button
                          type="button"
                          disabled={
                            uploadingEvidence[f.id]
                          }
                          onClick={() =>
                            fileRef.current[
                              f.id
                            ]?.click()
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-700 border border-dashed border-slate-300 hover:border-blue-400 rounded px-2 py-0.5 disabled:opacity-50"
                        >
                          <UploadCloud
                            size={12}
                          />

                          {uploadingEvidence[
                            f.id
                          ]
                            ? 'Uploading…'
                            : 'Attach evidence'}
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
                {msgs.map((m, i) => <p key={i} className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${m.sev === 'err' ? 'text-rose-600' : 'text-amber-600'}`}>{m.sev === 'err' ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}{m.msg}</p>)}
              </div>
            );
          })}
        </div>
      </Card>

      <LivePreview principle={principle} values={values} />

      <div className="sticky bottom-3 z-20">
        <div className="bg-white/95 backdrop-blur border border-slate-200 shadow-lg rounded-xl p-3 flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-500 mr-auto flex items-center gap-2">{existing ? <StatusBadge status={existing.status} /> : <Badge>New packet</Badge>}{attempted && result.errors.length > 0 && <span className="text-rose-600 font-bold">{result.errors.length} error(s)</span>}{result.warnings.length > 0 && <span className="text-amber-600 font-bold">{result.warnings.length} warning(s)</span>}{isManager && <span>Entered on behalf of site · flagged in audit log</span>}</div>
          <Btn tone="ghost" onClick={save} disabled={locked}><Save size={16} /> Save draft</Btn>
          <Btn tone="primary" onClick={submit} disabled={locked}><Send size={16} /> {existing?.status === 'correction_required' ? 'Re-submit for verification' : 'Submit for verification'}</Btn>
        </div>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Submit with warnings?" subtitle="Your BU Manager will see these flags next to each value."
        footer={<><Btn tone="ghost" onClick={() => setConfirm(null)}>Go back & fix</Btn><Btn tone="warn" onClick={doSubmit}><CheckCircle2 size={16} /> Submit anyway</Btn></>}>
        <ul className="space-y-2">{confirm?.map((w, i) => <li key={i} className="flex gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span><b>{principleOf(principle).indicators.find((x) => x.id === w.id)?.label.trim()}:</b> {w.msg}</span></li>)}</ul>
      </Modal>
    </div>
  );
}

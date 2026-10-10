import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, FileText, TableProperties, Braces, Code2, Printer, ShieldCheck, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import HierarchyFilter from '../../components/HierarchyFilter';
import { useApp } from '../../store/AppStore';
import { CURRENT_PERIOD, CORE_ATTRS, PRINCIPLES } from '../../data/brsr';
import { fmt } from '../../lib/consolidate';
import { buildReportModel, toCSV, toJSON, toXML, download, printReport } from '../../lib/exporters';
import { ICON_TONE, Card, CardHeader, PageHeader, Badge, Btn, Table, inputCls, labelCls } from '../../components/ui';
import reportApi from '../../services/reportApi';
import organizationApi from '../../services/organizationApi';

export default function Reports() {
  const {
    state,
    calc,
    ui,
    user,
    actions,
    toast,
  } = useApp();

  const [backendOrganizationId, setBackendOrganizationId] =
    useState(null);

  const [backendReportingPeriodId, setBackendReportingPeriodId] =
    useState(null);

  const [readiness, setReadiness] =
    useState(null);

  const [generatedReports, setGeneratedReports] =
    useState([]);

  const [generating, setGenerating] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendReportingContext() {
      try {
        const [tree, periods, reports] = await Promise.all([
          organizationApi.getOrgTree().catch(() => null),
          organizationApi.getReportingPeriods().catch(() => []),
          reportApi.listReports().catch(() => []),
        ]);

        if (cancelled) return;

        if (reports) {
          setGeneratedReports(reports);
        }

        const organizationId = tree?.id || tree?.org?.id || state.org?.id || 'meil';

        const periodList = Array.isArray(periods) ? periods : [];
        const reportingPeriod =
          periodList.find((p) => p.financialYear === ui.fy && p.periodType === 'FINANCIAL_YEAR') ||
          periodList.find((p) => p.financialYear === ui.fy) ||
          periodList[0];

        const periodId = reportingPeriod?.id || ui.fy;

        setBackendOrganizationId(organizationId);
        setBackendReportingPeriodId(periodId);

        if (organizationId && periodId) {
          try {
            const ready = await reportApi.getReportReadiness({
              reportingPeriodId: periodId,
              organizationId,
              scopeType:
                ui.scope.level === 'group'
                  ? 'GROUP'
                  : ui.scope.level === 'sub'
                    ? 'SUBSIDIARY'
                    : ui.scope.level === 'bu'
                      ? 'BUSINESS_UNIT'
                      : 'PROJECT',
              scopeId: ui.scope.level === 'group' ? null : ui.scope.id,
            });
            if (!cancelled && ready) {
              setReadiness(ready);
            }
          } catch {
            /* Readiness check optional for report generation */
          }
        }
      } catch (error) {
        if (!cancelled) {
          toast(error.message, 'error');
        }
      }
    }

    loadBackendReportingContext();

    return () => {
      cancelled = true;
    };
  }, [
    ui.fy,
    ui.scope,
    toast,
  ]);

  const [busy, setBusy] = useState(false);
  const rc = state.reportConfig || { package: 'comprehensive', includeValueChain: true, disclosureType: 'assurance' };
  const setRc = (patch) => actions.setReportConfig(patch);
  const model = useMemo(() => buildReportModel({ calc, state, fy: ui.fy, scope: ui.scope, boundary: ui.boundary, reportConfig: rc }), [calc, state, ui, rc]);
  const cov = calc.coverage(ui.scope, CURRENT_PERIOD, ui.boundary);
  const A = state.disclosures?.A || {};
  const gaps = [];
  if (!A?.cin) gaps.push('Section A: CIN is empty.'); if (!A?.incorporationYear) gaps.push('Section A: year of incorporation is empty.');
  if (!state.disclosures?.B?.directorStatement) gaps.push("Section B: director's statement is empty.");
  if (!state.disclosures?.core8?.payablesDays) gaps.push('BRSR Core 8 & 9: entity-level financial figures not entered.');
  const pendingOps = model.core.filter((c) => c.assurance.status === 'Pending').length;
  if (pendingOps) gaps.push(`${pendingOps} of 9 BRSR Core attributes have no ${rc?.disclosureType === 'assessment' ? 'assessment' : 'assurance'} opinion for ${ui.fy}.`);
  if (cov.counts.submitted + cov.counts.correction_required > 0) gaps.push(`${cov.counts.submitted + cov.counts.correction_required} packets for the open month are still awaiting BU approval and are excluded.`);
  const base = `BRSR_DRAFT_${model.meta.scopeLabel.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}_${ui.fy.replace(/\s/g, '')}`;
  const out = async (kind) => {
    const orgId = backendOrganizationId || state.org?.id || 'meil';
    const periodId = backendReportingPeriodId || ui.fy;

    const formatMap = {
      pdf: 'PDF',
      zip: 'ZIP',
      csv: 'CSV',
      json: 'JSON',
      xml: 'XML',
    };

    const format = formatMap[kind];
    if (!format) return;

    try {
      setBusy(true);
      setGenerating(true);

      const scopeType =
        ui.scope.level === 'group'
          ? 'GROUP'
          : ui.scope.level === 'sub'
            ? 'SUBSIDIARY'
            : ui.scope.level === 'bu'
              ? 'BUSINESS_UNIT'
              : 'PROJECT';

      const report = await reportApi.generateReport({
        scopeType,
        scopeId: ui.scope.level === 'group' ? null : ui.scope.id,
        reportingPeriodId: periodId,
        organizationId: orgId,
        financialYear: ui.fy,
        boundaryMode: ui.boundary.mode,
        includeJv: ui.boundary.includeJV,
        package: rc.package,
        includeValueChain: rc.includeValueChain,
        disclosureType: rc.disclosureType,
        formats: format === 'ZIP' ? ['PDF', 'CSV', 'JSON', 'XML', 'ZIP'] : [format],
      });

      let blob;
      if (format === 'ZIP') {
        blob = await reportApi.downloadPackage(report.id);
      } else {
        blob = await reportApi.downloadReport(report.id, format);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.reportCode || report.code || 'BRSR_REPORT'}.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);

      toast(`${format} report generated and downloaded successfully.`);

      const reports = await reportApi.listReports().catch(() => []);
      setGeneratedReports(reports);
    } catch (error) {
      console.warn('Backend report generation error, evaluating client-side export fallback:', error);
      // Graceful fallback to client-side report exporters
      if (kind === 'csv') {
        download(`${base}.csv`, 'text/csv', toCSV(model));
        toast('CSV metric report exported (client-side fallback).', 'info');
      } else if (kind === 'json') {
        download(`${base}.json`, 'application/json', toJSON(model));
        toast('JSON report metadata exported (client-side fallback).', 'info');
      } else if (kind === 'xml') {
        download(`${base}.xml`, 'application/xml', toXML(model));
        toast('XBRL-style XML report exported (client-side fallback).', 'info');
      } else if (kind === 'pdf') {
        printReport(model);
        toast('Print preview opened for PDF save (fallback).', 'info');
      } else {
        toast(error.message || 'Failed to download report.', 'error');
      }
    } finally {
      setBusy(false);
      setGenerating(false);
    }
  };

  const handleDownloadExisting = async (reportId, format, reportCode) => {
    try {
      setBusy(true);
      let blob;
      if (format === 'ZIP') {
        blob = await reportApi.downloadPackage(reportId);
      } else {
        blob = await reportApi.downloadReport(reportId, format);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportCode || 'BRSR_REPORT'}.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      toast(`${format} downloaded successfully.`);
    } catch (err) {
      toast(err.message || 'Download failed', 'error');
    } finally {
      setBusy(false);
    }
  };
  
  const OUT = [
    ['pdf', FileText, 'rose', 'Official 35-Page BRSR PDF', 'Company-format full disclosure with Sections A, B, C and Forensics'],
    ['zip', ShieldCheck, 'indigo', 'Audit-Ready Package (ZIP)', 'Complete bundle: PDF, evidence files, extracted facts, Trust Scores & CAPA'],
    ['xml', Code2, 'emerald', 'XBRL-Style Draft XML', 'Machine-readable draft with SEBI taxonomy mapping hooks'],
    ['csv', TableProperties, 'sky', 'CSV Metric Dataset', 'Every indicator with FY and prior year baselines'],
    ['json', Braces, 'violet', 'JSON Metadata', 'Full report model & evidence graph for downstream ERPs'],
  ];
  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Statutory Reporting Hub" subtitle="Generate regulatory BRSR disclosure drafts across Group, Subsidiary, BU, or Project hierarchy scopes." />
      <HierarchyFilter />
      <Card>
        <div className="grid md:grid-cols-2 gap-5 mb-4">
          <div><label className={labelCls}>Scope of disclosure</label><div className="px-3 py-2.5 text-sm font-bold bg-slate-100 rounded-lg border border-slate-200 truncate">{model.meta.scopeLabel}</div></div>
          <div><label className={labelCls}>Boundary</label><div className="px-3 py-2.5 text-sm bg-slate-100 rounded-lg border border-slate-200">{model.meta.boundary}</div></div>
        </div>
        <p className={labelCls}>Report Configuration</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div><label className={labelCls} htmlFor="pkg">Coverage</label><select id="pkg" className={inputCls} value={rc.package} onChange={(e) => setRc({ package: e.target.value })}><option value="comprehensive">Comprehensive BRSR (Sections A, B, C)</option><option value="core">BRSR Core only (9-attribute subset)</option></select></div>
          <div><label className={labelCls} htmlFor="vc">Value-chain disclosures</label><select id="vc" className={inputCls} value={rc.includeValueChain ? 'yes' : 'no'} onChange={(e) => setRc({ includeValueChain: e.target.value === 'yes' })}><option value="yes">Include (Voluntary FY2025-26+)</option><option value="no">Not applicable this cycle</option></select></div>
          <div><label className={labelCls} htmlFor="dt">Assessment / assurance</label><select id="dt" className={inputCls} value={rc.disclosureType} onChange={(e) => setRc({ disclosureType: e.target.value })}><option value="assurance">Assurance</option><option value="assessment">Assessment</option><option value="none">Not applicable</option></select></div>
        </div>
        <p className="text-xs text-slate-500 mt-3 flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0" /> {model.meta.projects} projects in scope · {model.meta.reporting} with approved data.</p>
      </Card>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {OUT.map(([k, I, c, t, d]) => <button key={k} disabled={busy} onClick={() => out(k)} className="text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition group"><div className={`p-3 w-fit rounded-lg ${ICON_TONE[c]} mb-3`}><I size={22} /></div><h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">{t}{k === 'pdf' ? <Printer size={16} className="text-slate-400 group-hover:text-blue-600" /> : <FileDown size={16} className="text-slate-400 group-hover:text-blue-600" />}</h3><p className="text-xs text-slate-500 mt-1">{d}</p></button>)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card pad={false}><CardHeader title="Readiness checks" right={gaps.length ? <Badge tone="amber">{gaps.length} open</Badge> : <Badge tone="emerald">Ready</Badge>} />
          <ul className="divide-y divide-slate-100 text-sm">{gaps.length === 0 && <li className="p-4 flex gap-2 text-emerald-700"><CheckCircle2 size={16} /> All checks passed.</li>}{gaps.map((g) => <li key={g} className="p-4 flex gap-2 text-slate-700"><AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />{g}</li>)}</ul>
        </Card>
        <Card pad={false} className="lg:col-span-2"><CardHeader title="Report preview — BRSR Core" subtitle={`${model.meta.fy} vs previous year · ${rc.disclosureType === 'none' ? 'No assessment/assurance' : rc.disclosureType}`} icon={ShieldCheck} />
          <div className="max-h-[420px] overflow-y-auto"><Table head={['Attribute / metric', 'Unit', { label: model.meta.fy, right: true }, { label: 'Previous', right: true }, 'Status']}>
            {model.core.flatMap((c) => c.metrics.map((mt, i) => (<tr key={c.id + i} className="hover:bg-slate-50"><td className="px-4 py-2.5">{i === 0 && <b className="block text-[11px] text-slate-400">{c.label}</b>}{mt.label}</td><td className="px-4 py-2.5 text-xs text-slate-500">{mt.unit}</td><td className="px-4 py-2.5 text-right font-bold tabular-nums">{mt.cur == null ? '–' : fmt(mt.cur, mt.d ?? 1)}</td><td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{mt.prev == null ? '–' : fmt(mt.prev, mt.d ?? 1)}</td><td className="px-4 py-2.5">{i === 0 && <Badge tone={c.assurance.status === 'Pending' ? 'amber' : 'emerald'}>{c.assurance.status}</Badge>}</td></tr>)))}
          </Table></div></Card>
      </div>

      {/* Generated Reports Archive */}
      {generatedReports.length > 0 && (
        <Card pad={false}>
          <CardHeader
            title="Generated Reports Archive"
            subtitle={`${generatedReports.length} regulatory disclosure package(s) on file in backend repository`}
            icon={FileText}
          />
          <div className="overflow-x-auto">
            <Table head={['Report Code', 'Scope', 'Package', 'Generated At', 'Downloads']}>
              {generatedReports.slice(0, 10).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 text-xs">
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">{r.code || r.reportCode}</td>
                  <td className="px-4 py-3"><Badge tone="slate">{r.scopeType}</Badge></td>
                  <td className="px-4 py-3 font-medium text-slate-700">{r.package}</td>
                  <td className="px-4 py-3 text-slate-500">{r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '–'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        disabled={busy}
                        onClick={() => handleDownloadExisting(r.id, 'PDF', r.code)}
                        className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold border border-rose-200 transition text-[11px]"
                      >
                        PDF
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => handleDownloadExisting(r.id, 'ZIP', r.code)}
                        className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold border border-indigo-200 transition text-[11px]"
                      >
                        ZIP Package
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>
      )}

      <p className="text-[11px] text-slate-400">{PRINCIPLES.length} Principles · {CORE_ATTRS.length} Core attributes · Generated for {user.name}.</p>
    </div>
  );
}

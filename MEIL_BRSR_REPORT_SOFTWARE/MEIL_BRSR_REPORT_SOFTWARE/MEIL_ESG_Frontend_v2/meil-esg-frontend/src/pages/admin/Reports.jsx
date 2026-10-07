import React, { useMemo, useState } from 'react';
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
        const [
          tree,
          periods,
        ] = await Promise.all([
          organizationApi.getOrgTree(),
          organizationApi.getReportingPeriods(),
        ]);

        if (cancelled) return;

        const organizationId =
          tree?.org?.id || null;

        const reportingPeriod =
          periods.find(
            (p) =>
              p.financialYear === ui.fy &&
              p.periodType ===
              'FINANCIAL_YEAR'
          ) ||
          periods.find(
            (p) =>
              p.financialYear ===
              ui.fy
          );

        setBackendOrganizationId(
          organizationId
        );

        setBackendReportingPeriodId(
          reportingPeriod?.id || null
        );

        if (
          organizationId &&
          reportingPeriod?.id
        ) {
          const [
            ready,
            reports,
          ] = await Promise.all([
            reportApi.getReportReadiness({
              reportingPeriodId:
                reportingPeriod.id,

              organizationId,

              scopeType:
                ui.scope.level ===
                  'group'
                  ? 'GROUP'
                  : ui.scope.level ===
                    'sub'
                    ? 'SUBSIDIARY'
                    : ui.scope.level ===
                      'bu'
                      ? 'BUSINESS_UNIT'
                      : 'PROJECT',

              scopeId:
                ui.scope.level ===
                  'group'
                  ? null
                  : ui.scope.id,
            }),

            reportApi.listReports(),
          ]);

          if (!cancelled) {
            setReadiness(ready);
            setGeneratedReports(
              reports
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          toast(
            error.message,
            'error'
          );
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
  const rc = state.reportConfig;
  const setRc = (patch) => actions.setReportConfig(patch);
  const model = useMemo(() => buildReportModel({ calc, state, fy: ui.fy, scope: ui.scope, boundary: ui.boundary, reportConfig: rc }), [calc, state, ui, rc]);
  const cov = calc.coverage(ui.scope, CURRENT_PERIOD, ui.boundary);
  const A = state.disclosures.A;
  const gaps = [];
  if (!A.cin) gaps.push('Section A: CIN is empty.'); if (!A.incorporationYear) gaps.push('Section A: year of incorporation is empty.');
  if (!state.disclosures.B.directorStatement) gaps.push("Section B: director's statement is empty.");
  if (!state.disclosures.core8.payablesDays) gaps.push('BRSR Core 8 & 9: entity-level financial figures not entered.');
  const pendingOps = model.core.filter((c) => c.assurance.status === 'Pending').length;
  if (pendingOps) gaps.push(`${pendingOps} of 9 BRSR Core attributes have no ${rc.disclosureType === 'assessment' ? 'assessment' : 'assurance'} opinion for ${ui.fy}.`);
  if (cov.counts.submitted + cov.counts.correction_required > 0) gaps.push(`${cov.counts.submitted + cov.counts.correction_required} packets for the open month are still awaiting BU approval and are excluded.`);
  const base = `BRSR_DRAFT_${model.meta.scopeLabel.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}_${ui.fy.replace(/\s/g, '')}`;
  const out = async (
    kind
  ) => {
    if (
      !backendOrganizationId ||
      !backendReportingPeriodId
    ) {
      toast(
        'Backend organization or reporting period is not available.',
        'error'
      );
      return;
    }

    const formatMap = {
      pdf: 'PDF',
      csv: 'CSV',
      json: 'JSON',
      xml: 'XML',
    };

    const format =
      formatMap[kind];

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

      const report =
        await reportApi.generateReport({
          scopeType,

          scopeId:
            ui.scope.level ===
              'group'
              ? null
              : ui.scope.id,

          reportingPeriodId:
            backendReportingPeriodId,

          organizationId:
            backendOrganizationId,

          financialYear:
            ui.fy,

          boundaryMode:
            ui.boundary.mode,

          includeJv:
            ui.boundary.includeJV,

          package:
            rc.package,

          includeValueChain:
            rc.includeValueChain,

          disclosureType:
            rc.disclosureType,

          formats: [format],
        });

      const blob =
        await reportApi.downloadReport(
          report.id,
          format
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const a =
        document.createElement(
          'a'
        );

      a.href = url;

      a.download =
        `${report.code}.${format.toLowerCase()}`;

      document.body.appendChild(
        a
      );

      a.click();

      a.remove();

      URL.revokeObjectURL(
        url
      );

      toast(
        `${format} report generated from the Flask backend.`
      );

      const reports =
        await reportApi.listReports();

      setGeneratedReports(
        reports
      );
    } catch (error) {
      toast(
        error.message,
        'error'
      );
    } finally {
      setBusy(false);
      setGenerating(false);
    }
  };
  
  const OUT = [['pdf', FileText, 'rose', 'BRSR draft / preview', 'Print-ready A4 — for internal review before filing, not a filed report'], ['xml', Code2, 'emerald', 'XBRL-style draft XML', 'Machine-readable draft; needs SEBI taxonomy mapping to actually file'], ['csv', TableProperties, 'sky', 'CSV dataset', 'Every indicator, current + previous year'], ['json', Braces, 'violet', 'JSON', 'Full report model for downstream systems']];
  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Statutory reporting hub" subtitle="Assemble a BRSR draft for any level of the hierarchy — group, subsidiary, business unit or project. Every export is clearly labelled as a draft: a company secretary / statutory auditor still reviews and signs off before it is filed." />
      <HierarchyFilter />
      <Card>
        <div className="grid md:grid-cols-2 gap-5 mb-4">
          <div><label className={labelCls}>Scope of disclosure</label><div className="px-3 py-2.5 text-sm font-bold bg-slate-100 rounded-lg border border-slate-200 truncate">{model.meta.scopeLabel}</div></div>
          <div><label className={labelCls}>Boundary</label><div className="px-3 py-2.5 text-sm bg-slate-100 rounded-lg border border-slate-200">{model.meta.boundary}</div></div>
        </div>
        <p className={labelCls}>Report package — BRSR Core is a subset of the comprehensive report, not a replacement for it</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div><label className={labelCls} htmlFor="pkg">Coverage</label><select id="pkg" className={inputCls} value={rc.package} onChange={(e) => setRc({ package: e.target.value })}><option value="comprehensive">Comprehensive BRSR (Sections A, B, C)</option><option value="core">BRSR Core only (9-attribute subset)</option></select></div>
          <div><label className={labelCls} htmlFor="vc">Value-chain disclosures</label><select id="vc" className={inputCls} value={rc.includeValueChain ? 'yes' : 'no'} onChange={(e) => setRc({ includeValueChain: e.target.value === 'yes' })}><option value="yes">Include (voluntary for top-250 entities, FY2025-26+)</option><option value="no">Not applicable this cycle</option></select></div>
          <div><label className={labelCls} htmlFor="dt">Assessment / assurance</label><select id="dt" className={inputCls} value={rc.disclosureType} onChange={(e) => setRc({ disclosureType: e.target.value })}><option value="assurance">Assurance</option><option value="assessment">Assessment</option><option value="none">Not applicable</option></select></div>
        </div>
        <p className="text-xs text-slate-500 mt-3 flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0" /> Financial year and hierarchy are set above. {model.meta.projects} projects in scope, {model.meta.reporting} with approved data. SEBI now allows entities to choose assessment or assurance for BRSR Core — this selector doesn't hard-code one.</p>
      </Card>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {OUT.map(([k, I, c, t, d]) => <button key={k} disabled={busy} onClick={() => out(k)} className="text-left p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition group"><div className={`p-3 w-fit rounded-lg ${ICON_TONE[c]} mb-3`}><I size={22} /></div><h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">{t}{k === 'pdf' ? <Printer size={16} className="text-slate-400 group-hover:text-blue-600" /> : <FileDown size={16} className="text-slate-400 group-hover:text-blue-600" />}</h3><p className="text-xs text-slate-500 mt-1">{d}</p></button>)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card pad={false}><CardHeader title="Readiness checks" right={gaps.length ? <Badge tone="amber">{gaps.length} open</Badge> : <Badge tone="emerald">Ready</Badge>} />
          <ul className="divide-y divide-slate-100 text-sm">{gaps.length === 0 && <li className="p-4 flex gap-2 text-emerald-700"><CheckCircle2 size={16} /> All checks passed.</li>}{gaps.map((g) => <li key={g} className="p-4 flex gap-2 text-slate-700"><AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />{g}</li>)}</ul>
          <p className="p-4 pt-0 text-[11px] text-slate-400">Drafts can still be exported; open items are listed in the output as pending.</p></Card>
        <Card pad={false} className="lg:col-span-2"><CardHeader title="Report preview — BRSR Core" subtitle={`${model.meta.fy} vs previous year · ${rc.disclosureType === 'none' ? 'no assessment/assurance selected' : rc.disclosureType}`} icon={ShieldCheck} />
          <div className="max-h-[420px] overflow-y-auto"><Table head={['Attribute / metric', 'Unit', { label: model.meta.fy, right: true }, { label: 'Previous', right: true }, 'Status']}>
            {model.core.flatMap((c) => c.metrics.map((mt, i) => (<tr key={c.id + i} className="hover:bg-slate-50"><td className="px-4 py-2.5">{i === 0 && <b className="block text-[11px] text-slate-400">{c.label}</b>}{mt.label}</td><td className="px-4 py-2.5 text-xs text-slate-500">{mt.unit}</td><td className="px-4 py-2.5 text-right font-bold tabular-nums">{mt.cur == null ? '–' : fmt(mt.cur, mt.d ?? 1)}</td><td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{mt.prev == null ? '–' : fmt(mt.prev, mt.d ?? 1)}</td><td className="px-4 py-2.5">{i === 0 && <Badge tone={c.assurance.status === 'Pending' ? 'amber' : 'emerald'}>{c.assurance.status}</Badge>}</td></tr>)))}
          </Table></div></Card>
      </div>
      <p className="text-[11px] text-slate-400">Report covers {PRINCIPLES.length} principles, {CORE_ATTRS.length} Core attributes. Generated by {user.name}. Emission factors are illustrative until the Group ESG team loads approved factors.</p>
    </div>
  );
}

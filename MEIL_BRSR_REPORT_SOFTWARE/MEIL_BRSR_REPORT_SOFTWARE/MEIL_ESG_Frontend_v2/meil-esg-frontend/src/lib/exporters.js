import { PRINCIPLES, CORE_ATTRS, CORE8_FAIRNESS, CORE9_OPENNESS, INDICATORS, prevFY, SDGS, STAKEHOLDER_GROUPS, vendorEmissions, vendorShare } from '../data/brsr';
import { fmt } from './consolidate';

export const scopeName = (org, scope) => {
  if (scope.level === 'group') return org.group.name;
  if (scope.level === 'sub') return org.subsidiaries.find((s) => s.id === scope.id)?.name || scope.id;
  if (scope.level === 'bu') return org.bus.find((b) => b.id === scope.id)?.name || scope.id;
  return org.projects.find((p) => p.id === scope.id)?.name || scope.id;
};
export const boundaryLabel = (b) => (b.mode === 'standalone' ? 'Standalone (parent entity only)' : `Consolidated (parent + subsidiaries${b.includeJV ? ' + JVs' : ''})`);
export const packageLabel = (rc) => `${rc.package === 'core' ? 'BRSR Core (subset)' : 'Comprehensive BRSR'}${rc.includeValueChain ? ' + value-chain' : ''} · ${rc.disclosureType === 'assurance' ? 'Assurance' : rc.disclosureType === 'assessment' ? 'Assessment' : 'Not applicable'}`;

export function buildReportModel({ calc, state, fy, scope, boundary, reportConfig }) {
  const { org } = calc; const pfy = prevFY(fy);
  const cur = calc.nodeTotals(scope, fy, boundary), prev = calc.nodeTotals(scope, pfy, boundary);
  const corePrincipleOnly = reportConfig.package === 'core';
  const principles = PRINCIPLES.map((p) => ({
    id: p.id, label: p.label, sdg: p.sdg,
    rows: p.indicators.filter((i) => !corePrincipleOnly || i.core).map((i) => ({ id: i.id, label: i.label.trim(), unit: i.unit, essential: !i.lead, core: i.core || '', cur: cur.t[i.id], prev: prev.t[i.id] })),
  })).filter((p) => !corePrincipleOnly || p.rows.length);
  const K = cur.kpi, Kp = prev.kpi; const ops = state.assuranceOpinions[fy] || {}; const c8 = state.disclosures.core8 || {}; const c9 = state.disclosures.core9 || {};
  const m = (label, unit, key, d = 1) => ({ label, unit, cur: K[key], prev: Kp[key], d });
  const num = (v) => (v === '' || v == null ? null : +v);
  const coreMetrics = {
    ghg: [m('Scope 1 emissions', 'tCO2e', 'scope1'), m('Scope 2 emissions', 'tCO2e', 'scope2'), m('Total Scope 1+2', 'tCO2e', 'ghg'), m('GHG intensity per ₹ crore turnover', 'tCO2e/₹ Cr', 'ghgIntensity', 2)],
    water: [m('Water withdrawn', 'KL', 'waterWithdrawn'), m('Water consumed (withdrawn − discharged; meter-derived)', 'KL', 'waterConsumed'), m('Water discharged', 'KL', 'waterDischarged'), m('Water intensity per ₹ crore', 'KL/₹ Cr', 'waterIntensity', 1)],
    energy: [m('Total energy consumed', 'GJ', 'energyGJ'), m('Renewable share of energy', '%', 'renewablePct'), m('Energy intensity per ₹ crore', 'GJ/₹ Cr', 'energyIntensity', 1)],
    circ: [m('Total waste generated', 'MT', 'waste'), m('Waste recovered / recycled', '%', 'wasteRecoveredPct'), m('Waste intensity per ₹ crore', 'MT/₹ Cr', 'wasteIntensity', 2)],
    safety: [m('LTIFR (per million man-hours)', 'ratio', 'ltifr', 2), m('Fatalities', 'Count', 'fatalities', 0), m('Recordable injuries', 'Count', 'injuries', 0), m('Wellbeing spend as % of turnover', '%', 'safetySpendPct', 3)],
    gender: [m('Gross wages paid to females', '% of total', 'femaleWagePct'), m('Female share of workforce', '%', 'femalePct'), { label: 'POSH complaints as % of women employees', unit: '%', cur: K.femalePct > 0 ? (cur.t.p5_posh / Math.max(1, K.headcount * K.femalePct / 100)) * 100 : null, prev: null, d: 2 }],
    inclusive: [m('Direct procurement from MSMEs / small producers', '% of total', 'msmePct'), { label: 'Direct sourcing within India', unit: '% of total', cur: cur.t.p8_proc ? (cur.t.p8_india / cur.t.p8_proc) * 100 : null, prev: prev.t.p8_proc ? (prev.t.p8_india / prev.t.p8_proc) * 100 : null, d: 1 }, { label: 'Wages paid in smaller / aspirational towns', unit: '% of total wages', cur: cur.t.p3_wages ? (cur.t.p8_jobsw / cur.t.p3_wages) * 100 : null, prev: prev.t.p3_wages ? (prev.t.p8_jobsw / prev.t.p3_wages) * 100 : null, d: 1 }],
    fair: CORE8_FAIRNESS.map((f) => ({ label: f.label, unit: f.unit, cur: num(c8[f.id]), prev: null, d: 1, entity: true })),
    open: CORE9_OPENNESS.map((f) => ({ label: f.label, unit: f.unit, cur: num(c9[f.id]), prev: null, d: 1, entity: true })),
  };
  const core = CORE_ATTRS.map((a) => ({ id: a.id, label: a.label, sdg: a.sdg, metrics: coreMetrics[a.id], assurance: ops[a.id] || { status: 'Pending' } }));
  const vend = state.vendorRequests.filter((r) => r.status === 'accepted');
  const s3v = vend.reduce((acc, r) => acc + vendorEmissions(r.values) * vendorShare(r.values), 0);
  return {
    meta: {
      entity: org.group.name, scopeLabel: scopeName(org, scope), fy, boundary: boundaryLabel(boundary),
      package: reportConfig.package, disclosureType: reportConfig.disclosureType, includeValueChain: reportConfig.includeValueChain,
      packageLabel: packageLabel(reportConfig), generatedAt: new Date().toISOString(), projects: cur.projects, reporting: cur.reporting, turnoverCr: cur.turnoverCr,
    },
    sectionA: state.disclosures.A, sectionB: state.disclosures.B, principles, core, kpi: K, kpiPrev: Kp,
    valueChain: reportConfig.includeValueChain ? { acceptedVendors: vend.length, scope3Allocated: s3v, methodologyNote: state.valueChainConfig.methodologyNote, applicability: state.valueChainConfig.applicability } : null,
  };
}

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function toCSV(model) {
  const rows = [['Section', 'Principle', 'Indicator ID', 'Indicator', 'Type', 'BRSR Core attribute', 'Unit', model.meta.fy, prevFY(model.meta.fy)]];
  model.principles.forEach((p) => p.rows.forEach((r) => rows.push(['C', p.id, r.id, r.label, r.essential ? 'Essential' : 'Leadership', r.core, r.unit, r.cur, r.prev])));
  model.core.forEach((c) => c.metrics.forEach((mt) => rows.push(['BRSR Core', c.label, '', mt.label, '', c.id, mt.unit, mt.cur, mt.prev])));
  return [`# ${model.meta.scopeLabel} | ${model.meta.boundary} | ${model.meta.fy} | ${model.meta.packageLabel} — DRAFT, generated by MEIL ESG Hub, not a filed SEBI submission`, ...rows.map((r) => r.map(q).join(','))].join('\n');
}
export const toJSON = (model) => JSON.stringify(model, null, 2);
export function toXML(model) {
  const e = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<!-- XBRL-STYLE DRAFT INSTANCE — NOT a filing-ready XBRL taxonomy instance. A filing-ready file needs the official SEBI/NSE BRSR taxonomy element mapping. -->`, `<BRSRDraft entity="${e(model.meta.entity)}" scope="${e(model.meta.scopeLabel)}" period="${e(model.meta.fy)}" boundary="${e(model.meta.boundary)}" package="${e(model.meta.packageLabel)}">`];
  model.principles.forEach((p) => { lines.push(`  <Principle id="${p.id}" name="${e(p.label)}">`); p.rows.forEach((r) => lines.push(`    <Indicator id="${r.id}" type="${r.essential ? 'Essential' : 'Leadership'}" unit="${e(r.unit)}"${r.core ? ` core="${r.core}"` : ''}><Current>${+r.cur.toFixed(3)}</Current><Previous>${+r.prev.toFixed(3)}</Previous></Indicator>`)); lines.push('  </Principle>'); });
  lines.push('  <BRSRCore>'); model.core.forEach((c) => lines.push(`    <Attribute id="${c.id}" disclosureStatus="${e(c.assurance.status)}">${c.metrics.map((mt) => `<Metric name="${e(mt.label)}" unit="${e(mt.unit)}">${mt.cur == null ? '' : +(+mt.cur).toFixed(3)}</Metric>`).join('')}</Attribute>`)); lines.push('  </BRSRCore>', '</BRSRDraft>');
  return lines.join('\n');
}

export function download(name, mime, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function printReport(model) {
  const e = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const A = model.sectionA, B = model.sectionB;
  const row = (r) => `<tr><td>${e(r.label)}</td><td>${e(r.unit)}</td><td class="n">${fmt(r.cur, 2)}</td><td class="n">${fmt(r.prev, 2)}</td></tr>`;
  const entityRows = { 'Entity name': A.entityName, CIN: A.cin || '—', 'Year of incorporation': A.incorporationYear || '—', 'Registered office': A.registeredOffice, 'Corporate office': A.corporateOffice || '—', Website: A.website || '—', 'Stock exchange(s)': A.stockExchanges || '—', 'Reporting boundary': A.boundaryDeclared, 'CSR applicable': A.csrApplicable };
  const stakeholderRows = STAKEHOLDER_GROUPS.map((g) => { const r = A.stakeholderComplaints[g]; return `<tr><td>${e(g)}</td><td>${r.mechanism}</td><td class="n">${r.curFiled}</td><td class="n">${r.curPending}</td><td class="n">${r.prevFiled}</td><td class="n">${r.prevPending}</td></tr>`; }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>BRSR Draft – ${e(model.meta.scopeLabel)} – ${e(model.meta.fy)}</title>
<style>body{font:12px/1.5 system-ui,Segoe UI,Arial;margin:32px;color:#0f172a}h1{font-size:22px;margin:0}h2{font-size:15px;border-bottom:2px solid #0f172a;padding-bottom:4px;margin-top:28px}h3{font-size:13px;margin:18px 0 6px}
table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #cbd5e1;padding:4px 8px;text-align:left}th{background:#f1f5f9}.n{text-align:right;font-variant-numeric:tabular-nums}.m{color:#475569}.b{display:inline-block;padding:1px 8px;border-radius:9px;background:#e2e8f0}.warn{background:#fef3c7;border:1px solid #fcd34d;padding:8px 12px;border-radius:8px;margin:12px 0}
@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style></head><body>
<div class="warn"><b>DRAFT / PREVIEW</b> — generated by the MEIL ESG Hub from approved site data. This is not the final, board-signed BRSR filed with SEBI/stock exchanges; the report designer, statutory auditor and company secretary should review it before filing.</div>
<h1>Business Responsibility & Sustainability Report — Draft</h1><p class="m">${e(model.meta.entity)} · ${e(model.meta.fy)} · ${e(model.meta.packageLabel)}<br>Scope: ${e(model.meta.scopeLabel)} · Boundary: ${e(model.meta.boundary)}<br>Generated ${new Date(model.meta.generatedAt).toLocaleString('en-IN')} · ${model.meta.projects} projects in scope, ${model.meta.reporting} with data. Emission factors are illustrative until the Group ESG team loads approved factors.</p>
<h2>Section A — General Disclosures</h2><table>${Object.entries(entityRows).map(([k, v]) => `<tr><th>${k}</th><td>${e(v)}</td></tr>`).join('')}</table>
<h3>Stakeholder grievance redressal</h3><table><tr><th>Stakeholder group</th><th>Mechanism</th><th>Cur. filed</th><th>Cur. pending</th><th>Prev. filed</th><th>Prev. pending</th></tr>${stakeholderRows}</table>
<h2>Section B — Management & Process</h2><table><tr><th>Principle</th><th>Policy</th><th>Board-approved</th><th>Extends to value chain</th><th>Target</th></tr>${PRINCIPLES.map((p) => `<tr><td>${p.id} ${e(p.label)}</td><td>${B.policies[p.id].hasPolicy}</td><td>${B.policies[p.id].boardApproved}</td><td>${B.policies[p.id].extendsToValueChain}</td><td>${e(B.policies[p.id].targets?.[0]?.target || '—')}</td></tr>`).join('')}</table>
<h2>BRSR Core${model.meta.package === 'core' ? '' : ' — subset within this comprehensive report'}</h2>${model.core.map((c) => `<h3>${e(c.label)} <span class="b">${e(c.assurance.status)}</span></h3><table><tr><th>Metric</th><th>Unit</th><th>${e(model.meta.fy)}</th><th>Previous</th></tr>${c.metrics.map((mt) => `<tr><td>${e(mt.label)}</td><td>${e(mt.unit)}</td><td class="n">${mt.cur == null ? '—' : fmt(mt.cur, mt.d ?? 1)}</td><td class="n">${mt.prev == null ? '—' : fmt(mt.prev, mt.d ?? 1)}</td></tr>`).join('')}</table>`).join('')}
<h2>Section C — Principle-wise Performance</h2>${model.principles.map((p) => `<h3>${p.id}: ${e(p.label)} <span class="m">(SDG ${p.sdg.join(', ')})</span></h3><table><tr><th>Indicator</th><th>Unit</th><th>${e(model.meta.fy)}</th><th>Previous</th></tr>${p.rows.map(row).join('')}</table>`).join('')}
${model.valueChain ? `<h2>Value chain / Scope 3 readiness (${e(model.valueChain.applicability === 'voluntary_top250' ? 'voluntary for top-250 entities, FY2025-26+' : model.valueChain.applicability)})</h2><p>Accepted vendor submissions: ${model.valueChain.acceptedVendors}. Internally allocated Scope 3 from vendor data: ${fmt(model.valueChain.scope3Allocated, 0)} tCO2e.<br><span class="m">${e(model.valueChain.methodologyNote)}</span></p>` : ''}
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
  return true;
}
export { SDGS, INDICATORS };

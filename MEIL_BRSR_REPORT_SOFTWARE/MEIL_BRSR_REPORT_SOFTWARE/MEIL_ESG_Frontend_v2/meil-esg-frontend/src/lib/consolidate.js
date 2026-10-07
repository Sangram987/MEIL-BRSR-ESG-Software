// Consolidation engine – rolls approved project data up Project → BU → Subsidiary → Group.
// Group Admin never adds numbers by hand: they pick a scope + boundary and this recomputes.
import { INDICATORS, PRINCIPLES, fyMonths, EF, ENERGY_GJ } from '../data/brsr';
import { baselineValue, hasBaseline } from '../data/org';

const ALL_IDS = Object.keys(INDICATORS);
const baseCache = new Map(); // module-level: baseline-only totals per project+FY (pure function of the seed)

function baseAcc(project, fy) {
  const key = `${project.id}|${fy}`;
  if (baseCache.has(key)) return baseCache.get(key);
  const sum = {}, n = {}; const months = new Set();
  fyMonths(fy).forEach((m) => {
    if (!hasBaseline(project, m)) return;
    months.add(m);
    ALL_IDS.forEach((id) => { const v = baselineValue(project, id, m); sum[id] = (sum[id] || 0) + v; n[id] = (n[id] || 0) + 1; });
  });
  const acc = { sum, n, months };
  baseCache.set(key, acc);
  return acc;
}

export const boundaryOk = (sub, b) => {
  if (!sub) return false;
  if (b.mode === 'standalone') return sub.relation === 'parent';
  return sub.relation !== 'jv' || !!b.includeJV;
};

export function createCalc(org, submissions) {
  const projById = new Map(org.projects.map((p) => [p.id, p]));
  const subById = new Map(org.subsidiaries.map((s) => [s.id, s]));
  const buById = new Map(org.bus.map((b) => [b.id, b]));
  const approved = new Map(), byKey = new Map();
  submissions.forEach((s) => {
    byKey.set(`${s.projectId}|${s.period}|${s.principle}`, s);
    if (s.status === 'approved') approved.set(`${s.projectId}|${s.period}|${s.principle}`, s);
  });
  const projCache = new Map(), nodeCache = new Map();

  const cellValue = (s, indId) => {
    const c = s.values[indId];
    if (!c || c.v === '' || c.v == null) return INDICATORS[indId].kind === 'stock' ? null : 0;
    return +c.v;
  };
  const valueFor = (project, indId, period) => {
    const s = approved.get(`${project.id}|${period}|${INDICATORS[indId].principle}`);
    if (s) return cellValue(s, indId);
    return hasBaseline(project, period) ? baselineValue(project, indId, period) : null;
  };

  function projectTotals(project, fy) {
    const key = `${project.id}|${fy}`;
    if (projCache.has(key)) return projCache.get(key);
    const b = baseAcc(project, fy);
    const sum = { ...b.sum }, n = { ...b.n }, months = new Set(b.months);
    const fm = new Set(fyMonths(fy));
    approved.forEach((s) => {
      if (s.projectId !== project.id || !fm.has(s.period)) return;
      months.add(s.period);
      PRINCIPLES.find((p) => p.id === s.principle).indicators.forEach((ind) => {
        const base = hasBaseline(project, s.period) ? baselineValue(project, ind.id, s.period) : null;
        const act = cellValue(s, ind.id);
        sum[ind.id] = (sum[ind.id] || 0) + (act ?? 0) - (base ?? 0);
        n[ind.id] = (n[ind.id] || 0) + (act != null ? 1 : 0) - (base != null ? 1 : 0);
      });
    });
    const t = {};
    ALL_IDS.forEach((id) => { t[id] = INDICATORS[id].kind === 'stock' ? (n[id] > 0 ? sum[id] / n[id] : 0) : (sum[id] || 0); });
    const res = { t, months: months.size, turnoverCr: project.turnoverCr * months.size / 12 };
    projCache.set(key, res);
    return res;
  }

  const inScope = (p, scope) => scope.level === 'group' || (scope.level === 'sub' && p.subId === scope.id) || (scope.level === 'bu' && p.buId === scope.id) || (scope.level === 'project' && p.id === scope.id);
  const projectsIn = (scope, boundary) => org.projects.filter((p) => inScope(p, scope) && boundaryOk(subById.get(p.subId), boundary));

  function nodeTotals(scope, fy, boundary) {
    const key = `${fy}|${scope.level}:${scope.id}|${boundary.mode}${boundary.includeJV ? '+jv' : ''}`;
    if (nodeCache.has(key)) return nodeCache.get(key);
    const t = Object.fromEntries(ALL_IDS.map((i) => [i, 0]));
    let turnoverCr = 0, reporting = 0;
    const list = projectsIn(scope, boundary);
    list.forEach((p) => {
      const r = projectTotals(p, fy);
      ALL_IDS.forEach((id) => { t[id] += r.t[id]; });
      turnoverCr += r.turnoverCr; if (r.months) reporting += 1;
    });
    const res = { t, turnoverCr, projects: list.length, reporting, kpi: kpis(t, turnoverCr) };
    nodeCache.set(key, res);
    return res;
  }

  function rollup(scope, fy, boundary) {
    let kids = [];
    if (scope.level === 'group') kids = org.subsidiaries.map((s) => ({ level: 'sub', id: s.id, name: s.name, tag: { parent: 'Parent division', subsidiary: 'Subsidiary', jv: 'Joint venture' }[s.relation] }));
    else if (scope.level === 'sub') kids = org.bus.filter((b) => b.subId === scope.id).map((b) => ({ level: 'bu', id: b.id, name: b.name, tag: 'Business unit' }));
    else if (scope.level === 'bu') kids = org.projects.filter((p) => p.buId === scope.id).map((p) => ({ level: 'project', id: p.id, name: p.name, tag: p.state }));
    return kids.map((k) => ({ ...k, ...nodeTotals(k, fy, boundary), excluded: k.level === 'sub' && !boundaryOk(subById.get(k.id), boundary) }));
  }

  function monthlyTotals(scope, fy, boundary, ids) {
    const list = projectsIn(scope, boundary);
    return fyMonths(fy).map((period) => {
      const row = { period }; let any = false;
      ids.forEach((id) => { row[id] = 0; });
      list.forEach((p) => ids.forEach((id) => { const v = valueFor(p, id, period); if (v != null) { row[id] += v; any = true; } }));
      return any ? row : null;
    }).filter(Boolean);
  }

  const historyAvg = (project, indId, period, n = 6) => {
    const [y, m] = period.split('-').map(Number); const vals = [];
    for (let i = 1; i <= n; i++) {
      const d = new Date(y, m - 1 - i, 1);
      const v = valueFor(project, indId, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      if (v != null) vals.push(v);
    }
    return vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : { avg: null, n: 0 };
  };

  const projectStatus = (projectId, period) => {
    const p = projById.get(projectId);
    return Object.fromEntries(PRINCIPLES.map((pr) => {
      const s = byKey.get(`${projectId}|${period}|${pr.id}`);
      return [pr.id, s ? s.status : (p && hasBaseline(p, period) ? 'approved' : 'none')];
    }));
  };

  function coverage(scope, period, boundary) {
    const counts = { approved: 0, submitted: 0, correction_required: 0, draft: 0, rejected: 0, none: 0 };
    const list = projectsIn(scope, boundary);
    list.forEach((p) => Object.values(projectStatus(p.id, period)).forEach((st) => { counts[st] = (counts[st] || 0) + 1; }));
    const expected = list.length * PRINCIPLES.length;
    return { counts, expected, pct: expected ? Math.round((counts.approved / expected) * 100) : 0, projects: list.length };
  }

  return { org, projById, subById, buById, valueFor, projectTotals, nodeTotals, rollup, monthlyTotals, historyAvg, projectStatus, coverage, projectsIn, byKey, approved, submissions };
}

// ── Derived BRSR indicators ─────────────────────────────────────────────────
export function kpis(t, turnoverCr = 0) {
  const scope1 = ((t.p6_dg + t.p6_mach) * EF.dieselKgPerL + t.p6_petrol * EF.petrolKgPerL) / 1000;
  const scope2 = (t.p6_grid * EF.gridKgPerKWh) / 1000;
  const scope3 = t.p6_s3;
  const energyGJ = (t.p6_grid + t.p6_renew) * ENERGY_GJ.kWh + (t.p6_dg + t.p6_mach) * ENERGY_GJ.dieselL + t.p6_petrol * ENERGY_GJ.petrolL;
  const renewGJ = t.p6_renew * ENERGY_GJ.kWh;
  const waste = t.p6_haz + t.p6_nonhaz;
  const headcount = t.p3_pm + t.p3_pf + t.p3_cm + t.p3_cf;
  const div = (a, b) => (b > 0 ? a / b : 0);
  return {
    scope1, scope2, scope3, ghg: scope1 + scope2,
    energyGJ, renewablePct: div(renewGJ, energyGJ) * 100,
    waterWithdrawn: t.p6_water, waterConsumed: Math.max(0, t.p6_water - t.p6_disch), waterDischarged: t.p6_disch,
    waste, wasteRecoveredPct: div(t.p6_recyc, waste) * 100,
    headcount, permanent: t.p3_pm + t.p3_pf, contract: t.p3_cm + t.p3_cf,
    femalePct: div(t.p3_pf + t.p3_cf, headcount) * 100,
    ltifr: div(t.p3_lti * 1e6, t.p3_manhrs), fatalities: t.p3_fat, injuries: t.p3_rec,
    safetySpendPct: div(t.p3_wellbeing, turnoverCr * 1e7) * 100,
    femaleWagePct: div(t.p3_wagesf, t.p3_wages) * 100,
    msmePct: div(t.p8_msme, t.p8_proc) * 100,
    trainedPct: Math.min(100, div(t.p3_hstrain, headcount) * 100),
    ghgIntensity: div(scope1 + scope2, turnoverCr), // tCO2e per ₹ crore
    waterIntensity: div(t.p6_water, turnoverCr),    // KL per ₹ crore
    energyIntensity: div(energyGJ, turnoverCr),     // GJ per ₹ crore
    wasteIntensity: div(waste, turnoverCr),         // MT per ₹ crore
    csr: t.p8_csr, complaints: t.p1_corr + t.p5_child + t.p5_forced + t.p5_posh + t.p5_disc,
  };
}

export const fmt = (n, d = 0) => (n == null || Number.isNaN(n) ? '–' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: 0 }));
export const compact = (n) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return fmt(n, a < 10 ? 2 : 0);
};

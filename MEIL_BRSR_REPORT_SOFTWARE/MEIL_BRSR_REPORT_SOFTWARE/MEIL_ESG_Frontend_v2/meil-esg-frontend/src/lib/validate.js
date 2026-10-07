// System validation run when an operator submits and shown to the BU manager as review checks.
import { PRINCIPLES, INDICATORS } from '../data/brsr';

const num = (c) => (c && c.v !== '' && c.v != null ? +c.v : null);

export function validateValues({ principle, values, project, period, calc }) {
  const pr = PRINCIPLES.find((p) => p.id === principle);
  const errors = [], warnings = [];
  const V = (id) => num(values[id]) ?? 0;

  pr.indicators.forEach((ind) => {
    const c = values[ind.id]; const v = num(c);
    if (v != null && (Number.isNaN(v) || v < 0)) errors.push({ id: ind.id, msg: 'Must be a non-negative number.' });
    if (!ind.lead && ind.req && v == null) errors.push({ id: ind.id, msg: 'Required — enter 0 if nothing to report.' });
    if (v != null && v > 0 && ind.ev && !(c && c.ev)) warnings.push({ id: ind.id, msg: 'Evidence not attached — BRSR Core data must be supported.', kind: 'evidence' });
    if (v != null && ind.typ >= 1 && ind.kind === 'flow' && calc && project) {
      const h = calc.historyAvg(project, ind.id, period);
      if (h.avg && h.n >= 3 && h.avg > 0) {
        const delta = ((v - h.avg) / h.avg) * 100;
        if (delta > 40) warnings.push({ id: ind.id, msg: `+${delta.toFixed(0)}% vs 6-month average — please confirm.`, kind: 'spike' });
        if (delta < -60) warnings.push({ id: ind.id, msg: `${delta.toFixed(0)}% vs 6-month average — please confirm.`, kind: 'drop' });
      }
    }
  });

  const rule = (cond, id, msg) => { if (cond) errors.push({ id, msg, kind: 'logic' }); };
  if (principle === 'P6') {
    rule(V('p6_ground') + V('p6_third') > V('p6_water') * 1.001, 'p6_water', 'Groundwater + third-party cannot exceed total withdrawn.');
    rule(V('p6_recyc') + V('p6_disp') > (V('p6_haz') + V('p6_nonhaz')) * 1.05, 'p6_recyc', 'Recycled + disposed waste exceeds waste generated.');
    rule(V('p6_disch') > V('p6_water') * 1.001, 'p6_disch', 'Discharge cannot exceed water withdrawn.');
  }
  if (principle === 'P3') {
    rule(V('p3_wagesf') > V('p3_wages'), 'p3_wagesf', 'Female wages cannot exceed total wages.');
    rule(V('p3_lti') > V('p3_rec'), 'p3_lti', 'LTIs cannot exceed recordable injuries.');
    rule(V('p3_dis') > V('p3_pm') + V('p3_pf') + V('p3_cm') + V('p3_cf'), 'p3_dis', 'Differently-abled count exceeds headcount.');
    if (V('p3_fat') > 0) warnings.push({ id: 'p3_fat', msg: 'Fatality reported — escalate to Group HSE immediately.', kind: 'critical' });
  }
  if (principle === 'P2') rule(V('p2_recycled') > V('p2_input'), 'p2_recycled', 'Recycled material exceeds total input material.');
  if (principle === 'P8') { rule(V('p8_msme') > V('p8_proc'), 'p8_msme', 'MSME procurement exceeds total procurement.'); rule(V('p8_local') > V('p8_proc'), 'p8_local', 'Local procurement exceeds total procurement.'); }
  if (principle === 'P9') rule(V('p9_res') > V('p9_comp') * 3, 'p9_res', 'Resolved complaints look unusually high vs received.');
  return { errors, warnings };
}

export const checklistFor = (result) => {
  const has = (k) => result.warnings.some((w) => w.kind === k);
  return [
    { id: 'project', label: 'Correct project & site boundary', auto: true },
    { id: 'period', label: 'Correct reporting period', auto: true },
    { id: 'complete', label: 'All required fields complete', auto: result.errors.length === 0 },
    { id: 'reasonable', label: 'Values are reasonable vs history', auto: !has('spike') && !has('drop') },
    { id: 'evidence', label: 'Supporting evidence attached & legible', auto: !has('evidence') },
    { id: 'discrepancy', label: 'No obvious discrepancy with evidence', auto: true },
  ];
};

export { INDICATORS };

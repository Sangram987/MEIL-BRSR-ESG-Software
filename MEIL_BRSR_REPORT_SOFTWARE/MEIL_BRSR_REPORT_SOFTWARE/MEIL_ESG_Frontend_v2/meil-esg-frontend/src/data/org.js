// Deterministic demo dataset: 5 subsidiaries → 10 business units → 250 projects.
// Nothing here is random at runtime, so every reload produces the same numbers.
import { INDICATORS, PRINCIPLES, SEED_START, SEED_END, CURRENT_PERIOD, STAKEHOLDER_GROUPS } from './brsr';

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const STATES = [
  ['Telangana', 17.9, 79.6], ['Andhra Pradesh', 16.0, 80.0], ['Maharashtra', 19.7, 75.7], ['Gujarat', 22.3, 71.7],
  ['Rajasthan', 26.5, 73.8], ['Madhya Pradesh', 23.5, 78.5], ['Uttar Pradesh', 26.8, 80.9], ['Karnataka', 14.6, 75.7],
  ['Tamil Nadu', 11.1, 78.6], ['Odisha', 20.5, 84.4], ['Jammu & Kashmir', 33.9, 75.0], ['Uttarakhand', 30.1, 79.3],
  ['Himachal Pradesh', 31.9, 77.2], ['Assam', 26.4, 92.9], ['Bihar', 25.6, 85.6], ['West Bengal', 23.0, 87.9],
  ['Chhattisgarh', 21.3, 81.8], ['Punjab', 31.0, 75.3],
];
const OVERSEAS = [['Mongolia', 47.9, 106.9], ['Bhutan', 27.4, 90.4], ['Kenya', -0.5, 37.5]];

const SUBS = [
  { id: 'sub-infra', name: 'MEIL Infrastructure & Utilities', relation: 'parent', ownership: 100 },
  { id: 'sub-hydro', name: 'MEIL Hydrocarbons & Energy', relation: 'parent', ownership: 100 },
  { id: 'sub-power', name: 'MEIL Power & Renewables', relation: 'subsidiary', ownership: 100 },
  { id: 'sub-mob', name: 'MEIL Mobility & Manufacturing', relation: 'subsidiary', ownership: 76 },
  { id: 'sub-intl', name: 'MEIL International (Overseas)', relation: 'jv', ownership: 51 },
];
const BUS = [
  { id: 'bu-water', subId: 'sub-infra', name: 'Water & Irrigation Division', n: 55, types: ['Lift Irrigation Scheme', 'Canal Package', 'Reservoir Works', 'Pump House Complex', 'Drinking Water Grid'] },
  { id: 'bu-tunnel', subId: 'sub-infra', name: 'Tunnels & Transit Division', n: 35, types: ['Twin-Tube Tunnel', 'Metro Underground Section', 'Rail Tunnel Package', 'Highway Tunnel'] },
  { id: 'bu-road', subId: 'sub-infra', name: 'Roads & Bridges Division', n: 40, types: ['Highway Widening', 'Expressway Package', 'Bridge & Flyover', 'Bypass Corridor'] },
  { id: 'bu-refine', subId: 'sub-hydro', name: 'Refinery EPC Unit', n: 12, types: ['Refinery Unit Package', 'Process Plant Block'] },
  { id: 'bu-pipe', subId: 'sub-hydro', name: 'Pipelines & Gas Distribution', n: 30, types: ['Gas Pipeline Spread', 'City Gas Distribution Zone', 'CNG Station Cluster'] },
  { id: 'bu-thermal', subId: 'sub-power', name: 'Thermal & Hydro Power', n: 20, types: ['Thermal Balance-of-Plant', 'Hydro Powerhouse Package'] },
  { id: 'bu-solar', subId: 'sub-power', name: 'Solar & Green Energy', n: 28, types: ['Solar Park Block', 'Wind-Solar Hybrid Site', 'Transmission Line Package'] },
  { id: 'bu-ev', subId: 'sub-mob', name: 'EV & Bus Manufacturing', n: 8, types: ['Bus Assembly Line', 'Battery Pack Unit'] },
  { id: 'bu-ind', subId: 'sub-mob', name: 'Industrial Systems', n: 12, types: ['Plant Automation Package', 'Fabrication Yard'] },
  { id: 'bu-intl', subId: 'sub-intl', name: 'Overseas Infrastructure', n: 10, types: ['Overseas Civil Package', 'Overseas Plant Package'] },
];
// Named projects taken from the original mock screens
const NAMED = {
  'bu-water': [['Kaleshwaram Lift Irrigation', 'Telangana', 18.81, 79.82, false], ['Polavaram Headworks', 'Andhra Pradesh', 17.25, 81.65, true], ['Sitarama Lift Canal', 'Telangana', 17.3, 80.6, false]],
  'bu-tunnel': [['Zojila Tunnel Package 1', 'Jammu & Kashmir', 34.27, 75.45, true], ['Char Dham Railway Tunnel', 'Uttarakhand', 30.3, 78.5, true]],
  'bu-refine': [['Mongolia Refinery Project Site', 'Mongolia', 47.9, 106.9, false], ['Barmer Field Processing Station', 'Rajasthan', 25.75, 71.38, true]],
};

export function buildOrg() {
  const rnd = mulberry(20260928);
  const projects = [];
  let seq = 1;
  BUS.forEach((bu) => {
    const list = [];
    (NAMED[bu.id] || []).forEach(([name, state, lat, lng, live]) => list.push({ name, state, lat, lng, live }));
    let k = 1;
    while (list.length < bu.n) {
      const overseas = bu.id === 'bu-intl';
      const [state, lat, lng] = (overseas ? OVERSEAS : STATES)[Math.floor(rnd() * (overseas ? OVERSEAS.length : STATES.length))];
      const type = bu.types[Math.floor(rnd() * bu.types.length)];
      list.push({ name: `${state} – ${type} ${k++}`, state, lat: lat + (rnd() - 0.5) * 2.2, lng: lng + (rnd() - 0.5) * 2.2, live: false });
    }
    // first five projects of the Tunnels BU are "live" so the BU Manager has real work in the queue
    if (bu.id === 'bu-tunnel') list.slice(0, 5).forEach((p) => { p.live = true; });
    list.forEach((p) => {
      const id = `prj-${String(seq++).padStart(3, '0')}`;
      const scale = +(0.35 + rnd() * 2.4).toFixed(2);
      projects.push({
        id, buId: bu.id, subId: bu.subId, name: p.name, state: p.state,
        country: OVERSEAS.some((o) => o[0] === p.state) ? p.state : 'India',
        lat: +p.lat.toFixed(3), lng: +p.lng.toFixed(3), scale, turnoverCr: +(90 * scale).toFixed(1),
        seeded: true, live: !!p.live, status: 'Active',
      });
    });
  });
  return {
    group: { id: 'meil', name: 'Megha Engineering & Infrastructures Ltd (MEIL)' },
    subsidiaries: SUBS.map((s) => ({ ...s, status: 'Active' })),
    bus: BUS.map(({ id, subId, name }) => ({ id, subId, name })),
    projects,
  };
}

// ── Baseline (already-approved history) ─────────────────────────────────────
export function baselineValue(project, indId, period) {
  const ind = INDICATORS[indId];
  const rnd = mulberry(hash(`${project.id}|${indId}|${period}`));
  const month = +period.slice(5, 7);
  const season = 1 + 0.12 * Math.sin(((month - 2) / 12) * Math.PI * 2); // construction peaks in dry months
  if (ind.typ < 1) { const v = rnd() < ind.typ * Math.min(project.scale, 2) ? 1 : 0; return v * (ind.mag || 1); }
  if (ind.kind === 'stock') return Math.max(0, Math.round(ind.typ * project.scale * (0.96 + rnd() * 0.08)));
  const v = ind.typ * project.scale * season * (0.86 + rnd() * 0.28);
  return ind.int ? Math.round(v) : +v.toFixed(2);
}
export const pseudoSepApproved = (project) => !project.live && hash(project.id) % 100 < 55;
export const hasBaseline = (project, period) => {
  if (!project.seeded) return false;
  if (period < SEED_START) return false;
  if (period <= SEED_END) return true;
  if (period === CURRENT_PERIOD) return pseudoSepApproved(project);
  return false;
};

// ── Users (demo accounts) ───────────────────────────────────────────────────
export function buildUsers(org) {
  const zojila = org.projects.find((p) => p.name === 'Zojila Tunnel Package 1');
  return {
    admin: { id: 'u-admin', role: 'admin', name: 'Rajesh Kumar', title: 'Group ESG Admin', email: 'r.kumar@meil.in' },
    manager: { id: 'u-mgr', role: 'manager', name: 'Vikram Singh', title: 'BU Manager — Tunnels & Transit', email: 'v.singh@meil.in', buId: 'bu-tunnel' },
    operator: { id: 'u-op', role: 'operator', name: 'Suresh Naik', title: 'Site Operator', email: 's.naik@meil.in', projectId: zojila.id },
    vendor: { id: 'u-ven', role: 'vendor', name: 'Anil Mehta', title: 'ESG Coordinator, Global Logistics Corp', email: 'anil@globallogistics.example', vendorId: 'V-103' },
    auditor: { id: 'u-aud', role: 'auditor', name: 'Ananya Rao', title: 'Independent Assurance Provider', email: 'a.rao@assurance.example' },
  };
}

// ── Seed workflow data ──────────────────────────────────────────────────────
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 18);
const iso = (d) => new Date(Date.UTC(2026, 8, d, 6, 30)).toISOString();

export function buildSeed(org, users) {
  const P = (name) => org.projects.find((p) => p.name === name);
  const tunnelProjects = org.projects.filter((p) => p.buId === 'bu-tunnel');
  const zoj = P('Zojila Tunnel Package 1');
  let n = 1000;
  const packet = (prj, period, pid, status, tweak = {}, extra = {}) => {
    const pr = PRINCIPLES.find((p) => p.id === pid);
    const values = {};
    pr.indicators.filter((i) => !i.lead).forEach((i) => {
      const v = tweak[i.id] !== undefined ? tweak[i.id] : baselineValue(prj, i.id, '2026-08');
      const evOverride = tweak[`${i.id}#ev`];
      values[i.id] = { v: v === null ? '' : String(v), ev: evOverride !== undefined ? evOverride : (i.ev ? `${slug(prj.name)}_${i.id}_${period}.pdf` : '') };
    });
    const by = { name: extra.by || 'Suresh Naik', role: 'operator' };
    return {
      id: `SUB-${++n}`, projectId: prj.id, period, principle: pid, values, status,
      enteredBy: by.role, submittedBy: status === 'draft' ? null : by, submittedAt: status === 'draft' ? null : iso(extra.day || 24),
      reviewer: extra.reviewer || null, assurance: extra.assurance || 'not_started',
      history: [{ at: iso(extra.day || 24), by: by.name, action: status === 'draft' ? 'DRAFT SAVED' : 'SUBMITTED', note: '' }, ...(extra.hist || [])],
    };
  };
  const rv = (name, comment, day = 25) => ({ name, comment, at: iso(day) });
  const subs = [
    // Site operator's own project (Zojila) – shows every workflow state
    packet(zoj, '2026-09', 'P6', 'draft', { p6_grid: 44200, p6_dg: '', 'p6_dg#ev': '', p6_mach: '', 'p6_mach#ev': '' }),
    packet(zoj, '2026-09', 'P3', 'correction_required', { p3_hstrain: 380, 'p3_hstrain#ev': 'attendance_sheet_blur.jpg' }, {
      day: 22, reviewer: rv('Vikram Singh', 'The attached attendance sheet is blurry and illegible. Please re-scan and upload.', 23),
      hist: [{ at: iso(23), by: 'Vikram Singh', action: 'CORRECTION REQUESTED', note: 'Attendance sheet illegible – re-scan and upload.' }],
    }),
    packet(zoj, '2026-09', 'P1', 'approved', {}, { day: 20, reviewer: rv('Vikram Singh', 'Verified against training register.', 21), hist: [{ at: iso(21), by: 'Vikram Singh', action: 'APPROVED', note: 'Verified against training register.' }] }),
    packet(zoj, '2026-09', 'P5', 'submitted', {}, { day: 26 }),
    packet(zoj, '2026-08', 'P6', 'approved', {}, { day: 4, assurance: 'assured', reviewer: rv('Vikram Singh', 'Matches DISCOM bill.', 5) }),
    packet(zoj, '2026-08', 'P3', 'approved', {}, { day: 4, assurance: 'in_review', reviewer: rv('Vikram Singh', 'OK.', 5) }),
    // Other live sites in Manager's BU → these land in Vikram's queue
    packet(tunnelProjects[1], '2026-09', 'P6', 'submitted', { p6_mach: Math.round(baselineValue(tunnelProjects[1], 'p6_mach', '2026-08') * 2.1) }, { by: 'Neha P.', day: 26 }),
    packet(tunnelProjects[2], '2026-09', 'P3', 'submitted', { p3_lti: 2, p3_rec: 3, p3_manhrs: 118000 }, { by: 'Amit V.', day: 26 }),
    packet(tunnelProjects[3], '2026-09', 'P6', 'submitted', { 'p6_water#ev': '' }, { by: 'Rahul S.', day: 27 }),
    packet(tunnelProjects[4], '2026-09', 'P8', 'submitted', {}, { by: 'Kavita R.', day: 27 }),
    // other BUs (visible to admin counts / other managers)
    packet(P('Polavaram Headworks'), '2026-09', 'P6', 'submitted', {}, { by: 'Ravi T.', day: 25 }),
    packet(P('Barmer Field Processing Station'), '2026-09', 'P3', 'submitted', {}, { by: 'Sunita D.', day: 25 }),
    // approved August packets used by the assurance workbench
    ...tunnelProjects.slice(1, 5).flatMap((p, i) => ['P6', 'P3'].map((pid, j) => packet(p, '2026-08', pid, 'approved', {}, { day: 4, assurance: (i + j) % 3 === 0 ? 'assured' : (i + j) % 3 === 1 ? 'in_review' : 'not_started', reviewer: rv('Vikram Singh', 'Verified.', 5) }))),
    packet(P('Polavaram Headworks'), '2026-08', 'P6', 'approved', {}, { day: 4, assurance: 'not_started', reviewer: rv('Manager – Water BU', 'Verified.', 5) }),
    packet(P('Barmer Field Processing Station'), '2026-08', 'P6', 'approved', {}, { day: 4, assurance: 'exception', reviewer: rv('Manager – Refinery BU', 'Verified.', 5) }),
  ];
  subs.forEach((s) => { if (s.status === 'approved' && !s.history.some((h) => h.action === 'APPROVED')) s.history.push({ at: iso(5), by: s.reviewer?.name || 'BU Manager', action: 'APPROVED', note: s.reviewer?.comment || '' }); });

  const audit = [
    { id: 'LOG-091', at: iso(23), user: 'Vikram Singh (BU Manager)', action: 'CORRECTION REQUESTED', entity: `SUB-1002 · Zojila P3`, details: 'Attendance sheet illegible – re-scan and upload.' },
    { id: 'LOG-092', at: iso(22), user: 'Suresh Naik (Site Operator)', action: 'SUBMITTED', entity: 'SUB-1002 · Zojila P3', details: 'Submitted with 1 evidence warning.' },
    { id: 'LOG-093', at: iso(21), user: 'Vikram Singh (BU Manager)', action: 'APPROVED', entity: 'SUB-1003 · Zojila P1', details: 'Verified against training register.' },
    { id: 'LOG-094', at: iso(5), user: 'Ananya Rao (Auditor)', action: 'ASSURED', entity: 'SUB-1005 · Zojila P6 (Aug)', details: 'Recomputed Scope 1/2; no differences.' },
  ];
  const notifications = [
    { id: 'N1', role: 'operator', text: 'P3 (Employee Wellbeing) was sent back: attendance sheet is illegible.', at: iso(23), read: false, link: '/operator/data-entry?principle=P3' },
    { id: 'N2', role: 'manager', text: '5 site submissions are waiting for your review.', at: iso(27), read: false, link: '/manager/approvals' },
    { id: 'N3', role: 'admin', text: 'September data window closes in 3 days — 48% of sites have approved data.', at: iso(27), read: false, link: '/admin/consolidation' },
    { id: 'N4', role: 'vendor', text: 'MEIL requested your H1 FY 2026-27 ESG data. Due 15 Oct 2026.', at: iso(20), read: false, link: '/vendor/submit' },
    { id: 'N5', role: 'auditor', text: '2 approved packets are flagged as exceptions and need follow-up.', at: iso(26), read: false, link: '/auditor' },
  ];

  const vendors = [
    { id: 'V-101', name: 'UltraTech Cement Ltd', category: 'Raw Materials', safety: 'Compliant', score: 88, scope3: 14200 },
    { id: 'V-102', name: 'L&T Heavy Machinery', category: 'Equipment Leasing', safety: 'Compliant', score: 92, scope3: 8450 },
    { id: 'V-103', name: 'Global Logistics Corp', category: 'Transportation', safety: 'Flagged', score: 64, scope3: 12100 },
    { id: 'V-104', name: 'Apex Manpower Services', category: 'Contract Labor', safety: 'Compliant', score: 95, scope3: 0 },
    { id: 'V-105', name: 'Deccan Steel Traders', category: 'Raw Materials', safety: 'Compliant', score: 79, scope3: 9800 },
    { id: 'V-106', name: 'Sri Sai Aggregates', category: 'Raw Materials', safety: 'Flagged', score: 58, scope3: 4300 },
  ];
  const vsample = (k) => ({ v_turnover: 420 * k, v_meil: 60 * k, v_elec: 180000 * k, v_diesel: 96000 * k, v_water: 4200, v_waste: 14, v_emp: 210, v_contract: 95, v_manhrs: 640000, v_lti: 2, v_fat: 0, v_belowmin: 0 });
  const vendorRequests = [
    { id: 'VR-2001', vendorId: 'V-103', period: 'H1 FY 2026-27', due: '2026-10-15', status: 'requested', values: {}, evidence: {}, sentAt: iso(20), comment: '', history: [{ at: iso(20), by: 'Rajesh Kumar', action: 'REQUESTED', note: '' }] },
    { id: 'VR-2002', vendorId: 'V-101', period: 'H1 FY 2026-27', due: '2026-10-15', status: 'submitted', values: vsample(1.6), evidence: { v_elec: 'ultratech_power_bills.pdf', v_diesel: 'ultratech_fuel_register.xlsx', v_water: '', v_manhrs: 'timesheets_h1.zip', v_lti: 'safety_log.pdf' }, sentAt: iso(15), comment: '', history: [{ at: iso(15), by: 'Rajesh Kumar', action: 'REQUESTED', note: '' }, { at: iso(25), by: 'UltraTech Cement Ltd', action: 'SUBMITTED', note: '' }] },
    { id: 'VR-2003', vendorId: 'V-106', period: 'H1 FY 2026-27', due: '2026-10-15', status: 'correction_required', values: vsample(0.4), evidence: { v_elec: '' }, sentAt: iso(15), comment: 'Electricity bills missing – please attach DISCOM invoices for Apr–Sep.', history: [{ at: iso(15), by: 'Rajesh Kumar', action: 'REQUESTED', note: '' }, { at: iso(24), by: 'Ananya Rao', action: 'CORRECTION REQUESTED', note: 'Electricity bills missing.' }] },
    { id: 'VR-1901', vendorId: 'V-103', period: 'FY 2025-26', due: '2026-04-30', status: 'accepted', values: vsample(1.2), evidence: { v_elec: 'bills.pdf', v_diesel: 'fuel.pdf', v_manhrs: 'ts.zip', v_lti: 'log.pdf' }, sentAt: iso(1), comment: 'Accepted after recomputation.', history: [{ at: iso(1), by: 'Ananya Rao', action: 'ACCEPTED', note: '' }] },
  ];

  const risks = [
    { id: 'RSK-01', title: 'Groundwater depletion (Polavaram)', type: 'Risk', category: 'Environmental', likelihood: 3, impact: 3, financial: 12.5, owner: 'BU Manager – Water', mitigation: 'Implement rainwater harvesting and greywater recycling by Q3.', status: 'Open', indicator: 'p6_ground',
      rationale: 'Site draws heavily on groundwater in a water-stressed basin; state groundwater board has flagged extraction limits.', timeHorizon: 'Short-term (0–1 yr)', financialImplication: 'Adverse — potential restriction on groundwater permits could delay works and raise tanker-water costs.', section: 'A24', includeInBrsr: true },
    { id: 'RSK-02', title: 'Sub-contractor safety non-compliance', type: 'Risk', category: 'Social', likelihood: 2, impact: 3, financial: 5.0, owner: 'Head – HSE', mitigation: 'Daily toolbox talks and PPE-detection cameras at gates.', status: 'Mitigating', indicator: 'p3_lti',
      rationale: 'Contract workforce turnover is high on tunnel sites, diluting safety induction coverage.', timeHorizon: 'Ongoing', financialImplication: 'Adverse — safety incidents can trigger stop-work orders and regulatory penalties.', section: 'A24', includeInBrsr: true },
    { id: 'RSK-03', title: 'Upcoming carbon-tax regulation', type: 'Risk', category: 'Governance', likelihood: 3, impact: 2, financial: 8.2, owner: 'Group ESG', mitigation: 'Shift from diesel generators to grid power; phase out DG by 40%.', status: 'Open', indicator: 'p6_dg',
      rationale: 'Diesel-heavy fleet exposes the group to future carbon-pricing / fuel-tax changes flagged in national climate policy.', timeHorizon: 'Medium-term (1–3 yrs)', financialImplication: 'Adverse — a carbon levy on diesel would raise fuel cost per site; magnitude depends on final policy design.', section: 'A24', includeInBrsr: true },
    { id: 'RSK-04', title: 'Local community protest (Barmer)', type: 'Risk', category: 'Social', likelihood: 1, impact: 2, financial: 2.1, owner: 'BU Manager – Refinery', mitigation: 'Increase CSR on local skills and healthcare.', status: 'Monitoring', indicator: 'p8_csr',
      rationale: 'Land-acquisition history near the site has previously drawn local opposition to project works.', timeHorizon: 'Short-term (0–1 yr)', financialImplication: 'Adverse — schedule delay risk from work stoppages if grievances are not addressed early.', section: 'A24', includeInBrsr: true },
    { id: 'RSK-05', title: 'Growing demand for green infrastructure EPC', type: 'Opportunity', category: 'Environmental', likelihood: 2, impact: 3, financial: 0, owner: 'Group ESG', mitigation: 'Build renewable & green-hydrogen EPC capability; bid for solar/green corridor tenders.', status: 'Monitoring', indicator: '',
      rationale: 'National renewable-energy targets are increasing tender volume for solar parks and green transmission corridors.', timeHorizon: 'Medium-term (1–3 yrs)', financialImplication: 'Positive — new order-book opportunity in the Solar & Green Energy business unit.', section: 'A24', includeInBrsr: true },
  ];
  const disclosures = {
    // Section A — General Disclosures (Annexure I, Parts I–VII)
    A: {
      cin: '', entityName: 'Megha Engineering & Infrastructures Limited', incorporationYear: '',
      registeredOffice: 'Hyderabad, Telangana', corporateOffice: '', email: 'esg@meil.in', telephone: '',
      website: '', financialYear: 'FY 2026-27', stockExchanges: 'BSE, NSE', paidUpCapital: '',
      contact: 'Rajesh Kumar, Group ESG Admin', boundaryDeclared: 'consolidated',
      businessActivities: [{ activity: 'Engineering, Procurement & Construction (EPC)', description: 'Irrigation, tunnels, roads & bridges', turnoverPct: '58' }, { activity: 'Oil & Gas / Hydrocarbons', description: 'Refinery EPC, pipelines, city gas distribution', turnoverPct: '27' }, { activity: 'Power & Renewables', description: 'Thermal, hydro, solar EPC', turnoverPct: '15' }],
      productsServices: [{ product: 'Irrigation & water infrastructure', nic: '4222', turnoverPct: '32' }, { product: 'Tunnels & underground transit', nic: '4221', turnoverPct: '18' }, { product: 'Roads & bridges', nic: '4210', turnoverPct: '17' }, { product: 'Oil & gas pipelines / refinery EPC', nic: '4220', turnoverPct: '27' }, { product: 'Power generation EPC', nic: '4220', turnoverPct: '6' }],
      locations: { plantsNational: '3', officesNational: '38', plantsIntl: '0', officesIntl: '3' },
      marketsNationalStates: '18', marketsIntlCountries: '3', exportsPct: '4', customerTypes: 'Central & state government agencies, PSUs, private industrial clients',
      employees: { permM: '9800', permF: '1350', otherM: '2100', otherF: '340' },
      workers: { permM: '31500', permF: '3600', otherM: '9200', otherF: '1100' },
      daEmployees: { permM: '28', permF: '4', otherM: '9', otherF: '1' },
      daWorkers: { permM: '95', permF: '11', otherM: '30', otherF: '4' },
      womenBoard: { total: '11', femaleCount: '2' }, womenKMP: { total: '7', femaleCount: '1' },
      turnoverRate: {
        cur: { empM: '11.2', empF: '13.5', empT: '11.6', wkM: '18.4', wkF: '20.1', wkT: '18.6' },
        prev: { empM: '12.0', empF: '14.2', empT: '12.4', wkM: '19.5', wkF: '21.0', wkT: '19.7' },
        prev2: { empM: '13.1', empF: '15.0', empT: '13.5', wkM: '20.8', wkF: '22.4', wkT: '21.0' },
      },
      csrApplicable: 'Yes', csrTurnover: '', csrNetWorth: '',
      stakeholderComplaints: Object.fromEntries(STAKEHOLDER_GROUPS.map((g) => [g, { mechanism: 'Yes', link: '', curFiled: '0', curPending: '0', curRemarks: '', prevFiled: '0', prevPending: '0', prevRemarks: '' }])),
    },
    // Section B — Management & Process Disclosures (Annexure I, Q1–Q12)
    B: {
      policies: Object.fromEntries(PRINCIPLES.map((p) => [p.id, {
        hasPolicy: 'Yes', boardApproved: 'Yes', link: '', translatedToProcedure: 'Yes', extendsToValueChain: p.id === 'P3' || p.id === 'P6' ? 'Yes' : 'No',
        codes: '', targets: [{ target: '', baseline: '', current: '', status: '' }],
        notCoveredReason: '',
      }])),
      directorStatement: '', esgHead: 'Rajesh Kumar, Group ESG Admin', committee: 'Sustainability & Risk Committee',
      review: Object.fromEntries(PRINCIPLES.map((p) => [p.id, { by: 'Committee of the Board', frequency: 'Quarterly' }])),
      externalAssessment: { done: 'No', agency: '' },
    },
    core8: { dataBreaches: '0', dataBreachRatio: '0', payablesDays: '' },
    core9: { purchTradingHousePct: '', purchTradingHouseCount: '', purchTop10Pct: '', salesDealerPct: '', salesDealerCount: '', salesTop10Pct: '', rptPurchasesPct: '', rptSalesPct: '', rptLoansPct: '', rptInvestmentsPct: '' },
  };
  const assuranceOpinions = {
    'FY 2025-26': Object.fromEntries(['ghg', 'water', 'energy', 'circ', 'safety', 'gender', 'inclusive', 'fair', 'open'].map((k) => [k, { mode: 'assurance', status: 'Reasonable assurance', provider: 'Ananya Rao & Associates', providerType: 'Independent external assurance provider', standard: 'ISAE 3000', scope: 'MEIL Group — all business units', methodology: 'Sampling of site evidence, recalculation of emission/water/waste totals, management enquiry.', evidenceTested: 'Utility bills, fuel registers, safety logs for a risk-based sample of sites.', exceptions: '', independenceConfirmed: true, by: 'Ananya Rao', at: '2026-07-18', note: 'Unmodified conclusion.' }])),
    'FY 2026-27': {},
  };
  // Value-chain reporting is policy-driven, not hard-coded: SEBI's Mar-2025 circular made it
  // voluntary for the top 250 listed entities from FY 2025-26 — the admin can flip this switch
  // as guidance evolves, and every "Scope 3" figure downstream is labelled an internal estimate.
  const valueChainConfig = { applicability: 'voluntary_top250', allocationMethod: 'revenue_share', methodologyNote: 'Vendor Scope 1+2 emissions allocated to MEIL in proportion to (revenue from MEIL ÷ vendor total revenue). This is an internal attribution estimate, not a prescribed SEBI calculation rule.' };
  const reportConfig = { package: 'comprehensive', includeValueChain: true, disclosureType: 'assurance' };
  return { subs, audit, notifications, vendors, vendorRequests, risks, disclosures, assuranceOpinions, valueChainConfig, reportConfig, counters: { sub: n, log: 100, vr: 2100, risk: 5 } };
}

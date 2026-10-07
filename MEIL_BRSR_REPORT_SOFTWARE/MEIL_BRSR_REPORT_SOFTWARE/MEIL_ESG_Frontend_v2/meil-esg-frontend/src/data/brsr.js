// ─────────────────────────────────────────────────────────────────────────────
// SEBI BRSR data dictionary (site-level capture)
// Section A = General disclosures, Section B = Management & process,
// Section C = Principle-wise performance (P1–P9, Essential + Leadership).
// BRSR Core = the 9 ESG attributes SEBI requires assurance on.
// Emission / energy factors below are ILLUSTRATIVE – replace with the factors
// approved by your assurance provider (CEA / IPCC / DEFRA).
// ─────────────────────────────────────────────────────────────────────────────

export const FYS = ['FY 2026-27', 'FY 2025-26', 'FY 2024-25'];
export const CURRENT_FY = 'FY 2026-27';
export const CURRENT_PERIOD = '2026-09';   // open reporting month
export const SEED_START = '2024-04';
export const SEED_END = '2026-08';         // last month with closed/approved data

export const fyMonths = (fy) => {
  const y = parseInt(fy.slice(3, 7), 10);
  return Array.from({ length: 12 }, (_, i) => {
    const m = (3 + i) % 12;
    const yy = y + (3 + i >= 12 ? 1 : 0);
    return `${yy}-${String(m + 1).padStart(2, '0')}`;
  });
};
export const prevFY = (fy) => { const y = parseInt(fy.slice(3, 7), 10); return `FY ${y - 1}-${String(y).slice(2)}`; };
export const periodLabel = (p) => new Date(`${p}-01T00:00:00`).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
export const shortMonth = (p) => new Date(`${p}-01T00:00:00`).toLocaleString('en-IN', { month: 'short' });
export const openPeriods = () => ['2026-09', '2026-08', '2026-07', '2026-06'];

export const EF = { dieselKgPerL: 2.68, petrolKgPerL: 2.31, gridKgPerKWh: 0.71 };
export const ENERGY_GJ = { kWh: 0.0036, dieselL: 0.0359, petrolL: 0.0322 };

// I(id, label, unit, typicalMonthlyValue, options)
const I = (id, label, unit, typ, o = {}) => ({ id, label, unit, typ, kind: 'flow', int: unit === 'Count' || unit === 'Personnel', ...o });
const L = (ind) => ({ ...ind, lead: true });

export const PRINCIPLES = [
  { id: 'P1', label: 'Ethics & Transparency', pillar: 'G', sdg: [16], indicators: [
    I('p1_trained', 'Employees & workers trained on ethics / anti-corruption', 'Count', 60),
    I('p1_corr', 'Corruption / bribery complaints received', 'Count', 0.004, { req: true }),
    I('p1_fines', 'Fines / penalties paid to regulators', 'INR', 0.008, { mag: 150000 }),
    I('p1_disc', 'Disciplinary actions for ethics violations', 'Count', 0.02),
    L(I('p1_coi', 'Conflict-of-interest complaints', 'Count', 0.03)),
    L(I('p1_aware', 'Ethics awareness programmes held', 'Count', 1.5)),
  ]},
  { id: 'P2', label: 'Sustainable Goods & Services', pillar: 'E', sdg: [9, 12], indicators: [
    I('p2_input', 'Total input materials procured', 'Metric Tons', 2400, { req: true, ev: true }),
    I('p2_recycled', 'Recycled / reused input material', 'Metric Tons', 180, { ev: true }),
    I('p2_capex', 'Capex on environmental & social improvements', 'INR', 650000),
    L(I('p2_lca', 'Life-cycle / impact assessments conducted', 'Count', 0.1)),
    L(I('p2_scrap', 'Scrap & material reclaimed at end of use', 'Metric Tons', 40)),
  ]},
  { id: 'P3', label: 'Employee Wellbeing & Safety', pillar: 'S', sdg: [3, 5, 8], indicators: [
    I('p3_pm', 'Permanent employees — Male', 'Personnel', 140, { kind: 'stock', req: true }),
    I('p3_pf', 'Permanent employees — Female', 'Personnel', 22, { kind: 'stock', req: true }),
    I('p3_cm', 'Contract workers — Male', 'Personnel', 520, { kind: 'stock', req: true }),
    I('p3_cf', 'Contract workers — Female', 'Personnel', 60, { kind: 'stock', req: true }),
    I('p3_dis', 'Differently-abled employees & workers', 'Personnel', 3, { kind: 'stock' }),
    I('p3_hires', 'New hires in the month', 'Count', 18),
    I('p3_exits', 'Separations in the month', 'Count', 14),
    I('p3_manhrs', 'Man-hours worked', 'Hours', 110000, { core: 'safety', req: true, ev: true }),
    I('p3_lti', 'Lost-time injuries (LTI)', 'Count', 0.05, { core: 'safety', req: true, ev: true }),
    I('p3_rec', 'Recordable work-related injuries', 'Count', 0.09, { core: 'safety', req: true, ev: true }),
    I('p3_fat', 'Fatalities', 'Count', 0.002, { core: 'safety', req: true, ev: true }),
    I('p3_pd', 'Permanent disabilities', 'Count', 0.002, { core: 'safety' }),
    I('p3_hstrain', 'Workers trained on health & safety', 'Count', 400, { ev: true }),
    I('p3_wellbeing', 'Spend on employee wellbeing (health, insurance, accident)', 'INR', 950000, { core: 'safety', ev: true }),
    I('p3_wages', 'Gross wages paid — total', 'INR', 24000000, { core: 'gender', req: true, ev: true }),
    I('p3_wagesf', 'Gross wages paid — female', 'INR', 3600000, { core: 'gender', req: true, ev: true }),
    L(I('p3_life', 'Workers covered by life insurance', 'Personnel', 650, { kind: 'stock' })),
    L(I('p3_leave', 'Parental leave availed', 'Count', 1)),
  ]},
  { id: 'P4', label: 'Stakeholder Engagement', pillar: 'S', sdg: [10, 17], indicators: [
    I('p4_groups', 'Stakeholder groups engaged', 'Count', 4, { kind: 'stock' }),
    I('p4_meet', 'Stakeholder consultation meetings held', 'Count', 6),
    I('p4_griev', 'Community grievances received', 'Count', 2),
    I('p4_resolved', 'Community grievances resolved', 'Count', 1.8),
    L(I('p4_board', 'Consultations escalated to management / board', 'Count', 1)),
    L(I('p4_vuln', 'Engagements with vulnerable / marginalised groups', 'Count', 2)),
  ]},
  { id: 'P5', label: 'Human Rights', pillar: 'S', sdg: [5, 8, 10], indicators: [
    I('p5_hrtrain', 'Employees & workers trained on human rights', 'Count', 120),
    I('p5_child', 'Child-labour complaints', 'Count', 0.0005, { req: true }),
    I('p5_forced', 'Forced-labour complaints', 'Count', 0.0005, { req: true }),
    I('p5_posh', 'Sexual-harassment (POSH) complaints', 'Count', 0.004, { core: 'gender', req: true }),
    I('p5_disc', 'Discrimination complaints', 'Count', 0.004),
    I('p5_belowmin', 'Workers paid below minimum wage', 'Count', 0, { req: true }),
    I('p5_griev', 'Human-rights grievances received (all channels)', 'Count', 0.02),
    L(I('p5_dd', 'Human-rights due-diligence assessments (plants / offices)', 'Count', 0.15)),
    L(I('p5_vcdd', 'Value-chain partners assessed for human-rights risk', 'Count', 0.3)),
    L(I('p5_access', 'Accessibility upgrades to premises', 'Count', 0.05)),
    L(I('p5_corrective', 'Corrective actions on human-rights findings', 'Count', 0.05)),
  ]},
  { id: 'P6', label: 'Environment', pillar: 'E', sdg: [6, 7, 12, 13, 15], indicators: [
    I('p6_grid', 'Grid electricity purchased', 'kWh', 45000, { core: 'energy', req: true, ev: true }),
    I('p6_renew', 'Renewable electricity consumed (on-site)', 'kWh', 50000, { core: 'energy', ev: true }),
    I('p6_dg', 'Diesel — stationary DG sets', 'Liters', 4200, { core: 'ghg', req: true, ev: true }),
    I('p6_mach', 'Diesel — heavy machinery & vehicles', 'Liters', 30000, { core: 'ghg', req: true, ev: true }),
    I('p6_petrol', 'Petrol — vehicles', 'Liters', 900, { core: 'ghg', ev: true }),
    I('p6_water', 'Total freshwater withdrawn', 'Kiloliters', 1200, { core: 'water', req: true, ev: true }),
    I('p6_ground', '  of which groundwater', 'Kiloliters', 300, { core: 'water' }),
    I('p6_third', '  of which third-party (municipal / tanker)', 'Kiloliters', 500, { core: 'water' }),
    I('p6_disch', 'Water discharged', 'Kiloliters', 200, { core: 'water' }),
    I('p6_haz', 'Hazardous waste generated', 'Metric Tons', 3.2, { core: 'circ', req: true, ev: true }),
    I('p6_nonhaz', 'Non-hazardous waste generated (C&D, general)', 'Metric Tons', 55, { core: 'circ', req: true }),
    I('p6_recyc', 'Waste recycled / reused / recovered', 'Metric Tons', 38, { core: 'circ' }),
    I('p6_disp', 'Waste disposed (landfill / incineration)', 'Metric Tons', 20, { core: 'circ' }),
    I('p6_plastic', 'Plastic waste generated', 'Metric Tons', 1.1, { core: 'circ' }),
    I('p6_ewaste', 'E-waste generated', 'Metric Tons', 0.05, { core: 'circ' }),
    I('p6_incident', 'Environmental incidents / spills', 'Count', 0.005),
    L(I('p6_recw', 'Water recycled or reused', 'Kiloliters', 250)),
    L(I('p6_s3', 'Scope 3 emissions (site-assessed value chain)', 'tCO2e', 60)),
    L(I('p6_green', 'Saplings planted / green cover created', 'Count', 250)),
    L(I('p6_nox', 'NOx emissions', 'Metric Tons', 0.8)),
  ]},
  { id: 'P7', label: 'Responsible Public Policy', pillar: 'G', sdg: [16, 17], indicators: [
    I('p7_assoc', 'Active trade / industry association memberships', 'Count', 3, { kind: 'stock' }),
    I('p7_anti', 'Corrective actions on anti-competitive conduct', 'Count', 0),
    L(I('p7_adv', 'Public-policy positions advocated', 'Count', 0.1)),
  ]},
  { id: 'P8', label: 'Inclusive Growth', pillar: 'S', sdg: [1, 8, 10, 11], indicators: [
    I('p8_sia', 'Social impact assessments conducted', 'Count', 0.2),
    I('p8_rr', 'Project-affected families rehabilitated (R&R)', 'Count', 6),
    I('p8_csr', 'CSR spend', 'INR', 380000, { ev: true }),
    I('p8_ben', 'CSR beneficiaries', 'Count', 250),
    I('p8_proc', 'Total procurement', 'INR', 42000000, { req: true, ev: true }),
    I('p8_msme', 'Direct procurement from MSMEs / small producers', 'INR', 5500000, { core: 'inclusive', req: true, ev: true }),
    I('p8_india', 'Direct procurement sourced within India', 'INR', 38000000, { core: 'inclusive', ev: true }),
    I('p8_local', 'Procurement from within state / district', 'INR', 9000000),
    I('p8_jobsw', 'Wages paid to workers in smaller / aspirational towns', 'INR', 4000000, { core: 'inclusive' }),
  ]},
  { id: 'P9', label: 'Client & Consumer Value', pillar: 'G', sdg: [12, 16], indicators: [
    I('p9_comp', 'Client / customer complaints received', 'Count', 1.2),
    I('p9_res', 'Client / customer complaints resolved', 'Count', 1),
    I('p9_priv', 'Data-privacy complaints', 'Count', 0.03),
    I('p9_cyber', 'Cyber-security incidents', 'Count', 0.05),
    I('p9_recall', 'Product / service recalls', 'Count', 0.01),
    I('p9_advert', 'Advertising / marketing complaints', 'Count', 0.02),
    I('p9_trade', 'Restrictive / unfair trade-practice complaints', 'Count', 0.01),
    L(I('p9_survey', 'Client satisfaction surveys conducted', 'Count', 0.3)),
    L(I('p9_esg', 'Responsible-delivery / ESG disclosures issued to clients', 'Count', 0.3)),
  ]},
];

export const INDICATORS = Object.fromEntries(
  PRINCIPLES.flatMap((p) => p.indicators.map((i) => [i.id, { ...i, principle: p.id }]))
);
export const principleOf = (id) => PRINCIPLES.find((p) => p.id === id);

// BRSR Core – SEBI's 9-attribute subset of BRSR (2023 circular). Attributes 1–7 aggregate from
// site data; 8 (Fairness) & 9 (Openness) are entity-level financial disclosures captured once,
// in Section A & B, not per-site — see CORE8_FAIRNESS / CORE9_OPENNESS below for their exact sub-metrics.
export const CORE_ATTRS = [
  { id: 'ghg', label: 'GHG footprint', sdg: [13], site: true },
  { id: 'water', label: 'Water footprint', sdg: [6], site: true },
  { id: 'energy', label: 'Energy footprint', sdg: [7], site: true },
  { id: 'circ', label: 'Embracing circularity', sdg: [12], site: true },
  { id: 'safety', label: 'Employee wellbeing & safety', sdg: [3, 8], site: true },
  { id: 'gender', label: 'Gender diversity in business', sdg: [5], site: true },
  { id: 'inclusive', label: 'Inclusive development', sdg: [8, 10], site: true },
  { id: 'fair', label: 'Fairness with customers & suppliers', sdg: [12, 16], site: false },
  { id: 'open', label: 'Openness of business', sdg: [16], site: false },
];

// Core attribute 8 — Fairness: data-breach ratio + payment-practice metric (not a single blended field)
export const CORE8_FAIRNESS = [
  { id: 'dataBreaches', label: 'Data-breach / cyber-security incidents involving personal data', unit: 'Count' },
  { id: 'dataBreachRatio', label: 'Data-breach ratio (incidents involving personal / total data breaches)', unit: '%' },
  { id: 'payablesDays', label: 'Number of days of accounts payable', unit: 'days' },
];
// Core attribute 9 — Openness: trading-house / dealer concentration + related-party transactions,
// each split into its own metric rather than one blended "openness %".
export const CORE9_OPENNESS = [
  { id: 'purchTradingHousePct', label: 'Purchases from trading houses (% of total purchases)', unit: '%' },
  { id: 'purchTradingHouseCount', label: 'Number of trading houses purchased from', unit: 'Count' },
  { id: 'purchTop10Pct', label: 'Purchases from top 10 trading houses (% of total purchases)', unit: '%' },
  { id: 'salesDealerPct', label: 'Sales to dealers / distributors (% of total sales)', unit: '%' },
  { id: 'salesDealerCount', label: 'Number of dealers / distributors sold to', unit: 'Count' },
  { id: 'salesTop10Pct', label: 'Sales to top 10 dealers / distributors (% of total sales)', unit: '%' },
  { id: 'rptPurchasesPct', label: 'Related-party transactions — purchases (% of total)', unit: '%' },
  { id: 'rptSalesPct', label: 'Related-party transactions — sales (% of total)', unit: '%' },
  { id: 'rptLoansPct', label: 'Related-party transactions — loans & advances (% of total)', unit: '%' },
  { id: 'rptInvestmentsPct', label: 'Related-party transactions — investments (% of total)', unit: '%' },
];
export const CORE_INDICATOR_IDS = Object.values(INDICATORS).filter((i) => i.core).map((i) => i.id);
export const principleHasCore = (pid) => principleOf(pid).indicators.some((i) => i.core);

export const SDGS = {
  1: 'No Poverty', 3: 'Good Health & Well-being', 5: 'Gender Equality', 6: 'Clean Water & Sanitation',
  7: 'Affordable & Clean Energy', 8: 'Decent Work & Economic Growth', 9: 'Industry, Innovation & Infrastructure',
  10: 'Reduced Inequalities', 11: 'Sustainable Cities & Communities', 12: 'Responsible Consumption & Production',
  13: 'Climate Action', 15: 'Life on Land', 16: 'Peace, Justice & Strong Institutions', 17: 'Partnerships for the Goals',
};

// Value-chain (vendor / contractor) questionnaire
export const VENDOR_FIELDS = [
  { id: 'v_turnover', label: 'Total annual revenue', unit: '₹ Cr', req: true },
  { id: 'v_meil', label: 'Revenue from MEIL Group', unit: '₹ Cr', req: true },
  { id: 'v_elec', label: 'Grid electricity consumed', unit: 'kWh', req: true, ev: true },
  { id: 'v_diesel', label: 'Diesel consumed', unit: 'Liters', req: true, ev: true },
  { id: 'v_water', label: 'Water withdrawn', unit: 'Kiloliters', ev: true },
  { id: 'v_waste', label: 'Waste generated', unit: 'Metric Tons' },
  { id: 'v_emp', label: 'Own employees', unit: 'Personnel', req: true },
  { id: 'v_contract', label: 'Contract workers', unit: 'Personnel' },
  { id: 'v_manhrs', label: 'Man-hours worked', unit: 'Hours', req: true, ev: true },
  { id: 'v_lti', label: 'Lost-time injuries', unit: 'Count', req: true, ev: true },
  { id: 'v_fat', label: 'Fatalities', unit: 'Count', req: true },
  { id: 'v_belowmin', label: 'Workers paid below minimum wage', unit: 'Count', req: true },
];
export const vendorEmissions = (v = {}) => ((+v.v_elec || 0) * EF.gridKgPerKWh + (+v.v_diesel || 0) * EF.dieselKgPerL) / 1000;
export const vendorShare = (v = {}) => (+v.v_turnover > 0 ? Math.min(1, (+v.v_meil || 0) / +v.v_turnover) : 0);

// ── Section A structured meta (Annexure I, SEBI BRSR format) ───────────────
export const STAKEHOLDER_GROUPS = ['Communities', 'Investors (other than shareholders)', 'Shareholders', 'Employees and workers', 'Customers', 'Value Chain Partners', 'Other'];
export const COMPLAINT_CATEGORIES_P9 = [
  { id: 'dataPrivacy', label: 'Data privacy' }, { id: 'advertising', label: 'Advertising' }, { id: 'cyberSecurity', label: 'Cyber security' },
  { id: 'deliveryOfEssentialServices', label: 'Delivery of essential services' }, { id: 'restrictiveTradePractices', label: 'Restrictive / unfair trade practices' }, { id: 'other', label: 'Other' },
];

export const ROLE_META = {
  admin: { label: 'Group ESG Admin', home: '/admin' },
  manager: { label: 'BU Manager', home: '/manager' },
  operator: { label: 'Site Operator', home: '/operator' },
  vendor: { label: 'Vendor / Contractor', home: '/vendor' },
  auditor: { label: 'Assessment / Assurance Auditor', home: '/auditor' },
};

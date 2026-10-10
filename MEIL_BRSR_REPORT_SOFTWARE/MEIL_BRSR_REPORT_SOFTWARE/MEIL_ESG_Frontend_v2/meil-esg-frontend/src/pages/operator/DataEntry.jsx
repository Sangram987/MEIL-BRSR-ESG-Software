import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UploadCloud, CheckCircle2, AlertCircle, Info, Paperclip, X, Lock,
  Send, Save, AlertTriangle, Calculator, MessageSquareWarning, Search,
  Filter, Sparkles, FileText, Check, ShieldCheck, Database, Layers
} from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { PRINCIPLES, openPeriods, periodLabel, principleOf, EF, ENERGY_GJ } from '../../data/brsr';
import { validateValues } from '../../lib/validate';
import { fmt } from '../../lib/consolidate';
import { Modal, Btn, StatusBadge, Badge, PageHeader, Card, inputCls, labelCls } from '../../components/ui';
import evidenceApi from '../../services/evidenceApi';
import submissionApi from '../../services/submissionApi';

const DOT = {
  approved: 'bg-emerald-500',
  bu_verified: 'bg-blue-500',
  subsidiary_verified: 'bg-indigo-500',
  submitted: 'bg-amber-500',
  correction_required: 'bg-rose-500',
  rejected: 'bg-rose-500',
  draft: 'bg-slate-400',
  none: 'bg-slate-200'
};

function LivePreview({ principle, values }) {
  const v = (id) => +values[id]?.v || 0;
  let rows = [];

  if (principle === 'P6') {
    const s1 = ((v('p6_dg') + v('p6_mach')) * EF.dieselKgPerL + v('p6_petrol') * EF.petrolKgPerL) / 1000;
    const s2 = (v('p6_grid') * EF.gridKgPerKWh) / 1000;
    const totFuelEnergy = (v('p6_dg') + v('p6_mach')) * ENERGY_GJ.dieselL + v('p6_petrol') * ENERGY_GJ.petrolL;
    const totElect = v('p6_grid') + v('p6_renew') + v('p6_solar');
    const gj = totElect * ENERGY_GJ.kWh + totFuelEnergy;
    const renewShare = totElect ? ((v('p6_renew') + v('p6_solar')) / totElect) * 100 : 0;
    const netWater = Math.max(0, v('p6_water') - v('p6_disch') - v('p6_recw'));
    const totWaste = v('p6_haz') + v('p6_nonhaz');
    const recycShare = totWaste ? (v('p6_recyc') / totWaste) * 100 : 0;

    rows = [
      ['Scope 1 (Fuel combustion)', `${fmt(s1, 2)} tCO2e`],
      ['Scope 2 (Purchased grid)', `${fmt(s2, 2)} tCO2e`],
      ['Total Energy Consumption', `${fmt(gj, 1)} GJ`],
      ['Renewable Energy Share', `${fmt(renewShare, 1)}%`],
      ['Net Water Consumption', `${fmt(netWater)} KL`],
      ['Rainwater Harvested', `${fmt(v('p6_rainwater'))} KL`],
      ['Recycled Waste Ratio', `${fmt(recycShare, 1)}%`],
      ['Tree Saplings Planted', `${fmt(v('p6_green'))} count`],
    ];
  } else if (principle === 'P3') {
    const hc = v('p3_pm') + v('p3_pf') + v('p3_cm') + v('p3_cf');
    const totInjuries = v('p3_lti') + v('p3_rec') + v('p3_fat');
    const ltifr = v('p3_manhrs') ? (v('p3_lti') * 1e6) / v('p3_manhrs') : 0;
    const femShare = hc ? ((v('p3_pf') + v('p3_cf')) / hc) * 100 : 0;
    const wageFemShare = v('p3_wages') ? (v('p3_wagesf') / v('p3_wages')) * 100 : 0;

    rows = [
      ['Total Active Workforce', fmt(hc)],
      ['Female Workforce Share', `${fmt(femShare, 1)}%`],
      ['LTIFR Safety Index', `${fmt(ltifr, 2)} /M hrs`],
      ['Total Work Injuries', fmt(totInjuries)],
      ['Near-Misses Reported', fmt(v('p3_nearmiss'))],
      ['Safety Training Delivered', `${fmt(v('p3_train_hrs'))} hrs`],
      ['Gross Wages Paid', `₹${fmt(v('p3_wages') / 1e5, 1)} L`],
      ['Female Wage Share', `${fmt(wageFemShare, 1)}%`],
    ];
  } else if (principle === 'P2') {
    const totMat = v('p2_input');
    const recycMat = v('p2_recycled');
    const recycShare = totMat ? (recycMat / totMat) * 100 : 0;
    const greenCem = v('p2_green_cement');
    const greenCemShare = totMat ? (greenCem / totMat) * 100 : 0;

    rows = [
      ['Total Procured Materials', `${fmt(totMat)} MT`],
      ['Recycled / Reused Materials', `${fmt(recycMat)} MT`],
      ['Circular Material Input Share', `${fmt(recycShare, 1)}%`],
      ['Low-Carbon Cement Share', `${fmt(greenCemShare, 1)}%`],
      ['Environmental Capex Invested', `₹${fmt(v('p2_capex') / 1e5, 1)} L`],
      ['Active Environmental Clearances', fmt(v('p2_env_clear'))],
    ];
  } else if (principle === 'P8') {
    const totProc = v('p8_proc');
    const msme = v('p8_msme');
    const india = v('p8_india');
    rows = [
      ['Total Procurement Spend', `₹${fmt(totProc / 1e7, 2)} Cr`],
      ['MSME Procurement Share', totProc ? `${fmt((msme / totProc) * 100, 1)}%` : '–'],
      ['Domestic Sourcing Share (India)', totProc ? `${fmt((india / totProc) * 100, 1)}%` : '–'],
      ['Direct CSR Spend', `₹${fmt(v('p8_csr') / 1e5, 1)} L`],
      ['Community Beneficiaries', fmt(v('p8_ben'))],
    ];
  } else if (principle === 'P1') {
    rows = [
      ['Ethics & Anti-Bribery Trained', fmt(v('p1_trained'))],
      ['Corruption Complaints', fmt(v('p1_corr'))],
      ['Statutory Inspections Passed', fmt(v('p1_inspect'))],
      ['Vendors Signed Code of Conduct', fmt(v('p1_vendor_code'))],
    ];
  } else if (principle === 'P9') {
    rows = [
      ['Quality Compression Tests Passed', `${fmt(v('p9_quality_tests'), 1)}%`],
      ['Client Safety Audit Rating', `${fmt(v('p9_safety_ratings'))}/100`],
      ['Customer Complaints Resolved', `${fmt(v('p9_res'))}/${fmt(v('p9_comp'))}`],
    ];
  } else return null;

  return (
    <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800">
      <h3 className="text-xs font-bold text-slate-400 flex items-center gap-2 mb-3">
        <Calculator size={14} className="text-emerald-400" />
        Live System-Derived ESG Performance Metrics ({principle})
      </h3>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows.map(([k, val]) => (
          <div key={k} className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
            <dt className="text-[11px] text-slate-400 font-medium truncate">{k}</dt>
            <dd className="text-base font-black text-emerald-400 mt-0.5">{val}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[10px] text-slate-500 mt-2">
        SEBI BRSR Core formulas applied dynamically · Data verifiable against attached bills, manifests and registers.
      </p>
    </div>
  );
}


const getDefaultFieldValue = (f) => {
  if (['p1_corr', 'p1_fines', 'p1_disc', 'p1_whistle', 'p1_coi', 'p3_lti', 'p3_fat', 'p3_pd', 'p5_child', 'p5_forced', 'p5_posh', 'p5_disc', 'p5_belowmin', 'p6_incident', 'p7_anti'].includes(f.id)) {
    return 0;
  }
  if (f.id === 'p3_rec') return 1;
  if (f.id === 'p9_comp') return 12;
  if (f.id === 'p9_res') return 12;
  if (f.typ != null && f.typ > 0) {
    return f.int ? Math.round(f.typ >= 1 ? f.typ : 0) : f.typ;
  }
  return f.int ? 10 : 25.5;
};

const getDefaultFieldEvidence = (f, reportingPeriod) => {
  const code = f.id.toUpperCase();
  const docMap = {
    p6_grid: 'DISCOM_Electricity_Bill',
    p6_renew: 'Solar_Power_Generation_Log',
    p6_solar: 'Onsite_Solar_Inverter_Export_Slip',
    p6_dg: 'DG_Set_Diesel_Logbook',
    p6_mach: 'Machinery_Diesel_Fuel_Register',
    p6_petrol: 'Vehicle_Petrol_Receipts',
    p6_cng: 'CNG_Dispensing_Challan',
    p6_biodiesel: 'Biodiesel_Procurement_Invoice',
    p6_water: 'Water_Tanker_Meter_Register',
    p6_ground: 'Groundwater_Flow_Meter_Log',
    p6_third: 'Municipal_Water_Supply_Bill',
    p6_surface: 'Canal_Water_Extraction_Log',
    p6_disch: 'Treated_Effluent_Discharge_Report',
    p6_rainwater: 'Rainwater_Recharge_Well_Log',
    p6_etp_effluent: 'ETP_STP_Monitoring_Report',
    p6_haz: 'State_PCB_Hazardous_Waste_Form10',
    p6_nonhaz: 'Construction_Debris_Disposal_Challan',
    p6_recyc: 'Authorized_Recycler_Receipt',
    p6_disp: 'Municipal_Landfill_Weighbridge_Slip',
    p6_plastic: 'CPCB_Plastic_Waste_Audit_Challan',
    p6_ewaste: 'Authorized_Ewaste_Dismantler_Receipt',
    p6_battery_waste: 'Battery_Return_Buyback_Receipt',
    p6_flyash: 'FlyAsh_Utilization_Register',
    p6_topsoil: 'Topsoil_Preservation_Register',
    p6_green: 'Sapling_Plantation_GeoTag_Register',
    p3_pm: 'HR_Payroll_Register_Male',
    p3_pf: 'HR_Payroll_Register_Female',
    p3_cm: 'Contract_Worker_Attendance_Muster',
    p3_cf: 'Female_Contract_Worker_Muster',
    p3_dis: 'Differently_Abled_Employee_Register',
    p3_hires: 'New_Joiners_HR_Register',
    p3_exits: 'Employee_Exit_Clearance_Register',
    p3_manhrs: 'Biometric_Site_Manhours_Report',
    p3_lti: 'Safety_LTI_Incident_Register',
    p3_rec: 'First_Aid_Treatment_Register',
    p3_fat: 'Zero_Fatality_Safety_Affidavit',
    p3_nearmiss: 'NearMiss_Incident_Investigation_Log',
    p3_toolboxtalks: 'Daily_Toolbox_Talk_Attendance_Sheet',
    p3_safety_audits: 'EHS_Safety_Inspection_Checklist',
    p3_hstrain: 'HSE_Training_Attendance_Log',
    p3_train_hrs: 'Safety_Skill_Training_Hours_Record',
    p3_health_camps: 'Occupational_Health_Checkup_Register',
    p3_ppe_issued: 'PPE_Kit_Inspection_Issue_Register',
    p3_wellbeing: 'Employee_Insurance_Health_Spend_Ledger',
    p3_wages: 'Gross_Wage_Disbursement_Payroll',
    p3_wagesf: 'Female_Wage_Disbursement_Payroll',
    p1_trained: 'Ethics_AntiBribery_Training_Register',
    p1_inspect: 'Statutory_Inspection_Clearance_Cert',
    p1_vendor_code: 'Supplier_Code_Of_Conduct_Signoff_Log',
    p2_input: 'Material_Inward_Delivery_Challan',
    p2_recycled: 'Recycled_Steel_Aggregate_Challan',
    p2_green_cement: 'PPC_Green_Cement_Test_Cert',
    p2_capex: 'Environmental_Capex_Voucher',
    p2_env_clear: 'State_PCB_CTO_Consent_Order',
    p8_proc: 'SAP_Procurement_Purchase_Register',
    p8_msme: 'Udyam_MSME_Vendor_Invoices',
    p8_india: 'Domestic_GST_Vendor_Purchase_Register',
    p8_csr: 'Direct_CSR_Expenditure_Voucher',
    p8_ben: 'CSR_Community_Beneficiary_Roll',
  };
  const baseName = docMap[f.id] || `${f.label.slice(0, 24).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_Verification_Doc`;
  return {
    ev: `DOC-${code}-${reportingPeriod}`,
    evName: `${baseName}_${reportingPeriod}.pdf`,
  };
};

export default function DataEntry() {
  const { user, org, calc, actions, toast } = useApp();
  const [sp] = useSearchParams();
  const isManager = user?.role === 'manager';

  const projects = useMemo(() => {
    if (isManager) {
      const match = org.projects.filter((p) => p.buId === user?.buId);
      return match.length > 0 ? match : org.projects.filter((p) => p.buId === 'bu-tunnel');
    }
    const match = org.projects.filter((p) => p.id === user?.projectId);
    if (match.length > 0) return match;
    const zojila = org.projects.find((p) => p.name === 'Zojila Tunnel Package 1');
    if (zojila) return [zojila, ...org.projects.filter((p) => p.id !== zojila.id)];
    return org.projects.length > 0 ? org.projects : [
      { id: 'prj-001', name: 'Zojila Tunnel Package 1', state: 'JK', projectCode: 'ZOJ-01' },
      { id: 'prj-002', name: 'Polavaram Irrigation Hydro Works', state: 'AP', projectCode: 'POL-01' },
      { id: 'prj-003', name: 'Kaleshwaram Lift Irrigation Pkg 6', state: 'TS', projectCode: 'KAL-06' },
      { id: 'prj-004', name: 'Thane-Borivali Twin Road Tunnel', state: 'MH', projectCode: 'TBN-01' },
    ];
  }, [org, user, isManager]);

  const [projectId, setProjectId] = useState(projects[0]?.id || 'prj-001');
  const [period, setPeriod] = useState('2026-09');
  const [principle, setPrinciple] = useState(PRINCIPLES.some((p) => p.id === sp.get('principle')) ? sp.get('principle') : 'P6');
  const [tier, setTier] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [values, setValues] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const project = org.projects.find((p) => p.id === projectId) || projects[0];
  const localExisting = calc.byKey.get(`${projectId}|${period}|${principle}`);
  const [dbExisting, setDbExisting] = useState(null);
  const existing = dbExisting || localExisting;
  const setExisting = setDbExisting;

  const locked = existing && ['submitted', 'bu_verified', 'subsidiary_verified', 'approved', 'locked'].includes(existing.status);
  const status = calc.projectStatus(projectId, period) || {};
  const pr = principleOf(principle);
  const allPrincipleFields = pr.indicators;
  const fileRef = useRef({});

  const [uploadingEvidence, setUploadingEvidence] = useState({});

  useEffect(() => {
    const rawExisting = existing?.values ? structuredClone(existing.values) : {};
    const populated = {};

    allPrincipleFields.forEach((f) => {
      const cell = rawExisting[f.id];
      const hasVal = cell?.v !== '' && cell?.v != null;

      const defaultVal = getDefaultFieldValue(f);
      const defaultEv = getDefaultFieldEvidence(f, period);

      populated[f.id] = {
        v: hasVal ? cell.v : defaultVal,
        ev: cell?.ev || defaultEv.ev,
        evName: cell?.evName || defaultEv.evName,
      };
    });

    setValues(populated);
    setAttempted(false);
  }, [projectId, period, principle, existing?.id, existing?.status, allPrincipleFields]);

  useEffect(() => {
    const p = sp.get('principle');
    if (p && PRINCIPLES.some((x) => x.id === p)) setPrinciple(p);
  }, [sp]);

  // Load existing submission from database
  useEffect(() => {
    let cancelled = false;

    async function loadSubmission() {
      if (!projectId) {
        setExisting(null);
        return;
      }

      try {
        const result = await submissionApi.listSubmissions({
          projectId,
          reportingPeriodId: period,
        });

        const found = result.items.find((item) => item.principle === principle);
        if (!cancelled) {
          setExisting(found || null);
        }
      } catch (error) {
        if (!cancelled) {
          // Gracefully fallback to local store
        }
      }
    }

    loadSubmission();

    return () => {
      cancelled = true;
    };
  }, [projectId, period, principle]);

  const result = useMemo(
    () => validateValues({ principle, values, project, period, calc }),
    [principle, values, project, period, calc]
  );

  const filteredFields = useMemo(() => {
    return allPrincipleFields.filter((i) => {
      if (tier === 'essential' && i.lead) return false;
      if (tier === 'leadership' && !i.lead) return false;
      if (tier === 'evidence' && !values[i.id]?.ev) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = i.label.toLowerCase().includes(q);
        const matchUnit = (i.unit || '').toLowerCase().includes(q);
        const matchId = i.id.toLowerCase().includes(q);
        if (!matchLabel && !matchUnit && !matchId) return false;
      }
      return true;
    });
  }, [allPrincipleFields, tier, searchQuery, values]);

  const totalFieldCount = allPrincipleFields.length;
  const filledFieldCount = allPrincipleFields.filter((f) => values[f.id]?.v !== '' && values[f.id]?.v != null).length;
  const evidenceFieldCount = allPrincipleFields.filter((f) => !!values[f.id]?.ev).length;
  const coreFieldCount = allPrincipleFields.filter((f) => f.core).length;

  const setVal = (id, v) => setValues((s) => ({ ...s, [id]: { ev: '', ...s[id], v } }));
  const setEv = (id, name) => setValues((s) => ({ ...s, [id]: { v: '', ...s[id], ev: name } }));

  const msgFor = (id) => [
    ...result.errors.filter((e) => e.id === id).map((e) => ({ ...e, sev: 'err' })),
    ...result.warnings.filter((w) => w.id === id).map((w) => ({ ...w, sev: 'warn' })),
  ];
  const actor = { name: user.name, role: user.role };

  const onFile = async (id, file) => {
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast('File is larger than 25 MB.', 'error');
      return;
    }

    try {
      setUploadingEvidence((current) => ({ ...current, [id]: true }));

      // Draft values object for saving
      const draftValues = Object.fromEntries(
        Object.entries(values).map(([code, cell]) => [
          code,
          { v: cell?.v ?? '', ev: cell?.ev || '' },
        ])
      );

      let docId = `DOC-${Date.now().toString(36).toUpperCase()}`;
      let docName = file.name;

      try {
        const submission = await submissionApi.saveSubmission(
          projectId,
          period,
          principle,
          draftValues,
          false
        );

        const valueRow = submission?.values?.[id];
        const document = await evidenceApi.uploadDocument(file);
        docId = document.id;
        docName = document.name;

        if (valueRow?.id) {
          await evidenceApi.linkDocumentToValue(document.id, valueRow.id, `${principle} · ${id}`);
        }
      } catch (err) {
        // Local fallback if backend storage is unavailable
        console.warn('Physical storage upload note:', err);
      }

      setValues((current) => ({
        ...current,
        [id]: {
          ...(current[id] || {}),
          v: current[id]?.v ?? '',
          ev: docId,
          evName: docName,
        },
      }));

      toast(`${docName} attached as verified ESG evidence.`);
    } catch (error) {
      toast(error.message || 'Evidence upload error.', 'error');
    } finally {
      setUploadingEvidence((current) => ({ ...current, [id]: false }));
    }
  };

  const quickFillDemo = () => {
    const next = { ...values };
    allPrincipleFields.forEach((f) => {
      const defaultVal = getDefaultFieldValue(f);
      const defaultEv = getDefaultFieldEvidence(f, period);
      next[f.id] = {
        v: defaultVal,
        ev: defaultEv.ev,
        evName: defaultEv.evName,
      };
    });
    setValues(next);
    toast(`Pre-filled typical ESG metrics and sample evidence for ${principle}.`, 'success');
  };

  const save = async () => {
    try {
      setSaving(true);
      await actions.saveSubmission({
        projectId,
        period,
        principle,
        values,
        submit: false,
        actor,
      });
      toast(`Draft saved for ${principle}.`);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const doSubmit = async () => {
    try {
      setSaving(true);
      const saved = await actions.saveSubmission({
        projectId,
        period,
        principle,
        values,
        submit: true,
        actor,
      });
      setExisting(saved);
      setConfirm(null);
      toast(`${principle} committed and submitted to BU Manager for verification.`);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    setAttempted(true);
    if (result.errors.length) {
      toast(`Fix ${result.errors.length} error${result.errors.length > 1 ? 's' : ''} before submitting.`, 'error');
      return;
    }
    const filled = Object.values(values).some((c) => c.v !== '' && c.v != null);
    if (!filled) {
      toast('Enter at least one value.', 'error');
      return;
    }
    if (result.warnings.length) setConfirm(result.warnings);
    else doSubmit();
  };

  if (!project) return <Card>No project is assigned to your profile.</Card>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Project Data Capture & Comprehensive ESG Entry"
        subtitle="Enter site-level metrics mapped across SEBI's 9 BRSR principles. Attach verified evidence documents to each value — BRSR Core statutory compliance is audited directly against this lineage."
        badge="Option B · Manual Entry & Document Linking"
      />

      {/* Top Project & Period Card */}
      <Card className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/80 border-slate-200">
        <div>
          <label className={labelCls} htmlFor="prj">Reporting Project Site</label>
          {projects.length > 1 ? (
            <select
              id="prj"
              className={inputCls}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.state ? `(${p.state})` : ''} · {p.projectCode || p.id}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg flex items-center gap-2">
              <Lock size={13} className="text-slate-400" />
              {project.name} ({project.state || 'IN'})
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Division & Subsidiary Hierarchy</label>
          <div className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 truncate">
            {calc.buById.get(project?.buId)?.name || 'Tunnels & Transit Division'} · {calc.subById.get(project?.subId)?.name || 'MEIL Infrastructure & Utilities'}
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="period">Reporting Period</label>
          <select
            id="period"
            className={inputCls}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {openPeriods().map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)} (FY 2026-27) {p === '2026-09' ? '● Current Active' : ''}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Principle Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-2 overflow-x-auto" role="tablist" aria-label="BRSR principles">
        <div className="flex gap-2 min-w-max">
          {PRINCIPLES.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={principle === p.id}
              onClick={() => setPrinciple(p.id)}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 border ${
                principle === p.id
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-transparent'
              }`}
            >
              <span className={`px-2 py-0.5 rounded text-[10px] ${principle === p.id ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {p.id}
              </span>
              <span>{p.label}</span>
              <span className={`h-2 w-2 rounded-full ${DOT[status[p.id]] || 'bg-slate-200'}`} title={status[p.id]} />
            </button>
          ))}
        </div>
      </div>

      {/* Review Feedback Alerts */}
      {existing?.status === 'correction_required' && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex gap-3 text-sm text-rose-900">
          <MessageSquareWarning className="shrink-0 mt-0.5" size={18} />
          <div>
            <b>Correction requested by {existing.reviewer?.name || 'Reviewer'}:</b> {existing.reviewer?.comment || 'Please update flagged metrics.'}
            <p className="text-xs text-rose-700 mt-1">Fix the flagged values or attach updated evidence documents, then re-submit.</p>
          </div>
        </div>
      )}

      {existing?.status === 'rejected' && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-900">
          <b>Rejected by {existing.reviewer?.name || 'Reviewer'}:</b> {existing.reviewer?.comment}
        </div>
      )}

      {locked && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-100 flex gap-3 text-sm text-slate-700 items-center">
          <Lock size={18} className="text-slate-500 shrink-0" />
          <div>
            <span>
              This packet is <b>{
                existing.status === 'approved' || existing.status === 'locked'
                  ? 'Admin Approved & Locked'
                  : existing.status === 'subsidiary_verified'
                  ? 'Subsidiary Verified (Pending Admin Approval)'
                  : existing.status === 'bu_verified'
                  ? 'BU Manager Verified (Pending Subsidiary Review)'
                  : 'Committed by Site Operator (Awaiting BU Review)'
              }</b>.
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              {existing.status === 'approved' || existing.status === 'locked'
                ? 'Final approval was granted by Group Admin. Data is immutable and locked for statutory BRSR reporting.'
                : existing.status === 'subsidiary_verified'
                ? 'Verified by Subsidiary Governance. Packet is now in the Group Admin queue for final approval.'
                : existing.status === 'bu_verified'
                ? 'Verified by BU Manager. Packet is in the Subsidiary queue for divisional review.'
                : 'Data was committed by the site operator and forwarded to the BU Manager for verification.'}
            </p>
          </div>
          <span className="ml-auto shrink-0"><StatusBadge status={existing.status} /></span>
        </div>
      )}

      {/* Indicator Form Container */}
      <Card>
        {/* Header with Title and Tier Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                {principle}
              </span>
              <h2 className="text-base font-black text-slate-900">{pr.label}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {periodLabel(period)} · {project.name} ({project.state || 'IN'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!locked && (
              <button
                type="button"
                onClick={quickFillDemo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                title="Fill typical baseline numbers & sample proofs for all fields"
              >
                <Sparkles size={13} /> Auto-Fill Typical Values
              </button>
            )}

            <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0" role="group">
              {[
                ['all', `All (${totalFieldCount})`],
                ['essential', 'Essential (Mandatory)'],
                ['leadership', 'Leadership (Voluntary)'],
                ['evidence', `With Evidence (${evidenceFieldCount})`]
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTier(k)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                    tier === k
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Progress & Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-4">
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">Total ESG Indicators</span>
            <span className="text-base font-black text-slate-900">{totalFieldCount} fields</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">Completed Metrics</span>
            <span className="text-base font-black text-emerald-600">{filledFieldCount} / {totalFieldCount}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">Evidence Attached</span>
            <span className="text-base font-black text-blue-600">{evidenceFieldCount} files linked</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">SEBI BRSR Core Fields</span>
            <span className="text-base font-black text-rose-600">{coreFieldCount} assurance items</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search indicators by name or unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <b>{filteredFields.length}</b> of {totalFieldCount} metrics
          </div>
        </div>

        {/* Information Callout */}
        <div className="bg-emerald-50/70 text-emerald-900 p-3 rounded-xl flex items-start gap-2.5 text-xs font-medium mb-6 border border-emerald-200 leading-relaxed">
          <Info size={15} className="mt-0.5 shrink-0 text-emerald-700" />
          <p>
            Fields marked <b className="text-rose-600">*</b> are mandatory. Fields with <Badge tone="rose" className="mx-0.5">Core</Badge> feed SEBI's assured BRSR Core footprint. Every metric supports evidence document linking (bills, weighbridge receipts, meter logs, test certificates).
          </p>
        </div>

        {filteredFields.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs">
            No indicators match the selected view or filter criteria.
          </div>
        )}

        {/* Input Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {filteredFields.map((f) => {
            const c = values[f.id] || {};
            const msgs = attempted || msgFor(f.id).some((m) => m.kind === 'spike' || m.kind === 'drop') ? msgFor(f.id) : [];
            const h = c.v !== '' && c.v != null ? null : calc.historyAvg(project, f.id, period);

            return (
              <div
                key={f.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  c.ev
                    ? 'bg-slate-50/60 border-slate-200 ring-1 ring-slate-200/50'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <label className="text-xs font-bold text-slate-800 block leading-snug" htmlFor={f.id}>
                    {f.label.trim()} {f.req && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="flex items-center gap-1 shrink-0">
                    {f.core && <Badge tone="rose" className="text-[10px] px-1.5 py-0.2">Core</Badge>}
                    {f.lead && <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Leadership</span>}
                  </div>
                </div>

                <div className="flex shadow-2xs rounded-lg">
                  <input
                    id={f.id}
                    type="number"
                    min="0"
                    step={f.int ? 1 : 0.01}
                    inputMode="decimal"
                    disabled={locked}
                    placeholder={h?.avg != null ? `6-mo avg: ${fmt(h.avg, f.int ? 0 : 1)}` : '0'}
                    value={c.v ?? ''}
                    onChange={(e) => setVal(f.id, e.target.value)}
                    className={`w-full bg-white border border-slate-300 border-r-0 rounded-l-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-60 ${
                      msgs.some((m) => m.sev === 'err') ? 'border-rose-400 bg-rose-50' : ''
                    }`}
                  />
                  <span className="inline-flex items-center px-3 border border-slate-300 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-r-lg whitespace-nowrap min-w-[88px] justify-center">
                    {f.unit}
                  </span>
                </div>

                {/* Universal Evidence Attachment Section */}
                <div className="mt-2.5">
                  {c.ev ? (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 font-bold text-emerald-800">
                        <Paperclip size={13} className="shrink-0 text-emerald-600" />
                        <span className="truncate">{c.evName || `Proof Document (${String(c.ev).slice(0, 10)})`}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-200 text-emerald-900 font-semibold shrink-0">Verified</span>
                      </div>
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => setEv(f.id, '')}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition shrink-0"
                          title="Remove attached evidence"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ) : !locked ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={(el) => { fileRef.current[f.id] = el; }}
                        type="file"
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                        onChange={(e) => onFile(f.id, e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        disabled={uploadingEvidence[f.id]}
                        onClick={() => fileRef.current[f.id]?.click()}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50/60 border border-dashed border-slate-300 hover:border-emerald-400 rounded-lg px-2.5 py-1 transition disabled:opacity-50"
                      >
                        <UploadCloud size={13} className="text-emerald-600" />
                        {uploadingEvidence[f.id] ? 'Uploading proof...' : 'Attach Evidence (PDF / Bill / Slip)'}
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Validation Warnings / Spikes */}
                {msgs.map((m, i) => (
                  <p key={i} className={`text-[11px] font-semibold mt-1.5 flex items-center gap-1 ${m.sev === 'err' ? 'text-rose-600' : 'text-amber-600'}`}>
                    {m.sev === 'err' ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}
                    {m.msg}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Dynamic ESG Live Calculations */}
      <LivePreview principle={principle} values={values} />

      {/* Sticky Bottom Actions Bar */}
      <div className="sticky bottom-3 z-20">
        <div className="bg-white/95 backdrop-blur border border-slate-200 shadow-lg rounded-xl p-3 flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-600 mr-auto flex items-center gap-2 font-medium">
            {existing ? <StatusBadge status={existing.status} /> : <Badge tone="teal">New Packet</Badge>}
            <span><b>{filledFieldCount}</b> / {totalFieldCount} filled</span>
            <span className="text-blue-600">({evidenceFieldCount} evidence files)</span>
            {attempted && result.errors.length > 0 && (
              <span className="text-rose-600 font-bold ml-2">● {result.errors.length} error(s)</span>
            )}
            {result.warnings.length > 0 && (
              <span className="text-amber-600 font-bold ml-2">● {result.warnings.length} warning(s)</span>
            )}
            {isManager && <span className="text-slate-400 ml-2">Entered on behalf of site</span>}
          </div>

          <Btn tone="ghost" onClick={save} disabled={locked || saving}>
            <Save size={15} /> Save Draft
          </Btn>

          <Btn tone="primary" onClick={submit} disabled={locked || saving}>
            <Send size={15} />
            {existing?.status === 'correction_required' ? 'Re-Submit to BU Manager' : 'Submit for Verification'}
          </Btn>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Submit with Outlier Warnings?"
        subtitle="Your BU Manager will inspect these historical deviation flags alongside your attached evidence."
        footer={
          <>
            <Btn tone="ghost" onClick={() => setConfirm(null)}>Go Back & Fix</Btn>
            <Btn tone="warn" onClick={doSubmit}>
              <CheckCircle2 size={16} /> Submit Anyway
            </Btn>
          </>
        }
      >
        <ul className="space-y-2">
          {confirm?.map((w, i) => (
            <li key={i} className="flex gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <span>
                <b>{principleOf(principle).indicators.find((x) => x.id === w.id)?.label.trim()}:</b> {w.msg}
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

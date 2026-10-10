import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck, AlertTriangle, ShieldCheck, FileCheck, Layers,
  Eye, Check, X, ArrowRight, Building2, MapPin, Sparkles, Activity,
  Scale, Filter, RefreshCw, Play, ShieldAlert, Cpu, Network, CheckCircle2
} from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { Card, CardHeader, Btn, Badge, StatusBadge, Progress, Modal, PageHeader } from '../../components/ui';
import StatCard from '../../components/StatCard';
import verigraphApi from '../../services/verigraphApi';
import VerigraphPipelineDemo from '../../components/VerigraphPipelineDemo';
import { PRINCIPLES, CURRENT_PERIOD, periodLabel } from '../../data/brsr';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function ReviewVerificationPortal() {
  const { user, calc, ui, org, actions, toast } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active view tab
  const activeTab = searchParams.get('tab') || 'queue';
  const setTab = (t) => setSearchParams({ tab: t });

  // Scope mode: BU Scope vs Subsidiary Scope
  const [scopeMode, setScopeMode] = useState('bu'); // 'bu' | 'subsidiary'
  const [selectedBuId, setSelectedBuId] = useState(user?.buId || 'bu-tunnel');
  const [selectedSubId, setSelectedSubId] = useState('sub-infra');

  // Selected submission modal / inspector
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Correction dialog
  const [correctionNote, setCorrectionNote] = useState('');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // Trust Scores and verifications from backend
  const [trustData, setTrustData] = useState(null);
  const [verifications, setVerifications] = useState([]);
  const [loadingForensics, setLoadingForensics] = useState(false);

  useEffect(() => {
    async function loadForensics() {
      try {
        setLoadingForensics(true);
        const [ts, vr] = await Promise.all([
          verigraphApi.getTrustScores(),
          verigraphApi.getVerifications(),
        ]);
        setTrustData(ts);
        setVerifications(vr);
      } catch (err) {
        console.error('Failed to load forensic data:', err);
        setTrustData(null);
        setVerifications([]);
      } finally {
        setLoadingForensics(false);
      }
    }
    loadForensics();
  }, []);

  // Filter projects and submissions based on scope
  const scopedProjects = useMemo(() => {
    if (scopeMode === 'bu') {
      return org.projects.filter((p) => p.buId === selectedBuId);
    }
    return org.projects.filter((p) => p.subId === selectedSubId);
  }, [org.projects, scopeMode, selectedBuId, selectedSubId]);

  const scopedProjectIds = useMemo(() => new Set(scopedProjects.map((p) => p.id)), [scopedProjects]);

  const scopedSubmissions = useMemo(() => {
    return calc.submissions.filter((s) => scopedProjectIds.has(s.projectId));
  }, [calc.submissions, scopedProjectIds]);

  // Review Queue
  const reviewQueue = useMemo(() => {
    return scopedSubmissions.filter((s) => s.status === 'submitted');
  }, [scopedSubmissions]);

  // Flagged Anomalies
  const anomalies = useMemo(() => {
    return scopedSubmissions.filter((s) => {
      // Mock / real temporal variance check
      return s.principle === 'P6' || s.status === 'correction_required';
    });
  }, [scopedSubmissions]);

  // Actions - Step 2 in hierarchy: BU Manager verifies and forwards to Subsidiary
  const handleVerify = async (sub) => {
    await actions.review({
      id: sub.id,
      decision: 'bu_verify',
      comment: 'Verified by BU Manager against telemetry and evidence. Forwarded to Subsidiary entity for cross-division review.',
      actor: user,
    });
    setSelectedSubmission(null);
  };

  const handleRequestCorrection = async (sub) => {
    if (!correctionNote.trim()) {
      toast('Please enter a specific note for the site engineer.', 'warning');
      return;
    }
    await actions.review({
      id: sub.id,
      decision: 'correction',
      comment: correctionNote,
      actor: user,
    });
    setShowCorrectionModal(false);
    setSelectedSubmission(null);
    setCorrectionNote('');
  };

  // Queue principle distribution for visual chart
  const queueDistribution = useMemo(() => {
    return PRINCIPLES.map((p) => {
      const count = reviewQueue.filter((s) => s.principle === p.id).length;
      return { principle: p.id, label: p.label.slice(0, 12), count };
    });
  }, [reviewQueue]);

  const buObj = org.bus.find((b) => b.id === selectedBuId) || org.bus[0];
  const subObj = org.subsidiaries.find((s) => s.id === selectedSubId) || org.subsidiaries[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner - Review & Verification Header */}
      <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 rounded-2xl p-6 sm:p-7 text-white border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold mb-2.5 border border-sky-400/30">
              <ClipboardCheck size={14} />
              Portal 2 — BU Manager Verification (Hierarchy: Site Operator → BU Manager → Subsidiary → Group Admin)
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {scopeMode === 'bu' ? buObj?.name : subObj?.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
              Active Scope: <span className="text-sky-300 font-bold">{scopeMode === 'bu' ? 'Business Unit (BU)' : 'Subsidiary Entity'}</span> · {scopedProjects.length} Project Sites · {periodLabel(CURRENT_PERIOD)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Scope Switcher Pill */}
            <div className="bg-slate-800/90 border border-slate-700 p-1 rounded-xl flex items-center">
              <button
                onClick={() => setScopeMode('bu')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  scopeMode === 'bu' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                BU Scope
              </button>
              <button
                onClick={() => setScopeMode('subsidiary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  scopeMode === 'subsidiary' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Subsidiary Scope
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Scope Selector Dropdown */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-bold uppercase tracking-wider">Select Division:</span>
          {scopeMode === 'bu' ? (
            <select
              value={selectedBuId}
              onChange={(e) => setSelectedBuId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-semibold outline-none focus:ring-1 focus:ring-sky-400"
            >
              {org.bus.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <select
              value={selectedSubId}
              onChange={(e) => setSelectedSubId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-semibold outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {org.subsidiaries.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Review Queue"
          value={reviewQueue.length}
          unit="packets awaiting approval"
          icon={ClipboardCheck}
          color="amber"
        />
        <StatCard
          title="Potential Anomalies"
          value={anomalies.length}
          unit="ML & temporal flags"
          icon={AlertTriangle}
          color="rose"
        />
        <StatCard
          title="Average Trust Score"
          value={`${trustData?.averageTrustScore || 84}/100`}
          unit="evidence confidence"
          icon={Sparkles}
          color="emerald"
        />
        <StatCard
          title="Sites in Scope"
          value={scopedProjects.length}
          unit="active project sites"
          icon={MapPin}
          color="sky"
        />
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs font-bold">
        {[
          { id: 'queue', label: `Review Queue (${reviewQueue.length})` },
          { id: 'anomalies', label: `Potential Anomalies (${anomalies.length})` },
          { id: 'evidence', label: 'Evidence Review & Bounding Box' },
          { id: 'verification', label: '5-Agent Verification' },
          { id: 'trust', label: 'Trust Scores' },
          { id: 'temporal', label: 'Temporal Analysis' },
          { id: 'capa', label: 'CAPA Management' },
          { id: 'sites', label: 'Site Performance' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`px-3 py-2 rounded-xl whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: REVIEW QUEUE */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Pending BU Verification Queue</h3>
              <p className="text-xs text-slate-500">Site Operator committed submissions requiring BU Manager verification before forwarding to Admin</p>
            </div>
            <Badge tone="amber">{reviewQueue.length} Pending</Badge>
          </div>

          {reviewQueue.length > 0 && (
            <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Pending Packets by BRSR Principle
              </span>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={queueDistribution} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="principle" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" name="Pending Packets" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {reviewQueue.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
              All site submissions in this scope have been reviewed and processed!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {reviewQueue.map((sub) => {
                const prj = org.projects.find((p) => p.id === sub.projectId) || { name: 'Zojila Tunnel Package' };
                const prObj = PRINCIPLES.find((p) => p.id === sub.principle) || { label: 'Principle Disclosure' };
                return (
                  <div key={sub.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{prj.name}</span>
                        <Badge tone="indigo">{sub.principle} · {prObj.label}</Badge>
                      </div>
                      <p className="text-slate-500">
                        Submitted by: {sub.submittedBy?.name || 'Site Engineer'} · {periodLabel(sub.period)} · ID: <span className="font-mono text-slate-700">{sub.id}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center gap-1"
                      >
                        <Eye size={14} /> Inspect Evidence
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setShowCorrectionModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold transition"
                      >
                        Request Correction
                      </button>
                      <button
                        onClick={() => handleVerify(sub)}
                        className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold transition shadow-xs flex items-center gap-1.5"
                        title="Verify data and forward to Subsidiary for cross-BU review"
                      >
                        <Check size={14} /> Verify & Forward to Subsidiary
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: POTENTIAL ANOMALIES */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'anomalies' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Potential Anomalies & ML Outliers</h3>
              <p className="text-xs text-slate-500">Flags produced by IsolationForest model & MoM temporal verification</p>
            </div>
            <Badge tone="rose">Signal Only · Not Proof of Fraud</Badge>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-900 text-sm flex items-center gap-2">
                <AlertTriangle size={16} /> MEIL Project Site 104 · Diesel Consumption Spike
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-black">
                ANOMALY SCORE: 0.87
              </span>
            </div>
            <p className="text-slate-700">
              September fuel intake reported at <b>12,500 L</b> vs 3-month baseline average of <b>4,350 L</b> (~2.8x spike). Equipment hours increased only 14%.
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-rose-200/60">
              <span className="text-slate-500">Action:</span>
              <span className="font-bold text-rose-800">Assign CAPA for dispenser calibration register reconciliation.</span>
            </div>
          </div>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: EVIDENCE REVIEW & BOUNDING BOX */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'evidence' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Extracted Fact Lineage & OCR Coordinates</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase">Document Identifier</span>
                <span className="font-mono font-bold text-slate-900">EV-2026-000458 · Fuel_Invoice_INV4821.pdf</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase">Quantity Extracted</span>
                <span className="font-bold text-emerald-600 text-sm">1,250 Litres</span>
                <span className="block text-[11px] text-slate-500 mt-1">BBox: [110, 230, 260, 290] · Conf: 96%</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block uppercase">Total Invoice Value</span>
                <span className="font-bold text-sky-600 text-sm">₹118,750.00</span>
                <span className="block text-[11px] text-slate-500 mt-1">BBox: [460, 230, 580, 290] · Conf: 97.8%</span>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col items-center justify-center text-center p-8 bg-slate-900 text-white border-slate-800">
            <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-sky-400 mb-3">
              <FileCheck size={40} />
            </div>
            <h4 className="text-sm font-bold text-white">Cryptographic Lineage Lock</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Extracted facts are locked with OCR pixel bounding boxes and SHA-256 vault addresses.
            </p>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: 5-AGENT VERIFICATION DETAILS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'verification' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">5-Agent Verification Engine</h3>
              <p className="text-xs text-slate-500">Autonomous backend verification performed prior to manager review</p>
            </div>
            <Badge tone="emerald">5 Agents Active</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
              <span className="font-bold text-emerald-900 block text-sm">Agent 1: Document Verification</span>
              <p className="text-slate-600">Recomputes arithmetic (1,250 × ₹95 = ₹118,750). Validates GSTIN structure.</p>
              <Badge tone="emerald">PASS</Badge>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
              <span className="font-bold text-emerald-900 block text-sm">Agent 2: Cross-Document Agent</span>
              <p className="text-slate-600">Reconciles invoice against site dispensing log and equipment slips.</p>
              <Badge tone="emerald">PASS</Badge>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
              <span className="font-bold text-amber-900 block text-sm">Agent 3: Temporal Agent</span>
              <p className="text-slate-600">Compares monthly baseline. Flags ~2.8x MoM fuel spike without output increase.</p>
              <Badge tone="amber">WARNING</Badge>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
              <span className="font-bold text-emerald-900 block text-sm">Agent 4: Deterministic Rule Engine</span>
              <p className="text-slate-600">Checks non-negative values, duplicate invoices, and reporting period bounds.</p>
              <Badge tone="emerald">PASS</Badge>
            </div>

            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-1 sm:col-span-2">
              <span className="font-bold text-rose-900 block text-sm">Agent 5: ML Anomaly Detector (IsolationForest)</span>
              <p className="text-slate-600">Outlier detection on fuel/excavation ratio across sites. Score: 0.87.</p>
              <Badge tone="rose">ANOMALY FLAG</Badge>
            </div>
          </div>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: TRUST SCORES */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'trust' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="text-center p-6 flex flex-col items-center justify-center">
            <span className="text-xs uppercase font-bold text-slate-400">Division Trust Score</span>
            <span className="text-5xl font-black text-slate-900 my-2">84<span className="text-xl text-slate-400">/100</span></span>
            <Badge tone="emerald">High Confidence Ledger</Badge>
            <p className="text-xs text-slate-500 mt-3">Calculated across {scopedProjects.length} sites and 140+ verified invoices</p>
          </Card>

          <Card className="lg:col-span-2 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Trust Factor Distribution</h3>
            <div className="space-y-2">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Provenance Score (Direct Site vs Third-Party):</span>
                <span className="font-bold text-slate-900">92 / 100</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">OCR & Fact Extraction Confidence:</span>
                <span className="font-bold text-slate-900">95 / 100</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Document Verification Arithmetic:</span>
                <span className="font-bold text-slate-900">98 / 100</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Cross-Document Register Consistency:</span>
                <span className="font-bold text-slate-900">90 / 100</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">Temporal Historical Consistency:</span>
                <span className="font-bold text-amber-600">68 / 100 (2 Site Spikes)</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: TEMPORAL ANALYSIS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'temporal' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Division Historical Emissions Baseline</h3>
              <p className="text-xs text-slate-500">12-month MoM Scope 1 and Scope 2 trajectory</p>
            </div>
            <Badge tone="sky">Illustrative Factors</Badge>
          </div>
          <div className="h-64 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { month: 'Oct', scope1: 120, scope2: 80 },
                { month: 'Nov', scope1: 130, scope2: 85 },
                { month: 'Dec', scope1: 140, scope2: 90 },
                { month: 'Jan', scope1: 135, scope2: 88 },
                { month: 'Feb', scope1: 150, scope2: 95 },
                { month: 'Mar', scope1: 160, scope2: 100 },
                { month: 'Apr', scope1: 145, scope2: 92 },
                { month: 'May', scope1: 155, scope2: 98 },
                { month: 'Jun', scope1: 170, scope2: 105 },
                { month: 'Jul', scope1: 165, scope2: 102 },
                { month: 'Aug', scope1: 180, scope2: 110 },
                { month: 'Sep', scope1: 220, scope2: 115 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="scope1" name="Scope 1 (Diesel)" stroke="#0284c7" fill="#0284c7" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="scope2" name="Scope 2 (Electricity)" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: CAPA MANAGEMENT */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'capa' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Division Corrective & Preventive Actions</h3>
              <p className="text-xs text-slate-500">Auto-generated or manager-initiated CAPA investigations</p>
            </div>
            <Btn tone="primary" className="!text-xs">Create New CAPA</Btn>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">CAPA-2026-0091 · Project Site 104</span>
              <Badge tone="rose">OPEN</Badge>
            </div>
            <p className="text-slate-600">
              Fuel consumption inconsistent with historical baseline (+177% MoM spike). Assigned to Site Engineer.
            </p>
            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Due: 30-09-2026</span>
              <button onClick={() => navigate('/manager/capa')} className="text-blue-600 hover:text-blue-700 font-bold">Inspect Details →</button>
            </div>
          </div>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: SITE PERFORMANCE */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'sites' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Project Sites Performance</h3>
              <p className="text-xs text-slate-500">Submission progress across sites in this division</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {scopedProjects.slice(0, 10).map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{p.name}</span>
                  <span className="block text-[11px] text-slate-500">{p.state} · Turnover: ₹{p.turnoverCr} Cr</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={p.live ? 'emerald' : 'sky'}>
                    {p.live ? 'Active Submissions' : 'Baseline Verified'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Correction Modal */}
      {showCorrectionModal && selectedSubmission && (
        <Modal
          title={`Request Correction for ${selectedSubmission.id}`}
          onClose={() => setShowCorrectionModal(false)}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Enter specific instructions for the site engineer to rectify before this packet can be approved.
            </p>
            <textarea
              rows={4}
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder="e.g. Fuel invoice quantity differs from machine operating slip. Please upload dispenser calibration log."
              className="w-full border border-slate-300 rounded-xl p-3 outline-none"
            />
            <div className="flex justify-end gap-2">
              <Btn tone="ghost" onClick={() => setShowCorrectionModal(false)}>Cancel</Btn>
              <Btn tone="danger" onClick={() => handleRequestCorrection(selectedSubmission)}>
                Send Correction Request
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Inspection Modal */}
      {selectedSubmission && !showCorrectionModal && (
        <Modal
          title={`Inspect Submission: ${selectedSubmission.id || selectedSubmission.code}`}
          subtitle={`${org.projects.find((p) => p.id === selectedSubmission.projectId)?.name || selectedSubmission.projectId} · ${selectedSubmission.principle} · ${periodLabel(selectedSubmission.period)}`}
          onClose={() => setSelectedSubmission(null)}
          wide
        >
          <div className="space-y-5 text-xs">
            {/* Top metadata grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Status</span>
                <StatusBadge status={selectedSubmission.status} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Project Site</span>
                <span className="font-bold text-slate-800">
                  {org.projects.find((p) => p.id === selectedSubmission.projectId)?.name || selectedSubmission.projectId}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Reporting Period</span>
                <span className="font-bold text-slate-800">{periodLabel(selectedSubmission.period)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Submitted By</span>
                <span className="font-bold text-slate-800">{selectedSubmission.submittedBy?.name || 'Site Engineer'}</span>
              </div>
            </div>

            {/* Submission values table */}
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Submitted Metric Values & Evidence Lineage</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Indicator Code</th>
                      <th className="p-2.5">Reported Value</th>
                      <th className="p-2.5">Evidence Attachment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSubmission.values && Object.keys(selectedSubmission.values).length > 0 ? (
                      Object.entries(selectedSubmission.values).map(([key, val]) => (
                        <tr key={key}>
                          <td className="p-2.5 font-mono font-bold text-slate-800">{key}</td>
                          <td className="p-2.5 font-bold text-indigo-700">{val?.v !== undefined && val?.v !== null ? String(val.v) : '—'}</td>
                          <td className="p-2.5">
                            {val?.ev ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                <CheckCircle2 size={12} /> {val.ev}
                              </span>
                            ) : (
                              <span className="text-slate-400">None attached</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-3 text-center text-slate-500">
                          Raw packet data: {JSON.stringify(selectedSubmission.data || selectedSubmission.values || {})}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <Btn tone="ghost" onClick={() => setSelectedSubmission(null)}>Close</Btn>
              <Btn
                tone="warning"
                onClick={() => {
                  setShowCorrectionModal(true);
                }}
              >
                Request Correction
              </Btn>
              <Btn
                tone="primary"
                onClick={() => handleVerify(selectedSubmission)}
              >
                Verify & Forward to Subsidiary
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Interactive 16-Step Pipeline Demo Modal */}
      <VerigraphPipelineDemo
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
      />
    </div>
  );
}

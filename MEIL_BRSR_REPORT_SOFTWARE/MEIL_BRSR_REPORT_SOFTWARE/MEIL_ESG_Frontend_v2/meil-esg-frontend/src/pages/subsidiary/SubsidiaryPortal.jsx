import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, ClipboardCheck, AlertTriangle, ShieldCheck,
  CheckCircle2, ArrowRight, Eye, RefreshCw, Filter, Layers, Activity,
  FileCheck, ShieldAlert, Check, X, RotateCcw, MapPin, ChevronRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useApp } from '../../store/AppStore';
import { Card, CardHeader, Btn, Badge, StatusBadge, Progress, Modal, PageHeader } from '../../components/ui';
import StatCard from '../../components/StatCard';
import { PRINCIPLES, CURRENT_PERIOD, periodLabel, shortMonth } from '../../data/brsr';

export default function SubsidiaryPortal() {
  const { user, calc, ui, org, actions, toast } = useApp();
  const navigate = useNavigate();

  // Safe fallback definitions if org is still loading from backend
  const safeSubsidiaries = useMemo(() => {
    if (org?.subsidiaries && org.subsidiaries.length > 0) return org.subsidiaries;
    return [
      { id: 'sub-infra', name: 'MEIL Infrastructure & Utilities', code: 'sub-infra', relation: 'parent' },
      { id: 'sub-hydro', name: 'MEIL Hydrocarbons & Energy', code: 'sub-hydro', relation: 'parent' },
      { id: 'sub-power', name: 'MEIL Power & Renewables', code: 'sub-power', relation: 'subsidiary' },
      { id: 'sub-mob', name: 'MEIL Mobility & Manufacturing', code: 'sub-mob', relation: 'subsidiary' },
      { id: 'sub-intl', name: 'MEIL International (Overseas)', code: 'sub-intl', relation: 'jv' },
    ];
  }, [org?.subsidiaries]);

  const safeBus = useMemo(() => {
    if (org?.bus && org.bus.length > 0) return org.bus;
    return [
      { id: 'bu-water', subId: 'sub-infra', name: 'Water & Irrigation Division' },
      { id: 'bu-tunnel', subId: 'sub-infra', name: 'Tunnels & Transit Division' },
      { id: 'bu-road', subId: 'sub-infra', name: 'Roads & Bridges Division' },
      { id: 'bu-refine', subId: 'sub-hydro', name: 'Refinery EPC Unit' },
      { id: 'bu-pipe', subId: 'sub-hydro', name: 'Pipelines & Gas Distribution' },
      { id: 'bu-thermal', subId: 'sub-power', name: 'Thermal & Hydro Power' },
      { id: 'bu-solar', subId: 'sub-power', name: 'Solar & Green Energy' },
      { id: 'bu-ev', subId: 'sub-mob', name: 'EV & Bus Manufacturing' },
      { id: 'bu-ind', subId: 'sub-mob', name: 'Industrial Systems' },
      { id: 'bu-intl', subId: 'sub-intl', name: 'Overseas Infrastructure' },
    ];
  }, [org?.bus]);

  const safeProjects = useMemo(() => {
    return org?.projects && org.projects.length > 0 ? org.projects : [];
  }, [org?.projects]);

  // Active subsidiary selection (default to sub-infra or user's sub)
  const defaultSubId = safeSubsidiaries[0]?.id || 'sub-infra';
  const [selectedSubId, setSelectedSubId] = useState(user?.subId || defaultSubId);
  const [selectedBuFilter, setSelectedBuFilter] = useState('all');

  // Selected submission for inspection or actions
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'bus' | 'analytics'

  // Current subsidiary object
  const currentSub = useMemo(() => {
    return safeSubsidiaries.find((s) => s.id === selectedSubId) || safeSubsidiaries[0] || {
      id: 'sub-infra',
      name: 'MEIL Infrastructure & Utilities',
    };
  }, [safeSubsidiaries, selectedSubId]);

  // BUs belonging to this subsidiary
  const subBus = useMemo(() => {
    return safeBus.filter((b) => b.subId === selectedSubId);
  }, [safeBus, selectedSubId]);

  const subBuIds = useMemo(() => new Set(subBus.map((b) => b.id)), [subBus]);

  // Projects under this subsidiary
  const subProjects = useMemo(() => {
    return safeProjects.filter((p) => p.subId === selectedSubId || subBuIds.has(p.buId));
  }, [safeProjects, selectedSubId, subBuIds]);

  const subProjectIds = useMemo(() => new Set(subProjects.map((p) => p.id)), [subProjects]);

  // All submissions under this subsidiary
  const subSubmissions = useMemo(() => {
    return calc.submissions.filter((s) => subProjectIds.has(s.projectId));
  }, [calc.submissions, subProjectIds]);

  // Queue of submissions that have been verified by BU Managers and are awaiting Subsidiary review
  const subsidiaryQueue = useMemo(() => {
    return subSubmissions.filter((s) => {
      const isStatusOk = s.status === 'bu_verified';
      if (!isStatusOk) return false;
      if (selectedBuFilter !== 'all') {
        const proj = calc.projById.get(s.projectId);
        return proj?.buId === selectedBuFilter;
      }
      return true;
    });
  }, [subSubmissions, selectedBuFilter, calc.projById]);

  // Submissions still pending with BU Managers (submitted by site operators)
  const pendingBuSubmissions = useMemo(() => {
    return subSubmissions.filter((s) => s.status === 'submitted');
  }, [subSubmissions]);

  // Submissions verified by Subsidiary, awaiting final Admin approval
  const forwardedToAdmin = useMemo(() => {
    return subSubmissions.filter((s) => s.status === 'subsidiary_verified');
  }, [subSubmissions]);

  // Final approved & locked submissions
  const approvedSubmissions = useMemo(() => {
    return subSubmissions.filter((s) => s.status === 'approved' || s.status === 'locked');
  }, [subSubmissions]);

  // BU Manager breakdown metrics
  const buManagerStats = useMemo(() => {
    return subBus.map((bu) => {
      const buProjects = safeProjects.filter((p) => p.buId === bu.id);
      const buProjIds = new Set(buProjects.map((p) => p.id));
      const buSubs = calc.submissions.filter((s) => buProjIds.has(s.projectId));

      const pendingBu = buSubs.filter((s) => s.status === 'submitted').length;
      const readyForSub = buSubs.filter((s) => s.status === 'bu_verified').length;
      const verifiedSub = buSubs.filter((s) => s.status === 'subsidiary_verified').length;
      const approved = buSubs.filter((s) => s.status === 'approved' || s.status === 'locked').length;
      const totalSites = buProjects.length;

      // Deterministic demo BU Manager names
      const managerNames = {
        'bu-water': 'Ramesh Gupta',
        'bu-tunnel': 'Vikram Singh',
        'bu-road': 'Amit Patel',
        'bu-refine': 'Dr. K. Srinivas',
        'bu-pipe': 'M. V. Naidu',
        'bu-thermal': 'R. C. Verma',
        'bu-solar': 'Sunita Deshmukh',
        'bu-ev': 'Kiran Reddy',
        'bu-ind': 'P. Venkat',
        'bu-intl': 'Carlos Mendoza',
      };

      const managerName = managerNames[bu.id] || `${bu.name} Lead`;

      return {
        ...bu,
        managerName,
        totalSites,
        pendingBu,
        readyForSub,
        verifiedSub,
        approved,
        totalPackets: buSubs.length,
      };
    });
  }, [subBus, org.projects, calc.submissions]);

  // Live actions for Subsidiary Head / Manager
  const handleVerifySubsidiary = async (sub) => {
    await actions.review({
      id: sub.id,
      decision: 'subsidiary_verify',
      comment: 'Verified by Subsidiary Governance against multi-BU benchmarks. Forwarded to Group Admin for final statutory sign-off.',
      actor: user,
      checklist: {
        crossBuConsistency: true,
        materialityThreshold: true,
        evidenceLineageOk: true,
      },
    });
    setSelectedSubmission(null);
  };

  const handleRequestRevision = async (sub) => {
    if (!revisionNote.trim()) {
      toast('Please enter specific revision notes for the BU Manager.', 'warning');
      return;
    }
    await actions.review({
      id: sub.id,
      decision: 'correction',
      comment: `[Subsidiary Revision Request] ${revisionNote}`,
      actor: user,
    });
    setShowRevisionModal(false);
    setSelectedSubmission(null);
    setRevisionNote('');
  };

  const handleReject = async (sub) => {
    await actions.review({
      id: sub.id,
      decision: 'reject',
      comment: 'Rejected at Subsidiary level for compliance non-conformance.',
      actor: user,
    });
    setSelectedSubmission(null);
  };

  // Multi-BU chart data
  const buChartData = useMemo(() => {
    return buManagerStats.map((b) => ({
      name: b.name.replace(' Division', '').replace(' Unit', ''),
      PendingBU: b.pendingBu,
      ReadyForSub: b.readyForSub,
      ForwardedAdmin: b.verifiedSub,
      Approved: b.approved,
    }));
  }, [buManagerStats]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* TOP BANNER: SUBSIDIARY GOVERNANCE & MULTI-BU OVERSIGHT */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-sky-950 rounded-2xl p-6 sm:p-7 text-white border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold mb-2.5 border border-indigo-400/30">
              <Building2 size={14} />
              Step 3 of 4: Subsidiary Governance (Site Operator → BU Manager → Subsidiary → Group Admin)
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              {currentSub.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
              Multi-Division Governance · Managing <span className="text-indigo-300 font-bold">{subBus.length} Business Units</span> · {subProjects.length} Active Sites · {periodLabel(CURRENT_PERIOD)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Subsidiary Entity Selector */}
            <div className="bg-slate-800/90 border border-slate-700 p-1.5 rounded-xl flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold uppercase pl-2">Subsidiary:</span>
              <select
                value={selectedSubId}
                onChange={(e) => {
                  setSelectedSubId(e.target.value);
                  setSelectedBuFilter('all');
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-bold outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {safeSubsidiaries.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Tabs within Subsidiary Portal */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'queue' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            <ClipboardCheck size={14} />
            Subsidiary Review Queue ({subsidiaryQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('bus')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'bus' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            <Users size={14} />
            Manage BU Managers ({subBus.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            <Activity size={14} />
            Multi-BU Telemetry & Rollup
          </button>

          <button
            onClick={() => actions.refreshData?.()}
            className="ml-auto px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1 font-bold text-xs"
            title="Refresh Live Data"
          >
            <RefreshCw size={12} /> Live Sync
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* REAL-TIME KPI STAT CARDS */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Active BUs"
          value={subBus.length}
          unit="Divisions Managed"
          icon={Building2}
          color="indigo"
        />
        <StatCard
          title="Pending with BU"
          value={pendingBuSubmissions.length}
          unit="Under BU Review"
          icon={Users}
          color="amber"
        />
        <StatCard
          title="Ready for Subsidiary"
          value={subsidiaryQueue.length}
          unit="Awaiting Your Review"
          icon={ClipboardCheck}
          color="sky"
        />
        <StatCard
          title="Forwarded to Admin"
          value={forwardedToAdmin.length}
          unit="Pending Final Lock"
          icon={FileCheck}
          color="violet"
        />
        <StatCard
          title="Approved & Locked"
          value={approvedSubmissions.length}
          unit="Consolidated SEBI"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: SUBSIDIARY REVIEW QUEUE */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <Card pad={false}>
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                BU-Verified Submissions Awaiting Subsidiary Sign-off
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                These submissions have been verified by their respective BU Managers and require Subsidiary cross-division sign-off before reaching Admin.
              </p>
            </div>

            {/* Division Filter */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={selectedBuFilter}
                onChange={(e) => setSelectedBuFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="all">All Business Units ({subBus.length})</option>
                {subBus.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {subsidiaryQueue.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3 opacity-80" />
              <p className="font-bold text-slate-800 text-sm">Subsidiary Review Queue is Clear</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No submissions are currently pending Subsidiary verification for {currentSub.name}. Submissions committed by site operators must first be verified by their BU Manager.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {subsidiaryQueue.map((sub) => {
                const project = calc.projById.get(sub.projectId);
                const bu = calc.buById.get(project?.buId);
                const pObj = PRINCIPLES.find((p) => p.id === sub.principle);
                const valCount = Object.keys(sub.values || {}).length;

                return (
                  <div key={sub.id} className="p-5 hover:bg-slate-50/70 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {sub.code || sub.id}
                        </span>
                        <StatusBadge status={sub.status} />
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {sub.principle} · {pObj?.label || 'Disclosure'}
                        </span>
                        <span className="text-xs text-slate-500">
                          Period: <b>{periodLabel(sub.period)}</b>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-semibold text-slate-800">
                          <MapPin size={13} className="text-slate-400" />
                          {project?.name || sub.projectId}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span>Division: <b className="text-slate-800">{bu?.name || 'Business Unit'}</b></span>
                        <span className="text-slate-400">·</span>
                        <span>{valCount} Indicators</span>
                      </div>

                      {/* BU Manager Verification Stamp */}
                      <div className="text-[11px] bg-blue-50/70 border border-blue-200/60 rounded-lg p-2 text-blue-900 flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-blue-600 shrink-0" />
                        <span>
                          <b>BU Verification Stamp:</b> {sub.reviewComment || 'Verified against site telemetry by BU Manager.'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1"
                      >
                        <Eye size={13} /> Inspect
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setShowRevisionModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs transition"
                      >
                        Request Revision
                      </button>
                      <button
                        onClick={() => handleVerifySubsidiary(sub)}
                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5"
                      >
                        <Check size={14} /> Verify & Forward to Admin
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
      {/* TAB 2: MANAGE ALL BU MANAGERS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'bus' && (
        <div className="space-y-6">
          <Card pad={false}>
            <CardHeader
              title={`Business Unit Managers under ${currentSub.name}`}
              subtitle="Oversight of BU managers, division compliance rates, and packet flow status"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Division / Business Unit</th>
                    <th className="p-4">BU Manager in Charge</th>
                    <th className="p-4">Active Sites</th>
                    <th className="p-4">Pending with BU</th>
                    <th className="p-4">Ready for Subsidiary</th>
                    <th className="p-4">Forwarded to Admin</th>
                    <th className="p-4">Final Approved</th>
                    <th className="p-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {buManagerStats.map((bu) => (
                    <tr key={bu.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">{bu.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{bu.id}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-[10px]">
                            {bu.managerName[0]}
                          </div>
                          <span>{bu.managerName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <b>{bu.totalSites}</b> Sites
                      </td>
                      <td className="p-4">
                        {bu.pendingBu > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                            {bu.pendingBu} Pending
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="p-4">
                        {bu.readyForSub > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                            {bu.readyForSub} In Queue
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-indigo-600 font-bold">{bu.verifiedSub}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-emerald-600 font-bold">{bu.approved}</span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedBuFilter(bu.id);
                            setActiveTab('queue');
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                        >
                          View Queue
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* BU Manager Flow Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                Delegated Verification Authority
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                BU Managers verify all operational telemetry, utility bills, and fuel records at the division level. They cannot directly lock or publish statutory figures to SEBI BRSR without Subsidiary and Admin sign-off.
              </p>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-sky-600" />
                Subsidiary Materiality Guard
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                As the Subsidiary Entity, you check consistency across all divisions (e.g. diesel burn rates per kilometer, concrete batching emissions) before batch forwarding to Group Admin.
              </p>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Building2 size={16} className="text-emerald-600" />
                Statutory Entity Consolidation
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Once Group Admin gives final sign-off to Subsidiary-verified packets, they are cryptographically locked and ingested into the official consolidated BRSR report.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: MULTI-BU TELEMETRY & ROLLUP */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card pad={false}>
            <CardHeader
              title="Multi-Division Workflow Status"
              subtitle="Comparison of packet statuses across subsidiary business units"
            />
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="PendingBU" name="Pending BU" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="ReadyForSub" name="Ready for Subsidiary" fill="#0284c7" stackId="a" />
                  <Bar dataKey="ForwardedAdmin" name="Forwarded to Admin" fill="#6366f1" stackId="a" />
                  <Bar dataKey="Approved" name="Approved & Locked" fill="#10b981" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card pad={false}>
            <CardHeader
              title="Subsidiary Historical Rollup Trend"
              subtitle="Scope 1 & Scope 2 monthly emission trajectory for this entity"
            />
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { month: 'Oct', scope1: 340, scope2: 210 },
                    { month: 'Nov', scope1: 360, scope2: 215 },
                    { month: 'Dec', scope1: 380, scope2: 220 },
                    { month: 'Jan', scope1: 350, scope2: 212 },
                    { month: 'Feb', scope1: 390, scope2: 230 },
                    { month: 'Mar', scope1: 410, scope2: 245 },
                    { month: 'Apr', scope1: 380, scope2: 228 },
                    { month: 'May', scope1: 405, scope2: 240 },
                    { month: 'Jun', scope1: 420, scope2: 250 },
                    { month: 'Jul', scope1: 415, scope2: 248 },
                    { month: 'Aug', scope1: 440, scope2: 260 },
                    { month: 'Sep', scope1: 490, scope2: 285 },
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="scope1" name="Scope 1 (tCO2e)" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="scope2" name="Scope 2 (tCO2e)" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: SUBMISSION INSPECTION */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedSubmission && !showRevisionModal && (
        <Modal
          title={`Subsidiary Inspection: ${selectedSubmission.code || selectedSubmission.id}`}
          subtitle={`${calc.projById.get(selectedSubmission.projectId)?.name} · ${selectedSubmission.principle} · ${periodLabel(selectedSubmission.period)}`}
          onClose={() => setSelectedSubmission(null)}
          wide
        >
          <div className="space-y-5 text-xs">
            {/* Top overview chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Status</span>
                <StatusBadge status={selectedSubmission.status} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Division</span>
                <span className="font-bold text-slate-800">
                  {calc.buById.get(calc.projById.get(selectedSubmission.projectId)?.buId)?.name || 'BU'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Project Site</span>
                <span className="font-bold text-slate-800">
                  {calc.projById.get(selectedSubmission.projectId)?.name || selectedSubmission.projectId}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Period</span>
                <span className="font-bold text-slate-800">{periodLabel(selectedSubmission.period)}</span>
              </div>
            </div>

            {/* BU Manager Verification Stamp */}
            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200">
              <span className="text-[10px] text-blue-600 block uppercase font-bold mb-1">BU Manager Verification Stamp</span>
              <p className="text-blue-900 font-medium">
                {selectedSubmission.reviewComment || 'Verified by BU Manager against site telemetry and delivery logs.'}
              </p>
            </div>

            {/* Indicator values breakdown */}
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Reported Metric Values</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Indicator Code</th>
                      <th className="p-2.5">Reported Value</th>
                      <th className="p-2.5">Evidence Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(selectedSubmission.values || {}).map(([key, val]) => (
                      <tr key={key}>
                        <td className="p-2.5 font-mono font-bold text-slate-800">{key}</td>
                        <td className="p-2.5 font-bold text-indigo-700">{val?.v ?? '—'}</td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <Btn tone="ghost" onClick={() => setSelectedSubmission(null)}>Close</Btn>
              <Btn tone="warning" onClick={() => setShowRevisionModal(true)}>Request Revision from BU</Btn>
              <Btn tone="danger" onClick={() => handleReject(selectedSubmission)}>Reject</Btn>
              <Btn tone="primary" onClick={() => handleVerifySubsidiary(selectedSubmission)}>
                Verify & Forward to Admin
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: REQUEST REVISION */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showRevisionModal && selectedSubmission && (
        <Modal
          title={`Request Revision for ${selectedSubmission.code || selectedSubmission.id}`}
          subtitle="Instructions will be transmitted back to the BU Manager and Site Operator"
          onClose={() => setShowRevisionModal(false)}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Specify the discrepancy observed across business units (e.g. abnormal consumption vs divisional benchmark).
            </p>
            <textarea
              rows={4}
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              placeholder="e.g. Scope 1 diesel spike is 3.5x higher than neighboring tunnel packages. Please re-verify dispensing log."
              className="w-full border border-slate-300 rounded-xl p-3 outline-none text-slate-800"
            />
            <div className="flex justify-end gap-2">
              <Btn tone="ghost" onClick={() => setShowRevisionModal(false)}>Cancel</Btn>
              <Btn tone="danger" onClick={() => handleRequestRevision(selectedSubmission)}>
                Submit Revision Request
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

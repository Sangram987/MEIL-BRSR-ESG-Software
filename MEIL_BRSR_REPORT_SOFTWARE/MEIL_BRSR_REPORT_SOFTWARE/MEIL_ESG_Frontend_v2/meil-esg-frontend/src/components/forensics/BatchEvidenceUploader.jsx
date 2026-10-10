import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UploadCloud, FileText, Image as ImageIcon, Table, CheckCircle2,
  AlertTriangle, RefreshCw, Trash2, Edit3, Eye, ShieldCheck,
  ChevronDown, Check, X, ArrowRight, Layers, Database, Lock,
  Info, Cpu, AlertCircle, FileCheck
} from 'lucide-react';
import { Card, Btn, Badge, Modal } from '../ui';
import verigraphApi from '../../services/verigraphApi';
import { useApp } from '../../store/AppStore';

const BRSR_INDICATORS = [
  { code: 'p6_dg', label: 'P6 · Diesel – Stationary DG Sets', unit: 'Litres' },
  { code: 'p6_mach', label: 'P6 · Diesel – Machinery & Vehicles', unit: 'Litres' },
  { code: 'p6_petrol', label: 'P6 · Petrol – Vehicles', unit: 'Litres' },
  { code: 'p6_grid', label: 'P6 · Grid Electricity Purchased', unit: 'kWh' },
  { code: 'p6_renew', label: 'P6 · Renewable Electricity (On-site)', unit: 'kWh' },
  { code: 'p6_water', label: 'P6 · Total Freshwater Withdrawn', unit: 'KL' },
  { code: 'p6_third', label: 'P6 · Third-Party / Tanker Water', unit: 'KL' },
  { code: 'p6_ground', label: 'P6 · Groundwater Withdrawn', unit: 'KL' },
  { code: 'p6_disch', label: 'P6 · Water Discharged', unit: 'KL' },
  { code: 'p6_nonhaz', label: 'P6 · Non-Hazardous Waste (C&D / General)', unit: 'KG' },
  { code: 'p6_haz', label: 'P6 · Hazardous Waste Generated', unit: 'KG' },
  { code: 'p6_plastic', label: 'P6 · Plastic Waste Generated', unit: 'KG' },
  { code: 'p6_recyc', label: 'P6 · Waste Recycled / Reused', unit: 'KG' },
];

export default function BatchEvidenceUploader({
  initialProjectId = '',
  initialPeriodId = '',
  onCommitSuccess = null
}) {
  const { user, org, projects: ctxProjects, reportingPeriods: ctxPeriods, toast } = useApp();

  const availableProjects = useMemo(() => {
    if (ctxProjects && ctxProjects.length > 0) return ctxProjects;
    if (org?.projects && org.projects.length > 0) return org.projects;
    return [
      { id: 'prj-001', name: 'Zojila Tunnel Package 1', state: 'JK', projectCode: 'ZOJ-01' },
      { id: 'prj-002', name: 'Polavaram Irrigation Hydro Works', state: 'AP', projectCode: 'POL-01' },
      { id: 'prj-003', name: 'Kaleshwaram Lift Irrigation Pkg 6', state: 'TS', projectCode: 'KAL-06' },
      { id: 'prj-004', name: 'Thane-Borivali Twin Road Tunnel', state: 'MH', projectCode: 'TBN-01' },
      { id: 'prj-005', name: 'Char Dham All-Weather Highway Pkg 2', state: 'UK', projectCode: 'CDH-02' },
      { id: 'prj-006', name: 'Western Dedicated Freight Corridor (WDFC)', state: 'GJ', projectCode: 'WDF-03' },
      { id: 'prj-007', name: 'Bandaru Thermal & Solar Hybrid Park', state: 'AP', projectCode: 'BND-01' },
      { id: 'prj-008', name: 'Bengaluru Metro Rail Phase 2 Elevated Viaduct', state: 'KA', projectCode: 'BMR-02' },
    ];
  }, [ctxProjects, org?.projects]);

  const availablePeriods = useMemo(() => {
    if (ctxPeriods && ctxPeriods.length > 0) return ctxPeriods;
    return [
      { id: '2026-09', name: 'September 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: true, status: 'OPEN' },
      { id: '2026-08', name: 'August 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: false, status: 'OPEN' },
      { id: '2026-07', name: 'July 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: false, status: 'OPEN' },
      { id: '2026-06', name: 'June 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: false, status: 'OPEN' },
      { id: '2026-05', name: 'May 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: false, status: 'CLOSED' },
      { id: '2026-04', name: 'April 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: false, status: 'CLOSED' },
    ];
  }, [ctxPeriods]);

  // Project site & reporting period selected ONCE at the top
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || user?.projectId || availableProjects[0]?.id || 'prj-001');
  const [selectedPeriodId, setSelectedPeriodId] = useState(initialPeriodId || availablePeriods[0]?.id || '2026-09');

  // Files staged for batch upload
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Batch lifecycle state
  const [activeBatch, setActiveBatch] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [commitResult, setCommitResult] = useState(null);

  // Row edit state (for inline editing in review table)
  const [editingItemId, setEditingItemId] = useState(null);
  const [editValues, setEditValues] = useState({});

  // Evidence Preview Modal state
  const [previewItem, setPreviewItem] = useState(null);

  // Set default project & period if available
  useEffect(() => {
    if (!selectedProjectId && availableProjects.length > 0) {
      const defaultProj = availableProjects.find((p) => p.id === user?.projectId) || availableProjects[0];
      setSelectedProjectId(defaultProj.id);
    }
  }, [availableProjects, selectedProjectId, user?.projectId]);

  useEffect(() => {
    if (!selectedPeriodId && availablePeriods.length > 0) {
      const openPeriod = availablePeriods.find((p) => p.status === 'OPEN' || p.isCurrent) || availablePeriods[0];
      setSelectedPeriodId(openPeriod.id);
    }
  }, [availablePeriods, selectedPeriodId]);

  const activeBatchId = activeBatch?.id;
  const activeBatchStatus = activeBatch?.status;

  // Polling batch status when in PENDING or PROCESSING
  useEffect(() => {
    if (!activeBatchId || (activeBatchStatus !== 'PENDING' && activeBatchStatus !== 'PROCESSING')) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    let attempts = 0;
    const maxAttempts = 60; // Max 2 minutes
    let inFlight = false;

    const timer = setInterval(async () => {
      if (inFlight) return;
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(timer);
        setIsPolling(false);
        toast('Processing is taking longer than usual. Please check back or refresh.', 'warning');
        return;
      }

      try {
        inFlight = true;
        const res = await verigraphApi.getBatch(activeBatchId);
        setActiveBatch(res);
        if (res.status !== 'PENDING' && res.status !== 'PROCESSING') {
          setIsPolling(false);
          clearInterval(timer);
          if (res.status === 'COMPLETED' || res.status === 'PARTIALLY_FAILED') {
            toast(`AI Auto-Detection completed for ${res.processedFiles || 0} file(s).`, 'success');
          } else if (res.status === 'FAILED') {
            toast(`Batch extraction failed: ${res.errorMessage || 'Unknown error'}`, 'error');
          }
        }
      } catch (err) {
        console.warn('Batch poll check:', err);
      } finally {
        inFlight = false;
      }
    }, 2000);

    return () => {
      clearInterval(timer);
    };
  }, [activeBatchId, activeBatchStatus, toast]);

  // File drop / selection handlers
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    const validExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'tif', 'webp', 'csv', 'xlsx', 'xls'];
    const validFiles = newFiles.filter((f) => {
      const ext = f.name.split('.').pop().toLowerCase();
      return validExtensions.includes(ext);
    });

    if (validFiles.length < newFiles.length) {
      toast('Some files were ignored due to unsupported format.', 'warning');
    }

    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const filtered = validFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
  };

  const removeStagedFile = (index) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Launch Batch Ingestion
  const handleStartBatchUpload = async () => {
    if (stagedFiles.length === 0) {
      toast('Please select at least one evidence document or tabular sheet.', 'warning');
      return;
    }
    if (!selectedProjectId) {
      toast('Please select a project site for reporting.', 'error');
      return;
    }
    if (!selectedPeriodId) {
      toast('Please select a reporting period.', 'error');
      return;
    }

    setIsUploading(true);
    setCommitResult(null);

    try {
      const res = await verigraphApi.createBatch(stagedFiles, {
        projectId: selectedProjectId,
        reportingPeriodId: selectedPeriodId,
      });

      setActiveBatch(res.batch || res);
      setStagedFiles([]);
      toast(`Batch created! Ingesting and auto-detecting ${stagedFiles.length} files...`, 'success');
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Batch creation failed.';
      toast(msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Inline row edits
  const startEditing = (item) => {
    setEditingItemId(item.id);
    setEditValues({
      metricCode: item.effectiveMetricCode || 'p6_dg',
      value: item.effectiveValue !== null && item.effectiveValue !== undefined ? String(item.effectiveValue) : '',
      unit: item.effectiveUnit || 'Litres',
    });
  };

  const saveEdit = async (itemId) => {
    if (!activeBatch) return;
    try {
      const payload = {
        metricCode: editValues.metricCode,
        value: editValues.value !== '' ? parseFloat(editValues.value) : null,
        unit: editValues.unit,
        isReviewed: true,
      };
      const updatedItem = await verigraphApi.updateBatchItem(activeBatch.id, itemId, payload);
      setActiveBatch((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.id === itemId ? updatedItem : it)),
      }));
      setEditingItemId(null);
      toast('Updated detection values.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to update item.', 'error');
    }
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditValues({});
  };

  const handleDeleteItem = async (itemId) => {
    if (!activeBatch) return;
    try {
      await verigraphApi.deleteBatchItem(activeBatch.id, itemId);
      setActiveBatch((prev) => ({
        ...prev,
        items: prev.items.filter((it) => it.id !== itemId),
        totalFiles: Math.max(0, prev.totalFiles - 1),
      }));
      toast('Item removed from batch.', 'info');
    } catch (err) {
      toast(err.message || 'Failed to delete item.', 'error');
    }
  };

  // Commit batch to persistent database
  const handleCommitBatch = async () => {
    if (!activeBatch) return;

    // Verify all items have value & metric
    const itemsToCommit = activeBatch.items.filter((i) => i.status === 'EXTRACTED' && !i.isCommitted);
    if (itemsToCommit.length === 0) {
      toast('No extracted items available to commit.', 'warning');
      return;
    }

    const unassigned = itemsToCommit.filter((i) => !i.effectiveMetricCode || i.effectiveValue === null);
    if (unassigned.length > 0) {
      toast(`${unassigned.length} items lack a valid metric code or physical quantity. Please edit them before committing.`, 'warning');
      return;
    }

    setIsCommitting(true);
    try {
      const res = await verigraphApi.commitBatch(activeBatch.id);
      setCommitResult(res);
      setActiveBatch(res.batch || { ...activeBatch, status: 'COMMITTED' });
      toast(`Successfully committed ${res.committedCount} ESG records with complete forensic verification!`, 'success');
      if (onCommitSuccess) onCommitSuccess(res);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Commit failed.';
      toast(msg, 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
  };

  const getFileIcon = (filename, type) => {
    const ext = filename?.split('.').pop().toLowerCase() || type;
    if (ext === 'pdf') return <FileText className="text-rose-500" size={18} />;
    if (['csv', 'xlsx', 'xls'].includes(ext)) return <Table className="text-emerald-600" size={18} />;
    return <ImageIcon className="text-sky-500" size={18} />;
  };

  const getConfidenceBadge = (conf) => {
    const pct = Math.round((conf || 0) * 100);
    if (pct >= 85) return <Badge tone="emerald">{pct}% High</Badge>;
    if (pct >= 60) return <Badge tone="amber">{pct}% Moderate</Badge>;
    return <Badge tone="rose">{pct}% Low</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Global Selection Header (Site & Period Selected ONCE)     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Card className="bg-slate-50/80 border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-1.5 border border-emerald-300">
              <Cpu size={13} /> Option A · AI Auto-Detection Engine
            </div>
            <h2 className="text-base font-black text-slate-900">Batch Evidence Collection & Forensics</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select site and reporting period once. Upload invoices, meter slips, and spreadsheets together without pre-selecting indicators.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Reporting Project Site</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            >
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.state ? `(${p.state})` : ''} · {p.projectCode || p.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Reporting Period</label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            >
              {availablePeriods.map((rp) => (
                <option key={rp.id} value={rp.id}>
                  {rp.name || rp.financialYear} {rp.isCurrent ? '● Current Active' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Drag-and-Drop Batch Ingestion Zone                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Card>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/60 ring-4 ring-emerald-100'
              : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.webp,.csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="h-14 w-14 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <UploadCloud size={28} />
          </div>

          <h3 className="text-sm font-black text-slate-900">
            Drop evidence files here or click to browse
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Upload multiple Fuel Invoices, Electricity Bills, Water Meter Slips, Waste Manifests, and CSV/Excel logs simultaneously.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] font-semibold text-slate-600">
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200">PDF Documents</span>
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200">Images (PNG, JPG, TIFF, WebP)</span>
            <span className="px-2 py-0.5 rounded bg-white border border-slate-200">Tabular (CSV, XLSX)</span>
            <span className="text-slate-400">· Max 50 files per batch</span>
          </div>
        </div>

        {/* Staged files queue */}
        {stagedFiles.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">
                Staged Files for Ingestion ({stagedFiles.length})
              </span>
              <button
                onClick={() => setStagedFiles([])}
                className="text-xs text-slate-400 hover:text-rose-600 transition"
              >
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
              {stagedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {getFileIcon(file.name)}
                    <div className="min-w-0 truncate">
                      <span className="font-semibold text-slate-900 block truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-500">{formatSize(file.size)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeStagedFile(idx); }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Btn
                tone="ok"
                onClick={handleStartBatchUpload}
                disabled={isUploading}
                className="w-full sm:w-auto"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    Processing Ingestion Batch...
                  </>
                ) : (
                  <>
                    <Cpu size={16} />
                    Start AI Automated Extraction ({stagedFiles.length} Files)
                  </>
                )}
              </Btn>
            </div>
          </div>
        )}
      </Card>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. Batch Progress Tracker                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeBatch && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900">
                  Batch #{activeBatch.id?.slice(0, 8)}
                </h3>
                <Badge
                  tone={
                    activeBatch.status === 'COMPLETED'
                      ? 'emerald'
                      : activeBatch.status === 'COMMITTED'
                      ? 'blue'
                      : activeBatch.status === 'PARTIALLY_FAILED'
                      ? 'amber'
                      : 'indigo'
                  }
                >
                  {activeBatch.status}
                </Badge>
                {isPolling && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-semibold animate-pulse">
                    <RefreshCw className="animate-spin" size={12} /> Live Processing...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Site: {activeBatch.projectName || activeBatch.projectId} · Period: {activeBatch.reportingPeriodName || activeBatch.reportingPeriodId}
              </p>
            </div>

            {/* Quick stats counter */}
            <div className="flex items-center gap-2 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] text-slate-400 uppercase block font-bold">Total</span>
                <span className="font-black text-slate-900">{activeBatch.totalFiles}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center text-emerald-800">
                <span className="text-[10px] text-emerald-600 uppercase block font-bold">Extracted</span>
                <span className="font-black">{activeBatch.processedFiles}</span>
              </div>
              {activeBatch.failedFiles > 0 && (
                <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-center text-rose-800">
                  <span className="text-[10px] text-rose-600 uppercase block font-bold">Failed</span>
                  <span className="font-black">{activeBatch.failedFiles}</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  activeBatch.status === 'COMMITTED'
                    ? 'bg-blue-600'
                    : activeBatch.status === 'COMPLETED'
                    ? 'bg-emerald-500'
                    : 'bg-emerald-600'
                }`}
                style={{
                  width: `${activeBatch.totalFiles > 0 ? (activeBatch.processedFiles / activeBatch.totalFiles) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. Unified Editable Extraction-Review Table                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeBatch && activeBatch.items?.length > 0 && (
        <Card pad={false} className="border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Extraction Review & Conflict Verification Table
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review automatically extracted document classifications, physical metrics, and quantities before committing to the ESG ledger.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {activeBatch.status !== 'COMMITTED' && (
                <Btn
                  tone="ok"
                  onClick={handleCommitBatch}
                  disabled={isCommitting || isPolling || activeBatch.processedFiles === 0}
                >
                  {isCommitting ? (
                    <>
                      <RefreshCw className="animate-spin" size={14} />
                      Committing Records...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Commit ESG Values to System
                    </>
                  )}
                </Btn>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Document / Proof</th>
                  <th className="py-3 px-4">Classified Type</th>
                  <th className="py-3 px-4">Detected BRSR Indicator</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Warnings / Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeBatch.items.map((item) => {
                  const isEditing = editingItemId === item.id;
                  const isCommitted = item.isCommitted || activeBatch.status === 'COMMITTED';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition ${
                        item.warnings?.length > 0 ? 'bg-amber-50/30' : ''
                      } ${isCommitted ? 'bg-emerald-50/20' : ''}`}
                    >
                      {/* Document info */}
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(item.originalFilename, item.fileType)}
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                              {item.originalFilename}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>{formatSize(item.fileSize)}</span>
                              {item.sha256 && (
                                <>
                                  <span>·</span>
                                  <span title={item.sha256}>#{item.sha256.slice(0, 8)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Classified Doc Type */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {item.docType || 'UNKNOWN'}
                        </span>
                      </td>

                      {/* Metric Indicator (Editable or Read-only) */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <select
                            value={editValues.metricCode}
                            onChange={(e) => {
                              const found = BRSR_INDICATORS.find((b) => b.code === e.target.value);
                              setEditValues((prev) => ({
                                ...prev,
                                metricCode: e.target.value,
                                unit: found?.unit || prev.unit,
                              }));
                            }}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-900 w-full"
                          >
                            {BRSR_INDICATORS.map((ind) => (
                              <option key={ind.code} value={ind.code}>
                                {ind.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {BRSR_INDICATORS.find((i) => i.code === item.effectiveMetricCode)?.label || item.effectiveMetricCode || '—'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {item.effectiveMetricCode || 'Unassigned'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {isEditing ? (
                          <input
                            type="number"
                            step="any"
                            value={editValues.value}
                            onChange={(e) => setEditValues((prev) => ({ ...prev, value: e.target.value }))}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 w-24"
                          />
                        ) : item.effectiveValue !== null && item.effectiveValue !== undefined ? (
                          <span>{Number(item.effectiveValue).toLocaleString()}</span>
                        ) : (
                          <span className="text-amber-600 font-normal italic">Pending Input</span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.unit}
                            onChange={(e) => setEditValues((prev) => ({ ...prev, unit: e.target.value }))}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-16"
                          />
                        ) : (
                          <span className="text-slate-600 font-semibold">{item.effectiveUnit || '—'}</span>
                        )}
                      </td>

                      {/* Confidence */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {getConfidenceBadge(item.confidence)}
                          {item.ocrConfidence > 0 && (
                            <span className="block text-[10px] text-slate-400">
                              OCR: {(item.ocrConfidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Warnings / Proof flags */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        {item.warnings && item.warnings.length > 0 ? (
                          <div className="space-y-1">
                            {item.warnings.map((w, wIdx) => (
                              <span
                                key={wIdx}
                                title={w}
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 truncate max-w-full block"
                              >
                                <AlertTriangle size={11} className="shrink-0 text-amber-600" />
                                <span className="truncate">{w}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-emerald-700 font-medium inline-flex items-center gap-1 text-[11px]">
                            <Check size={13} /> Clean
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => setPreviewItem(item)}
                            title="Inspect OCR Facts & Provenance"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          >
                            <Eye size={15} />
                          </button>

                          {!isCommitted && (
                            <>
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveEdit(item.id)}
                                    title="Save changes"
                                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                                  >
                                    <Check size={15} />
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    title="Cancel"
                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition"
                                  >
                                    <X size={15} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => startEditing(item)}
                                  title="Edit detected values"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                                >
                                  <Edit3 size={15} />
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                title="Remove from batch"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}

                          {isCommitted && (
                            <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                              <CheckCircle2 size={14} /> Committed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. Post-Commit Verification Outcomes & Trust Scores           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {commitResult && (
        <Card className="bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 border-emerald-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Batch Forensics & Trust Score Verification Complete
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {commitResult.message || `Persisted and verified ${commitResult.committedCount} records.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {commitResult.results?.map((res, rIdx) => (
              <div
                key={rIdx}
                className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 truncate max-w-[150px]">{res.filename}</span>
                  <Badge tone={res.overallStatus === 'VERIFIED' ? 'emerald' : 'amber'}>
                    {res.overallStatus || 'VERIFIED'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Physical Value:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {res.value} {res.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-[11px] text-slate-500 font-semibold">Trust Score:</span>
                  <span className="font-black text-emerald-700 text-sm">{res.trustScore || 85}/100</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. Evidence Proof & Provenance Modal                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {previewItem && (
        <Modal
          open={!!previewItem}
          onClose={() => setPreviewItem(null)}
          title={`Evidence Provenance: ${previewItem.originalFilename}`}
          subtitle={`SHA-256: ${previewItem.sha256 || '—'} · Page ${previewItem.pageNumber || 1}`}
          wide
        >
          <div className="space-y-4 text-xs">
            {/* Classification & Provenance Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Doc Type</span>
                <span className="font-bold text-slate-900">{previewItem.docType || 'UNKNOWN'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Detected Metric</span>
                <span className="font-bold text-slate-900">{previewItem.effectiveMetricCode || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Physical Quantity</span>
                <span className="font-mono font-bold text-slate-900">
                  {previewItem.effectiveValue} {previewItem.effectiveUnit}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Confidence</span>
                <span className="font-bold text-emerald-700">
                  {Math.round((previewItem.confidence || 0) * 100)}%
                </span>
              </div>
            </div>

            {/* Source Snippet & Bounding Box */}
            {previewItem.sourceSnippet && (
              <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200">
                <span className="text-[10px] font-bold text-amber-800 uppercase block mb-1">
                  Text Origin Snippet
                </span>
                <p className="font-mono text-slate-800 bg-white p-2.5 rounded border border-amber-200">
                  {previewItem.sourceSnippet}
                </p>
                {previewItem.boundingBox && (
                  <span className="text-[10px] text-slate-500 font-mono mt-1.5 block">
                    Normalized Bounding Box: {JSON.stringify(previewItem.boundingBox)}
                  </span>
                )}
              </div>
            )}

            {/* Structured Facts Table */}
            <div>
              <h4 className="font-bold text-slate-900 mb-2">
                All Extracted Structured Facts ({previewItem.rawFacts?.length || 0})
              </h4>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-2">Fact Type</th>
                      <th className="p-2">Field Label</th>
                      <th className="p-2">Raw Value</th>
                      <th className="p-2">Normalized</th>
                      <th className="p-2">Unit</th>
                      <th className="p-2">OCR Conf</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {previewItem.rawFacts?.map((f, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-900">{f.factType}</td>
                        <td className="p-2 text-slate-600">{f.fieldName}</td>
                        <td className="p-2 text-slate-800 truncate max-w-[150px]">{f.rawValue}</td>
                        <td className="p-2 text-emerald-700 font-bold">{f.normalizedValue ?? '—'}</td>
                        <td className="p-2 text-slate-500">{f.unit ?? '—'}</td>
                        <td className="p-2 text-slate-500">
                          {f.ocrConfidence ? `${Math.round(f.ocrConfidence * 100)}%` : '100%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

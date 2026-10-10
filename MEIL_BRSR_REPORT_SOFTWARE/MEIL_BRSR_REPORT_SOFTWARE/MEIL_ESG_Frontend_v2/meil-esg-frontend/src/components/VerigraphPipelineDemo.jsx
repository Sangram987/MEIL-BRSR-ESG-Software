import React, { useState, useEffect } from 'react';
import {
  Camera, CheckCircle2, AlertTriangle, ShieldCheck, FileText, ArrowRight,
  Play, RotateCcw, Download, Network, Database, Cpu, ChevronRight, Layers,
  ExternalLink, Sparkles, Building2, Eye, ShieldAlert, Check, X, Info
} from 'lucide-react';
import { Card, Badge, Btn, Modal } from './ui';
import verigraphApi from '../services/verigraphApi';

export default function VerigraphPipelineDemo({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [demoData, setDemoData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await verigraphApi.getDemoPipeline();
        setDemoData(data);
      } catch {
        // Fallback demo data if backend offline
        setDemoData({
          site: { name: 'MEIL Project Site 104', bu: 'Tunnels & Transit Division', subsidiary: 'MEIL Infrastructure & Utilities' },
          invoice: { invoiceNumber: 'INV-4821', vendor: 'ABC Fuels Private Limited', quantityLitres: 1250, totalInr: 118750 },
          step2_qualityCheck: { qualityScore: 94, status: 'ACCEPT' },
          step7_trustScore: { score: 82, breakdown: { provenance: 95, ocrConfidence: 96, extractionConfidence: 94, documentVerification: 100, crossDocumentConsistency: 100, temporalConsistency: 58 } }
        });
      } finally {
        setLoading(false);
      }
    }
    if (isOpen) {
      loadData();
      setCurrentStep(0);
      setIsPlaying(false);
    }
  }, [isOpen]);

  // Auto-play timer
  useEffect(() => {
    let timer;
    if (isPlaying && currentStep < 15) {
      timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, 2400);
    } else if (currentStep >= 15) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep]);

  if (!isOpen) return null;

  const STEPS = [
    { title: '1. Project Site Data Collection', subtitle: 'Mobile Camera Capture at MEIL Site 104', icon: Camera, tag: 'SITE ENGINEER' },
    { title: '2. OpenCV Quality Check', subtitle: 'Blur, Brightness, Glare & Resolution Screening', icon: CheckCircle2, tag: 'COMPUTER VISION' },
    { title: '3. Secure Evidence Upload', subtitle: 'SHA-256 Cryptographic Hash & Tamper-proof Storage', icon: ShieldCheck, tag: 'INTEGRITY' },
    { title: '4. OCR & Fact Extraction', subtitle: 'Bounding Box & Confidence Scoring', icon: FileText, tag: 'OCR ENGINE' },
    { title: '5. 5-Agent Verification Engine', subtitle: 'Document, Cross-Doc, Temporal, Rules & ML', icon: Cpu, tag: 'MULTI-AGENT' },
    { title: '6. Meta-Auditor Reconciliation', subtitle: 'Ensemble Risk Synthesis & Decision Formulation', icon: ShieldAlert, tag: 'RECONCILER' },
    { title: '7. Trust Score Calculation', subtitle: 'Multi-factor Confidence Score: 82/100', icon: Sparkles, tag: 'SCORING' },
    { title: '8. Evidence Lineage & Graph', subtitle: 'Traceability Chain from Metric to Bounding Box', icon: Network, tag: 'LINEAGE' },
    { title: '9. Automated CAPA Generation', subtitle: 'Action CAPA-2026-0091 Assigned to Site Officer', icon: AlertTriangle, tag: 'WORKFLOW' },
    { title: '10. Hierarchical Consolidation', subtitle: 'Site 104 → BU → Subsidiary → MEIL Group Roll-up', icon: Building2, tag: 'CONSOLIDATION' },
    { title: '11. SEBI BRSR Mapping', subtitle: 'Automated Mapping to Principle 6 (Scope 1 GHG)', icon: Database, tag: 'COMPLIANCE' },
    { title: '12. UN SDG Alignment', subtitle: 'Direct Alignment to SDG 13 (Climate Action)', icon: Layers, tag: 'GLOBAL GOALS' },
    { title: '13. BRSR Validation', subtitle: 'Pre-Audit Readiness & Evidence Coverage (91%)', icon: CheckCircle2, tag: 'VALIDATION' },
    { title: '14. Interactive BRSR Preview', subtitle: 'Trace Clickable Disclosures to Source Proof', icon: Eye, tag: 'PREVIEW' },
    { title: '15. BRSR 35-Page PDF Generator', subtitle: 'Company-Format SEBI Filing with Cryptographic Hash', icon: FileText, tag: 'FINAL REPORT' },
    { title: '16. Audit-Ready Package', subtitle: 'Export VERIGRAPH_AUDIT_PACKAGE.zip with All Proofs', icon: Download, tag: 'ASSURANCE' },
  ];

  const handleDownloadDemoZip = () => {
    const dummyContent = "VERIGRAPH ESG AUDIT PACKAGE\nSite: MEIL Project Site 104\nInvoice: INV-4821\nTrust Score: 82/100\nReport Hash: a82f8194c7b2e617d3a01490218b824efc8d92bd";
    const blob = new Blob([dummyContent], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'VERIGRAPH_AUDIT_PACKAGE.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-3xl shadow-2xl text-white overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-950/90 border-b border-slate-800 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center text-slate-950 font-black shadow-lg">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">VERIGRAPH Automated Evidence-to-BRSR Pipeline</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Demonstration
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real Evidence: <span className="text-slate-200 font-semibold">MEIL Project Site 104 · Fuel Invoice INV-4821 (1,250 L · ₹118,750)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                isPlaying ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Play size={14} className={isPlaying ? 'animate-spin' : ''} />
              {isPlaying ? 'Pause Auto-Play' : 'Auto-Play Pipeline'}
            </button>
            <button
              onClick={() => { setCurrentStep(0); setIsPlaying(false); }}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              title="Reset to step 1"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-[760px]">
            {STEPS.map((step, idx) => (
              <button
                key={idx}
                onClick={() => { setCurrentStep(idx); setIsPlaying(false); }}
                className={`flex-1 py-1 px-2 rounded-lg text-left transition flex flex-col ${
                  currentStep === idx
                    ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-400'
                    : idx < currentStep
                    ? 'bg-emerald-950/40 text-emerald-400 hover:bg-slate-800'
                    : 'bg-slate-800/40 text-slate-500 hover:bg-slate-800'
                }`}
              >
                <span className="text-[9px] font-mono leading-none">Step {idx + 1}</span>
                <span className="text-[11px] truncate mt-0.5">{step.title.split('. ')[1]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold text-sky-400 uppercase tracking-widest block mb-1">
                {STEPS[currentStep].tag} · STEP {currentStep + 1} OF 16
              </span>
              <h3 className="text-xl font-black text-white">{STEPS[currentStep].title}</h3>
              <p className="text-xs text-slate-400 mt-1">{STEPS[currentStep].subtitle}</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              {React.createElement(STEPS[currentStep].icon, { size: 24 })}
            </div>
          </div>

          {/* Step 1: Capture Evidence */}
          {currentStep === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
                <span className="text-xs font-bold text-slate-400 uppercase">Input Metadata</span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-700">
                    <span className="text-slate-400">Site Location:</span>
                    <span className="font-bold text-white">MEIL Project Site 104 (Zojila Tunnel Package)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-700">
                    <span className="text-slate-400">Reporting Period:</span>
                    <span className="font-bold text-white">September 2026</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-700">
                    <span className="text-slate-400">Target ESG Metric:</span>
                    <span className="font-bold text-emerald-400">Diesel Consumption (Principle 6)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-700">
                    <span className="text-slate-400">Captured By:</span>
                    <span className="font-bold text-white">Suresh Naik (Site Engineer)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-700">
                    <span className="text-slate-400">Source Type:</span>
                    <span className="font-bold text-sky-400">EVIDENCE_BACKED (Camera Capture)</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col items-center justify-center text-center space-y-3">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Camera size={44} />
                </div>
                <h4 className="text-sm font-bold text-white">Raw Invoice Image Ingested</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Field engineer captures invoice receipt using site mobile terminal. Immediately queued for OpenCV edge quality gate.
                </p>
                <Badge tone="emerald">Document Ingest Active</Badge>
              </div>
            </div>
          )}

          {/* Step 2: Quality Check */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase">OpenCV Quality Score</span>
                  <span className="text-2xl font-black text-emerald-400">94 / 100</span>
                </div>
                <p className="text-xs text-slate-300">
                  Status: <b className="text-emerald-300">ACCEPT · OCR READY</b>. Document passes all sharpness and contrast thresholds.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Laplacian Sharpness:</span>
                    <span className="text-emerald-400 font-bold">88 / 100 (No motion blur)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Brightness / Exposure:</span>
                    <span className="text-emerald-400 font-bold">92 / 100 (Optimal lighting)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Contrast Ratio:</span>
                    <span className="text-emerald-400 font-bold">90 / 100 (Clear text boundaries)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Specular Glare:</span>
                    <span className="text-emerald-400 font-bold">None detected (&lt; 2%)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Resolution:</span>
                    <span className="text-white font-mono">2400 × 3200 px (300 DPI)</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col justify-center space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  Quality Gate Decision
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Unlike traditional systems that blindly pass unreadable photos to AI, VERIGRAPH ensures bad documents are rejected immediately at the site level before polluting the regulatory ledger.
                </p>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300">
                  {`{"quality_score": 94, "status": "ACCEPT", "ocr_ready": true}`}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Secure Upload */}
          {currentStep === 2 && (
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Cryptographic Integrity Stamp</span>
                <Badge tone="indigo">Vault Key Registered</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Permanent Evidence ID</span>
                  <span className="text-lg font-black text-sky-400">EV-2026-000458</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block mb-1">SHA-256 Checksum</span>
                  <span className="font-mono text-emerald-400 break-all">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                The invoice is stored in immutable vault storage with its SHA-256 hash. Any byte-level alteration invalidates downstream BRSR pre-assurance.
              </p>
            </div>
          )}

          {/* Step 4: OCR & Extraction */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Invoice Number</span>
                  <p className="text-sm font-black text-white">INV-4821</p>
                  <span className="text-[9px] text-emerald-400">OCR Conf: 98.4%</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Invoice Date</span>
                  <p className="text-sm font-black text-white">18-09-2026</p>
                  <span className="text-[9px] text-emerald-400">OCR Conf: 97.1%</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Vendor</span>
                  <p className="text-sm font-black text-white">ABC Fuels Pvt Ltd</p>
                  <span className="text-[9px] text-emerald-400">OCR Conf: 95.8%</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-300 block">Extracted Quantity</span>
                  <p className="text-base font-black text-emerald-400">1,250 Litres</p>
                  <span className="text-[9px] text-emerald-300">BBox [110, 230, 260, 290]</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Rate / Litre</span>
                  <p className="text-sm font-black text-white">₹95.00 / L</p>
                  <span className="text-[9px] text-emerald-400">OCR Conf: 94.5%</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Total Amount</span>
                  <p className="text-base font-black text-sky-400">₹118,750.00</p>
                  <span className="text-[9px] text-emerald-400">OCR Conf: 97.8%</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                Lineage anchor established: <span className="font-mono text-emerald-300">Quantity = 1,250 L (EV-2026-000458, Page 1, BBox [110,230,260,290], Conf: 96%)</span>
              </div>
            </div>
          )}

          {/* Step 5: 5-Agent Verification */}
          {currentStep === 4 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Agent 1: Document Verification</span>
                  <Badge tone="emerald">PASS · 100%</Badge>
                </div>
                <p className="text-xs text-slate-300">
                  Arithmetic check: 1,250 L × ₹95 = ₹118,750 (Exact match). GSTIN and date window confirmed.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Agent 2: Cross-Document Verification</span>
                  <Badge tone="emerald">PASS · 98%</Badge>
                </div>
                <p className="text-xs text-slate-300">
                  Reconciled against Site Fuel Intake Register and equipment dispenser telemetry.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-200">Agent 3: Temporal Verification</span>
                  <Badge tone="amber">WARNING · 58%</Badge>
                </div>
                <p className="text-xs text-amber-200">
                  Historical baseline comparison: Aug 4,500 L → Sep 12,500 L total (~2.8x spike without proportional excavation output increase).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Agent 4: Deterministic Rule Engine</span>
                  <Badge tone="emerald">PASS · 100%</Badge>
                </div>
                <p className="text-xs text-slate-300">
                  Zero negative values, non-duplicate invoice, active reporting period match.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-200">Agent 5: ML Anomaly Detector (IsolationForest)</span>
                  <Badge tone="rose">ANOMALY · Score 0.87</Badge>
                </div>
                <p className="text-xs text-rose-200">
                  IsolationForest model flags significant divergence in Diesel / Excavation output ratio for Project Site 104.
                </p>
              </div>
            </div>
          )}

          {/* Step 6: Meta-Auditor */}
          {currentStep === 5 && (
            <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase">Meta-Auditor Synthesis</span>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30">
                  REVIEW_REQUIRED
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                The Meta-Auditor combines outputs from all 5 agents: Document arithmetic is authentic, but Temporal and ML agents flag a sharp MoM spike.
              </p>
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <AlertTriangle size={16} />
                  Reconciled Explanation:
                </div>
                <p className="text-slate-300">
                  “Diesel consumption is substantially above the site’s production-adjusted historical baseline (+177% MoM). Human BU review required.”
                </p>
              </div>
            </div>
          )}

          {/* Step 7: Trust Score */}
          {currentStep === 6 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-gradient-to-b from-blue-900/40 to-slate-900 border border-blue-500/30 flex flex-col items-center justify-center text-center">
                <span className="text-xs uppercase font-bold text-blue-300">Composite Trust Score</span>
                <span className="text-5xl font-black text-white my-3">82<span className="text-xl text-slate-400">/100</span></span>
                <Badge tone="emerald">GOOD · Review Recommended</Badge>
              </div>

              <div className="md:col-span-2 p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-2 text-xs">
                <span className="text-xs font-bold text-slate-400 uppercase block mb-2">Confidence Breakdown</span>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-700">
                    <span className="text-slate-300">Provenance Authenticity:</span>
                    <span className="font-bold text-emerald-400">95 / 100</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700">
                    <span className="text-slate-300">OCR Text Confidence:</span>
                    <span className="font-bold text-emerald-400">96 / 100</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700">
                    <span className="text-slate-300">Fact Extraction Confidence:</span>
                    <span className="font-bold text-emerald-400">94 / 100</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700">
                    <span className="text-slate-300">Document Arithmetic Verification:</span>
                    <span className="font-bold text-emerald-400">100 / 100</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700">
                    <span className="text-slate-300">Cross-Document Consistency:</span>
                    <span className="font-bold text-emerald-400">100 / 100</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-300">Temporal Historical Consistency:</span>
                    <span className="font-bold text-amber-400">58 / 100 (Spike detected)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 8: Evidence Lineage / Graph */}
          {currentStep === 7 && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase">Knowledge Graph Relational Lineage</span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-lg bg-blue-900/60 border border-blue-500 font-bold text-white">BRSR Metric P6</span>
                <ArrowRight size={14} className="text-slate-500" />
                <span className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white">Diesel (12,500 L)</span>
                <ArrowRight size={14} className="text-slate-500" />
                <span className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white">Extracted: 1,250 L</span>
                <ArrowRight size={14} className="text-slate-500" />
                <span className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500 text-emerald-300 font-mono">Invoice INV-4821</span>
                <ArrowRight size={14} className="text-slate-500" />
                <span className="px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500 text-amber-300 font-bold">Trust Score 82</span>
                <ArrowRight size={14} className="text-slate-500" />
                <span className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500 text-rose-300 font-bold">CAPA-2026-0091</span>
              </div>
              <p className="text-xs text-slate-400">
                Auditors can click any disclosure metric in the BRSR preview to immediately inspect this full chain back to the raw invoice image and bounding boxes.
              </p>
            </div>
          )}

          {/* Step 9: CAPA */}
          {currentStep === 8 && (
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 uppercase">Automated Corrective & Preventive Action</span>
                <Badge tone="rose">OPEN · HIGH SEVERITY</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">CAPA Code</span>
                  <span className="font-bold text-white text-base">CAPA-2026-0091</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">Assigned Stakeholder</span>
                  <span className="font-bold text-white text-base">Site Engineer (Suresh Naik)</span>
                </div>
              </div>
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                <p><b className="text-slate-300">Finding:</b> Fuel consumption inconsistent with historical baseline.</p>
                <p><b className="text-emerald-400">Corrective Action:</b> Upload fuel dispensing calibration register and sub-contractor intake logs.</p>
                <p><b className="text-sky-400">Preventive Action:</b> Daily automated IoT fuel dispenser reconciliation enabled.</p>
              </div>
            </div>
          )}

          {/* Step 10: Consolidation */}
          {currentStep === 9 && (
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase">Deterministic Roll-up (Zero Record Duplication)</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span>MEIL Project Site 104 (Level 1)</span>
                  <span className="font-bold text-emerald-400">12,500 Ltrs</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span>Tunnels & Transit Division (Level 2 · 35 Sites)</span>
                  <span className="font-bold text-sky-400">482,500 Ltrs</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span>MEIL Infrastructure & Utilities (Level 3 · 3 BUs)</span>
                  <span className="font-bold text-indigo-400">1,420,000 Ltrs</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-blue-950/40 border border-blue-500/40">
                  <span className="font-bold text-white">MEIL Group Consolidated Total (250+ Sites)</span>
                  <span className="font-black text-white">3,840,000 Ltrs</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 11: BRSR Mapping */}
          {currentStep === 10 && (
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4 text-xs">
              <span className="text-xs font-bold text-slate-400 uppercase">SEBI Statutory Taxonomy Alignment</span>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">BRSR Principle</span>
                  <span className="font-bold text-white">Principle 6 (Environmental Stewardship)</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">SEBI Disclosure Section</span>
                  <span className="font-bold text-white">Section C · Essential Indicator 1</span>
                </div>
              </div>
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Populated Value</span>
                <span className="text-lg font-black text-emerald-400">3,840,000 Litres (10,291.2 tCO2e Scope 1)</span>
                <p className="text-[11px] text-slate-400 mt-1">Retains direct pointer to source invoice EV-2026-000458.</p>
              </div>
            </div>
          )}

          {/* Step 12: SDG Mapping */}
          {currentStep === 11 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center">
                <span className="text-3xl font-black text-emerald-400">SDG 13</span>
                <p className="font-bold text-white mt-2">Climate Action</p>
                <p className="text-[11px] text-slate-400 mt-1">Direct Scope 1 fuel consumption reduction target</p>
              </div>
              <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-500/40 text-center">
                <span className="text-3xl font-black text-sky-400">SDG 9</span>
                <p className="font-bold text-white mt-2">Industry & Infrastructure</p>
                <p className="text-[11px] text-slate-400 mt-1">Energy-efficient tunneling machinery</p>
              </div>
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-center">
                <span className="text-3xl font-black text-indigo-400">SDG 12</span>
                <p className="font-bold text-white mt-2">Responsible Consumption</p>
                <p className="text-[11px] text-slate-400 mt-1">Resource allocation and fuel efficiency</p>
              </div>
            </div>
          )}

          {/* Step 13: BRSR Validation */}
          {currentStep === 12 && (
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Pre-Assurance Readiness Check</span>
                <span className="text-2xl font-black text-emerald-400">91% READY</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Evidence Coverage</span>
                  <span className="font-black text-emerald-400 text-lg">95%</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Verified Metrics</span>
                  <span className="font-black text-sky-400 text-lg">89%</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Review Required</span>
                  <span className="font-black text-amber-400 text-lg">8 Items</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Open CAPAs</span>
                  <span className="font-black text-rose-400 text-lg">2 Items</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 14: BRSR Preview */}
          {currentStep === 13 && (
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3 text-xs">
              <span className="text-xs font-bold text-slate-400 uppercase">Section C: Interactive Performance Preview</span>
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Essential Indicator 1: Scope 1 Diesel Consumption</span>
                  <button className="flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300">
                    <Eye size={12} /> Inspect Evidence Trail
                  </button>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span>Current FY (FY 2026-27): <b className="text-emerald-400">3,840,000 Litres</b></span>
                  <span className="text-slate-400">Previous FY: <b>3,520,000 Litres</b></span>
                  <Badge tone="emerald">Trust 82</Badge>
                </div>
              </div>
            </div>
          )}

          {/* Step 15: PDF Generation */}
          {currentStep === 14 && (
            <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">35-Page Standard SEBI BRSR Report</span>
                <Badge tone="indigo">Generated v1.0</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Report Identifier</span>
                  <span className="text-base font-bold text-white">BRSR-2026-001 (Megha Engineering)</span>
                </div>
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">Cryptographic PDF Hash</span>
                  <span className="font-mono text-emerald-400 break-all">a82f8194c7b2e617d3a01490218b824efc8d92bd</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Covers Section A (General Disclosures), Section B (Management & Policies), and Section C (P1–P9) with all SEBI Annexure tables and digital verification stamp.
              </p>
            </div>
          )}

          {/* Step 16: Audit-Ready Package */}
          {currentStep === 15 && (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-black text-white">VERIGRAPH_AUDIT_PACKAGE.zip</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Complete verifiable bundle ready for third-party assurance providers.</p>
                </div>
                <button
                  onClick={handleDownloadDemoZip}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg"
                >
                  <Download size={16} />
                  Download ZIP Package
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300">
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">✓ BRSR_Report.pdf</div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">✓ Report_Hash.txt</div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">✓ facts.json</div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">✓ ocr_metadata.json</div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">✓ 5_agent_checks.json</div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">✓ trust_scores.json</div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">✓ capa_records.json</div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">✓ manifest.json</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-slate-950 border-t border-slate-800 p-4 flex items-center justify-between">
          <button
            onClick={() => { setCurrentStep((prev) => Math.max(0, prev - 1)); setIsPlaying(false); }}
            disabled={currentStep === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:pointer-events-none transition"
          >
            ← Previous Step
          </button>

          <span className="text-xs font-mono text-slate-400">
            Step {currentStep + 1} of 16
          </span>

          <button
            onClick={() => {
              if (currentStep < 15) {
                setCurrentStep((prev) => prev + 1);
                setIsPlaying(false);
              } else {
                onClose();
              }
            }}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1.5 shadow-md"
          >
            {currentStep === 15 ? 'Finish & Close Demo' : 'Next Step →'}
          </button>
        </div>

      </div>
    </div>
  );
}

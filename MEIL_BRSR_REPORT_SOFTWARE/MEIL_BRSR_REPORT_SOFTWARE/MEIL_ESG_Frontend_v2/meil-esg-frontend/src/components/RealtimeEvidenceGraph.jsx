import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Network, Search, ZoomIn, ZoomOut, Maximize2, RotateCcw, Filter,
  ShieldCheck, AlertTriangle, Eye, ArrowRight, Sparkles, Database,
  Cpu, FileText, CheckCircle2, Lock, Layers, Download, X, Play, Pause, Activity
} from 'lucide-react';

// Default Comprehensive Real-Time Knowledge Graph Datasets
const DATASETS = {
  fuel_invoice_104: {
    id: 'fuel_invoice_104',
    title: 'MEIL Project Site 104 — Fuel Invoice INV-4821 Lineage',
    metric: 'Diesel Consumption (P6)',
    period: 'September 2026',
    nodes: [
      { id: 'site_104', label: 'Site 104 (Zojila Tunnel)', type: 'site', x: 80, y: 240, status: 'Active', details: { bu: 'Tunnels & Transit', state: 'Jammu & Kashmir', scale: 'Tier 1 Civil Site' } },
      
      { id: 'val_diesel', label: '12,500 L Diesel Claimed', type: 'metric', x: 260, y: 160, status: 'Reported', details: { code: 'p6_diesel', unit: 'Litres', period: 'Sep 2026' } },
      { id: 'val_electricity', label: '58,200 kWh Grid Power', type: 'metric', x: 260, y: 320, status: 'Reported', details: { code: 'p6_grid', unit: 'kWh', period: 'Sep 2026' } },
      
      { id: 'doc_inv4821', label: 'Invoice INV-4821 (ABC Fuels)', type: 'evidence', x: 450, y: 130, status: 'Vault Locked', details: { sha256: 'e3b0c44298fc1c14...b855', vaultId: 'EV-2026-000458', vendor: 'ABC Fuels Pvt Ltd', date: '18-09-2026' } },
      { id: 'doc_meter_log', label: 'Daily Dispenser Slip #104', type: 'evidence', x: 450, y: 250, status: 'Cross-Doc', details: { source: 'Site IoT Calibration Slip', variance: '0.0% vs invoice' } },
      { id: 'doc_discom', label: 'DISCOM HT Bill #4491', type: 'evidence', x: 450, y: 360, status: 'Vault Locked', details: { sha256: 'f87a912b5c41...981a', vaultId: 'EV-2026-000459' } },

      { id: 'fact_qty', label: 'Extracted: 1,250 L (96%)', type: 'fact', x: 640, y: 90, status: 'Verified', details: { bbox: '[110, 230, 260, 290]', ocrConf: '96.2%', textValue: '1,250 Litres' } },
      { id: 'fact_amount', label: 'Extracted: ₹118,750 (98%)', type: 'fact', x: 640, y: 170, status: 'Verified', details: { bbox: '[460, 230, 580, 290]', ocrConf: '97.8%', textValue: '₹118,750.00' } },
      { id: 'fact_gstin', label: 'GSTIN: 36AABCA1234F1Z5', type: 'fact', x: 640, y: 250, status: 'Verified', details: { checksum: 'Valid', ocrConf: '98.5%' } },

      { id: 'agent_doc', label: 'Document Agent (100%)', type: 'agent', x: 830, y: 90, status: 'PASS', details: { checks: 'Arithmetic 1,250 × ₹95 = ₹118,750 matches perfectly' } },
      { id: 'agent_cross', label: 'Cross-Doc Agent (98%)', type: 'agent', x: 830, y: 160, status: 'PASS', details: { checks: 'Reconciled against dispenser intake slip' } },
      { id: 'agent_temporal', label: 'Temporal Agent (58%)', type: 'agent', x: 830, y: 230, status: 'WARNING', details: { finding: 'Historical baseline spike (+177% MoM)' } },
      { id: 'agent_ml', label: 'ML Anomaly Detector', type: 'agent', x: 830, y: 300, status: 'ANOMALY', details: { score: '0.87 (IsolationForest outlier)' } },

      { id: 'meta_auditor', label: 'Meta-Auditor Reconciler', type: 'reconciler', x: 1010, y: 180, status: 'REVIEW_REQUIRED', details: { verdict: 'Review Required due to sudden MoM fuel spike' } },
      { id: 'trust_score', label: 'Trust Score: 82/100', type: 'trust', x: 1010, y: 290, status: 'Good', details: { provenance: 95, ocr: 96, doc: 100, temporal: 58 } },

      { id: 'capa_0091', label: 'CAPA-2026-0091 (Assigned)', type: 'capa', x: 1010, y: 400, status: 'OPEN', details: { owner: 'Site Engineer', action: 'Upload dispenser calibration log' } },

      { id: 'brsr_p6', label: 'BRSR Principle 6 (Scope 1)', type: 'brsr', x: 1190, y: 180, status: 'Auditable', details: { section: 'Section C · Essential Indicator 1', standard: 'SEBI BRSR Core' } },
      { id: 'sdg_13', label: 'UN SDG 13: Climate Action', type: 'sdg', x: 1190, y: 290, status: 'Aligned', details: { target: '13.2 Sustainable Energy & Emissions' } },
    ],
    edges: [
      { from: 'site_104', to: 'val_diesel', label: 'Reports' },
      { from: 'site_104', to: 'val_electricity', label: 'Reports' },
      
      { from: 'val_diesel', to: 'doc_inv4821', label: 'Evidence Proof' },
      { from: 'val_diesel', to: 'doc_meter_log', label: 'Secondary Proof' },
      { from: 'val_electricity', to: 'doc_discom', label: 'Utility Bill' },

      { from: 'doc_inv4821', to: 'fact_qty', label: 'OCR Extract' },
      { from: 'doc_inv4821', to: 'fact_amount', label: 'OCR Extract' },
      { from: 'doc_inv4821', to: 'fact_gstin', label: 'OCR Extract' },

      { from: 'fact_qty', to: 'agent_doc', label: 'Validate' },
      { from: 'fact_amount', to: 'agent_doc', label: 'Validate' },
      { from: 'doc_meter_log', to: 'agent_cross', label: 'Cross-Match' },
      { from: 'fact_qty', to: 'agent_temporal', label: 'Baseline Check' },
      { from: 'val_diesel', to: 'agent_ml', label: 'ML Outlier' },

      { from: 'agent_doc', to: 'meta_auditor', label: 'PASS' },
      { from: 'agent_cross', to: 'meta_auditor', label: 'PASS' },
      { from: 'agent_temporal', to: 'meta_auditor', label: 'WARNING' },
      { from: 'agent_ml', to: 'meta_auditor', label: 'ANOMALY' },

      { from: 'meta_auditor', to: 'trust_score', label: 'Calculates' },
      { from: 'meta_auditor', to: 'capa_0091', label: 'Triggers' },

      { from: 'meta_auditor', to: 'brsr_p6', label: 'Statutory Map' },
      { from: 'brsr_p6', to: 'sdg_13', label: 'Global Align' },
    ]
  },

  electricity_zojila: {
    id: 'electricity_zojila',
    title: 'Zojila Tunnel Package 1 — DISCOM High-Tension Grid Lineage',
    metric: 'Grid Electricity (P6)',
    period: 'September 2026',
    nodes: [
      { id: 'site_zojila', label: 'Zojila Tunnel Site', type: 'site', x: 100, y: 220, status: 'Active', details: { bu: 'Tunnels & Transit', state: 'J&K' } },
      { id: 'val_kwh', label: '32,400 kWh Claimed', type: 'metric', x: 300, y: 220, status: 'Reported', details: { code: 'p6_grid', period: 'Sep 2026' } },
      { id: 'doc_discom_ht', label: 'DISCOM HT Bill #4491', type: 'evidence', x: 500, y: 220, status: 'Vault Locked', details: { sha256: '98a712...3312' } },
      { id: 'fact_units', label: 'Fact: 32,400 Units (98%)', type: 'fact', x: 700, y: 160, status: 'Verified', details: { conf: '98.4%' } },
      { id: 'fact_tariff', label: 'Tariff: ₹7.20 / Unit', type: 'fact', x: 700, y: 280, status: 'Verified', details: { rate: '₹7.20' } },
      { id: 'agent_audit_ht', label: '5-Agent Verification (PASS)', type: 'agent', x: 900, y: 220, status: 'PASS', details: { math: 'Exact' } },
      { id: 'trust_ht', label: 'Trust Score: 96/100', type: 'trust', x: 1080, y: 220, status: 'Verified', details: { category: 'Verified' } },
      { id: 'brsr_p6_ht', label: 'BRSR Principle 6 (Scope 2)', type: 'brsr', x: 1260, y: 220, status: 'Auditable', details: { scope2: '23.0 tCO2e' } },
    ],
    edges: [
      { from: 'site_zojila', to: 'val_kwh', label: 'Reports' },
      { from: 'val_kwh', to: 'doc_discom_ht', label: 'Backed By' },
      { from: 'doc_discom_ht', to: 'fact_units', label: 'OCR Extract' },
      { from: 'doc_discom_ht', to: 'fact_tariff', label: 'OCR Extract' },
      { from: 'fact_units', to: 'agent_audit_ht', label: 'Verify' },
      { from: 'fact_tariff', to: 'agent_audit_ht', label: 'Verify' },
      { from: 'agent_audit_ht', to: 'trust_ht', label: 'Calculates' },
      { from: 'trust_ht', to: 'brsr_p6_ht', label: 'Rolls Up' },
    ]
  }
};

const TYPE_CONFIG = {
  site: { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', border: '#38bdf8', label: 'Project Site', radius: 24 },
  metric: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '#34d399', label: 'Reported Metric', radius: 22 },
  evidence: { color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)', border: '#a5b4fc', label: 'Vault Evidence', radius: 24 },
  fact: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: '#22d3ee', label: 'OCR Fact & BBox', radius: 20 },
  agent: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#fbbf24', label: 'Forensic Agent', radius: 20 },
  reconciler: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: '#fb923c', label: 'Meta-Auditor', radius: 24 },
  trust: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', border: '#4ade80', label: 'Trust Score', radius: 24 },
  capa: { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.2)', border: '#fb7185', label: 'CAPA Action', radius: 22 },
  brsr: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: '#c084fc', label: 'SEBI BRSR', radius: 24 },
  sdg: { color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)', border: '#2dd4bf', label: 'UN SDG', radius: 22 },
};

export default function RealtimeEvidenceGraph({ initialDataset = 'fuel_invoice_104' }) {
  const [selectedDatasetKey, setSelectedDatasetKey] = useState(initialDataset);
  const dataset = DATASETS[selectedDatasetKey] || DATASETS.fuel_invoice_104;

  const [nodes, setNodes] = useState(dataset.nodes);
  const [edges, setEdges] = useState(dataset.edges);
  const [selectedNode, setSelectedNode] = useState(dataset.nodes[0]);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Canvas Viewport transform
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNode, setDraggedNode] = useState(null);
  const [isPlayingParticles, setIsPlayingParticles] = useState(true);

  // Sync when dataset changes
  useEffect(() => {
    const d = DATASETS[selectedDatasetKey] || DATASETS.fuel_invoice_104;
    setNodes(d.nodes);
    setEdges(d.edges);
    setSelectedNode(d.nodes[0]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [selectedDatasetKey]);

  // Connected nodes calculation
  const connectedNodeIds = useMemo(() => {
    if (!selectedNode) return new Set();
    const set = new Set([selectedNode.id]);
    edges.forEach((e) => {
      if (e.from === selectedNode.id) set.add(e.to);
      if (e.to === selectedNode.id) set.add(e.from);
    });
    return set;
  }, [selectedNode, edges]);

  // Filtered nodes
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (filterType !== 'ALL' && n.type !== filterType) return false;
      if (searchTerm.trim() && !n.label.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [nodes, filterType, searchTerm]);

  // Handle Dragging
  const svgRef = useRef(null);

  const handleMouseDownNode = (e, node) => {
    e.stopPropagation();
    setDraggedNode(node.id);
    setSelectedNode(node);
  };

  const handleMouseMove = (e) => {
    if (draggedNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;

      setNodes((prev) =>
        prev.map((n) => (n.id === draggedNode ? { ...n, x: mouseX, y: mouseY } : n))
      );
    } else if (isPanning) {
      setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsPanning(false);
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(nodes[0]);
  };

  // Node Map for fast edge position lookups
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[750px] relative text-white">
      {/* Top Header Controls Bar */}
      <div className="bg-slate-900/95 border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Network size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black tracking-tight text-white">
                VERIGRAPH Real-Time Evidence Knowledge Graph
              </h3>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Graph Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive Relational Provenance · {nodes.length} Nodes · {edges.length} Cryptographic Lineage Edges
            </p>
          </div>
        </div>

        {/* Dataset Switcher & Filter Tools */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDatasetKey}
            onChange={(e) => setSelectedDatasetKey(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
          >
            <option value="fuel_invoice_104">Dataset: Site 104 · Fuel Invoice INV-4821</option>
            <option value="electricity_zojila">Dataset: Zojila Tunnel · DISCOM Electricity</option>
          </select>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 outline-none"
          >
            <option value="ALL">Show All Entity Types</option>
            <option value="site">Project Sites</option>
            <option value="evidence">Vault Evidence Documents</option>
            <option value="fact">OCR Extracted Facts</option>
            <option value="agent">Forensic Agents</option>
            <option value="trust">Trust Scores</option>
            <option value="capa">CAPA Actions</option>
            <option value="brsr">BRSR Principles</option>
          </select>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl pl-8 pr-3 py-2 w-36 sm:w-44 outline-none placeholder:text-slate-500"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Zoom & View Controls */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
              className="p-1.5 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="p-1.5 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              title="Reset View"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setIsPlayingParticles(!isPlayingParticles)}
              className={`p-1.5 rounded-lg transition ${
                isPlayingParticles ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-700'
              }`}
              title="Toggle Particle Stream"
            >
              <Activity size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Workspace */}
      <div
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={() => setIsPanning(true)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Subtle Cyber Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)`,
            backgroundSize: `36px 36px`,
          }}
        />

        {/* Live SVG Graph Canvas */}
        <svg
          ref={svgRef}
          className="w-full h-full absolute inset-0"
        >
          <defs>
            {/* Glowing Linear Gradients for Edges */}
            <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
            </linearGradient>

            <linearGradient id="edge-active-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
            </linearGradient>

            {/* Neon Drop Shadow Filter */}
            <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#38bdf8" floodOpacity="0.5" />
            </filter>
            <filter id="active-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#34d399" floodOpacity="0.7" />
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. Render Edges (Curved Bezier Paths) */}
            {edges.map((edge, idx) => {
              const src = nodeMap.get(edge.from);
              const dst = nodeMap.get(edge.to);
              if (!src || !dst) return null;

              const isHighlighted =
                selectedNode &&
                (edge.from === selectedNode.id || edge.to === selectedNode.id);

              const isConnected =
                selectedNode &&
                (connectedNodeIds.has(edge.from) && connectedNodeIds.has(edge.to));

              // Smooth Bezier Curve Path
              const dx = dst.x - src.x;
              const dy = dst.y - src.y;
              const cx1 = src.x + dx * 0.5;
              const cy1 = src.y;
              const cx2 = src.x + dx * 0.5;
              const cy2 = dst.y;
              const pathD = `M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${dst.x} ${dst.y}`;

              return (
                <g key={idx}>
                  {/* Base Curved Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={
                      isHighlighted
                        ? '#34d399'
                        : isConnected
                        ? '#38bdf8'
                        : 'rgba(71, 85, 105, 0.4)'
                    }
                    strokeWidth={isHighlighted ? 3 : isConnected ? 2 : 1.2}
                    strokeDasharray={edge.label === 'ANOMALY' ? '4 4' : 'none'}
                    className="transition-colors duration-300"
                  />

                  {/* Animated Streaming Pulse Particle */}
                  {isPlayingParticles && (
                    <circle r={isHighlighted ? 3.5 : 2.5} fill={isHighlighted ? '#4ade80' : '#38bdf8'}>
                      <animateMotion
                        path={pathD}
                        dur={`${2.2 + (idx % 3) * 0.6}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Edge Label Pill at Midpoint */}
                  <text
                    x={(src.x + dst.x) / 2}
                    y={(src.y + dst.y) / 2 - 6}
                    fill={isHighlighted ? '#6ee7b7' : '#94a3b8'}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="pointer-events-none font-mono"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* 2. Render Nodes */}
            {visibleNodes.map((node) => {
              const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.site;
              const isSelected = selectedNode?.id === node.id;
              const isConnected = connectedNodeIds.has(node.id);
              const isHovered = hoveredNode?.id === node.id;
              const opacity = selectedNode ? (isConnected ? 1 : 0.25) : 1;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ opacity, transition: 'opacity 0.25s ease' }}
                  onMouseDown={(e) => handleMouseDownNode(e, node)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer group"
                >
                  {/* Outer Pulsing Aura when Selected */}
                  {isSelected && (
                    <circle
                      r={cfg.radius + 10}
                      fill="none"
                      stroke={cfg.border}
                      strokeWidth="2"
                      className="animate-ping opacity-40"
                    />
                  )}

                  {/* Outer Ring */}
                  <circle
                    r={cfg.radius + 4}
                    fill={cfg.bg}
                    stroke={isSelected ? '#34d399' : cfg.border}
                    strokeWidth={isSelected ? 3 : 1.5}
                    filter={isSelected ? 'url(#active-glow)' : 'none'}
                    className="transition-all duration-300"
                  />

                  {/* Inner Core Circle */}
                  <circle
                    r={cfg.radius}
                    fill="#0f172a"
                    stroke={isSelected ? '#34d399' : cfg.color}
                    strokeWidth="2"
                  />

                  {/* Center Node Icon / Glyph */}
                  <text
                    x="0"
                    y="4"
                    fill={cfg.color}
                    fontSize="11"
                    fontWeight="black"
                    textAnchor="middle"
                    className="pointer-events-none font-mono"
                  >
                    {node.type === 'site' && 'SITE'}
                    {node.type === 'metric' && 'MET'}
                    {node.type === 'evidence' && 'DOC'}
                    {node.type === 'fact' && 'FACT'}
                    {node.type === 'agent' && 'AGT'}
                    {node.type === 'reconciler' && 'AUD'}
                    {node.type === 'trust' && '82'}
                    {node.type === 'capa' && 'CAPA'}
                    {node.type === 'brsr' && 'P6'}
                    {node.type === 'sdg' && '13'}
                  </text>

                  {/* Node Label Floating Banner */}
                  <g transform={`translate(0, ${cfg.radius + 16})`}>
                    <rect
                      x={-(node.label.length * 3.4 + 10)}
                      y="-11"
                      width={node.label.length * 6.8 + 20}
                      height="18"
                      rx="9"
                      fill="rgba(15, 23, 42, 0.9)"
                      stroke={isSelected ? '#34d399' : 'rgba(71, 85, 105, 0.6)'}
                      strokeWidth={isSelected ? 1.5 : 1}
                    />
                    <text
                      x="0"
                      y="2"
                      fill={isSelected ? '#ffffff' : '#e2e8f0'}
                      fontSize="10"
                      fontWeight={isSelected ? 'bold' : 'medium'}
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {node.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Bottom Floating Telemetry & Legend Pill */}
        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-4 py-2.5 rounded-2xl flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Interactive Real-Time Mode: Drag nodes to rearrange</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400 border-l border-slate-700 pl-4">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> Sites</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-400" /> Evidence</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400" /> Facts</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Agents</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Trust Score</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> CAPA</span>
          </div>
        </div>
      </div>

      {/* Right Telemetry Inspector Drawer */}
      {selectedNode && (
        <div className="absolute top-20 right-4 bottom-4 w-80 sm:w-96 bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-xl z-20 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {TYPE_CONFIG[selectedNode.type]?.label || 'Entity'}
                </span>
                <span className="text-xs font-mono text-slate-400">ID: {selectedNode.id}</span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4">
              <h4 className="text-lg font-black text-white">{selectedNode.label}</h4>
              <p className="text-xs text-slate-400 mt-1">Status: <b className="text-emerald-400">{selectedNode.status}</b></p>
            </div>

            {/* Real-time Properties */}
            <div className="mt-5 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Cryptographic Telemetry & Facts
              </span>
              <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
                {Object.entries(selectedNode.details || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-slate-800/80 last:border-none">
                    <span className="text-slate-400 capitalize">{k}:</span>
                    <span className="font-mono text-emerald-300 font-semibold truncate max-w-[170px]" title={String(v)}>
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Relational Connections */}
            <div className="mt-5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Direct Lineage Connections ({connectedNodeIds.size - 1})
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {Array.from(connectedNodeIds)
                  .filter((id) => id !== selectedNode.id)
                  .map((id) => {
                    const cNode = nodeMap.get(id);
                    if (!cNode) return null;
                    return (
                      <div
                        key={id}
                        onClick={() => setSelectedNode(cNode)}
                        className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-between text-xs cursor-pointer transition"
                      >
                        <span className="font-semibold text-slate-200 truncate">{cNode.label}</span>
                        <ArrowRight size={12} className="text-sky-400 shrink-0" />
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center gap-2">
            <button
              onClick={() => {
                alert(`Exporting sub-graph lineage JSON for ${selectedNode.id}`);
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Download size={14} />
              Export Subgraph
            </button>
            <button
              onClick={() => handleResetView()}
              className="py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition"
            >
              Fit Canvas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

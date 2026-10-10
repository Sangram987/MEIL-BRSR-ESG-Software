import React, { useState, useEffect } from 'react';
import { ShieldCheck, Network, AlertCircle, FileCheck, Layers, Eye } from 'lucide-react';
import { Card, PageHeader, Badge, Btn, Table } from '../../components/ui';
import verigraphApi from '../../services/verigraphApi';
import RealtimeEvidenceGraph from '../../components/RealtimeEvidenceGraph';

export default function EvidenceLineage() {
  const [activeTab, setActiveTab] = useState('graph'); // 'graph' | 'facts' | 'verifications'
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [facts, setFacts] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [g, f, v] = await Promise.all([
          verigraphApi.getKnowledgeGraph(),
          verigraphApi.getFacts(),
          verigraphApi.getVerifications(),
        ]);
        setGraphData(g);
        setFacts(f);
        setVerifications(v);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence Lineage & Knowledge Graph"
        subtitle="Provenance trail linking Reported Metrics → Values → Extracted Facts → Verification → BRSR Mappings."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('graph')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'graph' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Knowledge Graph
            </button>
            <button
              onClick={() => setActiveTab('facts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'facts' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Extracted Facts ({facts.length})
            </button>
            <button
              onClick={() => setActiveTab('verifications')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === 'verifications' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Forensic Verifications ({verifications.length})
            </button>
          </div>
        }
      />

      {activeTab === 'graph' && (
        <div className="space-y-4">
          <RealtimeEvidenceGraph initialDataset="fuel_invoice_104" />
        </div>
      )}

      {activeTab === 'facts' && (
        <Card pad={false}>
          <Table head={['Fact Type', 'Field Name', 'Extracted Value', 'Confidence', 'Page', 'Source Snippet']}>
            {facts.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50 text-xs">
                <td className="px-4 py-3 font-bold text-blue-600 uppercase">{f.factType}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{f.fieldName}</td>
                <td className="px-4 py-3 font-black text-slate-900">
                  {f.normalizedValue ? `${f.normalizedValue.toLocaleString()} ${f.unit || ''}` : f.textValue}
                </td>
                <td className="px-4 py-3">
                  <Badge tone="emerald">{Math.round((f.extractionConfidence || 0.95) * 100)}%</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">Page {f.pageNumber}</td>
                <td className="px-4 py-3 text-slate-600 truncate max-w-xs">{f.sourceSnippet || '–'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {activeTab === 'verifications' && (
        <Card pad={false}>
          <Table head={['Metric', 'Status', 'Risk Level', 'Trust / Confidence', 'Explanation', 'Recommended Action']}>
            {verifications.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50 text-xs">
                <td className="px-4 py-3 font-bold text-slate-900">{v.metricCode}</td>
                <td className="px-4 py-3">
                  <Badge tone={v.overallStatus === 'VERIFIED' ? 'emerald' : 'amber'}>{v.overallStatus}</Badge>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">{v.riskLevel}</td>
                <td className="px-4 py-3 font-black text-emerald-600">{Math.round((v.confidence || 0.95) * 100)}%</td>
                <td className="px-4 py-3 text-slate-700 max-w-xs">{v.explanation}</td>
                <td className="px-4 py-3 text-slate-500">{v.recommendedAction || 'Approved'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}

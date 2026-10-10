import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, Plus, Filter, MessageSquare } from 'lucide-react';
import { Card, PageHeader, Badge, Btn, Table, Modal, inputCls, labelCls } from '../../components/ui';
import capaApi from '../../services/capaApi';
import { useApp } from '../../store/AppStore';

const SEVERITY_COLORS = {
  LOW: 'sky',
  MEDIUM: 'amber',
  HIGH: 'rose',
  CRITICAL: 'rose',
};

export default function CapaManagement() {
  const { toast } = useApp();
  const [capas, setCapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCapa, setSelectedCapa] = useState(null);

  // New CAPA form state
  const [finding, setFinding] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [owner, setOwner] = useState('Site Fuel Officer');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [preventiveAction, setPreventiveAction] = useState('');
  const [dueDate, setDueDate] = useState('2026-10-31');

  const loadCapas = async () => {
    try {
      setLoading(true);
      const data = await capaApi.listCapa();
      setCapas(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCapas();
  }, []);

  const handleCreateCapa = async (e) => {
    e.preventDefault();
    try {
      await capaApi.createCapa({
        finding,
        severity,
        owner,
        correctiveAction,
        preventiveAction,
        dueDate,
      });
      toast('CAPA created successfully.', 'success');
      setIsModalOpen(false);
      setFinding('');
      setCorrectiveAction('');
      setPreventiveAction('');
      loadCapas();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await capaApi.updateCapa(id, { status: newStatus });
      toast(`CAPA status updated to ${newStatus}.`, 'success');
      loadCapas();
      if (selectedCapa?.id === id) {
        setSelectedCapa({ ...selectedCapa, status: newStatus });
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corrective & Preventive Action (CAPA)"
        subtitle="Manage forensic variance investigations, root causes, corrective actions, and auditor closeout signoffs."
        actions={
          <Btn tone="primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> New CAPA Record
          </Btn>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <p className="text-xs font-bold text-slate-500 uppercase">Total CAPA</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{capas.length}</p>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <p className="text-xs font-bold text-slate-500 uppercase">Open / In Progress</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{capas.filter((c) => ['OPEN', 'IN_PROGRESS'].includes(c.status)).length}</p>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <p className="text-xs font-bold text-slate-500 uppercase">Resolved / Closed</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{capas.filter((c) => ['RESOLVED', 'CLOSED'].includes(c.status)).length}</p>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <p className="text-xs font-bold text-slate-500 uppercase">High Severity</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{capas.filter((c) => ['HIGH', 'CRITICAL'].includes(c.severity)).length}</p>
        </Card>
      </div>

      <Card pad={false}>
        <Table head={['Code', 'Project Site', 'Finding', 'Severity', 'Owner', 'Due Date', 'Status', 'Actions']}>
          {capas.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50 text-xs">
              <td className="px-4 py-3 font-bold text-blue-600">{c.capaCode}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{c.projectName || 'Zojila Tunnel Package 1'}</td>
              <td className="px-4 py-3 text-slate-700 max-w-sm truncate">{c.finding}</td>
              <td className="px-4 py-3">
                <Badge tone={SEVERITY_COLORS[c.severity] || 'slate'}>{c.severity}</Badge>
              </td>
              <td className="px-4 py-3 text-slate-600">{c.owner}</td>
              <td className="px-4 py-3 text-slate-500">{c.dueDate || '–'}</td>
              <td className="px-4 py-3">
                <Badge tone={c.status === 'CLOSED' ? 'emerald' : c.status === 'RESOLVED' ? 'sky' : 'amber'}>
                  {c.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => setSelectedCapa(c)}
                  className="font-bold text-blue-600 hover:text-blue-800"
                >
                  Inspect
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Inspect & Action Modal */}
      {selectedCapa && (
        <Modal
          open={!!selectedCapa}
          onClose={() => setSelectedCapa(null)}
          title={`${selectedCapa.capaCode} · Investigation & Closure`}
          footer={
            <div className="flex justify-between w-full">
              <div className="flex gap-2">
                {selectedCapa.status !== 'RESOLVED' && selectedCapa.status !== 'CLOSED' && (
                  <Btn tone="emerald" onClick={() => handleUpdateStatus(selectedCapa.id, 'RESOLVED')}>
                    Mark as Resolved
                  </Btn>
                )}
                {selectedCapa.status !== 'CLOSED' && (
                  <Btn tone="primary" onClick={() => handleUpdateStatus(selectedCapa.id, 'CLOSED')}>
                    Sign Off & Close CAPA
                  </Btn>
                )}
              </div>
              <Btn tone="ghost" onClick={() => setSelectedCapa(null)}>
                Close
              </Btn>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Forensic Finding</span>
              <p className="text-sm font-semibold text-slate-800 mt-1">{selectedCapa.finding}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-slate-700 block mb-1">Corrective Action Taken</span>
                <p className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600">
                  {selectedCapa.correctiveAction || 'Under investigation by site engineering.'}
                </p>
              </div>
              <div>
                <span className="font-bold text-slate-700 block mb-1">Preventive Action Plan</span>
                <p className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600">
                  {selectedCapa.preventiveAction || 'Procedure update pending review.'}
                </p>
              </div>
            </div>

            <div className="flex gap-4 text-slate-500 pt-2 border-t border-slate-100">
              <span>Owner: <b>{selectedCapa.owner}</b></span>
              <span>Severity: <b>{selectedCapa.severity}</b></span>
              <span>Due: <b>{selectedCapa.dueDate || 'Open'}</b></span>
            </div>
          </div>
        </Modal>
      )}

      {/* New CAPA Creation Modal */}
      {isModalOpen && (
        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create New Corrective & Preventive Action (CAPA)"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Btn tone="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Btn>
              <Btn tone="primary" onClick={handleCreateCapa}>Save CAPA</Btn>
            </div>
          }
        >
          <form className="space-y-3">
            <div>
              <label className={labelCls}>Finding / Audit Observation</label>
              <textarea
                rows={2}
                value={finding}
                onChange={(e) => setFinding(e.target.value)}
                placeholder="Describe variance or discrepancy..."
                className={inputCls}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Severity</label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputCls}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Assigned Owner</label>
                <input value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Corrective Action Plan</label>
              <input
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                placeholder="Immediate fix implemented..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Preventive Action</label>
              <input
                value={preventiveAction}
                onChange={(e) => setPreventiveAction(e.target.value)}
                placeholder="Process safeguard for the future..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Target Closure Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

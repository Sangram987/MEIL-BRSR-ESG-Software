import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { PRINCIPLES, periodLabel } from '../../data/brsr';
import { StatusBadge, AssuranceBadge, PageHeader, Card, Table, Empty, dt, Badge, Modal } from '../../components/ui';

export default function MySubmissions() {
  const { user, calc, org } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);

  const targetProjectId = user?.projectId || org?.projects?.find((p) => p.name === 'Zojila Tunnel Package 1')?.id || 'prj-001';
  const rows = calc.submissions.filter((s) => s.projectId === targetProjectId || s.projectId === user?.projectId || s.projectId === 'prj-001').sort((a, b) => b.period.localeCompare(a.period) || a.principle.localeCompare(b.principle));

  return (
    <div className="space-y-6">
      <PageHeader title="My submissions" subtitle="Every packet you've sent, with its approval and assurance trail." />
      <Card pad={false}>
        {rows.length === 0 ? <Empty title="Nothing submitted yet" text="Start from Data entry." /> : (
          <Table head={['', 'Period', 'Principle', 'Status', 'Assurance', 'Last update', '']}>
            {rows.map((s) => (
              <React.Fragment key={s.id}>
                <tr className="hover:bg-slate-50">
                  <td className="pl-4 w-8"><button aria-label="Toggle history" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td>
                  <td className="px-4 py-3 font-semibold">{periodLabel(s.period)}</td>
                  <td className="px-4 py-3"><Badge>{s.principle}</Badge> <span className="ml-1">{PRINCIPLES.find((p) => p.id === s.principle).label}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">{s.status === 'approved' ? <AssuranceBadge status={s.assurance} /> : <span className="text-xs text-slate-400">After approval</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{dt(s.history.at(-1)?.at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedSub(s)}
                        className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded flex items-center gap-1 transition"
                      >
                        <Eye size={12} /> Inspect
                      </button>
                      <button
                        onClick={() => nav(`/operator/data-entry?principle=${s.principle}`)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700"
                      >
                        {['draft', 'correction_required', 'rejected'].includes(s.status) ? 'Edit' : 'View'}
                      </button>
                    </div>
                  </td>
                </tr>
                {open === s.id && (
                  <tr><td colSpan={7} className="bg-slate-50 px-10 py-4"><ol className="space-y-2">{s.history.map((h, i) => <li key={i} className="text-xs text-slate-600"><b className="text-slate-800">{h.action}</b> · {h.by} · {dt(h.at)}{h.note && <span className="block text-slate-500">“{h.note}”</span>}</li>)}</ol></td></tr>
                )}
              </React.Fragment>
            ))}
          </Table>
        )}
      </Card>

      {/* Inspect Submission Modal */}
      {selectedSub && (
        <Modal
          title={`Inspect Submission: ${selectedSub.id}`}
          subtitle={`${PRINCIPLES.find((p) => p.id === selectedSub.principle)?.label} · ${periodLabel(selectedSub.period)}`}
          onClose={() => setSelectedSub(null)}
          wide
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Status</span>
                <StatusBadge status={selectedSub.status} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Principle</span>
                <span className="font-bold text-indigo-700">{selectedSub.principle}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Period</span>
                <span className="font-bold text-slate-800">{periodLabel(selectedSub.period)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Project ID</span>
                <span className="font-bold text-slate-800">{selectedSub.projectId}</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-2">Submitted Indicator Values & Evidence</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Indicator Code</th>
                      <th className="p-2.5">Reported Value</th>
                      <th className="p-2.5">Attached Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSub.values && Object.keys(selectedSub.values).length > 0 ? (
                      Object.entries(selectedSub.values).map(([key, val]) => (
                        <tr key={key}>
                          <td className="p-2.5 font-mono font-bold text-slate-800">{key}</td>
                          <td className="p-2.5 font-bold text-indigo-700">{val?.v !== undefined && val?.v !== null ? String(val.v) : '—'}</td>
                          <td className="p-2.5 font-medium text-emerald-600">{val?.ev || 'None'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-3 text-center text-slate-500">
                          Raw packet data: {JSON.stringify(selectedSub.data || selectedSub.values || {})}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedSub(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

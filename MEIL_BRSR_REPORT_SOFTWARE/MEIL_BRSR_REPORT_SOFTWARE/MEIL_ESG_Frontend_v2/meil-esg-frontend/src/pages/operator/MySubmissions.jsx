import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { PRINCIPLES, periodLabel } from '../../data/brsr';
import { StatusBadge, AssuranceBadge, PageHeader, Card, Table, Empty, dt, Badge } from '../../components/ui';

export default function MySubmissions() {
  const { user, calc } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(null);
  const rows = calc.submissions.filter((s) => s.projectId === user.projectId).sort((a, b) => b.period.localeCompare(a.period) || a.principle.localeCompare(b.principle));
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
                  <td className="px-4 py-3 text-right"><button onClick={() => nav(`/operator/data-entry?principle=${s.principle}`)} className="text-xs font-bold text-blue-600">{['draft', 'correction_required', 'rejected'].includes(s.status) ? 'Edit' : 'View'}</button></td>
                </tr>
                {open === s.id && (
                  <tr><td colSpan={7} className="bg-slate-50 px-10 py-4"><ol className="space-y-2">{s.history.map((h, i) => <li key={i} className="text-xs text-slate-600"><b className="text-slate-800">{h.action}</b> · {h.by} · {dt(h.at)}{h.note && <span className="block text-slate-500">“{h.note}”</span>}</li>)}</ol></td></tr>
                )}
              </React.Fragment>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

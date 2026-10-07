import React from 'react';
import { useApp } from '../../store/AppStore';
import { Card, PageHeader, Table, StatusBadge, Empty, dt } from '../../components/ui';
export default function VendorHistory() {
  const { user, state } = useApp();
  const rows = state.vendorRequests.filter((r) => r.vendorId === user.vendorId);
  return (<div className="space-y-6"><PageHeader title="Submission history" subtitle="Every request and reviewer response for your account." />
    <Card pad={false}>{rows.length === 0 ? <Empty title="No history yet" /> : <Table head={['Request', 'Period', 'Status', 'Trail']}>{rows.map((r) => <tr key={r.id}><td className="px-4 py-3 font-bold text-indigo-600 text-xs">{r.id}</td><td className="px-4 py-3">{r.period}</td><td className="px-4 py-3"><StatusBadge status={r.status} /></td><td className="px-4 py-3 text-xs text-slate-600">{r.history.map((h, i) => <div key={i}><b>{h.action}</b> · {h.by} · {dt(h.at)}{h.note && ` — ${h.note}`}</div>)}</td></tr>)}</Table>}</Card></div>);
}

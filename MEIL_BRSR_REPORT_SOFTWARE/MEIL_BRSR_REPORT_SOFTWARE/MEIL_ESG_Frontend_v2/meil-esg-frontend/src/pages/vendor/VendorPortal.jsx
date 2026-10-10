import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ChevronRight, Clock } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { StatusBadge, Card, Btn, dt } from '../../components/ui';

export default function VendorPortal() {
  const { user, state } = useApp(); const nav = useNavigate();
  const v = state.vendors.find((x) => x.id === user?.vendorId || x.code === user?.vendorId || x.id === 'V-103') || state.vendors[0] || { id: user?.vendorId || 'V-103', name: user?.name || 'Global Logistics Corp', category: 'Transportation' };
  const mine = state.vendorRequests.filter((r) => r.vendorId === v.id || r.vendorId === user?.vendorId || (v.code && r.vendorId === v.code) || r.vendorId === 'V-103').sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''));
  const open = mine.filter((r) => ['requested', 'correction_required'].includes(r.status));
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 relative overflow-hidden"><Truck size={220} className="absolute right-0 -top-6 opacity-10" />
        <p className="text-xs font-bold text-indigo-300 mb-2">Vendor / contractor workspace</p><h1 className="text-3xl font-black">{v.name}</h1><p className="text-sm text-slate-400 mt-1">{v.category} · vendor ID {v.id}</p>
        <p className="mt-4 text-sm text-slate-300 max-w-xl">MEIL requests ESG data from its value chain to report Scope 3 emissions and supply-chain safety under SEBI BRSR Core. Submit your figures with supporting bills and logs — our assurance reviewer will verify them.</p></div>
      <Card pad={false}>
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center"><h2 className="text-sm font-bold text-slate-900">Requests from MEIL</h2><span className="text-xs text-slate-500">{open.length} need action</span></div>
        <ul className="divide-y divide-slate-100">{mine.map((r) => (
          <li key={r.id} className="px-5 py-4 flex flex-wrap items-center gap-3"><div className="flex-1 min-w-48"><p className="font-bold text-slate-900">{r.period} ESG data <span className="text-xs font-medium text-slate-400">({r.id})</span></p><p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Clock size={11} /> Due {r.due} · sent {dt(r.sentAt)}</p>{r.status === 'correction_required' && <p className="text-xs text-rose-600 font-semibold mt-1">Reviewer: {r.comment}</p>}</div>
            <StatusBadge status={r.status} />{['requested', 'correction_required'].includes(r.status) ? <Btn tone="indigo" onClick={() => nav(`/vendor/submit?id=${r.id}`)}>{r.status === 'requested' ? 'Start submission' : 'Fix & resubmit'} <ChevronRight size={16} /></Btn> : <Btn tone="ghost" onClick={() => nav('/vendor/history')}>View</Btn>}</li>))}</ul>
      </Card>
    </div>
  );
}

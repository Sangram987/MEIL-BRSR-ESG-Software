import React, { useEffect } from 'react';
import { X, FileText, Download, CheckCircle2, Inbox } from 'lucide-react';

export const inputCls = 'w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed';
export const labelCls = 'block text-xs font-bold text-slate-500 tracking-wide mb-1.5';

export const ICON_TONE = {
  blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600', indigo: 'bg-indigo-50 text-indigo-600',
};

export const Card = ({ children, className = '', pad = true }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${pad ? 'p-5 sm:p-6' : ''} ${className}`}>{children}</div>
);

export const CardHeader = ({ title, subtitle, right, icon: Icon }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200 rounded-t-xl">
    <div className="flex items-center gap-2.5 min-w-0">
      {Icon && <Icon size={18} className="text-slate-500 shrink-0" />}
      <div className="min-w-0">
        <h2 className="text-[0.9rem] font-bold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

export const PageHeader = ({ title, subtitle, actions, badge }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
    <div>
      {badge && <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold mb-2">{badge}</div>}
      <h1 className="text-2xl sm:text-[1.7rem] font-bold text-slate-900 tracking-tight leading-snug">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1.5 max-w-3xl leading-relaxed">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

const TONES = {
  slate: 'bg-slate-100 text-slate-600 border-slate-200', emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200', rose: 'bg-rose-50 text-rose-700 border-rose-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200', sky: 'bg-sky-50 text-sky-700 border-sky-200',
};
export const Badge = ({ tone = 'slate', children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-wide whitespace-nowrap ${TONES[tone]} ${className}`}>{children}</span>
);

export const STATUS = {
  none: ['slate', 'Not started'], draft: ['slate', 'Draft'], submitted: ['amber', 'Awaiting BU review'],
  correction_required: ['rose', 'Correction required'], rejected: ['rose', 'Rejected'], approved: ['emerald', 'Approved'],
  requested: ['amber', 'Awaiting vendor'], accepted: ['emerald', 'Accepted'],
};
export const StatusBadge = ({ status }) => { const [tone, label] = STATUS[status] || STATUS.none; return <Badge tone={tone}>{label}</Badge>; };
export const ASSURANCE = { not_started: ['slate', 'Not yet assured'], in_review: ['blue', 'Assurance in review'], assured: ['emerald', 'Assured'], exception: ['rose', 'Exception raised'] };
export const AssuranceBadge = ({ status }) => { const [tone, label] = ASSURANCE[status] || ASSURANCE.not_started; return <Badge tone={tone}>{label}</Badge>; };

export const Modal = ({ open, onClose, title, subtitle, children, footer, wide }) => {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-5xl' : 'max-w-xl'} max-h-[92vh] flex flex-col overflow-hidden zoom-in animate-in`}>
        <div className="flex justify-between items-start gap-4 p-5 border-b border-slate-200 bg-slate-50">
          <div className="min-w-0"><h2 className="text-base font-bold text-slate-900">{title}</h2>{subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export const Btn = ({ tone = 'primary', className = '', ...p }) => {
  const t = { primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm', dark: 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm', ghost: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300', ok: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm', warn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm', danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm', indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm' }[tone];
  return <button type="button" {...p} className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${t} ${className}`} />;
};

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="flex border-b border-slate-200 mb-6 overflow-x-auto" role="tablist">
    {tabs.map((t) => (
      <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
        className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${value === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
        {t.icon && <t.icon size={16} />}{t.label}
        {t.count != null && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{t.count}</span>}
      </button>
    ))}
  </div>
);

export const Empty = ({ title, text }) => (
  <div className="py-14 text-center text-slate-500"><Inbox className="mx-auto mb-3 text-slate-300" size={36} /><p className="font-bold text-slate-700">{title}</p>{text && <p className="text-sm mt-1">{text}</p>}</div>
);

export const Progress = ({ value, tone = 'emerald', className = '' }) => (
  <div className={`h-2 bg-slate-100 rounded-full overflow-hidden ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <div className={`h-full rounded-full ${{ emerald: 'bg-emerald-500', blue: 'bg-blue-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const Table = ({ head, children, className = '' }) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full text-left text-sm">
      <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wide border-b border-slate-200"><tr>{head.map((h, i) => <th key={i} className={`px-4 py-3 whitespace-nowrap ${h.right ? 'text-right' : ''}`}>{h.label ?? h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100 text-slate-700">{children}</tbody>
    </table>
  </div>
);

// Simulated evidence preview – swap for a signed-URL <iframe>/<img> once file storage exists.
export const EvidenceViewer = ({ doc, onClose }) => (
  <Modal open={!!doc} onClose={onClose} wide title={doc?.name || ''} subtitle={doc ? `Uploaded for ${doc.site}` : ''}
    footer={<><Btn tone="ghost"><Download size={14} /> Download</Btn><Btn tone="dark" onClick={onClose}>Close viewer</Btn></>}>
    {doc && (
      <div className="bg-slate-200 p-4 sm:p-8 rounded-xl flex justify-center">
        <div className="bg-white w-full max-w-2xl shadow-lg border border-slate-200 p-6 sm:p-10">
          <div className="border-b-2 border-slate-200 pb-5 mb-6 flex justify-between items-start gap-4">
            <div><div className="h-9 w-28 bg-slate-100 rounded mb-3 flex items-center justify-center text-slate-400 font-black text-sm">LOGO</div><p className="text-sm font-bold text-slate-800">Source document</p><p className="text-xs text-slate-500">{doc.name}</p></div>
            <div className="text-right"><h3 className="text-2xl font-black text-slate-300">INVOICE / LOG</h3><p className="text-xs text-slate-500 mt-1">{doc.period}</p></div>
          </div>
          <table className="w-full text-sm mb-6"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="pb-2 text-left">Description</th><th className="pb-2 text-right">Quantity</th></tr></thead>
            <tbody><tr><td className="py-3 font-medium text-slate-700">{doc.indicator || 'Recorded metric'}</td><td className="py-3 text-right font-black text-slate-900 text-lg">{doc.value} <span className="text-xs text-slate-500 font-medium">{doc.unit}</span></td></tr></tbody></table>
          <div className="space-y-2 opacity-40 mb-6">{[3 / 4, 1 / 2, 1, 5 / 6].map((w, i) => <div key={i} className="h-3 bg-slate-200 rounded" style={{ width: `${w * 100}%` }} />)}</div>
          <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg text-amber-800 text-xs font-semibold flex items-center gap-2"><CheckCircle2 size={16} /> Placeholder preview — the real uploaded file renders here once the storage API is connected.</div>
        </div>
      </div>
    )}
  </Modal>
);

export const FileChip = ({ name, onClick }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-2 py-0.5 rounded font-bold max-w-[180px]"><FileText size={11} className="shrink-0" /><span className="truncate">{name}</span></button>
);

export const relTime = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime(); const d = Math.floor(diff / 864e5);
  if (d < 1) return 'today'; if (d === 1) return 'yesterday'; if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const dt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');

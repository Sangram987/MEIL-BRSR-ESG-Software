import React from 'react';

export default function StatCard({ 
  title, 
  value, 
  unit, 
  icon: Icon, 
  color = "blue", 
  trend 
}) {
  const THEMES = {
    emerald: {
      bar: 'bg-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      text: 'text-emerald-700',
    },
    sky: {
      bar: 'bg-sky-500',
      iconBg: 'bg-sky-50 text-sky-600 border-sky-100',
      text: 'text-sky-700',
    },
    indigo: {
      bar: 'bg-indigo-500',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      text: 'text-indigo-700',
    },
    amber: {
      bar: 'bg-amber-500',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      text: 'text-amber-700',
    },
    rose: {
      bar: 'bg-rose-500',
      iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
      text: 'text-rose-700',
    },
    blue: {
      bar: 'bg-blue-500',
      iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
      text: 'text-blue-700',
    },
  };

  const current = THEMES[color] || THEMES.blue;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden flex flex-col justify-between h-full transition hover:shadow-md">
      <div className={`absolute top-0 left-0 right-0 h-1 ${current.bar}`} />
      
      <div className="flex justify-between items-start mb-3 pt-1">
        <h3 className="text-slate-500 text-[11px] font-bold uppercase tracking-wider leading-snug">{title}</h3>
        {Icon && (
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border ${current.iconBg}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      
      <div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{value}</p>
          {trend && (
            <span className={`text-xs font-bold ${trend.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend}
            </span>
          )}
        </div>
        {unit && <p className="text-xs font-medium text-slate-500 mt-1 truncate">{unit}</p>}
      </div>
    </div>
  );
}
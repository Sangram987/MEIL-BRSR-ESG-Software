import React from 'react';

export default function StatCard({ 
  title, 
  value, 
  unit, 
  icon: Icon, 
  color = "blue", 
  trend 
}) {
  // Dynamic color mapping for the accent bar and icon
  const colorStyles = {
    blue: "border-l-blue-500 text-blue-600",
    emerald: "border-l-emerald-500 text-emerald-600",
    amber: "border-l-amber-500 text-amber-600",
    rose: "border-l-rose-500 text-rose-600",
    indigo: "border-l-indigo-500 text-indigo-600",
    sky: "border-l-sky-500 text-sky-600"
  };

  const selectedColor = colorStyles[color] || colorStyles.blue;

  return (
    <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between h-full`}>
      {/* Left Accent Line */}
      <div className={`absolute top-0 left-0 w-1 h-full ${selectedColor.split(' ')[0]}`}></div>
      
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
        {Icon && <Icon size={18} className={selectedColor.split(' ')[1]} />}
      </div>
      
      <div>
        <div className="flex items-end gap-2">
          <p className="text-3xl font-black text-slate-900">{value}</p>
          {trend && (
            <span className={`text-sm font-bold mb-1 ${trend.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend}
            </span>
          )}
        </div>
        {unit && <p className="text-xs font-semibold text-slate-400 mt-1">{unit}</p>}
      </div>
    </div>
  );
}
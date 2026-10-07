import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, X, Send, Sparkles, ChevronRight } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { ROLE_META } from '../data/brsr';

// Rule-based guide (no external AI call). Swap answer() for an API call to make it an LLM assistant.
const KB = [
  [/core|assurance/i, 'BRSR Core is the subset of 9 ESG attributes (GHG, water, energy, circularity, safety, gender, inclusive development, fairness, openness) on which SEBI requires third-party assurance. In this portal, site data becomes assurable only after the BU Manager approves it.'],
  [/scope ?1|scope ?2|emission/i, 'Scope 1 = diesel & petrol burned on site; Scope 2 = purchased grid electricity. The portal converts litres/kWh to tCO2e with configurable factors. Enter fuel and electricity quantities with bills attached — never a pre-computed tCO2e.'],
  [/boundary|standalone|consolidated/i, 'BRSR requires you to state whether figures are Standalone or Consolidated and apply it consistently. Use the Consolidated/Standalone switch on the hierarchy filter; entities outside the boundary are greyed out in Consolidation.'],
  [/essential|leadership/i, 'Essential indicators are mandatory for every reporting entity; Leadership indicators are voluntary and go beyond compliance. The Data Entry form separates them with a toggle.'],
  [/workflow|flow|approve|correction/i, 'Flow: Site Operator submits with evidence → BU Manager reviews (Approve / Request correction / Reject) → approved data auto-rolls up Project → BU → Subsidiary → Group → BRSR report. Assurance is a separate step after approval.'],
  [/vendor|scope ?3|value chain/i, 'Vendors receive a request, submit ESG data with evidence, and the assurance reviewer accepts it. Accepted data is allocated to MEIL by revenue share and shows up as Scope 3.'],
  [/sdg|goal/i, 'Every BRSR principle is mapped to UN SDGs (e.g. P6 → SDG 6, 7, 12, 13, 15). See Admin → SDG Alignment.'],
];
const answer = (q) => (KB.find(([re]) => re.test(q)) || [null, 'I can explain BRSR Core, Scope 1/2, reporting boundary, Essential vs Leadership indicators, the approval workflow, vendors/Scope 3 and SDG mapping. Try one of those.'])[1];

export default function Chatbot() {
  const navigate = useNavigate();
  const { user } = useApp();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState([{ from: 'bot', text: 'Hello! I am the BRSR Copilot. Ask me about SEBI BRSR terms or jump to a workspace.' }]);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, open]);
  const send = (e) => { e.preventDefault(); if (!text.trim()) return; setMsgs((m) => [...m, { from: 'me', text }, { from: 'bot', text: answer(text) }]); setText(''); };
  const go = (to) => { setOpen(false); navigate(to); };
  const chips = user ? [[`Open my workspace`, ROLE_META[user.role].home]] : [['Sign in', '/login']];
  if (loc.pathname === '/login') return null;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open BRSR Copilot" className={`no-print fixed bottom-5 right-5 h-14 w-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition z-[8000] ${open ? 'scale-0 opacity-0 pointer-events-none' : ''}`}><MessageSquare size={24} /></button>
      <div className={`no-print fixed bottom-5 right-5 w-[calc(100%-2.5rem)] max-w-[360px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[8000] flex flex-col overflow-hidden transition-all origin-bottom-right ${open ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2"><div className="bg-emerald-500/20 p-1.5 rounded-lg border border-emerald-500/30"><Sparkles size={16} className="text-emerald-400" /></div><div><h3 className="font-bold text-sm leading-tight">BRSR Copilot</h3><p className="text-[10px] text-slate-400">Guided help · rule-based</p></div></div>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-white p-1 rounded-lg"><X size={20} /></button>
        </div>
        <div className="h-[340px] bg-slate-50 p-4 flex flex-col gap-3 overflow-y-auto">
          {msgs.map((m, i) => <div key={i} className={`max-w-[88%] p-3 rounded-2xl text-sm shadow-sm ${m.from === 'me' ? 'self-end bg-slate-900 text-white rounded-br-sm' : 'self-start bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>{m.text}</div>)}
          {chips.map(([l, to]) => <button key={to} onClick={() => go(to)} className="self-start bg-white border border-indigo-100 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl hover:bg-indigo-50 flex items-center gap-2">{l} <ChevronRight size={14} /></button>)}
          <div ref={end} />
        </div>
        <form onSubmit={send} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about BRSR Core, Scope 1, boundary…" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          <button aria-label="Send" className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-slate-800 shrink-0"><Send size={16} /></button>
        </form>
      </div>
    </>
  );
}

import React, { createContext, useContext, useEffect, useMemo, useReducer, useCallback, useState, useRef } from 'react';
import { buildOrg, buildUsers, buildSeed } from '../data/org';
import { createCalc } from '../lib/consolidate';
import { CURRENT_FY, PRINCIPLES, periodLabel, ROLE_META } from '../data/brsr';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import * as authApi from '../services/authApi';
import * as organizationApi from '../services/organizationApi';
import * as submissionApi from '../services/submissionApi';

const KEY = 'meil-esg-store-v3';
const THEME_KEY = 'meil-esg-theme';
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function loadAccounts() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}

async function hashPassword(password, salt) {
  const key = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await window.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 210000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function initialState() {
  const org = buildOrg();
  const users = buildUsers(org);
  const { subs, ...seed } = buildSeed(org, users);
  return {
    session: null,
    org,
    submissions: subs,
    ...seed,
    ui: { fy: CURRENT_FY, scope: { level: 'group', id: 'meil' }, boundary: { mode: 'consolidated', includeJV: false } },
    loading: false,
    error: null,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.org && s.submissions && s.valueChainConfig && s.disclosures?.core8) return s;
    }
  } catch { /* storage unavailable – fall through to seed */ }
  return initialState();
}

const nowIso = () => new Date().toISOString();

const log = (s, user, action, entity, details) => {
  const id = `LOG-${s.counters.log + 1}`;
  return {
    audit: [
      { id, at: nowIso(), user: `${user.name} (${user.role})`, action, entity, details },
      ...s.audit,
    ].slice(0, 400),
    counters: { ...s.counters, log: s.counters.log + 1 },
  };
};
const notify = (s, n) => ({ notifications: [{ id: `N${Date.now()}${Math.floor(Math.random() * 999)}`, at: nowIso(), read: false, ...n }, ...s.notifications].slice(0, 100) });

function reducer(s, a) {
  switch (a.type) {
    case 'login':
      return { ...s, session: { role: a.role, profile: a.profile || null }, error: null };
    case 'logout':
      return { ...s, session: null };
    case 'reset':
      return initialState();
    case 'setLoading':
      return { ...s, loading: a.loading };
    case 'setError':
      return { ...s, error: a.error };
    case 'ui':
      return { ...s, ui: { ...s.ui, ...a.patch } };

    case 'saveSubmission': {
      const { projectId, period, principle, values, submit, actor } = a;
      const idx = s.submissions.findIndex((x) => x.projectId === projectId && x.period === period && x.principle === principle);
      const prev = idx >= 0 ? s.submissions[idx] : null;
      if (prev && (prev.status === 'submitted' || prev.status === 'approved')) return s;
      const project = s.org.projects.find((p) => p.id === projectId);
      const pname = PRINCIPLES.find((p) => p.id === principle).label;
      let status = prev && prev.status === 'correction_required' ? 'correction_required' : prev && prev.status === 'rejected' ? 'rejected' : 'draft';
      let action = 'DRAFT SAVED';
      if (submit) { action = prev && (prev.status === 'correction_required' || prev.status === 'rejected') ? 'RESUBMITTED' : 'SUBMITTED'; status = 'submitted'; }
      let counters = s.counters;
      const rec = prev ? { ...prev } : { id: `SUB-${counters.sub + 1}`, projectId, period, principle, assurance: 'not_started', history: [], reviewer: null };
      if (!prev) counters = { ...counters, sub: counters.sub + 1 };
      Object.assign(rec, { values, status, enteredBy: actor.role, submittedBy: submit ? { name: actor.name, role: actor.role } : rec.submittedBy || null, submittedAt: submit ? nowIso() : rec.submittedAt || null });
      rec.history = [...rec.history, { at: nowIso(), by: actor.name, action, note: '' }];
      const list = idx >= 0 ? s.submissions.map((x, i) => (i === idx ? rec : x)) : [...s.submissions, rec];
      let out = { ...s, submissions: list, counters };
      if (submit) {
        out = { ...out, ...log(out, { name: actor.name, role: actor.role }, action, `${rec.id} · ${project.name} ${principle} (${periodLabel(period)})`, 'Sent to BU verification queue.') };
        out = { ...out, ...notify(out, { role: 'manager', buId: project.buId, text: `${project.name}: ${principle} ${pname} ${action === 'RESUBMITTED' ? 're-submitted' : 'submitted'} for review.`, link: '/manager/approvals' }) };
      }
      return out;
    }

    case 'review': {
      const { id, decision, comment, checklist, actor } = a;
      const rec = s.submissions.find((x) => x.id === id); if (!rec) return s;
      const status = { approve: 'approved', correction: 'correction_required', reject: 'rejected' }[decision];
      const act = { approve: 'APPROVED', correction: 'CORRECTION REQUESTED', reject: 'REJECTED' }[decision];
      const project = s.org.projects.find((p) => p.id === rec.projectId);
      const upd = { ...rec, status, reviewer: { name: actor.name, comment, checklist, at: nowIso() }, history: [...rec.history, { at: nowIso(), by: actor.name, action: act, note: comment }] };
      let out = { ...s, submissions: s.submissions.map((x) => (x.id === id ? upd : x)) };
      out = { ...out, ...log(out, actor, act, `${id} · ${project.name} ${rec.principle}`, comment || 'Checklist complete.') };
      out = { ...out, ...notify(out, { role: 'operator', projectId: rec.projectId, text: `${rec.principle} for ${periodLabel(rec.period)} was ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'sent back for correction'}${comment ? ': ' + comment : '.'}`, link: '/operator/data-entry?principle=' + rec.principle }) };
      if (status === 'approved') out = { ...out, ...notify(out, { role: 'auditor', text: `${project.name} ${rec.principle} approved and ready for assurance sampling.`, link: '/auditor' }) };
      return out;
    }

    case 'setAssurance': {
      const { id, status, note, actor } = a; const rec = s.submissions.find((x) => x.id === id); if (!rec) return s;
      const upd = { ...rec, assurance: status, history: [...rec.history, { at: nowIso(), by: actor.name, action: `ASSURANCE: ${status.toUpperCase().replace('_', ' ')}`, note }] };
      const out = { ...s, submissions: s.submissions.map((x) => (x.id === id ? upd : x)) };
      return { ...out, ...log(out, actor, `ASSURANCE ${status.toUpperCase()}`, `${id} · ${rec.principle}`, note || '') };
    }
    case 'issueOpinion': {
      const { fy, attr, opinion, actor } = a;
      const cur = s.assuranceOpinions[fy] || {};
      const out = { ...s, assuranceOpinions: { ...s.assuranceOpinions, [fy]: { ...cur, [attr]: { ...opinion, by: actor.name, at: nowIso().slice(0, 10) } } } };
      return { ...out, ...log(out, actor, `${opinion.mode === 'assessment' ? 'ASSESSMENT' : 'ASSURANCE'} OPINION`, `${fy} · ${attr}`, opinion.status) };
    }

    case 'addEntity': {
      const { kind, data, actor } = a; const org = { ...s.org };
      if (kind === 'sub') org.subsidiaries = [...org.subsidiaries, { id: `sub-${Date.now()}`, status: 'Active', ...data }];
      if (kind === 'bu') org.bus = [...org.bus, { id: `bu-${Date.now()}`, ...data }];
      if (kind === 'project') {
        const bu = org.bus.find((b) => b.id === data.buId);
        org.projects = [...org.projects, { id: `prj-${Date.now()}`, subId: bu.subId, country: 'India', lat: 20.6 + Math.random() * 3, lng: 78.9 + Math.random() * 3, scale: 1, turnoverCr: +data.turnoverCr || 90, seeded: false, live: true, status: 'Active', ...data }];
      }
      const out = { ...s, org };
      return { ...out, ...log(out, actor, 'ENTITY ADDED', `${kind.toUpperCase()} · ${data.name}`, 'Hierarchy updated.') };
    }

    case 'sendVendorRequests': {
      const { vendorIds, period, due, message, actor } = a; let c = s.counters.vr; const reqs = [];
      vendorIds.forEach((vendorId) => { reqs.push({ id: `VR-${++c}`, vendorId, period, due, status: 'requested', values: {}, evidence: {}, sentAt: nowIso(), comment: message, history: [{ at: nowIso(), by: actor.name, action: 'REQUESTED', note: message }] }); });
      let out = { ...s, vendorRequests: [...reqs, ...s.vendorRequests], counters: { ...s.counters, vr: c } };
      reqs.forEach((r) => { out = { ...out, ...notify(out, { role: 'vendor', vendorId: r.vendorId, text: `MEIL requested your ${period} ESG data. Due ${r.due}.`, link: '/vendor/submit' }) }; });
      return { ...out, ...log(out, actor, 'VENDOR REQUEST', `${reqs.length} vendor(s)`, `${period}, due ${due}`) };
    }
    case 'submitVendor': {
      const { id, values, evidence, actor } = a; const r = s.vendorRequests.find((x) => x.id === id); if (!r) return s;
      const upd = { ...r, values, evidence, status: 'submitted', history: [...r.history, { at: nowIso(), by: actor.name, action: 'SUBMITTED', note: '' }] };
      let out = { ...s, vendorRequests: s.vendorRequests.map((x) => (x.id === id ? upd : x)) };
      out = { ...out, ...log(out, actor, 'VENDOR SUBMITTED', `${id} · ${r.vendorId}`, r.period) };
      return { ...out, ...notify(out, { role: 'auditor', text: `${s.vendors.find((v) => v.id === r.vendorId)?.name} submitted ${r.period} ESG data for review.`, link: '/auditor?tab=vendors' }) };
    }
    case 'reviewVendor': {
      const { id, decision, comment, actor } = a; const r = s.vendorRequests.find((x) => x.id === id); if (!r) return s;
      const status = decision === 'accept' ? 'accepted' : 'correction_required';
      const upd = { ...r, status, comment, history: [...r.history, { at: nowIso(), by: actor.name, action: decision === 'accept' ? 'ACCEPTED' : 'CORRECTION REQUESTED', note: comment }] };
      let out = { ...s, vendorRequests: s.vendorRequests.map((x) => (x.id === id ? upd : x)) };
      out = { ...out, ...log(out, actor, upd.history.at(-1).action, `${id} · ${r.vendorId}`, comment || '') };
      return { ...out, ...notify(out, { role: 'vendor', vendorId: r.vendorId, text: decision === 'accept' ? `Your ${r.period} ESG data was accepted.` : `Correction requested on ${r.period}: ${comment}`, link: '/vendor/submit' }) };
    }
    case 'updateSub': { const out = { ...s, org: { ...s.org, subsidiaries: s.org.subsidiaries.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)) } }; return { ...out, ...log(out, a.actor, 'BOUNDARY UPDATED', a.id, JSON.stringify(a.patch)) }; }
    case 'addVendor': return { ...s, vendors: [...s.vendors, { id: `V-${100 + s.vendors.length + 1}`, safety: 'Compliant', score: 0, scope3: 0, ...a.data }] };

    case 'saveRisk': {
      const exists = s.risks.some((r) => r.id === a.risk.id);
      if (exists) return { ...s, risks: s.risks.map((r) => (r.id === a.risk.id ? a.risk : r)) };
      const c = s.counters.risk + 1;
      return { ...s, risks: [...s.risks, { ...a.risk, id: `RSK-${String(c).padStart(2, '0')}` }], counters: { ...s.counters, risk: c } };
    }
    case 'saveDisclosures': return { ...s, disclosures: { ...s.disclosures, [a.section]: a.data } };
    case 'setValueChainConfig': return { ...s, valueChainConfig: { ...s.valueChainConfig, ...a.patch } };
    case 'setReportConfig': return { ...s, reportConfig: { ...s.reportConfig, ...a.patch } };
    case 'markRead': return { ...s, notifications: s.notifications.map((n) => (n.role === a.role ? { ...n, read: true } : n)) };
    case 'remind': {
      const out = { ...s, ...notify(s, { role: 'operator', projectId: a.projectId, text: `Reminder from BU Manager: ${a.text}`, link: '/operator' }) };
      return { ...out, ...log(out, a.actor, 'REMINDER SENT', a.entity, a.text) };
    }
    default: return s;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [toasts, setToasts] = useState([]);
  const tid = useRef(0);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const session = sessionStorage.getItem('currentUser');
    if (session) {
      try {
        const user = JSON.parse(session);
        dispatch({ type: 'login', role: user.role, profile: user });
      } catch { /* invalid session */ }
    }
  }, []);

  // Persist UI state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch { /* quota / private mode – ignore */ }
  }, [state]);

  const users = useMemo(() => buildUsers(state.org), [state.org]);
  const user = useMemo(
    () =>
      state.session
        ? { ...users[state.session.role], ...state.session.profile, role: state.session.role }
        : null,
    [state.session, users]
  );
  const calc = useMemo(() => createCalc(state.org, state.submissions), [state.org, state.submissions]);

  const auth = useMemo(
    () => ({
      login: async ({ email, password, role }) => {
        try {
          dispatch({ type: 'setLoading', loading: true });
          const { accessToken, user: backendUser } = await authApi.authApi.login(email, password, role);

          // Store token
          sessionStorage.setItem('accessToken', accessToken);

          // Store user info for quick access
          const profile = {
            ...backendUser,
            firstName: backendUser.profile?.firstName,
            lastName: backendUser.profile?.lastName,
          };
          sessionStorage.setItem('currentUser', JSON.stringify({ ...profile, role: backendUser.role, roles: backendUser.roles }));

          // Dispatch login
          dispatch({ type: 'login', role: backendUser.role, profile });
          dispatch({ type: 'setLoading', loading: false });
        } catch (error) {
          dispatch({ type: 'setLoading', loading: false });
          dispatch({ type: 'setError', error: error.message });
          throw error;
        }
      },
      register: async ({ name, email, password, role }) => {
        try {
          dispatch({ type: 'setLoading', loading: true });
          const [firstName = '', lastName = ''] = name.split(' ');
          const { accessToken, user: backendUser } = await authApi.authApi.register(
            email,
            password,
            firstName,
            lastName,
            role
          );

          // Store token
          sessionStorage.setItem('accessToken', accessToken);

          // Store user info
          const profile = {
            id: backendUser.id,
            email: backendUser.email,
            name: backendUser.name,
            firstName: backendUser.profile?.firstName,
            lastName: backendUser.profile?.lastName,
          };
          sessionStorage.setItem('currentUser', JSON.stringify({ ...profile, role: backendUser.role, roles: backendUser.roles }));

          // Dispatch login
          dispatch({ type: 'login', role: backendUser.role, profile });
          dispatch({ type: 'setLoading', loading: false });
        } catch (error) {
          dispatch({ type: 'setLoading', loading: false });
          dispatch({ type: 'setError', error: error.message });
          throw error;
        }
      },
      logout: async () => {
        try {
          await authApi.authApi.logout();
        } finally {
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('currentUser');
          dispatch({ type: 'logout' });
        }
      },
    }),
    []
  );

  const toast = useCallback((text, type = 'success') => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const actions = useMemo(
    () => ({
      login: (role) => dispatch({ type: 'login', role }),
      logout: () => dispatch({ type: 'logout' }),
      reset: () => {
        dispatch({ type: 'reset' });
      },
      setFY: (fy) => dispatch({ type: 'ui', patch: { fy } }),
      setScope: (scope) => dispatch({ type: 'ui', patch: { scope } }),
      setBoundary: (boundary) => dispatch({ type: 'ui', patch: { boundary } }),
      saveSubmission: (p) => dispatch({ type: 'saveSubmission', ...p }),
      review: (p) => dispatch({ type: 'review', ...p }),
      setAssurance: (p) => dispatch({ type: 'setAssurance', ...p }),
      issueOpinion: (p) => dispatch({ type: 'issueOpinion', ...p }),
      addEntity: (p) => dispatch({ type: 'addEntity', ...p }),
      sendVendorRequests: (p) => dispatch({ type: 'sendVendorRequests', ...p }),
      submitVendor: (p) => dispatch({ type: 'submitVendor', ...p }),
      reviewVendor: (p) => dispatch({ type: 'reviewVendor', ...p }),
      updateSub: (p) => dispatch({ type: 'updateSub', ...p }),
      addVendor: (data) => dispatch({ type: 'addVendor', data }),
      saveRisk: (risk) => dispatch({ type: 'saveRisk', risk }),
      saveDisclosures: (section, data) => dispatch({ type: 'saveDisclosures', section, data }),
      setValueChainConfig: (patch) => dispatch({ type: 'setValueChainConfig', patch }),
      setReportConfig: (patch) => dispatch({ type: 'setReportConfig', patch }),
      markRead: (role) => dispatch({ type: 'markRead', role }),
      remind: (p) => dispatch({ type: 'remind', ...p }),
    }),
    []
  );

  const value = useMemo(
    () => ({ state, user, users, calc, actions, auth, toast, org: state.org, ui: state.ui }),
    [state, user, users, calc, actions, auth, toast]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="fixed top-4 right-4 z-[10000] space-y-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-in slide-in-from-top-4 flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold ${t.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
          >
            {t.type === 'error' ? (
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            )}
            <span className="flex-1">{t.text}</span>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

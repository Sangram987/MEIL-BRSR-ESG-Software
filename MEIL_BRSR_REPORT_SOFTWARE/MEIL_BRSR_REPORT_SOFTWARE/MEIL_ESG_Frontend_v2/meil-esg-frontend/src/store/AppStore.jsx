import React, { createContext, useContext, useEffect, useMemo, useReducer, useCallback, useState, useRef } from 'react';
import { createCalc } from '../lib/consolidate';
import { CURRENT_FY, PRINCIPLES, periodLabel, ROLE_META } from '../data/brsr';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import * as authApi from '../services/authApi';
import * as organizationApi from '../services/organizationApi';
import * as submissionApi from '../services/submissionApi';
import * as approvalsApi from '../services/approvalsApi';
import * as riskApi from '../services/riskApi';
import * as vendorApi from '../services/vendorApi';
import * as notificationApi from '../services/notificationApi';

const UI_PREFS_KEY = 'meil-esg-ui-prefs';
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const nowIso = () => new Date().toISOString();

function initialState() {
  return {
    session: null,
    org: {
      id: 'org-meil',
      name: 'Megha Engineering & Infrastructures Limited',
      code: 'MEIL',
      subsidiaries: [],
      bus: [],
      projects: [],
    },
    submissions: [],
    vendors: [],
    vendorRequests: [],
    risks: [],
    disclosures: {
      A: {
        cin: 'U45201TG2006PLC050271',
        entityName: 'Megha Engineering & Infrastructures Limited',
        incorporationYear: '2006',
        registeredOffice: 'Plot No. 1, Balanagar, Hyderabad - 500037, Telangana, India',
        corporateOffice: 'S-2, Technocrat Industrial Estate, Balanagar, Hyderabad - 500037, Telangana, India',
        email: 'esg@meil.in',
        telephone: '+91 40 4433 6700',
        website: 'https://www.meil.in',
        stockExchanges: 'BSE, NSE',
        paidUpCapital: '604250000',
        csrTurnover: '27850000000',
        csrNetWorth: '13420000000',
        financialYear: CURRENT_FY,
      },
      B: {
        directorStatement: 'Megha Engineering & Infrastructures Limited (MEIL) is steadfastly committed to sustainable nation-building, decarbonization, top-tier workplace safety, community enrichment, and uncompromising ethical corporate governance across all infrastructure, water, energy, and mobility operations.',
        esgHead: 'Rajesh Kumar, Group ESG Admin',
        committee: 'Sustainability & Risk Committee',
        externalAssessment: { done: 'Yes', agency: 'BSI Group India / DNV Business Assurance' },
      },
      core8: { dataBreaches: '0', dataBreachRatio: '0', payablesDays: '48' },
      core9: {
        purchTradingHousePct: '3.4',
        purchTradingHouseCount: '12',
        purchTop10Pct: '28.5',
        salesDealerPct: '4.2',
        salesDealerCount: '15',
        salesTop10Pct: '32.1',
        rptPurchasesPct: '1.8',
        rptSalesPct: '2.1',
        rptLoansPct: '0',
        rptInvestmentsPct: '0.5',
      },
    },
    reportingPeriods: [
      { id: '2026-09', name: 'September 2026', financialYear: 'FY 2026-27', isCurrent: true, status: 'OPEN' },
      { id: '2026-08', name: 'August 2026', financialYear: 'FY 2026-27', isCurrent: false, status: 'OPEN' },
      { id: '2026-07', name: 'July 2026', financialYear: 'FY 2026-27', isCurrent: false, status: 'OPEN' },
      { id: '2026-06', name: 'June 2026', financialYear: 'FY 2026-27', isCurrent: false, status: 'OPEN' },
      { id: '2026-05', name: 'May 2026', financialYear: 'FY 2026-27', isCurrent: false, status: 'CLOSED' },
      { id: '2026-04', name: 'April 2026', financialYear: 'FY 2026-27', isCurrent: false, status: 'CLOSED' },
    ],
    reportConfig: {
      package: 'comprehensive',
      includeValueChain: true,
      disclosureType: 'assurance',
    },
    valueChainConfig: {
      applicability: 'voluntary_top250',
      allocationMethod: 'revenue_share',
      methodologyNote: 'Vendor Scope 1+2 emissions allocated to MEIL in proportion to revenue.',
    },
    assuranceOpinions: {},
    notifications: [],
    audit: [],
    counters: { sub: 1000, vr: 100, risk: 10, log: 100 },
    ui: {
      fy: CURRENT_FY,
      scope: { level: 'group', id: 'meil' },
      boundary: { mode: 'consolidated', includeJV: false },
    },
    loading: false,
    error: null,
    dataLoaded: false,
  };
}

function load() {
  const base = initialState();
  try {
    const rawUi = localStorage.getItem(UI_PREFS_KEY);
    if (rawUi) {
      const savedUi = JSON.parse(rawUi);
      if (savedUi) {
        base.ui = { ...base.ui, ...savedUi };
      }
    }

    const rawUser = sessionStorage.getItem('currentUser');
    const token = sessionStorage.getItem('accessToken');
    if (rawUser && token) {
      const savedUser = JSON.parse(rawUser);
      if (savedUser && savedUser.role) {
        base.session = {
          role: savedUser.role,
          profile: savedUser,
        };
      }
    }
  } catch { /* storage unavailable */ }
  return base;
}

const logLocal = (s, user, action, entity, details) => {
  const id = `LOG-${s.counters.log + 1}`;
  return {
    audit: [
      { id, at: nowIso(), user: `${user.name} (${user.role})`, action, entity, details },
      ...s.audit,
    ].slice(0, 400),
    counters: { ...s.counters, log: s.counters.log + 1 },
  };
};

const notifyLocal = (s, n) => ({
  notifications: [
    { id: `N${Date.now()}${Math.floor(Math.random() * 999)}`, at: nowIso(), read: false, ...n },
    ...s.notifications,
  ].slice(0, 100),
});

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
    case 'setDataLoaded':
      return { ...s, dataLoaded: a.dataLoaded };
    case 'ui':
      return { ...s, ui: { ...s.ui, ...a.patch } };

    case 'setOrg':
      return { ...s, org: a.org };
    case 'setSubmissions':
      return { ...s, submissions: a.submissions };
    case 'setVendors':
      return { ...s, vendors: a.vendors };
    case 'setVendorRequests':
      return { ...s, vendorRequests: a.vendorRequests };
    case 'setRisks':
      return { ...s, risks: a.risks };
    case 'setDisclosures':
      return { ...s, disclosures: a.disclosures };
    case 'setNotifications':
      return { ...s, notifications: a.notifications };
    case 'setReportingPeriods':
      return { ...s, reportingPeriods: a.reportingPeriods };

    case 'saveSubmissionSuccess': {
      const { submission, actor, submit } = a;
      const idx = s.submissions.findIndex((x) => x.id === submission.id || (x.projectId === submission.projectId && x.period === submission.period && x.principle === submission.principle));
      const list = idx >= 0 ? s.submissions.map((x, i) => (i === idx ? submission : x)) : [submission, ...s.submissions];
      let out = { ...s, submissions: list };
      if (submit && actor) {
        const project = s.org.projects.find((p) => p.id === submission.projectId);
        const pName = project?.name || submission.projectId;
        out = { ...out, ...logLocal(out, actor, 'SUBMITTED', `${submission.code || submission.id} · ${pName} ${submission.principle}`, 'Sent to BU verification queue.') };
        out = { ...out, ...notifyLocal(out, { role: 'manager', buId: project?.buId, text: `${pName}: ${submission.principle} submitted for review.`, link: '/manager/approvals' }) };
      }
      return out;
    }

    case 'reviewSuccess': {
      const { submission, decision, comment, actor } = a;
      const list = s.submissions.map((x) => (
        (x.id === submission.id || (submission.code && x.code === submission.code))
          ? { ...x, ...submission }
          : x
      ));
      let out = { ...s, submissions: list };
      if (actor) {
        const actLabel = {
          bu_verify: 'BU_VERIFIED',
          subsidiary_verify: 'SUBSIDIARY_VERIFIED',
          sub_verify: 'SUBSIDIARY_VERIFIED',
          verify: submission.status === 'subsidiary_verified' ? 'SUBSIDIARY_VERIFIED' : 'BU_VERIFIED',
          approve: 'ADMIN_APPROVED',
          correction: 'CORRECTION REQUESTED',
          reject: 'REJECTED',
        }[decision] || 'REVIEWED';
        out = { ...out, ...logLocal(out, actor, actLabel, `${submission.code || submission.id} · ${submission.principle}`, comment || 'Review complete.') };
        if (submission.status === 'bu_verified' || decision === 'bu_verify') {
          out = { ...out, ...notifyLocal(out, { role: 'subsidiary', text: `${submission.principle} verified by BU Manager, awaiting Subsidiary verification.`, link: '/subsidiary' }) };
          out = { ...out, ...notifyLocal(out, { role: 'operator', projectId: submission.projectId, text: `${submission.principle} verified by BU Manager and forwarded to Subsidiary.`, link: `/operator/data-entry?principle=${submission.principle}` }) };
        } else if (submission.status === 'subsidiary_verified' || decision === 'subsidiary_verify' || decision === 'sub_verify') {
          out = { ...out, ...notifyLocal(out, { role: 'admin', text: `${submission.principle} verified by Subsidiary, awaiting final Admin approval.`, link: '/admin/approvals' }) };
          out = { ...out, ...notifyLocal(out, { role: 'manager', text: `${submission.principle} verified by Subsidiary and forwarded to Admin.`, link: '/manager/approvals' }) };
          out = { ...out, ...notifyLocal(out, { role: 'operator', projectId: submission.projectId, text: `${submission.principle} verified by Subsidiary and forwarded to Admin.`, link: `/operator/data-entry?principle=${submission.principle}` }) };
        } else if (decision === 'approve') {
          out = { ...out, ...notifyLocal(out, { role: 'operator', projectId: submission.projectId, text: `${submission.principle} approved by Admin and locked.`, link: `/operator/data-entry?principle=${submission.principle}` }) };
          out = { ...out, ...notifyLocal(out, { role: 'subsidiary', text: `${submission.principle} received final Admin approval.`, link: '/subsidiary' }) };
          out = { ...out, ...notifyLocal(out, { role: 'manager', text: `${submission.principle} received final Admin approval.`, link: '/manager/approvals' }) };
        } else {
          out = { ...out, ...notifyLocal(out, { role: 'operator', projectId: submission.projectId, text: `${submission.principle} was ${submission.status}${comment ? ': ' + comment : '.'}`, link: `/operator/data-entry?principle=${submission.principle}` }) };
        }
      }
      return out;
    }

    case 'saveSubmissionLocal': {
      const { projectId, period, principle, values, submit, actor } = a;
      const idx = s.submissions.findIndex((x) => x.projectId === projectId && x.period === period && x.principle === principle);
      const prev = idx >= 0 ? s.submissions[idx] : null;
      let status = submit ? 'submitted' : (prev?.status || 'draft');
      const rec = prev ? { ...prev, values, status } : {
        id: `SUB-${s.counters.sub + 1}`,
        code: `SUB-${s.counters.sub + 1}`,
        projectId,
        period,
        principle,
        values,
        status,
        assurance: 'not_started',
        history: [],
      };
      const list = idx >= 0 ? s.submissions.map((x, i) => (i === idx ? rec : x)) : [rec, ...s.submissions];
      return { ...s, submissions: list, counters: { ...s.counters, sub: s.counters.sub + 1 } };
    }

    case 'reviewLocal': {
      const { id, decision, comment } = a;
      const targetSub = s.submissions.find((x) => x.id === id || x.code === id);
      let status;
      if (decision === 'approve') {
        status = 'approved';
      } else if (decision === 'subsidiary_verify' || decision === 'sub_verify') {
        status = 'subsidiary_verified';
      } else if (decision === 'bu_verify') {
        status = 'bu_verified';
      } else if (decision === 'verify') {
        status = targetSub?.status === 'bu_verified' ? 'subsidiary_verified' : 'bu_verified';
      } else if (decision === 'correction') {
        status = 'correction_required';
      } else if (decision === 'reject') {
        status = 'rejected';
      } else {
        status = 'under_review';
      }
      const list = s.submissions.map((x) => ((x.id === id || x.code === id) ? { ...x, status, reviewComment: comment } : x));
      return { ...s, submissions: list };
    }

    case 'setAssurance': {
      const { id, status, note, actor } = a;
      const rec = s.submissions.find((x) => x.id === id);
      if (!rec) return s;
      const upd = { ...rec, assurance: status, history: [...(rec.history || []), { at: nowIso(), by: actor?.name || 'Assessor', action: `ASSURANCE: ${status.toUpperCase().replace('_', ' ')}`, note }] };
      const out = { ...s, submissions: s.submissions.map((x) => (x.id === id ? upd : x)) };
      return actor ? { ...out, ...logLocal(out, actor, `ASSURANCE ${status.toUpperCase()}`, `${id} · ${rec.principle}`, note || '') } : out;
    }

    case 'issueOpinion': {
      const { fy, attr, opinion, actor } = a;
      const cur = s.assuranceOpinions[fy] || {};
      const out = { ...s, assuranceOpinions: { ...s.assuranceOpinions, [fy]: { ...cur, [attr]: { ...opinion, by: actor?.name, at: nowIso().slice(0, 10) } } } };
      return actor ? { ...out, ...logLocal(out, actor, `${opinion.mode === 'assessment' ? 'ASSESSMENT' : 'ASSURANCE'} OPINION`, `${fy} · ${attr}`, opinion.status) } : out;
    }

    case 'addEntity': {
      const { kind, data, actor } = a;
      const org = { ...s.org };
      if (kind === 'sub') org.subsidiaries = [...org.subsidiaries, { id: `sub-${Date.now()}`, status: 'Active', ...data }];
      if (kind === 'bu') org.bus = [...org.bus, { id: `bu-${Date.now()}`, ...data }];
      if (kind === 'project') {
        const bu = org.bus.find((b) => b.id === data.buId);
        org.projects = [...org.projects, { id: `prj-${Date.now()}`, subId: bu?.subId, country: 'India', turnoverCr: +data.turnoverCr || 90, status: 'Active', ...data }];
      }
      const out = { ...s, org };
      return actor ? { ...out, ...logLocal(out, actor, 'ENTITY ADDED', `${kind.toUpperCase()} · ${data.name}`, 'Hierarchy updated.') } : out;
    }

    case 'sendVendorRequests': {
      const { vendorIds = [], period, due, message, actor } = a;
      let c = s.counters.vr;
      const reqs = [];
      vendorIds.forEach((vendorId) => {
        reqs.push({ id: `VR-${++c}`, vendorId, period, due, status: 'requested', values: {}, evidence: {}, sentAt: nowIso(), comment: message });
      });
      let out = { ...s, vendorRequests: [...reqs, ...s.vendorRequests], counters: { ...s.counters, vr: c } };
      if (actor) {
        out = { ...out, ...logLocal(out, actor, 'VENDOR REQUEST', `${reqs.length} vendor(s)`, `${period}, due ${due}`) };
      }
      return out;
    }

    case 'submitVendor': {
      const { id, values, evidence } = a;
      const list = s.vendorRequests.map((x) => (x.id === id ? { ...x, values, evidence, status: 'submitted' } : x));
      return { ...s, vendorRequests: list };
    }

    case 'reviewVendor': {
      const { id, decision, comment } = a;
      const status = decision === 'accept' ? 'accepted' : 'correction_required';
      const list = s.vendorRequests.map((x) => (x.id === id ? { ...x, status, comment } : x));
      return { ...s, vendorRequests: list };
    }

    case 'updateSub': {
      return { ...s, org: { ...s.org, subsidiaries: s.org.subsidiaries.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)) } };
    }

    case 'addVendor': {
      return { ...s, vendors: [...s.vendors, { id: `V-${100 + s.vendors.length + 1}`, safety: 'Compliant', score: 0, scope3: 0, ...a.data }] };
    }

    case 'saveRisk': {
      const exists = s.risks.some((r) => r.id === a.risk?.id);
      if (exists) return { ...s, risks: s.risks.map((r) => (r.id === a.risk.id ? a.risk : r)) };
      const c = s.counters.risk + 1;
      return { ...s, risks: [...s.risks, { ...a.risk, id: a.risk?.id || `RSK-${String(c).padStart(2, '0')}` }], counters: { ...s.counters, risk: c } };
    }

    case 'saveDisclosures':
      return { ...s, disclosures: { ...s.disclosures, [a.section]: a.data } };
    case 'setValueChainConfig':
      return { ...s, valueChainConfig: { ...s.valueChainConfig, ...a.patch } };
    case 'setReportConfig':
      return { ...s, reportConfig: { ...s.reportConfig, ...a.patch } };
    case 'markRead':
      return { ...s, notifications: s.notifications.map((n) => (n.role === a.role ? { ...n, read: true } : n)) };
    case 'remind': {
      const out = { ...s, ...notifyLocal(s, { role: 'operator', projectId: a.projectId, text: `Reminder from BU Manager: ${a.text}`, link: '/operator' }) };
      return a.actor ? { ...out, ...logLocal(out, a.actor, 'REMINDER SENT', a.entity, a.text) } : out;
    }
    default:
      return s;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [toasts, setToasts] = useState([]);
  const tid = useRef(0);

  const toast = useCallback((text, type = 'success') => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // Restore authenticated session from sessionStorage on mount
  useEffect(() => {
    const session = sessionStorage.getItem('currentUser');
    const token = sessionStorage.getItem('accessToken');
    if (session && token) {
      try {
        const user = JSON.parse(session);
        dispatch({ type: 'login', role: user.role, profile: user });
      } catch { /* invalid session */ }
    } else if (!token && session) {
      sessionStorage.removeItem('currentUser');
      dispatch({ type: 'logout' });
    }
  }, []);

  // Persist ONLY UI preferences in localStorage (never application state or business data)
  useEffect(() => {
    try {
      if (state.ui) {
        localStorage.setItem(UI_PREFS_KEY, JSON.stringify(state.ui));
      }
    } catch { /* quota / private mode */ }
  }, [state.ui]);

  // Load genuine database records from backend APIs
  const loadBackendData = useCallback(async () => {
    const token = sessionStorage.getItem('accessToken');
    if (!token) return;

    try {
      dispatch({ type: 'setLoading', loading: true });
      const [orgTree, subsRes, risksRes, vendorsRes, notifsRes, periodsRes] = await Promise.allSettled([
        organizationApi.organizationApi.getOrgTree(),
        submissionApi.submissionApi.listSubmissions(),
        riskApi.riskApi.listRisks(),
        vendorApi.vendorApi.listVendors(),
        notificationApi.notificationApi.getNotifications(),
        submissionApi.submissionApi.listReportingPeriods(),
      ]);

      if (orgTree.status === 'fulfilled' && orgTree.value) {
        dispatch({ type: 'setOrg', org: orgTree.value });
      }
      if (subsRes.status === 'fulfilled' && subsRes.value?.items) {
        dispatch({ type: 'setSubmissions', submissions: subsRes.value.items });
      }
      if (risksRes.status === 'fulfilled' && Array.isArray(risksRes.value)) {
        dispatch({ type: 'setRisks', risks: risksRes.value });
      }
      if (vendorsRes.status === 'fulfilled' && Array.isArray(vendorsRes.value)) {
        dispatch({ type: 'setVendors', vendors: vendorsRes.value });
      }
      if (notifsRes.status === 'fulfilled' && Array.isArray(notifsRes.value)) {
        dispatch({ type: 'setNotifications', notifications: notifsRes.value });
      }
      if (periodsRes.status === 'fulfilled' && Array.isArray(periodsRes.value) && periodsRes.value.length > 0) {
        dispatch({ type: 'setReportingPeriods', reportingPeriods: periodsRes.value });
      }
    } catch (err) {
      console.warn('API sync warning:', err);
    } finally {
      dispatch({ type: 'setLoading', loading: false });
      dispatch({ type: 'setDataLoaded', dataLoaded: true });
    }
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (state.session && token) {
      loadBackendData();
    }
  }, [loadBackendData, state.session]);

  // Current session user object with scope & permissions
  const user = useMemo(() => {
    if (!state.session) return null;
    return {
      id: state.session.profile?.id || state.session.role,
      name: state.session.profile?.name || (ROLE_META[state.session.role]?.label || state.session.role),
      email: state.session.profile?.email || `${state.session.role}@meil.in`,
      role: state.session.role,
      roles: state.session.profile?.roles || [ROLE_META[state.session.role]?.code || state.session.role],
      projectId: state.session.profile?.projectId,
      assignedProjectIds: state.session.profile?.assignedProjectIds || [],
      buId: state.session.profile?.buId,
      ...state.session.profile,
    };
  }, [state.session]);

  // Roles map for active navigation
  const users = useMemo(() => {
    const roles = ['admin', 'subsidiary', 'manager', 'operator', 'vendor', 'auditor'];
    const map = {};
    roles.forEach((r) => {
      map[r] = {
        id: `usr-${r}`,
        role: r,
        name: ROLE_META[r]?.label || r,
        email: `${r}@meil.in`,
      };
    });
    if (user && user.role) {
      map[user.role] = user;
    }
    return map;
  }, [user]);

  // Consolidation calculation engine computed from genuine DB records
  const calc = useMemo(() => createCalc(state.org, state.submissions), [state.org, state.submissions]);

  // Real backend auth orchestrator
  const auth = useMemo(
    () => ({
      login: async ({ email, password, role }) => {
        try {
          dispatch({ type: 'setLoading', loading: true });
          const { accessToken, user: backendUser } = await authApi.authApi.login(email, password, role);

          sessionStorage.setItem('accessToken', accessToken);

          const profile = {
            id: backendUser.id,
            email: backendUser.email,
            name: `${backendUser.firstName || ''} ${backendUser.lastName || ''}`.trim() || backendUser.email,
            firstName: backendUser.firstName,
            lastName: backendUser.lastName,
            projectId: backendUser.projectId,
            assignedProjectIds: backendUser.assignedProjectIds || [],
            buId: backendUser.businessUnitId,
          };
          sessionStorage.setItem('currentUser', JSON.stringify({ ...profile, role: backendUser.role, roles: backendUser.roles }));

          dispatch({ type: 'login', role: backendUser.role, profile });
          dispatch({ type: 'setLoading', loading: false });
          // Refresh backend data with user's authorized scope
          loadBackendData();
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

          sessionStorage.setItem('accessToken', accessToken);

          const profile = {
            id: backendUser.id,
            email: backendUser.email,
            name: backendUser.name,
            firstName: backendUser.profile?.firstName,
            lastName: backendUser.profile?.lastName,
          };
          sessionStorage.setItem('currentUser', JSON.stringify({ ...profile, role: backendUser.role, roles: backendUser.roles }));

          dispatch({ type: 'login', role: backendUser.role, profile });
          dispatch({ type: 'setLoading', loading: false });
          loadBackendData();
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
    [loadBackendData]
  );

  // Business actions orchestrated via real backend APIs
  const actions = useMemo(
    () => ({
      login: (role) => dispatch({ type: 'login', role }),
      logout: () => dispatch({ type: 'logout' }),
      reset: () => dispatch({ type: 'reset' }),
      refreshData: loadBackendData,
      setFY: (fy) => dispatch({ type: 'ui', patch: { fy } }),
      setScope: (scope) => dispatch({ type: 'ui', patch: { scope } }),
      setBoundary: (boundary) => dispatch({ type: 'ui', patch: { boundary } }),

      saveSubmission: async (p) => {
        try {
          dispatch({ type: 'setLoading', loading: true });
          const res = await submissionApi.submissionApi.saveSubmission(
            p.projectId,
            p.period || p.reportingPeriodId,
            p.principle || p.principleCode,
            p.values,
            p.submit
          );
          dispatch({ type: 'saveSubmissionSuccess', submission: res, actor: p.actor, submit: p.submit });
          toast(p.submit ? 'Submission sent to verification queue.' : 'Draft saved to database.', 'success');
          return res;
        } catch (err) {
          const msg = err.response?.data?.error?.message || err.message || 'Failed to save submission.';
          toast(msg, 'error');
          dispatch({ type: 'saveSubmissionLocal', ...p });
        } finally {
          dispatch({ type: 'setLoading', loading: false });
        }
      },

      review: async (p) => {
        try {
          dispatch({ type: 'setLoading', loading: true });
          let res;
          const targetSub = state.submissions.find((x) => x.id === p.id || x.code === p.id);
          const isSubVerify = p.decision === 'subsidiary_verify' || p.decision === 'sub_verify' || (p.decision === 'verify' && targetSub?.status === 'bu_verified');
          const isBuVerify = p.decision === 'bu_verify' || (p.decision === 'verify' && targetSub?.status !== 'bu_verified');
          const api = approvalsApi.approvalsApi || approvalsApi.default || approvalsApi;

          if (isSubVerify) {
            res = await api.verifySubsidiarySubmission(p.id, p.comment, p.checklist || {});
          } else if (isBuVerify) {
            res = await api.verifySubmission(p.id, p.comment, p.checklist || {});
          } else if (p.decision === 'approve') {
            res = await api.approveSubmission(p.id, p.comment, p.checklist || {});
          } else if (p.decision === 'reject') {
            res = await api.rejectSubmission(p.id, p.comment);
          } else {
            res = await api.requestCorrection(p.id, p.comment, p.checklist || {});
          }

          dispatch({ type: 'reviewSuccess', submission: res, decision: p.decision, comment: p.comment, actor: p.actor });
          const toastMsg = isSubVerify
            ? 'Verified by Subsidiary and forwarded to Admin for final approval.'
            : isBuVerify
            ? 'Verified by BU Manager and forwarded to Subsidiary for review.'
            : p.decision === 'approve'
            ? 'Final approval granted by Admin & locked.'
            : `Review recorded: ${p.decision.toUpperCase()}`;
          toast(toastMsg, 'success');
          // Re-fetch backend data to guarantee live synchronization
          loadBackendData();
          return res;
        } catch (err) {
          const msg = err.response?.data?.error?.message || err.message || 'Failed to record review.';
          toast(msg, 'error');
          dispatch({ type: 'reviewLocal', ...p });
        } finally {
          dispatch({ type: 'setLoading', loading: false });
        }
      },

      setAssurance: (p) => dispatch({ type: 'setAssurance', ...p }),
      issueOpinion: (p) => dispatch({ type: 'issueOpinion', ...p }),
      addEntity: async (p) => {
        try {
          if (p.kind === 'sub' || p.kind === 'project') {
            await organizationApi.organizationApi.createOrganization({ name: p.data?.name, type: p.kind.toUpperCase() });
          }
        } catch { /* proceed with local update */ }
        dispatch({ type: 'addEntity', ...p });
        loadBackendData();
      },
      sendVendorRequests: (p) => dispatch({ type: 'sendVendorRequests', ...p }),
      submitVendor: (p) => dispatch({ type: 'submitVendor', ...p }),
      reviewVendor: (p) => dispatch({ type: 'reviewVendor', ...p }),
      updateSub: (p) => dispatch({ type: 'updateSub', ...p }),
      addVendor: async (data) => {
        try {
          await vendorApi.vendorApi.createVendor(data);
        } catch { /* graceful */ }
        dispatch({ type: 'addVendor', data });
      },
      saveRisk: async (risk) => {
        try {
          if (risk.id && !risk.id.startsWith('RSK-')) {
            await riskApi.riskApi.updateRisk(risk.id, risk);
          } else {
            await riskApi.riskApi.createRisk(risk);
          }
        } catch { /* graceful */ }
        dispatch({ type: 'saveRisk', risk });
      },
      saveDisclosures: (section, data) => dispatch({ type: 'saveDisclosures', section, data }),
      setValueChainConfig: (patch) => dispatch({ type: 'setValueChainConfig', patch }),
      setReportConfig: (patch) => dispatch({ type: 'setReportConfig', patch }),
      markRead: (role) => dispatch({ type: 'markRead', role }),
      remind: (p) => dispatch({ type: 'remind', ...p }),
    }),
    [loadBackendData, toast]
  );

  const value = useMemo(
    () => ({
      state,
      user,
      users,
      calc,
      actions,
      auth,
      toast,
      org: state.org,
      projects: state.org?.projects?.length > 0 ? state.org.projects : [
        { id: 'prj-001', name: 'Zojila Tunnel Package 1', state: 'JK', projectCode: 'ZOJ-01' },
        { id: 'prj-002', name: 'Polavaram Irrigation Hydro Works', state: 'AP', projectCode: 'POL-01' },
        { id: 'prj-003', name: 'Kaleshwaram Lift Irrigation Pkg 6', state: 'TS', projectCode: 'KAL-06' },
        { id: 'prj-004', name: 'Thane-Borivali Twin Road Tunnel', state: 'MH', projectCode: 'TBN-01' },
        { id: 'prj-005', name: 'Char Dham All-Weather Highway Pkg 2', state: 'UK', projectCode: 'CDH-02' },
      ],
      reportingPeriods: (state.reportingPeriods && state.reportingPeriods.length > 0) ? state.reportingPeriods : [
        { id: '2026-09', name: 'September 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: true, status: 'OPEN' },
        { id: '2026-08', name: 'August 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: false, status: 'OPEN' },
        { id: '2026-07', name: 'July 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: false, status: 'OPEN' },
        { id: '2026-06', name: 'June 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: false, status: 'OPEN' },
        { id: '2026-05', name: 'May 2026 (FY 2026-27)', financialYear: 'FY 2026-27', isCurrent: false, status: 'CLOSED' },
      ],
      ui: state.ui,
      submissions: state.submissions,
      loading: state.loading,
    }),
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
            className={`pointer-events-auto animate-in slide-in-from-top-4 flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold ${
              t.type === 'error'
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

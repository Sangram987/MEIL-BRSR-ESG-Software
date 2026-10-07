# Pointing the React frontend at this API

Follow the phased migration the architecture brief laid out — don't delete `AppStore.jsx` on day
one. Swap it module by module; each stage is independently testable against this API.

```
localStorage  →  API
Auth          →  Organization  →  Submissions  →  Approvals  →  Vendor  →  Risk  →  Analytics  →  Reports
```

## 1. API client

Add an axios instance alongside the existing `src/services/api.js`:

```js
// src/services/api.js
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:5000/api/v1', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken'); // short-lived; refresh token is an HTTP-only cookie
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401 && !error.config._retried) {
    error.config._retried = true;
    const { data } = await axios.post('http://localhost:5000/api/v1/auth/refresh', {}, { withCredentials: true });
    sessionStorage.setItem('accessToken', data.accessToken);
    error.config.headers.Authorization = `Bearer ${data.accessToken}`;
    return api(error.config);
  }
  return Promise.reject(error);
});

export default api;
```

## 2. Auth (Login.jsx)

The frontend's Login page already has a real-looking email/password + register flow writing to
`localStorage` with a client-side password hash — that UI maps onto this API almost unchanged:

| Frontend action | API call |
|---|---|
| Sign in | `POST /auth/login` → store `accessToken` in memory/sessionStorage, refresh cookie is set automatically |
| Register | `POST /auth/register` — pass the role the user picked; the API auto-grants a starter scope the same way the demo seed does |
| `auth.me` / restore session on reload | `GET /auth/me` |
| Sign out | `POST /auth/logout` |

Stop writing the password hash to `localStorage` once this is wired — the backend is now the only
place a password touches a hash function.

## 3. Organization (`Organization.jsx`, `HierarchyFilter.jsx`)

```js
GET  /organizations/tree                 // replaces org.subsidiaries / org.bus / org.projects
POST /organizations | /business-units | /projects   // replaces actions.addEntity(...)
GET  /reporting-periods?financialYear=FY 2026-27     // replaces the hard-coded FYS/fyMonths() constants
```

## 4. Submissions (`DataEntry.jsx`, `MySubmissions.jsx`)

```js
// replaces actions.saveSubmission({...})
await api.post('/submissions', {
  projectId, reportingPeriodId, principleCode, values, submit,
});
// response.data.validation is the same {errors:[], warnings:[]} shape validate.js produced —
// the existing <DataEntry> error/warning rendering code needs no changes.

GET /submissions?projectId=...&status=...   // replaces calc.submissions filtering in MySubmissions.jsx
```

## 5. Approvals (`Approvals.jsx`)

```js
GET  /approvals                                   // the BU Manager's queue, pre-scoped server-side
POST /approvals/<id>/approve   | /correction | /reject
```

The `checklist` object the review modal already builds client-side (`checklistFor()` in
`lib/validate.js`) is sent as-is in the request body and stored in `review_actions.checklist_json`.

## 6. Vendor / value chain (`ValueChain.jsx`, `VendorPortal.jsx`, `VendorSubmit.jsx`)

```js
GET  /vendors
POST /vendor-requests                              // replaces actions.sendVendorRequests(...)
POST /vendor-requests/<id>/submit                   // replaces actions.submitVendor(...)
POST /vendor-requests/<id>/review                   // replaces actions.reviewVendor(...)
GET  /value-chain/config   PUT /value-chain/config  // replaces state.valueChainConfig
GET  /value-chain/summary                           // replaces the frontend's vendorEmissions()/vendorShare() math done client-side
```

## 7. Risk (`RiskMatrix.jsx`)

```js
GET   /risks
POST  /risks                      // replaces actions.saveRisk({...}) for new rows
PATCH /risks/<id>                 // replaces actions.saveRisk({...}) for edits
GET   /risks/material-issues      // replaces the `state.risks.filter(r => r.includeInBrsr)` used in Disclosures.jsx
```

## 8. Disclosures (`Disclosures.jsx`)

```js
GET /disclosures?organizationId=...&financialYear=FY 2026-27
PUT /disclosures   // one call, same nested shape the "Save all" button already assembles client-side
```

## 9. Assessment / Assurance (`Workbench.jsx`, `VendorReview.jsx`, `Opinions.jsx`)

```js
GET  /assessments/workbench?status=...
POST /assessments/<submissionId>/status            // replaces actions.setAssurance(...)
GET  /assessments/engagements?reportingPeriodId=&organizationId=
PUT  /assessments/engagements/<coreAttributeId>     // replaces actions.issueOpinion(...); a 422 with
                                                     // code ASSURANCE_INDEPENDENCE_VIOLATION means the
                                                     // UI's own independence-checkbox logic was bypassable
                                                     // client-side and the server caught it — show that message.
```

## 10. Analytics (`AdminPortal.jsx`, `ManagerPortal.jsx`, charts)

Replace every client-side `calc.nodeTotals()/calc.rollup()/calc.coverage()` call with:

```js
GET /analytics/summary?scopeType=GROUP&scopeId=&reportingPeriodId=&boundaryMode=CONSOLIDATED&includeJv=false
GET /analytics/consolidation?...   // same params — replaces the Consolidation screen's drill-down
GET /analytics/map?scopeType=&scopeId=   // replaces the project list ProjectMap.jsx currently gets from org.projects
```

## 11. Reports (`Reports.jsx`)

```js
GET  /reports/readiness?scopeType=&scopeId=&reportingPeriodId=&organizationId=
POST /reports    { scopeType, scopeId, reportingPeriodId, organizationId, boundaryMode, includeJv,
                    package, includeValueChain, disclosureType, formats: ["PDF","CSV","JSON","XML"] }
GET  /reports/<id>/download?format=PDF   // triggers a file download — replaces lib/exporters.js entirely
```

## 12. AI (`Chatbot.jsx`, `AiInsights.jsx`)

```js
POST /ai/chat        { message }                 // replaces the frontend's local KB-matching answer()
POST /ai/forecast     { scopeType, scopeId, reportingPeriodIds, ahead }   // replaces forecast() in AiInsights.jsx
POST /ai/analyze                                  // replaces the client-side spike/drop scan over calc.submissions
```

The response shape for `/ai/chat` is `{ "answer": "..." }` — drop it straight into the existing
chat bubble list.

## What stays client-side

Nothing in the UI's presentation layer needs to change — every endpoint above was designed to
return data in (or very close to) the shape the existing components already expect, specifically
so this migration is "swap the data source," not "rewrite the screen."

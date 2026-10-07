# MEIL BRSR Hub - End-to-End Integration Guide

## Overview

This document describes the complete API integration between the React/Vite frontend and Flask backend for the MEIL BRSR ESG Reporting system. All frontend functionality now communicates with real backend APIs using JWT authentication and centralized service modules.

## Quick Start

### Backend (Flask)

```bash
# Terminal 1: Backend
cd MEIL_ESG_Backend/meil-esg-backend
python -m seeds.run_seed  # Seed demo data (one-time)
python run.py              # Start Flask at http://localhost:5000
```

### Frontend (React/Vite)

```bash
# Terminal 2: Frontend
cd MEIL_ESG_Frontend_v2/meil-esg-frontend
npm install                # Install dependencies (first time only)
npm run dev                # Start Vite dev server at http://localhost:5173
```

## Demo Credentials

All demo users have password: **`Password123`**

| Email | Role | Scope |
|-------|------|-------|
| r.kumar@meil.in | GROUP_ADMIN (Admin) | Entire org tree |
| v.singh@meil.in | BU_MANAGER (Manager) | Tunnels & Transit BU |
| s.naik@meil.in | SITE_OPERATOR (Operator) | Zojila Tunnel Project |
| anil@globallogistics.example | VENDOR_USER (Vendor) | Global Logistics Corp |
| a.rao@assurance.example | ASSESSOR (Auditor) | Entire org tree |

## Architecture

### Frontend Service Layers

#### 1. **apiClient** (`src/services/apiClient.js`)
- Centralized Axios instance
- Automatic JWT token injection from sessionStorage
- Token refresh logic (401 interception)
- CORS support with credentials

#### 2. **Authentication** (`src/services/authApi.js`)
- `login(email, password, role)` → Backend `/auth/login`
- `register(email, password, firstName, lastName, role)` → Backend `/auth/register`
- `getCurrentUser()` → Backend `/auth/me`
- `refreshToken()` → Backend `/auth/refresh`
- `logout()` → Backend `/auth/logout`
- `changePassword(currentPassword, newPassword)` → Backend `/auth/change-password`

#### 3. **Organization** (`src/services/organizationApi.js`)
- `getOrgTree()` → `/organizations/tree`
- `getProjects(businessUnitId)` → `/projects`
- `getProject(projectId)` → `/projects/{id}`
- `createOrganization(name, type, parentId)` → POST `/organizations`
- `updateOrganization(organizationId, updates)` → PATCH `/organizations/{id}`
- `createBusinessUnit(name, organizationId)` → POST `/business-units`
- `createProject(name, businessUnitId, data)` → POST `/projects`
- `updateProject(projectId, updates)` → PATCH `/projects/{id}`
- `getReportingPeriods()` → `/reporting-periods`

#### 4. **Submissions** (`src/services/submissionApi.js`)
- `listSubmissions(filters)` → `/submissions`
- `getSubmission(submissionId)` → `/submissions/{id}`
- `saveSubmission(projectId, reportingPeriodId, principleCode, values, submit)` → POST `/submissions`
- `updateSubmission(submissionId, values, submit)` → PATCH `/submissions/{id}`
- `submitSubmission(submissionId)` → POST `/submissions/{id}/submit`
- `validateSubmission(submissionId)` → POST `/submissions/{id}/validate`
- `getDraftSubmissions(projectId, reportingPeriodId)` → GET `/submissions?status=DRAFT`

#### 5. **Evidence/Documents** (`src/services/evidenceApi.js`)
- `uploadDocument(file, submissionId, indicatorCode, metadata)` → POST `/documents` (multipart)
- `listDocuments(submissionId)` → `/documents?submissionId={id}`
- `getDocument(documentId)` → `/documents/{id}`
- `downloadDocument(documentId)` → GET `/documents/{id}/download` (blob)
- `deleteDocument(documentId)` → DELETE `/documents/{id}`
- `linkDocumentToValue(documentId, submissionId, indicatorCode)` → POST `/documents/{id}/link`

#### 6. **Approvals** (`src/services/approvalsApi.js`)
- `listApprovals(filters)` → `/approvals`
- `getApproval(approvalId)` → `/approvals/{id}`
- `approveSubmission(submissionId, comment, checklist)` → POST `/approvals/{id}/approve`
- `requestCorrection(submissionId, comment, checklist)` → POST `/approvals/{id}/correction`
- `rejectSubmission(submissionId, comment)` → POST `/approvals/{id}/reject`
- `getPendingCount()` → `/approvals/pending/count`

#### 7. **Vendors** (`src/services/vendorApi.js`)
- `listVendors(filters)` → `/vendors`
- `getVendor(vendorId)` → `/vendors/{id}`
- `listVendorRequests(filters)` → `/vendor-requests`
- `getVendorRequest(vendorRequestId)` → `/vendor-requests/{id}`
- `sendVendorRequests(vendorIds, reportingPeriodId, dueDate, message)` → POST `/vendor-requests/send`
- `submitVendorData(vendorRequestId, values, documentIds)` → POST `/vendor-requests/{id}/submit`
- `reviewVendorSubmission(vendorRequestId, decision, comment)` → POST `/vendor-requests/{id}/review`
- `getValueChainConfig()` → `/value-chain/config`
- `getValueChainSummary(reportingPeriodId)` → `/value-chain/summary`

#### 8. **Risk** (`src/services/riskApi.js`)
- `listRisks(filters)` → `/risks`
- `getRisk(riskId)` → `/risks/{id}`
- `createRisk(name, category, type, data)` → POST `/risks`
- `updateRisk(riskId, updates)` → PATCH `/risks/{id}`
- `deleteRisk(riskId)` → DELETE `/risks/{id}`
- `getRiskMatrix(filters)` → `/risks/matrix`

#### 9. **Analytics** (`src/services/analyticsApi.js`)
- `getAnalyticsSummary(filters)` → `/analytics/summary`
- `getConsolidation(filters)` → `/analytics/consolidation`
- `getTrends(indicatorCode, filters)` → `/analytics/trends`
- `getProjectMap(filters)` → `/analytics/map`
- `getCoverage(reportingPeriodId)` → `/analytics/coverage`
- `getFinancialYearData(financialYear, filters)` → `/analytics/financial-year`
- `getKpiRollup(kpiCode, filters)` → `/analytics/kpi-rollup`

#### 10. **Disclosures** (`src/services/disclosureApi.js`)
- `getDisclosures(filters)` → `/disclosures`
- `getDisclosure(disclosureId)` → `/disclosures/{id}`
- `updateDisclosure(disclosureId, updates)` → PATCH `/disclosures/{id}`
- `getBrsrCore(reportingPeriodId)` → `/brsr/core`
- `getBrsrFrameworks()` → `/brsr/frameworks`
- `getBrsrPrinciples()` → `/brsr/principles`
- `getBrsrIndicators(principleCode)` → `/brsr/indicators`
- `getSdgMapping()` → `/brsr/sdg-mapping`

#### 11. **Assessment/Audit** (`src/services/assessmentApi.js`)
- `getWorkbench(filters)` → `/assessments/workbench`
- `getSubmissionAssessment(submissionId)` → `/assessments/{id}/status`
- `updateAssessment(submissionId, updates)` → PATCH `/assessments/{id}`
- `setAssuranceStatus(submissionId, status, note)` → POST `/assessments/{id}/set-assurance`
- `getEngagements(filters)` → `/assessments/engagements`
- `getEngagement(engagementId)` → `/assessments/engagements/{id}`
- `updateEngagement(engagementId, updates)` → PATCH `/assessments/engagements/{id}`
- `issueOpinion(financialYear, attribute, opinionData)` → POST `/assessments/opinions`
- `getAuditLog(filters)` → `/audit-log`

#### 12. **Reports** (`src/services/reportApi.js`)
- `getReportReadiness(reportingPeriodId, reportType)` → `/reports/readiness`
- `listReports(filters)` → `/reports`
- `generateReport(reportingPeriodId, reportType, options)` → POST `/reports`
- `getReport(reportId)` → `/reports/{id}`
- `downloadReport(reportId, format)` → GET `/reports/{id}/download` (blob)
- `exportData(reportingPeriodId, format)` → `/reports/export` (blob)

#### 13. **Notifications** (`src/services/notificationApi.js`)
- `getNotifications(filters)` → `/notifications`
- `markAsRead(notificationId)` → POST `/notifications/{id}/read`
- `markAllAsRead()` → POST `/notifications/read-all`
- `deleteNotification(notificationId)` → DELETE `/notifications/{id}`
- `getUnreadCount()` → `/notifications/unread-count`
- `getReminders()` → `/notifications/reminders`

#### 14. **AI** (`src/services/aiApi.js`)
- `chat(message, context)` → POST `/ai/chat`
- `forecast(indicatorCode, filters)` → `/ai/forecast`
- `analyze(indicatorCode, filters)` → `/ai/analyze`
- `getRecommendations()` → `/ai/recommendations`

### Data Mappers (`src/services/mappers.js`)

Normalize backend responses to frontend formats:

- `mapUser(backendUser)` → Frontend user object
- `mapOrgTree(backendTree)` → Org hierarchy with proper IDs
- `mapSubmission(backendSubmission)` → Frontend submission object
- `mapEsgValues(backendValues)` → Value dictionary by indicator code
- `mapSubmissionValuesForBackend(frontendValues)` → Backend value array format
- `mapDocument(backendDoc)` → Frontend document/evidence object
- `mapApproval(backendReview)` → Frontend approval object
- `mapVendorRequest(backendRequest)` → Frontend vendor request object
- `mapRisk(backendRisk)` → Frontend risk object
- `mapAnalytics(backendAnalytics)` → Frontend analytics/dashboard object
- `mapNotification(backendNotif)` → Frontend notification object

### AppStore Integration (`src/store/AppStore.jsx`)

**Updated Features:**
- `auth.login()` now calls `authApi.login()` and stores JWT in sessionStorage
- `auth.register()` now calls `authApi.register()` and stores JWT in sessionStorage
- `auth.logout()` now calls `authApi.logout()` and clears tokens
- Session state restored on app mount from sessionStorage
- Tokens automatically refreshed on 401 response
- All existing Redux-like action methods preserved for backward compatibility

**State Shape:**
```javascript
{
  session: { role: 'admin', profile: { id, email, name, ... } },
  org: { /* org tree */ },
  submissions: [ /* submission array */ ],
  ui: { fy, scope, boundary },
  notifications: [],
  loading: false,
  error: null,
  // ... other seed data fields
}
```

### ProtectedRoute Component

No changes needed—already checks user existence and role membership.

## Workflow Verification

### End-to-End Login → Submission → Approval Flow

1. **Login Page** (`/login`)
   - User enters email, password, selects role
   - Calls `auth.login()` → `authApi.login()` → Backend `/auth/login`
   - JWT stored in sessionStorage
   - User redirected to role home page

2. **Organization Loading** (Background)
   - Each page can call `organizationApi.getOrgTree()` to fetch real hierarchy
   - Replaces mock org from localStorage

3. **Data Entry** (`/operator/data-entry`)
   - Load submissions via `submissionApi.listSubmissions({ projectId, status: 'DRAFT' })`
   - Upload evidence via `evidenceApi.uploadDocument(file, ...)`
   - Save values via `submissionApi.saveSubmission(...)`
   - Submit via `submissionApi.submitSubmission(submissionId)`

4. **Manager Approvals** (`/manager/approvals`)
   - Load pending approvals via `approvalsApi.listApprovals()`
   - Approve/correct/reject via `approvalsApi.approve/requestCorrection/reject()`

5. **Vendor Submission** (`/vendor/submit`)
   - Load requests via `vendorApi.listVendorRequests({ vendorId: currentVendor })`
   - Submit data via `vendorApi.submitVendorData(vendorRequestId, values, docIds)`

6. **Auditor Workbench** (`/auditor`)
   - Load workbench via `assessmentApi.getWorkbench()`
   - Review vendor submissions via `vendorApi.reviewVendorSubmission()`
   - Issue opinions via `assessmentApi.issueOpinion()`

7. **Analytics/Dashboard** (`/admin/consolidation`, `/admin/ai-insights`)
   - Consolidation via `analyticsApi.getConsolidation()`
   - KPI trends via `analyticsApi.getTrends()`
   - AI insights via `aiApi.getRecommendations()`

8. **Report Generation** (`/admin/reports`)
   - Check readiness via `reportApi.getReportReadiness()`
   - Generate via `reportApi.generateReport()`
   - Download via `reportApi.downloadReport()`

## Environment Variables

### Frontend (`.env.local`)
```
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_APP_NAME=MEIL BRSR Hub
VITE_APP_VERSION=1.0.0
VITE_DEBUG=false
```

### Backend (`.env`)
```
FLASK_ENV=development
SECRET_KEY=dev-secret-change-me
JWT_SECRET_KEY=dev-jwt-secret-change-me
DATABASE_URL=  # Leave blank for SQLite
REDIS_URL=redis://localhost:6379/0
CELERY_TASK_ALWAYS_EAGER=true
CORS_ORIGINS=http://localhost:5173
```

## Common Integration Patterns

### Fetching Data

```javascript
import { organizationApi } from '../services/api';

const MyComponent = () => {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const tree = await organizationApi.getOrgTree();
        setOrg(tree);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{org.org.name}</div>;
};
```

### Form Submission with Error Handling

```javascript
import { submissionApi } from '../services/api';
import { useApp } from '../store/AppStore';

const DataEntryForm = ({ projectId, reportingPeriodId, principleCode }) => {
  const { toast } = useApp();
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submissionApi.saveSubmission(
        projectId,
        reportingPeriodId,
        principleCode,
        values,
        true // submit=true
      );
      toast('Submission sent for review');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
};
```

### Document Upload

```javascript
import { evidenceApi } from '../services/api';

const DocumentUpload = ({ submissionId, indicatorCode }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const doc = await evidenceApi.uploadDocument(
        file,
        submissionId,
        indicatorCode
      );
      console.log('Uploaded:', doc);
    } catch (error) {
      console.error('Upload failed:', error.message);
    } finally {
      setUploading(false);
    }
  };

  return <input type="file" onChange={handleUpload} disabled={uploading} />;
};
```

## Role-Based Access Control (RBAC)

**Backend Enforcement** (Primary)
- All routes use `@roles_required()` or `@authenticated()` decorators
- All data filtering uses `accessible_project_ids()` helper
- Frontend role checks are decorative only

**Frontend Support** (Secondary)
- `ProtectedRoute` component checks user role
- `ROLE_MAP` converts frontend roles ↔ backend role codes
- Mappers normalize role data

## Known Limitations & TODOs

1. **AI Endpoints (501 Not Implemented)**
   - `/ai/chat`, `/ai/forecast`, `/ai/analyze` require AI provider configuration
   - Fallback to demo responses in services

2. **Real-Time Features**
   - No WebSocket/polling for live notifications
   - Frontend polls at 30-second intervals for new notifications

3. **Reminders**
   - Backend `/notifications/reminders` needs implementation
   - Frontend reminder action uses this endpoint

4. **Financial Year Aggregation**
   - `/analytics/financial-year` aggregates monthly periods into FY
   - Requires backend logic for FY boundaries

5. **Audit Log**
   - `/audit-log` must be implemented in backend
   - Currently returns empty array fallback

## Testing Checklist

- [ ] **Authentication**
  - [ ] Login with valid credentials redirects to role home
  - [ ] Login with invalid credentials shows error
  - [ ] Register creates new user and logs in
  - [ ] Logout clears tokens and redirects to home
  - [ ] Accessing protected route without auth redirects to login
  - [ ] Token refresh on 401 response

- [ ] **Organization**
  - [ ] Org tree loads with real hierarchy (not mock)
  - [ ] Projects show under correct business units
  - [ ] Reporting periods load correctly

- [ ] **Data Entry (Operator)**
  - [ ] Load draft submissions for project/period
  - [ ] Save submission values as draft
  - [ ] Upload evidence document
  - [ ] Link document to ESG value
  - [ ] Submit for review
  - [ ] See submission in "My Submissions"

- [ ] **Approvals (Manager)**
  - [ ] Load pending approvals for BU
  - [ ] View submission details and evidence
  - [ ] Approve submission
  - [ ] Request correction
  - [ ] Reject with comment
  - [ ] See approval history

- [ ] **Vendor Portal**
  - [ ] Vendor logs in and sees requests
  - [ ] Submit vendor data and evidence
  - [ ] See submission history
  - [ ] Receive correction requests

- [ ] **Auditor Workbench**
  - [ ] Load workbench data
  - [ ] Review vendor submissions
  - [ ] Issue assurance opinions
  - [ ] See audit trail

- [ ] **Analytics/Dashboard**
  - [ ] Load consolidation data (real aggregations, not mock)
  - [ ] KPI trends load
  - [ ] Coverage % is calculated
  - [ ] Project map shows locations

- [ ] **Reports**
  - [ ] Check report readiness
  - [ ] Generate BRSR report
  - [ ] Download as PDF/Excel
  - [ ] Export data

- [ ] **Notifications**
  - [ ] New action creates notification
  - [ ] Mark as read
  - [ ] Unread badge updates

## Troubleshooting

### 401 Unauthorized on Protected Routes
- **Cause**: Token missing or expired
- **Fix**: AppStore's token refresh logic handles this automatically; check sessionStorage has `accessToken`

### CORS errors
- **Cause**: Frontend and backend on different ports
- **Fix**: Backend `/app/config.py` has `CORS_ORIGINS=http://localhost:5173` by default

### 404 on API calls
- **Cause**: Endpoint not implemented or wrong path
- **Fix**: Check endpoint path matches backend route definitions in `/app/routes/*`

### Mock data still showing
- **Cause**: Component not yet updated to fetch from API
- **Fix**: Update component to call appropriate service function instead of reading from Redux/mock state

## File Structure Reference

**Frontend**
```
src/
  services/
    apiClient.js          # Centralized Axios + token/refresh logic
    authApi.js            # Authentication endpoints
    organizationApi.js    # Org hierarchy, projects
    submissionApi.js      # ESG submissions
    evidenceApi.js        # Document upload/download
    approvalsApi.js       # Manager review actions
    vendorApi.js          # Vendor portal
    riskApi.js            # Risk matrix
    analyticsApi.js       # Dashboards, consolidation
    disclosureApi.js      # BRSR disclosures
    assessmentApi.js      # Auditor workbench
    reportApi.js          # Report generation
    notificationApi.js    # Notifications
    aiApi.js              # AI features
    mappers.js            # Data normalization
    api.js                # Barrel export
  store/
    AppStore.jsx          # Redux-like state + JWT auth
  components/
    ProtectedRoute.jsx    # Role-based routing (unchanged)
```

**Backend**
```
app/
  routes/
    auth.py               # Login, register, refresh, logout
    organization.py       # Org tree, projects, BU
    submissions.py        # ESG value submissions
    evidence.py           # Document storage
    approvals.py          # Manager review actions
    vendors.py            # Vendor requests and submissions
    risk.py               # Risk matrix
    analytics.py          # Consolidation, KPI trends
    disclosures.py        # BRSR disclosures
    assessment.py         # Auditor workbench
    reports.py            # Report generation
    notifications.py      # User notifications
    ai.py                 # AI endpoints (stub)
  models/
    user.py, organization.py, submission.py, etc.
  services/
    validation_service.py, consolidation_service.py, etc.
seeds/
  run_seed.py            # Initialize demo data
```

## Next Steps

1. **Seed demo data**: `python -m seeds.run_seed`
2. **Start backend**: `python run.py` (runs on :5000)
3. **Start frontend**: `npm run dev` (runs on :5173)
4. **Log in** with any demo credential
5. **Test workflows** using the checklist above
6. **Fix issues** as they arise (start with login, then expand)

## Questions?

Refer to:
- Backend routes: `/app/routes/*.py`
- Frontend service docs: Comments in each service module
- Data contracts: Response shapes defined in models and mappers
- Test fixtures: `/seeds/seed_demo.py` for data structure examples

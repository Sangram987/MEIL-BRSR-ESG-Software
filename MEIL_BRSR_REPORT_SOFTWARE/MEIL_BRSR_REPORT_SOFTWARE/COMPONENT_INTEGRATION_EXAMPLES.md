# Complete API Integration Examples

## Live Testing Status

✅ **Backend**: Running on http://localhost:5000  
✅ **Frontend**: Running on http://localhost:5174  
✅ **Login**: Updated to use real authApi  
🔧 **Components**: Ready for integration  

**Test Login**: r.kumar@meil.in / Password123

---

## Example 1: Simple List Page (MySubmissions)

### BEFORE (Mock Data)
```javascript
// OLD: Reading from mock AppStore
export default function MySubmissions() {
  const { calc, user } = useApp();
  const submissions = calc.submissions.filter(s => 
    s.projectId === user.projectId
  );
  
  return (
    <div>
      {submissions.map(sub => (
        <div key={sub.id}>{sub.id}</div>
      ))}
    </div>
  );
}
```

### AFTER (Real API)
```javascript
import { useState, useEffect } from 'react';
import { submissionApi, mappers } from '../../services/api';
import { useApp } from '../../store/AppStore';

export default function MySubmissions() {
  const { user, toast } = useApp();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // Call API to get submissions
        const data = await submissionApi.listSubmissions({ 
          projectId: user.projectId 
        });
        setSubmissions(data || []);
      } catch (err) {
        setError(err.message);
        toast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [user.projectId, toast]);

  if (loading) return <div className="p-4">Loading submissions...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  
  return (
    <div>
      {submissions.length === 0 ? (
        <p>No submissions found</p>
      ) : (
        submissions.map(sub => (
          <div key={sub.id}>{sub.id}</div>
        ))
      )}
    </div>
  );
}
```

**Key Changes**:
1. Add imports: `useState`, `useEffect`, `submissionApi`
2. Create state: `submissions`, `loading`, `error`
3. Add `useEffect` hook to fetch on mount
4. Pass `projectId` filter to API
5. Handle loading/error states
6. Remove `calc.submissions` reference

---

## Example 2: Save Form (DataEntry)

### BEFORE (Mock)
```javascript
const save = () => { 
  actions.saveSubmission({ 
    projectId, period, principle, values, submit: false 
  }); 
  toast(`Saved`); 
};
```

### AFTER (Real API)
```javascript
import { submissionApi } from '../../services/api';

const save = async () => {
  try {
    setBusy(true);
    const result = await submissionApi.saveSubmission(
      projectId,           // project ID
      period,              // reporting period
      principle,           // BRSR principle code
      values,              // input values
      false                // submit=false for draft
    );
    toast('Submission saved as draft');
    return result;
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBusy(false);
  }
};

const doSubmit = async () => {
  try {
    setBusy(true);
    await submissionApi.submitSubmission(submissionId);
    toast('Submission sent for approval');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBusy(false);
  }
};
```

**Key Patterns**:
- `await` API call
- `try/catch` for error handling
- `setBusy(true/false)` for loading states
- `toast()` for user feedback
- Different methods for save vs submit

---

## Example 3: File Upload

### BEFORE (Mock)
```javascript
const onFile = (id, f) => {
  if (!f) return;
  setEv(id, f.name);  // Just store filename
};
```

### AFTER (Real API)
```javascript
import { evidenceApi } from '../../services/api';

const onFile = async (id, f) => {
  if (!f) return;
  
  // Validate file size
  if (f.size > 25 * 1024 * 1024) {
    toast('File is larger than 25 MB', 'error');
    return;
  }

  try {
    setUploading(true);
    
    // Upload to backend
    const doc = await evidenceApi.uploadDocument(
      f,                    // File object
      submissionId,         // Which submission
      indicatorCode         // Which indicator
    );
    
    // Store document ID for linking
    setEv(id, f.name);
    setValues(s => ({
      ...s,
      [id]: { ...s[id], docId: doc.id }
    }));
    
    toast('Document uploaded successfully');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setUploading(false);
  }
};
```

**Key Points**:
- Validate before upload
- Use `evidenceApi.uploadDocument()`
- Store returned document ID
- Handle upload errors
- Show loading state

---

## Example 4: Approval Workflow

### BEFORE (Mock)
```javascript
const decide = (decision) => {
  actions.review({ 
    id: sub.id, 
    decision, 
    comment 
  });
  toast('Submission approved');
};
```

### AFTER (Real API)
```javascript
import { approvalsApi } from '../../services/api';

const decide = async (decision) => {
  try {
    setBusy(true);
    
    if (decision === 'approve') {
      await approvalsApi.approveSubmission(
        submissionId,
        comment,
        checklist  // Review checklist
      );
      toast('Submission approved');
    } else if (decision === 'correction') {
      await approvalsApi.requestCorrection(
        submissionId,
        comment,
        checklist
      );
      toast('Correction requested - sent back to site');
    } else if (decision === 'reject') {
      await approvalsApi.rejectSubmission(
        submissionId,
        comment
      );
      toast('Submission rejected');
    }
    
    onClose();  // Close modal
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBusy(false);
  }
};
```

**Different Methods**:
- `approveSubmission()` - For approval
- `requestCorrection()` - For requesting changes
- `rejectSubmission()` - For rejection

---

## Example 5: Load Dependent Data

### BEFORE (Mock)
```javascript
const projects = org.projects.filter(p => p.buId === user.buId);
```

### AFTER (Real API - Load on Page)
```javascript
import { organizationApi } from '../../services/api';

const [projects, setProjects] = useState([]);

useEffect(() => {
  (async () => {
    try {
      // Get all projects for this BU
      const data = await organizationApi.getProjects(user.buId);
      setProjects(data || []);
    } catch (err) {
      toast(err.message, 'error');
    }
  })();
}, [user.buId]);
```

---

## Example 6: Analytics Dashboard

### BEFORE (Mock)
```javascript
const node = calc.nodeTotals(scope, fy, boundary);
const consolidation = calc.rollup(scope, fy, boundary);
```

### AFTER (Real API)
```javascript
import { analyticsApi, mappers } from '../../services/api';

const [summary, setSummary] = useState(null);
const [consolidation, setConsolidation] = useState([]);

useEffect(() => {
  (async () => {
    try {
      // Get analytics summary
      const data = await analyticsApi.getAnalyticsSummary({ 
        reportingPeriodId: period,
        organizationId: scopeId
      });
      setSummary(mappers.mapAnalytics(data));
      
      // Get consolidation data
      const cons = await analyticsApi.getConsolidation({ 
        reportingPeriodId: period
      });
      setConsolidation(cons);
    } catch (err) {
      toast(err.message, 'error');
    }
  })();
}, [period, scopeId]);
```

---

## Example 7: Vendor Portal

### BEFORE (Mock)
```javascript
const requests = calc.vendorRequests.filter(r => 
  r.vendorId === user.vendorId
);
```

### AFTER (Real API)
```javascript
import { vendorApi } from '../../services/api';

const [requests, setRequests] = useState([]);

useEffect(() => {
  (async () => {
    try {
      const data = await vendorApi.listVendorRequests({ 
        vendorId: user.vendorId,
        status: 'requested'
      });
      setRequests(data || []);
    } catch (err) {
      toast(err.message, 'error');
    }
  })();
}, [user.vendorId]);
```

**Submit Vendor Data**:
```javascript
const submitVendorData = async () => {
  try {
    await vendorApi.submitVendorData(
      vendorRequestId,
      values,            // Vendor's input values
      documentIds        // Uploaded document IDs
    );
    toast('Vendor data submitted');
  } catch (err) {
    toast(err.message, 'error');
  }
};
```

---

## Example 8: Auditor Workbench

### BEFORE (Mock)
```javascript
const workbench = calc.submissions.filter(s => 
  s.status === 'approved'
);
```

### AFTER (Real API)
```javascript
import { assessmentApi } from '../../services/api';

const [workbench, setWorkbench] = useState([]);

useEffect(() => {
  (async () => {
    try {
      const data = await assessmentApi.getWorkbench({ 
        reportingPeriodId: period,
        status: 'review_pending'
      });
      setWorkbench(data || []);
    } catch (err) {
      toast(err.message, 'error');
    }
  })();
}, [period]);
```

**Set Assurance Status**:
```javascript
const setAssurance = async (submissionId, status) => {
  try {
    await assessmentApi.setAssuranceStatus(
      submissionId,
      status,           // 'in_progress', 'complete', 'opinion_issued'
      note              // Auditor notes
    );
    toast('Assurance status updated');
  } catch (err) {
    toast(err.message, 'error');
  }
};
```

---

## Common Patterns & Best Practices

### Pattern: Load on Mount + Refetch
```javascript
useEffect(() => {
  fetchData();
}, [dependency]);

const fetchData = async () => {
  try {
    setLoading(true);
    const data = await api.getSomething();
    setData(data);
  } catch (err) {
    setError(err.message);
    toast(err.message, 'error');
  } finally {
    setLoading(false);
  }
};
```

### Pattern: With Loading Spinner
```javascript
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
return <YourContent data={data} />;
```

### Pattern: Form With Validation
```javascript
const [busy, setBusy] = useState(false);
const [errors, setErrors] = useState({});

const handleSubmit = async (e) => {
  e.preventDefault();
  setErrors({});
  
  // Validate
  if (!form.email) {
    setErrors({ email: 'Required' });
    return;
  }
  
  try {
    setBusy(true);
    await api.save(form);
    toast('Saved');
  } catch (err) {
    if (err.field) {
      setErrors({ [err.field]: err.message });
    } else {
      toast(err.message, 'error');
    }
  } finally {
    setBusy(false);
  }
};
```

### Pattern: Polling (if needed)
```javascript
useEffect(() => {
  // Fetch immediately
  fetchData();
  
  // Then poll every 30 seconds
  const interval = setInterval(fetchData, 30000);
  
  return () => clearInterval(interval);
}, []);
```

---

## Testing Your Updates

### In Browser DevTools

1. **Network Tab** (F12 → Network)
   - Click action in app
   - Should see POST/GET to http://localhost:5000/api/v1/*
   - Check response contains your data

2. **Console** (F12 → Console)
   - Check for JavaScript errors
   - Check `console.log()` debug output
   - Call API directly: 
   ```javascript
   const { submissionApi } = await import('./services/api.js');
   submissionApi.listSubmissions({ projectId: 'proj-1' })
   ```

3. **Storage** (F12 → Application → Session Storage)
   - Should see `accessToken` after login
   - Should see `user` with role and profile
   - These persist across page reloads

### In Terminal

**Backend** (window running `python run.py`):
- See each API request with method/path
- Should see 200 responses for successful calls
- 401 errors trigger token refresh

**Frontend** (window running `npm run dev`):
- Check for build errors
- Check for import errors
- See Vite HMR updates

---

## Debugging API Issues

### 401 Unauthorized
```
Solution: Token expired or missing
- Check sessionStorage.getItem('accessToken')
- Token should auto-refresh automatically
- If not working, login again
```

### 404 Not Found
```
Solution: API endpoint doesn't exist
- Check backend route files match service module paths
- Verify endpoint path in terminal logs
- Check backend .env has correct FLASK_ENV
```

### 500 Internal Server Error
```
Solution: Backend error
- Check terminal running `python run.py`
- Look for Python traceback
- Check database has data (run seed if needed)
```

### CORS Error
```
Solution: Frontend/backend port mismatch
- Verify vite.config.js has proxy config
- Verify backend CORS_ORIGINS in .env includes :5174
- Check browser console for exact error message
```

### Empty Response
```
Solution: API working but returns null
- Check data was seeded: python -m seeds.run_seed
- Verify filters match actual data
- Check backend logs for query results
```

---

## Checklist for Each Component Update

- [ ] Add import: `import { XyzApi } from '../services/api'`
- [ ] Add state: `const [data, setData] = useState([])`
- [ ] Add useEffect: Load data on component mount
- [ ] Add error handling: Try/catch with toast
- [ ] Add loading state: Show spinner while loading
- [ ] Test with DevTools: Check Network tab
- [ ] Test with real data: Verify not showing mock
- [ ] Test error case: Break API call and check error display
- [ ] Commit/merge changes

---

## Next Actions

1. **Try Login Flow** ✅
   - Open http://localhost:5174/login
   - Login with r.kumar@meil.in / Password123
   - Should see admin dashboard from real backend

2. **Try Simple Component** (RECOMMENDED NEXT)
   - Pick `MySubmissions.jsx` (simplest page)
   - Replace `calc.submissions` with `submissionApi`
   - Follow Pattern 1 from this document
   - Test in browser with DevTools

3. **Try Form Component** (THEN)
   - Pick `DataEntry.jsx` or `Approvals.jsx`
   - Replace action calls with API calls
   - Follow Pattern 2 for save/submit

4. **Try Complex Dashboard** (THEN)
   - Pick `Consolidation.jsx`
   - Replace `calc.rollup()` with `analyticsApi`
   - Follow Pattern 6 for analytics

5. **Test End-to-End** (FINALLY)
   - Operator: Enter data → Submit
   - Manager: Approve submission
   - Admin: See in consolidation
   - Report: Generate and download

---

## Summary

Every component follows this pattern:

1. **Import**: Get the API service
2. **State**: Create state for data/loading/error
3. **Effect**: Fetch data on mount
4. **Render**: Display data or loading/error states
5. **Test**: Verify Network tab shows API calls

Use these examples as templates for all your component updates!

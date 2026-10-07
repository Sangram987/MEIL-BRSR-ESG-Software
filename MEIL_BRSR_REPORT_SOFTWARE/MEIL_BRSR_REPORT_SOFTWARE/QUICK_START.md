# Quick Start Guide - MEIL BRSR Hub

## One-Time Setup

### Backend
```bash
# 1. Navigate to backend directory
cd MEIL_ESG_Backend/meil-esg-backend

# 2. Install dependencies (first time only)
pip install -r requirements.txt

# 3. Seed demo data (first time only)
python -m seeds.run_seed

# 4. Start backend server
python run.py
# Output: Running on http://localhost:5000
```

### Frontend
```bash
# 1. Navigate to frontend directory
cd MEIL_ESG_Frontend_v2/meil-esg-frontend

# 2. Install dependencies (first time only)
npm install

# 3. Start development server
npm run dev
# Output: Local: http://localhost:5173
```

## Login Credentials (After Running Seed)

Choose any of these to test:

| Email | Role | Password |
|-------|------|----------|
| r.kumar@meil.in | Admin | Password123 |
| v.singh@meil.in | Manager | Password123 |
| s.naik@meil.in | Operator | Password123 |
| anil@globallogistics.example | Vendor | Password123 |
| a.rao@assurance.example | Auditor | Password123 |

## Testing Workflow

1. **Open** http://localhost:5173 in browser
2. **Login** with any credential above
3. **Admin** → Dashboard shows aggregated data
4. **Manager** → Approvals page shows pending reviews
5. **Operator** → Data Entry to submit ESG values
6. **Vendor** → Vendor Portal to submit vendor data
7. **Auditor** → Workbench to review and issue opinions

## API Endpoints

Base URL: `http://localhost:5000/api/v1`

### Authentication
- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Register new user
- `GET /auth/me` - Get current user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout

### Organization
- `GET /organizations/tree` - Get org hierarchy
- `GET /projects` - List projects
- `GET /reporting-periods` - List periods

### Submissions
- `GET /submissions` - List submissions
- `POST /submissions` - Create/save submission
- `PATCH /submissions/:id` - Update submission
- `POST /submissions/:id/submit` - Submit for approval

### Documents
- `POST /documents` - Upload document
- `GET /documents` - List documents
- `GET /documents/:id/download` - Download document

### Approvals
- `GET /approvals` - List approvals
- `POST /approvals/:id/approve` - Approve submission
- `POST /approvals/:id/correction` - Request correction
- `POST /approvals/:id/reject` - Reject submission

### Vendors
- `GET /vendors` - List vendors
- `GET /vendor-requests` - List vendor requests
- `POST /vendor-requests/:id/submit` - Submit vendor data
- `POST /vendor-requests/:id/review` - Review vendor submission

### Analytics
- `GET /analytics/summary` - Dashboard summary
- `GET /analytics/consolidation` - Consolidation data
- `GET /analytics/trends` - KPI trends
- `GET /reports` - List reports
- `POST /reports` - Generate report

### Audit
- `GET /assessments/workbench` - Auditor workbench
- `POST /assessments/:id/set-assurance` - Set assurance status
- `POST /assessments/opinions` - Issue opinion

## Frontend Services Architecture

All API calls go through `/src/services/`:

- **apiClient.js** - HTTP client with auth
- **authApi.js** - Authentication methods
- **organizationApi.js** - Organization data
- **submissionApi.js** - ESG submissions
- **evidenceApi.js** - Document upload/download
- **approvalsApi.js** - Manager approvals
- **vendorApi.js** - Vendor portal
- **riskApi.js** - Risk management
- **analyticsApi.js** - Dashboards
- **disclosureApi.js** - BRSR disclosures
- **assessmentApi.js** - Audit workbench
- **reportApi.js** - Report generation
- **notificationApi.js** - User notifications
- **aiApi.js** - AI features (stub)
- **mappers.js** - Data normalization

## Troubleshooting

### Backend won't start
```bash
# Check if port 5000 is in use
netstat -ano | findstr :5000
# Or try different port: FLASK_PORT=5001 python run.py
```

### Frontend won't start
```bash
# Check if port 5173 is in use
netstat -ano | findstr :5173
# Or kill existing process and retry npm run dev
```

### 401 Unauthorized errors
- Token might have expired
- Check sessionStorage has `accessToken`
- Try logging out and back in

### CORS errors in browser
- Verify backend is running on http://localhost:5000
- Check Vite proxy config in vite.config.js
- Frontend should proxy /api requests to backend

### Demo data not seeding
```bash
# Make sure you're in backend directory
cd MEIL_ESG_Backend/meil-esg-backend

# Run seed explicitly
python -m seeds.run_seed

# Check database exists
ls instance/meil_esg.db  # Should exist if SQLite

# Check seed output - should show:
# ✓ Demo users created
# ✓ Organization tree created
# ✓ Sample data populated
```

## Development Workflow

### Terminal 1: Backend
```bash
cd MEIL_ESG_Backend/meil-esg-backend
python run.py
# Keep running - Flask reload on file changes
```

### Terminal 2: Frontend  
```bash
cd MEIL_ESG_Frontend_v2/meil-esg-frontend
npm run dev
# Keep running - Vite rebuild on file changes
```

### Terminal 3: Testing/Commands
```bash
# Run tests if available
npm run test          # Frontend tests
pytest                # Backend tests

# Check API endpoints
curl http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Monitor logs
tail -f backend_output.log
```

## Component Integration Guide

To add API integration to a page:

1. Import service: `import { submissionApi } from '../services/api';`
2. Use in component:
```javascript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  (async () => {
    try {
      const result = await submissionApi.listSubmissions({ projectId });
      setData(result);
    } finally {
      setLoading(false);
    }
  })();
}, [projectId]);
```

3. Render: `{loading ? 'Loading...' : data.map(item => ...)}`

## Documentation Files

- **[API_INTEGRATION_SUMMARY.md](../API_INTEGRATION_SUMMARY.md)** - Complete integration overview
- **[INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md)** - Detailed API methods, workflows, architecture
- **[backend README](../MEIL_ESG_Backend/meil-esg-backend/README.md)** - Backend setup and configuration

## Common Commands

```bash
# Frontend
cd MEIL_ESG_Frontend_v2/meil-esg-frontend
npm install              # Install deps
npm run dev              # Development server
npm run build            # Production build
npm run preview          # Preview build output
npm run lint             # Linting

# Backend
cd MEIL_ESG_Backend/meil-esg-backend
pip install -r requirements.txt  # Install deps
python run.py                    # Run server
python -m seeds.run_seed         # Seed data
python -m pytest                 # Run tests
python -m pytest -v              # Verbose tests
```

## Security Notes

- Access tokens stored in sessionStorage (cleared on browser close)
- Refresh tokens stored in HTTP-only cookies (backend managed)
- All requests include JWT in Authorization header
- Backend validates JWT on every request
- No sensitive data in localStorage
- CORS properly configured for frontend origin

## Performance Tips

- Development build at localhost:5173 includes sourcemaps (slower but easier to debug)
- Production build optimized and minified
- API responses cached where appropriate (check service methods)
- Large submissions split with pagination filters
- Avoid repeated API calls - cache results in component state

## Next Steps After Setup

1. **Test login flow** - Verify authentication works
2. **Check organization tree** - Ensure hierarchy loads
3. **Test data submission** - Upload ESG values
4. **Verify approval workflow** - Manager reviews submission
5. **Check analytics** - Dashboard aggregations working
6. **Generate report** - Export BRSR report
7. **Test vendor portal** - Vendor submits data
8. **Auditor review** - Auditor issues opinion

## Support

If you encounter issues:

1. Check terminal outputs for error messages
2. Review browser console (F12 → Console tab)
3. Check network tab for API responses
4. Read INTEGRATION_GUIDE.md for detailed info
5. Review logs in backend terminal
6. Check database queries in backend logs

## Production Deployment

When ready to deploy:

1. **Build frontend**: `npm run build` → creates `dist/` folder
2. **Set environment variables** in backend `.env`
3. **Use production database** (MySQL instead of SQLite)
4. **Configure Redis** for Celery background tasks
5. **Run database migrations**: `flask db upgrade`
6. **Seed production data**: `python -m seeds.run_seed`
7. **Deploy frontend build** to web server (nginx/Apache)
8. **Deploy backend** to app server (gunicorn/uwsgi)
9. **Configure SSL/HTTPS**
10. **Set up monitoring and logging**

See backend README and frontend README for detailed deployment steps.

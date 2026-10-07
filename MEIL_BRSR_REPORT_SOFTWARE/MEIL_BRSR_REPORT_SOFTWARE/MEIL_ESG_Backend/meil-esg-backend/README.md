# MEIL ESG Hub — Backend

Flask + MySQL + Redis + Celery + MinIO backend for the MEIL BRSR Hub frontend. This turns the
React app's `localStorage`-backed demo workflow (Site Operator → BU Manager → Group ESG →
Assessment/Assurance, plus the Vendor/Scope-3 branch) into a real, multi-tenant-safe data system,
following the architecture the company's own backend brief specified.

## Stack

| Layer | Choice |
|---|---|
| API | Flask 3, Flask-SQLAlchemy, Flask-Migrate, Flask-JWT-Extended, Flask-CORS, Flask-Limiter |
| Validation | Marshmallow |
| Auth | JWT access + refresh tokens, Argon2 (or bcrypt) password hashing, role + scope RBAC |
| Database | MySQL 8 (SQLite fallback for zero-setup local dev) |
| Background jobs | Celery + Redis (synchronous in-request fallback when no worker is running) |
| File storage | MinIO / S3-compatible (local-disk fallback for zero-setup local dev) |
| Reporting | ReportLab (PDF), openpyxl (XLSX), stdlib csv/json, hand-rolled XBRL-style XML |
| AI | Provider abstraction — rule-based by default, Gemini or OpenAI via one env var |

## Quick start (no Docker, no MySQL — fastest way to see it work)

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # defaults already work: SQLite + local storage + eager Celery
python -m seeds.run_seed             # BRSR master + org hierarchy (250 projects) + demo accounts
python run.py                        # http://localhost:5000
```

Demo accounts (password `Password123` for all — see `seeds/seed_demo.py`):

| Email | Role |
|---|---|
| r.kumar@meil.in | Group ESG Admin |
| v.singh@meil.in | BU Manager (Tunnels & Transit) |
| s.naik@meil.in | Site Operator (Zojila Tunnel Package 1) |
| anil@globallogistics.example | Vendor User |
| a.rao@assurance.example | Assessor |

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"r.kumar@meil.in","password":"Password123"}'
```

## Full stack with Docker (MySQL + Redis + MinIO + worker + beat)

```bash
cp .env.example .env            # edit MYSQL_PASSWORD etc.
docker compose -f docker/docker-compose.yml up --build
```

The `api` service runs `flask db upgrade && python -m seeds.run_seed` on startup automatically.

## Tests

```bash
pytest
```

`tests/test_formulas.py` needs no fixtures at all (the KPI math is pure Python — see "Why
formulas.py has no Flask import" below). `tests/test_submission_flow.py` is the full
create → submit → correct → resubmit → approve → consolidate integration test the company's
review specifically asked for. `tests/test_permissions.py` covers the scope-boundary cases
("a Site Operator must never reach another project by editing an id in the URL", "an internal
auditor cannot be recorded as providing assurance").

## Why the business logic isn't "copy AppStore.jsx into Python"

Per the architecture brief: the frontend's `src/store/AppStore.jsx` reducer was always a
browser-side *simulation* of a backend. This project re-implements the actual rules as
**pure, framework-free Python functions** in `app/services/`, most importantly
`app/services/formulas.py`, which has zero Flask/SQLAlchemy imports and is ported field-for-field
from the frontend's `lib/consolidate.js::kpis()`. That means:

- the numbers the API returns match what the React app showed during development,
- the formulas are unit-testable without spinning up a database, and
- aggregation is **per-indicator**, not blanket `SUM()`/`AVG()` — see `AGG_SUM` vs
  `AGG_END_OF_PERIOD` vs the rate formulas that are always recomputed from a summed numerator and
  denominator (LTIFR, % female, turnover rate), never averaged across months.

## Project layout

```
app/
  config.py              Dev/Test/Prod config, all from environment variables
  extensions.py          db, migrate, jwt, cors, limiter — single shared instances
  models/                One file per domain area (see "Database" below)
  schemas/                Marshmallow request-validation schemas
  security/
    passwords.py          argon2/bcrypt hashing
    permissions.py         "does this user's scope cover project X" — the access-boundary logic
    decorators.py           @roles_required, @project_scope_required, etc.
  services/               Framework-agnostic business logic (formulas, validation, consolidation,
                           emissions, risk rules, assessment independence rule, report rendering,
                           AI provider abstraction, notifications, storage abstraction)
  routes/                 One blueprint per module, thin — they validate input, call a service,
                           commit, audit-log, return JSON. No business logic lives in a route.
  tasks/                  Celery task wrappers around the same services
  celery_app.py           Celery app factory bound to the Flask app context
seeds/                    seed_brsr.py (BRSR master), seed_org.py (hierarchy), seed_demo.py (users/
                           vendors/submissions/risks/disclosures/opinions), run_seed.py (orchestrator)
tests/                    pytest — formulas (no DB), auth, full workflow, permission boundaries
docker/                   Dockerfile + docker-compose.yml (mysql, redis, minio, api, worker, beat)
migrations/               Alembic files are generated locally by `flask db init` — see its README
```

## Database

Every table from the architecture brief's schema overview exists, grouped into the same areas:
**AUTH** (`users`, `roles`, `user_roles`, `user_scopes`) · **ORGANIZATION** (`organizations`,
`organization_relationships`, `business_units`, `projects`, `reporting_periods`) · **BRSR**
(`brsr_framework_versions`, `brsr_sections`, `brsr_principles`, `brsr_indicators`,
`brsr_validation_rules`, `brsr_core_attributes`, `sdgs`) · **ESG** (`esg_submissions`,
`esg_values`, `submission_versions`) · **EVIDENCE** (`documents`, `metric_evidence`) ·
**WORKFLOW** (`review_actions`, `audit_logs`) · **VALUE CHAIN** (`vendors`,
`vendor_project_links`, `vendor_requests`, `vendor_values`, `vendor_reviews`,
`scope3_methodologies`) · **EMISSIONS** (`emission_factors`, `emission_activities`,
`emission_calculations`) · **RISK** (`risks`, `risk_assessments`, `risk_actions`) ·
**ASSESSMENT** (`assessment_engagements`, `assessment_samples`, `assessment_findings`) ·
**REPORTING** (`reports`, `report_files`) · **SYSTEM** (`notifications`) · plus a
**DISCLOSURES** area (`entity_disclosures`, `business_activities`, `products_services`,
`policy_coverage`, `commitments`, `governance_reviews`, `core8_fairness`, `core9_openness`) for
Section A/B and BRSR Core 8 & 9, which are entity-level, not site-level, and were the weakest
part of the frontend-only prototype per the company's round-2 review.

The single most important table is `brsr_indicators` — every P1–P9 field the frontend's
`data/brsr.js` hard-coded is now a row here, with its tier, unit, required/evidence-required
flags, BRSR Core attribute link, and **aggregation method**. Includes both fixes from the
company's round-2 frontend review baked in at the data layer: `p5_belowmin` (minimum-wage
non-compliance correctly under Human Rights, not Employee Wellbeing) and BRSR Core 8 & 9 modelled
as their real separate sub-metrics (`core8_fairness`, `core9_openness` tables) instead of one
blended "RPT share" figure.

## Security

- **Authentication**: JWT access token (short-lived, header) + refresh token (longer-lived,
  HTTP-only cookie). Passwords are Argon2-hashed (bcrypt is a one-line config swap); never stored
  in plaintext or logged.
- **Authorization**: every protected route uses `@roles_required(...)` and, for anything that
  takes a project/business-unit/organization/vendor id, `@project_scope_required()` (etc.) from
  `app/security/decorators.py`, which calls into `app/security/permissions.py` to confirm the
  user's granted scope actually covers that id — not just that their role is allowed to use the
  endpoint in general. `tests/test_permissions.py` exercises this directly.
- **Rate limiting**: Flask-Limiter on `/auth/login`, `/auth/register`, `/auth/forgot-password`.
- **File upload safety**: extension allow-list + per-type size caps + SHA-256 dedup, enforced in
  `services/storage_service.py::validate_upload` before anything reaches disk/MinIO.
- **Audit log**: `utils/audit.py::record()` is called inside the same transaction as the change it
  describes (approve/reject/correction, risk edits, disclosure saves, config changes, vendor
  review decisions, assessment opinions) so an action and its audit trail commit or roll back
  together — never one without the other.
- **Independence rule**: `services/assessment_service.py::validate_engagement_payload` blocks
  recording an *assurance* opinion against a provider typed as internal audit, server-side,
  regardless of what the client sends — see `tests/test_permissions.py::test_assurance_independence_rule_blocks_internal_auditor`.

## Honest limitations (what's scaffolded vs. fully wired)

- **AI document extraction** (`POST /ai/document-extract`) returns `501 Not Implemented`. The
  hook (`services/validation_service.py::compare_evidence`) exists and is where a real OCR/invoice
  -parsing pipeline would plug in, matching the frontend's "Verified vs Discrepancy" evidence
  concept — but no OCR provider is wired up in this pass.
- **Celery** defaults to `CELERY_TASK_ALWAYS_EAGER=true` (synchronous, in-request) so the demo
  needs no running worker. `app/tasks/reports.py::generate_report_task` is the async form of the
  same report-building logic `routes/reports.py` calls synchronously today; switching the route to
  enqueue-only is a few lines once a worker is actually deployed.
- **Email** (password reset, deadline reminders) logs instead of sending — `app/tasks/notifications.py::send_email`
  is the single place an SMTP/SES/SendGrid integration would be added.
- **MinIO** is supported and is what `docker-compose.yml` wires up, but the default `.env.example`
  uses the local-disk fallback so you don't need MinIO running just to try the API.
- **Migrations**: `migrations/` ships without generated Alembic files (see its own README) — they're
  one `flask db init && flask db migrate` away and are environment/library-version-specific, so
  committing a hand-written copy risked drifting from whatever Alembic version actually installs.

See `FRONTEND_INTEGRATION.md` for how to point the existing React app at this API instead of
`localStorage`, module by module, in the order the architecture brief recommended.

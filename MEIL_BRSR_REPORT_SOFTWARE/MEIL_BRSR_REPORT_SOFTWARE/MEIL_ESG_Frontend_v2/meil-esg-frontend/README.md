# MEIL BRSR Hub – ESG Reporting Software (frontend)

Web portal for Megha Engineering & Infrastructures Ltd (MEIL) to capture, verify, consolidate and report ESG data
per SEBI BRSR — at **group, subsidiary, business-unit and project** level (Problem Statement 08).

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```
No new dependencies were added. State is held in a client-side store persisted to `localStorage`
(key `meil-esg-store-v2`); use **Reset demo data** on the login screen to restore the seed.

## Workflow implemented
```
Site Operator ──enter data + evidence──▶ Submit
      ▲                                     │
      └──── Correction required ◀── BU Manager: Review & Validate ──▶ Approved
                                                                        │
                                                          Group ESG Admin (auto-consolidation)
                                                          Project → BU → Subsidiary → Group
                                                                        │
                                       BRSR mapping → BRSR Core → Reports (PDF / XML / CSV / JSON)
Vendor ─ESG data + evidence─▶ Assurance review ─▶ Scope 3 (revenue-share allocation) ─▶ Group
Assurance Auditor: samples approved BRSR Core packets, records status, issues opinions per attribute
```

## Roles & screens (5 roles)
| Role | Routes |
|---|---|
| Group ESG Admin | `/admin` command center · `/admin/organization` · `/admin/consolidation` · `/admin/brsr-mapping` · `/admin/disclosures` (Section A/B, Core 8 & 9) · `/admin/value-chain` · `/admin/risk-management` · `/admin/sdg` · `/admin/ai-insights` · `/admin/reports` |
| BU Manager | `/manager` · `/manager/approvals` · `/manager/sites` · `/manager/data-entry` (on behalf of a site) |
| Site Operator | `/operator` · `/operator/data-entry` (P1–P9) · `/operator/submissions` |
| Vendor | `/vendor` · `/vendor/submit` · `/vendor/history` |
| Assurance Auditor | `/auditor` · `/auditor/vendors` · `/auditor/opinions` |

## Code map
- `src/data/brsr.js` – BRSR data dictionary (P1–P9 Essential/Leadership, BRSR Core attributes, SDGs, vendor fields)
- `src/data/org.js` – 5 subsidiaries → 10 BUs → 250 projects + workflow seed data
- `src/lib/consolidate.js` – roll-up engine, derived KPIs (Scope 1/2, intensity, LTIFR…)
- `src/lib/validate.js` – submission validation + reviewer checklist
- `src/lib/exporters.js` – report model, PDF(print) / CSV / JSON / XBRL-style XML
- `src/store/AppStore.jsx` – workflow state machine, audit log, notifications

## To connect a real backend
Replace the reducer actions in `AppStore.jsx` with calls in `src/services/api.js` (axios instance already there).
Replace `EvidenceViewer` (in `components/ui.jsx`) with a signed-URL file preview. Replace demo role picker with SSO.
Load emission factors (`EF` in `data/brsr.js`) from an admin-controlled table — current values are illustrative.

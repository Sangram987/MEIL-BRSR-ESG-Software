# Gap analysis: original frontend vs Problem Statement 08

Problem: MEIL needs SEBI-BRSR-compliant ESG reporting at **group, subsidiary and business-unit** granularity across
~250 projects. Your reviewed flow: Site Operator → BU Manager → Group Admin, plus vendor/value-chain and assurance.

## Gaps found in the original zip → what was built

| # | Gap in original | Severity | Fix |
|---|---|---|---|
| 1 | **No roll-up logic.** Dashboard numbers were hard-coded; nothing summed Project→BU→Subsidiary→Group. | Critical | `lib/consolidate.js` + **Consolidation** screen with drill-down, reconciliation check, scope/boundary switch |
| 2 | **Reporting boundary** (Standalone vs Consolidated, JV inclusion) absent – BRSR requires it stated & applied consistently. | Critical | Boundary switch in `HierarchyFilter`, entity relation (parent/subsidiary/JV) editable in Organization |
| 3 | **Only 3 of 9 principles had fields** (P1, P3, P6); others showed a placeholder "Standard Disclosure Metric". | Critical | Full P1–P9 dictionary, Essential + Leadership, units, required flags (~70 indicators) |
| 4 | **BRSR Core (9 attributes)** only mentioned in badges. | High | Core-tagged indicators, `BRSR Mapping` screen, Core section in report, per-attribute assurance opinions |
| 5 | **Section A & B** (general disclosures, policies, governance) missing; Core attrs 8 & 9 (entity-level finance) missing. | High | `Disclosures` screen |
| 6 | **Evidence was one file per form**, not per metric; no validation. | High | Per-metric evidence, required-field/logic/spike checks, live calculations |
| 7 | **Approval only Approve/Reject.** No "Correction required" loop, no checklist, no comments, operator couldn't see/fix rejections. | High | 3-way review with checklist + mandatory comment; operator correction banner → resubmit; locked once submitted/approved |
| 8 | **Approvals queue was static mock**; approving didn't affect anything. | High | Central workflow store: submit → review → consolidation, audit log & notifications update |
| 9 | **No Vendor/Contractor role** – only an admin-side table with a fake "send request". | High | Vendor portal (request → submit + evidence → resubmit); Scope 3 revenue-share allocation |
| 10 | **No Assurance/Auditor role**; "Assurance Status" was a label. Internal approval ≠ statutory assurance. | High | Auditor workbench (separate from approval), vendor review, opinions |
| 11 | **No auth / role separation.** Home cards jumped straight into any portal. | High | Login (demo roles) + `ProtectedRoute`; role-appropriate redirects |
| 12 | Broken link: Manager sidebar/`ManagerPortal` → `/manager/data-entry` had **no route**. | Bug | Route added (manager enters on behalf of a site, flagged in audit trail) |
| 13 | `Dashboard.jsx` unused and an exact duplicate of `AdminPortal.jsx`; `HierarchyFilter.jsx` and `index.css`-animations empty/missing (`animate-in` classes did nothing). | Cleanup | Removed duplicate; real `HierarchyFilter`; animation utilities added to `index.css` |
| 14 | **Organization tree**: 7 hard-coded projects, "Add" buttons did nothing, no 250-site scale. | Medium | 250-project seeded hierarchy, working add subsidiary/BU/project, collapsible, searchable |
| 15 | **Reports**: buttons did nothing; no scope selection beyond a static select. | High | Report at any level; PDF (print), XBRL-style XML, CSV, JSON; readiness checks |
| 16 | Risk matrix cells hard-coded; register not editable. | Medium | Matrix computed from register, add/edit risks, KPI link |
| 17 | AI page was static. | Medium | Live anomaly detection from submitted data + linear-trend forecast (labelled as such) |
| 18 | Map: 4 hard-coded pins. | Medium | All 250 projects, status-coloured, respects hierarchy filter |
| 19 | Missing: SDG mapping (problem statement cites UN SDGs), notifications, audit trail per action, month/FY selection, mobile-friendly field flow. | Medium | SDG screen, bell notifications, append-only audit log, FY & period selectors |

## Honest limitations
- **Data is client-side demo data** (deterministic seed + localStorage). Numbers are illustrative; emission factors are placeholders.
- Evidence "viewer" is a placeholder preview – no real file storage yet.
- XML export is *XBRL-style*; a filing-ready file needs the official SEBI/NSE taxonomy mapping.
- Role picker is a demo stand-in for real authentication.
- "AI" is rule-based checks + linear regression, not a trained model.

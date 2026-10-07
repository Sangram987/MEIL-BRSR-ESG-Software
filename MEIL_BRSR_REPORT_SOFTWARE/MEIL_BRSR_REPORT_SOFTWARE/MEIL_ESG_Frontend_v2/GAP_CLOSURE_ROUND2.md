# Round 2 — closing the BRSR-accuracy gaps

This round is a direct response to the company's detailed review of the round-1 frontend (the
51-point critique). It does **not** rebuild the app from scratch — it corrects the data model and
UI so the same architecture actually maps to SEBI's BRSR format, and it is honest in the UI about
what is a real disclosure vs. an internal estimate. Framework/library versions are unchanged.

## What changed, mapped to the critique

**Section A (general disclosures) — was a dozen flat fields, now the real Annexure I shape**
`src/pages/admin/Disclosures.jsx`, `src/data/org.js` (seed), `src/data/brsr.js` (`STAKEHOLDER_GROUPS`)
- Business activities & products/services as editable tables with % turnover, not free text
- Plants/offices (national/international), markets served, exports %
- Employees **and** workers, each Permanent / Other-than-permanent, by gender, with live % computed
- Differently-abled employees & workers, same breakdown
- Women on Board & in KMP, with % computed
- 3-year turnover-rate trend (current / previous / prior-to-previous), employees & workers, M/F/T
- Holding/subsidiary/associate/JV table — reads live from the Organization hierarchy (single source of truth) instead of a duplicate manual table
- Stakeholder grievance redressal — one row per SEBI-listed stakeholder group, mechanism + current/previous filed & pending
- **Material ESG issues (Q24)** — no longer a separate form to fill twice: it's pulled live from the Risk Matrix register (see below)

**Section B (policies & governance) — was 8 fields, now Q1–Q12 shaped**
- Per-principle: has policy / board-approved / **translated to procedure** / **extends to value chain** / codes & certifications / link / reason-if-not-covered
- Commitments & targets as a baseline → current → status table, one row per principle
- Governance review table (reviewed by / frequency) per principle
- External assessment of policies (agency + yes/no)

**P3 → P5 correction**
- "Workers paid below minimum wage" moved from Principle 3 (Employee Wellbeing) to Principle 5 (Human Rights), where SEBI's format actually places it. `src/data/brsr.js`
- P5 also gained a general human-rights grievance count, value-chain HR due-diligence, and corrective-actions fields
- P8 relabelled precisely: "MSME procurement" → **direct** procurement from MSMEs; added a dedicated "sourced within India" field; "wages in smaller towns" is now reported as a % of total wages in the report/Core view, not a bare ₹ amount
- P9 gained advertising and restrictive-trade-practice complaint categories

**BRSR Core 8 & 9 — the weakest part of round 1 — fully redesigned**
`CORE8_FAIRNESS`, `CORE9_OPENNESS` in `src/data/brsr.js`; edited in Disclosures → "BRSR Core 8 & 9" tab
- Fairness: data-breach count, data-breach ratio, accounts-payable days — as separate metrics, not one blended figure
- Openness: trading-house purchases % + count + top-10 %, dealer/distributor sales % + count + top-10 %, and **four separate** related-party-transaction percentages (purchases / sales / loans / investments) instead of one "RPT share"

**Risk Matrix — now a management tool that feeds a real disclosure, without overstating itself**
`src/pages/admin/RiskMatrix.jsx`, `src/data/org.js`
- Added Risk **or Opportunity** type (the format asks for both), rationale, time horizon, an owner-facing mitigation/adaptation field, and a separate **qualitative** "financial implication" field for BRSR
- Added an explicit "Include in BRSR Section A24" checkbox — only checked risks surface in the disclosure
- The internal ₹ Cr exposure figure is kept, but labelled "management figure only" and is **never** pushed into the BRSR material-issues text, per the critique's specific warning that BRSR's financial-implications field is qualitative, not a forward-looking number
- Disclosures page reads this register live and links back to it — one register, no duplicate data entry

**Value chain — terminology and methodology now honest and configurable**
`src/pages/admin/ValueChain.jsx`, `state.valueChainConfig`
- Renamed from "Value-Chain ESG Management" to "Value-Chain ESG Disclosures"; every Scope-3 figure is labelled an **internal allocation estimate**, not a SEBI-prescribed calculation
- New "Applicability & methodology" panel: applicability (voluntary-top-250 / mandatory / not applicable) and allocation method are now a stored configuration, not a hard-coded rule — so it can be updated as SEBI's rules evolve without a code change

**Assessment vs. Assurance — SEBI's actual flexibility, reflected everywhere**
`src/pages/auditor/Opinions.jsx`, `src/store/AppStore.jsx` (`issueOpinion`)
- Opinions now record **mode** (Assessment or Assurance), provider, provider type, standard used (assurance only), scope, methodology, evidence tested, exceptions, and an explicit **independence declaration** the reviewer must tick before saving — the form blocks recording "Assurance" against an internal-audit provider, per SEBI's independence rule
- Role label changed from "Assurance Auditor" to "Assessment / Assurance Auditor"; workbench and Reports wording follow the same pattern

**Reports — no longer implies it's the filed document**
`src/pages/admin/Reports.jsx`, `src/lib/exporters.js`
- "Official BRSR report" → **"BRSR draft / preview"**, with a visible warning banner on the printed output that it is not a board-signed, filed report
- Report package selector: Comprehensive BRSR vs. **BRSR Core only** (Core is presented as a subset, not a replacement), value-chain include/not-applicable, and assessment/assurance/not-applicable — all three feed the actual export content
- XML export explicitly labelled "XBRL-style draft instance — not a filing-ready XBRL taxonomy instance" in both the UI and the file itself

**Everything else the critique said to keep — kept, untouched in spirit**
Group → Subsidiary → BU → Project hierarchy, the 5-role workflow, evidence-per-metric, the
consolidation engine, current-vs-previous-year in the report model, audit log, SDG mapping, AI
insights, and the map — all still there; only their labelling and a few data points changed.

## Still open (explicitly out of scope for a frontend-only pass)
- Data is still a deterministic client-side seed + `localStorage`; there is no `brsr_indicators`
  master table or real database behind it. The critique's SQL schema (§41–43) is a backend project.
- Evidence is still a filename placeholder, not a stored file with a hash/verification pipeline (§44–45).
- Waste is still a handful of fixed columns rather than a normalised `waste_records` table (§16).
- Emission factors are still illustrative constants in `brsr.js`, not a versioned, sourced table (§14).
- The monthly-vs-annual aggregation rule the critique asked for (§38) was already correct in the
  consolidation engine — flows sum, headcount averages, LTIFR is recalculated from summed
  numerator/denominator rather than averaged — so no change was needed there.

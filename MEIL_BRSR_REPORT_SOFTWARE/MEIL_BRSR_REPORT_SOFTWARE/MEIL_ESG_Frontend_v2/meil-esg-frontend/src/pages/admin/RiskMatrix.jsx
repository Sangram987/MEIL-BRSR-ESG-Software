import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Plus,
  Pencil,
  FileCheck2,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

import { useApp } from '../../store/AppStore';

import {
  Btn,
  Card,
  CardHeader,
  Modal,
  PageHeader,
  Badge,
  inputCls,
  labelCls,
} from '../../components/ui';

import riskApi from '../../services/riskApi';


// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const LEVEL_LABEL = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
};

const TYPE_LABEL = {
  RISK: 'Risk',
  OPPORTUNITY: 'Opportunity',
};

const TYPE_TONE = {
  Risk: 'rose',
  Opportunity: 'emerald',
};

const STATUS_OPTIONS = [
  {
    value: 'Open',
    label: 'Open',
  },
  {
    value: 'Mitigating',
    label: 'Mitigating',
  },
  {
    value: 'Monitoring',
    label: 'Monitoring',
  },
  {
    value: 'Closed',
    label: 'Closed',
  },
];

const CATEGORY_OPTIONS = [
  'Environmental',
  'Social',
  'Governance',
];

const TIME_HORIZON_OPTIONS = [
  'Short-term (0–1 yr)',
  'Medium-term (1–3 yrs)',
  'Long-term (3+ yrs)',
  'Ongoing',
];

const DEFAULT_RISK = {
  title: '',
  type: 'Risk',
  category: 'Environmental',
  likelihood: 2,
  impact: 2,
  financial: '',
  owner: '',
  mitigation: '',
  status: 'Open',
  rationale: '',
  timeHorizon: 'Short-term (0–1 yr)',
  financialImplication: '',
  includeInBrsr: false,
};


// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const scoreOf = (risk) =>
  Number(risk?.likelihood || 0) *
  Number(risk?.impact || 0);


const riskTone = (risk) => {
  const score = scoreOf(risk);

  if (score >= 6) {
    return 'rose';
  }

  if (score >= 3) {
    return 'amber';
  }

  return 'emerald';
};


const matrixCellClass = (
  likelihood,
  impact
) => {
  const score =
    likelihood * impact;

  if (score >= 6) {
    return 'bg-rose-100';
  }

  if (score >= 3) {
    return 'bg-amber-100';
  }

  return 'bg-emerald-100';
};


const normalizeRiskForEdit = (
  risk
) => ({
  ...DEFAULT_RISK,

  ...risk,

  likelihood:
    Number(
      risk?.likelihood || 2
    ),

  impact:
    Number(
      risk?.impact || 2
    ),

  financial:
    risk?.financial ?? '',

  type:
    risk?.type === 'Opportunity'
      ? 'Opportunity'
      : 'Risk',

  status:
    STATUS_OPTIONS.some(
      (item) =>
        item.value === risk?.status
    )
      ? risk.status
      : 'Open',

  category:
    CATEGORY_OPTIONS.includes(
      risk?.category
    )
      ? risk.category
      : 'Environmental',

  includeInBrsr:
    Boolean(
      risk?.includeInBrsr
    ),
});


// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function RiskMatrix() {
  const {
    org,
    toast,
  } = useApp();

  const navigate =
    useNavigate();


  // ────────────────────────────────
  // State
  // ────────────────────────────────

  const [
    risks,
    setRisks,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    edit,
    setEdit,
  ] = useState(null);

  const [
    highlightedId,
    setHighlightedId,
  ] = useState(null);


  // ────────────────────────────────
  // Load real backend risks
  // ────────────────────────────────

  const loadRisks =
    async () => {
      try {
        setLoading(true);

        const rows =
          await riskApi.listRisks();

        setRisks(rows);
      } catch (error) {
        toast(
          error?.message ||
            'Failed to load risks.',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };


  useEffect(() => {
    loadRisks();
  }, []);


  // ────────────────────────────────
  // Sorted risks
  // ────────────────────────────────

  const sortedRisks =
    useMemo(
      () =>
        [...risks].sort(
          (a, b) =>
            scoreOf(b) -
            scoreOf(a)
        ),
      [risks]
    );


  // ────────────────────────────────
  // Summary values
  // ────────────────────────────────

  const totalExposure =
    useMemo(
      () =>
        risks.reduce(
          (total, risk) =>
            total +
            Number(
              risk.financial || 0
            ),
          0
        ),
      [risks]
    );


  const materialIssues =
    useMemo(
      () =>
        risks.filter(
          (risk) =>
            Boolean(
              risk.includeInBrsr
            )
        ),
      [risks]
    );


  const highRisks =
    useMemo(
      () =>
        risks.filter(
          (risk) =>
            scoreOf(risk) >= 6 &&
            risk.type === 'Risk'
        ),
      [risks]
    );


  // ────────────────────────────────
  // Create new risk
  // ────────────────────────────────

  const openCreate =
    () => {
      setEdit({
        ...DEFAULT_RISK,
      });
    };


  // ────────────────────────────────
  // Edit existing risk
  // ────────────────────────────────

  const openEdit =
    (risk) => {
      setEdit(
        normalizeRiskForEdit(
          risk
        )
      );
    };


  // ────────────────────────────────
  // Input helper
  // ────────────────────────────────

  const updateEdit =
    (key, value) => {
      setEdit(
        (current) => ({
          ...current,
          [key]: value,
        })
      );
    };


  // ────────────────────────────────
  // Save risk to backend
  // ────────────────────────────────

  const save =
    async () => {
      if (!edit) {
        return;
      }


      const title =
        String(
          edit.title || ''
        ).trim();

      const mitigation =
        String(
          edit.mitigation || ''
        ).trim();

      const rationale =
        String(
          edit.rationale || ''
        ).trim();


      // Validation
      if (!title) {
        toast(
          'Risk title is required.',
          'error'
        );
        return;
      }

      if (!mitigation) {
        toast(
          'Mitigation / adaptation plan is required.',
          'error'
        );
        return;
      }

      if (
        edit.includeInBrsr &&
        !rationale
      ) {
        toast(
          'Rationale is required when this risk is included in BRSR Section A, Q24.',
          'error'
        );
        return;
      }


      const probability =
        Number(
          edit.likelihood
        );

      const impact =
        Number(
          edit.impact
        );


      if (
        ![1, 2, 3].includes(
          probability
        )
      ) {
        toast(
          'Likelihood must be Low, Medium or High.',
          'error'
        );
        return;
      }

      if (
        ![1, 2, 3].includes(
          impact
        )
      ) {
        toast(
          'Impact must be Low, Medium or High.',
          'error'
        );
        return;
      }


      try {
        setSaving(true);


        const payload = {
          title,

          type:
            edit.type ===
            'Opportunity'
              ? 'OPPORTUNITY'
              : 'RISK',

          category:
            edit.category,

          rationale,

          probability,

          impact,

          financialExposureCr:
            Number(
              edit.financial || 0
            ),

          financialImplication:
            String(
              edit.financialImplication ||
              ''
            ).trim(),

          timeHorizon:
            edit.timeHorizon || '',

          owner:
            String(
              edit.owner || ''
            ).trim(),

          mitigation,

          /*
           * Your current BRSR indicator IDs
           * are strings such as "p6_grid",
           * while the backend RiskSchema expects
           * an Integer linkedIndicatorId.
           *
           * Therefore we intentionally send null
           * until both sides use the same ID type.
           */
          linkedIndicatorId:
            null,

          /*
           * Keep risk associated with the
           * current backend organization when
           * available.
           */
          organizationId:
            org?.id || null,

          projectId:
            null,

          status:
            String(
              edit.status || 'Open'
            ).toUpperCase(),

          includeInBrsr:
            Boolean(
              edit.includeInBrsr
            ),
        };


        let savedRisk;


        // Existing risk
        if (edit.id) {
          savedRisk =
            await riskApi.updateRisk(
              edit.id,
              payload
            );


          setRisks(
            (current) =>
              current.map(
                (risk) =>
                  risk.id ===
                  edit.id
                    ? savedRisk
                    : risk
              )
          );


          toast(
            'Risk updated successfully.'
          );
        }

        // New risk
        else {
          savedRisk =
            await riskApi.createRisk(
              payload
            );


          setRisks(
            (current) => [
              savedRisk,
              ...current,
            ]
          );


          toast(
            'Risk created successfully.'
          );
        }


        setEdit(null);
      } catch (error) {
        toast(
          error?.message ||
            'Failed to save risk.',
          'error'
        );
      } finally {
        setSaving(false);
      }
    };


  // ────────────────────────────────
  // Render
  // ────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="ESG Risk Management"
        subtitle={`Live backend risk register · ${risks.length} entries · ${materialIssues.length} included in BRSR Section A, Q24 · Internal exposure ₹${totalExposure.toFixed(1)} Cr`}
        actions={
          <>
            <Btn
              tone="ghost"
              onClick={() =>
                navigate(
                  '/admin/disclosures'
                )
              }
            >
              <FileCheck2
                size={16}
              />
              View in Section A
            </Btn>


            <Btn
              tone="ghost"
              onClick={
                loadRisks
              }
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? 'animate-spin'
                    : ''
                }
              />
              Refresh
            </Btn>


            <Btn
              onClick={
                openCreate
              }
            >
              <Plus
                size={16}
              />
              Add risk / opportunity
            </Btn>
          </>
        }
      />


      {/* Information banner */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800 leading-relaxed">
        This register is a{' '}
        <b>
          management tool
        </b>
        . Risks marked{' '}
        <b>
          Include in BRSR
        </b>{' '}
        are surfaced in Section A, Q24.
        The ₹ Cr exposure is an internal
        management figure; the qualitative
        financial implication is the narrative
        used for BRSR.
      </div>


      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <Card>
          <p className="text-xs font-bold text-slate-500">
            Total risks / opportunities
          </p>

          <p className="mt-2 text-2xl font-black text-slate-900">
            {risks.length}
          </p>
        </Card>


        <Card>
          <p className="text-xs font-bold text-slate-500">
            High-score risks
          </p>

          <p className="mt-2 text-2xl font-black text-rose-600">
            {highRisks.length}
          </p>
        </Card>


        <Card>
          <p className="text-xs font-bold text-slate-500">
            Internal exposure
          </p>

          <p className="mt-2 text-2xl font-black text-slate-900">
            ₹
            {totalExposure.toFixed(
              1
            )}{' '}
            Cr
          </p>
        </Card>

      </div>


      {/* Main area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Matrix */}
        <Card>

          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle
              size={17}
              className="text-slate-500"
            />

            <h2 className="text-sm font-bold text-slate-900">
              Likelihood × impact
            </h2>
          </div>


          <div className="flex gap-2">

            <div className="flex flex-col justify-between py-1 text-[11px] font-semibold text-slate-400 text-right pr-1">
              <span>
                High
              </span>

              <span>
                Med
              </span>

              <span>
                Low
              </span>
            </div>


            <div className="flex-1">

              <div className="grid grid-cols-3 grid-rows-3 gap-1 h-64">

                {[3, 2, 1].flatMap(
                  (likelihood) =>
                    [1, 2, 3].map(
                      (impact) => {

                        const here =
                          risks.filter(
                            (risk) =>
                              Number(
                                risk.likelihood
                              ) ===
                                likelihood &&
                              Number(
                                risk.impact
                              ) ===
                                impact
                          );


                        return (
                          <div
                            key={`${likelihood}-${impact}`}
                            className={`${matrixCellClass(
                              likelihood,
                              impact
                            )} rounded-lg flex flex-wrap gap-1 items-center justify-center p-1`}
                          >

                            {here.map(
                              (risk) => (
                                <button
                                  key={
                                    risk.id
                                  }
                                  type="button"
                                  onMouseEnter={() =>
                                    setHighlightedId(
                                      risk.id
                                    )
                                  }
                                  onMouseLeave={() =>
                                    setHighlightedId(
                                      null
                                    )
                                  }
                                  onClick={() =>
                                    openEdit(
                                      risk
                                    )
                                  }
                                  aria-label={
                                    risk.title
                                  }
                                  className={`h-7 min-w-7 px-1.5 rounded-full text-[10px] font-bold text-white shadow transition ${highlightedId ===
                                    risk.id
                                      ? 'ring-2 ring-slate-900 ring-offset-1'
                                      : ''} ${
                                    risk.type ===
                                    'Opportunity'
                                      ? 'bg-emerald-600'
                                      : riskTone(
                                          risk
                                        ) ===
                                        'rose'
                                      ? 'bg-rose-600'
                                      : riskTone(
                                          risk
                                        ) ===
                                        'amber'
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-600'
                                  }`}
                                >
                                  {String(
                                    risk.code ||
                                      risk.id
                                  ).slice(
                                    -3
                                  )}
                                </button>
                              )
                            )}

                          </div>
                        );
                      }
                    )
                )}

              </div>


              <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-1 px-6">
                <span>
                  Low
                </span>

                <span>
                  Medium
                </span>

                <span>
                  High
                </span>
              </div>


              <p className="text-center text-[11px] text-slate-400 mt-1">
                Business impact →
              </p>

            </div>
          </div>

        </Card>


        {/* Register */}
        <Card
          pad={false}
          className="lg:col-span-2"
        >

          <CardHeader
            title="Risk & opportunity register"
            subtitle="Sorted by likelihood × impact score"
          />


          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading risks from Flask backend…
            </div>
          ) : sortedRisks.length ===
            0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No risks or opportunities found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">

              {sortedRisks.map(
                (risk) => {

                  const score =
                    scoreOf(
                      risk
                    );

                  const tone =
                    riskTone(
                      risk
                    );


                  return (
                    <div
                      key={
                        risk.id
                      }
                      className={`p-5 transition ${
                        highlightedId ===
                        risk.id
                          ? 'bg-slate-50'
                          : ''
                      }`}
                      onMouseEnter={() =>
                        setHighlightedId(
                          risk.id
                        )
                      }
                      onMouseLeave={() =>
                        setHighlightedId(
                          null
                        )
                      }
                    >

                      {/* top */}
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">

                        <div className="min-w-0">

                          <div className="flex items-center gap-2 mb-1 flex-wrap">

                            <span className="text-xs font-bold text-slate-500">
                              {risk.code ||
                                String(
                                  risk.id
                                ).slice(
                                  -8
                                )}
                            </span>


                            <Badge
                              tone={
                                TYPE_TONE[
                                  risk.type
                                ] ||
                                'slate'
                              }
                            >
                              {
                                risk.type
                              }
                            </Badge>


                            <Badge>
                              {
                                risk.category
                              }
                            </Badge>


                            <Badge tone="blue">
                              {
                                risk.status
                              }
                            </Badge>


                            {risk.includeInBrsr && (
                              <Badge tone="violet">
                                In Section A24
                              </Badge>
                            )}

                          </div>


                          <h3 className="font-bold text-slate-900">
                            {risk.title}
                          </h3>


                          {risk.rationale && (
                            <p className="text-xs text-slate-500 mt-1 max-w-xl">
                              {
                                risk.rationale
                              }
                            </p>
                          )}

                        </div>


                        <div className="flex items-center gap-2 shrink-0">

                          <Badge
                            tone={
                              tone
                            }
                          >
                            L:{' '}
                            {
                              LEVEL_LABEL[
                                risk.likelihood
                              ]
                            }{' '}
                            · I:{' '}
                            {
                              LEVEL_LABEL[
                                risk.impact
                              ]
                            }{' '}
                            · Score:{' '}
                            {score}
                          </Badge>


                          <button
                            type="button"
                            onClick={() =>
                              openEdit(
                                risk
                              )
                            }
                            aria-label="Edit risk"
                            className="p-1.5 text-slate-400 hover:text-blue-600"
                          >
                            <Pencil
                              size={
                                15
                              }
                            />
                          </button>

                        </div>

                      </div>


                      {/* bottom */}
                      <div className="bg-slate-100 rounded-lg p-3 text-sm flex flex-col sm:flex-row justify-between gap-4">

                        <div className="min-w-0">

                          <span className="block text-[11px] font-bold text-slate-500">
                            Mitigation / adaptation · owner:{' '}
                            {risk.owner ||
                              'Unassigned'}
                          </span>


                          <p className="text-slate-700 font-medium mt-0.5">
                            {
                              risk.mitigation
                            }
                          </p>


                          {risk.financialImplication && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              <b>
                                BRSR financial implication:
                              </b>{' '}
                              {
                                risk.financialImplication
                              }
                            </p>
                          )}


                          {risk.timeHorizon && (
                            <p className="text-[11px] text-slate-400 mt-1">
                              Horizon:{' '}
                              {
                                risk.timeHorizon
                              }
                            </p>
                          )}

                        </div>


                        <div className="sm:text-right shrink-0">

                          <span className="block text-[11px] font-bold text-slate-500">
                            Internal est. exposure
                          </span>


                          <p className="text-rose-600 font-black">
                            ₹
                            {Number(
                              risk.financial ||
                                0
                            ).toFixed(
                              1
                            )}{' '}
                            Cr
                          </p>


                          <span className="text-[10px] text-slate-400">
                            management figure only
                          </span>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </Card>

      </div>


      {/* Edit/Create modal */}
      <Modal
        open={Boolean(
          edit
        )}
        onClose={() =>
          !saving &&
          setEdit(null)
        }
        title={
          edit?.id
            ? `Edit ${edit.code || edit.id}`
            : 'Add ESG risk / opportunity'
        }
        wide
        footer={
          <>
            <Btn
              tone="ghost"
              onClick={() =>
                setEdit(null)
              }
              disabled={saving}
            >
              Cancel
            </Btn>


            <Btn
              onClick={save}
              disabled={saving}
            >
              {saving
                ? 'Saving…'
                : 'Save'}
            </Btn>
          </>
        }
      >

        {edit && (
          <div className="grid md:grid-cols-2 gap-4">

            {/* Title */}
            <div className="md:col-span-2">

              <label
                className={
                  labelCls
                }
              >
                Title *
              </label>

              <input
                className={
                  inputCls
                }
                value={
                  edit.title
                }
                onChange={(e) =>
                  updateEdit(
                    'title',
                    e.target.value
                  )
                }
                placeholder="e.g. Water scarcity affecting project operations"
              />

            </div>


            {/* Type */}
            <div>

              <label
                className={
                  labelCls
                }
              >
                Risk or opportunity?
              </label>

              <select
                className={
                  inputCls
                }
                value={
                  edit.type
                }
                onChange={(e) =>
                  updateEdit(
                    'type',
                    e.target.value
                  )
                }
              >
                <option>
                  Risk
                </option>

                <option>
                  Opportunity
                </option>
              </select>

            </div>


            {/* Category */}
            <div>

              <label
                className={
                  labelCls
                }
              >
                Category
              </label>

              <select
                className={
                  inputCls
                }
                value={
                  edit.category
                }
                onChange={(e) =>
                  updateEdit(
                    'category',
                    e.target.value
                  )
                }
              >

                {CATEGORY_OPTIONS.map(
                  (category) => (
                    <option
                      key={
                        category
                      }
                    >
                      {category}
                    </option>
                  )
                )}

              </select>

            </div>


            {/* Status */}
            <div>

              <label
                className={
                  labelCls
                }
              >
                Status
              </label>

              <select
                className={
                  inputCls
                }
                value={
                  edit.status
                }
                onChange={(e) =>
                  updateEdit(
                    'status',
                    e.target.value
                  )
                }
              >

                {STATUS_OPTIONS.map(
                  (status) => (
                    <option
                      key={
                        status.value
                      }
                      value={
                        status.value
                      }
                    >
                      {
                        status.label
                      }
                    </option>
                  )
                )}

              </select>

            </div>


            {/* Horizon */}
            <div>

              <label
                className={
                  labelCls
                }
              >
                Time horizon
              </label>

              <select
                className={
                  inputCls
                }
                value={
                  edit.timeHorizon
                }
                onChange={(e) =>
                  updateEdit(
                    'timeHorizon',
                    e.target.value
                  )
                }
              >

                {TIME_HORIZON_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option
                      }
                    >
                      {option}
                    </option>
                  )
                )}

              </select>

            </div>


            {/* Likelihood */}
            <div>

              <label
                className={
                  labelCls
                }
              >
                Likelihood
              </label>

              <select
                className={
                  inputCls
                }
                value={
                  edit.likelihood
                }
                onChange={(e) =>
                  updateEdit(
                    'likelihood',
                    Number(
                      e.target.value
                    )
                  )
                }
              >

                {[1, 2, 3].map(
                  (level) => (
                    <option
                      key={
                        level
                      }
                      value={
                        level
                      }
                    >
                      {LEVEL_LABEL[level]}
                    </option>
                  )
                )}

              </select>

            </div>


            {/* Impact */}
            <div>

              <label
                className={
                  labelCls
                }
              >
                Impact
              </label>

              <select
                className={
                  inputCls
                }
                value={
                  edit.impact
                }
                onChange={(e) =>
                  updateEdit(
                    'impact',
                    Number(
                      e.target.value
                    )
                  )
                }
              >

                {[1, 2, 3].map(
                  (level) => (
                    <option
                      key={
                        level
                      }
                      value={
                        level
                      }
                    >
                      {LEVEL_LABEL[level]}
                    </option>
                  )
                )}

              </select>

            </div>


            {/* Owner */}
            <div>

              <label
                className={
                  labelCls
                }
              >
                Owner
              </label>

              <input
                className={
                  inputCls
                }
                value={
                  edit.owner
                }
                onChange={(e) =>
                  updateEdit(
                    'owner',
                    e.target.value
                  )
                }
                placeholder="ESG Manager / Project Head"
              />

            </div>


            {/* Financial exposure */}
            <div>

              <label
                className={
                  labelCls
                }
              >
                Internal estimated financial exposure (₹ Cr)
              </label>

              <input
                type="number"
                min="0"
                step="0.1"
                className={
                  inputCls
                }
                value={
                  edit.financial
                }
                onChange={(e) =>
                  updateEdit(
                    'financial',
                    e.target.value
                  )
                }
                placeholder="0"
              />

            </div>


            {/* Rationale */}
            <div className="md:col-span-2">

              <label
                className={
                  labelCls
                }
              >
                Rationale for identifying this risk / opportunity
                {edit.includeInBrsr &&
                  ' *'}
              </label>

              <textarea
                rows={3}
                className={
                  inputCls
                }
                value={
                  edit.rationale
                }
                onChange={(e) =>
                  updateEdit(
                    'rationale',
                    e.target.value
                  )
                }
                placeholder="Explain why the organization considers this a material ESG risk or opportunity."
              />

            </div>


            {/* Mitigation */}
            <div className="md:col-span-2">

              <label
                className={
                  labelCls
                }
              >
                Mitigation / adaptation plan *
              </label>

              <textarea
                rows={3}
                className={
                  inputCls
                }
                value={
                  edit.mitigation
                }
                onChange={(e) =>
                  updateEdit(
                    'mitigation',
                    e.target.value
                  )
                }
                placeholder="Describe controls, mitigation actions, responsibilities and monitoring."
              />

            </div>


            {/* Financial implication */}
            <div className="md:col-span-2">

              <label
                className={
                  labelCls
                }
              >
                Financial implication — qualitative BRSR narrative
              </label>

              <textarea
                rows={3}
                className={
                  inputCls
                }
                value={
                  edit.financialImplication
                }
                onChange={(e) =>
                  updateEdit(
                    'financialImplication',
                    e.target.value
                  )
                }
                placeholder="Example: May increase operating costs and require additional water-efficiency investments."
              />

            </div>


            {/* BRSR checkbox */}
            <label className="md:col-span-2 flex items-start gap-2 text-sm font-semibold text-slate-700">

              <input
                type="checkbox"
                className="mt-0.5"
                checked={
                  Boolean(
                    edit.includeInBrsr
                  )
                }
                onChange={(e) =>
                  updateEdit(
                    'includeInBrsr',
                    e.target.checked
                  )
                }
              />

              <span>
                Include in BRSR Section A, Q24
                <span className="block text-xs font-normal text-slate-400 mt-0.5">
                  When selected, the risk is surfaced as a material responsible-business-conduct issue.
                </span>
              </span>

              <ExternalLink
                size={13}
                className="text-slate-400 mt-0.5 shrink-0"
              />

            </label>


            {/* Backend note */}
            <div className="md:col-span-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
              Linked KPI mapping is intentionally not included here because your current BRSR indicator IDs are string values such as <code className="font-mono">p6_grid</code>, while the current Flask risk schema expects an integer <code className="font-mono">linkedIndicatorId</code>. This should be harmonized later rather than sending invalid data.
            </div>

          </div>
        )}

      </Modal>

    </div>
  );
}
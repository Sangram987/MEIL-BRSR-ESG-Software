import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Leaf,
  Users,
  Scale,
  Droplets,
  Flame,
  Zap,
  Recycle,
  HardHat,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import VerigraphPipelineDemo from '../../components/VerigraphPipelineDemo';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

import ProjectMap, {
  MapLegend,
} from '../../components/ProjectMap';

import HierarchyFilter from '../../components/HierarchyFilter';

import StatCard from '../../components/StatCard';

import {
  useApp,
} from '../../store/AppStore';

import {
  CURRENT_PERIOD,
  CURRENT_FY,
  periodLabel,
  shortMonth,
  PRINCIPLES,
} from '../../data/brsr';

import {
  fmt,
  compact,
} from '../../lib/consolidate';

import {
  scopeName,
} from '../../lib/exporters';

import {
  Card,
  CardHeader,
  PageHeader,
  Progress,
  Btn,
} from '../../components/ui';

import apiClient from '../../services/apiClient';

import organizationApi from '../../services/organizationApi';


// ─────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────

const THEME = {
  environment: {
    bg: 'bg-emerald-50 text-emerald-800 border border-emerald-300 ring-1 ring-emerald-300',
    c1: '#10b981',
    c2: '#0ea5e9',
  },

  social: {
    bg: 'bg-sky-50 text-sky-800 border border-sky-300 ring-1 ring-sky-300',
    c1: '#0284c7',
    c2: '#38bdf8',
  },

  governance: {
    bg: 'bg-indigo-50 text-indigo-800 border border-indigo-300 ring-1 ring-indigo-300',
    c1: '#4f46e5',
    c2: '#818cf8',
  },
};


// ─────────────────────────────────────────────
// Chart styles
// ─────────────────────────────────────────────

const tip = {
  borderRadius: 12,
  border: 'none',
  boxShadow:
    '0 4px 12px rgb(0 0 0 / .12)',
};

const ax = {
  tickLine: false,
  axisLine: false,
  tick: {
    fontSize: 12,
    fill: '#64748b',
  },
};


// ─────────────────────────────────────────────
// Backend scope mapping
// ─────────────────────────────────────────────

function getBackendScope(
  scope
) {
  const level =
    scope?.level || 'group';

  switch (level) {
    case 'project':
      return {
        scopeType: 'PROJECT',
        scopeId: scope.id || null,
      };

    case 'bu':
      return {
        scopeType: 'BUSINESS_UNIT',
        scopeId: scope.id || null,
      };

    case 'sub':
      return {
        scopeType: 'SUBSIDIARY',
        scopeId: scope.id || null,
      };

    case 'group':
    default:
      return {
        scopeType: 'GROUP',
        scopeId: null,
      };
  }
}


// ─────────────────────────────────────────────
// Safe number
// ─────────────────────────────────────────────

function num(
  value,
  fallback = 0
) {
  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
}


// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function AdminPortal() {
  const {
    calc,
    ui,
    org,
    toast,
  } = useApp();

  const nav =
    useNavigate();


  // ────────────────────────────────
  // UI state
  // ────────────────────────────────

  const [
    pillar,
    setPillar,
  ] = useState(
    'environment'
  );

  const [
    showDemoModal,
    setShowDemoModal,
  ] = useState(false);


  const {
    scope,
    boundary,
    fy,
  } = ui;


  // ────────────────────────────────
  // Backend analytics state
  // ────────────────────────────────

  const [
    reportingPeriodId,
    setReportingPeriodId,
  ] = useState(null);


  const [
    backendAnalytics,
    setBackendAnalytics,
  ] = useState(null);


  const [
    backendCoverage,
    setBackendCoverage,
  ] = useState(null);


  const [
    analyticsLoading,
    setAnalyticsLoading,
  ] = useState(true);


  // ────────────────────────────────
  // Local calculated data
  // Used as fallback and for charts
  // not currently supplied by summary.
  // ────────────────────────────────

  const node = useMemo(() => {
    try {
      return calc.nodeTotals(
        scope,
        fy,
        boundary
      );
    } catch {
      return {
        kpi: {},
        t: {},
      };
    }
  }, [
    calc,
    scope,
    fy,
    boundary,
  ]);


  const localKpi =
    node.kpi || {};

  const localTotals =
    node.t || {};


  // ────────────────────────────────
  // Load backend reporting period
  // + backend annual analytics
  // + backend current-month coverage
  // ────────────────────────────────

  useEffect(() => {
    let cancelled = false;


    async function loadBackendAnalytics() {
      try {
        setAnalyticsLoading(true);


        // Get actual reporting-period IDs
        // from Flask.
        const periods =
          await organizationApi.getReportingPeriods();


        if (
          !Array.isArray(
            periods
          )
        ) {
          throw new Error(
            'Backend reporting periods response is invalid.'
          );
        }


        // Annual FY period.
        const annualPeriod =
          periods.find(
            (period) =>
              period.financialYear === fy &&
              period.periodType ===
                'FINANCIAL_YEAR'
          ) ||
          periods.find(
            (period) =>
              period.financialYear ===
              fy
          );


        // Current operational month.
        const monthPeriod =
          periods.find(
            (period) =>
              period.financialYear ===
                fy &&
              period.periodType ===
                'MONTH' &&
              period.name ===
                CURRENT_PERIOD
          ) ||
          periods.find(
            (period) =>
              period.periodType ===
                'MONTH' &&
              period.name ===
                CURRENT_PERIOD
          );


        if (
          !annualPeriod?.id
        ) {
          throw new Error(
            `No financial-year reporting period found for ${fy}.`
          );
        }


        if (cancelled) {
          return;
        }


        setReportingPeriodId(
          annualPeriod.id
        );


        const {
          scopeType,
          scopeId,
        } =
          getBackendScope(
            scope
          );


        // Build parameters used by
        // Flask /analytics/summary.
        const annualParams = {
          scopeType,
          scopeId,
          reportingPeriodId:
            annualPeriod.id,

          boundaryMode:
            String(
              boundary?.mode ||
                'consolidated'
            ).toUpperCase(),

          includeJv:
            Boolean(
              boundary?.includeJV
            ),
        };


        const annualResponse =
          await apiClient.get(
            '/analytics/summary',
            {
              params:
                annualParams,
            }
          );


        if (cancelled) {
          return;
        }


        setBackendAnalytics(
          annualResponse.data
        );


        // Get monthly coverage separately,
        // because the dashboard says:
        // "current month".
        if (
          monthPeriod?.id
        ) {
          const monthlyResponse =
            await apiClient.get(
              '/analytics/summary',
              {
                params: {
                  ...annualParams,

                  reportingPeriodId:
                    monthPeriod.id,
                },
              }
            );


          if (!cancelled) {
            setBackendCoverage(
              monthlyResponse
                .data
                ?.coverage ||
                null
            );
          }
        } else {
          setBackendCoverage(
            null
          );
        }

      } catch (error) {
        if (!cancelled) {
          setBackendAnalytics(
            null
          );

          setBackendCoverage(
            null
          );


          toast(
            error?.response?.data
              ?.error?.message ||
              error?.message ||
              'Backend analytics unavailable. Showing calculated dashboard values.',
            'error'
          );
        }
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(
            false
          );
        }
      }
    }


    loadBackendAnalytics();


    return () => {
      cancelled = true;
    };
  }, [
    fy,
    scope?.level,
    scope?.id,
    boundary?.mode,
    boundary?.includeJV,
    toast,
  ]);


  // ────────────────────────────────
  // Merge backend + local values
  // ────────────────────────────────

  const K = useMemo(
    () => ({
      ...localKpi,

      scope1:
        backendAnalytics
          ?.emissions
          ?.scope1 ??
        localKpi.scope1 ??
        0,

      scope2:
        backendAnalytics
          ?.emissions
          ?.scope2 ??
        localKpi.scope2 ??
        0,

      scope3:
        backendAnalytics
          ?.emissions
          ?.scope3 ??
        localKpi.scope3 ??
        0,

      waterWithdrawn:
        backendAnalytics
          ?.water
          ?.withdrawal ??
        localKpi.waterWithdrawn ??
        0,

      waterConsumed:
        backendAnalytics
          ?.water
          ?.consumption ??
        localKpi.waterConsumed ??
        0,

      waste:
        backendAnalytics
          ?.waste
          ?.generated ??
        localKpi.waste ??
        0,

      wasteRecoveredPct:
        backendAnalytics
          ?.waste
          ?.recycledPct ??
        localKpi.wasteRecoveredPct ??
        0,

      headcount:
        backendAnalytics
          ?.workforce
          ?.headcount ??
        localKpi.headcount ??
        0,

      permanent:
        localKpi.permanent ??
        0,

      contract:
        localKpi.contract ??
        0,

      femalePct:
        backendAnalytics
          ?.workforce
          ?.femalePct ??
        localKpi.femalePct ??
        0,

      ltifr:
        backendAnalytics
          ?.safety
          ?.ltifr ??
        localKpi.ltifr ??
        0,

      fatalities:
        backendAnalytics
          ?.safety
          ?.fatalities ??
        localKpi.fatalities ??
        0,

      // Backend summary currently does
      // not expose renewable percentage.
      renewablePct:
        localKpi.renewablePct ??
        0,

      // Backend summary currently does
      // not expose female wage share.
      femaleWagePct:
        localKpi.femaleWagePct ??
        0,
    }),
    [
      localKpi,
      backendAnalytics,
    ]
  );


  const t =
    localTotals;


  const th =
    THEME[pillar];


  // ────────────────────────────────
  // Current-month coverage
  // ────────────────────────────────

  const localCoverage =
    useMemo(() => {
      try {
        return calc.coverage(
          scope,
          CURRENT_PERIOD,
          boundary
        );
      } catch {
        return {
          pct: 0,
          counts: {
            approved: 0,
            submitted: 0,
            correction_required: 0,
            rejected: 0,
            none: 0,
            draft: 0,
          },
          projects: 0,
          expected: 0,
        };
      }
    }, [
      calc,
      scope,
      boundary,
    ]);


  const cov =
    backendCoverage
      ? {
          pct:
            num(
              backendCoverage
                .approvedPct
            ),

          counts: {
            approved:
              num(
                backendCoverage
                  .counts
                  ?.APPROVED
              ) +
              num(
                backendCoverage
                  .counts
                  ?.LOCKED
              ),

            submitted:
              num(
                backendCoverage
                  .counts
                  ?.SUBMITTED
              ),

            correction_required:
              num(
                backendCoverage
                  .counts
                  ?.CORRECTION_REQUIRED
              ),

            rejected:
              num(
                backendCoverage
                  .counts
                  ?.REJECTED
              ),

            none:
              num(
                backendCoverage
                  .counts
                  ?.NONE
              ),

            draft:
              num(
                backendCoverage
                  .counts
                  ?.DRAFT
              ),
          },

          projects:
            num(
              backendCoverage
                .projects
            ),

          expected:
            num(
              backendCoverage
                .expected
            ),
        }
      : localCoverage;


  // ────────────────────────────────
  // Child-entity calculations
  // ────────────────────────────────

  const rows =
    useMemo(() => {
      try {
        return calc.rollup(
          scope,
          fy,
          boundary
        );
      } catch {
        return [];
      }
    }, [
      calc,
      scope,
      fy,
      boundary,
    ]);


  const mapProjects =
    useMemo(() => {
      try {
        return calc.projectsIn(
          scope,
          boundary
        );
      } catch {
        return [];
      }
    }, [
      calc,
      scope,
      boundary,
    ]);


  // ────────────────────────────────
  // Emissions trend
  //
  // The current backend summary endpoint
  // does not provide a monthly series.
  // Keep the existing calculated trend.
  // ────────────────────────────────

  const series =
    useMemo(
      () =>
        (() => {
          try {
            return calc
              .monthlyTotals(
                scope,
                fy,
                boundary,
                [
                  'p6_dg',
                  'p6_mach',
                  'p6_petrol',
                  'p6_grid',
                ]
              )
              .map(
                (row) => ({
                  month:
                    shortMonth(
                      row.period
                    ),

                  'Scope 1':
                    Math.round(
                      (
                        (
                          num(
                            row.p6_dg
                          ) +
                          num(
                            row.p6_mach
                          )
                        ) *
                          2.68 +
                        num(
                          row.p6_petrol
                        ) *
                          2.31
                      ) /
                        1000
                    ),

                  'Scope 2':
                    Math.round(
                      (
                        num(
                          row.p6_grid
                        ) *
                        0.71
                      ) /
                        1000
                    ),

                  dgFuel: Math.round(num(row.p6_dg)),
                  machFuel: Math.round(num(row.p6_mach)),
                  petrolFuel: Math.round(num(row.p6_petrol)),
                  gridKwh: Math.round(num(row.p6_grid)),
                })
              );
          } catch {
            return [];
          }
        })(),
      [
        calc,
        scope,
        fy,
        boundary,
      ]
    );


  // ────────────────────────────────
  // Workforce chart
  // ────────────────────────────────

  const workforce =
    useMemo(
      () =>
        rows
          .filter(
            (row) =>
              !row.excluded
          )
          .slice(0, 10)
          .map(
            (row) => ({
              name:
                String(
                  row.name ||
                    ''
                )
                  .replace(
                    /^MEIL /,
                    ''
                  )
                  .slice(
                    0,
                    18
                  ),

              Permanent:
                Math.round(
                  num(
                    row.kpi
                      ?.permanent
                  )
                ),

              Contract:
                Math.round(
                  num(
                    row.kpi
                      ?.contract
                  )
                ),
            })
          ),
      [rows]
    );


  // ────────────────────────────────
  // Approval pipeline
  // ────────────────────────────────

  const pipeline =
    useMemo(
      () =>
        rows
          .filter(
            (row) =>
              !row.excluded
          )
          .slice(0, 10)
          .map(
            (row) => {
              let counts = {
                approved: 0,
                subsidiary_verified: 0,
                bu_verified: 0,
                submitted: 0,
                correction_required: 0,
                rejected: 0,
                none: 0,
                draft: 0,
              };


              try {
                const coverage =
                  calc.coverage(
                    {
                      level:
                        row.level,
                      id:
                        row.id,
                    },
                    CURRENT_PERIOD,
                    boundary
                  );

                counts =
                  coverage.counts ||
                  counts;
              } catch {
                // Keep zero fallback.
              }


              return {
                name:
                  String(
                    row.name ||
                      ''
                  )
                    .replace(
                      /^MEIL /,
                      ''
                    )
                    .slice(
                      0,
                      18
                    ),

                Approved:
                  num(
                    counts.approved
                  ),

                'Subsidiary Verified':
                  num(
                    counts.subsidiary_verified
                  ),

                'BU Verified':
                  num(
                    counts.bu_verified
                  ),

                'With BU':
                  num(
                    counts.submitted
                  ),

                Correction:
                  num(
                    counts.correction_required
                  ) +
                  num(
                    counts.rejected
                  ),

                'Not started':
                  num(
                    counts.none
                  ) +
                  num(
                    counts.draft
                  ),
              };
            }
          ),
      [
        rows,
        calc,
        boundary,
      ]
    );


  // ────────────────────────────────
  // Maximum GHG
  // ────────────────────────────────

  const maxG =
    Math.max(
      1,
      ...rows.map(
        (row) =>
          num(
            row.kpi?.ghg
          )
      )
    );


  // ────────────────────────────────
  // Scope label
  // ────────────────────────────────

  const currentScopeName =
    (() => {
      try {
        return scopeName(
          org,
          scope
        );
      } catch {
        return 'MEIL Group';
      }
    })();


  // ────────────────────────────────
  // Refresh backend analytics
  // ────────────────────────────────

  const refreshBackend =
    async () => {
      try {
        setAnalyticsLoading(
          true
        );


        const periods =
          await organizationApi.getReportingPeriods();


        const annualPeriod =
          periods.find(
            (period) =>
              period.financialYear ===
                fy &&
              period.periodType ===
                'FINANCIAL_YEAR'
          ) ||
          periods.find(
            (period) =>
              period.financialYear ===
              fy
          );


        if (!annualPeriod?.id) {
          throw new Error(
            `No reporting period found for ${fy}.`
          );
        }


        const {
          scopeType,
          scopeId,
        } =
          getBackendScope(
            scope
          );


        const response =
          await apiClient.get(
            '/analytics/summary',
            {
              params: {
                scopeType,
                scopeId,

                reportingPeriodId:
                  annualPeriod.id,

                boundaryMode:
                  String(
                    boundary?.mode ||
                      'consolidated'
                  ).toUpperCase(),

                includeJv:
                  Boolean(
                    boundary?.includeJV
                  ),
              },
            }
          );


        setReportingPeriodId(
          annualPeriod.id
        );

        setBackendAnalytics(
          response.data
        );


        toast(
          'Backend analytics refreshed.'
        );
      } catch (error) {
        toast(
          error?.response?.data
            ?.error?.message ||
            error?.message ||
            'Unable to refresh backend analytics.',
          'error'
        );
      } finally {
        setAnalyticsLoading(
          false
        );
      }
    };


  return (
    <div className="space-y-6">

      {/* ─────────────────────────── */}
      {/* Page header */}
      {/* ─────────────────────────── */}

      <PageHeader
        title="ESG Command Center"
        subtitle={`${currentScopeName} · ${
          boundary.mode ===
          'standalone'
            ? 'Standalone'
            : 'Consolidated'
        } · FY ${fy}`}
        actions={
          <div className="flex items-center gap-2">

            <Btn
              tone="ghost"
              onClick={
                refreshBackend
              }
              disabled={
                analyticsLoading
              }
            >
              <RefreshCw
                size={15}
                className={
                  analyticsLoading
                    ? 'animate-spin'
                    : ''
                }
              />

              Refresh
            </Btn>

            <Btn
              tone="ghost"
              onClick={() => nav('/admin/audit')}
            >
              <ShieldCheck size={16} />
              Audit Center
            </Btn>

            <Btn
              tone="primary"
              onClick={() => nav('/admin/reports')}
            >
              Generate BRSR Report
              <ArrowRight size={16} />
            </Btn>

          </div>
        }
      />


      {/* ─────────────────────────── */}
      {/* Hierarchy */}
      {/* ─────────────────────────── */}

      <HierarchyFilter />


      {/* ─────────────────────────── */}
      {/* Backend status */}
      {/* ─────────────────────────── */}

      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs ${
          analyticsLoading
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : backendAnalytics
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >

        <span className="font-semibold">
          {analyticsLoading
            ? 'Loading live backend analytics…'
            : backendAnalytics
            ? 'Live backend analytics connected'
            : 'Backend analytics unavailable — using calculated dashboard values'}
        </span>


        {reportingPeriodId && (
          <span className="font-mono text-[10px] opacity-70">
            {reportingPeriodId}
          </span>
        )}

      </div>


      {/* ─────────────────────────── */}
      {/* Pillar tabs */}
      {/* ─────────────────────────── */}

      <div
        className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm"
        role="tablist"
      >

        {[
          [
            'environment',
            Leaf,
            'Environment',
          ],

          [
            'social',
            Users,
            'Social',
          ],

          [
            'governance',
            Scale,
            'Governance',
          ],
        ].map(
          ([
            key,
            Icon,
            label,
          ]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={
                pillar === key
              }
              onClick={() =>
                setPillar(
                  key
                )
              }
              className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-lg text-sm font-bold transition ${
                pillar === key
                  ? `${THEME[key].bg} shadow-sm`
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon
                size={16}
              />

              {label}
            </button>
          )
        )}

      </div>


      {/* ═══════════════════════════ */}
      {/* ENVIRONMENT */}
      {/* ═══════════════════════════ */}

      {pillar ===
        'environment' && (
        <>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">

            <StatCard
              title="Scope 1"
              value={compact(
                K.scope1
              )}
              unit="tCO2e · direct fuel"
              icon={Flame}
              color="emerald"
            />


            <StatCard
              title="Scope 2"
              value={compact(
                K.scope2
              )}
              unit="tCO2e · grid power"
              icon={Zap}
              color="emerald"
            />


            <StatCard
              title="Water withdrawn"
              value={compact(
                K.waterWithdrawn
              )}
              unit="Kiloliters"
              icon={Droplets}
              color="sky"
            />


            <StatCard
              title="Renewable energy"
              value={`${fmt(
                K.renewablePct,
                1
              )}%`}
              unit="of total energy"
              icon={Leaf}
              color="emerald"
            />


            <StatCard
              title="Waste recovered"
              value={`${fmt(
                K.wasteRecoveredPct,
                0
              )}%`}
              unit={`${compact(
                K.waste
              )} MT generated`}
              icon={Recycle}
              color="amber"
            />

          </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <Card pad={false}>
              <CardHeader
                title="Emissions Trajectory"
                subtitle="Monthly Scope 1 (Direct Fuel) vs Scope 2 (Grid) in tCO2e"
              />

              <div className="h-80 p-4">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <AreaChart
                    data={series}
                    margin={{
                      left: -10,
                      right: 16,
                      top: 10,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="month"
                      {...ax}
                    />
                    <YAxis
                      {...ax}
                    />
                    <Tooltip
                      contentStyle={tip}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Scope 1"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.16}
                      strokeWidth={2.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="Scope 2"
                      stroke="#0ea5e9"
                      fill="#0ea5e9"
                      fillOpacity={0.2}
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card pad={false}>
              <CardHeader
                title="Equipment & Energy Breakdown"
                subtitle="Monthly operational fuel (L) and electricity intake across active sites"
              />

              <div className="h-80 p-4">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={series}
                    margin={{
                      left: -10,
                      right: 16,
                      top: 10,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="month"
                      {...ax}
                    />
                    <YAxis
                      {...ax}
                    />
                    <Tooltip
                      contentStyle={tip}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
                    />
                    <Bar
                      dataKey="dgFuel"
                      name="DG Diesel (L)"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="machFuel"
                      name="Machinery (L)"
                      fill="#0ea5e9"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="petrolFuel"
                      name="Petrol (L)"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

        </>
      )}


      {/* ═══════════════════════════ */}
      {/* SOCIAL */}
      {/* ═══════════════════════════ */}

      {pillar ===
        'social' && (
        <>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <StatCard
              title="LTIFR"
              value={fmt(
                K.ltifr,
                2
              )}
              unit="per million man-hours"
              icon={HardHat}
              color="sky"
            />


            <StatCard
              title="Fatalities"
              value={fmt(
                K.fatalities,
                0
              )}
              unit="this FY"
              icon={ShieldAlert}
              color="rose"
            />


            <StatCard
              title="Workforce"
              value={compact(
                K.headcount
              )}
              unit={`${compact(
                K.contract
              )} contract · ${compact(
                K.permanent
              )} permanent`}
              icon={Users}
              color="sky"
            />


            <StatCard
              title="Female wage share"
              value={`${fmt(
                K.femaleWagePct,
                1
              )}%`}
              unit="of gross wages"
              icon={Users}
              color="indigo"
            />

          </div>


          <Card pad={false}>

            <CardHeader
              title={
                scope.level ===
                'project'
                  ? 'Workforce'
                  : 'Workforce by child entity'
              }
              subtitle="Average headcount over the year"
            />


            <div className="h-80 p-4">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart
                  data={
                    workforce
                  }
                  margin={{
                    left: -6,
                    right: 16,
                    top: 8,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="name"
                    {...ax}
                    interval={0}
                    tick={{
                      fontSize: 10,
                      fill: '#64748b',
                    }}
                  />

                  <YAxis
                    {...ax}
                  />

                  <Tooltip
                    contentStyle={
                      tip
                    }
                    cursor={{
                      fill: '#f8fafc',
                    }}
                  />

                  <Legend
                    iconType="circle"
                  />


                  <Bar
                    dataKey="Permanent"
                    stackId="a"
                    fill={
                      th.c1
                    }
                  />


                  <Bar
                    dataKey="Contract"
                    stackId="a"
                    fill={
                      th.c2
                    }
                    radius={[
                      4,
                      4,
                      0,
                      0,
                    ]}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

          </Card>

        </>
      )}


      {/* ═══════════════════════════ */}
      {/* GOVERNANCE */}
      {/* ═══════════════════════════ */}

      {pillar ===
        'governance' && (
        <>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <StatCard
              title="Ethics complaints"
              value={fmt(
                t.p1_corr
              )}
              unit="corruption / bribery"
              icon={Scale}
              color="indigo"
            />


            <StatCard
              title="Fines & penalties"
              value={`₹${compact(
                t.p1_fines
              )}`}
              unit="paid to regulators"
              icon={Scale}
              color="rose"
            />


            <StatCard
              title="Rights complaints"
              value={fmt(
                num(
                  t.p5_child
                ) +
                  num(
                    t.p5_forced
                  ) +
                  num(
                    t.p5_posh
                  ) +
                  num(
                    t.p5_disc
                  )
              )}
              unit="child / forced / POSH / discrimination"
              icon={ShieldAlert}
              color="amber"
            />


            <StatCard
              title="Data completeness"
              value={`${fmt(
                cov.pct,
                0
              )}%`}
              unit={`${periodLabel(
                CURRENT_PERIOD
              )} approved`}
              icon={Scale}
              color="emerald"
            />

          </div>


          <Card pad={false}>

            <CardHeader
              title="Approval pipeline this month"
              subtitle="Hierarchical Flow: Site Operator (Committed) → BU Manager (Verified) → Subsidiary (Verified) → Group Admin (Final Approval)"
              right={
                <Btn
                  tone="primary"
                  onClick={() => nav('/admin/approvals')}
                  className="text-xs"
                >
                  Open Final Approvals Queue
                </Btn>
              }
            />


            <div className="h-80 p-4">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart
                  data={
                    pipeline
                  }
                  margin={{
                    left: -6,
                    right: 16,
                    top: 8,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="name"
                    {...ax}
                    interval={0}
                    tick={{
                      fontSize: 10,
                      fill: '#64748b',
                    }}
                  />

                  <YAxis
                    {...ax}
                  />

                  <Tooltip
                    contentStyle={
                      tip
                    }
                    cursor={{
                      fill: '#f8fafc',
                    }}
                  />

                  <Legend
                    iconType="circle"
                  />


                  <Bar
                    dataKey="Approved"
                    name="Admin Approved (Final)"
                    stackId="a"
                    fill="#10b981"
                  />

                  <Bar
                    dataKey="Subsidiary Verified"
                    name="Subsidiary Verified (Awaiting Admin)"
                    stackId="a"
                    fill="#6366f1"
                  />

                  <Bar
                    dataKey="BU Verified"
                    name="BU Verified (Awaiting Subsidiary)"
                    stackId="a"
                    fill="#3b82f6"
                  />

                  <Bar
                    dataKey="With BU"
                    name="With BU Manager (Committed)"
                    stackId="a"
                    fill="#f59e0b"
                  />

                  <Bar
                    dataKey="Correction"
                    stackId="a"
                    fill="#f43f5e"
                  />

                  <Bar
                    dataKey="Not started"
                    stackId="a"
                    fill="#cbd5e1"
                    radius={[
                      4,
                      4,
                      0,
                      0,
                    ]}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

          </Card>

        </>
      )}


      {/* ─────────────────────────── */}
      {/* Map + completeness */}
      {/* ─────────────────────────── */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <Card
          pad={false}
          className="lg:col-span-2"
        >

          <CardHeader
            title={`Live project map (${mapProjects.length} sites)`}
            right={
              <MapLegend />
            }
          />


          <div className="p-3">
            <ProjectMap
              projects={
                mapProjects
              }
              height={380}
            />
          </div>

        </Card>


        <Card pad={false}>

          <CardHeader
            title={`${periodLabel(
              CURRENT_PERIOD
            )} completeness`}
            subtitle="Approved packets ÷ (sites × 9 principles)"
          />


          <div className="p-5 space-y-4">

            <div>

              <div className="flex justify-between text-sm font-bold mb-1">

                <span>
                  Approved
                </span>

                <span>
                  {fmt(
                    cov.pct,
                    0
                  )}
                  %
                </span>

              </div>


              <Progress
                value={
                  cov.pct
                }
              />

            </div>


            <dl className="grid grid-cols-2 gap-3 text-sm">

              {[
                [
                  'Approved',
                  cov.counts
                    .approved,
                  'text-emerald-600',
                ],

                [
                  'Awaiting BU review',
                  cov.counts
                    .submitted,
                  'text-amber-600',
                ],

                [
                  'With site',
                  num(
                    cov.counts
                      .correction_required
                  ) +
                    num(
                      cov.counts
                        .rejected
                    ),
                  'text-rose-600',
                ],

                [
                  'Not submitted',
                  num(
                    cov.counts
                      .none
                  ) +
                    num(
                      cov.counts
                        .draft
                    ),
                  'text-slate-500',
                ],
              ].map(
                ([
                  label,
                  value,
                  color,
                ]) => (
                  <div
                    key={
                      label
                    }
                    className="bg-slate-50 rounded-lg p-3 border border-slate-100"
                  >

                    <dt className="text-[11px] text-slate-500">
                      {label}
                    </dt>

                    <dd
                      className={`text-xl font-black ${color}`}
                    >
                      {fmt(
                        value
                      )}
                    </dd>

                  </div>
                )
              )}

            </dl>


            <p className="text-[11px] text-slate-400">
              {PRINCIPLES.length}{' '}
              principles ×{' '}
              {fmt(
                cov.projects
              )}{' '}
              sites ={' '}
              {fmt(
                cov.expected
              )}{' '}
              expected packets.
            </p>

          </div>

        </Card>

      </div>


      {/* ─────────────────────────── */}
      {/* Emissions leaderboard */}
      {/* ─────────────────────────── */}

      <Card pad={false}>

        <CardHeader
          title={
            scope.level ===
            'project'
              ? 'Project'
              : 'Emissions leaderboard'
          }
          subtitle="Scope 1+2 by child entity — open Consolidation to drill down"
          right={
            <Btn
              tone="ghost"
              className="!py-1.5 !text-xs"
              onClick={() =>
                nav(
                  '/admin/consolidation'
                )
              }
            >
              Open consolidation
            </Btn>
          }
        />


        <ul className="divide-y divide-slate-100">

          {[
            ...rows,
          ]
            .filter(
              (row) =>
                !row.excluded
            )
            .sort(
              (a, b) =>
                num(
                  b.kpi?.ghg
                ) -
                num(
                  a.kpi?.ghg
                )
            )
            .slice(
              0,
              8
            )
            .map(
              (row) => (
                <li
                  key={
                    row.id
                  }
                  className="px-5 py-3 flex items-center gap-4"
                >

                  <span className="w-56 truncate text-sm font-semibold text-slate-800">
                    {
                      row.name
                    }
                  </span>


                  <div className="flex-1">

                    <Progress
                      value={
                        (
                          num(
                            row.kpi
                              ?.ghg
                          ) /
                          maxG
                        ) *
                        100
                      }
                      tone="blue"
                    />

                  </div>


                  <span className="w-28 text-right text-sm font-black tabular-nums">

                    {compact(
                      num(
                        row.kpi
                          ?.ghg
                      )
                    )}

                    <span className="text-[11px] font-medium text-slate-400">
                      {' '}
                      tCO2e
                    </span>

                  </span>

                </li>
              )
            )}


          {rows.length ===
            0 && (
            <li className="p-6 text-sm text-slate-500">
              Select a higher scope to compare child entities.
            </li>
          )}

        </ul>

      </Card>

      <VerigraphPipelineDemo
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
      />
    </div>
  );
}
import React, {
  useEffect,
  useState,
} from 'react';

import {
  Save,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import { useApp } from '../../store/AppStore';

import {
  PRINCIPLES,
  STAKEHOLDER_GROUPS,
  CORE8_FAIRNESS,
  CORE9_OPENNESS,
  CURRENT_FY,
} from '../../data/brsr';

import {
  Card,
  CardHeader,
  PageHeader,
  Tabs,
  Btn,
  Badge,
  inputCls,
  labelCls,
} from '../../components/ui';

import disclosureApi from '../../services/disclosureApi';
import organizationApi from '../../services/organizationApi';
import apiClient from '../../services/apiClient';


// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const REL_LABEL = {
  parent: 'Parent division',
  subsidiary: 'Subsidiary',
  jv: 'Joint venture / associate',
};

const API_REL_LABEL = {
  GROUP: 'Parent division',
  SUBSIDIARY: 'Subsidiary',
  JOINT_VENTURE: 'Joint venture / associate',
  ASSOCIATE: 'Joint venture / associate',
  OTHER: 'Other',
};


// ─────────────────────────────────────────────
// Small reusable UI components
// ─────────────────────────────────────────────

const Field = ({
  label,
  span,
  children,
}) => (
  <div
    className={
      span
        ? 'md:col-span-2'
        : ''
    }
  >
    <label className={labelCls}>
      {label}
    </label>

    {children}
  </div>
);


const Mini = ({
  v,
  on,
  ph,
  type = 'text',
}) => (
  <input
    type={type}
    className={`${inputCls} !py-1.5 !text-sm`}
    value={v ?? ''}
    placeholder={ph}
    onChange={(e) =>
      on(e.target.value)
    }
  />
);


const RowTable = ({
  head,
  rows,
  onChange,
  cols,
  addLabel,
  blank,
}) => (
  <div className="overflow-x-auto border border-slate-200 rounded-lg">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-[11px] font-bold text-slate-500">
        <tr>
          {head.map((h) => (
            <th
              key={h}
              className="px-3 py-2 text-left whitespace-nowrap"
            >
              {h}
            </th>
          ))}

          <th className="w-8" />
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td
                key={c}
                className="px-3 py-1.5"
              >
                <Mini
                  v={r?.[c]}
                  on={(v) =>
                    onChange(
                      rows.map(
                        (x, j) =>
                          j === i
                            ? {
                                ...x,
                                [c]: v,
                              }
                            : x
                      )
                    )
                  }
                />
              </td>
            ))}

            <td className="px-2">
              <button
                type="button"
                aria-label="Remove row"
                onClick={() =>
                  onChange(
                    rows.filter(
                      (_, j) =>
                        j !== i
                    )
                  )
                }
                className="text-slate-300 hover:text-rose-500"
              >
                <Trash2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <button
      type="button"
      onClick={() =>
        onChange([
          ...rows,
          { ...blank },
        ])
      }
      className="w-full text-xs font-bold text-blue-600 hover:bg-blue-50 py-2 flex items-center justify-center gap-1 border-t border-slate-100"
    >
      <Plus size={12} />
      {addLabel}
    </button>
  </div>
);


const CardHeaderInline = ({
  title,
}) => (
  <div className="md:col-span-3 -mt-1 -mx-1 mb-1">
    <h2 className="text-sm font-bold text-slate-900">
      {title}
    </h2>
  </div>
);


// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

const pct = (num, den) =>
  den > 0
    ? `${((num / den) * 100).toFixed(1)}%`
    : '–';


const toYesNo = (
  value,
  fallback = 'No'
) => {
  if (
    value === true ||
    value === 'Yes' ||
    value === 'YES'
  ) {
    return 'Yes';
  }

  if (
    value === false ||
    value === 'No' ||
    value === 'NO'
  ) {
    return 'No';
  }

  return fallback;
};


const toBoolean = (value) =>
  value === true ||
  value === 'Yes' ||
  value === 'YES';


const numberOrNull = (value) => {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : null;
};


const numberOrZero = (value) => {
  const n = numberOrNull(value);

  return n === null
    ? 0
    : n;
};


// ─────────────────────────────────────────────
// Core 9 normalizer
// Backend Core9 currently returns snake_case,
// while PUT expects camelCase.
// ─────────────────────────────────────────────

const normalizeCore9 = (
  backend = {},
  fallback = {}
) => ({
  purchTradingHousePct:
    backend.purchTradingHousePct ??
    backend.purch_trading_house_pct ??
    fallback.purchTradingHousePct ??
    '',

  purchTradingHouseCount:
    backend.purchTradingHouseCount ??
    backend.purch_trading_house_count ??
    fallback.purchTradingHouseCount ??
    '',

  purchTop10Pct:
    backend.purchTop10Pct ??
    backend.purch_top10_pct ??
    fallback.purchTop10Pct ??
    '',

  salesDealerPct:
    backend.salesDealerPct ??
    backend.sales_dealer_pct ??
    fallback.salesDealerPct ??
    '',

  salesDealerCount:
    backend.salesDealerCount ??
    backend.sales_dealer_count ??
    fallback.salesDealerCount ??
    '',

  salesTop10Pct:
    backend.salesTop10Pct ??
    backend.sales_top10_pct ??
    fallback.salesTop10Pct ??
    '',

  rptPurchasesPct:
    backend.rptPurchasesPct ??
    backend.rpt_purchases_pct ??
    fallback.rptPurchasesPct ??
    '',

  rptSalesPct:
    backend.rptSalesPct ??
    backend.rpt_sales_pct ??
    fallback.rptSalesPct ??
    '',

  rptLoansPct:
    backend.rptLoansPct ??
    backend.rpt_loans_pct ??
    fallback.rptLoansPct ??
    '',

  rptInvestmentsPct:
    backend.rptInvestmentsPct ??
    backend.rpt_investments_pct ??
    fallback.rptInvestmentsPct ??
    '',
});


// ─────────────────────────────────────────────
// Convert Flask response → existing UI shape
// ─────────────────────────────────────────────

const DEFAULT_A = {
  cin: 'U45201TG2006PLC050271',
  entityName: 'Megha Engineering & Infrastructures Limited',
  incorporationYear: '2006',
  registeredOffice: 'Plot No. 1, Balanagar, Hyderabad - 500037, Telangana, India',
  corporateOffice: 'S-2, Technocrat Industrial Estate, Balanagar, Hyderabad - 500037, Telangana, India',
  email: 'esg@meil.in',
  telephone: '+91 40 4433 6700',
  website: 'https://www.meil.in',
  stockExchanges: 'BSE, NSE',
  paidUpCapital: '604250000',
  contact: 'Rajesh Kumar, Group ESG Admin',
  boundaryDeclared: 'consolidated',
  locations: { plantsNational: '3', officesNational: '38', plantsIntl: '0', officesIntl: '3' },
  marketsNationalStates: '18',
  marketsIntlCountries: '3',
  exportsPct: '4',
  customerTypes: 'Central & state government agencies, PSUs, private industrial clients',
  employees: { permM: '9800', permF: '1350', otherM: '2100', otherF: '340' },
  workers: { permM: '31500', permF: '3600', otherM: '9200', otherF: '1100' },
  daEmployees: { permM: '28', permF: '4', otherM: '9', otherF: '1' },
  daWorkers: { permM: '95', permF: '11', otherM: '30', otherF: '4' },
  womenBoard: { total: '11', femaleCount: '2' },
  womenKMP: { total: '7', femaleCount: '1' },
  turnoverRate: {
    cur: { empM: '11.2', empF: '13.5', empT: '11.6', wkM: '18.4', wkF: '20.1', wkT: '18.6' },
    prev: { empM: '12.0', empF: '14.2', empT: '12.4', wkM: '19.5', wkF: '21.0', wkT: '19.7' },
    prev2: { empM: '13.1', empF: '15.0', empT: '13.5', wkM: '20.8', wkF: '22.4', wkT: '21.0' },
  },
  csrApplicable: 'Yes',
  csrTurnover: '27850000000',
  csrNetWorth: '13420000000',
  businessActivities: [
    { activity: 'Engineering, Procurement & Construction (EPC)', description: 'Irrigation, tunnels, roads & bridges', turnoverPct: '58' },
    { activity: 'Oil & Gas / Hydrocarbons', description: 'Refinery EPC, pipelines, city gas distribution', turnoverPct: '27' },
    { activity: 'Power & Renewables', description: 'Thermal, hydro, solar EPC', turnoverPct: '15' }
  ],
  productsServices: [
    { product: 'Irrigation & water infrastructure', nic: '4222', turnoverPct: '32' },
    { product: 'Tunnels & underground transit', nic: '4221', turnoverPct: '18' },
    { product: 'Roads & bridges', nic: '4210', turnoverPct: '17' },
    { product: 'Oil & gas pipelines / refinery EPC', nic: '4220', turnoverPct: '27' },
    { product: 'Power generation EPC', nic: '4220', turnoverPct: '6' }
  ],
  stakeholderComplaints: Object.fromEntries(
    STAKEHOLDER_GROUPS.map((g) => [
      g,
      { mechanism: 'Yes', link: 'https://www.meil.in/grievance-redressal', curFiled: '0', curPending: '0', curRemarks: 'Resolved under vigil mechanism', prevFiled: '0', prevPending: '0', prevRemarks: '' }
    ])
  ),
};

const DEFAULT_B = {
  directorStatement: 'Megha Engineering & Infrastructures Limited (MEIL) is steadfastly committed to sustainable nation-building, decarbonization, top-tier workplace safety, community enrichment, and uncompromising ethical corporate governance across all infrastructure, water, energy, and mobility operations.',
  esgHead: 'Rajesh Kumar, Group ESG Admin',
  committee: 'Sustainability & Risk Committee',
  externalAssessment: { done: 'Yes', agency: 'BSI Group India / DNV Business Assurance' },
};

const DEFAULT_CORE8 = {
  dataBreaches: '0',
  dataBreachRatio: '0',
  payablesDays: '48',
};

const DEFAULT_CORE9 = {
  purchTradingHousePct: '3.4',
  purchTradingHouseCount: '12',
  purchTop10Pct: '28.5',
  salesDealerPct: '4.2',
  salesDealerCount: '15',
  salesTop10Pct: '32.1',
  rptPurchasesPct: '1.8',
  rptSalesPct: '2.1',
  rptLoansPct: '0',
  rptInvestmentsPct: '0.5',
};

const normalizeDisclosure = (
  backend,
  seed,
  financialYear
) => {
  if (!backend) {
    return {
      A: {
        ...DEFAULT_A,
        ...seed.A,
        financialYear,
      },

      B: {
        ...DEFAULT_B,
        ...seed.B,
      },

      core8: {
        ...DEFAULT_CORE8,
        ...seed.core8,
      },

      core9: {
        ...DEFAULT_CORE9,
        ...seed.core9,
      },
    };
  }

  const seedA = seed.A || {};
  const seedB = seed.B || {};
  const seedCore8 = seed.core8 || {};
  const seedCore9 = seed.core9 || {};

  const backendPolicies = backend.policies || {};
  const backendReview = backend.governanceReview || {};

  const policies = Object.fromEntries(
    PRINCIPLES.map((p) => {
      const seedPolicy = seedB.policies?.[p.id] || {};
      const apiPolicy = backendPolicies[p.id] || {};

      const targets =
        Array.isArray(apiPolicy.targets) && apiPolicy.targets.length > 0
          ? apiPolicy.targets.map((t) => ({
              target: t?.target ?? '',
              baseline: t?.baseline ?? '',
              current: t?.current ?? t?.currentPerformance ?? '',
              status: t?.status ?? '',
            }))
          : seedPolicy.targets || [
              {
                target: 'Achieve zero net fatalities & 25% renewable transition',
                baseline: 'FY 2024-25 baseline',
                current: '18% achieved in FY 2026-27',
                status: 'On Track',
              },
            ];

      return [
        p.id,
        {
          ...seedPolicy,
          ...apiPolicy,

          hasPolicy: toYesNo(
            apiPolicy.hasPolicy ?? seedPolicy.hasPolicy,
            'Yes'
          ),

          boardApproved: toYesNo(
            apiPolicy.boardApproved ?? seedPolicy.boardApproved,
            'Yes'
          ),

          translatedToProcedure: toYesNo(
            apiPolicy.translatedToProcedure ?? seedPolicy.translatedToProcedure,
            'Yes'
          ),

          extendsToValueChain: toYesNo(
            apiPolicy.extendsToValueChain ?? seedPolicy.extendsToValueChain,
            p.id === 'P3' || p.id === 'P6' ? 'Yes' : 'No'
          ),

          codes:
            apiPolicy.codes ||
            seedPolicy.codes ||
            'MEIL-ESG-POL-01',

          link:
            apiPolicy.link ||
            seedPolicy.link ||
            'https://www.meil.in/esg-policies',

          notCoveredReason:
            apiPolicy.notCoveredReason ?? seedPolicy.notCoveredReason ?? '',

          targets,
        },
      ];
    })
  );

  const review = Object.fromEntries(
    PRINCIPLES.map((p) => {
      const seedReview = seedB.review?.[p.id] || {
        by: 'Committee of the Board',
        frequency: 'Quarterly',
      };
      const apiReview = backendReview[p.id] || {};

      return [
        p.id,
        {
          ...seedReview,
          ...apiReview,
        },
      ];
    })
  );

  const normalizedA = {
    ...DEFAULT_A,
    ...seedA,
    ...backend,

    financialYear,

    cin:
      backend.cin ||
      backend.cin_number ||
      seedA.cin ||
      DEFAULT_A.cin,

    entityName:
      backend.entityName ||
      backend.entity_name ||
      seedA.entityName ||
      DEFAULT_A.entityName,

    incorporationYear:
      backend.incorporationYear ||
      backend.incorporation_year ||
      seedA.incorporationYear ||
      DEFAULT_A.incorporationYear,

    registeredOffice:
      backend.registeredOffice ||
      backend.registered_office ||
      seedA.registeredOffice ||
      DEFAULT_A.registeredOffice,

    corporateOffice:
      backend.corporateOffice ||
      backend.corporate_office ||
      seedA.corporateOffice ||
      DEFAULT_A.corporateOffice,

    email:
      backend.email ||
      seedA.email ||
      DEFAULT_A.email,

    telephone:
      backend.telephone ||
      seedA.telephone ||
      DEFAULT_A.telephone,

    website:
      backend.website ||
      seedA.website ||
      DEFAULT_A.website,

    stockExchanges:
      backend.stockExchanges ||
      backend.stock_exchanges ||
      seedA.stockExchanges ||
      DEFAULT_A.stockExchanges,

    paidUpCapital:
      backend.paidUpCapital ??
      backend.paid_up_capital ??
      seedA.paidUpCapital ??
      DEFAULT_A.paidUpCapital,

    contact:
      backend.contactPerson ||
      backend.contact_person ||
      backend.contact ||
      seedA.contact ||
      DEFAULT_A.contact,

    csrTurnover:
      backend.csrTurnover ??
      backend.csr_turnover ??
      seedA.csrTurnover ??
      DEFAULT_A.csrTurnover,

    csrNetWorth:
      backend.csrNetWorth ??
      backend.csr_net_worth ??
      seedA.csrNetWorth ??
      DEFAULT_A.csrNetWorth,

    locations: {
      ...(DEFAULT_A.locations || {}),
      ...(seedA.locations || {}),

      plantsNational:
        backend.plantsNational ??
        seedA.locations?.plantsNational ??
        DEFAULT_A.locations.plantsNational,

      officesNational:
        backend.officesNational ??
        seedA.locations?.officesNational ??
        DEFAULT_A.locations.officesNational,

      plantsIntl:
        backend.plantsIntl ??
        seedA.locations?.plantsIntl ??
        DEFAULT_A.locations.plantsIntl,

      officesIntl:
        backend.officesIntl ??
        seedA.locations?.officesIntl ??
        DEFAULT_A.locations.officesIntl,
    },

    employees: {
      ...(DEFAULT_A.employees || {}),
      ...(seedA.employees || {}),
      ...(backend.employees || {}),
    },

    workers: {
      ...(DEFAULT_A.workers || {}),
      ...(seedA.workers || {}),
      ...(backend.workers || {}),
    },

    daEmployees: {
      ...(DEFAULT_A.daEmployees || {}),
      ...(seedA.daEmployees || {}),
      ...(backend.daEmployees || {}),
    },

    daWorkers: {
      ...(DEFAULT_A.daWorkers || {}),
      ...(seedA.daWorkers || {}),
      ...(backend.daWorkers || {}),
    },

    womenBoard: {
      ...(DEFAULT_A.womenBoard || {}),
      ...(seedA.womenBoard || {}),
      ...(backend.womenBoard || {}),
    },

    womenKMP: {
      ...(DEFAULT_A.womenKMP || {}),
      ...(seedA.womenKMP || {}),
      ...(backend.womenKmp || {}),
    },

    turnoverRate: {
      ...(DEFAULT_A.turnoverRate || {}),
      ...(seedA.turnoverRate || {}),
      ...(backend.turnoverRate || {}),
    },

    stakeholderComplaints:
      backend.stakeholderComplaints && Object.keys(backend.stakeholderComplaints).length > 0
        ? backend.stakeholderComplaints
        : (seedA.stakeholderComplaints && Object.keys(seedA.stakeholderComplaints).length > 0
            ? seedA.stakeholderComplaints
            : DEFAULT_A.stakeholderComplaints),

    businessActivities:
      Array.isArray(backend.businessActivities) && backend.businessActivities.length > 0
        ? backend.businessActivities
        : (Array.isArray(seedA.businessActivities) && seedA.businessActivities.length > 0
            ? seedA.businessActivities
            : DEFAULT_A.businessActivities),

    productsServices:
      Array.isArray(backend.productsServices) && backend.productsServices.length > 0
        ? backend.productsServices
        : (Array.isArray(seedA.productsServices) && seedA.productsServices.length > 0
            ? seedA.productsServices
            : DEFAULT_A.productsServices),

    csrApplicable: toYesNo(
      backend.csrApplicable ??
        seedA.csrApplicable,
      'Yes'
    ),
  };

  const normalizedB = {
    ...DEFAULT_B,
    ...seedB,

    directorStatement:
      backend.directorStatement ||
      seedB.directorStatement ||
      DEFAULT_B.directorStatement,

    esgHead:
      backend.esgHead ||
      seedB.esgHead ||
      DEFAULT_B.esgHead,

    committee:
      backend.boardCommittee ||
      backend.committee ||
      seedB.committee ||
      DEFAULT_B.committee,

    policies,

    review,

    externalAssessment: {
      ...(DEFAULT_B.externalAssessment || {}),
      ...(seedB.externalAssessment || {}),

      done: toYesNo(
        backend.externalAssessmentDone ??
          seedB.externalAssessment?.done,
        'Yes'
      ),

      agency:
        backend.externalAssessmentAgency ||
        seedB.externalAssessment?.agency ||
        DEFAULT_B.externalAssessment.agency,
    },
  };

  const normalizedCore8 = {
    ...DEFAULT_CORE8,
    ...seedCore8,
    ...(backend.core8 || {}),
    payablesDays:
      backend.core8?.payablesDays ||
      backend.accountsPayableDays ||
      seedCore8.payablesDays ||
      DEFAULT_CORE8.payablesDays,
  };

  const normalizedCore9 =
    normalizeCore9(
      backend.core9 || {},
      { ...DEFAULT_CORE9, ...seedCore9 }
    );

  return {
    A: normalizedA,
    B: normalizedB,
    core8: normalizedCore8,
    core9: normalizedCore9,
  };
};


// ─────────────────────────────────────────────
// Convert UI shape → Flask PUT payload
// ─────────────────────────────────────────────

const buildPayload = ({
  organizationId,
  financialYear,
  A,
  B,
  c8,
  c9,
}) => {
  const policies =
    Object.fromEntries(
      PRINCIPLES.map((p) => {
        const row =
          B.policies?.[p.id] ||
          {};

        return [
          p.id,
          {
            hasPolicy:
              toBoolean(row.hasPolicy),

            boardApproved:
              toBoolean(
                row.boardApproved
              ),

            translatedToProcedure:
              toBoolean(
                row.translatedToProcedure
              ),

            extendsToValueChain:
              toBoolean(
                row.extendsToValueChain
              ),

            codes:
              row.codes || null,

            link:
              row.link || null,

            notCoveredReason:
              row.notCoveredReason ||
              null,

            targets:
              Array.isArray(
                row.targets
              )
                ? row.targets
                : [],
          },
        ];
      })
    );


  const governanceReview =
    Object.fromEntries(
      PRINCIPLES.map((p) => {
        const row =
          B.review?.[p.id] ||
          {};

        return [
          p.id,
          {
            by:
              row.by ||
              'Committee of the Board',

            frequency:
              row.frequency ||
              'Quarterly',
          },
        ];
      })
    );


  return {
    organizationId,

    financialYear,

    // ───────────────────────
    // Section A
    // ───────────────────────

    cin:
      A.cin || null,

    entityName:
      A.entityName || null,

    incorporationYear:
      A.incorporationYear || null,

    registeredOffice:
      A.registeredOffice || null,

    corporateOffice:
      A.corporateOffice || null,

    email:
      A.email || null,

    telephone:
      A.telephone || null,

    website:
      A.website || null,

    stockExchanges:
      A.stockExchanges || null,

    paidUpCapital:
      numberOrNull(
        A.paidUpCapital
      ),

    contactPerson:
      A.contact || null,

    boundaryDeclared:
      (
        A.boundaryDeclared ||
        'consolidated'
      ).toUpperCase(),

    // Operations
    plantsNational:
      numberOrZero(
        A.locations?.plantsNational
      ),

    officesNational:
      numberOrZero(
        A.locations?.officesNational
      ),

    plantsIntl:
      numberOrZero(
        A.locations?.plantsIntl
      ),

    officesIntl:
      numberOrZero(
        A.locations?.officesIntl
      ),

    marketsNationalStates:
      numberOrZero(
        A.marketsNationalStates
      ),

    marketsIntlCountries:
      numberOrZero(
        A.marketsIntlCountries
      ),

    exportsPct:
      numberOrZero(
        A.exportsPct
      ),

    customerTypes:
      A.customerTypes || null,

    // JSON fields
    employees:
      A.employees || {},

    workers:
      A.workers || {},

    daEmployees:
      A.daEmployees || {},

    daWorkers:
      A.daWorkers || {},

    womenBoard:
      A.womenBoard || {},

    womenKmp:
      A.womenKMP || {},

    turnoverRate:
      A.turnoverRate || {},

    stakeholderComplaints:
      A.stakeholderComplaints || {},

    // CSR
    csrApplicable:
      toBoolean(
        A.csrApplicable
      ),

    csrTurnover:
      numberOrNull(
        A.csrTurnover
      ),

    csrNetWorth:
      numberOrNull(
        A.csrNetWorth
      ),

    // ───────────────────────
    // Section B
    // ───────────────────────

    directorStatement:
      B.directorStatement || null,

    esgHead:
      B.esgHead || null,

    boardCommittee:
      B.committee || null,

    externalAssessmentDone:
      toBoolean(
        B.externalAssessment?.done
      ),

    externalAssessmentAgency:
      B.externalAssessment?.agency ||
      null,

    businessActivities:
      (A.businessActivities || [])
        .filter(
          (row) =>
            String(
              row?.activity || ''
            ).trim()
        )
        .map((row) => ({
          activity:
            row.activity || '',

          description:
            row.description || '',

          turnoverPct:
            numberOrZero(
              row.turnoverPct
            ),
        })),

    productsServices:
      (A.productsServices || [])
        .filter(
          (row) =>
            String(
              row?.product || ''
            ).trim()
        )
        .map((row) => ({
          product:
            row.product || '',

          nic:
            row.nic || '',

          turnoverPct:
            numberOrZero(
              row.turnoverPct
            ),
        })),

    policies,

    governanceReview,

    // ───────────────────────
    // Core 8
    // ───────────────────────

    core8: {
      dataBreaches:
        numberOrZero(
          c8.dataBreaches
        ),

      dataBreachRatio:
        numberOrZero(
          c8.dataBreachRatio
        ),

      payablesDays:
        numberOrNull(
          c8.payablesDays
        ),
    },

    // ───────────────────────
    // Core 9
    // ───────────────────────

    core9: {
      purchTradingHousePct:
        numberOrNull(
          c9.purchTradingHousePct
        ),

      purchTradingHouseCount:
        numberOrNull(
          c9.purchTradingHouseCount
        ),

      purchTop10Pct:
        numberOrNull(
          c9.purchTop10Pct
        ),

      salesDealerPct:
        numberOrNull(
          c9.salesDealerPct
        ),

      salesDealerCount:
        numberOrNull(
          c9.salesDealerCount
        ),

      salesTop10Pct:
        numberOrNull(
          c9.salesTop10Pct
        ),

      rptPurchasesPct:
        numberOrNull(
          c9.rptPurchasesPct
        ),

      rptSalesPct:
        numberOrNull(
          c9.rptSalesPct
        ),

      rptLoansPct:
        numberOrNull(
          c9.rptLoansPct
        ),

      rptInvestmentsPct:
        numberOrNull(
          c9.rptInvestmentsPct
        ),
    },
  };
};


// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function Disclosures() {
  const {
    state,
    org,
    toast,
    ui,
  } = useApp();

  const nav =
    useNavigate();

  const seedDisclosures =
    state.disclosures || {};

  const [tab, setTab] =
    useState('A');

  const [A, setA] =
    useState(
      seedDisclosures.A || {}
    );

  const [B, setB] =
    useState(
      seedDisclosures.B || {}
    );

  const [c8, setC8] =
    useState(
      seedDisclosures.core8 || {}
    );

  const [c9, setC9] =
    useState(
      seedDisclosures.core9 || {}
    );

  const [backendOrgId, setBackendOrgId] =
    useState(null);

  const [backendTree, setBackendTree] =
    useState(null);

  const [materialIssues, setMaterialIssues] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const financialYear =
    ui?.fy ||
    A.financialYear ||
    CURRENT_FY;


  // ───────────────────────────────────────
  // Load organization + disclosure + risks
  // ───────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      try {
        setLoading(true);

        // 1. Get REAL backend organization tree.
        const tree =
          await organizationApi.getOrgTree();

        if (cancelled) return;

        setBackendTree(tree);

        const groupId =
          tree?.org?.id || null;

        if (!groupId) {
          throw new Error(
            'Backend group organization could not be found.'
          );
        }

        setBackendOrgId(groupId);


        // 2. Load the entity disclosure.
        const disclosure =
          await disclosureApi.getEntityDisclosure(
            groupId,
            financialYear
          );

        if (cancelled) return;

        const normalized =
          normalizeDisclosure(
            disclosure,
            seedDisclosures,
            financialYear
          );

        setA(normalized.A);
        setB(normalized.B);
        setC8(normalized.core8);
        setC9(normalized.core9);


        // 3. Load Section A24 material issues
        // directly from the backend.
        try {
          const riskResponse =
            await apiClient.get(
              '/risks/material-issues'
            );

          if (!cancelled) {
            setMaterialIssues(
              Array.isArray(
                riskResponse.data
              )
                ? riskResponse.data
                : []
            );
          }
        } catch (riskError) {
          if (!cancelled) {
            setMaterialIssues([]);
            toast(
              riskError?.message ||
                'Could not load material risk issues.',
              'error'
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          toast(
            error?.message ||
              'Failed to load disclosures.',
            'error'
          );

          // If backend data is unavailable,
          // keep the existing seed UI data.
          const fallback =
            normalizeDisclosure(
              null,
              seedDisclosures,
              financialYear
            );

          setA(fallback.A);
          setB(fallback.B);
          setC8(fallback.core8);
          setC9(fallback.core9);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [
    financialYear,
    toast,
  ]);


  // ───────────────────────────────────────
  // Update helpers
  // ───────────────────────────────────────

  const patchA =
    (key) =>
    (value) =>
      setA((current) => ({
        ...current,
        [key]: value,
      }));


  const patchGroup =
    (key, groupKey) =>
    (value) =>
      setA((current) => ({
        ...current,

        [key]: {
          ...(current[key] || {}),
          [groupKey]: value,
        },
      }));


  const patchPolicy =
    (principleId, key) =>
    (value) =>
      setB((current) => ({
        ...current,

        policies: {
          ...(current.policies || {}),

          [principleId]: {
            ...(current.policies?.[
              principleId
            ] || {}),

            [key]: value,
          },
        },
      }));


  const patchTarget =
    (principleId, key) =>
    (value) =>
      setB((current) => {
        const policy =
          current.policies?.[
            principleId
          ] || {};

        const existingTargets =
          Array.isArray(
            policy.targets
          ) &&
          policy.targets.length > 0
            ? policy.targets
            : [
                {
                  target: '',
                  baseline: '',
                  current: '',
                  status: '',
                },
              ];

        const firstTarget = {
          ...existingTargets[0],
          [key]: value,
        };

        return {
          ...current,

          policies: {
            ...(current.policies || {}),

            [principleId]: {
              ...policy,

              targets: [
                firstTarget,
              ],
            },
          },
        };
      });


  const patchReview =
    (principleId, key) =>
    (value) =>
      setB((current) => ({
        ...current,

        review: {
          ...(current.review || {}),

          [principleId]: {
            ...(current.review?.[
              principleId
            ] || {}),

            [key]: value,
          },
        },
      }));


  // ───────────────────────────────────────
  // Save everything to Flask
  // ───────────────────────────────────────

  const save = async () => {
    if (!backendOrgId) {
      toast(
        'Backend organization ID is not available.',
        'error'
      );
      return;
    }

    try {
      setSaving(true);

      const payload =
        buildPayload({
          organizationId:
            backendOrgId,

          financialYear,

          A,
          B,
          c8,
          c9,
        });


      const saved =
        await disclosureApi.saveEntityDisclosure(
          payload
        );


      // Normalize backend response
      // back into the UI shape.
      const normalized =
        normalizeDisclosure(
          saved,
          {
            A,
            B,
            core8: c8,
            core9: c9,
          },
          financialYear
        );

      setA(normalized.A);
      setB(normalized.B);
      setC8(normalized.core8);
      setC9(normalized.core9);

      toast(
        'Entity-level disclosures saved successfully.'
      );
    } catch (error) {
      toast(
        error?.message ||
          'Failed to save disclosures.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };


  // ───────────────────────────────────────
  // Safe values for rendering
  // ───────────────────────────────────────

  const employees =
    A.employees || {};

  const workers =
    A.workers || {};

  const daEmployees =
    A.daEmployees || {};

  const daWorkers =
    A.daWorkers || {};


  // Backend organization tree has no
  // ownershipPercentage in its current
  // /organizations/tree response.
  // Use the backend hierarchy as source of truth.
  const subsidiaries =
    backendTree?.subsidiaries?.length
      ? backendTree.subsidiaries
      : org?.subsidiaries || [];


  return (
    <div className="space-y-6 max-w-6xl">

      {/* ───────────────────────────────── */}
      {/* PAGE HEADER */}
      {/* ───────────────────────────────── */}

      <PageHeader
        title="Entity disclosures — Section A & B"
        subtitle={
          loading
            ? 'Loading entity disclosures from the MEIL ESG backend…'
            : `Financial year: ${financialYear}`
        }
        actions={
          <Btn
            onClick={save}
            disabled={
              loading || saving
            }
          >
            {saving ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <Save size={16} />
            )}

            {saving
              ? 'Saving…'
              : 'Save all'}
          </Btn>
        }
      />


      {/* ───────────────────────────────── */}
      {/* TABS */}
      {/* ───────────────────────────────── */}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'A',
            label:
              'Section A · General disclosures',
          },
          {
            id: 'B',
            label:
              'Section B · Policies & governance',
          },
          {
            id: 'core',
            label:
              'BRSR Core 8 & 9',
          },
        ]}
      />


      {/* ═══════════════════════════════════ */}
      {/* SECTION A */}
      {/* ═══════════════════════════════════ */}

      {tab === 'A' && (
        <div className="space-y-6">

          {/* Entity details */}
          <Card pad={false}>
            <CardHeader
              title="I. Entity details"
            />

            <div className="p-5 grid md:grid-cols-2 gap-4">

              <Field label="CIN">
                <Mini
                  v={A.cin}
                  on={patchA('cin')}
                  ph="U45201TG1988PLC..."
                />
              </Field>


              <Field label="Name of the listed entity">
                <Mini
                  v={A.entityName}
                  on={patchA('entityName')}
                />
              </Field>


              <Field label="Year of incorporation">
                <Mini
                  v={
                    A.incorporationYear
                  }
                  on={patchA(
                    'incorporationYear'
                  )}
                />
              </Field>


              <Field label="Financial year reported">
                <Mini
                  v={financialYear}
                  on={() => {}}
                />
              </Field>


              <Field
                label="Registered office address"
                span
              >
                <Mini
                  v={
                    A.registeredOffice
                  }
                  on={patchA(
                    'registeredOffice'
                  )}
                />
              </Field>


              <Field
                label="Corporate office address"
                span
              >
                <Mini
                  v={
                    A.corporateOffice
                  }
                  on={patchA(
                    'corporateOffice'
                  )}
                />
              </Field>


              <Field label="E-mail">
                <Mini
                  v={A.email}
                  on={patchA('email')}
                />
              </Field>


              <Field label="Telephone">
                <Mini
                  v={A.telephone}
                  on={patchA(
                    'telephone'
                  )}
                />
              </Field>


              <Field label="Website">
                <Mini
                  v={A.website}
                  on={patchA('website')}
                />
              </Field>


              <Field label="Stock exchange(s) listed on">
                <Mini
                  v={
                    A.stockExchanges
                  }
                  on={patchA(
                    'stockExchanges'
                  )}
                />
              </Field>


              <Field label="Paid-up capital (₹)">
                <Mini
                  type="number"
                  v={
                    A.paidUpCapital
                  }
                  on={patchA(
                    'paidUpCapital'
                  )}
                />
              </Field>


              <Field label="BRSR contact person">
                <Mini
                  v={A.contact}
                  on={patchA('contact')}
                />
              </Field>


              <Field label="Reporting boundary">
                <select
                  className={inputCls}
                  value={
                    A.boundaryDeclared ||
                    'consolidated'
                  }
                  onChange={(e) =>
                    patchA(
                      'boundaryDeclared'
                    )(
                      e.target.value
                    )
                  }
                >
                  <option value="consolidated">
                    Consolidated (entity + all entities in consolidated financials)
                  </option>

                  <option value="standalone">
                    Standalone (this entity only)
                  </option>
                </select>
              </Field>

            </div>
          </Card>


          {/* Business activities */}
          <Card pad={false}>
            <CardHeader
              title="II. Business activities & products/services"
              subtitle="Activities and products accounting for ~90% of turnover"
            />

            <div className="p-5 space-y-4">

              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">
                  Business activities
                </p>

                <RowTable
                  head={[
                    'Main activity',
                    'Description of business activity',
                    '% of turnover',
                  ]}
                  cols={[
                    'activity',
                    'description',
                    'turnoverPct',
                  ]}
                  rows={
                    A.businessActivities ||
                    []
                  }
                  onChange={patchA(
                    'businessActivities'
                  )}
                  addLabel="Add activity"
                  blank={{
                    activity: '',
                    description: '',
                    turnoverPct: '',
                  }}
                />
              </div>


              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">
                  Products / services sold
                </p>

                <RowTable
                  head={[
                    'Product / service',
                    'NIC code',
                    '% of turnover',
                  ]}
                  cols={[
                    'product',
                    'nic',
                    'turnoverPct',
                  ]}
                  rows={
                    A.productsServices ||
                    []
                  }
                  onChange={patchA(
                    'productsServices'
                  )}
                  addLabel="Add product / service"
                  blank={{
                    product: '',
                    nic: '',
                    turnoverPct: '',
                  }}
                />
              </div>

            </div>
          </Card>


          {/* Operations and markets */}
          <Card pad={false}>
            <CardHeader
              title="III. Operations & IV. Markets served"
            />

            <div className="p-5 grid md:grid-cols-2 gap-6">

              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">
                  Plants & offices
                </p>

                <div className="grid grid-cols-2 gap-3">

                  <Field label="National · plants">
                    <Mini
                      v={
                        A.locations
                          ?.plantsNational
                      }
                      on={patchGroup(
                        'locations',
                        'plantsNational'
                      )}
                    />
                  </Field>


                  <Field label="National · offices">
                    <Mini
                      v={
                        A.locations
                          ?.officesNational
                      }
                      on={patchGroup(
                        'locations',
                        'officesNational'
                      )}
                    />
                  </Field>


                  <Field label="International · plants">
                    <Mini
                      v={
                        A.locations
                          ?.plantsIntl
                      }
                      on={patchGroup(
                        'locations',
                        'plantsIntl'
                      )}
                    />
                  </Field>


                  <Field label="International · offices">
                    <Mini
                      v={
                        A.locations
                          ?.officesIntl
                      }
                      on={patchGroup(
                        'locations',
                        'officesIntl'
                      )}
                    />
                  </Field>

                </div>
              </div>


              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">
                  Markets
                </p>

                <div className="grid grid-cols-2 gap-3">

                  <Field label="States served (national)">
                    <Mini
                      v={
                        A.marketsNationalStates
                      }
                      on={patchA(
                        'marketsNationalStates'
                      )}
                    />
                  </Field>


                  <Field label="Countries served (intl.)">
                    <Mini
                      v={
                        A.marketsIntlCountries
                      }
                      on={patchA(
                        'marketsIntlCountries'
                      )}
                    />
                  </Field>


                  <Field label="Exports as % of turnover">
                    <Mini
                      v={A.exportsPct}
                      on={patchA(
                        'exportsPct'
                      )}
                    />
                  </Field>


                  <Field
                    label="Types of customers"
                    span
                  >
                    <Mini
                      v={A.customerTypes}
                      on={patchA(
                        'customerTypes'
                      )}
                    />
                  </Field>

                </div>
              </div>

            </div>
          </Card>


          {/* Workforce */}
          <Card pad={false}>
            <CardHeader
              title="V. Employees & workers (end of financial year)"
              subtitle="Permanent vs other-than-permanent, by gender — SEBI Annexure I Q18"
            />

            <div className="p-5 overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="text-[11px] font-bold text-slate-500 border-b">

                  <tr>
                    <th className="text-left px-2 py-2">
                      Category
                    </th>

                    <th className="px-2">
                      Male
                    </th>

                    <th className="px-2">
                      Female
                    </th>

                    <th className="px-2 text-right">
                      Total
                    </th>

                    <th className="px-2 text-right">
                      % female
                    </th>
                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {[
                    [
                      'Permanent employees',
                      'employees',
                      'permM',
                      'permF',
                    ],

                    [
                      'Other than permanent employees',
                      'employees',
                      'otherM',
                      'otherF',
                    ],

                    [
                      'Permanent workers',
                      'workers',
                      'permM',
                      'permF',
                    ],

                    [
                      'Other than permanent workers',
                      'workers',
                      'otherM',
                      'otherF',
                    ],
                  ].map(
                    ([
                      label,
                      grp,
                      mk,
                      fk,
                    ]) => {
                      const group =
                        grp ===
                        'employees'
                          ? employees
                          : workers;

                      const m =
                        group?.[mk];

                      const f =
                        group?.[fk];

                      const t =
                        (+m || 0) +
                        (+f || 0);

                      return (
                        <tr
                          key={
                            label +
                            grp
                          }
                        >
                          <td className="px-2 py-1.5 font-semibold">
                            {label}
                          </td>

                          <td className="px-2">
                            <Mini
                              v={m}
                              on={patchGroup(
                                grp,
                                mk
                              )}
                            />
                          </td>

                          <td className="px-2">
                            <Mini
                              v={f}
                              on={patchGroup(
                                grp,
                                fk
                              )}
                            />
                          </td>

                          <td className="px-2 py-1.5 text-right font-bold tabular-nums">
                            {t}
                          </td>

                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                            {pct(
                              +f || 0,
                              t
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>


              <p className="text-xs font-bold text-slate-500 mt-5 mb-2">
                Differently-abled employees & workers
              </p>


              <table className="w-full text-sm">

                <thead className="text-[11px] font-bold text-slate-500 border-b">

                  <tr>
                    <th className="text-left px-2 py-2">
                      Category
                    </th>

                    <th className="px-2">
                      Male
                    </th>

                    <th className="px-2">
                      Female
                    </th>

                    <th className="px-2 text-right">
                      Total
                    </th>
                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {[
                    [
                      'Permanent — employees',
                      'daEmployees',
                      'permM',
                      'permF',
                    ],

                    [
                      'Other than permanent — employees',
                      'daEmployees',
                      'otherM',
                      'otherF',
                    ],

                    [
                      'Permanent — workers',
                      'daWorkers',
                      'permM',
                      'permF',
                    ],

                    [
                      'Other than permanent — workers',
                      'daWorkers',
                      'otherM',
                      'otherF',
                    ],
                  ].map(
                    ([
                      label,
                      grp,
                      mk,
                      fk,
                    ]) => {
                      const group =
                        grp ===
                        'daEmployees'
                          ? daEmployees
                          : daWorkers;

                      const m =
                        group?.[mk];

                      const f =
                        group?.[fk];

                      return (
                        <tr
                          key={
                            label +
                            grp
                          }
                        >
                          <td className="px-2 py-1.5 font-semibold">
                            {label}
                          </td>

                          <td className="px-2">
                            <Mini
                              v={m}
                              on={patchGroup(
                                grp,
                                mk
                              )}
                            />
                          </td>

                          <td className="px-2">
                            <Mini
                              v={f}
                              on={patchGroup(
                                grp,
                                fk
                              )}
                            />
                          </td>

                          <td className="px-2 py-1.5 text-right font-bold tabular-nums">
                            {(+m || 0) +
                              (+f || 0)}
                          </td>
                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          </Card>


          {/* Women + turnover */}
          <Card pad={false}>
            <CardHeader
              title="Women representation & 3-year turnover rate"
            />

            <div className="p-5 grid md:grid-cols-2 gap-6">

              <div>
                <p className="text-xs font-bold text-slate-500 mb-2">
                  Participation of women (Q19)
                </p>

                <div className="space-y-2">

                  {[
                    [
                      'Board of Directors',
                      'womenBoard',
                    ],

                    [
                      'Key Management Personnel',
                      'womenKMP',
                    ],
                  ].map(
                    ([label, grp]) => (
                      <div
                        key={grp}
                        className="grid grid-cols-3 gap-2 items-end bg-slate-50 rounded-lg p-2"
                      >

                        <Field label={label}>
                          <Mini
                            v={
                              A[grp]
                                ?.total
                            }
                            on={patchGroup(
                              grp,
                              'total'
                            )}
                            ph="Total"
                          />
                        </Field>

                        <Field label="Female count">
                          <Mini
                            v={
                              A[grp]
                                ?.femaleCount
                            }
                            on={patchGroup(
                              grp,
                              'femaleCount'
                            )}
                          />
                        </Field>

                        <div className="text-right text-sm font-black text-slate-700 pb-2">
                          {pct(
                            +(
                              A[grp]
                                ?.femaleCount ||
                              0
                            ),
                            +(
                              A[grp]
                                ?.total ||
                              0
                            )
                          )}
                        </div>

                      </div>
                    )
                  )}

                </div>
              </div>


              <div>

                <p className="text-xs font-bold text-slate-500 mb-2">
                  Turnover rate — 3 year trend (Q20, %)
                </p>

                <div className="overflow-x-auto">

                  <table className="w-full text-xs">

                    <thead className="text-slate-500">

                      <tr>
                        <th className="text-left py-1">
                          FY
                        </th>

                        <th>
                          Employees M
                        </th>

                        <th>F</th>

                        <th>T</th>

                        <th>
                          Workers M
                        </th>

                        <th>F</th>

                        <th>T</th>
                      </tr>

                    </thead>


                    <tbody>

                      {[
                        [
                          'Current',
                          'cur',
                        ],

                        [
                          'Previous',
                          'prev',
                        ],

                        [
                          'Prior to previous',
                          'prev2',
                        ],
                      ].map(
                        ([label, key]) => (
                          <tr
                            key={key}
                          >
                            <td className="py-1 font-semibold">
                              {label}
                            </td>

                            {[
                              'empM',
                              'empF',
                              'empT',
                              'wkM',
                              'wkF',
                              'wkT',
                            ].map(
                              (field) => (
                                <td
                                  key={
                                    field
                                  }
                                  className="px-0.5"
                                >
                                  <input
                                    className={`${inputCls} !py-1 !text-xs !px-1.5 text-center`}
                                    value={
                                      A.turnoverRate?.[
                                        key
                                      ]?.[
                                        field
                                      ] ?? ''
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setA(
                                        (
                                          current
                                        ) => ({
                                          ...current,

                                          turnoverRate:
                                            {
                                              ...(current.turnoverRate ||
                                                {}),

                                              [key]:
                                                {
                                                  ...(current.turnoverRate?.[
                                                    key
                                                  ] ||
                                                    {}),

                                                  [field]:
                                                    e
                                                      .target
                                                      .value,
                                                },
                                            },
                                        })
                                      )
                                    }
                                  />
                                </td>
                              )
                            )}

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>
          </Card>


          {/* Organization hierarchy */}
          <Card pad={false}>

            <CardHeader
              title="VI. Holding, subsidiary, associate companies & JVs"
              subtitle="Q21 — organization hierarchy is read from the backend"
              right={
                <Btn
                  tone="ghost"
                  className="!py-1.5 !text-xs"
                  onClick={() =>
                    nav(
                      '/admin/organization'
                    )
                  }
                >
                  Edit hierarchy
                  <ExternalLink
                    size={12}
                  />
                </Btn>
              }
            />


            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="text-[11px] font-bold text-slate-500 border-b">

                  <tr>

                    <th className="text-left px-4 py-2">
                      Entity
                    </th>

                    <th className="text-left px-4 py-2">
                      Relationship
                    </th>

                    <th className="px-4 py-2 text-right">
                      % shares held
                    </th>

                    <th className="px-4 py-2">
                      Participates in BR initiatives?
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {subsidiaries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        No subsidiaries found in the backend organization tree.
                      </td>
                    </tr>
                  ) : (
                    subsidiaries.map(
                      (s) => {
                        const backendType =
                          String(
                            s.type || ''
                          ).toUpperCase();

                        const localMatch =
                          org?.subsidiaries?.find(
                            (x) =>
                              x.name ===
                              s.name
                          );

                        const relation =
                          API_REL_LABEL[
                            backendType
                          ] ||
                          REL_LABEL[
                            localMatch?.relation
                          ] ||
                          'Subsidiary';

                        return (
                          <tr
                            key={
                              s.id
                            }
                          >
                            <td className="px-4 py-2 font-semibold">
                              {s.name}
                            </td>

                            <td className="px-4 py-2">
                              {relation}
                            </td>

                            <td className="px-4 py-2 text-right tabular-nums">
                              {localMatch?.ownership !=
                              null
                                ? `${localMatch.ownership}%`
                                : '–'}
                            </td>

                            <td className="px-4 py-2">
                              <Badge tone="emerald">
                                Yes
                              </Badge>
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}

                </tbody>

              </table>

            </div>

          </Card>


          {/* CSR */}
          <Card className="grid md:grid-cols-3 gap-4">

            <CardHeaderInline
              title="VII(a). CSR details (Section 135)"
            />

            <Field label="CSR applicable?">
              <select
                className={inputCls}
                value={
                  A.csrApplicable ||
                  'Yes'
                }
                onChange={(e) =>
                  patchA(
                    'csrApplicable'
                  )(
                    e.target.value
                  )
                }
              >
                <option>
                  Yes
                </option>

                <option>
                  No
                </option>
              </select>
            </Field>


            <Field label="Turnover (₹)">
              <Mini
                type="number"
                v={A.csrTurnover}
                on={patchA(
                  'csrTurnover'
                )}
              />
            </Field>


            <Field label="Net worth (₹)">
              <Mini
                type="number"
                v={A.csrNetWorth}
                on={patchA(
                  'csrNetWorth'
                )}
              />
            </Field>

          </Card>


          {/* Stakeholder grievances */}
          <Card pad={false}>

            <CardHeader
              title="VII(b). Stakeholder grievance redressal (Q23)"
              subtitle="Complaints received under Principles 1–9, by stakeholder group"
            />


            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="text-[11px] font-bold text-slate-500 border-b">

                  <tr>

                    <th className="text-left px-3 py-2">
                      Stakeholder group
                    </th>

                    <th className="px-2">
                      Mechanism?
                    </th>

                    <th className="px-2">
                      Cur. filed
                    </th>

                    <th className="px-2">
                      Cur. pending
                    </th>

                    <th className="px-2">
                      Prev. filed
                    </th>

                    <th className="px-2">
                      Prev. pending
                    </th>

                    <th className="text-left px-2">
                      Remarks
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {STAKEHOLDER_GROUPS.map(
                    (groupName) => {
                      const row =
                        A.stakeholderComplaints?.[
                          groupName
                        ] || {
                          mechanism:
                            'Yes',
                          link: '',
                          curFiled:
                            '0',
                          curPending:
                            '0',
                          prevFiled:
                            '0',
                          prevPending:
                            '0',
                          curRemarks:
                            '',
                          prevRemarks:
                            '',
                        };

                      const setRow =
                        (key) =>
                        (value) =>
                          setA(
                            (current) => ({
                              ...current,

                              stakeholderComplaints:
                                {
                                  ...(current.stakeholderComplaints ||
                                    {}),

                                  [groupName]:
                                    {
                                      ...(current.stakeholderComplaints?.[
                                        groupName
                                      ] || row),

                                      [key]:
                                        value,
                                    },
                                },
                            })
                          );


                      return (
                        <tr
                          key={groupName}
                        >

                          <td className="px-3 py-1.5 font-semibold whitespace-nowrap">
                            {groupName}
                          </td>

                          <td className="px-2">
                            <select
                              className={`${inputCls} !py-1 !text-xs`}
                              value={
                                row.mechanism ||
                                'Yes'
                              }
                              onChange={(e) =>
                                setRow(
                                  'mechanism'
                                )(
                                  e.target.value
                                )
                              }
                            >
                              <option>
                                Yes
                              </option>

                              <option>
                                No
                              </option>
                            </select>
                          </td>

                          <td className="px-2">
                            <Mini
                              v={
                                row.curFiled
                              }
                              on={setRow(
                                'curFiled'
                              )}
                            />
                          </td>

                          <td className="px-2">
                            <Mini
                              v={
                                row.curPending
                              }
                              on={setRow(
                                'curPending'
                              )}
                            />
                          </td>

                          <td className="px-2">
                            <Mini
                              v={
                                row.prevFiled
                              }
                              on={setRow(
                                'prevFiled'
                              )}
                            />
                          </td>

                          <td className="px-2">
                            <Mini
                              v={
                                row.prevPending
                              }
                              on={setRow(
                                'prevPending'
                              )}
                            />
                          </td>

                          <td className="px-2">
                            <Mini
                              v={
                                row.curRemarks
                              }
                              on={setRow(
                                'curRemarks'
                              )}
                            />
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          </Card>


          {/* Material issues */}
          <Card
            pad={false}
          >

            <CardHeader
              title="VIII. Material responsible-business-conduct issues (Q24)"
              subtitle="Pulled from the ESG Risk register — only risks flagged 'Include in BRSR' appear here"
              icon={ShieldAlert}
              right={
                <Btn
                  tone="ghost"
                  className="!py-1.5 !text-xs"
                  onClick={() =>
                    nav(
                      '/admin/risk-management'
                    )
                  }
                >
                  Manage in Risk Matrix
                  <ExternalLink
                    size={12}
                  />
                </Btn>
              }
            />


            {materialIssues.length ===
            0 ? (
              <p className="p-5 text-sm text-slate-500">
                No risks are currently flagged for the BRSR material-issues disclosure.
              </p>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full text-sm">

                  <thead className="text-[11px] font-bold text-slate-500 border-b">

                    <tr>

                      <th className="text-left px-4 py-2">
                        Issue
                      </th>

                      <th className="px-2">
                        R / O
                      </th>

                      <th className="text-left px-2">
                        Rationale
                      </th>

                      <th className="text-left px-2">
                        Mitigation / adaptation
                      </th>

                      <th className="text-left px-2">
                        Financial implication
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-slate-100">

                    {materialIssues.map(
                      (r) => {
                        const isOpportunity =
                          String(
                            r.type || ''
                          ).toUpperCase() ===
                          'OPPORTUNITY';

                        return (
                          <tr
                            key={r.id}
                          >

                            <td className="px-4 py-2 font-semibold">
                              {r.title}
                            </td>

                            <td className="px-2">
                              <Badge
                                tone={
                                  isOpportunity
                                    ? 'emerald'
                                    : 'amber'
                                }
                              >
                                {isOpportunity
                                  ? 'O'
                                  : 'R'}
                              </Badge>
                            </td>

                            <td className="px-2 text-xs text-slate-600 max-w-[220px]">
                              {r.rationale ||
                                '—'}
                            </td>

                            <td className="px-2 text-xs text-slate-600 max-w-[220px]">
                              {r.mitigation ||
                                '—'}
                            </td>

                            <td className="px-2 text-xs text-slate-600 max-w-[200px]">
                              {r.financialImplication ||
                                '—'}
                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>
            )}


            <p className="px-5 pb-4 pt-2 text-[11px] text-slate-400">
              BRSR's financial-implications field is qualitative (positive/negative narrative). The Risk Matrix's ₹ Cr exposure is an internal management figure and is not pushed into this disclosure.
            </p>

          </Card>

        </div>
      )}


      {/* ═══════════════════════════════════ */}
      {/* SECTION B */}
      {/* ═══════════════════════════════════ */}

      {tab === 'B' && (
        <div className="space-y-6">

          {/* Governance */}
          <Card className="grid md:grid-cols-2 gap-5">

            <Field
              label="Highest authority for ESG (name & title)"
              span
            >
              <Mini
                v={B.esgHead}
                on={(v) =>
                  setB((current) => ({
                    ...current,
                    esgHead: v,
                  }))
                }
              />
            </Field>


            <Field label="Board committee overseeing sustainability">
              <Mini
                v={B.committee}
                on={(v) =>
                  setB((current) => ({
                    ...current,
                    committee: v,
                  }))
                }
              />
            </Field>


            <Field label="External assessment of policies carried out?">
              <select
                className={inputCls}
                value={
                  B.externalAssessment?.done ||
                  'No'
                }
                onChange={(e) =>
                  setB((current) => ({
                    ...current,

                    externalAssessment:
                      {
                        ...(current.externalAssessment ||
                          {}),

                        done:
                          e.target.value,
                      },
                  }))
                }
              >
                <option>
                  No
                </option>

                <option>
                  Yes
                </option>
              </select>
            </Field>


            {B.externalAssessment?.done ===
              'Yes' && (
              <Field
                label="Assessing agency"
                span
              >
                <Mini
                  v={
                    B.externalAssessment?.agency
                  }
                  on={(v) =>
                    setB((current) => ({
                      ...current,

                      externalAssessment:
                        {
                          ...(current.externalAssessment ||
                            {}),

                          agency:
                            v,
                        },
                    }))
                  }
                />
              </Field>
            )}


            <Field
              label="Director's statement on ESG challenges, targets & achievements"
              span
            >
              <textarea
                rows={4}
                className={inputCls}
                value={
                  B.directorStatement ??
                  ''
                }
                onChange={(e) =>
                  setB((current) => ({
                    ...current,

                    directorStatement:
                      e.target.value,
                  }))
                }
              />
            </Field>

          </Card>


          {/* Policy coverage */}
          <Card pad={false}>

            <CardHeader
              title="Policy coverage by principle (Q1–Q4, Q12)"
            />


            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="text-[11px] font-bold text-slate-500 border-b">

                  <tr>

                    <th className="text-left px-3 py-2">
                      Principle
                    </th>

                    <th className="px-2">
                      Has policy
                    </th>

                    <th className="px-2">
                      Board-approved
                    </th>

                    <th className="px-2">
                      Translated to procedure
                    </th>

                    <th className="px-2">
                      Extends to value chain
                    </th>

                    <th className="text-left px-2">
                      Codes / certifications
                    </th>

                    <th className="text-left px-2">
                      Policy link
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {PRINCIPLES.map(
                    (p) => {
                      const row =
                        B.policies?.[
                          p.id
                        ] || {
                          hasPolicy:
                            'Yes',
                          boardApproved:
                            'Yes',
                          translatedToProcedure:
                            'Yes',
                          extendsToValueChain:
                            'No',
                          codes:
                            '',
                          link:
                            '',
                          targets: [
                            {
                              target:
                                '',
                              baseline:
                                '',
                              current:
                                '',
                              status:
                                '',
                            },
                          ],
                          notCoveredReason:
                            '',
                        };

                      return (
                        <tr
                          key={p.id}
                        >

                          <td className="px-3 py-2 font-semibold whitespace-nowrap">
                            {p.id} · {p.label}
                          </td>


                          {[
                            'hasPolicy',
                            'boardApproved',
                            'translatedToProcedure',
                            'extendsToValueChain',
                          ].map(
                            (key) => (
                              <td
                                key={
                                  key
                                }
                                className="px-2"
                              >
                                <select
                                  className={`${inputCls} !py-1 !text-xs`}
                                  value={
                                    row[
                                      key
                                    ] ??
                                    'No'
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    patchPolicy(
                                      p.id,
                                      key
                                    )(
                                      e.target.value
                                    )
                                  }
                                >
                                  <option>
                                    Yes
                                  </option>

                                  <option>
                                    No
                                  </option>
                                </select>
                              </td>
                            )
                          )}


                          <td className="px-2">

                            <Mini
                              v={
                                row.codes
                              }
                              on={patchPolicy(
                                p.id,
                                'codes'
                              )}
                              ph="ISO 14001…"
                            />

                          </td>


                          <td className="px-2">

                            <Mini
                              v={
                                row.link
                              }
                              on={patchPolicy(
                                p.id,
                                'link'
                              )}
                              ph="https://"
                            />

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>


            <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-100">
              If a principle has no policy, record the reason under that principle in the field below.
            </p>


            <div className="px-5 pb-5 grid md:grid-cols-3 gap-3">

              {PRINCIPLES.filter(
                (p) =>
                  B.policies?.[
                    p.id
                  ]?.hasPolicy ===
                  'No'
              ).map(
                (p) => (
                  <Field
                    key={p.id}
                    label={`${p.id} — reason not covered`}
                  >
                    <Mini
                      v={
                        B.policies?.[
                          p.id
                        ]?.notCoveredReason
                      }
                      on={patchPolicy(
                        p.id,
                        'notCoveredReason'
                      )}
                    />
                  </Field>
                )
              )}

            </div>

          </Card>


          {/* Commitments */}
          <Card pad={false}>

            <CardHeader
              title="Commitments, goals & targets (Q5–Q6)"
              subtitle="One row per principle — baseline, current performance, status against target"
            />


            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="text-[11px] font-bold text-slate-500 border-b">

                  <tr>

                    <th className="text-left px-3 py-2">
                      Principle
                    </th>

                    <th className="text-left px-2">
                      Target
                    </th>

                    <th className="px-2">
                      Baseline
                    </th>

                    <th className="px-2">
                      Current performance
                    </th>

                    <th className="text-left px-2">
                      Status / reason if not met
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {PRINCIPLES.map(
                    (p) => {
                      const row =
                        B.policies?.[
                          p.id
                        ] || {};

                      const target =
                        row.targets?.[
                          0
                        ] || {
                          target:
                            '',
                          baseline:
                            '',
                          current:
                            '',
                          status:
                            '',
                        };

                      return (
                        <tr
                          key={p.id}
                        >

                          <td className="px-3 py-2 font-semibold whitespace-nowrap">
                            {p.id}
                          </td>


                          <td className="px-2">
                            <Mini
                              v={
                                target.target
                              }
                              on={patchTarget(
                                p.id,
                                'target'
                              )}
                              ph="e.g. −20% Scope 2 by FY30"
                            />
                          </td>


                          <td className="px-2">
                            <Mini
                              v={
                                target.baseline
                              }
                              on={patchTarget(
                                p.id,
                                'baseline'
                              )}
                            />
                          </td>


                          <td className="px-2">
                            <Mini
                              v={
                                target.current
                              }
                              on={patchTarget(
                                p.id,
                                'current'
                              )}
                            />
                          </td>


                          <td className="px-2">
                            <Mini
                              v={
                                target.status
                              }
                              on={patchTarget(
                                p.id,
                                'status'
                              )}
                              ph="On track / delayed…"
                            />
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          </Card>


          {/* Governance review */}
          <Card pad={false}>

            <CardHeader
              title="Governance review (Q10)"
              subtitle="Review of NGRBC performance & compliance, by principle"
            />


            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="text-[11px] font-bold text-slate-500 border-b">

                  <tr>

                    <th className="text-left px-3 py-2">
                      Principle
                    </th>

                    <th className="text-left px-2">
                      Reviewed by
                    </th>

                    <th className="text-left px-2">
                      Frequency
                    </th>

                  </tr>

                </thead>


                <tbody className="divide-y divide-slate-100">

                  {PRINCIPLES.map(
                    (p) => {
                      const row =
                        B.review?.[
                          p.id
                        ] || {
                          by:
                            'Committee of the Board',
                          frequency:
                            'Quarterly',
                        };

                      return (
                        <tr
                          key={p.id}
                        >

                          <td className="px-3 py-2 font-semibold">
                            {p.id}
                          </td>


                          <td className="px-2">

                            <select
                              className={`${inputCls} !py-1 !text-xs`}
                              value={
                                row.by
                              }
                              onChange={(
                                e
                              ) =>
                                patchReview(
                                  p.id,
                                  'by'
                                )(
                                  e.target.value
                                )
                              }
                            >

                              {[
                                'Director',
                                'Committee of the Board',
                                'Any other committee',
                              ].map(
                                (x) => (
                                  <option
                                    key={
                                      x
                                    }
                                  >
                                    {x}
                                  </option>
                                )
                              )}

                            </select>

                          </td>


                          <td className="px-2">

                            <select
                              className={`${inputCls} !py-1 !text-xs`}
                              value={
                                row.frequency
                              }
                              onChange={(
                                e
                              ) =>
                                patchReview(
                                  p.id,
                                  'frequency'
                                )(
                                  e.target.value
                                )
                              }
                            >

                              {[
                                'Annually',
                                'Half-yearly',
                                'Quarterly',
                                'Any other',
                              ].map(
                                (x) => (
                                  <option
                                    key={
                                      x
                                    }
                                  >
                                    {x}
                                  </option>
                                )
                              )}

                            </select>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

          </Card>

        </div>
      )}


      {/* ═══════════════════════════════════ */}
      {/* CORE 8 + 9 */}
      {/* ═══════════════════════════════════ */}

      {tab === 'core' && (
        <div className="grid md:grid-cols-2 gap-6">

          {/* Core 8 */}
          <Card pad={false}>

            <CardHeader
              title="Core attribute 8 — Fairness with customers & suppliers"
              subtitle="Entity-level; not summed from sites"
            />

            <div className="p-5 space-y-4">

              {CORE8_FAIRNESS.map(
                (field) => (
                  <Field
                    key={field.id}
                    label={`${field.label} (${field.unit})`}
                  >
                    <Mini
                      type="number"
                      v={
                        c8[field.id]
                      }
                      on={(value) =>
                        setC8(
                          (current) => ({
                            ...current,
                            [field.id]:
                              value,
                          })
                        )
                      }
                    />
                  </Field>
                )
              )}

            </div>

          </Card>


          {/* Core 9 */}
          <Card pad={false}>

            <CardHeader
              title="Core attribute 9 — Openness of business"
              subtitle="Trading-house / dealer concentration & related-party transactions, each reported separately"
            />

            <div className="p-5 space-y-4">

              {CORE9_OPENNESS.map(
                (field) => (
                  <Field
                    key={field.id}
                    label={`${field.label} (${field.unit})`}
                  >
                    <Mini
                      type="number"
                      v={
                        c9[field.id]
                      }
                      on={(value) =>
                        setC9(
                          (current) => ({
                            ...current,
                            [field.id]:
                              value,
                          })
                        )
                      }
                    />
                  </Field>
                )
              )}

            </div>

          </Card>

        </div>
      )}

    </div>
  );
}
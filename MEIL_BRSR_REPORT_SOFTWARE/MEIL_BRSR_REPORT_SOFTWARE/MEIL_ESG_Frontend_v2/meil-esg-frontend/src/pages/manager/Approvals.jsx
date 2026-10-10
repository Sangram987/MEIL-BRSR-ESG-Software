import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Check,
  X,
  Filter,
  History,
  ClipboardList,
  AlertCircle,
  RotateCcw,
  Search,
  AlertTriangle,
  FileWarning,
  Layers,
} from 'lucide-react';

import {
  useApp,
} from '../../store/AppStore';

import {
  PRINCIPLES,
  periodLabel,
  principleOf,
} from '../../data/brsr';

import {
  validateValues,
  checklistFor,
} from '../../lib/validate';

import {
  fmt,
} from '../../lib/consolidate';

import {
  Modal,
  Btn,
  Badge,
  StatusBadge,
  PageHeader,
  Card,
  Table,
  Tabs,
  Empty,
  EvidenceViewer,
  FileChip,
  inputCls,
  dt,
} from '../../components/ui';

import apiClient from '../../services/apiClient';
import approvalsApi from '../../services/approvalsApi';
import organizationApi from '../../services/organizationApi';
import evidenceApi from '../../services/evidenceApi';


// ─────────────────────────────────────────────
// Backend → frontend helpers
// ─────────────────────────────────────────────

const STATUS_MAP = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  BU_VERIFIED: 'bu_verified',
  SUBSIDIARY_VERIFIED: 'subsidiary_verified',
  SUB_VERIFIED: 'subsidiary_verified',
  CORRECTION_REQUIRED: 'correction_required',
  REJECTED: 'rejected',
  APPROVED: 'approved',
  LOCKED: 'locked',
};


function normalizeStatus(status) {
  const key = String(
    status || 'DRAFT'
  ).toUpperCase();

  return (
    STATUS_MAP[key] ||
    String(status || 'draft').toLowerCase()
  );
}


function normalizeEnteredBy(role) {
  const value = String(
    role || ''
  ).toUpperCase();

  if (value === 'BU_MANAGER') {
    return 'manager';
  }

  if (value === 'SITE_OPERATOR') {
    return 'operator';
  }

  return (
    value.toLowerCase() ||
    'operator'
  );
}


function normalizeValues(values) {
  if (!values) {
    return {};
  }

  // Current Flask shape:
  // {
  //   indicatorCode: {
  //     value,
  //     sourceType,
  //     evidence: []
  //   }
  // }
  if (
    !Array.isArray(values) &&
    typeof values === 'object'
  ) {
    return Object.fromEntries(
      Object.entries(values).map(
        ([indicatorCode, cell]) => ({
          [indicatorCode]: {
            v:
              cell?.value ??
              cell?.v ??
              '',

            ev:
              Array.isArray(
                cell?.evidence
              )
                ? cell.evidence[0] || ''
                : cell?.ev || '',

            evidence:
              Array.isArray(
                cell?.evidence
              )
                ? cell.evidence
                : [],

            sourceType:
              cell?.sourceType ||
              '',
          },
        })
      )
    );
  }

  // Compatibility with an older
  // array-shaped response.
  if (Array.isArray(values)) {
    return Object.fromEntries(
      values.map((cell) => [
        cell.indicator_code ||
          cell.indicatorCode,

        {
          v:
            cell.numeric_value ??
            cell.numericValue ??
            cell.text_value ??
            cell.textValue ??
            '',

          ev:
            Array.isArray(
              cell.document_ids
            )
              ? cell.document_ids[0] ||
                ''
              : Array.isArray(
                    cell.documentIds
                  )
              ? cell.documentIds[0] ||
                ''
              : '',

          evidence:
            cell.document_ids ||
            cell.documentIds ||
            [],
        },
      ])
    );
  }

  return {};
}


function normalizeSubmission(
  raw = {}
) {
  return {
    id:
      raw.id,

    code:
      raw.code ||
      raw.submissionCode ||
      raw.submission_code ||
      raw.id,

    projectId:
      raw.projectId ||
      raw.project_id ||
      null,

    period:
      raw.reportingPeriodId ||
      raw.reporting_period_id ||
      null,

    principle:
      raw.principleCode ||
      raw.principle_code ||
      raw.principleId ||
      null,

    status:
      normalizeStatus(
        raw.status
      ),

    values:
      normalizeValues(
        raw.values ||
        raw.esg_values
      ),

    submittedBy:
      raw.submittedBy ||
      raw.submitted_by ||
      null,

    submittedAt:
      raw.submittedAt ||
      raw.submitted_at ||
      null,

    enteredBy:
      normalizeEnteredBy(
        raw.enteredByRole ||
        raw.entered_by_role
      ),

    reviewer:
      raw.reviewComment ||
      raw.review_comment
        ? {
            name:
              raw.reviewedBy?.name ||
              raw.reviewed_by_user?.name ||
              'Reviewer',

            comment:
              raw.reviewComment ||
              raw.review_comment ||
              '',

            checklist:
              raw.reviewChecklist ||
              raw.review_checklist ||
              {},

            at:
              raw.reviewedAt ||
              raw.reviewed_at ||
              null,
          }
        : null,

    assurance:
      raw.assessmentStatus ||
      raw.assessment_status ||
      'NOT_STARTED',

    history: (
      raw.reviews ||
      raw.history ||
      raw.review_actions ||
      []
    ).map((item) => ({
      at:
        item.at ||
        item.created_at ||
        null,

      by:
        item.reviewer ||
        item.by ||
        item.user?.name ||
        'System',

      action:
        item.action ||
        item.action_type ||
        'UPDATE',

      note:
        item.comment ||
        item.notes ||
        item.note ||
        '',
    })),
  };
}


// ─────────────────────────────────────────────
// Review calculation model
// ─────────────────────────────────────────────

function useReviewModel(
  submission,
  calc,
  backendProjects
) {
  return useMemo(() => {
    if (!submission) {
      return null;
    }

    const localProject =
      calc?.projById?.get(
        submission.projectId
      ) || null;

    const backendProject =
      backendProjects.find(
        (project) =>
          project.id ===
          submission.projectId
      ) || null;

    const project =
      localProject ||
      backendProject ||
      {
        id: submission.projectId,
        name: submission.projectId,
      };


    let result = {
      errors: [],
      warnings: [],
    };

    try {
      result = validateValues({
        principle:
          submission.principle,

        values:
          submission.values,

        project,

        period:
          submission.period,

        calc,
      });
    } catch {
      result = {
        errors: [],
        warnings: [],
      };
    }


    const principle =
      principleOf(
        submission.principle
      );


    const indicators =
      principle?.indicators || [];


    const lines =
      indicators
        .filter(
          (indicator) =>
            !indicator.lead ||
            submission.values?.[
              indicator.id
            ]?.v !== ''
        )
        .map((indicator) => {
          const cell =
            submission.values?.[
              indicator.id
            ] || {};

          const hasValue =
            cell.v !== '' &&
            cell.v != null;


          let history = {
            avg: null,
            n: 0,
          };


          if (
            hasValue &&
            indicator.kind ===
              'flow' &&
            calc?.historyAvg
          ) {
            try {
              history =
                calc.historyAvg(
                  project,
                  indicator.id,
                  submission.period
                ) || history;
            } catch {
              // Historical data is optional.
            }
          }


          const delta =
            hasValue &&
            history.avg > 0 &&
            indicator.kind === 'flow'
              ? (
                  (+cell.v -
                    history.avg) /
                  history.avg
                ) * 100
              : null;


          const flags = [
            ...result.errors,
            ...result.warnings,
          ].filter(
            (item) =>
              item.id ===
              indicator.id
          );


          return {
            indicator,
            cell,
            hasValue,
            history,
            delta,
            flags,
          };
        });


    return {
      project,
      result,
      lines,
      checklist:
        checklistFor(result),
    };
  }, [
    submission,
    calc,
    backendProjects,
  ]);
}


// ─────────────────────────────────────────────
// Review modal
// ─────────────────────────────────────────────

function ReviewModal({
  submission,
  onClose,
  onCompleted,
  backendProjects,
}) {
  const {
    calc,
    user,
    toast,
  } = useApp();


  const model =
    useReviewModel(
      submission,
      calc,
      backendProjects
    );


  const [
    checks,
    setChecks,
  ] = useState({});


  const [
    comment,
    setComment,
  ] = useState('');


  const [
    doc,
    setDoc,
  ] = useState(null);


  const [
    deciding,
    setDeciding,
  ] = useState(false);


  if (
    !submission ||
    !model
  ) {
    return null;
  }


  const allChecks =
    model.checklist.length === 0 ||
    model.checklist.every(
      (item) =>
        checks[item.id]
    );


  const doDecision =
    async (decision) => {
      if (
        decision !== 'approve' &&
        !comment.trim()
      ) {
        toast(
          'Add a comment explaining what the site must fix.',
          'error'
        );

        return;
      }


      if (
        decision === 'approve' &&
        !allChecks
      ) {
        toast(
          'Complete every review check before approval.',
          'error'
        );

        return;
      }


      try {
        setDeciding(true);


        if (decision === 'approve') {
          if (submission.status === 'subsidiary_verified') {
            await approvalsApi.approveSubmission(
              submission.id,
              comment.trim(),
              checks
            );
          } else if (submission.status === 'bu_verified') {
            await approvalsApi.verifySubsidiarySubmission(
              submission.id,
              comment.trim(),
              checks
            );
          } else {
            await approvalsApi.verifySubmission(
              submission.id,
              comment.trim(),
              checks
            );
          }
        }

        if (decision === 'correction') {
          await approvalsApi.requestCorrection(
            submission.id,
            comment.trim(),
            checks
          );
        }

        if (decision === 'reject') {
          await approvalsApi.rejectSubmission(
            submission.id,
            comment.trim()
          );
        }

        const messages = {
          approve:
            submission.status === 'subsidiary_verified'
              ? `${submission.code} granted final Admin approval and locked.`
              : submission.status === 'bu_verified'
              ? `${submission.code} verified by Subsidiary Head and forwarded to Admin.`
              : `${submission.code} verified by BU Manager and forwarded to Subsidiary.`,
          correction:
            `${submission.code} sent back to the site operator for correction.`,
          reject:
            `${submission.code} rejected successfully.`,
        };

        toast(
          messages[decision]
        );


        if (onCompleted) {
          await onCompleted();
        }


        onClose();
      } catch (error) {
        toast(
          error?.message ||
            'Failed to save the review decision.',
          'error'
        );
      } finally {
        setDeciding(false);
      }
    };


  const openEvidence =
    async (
      evidenceId,
      metadata
    ) => {
      if (!evidenceId) {
        return;
      }


      try {
        const blob =
          await evidenceApi.downloadDocument(
            evidenceId
          );


        const url =
          URL.createObjectURL(
            blob
          );


        setDoc({
          ...metadata,
          url,
        });
      } catch (error) {
        toast(
          error.message ||
            'Unable to open evidence.',
          'error'
        );
      }
    };


  return (
    <>
      <Modal
        open
        wide
        onClose={() =>
          !deciding &&
          onClose()
        }
        title={`${submission.code} · ${model.project.name}`}
        subtitle={`${submission.principle} · ${periodLabel(
          submission.period
        )} · submitted ${dt(
          submission.submittedAt
        )}`}
        footer={
          <>
            <Btn
              tone="danger"
              disabled={deciding}
              onClick={() =>
                doDecision(
                  'reject'
                )
              }
            >
              <X size={16} />
              Reject
            </Btn>


            <Btn
              tone="warn"
              disabled={deciding}
              onClick={() =>
                doDecision(
                  'correction'
                )
              }
            >
              <RotateCcw
                size={16}
              />
              Request correction
            </Btn>


            <Btn
              tone="ok"
              disabled={
                deciding ||
                !allChecks
              }
              title={
                allChecks
                  ? ''
                  : 'Tick every review check first'
              }
              onClick={() =>
                doDecision(
                  'approve'
                )
              }
            >
              <Check size={16} />
              {deciding
                ? 'Saving…'
                : submission.status === 'subsidiary_verified'
                ? 'Admin Final Approve & Lock'
                : submission.status === 'bu_verified'
                ? 'Subsidiary Verify & Forward to Admin'
                : 'BU Verify & Forward to Subsidiary'}
            </Btn>
          </>
        }
      >

        {submission.enteredBy ===
          'manager' && (
          <div className="mb-4 p-3 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-800 font-semibold">
            This packet was entered by a BU Manager on behalf of the site. It is flagged for Group ESG spot-check.
          </div>
        )}


        <div className="overflow-x-auto border border-slate-200 rounded-xl mb-5">

          <Table
            head={[
              'Indicator',
              {
                label:
                  'Reported',
                right: true,
              },
              {
                label:
                  '6-mo avg',
                right: true,
              },
              {
                label:
                  'Δ',
                right: true,
              },
              'Evidence',
              'System checks',
            ]}
          >

            {model.lines.map(
              ({
                indicator,
                cell,
                hasValue,
                history,
                delta,
                flags,
              }) => {

                const evidenceId =
                  cell.ev ||
                  cell.evidence?.[0];


                return (
                  <tr
                    key={
                      indicator.id
                    }
                    className={
                      flags.length
                        ? 'bg-amber-50/40'
                        : ''
                    }
                  >

                    <td className="px-4 py-2.5 font-medium">
                      {indicator.label.trim()}

                      {indicator.core && (
                        <Badge
                          tone="rose"
                          className="ml-1"
                        >
                          Core
                        </Badge>
                      )}
                    </td>


                    <td className="px-4 py-2.5 text-right font-black text-slate-900 tabular-nums">
                      {hasValue ? (
                        <>
                          {fmt(
                            +cell.v,
                            2
                          )}

                          <span className="text-[11px] font-medium text-slate-500 ml-1">
                            {
                              indicator.unit
                            }
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-300">
                          —
                        </span>
                      )}
                    </td>


                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                      {history.avg !=
                      null
                        ? fmt(
                            history.avg,
                            indicator.int
                              ? 0
                              : 1
                          )
                        : '–'}
                    </td>


                    <td
                      className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                        delta > 40
                          ? 'text-rose-600'
                          : delta <
                            -60
                          ? 'text-amber-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {delta != null
                        ? `${
                            delta > 0
                              ? '+'
                              : ''
                          }${delta.toFixed(
                            0
                          )}%`
                        : '–'}
                    </td>


                    <td className="px-4 py-2.5">

                      {evidenceId ? (
                        <FileChip
                          name={`Evidence ${String(
                            evidenceId
                          ).slice(
                            0,
                            8
                          )}`}
                          onClick={() =>
                            openEvidence(
                              evidenceId,
                              {
                                name: `Evidence ${String(
                                  evidenceId
                                ).slice(
                                  0,
                                  8
                                )}`,

                                site:
                                  model.project
                                    .name,

                                value:
                                  hasValue
                                    ? fmt(
                                        +cell.v,
                                        2
                                      )
                                    : '—',

                                unit:
                                  indicator.unit,

                                indicator:
                                  indicator.label.trim(),

                                period:
                                  periodLabel(
                                    submission.period
                                  ),
                              }
                            )
                          }
                        />
                      ) : indicator.ev &&
                        hasValue &&
                        +cell.v > 0 ? (
                        <Badge tone="rose">
                          <FileWarning
                            size={11}
                          />
                          Missing
                        </Badge>
                      ) : (
                        <span className="text-slate-300">
                          –
                        </span>
                      )}

                    </td>


                    <td className="px-4 py-2.5 text-xs">

                      {flags.length ? (
                        flags.map(
                          (
                            flag,
                            index
                          ) => (
                            <span
                              key={
                                index
                              }
                              className={`block font-semibold ${
                                flag.kind ===
                                  'evidence' ||
                                flag.kind ===
                                  'logic' ||
                                !flag.kind
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {
                                flag.msg
                              }
                            </span>
                          )
                        )
                      ) : (
                        <span className="text-emerald-600 font-semibold">
                          OK
                        </span>
                      )}

                    </td>

                  </tr>
                );
              }
            )}

          </Table>

        </div>


        <div className="grid md:grid-cols-2 gap-5">

          <div>

            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Review checklist
            </h3>


            <div className="space-y-2">

              {model.checklist.map(
                (item) => (
                  <label
                    key={
                      item.id
                    }
                    className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer"
                  >

                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={
                        !!checks[
                          item.id
                        ]
                      }
                      onChange={(
                        event
                      ) =>
                        setChecks(
                          (
                            current
                          ) => ({
                            ...current,

                            [item.id]:
                              event
                                .target
                                .checked,
                          })
                        )
                      }
                    />

                    <span>
                      {
                        item.label
                      }

                      {!item.auto && (
                        <Badge
                          tone="amber"
                          className="ml-1"
                        >
                          System flagged
                        </Badge>
                      )}
                    </span>

                  </label>
                )
              )}

            </div>

          </div>


          <div>

            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Comment to site{' '}
              <span className="text-xs font-medium text-slate-400">
                (required for correction / reject)
              </span>
            </h3>

            <textarea
              rows={5}
              className={inputCls}
              value={
                comment
              }
              onChange={(e) =>
                setComment(
                  e.target.value
                )
              }
              placeholder="e.g. Diesel spike vs average — attach fuel register for the extra 35,000 L."
            />

          </div>

        </div>

      </Modal>


      <EvidenceViewer
        doc={doc}
        onClose={() => {
          if (doc?.url) {
            URL.revokeObjectURL(
              doc.url
            );
          }

          setDoc(null);
        }}
      />
    </>
  );
}


// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function Approvals() {
  const {
    user,
    calc,
    toast,
  } = useApp();


  const [
    tab,
    setTab,
  ] = useState('queue');


  const [
    open,
    setOpen,
  ] = useState(null);


  const [
    q,
    setQ,
  ] = useState('');


  const [
    principleFilter,
    setPrincipleFilter,
  ] = useState('');


  const [
    submissions,
    setSubmissions,
  ] = useState([]);


  const [
    projects,
    setProjects,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    loadingDetail,
    setLoadingDetail,
  ] = useState(false);


  // ─────────────────────────────────────
  // Load backend data
  // ─────────────────────────────────────

  const loadData =
    async () => {
      try {
        setLoading(true);


        const [
          approvalResponse,
          subsidiaryVerifiedResponse,
          verifiedResponse,
          correctionResponse,
          rejectedResponse,
          approvedResponse,
          lockedResponse,
          projectResponse,
        ] = await Promise.all([
          // Pending review
          apiClient.get(
            '/approvals'
          ),

          // Subsidiary Verified (Awaiting Admin)
          apiClient.get(
            '/submissions',
            {
              params: {
                status:
                  'SUBSIDIARY_VERIFIED',
              },
            }
          ),

          // BU Verified (Awaiting Subsidiary)
          apiClient.get(
            '/submissions',
            {
              params: {
                status:
                  'BU_VERIFIED',
              },
            }
          ),

          // Returned to site
          apiClient.get(
            '/submissions',
            {
              params: {
                status:
                  'CORRECTION_REQUIRED',
              },
            }
          ),

          // Rejected
          apiClient.get(
            '/submissions',
            {
              params: {
                status:
                  'REJECTED',
              },
            }
          ),

          // Approved
          apiClient.get(
            '/submissions',
            {
              params: {
                status:
                  'APPROVED',
              },
            }
          ),

          // Locked
          apiClient.get(
            '/submissions',
            {
              params: {
                status:
                  'LOCKED',
              },
            }
          ),

          // Projects available to
          // current authenticated user
          organizationApi.getProjects(
            user?.buId ||
              null
          ),
        ]);


        const queueRows =
          (
            approvalResponse
              .data?.items ||
            []
          ).map(
            normalizeSubmission
          );


        const subsidiaryVerifiedRows =
          (
            subsidiaryVerifiedResponse
              .data?.items ||
            []
          ).map(
            normalizeSubmission
          );


        const verifiedRows =
          (
            verifiedResponse
              .data?.items ||
            []
          ).map(
            normalizeSubmission
          );


        const correctionRows =
          (
            correctionResponse
              .data?.items ||
            []
          ).map(
            normalizeSubmission
          );


        const rejectedRows =
          (
            rejectedResponse
              .data?.items ||
            []
          ).map(
            normalizeSubmission
          );


        const approvedRows =
          (
            approvedResponse
              .data?.items ||
            []
          ).map(
            normalizeSubmission
          );


        const lockedRows =
          (
            lockedResponse
              .data?.items ||
            []
          ).map(
            normalizeSubmission
          );


        const combined = [
          ...queueRows,
          ...subsidiaryVerifiedRows,
          ...verifiedRows,
          ...correctionRows,
          ...rejectedRows,
          ...approvedRows,
          ...lockedRows,
        ];


        /*
         * Remove duplicate submissions.
         */
        const unique =
          Array.from(
            new Map(
              combined.map(
                (submission) => [
                  submission.id,
                  submission,
                ]
              )
            ).values()
          );


        setSubmissions(
          unique
        );


        setProjects(
          Array.isArray(
            projectResponse
          )
            ? projectResponse
            : []
        );

      } catch (error) {
        toast(
          error?.message ||
            'Failed to load approval data.',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };


  useEffect(() => {
    loadData();
  }, [user?.buId]);


  // ─────────────────────────────────────
  // Project lookup
  // ─────────────────────────────────────

  const projectById =
    useMemo(
      () =>
        new Map(
          projects.map(
            (project) => [
              project.id,
              project,
            ]
          )
        ),
      [projects]
    );


  const getProject =
    (projectId) =>
      calc?.projById?.get(
        projectId
      ) ||
      projectById.get(
        projectId
      ) ||
      {
        id: projectId,
        name: projectId,
      };


  // ─────────────────────────────────────
  // BU filter
  // ─────────────────────────────────────

  const inUserBu =
    (submission) => {
      const project =
        getProject(
          submission.projectId
        );

      if (
        !user?.buId
      ) {
        return true;
      }

      return (
        project?.buId ===
          user.buId ||
        project?.businessUnitId ===
          user.buId ||
        !project
      );
    };


  const mine =
    submissions.filter(
      inUserBu
    );


  // ─────────────────────────────────────
  // Search/filter
  // ─────────────────────────────────────

  const matches =
    (submission) => {
      const project =
        getProject(
          submission.projectId
        );


      const siteName =
        String(
          project?.name || ''
        ).toLowerCase();


      const query =
        q.trim().toLowerCase();


      return (
        (
          !principleFilter ||
          submission.principle ===
            principleFilter
        ) &&
        (
          !query ||
          siteName.includes(query) ||
          String(
            submission.code || ''
          )
            .toLowerCase()
            .includes(query) ||
          String(
            submission.principle ||
            ''
          )
            .toLowerCase()
            .includes(query)
        )
      );
    };


  // ─────────────────────────────────────
  // Lists
  // ─────────────────────────────────────

  const queue =
    mine
      .filter((submission) => {
        if (user?.role === 'admin') {
          return (
            submission.status === 'subsidiary_verified' ||
            submission.status === 'sub_verified'
          );
        }
        if (user?.role === 'subsidiary') {
          return submission.status === 'bu_verified';
        }
        return submission.status === 'submitted';
      })
      .filter(matches);

  const pendingBu =
    mine
      .filter(
        (submission) =>
          submission.status === 'submitted'
      )
      .filter(matches);

  const pendingSub =
    mine
      .filter(
        (submission) =>
          submission.status === 'bu_verified'
      )
      .filter(matches);

  const verified =
    mine
      .filter(
        (submission) =>
          submission.status === 'bu_verified' ||
          submission.status === 'subsidiary_verified' ||
          submission.status === 'sub_verified'
      )
      .filter(matches);

  const subsidiaryVerified =
    mine
      .filter(
        (submission) =>
          submission.status === 'subsidiary_verified' ||
          submission.status === 'sub_verified'
      )
      .filter(matches);

  const away =
    mine
      .filter(
        (submission) =>
          [
            'correction_required',
            'rejected',
          ].includes(
            submission.status
          )
      )
      .filter(matches);

  const done =
    mine
      .filter(
        (submission) =>
          [
            'approved',
            'locked',
          ].includes(
            submission.status
          )
      )
      .filter(matches)
      .sort(
        (a, b) =>
          String(
            b.period || ''
          ).localeCompare(
            String(
              a.period || ''
            )
          )
      );


  const openSubmission =
    open
      ? mine.find(
          (submission) =>
            submission.id ===
            open
        )
      : null;


  // ─────────────────────────────────────
  // Open submission and fetch full detail
  // ─────────────────────────────────────

  const openDetails =
    async (submission) => {
      try {
        setLoadingDetail(
          true
        );


        const response =
          await apiClient.get(
            `/submissions/${submission.id}`
          );


        const detailed =
          normalizeSubmission(
            response.data
          );


        setSubmissions(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                detailed.id
                  ? {
                      ...item,
                      ...detailed,
                    }
                  : item
            )
        );


        setOpen(
          submission.id
        );
      } catch (error) {
        toast(
          error?.message ||
            'Failed to load submission details.',
          'error'
        );
      } finally {
        setLoadingDetail(
          false
        );
      }
    };


  // ─────────────────────────────────────
  // Table row
  // ─────────────────────────────────────

  const Row = ({
    submission,
    cta,
  }) => {
    const result =
      submission.values &&
      Object.keys(
        submission.values
      ).length > 0
        ? (() => {
            try {
              return validateValues({
                principle:
                  submission.principle,

                values:
                  submission.values,

                project:
                  getProject(
                    submission.projectId
                  ),

                period:
                  submission.period,

                calc,
              });
            } catch {
              return {
                errors: [],
                warnings: [],
              };
            }
          })()
        : null;


    const evidenceWarnings =
      result
        ? result.warnings.filter(
            (warning) =>
              warning.kind ===
              'evidence'
          ).length
        : 0;


    const spikeWarnings =
      result
        ? result.warnings.filter(
            (warning) =>
              warning.kind ===
              'spike'
          ).length
        : 0;


    return (
      <tr className="hover:bg-slate-50/60">

        <td className="px-4 py-3">

          <div className="font-bold text-blue-600 text-xs">
            {submission.code}
          </div>

          <div className="font-bold text-slate-900">
            {
              getProject(
                submission.projectId
              ).name
            }
          </div>

          <div className="text-xs text-slate-500">
            {submission.enteredBy ===
            'manager'
              ? 'Entered by BU manager'
              : 'Site operator'}
            {' · '}
            {dt(
              submission.submittedAt
            )}
          </div>

        </td>


        <td className="px-4 py-3">

          <Badge>
            {
              submission.principle
            }
          </Badge>{' '}

          <span className="font-medium">
            {
              principleOf(
                submission.principle
              ).label
            }
          </span>

          <div className="text-xs text-slate-500 mt-0.5">
            {periodLabel(
              submission.period
            )}
          </div>

        </td>


        <td className="px-4 py-3 space-y-1">

          {!result ? (
            <Badge>
              Open to inspect
            </Badge>
          ) : (
            <>
              {result.errors
                .length === 0 &&
              evidenceWarnings ===
                0 &&
              spikeWarnings ===
                0 ? (
                <Badge tone="emerald">
                  No flags
                </Badge>
              ) : (
                <>
                  {result.errors
                    .length >
                    0 && (
                    <Badge tone="rose">
                      <AlertCircle
                        size={11}
                      />
                      {
                        result
                          .errors
                          .length
                      }{' '}
                      error
                    </Badge>
                  )}

                  {evidenceWarnings >
                    0 && (
                    <Badge tone="rose">
                      <FileWarning
                        size={11}
                      />
                      {
                        evidenceWarnings
                      }{' '}
                      missing evidence
                    </Badge>
                  )}

                  {spikeWarnings >
                    0 && (
                    <Badge tone="amber">
                      <AlertTriangle
                        size={11}
                      />
                      {
                        spikeWarnings
                      }{' '}
                      spike
                    </Badge>
                  )}
                </>
              )}
            </>
          )}

        </td>


        <td className="px-4 py-3">

          <StatusBadge
            status={
              submission.status
            }
          />

          {submission.enteredBy ===
            'manager' && (
            <Badge
              tone="violet"
              className="ml-1"
            >
              Manager-entered
            </Badge>
          )}

        </td>


        <td className="px-4 py-3 text-right">

          <Btn
            tone={
              cta ===
              'Review'
                ? 'dark'
                : 'ghost'
            }
            className="!py-1.5 !text-xs"
            disabled={
              loadingDetail
            }
            onClick={() =>
              openDetails(
                submission
              )
            }
          >
            {loadingDetail
              ? 'Loading…'
              : cta}
          </Btn>

        </td>

      </tr>
    );
  };


  const head = [
    'Packet / site',
    'BRSR principle',
    'System checks',
    'Status',
    '',
  ];


  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────

  return (
    <div className="space-y-6">

      <PageHeader
        title="Review & Approvals"
        subtitle="Review live submissions from the Flask backend. Approve, request correction, or reject — approved packets move into consolidation automatically."
        actions={
          <Btn
            tone="ghost"
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </Btn>
        }
      />


      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'queue',
            label:
              user?.role === 'admin'
                ? 'Awaiting Admin Approval'
                : user?.role === 'subsidiary'
                ? 'Awaiting Subsidiary Review'
                : 'Pending BU Verification',
            icon:
              ClipboardList,
            count:
              queue.length,
          },
          ...(user?.role === 'admin'
            ? [
                {
                  id: 'pending_sub',
                  label: 'With Subsidiary',
                  icon: Layers,
                  count: pendingSub.length,
                },
                {
                  id: 'pending_bu',
                  label: 'With BU Manager',
                  icon: RotateCcw,
                  count: pendingBu.length,
                },
              ]
            : user?.role === 'subsidiary'
            ? [
                {
                  id: 'verified',
                  label: 'Forwarded to Admin',
                  icon: Check,
                  count: subsidiaryVerified.length,
                },
                {
                  id: 'pending_bu',
                  label: 'With BU Manager',
                  icon: RotateCcw,
                  count: pendingBu.length,
                },
              ]
            : [
                {
                  id: 'verified',
                  label: 'Verified (Sent to Admin)',
                  icon: Check,
                  count: verified.length,
                },
              ]),
          {
            id: 'away',
            label:
              'With site',
            icon:
              RotateCcw,
            count:
              away.length,
          },
          {
            id: 'done',
            label:
              'Final Approved',
            icon:
              Check,
            count:
              done.length,
          },
          {
            id: 'audit',
            label:
              'Review history',
            icon:
              History,
          },
        ]}
      />


      {tab !==
        'audit' && (
        <div className="flex flex-wrap gap-2 -mt-2">

          <div className="relative">

            <Search
              size={15}
              className="absolute left-3 top-3 text-slate-400"
            />

            <input
              className={`${inputCls} !pl-9 !w-64`}
              placeholder="Search site or packet…"
              value={q}
              onChange={(e) =>
                setQ(
                  e.target.value
                )
              }
            />

          </div>


          <div className="relative">

            <Filter
              size={15}
              className="absolute left-3 top-3 text-slate-400"
            />

            <select
              className={`${inputCls} !pl-9 !w-52`}
              value={
                principleFilter
              }
              onChange={(e) =>
                setPrincipleFilter(
                  e.target.value
                )
              }
            >

              <option value="">
                All principles
              </option>

              {PRINCIPLES.map(
                (principle) => (
                  <option
                    key={
                      principle.id
                    }
                    value={
                      principle.id
                    }
                  >
                    {principle.id}{' '}
                    ·{' '}
                    {
                      principle.label
                    }
                  </option>
                )
              )}

            </select>

          </div>

        </div>
      )}


      {loading ? (
        <Card>
          <div className="p-5 text-sm text-slate-500">
            Loading approval data from Flask…
          </div>
        </Card>
      ) : (
        <>
          {tab ===
            'queue' && (
            <Card pad={false}>
              {queue.length ===
              0 ? (
                <Empty
                  title="Queue is clear"
                  text={
                    user?.role === 'admin'
                      ? 'There are no submissions currently awaiting final Admin sign-off from subsidiaries.'
                      : user?.role === 'subsidiary'
                      ? 'There are no submissions currently awaiting Subsidiary verification from BU Managers.'
                      : 'There are no pending submissions in your accessible business-unit scope.'
                  }
                />
              ) : (
                <Table
                  head={head}
                >
                  {queue.map(
                    (
                      submission
                    ) => (
                      <Row
                        key={
                          submission.id
                        }
                        submission={
                          submission
                        }
                        cta="Review"
                      />
                    )
                  )}
                </Table>
              )}
            </Card>
          )}

          {(tab === 'verified' || tab === 'pending_bu' || tab === 'pending_sub') && (
            <Card pad={false}>
              {(tab === 'verified'
                ? (user?.role === 'subsidiary' ? subsidiaryVerified : verified)
                : tab === 'pending_sub'
                ? pendingSub
                : pendingBu
              ).length === 0 ? (
                <Empty
                  title={
                    tab === 'verified'
                      ? (user?.role === 'subsidiary' ? 'No packets forwarded to Admin yet' : 'No packets verified yet')
                      : tab === 'pending_sub'
                      ? 'No packets currently with Subsidiary'
                      : 'No packets currently with BU Manager'
                  }
                />
              ) : (
                <Table head={head}>
                  {(tab === 'verified'
                    ? (user?.role === 'subsidiary' ? subsidiaryVerified : verified)
                    : tab === 'pending_sub'
                    ? pendingSub
                    : pendingBu
                  ).map((submission) => (
                    <Row
                      key={submission.id}
                      submission={submission}
                      cta={
                        (user?.role === 'admin' && tab === 'pending_sub')
                          ? 'Review'
                          : 'Details'
                      }
                    />
                  ))}
                </Table>
              )}
            </Card>
          )}


          {tab ===
            'away' && (
            <Card pad={false}>
              {away.length ===
              0 ? (
                <Empty
                  title="Nothing outstanding with sites"
                />
              ) : (
                <Table
                  head={head}
                >
                  {away.map(
                    (
                      submission
                    ) => (
                      <Row
                        key={
                          submission.id
                        }
                        submission={
                          submission
                        }
                        cta="Details"
                      />
                    )
                  )}
                </Table>
              )}
            </Card>
          )}


          {tab ===
            'done' && (
            <Card pad={false}>
              {done.length ===
              0 ? (
                <Empty
                  title="No approved packets yet"
                />
              ) : (
                <Table
                  head={head}
                >
                  {done.map(
                    (
                      submission
                    ) => (
                      <Row
                        key={
                          submission.id
                        }
                        submission={
                          submission
                        }
                        cta="View"
                      />
                    )
                  )}
                </Table>
              )}
            </Card>
          )}


          {tab ===
            'audit' && (
            <ReviewHistory
              submissions={
                mine
              }
              onOpen={
                openDetails
              }
            />
          )}
        </>
      )}


      {/* Review detail */}
      {openSubmission && (() => {
        const canReview =
          tab === 'queue' ||
          (user?.role === 'admin' && ['subsidiary_verified', 'sub_verified', 'bu_verified'].includes(openSubmission.status)) ||
          (user?.role === 'subsidiary' && openSubmission.status === 'bu_verified') ||
          (user?.role === 'manager' && openSubmission.status === 'submitted') ||
          openSubmission.status === 'submitted';

        return canReview ? (
          <ReviewModal
            key={
              openSubmission.id
            }
            submission={
              openSubmission
            }
            backendProjects={
              projects
            }
            onClose={() =>
              setOpen(null)
            }
            onCompleted={
              loadData
            }
          />
        ) : (
          <Modal
            open
            onClose={() =>
              setOpen(null)
            }
            title={`${openSubmission.code} · ${
              getProject(
                openSubmission.projectId
              ).name
            }`}
            subtitle={`${openSubmission.principle} · ${periodLabel(
              openSubmission.period
            )}`}
            footer={
              <Btn
                tone="dark"
                onClick={() =>
                  setOpen(null)
                }
              >
                Close
              </Btn>
            }
          >

            <div className="mb-4">
              <StatusBadge
                status={
                  openSubmission.status
                }
              />
            </div>


            {openSubmission.reviewer?.comment && (
              <p className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                <b>
                  {
                    openSubmission
                      .reviewer
                      .name
                  }
                  :
                </b>{' '}
                {
                  openSubmission
                    .reviewer
                    .comment
                }
              </p>
            )}


            {openSubmission.history
              .length ===
            0 ? (
              <p className="text-sm text-slate-500">
                No review actions have been recorded yet.
              </p>
            ) : (
              <ol className="space-y-3">

                {openSubmission.history.map(
                  (
                    item,
                    index
                  ) => (
                    <li
                      key={
                        index
                      }
                      className="text-xs text-slate-600 border-l-2 border-slate-200 pl-3"
                    >

                      <b className="text-slate-800">
                        {
                          item.action
                        }
                      </b>

                      {' · '}

                      {
                        item.by
                      }

                      {' · '}

                      {dt(
                        item.at
                      )}

                      {item.note && (
                        <span className="block mt-1 text-slate-500">
                          “
                          {
                            item.note
                          }
                          ”
                        </span>
                      )}

                    </li>
                  )
                )}

              </ol>
            )}

          </Modal>
        );
      })()}

    </div>
  );
}


// ─────────────────────────────────────────────
// Review history
// ─────────────────────────────────────────────

function ReviewHistory({
  submissions,
  onOpen,
}) {
  const history =
    submissions
      .flatMap(
        (submission) =>
          (
            submission.history ||
            []
          ).map(
            (item) => ({
              ...item,
              submissionId:
                submission.id,
              submissionCode:
                submission.code,
              projectId:
                submission.projectId,
              principle:
                submission.principle,
            })
          )
      )
      .sort(
        (a, b) =>
          String(
            b.at || ''
          ).localeCompare(
            String(
              a.at || ''
            )
          )
      );


  if (
    history.length ===
    0
  ) {
    return (
      <Card pad={false}>
        <Empty
          title="No review actions recorded"
          text="Review actions will appear here after the manager approves, rejects, or requests correction on a submission."
        />
      </Card>
    );
  }


  return (
    <Card pad={false}>

      <div className="p-4 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-800 flex items-center gap-2 rounded-t-xl">
        <AlertCircle
          size={16}
          className="text-amber-500"
        />
        Submission review history
      </div>


      <Table
        head={[
          'Timestamp',
          'Submission',
          'Principle',
          'Reviewer',
          'Action',
          'Comment',
        ]}
      >

        {history.map(
          (item, index) => (
            <tr
              key={`${item.submissionId}-${index}`}
              className="hover:bg-slate-50 cursor-pointer"
              onClick={() =>
                onOpen({
                  id:
                    item.submissionId,
                })
              }
            >

              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                {dt(
                  item.at
                )}
              </td>


              <td className="px-4 py-3 font-bold text-blue-600">
                {
                  item.submissionCode
                }
              </td>


              <td className="px-4 py-3">
                <Badge>
                  {
                    item.principle
                  }
                </Badge>
              </td>


              <td className="px-4 py-3 font-semibold text-slate-800">
                {item.by}
              </td>


              <td className="px-4 py-3">

                <Badge
                  tone={
                    /APPROVE|ASSURED/.test(
                      item.action
                    )
                      ? 'emerald'
                      : /REJECT|CORRECTION|EXCEPTION/.test(
                          item.action
                        )
                      ? 'rose'
                      : 'amber'
                  }
                >
                  {
                    item.action
                  }
                </Badge>

              </td>


              <td className="px-4 py-3 text-xs text-slate-600 max-w-sm">
                {
                  item.note ||
                  '—'
                }
              </td>

            </tr>
          )
        )}

      </Table>

    </Card>
  );
}
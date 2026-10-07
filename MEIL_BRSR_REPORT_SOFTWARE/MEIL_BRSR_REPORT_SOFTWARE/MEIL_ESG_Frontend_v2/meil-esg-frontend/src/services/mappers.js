


// Frontend role IDs to backend role codes

export const ROLE_MAP = {

  admin: 'GROUP_ADMIN',

  manager: 'BU_MANAGER',

  operator: 'SITE_OPERATOR',

  vendor: 'VENDOR_USER',

  auditor: 'ASSESSOR',

};



// Backend role codes to frontend role IDs

export const ROLE_REVERSE_MAP = {

  GROUP_ADMIN: 'admin',

  ESG_MANAGER: 'admin',

  EXECUTIVE_VIEWER: 'admin',

  BU_MANAGER: 'manager',

  SITE_OPERATOR: 'operator',

  VENDOR_USER: 'vendor',

  ASSESSOR: 'auditor',

};



// Submission status mapping

export const SUBMISSION_STATUS_MAP = {

  DRAFT: 'draft',

  SUBMITTED: 'submitted',

  UNDER_REVIEW: 'under_review',

  CORRECTION_REQUIRED: 'correction_required',

  REJECTED: 'rejected',

  APPROVED: 'approved',

  LOCKED: 'locked',

};



export const SUBMISSION_STATUS_REVERSE_MAP = Object.fromEntries(

  Object.entries(SUBMISSION_STATUS_MAP).map(([k, v]) => [v, k])

);



// Assurance status mapping

export const ASSURANCE_STATUS_MAP = {

  not_started: 'NOT_STARTED',

  in_progress: 'IN_PROGRESS',

  complete: 'COMPLETE',

  opinion_issued: 'OPINION_ISSUED',

};



export const ASSURANCE_STATUS_REVERSE_MAP = Object.fromEntries(

  Object.entries(ASSURANCE_STATUS_MAP).map(([k, v]) => [v, k])

);



/**

 * Map backend user to frontend user object

 */

export function mapUser(backendUser = {}) {
  const firstName = backendUser.firstName ?? backendUser.first_name ?? '';
  const lastName = backendUser.lastName ?? backendUser.last_name ?? '';

  const fullName =
    backendUser.name ||
    `${firstName} ${lastName}`.trim() ||
    backendUser.email;

  const backendRoles = Array.isArray(backendUser.roles)
    ? backendUser.roles
    : [];

  const scopes = Array.isArray(backendUser.scopes)
    ? backendUser.scopes
    : [];

  const groupScope = scopes.find((s) => s.type === 'GROUP');
  const buScope = scopes.find((s) => s.type === 'BUSINESS_UNIT');
  const projectScope = scopes.find((s) => s.type === 'PROJECT');
  const vendorScope = scopes.find((s) => s.type === 'VENDOR');

  return {
    id: backendUser.id,
    email: backendUser.email,
    name: fullName,
    title: backendUser.title ?? '',

    role: ROLE_REVERSE_MAP[backendRoles[0]] || 'operator',

    roles: backendRoles.map(
      (r) => ROLE_REVERSE_MAP[r] || r
    ),

    status: String(
      backendUser.status ?? 'ACTIVE'
    ).toLowerCase(),

    organizationId: groupScope?.id || null,
    buId: buScope?.id || null,
    projectId: projectScope?.id || null,
    vendorId: vendorScope?.id || null,

    scopes,

    profile: {
      firstName,
      lastName,
      lastLoginAt:
        backendUser.lastLoginAt ??
        backendUser.last_login_at ??
        null,
    },
  };
}



/**

 * Map backend organization tree to frontend org structure

 */

export function mapOrgTree(
  backendTree
) {
  const org =
    backendTree?.group
      ? {
          id:
            backendTree.group.id,

          code:
            backendTree.group.code,

          name:
            backendTree.group.name,

          type:
            backendTree.group.type,

          status:
            backendTree.group.status,
        }
      : null;


  const subsidiaries =
    (
      backendTree?.subsidiaries ||
      []
    ).map(
      (sub) => ({
        id:
          sub.id,

        code:
          sub.code,

        name:
          sub.name,

        type:
          sub.type,

        status:
          sub.status,

        parentId:
          sub.parentId ??
          sub.parent_id ??
          null,

        relationshipType:
          sub.relationshipType ||
          null,

        ownershipPercentage:
          sub.ownershipPercentage ??
          null,

        participatesInBrInitiatives:
          sub.participatesInBrInitiatives !==
          false,

        businessUnits:
          (
            sub.businessUnits ||
            []
          ).map(
            (bu) => ({
              id:
                bu.id,

              code:
                bu.code,

              name:
                bu.name,

              organizationId:
                bu.organizationId,

              status:
                bu.status,

              projects:
                (
                  bu.projects ||
                  []
                ).map(
                  (p) => ({
                    id:
                      p.id,

                    code:
                      p.projectCode,

                    name:
                      p.name,

                    buId:
                      p.businessUnitId,

                    state:
                      p.state,

                    country:
                      p.country ||
                      'India',

                    lat:
                      p.latitude,

                    lng:
                      p.longitude,

                    turnoverCr:
                      Number(
                        p.turnoverCr ||
                        0
                      ),

                    status:
                      p.status,

                    live:
                      Boolean(
                        p.isLive
                      ),
                  })
                ),
            })
          ),
      })
    );


  return {
    org,
    subsidiaries,
  };
}


/**

 * Map backend submission to frontend submission

 */

export function mapSubmission(
  backendSubmission = {}
) {
  const reviews =
    backendSubmission.history ||
    backendSubmission.reviews ||
    [];

  return {
    id: backendSubmission.id,

    code: backendSubmission.code,

    projectId:
      backendSubmission.projectId ??
      backendSubmission.project_id,

    period:
      backendSubmission.reportingPeriodId ??
      backendSubmission.reporting_period_id,

    principle:
      backendSubmission.principleCode ??
      backendSubmission.principle_id,

    values: mapEsgValues(
      backendSubmission.values ??
      backendSubmission.esg_values ??
      {}
    ),

    status:
      SUBMISSION_STATUS_MAP[
      backendSubmission.status
      ] ||
      String(
        backendSubmission.status || 'DRAFT'
      ).toLowerCase(),

    submittedAt:
      backendSubmission.submittedAt ??
      backendSubmission.submitted_at ??
      null,

    enteredBy:
      ROLE_REVERSE_MAP[
      backendSubmission.enteredByRole
      ] || 'operator',

    reviewer: backendSubmission.reviewComment
      ? {
        name:
          reviews.at(-1)?.reviewer ||
          'Reviewer',

        comment:
          backendSubmission.reviewComment,

        checklist:
          reviews.at(-1)?.checklist || {},

        at:
          backendSubmission.reviewedAt ??
          backendSubmission.reviewed_at ??
          null,
      }
      : null,

    assurance: {
      NOT_STARTED: 'not_started',
      IN_REVIEW: 'in_review',
      ASSESSED: 'assessed',
      ASSURED: 'assured',
      EXCEPTION: 'exception',
    }[backendSubmission.assessmentStatus]
      || 'not_started',

    history: reviews.map((r) => ({
      at: r.at,
      by: r.reviewer || 'System',
      action: r.action || 'UPDATE',
      note: r.comment || '',
    })),
  };
}


/**

 * Map backend ESG values to frontend values object

 */

export function mapEsgValues(
  backendValues
) {
  const values = {};

  Object.entries(
    backendValues || {}
  ).forEach(
    ([code, value]) => {
      values[code] = {
        id:
          value?.id ??
          null,

        indicatorCode:
          code,

        v:
          value?.value ??
          '',

        ev:
          Array.isArray(
            value?.evidence
          )
            ? value.evidence[0]
            : '',

        evidence:
          value?.evidence || [],
      };
    }
  );

  return values;
}


/**

 * Map frontend submission values to backend format

 */

export function mapSubmissionValuesForBackend(
  frontendValues = {}
) {
  return Object.fromEntries(
    Object.entries(frontendValues).map(
      ([indicatorCode, data]) => [
        indicatorCode,
        {
          v:
            data?.v ??
            data?.numericValue ??
            data?.textValue ??
            '',

          ev:
            data?.ev ??
            data?.evidenceId ??
            '',
        },
      ]
    )
  );
}



/**

 * Map backend document/evidence to frontend format

 */

export function mapDocument(backendDoc) {

  return {

    id: backendDoc.id,

    code: backendDoc.code,

    name: backendDoc.file_name || backendDoc.name,

    url: backendDoc.file_path || backendDoc.url,

    mimeType: backendDoc.mime_type,

    size: backendDoc.file_size,

    uploadedAt: backendDoc.created_at,

    uploadedBy: backendDoc.uploaded_by_user

      ? {

        name: `${backendDoc.uploaded_by_user.first_name} ${backendDoc.uploaded_by_user.last_name}`,

        role: ROLE_REVERSE_MAP[backendDoc.uploaded_by_user.roles?.[0]],

      }

      : null,

  };

}



/**

 * Map backend approval/review to frontend format

 */

export function mapApproval(backendReview) {

  return {

    id: backendReview.id,

    submissionId: backendReview.submission_id,

    projectId: backendReview.submission?.project_id,

    principle: backendReview.submission?.principle_id,

    period: backendReview.submission?.reporting_period_id,

    decision: backendReview.action_type?.toLowerCase() || 'pending',

    comment: backendReview.notes || '',

    checklist: backendReview.checklist_data || {},

    reviewer: {

      name: `${backendReview.user?.first_name || ''} ${backendReview.user?.last_name || ''}`.trim(),

      role: ROLE_REVERSE_MAP[backendReview.user?.roles?.[0]] || 'manager',

    },

    at: backendReview.created_at,

    status: backendReview.submission?.status,

  };

}



/**

 * Map backend vendor request to frontend format

 */

export function mapVendorRequest(backendRequest) {

  return {

    id: backendRequest.id,

    vendorId: backendRequest.vendor_id,

    vendorCode: backendRequest.vendor?.code || 'V-' + backendRequest.vendor_id?.slice(-3),

    period: backendRequest.reporting_period_id,

    due: backendRequest.due_date,

    status: backendRequest.status?.toLowerCase() || 'requested',

    values: mapEsgValues(backendRequest.esg_values || []),

    evidence: (backendRequest.documents || []).map(mapDocument),

    sentAt: backendRequest.created_at,

    comment: backendRequest.request_message || '',

    history: (backendRequest.vendor_request_history || []).map((h) => ({

      at: h.created_at,

      by: h.user?.first_name || 'System',

      action: h.action?.toUpperCase() || 'UPDATE',

      note: h.notes || '',

    })),

  };

}



/**

 * Map backend risk to frontend format

 */

export function mapRisk(backendRisk) {

  return {

    id: backendRisk.id,

    code: backendRisk.code,

    name: backendRisk.name,

    category: backendRisk.risk_category?.toLowerCase() || 'operational',

    type: backendRisk.risk_type?.toLowerCase() || 'risk',

    description: backendRisk.description,

    probability: backendRisk.probability_level?.toLowerCase() || 'medium',

    impact: backendRisk.impact_level?.toLowerCase() || 'medium',

    financialExposure: backendRisk.financial_exposure_amount,

    mitigation: backendRisk.mitigation_strategy,

    owner: backendRisk.owner_user

      ? {

        name: `${backendRisk.owner_user.first_name} ${backendRisk.owner_user.last_name}`,

        email: backendRisk.owner_user.email,

      }

      : null,

    linkedIndicators: backendRisk.linked_indicators || [],

    linkedKpis: backendRisk.linked_kpis || [],

    status: backendRisk.status?.toLowerCase() || 'open',

  };

}



/**

 * Map backend analytics/consolidation to frontend format

 */

export function mapAnalytics(backendAnalytics) {

  return {

    summary: {

      totalSubmissions: backendAnalytics.total_submissions,

      approvedSubmissions: backendAnalytics.approved_submissions,

      submissionCoverage: backendAnalytics.submission_coverage_percent,

      principlesCovered: backendAnalytics.principles_covered,

    },

    data: (backendAnalytics.data || []).map((row) => ({

      principle: row.principle_code,

      project: row.project_id,

      period: row.reporting_period_id,

      indicators: row.indicators || [],

      values: row.values || {},

      status: row.status?.toLowerCase() || 'draft',

    })),

    trends: (backendAnalytics.trends || []).map((trend) => ({

      period: trend.period,

      value: trend.value,

      indicator: trend.indicator_code,

    })),

  };

}



/**

 * Map backend notification to frontend format

 */

export function mapNotification(
  backendNotif = {}
) {
  return {
    id:
      backendNotif.id,

    at:
      backendNotif.at ||
      backendNotif.created_at ||
      null,

    read:
      Boolean(
        backendNotif.read
      ),

    text:
      backendNotif.message ||
      '',

    title:
      backendNotif.title ||
      'Notification',

    link:
      backendNotif.link ||
      null,

    type:
      String(
        backendNotif.type ||
        'INFO'
      ).toLowerCase(),

    role:
      null,
  };
}



export default {

  ROLE_MAP,

  ROLE_REVERSE_MAP,

  SUBMISSION_STATUS_MAP,

  SUBMISSION_STATUS_REVERSE_MAP,

  ASSURANCE_STATUS_MAP,

  ASSURANCE_STATUS_REVERSE_MAP,

  mapUser,

  mapOrgTree,

  mapSubmission,

  mapEsgValues,

  mapSubmissionValuesForBackend,

  mapDocument,

  mapApproval,

  mapVendorRequest,

  mapRisk,

  mapAnalytics,

  mapNotification,

};
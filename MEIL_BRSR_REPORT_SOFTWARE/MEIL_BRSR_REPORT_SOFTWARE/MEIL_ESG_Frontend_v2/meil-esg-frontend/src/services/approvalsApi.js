import apiClient from './apiClient';

const STATUS_MAP = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
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
    key.toLowerCase()
  );
}


function normalizeValues(
  values
) {
  if (!values || typeof values !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values).map(
      ([code, cell]) => [
        code,
        {
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
            cell?.evidence || [],
        },
      ]
    )
  );
}


function mapSubmission(
  raw = {}
) {
  return {
    id:
      raw.id,

    code:
      raw.code ||
      raw.id,

    projectId:
      raw.projectId,

    period:
      raw.reportingPeriodId,

    principle:
      raw.principleCode,

    status:
      normalizeStatus(
        raw.status
      ),

    values:
      normalizeValues(
        raw.values
      ),

    submittedAt:
      raw.submittedAt,

    enteredBy:
      String(
        raw.enteredByRole ||
          ''
      ).toUpperCase() ===
      'BU_MANAGER'
        ? 'manager'
        : 'operator',

    reviewer:
      raw.reviewComment
        ? {
            name: 'Reviewer',
            comment:
              raw.reviewComment,
            at:
              raw.reviewedAt,
          }
        : null,

    assurance:
      raw.assessmentStatus ||
      'NOT_STARTED',

    history:
      (
        raw.reviews ||
        raw.history ||
        []
      ).map(
        (review) => ({
          at:
            review.at,

          by:
            review.reviewer ||
            'System',

          action:
            review.action ||
            'UPDATE',

          note:
            review.comment ||
            '',
        })
      ),
  };
}


function getError(
  error,
  fallback
) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}


const approvalsApi = {

  async listApprovals(
    filters = {}
  ) {
    try {
      const response =
        await apiClient.get(
          '/approvals',
          {
            params: {
              ...(filters.status
                ? {
                    status:
                      filters.status,
                  }
                : {}),
              ...(filters.businessUnitId
                ? {
                    businessUnitId:
                      filters.businessUnitId,
                  }
                : {}),
            },
          }
        );

      return {
        items: (
          response.data?.items ||
          []
        ).map(
          mapSubmission
        ),

        meta:
          response.data?.meta ||
          {},
      };
    } catch (error) {
      throw new Error(
        getError(
          error,
          'Failed to fetch approvals.'
        )
      );
    }
  },


  async getApproval(
    submissionId
  ) {
    try {
      const response =
        await apiClient.get(
          `/approvals/${submissionId}`
        );

      return mapSubmission(
        response.data
      );
    } catch (error) {
      throw new Error(
        getError(
          error,
          'Failed to fetch approval.'
        )
      );
    }
  },


  async approveSubmission(
    submissionId,
    comment = '',
    checklist = {}
  ) {
    try {
      const response =
        await apiClient.post(
          `/approvals/${submissionId}/approve`,
          {
            comment,
            checklist,
          }
        );

      return mapSubmission(
        response.data
      );
    } catch (error) {
      throw new Error(
        getError(
          error,
          'Failed to approve submission.'
        )
      );
    }
  },


  async requestCorrection(
    submissionId,
    comment = '',
    checklist = {}
  ) {
    try {
      const response =
        await apiClient.post(
          `/approvals/${submissionId}/correction`,
          {
            comment,
            checklist,
          }
        );

      return mapSubmission(
        response.data
      );
    } catch (error) {
      throw new Error(
        getError(
          error,
          'Failed to request correction.'
        )
      );
    }
  },


  async rejectSubmission(
    submissionId,
    comment = ''
  ) {
    try {
      const response =
        await apiClient.post(
          `/approvals/${submissionId}/reject`,
          {
            comment,
          }
        );

      return mapSubmission(
        response.data
      );
    } catch (error) {
      throw new Error(
        getError(
          error,
          'Failed to reject submission.'
        )
      );
    }
  },


  async getPendingCount() {
    try {
      const response =
        await apiClient.get(
          '/approvals/pending/count'
        );

      return (
        response.data?.count ||
        0
      );
    } catch {
      return 0;
    }
  },
};


export {
  approvalsApi,
};

export default approvalsApi;
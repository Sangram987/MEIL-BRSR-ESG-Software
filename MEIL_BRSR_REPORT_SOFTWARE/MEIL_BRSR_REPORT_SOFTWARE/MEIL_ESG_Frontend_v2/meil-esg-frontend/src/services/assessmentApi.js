import apiClient from './apiClient';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

export const assessmentApi = {
  async getWorkbench(filters = {}) {
    try {
      const params = {};

      if (filters.reportingPeriodId) {
        params.reportingPeriodId =
          filters.reportingPeriodId;
      }

      if (filters.status) {
        params.status =
          filters.status.toUpperCase();
      }

      const response =
        await apiClient.get(
          '/assessments/workbench',
          { params }
        );

      return Array.isArray(response.data)
        ? response.data
        : [];
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load assessment workbench.'
        )
      );
    }
  },

  async setStatus(
    submissionId,
    status,
    note = ''
  ) {
    try {
      const response =
        await apiClient.post(
          `/assessments/${submissionId}/status`,
          {
            status:
              status.toUpperCase(),
            note,
          }
        );

      return response.data;
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to update assessment status.'
        )
      );
    }
  },

  async getSubmissionAssessment(
    submissionId
  ) {
    try {
      const rows =
        await this.getWorkbench();

      return (
        rows.find(
          (row) => row.id === submissionId
        ) || null
      );
    } catch {
      return null;
    }
  },

  async getEngagements(
    filters = {}
  ) {
    try {
      const response =
        await apiClient.get(
          '/assessments/engagements',
          {
            params: {
              reportingPeriodId:
                filters.reportingPeriodId,
              organizationId:
                filters.organizationId,
            },
          }
        );

      return Array.isArray(response.data)
        ? response.data
        : [];
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to load assessment engagements.'
        )
      );
    }
  },

  async getEngagement(
    coreAttributeId
  ) {
    try {
      const rows =
        await this.getEngagements();

      return (
        rows.find(
          (row) =>
            row.coreAttribute ===
            coreAttributeId
        ) || null
      );
    } catch {
      return null;
    }
  },

  async issueOpinion(
    coreAttributeId,
    data
  ) {
    try {
      const payload = {
        reportingPeriodId:
          data.reportingPeriodId,

        organizationId:
          data.organizationId,

        mode:
          String(
            data.mode || 'ASSURANCE'
          ).toUpperCase(),

        status:
          data.status,

        provider:
          data.provider || '',

        providerType:
          data.providerType || '',

        standard:
          data.standard || '',

        scope:
          data.scope || '',

        methodology:
          data.methodology || '',

        evidenceTested:
          data.evidenceTested || '',

        exceptions:
          data.exceptions || '',

        independenceConfirmed:
          Boolean(
            data.independenceConfirmed
          ),

        note:
          data.note || '',
      };

      const response =
        await apiClient.put(
          `/assessments/engagements/${coreAttributeId}`,
          payload
        );

      return response.data;
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error,
          'Failed to record assessment / assurance opinion.'
        )
      );
    }
  },

  async addSample(
    engagementId,
    submissionId,
    status = 'IN_REVIEW',
    note = ''
  ) {
    const response =
      await apiClient.post(
        `/assessments/${engagementId}/sample`,
        {
          submissionId,
          status,
          note,
        }
      );

    return response.data;
  },

  async addFinding(
    engagementId,
    description,
    severity = 'LOW',
    sampleId = null
  ) {
    const response =
      await apiClient.post(
        `/assessments/${engagementId}/finding`,
        {
          description,
          severity,
          sampleId,
        }
      );

    return response.data;
  },
};

export default assessmentApi;
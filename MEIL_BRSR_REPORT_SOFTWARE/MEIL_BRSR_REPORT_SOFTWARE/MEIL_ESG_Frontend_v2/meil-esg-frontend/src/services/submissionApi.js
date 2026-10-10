import apiClient from './apiClient';
import {
  mapSubmission,
  mapSubmissionValuesForBackend
} from './mappers';

export const submissionApi = {

  async listSubmissions(filters = {}) {
    const response =
      await apiClient.get('/submissions', {
        params: {
          projectId: filters.projectId,
          status: filters.status,
          reportingPeriodId:
            filters.reportingPeriodId,
        },
      });

    return {
      items: (
        response.data.items || []
      ).map(mapSubmission),

      meta:
        response.data.meta || {},
    };
  },

  async getSubmission(submissionId) {
    const response =
      await apiClient.get(
        `/submissions/${submissionId}`
      );

    return mapSubmission(
      response.data
    );
  },

  async saveSubmission(
    projectId,
    reportingPeriodId,
    principleCode,
    values,
    submit = false
  ) {
    const response =
      await apiClient.post(
        '/submissions',
        {
          projectId,
          reportingPeriodId,
          principleCode,

          values:
            mapSubmissionValuesForBackend(
              values
            ),

          submit,
        }
      );

    return mapSubmission(
      response.data
    );
  },

  async getDraftSubmissions(
    projectId,
    reportingPeriodId
  ) {
    const response =
      await apiClient.get('/submissions', {
        params: {
          projectId,
          reportingPeriodId,
          status: 'DRAFT',
        },
      });

    return (
      response.data.items || []
    ).map(mapSubmission);
  },

  async listReportingPeriods() {
    const response = await apiClient.get('/reporting-periods');
    return Array.isArray(response.data) ? response.data : (response.data?.items || []);
  },
};

export default submissionApi;
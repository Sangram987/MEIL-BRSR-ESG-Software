import apiClient from './apiClient';

const errorMessage = (
  error,
  fallback
) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;


export const reportApi = {

  async getReportReadiness({
    reportingPeriodId,
    organizationId,
    scopeType = 'GROUP',
    scopeId = null,
  }) {
    try {
      const response =
        await apiClient.get(
          '/reports/readiness',
          {
            params: {
              reportingPeriodId,
              organizationId,
              scopeType,
              scopeId,
            },
          }
        );

      return response.data;
    } catch (error) {
      throw new Error(
        errorMessage(
          error,
          'Failed to check report readiness.'
        )
      );
    }
  },


  async listReports() {
    try {
      const response =
        await apiClient.get(
          '/reports'
        );

      return Array.isArray(
        response.data
      )
        ? response.data
        : [];
    } catch (error) {
      throw new Error(
        errorMessage(
          error,
          'Failed to load generated reports.'
        )
      );
    }
  },


  async generateReport(
    payload
  ) {
    try {
      const response =
        await apiClient.post(
          '/reports',
          {
            scopeType:
              payload.scopeType,

            scopeId:
              payload.scopeId ||
              null,

            reportingPeriodId:
              payload.reportingPeriodId,

            organizationId:
              payload.organizationId,

            boundaryMode:
              (
                payload.boundaryMode ||
                'CONSOLIDATED'
              ).toUpperCase(),

            includeJv:
              Boolean(
                payload.includeJv
              ),

            package:
              (
                payload.package ||
                'COMPREHENSIVE'
              ).toUpperCase(),

            includeValueChain:
              payload.includeValueChain !==
              false,

            disclosureType:
              (
                payload.disclosureType ||
                'ASSURANCE'
              ).toUpperCase(),

            financialYear:
              payload.financialYear,

            formats:
              payload.formats || [
                'PDF',
                'CSV',
                'JSON',
                'XML',
              ],
          }
        );

      return response.data;
    } catch (error) {
      throw new Error(
        errorMessage(
          error,
          'Failed to generate report.'
        )
      );
    }
  },


  async getReport(reportId) {
    const response =
      await apiClient.get(
        `/reports/${reportId}`
      );

    return response.data;
  },


  async downloadReport(reportId, format = 'PDF') {
    try {
      const response = await apiClient.get(`/reports/${reportId}/download`, {
        params: { format: format.toUpperCase() },
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw new Error(errorMessage(error, 'Failed to download report.'));
    }
  },

  async previewReport(params = {}) {
    try {
      const response = await apiClient.get('/reports/preview', { params });
      return response.data;
    } catch (error) {
      throw new Error(errorMessage(error, 'Failed to fetch report preview.'));
    }
  },

  async downloadPackage(reportId) {
    try {
      const response = await apiClient.get(`/reports/${reportId}/package`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw new Error(errorMessage(error, 'Failed to download audit-ready package.'));
    }
  },
};

export default reportApi;
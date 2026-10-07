import apiClient from './apiClient';

const errorMessage = (
  error,
  fallback
) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;


export const disclosureApi = {

  async getEntityDisclosure(
    organizationId,
    financialYear
  ) {
    try {
      const response =
        await apiClient.get(
          '/disclosures',
          {
            params: {
              organizationId,
              financialYear,
            },
          }
        );

      return response.data;
    } catch (error) {
      throw new Error(
        errorMessage(
          error,
          'Failed to load disclosures.'
        )
      );
    }
  },


  async saveEntityDisclosure(
    payload
  ) {
    try {
      const response =
        await apiClient.put(
          '/disclosures',
          payload
        );

      return response.data;
    } catch (error) {
      throw new Error(
        errorMessage(
          error,
          'Failed to save disclosures.'
        )
      );
    }
  },


  async getDisclosures(
    filters = {}
  ) {
    return this.getEntityDisclosure(
      filters.organizationId,
      filters.financialYear
    );
  },


  async getBrsrCore(
    reportingPeriodId
  ) {
    const response =
      await apiClient.get(
        '/brsr/core',
        {
          params: {
            reportingPeriodId,
          },
        }
      );

    return response.data;
  },


  async getBrsrFrameworks() {
    const response =
      await apiClient.get(
        '/brsr/frameworks'
      );

    return response.data?.items || [];
  },


  async getBrsrPrinciples() {
    const response =
      await apiClient.get(
        '/brsr/principles'
      );

    return response.data?.items || [];
  },


  async getBrsrIndicators(
    principleCode = null
  ) {
    const params = {};

    if (principleCode) {
      params.principleCode =
        principleCode;
    }

    const response =
      await apiClient.get(
        '/brsr/indicators',
        { params }
      );

    return response.data?.items || [];
  },


  async getSdgMapping() {
    const response =
      await apiClient.get(
        '/brsr/sdg-mapping'
      );

    return response.data?.mappings || [];
  },
};


export default disclosureApi;
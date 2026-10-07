import apiClient from './apiClient';
import { mapOrgTree } from './mappers';

export const organizationApi = {

  async getOrgTree() {
    const response =
      await apiClient.get(
        '/organizations/tree'
      );

    return mapOrgTree(
      response.data
    );
  },


  async getProjects(
    businessUnitId = null
  ) {
    const response =
      await apiClient.get(
        '/projects',
        {
          params:
            businessUnitId
              ? {
                  businessUnitId,
                }
              : {},
        }
      );

    return Array.isArray(
      response.data
    )
      ? response.data
      : [];
  },


  async getProject(
    projectId
  ) {
    const response =
      await apiClient.get(
        `/projects/${projectId}`
      );

    return response.data;
  },


  async createOrganization({
    name,
    type = 'SUBSIDIARY',
    parentId = null,
    relationshipType = 'SUBSIDIARY',
    ownershipPercentage = 100,
  }) {
    const response =
      await apiClient.post(
        '/organizations',
        {
          name,
          type,
          parentId,
          relationshipType,
          ownershipPercentage,
        }
      );

    return response.data;
  },


  async updateOrganization(
    organizationId,
    updates
  ) {
    const response =
      await apiClient.patch(
        `/organizations/${organizationId}`,
        updates
      );

    return response.data;
  },


  async createBusinessUnit(
    name,
    organizationId
  ) {
    const response =
      await apiClient.post(
        '/business-units',
        {
          name,
          organizationId,
        }
      );

    return response.data;
  },


  async createProject(
    name,
    businessUnitId,
    data = {}
  ) {
    const response =
      await apiClient.post(
        '/projects',
        {
          name,
          businessUnitId,
          ...data,
        }
      );

    return response.data;
  },


  async updateProject(
    projectId,
    updates
  ) {
    const response =
      await apiClient.patch(
        `/projects/${projectId}`,
        updates
      );

    return response.data;
  },


  async getBusinessUnits(
    organizationId = null
  ) {
    const response =
      await apiClient.get(
        '/business-units',
        {
          params:
            organizationId
              ? {
                  organizationId,
                }
              : {},
        }
      );

    return Array.isArray(
      response.data
    )
      ? response.data
      : [];
  },


  async getReportingPeriods(
    financialYear = null
  ) {
    const response =
      await apiClient.get(
        '/reporting-periods',
        {
          params:
            financialYear
              ? {
                  financialYear,
                }
              : {},
        }
      );

    return Array.isArray(
      response.data
    )
      ? response.data
      : [];
  },
};

export default organizationApi;
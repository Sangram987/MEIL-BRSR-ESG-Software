/**
 * Analytics API service
 * Handles dashboards, consolidations, KPI rollups, and trend data
 */
import apiClient from './apiClient';
import { mapAnalytics } from './mappers';

export const analyticsApi = {
  /**
   * Get analytics summary/dashboard data
   */
  async getAnalyticsSummary(filters = {}) {
    try {
      const params = {};
      if (filters.reportingPeriodId) params.reportingPeriodId = filters.reportingPeriodId;
      if (filters.organizationId) params.organizationId = filters.organizationId;
      if (filters.financialYear) params.financialYear = filters.financialYear;
      
      const response = await apiClient.get('/analytics/summary', { params });
      return mapAnalytics(response.data);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch analytics.';
      throw new Error(message);
    }
  },

  /**
   * Get consolidated/rollup data
   */
  async getConsolidation(filters = {}) {
    try {
      const params = {};
      if (filters.reportingPeriodId) params.reportingPeriodId = filters.reportingPeriodId;
      if (filters.organizationId) params.organizationId = filters.organizationId;
      if (filters.scope) params.scope = filters.scope;
      
      const response = await apiClient.get('/analytics/consolidation', { params });
      return mapAnalytics(response.data);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch consolidation data.';
      throw new Error(message);
    }
  },

  /**
   * Get KPI/indicator trends
   */
  async getTrends(indicatorCode, filters = {}) {
    try {
      const params = { indicatorCode, ...filters };
      const response = await apiClient.get('/analytics/trends', { params });
      return response.data.trends || [];
    } catch (error) {
      return [];
    }
  },

  /**
   * Get project map data (geospatial)
   */
  async getProjectMap(filters = {}) {
    try {
      const params = filters;
      const response = await apiClient.get('/analytics/map', { params });
      return response.data.projects || [];
    } catch (error) {
      return [];
    }
  },

  /**
   * Get submission coverage data
   */
  async getCoverage(reportingPeriodId) {
    try {
      const response = await apiClient.get('/analytics/coverage', {
        params: { reportingPeriodId },
      });
      return response.data;
    } catch (error) {
      return { coverage: 0, total: 0, submitted: 0 };
    }
  },

  /**
   * Get financial year data aggregation
   */
  async getFinancialYearData(financialYear, filters = {}) {
    try {
      const params = { financialYear, ...filters };
      const response = await apiClient.get('/analytics/financial-year', { params });
      return mapAnalytics(response.data);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch financial year data.';
      throw new Error(message);
    }
  },

  /**
   * Get KPI rollup
   */
  async getKpiRollup(kpiCode, filters = {}) {
    try {
      const params = { kpiCode, ...filters };
      const response = await apiClient.get('/analytics/kpi-rollup', { params });
      return response.data;
    } catch (error) {
      return {};
    }
  },
};

export default analyticsApi;

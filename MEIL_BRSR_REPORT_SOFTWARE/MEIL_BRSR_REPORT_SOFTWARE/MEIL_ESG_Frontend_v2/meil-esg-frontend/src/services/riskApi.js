/**
 * Risk Management API service
 * Handles risk matrix, risk creation, and updates
 */
import apiClient from './apiClient';
import { mapRisk } from './mappers';

export const riskApi = {
  /**
   * List risks with optional filters
   */
  async listRisks(filters = {}) {
    try {
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      
      const response = await apiClient.get('/risks', { params });
      return (response.data.items || []).map(mapRisk);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch risks.';
      throw new Error(message);
    }
  },

  /**
   * Get a single risk
   */
  async getRisk(riskId) {
    try {
      const response = await apiClient.get(`/risks/${riskId}`);
      return mapRisk(response.data);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch risk.';
      throw new Error(message);
    }
  },

  /**
   * Create a new risk
   */
  async createRisk(name, category, type, data = {}) {
    try {
      const response = await apiClient.post('/risks', {
        name,
        category,
        type,
        ...data,
      });
      return mapRisk(response.data);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to create risk.';
      throw new Error(message);
    }
  },

  /**
   * Update a risk
   */
  async updateRisk(riskId, updates) {
    try {
      const response = await apiClient.patch(`/risks/${riskId}`, updates);
      return mapRisk(response.data);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to update risk.';
      throw new Error(message);
    }
  },

  /**
   * Delete a risk
   */
  async deleteRisk(riskId) {
    try {
      await apiClient.delete(`/risks/${riskId}`);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to delete risk.';
      throw new Error(message);
    }
  },

  /**
   * Get risk assessment matrix (heatmap data)
   */
  async getRiskMatrix(filters = {}) {
    try {
      const params = filters;
      const response = await apiClient.get('/risks/matrix', { params });
      return response.data;
    } catch (error) {
      return {};
    }
  },
};

export default riskApi;

/**
 * Vendor API service
 * Handles vendor portals, requests, and submissions
 */
import apiClient from './apiClient';
import { mapVendorRequest } from './mappers';

export const vendorApi = {
  /**
   * List vendors
   */
  async listVendors(filters = {}) {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      
      const response = await apiClient.get('/vendors', { params });
      return response.data.items || [];
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch vendors.';
      throw new Error(message);
    }
  },

  /**
   * Get a single vendor
   */
  async getVendor(vendorId) {
    try {
      const response = await apiClient.get(`/vendors/${vendorId}`);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch vendor.';
      throw new Error(message);
    }
  },

  /**
   * List vendor requests (data collection requests sent to vendors)
   */
  async listVendorRequests(filters = {}) {
    try {
      const params = {};
      if (filters.vendorId) params.vendorId = filters.vendorId;
      if (filters.status) params.status = filters.status;
      if (filters.reportingPeriodId) params.reportingPeriodId = filters.reportingPeriodId;
      
      const response = await apiClient.get('/vendor-requests', { params });
      return {
        items: (response.data.items || []).map(mapVendorRequest),
        meta: response.data.meta,
      };
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch vendor requests.';
      throw new Error(message);
    }
  },

  /**
   * Get a single vendor request
   */
  async getVendorRequest(vendorRequestId) {
    try {
      const response = await apiClient.get(`/vendor-requests/${vendorRequestId}`);
      return mapVendorRequest(response.data);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch vendor request.';
      throw new Error(message);
    }
  },

  /**
   * Send data requests to vendors
   */
  async sendVendorRequests(vendorIds, reportingPeriodId, dueDate, message = '') {
    try {
      const response = await apiClient.post('/vendor-requests/send', {
        vendorIds,
        reportingPeriodId,
        dueDate,
        message,
      });
      return (response.data.items || []).map(mapVendorRequest);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to send vendor requests.';
      throw new Error(message);
    }
  },

  /**
   * Submit vendor data (vendor-side)
   */
  async submitVendorData(vendorRequestId, values, documentIds = []) {
    try {
      const response = await apiClient.post(`/vendor-requests/${vendorRequestId}/submit`, {
        values,
        documentIds,
      });
      return mapVendorRequest(response.data);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to submit vendor data.';
      throw new Error(message);
    }
  },

  /**
   * Review vendor submission (auditor-side)
   */
  async reviewVendorSubmission(vendorRequestId, decision, comment = '') {
    try {
      const response = await apiClient.post(`/vendor-requests/${vendorRequestId}/review`, {
        decision, // 'accept' | 'correction_required'
        comment,
      });
      return mapVendorRequest(response.data);
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to review vendor submission.';
      throw new Error(message);
    }
  },

  /**
   * Get value chain configuration
   */
  async getValueChainConfig() {
    try {
      const response = await apiClient.get('/value-chain/config');
      return response.data;
    } catch (error) {
      return {};
    }
  },

  /**
   * Get value chain summary/consolidation
   */
  async getValueChainSummary(reportingPeriodId) {
    try {
      const response = await apiClient.get('/value-chain/summary', {
        params: { reportingPeriodId },
      });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Failed to fetch value chain summary.';
      throw new Error(message);
    }
  },
};

export default vendorApi;

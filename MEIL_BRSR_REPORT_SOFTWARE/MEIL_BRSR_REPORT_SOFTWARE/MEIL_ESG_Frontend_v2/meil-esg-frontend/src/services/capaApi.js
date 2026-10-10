/**
 * VERIGRAPH CAPA (Corrective and Preventive Action) API Service.
 */
import apiClient from './apiClient';

export const capaApi = {
  async listCapa(params = {}) {
    const response = await apiClient.get('/capa', { params });
    return response.data;
  },

  async getCapa(id) {
    const response = await apiClient.get(`/capa/${id}`);
    return response.data;
  },

  async createCapa(data) {
    const response = await apiClient.post('/capa', data);
    return response.data;
  },

  async updateCapa(id, patch) {
    const response = await apiClient.patch(`/capa/${id}`, patch);
    return response.data;
  },
};

export default capaApi;

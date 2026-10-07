/**
 * AI API service
 * Handles AI-powered insights, chat, forecasting, and analysis
 */
import apiClient from './apiClient';

export const aiApi = {

  async chat(message, context = {}) {
    const response =
      await apiClient.post(
        '/ai/chat',
        {
          message,
          context,
        }
      );

    return response.data.answer || '';
  },

  async forecast(data) {
    const response =
      await apiClient.post(
        '/ai/forecast',
        data
      );

    return response.data;
  },

  async analyze(data = {}) {
    const response =
      await apiClient.post(
        '/ai/analyze',
        data
      );

    return response.data;
  },
};

export default aiApi;

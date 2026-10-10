/**
 * Unified API Client export.
 * Delegates exclusively to apiClient.js as the single source of truth for all HTTP requests,
 * JWT management, and token refresh.
 */
import apiClient from './apiClient';

export { apiClient };
export default apiClient;
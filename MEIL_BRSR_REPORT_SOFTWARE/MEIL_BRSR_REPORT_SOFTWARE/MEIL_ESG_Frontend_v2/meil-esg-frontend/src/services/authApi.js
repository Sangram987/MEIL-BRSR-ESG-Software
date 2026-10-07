/**
 * Authentication API service
 * Handles login, register, token refresh, and logout
 */
import apiClient from './apiClient';
import {
  mapUser,
  ROLE_MAP
} from './mappers';



export const authApi = {
  /**
   * Login with email and password
   */
  async login(email, password, role) {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { accessToken, user } = response.data;

      // Store tokens
      sessionStorage.setItem('accessToken', accessToken);
      return { accessToken, user: mapUser(user) };
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Login failed. Please check your credentials.';
      throw new Error(message);
    }
  },


  /**
   * Register a new user
   */
  async register(email, password, firstName, lastName, role) {
    try {
      const response = await apiClient.post('/auth/register', {
        email,
        password,
        firstName,
        lastName,
        role: ROLE_MAP[role] ?? role,

      });
      const { accessToken, user } = response.data;


      // Store tokens
      sessionStorage.setItem('accessToken', accessToken);
      return { accessToken, user: mapUser(user) };
    } catch (error) {

      const message = error.response?.data?.error?.message || 'Registration failed.';

      throw new Error(message);

    }

  },



  /**

   * Get current user profile

   */

  async getCurrentUser() {

    try {

      const response = await apiClient.get('/auth/me');

      return mapUser(response.data);

    } catch (error) {

      const message = error.response?.data?.error?.message || 'Failed to fetch user profile.';

      throw new Error(message);

    }

  },



  /**

   * Refresh access token

   */

  async refreshToken() {

    try {

      const response = await apiClient.post('/auth/refresh');

      const { accessToken } = response.data;



      sessionStorage.setItem('accessToken', accessToken);

      return accessToken;

    } catch (error) {

      sessionStorage.removeItem('accessToken');

      throw new Error('Session expired. Please login again.');

    }

  },



  /**

   * Logout

   */

  async logout() {

    try {

      await apiClient.post('/auth/logout');

    } finally {

      sessionStorage.removeItem('accessToken');

      sessionStorage.removeItem('currentUser');

    }

  },



  /**

   * Change password

   */

  async changePassword(currentPassword, newPassword) {

    try {

      await apiClient.post('/auth/change-password', { currentPassword, newPassword });

    } catch (error) {

      const message = error.response?.data?.error?.message || 'Failed to change password.';

      throw new Error(message);

    }

  },

};



export default authApi; 
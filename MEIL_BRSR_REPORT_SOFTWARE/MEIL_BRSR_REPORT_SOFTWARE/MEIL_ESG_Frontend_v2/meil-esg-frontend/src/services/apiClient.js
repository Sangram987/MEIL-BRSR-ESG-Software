/**

 * Centralized Axios instance with JWT authentication, token refresh, and error handling.

 * This is the single source of truth for all HTTP communication.

 */

import axios from 'axios';



// Use relative path in dev (proxied by Vite), absolute path in production

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||

  (import.meta.env.DEV ? '/api/v1' : 'http://localhost:5000/api/v1');



// Create the base instance

const apiClient = axios.create({

  baseURL: API_BASE_URL,

  headers: {

    'Content-Type': 'application/json',

  },

  withCredentials: true, // Include cookies (for refresh token)

});



// Add request interceptor to include access token

apiClient.interceptors.request.use(

  (config) => {

    const token = sessionStorage.getItem('accessToken');

    if (token) {

      config.headers.Authorization = `Bearer ${token}`;

    }

    return config;

  },

  (error) => Promise.reject(error)

);



// Add response interceptor for token refresh and error handling

let isRefreshing = false;

let failedQueue = [];



const processQueue = (error, token = null) => {

  failedQueue.forEach((prom) => {

    if (error) {

      prom.reject(error);

    } else {

      prom.resolve(token);

    }

  });

  failedQueue = [];

};



apiClient.interceptors.response.use(

  (response) => response,

  async (error) => {

    const originalRequest = error.config;



    if (error.response?.status === 401 && !originalRequest._retry) {

      if (isRefreshing) {

        return new Promise((resolve, reject) => {

          failedQueue.push({ resolve, reject });

        })

          .then((token) => {

            originalRequest.headers.Authorization = `Bearer ${token}`;

            return apiClient(originalRequest);

          })

          .catch((err) => Promise.reject(err));

      }



      originalRequest._retry = true;

      isRefreshing = true;



      try {

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });

        const { accessToken } = response.data;

        sessionStorage.setItem('accessToken', accessToken);

        apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);

        return apiClient(originalRequest);

      } catch (refreshError) {

        processQueue(refreshError, null);

        sessionStorage.removeItem('accessToken');

        window.location.href = '/login';

        return Promise.reject(refreshError);

      } finally {

        isRefreshing = false;

      }

    }



    return Promise.reject(error);

  }

);



export default apiClient; 
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:5000';
let authToken = null;
let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
  return () => { if (onUnauthorized === handler) onUnauthorized = null; };
}

export function setAuthToken(token) {
  authToken = token;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
apiClient.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = error.config?.headers?.Authorization;
    if (error.response?.status === 401 && authToken && sentToken === `Bearer ${authToken}`) {
      setAuthToken(null);
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export default apiClient;

import axios from "axios";

import { logApiError } from "./api-error";
import { getAccessToken, notifyUnauthorized } from "./auth-token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      notifyUnauthorized();
    }

    logApiError(error);

    return Promise.reject(error);
  },
);

export default api;

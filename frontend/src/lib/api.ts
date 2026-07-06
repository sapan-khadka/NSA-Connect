import axios from "axios";

import { logApiError } from "./api-error";
import {
  getAccessToken,
  notifyUnauthorized,
  readStoredRefreshToken,
  syncAccessToken,
  syncRefreshToken,
} from "./auth-token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = readStoredRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const baseURL = import.meta.env.VITE_API_URL ?? "/api";

  try {
    const response = await axios.post<{
      access_token: string;
      refresh_token: string;
    }>(`${baseURL}/v1/auth/refresh`, {
      refresh_token: refreshToken,
    });

    syncAccessToken(response.data.access_token);
    syncRefreshToken(response.data.refresh_token);
    return response.data.access_token;
  } catch {
    return null;
  }
}

function getRefreshedAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  return url.includes("/auth/login") || url.includes("/auth/refresh");
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as
      | (typeof error.config & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true;
      const newToken = await getRefreshedAccessToken();

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
    }

    if (error.response?.status === 401) {
      notifyUnauthorized();
    }

    logApiError(error);

    return Promise.reject(error);
  },
);

export default api;

export async function refreshSession(): Promise<boolean> {
  const newToken = await refreshAccessToken();
  return newToken !== null;
}

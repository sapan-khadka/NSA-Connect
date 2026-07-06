type UnauthorizedListener = () => void;

const ACCESS_TOKEN_STORAGE_KEY = "nsa_connect_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "nsa_connect_refresh_token";

let accessToken: string | null = null;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function readStoredAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function syncAccessToken(token: string | null): void {
  accessToken = token;

  try {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
  }
}

export function syncRefreshToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable in private browsing or restricted contexts.
  }
}

export function registerUnauthorizedListener(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function notifyUnauthorized(): void {
  syncAccessToken(null);
  syncRefreshToken(null);
  for (const listener of unauthorizedListeners) {
    listener();
  }
}

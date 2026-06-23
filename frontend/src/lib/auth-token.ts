type UnauthorizedListener = () => void;

let accessToken: string | null = null;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function syncAccessToken(token: string | null): void {
  accessToken = token;
}

export function registerUnauthorizedListener(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function notifyUnauthorized(): void {
  accessToken = null;
  for (const listener of unauthorizedListeners) {
    listener();
  }
}

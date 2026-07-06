import { isAxiosError } from "axios";

/** Log full API failure details to the browser console for debugging. */
export function logApiError(error: unknown): void {
  if (!isAxiosError(error)) {
    console.error("[API error]", error);
    return;
  }

  const method = error.config?.method?.toUpperCase() ?? "REQUEST";
  const baseUrl = error.config?.baseURL?.replace(/\/$/, "") ?? "";
  const path = error.config?.url ?? "";
  const url = baseUrl && path ? `${baseUrl}${path}` : path || "(unknown url)";

  if (error.response) {
    console.error(`[API error] ${method} ${url}`, {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
    });
    return;
  }

  console.error(`[API error] ${method} ${url} — network error`, error.message);
}

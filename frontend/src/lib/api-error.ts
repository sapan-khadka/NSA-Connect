import { isAxiosError } from "axios";

export const GENERIC_CLIENT_ERROR = "Something went wrong. Please try again.";

type ApiErrorBody = {
  detail?: string | Array<{ msg?: string }>;
  errors?: Array<{ field?: string; message?: string }>;
};

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

function detailFromBody(body: ApiErrorBody | undefined): string | null {
  if (!body) {
    return null;
  }

  if (typeof body.detail === "string" && body.detail.trim()) {
    return body.detail;
  }

  if (Array.isArray(body.errors) && body.errors.length > 0) {
    const messages = body.errors
      .map((item) => item.message?.trim())
      .filter((message): message is string => Boolean(message));
    if (messages.length > 0) {
      return body.detail?.trim() || messages.join(" ");
    }
  }

  if (Array.isArray(body.detail)) {
    return body.detail
      .map((item) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          return String(item.msg);
        }
        return "Invalid input";
      })
      .join(" ");
  }

  return null;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = GENERIC_CLIENT_ERROR,
): string {
  if (!isAxiosError(error)) {
    logApiError(error);
    return fallback;
  }

  if (!error.response) {
    return "Cannot reach the server. Make sure the backend is running on port 8000.";
  }

  const status = error.response.status;
  const message = detailFromBody(error.response.data as ApiErrorBody | undefined);

  if (status >= 500) {
    return message ?? fallback;
  }

  if (status === 502) {
    return message ?? "Cannot reach the server. Make sure the backend is running on port 8000.";
  }

  if (status === 503) {
    return message ?? "This feature is temporarily unavailable. Try again later.";
  }

  if (status === 429) {
    return message ?? "Too many requests — please try again in a few minutes.";
  }

  if (message) {
    return message;
  }

  return fallback;
}

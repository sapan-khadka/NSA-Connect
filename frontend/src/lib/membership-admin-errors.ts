import { isAxiosError } from "axios";

import { getApiErrorMessage } from "./auth-api";

export const MEMBERSHIP_ADMIN_ERROR_MESSAGE =
  "Couldn't update role or position — please try again.";

export function getMembershipAdminErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 422 || status === 400) {
      console.error("Membership admin update failed:", error.response?.data);
      return MEMBERSHIP_ADMIN_ERROR_MESSAGE;
    }
  }

  return getApiErrorMessage(error);
}

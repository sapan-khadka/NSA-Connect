import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import {
  getMembershipAdminErrorMessage,
  MEMBERSHIP_ADMIN_ERROR_MESSAGE,
} from "./membership-admin-errors";

describe("getMembershipAdminErrorMessage", () => {
  it("hides pydantic validation details for 422 responses", () => {
    const error = new AxiosError("Validation failed");
    error.response = {
      status: 422,
      data: {
        detail: [
          {
            msg: "Input should be 'member'",
            type: "enum",
          },
        ],
      },
      statusText: "Unprocessable Entity",
      headers: {},
      config: {} as never,
    };

    expect(getMembershipAdminErrorMessage(error)).toBe(
      MEMBERSHIP_ADMIN_ERROR_MESSAGE,
    );
  });
});

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MockAuthProvider,
  renderWithRouter,
} from "../test/test-utils";

import { LoginPage } from "./LoginPage";

vi.mock("../lib/auth-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/auth-api")>();

  return {
    ...actual,
    loginMember: vi.fn(),
  };
});

function createAxiosError(status: number, detail: string) {
  return new AxiosError(
    "Request failed",
    undefined,
    undefined,
    undefined,
    {
      status,
      data: { detail },
      statusText: "Error",
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    },
  );
}

describe("LoginPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows a friendly pending-approval message for unapproved accounts", async () => {
    const { loginMember } = await import("../lib/auth-api");
    vi.mocked(loginMember).mockRejectedValue(
      createAxiosError(403, "Member account is not approved"),
    );

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MockAuthProvider>
          <LoginPage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "pending@semo.edu");
    await user.type(screen.getByLabelText("Password"), "securepass123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Your account is pending approval"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a board member will review your request soon/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Member account is not approved"),
    ).not.toBeInTheDocument();
    expect(loginMember).toHaveBeenCalledWith({
      email: "pending@semo.edu",
      password: "securepass123",
    });
  });

  it("shows API errors for invalid credentials", async () => {
    const { loginMember } = await import("../lib/auth-api");
    vi.mocked(loginMember).mockRejectedValue(
      createAxiosError(401, "Invalid email or password"),
    );

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MockAuthProvider>
          <LoginPage />
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "test@semo.edu");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Invalid email or password"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Your account is pending approval"),
    ).not.toBeInTheDocument();
  });

  it("redirects approved general members to home after login", async () => {
    const { loginMember } = await import("../lib/auth-api");

    vi.mocked(loginMember).mockResolvedValue({
      access_token: "jwt-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
      expires_at: "2026-12-31T00:00:00Z",
      refresh_expires_at: "2027-01-14T00:00:00Z",
    });

    const user = userEvent.setup();

    const { router } = renderWithRouter(undefined, {
      initialEntries: ["/login"],
      statefulAuth: true,
      memberRole: "general",
    });

    const view = within(screen.getByRole("main"));

    await user.type(view.getByLabelText("Email"), "test@semo.edu");
    await user.type(view.getByLabelText("Password"), "securepass123");
    await user.click(view.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(loginMember).toHaveBeenCalledWith({
        email: "test@semo.edu",
        password: "securepass123",
      });
      expect(router.state.location.pathname).toBe("/");
    });
    expect(
      await screen.findByRole("heading", { name: /Welcome back, Test User/ }),
    ).toBeInTheDocument();
  });
});

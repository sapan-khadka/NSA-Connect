import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";
import { syncAccessToken } from "../lib/auth-token";
import { createMockMember } from "../test/test-utils";

vi.mock("../lib/auth-api", () => ({
  fetchCurrentMember: vi.fn(),
}));

import { fetchCurrentMember } from "../lib/auth-api";

const mockedFetchCurrentMember = vi.mocked(fetchCurrentMember);

function AuthProbe() {
  const { isAuthenticated, isLoading, member } = useAuth();

  if (isLoading) {
    return <div>Loading session</div>;
  }

  return (
    <div>
      {isAuthenticated ? `Signed in as ${member?.full_name}` : "Signed out"}
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    syncAccessToken(null);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    syncAccessToken(null);
  });

  it("restores session from localStorage on refresh", async () => {
    localStorage.setItem("nsa_connect_access_token", "stored-jwt");
    mockedFetchCurrentMember.mockResolvedValue(createMockMember("board"));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("Signed in as Test User")).toBeInTheDocument();
    expect(mockedFetchCurrentMember).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("nsa_connect_access_token")).toBe("stored-jwt");
  });

  it("clears invalid stored tokens", async () => {
    localStorage.setItem("nsa_connect_access_token", "expired-jwt");
    mockedFetchCurrentMember.mockRejectedValue(new Error("Unauthorized"));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("Signed out")).toBeInTheDocument();
    expect(localStorage.getItem("nsa_connect_access_token")).toBeNull();
  });

  it("starts signed out when no token is stored", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("Signed out")).toBeInTheDocument();
    expect(mockedFetchCurrentMember).not.toHaveBeenCalled();
  });
});

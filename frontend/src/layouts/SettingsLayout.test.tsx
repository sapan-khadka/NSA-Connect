import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsLayout } from "./SettingsLayout";
import { MockAuthProvider, createMockMember } from "../test/test-utils";

function renderSettingsNav(role: "general" | "board") {
  render(
    <MockAuthProvider
      value={{
        member: createMockMember(role),
        isAuthenticated: true,
      }}
    >
      <MemoryRouter initialEntries={["/settings/profile"]}>
        <Routes>
          <Route path="/settings" element={<SettingsLayout />}>
            <Route path="profile" element={<p>Profile pane</p>} />
            <Route path="email" element={<p>Email pane</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </MockAuthProvider>,
  );
}

describe("SettingsLayout", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function mockLgUp(matches: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("1024px") ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  it("shows member settings without integrations", () => {
    renderSettingsNav("general");
    const nav = screen.getByRole("navigation", { name: "Settings" });
    expect(nav).toHaveTextContent("Account");
    expect(nav).toHaveTextContent("Profile");
    expect(nav).toHaveTextContent("Notifications");
    expect(nav).toHaveTextContent("Security");
    expect(nav).toHaveTextContent("Privacy");
    expect(nav).not.toHaveTextContent("Email");
    expect(nav).not.toHaveTextContent("Chapter");
    expect(screen.queryByText("Notification scheduler")).not.toBeInTheDocument();
  });

  it("shows chapter email for board members", () => {
    renderSettingsNav("board");
    const nav = screen.getByRole("navigation", { name: "Settings" });
    expect(nav).toHaveTextContent("Chapter");
    expect(nav).toHaveTextContent("Email");
  });

  it("shows Owner in settings identity for org owners on mobile index", () => {
    mockLgUp(false);
    render(
      <MockAuthProvider
        value={{
          member: createMockMember("general", { is_org_owner: true }),
          isAuthenticated: true,
        }}
      >
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/settings" element={<SettingsLayout />}>
              <Route path="profile" element={<p>Profile pane</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("redirects settings index to profile on large screens", async () => {
    mockLgUp(true);
    render(
      <MockAuthProvider
        value={{
          member: createMockMember("general"),
          isAuthenticated: true,
        }}
      >
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/settings" element={<SettingsLayout />}>
              <Route path="profile" element={<p>Profile pane</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>,
    );

    expect(await screen.findByText("Profile pane")).toBeInTheDocument();
  });
});

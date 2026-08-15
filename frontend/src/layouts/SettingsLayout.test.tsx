import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

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
  });

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

  it("opens the settings menu on the index route only on mobile", () => {
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

    expect(
      screen.queryByRole("heading", { name: "Settings" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Profile pane")).toBeInTheDocument();
  });
});

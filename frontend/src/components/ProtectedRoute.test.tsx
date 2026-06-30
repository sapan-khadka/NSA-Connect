import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { ProtectedRoute } from "../components/ProtectedRoute";
import { createMockMember, MockAuthProvider } from "../test/test-utils";

describe("ProtectedRoute", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a loading state while auth is resolving", () => {
    render(
      <MemoryRouter initialEntries={["/board"]}>
        <MockAuthProvider value={{ isLoading: true, isAuthenticated: false }}>
          <ProtectedRoute minRole="board">
            <div>Protected content</div>
          </ProtectedRoute>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Checking your session...")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to login with the original path", async () => {
    render(
      <MemoryRouter initialEntries={["/board"]}>
        <MockAuthProvider value={{ member: null, isAuthenticated: false }}>
          <Routes>
            <Route
              path="/board"
              element={
                <ProtectedRoute minRole="board">
                  <div>Protected content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders protected content for an authorized role", () => {
    render(
      <MemoryRouter initialEntries={["/member"]}>
        <MockAuthProvider
          value={{
            member: createMockMember("general"),
            isAuthenticated: true,
          }}
        >
          <ProtectedRoute roles={["general"]}>
            <div>Member dashboard content</div>
          </ProtectedRoute>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Member dashboard content")).toBeInTheDocument();
  });

  it("redirects general members away from board-only routes to home", async () => {
    render(
      <MemoryRouter initialEntries={["/board"]}>
        <MockAuthProvider
          value={{
            member: createMockMember("general"),
            isAuthenticated: true,
          }}
        >
          <Routes>
            <Route
              path="/board"
              element={
                <ProtectedRoute minRole="board">
                  <div>Board dashboard content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<div>Home page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(screen.queryByText("Board dashboard content")).not.toBeInTheDocument();
  });

  it("redirects board members away from general-only routes to home", async () => {
    render(
      <MemoryRouter initialEntries={["/member"]}>
        <MockAuthProvider
          value={{
            member: createMockMember("board"),
            isAuthenticated: true,
          }}
        >
          <Routes>
            <Route
              path="/member"
              element={
                <ProtectedRoute roles={["general"]}>
                  <div>Member dashboard content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<div>Home page</div>} />
          </Routes>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(screen.queryByText("Member dashboard content")).not.toBeInTheDocument();
  });
});

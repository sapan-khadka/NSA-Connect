import { render, type RenderOptions } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";
import {
  useCallback,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { vi } from "vitest";

import type { MemberResponse } from "../lib/auth-api";
import type { MemberRole } from "../lib/roles";
import { AuthContext, type AuthContextValue } from "../context/auth-context";
import { appRoutes } from "../router";

export function createMockMember(
  role: MemberRole,
  overrides: Partial<MemberResponse> = {},
): MemberResponse {
  return {
    id: 1,
    full_name: "Test User",
    email: "test@semo.edu",
    student_id: "12345678",
    major: "Computer Science",
    graduation_year: 2028,
    role,
    status: "approved",
    position: "member",
    ...overrides,
  };
}

export function createMockAuthValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  const member = overrides.member ?? null;

  return {
    token: member ? "test-token" : null,
    member,
    isAuthenticated: member !== null,
    isLoading: false,
    login: vi.fn().mockResolvedValue(member),
    logout: vi.fn(),
    updateMember: vi.fn(),
    ...overrides,
  };
}

type MockAuthProviderProps = {
  children: ReactNode;
  value?: Partial<AuthContextValue>;
};

export function MockAuthProvider({
  children,
  value = {},
}: MockAuthProviderProps) {
  const authValue = createMockAuthValue(value);

  return (
    <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
  );
}

type StatefulAuthProviderProps = {
  children: ReactNode;
  memberRole?: MemberRole;
};

export function StatefulAuthProvider({
  children,
  memberRole = "general",
}: StatefulAuthProviderProps) {
  const [member, setMember] = useState<MemberResponse | null>(null);

  const login = useCallback(async () => {
    const currentMember = createMockMember(memberRole);
    setMember(currentMember);
    return currentMember;
  }, [memberRole]);

  const logout = useCallback(() => {
    setMember(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: member ? "test-token" : null,
      member,
      isAuthenticated: member !== null,
      isLoading: false,
      login,
      logout,
      updateMember: setMember,
    }),
    [member, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

type RenderWithRouterOptions = {
  initialEntries?: string[];
  routes?: RouteObject[];
  auth?: Partial<AuthContextValue>;
  statefulAuth?: boolean;
  memberRole?: MemberRole;
} & Omit<RenderOptions, "wrapper">;

export function renderWithRouter(
  ui?: ReactElement,
  {
    initialEntries = ["/"],
    routes = appRoutes,
    auth = {},
    statefulAuth = false,
    memberRole = "general",
    ...options
  }: RenderWithRouterOptions = {},
) {
  const router = createMemoryRouter(routes, { initialEntries });
  const Provider = statefulAuth
    ? ({ children }: { children: ReactNode }) => (
        <StatefulAuthProvider memberRole={memberRole}>
          {children}
        </StatefulAuthProvider>
      )
    : ({ children }: { children: ReactNode }) => (
        <MockAuthProvider value={auth}>{children}</MockAuthProvider>
      );

  const result = render(
    <Provider>{ui ?? <RouterProvider router={router} />}</Provider>,
    options,
  );

  return { router, ...result };
}

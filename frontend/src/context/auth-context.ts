import { createContext } from "react";

import type { MemberResponse } from "../lib/auth-api";

export type AuthContextValue = {
  token: string | null;
  member: MemberResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<MemberResponse>;
  logout: () => void;
  updateMember: (member: MemberResponse) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

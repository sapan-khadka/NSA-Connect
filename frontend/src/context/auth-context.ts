import { createContext } from "react";

import type { MemberResponse, TokenResponse } from "../lib/auth-api";

export type AuthContextValue = {
  token: string | null;
  member: MemberResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokens: TokenResponse) => Promise<MemberResponse>;
  updateSessionTokens: (tokens: TokenResponse) => void;
  logout: () => void;
  updateMember: (member: MemberResponse) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

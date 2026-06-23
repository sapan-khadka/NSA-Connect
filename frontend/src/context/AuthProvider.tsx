import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchCurrentMember } from "../lib/auth-api";
import {
  registerUnauthorizedListener,
  syncAccessToken,
} from "../lib/auth-token";

import { AuthContext, type AuthContextValue } from "./auth-context";

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<AuthContextValue["member"]>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    syncAccessToken(token);
  }, [token]);

  useEffect(() => {
    return registerUnauthorizedListener(() => {
      setToken(null);
      setMember(null);
    });
  }, []);

  const login = useCallback(async (accessToken: string) => {
    setIsLoading(true);
    setToken(accessToken);
    syncAccessToken(accessToken);

    try {
      const currentMember = await fetchCurrentMember();
      setMember(currentMember);
      return currentMember;
    } catch (error) {
      setToken(null);
      setMember(null);
      syncAccessToken(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setMember(null);
    syncAccessToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      member,
      isAuthenticated: token !== null && member !== null,
      isLoading,
      login,
      logout,
    }),
    [token, member, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchCurrentMember } from "../lib/auth-api";
import type { MemberResponse } from "../lib/auth-api";
import {
  readStoredAccessToken,
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedToken = readStoredAccessToken();
      if (!storedToken) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      syncAccessToken(storedToken);
      if (!cancelled) {
        setToken(storedToken);
      }

      try {
        const currentMember = await fetchCurrentMember();
        if (!cancelled) {
          setMember(currentMember);
        }
      } catch {
        if (!cancelled) {
          setToken(null);
          setMember(null);
          syncAccessToken(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return registerUnauthorizedListener(() => {
      setToken(null);
      setMember(null);
      syncAccessToken(null);
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

  const updateMember = useCallback((updatedMember: MemberResponse) => {
    setMember(updatedMember);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      member,
      isAuthenticated: token !== null && member !== null,
      isLoading,
      login,
      logout,
      updateMember,
    }),
    [token, member, isLoading, login, logout, updateMember],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

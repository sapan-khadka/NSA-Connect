import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchCurrentMember, type MemberResponse, type TokenResponse } from "../lib/auth-api";
import { refreshSession } from "../lib/api";
import {
  readStoredAccessToken,
  readStoredRefreshToken,
  registerUnauthorizedListener,
  syncAccessToken,
  syncRefreshToken,
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
      const storedRefreshToken = readStoredRefreshToken();

      if (!storedToken && !storedRefreshToken) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      if (storedToken) {
        syncAccessToken(storedToken);
        if (!cancelled) {
          setToken(storedToken);
        }
      }

      if (storedRefreshToken) {
        syncRefreshToken(storedRefreshToken);
      }

      try {
        const currentMember = await fetchCurrentMember();
        if (!cancelled) {
          setMember(currentMember);
        }
      } catch {
        const refreshed = await refreshSession();
        if (refreshed) {
          const refreshedToken = readStoredAccessToken();
          if (!cancelled && refreshedToken) {
            setToken(refreshedToken);
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
              syncRefreshToken(null);
            }
          }
        } else if (!cancelled) {
          setToken(null);
          setMember(null);
          syncAccessToken(null);
          syncRefreshToken(null);
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
      syncRefreshToken(null);
    });
  }, []);

  const login = useCallback(async (tokens: TokenResponse) => {
    setIsLoading(true);
    setToken(tokens.access_token);
    syncAccessToken(tokens.access_token);
    syncRefreshToken(tokens.refresh_token);

    try {
      const currentMember = await fetchCurrentMember();
      setMember(currentMember);
      return currentMember;
    } catch (error) {
      setToken(null);
      setMember(null);
      syncAccessToken(null);
      syncRefreshToken(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSessionTokens = useCallback((tokens: TokenResponse) => {
    setToken(tokens.access_token);
    syncAccessToken(tokens.access_token);
    syncRefreshToken(tokens.refresh_token);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setMember(null);
    syncAccessToken(null);
    syncRefreshToken(null);
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
      updateSessionTokens,
      logout,
      updateMember,
    }),
    [token, member, isLoading, login, updateSessionTokens, logout, updateMember],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

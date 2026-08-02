"use client";

/**
 * lib/auth-context.tsx
 *
 * Thin React context wrapping lib/api.ts's register()/login() calls and the
 * localStorage-backed token from getStoredToken()/setStoredToken(). Anything
 * that needs to know "is someone logged in, and as whom" reads this via
 * useAuth() instead of touching localStorage or lib/api.ts's token helpers
 * directly.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  register as apiRegister,
  login as apiLogin,
  getMe as apiGetMe,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  isSessionValid,
  ApiError,
  AUTH_EXPIRED_EVENT,
  type UserResponse,
} from "@/lib/api";

interface AuthContextValue {
  user: UserResponse | null;
  token: string | null;
  /** True until the initial localStorage read on mount has completed. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  /** Replace the stored user (e.g. after a profile edit) and re-persist to
   *  localStorage so the avatar/name update survives reloads. */
  applyUser: (updated: UserResponse) => void;
  /** Finish an OAuth sign-in: store the token the backend bounced back with,
   *  fetch the user via /auth/me, and persist the full session. */
  completeOAuth: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_STORAGE_KEY = "formix_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount (client-only).
  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedToken && storedUser) {
      // getStoredToken() already checks the client-side expiry timestamp and
      // returns null if the 30-day window has passed, so if we reach here the
      // session is still within its valid lifetime — restore it unconditionally.
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch {
        // Corrupted user JSON — clear everything and let the user log in again.
        clearStoredToken();
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } else if (!isSessionValid()) {
      // No valid token at all — make sure stale user data is also gone.
      localStorage.removeItem(USER_STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const persist = useCallback((result: { access_token: string; user: UserResponse }) => {
    setStoredToken(result.access_token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
    setToken(result.access_token);
    setUser(result.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    persist(result);
  }, [persist]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const result = await apiRegister(email, password, name);
    persist(result);
  }, [persist]);

  const logout = useCallback(() => {
    clearStoredToken();
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const applyUser = useCallback((updated: UserResponse) => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    setUser(updated);
  }, []);

  const completeOAuth = useCallback(async (token: string) => {
    // Persist the token first so request() picks it up for the /auth/me call.
    setStoredToken(token);
    const user = await apiGetMe();
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    setToken(token);
    setUser(user);
  }, []);

  // lib/api.ts fires this when a request carrying our Bearer token comes
  // back 401 (expired/invalid session, or the user no longer exists on the
  // backend) — without this, every subsequent request would keep silently
  // failing with the same stale token and no way for the user to recover
  // short of manually clearing localStorage.
  useEffect(() => {
    const handleExpired = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      toast.error("Your session has expired. Please sign in again.");
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, register, logout, applyUser, completeOAuth }),
    [user, token, isLoading, login, register, logout, applyUser, completeOAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used inside <AuthProvider>");
  return ctx;
}

export { ApiError };

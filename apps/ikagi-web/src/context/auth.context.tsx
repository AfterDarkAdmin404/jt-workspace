'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, registerUnauthorizedHandler } from '../api/api-client';
import {
  authService,
  type AuthSession,
  type LoginCredentials,
  type RegisterPayload,
  type UserProfile,
} from '../services/auth.service';
import { tokenStorage } from '../services/token-storage.service';

export interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionError: string | null;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  register: (payload: RegisterPayload) => Promise<AuthSession | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile>;
  retrySession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const resetAuthState = useCallback(() => {
    tokenStorage.clearTokens();
    setUser(null);
    setSessionError(null);
  }, []);

  useEffect(() => {
    const unregister = registerUnauthorizedHandler(() => {
      resetAuthState();
      if (pathname !== '/login' && pathname !== '/register') {
        router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      }
    });
    return unregister;
  }, [pathname, resetAuthState, router]);

  const hydrateSession = useCallback(async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setSessionError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const profile = await authService.getProfile();
      setUser(profile);
      setSessionError(null);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        tokenStorage.clearTokens();
        setUser(null);
        setSessionError(null);
      } else {
        setSessionError(
          err instanceof ApiError
            ? err.message
            : 'Unable to verify your session right now. Please try again.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrateSession();

    const unsubscribe = tokenStorage.subscribeToTokenChanges((newToken) => {
      if (!newToken) {
        setUser(null);
        setSessionError(null);
        if (pathname !== '/login' && pathname !== '/register') {
          router.replace('/login');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [hydrateSession, pathname, router]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const session = await authService.login(credentials);
    setUser(session.user);
    return session;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const session = await authService.register(payload);
    if (session) {
      setUser(session.user);
    }
    return session;
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await authService.getProfile();
    setUser(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      sessionError,
      login,
      register,
      logout,
      refreshProfile,
      retrySession: hydrateSession,
    }),
    [
      user,
      isLoading,
      sessionError,
      login,
      register,
      logout,
      refreshProfile,
      hydrateSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

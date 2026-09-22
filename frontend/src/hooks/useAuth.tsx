import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';
import type { AuthUser, LoginRequest, RegisterRequest } from '../types';

type AuthState = { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: AuthUser };

interface AuthApi {
  state: AuthState;
  login: (b: LoginRequest) => Promise<void>;
  register: (b: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const user = await api.me();
      setState({ status: 'authenticated', user });
    } catch {
      // 401 (or server unreachable) → not logged in.
      setState({ status: 'anonymous' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthApi>(
    () => ({
      state,
      refresh,
      login: async (b) => {
        const user = await api.login(b);
        setState({ status: 'authenticated', user });
      },
      register: async (b) => {
        const user = await api.register(b);
        setState({ status: 'authenticated', user });
      },
      logout: async () => {
        try {
          await api.logout();
        } finally {
          setState({ status: 'anonymous' });
        }
      },
    }),
    [state, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '@/lib/api';
import type { AuthUser, LoginRequest, LoginResponse } from '@/types/auth';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!token) {
      setState({ user: null, token: null, loading: false });
      return;
    }
    try {
      const res = await api.get<{ success: boolean; data: AuthUser }>('/auth/me');
      setState({ user: res.data.data, token, loading: false });
    } catch (err: any) {
      // Try refresh token before giving up
      const refreshToken = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await api.post<{ success: boolean; data: { token: string; refreshToken: string } }>('/auth/refresh', { refreshToken });
          const newToken = refreshRes.data.data.token;
          const newRefresh = refreshRes.data.data.refreshToken;
          const storage = localStorage.getItem('auth_token') ? localStorage : sessionStorage;
          storage.setItem('auth_token', newToken);
          storage.setItem('refresh_token', newRefresh);
          // Retry /me with new token
          const meRes = await api.get<{ success: boolean; data: AuthUser }>('/auth/me');
          setState({ user: meRes.data.data, token: newToken, loading: false });
          return;
        } catch {
          // Refresh also failed, clear everything
        }
      }
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('refresh_token');
      setState({ user: null, token: null, loading: false });
    }
  }, []);

  useEffect(() => { restoreSession(); }, [restoreSession]);

  const login = async (data: LoginRequest) => {
    const res = await api.post<LoginResponse>('/auth/login', data);
    const { token, refreshToken, user } = res.data.data as any;
    const storage = data.rememberMe ? localStorage : sessionStorage;
    storage.setItem('auth_token', token);
    if (refreshToken) storage.setItem('refresh_token', refreshToken);
    setState({ user, token, loading: false });
  };

  const logout = () => {
    // Call backend logout silently
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('refresh_token');
    setState({ user: null, token: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

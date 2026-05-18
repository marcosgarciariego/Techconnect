import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, ApiError } from '../lib/api';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  roles: string[];
  professionalProfile?: {
    id: string;
    description: string | null;
    yearsExperience: number | null;
    hourlyRate: number | null;
    portfolioUrl: string | null;
    availability: string | null;
    verified: boolean;
  } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (role: string) => boolean;
  isClient: boolean;
  isProfessional: boolean;
  isAdmin: boolean;
}

interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  role: 'client' | 'professional';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.me();
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setToken(null);
      }
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await authApi.validate();
        if (response.success && response.data?.valid) {
          setUser(response.data.user);
        }
      } catch (error) {
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    if (response.success && response.data) {
      setUser(response.data.user);
      setToken(response.data.token);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const response = await authApi.register(data);
    if (response.success && response.data) {
      setUser(response.data.user);
      setToken(response.data.token);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setToken(null);
      window.location.href = '/';
    }
  }, []);

  const hasRole = useCallback(
    (role: string) => {
      return user?.roles.includes(role) ?? false;
    },
    [user]
  );

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
    hasRole,
    isClient: hasRole('client'),
    isProfessional: hasRole('professional'),
    isAdmin: hasRole('admin'),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };

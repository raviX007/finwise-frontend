import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { auth as authApi } from "../lib/api";
import type { User } from "../lib/api";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token")
  );
  const [loading, setLoading] = useState<boolean>(
    () => Boolean(localStorage.getItem("token"))
  );

  useEffect(() => {
    if (!token) return;
    authApi
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const { user, token } = await authApi.login({ email, password });
    localStorage.setItem("token", token);
    setToken(token);
    setUser(user);
  }, []);

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      const { user, token } = await authApi.register({ email, name, password });
      localStorage.setItem("token", token);
      setToken(token);
      setUser(user);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((user: User) => {
    setUser(user);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

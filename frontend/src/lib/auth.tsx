"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

const ACCOUNTS = [
  { username: "zach@123mobile", password: "hoodward" },
  { username: "eamon@123mobile", password: "hoodward" },
];

const STORAGE_KEY = "mt-auth-v1";

type AuthUser = { username: string };

type AuthContextValue = {
  user: AuthUser | null;
  loaded: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  function login(username: string, password: string): boolean {
    const match = ACCOUNTS.find(
      (a) =>
        a.username === username.trim().toLowerCase() &&
        a.password === password.trim().toLowerCase(),
    );
    if (!match) return false;
    const u: AuthUser = { username: match.username };
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    return true;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, loaded, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

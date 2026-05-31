"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const IDENTITY_URL = `${API_BASE}/.netlify/identity`;
const TOKEN_KEY = "mt-identity-token";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
};

type StoredToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  stored_at: number;
  user: { id: string; email: string; user_metadata?: { full_name?: string } };
};

type AuthContextValue = {
  user: AuthUser | null;
  loaded: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<{ confirmEmail: boolean }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  getToken: () => string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwt(token: string): { sub?: string; email?: string; user_metadata?: { full_name?: string } } {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function storedToUser(s: StoredToken): AuthUser {
  // /signup puts user fields at top level; /token nests them under 'user'
  // /token (password grant) puts nothing — decode the JWT to get email/sub
  const u = s.user ?? (s as unknown as { id?: string; email?: string; user_metadata?: { full_name?: string } });
  const jwt = decodeJwt(s.access_token);
  const email = u.email || jwt.email || "";
  const id = u.id || jwt.sub || "";
  return {
    id,
    email,
    name: u.user_metadata?.full_name ?? jwt.user_metadata?.full_name ?? email.split("@")[0],
    token: s.access_token,
    refreshToken: s.refresh_token,
    expiresAt: s.stored_at + s.expires_in * 1000,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<StoredToken | null> {
  try {
    const res = await fetch(`${IDENTITY_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { ...data, stored_at: Date.now() };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const raw = localStorage.getItem(TOKEN_KEY);
        if (!raw) { setLoaded(true); return; }
        const stored: StoredToken = JSON.parse(raw);

        // Refresh if token expires within 5 minutes
        if (stored.stored_at + stored.expires_in * 1000 - Date.now() < 300_000) {
          const refreshed = await refreshAccessToken(stored.refresh_token);
          if (refreshed) {
            localStorage.setItem(TOKEN_KEY, JSON.stringify(refreshed));
            setUser(storedToUser(refreshed));
          } else {
            // Refresh failed — token is dead, clear it so user is shown as signed out
            localStorage.removeItem(TOKEN_KEY);
          }
        } else {
          setUser(storedToUser(stored));
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
      setLoaded(true);
    }
    init();
  }, []);

  async function login(email: string, password: string) {
    const res = await fetch(`${IDENTITY_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=password&username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error_description?: string }).error_description ?? "Invalid email or password.");
    }
    const data = await res.json();
    const stored: StoredToken = { ...data, stored_at: Date.now() };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
    setUser(storedToUser(stored));
  }

  async function signup(email: string, password: string, name: string): Promise<{ confirmEmail: boolean }> {
    const res = await fetch(`${IDENTITY_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, data: { full_name: name } }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { msg?: string }).msg ?? "Could not create account.");
    }
    // If autoconfirm is off, user gets an email — no token yet
    if (!data.access_token) return { confirmEmail: true };

    // /signup returns user fields at the top level; /token nests them under 'user'
    const stored: StoredToken = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      stored_at: Date.now(),
      user: data.user ?? {
        id: data.id,
        email: data.email,
        user_metadata: data.user_metadata,
      },
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
    setUser(storedToUser(stored));
    return { confirmEmail: false };
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  async function updatePassword(newPassword: string) {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) throw new Error("Not signed in.");
    const stored: StoredToken = JSON.parse(raw);
    const res = await fetch(`${IDENTITY_URL}/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${stored.access_token}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { msg?: string }).msg ?? "Could not update password.");
    }
  }

  async function forgotPassword(email: string) {
    const res = await fetch(`${IDENTITY_URL}/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error("Could not send reset email. Check the address and try again.");
  }

  function getToken(): string | null {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const stored: StoredToken = JSON.parse(raw);
      return stored.access_token;
    } catch {
      return null;
    }
  }

  return (
    <AuthContext.Provider value={{ user, loaded, login, signup, logout, forgotPassword, updatePassword, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// Module-level token getter for use outside React (e.g. workspace.tsx API calls)
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as StoredToken).access_token;
  } catch {
    return null;
  }
}

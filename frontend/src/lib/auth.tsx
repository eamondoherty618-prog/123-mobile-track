"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  token: string;
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

function sessionToUser(session: Session): AuthUser {
  const u = session.user;
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? "",
    token: session.access_token,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session ? sessionToUser(session) : null);
      setLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? sessionToUser(session) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async function signup(email: string, password: string, name: string): Promise<{ confirmEmail: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw new Error(error.message);
    // If session is null, email confirmation is required
    return { confirmEmail: !data.session };
  }

  function logout() {
    supabase.auth.signOut();
  }

  async function forgotPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_API_BASE ?? ""}/login?mode=reset`,
    });
    if (error) throw new Error(error.message);
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }

  function getToken(): string | null {
    // Supabase manages the session internally; expose synchronously via stored session
    let token: string | null = null;
    supabase.auth.getSession().then(({ data }) => {
      token = data.session?.access_token ?? null;
    });
    return token;
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

// Module-level token getter — reads from Supabase's localStorage session synchronously
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").split("//")[1]?.split(".")[0] ?? "";
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    return (JSON.parse(raw) as { access_token?: string }).access_token ?? null;
  } catch {
    return null;
  }
}

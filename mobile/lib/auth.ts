import * as SecureStore from "expo-secure-store";

// Mobile auth now uses Supabase (same as the web dashboard) so the same email
// resolves to the same user_id → same organization → same fleet data.
// The publishable/anon key is safe to embed in a client app.
const SUPABASE_URL = "https://rprqcfrjkuoxkobershb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b44roLELFvBgK2oU3S4uJQ__C6InxOS";
const AUTH_BASE = `${SUPABASE_URL}/auth/v1`;

const TOKEN_KEY = "mtrack_token";
const REFRESH_KEY = "mtrack_refresh_token";
const EMAIL_KEY = "mtrack_email";

export type AuthUser = { email: string; token: string };

async function persistSession(email: string, data: { access_token?: string; refresh_token?: string }) {
  if (data.access_token) await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
  await SecureStore.setItemAsync(EMAIL_KEY, email);
  if (data.refresh_token) await SecureStore.setItemAsync(REFRESH_KEY, data.refresh_token);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${AUTH_BASE}/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description ?? data.msg ?? data.error ?? "Login failed");
  }
  if (!data.access_token) throw new Error("No session returned");
  await persistSession(email.trim().toLowerCase(), data);
  return { email: email.trim().toLowerCase(), token: data.access_token };
}

export async function signup(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${AUTH_BASE}/signup`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.msg ?? data.error_description ?? data.error ?? "Sign up failed");
  }
  // If the project has email confirmation off, signup returns a session directly.
  if (data.access_token) {
    await persistSession(email.trim().toLowerCase(), data);
    return { email: email.trim().toLowerCase(), token: data.access_token };
  }
  // Otherwise fall through to a normal login (works once the account is usable).
  return login(email, password);
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${AUTH_BASE}/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
    if (data.refresh_token) await SecureStore.setItemAsync(REFRESH_KEY, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function deleteAccount(_token: string): Promise<void> {
  // Self-delete isn't permitted with the anon key; clear the local session.
  // A dedicated backend endpoint can perform the hard delete later.
  await logout();
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
}

export async function getStoredAuth(): Promise<AuthUser | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const email = await SecureStore.getItemAsync(EMAIL_KEY);
  if (!token || !email) return null;
  return { email, token };
}

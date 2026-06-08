import * as SecureStore from "expo-secure-store";

const IDENTITY_URL = "https://123mobiletrack.com/.netlify/identity";
const TOKEN_KEY = "mtrack_token";
const REFRESH_KEY = "mtrack_refresh_token";
const EMAIL_KEY = "mtrack_email";

export type AuthUser = { email: string; token: string };

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${IDENTITY_URL}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=password&username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.msg ?? "Login failed");
  await SecureStore.setItemAsync(TOKEN_KEY, data.access_token);
  await SecureStore.setItemAsync(EMAIL_KEY, email);
  if (data.refresh_token) await SecureStore.setItemAsync(REFRESH_KEY, data.refresh_token);
  return { email, token: data.access_token };
}

export async function signup(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${IDENTITY_URL}/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg ?? "Sign up failed");
  return login(email, password);
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${IDENTITY_URL}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
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

export async function deleteAccount(token: string): Promise<void> {
  const res = await fetch(`${IDENTITY_URL}/user`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.msg ?? "Failed to delete account");
  }
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

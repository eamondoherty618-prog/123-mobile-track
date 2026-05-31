import * as SecureStore from "expo-secure-store";

const IDENTITY_URL = "https://123mobiletrack.com/.netlify/identity";
const TOKEN_KEY = "mtrack_token";
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
  // Auto-login after signup
  return login(email, password);
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
}

export async function getStoredAuth(): Promise<AuthUser | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const email = await SecureStore.getItemAsync(EMAIL_KEY);
  if (!token || !email) return null;
  return { email, token };
}

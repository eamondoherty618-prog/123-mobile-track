import { Stack, useRouter, useSegments } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { Component, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { setTokenRefreshCallback } from "../lib/api";
import { getStoredAuth, type AuthUser } from "../lib/auth";
import { C } from "../lib/colors";

// expo-router uses this exported ErrorBoundary for the root segment — shows error instead of white screen
export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: "#1a2e1a", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 12 }}>Startup Error</Text>
      <Text style={{ color: "#e6f4e6", fontSize: 13, textAlign: "center" }}>{error?.message ?? String(error)}</Text>
    </View>
  );
}

let _user: AuthUser | null = null;
let _setUser: ((u: AuthUser | null) => void) | null = null;

export function getUser() { return _user; }
export function setGlobalUser(u: AuthUser | null) { _user = u; _setUser?.(u); }

class RootErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: C.cloud }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.ink, marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ fontSize: 13, color: C.slate, textAlign: "center" }}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Auth redirect logic must be inside the navigator — useRouter/useSegments
// cannot be called in the root layout itself in production builds.
function AuthRedirect({ user }: { user: AuthUser | null | undefined }) {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (user === undefined) return;
    const inAuth = segments[0] === "login";
    if (!user && !inAuth) router.replace("/login");
    if (user && inAuth) router.replace("/(tabs)");
  }, [user, segments]);

  return null;
}

export default function RootLayout() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  _setUser = setUser;

  useEffect(() => {
    setTokenRefreshCallback((newToken) => {
      if (_user) setGlobalUser({ ..._user, token: newToken });
    });
    getStoredAuth().then((auth) => {
      _user = auth;
      setUser(auth);
    }).catch(() => {
      setUser(null);
    });
  }, []);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.forest }}>
        <ActivityIndicator color={C.white} />
      </View>
    );
  }

  return (
    <RootErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="devices/add" options={{ presentation: "modal", headerShown: true, title: "Add Device", headerTintColor: C.forest }} />
      </Stack>
      <AuthRedirect user={user} />
    </RootErrorBoundary>
  );
}

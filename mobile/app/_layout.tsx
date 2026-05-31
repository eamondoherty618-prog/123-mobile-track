import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getStoredAuth, type AuthUser } from "../lib/auth";
import { C } from "../lib/colors";

// Simple auth context via module-level state (no provider needed for this size)
let _user: AuthUser | null = null;
let _setUser: ((u: AuthUser | null) => void) | null = null;

export function getUser() { return _user; }
export function setGlobalUser(u: AuthUser | null) { _user = u; _setUser?.(u); }

export default function RootLayout() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const router = useRouter();
  const segments = useSegments();

  _setUser = setUser;

  useEffect(() => {
    getStoredAuth().then((auth) => {
      _user = auth;
      setUser(auth);
    });
  }, []);

  useEffect(() => {
    if (user === undefined) return; // still loading
    const inAuth = segments[0] === "login";
    if (!user && !inAuth) router.replace("/login");
    if (user && inAuth) router.replace("/(tabs)");
  }, [user, segments]);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.cloud }}>
        <ActivityIndicator color={C.forest} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="devices/add" options={{ presentation: "modal", headerShown: true, title: "Add Device", headerTintColor: C.forest }} />
    </Stack>
  );
}

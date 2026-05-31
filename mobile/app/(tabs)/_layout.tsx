import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { C } from "../../lib/colors";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: "🗺",
    vehicles: "🚐",
    trips: "📍",
    alerts: "🔔",
    settings: "⚙️",
  };
  return null; // icons rendered via tabBarLabel below; SF Symbols via systemIcon
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.forest,
        tabBarInactiveTintColor: C.slate,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopColor: C.line,
          paddingBottom: Platform.OS === "ios" ? 0 : 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => (
            <TabBarSFSymbol name="map.fill" color={color} size={size} fallback="🗺" />
          ),
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          title: "Vehicles",
          tabBarIcon: ({ color, size }) => (
            <TabBarSFSymbol name="car.fill" color={color} size={size} fallback="🚐" />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, size }) => (
            <TabBarSFSymbol name="location.fill" color={color} size={size} fallback="📍" />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, size }) => (
            <TabBarSFSymbol name="bell.fill" color={color} size={size} fallback="🔔" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <TabBarSFSymbol name="gearshape.fill" color={color} size={size} fallback="⚙️" />
          ),
        }}
      />
    </Tabs>
  );
}

// Renders an SF Symbol on iOS, emoji fallback on other platforms
function TabBarSFSymbol({
  name,
  color,
  size,
  fallback,
}: {
  name: string;
  color: string;
  size: number;
  fallback: string;
}) {
  // expo-symbols is available in SDK 56 on iOS
  if (Platform.OS === "ios") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SymbolView } = require("expo-symbols");
      return (
        <SymbolView
          name={name}
          style={{ width: size, height: size }}
          type="hierarchical"
          tintColor={color}
        />
      );
    } catch {
      // expo-symbols not installed — fall through to text
    }
  }
  const { Text } = require("react-native");
  return <Text style={{ fontSize: size * 0.75 }}>{fallback}</Text>;
}

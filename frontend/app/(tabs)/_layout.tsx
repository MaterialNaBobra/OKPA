import Ionicons from "@react-native-vector-icons/ionicons";
import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform } from "react-native";

import { useAuth } from "@/src/auth";
import { fonts } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";

const TABS = [
  { name: "index", label: "Plan", sf: "person.crop.circle", icon: "person-circle" },
  { name: "people", label: "Ludzie", sf: "person.2.fill", icon: "people" },
  { name: "shared", label: "Wspólny", sf: "calendar", icon: "calendar" },
  { name: "free", label: "Wolne", sf: "sun.max.fill", icon: "sunny" },
  { name: "meetings", label: "Spotkania", sf: "cup.and.saucer.fill", icon: "cafe" },
] as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user, ready } = useAuth();
  if (ready && !user) return <Redirect href="/login" />;
  if (ready && user && !user.active_group_id) return <Redirect href="/groups" />;

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        {TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf} />
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={(focused ? t.icon : `${t.icon}-outline`) as any} size={24} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

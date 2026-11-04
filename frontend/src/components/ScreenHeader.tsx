import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Avatar, IconButton, T } from "@/src/components/ui";
import { useActiveGroup, useMembers } from "@/src/hooks";
import { useTheme } from "@/src/theme";

export function ScreenHeader({ title, back, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { group } = useActiveGroup();
  const { colorFor } = useMembers();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
      {back ? <IconButton icon="chevron-back" onPress={() => router.back()} testID="header-back-button" /> : null}
      <View style={{ flex: 1 }}>
        <T weight="heavy" size={26} numberOfLines={1} testID="screen-title">
          {title}
        </T>
        {group && !back ? (
          <Pressable onPress={() => router.push("/groups")} testID="header-group-button" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="people" size={14} color={colors.brandPrimary} />
            <T weight="bold" size={13} color={colors.brandPrimary} numberOfLines={1}>
              {group.name}
            </T>
            <Ionicons name="chevron-down" size={14} color={colors.brandPrimary} />
          </Pressable>
        ) : null}
      </View>
      {right}
      {!back && user ? (
        <Pressable onPress={() => router.push("/profile")} testID="header-profile-button" hitSlop={6}>
          <Avatar name={user.username} color={colorFor(user.id)} size={44} />
        </Pressable>
      ) : null}
    </View>
  );
}

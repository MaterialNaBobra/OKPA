import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Pressable, RefreshControl, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Avatar, Badge, Button, Card, EmptyState, T } from "@/src/components/ui";
import { useActiveGroup, useMembers } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme, userColorFor } from "@/src/theme";

export default function People() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const { user } = useAuth();
  const { group } = useActiveGroup();
  const { members, isLoading, isRefetching, refetch } = useMembers();

  const share = () => group && Share.share({ message: `Dołącz do grupy "${group.name}" w aplikacji OKPA! Kod: ${group.code}` });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Ludzie" />
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={colors.brandPrimary} />}
        ListHeaderComponent={
          group ? (
            <Card style={styles.invite} testID="invite-card">
              <View style={{ flex: 1 }}>
                <T size={13} weight="bold" color={colors.onBrandTertiary}>
                  Kod zaproszenia
                </T>
                <T size={26} weight="heavy" color={colors.onBrandTertiary} testID="invite-code" style={{ letterSpacing: 3 }}>
                  {group.code}
                </T>
              </View>
              <Button small icon="share-social" title="Udostępnij" onPress={share} testID="invite-share-button" />
            </Card>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? null : <EmptyState icon="people" title="Na razie pusto" text="Wyślij znajomym kod zaproszenia." />
        }
        ListFooterComponent={
          members.length === 1 ? (
            <EmptyState icon="person-add" title="Zaproś ekipę" text="Udostępnij kod, żeby znajomi mogli dodać swoje plany." />
          ) : null
        }
        renderItem={({ item: m }) => (
          <Pressable
            testID={`member-row-${m.username}`}
            onPress={() => router.push({ pathname: "/user/[id]", params: { id: m.id } })}
            style={({ pressed }) => [styles.row, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Avatar name={m.username} color={userColorFor(m.color_index)} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <T weight="heavy" size={17}>
                {m.username}
              </T>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {m.id === user?.id ? <Badge label="Ty" /> : null}
                {m.is_owner ? <Badge label="Założyciel" bg={colors.surfaceTertiary} fg={colors.onSurfaceTertiary} /> : null}
              </View>
            </View>
            <View style={[styles.colorTag, { backgroundColor: userColorFor(m.color_index) }]} />
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  list: { paddingHorizontal: 16, gap: 10 },
  invite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.brandTertiary,
    borderColor: c.brandSecondary,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: c.divider,
  },
  colorTag: { width: 14, height: 36, borderRadius: 7 },
}));

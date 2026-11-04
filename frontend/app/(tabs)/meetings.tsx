import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { FlatList, Platform, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Meeting } from "@/src/api";
import { useAuth } from "@/src/auth";
import { MeetingSheet } from "@/src/components/MeetingSheet";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { useToast } from "@/src/components/Toast";
import { Avatar, Button, EmptyState, ErrorText, Segmented, T } from "@/src/components/ui";
import { fmtLong, relativeLabel, todayISO } from "@/src/dates";
import { useActiveGroup, useMembers } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function Meetings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { gid } = useActiveGroup();
  const { members, colorFor } = useMembers();
  const [past, setPast] = useState<"upcoming" | "all">("upcoming");
  const [edit, setEdit] = useState<Meeting | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["meetings", gid, past],
    queryFn: () => api<Meeting[]>(`/groups/${gid}/meetings?include_past=${past === "all"}`),
    enabled: !!gid,
  });

  const rsvp = async (m: Meeting, status: "yes" | "no") => {
    setBusy(`${m.id}-${status}`);
    try {
      await api(`/meetings/${m.id}/rsvp`, { method: "POST", body: { status } });
      if (Platform.OS !== "web")
        status === "yes"
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      ["meetings", "occ", "free"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast(status === "yes" ? "Super! Dodano do Twojego planu" : "Zapisano: nie idziesz");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Spotkania" />
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Segmented
          testID="meetings-filter"
          value={past}
          onChange={setPast}
          options={[
            { value: "upcoming", label: "Nadchodzące" },
            { value: "all", label: "Wszystkie" },
          ]}
        />
      </View>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={colors.brandPrimary} />}
        ListHeaderComponent={q.error ? <ErrorText msg={(q.error as Error).message} /> : undefined}
        ListEmptyComponent={
          q.isLoading ? null : (
            <EmptyState
              testID="meetings-empty"
              icon="cafe"
              title="Brak spotkań"
              text="Wybierz wolny dzień w zakładce „Wolne” i zaproponuj spotkanie."
              action={<Button title="Zobacz wolne dni" icon="sunny" onPress={() => router.push("/(tabs)/free")} testID="meetings-go-free-button" />}
            />
          )
        }
        renderItem={({ item: m }) => {
          const mine = user ? m.rsvps[user.id] : undefined;
          const going = members.filter((x) => m.rsvps[x.id] === "yes");
          const notGoing = members.filter((x) => m.rsvps[x.id] === "no");
          const unknown = members.filter((x) => !m.rsvps[x.id]);
          return (
            <View style={styles.card} testID={`meeting-card-${m.id}`}>
              <Pressable onPress={() => setEdit(m)} testID={`meeting-open-${m.id}`} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <T weight="heavy" size={20}>
                      {m.title}
                    </T>
                    <T weight="bold" size={14} color={colors.brandPrimary}>
                      {fmtLong(m.date)} · {relativeLabel(m.date)}
                    </T>
                  </View>
                  <Ionicons name="create-outline" size={20} color={colors.muted} />
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={16} color={colors.muted} />
                  <T>{m.start_time ? `${m.start_time}${m.end_time ? ` – ${m.end_time}` : ""}` : "Cały dzień / godzina do ustalenia"}</T>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color={colors.muted} />
                  <T color={m.place ? colors.onSurface : colors.muted}>{m.place || "Miejsce do ustalenia"}</T>
                </View>
                {m.notes ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="document-text-outline" size={16} color={colors.muted} />
                    <T style={{ flex: 1 }}>{m.notes}</T>
                  </View>
                ) : null}
                <T size={12} color={colors.muted}>
                  Zaproponował(a): {m.created_by_name}
                </T>
              </Pressable>
              <View style={styles.people}>
                <View style={styles.avatars}>
                  {going.map((x) => (
                    <View key={x.id} style={{ marginRight: -10 }}>
                      <Avatar name={x.username} color={colorFor(x.id)} size={32} />
                    </View>
                  ))}
                </View>
                <T size={13} color={colors.muted} style={{ flex: 1, marginLeft: going.length ? 14 : 0 }} testID={`meeting-counts-${m.id}`}>
                  Idą: {going.length} · Nie: {notGoing.length} · ?: {unknown.length}
                </T>
              </View>
              {going.length || notGoing.length ? (
                <T size={12} color={colors.muted}>
                  {going.length ? `✓ ${going.map((x) => x.username).join(", ")}` : ""}
                  {going.length && notGoing.length ? "   " : ""}
                  {notGoing.length ? `✕ ${notGoing.map((x) => x.username).join(", ")}` : ""}
                </T>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button
                  title="Idę"
                  icon="checkmark-circle"
                  variant={mine === "yes" ? "primary" : "outline"}
                  onPress={() => rsvp(m, "yes")}
                  loading={busy === `${m.id}-yes`}
                  testID={`meeting-rsvp-yes-${m.id}`}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Nie idę"
                  icon="close-circle"
                  variant={mine === "no" ? "danger" : "outline"}
                  onPress={() => rsvp(m, "no")}
                  loading={busy === `${m.id}-no`}
                  testID={`meeting-rsvp-no-${m.id}`}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          );
        }}
      />
      <MeetingSheet visible={!!edit} onClose={() => setEdit(null)} meeting={edit} defaultDate={edit?.date ?? todayISO()} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  list: { paddingHorizontal: 16, gap: 14 },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: c.divider,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  people: { flexDirection: "row", alignItems: "center" },
  avatars: { flexDirection: "row" },
}));

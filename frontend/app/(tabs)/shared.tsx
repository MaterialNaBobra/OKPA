import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";

import { api, Meeting, Occurrence } from "@/src/api";
import { CalendarView } from "@/src/components/CalendarView";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Sheet } from "@/src/components/Sheet";
import { Avatar, Button, ErrorText, T } from "@/src/components/ui";
import { fmtLong, rangeFor } from "@/src/dates";
import { useActiveGroup, useMembers } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, meetingColor, useTheme, userColorFor } from "@/src/theme";

const MEETING_UID = "__meeting__";

export default function Shared() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const { gid } = useActiveGroup();
  const { members, colorFor, nameFor } = useMembers();
  const [hidden, setHidden] = useState<string[]>([]);
  const [range, setRange] = useState(() => {
    const r = rangeFor("month", new Date());
    return { start: r.start, end: r.end };
  });
  const occ = useQuery({
    queryKey: ["occ", "group", gid, range.start, range.end],
    queryFn: () => api<Occurrence[]>(`/groups/${gid}/occurrences?start=${range.start}&end=${range.end}`),
    enabled: !!gid,
    placeholderData: keepPreviousData,
  });
  const meetings = useQuery({
    queryKey: ["meetings", gid, "all"],
    queryFn: () => api<Meeting[]>(`/groups/${gid}/meetings?include_past=true`),
    enabled: !!gid,
  });
  const [openMeeting, setOpenMeeting] = useState<Meeting | null>(null);
  const visible = useMemo(() => {
    const plans = (occ.data ?? []).filter((o) => o.type !== "meeting" && !hidden.includes(o.user_id));
    const meetingOcc: Occurrence[] = (meetings.data ?? [])
      .filter((m) => m.date >= range.start && m.date <= range.end)
      .map((m) => ({
        source_id: m.id,
        user_id: MEETING_UID,
        title: m.title,
        date: m.date,
        start_time: m.start_time,
        end_time: m.end_time,
        type: "meeting",
        kind: "once",
        all_day: !m.start_time,
      }));
    return [...plans, ...meetingOcc].sort((a, b) =>
      a.date === b.date ? (a.start_time ?? "").localeCompare(b.start_time ?? "") : a.date.localeCompare(b.date),
    );
  }, [occ.data, meetings.data, hidden, range.start, range.end]);
  const calColor = (uid: string) => (uid === MEETING_UID ? meetingColor : colorFor(uid));
  const calName = (uid: string) => (uid === MEETING_UID ? "Spotkanie grupy" : nameFor(uid));
  const going = openMeeting ? members.filter((m) => openMeeting.rsvps[m.id] === "yes") : [];
  const notGoing = openMeeting ? members.filter((m) => openMeeting.rsvps[m.id] === "no") : [];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Wspólny terminarz" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.legendRow}
        contentContainerStyle={styles.legendContent}
        testID="legend-row"
      >
        {members.map((m) => {
          const off = hidden.includes(m.id);
          return (
            <Pressable
              key={m.id}
              testID={`legend-chip-${m.username}`}
              onPress={() => setHidden((h) => (off ? h.filter((x) => x !== m.id) : [...h, m.id]))}
              style={[styles.chip, { borderColor: off ? colors.border : userColorFor(m.color_index), opacity: off ? 0.5 : 1 }]}
            >
              <View style={[styles.dot, { backgroundColor: userColorFor(m.color_index) }]} />
              <T weight="bold" size={13}>
                {m.username}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      {occ.error ? (
        <View style={{ paddingHorizontal: 16 }}>
          <ErrorText msg={(occ.error as Error).message} />
        </View>
      ) : null}
      <CalendarView
        testID="shared-calendar"
        occurrences={visible}
        colorFor={calColor}
        nameFor={calName}
        showNames
        onMeetingPress={(o) => setOpenMeeting(meetings.data?.find((m) => m.id === o.source_id) ?? null)}
        loading={occ.isFetching}
        refreshing={occ.isRefetching}
        onRefresh={() => { occ.refetch(); }}
        onRangeChange={setRange}
        bottomPadding={bottomChrome}
      />
      <Sheet
        visible={!!openMeeting}
        onClose={() => setOpenMeeting(null)}
        title={openMeeting?.title ?? ""}
        testID="shared-meeting-sheet"
        footer={
          <Button
            title="Przejdź do spotkań"
            icon="cafe"
            onPress={() => {
              setOpenMeeting(null);
              router.push("/(tabs)/meetings");
            }}
            testID="shared-meeting-go-button"
          />
        }
      >
        {openMeeting ? (
          <View style={{ gap: 10 }}>
            <T weight="bold" size={15} color={colors.brandPrimary}>
              {fmtLong(openMeeting.date)}
            </T>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color={colors.muted} />
              <T>
                {openMeeting.start_time
                  ? `${openMeeting.start_time}${openMeeting.end_time ? ` – ${openMeeting.end_time}` : ""}`
                  : "Cały dzień / godzina do ustalenia"}
              </T>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={colors.muted} />
              <T color={openMeeting.place ? colors.onSurface : colors.muted}>{openMeeting.place || "Miejsce do ustalenia"}</T>
            </View>
            {openMeeting.notes ? <T>{openMeeting.notes}</T> : null}
            <T weight="heavy" size={15} testID="shared-meeting-going">
              Idą ({going.length})
            </T>
            {going.length ? (
              going.map((m) => (
                <View key={m.id} style={styles.infoRow}>
                  <Avatar name={m.username} color={colorFor(m.id)} size={28} />
                  <T weight="bold">{m.username}</T>
                </View>
              ))
            ) : (
              <T color={colors.muted}>Nikt jeszcze się nie zapisał</T>
            )}
            {notGoing.length ? (
              <T size={13} color={colors.muted}>
                Nie idą: {notGoing.map((m) => m.username).join(", ")}
              </T>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  legendRow: { flexGrow: 0, height: 56 },
  legendContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.surfaceSecondary,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
}));

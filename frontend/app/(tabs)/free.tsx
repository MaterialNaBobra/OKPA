import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, FreeDay } from "@/src/api";
import { MeetingSheet } from "@/src/components/MeetingSheet";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Badge, Button, EmptyState, ErrorText, Segmented, T } from "@/src/components/ui";
import { fmt, fromISO, relativeLabel, toISO, todayISO, weekdayIndex } from "@/src/dates";
import { useActiveGroup } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function Free() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const { gid } = useActiveGroup();
  const [days, setDays] = useState<"30" | "60" | "90">("60");
  const [propose, setPropose] = useState<string | null>(null);
  const start = todayISO();
  const end = toISO(addDays(new Date(), Number(days)));
  const q = useQuery({
    queryKey: ["free", gid, start, end],
    queryFn: () => api<FreeDay[]>(`/groups/${gid}/free-days?start=${start}&end=${end}`),
    enabled: !!gid,
  });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Wolne dni" />
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
        <T size={13} color={colors.muted}>
          Dni, w których nikt z grupy nie ma żadnych planów.
        </T>
        <Segmented
          testID="free-range"
          value={days}
          onChange={setDays}
          options={[
            { value: "30", label: "30 dni" },
            { value: "60", label: "60 dni" },
            { value: "90", label: "90 dni" },
          ]}
        />
      </View>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(d) => d.date}
        contentContainerStyle={[styles.list, { paddingBottom: bottomChrome + 24 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={colors.brandPrimary} />}
        ListHeaderComponent={q.error ? <ErrorText msg={(q.error as Error).message} /> : undefined}
        ListEmptyComponent={
          q.isLoading ? (
            <T color={colors.muted}>Szukam wolnych dni…</T>
          ) : (
            <EmptyState
              testID="free-empty"
              icon="sunny"
              title="Brak wspólnie wolnych dni"
              text="Spróbuj dłuższego zakresu albo poproś ekipę o przejrzenie planów."
            />
          )
        }
        renderItem={({ item, index }) => {
          const d = fromISO(item.date);
          const weekend = weekdayIndex(d) >= 5;
          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40)} style={styles.card} testID={`free-day-${item.date}`}>
              <View style={[styles.dateBox, weekend && { backgroundColor: colors.warning }]}>
                <T weight="heavy" size={26} color={weekend ? colors.onWarning : colors.onBrandSecondary}>
                  {d.getDate()}
                </T>
                <T weight="bold" size={11} color={weekend ? colors.onWarning : colors.onBrandSecondary} style={{ textTransform: "uppercase" }}>
                  {fmt(d, "LLL")}
                </T>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <T weight="heavy" size={17} style={{ textTransform: "capitalize" }}>
                  {fmt(d, "EEEE")}
                </T>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <Badge label={relativeLabel(item.date)} bg={colors.surfaceTertiary} fg={colors.onSurfaceTertiary} />
                  {weekend ? <Badge label="weekend" bg={colors.warning} fg={colors.onWarning} /> : null}
                </View>
                {item.meeting ? (
                  <Button
                    small
                    variant="secondary"
                    icon="cafe"
                    title={`Zaplanowane: ${item.meeting.title}`}
                    onPress={() => router.push("/(tabs)/meetings")}
                    testID={`free-day-view-meeting-${item.date}`}
                    style={{ alignSelf: "flex-start" }}
                  />
                ) : (
                  <Button
                    small
                    icon="add"
                    title="Zaproponuj spotkanie"
                    onPress={() => setPropose(item.date)}
                    testID={`free-day-propose-${item.date}`}
                    style={{ alignSelf: "flex-start" }}
                  />
                )}
              </View>
              <Ionicons name="sunny" size={22} color={colors.warning} />
            </Animated.View>
          );
        }}
      />
      <MeetingSheet
        visible={!!propose}
        onClose={() => setPropose(null)}
        meeting={null}
        defaultDate={propose ?? start}
        onSaved={() => router.push("/(tabs)/meetings")}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    backgroundColor: c.surfaceSecondary,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: c.divider,
  },
  dateBox: {
    width: 64,
    height: 72,
    borderRadius: 18,
    backgroundColor: c.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
}));

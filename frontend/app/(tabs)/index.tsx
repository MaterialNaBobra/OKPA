import Ionicons from "@react-native-vector-icons/ionicons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Occurrence, Plan } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CalendarView } from "@/src/components/CalendarView";
import { PlanSheet } from "@/src/components/PlanSheet";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { rangeFor, todayISO } from "@/src/dates";
import { useMembers } from "@/src/hooks";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function MyPlan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const { user } = useAuth();
  const { colorFor } = useMembers();
  const [range, setRange] = useState(() => {
    const r = rangeFor("month", new Date());
    return { start: r.start, end: r.end };
  });
  const [selected, setSelected] = useState(todayISO());
  const [sheet, setSheet] = useState<{ plan: Plan | null; date: string; hour?: number } | null>(null);

  const occ = useQuery({
    queryKey: ["occ", "me", range.start, range.end],
    queryFn: () => api<Occurrence[]>(`/occurrences?start=${range.start}&end=${range.end}`),
    placeholderData: keepPreviousData,
  });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api<Plan[]>("/plans") });

  const onPress = useCallback(
    (o: Occurrence) => {
      if (o.type === "meeting") return router.push("/(tabs)/meetings");
      const plan = plans.data?.find((p) => p.id === o.source_id) ?? null;
      if (plan) setSheet({ plan, date: o.date });
    },
    [plans.data, router],
  );

  return (
    <View style={styles.root} testID="my-plan-screen">
      <ScreenHeader title="Mój plan" />
      <CalendarView
        testID="my-calendar"
        occurrences={occ.data ?? []}
        colorFor={(uid) => (uid === user?.id ? colorFor(uid) : colors.brandSecondary)}
        loading={occ.isFetching}
        refreshing={occ.isRefetching}
        onRefresh={() => { occ.refetch(); }}
        onRangeChange={setRange}
        onSelectedChange={setSelected}
        onOccurrencePress={onPress}
        onAdd={(date, hour) => setSheet({ plan: null, date, hour })}
        bottomPadding={bottomChrome + 72}
      />
      <Pressable
        testID="add-plan-fab"
        onPress={() => setSheet({ plan: null, date: selected })}
        style={({ pressed }) => [styles.fab, { bottom: bottomChrome + 16, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <Ionicons name="add" size={30} color={colors.onBrandPrimary} />
      </Pressable>
      <PlanSheet
        visible={!!sheet}
        onClose={() => setSheet(null)}
        plan={sheet?.plan ?? null}
        defaultDate={sheet?.date ?? selected}
        defaultHour={sheet?.hour}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  fab: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: c.onSurface,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
}));

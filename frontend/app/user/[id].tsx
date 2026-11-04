import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Occurrence } from "@/src/api";
import { CalendarView } from "@/src/components/CalendarView";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ErrorText } from "@/src/components/ui";
import { rangeFor } from "@/src/dates";
import { useMembers } from "@/src/hooks";
import { makeStyles } from "@/src/theme";

export default function UserPlan() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { nameFor, colorFor } = useMembers();
  const [range, setRange] = useState(() => {
    const r = rangeFor("month", new Date());
    return { start: r.start, end: r.end };
  });
  const occ = useQuery({
    queryKey: ["occ", "user", id, range.start, range.end],
    queryFn: () => api<Occurrence[]>(`/occurrences?user_id=${id}&start=${range.start}&end=${range.end}`),
    placeholderData: keepPreviousData,
  });
  return (
    <View style={styles.root}>
      <ScreenHeader title={`Plan: ${nameFor(id)}`} back />
      {occ.error ? (
        <View style={{ paddingHorizontal: 16 }}>
          <ErrorText msg={(occ.error as Error).message} />
        </View>
      ) : null}
      <CalendarView
        testID="user-calendar"
        occurrences={occ.data ?? []}
        colorFor={colorFor}
        nameFor={nameFor}
        loading={occ.isFetching}
        refreshing={occ.isRefetching}
        onRefresh={() => { occ.refetch(); }}
        onRangeChange={setRange}
        bottomPadding={insets.bottom}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
}));

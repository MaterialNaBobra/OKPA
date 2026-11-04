import Ionicons from "@react-native-vector-icons/ionicons";
import { addMonths, addWeeks, isSameMonth } from "date-fns";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Occurrence } from "@/src/api";
import { Sheet } from "@/src/components/Sheet";
import { Button, IconButton, Segmented, T } from "@/src/components/ui";
import { CalMode, fmt, fmtLong, rangeFor, toISO, toMin, todayISO, WEEKDAYS_SHORT } from "@/src/dates";
import { makeStyles, meetingColor, onMeetingColor, useTheme } from "@/src/theme";

const HOUR_H = 44;
const TIME_COL = 40;

type Props = {
  occurrences: Occurrence[];
  colorFor: (uid: string) => string;
  nameFor?: (uid: string) => string;
  showNames?: boolean;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onRangeChange: (r: { start: string; end: string }) => void;
  onOccurrencePress?: (o: Occurrence) => void;
  onMeetingPress?: (o: Occurrence) => void;
  onAdd?: (dateISO: string, hour?: number) => void;
  onSelectedChange?: (dateISO: string) => void;
  bottomPadding?: number;
  testID: string;
};

export function CalendarView(p: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [mode, setMode] = useState<CalMode>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(todayISO());
  const [info, setInfo] = useState<Occurrence | null>(null);
  const range = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);
  const { onRangeChange, onSelectedChange } = p;

  useEffect(() => {
    onRangeChange({ start: range.start, end: range.end });
  }, [range.start, range.end, onRangeChange]);
  useEffect(() => {
    onSelectedChange?.(selected);
  }, [selected, onSelectedChange]);

  const byDay = useMemo(() => {
    const m: Record<string, Occurrence[]> = {};
    p.occurrences.forEach((o) => (m[o.date] = m[o.date] ? [...m[o.date], o] : [o]));
    return m;
  }, [p.occurrences]);

  const press = (o: Occurrence) =>
    o.type === "meeting" && p.onMeetingPress
      ? p.onMeetingPress(o)
      : p.onOccurrencePress
        ? p.onOccurrencePress(o)
        : setInfo(o);
  const shift = (dir: number) => {
    setAnchor((a) => (mode === "month" ? addMonths(a, dir) : addWeeks(a, dir)));
  };
  const goToday = () => {
    setAnchor(new Date());
    setSelected(todayISO());
  };
  const label =
    mode === "month"
      ? fmt(anchor, "LLLL yyyy")
      : `${fmt(range.days[0], "d MMM")} – ${fmt(range.days[6], "d MMM yyyy")}`;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <Segmented
          testID={`${p.testID}-mode`}
          value={mode}
          onChange={setMode}
          options={[
            { value: "month", label: "Miesiąc" },
            { value: "week", label: "Tydzień" },
          ]}
        />
        <View style={styles.navRow}>
          <IconButton icon="chevron-back" size={40} onPress={() => shift(-1)} testID={`${p.testID}-prev`} />
          <T weight="heavy" size={16} style={styles.navLabel} testID={`${p.testID}-label`}>
            {label}
          </T>
          {p.loading ? <ActivityIndicator color={colors.brandPrimary} /> : null}
          <Pressable onPress={goToday} style={styles.todayBtn} testID={`${p.testID}-today`}>
            <T weight="heavy" size={12} color={colors.onBrandTertiary}>
              Dziś
            </T>
          </Pressable>
          <IconButton icon="chevron-forward" size={40} onPress={() => shift(1)} testID={`${p.testID}-next`} />
        </View>
      </View>
      {mode === "month" ? (
        <MonthView {...p} days={range.days} anchor={anchor} byDay={byDay} selected={selected} setSelected={setSelected} press={press} />
      ) : (
        <WeekView {...p} days={range.days} byDay={byDay} selected={selected} setSelected={setSelected} press={press} />
      )}
      <Sheet visible={!!info} onClose={() => setInfo(null)} title={info?.title ?? ""} testID="occurrence-sheet">
        {info ? (
          <View style={{ gap: 10 }}>
            {p.nameFor ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.swatch, { backgroundColor: p.colorFor(info.user_id) }]} />
                <T weight="bold" size={15}>
                  {p.nameFor(info.user_id)}
                </T>
              </View>
            ) : null}
            <T size={15}>
              {fmtLong(info.date)}
            </T>
            <T weight="heavy" size={18}>
              {info.all_day ? "Cały dzień" : `${info.start_time} – ${info.end_time ?? ""}`}
            </T>
            <T size={13} color={colors.muted}>
              {info.type === "meeting" ? "Spotkanie grupy" : info.kind === "weekly" ? "Plan powtarzalny" : "Plan jednorazowy"}
            </T>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

type ViewProps = Props & {
  days: Date[];
  byDay: Record<string, Occurrence[]>;
  selected: string;
  setSelected: (s: string) => void;
  press: (o: Occurrence) => void;
};

function OccRow({ o, p }: { o: Occurrence; p: ViewProps }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`occ-row-${o.source_id}-${o.user_id}`}
      onPress={() => p.press(o)}
      style={({ pressed }) => [styles.occRow, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.occStrip, { backgroundColor: o.type === "meeting" ? meetingColor : p.colorFor(o.user_id) }]} />
      <View style={{ width: 92 }}>
        <T weight="heavy" size={14}>
          {o.all_day ? "Cały dzień" : o.start_time}
        </T>
        {!o.all_day && o.end_time ? (
          <T size={12} color={colors.muted}>
            do {o.end_time}
          </T>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <T weight="bold" size={15} numberOfLines={1}>
          {o.title}
        </T>
        <T size={12} color={colors.muted} numberOfLines={1}>
          {[p.showNames && p.nameFor ? p.nameFor(o.user_id) : null, o.type === "meeting" ? "spotkanie" : o.kind === "weekly" ? "co tydzień" : null]
            .filter(Boolean)
            .join(" · ") || "jednorazowy"}
        </T>
      </View>
      {o.type === "meeting" ? <Ionicons name="cafe" size={18} color={colors.brandPrimary} /> : null}
    </Pressable>
  );
}

function MonthView(p: ViewProps & { anchor: Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const today = todayISO();
  const list = p.byDay[p.selected] ?? [];
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: (p.bottomPadding ?? 0) + 24 }}
      refreshControl={p.onRefresh ? <RefreshControl refreshing={!!p.refreshing} onRefresh={p.onRefresh} tintColor={colors.brandPrimary} /> : undefined}
    >
      <View style={styles.grid} testID={`${p.testID}-month-grid`}>
        {WEEKDAYS_SHORT.map((w) => (
          <View key={w} style={styles.weekHeadCell}>
            <T weight="heavy" size={11} color={colors.muted}>
              {w}
            </T>
          </View>
        ))}
        {p.days.map((d) => {
          const iso = toISO(d);
          const occ = p.byDay[iso] ?? [];
          const sel = iso === p.selected;
          const inMonth = isSameMonth(d, p.anchor);
          const planOcc = occ.filter((o) => o.type !== "meeting");
          const hasMeeting = occ.some((o) => o.type === "meeting");
          const uniqueUsers = p.showNames ? Array.from(new Set(planOcc.map((o) => o.user_id))) : planOcc.map((o) => o.user_id);
          return (
            <Pressable
              key={iso}
              testID={`${p.testID}-day-${iso}`}
              onPress={() => p.setSelected(iso)}
              style={[styles.dayCell, sel && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
            >
              <View style={[styles.dayNum, iso === today && { backgroundColor: colors.brandPrimary }]}>
                <T
                  weight="heavy"
                  size={13}
                  color={iso === today ? colors.onBrandPrimary : inMonth ? colors.onSurface : colors.borderStrong}
                >
                  {d.getDate()}
                </T>
              </View>
              <View style={styles.bars}>
                {uniqueUsers.slice(0, 3).map((uid, i) => (
                  <View key={i} style={[styles.bar, { backgroundColor: p.colorFor(uid) }]} />
                ))}
                {uniqueUsers.length > 3 ? (
                  <T weight="heavy" size={9} color={colors.muted}>
                    +{uniqueUsers.length - 3}
                  </T>
                ) : null}
                {hasMeeting ? (
                  <View style={styles.meetBadge} testID={`${p.testID}-meeting-badge-${iso}`}>
                    <Ionicons name="cafe" size={9} color={onMeetingColor} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.dayPanel} testID={`${p.testID}-day-panel`}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T weight="heavy" size={17} style={{ flex: 1 }}>
            {fmtLong(p.selected)}
          </T>
          {p.onAdd ? (
            <Button small icon="add" title="Dodaj" onPress={() => p.onAdd!(p.selected)} testID={`${p.testID}-add-for-day`} />
          ) : null}
        </View>
        {list.length === 0 ? (
          <T size={14} color={colors.muted} testID={`${p.testID}-day-empty`}>
            Brak planów tego dnia – wolne!
          </T>
        ) : (
          list.map((o, i) => <OccRow key={`${o.source_id}-${o.user_id}-${i}`} o={o} p={p} />)
        )}
      </View>
    </ScrollView>
  );
}

function WeekView(p: ViewProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const today = todayISO();
  const userOrder = useMemo(() => {
    const ids = Array.from(new Set(p.occurrences.map((o) => o.user_id)));
    const m: Record<string, number> = {};
    ids.forEach((id, i) => (m[id] = i));
    return m;
  }, [p.occurrences]);
  const hasAllDay = p.days.some((d) => (p.byDay[toISO(d)] ?? []).some((o) => o.all_day));

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.weekHead}>
        <View style={{ width: TIME_COL }} />
        {p.days.map((d, i) => {
          const iso = toISO(d);
          return (
            <Pressable key={iso} style={styles.weekHeadDay} onPress={() => p.onAdd?.(iso)} testID={`${p.testID}-week-head-${iso}`}>
              <T weight="bold" size={11} color={colors.muted}>
                {WEEKDAYS_SHORT[i]}
              </T>
              <View style={[styles.weekHeadNum, iso === today && { backgroundColor: colors.brandPrimary }]}>
                <T weight="heavy" size={14} color={iso === today ? colors.onBrandPrimary : colors.onSurface}>
                  {d.getDate()}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
      {hasAllDay ? (
        <View style={styles.allDayRow}>
          <View style={{ width: TIME_COL, justifyContent: "center" }}>
            <T size={9} weight="bold" color={colors.muted}>
              cały{"\n"}dzień
            </T>
          </View>
          {p.days.map((d) => {
            const items = (p.byDay[toISO(d)] ?? []).filter((o) => o.all_day);
            return (
              <View key={toISO(d)} style={{ flex: 1, gap: 2, paddingHorizontal: 1 }}>
                {items.map((o, i) => (
                  <Pressable
                    key={i}
                    onPress={() => p.press(o)}
                    testID={`week-allday-${o.source_id}-${o.user_id}`}
                    style={[styles.allDayChip, { backgroundColor: o.type === "meeting" ? meetingColor : p.colorFor(o.user_id) }]}
                  >
                    <T size={9} weight="heavy" numberOfLines={1} color={o.type === "meeting" ? onMeetingColor : undefined}>
                      {o.title}
                    </T>
                  </Pressable>
                ))}
              </View>
            );
          })}
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        onLayout={() => scrollRef.current?.scrollTo({ y: HOUR_H * 7, animated: false })}
        contentContainerStyle={{ paddingBottom: (p.bottomPadding ?? 0) + 24 }}
        refreshControl={p.onRefresh ? <RefreshControl refreshing={!!p.refreshing} onRefresh={p.onRefresh} tintColor={colors.brandPrimary} /> : undefined}
        testID={`${p.testID}-week-grid`}
      >
        <View style={{ flexDirection: "row", height: HOUR_H * 24 }}>
          <View style={{ width: TIME_COL }}>
            {Array.from({ length: 24 }).map((_, h) => (
              <View key={h} style={{ height: HOUR_H, alignItems: "flex-end", paddingRight: 6 }}>
                <T size={10} weight="bold" color={colors.muted} style={{ marginTop: -6 }}>
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </T>
              </View>
            ))}
          </View>
          {p.days.map((d) => {
            const iso = toISO(d);
            const items = (p.byDay[iso] ?? []).filter((o) => !o.all_day);
            return (
              <View key={iso} style={[styles.dayCol, iso === today && { backgroundColor: colors.brandTertiary }]}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <Pressable
                    key={h}
                    onPress={() => p.onAdd?.(iso, h)}
                    style={[styles.hourCell, { top: h * HOUR_H }]}
                    testID={h === 12 ? `${p.testID}-slot-${iso}-12` : undefined}
                  />
                ))}
                {items.map((o, i) => {
                  const top = (toMin(o.start_time) / 60) * HOUR_H;
                  const end = o.end_time ? toMin(o.end_time) : toMin(o.start_time) + 60;
                  const height = Math.max(((end - toMin(o.start_time)) / 60) * HOUR_H, 14);
                  const offset = p.showNames ? (userOrder[o.user_id] % 4) * 4 : 0;
                  return (
                    <Pressable
                      key={`${o.source_id}-${o.user_id}-${i}`}
                      testID={`week-block-${o.source_id}-${o.user_id}`}
                      onPress={() => p.press(o)}
                      style={[
                        styles.block,
                        {
                          top,
                          height,
                          left: 1 + offset,
                          backgroundColor: o.type === "meeting" ? meetingColor : p.colorFor(o.user_id),
                          opacity: p.showNames && o.type !== "meeting" ? 0.82 : 1,
                        },
                      ]}
                    >
                      <T size={9} weight="heavy" numberOfLines={height > 30 ? 3 : 1} color={o.type === "meeting" ? onMeetingColor : undefined}>
                        {o.type === "meeting" ? <Ionicons name="cafe" size={9} color={onMeetingColor} /> : null}
                        {o.type === "meeting" ? " " : ""}
                        {o.title}
                      </T>
                      {height > 40 ? (
                        <T size={8} weight="bold" numberOfLines={1} color={o.type === "meeting" ? onMeetingColor : undefined}>
                          {o.start_time}
                        </T>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  toolbar: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  navRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  navLabel: { flex: 1, textTransform: "capitalize" },
  todayBtn: {
    backgroundColor: c.brandTertiary,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekHeadCell: { width: "14.2857%", alignItems: "center", paddingVertical: 4 },
  dayCell: {
    width: "14.2857%",
    height: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    paddingTop: 4,
    gap: 4,
  },
  dayNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  bars: { width: "80%", gap: 2, alignItems: "center" },
  bar: { width: "100%", height: 5, borderRadius: 3 },
  meetBadge: { width: 16, height: 14, borderRadius: 7, backgroundColor: meetingColor, alignItems: "center", justifyContent: "center" },
  dayPanel: {
    marginTop: 12,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: c.divider,
  },
  occRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 12,
    minHeight: 56,
  },
  occStrip: { width: 6, alignSelf: "stretch", borderRadius: 3 },
  swatch: { width: 16, height: 16, borderRadius: 8 },
  weekHead: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  weekHeadDay: { flex: 1, alignItems: "center", gap: 2, minHeight: 44 },
  weekHeadNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  allDayRow: { flexDirection: "row", paddingHorizontal: 4, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: c.divider },
  allDayChip: { borderRadius: 6, paddingHorizontal: 3, paddingVertical: 2 },
  dayCol: { flex: 1, borderLeftWidth: 1, borderLeftColor: c.divider, position: "relative" },
  hourCell: {
    position: "absolute",
    left: 0,
    right: 0,
    height: HOUR_H,
    borderTopWidth: 1,
    borderTopColor: c.divider,
  },
  block: {
    position: "absolute",
    right: 1,
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: c.surface,
    overflow: "hidden",
  },
}));

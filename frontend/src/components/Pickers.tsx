import Ionicons from "@react-native-vector-icons/ionicons";
import { addMonths, isSameMonth } from "date-fns";
import React, { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { fonts, IconButton, T } from "@/src/components/ui";
import { fmt, fmtLong, fromISO, rangeFor, toISO, todayISO, WEEKDAYS_SHORT } from "@/src/dates";
import { makeStyles, useTheme } from "@/src/theme";

export function DateField({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(() => (isNaN(fromISO(value).getTime()) ? new Date() : fromISO(value)));
  useEffect(() => {
    const d = fromISO(value);
    if (!isNaN(d.getTime())) setAnchor(d);
  }, [value]);
  const { days } = rangeFor("month", anchor);
  const today = todayISO();
  return (
    <View style={{ gap: 6 }}>
      <T weight="bold" size={13} color={colors.muted}>
        {label}
      </T>
      <Pressable testID={testID} onPress={() => setOpen((o) => !o)} style={styles.dateBtn}>
        <Ionicons name="calendar-outline" size={18} color={colors.brandPrimary} />
        <T weight="bold" size={15} style={{ flex: 1 }}>
          {fmtLong(value)}
        </T>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.mini}>
          <View style={styles.miniHead}>
            <IconButton icon="chevron-back" size={36} onPress={() => setAnchor((a) => addMonths(a, -1))} testID={`${testID}-prev`} />
            <T weight="heavy" size={15} style={{ flex: 1, textAlign: "center", textTransform: "capitalize" }}>
              {fmt(anchor, "LLLL yyyy")}
            </T>
            <IconButton icon="chevron-forward" size={36} onPress={() => setAnchor((a) => addMonths(a, 1))} testID={`${testID}-next`} />
          </View>
          <View style={styles.grid}>
            {WEEKDAYS_SHORT.map((w) => (
              <View key={w} style={styles.cell}>
                <T weight="bold" size={11} color={colors.muted}>
                  {w}
                </T>
              </View>
            ))}
            {days.map((d) => {
              const iso = toISO(d);
              const sel = iso === value;
              return (
                <Pressable
                  key={iso}
                  testID={`${testID}-day-${iso}`}
                  style={styles.cell}
                  onPress={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  <View
                    style={[
                      styles.dayDot,
                      sel && { backgroundColor: colors.brandPrimary },
                      !sel && iso === today && { borderWidth: 1.5, borderColor: colors.brandPrimary },
                    ]}
                  >
                    <T
                      weight="bold"
                      size={13}
                      color={sel ? colors.onBrandPrimary : isSameMonth(d, anchor) ? colors.onSurface : colors.borderStrong}
                    >
                      {d.getDate()}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const clamp = (s: string, max: number) => {
  const n = s.replace(/\D/g, "").slice(0, 2);
  if (n === "") return "";
  return String(Math.min(Number(n), max)).padStart(n.length, "0");
};

export function TimeField({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [h, m] = value.split(":");
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <T weight="bold" size={13} color={colors.muted}>
        {label}
      </T>
      <View style={styles.timeRow}>
        <TextInput
          testID={`${testID}-hour`}
          value={h}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          onChangeText={(t) => onChange(`${clamp(t, 24)}:${m}`)}
          style={styles.timeInput}
          placeholder="00"
          placeholderTextColor={colors.muted}
        />
        <T weight="heavy" size={20}>
          :
        </T>
        <TextInput
          testID={`${testID}-minute`}
          value={m}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          onChangeText={(t) => onChange(`${h}:${clamp(t, 59)}`)}
          style={styles.timeInput}
          placeholder="00"
          placeholderTextColor={colors.muted}
        />
      </View>
    </View>
  );
}

export const normTime = (v: string) => {
  const [h, m] = v.split(":");
  if (Number(h) >= 24) return "24:00";
  return `${(h || "0").padStart(2, "0")}:${(m || "0").padStart(2, "0")}`;
};

const useStyles = makeStyles((c) => ({
  dateBtn: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mini: { backgroundColor: c.surfaceSecondary, borderRadius: 20, padding: 8, borderWidth: 1, borderColor: c.divider },
  miniHead: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.2857%", height: 40, alignItems: "center", justifyContent: "center" },
  dayDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 10,
    minHeight: 50,
  },
  timeInput: {
    flex: 1,
    minWidth: 0,
    width: 40,
    textAlign: "center",
    fontFamily: fonts.heavy,
    fontSize: 20,
    color: c.onSurface,
    minHeight: 44,
  },
}));

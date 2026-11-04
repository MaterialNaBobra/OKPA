import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { api, Plan } from "@/src/api";
import { DateField, normTime, TimeField } from "@/src/components/Pickers";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { Button, ErrorText, Field, Segmented, T } from "@/src/components/ui";
import { fromISO, weekdayIndex, WEEKDAYS_SHORT } from "@/src/dates";
import { makeStyles, useTheme } from "@/src/theme";

export function PlanSheet({
  visible,
  onClose,
  plan,
  defaultDate,
  defaultHour,
}: {
  visible: boolean;
  onClose: () => void;
  plan: Plan | null;
  defaultDate: string;
  defaultHour?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"once" | "weekly">("once");
  const [date, setDate] = useState(defaultDate);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [interval, setInterval] = useState<"1" | "2">("1");
  const [hasEnd, setHasEnd] = useState(false);
  const [endDate, setEndDate] = useState(defaultDate);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    setConfirmDel(false);
    if (plan) {
      setTitle(plan.title);
      setKind(plan.kind);
      setDate(plan.date ?? plan.start_date ?? defaultDate);
      setWeekdays(plan.weekdays);
      setInterval(plan.interval_weeks === 2 ? "2" : "1");
      setHasEnd(!!plan.end_date);
      setEndDate(plan.end_date ?? defaultDate);
      setStart(plan.start_time);
      setEnd(plan.end_time);
      setNote(plan.note ?? "");
    } else {
      const h = defaultHour ?? 9;
      setTitle("");
      setKind("once");
      setDate(defaultDate);
      setWeekdays([weekdayIndex(fromISO(defaultDate))]);
      setInterval("1");
      setHasEnd(false);
      setEndDate(defaultDate);
      setStart(`${String(h).padStart(2, "0")}:00`);
      setEnd(`${String(Math.min(h + 1, 24)).padStart(2, "0")}:00`);
      setNote("");
    }
  }, [visible, plan, defaultDate, defaultHour]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["occ"] });
    qc.invalidateQueries({ queryKey: ["free"] });
    qc.invalidateQueries({ queryKey: ["plans"] });
  };

  const save = async () => {
    const s = normTime(start);
    const e = normTime(end);
    if (!title.trim()) return setErr("Podaj nazwę planu");
    if (e <= s) return setErr("Godzina końca musi być po początku");
    if (kind === "weekly" && weekdays.length === 0) return setErr("Wybierz co najmniej jeden dzień");
    setBusy(true);
    setErr(null);
    try {
      const body = {
        title: title.trim(),
        kind,
        start_time: s,
        end_time: e,
        date: kind === "once" ? date : null,
        weekdays: kind === "weekly" ? weekdays : [],
        start_date: kind === "weekly" ? date : null,
        end_date: kind === "weekly" && hasEnd ? endDate : null,
        interval_weeks: Number(interval),
        note: note.trim() || null,
      };
      if (plan) await api(`/plans/${plan.id}`, { method: "PUT", body });
      else await api("/plans", { method: "POST", body });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
      toast(plan ? "Plan zapisany" : "Plan dodany");
      onClose();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!plan) return;
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    try {
      await api(`/plans/${plan.id}`, { method: "DELETE" });
      refresh();
      toast("Plan usunięty");
      onClose();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={plan ? "Edytuj plan" : "Nowy plan"}
      testID="plan-sheet"
      footer={
        <>
          <ErrorText msg={err} testID="plan-error" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {plan ? (
              <Button
                variant={confirmDel ? "danger" : "outline"}
                title={confirmDel ? "Na pewno?" : "Usuń"}
                icon="trash-outline"
                onPress={remove}
                testID="plan-delete-button"
                style={{ flex: 1 }}
              />
            ) : null}
            <Button title="Zapisz" icon="checkmark" onPress={save} loading={busy} testID="plan-save-button" style={{ flex: 2 }} />
          </View>
        </>
      }
    >
      <Field label="Nazwa" value={title} onChangeText={setTitle} placeholder="np. Trening, Praca, Szkoła" testID="plan-title-input" />
      <Segmented
        testID="plan-kind"
        value={kind}
        onChange={setKind}
        options={[
          { value: "once", label: "Jednorazowy" },
          { value: "weekly", label: "Powtarzalny" },
        ]}
      />
      {kind === "weekly" ? (
        <>
          <View style={{ gap: 6 }}>
            <T weight="bold" size={13} color={colors.muted}>
              Dni tygodnia
            </T>
            <View style={styles.wdRow}>
              {WEEKDAYS_SHORT.map((w, i) => {
                const on = weekdays.includes(i);
                return (
                  <Pressable
                    key={w}
                    testID={`plan-weekday-${i}`}
                    onPress={() => setWeekdays((cur) => (on ? cur.filter((x) => x !== i) : [...cur, i]))}
                    style={[styles.wd, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                  >
                    <T weight="heavy" size={13} color={on ? colors.onBrandPrimary : colors.onSurface}>
                      {w}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Segmented
            testID="plan-interval"
            value={interval}
            onChange={setInterval}
            options={[
              { value: "1", label: "Co tydzień" },
              { value: "2", label: "Co 2 tygodnie" },
            ]}
          />
        </>
      ) : null}
      <DateField label={kind === "once" ? "Data" : "Od kiedy"} value={date} onChange={setDate} testID="plan-date" />
      {kind === "weekly" ? (
        <>
          <Pressable testID="plan-has-end-toggle" onPress={() => setHasEnd((v) => !v)} style={styles.toggleRow}>
            <View style={[styles.check, hasEnd && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
              {hasEnd ? <T weight="heavy" color={colors.onBrandPrimary}>✓</T> : null}
            </View>
            <T weight="bold">Ustaw datę zakończenia</T>
          </Pressable>
          {hasEnd ? <DateField label="Do kiedy" value={endDate} onChange={setEndDate} testID="plan-end-date" /> : null}
        </>
      ) : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TimeField label="Od" value={start} onChange={setStart} testID="plan-start" />
        <TimeField label="Do" value={end} onChange={setEnd} testID="plan-end" />
      </View>
      <Field label="Notatka (opcjonalnie)" value={note} onChangeText={setNote} placeholder="Szczegóły…" testID="plan-note-input" />
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  wdRow: { flexDirection: "row", gap: 6 },
  wd: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceSecondary,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: c.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
}));

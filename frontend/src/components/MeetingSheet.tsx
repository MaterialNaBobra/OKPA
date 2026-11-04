import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { api, Meeting } from "@/src/api";
import { useAuth } from "@/src/auth";
import { DateField, normTime, TimeField } from "@/src/components/Pickers";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { Button, ErrorText, Field, T } from "@/src/components/ui";
import { useActiveGroup } from "@/src/hooks";
import { makeStyles, useTheme } from "@/src/theme";

export function MeetingSheet({
  visible,
  onClose,
  meeting,
  defaultDate,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  defaultDate: string;
  onSaved?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { gid, group } = useActiveGroup();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [hasTime, setHasTime] = useState(false);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("21:00");
  const [place, setPlace] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    setConfirmDel(false);
    setTitle(meeting?.title ?? "Spotkanie");
    setDate(meeting?.date ?? defaultDate);
    setHasTime(!!meeting?.start_time);
    setStart(meeting?.start_time ?? "18:00");
    setEnd(meeting?.end_time ?? "21:00");
    setPlace(meeting?.place ?? "");
    setNotes(meeting?.notes ?? "");
  }, [visible, meeting, defaultDate]);

  const refresh = () => {
    ["meetings", "occ", "free"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const save = async () => {
    if (!title.trim()) return setErr("Podaj nazwę spotkania");
    const s = normTime(start);
    const e = normTime(end);
    if (hasTime && e <= s) return setErr("Godzina końca musi być po początku");
    setBusy(true);
    setErr(null);
    try {
      const body = {
        title: title.trim(),
        date,
        start_time: hasTime ? s : null,
        end_time: hasTime ? e : null,
        place: place.trim() || null,
        notes: notes.trim() || null,
      };
      if (meeting) await api(`/meetings/${meeting.id}`, { method: "PUT", body });
      else await api(`/groups/${gid}/meetings`, { method: "POST", body });
      refresh();
      toast(meeting ? "Zapisano szczegóły" : "Spotkanie utworzone");
      onClose();
      onSaved?.();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canDelete =
    !!meeting && (meeting.created_by === user?.id || group?.owner_id === user?.id || user?.role === "admin");
  const remove = async () => {
    if (!meeting) return;
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    try {
      await api(`/meetings/${meeting.id}`, { method: "DELETE" });
      refresh();
      toast("Spotkanie odwołane");
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
      title={meeting ? "Szczegóły spotkania" : "Nowe spotkanie"}
      testID="meeting-sheet"
      footer={
        <>
          <ErrorText msg={err} testID="meeting-error" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {canDelete ? (
              <Button
                variant={confirmDel ? "danger" : "outline"}
                title={confirmDel ? "Na pewno?" : "Odwołaj"}
                icon="trash-outline"
                onPress={remove}
                testID="meeting-delete-button"
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              title={meeting ? "Zapisz" : "Utwórz"}
              icon="checkmark"
              onPress={save}
              loading={busy}
              testID="meeting-save-button"
              style={{ flex: 2 }}
            />
          </View>
        </>
      }
    >
      <Field label="Nazwa" value={title} onChangeText={setTitle} placeholder="np. Pizza, Kino" testID="meeting-title-input" />
      <DateField label="Dzień" value={date} onChange={setDate} testID="meeting-date" />
      <Pressable testID="meeting-has-time-toggle" onPress={() => setHasTime((v) => !v)} style={styles.toggleRow}>
        <View style={[styles.check, hasTime && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
          {hasTime ? <T weight="heavy" color={colors.onBrandPrimary}>✓</T> : null}
        </View>
        <T weight="bold">Ustal godzinę</T>
      </Pressable>
      {hasTime ? (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TimeField label="Od" value={start} onChange={setStart} testID="meeting-start" />
          <TimeField label="Do" value={end} onChange={setEnd} testID="meeting-end" />
        </View>
      ) : null}
      <Field label="Gdzie? (opcjonalnie)" value={place} onChangeText={setPlace} placeholder="np. Pizzeria na rynku" testID="meeting-place-input" />
      <Field
        label="Szczegóły (opcjonalnie)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Co zabrać, kto prowadzi…"
        multiline
        style={{ minHeight: 90, paddingTop: 14, textAlignVertical: "top" }}
        testID="meeting-notes-input"
      />
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
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

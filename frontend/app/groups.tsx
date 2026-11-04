import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Share, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Group } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/Toast";
import { Badge, Button, Card, ErrorText, Field, IconButton, T } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

export default function Groups() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { user, refresh, signOut } = useAuth();
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<Group[]>("/groups") });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);

  const done = async () => {
    qc.invalidateQueries();
    await refresh();
    router.replace("/(tabs)");
  };

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const create = () =>
    run("create", async () => {
      if (!name.trim()) throw new Error("Podaj nazwę grupy");
      await api("/groups", { method: "POST", body: { name: name.trim() } });
      toast("Grupa utworzona");
      await done();
    });
  const join = () =>
    run("join", async () => {
      if (!code.trim()) throw new Error("Wpisz kod zaproszenia");
      await api("/groups/join", { method: "POST", body: { code: code.trim() } });
      toast("Dołączono do grupy");
      await done();
    });
  const activate = (g: Group) =>
    run(g.id, async () => {
      await api(`/groups/${g.id}/activate`, { method: "POST" });
      await done();
    });
  const leave = (g: Group) =>
    run(`leave-${g.id}`, async () => {
      if (confirmLeave !== g.id) return setConfirmLeave(g.id);
      await api(`/groups/${g.id}/leave`, { method: "POST" });
      setConfirmLeave(null);
      qc.invalidateQueries();
      await refresh();
      toast("Opuszczono grupę");
    });

  const list = groups.data ?? [];
  const canGoBack = !!user?.active_group_id && router.canGoBack();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {canGoBack ? <IconButton icon="chevron-back" onPress={() => router.back()} testID="groups-back-button" /> : null}
        <T weight="heavy" size={26} style={{ flex: 1 }}>
          Twoje grupy
        </T>
        {!user?.active_group_id ? <Button small variant="outline" title="Wyloguj" onPress={signOut} testID="groups-logout-button" /> : null}
      </View>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {list.length === 0 && !groups.isLoading ? (
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="calendar" size={56} color={colors.brandPrimary} />
            </View>
            <T weight="heavy" size={20}>
              Cześć {user?.username}!
            </T>
            <T color={colors.muted}>Załóż grupę dla swojej ekipy albo dołącz kodem, który dostałeś od znajomych.</T>
          </View>
        ) : null}
        {list.map((g) => {
          const active = g.id === user?.active_group_id;
          return (
            <Card key={g.id} testID={`group-card-${g.id}`} style={active ? { borderColor: colors.brandPrimary, borderWidth: 2 } : undefined}>
              <Pressable onPress={() => activate(g)} style={{ gap: 6 }} testID={`group-activate-${g.id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <T weight="heavy" size={18} style={{ flex: 1 }}>
                    {g.name}
                  </T>
                  {active ? <Badge label="Aktywna" /> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
                </View>
                <T color={colors.muted}>
                  {g.member_count} {g.member_count === 1 ? "osoba" : "osób"} · kod: <T weight="heavy">{g.code}</T>
                </T>
              </Pressable>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Button
                  small
                  variant="secondary"
                  icon="share-social"
                  title="Zaproś"
                  onPress={() => Share.share({ message: `Dołącz do grupy "${g.name}" w aplikacji OKPA! Kod: ${g.code}` })}
                  testID={`group-share-${g.id}`}
                />
                <Button
                  small
                  variant={confirmLeave === g.id ? "danger" : "ghost"}
                  title={confirmLeave === g.id ? "Na pewno opuścić?" : "Opuść"}
                  onPress={() => leave(g)}
                  loading={busy === `leave-${g.id}`}
                  testID={`group-leave-${g.id}`}
                />
              </View>
            </Card>
          );
        })}
        <Card style={{ gap: 12 }}>
          <T weight="heavy" size={17}>
            Dołącz do grupy
          </T>
          <Field
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            placeholder="Kod zaproszenia, np. AB12CD"
            testID="join-code-input"
          />
          <Button title="Dołącz" icon="enter-outline" onPress={join} loading={busy === "join"} testID="join-group-button" />
        </Card>
        <Card style={{ gap: 12 }}>
          <T weight="heavy" size={17}>
            Załóż nową grupę
          </T>
          <Field value={name} onChangeText={setName} placeholder="Nazwa, np. Ekipa z liceum" testID="create-group-name-input" />
          <Button title="Utwórz grupę" icon="add" variant="secondary" onPress={create} loading={busy === "create"} testID="create-group-button" />
        </Card>
        <ErrorText msg={err} testID="groups-error" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  content: { paddingHorizontal: 16, gap: 16 },
  hero: { gap: 8 },
  heroIcon: { width: 110, height: 110, borderRadius: 36, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
}));

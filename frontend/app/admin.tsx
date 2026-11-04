import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { Badge, Button, Card, EmptyState, ErrorText, Field, IconButton, Segmented, T } from "@/src/components/ui";
import { makeStyles, useTheme } from "@/src/theme";

type AdminUser = { id: string; username: string; role: string; plan_count: number; groups: string[] };
type AdminGroup = { id: string; name: string; code: string; members: { id: string; username: string }[] };
type Action =
  | { type: "password" | "rename" | "delete"; user: AdminUser }
  | { type: "delete-group"; group: AdminGroup }
  | { type: "remove-member"; group: AdminGroup; member: { id: string; username: string } };

export default function Admin() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me, refresh } = useAuth();
  const [tab, setTab] = useState<"users" | "groups">("users");
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api<AdminUser[]>("/admin/users") });
  const groups = useQuery({ queryKey: ["admin-groups"], queryFn: () => api<AdminGroup[]>("/admin/groups") });
  const [action, setAction] = useState<Action | null>(null);
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    qc.invalidateQueries();
    refresh();
  };

  const open = (a: Action) => {
    setAction(a);
    setErr(null);
    setValue(a.type === "rename" ? a.user.username : "");
  };

  const exec = async () => {
    if (!action) return;
    setBusy(true);
    setErr(null);
    try {
      if (action.type === "password") {
        if (!value) throw new Error("Wpisz nowe hasło");
        await api(`/admin/users/${action.user.id}/reset-password`, { method: "POST", body: { password: value } });
        toast(`Hasło ${action.user.username} zmienione`);
      } else if (action.type === "rename") {
        if (!value.trim()) throw new Error("Wpisz login");
        await api(`/admin/users/${action.user.id}`, { method: "PUT", body: { username: value.trim() } });
        toast("Login zmieniony");
      } else if (action.type === "delete") {
        await api(`/admin/users/${action.user.id}`, { method: "DELETE" });
        toast("Konto usunięte");
      } else if (action.type === "remove-member") {
        await api(`/admin/groups/${action.group.id}/members/${action.member.id}`, { method: "DELETE" });
        toast("Usunięto z grupy");
      } else {
        await api(`/admin/groups/${action.group.id}`, { method: "DELETE" });
        toast("Grupa usunięta");
      }
      setAction(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleRole = async (u: AdminUser) => {
    try {
      await api(`/admin/users/${u.id}`, { method: "PUT", body: { role: u.role === "admin" ? "user" : "admin" } });
      toast(u.role === "admin" ? "Odebrano uprawnienia" : "Nadano uprawnienia admina");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };


  const titles: Record<Action["type"], string> = {
    password: "Resetuj hasło",
    rename: "Zmień login",
    delete: "Usunąć konto?",
    "delete-group": "Usunąć grupę?",
    "remove-member": "Usunąć z grupy?",
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Panel admina" back />
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
        {users.error ? <ErrorText msg={(users.error as Error).message} testID="admin-load-error" /> : null}
        <Segmented
          testID="admin-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: "users", label: `Użytkownicy (${users.data?.length ?? 0})` },
            { value: "groups", label: `Grupy (${groups.data?.length ?? 0})` },
          ]}
        />
      </View>
      {tab === "users" ? (
        <FlatList
          data={users.data ?? []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={users.isRefetching} onRefresh={() => { users.refetch(); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState title={users.isLoading ? "Ładowanie…" : users.error ? "Brak dostępu" : "Brak użytkowników"} />}
          renderItem={({ item: u }) => (
            <Card testID={`admin-user-${u.username}`} style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T weight="heavy" size={17} style={{ flex: 1 }}>
                  {u.username}
                </T>
                {u.role === "admin" ? <Badge label="Admin" bg={colors.warning} fg={colors.onWarning} /> : null}
              </View>
              <T size={13} color={colors.muted}>
                Plany: {u.plan_count} · Grupy: {u.groups.length ? u.groups.join(", ") : "brak"}
              </T>
              <View style={styles.actions}>
                <Button small variant="secondary" icon="key" title="Hasło" onPress={() => open({ type: "password", user: u })} testID={`admin-reset-password-${u.username}`} />
                <Button small variant="outline" icon="create-outline" title="Login" onPress={() => open({ type: "rename", user: u })} testID={`admin-rename-${u.username}`} />
                {u.id !== me?.id ? (
                  <>
                    <Button
                      small
                      variant="outline"
                      icon="shield-outline"
                      title={u.role === "admin" ? "Odbierz admina" : "Zrób adminem"}
                      onPress={() => toggleRole(u)}
                      testID={`admin-toggle-role-${u.username}`}
                    />
                    <Button small variant="danger" icon="trash-outline" title="Usuń" onPress={() => open({ type: "delete", user: u })} testID={`admin-delete-${u.username}`} />
                  </>
                ) : null}
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={groups.data ?? []}
          keyExtractor={(g) => g.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={groups.isRefetching} onRefresh={() => { groups.refetch(); }} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<EmptyState title={groups.isLoading ? "Ładowanie…" : groups.error ? "Brak dostępu" : "Brak grup"} />}
          renderItem={({ item: g }) => (
            <Card testID={`admin-group-${g.code}`} style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <T weight="heavy" size={17}>
                    {g.name}
                  </T>
                  <T size={13} color={colors.muted}>
                    Kod: {g.code} · {g.members.length} os.
                  </T>
                </View>
                <IconButton icon="trash-outline" color={colors.error} onPress={() => open({ type: "delete-group", group: g })} testID={`admin-delete-group-${g.code}`} />
              </View>
              {g.members.map((m) => (
                <View key={m.id} style={styles.memberRow}>
                  <T weight="bold" style={{ flex: 1 }}>
                    {m.username}
                  </T>
                  <IconButton icon="person-remove-outline" size={36} onPress={() => open({ type: "remove-member", group: g, member: m })} testID={`admin-remove-member-${g.code}-${m.username}`} />
                </View>
              ))}
            </Card>
          )}
        />
      )}
      <Sheet
        visible={!!action}
        onClose={() => setAction(null)}
        title={action ? titles[action.type] : ""}
        testID="admin-action-sheet"
        footer={
          <>
            <ErrorText msg={err} testID="admin-action-error" />
            <Button
              variant={action && action.type !== "password" && action.type !== "rename" ? "danger" : "primary"}
              title={action && action.type !== "password" && action.type !== "rename" ? "Usuń" : "Zapisz"}
              onPress={exec}
              loading={busy}
              testID="admin-action-confirm-button"
            />
          </>
        }
      >
        {action?.type === "password" || action?.type === "rename" ? (
          <>
            <T color={colors.muted}>Użytkownik: {action.user.username}</T>
            <Field
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              placeholder={action.type === "password" ? "Nowe hasło" : "Nowy login"}
              testID="admin-action-input"
            />
          </>
        ) : action?.type === "delete" ? (
          <T>Konto „{action.user.username}” i wszystkie jego plany zostaną usunięte.</T>
        ) : action?.type === "delete-group" ? (
          <T>Grupa „{action.group.name}” i jej spotkania zostaną usunięte. Plany członków zostają.</T>
        ) : action?.type === "remove-member" ? (
          <T>
            „{action.member.username}” zostanie usunięty(a) z grupy „{action.group.name}”.
          </T>
        ) : null}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  list: { paddingHorizontal: 16, gap: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 6 },
}));

import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { useToast } from "@/src/components/Toast";
import { Avatar, Badge, Button, Card, ErrorText, Field, T } from "@/src/components/ui";
import { useActiveGroup, useMembers } from "@/src/hooks";
import { makeStyles, useTheme } from "@/src/theme";

export default function Profile() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, signOut } = useAuth();
  const { group } = useActiveGroup();
  const { colorFor } = useMembers();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const changePw = async () => {
    if (!pw) return setErr("Wpisz nowe hasło");
    setBusy(true);
    setErr(null);
    try {
      await api("/auth/change-password", { method: "POST", body: { password: pw } });
      setPw("");
      toast("Hasło zmienione");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Profil" back />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Card style={styles.me}>
          <Avatar name={user.username} color={colorFor(user.id)} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <T weight="heavy" size={22} testID="profile-username">
              {user.username}
            </T>
            {user.role === "admin" ? <Badge label="Administrator" bg={colors.warning} fg={colors.onWarning} /> : null}
            {group ? (
              <T color={colors.muted} size={13}>
                Grupa: {group.name}
              </T>
            ) : null}
          </View>
        </Card>
        <Button variant="secondary" icon="people" title="Moje grupy" onPress={() => router.push("/groups")} testID="profile-groups-button" />
        {user.role === "admin" ? (
          <Button icon="shield-checkmark" title="Panel administratora" onPress={() => router.push("/admin")} testID="profile-admin-button" />
        ) : null}
        <Card style={{ gap: 12 }}>
          <T weight="heavy" size={17}>
            Zmień hasło
          </T>
          <Field value={pw} onChangeText={setPw} secureTextEntry placeholder="Nowe hasło" testID="profile-new-password-input" />
          <ErrorText msg={err} />
          <Button variant="outline" title="Zapisz hasło" onPress={changePw} loading={busy} testID="profile-change-password-button" />
        </Card>
        <Button
          variant="ghost"
          icon="log-out-outline"
          title="Wyloguj się"
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
          testID="profile-logout-button"
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 16, gap: 16 },
  me: { flexDirection: "row", alignItems: "center", gap: 16 },
}));

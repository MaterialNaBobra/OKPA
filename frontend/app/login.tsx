import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Button, ErrorText, Field, Segmented, T } from "@/src/components/ui";
import { makeStyles, useTheme, userColors } from "@/src/theme";

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return setErr("Podaj login i hasło");
    setBusy(true);
    setErr(null);
    try {
      await signIn(username.trim(), password, mode === "register");
      router.replace("/");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.blocks}>
          {userColors.slice(0, 5).map((c, i) => (
            <View key={c} style={[styles.block, { backgroundColor: c, height: 40 + ((i * 23) % 50), marginTop: (i * 17) % 30 }]} />
          ))}
        </View>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="calendar" size={30} color={colors.brandPrimary} />
            <T weight="heavy" size={36} testID="app-title">
              OKPA
            </T>
          </View>
          <T size={16} color={colors.muted}>
            Wspólny terminarz Twojej ekipy. Dodaj plany, znajdź wolne dni i umówcie się bez chaosu.
          </T>
        </View>
        <View style={styles.form}>
          <Segmented
            testID="auth-mode"
            value={mode}
            onChange={(v) => {
              setMode(v);
              setErr(null);
            }}
            options={[
              { value: "login", label: "Logowanie" },
              { value: "register", label: "Nowe konto" },
            ]}
          />
          <Field
            label="Login"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="np. kasia"
            testID="login-username-input"
          />
          <Field
            label="Hasło"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="dowolne hasło"
            onSubmitEditing={submit}
            testID="login-password-input"
          />
          <ErrorText msg={err} testID="login-error" />
          <Button
            title={mode === "login" ? "Zaloguj się" : "Utwórz konto"}
            onPress={submit}
            loading={busy}
            testID="login-submit-button"
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 24, gap: 24, flexGrow: 1, justifyContent: "flex-end" },
  blocks: { flexDirection: "row", gap: 10, alignItems: "flex-start", height: 110 },
  block: { flex: 1, borderRadius: 16 },
  form: { gap: 14 },
}));

import Ionicons from "@react-native-vector-icons/ionicons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { makeStyles, useTheme } from "@/src/theme";

export const fonts = { regular: "Nunito-400", bold: "Nunito-700", heavy: "Nunito-800" };

type Weight = "regular" | "bold" | "heavy";
export function T({
  weight = "regular",
  size = 14,
  color,
  style,
  ...rest
}: TextProps & { weight?: Weight; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fonts[weight], fontSize: size, color: color ?? colors.onSurface }, style]}
    />
  );
}

type BtnVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
  testID,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: BtnVariant;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  small?: boolean;
}) {
  const { colors } = useTheme();
  const map: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brandPrimary, fg: colors.onBrandPrimary },
    secondary: { bg: colors.brandSecondary, fg: colors.onBrandSecondary },
    danger: { bg: colors.error, fg: colors.onError },
    ghost: { bg: "transparent", fg: colors.onSurface },
    outline: { bg: "transparent", fg: colors.onSurface, border: colors.border },
  };
  const v = map[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: small ? 40 : 52,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: 999,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} /> : null}
          <T weight="heavy" size={small ? 13 : 15} color={v.fg}>
            {title}
          </T>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  testID,
  color,
  bg,
  size = 44,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  testID?: string;
  color?: string;
  bg?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg ?? colors.surfaceSecondary,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Ionicons name={icon} size={size * 0.45} color={color ?? colors.onSurface} />
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T weight="bold" size={13} color={colors.muted}>
          {label}
        </T>
      ) : null}
      <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, style]} />
    </View>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.seg} testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testID}-${o.value}`}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active && { backgroundColor: colors.surface }]}
          >
            <T weight="heavy" size={13} color={active ? colors.onSurface : colors.muted}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.surface,
      }}
    >
      <T weight="heavy" size={size * 0.42} color={colors.onSurface}>
        {name.slice(0, 1).toUpperCase()}
      </T>
    </View>
  );
}

export function Badge({ label, bg, fg }: { label: string; bg?: string; fg?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: bg ?? colors.brandTertiary,
        alignSelf: "flex-start",
      }}
    >
      <T weight="heavy" size={11} color={fg ?? colors.onBrandTertiary}>
        {label}
      </T>
    </View>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  testID,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  text?: string;
  action?: React.ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", padding: 24, gap: 12 }}>
      {icon ? (
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 32,
            backgroundColor: colors.brandTertiary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={48} color={colors.brandPrimary} />
        </View>
      ) : null}
      <T weight="heavy" size={18} style={{ textAlign: "center" }}>
        {title}
      </T>
      {text ? (
        <T size={14} color={colors.muted} style={{ textAlign: "center" }}>
          {text}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorText({ msg, testID }: { msg: string | null; testID?: string }) {
  const { colors } = useTheme();
  if (!msg) return null;
  return (
    <View testID={testID} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      <Ionicons name="alert-circle" size={16} color={colors.error} />
      <T weight="bold" size={13} color={colors.error} style={{ flex: 1 }}>
        {msg}
      </T>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  input: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 16,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.onSurface,
  },
  seg: {
    flexDirection: "row",
    backgroundColor: c.surfaceTertiary,
    borderRadius: 999,
    padding: 4,
  },
  segItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: c.divider,
  },
}));

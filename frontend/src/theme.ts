// Design tokens for this app. Light theme only.Always modify the colors and theme to Dark, Light or Dark and Light according to the design guidelines.
//
// The keys match the "color" block of /app/design_guidelines.json. Fill the
// values from that file (or from the user's brand colors). Keep every key; do
// not add a second theme or colors file; do not write color literals in
// components.
//
// How the names work: a plain key is a background, and its `on` partner is the
// text or icon color that sits on top of it. Always use them as a pair.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//     title: { color: colors.onSurfaceSecondary, fontSize: 16 },
//   }));
//   function Screen() {
//     const styles = useStyles();
//     return <View style={styles.card}><Text style={styles.title}>Hi</Text></View>;
//   }
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.
// Never call StyleSheet.create with color values at module level; it cannot
// follow the scheme.
//
// To support dark mode later: add `dark` to `themes` with every key filled.
// Nothing else changes; the device setting takes over automatically.
// Feel free to add as many new colors as you need to support the design guidelines.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FDFBF7",
  onSurface: "#1C1917",
  surfaceSecondary: "#F4F0E6",
  onSurfaceSecondary: "#292524",
  surfaceTertiary: "#E7E2D5",
  onSurfaceTertiary: "#292524",
  surfaceInverse: "#292524",
  onSurfaceInverse: "#FDFBF7",
  brand: "#22C55E",
  onBrand: "#022C22",
  brandPrimary: "#16A34A",
  onBrandPrimary: "#FDFBF7",
  brandSecondary: "#BBF7D0",
  onBrandSecondary: "#14532D",
  brandTertiary: "#DCFCE7",
  onBrandTertiary: "#166534",
  success: "#10B981",
  onSuccess: "#FFFFFF",
  warning: "#EAB308",
  onWarning: "#422006",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#64748B",
  onInfo: "#FFFFFF",
  border: "#D6D3D1",
  borderStrong: "#A8A29E",
  divider: "#E7E5E4",
  muted: "#78716C",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// In-app theme toggle, only after `dark` exists in `themes`. Call
// setColorScheme("dark"), setColorScheme("light"), or setColorScheme(null) to
// follow the device. Every useTheme() consumer re-renders. Persisting the
// choice and re-applying it on launch is the toggle's job.
export function setColorScheme(scheme: ColorScheme | null) {
  // RN 0.86 re-reads the device scheme only for the literal "unspecified";
  // null would pin useColorScheme() to null and the app to light.
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces (alerts, pickers, navigation chrome) on the schemes this
// app ships: light only forces light; once `dark` exists the device decides.
// Optional call because react-native-web does not implement it.
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}



// Identity colors for each group member (calendar rectangles). Same in every theme.
export const userColors = ["#FDE047", "#86EFAC", "#FCA5A5", "#FDBA74", "#D9F99D", "#5EEAD4", "#F9A8D4", "#FACC15", "#4ADE80", "#F87171", "#A3E635", "#2DD4BF"];
export const userColorFor = (index: number) => userColors[((index % userColors.length) + userColors.length) % userColors.length];

// Shared group-meeting block color in calendars (distinct from member colors). Same in every theme.
export const meetingColor = "#14532D";
export const onMeetingColor = "#FDFBF7";

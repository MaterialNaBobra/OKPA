import Ionicons from "@react-native-vector-icons/ionicons";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

type Toast = { msg: string; type: "ok" | "error" };
const Ctx = createContext<(msg: string, type?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const show = useCallback((msg: string, type: "ok" | "error" = "ok") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, type });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          entering={FadeInUp}
          exiting={FadeOutUp}
          pointerEvents="none"
          style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, alignItems: "center" }}
        >
          <View
            testID="toast-message"
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              backgroundColor: toast.type === "ok" ? colors.surfaceInverse : colors.error,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 999,
            }}
          >
            <Ionicons
              name={toast.type === "ok" ? "checkmark-circle" : "alert-circle"}
              size={18}
              color={toast.type === "ok" ? colors.brand : colors.onError}
            />
            <T weight="bold" color={toast.type === "ok" ? colors.onSurfaceInverse : colors.onError}>
              {toast.msg}
            </T>
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

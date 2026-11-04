import React from "react";
import { Modal, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton, T } from "@/src/components/ui";
import { makeStyles } from "@/src/theme";

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testID?: string;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} testID={`${testID}-backdrop`} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} testID={testID}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <T weight="heavy" size={20} style={{ flex: 1 }}>
              {title}
            </T>
            <IconButton icon="close" onPress={onClose} testID={`${testID}-close`} size={40} />
          </View>
          <KeyboardAwareScrollView
            bottomOffset={footer ? 96 : 24}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {children}
          </KeyboardAwareScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: "rgba(28,25,23,0.45)" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.surfaceTertiary, alignSelf: "center", marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
}));

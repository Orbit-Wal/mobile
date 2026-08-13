import { StyleSheet, Text, View } from "react-native";
import { useAppStateRedaction } from "@/hooks/useAppStateRedaction";

export function AppStateOverlay() {
  const redacted = useAppStateRedaction();

  if (!redacted) return null;

  return (
    <View style={styles.overlay}>
      <Text style={styles.brand}>GlobeWallet</Text>
      <Text style={styles.message}>Return to the app to continue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f172a",
    zIndex: 9999,
    elevation: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#f8fafc", fontSize: 24, fontWeight: "700" },
  message: { color: "#94a3b8", fontSize: 14, marginTop: 12 },
});

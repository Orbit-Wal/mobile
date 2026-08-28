import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useSendIntentStore } from "@/store/sendIntentStore";
import { validateScannedInput } from "@/utils/scannedInput";

// QR scan-to-send (issue #15). Scanned text is never trusted directly --
// every payload goes through validateScannedInput() (same contract the
// SEP-7 deep link handler in app/_layout.tsx uses) before it's allowed
// anywhere near the send form. An invalid payload just shows an inline
// error and keeps scanning; it's never partially applied.
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);
  const setPending = useSendIntentStore((s) => s.setPending);

  const handleScanned = (result: { data: string }) => {
    if (handled) return; // ignore extra frames while we're already navigating away
    const validated = validateScannedInput(result.data);
    if (validated.kind === "invalid") {
      setError(validated.reason);
      return;
    }
    setHandled(true);
    setError(null);
    setPending(validated);
    router.back();
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.subtitle}>
          GlobeWallet needs camera access to scan Stellar addresses and payment QR codes.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission} accessibilityRole="button">
          <Text style={styles.buttonText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>Scan a Stellar address or payment QR code</Text>
        {error && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  title: { fontSize: 24, fontWeight: "bold", color: "#f8fafc", marginTop: 64, marginHorizontal: 24 },
  subtitle: { fontSize: 14, color: "#94a3b8", marginTop: 12, marginHorizontal: 24, lineHeight: 20 },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 64,
  },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "#3b82f6",
    borderRadius: 16,
    marginBottom: 200,
  },
  hint: { color: "#f8fafc", fontSize: 14, marginBottom: 12, textAlign: "center", paddingHorizontal: 24 },
  error: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: "rgba(15,23,42,0.85)",
    padding: 8,
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 32,
    marginHorizontal: 24,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelButton: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24 },
  cancelButtonText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
});

import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { copyWithAutoClear } from "@/utils/clipboard";
import { generateMnemonic, deriveKeypairFromMnemonic } from "@/services/hdWallet";
import { saveSecretKey, checkSecurityAndWarn } from "@/services/secureStorage";
import { usePendingBackupStore } from "@/store/pendingBackupStore";
import { useScreenCaptureProtection } from "@/hooks/useScreenCaptureProtection";
import { StellarServiceError } from "@/services/stellar";

// Issue #9: BIP-39/SEP-5 mnemonic onboarding, the recommended default path
// alongside the raw-secret create.tsx flow (which stays fully supported).
export default function CreateMnemonicWalletScreen() {
  useScreenCaptureProtection();
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    if (saving) return;
    setSaving(true);

    const isSecure = await checkSecurityAndWarn();
    if (!isSecure) {
      setSaving(false);
      return;
    }

    try {
      const phrase = generateMnemonic(128);
      const keypair = deriveKeypairFromMnemonic(phrase, 0);
      await saveSecretKey(keypair.secret());
      setMnemonic(phrase);
      setPublicKey(keypair.publicKey());
    } catch (err) {
      if (err instanceof StellarServiceError && err.code === "ENTROPY_UNAVAILABLE") {
        Alert.alert(
          "Cannot Create Wallet Securely",
          "This device is missing a secure random number source, so a new recovery phrase can't be safely generated here."
        );
      } else if (err instanceof Error && err.message.startsWith("SECRET_ALREADY_EXISTS")) {
        Alert.alert(
          "Wallet Already Exists",
          "A wallet is already stored on this device. Reset your existing wallet before creating a new one."
        );
      } else {
        Alert.alert("Error", "Could not securely store your key. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    if (!publicKey || !mnemonic) return;
    usePendingBackupStore.getState().set({ mode: "mnemonic", value: mnemonic, publicKey });
    router.push("/auth/verify-backup");
  };

  const handleCopy = async () => {
    if (!mnemonic) return;
    await copyWithAutoClear(mnemonic);
    Alert.alert("Copied", "Recovery phrase copied to clipboard. It will auto-clear in 45 seconds.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create with Recovery Phrase</Text>
      {!mnemonic ? (
        <>
          <Text style={styles.subtitle}>
            We'll generate a new 12-word BIP-39 recovery phrase on this device (SEP-5 derivation
            path m/44'/148'/0'). The phrase never leaves your device.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleGenerate}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Generate Recovery Phrase"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate Recovery Phrase</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.warning}>
            Write these 12 words down in order and store them somewhere safe. Anyone with this
            phrase can access your funds.
          </Text>
          <View style={styles.wordGrid}>
            {mnemonic.split(" ").map((word, i) => (
              <View key={i} style={styles.wordChip}>
                <Text style={styles.wordIndex}>{i + 1}</Text>
                <Text style={styles.wordText}>{word}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel="Copy Recovery Phrase"
          >
            <Text style={styles.buttonTextSecondary}>Copy Phrase</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleContinue} accessibilityRole="button" accessibilityLabel="Continue">
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f8fafc", marginBottom: 16, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginBottom: 32, lineHeight: 20 },
  warning: { color: "#fbbf24", fontSize: 12, textAlign: "center", marginBottom: 16, lineHeight: 18 },
  wordGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 24 },
  wordChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    margin: 4,
    minWidth: "28%",
  },
  wordIndex: { color: "#64748b", fontSize: 11, marginRight: 6 },
  wordText: { color: "#f8fafc", fontFamily: "monospace", fontSize: 13 },
  button: {
    width: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#3b82f6" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: "#3b82f6", fontSize: 16, fontWeight: "600" },
});

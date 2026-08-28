import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { copyWithAutoClear } from "@/utils/clipboard";
import { generateKeypair, StellarServiceError } from "@/services/stellar";
import { saveSecretKey, checkSecurityAndWarn } from "@/services/secureStorage";
import { usePendingBackupStore } from "@/store/pendingBackupStore";
import { useScreenCaptureProtection } from "@/hooks/useScreenCaptureProtection";

export default function CreateWalletScreen() {
  useScreenCaptureProtection();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [secretRevealed, setSecretRevealed] = useState(false);
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
      const keypair = generateKeypair();
      await saveSecretKey(keypair.secret());
      setPublicKey(keypair.publicKey());
      setSecret(keypair.secret());
    } catch (err) {
      if (err instanceof StellarServiceError && err.code === "ENTROPY_UNAVAILABLE") {
        Alert.alert(
          "Cannot Create Wallet Securely",
          "This device is missing a secure random number source, so a new key cannot be safely generated here. Please restart the app; if this persists, do not import funds into a key generated on this device."
        );
      } else if (err instanceof Error && err.message.startsWith("SECRET_ALREADY_EXISTS")) {
        Alert.alert(
          "Wallet Already Exists",
          "A wallet is already stored on this device. Reset your existing wallet before creating a new one, or import a different key instead."
        );
      } else {
        Alert.alert("Error", "Could not securely store your key. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    // Issue #10: creation no longer grants access on its own -- it hands off
    // to a backup-verification step first. completeOnboarding() (which
    // actually flips isOnboarded) now happens in verify-backup.tsx, once the
    // user has proven (or explicitly, riskily declined to prove) they saved
    // this secret.
    if (!publicKey || !secret) return;
    usePendingBackupStore.getState().set({ mode: "secret", value: secret, publicKey });
    router.push("/auth/verify-backup");
  };

  const handleCopy = async () => {
    if (!publicKey) return;
    await copyWithAutoClear(publicKey);
    Alert.alert("Copied", "Public key copied to clipboard. It will auto-clear in 45 seconds.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Wallet</Text>
      {!publicKey ? (
        <>
          <Text style={styles.subtitle}>
            We'll generate a new Stellar keypair on this device. The secret key never leaves your
            device and is stored in secure hardware-backed storage.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleGenerate}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Generate Keypair"
            accessibilityState={{ disabled: saving, busy: saving }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Generate Keypair</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>Your new public address:</Text>
          <Text style={styles.address} selectable accessibilityLabel={`Public address ${publicKey}`}>
            {publicKey}
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel="Copy Address"
          >
            <Text style={styles.buttonTextSecondary}>Copy Address</Text>
          </TouchableOpacity>

          <Text style={styles.warning}>
            Before continuing, write down your secret key. It's the only way to recover this
            wallet -- GlobeWallet cannot recover it for you.
          </Text>
          <TouchableOpacity
            style={styles.revealBox}
            onPress={() => setSecretRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={secretRevealed ? "Hide secret key" : "Reveal secret key"}
          >
            <Text style={styles.secretText} selectable={secretRevealed}>
              {secretRevealed ? secret : "•".repeat(20) + "  (tap to reveal)"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#f8fafc", marginBottom: 16 },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginBottom: 32 },
  address: {
    fontSize: 13,
    color: "#f8fafc",
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    fontFamily: "monospace",
  },
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
  warning: { color: "#fbbf24", fontSize: 12, textAlign: "center", marginBottom: 12, lineHeight: 18 },
  revealBox: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  secretText: { color: "#f8fafc", fontFamily: "monospace", fontSize: 13, textAlign: "center" },
});

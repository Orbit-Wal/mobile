import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { generateKeypair } from "@/services/stellar";
import { saveSecretKey, checkSecurityAndWarn } from "@/services/secureStorage";
import { useWalletStore } from "@/store/walletStore";
import { useScreenCaptureProtection } from "@/hooks/useScreenCaptureProtection";

export default function CreateWalletScreen() {
  useScreenCaptureProtection();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setStorePublicKey = useWalletStore((s) => s.setPublicKey);
  const setOnboarded = useWalletStore((s) => s.setOnboarded);

  const handleGenerate = async () => {
    const isSecure = await checkSecurityAndWarn();
    if (!isSecure) return;

    const keypair = generateKeypair();
    setSaving(true);
    try {
      await saveSecretKey(keypair.secret());
      setPublicKey(keypair.publicKey());
    } catch {
      Alert.alert("Error", "Could not securely store your key. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    if (!publicKey) return;
    setStorePublicKey(publicKey);
    setOnboarded(true);
    router.replace("/tabs/home");
  };

  const handleCopy = async () => {
    if (!publicKey) return;
    await Clipboard.setStringAsync(publicKey);
    Alert.alert("Copied", "Public key copied to clipboard.");
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
          <TouchableOpacity style={styles.button} onPress={handleGenerate} disabled={saving}>
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
          <Text style={styles.address} selectable>
            {publicKey}
          </Text>
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleCopy}>
            <Text style={styles.buttonTextSecondary}>Copy Address</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleContinue}>
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
});

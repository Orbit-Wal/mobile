import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { validateMnemonic, deriveKeypairFromMnemonic } from "@/services/hdWallet";
import { saveSecretKey, checkSecurityAndWarn } from "@/services/secureStorage";
import { useWalletStore } from "@/store/walletStore";
import { useScreenCaptureProtection } from "@/hooks/useScreenCaptureProtection";

// Issue #9: import path for a BIP-39/SEP-5 recovery phrase, alongside the
// existing raw-secret import.tsx. No backup-verification gate here (unlike
// create-mnemonic.tsx) -- the user is typing in a phrase they already
// possess, so there's nothing new to confirm they've backed up.
export default function ImportMnemonicScreen() {
  useScreenCaptureProtection();
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const completeOnboarding = useWalletStore((s) => s.completeOnboarding);

  const handleImport = async () => {
    const isSecure = await checkSecurityAndWarn();
    if (!isSecure) return;

    const trimmed = phrase.trim();
    if (!validateMnemonic(trimmed)) {
      Alert.alert("Invalid Recovery Phrase", "That doesn't look like a valid BIP-39 recovery phrase. Check the word order and spelling.");
      return;
    }

    setLoading(true);
    try {
      const keypair = deriveKeypairFromMnemonic(trimmed, 0);
      await saveSecretKey(keypair.secret());
      await completeOnboarding(keypair.publicKey());
      setPhrase("");
      router.replace("/tabs/home");
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("SECRET_ALREADY_EXISTS")) {
        Alert.alert("Wallet Already Exists", "A wallet is already stored on this device. Reset it before importing a different one.");
      } else {
        Alert.alert("Error", "Could not securely store your key. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import with Recovery Phrase</Text>
      <Text style={styles.subtitle}>Enter your existing BIP-39 recovery phrase (12 or 24 words).</Text>
      <TextInput
        style={styles.input}
        placeholder="word1 word2 word3 ..."
        placeholderTextColor="#64748b"
        value={phrase}
        onChangeText={setPhrase}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        accessibilityLabel="Recovery phrase"
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleImport}
        disabled={loading || phrase.trim().length === 0}
        accessibilityRole="button"
        accessibilityLabel="Import"
        accessibilityState={{ disabled: loading || phrase.trim().length === 0, busy: loading }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Import</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f8fafc", marginBottom: 16, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginBottom: 32 },
  input: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "#f8fafc",
    marginBottom: 24,
    minHeight: 100,
  },
  button: { width: "100%", backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

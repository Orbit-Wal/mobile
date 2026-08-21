import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import * as StellarSdk from "@stellar/stellar-sdk";
import { saveSecretKey, checkSecurityAndWarn } from "@/services/secureStorage";
import { useWalletStore } from "@/store/walletStore";
import { useScreenCaptureProtection } from "@/hooks/useScreenCaptureProtection";

export default function ImportWalletScreen() {
  useScreenCaptureProtection();
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const completeOnboarding = useWalletStore((s) => s.completeOnboarding);

  const handleImport = async () => {
    const isSecure = await checkSecurityAndWarn();
    if (!isSecure) return;

    const trimmed = secret.trim();
    let keypair: StellarSdk.Keypair;
    try {
      keypair = StellarSdk.Keypair.fromSecret(trimmed);
    } catch {
      Alert.alert(
        "Invalid Secret Key",
        "That doesn't look like a valid Stellar secret key (should start with 'S')."
      );
      return;
    }
    setLoading(true);
    try {
      await saveSecretKey(trimmed);
      await completeOnboarding(keypair.publicKey());
      // Drop our references so the secret isn't still sitting in this
      // component's state/closures (and thus the TextInput's rendered
      // value) after it's already durably persisted in SecureStore. JS
      // strings are immutable and the engine's GC timing isn't
      // controllable, so this bounds *how long we hold a reference*, not a
      // true memory wipe -- see the note on stellar.ts's sendPayment for
      // the same caveat on the signing path.
      setSecret("");
      router.replace("/tabs/home");
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("SECRET_ALREADY_EXISTS")) {
        Alert.alert(
          "Wallet Already Exists",
          "A wallet is already stored on this device. Reset your existing wallet before importing a different one."
        );
      } else {
        Alert.alert("Error", "Could not securely store your key. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import Wallet</Text>
      <Text style={styles.subtitle}>
        Enter your existing Stellar secret key. It will be encrypted and stored only on this
        device.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="S..."
        placeholderTextColor="#64748b"
        value={secret}
        onChangeText={setSecret}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        multiline
        accessibilityLabel="Stellar secret key"
        accessibilityHint="Enter your existing secret key starting with S"
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleImport}
        disabled={loading || secret.trim().length === 0}
        accessibilityRole="button"
        accessibilityLabel="Import"
        accessibilityState={{ disabled: loading || secret.trim().length === 0, busy: loading }}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Import</Text>}
      </TouchableOpacity>
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
  input: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "#f8fafc",
    marginBottom: 24,
    minHeight: 80,
    fontFamily: "monospace",
  },
  button: {
    width: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

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
  const setStorePublicKey = useWalletStore((s) => s.setPublicKey);
  const setOnboarded = useWalletStore((s) => s.setOnboarded);

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
      setStorePublicKey(keypair.publicKey());
      setOnboarded(true);
      router.replace("/tabs/home");
    } catch {
      Alert.alert("Error", "Could not securely store your key. Please try again.");
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
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleImport}
        disabled={loading || secret.trim().length === 0}
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

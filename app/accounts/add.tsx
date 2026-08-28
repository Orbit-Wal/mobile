import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import * as StellarSdk from "@stellar/stellar-sdk";
import { generateKeypair, StellarServiceError } from "@/services/stellar";
import { saveSecretKeyForAccount, checkSecurityAndWarn } from "@/services/secureStorage";
import { useWalletStore } from "@/store/walletStore";

// Adds a second (or Nth) account (issue #18). Deliberately a single compact
// screen covering both generate-new and import-existing, rather than
// mirroring the two-screen onboarding flow -- this is a secondary/settings
// action, not first-run onboarding.
export default function AddAccountScreen() {
  const [label, setLabel] = useState("");
  const [importSecret, setImportSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const addAccount = useWalletStore((s) => s.addAccount);
  const switchAccount = useWalletStore((s) => s.switchAccount);

  const persistAndSwitch = async (keypair: StellarSdk.Keypair) => {
    const trimmedLabel = label.trim() || "Account";
    const id = Crypto.randomUUID();
    await saveSecretKeyForAccount(id, keypair.secret());
    await addAccount({ id, publicKey: keypair.publicKey(), label: trimmedLabel });
    await switchAccount(id);
    router.back();
  };

  const handleGenerate = async () => {
    setBusy(true);
    const isSecure = await checkSecurityAndWarn();
    if (!isSecure) {
      setBusy(false);
      return;
    }
    try {
      const keypair = generateKeypair();
      await persistAndSwitch(keypair);
    } catch (err) {
      if (err instanceof StellarServiceError && err.code === "ENTROPY_UNAVAILABLE") {
        Alert.alert("Cannot Create Account Securely", "This device is missing a secure random number source.");
      } else {
        Alert.alert("Error", "Could not create the account. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    const trimmed = importSecret.trim();
    let keypair: StellarSdk.Keypair;
    try {
      keypair = StellarSdk.Keypair.fromSecret(trimmed);
    } catch {
      Alert.alert("Invalid Secret Key", "That doesn't look like a valid Stellar secret key (should start with 'S').");
      return;
    }
    setBusy(true);
    try {
      await persistAndSwitch(keypair);
      setImportSecret("");
    } catch {
      Alert.alert("Error", "Could not import the account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Account</Text>
      <Text style={styles.fieldLabel}>Label</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Testnet, Savings"
        placeholderTextColor="#64748b"
        value={label}
        onChangeText={setLabel}
      />

      <TouchableOpacity style={styles.button} onPress={handleGenerate} disabled={busy} accessibilityRole="button" accessibilityLabel="Generate New Account">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate New Account</Text>}
      </TouchableOpacity>

      <Text style={styles.divider}>— or import an existing secret key —</Text>
      <TextInput
        style={[styles.input, styles.keyInput]}
        placeholder="S..."
        placeholderTextColor="#64748b"
        value={importSecret}
        onChangeText={setImportSecret}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        multiline
      />
      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={handleImport}
        disabled={busy || importSecret.trim().length === 0}
        accessibilityRole="button"
        accessibilityLabel="Import Account"
      >
        <Text style={styles.buttonTextSecondary}>Import Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 64 },
  title: { fontSize: 28, fontWeight: "bold", color: "#f8fafc", marginBottom: 24 },
  fieldLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  input: { width: "100%", backgroundColor: "#1e293b", borderRadius: 12, padding: 16, color: "#f8fafc", marginBottom: 16 },
  keyInput: { fontFamily: "monospace", minHeight: 70 },
  divider: { color: "#64748b", fontSize: 12, textAlign: "center", marginVertical: 16 },
  button: { width: "100%", backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 8 },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#3b82f6" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: "#3b82f6", fontSize: 16, fontWeight: "600" },
});

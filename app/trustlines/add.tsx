import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as StellarSdk from "@stellar/stellar-sdk";
import { addTrustline, StellarServiceError } from "@/services/stellar";
import { getSecretKeyForAccount } from "@/services/secureStorage";
import { useWalletStore } from "@/store/walletStore";

// Add-trustline flow (issue #26). Surfaces the ~0.5 XLM reserve-cost warning
// via a confirmation dialog *before* submission, per the issue's DoD.
export default function AddTrustlineScreen() {
  const [assetCode, setAssetCode] = useState("");
  const [assetIssuer, setAssetIssuer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const activeAccountId = useWalletStore((s) => s.activeAccountId);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (!activeAccountId) throw new Error("No active account.");
      const secret = await getSecretKeyForAccount(activeAccountId);
      if (!secret) throw new Error("No secret found for the active account.");
      await addTrustline({ sourceSecretKey: secret, assetCode: assetCode.trim(), assetIssuer: assetIssuer.trim() });
      Alert.alert("Trustline Added", `You can now hold ${assetCode.trim()}.`, [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      const message = err instanceof StellarServiceError ? err.message : "Could not add this trustline. Please try again.";
      Alert.alert("Couldn't Add Trustline", message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const trimmedCode = assetCode.trim();
    const trimmedIssuer = assetIssuer.trim();
    if (trimmedCode.length === 0 || trimmedCode.length > 12) {
      Alert.alert("Invalid Asset Code", "Asset code must be 1-12 characters.");
      return;
    }
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(trimmedIssuer)) {
      Alert.alert("Invalid Issuer", "That doesn't look like a valid Stellar issuer address (should start with 'G').");
      return;
    }
    Alert.alert(
      "Reserve Cost",
      `Adding a trustline for ${trimmedCode} will reserve approximately 0.5 XLM from your account balance until the trustline is removed. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: submit },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Trustline</Text>
      <Text style={styles.subtitle}>Establish a trustline so this account can hold a non-native asset.</Text>

      <Text style={styles.fieldLabel}>Asset Code</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. USDC"
        placeholderTextColor="#64748b"
        value={assetCode}
        onChangeText={setAssetCode}
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel="Asset code"
      />

      <Text style={styles.fieldLabel}>Issuer Address</Text>
      <TextInput
        style={[styles.input, styles.issuerInput]}
        placeholder="G..."
        placeholderTextColor="#64748b"
        value={assetIssuer}
        onChangeText={setAssetIssuer}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        accessibilityLabel="Issuer address"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Add Trustline"
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add Trustline</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 64 },
  title: { fontSize: 28, fontWeight: "bold", color: "#f8fafc", marginBottom: 16 },
  subtitle: { fontSize: 14, color: "#94a3b8", marginBottom: 32, lineHeight: 20 },
  fieldLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  input: { width: "100%", backgroundColor: "#1e293b", borderRadius: 12, padding: 16, color: "#f8fafc", marginBottom: 20 },
  issuerInput: { fontFamily: "monospace", minHeight: 70 },
  button: { width: "100%", backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

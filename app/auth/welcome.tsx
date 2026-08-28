import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🌐</Text>
      <Text style={styles.title}>GlobeWallet</Text>
      <Text style={styles.subtitle}>Your gateway to the Stellar network</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/auth/create-mnemonic")}
        accessibilityRole="button"
        accessibilityLabel="Create Wallet with Recovery Phrase"
        accessibilityHint="Generates a new 12-word BIP-39 recovery phrase on this device"
      >
        <Text style={styles.buttonText}>Create Wallet</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => router.push("/auth/import-mnemonic")}
        accessibilityRole="button"
        accessibilityLabel="Import Wallet with Recovery Phrase"
        accessibilityHint="Enter an existing BIP-39 recovery phrase"
      >
        <Text style={styles.buttonTextSecondary}>Import Wallet</Text>
      </TouchableOpacity>

      <Text style={styles.divider}>— advanced: raw secret key —</Text>

      <TouchableOpacity
        style={[styles.button, styles.buttonTertiary]}
        onPress={() => router.push("/auth/create")}
        accessibilityRole="button"
        accessibilityLabel="Create Wallet with Raw Secret Key"
        accessibilityHint="Generates a new Stellar keypair on this device without a recovery phrase"
      >
        <Text style={styles.buttonTextTertiary}>Create with Raw Key</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonTertiary]}
        onPress={() => router.push("/auth/import")}
        accessibilityRole="button"
        accessibilityLabel="Import Wallet with Raw Secret Key"
        accessibilityHint="Enter an existing Stellar secret key"
      >
        <Text style={styles.buttonTextTertiary}>Import with Raw Key</Text>
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
  logo: { fontSize: 64, marginBottom: 16 },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 48,
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
  divider: { color: "#64748b", fontSize: 12, marginVertical: 16 },
  buttonTertiary: { backgroundColor: "transparent", paddingVertical: 10, marginBottom: 4 },
  buttonTextTertiary: { color: "#64748b", fontSize: 14, fontWeight: "500" },
});

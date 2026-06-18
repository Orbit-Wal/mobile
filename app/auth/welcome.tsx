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
        onPress={() => router.push("/auth/create")}
      >
        <Text style={styles.buttonText}>Create Wallet</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => router.push("/auth/import")}
      >
        <Text style={styles.buttonTextSecondary}>Import Wallet</Text>
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
});

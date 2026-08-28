import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { useNetworkStore } from "@/store/networkStore";
import type { NetworkId } from "@/types";

// Issue #19: this is the one runtime control for network selection. It
// intentionally reads/writes useNetworkStore (the session model), not any
// module-level constant, and setNetwork() itself takes care of
// invalidating any offline-queued payments signed under the network being
// left (see networkStore.ts + services/paymentQueue.ts).
export default function SettingsScreen() {
  const network = useNetworkStore((s) => s.network);
  const hydrated = useNetworkStore((s) => s.hydrated);
  const hydrate = useNetworkStore((s) => s.hydrate);
  const setNetwork = useNetworkStore((s) => s.setNetwork);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const confirmSwitch = (target: NetworkId) => {
    if (target === network) return;

    if (target === "mainnet") {
      Alert.alert(
        "Switch to Mainnet?",
        "Mainnet uses real XLM and real funds. Any pending offline payment signed for Testnet will be discarded, not resent on Mainnet. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Switch to Mainnet", style: "destructive", onPress: () => setNetwork(target) },
        ]
      );
      return;
    }

    Alert.alert(
      "Switch to Testnet?",
      "Any pending offline payment signed for Mainnet will be discarded, not resent on Testnet.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Switch to Testnet", onPress: () => setNetwork(target) },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Network
        </Text>
        <Text style={styles.sectionSubtitle}>
          Choose which Stellar network GlobeWallet talks to. This affects the address balances
          shown, and where any payment you send is broadcast.
        </Text>

        {(["testnet", "mainnet"] as const).map((id) => {
          const selected = network === id;
          const label = id === "testnet" ? "Testnet" : "Mainnet";
          const description =
            id === "testnet"
              ? "For development and testing. XLM here has no real value."
              : "Live network. Transactions use real funds and cannot be undone.";
          return (
            <TouchableOpacity
              key={id}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => confirmSwitch(id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${label} network`}
              accessibilityHint={description}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{label}</Text>
                <Text style={styles.optionDescription}>{description}</Text>
              </View>
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { flexDirection: "row", alignItems: "center", padding: 24, paddingTop: 48 },
  backButton: { marginRight: 12 },
  backText: { color: "#3b82f6", fontSize: 16, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "bold", color: "#f8fafc" },
  section: { padding: 24 },
  sectionTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "600", marginBottom: 8 },
  sectionSubtitle: { color: "#94a3b8", fontSize: 13, lineHeight: 18, marginBottom: 16 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionSelected: { borderColor: "#3b82f6" },
  optionLabel: { color: "#f8fafc", fontWeight: "600", fontSize: 15, marginBottom: 4 },
  optionDescription: { color: "#64748b", fontSize: 12, lineHeight: 16 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#475569",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioOuterSelected: { borderColor: "#3b82f6" },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#3b82f6" },
});

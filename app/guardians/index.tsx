import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { useGuardianStore } from "@/store/guardianStore";

export default function GuardiansScreen() {
  const { guardians, recoveryConfig, hydrated, hydrate, removeGuardian } = useGuardianStore();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const handleRemove = (publicKey: string, label: string) => {
    Alert.alert("Remove Guardian", `Remove ${label} as a guardian?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusyKey(publicKey);
          try {
            await removeGuardian(publicKey);
          } catch (e) {
            Alert.alert("Can't remove guardian", e instanceof Error ? e.message : "Unknown error");
          } finally {
            setBusyKey(null);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Guardians & Recovery</Text>
        <Text style={styles.subtitle}>
          If you lose this device, {recoveryConfig ? recoveryConfig.threshold : "enough"} of your
          guardians can help you recover access. Read how this works before enabling it.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Recovery status</Text>
        <Text style={styles.statusValue}>
          {recoveryConfig?.enabledAt
            ? `Enabled — ${recoveryConfig.threshold} of ${guardians.length} guardians required`
            : "Not enabled"}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Guardians ({guardians.length})</Text>
          <TouchableOpacity onPress={() => router.push("/guardians/add")}>
            <Text style={styles.link}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {guardians.length === 0 ? (
          <Text style={styles.empty}>
            No guardians yet. Add at least 3 people you trust before you can enable recovery.
          </Text>
        ) : (
          guardians.map((g) => (
            <View key={g.publicKey} style={styles.guardianRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.guardianLabel}>{g.label}</Text>
                <Text style={styles.guardianKey} numberOfLines={1}>
                  {g.publicKey}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRemove(g.publicKey, g.label)}
                disabled={busyKey === g.publicKey}
              >
                <Text style={styles.removeLink}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push("/guardians/config")}>
        <Text style={styles.buttonText}>
          {recoveryConfig?.enabledAt ? "Update Recovery Settings" : "Enable Recovery"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => router.push("/guardians/recover")}
      >
        <Text style={styles.buttonTextSecondary}>I'm a Guardian Helping Someone Recover</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/guardians/status")} style={styles.statusLink}>
        <Text style={styles.link}>View on-chain signer status</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { padding: 24, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f8fafc", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#94a3b8", lineHeight: 20 },
  statusCard: {
    marginHorizontal: 24,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  statusLabel: { color: "#64748b", fontSize: 12, marginBottom: 4 },
  statusValue: { color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  section: { padding: 24 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "600" },
  link: { color: "#3b82f6", fontWeight: "600" },
  empty: { color: "#64748b", lineHeight: 20 },
  guardianRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  guardianLabel: { color: "#f8fafc", fontWeight: "600", marginBottom: 4 },
  guardianKey: { color: "#64748b", fontFamily: "monospace", fontSize: 11 },
  removeLink: { color: "#f87171", marginLeft: 12 },
  button: {
    marginHorizontal: 24,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#3b82f6" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: "#3b82f6", fontSize: 15, fontWeight: "600" },
  statusLink: { alignItems: "center", marginBottom: 24 },
});

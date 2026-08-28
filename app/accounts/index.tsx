import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useWalletStore } from "@/store/walletStore";

// Minimal account-switcher UI (issue #18 DoD: "UI for account switching,
// even if minimal").
export default function AccountsScreen() {
  const { accounts, activeAccountId, switchAccount, removeAccount } = useWalletStore();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleSwitch = async (id: string) => {
    if (id === activeAccountId) return;
    setBusyId(id);
    try {
      await switchAccount(id);
      router.back();
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = (id: string, label: string) => {
    Alert.alert("Remove Account", `Remove "${label}" from this device? Make sure you've backed up its key first.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusyId(id);
          try {
            await removeAccount(id);
          } catch (e) {
            Alert.alert("Can't remove account", e instanceof Error ? e.message : "Unknown error");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Accounts</Text>
        <Text style={styles.subtitle}>Switch between wallets stored on this device.</Text>
      </View>

      {accounts.map((a) => (
        <TouchableOpacity
          key={a.id}
          style={[styles.row, a.id === activeAccountId && styles.rowActive]}
          onPress={() => handleSwitch(a.id)}
          disabled={busyId === a.id}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${a.label}`}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>
              {a.label} {a.id === activeAccountId ? "(active)" : ""}
            </Text>
            <Text style={styles.rowKey} numberOfLines={1}>
              {a.publicKey}
            </Text>
          </View>
          {busyId === a.id ? (
            <ActivityIndicator color="#f8fafc" />
          ) : (
            <TouchableOpacity
              onPress={() => handleRemove(a.id, a.label)}
              disabled={accounts.length <= 1}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${a.label}`}
            >
              <Text style={[styles.removeLink, accounts.length <= 1 && styles.removeLinkDisabled]}>Remove</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.button} onPress={() => router.push("/accounts/add")} accessibilityRole="button" accessibilityLabel="Add Account">
        <Text style={styles.buttonText}>+ Add Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { padding: 24, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f8fafc", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#94a3b8" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  rowActive: { borderWidth: 1, borderColor: "#3b82f6" },
  rowLabel: { color: "#f8fafc", fontWeight: "600", marginBottom: 4 },
  rowKey: { color: "#64748b", fontFamily: "monospace", fontSize: 11 },
  removeLink: { color: "#f87171", marginLeft: 12 },
  removeLinkDisabled: { color: "#475569" },
  button: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 32,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

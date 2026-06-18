import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning 👋</Text>
        <Text style={styles.walletLabel}>Total Balance</Text>
        <Text style={styles.balance}>$0.00</Text>
      </View>
      <View style={styles.actions}>
        {["Send", "Receive", "Swap", "Buy"].map((action) => (
          <TouchableOpacity key={action} style={styles.actionBtn}>
            <Text style={styles.actionText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <Text style={styles.empty}>No transactions yet</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { padding: 24, paddingTop: 64, alignItems: "center" },
  greeting: { color: "#94a3b8", fontSize: 14, marginBottom: 8 },
  walletLabel: { color: "#64748b", fontSize: 12, marginBottom: 4 },
  balance: { color: "#f8fafc", fontSize: 40, fontWeight: "bold" },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 24,
  },
  actionBtn: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  actionText: { color: "#f8fafc", fontWeight: "600", fontSize: 13 },
  section: { padding: 24 },
  sectionTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "600", marginBottom: 12 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 16 },
});

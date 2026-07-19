import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { getBalances } from "@/services/stellar";
import { useWalletStore } from "@/store/walletStore";
import { Link } from "expo-router";

export default function HomeScreen() {
  const publicKey = useWalletStore((s) => s.publicKey);
  const balances = useWalletStore((s) => s.balances);
  const setBalances = useWalletStore((s) => s.setBalances);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await getBalances(publicKey);
      setBalances(result);
    } catch {
      // Unfunded testnet accounts 404 on Horizon until the first incoming payment.
      setError("Could not load balances. Account may not be funded yet.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [publicKey, setBalances]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleAction = (action: string) => {
    Alert.alert(action, `${action} is coming soon.`);
  };

  const xlmBalance = balances["XLM"];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f8fafc" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning 👋</Text>
        <Text style={styles.walletLabel}>Total Balance</Text>
        {loading ? (
          <ActivityIndicator color="#f8fafc" style={{ marginTop: 12 }} />
        ) : (
          <Text style={styles.balance}>{xlmBalance ? `${xlmBalance} XLM` : "0.00 XLM"}</Text>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
      <View style={styles.actions}>
        {["Send", "Receive", "Swap", "Buy"].map((action) => (
          <TouchableOpacity key={action} style={styles.actionBtn} onPress={() => handleAction(action)}>
            <Text style={styles.actionText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Link href="/chat" asChild>
        <TouchableOpacity style={styles.assistantLink}>
          <Text style={styles.assistantTitle}>Code Assistant</Text>
          <Text style={styles.assistantCopy}>Ask coding questions, review snippets, and get suggestions.</Text>
        </TouchableOpacity>
      </Link>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Balances</Text>
        {Object.keys(balances).length === 0 && !loading ? (
          <Text style={styles.empty}>No balances yet</Text>
        ) : (
          Object.entries(balances).map(([asset, amount]) => (
            <View key={asset} style={styles.balanceRow}>
              <Text style={styles.balanceAsset}>{asset}</Text>
              <Text style={styles.balanceAmount}>{amount}</Text>
            </View>
          ))
        )}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <Text style={styles.empty}>No transactions yet</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <TouchableOpacity style={styles.securityRow} onPress={() => router.push("/guardians")}>
          <Text style={styles.securityRowText}>Guardians & Recovery</Text>
          <Text style={styles.securityRowChevron}>›</Text>
        </TouchableOpacity>
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
  errorText: { color: "#f87171", fontSize: 12, marginTop: 8, textAlign: "center" },
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
  assistantLink: { marginHorizontal: 24, padding: 16, borderRadius: 12, backgroundColor: "#312e81" },
  assistantTitle: { color: "#f8fafc", fontWeight: "700", fontSize: 16 },
  assistantCopy: { color: "#c4b5fd", fontSize: 13, marginTop: 4 },
  section: { padding: 24 },
  sectionTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "600", marginBottom: 12 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 16 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  balanceAsset: { color: "#f8fafc", fontWeight: "600" },
  balanceAmount: { color: "#94a3b8" },
  securityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
  },
  securityRowText: { color: "#f8fafc", fontWeight: "600" },
  securityRowChevron: { color: "#64748b", fontSize: 18 },
});

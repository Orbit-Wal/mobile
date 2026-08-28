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
import { getBalances, StellarServiceError } from "@/services/stellar";
import { useWalletStore } from "@/store/walletStore";
import { useIsOffline } from "@/hooks/useNetworkStatus";
import { Link } from "expo-router";

export default function HomeScreen() {
  const publicKey = useWalletStore((s) => s.publicKey);
  const balances = useWalletStore((s) => s.balances);
  const setBalances = useWalletStore((s) => s.setBalances);
  const accounts = useWalletStore((s) => s.accounts);
  const activeAccount = accounts.find((a) => a.publicKey === publicKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isOffline = useIsOffline();

  const load = useCallback(async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }
    if (isOffline) {
      // Don't burn a timeout+retry cycle asking Horizon when we already
      // know there's no connection -- show the offline banner instead and
      // let the existing cached balances stand.
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    try {
      const result = await getBalances(publicKey);
      setBalances(result);
    } catch (err) {
      if (err instanceof StellarServiceError) {
        if (err.code === "ACCOUNT_NOT_FOUND") {
          setError("This account isn't funded yet. Send it some XLM to activate it.");
        } else if (err.code === "NETWORK_ERROR") {
          setError("Could not reach the Stellar network. Pull down to retry.");
        } else {
          setError("This wallet's address looks invalid. Try reimporting your wallet.");
        }
      } else {
        setError("Could not load balances. Please try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [publicKey, setBalances, isOffline]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleAction = (action: string) => {
    if (action === "Send") {
      router.push("/send");
      return;
    }
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
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>You're offline — showing last known balances</Text>
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning 👋</Text>
        <Text style={styles.walletLabel}>Total Balance</Text>
        {loading ? (
          <ActivityIndicator
            color="#f8fafc"
            style={{ marginTop: 12 }}
            accessibilityLabel="Loading balance"
          />
        ) : (
          <Text
            style={styles.balance}
            accessibilityLabel={`Total balance ${xlmBalance ? `${xlmBalance} XLM` : "0.00 XLM"}`}
          >
            {xlmBalance ? `${xlmBalance} XLM` : "0.00 XLM"}
          </Text>
        )}
        {error && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        {["Send", "Receive", "Swap", "Buy"].map((action) => (
          <TouchableOpacity
            key={action}
            style={styles.actionBtn}
            onPress={() => handleAction(action)}
            accessibilityRole="button"
            accessibilityLabel={action}
          >
            <Text style={styles.actionText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Link href="/chat" asChild>
        <TouchableOpacity
          style={styles.assistantLink}
          accessibilityRole="button"
          accessibilityLabel="Code Assistant"
          accessibilityHint="Ask coding questions, review snippets, and get suggestions"
        >
          <Text style={styles.assistantTitle}>Code Assistant</Text>
          <Text style={styles.assistantCopy}>Ask coding questions, review snippets, and get suggestions.</Text>
        </TouchableOpacity>
      </Link>
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Balances
        </Text>
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
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Recent Transactions
        </Text>
        <Text style={styles.empty}>No transactions yet</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Wallet
        </Text>
        <TouchableOpacity
          style={styles.securityRow}
          onPress={() => router.push("/accounts")}
          accessibilityRole="button"
          accessibilityLabel="Accounts"
        >
          <Text style={styles.securityRowText}>
            Accounts{activeAccount ? ` (${activeAccount.label})` : ""}
          </Text>
          <Text style={styles.securityRowChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.securityRow, { marginTop: 8 }]}
          onPress={() => router.push("/contacts")}
          accessibilityRole="button"
          accessibilityLabel="Address Book"
        >
          <Text style={styles.securityRowText}>Address Book</Text>
          <Text style={styles.securityRowChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.securityRow, { marginTop: 8 }]}
          onPress={() => router.push("/trustlines")}
          accessibilityRole="button"
          accessibilityLabel="Trustlines"
        >
          <Text style={styles.securityRowText}>Trustlines</Text>
          <Text style={styles.securityRowChevron}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Security
        </Text>
        <TouchableOpacity
          style={styles.securityRow}
          onPress={() => router.push("/guardians")}
          accessibilityRole="button"
          accessibilityLabel="Guardians and Recovery"
        >
          <Text style={styles.securityRowText}>Guardians & Recovery</Text>
          <Text style={styles.securityRowChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.securityRow, { marginTop: 8 }]}
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          accessibilityHint="Change network and other app settings"
        >
          <Text style={styles.securityRowText}>Settings</Text>
          <Text style={styles.securityRowChevron}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  offlineBanner: { backgroundColor: "#7c2d12", paddingVertical: 8, paddingHorizontal: 16 },
  offlineBannerText: { color: "#fed7aa", fontSize: 12, textAlign: "center", fontWeight: "600" },
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

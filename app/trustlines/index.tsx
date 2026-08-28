import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { getAccount, removeTrustline, StellarServiceError } from "@/services/stellar";
import { getSecretKeyForAccount } from "@/services/secureStorage";
import { useWalletStore } from "@/store/walletStore";

interface TrustlineRow {
  assetCode: string;
  assetIssuer: string;
  balance: string;
}

// Trustline management (issue #26): list existing trustlines, remove one
// (with the non-zero-balance case surfaced as a clear message rather than a
// raw Horizon exception -- see stellar.ts's translateChangeTrustError),
// and link to app/trustlines/add.tsx for adding a new one.
export default function TrustlinesScreen() {
  const publicKey = useWalletStore((s) => s.publicKey);
  const activeAccountId = useWalletStore((s) => s.activeAccountId);
  const [trustlines, setTrustlines] = useState<TrustlineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const account = await getAccount(publicKey);
      const rows: TrustlineRow[] = account.balances
        .filter((b): b is typeof b & { asset_code: string; asset_issuer: string } => "asset_code" in b && "asset_issuer" in b)
        .map((b) => ({ assetCode: b.asset_code, assetIssuer: b.asset_issuer, balance: b.balance }));
      setTrustlines(rows);
    } catch {
      // getAccount already classifies the error; this screen just shows an
      // empty list rather than duplicating home.tsx's error banner UI.
      setTrustlines([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = (row: TrustlineRow) => {
    Alert.alert("Remove Trustline", `Remove your trustline for ${row.assetCode}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const rowKey = `${row.assetCode}:${row.assetIssuer}`;
          setBusyKey(rowKey);
          try {
            if (!activeAccountId) throw new Error("No active account.");
            const secret = await getSecretKeyForAccount(activeAccountId);
            if (!secret) throw new Error("No secret found for the active account.");
            await removeTrustline({ sourceSecretKey: secret, assetCode: row.assetCode, assetIssuer: row.assetIssuer });
            await load();
          } catch (err) {
            const message = err instanceof StellarServiceError ? err.message : "Could not remove this trustline. Please try again.";
            Alert.alert("Couldn't Remove Trustline", message);
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
        <Text style={styles.title}>Trustlines</Text>
        <Text style={styles.subtitle}>Assets this account can hold. Each trustline reserves ~0.5 XLM.</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#f8fafc" style={{ marginTop: 24 }} />
      ) : trustlines.length === 0 ? (
        <Text style={styles.empty}>No non-native trustlines yet.</Text>
      ) : (
        trustlines.map((row) => {
          const rowKey = `${row.assetCode}:${row.assetIssuer}`;
          return (
            <View key={rowKey} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{row.assetCode}</Text>
                <Text style={styles.rowIssuer} numberOfLines={1}>
                  {row.assetIssuer}
                </Text>
                <Text style={styles.rowBalance}>Balance: {row.balance}</Text>
              </View>
              {busyKey === rowKey ? (
                <ActivityIndicator color="#f8fafc" />
              ) : (
                <TouchableOpacity onPress={() => handleRemove(row)} accessibilityRole="button" accessibilityLabel={`Remove ${row.assetCode} trustline`}>
                  <Text style={styles.removeLink}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      <TouchableOpacity style={styles.button} onPress={() => router.push("/trustlines/add")} accessibilityRole="button" accessibilityLabel="Add Trustline">
        <Text style={styles.buttonText}>+ Add Trustline</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { padding: 24, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f8fafc", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#94a3b8", lineHeight: 20 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 8,
  },
  rowLabel: { color: "#f8fafc", fontWeight: "600", marginBottom: 4 },
  rowIssuer: { color: "#64748b", fontFamily: "monospace", fontSize: 11, marginBottom: 4 },
  rowBalance: { color: "#94a3b8", fontSize: 12 },
  removeLink: { color: "#f87171", marginLeft: 12 },
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

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl } from "react-native";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useWalletStore } from "@/store/walletStore";
import { getSigners } from "@/services/guardianRecovery";

/**
 * Shows the account's current on-chain signer set — the source of truth
 * for whether recovery is configured and, if a recovery is mid-flight, who
 * can currently authorize a signer change. Deliberately reads live from
 * Horizon rather than from local app state: local state can be wrong or
 * stale (wrong device, reinstalled app); the chain can't be.
 */
export default function RecoveryStatusScreen() {
  const publicKey = useWalletStore((s) => s.publicKey);
  const [signers, setSigners] = useState<StellarSdk.Horizon.HorizonApi.AccountSigner[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await getSigners(publicKey);
      setSigners(result);
    } catch {
      setError("Could not load signer status. Account may not be funded yet.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor="#f8fafc"
        />
      }
    >
      <Text style={styles.title}>Recovery Status</Text>
      <Text style={styles.subtitle}>
        This is read directly from your account on Stellar, not from local app data — it's the
        real source of truth for who can currently sign for this wallet.
      </Text>

      {loading ? (
        <ActivityIndicator color="#f8fafc" style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Signers</Text>
          {signers?.map((signer) => (
            <View key={signer.key} style={styles.signerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.signerKey} numberOfLines={1}>
                  {signer.key}
                </Text>
                <Text style={styles.signerType}>
                  {signer.key === publicKey ? "This device (master key)" : "Guardian"}
                </Text>
              </View>
              <Text style={styles.signerWeight}>weight {signer.weight}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f8fafc", marginBottom: 12 },
  subtitle: { fontSize: 13, color: "#94a3b8", marginBottom: 24, lineHeight: 19 },
  errorText: { color: "#f87171", marginTop: 16 },
  section: { marginTop: 8 },
  sectionTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  signerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  signerKey: { color: "#f8fafc", fontFamily: "monospace", fontSize: 12 },
  signerType: { color: "#64748b", fontSize: 11, marginTop: 4 },
  signerWeight: { color: "#94a3b8", marginLeft: 12, fontSize: 12 },
});

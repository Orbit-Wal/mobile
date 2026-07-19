import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useGuardianStore } from "@/store/guardianStore";
import { useWalletStore } from "@/store/walletStore";
import { getSecretKey } from "@/services/secureStorage";
import {
  buildEnableRecoveryTx,
  validateRecoveryConfig,
  InvalidRecoveryConfigError,
  submitSignedTransaction,
} from "@/services/guardianRecovery";
import * as StellarSdk from "@stellar/stellar-sdk";

const DELAY_PRESETS = [
  { label: "24 hours", seconds: 24 * 60 * 60 },
  { label: "72 hours", seconds: 72 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
];

export default function RecoveryConfigScreen() {
  const { guardians, recoveryConfig, hydrated, hydrate, setRecoveryConfig } = useGuardianStore();
  const publicKey = useWalletStore((s) => s.publicKey);
  const [threshold, setThreshold] = useState(2);
  const [delaySeconds, setDelaySeconds] = useState(DELAY_PRESETS[1].seconds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (recoveryConfig) {
      setThreshold(recoveryConfig.threshold);
      setDelaySeconds(recoveryConfig.delaySeconds);
    }
  }, [recoveryConfig]);

  const clampThreshold = (delta: number) => {
    setThreshold((t) => Math.min(Math.max(t + delta, 2), Math.max(guardians.length, 2)));
  };

  const handleEnable = async () => {
    try {
      validateRecoveryConfig(guardians.length, threshold);
    } catch (e) {
      Alert.alert("Can't enable recovery", e instanceof InvalidRecoveryConfigError ? e.message : "Unknown error");
      return;
    }
    if (!publicKey) return;

    setSaving(true);
    try {
      const secret = await getSecretKey();
      if (!secret) throw new Error("Could not load device key.");
      const keypair = StellarSdk.Keypair.fromSecret(secret);

      const tx = await buildEnableRecoveryTx({
        sourcePublicKey: publicKey,
        guardianPublicKeys: guardians.map((g) => g.publicKey),
        threshold,
      });
      tx.sign(keypair);
      await submitSignedTransaction(tx);

      await setRecoveryConfig({ threshold, delaySeconds, enabledAt: new Date().toISOString() });
      Alert.alert("Recovery Enabled", "Your guardians can now help you recover this wallet.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert(
        "Couldn't enable recovery",
        e instanceof Error ? e.message : "The transaction was rejected. Make sure your account is funded."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recovery Settings</Text>
      <Text style={styles.subtitle}>
        Choose how many guardians must agree to recover your wallet, and how long they must wait
        before a recovery can complete. Unlike guardians co-signing a recovery, you (the device
        key) cannot cancel a pending recovery once guardians hold a signed copy of it — that
        stronger guarantee is coming with the contract-level recovery layer (see RECOVERY.md §4.3
        / §5.4). Pick guardians you trust for now.
      </Text>

      <Text style={styles.fieldLabel}>Guardians required: {threshold} of {guardians.length}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => clampThreshold(-1)}>
          <Text style={styles.stepperText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{threshold}</Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => clampThreshold(1)}>
          <Text style={styles.stepperText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Recovery delay</Text>
      <View style={styles.presetRow}>
        {DELAY_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.seconds}
            style={[styles.presetBtn, delaySeconds === preset.seconds && styles.presetBtnActive]}
            onPress={() => setDelaySeconds(preset.seconds)}
          >
            <Text
              style={[styles.presetText, delaySeconds === preset.seconds && styles.presetTextActive]}
            >
              {preset.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {guardians.length < 3 && (
        <Text style={styles.warning}>
          You need at least 3 guardians before you can enable recovery. You have {guardians.length}.
        </Text>
      )}

      {recoveryConfig?.enabledAt ? (
        <Text style={styles.warning}>
          Recovery is already enabled. Changing your guardians or threshold now requires your
          existing guardians to co-sign the change — the device key alone can no longer do this by
          design, so a compromised device can't unilaterally weaken your protection. This flow
          isn't built yet; for now, ask your guardians to help you disable and re-enable recovery,
          the same way they'd help you recover a lost device.
        </Text>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleEnable} disabled={saving || guardians.length < 3}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enable Recovery</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f8fafc", marginBottom: 16 },
  subtitle: { fontSize: 13, color: "#94a3b8", marginBottom: 28, lineHeight: 19 },
  fieldLabel: { color: "#f8fafc", fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 8 },
  stepperRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: { color: "#f8fafc", fontSize: 20, fontWeight: "600" },
  stepperValue: { color: "#f8fafc", fontSize: 24, fontWeight: "bold", marginHorizontal: 24 },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  presetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  presetBtnActive: { backgroundColor: "#3b82f6" },
  presetText: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },
  presetTextActive: { color: "#fff" },
  warning: { color: "#fbbf24", fontSize: 13, marginBottom: 16 },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

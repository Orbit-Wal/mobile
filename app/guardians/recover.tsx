import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as StellarSdk from "@stellar/stellar-sdk";
import { buildRecoverAccountTx, signAsGuardian, submitSignedTransaction } from "@/services/guardianRecovery";

const NETWORK_PASSPHRASE = process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE ?? StellarSdk.Networks.TESTNET;

/**
 * Used by a guardian, on their own device, to help someone else recover
 * their wallet. This is a multi-party protocol coordinated by sharing a
 * partially-signed transaction (as XDR text) between guardians out-of-band
 * (e.g. a group chat) — there is no coordination server, by design (see
 * docs/design/recovery/RECOVERY.md §3, "why not SEP-30-style servers").
 */
export default function RecoverAccountScreen() {
  const [lostAccountKey, setLostAccountKey] = useState("");
  const [newDeviceKey, setNewDeviceKey] = useState("");
  const [delayHours, setDelayHours] = useState("72");
  const [guardianSecret, setGuardianSecret] = useState("");
  const [importedXdr, setImportedXdr] = useState("");
  const [workingTx, setWorkingTx] = useState<StellarSdk.Transaction | null>(null);
  const [busy, setBusy] = useState(false);

  const signatureCount = workingTx?.signatures.length ?? 0;

  const handleStart = async () => {
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(lostAccountKey.trim())) {
      Alert.alert("Invalid Key", "Enter the valid public key of the account being recovered.");
      return;
    }
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(newDeviceKey.trim())) {
      Alert.alert("Invalid Key", "Enter the valid public key of the new device.");
      return;
    }
    const hours = Number(delayHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      Alert.alert("Invalid Delay", "Enter a positive number of hours.");
      return;
    }
    setBusy(true);
    try {
      const tx = await buildRecoverAccountTx({
        lostAccountPublicKey: lostAccountKey.trim(),
        newDevicePublicKey: newDeviceKey.trim(),
        delaySeconds: hours * 60 * 60,
      });
      setWorkingTx(signWithSelf(tx));
    } catch (e) {
      Alert.alert("Couldn't build recovery transaction", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const signWithSelf = (tx: StellarSdk.Transaction): StellarSdk.Transaction => {
    if (guardianSecret.trim().length > 0) {
      return signAsGuardian(tx, guardianSecret.trim());
    }
    return tx;
  };

  const handleImport = () => {
    try {
      const tx = new StellarSdk.Transaction(importedXdr.trim(), NETWORK_PASSPHRASE);
      setWorkingTx(guardianSecret.trim().length > 0 ? signAsGuardian(tx, guardianSecret.trim()) : tx);
      setImportedXdr("");
    } catch {
      Alert.alert("Invalid XDR", "Couldn't parse that transaction. Check it was copied in full.");
    }
  };

  const handleAddMySignature = () => {
    if (!workingTx || guardianSecret.trim().length === 0) return;
    setWorkingTx(signAsGuardian(workingTx, guardianSecret.trim()));
  };

  const handleCopyXdr = async () => {
    if (!workingTx) return;
    await Clipboard.setStringAsync(workingTx.toXDR());
    Alert.alert("Copied", "Share this with the next guardian to collect their signature.");
  };

  const handleSubmit = async () => {
    if (!workingTx) return;
    setBusy(true);
    try {
      await submitSignedTransaction(workingTx);
      Alert.alert(
        "Submitted",
        "The recovery transaction was submitted. If it doesn't have enough guardian signatures yet, or the delay hasn't elapsed, Horizon will reject it — that's expected, not an error in this app."
      );
    } catch (e) {
      Alert.alert(
        "Submission rejected",
        "This is expected if quorum hasn't been reached yet or the recovery delay hasn't elapsed. Collect more signatures and try again once ready."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Help Recover a Wallet</Text>
      <Text style={styles.subtitle}>
        Use this only for someone who has asked you, out-of-band, to help recover their lost
        device as their guardian.
      </Text>

      {!workingTx ? (
        <>
          <Text style={styles.fieldLabel}>Account being recovered (their old public key)</Text>
          <TextInput
            style={[styles.input, styles.keyInput]}
            placeholder="G..."
            placeholderTextColor="#64748b"
            value={lostAccountKey}
            onChangeText={setLostAccountKey}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Their new device's public key</Text>
          <TextInput
            style={[styles.input, styles.keyInput]}
            placeholder="G..."
            placeholderTextColor="#64748b"
            value={newDeviceKey}
            onChangeText={setNewDeviceKey}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Recovery delay (hours) — must match what they configured</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={delayHours}
            onChangeText={setDelayHours}
          />
          <Text style={styles.fieldLabel}>Your guardian secret key (used only to sign, never stored)</Text>
          <TextInput
            style={[styles.input, styles.keyInput]}
            placeholder="S..."
            placeholderTextColor="#64748b"
            value={guardianSecret}
            onChangeText={setGuardianSecret}
            autoCapitalize="none"
            secureTextEntry
          />
          <TouchableOpacity style={styles.button} onPress={handleStart} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start Recovery</Text>}
          </TouchableOpacity>

          <Text style={styles.orDivider}>— or, if another guardian already started this —</Text>
          <TextInput
            style={[styles.input, styles.keyInput]}
            placeholder="Paste recovery transaction XDR"
            placeholderTextColor="#64748b"
            value={importedXdr}
            onChangeText={setImportedXdr}
            autoCapitalize="none"
            multiline
          />
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleImport}
            disabled={importedXdr.trim().length === 0}
          >
            <Text style={styles.buttonTextSecondary}>Import & Sign</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Signatures collected</Text>
            <Text style={styles.statusValue}>{signatureCount}</Text>
          </View>
          {guardianSecret.trim().length > 0 && (
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleAddMySignature}>
              <Text style={styles.buttonTextSecondary}>Add My Signature</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleCopyXdr}>
            <Text style={styles.buttonTextSecondary}>Copy XDR for Next Guardian</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit Recovery</Text>}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: "bold", color: "#f8fafc", marginBottom: 12 },
  subtitle: { fontSize: 13, color: "#94a3b8", marginBottom: 24, lineHeight: 19 },
  fieldLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 8, marginTop: 12 },
  input: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "#f8fafc",
    marginBottom: 4,
  },
  keyInput: { fontFamily: "monospace", fontSize: 13 },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#3b82f6" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: "#3b82f6", fontSize: 15, fontWeight: "600" },
  orDivider: { color: "#64748b", textAlign: "center", marginTop: 28, marginBottom: 8, fontSize: 12 },
  statusCard: { backgroundColor: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 8 },
  statusLabel: { color: "#64748b", fontSize: 12, marginBottom: 4 },
  statusValue: { color: "#f8fafc", fontSize: 24, fontWeight: "bold" },
});

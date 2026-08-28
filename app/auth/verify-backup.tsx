import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { usePendingBackupStore } from "@/store/pendingBackupStore";
import { useWalletStore } from "@/store/walletStore";
import { recordBackupVerificationSkipped } from "@/services/backupAudit";
import { useScreenCaptureProtection } from "@/hooks/useScreenCaptureProtection";

// Issue #10: gates handleContinue in the create flows behind proof the user
// actually saved their backup, instead of granting wallet access the moment
// a key/phrase is merely displayed. Shared by both the raw-secret create
// flow (app/auth/create.tsx) and the mnemonic create flow
// (app/auth/create-mnemonic.tsx) via usePendingBackupStore, so the
// verification UX doesn't fork per onboarding path.
function pickRandomIndices(count: number, max: number): number[] {
  const indices = new Set<number>();
  while (indices.size < Math.min(count, max)) {
    indices.add(Math.floor(Math.random() * max));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export default function VerifyBackupScreen() {
  useScreenCaptureProtection();
  const { mode, value, publicKey, clear } = usePendingBackupStore();
  const completeOnboarding = useWalletStore((s) => s.completeOnboarding);
  const [secretInput, setSecretInput] = useState("");
  const [wordInputs, setWordInputs] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const words = useMemo(() => (mode === "mnemonic" && value ? value.trim().split(/\s+/) : []), [mode, value]);
  const challengeIndices = useMemo(() => (words.length > 0 ? pickRandomIndices(2, words.length) : []), [words]);

  if (!mode || !value || !publicKey) {
    // Reached directly (e.g. deep link, fast-refresh) without going through
    // a create flow -- nothing to verify against, so send back to the start
    // rather than showing a broken screen.
    router.replace("/auth/welcome");
    return null;
  }

  const finish = async () => {
    setBusy(true);
    try {
      await completeOnboarding(publicKey);
      clear();
      router.replace("/tabs/home");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = () => {
    if (mode === "secret") {
      if (secretInput.trim() !== value.trim()) {
        Alert.alert("Doesn't Match", "That doesn't match the secret key you were shown. Check it and try again.");
        return;
      }
    } else {
      const mismatch = challengeIndices.some(
        (i) => (wordInputs[i] ?? "").trim().toLowerCase() !== words[i].toLowerCase()
      );
      if (mismatch) {
        Alert.alert("Doesn't Match", "One or more words don't match your recovery phrase. Check it and try again.");
        return;
      }
    }
    finish();
  };

  const handleSkip = () => {
    Alert.alert(
      "Skip Backup Verification?",
      "If this device is lost or the app is uninstalled before you've backed this up, your funds are permanently unrecoverable. Nobody, including GlobeWallet, can restore them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip Anyway",
          style: "destructive",
          onPress: async () => {
            await recordBackupVerificationSkipped(publicKey);
            await finish();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm Your Backup</Text>
      {mode === "secret" ? (
        <>
          <Text style={styles.subtitle}>Re-enter your secret key to confirm you saved it correctly.</Text>
          <TextInput
            style={styles.input}
            placeholder="S..."
            placeholderTextColor="#64748b"
            value={secretInput}
            onChangeText={setSecretInput}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            multiline
            accessibilityLabel="Re-enter secret key"
          />
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>Enter the requested words from your recovery phrase.</Text>
          {challengeIndices.map((i) => (
            <View key={i} style={styles.wordRow}>
              <Text style={styles.wordLabel}>Word #{i + 1}</Text>
              <TextInput
                style={styles.wordInput}
                placeholderTextColor="#64748b"
                value={wordInputs[i] ?? ""}
                onChangeText={(text) => setWordInputs((prev) => ({ ...prev, [i]: text }))}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={`Word number ${i + 1}`}
              />
            </View>
          ))}
        </>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={handleVerify}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Verify and Continue"
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSkip} disabled={busy} accessibilityRole="button" accessibilityLabel="Skip verification">
        <Text style={styles.skipLink}>I already backed this up, skip verification</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 64, alignItems: "center" },
  title: { fontSize: 26, fontWeight: "bold", color: "#f8fafc", marginBottom: 16 },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  input: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "#f8fafc",
    marginBottom: 24,
    minHeight: 80,
    fontFamily: "monospace",
  },
  wordRow: { width: "100%", marginBottom: 12 },
  wordLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 6 },
  wordInput: { width: "100%", backgroundColor: "#1e293b", borderRadius: 12, padding: 14, color: "#f8fafc" },
  button: {
    width: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  skipLink: { color: "#f87171", fontSize: 13, textAlign: "center" },
});

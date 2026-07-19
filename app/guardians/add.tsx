import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useGuardianStore } from "@/store/guardianStore";

export default function AddGuardianScreen() {
  const [publicKey, setPublicKey] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const addGuardian = useGuardianStore((s) => s.addGuardian);

  const handleAdd = async () => {
    const trimmedKey = publicKey.trim();
    const trimmedLabel = label.trim();

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(trimmedKey)) {
      Alert.alert("Invalid Public Key", "That doesn't look like a valid Stellar public key (should start with 'G').");
      return;
    }
    if (trimmedLabel.length === 0) {
      Alert.alert("Label Required", "Add a label so you can recognize this guardian later (e.g. \"Mom\", \"Co-founder\").");
      return;
    }

    setSaving(true);
    try {
      await addGuardian({ publicKey: trimmedKey, label: trimmedLabel, addedAt: new Date().toISOString() });
      router.back();
    } catch (e) {
      Alert.alert("Couldn't add guardian", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Guardian</Text>
      <Text style={styles.subtitle}>
        Enter a trusted person's Stellar public key. They'll need their own wallet — this never
        asks for their secret key.
      </Text>
      <Text style={styles.fieldLabel}>Label</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Mom, Co-founder"
        placeholderTextColor="#64748b"
        value={label}
        onChangeText={setLabel}
      />
      <Text style={styles.fieldLabel}>Public Key</Text>
      <TextInput
        style={[styles.input, styles.keyInput]}
        placeholder="G..."
        placeholderTextColor="#64748b"
        value={publicKey}
        onChangeText={setPublicKey}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleAdd}
        disabled={saving || publicKey.trim().length === 0}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add Guardian</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 64 },
  title: { fontSize: 28, fontWeight: "bold", color: "#f8fafc", marginBottom: 16 },
  subtitle: { fontSize: 14, color: "#94a3b8", marginBottom: 32, lineHeight: 20 },
  fieldLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  input: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "#f8fafc",
    marginBottom: 20,
  },
  keyInput: { fontFamily: "monospace", minHeight: 70 },
  button: {
    width: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

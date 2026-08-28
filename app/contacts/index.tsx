import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as StellarSdk from "@stellar/stellar-sdk";
import { loadContacts, addContact, removeContact } from "@/services/addressBook";
import type { Contact } from "@/types";

// Address book (issue #20): CRUD UI, and -- when opened with ?pick=1 from
// app/send.tsx -- a picker that hands the selected address back to the send
// screen via router params.
export default function ContactsScreen() {
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const isPicking = pick === "1";
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setContacts(await loadContacts());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
    const trimmedLabel = label.trim();
    const trimmedAddress = address.trim();
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(trimmedAddress)) {
      Alert.alert("Invalid Address", "That doesn't look like a valid Stellar public address (should start with 'G').");
      return;
    }
    if (trimmedLabel.length === 0) {
      Alert.alert("Label Required", "Add a label so you can recognize this contact later.");
      return;
    }
    setSaving(true);
    try {
      setContacts(await addContact(trimmedLabel, trimmedAddress));
      setLabel("");
      setAddress("");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (id: string, contactLabel: string) => {
    Alert.alert("Remove Contact", `Remove "${contactLabel}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => setContacts(await removeContact(id)) },
    ]);
  };

  const handlePick = (contact: Contact) => {
    router.replace({ pathname: "/send", params: { address: contact.address, label: contact.label } });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{isPicking ? "Choose a Contact" : "Address Book"}</Text>
        <Text style={styles.subtitle}>
          {isPicking ? "Tap a contact to use it as the recipient." : "Saved recipient addresses, stored encrypted on this device only."}
        </Text>
      </View>

      {!loaded ? (
        <ActivityIndicator color="#f8fafc" style={{ marginTop: 24 }} />
      ) : contacts.length === 0 ? (
        <Text style={styles.empty}>No contacts saved yet.</Text>
      ) : (
        contacts.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={styles.row}
            onPress={() => (isPicking ? handlePick(c) : undefined)}
            disabled={!isPicking}
            accessibilityRole={isPicking ? "button" : undefined}
            accessibilityLabel={isPicking ? `Use ${c.label}` : c.label}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{c.label}</Text>
              <Text style={styles.rowAddress} numberOfLines={1}>
                {c.address}
              </Text>
            </View>
            {!isPicking && (
              <TouchableOpacity onPress={() => handleRemove(c.id, c.label)} accessibilityRole="button" accessibilityLabel={`Remove ${c.label}`}>
                <Text style={styles.removeLink}>Remove</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))
      )}

      {!isPicking && (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Add Contact</Text>
          <TextInput style={styles.input} placeholder="Label (e.g. Mom)" placeholderTextColor="#64748b" value={label} onChangeText={setLabel} />
          <TextInput
            style={[styles.input, styles.addressInput]}
            placeholder="G..."
            placeholderTextColor="#64748b"
            value={address}
            onChangeText={setAddress}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <TouchableOpacity style={styles.button} onPress={handleAdd} disabled={saving} accessibilityRole="button" accessibilityLabel="Add Contact">
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add Contact</Text>}
          </TouchableOpacity>
        </View>
      )}
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
  rowAddress: { color: "#64748b", fontFamily: "monospace", fontSize: 11 },
  removeLink: { color: "#f87171", marginLeft: 12 },
  form: { padding: 24 },
  sectionTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  input: { width: "100%", backgroundColor: "#1e293b", borderRadius: 12, padding: 16, color: "#f8fafc", marginBottom: 12 },
  addressInput: { fontFamily: "monospace", minHeight: 60 },
  button: { backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 4, marginBottom: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

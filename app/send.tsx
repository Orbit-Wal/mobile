import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as StellarSdk from "@stellar/stellar-sdk";
import { sendPayment, StellarServiceError } from "@/services/stellar";
import { getSecretKeyForAccount } from "@/services/secureStorage";
import { useWalletStore } from "@/store/walletStore";

// Send flow (issue #20 DoD: "CRUD UI wired to the send flow"). Scope note:
// XLM (native asset) only for now -- sending a held non-native asset needs
// its issuer, which isn't tracked by the current balances shape
// (Record<assetCode, amount>); that's a natural follow-up once issue #26's
// trustline data is threaded through here, called out as a TODO rather than
// silently left out.
export default function SendScreen() {
  const params = useLocalSearchParams<{ address?: string; label?: string }>();
  const [recipient, setRecipient] = useState(params.address ?? "");
  const [recipientLabel, setRecipientLabel] = useState(params.label ?? "");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const activeAccountId = useWalletStore((s) => s.activeAccountId);

  useEffect(() => {
    if (params.address) setRecipient(params.address);
    if (params.label) setRecipientLabel(params.label);
  }, [params.address, params.label]);

  const handleSend = async () => {
    const trimmedRecipient = recipient.trim();
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(trimmedRecipient)) {
      Alert.alert("Invalid Address", "That doesn't look like a valid Stellar public address.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Alert.alert("Invalid Amount", "Enter an amount greater than zero.");
      return;
    }
    if (!activeAccountId) {
      Alert.alert("No Active Account", "No account is active on this device.");
      return;
    }

    setSending(true);
    try {
      const secret = await getSecretKeyForAccount(activeAccountId);
      if (!secret) throw new Error("SECRET_MISSING");
      await sendPayment({
        sourceSecretKey: secret,
        destinationPublicKey: trimmedRecipient,
        asset: StellarSdk.Asset.native(),
        amount,
      });
      Alert.alert("Sent", "Your payment was submitted.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      if (err instanceof StellarServiceError) {
        Alert.alert("Couldn't Send", err.message);
      } else {
        Alert.alert("Couldn't Send", "Something went wrong sending this payment. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Send XLM</Text>

      <Text style={styles.fieldLabel}>Recipient</Text>
      {recipientLabel ? <Text style={styles.recipientLabel}>{recipientLabel}</Text> : null}
      <TextInput
        style={[styles.input, styles.addressInput]}
        placeholder="G..."
        placeholderTextColor="#64748b"
        value={recipient}
        onChangeText={(text) => {
          setRecipient(text);
          setRecipientLabel("");
        }}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        accessibilityLabel="Recipient address"
      />
      <TouchableOpacity
        style={styles.contactsLink}
        onPress={() => router.push({ pathname: "/contacts", params: { pick: "1" } })}
        accessibilityRole="button"
        accessibilityLabel="Choose from Contacts"
      >
        <Text style={styles.contactsLinkText}>Choose from Contacts</Text>
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>Amount (XLM)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor="#64748b"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        accessibilityLabel="Amount"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSend}
        disabled={sending}
        accessibilityRole="button"
        accessibilityLabel="Send"
      >
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 64 },
  title: { fontSize: 28, fontWeight: "bold", color: "#f8fafc", marginBottom: 24 },
  fieldLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 8 },
  recipientLabel: { color: "#3b82f6", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: { width: "100%", backgroundColor: "#1e293b", borderRadius: 12, padding: 16, color: "#f8fafc", marginBottom: 12 },
  addressInput: { fontFamily: "monospace", minHeight: 70 },
  contactsLink: { alignSelf: "flex-start", marginBottom: 24 },
  contactsLinkText: { color: "#3b82f6", fontSize: 13, fontWeight: "600" },
  button: { width: "100%", backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

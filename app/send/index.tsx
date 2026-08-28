import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  checkMemoRequired,
  DEFAULT_SLIPPAGE_BPS,
  findStrictSendPaths,
  sendPathPayment,
  sendPayment,
  StellarServiceError,
} from "@/services/stellar";
import { getSecretKey } from "@/services/secureStorage";
import { useWalletStore } from "@/store/walletStore";
import { useSendIntentStore } from "@/store/sendIntentStore";

function buildAsset(code: string, issuer: string): StellarSdk.Asset {
  return code === "XLM" ? StellarSdk.Asset.native() : new StellarSdk.Asset(code, issuer);
}

export default function SendScreen() {
  const balances = useWalletStore((s) => s.balances);
  const pending = useSendIntentStore((s) => s.pending);
  const clearPending = useSendIntentStore((s) => s.clearPending);

  const balanceAssetCodes = Object.keys(balances).length > 0 ? Object.keys(balances) : ["XLM"];

  const [sendAssetCode, setSendAssetCode] = useState("XLM");
  const [destination, setDestination] = useState("");
  const [destAssetCode, setDestAssetCode] = useState("XLM");
  const [destAssetIssuer, setDestAssetIssuer] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [slippageBps, setSlippageBps] = useState(String(DEFAULT_SLIPPAGE_BPS));

  const [memoRequired, setMemoRequired] = useState<boolean | null>(null);
  const [checkingMemo, setCheckingMemo] = useState(false);
  const [memoCheckError, setMemoCheckError] = useState<string | null>(null);

  const [untrustedWarning, setUntrustedWarning] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Pre-fill from a QR scan (#15) or a SEP-7 deep link (#12). Both paths
  // already went through validateScannedInput()/parseSep7Uri() before
  // landing here -- this effect only ever consumes already-validated data,
  // it never re-parses raw text.
  useEffect(() => {
    if (!pending) return;
    if (pending.kind === "address") {
      setDestination(pending.destination);
    } else if (pending.kind === "sep7") {
      const req = pending.request;
      if (req.operation === "tx") {
        Alert.alert(
          "Unsupported payment link",
          'This link requests signing a pre-built transaction (SEP-7 "tx"), which isn\'t supported yet. Ask the sender for a direct address instead.'
        );
      } else {
        setDestination(req.destination);
        if (req.amount) setAmount(req.amount);
        if (req.assetCode) {
          setDestAssetCode(req.assetCode);
          setDestAssetIssuer(req.assetIssuer ?? "");
        }
        if (req.memo) setMemo(req.memo);
        if (!req.originVerified) {
          setUntrustedWarning(
            req.originDomain
              ? `This payment request claims to be from "${req.originDomain}" but its signature could not be verified. Review every field carefully before sending.`
              : "This payment request has no verifiable origin. Review every field carefully before sending."
          );
        }
      }
    }
    clearPending();
  }, [pending, clearPending]);

  // SEP-29 memo-required check (#24) -- re-runs whenever the destination
  // resolves to a valid address.
  useEffect(() => {
    const trimmed = destination.trim();
    setMemoRequired(null);
    setMemoCheckError(null);
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(trimmed)) return;

    let cancelled = false;
    setCheckingMemo(true);
    checkMemoRequired(trimmed)
      .then((required) => {
        if (!cancelled) setMemoRequired(required);
      })
      .catch((err) => {
        if (cancelled) return;
        // Fail open on the check itself (e.g. can't reach Horizon), but say
        // so explicitly -- silently treating "couldn't check" the same as
        // "not required" would defeat the point of the check.
        setMemoCheckError(
          err instanceof StellarServiceError
            ? "Could not verify whether this destination requires a memo. Proceed with caution."
            : "Could not verify memo requirement."
        );
      })
      .finally(() => {
        if (!cancelled) setCheckingMemo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [destination]);

  const isCrossAsset =
    sendAssetCode !== destAssetCode || (destAssetCode !== "XLM" && destAssetIssuer.trim().length > 0);

  const handleSend = async () => {
    const trimmedDest = destination.trim();
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(trimmedDest)) {
      Alert.alert("Invalid address", 'Enter or scan a valid Stellar public key (starts with "G").');
      return;
    }
    if (!amount || Number.isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    const trimmedIssuer = destAssetIssuer.trim();
    if (destAssetCode !== "XLM") {
      if (trimmedIssuer.length === 0) {
        Alert.alert("Missing issuer", "Enter the issuer address for the destination asset.");
        return;
      }
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(trimmedIssuer)) {
        Alert.alert("Invalid issuer", "The destination asset issuer doesn't look like a valid Stellar address.");
        return;
      }
    }
    if (memoRequired && memo.trim().length === 0) {
      // Hard block, not just advisory -- per issue #24's DoD. A memo-less
      // send to a memo-required destination typically means unrecoverable
      // loss of funds at the receiving exchange.
      Alert.alert(
        "Memo required",
        "This destination requires a memo to identify your deposit (SEP-29). Sending without one will likely result in permanently lost funds. Add a memo to continue."
      );
      return;
    }

    setSending(true);
    try {
      const secretKey = await getSecretKey();
      if (!secretKey) {
        Alert.alert("Wallet locked", "Could not access your wallet key. Try unlocking the app again.");
        return;
      }

      if (!isCrossAsset) {
        await sendPayment({
          sourceSecretKey: secretKey,
          destinationPublicKey: trimmedDest,
          asset: buildAsset(sendAssetCode, ""),
          amount,
          memo: memo.trim() || undefined,
        });
      } else {
        const sendAsset = buildAsset(sendAssetCode, "");
        const destAsset = buildAsset(destAssetCode, trimmedIssuer);
        const paths = await findStrictSendPaths({
          sendAsset,
          sendAmount: amount,
          destinationPublicKey: trimmedDest,
        });
        // Horizon orders strict-send paths by destination_amount descending
        // -- the first record is the best available quote.
        const best = paths[0];
        const path = best.path.map((p) =>
          p.asset_type === "native" ? StellarSdk.Asset.native() : new StellarSdk.Asset(p.asset_code!, p.asset_issuer!)
        );
        await sendPathPayment({
          sourceSecretKey: secretKey,
          destinationPublicKey: trimmedDest,
          sendAsset,
          destAsset,
          mode: "strictSend",
          amount,
          expectedCounterAmount: best.destination_amount,
          path,
          slippageBps: Number(slippageBps) || DEFAULT_SLIPPAGE_BPS,
          memo: memo.trim() || undefined,
        });
      }
      Alert.alert("Sent", "Your payment was submitted.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err) {
      if (err instanceof StellarServiceError && err.code === "NO_PATH_FOUND") {
        Alert.alert(
          "No route found",
          "There's no available exchange path from your asset to the destination asset right now. Try a smaller amount or a different asset."
        );
      } else {
        Alert.alert("Send failed", err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Send</Text>

      {untrustedWarning && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{untrustedWarning}</Text>
        </View>
      )}

      <Text style={styles.fieldLabel}>From asset</Text>
      <View style={styles.chipRow}>
        {balanceAssetCodes.map((code) => (
          <TouchableOpacity
            key={code}
            style={[styles.chip, sendAssetCode === code && styles.chipActive]}
            onPress={() => setSendAssetCode(code)}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, sendAssetCode === code && styles.chipTextActive]}>{code}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.fieldHeaderRow}>
        <Text style={styles.fieldLabel}>Recipient</Text>
        <TouchableOpacity onPress={() => router.push("/send/scan")} accessibilityRole="button">
          <Text style={styles.link}>Scan QR</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.input, styles.monoInput]}
        placeholder="G..."
        placeholderTextColor="#64748b"
        value={destination}
        onChangeText={setDestination}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      {checkingMemo && <Text style={styles.hintText}>Checking whether this destination requires a memo...</Text>}
      {memoCheckError && <Text style={styles.warningInlineText}>{memoCheckError}</Text>}
      {memoRequired && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            This destination requires a memo (SEP-29). Add one below, or your funds may be unrecoverable.
          </Text>
        </View>
      )}

      <Text style={styles.fieldLabel}>Destination asset code</Text>
      <TextInput
        style={styles.input}
        placeholder="XLM"
        placeholderTextColor="#64748b"
        value={destAssetCode}
        onChangeText={(v) => setDestAssetCode(v.trim().toUpperCase() || "XLM")}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {destAssetCode !== "XLM" && (
        <>
          <Text style={styles.fieldLabel}>Destination asset issuer</Text>
          <TextInput
            style={[styles.input, styles.monoInput]}
            placeholder="G..."
            placeholderTextColor="#64748b"
            value={destAssetIssuer}
            onChangeText={setDestAssetIssuer}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      {isCrossAsset && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            This is a path payment: {sendAssetCode} from your balance will be converted to {destAssetCode || "the destination asset"} via
            Stellar's DEX. A best-available route is quoted right before sending.
          </Text>
          <Text style={styles.fieldLabel}>Max slippage (basis points, 100 = 1%)</Text>
          <TextInput
            style={styles.input}
            placeholder={String(DEFAULT_SLIPPAGE_BPS)}
            placeholderTextColor="#64748b"
            value={slippageBps}
            onChangeText={setSlippageBps}
            keyboardType="numeric"
          />
        </View>
      )}

      <Text style={styles.fieldLabel}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor="#64748b"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <Text style={styles.fieldLabel}>
        Memo {memoRequired ? "(required)" : "(optional)"}
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Optional text memo"
        placeholderTextColor="#64748b"
        value={memo}
        onChangeText={setMemo}
        maxLength={28}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSend}
        disabled={sending || destination.trim().length === 0 || amount.trim().length === 0}
      >
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Review & Send</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 24, paddingTop: 64 },
  title: { fontSize: 28, fontWeight: "bold", color: "#f8fafc", marginBottom: 24 },
  fieldHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 8, marginTop: 4 },
  link: { color: "#3b82f6", fontSize: 13, fontWeight: "600" },
  input: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "#f8fafc",
    marginBottom: 16,
  },
  monoInput: { fontFamily: "monospace", minHeight: 70 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  chip: {
    backgroundColor: "#1e293b",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  warningBanner: {
    backgroundColor: "#7c2d12",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningText: { color: "#fed7aa", fontSize: 13, lineHeight: 18 },
  warningInlineText: { color: "#f87171", fontSize: 12, marginBottom: 12 },
  hintText: { color: "#64748b", fontSize: 12, marginBottom: 12 },
  infoBanner: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoText: { color: "#94a3b8", fontSize: 12, lineHeight: 18, marginBottom: 12 },
  button: {
    width: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 48,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

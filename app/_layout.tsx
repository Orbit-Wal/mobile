import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { Stack, router } from "expo-router";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useWalletStore } from "@/store/walletStore";
import { authenticate } from "@/services/appLock";
import { useSendIntentStore } from "@/store/sendIntentStore";
import { validateScannedInput } from "@/utils/scannedInput";

// Re-lock after this long in the background, even if the OS never fully
// killed the app. Chosen as a reasonable balance between security (an
// unlocked phone left behind shouldn't stay unlocked in this app forever)
// and not re-prompting for a 10-second app-switch to check a QR code.
const SESSION_TIMEOUT_MS = 2 * 60 * 1000;

export default function RootLayout() {
  const isOnboarded = useWalletStore((s) => s.isOnboarded);
  const hydrated = useWalletStore((s) => s.hydrated);
  const hydrate = useWalletStore((s) => s.hydrate);

  // AppState transitions to "inactive" (iOS app switcher, incoming call
  // overlay) or "background" the instant the OS takes a snapshot for the
  // app switcher, and again whenever the app isn't the foreground app --
  // both moments where wallet secrets, addresses, and balances would
  // otherwise be visible outside the app itself. Covering the whole tree at
  // the root layout means every screen is redacted, not just ones that
  // remember to opt in individually.
  const [isForeground, setIsForeground] = useState(AppState.currentState === "active");

  // Gates the whole app behind biometric/passcode auth once a wallet
  // exists. Starts true (fail closed) and only flips false after a
  // successful authenticate() call, or immediately if there's no wallet
  // to protect yet.
  const [locked, setLocked] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const runAuth = useCallback(async () => {
    setAuthenticating(true);
    setAuthError(null);
    try {
      const result = await authenticate();
      if (result.success) {
        setLocked(false);
      } else {
        setAuthError(
          result.noSecureAuthAvailable
            ? "No biometrics or device passcode are set up, so GlobeWallet can't verify it's you. Set a passcode in your device settings, then try again."
            : "Authentication failed or was cancelled."
        );
      }
    } catch {
      // hasHardwareAsync/isEnrolledAsync/authenticateAsync throwing (rather
      // than resolving success: false) is unusual but not impossible on
      // some devices/simulators -- fail closed with a retry option instead
      // of an unhandled rejection.
      setAuthError("Could not start authentication. Please try again.");
    } finally {
      setAuthenticating(false);
    }
  }, []);

  // Decide the initial lock state once hydration tells us whether a wallet
  // exists at all -- no wallet means nothing to protect, so skip the gate
  // entirely rather than prompting for auth on the welcome screen.
  useEffect(() => {
    if (!hydrated) return;
    if (!isOnboarded) {
      setLocked(false);
      return;
    }
    // Explicitly re-assert the fail-closed default here, not just rely on
    // `locked`'s initial value: isOnboarded can flip false -> true within a
    // live session (finishing onboarding), at which point `locked` may
    // already have been set to false by the branch above on an earlier
    // render. Without this, a freshly onboarded user would land on the
    // home screen unlocked while runAuth() resolved in the background.
    setLocked(true);
    runAuth();
    // Intentionally only re-runs when `hydrated` flips or onboarding status
    // changes -- not on every runAuth identity change -- this effect is the
    // "initial gate on launch" path, not the re-lock-after-background path
    // below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isOnboarded]);

  // SEP-7 (`web+stellar:pay`/`web+stellar:tx`) deep link handling (#12).
  // Reuses the exact same untrusted-input contract as QR scanning (#15) via
  // validateScannedInput() -- a malformed or ambiguous link is rejected
  // outright rather than best-effort parsed, and a valid one is only ever
  // handed to the send screen as pre-validated data, never raw text.
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const validated = validateScannedInput(url);
      if (validated.kind === "invalid") {
        // Only surface an error for links that were clearly *trying* to be
        // a SEP-7 payment request -- app.json's own `globewallet://` scheme
        // is also routed through this listener for other deep links (none
        // yet), and those shouldn't show a SEP-7-flavored error.
        if (url.startsWith("web+stellar:")) {
          Alert.alert("Invalid payment link", validated.reason);
        }
        return;
      }
      useSendIntentStore.getState().setPending(validated);
      router.push("/send");
    };

    Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasForeground = AppState.currentState === "active";
      setIsForeground(nextState === "active");

      if (wasForeground && nextState !== "active") {
        backgroundedAtRef.current = Date.now();
        return;
      }

      if (!wasForeground && nextState === "active" && isOnboarded) {
        const backgroundedAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (backgroundedAt !== null && Date.now() - backgroundedAt > SESSION_TIMEOUT_MS) {
          setLocked(true);
          setAuthError(null);
        }
      }
    });
    return () => subscription.remove();
  }, [isOnboarded]);

  // Re-attempt auth automatically once the lock screen appears again after
  // a timeout-triggered re-lock (skip on the very first mount -- the effect
  // above already calls runAuth() directly once hydration resolves).
  const didInitialAuth = useRef(false);
  useEffect(() => {
    if (!hydrated || !isOnboarded) return;
    if (!didInitialAuth.current) {
      didInitialAuth.current = true;
      return;
    }
    if (locked && isForeground) {
      runAuth();
    }
  }, [locked, isForeground, hydrated, isOnboarded, runAuth]);

  const showLockScreen = hydrated && isOnboarded && locked;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="tabs" />
        <Stack.Screen name="send" />
        <Stack.Screen name="guardians" />
        <Stack.Screen name="chat" />
      </Stack>
      {showLockScreen && (
        <View style={styles.redactionOverlay}>
          <Text style={styles.redactionLogo}>🌐</Text>
          <Text style={styles.redactionTitle}>GlobeWallet</Text>
          {authenticating ? (
            <ActivityIndicator color="#f8fafc" style={styles.lockSpinner} />
          ) : (
            <>
              {authError && <Text style={styles.lockError}>{authError}</Text>}
              <TouchableOpacity
                style={styles.unlockButton}
                onPress={runAuth}
                accessibilityRole="button"
                accessibilityLabel="Unlock"
              >
                <Text style={styles.unlockButtonText}>Unlock</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
      {!showLockScreen && !isForeground && (
        <View style={styles.redactionOverlay} pointerEvents="none">
          <Text style={styles.redactionLogo}>🌐</Text>
          <Text style={styles.redactionTitle}>GlobeWallet</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  redactionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  redactionLogo: { fontSize: 64, marginBottom: 16 },
  redactionTitle: { fontSize: 28, fontWeight: "bold", color: "#f8fafc", marginBottom: 24 },
  lockSpinner: { marginTop: 8 },
  lockError: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
    marginHorizontal: 32,
    marginBottom: 16,
  },
  unlockButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  unlockButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

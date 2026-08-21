import { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  // AppState transitions to "inactive" (iOS app switcher, incoming call
  // overlay) or "background" the instant the OS takes a snapshot for the
  // app switcher, and again whenever the app isn't the foreground app --
  // both moments where wallet secrets, addresses, and balances would
  // otherwise be visible outside the app itself. Covering the whole tree at
  // the root layout means every screen is redacted, not just ones that
  // remember to opt in individually.
  const [isForeground, setIsForeground] = useState(AppState.currentState === "active");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsForeground(nextState === "active");
    });
    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="tabs" />
        <Stack.Screen name="guardians" />
        <Stack.Screen name="chat" />
      </Stack>
      {!isForeground && (
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
  redactionTitle: { fontSize: 28, fontWeight: "bold", color: "#f8fafc" },
});

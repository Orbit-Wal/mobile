import { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useWalletStore } from "@/store/walletStore";

export default function Index() {
  const isOnboarded = useWalletStore((s) => s.isOnboarded);
  const hydrated = useWalletStore((s) => s.hydrated);
  const hydrate = useWalletStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#f8fafc" />
      </View>
    );
  }

  return isOnboarded ? (
    <Redirect href="/tabs/home" />
  ) : (
    <Redirect href="/auth/welcome" />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
});

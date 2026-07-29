import { useEffect } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useWalletStore } from "@/store/walletStore";

export default function Index() {
  const { isOnboarded, hydrated, hydrate } = useWalletStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return isOnboarded ? (
    <Redirect href="/tabs/home" />
  ) : (
    <Redirect href="/auth/welcome" />
  );
}

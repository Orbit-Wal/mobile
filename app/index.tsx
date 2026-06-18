import { Redirect } from "expo-router";
import { useWalletStore } from "@/store/walletStore";

export default function Index() {
  const { isOnboarded } = useWalletStore();
  return isOnboarded ? (
    <Redirect href="/tabs/home" />
  ) : (
    <Redirect href="/auth/welcome" />
  );
}

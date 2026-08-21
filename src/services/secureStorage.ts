import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";

const SECRET_KEY_STORAGE_KEY = "globewallet_secret_key";
const PUBLIC_KEY_STORAGE_KEY = "globewallet_public_key";
const ROOT_WARNING_ACKNOWLEDGED_KEY = "root_warning_acknowledged";

export async function checkSecurityAndWarn(): Promise<boolean> {
  // If it's not a real device, skip check
  if (!Device.isDevice) return true;

  try {
    const isRooted = await Device.isRootedExperimentalAsync();
    if (!isRooted) return true;

    const acknowledged = await AsyncStorage.getItem(ROOT_WARNING_ACKNOWLEDGED_KEY);
    if (acknowledged === "true") return true;

    return new Promise((resolve) => {
      Alert.alert(
        "Device Security Warning",
        "Your device appears to be rooted or jailbroken. This significantly degrades the OS-level security protections for your wallet's private keys. Using this app on a compromised device may result in loss of funds.\n\nDo you wish to continue at your own risk?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: "I Understand",
            style: "destructive",
            onPress: async () => {
              await AsyncStorage.setItem(ROOT_WARNING_ACKNOWLEDGED_KEY, "true");
              resolve(true);
            },
          },
        ],
        { cancelable: false }
      );
    });
  } catch (error) {
    // Fail open to avoid false-positive lockouts
    return true;
  }
}

export async function saveSecretKey(
  secret: string,
  options: { allowOverwrite?: boolean } = {}
): Promise<void> {
  if (!options.allowOverwrite) {
    const existing = await SecureStore.getItemAsync(SECRET_KEY_STORAGE_KEY);
    if (existing !== null) {
      throw new Error(
        "SECRET_ALREADY_EXISTS: a wallet secret is already stored on this device. " +
          "Reset the existing wallet before creating or importing a new one, or pass " +
          "{ allowOverwrite: true } if this call site intentionally replaces it."
      );
    }
  }
  await SecureStore.setItemAsync(SECRET_KEY_STORAGE_KEY, secret, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getSecretKey(): Promise<string | null> {
  return SecureStore.getItemAsync(SECRET_KEY_STORAGE_KEY);
}

export async function deleteSecretKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SECRET_KEY_STORAGE_KEY);
}

// The public key isn't sensitive on its own, but we persist it alongside the
// secret (same storage backend as guardianStorage.ts) so onboarding state
// can be reconstructed after a cold start, without adding a second storage
// dependency for one small value.
export async function saveWalletMeta(publicKey: string): Promise<void> {
  await SecureStore.setItemAsync(PUBLIC_KEY_STORAGE_KEY, publicKey);
}

export async function getWalletMeta(): Promise<string | null> {
  return SecureStore.getItemAsync(PUBLIC_KEY_STORAGE_KEY);
}

export async function deleteWalletMeta(): Promise<void> {
  await SecureStore.deleteItemAsync(PUBLIC_KEY_STORAGE_KEY);
}

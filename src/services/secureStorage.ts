import * as SecureStore from "expo-secure-store";

const SECRET_KEY_STORAGE_KEY = "globewallet_secret_key";

export async function saveSecretKey(secret: string): Promise<void> {
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

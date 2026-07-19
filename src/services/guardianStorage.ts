import * as SecureStore from "expo-secure-store";
import type { Guardian, RecoveryConfig } from "@/types";

const GUARDIANS_STORAGE_KEY = "globewallet_guardians";
const RECOVERY_CONFIG_STORAGE_KEY = "globewallet_recovery_config";

// Guardian public keys are not secret, but we store them alongside the
// wallet's own secret key (src/services/secureStorage.ts) for consistency
// and so this data survives the same device lifecycle the secret key does,
// without adding a second storage dependency for a small amount of data.

export async function saveGuardians(guardians: Guardian[]): Promise<void> {
  await SecureStore.setItemAsync(GUARDIANS_STORAGE_KEY, JSON.stringify(guardians));
}

export async function loadGuardians(): Promise<Guardian[]> {
  const raw = await SecureStore.getItemAsync(GUARDIANS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Guardian[];
  } catch {
    return [];
  }
}

export async function saveRecoveryConfig(config: RecoveryConfig): Promise<void> {
  await SecureStore.setItemAsync(RECOVERY_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export async function loadRecoveryConfig(): Promise<RecoveryConfig | null> {
  const raw = await SecureStore.getItemAsync(RECOVERY_CONFIG_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RecoveryConfig;
  } catch {
    return null;
  }
}

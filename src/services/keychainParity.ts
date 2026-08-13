import { Platform } from "react-native";
import * as Device from "expo-device";
import * as LocalAuthentication from "expo-local-authentication";

export type StorageTier = "strong" | "weak" | "unknown";

export interface SecretStorageAssessment {
  tier: StorageTier;
  platform: string;
  isPhysicalDevice: boolean;
  securityLevel: LocalAuthentication.SecurityLevel;
  isRooted: boolean;
  reasons: string[];
}

export async function assessSecretStorageTier(): Promise<SecretStorageAssessment> {
  const reasons: string[] = [];
  const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
  const isRooted = await Device.isRootedExperimentalAsync().catch(() => false);
  const isPhysicalDevice = Device.isDevice;

  let tier: StorageTier;

  if (isRooted) {
    tier = "weak";
    reasons.push("Device appears rooted/jailbroken — OS-level keystore protections can be bypassed.");
  } else if (Platform.OS === "ios") {
    tier = "strong";
    reasons.push("iOS Keychain items are encrypted with a device-bound hardware key hierarchy (AES-256, non-portable across devices).");
  } else if (Platform.OS === "android") {
    if (!isPhysicalDevice) {
      tier = "weak";
      reasons.push("Running on an emulator — Android Keystore falls back to a software implementation.");
    } else if (securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC) {
      tier = "strong";
      reasons.push("Android Keystore with a class-3 biometric enrolled — hardware (TEE/StrongBox) backed key in practice.");
    } else if (securityLevel === LocalAuthentication.SecurityLevel.SECRET) {
      tier = "weak";
      reasons.push("Only a PIN/pattern is enrolled, no biometric — Android Keystore hardware backing is not guaranteed.");
    } else {
      tier = "weak";
      reasons.push("No biometric or PIN enrolled — the strongest Android Keystore guarantee cannot be confirmed.");
    }
  } else {
    tier = "unknown";
    reasons.push(`Secure-storage guarantees on ${Platform.OS} are not assessed.`);
  }

  return {
    tier,
    platform: Platform.OS,
    isPhysicalDevice,
    securityLevel,
    isRooted,
    reasons,
  };
}

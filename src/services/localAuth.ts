import * as LocalAuthentication from "expo-local-authentication";
import { Alert } from "react-native";

export class LocalAuthRequiredError extends Error {
  constructor(message = "Local authentication is required to access your secret key.") {
    super(message);
    this.name = "LocalAuthRequiredError";
  }
}

function confirmFallback(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Continue", onPress: () => resolve(true) },
    ]);
  });
}

export async function requireLocalAuth(
  promptMessage = "Authenticate to access your wallet secret key"
): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();

  if (!hasHardware) {
    const ok = await confirmFallback(
      "No biometrics available",
      "This device has no fingerprint, Face ID, or PIN hardware. Your secret key will be unlocked without a local authentication challenge. Consider using a device that supports biometrics."
    );
    if (!ok) throw new LocalAuthRequiredError("Local authentication is not available on this device.");
    return true;
  }

  const enrolled = await LocalAuthentication.isEnrolledAsync();

  if (!enrolled) {
    const ok = await confirmFallback(
      "No biometrics or PIN enrolled",
      "No fingerprint, Face ID, or PIN is enrolled on this device. Your secret key will be unlocked without a local authentication challenge. Enroll one in system settings for better protection."
    );
    if (!ok) throw new LocalAuthRequiredError("No biometrics or PIN are enrolled on this device.");
    return true;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
  });

  if (!result.success) {
    throw new LocalAuthRequiredError("Authentication was cancelled or failed.");
  }

  return true;
}

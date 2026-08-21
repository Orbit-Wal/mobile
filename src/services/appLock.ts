import * as LocalAuthentication from "expo-local-authentication";

export interface AuthResult {
  success: boolean;
  /** True when the device has neither biometrics nor a passcode/PIN set up at all. */
  noSecureAuthAvailable?: boolean;
  error?: string;
}

/**
 * Prompts for biometric auth, falling back to the device passcode/PIN when
 * biometrics aren't enrolled or fail (disableDeviceFallback: false is the
 * default, but set explicitly here since it's load-bearing: this is also
 * what covers devices with no biometric hardware/enrollment at all --
 * LocalAuthentication.authenticateAsync falls straight to the OS passcode
 * prompt in that case rather than failing outright).
 */
export async function authenticate(): Promise<AuthResult> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware && !isEnrolled) {
    // No biometric sensor AND (as far as this API can tell) nothing enrolled.
    // authenticateAsync would still work if a device passcode is set (Expo
    // can't query that directly), so we still attempt it -- this flag is
    // only used by the caller to decide whether to show extra guidance if
    // authentication then actually fails.
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock GlobeWallet",
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
    });
    return result.success
      ? { success: true }
      : { success: false, error: result.error, noSecureAuthAvailable: true };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock GlobeWallet",
    disableDeviceFallback: false,
    cancelLabel: "Cancel",
    fallbackLabel: "Use passcode",
  });
  return result.success ? { success: true } : { success: false, error: result.error };
}

import * as SecureStore from "expo-secure-store";

function skipKeyFor(publicKey: string): string {
  return `globewallet_backup_skip_ack_${publicKey}`;
}

/**
 * Records an explicit, timestamped acknowledgement that the user skipped
 * backup verification (issue #10 DoD: "explicit, logged, hard-to-misclick
 * risk acknowledgement"). Local-only: there is no analytics/telemetry
 * pipeline in this codebase to send it to, and one should not be added
 * without a privacy review, since this is tied to a specific public key.
 */
export async function recordBackupVerificationSkipped(publicKey: string): Promise<void> {
  const timestamp = new Date().toISOString();
  console.warn(`[backup] verification skipped for ${publicKey} at ${timestamp}`);
  await SecureStore.setItemAsync(skipKeyFor(publicKey), timestamp);
}

import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import type { Account, Contact } from "@/types";

const SECRET_KEY_STORAGE_KEY = "globewallet_secret_key";
const PUBLIC_KEY_STORAGE_KEY = "globewallet_public_key";
const ROOT_WARNING_ACKNOWLEDGED_KEY = "root_warning_acknowledged";
const ACCOUNTS_STORAGE_KEY = "globewallet_accounts";
const ACTIVE_ACCOUNT_ID_STORAGE_KEY = "globewallet_active_account_id";
const CONTACTS_STORAGE_KEY = "globewallet_contacts";

/** Reserved account id for the wallet migrated from a pre-#18 single-account
 * install -- its secret lives under the original, unsuffixed
 * SECRET_KEY_STORAGE_KEY, so existing installs need no data migration at all. */
export const DEFAULT_ACCOUNT_ID = "default";

function secretStorageKeyFor(accountId: string): string {
  return accountId === DEFAULT_ACCOUNT_ID
    ? SECRET_KEY_STORAGE_KEY
    : `${SECRET_KEY_STORAGE_KEY}_${accountId}`;
}

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

// Backup/restore behavior (documented here per issue #17, not previously
// written down anywhere): on iOS, WHEN_UNLOCKED_THIS_DEVICE_ONLY explicitly
// excludes this item from iCloud Keychain sync/backup -- it never leaves the
// device. On Android, expo-secure-store backs onto the Android Keystore,
// whose keys are hardware-bound and are never included in Auto Backup even
// if the app's SharedPreferences file is; a restored blob without its
// Keystore key is simply undecryptable garbage. Net effect on both
// platforms: the secret does not survive a device backup/restore, by
// design. That's the safe behavior (a copied ciphertext with no way to
// decrypt it), but it does mean a user who backs up and restores to a new
// device must re-import their wallet -- there is intentionally no
// migration path, since building one would mean the secret becomes
// exportable, which defeats the point of hardware-backed storage.
export async function saveSecretKey(
  secret: string,
  options: { allowOverwrite?: boolean } = {}
): Promise<void> {
  return saveSecretKeyForAccount(DEFAULT_ACCOUNT_ID, secret, options);
}

export async function getSecretKey(): Promise<string | null> {
  return getSecretKeyForAccount(DEFAULT_ACCOUNT_ID);
}

export async function deleteSecretKey(): Promise<void> {
  return deleteSecretKeyForAccount(DEFAULT_ACCOUNT_ID);
}

// --- Per-account secret storage (issue #18) ------------------------------
// Same SecureStore backend/tier as the original single-account functions
// above (which now just forward to DEFAULT_ACCOUNT_ID) -- namespacing by
// accountId is purely a key-naming scheme, not a new storage mechanism, so
// existing installs' secrets stay readable with zero migration step: an
// install with one wallet already has its secret under
// SECRET_KEY_STORAGE_KEY, which is exactly what DEFAULT_ACCOUNT_ID resolves
// to.
export async function saveSecretKeyForAccount(
  accountId: string,
  secret: string,
  options: { allowOverwrite?: boolean } = {}
): Promise<void> {
  const storageKey = secretStorageKeyFor(accountId);
  if (!options.allowOverwrite) {
    const existing = await SecureStore.getItemAsync(storageKey);
    if (existing !== null) {
      throw new Error(
        "SECRET_ALREADY_EXISTS: a wallet secret is already stored on this device for this " +
          "account. Remove the existing account before creating or importing a new one under " +
          "the same id, or pass { allowOverwrite: true } if this call site intentionally " +
          "replaces it."
      );
    }
  }
  await SecureStore.setItemAsync(storageKey, secret, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getSecretKeyForAccount(accountId: string): Promise<string | null> {
  return SecureStore.getItemAsync(secretStorageKeyFor(accountId));
}

export async function deleteSecretKeyForAccount(accountId: string): Promise<void> {
  await SecureStore.deleteItemAsync(secretStorageKeyFor(accountId));
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

// --- Multi-account bookkeeping (issue #18) --------------------------------
// The accounts list + active-account pointer are not secret (they're public
// keys and labels, same sensitivity as saveWalletMeta above), but they live
// in SecureStore rather than AsyncStorage so they share the wallet secret's
// device lifecycle -- if the app is reinstalled and the Keystore/Keychain
// item is gone, the account list shouldn't survive either, since it would
// otherwise point at accounts whose secrets no longer exist.
export async function saveAccounts(accounts: Account[]): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

export async function loadAccounts(): Promise<Account[]> {
  const raw = await SecureStore.getItemAsync(ACCOUNTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Account[];
  } catch {
    return [];
  }
}

export async function deleteAccounts(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCOUNTS_STORAGE_KEY);
}

export async function saveActiveAccountId(accountId: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_ACCOUNT_ID_STORAGE_KEY, accountId);
}

export async function loadActiveAccountId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_ACCOUNT_ID_STORAGE_KEY);
}

export async function deleteActiveAccountId(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_ACCOUNT_ID_STORAGE_KEY);
}

// --- Address book (issue #20) ---------------------------------------------
// Storage-tier decision: SecureStore, not AsyncStorage. A bare Stellar
// address is public information, but a *labeled* contact ("Mom", "Exchange
// withdrawal wallet") lets anyone who can read the app's storage
// deanonymize a meaningful slice of the user's transaction graph -- a
// materially higher sensitivity bar than an address alone. That puts it
// above guardianStorage.ts's tier (guardian public keys carry no
// relationship label) and in line with the wallet secret's own hardware-
// backed storage. AsyncStorage was considered and rejected for this reason.
//
// Contact data must never be attached to analytics/crash-reporting payloads
// (issue #20 DoD) -- there is no analytics/crash-reporting SDK wired into
// this codebase today (no Sentry/Amplitude/etc. dependency), so the
// constraint is satisfied by construction; this comment is the enforcement
// point if one is ever added later.
export async function saveContacts(contacts: Contact[]): Promise<void> {
  await SecureStore.setItemAsync(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
}

export async function loadContacts(): Promise<Contact[]> {
  const raw = await SecureStore.getItemAsync(CONTACTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Contact[];
  } catch {
    return [];
  }
}

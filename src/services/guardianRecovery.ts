import * as StellarSdk from "@stellar/stellar-sdk";
import { getAccount } from "./stellar";

const HORIZON_URL = process.env.EXPO_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE ?? StellarSdk.Networks.TESTNET;

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

/**
 * Below this, "M-of-N social recovery" degenerates into "one or two
 * people can unilaterally seize the account." Mirrors
 * globe-wallet's MIN_GUARDIANS_FOR_RECOVERY on the contract side
 * (Orbit-Wal/contract#20) so both layers enforce the same floor.
 */
export const MIN_GUARDIANS_FOR_RECOVERY = 3;

/** Per-guardian Stellar signer weight. */
const GUARDIAN_WEIGHT = 1;
/** Device (master) key signer weight — must stay below any valid
 * threshold so the device key alone can never satisfy the high
 * threshold and rotate the guardian set unilaterally. */
const DEVICE_WEIGHT = 1;

export class InvalidRecoveryConfigError extends Error {}

/**
 * Validates a proposed guardian threshold before building any transaction.
 * Mirrors the checks in globe-wallet's set_recovery_config so a user can't
 * configure Layer A into a state Layer B would reject once wired up
 * (see docs/design/recovery/RECOVERY.md §6).
 */
export function validateRecoveryConfig(guardianCount: number, threshold: number): void {
  if (guardianCount < MIN_GUARDIANS_FOR_RECOVERY) {
    throw new InvalidRecoveryConfigError(
      `At least ${MIN_GUARDIANS_FOR_RECOVERY} guardians are required before recovery can be enabled.`
    );
  }
  if (threshold <= 1) {
    throw new InvalidRecoveryConfigError(
      "Threshold must be greater than 1 — a single guardian must never be able to recover the account alone."
    );
  }
  if (threshold > guardianCount) {
    throw new InvalidRecoveryConfigError("Threshold cannot exceed the number of guardians.");
  }
}

function uniquePublicKeys(guardianPublicKeys: string[]): string[] {
  const seen = new Set<string>();
  for (const pk of guardianPublicKeys) {
    if (seen.has(pk)) {
      throw new InvalidRecoveryConfigError(`Duplicate guardian: ${pk}`);
    }
    seen.add(pk);
  }
  return guardianPublicKeys;
}

/**
 * Builds (but does not sign or submit) the transaction that turns on
 * guardian recovery for `sourcePublicKey`: adds each guardian as a weight-1
 * signer, and sets highThreshold = threshold so that only `threshold`
 * guardians together — never the device key alone — can subsequently
 * change the signer set (including running this same operation again, or
 * recovering into a new device). lowThreshold/medThreshold stay at the
 * device's own weight so everyday operations (payments, trustlines) keep
 * working with just the device key, unaffected by this change.
 *
 * The caller is responsible for signing with the device's own keypair and
 * submitting via `submitTransaction` — this function only builds it so it
 * can be reviewed/displayed before signing.
 *
 * IMPORTANT — this only works unmodified for the *first* call (enabling
 * recovery from a fresh account, whose default highThreshold is 0). Stellar
 * requires an account's *current* highThreshold to already be met in order
 * to authorize a transaction that changes signers/thresholds again — and
 * because the device key's weight is deliberately kept below any valid
 * threshold (see DEVICE_WEIGHT above), the device alone cannot re-run this
 * to add/remove guardians or change the threshold once recovery has already
 * been enabled once. That is intentional: it prevents a compromised device
 * from unilaterally weakening its own guardian protection. It does mean a
 * *second* call to this function (e.g. from the "Update Recovery Settings"
 * UI) needs the same guardian-co-signing flow as `buildRecoverAccountTx` —
 * not implemented here, since guardian-cosigned config changes need the
 * same "collect signatures across guardians" UX as `app/guardians/recover.tsx`
 * uses, which is out of scope for the first, from-scratch enable path this
 * PR ships. `app/guardians/config.tsx` disables re-submission after the
 * first successful enable and directs the user to coordinate with guardians
 * instead, rather than silently failing on-chain.
 */
export async function buildEnableRecoveryTx(params: {
  sourcePublicKey: string;
  guardianPublicKeys: string[];
  threshold: number;
}): Promise<StellarSdk.Transaction> {
  const { sourcePublicKey, threshold } = params;
  const guardianPublicKeys = uniquePublicKeys(params.guardianPublicKeys);
  validateRecoveryConfig(guardianPublicKeys.length, threshold);

  const account = await getAccount(sourcePublicKey);
  const builder = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  for (const guardianPublicKey of guardianPublicKeys) {
    builder.addOperation(
      StellarSdk.Operation.setOptions({
        signer: { ed25519PublicKey: guardianPublicKey, weight: GUARDIAN_WEIGHT },
      })
    );
  }

  builder.addOperation(
    StellarSdk.Operation.setOptions({
      masterWeight: DEVICE_WEIGHT,
      lowThreshold: DEVICE_WEIGHT,
      medThreshold: DEVICE_WEIGHT,
      highThreshold: threshold,
    })
  );

  return builder.setTimeout(180).build();
}

/**
 * Builds the transaction guardians co-sign to recover a lost device:
 * adds `newDevicePublicKey` as the new device signer at the device
 * weight, and disables the lost device's own keypair as a signer by
 * setting masterWeight to 0 (the account ID itself never changes, so
 * history/trustlines/balances are all unaffected — only which keys can
 * sign for it changes).
 *
 * `minTime` is set to `now + delaySeconds`: Horizon enforces this at the
 * protocol level regardless of how much signature weight the transaction
 * carries, so this delay cannot be bypassed by a colluding guardian
 * majority submitting early through a different client (see
 * docs/design/recovery/RECOVERY.md §4.3).
 *
 * This transaction requires signatures from >= `threshold` guardians
 * (weight GUARDIAN_WEIGHT each) to meet highThreshold — the lost
 * device's key is, by construction, not one of the signers.
 */
export async function buildRecoverAccountTx(params: {
  lostAccountPublicKey: string;
  newDevicePublicKey: string;
  delaySeconds: number;
}): Promise<StellarSdk.Transaction> {
  const { lostAccountPublicKey, newDevicePublicKey, delaySeconds } = params;
  if (delaySeconds <= 0) {
    throw new InvalidRecoveryConfigError("Recovery delay must be greater than zero.");
  }

  const account = await getAccount(lostAccountPublicKey);
  const readyAt = Math.floor(Date.now() / 1000) + delaySeconds;

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
    timebounds: { minTime: readyAt, maxTime: readyAt + 7 * 24 * 60 * 60 },
  })
    .addOperation(
      StellarSdk.Operation.setOptions({
        signer: { ed25519PublicKey: newDevicePublicKey, weight: DEVICE_WEIGHT },
      })
    )
    .addOperation(StellarSdk.Operation.setOptions({ masterWeight: 0 }))
    .build();

  return tx;
}

/** A guardian signs a previously-built recovery transaction with their own keypair. */
export function signAsGuardian(
  tx: StellarSdk.Transaction,
  guardianSecretKey: string
): StellarSdk.Transaction {
  const keypair = StellarSdk.Keypair.fromSecret(guardianSecretKey);
  tx.sign(keypair);
  return tx;
}

/**
 * Submits a signed transaction (an enable-recovery tx or a guardian-signed
 * recovery tx) to Horizon. For a recovery tx specifically, Horizon itself
 * enforces both the signature-weight threshold and the minTime timelock —
 * this function does no local quorum bookkeeping beyond what Horizon's
 * rejection reason tells the caller, by design: the guarantee has to come
 * from the protocol, not from this app's state.
 */
export async function submitSignedTransaction(
  tx: StellarSdk.Transaction
): Promise<StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse> {
  return server.submitTransaction(tx);
}

/** Re-fetches the account and returns its current signers, for display on the status screen. */
export async function getSigners(
  publicKey: string
): Promise<StellarSdk.Horizon.HorizonApi.AccountSigner[]> {
  const account = await getAccount(publicKey);
  return account.signers;
}

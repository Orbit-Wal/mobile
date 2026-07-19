/**
 * Standalone, real-testnet verification of the Layer-A guardian recovery
 * flow (src/services/guardianRecovery.ts). Not part of the Jest suite —
 * this hits real Horizon testnet endpoints and takes real wall-clock time
 * (it waits out an actual timelock), which the CONTRIBUTING.md guidance
 * asks for explicitly ("real logs from a real run against testnet ...
 * not a mocked call") for network/contract-facing work.
 *
 * Run with: npx tsx scripts/verify-recovery-testnet.ts
 */
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  buildEnableRecoveryTx,
  buildRecoverAccountTx,
  signAsGuardian,
  submitSignedTransaction,
  getSigners,
} from "../src/services/guardianRecovery";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function fund(publicKey: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    throw new Error(`friendbot funding failed for ${publicKey}: ${res.status} ${await res.text()}`);
  }
  log(`funded ${publicKey}`);
}

async function main() {
  log("Generating fresh testnet keypairs (owner, 3 guardians, new device)...");
  const owner = StellarSdk.Keypair.random();
  const guardians = [StellarSdk.Keypair.random(), StellarSdk.Keypair.random(), StellarSdk.Keypair.random()];
  const newDevice = StellarSdk.Keypair.random();

  log(`owner:      ${owner.publicKey()}`);
  guardians.forEach((g, i) => log(`guardian ${i + 1}: ${g.publicKey()}`));
  log(`new device: ${newDevice.publicKey()}`);

  await fund(owner.publicKey());

  log("Building enable-recovery tx (3 guardians, threshold=2)...");
  const enableTx = await buildEnableRecoveryTx({
    sourcePublicKey: owner.publicKey(),
    guardianPublicKeys: guardians.map((g) => g.publicKey()),
    threshold: 2,
  });
  enableTx.sign(owner);
  const enableResult = await submitSignedTransaction(enableTx);
  log(`enable-recovery tx submitted: hash=${enableResult.hash} successful=${enableResult.successful}`);

  const signersAfterEnable = await getSigners(owner.publicKey());
  log(`signers after enable: ${JSON.stringify(signersAfterEnable, null, 2)}`);

  log("Building recovery tx with a short 10s delay (for a fast but real timelock demonstration)...");
  const recoveryTx = await buildRecoverAccountTx({
    lostAccountPublicKey: owner.publicKey(),
    newDevicePublicKey: newDevice.publicKey(),
    delaySeconds: 10,
  });

  let signedTx = signAsGuardian(recoveryTx, guardians[0].secret());
  signedTx = signAsGuardian(signedTx, guardians[1].secret());
  log(`recovery tx signed by 2 of 3 guardians (threshold=2). Signature count: ${signedTx.signatures.length}`);

  log("Submitting BEFORE the timelock has elapsed — expecting Horizon to reject this...");
  try {
    const early = await submitSignedTransaction(signedTx);
    log(`UNEXPECTED: early submission succeeded: ${JSON.stringify(early)}`);
    process.exitCode = 1;
    return;
  } catch (err: any) {
    const extras = err?.response?.data?.extras;
    log(`EXPECTED rejection before timelock: ${JSON.stringify(extras ?? err?.message ?? err)}`);
  }

  log("Waiting 12s for the timelock to elapse...");
  await new Promise((resolve) => setTimeout(resolve, 12_000));

  log("Re-submitting after the timelock has elapsed — expecting success...");
  let finalResult;
  try {
    finalResult = await submitSignedTransaction(signedTx);
  } catch (err: any) {
    const extras = err?.response?.data?.extras;
    log(`Resubmission after timelock FAILED: ${JSON.stringify(extras ?? err?.message ?? String(err))}`);
    throw err;
  }
  log(`recovery tx submitted: hash=${finalResult.hash} successful=${finalResult.successful}`);

  const signersAfterRecovery = await getSigners(owner.publicKey());
  log(`signers after recovery: ${JSON.stringify(signersAfterRecovery, null, 2)}`);

  const newDeviceIsSigner = signersAfterRecovery.some(
    (s) => s.key === newDevice.publicKey() && s.weight > 0
  );
  const oldMasterKeyDisabled = signersAfterRecovery.some(
    (s) => s.key === owner.publicKey() && s.weight === 0
  );
  log(`ASSERT new device is now an active signer: ${newDeviceIsSigner}`);
  log(`ASSERT old master key weight is now 0: ${oldMasterKeyDisabled}`);

  if (!newDeviceIsSigner || !oldMasterKeyDisabled) {
    log("FAILED: recovery did not produce the expected signer state.");
    process.exitCode = 1;
    return;
  }
  log("SUCCESS: end-to-end guardian recovery verified against real Stellar testnet.");
}

main().catch((err) => {
  console.error("Verification script failed:", err);
  process.exitCode = 1;
});

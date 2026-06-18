import * as StellarSdk from "@stellar/stellar-sdk";

const HORIZON_URL = process.env.EXPO_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE ?? StellarSdk.Networks.TESTNET;

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export function generateKeypair(): StellarSdk.Keypair {
  return StellarSdk.Keypair.random();
}

export async function getAccount(publicKey: string) {
  return server.loadAccount(publicKey);
}

export async function getBalances(publicKey: string): Promise<Record<string, string>> {
  const account = await getAccount(publicKey);
  const result: Record<string, string> = {};
  for (const balance of account.balances) {
    if (balance.asset_type === "native") {
      result["XLM"] = balance.balance;
    } else if ("asset_code" in balance) {
      result[balance.asset_code] = balance.balance;
    }
  }
  return result;
}

export async function sendPayment(params: {
  sourceSecretKey: string;
  destinationPublicKey: string;
  asset: StellarSdk.Asset;
  amount: string;
  memo?: string;
}): Promise<StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse> {
  const { sourceSecretKey, destinationPublicKey, asset, amount, memo } = params;
  const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
  const sourceAccount = await getAccount(sourceKeypair.publicKey());
  const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationPublicKey,
        asset,
        amount,
      })
    )
    .setTimeout(30);
  if (memo) builder.addMemo(StellarSdk.Memo.text(memo));
  const tx = builder.build();
  tx.sign(sourceKeypair);
  return server.submitTransaction(tx);
}

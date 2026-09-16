import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { config } from "../config.js";

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
]);

/**
 * Send GME from the public jackpot wallet to the winner.
 * Never logs private keys or marketing/fee wallets.
 */
export async function sendJackpotPayout(input: {
  winner: `0x${string}`;
  amountGme: number;
}): Promise<{ txHash: Hex }> {
  if (!config.jackpotPrivateKey) {
    throw new Error(
      "DRY_RUN_PAYOUTS=false but JACKPOT_PRIVATE_KEY is not set",
    );
  }
  if (!config.gmeTokenAddress) {
    throw new Error("DRY_RUN_PAYOUTS=false but GME_TOKEN_ADDRESS is not set");
  }
  if (!config.rpcUrl) {
    throw new Error("DRY_RUN_PAYOUTS=false but RPC_URL is not set");
  }

  const account = privateKeyToAccount(
    config.jackpotPrivateKey as Hex,
  );
  if (account.address.toLowerCase() !== config.jackpotWallet.toLowerCase()) {
    throw new Error(
      "JACKPOT_PRIVATE_KEY does not match JACKPOT_WALLET (public jackpot only)",
    );
  }

  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({
    chain: {
      id: config.chainId,
      name: "robinhood-chain",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    },
    transport,
  });
  const walletClient = createWalletClient({
    account,
    chain: publicClient.chain,
    transport,
  });

  const token = config.gmeTokenAddress as `0x${string}`;
  const decimals = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const amount = BigInt(
    Math.floor(input.amountGme * 10 ** Number(decimals)),
  );
  if (amount <= 0n) {
    throw new Error("Payout amount rounds to zero");
  }

  const txHash = await walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "transfer",
    args: [input.winner, amount],
  });

  return { txHash };
}

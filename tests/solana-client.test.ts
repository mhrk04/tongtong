import { describe, expect, test } from "vitest";
import {
  CLUSTERS,
  getClusterUrl,
  getWalletChain,
} from "../app/lib/solana-client";

describe("cluster configuration", () => {
  test("maps every cluster to an RPC url and a wallet chain", () => {
    expect(CLUSTERS.map(getClusterUrl)).toEqual([
      "https://api.devnet.solana.com",
      "https://api.testnet.solana.com",
      "https://api.mainnet-beta.solana.com",
      "http://localhost:8899",
    ]);
    expect(CLUSTERS.map(getWalletChain)).toEqual([
      "solana:devnet",
      "solana:testnet",
      "solana:mainnet",
      // Wallets do not advertise a localnet chain.
      "solana:devnet",
    ]);
  });
});

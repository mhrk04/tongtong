export function parseTransactionError(err: unknown): string {
  if (err instanceof Error && err.message.includes("User rejected")) {
    return "Transaction was rejected by the wallet.";
  }

  const simulation = getSimulationDetails(err);
  if (simulation) return simulation;

  const message = getDeepestMessage(err);
  if (message.includes("Attempt to debit an account")) {
    return "Not enough devnet SOL for transaction fees or token-account setup. Use the Solana faucet, then retry.";
  }
  return message.length > 200 ? `${message.slice(0, 200)}...` : message;
}

function getSimulationDetails(err: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    const logs = record.logs;
    if (Array.isArray(logs) && logs.length > 0) {
      const relevant = logs
        .filter((log): log is string => typeof log === "string")
        .slice(-3);
      if (relevant.length > 0) {
        return `Transaction simulation failed: ${relevant.join(" | ")}`;
      }
    }
    current = record.cause;
  }
  return undefined;
}

function getDeepestMessage(err: unknown): string {
  let deepest = err instanceof Error ? err.message : String(err);
  let current: unknown = err;

  while (current instanceof Error && current.cause) {
    current = current.cause;
    if (current instanceof Error) {
      deepest = current.message;
    }
  }

  return deepest;
}

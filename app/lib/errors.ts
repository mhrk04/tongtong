import {
  isSolanaError,
  SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED,
} from "@solana/kit";

const UNKNOWN_FAILURE = "The transaction failed for an unknown reason.";

export function isBlockhashExpired(err: unknown) {
  return isSolanaError(err, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED);
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function parseTransactionError(err: unknown): string {
  if (isBlockhashExpired(err)) {
    return "The transaction expired before reaching Solana. Please try again.";
  }
  const message = getDeepestMessage(err);
  if (message.includes("User rejected")) {
    return "Transaction was rejected by the wallet.";
  }

  const simulation = getSimulationDetails(err);
  if (simulation) return simulation;

  if (message.includes("Attempt to debit an account")) {
    return "Not enough devnet SOL for transaction fees or token-account setup. Use the Solana faucet, then retry.";
  }
  if (!message) return UNKNOWN_FAILURE;
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

/**
 * Walks the cause chain for the most specific message. Wallets and RPC
 * transports also reject with plain objects and cross-realm errors that fail
 * `instanceof Error`, so any `message` string counts.
 */
function getDeepestMessage(err: unknown): string {
  const seen = new Set<unknown>();
  let deepest = readMessage(err) ?? stringify(err);
  let current: unknown = err;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
    const message = readMessage(current);
    if (message) {
      deepest = message;
    }
  }

  return deepest;
}

function readMessage(value: unknown): string | undefined {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object") {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return undefined;
}

function stringify(value: unknown): string {
  if (value == null) return "";
  return typeof value === "object" ? "" : String(value);
}

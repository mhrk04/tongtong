"use client";

import { useAction } from "@solana/react";
import { toast } from "sonner";
import { useCluster } from "../../components/cluster-context";
import { isBlockhashExpired, parseTransactionError } from "../errors";

type TxResult = { context: { signature: string } };

export function useSend() {
  const { getExplorerUrl } = useCluster();

  const { dispatchAsync, isRunning } = useAction(
    async (
      _signal: AbortSignal,
      action: () => Promise<TxResult>,
      successMessage: string
    ) => {
      try {
        let result: TxResult;
        try {
          result = await action();
        } catch (error) {
          if (!isBlockhashExpired(error)) throw error;
          toast.info("Transaction expired; retrying with a fresh blockhash");
          result = await action();
        }
        const signature = result.context.signature;
        toast.success(successMessage, {
          description: (
            <a
              href={getExplorerUrl(`/tx/${signature}?view=receipt`)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View transaction
            </a>
          ),
        });
        return signature;
      } catch (err) {
        console.error(err);
        toast.error(parseTransactionError(err));
        return undefined;
      }
    }
  );

  return { run: dispatchAsync, isSending: isRunning };
}

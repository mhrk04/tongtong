"use client";

import { useState } from "react";
import { sol, solToLamports, type Lamports } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { toast } from "sonner";
import { useAppClient } from "../../lib/client-provider";
import { useSend } from "../../lib/hooks/use-send";
import { parseAddress } from "../../lib/address";
import {
  ACTION_CARD_CLASS,
  ADDRESS_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  TEXT_INPUT_CLASS,
} from "../../lib/ui";

export function TransferSolCard() {
  const client = useAppClient();
  const connected = useConnectedWallet(client);
  const { run, isSending } = useSend();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.01");

  const handleTransfer = async () => {
    if (!connected?.signer || !recipient) return;
    const signer = connected.signer;

    const destination = parseAddress(recipient, "Invalid recipient address");
    if (!destination) return;

    let transferAmount: Lamports;
    try {
      transferAmount = solToLamports(sol(amount));
    } catch {
      toast.error("Invalid amount");
      return;
    }

    await run(
      () =>
        client.system.instructions
          .transferSol({
            source: signer,
            destination,
            amount: transferAmount,
          })
          .sendTransaction(),
      "SOL transfer sent"
    );
  };

  return (
    <div className={ACTION_CARD_CLASS}>
      <h2 className="text-sm font-semibold">Transfer SOL</h2>
      <p className="mt-1 text-xs text-muted">
        Send SOL from your connected wallet to any address.
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Recipient address"
          className={ADDRESS_INPUT_CLASS}
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount (SOL)"
          className={TEXT_INPUT_CLASS}
        />
        <button
          onClick={handleTransfer}
          disabled={isSending || !recipient || Number(amount) <= 0}
          className={PRIMARY_BUTTON_CLASS}
        >
          {isSending ? "Sending..." : "Send SOL"}
        </button>
      </div>
    </div>
  );
}

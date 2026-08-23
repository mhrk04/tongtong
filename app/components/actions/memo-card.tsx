"use client";

import { useState } from "react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useAppClient } from "../../lib/client-provider";
import { useSend } from "../../lib/hooks/use-send";
import {
  ACTION_CARD_CLASS,
  PRIMARY_BUTTON_CLASS,
  TEXT_INPUT_CLASS,
} from "../../lib/ui";

export function MemoCard() {
  const client = useAppClient();
  const connected = useConnectedWallet(client);
  const { run, isSending } = useSend();
  const [memo, setMemo] = useState("gm from @solana/kit");

  const handleMemo = async () => {
    if (!connected?.signer || !memo) return;
    const signer = connected.signer;

    await run(
      () =>
        client.memo.instructions
          .addMemo({ memo, signers: [signer] })
          .sendTransaction(),
      "Memo posted"
    );
  };

  return (
    <div className={ACTION_CARD_CLASS}>
      <h2 className="text-sm font-semibold">Add memo</h2>
      <p className="mt-1 text-xs text-muted">
        Attach an on-chain note with the SPL Memo program via the
        @solana-program/memo kit plugin.
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Your memo"
          className={TEXT_INPUT_CLASS}
        />
        <button
          onClick={handleMemo}
          disabled={isSending || !memo}
          className={PRIMARY_BUTTON_CLASS}
        >
          {isSending ? "Posting..." : "Post memo"}
        </button>
      </div>
    </div>
  );
}

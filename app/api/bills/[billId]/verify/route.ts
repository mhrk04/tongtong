import { createSolanaRpc, type Signature } from "@solana/kit";
import {
  getBill,
  USDC_DEVNET_MINT,
  saveBill,
} from "../../../../lib/bill-store";

const rpc = createSolanaRpc("https://api.devnet.solana.com");

type TokenBalance = {
  owner?: string;
  mint?: string;
  uiTokenAmount?: { amount?: string };
};

type ParsedInstruction = {
  program?: string;
  parsed?: unknown;
};

function sumOwnerBalance(
  balances: TokenBalance[] | undefined,
  owner: string,
  mint: string
) {
  return (balances ?? []).reduce((total, balance) => {
    if (balance.owner !== owner || balance.mint !== mint) return total;
    return total + BigInt(balance.uiTokenAmount?.amount ?? "0");
  }, 0n);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ billId: string }> }
) {
  const { billId } = await params;
  const bill = getBill(billId);
  if (!bill) return Response.json({ error: "Bill not found" }, { status: 404 });

  try {
    const body = await request.json();
    const participant = bill.participants.find(
      (candidate) => candidate.id === body.participantId
    );
    const signature = String(body.signature ?? "");

    if (!participant || !signature) {
      return Response.json(
        { error: "Invalid payment details" },
        { status: 400 }
      );
    }
    if (participant.status === "paid" && participant.signature === signature) {
      return Response.json({ bill });
    }

    const transaction = await rpc
      .getTransaction(signature as Signature, {
        commitment: "confirmed",
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
      })
      .send();
    const parsed = transaction as unknown as {
      meta?: {
        err?: unknown;
        preTokenBalances?: TokenBalance[];
        postTokenBalances?: TokenBalance[];
      };
      transaction?: {
        message?: { instructions?: ParsedInstruction[] };
      };
    } | null;

    if (!parsed?.meta) {
      return Response.json(
        { error: "Transaction is not confirmed yet" },
        { status: 409 }
      );
    }
    if (parsed.meta.err != null) {
      return Response.json(
        { error: "Transaction failed on devnet" },
        { status: 400 }
      );
    }

    const before = sumOwnerBalance(
      parsed.meta.preTokenBalances,
      bill.hostWallet,
      USDC_DEVNET_MINT
    );
    const after = sumOwnerBalance(
      parsed.meta.postTokenBalances,
      bill.hostWallet,
      USDC_DEVNET_MINT
    );
    const expected = BigInt(participant.amountBaseUnits);
    const memoMatches = (parsed.transaction?.message?.instructions ?? []).some(
      (instruction) =>
        instruction.program === "spl-memo" &&
        (instruction.parsed === participant.paymentReference ||
          JSON.stringify(instruction.parsed).includes(
            participant.paymentReference
          ))
    );

    if (after - before !== expected || !memoMatches) {
      return Response.json(
        { error: "Payment does not match this participant's bill share" },
        { status: 400 }
      );
    }

    participant.status = "paid";
    participant.signature = signature;
    saveBill(bill);
    return Response.json({ bill });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not verify payment",
      },
      { status: 400 }
    );
  }
}

import { createSolanaRpc, type Signature } from "@solana/kit";
import {
  getBill,
  USDC_DEVNET_MINT,
  saveBill,
} from "../../../../lib/bill-store";
import {
  errorResponse,
  UpstreamError,
  ValidationError,
} from "../../../../lib/api-errors";

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

/**
 * `parsed` is whatever the RPC decoded for the instruction: a string for
 * spl-memo, but an object or `undefined` for other shapes, so it is serialized
 * defensively before the reference is matched.
 */
function memoMatchesReference(
  instructions: ParsedInstruction[],
  reference: string
) {
  return instructions.some((instruction) => {
    if (instruction.program !== "spl-memo") return false;
    if (instruction.parsed === reference) return true;
    return serialize(instruction.parsed).includes(reference);
  });
}

function serialize(value: unknown) {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

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

  try {
    const bill = await getBill(billId);
    if (!bill)
      return Response.json({ error: "Bill not found" }, { status: 404 });

    const body = await request.json();
    const participant = bill.participants.find(
      (candidate) => candidate.id === body.participantId
    );
    const signature = String(body.signature ?? "");

    if (!participant || !signature) {
      throw new ValidationError("Invalid payment details");
    }
    if (participant.status === "paid" && participant.signature === signature) {
      return Response.json({ bill });
    }

    let transaction;
    try {
      transaction = await rpc
        .getTransaction(signature as Signature, {
          commitment: "confirmed",
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
        })
        .send();
    } catch (cause) {
      throw new UpstreamError(
        "Could not reach Solana devnet to verify this payment. Retry in a moment.",
        { cause }
      );
    }
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
      throw new ValidationError("Transaction failed on devnet");
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
    const memoMatches = memoMatchesReference(
      parsed.transaction?.message?.instructions ?? [],
      participant.paymentReference
    );

    if (after - before !== expected || !memoMatches) {
      throw new ValidationError(
        "Payment does not match this participant's bill share"
      );
    }

    // Build the paid bill instead of mutating in place so a storage failure
    // cannot leave the in-memory local store marked paid without persisting.
    const paidBill = {
      ...bill,
      participants: bill.participants.map((candidate) =>
        candidate.id === participant.id
          ? { ...candidate, status: "paid" as const, signature }
          : candidate
      ),
    };
    await saveBill(paidBill);
    return Response.json({ bill: paidBill });
  } catch (error) {
    return errorResponse(error, "Could not verify payment");
  }
}

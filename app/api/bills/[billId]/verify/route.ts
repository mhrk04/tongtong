import { createSolanaRpc, type Signature } from "@solana/kit";
import {
  getBill,
  isValidBillId,
  USDC_DEVNET_MINT,
  saveBill,
} from "../../../../lib/bill-store";
import {
  jsonError,
  routeErrorResponse,
  UpstreamError,
} from "../../../../lib/api-response";

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

type TokenBalance = {
  owner?: string;
  mint?: string;
  uiTokenAmount?: { amount?: string };
};

type ParsedMemo = { memo?: string; info?: string | { memo?: string } };

type ParsedInstruction = {
  program?: string;
  parsed?: string | ParsedMemo;
};

function readMemo(instruction: ParsedInstruction) {
  const { parsed } = instruction;
  if (typeof parsed === "string") return parsed;
  if (parsed?.memo != null) return parsed.memo;
  const info = parsed?.info;
  if (typeof info === "string") return info;
  return info?.memo;
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
  if (!isValidBillId(billId)) {
    return jsonError("Bill not found", 404);
  }

  try {
    const bill = await getBill(billId);
    if (!bill) return jsonError("Bill not found", 404);

    const body = await request.json();
    const participant = bill.participants.find(
      (candidate) => candidate.id === body.participantId
    );
    const signature = String(body.signature ?? "");

    if (!participant || !SIGNATURE_PATTERN.test(signature)) {
      return jsonError("Invalid payment details", 400);
    }
    if (participant.status === "paid") {
      // Only the recorded transaction can replay a settled share; a share the
      // host covered has no signature, so nothing can confirm it.
      if (participant.signature === signature) return Response.json({ bill });
      return jsonError("This bill share is already paid", 409);
    }
    if (
      bill.participants.some(
        (candidate) =>
          candidate.id !== participant.id && candidate.signature === signature
      )
    ) {
      return jsonError("This transaction already settled another share", 409);
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
      // The payer's request is fine; devnet is not answering.
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
      return jsonError("Transaction is not confirmed yet", 409);
    }
    if (parsed.meta.err != null) {
      return jsonError("Transaction failed on devnet", 400);
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
        readMemo(instruction)?.trim() === participant.paymentReference
    );

    if (after - before !== expected || !memoMatches) {
      return jsonError(
        "Payment does not match this participant's bill share",
        400
      );
    }

    // Only report the share as paid once the store has accepted it, so a
    // storage failure cannot leave the in-memory bill claiming otherwise.
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
    return routeErrorResponse(error, "Could not verify payment");
  }
}

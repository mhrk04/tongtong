import { address } from "@solana/kit";
import { createBill } from "../../lib/bill-store";
import { jsonError, routeErrorResponse } from "../../lib/api-response";

const MAX_BODY_BYTES = 32_000;
const MAX_TITLE_LENGTH = 120;
const MAX_NAME_LENGTH = 60;
const MAX_ITEM_NAME_LENGTH = 80;
const MAX_AMOUNT_MYR = 1_000_000;
const MAX_RATE = 1_000_000;
const MAX_FEE_PERCENT = 100;

class InvalidBillInputError extends Error {}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonError("Bill is too large", 413);
    }
    const body = JSON.parse(raw);
    const participantNames = body.participantNames;
    const items = body.items;
    const rate = Number(body.rate);
    const feePercent = Number(body.feePercent);

    if (
      typeof body.title !== "string" ||
      body.title.length > MAX_TITLE_LENGTH ||
      typeof body.hostWallet !== "string" ||
      !Array.isArray(participantNames) ||
      participantNames.length < 2 ||
      participantNames.length > 8 ||
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 50 ||
      participantNames.some(
        (name: unknown) =>
          typeof name !== "string" || name.length > MAX_NAME_LENGTH
      ) ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      rate > MAX_RATE ||
      !Number.isFinite(feePercent) ||
      feePercent < 0 ||
      feePercent > MAX_FEE_PERCENT
    ) {
      return jsonError("Invalid bill details", 400);
    }

    address(body.hostWallet);

    const normalizedItems = items.map((item: unknown, index: number) => {
      const candidate = item as Record<string, unknown>;
      const name = String(candidate.name ?? "").trim();
      const amountMyr = Number(candidate.amountMyr);
      const assigneeIds = Array.isArray(candidate.assigneeIds)
        ? [...new Set(candidate.assigneeIds.map(String))]
        : undefined;

      if (
        !name ||
        name.length > MAX_ITEM_NAME_LENGTH ||
        !Number.isFinite(amountMyr) ||
        amountMyr <= 0 ||
        amountMyr > MAX_AMOUNT_MYR ||
        !Array.isArray(assigneeIds) ||
        assigneeIds.length === 0 ||
        assigneeIds.length > participantNames.length
      ) {
        throw new InvalidBillInputError(`Invalid item ${index + 1}`);
      }

      return {
        id: `item-${index + 1}`,
        name,
        amountMyr,
        assigneeIds,
      };
    });

    const participantIds = new Set(
      participantNames.map((_: unknown, index: number) => `p${index + 1}`)
    );
    if (
      normalizedItems.some((item) =>
        item.assigneeIds.some((id) => !participantIds.has(id))
      )
    ) {
      return jsonError("Invalid item assignment", 400);
    }
    if (
      [...participantIds].some(
        (participantId) =>
          !normalizedItems.some((item) =>
            item.assigneeIds.includes(participantId)
          )
      )
    ) {
      return jsonError(
        "Every person must have at least one assigned item",
        400
      );
    }

    const bill = await createBill({
      title: body.title,
      hostWallet: body.hostWallet,
      rate,
      feePercent,
      items: normalizedItems,
      participantNames: participantNames.map(String),
    });

    return Response.json({ bill }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidBillInputError) {
      return jsonError(error.message, 400);
    }
    return routeErrorResponse(error, "Invalid bill details", 400);
  }
}

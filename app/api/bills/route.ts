import { address } from "@solana/kit";
import { createBill } from "../../lib/bill-store";
import { routeErrorResponse } from "../../lib/api-response";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const participantNames = body.participantNames;
    const items = body.items;
    const rate = Number(body.rate);
    const feePercent = Number(body.feePercent);

    if (
      typeof body.title !== "string" ||
      typeof body.hostWallet !== "string" ||
      !Array.isArray(participantNames) ||
      participantNames.length < 2 ||
      participantNames.length > 8 ||
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 50 ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      !Number.isFinite(feePercent) ||
      feePercent < 0
    ) {
      return Response.json({ error: "Invalid bill details" }, { status: 400 });
    }

    address(body.hostWallet);

    const normalizedItems = items.map((item: unknown, index: number) => {
      const candidate = item as Record<string, unknown>;
      const name = String(candidate.name ?? "").trim();
      const amountMyr = Number(candidate.amountMyr);
      const assigneeIds = candidate.assigneeIds;

      if (
        !name ||
        !Number.isFinite(amountMyr) ||
        amountMyr <= 0 ||
        !Array.isArray(assigneeIds) ||
        assigneeIds.length === 0
      ) {
        throw new Error(`Invalid item ${index + 1}`);
      }

      return {
        id: `item-${index + 1}`,
        name,
        amountMyr,
        assigneeIds: assigneeIds.map(String),
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
      return Response.json(
        { error: "Invalid item assignment" },
        { status: 400 }
      );
    }
    if (
      [...participantIds].some(
        (participantId) =>
          !normalizedItems.some((item) =>
            item.assigneeIds.includes(participantId)
          )
      )
    ) {
      return Response.json(
        { error: "Every person must have at least one assigned item" },
        { status: 400 }
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
    return routeErrorResponse(error, "Could not create bill", 400);
  }
}

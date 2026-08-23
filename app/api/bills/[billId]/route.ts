import { getBill } from "../../../lib/bill-store";
import { errorResponse } from "../../../lib/api-errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ billId: string }> }
) {
  const { billId } = await params;
  try {
    const bill = await getBill(billId);
    if (!bill)
      return Response.json(
        { error: "Bill not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    return Response.json(
      { bill },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return errorResponse(error, "Could not load this bill", {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
